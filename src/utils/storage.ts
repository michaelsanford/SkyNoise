import type { OverheadEvent, UserSettings } from '../types';

/**
 * Persistence layer for the two localStorage keys the app owns.
 *
 * Everything here is defensive on purpose. The app is an installed PWA whose
 * shell is served from the service worker cache, so a value that throws while
 * building initial state white-screens the app on *every* subsequent load — the
 * user cannot reload their way out of it. Reads therefore never throw: they
 * validate, discard what they cannot understand, and fall back to defaults.
 */

export const SETTINGS_KEY = 'skynoise_settings';
export const HISTORY_KEY = 'skynoise_history';

/** Newest-first cap, matching the write path in App.tsx. */
export const HISTORY_LIMIT = 100;

export const DEFAULT_SETTINGS: UserSettings = {
  homeLat: null,
  homeLon: null,
  airportLat: null,
  airportLon: null,
  airportCode: '',
  maxAltitudeFt: 10000,
  detectionRadiusKm: 15,
  overheadRadiusKm: 1.5,
  useGPS: true,
  pollIntervalSeconds: 10,
  radarOrientation: 'north-up',
  showAirportsOnRadar: true
};

const TRAJECTORIES = ['landing', 'departing', 'transit', 'unknown'] as const;
const NOISE_LEVELS = ['high', 'medium', 'low'] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A latitude that is a real, in-range number. */
export function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

/** A longitude that is a real, in-range number. */
export function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

/**
 * Guard for the pair before it is interpolated into an API request path or fed
 * to the haversine helpers. `null` is a legitimate "not configured yet" state
 * and is deliberately *not* valid here — callers must not poll without a fix.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return isValidLatitude(lat) && isValidLongitude(lon);
}

/** Finite number within an inclusive range, else `fallback`. */
function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  return isFiniteNumber(value) && value >= min && value <= max ? value : fallback;
}

function nullableCoordinate(value: unknown, isValid: (v: unknown) => boolean): number | null {
  return isValid(value) ? (value as number) : null;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce an arbitrary parsed value into valid settings, field by field.
 *
 * Per-field fallback rather than all-or-nothing: one bad slider value should
 * not discard a location the user took the trouble to enter. Ranges mirror the
 * settings form's own slider bounds so a stored value can never drive the UI
 * outside what it can represent.
 */
export function coerceSettings(raw: unknown): UserSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const r = raw as Record<string, unknown>;

  return {
    homeLat: nullableCoordinate(r.homeLat, isValidLatitude),
    homeLon: nullableCoordinate(r.homeLon, isValidLongitude),
    airportLat: nullableCoordinate(r.airportLat, isValidLatitude),
    airportLon: nullableCoordinate(r.airportLon, isValidLongitude),
    airportCode: typeof r.airportCode === 'string' ? r.airportCode.slice(0, 8) : '',
    // Ranges match the sliders in the Tracker Thresholds card.
    maxAltitudeFt: numberInRange(r.maxAltitudeFt, 3000, 15000, DEFAULT_SETTINGS.maxAltitudeFt),
    detectionRadiusKm: numberInRange(r.detectionRadiusKm, 5, 40, DEFAULT_SETTINGS.detectionRadiusKm),
    overheadRadiusKm: numberInRange(r.overheadRadiusKm, 0.5, 5, DEFAULT_SETTINGS.overheadRadiusKm),
    useGPS: boolOr(r.useGPS, DEFAULT_SETTINGS.useGPS),
    pollIntervalSeconds: numberInRange(
      r.pollIntervalSeconds,
      1,
      300,
      DEFAULT_SETTINGS.pollIntervalSeconds
    ),
    radarOrientation: oneOf(
      r.radarOrientation,
      ['north-up', 'heading-up'] as const,
      DEFAULT_SETTINGS.radarOrientation
    ),
    showAirportsOnRadar: boolOr(r.showAirportsOnRadar, DEFAULT_SETTINGS.showAirportsOnRadar)
  };
}

/**
 * A history entry is dropped entirely if it is unusable, rather than repaired:
 * a log line with an invented distance or timestamp is worse than no line.
 */
function isValidEvent(value: unknown): value is OverheadEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.hex === 'string' &&
    isFiniteNumber(e.timestamp) &&
    isFiniteNumber(e.minDistanceKm) &&
    isFiniteNumber(e.altitudeFt)
  );
}

/** Fill in the descriptive fields a valid-but-sparse entry may be missing. */
function normaliseEvent(e: OverheadEvent): OverheadEvent {
  return {
    hex: e.hex,
    flight: typeof e.flight === 'string' ? e.flight : 'N/A',
    type: typeof e.type === 'string' ? e.type : 'UNKN',
    desc: typeof e.desc === 'string' ? e.desc : 'Unknown Aircraft',
    registration: typeof e.registration === 'string' ? e.registration : 'N/A',
    timestamp: e.timestamp,
    minDistanceKm: e.minDistanceKm,
    altitudeFt: e.altitudeFt,
    trajectory: oneOf(e.trajectory, TRAJECTORIES, 'unknown'),
    noiseLevel: oneOf(e.noiseLevel, NOISE_LEVELS, 'low')
  };
}

export function coerceHistory(raw: unknown): OverheadEvent[] {
  if (!Array.isArray(raw)) return [];
  // The cap is applied on read as well as on write: a hand-edited or
  // pre-existing oversized log would otherwise be rendered in full.
  return raw.filter(isValidEvent).map(normaliseEvent).slice(0, HISTORY_LIMIT);
}

/** `null` when storage is unavailable (Safari private mode, disabled cookies). */
function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadSettings(): UserSettings {
  const saved = readKey(SETTINGS_KEY);
  if (saved === null) return { ...DEFAULT_SETTINGS };
  try {
    return coerceSettings(JSON.parse(saved));
  } catch {
    // Malformed JSON — truncated by a quota failure, or hand-edited.
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadHistory(): OverheadEvent[] {
  const saved = readKey(HISTORY_KEY);
  if (saved === null) return [];
  try {
    return coerceHistory(JSON.parse(saved));
  } catch {
    return [];
  }
}

/**
 * Writes swallow failures. `setItem` throws `QuotaExceededError` when the log
 * grows past the origin quota and throws outright in Safari private mode; an
 * unhandled throw here escapes a `useEffect` and takes down the render.
 * Returns whether the write landed, for callers that want to surface it.
 */
function writeKey(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveSettings(settings: UserSettings): boolean {
  return writeKey(SETTINGS_KEY, settings);
}

export function saveHistory(history: OverheadEvent[]): boolean {
  return writeKey(HISTORY_KEY, history);
}

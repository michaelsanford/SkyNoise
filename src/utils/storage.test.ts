import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  coerceHistory,
  coerceSettings,
  DEFAULT_SETTINGS,
  HISTORY_KEY,
  HISTORY_LIMIT,
  isValidCoordinate,
  loadHistory,
  loadSettings,
  POLL_INTERVAL_OPTIONS,
  saveHistory,
  SETTINGS_KEY
} from './storage';
import type { OverheadEvent } from '../types';

/**
 * Vitest runs in the node environment here, so localStorage does not exist.
 * A minimal in-memory stand-in lets us drive the real read/write paths, and
 * lets us make setItem throw to reproduce a quota failure.
 */
function installStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    }
  };
  vi.stubGlobal('localStorage', mock);
  return { store, mock };
}

beforeEach(() => installStorage());
afterEach(() => vi.unstubAllGlobals());

describe('isValidCoordinate', () => {
  it('accepts in-range numeric pairs including zero', () => {
    expect(isValidCoordinate(45.5175, -73.4169)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate(-90, 180)).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(isValidCoordinate(999, 0)).toBe(false);
    expect(isValidCoordinate(0, 999)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
  });

  it('rejects non-numeric, null and non-finite values', () => {
    expect(isValidCoordinate('abc', 0)).toBe(false);
    expect(isValidCoordinate('45.5', '-73.4')).toBe(false);
    expect(isValidCoordinate(null, null)).toBe(false);
    expect(isValidCoordinate(undefined, undefined)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
    expect(isValidCoordinate(Infinity, 0)).toBe(false);
  });
});

describe('coerceSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings(5)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates a sparse object by filling in defaults', () => {
    // The pre-existing behaviour this replaces: {...DEFAULT_SETTINGS, ...parsed}
    expect(coerceSettings({ homeLat: 45.5, homeLon: -73.4 })).toEqual({
      ...DEFAULT_SETTINGS,
      homeLat: 45.5,
      homeLon: -73.4
    });
  });

  it('nulls a coordinate that is not a valid number', () => {
    expect(coerceSettings({ homeLat: 'abc', homeLon: -73.4 }).homeLat).toBeNull();
    expect(coerceSettings({ homeLat: 999, homeLon: -73.4 }).homeLat).toBeNull();
    expect(coerceSettings({ homeLat: 45.5, homeLon: 999 }).homeLon).toBeNull();
  });

  it('falls back per-field without discarding good sibling fields', () => {
    const result = coerceSettings({
      homeLat: 45.5175,
      homeLon: -73.4169,
      detectionRadiusKm: 'huge',
      maxAltitudeFt: 99999
    });
    // The bad values reset, the location survives.
    expect(result.homeLat).toBe(45.5175);
    expect(result.homeLon).toBe(-73.4169);
    expect(result.detectionRadiusKm).toBe(DEFAULT_SETTINGS.detectionRadiusKm);
    expect(result.maxAltitudeFt).toBe(DEFAULT_SETTINGS.maxAltitudeFt);
  });

  it('clamps numeric fields to the settings form ranges', () => {
    expect(coerceSettings({ detectionRadiusKm: 40 }).detectionRadiusKm).toBe(40);
    expect(coerceSettings({ detectionRadiusKm: 41 }).detectionRadiusKm).toBe(15);
    expect(coerceSettings({ overheadRadiusKm: 0.4 }).overheadRadiusKm).toBe(1.5);
    expect(coerceSettings({ maxAltitudeFt: 2999 }).maxAltitudeFt).toBe(10000);
  });

  it('rejects an unknown radar orientation', () => {
    expect(coerceSettings({ radarOrientation: 'sideways' }).radarOrientation).toBe('north-up');
    expect(coerceSettings({ radarOrientation: 'heading-up' }).radarOrientation).toBe('heading-up');
  });

  it('does not accept truthy non-booleans for flags', () => {
    expect(coerceSettings({ useGPS: 'yes' }).useGPS).toBe(true); // default
    expect(coerceSettings({ useGPS: false }).useGPS).toBe(false);
    expect(coerceSettings({ showAirportsOnRadar: 0 }).showAirportsOnRadar).toBe(true); // default
  });
});

describe('loadSettings', () => {
  it('survives malformed JSON', () => {
    installStorage({ [SETTINGS_KEY]: '{{{' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives a bare null literal', () => {
    installStorage({ [SETTINGS_KEY]: 'null' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives an unrelated object', () => {
    installStorage({ [SETTINGS_KEY]: '{"a":1}' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when storage itself throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError: storage disabled');
      }
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('loadHistory', () => {
  const validEvent: OverheadEvent = {
    hex: 'a1b2c3',
    flight: 'ACA123',
    type: 'A320',
    desc: 'Airbus A320',
    registration: 'C-FABC',
    timestamp: 1_700_000_000_000,
    minDistanceKm: 0.8,
    altitudeFt: 2400,
    trajectory: 'landing',
    noiseLevel: 'high'
  };

  it('reads a valid log back unchanged', () => {
    installStorage({ [HISTORY_KEY]: JSON.stringify([validEvent]) });
    expect(loadHistory()).toEqual([validEvent]);
  });

  // This is the regression that white-screened the app: JSON.parse ran inside a
  // useState initializer with no try/catch, so a corrupt value threw during the
  // first render on every subsequent load. Because the service worker serves a
  // cached shell, reloading re-read the same bad value and failed identically.
  it('survives malformed JSON instead of throwing', () => {
    installStorage({ [HISTORY_KEY]: '{{{' });
    expect(() => loadHistory()).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });

  it('survives exactly the input that broke the previous initializer', () => {
    // A log truncated mid-write, e.g. by a quota failure.
    const truncated = '[{"hex":"a1b2c3","timestamp":170000000';
    installStorage({ [HISTORY_KEY]: truncated });

    // The old implementation, verbatim: `return saved ? JSON.parse(saved) : []`
    expect(() => (truncated ? JSON.parse(truncated) : [])).toThrow(SyntaxError);

    // The replacement, on the same value.
    expect(loadHistory()).toEqual([]);
  });

  it('survives truncated JSON', () => {
    installStorage({ [HISTORY_KEY]: JSON.stringify([validEvent]).slice(0, 40) });
    expect(loadHistory()).toEqual([]);
  });

  it('survives valid JSON that is not an array', () => {
    for (const payload of ['null', '5', '{"a":1}', '"a string"', 'true']) {
      installStorage({ [HISTORY_KEY]: payload });
      expect(loadHistory()).toEqual([]);
    }
  });

  it('drops entries missing required fields rather than repairing them', () => {
    installStorage({ [HISTORY_KEY]: JSON.stringify([{ bad: true }, validEvent, null, 7]) });
    expect(loadHistory()).toEqual([validEvent]);
  });

  it('fills in missing descriptive fields on an otherwise valid entry', () => {
    const sparse = {
      hex: 'ffffff',
      timestamp: 1,
      minDistanceKm: 1,
      altitudeFt: 1
    };
    installStorage({ [HISTORY_KEY]: JSON.stringify([sparse]) });
    const [event] = loadHistory();
    expect(event.flight).toBe('N/A');
    expect(event.trajectory).toBe('unknown');
    expect(event.noiseLevel).toBe('low');
  });

  it('caps an oversized stored log on read, not just on write', () => {
    const oversized = Array.from({ length: HISTORY_LIMIT + 50 }, (_, i) => ({
      ...validEvent,
      hex: `hex${i}`
    }));
    installStorage({ [HISTORY_KEY]: JSON.stringify(oversized) });
    expect(loadHistory()).toHaveLength(HISTORY_LIMIT);
  });
});

describe('coerceHistory', () => {
  it('rejects non-arrays without throwing', () => {
    expect(coerceHistory(undefined)).toEqual([]);
    expect(coerceHistory({ length: 3 })).toEqual([]);
  });
});

describe('write path', () => {
  it('reports failure instead of throwing when the quota is exceeded', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      }
    });
    // An unhandled throw here escapes the useEffect and takes down the render.
    expect(() => saveHistory([])).not.toThrow();
    expect(saveHistory([])).toBe(false);
  });

  it('reports success on a normal write', () => {
    expect(saveHistory([])).toBe(true);
  });
});

describe('poll interval migration', () => {
  it('exposes the option set the UI renders', () => {
    expect(POLL_INTERVAL_OPTIONS).toEqual([20, 45, 60, 90]);
    // The default must itself be selectable, or no button appears active.
    expect(POLL_INTERVAL_OPTIONS).toContain(DEFAULT_SETTINGS.pollIntervalSeconds);
  });

  it('accepts every current option', () => {
    for (const sec of POLL_INTERVAL_OPTIONS) {
      expect(coerceSettings({ pollIntervalSeconds: sec }).pollIntervalSeconds).toBe(sec);
    }
  });

  /**
   * The point of validating by membership rather than range: existing installs
   * hold 5 or 10 from the old, faster option set. A range check of 1..300 would
   * have preserved those, so an upgraded client would have kept polling three to
   * four times faster than the new minimum allows.
   */
  it('migrates the retired faster intervals up to the default', () => {
    for (const legacy of [5, 10]) {
      expect(coerceSettings({ pollIntervalSeconds: legacy }).pollIntervalSeconds).toBe(
        DEFAULT_SETTINGS.pollIntervalSeconds
      );
    }
  });

  it('rejects a value that is in range but not an option', () => {
    // 30 was valid under the old set and is inside any plausible numeric range,
    // but there is no button for it now.
    expect(coerceSettings({ pollIntervalSeconds: 30 }).pollIntervalSeconds).toBe(
      DEFAULT_SETTINGS.pollIntervalSeconds
    );
  });

  it('rejects non-numeric and out-of-set values', () => {
    for (const bad of ['20', null, undefined, NaN, 0, -20, 1000]) {
      expect(coerceSettings({ pollIntervalSeconds: bad }).pollIntervalSeconds).toBe(
        DEFAULT_SETTINGS.pollIntervalSeconds
      );
    }
  });
});

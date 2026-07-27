import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { RawAircraft, AircraftUpdate, UserSettings, OverheadEvent } from './types';
import { getDistanceKm, getBearing, calculateCPA, angularDeltaDeg } from './utils/geo';
import { determineTrajectory, classifyNoise } from './utils/noise';
import { lookupAirport, NORTH_AMERICAN_AIRPORTS } from './utils/airports';
import {
  DEFAULT_SETTINGS,
  eraseAllStoredData,
  POLL_INTERVAL_OPTIONS,
  isValidCoordinate,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings
} from './utils/storage';
import { useRegisterSW } from 'virtual:pwa-register/react';

declare const __COMMIT_SHA__: string;

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

// Inline SVGs for lightweight, zero-dependency rendering
const Icons = {
  Radar: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m19.07 4.93-1.41 1.41M12 12V2M12 12l5 5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  History: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  ),
  Settings: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Plane: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17.8 20.19 19.8 22h1.5l-1.63-4.83 2.15-2.15a2 2 0 0 0-2.83-2.83l-2.15 2.15L12 12.72V5.5a3 3 0 0 0-6 0v1.27L1.8 11.6l-1.6 1.6h1.5l1.9-1.9 4.3 1.9L2 19.34c-.4.4-.3 1 .1 1.4s1 .5 1.4.1l4.14-5.9 4.3 1.9z" />
    </svg>
  ),
  GPS: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M12 9v3h3" />
    </svg>
  ),
  Volume2: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  VolumeX: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  ),
  Trash: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Shield: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Clock: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Check: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#34d399' }}
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  XCircle: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#f43f5e' }}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  Pin: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Signal: (props: IconProps & { level?: number }) => {
    const { level = 0, ...rest } = props;
    const colorActive = rest.style?.color || 'currentColor';
    const colorInactive = 'rgba(255, 255, 255, 0.15)';
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="none"
        {...rest}
      >
        <rect
          x="3"
          y="17"
          width="3"
          height="4"
          rx="1"
          fill={level >= 1 ? colorActive : colorInactive}
        />
        <rect
          x="8"
          y="13"
          width="3"
          height="8"
          rx="1"
          fill={level >= 2 ? colorActive : colorInactive}
        />
        <rect
          x="13"
          y="9"
          width="3"
          height="12"
          rx="1"
          fill={level >= 3 ? colorActive : colorInactive}
        />
        <rect
          x="18"
          y="5"
          width="3"
          height="16"
          rx="1"
          fill={level >= 4 ? colorActive : colorInactive}
        />
      </svg>
    );
  },
  Tower: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" y1="21" x2="20" y2="21" />
      <line x1="10" y1="21" x2="10" y2="3" />
      <line x1="14" y1="21" x2="14" y2="3" />
      <line x1="10" y1="3" x2="14" y2="3" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
    </svg>
  )
};

/**
 * Minimum compass movement, in degrees, that justifies a re-render.
 *
 * `deviceorientation` fires up to ~60x/sec. Every update re-renders the whole
 * app: all aircraft polar maths, every airport haversine, and every derived
 * list. Below roughly a degree the radar does not visibly move, so the work is
 * pure waste — and it lands while `transition: transform 0.1s` is mid-flight on
 * dozens of elements, so it also fights the animation it is driving.
 */
const HEADING_EPSILON_DEG = 1;

/**

 * Upper bound on the exponential backoff delay.

 *

 * Must stay above the slowest selectable interval. When the options topped out

 * at 60s and this cap was also 60s, Math.min(cap, base * 2) could return a

 * value BELOW the base interval — so a 429 would have made polling *faster*,

 * which is the opposite of backing off. The cap is now derived per call from

 * whichever is larger.

 */

const MAX_POLL_BACKOFF_MS = 300_000;

/** Backoff ceiling that can never undercut the user's chosen interval. */

function backoffCeilingMs(baseSeconds: number): number {
  return Math.max(MAX_POLL_BACKOFF_MS, baseSeconds * 1000);
}

/**
 * How often the staleness clock advances.
 *
 * The stale check used to be an inline `Date.now()` in the middle of render, with
 * nothing driving it. It was therefore re-evaluated only when some *unrelated*
 * state change happened to cause a render — so if polling died quietly, the radar
 * kept showing minutes-old aircraft with no warning at all. This tick is what
 * makes "Signal Stale" appear on its own.
 */
const STALE_TICK_MS = 5_000;

/** Floor for the staleness threshold, regardless of poll interval. */
const STALE_FLOOR_MS = 30_000;

/** How often to ask the browser whether a new service worker has shipped. */
const SW_UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Maximum aircraft drawn on the radar at once.
 *
 * Each one is ~6-7 DOM nodes, and the API result is filtered only by altitude,
 * never by count — near a busy airport at a 40 km radius this is plausibly
 * 100+ aircraft, i.e. 700+ nodes rebuilt on every render. This is a guard
 * against that, not a tuned figure: it is set well above what a typical location
 * sees, so most users never hit it.
 *
 * Only *rendering* is capped. `processPasses` receives the full fetched list, so
 * the overhead log never loses a pass to this.
 */
const MAX_RADAR_AIRCRAFT = 60;

/**
 * Distinguishes an HTTP 429 from a transport failure.
 *
 * The 429 branch already applies its own (larger) backoff before throwing, so
 * the generic catch must not stack a second multiplier on top of it.
 */
class RateLimitError extends Error {}

/**
 * Feature-detect the iOS 13+ orientation permission gate.
 *
 * Narrows through `unknown` rather than casting the window through `any`, so a
 * typo in `requestPermission` is still a compile error. Returns null on every
 * platform that exposes the sensor without asking.
 */
function getOrientationPermissionAPI(): DeviceOrientationPermissionAPI | null {
  const ctor: unknown = window.DeviceOrientationEvent;
  if (typeof ctor !== 'function') return null;
  const candidate = ctor as { requestPermission?: unknown };
  return typeof candidate.requestPermission === 'function'
    ? (candidate as DeviceOrientationPermissionAPI)
    : null;
}

// Internal interface for tracking active passes over the house
/**
 * Spoken form of the noise level.
 *
 * The radar previously encoded this in colour only, with the same glyph for
 * every aircraft — so it did not survive red/green colour deficiency, and the
 * tooltip did not mention it either.
 */
const NOISE_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: 'high noise',
  medium: 'medium noise',
  low: 'low noise'
};

type TabId = 'live' | 'history' | 'settings';

const TAB_IDS = ['live', 'history', 'settings'] as const;

/**
 * Read the active tab from the URL hash.
 *
 * Validated against the known set rather than trusted: the hash is user-editable
 * input, and an unrecognised value must land somewhere sensible instead of
 * rendering no panel at all.
 */
function tabFromHash(hash: string): TabId {
  const candidate = hash.replace(/^#/, '');
  return (TAB_IDS as readonly string[]).includes(candidate) ? (candidate as TabId) : 'live';
}

/** Single source of truth for the tablist, so ids and order cannot drift. */
const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
}> = [
  { id: 'live', label: 'Live Tracker', Icon: Icons.Radar },
  { id: 'history', label: 'Who Was That?', Icon: Icons.History },
  { id: 'settings', label: 'Settings', Icon: Icons.Settings }
];

interface ActivePass {
  hex: string;
  flight: string;
  type: string;
  desc: string;
  registration: string;
  minDistanceKm: number;
  minAltitudeFt: number;
  trajectory: 'landing' | 'departing' | 'transit' | 'unknown';
  noiseLevel: 'high' | 'medium' | 'low';
  lastSeen: number; // timestamp
}

export default function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    /**
     * Poll for a new build.
     *
     * `registerType: 'prompt'` plus the update banner is the right design, but the
     * browser only re-checks the service worker on navigation. An installed PWA
     * left open — which is exactly how this app is used, sitting on the radar for
     * hours — would never learn a new version had shipped.
     *
     * Checks hourly, and again whenever the tab becomes visible, since returning
     * to a backgrounded app is the moment an update is least disruptive.
     */
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const check = () => {
        // Pointless while offline, and `update()` rejects rather than resolving.
        if (navigator.onLine === false) return;
        void registration.update().catch(() => {
          // A failed check is not worth surfacing; the next one will retry.
        });
      };

      const intervalId = window.setInterval(check, SW_UPDATE_CHECK_MS);
      const onVisible = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisible);

      // useRegisterSW has no teardown hook, and this lives for the document's
      // lifetime by design; released on unload.
      window.addEventListener('unload', () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', onVisible);
      });
    }
  });

  /**
   * Active tab, mirrored into the URL hash.
   *
   * The hash rather than a path: it needs no router dependency and is immune to
   * the `/SkyNoise/` base, whereas pushState paths on GitHub Pages 404 on reload
   * without a redirect shim.
   *
   * Previously plain state, so Settings and History could not be linked or
   * bookmarked, tab choice was lost on reload (unlike settings and history, which
   * *are* persisted — an inconsistency users notice), and in an installed PWA the
   * Back button exited the app instead of leaving the current tab.
   */
  const [activeTab, setActiveTabState] = useState<TabId>(() =>
    tabFromHash(typeof window === 'undefined' ? '' : window.location.hash)
  );

  /** Change tab and push a history entry, so Back returns to the previous tab. */
  const setActiveTab = useCallback((next: TabId) => {
    setActiveTabState(next);
    if (typeof window === 'undefined') return;
    if (tabFromHash(window.location.hash) === next) return;
    // pushState rather than assigning location.hash: assignment fires
    // hashchange, which would set state a second time.
    window.history.pushState(null, '', `#${next}`);
  }, []);

  // Back/Forward, and an externally changed hash (a shared link, or a PWA
  // shortcut opening an already-running app).
  useEffect(() => {
    const onHashChange = () => setActiveTabState(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  // Normalise the initial URL so the first tab change does not leave a
  // hash-less entry that Back would return to.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '') {
      window.history.replaceState(null, '', '#live');
    }
  }, []);

  // Roving-tabindex support: arrow keys move focus between tabs, so the focused
  // tab has to be imperatively focusable.
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // Two-step confirmation for the destructive log wipe.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingErase, setConfirmingErase] = useState(false);

  /**
   * Message for the aria-live region.
   *
   * Replaces alert(): a native dialog blocks the event loop, cannot be styled,
   * and is suppressed outright in some installed-PWA contexts — so the user
   * could be told nothing at all.
   */
  const [liveMessage, setLiveMessage] = useState('');
  const announce = useCallback((message: string) => setLiveMessage(message), []);

  /**
   * Erase every key the app owns and return to first-run state.
   *
   * PRIVACY.md claims a right to erasure, and the in-app card claimed it was
   * "automated by clicking Clear Log". It was not: Clear Log only emptied the
   * history, so skynoise_settings -- which holds homeLat/homeLon -- survived.
   * The stored location outlived the erasure that claimed to remove it.
   */
  const eraseAllData = useCallback(() => {
    eraseAllStoredData();
    setSettings({ ...DEFAULT_SETTINGS });
    setHistory([]);
    setAircraft([]);
    activePassesRef.current = {};
    setTempLat('');
    setTempLon('');
    setTempAirport('');
    setAirportResolutionMsg('');
    setFetchError(null);
    setConfirmingErase(false);
    announce('All local data erased. Settings and history reset.');
  }, [announce]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const index = TABS.findIndex(t => t.id === activeTab);

    let nextIndex: number | null = null;
    if (e.key in deltas) {
      // Wrap around, which is what the tab pattern specifies.
      nextIndex = (index + deltas[e.key] + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = TABS.length - 1;
    }
    if (nextIndex === null) return;

    e.preventDefault();
    const nextId = TABS[nextIndex].id;
    setActiveTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  // Settings State. Validated field-by-field against DEFAULT_SETTINGS, which
  // also performs the migration for properties added since the value was saved.
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  // Aircraft & History State
  const [aircraft, setAircraft] = useState<AircraftUpdate[]>([]);
  const [history, setHistory] = useState<OverheadEvent[]>(loadHistory);

  // App system states
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<string>('unknown');
  // Display-only mirror of the effective poll interval (drives the backoff
  // notice and the staleness threshold). The scheduler reads pollIntervalRef,
  // not this: see the tracking effect for why.
  const [currentPollIntervalMs, setCurrentPollIntervalMs] = useState<number>(
    () => (settings.pollIntervalSeconds || 10) * 1000
  );
  const pollIntervalRef = useRef<number>((settings.pollIntervalSeconds || 10) * 1000);

  /**
   * Set the effective poll delay.
   *
   * The ref is what the scheduler reads, so a backoff takes effect on the next
   * tick without re-running the tracking effect. Previously the delay was an
   * effect dependency, so a 429 tore the timer down and rebuilt it — which also
   * re-fired the immediate mount fetch, sending an *extra* request to the API
   * that had just rate-limited us.
   */
  const applyPollInterval = useCallback((next: number | ((prev: number) => number)) => {
    // The ref must be written synchronously. Writing it inside a state updater
    // instead lets React defer it, so the scheduler can read a stale delay and
    // the backoff silently fails to apply to the very next tick.
    const value = typeof next === 'function' ? next(pollIntervalRef.current) : next;
    pollIntervalRef.current = value;
    setCurrentPollIntervalMs(value);
  }, []);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Reset GPS accuracy when manual control is used
  useEffect(() => {
    if (!settings.useGPS) {
      setGpsAccuracy(null);
    }
  }, [settings.useGPS]);

  // Keep a mutable ref of the settings to avoid recreating interval timers when locations/parameters change
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const hasCoordinates = settings.homeLat !== null && settings.homeLon !== null;

  /**
   * Clock for the staleness check.
   *
   * Only runs while tracking, so an unconfigured or idle app does not re-render
   * on a timer for no reason.
   */
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasCoordinates) return;
    const id = window.setInterval(() => setClockNow(Date.now()), STALE_TICK_MS);
    return () => clearInterval(id);
  }, [hasCoordinates]);

  /**
   * Whether the radar is showing data we no longer trust.
   *
   * This expression previously appeared inline, verbatim, in two places — and
   * because `Date.now()` was read during render with no timer behind it, the flag
   * only updated when something else caused a re-render. A silent polling failure
   * therefore left a confident-looking radar full of minutes-old aircraft.
   */
  const isStale = useMemo(() => {
    if (!hasCoordinates) return false;
    if (fetchError !== null) return true;
    if (lastFetchTime === null) return false;
    const threshold = Math.max(STALE_FLOOR_MS, currentPollIntervalMs * 2.5);
    return clockNow - lastFetchTime.getTime() > threshold;
  }, [hasCoordinates, fetchError, lastFetchTime, clockNow, currentPollIntervalMs]);

  /**
   * Connectivity. The service worker serves the app shell offline, so the page
   * loads fine with no network — but the radar silently stops updating, which
   * looks identical to "no aircraft nearby" without this.
   */
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // Synchronize dynamic polling rate when settings frequency changes.
  // Also clears any active backoff, which is what the user expects from
  // deliberately picking a new rate.
  useEffect(() => {
    applyPollInterval(settings.pollIntervalSeconds * 1000);
  }, [settings.pollIntervalSeconds, applyPollInterval]);

  // Track phone compass/heading if radar orientation is heading-up
  useEffect(() => {
    if (settings.radarOrientation !== 'heading-up') {
      setDeviceHeading(null);
      return;
    }

    // Coalesce the sensor stream to at most one state update per frame, and
    // only when the needle has actually moved. Without this the raw ~60Hz event
    // rate drives ~60 full-tree re-renders per second.
    let frameId: number | null = null;
    let pendingHeading: number | null = null;
    let appliedHeading: number | null = null;

    const flush = () => {
      frameId = null;
      const next = pendingHeading;
      if (next === null) return;
      if (appliedHeading !== null && angularDeltaDeg(next, appliedHeading) < HEADING_EPSILON_DEG) {
        return;
      }
      appliedHeading = next;
      setDeviceHeading(next);
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Sensor input, so validate rather than trust: a non-finite heading would
      // propagate into `rotate(${-deviceHeading}deg)` and produce an invalid
      // transform on the radar and every counter-rotated label.
      const webkitHeading = e.webkitCompassHeading;
      if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
        pendingHeading = webkitHeading;
      } else if (e.alpha !== null && Number.isFinite(e.alpha)) {
        // Android/Chrome fallback (alpha increases CCW, we convert to degrees CW)
        pendingHeading = (360 - e.alpha) % 360;
      } else {
        return;
      }
      // Keep the newest reading; one frame gets one update.
      if (frameId === null) frameId = requestAnimationFrame(flush);
    };

    const setupOrientation = async () => {
      const permissionApi = getOrientationPermissionAPI();
      if (permissionApi) {
        try {
          const permission = await permissionApi.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setSettings(prev => ({ ...prev, radarOrientation: 'north-up' }));
          }
        } catch (err) {
          console.warn('Compass permission request failed:', err);
          setSettings(prev => ({ ...prev, radarOrientation: 'north-up' }));
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    setupOrientation();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      // Drop any frame still queued, or it fires after unmount / after the user
      // has already switched back to north-up.
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [settings.radarOrientation]);

  // Local state for Settings form
  const [tempLat, setTempLat] = useState<string>('');
  const [tempLon, setTempLon] = useState<string>('');
  const [tempAirport, setTempAirport] = useState<string>('');
  const [airportResolutionMsg, setAirportResolutionMsg] = useState<string>('');

  // Ref to track passes to prevent multiple logs for a single flight overhead
  const activePassesRef = useRef<{ [hex: string]: ActivePass }>({});

  // Sync settings to localStorage
  useEffect(() => {
    saveSettings(settings);
    if (settings.homeLat !== null && settings.homeLon !== null) {
      setTempLat(settings.homeLat.toString());
      setTempLon(settings.homeLon.toString());
    }
    if (settings.airportCode) {
      setTempAirport(settings.airportCode);
    }
  }, [settings]);

  // Sync history to localStorage
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Monitor Geolocation permissions if browser supports API query
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(result => {
          setGpsPermissionState(result.state);
          result.onchange = () => {
            setGpsPermissionState(result.state);
          };
        })
        .catch(() => {
          setGpsPermissionState('prompt');
        });
    } else {
      setGpsPermissionState('not-supported');
    }
  }, []);

  // Update Location using GPS if enabled
  useEffect(() => {
    if (!settings.useGPS) return;

    let watchId: number;

    const onSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setSettings(prev => ({
        ...prev,
        homeLat: parseFloat(latitude.toFixed(6)),
        homeLon: parseFloat(longitude.toFixed(6))
      }));
      setGpsAccuracy(position.coords.accuracy);
      setGpsPermissionState('granted');
      setFetchError(null);
    };

    const onError = (error: GeolocationPositionError) => {
      console.warn('GPS position error:', error.message);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsPermissionState('denied');
        setSettings(prev => ({ ...prev, useGPS: false }));
        setFetchError(
          'GPS Permission Denied. Please input coordinates manually or use an Airport Code fallback.'
        );
      } else {
        setFetchError(`GPS error: ${error.message}`);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(onSuccess, onError);
      // Continuous updates
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } else {
      setGpsPermissionState('not-supported');
      setSettings(prev => ({ ...prev, useGPS: false }));
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [settings.useGPS]);

  /**
   * Aircraft tracking loop.
   *
   * Depends on `hasCoordinates` alone. Two things make that safe:
   *   - live config is read through `settingsRef`, so changing radius, altitude
   *     or orientation does not tear down the timer
   *   - the poll delay is read from `pollIntervalRef` at schedule time, so a
   *     backoff changes the *next* delay without restarting anything
   *
   * That second point is the fix. The delay used to be a dependency, so every
   * 429 (x2), network error (x1.5) and successful reset re-ran this effect —
   * clearing the interval, rebuilding it, and re-firing the immediate mount
   * fetch. A rate-limit response therefore provoked an extra out-of-band request
   * against the very API that had just asked us to slow down.
   *
   * A self-scheduling timeout rather than setInterval: it also guarantees the
   * gap is measured from when a response lands, so a slow response can never
   * queue overlapping requests.
   */
  useEffect(() => {
    if (!hasCoordinates) {
      setAircraft([]);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let isFetching = false;

    const fetchAircraftData = async () => {
      if (isFetching) return;
      const snapSettings = settingsRef.current;
      // Guard the pair before it reaches the request path. Without this, a
      // non-numeric stored coordinate builds a garbage URL and the interval
      // hammers an API that is already rate-limiting us.
      if (!isValidCoordinate(snapSettings.homeLat, snapSettings.homeLon)) {
        setFetchError(
          'Stored coordinates are invalid. Please set your location again in Settings.'
        );
        return;
      }
      isFetching = true;
      setIsPolling(true);

      const lat = snapSettings.homeLat as number;
      const lon = snapSettings.homeLon as number;
      // Radius in Nautical Miles (API expects NM). 1 km = 0.539957 NM.
      const radiusNm = Math.max(1, Math.ceil(snapSettings.detectionRadiusKm * 0.539957));

      try {
        const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${radiusNm}`;
        const response = await fetch(url);

        if (response.status === 429) {
          const ceiling = backoffCeilingMs(snapSettings.pollIntervalSeconds);
          applyPollInterval(prev => Math.min(ceiling, prev * 2));
          throw new RateLimitError(
            'Rate limited by API server. Automatically backing off polling frequency.'
          );
        }

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawList: RawAircraft[] = data.ac || [];
        setLastFetchTime(new Date());
        setFetchError(null);
        // Reset backoff on successful fetch
        applyPollInterval(snapSettings.pollIntervalSeconds * 1000);

        // Process aircraft updates
        const updatedList: AircraftUpdate[] = rawList
          .map(ac => {
            const acLat = ac.lat || 0;
            const acLon = ac.lon || 0;
            const distanceKm = getDistanceKm(acLat, acLon, lat, lon);
            const bearingDeg = getBearing(acLat, acLon, lat, lon);
            const altFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;

            const cpa = calculateCPA(acLat, acLon, ac.track || 0, ac.gs || 0, lat, lon);

            const trajectory = determineTrajectory(ac);
            const noise = classifyNoise(ac);

            return {
              ...ac,
              id: ac.hex,
              cleanFlight: (ac.flight || '').trim(),
              distanceKm: parseFloat(distanceKm.toFixed(2)),
              altitudeFt: altFt,
              bearingDeg: Math.round(bearingDeg),
              isHeadingTowards: cpa.isHeadingTowards,
              crossTrackDistanceKm: parseFloat(cpa.crossTrackDistanceKm.toFixed(2)),
              cpaTimeSeconds: cpa.cpaTimeSeconds ? Math.round(cpa.cpaTimeSeconds) : null,
              trajectory,
              noiseLevel: noise.level
            } as AircraftUpdate;
          })
          // Filter to only include flights below maxAltitudeFt
          .filter(
            ac =>
              ac.altitudeFt <= snapSettings.maxAltitudeFt &&
              ac.lat !== undefined &&
              ac.lon !== undefined
          );

        setAircraft(updatedList);
        processPasses(updatedList);
      } catch (err) {
        console.error('Fetch error:', err);
        // `catch` is `unknown` under strict; narrow rather than assume .message
        // exists. A thrown non-Error would otherwise render "undefined" to the user.
        const message = err instanceof Error ? err.message : String(err);
        setFetchError(`Network error fetching radar data: ${message}`);
        // Back off on transport failures only. A 429 already applied its own
        // larger multiplier before throwing; stacking this on top made a single
        // rate-limit response jump 10s -> 20s -> 30s.
        if (!(err instanceof RateLimitError)) {
          const ceiling = backoffCeilingMs(snapSettings.pollIntervalSeconds);
          applyPollInterval(prev => Math.min(ceiling, prev * 1.5));
        }
      } finally {
        isFetching = false;
        setIsPolling(false);
      }
    };

    // Helper to evaluate and save overhead passes
    const processPasses = (currentAircraft: AircraftUpdate[]) => {
      const snapSettings = settingsRef.current;
      const now = Date.now();
      const currentHexes = new Set(currentAircraft.map(ac => ac.hex));

      // Update active passes and log new entry if an aircraft goes inside overhead radius
      currentAircraft.forEach(ac => {
        if (ac.distanceKm <= snapSettings.overheadRadiusKm) {
          const existing = activePassesRef.current[ac.hex];

          if (!existing) {
            // New pass starts!
            activePassesRef.current[ac.hex] = {
              hex: ac.hex,
              flight: ac.cleanFlight || 'N/A',
              type: ac.t || 'UNKN',
              desc: ac.desc || 'Unknown Aircraft',
              registration: ac.r || 'N/A',
              minDistanceKm: ac.distanceKm,
              minAltitudeFt: ac.altitudeFt,
              trajectory: ac.trajectory,
              noiseLevel: ac.noiseLevel,
              lastSeen: now
            };
          } else {
            // Update existing pass properties with minimum distance seen
            activePassesRef.current[ac.hex] = {
              ...existing,
              minDistanceKm: Math.min(existing.minDistanceKm, ac.distanceKm),
              minAltitudeFt: Math.min(existing.minAltitudeFt, ac.altitudeFt),
              lastSeen: now
            };
          }
        }
      });

      // Find passes that have finished (either moved away or disappeared from radar)
      Object.keys(activePassesRef.current).forEach(hex => {
        const pass = activePassesRef.current[hex];
        const currentMatch = currentAircraft.find(ac => ac.hex === hex);
        const isOutsideNow =
          currentMatch && currentMatch.distanceKm > snapSettings.overheadRadiusKm;
        const hasDisappeared = !currentHexes.has(hex) && now - pass.lastSeen > 35000; // 35 seconds buffer

        if (isOutsideNow || hasDisappeared) {
          // Finalize overhead event and save to persistent History state
          const newEvent: OverheadEvent = {
            hex: pass.hex,
            flight: pass.flight,
            type: pass.type,
            desc: pass.desc,
            registration: pass.registration,
            timestamp: Date.now(),
            minDistanceKm: parseFloat(pass.minDistanceKm.toFixed(2)),
            altitudeFt: Math.round(pass.minAltitudeFt),
            trajectory: pass.trajectory,
            noiseLevel: pass.noiseLevel
          };

          setHistory(prev => {
            // Prevent duplicate adjacent logs for same hex within 5 mins
            const duplicate = prev.find(
              h => h.hex === newEvent.hex && newEvent.timestamp - h.timestamp < 300000
            );
            if (duplicate) return prev;
            return [newEvent, ...prev].slice(0, 100); // Cap at 100 history elements
          });

          // Delete from active passes
          delete activePassesRef.current[hex];
        }
      });
    };

    // Re-read the delay from the ref at schedule time, so the current backoff
    // applies without this effect ever re-running.
    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(tick, pollIntervalRef.current);
    };

    const tick = async () => {
      await fetchAircraftData();
      scheduleNext();
    };

    // Immediate first fetch. Now reached only on mount or when coordinates are
    // first acquired — no longer on every backoff change.
    void tick();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
    // applyPollInterval is useCallback([]) — stable identity, so listing it
    // satisfies the linter without widening what can restart the loop.
  }, [hasCoordinates, applyPollInterval]);

  // Clean active passes on component unmount
  useEffect(() => {
    return () => {
      activePassesRef.current = {};
    };
  }, []);

  // Request GPS permission manually
  const requestGPS = () => {
    if ('geolocation' in navigator) {
      setSettings(prev => ({ ...prev, useGPS: true }));
      navigator.geolocation.getCurrentPosition(
        pos => {
          setSettings(prev => ({
            ...prev,
            homeLat: parseFloat(pos.coords.latitude.toFixed(6)),
            homeLon: parseFloat(pos.coords.longitude.toFixed(6)),
            useGPS: true
          }));
          setGpsPermissionState('granted');
          setFetchError(null);
        },
        err => {
          console.error(err);
          setGpsPermissionState('denied');
          setSettings(prev => ({ ...prev, useGPS: false }));
          setFetchError(
            'GPS Request Refused. Enable location permission in your browser settings.'
          );
        }
      );
    }
  };

  // Form submission handler
  const saveManualLocation = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(tempLat);
    const lon = parseFloat(tempLon);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setSettings(prev => ({
        ...prev,
        homeLat: lat,
        homeLon: lon,
        useGPS: false
      }));
      setFetchError(null);
    } else {
      setFetchError('Invalid coordinates entered. Please input valid decimal numbers.');
    }
  };

  // Airport resolution handler
  const handleAirportLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = lookupAirport(tempAirport);
    if (resolved) {
      setSettings(prev => ({
        ...prev,
        homeLat: resolved.lat,
        homeLon: resolved.lon,
        airportLat: resolved.lat,
        airportLon: resolved.lon,
        airportCode: resolved.code,
        useGPS: false
      }));
      setTempLat(resolved.lat.toString());
      setTempLon(resolved.lon.toString());
      setAirportResolutionMsg(`Found: ${resolved.name} (${resolved.code})`);
      setFetchError(null);
    } else {
      setAirportResolutionMsg('Airport code not found in offline database.');
    }
  };

  // Trajectory direction display helper
  const renderTrajectoryLabel = (tr: string) => {
    switch (tr) {
      case 'landing':
        return <span style={{ color: '#38bdf8', fontWeight: 600 }}>Landing ↘</span>;
      case 'departing':
        return <span style={{ color: '#fbbf24', fontWeight: 600 }}>Departing ↗</span>;
      case 'transit':
        return <span style={{ color: '#94a3b8' }}>Overflight →</span>;
      default:
        return <span style={{ color: '#94a3b8' }}>Unknown</span>;
    }
  };

  // Compass bearing text resolver
  const getCompassDirection = (bearing: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(bearing / 45) % 8];
  };

  /**
   * Derived aircraft lists.
   *
   * Each of these was computed inline in JSX, and each was computed *twice* — once
   * to test `.length === 0` for the empty state and again to map. The incoming
   * list also re-sorted in full every render. One memo replaces four passes.
   */
  const { overhead, incoming, loudestFlight, radarAircraft, hiddenRadarCount } = useMemo(() => {
    const overhead = aircraft.filter(ac => ac.distanceKm <= settings.overheadRadiusKm);

    const incoming = aircraft
      .filter(ac => ac.isHeadingTowards && ac.distanceKm > settings.overheadRadiusKm)
      // Soonest arrival first.
      .sort((a, b) => (a.cpaTimeSeconds ?? 9999) - (b.cpaTimeSeconds ?? 9999));

    // Copy before sorting: `overhead` is rendered in feed order, and sorting in
    // place would silently reorder that list too.
    const noiseScore = { high: 3, medium: 2, low: 1 } as const;
    const loudestFlight = [...overhead].sort((a, b) => {
      const scoreDiff = noiseScore[b.noiseLevel] - noiseScore[a.noiseLevel];
      return scoreDiff !== 0 ? scoreDiff : a.altitudeFt - b.altitudeFt;
    })[0];

    // Nearest first, so a cap drops the least relevant contacts.
    const byDistance = [...aircraft].sort((a, b) => a.distanceKm - b.distanceKm);
    const radarAircraft = byDistance.slice(0, MAX_RADAR_AIRCRAFT);

    return {
      overhead,
      incoming,
      loudestFlight,
      radarAircraft,
      hiddenRadarCount: aircraft.length - radarAircraft.length
    };
  }, [aircraft, settings.overheadRadiusKm]);

  /**
   * Airports within the detection radius, with their polar coordinates.
   *
   * Previously recomputed a haversine and a bearing for all 16 entries on every
   * render — including the ~60/sec compass renders — then discarded most of them
   * via `return null` in the middle of the JSX.
   */
  const visibleAirports = useMemo(() => {
    const { homeLat, homeLon, detectionRadiusKm, showAirportsOnRadar } = settings;
    if (!showAirportsOnRadar || homeLat === null || homeLon === null) return [];
    return NORTH_AMERICAN_AIRPORTS.map(ap => ({
      ap,
      dist: getDistanceKm(homeLat, homeLon, ap.lat, ap.lon),
      bearing: getBearing(homeLat, homeLon, ap.lat, ap.lon)
    })).filter(entry => entry.dist <= detectionRadiusKm);
  }, [
    settings.homeLat,
    settings.homeLon,
    settings.detectionRadiusKm,
    settings.showAirportsOnRadar
  ]);

  return (
    <div>
      {/* PWA Update Banner */}
      {needRefresh && (
        <div className="pwa-update-banner">
          <div className="pwa-update-content">
            <span className="pwa-update-icon">⚡</span>
            <span>A new version of SkyNoise is available! Click reload to update.</span>
          </div>
          <div className="pwa-update-actions">
            <button className="btn btn-update" onClick={() => updateServiceWorker(true)}>
              Reload
            </button>
            <button className="btn btn-close" onClick={() => setNeedRefresh(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <header>
        <h1>SkyNoise</h1>
        <div className="subtitle">Privacy-First Overhead Flight Tracker</div>
      </header>

      {/*
        Status announcements. role=status is polite, so it never interrupts, and
        the region is always present in the DOM — a live region inserted at the
        same time as its text is frequently not announced at all.
      */}
      <div role="status" aria-live="polite" className="visually-hidden">
        {liveMessage}
      </div>

      {/* Tabs */}
      {/*
        A real tablist. Previously three unrelated <button>s, so a screen reader
        announced no relationship between them and no selected state — the active
        tab was conveyed by colour alone.
      */}
      <div className="tabs-container" role="tablist" aria-label="Views">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            // Roving tabindex: one stop for the whole group, then arrow keys
            // move between tabs. This is what the tab pattern expects.
            tabIndex={activeTab === id ? 0 : -1}
            ref={el => {
              tabRefs.current[id] = el;
            }}
            className={`tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
            onKeyDown={handleTabKeyDown}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                justifyContent: 'center'
              }}
            >
              <Icon aria-hidden="true" /> {label}
            </span>
          </button>
        ))}
      </div>

      {/* Status Bar */}
      <div
        className="status-row"
        style={{ fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.05em' }}
      >
        <span
          className={`status-indicator ${settings.homeLat !== null ? 'status-active' : 'status-offline'}`}
        ></span>
        {settings.homeLat !== null ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {!settings.useGPS ? (
              <>
                <Icons.Pin style={{ width: '13px', height: '13px', color: '#38bdf8' }} />
                <span>MANUAL</span>
              </>
            ) : (
              <>
                <Icons.Signal
                  level={
                    gpsAccuracy === null
                      ? 0
                      : gpsAccuracy < 10
                        ? 4
                        : gpsAccuracy < 30
                          ? 3
                          : gpsAccuracy < 100
                            ? 2
                            : 1
                  }
                  style={{ width: '13px', height: '13px', color: '#34d399', cursor: 'help' }}
                  title={`GPS Accuracy: ±${gpsAccuracy !== null ? Math.round(gpsAccuracy) : '?'}m`}
                />
                <span
                  title={`GPS Accuracy: ±${gpsAccuracy !== null ? Math.round(gpsAccuracy) : '?'}m`}
                  style={{ cursor: 'help' }}
                >
                  GPS{' '}
                </span>
              </>
            )}
            <span>•</span>
            {/* An offline app looks identical to "no aircraft nearby" without
                this: the service worker still serves the shell, so the radar
                simply stops updating. */}
            {!isOnline && (
              <>
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>OFFLINE</span>
                <span>•</span>
              </>
            )}
            {isPolling ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Icons.Clock style={{ width: '13px', height: '13px', opacity: 0.5 }} />
                <span>LOADING </span>
              </span>
            ) : lastFetchTime ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Icons.Clock style={{ width: '13px', height: '13px' }} />
                <span>
                  {(() => {
                    const hh = lastFetchTime.getHours().toString().padStart(2, '0');
                    const mm = lastFetchTime.getMinutes().toString().padStart(2, '0');
                    const ss = lastFetchTime.getSeconds().toString().padStart(2, '0');
                    return `${hh}:${mm}:${ss}`;
                  })()}
                </span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Icons.Clock style={{ width: '13px', height: '13px' }} />
                <span>PENDING </span>
              </span>
            )}
          </span>
        ) : (
          <span>Radar Offline</span>
        )}
      </div>

      {/* Errors */}
      {fetchError && (
        <div
          className="card"
          style={{ borderLeft: '4px solid #f43f5e', background: 'rgba(244,63,94,0.06)' }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Icons.XCircle />
            <div>
              <div style={{ fontWeight: 600, color: '#f43f5e', marginBottom: '0.2rem' }}>
                Location Error
              </div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{fetchError}</div>
              {gpsPermissionState === 'denied' && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => setActiveTab('settings')}
                >
                  Configure Fallback Coordinates
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Views */}
      <main>
        <div
          id="panel-live"
          role="tabpanel"
          aria-labelledby="tab-live"
          hidden={activeTab !== 'live'}
        >
          {activeTab === 'live' && (
            <div>
              {/* Welcome Screen / No coordinates configured */}
              {settings.homeLat === null && (
                <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                  <Icons.Radar />
                  <h2 style={{ marginTop: '1rem' }}>Welcome to SkyNoise</h2>
                  <p
                    style={{
                      color: '#94a3b8',
                      fontSize: '0.95rem',
                      margin: '0.75rem 0 1.5rem 0',
                      lineHeight: 1.5
                    }}
                  >
                    We need your location to calculate real-time flight noise overhead. Everything
                    is processed completely in your browser to respect Loi 25 & GDPR.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn" onClick={requestGPS}>
                      <Icons.GPS /> Use My GPS Location
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('settings')}>
                      Lookup Airport or Input Manually
                    </button>
                  </div>
                </div>
              )}

              {settings.homeLat !== null && (
                <>
                  {/* Loudest aircraft warning banner */}
                  {loudestFlight ? (
                    <div className="noise-alert-banner">
                      {/* Animation lives in CSS, not an inline style: an inline
                      animation cannot be switched off by prefers-reduced-motion. */}
                      <Icons.Volume2 className="status-offline alert-beacon" />
                      <div className="noise-alert-content">
                        <div className="noise-alert-title">Flight Overhead Now</div>
                        <div className="noise-alert-desc">
                          Flight <strong>{loudestFlight.cleanFlight || 'Unknown'}</strong> (
                          {loudestFlight.desc || 'Aircraft'}) is overhead at{' '}
                          {loudestFlight.altitudeFt.toLocaleString()} ft. Trajectory:{' '}
                          <strong>{loudestFlight.trajectory.toUpperCase()}</strong>.
                        </div>
                      </div>
                      <span className={`badge badge-${loudestFlight.noiseLevel}`}>
                        {loudestFlight.noiseLevel} Noise
                      </span>
                    </div>
                  ) : (
                    <div
                      className="card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem 1.5rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <Icons.VolumeX />
                      <div style={{ fontSize: '0.9rem', color: '#a7f3d0' }}>
                        No noisy aircraft currently overhead (below {settings.overheadRadiusKm} km).
                      </div>
                    </div>
                  )}

                  {/* Radar Sweep Widget */}
                  <div className="card" style={{ padding: '1rem' }}>
                    <div className="radar-wrapper">
                      <div
                        className={`radar-container ${isStale ? 'stale' : ''}`}
                        style={
                          settings.radarOrientation === 'heading-up' && deviceHeading !== null
                            ? {
                                transform: `rotate(${-deviceHeading}deg)`,
                                transition: 'transform 0.2s ease-out'
                              }
                            : {}
                        }
                      >
                        <div className="radar-sweep"></div>
                        <div className="radar-grid"></div>
                        <div className="radar-grid-v"></div>
                        {/* Range rings at 25/50/75% of the detection radius.
                        Percentages, not px, so they track a responsive radar. */}
                        <div className="radar-circle" style={{ width: '25%', height: '25%' }}></div>
                        <div className="radar-circle" style={{ width: '50%', height: '50%' }}></div>
                        <div className="radar-circle" style={{ width: '75%', height: '75%' }}></div>

                        {/* Compass Cardinals */}
                        <div
                          className="radar-cardinal cardinal-n"
                          style={
                            settings.radarOrientation === 'heading-up' && deviceHeading !== null
                              ? {
                                  transform: `translateX(-50%) rotate(${deviceHeading}deg)`,
                                  transition: 'transform 0.1s ease-out'
                                }
                              : {}
                          }
                        >
                          N
                        </div>
                        <div
                          className="radar-cardinal cardinal-e"
                          style={
                            settings.radarOrientation === 'heading-up' && deviceHeading !== null
                              ? {
                                  transform: `translateY(-50%) rotate(${deviceHeading}deg)`,
                                  transition: 'transform 0.1s ease-out'
                                }
                              : {}
                          }
                        >
                          E
                        </div>
                        <div
                          className="radar-cardinal cardinal-s"
                          style={
                            settings.radarOrientation === 'heading-up' && deviceHeading !== null
                              ? {
                                  transform: `translateX(-50%) rotate(${deviceHeading}deg)`,
                                  transition: 'transform 0.1s ease-out'
                                }
                              : {}
                          }
                        >
                          S
                        </div>
                        <div
                          className="radar-cardinal cardinal-w"
                          style={
                            settings.radarOrientation === 'heading-up' && deviceHeading !== null
                              ? {
                                  transform: `translateY(-50%) rotate(${deviceHeading}deg)`,
                                  transition: 'transform 0.1s ease-out'
                                }
                              : {}
                          }
                        >
                          W
                        </div>

                        {/* Render target center */}
                        <div
                          className="radar-dot"
                          style={{
                            top: 'calc(50% - 4px)',
                            left: 'calc(50% - 4px)',
                            backgroundColor: '#38bdf8',
                            boxShadow: 'none'
                          }}
                        ></div>

                        {/* Stale Overlay */}
                        {isStale && (
                          <div
                            className="radar-stale-overlay"
                            style={
                              settings.radarOrientation === 'heading-up' && deviceHeading !== null
                                ? {
                                    transform: `translate(-50%, -50%) rotate(${deviceHeading}deg)`,
                                    transition: 'transform 0.1s ease-out'
                                  }
                                : {}
                            }
                          >
                            Signal Stale
                          </div>
                        )}

                        {/* Render aircraft on radar */}
                        {radarAircraft.map(ac => {
                          const maxR = settings.detectionRadiusKm;
                          // Calculate polar coordinates mapping to radar canvas
                          const radiusPercent = (ac.distanceKm / maxR) * 50; // max radius is 50% from center
                          const angleRad = ((ac.bearingDeg - 90) * Math.PI) / 180;

                          const left = 50 + radiusPercent * Math.cos(angleRad);
                          const top = 50 + radiusPercent * Math.sin(angleRad);

                          // Map noise levels to dot colors
                          const dotColors = { high: '#f43f5e', medium: '#fbbf24', low: '#34d399' };
                          const activeColor = dotColors[ac.noiseLevel];
                          const heading = ac.track || 0;
                          // Noise level was encoded by colour alone, with an
                          // identical glyph for every aircraft, so it was invisible
                          // to red/green deficiency. It now appears in the label and
                          // drives a ring modifier class so shape carries it too.
                          // A title attribute also does not exist on touch, which is
                          // why aria-label is set as well.
                          const noiseText = NOISE_LABELS[ac.noiseLevel];
                          const description =
                            `${ac.cleanFlight || 'Unknown callsign'}, ${noiseText}, ` +
                            `${ac.distanceKm} km away, ${ac.altitudeFt.toLocaleString()} feet, heading ${heading}°`;

                          return (
                            <div
                              key={ac.hex}
                              className="radar-aircraft"
                              role="img"
                              aria-label={description}
                              title={description}
                              style={{
                                left: `${left}%`,
                                top: `${top}%`
                              }}
                            >
                              {/* Pulsing beacon effect for loud planes */}
                              {ac.noiseLevel === 'high' && (
                                <div
                                  className="radar-aircraft-beacon"
                                  style={{ backgroundColor: activeColor }}
                                />
                              )}

                              {/* Stylized rotated airplane icon */}
                              {/* The glow and the transition live in CSS. Inline they
                              were rebuilt on every render, so the changing
                              `filter` forced a repaint in lockstep with the
                              `transform` transition it was fighting.
                              currentColor lets one static rule serve all three
                              noise colours. */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="radar-aircraft-icon"
                                style={{
                                  transform: `rotate(${heading}deg)`,
                                  color: activeColor
                                }}
                              >
                                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                              </svg>

                              {/* Callsign and Flight Level tag */}
                              <div
                                className="radar-aircraft-tag"
                                style={
                                  settings.radarOrientation === 'heading-up' &&
                                  deviceHeading !== null
                                    ? {
                                        transform: `translateX(-50%) rotate(${deviceHeading}deg)`,
                                        transition: 'transform 0.1s ease-out'
                                      }
                                    : {}
                                }
                              >
                                {ac.cleanFlight || 'UNKN'}
                                <br />
                                FL
                                {Math.round(ac.altitudeFt / 100)
                                  .toString()
                                  .padStart(3, '0')}
                              </div>
                            </div>
                          );
                        })}

                        {/* Render airports on radar. Distances and bearings come
                        from a memo rather than being recomputed for all 16
                        entries on every render. */}
                        {visibleAirports.map(({ ap, dist, bearing }) => {
                          const radiusPercent = (dist / settings.detectionRadiusKm) * 50;
                          const angleRad = ((bearing - 90) * Math.PI) / 180;

                          const left = 50 + radiusPercent * Math.cos(angleRad);
                          const top = 50 + radiusPercent * Math.sin(angleRad);

                          return (
                            <div
                              key={ap.code}
                              className="radar-airport"
                              title={`${ap.name} (${ap.code}/${ap.iata}) - ${dist.toFixed(1)} km away`}
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                transform:
                                  settings.radarOrientation === 'heading-up' &&
                                  deviceHeading !== null
                                    ? `translate(-50%, -50%) rotate(${deviceHeading}deg)`
                                    : 'translate(-50%, -50%)',
                                transition: 'transform 0.1s ease-out'
                              }}
                            >
                              <Icons.Tower className="radar-airport-icon" />
                              <div className="radar-airport-tag">{ap.iata || ap.code}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Scanning Radius: {settings.detectionRadiusKm} km • Radar shows{' '}
                        {radarAircraft.length} aircraft
                        {/* Never silently truncate: if the cap drops contacts, say so,
                        otherwise the count reads as complete when it is not. */}
                        {hiddenRadarCount > 0 && (
                          <>
                            {' '}
                            • {hiddenRadarCount} more not drawn (nearest {MAX_RADAR_AIRCRAFT} shown)
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overhead Flight Details */}
                  <div className="card">
                    <h2>Currently Overhead</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {overhead.length === 0 ? (
                        <div className="empty-state">
                          No flights within immediate overhead radius.
                        </div>
                      ) : (
                        overhead.map(ac => (
                          <div key={ac.hex} className="aircraft-card">
                            <div className="aircraft-header">
                              <div>
                                <span className="flight-number">
                                  {ac.cleanFlight || 'No Callsign'}
                                </span>
                                <div className="aircraft-type">{ac.desc || 'Unknown Aircraft'}</div>
                              </div>
                              <span className={`badge badge-${ac.noiseLevel}`}>
                                {ac.noiseLevel} Noise
                              </span>
                            </div>
                            <div className="aircraft-details">
                              <div>
                                <div className="detail-label">Distance</div>
                                <div className="detail-value">
                                  {ac.distanceKm} km ({getCompassDirection(ac.bearingDeg)})
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Altitude</div>
                                <div className="detail-value">
                                  {ac.altitudeFt.toLocaleString()} ft
                                </div>
                                <div
                                  className="detail-value"
                                  style={{ fontSize: '0.8rem', color: '#94a3b8' }}
                                >
                                  FL
                                  {Math.round(ac.altitudeFt / 100)
                                    .toString()
                                    .padStart(3, '0')}
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Trajectory</div>
                                <div className="detail-value">
                                  {renderTrajectoryLabel(ac.trajectory)}
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Details</div>
                                <div className="detail-value">
                                  Reg: {ac.r || 'N/A'} • Speed: {ac.gs || 0} kt
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Incoming Flight Details */}
                  <div className="card">
                    <h2>Heading Towards You</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {incoming.length === 0 ? (
                        <div className="empty-state">No flights heading towards your location.</div>
                      ) : (
                        incoming.map(ac => (
                          <div key={ac.hex} className="aircraft-card">
                            <div className="aircraft-header">
                              <div>
                                <span className="flight-number">
                                  {ac.cleanFlight || 'No Callsign'}
                                </span>
                                <div className="aircraft-type">{ac.desc || 'Unknown Aircraft'}</div>
                              </div>
                              <span className={`badge badge-${ac.noiseLevel}`}>
                                {ac.noiseLevel} Noise
                              </span>
                            </div>
                            <div className="aircraft-details">
                              <div>
                                <div className="detail-label">ETA Overhead</div>
                                <div
                                  className="detail-value"
                                  style={{ color: '#38bdf8', fontWeight: 600 }}
                                >
                                  {ac.cpaTimeSeconds
                                    ? `~${Math.floor(ac.cpaTimeSeconds / 60)}m ${ac.cpaTimeSeconds % 60}s`
                                    : 'Unknown'}
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Altitude</div>
                                <div className="detail-value">
                                  {ac.altitudeFt.toLocaleString()} ft
                                </div>
                                <div
                                  className="detail-value"
                                  style={{ fontSize: '0.8rem', color: '#94a3b8' }}
                                >
                                  FL
                                  {Math.round(ac.altitudeFt / 100)
                                    .toString()
                                    .padStart(3, '0')}
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Current Distance</div>
                                <div className="detail-value">
                                  {ac.distanceKm} km away ({getCompassDirection(ac.bearingDeg)})
                                </div>
                              </div>
                              <div>
                                <div className="detail-label">Trajectory</div>
                                <div className="detail-value">
                                  {renderTrajectoryLabel(ac.trajectory)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div
          id="panel-history"
          role="tabpanel"
          aria-labelledby="tab-history"
          hidden={activeTab !== 'history'}
        >
          {activeTab === 'history' && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem'
                }}
              >
                <h2 style={{ margin: 0, flex: 1 }}>"Who Was That?" Log</h2>
                {history.length > 0 && !confirmingClear && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      gap: '0.25rem',
                      alignItems: 'center'
                    }}
                    onClick={() => setConfirmingClear(true)}
                  >
                    <Icons.Trash aria-hidden="true" /> Clear Log
                  </button>
                )}
                {/* Inline confirmation rather than window.confirm(): native dialogs
                block the event loop, cannot be styled, and are suppressed
                outright in some installed-PWA contexts. */}
                {confirmingClear && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Erase all {history.length} entries?
                    </span>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.8rem',
                        backgroundColor: '#f43f5e',
                        color: '#ffffff'
                      }}
                      onClick={() => {
                        const count = history.length;
                        setHistory([]);
                        setConfirmingClear(false);
                        announce(`Cleared ${count} log entries.`);
                      }}
                    >
                      Erase
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => setConfirmingClear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                {history.length === 0 ? (
                  <div className="empty-state">
                    <Icons.Plane
                      className="detail-label"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'block',
                        margin: '0 auto 0.5rem auto'
                      }}
                    />
                    No overhead flights logged yet.
                    <br />
                    Flights entering within {settings.overheadRadiusKm} km of your coordinates are
                    recorded here.
                  </div>
                ) : (
                  history.map((ev, idx) => (
                    <div key={`${ev.hex}-${ev.timestamp}-${idx}`} className="history-item">
                      <div className="history-meta">
                        <span className="flight-number">{ev.flight}</span>
                        <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{ev.desc}</span>
                        <span className="history-time">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}{' '}
                          • Reg: {ev.registration}
                        </span>
                      </div>
                      <div
                        style={{
                          textAlign: 'right',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '0.25rem'
                        }}
                      >
                        <span className={`badge badge-${ev.noiseLevel}`}>
                          {ev.noiseLevel} Noise
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Closest: {ev.minDistanceKm} km ({ev.altitudeFt.toLocaleString()} ft)
                        </span>
                        <span style={{ fontSize: '0.75rem' }}>
                          {renderTrajectoryLabel(ev.trajectory)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div
          id="panel-settings"
          role="tabpanel"
          aria-labelledby="tab-settings"
          hidden={activeTab !== 'settings'}
        >
          {activeTab === 'settings' && (
            <div>
              {/* Geolocation Permissions Dashboard */}
              <div className="card">
                <h2>Device Geolocation Status</h2>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}
                >
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    GPS Permission Status:
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    {gpsPermissionState === 'granted' ? (
                      <>
                        <Icons.Check /> Granted
                      </>
                    ) : gpsPermissionState === 'denied' ? (
                      <>
                        <Icons.XCircle /> Denied / Blocked
                      </>
                    ) : (
                      <>
                        <span
                          className="status-indicator status-offline"
                          style={{ marginRight: '0.25rem', width: '6px', height: '6px' }}
                        ></span>{' '}
                        Prompt Required
                      </>
                    )}
                  </span>
                </div>

                <div className="switch-container">
                  <div>
                    <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>
                      Use Geolocation (GPS)
                    </span>
                    <div className="switch-label-desc" id="gps-switch-desc">
                      Automatically track coordinates from device sensor
                    </div>
                  </div>
                  {/* The wrapping <label>'s only child is a decorative <span>, so the
                  checkbox had an entirely empty accessible name. aria-label
                  supplies one; aria-describedby attaches the helper text. */}
                  <label className="switch">
                    <input
                      type="checkbox"
                      aria-label="Use Geolocation (GPS)"
                      aria-describedby="gps-switch-desc"
                      checked={settings.useGPS}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSettings(prev => ({ ...prev, useGPS: checked }));
                        if (!checked) {
                          setTempLat(settings.homeLat?.toString() || '');
                          setTempLon(settings.homeLon?.toString() || '');
                        } else {
                          requestGPS();
                        }
                      }}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                {settings.useGPS && (
                  <div className="permissions-badge">
                    Sensor Accuracy:{' '}
                    {gpsAccuracy !== null ? `±${Math.round(gpsAccuracy)}m` : 'Calibrating...'} • GPS
                    Position: ({settings.homeLat || 'searching...'},{' '}
                    {settings.homeLon || 'searching...'})
                  </div>
                )}
              </div>

              {/* Offline Fallback Airport Lookup */}
              {!settings.useGPS && (
                <div className="card">
                  <h2>IATA/ICAO Airport Lookup</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    If GPS is denied or you want to monitor from a different location, type in a
                    North American airport code (e.g. CYHU, YUL, KJFK, KLAX).
                  </p>
                  <form onSubmit={handleAirportLookup} style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Was placeholder-only: a placeholder is not an accessible name
                    and disappears the moment the field has content. */}
                    <label htmlFor="airport-code" className="visually-hidden">
                      Airport code (IATA or ICAO)
                    </label>
                    <input
                      id="airport-code"
                      type="text"
                      placeholder="e.g. CYHU or YHU"
                      value={tempAirport}
                      onChange={e => setTempAirport(e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                    />
                    <button type="submit" className="btn btn-secondary">
                      Lookup
                    </button>
                  </form>
                  {airportResolutionMsg && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.85rem',
                        color: airportResolutionMsg.includes('Found') ? '#34d399' : '#f43f5e',
                        fontWeight: 500
                      }}
                    >
                      {airportResolutionMsg}
                    </div>
                  )}
                </div>
              )}

              {/* Manual coordinate entry */}
              {!settings.useGPS && (
                <form onSubmit={saveManualLocation} className="card">
                  <h2>Manual Coordinates Override</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label htmlFor="manual-lat">Latitude</label>
                      <input
                        id="manual-lat"
                        type="number"
                        step="0.000001"
                        placeholder="e.g. 45.5175"
                        value={tempLat}
                        onChange={e => setTempLat(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="manual-lon">Longitude</label>
                      <input
                        id="manual-lon"
                        type="number"
                        step="0.000001"
                        placeholder="e.g. -73.4169"
                        value={tempLon}
                        onChange={e => setTempLon(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn">
                    Save Coordinates
                  </button>
                </form>
              )}

              {/* Refresh Frequency Selector Card */}
              <div className="card">
                <h2>Scan Refresh Frequency</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Choose how often to fetch aircraft data. If the app encounters API rate limits, it
                  will automatically back off and poll less frequently.
                </p>
                <div className="form-group">
                  {/* Selection was signalled only by the btn/btn-secondary class, i.e.
                  by colour. role=radio + aria-checked exposes it non-visually. */}
                  <div id="interval-label">
                    Fetch Interval: {settings.pollIntervalSeconds} seconds
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby="interval-label"
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      marginTop: '0.5rem'
                    }}
                  >
                    {POLL_INTERVAL_OPTIONS.map(sec => (
                      <button
                        key={sec}
                        type="button"
                        role="radio"
                        aria-checked={settings.pollIntervalSeconds === sec}
                        aria-label={`Poll every ${sec} seconds`}
                        className={`btn ${settings.pollIntervalSeconds === sec ? '' : 'btn-secondary'}`}
                        style={{
                          flex: '1 1 auto',
                          padding: '0.5rem 0.25rem',
                          fontSize: '0.85rem',
                          minWidth: '55px',
                          textAlign: 'center'
                        }}
                        onClick={() => setSettings(prev => ({ ...prev, pollIntervalSeconds: sec }))}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
                {currentPollIntervalMs > settings.pollIntervalSeconds * 1000 && (
                  <div
                    style={{
                      color: '#fbbf24',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      marginTop: '0.5rem'
                    }}
                  >
                    <span>⚠️</span> Rate Limit Backoff Active: Currently polling every{' '}
                    {Math.round(currentPollIntervalMs / 1000)} seconds.
                  </div>
                )}
              </div>

              {/* Threshold configurations */}
              <div className="card">
                <h2>Tracker Thresholds</h2>
                <div className="form-group">
                  <label htmlFor="detection-radius">
                    Detection Radius: {settings.detectionRadiusKm} km
                  </label>
                  <input
                    id="detection-radius"
                    type="range"
                    min="5"
                    max="40"
                    step="5"
                    value={settings.detectionRadiusKm}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        detectionRadiusKm: parseInt(e.target.value)
                      }))
                    }
                    style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="overhead-radius">
                    Overhead Logging Radius: {settings.overheadRadiusKm} km
                  </label>
                  <input
                    id="overhead-radius"
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={settings.overheadRadiusKm}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        overheadRadiusKm: parseFloat(e.target.value)
                      }))
                    }
                    style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="max-altitude">
                    Maximum Audible Altitude: {settings.maxAltitudeFt.toLocaleString()} feet
                  </label>
                  <input
                    id="max-altitude"
                    type="range"
                    min="3000"
                    max="15000"
                    step="1000"
                    value={settings.maxAltitudeFt}
                    onChange={e =>
                      setSettings(prev => ({ ...prev, maxAltitudeFt: parseInt(e.target.value) }))
                    }
                    style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
                  />
                </div>
              </div>

              {/* Radar Orientation Selector Card */}
              <div className="card">
                <h2>Radar Orientation</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Choose whether the top of the radar screen represents geographic North, or aligns
                  with your device's compass heading.
                </p>

                <div
                  role="radiogroup"
                  aria-label="Radar orientation"
                  style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.radarOrientation === 'north-up'}
                    className={`btn ${settings.radarOrientation === 'north-up' ? '' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSettings(prev => ({ ...prev, radarOrientation: 'north-up' }))}
                  >
                    North Up
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.radarOrientation === 'heading-up'}
                    className={`btn ${settings.radarOrientation === 'heading-up' ? '' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={async () => {
                      const permissionApi = getOrientationPermissionAPI();
                      if (permissionApi) {
                        try {
                          const res = await permissionApi.requestPermission();
                          if (res === 'granted') {
                            setSettings(prev => ({ ...prev, radarOrientation: 'heading-up' }));
                          } else {
                            announce('Compass permission denied. Radar stays in North Up mode.');
                          }
                        } catch (err) {
                          announce(
                            `Compass access failed: ${err instanceof Error ? err.message : String(err)}`
                          );
                        }
                      } else {
                        setSettings(prev => ({ ...prev, radarOrientation: 'heading-up' }));
                      }
                    }}
                  >
                    Heading Up (Compass)
                  </button>
                </div>

                {settings.radarOrientation === 'heading-up' && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      textAlign: 'center',
                      marginTop: '0.5rem'
                    }}
                  >
                    Compass Reading:{' '}
                    {deviceHeading !== null ? `${Math.round(deviceHeading)}°` : 'calibrating...'}
                    <br />
                    <span style={{ fontStyle: 'italic' }}>
                      Note: If reading is erratic, wave device in a figure-8 motion to calibrate
                      sensor.
                    </span>
                  </div>
                )}
              </div>

              {/* Radar Features Toggle Card */}
              <div className="card">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Show Airports on Radar</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                      Mark major North American airports (CYHU, CYUL, etc.) that lie within your
                      radar scanning radius.
                    </p>
                  </div>
                  <label className="switch" style={{ flexShrink: 0, marginLeft: '1rem' }}>
                    <input
                      type="checkbox"
                      aria-label="Show airports on radar"
                      checked={settings.showAirportsOnRadar}
                      onChange={e =>
                        setSettings(prev => ({ ...prev, showAirportsOnRadar: e.target.checked }))
                      }
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {/* Compliance & Privacy Disclosure Card */}
              <div className="privacy-box">
                <div
                  className="privacy-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <Icons.Shield aria-hidden="true" /> Privacy: no accounts, no servers, no tracking
                </div>
                {/* Reworded to match what the code does. The previous text said
                coordinates are "never sent to or cached on any server", which was
                true of storage but not of transmission: every poll puts the
                coordinates in the request path to a third-party API. */}
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>We operate no servers and collect nothing.</strong> Your coordinates,
                  settings and overhead log live only in this browser (<code>localStorage</code>).
                  There is no account, no analytics and no telemetry.
                </p>
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>One thing does leave your device:</strong> to find nearby aircraft, each
                  poll sends your latitude, longitude and search radius to{' '}
                  <code>api.airplanes.live</code>, a third-party public flight feed. No identifier
                  is attached, but that service does receive your approximate location for as long
                  as tracking is on.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gap: '0.4rem',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '0.5rem',
                    marginTop: '0.5rem'
                  }}
                >
                  <div>
                    <strong style={{ color: '#38bdf8' }}>Loi 25 (Quebec):</strong> Location access
                    is requested only when you ask for it, and can be revoked in your browser at any
                    time.
                  </div>
                  <div>
                    <strong style={{ color: '#38bdf8' }}>PIPEDA (Canada):</strong> Coordinates are
                    used only to compute distance and bearing to nearby flights. No profile is
                    built, and no identifier accompanies the API request.
                  </div>
                  <div>
                    <strong style={{ color: '#38bdf8' }}>GDPR (EU):</strong> Nothing is collected
                    until you provide a location, and the button below erases everything this app
                    has stored.
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '0.75rem',
                    marginTop: '0.75rem'
                  }}
                >
                  {!confirmingErase ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => setConfirmingErase(true)}
                    >
                      <Icons.Trash aria-hidden="true" /> Erase all local data
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem' }}>
                        Erase saved location, settings and log?
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '0.8rem', backgroundColor: '#f43f5e', color: '#ffffff' }}
                        onClick={eraseAllData}
                      >
                        Erase everything
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => setConfirmingErase(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* App Version / Commit SHA Footer */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '1.5rem',
                  marginBottom: '0.5rem',
                  color: '#94a3b8',
                  fontSize: '0.75rem'
                }}
              >
                SkyNoise Tracker (commit: {__COMMIT_SHA__})
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Test environment for App.tsx.
 *
 * App touches five browser APIs during its very first render, and jsdom
 * provides none of them usefully:
 *
 *   localStorage           - both state initializers read it
 *   navigator.geolocation  - the GPS effect calls getCurrentPosition/watchPosition
 *   navigator.permissions  - the permission-state effect queries it
 *   fetch                  - the polling effect fires immediately on mount
 *   DeviceOrientationEvent - the compass effect feature-detects it
 *
 * Leaving any one of them unstubbed produces either an unhandled rejection or a
 * real network call, so all five are stubbed here rather than per-test.
 */

/** Minimal in-memory localStorage. jsdom ships one, but it persists across
 *  test files and leaks state between them. */
function createStorage(): Storage {
  let store = new Map<string, string>();
  return {
    getItem: k => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: k => void store.delete(k),
    clear: () => void (store = new Map()),
    key: i => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    }
  } as Storage;
}

beforeEach(() => {
  // The active tab lives in the URL hash, and jsdom keeps its location across
  // tests in a file. Without this reset, a test that visits Settings leaves the
  // next test starting there instead of on the default tab.
  if (window.location.hash !== '') {
    window.history.replaceState(null, '', window.location.pathname);
  }

  vi.stubGlobal('localStorage', createStorage());

  // Never resolves by default: tests that care about a fix opt in explicitly.
  // Silently succeeding here would make every test depend on a fake location.
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    geolocation: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(() => 1),
      clearWatch: vi.fn()
    },
    permissions: {
      query: vi.fn().mockResolvedValue({ state: 'prompt', onchange: null })
    },
    onLine: true
  });

  // Rejecting rather than resolving empty: the polling effect fires on mount,
  // and a resolved empty payload would mask a change that broke the fetch path.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch not stubbed for this test')));

  // Present but without requestPermission, i.e. the non-iOS branch.
  vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {});

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

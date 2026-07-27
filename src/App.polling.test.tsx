import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App';
import { SETTINGS_KEY } from './utils/storage';

/**
 * Behavioural tests for the two render-storm fixes.
 *
 * Both are about *how often* something happens, so they need fake timers and a
 * controllable rAF. Kept in their own file so the timer manipulation cannot leak
 * into the smoke tests.
 */

const CONFIGURED = JSON.stringify({
  homeLat: 45.5175,
  homeLon: -73.4169,
  useGPS: false,
  pollIntervalSeconds: 10,
  radarOrientation: 'heading-up'
});

/** An empty but well-formed airplanes.live response. */
function okResponse() {
  return { ok: true, status: 200, json: async () => ({ ac: [] }) };
}
function rateLimited() {
  return { ok: false, status: 429, json: async () => ({}) };
}

describe('polling scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches once on mount, not repeatedly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<App />);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('api.airplanes.live');
  });

  it('polls once per interval', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<App />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (const expected of [2, 3, 4]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(expected);
    }
  });

  /**
   * The regression. The poll delay used to be an effect dependency, and the
   * effect body set it. A 429 therefore tore the timer down, rebuilt it, and
   * re-fired the immediate mount fetch — an extra request aimed at the API that
   * had just rate-limited us.
   */
  it('does not fire an extra request when a 429 triggers backoff', async () => {
    const fetchMock = vi.fn().mockResolvedValue(rateLimited());
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<App />);
    });
    // The mount fetch, and nothing more. Under the old code the backoff state
    // change restarted the effect and immediately fetched again.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Backoff doubled 10s -> 20s, so nothing should happen at 10s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // ...and exactly one more at 20s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the backoff to the user and caps it at 60s', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rateLimited()));

    await act(async () => {
      render(<App />);
    });

    // Drive several backoff doublings: 10 -> 20 -> 40 -> 60 (capped).
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
    }

    // The notice lives on the Settings tab, under Scan Refresh Frequency.
    await act(async () => {
      screen.getByRole('tab', { name: /Settings/ }).click();
    });

    const notice = screen.queryByText(/Rate Limit Backoff Active/i);
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toMatch(/polling every 60 seconds/i);
  });

  it('resets the delay after a success following a backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<App />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Backed off to 20s; the success there resets to 10s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Rate Limit Backoff Active/i)).toBeNull();

    // Back on the 10s cadence, and the reset did not itself fetch.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops polling on unmount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<App />));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('compass throttling', () => {
  beforeEach(() => {
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
  });

  /**
   * Drive `deviceorientation` and count how many animation frames get requested.
   * One frame per burst is the contract: the raw event rate is ~60Hz and each
   * unbatched update re-rendered the entire tree.
   */
  it('coalesces a burst of sensor events into a single frame', async () => {
    const callbacks: FrameRequestCallback[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    await act(async () => {
      render(<App />);
    });
    raf.mockClear();
    callbacks.length = 0;

    // 30 events inside one frame, sweeping well past the epsilon.
    await act(async () => {
      for (let i = 0; i < 30; i++) {
        const event = new Event('deviceorientation') as DeviceOrientationEvent & {
          alpha: number;
        };
        Object.defineProperty(event, 'alpha', { value: i * 3, configurable: true });
        window.dispatchEvent(event);
      }
    });

    // 30 events -> 1 scheduled frame, not 30 state updates.
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it('cancels a queued frame on unmount', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
    vi.stubGlobal('cancelAnimationFrame', cancel);

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<App />));
    });

    await act(async () => {
      const event = new Event('deviceorientation') as DeviceOrientationEvent & {
        alpha: number;
      };
      Object.defineProperty(event, 'alpha', { value: 90, configurable: true });
      window.dispatchEvent(event);
    });

    unmount();
    // A frame left queued would fire after unmount.
    expect(cancel).toHaveBeenCalledWith(42);
  });
});

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

/**
 * Staleness.
 *
 * The regression this pins is subtle: the stale check was an inline `Date.now()`
 * read during render, with nothing driving it. It was re-evaluated only when some
 * unrelated state change happened to cause a render — so a silently dead poll left
 * a confident-looking radar full of minutes-old aircraft. The whole point is that
 * it now appears with NO interaction at all.
 */
describe('stale signal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
  });
  afterEach(() => vi.useRealTimers());

  it('appears on its own once the data ages out, with no interaction', async () => {
    // Resolves once, then hangs forever: the app believes it is still polling.
    let resolved = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (resolved) return new Promise(() => {}) as never;
        resolved = true;
        return okResponse() as never;
      })
    );

    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByText(/Signal Stale/i)).toBeNull();

    // Threshold is max(30s, interval * 2.5) = 30s for a 10s interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.queryByText(/Signal Stale/i), 'went stale too early').toBeNull();

    // Past the threshold, and within one 5s tick of it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.queryByText(/Signal Stale/i), 'never went stale on its own').not.toBeNull();
  });

  it('marks the radar stale immediately on a fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await act(async () => {
      render(<App />);
    });
    // An error is authoritative; no need to wait for the clock.
    expect(screen.queryByText(/Signal Stale/i)).not.toBeNull();
  });

  it('does not run the stale clock before a location is configured', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    // Unconfigured: nothing to be stale about, and no timer re-rendering.
    expect(screen.queryByText(/Signal Stale/i)).toBeNull();
    expect(screen.getByText('Radar Offline')).toBeInTheDocument();
  });
});

describe('offline indicator', () => {
  it('shows OFFLINE when connectivity drops and clears when it returns', async () => {
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));

    render(<App />);
    expect(screen.queryByText('OFFLINE')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText('OFFLINE')).toBeNull();
  });
});

describe('radar render cap', () => {
  beforeEach(() => {
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
  });

  /** N aircraft spread outward from the configured home coordinate. */
  function manyAircraft(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      hex: `hex${i.toString().padStart(4, '0')}`,
      flight: `TEST${i}`,
      t: 'A320',
      desc: 'Airbus A320',
      // Increasing latitude offset => increasing distance from home.
      lat: 45.5175 + i * 0.002,
      lon: -73.4169,
      alt_baro: 3000,
      gs: 250,
      track: 90,
      baro_rate: 0
    }));
  }

  it('caps the drawn set and says how many are not drawn', async () => {
    const total = 90;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ac: manyAircraft(total) }) })
    );

    await act(async () => {
      render(<App />);
    });

    // 60 is the cap; the caption must disclose the remainder rather than
    // silently presenting a truncated count as complete.
    expect(screen.getByText(/Radar shows/)).toHaveTextContent(/60 aircraft/);
    expect(screen.getByText(/not drawn/)).toHaveTextContent(/30 more not drawn/);
  });

  it('says nothing about truncation when under the cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ac: manyAircraft(5) }) })
    );

    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/Radar shows/)).toHaveTextContent(/5 aircraft/);
    expect(screen.queryByText(/not drawn/)).toBeNull();
  });

  /**
   * The cap must not cost the history log a pass. processPasses runs on the full
   * fetched list, not the rendered subset — an aircraft beyond the cap that flies
   * overhead still has to be logged.
   */
  it('still logs an overhead pass for an aircraft beyond the render cap', async () => {
    const crowd = manyAircraft(90);
    // Make the LAST entry — well beyond the cap by distance — sit directly overhead.
    crowd[89].lat = 45.5175;
    crowd[89].lon = -73.4169;
    crowd[89].flight = 'OVERHEAD1';

    const withPass = { ok: true, status: 200, json: async () => ({ ac: crowd }) };
    // Second poll: it has left, which is what finalises the pass.
    const gone = {
      ok: true,
      status: 200,
      json: async () => ({ ac: [{ ...crowd[89], lat: 46.9, lon: -73.4169 }] })
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(withPass).mockResolvedValue(gone);
    vi.stubGlobal('fetch', fetchMock);

    // Fake timers so the second poll does not cost 10 real seconds.
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      await act(async () => {
        render(<App />);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Next poll sees it has left the overhead radius, which finalises the pass.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const log = JSON.parse(localStorage.getItem('skynoise_history') ?? '[]');
      expect(log.map((e: { flight: string }) => e.flight)).toContain('OVERHEAD1');
    } finally {
      vi.useRealTimers();
    }
  });
});

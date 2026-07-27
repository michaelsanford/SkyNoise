import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Service worker update banner.
 *
 * The registration hook is aliased to a mock for tests (see vite.config.ts), so
 * this file re-mocks that module to control `needRefresh` and to observe what the
 * Reload button actually does.
 */

const updateServiceWorker = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true],
    offlineReady: [false],
    updateServiceWorker
  })
}));

// Imported after the mock is registered.
const { default: App } = await import('./App');

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  updateServiceWorker.mockReset().mockResolvedValue(undefined);
  reload = vi.fn();
  // jsdom's location.reload is not writable; redefine it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload, hash: '', pathname: '/' }
  });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('update banner', () => {
  it('shows the banner when an update is waiting', () => {
    render(<App />);
    expect(screen.getByText(/A new version of SkyNoise is available/i)).toBeInTheDocument();
  });

  it('offers exactly one action, with no dismiss', () => {
    render(<App />);
    // Nothing meaningful to cancel: dismissing would leave the app running a
    // build it has already replaced.
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^Reload$/ })).toBeInTheDocument();
  });

  it('calls updateServiceWorker with reload requested', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Reload$/ }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('gives immediate visible feedback and disables the button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Reload$/ }));

    const button = screen.getByRole('button', { name: /Reloading/i });
    expect(button).toBeDisabled();

    // Scoped to the banner: the same wording also lands in the aria-live region,
    // which is a separate assertion below.
    const banner = document.querySelector('.pwa-update-banner')!;
    expect(banner).not.toBeNull();
    expect(
      within(banner as HTMLElement).getByText(/Installing the new version/i)
    ).toBeInTheDocument();
  });

  it('announces the update to assistive technology', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Reload$/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Installing the new version/i);
  });

  /**
   * The actual bug. updateServiceWorker(true) reloads by waiting for the
   * controller to change, which never happens when there is no waiting worker to
   * activate — so the promise resolved and the page stayed exactly where it was.
   * The button looked broken because, functionally, it was.
   */
  it('reloads anyway when updateServiceWorker resolves without navigating', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Reload$/ }));

    expect(reload, 'reloaded too early').not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(reload, 'never reloaded — the click did nothing').toHaveBeenCalled();
  });

  it('still reloads when updateServiceWorker rejects', async () => {
    updateServiceWorker.mockRejectedValue(new Error('no registration'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Reload$/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    // A rejection must not leave the user stuck on the old build.
    expect(reload).toHaveBeenCalled();
  });

  it('ignores repeat clicks while applying', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    const button = screen.getByRole('button', { name: /^Reload$/ });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /Reloading/i }));
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { SETTINGS_KEY } from './utils/storage';

/**
 * Accessibility guarantees.
 *
 * These assert the things a sighted mouse user cannot notice and that therefore
 * regress silently: accessible names, exposed selection state, and label
 * associations. Before this suite the app contained zero aria attributes.
 */

const MANUAL = JSON.stringify({
  homeLat: 45.5175,
  homeLon: -73.4169,
  useGPS: false,
  radarOrientation: 'north-up'
});

describe('tablist semantics', () => {
  it('exposes a tablist with three tabs', () => {
    render(<App />);
    const tablist = screen.getByRole('tablist', { name: 'Views' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3);
  });

  it('marks exactly one tab selected', () => {
    render(<App />);
    const selected = screen.getAllByRole('tab').filter(
      t => t.getAttribute('aria-selected') === 'true'
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(/Live Tracker/);
  });

  it('moves selection with arrow keys, wrapping at both ends', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab(); // focus enters the tablist at the selected tab
    const live = screen.getByRole('tab', { name: /Live Tracker/ });
    expect(live).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Who Was That/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Wrap forwards: history -> settings -> live.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(live).toHaveAttribute('aria-selected', 'true');

    // Wrap backwards.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Settings/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('supports Home and End', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Settings/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /Live Tracker/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('uses a roving tabindex so the group is a single tab stop', () => {
    render(<App />);
    const tabs = screen.getAllByRole('tab');
    const focusable = tabs.filter(t => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
  });

  it('associates each tab with its panel', () => {
    render(<App />);
    for (const tab of screen.getAllByRole('tab')) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId, `${tab.textContent} has no aria-controls`).toBeTruthy();
      const panel = document.getElementById(panelId!);
      expect(panel, `panel ${panelId} does not exist`).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
  });
});

describe('form control names', () => {
  beforeEach(() => localStorage.setItem(SETTINGS_KEY, MANUAL));

  /**
   * The single most severe finding in the review. Both switches were a
   * <label className="switch"> whose only child was <span className="slider">,
   * so the checkbox had a completely empty accessible name — unusable by screen
   * reader, and with the input at opacity:0;width:0;height:0 there was no
   * visible focus indicator either.
   */
  it('gives every checkbox a non-empty accessible name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const box of checkboxes) {
      expect(box).toHaveAccessibleName(/\S/);
    }
  });

  it('names the GPS and airport switches specifically', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));
    expect(screen.getByRole('checkbox', { name: /Use Geolocation/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show airports on radar/i })).toBeInTheDocument();
  });

  it('gives every textbox and slider an accessible name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    // Includes the airport lookup field, which previously had only a placeholder.
    for (const el of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('slider')]) {
      expect(el).toHaveAccessibleName(/\S/);
    }
  });

  it('associates labels with their controls via htmlFor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    // getByLabelText only resolves through a real label association.
    expect(screen.getByLabelText(/Latitude/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Longitude/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Detection Radius/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Overhead Logging Radius/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum Audible Altitude/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Airport code/i)).toBeInTheDocument();
  });
});

describe('segmented groups expose selection', () => {
  beforeEach(() => localStorage.setItem(SETTINGS_KEY, MANUAL));

  it('exposes the poll interval as a radiogroup with one checked option', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    const group = screen.getByRole('radiogroup', { name: /Fetch Interval/ });
    const radios = within(group).getAllByRole('radio');
    expect(radios.length).toBe(5);
    expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('exposes radar orientation as a radiogroup', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    const group = screen.getByRole('radiogroup', { name: /Radar orientation/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });
});

describe('landmarks and live region', () => {
  it('wraps the panels in a main landmark', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('always renders the status region, not just when there is a message', () => {
    // A live region inserted at the same moment as its text is frequently not
    // announced, so it has to be present from the start.
    render(<App />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('destructive action uses in-app confirmation', () => {
  it('confirms inline and announces the result rather than calling confirm()', async () => {
    localStorage.setItem(
      'skynoise_history',
      JSON.stringify([
        {
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
        }
      ])
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Who Was That/ }));

    await user.click(screen.getByRole('button', { name: /Clear Log/ }));
    // Still there — the click asks, it does not erase.
    expect(screen.getByText(/ACA123/)).toBeInTheDocument();
    expect(screen.getByText(/Erase all 1 entries/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(screen.getByText(/ACA123/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Clear Log/ }));
    await user.click(screen.getByRole('button', { name: /^Erase$/ }));
    expect(screen.queryByText(/ACA123/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Cleared 1 log entries/i);
  });
});

/**
 * Right to erasure.
 *
 * PRIVACY.md invokes GDPR Art. 17 and the in-app card claimed erasure was
 * "automated by clicking Clear Log". It was not: Clear Log only emptied the
 * history, so `skynoise_settings` — which holds homeLat/homeLon — survived. The
 * user's stored location outlived the erasure that claimed to remove it.
 */
describe('erase all local data', () => {
  const CONFIGURED = JSON.stringify({
    homeLat: 45.5175,
    homeLon: -73.4169,
    useGPS: false,
    detectionRadiusKm: 40
  });

  beforeEach(() => {
    localStorage.setItem(SETTINGS_KEY, CONFIGURED);
    localStorage.setItem(
      'skynoise_history',
      JSON.stringify([
        {
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
        }
      ])
    );
  });

  it('clearing the log alone leaves the stored location behind', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Who Was That/ }));
    await user.click(screen.getByRole('button', { name: /Clear Log/ }));
    await user.click(screen.getByRole('button', { name: /^Erase$/ }));

    // Documents the limit rather than pretending otherwise: Clear Log is a log
    // action, and the coordinates are still on disk afterwards.
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(stored.homeLat).toBe(45.5175);
  });

  it('erases both keys and returns to first-run state', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));

    await user.click(screen.getByRole('button', { name: /Erase all local data/i }));
    await user.click(screen.getByRole('button', { name: /Erase everything/i }));

    // Both keys are removed, but the persistence effects immediately re-write
    // *empty* defaults as state resets. So the assertion is about personal data
    // not surviving, which is what erasure means — not about key absence.
    expect(JSON.parse(localStorage.getItem('skynoise_history') ?? '[]')).toEqual([]);

    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    expect(parsed.homeLat ?? null).toBeNull();
    expect(parsed.homeLon ?? null).toBeNull();
    expect(parsed.airportCode ?? '').toBe('');
    // Customised threshold is back to default, i.e. genuinely first-run state.
    expect(parsed.detectionRadiusKm ?? 15).toBe(15);

    await user.click(screen.getByRole('tab', { name: /Live Tracker/ }));
    expect(screen.getByText('Welcome to SkyNoise')).toBeInTheDocument();
  });

  it('announces the erasure', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));
    await user.click(screen.getByRole('button', { name: /Erase all local data/i }));
    await user.click(screen.getByRole('button', { name: /Erase everything/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/All local data erased/i);
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Settings/ }));
    await user.click(screen.getByRole('button', { name: /Erase all local data/i }));
    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(stored.homeLat).toBe(45.5175);
  });
});

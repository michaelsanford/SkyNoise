import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { HISTORY_KEY, SETTINGS_KEY } from './utils/storage';
import type { OverheadEvent, UserSettings } from './types';

const CONFIGURED: Partial<UserSettings> = {
  homeLat: 45.5175,
  homeLon: -73.4169,
  useGPS: false
};

const EVENT: OverheadEvent = {
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

describe('App', () => {
  it('renders the header and all three tabs', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'SkyNoise', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Live Tracker/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Who Was That/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Settings/ })).toBeInTheDocument();
  });

  it('shows the welcome state when no location is configured', () => {
    render(<App />);
    expect(screen.getByText('Welcome to SkyNoise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use My GPS Location/ })).toBeInTheDocument();
    // No coordinates means the radar must not claim to be live.
    expect(screen.getByText('Radar Offline')).toBeInTheDocument();
  });

  it('switches tabs on click', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /Who Was That/ }));
    expect(screen.getByRole('heading', { name: /"Who Was That\?" Log/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Settings/ }));
    expect(
      screen.getByRole('heading', { name: /Device Geolocation Status/ })
    ).toBeInTheDocument();
  });

  it('shows the empty state when the history log is empty', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Who Was That/ }));
    expect(screen.getByText(/No overhead flights logged yet/i)).toBeInTheDocument();
  });

  it('renders a persisted history entry', async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([EVENT]));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Who Was That/ }));
    expect(screen.getByText(/ACA123/)).toBeInTheDocument();
  });

  it('applies persisted settings', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(CONFIGURED));
    render(<App />);
    // A configured location replaces the welcome card with the live radar.
    expect(screen.queryByText('Welcome to SkyNoise')).not.toBeInTheDocument();
    expect(screen.getByText('MANUAL')).toBeInTheDocument();
  });
});

/**
 * The regression this suite exists for. Before the storage hardening, JSON.parse
 * ran unguarded inside the history useState initializer, so any of these values
 * threw during the first render and left a permanent white screen — the service
 * worker served a cached shell, so reloading re-read the same value and failed
 * identically.
 */
describe('App survives corrupt persisted state', () => {
  const corruptValues = [
    ['malformed JSON', '{{{'],
    ['truncated JSON', '[{"hex":"a1b2c3","timestamp":170000000'],
    ['a bare null', 'null'],
    ['a number', '5'],
    ['a string', '"not an array"'],
    ['an object', '{"a":1}'],
    ['entries missing required fields', '[{"bad":true}]'],
    ['an array of nulls', '[null,null]']
  ] as const;

  for (const [label, payload] of corruptValues) {
    it(`renders with ${label} in the history key`, () => {
      localStorage.setItem(HISTORY_KEY, payload);
      expect(() => render(<App />)).not.toThrow();
      expect(screen.getByRole('heading', { name: 'SkyNoise', level: 1 })).toBeInTheDocument();
    });
  }

  for (const [label, payload] of corruptValues) {
    it(`renders with ${label} in the settings key`, () => {
      localStorage.setItem(SETTINGS_KEY, payload);
      expect(() => render(<App />)).not.toThrow();
      expect(screen.getByRole('heading', { name: 'SkyNoise', level: 1 })).toBeInTheDocument();
    });
  }

  it('does not poll with a non-numeric stored coordinate', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ homeLat: 'abc', homeLon: -73.4, useGPS: false })
    );
    render(<App />);
    // The coordinate is rejected, so the app falls back to the unconfigured
    // state rather than building a garbage request URL.
    expect(screen.getByText('Welcome to SkyNoise')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not poll with an out-of-range stored coordinate', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ homeLat: 999, homeLon: -73.4, useGPS: false })
    );
    render(<App />);
    expect(screen.getByText('Welcome to SkyNoise')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

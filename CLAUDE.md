# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # install deps
npm run dev            # Vite dev server with HMR
npm run lint           # oxlint (not eslint)
npm run typecheck      # tsc -b --force — walks the project references
npm run test           # vitest run (single pass, CI mode)
npm run build          # tsc -b && vite build -> dist/ incl. service worker
npm run preview        # serve the production build
```

Single test file / single test:

```bash
npx vitest run src/utils/geo.test.ts
npx vitest run -t "should identify climbing low-altitude planes as departing"
npx vitest                                   # watch mode
```

CI (`.github/workflows/ci.yml`) runs, in order: `lint` → `typecheck` → `test` → `build`. Reproduce
that sequence before pushing.

Use `npm run typecheck`, never bare `tsc --noEmit`: without `-b` it resolves the *solution*
`tsconfig.json` (`files: []`, references only) and silently checks **zero files**.

## Architecture

A serverless, client-only React 19 + TypeScript + Vite 8 PWA. There is no backend: all state lives in `localStorage`, and the only outbound call is to `https://api.airplanes.live/v2/point/{lat}/{lon}/{radiusNm}`.

**Everything UI lives in `src/App.tsx`** (~1400 lines, single default-exported `App` component holding all three tabs — Live Tracker, "Who Was That?" history, Settings — plus an inline `Icons` object of hand-written SVGs). Pure logic is factored out into `src/utils/`; that split is deliberate and is what makes the app testable:

- `src/utils/geo.ts` — Haversine `getDistanceKm`, `getBearing`, and `calculateCPA` (cross-track distance + seconds-to-zenith, planar local approximation).
- `src/utils/noise.ts` — `determineTrajectory` (landing/departing/transit from `baro_rate` + altitude) and `classifyNoise` (high/medium/low from type-code regexes and altitude bands).
- `src/utils/airports.ts` — offline `NORTH_AMERICAN_AIRPORTS` table; doubles as the GPS-less location fallback *and* the source of the on-radar airport markers.
- `src/types.ts` — `RawAircraft` (API shape, all optional) → `AircraftUpdate` (enriched, what the UI consumes) → `OverheadEvent` (persisted history record).

Only `geo.ts` and `noise.ts` have tests. New computational logic belongs in `src/utils/` with a colocated `*.test.ts`, not inline in `App.tsx`.

### Polling loop and its invariants

The tracking effect in `App.tsx` depends only on `[currentPollIntervalMs, hasCoordinates]` — deliberately narrow so that changing radius/altitude/etc. does not tear down and restart the interval. It reads live config through `settingsRef.current` instead. **Preserve this**: adding `settings` to that dep array recreates the timer on every GPS tick.

Backoff is encoded in `currentPollIntervalMs`: HTTP 429 doubles it (cap 60 s), a network error multiplies by 1.5, and a successful fetch resets it to `settings.pollIntervalSeconds * 1000`. Because the interval is a dependency, each change legitimately restarts the timer.

### Overhead pass detection

`activePassesRef` (a `hex` → `ActivePass` map, a ref so it never triggers renders) accumulates the minimum distance/altitude while an aircraft is inside `overheadRadiusKm`. A pass is *finalized* into `history` only when the aircraft moves back outside the radius or vanishes from the feed for >35 s. Duplicate suppression: same `hex` within 5 minutes is dropped; history is capped at 100 entries.

### Radar rendering

The radar is DOM elements absolutely positioned in percent — no `<canvas>`. Aircraft are placed by polar mapping: `radiusPercent = (distanceKm / detectionRadiusKm) * 50`, `angleRad = (bearingDeg - 90) * π/180`.

In `heading-up` mode the whole `.radar-container` is rotated by `-deviceHeading`, so **every text label must counter-rotate by `+deviceHeading`** to stay upright — cardinals, aircraft tags, airport markers, and the stale overlay all carry that conditional transform. Any new label on the radar needs the same treatment. Compass input comes from `deviceorientation` (`webkitCompassHeading` on iOS, `360 - alpha` on Android) and silently falls back to `north-up` if permission is refused.

### Settings persistence and migration

`settings` are loaded from `localStorage['skynoise_settings']` and spread over `DEFAULT_SETTINGS` (`{ ...DEFAULT_SETTINGS, ...parsed }`) so new fields land on existing installs. When adding a `UserSettings` field, always give it a default there. History lives under `skynoise_history`.

### PWA / build

`vite-plugin-pwa` with `registerType: 'prompt'` — updates surface via `useRegisterSW` and the in-app update banner; they are never auto-applied. `vite.config.ts` sets `base: '/SkyNoise/'` (GitHub Pages subpath) and injects `__COMMIT_SHA__` from `git rev-parse --short HEAD`, overridable by `VITE_COMMIT_SHA` (both workflows set it to `github.sha`).

Pushes to `main` auto-deploy to GitHub Pages. `dist/` is **gitignored** (`.gitignore:11`) — `deploy.yml` builds it fresh, and any `dist/` on your disk is a stale local artifact invisible to git. `deploy.yml` calls `ci.yml` as a `verify` job, so a failing lint/typecheck/test/build blocks the deploy.

## Constraints

- **CSP is declared in `index.html`** and restricts `connect-src` to `'self' https://api.airplanes.live`, `font-src` to Google Fonts. Any new external origin must be added there or it will be blocked at runtime.
- **No new runtime dependencies without cause.** Production deps are exactly `react` and `react-dom`; icons are inline SVG rather than an icon package.
- **Privacy is a product requirement**, not just a README claim (PRIVACY.md documents GDPR/PIPEDA/Loi 25 alignment). Do not add telemetry, analytics, or any code path that transmits coordinates or history off-device.

## Conventions

- Branches: `<type>/<description>` — `feat/`, `fix/`, `hotfix/`, `release/`, `chore/`.
- Commits: Conventional Commits — `<type>(<scope>): <description>`, e.g. `feat(radar): add heading vectors`.
- Changes land on `main` via pull request; merging to `main` triggers production deploy.

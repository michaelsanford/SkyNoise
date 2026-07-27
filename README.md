# SkyNoise ✈️🔊

[![CI Verification](https://github.com/michaelsanford/SkyNoise/actions/workflows/ci.yml/badge.svg)](https://github.com/michaelsanford/SkyNoise/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/michaelsanford/SkyNoise/actions/workflows/deploy.yml/badge.svg)](https://github.com/michaelsanford/SkyNoise/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4.1-7E9B26?logo=vitest&logoColor=white)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-eigenvector-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/eigenvector)
![License MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

SkyNoise is a serverless, privacy-first Single Page Application (SPA) Progressive Web App (PWA) designed to track overhead flights, assess their acoustic noise profiles, and log historical overhead passes in real-time. 

Designed for residents living along landing and takeoff corridors, it answers two core questions:
1. **"I am here, will it be noisy?"**
2. **"What was that aircraft that just flew over?"**

---

## 🌟 Key Features

*   **Interactive Radar Sweep**: Displays an enlarged $340\text{px}$ vector radar canvas detailing cardinal directions (`N`, `E`, `S`, `W`) and concentric range indicators.
*   **Track-Rotated Telemetry Symbols**: Draws vector aircraft icons aligned to their physical flight headings (`track`), coupled with real-time text overlays showing the callsign and Flight Level (e.g. `FL018`).
*   **Closest Point of Approach (CPA) Math**: Computes relative Haversine distances, azimuth bearings, whether a flight is heading towards you, its cross-track path deviation, and counts down the ETA (Estimated Time of Arrival) to your zenith coordinates.
*   **Flight Trajectory Analyzer**: Classifies flight movements dynamically as **Landing**, **Departing**, **Transit**, or **Unknown** based on climb/descent barometric rate vectors.
*   **Acoustic Noise Profiler**: Categorizes noise impact levels (**High**, **Medium**, **Low**) by evaluating altitude boundaries ($< 6,000\text{ ft}$) and aircraft types (e.g. heavy airliners vs. turboprops vs. light general aviation vs. helicopters).
*   **"Who Was That?" Persistent Log**: Automatically tracks flights entering your immediate overhead radius (default $1.5\text{ km}$) and logs their telemetry (minimum distance and altitude) to your local browser storage once the pass completes.
*   **Magnetometer Compass Integration**: Toggles the radar canvas between `North Up` and `Heading Up` (aligning with your phone's physical orientation). All text labels and tags automatically counter-rotate to stay upright ($0^\circ$ relative to the screen layout) for clear readability.
*   **Network Guard & Backoff Protection**: 
    *   **Refresh Rate Selectors**: Change polling rates between 5s, 10s, 20s, and 30s.
    *   **Exponential Backoff**: Automatically backs off fetch frequency (up to 60s) if the client encounters `429 Too Many Requests` API rate limits or network issues, resetting to default once calls succeed.
    *   **Offline Airport Fallback**: In the absence of GPS access, resolves coordinates using an offline lookup dictionary of major North American airports (e.g. CYHU, CYUL, CYYZ, etc.).

---

## 🔒 Privacy & Regulatory Compliance (GDPR, PIPEDA, Quebec Loi 25)

SkyNoise is entirely **client-side** and runs serverless:
*   **No servers, no accounts, no tracking**: Your coordinates, settings and overhead log live only in this browser's `localStorage`. There is no backend, no cookie, no analytics and no telemetry.
*   **One third party, disclosed**: Each poll sends your latitude, longitude and radius to `api.airplanes.live` so it can return nearby aircraft. No identifier is attached, but that service does receive your approximate location. This is inherent to the app's purpose, not incidental.
*   **Content Security Policy**: Network access is restricted to `'self'` and that one endpoint. Fonts are self-hosted so loading the page contacts no third party at all.
*   **Right to Be Forgotten**: Settings → Privacy → **"Erase all local data"** clears your saved location, all settings and the whole log. ("Clear Log" on the history tab is narrower by design — log only.)
*   Detailed regulatory alignment is documented in [PRIVACY.md](PRIVACY.md).

---

## 🛠️ Technology Stack

*   **Framework**: [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) + [Vite 8](https://vite.dev/)
*   **PWA Integrations**: `vite-plugin-pwa` for Workbox offline asset pre-caching and manifest registrations.
*   **Design System**: Custom CSS with responsive layouts, glowing alerts, glassmorphism overlays, and smooth layout animations.

---

## 🚀 Quick Start & Development

### 1. Installation
Install the project dependencies locally:
```bash
npm install
```

### 2. Dev Server
Launch the local Vite server:
```bash
npm run dev
```

### 3. Production Build
Verify TypeScript compilation and bundle PWA assets (service workers will be compiled inside `dist/`):
```bash
npm run build
```

---

## 📦 Continuous Deployment (GitHub Pages)

The repository contains a Git Action workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

### How to Deploy:
1. Create a pull request to merge your changes into the `main` branch.
2. Once the PR is approved and merged, the deploy workflow will run automatically.
3. Configure the repository settings on GitHub:
   * Click on the **Pages** tab.
   * Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. The workflow will automatically compile and host the app at `https://michaelsanford.github.io/SkyNoise/`.

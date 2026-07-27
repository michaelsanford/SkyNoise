# Security Policy

## Supported Versions

Only the **latest commit on `main` (HEAD / latest)** of SkyNoise receives security fixes. Older builds or manual historic deployments are not patched.

| Version | Supported |
|---------|-----------|
| HEAD / latest | Yes |
| Historic | No |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use [GitHub's private vulnerability reporting](https://github.com/michaelsanford/SkyNoise/security/advisories/new) to submit a report confidentially.

Include as much detail as you can:

- A description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept.
- The browser type, OS, and commit SHA affected.
- Your suggested severity (if you have one).

## Response SLAs

| Milestone | Target |
|-----------|--------|
| Acknowledgement | Within **21 days** of a valid report |
| Fix | **Best effort** — complexity, severity, and maintainer availability determine timeline |

There are no guaranteed fix timelines. Severe, easily exploitable vulnerabilities will be prioritised.

## Scope

This policy covers **the SkyNoise application code** in this repository — a client-side React SPA PWA.

Specifically, in-scope reports include:
- **Local credential/settings handling** — paths exposing local coordinate configs or logs in plain text or unauthorized browser variables.
- **Content Security Policy (CSP)** — any bypasses that allow unauthorized code execution or network requests outside `https://api.airplanes.live`.
- **PWA Service Worker** — caching mechanisms (`sw.js`) containing security vulnerabilities or serving poisoned assets.

### Out of scope

SkyNoise runs entirely in your web browser and communicates with third-party public API endpoints. The following are **out of scope**:
- Vulnerabilities in the **Airplanes.live** API service, its servers, or its data feed.
- Vulnerabilities in your operating system's location service, browser sandbox, or GPS coordinate sensors.

## Bug Bounty

There is **no bug bounty program**. This is a personal open-source project maintained without commercial backing.

## Credit

Reporters of validated vulnerabilities will be **credited by name (or handle) in the release notes** and security advisories, unless anonymity is requested.

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
- **Local settings handling** — paths exposing the stored coordinate configuration or overhead log to another origin, or leaking either outside `localStorage`.
- **Content Security Policy (CSP)** — any bypass allowing code execution, or a network request to an origin other than `'self'` and `https://api.airplanes.live`.
- **PWA Service Worker** — flaws in the Workbox precache (`sw.js`) that would let it serve poisoned or stale-but-trusted assets.

### Known platform limitations

These are **acknowledged and unfixable within GitHub Pages**, so they are not
vulnerabilities in this codebase. Reports describing them are welcome but will be
closed with a pointer here.

GitHub Pages cannot serve custom response headers, and there is no `_headers`
equivalent. Consequently the following cannot be set at all:

| Header | Effect of its absence |
|---|---|
| `X-Frame-Options` / CSP `frame-ancestors` | The site can be framed by any origin. `frame-ancestors` is additionally ignored inside a `<meta>` tag by spec, so the existing meta CSP cannot express it. Mitigated in-page by a scripted frame check, which is defence-in-depth rather than an equivalent. |
| `Strict-Transport-Security` | Covered in practice by the `github.io` HSTS preload. |
| `X-Content-Type-Options` | No sniffing-sensitive user-supplied content is served. |
| `Referrer-Policy` | Substituted by `<meta name="referrer" content="no-referrer">`. |
| `Permissions-Policy` | Cannot restrict features at the document level. |

Fixing these properly requires fronting the site with a CDN that can set headers.

### Out of scope

SkyNoise runs entirely in your web browser and communicates with a third-party public
API. The following are **out of scope**:
- Vulnerabilities in the **Airplanes.live** API service, its servers, or its data feed.
- Vulnerabilities in your operating system's location service, browser sandbox, or GPS sensors.
- The fact that your coordinates are sent to `api.airplanes.live`. This is documented,
  intentional and necessary for the app to function — see [PRIVACY.md](PRIVACY.md).

## Bug Bounty

There is **no bug bounty program**. This is a personal open-source project maintained without commercial backing.

## Credit

Reporters of validated vulnerabilities will be **credited by name (or handle) in the release notes** and security advisories, unless anonymity is requested.

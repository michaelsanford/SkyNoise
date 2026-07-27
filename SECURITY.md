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
| `X-Frame-Options` / CSP `frame-ancestors` | The site can be framed by any origin. `frame-ancestors` is additionally ignored inside a `<meta>` tag by spec, so the existing meta CSP cannot express it. Mitigated in-page by a scripted frame check (`src/frame-guard.ts`), which refuses to mount the app and offers a `target="_top"` link out. **This is defence in depth, not an equivalent:** a header is enforced by the browser before any script runs, whereas a scripted check depends on script executing. It raises the effort required; it does not make framing impossible. |
| `Strict-Transport-Security` | Covered in practice by the `github.io` HSTS preload. |
| `X-Content-Type-Options` | No sniffing-sensitive user-supplied content is served. |
| `Referrer-Policy` | Substituted by `<meta name="referrer" content="no-referrer">`. |
| `Permissions-Policy` | Cannot restrict features at the document level. |

Fixing these properly requires fronting the site with a CDN that can set headers.

#### Trusted Types: evaluated and deliberately not enabled

`require-trusted-types-for 'script'` would be a meaningful hardening against DOM
XSS. It is **not currently achievable here**, for two independent reasons:

1. **The report-only rollout is impossible on this platform.** Per the CSP
   specification, `Content-Security-Policy-Report-Only` is *not supported inside a
   `<meta>` element* — it requires a response header. GitHub Pages cannot send one.
   So the normal safe path (ship report-only, sweep for violations, then promote)
   has no first step.
2. **React 19 ships no Trusted Types integration.** Grepping the production bundle
   for `trustedTypes`, `TrustedHTML` or `createPolicy` returns **zero** matches,
   while `innerHTML` appears five times inside React's own DOM paths — including a
   live assignment in its `<script>`-element branch:

   ```js
   case 'script': o = s.createElement('div'), o.innerHTML = '<script><\/script>', …
   ```

   Under an *enforcing* policy that assignment throws. The app does not currently
   render `<script>` elements or use `dangerouslySetInnerHTML`, so those paths may
   never execute — but "may never" is not a basis for shipping an enforcing policy
   that white-screens the app if it is wrong.

Application code is already compatible: `grep` over `src/` finds no `innerHTML`,
`outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or
`dangerouslySetInnerHTML`. The frame warning is built with DOM APIs specifically so
it does not become the one exception.

**Revisit when** either the site moves behind a CDN that can send a report-only
header, or React ships Trusted Types support. Until then, enabling it blind trades
a real availability risk for a speculative benefit.

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

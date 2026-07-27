/**
 * Clickjacking mitigation.
 *
 * The proper defence is a `frame-ancestors` CSP directive or an
 * `X-Frame-Options` header. Neither is available here:
 *
 *   - `frame-ancestors` is ignored inside a `<meta>` tag by specification, and
 *     the CSP is delivered by meta tag because…
 *   - …GitHub Pages cannot serve custom response headers at all, and offers no
 *     `_headers` equivalent.
 *
 * So this is a scripted fallback. It is **defence in depth, not an equivalent**:
 * a header is enforced by the browser before anything runs, whereas this depends
 * on script executing. It raises the effort required rather than making framing
 * impossible. The real fix is fronting the site with a CDN that can set headers —
 * recorded in SECURITY.md under known platform limitations.
 *
 * Deliberately NOT `top.location = self.location`: that pattern is the fragile
 * 2010-era frame-buster. It can be blocked by the framing page, it navigates the
 * user away without consent, and modern sandbox attributes neuter it. Refusing to
 * render and offering a link is honest and cannot be turned against the user.
 */

/** True when the document is not the top-level window. */
export function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    // A cross-origin parent throws on access. That itself proves we are framed.
    return true;
  }
}

/**
 * Replace the document with a plain explanation and a link out.
 *
 * Built with DOM APIs rather than innerHTML: the CSP forbids inline script, and
 * assembling markup from strings here would be the one place in the app doing so.
 */
export function renderFrameWarning(container: HTMLElement, appUrl: string): void {
  container.textContent = '';

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'max-width:32rem;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;' +
    'color:#f8fafc;text-align:center;line-height:1.6';

  const heading = document.createElement('h1');
  heading.textContent = 'SkyNoise cannot run inside a frame';
  heading.style.cssText = 'font-size:1.25rem;margin:0 0 0.75rem';

  const body = document.createElement('p');
  body.textContent =
    'This page is embedded in another site. Because SkyNoise handles your location, ' +
    'it only runs as a top-level page.';
  body.style.cssText = 'color:#94a3b8;margin:0 0 1.25rem';

  const link = document.createElement('a');
  link.href = appUrl;
  link.target = '_top';
  link.rel = 'noopener';
  link.textContent = 'Open SkyNoise directly';
  link.style.cssText =
    'display:inline-block;padding:0.75rem 1.25rem;background:#38bdf8;color:#0f172a;' +
    'border-radius:0.5rem;font-weight:600;text-decoration:none';

  wrap.append(heading, body, link);
  container.append(wrap);
}

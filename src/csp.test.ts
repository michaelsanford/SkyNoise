/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Content-Security-Policy invariants.
 *
 * jsdom does not enforce CSP, so this cannot prove the browser accepts the page.
 * What it can do is pin the policy's shape — which is where CSP regressions
 * actually come from: a directive quietly dropped, or a third-party origin added
 * back. The companion check is the built-output audit in the release step.
 */

const html = readFileSync('index.html', 'utf8');
const tsx = readFileSync('src/App.tsx', 'utf8');

function policy(): Record<string, string[]> {
  // Locate the whole meta element, then pull `content` out of it. Deliberately
  // not a single-line regex over `http-equiv=... content=...`: a formatter is
  // free to reorder those attributes or put them on separate lines, and the
  // policy's correctness does not depend on either.
  const tag = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/);
  expect(tag, 'no CSP meta tag found').not.toBeNull();
  const m = tag![0].match(/content="([^"]+)"/);
  expect(m, 'CSP meta tag has no content attribute').not.toBeNull();
  return Object.fromEntries(
    m![1]
      .split(';')
      .map(d => d.trim())
      .filter(Boolean)
      .map(d => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      })
  );
}

describe('CSP directives', () => {
  it('defaults to self', () => {
    expect(policy()['default-src']).toEqual(["'self'"]);
  });

  it('states the three directives that do NOT inherit from default-src', () => {
    // base-uri, form-action and frame-ancestors have no fallback. Omitting them
    // leaves them entirely unrestricted, which is easy to miss.
    const p = policy();
    expect(p['base-uri'], 'base-uri does not fall back to default-src').toEqual(["'none'"]);
    expect(p['form-action'], 'form-action does not fall back to default-src').toEqual(["'none'"]);
  });

  it('denies plugin content explicitly', () => {
    expect(policy()['object-src']).toEqual(["'none'"]);
  });

  it('permits exactly one external origin, the aircraft API', () => {
    const p = policy();
    const externals = Object.entries(p).flatMap(([directive, values]) =>
      values.filter(v => v.startsWith('http')).map(v => `${directive}: ${v}`)
    );
    expect(externals).toEqual(['connect-src: https://api.airplanes.live']);
  });

  it('permits no Google Fonts origin', () => {
    // The font is self-hosted; these reappearing would also reintroduce a
    // Referer leak on every page load.
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('upgrades insecure requests', () => {
    expect(policy()).toHaveProperty('upgrade-insecure-requests');
  });

  it('omits frame-ancestors, which a meta tag cannot express', () => {
    // Per spec it is ignored in <meta> and only emits a console warning, so
    // including it would be misleading rather than protective.
    expect(policy()).not.toHaveProperty('frame-ancestors');
  });

  it('still allows inline styles, which the app depends on', () => {
    // App.tsx uses inline style props throughout. Dropping this breaks the UI
    // rather than hardening it.
    expect(policy()['style-src']).toContain("'unsafe-inline'");
  });

  it('does not allow inline or eval scripts', () => {
    const p = policy();
    const scriptSrc = p['script-src'] ?? p['default-src'];
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});

describe('CSP compatibility with the app', () => {
  it('has no inline event handlers, which script-src would block', () => {
    // This is exactly what broke the webfont: an inline onload handler under a
    // policy with no script-src 'unsafe-inline'.
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*"/);
  });

  it('form-action none is safe because no form actually submits', () => {
    // Both handlers preventDefault on their first line; neither form has an
    // action attribute. If a real submission is ever added, form-action must
    // become 'self'.
    const forms = tsx.match(/<form[^>]*>/g) ?? [];
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form, 'a form has an action attribute but form-action is none').not.toMatch(/action=/);
    }
    const handlers = tsx.match(/const (saveManualLocation|handleAirportLookup)[\s\S]{0,80}/g) ?? [];
    expect(handlers).toHaveLength(2);
    for (const h of handlers) {
      expect(h, 'a form handler does not preventDefault').toContain('e.preventDefault()');
    }
  });

  it('sets a referrer policy, the only header-equivalent available', () => {
    expect(html).toMatch(/<meta name="referrer" content="no-referrer"/);
  });
});

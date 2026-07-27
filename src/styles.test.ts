/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Read from disk rather than importing. `./index.css?raw` yields an empty string
// under Vitest because Vite's CSS pipeline intercepts it (test-time CSS
// processing is off by default). The reference directive above scopes node types
// to this file, so tsconfig.app.json can keep excluding them from app code.
const css = readFileSync('src/index.css', 'utf8');
const tsx = readFileSync('src/App.tsx', 'utf8');

/**
 * Stylesheet invariants.
 *
 * jsdom has no layout engine and does not evaluate media queries, so the visual
 * outcome of these rules cannot be asserted here. What *can* be asserted is that
 * the stylesheet stays internally consistent — specifically that every animation
 * is covered by the reduced-motion block. That is the check that rots first: a
 * new animation added months from now will not remember the media query.
 */


/** The `@media (prefers-reduced-motion: reduce)` block body. */
function reducedMotionBlock(): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(start, 'reduced-motion media query is missing entirely').toBeGreaterThan(-1);
  // Walk braces to find the matching close.
  let depth = 0;
  let i = css.indexOf('{', start);
  const from = i;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) break;
  }
  return css.slice(from, i);
}

describe('reduced motion', () => {
  it('declares a prefers-reduced-motion block', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('neutralises animation and transition durations globally', () => {
    const block = reducedMotionBlock();
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('names every animated selector explicitly, not just via the wildcard', () => {
    const block = reducedMotionBlock();
    // Selectors carrying an `animation:` shorthand outside the media query.
    const animated = new Set<string>();
    let currentSelector = '';
    for (const line of css.split(/\r?\n/)) {
      const selMatch = line.match(/^([^\s@{][^{]*)\{\s*$/);
      if (selMatch) currentSelector = selMatch[1].trim();
      if (/^\s*animation:\s/.test(line) && currentSelector) animated.add(currentSelector);
    }
    expect(animated.size).toBeGreaterThan(0);

    const missing = [...animated].filter((sel) => !block.includes(sel));
    expect(
      missing,
      `animated selectors absent from the reduced-motion block: ${missing.join(', ')}`
    ).toEqual([]);
  });
});

describe('no inline animation styles', () => {
  /**
   * An inline `animation` style cannot be overridden by a media query at any
   * specificity, so it would keep running for a user who asked for reduced
   * motion. The alert beacon used to be exactly this.
   */
  it('App.tsx sets no animation via a style prop', () => {
    expect(tsx).not.toMatch(/animation:\s*['"`]/);
  });

  it('App.tsx sets no filter via a style prop', () => {
    // `filter` is not composited; rebuilding it inline every render repainted in
    // lockstep with the transform transition on the same element.
    expect(tsx).not.toMatch(/filter:\s*['"`]drop-shadow/);
  });
});

describe('horizontal overflow containment', () => {
  it('clips the radar subtree, the only source of overflow', () => {
    expect(css).toMatch(/\.radar-wrapper\s*\{[^}]*overflow-x:\s*clip/s);
  });

  it('sizes the radar responsively rather than at a fixed width', () => {
    expect(css).toMatch(/\.radar-container\s*\{[^}]*width:\s*min\(340px,\s*100%\s*-\s*3rem\)/s);
    expect(css).toMatch(/\.radar-container\s*\{[^}]*aspect-ratio:\s*1/s);
    // The old fixed square overflowed a 320px viewport on its own.
    expect(css).not.toMatch(/\.radar-container\s*\{[^}]*height:\s*340px/s);
  });

  it('uses dvh so mobile browser chrome cannot force a scroll', () => {
    expect(css).toContain('min-height: 100dvh');
    expect(css).not.toContain('min-height: 100vh');
  });

  it('sizes radar range rings proportionally, not in px', () => {
    // Fixed px rings would desync from the now-responsive container.
    expect(tsx).not.toMatch(/radar-circle[^>]*width:\s*'(?:85|170|255)px'/);
    expect(tsx).toMatch(/radar-circle[^>]*width:\s*'25%'/);
  });
});

describe('touch targets', () => {
  it('gives buttons and tabs a 44px minimum height', () => {
    expect(css).toMatch(/button\.btn\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.tab\s*\{[^}]*min-height:\s*44px/s);
  });

  it('expands the toggle hit area without resizing the visual track', () => {
    expect(css).toMatch(/\.slider::after\s*\{[^}]*height:\s*44px/s);
    // The visible track is unchanged.
    expect(css).toMatch(/\.switch\s*\{[^}]*width:\s*46px/s);
  });
});

describe('no transition: all', () => {
  it('names transitioned properties explicitly', () => {
    // `transition: all` makes the browser watch every animatable property,
    // including ones that trigger layout.
    expect(css).not.toMatch(/transition:\s*all\b/);
  });
});

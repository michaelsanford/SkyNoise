import { describe, it, expect, afterEach, vi } from 'vitest';
import { isFramed, renderFrameWarning } from './frame-guard';

describe('isFramed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false at top level', () => {
    // jsdom's default: window.top === window.self.
    expect(isFramed()).toBe(false);
  });

  it('is true when top and self differ', () => {
    vi.stubGlobal('window', { ...window, top: {}, self: window });
    expect(isFramed()).toBe(true);
  });

  it('treats a throwing cross-origin parent as framed', () => {
    // Reading window.top across origins throws — and that throw is itself proof
    // of being framed, so it must not be swallowed into a false.
    vi.stubGlobal('window', {
      get top(): Window {
        throw new DOMException('cross-origin', 'SecurityError');
      },
      self: window
    });
    expect(isFramed()).toBe(true);
  });
});

describe('renderFrameWarning', () => {
  it('replaces the container contents', () => {
    const el = document.createElement('div');
    el.textContent = 'app would go here';
    renderFrameWarning(el, 'https://example.test/SkyNoise/');
    expect(el.textContent).not.toContain('app would go here');
    expect(el.textContent).toMatch(/cannot run inside a frame/i);
  });

  it('offers a top-targeted escape link', () => {
    const el = document.createElement('div');
    renderFrameWarning(el, 'https://example.test/SkyNoise/');
    const link = el.querySelector('a')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.test/SkyNoise/');
    // _top so the link escapes the frame rather than navigating inside it.
    expect(link.getAttribute('target')).toBe('_top');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('builds the warning without innerHTML', () => {
    // Assembling markup from strings here would be the only place in the app
    // doing so, and would be the first thing to break under Trusted Types.
    const source = new URL('./frame-guard.ts', import.meta.url);
    expect(source.pathname).toContain('frame-guard');
    const el = document.createElement('div');
    renderFrameWarning(el, 'https://example.test/');
    // Real element nodes, not parsed HTML text.
    expect(el.querySelector('h1')).not.toBeNull();
    expect(el.querySelector('p')).not.toBeNull();
  });
});

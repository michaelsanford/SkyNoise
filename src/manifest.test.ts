/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

/**
 * Manifest and icon contract.
 *
 * Read from vite.config.ts source rather than a build artifact, so the test runs
 * without requiring `npm run build` first.
 */
const config = readFileSync('vite.config.ts', 'utf8');

/** Minimal PNG header reader — enough for dimensions and colour type. */
function pngInfo(path: string) {
  const b = readFileSync(path);
  expect(b.toString('hex', 0, 4), `${path} is not a PNG`).toBe('89504e47');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25], bytes: b.length };
}

describe('manifest identity', () => {
  it('pins an explicit id', () => {
    // Without it, identity derives from start_url, so changing `base` would
    // orphan every existing install rather than updating it.
    expect(config).toMatch(/id: '\/SkyNoise\/'/);
  });

  it('declares categories', () => {
    expect(config).toMatch(/categories: \[/);
  });
});

describe('icon purposes', () => {
  it('never puts "any maskable" on a single asset', () => {
    // One un-padded file cannot be correct for both: the adaptive-icon mask crops
    // to roughly the central 80%, so `any` artwork gets clipped as `maskable`.
    expect(config).not.toMatch(/purpose: 'any maskable'/);
    expect(config).not.toMatch(/purpose: 'maskable any'/);
  });

  it('has a dedicated maskable asset', () => {
    expect(config).toMatch(/src: 'pwa-maskable-512\.png'[\s\S]{0,120}purpose: 'maskable'/);
  });

  it('ships all three icon files at their declared sizes', () => {
    expect(pngInfo('public/pwa-192x192.png')).toMatchObject({ width: 192, height: 192 });
    expect(pngInfo('public/pwa-512x512.png')).toMatchObject({ width: 512, height: 512 });
    expect(pngInfo('public/pwa-maskable-512.png')).toMatchObject({ width: 512, height: 512 });
  });

  it('makes the maskable icon opaque', () => {
    // A transparent maskable icon shows the platform background through the
    // cropped corners. Colour type 2 is RGB, i.e. no alpha channel at all.
    expect(pngInfo('public/pwa-maskable-512.png').colourType).toBe(2);
  });
});

describe('maskable safe zone', () => {
  /**
   * Decode the maskable PNG and confirm the outer ring really is uniform
   * background — i.e. that the artwork was padded rather than just relabelled.
   * This is the assertion that would have caught the original bug.
   */
  it('keeps the outer 10% clear of artwork', () => {
    const buf = readFileSync('public/pwa-maskable-512.png');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const channels = 3;

    const idat: Buffer[] = [];
    let o = 8;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o);
      if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
      o += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));

    const stride = width * channels;
    const px = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? px[y * stride + x - channels] : 0;
        const b = y > 0 ? px[(y - 1) * stride + x] : 0;
        const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
        let v = line[x];
        if (filter === 1) v += a;
        else if (filter === 2) v += b;
        else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        px[y * stride + x] = v & 0xff;
      }
    }

    const hex = (x: number, y: number) => {
      const i = y * stride + x * channels;
      return '#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
    };

    // theme_color, so the padding is seamless against the splash screen.
    const BG = '#0b0f19';
    const probes: Array<[string, number, number]> = [
      ['top-left', 4, 4],
      ['top-right', width - 5, 4],
      ['bottom-left', 4, height - 5],
      ['bottom-right', width - 5, height - 5],
      ['top-mid', width >> 1, 4],
      ['bottom-mid', width >> 1, height - 5],
      ['left-mid', 4, height >> 1],
      ['right-mid', width - 5, height >> 1]
    ];
    for (const [name, x, y] of probes) {
      expect(hex(x, y), `${name} is not background — artwork reaches the crop zone`).toBe(BG);
    }

    // And the centre must actually contain the logo, not an empty canvas.
    const distinct = new Set<string>();
    for (let y = height * 0.3; y < height * 0.7; y += 7) {
      for (let x = width * 0.3; x < width * 0.7; x += 7) distinct.add(hex(x | 0, y | 0));
    }
    expect(distinct.size, 'centre of the maskable icon looks empty').toBeGreaterThan(4);
  });
});

describe('service worker update checks', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('registers a periodic update check', () => {
    // Without this an installed session left open never learns a new build
    // shipped, because the browser only re-checks on navigation.
    expect(app).toMatch(/onRegisteredSW/);
    expect(app).toMatch(/registration\.update\(\)/);
  });

  it('also checks when the tab becomes visible', () => {
    expect(app).toMatch(/visibilitychange/);
  });

  it('skips the check while offline', () => {
    // registration.update() rejects rather than resolving when offline.
    expect(app).toMatch(/navigator\.onLine === false/);
  });

  it('keeps prompt-style updates rather than auto-applying them', () => {
    expect(config).toMatch(/registerType: 'prompt'/);
  });
});

describe('manifest shortcuts', () => {
  it('declares shortcuts for the linkable tabs', () => {
    expect(config).toMatch(/shortcuts: \[/);
  });

  it('points every shortcut at a hash the app actually reads', () => {
    // A shortcut targeting an unhandled hash silently opens the default tab,
    // which is worse than having no shortcut at all.
    const app = readFileSync('src/App.tsx', 'utf8');
    const urls = [...config.matchAll(/url: '([^']+)'/g)].map(m => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const hash = url.split('#')[1];
      expect(hash, `${url} has no hash fragment`).toBeTruthy();
      // TAB_IDS is the validated set the router accepts.
      expect(app, `no tab id matches #${hash}`).toMatch(new RegExp(`'${hash}'`));
    }
  });

  it('scopes shortcut urls under the deployment base', () => {
    for (const m of config.matchAll(/url: '([^']+)'/g)) {
      expect(m[1]).toMatch(/^\/SkyNoise\//);
    }
  });
});

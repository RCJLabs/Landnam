// Hard constraint 1: the built page runs offline, from a file:// open, with
// no external requests.
//
// It has held since the beginning and was asserted NOWHERE, which makes it
// the most load-bearing untested rule in the project. The day somebody adds
// a font, a CDN script or an analytics ping, the only thing that notices is
// a player with no signal — and the failure is total, because the whole game
// is one file.
//
// Two halves, because they catch different mistakes. The first reads the
// PUBLISHED artifact — `index.html`, the exact bytes a player loads — and
// fails on anything in it that points off the page. The second reads the
// SOURCE, because a request built at runtime out of string pieces would not
// look like a URL in the artifact at all.
//
// What the page is allowed: exactly one request, `build.txt`, same-origin,
// gated on `location.protocol` so it cannot fire from `file://`. That is the
// freshness check (`src/freshness.ts`), and it is why this file asserts a
// specific shape rather than a flat ban.

import { describe, it, expect } from 'vitest';
import pageText from '../index.html?raw';
import freshnessSource from '../src/freshness.ts?raw';

/**
 * The SVG namespace. It looks like a URL and is an identifier — browsers
 * never fetch it, and every `svgEl` call in the renderer carries one.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

describe('the published page points at nothing', () => {
  it('carries no URL but the SVG namespace', () => {
    const urls = [...pageText.matchAll(/https?:\/\/[^"'\s)<>]+/g)].map((m) => m[0]);
    const external = urls.filter((u) => u !== SVG_NS);
    expect(external, `external URLs in the shipped page: ${external.slice(0, 5).join(', ')}`)
      .toEqual([]);
    // And the namespace really is in there, so a page that had been emptied
    // of everything could not pass this by having no URLs at all.
    expect(urls.length).toBeGreaterThan(0);
  });

  it('loads no script, stylesheet, image or frame from anywhere', () => {
    // `vite-plugin-singlefile` inlines everything; these are the tags that
    // would appear the moment it stopped, or the moment somebody hand-edited
    // a favicon or a webfont in.
    for (const pattern of [
      /<script[^>]+src=/i,
      /<link[^>]+href=/i,
      /<img[^>]+src=/i,
      /<iframe/i,
      /<source[^>]+src=/i,
      /@import/i,
      /url\(\s*['"]?https?:/i,
    ]) {
      expect(pattern.test(pageText), `the shipped page matches ${pattern}`).toBe(false);
    }
  });

  it('opens no socket and beacons nothing', () => {
    for (const api of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts']) {
      expect(pageText.includes(api), `the shipped page mentions ${api}`).toBe(false);
    }
  });
});

describe('the one request the game is allowed', () => {
  it('is asked for by exactly one file', async () => {
    // The check that actually stops a regression: a `fetch` added to a new
    // module fails here even if the URL is assembled at runtime and never
    // appears in the artifact.
    const modules = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default' });
    const guilty: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      const text = (await load()) as string;
      // Comments talk about `fetch` in several places; a call has a paren.
      const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/\bfetch\s*\(|XMLHttpRequest|new WebSocket|new EventSource|sendBeacon/.test(withoutComments)) {
        guilty.push(path);
      }
    }
    expect(guilty.map((p) => p.replace('../', ''))).toEqual(['src/freshness.ts']);
  });

  it('asks only for build.txt, and only over http', () => {
    // The gate is the whole reason the guarantee survives having a request
    // in it at all: from `file://` this returns before it ever asks.
    expect(freshnessSource).toContain("const STAMP = 'build.txt'");
    expect(freshnessSource).toMatch(/location\.protocol\.startsWith\('http'\)/);
    expect(freshnessSource).toMatch(/if \(!location\.protocol\.startsWith\('http'\)\) return undefined;/);
    // Same-origin by being a bare relative path, with no host in sight.
    expect(freshnessSource).not.toMatch(/fetch\(\s*['"`]https?:/);
  });
});

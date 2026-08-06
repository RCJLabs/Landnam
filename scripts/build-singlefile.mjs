// Inlines the built CSS/JS into a single self-contained index.html so the
// game can be played by opening one file — no server, no asset paths.
// Usage: npm run build && node scripts/build-singlefile.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('build output not found — run npm run build first');

const css = readFileSync(join(assets, cssFile), 'utf8');
const js = readFileSync(join(assets, jsFile), 'utf8');

let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html
  .replace(new RegExp(`<script[^>]*src="[^"]*${jsFile}"[^>]*></script>`), () =>
    `<script type="module">${js}</script>`,
  )
  .replace(new RegExp(`<link[^>]*href="[^"]*${cssFile}"[^>]*>`), () => `<style>${css}</style>`);

const out = join(dist, 'whale-road.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} kB)`);

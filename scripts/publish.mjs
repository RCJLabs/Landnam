// Puts the built page where GitHub Pages can serve it: docs/index.html, a
// committed file on main.
//
// NOT the repo root. The root index.html is Vite's source entry — the four
// lines that load src/main.ts — and an earlier version of this script copied
// the build over it. Vite then happily used the built page as its own input:
// four modules transformed instead of sixty-five, the stamp frozen at whatever
// the previous build said, and the file growing every run as it re-inlined
// itself. It fails silently, which is the worst way for a deploy to fail.
//
// This replaces a Deploy workflow that pushed to gh-pages and left GitHub's
// own `pages build and deployment` to publish it. That path kept dying inside
// actions/deploy-pages with "Invalid actions OIDC token", so correct commits
// reached the branch and were never served. A committed file has no moving
// parts.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BUILT = 'dist/app.html';
const ENTRY = 'app.html';
// Published to BOTH, because GitHub Pages can be pointed at the branch root or
// at /docs and we do not get to see which one is set. Two copies of a 181 kB
// file is a cheap price for not being able to check a dropdown.
//
// An optional argument publishes into a SUBFOLDER of both instead:
// `node scripts/publish.mjs coast` writes coast/index.html and
// docs/coast/index.html, leaving the live game where it is. That is how a
// build behind a flag gets looked at on a phone without replacing the game
// everyone else opens — Phase 8's whole conversion lives behind
// VITE_COAST=1, so an ordinary publish shows none of it.
const where = process.argv[2];
if (where && !/^[a-z][a-z0-9-]*$/.test(where)) {
  console.error(`publish: "${where}" is not a folder name I will write to`);
  process.exit(1);
}
const TARGETS = where ? [where, `docs/${where}`] : ['.', 'docs'];

// Guard the mistake above: if the source entry ever stops looking like a
// source entry, something has overwritten it and the build is not to be
// trusted.
const entry = readFileSync(ENTRY, 'utf8');
if (!entry.includes('src/main.ts')) {
  console.error(`publish: ${ENTRY} is not the Vite source entry any more — restore it before building`);
  process.exit(1);
}

let html;
try {
  html = readFileSync(BUILT, 'utf8');
} catch {
  console.error('publish: dist/index.html missing — run npm run build first');
  process.exit(1);
}
if (html.length < 50_000) {
  console.error(`publish: dist/index.html is only ${html.length} bytes — that is not the game`);
  process.exit(1);
}
if (!html.includes('__BUILD_MARKER_ABSENT__') && !/build [0-9a-f]{7} · /.test(html)) {
  console.error('publish: dist/index.html carries no build stamp — the define did not run');
  process.exit(1);
}

const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const stamp = `${sha} ${new Date().toISOString()}\n`;

for (const dir of TARGETS) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(BUILT, `${dir}/index.html`);
  // The stamp the page fetches to notice it is out of date. Written beside
  // each copy so it always matches the index.html next to it.
  writeFileSync(`${dir}/build.txt`, stamp);
  // Pages runs Jekyll over the folder unless told not to.
  writeFileSync(`${dir}/.nojekyll`, '');
}

const stamped = html.match(/build [0-9a-f]{7} · [0-9-]+ [0-9:]+/)?.[0] ?? '(none)';
console.log(
  `publish: index.html in ${TARGETS.join(' and ')} — ${Math.round(html.length / 1024)} kB, ${stamped}`,
);

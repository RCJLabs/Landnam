// Release ritual: verify the build really is a single self-contained file,
// then zip the source to release/landnam-src.zip.
//
// Run via `npm run release` (which builds first).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

// Vite's entry is app.html, so that is what lands in dist/ — the root
// index.html is the PUBLISHED page, and naming the source entry index.html
// made Vite eat its own output. publish.mjs is what renames the build to
// index.html on the way out. See CLAUDE.md.
const BUILT = 'app.html';

const OUT_DIR = 'release';
const ZIP = join(OUT_DIR, 'landnam-src.zip');

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

// 1. dist must contain the built page and nothing else that the page needs.
const builtPath = join(DIST, BUILT);
let html;
try {
  html = readFileSync(builtPath, 'utf8');
} catch {
  fail(`dist/${BUILT} missing — run npm run build first`);
}

// build.txt is the deploy's own stamp and .nojekyll is Pages plumbing —
// neither is something the PAGE loads, which is what this check is about.
const ALLOWED = new Set([BUILT, 'build.txt', '.nojekyll']);
const stray = readdirSync(DIST).filter((name) => !ALLOWED.has(name));
if (stray.length > 0) {
  fail(`dist should hold only ${BUILT}, found: ${stray.join(', ')}`);
}

// 2. No external requests, no leftover asset references.
const externals = [
  [/<script[^>]+src=/i, 'external <script src>'],
  [/<link[^>]+rel=["']stylesheet["']/i, 'external stylesheet <link>'],
  [/https?:\/\/(?!www\.w3\.org)/i, 'absolute http(s) URL'],
  [/url\(["']?\.\//i, 'relative url() asset reference'],
];
for (const [pattern, label] of externals) {
  if (pattern.test(html)) fail(`built page contains ${label} — it must run offline from file://`);
}
if (!/<script[^>]*>[\s\S]*<\/script>/i.test(html)) fail('no inline script found in the build');
if (!/<style[^>]*>[\s\S]*<\/style>/i.test(html)) fail('no inline styles found in the build');

const sizeKb = statSync(builtPath).size / 1024;

// 3. Zip the source (not node_modules, dist, or previous releases).
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
execFileSync(
  'zip',
  ['-r', '-q', ZIP, '.', '-x', 'node_modules/*', 'dist/*', 'release/*', '.git/*'],
  { stdio: 'inherit' },
);

console.log(`release: dist/${BUILT} is self-contained (${sizeKb.toFixed(0)} kB)`);
console.log(`release: source archived to ${ZIP}`);

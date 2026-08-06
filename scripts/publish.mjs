// Puts the built page where GitHub Pages can serve it: index.html at the root
// of the branch, committed like any other file.
//
// This replaces a Deploy workflow that pushed to gh-pages and let GitHub's own
// `pages build and deployment` publish it. That path kept failing inside
// GitHub — `actions/deploy-pages` returning "Invalid actions OIDC token" — and
// a deploy that depends on three moving parts we do not own is a deploy that
// will fail again. A committed file has no moving parts.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BUILT = 'dist/index.html';

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

copyFileSync(BUILT, 'index.html');

// The stamp the page fetches to notice it is out of date. Written here rather
// than by CI, so it always matches the index.html sitting next to it.
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
writeFileSync('build.txt', `${sha} ${new Date().toISOString()}\n`);

// Pages runs Jekyll over a branch unless told not to, which would eat any file
// or folder beginning with an underscore.
mkdirSync('.', { recursive: true });
writeFileSync('.nojekyll', '');

console.log(`publish: index.html (${Math.round(html.length / 1024)} kB) ready at the repo root`);

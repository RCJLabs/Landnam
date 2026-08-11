// Hard constraint 1, checked the only way it can really be checked: open the
// built page from a file:// URL with the network cut, play a turn, and fail
// if anything at all tries to leave.
//
//   npm run build && node scripts/offline.mjs
//
// `test/offline.test.ts` is the half that runs in `npm test`: it reads the
// published bytes and the source, and it catches a URL you can see. This is
// the half that catches one you cannot — a request assembled at runtime out
// of pieces, which appears nowhere in the artifact as a URL.
//
// Needs Playwright, which this project deliberately does not depend on: the
// game has no runtime dependencies and the test suite needs no browser, and
// one check is not worth changing that. If it is not installed this says so
// and exits without pretending to have passed.

import { existsSync } from 'node:fs';

// The Vite entry is `app.html`, so that is what the build emits — see the
// note in CLAUDE.md about why `index.html` at the root is the PUBLISHED page
// rather than the source one.
const PAGE = 'dist/app.html';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error(
    'offline check: playwright-core is not installed, so this did NOT run.\n' +
      '  npm i -D playwright-core   (or run it where a browser is available)',
  );
  process.exit(2);
}

if (!existsSync(PAGE)) {
  console.error(`offline check: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Everything the page asks for, whether it succeeds or not. A file:// page
// loading its own bytes shows up here too, so the check is on what leaves.
const asked = [];
await page.route('**/*', (route) => {
  const url = route.request().url();
  if (!url.startsWith('file://')) asked.push(url);
  // Cut the wire rather than let it through: a check that passes only
  // because the network happened to work is not a check.
  if (url.startsWith('file://')) route.continue();
  else route.abort();
});
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(1200);

// Actually play, because boot is not the only place a request could hide.
const start = page.locator('button', { hasText: /Take the land|New landing|Continue/i }).first();
if (await start.count()) await start.click();
await page.waitForTimeout(1200);
for (let i = 0; i < 6; i += 1) {
  const overlay = page.locator('.overlay button').first();
  if (!(await overlay.count())) break;
  await overlay.click().catch(() => {});
  await page.waitForTimeout(300);
}
for (let i = 0; i < 4; i += 1) {
  const act = page.locator('button.act').first();
  if (!(await act.count())) break;
  await act.click().catch(() => {});
  await page.waitForTimeout(200);
  const camp = page.locator('button', { hasText: /camp/i }).first();
  if (await camp.count()) await camp.click().catch(() => {});
  await page.waitForTimeout(250);
}

const playable = await page.evaluate(() => document.querySelectorAll('button').length > 0);
const day = await page.locator('.topbar .stat').first().innerText().catch(() => '?');

await browser.close();

const bad = asked.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'));
console.log(
  JSON.stringify({ page: PAGE, playable, day: day.replace(/\n/g, ' '), leftThePage: bad, errors }, null, 1),
);
if (bad.length > 0) {
  console.error(`offline check FAILED: ${bad.length} request(s) left the page.`);
  process.exit(1);
}
if (!playable || errors.length > 0) {
  console.error('offline check FAILED: the page did not come up cleanly with the network cut.');
  process.exit(1);
}
console.log('offline check passed: nothing left the page, and it played.');

// Item 10, measured the only way it counts: reach the challenge code from a
// run that is still going, in the BUILT page, and check the terms it prints
// are the terms the run was actually started on.
//
//   npm run build && node scripts/drive-coast.mjs
//
// The unit tests cover `coastOf`. What they cannot cover is whether a player
// can GET to it — the whole point of the item was that the code existed and
// was unreachable without dying first.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const SEED = 'drive-coast-seed';
// NOT the default. `DEFAULT_HARDSHIP` is 'fair', so a run started on A Fair
// Country would print the right terms whether or not the pick ever reached
// the code — the assertion would pass on a broken path. 'hard' has to
// travel from the chip to the state to the sheet to be seen here.
const TERMS = 'A Hard Country';
const TERMS_ID = 'hard';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('drive-coast: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`drive-coast: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(800);

// Start a run on a seed and terms we choose, so the code has something
// specific to be wrong about.
const seedBox = page.locator('input').first();
if (await seedBox.count()) {
  await seedBox.fill(SEED);
}
const terms = page.locator('button', { hasText: TERMS }).first();
if (await terms.count()) await terms.click();
await page.waitForTimeout(200);

const start = page.locator('button', { hasText: /Take the land|New landing|Continue/i }).first();
if (!(await start.count())) {
  console.error('drive-coast: no way to start a run.');
  await browser.close();
  process.exit(1);
}
await start.click();
await page.waitForTimeout(1000);

// Clear whatever the opening puts up (lessons, the first card).
for (let i = 0; i < 8; i += 1) {
  const overlay = page.locator('.overlay button').first();
  if (!(await overlay.count())) break;
  await overlay.click().catch(() => {});
  await page.waitForTimeout(250);
}

// Play a few days, so this is a run in progress and not the first frame.
for (let i = 0; i < 3; i += 1) {
  const act = page.locator('button.act').first();
  if (!(await act.count())) break;
  await act.click();
  await page.waitForTimeout(250);
  const camp = page.locator('.deed', { hasText: /Rest|Camp|anchor/i }).first();
  if (await camp.count()) await camp.click().catch(() => {});
  await page.waitForTimeout(350);
  for (let j = 0; j < 4; j += 1) {
    const overlay = page.locator('.overlay button').first();
    if (!(await overlay.count())) break;
    await overlay.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

const day = await page.locator('.topbar .stat').first().innerText().catch(() => '?');

// The thing under test: open the Act sheet mid-run and find the code.
const act = page.locator('button.act').first();
if (!(await act.count())) {
  console.error('drive-coast: the Act button is not there, so the sheet cannot be opened.');
  await browser.close();
  process.exit(1);
}
await act.click();
await page.waitForTimeout(400);

const code = await page.locator('.coast-code').first().innerText().catch(() => '');
const blurb = await page.locator('.coast-blurb').first().innerText().catch(() => '');
const copyBtn = page.locator('.coast button');
const copies = await copyBtn.count();

let copied = '';
if (copies > 0) {
  await copyBtn.first().click();
  await page.waitForTimeout(250);
  copied = await page.locator('.coast-code').first().innerText().catch(() => '');
}

// And the loop the whole feature exists for: the code goes back INTO a
// title screen and is recognised as a challenge on the right terms. A code
// that can be produced and not consumed is half a feature.
await page.evaluate(() => localStorage.clear());
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(800);
let readBack = '';
const box = page.locator('input').first();
if ((await box.count()) && code) {
  await box.fill(code.trim());
  await page.waitForTimeout(300);
  readBack = await page.locator('.chase-note').first().innerText().catch(() => '');
}

await browser.close();

// It must be the code for THIS run: our seed, and the terms we picked.
const want = `LN1 ${SEED} ${TERMS_ID}`;
const ok = code.trim() === want;
console.log(JSON.stringify(
  { day: day.replace(/\n/g, ' '), blurb, code, want, copied, copies, readBack, errors },
  null,
  1,
));

if (!ok) {
  console.error(`drive-coast FAILED: the sheet shows "${code}", expected "${want}".`);
  process.exit(1);
}
if (copies === 0) {
  console.error('drive-coast FAILED: the code is shown but there is no way to copy it.');
  process.exit(1);
}
if (!readBack.includes(SEED) || !readBack.includes(TERMS)) {
  console.error(
    `drive-coast FAILED: pasted back into the title screen, the code reads as "${readBack}" ` +
      `— it must name the seed and ${TERMS}.`,
  );
  process.exit(1);
}
if (errors.length > 0) {
  console.error(`drive-coast FAILED: the page threw — ${errors[0]}`);
  process.exit(1);
}
console.log(
  'drive-coast passed: the code is reachable mid-run, matches the run, and is ' +
    'recognised when pasted back in.',
);

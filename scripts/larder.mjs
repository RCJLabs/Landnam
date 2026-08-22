// The larder bar: does the ground TELL the player it is worked out, in the
// built page, before the day is spent?
//
// The sim's side is unit-tested. What that cannot see is whether the warning
// reaches the deed sheet at all — and a depletion the player cannot read is
// just a tax that feels like bad luck.
import { existsSync } from 'node:fs';
const PAGE = 'dist/app.html';
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('larder: playwright-core is not installed, so this did NOT run.'); process.exit(2);
}
if (!existsSync(PAGE)) { console.error('larder: build first'); process.exit(2); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(700);
const seed = page.locator('input').first();
if (await seed.count()) await seed.fill(process.env.SEED ?? 'larder-bar');
await page.locator('button', { hasText: 'Take the land' }).first().click();
await page.waitForTimeout(700);

async function clearCards() {
  for (let i = 0; i < 8; i++) {
    const b = page.locator('.lesson-card button, .card button').first();
    if (!(await b.count())) break;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

/** Open the Act sheet and read what Hunt says about the ground. */
async function huntBlurb() {
  await clearCards();
  const act = page.locator('button', { hasText: 'Act' }).first();
  if (!(await act.count())) return null;
  await act.click();
  await page.waitForTimeout(350);
  // The label and its blurb are separate elements in the sheet, so read the
  // sheet's text and take what sits between Hunt and the next deed.
  const text = await page.evaluate(() => {
    const all = document.body.innerText.replace(/\s+/g, ' ');
    const m = all.match(/Hunt (.*?)(?: Fish | Take this land | Camp |$)/);
    return m ? m[1].trim().slice(0, 200) : null;
  });
  return text;
}

const first = await huntBlurb();
// Hunt the same ground until it notices.
for (let i = 0; i < 6; i++) {
  const hunt = page.locator('button', { hasText: 'Hunt' }).first();
  if (!(await hunt.count())) break;
  await hunt.click();
  await page.waitForTimeout(420);
  await clearCards();
  const act = page.locator('button', { hasText: 'Act' }).first();
  if (await act.count()) { await act.click(); await page.waitForTimeout(250); }
}
const later = await huntBlurb();

console.log(`larder: first  -> ${first}`);
console.log(`larder: after  -> ${later}`);
await page.screenshot({ path: process.env.SHOT ?? '/tmp/larder.png' });
await browser.close();

let bad = false;
if (!first || !later) { console.error('larder: could not read the Hunt deed at all.'); bad = true; }
else if (first === later) {
  console.error('larder: FAIL — six days hunting one hex and the sheet says exactly what it said on day one.');
  bad = true;
}
if (errors.length) { console.error('larder: page errors: ' + errors.join(' | ')); bad = true; }
if (bad) process.exit(1);
console.log('larder: OK — the ground tells the band it is being worked out.');

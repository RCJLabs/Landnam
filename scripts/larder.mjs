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

/**
 * Get back to the road, through whatever the country put in the way.
 *
 * A DAY OF HUNTING CAN BE INTERRUPTED BY A FIGHT, and this bar had no way
 * through one: six days on the same ground met a warband on day eight, the
 * Act sheet became a battle sheet, and the bar reported "could not read the
 * Hunt deed at all" — which is a true statement about the screen and a false
 * one about the larder. It passed for as long as the seed happened not to
 * deal a fight; nothing about the depletion warning was ever involved.
 */
async function backToTheRoad() {
  for (let i = 0; i < 60; i++) {
    await clearCards();
    const fighting = await page.evaluate(() => /End turn|ROUND \d/.test(document.body.innerText));
    if (!fighting) return;
    for (const label of ['Leave', 'End turn', 'Strike']) {
      const b = page.locator('button', { hasText: label }).first();
      if (await b.count()) {
        await b.click({ timeout: 1200 }).catch(() => {});
        await page.waitForTimeout(220);
        break;
      }
    }
  }
}

/** Open the Act sheet and read what Hunt says about the ground. */
async function huntBlurb() {
  await backToTheRoad();
  // OPEN the sheet rather than TOGGLE it. This clicked Act unconditionally,
  // and the hunting loop below leaves the sheet open — so the second reading
  // shut it and came back null. It passed for as long as the sixth hunt
  // happened to raise a card that `clearCards` dismissed, which closes the
  // sheet on the way; change anything about what the country deals and the
  // bar reports "could not read the Hunt deed at all" while the deed is
  // sitting there.
  const isOpen = async () => page.evaluate(
    () => /Hunt\b/.test(document.body.innerText) && /Camp\b/.test(document.body.innerText),
  );
  const act = page.locator('button', { hasText: 'Act' }).first();
  if (!(await act.count())) return null;
  if (!(await isOpen())) {
    await act.click();
    await page.waitForTimeout(350);
  }
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
  await backToTheRoad();
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

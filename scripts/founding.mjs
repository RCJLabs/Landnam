// The founding bar: does "Take This Land?" say the one thing about this
// decision that is measured, on the ground it was measured on?
//
// 12.6. The card shows the verdict, five measures, a strength, a weakness and
// the one-way warning — all of it about the GROUND, and every line of it
// arguing for walking on. "Hard ground: it could be held, by people with
// nothing better" is what a player reads before deciding. Measured, that
// advice is backwards: taking ground like this saw first spring 157 times in
// 200 against 129 for walking on (paired saved 35, killed 7, p < 0.0001,
// 200 landings an arm, settler, 2026-09-05), and cost nothing by day 400.
//
// The sim's half is unit-tested in test/founding.test.ts. What that cannot
// see — and what nothing saw about the colony screens until 12.1 wrote a bar
// for them — is whether the sentence reaches the card at all. A record that
// is computed and never mounted is the exact fault 12.1 found.
//
// Two assertions, and the second is the one that keeps the first honest:
//
//   1. on ground inside the measured window, the card carries the record;
//   2. on ground above it, where both arms took the site and there was no
//      decision to price, the card says nothing. A record shown everywhere
//      would pass a screenshot of (1) and be a claim outside its evidence.
//
// Needs a coast build. Run through `node scripts/bars.mjs`, or alone with
// `node scripts/founding.mjs`.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('founding: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`founding: ${PAGE} is missing. Run \`npm run build\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

/** A fresh run on `seed`, landed and standing on the beach. */
async function landed(page, seed) {
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  // A SAVE FROM THE LAST SEED TURNS THE TITLE INTO "Continue", and the first
  // cut of this bar died on it — the second landing waited thirty seconds for
  // a button that was never coming. The run has to be the seed's own.
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await page.reload();
  await page.waitForTimeout(700);
  const box = page.locator('input').first();
  if (await box.count()) await box.fill(seed);
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);
}

/** Clear whatever the game is saying, so the next tap reaches the sheet. */
async function clearOverlay(page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator('.overlay').first();
    if (!(await overlay.count())) return;
    const go = overlay.locator('button').last();
    if (!(await go.count())) return;
    await go.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * Stand on ground in `[from, to)` and open the founding card. Returns the
 * card's full text, or null if this coast has no such stretch — a skip, not
 * a failure, and the caller says which.
 */
async function cardOnGround(page, seed, from, to) {
  await landed(page, seed);
  await clearOverlay(page);
  const total = await page.evaluate(
    ([a, b]) => window.landnam?.standOn(a, b) ?? null,
    [from, to],
  );
  if (total === null) return null;
  await page.waitForTimeout(400);
  await clearOverlay(page);

  const act = page.locator('.action-slot button', { hasText: /^Act$/ }).first();
  if (await act.count()) {
    await act.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const take = page.locator('.overlay button')
    .filter({ has: page.locator('.deed-label', { hasText: /Take this land/i }) })
    .first();
  if (!(await take.count())) return null;
  await take.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const card = document.querySelector('.card.founding');
    return card ? { text: card.textContent ?? '', total: null } : null;
  });
}

// The sentence's opening, matched loosely enough to survive a reworded tail
// and tightly enough that no other line on the card could satisfy it.
const RECORD = /Bands that took ground like this/i;

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let sawWindow = false;
let sawAbove = false;

// Several seeds, because one coast need not carry both kinds of ground.
for (const seed of ['found-a', 'found-b', 'found-c', 'found-d', 'found-e', 'found-f']) {
  if (!sawWindow) {
    const card = await cardOnGround(page, seed, 12, 14);
    if (card) {
      sawWindow = true;
      check(
        RECORD.test(card.text),
        `founding: on ground the record was measured on, the card does not carry it`,
      );
    }
  }
  if (!sawAbove) {
    const card = await cardOnGround(page, seed, 14, 99);
    if (card) {
      sawAbove = true;
      check(
        !RECORD.test(card.text),
        'founding: the record speaks on ground above its own window,'
          + ' where both arms took the site and there was no decision to price',
      );
    }
  }
  if (sawWindow && sawAbove) break;
}

// An instrument check before any verdict: a bar that never reached either
// kind of ground proved nothing, and must say so rather than passing.
if (!sawWindow || !sawAbove) {
  console.error(
    `founding: could not reach ${!sawWindow ? 'hard ground (12-13)' : ''}`
    + `${!sawWindow && !sawAbove ? ' or ' : ''}${!sawAbove ? 'ground above 14' : ''}`
    + ' on six coasts, so this did NOT run.',
  );
  await browser.close();
  process.exit(2);
}

check(errors.length === 0, `founding: page errors — ${errors.join(' | ')}`);
await page.close();
await browser.close();

if (fail.length) {
  console.error(`founding: ${fail.length} FAILED`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log('founding: the card states the record on the ground it was measured on, and nowhere else');

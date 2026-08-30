// The look bar: does the game still LOOK like it did, and if not, where?
//
// WHY THIS EXISTS. In one week a player found three defects by opening the
// game on a phone: the band walking 142 units above its own ground, a battle
// where you could not tell where the enemy was, and a field that halved in
// size as men died. Every one of them was invisible to eleven browser bars
// and 1442 unit tests, and it is not bad luck — every bar in this repo counts
// nodes, measures boxes and taps buttons, and NONE of them looks at the
// picture. A view can be fully populated, perfectly tappable, entirely
// correct in the DOM and still be a wrong drawing.
//
// So this one takes screenshots of a fixed set of screens and reduces each to
// a coarse grid of brightness. It is deliberately not a hash: a hash says
// "something changed" and then cannot say what, which turns every deliberate
// art change into an argument with the tooling. A grid gives a DISTANCE and a
// location, so the bar can say "the road moved, two thirds of the way down,
// by 31" and a person can decide whether that is the change they meant.
//
// It cannot tell a good drawing from a bad one. What it can do is refuse to
// let one change quietly, which is the failure that actually happened: the
// floating band shipped through three art passes with every bar green.
//
// Blessing a change is a human act, on purpose: `LOOK_BLESS=1 node
// scripts/look.mjs` writes the new baseline, and you are expected to have
// looked at the PNGs it leaves in art/look/ first.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { GRID_H, GRID_W, distance, signature } from './lookSignature.mjs';

const PAGE = 'dist/app.html';
const BASELINE = 'art/look/baseline.json';
const SHOTS = 'art/look';
// MEASURED TWICE, because the first number was a guess and it was ten times
// too loose. 1.0 came from a synthetic test — a three-percent shade change
// over a fifth of the screen reads 1.47 — and then the first real sabotage
// walked straight through it: stopping `installKnot` reaching the page, which
// silently removes every woven rule in the game, moved the road by 0.15 and
// the chronicle by 0.36 and the bar said nothing.
//
// The floor is not a guess at all: the same page screenshotted twice reads
// 0.00, and a whole run of nine screens repeated reads 0.00 on every one. So
// the threshold sits just above nothing rather than below the smallest thing
// worth catching. A shape halving reads 27; a missing hairline reads 0.15;
// this catches both.
//
// The cost of a floor this low is that it is a SNAPSHOT bar: it compares
// against pictures taken in this container, and a different machine, browser
// build or font stack will fail every screen at once. That is the trade a
// snapshot bar always makes, and it is worth it for the only instrument here
// that can see a drawing.
const MOVED = 0.05;

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('look: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`look: ${PAGE} is missing. Run \`npm run build\`.`);
  process.exit(2);
}

const bless = process.env.LOOK_BLESS === '1';
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const fresh = {};
const fail = [];
const notes = [];

const clearCards = async (page, stopAtEnd = true) => {
  for (let i = 0; i < 8; i += 1) {
    if (stopAtEnd && await page.locator('.end-card').count()) return;
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) return;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(180);
  }
};

/**
 * The screens. Each one leaves the page where the next expects it, and each
 * says what must be ON it for the photograph to mean what its name says.
 *
 * THE GUARD IS NOT DECORATION. The ending scene tried to walk out of the
 * fight before it and could not, so it photographed the battlefield and
 * filed it under "ending" — a bar quietly measuring the wrong screen twice
 * and reporting both as fine. It only showed because a sabotage moved
 * "ending" and "fight-late" by exactly the same 8.3.
 */
const SCENES = [
  ['title', '.overlay.title .card', async () => undefined],
  ['road', 'svg.procession', async (page) => {
    await page.locator('.overlay.title input').first().fill('look-bar');
    await page.locator('button', { hasText: /Take the land/i }).first().click();
    await page.waitForTimeout(900);
    await clearCards(page);
  }],
  ['chronicle', '.saga-book', async (page) => {
    await page.locator('.action-slot button', { hasText: /^Saga$/ }).first()
      .click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
  }],
  ['fight', 'svg.field', async (page) => {
    await page.locator('.overlay button', { hasText: /^Back$/ }).first()
      .click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.evaluate(() => window.landnam.fight(0));
    await page.waitForTimeout(900);
  }],
  ['fight-late', 'svg.field', async (page) => {
    // THE STATE THE SHRINKING FIELD LIVED IN. The opening frame of a fight
    // has everybody standing, and the bug that halved the picture only
    // appeared once a whole rank had emptied — so a bar that photographs
    // round one cannot see it however sharp its eyes are. This one strikes
    // every turn, the way `scripts/field.mjs` learned to, and photographs a
    // fight with men down in it: blood, marks, gaps in the line.
    for (let t = 0; t < 12; t += 1) {
      if (!(await page.locator('svg.field').count())) break;
      const aim = await page.evaluate(() => {
        const m = document.querySelector('svg.field .mark');
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (aim) {
        await page.mouse.click(aim.x, aim.y).catch(() => {});
        await page.waitForTimeout(180);
      }
      // THE TURN ENDS ITSELF NOW (9.13), so there is nothing to click after a
      // blow lands — the End turn button is offered only to a fighter who has
      // NOT acted. This used to click it and `break` when it was missing,
      // which after 9.13 would have broken on the first strike and quietly
      // gone back to photographing round one: exactly the blind spot the
      // scene above was written to close.
      //
      // So: wait out the grace the screen leaves the blow on for, and only
      // press End turn if the tap missed and the fighter is still holding.
      await page.waitForTimeout(700);
      const end = page.locator('.action-slot button', { hasText: /^End turn$/ }).first();
      if (await end.count()) {
        await end.click({ timeout: 1200 }).catch(() => {});
        await page.waitForTimeout(260);
      }
    }
  }],
  ['ending', '.end-card', async (page, w) => {
    // At 320 this is skipped: it is a full-screen card that says the same
    // thing at both widths, and it is by far the most expensive screen to
    // reach — about ninety turns of starving, which on its own was longer
    // than the rest of the bar put together. `scripts/ending.mjs` already
    // measures its structure at 390.
    if (w !== 390) return 'skip';
    // FROM A FRESH PAGE. This used to try to walk out of the fight above it,
    // which cannot be done — so it starved a band that was still standing in
    // a battle, never reached an ending, and photographed the battlefield.
    // A run is the only way to an ending, so it takes one. The save has to
    // go first or the reload simply resumes the fight it was trying to leave.
    await page.evaluate(() => localStorage.clear());
    await page.goto(`file://${process.cwd()}/${PAGE}`);
    await page.waitForSelector('.overlay.title', { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.locator('.overlay.title input').first().fill('look-bar');
    await page.locator('button', { hasText: /Take the land/i }).first().click();
    await page.waitForTimeout(900);
    await clearCards(page);
    await page.evaluate(() => window.landnam.stock(0, 0));
    for (let d = 0; d < 90; d += 1) {
      if (await page.locator('.end-card').count()) break;
      await page.evaluate(() => {
        document.querySelectorAll('.overlay button').forEach((n) => n.remove());
      });
      const act = page.locator('.action-slot button', { hasText: /^Act$/ }).first();
      if (!(await act.count())) break;
      await act.click({ timeout: 1500 }).catch(() => {});
      const camp = page.locator('.overlay button').filter({ hasText: /^Camp/i }).first();
      await camp.waitFor({ state: 'visible', timeout: 700 }).catch(() => {});
      await camp.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(240);
      await clearCards(page);
    }
  }],
];

/** Which bands of the picture moved, in plain words. */
function where(a, b) {
  const rows = [];
  for (let y = 0; y < GRID_H; y += 1) {
    let sum = 0;
    for (let x = 0; x < GRID_W; x += 1) sum += Math.abs(a[y * GRID_W + x] - b[y * GRID_W + x]);
    rows.push(sum / GRID_W);
  }
  const worst = rows.reduce((best, v, i) => (v > rows[best] ? i : best), 0);
  const band = worst < GRID_H / 3 ? 'the top' : worst < (GRID_H * 2) / 3 ? 'the middle' : 'the bottom';
  return `most of it in ${band}, around row ${worst + 1} of ${GRID_H}`;
}

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

for (const [w, h] of [[390, 844], [320, 568]]) {
  // Stillness, so smoke and weather and firelight do not make every run a
  // different picture. The game has its own reduced-motion path — see
  // src/motion.ts — and this is the same switch a player can throw.
  const page = await browser.newPage({
    viewport: { width: w, height: h }, hasTouch: true, reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForSelector('.overlay.title', { timeout: 15000 });
  await page.waitForTimeout(1200);

  for (const [name, must, reach] of SCENES) {
    if (await reach(page, w) === 'skip') continue;
    await page.waitForTimeout(500);
    const key = `${name}@${w}x${h}`;
    if (!(await page.locator(must).count())) {
      fail.push(`${key}: "${must}" is not on the screen, so this is a photograph ` +
        'of something else and was NOT compared');
      continue;
    }
    const shot = await page.screenshot();
    const sig = signature(shot);
    fresh[key] = Buffer.from(sig).toString('base64');

    const was = base[key] ? [...Buffer.from(base[key], 'base64')] : null;
    if (!was) {
      notes.push(`${key}: no baseline yet`);
      writeFileSync(`${SHOTS}/${name}-${w}x${h}.png`, shot);
      continue;
    }
    const moved = distance(was, sig);
    if (moved > MOVED) {
      writeFileSync(`${SHOTS}/${name}-${w}x${h}.png`, shot);
      fail.push(`${key} changed by ${moved.toFixed(1)} — ${where(was, sig)}. ` +
        `Look at ${SHOTS}/${name}-${w}x${h}.png; if it is right, bless it.`);
    } else {
      notes.push(`${key}: ${moved.toFixed(2)}`);
    }
  }
  if (errors.length) fail.push(`${w}x${h}: the page reported ${errors[0]}`);
  await page.close();
}

await browser.close();

for (const said of notes) console.log(`look: ${said}`);

if (bless) {
  // SAY WHAT IS BEING BLESSED. Blessing used to print only a count, so the
  // one act in this bar that is supposed to require a person looking was the
  // one that told them nothing — and a stale baseline got written twice
  // during this file's own construction because of it.
  for (const said of fail) console.log(`look: blessing — ${said}`);
  writeFileSync(BASELINE, `${JSON.stringify(fresh, null, 2)}\n`);
  console.log(`look: blessed ${Object.keys(fresh).length} screens into ${BASELINE}`);
  process.exit(0);
}
if (fail.length) {
  for (const said of fail) console.error(`look: ${said}`);
  console.error('look: run with LOOK_BLESS=1 once you have looked and agree.');
  process.exit(1);
}
console.log(`look: ${Object.keys(fresh).length} screens look the way they did`);

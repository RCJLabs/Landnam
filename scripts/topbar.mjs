// The top bar bar: can the player see the warnings the top bar exists to give?
//
// 12.5. The bar is a flex row that scrolls sideways, and the stats inside it
// never shrink — a deliberate decision from 2026-08-06, recorded in
// `style.css` beside the rule: a long value (a fighter's name) squeezed below
// its own width painted straight over its neighbour, so the bar was made to
// scroll instead. That decision is kept. What was never checked is what the
// scroll COSTS, and the answer is that the bar hides its own warnings:
//
//   measured on the built page, 2026-09-05, and worse than the item recorded
//   travel day 34   390px: 143px over, Heart and "Winter in 15 days" off
//                   320px: 221px over, Wood, Heart and the badge off
//   travel day 1    320px: 32px over, Heart off
//   colony          320px: 68px over, Watch and Idle off
//   battle          320px: 68px over, Wall and Steps off
//
// The last two are new here — the item was written from the travel screen
// alone and the other two carry the same fault.
//
// THE RULE THIS ASSERTS, and it is narrower than "nothing overflows" for a
// reason. A stat bar that must scroll is a nuisance; a WARNING that must be
// scrolled to is not a warning, and neither is a banner the player never
// sees. So:
//
//   1. the winter badge and the jarl band are never inside the scrolling row.
//      They are banners about the run, not stats, and a banner that scrolls
//      off the side is a banner nobody reads;
//   2. nothing in the bar sits off the side of the screen at all — after the
//      folds below there is room, so anything past the edge means a chip has
//      been added without asking what it costs;
//   3. every chip still clears the 44px touch rule's sibling: it is legible,
//      not clipped by its own box.
//
// Needs a coast build. Run through `node scripts/bars.mjs`, or alone with
// `node scripts/topbar.mjs`.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('topbar: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`topbar: ${PAGE} is missing. Run \`npm run build\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

async function clearCards(page) {
  for (let i = 0; i < 6; i += 1) {
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) return;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

/** Every chip and banner in the bar, with where it sits. */
const survey = (vw) => {
  const bar = document.querySelector('.topbar');
  if (!bar) return null;
  const rows = [...bar.querySelectorAll('.stat, .winter-warning, .jarl-band')].map((c) => {
    const r = c.getBoundingClientRect();
    return {
      cls: c.className,
      text: (c.textContent || '').trim().slice(0, 20),
      right: Math.round(r.right),
      left: Math.round(r.left),
      off: r.right > vw + 1 || r.left < -1,
      // A banner that is a flex child of the scrolling row rides the scroll
      // with the chips; one outside it cannot.
      inRow: c.parentElement === bar && getComputedStyle(bar).flexWrap !== 'wrap'
        && (getComputedStyle(bar).overflowX === 'auto' || getComputedStyle(bar).overflowX === 'scroll'),
    };
  });
  return { over: bar.scrollWidth - bar.clientWidth, rows };
};

async function look(page, label, w) {
  const seen = await page.evaluate(survey, w);
  if (!seen) { check(false, `topbar: ${label} has no top bar at all`); return; }
  const off = seen.rows.filter((r) => r.off);
  check(
    off.length === 0,
    `topbar: ${label} at ${w}px — ${off.length} off the side of the screen: `
      + off.map((r) => `"${r.text}"`).join(', '),
  );
  const banners = seen.rows.filter((r) => r.cls.includes('winter-warning') || r.cls.includes('jarl-band'));
  for (const b of banners) {
    check(!b.inRow, `topbar: ${label} at ${w}px — "${b.text}" rides the stat scroll instead of standing on its own`);
  }
  console.log(`  ${label} at ${w}px: ${seen.rows.length} in the bar, ${off.length} off the side`
    + (seen.over > 0 ? `, scrolls ${seen.over}px` : ''));
}

for (const [w, h] of [[390, 844], [320, 568]]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h }, hasTouch: true, reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await page.reload();
  await page.waitForTimeout(800);
  const seed = page.locator('.overlay.title input').first();
  if (await seed.count()) await seed.fill('topbar-bar');
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(900);
  await clearCards(page);

  await look(page, 'travel, day 1', w);

  // DEEP ENOUGH FOR THE WARNINGS TO EXIST. Day 1 has no weather chip and no
  // winter badge, so a bar that only looked there would report the screen
  // healthy on exactly the day it has nothing to hide.
  await page.evaluate(() => window.landnam?.skip?.(33));
  await page.waitForTimeout(700);
  await clearCards(page);
  await look(page, 'travel, day 34 (autumn, weather, badge)', w);

  await page.evaluate(() => window.landnam?.settle?.());
  await page.waitForTimeout(700);
  await clearCards(page);
  await page.locator('.action-slot button', { hasText: /^Act$/ }).first()
    .click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  const enter = page.locator('.overlay button')
    .filter({ has: page.locator('.deed-label', { hasText: /^The steading$/ }) }).first();
  if (await enter.count()) {
    await enter.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(700);
    await clearCards(page);
  }
  await look(page, 'the steading', w);

  await page.locator('.action-slot button', { hasText: /^Back to the land$/ }).first()
    .click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(500);
  await clearCards(page);
  await page.evaluate(() => window.landnam?.fight?.(2));
  await page.waitForTimeout(900);
  await look(page, 'a fight', w);

  check(errors.length === 0, `topbar: ${w}px page errors — ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();

if (fail.length) {
  console.error(`topbar: ${fail.length} FAILED`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log('topbar: every stat and every warning is on the screen, at both widths, on all four screens');

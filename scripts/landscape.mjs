// A phone held sideways.
//
//   npm run build && node scripts/landscape.mjs
//
// Landscape was never broken in the way a layout is usually broken. Measured
// at 844 x 390 before the rule that this checks: nothing overflowed, nothing
// was clipped, every button was reachable — and the map was 125 pixels tall
// against 579 in portrait, because the panels kept the height they were
// given for a tall screen. The GAME was the thing that shrank.
//
// That is not a bug any assertion about overflow would ever have caught, so
// the bar here is about PROPORTION: on a screen wider than it is tall, the
// map has to get most of the height, and the reading matter has to go beside
// it rather than under it.
//
// Two other things are checked because both were broken by the first attempt
// at the fix, and neither shows up in a screenshot:
//
//   - The mute and the gear are `position: fixed` to the right edge. Moving
//     them left needed a rule that came AFTER their own, and it did not, so
//     `left: 8px` and `right: 8px` both applied and the slot became an
//     invisible full-width strip at z-index 40 — sitting on top of the site
//     report and swallowing taps across it.
//   - A modal on a 390px screen scrolls inside itself. Its button is allowed
//     to start below the fold; it is not allowed to be unreachable.
//
// Playwright stays optional, as in scripts/offline.mjs.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('landscape: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`landscape: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

/** Everything worth knowing about one viewport, read out of the live page. */
const survey = () => ({
  vw: innerWidth,
  vh: innerHeight,
  map: Math.round(document.querySelector('.map-slot')?.getBoundingClientRect().height ?? 0),
  overflowsV: (document.querySelector('.shell')?.scrollHeight ?? 0)
    > (document.querySelector('#app')?.clientHeight ?? 0) + 1,
  overflowsH: document.documentElement.scrollWidth > innerWidth,
  // #app is `overflow: hidden`, so anything past the edge is simply gone.
  clipped: [...document.querySelectorAll('.shell button')]
    .filter((el) => {
      const q = el.getBoundingClientRect();
      return q.height > 0 && (q.bottom > innerHeight + 1 || q.right > innerWidth + 1);
    })
    .map((el) => el.textContent.trim().slice(0, 20)),
  // Text underneath the fixed mute/gear glyphs is unreadable and untappable.
  covered: (() => {
    const glyphs = [...document.querySelectorAll('.mute-slot, .menu-slot')]
      .map((g) => g.getBoundingClientRect());
    return [...document.querySelectorAll('.hint-slot *, .action-slot *')]
      .filter((el) => el.children.length === 0 && el.textContent.trim())
      .filter((el) => {
        const q = el.getBoundingClientRect();
        return glyphs.some((g) =>
          q.left < g.right && q.right > g.left && q.top < g.bottom && q.bottom > g.top);
      })
      .map((el) => el.textContent.trim().slice(0, 20));
  })(),
});

const browser = await chromium.launch({ executablePath: CHROME });

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);
  return { page, errors };
}

// --- Portrait, which must not have moved at all ---
const tall = await open(390, 844);
const portrait = await tall.page.evaluate(survey);
check(portrait.map > portrait.vh * 0.55,
  `portrait: the map is ${portrait.map} of ${portrait.vh}, which is less than it was`);
check(portrait.clipped.length === 0, `portrait: clipped ${portrait.clipped.join(', ')}`);
console.log(`portrait  ${portrait.vw}x${portrait.vh}: map ${portrait.map}px ` +
  `(${Math.round((100 * portrait.map) / portrait.vh)}% of the screen)`);
await tall.page.close();

// --- Landscape, on two phone shapes ---
for (const [w, h] of [[844, 390], [740, 360], [667, 375]]) {
  const { page, errors } = await open(w, h);
  const wide = await page.evaluate(survey);

  // THE BAR. Before the rule this was 32% at 844x390 and 26% at 740x360.
  check(wide.map > wide.vh * 0.6,
    `${w}x${h}: the map is ${wide.map} of ${wide.vh} — the panels are eating the game`);
  check(!wide.overflowsV && !wide.overflowsH, `${w}x${h}: the shell overflows`);
  check(wide.clipped.length === 0, `${w}x${h}: clipped ${wide.clipped.join(', ')}`);
  check(wide.covered.length === 0,
    `${w}x${h}: the mute or the gear is sitting on ${wide.covered.slice(0, 3).join(', ')}`);
  check(errors.length === 0, `${w}x${h}: the page reported ${errors[0] ?? ''}`);

  console.log(`landscape ${w}x${h}: map ${wide.map}px ` +
    `(${Math.round((100 * wide.map) / wide.vh)}% of the screen)`);

  // A fight and the colony mount into the same slot, so one rule serves all
  // three modes — but "should" is not "does".
  await page.evaluate(() => window.landnam.fight(2));
  await page.waitForTimeout(900);
  const field = await page.evaluate(survey);
  check(field.map > field.vh * 0.6,
    `${w}x${h}: on the field the map is ${field.map} of ${field.vh}`);
  check(field.clipped.length === 0, `${w}x${h}: on the field, clipped ${field.clipped.join(', ')}`);
  console.log(`          on the field: map ${field.map}px`);
  await page.close();
}

// --- The overlays, which may scroll but may not strand their button ---
{
  const { page } = await open(844, 390);
  for (const name of ['Chart', 'Band']) {
    await page.locator('button', { hasText: new RegExp(`^${name}$`) }).click();
    await page.waitForTimeout(400);
    const where = await page.evaluate(() => {
      const button = [...document.querySelectorAll('.overlay button')]
        .find((el) => /^(Close|Back)$/.test(el.textContent.trim()));
      if (!button) return null;
      button.scrollIntoView({ block: 'nearest' });
      const q = button.getBoundingClientRect();
      return { onScreen: q.bottom <= innerHeight + 1 && q.top >= -1, top: Math.round(q.top) };
    });
    check(where !== null, `${name}: no way out of the card at all`);
    check(where?.onScreen === true,
      `${name}: the way out cannot be scrolled onto a 390px screen (top ${where?.top})`);
    const out = page.locator('.overlay button', { hasText: /^(Close|Back)$/ }).first();
    await out.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  console.log('overlays: the way out of every card can be reached');
  await page.close();
}

await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`landscape: ${said}`);
  process.exit(1);
}
console.log('landscape OK — the map keeps the screen, and nothing is buried');

// The battlefield's share of a phone, and whether a hex still clears a thumb.
//
//   npm run build && node scripts/field.mjs
//
// This began as "the battlefield gets squeezed to a strip as the fight goes
// on", which is what `src/style.css` warns about at `.saga.fight`. **It does
// not.** Measured over fourteen turns of a real fight, the field holds 69% of
// a 390x844 screen and falls to 67% as the log fills — it is `flex: 1 1 auto`
// and genuinely budgeted, and the 74px cap on the fight log does exactly the
// job its comment claims. The worry was wrong and is recorded as wrong.
//
// What the measuring DID turn up is a rule this project has held since 5.2:
// touch targets are never smaller than 44px. A battle hex is a touch target —
// you tap one to move and another to strike — and the field always fits the
// WHOLE grid on screen (`preserveAspectRatio: meet` over the grid's bounds),
// so the hex size falls out of the screen size rather than being chosen.
//
// With height taken out of the question entirely (a 1400px-tall viewport) the
// ceiling is a pure function of width:
//
//     320px wide -> 42px hex     360px -> 47px     390px -> 51px     412px -> 54px
//
// So on a 320px phone the rule CANNOT be met by reclaiming vertical space;
// 42px is the most there is. Fixing that means letting the field pan and zoom
// like the world map — which it deliberately does not do, `src/style.css`
// says "the battlefield frames itself, so no panning — just tap" — or making
// the grid smaller. Both are design decisions, so this script measures 320
// and prints it, and holds the 44px line at the sizes the game is actually
// built for (CLAUDE.md: portrait, designed at 390x844).
//
// Playwright stays optional, as in scripts/offline.mjs.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('field: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`field: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

/**
 * The 44px rule is held at EVERY width now, 320 included.
 *
 * It used to be held only at 360 and up, and this script measured 320 and
 * printed it rather than asserting a line it could not reach — because a
 * 320px screen tops out at a 39px hex however much height it is given: the
 * whole grid always fits, so hex size falls out of screen width and no
 * layout work can move it.
 *
 * The field zooms to the rule and pans the rest now, so there is nothing left
 * to exempt and no width-dependent branch here any more.
 */
const TAP = 44;

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const survey = () => {
  const h = (s) => {
    const el = document.querySelector(s);
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  };
  const field = document.querySelector('svg.field');
  // Every ground hex is drawn at the same size, so the first one speaks for
  // all of them. Measured on SCREEN, after the SVG has scaled to fit.
  const hex = field?.querySelector('polygon')?.getBoundingClientRect();
  return {
    vh: innerHeight,
    vw: innerWidth,
    field: field ? Math.round(field.getBoundingClientRect().height) : 0,
    hex: hex ? Math.round(Math.min(hex.width, hex.height)) : 0,
    saga: h('.saga-slot'),
    lines: document.querySelectorAll('.saga-line').length,
    clipped: [...document.querySelectorAll('.shell button')]
      .filter((el) => {
        const q = el.getBoundingClientRect();
        return q.height > 0 && (q.bottom > innerHeight + 1 || q.right > innerWidth + 1);
      })
      .map((el) => el.textContent.trim().slice(0, 18)),
  };
};

const browser = await chromium.launch({ executablePath: CHROME });

for (const [w, h] of [[412, 915], [390, 844], [360, 640], [320, 568]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() => window.landnam.fight(3));
  await page.waitForTimeout(900);

  const opening = await page.evaluate(survey);

  // Fourteen turns, so the log fills up and takes whatever it is going to
  // take. This is the "squeezed as the fight goes on" claim, played out.
  for (let turn = 0; turn < 14; turn++) {
    const end = page.locator('.action-slot button', { hasText: /End turn/i }).first();
    const any = (await end.count()) ? end : page.locator('.action-slot button').first();
    if (await any.count()) await any.click().catch(() => {});
    await page.waitForTimeout(400);
    const card = page.locator('button', { hasText: /onward|continue|dismiss|close|go on|so be it|leave|back to/i }).first();
    if (await card.count()) { await card.click().catch(() => {}); await page.waitForTimeout(280); }
  }
  const late = await page.evaluate(survey);

  const share = (m) => Math.round((100 * m.field) / m.vh);

  console.log(
    `${w}x${h}: field ${opening.field}px (${share(opening)}%) -> ${late.field}px (${share(late)}%) ` +
      `after 14 turns, hex ${opening.hex}px -> ${late.hex}px, log ${opening.saga} -> ${late.saga}px ` +
      `(${late.lines} lines)`,
  );

  // The field must stay the biggest thing on the screen through a whole
  // fight. Half is a floor, not a target: it sits at 67% on the design size.
  check(late.field > late.vh * 0.5,
    `${w}x${h}: the field fell to ${share(late)}% of the screen by turn 14`);
  check(late.clipped.length === 0, `${w}x${h}: clipped ${late.clipped.join(', ')}`);

  // THE BAR THAT CATCHES THE REAL FAILURE. A hex being over 44px is the
  // rule, but at 390 and up the hex is bound by the screen's WIDTH, so no
  // amount of log growth can move it and the rule alone is insensitive to
  // exactly the thing this file is about. What the log actually does is take
  // from the field, so that is what is measured: a whole fight may not cost
  // the field more than a tenth of what it opened with.
  check(late.field >= opening.field * 0.9,
    `${w}x${h}: fourteen turns took the field from ${opening.field}px to ${late.field}px, ` +
      `${Math.round(100 - (100 * late.field) / opening.field)}% of it, and the log took it`);
  check(errors.length === 0, `${w}x${h}: the page reported ${errors[0] ?? ''}`);

  // A hex is something you tap. This is the same 44px rule the action bar has
  // had to keep since 5.2, applied to the thing the fight is played on — and
  // held at every width, including the one that cannot frame the whole grid
  // and now pans instead.
  check(opening.hex >= TAP,
    `${w}x${h}: a battle hex is ${opening.hex}px, under the ${TAP}px touch target`);
  check(late.hex >= TAP,
    `${w}x${h}: by turn 14 a battle hex is ${late.hex}px, under the ${TAP}px touch target`);

  await page.close();
}

await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`field: ${said}`);
  process.exit(1);
}
console.log(`field OK — the fight keeps the screen, and a hex clears ${TAP}px at every width`);

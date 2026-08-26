// The hearth bar: does raising a building visibly change the steading?
//
// That is 8.4's whole "Done when", and it is the one claim the hex colony map
// could never have made — it drew GROUND, and everything a player spends a
// season on lives in `settlement.built`, which that map never touched. So a
// unit test can prove the scene grew a building; only this can prove the
// document did.
//
// The three things that go wrong with a picture like this, all of which a
// screenshot would pass:
//
//   1. The building is in the DOM and painted at zero size, or off the
//      viewBox, or behind the ground it stands on.
//   2. Everybody in the yard is drawn in the same spot — this mode's oldest
//      bug, and invisible because the second figure IS there.
//   3. The scene rebuilds the brush every repaint, so opening the roster
//      repaints the country.
//
// Needs a coast build — `npm run hearth`.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('hearth: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`hearth: ${PAGE} is missing. Run \`npm run hearth\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(700);
const seed = page.locator('input').first();
if (await seed.count()) await seed.fill(process.env.SEED ?? 'hearth-bar');
await page.locator('button', { hasText: /Take the land/i }).first().click();
await page.waitForTimeout(800);

/**
 * Put a hall on the coast and open it.
 *
 * Through the debug hook rather than by playing forty days: what this bar is
 * about is the picture, and getting to a steading the long way is the
 * settling floor's business, not this one's.
 */
const founded = await page.evaluate(() => {
  const api = window.landnam;
  return api.settle ? api.settle() : null;
});
if (founded !== true) {
  console.error('hearth: could not put a steading on the coast, so this did NOT run.');
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(600);

// And WALK INTO IT. Matched on the deed's LABEL rather than anywhere in its
// text, because "Rest — pass the day at the steading" also contains the
// words and comes first in the sheet: the first draft clicked Rest, nothing
// happened, and the failure read as "the elevation is not on the page".
const act = page.locator('.action-slot button', { hasText: /^Act$/ }).first();
await act.click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(400);
const enter = page.locator('.overlay button')
  .filter({ has: page.locator('.deed-label', { hasText: /^The steading$/ }) })
  .first();
if (!(await enter.count())) {
  console.error('hearth: there is no way into the steading from the coast.');
  await browser.close();
  process.exit(1);
}
await enter.click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(700);

const survey = () => page.evaluate(() => {
  const svg = document.querySelector('svg.elevation');
  if (!svg) return null;
  const box = svg.getBoundingClientRect();
  const houses = [...svg.querySelectorAll('g.raised')].map((g) => {
    const r = g.getBoundingClientRect();
    return {
      id: (g.getAttribute('class') ?? '').replace(/.*raised-([a-z]+).*/, '$1'),
      building: (g.getAttribute('class') ?? '').includes('building'),
      w: Math.round(r.width),
      h: Math.round(r.height),
      // On the picture, not just in the document.
      inFrame: r.width > 0 && r.height > 0
        && r.right > box.left && r.left < box.right
        && r.bottom > box.top && r.top < box.bottom,
    };
  });
  const folk = [...svg.querySelectorAll('g.yard-folk')].map((g) => {
    const r = g.getBoundingClientRect();
    return `${Math.round(r.left)},${Math.round(r.top)}`;
  });
  return {
    houses,
    folk,
    spots: new Set(folk).size,
    label: svg.getAttribute('aria-label') ?? '',
    paint: !!svg.querySelector('foreignObject.field-paint canvas'),
  };
});

const bare = await survey();
if (!bare) {
  console.error('hearth: the steading is not an elevation — no svg.elevation on the page');
  await browser.close();
  process.exit(1);
}

console.log(
  `bare ground: ${bare.houses.length} standing · ${bare.folk.length} in the yard ` +
    `(${bare.spots} distinct spots) · "${bare.label}"`,
);

check(bare.paint, 'the steading’s country is not painted');
check(bare.folk.length > 1, `only ${bare.folk.length} of the band are in the yard`);
// The oldest bug in this mode: the second figure IS drawn, exactly under the
// first, so a screenshot cannot tell you.
check(bare.spots === bare.folk.length,
  `${bare.folk.length} in the yard but only ${bare.spots} distinct spots`);

// THE BAR. Raise something and look again.
const raised = await page.evaluate(() => {
  const api = window.landnam;
  if (!api.build) return false;
  api.build('longhouse');
  return true;
});
if (!raised) {
  check(false, 'no way to raise a building from the debug hook, so this did NOT run');
} else {
  await page.waitForTimeout(600);
  const after = await survey();
  console.log(
    `after raising: ${after.houses.length} standing — ` +
      after.houses.map((h) => `${h.id} ${h.w}x${h.h}${h.building ? ' (going up)' : ''}`).join(', '),
  );
  check(after.houses.length > bare.houses.length,
    `raising a building changed nothing: ${bare.houses.length} before, ${after.houses.length} after`);
  for (const h of after.houses) {
    check(h.w > 0 && h.h > 0, `"${h.id}" is drawn at ${h.w}x${h.h} — nothing to see`);
    check(h.inFrame, `"${h.id}" is drawn outside the picture`);
  }
  check(after.label !== bare.label,
    'the steading tells a screen reader the same thing after building as before');
}

check(errors.length === 0, `the page reported ${errors[0] ?? ''}`);

await browser.close();
if (fail.length) {
  for (const said of fail) console.error(`hearth: ${said}`);
  process.exit(1);
}
console.log('hearth: raising a building changes the steading you walk into');

// The half of the repaint bar that only a browser can hold.
//
//   npm run build && node scripts/repaint.mjs
//
// `test/repaint.test.ts` pins the DECISION — which hexes a repaint owes a
// node, which owe two attributes, which should go. It is pure, it runs in
// `npm test`, and it cannot see a document. So it would pass in full while
// the renderer wired the answer up wrongly and drew the country twice, or
// stopped drawing it at all.
//
// This is the other half: load a real save into the BUILT page, walk the
// band, and check the map against what it must be. The claim being defended
// is that the terrain layer holds one node per charted hex and no more —
// which is precisely what the old renderer could not say, because it cleared
// and rebuilt the layer on every action.
//
// Needs Playwright, which this project deliberately does not depend on — see
// scripts/offline.mjs for the same trade. If it is not installed this says
// so and exits without pretending to have passed.

import { existsSync, readFileSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('repaint: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`repaint: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

// Six neighbours of a pointy-top hex at HEX_SIZE 26 and the opening zoom of
// 1.35, in screen pixels from the middle of the map. A fixed itinerary, so
// two runs of this script walk the same country.
const STEPS = [[0, -53], [61, -26], [61, 26], [0, 53], [-61, 26], [-61, -26],
               [0, -53], [61, -26], [0, 53], [-61, 26], [61, 26], [0, -53]];

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(600);
await page.locator('button', { hasText: /Take the land/i }).first().click();
await page.waitForTimeout(700);

/** What the map is holding: one entry per layer, plus the charted count. */
const readMap = () => page.evaluate(() => {
  const map = document.querySelector('svg.map');
  const layers = [...map.querySelectorAll(':scope > g')];
  const hexes = [...(layers[0]?.children ?? [])];
  return {
    terrain: hexes.length,
    lit: hexes.filter((n) => n.getAttribute('opacity') === '1').length,
    rivers: layers[1]?.childElementCount ?? 0,
    patterns: [...map.querySelectorAll('pattern')].map((n) => n.id),
    // Two nodes on one hex is what a renderer that forgot its cache looks
    // like, and it is invisible in a screenshot — the second covers the first.
    duplicates: hexes.length - new Set(hexes.map((n) => n.getAttribute('points'))).size,
  };
});

const box = await page.locator('svg.map').boundingBox();
const opening = await readMap();
check(opening.terrain > 0, 'the map charted nothing at all on the first paint');
// The claim here was `=== 16`, which went red the day the deep got its own
// pair — eight terrains became eight terrains and a deep, and 16 became 18.
// A count is the wrong thing to pin: it has to be restated every time art is
// added, and nobody remembers to. What actually matters is the invariant the
// patterns are FOR — every terrain fill is stamped twice from the same marks,
// bright and dim, so a hex the band walked away from is the same ground it
// was. So pin the twinning, which cannot drift.
{
  const ids = opening.patterns;
  const lit = ids.filter((id) => !id.endsWith('-dim'));
  const dim = new Set(ids.filter((id) => id.endsWith('-dim')));
  const stray = ids.filter((id) => !id.startsWith('terrain-'));
  const orphans = lit.filter((id) => !dim.has(`${id}-dim`));
  check(ids.length > 0, 'the map defined no terrain patterns at all');
  check(stray.length === 0, `patterns that are not terrain fills: ${stray.join(', ')}`);
  check(orphans.length === 0, `terrain fills with no dim twin: ${orphans.join(', ')}`);
  check(lit.length * 2 === ids.length, `${lit.length} lit fills but ${ids.length} patterns — a dim without a light`);
}

const growth = [opening.terrain];
for (const [dx, dy] of STEPS) {
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
  await page.waitForTimeout(400);
  const card = page.locator('button', { hasText: /onward|continue|dismiss|close|go on|so be it|leave/i }).first();
  if (await card.count()) { await card.click().catch(() => {}); await page.waitForTimeout(280); }

  const map = await readMap();
  check(map.duplicates === 0, `${map.duplicates} hexes drawn more than once`);
  check(map.terrain >= growth[growth.length - 1], 'the chart lost country it had already seen');
  growth.push(map.terrain);
}

const walked = await readMap();
// The band's sight moves with it, so country it has left has to go dim. If
// nothing ever dims, the relight path is not running and the map is lying
// about what can be seen from where the band is standing.
check(walked.lit < walked.terrain, 'every charted hex is still lit after walking');
check(walked.lit > 0, 'nothing is lit — the band can see nothing from where it stands');

// The whole point. Repaints that chart nothing must add nothing, however
// many of them there are.
const held = walked.terrain;
for (let i = 0; i < 6; i++) {
  await page.mouse.click(box.x + 12, box.y + 12);
  await page.waitForTimeout(220);
}
const after = await readMap();
check(after.terrain === held,
  `the terrain layer grew from ${held} to ${after.terrain} on repaints that charted nothing`);

check(errors.length === 0, `the page reported ${errors.length}: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();

console.log(`repaint: charted ${growth.join(' -> ')}, ${walked.lit} lit of ${walked.terrain}, ${walked.rivers} rivers`);
if (fail.length > 0) {
  for (const said of fail) console.error(`repaint: ${said}`);
  process.exit(1);
}
console.log('repaint OK — one node per charted hex, and a still map costs nothing');

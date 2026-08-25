// The half of the repaint bar that only a browser can hold — now for BOTH
// renderers.
//
//   npm run build && node scripts/repaint.mjs
//
// `test/repaint.test.ts` pins the DECISION — which hexes a repaint owes a
// node, which owe two attributes, which should go. It is pure, it runs in
// `npm test`, and it cannot see a document. So it would pass in full while
// the renderer wired the answer up wrongly and drew the country twice, or
// stopped drawing it at all.
//
// This is the other half: load the BUILT page, walk the band, and check the
// map against what it must be.
//
// It used to do that by counting children of the terrain layer. That worked
// while there was one renderer and went silent the moment there were two —
// the painted map hides those layers, so the bar would have passed a
// backdrop that painted every hex twice, or grew without bound, or never
// dimmed anything. A bar that cannot see the thing it is guarding is not a
// bar.
//
// So the renderer answers for itself, through `window.landnam.drawn()`, and
// the same four claims are made of both:
//
//   - a hex is built ONCE, and nothing is held twice;
//   - the chart never loses country it has already seen;
//   - country the band has walked away from goes dim;
//   - a repaint that charts nothing costs nothing, however many go past.
//
// The DOM is still read where it is an INDEPENDENT witness — the SVG path
// can leave a node behind that its own bookkeeping has forgotten, and only
// the document knows. The renderer's word is checked against it, not
// trusted instead of it.
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
const fail = [];
const said = [];

/** Walk the same itinerary under one backend and hold it to the same claims. */
async function audit(backend) {
  const check = (ok, why) => { if (!ok) fail.push(`${backend}: ${why}`); };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`file://${process.cwd()}/${PAGE}${backend === 'oil' ? '?paint' : ''}`);
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(700);

  /** What the RENDERER says it is holding. True of either backend. */
  const held = () => page.evaluate(() => window.landnam.drawn());
  /** What the DOCUMENT says — an independent witness, where there is one. */
  const witness = () => page.evaluate(() => {
    const map = document.querySelector('svg.map');
    const hexes = [...(map.querySelectorAll(':scope > g')[0]?.children ?? [])];
    return {
      nodes: hexes.length,
      // Two nodes on one hex is what a renderer that forgot its cache looks
      // like, and it is invisible in a screenshot — the second covers the first.
      twins: hexes.length - new Set(hexes.map((n) => n.getAttribute('points'))).size,
      patterns: [...map.querySelectorAll('pattern')].map((n) => n.id),
    };
  });
  const clearCard = async () => {
    const card = page.locator('button', { hasText: /onward|continue|dismiss|close|go on|so be it|leave/i }).first();
    if (await card.count()) { await card.click().catch(() => {}); await page.waitForTimeout(280); }
  };

  const box = await page.locator('svg.map').boundingBox();
  const opening = await held();
  check(opening !== null, 'the renderer answered nothing at all');
  check(opening.backend === backend, `asked for ${backend} and got ${opening?.backend}`);
  check(opening.charted > 0, 'the map charted nothing at all on the first paint');

  // Terrain patterns are the SVG map's own business, and it defines them
  // whichever backend is showing. The claim was `=== 16` until the deep got
  // its own pair and it went red: a count has to be restated every time art
  // is added and nobody remembers to. What the patterns are FOR cannot
  // drift — every terrain fill is stamped twice from the same marks, bright
  // and dim, so a hex the band walked away from is the ground it was.
  {
    const ids = (await witness()).patterns;
    const bright = ids.filter((id) => !id.endsWith('-dim'));
    const dim = new Set(ids.filter((id) => id.endsWith('-dim')));
    const stray = ids.filter((id) => !id.startsWith('terrain-'));
    const orphans = bright.filter((id) => !dim.has(`${id}-dim`));
    check(ids.length > 0, 'the map defined no terrain patterns at all');
    check(stray.length === 0, `patterns that are not terrain fills: ${stray.join(', ')}`);
    check(orphans.length === 0, `terrain fills with no dim twin: ${orphans.join(', ')}`);
    check(bright.length * 2 === ids.length,
      `${bright.length} lit fills but ${ids.length} patterns — a dim without a light`);
  }

  const growth = [opening.charted];
  for (const [dx, dy] of STEPS) {
    await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await page.waitForTimeout(400);
    await clearCard();

    const now = await held();
    check(now.duplicates === 0, `${now.duplicates} hexes built a different number of times than the repaint owed them`);
    check(now.charted >= growth[growth.length - 1], 'the chart lost country it had already seen');
    if (backend === 'svg') {
      const seen = await witness();
      check(seen.twins === 0, `${seen.twins} hexes drawn more than once in the document`);
      check(seen.nodes === now.charted,
        `the renderer holds ${now.charted} hexes and the document has ${seen.nodes}`);
    }
    growth.push(now.charted);
  }

  const walked = await held();
  // The band's sight moves with it, so country it has left has to go dim. If
  // nothing ever dims, the relight path is not running and the map is lying
  // about what can be seen from where the band is standing.
  check(walked.lit < walked.charted, 'every charted hex is still lit after walking');
  check(walked.lit > 0, 'nothing is lit — the band can see nothing from where it stands');

  // The whole point. Repaints that chart nothing must cost nothing, however
  // many of them there are — measured as WORK done, not as nodes present,
  // because a renderer that rebuilt every node and replaced it would keep
  // the count identical and the phone hot.
  //
  // The repaints have to be REAL. This used to tap dead space in the corner
  // of the map, which the app is entitled to ignore entirely — so a backdrop
  // that threw its cache away and repainted the whole chart every turn sailed
  // through, because nothing ever asked it to paint. `stock` commits a state
  // and re-renders, exactly as a dispatch does, and charts nothing.
  const spent = walked.work;
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate((n) => window.landnam.stock(200 + n, 200 + n), i);
    await page.waitForTimeout(200);
  }
  const after = await held();
  check(after.charted === walked.charted,
    `the chart grew from ${walked.charted} to ${after.charted} on repaints that charted nothing`);
  check(after.work === spent,
    `${after.work - spent} more hexes were built on repaints that charted nothing`);

  // Rebuild the view from scratch over country that is already charted.
  //
  // Every hex the band walked past is now REMEMBERED, so a remount charts a
  // pile of hexes in the dark in one go — a path the walk above never takes,
  // because country is always first seen from close enough to be lit. It is
  // the same path a loaded save takes, and it is where a renderer that only
  // ever glazes on the way OUT of the light quietly stops glazing at all.
  await page.evaluate((paint) => window.landnam.paint(paint), backend === 'oil');
  await page.waitForTimeout(500);
  const rebuilt = await held();
  check(rebuilt.backend === backend, `the remount changed backend to ${rebuilt.backend}`);
  check(rebuilt.charted === after.charted,
    `a remount charted ${rebuilt.charted} where the view held ${after.charted}`);
  check(rebuilt.duplicates === 0,
    `${rebuilt.duplicates} hexes built a different number of times than the remount owed them`);
  check(rebuilt.lit < rebuilt.charted, 'a remount lit every hex — remembered country came back to life');
  check(rebuilt.lit > 0, 'a remount lit nothing at all');

  check(errors.length === 0, `the page reported ${errors.length}: ${errors.slice(0, 3).join(' | ')}`);
  said.push(`${backend}: charted ${growth.join(' -> ')}, ${walked.lit} lit of ${walked.charted}, `
    + `${walked.work} built, ${rebuilt.lit} lit of ${rebuilt.charted} after a remount`);
  await page.close();
}

for (const backend of ['svg', 'oil']) await audit(backend);

await browser.close();

for (const line of said) console.log(`repaint: ${line}`);
if (fail.length > 0) {
  for (const why of fail) console.error(`repaint: ${why}`);
  process.exit(1);
}
console.log('repaint OK — both renderers build each hex once, and a still map costs nothing');

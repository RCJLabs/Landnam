// The sea bar: what the map PROMISES afloat is what the knarr can do.
//
//   npm run build && node scripts/sea.mjs
//
// Two things were wrong and both were invisible to the unit tests, because
// both lived in the gap between the renderer and the sim:
//
//   * The map drew the world's rim as ordinary shallow water and the sim
//     refused every crossing into it — 1332 hexes of a lie, and the player's
//     report of it was "some hexes aren't travelable even when you are right
//     next to them, mainly on shallow water".
//   * The knarr's day of rowing is three hexes (ROW_REACH). The map drew
//     markers on immediate neighbours only, so the reach the ship exists FOR
//     was never offered — 60 legal moves over 15 afloat turns, undrawn.
//
// This drives a real band onto real water in the BUILT page and reads the
// markers back out of the document, because that is the only place the two
// halves meet.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const SEED = process.env.SEED ?? 'sea-bar-seed';
/** World units between adjacent hex centres at HEX_SIZE 26: sqrt(3) * 26. */
const STEP = Math.sqrt(3) * 26;

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('sea: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`sea: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(700);

const seedBox = page.locator('input').first();
if (await seedBox.count()) await seedBox.fill(SEED);
for (const label of ['Take the land', 'Begin', 'Sail', 'Set out']) {
  const b = page.locator('button', { hasText: label }).first();
  if (await b.count()) {
    await b.click();
    break;
  }
}
await page.waitForTimeout(700);

/** Clear anything covering the map, the way reach.mjs learned to. */
async function clearCards() {
  for (let i = 0; i < 8; i++) {
    const card = page.locator('.lesson-card button, .card button').first();
    if (!(await card.count())) break;
    await card.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(180);
  }
}

/**
 * The map as the document has it: the band's world position, and every move
 * marker with its world position and whether it sits on water.
 */
const readMap = async () =>
  page.evaluate(() => {
    const svg = document.querySelector('svg.map');
    if (!svg) return null;
    const token = svg.querySelector('.party-token');
    const m = token?.getAttribute('transform')?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    if (!m) return null;
    const at = { x: parseFloat(m[1]), y: parseFloat(m[2]) };

    const ctm = svg.getScreenCTM();
    const toScreen = (x, y) => {
      const p = svg.createSVGPoint();
      p.x = x;
      p.y = y;
      return p.matrixTransform(ctm);
    };

    const markers = [];
    for (const poly of svg.querySelectorAll('polygon[stroke-dasharray="5 5"]')) {
      const pts = poly
        .getAttribute('points')
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const s = toScreen(cx, cy);
      // What ground is under it: the terrain polygon's fill names its pattern.
      let ground = null;
      for (const el of document.elementsFromPoint(s.x, s.y)) {
        const fill = el.getAttribute?.('fill') ?? '';
        if (fill.startsWith('url(#terrain-')) {
          ground = fill.slice(9, -1);
          break;
        }
      }
      markers.push({ x: cx, y: cy, sx: s.x, sy: s.y, ground, onScreen: s.x > 0 && s.x < 390 && s.y > 0 && s.y < 844 });
    }
    return { at, markers, afloat: !!svg.querySelector('.party-token.afloat') };
  });

await clearCards();

// Walk to the water. The band lands on a coast, so a water marker is usually
// one or two steps away; take the first one offered each turn.
let afloat = false;
let map = null;
for (let turn = 0; turn < 14 && !afloat; turn++) {
  await clearCards();
  map = await readMap();
  if (!map) break;
  if (map.afloat) {
    afloat = true;
    break;
  }
  const water = map.markers.filter((k) => k.ground?.includes('ocean') && k.onScreen);
  const target = water[0] ?? map.markers.filter((k) => k.onScreen)[0];
  if (!target) break;
  await page.mouse.click(target.sx, target.sy);
  await page.waitForTimeout(500);
}

await clearCards();
map = await readMap();

if (!map) {
  console.error('sea: could not read the map at all.');
  process.exit(1);
}
if (!map.afloat) {
  console.error('sea: never got the band afloat, so the reach was NOT checked.');
  process.exit(1);
}

const spans = map.markers.map((k) => Math.hypot(k.x - map.at.x, k.y - map.at.y) / STEP);
const far = spans.filter((d) => d > 1.5);
const deepOffered = map.markers.filter((k) => k.ground?.includes('ocean-deep'));

console.log(`sea: afloat with ${map.markers.length} moves offered`);
console.log(`  spans (hexes): ${spans.map((d) => d.toFixed(1)).sort().join(', ')}`);
console.log(`  beyond one hex: ${far.length}`);
console.log(`  offered on DEEP water: ${deepOffered.length}`);

let bad = false;
if (far.length === 0) {
  console.error("sea: FAIL — afloat, and every move offered is a single step. The knarr's reach is invisible again.");
  bad = true;
}
// The other half: the map must never offer what the sim refuses. Deep water
// is exactly the water `moveEffort` returns null for.
if (deepOffered.length > 0) {
  console.error(`sea: FAIL — ${deepOffered.length} markers sit on water drawn as open sea, which cannot be entered.`);
  bad = true;
}
if (errors.length) {
  console.error(`sea: page errors: ${errors.join(' | ')}`);
  bad = true;
}

await page.screenshot({ path: process.env.SHOT ?? '/tmp/sea-reach.png' });
await browser.close();
if (bad) process.exit(1);
console.log('sea: OK — the map offers the whole day of rowing, and no water it cannot row.');

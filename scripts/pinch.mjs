// Does the map actually hold the point you are pinching?
//
//   npm run build && node scripts/pinch.mjs
//
// `test/camera.test.ts` pins the arithmetic — zooming about a screen point
// leaves the world under that point where it was — across the corners, the
// edges, sixty small steps and both clamps. What it cannot check is that the
// renderer FEEDS it the right things: the midpoint of the fingers rather than
// one of them, offsets inside the element rather than raw client coordinates,
// the camera before the zoom rather than after. Every one of those is a
// plausible wiring mistake that leaves all fifteen unit tests green.
//
// So this pinches the real page with two real pointers and reads the answer
// out of the viewBox, which is the only thing the map's behaviour ultimately
// is. Playwright stays optional, as in scripts/offline.mjs.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('pinch: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`pinch: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(600);
await page.locator('button', { hasText: /Take the land/i }).first().click();
await page.waitForTimeout(700);

/** The world point under a screen offset, read straight off the viewBox. */
const worldUnder = (ox, oy) => page.evaluate(([x, y]) => {
  const map = document.querySelector('svg.map');
  const [vx, vy, vw, vh] = map.getAttribute('viewBox').split(/\s+/).map(Number);
  const rect = map.getBoundingClientRect();
  return { x: vx + (x / rect.width) * vw, y: vy + (y / rect.height) * vh, zoom: rect.width / vw };
}, [ox, oy]);

/** Two fingers, spreading about a fixed centre. */
async function pinchAbout(cx, cy, from, to, steps = 24) {
  await page.evaluate(([cx, cy, from]) => {
    const map = document.querySelector('svg.map');
    const r = map.getBoundingClientRect();
    const send = (type, id, x, y) => map.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch',
    }));
    map.setPointerCapture = () => {};
    send('pointerdown', 1, cx - from / 2, cy);
    send('pointerdown', 2, cx + from / 2, cy);
  }, [cx, cy, from]);

  for (let i = 1; i <= steps; i++) {
    const gap = from + ((to - from) * i) / steps;
    await page.evaluate(([cx, cy, gap]) => {
      const map = document.querySelector('svg.map');
      const r = map.getBoundingClientRect();
      const send = (id, x) => map.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: id, clientX: r.left + x, clientY: r.top + cy, bubbles: true, pointerType: 'touch',
      }));
      send(1, cx - gap / 2);
      send(2, cx + gap / 2);
    }, [cx, cy, gap]);
  }

  await page.evaluate(() => {
    const map = document.querySelector('svg.map');
    for (const id of [1, 2]) {
      map.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true, pointerType: 'touch' }));
    }
  });
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

// Deliberately NOT the middle of the screen. The centre is the one place the
// old renderer was already right, so a check there proves nothing.
// Out then in, because the zoom clamps at both ends and a case that starts
// already clamped proves nothing — as this script found out about itself.
for (const [name, cx, cy, from, to] of [['top left, out', 90, 150, 80, 200],
                                        ['bottom right, in', 300, 620, 200, 80]]) {
  const before = await worldUnder(cx, cy);
  await pinchAbout(cx, cy, from, to);
  const after = await worldUnder(cx, cy);
  const slip = Math.hypot(after.x - before.x, after.y - before.y);
  // A hex is 26 units across. Anything approaching that is a hex sliding out
  // from under the fingers, which is the thing being fixed.
  const moved = to > from ? after.zoom > before.zoom * 1.3 : after.zoom < before.zoom * 0.77;
  check(moved, `${name}: the pinch did not change the zoom (${before.zoom} -> ${after.zoom})`);
  check(slip < 1, `${name}: the world under the fingers slipped ${slip.toFixed(2)} units`);
  console.log(`pinch ${name}: zoom ${before.zoom.toFixed(2)} -> ${after.zoom.toFixed(2)}, slipped ${slip.toFixed(3)} units`);
}

check(errors.length === 0, `the page reported ${errors.length}: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`pinch: ${said}`);
  process.exit(1);
}
console.log('pinch OK — the map holds the point between the fingers');

// Breaks ground in the BUILT page and photographs the road, because a way
// the player cannot see is a day spent on nothing.
import { existsSync } from 'node:fs';
const PAGE = 'dist/app.html';
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('way: playwright-core is not installed, so this did NOT run.'); process.exit(2);
}
if (!existsSync(PAGE)) { console.error('way: build first'); process.exit(2); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(700);
const seed = page.locator('input').first();
if (await seed.count()) await seed.fill(process.env.SEED ?? 'way-bar');
await page.locator('button', { hasText: 'Take the land' }).first().click();
await page.waitForTimeout(700);

async function clearCards() {
  for (let i = 0; i < 8; i++) {
    const b = page.locator('.lesson-card button, .card button').first();
    if (!(await b.count())) break;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function act() {
  await clearCards();
  const a = page.locator('button', { hasText: 'Act' }).first();
  if (await a.count()) { await a.click(); await page.waitForTimeout(300); }
}

// Break ground where we stand, then step on and break the next: a road is a
// chain, so one hex proves nothing.
let cut = 0;
for (let round = 0; round < 3; round++) {
  await act();
  const breakBtn = page.locator('button', { hasText: 'Break ground' }).first();
  if (await breakBtn.count()) {
    const blurb = await page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, ' ');
      const m = t.match(/Break ground (.*?)(?: Forage | Camp | Hunt | Fish |$)/);
      return m ? m[1].trim().slice(0, 150) : null;
    });
    if (round === 0) console.log(`way: the sheet says — ${blurb}`);
    await breakBtn.click();
    await page.waitForTimeout(600);
    cut++;
  }
  await clearCards();
  // Step to a neighbour so the next cut extends the road.
  const marker = page.locator('polygon[stroke-dasharray="5 5"]').first();
  if (await marker.count()) {
    const box = await marker.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
    }
  }
}
await clearCards();
const drawn = await page.evaluate(() => document.querySelectorAll('.made-way').length);
console.log(`way: ${cut} hexes broken, ${drawn} drawn on the map`);
await page.screenshot({ path: process.env.SHOT ?? '/tmp/way.png' });
await browser.close();

let bad = false;
if (cut === 0) { console.error('way: the deed never appeared — nothing was measured.'); bad = true; }
if (drawn < cut) { console.error(`way: FAIL — ${cut} broken but only ${drawn} drawn.`); bad = true; }
if (errors.length) { console.error('way: page errors: ' + errors.join(' | ')); bad = true; }
if (bad) process.exit(1);
console.log('way: OK — the ground is broken and the road is on the map.');

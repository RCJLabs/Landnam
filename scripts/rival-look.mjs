// Loads the rival fixture into the built page and photographs the map.
import { readFileSync, existsSync } from 'node:fs';
const PAGE = 'dist/app.html';
const SAVE = process.env.SAVE;
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('rival-look: playwright-core missing'); process.exit(2);
}
if (!existsSync(PAGE)) { console.error('rival-look: build first'); process.exit(2); }
const save = readFileSync(SAVE, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.evaluate((s) => localStorage.setItem('landnam_save', s), save);
await page.reload();
await page.waitForTimeout(1000);
// The title screen OFFERS the save rather than resuming it.
const cont = page.locator('button', { hasText: 'Continue' }).first();
if (await cont.count()) await cont.click();
await page.waitForTimeout(900);
for (let i = 0; i < 6; i++) {
  const b = page.locator('.lesson-card button, .card button').first();
  if (!(await b.count())) break;
  await b.click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(200);
}
const marks = await page.evaluate(() => ({
  halls: document.querySelectorAll('.rival-hall').length,
  fences: [...document.querySelectorAll('polygon[stroke="#b23b2e"]')].length,
  skerries: document.querySelectorAll('.skerry').length,
  warned: [...document.querySelectorAll('polygon[stroke="#d3a441"]')].length,
}));
console.log(`look: ${marks.halls} hall, ${marks.fences} fenced, ${marks.skerries} skerries, ${marks.warned} warned crossings`);
if (errors.length) console.error('page errors:', errors.join(' | '));
await page.screenshot({ path: process.env.SHOT ?? '/tmp/rival.png' });
await browser.close();

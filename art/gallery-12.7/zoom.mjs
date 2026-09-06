import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const ids = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.setContent(`<!doctype html><meta charset="utf-8">${readFileSync('index.html','utf8')}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
for (const id of ids) {
  const el = await p.$(`.plate[data-id="${id}"]`);
  await el.screenshot({ path: `zoom-${id}.png` });
}
await b.close();

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
let bad = 0;
for (const [w, h] of [[390, 844], [320, 568], [1280, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.location()?.url ?? '')) errs.push(`console: ${m.text()} @ ${m.location()?.url}`); });
  await p.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${readFileSync('index.html','utf8')}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const plates = [...document.querySelectorAll('.plate')];
    return {
      panels: document.querySelectorAll('.panel').length,
      empty: plates.filter((el) => !el.firstElementChild).map((el) => el.dataset.id),
      blankCanvas: [...document.querySelectorAll('canvas')].map((c) => {
        const x = c.getContext('2d');
        if (!c.width) return 'zero-width';
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4000) seen.add(`${d[i]},${d[i+1]},${d[i+2]}`);
        return seen.size;
      }),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
        ? `${document.documentElement.scrollWidth} > ${window.innerWidth}` : null,
      seed: document.getElementById('prov-seed').textContent,
      logLines: document.querySelectorAll('#prov-log li').length,
      nodes: document.querySelectorAll('.plate *').length,
    };
  });
  const ok = r.panels === 10 && r.empty.length === 0 && !r.overflow && r.seed !== '—'
    && r.logLines > 0 && r.blankCanvas.every((n) => typeof n === 'number' && n > 3) && errs.length === 0;
  if (!ok) bad += 1;
  console.log(`${w}x${h}: ${ok ? 'PASS' : 'FAIL'} panels=${r.panels} empty=[${r.empty}] canvasColours=[${r.blankCanvas}] overflow=${r.overflow} seed=${r.seed} log=${r.logLines} plateNodes=${r.nodes}`);
  for (const e of errs) console.log(`    ${e}`);
  if (w === 1280) await p.screenshot({ path: 'shot.png', fullPage: true });
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);

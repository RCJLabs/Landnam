// The steading bar: is the painted steading a steading, and does looking at
// it twice cost twice?
//
// Three claims, none of which a unit test can reach, because all three are
// about what ends up in a document:
//
//   1. The painting lands ON the ground it is a painting of. An <image> at
//      the wrong bounds is not an error, it is a steading with the paint
//      slid off it, and nothing throws.
//   2. Everybody with a job is drawn, and no two of them in the same place.
//      That is the bug this mode has had twice — the second figure IS drawn,
//      exactly underneath the first, so a screenshot cannot tell you.
//   3. Moving people does not reload the brush. describeColony rebuilds its
//      whole description every repaint; if the painting went with it, every
//      tap on the roster would repaint the ground.
//
// Runs both backends, because 1 and 2 are claims about the drawn steading
// too — the SVG one has to keep passing them.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('steading: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) { console.error('steading: build first'); process.exit(2); }

const SEED = 'raven-skerry-317';
const ONWARD = { hasText: /^(Onward|Go on|Aye|Very well|Begin|Continue)$/ };
const STEADING = { hasText: /^The steading/ };
const JOB = { hasText: /^(Farmer|Hunter|Woodcutter|Builder|Warrior)/ };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const fails = [];
const say = (line) => console.log(`steading: ${line}`);

async function audit(backend) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${process.cwd()}/${PAGE}${backend === 'oil' ? '?paint' : ''}`);
  await page.waitForTimeout(700);

  const clear = async () => {
    for (let i = 0; i < 10; i += 1) {
      const b = page.locator('button', ONWARD).first();
      if (!(await b.count())) break;
      await b.click().catch(() => {});
      await page.waitForTimeout(260);
    }
  };

  const seed = page.locator('input').first();
  if (await seed.count()) await seed.fill(SEED);
  await page.locator('button', { hasText: 'Take the land' }).first().click();
  await page.waitForTimeout(900);
  await clear();
  const settled = await page.evaluate(() => window.landnam?.settle?.() ?? false);
  if (!settled) { fails.push(`${backend}: could not put a steading up`); await page.close(); return; }
  await page.waitForTimeout(700);
  await clear();
  if (!(await page.locator('button', STEADING).first().isVisible().catch(() => false))) {
    await page.locator('button', { hasText: 'Act' }).first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.locator('button', STEADING).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(900);
  await clear();
  await page.waitForTimeout(400);

  // Everyone to work, over jobs that SHARE plots — hunter and woodcutter both
  // work the wood, which is the case that drew two people as one.
  let put = 0;
  for (let i = 0; i < 10; i += 1) {
    const who = page.locator('button', { hasText: /idle/ }).first();
    if (!(await who.count())) break;
    await who.click().catch(() => {});
    await page.waitForTimeout(220);
    const job = page.locator('button', JOB).nth(i % 3);
    if (!(await job.count())) break;
    await job.click().catch(() => {});
    await page.waitForTimeout(220);
    put += 1;
  }
  await page.waitForTimeout(500);

  const seen = await page.evaluate(() => {
    const svg = document.querySelector('svg.steading-map');
    if (!svg) return null;
    const fo = svg.querySelector('foreignObject.steading-paint');
    const num = (el, a) => Number(el.getAttribute(a));
    const workers = [...svg.querySelectorAll('.worker')].map((g) => {
      const c = g.querySelector('circle');
      return `${c?.getAttribute('cx')},${c?.getAttribute('cy')}`;
    });
    const canvas = fo?.querySelector('canvas');
    // Is there actually paint on it, or is it a blank rectangle? Read a band
    // of pixels back rather than trusting that the brush was called.
    let inked = 0;
    if (canvas) {
      const g = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      if (g && w > 0 && h > 0) {
        const d = g.getImageData(0, Math.floor(h / 2), w, 1).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) inked += 1;
      }
    }
    return {
      viewBox: (svg.getAttribute('viewBox') ?? '').split(' ').map(Number),
      plots: svg.querySelectorAll('polygon').length,
      workers,
      image: fo ? { x: num(fo, 'x'), y: num(fo, 'y'), w: num(fo, 'width'), h: num(fo, 'height'),
                    canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
                    inked, across: canvas ? canvas.width : 0 } : null,
    };
  });
  if (!seen) { fails.push(`${backend}: no steading on screen`); await page.close(); return; }

  // 1. The painting is on the ground it paints.
  if (backend === 'oil') {
    const [vx, vy, vw, vh] = seen.viewBox;
    const img = seen.image;
    if (!img) fails.push('oil: the steading is painted but no painting was mounted');
    else {
      const off = Math.max(Math.abs(img.x - vx), Math.abs(img.y - vy), Math.abs(img.w - vw), Math.abs(img.h - vh));
      if (off > 0.001) fails.push(`oil: the painting sits ${off.toFixed(2)} world units off the ground it paints`);
      if (!img.canvas) fails.push('oil: the frame is there but carries no canvas');
      else if (img.inked < img.across * 0.5) {
        fails.push(`oil: only ${img.inked} of ${img.across} pixels across the middle carry paint`);
      } else {
        say(`oil: ${img.canvas} of paint over ${seen.plots} plots, ${img.inked}/${img.across} inked across the middle, on the ground to within 0.001`);
      }
    }
  } else if (seen.image) {
    fails.push('svg: the drawn steading mounted a painting');
  }

  // 2. Everybody works somewhere, and no two in one place.
  if (put < 2) fails.push(`${backend}: only ${put} could be put to work, so nothing was checked`);
  if (seen.workers.length !== put) {
    fails.push(`${backend}: ${put} were put to work and ${seen.workers.length} are drawn`);
  }
  const places = new Set(seen.workers);
  if (places.size !== seen.workers.length) {
    fails.push(`${backend}: ${seen.workers.length} drawn in ${places.size} places — somebody is underneath somebody`);
  } else {
    say(`${backend}: ${seen.workers.length} at work, ${places.size} places, none hidden`);
  }

  // 3. Moving people does not reload the brush.
  if (backend === 'oil') {
    const before = await page.evaluate(() => window.landnam?.steading?.() ?? null);
    // Work and Build are two views of one steading: switching between them
    // repaints it and cannot possibly have changed the ground.
    for (let i = 0; i < 3; i += 1) {
      for (const tab of ['Build', 'Work']) {
        const b = page.locator('button', { hasText: new RegExp(`^${tab}$`) }).first();
        if (!(await b.count())) continue;
        await b.click().catch(() => {});
        await page.waitForTimeout(220);
      }
    }
    const after = await page.evaluate(() => window.landnam?.steading?.() ?? null);
    if (!before || !after) fails.push('oil: window.landnam.steading() said nothing');
    else if (after.painted > before.painted) {
      fails.push(`oil: the ground was repainted ${after.painted - before.painted}x for people moving`);
    } else if (after.kept <= before.kept) {
      fails.push('oil: no repaint reused the painting, so nothing proves it is kept');
    } else {
      say(`oil: ${after.kept - before.kept} repaints reused the painting, 0 reloaded the brush`);
    }
  }

  if (errors.length) fails.push(`${backend}: page errors — ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

for (const backend of ['svg', 'oil']) await audit(backend);
await browser.close();

if (fails.length) {
  for (const f of fails) console.error(`steading FAIL: ${f}`);
  process.exit(1);
}
console.log('steading OK — the paint is on the ground, everyone is visible, and looking twice is free');

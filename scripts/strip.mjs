// The strip bar: can a thumb land on a stretch of coast, in the built page?
//
// `test/strip.test.ts` proves the geometry — STOP_W clears 44, `pickStop`
// inverts `xOf`, the scene says what it knows. What a unit test cannot see is
// the only thing that decides whether any of that reaches a player: the strip
// is drawn at its natural width inside a scrolling frame, and ONE stray CSS
// rule (`svg { width: 100% }` is the obvious one, and this project has such
// rules) would squash 1508 chart pixels into 340 screen pixels. Every number
// in strip.ts would still be right; every stretch on screen would be 13px.
//
// So this measures the rendered thing. It also checks the two failures that
// come with a scrolling child: that the frame scrolls and the PAGE does not,
// and that the card's own controls stay reachable.
//
// This bar needs a build of the COAST, which is not the default build — see
// src/sim/flags.ts — which since 2026-08-28 is the ordinary build.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const TAP = 44;

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('strip: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`strip: ${PAGE} is missing. Run \`npm run strip\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

for (const [w, h] of [[390, 844], [320, 568]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(700);
  const seed = page.locator('input').first();
  if (await seed.count()) await seed.fill(process.env.SEED ?? 'strip-bar');
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);

  // Clear whatever card the first day put up, then open the chart.
  for (let i = 0; i < 8; i++) {
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) break;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  const chart = page.locator('.action-slot button', { hasText: /^Chart$|Map/i }).first();
  if (!(await chart.count())) {
    check(false, `${w}x${h}: no way to open the chart at all`);
    continue;
  }
  await chart.click().catch(() => {});
  await page.waitForTimeout(500);

  const survey = await page.evaluate(() => {
    const svg = document.querySelector('svg.strip');
    const frame = document.querySelector('.strip-frame');
    if (!svg || !frame) return null;
    const box = svg.getBoundingClientRect();
    const lanes = [...svg.querySelectorAll('g.strip-stop')].map((g) => {
      const r = g.getBoundingClientRect();
      return Math.round(r.width);
    });
    const overlay = document.querySelector('.overlay');
    return {
      // What one stretch is ON SCREEN, which is the whole question.
      lane: Math.min(...lanes.filter((n) => n > 0)),
      lanes: lanes.length,
      drawn: Math.round(box.width),
      // The frame scrolls; the page must not.
      frameScroll: Math.round(frame.scrollWidth - frame.clientWidth),
      scrolledTo: Math.round(frame.scrollLeft),
      pageWide: document.documentElement.scrollWidth > window.innerWidth + 1,
      cardWide: overlay ? overlay.scrollWidth > window.innerWidth + 1 : false,
      // Controls a thumb has to reach.
      buttons: [...document.querySelectorAll('.overlay button')].map((b) => ({
        text: b.textContent.trim().slice(0, 14),
        h: Math.round(b.getBoundingClientRect().height),
      })),
      keys: document.querySelectorAll('.chart-key').length,
    };
  });

  if (!survey) {
    check(false, `${w}x${h}: the chart opened but there is no strip in it`);
    continue;
  }

  console.log(
    `${w}x${h}: ${survey.lanes} stretches, narrowest ${survey.lane}px on screen, ` +
      `strip ${survey.drawn}px wide, frame scrolls ${survey.frameScroll}px ` +
      `(at ${survey.scrolledTo}), ${survey.keys} in the key`,
  );

  // THE BAR. A stretch has to be tappable, and the strip only earns its
  // scrolling frame if it is actually drawn at full width.
  check(survey.lane >= TAP,
    `${w}x${h}: a stretch is ${survey.lane}px on screen, under the ${TAP}px touch target`);
  check(survey.lanes === 26,
    `${w}x${h}: the strip drew ${survey.lanes} stretches, not the whole coast`);
  check(survey.frameScroll > 0,
    `${w}x${h}: the strip does not scroll, so it was squashed to fit instead`);

  // A scrolling child must never become a scrolling page.
  check(!survey.pageWide, `${w}x${h}: the page scrolls sideways`);
  check(!survey.cardWide, `${w}x${h}: the card is wider than the screen`);

  // And the band has to be findable without hunting: the strip opens
  // scrolled to where they are standing, which at stretch 0 is the left end.
  check(survey.scrolledTo >= 0, `${w}x${h}: the strip opened scrolled off its own start`);

  for (const b of survey.buttons) {
    check(b.h >= TAP, `${w}x${h}: the "${b.text}" button is ${b.h}px, under ${TAP}px`);
  }

  // THE OTHER BAR, and the one the milestone is actually measured against:
  // the chart is the VERB. With the coast on there is no other way to walk
  // anywhere until 8.3 puts a procession under it, so a strip that draws
  // beautifully and moves nobody is the whole feature missing.
  const before = await page.evaluate(() => {
    const s = window.landnam.state();
    return { day: s.day, stop: s.party.stop ?? 0 };
  });
  const target = await page.evaluate(() => {
    // A stretch the chart is offering today: the ring is drawn only on those.
    const g = [...document.querySelectorAll('svg.strip g.strip-stop')]
      .find((el) => el.querySelector('text.strip-cost'));
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!target) {
    check(false, `${w}x${h}: the chart offered the band nowhere to walk`);
  } else {
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => {
      const s = window.landnam.state();
      return { day: s.day, stop: s.party.stop ?? 0, open: !!document.querySelector('svg.strip') };
    });
    console.log(
      `${w}x${h}: tapped a stretch — stop ${before.stop} -> ${after.stop}, ` +
        `day ${before.day} -> ${after.day}`,
    );
    check(after.stop !== before.stop,
      `${w}x${h}: tapping a stretch moved nobody (still on ${after.stop})`);
    check(after.day > before.day,
      `${w}x${h}: the walk cost no days, so the coast is free`);
    check(!after.open, `${w}x${h}: the chart stayed up after the band walked off it`);
  }

  check(errors.length === 0, `${w}x${h}: the page reported ${errors[0] ?? ''}`);
}

await browser.close();

if (fail.length) {
  for (const said of fail) console.error(`strip: ${said}`);
  process.exit(1);
}
console.log('strip: the chart is a coast a thumb can walk');

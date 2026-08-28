// The procession bar: can you tell where you are and what is ahead, on a
// phone, without opening the chart?
//
// That sentence is 8.3's whole "Done when", and it is a claim about a SCREEN.
// `test/procession.test.ts` proves the scene knows those things — that the
// nearer silhouette is lower and larger, that an unlearned stretch shows
// nothing. None of that survives one CSS rule that clips the road or a label
// painted in ink the same colour as the country under it.
//
// So this reads the rendered page: the words are on it, the road can be
// walked from it, and the two things a coast lets you do are things a thumb
// can hit. Needs a coast build — `npm run procession`.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const TAP = 44;

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('procession: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`procession: ${PAGE} is missing. Run \`npm run procession\`.`);
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
  if (await seed.count()) await seed.fill(process.env.SEED ?? 'procession-bar');
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(900);
  for (let i = 0; i < 8; i++) {
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) break;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(200);
  }

  const survey = await page.evaluate(() => {
    const svg = document.querySelector('svg.procession');
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const here = svg.querySelector('text.here-word');
    // The road's verbs live in the action bar with every other verb. They
    // were drawn INSIDE the picture first, which looked right at 390x844 and
    // was unpressable at 320x568 — this SVG is `slice`, so its bottom edge
    // lands below the map slot and behind the site panel. Hence the
    // `elementFromPoint` check below: on the screen is not the same as
    // reachable, and only the second one is the bar.
    const steps = [...document.querySelectorAll('.action-slot button')]
      .filter((b) => /coast|Back ·/i.test(b.textContent ?? ''))
      .map((b) => {
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const top = document.elementFromPoint(cx, cy);
        return {
          text: b.textContent.trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
          onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1
            && r.left >= 0 && r.right <= window.innerWidth + 1,
          reachable: !!top && (top === b || b.contains(top)),
        };
      });
    return {
      view: { w: Math.round(box.width), h: Math.round(box.height) },
      here: here ? here.textContent.trim() : '',
      // Real people, drawn by the same hand that draws them in a fight —
      // `g.walker` since Art 13, because the road stopped drawing the
      // head-on battle figure. `look.ts` is what the two views now share;
      // `g.fighter` is the battlefield's class and would count nothing here.
      walkers: svg.querySelectorAll('g.walker').length,
      sights: svg.querySelectorAll('g.sight').length,
      names: [...svg.querySelectorAll('text.sight-name')].map((t) => t.textContent.trim()),
      steps,
      paint: !!svg.querySelector('foreignObject.field-paint canvas'),
      pageWide: document.documentElement.scrollWidth > window.innerWidth + 1,
      label: svg.getAttribute('aria-label') ?? '',
    };
  });

  if (!survey) {
    check(false, `${w}x${h}: travel is not a procession — no svg.procession on the page`);
    continue;
  }

  console.log(
    `${w}x${h}: "${survey.here}" · ${survey.walkers} walking · ${survey.sights} in sight` +
      `${survey.names.length ? ` (${survey.names.join(', ')})` : ''} · ` +
      `${survey.steps.length} ways to go`,
  );

  // WHERE YOU ARE. Half of the milestone's sentence, and it has to be words
  // on the picture rather than a number in a panel somewhere.
  check(survey.here.length > 0, `${w}x${h}: the picture never says where we are`);
  check(/stretch \d+|last of the coast/.test(survey.here),
    `${w}x${h}: "${survey.here}" does not say how far along the coast we are`);

  // The band is on it, drawn as people.
  check(survey.walkers >= 6,
    `${w}x${h}: ${survey.walkers} of the band are on the road, and six came off the knarr`);
  check(survey.paint, `${w}x${h}: the country is not painted`);

  // WHAT IS AHEAD. On day one nothing has been learned, so the honest bar
  // here is that the picture SAYS so rather than that it shows something.
  check(survey.label.length > 0, `${w}x${h}: the view has nothing to tell a screen reader`);

  // The two things a coast lets you do, and they have to be pressable.
  check(survey.steps.length > 0, `${w}x${h}: the road offers nowhere to go`);
  for (const s of survey.steps) {
    check(s.h >= TAP, `${w}x${h}: "${s.text}" is ${s.h}px tall, under the ${TAP}px target`);
    check(s.w >= TAP, `${w}x${h}: "${s.text}" is ${s.w}px wide, under the ${TAP}px target`);
    check(s.onScreen, `${w}x${h}: "${s.text}" is off the edge of the screen`);
    check(s.reachable,
      `${w}x${h}: "${s.text}" is on the screen but something else catches the tap`);
  }
  check(!survey.pageWide, `${w}x${h}: the page scrolls sideways`);

  // AND THE ROAD IS WALKABLE FROM THE PICTURE. Without this the procession
  // is wallpaper and the chart is still the only verb — which is the state
  // 8.3 exists to end.
  const before = await page.evaluate(() => {
    const s = window.landnam.state();
    return { day: s.day, stop: s.party.stop ?? 0 };
  });
  const on = page.locator('.action-slot button', { hasText: /up the coast/i }).first();
  await on.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) {
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) break;
    await b.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  const after = await page.evaluate(() => {
    const s = window.landnam.state();
    const svg = document.querySelector('svg.procession');
    return {
      day: s.day,
      stop: s.party.stop ?? 0,
      here: svg?.querySelector('text.here-word')?.textContent?.trim() ?? '',
    };
  });
  console.log(
    `${w}x${h}: walked — stop ${before.stop} -> ${after.stop}, day ${before.day} -> ` +
      `${after.day}, now "${after.here}"`,
  );
  check(after.stop !== before.stop,
    `${w}x${h}: tapping the road moved nobody (still on ${after.stop})`);
  check(after.day > before.day, `${w}x${h}: the walk cost no days`);
  check(after.here !== survey.here,
    `${w}x${h}: the picture says the same thing after walking as before it`);

  // WHAT IS AHEAD, actually shown. On day one the band has learned nothing,
  // so the check above can only ask that the picture says so — which is a
  // check that passes on an empty road forever. This walks until something
  // comes into sight and then reads it off the screen, because "you can tell
  // what is ahead" is not proved by a coast with nothing on it.
  let sighted = null;
  for (let step = 0; step < 12 && !sighted; step += 1) {
    const onward = page.locator('.action-slot button', { hasText: /up the coast/i }).first();
    if (!(await onward.count())) break;
    await onward.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(700);
    for (let i = 0; i < 6; i++) {
      const b = page.locator('.overlay .card button').first();
      if (!(await b.count())) break;
      await b.click({ timeout: 1200 }).catch(() => {});
      await page.waitForTimeout(180);
    }
    sighted = await page.evaluate(() => {
      const svg = document.querySelector('svg.procession');
      const sights = [...(svg?.querySelectorAll('g.sight') ?? [])];
      if (sights.length === 0) return null;
      const read = sights.map((g) => {
        const r = g.getBoundingClientRect();
        return { y: Math.round(r.bottom), size: Math.round(r.width * r.height) };
      });
      return {
        n: sights.length,
        names: [...svg.querySelectorAll('text.sight-name')].map((t) => t.textContent.trim()),
        read,
        stop: window.landnam.state().party.stop ?? 0,
      };
    });
  }
  if (!sighted) {
    check(false, `${w}x${h}: walked twelve stretches and never saw a thing on the coast`);
  } else {
    console.log(
      `${w}x${h}: from stretch ${sighted.stop}, ${sighted.n} in sight — ` +
        sighted.names.join(', '),
    );
    check(sighted.names.every((t) => t.length > 0),
      `${w}x${h}: something is in sight and the picture does not name it`);
    // Nearer is lower and larger ON SCREEN, which is the claim that makes
    // this a road and not a row of icons. Only checkable with two of them.
    if (sighted.read.length > 1) {
      const [near, far] = sighted.read;
      check(near.y > far.y, `${w}x${h}: the nearer thing is not lower on the screen`);
      check(near.size > far.size, `${w}x${h}: the nearer thing is not larger on the screen`);
    }
  }

  // AND A STILL ROAD COSTS NOTHING TO LOOK AT.
  //
  // Inherited from `scripts/repaint.mjs`, which holds this for the hex map
  // and has nothing to say about a road. Every repaint rebuilds the scene
  // from scratch, so the question is whether that rebuild is CHARGED: `work`
  // moves only when what is drawn changes. A view that redraws the country
  // on every tap of the roster is the bug this claim exists to catch, and it
  // is invisible in a screenshot.
  const still = await page.evaluate(() => window.landnam.drawn());
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { const a = window.landnam; if (a.stock) a.stock(200, 200); });
    await page.waitForTimeout(150);
  }
  const idle = await page.evaluate(() => window.landnam.drawn());
  if (still && idle && typeof idle.work === 'number') {
    console.log(`${w}x${h}: work ${still.work} -> ${idle.work} over five idle repaints`);
    check(idle.work === still.work,
      `${w}x${h}: five repaints that changed nothing cost ${idle.work - still.work} redraws`);
    // And it is not simply frozen: walking has to move it, or the counter
    // proves nothing at all.
    const onward = page.locator('.action-slot button', { hasText: /up the coast/i }).first();
    // Said out loud rather than skipped. A counter that never moves passes
    // "five idle repaints cost nothing" perfectly, and half this check is
    // there to catch exactly that.
    check(await onward.count() > 0,
      `${w}x${h}: nowhere left to walk, so "walking redraws the road" did NOT run`);
    if (await onward.count()) {
      await onward.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
      const moved = await page.evaluate(() => window.landnam.drawn());
      console.log(`${w}x${h}: work ${idle.work} -> ${moved.work} after walking`);
      check(moved.work > idle.work,
        `${w}x${h}: the band walked and the road did not redraw — the counter is stuck`);
    }
  } else {
    check(false, `${w}x${h}: the road reports no work count, so the repaint claim did NOT run`);
  }

  check(errors.length === 0, `${w}x${h}: the page reported ${errors[0] ?? ''}`);
}

await browser.close();

if (fail.length) {
  for (const said of fail) console.error(`procession: ${said}`);
  process.exit(1);
}
console.log('procession: you can tell where you are and what is ahead');

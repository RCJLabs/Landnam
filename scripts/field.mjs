// The battlefield's share of a phone, and whether a hex still clears a thumb.
//
//   npm run build && node scripts/field.mjs
//
// This began as "the battlefield gets squeezed to a strip as the fight goes
// on", which is what `src/style.css` warns about at `.saga.fight`. **It does
// not.** Measured over fourteen turns of a real fight, the field holds 69% of
// a 390x844 screen and falls to 67% as the log fills — it is `flex: 1 1 auto`
// and genuinely budgeted, and the 74px cap on the fight log does exactly the
// job its comment claims. The worry was wrong and is recorded as wrong.
//
// What the measuring DID turn up is a rule this project has held since 5.2:
// touch targets are never smaller than 44px. A battle hex is a touch target —
// you tap one to move and another to strike — and the field always fits the
// WHOLE grid on screen (`preserveAspectRatio: meet` over the grid's bounds),
// so the hex size falls out of the screen size rather than being chosen.
//
// With height taken out of the question entirely (a 1400px-tall viewport) the
// ceiling is a pure function of width:
//
//     320px wide -> 42px hex     360px -> 47px     390px -> 51px     412px -> 54px
//
// So on a 320px phone the rule CANNOT be met by reclaiming vertical space;
// 42px is the most there is. Fixing that means letting the field pan and zoom
// like the world map — which it deliberately does not do, `src/style.css`
// says "the battlefield frames itself, so no panning — just tap" — or making
// the grid smaller. Both are design decisions, so this script measures 320
// and prints it, and holds the 44px line at the sizes the game is actually
// built for (CLAUDE.md: portrait, designed at 390x844).
//
// Playwright stays optional, as in scripts/offline.mjs.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('field: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`field: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

/**
 * The 44px rule is held at EVERY width now, 320 included.
 *
 * It used to be held only at 360 and up, and this script measured 320 and
 * printed it rather than asserting a line it could not reach — because a
 * 320px screen tops out at a 39px hex however much height it is given: the
 * whole grid always fits, so hex size falls out of screen width and no
 * layout work can move it.
 *
 * The field zooms to the rule and pans the rest now, so there is nothing left
 * to exempt and no width-dependent branch here any more.
 */
const TAP = 44;

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const survey = () => {
  const h = (s) => {
    const el = document.querySelector(s);
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  };
  const field = document.querySelector('svg.field');
  // Every fighter is drawn at the same size, so the first one speaks for
  // all of them. Measured on SCREEN, after the SVG has scaled to fit.
  // A FIGHTER, not a ground tile. Since 8.1d there are no tiles: the field
  // is two walls meeting and the thing a thumb has to land on is a man. His
  // WIDTH is the binding dimension — a line packs men side by side, so what
  // separates one target from the next is horizontal.
  const man = field?.querySelector('g.fighter')?.getBoundingClientRect();
  return {
    vh: innerHeight,
    vw: innerWidth,
    field: field ? Math.round(field.getBoundingClientRect().height) : 0,
    hex: man ? Math.round(man.width) : 0,
    // Is there still a fight to measure? `svg.field` only exists while the
    // battle view is up, so this is the same question as "is field > 0" —
    // but asked BY NAME, so a caller can tell the two reasons apart.
    fighting: !!field,
    saga: h('.saga-slot'),
    lines: document.querySelectorAll('.saga-line').length,
    clipped: [...document.querySelectorAll('.shell button')]
      .filter((el) => {
        const q = el.getBoundingClientRect();
        return q.height > 0 && (q.bottom > innerHeight + 1 || q.right > innerWidth + 1);
      })
      .map((el) => el.textContent.trim().slice(0, 18)),
  };
};

const browser = await chromium.launch({ executablePath: CHROME });

for (const [w, h] of [[412, 915], [390, 844], [360, 640], [320, 568]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(600);
  // A FIXED SEED, as `pan.mjs` and `procession.mjs` have always used and
  // this file never did. Without one every run is a different fight, and
  // every claim below is a lottery: measured over four runs, one failed with
  // "no blow landed in 11 turns" purely because that fight ended before
  // anybody connected. A bar that fails one time in four teaches people to
  // re-run it, which is how a real regression gets waved through.
  const seed = page.locator('input').first();
  if (await seed.count()) await seed.fill(process.env.SEED ?? 'field-bar');
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() => window.landnam.fight(3));
  await page.waitForTimeout(900);

  const opening = await page.evaluate(survey);

  // Fourteen turns, so the log fills up and takes whatever it is going to
  // take. This is the "squeezed as the fight goes on" claim, played out.
  //
  // Stopping the moment the fight does is the load-bearing half, and it was
  // added because the bar went red on a fight that had simply been WON.
  // Fourteen turns of clicking whatever button is in the action slot can
  // finish a fight; when it finishes the battle view pops, `svg.field` is
  // gone, and every measurement below reads zero. The bar then reports "the
  // field fell to 0% — the log took it", which is not what happened and not
  // something a layout change could ever fix. So the last LIVE turn is what
  // gets measured, and how many turns that was is printed, because a fight
  // that ends on turn three is a different measurement from one that runs
  // the full fourteen and the reader should be able to see which they got.
  let late = opening;
  // Watch for impact marks from here on — see the item 19 block below for
  // why this is an observer and not a poll.
  await page.evaluate(() => {
    window.__blows = { struck: 0, blood: 0, flash: 0 };
    const bump = (n) => {
      if (!(n instanceof Element)) return;
      const cl = n.getAttribute('class') ?? '';
      if (n.matches?.('g.fighter.struck')) window.__blows.struck += 1;
      if (cl.includes('fx-blood')) window.__blows.blood += 1;
      if (cl.includes('hit-flash')) window.__blows.flash += 1;
    };
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) bump(n);
        if (r.type === 'attributes') bump(r.target);
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
    });
  });

  let played = 0;
  for (let turn = 0; turn < 14; turn++) {
    const end = page.locator('.action-slot button', { hasText: /End turn/i }).first();
    const any = (await end.count()) ? end : page.locator('.action-slot button').first();
    if (await any.count()) await any.click().catch(() => {});
    await page.waitForTimeout(400);
    const card = page.locator('button', { hasText: /onward|continue|dismiss|close|go on|so be it|leave|back to/i }).first();
    if (await card.count()) { await card.click().catch(() => {}); await page.waitForTimeout(280); }
    const now = await page.evaluate(survey);
    if (!now.fighting) break;
    late = now;
    played = turn + 1;
  }

  const share = (m) => Math.round((100 * m.field) / m.vh);

  console.log(
    `${w}x${h}: field ${opening.field}px (${share(opening)}%) -> ${late.field}px (${share(late)}%) ` +
      `after ${played} turn${played === 1 ? '' : 's'}, a fighter is ${opening.hex}px -> ${late.hex}px, ` +
      `log ${opening.saga} -> ${late.saga}px ` +
      `(${late.lines} lines)`,
  );

  // The field must stay the biggest thing on the screen through a whole
  // fight. Half is a floor, not a target: it sits at 67% on the design size.
  check(late.field > late.vh * 0.5,
    `${w}x${h}: the field fell to ${share(late)}% of the screen by turn ${played}`);
  check(late.clipped.length === 0, `${w}x${h}: clipped ${late.clipped.join(', ')}`);

  // THE BAR THAT CATCHES THE REAL FAILURE. A hex being over 44px is the
  // rule, but at 390 and up the hex is bound by the screen's WIDTH, so no
  // amount of log growth can move it and the rule alone is insensitive to
  // exactly the thing this file is about. What the log actually does is take
  // from the field, so that is what is measured: a whole fight may not cost
  // the field more than a tenth of what it opened with.
  check(late.field >= opening.field * 0.9,
    `${w}x${h}: ${played} turns took the field from ${opening.field}px to ${late.field}px, ` +
      `${Math.round(100 - (100 * late.field) / opening.field)}% of it, and the log took it`);
  check(errors.length === 0, `${w}x${h}: the page reported ${errors[0] ?? ''}`);

  // A hex is something you tap. This is the same 44px rule the action bar has
  // had to keep since 5.2, applied to the thing the fight is played on — and
  // held at every width, including the one that cannot frame the whole grid
  // and now pans instead.
  check(opening.hex >= TAP,
    `${w}x${h}: a fighter is ${opening.hex}px, under the ${TAP}px touch target`);
  check(late.hex >= TAP,
    `${w}x${h}: by turn ${played} a fighter is ${late.hex}px, under the ${TAP}px touch target`);

  // And the bar has to have MEASURED something. Stopping when the fight
  // stops fixes a false red; it also opens the way to a false green, because
  // a fight that ends on turn one leaves `late` equal to `opening` and every
  // check above passes without a single turn of log growth behind it. That
  // is the other failure this project keeps finding — a check that quietly
  // stopped running looks exactly like one that passed — so the number of
  // turns actually played is itself a bar.
  // What the fight actually threw, and what the screen did about it.
  const blows = await page.evaluate(() => ({
    ...window.__blows,
    count: (window.landnam.state().battle?.beats ?? []).filter(
      (b) => ['struck', 'reached', 'threw'].includes(b.kind) && b.result === 'hit' && b.damage > 0,
    ).length,
  }));

  check(played >= 4,
    `${w}x${h}: the fight was over after ${played} turn${played === 1 ? '' : 's'}, ` +
      'so the log never grew and this width measured nothing');

  // YOU CAN SEE THE WHOLE FIGHT, at every width, without touching it.
  //
  // This is the bar the battle format needed and never had. Measured on the
  // built page before the ranks were stacked: at 390x844 there was NO pan
  // position from which both walls were visible — at rest 3 of our 6 and 2
  // of their 4; dragged one way, 4/4 foes and none of ours; dragged the
  // other, 5/6 of ours and no enemy at all. A tactical view you cannot see
  // the enemy in, and nothing in this file noticed, because every check here
  // asked about the SIZE of a fighter and none asked whether he was on
  // screen.
  const whole = await page.evaluate(() => {
    const svg = document.querySelector('svg.field');
    const st = window.landnam.state();
    // The fight can be OVER by now — fourteen turns is enough to finish one,
    // and this file has watched a warband fall to its last man. With no
    // battle there are no combatants to ask about, and reaching into
    // `st.battle` regardless is what crashed this script intermittently.
    if (!svg || !st?.battle) return null;
    const side = Object.fromEntries(st.battle.combatants.map((c) => [c.personId, c.side]));
    const men = [...svg.querySelectorAll('g.fighter[data-who]')].map((g) => {
      const b = g.getBoundingClientRect();
      return { s: side[g.getAttribute('data-who')], on: b.left >= -0.5 && b.right <= innerWidth + 0.5 };
    });
    const tally = (which) => {
      const all = men.filter((m) => m.s === which);
      return { on: all.filter((m) => m.on).length, all: all.length };
    };
    return { ours: tally('warband'), foes: tally('foe') };
  });
  if (!whole) {
    // Said out loud rather than skipped: a check that quietly stopped
    // running looks exactly like one that passed, which is a habit this
    // file already names elsewhere.
    console.log(`${w}x${h}: the fight was over before the visibility claim could run`);
  } else {
  console.log(`${w}x${h}: on screen at rest — ours ${whole.ours.on}/${whole.ours.all}, ` +
    `theirs ${whole.foes.on}/${whole.foes.all}`);
  check(whole.foes.all > 0, `${w}x${h}: there is no enemy on the field to see`);
  check(whole.foes.on === whole.foes.all,
    `${w}x${h}: ${whole.foes.all - whole.foes.on} of ${whole.foes.all} foes are off screen — ` +
      'you cannot see who you are fighting');
  check(whole.ours.on === whole.ours.all,
    `${w}x${h}: ${whole.ours.all - whole.ours.on} of ${whole.ours.all} of our own are off screen`);
  }

  // GEAR YOU CAN SEE (art queue item 14), and specifically gear you can see
  // SPENT. `sim/ranks.ts`: "`throw` is a hand-axe. It reaches anybody, which
  // is what makes the back rank worth standing in." The whole of that
  // resource used to reach the screen as a digit on a button — "Throw 1" —
  // so the axes are drawn on the belt, one per throw a man has left.
  //
  // The claim is the correspondence, not the presence: a picture that always
  // draws two axes is decoration, and one that draws what the sim says is
  // gear. Checked against `throwsLeft` for every fighter on the field.
  if (w === 390) {
    const axes = await page.evaluate(() => {
      const svg = document.querySelector('svg.field');
      const st = window.landnam.state();
      if (!svg || !st?.battle) return null;
      const left = Object.fromEntries(
        st.battle.combatants.map((c) => [c.personId, c.down || c.fled ? 0 : c.throwsLeft]),
      );
      return [...svg.querySelectorAll('g.fighter[data-who]')].map((g) => ({
        who: g.getAttribute('data-who'),
        drawn: g.querySelectorAll('g.belt-axe').length,
        // The picture shows at most two; past that it is a smear on one hip.
        want: Math.min(2, left[g.getAttribute('data-who')] ?? 0),
      }));
    });
    if (!axes) {
      console.log(`${w}x${h}: the fight was over before the gear claim could run`);
    } else {
    const carrying = axes.filter((a) => a.want > 0);
    const wrong = axes.filter((a) => a.drawn !== a.want);
    console.log(`${w}x${h}: ${carrying.length} of ${axes.length} still carry an axe; ` +
      `${axes.length - wrong.length} of ${axes.length} drawn right`);
    check(carrying.length > 0,
      `${w}x${h}: nobody on the field has a throw left, so the gear claim did NOT run`);
    check(wrong.length === 0,
      `${w}x${h}: ${wrong.length} fighters carry the wrong number of axes — ` +
        wrong.map((a) => `${a.who} drew ${a.drawn} for ${a.want}`).join(', '));
    }
  }

  // BLOWS THAT LAND SOMEWHERE (art queue item 19). A landed blow used to be
  // a flash on the figure's centre and a number over its head — a hit
  // REPORTED. Now the man takes it: he is shoved along the line the blow came
  // in on, and a solid hit throws blood at the place it landed.
  //
  // Recorded with a MutationObserver rather than polled. These effects live
  // 300-600ms and a poll loop steps clean over them: measured, a loop
  // sampling every 70ms across 2.8s of a real fight saw ZERO of eight blows
  // that the beat stream proves were struck. An observer catches every one.
  //
  // Only at the width the game is designed for; the choreography does not
  // change shape with the viewport.
  if (w === 390 && blows.count > 0) {
    console.log(`${w}x${h}: ${blows.count} blows landed — ` +
      `${blows.struck} recoils, ${blows.blood} spatters, ${blows.flash} flashes`);
    check(blows.struck > 0,
      `${w}x${h}: ${blows.count} blows landed and nobody moved — they read as numbers`);
    check(blows.blood > 0,
      `${w}x${h}: ${blows.count} blows landed and drew no blood`);
  } else if (w === 390) {
    check(false, `${w}x${h}: no blow landed in ${played} turns, so item 19 did NOT run`);
  }

  await page.close();
}

await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`field: ${said}`);
  process.exit(1);
}
console.log(`field OK — the fight keeps the screen, and a fighter clears ${TAP}px at every width`);

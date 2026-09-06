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
// The repo's own decoder — `scripts/lookSignature.mjs` exists because Node
// has no image decoder and this repo will not take a dependency for one.
import { decodePng } from './lookSignature.mjs';

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

  // --- 12.8: every foe the player can hit says what hitting him is worth ---
  //
  // The recurring decision in a fight is which marked foe to strike, and the
  // odds were computable all along — `hitOdds` is the tail of a 2d6, with
  // every other term already known before the tap. The sim's half is held by
  // `test/odds.test.ts` against thousands of real seeded swings; what that
  // cannot see is whether the number reaches the screen, which is the fault
  // 12.1 found on the colony panels and 12.4 found again on this one.
  //
  // Asserted as a PAIRING rather than a count: every mark has an odds label,
  // and there is no label without a mark. A count alone would pass on a
  // screen that drew five marks and five labels in the wrong places.
  //
  // AT THE OPENING OF THE FIGHT, not after it. The first cut ran this at the
  // end of the fourteen striking turns below and reported "no foe was in
  // reach" at all three widths — the fight was over, nothing was marked, and
  // the claim never ran once while looking exactly like a claim that passed.
  // Round one always has men on both sides and something to aim at.
  // Wait for a turn that HAS something to aim at. The opening initiative can
  // be the foes', and a bar that shrugged at that reported "no foe was in
  // reach" four times over while the feature it was written for went
  // unchecked. Ends the turn a few times rather than assuming.
  for (let tries = 0; tries < 8; tries += 1) {
    if (await page.locator('svg.field .mark').count()) break;
    const end = page.locator('.action-slot button', { hasText: /^End turn$/ }).first();
    if (await end.count()) await end.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const odds = await page.evaluate(() => {
    const svg = document.querySelector('svg.field');
    if (!svg) return null;
    const marks = [...svg.querySelectorAll('.mark')];
    const labels = [...svg.querySelectorAll('.mark-odds')];
    const near = marks.filter((m) => {
      const a = m.getBoundingClientRect();
      return labels.some((l) => {
        const b = l.getBoundingClientRect();
        return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) < 24 && b.top >= a.top - 2;
      });
    });
    // AND NO TWO OF THEM ON TOP OF EACH OTHER. Two marked foes in
    // neighbouring ranks printed their odds through one another — a
    // screenshot read "100%100%" — and every other check here passed, because
    // the nodes existed, in the right places, with the right text. Presence
    // is not legibility.
    let collided = 0;
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i].getBoundingClientRect();
        const c = labels[j].getBoundingClientRect();
        if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) collided += 1;
      }
    }
    return {
      marks: marks.length,
      labels: labels.length,
      paired: near.length,
      collided,
      // In CSS pixels, because the field is drawn in a viewBox that gets
      // scaled to the slot: a font-size that reads fine in user units can
      // land on the phone as four pixels of illegible red, which is exactly
      // what the first cut shipped and what this survey did not notice.
      tallest: labels.reduce((h, l) => Math.max(h, l.getBoundingClientRect().height), 0),
      texts: labels.map((l) => l.textContent || ''),
    };
  });
  if (odds && odds.marks > 0) {
    check(odds.paired === odds.marks,
      `${w}x${h}: ${odds.marks - odds.paired} of ${odds.marks} marked foes carry no odds`);
    check(odds.labels === odds.marks,
      `${w}x${h}: ${odds.labels} odds labels for ${odds.marks} marks`);
    check(odds.texts.every((t) => /^\d{1,3}%$/.test(t)),
      `${w}x${h}: an odds label does not read as a percentage — ${odds.texts.join(', ')}`);
    check(odds.collided === 0,
      `${w}x${h}: ${odds.collided} pair(s) of odds labels are drawn on top of each other`);
    check(odds.tallest >= 9,
      `${w}x${h}: the odds read ${odds.tallest.toFixed(1)}px tall — too small to read`);
    console.log(`${w}x${h}: ${odds.marks} marked foes, each saying its odds (${odds.texts.join(' ')})`);
  } else if (odds) {
    // A FAILURE, not a shrug. Eight turns into a fight with men standing on
    // both sides there is always something to aim at, so no marks here means
    // the marks stopped being drawn — and a claim that quietly stops running
    // looks exactly like one that passes.
    check(false, `${w}x${h}: nothing was marked after eight turns, so the odds claim never ran`);
  }



  // ---------------------------------------------------------------- 12.15
  //
  // THE HUD IS OUT OF THE ILLUSTRATION, and this is what holds it out. Each
  // of these was on the field until 12.15: a 4px health bar under every man,
  // a `−N` floating off every blow, and a Steps stat reading a movement
  // counter for a mechanic that left with the dash in 9.1b.
  //
  // Checked AFTER the striking turns below rather than at the opening, since
  // a bar that only ever looked at turn zero would pass on a field that grew
  // a readout the moment somebody was hit.
  const hudAfter = async () => page.evaluate(() => {
    const field = document.querySelector('svg.field');
    const rects = field ? [...field.querySelectorAll('rect')] : [];
    return {
      // A health bar is a short wide rect under a figure. Measured by SHAPE
      // rather than by class, because a class is a name somebody can change
      // and a 4px readout is a 4px readout whatever it is called.
      bars: rects.filter((r) => {
        const h = r.getBBox?.().height ?? 0;
        const w = r.getBBox?.().width ?? 0;
        return h > 0 && h <= 6 && w >= h * 4;
      }).length,
      floats: document.querySelectorAll('.float-dmg').length,
      steps: [...document.querySelectorAll('.stat-label')]
        .some((el) => /steps/i.test(el.textContent || '')),
      stats: [...document.querySelectorAll('.stat-label')].map((el) => el.textContent),
    };
  });

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
  // 12.15's three removals, on the field as it stands after the striking
  // turns above.
  const hud = await hudAfter();
  check(hud.bars === 0,
    `${w}x${h}: ${hud.bars} health-bar rect(s) still drawn under the fighters`);
  check(hud.floats === 0,
    `${w}x${h}: ${hud.floats} floating damage number(s) still on the field`);
  check(!hud.steps,
    `${w}x${h}: the top bar still carries a Steps stat — ${hud.stats.join(', ')}`);
  console.log(`${w}x${h}: no bars, no floating numbers; bar reads ${hud.stats.join(' · ')}`);

  check(late.field > late.vh * 0.5,
    `${w}x${h}: the field fell to ${share(late)}% of the screen by turn ${played}`);
  check(late.clipped.length === 0, `${w}x${h}: clipped ${late.clipped.join(', ')}`);

  // THE BAR THAT CATCHES THE REAL FAILURE. A hex being over 44px is the
  // rule, but at 390 and up the hex is bound by the screen's WIDTH, so no
  // amount of log growth can move it and the rule alone is insensitive to
  // exactly the thing this file is about. What the log actually does is take
  // from the field, so that is what is measured.
  //
  // IT USED TO ALLOW A TENTH, AND A TENTH WAS TOO MUCH. A player reported
  // "in battle as people die the screen shrinks" against a build where this
  // bar was green: measured at 390x844, the field went 606px to 562px over
  // one death — 7.3%, comfortably inside the tolerance. The log's height was
  // CAPPED rather than reserved, so it grew into its cap over the first
  // turns and every line it gained came out of the field. A footnote takes
  // its space once now, so the honest number is zero and the tolerance is
  // one pixel of rounding.
  //
  // The OTHER half of that report — the frame being sized by who was still
  // standing — is not measured here. It only bites once a whole rank has
  // emptied, and a fight played far enough for that is a long browser run
  // that mostly measures the combat tables. It is `test/line.test.ts`'s
  // "the field is sized by the fight, not by the survivors" instead, which
  // is exact, runs in a millisecond, and cannot fail to reach its premise.
  check(late.field >= opening.field - 1,
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

  // A MAN AT A THIRD MUST NOT LOOK LIKE A MAN AT FULL, AT 44px.
  //
  // The other half of taking the bar off. Removing a readout is easy; the
  // work is making the figure carry what it said, and the figure only counts
  // if it carries it at the size a thumb needs — 44px, the same TAP the rest
  // of this file measures against.
  //
  // A PICTURE COMPARED, not an attribute read. Asking whether the tunic fill
  // string differs would pass on a change of one part in 255, which is a
  // difference no eye has. So: two men drawn by `figure()` itself through the
  // debug hook, screenshotted at 44px, and the halves diffed pixel by pixel.
  if (w === 390) {
    await page.evaluate((px) => window.landnam.twoMen(px), TAP);
    await page.waitForTimeout(120);
    const host = page.locator('#twomen');
    const shot = await host.screenshot();
    const png = decodePng(shot);
    let differing = 0;
    let counted = 0;
    const half = Math.floor(png.w / 2);
    const at = (x, y) => (png.w * y + x) * png.bpp;
    for (let y = 0; y < png.h; y += 1) {
      for (let x = 0; x < half; x += 1) {
        const a = at(x, y);
        const b = at(x + half, y);
        counted += 1;
        const d = Math.abs(png.px[a] - png.px[b])
          + Math.abs(png.px[a + 1] - png.px[b + 1])
          + Math.abs(png.px[a + 2] - png.px[b + 2]);
        if (d > 24) differing += 1;
      }
    }
    const pct = counted ? (differing / counted) * 100 : 0;
    await page.evaluate(() => document.getElementById('twomen')?.remove());
    // WHERE THE SIX COMES FROM, AND WHAT IT BINDS ON.
    //
    // This diff measures EVERY health signal on the man at once, so a
    // threshold has to be set against the floor the other signals already
    // give — otherwise it passes on a figure whose tunic says nothing. Three
    // readings, this instrument, 2026-09-06, one run each at 390x844:
    //
    //   every health signal cut out ................ 0.0%
    //   shield wear only (tunic and lean cut) ...... 4.5%
    //   as it ships ................................ 8.4%
    //
    // The first version of this check asked for 2% and would have passed at
    // 4.5 — that is, on the game exactly as it was BEFORE 12.15, which is
    // the thing the item exists to change. The middle reading is the finding
    // worth keeping: the crack at a third is two pixels and does vanish, but
    // the 22% ink disc laid over the whole shield beside it does not, and it
    // was already carrying a fifth of a screen's worth of difference.
    //
    // So: six. Above the 4.5% the shield gives on its own, below the 8.4%
    // the tunic and the lean take it to, and re-measured rather than assumed
    // each time either number is touched.
    check(pct >= 6,
      `${w}x${h}: a man at a third looks like a man at full at ${TAP}px `
      + `(${pct.toFixed(1)}% of pixels differ, and the shield alone gives 4.5) `
      + `— the tunic is not carrying the wound`);
    console.log(`${w}x${h}: whole against hurt at ${TAP}px — ${pct.toFixed(1)}% of pixels differ`);
  }

  await page.close();
}

await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`field: ${said}`);
  process.exit(1);
}
console.log(`field OK — the fight keeps the screen, and a fighter clears ${TAP}px at every width`);

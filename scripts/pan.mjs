// The battlefield on a screen too narrow to frame it, checked in a browser.
//
//   npm run pan
//
// `scripts/field.mjs` measures whether a hex clears 44px. This checks the
// thing that had to be built to make that true at 320px, and the hazard that
// came with it.
//
// A battle hex is a touch target, and until now the field framed the whole
// grid and never moved — "the battlefield frames itself, so no panning, just
// tap". At 320px wide that tops out at a 39px hex however much height it is
// given, because the whole grid always fits. So the field now zooms exactly
// as far as the 44px rule demands and lets the player drag for the rest.
//
// THE HAZARD IS THE POINT OF THIS FILE. The same `pointerup` that ends a pan
// used to order a fighter to walk there. A drag that moves a warrior into a
// shield wall because the player wanted to see the left flank is worse than
// the 5px it was fixing, and no unit test in this repo can see it: the suite
// runs in node and the renderer is deliberately untested there.

import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error(
    'pan check: playwright-core is not installed, so this did NOT run.\n' +
      '  npm i -D playwright-core   (or run it where a browser is available)',
  );
  process.exit(2);
}

if (!existsSync(PAGE)) {
  console.error(`pan check: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

const fail = [];
const check = (ok, said) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${said}`);
  if (!ok) fail.push(said);
};

/** A fresh run, dropped straight onto a battlefield through the console lever. */
async function openFight(page) {
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(700);
  const start = page.locator('button', { hasText: /Take the land|New landing/ }).first();
  if (await start.count()) await start.click();
  await page.waitForTimeout(700);
  // Dismiss cards until there are none, and then WAIT until the overlay is
  // actually gone. A drag that starts while a card is still up lands on the
  // card, not the field, and the check reads as "the field did not pan" —
  // which is an intermittent lie about the thing being tested. Seen once.
  const clearCards = async () => {
    for (let i = 0; i < 10; i += 1) {
      const card = page.locator('.overlay-slot button, .overlay button').first();
      if (!(await card.count())) break;
      await card.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    for (let i = 0; i < 20; i += 1) {
      const left = await page.locator('.overlay-slot .overlay, .overlay').count();
      if (left === 0) break;
      await page.waitForTimeout(100);
    }
    // And let the field settle: it is `flex: 1 1 auto` under a log that grows,
    // so its size — and the zoom fitted to it — moves for a frame or two after
    // the last card goes.
    await page.waitForTimeout(400);
  };
  await clearCards();
  await page.evaluate(() => window.landnam.fight());
  await page.waitForTimeout(500);
  // The battle lesson is due the first time a fight opens.
  await clearCards();
}

const viewBoxOf = (page) =>
  page.evaluate(() => document.querySelector('svg.field').getAttribute('viewBox'));

/** Where the fighter whose turn it is stands, straight off the state. */
const activeAt = (page) =>
  page.evaluate(() => {
    const battle = window.landnam.state()?.battle;
    if (!battle) return null;
    const a = battle.combatants.find((c) => c.personId === battle.order[battle.turnIndex]);
    return a ? { q: a.at.q, r: a.at.r, id: a.personId } : null;
  });

/** Where one NAMED fighter stands, whoever's turn it happens to be. */
const posOf = (page, id) =>
  page.evaluate((id) => {
    const battle = window.landnam.state()?.battle;
    const c = battle?.combatants.find((f) => f.personId === id);
    return c ? { q: c.at.q, r: c.at.r } : null;
  }, id);

/**
 * Wait until one of OURS is up.
 *
 * The foes take their turns on their own, so "the active fighter" is not a
 * fixed person across a few hundred milliseconds of dragging. Comparing it
 * before and after read as "a drag moved the fighter" when all that had
 * happened was a raider taking its turn — and it made the tap check tap
 * during a foe's turn, where doing nothing is correct. Both were the check
 * being wrong about the game, twice in the same file.
 */
async function ourTurn(page) {
  for (let i = 0; i < 40; i += 1) {
    const ours = await page.evaluate(() => {
      const battle = window.landnam.state()?.battle;
      if (!battle || battle.outcome) return false;
      const a = battle.combatants.find((c) => c.personId === battle.order[battle.turnIndex]);
      return !!a && a.side === 'warband' && !a.broken && !a.down;
    });
    if (ours) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

for (const [w, h] of [[320, 568], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await openFight(page);
  console.log(`${w}x${h}:`);

  const narrow = w < 360;
  check(await ourTurn(page), 'a warband fighter gets a turn to act on');
  const stood = await activeAt(page);
  const field = await page.locator('svg.field').boundingBox();

  /** One drag across the field, well past the 2px that separates tap from drag. */
  const drag = async (fromX, fromY, toX, toY) => {
    await page.mouse.move(field.x + field.width * fromX, field.y + field.height * fromY);
    await page.mouse.down();
    await page.mouse.move(field.x + field.width * toX, field.y + field.height * toY, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    return viewBoxOf(page);
  };

  // BOTH EXTREMES, not one drag from wherever the view happens to sit.
  //
  // The zoom goes only as far as 44px demands — about 1.7% at 320px — so only
  // a few pixels of field are ever off screen, and the view is usually already
  // hard against one clamp or the other. Dragging THAT way legitimately
  // changes nothing, so a single drag makes this check pass or fail on where
  // the fighter it centres on happened to be standing. Measured: it read "did
  // not pan" on two runs in four. That was a flaky check, not a flaky field.
  const left = await drag(0.75, 0.65, 0.2, 0.3);
  const right = await drag(0.2, 0.3, 0.75, 0.65);
  // The SAME fighter, not whoever is active now — a foe may have taken a
  // turn while the drags were happening, which moves nobody of ours.
  const stoodAfter = await posOf(page, stood.id);

  // BOTH widths pan now, and that is arithmetic rather than a regression:
  // six sworn against six raiders is twelve ranks, twelve targets at the
  // 44px minimum is 528px, and no phone this file tests is that wide. The
  // hex grid framed itself at 390 because a grid is compact; a line is not.
  //
  // The claim that used to live here — "a screen that can frame the whole
  // field does not move" — is still a rule, and it is checked exactly rather
  // than approximately in `test/line.test.ts`, which knows the field's width
  // in user units instead of guessing it from a screenshot.
  check(left !== right, 'the field pans when it cannot frame itself');
  check(
    !!stoodAfter && stood.q === stoodAfter.q && stood.r === stoodAfter.r,
    'a drag does NOT order the fighter to walk there',
  );

  // The hazard that comes WITH panning, and the one the old "a wide screen
  // does not move" check was implicitly covering: a field you can drag is a
  // field you can drag the fight out of. Shove it hard against each end and
  // somebody must still be on screen.
  for (const [fx, tx] of [[0.9, 0.05], [0.05, 0.9]]) {
    for (let i = 0; i < 4; i += 1) await drag(fx, 0.5, tx, 0.5);
    const onScreen = await page.evaluate(() => {
      const svg = document.querySelector('svg.field');
      const rect = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('g.fighter')].some((el) => {
        const b = el.getBoundingClientRect();
        return b.x + b.width > rect.x && b.x < rect.x + rect.width;
      });
    });
    check(onScreen, `dragged ${tx < fx ? 'left' : 'right'} and the wall went with it`);
  }

  // And the tap still works, which is the other half of the same handler.
  //
  // It used to tap a dashed marker and expect the fighter to WALK there. That
  // hex is gone: since 8.1c a fighter's place is their rank, and the only
  // thing a tap can mean is the armed action on somebody the game has marked
  // as in reach. Two things changed with it, and both had to be handled here
  // rather than worked around:
  //
  //   - Marks appear only when the ACTIVE fighter can reach somebody, and a
  //     man in the third rank cannot swing an axe at all. Turn order is
  //     initiative, not rank, so the first of ours to act is often somebody
  //     with nothing marked — which is correct, and read as a broken field.
  //     So this ends turns until it finds one who has a target.
  //   - The marks are drawn on `Combatant.at`, frozen where the fighter
  //     deployed, so at 320px they are routinely off the panned view. The
  //     search takes the first mark actually ON SCREEN, as before.
  //
  // Both of those go away in 8.1d when the field is drawn side-on and a rank
  // is a place on the screen rather than a leftover hex.
  check(await ourTurn(page), 'a warband fighter is up for the tap');
  const findMark = () =>
    page.evaluate(() => {
      const svg = document.querySelector('svg.field');
      const rect = svg.getBoundingClientRect();
      for (const el of svg.querySelectorAll('ellipse.mark')) {
        const b = el.getBoundingClientRect();
        const cx = b.x + b.width / 2;
        // The mark is drawn at the man's FEET, so aim a little above it to
        // land on the man himself — which is what `pick` in render/line.ts
        // answers for, and what a player's thumb would do.
        const cy = b.y + b.height / 2 - b.width * 0.5;
        if (cx < rect.x || cx > rect.x + rect.width) continue;
        if (cy < rect.y || cy > rect.y + rect.height) continue;
        return { x: cx, y: cy };
      }
      return null;
    });
  let mark = await findMark();
  for (let i = 0; i < 12 && !mark; i += 1) {
    const end = page.locator('button', { hasText: /^End turn$/ }).first();
    if (!(await end.count())) break;
    await end.click().catch(() => {});
    await page.waitForTimeout(250);
    if (!(await ourTurn(page))) break;
    mark = await findMark();
  }
  check(!!mark, 'the field marks somebody the active fighter can reach');
  const now = await activeAt(page);
  let acted = false;
  if (mark && now) {
    await page.mouse.click(mark.x, mark.y);
    await page.waitForTimeout(300);
    // A blow spends the turn, so either it has passed on or this fighter has
    // acted. Nobody walks anywhere any more, which is the whole point.
    acted = await page.evaluate((id) => {
      const b = window.landnam.state()?.battle;
      if (!b) return true;
      if (b.order[b.turnIndex] !== id) return true;
      return !!b.combatants.find((c) => c.personId === id)?.hasActed;
    }, now.id);
  }
  check(acted, 'tapping a marked foe spends the turn');

  // THE NEW HAZARD, and the direct successor to the one at the top of this
  // file: bare ground is not an order any more. A tap on an empty part of
  // the field used to walk a man across it, and it must now do nothing.
  //
  // This check used to hunt for an unoccupied ground POLYGON, and when 8.1d
  // took the tiles away it found none, skipped itself, and printed nothing
  // at all — a check that quietly stops running looks exactly like a check
  // that passes. The sky is bare ground that cannot stop existing.
  check(await ourTurn(page), 'a warband fighter is up for the bare-ground tap');
  const before = await activeAt(page);
  const sky = await page.evaluate(() => {
    const rect = document.querySelector('svg.field').getBoundingClientRect();
    // Well above the wall, and clear of the two round buttons top-right.
    return { x: rect.x + rect.width * 0.3, y: rect.y + rect.height * 0.18 };
  });
  const wasTurn = await page.evaluate(() => {
    const b = window.landnam.state()?.battle;
    return `${b?.round}:${b?.turnIndex}:${b?.combatants.filter((c) => c.down).length}`;
  });
  await page.mouse.click(sky.x, sky.y);
  await page.waitForTimeout(300);
  const nowTurn = await page.evaluate(() => {
    const b = window.landnam.state()?.battle;
    return `${b?.round}:${b?.turnIndex}:${b?.combatants.filter((c) => c.down).length}`;
  });
  check(
    !!before && nowTurn === wasTurn,
    `a tap on bare ground orders nothing (was ${wasTurn}, now ${nowTurn})`,
  );

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);

  await page.close();
}

await browser.close();

if (fail.length > 0) {
  console.error(`pan check FAILED: ${fail.length} of them.`);
  process.exit(1);
}
console.log('pan check passed — the field moves, stays under the wall, and never taps by accident.');

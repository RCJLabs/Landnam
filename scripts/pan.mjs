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

  if (narrow) {
    check(left !== right, 'the field pans when it cannot frame itself');
  } else {
    // The design rule, still held everywhere it can be: a screen that frames
    // the whole grid at 44px does not move, and a drag on it does nothing.
    check(left === right, 'a wide screen still frames itself and does not pan');
  }
  check(
    !!stoodAfter && stood.q === stoodAfter.q && stood.r === stoodAfter.r,
    'a drag does NOT order the fighter to walk there',
  );

  // And the tap still works, which is the other half of the same handler.
  //
  // The hex tapped is one the game itself drew as reachable — the dashed
  // marker a player aims at — rather than a neighbour guessed at from the
  // fighter's position. Guessing failed about one run in four: at 320 the
  // view is panned, so some neighbours are off screen, and the rest can be
  // water, a wall, occupied, or beyond the fighter's remaining steps. That
  // read as "tapping is broken" when every tap had been perfectly legal.
  check(await ourTurn(page), 'a warband fighter is up for the tap');
  const now = await activeAt(page);
  const mark = await page.evaluate(() => {
    const svg = document.querySelector('svg.field');
    const rect = svg.getBoundingClientRect();
    for (const el of svg.querySelectorAll('polygon[stroke-dasharray]')) {
      const b = el.getBoundingClientRect();
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      if (cx < rect.x || cx > rect.x + rect.width) continue;
      if (cy < rect.y || cy > rect.y + rect.height) continue;
      return { x: cx, y: cy };
    }
    return null;
  });
  check(!!mark, 'the field offers somewhere to step');
  let moved = false;
  if (mark) {
    await page.mouse.click(mark.x, mark.y);
    await page.waitForTimeout(300);
    const where = await posOf(page, now.id);
    // Either this fighter moved, or the tap spent their turn and it passed.
    if (!where || where.q !== now.q || where.r !== now.r) moved = true;
    else {
      moved = await page.evaluate((id) => {
        const b = window.landnam.state()?.battle;
        return !b || b.order[b.turnIndex] !== id;
      }, now.id);
    }
  }
  check(moved, 'tapping the field still moves a fighter');
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);

  await page.close();
}

await browser.close();

if (fail.length > 0) {
  console.error(`pan check FAILED: ${fail.length} of them.`);
  process.exit(1);
}
console.log('pan check passed — the narrow field moves, the wide one does not, and neither taps by accident.');

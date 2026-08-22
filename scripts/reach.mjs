// Can a thumb get to it?
//
//   npm run build && node scripts/reach.mjs
//
// CLAUDE.md has required 44px touch targets since 5.2 and an audit once found
// exactly one under it — the Saga button, at 43 wide, for months, because
// nothing counted. This counts. It also asks the question that rule does not:
// a target can be big and still be somewhere a thumb has to shuffle the phone
// to reach.
//
// Holding a 6" phone one-handed, the bottom of the screen is where the thumb
// rests and the top is where it does not go. So every target is placed in a
// band by its centre:
//
//     easy      below 55% of the screen — where the thumb already is
//     stretch   30% to 55% — reachable without moving the hand much
//     hard      above 30% — a shuffle, or the other hand
//
// **The bar is not "nothing may be high".** Some things belong at the top: the
// mute and the gear are pressed once a session and live over the map, out of
// the way of everything pressed constantly. What must never drift up is a
// PRIMARY control — the ones a player touches every turn — so those are named
// here and held to the easy band, and everything else is measured and printed.
//
// Elements scrolled out of sight inside a panel are reported as `scroll`
// rather than by position: `.hint-slot` caps at 62dvh and scrolls, so the
// bottom of a long build list is legitimately off-screen and its layout
// position says nothing about whether a thumb can get to it.
//
// Playwright stays optional, as in scripts/offline.mjs.

import { existsSync, readFileSync } from 'node:fs';

const PAGE = 'dist/app.html';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TAP = 44;
const EASY = 0.55;
/**
 * The line a primary control may not cross.
 *
 * NOT the easy band, and the difference is the whole judgement here. A sheet
 * of five options is 300px tall; on an 844px screen its first row cannot sit
 * below 55% however it is anchored, so a bar demanding that could only ever
 * be met by having fewer menus. What a design CAN promise is that nothing
 * pressed every turn sits in the band where the hand has to shuffle — and
 * that is exactly what failed before the sheet was moved down: Camp at 25%.
 */
const HARD = 0.30;

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('reach: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`reach: ${PAGE} is missing. Run \`npm run build\` first.`);
  process.exit(2);
}
const COLONY = existsSync('/tmp/colony.json') ? readFileSync('/tmp/colony.json', 'utf8') : null;

/**
 * What a player touches every turn, decided by WHERE a control lives rather
 * than by what it says.
 *
 * A word list was the first attempt and it was brittle in the way that
 * matters: it is written from the labels somebody happened to look at, so a
 * deed added later is silently exempt from the rule. The action bar, the
 * deeds sheet and a card's own confirm are primary because of what they ARE.
 */
const PRIMARY_SELECTOR = [
  '.action-slot button',
  'button.deed',
  '.overlay button.primary:not(.hardship-chip)',
  '.overlay button.wide',
].join(', ');
// `.hardship-chip` wears `primary` to mean SELECTED, not "this is the main
// action" — it is chosen once per run, not once a turn.

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const survey = (primarySelector) => [...document.querySelectorAll('button, [role="button"], input, select')]
  .filter((el) => {
    const q = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return q.width > 0 && q.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  })
  .map((el) => {
    const q = el.getBoundingClientRect();
    // Clipped by a scrolling ancestor? Then its position on the page says
    // nothing — it is reached by scrolling, like any long list.
    let hidden = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden') {
        const r = p.getBoundingClientRect();
        if (q.bottom > r.bottom + 1 || q.top < r.top - 1) { hidden = true; break; }
      }
    }
    const offscreen = q.top >= innerHeight || q.bottom <= 0;
    return {
      primary: el.matches(primarySelector),
      text: (el.textContent || el.getAttribute('aria-label') || el.className || '?').trim().slice(0, 26),
      w: Math.round(q.width),
      h: Math.round(q.height),
      frac: +((q.top + q.height / 2) / innerHeight).toFixed(3),
      scrolled: hidden || offscreen,
    };
  });

const browser = await chromium.launch({ executablePath: CHROME });

/**
 * The screen this audit runs on.
 *
 * It was 390x844 and nothing else for as long as it has existed — the size
 * CLAUDE.md names as the design target. But the 44px rule is not a rule about
 * the design size, it is a rule about thumbs, and a control that clears it at
 * 390 can fall under it at 320 where every width-bound thing shrinks. That is
 * exactly what the battlefield did. `npm run reach -- 320x568` asks the
 * question at any width; with no argument it asks it at the design size, so
 * the default is what it always was.
 */
const [W, H] = (process.argv[2] ?? '390x844').split('x').map(Number);

async function look(label, act, save) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(600);
  if (save) {
    await page.evaluate((s) => localStorage.setItem('landnam_save', s), save);
    await page.reload();
    await page.waitForTimeout(800);
    await page.locator('button', { hasText: /^Continue$/ }).click().catch(() => {});
    await page.waitForTimeout(800);
    for (let i = 0; i < 4; i++) {
      const card = page.locator('.overlay button', { hasText: /onward|continue|close|back|go on|so be it/i }).first();
      if (!(await card.count())) break;
      await card.click().catch(() => {});
      await page.waitForTimeout(450);
    }
  } else if (label !== 'title') {
    await page.locator('button', { hasText: /Take the land/i }).first().click();
    await page.waitForTimeout(800);
  }

  // Clear anything covering the screen BEFORE acting, on every path.
  //
  // Only the save path did this, and a fresh run can raise a lesson card too —
  // so `act` would sometimes reach for a control the card was sitting on and
  // the whole audit died with "lesson-card intercepts pointer events". It is
  // intermittent, which is worse than broken: measured today at two failures
  // in four runs, on a script that is in no CI and that nobody would suspect
  // because it passes when you rerun it.
  if (label !== 'title') {
    for (let i = 0; i < 6; i += 1) {
      const card = page.locator('.overlay-slot button, .overlay button').first();
      if (!(await card.count())) break;
      await card.click().catch(() => {});
      await page.waitForTimeout(250);
    }
    for (let i = 0; i < 20; i += 1) {
      if ((await page.locator('.overlay-slot .overlay, .overlay').count()) === 0) break;
      await page.waitForTimeout(100);
    }
  }

  if (act) await act(page);

  const found = await page.evaluate(survey, PRIMARY_SELECTOR);
  const onScreen = found.filter((t) => !t.scrolled);
  const worst = onScreen.reduce((a, t) => (t.frac < a ? t.frac : a), 1);
  console.log(`\n${label}: ${onScreen.length} on screen, ${found.length - onScreen.length} behind a scroll, highest at ${Math.round(worst * 100)}%`);

  for (const t of onScreen) {
    const primary = t.primary;
    const zone = t.frac > EASY ? 'easy   ' : t.frac > 0.3 ? 'stretch' : 'HARD   ';
    if (primary || t.frac <= EASY) {
      console.log(`  ${zone} ${String(Math.round(t.frac * 100)).padStart(3)}%  ${primary ? '*' : ' '} ${t.text} (${t.w}x${t.h})`);
    }
    // Every target, primary or not, owes the 44px rule.
    check(t.w >= TAP && t.h >= TAP,
      `${label}: "${t.text}" is ${t.w}x${t.h}, under the ${TAP}px touch target`);
    // Only the ones pressed every turn owe the thumb.
    if (primary) {
      check(t.frac > HARD,
        `${label}: "${t.text}" is a primary control at ${Math.round(t.frac * 100)}% of the screen — the hard band, where the hand has to shuffle`);
    }
  }
  check(errors.length === 0, `${label}: the page reported ${errors[0] ?? ''}`);
  await page.close();
}

await look('title');
await look('travel');
await look('act menu', async (p) => {
  await p.locator('button', { hasText: /^Act$/ }).click();
  await p.waitForTimeout(600);
});
await look('battle', async (p) => {
  await p.evaluate(() => window.landnam.fight(3));
  await p.waitForTimeout(900);
});
await look('settings', async (p) => {
  await p.locator('button.gear').click();
  await p.waitForTimeout(500);
});
await look('band', async (p) => {
  await p.locator('button', { hasText: /^Band$/ }).click();
  await p.waitForTimeout(500);
});
if (COLONY) {
  await look('colony work', null, COLONY);
  await look('colony build', async (p) => {
    const build = p.locator('.shell button', { hasText: /^Build$/i }).first();
    if (await build.count()) { await build.click().catch(() => {}); await p.waitForTimeout(600); }
  }, COLONY);
} else {
  console.log('\n(no /tmp/colony.json — the settled screens were not measured)');
}

await browser.close();

if (fail.length > 0) {
  for (const said of fail) console.error(`reach: ${said}`);
  process.exit(1);
}
console.log(`\nreach OK at ${W}x${H} — every target clears ${TAP}px, `
  + 'and every primary control is under the thumb');

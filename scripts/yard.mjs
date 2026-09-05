// The yard bar: can the settled half of the game be played on a phone?
//
// 12.1. The steading screens were outside every automated bar — `reach.mjs`
// measures them only when a colony save exists at a path `bars.mjs` never
// writes, and `look.mjs` has no yard scene — so the one time anybody looked
// (Playwright, 390x844, day 34, six people, 2026-09-04) it found the Build tab
// opening on ZERO build rows, behind 527px of needs, room, rations and the
// door out. Nothing would have caught that, and nothing would catch it coming
// back.
//
// What this asserts is what 12.1 promised, and each one is a thing a
// screenshot would pass:
//
//   1. The yard turns its own days. One tap on the colony screen and the day
//      is one later — the loop the winter counsel exists for used to cost
//      five taps around the road.
//   2. The build list is the first thing on the Build tab, at scroll 0, and
//      the door out is below the last of it rather than above the first.
//   3. The counsel — the sentence naming the largest lever this project has
//      measured — is rendered beside the roster it instructs, not on the
//      other tab.
//   4. Nothing on either tab is off the bottom of a small phone.
//
// Needs a coast build. Run through `node scripts/bars.mjs`, or alone with
// `node scripts/yard.mjs`.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('yard: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`yard: ${PAGE} is missing. Run \`npm run build\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});

/** Land, plant a steading through the debug hook, and walk into it. */
async function inTheYard(page) {
  await page.goto(`file://${process.cwd()}/${PAGE}`);
  await page.waitForTimeout(700);
  const seed = page.locator('input').first();
  if (await seed.count()) await seed.fill(process.env.SEED ?? 'yard-bar');
  await page.locator('button', { hasText: /Take the land/i }).first().click();
  await page.waitForTimeout(800);

  const founded = await page.evaluate(() => {
    const api = window.landnam;
    return api.settle ? api.settle() : null;
  });
  if (founded !== true) return false;
  await page.waitForTimeout(600);

  // Matched on the deed's LABEL, not anywhere in its text: "Rest — pass the
  // day at the steading" carries the same words and comes first in the sheet.
  const act = page.locator('.action-slot button', { hasText: /^Act$/ }).first();
  await act.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  const enter = page.locator('.overlay button')
    .filter({ has: page.locator('.deed-label', { hasText: /^The steading$/ }) })
    .first();
  if (!(await enter.count())) return false;
  await enter.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(700);
  return true;
}

/**
 * Clear whatever the game is saying, so the next tap reaches the panel under
 * it. Passing a day can draw a card, an aftermath or a lesson — which is the
 * point of mounting the overlay in the yard at all (12.1) — and a bar that
 * clicked straight through would report the tab as empty rather than covered.
 */
async function clearOverlay(page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator('.overlay').first();
    if (!(await overlay.count())) return;
    const go = overlay.locator('button').last();
    if (!(await go.count())) return;
    await go.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

const day = (page) => page.evaluate(() => {
  const s = document.querySelector('.topbar .stat .stat-value');
  return s ? Number(s.textContent) : null;
});

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  const at = `${size.width}x${size.height}`;
  const page = await browser.newPage({ viewport: size, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  if (!(await inTheYard(page))) {
    console.error(`yard: could not reach the steading at ${at}, so this did NOT run.`);
    await browser.close();
    process.exit(2);
  }

  // --- 1. The yard turns its own day ---
  const before = await day(page);
  const rest = page.locator('.action-slot button', { hasText: /^Rest$/ }).first();
  check(await rest.count() > 0, `yard ${at}: the steading has no way to pass a day`);
  if (await rest.count()) {
    await rest.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    const after = await day(page);
    check(
      before !== null && after === before + 1,
      `yard ${at}: one tap on Rest moved the day ${before} -> ${after}, not by one`,
    );
    // And it did not throw the player back onto the road to do it.
    const stillIn = await page.locator('.action-slot button', { hasText: /^Back to the land$/ })
      .count();
    check(stillIn > 0, `yard ${at}: passing a day in the yard left the yard`);
  }

  // --- 3. The counsel sits with the roster it instructs (Work tab) ---
  await clearOverlay(page);
  const work = page.locator('.action-slot button', { hasText: /^Work$/ }).first();
  if (await work.count()) { await work.click().catch(() => {}); await page.waitForTimeout(350); }
  const workTab = await page.evaluate(() => {
    const slot = document.querySelector('.hint-slot');
    return {
      crew: !!slot?.querySelector('.crew'),
      counsel: !!slot?.querySelector('.mark-counsel'),
    };
  });
  check(workTab.crew, `yard ${at}: the Work tab has no roster`);
  // The counsel only speaks when the mark is live and a safe move exists, so
  // its ABSENCE is not a fault — being on the wrong tab is. Asserted as: if it
  // is anywhere on this screen, it is in the same slot as the roster.
  const counselStrayed = await page.evaluate(() => {
    const slot = document.querySelector('.hint-slot');
    const anywhere = document.querySelectorAll('.mark-counsel').length;
    const inSlot = slot ? slot.querySelectorAll('.mark-counsel').length : 0;
    return anywhere > 0 && inSlot === 0;
  });
  check(!counselStrayed, `yard ${at}: the counsel is on screen but not with the roster`);

  // --- 5. The standing order is on the tab it commands, and it works ---
  //
  // 12.2. The order sets the jobs in the roster above it, so it belongs on
  // Work; and it is one tap, which is the entire claim of the item — 66
  // assignment taps a saga became this. A control that is present but does
  // not change the state on a tap would pass a screenshot and fail a player.
  const orders = await page.evaluate(() => {
    const slot = document.querySelector('.hint-slot');
    const mark = slot?.querySelector('.room-mark.orders');
    const btn = mark?.querySelector('button');
    return mark
      ? { head: mark.querySelector('.mark-head')?.textContent?.trim() ?? '', label: btn?.textContent?.trim() ?? '' }
      : null;
  });
  check(orders !== null, `yard ${at}: the Work tab has no standing-orders control`);
  if (orders) {
    check(
      /No standing orders/i.test(orders.head),
      `yard ${at}: a fresh steading opens already under orders — "${orders.head}"`,
    );
    const give = page.locator('.hint-slot .room-mark.orders button').first();
    await give.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    await clearOverlay(page);
    const after = await page.evaluate(() => {
      const mark = document.querySelector('.hint-slot .room-mark.orders');
      return {
        head: mark?.querySelector('.mark-head')?.textContent?.trim() ?? '',
        lit: Boolean(document.querySelector('.hint-slot .room-mark.orders.on')),
        stored: window.landnam?.state?.().settlement?.orders ?? null,
      };
    });
    check(
      after.stored === 'mark',
      `yard ${at}: one tap on the order left the settlement at "${after.stored}"`,
    );
    check(
      /Under standing orders/i.test(after.head) && after.lit,
      `yard ${at}: the order was given but the panel still reads "${after.head}"`,
    );
  }

  // --- 2. The Build tab opens on the build list ---
  const build = page.locator('.action-slot button', { hasText: /^Build$/ }).first();
  check(await build.count() > 0, `yard ${at}: there is no Build tab`);
  if (await build.count()) {
    await build.click().catch(() => {});
    await page.waitForTimeout(400);
    const tab = await page.evaluate(() => {
      const slot = document.querySelector('.hint-slot');
      if (!slot) return null;
      const box = slot.getBoundingClientRect();
      const rows = [...slot.querySelectorAll('.build')];
      const first = rows[0]?.getBoundingClientRect();
      const last = rows[rows.length - 1]?.getBoundingClientRect();
      const leave = slot.querySelector('.leaving button')?.getBoundingClientRect();
      return {
        scrollTop: slot.scrollTop,
        rows: rows.length,
        // Visible means inside the slot's own box with nothing scrolled away.
        firstTop: first ? Math.round(first.top - box.top) : null,
        slotHeight: Math.round(box.height),
        lastBottom: last ? Math.round(last.bottom - box.top) : null,
        leaveTop: leave ? Math.round(leave.top - box.top) : null,
      };
    });
    check(
      tab && tab.rows > 0,
      `yard ${at}: the Build tab shows no buildings at all`
        + ` (${tab ? `${tab.rows} rows in a ${tab.slotHeight}px slot` : 'no hint slot'})`,
    );
    if (tab && tab.rows > 0) {
      check(
        tab.scrollTop === 0 && tab.firstTop !== null && tab.firstTop < tab.slotHeight,
        `yard ${at}: the first build row opens ${tab.firstTop}px into a ${tab.slotHeight}px slot`
          + ' — the tab does not open on its own list',
      );
      if (tab.leaveTop !== null) {
        check(
          tab.lastBottom !== null && tab.leaveTop >= tab.lastBottom,
          `yard ${at}: the door out is drawn above the build list`
            + ` (leave at ${tab.leaveTop}px, last row ends ${tab.lastBottom}px)`,
        );
      }
    }
  }

  // --- 6. The job picker is reachable, and holds still to be tapped ---
  //
  // 12.4. This is where the steading half of the game is actually played and
  // nothing had ever looked: the one measurement taken (Playwright,
  // 2026-09-04) found the picker overflowing at 320x568 with nothing to
  // scroll it, and re-taken on 2026-09-05 it was worse — *Healer* with its
  // centre at 109% of the viewport and *Stand them down* at 119%, the latter
  // being the only way to take somebody off a job.
  //
  // THREE ASSERTIONS, AND THE MIDDLE ONE IS THE ONE THAT EARNED ITS KEEP.
  // The first fix for the overflow made `.hint-slot` shrink to yield, which
  // put it in a feedback loop with the map canvas that sizes itself to its
  // own slot: the first crew row walked 159px to 88px over thirty frames and
  // then jumped to 229. A control that MOVES is a control you cannot tap, and
  // it passes any check that only asks where things are once.
  await page.locator('.action-slot button', { hasText: /^Work$/ }).first()
    .click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
  const first = page.locator('.crew-row').first();
  if (await first.count()) {
    const walk = await page.evaluate(() => new Promise((done) => {
      const row = document.querySelector('.crew-row');
      if (!row) { done([]); return; }
      const seen = new Set();
      let n = 0;
      const tick = () => {
        const r = row.getBoundingClientRect();
        seen.add(`${Math.round(r.top)},${Math.round(r.height)}`);
        n += 1;
        if (n < 30) requestAnimationFrame(tick);
        else done([...seen]);
      };
      requestAnimationFrame(tick);
    }));
    check(
      walk.length === 1,
      `yard ${at}: the roster will not hold still — the first row took`
        + ` ${walk.length} different positions over thirty frames (${walk.join(' ')})`,
    );

    // Scrolled down the roster FIRST, because that is the state the next
    // check is about and a slot sitting at zero cannot show a jump to zero.
    await page.evaluate(() => {
      const slot = document.querySelector('.hint-slot');
      if (slot) slot.scrollTop = slot.scrollHeight;
    });
    await page.waitForTimeout(150);
    const scrolled = await page.evaluate(() => document.querySelector('.hint-slot')?.scrollTop ?? 0);

    // AND THE ROW TAPPED IS ONE THAT IS ACTUALLY ON SCREEN. The first cut of
    // this scrolled to the bottom and then tapped `.crew-row` — the row at
    // the TOP — and reported the roster jumping back to zero. It was the
    // browser doing what browsers do: clicking a button focuses it, and a
    // focused element gets scrolled into view. The bar was measuring its own
    // reach, not the game's behaviour, and it cost three wrong fixes before
    // the setter was instrumented and said so.
    const visible = page.locator('.crew-row').nth(
      Math.max(0, (await page.locator('.crew-row').count()) - 1),
    );
    await visible.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(350);
    check(
      await page.locator('.crew-row.selected').count() > 0,
      `yard ${at}: tapping a name in the roster selected nobody`,
    );
    // AND THE LIST STAYS WHERE THE PLAYER LEFT IT. 12.2 reset this slot's
    // scroll whenever the picker opened as well as on a tab switch, so a
    // player who scrolled down to the sixth name and tapped it watched the
    // roster jump back to the first. It does not eat the tap — measured, the
    // selection still lands — but the list moving under the finger on every
    // tap is its own fault, and nothing was watching for it.
    if (scrolled > 0) {
      const after = await page.evaluate(() => document.querySelector('.hint-slot')?.scrollTop ?? 0);
      check(
        after > 0,
        `yard ${at}: tapping a name threw the roster back to the top`
          + ` (scrollTop ${scrolled} -> ${after})`,
      );
    }

    const picker = await page.evaluate((h) => [...document.querySelectorAll('.action-slot button')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          label: (b.textContent ?? '').trim().slice(0, 24),
          centre: Math.round((((r.top + r.bottom) / 2) / h) * 100),
        };
      }), size.height);
    check(
      picker.length > 2,
      `yard ${at}: the job picker did not open (${picker.length} controls)`,
    );
    const beyond = picker.filter((b) => b.centre > 100);
    check(
      beyond.length === 0,
      `yard ${at}: ${beyond.length} picker controls have their centre off the screen — `
        + beyond.map((b) => `${b.label} at ${b.centre}%`).join(', '),
    );
  }

  // --- 4. Nothing on either tab is off the bottom ---
  const spill = await page.evaluate((h) => {
    const out = [];
    for (const b of document.querySelectorAll('.action-slot button')) {
      const r = b.getBoundingClientRect();
      if (r.height > 0 && r.bottom > h + 1) out.push(b.textContent?.trim() ?? '?');
    }
    return out;
  }, size.height);
  check(spill.length === 0, `yard ${at}: off the bottom of the screen — ${spill.join(', ')}`);

  check(errors.length === 0, `yard ${at}: page errors — ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();

if (fail.length) {
  console.error(`yard: ${fail.length} FAILED`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log('yard: the steading turns its own days, opens on its build list, and fits the phone');

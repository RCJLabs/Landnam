// The ending bar: does the last thing a run says get the screen to itself?
//
// The ending is one of the two screens art queue item 20 is about, and it was
// the one with no instrument at all. Everything else on this line stops the
// moment a run stops, so the screen that the whole run is FOR was measured by
// nothing — the class that gives it the screen, the rule under its title and
// the capital that opens it could all have gone quietly.
//
// It gets there by starving, which is a real ending the game reaches on its
// own: empty the store and camp. No lever ends a run outright, and one should
// not be added for a bar — a bar that fakes its subject is measuring itself.
import { existsSync } from 'node:fs';

const PAGE = 'dist/app.html';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {
  console.error('ending: playwright-core is not installed, so this did NOT run.');
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error(`ending: ${PAGE} is missing. Run \`npm run build\`.`);
  process.exit(2);
}

const fail = [];
const check = (ok, said) => { if (!ok) fail.push(said); };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`file://${process.cwd()}/${PAGE}`);
await page.waitForTimeout(700);
const seed = page.locator('.overlay.title input').first();
if (await seed.count()) await seed.fill(process.env.SEED ?? 'ending-bar');
await page.locator('button', { hasText: /Take the land/i }).first().click();
await page.waitForTimeout(900);

const clearCards = async () => {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.end-card').count()) return;
    const b = page.locator('.overlay .card button').first();
    if (!(await b.count())) return;
    await b.click({ timeout: 900 }).catch(() => {});
    await page.waitForTimeout(160);
  }
};
await clearCards();

// Empty the store and then live in it. `stock` is a playtest lever for
// skipping the part of a run that is not being measured; the DYING is done
// by the game, one camped night at a time, exactly as it would happen.
await page.evaluate(() => window.landnam.stock(0, 0));
let days = 0;
for (let d = 0; d < 90; d += 1) {
  if (await page.locator('.end-card').count()) break;
  // A lesson card left over the action bar swallows the Act tap and the band
  // never spends the day — the same interception that cost `procession` a
  // morning. Clear whatever is open immediately before reaching for Act.
  await page.evaluate(() => {
    document.querySelectorAll('.overlay button').forEach((n) => n.remove());
  });
  const act = page.locator('.action-slot button', { hasText: /^Act$/ }).first();
  if (!(await act.count())) break;
  await act.click({ timeout: 1500 }).catch(() => {});
  const camp = page.locator('.overlay button').filter({ hasText: /^Camp/i }).first();
  await camp.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  await camp.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(240);
  await clearCards();
  days = d + 1;
}

const end = await page.evaluate(() => {
  const card = document.querySelector('.end-card');
  if (!card) return null;
  const overlay = card.closest('.overlay');
  const h2 = card.querySelector('h2');
  const prose = [...card.querySelectorAll('.saga-prose')];
  const cap = card.querySelector('.end-capital');
  const line = prose[0] ? parseFloat(getComputedStyle(prose[0]).lineHeight) : 0;
  const capBox = cap
    ? cap.getBoundingClientRect().height + parseFloat(getComputedStyle(cap).marginTop)
    : 0;
  return {
    title: h2?.textContent?.trim() ?? '',
    chapters: prose.length,
    capitals: card.querySelectorAll('.end-capital').length,
    rule: parseFloat(getComputedStyle(h2).borderBottomWidth),
    ground: getComputedStyle(overlay).backgroundColor,
    line,
    capBox,
  };
});

if (!end) {
  check(false, `starved for ${days} days and never reached an ending, so nothing was measured`);
} else {
  console.log(`ending: day ${days} — "${end.title}" in ${end.chapters} chapters, ` +
    `${end.capitals} capital, rule ${end.rule}px, ground ${end.ground}`);

  // THE RUN'S LAST WORD GETS THE SCREEN. The ordinary overlay wash is
  // translucent and left the travel HUD readable behind the ending — a day
  // counter and a half-cut "HEA" over the saga the run just wrote.
  const opaque = /^rgb\(/.test(end.ground);
  check(opaque, `the ending sits on ${end.ground}, so the run's instruments ` +
    'still show through the last thing it has to say');

  check(end.rule >= 1, 'the ending title has lost its rule');
  check(end.chapters > 0, 'the ending card has no saga in it');

  // ONE capital, and it has to cover TWO WHOLE LINES. Both drop caps on this
  // game were first sized by eye and both came out about a line and a
  // quarter tall, so the paragraph's second line wrapped short around
  // nothing and the block read as a typesetting fault.
  //
  // The first cut of this claim said only "between one line and two", which
  // is exactly the range the defect lives in: watched against the original
  // 34px-on-0.84 capital it went green. The float has to land JUST UNDER two
  // lines — under, because a float even half a pixel over spills onto a
  // third line and the same fault comes back one line lower.
  check(end.capitals === 1,
    `${end.capitals} illuminated capitals on one ending — the flourish is that it is rare`);
  const two = end.line * 2;
  check(end.capBox <= two && end.capBox >= two - 6,
    `the capital's box is ${Math.round(end.capBox)}px against two ${Math.round(end.line)}px ` +
      `lines (${Math.round(two)}px), so the text wraps around a fraction of a line`);
}

check(errors.length === 0, `the page reported ${errors[0] ?? ''}`);

await browser.close();

if (fail.length) {
  for (const said of fail) console.error(`ending: ${said}`);
  process.exit(1);
}
console.log("ending: the run's last word gets the screen to itself");

// A hand that drew this (art queue item 18).
//
// The last item in the art queue is not a feature. It asks whether all of it
// looks like one hand, and the way to answer that is to count.
//
// Counted, on the day it was written: 93 distinct colours across the 18 files
// in `render/`, 182 times over, with 140 pairs closer to each other than
// dE 8 — the threshold below which two colours are the same colour written
// twice — spread across DIFFERENT files. Twenty-six colours had two or more
// authors. Five were exact duplicates, at dE 0.0, of a colour `style.css`
// already had a name for.
//
// The gold was the worst of it, and the worst of the gold was mine. `--gold`
// is `#d3a441` in the stylesheet; `battle.ts`, `fieldWeather.ts`,
// `figures.ts` and `look.ts` each spell it out again; and `render/knot.ts`,
// shipped an hour before this audit, wrote it a sixth way as
// `rgba(211,164,65,...)` — which is the same colour in decimal. One colour,
// six spellings, and no way for any of them to learn that another had moved.
//
// So this file is the ink. It holds ONLY the colours with more than one
// author — the ones where "a hand" is a claim about more than one file. The
// sixty-seven that belong to a single painter stay with that painter, because
// a shared name for a colour only one place uses is bureaucracy, not a voice.
//
// What a person is made of is NOT here. That lives in `render/look.ts`,
// which is the older and more specific rule, and this file defers to it.
//
// `test/palette.test.ts` keeps it true. A name that can be ignored is a
// suggestion; the test makes it the only spelling there is.

/** Undyed wool and lamplight: the warm half of everything. */
export const PARCHMENT = '#e8dcc0';
export const GOLD = '#d3a441';
export const EMBER = '#e0a94f';
export const SUN = '#ffe9b8';
export const BRASS = '#c9a468';
export const RUST = '#c2703a';
export const BLOOD = '#b23b2e';

/** Sea light and cold metal: the other half, and the foe's half. */
/*
 * TWO FILES ALREADY DISAGREED ABOUT WHAT "IRON" MEANT, which is a worse
 * fault than any repeated literal and the one that most deserves this file.
 * `gear.ts` had `const IRON = '#9fb0c4'` for an axe head; `look.ts` exports
 * `IRON = '#5b6570'` for a helm. Same word, same directory, two colours, and
 * a reader of either would have been confident and wrong.
 *
 * They are both real and both wanted — a pale edge and a dark mass — so they
 * are kept and told apart by name rather than merged.
 */
export const PALE_IRON = '#9fb0c4';
export const STEEL = '#cfd8dc';
export const IRON = '#5b6570';
export const SLATE = '#3f4a5a';
export const WATER = '#2e5468';
export const SKY = '#8b9aa8';
export const HAZE = '#a8afb2';
export const SNOW = '#dfe6ea';

/** What the world is built out of. */
export const SKIN = '#c6a184';
/*
 * `#8a6f43` is `gear.ts`'s HAFT, and six files use it — for an axe handle,
 * for a shield board, for a warm shield ground in `look.ts`'s WARM. It keeps
 * the name of the thing it was named for. The greyer `#8a7c5e` had no name
 * anywhere and gets one, so the two browns stop being told apart by eye.
 */
export const HAFT = '#8a6f43';
export const ROPE = '#8a7c5e';
export const TIMBER = '#3a3324';
export const MOSS = '#7d9150';
export const SOOT = '#2b2a22';
export const INK = '#14110d';
export const EDGE = '#463c2c';

/**
 * The two ends of the range, named because they are written both ways.
 *
 * `battle.ts` had `#000` and four other files had `#000000`, which is two
 * spellings of black before anybody has disagreed about anything.
 */
export const WHITE = '#ffffff';
export const BLACK = '#000000';

/**
 * The colours `style.css` also names, and the name it uses.
 *
 * The stylesheet declares its own `:root` block rather than being written
 * from here at boot, and that is deliberate: a page that waits for JavaScript
 * to learn what colour its text is flashes on the way in. So there are two
 * copies — and `test/palette.test.ts` reads `style.css` and asserts they say
 * the same thing, which is what makes two copies safe rather than a promise
 * that they will be kept in step.
 */
export const NAMED_IN_CSS: ReadonlyArray<readonly [string, string]> = [
  ['ink', INK],
  ['edge', EDGE],
  ['parchment', PARCHMENT],
  ['gold', GOLD],
  ['blood', BLOOD],
  ['moss', MOSS],
];

/**
 * Every colour this file names, for the test that nobody respells them.
 *
 * Built from the exports rather than typed out a second time, because a list
 * of colours that has to be kept in step with a list of colours is the exact
 * fault this file exists to remove.
 */
export const SHARED: ReadonlyArray<readonly [string, string]> = Object.entries({
  PARCHMENT, GOLD, EMBER, SUN, BRASS, RUST, BLOOD,
  PALE_IRON, STEEL, IRON, SLATE, WATER, SKY, HAZE, SNOW,
  SKIN, HAFT, ROPE, TIMBER, MOSS, SOOT, INK, EDGE,
  WHITE, BLACK,
});

/**
 * A palette colour at less than full strength.
 *
 * `render/knot.ts` was the reason this exists, and it was the sharpest single
 * finding of the audit: shipped an hour earlier, it wrote the gold as
 * `rgba(211,164,65,0.62)`, which is `#d3a441` in decimal, which is `GOLD`,
 * which is `--gold`. A sixth spelling of one colour, added by the item that
 * was itself about having one place for a thing. It needed an alpha and hex
 * has nowhere to put one, so it wrote the colour out again — which is what
 * always happens when the shared thing cannot do what the caller needs.
 */
export function alpha(hex: string, a: number): string {
  const h = hex.slice(1);
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

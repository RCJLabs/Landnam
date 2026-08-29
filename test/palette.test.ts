import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLD, NAMED_IN_CSS, SHARED, alpha } from '../src/render/palette';
import { COLD, WARM, folkLook } from '../src/render/look';
import { BLOOD, HAFT, PARCHMENT, SLATE, WATER } from '../src/render/palette';

const RENDERERS = readdirSync('src/render').filter((n) => n.endsWith('.ts'));
const read = (f: string): string => readFileSync(`src/render/${f}`, 'utf8');

describe('one hand drew this', () => {
  // THE CLAIM OF THE ITEM, and the only thing that keeps it true. A shared
  // name for a colour is a suggestion until respelling it is an error.
  //
  // Counted before this file existed: 93 distinct colours across the 18
  // renderers, 182 times over, 140 pairs closer than dE 8 in DIFFERENT
  // files, and 26 colours with two or more authors. Five were exact
  // duplicates of a colour `style.css` already had a name for.
  it('spells a shared colour in exactly one place', () => {
    const offences: string[] = [];
    for (const f of RENDERERS) {
      if (f === 'palette.ts') continue;
      const src = read(f);
      for (const [name, hex] of SHARED) {
        const re = new RegExp(`(['"\`])${hex}\\b`, 'i');
        if (re.test(src)) offences.push(`${f} spells ${hex} out instead of ${name}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('gives each colour one name and each name one colour', () => {
    // A palette that has drifted internally is the same fault one level in.
    const byHex = new Map<string, string[]>();
    for (const [name, hex] of SHARED) {
      const k = hex.toLowerCase();
      byHex.set(k, [...(byHex.get(k) ?? []), name]);
    }
    const doubled = [...byHex].filter(([, names]) => names.length > 1);
    expect(doubled).toEqual([]);
    expect(new Set(SHARED.map(([n]) => n)).size).toBe(SHARED.length);
  });

  it('says the same thing the stylesheet says', () => {
    // `style.css` keeps its own `:root` block so the page does not wait for
    // JavaScript to learn what colour its text is. Two copies are safe only
    // while something checks they agree.
    const css = readFileSync('src/style.css', 'utf8');
    for (const [name, hex] of NAMED_IN_CSS) {
      const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\b`));
      expect(m, `style.css does not define --${name}`).toBeTruthy();
      expect(m![1]!.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it('lets a colour be dimmed without being written out again', () => {
    // `render/knot.ts` needed a gold at 62% and hex has nowhere to put an
    // alpha, so it wrote `rgba(211,164,65,0.62)` — a sixth spelling of the
    // one colour, added by the item that was about having one place for a
    // thing. That is what always happens when the shared thing cannot do
    // what the caller needs.
    expect(alpha(GOLD, 0.62)).toBe('rgba(211,164,65,0.62)');
    expect(alpha('#fff', 1)).toBe('rgba(255,255,255,1)');
  });
});

describe('the shield paint is the game’s own ink', () => {
  it('draws its warm grounds and its cold ones from the palette', () => {
    // A shield painted in a colour nothing else in the game uses is a shield
    // from a different game.
    expect(WARM).toContain(BLOOD);
    expect(WARM).toContain(GOLD);
    expect(WARM).toContain(PARCHMENT);
    expect(WARM).toContain(HAFT);
    expect(COLD).toContain(SLATE);
    expect(COLD).toContain(WATER);
  });
});

describe('nobody keeps a second wardrobe', () => {
  // `steadingView.ts` dressed the household's children from three of
  // look.ts's six wools, copied out. CLAUDE.md's first pillar: a view that
  // invents its own colours for a person has broken it.
  it('keeps look.ts’s wardrobe inside look.ts', () => {
    // THE TEST THAT ACTUALLY GUARDS THE PILLAR, and the first three did not.
    // They exercise `folkLook`, which is fine and stays fine while a view
    // quietly keeps its own list beside it — watched against exactly the
    // copied wardrobe this item removed, all three stayed green.
    //
    // The wools and hairs are look.ts's own; they are not in the shared
    // palette, because only one file should ever name them. So the claim is
    // simply that no other renderer contains one.
    const look = readFileSync('src/render/look.ts', 'utf8');
    const wardrobe = ['WOOL', 'HAIR'].flatMap((list) => {
      const body = look.match(new RegExp(`const ${list} = \\[([^\\]]+)\\]`))![1]!;
      return body.split(',').map((c) => c.trim().replace(/^['"]|['"]$/g, ''));
    });
    expect(wardrobe.length).toBeGreaterThan(6);
    const offences: string[] = [];
    for (const f of RENDERERS) {
      if (f === 'look.ts' || f === 'palette.ts') continue;
      const src = readFileSync(`src/render/${f}`, 'utf8');
      for (const c of wardrobe) {
        if (new RegExp(`(['"\`])${c}\\b`, 'i').test(src)) {
          offences.push(`${f} keeps its own copy of ${c}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it('dresses the same name the same way every time', () => {
    expect(folkLook('Gudrid').tunic).toBe(folkLook('Gudrid').tunic);
    expect(folkLook('Gudrid').skin).toBe(folkLook('Ozur').skin);
  });

  it('opens the whole wardrobe, not the half a copied list leaves', () => {
    const names = Array.from({ length: 200 }, (_, i) => `child-${i}`);
    const worn = new Set(names.map((n) => folkLook(n).tunic));
    // The bug shipped exactly three. Six is what look.ts actually holds.
    expect(worn.size).toBeGreaterThan(3);
  });

  it('never puts a child in a colour the wardrobe does not have', () => {
    // Read straight out of look.ts, so the wardrobe cannot be widened here
    // without widening it there. The first cut of this let a tunic pass if
    // it merely started with a '#', which no possible return value fails —
    // a test that cannot go red is a comment with a runtime cost.
    const wool = readFileSync('src/render/look.ts', 'utf8')
      .match(/const WOOL = \[([^\]]+)\]/)![1]!;
    const allowed = new Set(
      wool.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')),
    );
    expect(allowed.size).toBe(6);
    const worn = new Set(
      Array.from({ length: 200 }, (_, i) => folkLook(`child-${i}`).tunic),
    );
    expect([...worn].filter((t) => !allowed.has(t))).toEqual([]);
    // And it reaches all of them, so the wardrobe is not half-used again.
    expect(worn.size).toBe(allowed.size);
  });
});

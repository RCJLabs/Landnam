// The teaching must describe THIS game.
//
// `test/lessons.test.ts` holds the MECHANICS of the teaching — that a lesson
// changes nothing, arrives when the thing matters, and is never in the save.
// Every one of those was green while the guide told a new player to tap a
// hall that is not tappable, read a panel under a map that was deleted in
// 8.5, and stand their people shoulder to shoulder with no verb in the game
// that stands anybody anywhere. Mechanics and CONTENT are different claims,
// and nothing was checking the second.
//
// Each ban below is paired with the fact that justifies it, asserted here
// rather than asserted in a comment: if a deleted thing ever comes back, the
// pairing fails and the next reader is told to revisit the ban instead of
// deleting a rule they no longer understand.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GUIDE } from '../src/data/guide';
import { LESSONS } from '../src/data/lessons';

/**
 * The words a player actually reads.
 *
 * ALL of it, now that there is one wording. Until 12.9 the guide showed
 * `section.coast ?? section.body` and a lesson `coast?.body ?? body`, so a
 * stale `body` under a coast rewording was text nobody saw — which is exactly
 * how "Everything costs a day: walking a hex" and "Tap a marked hex to walk"
 * survived 8.5 by nine days. Folding the split is what lets this lint be
 * complete rather than a check on the visible half.
 */
function shown(): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const s of GUIDE) out.push({ id: `guide/${s.id}`, text: s.body });
  for (const l of LESSONS) {
    out.push({ id: `lesson/${l.id}.body`, text: l.body });
    out.push({ id: `lesson/${l.id}.point`, text: l.point });
  }
  return out;
}

const offences = (re: RegExp): string[] => shown()
  .filter((s) => re.test(s.text))
  .map((s) => `${s.id}: ${s.text.match(re)?.[0]}`);

describe('the teaching describes this game', () => {
  it('names no part of the coordinate system that was deleted', () => {
    // THE FACT THIS BAN RESTS ON. 8.5 (2026-08-28) deleted the hex map:
    // there is one build, one coordinate, and the address of everything is a
    // stop on a 26-stop route. `src/hex/` is gone and so is every `at: Hex`.
    // If a hex ever comes back this assertion fails first.
    expect(() => readFileSync('src/hex/index.ts', 'utf8')).toThrow();

    expect(offences(/\bhexe?s?\b|\btiles?\b|\bthe map\b|\bon the map\b/i)).toEqual([]);
  });

  it('promises no way to position a fighter, because there is none', () => {
    // THE FACT. 9.1b took the shove and the dash off the bar and nothing
    // replaced them: the line closes ITSELF (see sim/footwork.ts). A player
    // cannot stand anybody anywhere, so teaching that says to is teaching a
    // control that is not on the screen.
    // Read off the Action union itself rather than a list kept beside it —
    // a list would be a second copy able to drift from the thing it claims
    // to describe, which is the fault this whole file exists about.
    const actions = readFileSync('src/sim/actions.ts', 'utf8');
    const verbs = [...actions.matchAll(/\{ type: '([A-Z_]+)'/g)].map((m) => m[1]!);
    expect(verbs.length, 'no verbs found — the scan is broken, not the game')
      .toBeGreaterThan(10);
    const positioning = verbs.filter((t) => /MOVE|STAND|SHOVE|DASH|RANK|STEP/.test(t));
    expect(positioning, 'a positioning verb exists again — revisit this ban').toEqual([]);

    expect(offences(
      /shoulder to shoulder|stand your people|next to each other|\bshove\b|\bdash\b|push forward a rank/i,
    )).toEqual([]);
  });

  it('names the control that actually opens the steading', () => {
    // THE FACT. The steading is entered from the Act list, by a deed whose
    // label is "The steading" (render/deeds.ts dispatches ENTER_COLONY from
    // it). Nothing anywhere is opened by tapping a hall.
    const deeds = readFileSync('src/render/deeds.ts', 'utf8');
    expect(deeds).toMatch(/label: 'The steading'/);
    expect(deeds).toMatch(/ENTER_COLONY/);

    expect(offences(/tap the hall|tapping the hall/i)).toEqual([]);
  });

  it('names only controls the game actually has', () => {
    // Every control the teaching names by its proper name — "Tap Act", "open
    // the Chart", "the Act button" — has to be a real label. Harvested from
    // the renderers rather than listed here, so a renamed button fails this
    // instead of quietly making the teaching wrong.
    const labels = new Set<string>();
    for (const f of ['ui.ts', 'deeds.ts', 'battleUi.ts', 'colonyUi.ts', 'stripMap.ts']) {
      let src: string;
      try {
        src = readFileSync(`src/render/${f}`, 'utf8');
      } catch {
        continue;
      }
      for (const m of src.matchAll(/button\(\s*'([^']+)'/g)) labels.add(m[1]!);
      for (const m of src.matchAll(/label: '([^']+)'/g)) labels.add(m[1]!);
      for (const m of src.matchAll(/aimButton\('[a-z]+', '([^']+)'/g)) labels.add(m[1]!);
      for (const m of src.matchAll(/'The ([A-Z][a-z]+)'/g)) labels.add(m[1]!);
    }
    expect(labels.size, 'harvested no labels — the scan is broken, not the teaching')
      .toBeGreaterThan(15);

    const named = new Set<string>();
    for (const { text } of shown()) {
      for (const m of text.matchAll(/\b(?:[Tt]ap|[Oo]pen|[Pp]ress) (?:the )?([A-Z][A-Za-z-]*)/g)) {
        named.add(m[1]!);
      }
      for (const m of text.matchAll(/\bThe ([A-Z][A-Za-z-]*) button\b/g)) named.add(m[1]!);
    }
    expect(named.size, 'the teaching names no control at all — the scan is broken')
      .toBeGreaterThan(0);

    const missing = [...named].filter((c) => ![...labels].some(
      (l) => l === c || l.toLowerCase().split(/[^a-z]+/).includes(c.toLowerCase()),
    ));
    expect(missing).toEqual([]);
  });
});

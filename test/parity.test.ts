// The sim's parity contract with the Unreal build, owned by the repo that
// owns the source of truth.
//
// Same arrangement as test/goldenport.test.ts, and for the same reason it
// exists: `port/golden.json` was generated for months by a script that lived
// on one machine and was never committed here, so this repo had no idea the
// contract existed and could move `src/rng.ts` while the Unreal test kept
// passing against yesterday's expectations. A green parity test that cannot
// see one side of the parity is worse than none, because it is reassuring.
//
// `port/parity.json` is the sim's version of that file. This test recomputes
// every reading in it from the live sim and fails if any moved. Regenerate
// with `npm run parity` when a change is deliberate, and copy the file into
// the Unreal project beside golden.json.
//
// Phase 7 item 1 chose C++ on 2026-08-13, which is what makes this load
// bearing rather than nice to have: the TypeScript is the reference
// implementation now, and this file is the only thing that makes that claim
// mean anything.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import parityText from '../port/parity.json?raw';
import exampleText from '../runs/example.json?raw';
import longText from '../runs/long.json?raw';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { canonical, hashOf, worldHash } from '../src/run/headless';
import { generateWorld } from '../src/sim/worldgen';
import { hashString, stream } from '../src/rng';
import { FACETS, NOT_IN_ANY_FACET, readAll, type FacetReading } from '../src/run/parity';
import type { Script } from '../src/run/headless';
import type { GameState, HardshipId } from '../src/state/types';

interface Checkpoint {
  afterActions: number;
  action: string | null;
  firstOf?: true;
  day: number;
  refusedSoFar: number;
  facets: Record<string, FacetReading>;
}
interface Run {
  name: string;
  seed: string;
  hardship: HardshipId | null;
  script: string | null;
  actionCounts?: Record<string, number>;
  worldgenHash?: string;
  worldHash: string;
  checkpoints: Checkpoint[];
}
interface Fixture {
  note: string;
  facets: { id: string; blurb: string }[];
  canonical: {
    note: string;
    numbers: { value: number; text: string }[];
    negativeZero: string;
    emptyObject: string;
    sortedKeys: string;
    nested: string;
    strings: { value: string; text: string }[];
  };
  runs: Run[];
}

/**
 * THE VECTORS RETIRE WITH THE HEXES. Decided 2026-08-27.
 *
 * These readings describe the hex world, and the coast is not a different
 * arrangement of it — it is a different world. Measured: all seven runs fail
 * on the one `worldHash` line before any checkpoint is reached, and 43 of the
 * 48 checkpoints come from `runs/example.json` and `runs/long.json`, which are
 * recorded scripts of HEX actions. Thirteen and eight `MOVE`s carrying
 * `{q, r}`, and on a line `MOVE` does not exist — travel is `WALK` to a stop.
 * Those runs are not stale, they are untranslatable.
 *
 * So they are deleted in job 4 alongside `src/hex/` and `worldgen.ts` rather
 * than regenerated against the coast. Keeping them beside a coast set was the
 * option rejected hardest, because they become unverifiable the moment the hex
 * layer goes — which is precisely what this file's own header calls worse than
 * having no bar at all.
 *
 * Until then the replay below runs on the DEFAULT build, where it still guards
 * the game that ships, and skips on a coast build, where it is measuring a
 * world that build does not have. `where` is checked below: this cannot
 * outlive the decision behind it.
 */
const RETIRES_WITH_HEXES = {
  decided: '2026-08-27',
  because: 'the coast is a different world, not a rearrangement of the hex one — '
    + 'and the recorded runs are scripts of hex actions that a line cannot replay',
  where: 'ROADMAP.md',
  section: 'The parity vectors retire with the hexes',
};

const fixture = JSON.parse(parityText) as Fixture;
const SCRIPTS: Record<string, Script> = {
  'runs/example.json': JSON.parse(exampleText) as Script,
  'runs/long.json': JSON.parse(longText) as Script,
};

function actionsFor(run: Run): Action[] {
  if (!run.script) return [];
  const script = SCRIPTS[run.script];
  if (!script) throw new Error(`parity fixture names a script nobody loaded: ${run.script}`);
  return script.actions;
}

describe('the parity fixture is not stale', () => {
  it('still records why the vectors retire with the hexes', () => {
    // A decision that outlives its record is just a skip with no reason on
    // it. Same arrangement `test/contract.test.ts` uses to keep the port
    // freeze honest, and for the same reason.
    expect(RETIRES_WITH_HEXES.because.length, 'no stated reason').toBeGreaterThan(20);
    const roadmap = readFileSync(RETIRES_WITH_HEXES.where, 'utf8');
    expect(
      roadmap.includes(RETIRES_WITH_HEXES.section),
      `${RETIRES_WITH_HEXES.where} no longer records why the parity vectors retire —`
        + ' either write it back or stop skipping the replay on a coast build',
    ).toBe(true);
  });

  it('covers the runs and facets it claims to', () => {
    expect(fixture.runs.length).toBeGreaterThan(4);
    expect(fixture.facets.map((f) => f.id)).toEqual(FACETS.map((f) => f.id));
    // Bare seeds AND replayed scripts: the first is what the port's opening
    // stage can turn green with worldgen alone, the second is the only kind
    // that reaches battle and colony at all.
    expect(fixture.runs.some((r) => r.script === null)).toBe(true);
    expect(fixture.runs.some((r) => r.script !== null)).toBe(true);
  });

  /**
   * The ramp: one bar per verb, at the action that first exercises it.
   *
   * Without this the scripted runs only checkpoint at 10, 50 and 100 percent,
   * and ten percent of a 1320-action script is action 132 — a hundred days
   * and a dozen verbs in. A port that had CAMP wrong and MOVE right would
   * fail there with no way to tell which, which is the all-or-nothing bar the
   * facets exist to avoid, one level down.
   */
  it('puts a checkpoint after the first appearance of every action type', () => {
    for (const run of fixture.runs) {
      if (!run.script) continue;
      const actions = actionsFor(run);
      const firstOf = new Map<string, number>();
      actions.forEach((a, i) => { if (!firstOf.has(a.type)) firstOf.set(a.type, i); });
      const marks = new Set(run.checkpoints.map((c) => c.afterActions));
      for (const [type, at] of firstOf) {
        expect(marks.has(at + 1), `${run.script}: nothing checks the first ${type} (action ${at})`)
          .toBe(true);
      }
      // And every checkpoint says which verb got it there, so a red mark
      // names the thing to go and look at.
      for (const c of run.checkpoints) {
        if (c.afterActions === 0) expect(c.action).toBeNull();
        else expect(c.action, `${run.script} @${c.afterActions}`).toBe(actions[c.afterActions - 1]!.type);
      }
    }
  });

  /**
   * The one that would otherwise rot silently.
   *
   * Every facet is recomputed from the live sim at every checkpoint. A hash
   * that moved means the sim moved, which is either a deliberate change
   * (regenerate) or a bug — and either way the Unreal side is now asserting
   * against something this repo no longer produces.
   */
  it.skipIf(COAST_IS_A_LINE).each(fixture.runs.map((r) => [r.name, r] as const))(
    'reproduces every reading: %s',
    { timeout: 300_000 },
    (_name, run) => {
      const hardship = run.hardship ?? undefined;
      expect(worldHash(newGame(run.seed, hardship) as GameState)).toBe(run.worldHash);
      // Stage 1's bar: the terrain alone, before names, tracks or places.
      if (run.worldgenHash !== undefined) {
        expect(hashOf(generateWorld(stream(run.seed, 'worldgen'))), `${run.name}: worldgen`)
          .toBe(run.worldgenHash);
      }

      const actions = actionsFor(run);
      let state = structuredClone(newGame(run.seed, hardship));
      let refused = 0;
      let next = 0;

      for (let i = 0; i <= actions.length && next < run.checkpoints.length; i += 1) {
        const mark = run.checkpoints[next]!;
        if (mark.afterActions === i) {
          expect(state.day, `${run.name} @${i}: day`).toBe(mark.day);
          expect(refused, `${run.name} @${i}: refused actions`).toBe(mark.refusedSoFar);
          const live = readAll(state);
          for (const facet of FACETS) {
            const want = mark.facets[facet.id]!;
            const got = live[facet.id]!;
            // Samples first: they are the legible half, and a failure that
            // names the value is worth ten that name a hash.
            expect(got.samples, `${run.name} @${i}: ${facet.id} samples`).toEqual(want.samples);
            expect(got.size, `${run.name} @${i}: ${facet.id} canonical size`).toBe(want.size);
            expect(got.hash, `${run.name} @${i}: ${facet.id} hash`).toBe(want.hash);
          }
          next += 1;
        }
        const action = actions[i];
        if (!action) break;
        const after = apply(state, action);
        if (after === state) refused += 1;
        state = after;
      }
      expect(next, `${run.name}: checkpoints never reached`).toBe(run.checkpoints.length);
    },
  );
});

describe('the canonical form, pinned on its own', () => {
  /**
   * The piece a port can settle on day one, and the likeliest place two
   * languages quietly disagree about identical values.
   *
   * `toPrecision(15)` goes exponential at both ends of the range, `String()`
   * on an integer ALSO goes exponential past 1e21, and negative zero has to
   * come out as plain zero or two implementations hash the same state
   * differently. None of that needs a sim to check, which is exactly why it
   * is worth checking before there is one.
   */
  it('reproduces every stored number', () => {
    for (const { value, text } of fixture.canonical.numbers) {
      expect(canonical(value), `canonical(${value})`).toBe(text);
    }
    // The two hazards the list above cannot carry as plain JSON.
    expect(fixture.canonical.numbers.find((n) => n.value === 1e21)?.text).toBe('1e+21');
    expect(fixture.canonical.numbers.find((n) => n.value === 1e-7)?.text)
      .toBe('1.00000000000000e-7');
  });

  it('reproduces the shapes and the strings', () => {
    expect(canonical(-0)).toBe(fixture.canonical.negativeZero);
    expect(canonical(-0)).toBe('0');
    expect(canonical({})).toBe(fixture.canonical.emptyObject);
    expect(canonical({ b: 2, a: 1, C: 3, '': 0 })).toBe(fixture.canonical.sortedKeys);
    expect(canonical({ z: [1, { y: 'x' }], a: null })).toBe(fixture.canonical.nested);
    for (const { value, text } of fixture.canonical.strings) {
      expect(canonical(value), `canonical(${JSON.stringify(value)})`).toBe(text);
    }
  });

  /**
   * The salt is "landnam-state" followed by a NUL, not by a space.
   *
   * Found the hard way while porting worldgen to C++: the literal in
   * headless.ts is `landnam-state\0${text}`, the NUL is invisible in every
   * editor, and it is why grep calls that file binary. A port that assumes a
   * space gets the FIRST half of every hash right and the second half wrong,
   * which reads like a deep disagreement about the game and is nothing of
   * the kind.
   *
   * Pinned here rather than fixed. Nothing depends on WHICH separator it is,
   * only that both implementations agree — and changing it now would move
   * every stored vector for no gain. What was missing was anybody being able
   * to SEE it, and this is that.
   */
  it('salts the second pass with a NUL, not a space', () => {
    const text = '{}';
    const withNul = hashString(`landnam-state\0${text}`) >>> 0;
    const withSpace = hashString(`landnam-state ${text}`) >>> 0;
    expect(withNul).not.toBe(withSpace);
    expect(hashOf({}).slice(8)).toBe(withNul.toString(16).padStart(8, '0'));
  });

  /**
   * `localeCompare` is not code-unit order, and the port relies on them
   * agreeing.
   *
   * `placeNeighbours` sorts hex keys with `key(a).localeCompare(key(b))`.
   * That is ICU collation, which is a genuinely different function —
   * `'-,'.localeCompare(',')` is -1 where `'-,' < ','` is false — and it is
   * ICU-VERSION dependent, so it is not something a C++ port can copy.
   *
   * It does not have to. On the alphabet a hex key can use — digits, a comma
   * and a minus — the two orderings coincide, which was measured rather than
   * assumed: five worlds, 1872 keys each, identical both ways. The port sorts
   * by bytes and this is what says it may. If a future ICU disagrees, it
   * fails HERE, in the repo that owns the rules, rather than silently in
   * Unreal.
   */
  it('orders hex keys the same by ICU and by code unit', () => {
    for (const seed of ['raven-skerry-317', 'curve-7', 'Þórr-vik']) {
      const keys = Object.keys(generateWorld(stream(seed, 'worldgen')).tiles);
      const icu = [...keys].sort((a, b) => a.localeCompare(b));
      const bytes = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(icu, `${seed}: ICU and code-unit order disagree`).toEqual(bytes);
    }
    // And the two are genuinely different functions, so the agreement above
    // is a fact about the alphabet rather than a tautology.
    expect('-,'.localeCompare(',')).toBe(-1);
    expect('-,' < ',').toBe(false);
  });

  it('sorts keys by code unit, which is what the C++ side must copy', () => {
    // Capitals before lowercase, empty string first. A port that sorts
    // case-insensitively, or by locale, produces a different string for an
    // identical state — and nothing but this would say so.
    expect(fixture.canonical.sortedKeys).toBe('{"":0,"C":3,"a":1,"b":2}');
  });
});

describe('the facets cover the whole state', () => {
  /**
   * The claim that makes "all facets match" mean "the states match".
   *
   * Without this the harness degrades the way every other bar in this repo
   * has been caught degrading: silently, by covering less than it looks like
   * it covers. Add a field to GameState and forget to place it, and every
   * facet still goes green while the new field is checked by nothing at all.
   * So walk a REAL state's own keys — not a hand-typed list, which is how
   * the beat-stream reach test came to be wrong twice — and fail on any key
   * no facet owns.
   */
  it('every field of a real GameState belongs to exactly one facet', () => {
    const state = structuredClone(newGame('parity-partition', 'fair')) as unknown as
      Record<string, unknown>;
    const covered = new Set<string>(NOT_IN_ANY_FACET);
    // What each facet actually reaches, discovered by reading it rather than
    // declared: a facet that stopped covering a field would otherwise still
    // claim it here.
    for (const facet of FACETS) {
      const slice = facet.of(state as unknown as GameState);
      if (slice === state.world) { covered.add('world'); continue; }
      if (slice === state.party) { covered.add('party'); continue; }
      for (const k of Object.keys(slice as Record<string, unknown>)) covered.add(k);
    }
    const orphans = Object.keys(state).filter((k) => !covered.has(k));
    expect(
      orphans,
      `these GameState fields belong to no facet, so the parity harness does not check them: `
        + `${orphans.join(', ')} — place each in a facet in src/run/parity.ts, or add it to `
        + `NOT_IN_ANY_FACET with a reason`,
    ).toEqual([]);
  });

  it('names a reason for everything it deliberately skips', () => {
    // Both exclusions are load bearing and both are easy to get wrong later:
    // prose gets reworded, and the beat stream is CAPPED, so two
    // implementations that agree about the game can still hold different
    // windows of it.
    expect([...NOT_IN_ANY_FACET].sort()).toEqual(['beats', 'saga']);
  });
});

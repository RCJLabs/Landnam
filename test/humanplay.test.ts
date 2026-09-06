// 12.12: runs a person actually played, replayed.
//
// The one fixture in this repo a bot cannot re-record. Everything else the
// suite measures comes from `test/fixtures/harness.ts`, and `PROBE 12.12`
// says how far that is from a person: over 30 settler sagas to day 400 it
// landed 18,733 steading moves by calling the sim directly, and the player's
// interface would have refused all of them — 11,639 taken from the road and
// 7,094 from inside a battle.
//
// A recorded human run is evidence about the game a person can actually
// reach. It is also fragile in exactly the right way: when one stops
// replaying, a rule moved under somebody's saga, and `stoppedAt` names the
// move it moved under. See the README beside the fixtures — the rule is that
// these are never re-recorded to agree with the code.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { replay, type Play } from '../src/record';
import { fnv } from '../src/sim/hash';

const DIR = 'test/fixtures/plays';

interface Stamped extends Play {
  /** The day the recording ends on, written by scripts/play.mjs. */
  endsOn: number;
  /** The state it ends in, hashed. */
  hash: string;
}

const plays = (): { name: string; play: Stamped }[] => readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((name) => ({
    name,
    play: JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8')) as Stamped,
  }));

describe('runs a person played', () => {
  for (const { name, play } of plays()) {
    it(`${name} still replays, move for move`, () => {
      const back = replay(play);
      expect(
        back.stoppedAt,
        `${name}: the rules refused move ${back.stoppedAt} of ${play.acts.length} — `
          + `${JSON.stringify(play.acts[back.stoppedAt])}. A rule moved under a run `
          + 'somebody played. Read it, do not re-record it.',
      ).toBe(-1);
      expect(back.state.day, `${name} ends on a different day`).toBe(play.endsOn);
      const { version: _v, ...rest } = back.state as unknown as Record<string, unknown>;
      void _v;
      expect(fnv(JSON.stringify(rest)), `${name} replays to a different saga`)
        .toBe(play.hash);
    });
  }

  /**
   * THE ITEM'S UNFINISHED HALF, and it fails the day it is finished.
   *
   * A test that quietly passes over an empty folder is a check that cannot
   * fail, which is the thing CLAUDE.md keeps a section about. So this asserts
   * the folder IS empty — it goes red the moment somebody drops a run in,
   * with the one instruction they need. Nobody has to remember step five.
   *
   * Delete this when the first one lands; the loop above is the real bar.
   */
  it('has none yet, because nobody has played one into the repo', () => {
    expect(
      plays().length,
      'A human play has landed — delete this test. The loop above is now the '
        + 'bar, and 12.12 can be marked done in ROADMAP.md.',
    ).toBe(0);
  });
});

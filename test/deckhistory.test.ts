// The history gates 12.14 added, checked where the bot cannot reach.
//
// Two of the ten new cards fired for NEITHER policy over 120 landings each:
// `the-one-we-drove-out` and `the-oath-we-broke`. That is trap 3 in
// CLAUDE.md — an arm that never runs looks exactly like an arm that does not
// work — so the question "is this card reachable at all" is answered here, by
// hand, rather than left as a silence in a probe.
//
// A player drives somebody out and breaks an oath; the harness bot does
// neither. That is a fact about the instrument, and these tests are what let
// the roadmap say so rather than guess.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { isEligible, conditionHolds } from '../src/sim/events';
import { eventById } from '../src/data/events';
import { OATH_FORESWORN } from '../src/data/oaths';
import type { GameState } from '../src/state/types';
import { canFound, foundSettlement } from '../src/sim/site';
import { learnStop } from '../src/sim/coast';
import { ROUTE_STOPS } from '../src/sim/route';

const fresh = (seed = 'deck'): GameState => structuredClone(newGame(seed));

/**
 * Everything the card wants except the history gate under test.
 *
 * Founded through `foundSettlement` rather than by writing a Settlement
 * literal: the shape has five more required fields than the obvious ones and
 * a hand-built stand-in would be a fixture pretending to be a steading.
 */
function settledAt(seed: string): GameState {
  for (let i = 0; i < 60; i += 1) {
    const s = fresh(`${seed}-${i}`);
    s.day = 2;
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      s.party.stop = stop;
      learnStop(s, stop);
      if (canFound(s) && foundSettlement(s)) {
        s.day = 120;
        return s;
      }
    }
  }
  throw new Error('no seed put the band on foundable ground');
}

describe('the history gates can be reached at all', () => {
  it('opens the driven-out card to a band that has driven somebody out', () => {
    const card = eventById('the-one-we-drove-out')!;
    const without = settledAt('outlaw-a');
    expect(isEligible(without, card), 'a band with no outlaws should not see it').toBe(false);

    const with_ = settledAt('outlaw-b');
    with_.outlaws = [{ id: 'p9', name: 'Kettil', since: 90, might: 3 }];
    expect(isEligible(with_, card), 'a band that drove somebody out cannot reach it').toBe(true);
  });

  it('opens the broken-oath card to a band that broke one', () => {
    const card = eventById('the-oath-we-broke')!;
    const kept = fresh('oath-a');
    kept.day = 120;
    expect(isEligible(kept, card)).toBe(false);

    const broke = fresh('oath-b');
    broke.day = 120;
    broke.flags[OATH_FORESWORN] = 1;
    expect(isEligible(broke, card), 'a band that broke an oath cannot reach it').toBe(true);
  });

  it('reads the tally, the jarldom and the rival', () => {
    const s = fresh('gates');
    expect(conditionHolds(s, { c: 'tally', of: 'sackings', min: 3 })).toBe(false);
    s.tally.sackings = 3;
    expect(conditionHolds(s, { c: 'tally', of: 'sackings', min: 3 })).toBe(true);

    expect(conditionHolds(s, { c: 'ruling' })).toBe(false);
    s.jarl = { name: 'Vemund', since: 100 } as GameState['jarl'];
    expect(conditionHolds(s, { c: 'ruling' })).toBe(true);

    expect(conditionHolds(s, { c: 'metRival' })).toBe(false);
    if (s.rival) {
      s.rival.met = true;
      expect(conditionHolds(s, { c: 'metRival' })).toBe(true);
    }

    expect(conditionHolds(s, { c: 'outlawed', min: 1 })).toBe(false);
  });

  it('does not read the jarldom off the flag that means the notice was read', () => {
    // `ruleTaken` is set by the RULE_ON player action — "marks the card as
    // read" — so a band that rules with the proclamation unread must still
    // count as ruling, and a band that is not a jarl must not.
    const s = fresh('rule');
    s.flags['ruleTaken'] = 100;
    expect(conditionHolds(s, { c: 'ruling' }), 'the flag alone made it ruling').toBe(false);
  });
});

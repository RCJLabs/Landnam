// Walking out on a steading.
//
// THE QUESTION THIS ANSWERS, and it was deferred rather than dodged. The
// winter panel named two ways out for a band that cannot reach spring, and
// one of them — walking out and wintering elsewhere — was not a verb: nothing
// anywhere cleared `state.settlement`, and `foundBlocker` answered `settled`
// forever after the first post went in. Earlier on 2026-08-20 the promise was
// withdrawn from the panel, with a note saying that whether it SHOULD be a
// verb was a live design question and removing the sentence did not settle
// it.
//
// This is the answer. The bars below are about the SHAPE — that it costs what
// it is supposed to cost, that it cannot be used as a free look at a site
// report, and that it does not quietly hand the band a windfall or delete its
// children. Whether it is worth anything is a different question with a
// different instrument, and it is settled in balance.test.ts on paired seeds
// against the standard the escape hatch set: saved nobody, killed two.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { pushMode } from '../src/modes';
import { canFound, foundSettlement } from '../src/sim/site';
import { ABANDON_REASON, abandonBlocker, abandonSteading, canAbandon, leaveNote } from '../src/sim/retreat';
import { childrenOf } from '../src/sim/lineage';
import { ABANDON_AFTER, ABANDON_HEART, ABANDON_RECORD } from '../src/data/retreat';
import { ROUTE_STOPS } from '../src/sim/route';
import { walkOff } from './fixtures/stand';
import type { GameState } from '../src/state/types';

describe('the door exists', () => {
  it('gives up the steading, and lets the band found again', () => {
    const state = settled('ret-door');
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    expect(canAbandon(state)).toBe(true);
    expect(abandonSteading(state)).toBe(true);
    expect(state.settlement).toBeUndefined();

    // THE WHOLE POINT. `foundBlocker` answered `settled` forever before this,
    // so a band that walked out would have been homeless for good.
    //
    // Walked, not scanned. On a line `foundBlocker` reads the stretch the
    // band is STANDING on and ignores the hex it is handed, so assigning
    // `party.at` searched twenty-six hundred hexes while the band never left
    // stop 8 — and stop 8 answers `taken`, because the rival fenced the
    // neighbourhood during the days the steading stood there. The search has
    // to move the band, which is also what the claim means: somewhere on
    // this coast they can put posts in again.
    const somewhere = [...Array(ROUTE_STOPS).keys()].find((stop) => {
      state.party.stop = stop;
      return canFound(state);
    });
    expect(somewhere, 'walked out and could never settle again').toBeDefined();
  });

  it('is a real cost in heart, and more than founding gave back', () => {
    const state = settled('ret-heart');
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    state.party.morale = 60;
    abandonSteading(state);
    expect(60 - state.party.morale, 'walking out cost nothing').toBe(ABANDON_HEART);
    // Founding pays +8. If leaving cost that or less the round trip would be
    // free and a player would re-roll sites with it.
    expect(ABANDON_HEART).toBeGreaterThan(8);
  });
});

describe('and it is not a free look at the ground', () => {
  it('refuses a steading whose turf is not settled yet', () => {
    const state = settled('ret-soon');
    state.day = state.settlement!.foundedOn;
    expect(abandonBlocker(state)).toBe('toosoon');
    expect(abandonSteading(state)).toBe(false);
    expect(state.settlement, 'a refused retreat still tore the posts up').toBeTruthy();
  });

  it('refuses a band that is not standing in it', () => {
    const state = settled('ret-away');
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    // `walkOff` self-checks that `atHome` agrees the band has gone, which is
    // exactly what this refusal is built on — assigning `party.at` moved
    // nobody on a line, so the band was still in its own yard and the
    // refusal never came.
    walkOff(state);
    expect(abandonBlocker(state)).toBe('away');
  });

  it('says which of them it is, so the player can act on it', () => {
    const fresh = structuredClone(newGame('ret-why'));
    expect(abandonBlocker(fresh)).toBe('nosteading');
  });
});

describe('the ground remembers and pays nothing', () => {
  /**
   * THE EXPLOIT THIS CLOSES.
   *
   * The `ruin` kind carries loot — it was written for `haunt.ts`, where it is
   * somebody ELSE'S dead steading arriving on a challenge code. Put one on
   * your own map with its loot intact and walking out becomes a way to get
   * your timber back: found, build, abandon, go through the ruin. The cost
   * would fund itself and the whole design falls over.
   */
  it('leaves a ruin where the hall stood, already picked clean', () => {
    const state = settled('ret-ruin');
    const at = state.settlement!.stop;
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    abandonSteading(state);

    const ruin = state.world.places.find((p) => p.kind === 'ruin');
    expect(ruin, 'the ground forgot there was ever a hall on it').toBeTruthy();
    expect(ruin!.stop).toBe(at);
    expect(ruin!.sackedOn, 'the band can loot its own abandoned steading').toBe(state.day);
  });
});

describe('the children come along', () => {
  /**
   * `Settlement.children` is a record kept on the ground it was born on, so
   * the naive retreat deletes them — and `childrenOf` feeds `foodPerDay`, so
   * that would make walking out a way to stop feeding your own children.
   */
  it('carries everyone born there to the next steading', () => {
    const state = settled('ret-kin');
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    state.settlement!.children = [
      { name: 'Ásdís', bornOn: 5, mother: state.party.people[0]!.id },
    ];
    abandonSteading(state);
    expect(state.bairns, 'the children were left standing in an empty yard').toHaveLength(1);

    // Somewhere else on this coast that will take posts — the hex version of
    // this walked `world.tiles`; a line is walked stretch by stretch.
    const somewhere = [...Array(ROUTE_STOPS).keys()].find((stop) => {
      state.party.stop = stop;
      return canFound(state);
    });
    expect(somewhere, 'walked out and could never settle again').toBeDefined();
    state.party.stop = somewhere;
    expect(foundSettlement(state)).toBe(true);
    expect(childrenOf(state).map((c) => c.name)).toEqual(['Ásdís']);
    expect(state.bairns, 'they were carried twice').toBeUndefined();
  });
});

describe('the player can reach it', () => {
  it('is a steading decision, and it puts the band back on the road', () => {
    const state = pushMode(settled('ret-act'), 'COLONY');
    state.day = state.settlement!.foundedOn + ABANDON_AFTER;
    const gone = apply(state, { type: 'ABANDON' });
    expect(gone.settlement).toBeUndefined();
    expect(gone.modes.at(-1), 'left the band staring at a colony that is not there')
      .not.toBe('COLONY');
    expect(gone.saga.at(-1)!.text).toContain('standing empty');
  });

  it('refuses without changing anything the player can see', () => {
    const state = pushMode(settled('ret-refuse'), 'COLONY');
    state.day = state.settlement!.foundedOn;
    expect(apply(state, { type: 'ABANDON' })).toBe(state);
  });
});

describe('old saves', () => {
  it('come forward carrying nobody, which is what they were carrying', () => {
    const save = structuredClone(newGame('ret-old')) as unknown as Record<string, unknown>;
    save['version'] = 35;
    delete save['bairns'];
    const out = migrate(save).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect(out['bairns']).toBeUndefined();
  });
});

function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  return state;
}

// 9.14: the door out says what happened to the bands that took it.
describe('the door out states its record, not only its price', () => {
  it('says nothing at all to a band with no steading', () => {
    const state = newGame('leave-none');
    expect(leaveNote(state)).toBeNull();
  });

  it('names which rule is refusing rather than going quietly grey', () => {
    // Freshly founded: the ten-day floor is refusing, and it must say so.
    const state = settled('leave-toosoon');
    state.settlement!.foundedOn = state.day;
    const note = leaveNote(state)!;
    expect(note.open).toBe(false);
    expect(note.reason).toBe(ABANDON_REASON.toosoon);
    // A refusal carries no price and no record — there is nothing to weigh.
    expect(note.price).toBeUndefined();
    expect(note.record).toBeUndefined();
  });

  it('carries BOTH the price and the record when the door is open', () => {
    // The bug this is for: the panel composed the price and forgot the
    // record, so the screen named what leaving costs and never what it did.
    const state = settled('leave-open');
    state.settlement!.foundedOn = state.day - ABANDON_AFTER - 1;
    const note = leaveNote(state)!;
    expect(note.open).toBe(true);
    expect(note.price).toContain(String(ABANDON_HEART));
    expect(note.record).toBe(ABANDON_RECORD);
  });

  it('keeps the price honest about the heart it actually takes', () => {
    // Named off the constant rather than typed, so a change to what leaving
    // costs cannot leave the sentence behind saying the old number.
    const state = settled('leave-price');
    state.settlement!.foundedOn = state.day - ABANDON_AFTER - 1;
    const heart = state.party.morale;
    abandonSteading(state);
    expect(heart - state.party.morale).toBe(ABANDON_HEART);
  });

  it('states the record as an outcome and an alternative, not as advice', () => {
    // The line must survive being softened into nothing. It has to say that
    // more were killed than saved, and it has to name the other door — a fact
    // with no alternative in it is discouragement, which this game does not do.
    expect(ABANDON_RECORD).toMatch(/more died|more were/i);
    expect(ABANDON_RECORD).toMatch(/stayed/i);
    // And it must not tell the player what to do.
    expect(ABANDON_RECORD).not.toMatch(/\byou should\b|\bdo not\b|\bnever\b/i);
  });
});

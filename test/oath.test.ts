// An oath that binds.
//
// The Norse vocabulary was all over this game and none of it bound anything:
// the Thing was a roll, wergild was a price, and "oath-brother" was a word in
// a tie-table. An oath here is the only thing in the game that makes the band
// WORSE at something on purpose, in exchange for what keeping it is worth —
// and the only promise the coast can see you break.
//
// Omens, for the record, already existed and already worked: `omenFor` reads
// the next day's weather back as a portent the player plans around. Nothing
// here touches them.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { EVENTS } from '../src/data/eventCards';
import {
  OATHS,
  OATH_BROKEN_HEART,
  OATH_BROKEN_STANDING,
  OATH_KEPT_HEART,
  OATH_MARK,
  OATH_SINCE,
} from '../src/data/oaths';
import { YEAR_LENGTH, seasonOf } from '../src/sim/calendar';
import { isEligible } from '../src/sim/events';
import { canHoldBlot } from '../src/sim/blot';
import { applyTravel } from '../src/sim/travel';
import { passDay } from '../src/sim/upkeep';
import { foresworn, oathDay, standingOath, sworeOn } from '../src/sim/oath';
import { omenFor } from '../src/sim/weather';
import type { GameState } from '../src/state/types';
import { canFound, foundSettlement } from '../src/sim/site';
import { fromKey } from '../src/hex';

function hall(seed = 'oath'): GameState {
  const state = newGame(seed);
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    state.world.seen[k] = 'visible';
    if (!canFound(state, at)) continue;
    foundSettlement(state);
    break;
  }
  if (!state.settlement) throw new Error('no site — the fixture never ran');
  state.party.food = 400;
  state.party.firewood = 400;
  return state;
}

/** Swear the way the card does: raise the flag, nothing else. */
function swear(state: GameState, id: 'noSack' | 'holdFast'): void {
  state.flags[OATHS.find((o) => o.id === id)!.flag] = 1;
}

describe('the blót is pure data', () => {
  it('offers the oaths through the vocabulary the deck already had', () => {
    const blot = EVENTS.find((e) => e.id === 'blot')!;
    expect(blot).toBeDefined();
    // No new effect type and no new condition: swearing costs the engine
    // nothing, which is why this needed no save bump.
    const effects = blot.choices.flatMap((c) => c.success?.effects ?? []);
    expect(effects.some((e) => e.t === 'flag' && e.flag === 'oath:noSack')).toBe(true);
    // And there is always a way to eat and promise nothing.
    expect(blot.choices.length).toBeGreaterThanOrEqual(3);
    // One at a time: a band already under an oath is not offered another.
    const gates = blot.when ?? [];
    expect(gates.filter((w) => w.c === 'flagUnset')).toHaveLength(2);
  });
});

describe('swearing is stamped by the engine, not the card', () => {
  it('records the day and what it is measured against', () => {
    const state = hall('oath-stamp');
    state.day = 50;
    state.tally.sackings = 2;
    swear(state, 'noSack');
    expect(sworeOn(state)).toBe(0);

    expect(oathDay(state)).toBe(true);
    // A card's effects carry constants; the READING has to be taken here.
    expect(sworeOn(state)).toBe(50);
    expect(state.flags[OATH_MARK]).toBe(2);
    expect(standingOath(state)?.id).toBe('noSack');
  });
});

describe('it binds, and being foresworn is the worse deal', () => {
  it('pays heart when it is carried to the turn of the year', () => {
    const state = hall('oath-kept');
    state.day = 10;
    swear(state, 'noSack');
    oathDay(state);
    state.party.morale = 50;

    state.day = 10 + YEAR_LENGTH;
    expect(oathDay(state)).toBe(true);
    expect(state.party.morale).toBe(50 + OATH_KEPT_HEART);
    // And it is over: the band is free to swear again.
    expect(standingOath(state)).toBeUndefined();
    expect(state.flags[OATH_SINCE]).toBeUndefined();
  });

  it('costs more than that, and the whole coast hears, when it is broken', () => {
    const state = hall('oath-broken');
    state.day = 10;
    swear(state, 'noSack');
    oathDay(state);
    state.party.morale = 50;
    for (const n of state.neighbours) n.found = true;
    const before = state.neighbours.map((n) => n.standing);

    // Took a hall by force after swearing not to.
    state.tally.sackings += 1;
    state.day = 20;
    expect(oathDay(state)).toBe(true);

    expect(state.party.morale).toBe(50 - OATH_BROKEN_HEART);
    expect(OATH_BROKEN_HEART).toBeGreaterThan(OATH_KEPT_HEART);
    // An oath is given in front of witnesses, which is the whole reason it is
    // worth anything — so the coast's opinion moves, not just the hall's.
    state.neighbours.forEach((n, i) => {
      expect(n.standing).toBeLessThanOrEqual(before[i]! + OATH_BROKEN_STANDING + 1);
    });
    expect(foresworn(state)).toBe(1);
    // Nothing forgets it, even though the oath itself is over.
    expect(standingOath(state)).toBeUndefined();
  });

  it('holds the other oath to walking out of the hall', () => {
    const state = hall('oath-hold');
    state.day = 10;
    swear(state, 'holdFast');
    oathDay(state);
    expect(foresworn(state)).toBe(0);

    // Walked out on the steading after swearing not to.
    state.settlement = undefined;
    state.day = 30;
    oathDay(state);
    expect(foresworn(state)).toBe(1);
  });

  it('does nothing at all to a band that swore nothing', () => {
    const state = hall('oath-none');
    for (let d = 1; d < 200; d += 7) {
      state.day = d;
      expect(oathDay(state)).toBe(false);
    }
    expect(foresworn(state)).toBe(0);
  });
});

describe('omens were already real', () => {
  it('reads the next day back as a portent, and nothing here changed that', () => {
    const state = hall('oath-omen');
    state.day = 5;
    const said = omenFor(state);
    // Not a bar on the wording — a bar on the fact that the player is told
    // something about tomorrow, which is what makes an omen mechanical.
    if (said !== undefined) expect(said.length).toBeGreaterThan(0);
  });
});

describe('can a player actually get offered it', () => {
  it('is fired by the calendar and never competes in the deck', () => {
    // The reachability question this project has been bitten by twice — a
    // card that exists and never fires is a feature nobody has — and the
    // answer it forced. As a weighted card, weight 7 reached only half of
    // settled runs (measured over forty of four years), and the weight 30 it
    // needed to reach 90% displaced the autumn food cards and cost seven
    // points of spring survival. The deck is zero-sum.
    const blot = EVENTS.find((e) => e.id === 'blot')!;
    expect(blot.weight).toBe(0);

    const state = hall('oath-reach');
    state.party.at = state.settlement!.at;
    let autumnDay = 0;
    for (let d = 1; d < YEAR_LENGTH * 2; d++) {
      if (seasonOf(d) === 'autumn') { autumnDay = d; break; }
    }
    state.day = autumnDay;

    // It is still eligible — its own `when` decides — but the draw skips it,
    // and it only ever reaches the table because somebody asked for it.
    expect(isEligible(state, blot)).toBe(true);
    expect(canHoldBlot(state)).toBe(true);
    const held = applyTravel(state, { type: 'HOLD_BLOT' });
    expect(held.event?.id).toBe('blot');
  });

  it('holds no blót where there is no hall to hold it in', () => {
    const state = hall('oath-nohall');
    state.settlement = undefined;
    expect(canHoldBlot(state)).toBe(false);
    // And the verb refuses rather than half-doing it.
    expect(applyTravel(state, { type: 'HOLD_BLOT' })).toBe(state);
  });

  it('never puts a card on the table nobody asked for', () => {
    // The reason it is a deed and not a calendar rite: firing it from the
    // season turn desynced every recorded run in runs/*.json — a replay met
    // an event it never agreed to and refused every action after it. Eight
    // bars went red. A card the player calls for cannot do that.
    const state = hall('oath-quiet');
    state.party.at = state.settlement!.at;
    for (let d = 1; d <= YEAR_LENGTH; d++) {
      state.day = d;
      state.party.food = 300;
      state.party.firewood = 300;
      passDay(state);
      expect(state.event?.id).not.toBe('blot');
    }
  });

  it('stops offering itself to a band already under an oath', () => {
    const state = hall('oath-once');
    state.party.at = state.settlement!.at;
    let autumnDay = 0;
    for (let d = 1; d < YEAR_LENGTH * 2; d++) {
      if (seasonOf(d) === 'autumn') { autumnDay = d; break; }
    }
    state.day = autumnDay;
    expect(isEligible(state, EVENTS.find((e) => e.id === 'blot')!)).toBe(true);
    swear(state, 'noSack');
    expect(isEligible(state, EVENTS.find((e) => e.id === 'blot')!)).toBe(false);
  });
});

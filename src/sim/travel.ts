// TRAVEL mode logic. Pure: (state, action) -> state. Every action costs at
// least a day, and the day is what kills you. The road's shared machinery —
// what a hex costs, what a day advances, what dusk reveals — is road.ts;
// the foraging verbs are gathering.ts; this file is the reducer.

import { cloneState } from '../state/clone';
import { worldBeat } from './beats';
import { key, type Hex } from '../hex';
import type { GameState, Person } from '../state/types';
import { chronicle } from './saga';
import { foundSettlement } from './site';
import { fieldCrew } from './expedition';
import { bargain, bargainBlocker, canFallOn, fallOn, neighbourById } from './neighbours';
import {
  placeById, sackBlocker, settlePlace, tellOfPlace, tradeAt, tradeBlocker,
} from './places';
import { placeKind } from '../data/places';
import { strandTarget, STRAND_FEWER, STRAND_SHAKEN } from './sea';
import { note } from './tally';
import { startBattle } from './battleTurn';
import { shakeNerve } from './morale';
import { callThing, layDownRule } from './thing';
import { THING_OPENING } from '../data/thing';
import { advance, canMove, daysForMove, marchLine, reveal } from './road';
import { doCamp, doFish, doForage, doHunt } from './gathering';

export type TravelAction =
  | { type: 'MOVE'; to: Hex }
  | { type: 'CAMP' }
  | { type: 'FORAGE' }
  | { type: 'HUNT' }
  | { type: 'FISH' }
  | { type: 'FOUND' }
  | { type: 'BARTER'; id: string }
  | { type: 'TRADE_AT'; id: string; offer: string }
  | { type: 'FALL_ON'; id: string }
  | { type: 'SACK_PLACE'; id: string }
  | { type: 'STRANDHOGG' }
  | { type: 'CALL_THING' }
  | { type: 'RULE_ON' }
  | { type: 'LAY_DOWN_RULE' };

/** Whoever is on the map right now: the expedition, or the whole band. */
export function roadCrew(state: GameState): Person[] {
  return fieldCrew(state);
}

export function applyTravel(prev: GameState, action: TravelAction): GameState {
  if (prev.end || prev.event) return prev;
  const state = cloneState(prev);
  const party = state.party;

  switch (action.type) {
    case 'MOVE': {
      if (!canMove(state, action.to)) return prev;
      const days = daysForMove(state, action.to)!;
      const tile = state.world.tiles[key(action.to)]!;
      const wasOn = state.world.tiles[key(party.at)]?.terrain;
      const changedGround = wasOn !== tile.terrain;
      const fromSea = wasOn === 'ocean' && tile.terrain !== 'ocean';
      const cameFrom = prev.party.at;
      party.at = action.to;
      party.hasCamped = false;
      // Remember the route, not just the view: the map draws where we walked.
      const there = key(action.to);
      if (state.world.trod[there] === undefined) state.world.trod[there] = state.day;
      if (tile.terrain === 'ocean') note(state, 'seaDays', days);
      advance(state, days);
      if (state.end) return state;
      reveal(state);
      worldBeat(state, {
        kind: 'marched',
        from: cameFrom,
        to: action.to,
        days,
        terrain: tile.terrain,
        ...(tile.terrain === 'ocean' ? { bySea: true as const } : {}),
      });
      chronicle(state, marchLine(state, tile.terrain, days, changedGround, fromSea));
      return state;
    }

    case 'CAMP':
      return doCamp(state);

    case 'FORAGE':
      return doForage(prev, state);

    case 'HUNT':
      return doHunt(prev, state);

    case 'FISH':
      return doFish(prev, state);

    case 'FOUND': {
      // Setting the posts is a day's work like any other, and the last time
      // this choice will be offered.
      if (!foundSettlement(state)) return prev;
      worldBeat(state, {
        kind: 'founded',
        at: state.settlement!.at,
        name: state.settlement!.name,
      });
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'BARTER': {
      if (bargainBlocker(state, action.id) !== null) return prev;
      const host = neighbourById(state, action.id);
      if (!bargain(state, action.id)) return prev;
      // A bargain pays twice. Timber into the packs, and whatever they were
      // willing to say about the coast while it was being weighed — which
      // is the only road into the plunder economy a settled band has, the
      // fixed places being things you must first KNOW OF to walk to.
      if (host) tellOfPlace(state, host.at, host.name);
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'TRADE_AT': {
      // A day at a counter, and the day is spent either way — same as a
      // bargain in somebody's yard, because standing about being useful is
      // still standing about.
      if (tradeBlocker(state, action.id, action.offer) !== null) return prev;
      if (!tradeAt(state, action.id, action.offer)) return prev;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'FALL_ON': {
      // The day is spent whether or not it goes well, and the fight begins
      // before the day turns — you do not get to sleep on the decision.
      const difficulty = canFallOn(state, action.id) ? fallOn(state, action.id) : null;
      if (difficulty === null) return prev;
      const ground = state.world.tiles[key(party.at)]?.terrain ?? 'meadow';
      // The camp is the stake: win the field and their stores come home.
      startBattle(state, ground, difficulty, { campId: action.id });
      return state;
    }

    case 'SACK_PLACE': {
      // A guarded place is a fight first and a payoff after — the settling-up
      // happens when the field is won (see leaveBattle). An unguarded one is
      // a day's work, taken on the spot.
      if (sackBlocker(state, action.id) !== null) return prev;
      const place = placeById(state, action.id)!;
      const def = placeKind(place.kind);
      if (def.garrison !== null) {
        const ground = state.world.tiles[key(party.at)]?.terrain ?? 'meadow';
        startBattle(state, ground, def.garrison, { placeId: action.id });
        return state;
      }
      settlePlace(state, action.id);
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    // The ship's way in. Same place, taken off the water: they are lighter
    // and shaken, the hold takes more, and losing costs the cargo and the
    // hull. See sim/sea.ts.
    case 'STRANDHOGG': {
      const mark = strandTarget(state);
      if (!mark) return prev;
      const def = placeKind(mark.kind);
      const ground = state.world.tiles[key(mark.at)]?.terrain ?? 'shore';
      startBattle(state, ground, Math.max(0, (def.garrison ?? 1) - STRAND_FEWER), {
        placeId: mark.id,
      });
      if (state.battle) {
        state.battle.strandhogg = true;
        // Caught between the water and their own gate. Shaken, not fewer
        // again — the count is already the surprise, this is the nerve.
        for (const c of state.battle.combatants) {
          if (c.side === 'foe') shakeNerve(state, c, STRAND_SHAKEN);
        }
        state.battle.log.push('They had not thought to watch the water.');
      }
      return state;
    }

    case 'CALL_THING': {
      // Three days of people arriving, and the case put on the last of them.
      const result = callThing(state);
      if (!result) return prev;
      advance(state, 3);
      if (state.end) return state;
      reveal(state);
      // A claim carried grants the rule and leaves the run running — the
      // proclamation card is what asks whether to close the saga here (see
      // render/cards.ts). A claim refused has to be READ, or three days and
      // a feast vanish into the log with nothing on screen to show for them.
      if (!result.proclaimed && !state.event) {
        state.event = {
          id: 'thing',
          title: 'The Thing',
          body: THING_OPENING,
          choices: [],
          outcome: { text: result.text, good: false },
        };
      }
      return state;
    }

    // The two answers to the proclamation. Ruling on costs no day and only
    // marks the card as read; laying it down writes the ending the Thing
    // used to write for you.
    case 'RULE_ON': {
      if (!state.jarl || state.flags['ruleTaken'] !== undefined) return prev;
      state.flags['ruleTaken'] = state.day;
      return state;
    }

    case 'LAY_DOWN_RULE': {
      if (!layDownRule(state)) return prev;
      return state;
    }
  }
}

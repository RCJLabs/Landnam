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
import { rowThrough } from './skerry';
import { landmarkAt, landmarkName } from './landmark';
import { breakGround, canMakeWay, wayDays, wayLine } from './ways';
import { callTheBlot } from './blot';
import { layDownSaga, sailOn } from './landnam';
import { landmarkDef } from '../data/landmarks';
import { springStrake, unseaworthy } from './ship';
import { shakeNerve } from './morale';
import { callThing, layDownRule } from './thing';
import { THING_OPENING } from '../data/thing';
import { advance, canMove, daysForMove, marchLine, reveal } from './road';
import { canWalk, countryHere, daysToWalk, markTrod, standingAt } from './coast';
import { COAST_IS_A_LINE } from './flags';
import { placeAt, stopAt } from './route';
import { doCamp, doFish, doForage, doHunt } from './gathering';

export type TravelAction =
  | { type: 'MOVE'; to: Hex }
  /**
   * A step along the COAST, to a stop index — see sim/route.ts.
   *
   * A second verb beside `MOVE` rather than a change to it, and that is the
   * whole of what "behind a flag" buys here: the hex path stays live and
   * untouched, so the game is playable on every commit of the conversion
   * and the two can be measured against each other. `MOVE` goes when the
   * flag does.
   */
  | { type: 'WALK'; to: number }
  | { type: 'CAMP' }
  | { type: 'MAKE_WAY' }
  | { type: 'HOLD_BLOT' }
  | { type: 'SAIL_ON' }
  | { type: 'LAY_DOWN_SAGA' }
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
    case 'WALK': {
      // Refused outright while the coast is scaffolding. The walking is
      // real and tested; what the flag gates is whether the game offers it,
      // because a coast with nothing on it yet measures as travel getting
      // worse — and would be right.
      if (!COAST_IS_A_LINE) return prev;
      if (!canWalk(state, action.to)) return prev;
      const days = daysToWalk(state, action.to)!;
      const from = standingAt(state);
      const rowed = Math.abs(action.to - from) > 1;
      const wasIn = stopAt(state.seed, from).country;
      const stop = stopAt(state.seed, action.to);
      party.stop = action.to;
      party.hasCamped = false;
      // Before the days, because `world.trod` is stamped on arrival on the
      // hex map too: the day you first stood somewhere is the day you got
      // there, not the day you finished walking away from it.
      markTrod(state, action.to, state.day);
      if (rowed) note(state, 'seaDays', days);
      advance(state, days);
      if (state.end) return state;
      // THE DAY'S SIGHT, which this verb was not taking.
      //
      // `MOVE` has called `reveal` since the fog existed, and `WALK` never
      // did — so on a coast the pass that meets a neighbour, meets the other
      // landnamsmadr and picks a place out from a ridge only ran on days the
      // band stopped to forage. `markTrod` learns the next headland either
      // way, so the country still appeared; the PEOPLE in it did not, and
      // `spotted` was never emitted by a played run at all.
      reveal(state);
      // After the days, because `advance` clears it: a sail is a surprise for
      // exactly the day it appears in. This is the strandhögg's condition on
      // a line — see `Party.bySea`.
      if (rowed) party.bySea = true;
      // The march itself, for anything that animates the road. Same beat as
      // `MOVE` emits and deliberately the same shape: `from` and `to` are
      // the party's placeholder hex, because on a line the band's hex never
      // moves and the stop is the address — exactly as it is for places,
      // neighbours and landmarks. What carries the meaning is what always
      // did: the days it took, the country crossed, and whether it was
      // rowed.
      worldBeat(state, {
        kind: 'marched',
        from: { ...party.at },
        to: { ...party.at },
        days,
        terrain: rowed ? 'ocean' : stop.country,
        ...(rowed ? { bySea: true as const } : {}),
      });
      // The hex map's own voice, reused rather than a second one written
      // beside it. `marchLine` already knows how to say a day at the oars,
      // a landing, a long crossing and a dull stretch of the same country —
      // and a coast that spoke differently from a march would read as a
      // different game rather than the same one seen from the side.
      chronicle(
        state,
        rowed
          ? marchLine(state, 'ocean', days, false, false)
          : marchLine(state, stop.country, days, wasIn !== stop.country, false),
      );
      const found = placeAt(state.seed, action.to);
      if (found) {
        const def = placeKind(found);
        chronicle(state, `Along the shore stood ${def.name}. ${def.blurb}`, 'saga');
      }
      return state;
    }

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
      const firstHere = state.world.trod[there] === undefined;
      if (firstHere) state.world.trod[there] = state.day;
      if (tile.terrain === 'ocean') note(state, 'seaDays', days);
      // What the water did to her on the way. Only a crossing that was
      // actually rowed: walking a shore hex passes over no rocks.
      const rocks =
        wasOn === 'ocean' || tile.terrain === 'ocean'
          ? rowThrough(state, cameFrom, action.to)
          : { struck: [], found: [] };
      for (const _ of rocks.struck) springStrake(state.ship);
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
      // Standing under one for the first time. `trod` already remembers first
      // visits, so this costs no new state — and it is said ONCE, which is
      // what makes it read as arriving somewhere rather than as scenery.
      const standing = firstHere ? landmarkAt(state.world, state.seed, action.to) : null;
      if (standing) {
        chronicle(
          state,
          `We came to ${landmarkName(state.world, state.seed, action.to)}: `
            + `${landmarkDef(standing).blurb}.`,
          'saga',
        );
      }
      // The rocks get their own line: a strake going is the loudest thing
      // that can happen on a quiet day, and it must never be buried in the
      // march line's prose.
      if (rocks.struck.length > 0) {
        chronicle(
          state,
          rocks.struck.length > 1
            ? `We came through a skerry field and she took ${rocks.struck.length} strakes doing it.`
            : unseaworthy(state.ship)
              ? 'Rock under the keel, and the last sound strake with it. She will not swim until she is mended.'
              : 'There was rock under the water where none showed. A strake went.',
          'grim',
        );
      } else if (rocks.found.length > 0) {
        chronicle(
          state,
          'We felt rock go by close enough to touch, and marked where it lay.',
          'plain',
        );
      }
      return state;
    }

    case 'SAIL_ON': {
      if (!sailOn(state)) return prev;
      return state;
    }

    case 'LAY_DOWN_SAGA': {
      if (!layDownSaga(state)) return prev;
      return state;
    }

    case 'HOLD_BLOT': {
      // Spends no day of its own: the rite is held in the middle of one. What
      // it does is put the card on the table, and the card is where the
      // choosing happens.
      if (!callTheBlot(state)) return prev;
      return state;
    }

    case 'MAKE_WAY': {
      if (!canMakeWay(state, party.at)) return prev;
      const days = wayDays(state, party.at);
      const line = wayLine(state, party.at);
      breakGround(state, party.at);
      party.hasCamped = false;
      advance(state, days);
      if (state.end) return state;
      reveal(state);
      // Deliberately NO new beat kind. Beats live in the save and in the
      // parity vectors, so every one of them is an obligation on the port;
      // the chronicle already says this happened and nothing has to animate
      // a road being dug.
      chronicle(state, line, 'saga');
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
      if (host) tellOfPlace(state, host.at, host.name, host.stop ?? standingAt(state));
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
      const ground = countryHere(state);
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
        const ground = countryHere(state);
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
      // The beach they came out of the water onto, which on a line is the
      // stretch the prize stands on. A place's `at` is a placeholder there,
      // so this always fell through to the literal 'shore' and every
      // strandhögg in the game was fought on the same ground.
      const ground = COAST_IS_A_LINE
        ? stopAt(state.seed, mark.stop ?? 0).country
        : state.world.tiles[key(mark.at)]?.terrain ?? 'shore';
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

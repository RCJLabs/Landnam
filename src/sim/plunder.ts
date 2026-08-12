// What winning a fight you picked is actually worth.
//
// The audit's second finding: falling on a neighbour docked 45 standing on
// the spot and paid two of food a foe — strictly worse than bartering, which
// made the aggressive choice a fake one. This file makes sacking symmetric.
// They have stores, as we do; win the field and you carry them off, sized by
// who they are (data/clans.ts) and how strong they were. The standing was
// already paid when the steel came out — that stays where it is, priced at
// the DECISION, not the outcome.

import { stream } from '../rng';
import type { GameState } from '../state/types';
import { CAMP_PICKED_CLEAN, CAMP_REGROW, clanKind } from '../data/clans';
import { neighbourById } from './neighbours';
import { takeIn } from './joining';
import { chronicle } from './saga';

/** How much a point of their might multiplies the haul. */
const PLUNDER_PER_MIGHT = 0.35;

/**
 * How full a camp's stores are, 0..1 — everything if nobody has touched
 * them, next to nothing the morning after.
 *
 * The measurement behind this: at the old haul a native camp at might 2 paid
 * 24 food, which is eight days of eating for six people, in exchange for
 * forty-five standing, a permanent enemy and a fight that kills people for
 * good. Nobody sane takes that trade, and the harness agreed — even the
 * policy built around plunder sacked 0.3 camps a saga.
 *
 * So the haul is now worth the reprisal, and THIS is what stops it being
 * free money: a robbed camp has to put a season back before it is worth the
 * walk again.
 */
export function campStores(state: GameState, sackedOn: number | undefined): number {
  if (sackedOn === undefined) return 1;
  const since = state.day - sackedOn;
  return Math.min(1, CAMP_PICKED_CLEAN + (since / CAMP_REGROW) * (1 - CAMP_PICKED_CLEAN));
}

/** Odds that somebody is carried home from a won camp, if there is room. */
const THRALL_ODDS = 0.5;

/**
 * The settling-up when a neighbour's camp falls to the band.
 *
 * Pays from their stores, may carry somebody home as a hand (a thrall taken
 * is 6.2's oldest promise, and it only happens when the hall has room), and
 * leaves them ARMING: a camp that has been sacked once raises its might, so
 * the second visit is dearer than the first. Escalation the player chose.
 */
export function sackCamp(state: GameState, id: string): void {
  const n = neighbourById(state, id);
  if (!n) return;
  const kind = clanKind(n.kind);
  const rng = stream(state.seed, 'events').derive(`plunder:${id}:${state.day}`);

  const full = campStores(state, n.sackedOn);
  const scale = (1 + n.might * PLUNDER_PER_MIGHT) * rng.float(0.8, 1.25) * full;
  const food = Math.round(kind.plunder.food * scale);
  const firewood = Math.round(kind.plunder.firewood * scale);
  state.party.food += food;
  state.party.firewood += firewood;

  // What the DEED is worth, which this file did not pay until task 31 went
  // looking for why nobody can live by raiding. Scaled by how full the camp
  // was, because going through a place that has already been picked clean
  // is not a thing anybody sings about — and that keeps the circuit honest:
  // a band cannot farm one camp for heart any more than it can for stores.
  const heart = Math.round(kind.plunder.morale * full);
  if (heart > 0) state.party.morale = Math.min(100, state.party.morale + heart);

  chronicle(
    state,
    full < 0.5
      ? `We went through ${n.name} again. There was little left to take: ${food} of food and ${firewood} of wood.`
      : `We went through ${n.name} and took what a season had put there: ${food} of food and ${firewood} of wood.`,
    'grim',
  );

  if (rng.next() < THRALL_ODDS) {
    // takeIn owns the room question: a hall with no bed takes nobody, and a
    // band still walking has no hall at all.
    const taken = takeIn(state, 1, `was carried out of ${n.name}, and stayed`);
    if (taken.length > 0) {
      chronicle(state, `${taken[0]!.name} walked home in the middle of the band, and was watched.`, 'grim');
    }
  }

  // They rebuild, and they arm. The might that made them worth robbing is
  // the might that meets the next visit — and their stores start again from
  // nothing, so a band that means to live this way has to work a circuit
  // rather than a single camp.
  n.might = Math.min(4, n.might + 1);
  n.sackedOn = state.day;
}

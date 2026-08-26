// The enemy the player made on purpose.
//
// Every other hostile thing in this game is dealt out by the world: a camp
// that was always there, a garrison at a place, a rival who landed the same
// spring. An outlaw is different. He was one of the six who came off the
// knarr, he was driven out by a judgement the player made at a feud card,
// and he is still in the country — which is the whole point of the verb.
// Wergild spends stores and a Thing spends a roll; outlawry spends a PERSON,
// and the person keeps existing.
//
// He is deliberately not a faction with a plan. He is a man with a grievance
// and somewhere to sleep, and every so often he is waiting on the road.

import { stream } from '../rng';
import { OUTLAW_LIE_LOW, OUTLAW_MORALE } from '../data/feuds';
import type { GameState, Outlaw, Person } from '../state/types';
import { worldBeat } from './beats';
import { chronicle } from './saga';
import { startBattle } from './battleTurn';
import { atSea } from './road';
import { countryHere } from './coast';

/** Odds per outlaw per day, once they have stopped keeping their heads down. */
export const STRIKE_ODDS = 0.008;

/** Days after one comes back before any of them tries again. */
export const STRIKE_REST = 45;

/** Everyone driven out and still out there. */
export function outlaws(state: GameState): Outlaw[] {
  return state.outlaws ?? [];
}

/**
 * Mutates: drives a person out of the band and into the country.
 *
 * They are `left`, not dead — the same shape a walk-out uses, so upkeep stops
 * feeding them and the saga does not bury somebody who is still alive. The
 * difference is that this one is written down.
 */
export function driveOut(state: GameState, person: Person): void {
  person.alive = false;
  person.left = true;
  person.fate = 'was made outlaw and went into the country';
  person.diedOn = state.day;

  if (!state.outlaws) state.outlaws = [];
  state.outlaws.push({
    id: person.id,
    name: person.name,
    since: state.day,
    might: person.stats.might,
  });

  // The band does not enjoy this. Driving out one of six is the hardest
  // thing a leader does, and the ones who stay saw it done.
  state.party.morale = Math.max(0, state.party.morale - OUTLAW_MORALE);
  worldBeat(state, { kind: 'left', who: person.id, name: person.name });
}

/** True when this one could be waiting on the road today. */
function abroad(state: GameState, outlaw: Outlaw): boolean {
  if (state.day - outlaw.since < OUTLAW_LIE_LOW) return false;
  if (outlaw.struckOn !== undefined && state.day - outlaw.struckOn < STRIKE_REST) return false;
  return true;
}

/**
 * One of them comes back for us. Called from the day tick.
 *
 * Nothing here happens while a card or a fight is already on the table, and
 * nothing happens at sea — a man on foot cannot reach a hull under way,
 * which is also the one place the band could not run.
 */
export function maybeOutlawStrike(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  if (atSea(state)) return false;
  const out = outlaws(state).filter((o) => abroad(state, o));
  if (out.length === 0) return false;

  // One roll a day for the lot of them, scaled by how many are abroad — but
  // the REST is each man's own, so a band that drove three people out really
  // is in three men's worth of danger. Measured: about two fights a year for
  // one outlaw and six or seven for three. That is meant to be steep; it is
  // the price of a judgement that ends a quarrel for good, and nobody drives
  // out half their band by accident.
  const rng = stream(state.seed, 'events').derive(`outlaw:${state.day}`);
  if (!rng.chance(Math.min(0.05, STRIKE_ODDS * out.length))) return false;

  const who = out[rng.int(0, out.length - 1)]!;
  who.struckOn = state.day;

  const terrain = countryHere(state);
  // What he brings is what he was worth plus whoever he has fallen in with.
  const difficulty = Math.max(0, Math.round(who.might / 2));
  chronicle(
    state,
    `${who.name}, whom we drove out, was waiting for us with men we did not know.`,
    'grim',
  );
  startBattle(state, terrain, difficulty);
  return true;
}

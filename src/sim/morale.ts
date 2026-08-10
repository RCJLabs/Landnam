// Nerve: what a fighter has left in them.
//
// Battle-local on purpose. A Person's morale is who they are across the whole
// run; nerve is how this particular hour is going, and it resets with the
// next fight. Lose it and you stop fighting and start running.

import { column, distance, fromKey, type Hex } from '../hex';
import { stream as makeStream } from '../rng';
import type { Battle, Combatant, GameState } from '../state/types';
import { FIELD_HEIGHT } from './battlefield';
import { effectiveStat } from './people';
import { fighterPerson } from './battle';
import { beat } from './beats';
import { canAnchor, wallLinks } from './wall';
import { kinOf } from './kin';
import { NERVE_KIN_FELL } from '../data/kin';
import { reachWithZoc, threatCount } from './zoc';
import { leaderOf } from './people';

export const NERVE_HIT = 10;
export const NERVE_ALLY_DOWN = 20;
/** Extra sting when the man who fell was holding the line beside you. */
export const NERVE_WALL_SHATTERED = 10;
export const NERVE_OUTNUMBERED = 12;
export const NERVE_KILL = 12;
/** What a fighter who pulls themselves together comes back with. */
export const RALLY_NERVE = 35;
export const RALLY_DC = 10;

/** Keeps rally rolls reproducible per fighter per turn. */
function rollFor(state: GameState, label: string) {
  const battle = state.battle!;
  return makeStream(state.seed, 'combat').derive(
    `${label}:${state.day}:${battle.round}:${battle.turnIndex}`,
  );
}

export function startingNerve(state: GameState, personId: string): number {
  const person = fighterPerson(state, personId);
  if (!person) return 60;
  // Steady people start steadier; spirit is nerve made flesh.
  return Math.max(30, Math.min(100, person.morale + effectiveStat(person, 'spirit') * 3));
}

function breakFighter(battle: Battle, c: Combatant, name: string): void {
  if (c.broken) return;
  c.broken = true;
  c.defending = false;
  beat(battle, { kind: 'broke', who: c.personId });
  battle.log.push(`${name}'s nerve went, and ${name} broke.`);
}

/** Each shoulder-mate takes this share off whatever would shake you. */
export const STEADIED_PER_LINK = 0.25;

/**
 * Drains nerve, breaking the fighter if it runs out.
 *
 * Men beside you steady you. The wall holds a warrior's nerve as much as it
 * holds their flank, which is why the man who charges in alone is the first
 * to break — nothing is protecting either.
 */
export function shakeNerve(
  state: GameState,
  target: Combatant,
  amount: number,
): void {
  if (target.down || target.fled || amount <= 0) return;
  const battle = state.battle!;
  const links = Math.min(2, wallLinks(battle, target).length);
  const felt = amount * (1 - links * STEADIED_PER_LINK);
  target.nerve = Math.max(0, target.nerve - felt);
  if (target.nerve <= 0) {
    const person = fighterPerson(state, target.personId);
    breakFighter(state.battle!, target, person?.name ?? 'Someone');
  }
}

export function steadyNerve(target: Combatant, amount: number): void {
  if (target.down || target.fled) return;
  target.nerve = Math.min(100, target.nerve + amount);
}

/**
 * Called when a fighter drops. Everyone beside them feels it, and those who
 * were holding the line with them feel it worse — that is the wall
 * shattering.
 */
export function witnessFall(state: GameState, fallen: Combatant): void {
  const battle = state.battle!;
  // Work out who was in the wall with them BEFORE they are taken off it.
  const shoulderMates = battle.combatants.filter(
    (c) =>
      c.personId !== fallen.personId &&
      c.side === fallen.side &&
      canAnchor(c) &&
      distance(c.at, fallen.at) === 1,
  );

  for (const mate of shoulderMates) {
    const wasInWall = wallLinks(battle, mate).length > 0;
    shakeNerve(state, mate, NERVE_ALLY_DOWN + (wasInWall ? NERVE_WALL_SHATTERED : 0));
  }

  // Their own go harder, and from anywhere on the field — you do not have to
  // be standing beside your brother to see him go down.
  const person = fighterPerson(state, fallen.personId);
  if (person && fallen.side === 'warband') {
    const bound = kinOf(state.party.people, person);
    const mate = bound && battle.combatants.find((c) => c.personId === bound.id);
    if (mate && canAnchor(mate)) {
      shakeNerve(state, mate, NERVE_KIN_FELL);
      battle.log.push(`${bound.name} saw ${person.name} go down.`);
    }
  }

  // The other side takes heart from it.
  for (const c of battle.combatants) {
    if (c.side !== fallen.side && canAnchor(c) && distance(c.at, fallen.at) <= 2) {
      steadyNerve(c, NERVE_KILL);
    }
  }
}

/** What a whole side loses when the one who led it goes down. */
export const NERVE_LEADER_FELL = 25;

/** Whether this fighter was leading their side of this field. */
export function fellLeading(state: GameState, fallen: Combatant): boolean {
  const battle = state.battle!;
  if (fallen.side === 'foe') return battle.champion === fallen.personId;
  return leaderOf(state.party.people)?.id === fallen.personId;
}

/**
 * The leader is down and the whole side knows it — not just whoever stood
 * beside them. Symmetric on purpose: OUR leader's fall shakes the band
 * exactly as their champion's fall shakes the raid, which is what makes
 * singling out the man with the pennant a real tactic on both sides of it.
 * Distance does not soften this one; the news crosses any field.
 */
export function leaderFell(state: GameState, fallen: Combatant): void {
  if (!fellLeading(state, fallen)) return;
  const battle = state.battle!;
  for (const c of battle.combatants) {
    if (c.side === fallen.side && c.personId !== fallen.personId && canAnchor(c)) {
      shakeNerve(state, c, NERVE_LEADER_FELL);
    }
  }
  const person = fighterPerson(state, fallen.personId);
  beat(battle, { kind: 'leaderFell', who: fallen.personId, side: fallen.side });
  battle.log.push(
    `${person?.name ?? 'Their leader'} fell, and the heart went out of those ${
      fallen.side === 'foe' ? 'he had led' : 'left holding the line'
    }.`,
  );
}

/** Which edge row this side runs for. */
function homeRow(side: Combatant['side']): number {
  return side === 'warband' ? FIELD_HEIGHT - 1 : 0;
}

/**
 * A broken fighter's turn: try to pull themselves together, and if that
 * fails, run for their own edge. Returns true if the turn was consumed.
 */
export function takeBrokenTurn(state: GameState, active: Combatant): boolean {
  const battle = state.battle!;
  if (!active.broken || active.down || active.fled) return false;

  const person = fighterPerson(state, active.personId);
  const name = person?.name ?? 'Someone';
  const spirit = person ? effectiveStat(person, 'spirit') : 1;

  // Shoulder-mates who are still steady help you find your feet.
  const steadyMates = battle.combatants.filter(
    (c) => c.side === active.side && canAnchor(c) && distance(c.at, active.at) === 1,
  ).length;
  const threats = threatCount(battle, active.at, active.side);

  const rng = rollFor(state, `rally:${active.personId}`);
  const roll = rng.roll(2, 6) + spirit + steadyMates * 2 - threats * 2;

  if (roll >= RALLY_DC) {
    active.broken = false;
    active.nerve = RALLY_NERVE;
    beat(battle, { kind: 'rallied', who: active.personId, steadied: steadyMates });
    battle.log.push(
      steadyMates > 0
        ? `${name} was steadied by those beside them and turned back to the fight.`
        : `${name} got a grip and turned back to the fight.`,
    );
    return true;
  }

  // Still gone: run for the edge.
  const target = homeRow(active.side);
  const reach = reachWithZoc(battle, active);
  let best: Hex | null = null;
  let bestScore = -Infinity;
  for (const [k, cost] of reach) {
    const at = fromKey(k);
    // Away from the enemy, toward home, cheaply.
    const away = Math.min(
      ...battle.combatants
        .filter((c) => c.side !== active.side && canAnchor(c))
        .map((c) => distance(c.at, at)),
    );
    const score = away * 8 - Math.abs(at.r - target) * 6 - cost;
    if (score > bestScore) {
      bestScore = score;
      best = at;
    }
  }
  if (best) {
    const from = active.at;
    active.at = best;
    active.movesLeft = 0;
    // Flagged as flight rather than left to look like a manoeuvre: a man
    // running for the edge and a man taking ground are the same two hexes
    // and nothing like the same thing to watch.
    beat(battle, { kind: 'moved', who: active.personId, from, to: best, cost: 0, flight: true });
  }

  if (active.at.r === target || column(active.at) < 0) {
    active.fled = true;
    beat(battle, { kind: 'fled', who: active.personId });
    battle.log.push(`${name} ran from the field.`);
  }
  active.hasActed = true;
  return true;
}


/** Start-of-turn nerve pressure: being surrounded wears you down. */
export function pressureAtTurnStart(state: GameState, active: Combatant): void {
  const battle = state.battle!;
  if (!canAnchor(active)) return;
  if (threatCount(battle, active.at, active.side) >= 2) {
    shakeNerve(state, active, NERVE_OUTNUMBERED);
  }
}

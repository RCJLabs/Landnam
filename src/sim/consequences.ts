// What a fight leaves behind: the dead, the maimed, what was taken off the
// field, and what the living learned.
//
// This is the module that makes losing a veteran hurt. Everything here is
// permanent — nothing resets when the next fight starts.

import { stream, type Rng } from '../rng';
import { DEATHS, INJURIES, LASTING } from '../data/injuries';
import type { Aftermath, Battle, GameState, Person, Stats } from '../state/types';
import { fighterPerson } from './battle';
import { chronicle } from './saga';
import { mourn } from './kin';
import { fullName } from './people';

/** XP needed before a stat goes up. */
export const XP_PER_ADVANCE = 12;
export const XP_PER_KILL = 4;
export const XP_SURVIVED = 2;
export const XP_WON = 2;

/** Supplies stripped from each foe left on the field. */
export const LOOT_FOOD_PER_FOE = 2;
export const LOOT_WOOD_PER_FOE = 1;

const STAT_KEYS: (keyof Stats)[] = ['might', 'wits', 'spirit', 'craft'];

const STAT_GROWTH: Record<keyof Stats, string> = {
  might: 'came back harder than they went out',
  wits: 'had learned to read a fight',
  spirit: 'had stopped flinching',
  craft: 'had steadier hands for it',
};

function rollFor(state: GameState, label: string): Rng {
  return stream(state.seed, 'combat').derive(`aftermath:${state.day}:${label}`);
}

// --- Death and injury ---

export type Fate = 'killed' | 'maimed' | 'spared';

/**
 * What happens to someone dragged off the field.
 *
 * Holding the ground means your people get carried off it; losing means they
 * are left where they fell. That difference is most of why a defeat costs so
 * much more than a victory.
 */
export function rollFate(rng: Rng, person: Person, won: boolean): Fate {
  const roll = rng.roll(2, 6) + Math.floor(person.stats.spirit / 2) + (won ? 2 : -1);
  if (roll <= 7) return 'killed';
  if (roll <= 11) return 'maimed';
  return 'spared';
}

function kill(state: GameState, person: Person, rng: Rng): void {
  person.alive = false;
  person.health = 0;
  person.fate = rng.pick(DEATHS);
  person.diedOn = state.day;
  chronicle(state, `${fullName(person)} ${person.fate}. They were ${person.age}.`, 'grim');
  mourn(state, person);
}

function maim(state: GameState, person: Person, rng: Rng): void {
  // A small share of wounds never mend at all.
  const lasting = rng.chance(0.18);
  const template = rng.pick(lasting ? LASTING : INJURIES);
  person.injuries.push({ ...template, id: `inj_${state.day}_${person.id}` });
  person.health = 1;
  chronicle(
    state,
    lasting
      ? `${fullName(person)} lived, but ${template.label.toLowerCase()} — and always would.`
      : `${fullName(person)} was carried off with ${template.label.toLowerCase()}.`,
    'grim',
  );
}

// --- Growth ---

/** Raises one stat that has room, permanently. */
function advance(state: GameState, person: Person, rng: Rng): void {
  const room = STAT_KEYS.filter((s) => person.stats[s] < 6);
  if (room.length === 0) {
    person.xp = 0;
    return;
  }
  const stat = rng.pick(room);
  const before = person.stats[stat];
  person.stats[stat] = before + 1;
  person.xp -= XP_PER_ADVANCE;
  // Might is what a body can take, so more of it means more to take.
  if (stat === 'might') {
    person.maxHealth += 2;
    person.health += 2;
  }
  chronicle(
    state,
    `${person.name} ${STAT_GROWTH[stat]} (${stat} ${before} to ${before + 1}).`,
    'good',
  );
}

function award(state: GameState, person: Person, amount: number, rng: Rng): void {
  if (!person.alive || amount <= 0) return;
  person.xp += amount;
  let guard = 4;
  while (person.xp >= XP_PER_ADVANCE && guard-- > 0) {
    advance(state, person, rng);
  }
}

// --- The whole aftermath ---

/**
 * The shape lives in state/types because it is saved; re-exported here so
 * callers of settleAftermath do not have to reach past it.
 */
export type { Aftermath };

/**
 * Settles everything a fight leaves behind. Mutates the state clone, and is
 * the only place battle results become permanent.
 */
export function settleAftermath(state: GameState, battle: Battle): Aftermath {
  const won = battle.outcome === 'won';
  const rng = rollFor(state, `settle:${battle.round}`);
  const out: Aftermath = {
    killed: [],
    maimed: [],
    ran: [],
    foesDown: battle.combatants.filter((c) => c.side === 'foe' && c.down).length,
    food: 0,
    firewood: 0,
    won,
  };

  const ours = battle.combatants.filter((c) => c.side === 'warband');

  // The dead and the maimed first — XP is for the living.
  for (const combatant of ours) {
    const person = fighterPerson(state, combatant.personId);
    if (!person) continue;

    if (combatant.down) {
      const fate = rollFate(rng.derive(`fate:${person.id}`), person, won);
      if (fate === 'killed') {
        kill(state, person, rng.derive(`death:${person.id}`));
        out.killed.push(person.name);
      } else if (fate === 'maimed') {
        maim(state, person, rng.derive(`wound:${person.id}`));
        out.maimed.push(person.name);
      } else {
        person.health = Math.max(1, Math.floor(person.maxHealth * 0.25));
        chronicle(state, `${person.name} was pulled out of it and lived.`, 'plain');
      }
    } else if (combatant.fled) {
      out.ran.push(person.name);
    }
  }

  // Loot: only what was left on ground you actually held.
  if (won && out.foesDown > 0) {
    const lootRng = rng.derive('loot');
    out.food = Math.round(out.foesDown * LOOT_FOOD_PER_FOE * lootRng.float(0.7, 1.3));
    out.firewood = Math.round(out.foesDown * LOOT_WOOD_PER_FOE * lootRng.float(0.7, 1.3));
    state.party.food += out.food;
    state.party.firewood += out.firewood;
    if (out.food > 0 || out.firewood > 0) {
      chronicle(
        state,
        `We stripped the field: ${out.food} of food and ${out.firewood} of firewood.`,
        'good',
      );
    }
  }

  // What the living learned.
  for (const combatant of ours) {
    const person = fighterPerson(state, combatant.personId);
    if (!person || !person.alive) continue;
    const earned = combatant.kills * XP_PER_KILL + XP_SURVIVED + (won ? XP_WON : 0);
    award(state, person, earned, rng.derive(`xp:${person.id}`));
  }

  return out;
}

/** The dead of the whole run, for the run-end saga. */
export function theFallen(state: GameState): Person[] {
  return state.party.people.filter((p) => !p.alive);
}

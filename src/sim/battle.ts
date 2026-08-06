// BATTLE mode. Turn order from stats, move plus one action per turn, and a
// result that hands control back to travel.
//
// Fighters are Person objects on both sides; a Combatant only says where
// they stand and what they have left this turn.

import { column, distance, equals, fromKey, key, type Hex } from '../hex';
import { reachWithZoc } from './zoc';
import type { Rng } from '../rng';
import { stream } from '../rng';
import {
  FOE_ARCHETYPES,
  FOE_BYNAMES,
  FOE_NAMES,
  archetypeById,
  type FoeArchetype,
} from '../data/foes';
import type { Battle, Combatant, GameState, Person, Stats, Terrain } from '../state/types';
import { pushMode } from '../modes';
import { effectiveStat } from './people';
import { chronicle } from './saga';
import { startingNerve } from './morale';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  generateBattlefield,
  generateSteadingField,
  groundName,
  isPassable,
} from './battlefield';

export const BASE_MOVES = 3;

// --- Lookups ---

/**
 * A foe's archetype, recovered from the trait we stamped at generation.
 * Warband members have no archetype — they have traits instead.
 */
export function archetypeOf(person: Person): FoeArchetype | undefined {
  if (!person.trait.startsWith('foe:')) return undefined;
  return archetypeById(person.trait.slice(4));
}

export function fighterPerson(state: GameState, personId: string): Person | undefined {
  return (
    state.party.people.find((p) => p.id === personId) ??
    state.battle?.foes.find((p) => p.id === personId)
  );
}

export function combatantAt(battle: Battle, h: Hex): Combatant | undefined {
  return battle.combatants.find((c) => !c.down && !c.fled && equals(c.at, h));
}

/** Still on the field: not dropped, not run off. Broken fighters still count. */
export function standing(battle: Battle, side: Combatant['side']): Combatant[] {
  return battle.combatants.filter((c) => c.side === side && !c.down && !c.fled);
}

/** Still fighting: standing AND willing. What decides a fight. */
export function effective(battle: Battle, side: Combatant['side']): Combatant[] {
  return standing(battle, side).filter((c) => !c.broken);
}

export function activeCombatant(battle: Battle): Combatant | undefined {
  const personId = battle.order[battle.turnIndex % battle.order.length];
  return battle.combatants.find((c) => c.personId === personId && !c.down && !c.fled);
}

export function isWarbandTurn(state: GameState): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;
  return activeCombatant(battle)?.side === 'warband';
}

// --- Foe generation ---

function makeFoe(rng: Rng, archetypeId: string, index: number): Person {
  const archetype = archetypeById(archetypeId) ?? FOE_ARCHETYPES[1]!;
  const stats: Stats = { might: 1, wits: 1, spirit: 1, craft: 1 };
  let left = archetype.budget;
  let guard = 200;
  while (left > 0 && guard-- > 0) {
    // Favoured stats appear more than once in the pool, so they win more often.
    const pool: (keyof Stats)[] = [...archetype.favours, 'might', 'wits', 'spirit', 'craft'];
    const stat = rng.pick(pool);
    if (stats[stat] < 6) {
      stats[stat] += 1;
      left -= 1;
    }
  }
  const maxHealth = Math.max(4, 8 + stats.might * 2 + archetype.toughness);
  return {
    id: `foe_${index}`,
    name: rng.pick(FOE_NAMES),
    byname: rng.pick(FOE_BYNAMES),
    age: rng.int(18, 45),
    stats,
    trait: `foe:${archetype.id}`,
    health: maxHealth,
    maxHealth,
    morale: 60,
    injuries: [],
    xp: 0,
    alive: true,
  };
}

/** The most a wandering encounter brings, and the most a raid brings. */
export const MAX_FOES = 6;
export const MAX_RAIDERS = 9;

/**
 * What the warband is up against, scaled loosely to its own strength.
 *
 * A raid brings more than a chance meeting does: nobody crosses the country
 * for somebody else's store with four scouts. Without the larger cap a full
 * band behind a palisade simply cannot be threatened, and the wall stops
 * being a mitigation and becomes an off-switch.
 */
function rollFoes(rng: Rng, warbandSize: number, difficulty: number, raid = false): Person[] {
  const cap = raid ? MAX_RAIDERS : MAX_FOES;
  const count = Math.max(1, Math.min(cap, Math.round(warbandSize * (raid ? 0.9 : 0.6)) + difficulty));
  const foes: Person[] = [];
  for (let i = 0; i < count; i++) {
    const archetype = rng.weighted(FOE_ARCHETYPES, (a) => a.weight);
    foes.push(makeFoe(rng, archetype.id, i + 1));
  }
  return foes;
}

// --- Setting up ---

/** Initiative: quick wits act first, with a roll to break the ties. */
function rollInitiative(state: GameState, battle: Battle, rng: Rng): string[] {
  const scored = battle.combatants.map((c) => {
    const person = fighterPerson(state, c.personId);
    const wits = person ? effectiveStat(person, 'wits') : 1;
    const initiative = wits * 2 + rng.roll(1, 6);
    c.initiative = initiative;
    return { personId: c.personId, initiative };
  });
  scored.sort((a, b) => b.initiative - a.initiative || a.personId.localeCompare(b.personId));
  return scored.map((s) => s.personId);
}

/**
 * Creates the battle and pushes BATTLE onto the mode stack.
 * Mutates — callers are already working on a state clone.
 */
export function beginBattle(
  state: GameState,
  terrain: Terrain,
  difficulty = 0,
  raid = false,
): void {
  state.modes = pushMode(state, 'BATTLE').modes;
  const rng = stream(state.seed, 'combat').derive(
    `${raid ? 'raid' : 'battle'}:${state.day}:${key(state.party.at)}`,
  );

  // A raid is fought on the ground you built, not on ground you wandered onto.
  const home = state.settlement;
  const { grid, warbandSpots, foeSpots } =
    raid && home
      ? generateSteadingField(
          home.plots.map((p) => p.kind),
          home.built.includes('palisade'),
          rng.derive('ground'),
        )
      : generateBattlefield(terrain, rng.derive('ground'));
  const foes = rollFoes(
    rng.derive('foes'),
    state.party.people.filter((p) => p.alive).length,
    difficulty,
    raid,
  );

  const battle: Battle = {
    terrain,
    ...(raid ? { raid: true } : {}),
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    grid,
    foes,
    combatants: [],
    order: [],
    turnIndex: 0,
    round: 1,
    log: [],
  };

  const taken = new Set<string>();
  const midColumn = (FIELD_WIDTH - 1) / 2;

  /**
   * Deploys toward the middle of the band but leaves air between fighters.
   * Packing a line shoulder to shoulder looks tidy and plays terribly: the
   * warriors in the middle open the fight with every neighbour occupied and
   * nowhere legal to step.
   */
  const place = (spots: Hex[], placed: Hex[]): Hex | undefined => {
    const free = spots.filter(
      (s) => !taken.has(key(s)) && isPassable(battle.grid[key(s)]?.ground ?? 'block'),
    );
    if (free.length === 0) return undefined;

    let best = free[0]!;
    let bestScore = -Infinity;
    for (const spot of free) {
      const nearest =
        placed.length === 0 ? 99 : Math.min(...placed.map((p) => distance(p, spot)));
      // Elbow room counts for a lot, up to two hexes; after that, centre up.
      const score = Math.min(nearest, 2) * 10 - Math.abs(column(spot) - midColumn);
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
    taken.add(key(best));
    placed.push(best);
    return best;
  };

  const ourLine: Hex[] = [];
  for (const person of state.party.people.filter((p) => p.alive)) {
    const at = place(warbandSpots, ourLine);
    if (!at) continue;
    battle.combatants.push({
      personId: person.id,
      side: 'warband',
      at,
      initiative: 0,
      movesLeft: BASE_MOVES,
      hasActed: false,
      // Everyone carries something worth throwing once.
      throwsLeft: 1,
      defending: false,
      kills: 0,
      nerve: 0,
      broken: false,
      fled: false,
      down: false,
    });
  }

  const theirLine: Hex[] = [];
  for (const foe of foes) {
    const at = place(foeSpots, theirLine);
    if (!at) continue;
    battle.combatants.push({
      personId: foe.id,
      side: 'foe',
      at,
      initiative: 0,
      movesLeft: BASE_MOVES,
      hasActed: false,
      throwsLeft: archetypeOf(foe)?.throws ?? 1,
      defending: false,
      kills: 0,
      nerve: 0,
      broken: false,
      fled: false,
      down: false,
    });
  }

  state.battle = battle;
  // Nerve needs the battle in place, because it reads each fighter's Person.
  for (const c of battle.combatants) c.nerve = startingNerve(state, c.personId);
  battle.order = rollInitiative(state, battle, rng.derive('initiative'));
  if (raid && home) {
    battle.log.push(
      `They came at ${home.name} out of the trees. ${foes.length} against ${standing(battle, 'warband').length}.` +
        (home.built.includes('palisade') ? ' The palisade was between us.' : ''),
    );
    chronicle(state, `Raiders came on ${home.name} before we saw them.`, 'grim');
  } else {
    battle.log.push(
      `They met us on ${groundName(terrain)}. ${foes.length} against ${standing(battle, 'warband').length}.`,
    );
    chronicle(state, `We were brought to a fight on ${groundName(terrain)}.`, 'grim');
  }
  refreshTurn(battle);
}

// --- Movement and reach ---

/** Hexes the active fighter can still reach this turn, zone of control included. */
export function reachableHexes(battle: Battle): Hex[] {
  const active = activeCombatant(battle);
  if (!active || battle.outcome || active.movesLeft <= 0) return [];
  return [...reachWithZoc(battle, active).keys()].map(fromKey);
}

/** What reaching each hex would cost — used to preview a step. */
export function reachCosts(battle: Battle): Map<string, number> {
  const active = activeCombatant(battle);
  if (!active || battle.outcome || active.movesLeft <= 0) return new Map();
  return reachWithZoc(battle, active);
}

/** Enemies the active fighter could strike right now. */
export function strikeTargets(state: GameState): Combatant[] {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome) return [];
  return battle.combatants.filter(
    (c) => !c.down && c.side !== active.side && distance(c.at, active.at) === 1,
  );
}

function refreshTurn(battle: Battle): void {
  const active = activeCombatant(battle);
  if (!active) return;
  active.movesLeft = BASE_MOVES;
  active.hasActed = false;
  // A raised shield lasts until your own next turn, and no longer.
  active.defending = false;
}

export { refreshTurn };

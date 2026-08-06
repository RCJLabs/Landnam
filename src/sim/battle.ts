// BATTLE mode. Turn order from stats, move plus one action per turn, and a
// result that hands control back to travel.
//
// Fighters are Person objects on both sides; a Combatant only says where
// they stand and what they have left this turn.

import { column, distance, equals, key, reachable, type Hex } from '../hex';
import type { Rng } from '../rng';
import { stream } from '../rng';
import { FOE_ARCHETYPES, FOE_BYNAMES, FOE_NAMES, archetypeById } from '../data/foes';
import type { Battle, Combatant, GameState, Person, Stats, Terrain } from '../state/types';
import { pushMode } from '../modes';
import { effectiveStat } from './people';
import { chronicle } from './saga';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  generateBattlefield,
  groundCost,
  groundName,
  isPassable,
} from './battlefield';

export const BASE_MOVES = 3;

// --- Lookups ---

export function fighterPerson(state: GameState, personId: string): Person | undefined {
  return (
    state.party.people.find((p) => p.id === personId) ??
    state.battle?.foes.find((p) => p.id === personId)
  );
}

export function combatantAt(battle: Battle, h: Hex): Combatant | undefined {
  return battle.combatants.find((c) => !c.down && equals(c.at, h));
}

export function standing(battle: Battle, side: Combatant['side']): Combatant[] {
  return battle.combatants.filter((c) => c.side === side && !c.down);
}

export function activeCombatant(battle: Battle): Combatant | undefined {
  const personId = battle.order[battle.turnIndex % battle.order.length];
  return battle.combatants.find((c) => c.personId === personId && !c.down);
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
    alive: true,
  };
}

/** What the warband is up against, scaled loosely to its own strength. */
function rollFoes(rng: Rng, warbandSize: number, difficulty: number): Person[] {
  const count = Math.max(1, Math.min(6, Math.round(warbandSize * 0.6) + difficulty));
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
export function beginBattle(state: GameState, terrain: Terrain, difficulty = 0): void {
  state.modes = pushMode(state, 'BATTLE').modes;
  const rng = stream(state.seed, 'combat').derive(`battle:${state.day}:${key(state.party.at)}`);

  const { grid, warbandSpots, foeSpots } = generateBattlefield(terrain, rng.derive('ground'));
  const foes = rollFoes(rng.derive('foes'), state.party.people.filter((p) => p.alive).length, difficulty);

  const battle: Battle = {
    terrain,
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
      down: false,
    });
  }

  state.battle = battle;
  battle.order = rollInitiative(state, battle, rng.derive('initiative'));
  battle.log.push(
    `They met us on ${groundName(terrain)}. ${foes.length} against ${standing(battle, 'warband').length}.`,
  );
  chronicle(state, `We were brought to a fight on ${groundName(terrain)}.`, 'grim');
  refreshTurn(battle);
}

// --- Movement and reach ---

export function battleMoveCost(battle: Battle, h: Hex): number {
  const tile = battle.grid[key(h)];
  if (!tile) return Infinity;
  if (combatantAt(battle, h)) return Infinity;
  return groundCost(tile.ground);
}

/** Hexes the active fighter can still reach this turn. */
export function reachableHexes(battle: Battle): Hex[] {
  const active = activeCombatant(battle);
  if (!active || battle.outcome || active.movesLeft <= 0) return [];
  const found = reachable(active.at, active.movesLeft, (h) => battleMoveCost(battle, h));
  const out: Hex[] = [];
  for (const k of found.keys()) {
    const i = k.indexOf(',');
    const h = { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
    if (!equals(h, active.at)) out.push(h);
  }
  return out;
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
}

export { refreshTurn };

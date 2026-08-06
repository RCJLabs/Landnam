// TRAVEL mode logic. Pure: (state, action) -> state. Every action costs at
// least a day, and the day is what kills you.

import { distance, key, neighbors, type Hex } from '../hex';
import { stream } from '../rng';
import { terrainDef } from '../data/terrain';
import type { GameState, Person, Terrain } from '../state/types';
import { effectsOn } from './calendar';
import { revealAround, sightRadius } from './fog';
import { bestAt, effectiveStat, living } from './people';
import { chronicle } from './saga';
import { atHome, foundSettlement } from './site';
import { passDay } from './upkeep';

export type TravelAction =
  | { type: 'MOVE'; to: Hex }
  | { type: 'CAMP' }
  | { type: 'FORAGE' }
  | { type: 'HUNT' }
  | { type: 'FISH' }
  | { type: 'FOUND' };

/** Effort to enter a hex, or null when it cannot be entered on foot. */
export function moveEffort(state: GameState, to: Hex): number | null {
  const tile = state.world.tiles[key(to)];
  if (!tile) return null;
  const def = terrainDef(tile.terrain);
  if (!Number.isFinite(def.cost)) return null;
  let effort = def.cost + effectsOn(state.day).travelPenalty;
  if (tile.river) effort += 1; // fording costs time and dry clothes
  return effort;
}

/** Days spent entering a hex. Two points of effort make a day. */
export function daysForMove(state: GameState, to: Hex): number | null {
  const effort = moveEffort(state, to);
  return effort === null ? null : Math.max(1, Math.ceil(effort / 2));
}

export function canMove(state: GameState, to: Hex): boolean {
  return distance(state.party.at, to) === 1 && moveEffort(state, to) !== null;
}

/** Hexes the party could step into right now. */
export function moveOptions(state: GameState): Hex[] {
  return neighbors(state.party.at).filter((h) => moveEffort(state, h) !== null);
}

export function canFish(state: GameState): boolean {
  const here = state.world.tiles[key(state.party.at)];
  if (!here) return false;
  if (here.river || here.terrain === 'shore') return true;
  return neighbors(state.party.at).some((n) => state.world.tiles[key(n)]?.terrain === 'ocean');
}

function actionRng(state: GameState, label: string) {
  return stream(state.seed, 'events').derive(`${label}:${state.day}`);
}

function reveal(state: GameState): void {
  const effects = effectsOn(state.day);
  revealAround(
    state.world,
    state.party.at,
    sightRadius(state.world, state.party.at, effects.sight),
  );
}

/**
 * Marching lines. A chronicle that says "we moved on into forest" six days
 * running is worse than saying nothing, so the phrasing varies and leans on
 * whether the ground underfoot actually changed.
 */
function marchLine(
  state: GameState,
  terrain: Terrain,
  days: number,
  changedGround: boolean,
): string {
  const ground = terrainDef(terrain).name.toLowerCase();
  const rng = actionRng(state, `march:${terrain}`);

  if (days > 1) {
    return rng.pick([
      `It took us ${days} days to cross into ${ground}.`,
      `${days} days of hard going, and ${ground} at the end of it.`,
      `We were ${days} days on that stretch. The ${ground} did not hurry for us.`,
    ]);
  }
  if (changedGround) {
    return rng.pick([
      `We came down into ${ground} before dark.`,
      `The ground turned to ${ground} by afternoon.`,
      `We walked out of one country and into ${ground}.`,
      `By evening we were in ${ground}.`,
    ]);
  }
  return rng.pick([
    'We kept walking. The country did not change.',
    'Another day of the same ground.',
    'We made what distance we could.',
    'We walked from first light and camped where the light left us.',
  ]);
}

/**
 * Gathering is for the road. On your own ground the steading's assigned work
 * IS the day's work, and letting the party forage on top of it paid the same
 * six people twice — enough firewood to make winter a formality.
 */
export function canGather(state: GameState): boolean {
  return !atHome(state);
}

interface Gather {
  amount: number;
  scout?: Person;
}

/** Shared yield maths for forage/hunt/fish. */
function gather(
  state: GameState,
  base: number,
  stat: 'wits' | 'might',
  label: string,
): Gather {
  const effects = effectsOn(state.day);
  const scout = bestAt(state.party.people, stat);
  const skill = scout ? effectiveStat(scout, stat) : 1;
  const rng = actionRng(state, label);
  const roll = rng.float(0.7, 1.3);
  const amount = Math.max(0, Math.round(base * effects.forage * (0.6 + skill * 0.16) * roll));
  return scout ? { amount, scout } : { amount };
}

function advance(state: GameState, days: number): void {
  for (let i = 0; i < days; i++) {
    if (!passDay(state)) return;
  }
}

export function applyTravel(prev: GameState, action: TravelAction): GameState {
  if (prev.end || prev.event) return prev;
  const state = structuredClone(prev);
  const party = state.party;

  switch (action.type) {
    case 'MOVE': {
      if (!canMove(state, action.to)) return prev;
      const days = daysForMove(state, action.to)!;
      const tile = state.world.tiles[key(action.to)]!;
      const changedGround = state.world.tiles[key(party.at)]?.terrain !== tile.terrain;
      party.at = action.to;
      party.hasCamped = false;
      advance(state, days);
      if (state.end) return state;
      reveal(state);
      chronicle(state, marchLine(state, tile.terrain, days, changedGround));
      return state;
    }

    case 'CAMP': {
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const rng = actionRng(state, 'camp');
      const hands = living(party.people).length;
      const home = atHome(state);
      // At home the woodcutters have already been counted; camping there is
      // rest, not a second day's felling.
      const wood = home
        ? 0
        : Math.max(0, Math.round(def.wood * (0.5 + hands * 0.18) * rng.float(0.8, 1.2)));
      party.firewood += wood;
      party.hasCamped = true;

      // Rest mends bodies, but only on a full stomach — and a roof of your own
      // mends them faster than a night under a cloak.
      const fed = party.food > 0;
      const mend = fed ? (home ? 4 : 2) : 0;
      for (const person of living(party.people)) {
        person.health = Math.min(person.maxHealth, person.health + mend);
      }
      party.morale = Math.min(100, party.morale + (fed ? (home ? 7 : 5) : 1));

      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        home
          ? `We rested at ${state.settlement!.name}, and the work went on around us.`
          : wood > 0
            ? `We made camp and cut ${wood} of firewood.`
            : 'We made camp. There was nothing here worth burning.',
        'plain',
      );
      return state;
    }

    case 'FORAGE': {
      if (!canGather(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const { amount, scout } = gather(state, def.forage, 'wits', 'forage');
      party.food += amount;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0
          ? `${scout ? scout.name : 'We'} came back with ${amount} of roots and berries.`
          : 'We searched all day and found nothing worth carrying.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }

    case 'HUNT': {
      if (!canGather(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const { amount, scout } = gather(state, def.hunt, 'wits', 'hunt');
      party.food += amount;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0
          ? `${scout ? scout.name : 'We'} brought down game enough for ${amount}.`
          : 'We followed tracks all day and came back with empty hands.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }

    case 'FOUND': {
      // Setting the posts is a day's work like any other, and the last time
      // this choice will be offered.
      if (!foundSettlement(state)) return prev;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'FISH': {
      if (!canFish(state) || !canGather(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const base = Math.max(def.fish, here.river ? 3 : 0, 2);
      const { amount } = gather(state, base, 'wits', 'fish');
      party.food += amount;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0 ? `The nets came up with ${amount} of fish.` : 'The nets came up empty.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }
  }
}

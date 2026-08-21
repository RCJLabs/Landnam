// Living off the land: the night's camp and the three ways a day on the
// road puts food in the packs. Each verb spends the day through the same
// `advance`/`reveal` walk in road.ts that a march does.

import { key, neighbors } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState, Person } from '../state/types';
import { effectsOn } from './calendar';
import { bestAt, effectiveStat, living } from './people';
import { chronicle } from './saga';
import { atHome } from './site';
import { fieldCrew } from './expedition';
import { mendHull } from './sea';
import { worldBeat } from './beats';
import { actionRng, advance, atSea, reveal } from './road';

/** Water worth putting a net in, from where we are standing (or floating). */
function fishableWater(state: GameState): boolean {
  const here = state.world.tiles[key(state.party.at)];
  if (!here) return false;
  if (here.river || here.terrain === 'shore' || here.terrain === 'ocean') return true;
  return neighbors(state.party.at).some((n) => state.world.tiles[key(n)]?.terrain === 'ocean');
}

/**
 * Gathering is for the road. On your own ground the steading's assigned work
 * IS the day's work, and letting the party forage on top of it paid the same
 * six people twice — enough firewood to make winter a formality.
 */
export function canGather(state: GameState): boolean {
  // Nothing grows on water either. At sea the nets are the only larder.
  return !atHome(state) && !atSea(state);
}

/** Fishing is the one thing a boat is better at than a beach. */
export function canFish(state: GameState): boolean {
  return !atHome(state) && fishableWater(state);
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
  const scout = bestAt(fieldCrew(state), stat);
  const skill = scout ? effectiveStat(scout, stat) : 1;
  const rng = actionRng(state, label);
  const roll = rng.float(0.7, 1.3);
  const amount = Math.max(0, Math.round(base * effects.forage * (0.6 + skill * 0.16) * roll));
  return scout ? { amount, scout } : { amount };
}

export function doCamp(state: GameState): GameState {
  const party = state.party;
  const here = state.world.tiles[key(party.at)]!;
  const def = terrainDef(here.terrain);
  const rng = actionRng(state, 'camp');
  const hands = fieldCrew(state).length;
  const home = atHome(state);
  const afloat = atSea(state);
  // At home the woodcutters have already been counted; camping there is
  // rest, not a second day's felling. At sea there is nothing to cut.
  const wood =
    home || afloat
      ? 0
      : Math.max(0, Math.round(def.wood * (0.5 + hands * 0.18) * rng.float(0.8, 1.2)));
  party.firewood += wood;
  party.hasCamped = true;

  // A night on a beach is when a sprung strake gets seen to. Part of the
  // night's work, not a new verb — see sim/sea.ts.
  if (!afloat) mendHull(state);

  // Rest mends bodies, but only on a full stomach — and a roof of your own
  // mends them faster than a night under a cloak.
  const fed = party.food > 0;
  const mend = fed ? (home ? 4 : 2) : 0;
  // Resting mends whoever is resting: the party on the road, or everyone
  // if there is no steading yet.
  for (const person of home ? living(party.people) : fieldCrew(state)) {
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
      : afloat
        ? 'We lay at anchor in the lee of the land and slept in the boat.'
        : wood > 0
          ? `We made camp and cut ${wood} of firewood.`
          : 'We made camp. There was nothing here worth burning.',
    'plain',
  );
  return state;
}

export function doForage(prev: GameState, state: GameState): GameState {
  if (!canGather(state)) return prev;
  const party = state.party;
  const here = state.world.tiles[key(party.at)]!;
  const def = terrainDef(here.terrain);
  const { amount, scout } = gather(state, def.forage, 'wits', 'forage');
  party.food += amount;
  worldBeat(state, {
    kind: 'gathered',
    how: 'forage',
    got: amount,
    ...(scout ? { who: scout.id } : {}),
  });
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

export function doHunt(prev: GameState, state: GameState): GameState {
  if (!canGather(state)) return prev;
  const party = state.party;
  const here = state.world.tiles[key(party.at)]!;
  const def = terrainDef(here.terrain);
  const { amount, scout } = gather(state, def.hunt, 'wits', 'hunt');
  party.food += amount;
  worldBeat(state, {
    kind: 'gathered',
    how: 'hunt',
    got: amount,
    ...(scout ? { who: scout.id } : {}),
  });
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

export function doFish(prev: GameState, state: GameState): GameState {
  // Deliberately not gated on canGather: the sea is where the fish are.
  if (!canFish(state)) return prev;
  const party = state.party;
  const here = state.world.tiles[key(party.at)]!;
  const def = terrainDef(here.terrain);
  const base = Math.max(def.fish, here.river ? 3 : 0, 2);
  const { amount } = gather(state, base, 'wits', 'fish');
  party.food += amount;
  worldBeat(state, { kind: 'gathered', how: 'fish', got: amount });
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

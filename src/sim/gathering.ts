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
import { landmarkHere } from './landmark';
import { abundance, noteTake, type Larder } from './abundance';
import { fisheryYield } from './fishery';
import { COAST_IS_A_LINE } from './flags';
import { countryHere } from './coast';

/** Water worth putting a net in, from where we are standing (or floating). */
function fishableWater(state: GameState): boolean {
  // Every stop on a COAST has the sea off it — that is what makes it a coast
  // — so the question is not whether there is water but whether it is worth
  // a net, which `fisheryYield` answers. On the hex map it was a real
  // question, because most of the island is inland.
  if (COAST_IS_A_LINE) return true;
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
  /** The share of full yield this hex still paid, for the chronicle's voice. */
  left: number;
}

/**
 * Shared yield maths for forage/hunt/fish.
 *
 * `kind` is also the larder the day is taken FROM: what the hex has left is
 * folded in here, and the take is recorded, so every verb pays the same
 * attention to worked ground without three copies of the rule.
 */
function gather(
  state: GameState,
  base: number,
  stat: 'wits' | 'might',
  kind: Larder,
): Gather {
  const effects = effectsOn(state.day);
  const scout = bestAt(fieldCrew(state), stat);
  const skill = scout ? effectiveStat(scout, stat) : 1;
  const rng = actionRng(state, kind);
  const roll = rng.float(0.7, 1.3);
  const left = abundance(state, kind, state.party.at);
  const amount = Math.max(
    0,
    Math.round(base * effects.forage * (0.6 + skill * 0.16) * roll * left),
  );
  noteTake(state, kind, state.party.at);
  return scout ? { amount, scout, left } : { amount, left };
}

export function doCamp(state: GameState): GameState {
  const party = state.party;
  const def = terrainDef(countryHere(state));
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

  // Where the night was spent, in words a person would use. This is what
  // landmarks are FOR: "we made camp" three nights running reads as one
  // night, and "we made camp under the Split Rock" is somewhere.
  const mark = home || afloat ? null : landmarkHere(state);

  advance(state, 1);
  if (state.end) return state;
  reveal(state);
  chronicle(
    state,
    home
      ? `We rested at ${state.settlement!.name}, and the work went on around us.`
      : afloat
        ? 'We lay at anchor in the lee of the land and slept in the boat.'
        : mark
          ? wood > 0
            ? `We made camp under ${mark.name} and cut ${wood} of firewood.`
            : `We made camp under ${mark.name}. There was nothing there worth burning.`
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
  const def = terrainDef(countryHere(state));
  const { amount, scout, left } = gather(state, def.forage, 'wits', 'forage');
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
      ? left < 0.6
        ? `${scout ? scout.name : 'We'} came back with ${amount}. This ground has been gone over too often.`
        : `${scout ? scout.name : 'We'} came back with ${amount} of roots and berries.`
      : 'We searched all day and found nothing worth carrying.',
    amount > 0 ? 'plain' : 'grim',
  );
  return state;
}

export function doHunt(prev: GameState, state: GameState): GameState {
  if (!canGather(state)) return prev;
  const party = state.party;
  const def = terrainDef(countryHere(state));
  const { amount, scout, left } = gather(state, def.hunt, 'wits', 'hunt');
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
      ? left < 0.6
        ? `${scout ? scout.name : 'We'} took ${amount}. The game has learnt this valley and keeps off it.`
        : `${scout ? scout.name : 'We'} brought down game enough for ${amount}.`
      : 'We followed tracks all day and came back with empty hands.',
    amount > 0 ? 'plain' : 'grim',
  );
  return state;
}

export function doFish(prev: GameState, state: GameState): GameState {
  // Deliberately not gated on canGather: the sea is where the fish are.
  if (!canFish(state)) return prev;
  const party = state.party;
  // WHAT IS IN THE WATER IS NOT DECIDED BY WHAT IS ON THE LAND.
  //
  // `terrainDef(countryHere(state)).fish` is a hex-map question wearing a
  // line's clothes. On the map it reads right — a meadow has `fish: 0`
  // because a meadow is INLAND, and a band standing on one is fishing a
  // river or nothing. On a coast every stretch has the same sea off it, so
  // the same expression prices the catch by the country behind the beach,
  // and it was doing exactly that: measured over eight coasts and four
  // points of the year, a day's net food fishing bare water came to +1.98
  // off a shore stretch and BELOW ZERO off all five others (bog -0.50,
  // forest -0.63, hills -0.47, meadow -0.43, valley -0.42), while the same
  // fishing ground paid 7.29 off a beach and 2.1 off a valley. One sea,
  // seven prices.
  //
  // A coast band fishes as a shore band does — from the beach, because on a
  // line they are never afloat: rowing is a step and not a state, which is
  // the note `fisheryYield` already carries. So the shore's own number is
  // what the sea off any stretch is worth, and it stays in `data/terrain`
  // where the rest of the country's numbers live.
  const def = terrainDef(COAST_IS_A_LINE ? 'shore' : countryHere(state));
  const river = !COAST_IS_A_LINE && state.world.tiles[key(party.at)]?.river === true;
  // A ground pays a multiple, and only to a crew floating on it — see
  // sim/fishery.ts. Folded into the BASE rather than into the take, so the
  // larder still thins with the same rule as any other worked hex: a ground
  // fished four days running is a ground that has been fished four days
  // running, and the boat has to move.
  const ground = fisheryYield(state, party.at);
  const base = Math.max(def.fish, river ? 3 : 0, 2) * ground;
  const { amount, left } = gather(state, base, 'wits', 'fish');
  party.food += amount;
  worldBeat(state, { kind: 'gathered', how: 'fish', got: amount });
  advance(state, 1);
  if (state.end) return state;
  reveal(state);
  chronicle(
    state,
    amount > 0
      ? left < 0.6
        ? `The nets came up with ${amount}. This water has been fished hard.`
        : ground > 1
          ? `The nets came up with ${amount} of fish. There is a ground under us here.`
          : `The nets came up with ${amount} of fish.`
      : 'The nets came up empty.',
    amount > 0 ? 'plain' : 'grim',
  );
  return state;
}

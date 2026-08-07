// New-run construction. Everything derives from the seed: same seed, same
// coast, same warband, same weather in the bones of the world.

import { key } from '../hex';
import { stream } from '../rng';
import { LANDING_NAMES } from '../data/names';
import { effectsOn } from '../sim/calendar';
import { revealAround, sightRadius } from '../sim/fog';
import { makeWarband } from '../sim/people';
import { generateWorld } from '../sim/worldgen';
import { placeNeighbours } from '../sim/neighbours';
import { seedPlaces } from '../sim/places';
import { emptyTally } from '../sim/tally';
import type { GameState } from './types';
import { DEFAULT_HARDSHIP, hardshipById, type HardshipId } from '../data/hardship';
import { SAVE_VERSION } from './version';

export const START_FOOD = 24;
export const START_FIREWOOD = 8;

export function newGame(seed: string, hardship: HardshipId = DEFAULT_HARDSHIP): GameState {
  const terms = hardshipById(hardship);
  const world = generateWorld(stream(seed, 'worldgen'));
  const people = makeWarband(stream(seed, 'party'));
  const landingName = stream(seed, 'worldgen').derive('placename').pick(LANDING_NAMES);
  world.landingName = landingName;
  world.trod = { [key(world.landing)]: 1 };
  // From its own derived stream, so the migration for pre-place saves can
  // hand an old world exactly the places its seed would have been born with.
  world.places = seedPlaces(world, stream(seed, 'worldgen').derive('places'));

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    hardship,
    day: 1,
    modes: ['TRAVEL'],
    world,
    party: {
      at: world.landing,
      people,
      food: Math.round(START_FOOD * terms.stores),
      firewood: Math.round(START_FIREWOOD * terms.stores),
      morale: 70,
      hasCamped: false,
    },
    saga: [
      {
        day: 1,
        text: `The knarr grounded at ${landingName} on a grey morning, and six of us stepped down into water to the knee. Behind us, open sea. Ahead, a country with no name we knew.`,
        tone: 'saga',
      },
    ],
    flags: { landingNamed: 1 },
    grudges: [],
    lore: [],
    tally: emptyTally(),
    neighbours: placeNeighbours(world, stream(seed, 'worldgen').derive('neighbours')),
    nextId: 1,
  };

  const effects = effectsOn(state.day);
  revealAround(world, world.landing, sightRadius(world, world.landing, effects.sight));
  return state;
}

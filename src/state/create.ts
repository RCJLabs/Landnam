// New-run construction. Everything derives from the seed: same seed, same
// coast, same warband, same weather in the bones of the world.

import { stream } from '../rng';
import { LANDING_NAMES } from '../data/names';
import { effectsOn } from '../sim/calendar';
import { revealAround, sightRadius } from '../sim/fog';
import { makeWarband } from '../sim/people';
import { generateWorld } from '../sim/worldgen';
import type { GameState } from './types';
import { SAVE_VERSION } from './version';

export const START_FOOD = 24;
export const START_FIREWOOD = 8;

export function newGame(seed: string): GameState {
  const world = generateWorld(stream(seed, 'worldgen'));
  const people = makeWarband(stream(seed, 'party'));
  const landingName = stream(seed, 'worldgen').derive('placename').pick(LANDING_NAMES);

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    day: 1,
    modes: ['TRAVEL'],
    world,
    party: {
      at: world.landing,
      people,
      food: START_FOOD,
      firewood: START_FIREWOOD,
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
    nextId: 1,
  };

  const effects = effectsOn(state.day);
  revealAround(world, world.landing, sightRadius(world, world.landing, effects.sight));
  return state;
}

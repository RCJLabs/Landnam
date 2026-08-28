// New-run construction. Everything derives from the seed: same seed, same
// coast, same warband, same weather in the bones of the world.

import { makeShip } from '../sim/ship';
import { stream } from '../rng';
import { makeRival } from '../sim/rival';
import { LANDING_NAMES } from '../data/names';
import { makeWarband } from '../sim/people';
import { placeNeighbours } from '../sim/neighbours';
import { seedPlaces } from '../sim/places';
import { emptyTally } from '../sim/tally';
import type { GameState } from './types';
import { BALANCED_HARDSHIP, hardshipById, type HardshipId } from '../data/hardship';
import { SAVE_VERSION } from './version';
import { bareWorld } from './world';

export const START_FOOD = 24;
export const START_FIREWOOD = 8;

export function newGame(seed: string, hardship: HardshipId = BALANCED_HARDSHIP): GameState {
  const terms = hardshipById(hardship);
  const world = bareWorld();
  const people = makeWarband(stream(seed, 'party'));
  const landingName = stream(seed, 'worldgen').derive('placename').pick(LANDING_NAMES);
  world.landingName = landingName;
  // The sand the knarr came onto is a stretch of coast the band has stood
  // on, and the only one it has. Without this the landing is the one stop a
  // saga can never name, which is the opposite of what it is.
  world.trodStops = { '0': 1 };
  world.knownStops = [0];
  // From its own derived stream, so the migration for pre-place saves can
  // hand an old world exactly the places its seed would have been born with.
  world.places = seedPlaces(seed);

  const ship = makeShip(seed);

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    hardship,
    day: 1,
    modes: ['TRAVEL'],
    world,
    ship,
    party: {
      stop: 0,
      people,
      food: Math.round(START_FOOD * terms.stores),
      firewood: Math.round(START_FIREWOOD * terms.stores),
      morale: 70,
      hasCamped: false,
    },
    saga: [
      {
        day: 1,
        text: `${ship.name} grounded at ${landingName} on a grey morning, and six of us stepped down into water to the knee. Behind us, open sea. Ahead, a country with no name we knew.`,
        tone: 'saga',
      },
    ],
    flags: { landingNamed: 1 },
    grudges: [],
    lore: [],
    tally: emptyTally(),
    neighbours: placeNeighbours(stream(seed, 'worldgen').derive('neighbours'), seed),
    // The other boat, derived from the seed like everything else on the
    // coast — a rival is a rule about people, not a fact about terrain.
    ...(() => {
      const rival = makeRival(seed);
      return rival ? { rival } : {};
    })(),
    // PAST the founders, not at 1. `makeWarband` hands out `p1`..`p6`, so a
    // counter starting at 1 gave the first person who ever joined the band
    // the leader's own id — and the next five the ids of the rest. Latent
    // until 2026-08-08 made growth actually happen, then live and silent:
    // everything in this game is keyed by personId, so a duplicate means
    // `fighterPerson` finds the wrong one, a job cannot be given, kin point
    // at the wrong person and the memorial buries somebody who is standing
    // there. Found by a recorder bot that assigned `farmer` to the same
    // person 19,717 times and could not understand why it did not take.
    nextId: people.length + 1,
  };

  // The first morning's sight, which a line does not have. `world.seen` is
  // the hex map's memory; a coast remembers in `knownStops`, set above, and
  // `road.reveal` has skipped the fog pass on a line since 8.2c. Left in, this
  // wrote the LANDING into the seen map of a world with no hexes in it — and
  return state;
}

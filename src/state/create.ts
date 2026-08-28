// New-run construction. Everything derives from the seed: same seed, same
// coast, same warband, same weather in the bones of the world.

import { key } from '../hex';
import { makeShip } from '../sim/ship';
import { stream } from '../rng';
import { makeRival } from '../sim/rival';
import { LANDING_NAMES } from '../data/names';
import { effectsOn } from '../sim/calendar';
import { revealAround, sightRadius } from '../sim/fog';
import { makeWarband } from '../sim/people';
import { generateWorld } from '../sim/worldgen';
import { placeNeighbours } from '../sim/neighbours';
import { COAST_IS_A_LINE } from '../sim/flags';
import { seedPlaces } from '../sim/places';
import { emptyTally } from '../sim/tally';
import type { GameState, World } from './types';
import { BALANCED_HARDSHIP, hardshipById, type HardshipId } from '../data/hardship';
import { SAVE_VERSION } from './version';

export const START_FOOD = 24;
export const START_FIREWOOD = 8;

/**
 * A world with no hexes in it, for a coast.
 *
 * MEASURED FIRST: an eighteen-hundred-tile island is 77.2 kB of an 81.1 kB
 * coast save — 96% of it — and the game does not read one of them. Every
 * derived thing that used to come off the map already comes off the seed
 * instead: `seedPlaces`, `placeNeighbours` and `makeRival` each take the
 * seed and answer in stops, and the five site measures read `stopReport`.
 * So the island was being generated, hashed, saved and loaded for nothing.
 *
 * `landing` stays as the placeholder every other coast address is —
 * `party.at` and `Place.at` are the same `{q:0,r:0}` — because the fields
 * themselves do not go until 8.5's last job, which is the SAVE_VERSION break
 * that retires them.
 *
 * The hex build calls `generateWorld` exactly as before, so worldgen's hash
 * — a contract with the C++ port — does not move.
 */
function bareWorld(): World {
  return {
    width: 0,
    height: 0,
    tiles: {},
    seen: {},
    landing: { q: 0, r: 0 },
    landingName: '',
    trod: {},
    places: [],
  };
}

export function newGame(seed: string, hardship: HardshipId = BALANCED_HARDSHIP): GameState {
  const terms = hardshipById(hardship);
  const world = COAST_IS_A_LINE ? bareWorld() : generateWorld(stream(seed, 'worldgen'));
  const people = makeWarband(stream(seed, 'party'));
  const landingName = stream(seed, 'worldgen').derive('placename').pick(LANDING_NAMES);
  world.landingName = landingName;
  world.trod = { [key(world.landing)]: 1 };
  // The sand the knarr came onto is a stretch of coast the band has stood
  // on, and the only one it has. Without this the landing is the one stop a
  // saga can never name, which is the opposite of what it is.
  if (COAST_IS_A_LINE) {
    world.trodStops = { '0': 1 };
    world.knownStops = [0];
  }
  // From its own derived stream, so the migration for pre-place saves can
  // hand an old world exactly the places its seed would have been born with.
  world.places = seedPlaces(world, stream(seed, 'worldgen').derive('places'), seed);

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
        text: `${ship.name} grounded at ${landingName} on a grey morning, and six of us stepped down into water to the knee. Behind us, open sea. Ahead, a country with no name we knew.`,
        tone: 'saga',
      },
    ],
    flags: { landingNamed: 1 },
    grudges: [],
    lore: [],
    tally: emptyTally(),
    neighbours: placeNeighbours(world, stream(seed, 'worldgen').derive('neighbours'), seed),
    // The other boat. Built from the finished world rather than inside
    // `generateWorld`, so the port's worldgen hash — a contract with the C++
    // side — does not move for a rule about people.
    ...(() => {
      const rival = makeRival(seed, world);
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
  // once the island stopped being generated the landing is (0,0), so it
  // scribbled on the one key every coast placeholder shares.
  if (!COAST_IS_A_LINE) {
    const effects = effectsOn(state.day);
    revealAround(world, world.landing, sightRadius(world, world.landing, effects.sight));
  }
  return state;
}

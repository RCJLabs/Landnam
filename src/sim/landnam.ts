// Taking the land again.
//
// A saga used to stop at five winters. `checkRunEnd` said so plainly — "the
// run has to stop somewhere, and a band that has stood five winters has said
// everything it is going to say" — and it fired whatever the band had built,
// jarldom or no jarldom. Measured, that was day 457 every time.
//
// It was the right call while there was one coast. But a landnám is not a
// place, it is a THING PEOPLE DID, and they did it more than once: a coast
// gives what it has and then a man puts his household back on the ship and
// goes and takes land somewhere else. The larder runs thin, another
// landnámsmaðr's fences are across the good ground, and the answer that made
// sense in the ninth century was to sail.
//
// So the five-winter mark is a RECKONING now, not an ending. The coast is
// done with you; what you do about that is yours. Lay the saga down where it
// stands, or put what she will hold aboard and go and do it again.
//
// What crosses the water is the band and its memory. What does not is the
// coast: its country, its people, its fences, and the man you drove out of
// your hall — he is on that island, and you are not.

import { key } from '../hex';
import { stream } from '../rng';
import { LANDING_NAMES } from '../data/names';
import { generateWorld } from './worldgen';
import { placeNeighbours } from './neighbours';
import { seedPlaces } from './places';
import { revealAround, sightRadius } from './fog';
import { hold } from './ship';
import { living } from './people';
import { childrenOf } from './lineage';
import { chronicle } from './saga';
import { wintersStood } from './calendar';
import { LONG_LIFE_WINTERS } from '../data/thing';
import type { Child, GameState } from '../state/types';

/** How many coasts this band has taken. One is the coast they landed on. */
export const LANDNAM = 'landnam';

/** Raised the day the reckoning is first said, so it is said once. */
export const RECKONED = 'reckoned';

/** Which landnám this is. */
export function landnamNumber(state: GameState): number {
  return state.flags[LANDNAM] ?? 1;
}

/** True once this coast has given what it has. */
export function reckoningDue(state: GameState): boolean {
  return wintersStood(state.day) >= LONG_LIFE_WINTERS;
}

/**
 * Says it, once, on the day it becomes true. Called from the day tick.
 *
 * This replaces an ending, so it has to carry the weight the ending did: the
 * player has to understand that the coast is finished and that the two ways
 * on are both real.
 */
export function markReckoning(state: GameState): boolean {
  if (state.end || !reckoningDue(state) || state.flags[RECKONED]) return false;
  state.flags[RECKONED] = state.day;
  chronicle(
    state,
    `${wintersStood(state.day)} winters on this coast. The ground we broke is `
      + 'broken, the game keeps off it, and what is worth having has somebody '
      + 'else’s posts in it. A man can lay the saga down here, or he can put '
      + 'what the knarr holds aboard her and go and take land somewhere else.',
    'grim',
  );
  return true;
}

export type SailOnBlock = 'notyet' | 'hull' | 'busy' | 'nobody';

export const SAIL_ON_REASON: Record<SailOnBlock, string> = {
  notyet: 'This coast has not finished with us yet.',
  hull: 'She will not cross open water in this state.',
  busy: 'Not with a party out and the hall half-empty.',
  nobody: 'There is nobody left to sail her.',
};

export function sailOnBlocker(state: GameState): SailOnBlock | null {
  if (!reckoningDue(state)) return 'notyet';
  if (state.expedition || state.voyage || state.battle || state.event) return 'busy';
  // She has to swim. A holed hull is mended ashore first, which is a real
  // errand at the end of a run rather than a locked door.
  if (state.ship.strakes <= 0) return 'hull';
  if (living(state.party.people).length === 0) return 'nobody';
  return null;
}

export function canSailOn(state: GameState): boolean {
  return sailOnBlocker(state) === null;
}

/**
 * Takes the land again, somewhere else. Mutates.
 *
 * The new coast is derived from the run seed and which landnám this is, so a
 * replay finds the same second island — the same rule every other derived
 * thing in this game follows.
 */
export function sailOn(state: GameState): boolean {
  if (!canSailOn(state)) return false;

  const nth = landnamNumber(state) + 1;
  const oldName = state.settlement?.name ?? state.world.landingName;
  // The children come along, exactly as they do when a hall is walked out
  // on: they are records kept on the settlement, and leaving them there
  // would delete them.
  const born: Child[] = [...childrenOf(state)];
  if (born.length > 0) state.bairns = [...(state.bairns ?? []), ...born];

  // A NEW country, seeded from the run and the count, so the same saga finds
  // the same second island every time it is replayed.
  const seed = `${state.seed}:landnam:${nth}`;
  const world = generateWorld(stream(seed, 'worldgen'));
  world.landingName = stream(seed, 'worldgen').derive('placename').pick(LANDING_NAMES);
  world.trod = { [key(world.landing)]: state.day };
  world.places = seedPlaces(world, stream(seed, 'worldgen').derive('places'));

  // What she holds is what goes. This is the cost of sailing on, and it is
  // the ship's own number doing the work: five winters of stores do not fit
  // in a knarr, and what will not fit stays on the beach.
  const room = hold(state.ship);
  const food = Math.min(state.party.food, room);
  const firewood = Math.min(state.party.firewood, Math.max(0, room - food));

  state.world = world;
  state.party.at = world.landing;
  state.party.food = food;
  state.party.firewood = firewood;
  state.party.hasCamped = false;
  state.settlement = undefined;
  state.expedition = undefined;
  state.voyage = undefined;
  // A new coast has its own people on it.
  state.neighbours = placeNeighbours(world, stream(seed, 'worldgen').derive('neighbours'));
  state.rival = undefined;
  // And the man we drove out is on THAT island, with our old hall to haunt.
  state.outlaws = undefined;
  // Jobs belong to a steading that no longer exists.
  for (const person of state.party.people) delete person.job;
  state.flags[LANDNAM] = nth;
  delete state.flags[RECKONED];

  revealAround(state.world, state.party.at, sightRadius(state.world, state.party.at, 2));

  chronicle(
    state,
    `We put what she would hold aboard — ${food} of food and ${firewood} of wood — `
      + `left ${oldName} standing empty behind us, and did not look at it again. `
      + `${world.landingName} was the name we gave the beach we came up on. `
      + `This is the ${ordinal(nth)} time we have taken land.`,
    'saga',
  );
  return true;
}

function ordinal(n: number): string {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
  return words[n - 1] ?? `${n}th`;
}

/**
 * Laying it down where it stands: the ending five winters used to force.
 *
 * It is a DEED now rather than a rule, which is the whole change. The lines
 * are the ones `checkRunEnd` used to write, because what they said was true
 * and the only thing wrong with them was that nobody chose them.
 */
export function layDownSaga(state: GameState): boolean {
  if (state.end || !reckoningDue(state)) return false;
  if (state.battle || state.event) return false;
  const alive = living(state.party.people);
  if (alive.length === 0) return false;

  const home = state.settlement;
  const coasts = landnamNumber(state);
  state.end = {
    cause: 'survived',
    title: home ? `${home.name} Endured` : 'We Held the Land',
    lines: [
      `${alive.length} of ${state.party.people.length} were still there after `
        + `${wintersStood(state.day)} winters.`,
      home
        ? `${home.name} was founded on day ${home.foundedOn} and never fell.`
        : 'We never set a post in the ground. We wintered where we stood, year on year.',
      coasts > 1
        ? `${coasts} coasts were taken, and this is the one we stopped on.`
        : 'No title, and no need of one.',
    ],
  };
  return true;
}

// What goes round a hall, and who stops it.
//
// Illness already existed and only winter could give it: `coldNight` rolls
// when the fire goes out, and what it hands out is an `ill_` injury that will
// not mend until the thaw. What it could not do was SPREAD. A cough in a
// longhouse with eleven people in it and room for six behaved exactly like a
// cough in a hall with room to spare, so crowding — which the game already
// counts, and already docks morale for — cost the band nothing it could feel
// in the body.
//
// That is the tradeoff this closes. Taking in another pair of hands is more
// work done and one more chest by the fire; past what the roof has room for,
// it is also how a bad week becomes a bad winter.
//
// And it is answerable. A healer is a hand that grows no food, which is the
// whole cost of having one, and what that hand buys is fewer people going
// down and the ones who are down getting up sooner.

import { stream } from '../rng';
import { ILLNESSES } from './cold';
import { crowding, dayLabour } from './colony';
import { living } from './people';
import { chronicle } from './saga';
import type { GameState, Person } from '../state/types';

/** Odds a day in a crowded hall passes something on, per person already down. */
export const CATCHING = 0.02;

/** What each body past what the roof holds adds to that. */
export const CROWD_BITE = 0.6;

/** No hall is worse than this in a day, however many are down in it. */
export const CATCHING_CAP = 0.14;

/** What a day of tending takes off the odds, per point of care. */
export const CARE_GUARD = 0.35;

/** True of an illness rather than a wound — the `ill_` mark cold.ts writes. */
export function ailing(person: Person): boolean {
  return person.injuries.some((i) => i.id.startsWith('ill_'));
}

/** How many are carrying something catching. */
export function ailingCount(state: GameState): number {
  return living(state.party.people).filter(ailing).length;
}

/** Tending given at the steading today, from whoever is set to it. */
export function careToday(state: GameState): number {
  if (!state.settlement) return 0;
  return dayLabour(state).care;
}

/**
 * The odds something goes round the hall today.
 *
 * Nothing at all without somebody already down, and nothing on the road —
 * this is about a roof with too many people under it, not about six people
 * walking in the open air.
 */
export function catchingOdds(state: GameState): number {
  if (!state.settlement) return 0;
  const down = ailingCount(state);
  if (down === 0) return 0;
  const packed = 1 + crowding(state) * CROWD_BITE;
  const guarded = Math.max(0, 1 - careToday(state) * CARE_GUARD);
  return Math.min(CATCHING_CAP, CATCHING * down * packed) * guarded;
}

/**
 * One day of it going round. Mutates.
 *
 * At most one person a day, whatever the odds say. A roll per healthy body
 * would take a hall of eleven from one cough to five in a week, which is a
 * plague rather than a winter — and the winter is what this game is about.
 */
export function maybeSpread(state: GameState): boolean {
  if (state.end || !state.settlement) return false;
  const odds = catchingOdds(state);
  if (odds <= 0) return false;

  const rng = stream(state.seed, 'colony').derive(`catching:${state.day}`);
  if (!rng.chance(odds)) return false;

  const well = living(state.party.people).filter((p) => !ailing(p));
  if (well.length === 0) return false;
  const caught = rng.derive('who').pick(well);
  const template = rng.derive('what').pick(ILLNESSES);

  caught.injuries.push({ ...template, id: `ill_${state.day}_${caught.id}` });
  chronicle(
    state,
    crowding(state) > 0
      ? `${caught.name} went down with the same thing. There are too many of us `
        + 'under one roof and it is going round.'
      : `${caught.name} caught it too.`,
    'grim',
  );
  return true;
}

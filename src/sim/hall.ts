// A hall has to be KEPT, and this is the third act.
//
// THE MEASUREMENT THAT ASKED FOR IT. Banded over 120 sagas an arm, a run
// dies in its first two years or it is past its third, and past its third it
// is not a late game but a won one: on A Hard Country every single band that
// got there was ruling, and nothing on the coast could kill one. The reason
// was not stores and not raiders. A band past its third year holds about a
// third of a winter's food and one sworn man — and a heart of 100, on every
// arm, on every difficulty.
//
// Morale is what kills bands in their SECOND year: despair took 10 of 22 on
// even, 19 of 45 on fair, 8 of 16 on hard. A jarl is immune to it, and the
// immunity was one line. `heartFromBuildings` paid the heart of everything
// standing into morale EVERY DAY, unconditionally, for ever — longhouse 1,
// mead hall 3, great hall 2, hof 2, so eight a day for a full steading. A
// lost battle costs fifteen. A jarl got the whole of it back in under two
// days, which is why 6.3's bigger raids "moved the curve by nothing": they
// were being fought against an annuity rather than a balance.
//
// So the hall stops paying for having been built once. It pays while it is
// kept, and keeping it is a deed the player takes — the same shape as the
// blót, which was made a deed for the same reason: a rite you choose to hold
// is better than one that happens to you.
//
// THE FIRST YEAR IS PROTECTED BY CONSTRUCTION, not by a special case. Fifty
// three percent of runs already end before their second winter and this must
// not touch them, so the FIRST POINT of heart is free for ever — the roof
// over your head is a comfort whether or not there was a feast in it. A band
// with a longhouse and nothing else is exactly as well off as before. A jarl
// with eight points has seven of them riding on the feast.

import { SEASON_LENGTH } from './calendar';
import { living } from './people';
import type { GameState } from '../state/types';

/**
 * Heart that never needs earning. See the note above: this is the whole of
 * the protection for a young band, and it is a floor rather than a rule
 * about years, so nothing has to know how old a steading is.
 */
export const HEARTH_FREE = 1;

/** How long a feast keeps a hall glad. One season. */
export const KEPT_FOR = SEASON_LENGTH;

/**
 * A feast feeds everybody, and this is what everybody costs.
 *
 * CHEAP ON PURPOSE, and it was not at first. Two a mouth put a full steading
 * at thirty a season, which against a winter's need of about a hundred and
 * seventy is a tax rather than a choice — measured, the bot never once
 * afforded one and every band past its third year read a heart of ZERO. What
 * that built was not a third act but a poverty trap: no food, so no feast,
 * so no heart, so hands walk out, so less work, so less food. Ruling fell
 * from 25 of 30 to 8 of 23 and the deaths came up `starved`.
 *
 * The failure this is supposed to create is FORGETTING, not being unable. A
 * feast a band can always afford if it remembers is a decision; one it can
 * never afford is a fine. So it is one a mouth — about a fortnight of one
 * person's eating for the whole hall — and a band that lets the hall go cold
 * has chosen to.
 */
export const FEAST_PER_MOUTH = 1;

/** Days after which a hall is neglected rather than merely overdue. */
export const NEGLECTED_AFTER = KEPT_FOR * 2;

/** What a feast would cost today. Scales with the mouths at the table. */
export function feastCost(state: GameState): number {
  return Math.max(1, living(state.party.people).length * FEAST_PER_MOUTH);
}

/** Days since the hall was last kept, counting from its founding. */
export function sinceKept(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  return Math.max(0, state.day - (home.kept ?? home.foundedOn));
}

/**
 * How much of the standing heart is actually being paid, 0..1.
 *
 * Not a cliff. A hall does not go cold the morning after a season turns, and
 * a player who is one day late should not lose a jarldom for it — it fades
 * across the second season and then holds at nothing.
 */
export function keptShare(state: GameState): number {
  const since = sinceKept(state);
  if (since <= KEPT_FOR) return 1;
  if (since >= NEGLECTED_AFTER) return 0;
  return 1 - (since - KEPT_FOR) / (NEGLECTED_AFTER - KEPT_FOR);
}

/**
 * The heart a steading pays today, given what it has raised and whether it
 * has been kept.
 *
 * `raised` is the sum of the heart of everything standing — the number that
 * used to be paid whole and for ever.
 */
export function heartPaid(state: GameState, raised: number): number {
  if (raised <= HEARTH_FREE) return raised;
  return HEARTH_FREE + (raised - HEARTH_FREE) * keptShare(state);
}

/** Whether a feast can be held at all: a hall, at home, and food for it. */
export function canKeepHall(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  const home = state.settlement;
  if (!home || home.built.length === 0) return false;
  return state.party.food >= feastCost(state);
}

/**
 * Holds the feast. Mutates.
 *
 * Deliberately NOT a morale bump of its own. The feast's whole worth is that
 * the hall goes on paying, which is a bigger number than any one-off could
 * honestly be — and a rite that both feeds the hall and hands out a bonus is
 * the annuity again wearing a hat.
 */
export function keepHall(state: GameState): boolean {
  if (!canKeepHall(state)) return false;
  state.party.food = Math.max(0, state.party.food - feastCost(state));
  state.settlement!.kept = state.day;
  return true;
}

/** How a feast reads in the saga. Grounded, and it says what it bought. */
const FEAST_LINES = [
  'We ate in the hall until it was dark outside and nobody wanted to go.',
  'The benches were full and the fire was kept up, and for one night the winter was somebody else\'s.',
  'There was meat and there was ale and there was an argument about a horse, and it was a good night.',
  'We held the feast. It cost what it cost, and the hall has been warm since.',
];

/** One line for the saga, chosen off the day so a replay says the same thing. */
export function feastLine(state: GameState): string {
  return FEAST_LINES[state.day % FEAST_LINES.length]!;
}

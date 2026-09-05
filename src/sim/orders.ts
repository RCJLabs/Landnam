// Standing orders: the household's rule for who works what, kept once rather
// than issued daily.
//
// WHY THIS EXISTS, AND IT IS A CHORE READING RATHER THAN A FEATURE IDEA.
// Crewing to the winter mark is the largest single effect this project has
// measured — 89 of 120 bands saw first spring against 29 for a crew set on
// settling day and never touched, paired saved 60 and killed 0 (balance
// harness, even, floor 7, 2026-09-05). It is also, for a person holding a
// phone, 66 assignment taps in an ordinary saga and 257 in a long one
// (PROBE 11.S4, 120 landings to day 500, re-taken 2026-09-05). Every one of
// those taps is the output of the two-line rule below, read off a panel that
// is already showing both halves of it.
//
// So the order is STORED INTENT and the band follows it. What the player is
// choosing is not a number going up: leaving the crew alone against keeping
// the mark met is the saved-60 difference above, and that is a decision about
// how this saga is played rather than a convenience.
//
// WHY THE RULE LIVES HERE AND NOT IN THE HARNESS. It was in the harness —
// `crewsToNeed`, the block every one of those measurements was taken through.
// A rule that only the bot can follow is a rule the game does not have, and
// the figure it produces is a figure about a fixture (CLAUDE.md, trap 1).
// Lifting it into `sim/` is what makes the measurement a measurement of the
// game, and the harness now sets the order and watches, like a player.

import type { GameState, Person } from '../state/types';
import type { JobId } from '../data/jobs';
import { jobById } from '../data/jobs';
import { assign, availableJobs, output } from './colony';
import { living } from './people';
import { forecast, markVisible } from './winter';

/**
 * What a band can be told to do with itself, standing.
 *
 * `mark` is the only order that does anything, and that is deliberate rather
 * than unfinished. 11.S4 proposed three — leave them alone, keep the mark met
 * by putting hands on a NAMED food job, and keep it met on whatever ground
 * pays best — and the third beats the second (11.S2d). An option that is
 * measured to be worse than the one beside it is not a decision; it is a trap
 * wearing a menu. So the order that ships asks the ground, and "leave them
 * alone" is the absence of an order rather than a third entry.
 */
export type OrderId = 'mark';

/**
 * What the order is measured to be worth, for the panel to say.
 *
 * THE INSTRUMENT, THE DATE AND THE N, because this is printed to a player:
 * `says what winter work is worth` in test/balance.test.ts, 120 landings on
 * As It Lies, settler, floor 7, 2026-09-05. A band that picked a crew on
 * settling day and never touched it saw first spring 29 times; a band that
 * moved hands onto whatever the mark said it was short of saw it 89 times.
 * Paired: SAVED 60, KILLED 0.
 *
 * THE DENOMINATOR IS THE 96 BANDS THAT EVER RAISED A STEADING UNDER EITHER
 * ARM, not the 120 seeds. A band still walking the coast cannot be crewed by
 * either arm, so it is not being addressed by a sentence about crewing and
 * does not belong underneath it. Taken as the UNION of the arms rather than
 * from the treated one, because a denominator the treatment picks for itself
 * is the fault CLAUDE.md calls trap 2. This is the same correction 12.3 made
 * to the rations line on the same day, applied here before the line shipped
 * rather than a fortnight after.
 *
 * The bar asserts these three against what it has just measured, so they
 * cannot drift the way five other published figures did before 12.3.
 */
export const ORDERS_SAVED = 60;
export const ORDERS_KILLED = 0;
export const ORDERS_OF = 96;

/**
 * The line the panel shows a band with no standing order. Stated as the
 * record, never as an instruction — the same voice the rations line and the
 * door out use.
 */
export const ORDER_WORTH =
  `${ORDERS_SAVED} bands in ${ORDERS_OF} lived by working the mark; `
  + `${ORDERS_KILLED} died of it`;

/** The food jobs, in the order the old hardcoded rule used to prefer them. */
const FEEDS: JobId[] = ['farmer', 'hunter', 'fisher'];

/**
 * The food job this person's ground and hands actually pay best at.
 *
 * ASKS THE GAME RATHER THAN NAMING ONE. The rule this replaces said 'hunter'
 * in all three of its branches, and 11.S2 measured what that cost: the fisher
 * is the best of the three on 51-94% of settled band-days and the hunter on
 * 4-17%, by 32-49%. `output()` is the same function the day's work is scored
 * through, so the order cannot disagree with the day it is planning.
 */
function feedsBest(state: GameState, person: Person): JobId {
  const open = availableJobs(state);
  return FEEDS
    .filter((id) => open.some((j) => j.id === id))
    .reduce(
      (best, id) => (output(state, person, jobById(id)!) > output(state, person, jobById(best)!)
        ? id
        : best),
      'hunter' as JobId,
    );
}

/**
 * Work the standing order for one day. Returns how many jobs actually moved,
 * which is the number a player would have had to tap.
 *
 * ONLY INSIDE THE MARK'S OWN WINDOW, which is the gate the measured rule had:
 * the order answers the winter forecast, and outside the window there is no
 * forecast worth answering. A band under orders in high summer is left alone,
 * exactly as the bot that produced the saved-60 figure was.
 *
 * The shape of the split — a builder kept on the queue, then hands divided
 * against whichever of food and wood is short — is lifted whole from the
 * harness block those figures came from, deliberately unimproved. Changing
 * the rule and the place it lives in the same commit would leave nothing to
 * compare the re-measure against.
 */
export function followOrders(state: GameState): number {
  const home = state.settlement;
  if (!home || home.orders !== 'mark') return 0;
  if (!markVisible(state)) return 0;

  const need = forecast(state);
  const shortWood = state.party.firewood < need.firewood;
  const shortFood = state.party.food < need.food;
  if (!shortWood && !shortFood) return 0;
  // A band with something on the stocks keeps one pair of hands on it. Without
  // this the mark wipes the builder every day it is up — which is most of the
  // year — and the long game found what that costs: sagas standing at day 259
  // with a hundred and sixty firewood and nothing built, so no mead hall, no
  // Thing, and an endgame no measurement had ever reached.
  const keepBuilder = home.queue.length > 0;

  let moved = 0;
  living(state.party.people).forEach((person, ix) => {
    const want: JobId = keepBuilder && ix === 0
      ? 'builder'
      : shortWood && shortFood
        ? (ix % 2 ? 'woodcutter' : feedsBest(state, person))
        : shortWood
          ? (ix < 4 ? 'woodcutter' : feedsBest(state, person))
          : (ix < 4 ? feedsBest(state, person) : 'woodcutter');
    if (person.job === want) return;
    if (assign(state, person.id, want)) moved += 1;
  });
  return moved;
}

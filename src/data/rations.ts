// Short commons, as numbers.
//
// THE WINTER CALL. Measured over three separate investigations, the first
// winter is not a phase the player plays: stores on its first morning predict
// spring 94–98% of the time, deaths run flat across all four weeks (9/8/7/6)
// rather than at some playable moment, and 27 of 30 are plain starvation with
// nothing on the board to answer them. `readiness()` names two ways out and
// measurement says both make it worse — a band that takes them goes from 17
// survivors to 13, saving nobody.
//
// So this is the lever, and the numbers are chosen so that it is a DECISION
// rather than a rescue:
//
//   - a full band of six eats 3 a day and 2 on short commons, which over a
//     twenty-four day winter is 72 against 48. The measured gap between bands
//     that saw spring and bands that did not was about 33 of stores at the
//     frost, so 24 can turn a near miss and cannot turn a rout. A lever that
//     saved everybody would just be a lower difficulty with extra steps.
//   - and it is paid for in the currency that already kills most: heart.
//     Despair has been the top cause of death in every reading this project
//     has ever taken.

/** What a mouth eats on short commons, against a full share. */
export const RATION_SHARE = 0.5;

/**
 * Heart lost each day the band is on half rations.
 *
 * Two, against the +1 a well-kept camp gives back, so short commons costs a
 * net point a day — about 24 over a winter. Enough to feel across a season
 * and not enough to break a band that was otherwise fine, which is the shape
 * every knob in this game is supposed to have.
 *
 * Deliberately smaller than the 8 that involuntary hunger costs. Choosing to
 * eat less is not the same as having nothing, and the game should not price
 * them the same or nobody would ever choose it.
 */
export const HALF_RATION_HEART = 2;

/** Days of short commons before the weakest of them starts to show it. */
export const HALF_RATION_TOLL = 10;

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

/**
 * What tightening is measured to be worth, for the panel to say.
 *
 * 9.7 ASKED FOR WINTER TO BECOME A SEASON YOU PLAY, on the premise that it
 * "offers almost no decisions". It already holds the two largest decisions in
 * the game — over 120 seeds on As It Lies:
 *
 *   full shares      44/120 saw spring
 *   short commons    65/120                 paired: saved 22, killed 1
 *
 *   crew set once    20/120 saw spring
 *   crewed to the mark, daily  65/120       paired: saved 45, killed 0
 *
 * Nothing else this repo has measured comes near saved 45 and killed nobody.
 * So the fault is not that winter has no decisions; it is the fault 9.3 and
 * 9.4 both turned out to be — the panel names the PRICE of the lever and
 * never its worth. The rations control says "2 off every heart" and, when the
 * band is on full shares, "nobody goes short", which reads as reassurance on
 * exactly the screen where tightening is the thing that would save them.
 */
export const TIGHTENED_SAVED = 22;
export const TIGHTENED_KILLED = 1;
export const TIGHTENED_OF = 120;

/**
 * The line the panel shows on full shares when the larder will not reach
 * spring. Stated as the record, never as an instruction — the same voice the
 * door out uses, because a band that wants to eat properly is entitled to.
 */
export function tighteningWorth(): string {
  return `${TIGHTENED_SAVED} bands in ${TIGHTENED_OF} lived by tightening; `
    + `${TIGHTENED_KILLED} died of it`;
}

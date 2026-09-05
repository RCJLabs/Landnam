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
 * the game. The original reading, over 120 seeds on As It Lies:
 *
 *   full shares      44/120 saw spring
 *   short commons    65/120                 paired: saved 22, killed 1
 *
 * So the fault is not that winter has no decisions; it is the fault 9.3 and
 * 9.4 both turned out to be — the panel names the PRICE of the lever and
 * never its worth. The rations control says "2 off every heart" and, when the
 * band is on full shares, "nobody goes short", which reads as reassurance on
 * exactly the screen where tightening is the thing that would save them.
 *
 * RE-TAKEN 2026-09-05 (12.3), AND BOTH HALVES OF THE OLD FIGURE WERE WRONG
 * FOR THIS BOT. `PROBE 12.3 short commons by audience`, 960 seeds an arm,
 * settler, floor 7, As It Lies, to day 73:
 *
 *   full shares      728/960 saw spring
 *   short commons                          paired: saved 35, killed 5
 *
 * Two separate corrections, and it is worth keeping them apart because only
 * one of them was the hypothesis:
 *
 * 1. THE DENOMINATOR WAS WRONG FOR ITS AUDIENCE. The bar counts all 960
 *    seeds; the panel shows this line only when `forecast(state).foodGap < 0`
 *    (`colonyUi.ts`), to a band that has been told it will not reach spring.
 *    A band never short cannot be saved by tightening and is not being
 *    addressed. So the published figure is now over the 809 seeds where the
 *    line was actually on screen. The correction is real and it turned out to
 *    be SMALL — 809 of 960 bands are told at some point, because the forecast
 *    walks to the next thaw and almost every band's autumn projects short
 *    before its fields come in. The 151 never told contain 2 bands that saw
 *    spring: they are bands that died before they ever founded a steading, so
 *    the line is withheld from nobody tightening could have saved.
 * 2. THE LEVER GOT SMALLER BECAUSE THE BAND GOT HEALTHIER. 22 saved in 120
 *    was read on the floor-9 bot, where full shares saw spring 44 times in
 *    120 (37%). The floor-7 bot settles sooner and sees spring 728 times in
 *    960 (76%), so far fewer bands sit in the narrow strip where 24 days of
 *    stretched stores turns the winter. Nothing about short commons changed.
 *
 * Stated at 960 rather than at the bar's 120 because this is printed to the
 * player: at 120 the same instrument reads saved 4 / killed 2, six discordant
 * pairs, which cannot resolve its own sign. At 40 pairs it can — the exact
 * binomial on 35 of 40 is about 5e-7, and `test/rations.test.ts` fails any
 * future restatement whose margin does not clear that bar.
 */
export const TIGHTENED_SAVED = 35;
export const TIGHTENED_KILLED = 5;
export const TIGHTENED_OF = 809;

/**
 * The line the panel shows on full shares when the larder will not reach
 * spring. Stated as the record, never as an instruction — the same voice the
 * door out uses, because a band that wants to eat properly is entitled to.
 */
export function tighteningWorth(): string {
  return `${TIGHTENED_SAVED} bands in ${TIGHTENED_OF} lived by tightening; `
    + `${TIGHTENED_KILLED} died of it`;
}

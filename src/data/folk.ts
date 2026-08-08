// Who comes to a steading worth coming to, and why.
//
// The other half of 4.3's coast. Every day the game rolls to see whether
// somebody comes over the ridge to take what you have (`maybeRaid`); nothing
// ever rolled to see whether somebody came to JOIN it. The harness found what
// that was worth: over sixty sagas the band never once exceeded the six who
// stepped off the knarr, on an average of 9.8 beds with 5.2 of them standing
// empty. Phase 6.2 built capacity, crowding, hands, the repeatable búð and a
// whole leaving system, and then left the front door shut.
//
// This is the door. It is the landnám story doing what it actually did: a
// hall that stands, feeds people and is on speaking terms with its neighbours
// draws followers, and one that is starving, friendless and at feud does not.

/**
 * Chance a day that somebody comes asking, for a steading at its very best.
 *
 * Swept rather than guessed. Over sixty sagas, measured on the peak band a
 * saga that saw a SECOND WINTER ever reached — the population growth is for:
 * 0.06 gave 6.8 with ten bands getting there, 0.10 gave 7.4 with eight, and
 * 0.16 gave 9.0 with only five. The trend past 0.10 is growth eating its
 * own: hands are mouths first and hands second, and a hall that fills up
 * faster than it can feed itself does not see the spring.
 */
export const DRAW_MAX = 0.1;

/**
 * Days of food the band must have in hand before anybody is taken in.
 *
 * A hard floor rather than another term in the sum, because taking a mouth
 * you cannot feed is not growth — it is a way of starving in company. It also
 * lets the player shut the door on purpose by spending down.
 *
 * Counted in DAYS rather than in sacks, so it scales with the band: a flat
 * number was the first cut, and it shut the door on 45% of all settled days
 * while a hall of ten with the same sacks counted as comfortable.
 */
export const DRAW_LARDER_DAYS = 8;

/** How much of the draw a coast that hates you takes away, at full anger. */
export const DRAW_ANGER = 0.8;

/**
 * Why they came. Past tense, and each one a reason a real person would give:
 * the game already says who arrived, and this is what makes it a person
 * rather than a number going up.
 */
export const WHY_THEY_COME = [
  'walked up the strand with a bundle and asked whether there was work',
  'had been put off their own ground and had nowhere else to be',
  'heard there was a hall here that fed people through the winter',
  'came off a boat that did not wait, and did not seem sorry about it',
  'had been three seasons on the road and said this was far enough',
  'was sent by kin who had heard the name of this place',
  'wanted to be somewhere that would still be standing next year',
  'came for the winter and said nothing about the spring',
];

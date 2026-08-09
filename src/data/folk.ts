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
 * Chance a day that a fighting man comes looking for a share, at the height
 * of a band's infamy.
 *
 * The other door, and the one that makes raiding a way to LIVE rather than a
 * way to die slowly. A hall draws settlers for being safe and fed, and
 * `DRAW_ANGER` shuts that door as the coast turns against you — which is
 * right, and which measured as a death spiral: a raider ended a saga with
 * 0.8 hands where a turtle had 2.8, could not replace a single man he lost,
 * and ground his warband down to nothing in ninety days.
 *
 * But a feared band does not attract nobody. It attracts a different
 * somebody. Men who want a share of what you are taking come BECAUSE the
 * coast is frightened of you, and they come armed — so this draw is fed by
 * the same anger that closes the other one, and by what you have actually
 * taken.
 */
export const SWORD_MAX = 0.055;

/** Sackings before a band's name is worth crossing water for. */
export const SWORD_DEEDS = 4;

/**
 * Why a fighting man came. He is not looking for a place to live, and the
 * lines say so — every one of them is somebody who wants a share.
 */
export const WHY_SWORDS_COME = [
  'came over the hill with a spear and asked what the split was',
  'had heard what we took off the coast and wanted to be there for the next one',
  'was thrown out of somewhere for what he did there, and did not pretend otherwise',
  'said he had no use for a quiet hall and had come a long way to find this one',
  'wanted a share, said so plainly, and was worth having',
  'had followed the story of us up the coast and arrived asking for the man in charge',
];

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

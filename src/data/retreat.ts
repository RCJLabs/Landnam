// Walking out, as numbers.
//
// WHY THIS EXISTS AT ALL, and it is a lie the panel was telling. When a band
// cannot reach spring, `readiness()` has said since the winter work that
// "what is left is taking it from somebody else, or walking out and wintering
// elsewhere". The first of those is a verb — `STRANDHOGG`, `FALL_ON`. The
// second was not. There was no way to walk out: `foundSettlement` says in its
// own comment "there is no unfound, no second steading, and no moving it",
// and `foundBlocker` returns `settled` forever after the first post goes in,
// with a error string that reads "The posts are already in the ground
// elsewhere."
//
// So the game named two ways out, implemented one, and the one it did not
// implement was blocked by a rule with its own error message. A player who
// read the panel and went looking for the door found a wall.
//
// THAT SENTENCE WAS ALREADY FIXED once, earlier the same day, by withdrawing
// the promise rather than building the door — with a note saying that whether
// it SHOULD be a verb was a live question nothing had measured. This file is
// the answer to that note, not a second fix of the same lie.
//
// WHAT IT IS MEASURED AT, AND WHAT THAT MEANS IT IS FOR. Given to the harness
// bot as "walk out when the verdict says this ground will not reach spring",
// over 120 paired landings: 50 retreats, SAVED NOBODY, KILLED ELEVEN, spring
// 48/120 down to 37/120. It is not a winter escape and `readiness()` no
// longer offers it as one — what dooms a band in autumn is empty stores and
// no time, and walking out spends the buildings and a week of road to make
// both worse.
//
// So this is a verb for the OTHER case: ground you took too fast and want to
// be off before the summer is spent. The harness cannot measure that one,
// because the bot only ever settles on ground that already clears its site
// floor, and saying so is more useful than inventing a bot that would.
//
// It ships anyway, and the reason is not "it might be good really". A band
// that has read the verdict and wants to leave should be ABLE to leave: the
// game refusing was never a balance decision, it was `foundSettlement` never
// having been written to happen twice. Whether leaving is wise is the
// player's to get wrong.
//
// THE SHAPE THE NUMBERS HAVE TO GIVE IT. A retreat that costs nothing is a
// site re-roll: found on the first ground you see, read the report, walk out,
// try again. A retreat that costs everything is the death it was supposed to
// be an alternative to. Between those:
//
//   - the WORK is lost and that is the whole price. Buildings, shelter, the
//     watch, the queue and the builder-days banked against it. A band that
//     walks out in autumn is a band that spent its summer for nothing, and
//     that is exactly the decision — the stores come along, because they are
//     on the party's backs and always were.
//   - the HEART is the second price, and it is bigger than founding gave.
//     Raising the posts is +8; leaving them is more than that, or the round
//     trip is free and a player would do it idly.

/**
 * Heart lost for walking out on a steading.
 *
 * Twelve, against the +8 that founding gave, so the round trip is a net loss
 * of four and cannot be done for nothing. Deliberately smaller than the 8-a-
 * day that involuntary hunger costs compounds to within a week: leaving is
 * meant to be survivable, and a band that walks out at the right moment
 * should be worse off than one that never had to and better off than one
 * that stayed to starve.
 */
export const ABANDON_HEART = 12;

/**
 * Days after founding before a steading can be walked out on.
 *
 * The anti-re-roll. Without it the cheapest strategy is to found on whatever
 * ground you are standing on, read the site report the founding hands you,
 * and walk out the same afternoon if it is poor — which turns the one
 * irreversible decision in the game into a free look at the answer.
 *
 * Ten days is enough that the look costs a real slice of the summer, and
 * short enough that a band which has genuinely misjudged its ground is not
 * held there until the frost.
 */
export const ABANDON_AFTER = 10;

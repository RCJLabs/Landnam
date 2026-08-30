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
// THAT CASE HAS NOW BEEN MEASURED, 2026-08-30, AND IT FAILS TOO. The bot can
// settle rashly now, and it can leave on the GROUND at the first legal day
// rather than on the verdict at day forty. Swept over 120 landings on even,
// against the same band staying put (83/120 saw spring):
//
//   leaves ground under 12 — 77/120, 37 walked out, saved 4, killed 10
//   leaves ground under 14 — 45/120, 141 walked out, saved 5, killed 43
//   leaves ground under 16 — 13/120, 246 walked out, saved 3, killed 73
//   leaves ground under 18 —  5/120, 275 walked out, saved 1, killed 79
//
// Read the first line and discount the rest: above a threshold of 12 the
// retreat count runs past the seed count, which is a band founding, leaving,
// founding on ground just as poor and leaving again — a loop, not a strategy.
// The honest arm is `under 12`, one retreat a band at most, and it still
// killed ten to save four.
//
// SO THE VERB IS WRONG AT EVERY HOUR — late on the verdict, early on the
// ground, and every threshold between. It is not withdrawn, because the
// argument below still stands: a band that wants to leave should be able to,
// and whether leaving is wise is the player's to get wrong. What changes is
// that the panel stops being silent about it. A game that puts the price of
// crowding, of short commons and of a cold hall on the screen cannot offer
// this one in silence and call that neutrality.
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

/**
 * What the panel says about walking out, under the price.
 *
 * THE RECORD, NOT A WARNING. The game does not tell the player what to do
 * anywhere else and it does not start here: this is the same kind of line as
 * "5 off every heart" on the crowding mark — a fact the band would know,
 * stated once, in the chronicle's voice. It names the alternative in the same
 * breath because a fact with no other door in it is just discouragement.
 *
 * It lives beside the numbers it comes from so the two cannot drift: if the
 * sweep above ever reverses, this sentence is in the same file as the reason
 * it would have to change.
 */
export const ABANDON_RECORD =
  'Of the bands that walked out, more died for it than were saved by it. '
  + 'The ones that stayed and kept working saw more springs.';

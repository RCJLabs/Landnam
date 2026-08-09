// What ruling is worth, and what it costs.
//
// 6.4 made the jarldom endless on the argument that an endgame reached is not
// an endgame finished — a trophy you cannot go on living in is a trophy. But
// the audit counted what actually changed when the Thing carried, and the
// answer was five things, every one of which makes the game HARDER: three
// points of word, two of raid fame, the Thing closed behind you, a line on
// the band page and a different title on the last screen. Ruling was a
// difficulty setting with a name on it.
//
// A jarl on this coast is owed, and a jarl owes. Both halves are here.

/** Days between one rendering of tribute and the next. A season. */
export const TRIBUTE_EVERY = 24;

/**
 * Standing at which a neighbour will render anything at all.
 *
 * Below this they acknowledge the title and send nothing, which is exactly
 * what a coast does to a jarl it does not like. Ruling does not make people
 * fond of you; it means the ones who ARE fond of you now owe you.
 */
export const TRIBUTE_FLOOR = 10;

/** Food a neighbour sends per point of standing above the floor. */
export const TRIBUTE_FOOD_PER = 0.16;
/** And timber, which they have more of than they have grain. */
export const TRIBUTE_WOOD_PER = 0.22;

/**
 * What a jarl's hall is worth to somebody looking for a place.
 *
 * A multiplier on the draw from data/folk.ts. Men come to serve a name, and
 * this is also the answer the game gives to its own escalation: ruling
 * brings harder men over the ridge, so it had better bring more hands to
 * meet them.
 */
export const JARL_DRAW = 1.7;

/** How a rendering reads in the saga. `{who}` and `{what}` are filled in. */
export const TRIBUTE_LINES = [
  'A cart came up from {who} without being asked for. {what}',
  '{who} sent their portion at the turn of the season. {what}',
  'Two men of {who} left what they had brought at the door and would not come in. {what}',
  'What is owed to a jarl came from {who}, and was counted in front of them. {what}',
];

/** And when nobody sends anything at all. */
export const TRIBUTE_NONE =
  'The season turned, and nothing came up the road from anybody. A title is not the same as a following.';

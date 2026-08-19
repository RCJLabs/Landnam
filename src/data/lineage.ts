// The generation born on this coast, as numbers.
//
// The item this comes from asked for "children born in the steading who grow
// into the band". That cannot be built and the arithmetic says so plainly:
// `GENERATION` is 16 years, a run ends after `LONG_LIFE_WINTERS` — five — and
// until now nobody aged at all. A child born on day 100 is four years old
// when the saga closes. Anything that claimed otherwise would be a lie told
// in a data table.
//
// So what is here is the honest half, and it is the half that bites. A child
// is a MOUTH before it is anything else — that is what a birth in a marginal
// steading actually is — and it is heart, and it is a name the run ends with.
// Nobody grows up. The saga says who was born and who would have inherited,
// which is what a five-winter survival reading as a lineage really means.

/** Days between births. A steading is not a rookery. */
export const BIRTH_COOLDOWN = 90;

/** The chance on any eligible day. Low: over a five-winter run this is a few. */
export const BIRTH_ODDS = 0.02;

/**
 * Food in store before anybody is born.
 *
 * A gate rather than a term, and the same shape as `drawOdds`'s larder floor:
 * a mouth you cannot feed is not growth, it is a slower way of starving. A
 * band scraping through its first winter does not get handed another mouth.
 */
export const BIRTH_FOOD_FLOOR = 40;

/**
 * What a child eats against a grown share.
 *
 * `foodPerDay` counts adults at a half share each, so this is a quarter of a
 * ration — two children come to one more food a day on a band of six. Small,
 * and deliberately not nothing: a birth the larder never felt would be
 * exactly the decoration the Thing's checklist was caught carrying.
 */
export const CHILD_APPETITE = 0.5;

/** What a birth is worth to a band that has been burying people. */
export const BIRTH_HEART = 8;

/** What losing a parent costs on top of the ordinary grief. */
export const ORPHAN_GRIEF = 5;

/** Nobody younger or older than this bears a child. */
export const BEARING_MIN = 16;
export const BEARING_MAX = 44;

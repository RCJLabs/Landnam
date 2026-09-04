// The coast, as a line.
//
// This is to 8.2 what `sim/ranks.ts` was to 8.1: the shape, written and
// proved before anything depends on it. Nothing imports it yet.
//
// A route is STOPS, numbered from the landing outward. Stop 0 is the sand the
// knarr came onto; every stop after it is another stretch of coast, a walk of
// two to four days from the last. Places hang on some of them.
//
// ## Why a line at all
//
// Measured, not assumed. A played 407-day saga (`runs/long.json`) issues
// EIGHT move actions, stands on eight distinct hexes, never revisits one, and
// charts 78 of the world's 1872. Every one of those eight moves offered
// exactly six directions. Eighteen hundred hexes of country exist so that
// eight of them can be stood on, and `data/places.ts` already carries a note
// about the same disease from the other end: the four places were seeded a
// median of 30 hexes out on a map a band sees 2-7% of.
//
// So the problem was never that six directions is too few. It is that travel
// was not a DECISION — 0.7% of a saga's actions against the colony's 53%.
// A line does not fix that by itself. What fixes it is that on a line the
// only question is HOW FAR, and how far costs you twice: once going out and
// once coming home, with winter running the whole time.
//
// ## Derived, never stored
//
// Every answer here is a pure function of `(seed, index)`, the same
// discipline skerries, landmarks and fishing grounds already keep. That buys
// three things: no save change for any of it, a port that gets the coast for
// free, and a strip map that can draw country the band has never walked
// without the world having to remember it.

import { makeRng, type Rng } from '../rng';
import { PLACE_KINDS, placeKind, type PlaceKind } from '../data/places';
import type { Terrain } from '../state/types';

/**
 * How many stops a coast runs before the land gives out.
 *
 * Finite on purpose, and this item's own bar is that a saga can be walked
 * end to end — an endless coast is a coast with no far end to have reached,
 * which is a worse story and an untestable one.
 *
 * Chosen against the CLOCK rather than the map, and the numbers are the
 * argument. A first winter arrives around day 90, so the whole coast there
 * and back has to be more than that or depth is free — and it has to be less
 * than about 240 or the far headland is scenery nobody will ever stand on.
 *
 * The first draft picked 24 stops and legs of one to three days, reasoning
 * from the MEAN: two days a leg, 23 legs, 46 out and 92 back — comfortably
 * past 90. `test/route.test.ts` failed it on the first seed tried, at
 * exactly 90, because the mean was sitting on the bar and half the worlds
 * fall below it. Worse, a coast that rolled short legs the whole way came to
 * 46 days there and back, which a band could walk twice before its first
 * autumn.
 *
 * So the bound is arithmetic on the WORST case rather than the average:
 * `2 * (ROUTE_STOPS - 1) * LEG_MIN > 90` and `2 * (ROUTE_STOPS - 1) *
 * LEG_MAX < 240`. At 26 stops and legs of two to four days that is 100 to
 * 200 days for the whole coast, whatever the dice do — a summer's voyage for
 * a band with a hall to come home to, and out of reach for one still looking
 * for somewhere to put it.
 */
export const ROUTE_STOPS = 26;

/**
 * Shortest and longest a single leg can be, in days.
 *
 * `LEG_MIN` is 2 rather than 1 for the reason above: it is half of what
 * guarantees the coast is longer than a first winter. A one-day hop is
 * pleasant texture and it cost the design its floor.
 */
export const LEG_MIN = 2;
export const LEG_MAX = 4;

/**
 * The country a stretch of coast can be. Never ocean — this is the shore —
 * and never mountains either: a route runs along the strand, not over a
 * summit. Exported because those two absences are load-bearing elsewhere
 * (`foundBlocker` drops its 'sea' and 'rock' refusals on a line, and the
 * ambience bars have to iterate the country a coast HAS rather than the
 * eight a hex map has), and a list every reader retypes drifts.
 */
export const ROUTE_COUNTRY: readonly Terrain[] =
  ['shore', 'bog', 'forest', 'hills', 'meadow', 'valley'];

/**
 * How much of a coast each country is — and it is NOT a sixth each.
 *
 * It was, and what that cost only showed when the whole site report was
 * compared against the hex map's on 2026-08-27. A uniform roll over six
 * countries puts a measured 4.1 VALLEY stretches on a 26-stop coast, and the
 * settling search takes one every time — so a coast site came out at soil
 * 4.13 against a hex site's 2.65, and "no two good things ever come together"
 * was a sentence on a lesson card that the country itself contradicted. Every
 * stretch was somebody's good ground, so no stretch was.
 *
 * The map's own answer, measured over the land around 132 foundable coastal
 * hex sites: shore 51%, forest 25%, bog 21%, valley 3%, meadow 1%, hills 0%.
 * That is the faithful figure and it cannot be copied straight, because a
 * coast with no hills has no ridges — `onHeights` is what `spotFixedPoints`
 * and `spotLandmarks` stand on, and the whole wayfinding mechanic goes with
 * them.
 *
 * So: the map's SHAPE, with hills kept common enough to climb. A valley is
 * about two stretches a coast rather than four, and forest about five — which
 * matters more than it used to, because since `timber` became a DISTANCE (see
 * `timberWithin` in sim/site.ts) the nearest wood is a thing a band walks to
 * rather than a number the ground hands them.
 */
const COUNTRY_SHARE: readonly number[] = [0.30, 0.18, 0.18, 0.14, 0.12, 0.08];

/** A country, by the shares above. */
export function pickCountry(roll: number): Terrain {
  let seen = 0;
  for (let i = 0; i < ROUTE_COUNTRY.length; i += 1) {
    seen += COUNTRY_SHARE[i]!;
    if (roll < seen) return ROUTE_COUNTRY[i]!;
  }
  return ROUTE_COUNTRY[ROUTE_COUNTRY.length - 1]!;
}

export interface Stop {
  /** 0 is the landing. */
  index: number;
  /** What the country is here. */
  country: Terrain;
  /** Days to walk here from the stop before it. Zero at the landing. */
  leg: number;
}

/** One stop's own stream. The same coast, the same country, forever. */
function stopRng(seed: string, index: number, salt: string): Rng {
  return makeRng(`landnam-route:${seed}:${index}:${salt}`);
}

/** Is this a stop on the coast at all? */
export function onRoute(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < ROUTE_STOPS;
}

/**
 * What is at this stop.
 *
 * The landing is always shore, because it is where a knarr was beached and
 * the saga's first line says so.
 */
export function stopAt(seed: string, index: number): Stop {
  const country = index === 0
    ? 'shore'
    : pickCountry(stopRng(seed, index, 'country').next());
  const leg = index === 0
    ? 0
    : stopRng(seed, index, 'leg').int(LEG_MIN, LEG_MAX);
  return { index, country, leg };
}

/**
 * Days of walking between two stops.
 *
 * Symmetric, because the coast does not care which way you are facing — and
 * that symmetry IS the decision this whole milestone rests on: every day
 * spent walking out is a day that has to be spent again walking back.
 */
export function daysBetween(seed: string, from: number, to: number): number {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  let days = 0;
  for (let i = lo + 1; i <= hi; i += 1) days += stopAt(seed, i).leg;
  return days;
}

/**
 * How far out you could get from here on this many days of walking.
 *
 * The answer a player actually wants when looking at the strip: not "how far
 * is the monastery" but "can I be there and back before the food runs out".
 * Returns the furthest stop reachable, which is `from` itself when even the
 * next leg is too long.
 */
export function reachable(seed: string, from: number, days: number, out = true): number {
  let at = from;
  let left = days;
  for (;;) {
    const next = out ? at + 1 : at - 1;
    if (!onRoute(next)) return at;
    const leg = stopAt(seed, out ? next : at).leg;
    if (leg > left) return at;
    left -= leg;
    at = next;
  }
}

/**
 * How rich the coast is this far out, from 0 at the landing to 1 at the far
 * headland.
 *
 * The spine of the design. Depth has to BUY something or "how far do I push"
 * is a question with one sensible answer, and the game already believes this
 * — `PLACE_MAX_FROM_LANDING` exists because the rich places had been seeded
 * where nobody would ever look at them, and the fix was to pull them in, not
 * to make distance worthless.
 *
 * Deliberately not linear. The first few stops are nearly as poor as the
 * landing, so a band cannot nibble at the coast and call it a voyage; the
 * curve then climbs steadily, so every further day is worth a little more
 * than the last one was.
 */
export function richness(index: number): number {
  if (index <= 0) return 0;
  const far = Math.min(1, index / (ROUTE_STOPS - 1));
  return far * far;
}

/**
 * The place at this stop, if there is one.
 *
 * Each kind keeps its own `minFromLanding` from `data/places.ts`, read as
 * STOPS rather than hexes — it already means "how far out before this is
 * allowed", which is the one thing that survives the change of coordinate
 * unaltered.
 *
 * At most one place to a stop. A coast where two things sit in the same
 * place is a coast where one of them can never be gone to.
 */
function rollPlaceAt(seed: string, index: number): PlaceKind | undefined {
  if (!onRoute(index) || index === 0) return undefined;
  // What this stretch of country will actually hold. The hex seeding has
  // always honoured `kind.ground` — it searches tiles for terrain the kind
  // allows — and the coast, which asks each stretch independently rather than
  // searching, simply never asked. Measured before it was fixed: 291 of 399
  // places across sixty coasts stood on ground their own kind forbids, which
  // is iron seams on the open strand and monasteries in bogs. Data-driven
  // content is only data-driven if the engine reads the data.
  const country = stopAt(seed, index).country;
  const kinds = PLACE_KINDS.filter(
    (k) => k.seeded !== false && index >= k.minFromLanding && k.ground.includes(country),
  );
  if (kinds.length === 0) return undefined;
  const rng = stopRng(seed, index, 'place');
  // Rarer near the landing and commoner far out, which is the richness curve
  // showing up as "is there anything here at all" rather than only as what
  // is in the store when you get there.
  if (rng.next() > 0.18 + richness(index) * 0.34) return undefined;
  return kinds[rng.int(0, kinds.length - 1)]!.id;
}

/**
 * The fewest things a coast may have on it.
 *
 * `route.test.ts` has always held that every coast gives the band somewhere
 * to go — a map with nothing on it defeats the point of having places. That
 * bar survived the ground rule above by luck until it did not: honouring
 * `kind.ground` dropped four coasts in two hundred below it, because FOREST
 * is a sixth of every coast and no kind will stand on it.
 */
export const PLACES_FLOOR = 2;

/**
 * How far out "within reach of the landing" reaches, in stretches.
 *
 * A SECOND floor, and a more important one than the count. Honouring
 * `kind.ground` cost the NEAR coast most: measured over two hundred coasts,
 * the chance of anything standing within eight stretches fell from 72% to
 * 42%. The ground rule bites hardest close in, because `minFromLanding`
 * has already narrowed the kinds to the two that want shore.
 *
 * That is not a small loss, and it is a bug this project has already had
 * once. The hex map shipped with every kind floored and never ceilinged, so
 * places sat a median of 30 hexes out and 0.06 of them were ever SEEN —
 * "they stand on this coast, and a coast is something you can walk" exists in
 * `places.test.ts` because of it. A coast that puts everything past the first
 * season is the same mistake in a straight line.
 */
export const PLACES_NEAR = 8;

/**
 * What stands at one stop, or nothing.
 *
 * DELEGATES to `placesOn` rather than rolling, and that is load-bearing.
 * `coastWalk.test.ts` holds that the world's places and this function are the
 * same answer — "two derivations of the same fact would be two facts" — and
 * the moment `placesOn` grew guarantees the roll alone stopped being the
 * whole truth. One derivation, asked two ways.
 */
export function placeAt(seed: string, index: number): PlaceKind | undefined {
  return placesOn(seed).find((p) => p.index === index)?.kind;
}

/**
 * The best thing this stretch could hold, or nothing. Used only by the two
 * guarantees below — the ordinary seeding rolls for itself.
 */
function fill(
  seed: string,
  index: number,
  taken: Set<number>,
  stream_: string,
  want?: (kind: (typeof PLACE_KINDS)[number]) => boolean,
): { index: number; kind: PlaceKind } | undefined {
  if (taken.has(index)) return undefined;
  const country = stopAt(seed, index).country;
  const kinds = PLACE_KINDS.filter(
    (k) => k.seeded !== false && index >= k.minFromLanding && k.ground.includes(country)
      && (want ? want(k) : true),
  );
  if (kinds.length === 0) return undefined;
  const rng = stopRng(seed, index, stream_);
  return { index, kind: kinds[rng.int(0, kinds.length - 1)]!.id };
}

/** Somewhere with people in it to fight — what a strandhögg needs. */
const guarded = (kind: (typeof PLACE_KINDS)[number]): boolean => kind.garrison !== null;

/** Every stop that has something on it, nearest first. */
export function placesOn(seed: string): { index: number; kind: PlaceKind }[] {
  const out: { index: number; kind: PlaceKind }[] = [];
  for (let i = 1; i < ROUTE_STOPS; i += 1) {
    const kind = rollPlaceAt(seed, i);
    if (kind) out.push({ index: i, kind });
  }
  // SOMEWHERE TO GO IN THE FIRST SEASON. Nearest-out rather than farthest-in,
  // because the whole point of this one is that the band reaches it early.
  if (!out.some((p) => p.index <= PLACES_NEAR)) {
    for (let i = 1; i <= PLACES_NEAR; i += 1) {
      const near = fill(seed, i, new Set(out.map((p) => p.index)), 'place-near');
      if (near) { out.push(near); break; }
    }
  }

  // SOMEWHERE TO FALL ON. `strandhogg.test.ts` holds that every world has
  // one, and its own header says why in as many words: "a world with nothing
  // strandable in it makes the whole verb unreachable content there, and no
  // amount of policy fixes that. If this ever goes red, stop looking at the
  // bot." Measured on the coast: 189 of 200. The hex map is 200 of 200 for a
  // structural reason — it seeds one of each kind, so a monastery and a town
  // always exist. A line that rolls each stretch has to be told.
  if (!out.some((p) => guarded(placeKind(p.kind)))) {
    const taken = new Set(out.map((p) => p.index));
    for (let i = ROUTE_STOPS - 1; i > 0; i -= 1) {
      const found = fill(seed, i, taken, 'place-guarded', guarded);
      if (found) { out.push(found); break; }
    }
  }

  if (out.length >= PLACES_FLOOR) return out.sort((a, b) => a.index - b.index);

  // A POOR COAST STILL GETS SOMEWHERE TO GO, and this is a guarantee rather
  // than a raised chance, deliberately. The hex seeding never needed one: it
  // SEARCHES the whole island for ground each kind allows, so it finds some
  // unless the island truly has none. The coast asks each stretch on its own
  // and can therefore roll nothing all the way down a line — a different
  // failure with the same remedy. Tuning the odds up to cover it would have
  // moved every coast to fix four.
  //
  // Far end first: that is where `richness` already says the good things are,
  // so a made-up place lands where an ordinary one would have.
  const taken = new Set(out.map((p) => p.index));
  for (let i = ROUTE_STOPS - 1; i > 0 && out.length < PLACES_FLOOR; i -= 1) {
    const made = fill(seed, i, taken, 'place-floor');
    if (!made) continue;
    out.push(made);
    taken.add(i);
  }
  // Nearest first, as the contract says, whichever pass put them there.
  return out.sort((a, b) => a.index - b.index);
}

/** The whole coast, landing first. For the strip map and for the tests. */
export function route(seed: string): Stop[] {
  return Array.from({ length: ROUTE_STOPS }, (_, i) => stopAt(seed, i));
}

/**
 * Stops where somebody already lives.
 *
 * `count` and `nearDays` are the caller's, from `data/clans` — this module
 * knows about coast and not about clans, and the day the neighbour count
 * changes it should not have to be edited here.
 *
 * The hex map placed them in a RING: no closer to the landing than
 * `CLAN_MIN_GAP` and no further than `CLAN_MAX_GAP`, because the ceiling was
 * a fix for a measured bug — nought of thirty-two clans met across eight
 * five-hundred-day sagas, since the ones seeded across the island were
 * unreachable. A ring is the right shape when a band can go any direction
 * and does not go far.
 *
 * A line wants the opposite shape, for the same underlying reason. The whole
 * decision this phase is built on is HOW FAR, and a coast whose four
 * neighbours are all inside the first fortnight answers it: never far,
 * because there is nobody out there. So they spread — one to a quarter of
 * the coast, which makes pushing out find PEOPLE and not only plunder.
 *
 * What survives from the ring is BOTH its bounds, read onto the first
 * quarter. Its ceiling: the nearest of them is inside `nearDays` of the
 * landing, so the word "neighbour" still means something. Its floor: nobody
 * lives within `room` stops of the sand, which on the hex map was
 * `CLAN_MIN_GAP` and here is the elbow — because the landing is where a band
 * with no better idea puts its posts, and a coast whose first camp sits on
 * stop 1 is a coast that refuses the only site the band has seen. The other
 * three neighbours are the reward for going further, and `neighboursCallOn`
 * walks them outward in that order.
 *
 * One thing to a stop. On 1872 hexes a place and a camp sharing ground was
 * a coincidence that never came up; on 26 stops it would come up constantly,
 * and a stop that is both a monastery and a native camp is a stop where one
 * of them can never be gone to.
 */
export function neighbourStops(
  seed: string,
  count: number,
  nearDays: number,
  room: number,
): number[] {
  const out: number[] = [];
  const band = (ROUTE_STOPS - 1) / count;
  for (let i = 0; i < count; i += 1) {
    const lo = Math.max(1, room, Math.round(1 + i * band));
    let hi = Math.min(ROUTE_STOPS - 1, Math.round((i + 1) * band));
    // The nearest of them is a neighbour in the ordinary sense of the word.
    if (i === 0) hi = Math.max(lo, Math.min(hi, reachable(seed, 0, nearDays)));
    const all: number[] = [];
    const free: number[] = [];
    for (let s = lo; s <= hi; s += 1) {
      if (out.includes(s)) continue;
      all.push(s);
      if (!placeAt(seed, s)) free.push(s);
    }
    // A quarter with something on every stop still gets its neighbour; the
    // rule is "keep out of each other's way where the coast allows", not
    // "ship a coast with three people on it".
    const pool = free.length > 0 ? free : all;
    if (pool.length === 0) continue;
    out.push(pool[stopRng(seed, i, 'clan').int(0, pool.length - 1)]!);
  }
  return out.sort((a, b) => a - b);
}

// Places: seeding them onto the map, and what taking one is worth.
//
// The kinds live in data/places.ts. This file owns three things: where they
// land at worldgen, when the party may take one, and the settling-up when it
// falls — loot, lessons, and what the coast now thinks of you. That last is
// the point of the whole system: robbing this coast is how a player CHOOSES
// escalation, and the pressure machinery (4.3, 6.3) is already listening.

import { stream } from '../rng';
import type { GameState, Place } from '../state/types';
import { GOOD_WORTH, placeKind, type PlaceOffer } from '../data/places';
import { seasonOf } from './calendar';
import { chronicle } from './saga';
import { STRAND_HAUL, STRAND_INFAMY } from './sea';
import { holdShare } from './ship';
import { learn, knows } from './lore';
import { shiftStanding } from './neighbours';
import { note } from './tally';
import { ghostTakenLine, isGhostRuin } from './haunt';
import { worldBeat } from './beats';
import { daysBetween, placesOn } from './route';
import { knowsStop, learnStop, onHeights, standingAt } from './coast';

/**
 * Seeds one place of each kind onto a generated world, where the ground
 * allows. Deliberately tolerant: a world with no bog and no hills simply has
 * no iron seam, and that is a fact about the country rather than a failure.
 *
 * Deterministic from the rng handed in. The migration for old saves calls
 * this with the same derived stream `newGame` uses, so a save from before
 * places existed gains exactly the places its seed would have been born with.
 */
/**
 * The id a place is filed under.
 *
 * `pl_<kind>` was safe for exactly as long as the hex seeding below was the
 * only seeding there was: it walks `PLACE_KINDS` once and puts down AT MOST
 * ONE of each, so the kind is a unique name. The coast does not work that way
 * — `placesOn` asks every stretch independently whether something stands
 * there, and a coast with two towns on it is ordinary. The id template was
 * carried across unchanged, and the result was two places called `pl_town`.
 *
 * That is not a cosmetic clash. `placeById` returns the FIRST match, so a band
 * standing in the second town asked to deal and was told `away` — by the first
 * town, twelve stretches back, which it was indeed away from. Nine of
 * `places.test.ts`'s coast failures were this one line.
 *
 * So on a line the address goes in the name, because on a line the stop IS the
 * address. Nothing needs migrating: the coast worldgen has only ever run
 * behind a flag that ships off, so no save in the world carries these ids.
 */
export function placeIdFor(kind: string, at: { stop?: number }): string {
  return `pl_${kind}_${at.stop ?? 0}`;
}

/**
 * The id a band's own abandoned hall is filed under.
 *
 * Same fault, one street over, and worse: on a coast `settlement.at` is the
 * frozen landing hex, so every steading ever walked out of was filed under the
 * same `ruin:0,0` — and carried no `stop`, which made it unreachable as well
 * as unnamed. A band that walked out could not stand on its own posts.
 */
export function ruinIdFor(at: { stop?: number }): string {
  return `ruin:${at.stop ?? 0}`;
}

export function seedPlaces(seed: string): Place[] {
  // The places are already decided — `route.placesOn` derives them from
  // `(seed, stop)`, so there is nothing to search for and no ground to be
  // picky about. The hex seeder that stood here swept `world.tiles` for
  // candidates and spaced them by `PLACE_MIN_GAP`; a line spaces itself.
  return placesOn(seed).map(({ index, kind }) => ({
    id: placeIdFor(kind, { stop: index }),
    kind,
    stop: index,
  }));
}

/**
 * How far a neighbour's own knowledge of the coast reaches. They know their
 * stretch of it, not the whole island.
 *
 * Twelve, and widening it was measured on 2026-08-13 as a weak, saturating
 * lever: over thirty settler landings the places a band ever learns of go
 * 53 of 120 at this range, 59 at sixteen and 61 at twenty, where twenty is
 * wider than the sixteen-hex radius places are seeded in — a teller who
 * knows the entire coast. Left at twelve, because the gain is inside what
 * this harness resolves and the cost is the sentence above becoming false.
 * The constraint is not what one bargain tells you; see TOLD_AT_ONCE.
 */
export const TOLD_RANGE = 12;

/**
 * How many places one bargain is worth.
 *
 * ONE, and raising it is measured as doing NOTHING — 2 and 3 are
 * byte-identical to 1 at every range tried (2026-08-13). Not because the
 * knob is inert: with two unseen places inside a teller's reach the
 * function names two, checked directly before the null was believed. It is
 * that at bargain time there is essentially never more than one unseen
 * place within reach, so the candidate set is size 0 or 1 and a bigger
 * slice takes the same one place.
 *
 * Kept as a named constant rather than folded back into the code because
 * the number is now a MEASUREMENT — the next reader who reaches for "tell
 * them about more of the coast" can see it was tried.
 */
export const TOLD_AT_ONCE = 1;

/**
 * What a trader tells you while the goods are being weighed.
 *
 * A ceiling on placement puts the fixed places within reach; this is how a
 * band LEARNS of them, and it is the half that matters. Clans could be made
 * to come and look at a new steading — a monastery cannot walk over. But
 * word of one travels, and the game already has the machine for it: people
 * who deal with you talk. So a bargain now pays twice, in timber and in
 * knowing what is on this coast, and the plunder economy finally has a
 * road into it that is not "walk two hundred hexes and hope".
 *
 * One place per bargain, nearest to the teller first, and only what they
 * could plausibly know. Returns what was named, or nothing.
 */
export function tellOfPlace(
  state: GameState,
  teller: string,
  fromStop = standingAt(state),
): Place | undefined {
  // A place is known or it is not — there is no fog over it on a line.
  // TOLD_RANGE keeps its number and its meaning: on the hex map a hex was a
  // day's walk, so twelve hexes of "their stretch of the coast" is twelve
  // days of it here.
  const known = (p: Place) => knowsStop(state, p.stop ?? 0);
  const away = (p: Place) => daysBetween(state.seed, p.stop ?? 0, fromStop);
  const near = state.world.places
    .filter((p) => !known(p) && away(p) <= TOLD_RANGE)
    .sort((a, b) => away(a) - away(b))
    .slice(0, TOLD_AT_ONCE);
  if (near.length === 0) return undefined;
  for (const told of near) {
    learnStop(state, told.stop ?? 0);
    const def = placeKind(told.kind);
    chronicle(
      state,
      `They talked while the goods were weighed. There is ${def.name} off that way, ` +
        `and ${teller} were content that we should know it.`,
      'plain',
    );
  }
  return near[0];
}

/**
 * How far a landmark can be picked out from high ground.
 *
 * The second road into the place economy, and it exists because the first
 * one is measurably not enough. Word of mouth is gated behind a bargain,
 * bargains happen once or twice a saga, and no widening of what a bargain
 * TELLS you fixes that — see TOLD_AT_ONCE. Measured 2026-08-13: a settler
 * learned of 53 of 120 places in thirty sagas, a band that never trades
 * only 13, and a place was first heard of on day 74 on average, long after
 * the walking is over.
 *
 * A house of the White Christ, a trading town, a wreck on the strand, a
 * seam of bog iron: these are not tents. They are the things a country is
 * navigated BY, and a man standing on a ridge picks them out far past the
 * distance he could make out the ground itself. So this is deliberately
 * much further than `sightRadius` — that is what a landmark IS.
 *
 * High ground only, which is the point rather than a limitation: hills and
 * mountains already raise sight and already break line of sight for
 * everyone below, so climbing is a thing the map rewards. This makes the
 * climb pay in knowledge instead of another two hexes of grass.
 */
export const LANDMARK_SIGHT = 8;

/**
 * Everything newly picked out from where the party stands. Mutates
 * `world.seen`; callers hold a clone, as everywhere else in the sim.
 *
 * Sight only — the place is marked KNOWN, exactly as a teller's word marks
 * it, and nothing else about it changes. Seeing a monastery from a ridge
 * tells you it is there and not one thing about what is in it.
 */
export function spotLandmarks(state: GameState): Place[] {
  const world = state.world;
  // A coast IS a line of sight. There is nothing for a hill to stand behind
  // when the country runs in one direction, so the hex map's blocking check
  // has no line-shaped question to ask and is gone with it.
  if (!onHeights(state)) return [];
  const here = standingAt(state);

  const spotted: Place[] = [];
  for (const place of world.places) {
    const stop = place.stop ?? 0;
    if (knowsStop(state, stop)) continue;
    if (daysBetween(state.seed, here, stop) > LANDMARK_SIGHT) continue;
    learnStop(state, stop);
    spotted.push(place);
    worldBeat(state, { kind: 'spotted', id: place.id, place: place.kind, stop });
    chronicle(
      state,
      `From the high ground we made out ${placeKind(place.kind).name} away off, ` +
        'and marked where it stood.',
      'plain',
    );
  }
  return spotted;
}

// --- Dealing across a counter ---

export type TradeBlock = 'gone' | 'away' | 'taken' | 'nomarket' | 'stores';

export const TRADE_REASON: Record<TradeBlock, string> = {
  gone: 'There is nothing of the kind here.',
  away: 'It is not under your feet.',
  taken: 'There is nobody left here to deal with.',
  nomarket: 'Nobody here trades in anything.',
  stores: 'We have not got enough to carry in.',
};

/**
 * What one offer pays TODAY.
 *
 * The rate on a `PlaceOffer` is its high-summer price; the season moves it by
 * what each good is worth that quarter (see GOOD_WORTH). Both the counter and
 * the button that describes the counter come through here — they used to do
 * the same arithmetic in two places, which is exactly how a shown price and a
 * paid price come to differ.
 *
 * Never less than one: a deed that costs stores and returns nothing is a bug
 * wearing a price tag.
 */
export function offerGot(offer: PlaceOffer, day: number): number {
  const worth = GOOD_WORTH[seasonOf(day)];
  const rate = offer.rate * (worth[offer.give] / worth[offer.take]);
  return Math.max(1, Math.round(offer.cost * rate));
}

/** The offers this place makes, or none. */
export function offersAt(state: GameState, id: string): PlaceOffer[] {
  const place = placeById(state, id);
  if (!place || place.sackedOn !== undefined) return [];
  return placeKind(place.kind).market ?? [];
}

export function tradeBlocker(state: GameState, id: string, offerId: string): TradeBlock | null {
  const place = placeById(state, id);
  if (!place) return 'gone';
  // `standingOn`, not a hex comparison. `sackBlocker` was converted in 8.2c
  // and this — its sibling, four functions down, asking the identical
  // question — was not, so on a coast every market in the world answered
  // "you are not here". Seven of `places.test.ts`'s failures were this line.
  if (!standingOn(state, place)) return 'away';
  // Steel ends a market. There is no dealing with a place you have emptied.
  if (place.sackedOn !== undefined) return 'taken';
  const offer = (placeKind(place.kind).market ?? []).find((o) => o.id === offerId);
  if (!offer) return 'nomarket';
  if (state.party[offer.give] < offer.cost) return 'stores';
  return null;
}

export interface PlaceTrade {
  gave: number;
  got: number;
  offer: PlaceOffer;
}

/**
 * Deals at a place. Mutates; callers hold a clone.
 *
 * No haggling: a market's price is a market's price, where a neighbour's
 * moves with their opinion of you and with the wits of whoever carried the
 * sack. That is the difference the player should feel, and it is also what
 * makes the spread safe to reason about.
 */
export function tradeAt(state: GameState, id: string, offerId: string): PlaceTrade | null {
  if (tradeBlocker(state, id, offerId) !== null) return null;
  const place = placeById(state, id)!;
  const def = placeKind(place.kind);
  const offer = (def.market ?? []).find((o) => o.id === offerId)!;

  const got = offerGot(offer, state.day);
  state.party[offer.give] -= offer.cost;
  state.party[offer.take] += got;
  state.party.morale = Math.min(100, state.party.morale + 2);
  note(state, 'bargains');

  const gaveWord = offer.give === 'food' ? 'of food' : 'of firewood';
  const gotWord = offer.take === 'food' ? 'of food' : 'of timber';
  worldBeat(state, {
    kind: 'dealt', id: place.id, place: place.kind, stop: place.stop,
    gave: offer.cost, got,
  });
  chronicle(state, `${offer.line} ${offer.cost} ${gaveWord} for ${got} ${gotWord}.`, 'good');
  // A counter is where the coast's news is. Same trade as a neighbour's.
  tellOfPlace(state, def.name, place.stop);
  return { gave: offer.cost, got, offer };
}

export function placeById(state: GameState, id: string): Place | undefined {
  return state.world.places.find((p) => p.id === id);
}

/** The place the party is standing on, if any. */
export function placeHere(state: GameState): Place | undefined {
  const at = standingAt(state);
  return state.world.places.find((p) => p.stop === at);
}

/** Is the band standing where this place is? */
function standingOn(state: GameState, place: Place): boolean {
  return place.stop === standingAt(state);
}

export type PlaceBlock = 'gone' | 'away' | 'taken';

export function sackBlocker(state: GameState, id: string): PlaceBlock | null {
  const place = placeById(state, id);
  if (!place) return 'gone';
  if (!standingOn(state, place)) return 'away';
  if (place.sackedOn !== undefined) return 'taken';
  return null;
}

export const PLACE_REASON: Record<PlaceBlock, string> = {
  gone: 'There is nothing of the kind here.',
  away: 'It is not under your feet.',
  taken: 'It has already been picked clean.',
};

/**
 * The settling-up when a place falls — after the fight, if it took one.
 * Loot into the packs, a lesson if one was there to take, the place marked
 * taken for good, and the coast's opinion moved where anyone owns it.
 */
export function settlePlace(state: GameState, id: string, fromSea = false): void {
  const place = placeById(state, id);
  if (!place || place.sackedOn !== undefined) return;
  const def = placeKind(place.kind);

  // A hold takes more than backs can carry, and the coast remembers a sail
  // far longer than it remembers men on the road. See sim/sea.ts.
  // The hold is what makes a strandhögg worth more than walking up to the
  // same gate — `STRAND_HAUL` has said so in a comment since the sea work and
  // multiplied by a constant regardless. A sprung hull carries less home.
  const haul = fromSea ? STRAND_HAUL * holdShare(state.ship) : 1;
  state.party.food += Math.round(def.loot.food * haul);
  state.party.firewood += Math.round(def.loot.firewood * haul);
  state.party.morale = Math.min(100, Math.max(0, state.party.morale + def.loot.morale));
  place.sackedOn = state.day;
  note(state, 'sackings');

  if (def.teaches && !knows(state, def.teaches.lore)) {
    const roll = stream(state.seed, 'events').derive(`place:${id}`).next();
    if (roll < def.teaches.odds) learn(state, def.teaches.lore);
  }

  if (def.infamy !== 0) {
    // Word starts where the smoke is seen: the nearest neighbour learns what
    // an armed band did here, and thinks accordingly.
    const away = (n: { stop?: number }) =>
      daysBetween(state.seed, n.stop ?? 0, place.stop);
    const nearest = [...state.neighbours].sort((a, b) => away(a) - away(b))[0];
    if (nearest) {
      shiftStanding(state, nearest.id, Math.round(def.infamy * (fromSea ? STRAND_INFAMY : 1)));
    }
  }

  worldBeat(state, {
    kind: 'sacked', id: place.id, place: place.kind, stop: place.stop,
    ...(fromSea ? { bySea: true as const } : {}),
  });
  chronicle(state, def.sackLine, def.garrison !== null ? 'grim' : 'good');
  // A ruin is the one place that belonged to somebody with a name. The panel
  // has always said whose it was while the band stood in it; the saga is
  // where a run is actually remembered, and it said nothing at all. See
  // `ghostTakenLine` for the measurement that found this.
  if (isGhostRuin(place)) {
    const whose = ghostTakenLine(state);
    if (whose) chronicle(state, whose, 'saga');
  }
  if (fromSea) {
    chronicle(state, 'We loaded the knarr to the thwarts and were gone on the tide.', 'good');
  }
}

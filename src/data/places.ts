// The places. Pure data — sim/places.ts seeds them onto the map and settles
// what taking one is worth; adding a kind here never touches engine code.
//
// This is the audit's first finding made flesh: "go out under arms" had no
// destination, because nothing on the map was worth walking to. These are.
// The rich ones are guarded, the guarded ones are provocations, and every
// one is taken ONCE — a monastery does not restock.

import type { Place, Season, Terrain } from '../state/types';
import type { LoreId } from './lore';

export type PlaceKind = Place['kind'];

export interface PlaceKindDef {
  id: PlaceKind;
  /** How the map and the site panel name it. */
  name: string;
  /** The site panel's line when you are standing on it. */
  blurb: string;
  /** What the deed button says. */
  deed: string;
  /** Terrain it can be seeded on. */
  ground: Terrain[];
  /**
   * Whether worldgen puts one in every country.
   *
   * False for a kind that only exists when something deliberately places it —
   * a ruin is somebody else's dead steading arriving on a challenge code, and
   * a world that grew its own would be a world where the ghost meant nothing.
   * Absent means true, so every kind that came before this is untouched and
   * `port/golden.json`'s worldgen vectors do not move.
   */
  seeded?: boolean;
  /** How far from the landing it is seeded, so the rich ones are a voyage. */
  minFromLanding: number;
  /**
   * Battle difficulty of whoever holds it, or null for an undefended place —
   * taking a wreck apart is a day's work, not a fight.
   */
  garrison: number | null;
  loot: { food: number; firewood: number; morale: number };
  /** A chance the taking teaches something. See data/lore. */
  teaches?: { lore: LoreId; odds: number };
  /**
   * What the coast thinks of an armed band that did this — a shift on the
   * NEAREST neighbour's standing, because word starts where the smoke is
   * seen. Nought for salvage nobody owns.
   */
  infamy: number;
  /** Chronicle line when it falls. Past tense; it goes in the saga. */
  sackLine: string;
  /**
   * What they will DEAL in, if anything.
   *
   * A trading town whose only verb was "fall on the town" is the gap a
   * player found on his phone: jetties, warehouses and a paid watch, and the
   * game offered steel or nothing. Places with a market can be traded with
   * as often as you like — until somebody draws on them, after which there
   * is no market and no place.
   *
   * Data, so a new market is a new entry here and never a change to the
   * engine.
   */
  market?: PlaceOffer[];
}

/**
 * One thing a place will do for you across a counter.
 *
 * Prices here are FIXED, where a camp's are haggled on the trader's wits and
 * on what they think of you. That is the difference between a market and a
 * neighbour, and it is also what keeps the arithmetic safe: a town that
 * buys and sells the same goods on one hex must lose on the spread, or two
 * deeds standing still make timber out of nothing.
 */
/**
 * What a good is WORTH in each season, and the whole of the seasonal market.
 *
 * The game is about surviving a winter and its only counter charged the same
 * in high summer as in deep frost, which made a market a fixed exchange rate
 * rather than a decision. These numbers give it a calendar: nobody pays much
 * for grain the week after harvest, and everybody pays for it in Thorri.
 *
 * A rate is scaled by `worth(given) / worth(taken)`, so carrying the scarce
 * thing to a counter is what pays — timber to the monastery in autumn, food
 * to the town in summer.
 *
 * **The spread cannot be broken by waiting.** On a round trip through two
 * offers the two ratios are reciprocal and cancel exactly, whatever the
 * season, so a town that buys and sells the same goods still loses on the
 * spread in every month of the year. That is a property rather than a
 * hope — test/places.test.ts checks it in all four.
 */
export const GOOD_WORTH: Record<Season, { food: number; firewood: number }> = {
  // Nothing is scarce, and the woods are being cut.
  summer: { food: 1, firewood: 0.85 },
  // The harvest is in. Grain is cheap and everyone wants fuel laid by.
  autumn: { food: 0.8, firewood: 1 },
  // Both dear, and dear together — which is why winter is no time to deal.
  winter: { food: 1.35, firewood: 1.35 },
  // The stores are down and the woods are not cut yet.
  spring: { food: 1.2, firewood: 1 },
};

export interface PlaceOffer {
  id: string;
  /** What the button says. */
  deed: string;
  blurb: string;
  /** What you carry in, and how much of it. */
  give: 'food' | 'firewood';
  cost: number;
  /** What you carry out, at this much per unit given. */
  take: 'food' | 'firewood';
  rate: number;
  /** Past tense, for the saga. */
  line: string;
}

/**
 * And no further than this from the landing.
 *
 * The same disease the coast had, found the same way. Every kind had a floor
 * on how near it could be seeded and no ceiling at all, so across forty
 * worlds the four fixed places sat a MEDIAN of 30 hexes from the sand and as
 * far as 52 — on a map a band sees 2-7% of in a five-hundred-day saga.
 * Measured directly: 4.00 places still standing per settled day, and 0.06 of
 * them ever seen. The monastery, the town, the wreck and the iron seam are
 * the whole of the plunder economy, the reason the knarr exists and the only
 * things a band can go OUT for once the posts are in — and they were placed
 * where nobody would ever look at them.
 *
 * Sixteen is a little further out than the neighbours at thirteen, which is
 * right: a neighbour is somebody you deal with, a monastery is somewhere you
 * go. The town's own floor is eleven, so the band still has to voyage for
 * the rich one.
 */
export const PLACE_MAX_FROM_LANDING = 16;

export const PLACE_KINDS: PlaceKindDef[] = [
  {
    id: 'monastery',
    name: 'a house of the White Christ',
    blurb: 'Stone cells, a bell, and men who do not carry weapons. There is more in their store than in their yard.',
    deed: 'Fall on the house',
    ground: ['shore'],
    minFromLanding: 6,
    garrison: 1,
    loot: { food: 18, firewood: 4, morale: 8 },
    teaches: { lore: 'runes', odds: 0.5 },
    infamy: -6,
    sackLine: 'We fell on the house of the White Christ and carried off what generations had given it. The bell went into the sea.',
    // They keep a granary and they do not keep a woodpile. For a band with
    // a full woodshed and an empty larder this is the only door that opens.
    market: [
      {
        id: 'bread',
        deed: 'Buy bread from the house',
        blurb: 'They keep a granary against lean years, and will part with some of it for firewood.',
        give: 'firewood',
        cost: 18,
        take: 'food',
        rate: 0.55,
        line: 'We carried firewood up to the house of the White Christ and came away with bread. Nobody drew anything.',
      },
    ],
  },
  {
    id: 'ruin',
    // Never seeded. This kind exists so a challenge code can carry a band's
    // fallen steading onto somebody else's coast — see `sim/haunt.ts`.
    seeded: false,
    name: 'a steading nobody came back to',
    blurb: 'Posts still standing, a hearth full of rain, and a woodpile somebody stacked and never burned.',
    deed: 'Go through the ruin',
    ground: ['meadow', 'shore', 'valley', 'hills'],
    // Never seeded, so this is not a seeding constraint — it is the same
    // truth `haunt.ts` enforces: a ruin never stands on the landing beach,
    // because the first thing a player sees should be their own shore and
    // not somebody else's grave.
    minFromLanding: 1,
    // Nobody holds it. Taking a dead steading apart is a day's work and no
    // fight, the way the wreck is.
    garrison: null,
    // Deliberately modest, and mostly TIMBER: what survives a bad winter in
    // an abandoned steading is the woodpile and the walls, not the larder —
    // the larder is what ran out. It also keeps a haunted coast from being an
    // easier coast, which would make a challenge worth less than the seed it
    // was cut from.
    // Under the wreck's, deliberately — 2/9 is what an unowned salvage pays
    // and a ruin must not beat it, or a haunted coast is a richer coast.
    loot: { food: 2, firewood: 8, morale: 4 },
    infamy: 0,
    sackLine: 'We took what the last people here had stacked against a winter they did not see the end of.',
  },
  {
    id: 'town',
    name: 'a trading town',
    blurb: 'Jetties, warehouses, and a watch that is paid to be awake. Rich enough to be worth it, and it knows.',
    deed: 'Fall on the town',
    ground: ['shore', 'valley', 'meadow'],
    minFromLanding: 11,
    garrison: 4,
    loot: { food: 26, firewood: 16, morale: 10 },
    infamy: -16,
    sackLine: 'We took the trading town at a run and left it lighter by a winter of stores. The whole coast will hear of it.',
    // A market, which is what the word TOWN was always promising. It deals
    // both ways and takes its cut on the spread — 1.6 out against 0.5 back
    // is a fifth lost on a round trip, so standing at the counter all day
    // makes nothing. It is also the one place that will deal with a band the
    // whole coast has stopped speaking to.
    market: [
      {
        id: 'buy-timber',
        deed: 'Buy timber in the town',
        blurb: 'The warehouses are full of it, and they would rather have food than planks.',
        give: 'food',
        cost: 10,
        take: 'firewood',
        rate: 1.6,
        line: 'We spent the day on the jetties and came away with timber the town could spare.',
      },
      {
        id: 'sell-timber',
        deed: 'Sell timber in the town',
        blurb: 'They will take cut wood off your hands, at a townsman\u2019s price.',
        give: 'firewood',
        cost: 20,
        take: 'food',
        rate: 0.5,
        line: 'We sold cut wood on the jetties. The price was a townsman\u2019s price, and we took it.',
      },
    ],
  },
  {
    id: 'wreck',
    name: 'a wreck on the strand',
    blurb: 'A hull broken-backed on the rocks, stripped by nobody yet. Good timber, and maybe better lessons.',
    deed: 'Break up the wreck',
    ground: ['shore'],
    minFromLanding: 3,
    garrison: null,
    loot: { food: 2, firewood: 9, morale: 2 },
    teaches: { lore: 'shipwright', odds: 0.35 },
    infamy: 0,
    sackLine: 'We broke the wreck up for her timber, and learned from her bones how she had been put together.',
  },
  {
    id: 'oreseam',
    name: 'a seam of bog iron',
    blurb: 'Orange water and heavy stone in the bank. Somebody who knew fire could make this worth a great deal.',
    deed: 'Work the seam',
    ground: ['bog', 'hills', 'mountains'],
    minFromLanding: 4,
    garrison: null,
    loot: { food: 0, firewood: 0, morale: 3 },
    teaches: { lore: 'smithing', odds: 0.8 },
    infamy: 0,
    sackLine: 'We worked the iron seam until we understood it, and marked the bank for the years to come.',
  },
];

export function placeKind(id: PlaceKind): PlaceKindDef {
  return PLACE_KINDS.find((k) => k.id === id) ?? PLACE_KINDS[0]!;
}

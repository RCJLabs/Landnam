// The people who were here first, and the people who came the year before you.
//
// Pure data. src/sim/neighbours.ts places them, tracks what they think of you,
// and decides what that means.

export type ClanKind = 'clan' | 'native';

export interface ClanKindDef {
  id: ClanKind;
  /** What they are called on the chart. */
  noun: string;
  /** Where standing starts. Nobody is pleased to see a new hall go up. */
  opening: number;
  /** Multiplier on what a raid from them brings. */
  strength: number;
  /**
   * What their stores hold for whoever takes the place at a run. Scaled up
   * by their might — a camp that can defend itself is a camp worth having.
   */
  plunder: { food: number; firewood: number };
}

export const CLAN_KINDS: ClanKindDef[] = [
  {
    id: 'clan',
    noun: 'steading',
    // Another Norse hall on the same coast is a rival before it is anything.
    opening: -10,
    strength: 1.15,
    // A hall keeps timber: they build the way we build.
    plunder: { food: 8, firewood: 22 },
  },
  {
    id: 'native',
    noun: 'camp',
    // The people already here have no quarrel until you give them one.
    opening: 10,
    strength: 0.9,
    // A camp keeps food: smoked fish, dried meat, a winter's gathering.
    plunder: { food: 14, firewood: 8 },
  },
];

// Takes a plain string because a Neighbour's kind comes off a save file, where
// it is whatever an older version wrote. Unknown ids fall back rather than
// throwing — a save must always load.
export function clanKind(id: string): ClanKindDef {
  return CLAN_KINDS.find((k) => k.id === id) ?? CLAN_KINDS[0]!;
}

/** Hall names for rival Norse. */
export const CLAN_NAMES = [
  'Grimsgarth', 'Ketilstead', 'Hrafnsvik', 'Bergthorsholt', 'Ulfsfell',
  'Skallagrimsstead', 'Thorgestholt', 'Vigahall', 'Eyrarbakki', 'Svartafell',
];

/** What the people already here call their own places. */
export const NATIVE_NAMES = [
  'The Reed Camp', 'Sealwatch', 'The Long Weir', 'Threefires', 'Otter Landing',
  'The Standing Stones', 'Birchwater', 'The Winter Camp', 'Nine Nets', 'Elkford',
];

// --- Standing ---

export interface Standing {
  /** Lowest standing this band covers, -100..100. */
  from: number;
  id: 'sworn' | 'friendly' | 'wary' | 'cold' | 'hostile';
  label: string;
  line: string;
}

/** Read worst-first; take the last one cleared. */
export const STANDINGS: Standing[] = [
  { from: -100, id: 'hostile', label: 'Hostile', line: 'They have people who will not say your name.' },
  { from: -35, id: 'cold', label: 'Cold', line: 'They would not spit on you if you were burning.' },
  { from: -10, id: 'wary', label: 'Wary', line: 'They watch the ridge when you come.' },
  { from: 25, id: 'friendly', label: 'Friendly', line: 'They will deal, and they will deal fairly.' },
  { from: 60, id: 'sworn', label: 'Sworn', line: 'There are oaths between you now.' },
];

export function standingFor(value: number): Standing {
  let found = STANDINGS[0]!;
  for (const band of STANDINGS) if (value >= band.from) found = band;
  return found;
}

// --- What treatment is worth ---

/** Falling on somebody's hall. They do not forget it. */
export const REP_RAIDED = -45;
/** An honest bargain, every time you make one. */
export const REP_TRADED = 9;
/** Tribute paid. */
export const REP_TRIBUTE = 22;
/** Tribute refused to their face. */
export const REP_REFUSED = -18;
/** Standing drifts back toward nothing at this much a day. */
export const REP_DRIFT = 0.12;

/** Nobody will barter with you below this. */
export const TRADE_FLOOR = -35;

/** Food a trading party offers in one bargain. */
export const BARTER_FOOD = 8;

/** Tribute demanded, in food. */
export const TRIBUTE_FOOD = 14;

/** How many neighbours a coast holds. */
export const CLAN_COUNT = 4;

/** No neighbour is placed closer to the landing than this. */
export const CLAN_MIN_GAP = 6;

/**
 * Nor further away than this.
 *
 * There was no ceiling until the long-game harness went looking for the
 * reason no saga in forty ever made a friend. The answer was placement: the
 * only rule was "at least six from the landing", so on a 1872-tile landmass
 * the four of them scattered anywhere at all — measured at 6, 12, 26 and 27
 * hexes from one steading, and 23, 24, 25 and 38 from another. A band sees
 * two to seven percent of that map in a whole five-hundred-day saga. So the
 * coast the guide describes, the standing they remember, the tribute, the
 * barter and the friend a jarldom needs were all real code nobody could
 * reach.
 *
 * Thirteen is a walk of about a week each way, which is what "neighbour"
 * has to mean if the word is to do any work.
 */
export const CLAN_MAX_GAP = 13;

/**
 * Days between one neighbour and the next coming to look at a new steading.
 *
 * The other half of the same fix. Finding people by walking onto their exact
 * hex is a search problem the player has no tools for; being FOUND is how it
 * actually goes. Posts in the ground are news, and news travels — so within
 * the first year each of them sends somebody up the strand to see who has
 * moved in, which puts them on the map and makes the whole coast playable
 * from the hearth.
 */
export const CLAN_CALLS_EVERY = 15;

/**
 * How much room a neighbour keeps around their own camp. Founding inside it
 * is refused: the coast is walkable now, which means some of them sit close
 * to the landing, and a steading raised in a native camp's home field is not
 * a neighbour at all.
 *
 * Two rather than three, and the difference was measured rather than felt.
 * Over two hundred landings, the number with NO foundable ground inside
 * fourteen hexes was two at an elbow of nought, two at one, two at two —
 * and three at three. Three starts taking the last site on somebody's coast
 * away, and a rule that can leave a band with nowhere to put the posts is
 * worse than a hall built a little too close to a camp.
 */
export const CLAN_ELBOW = 2;

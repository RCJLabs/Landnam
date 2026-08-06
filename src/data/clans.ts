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
}

export const CLAN_KINDS: ClanKindDef[] = [
  {
    id: 'clan',
    noun: 'steading',
    // Another Norse hall on the same coast is a rival before it is anything.
    opening: -10,
    strength: 1.15,
  },
  {
    id: 'native',
    noun: 'camp',
    // The people already here have no quarrel until you give them one.
    opening: 10,
    strength: 0.9,
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

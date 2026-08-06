// What the band has worked out. Pure data.
//
// Deliberately NOT a tech tree. There is no screen where you spend anything
// on any of this: every entry is learned because something happened — you
// stood in front of a carved boulder, you finished a dock, you held a raid,
// somebody got ill and somebody else knew what to do about it. The discovery
// is the reward; the number underneath it is what stops the reward being a
// badge.
//
// Each lore moves exactly ONE existing formula (two, where the two are the
// same idea). That is the rule that keeps this from becoming a stat soup:
// if you cannot say in one line what knowing it changes, it does not go in.

export type LoreId =
  | 'runes'
  | 'shipwright'
  | 'smithing'
  | 'skywatch'
  | 'leechcraft'
  | 'shieldcraft';

/** The knobs a lore may turn. Consumers read these through sim/lore.ts. */
export interface LoreDef {
  id: LoreId;
  name: string;
  /** What it is, in the band's own terms. */
  blurb: string;
  /** What knowing it buys, said plainly. Shown on the roster. */
  gain: string;

  /** Added to the stat behind every event card's check. */
  check?: number;
  /** Softens the morale drag of each death, 0..1. */
  solace?: number;
  /** Effort knocked off a hex of coastal water. */
  sea?: number;
  /** Added to the damage of a landed blow. */
  bite?: number;
  /** Firewood a night's fire no longer needs. */
  warmth?: number;
  /** Extra days of mending an injury gets per day. */
  mend?: number;
  /** Eases the roll against a cold night's sickness. */
  physic?: number;
  /** Added to what a shield wall is worth. */
  wall?: number;
}

export const LORE: LoreDef[] = [
  {
    id: 'runes',
    name: 'Rune-craft',
    blurb: 'Marks cut in stone that hold a thing said. What is written down stops being one man\'s word against another\'s.',
    gain: 'Every reckoning goes a little better, and the dead can be named in stone.',
    check: 1,
    solace: 0.4,
  },
  {
    id: 'shipwright',
    name: "Shipwright's eye",
    blurb: 'How a hull is meant to sit, where she takes water, and what to do about both before you are out in it.',
    gain: 'A day on the water costs less than it did.',
    sea: 1,
  },
  {
    id: 'smithing',
    name: 'Iron-craft',
    blurb: 'Bog ore, a bank of charcoal, and enough patience to get the colour right. Edges that hold, and edges that do not fold on bone.',
    gain: 'Every blow that lands bites deeper.',
    bite: 1,
  },
  {
    id: 'skywatch',
    name: 'Reading the sky',
    blurb: 'Which cloud means a hard night and which means only a wet one, and how a fire is banked so it is still there at dawn.',
    gain: 'A night needs less wood to get through.',
    warmth: 1,
  },
  {
    id: 'leechcraft',
    name: 'Leechcraft',
    blurb: 'Yarrow, birch bark, a clean cloth and the sense to keep a sick body warm rather than busy.',
    gain: 'Hurts mend faster, and a cold night is less likely to put somebody down.',
    mend: 1,
    physic: 2,
  },
  {
    id: 'shieldcraft',
    name: 'Wall-drill',
    blurb: 'Not courage — spacing. Where the rim of your shield goes, whose foot moves first, and why the line dies when one man steps forward.',
    gain: 'A shield wall is worth more than it was.',
    wall: 1,
  },
];

export function loreById(id: string): LoreDef | undefined {
  return LORE.find((l) => l.id === id);
}

/** Every knob a LoreDef can carry, for summing. */
export type LoreKnob = 'check' | 'solace' | 'sea' | 'bite' | 'warmth' | 'mend' | 'physic' | 'wall';

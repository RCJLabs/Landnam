// What a steading can raise. Pure data — sim/colony.ts spends the builders'
// work on these, so adding a building never touches engine code.
//
// Every building answers ONE scarcity. That is deliberate: the build order is
// meant to fall out of what is hurting you rather than out of a wiki. A band
// that is cold wants the longhouse, a band that is hungry wants farm plots,
// and a band that keeps being raided wants the palisade — and none of those
// is the right first answer for all three.

import type { Measure } from './sites';
import type { JobId } from './jobs';

export type BuildingId =
  | 'longhouse'
  | 'bud'
  | 'smokehouse'
  | 'farmplots'
  | 'palisade'
  | 'dock'
  | 'meadhall'
  | 'storehouse'
  | 'watchtower'
  | 'hof';

/** The need a building is the answer to. Drives the panel's suggestion. */
export type Answers = 'warmth' | 'food' | 'rest' | 'heart' | 'safety';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  blurb: string;
  answers: Answers;
  /** Firewood-equivalent timber consumed when the work begins. */
  timber: number;
  /** Builder-days of work to finish it. */
  works: number;
  /** Site measures that must be at least this to raise it at all. */
  needs?: Partial<Record<Measure, number>>;
  /** Buildings that must stand first. */
  after?: BuildingId[];
  /** Permanent shelter, cutting the firewood burn. */
  shelter?: number;
  /** Permanent bumps to the site's effective measures. */
  raises?: Partial<Record<Measure, number>>;
  /** Multiplier on every food job's output. */
  foodKeep?: number;
  /** Standing bonus to the band's heart each day. */
  heart?: number;
  /** A job this building makes possible regardless of the ground. */
  unlocks?: JobId;
  /**
   * Bodies this building gives somewhere to sleep.
   *
   * A steading holds who it has room for. Without this, taking people in
   * would be free the moment there was food, and the build queue would go on
   * being a thing you finish rather than a thing you extend.
   */
  room?: number;
  /**
   * When this can be raised AGAIN once one stands. This is what makes the
   * build queue a thing that never ends rather than a checklist: a steading
   * that keeps taking people in keeps needing roofs, forever.
   *
   * `crowded` is the honest kind and the only kind shipped: another hut is
   * offered when there is nobody to sleep in it. The unconditional version
   * was measured and withdrawn — it turned the panel's own suggestion into
   * an infinite timber sink, and a band that kept taking the advice went
   * into winter a hundred firewood short with a row of empty búðs.
   *
   * Everything a repeatable grants stacks per copy, so keep them to room
   * and shelter — a stacking foodKeep would compound into a food printer.
   */
  repeat?: 'crowded';
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'longhouse',
    name: 'Longhouse',
    blurb: 'Turf walls and a long fire. The first thing anyone builds, and the reason anyone survives the first winter.',
    answers: 'warmth',
    timber: 6,
    works: 6,
    shelter: 3,
    heart: 1,
    // Room for the six who came ashore and no more. Everything past the
    // original band has to be built for.
    room: 6,
  },
  {
    id: 'farmplots',
    name: 'Farm plots',
    blurb: 'Broken ground, walled against the beasts. Turns land that would feed you into land that does.',
    answers: 'food',
    timber: 4,
    works: 5,
    // Nothing to break on bare rock.
    needs: { soil: 1 },
    raises: { soil: 1 },
  },
  {
    id: 'smokehouse',
    name: 'Smokehouse',
    blurb: 'What the summer gives, the smoke keeps. Half of what you catch is lost without one.',
    answers: 'food',
    timber: 5,
    works: 4,
    after: ['longhouse'],
    foodKeep: 1.25,
  },
  {
    id: 'dock',
    name: 'Dock',
    blurb: 'Stone and timber out into the water. The knarr comes out of the weather and the nets go further.',
    answers: 'food',
    timber: 6,
    works: 5,
    needs: { harbour: 1 },
    raises: { harbour: 1 },
    unlocks: 'fisher',
  },
  {
    id: 'palisade',
    name: 'Palisade',
    blurb: 'Split trunks, sharpened, sunk deep. It does not stop them. It slows them where you want them slowed.',
    answers: 'safety',
    timber: 8,
    works: 7,
    needs: { timber: 1 },
    raises: { defence: 2 },
  },
  {
    id: 'bud',
    name: 'Búð',
    blurb: 'Turf walls and a low roof, thrown up against the longhouse. Nobody wants to sleep in it and people do. There is always room for another.',
    answers: 'rest',
    timber: 5,
    works: 4,
    after: ['longhouse'],
    room: 4,
    shelter: 1,
    repeat: 'crowded',
  },
  {
    id: 'meadhall',
    name: 'Mead hall',
    blurb: 'Somewhere to drink and boast and settle things without knives. Worth more than it looks on a ledger.',
    answers: 'heart',
    timber: 7,
    works: 8,
    after: ['longhouse'],
    // People sleep in the hall. They always did.
    room: 3,
    shelter: 1,
    heart: 3,
  },
  // --- The late tier: what a steading that has beaten winter builds next ---
  {
    id: 'storehouse',
    name: 'Storehouse',
    blurb: 'Raised on posts against the rats and the damp. What the smoke keeps, the loft keeps longer.',
    answers: 'food',
    timber: 5,
    works: 5,
    after: ['smokehouse'],
    foodKeep: 1.15,
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    blurb: 'A platform above the stakes and a pair of sharp eyes on it. Trouble seen far off is trouble met dressed.',
    answers: 'safety',
    timber: 5,
    works: 5,
    after: ['palisade'],
    raises: { defence: 1 },
  },
  {
    id: 'hof',
    name: 'Hof',
    blurb: 'A god-house under the trees. What is owed gets paid, and the paying settles people.',
    answers: 'heart',
    timber: 7,
    works: 7,
    after: ['meadhall'],
    heart: 2,
  },
];

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** Which building answers a given need, best first. */
export function answersFor(need: Answers): BuildingDef[] {
  return BUILDINGS.filter((b) => b.answers === need);
}

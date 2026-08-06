// The single data model. Every mode reads and writes these same objects —
// a Person is a party token in TRAVEL, a unit in BATTLE, a worker in COLONY.
// Everything here must be JSON-serializable: no Maps, Sets, or class instances.

import type { Hex, HexKey } from '../hex';

export type Mode = 'TRAVEL' | 'BATTLE' | 'COLONY';

export type Season = 'summer' | 'autumn' | 'winter' | 'spring';

export type Terrain =
  | 'ocean'
  | 'shore'
  | 'meadow'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'bog'
  | 'valley';

export type Visibility = 'unseen' | 'seen' | 'visible';

export interface Tile {
  terrain: Terrain;
  /** A river runs through this hex — fresh water, harder to cross. */
  river: boolean;
  /** Landmark id from data/landmarks, if any. */
  landmark?: string;
  /** True once the party has fully explored it (landmark consumed). */
  explored?: boolean;
}

export interface World {
  width: number;
  height: number;
  tiles: Record<HexKey, Tile>;
  /** Fog of war, keyed like tiles. Absent means 'unseen'. */
  seen: Record<HexKey, Visibility>;
  /** Where the knarr made landfall — the run's anchor point. */
  landing: Hex;
}

// --- People ---

/**
 * Four core stats, each roughly 1..6.
 * might  — arms, hauling, raw strength
 * wits   — tracking, foraging, noticing
 * spirit — nerve, morale, endurance of hardship
 * craft  — building, mending, healing
 */
export interface Stats {
  might: number;
  wits: number;
  spirit: number;
  craft: number;
}

export interface Injury {
  id: string;
  label: string;
  /** Stat penalties, negative numbers. */
  effect: Partial<Stats>;
  /** Days remaining before it mends. */
  heals: number;
}

export interface Person {
  id: string;
  name: string;
  /** Byname, e.g. "the Quiet". Norse flavor, always present. */
  byname: string;
  age: number;
  stats: Stats;
  /** Trait id from data/traits. */
  trait: string;
  health: number;
  maxHealth: number;
  /** Personal morale 0..100, distinct from the warband's. */
  morale: number;
  injuries: Injury[];
  /** Earned by fighting. Enough of it and a stat goes up for good. */
  xp: number;
  alive: boolean;
  /** Cause of death, for the saga. */
  fate?: string;
  /** The day they died, so the saga can say when. */
  diedOn?: number;
}

// --- The warband ---

export interface Party {
  at: Hex;
  people: Person[];
  food: number;
  firewood: number;
  /** Warband cohesion 0..100. Collapses into desertion and mutiny. */
  morale: number;
  /** Movement/effort spent today; a day ends when it runs out. */
  hasCamped: boolean;
}

// --- Narrative ---

export type SagaTone = 'plain' | 'good' | 'grim' | 'saga';

export interface SagaEntry {
  day: number;
  text: string;
  tone: SagaTone;
}

// --- Events ---

export interface ActiveEvent {
  /** Event id from data/events. */
  id: string;
  title: string;
  body: string;
  choices: { label: string; hint?: string }[];
  /** Set once a choice resolves; the card then shows an outcome + Continue. */
  outcome?: { text: string; good: boolean };
}

// --- Battle ---

/**
 * Battlefield ground. Deliberately coarse for 2.1: cover and elevation
 * arrive with the shield wall in 2.3.
 */
export type Ground = 'open' | 'rough' | 'block' | 'water';

export interface BattleTile {
  ground: Ground;
}

export type Side = 'warband' | 'foe';

/**
 * Per-battle state for one fighter. Deliberately holds NO stats, name, or
 * health — those live on the Person this points at, because a person is one
 * object in every mode. Look them up with `fighterPerson`.
 */
export interface Combatant {
  personId: string;
  side: Side;
  at: Hex;
  initiative: number;
  /** Movement left this turn. */
  movesLeft: number;
  /** The one action per turn has been spent. */
  hasActed: boolean;
  /** Spears and hand-axes: thrown once and gone. */
  throwsLeft: number;
  /** Shield up — harder to hit until this fighter's next turn. */
  defending: boolean;
  /** Foes this fighter put down this battle. Feeds the xp they earn. */
  kills: number;
  /** Nerve, 0..100. At zero it breaks. Battle-local; see morale.ts. */
  nerve: number;
  /** Nerve gone: will not fight, runs for its own edge, may rally. */
  broken: boolean;
  /** Ran off the field. Out of the fight, alive. */
  fled: boolean;
  /** Dropped: out of this fight, but not necessarily dead (see 2.4). */
  down: boolean;
}

export type BattleOutcome = 'won' | 'lost';

/**
 * What a settled fight left behind. Lives on the root state rather than on the
 * battle, because the battle is gone by the time the player reads it — and it
 * must survive a save, or reloading would skip the reckoning.
 */
export interface Aftermath {
  killed: string[];
  maimed: string[];
  ran: string[];
  foesDown: number;
  food: number;
  firewood: number;
  won: boolean;
}

export interface Battle {
  /** The overworld terrain this ground was generated from. */
  terrain: Terrain;
  width: number;
  height: number;
  grid: Record<HexKey, BattleTile>;
  /** Enemies are People too — same model, same renderer treatment. */
  foes: Person[];
  combatants: Combatant[];
  /** personIds, highest initiative first. */
  order: string[];
  /** Index into `order` of whoever is acting. */
  turnIndex: number;
  round: number;
  log: string[];
  outcome?: BattleOutcome;
}

// --- The land-taking ---

/**
 * How good a hex is to settle, each measure 0..5. Derived from the ground and
 * its neighbours, so it is recomputable — but it is stored on the settlement
 * anyway, because the reading you settled on is part of the record.
 */
export interface SiteReport {
  water: number;
  soil: number;
  timber: number;
  harbour: number;
  defence: number;
  /** Sum of the five, 0..25. */
  total: number;
}

export interface Settlement {
  at: Hex;
  name: string;
  /** The day the posts went in. There is only ever one. */
  foundedOn: number;
  report: SiteReport;
}

// --- Run end ---

export interface RunEnd {
  cause: 'starved' | 'frozen' | 'slain' | 'despair' | 'survived';
  title: string;
  lines: string[];
}

// --- Root ---

export interface GameState {
  version: number;
  seed: string;
  /** 1-based. Day 1 is high summer; winter bites on day 49. */
  day: number;
  /** Mode stack; the last entry is active. Never empty. */
  modes: Mode[];
  world: World;
  party: Party;
  saga: SagaEntry[];
  /** Arbitrary counters events can read and write. */
  flags: Record<string, number>;
  event?: ActiveEvent;
  /** Present only while the BATTLE mode is on the stack. */
  battle?: Battle;
  /** The reckoning from the last fight, until the player has read it. */
  aftermath?: Aftermath;
  /** Where the land was taken. Set once, never moved, never unset. */
  settlement?: Settlement;
  end?: RunEnd;
  /** Monotonic counter making generated ids deterministic. */
  nextId: number;
}

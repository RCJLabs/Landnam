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
  alive: boolean;
  /** Cause of death, for the saga. */
  fate?: string;
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
  end?: RunEnd;
  /** Monotonic counter making generated ids deterministic. */
  nextId: number;
}

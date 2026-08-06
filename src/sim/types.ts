// Shared simulation types. Everything here is plain serializable data —
// no classes, no functions — so GameRun snapshots to JSON via save/codec.

import { Axial, HexKey } from '../core/hex';

// --- Meta (persists across runs, forever) ---

export interface MetaProfile {
  version: number;
  fame: number;
  unlocks: string[];
  runsPlayed: number;
  bestDistanceWest: number;
  victories: number;
}

// --- Strategic map ---

export type Terrain = 'deepSea' | 'sea' | 'coast' | 'land' | 'ice';

export type Region =
  | 'norway'
  | 'shetland'
  | 'faroes'
  | 'iceland'
  | 'greenland'
  | 'vinland'
  | 'openSea';

export type FeatureKind = 'home' | 'port' | 'monastery' | 'village' | 'mythic' | 'wreck';

export interface TileFeature {
  kind: FeatureKind;
  id: string;
  name: string;
  used: boolean;
}

export interface ChartTile {
  terrain: Terrain;
  region: Region;
  dangerTier: 0 | 1 | 2 | 3;
  feature?: TileFeature;
}

export interface HexChart {
  width: number;
  height: number;
  tiles: Record<HexKey, ChartTile>;
  /** Serialized as array; hydrated to Set by codec. */
  discovered: Set<HexKey>;
  shipAt: Axial;
  startAt: Axial;
  vinlandAt: Axial;
}

// --- Crew & ship ---

export interface Injury {
  id: string;
  label: string;
  might?: number; // stat penalties (negative numbers)
  skill?: number;
  guts?: number;
  sea?: number;
  healTurns: number;
}

export interface CrewMember {
  id: string;
  name: string;
  epithet?: string;
  isCaptain: boolean;
  female: boolean;
  might: number; // 1..6
  skill: number;
  guts: number;
  sea: number;
  traits: string[];
  weapon?: string;
  armor?: string;
  hp: number;
  hpMax: number;
  injuries: Injury[];
  fatigue: number;
  morale: number;
  alive: boolean;
}

export interface Ship {
  name: string;
  hull: number;
  hullMax: number;
  cargoMax: number;
  upgrades: string[];
}

// --- Weather ---

export interface Weather {
  /** Prevailing wind direction the wind blows FROM (0..5, hex.DIRS index). */
  windFrom: number;
  windStrength: 0 | 1 | 2 | 3;
  /** Storm centers; each drifts 1 hex per turn and threatens radius 1. */
  storms: Axial[];
}

// --- Events (engine lands in P2; the types are here so tiles can carry them) ---

export interface ActiveEvent {
  eventId: string;
  /** Snapshot of resolved text/options at fire time. */
  title: string;
  text: string;
  options: { label: string; detail?: string; disabled?: boolean }[];
}

// --- Run ---

export type Phase = 'voyage' | 'event' | 'port' | 'battle' | 'ended';

export interface LogEntry {
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'saga';
}

export interface RunEnd {
  outcome: 'victory' | 'starved' | 'sunk' | 'slain' | 'mutiny' | 'abandoned';
  fame: number;
  summary: string[];
}

export interface GameRun {
  version: number;
  seed: string;
  turn: number;
  phase: Phase;
  chart: HexChart;
  ship: Ship;
  crew: CrewMember[];
  food: number;
  water: number;
  silver: number;
  timber: number;
  moraleShip: number;
  weather: Weather;
  flags: Record<string, number>;
  activeEvent?: ActiveEvent;
  log: LogEntry[];
  idCounter: number;
  end?: RunEnd;
}

// --- Intents & events (the reducer contract) ---

export type StrategicIntent =
  | { type: 'SAIL'; to: Axial }
  | { type: 'WAIT' }
  | { type: 'REPAIR' }
  | { type: 'ABANDON_RUN' };

export type SimEvent =
  | { type: 'MOVED'; from: Axial; to: Axial }
  | { type: 'SUPPLIES_CONSUMED'; food: number; water: number }
  | { type: 'STARVING' }
  | { type: 'STORM_HIT'; at: Axial; hullDamage: number }
  | { type: 'HULL_REPAIRED'; amount: number }
  | { type: 'DISCOVERED_FEATURE'; at: Axial; kind: string; name: string }
  | { type: 'CREW_DIED'; crewId: string; name: string; cause: string }
  | { type: 'RUN_ENDED'; end: RunEnd }
  | { type: 'LOG'; entry: LogEntry };

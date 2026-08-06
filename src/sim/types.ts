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

// --- Events ---

export type Cond =
  | { c: 'region'; is: Region[] }
  | { c: 'dangerMin'; tier: number }
  | { c: 'turnMin'; turn: number }
  | { c: 'moraleMax'; value: number }
  | { c: 'flagUnset'; flag: string }
  | { c: 'flagMin'; flag: string; value: number }
  | { c: 'onFeature'; kind: FeatureKind };

export type Effect =
  | { t: 'res'; food?: number; water?: number; silver?: number; timber?: number; hull?: number }
  | { t: 'morale'; amount: number }
  | { t: 'hurtRandom'; amount: number; count?: number }
  | { t: 'healAll'; amount: number }
  | { t: 'killWeakest' }
  | { t: 'recruitCastaway' }
  | { t: 'setFlag'; flag: string; value: number }
  | { t: 'fame'; amount: number }
  | { t: 'markUsed' }
  | { t: 'startBattle'; raidId: string };

export interface StatCheck {
  stat: 'might' | 'skill' | 'guts' | 'sea';
  who: 'captain' | 'best' | 'crewAvg';
  dc: number; // 2d6 + stat >= dc
}

export interface EventOption {
  label: string;
  check?: StatCheck;
  success: { text: string; effects: Effect[] };
  failure?: { text: string; effects: Effect[] };
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  weight: number;
  once?: boolean;
  conditions?: Cond[];
  options: EventOption[];
}

export interface ActiveEvent {
  eventId: string;
  title: string;
  text: string;
  options: { label: string; detail?: string }[];
  /** Set after the player picks: the outcome text awaiting a Continue. */
  outcome?: { text: string; success: boolean };
}

// --- Ports ---

export interface PortStock {
  foodPrice: number;
  waterPrice: number;
  timberPrice: number;
  repairPricePerHull: number;
  recruits: CrewMember[];
}

export interface ActivePort {
  featureId: string;
  name: string;
  isHome: boolean;
  stock: PortStock;
}

// --- Tactical battles ---

export type BattleTerrain = 'grass' | 'sand' | 'floor' | 'deck' | 'water' | 'wall' | 'rock';

export interface BattleTile {
  terrain: BattleTerrain;
  /** Cover bonus to def for the occupant. */
  cover: 0 | 1;
}

export type UnitStatus = 'routing' | 'braced';

export interface Unit {
  id: string;
  /** Link back to the CrewMember for player units. */
  crewId?: string;
  side: 'player' | 'enemy';
  kind: string; // 'crew' or an enemy archetype id
  name: string;
  at: Axial;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  guts: number;
  move: number;
  damage: number;
  /** Leaders can Rally; their death costs extra side morale. */
  isLeader: boolean;
  fatigue: number;
  statuses: UnitStatus[];
  /** Hexes of movement left this round. */
  movesLeft: number;
  hasActed: boolean;
  alive: boolean;
  /** Fled off the battlefield edge. */
  escaped: boolean;
}

export interface Battle {
  raidId: string;
  title: string;
  width: number;
  height: number;
  grid: Record<HexKey, BattleTile>;
  units: Unit[];
  round: number;
  /** Monotonic action counter — keys the per-action RNG stream. */
  actionN: number;
  sideMorale: { player: number; enemy: number };
  lootText: string;
  loot: Effect[];
  result?: 'won' | 'lost';
}

export type TacticalIntent =
  | { type: 'T_MOVE'; unitId: string; to: Axial }
  | { type: 'T_STRIKE'; unitId: string; targetId: string }
  | { type: 'T_PUSH'; unitId: string; targetId: string }
  | { type: 'T_RALLY'; unitId: string }
  | { type: 'T_BRACE'; unitId: string }
  | { type: 'T_END_TURN' }
  | { type: 'BATTLE_CONTINUE' };

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
  activePort?: ActivePort;
  activeBattle?: Battle;
  log: LogEntry[];
  idCounter: number;
  end?: RunEnd;
}

// --- Intents & events (the reducer contract) ---

export type StrategicIntent =
  | { type: 'SAIL'; to: Axial }
  | { type: 'WAIT' }
  | { type: 'REPAIR' }
  | { type: 'ABANDON_RUN' }
  | { type: 'CHOOSE_OPTION'; index: number }
  | { type: 'EVENT_CONTINUE' }
  | { type: 'DOCK' }
  | { type: 'PORT_BUY'; item: 'food' | 'water' | 'timber'; qty: number }
  | { type: 'PORT_REPAIR' }
  | { type: 'PORT_RECRUIT'; recruitId: string }
  | { type: 'PORT_LEAVE' };

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

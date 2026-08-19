// The single data model. Every mode reads and writes these same objects —
// a Person is a party token in TRAVEL, a unit in BATTLE, a worker in COLONY.
// Everything here must be JSON-serializable: no Maps, Sets, or class instances.

import type { Hex, HexKey } from '../hex';
import type { HardshipId } from '../data/hardship';
// Types only, and the arrow points back here for Battle — which TypeScript is
// happy with and which keeps the beat vocabulary next to the code that emits
// it rather than buried in the model.
import type { Beat, WorldBeat } from '../sim/beats';
import type { Mark } from '../sim/challenge';

export type { HardshipId };

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
  /** What the landing was called, so the map can label it. */
  landingName: string;
  /** Hexes the party has actually stood on, keyed to the day they first did. */
  trod: Record<HexKey, number>;
  /** Fixed points worth walking to — and some worth taking. See data/places. */
  places: Place[];
}

/**
 * A destination seeded at worldgen: somewhere on the map that is somewhere,
 * not just terrain. The rich ones are what "go out under arms" is FOR.
 */
export interface Place {
  id: string;
  kind: 'monastery' | 'town' | 'wreck' | 'oreseam' | 'ruin';
  at: Hex;
  /** Set the day it was sacked or picked clean. A place is taken once. */
  sackedOn?: number;
}

/** A band that came before, and where it ended. */
export interface Ghost {
  /** What they called their steading. */
  name: string;
  /** Where the posts went in. */
  at: Hex;
  /** The day it ended. */
  day: number;
  /** How it ended — a `RunEnd` cause. */
  cause: string;
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
  /** What they spend their days on once there is a steading. Absent = idle. */
  job?: string;
  /**
   * What this person is to the band.
   *
   * `sworn` are the ones who bear arms — capped at SWORN_MAX, because a
   * shield wall is only as wide as the people who have stood in one, and an
   * unbounded warband would make every fight a matter of turning up with more
   * bodies. `hand` covers everyone else the steading takes in: they work,
   * they eat, they can be killed, and they can walk away. They never see a
   * battlefield.
   */
  bond: 'sworn' | 'hand';
  /** The day they joined. Absent for the six who came off the knarr. */
  joinedOn?: number;
  /**
   * Somebody in this band they are bound to, and what they call them.
   * Symmetric: both people carry the other's id, each with their own word
   * for the tie. See sim/kin.ts — grief is what this is for.
   */
  kin?: { id: string; tie: string };
  alive: boolean;
  /** Cause of death, for the saga. */
  fate?: string;
  /** The day they died, so the saga can say when. */
  diedOn?: number;
  /**
   * They walked out rather than died.
   *
   * Still `alive: false`, because every mouth-and-fire calculation in the
   * game counts the living and somebody who has gone is not eating here any
   * more. But a memorial that lists them among the killed is telling a lie
   * about what happened, and the saga should not mourn a man who is fine.
   */
  left?: boolean;
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

// --- The knarr ---

/**
 * The ship the band came in, and the one they leave in.
 *
 * She was `party.hullHoled` — one bit — until the ship work. She is not part
 * of the Party because she is not a person and does not walk: the band can be
 * inland for a season while she sits on the beach.
 */
export interface Ship {
  /** Hers, and it does not change. */
  name: string;
  /** Sound strakes remaining, 0..SHIP_STRAKES. Nothing left is unseaworthy. */
  strakes: number;
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
  /** Event id from data/events, or 'feud' for a quarrel between two people. */
  id: string;
  title: string;
  body: string;
  choices: { label: string; hint?: string }[];
  /** Set once a choice resolves; the card then shows an outcome + Continue. */
  outcome?: { text: string; good: boolean };
  /** Present on a feud card: whose quarrel this is. */
  feud?: { a: string; b: string };
}

// --- Minds ---

/**
 * Bad blood between two named people. Stored rather than derived, because it
 * is a history: it is exactly the thing that should not quietly reset when
 * circumstances improve.
 */
export interface Grudge {
  a: string;
  b: string;
  /** How bad it has got. Past FEUD_THRESHOLD it demands answering. */
  weight: number;
  /** The line that started it, already named. */
  cause: string;
  /** The day it started. */
  since: number;
  /** Set once a Thing or a wergild has settled it; it will not fire again. */
  settled?: boolean;
  /**
   * Set when the band was asked and walked away. A quarrel that was refused
   * in front of everyone does not quietly fade the way one nobody named does.
   */
  hardened?: boolean;
}

// --- Battle ---

/**
 * Battlefield ground. Deliberately coarse for 2.1: cover and elevation
 * arrive with the shield wall in 2.3.
 */
export type Ground = 'open' | 'rough' | 'block' | 'water' | 'wall';

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
  /** True when this is a raid on the steading: your ground, your buildings. */
  raid?: boolean;
  /** Set when the fight is FOR a place — winning it is what sacks it. */
  placeId?: string;
  /**
   * The band came out of the water at them rather than up the road. They
   * are a man light and badly shaken; the take is bigger and so is the
   * price of losing. See sim/sea.ts.
   */
  strandhogg?: boolean;
  /** Set when the band fell on a neighbour — winning is what empties them. */
  campId?: string;
  /** The leader's war-cry has been spent. Once a fight, and it shows. */
  warCried?: boolean;
  /**
   * personId of the foe who LEADS this band, when somebody does: every raid
   * has one, and the open field grows one once word has spread. Boosted,
   * grimly bynamed, and worth killing — when he drops, the heart goes out
   * of the men he led.
   */
  champion?: string;
  /** Which neighbour's man he is, when he belongs to one and can come back. */
  championOf?: string;
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
  /**
   * The same fight as data: an ordered list of what happened, actors named by
   * personId and ground given as hexes. `log` is prose for the web build to
   * print; this is for anything that has to ANIMATE the fight. See sim/beats.
   * Optional because a save written before Phase 7 has none.
   */
  beats?: Beat[];
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

/** One hex of the steading's own ground, in COLONY mode. */
export interface Plot {
  at: Hex;
  kind: 'hall' | 'field' | 'wood' | 'water' | 'rough' | 'watchpost';
}

export interface Settlement {
  at: Hex;
  name: string;
  /** The day the posts went in. There is only ever one. */
  foundedOn: number;
  report: SiteReport;
  /** The local map, generated once from the report. */
  plots: Plot[];
  /**
   * Walls and roofs raised so far. Since 3.3 this is granted by buildings
   * rather than accrued directly, so it only moves when something is finished.
   */
  shelter: number;
  /** How well the watch is kept, 0..WATCH_MAX. Decays if nobody stands it. */
  watch: number;
  /** Building ids standing, in the order they were finished. */
  built: string[];
  /** Building ids waiting, head first. Builders work the head. */
  queue: string[];
  /** Builder-days banked against the head of the queue. */
  works: number;
  /**
   * Everyone born here.
   *
   * NOT `Person`s, and that is the load-bearing decision. A Person is
   * counted by `living`, handed a job, put in the shield wall and offered
   * the chance to walk out — so a child modelled as one would be a baby in
   * the line, which is a bug wearing a design. They are a record on the
   * ground they were born on: a mouth, a name, and a line for the saga.
   */
  children: Child[];
}

/** Somebody born on this coast. See `data/lineage.ts` for why they never grow. */
export interface Child {
  name: string;
  bornOn: number;
  /** Person id of the mother, and of the father when there was a kin tie. */
  mother: string;
  father?: string;
}

// --- Expeditions ---

export type Purpose = 'raid' | 'trade' | 'explore';

/**
 * A party sent out from the steading. Once there is a settlement this is the
 * only thing that moves on the world map — the rest of the band is at home
 * working, which is the whole trade-off.
 */
export interface Expedition {
  /** personIds. Everyone else is the home crew. */
  members: string[];
  purpose: Purpose;
  launchedOn: number;
  /** Provisions taken from the store. Eaten first, and the rest comes home. */
  carried: number;
  /** Set when they turn for home; the map then only offers the way back. */
  returning?: boolean;
}

// --- Neighbours ---

/**
 * Somebody else's place on the same coast. Standing is stored rather than
 * derived because it is a memory: it is exactly the thing that must not reset
 * when you stop raiding them.
 */
/**
 * A foe who has led men against us and walked off the field alive.
 *
 * Kept on the NEIGHBOUR rather than on the battle, because that is the thing
 * that outlives a fight. He comes back with the same name, the same byname,
 * and one more scar than last time — which is the whole point: an enemy the
 * saga can name twice is worth more than a hundred anonymous huscarls.
 */
export interface Champion {
  name: string;
  byname: string;
  /** Fields he has walked off alive. Each one makes him worse to meet. */
  scars: number;
  /** The day he was last seen, so the log can say how long it has been. */
  lastSeen: number;
}

export interface Neighbour {
  id: string;
  /** Clan kind id from data/clans. */
  kind: string;
  name: string;
  at: Hex;
  /** What they think of you, -100..100. */
  standing: number;
  /** How much they can field, roughly 0..3. Feeds a fight's difficulty. */
  might: number;
  /** True once somebody has laid eyes on the place. */
  found?: boolean;
  /** The day of the last dealing, so the saga can say "again". */
  lastDealt?: number;
  /** Raids traced back to them. */
  raidsSent: number;
  /**
   * The last day their camp was emptied, if it ever was. Their stores grow
   * back over CAMP_REGROW days — see sim/plunder.ts.
   */
  sackedOn?: number;
  /** Their man, if he is still alive and still coming. */
  champion?: Champion;
}

// --- The tally ---

/**
 * What the band did, counted as it happened. Everything here is something a
 * finished run cannot reconstruct from its own state — a settled battle
 * leaves no trace of itself, and a bargain leaves only firewood.
 */
export interface Tally {
  battles: number;
  battlesWon: number;
  /** Raids that came at the steading. */
  raids: number;
  /** Raids the line held. */
  raidsHeld: number;
  foesFelled: number;
  expeditions: number;
  bargains: number;
  /** Neighbours we fell on. */
  sackings: number;
  /** Days spent on the water. */
  seaDays: number;
}

// --- Run end ---

export interface RunEnd {
  cause: 'starved' | 'frozen' | 'slain' | 'despair' | 'survived' | 'jarl';
  title: string;
  lines: string[];
}

/**
 * The rule, once the Thing has carried it.
 *
 * Being proclaimed does not end the run any more — it changes what the run
 * IS. The saga closes when the player says it closes, and every winter held
 * after the proclamation is a winter a jarl held, against a coast that is
 * now certain who lives here.
 */
export interface Jarldom {
  /** Who the Thing named. The saga remembers them by it. */
  name: string;
  /** The day it carried. */
  since: number;
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
  /** The knarr. Always present — the band arrived in her. */
  ship: Ship;
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
  /** Bad blood, by pair. Empty on a band that is getting along. */
  grudges: Grudge[];
  /** A party out from the steading. Absent means everyone is home. */
  expedition?: Expedition;
  /** Everybody else on this coast, and what they think of you. */
  neighbours: Neighbour[];
  /** Lore ids the band has worked out, in the order it worked them out. */
  lore: string[];
  /** What the band did, for the saga to read back. */
  tally: Tally;
  end?: RunEnd;
  /**
   * How hard this country is. Chosen when the keel touches sand and kept
   * ON THE RUN rather than in preferences, so a saga carries the terms it
   * was played under and a shared seed means the same thing to two people.
   * Absent reads as 'even', which is what every save before this was.
   */
  hardship?: HardshipId;
  /**
   * The mark this run was started to beat, when it came off somebody else's
   * challenge code. On the RUN rather than in preferences for the same
   * reason `hardship` is: it is a term of this saga, and it has to survive
   * the tab being closed on day 12 of a chase.
   */
  chasing?: Mark;
  /**
   * Somebody else's steading, standing in ruins on this coast.
   *
   * Carried in on a challenge code. The whole of the asynchronous-multiplayer
   * idea and the whole of what it costs: no server, no network, no account —
   * a line of text somebody pasted into a chat, and the ground it names.
   */
  ghost?: Ghost;
  /**
   * The run as data: the ordered events of a day, for a presentation layer
   * that has to show them happening rather than print them. The battle
   * equivalent lives on `Battle.beats` and dies with the fight; this one
   * runs for the life of the saga and is trimmed to WORLD_BEATS_MAX.
   */
  beats?: WorldBeat[];
  /** Set once the Thing has carried and the band rules the coast. */
  jarl?: Jarldom;
  /** Monotonic counter making generated ids deterministic. */
  nextId: number;
}

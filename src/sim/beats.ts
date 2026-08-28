// What happened on the field, as data rather than as prose.
//
// Phase 7 item 3. Every fight already produced a `log` of finished English
// sentences — "Ketil struck Hrafn (7)." — and a `lastBlow` slot holding
// exactly one blow so the web renderer could flash a number. Both work for
// the web build and neither survives a second presentation layer: an engine
// that wants to swing a weapon, step a model between two hexes and stagger
// the man who took it cannot get any of that out of a sentence, and a
// one-slot hook drops every blow but the newest.
//
// So the sim emits BEATS: an ordered list of the things that happened, with
// the actors named by personId and the ground given as hexes. The web build
// carries on reading `log`; anything else reads this. Nothing in here decides
// anything — a beat is a record, never an input — so emitting one can never
// change how a fight goes, and the seeded RNG is untouched by all of it.
//
// Battle first, deliberately, because that is the mode where ORDER matters:
// travel and colony can be redrawn from a state snapshot, but a fight is a
// sequence and a renderer that only sees the end of it has nothing to show.

import type { Battle, BattleOutcome, GameState, Side } from '../state/types';

/** Every kind of thing that can happen on a field. */
export type BeatKind =
  | 'opened'
  | 'moved'
  | 'struck'
  | 'reached'
  | 'threw'
  | 'shoved'
  | 'defended'
  | 'dashed'
  | 'warcry'
  | 'fell'
  | 'leaderFell'
  | 'broke'
  | 'rallied'
  | 'fled'
  | 'ended';

interface BeatBase {
  /**
   * Rises by one for every beat of this fight and never resets, so a view can
   * drain "everything since n" without holding a copy of the list. The array
   * itself is capped (see BEATS_MAX); `n` is what survives the trimming.
   */
  n: number;
  round: number;
}

/** The fight began. */
export interface OpenedBeat extends BeatBase {
  kind: 'opened';
  raid: boolean;
  ours: number;
  theirs: number;
  /** personId of the man leading them, when one does. */
  champion?: string;
}

/**
 * Somebody changed their place in the line. The only beat with no line in
 * the log.
 *
 * `from` and `to` were hexes, and a step used to cost move points. There is
 * no ground to cross since 8.1c: a fighter's place is their RANK, so this
 * says which rank they left and which they took, and the cost is gone with
 * the movement it paid for.
 */
export interface MovedBeat extends BeatBase {
  kind: 'moved';
  who: string;
  /** Rank they left. */
  from: number;
  /** Rank they took. */
  to: number;
  /** Not a manoeuvre — a broken fighter giving ground down the line. */
  flight?: true;
}

/**
 * How a blow finished.
 *
 * `turned` is its own outcome rather than a miss with a shield on it: a full
 * wall turning a blow aside is the thing the formation is FOR, and a renderer
 * that cannot tell it from a clean miss cannot show the line working.
 */
export type BlowResult = 'hit' | 'glance' | 'turned' | 'miss';

/** A blow: hand to hand, over the shoulder of the line, or thrown. */
export interface BlowBeat extends BeatBase {
  kind: 'struck' | 'reached' | 'threw';
  who: string;
  target: string;
  result: BlowResult;
  damage: number;
  /** The shield-brother a spear went past, on a `reached`. */
  screen?: string;
}

/**
 * How a shove finished. Three of these four kill nobody and the fourth kills
 * without a blow being struck, which is exactly why a shove needs its own
 * beat rather than being a strike that does no damage.
 */
export type ShoveResult = 'held' | 'pushed' | 'crushed';

/**
 * `'drowned'` stood in this list until 8.1d. A shove could put a man in the
 * water, and the sea finished him for nothing — the best thing the verb
 * did. There is no water on a line and no ground to be pushed into, so
 * `doShove` has not been able to produce it since 8.1c and it is off the
 * list rather than left as a result nothing returns.
 *
 * Worth having on the record as something the conversion COST, not just
 * something it tidied. Whether a line gets its own version of "the ground
 * itself kills him" is an open question for 8.1d's design notes.
 */

export interface ShovedBeat extends BeatBase {
  kind: 'shoved';
  who: string;
  target: string;
  result: ShoveResult;
  damage?: number;
}

/** Shield up, a run, or the leader's cry. Nobody else is involved. */
export interface SoloBeat extends BeatBase {
  kind: 'defended' | 'dashed' | 'warcry' | 'broke' | 'fled';
  who: string;
}

export interface RalliedBeat extends BeatBase {
  kind: 'rallied';
  who: string;
  /** Steady shoulder-mates who helped them find their feet. */
  steadied: number;
}

/** Somebody went down. `by` is whoever put them there, when anyone did. */
export interface FellBeat extends BeatBase {
  kind: 'fell';
  who: string;
  side: Side;
  by?: string;
}

/** The one leading that side went down, and the whole side felt it. */
export interface LeaderFellBeat extends BeatBase {
  kind: 'leaderFell';
  who: string;
  side: Side;
}

/**
 * Why it stopped. `wiped` is nobody left standing, `broke` is a side that is
 * still upright and will not fight, `dark` is the round limit.
 */
export interface EndedBeat extends BeatBase {
  kind: 'ended';
  outcome: BattleOutcome;
  why: 'wiped' | 'broke' | 'dark';
}

export type Beat =
  | OpenedBeat
  | MovedBeat
  | BlowBeat
  | ShovedBeat
  | SoloBeat
  | RalliedBeat
  | FellBeat
  | LeaderFellBeat
  | EndedBeat;

/** A beat as the caller writes it: the stamp is the emitter's business. */
type Unstamped<T> = T extends Beat ? Omit<T, 'n' | 'round'> : never;

/**
 * Beats kept on the battle at once.
 *
 * Generous — a fifty-round fight between twelve people runs a few hundred —
 * but finite, because a Battle goes into the save file and an unbounded list
 * of every step anybody took would grow the save all fight. Trimming is safe
 * precisely because `n` never resets: a consumer that has fallen more than
 * BEATS_MAX behind has already missed the animation it was waiting for.
 */
export const BEATS_MAX = 400;

/** Records a beat. Never reads the RNG, never decides anything. */
export function beat(battle: Battle, body: Unstamped<Beat>): void {
  const list = battle.beats ?? (battle.beats = []);
  const n = (list[list.length - 1]?.n ?? 0) + 1;
  list.push({ ...body, n, round: battle.round } as Beat);
  if (list.length > BEATS_MAX) list.splice(0, list.length - BEATS_MAX);
}

/**
 * Everything that has happened since `since`, and the mark to pass in next
 * time. Written to be called once a frame by a presentation layer that owns
 * nothing but its own mark — which is what makes the same stream drive the
 * web build's effects and a second engine's animation without either one
 * knowing the other exists.
 */
export function beatsSince(battle: Battle, since: number): { beats: Beat[]; mark: number } {
  const list = battle.beats ?? [];
  const beats = list.filter((b) => b.n > since);
  return { beats, mark: list[list.length - 1]?.n ?? since };
}

// --- The world outside a fight ---
//
// The battle half of this shipped first because a fight is the mode where
// ORDER matters most: it is a sequence, and a view that only sees the end of
// it has nothing to show. Travel and colony are gentler — a day can largely
// be redrawn from a snapshot — but not entirely, and the parts that cannot
// are exactly the parts a player feels. Six mouths eating the last of the
// food, the fire going out, a roof finished, somebody walking over the ridge
// to join: those happen in an order, inside a single `passDay`, and a
// renderer handed only the state afterwards knows the woodpile is smaller
// and nothing about the night.
//
// Same shape as the battle stream, one deliberate difference: a battle beat
// is stamped with its ROUND and a world beat with its DAY, because that is
// the clock each of them actually runs on.

export type WorldBeatKind =
  | 'dawn'
  | 'ate'
  | 'burned'
  | 'worked'
  | 'hurt'
  | 'died'
  | 'seasonTurned'
  | 'marched'
  | 'gathered'
  | 'founded'
  | 'built'
  | 'joined'
  | 'left'
  | 'met'
  | 'bargained'
  | 'wentOut'
  | 'cameHome'
  | 'spotted'
  | 'dealt'
  | 'sacked';

interface WorldBase {
  /** Rises for the life of the run and never resets. */
  n: number;
  day: number;
}

/** A day began. Everything below it belongs to that day. */
export interface DawnBeat extends WorldBase {
  kind: 'dawn';
  season: string;
}

/** What the mouths and the fire took. `short` is the part there was not. */
export interface UpkeepBeat extends WorldBase {
  kind: 'ate' | 'burned';
  took: number;
  needed: number;
  short: number;
}

/** What the day's labour produced. */
export interface WorkedBeat extends WorldBase {
  kind: 'worked';
  food: number;
  firewood: number;
  works: number;
}

export interface HurtBeat extends WorldBase {
  kind: 'hurt';
  who: string;
  amount: number;
  cause: string;
}

export interface DiedBeat extends WorldBase {
  kind: 'died';
  who: string;
  cause: string;
}

export interface SeasonBeat extends WorldBase {
  kind: 'seasonTurned';
  season: string;
}

/** The band crossed ground. `days` because a march is not always one. */
/**
 * A day's going.
 *
 * `from` and `to` were hexes until 8.5 and are stop indices now — the same
 * change `MovedBeat` took in 8.1c, and for the same reason: the address had
 * stopped being a coordinate long before the field carrying it did.
 */
export interface MarchedBeat extends WorldBase {
  kind: 'marched';
  from: number;
  to: number;
  days: number;
  terrain: string;
  bySea?: true;
}

/** Food taken off the land: foraged, hunted or fished. */
export interface GatheredBeat extends WorldBase {
  kind: 'gathered';
  how: 'forage' | 'hunt' | 'fish';
  got: number;
  who?: string;
}

export interface FoundedBeat extends WorldBase {
  kind: 'founded';
  /** The stretch the posts went into. */
  stop: number;
  name: string;
}

export interface BuiltBeat extends WorldBase {
  kind: 'built';
  building: string;
}

/** Somebody came, or somebody went. */
export interface FolkBeat extends WorldBase {
  kind: 'joined' | 'left';
  who: string;
  name: string;
}

export interface MetBeat extends WorldBase {
  kind: 'met';
  id: string;
  name: string;
}

export interface BargainedBeat extends WorldBase {
  kind: 'bargained';
  id: string;
  gave: number;
  got: number;
  standing: number;
}

/**
 * A party left the steading, or came back to it.
 *
 * The one thing in the settled half of the game that is genuinely a
 * MOVEMENT of people rather than a change of numbers: a renderer handed
 * only the state afterwards knows four people are elsewhere and has no
 * moment to draw. `carried` is what went out of the store with them.
 */
export interface ErrandBeat extends WorldBase {
  kind: 'wentOut' | 'cameHome';
  purpose: string;
  crew: string[];
  carried?: number;
  /** Days out, on the way home. */
  days?: number;
}

/**
 * A fixed place, and the three things that can happen to one.
 *
 * Kept apart from `met` and `bargained`, which belong to the CLANS: a camp
 * walks over to look at your steading and can be dealt with again next
 * season, where a monastery cannot move and is one-shot. The place economy
 * measured on 2026-08-13 as the part of the game a band reaches least, so a
 * presentation layer wanting to make more of it needs the moments named.
 */
export interface PlaceBeat extends WorldBase {
  kind: 'spotted' | 'dealt' | 'sacked';
  id: string;
  place: string;
  /** The stretch it stands on. */
  stop: number;
  /** What crossed the counter, on a deal. */
  gave?: number;
  got?: number;
  /** Taken from the water rather than from the road. */
  bySea?: true;
}

export type WorldBeat =
  | DawnBeat
  | UpkeepBeat
  | WorkedBeat
  | HurtBeat
  | DiedBeat
  | SeasonBeat
  | MarchedBeat
  | GatheredBeat
  | FoundedBeat
  | BuiltBeat
  | FolkBeat
  | MetBeat
  | BargainedBeat
  | ErrandBeat
  | PlaceBeat;

type UnstampedWorld<T> = T extends WorldBeat ? Omit<T, 'n' | 'day'> : never;

/**
 * World beats kept at once.
 *
 * Smaller than the battle's, and for the opposite reason: a fight is over in
 * an hour and its whole stream is worth keeping, while a run is five hundred
 * days and nobody is going to replay day 12 from a save. A live view drains
 * this every action; the cap only decides how far behind a view may fall
 * before it misses something it was never going to draw.
 */
export const WORLD_BEATS_MAX = 200;

/** Records a world beat. Reads nothing, decides nothing. */
export function worldBeat(state: GameState, body: UnstampedWorld<WorldBeat>): void {
  const list = state.beats ?? (state.beats = []);
  const n = (list[list.length - 1]?.n ?? 0) + 1;
  list.push({ ...body, n, day: state.day } as WorldBeat);
  if (list.length > WORLD_BEATS_MAX) list.splice(0, list.length - WORLD_BEATS_MAX);
}

/** Everything since `since`, and the mark to pass in next time. */
export function worldBeatsSince(
  state: GameState,
  since: number,
): { beats: WorldBeat[]; mark: number } {
  const list = state.beats ?? [];
  return { beats: list.filter((b) => b.n > since), mark: list[list.length - 1]?.n ?? since };
}

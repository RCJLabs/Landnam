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

import type { Battle, BattleOutcome, Side } from '../state/types';
import type { Hex } from '../hex';

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

/** Somebody crossed ground. The only beat with no line in the log. */
export interface MovedBeat extends BeatBase {
  kind: 'moved';
  who: string;
  from: Hex;
  to: Hex;
  cost: number;
  /** Not a manoeuvre — a broken fighter running for their own edge. */
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
export type ShoveResult = 'held' | 'pushed' | 'crushed' | 'drowned';

export interface ShovedBeat extends BeatBase {
  kind: 'shoved';
  who: string;
  target: string;
  result: ShoveResult;
  from: Hex;
  /** Where they ended up, when they gave ground. */
  to?: Hex;
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

// 12.12 — THE INSTRUMENT FOR THE HUMAN.
//
// No instrument has ever watched a person play this coast. Every figure in
// ROADMAP.md comes from `test/fixtures/harness.ts`, and `PROBE 12.12` put a
// number on how far that bot is from a player: over 30 settler sagas to day
// 400 it landed 18,733 steading moves by calling the sim directly, and the
// interface would have refused ALL of them — 11,639 taken from the road and
// 7,094 from inside a battle. The bot crews the yard mid-fight.
//
// So: record what a person actually does, and be able to play it back.
//
// ## Where it is kept, and why not in the save
//
// The prefs store (`src/store.ts`), beside the mute and the lessons read.
// A recording is not part of a RUN — it outlives the run, it is not loaded
// when the run is, and putting it in the save would mean a SAVE_VERSION bump
// and a migration for something no rule ever reads. The store is already
// versioned for exactly this kind of thing.
//
// ## What is recorded, and what is not
//
// The OPENING — what was typed, the terms, and the clock — and then the
// actions, in order. Not the states: `apply` is pure and the sim is
// deterministic, so the states are recoverable and storing them would be
// storing the same run twice. A recording is about 40 bytes an action.
//
// ## What it costs to be wrong
//
// Nothing in the game reads this. `note` runs after a landed dispatch and
// writes to localStorage; if storage is refused or full, `store.write`
// swallows it and the run carries on. A recorder that can stop a run is
// worse than no recorder.

import { read, write, forget } from './store';
import { openRun, type Opening } from './opening';
import { apply, type Action } from './sim/actions';
import type { GameState } from './state/types';

const KEY = 'landnam_play';

/**
 * The ceiling, in actions.
 *
 * A day of play is a handful of dispatches, so this is several thousand days
 * — far past any real saga. It exists because a browser tab left open on a
 * held-down button is a thing that happens, and a prefs store that fills up
 * takes the mute and the lessons down with it.
 */
export const PLAY_CAP = 60_000;

export interface Play {
  opening: Opening;
  /** The clock `openRun` was given. Only an empty entry needs it. */
  now: number;
  /**
   * The seed the opening produced, and the day the last action left the run
   * on. Both are here to answer one question cheaply on `resume`: is this
   * recording still the run that is being loaded?
   *
   * A recording that has fallen out of step with its save cannot replay, and
   * appending to it would make a fixture that fails for a reason nobody could
   * find. Two fields and a comparison is a great deal less than that.
   */
  seed: string;
  day: number;
  /** Every action that changed the state, oldest first. */
  acts: Action[];
  /** Set once the cap was reached and recording stopped. */
  full?: boolean;
}

const isPlay = (value: unknown): value is Play => {
  if (!value || typeof value !== 'object') return false;
  const play = value as Record<string, unknown>;
  const opening = play['opening'] as Record<string, unknown> | undefined;
  return !!opening
    && typeof opening['entry'] === 'string'
    && typeof opening['hardship'] === 'string'
    && typeof play['now'] === 'number'
    && typeof play['seed'] === 'string'
    && typeof play['day'] === 'number'
    && Array.isArray(play['acts']);
};

/** The recording as it stands, or nothing. */
export function playSoFar(): Play | undefined {
  const play = read<Play | null>(KEY, (v): v is Play | null => v === null || isPlay(v), null);
  return play ?? undefined;
}

/** Starts a new recording. Called where a run is opened. */
export function beginPlay(opening: Opening, now: number, state: GameState): void {
  write(KEY, { opening, now, seed: state.seed, day: state.day, acts: [] } satisfies Play);
}

/**
 * Keeps the recording if it is this run's, and drops it if it is not.
 *
 * Called where a save is loaded. A player who starts a run on one device and
 * continues it on another, or who has a save from before the recorder
 * existed, has a save with no recording behind it — and half a recording is
 * worse than none, because it looks like a fixture and cannot replay.
 */
export function resumePlay(state: GameState): void {
  const play = playSoFar();
  if (!play) return;
  if (play.seed !== state.seed || play.day !== state.day) forgetPlay();
}

export function forgetPlay(): void {
  forget(KEY);
}

/**
 * Notes one action that landed.
 *
 * Read-modify-write per action, which is the wrong shape for a hot loop and
 * the right one here: a turn is one tap, the array is small, and the
 * alternative — holding the recording in memory and flushing on some event —
 * loses the tail of every session that ends by closing the tab, which is how
 * most of them end on a phone.
 */
export function note(action: Action, state: GameState): void {
  const play = playSoFar();
  if (!play || play.full) return;
  if (play.acts.length >= PLAY_CAP) {
    write(KEY, { ...play, full: true } satisfies Play);
    return;
  }
  write(KEY, { ...play, day: state.day, acts: [...play.acts, action] } satisfies Play);
}

/**
 * Plays a recording back and hands over the state it ends on.
 *
 * REFUSED ACTIONS ARE A FAULT, not something to step over. Only landed
 * actions are recorded, so an action that does nothing on replay means the
 * rules have moved under the recording — which is exactly what a pinned
 * fixture exists to catch, and the reason this counts them rather than
 * shrugging. `stoppedAt` is the index of the first one that did nothing.
 */
export function replay(play: Play): { state: GameState; stoppedAt: number } {
  let state = openRun(play.opening.entry, play.opening.hardship, play.now);
  for (let i = 0; i < play.acts.length; i += 1) {
    const next = apply(state, play.acts[i]!);
    if (next === state) return { state, stoppedAt: i };
    state = next;
  }
  return { state, stoppedAt: -1 };
}

/** The recording in a line, for a screen that cannot show the whole thing. */
export function describePlay(play: Play): string {
  const acts = play.acts.length;
  return `This run so far: ${acts} ${acts === 1 ? 'move' : 'moves'} to day ${play.day}`
    + `${play.full ? ', and it stopped recording there' : ''}.`;
}

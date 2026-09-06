// 12.12: the instrument for the human.
//
// Nothing has ever watched a person play this coast, and `PROBE 12.12` put a
// figure on how far the bot every published number comes from is from one:
// over 30 settler sagas to day 400 it landed 18,733 steading moves by calling
// the sim directly, and the interface would have refused all of them — 11,639
// taken from the road and 7,094 from inside a battle.
//
// The recorder is the first half of the answer. These are its claims:
// it holds only what landed, it survives being replayed, it knows when it
// has fallen out of step with its own run, and it never stops a run.
//
// WHAT IS NOT HERE, and it is the deliverable the item names last: a
// COMMITTED HUMAN RUN, pinned. The machinery below is proved on a recording
// this file makes, which is a bot's — and a bot's recording is a fixture a
// bot can re-record, which is exactly what the item's verifier caution says
// a human fixture must not be. The slot is `test/fixtures/plays/`, it is
// empty, and it stays empty until somebody plays.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apply, type Action } from '../src/sim/actions';
import { openRun } from '../src/opening';
import type { GameState } from '../src/state/types';

function fakeStorage(initial: Record<string, string> = {}, deny = false) {
  const held = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (deny) throw new Error('storage denied');
      held.set(k, v);
    },
    removeItem: (k: string) => void held.delete(k),
    clear: () => held.clear(),
    key: () => null,
    length: 0,
  };
}

const OPENING = { entry: 'recorder', hardship: 'even' as const };

/**
 * Plays a few dozen turns and returns what was dispatched — through `apply`
 * and recording only what landed, which is exactly what `dispatch` does.
 */
function someTurns(state: GameState, turns: number): { state: GameState; acts: Action[] } {
  const acts: Action[] = [];
  let now = state;
  for (let i = 0; i < turns; i += 1) {
    const act: Action = { type: 'CAMP' };
    const next = apply(now, act);
    if (next === now) {
      // A card on the table stops the day. Answer it, the way a player would.
      const answer: Action = now.event?.outcome
        ? { type: 'DISMISS_EVENT' }
        : now.event
          ? { type: 'CHOOSE', index: 0 }
          : { type: 'DISMISS_AFTERMATH' };
      const after = apply(now, answer);
      if (after === now) break;
      acts.push(answer);
      now = after;
      continue;
    }
    acts.push(act);
    now = next;
  }
  return { state: now, acts };
}

describe('the recorder', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('replays to the same state, field for field', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);

    const played = someTurns(opened, 40);
    for (const act of played.acts) rec.note(act, played.state);
    expect(played.acts.length, 'nothing was played, so nothing was measured')
      .toBeGreaterThan(10);

    const play = rec.playSoFar()!;
    expect(play.acts).toEqual(played.acts);

    const back = rec.replay(play);
    expect(back.stoppedAt, 'an action in the recording did nothing on replay').toBe(-1);
    // Field for field, not day for day: a replay that lands on the right day
    // by a different road is not the same run.
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(played.state));
  });

  it('says WHERE a replay stopped, rather than shrugging', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);
    const played = someTurns(opened, 12);
    for (const act of played.acts) rec.note(act, played.state);

    // A recording with a move spliced into it that the rules will not take.
    // This stands in for the thing a pinned human fixture exists to catch: a
    // rule moved under a run somebody actually played.
    const play = rec.playSoFar()!;
    const bent = { ...play, acts: [...play.acts.slice(0, 3), { type: 'LEAVE_COLONY' } as Action, ...play.acts.slice(3)] };
    const back = rec.replay(bent);
    expect(back.stoppedAt, 'a move the rules refuse was stepped over in silence').toBe(3);
  });

  it('holds only the moves that landed', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);
    // `note` is called from `dispatch` AFTER the refusal check, so a refused
    // action never reaches it. Asserted on the contract rather than by
    // calling `note` with a refused action, because calling it that way would
    // be testing the test.
    const yardVerb: Action = { type: 'LEAVE_COLONY' };
    expect(apply(opened, yardVerb), 'the fixture verb is not actually refused')
      .toBe(opened);
    expect(rec.playSoFar()!.acts).toEqual([]);
  });

  it('drops a recording that is not this run', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);
    rec.note({ type: 'CAMP' }, { ...opened, day: opened.day + 1 });
    expect(rec.playSoFar()!.acts.length).toBe(1);

    // A save from a different run — the seed does not match.
    rec.resumePlay({ ...opened, seed: 'somebody-else' });
    expect(rec.playSoFar(), 'a recording of another run was kept').toBeUndefined();
  });

  it('drops a recording that has fallen behind its save', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);
    rec.note({ type: 'CAMP' }, { ...opened, day: opened.day + 1 });

    // Same run, but the save has moved on — played in another tab, or on
    // another device. Half a recording cannot replay.
    rec.resumePlay({ ...opened, day: opened.day + 9 });
    expect(rec.playSoFar(), 'a recording out of step with its save was kept')
      .toBeUndefined();
  });

  it('keeps its day current, which is what the two checks above rest on', () => {
    // Found by sabotage: with `note` leaving `day` at the opening's, both
    // "drops" tests above still passed and every resumed run would silently
    // have been thrown away. A field two other claims depend on needs a
    // claim of its own.
    return (async () => {
      const rec = await import('../src/record');
      const opened = openRun(OPENING.entry, OPENING.hardship, 0);
      rec.beginPlay(OPENING, 0, opened);
      const played = someTurns(opened, 8);
      for (const act of played.acts) rec.note(act, played.state);
      expect(played.state.day, 'no day passed, so this measures nothing')
        .toBeGreaterThan(opened.day);
      expect(rec.playSoFar()!.day).toBe(played.state.day);
    })();
  });

  it('keeps a recording that is still in step', async () => {
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    rec.beginPlay(OPENING, 0, opened);
    rec.resumePlay(opened);
    expect(rec.playSoFar(), 'the recorder threw away its own run').toBeDefined();
  });

  it('never stops the run when storage refuses', async () => {
    (globalThis as Record<string, unknown>).localStorage = fakeStorage({}, true);
    const rec = await import('../src/record');
    const opened = openRun(OPENING.entry, OPENING.hardship, 0);
    expect(() => rec.beginPlay(OPENING, 0, opened)).not.toThrow();
    expect(() => rec.note({ type: 'CAMP' }, opened)).not.toThrow();
    expect(rec.playSoFar()).toBeUndefined();
  });
});

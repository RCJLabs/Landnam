// What the game feels like, asserted without a phone.
//
// The interesting half of haptics is restraint. Anyone can make a device
// buzz; the work is in not buzzing — on every footstep, on every miss, on
// every forage, and on any device whose owner has asked for stillness. So
// most of this file is about what does NOT happen.

import { describe, expect, it } from 'vitest';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { cuesFor } from '../src/audio/cues';
import { moveOptions } from '../src/sim/road';
import { FEELINGS, FELT, buzzFor, patternFor, type Hand } from '../src/haptics';
import type { CueId } from '../src/data/sounds';
import longText from '../runs/long.json?raw';
import type { Script } from '../src/run/headless';

const READY: Hand = { supported: true, enabled: true, still: false };

describe('one buzz per dispatch, and the heaviest wins', () => {
  it('feels the death, not the shield raised in the same turn', () => {
    // The case the priority list exists for. A turn can produce three cues;
    // the hand gets the one that matters.
    expect(patternFor(['wall', 'knell', 'strike'])).toEqual(patternFor(['knell']));
  });

  it('feels the ending over everything else that ended with it', () => {
    expect(patternFor(['knell', 'lost', 'ending'])).toEqual(patternFor(['ending']));
  });

  it('gives one pattern however many cues arrived', () => {
    const pattern = patternFor(['strike', 'fell', 'wall', 'horn']);
    expect(pattern).toEqual(patternFor(['fell']));
  });

  it('has no opinion about an empty dispatch', () => {
    expect(patternFor([])).toBeNull();
  });
});

describe('the common cues never reach the hand', () => {
  // A phone that buzzes on every step is a phone being put down. These four
  // are the ones that fire constantly, and the whole design rests on them
  // staying silent — so they are named rather than left to the priority list.
  const constant: CueId[] = ['step', 'oar', 'gather', 'miss', 'camp', 'tap', 'shut', 'daybreak'];

  for (const cue of constant) {
    it(`says nothing for ${cue}`, () => {
      expect(patternFor([cue])).toBeNull();
      expect(FELT.has(cue)).toBe(false);
    });
  }

  it('says nothing across a stretch of real walking', () => {
    // Not a hand-picked cue list: real MOVEs through the real fog, and the
    // cues they actually produce. `runs/long.json` cannot carry this — it
    // makes eight moves in four hundred days and then sits in a steading, so
    // a step that started buzzing would barely move its totals. Walking is
    // the case, so the test has to walk.
    let state = newGame('haptics-walk', 'fair');
    let steps = 0;
    let felt = 0;
    for (let turn = 0; turn < 200 && !state.end; turn++) {
      // Clear whatever is in the way first. A card refuses a MOVE, so a loop
      // that gives up on the first refusal walks three hexes and calls it a
      // stretch — which is what the first version of this test did.
      if (state.aftermath) {
        state = apply(state, { type: 'DISMISS_AFTERMATH' });
        continue;
      }
      if (state.event) {
        const answered = state.event.outcome
          ? apply(state, { type: 'DISMISS_EVENT' })
          : apply(state, { type: 'CHOOSE', index: 0 });
        state = answered === state ? apply(state, { type: 'DISMISS_EVENT' }) : answered;
        continue;
      }

      const to = moveOptions(state)[0];
      if (!to) {
        // A band that cannot step has to rest or eat before it can. This is
        // a walking test, not a survival one — keep it on its feet.
        const rested = apply(state, { type: 'CAMP' });
        if (rested === state) break;
        state = rested;
        continue;
      }
      const next = apply(state, { type: 'MOVE', to });
      if (next === state) {
        const rested = apply(state, { type: 'CAMP' });
        if (rested === state) break;
        state = rested;
        continue;
      }
      const cues = cuesFor(state, next, { type: 'MOVE', to });
      // A move that walks into a card or a fight is allowed to be felt —
      // that is the point. A plain step is not.
      if (cues.every((c) => c === 'step' || c === 'oar')) {
        steps++;
        if (patternFor(cues)) felt++;
      }
      state = next;
    }

    expect(steps).toBeGreaterThan(5);
    expect(felt, `${felt} of ${steps} plain steps reached the hand`).toBe(0);
  });
});

describe('nothing is felt when it should not be', () => {
  const loud: CueId[] = ['knell'];

  it('does nothing on a browser that cannot vibrate', () => {
    // Every iPhone lands here. `navigator.vibrate` has never shipped in
    // Safari on iOS, and this is the branch that says so.
    expect(buzzFor(loud, { ...READY, supported: false })).toBeNull();
  });

  it('does nothing when the player has turned it off', () => {
    expect(buzzFor(loud, { ...READY, enabled: false })).toBeNull();
  });

  it('does nothing when the game has been asked to hold still', () => {
    // A buzz in the hand is motion, whatever it is that moves. Somebody who
    // set the game still, or set their whole phone still, meant this too.
    expect(buzzFor(loud, { ...READY, still: true })).toBeNull();
  });

  it('buzzes when nothing is in the way', () => {
    expect(buzzFor(loud, READY)).toEqual(patternFor(loud));
  });
});

describe('the patterns themselves', () => {
  it('never runs longer than a fifth of a second', () => {
    // A long vibration is a notification, not a game. If one of these grows
    // past this it will feel like the phone has gone wrong rather than like
    // the game has said something.
    for (const [id, pattern] of FEELINGS) {
      const total = pattern.reduce((sum, n) => sum + n, 0);
      expect(total, `${id} runs ${total}ms`).toBeLessThanOrEqual(200);
    }
  });

  it('is all whole positive milliseconds', () => {
    // navigator.vibrate truncates, and a fractional or negative entry is the
    // kind of thing that silently does nothing on one browser and throws on
    // another.
    for (const [id, pattern] of FEELINGS) {
      for (const n of pattern) {
        expect(Number.isInteger(n), `${id} has ${n}`).toBe(true);
        expect(n, `${id} has ${n}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives a copy, so a caller cannot rewrite what the game feels like', () => {
    const first = patternFor(['strike'])!;
    first[0] = 9999;
    expect(patternFor(['strike'])).not.toEqual(first);
  });

  it('names no cue twice', () => {
    const ids = FEELINGS.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('across a real run', () => {
  // The restraint claim, measured rather than asserted: replay the long
  // script and count how much of it reaches the hand. If a future cue change
  // makes the game buzz on most turns, this is what says so.
  const script = JSON.parse(longText) as Script;

  it('stays quiet through most of a four-hundred-day run', () => {
    // Replays `runs/long.json`, so it retires with the recorded runs — see
    // "The parity vectors retire with the hexes" in ROADMAP.md and the same
    // guard in `headless.test.ts`. On a coast the script is a list of hex
    // actions and only 108 of its 1142 apply, so the quietness this measures
    // would be measured over a run that never happened.
    if (COAST_IS_A_LINE) return;
    let state = newGame(script.seed, script.hardship);
    let dispatches = 0;
    let buzzed = 0;
    for (const action of script.actions as Action[]) {
      const next = apply(state, action);
      if (next === state) continue;
      const pattern = buzzFor(cuesFor(state, next, action), READY);
      dispatches++;
      if (pattern) buzzed++;
      state = next;
    }

    expect(dispatches).toBeGreaterThan(1000);
    // Felt on something, or the whole feature is wired to nothing.
    expect(buzzed).toBeGreaterThan(0);
    // And quiet on the large majority of turns, which is the actual design.
    expect(buzzed).toBeLessThan(dispatches / 4);
    console.log(
      `haptics: ${buzzed} buzzes across ${dispatches} dispatches ` +
        `(${((100 * buzzed) / dispatches).toFixed(1)}% of turns)`,
    );
  });
});

// Sharing the ground between a state and its copy.
//
// `apply` copies the whole state on every action, because never mutating its
// input is the rule the entire project stands on. It was paying for that in
// the dumbest place available: 98% of the cost of a turn was duplicating
// 78 KB of terrain that is generated once and never written. Measured
// 2026-08-11 — 1.838 ms a clone before, 0.060 ms after, on a game whose
// primary target is a phone.
//
// The saving is real and the risk is real too: two states sharing an object
// one of them later mutates is about the worst bug this codebase could grow,
// and it would show up as a corrupted save weeks later rather than as a
// failure here. So this file is mostly about the guard, not the speed.
//
// The guard has three layers, and the third is the one that actually
// convinces: `cloneState` freezes the tiles, so a write throws at the line
// that did it; the tests below prove the freeze bites and the sharing is
// otherwise invisible; and the whole 800-test suite — including the balance
// harness playing sixty sagas to day 500, founding, building, raiding,
// sailing and fighting — runs with that freeze in place. Anything that
// writes a tile anywhere in the game cannot get through it quietly.

import { describe, it, expect } from 'vitest';
import { cloneState } from '../src/state/clone';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { key } from '../src/hex';

const fresh = () => structuredClone(newGame('clone'));

describe('what is shared and what is not', () => {
  it('shares the generated ground', () => {
    const a = fresh();
    const b = cloneState(a);
    // The whole point: one object, not two copies of it.
    expect(b.world.tiles).toBe(a.world.tiles);
  });

  it('copies everything that play actually writes', () => {
    // `seen`, `trod` and `places` all have write sites in src/ — fog, travel
    // and sacking a place respectively — so all three must be copies.
    const a = fresh();
    const b = cloneState(a);
    expect(b.world.seen).not.toBe(a.world.seen);
    expect(b.world.trod).not.toBe(a.world.trod);
    expect(b.world.places).not.toBe(a.world.places);
    expect(b.party).not.toBe(a.party);
    expect(b.party.people[0]).not.toBe(a.party.people[0]);

    b.world.seen[key(b.party.at)] = 'visible';
    b.world.trod['9,9'] = 4;
    if (b.world.places[0]) b.world.places[0].sackedOn = 12;
    expect(a.world.trod['9,9']).toBeUndefined();
    expect(a.world.places[0]?.sackedOn).toBeUndefined();
  });

  it('leaves a copy that is equal in every respect', () => {
    const a = fresh();
    expect(JSON.stringify(cloneState(a))).toBe(JSON.stringify(a));
  });
});

describe('the guard', () => {
  it('freezes the ground, and the freeze bites', () => {
    // Checked rather than assumed. A freeze that did not throw would leave
    // the sharing unguarded while looking exactly like this test passing.
    const a = fresh();
    cloneState(a);
    expect(Object.isFrozen(a.world.tiles)).toBe(true);

    const k = Object.keys(a.world.tiles)[0]!;
    expect(() => {
      a.world.tiles[k]!.terrain = 'ocean';
    }).toThrow();
    expect(() => {
      a.world.tiles['made-up'] = { terrain: 'bog', river: false };
    }).toThrow();
  });

  it('survives being copied over and over', () => {
    // The freeze is applied on first copy and skipped thereafter, so the
    // second clone must not trip over an already-frozen record.
    let s = fresh();
    for (let i = 0; i < 50; i += 1) s = cloneState(s);
    expect(Object.isFrozen(s.world.tiles)).toBe(true);
  });
});

describe('the contract it exists to keep', () => {
  it('apply still never touches the state it was given', () => {
    // The rule everything else stands on. Worth re-proving here rather than
    // trusting it, because this change is the first thing in the project's
    // life to make a state and its successor share anything at all.
    let state = fresh();
    for (let i = 0; i < 40 && !state.end; i += 1) {
      const before = JSON.stringify(state);
      const next = apply(state, { type: 'CAMP' });
      expect(JSON.stringify(state), 'apply mutated its input').toBe(before);
      if (next === state) break;
      state = next;
      if (state.event) {
        const evented = JSON.stringify(state);
        const after = apply(state, state.event.outcome
          ? { type: 'DISMISS_EVENT' }
          : { type: 'CHOOSE', index: 0 });
        expect(JSON.stringify(state)).toBe(evented);
        state = after;
      }
    }
    expect(state.day).toBeGreaterThan(1);
  });

  it('plays a real saga with the ground frozen throughout', () => {
    // A write to a tile anywhere in this would throw rather than corrupt.
    let state = fresh();
    let steps = 0;
    for (let i = 0; i < 300 && !state.end; i += 1) {
      const action = state.event
        ? (state.event.outcome ? { type: 'DISMISS_EVENT' } as const : { type: 'CHOOSE', index: 0 } as const)
        : state.party.food < 14
          ? { type: 'FORAGE' } as const
          : { type: 'CAMP' } as const;
      const next = apply(state, action);
      if (next === state) {
        const camped = apply(state, { type: 'CAMP' });
        if (camped === state) break;
        state = camped;
      } else {
        state = next;
      }
      steps += 1;
    }
    expect(steps).toBeGreaterThan(20);
    expect(Object.isFrozen(state.world.tiles)).toBe(true);
  });
});

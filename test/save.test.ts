import { describe, it, expect } from 'vitest';
import { decode, encode } from '../src/state/save';
import { migrate, MIGRATIONS, type Migration } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { moveOptions } from '../src/sim/travel';

describe('save codec', () => {
  it('round-trips a fresh game exactly', () => {
    const state = newGame('codec-seed');
    const decoded = decode(encode(state));
    expect(decoded).not.toBeNull();
    expect(encode(decoded!)).toBe(encode(state));
  });

  it('round-trips a played game exactly', () => {
    let state = newGame('codec-played');
    for (let i = 0; i < 10 && !state.end; i++) {
      if (state.event) {
        state = apply(state, { type: 'CHOOSE', index: 0 });
        state = apply(state, { type: 'DISMISS_EVENT' });
        continue;
      }
      const options = moveOptions(state);
      state = options[0]
        ? apply(state, { type: 'MOVE', to: options[0] })
        : apply(state, { type: 'CAMP' });
    }
    const decoded = decode(encode(state));
    expect(decoded).not.toBeNull();
    expect(encode(decoded!)).toBe(encode(state));
    expect(decoded!.day).toBe(state.day);
    expect(decoded!.saga.length).toBe(state.saga.length);
  });

  it('rejects junk without throwing', () => {
    expect(decode('not json')).toBeNull();
    expect(decode('null')).toBeNull();
    expect(decode('[]')).not.toBeUndefined(); // arrays are objects; migrate handles them
  });

  it('state contains nothing that JSON cannot carry', () => {
    const state = newGame('json-clean');
    // A Map, Set, or function anywhere would break the round trip silently.
    const walk = (value: unknown, path: string): void => {
      if (value instanceof Map || value instanceof Set) {
        throw new Error(`non-serializable collection at ${path}`);
      }
      if (typeof value === 'function') throw new Error(`function at ${path}`);
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };
    expect(() => walk(state, 'state')).not.toThrow();
  });
});

describe('migration registry', () => {
  it('a current-version save passes through untouched', () => {
    const state = newGame('migrate-current');
    const raw = JSON.parse(encode(state)) as Record<string, unknown>;
    const result = migrate(raw);
    expect(result.applied).toBe(0);
    expect(result.save['version']).toBe(SAVE_VERSION);
  });

  it('refuses saves from the future', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1 })).toThrow(/newer version/);
  });

  it('refuses a version gap with no registered migration', () => {
    // Version 0 has no migration registered today, which is exactly the
    // failure we want loudly surfaced if someone bumps without migrating.
    expect(() => migrate({ version: 0 })).toThrow(/no migration registered/);
  });

  it('walks a save up through every registered migration in turn', () => {
    // Register a step below the real ones so the walk has to chain: the fake
    // 0->1 runs, then every real migration up to SAVE_VERSION follows.
    const added: number[] = [];
    const fake: Migration = (save) => {
      added.push(0);
      return { ...save, addedInV1: true, version: 1 };
    };
    const original = { ...MIGRATIONS };
    try {
      MIGRATIONS[0] = fake;
      const result = migrate({ version: 0, keep: 'me' });
      // One fake step plus one per real migration from v1 upward.
      expect(result.applied).toBe(SAVE_VERSION);
      expect(result.save['version']).toBe(SAVE_VERSION);
      // Fields introduced early must survive every later migration.
      expect(result.save['addedInV1']).toBe(true);
      expect(result.save['keep']).toBe('me');
      expect(added).toEqual([0]);
    } finally {
      delete MIGRATIONS[0];
      Object.assign(MIGRATIONS, original);
    }
  });

  it('carries a real v1 save forward to the current version', () => {
    // A frozen fixture from before the BATTLE layer existed.
    const v1: Record<string, unknown> = {
      version: 1,
      seed: 'frozen-v1',
      day: 12,
      modes: ['TRAVEL'],
      party: { at: { q: 0, r: 0 }, people: [], food: 5, firewood: 2, morale: 50, hasCamped: false },
      saga: [],
      flags: {},
      nextId: 1,
    };
    const result = migrate(v1);
    expect(result.save['version']).toBe(SAVE_VERSION);
    expect(result.save['seed']).toBe('frozen-v1');
    expect(result.save['day']).toBe(12);
    // No fight was in progress, and none should be invented.
    expect(result.save['battle']).toBeUndefined();
  });

  it('catches a migration that fails to advance the version', () => {
    const bad: Migration = (save) => ({ ...save });
    const original = { ...MIGRATIONS };
    try {
      MIGRATIONS[0] = bad;
      expect(() => migrate({ version: 0 })).toThrow(/did not advance/);
    } finally {
      delete MIGRATIONS[0];
      Object.assign(MIGRATIONS, original);
    }
  });
});

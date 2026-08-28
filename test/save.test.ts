import { describe, it, expect } from 'vitest';
import { decode, encode } from '../src/state/save';
import { migrate, MIGRATIONS, type Migration } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { walkOptions } from '../src/sim/coast';

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
      const options = walkOptions(state);
      state = options[0]
        ? apply(state, { type: 'WALK', to: options[0] })
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

/**
 * The failure mode these guard is the one that actually destroys a player's
 * run: a migration that advances the version but forgets a field, leaving an
 * `undefined` for a renderer or a reducer to trip over three turns later. The
 * existing v1 fixture proves a save ARRIVES; these prove it is playable when
 * it gets here.
 */
describe('a migrated save is a playable save', () => {
  /** A v1 save with real people and real ground in it, not an empty shell. */
  function frozenV1(): Record<string, unknown> {
    const seedGame = newGame('frozen-fixture');
    return {
      version: 1,
      seed: 'frozen-fixture',
      day: 20,
      modes: ['TRAVEL'],
      world: structuredClone(seedGame.world),
      party: {
        stop: seedGame.party.stop ?? 0,
        // Two people carrying only the fields v1 knew about. Everything a
        // later version added must be filled in by a migration, not by luck.
        people: seedGame.party.people.slice(0, 2).map((p) => ({
          id: p.id,
          name: p.name,
          byname: p.byname,
          age: p.age,
          stats: { ...p.stats },
          trait: p.trait,
          health: p.health,
          maxHealth: p.maxHealth,
          injuries: [],
          alive: true,
        })),
        food: 18,
        firewood: 6,
        morale: 55,
        hasCamped: false,
      },
      saga: [{ day: 1, text: 'We came ashore.', tone: 'plain' }],
      flags: {},
      nextId: 9,
    };
  }

  it('comes forward with every field a new game has', () => {
    const migrated = migrate(frozenV1()).save;
    const today = newGame('shape-reference') as unknown as Record<string, unknown>;
    // `rival` is the one field a fresh game sets that an old save must NOT
    // be given, and it is exempted by name rather than by loosening the rule.
    // Two reasons, both the same reason `kin` is exempt below: he is supposed
    // to have landed the same spring we did, so planting him into a saga
    // that has been played for two hundred summers without him rewrites that
    // run's history — and there is no honest day to say he arrived. He is
    // also genuinely optional on a fresh game: a world with no ground far
    // enough from the landing has no second boat at all.
    const optionalByDesign = new Set(['rival']);
    const missing = Object.keys(today).filter(
      (field) => !optionalByDesign.has(field) && !(field in migrated),
    );
    // Anything else `newGame` sets is something every save must have — that
    // is the whole contract.
    expect(missing, `migrated save is missing: ${missing.join(', ')}`).toEqual([]);
    // And the exemption is not a hole: the field must still be one the code
    // treats as optional, which means a save without it has to load and play.
    for (const field of optionalByDesign) expect(field in migrated).toBe(false);
  });

  it('gives every carried-forward person the fields the code reads today', () => {
    const migrated = migrate(frozenV1()).save;
    const party = migrated['party'] as { people: Record<string, unknown>[] };
    const reference = newGame('person-reference').party.people[0] as unknown as Record<
      string,
      unknown
    >;
    // `job`, `fate` and `diedOn` are genuinely optional — nobody has a job
    // before there is a steading, and the living have no fate. `kin` is
    // optional in the same way and for a stronger reason: a band from
    // before kin existed came off the knarr as strangers, and inventing
    // families for them retroactively would rewrite a run's history.
    const optional = new Set(['job', 'fate', 'diedOn', 'kin']);
    for (const person of party.people) {
      const missing = Object.keys(reference).filter(
        (field) => !optional.has(field) && !(field in person),
      );
      expect(missing, `person missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('decodes into a state the game will actually accept', () => {
    const loaded = decode(JSON.stringify(frozenV1()));
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.party.people).toHaveLength(2);
    expect(loaded!.saga[0]?.text).toBe('We came ashore.');
  });

  it('can be played on without throwing', () => {
    // The real test of a migration: take a turn on what came back.
    let state = decode(JSON.stringify(frozenV1()))!;
    expect(() => {
      for (let i = 0; i < 12 && !state.end; i += 1) {
        const options = walkOptions(state);
        state = apply(
          state,
          state.event
            ? { type: 'DISMISS_EVENT' }
            : options.length > 0
              ? { type: 'WALK', to: options[i % options.length]! }
              : { type: 'CAMP' },
        );
      }
    }).not.toThrow();
    expect(state.day).toBeGreaterThan(20);
  });

  it('survives a second trip through save and load unchanged', () => {
    // A migrated save is re-encoded the moment the player takes a turn, so
    // migrate(load(save(migrate(old)))) has to be a fixed point.
    const once = decode(JSON.stringify(frozenV1()))!;
    const twice = decode(encode(once))!;
    expect(encode(twice)).toBe(encode(once));
  });
});

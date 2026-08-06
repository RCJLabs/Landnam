// Migration registry. A save written at version N is run through every
// migration from N up to SAVE_VERSION, in order.
//
// Rules:
//   1. Every SAVE_VERSION bump ships a migration here, even a no-op one.
//   2. Migrations take and return `unknown`-shaped plain data — never import
//      GameState here, because that type describes TODAY's shape, not the
//      shape being migrated.
//   3. Migrations never throw on missing fields; they fill defaults.

import { SAVE_VERSION } from './version';

/** Migrates a save from version N to version N+1. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version being migrated FROM. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: the BATTLE layer arrived. `battle` is optional and absent
  // means "no fight in progress", so a v1 save needs no reshaping — but the
  // bump still ships a migration, because the registry refuses silent gaps.
  1: (save) => ({ ...save, version: 2 }),

  // v2 -> v3: fighters carry throwables and can raise a shield. A fight saved
  // mid-swing predates both, so give everyone one throw and a lowered shield
  // rather than leaving the fields undefined.
  2: (save) => {
    const battle = save['battle'] as { combatants?: Record<string, unknown>[] } | undefined;
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({
        throwsLeft: 1,
        defending: false,
        ...c,
      }));
    }
    return { ...save, version: 3 };
  },

  // v3 -> v4: fighters have nerve and can break. A fight saved before that
  // had nobody broken, so everyone comes forward steady.
  3: (save) => {
    const battle = save['battle'] as { combatants?: Record<string, unknown>[] } | undefined;
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({
        nerve: 70,
        broken: false,
        fled: false,
        ...c,
      }));
    }
    return { ...save, version: 4 };
  },

  // v4 -> v5: people earn xp. Everyone alive before this existed starts at
  // nothing earned, which is honest: their fights were never counted.
  4: (save) => {
    const party = save['party'] as { people?: Record<string, unknown>[] } | undefined;
    if (party?.people) {
      party.people = party.people.map((p) => ({ xp: 0, ...p }));
    }
    const battle = save['battle'] as {
      foes?: Record<string, unknown>[];
      combatants?: Record<string, unknown>[];
    } | undefined;
    if (battle?.foes) {
      battle.foes = battle.foes.map((p) => ({ xp: 0, ...p }));
    }
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({ kills: 0, ...c }));
    }
    return { ...save, version: 5 };
  },

  // v5 -> v6: the land can be taken. An absent `settlement` already means
  // "still walking", so a v5 save needs no reshaping — but the registry
  // refuses silent gaps, so the bump ships this anyway.
  5: (save) => ({ ...save, version: 6 }),

  // v6 -> v7: the steading has ground of its own and people have jobs. A save
  // made before COLONY existed has a settlement with no plots, so give it an
  // empty list rather than undefined — the renderer iterates it, and a run
  // mid-flight must not crash on load. The plots regenerate on next entry.
  6: (save) => {
    const settlement = save['settlement'] as Record<string, unknown> | undefined;
    if (settlement) {
      save['settlement'] = { plots: [], shelter: 0, watch: 0, ...settlement };
    }
    return { ...save, version: 7 };
  },

  // v7 -> v8: builders raise buildings instead of abstract shelter. A save
  // that accrued shelter the old way keeps it — taking a roof away from a
  // band mid-winter because the model changed would be indefensible — but
  // from here on shelter only moves when something is finished.
  7: (save) => {
    const settlement = save['settlement'] as Record<string, unknown> | undefined;
    if (settlement) {
      save['settlement'] = { built: [], queue: [], works: 0, ...settlement };
    }
    return { ...save, version: 8 };
  },

  // v8 -> v9: the world remembers where the party has walked. An older save
  // has no record of the route, so it starts from where the band is standing
  // — the map draws honestly from here rather than inventing a history.
  8: (save) => {
    const world = save['world'] as Record<string, unknown> | undefined;
    const party = save['party'] as { at?: { q: number; r: number } } | undefined;
    if (world) {
      if (!world['trod']) {
        const at = party?.at;
        world['trod'] = at ? { [`${at.q},${at.r}`]: 1 } : {};
      }
      if (!world['landingName']) world['landingName'] = 'the landing';
    }
    return { ...save, version: 9 };
  },

  // v9 -> v10: raids are fought on the steading, so a battle knows whether it
  // is one. A fight saved mid-swing before this was on open ground by
  // definition — an absent flag already means exactly that.
  9: (save) => ({ ...save, version: 10 }),

  // v10 -> v11: people keep a tally of each other. A band from before this
  // existed was getting along by definition, so it comes forward with none.
  10: (save) => ({ grudges: [], ...save, version: 11 }),
};

export interface MigrationResult {
  save: Record<string, unknown>;
  /** How many migrations ran. */
  applied: number;
}

/**
 * Walks a save up to the current version. Throws only if a version gap has
 * no registered migration — which means someone bumped without migrating.
 */
export function migrate(raw: Record<string, unknown>): MigrationResult {
  let save = raw;
  let version = typeof save['version'] === 'number' ? (save['version'] as number) : 0;
  let applied = 0;

  if (version > SAVE_VERSION) {
    throw new Error(`save is from a newer version (${version} > ${SAVE_VERSION})`);
  }

  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new Error(`no migration registered from save version ${version}`);
    }
    save = step(save);
    applied += 1;
    const next = typeof save['version'] === 'number' ? (save['version'] as number) : version + 1;
    if (next <= version) {
      throw new Error(`migration from ${version} did not advance the version`);
    }
    version = next;
  }

  return { save, applied };
}

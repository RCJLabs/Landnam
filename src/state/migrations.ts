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

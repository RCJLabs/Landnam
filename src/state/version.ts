// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

// v2 (2.1): GameState gained the optional `battle` field.
// v3 (2.2): Combatant gained throwsLeft and defending.
// v4 (2.3): Combatant gained nerve, broken and fled.
export const SAVE_VERSION = 4;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

// v2 (2.1): GameState gained the optional `battle` field.
export const SAVE_VERSION = 2;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

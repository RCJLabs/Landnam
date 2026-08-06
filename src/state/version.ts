// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

// v2 (2.1): GameState gained the optional `battle` field.
// v3 (2.2): Combatant gained throwsLeft and defending.
// v4 (2.3): Combatant gained nerve, broken and fled.
// v5 (2.4): Person gained xp (and diedOn), Combatant gained kills, and the
//           root gained the optional post-battle `aftermath`.
export const SAVE_VERSION = 5;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

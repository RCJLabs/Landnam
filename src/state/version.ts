// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

// v2 (2.1): GameState gained the optional `battle` field.
// v3 (2.2): Combatant gained throwsLeft and defending.
// v4 (2.3): Combatant gained nerve, broken and fled.
// v5 (2.4): Person gained xp (and diedOn), Combatant gained kills, and the
//           root gained the optional post-battle `aftermath`.
// v6 (3.1): the root gained the optional `settlement`.
// v7 (3.2): Settlement gained plots/shelter/watch; Person gained job.
// v8 (3.3): Settlement gained built/queue/works.
// v9 (map): World gained trod and landingName.
// v10 (3.5): Ground gained 'wall'; Battle gained the optional raid flag.
// v11 (4.1): the root gained grudges.
// v12 (4.2): the root gained the optional expedition.
export const SAVE_VERSION = 12;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

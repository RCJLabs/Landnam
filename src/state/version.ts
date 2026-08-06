// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

export const SAVE_VERSION = 1;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

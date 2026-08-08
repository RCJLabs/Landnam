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
// v13 (4.3): the root gained neighbours.
// v14 (4.4): the root gained lore.
// v15 (4.5): the root gained the tally.
// v16 (4.6): RunEnd gained the 'jarl' cause.
// v17 (6.2): a Person is sworn or a hand.
// v18 (places): World gained places; Battle gained the optional placeId.
// v19 (plunder): Battle gained the optional campId; ClanKindDef gained
//                plunder (data, not save — the bump is for the Battle field).
// v20 (sea): Party gained the optional hullHoled.
// v21 (combat): Battle gained warCried and lastBlow.
export const SAVE_VERSION = 26;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

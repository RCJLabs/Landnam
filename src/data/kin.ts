// Who is whose. Pure vocabulary — sim/kin.ts picks from it.
//
// The death table has said the same thing for three audits: despair ends
// more runs than hunger, cold and steel put together. The game already kills
// through grief; it has just never said whose grief. A band of six strangers
// who happen to share a boat mourns arithmetically. A band where two of them
// are brothers mourns the way the sagas do.

/** A tie, from each side. `[whatAIsToB, whatBIsToA]`. */
export type TiePair = readonly [string, string];

/** Ties between people of an age with each other. */
export const PEER_TIES: Record<'mm' | 'ff' | 'mf', TiePair[]> = {
  mm: [
    ['brother', 'brother'],
    ['oath-brother', 'oath-brother'],
    ['cousin', 'cousin'],
  ],
  ff: [
    ['sister', 'sister'],
    ['cousin', 'cousin'],
  ],
  mf: [
    ['brother', 'sister'],
    ['husband', 'wife'],
    ['cousin', 'cousin'],
  ],
};

/** Ties across a generation. The elder's word comes first. */
export const ELDER_TIES: Record<'mm' | 'ff' | 'mf' | 'fm', TiePair> = {
  mm: ['father', 'son'],
  ff: ['mother', 'daughter'],
  mf: ['father', 'daughter'],
  fm: ['mother', 'son'],
};

/** Years between two people before one is the other's parent. */
export const GENERATION = 16;

/**
 * What losing them takes out of the one left, on top of what losing anyone
 * takes out of everybody. Personal morale, 0..100 — a third of a person's
 * heart, which is meant to be survivable and meant to show.
 */
export const KIN_GRIEF = 30;

/** What seeing them fall takes out of you in the middle of a fight. */
export const NERVE_KIN_FELL = 15;

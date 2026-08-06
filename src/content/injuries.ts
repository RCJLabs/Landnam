// Grievous injuries: what you carry home instead of dying. Stat penalties
// are negative deltas applied via effStat until healTurns run out.

import { Injury } from '../sim/types';

export const INJURY_TABLE: Omit<Injury, 'id'>[] = [
  { label: 'Gashed sword-arm', might: -2, healTurns: 12 },
  { label: 'Cracked ribs', might: -1, guts: -1, healTurns: 10 },
  { label: 'Split brow', skill: -2, healTurns: 8 },
  { label: 'Spear-torn thigh', might: -1, sea: -1, healTurns: 12 },
  { label: 'Shield-shocked', guts: -2, healTurns: 8 },
  { label: 'Crushed hand', skill: -1, might: -1, healTurns: 14 },
];

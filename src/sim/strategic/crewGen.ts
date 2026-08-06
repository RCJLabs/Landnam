// Crew member generation, shared by run start, port recruits, and events.

import { Rng } from '../../core/rng';
import { BALANCE } from '../../content/balance';
import { EPITHETS, FEMALE_NAMES, MALE_NAMES } from '../../content/names';
import { CrewMember } from '../types';

export function makeCrewMember(rng: Rng, id: string, isCaptain: boolean): CrewMember {
  const female = rng.chance(0.2);
  const name = rng.pick(female ? FEMALE_NAMES : MALE_NAMES);
  const statBudget = isCaptain ? 16 : rng.int(10, 14);
  const stats = [1, 1, 1, 1];
  let left = statBudget - 4;
  let guard = 100;
  while (left > 0 && guard-- > 0) {
    const i = rng.int(0, 3);
    if (stats[i]! < 6) {
      stats[i]!++;
      left--;
    }
  }
  const hpMax = BALANCE.crew.hpBase + stats[0]!;
  return {
    id,
    name,
    epithet: isCaptain || rng.chance(0.35) ? rng.pick(EPITHETS) : undefined,
    isCaptain,
    female,
    might: stats[0]!,
    skill: stats[1]!,
    guts: stats[2]!,
    sea: stats[3]!,
    traits: [],
    weapon: isCaptain ? 'sword' : rng.pick(['axe', 'axe', 'spear', 'spear', 'seax']),
    armor: isCaptain ? 'mail' : rng.chance(0.3) ? 'leather' : undefined,
    hp: hpMax,
    hpMax,
    injuries: [],
    fatigue: 0,
    morale: BALANCE.morale.start,
    alive: true,
  };
}

export function makeRecruit(rng: Rng, n: number): CrewMember {
  return makeCrewMember(rng, `crew_${n}`, false);
}

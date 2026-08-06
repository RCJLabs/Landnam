// Legacy unlocks: permanent boons bought with fame between voyages.
// All owned unlocks apply automatically to every new run.

export interface UnlockDef {
  id: string;
  name: string;
  cost: number;
  blurb: string;
}

export const UNLOCKS: UnlockDef[] = [
  {
    id: 'war-chest',
    name: 'War-Chest',
    cost: 40,
    blurb: 'Begin each voyage with 15 extra silver.',
  },
  {
    id: 'hardy-crew',
    name: 'Hardy Crew',
    cost: 60,
    blurb: 'Your warriors ship out with +2 health.',
  },
  {
    id: 'full-hold',
    name: 'Full Hold',
    cost: 60,
    blurb: 'Begin with +10 food and +10 water.',
  },
  {
    id: 'crows-nest',
    name: "Crow's Nest",
    cost: 90,
    blurb: 'See one hex further across the water.',
  },
  {
    id: 'sealskin-sails',
    name: 'Sealskin Sails',
    cost: 110,
    blurb: 'Only a dead-on headwind slows the ship.',
  },
  {
    id: 'veteran-captain',
    name: 'Veteran Captain',
    cost: 150,
    blurb: 'Your captain ships out sharper: +2 stat points and finer gear.',
  },
];

export function unlockById(id: string): UnlockDef | undefined {
  return UNLOCKS.find((u) => u.id === id);
}

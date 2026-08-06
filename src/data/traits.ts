// Traits are pure data: a stat nudge plus tags the sim and events read.
// Adding a trait must never require touching engine code.

import type { Stats } from '../state/types';

export interface Trait {
  id: string;
  name: string;
  /** One line, shown on the person card. */
  blurb: string;
  /** Applied once at generation. */
  stats: Partial<Stats>;
  /** Queried by sim and events, e.g. 'forager', 'hardy'. */
  tags: string[];
  /**
   * Tags this one grates against. Two people sharing a hard winter is one
   * thing; a Quarrelsome and a Berserk sharing it is another.
   */
  frictions?: string[];
  /** How hard their own mood swings. 1 is ordinary; the volatile swing more. */
  temper?: number;
}

export const TRAITS: Trait[] = [
  {
    id: 'hunter',
    name: 'Hunter',
    blurb: 'Reads tracks others walk past.',
    stats: { wits: 1 },
    tags: ['forager', 'hunter'],
  },
  {
    id: 'shipwright',
    name: 'Shipwright',
    blurb: 'Knows how timber wants to bend.',
    stats: { craft: 1 },
    tags: ['builder'],
  },
  {
    id: 'berserk',
    name: 'Berserk',
    blurb: 'Goes somewhere else when the shields meet.',
    stats: { might: 1, spirit: -1 },
    tags: ['fighter', 'volatile'],
    frictions: ['volatile', 'anchor'],
    temper: 1.6,
  },
  {
    id: 'hardy',
    name: 'Hardy',
    blurb: 'Cold is just weather to them.',
    stats: { spirit: 1 },
    tags: ['hardy'],
    temper: 0.6,
  },
  {
    id: 'healer',
    name: 'Leechcraft',
    blurb: 'Keeps wounds from going green.',
    stats: { craft: 1 },
    tags: ['healer'],
  },
  {
    id: 'seafarer',
    name: 'Seafarer',
    blurb: 'Steers by swell and star.',
    stats: { wits: 1 },
    tags: ['sailor', 'fisher'],
  },
  {
    id: 'quarrelsome',
    name: 'Quarrelsome',
    blurb: 'Keeps a tally of every slight.',
    stats: { might: 1, wits: -1 },
    tags: ['volatile'],
    // Keeps a tally of every slight, and everyone is a slight eventually.
    frictions: ['volatile', 'hardy', 'anchor', 'healer'],
    temper: 1.8,
  },
  {
    id: 'steadfast',
    name: 'Steadfast',
    blurb: 'The last to break, always.',
    stats: { spirit: 1 },
    tags: ['hardy', 'anchor'],
    temper: 0.5,
  },
  {
    id: 'sharpeyed',
    name: 'Sharp-Eyed',
    blurb: 'Sees the smoke before the fire.',
    stats: { wits: 1 },
    tags: ['scout'],
  },
  {
    id: 'ox',
    name: 'Ox-Strong',
    blurb: 'Carries what two others would not.',
    stats: { might: 1 },
    tags: ['fighter', 'labourer'],
  },
];

export function traitById(id: string): Trait | undefined {
  return TRAITS.find((t) => t.id === id);
}

export function hasTag(traitId: string, tag: string): boolean {
  return traitById(traitId)?.tags.includes(tag) ?? false;
}

/** How badly these two grate on each other, 0 upward. */
export function friction(aTrait: string, bTrait: string): number {
  const a = traitById(aTrait);
  const b = traitById(bTrait);
  if (!a || !b) return 0;
  const oneWay = (from: Trait, to: Trait) =>
    (from.frictions ?? []).filter((tag) => to.tags.includes(tag)).length;
  return oneWay(a, b) + oneWay(b, a);
}

/** How hard this person's mood swings. */
export function temperOf(traitId: string): number {
  return traitById(traitId)?.temper ?? 1;
}

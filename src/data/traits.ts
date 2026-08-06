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
  },
  {
    id: 'hardy',
    name: 'Hardy',
    blurb: 'Cold is just weather to them.',
    stats: { spirit: 1 },
    tags: ['hardy'],
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
  },
  {
    id: 'steadfast',
    name: 'Steadfast',
    blurb: 'The last to break, always.',
    stats: { spirit: 1 },
    tags: ['hardy', 'anchor'],
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

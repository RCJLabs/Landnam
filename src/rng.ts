// Seeded deterministic randomness. `Math.random` is banned project-wide:
// same seed must always produce the same world, events, and battles.
//
// Streams are named and independent — drawing from `combat` never shifts
// what `worldgen` produces, so replays and saves stay stable.

export type StreamName = 'worldgen' | 'party' | 'events' | 'combat' | 'colony';

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Sum of `count` dice with `sides` faces, e.g. roll(2, 6). */
  roll(count: number, sides: number): number;
  pick<T>(items: readonly T[]): T;
  /** In-place Fisher-Yates; returns the same array. */
  shuffle<T>(items: T[]): T[];
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** A derived independent stream, e.g. per-turn or per-hex. */
  derive(label: string): Rng;
}

/** FNV-1a — small, fast, stable across runs. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): Rng {
  const next = mulberry32(hashString(seed));

  const rng: Rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    roll(count, sides) {
      let sum = 0;
      for (let i = 0; i < count; i++) sum += rng.int(1, sides);
      return sum;
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick on empty array');
      return items[rng.int(0, items.length - 1)]!;
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [items[i], items[j]] = [items[j]!, items[i]!];
      }
      return items;
    },
    weighted(items, weight) {
      if (items.length === 0) throw new Error('rng.weighted on empty array');
      let total = 0;
      for (const item of items) total += Math.max(0, weight(item));
      if (total <= 0) return rng.pick(items);
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll < 0) return item;
      }
      return items[items.length - 1]!;
    },
    derive(label) {
      return makeRng(`${seed}::${label}`);
    },
  };
  return rng;
}

/** The canonical stream for a run: `stream(seed, 'worldgen')`. */
export function stream(seed: string, name: StreamName): Rng {
  return makeRng(`${seed}#${name}`);
}

const SEED_FIRST = [
  'grim',
  'salt',
  'raven',
  'storm',
  'ash',
  'iron',
  'frost',
  'wolf',
  'amber',
  'stone',
];
const SEED_SECOND = [
  'fjord',
  'holm',
  'vik',
  'ness',
  'skerry',
  'dale',
  'strand',
  'fell',
  'mark',
  'sund',
];

/** Human-sayable seed, e.g. "raven-skerry-317". Caller supplies entropy. */
export function makeSeedPhrase(entropy: number): string {
  const r = makeRng(String(entropy));
  return `${r.pick(SEED_FIRST)}-${r.pick(SEED_SECOND)}-${r.int(100, 999)}`;
}

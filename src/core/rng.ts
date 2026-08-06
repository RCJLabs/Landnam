// Seeded, forkable PRNG. All game randomness flows through this — never
// Math.random() — so runs are reproducible from their seed string.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Sum of n dice with `sides` sides (e.g. roll(2, 6) = 2d6). */
  roll(n: number, sides: number): number;
  /** true with probability p. */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  weightedPick<T>(arr: readonly T[], weight: (item: T) => number): T;
  /** Derive an independent stream; drawing from it never affects this one. */
  fork(stream: string): Rng;
}

/** 32-bit string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SeededRng implements Rng {
  private gen: () => number;
  private seedStr: string;

  constructor(seedStr: string) {
    this.seedStr = seedStr;
    this.gen = mulberry32(hashString(seedStr));
  }

  next(): number {
    return this.gen();
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  roll(n: number, sides: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += this.int(1, sides);
    return sum;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick from empty array');
    return arr[this.int(0, arr.length - 1)]!;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  weightedPick<T>(arr: readonly T[], weight: (item: T) => number): T {
    if (arr.length === 0) throw new Error('weightedPick from empty array');
    let total = 0;
    for (const item of arr) total += Math.max(0, weight(item));
    if (total <= 0) return this.pick(arr);
    let roll = this.next() * total;
    for (const item of arr) {
      roll -= Math.max(0, weight(item));
      if (roll < 0) return item;
    }
    return arr[arr.length - 1]!;
  }

  fork(stream: string): Rng {
    return new SeededRng(`${this.seedStr}::${stream}`);
  }
}

export function makeRng(seed: string): Rng {
  return new SeededRng(seed);
}

/** Human-friendly seed like "hrafn-storm-42" from an entropy number the caller provides. */
export function generateSeed(entropy: number): string {
  const a = ['hrafn', 'ulf', 'bjorn', 'orm', 'skjold', 'vind', 'sol', 'mani', 'thor', 'freyja'];
  const b = ['storm', 'vag', 'fjord', 'salt', 'hval', 'nord', 'vest', 'strand', 'holm', 'sker'];
  const r = makeRng(String(entropy));
  return `${r.pick(a)}-${r.pick(b)}-${r.int(1, 999)}`;
}

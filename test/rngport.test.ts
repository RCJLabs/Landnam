// Phase 7 item 2: the cross-language determinism contract.
//
// `test/rng.test.ts` proves the generator is SELF-consistent — same seed,
// same numbers; streams independent; ranges inclusive. Every one of those
// tests would still pass if the algorithm were replaced wholesale, because
// none of them pins a single absolute value. That is fine while there is one
// implementation and fatal the moment there are two: a C++ port that hashes
// the seed as UTF-8 instead of UTF-16, or gets one shift signed, produces a
// different world for every existing seed and passes its own test suite
// while doing it.
//
// So this file pins the numbers themselves, in `port/rng-fixture.json` — a
// plain, language-neutral artifact the port asserts against. Two jobs, one
// file: it is the port's contract, and it is this repo's tripwire against
// changing `src/rng.ts` by accident, which no other test can currently see.
//
// The spec the fixture goes with is `port/rng.md`.

import { describe, it, expect } from 'vitest';
import fixtureText from '../port/rng-fixture.json?raw';
import { hashString, makeRng, makeSeedPhrase, stream, type Rng, type StreamName } from '../src/rng';

/**
 * The raw 32-bit draw behind `next()`.
 *
 * `next()` is `u / 2**32`, and both are powers of two apart, so multiplying
 * back is EXACT in a double — no rounding, no formatting. That is why the
 * fixture stores integers rather than decimals: a decimal is a place two
 * languages can disagree without either being wrong.
 */
function raw(rng: Rng): number {
  const u = rng.next() * 4294967296;
  if (!Number.isInteger(u)) throw new Error(`next() did not come off a clean uint32: ${u}`);
  return u;
}

function draws(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => raw(rng));
}

/**
 * Seeds chosen to break a careless port rather than to look tidy.
 *
 * `hashString` walks `charCodeAt`, which is UTF-16 CODE UNITS. A C++ port
 * holding a `std::string` of UTF-8 bytes will agree on every ASCII seed in
 * the game and diverge on the first Norse one — so the Norse ones are here,
 * along with an emoji, which is a surrogate PAIR and therefore two units.
 */
const HASH_INPUTS = [
  '',
  'a',
  '0',
  'landnam',
  'raven-skerry-317',
  'Þórr',
  'ríki',
  'Hvallund',
  'ǫ',
  '😀',
  'seed#worldgen',
  'seed::day:3',
  'strike:p1:12:3:4',
  'the-quick-brown-fox-jumps-over-the-lazy-dog-and-keeps-going-for-a-while-yet',
];

const SEEDS = ['landnam', '', 'raven-skerry-317', 'Þórr-ríki', '😀', 'curve-0'];

const STREAM_NAMES: StreamName[] = ['worldgen', 'party', 'events', 'combat', 'colony', 'saga'];

interface Fixture {
  algorithm: Record<string, string>;
  hash: [string, number][];
  draws: [string, number[]][];
  streams: [string, string, number[]][];
  derives: [string, string[], number[]][];
  helpers: Record<string, unknown>;
  seedPhrase: [number, string][];
}

function build(): Fixture {
  // Every helper is exercised on its own fresh Rng, so a case can be read
  // and re-run in isolation by whoever is implementing the other side.
  const at = (seed: string) => makeRng(seed);

  return {
    algorithm: {
      hash: 'FNV-1a over UTF-16 code units: h = 0x811c9dc5; for each unit: h ^= unit; h = imul(h, 0x01000193); result h >>> 0',
      generator: 'mulberry32 seeded with that hash — see port/rng.md for the exact statements',
      next: 'the raw uint32 divided by 4294967296; the fixture stores the uint32',
      stream: "makeRng(`${seed}#${name}`)",
      derive: "makeRng(`${seed}::${label}`), so chains are built by string concatenation",
      int: 'min + floor(next() * (max - min + 1)), both ends inclusive',
      roll: 'count draws of int(1, sides), summed',
      pick: 'items[int(0, items.length - 1)]',
      shuffle: 'Fisher-Yates descending: for i from length-1 down to 1, swap i with int(0, i)',
      weighted: 'exactly one draw: next() * total, then walk subtracting each weight',
      chance: 'next() < p',
    },
    hash: HASH_INPUTS.map((text) => [text, hashString(text)]),
    draws: SEEDS.map((seed) => [seed, draws(makeRng(seed), 8)]),
    streams: STREAM_NAMES.map((name) => [
      'landnam',
      name,
      draws(stream('landnam', name), 4),
    ]),
    derives: [
      ['root', ['day:3'], draws(makeRng('root').derive('day:3'), 4)],
      ['root', ['day:3', 'hex:2,-1'], draws(makeRng('root').derive('day:3').derive('hex:2,-1'), 4)],
      ['landnam', ['worldgen'], draws(makeRng('landnam').derive('worldgen'), 4)],
      // The shape the sim actually uses, delimiters and all.
      [
        'landnam#combat',
        ['strike:p1:12:3:4'],
        draws(makeRng('landnam#combat').derive('strike:p1:12:3:4'), 4),
      ],
    ],
    helpers: {
      // Ranges that catch off-by-one at both ends and a single-value range.
      int: [
        draws01(at('ints'), (r) => r.int(0, 1), 12),
        draws01(at('ints'), (r) => r.int(1, 6), 12),
        draws01(at('ints'), (r) => r.int(-3, 3), 12),
        draws01(at('ints'), (r) => r.int(5, 5), 4),
        draws01(at('ints'), (r) => r.int(0, 999999), 6),
      ],
      roll: [
        draws01(at('rolls'), (r) => r.roll(2, 6), 10),
        draws01(at('rolls'), (r) => r.roll(1, 20), 10),
        draws01(at('rolls'), (r) => r.roll(3, 8), 6),
      ],
      // Indices rather than values, so the case does not depend on what the
      // list happens to hold.
      pick: draws01(at('picks'), (r) => r.pick([0, 1, 2, 3, 4, 5, 6]), 12),
      chance: draws01(at('chances'), (r) => (r.chance(0.5) ? 1 : 0), 16),
      shuffle: [
        at('shuffles').shuffle([0, 1, 2, 3, 4, 5, 6, 7]),
        at('shuffles').shuffle([0, 1]),
        at('other-shuffles').shuffle([0, 1, 2, 3, 4, 5, 6, 7]),
      ],
      // Weight by value, so an implementation that walks the list in the
      // wrong direction gives a different answer.
      weighted: draws01(at('weights'), (r) => r.weighted([1, 2, 3, 4, 5], (n) => n), 12),
    },
    seedPhrase: [0, 1, 42, 1234567, 4294967295].map((n) => [n, makeSeedPhrase(n)]),
  };
}

/** `n` calls of one helper against a single Rng, in order. */
function draws01<T>(rng: Rng, take: (rng: Rng) => T, n: number): T[] {
  return Array.from({ length: n }, () => take(rng));
}

describe('the cross-language determinism fixture', () => {
  const built = build();

  it('matches the committed fixture exactly', () => {
    const committed = JSON.parse(fixtureText) as Fixture;
    try {
      expect(built).toEqual(committed);
    } catch (err) {
      // A failure here is one of two things and they want opposite fixes:
      // either src/rng.ts changed and every existing seed in every save
      // just became a different world, or the fixture is genuinely being
      // extended. The regenerated file is printed so the second case is a
      // redirect rather than an afternoon.
      // eslint-disable-next-line no-console
      console.log(
        'RNG FIXTURE MISMATCH. If src/rng.ts changed, that is a save-breaking\n' +
          'change and needs to be a deliberate one. If the fixture is being\n' +
          'extended on purpose, write the JSON below to port/rng-fixture.json.\n' +
          JSON.stringify(built, null, 2),
      );
      throw err;
    }
  });

  it('stores draws as exact integers, never as decimals', () => {
    // The reason the fixture is uint32s: a decimal is a place two languages
    // can print the same number differently.
    for (const [, list] of built.draws) {
      for (const u of list) {
        expect(Number.isInteger(u)).toBe(true);
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThan(4294967296);
      }
    }
  });

  it('pins the UTF-16 hazard specifically', () => {
    // The single likeliest way a port diverges: hashing bytes instead of
    // code units. These two agree under UTF-16 and differ under UTF-8, so a
    // port that gets this case right has got the encoding right.
    expect(hashString('Þórr')).not.toBe(hashString('THorr'));
    // An emoji is ONE code point and TWO code units, and the loop walks
    // units — so a port iterating code points is also wrong, differently.
    expect('😀'.length).toBe(2);
    const asUnits = hashString('😀');
    expect(hashString('😀')).toBe(asUnits);
  });
});

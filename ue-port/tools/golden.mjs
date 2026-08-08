// Dumps golden vectors from the REAL src/hex and src/rng, for the Unreal parity
// test to check its C++ port against. Nothing here reimplements the algorithms —
// it only calls them, so the vectors cannot drift from the shipping game.
//
//   node ue-port/tools/golden.mjs
//
// Writes ue-port/Content/Data/golden.json. Deterministic: running it twice
// produces a byte-identical file.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadGame, repoRoot } from './load-game.mjs';

const outFile = resolve(repoRoot, 'ue-port/Content/Data/golden.json');

const { Hex, Rng } = await loadGame({ Hex: './src/hex/index.ts', Rng: './src/rng.ts' });

// ---- shared helpers ----

const h = (q, r) => ({ q, r });
const ORIGIN = h(0, 0);

/**
 * The cost field the pathfinding vectors are measured over. Pure integer
 * arithmetic so C++ reproduces it exactly: JS and C++ both truncate % toward zero.
 * Bounded to radius 12 so an unreachable goal terminates instead of searching forever.
 */
function cost(hex) {
  if (Hex.distance(hex, ORIGIN) > 12) return Infinity;
  if ((hex.q * 7 + hex.r * 13) % 5 === 0) return Infinity;
  return 1 + ((((hex.q * 3 + hex.r * 5) % 4) + 4) % 4);
}

/** next() is raw/2^32; the division is exact in binary, so this recovers the raw uint32. */
const rawOf = (value) => value * 4294967296;

// ---- hex vectors ----

const roundCases = [];
for (let i = -6; i <= 6; i++) {
  for (let j = -6; j <= 6; j++) {
    // Thirds and halves land on the tie boundaries where rounding rules matter.
    const qf = i * 0.5 + j * 0.16666666666666666;
    const rf = j * 0.5 - i * 0.3333333333333333;
    const out = Hex.round(qf, rf);
    roundCases.push({ qf, rf, q: out.q, r: out.r });
  }
}

const SIZE = 100;
const pixelCases = [];
for (let q = -5; q <= 5; q++) {
  for (let r = -5; r <= 5; r++) {
    const p = Hex.toPixel(h(q, r), SIZE);
    pixelCases.push({ q, r, x: p.x, y: p.y });
  }
}

const fromPixelCases = [];
for (let i = -10; i <= 10; i++) {
  for (let j = -10; j <= 10; j++) {
    const x = i * 37.5;
    const y = j * 41.25;
    const out = Hex.fromPixel(x, y, SIZE);
    fromPixelCases.push({ x, y, q: out.q, r: out.r });
  }
}

const pairs = [];
for (let i = -7; i <= 7; i += 1) {
  for (let j = -7; j <= 7; j += 1) {
    pairs.push([h(i, j), h(j - 2, -i + 3)]);
  }
}

const distanceCases = pairs.map(([a, b]) => ({
  aq: a.q, ar: a.r, bq: b.q, br: b.r, d: Hex.distance(a, b),
}));

const lineCases = pairs.map(([a, b]) => ({
  aq: a.q, ar: a.r, bq: b.q, br: b.r,
  hexes: Hex.line(a, b).map((x) => [x.q, x.r]),
}));

const neighborCases = [];
for (let q = -3; q <= 3; q++) {
  for (let r = -3; r <= 3; r++) {
    const at = h(q, r);
    neighborCases.push({
      q, r,
      neighbors: Hex.neighbors(at).map((n) => [n.q, n.r]),
      // -1 for every non-adjacent probe, 0..5 for the six that touch.
      directionTo: [...Hex.neighbors(at), h(q + 2, r), at].map((probe) => Hex.directionTo(at, probe)),
    });
  }
}

const ringCases = [];
const rangeCases = [];
for (const radius of [0, 1, 2, 3, 5, 8]) {
  for (const centre of [ORIGIN, h(3, -2), h(-4, 6)]) {
    ringCases.push({
      cq: centre.q, cr: centre.r, radius,
      hexes: Hex.ring(centre, radius).map((x) => [x.q, x.r]),
    });
    rangeCases.push({
      cq: centre.q, cr: centre.r, radius,
      hexes: Hex.range(centre, radius).map((x) => [x.q, x.r]),
    });
  }
}

const offsetCases = [];
for (let col = -6; col <= 6; col++) {
  for (let row = -6; row <= 6; row++) {
    const axial = Hex.offsetToAxial(col, row);
    const back = Hex.axialToOffset(axial);
    offsetCases.push({
      col, row, q: axial.q, r: axial.r,
      backCol: back.col, backRow: back.row, column: Hex.column(axial),
    });
  }
}

// Starts and goals chosen to cover reachable, blocked-goal and walled-off outcomes.
const pathProbes = [
  [h(-6, 2), h(6, -2)],
  [h(-6, 2), h(0, 0)],
  [h(1, 1), h(-3, -3)],
  [h(4, 4), h(4, 4)],
  [h(-2, 7), h(7, -7)],
  [h(0, 1), h(11, 0)],
  [h(0, 1), h(30, 30)],
  [h(3, -5), h(-5, 3)],
];

const pathCases = pathProbes.map(([start, goal]) => {
  const p = Hex.findPath(start, goal, cost);
  return {
    sq: start.q, sr: start.r, gq: goal.q, gr: goal.r,
    reachable: Number.isFinite(p.cost),
    cost: Number.isFinite(p.cost) ? p.cost : -1,
    hexes: p.hexes.map((x) => [x.q, x.r]),
  };
});

const reachableCases = [h(-6, 2), h(1, 1), h(3, -5)].flatMap((start) =>
  [3, 6, 10].map((budget) => {
    const map = Hex.reachable(start, budget, cost);
    // Sort by key so the vector order is stable; the C++ test sorts the same way.
    const entries = [...map.entries()]
      .map(([k, c]) => {
        const at = Hex.fromKey(k);
        return { q: at.q, r: at.r, cost: c };
      })
      .sort((a, b) => (a.q - b.q) || (a.r - b.r));
    return { sq: start.q, sr: start.r, budget, entries };
  }),
);

// ---- rng vectors ----

const hashCases = [
  '', 'a', 'raven-skerry-317', 'raven-skerry-317#worldgen',
  'grim-fjord-100', 'landnam', '0', '12345', 'worldgen', 'combat',
  'raven-skerry-317#combat::turn:5',
].map((text) => ({ text, hash: Rng.hashString(text) }));

const STREAM_NAMES = ['worldgen', 'party', 'events', 'combat', 'colony', 'saga'];
const SEED = 'raven-skerry-317';
const DRAWS = 250;

const streamCases = STREAM_NAMES.map((name) => {
  // A fresh generator per measurement, so each list starts from the seed.
  const nextRaw = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < DRAWS; i++) nextRaw.push(rawOf(r.next()));
  }

  const ints = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 60; i++) ints.push(r.int(1, 6));
  }

  const wideInts = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 40; i++) wideInts.push(r.int(-50, 250));
  }

  const rolls = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 30; i++) rolls.push(r.roll(2, 6));
  }

  const chances = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 40; i++) chances.push(r.chance(0.3));
  }

  const floats = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 20; i++) floats.push(r.float(-2.5, 7.5));
  }

  const shuffles = [];
  {
    const r = Rng.stream(SEED, name);
    for (let i = 0; i < 5; i++) {
      shuffles.push(r.shuffle([...Array(10).keys()]));
    }
  }

  const weights = [3, 0, 1.5, 7, 0.25, 12];
  const weighted = [];
  {
    const r = Rng.stream(SEED, name);
    const items = weights.map((_, i) => i);
    for (let i = 0; i < 40; i++) weighted.push(r.weighted(items, (i2) => weights[i2]));
  }

  const derived = [];
  {
    const r = Rng.stream(SEED, name);
    for (const label of ['turn:1', 'turn:5', 'hex:3,-2']) {
      const d = r.derive(label);
      derived.push({ label, seed: `${SEED}#${name}::${label}`, raw: [0, 1, 2, 3, 4].map(() => rawOf(d.next())) });
    }
  }

  return { name, seed: `${SEED}#${name}`, nextRaw, ints, wideInts, rolls, chances, floats, shuffles, weights, weighted, derived };
});

const seedPhrases = [0, 1, 42, 12345, 999999, 2147483647].map((entropy) => ({
  entropy, phrase: Rng.makeSeedPhrase(entropy),
}));

// ---- write ----

const golden = {
  note: 'Generated by ue-port/tools/golden.mjs from src/hex and src/rng. Do not hand-edit.',
  drawsPerStream: DRAWS,
  hexSize: SIZE,
  hex: {
    round: roundCases,
    toPixel: pixelCases,
    fromPixel: fromPixelCases,
    distance: distanceCases,
    line: lineCases,
    neighbors: neighborCases,
    ring: ringCases,
    range: rangeCases,
    offset: offsetCases,
    path: pathCases,
    reachable: reachableCases,
  },
  rng: {
    hashString: hashCases,
    streams: streamCases,
    seedPhrases,
  },
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(golden, null, 1)}\n`);

const counts = Object.entries(golden.hex).map(([k, v]) => `${k} ${v.length}`).join(', ');
console.log(`wrote ${outFile}`);
console.log(`  hex: ${counts}`);
console.log(`  rng: ${hashCases.length} hashes, ${streamCases.length} streams x ${DRAWS} draws, ${seedPhrases.length} phrases`);

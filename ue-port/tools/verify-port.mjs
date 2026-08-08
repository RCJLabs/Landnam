// Checks the C++ port's ALGORITHMS against the golden vectors, without needing
// Unreal installed.
//
//   node ue-port/tools/verify-port.mjs
//
// Everything below is a line-for-line transliteration of ue-port/Source/LandnamHex.cpp
// and LandnamRng.cpp — the uint32 generator, the hand-rolled binary heap, the
// half-up rounding. If this passes, the algorithms are right and any remaining
// problem in Unreal is a compile error, not a behavioural one. It is deliberately
// NOT an import of src/hex or src/rng: importing the original would only prove the
// original agrees with itself.
//
// KNOWN BLIND SPOT — precision. JavaScript has one number type, a double, so this
// file cannot see a narrowing that only exists in C++. `FloatRange` originally
// returned `float`, computing in double and throwing away half the mantissa on the
// way out; every check here passed while Unreal was wrong in the seventh digit, and
// only the real automation test caught it. If a `static_cast<float>` or a `float`
// return is ever reintroduced on the C++ side, model it here with `Math.fround()`
// at exactly that point — that is the only way this harness can represent one.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(resolve(here, '../Content/Data/golden.json'), 'utf8'));

// ---------------------------------------------------------------- LandnamHex.cpp

const SQRT3 = Math.sqrt(3);
const IMPASSABLE = Number.MAX_VALUE;
const isPassable = (cost) => cost < IMPASSABLE;

/** FMath::FloorToDouble(V + 0.5) */
const roundHalfUp = (v) => Math.floor(v + 0.5);

const keyOf = (h) => `${h.q},${h.r}`;

function hexRound(qf, rf) {
  const sf = -qf - rf;
  let q = roundHalfUp(qf);
  let r = roundHalfUp(rf);
  const s = roundHalfUp(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q | 0, r: r | 0 }; // static_cast<int32>
}

const hexToPixel = (h, size) => ({
  x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
  y: size * 1.5 * h.r,
});

function hexFromPixel(x, y, size) {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const rf = ((2 / 3) * y) / size;
  return hexRound(qf, rf);
}

const hexToWorld = (h, size, z = 0) => {
  const p = hexToPixel(h, size);
  return { x: -p.y, y: p.x, z };
};

const hexFromWorld = (loc, size) => hexFromPixel(loc.y, -loc.x, size);

const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

function hexNeighbor(h, direction) {
  const d = DIRECTIONS[((direction % 6) + 6) % 6];
  return { q: h.q + d.q, r: h.r + d.r };
}

const hexNeighbors = (h) => DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.trunc((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

function hexDirectionTo(a, b) {
  for (let i = 0; i < DIRECTIONS.length; i++) {
    if (a.q + DIRECTIONS[i].q === b.q && a.r + DIRECTIONS[i].r === b.r) return i;
  }
  return -1;
}

function hexRing(centre, radius) {
  if (radius <= 0) return [{ ...centre }];
  const out = [];
  let h = { q: centre.q - radius, r: centre.r + radius };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push({ ...h });
      h = hexNeighbor(h, side);
    }
  }
  return out;
}

function hexRange(centre, radius) {
  const out = [];
  for (let rr = 0; rr <= radius; rr++) out.push(...hexRing(centre, rr));
  return out;
}

function hexLine(a, b) {
  const n = hexDistance(a, b);
  if (n === 0) return [{ ...a }];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(hexRound(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

const offsetToAxial = (col, row) => ({ q: col - ((row - (row & 1)) >> 1), r: row });
const axialToOffset = (h) => ({ col: h.q + ((h.r - (h.r & 1)) >> 1), row: h.r });
const hexColumn = (h) => h.q + ((h.r - (h.r & 1)) >> 1);

// The hand-rolled heap, ported verbatim so tie-breaking matches.

function heapPush(heap, entry) {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].priority <= heap[i].priority) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function heapPop(heap) {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < heap.length && heap[l].priority < heap[smallest].priority) smallest = l;
      if (r < heap.length && heap[r].priority < heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }
  return top;
}

function findPath(start, goal, cost) {
  if (start.q === goal.q && start.r === goal.r) {
    return { hexes: [{ ...start }], cost: 0, reachable: true };
  }
  if (!isPassable(cost(goal))) return { hexes: [], cost: -1, reachable: false };

  const gScore = new Map([[keyOf(start), 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  const open = [];
  heapPush(open, { hex: start, priority: hexDistance(start, goal) });

  for (;;) {
    const current = heapPop(open);
    if (current === undefined) break;
    const ck = keyOf(current.hex);
    if (closed.has(ck)) continue;

    if (ck === keyOf(goal)) {
      const reversed = [];
      let step = goal;
      for (;;) {
        reversed.push(step);
        const prev = cameFrom.get(keyOf(step));
        if (prev === undefined) break;
        step = prev;
      }
      reversed.reverse();
      return { hexes: reversed, cost: gScore.get(keyOf(goal)), reachable: true };
    }
    closed.add(ck);

    const g = gScore.get(ck);
    for (const next of hexNeighbors(current.hex)) {
      const nk = keyOf(next);
      if (closed.has(nk)) continue;
      const stepCost = cost(next);
      if (!isPassable(stepCost)) continue;
      const tentative = g + stepCost;
      const known = gScore.get(nk);
      if (known === undefined || tentative < known) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, current.hex);
        heapPush(open, { hex: next, priority: tentative + hexDistance(next, goal) });
      }
    }
  }
  return { hexes: [], cost: -1, reachable: false };
}

function reachable(start, budget, cost) {
  const best = new Map([[keyOf(start), 0]]);
  const frontier = [];
  heapPush(frontier, { hex: start, priority: 0 });

  for (;;) {
    const current = heapPop(frontier);
    if (current === undefined) break;
    const d = best.get(keyOf(current.hex));
    if (d === undefined || current.priority > d) continue;

    for (const next of hexNeighbors(current.hex)) {
      const stepCost = cost(next);
      if (!isPassable(stepCost)) continue;
      const total = current.priority + stepCost;
      if (total > budget) continue;
      const nk = keyOf(next);
      const known = best.get(nk);
      if (known === undefined || total < known) {
        best.set(nk, total);
        heapPush(frontier, { hex: next, priority: total });
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- LandnamRng.cpp

const SEED_FIRST = ['grim', 'salt', 'raven', 'storm', 'ash', 'iron', 'frost', 'wolf', 'amber', 'stone'];
const SEED_SECOND = ['fjord', 'holm', 'vik', 'ness', 'skerry', 'dale', 'strand', 'fell', 'mark', 'sund'];

/** uint32 multiply, as C++ `uint32 * uint32` wraps. */
const mul32 = (a, b) => Math.imul(a, b) >>> 0;

function hashString(text) {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash ^ text.charCodeAt(i)) >>> 0;
    hash = mul32(hash, 0x01000193);
  }
  return hash >>> 0;
}

class Rng {
  constructor(seed) {
    this.seed = seed;
    this.state = hashString(seed) >>> 0;
  }

  nextDouble() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = mul32(this.state ^ (this.state >>> 15), (1 | this.state) >>> 0);
    t = (((t + mul32(t ^ (t >>> 7), (61 | t) >>> 0)) >>> 0) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  intRange(min, max) {
    return min + Math.trunc(Math.floor(this.nextDouble() * (max - min + 1)));
  }

  floatRange(min, max) {
    return min + this.nextDouble() * (max - min);
  }

  chance(p) {
    return this.nextDouble() < p;
  }

  roll(count, sides) {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += this.intRange(1, sides);
    return sum;
  }

  pickIndex(num) {
    if (num <= 0) return -1;
    return this.intRange(0, num - 1);
  }

  shuffleIndices(num) {
    if (num <= 0) return [];
    const indices = [...Array(num).keys()];
    for (let i = num - 1; i > 0; i--) {
      const j = this.intRange(0, i);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  weightedIndex(weights) {
    if (weights.length === 0) return -1;
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return this.pickIndex(weights.length);
    let roll = this.nextDouble() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= Math.max(0, weights[i]);
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }

  derive(label) {
    return new Rng(`${this.seed}::${label}`);
  }
}

const makeStream = (seed, name) => new Rng(`${seed}#${name}`);

function makeSeedPhrase(entropy) {
  const rng = new Rng(String(entropy));
  const first = SEED_FIRST[rng.pickIndex(SEED_FIRST.length)];
  const second = SEED_SECOND[rng.pickIndex(SEED_SECOND.length)];
  return `${first}-${second}-${rng.intRange(100, 999)}`;
}

// ---------------------------------------------------------------- checks

const TOLERANCE = 1e-9;
let checked = 0;
let failed = 0;
const sections = [];

function section(name, body) {
  const before = { checked, failed };
  body();
  sections.push({ name, checked: checked - before.checked, failed: failed - before.failed });
}

function expect(condition, detail) {
  checked++;
  if (condition) return;
  failed++;
  if (failed <= 20) console.error(`  FAIL ${detail}`);
}

const expectInt = (got, want, detail) => expect(got === want, `${detail}: got ${got}, expected ${want}`);
const expectNear = (got, want, detail) =>
  expect(Math.abs(got - want) <= TOLERANCE, `${detail}: got ${got}, expected ${want}`);
const expectHexes = (got, want, detail) =>
  expect(
    got.length === want.length && got.every((h, i) => h.q === want[i][0] && h.r === want[i][1]),
    `${detail}: got [${got.map(keyOf).join(' ')}], expected [${want.map((p) => p.join(',')).join(' ')}]`,
  );

const SIZE = golden.hexSize;

/** Mirrors GoldenCost in LandnamParityTest.cpp. */
function goldenCost(h) {
  if (hexDistance(h, { q: 0, r: 0 }) > 12) return IMPASSABLE;
  if ((h.q * 7 + h.r * 13) % 5 === 0) return IMPASSABLE;
  return 1 + ((((h.q * 3 + h.r * 5) % 4) + 4) % 4);
}

section('hex.round', () => {
  for (const c of golden.hex.round) {
    const got = hexRound(c.qf, c.rf);
    expect(got.q === c.q && got.r === c.r, `round(${c.qf}, ${c.rf}): got ${keyOf(got)}, expected ${c.q},${c.r}`);
  }
});

section('hex.toPixel', () => {
  for (const c of golden.hex.toPixel) {
    const at = { q: c.q, r: c.r };
    const got = hexToPixel(at, SIZE);
    expectNear(got.x, c.x, `toPixel(${keyOf(at)}).x`);
    expectNear(got.y, c.y, `toPixel(${keyOf(at)}).y`);
    const back = hexFromWorld(hexToWorld(at, SIZE), SIZE);
    expect(back.q === at.q && back.r === at.r, `${keyOf(at)} did not survive toWorld/fromWorld`);
  }
});

section('hex.fromPixel', () => {
  for (const c of golden.hex.fromPixel) {
    const got = hexFromPixel(c.x, c.y, SIZE);
    expect(got.q === c.q && got.r === c.r,
      `fromPixel(${c.x}, ${c.y}): got ${keyOf(got)}, expected ${c.q},${c.r}`);
  }
});

section('hex.distance', () => {
  for (const c of golden.hex.distance) {
    expectInt(hexDistance({ q: c.aq, r: c.ar }, { q: c.bq, r: c.br }), c.d,
      `distance(${c.aq},${c.ar} -> ${c.bq},${c.br})`);
  }
});

section('hex.line', () => {
  for (const c of golden.hex.line) {
    expectHexes(hexLine({ q: c.aq, r: c.ar }, { q: c.bq, r: c.br }), c.hexes,
      `line(${c.aq},${c.ar} -> ${c.bq},${c.br})`);
  }
});

section('hex.neighbors', () => {
  for (const c of golden.hex.neighbors) {
    const at = { q: c.q, r: c.r };
    const got = hexNeighbors(at);
    expectHexes(got, c.neighbors, `neighbors(${keyOf(at)})`);

    const probes = [...got, { q: at.q + 2, r: at.r }, at];
    c.directionTo.forEach((want, i) => {
      expectInt(hexDirectionTo(at, probes[i]), want, `directionTo(${keyOf(at)}, ${keyOf(probes[i])})`);
    });
  }
});

section('hex.ring+range', () => {
  for (const c of golden.hex.ring) {
    expectHexes(hexRing({ q: c.cq, r: c.cr }, c.radius), c.hexes, `ring(${c.cq},${c.cr}, ${c.radius})`);
  }
  for (const c of golden.hex.range) {
    expectHexes(hexRange({ q: c.cq, r: c.cr }, c.radius), c.hexes, `range(${c.cq},${c.cr}, ${c.radius})`);
  }
});

section('hex.offset', () => {
  for (const c of golden.hex.offset) {
    const axial = offsetToAxial(c.col, c.row);
    expect(axial.q === c.q && axial.r === c.r,
      `offsetToAxial(${c.col}, ${c.row}): got ${keyOf(axial)}, expected ${c.q},${c.r}`);
    const back = axialToOffset(axial);
    expectInt(back.col, c.backCol, `axialToOffset(${keyOf(axial)}).col`);
    expectInt(back.row, c.backRow, `axialToOffset(${keyOf(axial)}).row`);
    expectInt(hexColumn(axial), c.column, `column(${keyOf(axial)})`);
  }
});

section('hex.findPath', () => {
  for (const c of golden.hex.path) {
    const label = `findPath(${c.sq},${c.sr} -> ${c.gq},${c.gr})`;
    const got = findPath({ q: c.sq, r: c.sr }, { q: c.gq, r: c.gr }, goldenCost);
    expect(got.reachable === c.reachable, `${label}: reachable ${got.reachable}, expected ${c.reachable}`);
    if (!c.reachable) continue;
    expectNear(got.cost, c.cost, `${label} cost`);
    expectHexes(got.hexes, c.hexes, `${label} route`);
  }
});

section('hex.reachable', () => {
  for (const c of golden.hex.reachable) {
    const label = `reachable(${c.sq},${c.sr}, ${c.budget})`;
    const got = reachable({ q: c.sq, r: c.sr }, c.budget, goldenCost);
    expectInt(got.size, c.entries.length, `${label} size`);
    for (const want of c.entries) {
      const gotCost = got.get(`${want.q},${want.r}`);
      if (gotCost === undefined) {
        expect(false, `${label}: missing ${want.q},${want.r}`);
        continue;
      }
      expectNear(gotCost, want.cost, `${label} cost at ${want.q},${want.r}`);
    }
  }
});

section('rng.hashString', () => {
  for (const c of golden.rng.hashString) {
    expectInt(hashString(c.text), c.hash, `hashString("${c.text}")`);
  }
});

section('rng.streams', () => {
  for (const c of golden.rng.streams) {
    expect(makeStream('raven-skerry-317', c.name).seed === c.seed, `${c.name} seed salting`);

    {
      const r = makeStream('raven-skerry-317', c.name);
      c.nextRaw.forEach((want, i) => {
        expectInt(r.nextDouble() * 4294967296, want, `${c.name} next() draw ${i}`);
      });
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.ints.forEach((want, i) => expectInt(r.intRange(1, 6), want, `${c.name} int draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.wideInts.forEach((want, i) => expectInt(r.intRange(-50, 250), want, `${c.name} wideInt draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.rolls.forEach((want, i) => expectInt(r.roll(2, 6), want, `${c.name} roll draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.chances.forEach((want, i) => expectInt(r.chance(0.3), want, `${c.name} chance draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.floats.forEach((want, i) => expectNear(r.floatRange(-2.5, 7.5), want, `${c.name} float draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.shuffles.forEach((want, s) => {
        const got = r.shuffleIndices(want.length);
        want.forEach((w, i) => expectInt(got[i], w, `${c.name} shuffle ${s} slot ${i}`));
      });
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      c.weighted.forEach((want, i) => expectInt(r.weightedIndex(c.weights), want, `${c.name} weighted draw ${i}`));
    }
    {
      const r = makeStream('raven-skerry-317', c.name);
      for (const d of c.derived) {
        const sub = r.derive(d.label);
        expect(sub.seed === d.seed, `${c.name} derive("${d.label}") seed: got ${sub.seed}, expected ${d.seed}`);
        d.raw.forEach((want, i) => {
          expectInt(sub.nextDouble() * 4294967296, want, `${c.name} derive("${d.label}") draw ${i}`);
        });
      }
    }
  }
});

section('rng.seedPhrase', () => {
  for (const c of golden.rng.seedPhrases) {
    expect(makeSeedPhrase(c.entropy) === c.phrase,
      `makeSeedPhrase(${c.entropy}): got ${makeSeedPhrase(c.entropy)}, expected ${c.phrase}`);
  }
});

// ---- report ----

for (const s of sections) {
  const mark = s.failed === 0 ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${s.name.padEnd(18)} ${String(s.checked).padStart(6)} checks${s.failed ? `, ${s.failed} failed` : ''}`);
}
console.log(`\n${checked} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

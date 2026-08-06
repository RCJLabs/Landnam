// North Atlantic chart generation. Anchor-band design: we hardcode where
// the island groups roughly live (jittered), then grow blobby landmasses,
// so every chart reads as the real crossing while differing in the details.

import { Axial, HexKey, key, neighbors, offsetToAxial } from '../core/hex';
import { findPath } from '../core/path';
import { Rng } from '../core/rng';
import { BALANCE } from '../content/balance';
import { MONASTERY_NAMES, PORT_NAMES, VILLAGE_NAMES } from '../content/names';
import { ChartTile, HexChart, Region, FeatureKind } from '../sim/types';

interface Anchor {
  region: Region;
  colMin: number;
  colMax: number;
  rowCenter: [number, number]; // jitter range
  blobs: [number, number]; // how many landmass blobs
  blobSize: [number, number]; // tiles per blob
}

const W = BALANCE.chart.width;
const H = BALANCE.chart.height;

const ANCHORS: Anchor[] = [
  { region: 'norway', colMin: W - 3, colMax: W - 1, rowCenter: [4, H - 5], blobs: [6, 8], blobSize: [6, 10] },
  { region: 'shetland', colMin: 33, colMax: 36, rowCenter: [14, 20], blobs: [2, 3], blobSize: [2, 4] },
  { region: 'faroes', colMin: 28, colMax: 31, rowCenter: [9, 14], blobs: [2, 4], blobSize: [1, 3] },
  { region: 'iceland', colMin: 20, colMax: 25, rowCenter: [5, 9], blobs: [1, 1], blobSize: [30, 40] },
  { region: 'greenland', colMin: 9, colMax: 15, rowCenter: [3, 6], blobs: [1, 1], blobSize: [45, 60] },
  { region: 'vinland', colMin: 0, colMax: 2, rowCenter: [12, 20], blobs: [3, 4], blobSize: [8, 14] },
];

// Feature placement per region: [kind, count-min, count-max][]
const FEATURE_TABLES: Record<Region, [FeatureKind, number, number][]> = {
  norway: [['village', 1, 1]],
  shetland: [['port', 1, 1], ['monastery', 1, 2]],
  faroes: [['port', 0, 1], ['monastery', 1, 2], ['village', 0, 1]],
  iceland: [['port', 1, 2], ['village', 1, 2]],
  greenland: [['port', 1, 1], ['mythic', 1, 1]],
  vinland: [['village', 1, 1]],
  openSea: [],
};

function inBounds(h: Axial): boolean {
  const col = h.q + ((h.r - (h.r & 1)) >> 1);
  return h.r >= 0 && h.r < H && col >= 0 && col < W;
}

function colOf(h: Axial): number {
  return h.q + ((h.r - (h.r & 1)) >> 1);
}

function dangerTierFor(col: number): 0 | 1 | 2 | 3 {
  const frac = 1 - col / (W - 1); // 0 at Norway (east), 1 at Vinland (west)
  if (frac < 0.3) return 0;
  if (frac < 0.55) return 1;
  if (frac < 0.8) return 2;
  return 3;
}

/** Random-walk blob growth from a center to (roughly) `size` tiles. */
function growBlob(rng: Rng, center: Axial, size: number): Set<HexKey> {
  const blob = new Set<HexKey>([key(center)]);
  let frontier: Axial[] = [center];
  let guard = size * 30;
  while (blob.size < size && guard-- > 0 && frontier.length > 0) {
    const from = rng.pick(frontier);
    const nb = rng.pick(neighbors(from));
    if (!inBounds(nb)) continue;
    const k = key(nb);
    if (!blob.has(k)) {
      blob.add(k);
      frontier.push(nb);
      // Occasionally re-center the frontier to keep blobs compact.
      if (frontier.length > 8) frontier = frontier.slice(-8);
    }
  }
  return blob;
}

function generateOnce(rng: Rng): HexChart | null {
  const tiles: Record<HexKey, ChartTile> = {};
  // 1. All sea to start.
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const h = offsetToAxial(col, row);
      tiles[key(h)] = { terrain: 'sea', region: 'openSea', dangerTier: dangerTierFor(col) };
    }
  }

  // 2. Stamp landmasses per anchor band.
  const regionOf = new Map<HexKey, Region>();
  for (const a of ANCHORS) {
    const blobCount = rng.int(a.blobs[0], a.blobs[1]);
    for (let b = 0; b < blobCount; b++) {
      const col = rng.int(a.colMin, a.colMax);
      const row =
        a.region === 'norway'
          ? Math.round(a.rowCenter[0] + ((a.rowCenter[1] - a.rowCenter[0]) * b) / Math.max(1, blobCount - 1))
          : rng.int(a.rowCenter[0], a.rowCenter[1]);
      const center = offsetToAxial(col, row);
      const blob = growBlob(rng, center, rng.int(a.blobSize[0], a.blobSize[1]));
      for (const k of blob) {
        const t = tiles[k];
        if (!t) continue;
        t.terrain = 'land';
        regionOf.set(k, a.region);
      }
    }
  }

  // 3. Erosion pass for ragged coasts.
  for (const [k, t] of Object.entries(tiles)) {
    if (t.terrain !== 'land') continue;
    const h = keyToAxial(k);
    const seaNbs = neighbors(h).filter((n) => tiles[key(n)]?.terrain !== 'land').length;
    if (seaNbs >= 4 && rng.chance(0.4)) t.terrain = 'sea';
  }

  // 4. Greenland's north half is ice (impassable) — forces the southern rounding.
  for (const [k, t] of Object.entries(tiles)) {
    if (t.terrain !== 'land' || regionOf.get(k) !== 'greenland') continue;
    const h = keyToAxial(k);
    if (h.r < 8) t.terrain = 'ice';
  }
  // Also freeze the open sea along the far north edge west of Iceland.
  for (const [k, t] of Object.entries(tiles)) {
    const h = keyToAxial(k);
    if (t.terrain === 'sea' && h.r <= 1 && colOf(h) < 26) t.terrain = 'ice';
  }

  // 5. Regions + coast marking. Coast = sea tile adjacent to land (features live here).
  for (const [k, t] of Object.entries(tiles)) {
    const region = regionOf.get(k);
    if (region) t.region = region;
    if (t.terrain === 'sea') {
      const h = keyToAxial(k);
      const nearLand = neighbors(h).some((n) => {
        const nt = tiles[key(n)];
        return nt !== undefined && nt.terrain === 'land';
      });
      if (nearLand) {
        t.terrain = 'coast';
        // Coast tiles inherit the region of the land they touch.
        for (const n of neighbors(h)) {
          const r = regionOf.get(key(n));
          if (r) {
            t.region = r;
            break;
          }
        }
      } else if (rng.chance(0.25)) {
        t.terrain = 'deepSea';
      }
    }
  }

  // 6. Start (Norway coast, mid-height) and Vinland goal (west coast tile).
  const start = pickCoast(tiles, (h, t) => t.region === 'norway' && Math.abs(h.r - H / 2) < 6, rng);
  const vinland = pickCoast(tiles, (_h, t) => t.region === 'vinland', rng);
  if (!start || !vinland) return null;

  // 7. Navigability check.
  const sail = (h: Axial): number => {
    const t = tiles[key(h)];
    if (!t || t.terrain === 'land' || t.terrain === 'ice') return Infinity;
    return 1;
  };
  const { path } = findPath(start, vinland, sail);
  if (path.length === 0 || path.length < BALANCE.chart.pathMin || path.length > BALANCE.chart.pathMax) {
    return null;
  }

  // 8. Feature placement, min-spacing 3, on coast tiles of each region.
  const placed: Axial[] = [];
  const nameBags = {
    port: rng.shuffle([...PORT_NAMES]),
    monastery: rng.shuffle([...MONASTERY_NAMES]),
    village: rng.shuffle([...VILLAGE_NAMES]),
  };
  let featureN = 0;
  const placeFeature = (h: Axial, kind: FeatureKind, name: string) => {
    const t = tiles[key(h)]!;
    featureN += 1;
    t.feature = { kind, id: `${kind}_${featureN}`, name, used: false };
    placed.push(h);
  };

  placeFeature(start, 'home', 'Hafnarvik'); // home port
  for (const a of ANCHORS) {
    for (const [kind, lo, hi] of FEATURE_TABLES[a.region]) {
      const count = rng.int(lo, hi);
      for (let i = 0; i < count; i++) {
        const spot = pickCoast(
          tiles,
          (h, t) =>
            t.region === a.region &&
            !t.feature &&
            placed.every((p) => hexDist(p, h) >= 3),
          rng,
        );
        if (!spot) continue;
        const name =
          kind === 'port'
            ? nameBags.port.pop() ?? 'Harbor'
            : kind === 'monastery'
              ? nameBags.monastery.pop() ?? 'Lone Cell'
              : kind === 'village'
                ? nameBags.village.pop() ?? 'Small Stead'
                : kind === 'mythic'
                  ? 'Strange Waters'
                  : 'Wreck';
        placeFeature(spot, kind, name);
      }
    }
  }
  // A couple of open-sea wrecks and one mythic site in the western gaps.
  for (let i = 0; i < 2; i++) {
    const spot = pickTile(
      tiles,
      (h, t) =>
        (t.terrain === 'sea' || t.terrain === 'deepSea') &&
        !t.feature &&
        t.dangerTier >= 1 &&
        placed.every((p) => hexDist(p, h) >= 4),
      rng,
    );
    if (spot) placeFeature(spot, i === 0 ? 'mythic' : 'wreck', i === 0 ? 'Whirling Deep' : 'Broken Hull');
  }

  const chart: HexChart = {
    width: W,
    height: H,
    tiles,
    discovered: new Set(),
    shipAt: start,
    startAt: start,
    vinlandAt: vinland,
  };
  return chart;
}

function keyToAxial(k: string): Axial {
  const i = k.indexOf(',');
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

function hexDist(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function pickCoast(
  tiles: Record<HexKey, ChartTile>,
  pred: (h: Axial, t: ChartTile) => boolean,
  rng: Rng,
): Axial | null {
  return pickTile(tiles, (h, t) => t.terrain === 'coast' && pred(h, t), rng);
}

function pickTile(
  tiles: Record<HexKey, ChartTile>,
  pred: (h: Axial, t: ChartTile) => boolean,
  rng: Rng,
): Axial | null {
  const candidates: Axial[] = [];
  for (const [k, t] of Object.entries(tiles)) {
    const h = keyToAxial(k);
    if (pred(h, t)) candidates.push(h);
  }
  if (candidates.length === 0) return null;
  // Sort for determinism (Object.entries order is insertion order, which is
  // deterministic here, but be explicit anyway), then pick.
  candidates.sort((a, b) => a.r - b.r || a.q - b.q);
  return rng.pick(candidates);
}

/** Generate a chart, rerolling with derived seeds until navigable. */
export function generateChart(rng: Rng): HexChart {
  for (let attempt = 0; attempt < BALANCE.chart.maxRerolls; attempt++) {
    const chart = generateOnce(rng.fork(`attempt:${attempt}`));
    if (chart) return chart;
  }
  throw new Error('chart generation failed after max rerolls');
}

// Axial coordinates for pointy-top hexagons.
// q grows east, r grows south-east. See https://www.redblobgames.com/grids/hexagons/

export interface Axial {
  q: number;
  r: number;
}

export type HexKey = string; // `${q},${r}`

export function key(h: Axial): HexKey {
  return `${h.q},${h.r}`;
}

export function fromKey(k: HexKey): Axial {
  const i = k.indexOf(',');
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

export function eq(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

// Six neighbor directions, index 0 = east, counter-clockwise... actually
// ordered E, NE, NW, W, SW, SE so that (dir + 3) % 6 is the opposite.
export const DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function neighbor(h: Axial, dir: number): Axial {
  const d = DIRS[((dir % 6) + 6) % 6]!;
  return { q: h.q + d.q, r: h.r + d.r };
}

export function neighbors(h: Axial): Axial[] {
  return DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Direction index (0-5) from a toward adjacent hex b; -1 if not adjacent. */
export function dirTo(a: Axial, b: Axial): number {
  return DIRS.findIndex((d) => a.q + d.q === b.q && a.r + d.r === b.r);
}

/** All hexes exactly `radius` steps from center (radius 0 => [center]). */
export function ring(center: Axial, radius: number): Axial[] {
  if (radius === 0) return [{ ...center }];
  const out: Axial[] = [];
  // Start at "west * radius" then walk the six sides.
  let h: Axial = { q: center.q - radius, r: center.r + radius };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push({ ...h });
      h = neighbor(h, side);
    }
  }
  return out;
}

/** All hexes within `radius` steps of center, inclusive. */
export function spiral(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [];
  for (let rr = 0; rr <= radius; rr++) out.push(...ring(center, rr));
  return out;
}

/** Cube-lerp line from a to b, inclusive of both endpoints. */
export function line(a: Axial, b: Axial): Axial[] {
  const n = distance(a, b);
  if (n === 0) return [{ ...a }];
  const out: Axial[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Nudge off grid edges to break ties deterministically.
    const q = a.q + (b.q - a.q) * t + 1e-6;
    const r = a.r + (b.r - a.r) * t + 1e-6;
    out.push(round(q, r));
  }
  return out;
}

/** Round fractional axial coords to the nearest hex. */
export function round(qf: number, rf: number): Axial {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  // Normalize -0 so keys and deep-equals stay stable.
  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}

// --- Pixel conversion (pointy-top). `size` = center-to-corner radius. ---

const SQRT3 = Math.sqrt(3);

export function toPixel(h: Axial, size: number): { x: number; y: number } {
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * 1.5 * h.r,
  };
}

export function fromPixel(x: number, y: number, size: number): Axial {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const rf = ((2 / 3) * y) / size;
  return round(qf, rf);
}

/** The six corner points of a hex at pixel center (cx, cy). */
export function corners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

// --- Rectangular map helpers (odd-r offset shape stored as axial) ---
// We generate maps as a "rectangle" in offset space so the chart looks like
// a chart; conversion helpers keep procgen readable.

export function offsetToAxial(col: number, row: number): Axial {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

export function axialToOffset(h: Axial): { col: number; row: number } {
  return { col: h.q + ((h.r - (h.r & 1)) >> 1), row: h.r };
}

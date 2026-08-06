// Axial hex coordinates, pointy-top orientation.
// q grows east, r grows south-east. Reference: redblobgames.com/grids/hexagons

export interface Hex {
  q: number;
  r: number;
}

/** Stable string key for map/set storage. */
export type HexKey = string;

export function hex(q: number, r: number): Hex {
  return { q, r };
}

export function key(h: Hex): HexKey {
  return `${h.q},${h.r}`;
}

export function fromKey(k: HexKey): Hex {
  const i = k.indexOf(',');
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

export function equals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function add(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function subtract(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r };
}

/**
 * Round fractional axial coordinates to the nearest hex.
 * Normalizes -0 so keys and deep-equality stay stable.
 */
export function round(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}

const SQRT3 = Math.sqrt(3);

/** World-space center of a hex. `size` is center-to-corner radius. */
export function toPixel(h: Hex, size: number): { x: number; y: number } {
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * 1.5 * h.r,
  };
}

/** Inverse of toPixel: which hex contains this world-space point. */
export function fromPixel(x: number, y: number, size: number): Hex {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const rf = ((2 / 3) * y) / size;
  return round(qf, rf);
}

/** The six corner points of a hex centered at (cx, cy). */
export function corners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

/** SVG polygon `points` attribute for a hex at (cx, cy). */
export function cornerPoints(cx: number, cy: number, size: number): string {
  return corners(cx, cy, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

// Rectangular maps are authored in odd-r offset space (readable rows), then
// stored as axial. These convert between the two.

export function offsetToAxial(col: number, row: number): Hex {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

export function axialToOffset(h: Hex): { col: number; row: number } {
  return { col: h.q + ((h.r - (h.r & 1)) >> 1), row: h.r };
}

/** Column index in offset space — used for east/west reasoning on the map. */
export function column(h: Hex): number {
  return h.q + ((h.r - (h.r & 1)) >> 1);
}

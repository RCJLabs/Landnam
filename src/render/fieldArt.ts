// The battlefield's ground, drawn instead of filled.
//
// The field was five flat colours while the travel map had real country —
// and the fight's own log would say "they met us on wet sand" over a
// meadow-green grid, because the fills ignored `battle.terrain` entirely.
// Open ground now takes its base and its marks from the country the fight
// stands on, so a strandhögg happens on sand and an inland raid on grass.
//
// Same machinery as render/terrainArt.ts — seeded marks on the hex lattice,
// clipped-safe by construction — at the battle grid's own hex size. The
// patterns are built once into <defs> and referenced by fill string, for the
// same repaint reason terrainArt gives: a pattern is rasterised once, while
// per-hex glyph groups are destroyed and rebuilt on every paint.

import { makeRng } from '../rng';
import { terrainDef } from '../data/terrain';
import type { Ground, Terrain } from '../state/types';
import { ALL_TERRAINS } from '../data/terrain';
import { copies, latticeCentres, mix, scatter, type Mark } from './terrainArt';
import { svgEl } from './svg';

/**
 * The battle grid's hex size. render/battle.ts draws with this — one
 * constant, imported there, so the lattice these patterns tile on cannot
 * drift from the grid they are painted onto.
 */
export const FIELD_HEX = 30;
export const FIELD_INRADIUS = (Math.sqrt(3) / 2) * FIELD_HEX;
export const FIELD_TILE_W = 2 * Math.sqrt(3) * FIELD_HEX;
export const FIELD_TILE_H = 4 * 1.5 * FIELD_HEX;
export const FIELD_CENTRES = latticeCentres(FIELD_HEX);

const lighten = (hex: string, amount: number): string => mix(hex, '#ffffff', amount);
const darken = (hex: string, amount: number): string => mix(hex, '#000000', amount);

/**
 * What open ground on this country is made of, for the marks.
 *
 * Grass, sand or stone — the three things a cleared fighting ground can be.
 * Ocean maps to sand because the only fight that starts from the water is
 * the strandhögg, and its ground is the beach.
 */
export function footingOf(terrain: Terrain): 'grass' | 'sand' | 'stone' {
  if (terrain === 'shore' || terrain === 'ocean') return 'sand';
  if (terrain === 'mountains') return 'stone';
  return 'grass';
}

/**
 * The base colour open ground takes from its country: the travel fill,
 * pulled slightly into shadow so the field sits deeper than the map and the
 * shields stay the brightest thing on it.
 */
export function openBase(terrain: Terrain): string {
  return darken(terrainDef(terrain).fill, 0.16);
}

/**
 * Placement budgets per ground kind, exported for the clip bar: every
 * recipe's `spread + reach` must stay inside FIELD_INRADIUS, or a mark gets
 * sliced by its hex edge — the exact defect a real phone reported on the
 * travel map before terrainArt's tile-on-the-lattice fix.
 */
export const FIELD_RECIPES: Record<
  'open' | 'rough' | 'block' | 'water' | 'wall',
  { perHex: number; spread: number; reach: number }
> = {
  open: { perHex: 6, spread: 17, reach: 8 },
  rough: { perHex: 6, spread: 17, reach: 7 },
  block: { perHex: 5, spread: 18, reach: 5 },
  water: { perHex: 4, spread: 14, reach: 10 },
  wall: { perHex: 4, spread: 18, reach: 4 },
};

function grassTuft(x: number, y: number, mark: Mark, base: string): SVGElement {
  const h = 4.5 + mark.size * 3.5;
  const ink = mark.roll > 0.5 ? lighten(base, 0.4) : darken(base, 0.3);
  return svgEl('path', {
    d: `M ${x} ${y} l ${-h * 0.55} ${-h} M ${x} ${y} l 0 ${-h * 1.25} M ${x} ${y} l ${h * 0.55} ${-h * 0.9}`,
    fill: 'none',
    stroke: ink,
    'stroke-width': 1.2,
    'stroke-linecap': 'round',
    opacity: 0.7,
  });
}

function sandGrain(x: number, y: number, mark: Mark, base: string): SVGElement {
  const pebble = mark.roll > 0.72;
  const r = 0.9 + mark.size * 1.4;
  return svgEl('circle', {
    cx: x,
    cy: y,
    r: pebble ? r * 1.3 : r,
    fill: pebble ? darken(base, 0.34) : lighten(base, 0.3),
    opacity: pebble ? 0.7 : 0.55,
  });
}

function scree(x: number, y: number, mark: Mark, base: string): SVGElement {
  const r = 1.2 + mark.size * 1.8;
  return svgEl('path', {
    d: `M ${x - r} ${y + r * 0.6} l ${r * 0.8} ${-r * 1.4} l ${r * 1.2} ${r * 0.5} l ${-r * 0.6} ${r * 0.9} Z`,
    fill: mark.roll > 0.5 ? darken(base, 0.28) : lighten(base, 0.2),
    opacity: 0.65,
  });
}

function openMark(footing: 'grass' | 'sand' | 'stone') {
  return footing === 'grass' ? grassTuft : footing === 'sand' ? sandGrain : scree;
}

/** Broken ground: tussocks and stones together, the walk-slowly texture. */
function roughMark(x: number, y: number, mark: Mark, base: string): SVGElement {
  if (mark.roll > 0.55) {
    const h = 3.6 + mark.size * 3;
    return svgEl('path', {
      d: `M ${x - h * 0.4} ${y} l ${h * 0.4} ${-h} l ${h * 0.4} ${h} Z`,
      fill: '#8d8459',
      opacity: 0.6,
    });
  }
  return scree(x, y, mark, base);
}

/** Standing water: short crests, the ocean recipe's shape. */
function crest(x: number, y: number, mark: Mark, base: string): SVGElement {
  const w = 5 + mark.size * 4;
  return svgEl('path', {
    d: `M ${x - w} ${y} q ${w * 0.5} ${-2.2} ${w} 0 q ${w * 0.5} ${2.2} ${w} 0`,
    fill: 'none',
    stroke: lighten(base, 0.32),
    'stroke-width': 1.2,
    'stroke-linecap': 'round',
    opacity: 0.5 + mark.roll * 0.25,
  });
}

/** Trampled earth around the stakes: faint churn, nothing growing. */
function churn(x: number, y: number, mark: Mark, base: string): SVGElement {
  const r = 0.9 + mark.size * 1.1;
  return svgEl('circle', {
    cx: x,
    cy: y,
    r,
    fill: mark.roll > 0.5 ? darken(base, 0.25) : lighten(base, 0.18),
    opacity: 0.5,
  });
}

const GROUND_BASE: Record<Exclude<Ground, 'open'>, string> = {
  rough: '#6d6446',
  block: '#4a453c',
  water: '#2e5468',
  wall: '#4a3b28',
};

export function fieldPatternId(ground: Ground, terrain: Terrain): string {
  return ground === 'open' ? `field-open-${terrain}` : `field-${ground}`;
}

/** The fill for one battle hex: its ground's pattern, country-aware if open. */
export function fieldFill(ground: Ground, terrain: Terrain): string {
  return `url(#${fieldPatternId(ground, terrain)})`;
}

function buildFieldPattern(
  id: string,
  base: string,
  reach: number,
  marks: Mark[],
  draw: (x: number, y: number, mark: Mark, base: string) => SVGElement,
): SVGPatternElement {
  const pattern = svgEl('pattern', {
    id,
    patternUnits: 'userSpaceOnUse',
    width: FIELD_TILE_W,
    height: FIELD_TILE_H,
  });
  pattern.append(
    svgEl('rect', { x: 0, y: 0, width: FIELD_TILE_W, height: FIELD_TILE_H, fill: base }),
  );
  for (const mark of marks) {
    for (const at of copies(mark, reach, FIELD_TILE_W, FIELD_TILE_H)) {
      pattern.append(draw(at.x, at.y, mark, base));
    }
  }
  return pattern;
}

/**
 * Every ground pattern the field can ask for, built once into <defs>.
 *
 * Eight open variants — one per country a fight can stand on — plus the four
 * grounds that look the same everywhere. Seeded with a fixed label, exactly
 * as terrainArt is: decoration takes no run stream, so the same field looks
 * the same in every game and nothing in the sim can be disturbed by it.
 */
export function fieldPatterns(): SVGPatternElement[] {
  const art = makeRng('landnam-field-art');
  const out: SVGPatternElement[] = [];

  for (const terrain of ALL_TERRAINS) {
    const spec = FIELD_RECIPES.open;
    const marks = scatter(art.derive(`open:${terrain}`), spec.perHex, spec.spread, FIELD_CENTRES);
    out.push(
      buildFieldPattern(
        fieldPatternId('open', terrain),
        openBase(terrain),
        spec.reach,
        marks,
        openMark(footingOf(terrain)),
      ),
    );
  }

  const rest: [Exclude<Ground, 'open'>, (x: number, y: number, m: Mark, b: string) => SVGElement][] = [
    ['rough', roughMark],
    ['block', scree],
    ['water', crest],
    ['wall', churn],
  ];
  for (const [ground, draw] of rest) {
    const spec = FIELD_RECIPES[ground];
    const marks = scatter(art.derive(ground), spec.perHex, spec.spread, FIELD_CENTRES);
    out.push(
      buildFieldPattern(fieldPatternId(ground, 'meadow'), GROUND_BASE[ground], spec.reach, marks, draw),
    );
  }
  return out;
}

// ---- the light ----

/**
 * The low sun, in two gradients: a warm wash from the north-west and a
 * vignette that lets the corners fall away. One pair of <defs>, two rects a
 * paint — depth for the price of four nodes, and no filters, because
 * feTurbulence-class filters are the one genuinely expensive thing on a
 * phone GPU and nothing here needs one.
 */
export function lightDefs(): SVGElement[] {
  const sun = svgEl('linearGradient', { id: 'field-sun', x1: '0', y1: '0', x2: '1', y2: '1' });
  sun.append(
    svgEl('stop', { offset: '0', 'stop-color': '#ffe9b8', 'stop-opacity': 0.16 }),
    svgEl('stop', { offset: '0.5', 'stop-color': '#ffe9b8', 'stop-opacity': 0 }),
    svgEl('stop', { offset: '1', 'stop-color': '#0a1014', 'stop-opacity': 0.2 }),
  );
  const dusk = svgEl('radialGradient', { id: 'field-vignette', cx: '0.5', cy: '0.46', r: '0.72' });
  dusk.append(
    svgEl('stop', { offset: '0.62', 'stop-color': '#0a0806', 'stop-opacity': 0 }),
    svgEl('stop', { offset: '1', 'stop-color': '#0a0806', 'stop-opacity': 0.32 }),
  );
  return [sun, dusk];
}

/** The wash rect, sized to the field. Sits above the ground, below the men. */
export function sunWash(x: number, y: number, w: number, h: number): SVGElement {
  return svgEl('rect', { x, y, width: w, height: h, fill: 'url(#field-sun)' });
}

/** The vignette rect. Sits over everything; the fight happens in its centre. */
export function duskVignette(x: number, y: number, w: number, h: number): SVGElement {
  return svgEl('rect', { x, y, width: w, height: h, fill: 'url(#field-vignette)' });
}

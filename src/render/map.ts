// The chart: everything the band has seen, at a glance.
//
// The travel view is deliberately zoomed in so a hex clears a thumb. That
// makes it useless for the question "where have we been, and where is home
// from here?" — which is what this answers. Pure view: it reads state and
// draws, and closing it is the only thing it can do.

import { cornerPoints, distance, fromKey, toPixel, key, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import { exploredFraction } from '../sim/fog';
import type { GameState, Neighbour } from '../state/types';
import { clanKind, standingFor } from '../data/clans';
import { STANDING_INK } from './travel';
import { button, el, svgEl } from './svg';

const HEX = 10;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(hexes: Hex[]): Bounds | null {
  if (hexes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of hexes) {
    const p = toPixel(h, HEX);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** The route, oldest first. */
function route(state: GameState): { at: Hex; day: number }[] {
  return Object.entries(state.world.trod)
    .map(([k, day]) => ({ at: fromKey(k), day }))
    .sort((a, b) => a.day - b.day);
}

export function renderMap(state: GameState, close: () => void): HTMLElement {
  const world = state.world;
  const seenKeys = Object.keys(world.seen).filter((k) => world.tiles[k]);
  const seen = seenKeys.map(fromKey);

  const svg = svgEl('svg', {
    class: 'chart',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const layers = {
    land: svgEl('g'),
    trail: svgEl('g'),
    marks: svgEl('g'),
  };
  svg.append(layers.land, layers.trail, layers.marks);

  const bounds = boundsOf(seen);
  if (bounds) {
    const pad = HEX * 1.1;
    svg.setAttribute(
      'viewBox',
      `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${
        bounds.maxY - bounds.minY + pad * 2
      }`,
    );
  }

  // Everything laid eyes on. Remembered ground is dimmer than ground in
  // sight, the same convention the travel map uses.
  for (const k of seenKeys) {
    const tile = world.tiles[k]!;
    const def = terrainDef(tile.terrain);
    const p = toPixel(fromKey(k), HEX);
    layers.land.append(
      svgEl('polygon', {
        points: cornerPoints(p.x, p.y, HEX),
        fill: def.fill,
        stroke: def.edge,
        'stroke-width': 0.5,
        opacity: world.seen[k] === 'visible' ? 1 : 0.62,
      }),
    );
    if (tile.river) {
      layers.land.append(
        svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.2, fill: '#3f7d94', opacity: 0.8 }),
      );
    }
  }

  // The route. Segments are drawn only between hexes that are actually
  // adjacent: revisits are not re-recorded, so joining every pair in date
  // order would fling lines across the whole chart.
  const walked = route(state);
  for (let i = 1; i < walked.length; i++) {
    const from = walked[i - 1]!;
    const to = walked[i]!;
    if (distance(from.at, to.at) !== 1) continue;
    const a = toPixel(from.at, HEX);
    const b = toPixel(to.at, HEX);
    layers.trail.append(
      svgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: '#e8dcc0',
        'stroke-width': 1.6,
        opacity: 0.5,
      }),
    );
  }
  for (const step of walked) {
    const p = toPixel(step.at, HEX);
    layers.trail.append(
      svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.22, fill: '#e8dcc0', opacity: 0.55 }),
    );
  }

  // The knarr, where it all started.
  layers.marks.append(knarr(world.landing));

  const met = state.neighbours.filter((n) => n.found);
  for (const n of met) layers.marks.append(otherPlace(n));

  if (state.settlement) {
    layers.marks.append(hall(state.settlement.at));
  }
  layers.marks.append(hereToken(state.party.at));

  // --- The card around it ---

  const explored = Math.round(exploredFraction(world) * 100);
  const legend = el('div', { class: 'chart-legend' }, [
    legendItem('knarr', `${world.landingName || 'The landing'} — where we came ashore`),
    ...(state.settlement
      ? [legendItem('hall', `${state.settlement.name} — our steading`)]
      : []),
    legendItem('here', 'Where we are standing'),
    legendItem('trail', 'Ground we have walked'),
    // Named, with what they think of us — the chart is where the player
    // reads the coast's temper without having to walk it again.
    ...met.map((n) =>
      neighbourKey(n, `${n.name} — a ${clanKind(n.kind).noun} · ${standingFor(n.standing).label}`),
    ),
  ]);

  const card = el('div', { class: 'card chart-card' }, [
    el('h2', {}, ['The Chart']),
    el('p', { class: 'chart-note' }, [
      `Day ${state.day} · ${explored}% of the country seen · ${walked.length} hexes walked`,
    ]),
    el('div', { class: 'chart-frame' }, [svg]),
    legend,
    button('Close', close, { class: 'primary wide' }),
  ]);

  if (!bounds) {
    card.replaceChildren(
      el('h2', {}, ['The Chart']),
      el('p', { class: 'event-body' }, ['We have not looked around yet.']),
      button('Close', close, { class: 'primary wide' }),
    );
  }

  return el('div', { class: 'overlay' }, [card]);
}

/**
 * A legend whose swatches are the same glyphs the chart draws. Coloured
 * squares standing in for a ship and a hall would leave the player matching
 * shapes by guesswork.
 */
function legendItem(kind: 'knarr' | 'hall' | 'here' | 'trail', text: string): HTMLElement {
  const swatch = svgEl('svg', {
    class: `chart-swatch ${kind}`,
    viewBox: '-11 -11 22 22',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  if (kind === 'knarr') swatch.append(knarr({ q: 0, r: 0 }));
  else if (kind === 'hall') swatch.append(hall({ q: 0, r: 0 }));
  else if (kind === 'here') swatch.append(hereToken({ q: 0, r: 0 }));
  else {
    swatch.append(
      svgEl('line', {
        x1: -8, y1: 0, x2: 8, y2: 0,
        stroke: '#e8dcc0', 'stroke-width': 1.6, opacity: 0.55,
      }),
      svgEl('circle', { cx: 0, cy: 0, r: HEX * 0.22, fill: '#e8dcc0', opacity: 0.55 }),
    );
  }
  return el('div', { class: 'chart-key' }, [swatch, el('span', {}, [text])]);
}

/** Somebody else's place, inked by what they think of us. */
function otherPlace(n: Neighbour, at: Hex = n.at): SVGGElement {
  const p = toPixel(at, HEX);
  const ink = STANDING_INK[standingFor(n.standing).id] ?? '#b6a06a';
  const g = svgEl('g', { class: 'mark-other' });
  const r = HEX * 0.55;
  g.append(
    clanKind(n.kind).id === 'native'
      ? svgEl('path', {
          d: `M ${p.x} ${p.y - r} L ${p.x - r} ${p.y + r * 0.8} L ${p.x + r} ${p.y + r * 0.8} Z`,
          fill: '#2a2318',
          stroke: ink,
          'stroke-width': 1.4,
        })
      : svgEl('path', {
          d:
            `M ${p.x - r} ${p.y + r * 0.6} L ${p.x - r} ${p.y} ` +
            `Q ${p.x} ${p.y - r * 1.2} ${p.x + r} ${p.y} ` +
            `L ${p.x + r} ${p.y + r * 0.6} Z`,
          fill: '#2a2318',
          stroke: ink,
          'stroke-width': 1.4,
        }),
  );
  return g;
}

/** A legend row for one neighbour, drawn with the same glyph as the chart. */
function neighbourKey(n: Neighbour, text: string): HTMLElement {
  const swatch = svgEl('svg', {
    class: 'chart-swatch other',
    viewBox: '-11 -11 22 22',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  swatch.append(otherPlace(n, { q: 0, r: 0 }));
  return el('div', { class: 'chart-key' }, [swatch, el('span', {}, [text])]);
}

/** A beached ship: two strokes, readable at ten pixels. */
function knarr(at: Hex): SVGGElement {
  const p = toPixel(at, HEX);
  const g = svgEl('g', { class: 'mark-knarr' });
  g.append(
    svgEl('path', {
      d: `M ${p.x - HEX * 0.7} ${p.y + HEX * 0.2} q ${HEX * 0.7} ${HEX * 0.55} ${HEX * 1.4} 0 Z`,
      fill: '#3a2c1d',
      stroke: '#d3a441',
      'stroke-width': 1.2,
    }),
    svgEl('path', {
      d: `M ${p.x} ${p.y + HEX * 0.2} L ${p.x} ${p.y - HEX * 0.75}`,
      stroke: '#d3a441',
      'stroke-width': 1.2,
    }),
  );
  return g;
}

/** The steading: the same bowed roof the world map uses, smaller. */
function hall(at: Hex): SVGGElement {
  const p = toPixel(at, HEX);
  const g = svgEl('g', { class: 'mark-hall' });
  g.append(
    svgEl('polygon', {
      points: cornerPoints(p.x, p.y, HEX * 1.05),
      fill: 'none',
      stroke: '#d3a441',
      'stroke-width': 1.4,
    }),
    svgEl('path', {
      d:
        `M ${p.x - HEX * 0.5} ${p.y + HEX * 0.3} L ${p.x - HEX * 0.5} ${p.y} ` +
        `Q ${p.x} ${p.y - HEX * 0.7} ${p.x + HEX * 0.5} ${p.y} ` +
        `L ${p.x + HEX * 0.5} ${p.y + HEX * 0.3} Z`,
      fill: '#4a3b28',
      stroke: '#d3a441',
      'stroke-width': 1,
    }),
  );
  return g;
}

function hereToken(at: Hex): SVGGElement {
  const p = toPixel(at, HEX);
  const g = svgEl('g', { class: 'mark-here' });
  g.append(
    svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.62, fill: '#b23b2e', stroke: '#e8dcc0', 'stroke-width': 1.6 }),
    svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.18, fill: '#e8dcc0' }),
  );
  return g;
}

/** Re-exported for tests: the route the chart draws. */
export { route, key };

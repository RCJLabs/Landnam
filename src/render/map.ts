// The chart: everything the band has seen, at a glance.
//
// The travel view is deliberately zoomed in so a hex clears a thumb. That
// makes it useless for the question "where have we been, and where is home
// from here?" — which is what this answers. Pure view: it reads state and
// draws, and closing it is the only thing it can do.

import { cornerPoints, distance, fromKey, toPixel, key, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import { exploredFraction } from '../sim/fog';
import { knownLandmarks } from '../sim/landmark';

/**
 * How many named points the chart will carry.
 *
 * Capped, and nearest-first: a long run has seen dozens, and a chart with
 * every one of them on it is a wall of text rather than a way to find
 * anything. The ones near the band are the ones being navigated by.
 */
const CHART_LANDMARKS = 12;
import type { GameState, Neighbour, Place } from '../state/types';
import { clanKind, standingFor } from '../data/clans';
import { placeKind } from '../data/places';
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
    // A worn trail, not a drawn line: the ground remembers when it was
    // walked, so the early road fades as the saga gets longer — never to
    // nothing, because the chart is the record.
    const age = Math.max(0.28, 1 - (state.day - to.day) / 220);
    layers.trail.append(
      svgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: '#e8dcc0',
        'stroke-width': 1.6,
        opacity: 0.5 * age,
      }),
    );
  }
  for (const step of walked) {
    const p = toPixel(step.at, HEX);
    const age = Math.max(0.28, 1 - (state.day - step.day) / 220);
    layers.trail.append(
      svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.22, fill: '#e8dcc0', opacity: 0.55 * age }),
    );
  }

  // The knarr, where it all started.
  // The country's fixed points, NAMED. This is what the chart is for and
  // what a landmark is for: on the travel map they are glyphs you steer by,
  // and here they are the names the saga has been using for them.
  // Marked on the chart, but NOT lettered on it. Names were tried here first
  // and could not be read: this is the whole island in 300px, so a name at
  // that scale is three pixels tall and overlaps its neighbours. The mark
  // says where, and the key below says which — which is what a key is for.
  const marks = knownLandmarks(state).slice(0, CHART_LANDMARKS);
  for (const mark of marks) {
    const p = toPixel(mark.at, HEX);
    layers.marks.append(
      svgEl('circle', {
        cx: p.x, cy: p.y, r: HEX * 0.34, class: 'chart-landmark',
        fill: 'none', stroke: '#e8dcc0', 'stroke-width': 1, opacity: 0.7,
      }),
    );
  }

  layers.marks.append(knarr(world.landing));

  const met = state.neighbours.filter((n) => n.found);
  for (const n of met) layers.marks.append(otherPlace(n));

  // The fixed points of the country, once the band knows of them — by
  // walking past, or by being told over a bargain. A trader who names a
  // monastery and leaves it off the chart has told you nothing you can act
  // on, which is the same trap the coast fell into: a name is not a place.
  const known = world.places.filter((p) => world.seen[key(p.at)] !== undefined);
  for (const p of known) layers.marks.append(fixedPlace(p));

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
    ...known.map((p) =>
      placeKey(p, `${placeKind(p.kind).name}${p.sackedOn !== undefined ? ' — picked clean' : ''}`),
    ),
    // The names the saga has been using, nearest first.
    ...marks.map((m) => legendItem('landmark', m.name)),
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

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * A legend whose swatches are the same glyphs the chart draws. Coloured
 * squares standing in for a ship and a hall would leave the player matching
 * shapes by guesswork.
 */
function legendItem(kind: 'knarr' | 'hall' | 'here' | 'trail' | 'landmark', text: string): HTMLElement {
  const swatch = svgEl('svg', {
    class: `chart-swatch ${kind}`,
    viewBox: '-11 -11 22 22',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  if (kind === 'knarr') swatch.append(knarr({ q: 0, r: 0 }));
  else if (kind === 'hall') swatch.append(hall({ q: 0, r: 0 }));
  else if (kind === 'here') swatch.append(hereToken({ q: 0, r: 0 }));
  else if (kind === 'landmark') {
    // The same ring the chart draws, so the key is matched by eye rather
    // than by guesswork — the rule the rest of this legend already follows.
    swatch.append(
      svgEl('circle', {
        cx: 0, cy: 0, r: 6, fill: 'none', stroke: '#e8dcc0',
        'stroke-width': 1.4, opacity: 0.8,
      }),
    );
  } else {
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

/**
 * A fixed place. A ring rather than a roof, so it never reads as somebody's
 * hall — and hollowed out once it has been taken, because a place already
 * picked clean is still worth knowing about and no longer worth walking to.
 */
function fixedPlace(place: Place, at: Hex = place.at): SVGGElement {
  const p = toPixel(at, HEX);
  const taken = place.sackedOn !== undefined;
  const g = svgEl('g', { class: 'mark-place' });
  const r = HEX * 0.5;
  g.append(
    svgEl('circle', {
      cx: p.x, cy: p.y, r,
      fill: taken ? 'none' : '#2a2318',
      stroke: taken ? '#7a6a4a' : '#c9a24a',
      'stroke-width': 1.4,
      'stroke-dasharray': taken ? '3 3' : 'none',
    }),
    svgEl('circle', {
      cx: p.x, cy: p.y, r: r * 0.34,
      fill: taken ? '#7a6a4a' : '#c9a24a',
    }),
  );
  return g;
}

/** A legend row for one fixed place, drawn with the same glyph. */
function placeKey(place: Place, text: string): HTMLElement {
  const swatch = svgEl('svg', {
    class: 'chart-swatch place',
    viewBox: '-11 -11 22 22',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  swatch.append(fixedPlace(place, { q: 0, r: 0 }));
  return el('div', { class: 'chart-key' }, [swatch, el('span', {}, [text])]);
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

// COLONY renderer: the steading's own ground, drawn as a small hex patch with
// your people standing on the plots they work.
//
// A BACKEND. What the steading shows is decided in render/colonyScene.ts;
// this turns that into nodes and nothing else. See the head of that file for
// why — the short version is that where a worker STANDS is a claim the game
// makes, and it could only be checked by reading SVG out of a browser.

import { cornerPoints, key, toPixel, type Hex } from '../hex';
import { PLOTS } from '../data/jobs';
import { buildingById } from '../data/buildings';
import type { GameState, Plot } from '../state/types';
import { svgEl } from './svg';
import { HEX, describeColony } from './colonyScene';
import { createSteadingPaint, type SteadingPaint } from './colonyOil';
import { paintingWanted } from './oilFlag';

export { HEX };

export interface ColonyView {
  root: SVGSVGElement;
  update(state: GameState): void;
  /** What the brush has done, for the debug read-out and the bars. */
  drawn(): { backend: 'svg' | 'oil'; plots: number; painted: number; kept: number };
}

export function createColonyView(): ColonyView {
  const root = svgEl('svg', {
    class: 'steading-map',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const layers = { ground: svgEl('g'), marks: svgEl('g'), folk: svgEl('g') };
  // The painting goes UNDER the drawn ground rather than instead of it. The
  // plot glyphs, the raised buildings and the people stay SVG either way —
  // they are the things you read rather than the thing you look at, and they
  // stay crisp at any size for free.
  const brush: SteadingPaint | null = paintingWanted() ? createSteadingPaint() : null;
  if (brush) root.append(brush.node);
  root.append(layers.ground, layers.marks, layers.folk);

  let plots = 0;

  function paint(state: GameState): void {
    const scene = describeColony(state);
    layers.ground.replaceChildren();
    layers.marks.replaceChildren();
    layers.folk.replaceChildren();
    plots = scene.plots.length;
    brush?.update(scene, state.seed);
    if (!scene.bounds) return;
    const b = scene.bounds;
    root.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);

    for (const plot of scene.plots) {
      const def = PLOTS[plot.kind as keyof typeof PLOTS];
      const p = toPixel(plot.at, HEX);
      layers.ground.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX),
          // Painted, the polygon stops being the ground and becomes the line
          // round it — the plot's own edge, which is what tells one plot from
          // the next once the fills are wet paint that runs across the seam.
          fill: brush ? 'none' : def.fill,
          stroke: def.edge,
          'stroke-width': plot.hall ? 2.5 : 1,
        }),
      );
    }

    for (const mark of scene.marks) {
      const p = toPixel(mark.at, HEX);
      if (mark.kind === 'plot') {
        const glyph = plotMark(mark.plot, p.x, p.y);
        if (glyph) layers.marks.append(glyph);
      } else {
        // Drawn over the ground, so a finished building visibly changes the
        // steading rather than hiding under it.
        const building = buildingById(mark.building);
        if (building) layers.marks.append(raised(building.id, p.x, p.y));
      }
    }

    for (const person of scene.folk) {
      const p = toPixel(person.at, HEX);
      layers.folk.append(
        worker(p.x + person.nudge[0], p.y + person.nudge[1], person.name),
      );
    }
  }

  return {
    root,
    update: paint,
    drawn: () => {
      const s = brush?.stats();
      return {
        backend: brush ? ('oil' as const) : ('svg' as const),
        plots,
        painted: s?.painted ?? 0,
        kept: s?.kept ?? 0,
      };
    },
  };
}

/** A small procedural glyph telling you what a plot is at a glance. */
function plotMark(kind: string, cx: number, cy: number): SVGElement | null {
  switch (kind) {
    case 'hall':
      return svgEl('path', {
        d:
          `M ${cx - HEX * 0.4} ${cy + HEX * 0.28} L ${cx - HEX * 0.4} ${cy} ` +
          `Q ${cx} ${cy - HEX * 0.55} ${cx + HEX * 0.4} ${cy} ` +
          `L ${cx + HEX * 0.4} ${cy + HEX * 0.28} Z`,
        fill: '#33291d',
        stroke: '#d3a441',
        'stroke-width': 1.5,
      });
    case 'field': {
      const g = svgEl('g', { opacity: 0.55 });
      for (let i = -1; i <= 1; i++) {
        g.append(
          svgEl('line', {
            x1: cx - HEX * 0.42,
            y1: cy + i * HEX * 0.22,
            x2: cx + HEX * 0.42,
            y2: cy + i * HEX * 0.22,
            stroke: '#4f5f33',
            'stroke-width': 2,
          }),
        );
      }
      return g;
    }
    case 'wood': {
      const g = svgEl('g', { opacity: 0.9 });
      for (const dx of [-0.3, 0.1]) {
        const x = cx + dx * HEX;
        g.append(
          svgEl('path', {
            d: `M ${x} ${cy - HEX * 0.3} L ${x + HEX * 0.17} ${cy + HEX * 0.16} L ${x - HEX * 0.17} ${cy + HEX * 0.16} Z`,
            fill: '#26361f',
          }),
        );
      }
      return g;
    }
    case 'water': {
      const g = svgEl('g', { opacity: 0.7 });
      for (let i = -1; i <= 1; i++) {
        g.append(
          svgEl('path', {
            d: `M ${cx - HEX * 0.34} ${cy + i * HEX * 0.24} q ${HEX * 0.17} ${-HEX * 0.14} ${HEX * 0.34} 0 q ${HEX * 0.17} ${HEX * 0.14} ${HEX * 0.34} 0`,
            fill: 'none',
            stroke: '#8fc6dd',
            'stroke-width': 1.6,
          }),
        );
      }
      return g;
    }
    case 'watchpost':
      return svgEl('path', {
        // A spear stood upright in the ground.
        d: `M ${cx} ${cy - HEX * 0.4} L ${cx} ${cy + HEX * 0.34} M ${cx - HEX * 0.1} ${cy - HEX * 0.26} L ${cx} ${cy - HEX * 0.44} L ${cx + HEX * 0.1} ${cy - HEX * 0.26}`,
        fill: 'none',
        stroke: '#d9c9a3',
        'stroke-width': 2,
      });
    default:
      return null;
  }
}

/** A gold mark on the ground for each thing that has been raised. */
function raised(id: string, cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { class: 'raised', opacity: 0.95 });
  g.append(
    svgEl('polygon', {
      points: cornerPoints(cx, cy, HEX - 3),
      fill: 'none',
      stroke: '#d3a441',
      'stroke-width': 2,
    }),
  );
  if (id === 'palisade' || id === 'earthworks') {
    // A line of stakes across the plot.
    for (const dx of [-0.3, -0.1, 0.1, 0.3]) {
      g.append(
        svgEl('line', {
          x1: cx + dx * HEX,
          y1: cy - HEX * 0.3,
          x2: cx + dx * HEX,
          y2: cy + HEX * 0.3,
          stroke: '#d3a441',
          'stroke-width': 2.5,
        }),
      );
    }
  } else if (id === 'dock') {
    g.append(
      svgEl('path', {
        d: `M ${cx - HEX * 0.4} ${cy} L ${cx + HEX * 0.4} ${cy} M ${cx - HEX * 0.2} ${cy} L ${cx - HEX * 0.2} ${cy + HEX * 0.3} M ${cx + HEX * 0.2} ${cy} L ${cx + HEX * 0.2} ${cy + HEX * 0.3}`,
        stroke: '#d3a441',
        'stroke-width': 2.5,
        fill: 'none',
      }),
    );
  } else {
    // A roof: longhouse, smokehouse, mead hall and farm walls all read as one.
    g.append(
      svgEl('path', {
        d: `M ${cx - HEX * 0.36} ${cy + HEX * 0.22} L ${cx} ${cy - HEX * 0.3} L ${cx + HEX * 0.36} ${cy + HEX * 0.22} Z`,
        fill: '#4a3b28',
        stroke: '#d3a441',
        'stroke-width': 2,
      }),
    );
  }
  return g;
}

function worker(cx: number, cy: number, name: string): SVGGElement {
  const g = svgEl('g', { class: 'worker' });
  g.append(svgEl('title', {}, [document.createTextNode(name)]));
  g.append(
    svgEl('circle', { cx, cy: cy - HEX * 0.13, r: HEX * 0.11, fill: '#e8dcc0' }),
    svgEl('path', {
      d: `M ${cx} ${cy - HEX * 0.02} L ${cx} ${cy + HEX * 0.2}`,
      stroke: '#e8dcc0',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }),
  );
  return g;
}

/** Plot kinds present, for the panel's summary of the ground. */
export function plotTally(state: GameState): { kind: string; name: string; count: number }[] {
  const home = state.settlement;
  if (!home) return [];
  const counts = new Map<string, number>();
  for (const plot of home.plots) counts.set(plot.kind, (counts.get(plot.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, name: PLOTS[kind as keyof typeof PLOTS].name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Stable key for a plot, used by tests and by the renderer's spot picking. */
export function plotKey(plot: Plot): string {
  return `${plot.kind}:${key(plot.at as Hex)}`;
}

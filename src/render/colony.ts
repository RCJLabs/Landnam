// COLONY renderer: the steading's own ground, drawn as a small hex patch with
// your people standing on the plots they work. Pure view.
//
// The point of drawing it at all is that assignment should be a thing you SEE:
// put someone on the fields and a figure appears in the fields.

import { cornerPoints, key, toPixel, type Hex } from '../hex';
import { PLOTS, type JobId } from '../data/jobs';
import { buildingById } from '../data/buildings';
import type { GameState, Plot } from '../state/types';
import { jobOf, plotsFor } from '../sim/colony';
import { living } from '../sim/people';
import { svgEl } from './svg';

const HEX = 34;

export interface ColonyView {
  root: SVGSVGElement;
  update(state: GameState): void;
}

export function createColonyView(): ColonyView {
  const root = svgEl('svg', {
    class: 'steading-map',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const layers = { ground: svgEl('g'), marks: svgEl('g'), folk: svgEl('g') };
  root.append(layers.ground, layers.marks, layers.folk);

  function fit(plots: Plot[]): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const plot of plots) {
      const p = toPixel(plot.at, HEX);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = HEX * 0.9;
    root.setAttribute(
      'viewBox',
      `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    );
  }

  function paint(state: GameState): void {
    const home = state.settlement;
    layers.ground.replaceChildren();
    layers.marks.replaceChildren();
    layers.folk.replaceChildren();
    if (!home || home.plots.length === 0) return;
    fit(home.plots);

    for (const plot of home.plots) {
      const def = PLOTS[plot.kind];
      const p = toPixel(plot.at, HEX);
      layers.ground.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX),
          fill: def.fill,
          stroke: def.edge,
          'stroke-width': plot.kind === 'hall' ? 2.5 : 1,
        }),
      );
      const mark = plotMark(plot, p.x, p.y);
      if (mark) layers.marks.append(mark);
    }

    // What has been raised, standing on the plots it belongs on. Drawn over
    // the ground so a finished building visibly changes the steading.
    const spots = home.plots.filter((p) => p.kind !== 'hall');
    home.built.forEach((id, i) => {
      const building = buildingById(id);
      if (!building) return;
      const spot = spots[i % Math.max(1, spots.length)];
      if (!spot) return;
      const p = toPixel(spot.at, HEX);
      layers.marks.append(raised(building.id, p.x, p.y));
    });

    // Workers stand on the ground they work. Where several share a plot kind,
    // they are spread across the available plots so nobody is hidden.
    const used = new Map<string, number>();
    for (const person of living(state.party.people)) {
      const job = jobOf(person);
      if (!job) continue;
      const options = plotsFor(home, job.id as JobId);
      const spot = options.length > 0 ? options[(used.get(job.id) ?? 0) % options.length]! : undefined;
      used.set(job.id, (used.get(job.id) ?? 0) + 1);
      if (!spot) continue;
      const p = toPixel(spot.at, HEX);
      // Jitter within the plot so two workers on one plot do not overlap.
      const nth = (used.get(job.id) ?? 1) - 1;
      const angle = (nth / Math.max(1, options.length)) * Math.PI * 2;
      layers.folk.append(
        worker(p.x + Math.cos(angle) * HEX * 0.3, p.y + Math.sin(angle) * HEX * 0.3, person.name),
      );
    }
  }

  return {
    root,
    update: paint,
  };
}

/** A small procedural glyph telling you what a plot is at a glance. */
function plotMark(plot: Plot, cx: number, cy: number): SVGElement | null {
  switch (plot.kind) {
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

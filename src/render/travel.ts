// TRAVEL renderer: the world map as layered SVG. Pure view — it reads state
// and emits a hex click; it never mutates anything.

import { cornerPoints, fromKey, fromPixel, key, neighbors, toPixel, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState, Neighbour, Tile } from '../state/types';
import { clanKind, standingFor } from '../data/clans';
import { atSea, moveEffort } from '../sim/travel';
import { mapDefs, svgEl } from './svg';

export const HEX_SIZE = 26;

export interface TravelView {
  root: SVGSVGElement;
  /** Re-paints from current state, preserving the camera. */
  update(state: GameState): void;
  /** Centres the camera on a hex. */
  centreOn(h: Hex): void;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function tileFill(tile: Tile, visible: boolean): string {
  const def = terrainDef(tile.terrain);
  return visible ? def.fill : def.edge;
}

export function createTravelView(onHexTap: (h: Hex) => void): TravelView {
  const root = svgEl('svg', {
    class: 'map',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid slice',
  });
  root.append(mapDefs());

  const sea = svgEl('rect', { class: 'sea', x: -4000, y: -4000, width: 12000, height: 12000 });
  const layerTerrain = svgEl('g');
  const layerRivers = svgEl('g');
  const layerOverlay = svgEl('g');
  const layerParty = svgEl('g');
  root.append(sea, layerTerrain, layerRivers, layerOverlay, layerParty);

  // Start zoomed in enough that a hex clears the 44px touch target.
  const camera: Camera = { x: 0, y: 0, zoom: 1.35 };
  let latest: GameState | null = null;

  function applyCamera(): void {
    const width = (root.clientWidth || 390) / camera.zoom;
    const height = (root.clientHeight || 600) / camera.zoom;
    root.setAttribute(
      'viewBox',
      `${camera.x - width / 2} ${camera.y - height / 2} ${width} ${height}`,
    );
  }

  function centreOn(h: Hex): void {
    const p = toPixel(h, HEX_SIZE);
    camera.x = p.x;
    camera.y = p.y;
    applyCamera();
  }

  function paint(state: GameState): void {
    latest = state;
    layerTerrain.replaceChildren();
    layerRivers.replaceChildren();
    layerOverlay.replaceChildren();
    layerParty.replaceChildren();

    // Only draw what has been seen — the unknown is simply absent.
    for (const [k, visibility] of Object.entries(state.world.seen)) {
      const tile = state.world.tiles[k];
      if (!tile) continue;
      const h = fromKey(k);
      const p = toPixel(h, HEX_SIZE);
      const visible = visibility === 'visible';

      layerTerrain.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX_SIZE),
          fill: tileFill(tile, visible),
          stroke: terrainDef(tile.terrain).edge,
          'stroke-width': 1,
          opacity: visible ? 1 : 0.55,
        }),
      );

      if (tile.terrain === 'mountains') {
        layerTerrain.append(peaks(p.x, p.y, visible));
      } else if (tile.terrain === 'forest') {
        layerTerrain.append(trees(p.x, p.y, visible));
      } else if (tile.terrain === 'hills') {
        layerTerrain.append(mounds(p.x, p.y, visible));
      }

      if (tile.river) {
        layerRivers.append(
          svgEl('circle', {
            cx: p.x,
            cy: p.y,
            r: HEX_SIZE * 0.24,
            fill: '#3f7d94',
            opacity: visible ? 0.85 : 0.4,
          }),
        );
      }
    }

    // Where we could step next.
    for (const option of neighbourOptions(state)) {
      const p = toPixel(option, HEX_SIZE);
      layerOverlay.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX_SIZE - 3),
          fill: 'none',
          stroke: '#e8dcc0',
          'stroke-width': 2,
          'stroke-dasharray': '5 5',
          opacity: 0.75,
        }),
      );
    }

    // Other people's places, once somebody has laid eyes on them.
    for (const n of state.neighbours) {
      if (!n.found) continue;
      layerOverlay.append(neighbourMark(n));
    }

    // Where the keel first touched sand. Kept on the map because it is the
    // one fixed point on a coast you are otherwise reading for the first time.
    if (state.world.seen[key(state.world.landing)]) {
      layerOverlay.append(landfallMark(state.world.landing));
    }

    if (state.settlement) {
      layerOverlay.append(steading(state.settlement.at));
    }

    layerParty.append(
      atSea(state) ? shipToken(state.party.at) : partyToken(state.party.at),
    );
  }

  function neighbourOptions(state: GameState): Hex[] {
    if (state.event || state.end) return [];
    return neighbors(state.party.at).filter((h) => moveEffort(state, h) !== null);
  }

  // Pointer handling: drag to pan, pinch to zoom, tap to move.
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  let pinchStart = 0;
  let pinchZoom = 1;

  root.addEventListener('pointerdown', (e) => {
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchStart = pointerSpread(pointers);
      pinchZoom = camera.zoom;
    }
    dragged = false;
  });

  root.addEventListener('pointermove', (e) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const spread = pointerSpread(pointers);
      if (pinchStart > 0) {
        camera.zoom = clampZoom(pinchZoom * (spread / pinchStart));
        applyCamera();
      }
      dragged = true;
      return;
    }

    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    applyCamera();
  });

  function release(e: PointerEvent): void {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (!had || dragged || pointers.size > 0) return;
    if (!latest) return;
    const rect = root.getBoundingClientRect();
    const width = rect.width / camera.zoom;
    const height = rect.height / camera.zoom;
    const worldX = camera.x - width / 2 + ((e.clientX - rect.left) / rect.width) * width;
    const worldY = camera.y - height / 2 + ((e.clientY - rect.top) / rect.height) * height;
    onHexTap(fromPixel(worldX, worldY, HEX_SIZE));
  }

  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
  });

  root.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoom = clampZoom(camera.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      applyCamera();
    },
    { passive: false },
  );

  window.addEventListener('resize', applyCamera);
  applyCamera();

  return {
    root,
    update(state) {
      paint(state);
      applyCamera();
    },
    centreOn,
  };
}

function clampZoom(value: number): number {
  return Math.max(0.55, Math.min(2.6, value));
}

function pointerSpread(pointers: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// --- Procedural decorations, all plain SVG paths ---

function trees(cx: number, cy: number, visible: boolean): SVGGElement {
  const g = svgEl('g', { opacity: visible ? 0.9 : 0.4 });
  const offsets: { dx: number; dy: number }[] = [
    { dx: -0.34, dy: 0.12 },
    { dx: 0.0, dy: -0.16 },
    { dx: 0.34, dy: 0.16 },
  ];
  for (const { dx, dy } of offsets) {
    const x = cx + dx * HEX_SIZE;
    const y = cy + dy * HEX_SIZE;
    g.append(
      svgEl('path', {
        d: `M ${x} ${y - HEX_SIZE * 0.3} L ${x + HEX_SIZE * 0.16} ${y + HEX_SIZE * 0.16} L ${x - HEX_SIZE * 0.16} ${y + HEX_SIZE * 0.16} Z`,
        fill: '#26361f',
      }),
    );
  }
  return g;
}

function peaks(cx: number, cy: number, visible: boolean): SVGGElement {
  const g = svgEl('g', { opacity: visible ? 0.95 : 0.45 });
  g.append(
    svgEl('path', {
      d: `M ${cx - HEX_SIZE * 0.42} ${cy + HEX_SIZE * 0.26} L ${cx - HEX_SIZE * 0.1} ${cy - HEX_SIZE * 0.34} L ${cx + HEX_SIZE * 0.2} ${cy + HEX_SIZE * 0.26} Z`,
      fill: '#8d8a85',
    }),
    svgEl('path', {
      d: `M ${cx - HEX_SIZE * 0.16} ${cy - HEX_SIZE * 0.34} L ${cx - HEX_SIZE * 0.1} ${cy - HEX_SIZE * 0.34} L ${cx + HEX_SIZE * 0.02} ${cy - HEX_SIZE * 0.06} L ${cx - HEX_SIZE * 0.24} ${cy - HEX_SIZE * 0.06} Z`,
      fill: '#e6e9ec',
    }),
  );
  return g;
}

function mounds(cx: number, cy: number, visible: boolean): SVGGElement {
  const g = svgEl('g', { opacity: visible ? 0.85 : 0.4 });
  g.append(
    svgEl('path', {
      d: `M ${cx - HEX_SIZE * 0.4} ${cy + HEX_SIZE * 0.16} q ${HEX_SIZE * 0.4} ${-HEX_SIZE * 0.42} ${HEX_SIZE * 0.8} 0 Z`,
      fill: '#8d8459',
    }),
  );
  return g;
}

/**
 * Somebody else's place. Colour carries the standing, because the one thing
 * the player must be able to read off the map at a glance is who is angry.
 */
export const STANDING_INK: Record<string, string> = {
  hostile: '#b23b2e',
  cold: '#c2703a',
  wary: '#b6a06a',
  friendly: '#7fa05a',
  sworn: '#5fa389',
};

function neighbourMark(n: Neighbour): SVGGElement {
  const p = toPixel(n.at, HEX_SIZE);
  const ink = STANDING_INK[standingFor(n.standing).id] ?? '#b6a06a';
  const g = svgEl('g', { class: `neighbour standing-${standingFor(n.standing).id}` });
  const r = HEX_SIZE * 0.3;
  g.append(
    svgEl('polygon', {
      points: cornerPoints(p.x, p.y, HEX_SIZE - 4),
      fill: 'none',
      stroke: ink,
      'stroke-width': 2,
      'stroke-dasharray': '3 4',
      opacity: 0.85,
    }),
  );
  if (clanKind(n.kind).id === 'native') {
    // A tent: two poles crossed over a hide.
    g.append(
      svgEl('path', {
        d: `M ${p.x} ${p.y - r} L ${p.x - r} ${p.y + r} L ${p.x + r} ${p.y + r} Z`,
        fill: '#3b3225',
        stroke: ink,
        'stroke-width': 1.6,
      }),
    );
  } else {
    // A rival hall: the same bowed roof as ours, in somebody else's colour.
    g.append(
      svgEl('path', {
        d:
          `M ${p.x - r} ${p.y + r * 0.6} L ${p.x - r} ${p.y} ` +
          `Q ${p.x} ${p.y - r * 1.3} ${p.x + r} ${p.y} ` +
          `L ${p.x + r} ${p.y + r * 0.6} Z`,
        fill: '#3b3225',
        stroke: ink,
        'stroke-width': 1.6,
      }),
    );
  }
  return g;
}

/** A longhouse: a turf roof with a smoke-hole, readable at thumb size. */
function steading(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const w = HEX_SIZE * 0.62;
  const h = HEX_SIZE * 0.44;
  const g = svgEl('g', { class: 'steading' });
  g.append(
    svgEl('polygon', {
      points: cornerPoints(p.x, p.y, HEX_SIZE - 2),
      fill: 'none',
      stroke: '#d3a441',
      'stroke-width': 2.5,
    }),
    // The hall itself: a low bowed roof, gable end toward the viewer.
    svgEl('path', {
      d:
        `M ${p.x - w / 2} ${p.y + h / 2} ` +
        `L ${p.x - w / 2} ${p.y} ` +
        `Q ${p.x} ${p.y - h} ${p.x + w / 2} ${p.y} ` +
        `L ${p.x + w / 2} ${p.y + h / 2} Z`,
      fill: '#4a3b28',
      stroke: '#d3a441',
      'stroke-width': 1.5,
    }),
    svgEl('circle', { cx: p.x, cy: p.y + h * 0.1, r: HEX_SIZE * 0.07, fill: '#d3a441' }),
  );
  return g;
}

/**
 * The band, as a face under a helmet.
 *
 * A coloured dot said "you are here" and nothing else. What the map wants to
 * say is "these are your people", so this is a helm — dome, nasal bar, and a
 * beard under it — over a red shield. Everything is silhouette: at a hex
 * width of about 50px on a phone, detail smaller than the nasal bar turns to
 * mush, so there is none.
 */
function partyToken(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const s = HEX_SIZE;
  const g = svgEl('g', { class: 'party-token' });

  g.append(
    // The shield he is standing behind, and the dark disc that keeps the
    // whole thing legible over meadow, sand or snow alike.
    svgEl('circle', { cx: p.x, cy: p.y, r: s * 0.48, fill: '#1d1a14', opacity: 0.6 }),
    svgEl('circle', {
      cx: p.x,
      cy: p.y,
      r: s * 0.4,
      fill: '#b23b2e',
      stroke: '#e8dcc0',
      'stroke-width': 2,
    }),
    // Beard: a broad wedge below the brow, outlined so it separates from the
    // red behind it. It is what makes the shape read as a face rather than a
    // bucket.
    svgEl('path', {
      d:
        `M ${p.x - s * 0.27} ${p.y - s * 0.04} ` +
        `Q ${p.x} ${p.y + s * 0.52} ${p.x + s * 0.27} ${p.y - s * 0.04} Z`,
      fill: '#c9a15c',
      stroke: '#2a2318',
      'stroke-width': 1.1,
    }),
    // Helm: a dome sitting on the brow line, filling most of the disc.
    svgEl('path', {
      d:
        `M ${p.x - s * 0.3} ${p.y - s * 0.04} ` +
        `Q ${p.x - s * 0.3} ${p.y - s * 0.4} ${p.x} ${p.y - s * 0.4} ` +
        `Q ${p.x + s * 0.3} ${p.y - s * 0.4} ${p.x + s * 0.3} ${p.y - s * 0.04} Z`,
      fill: '#98a1ad',
      stroke: '#2a2318',
      'stroke-width': 1.3,
    }),
    // Nasal bar down past the brow, and a dark eye either side of it.
    svgEl('rect', {
      x: p.x - s * 0.055,
      y: p.y - s * 0.14,
      width: s * 0.11,
      height: s * 0.26,
      fill: '#98a1ad',
      stroke: '#2a2318',
      'stroke-width': 1,
    }),
    svgEl('rect', { x: p.x - s * 0.22, y: p.y - s * 0.13, width: s * 0.13, height: s * 0.09, fill: '#2a2318' }),
    svgEl('rect', { x: p.x + s * 0.09, y: p.y - s * 0.13, width: s * 0.13, height: s * 0.09, fill: '#2a2318' }),
  );
  return g;
}

/** The same band, afloat: the knarr under them, shields on the rail. */
function shipToken(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const s = HEX_SIZE;
  const g = svgEl('g', { class: 'party-token afloat' });
  const half = s * 0.5;

  g.append(
    svgEl('ellipse', { cx: p.x, cy: p.y + s * 0.18, rx: s * 0.62, ry: s * 0.26, fill: '#1d1a14', opacity: 0.45 }),
    // Mast, then the square sail on it: one red stripe on undyed wool, which
    // is the whole of what a longship reads as at this size.
    svgEl('line', {
      x1: p.x, y1: p.y - s * 0.56, x2: p.x, y2: p.y + s * 0.16,
      stroke: '#2a2318', 'stroke-width': 2.2,
    }),
    svgEl('rect', {
      x: p.x - s * 0.3, y: p.y - s * 0.52, width: s * 0.6, height: s * 0.4,
      fill: '#e8dcc0', stroke: '#2a2318', 'stroke-width': 1.2,
    }),
    svgEl('rect', { x: p.x - s * 0.3, y: p.y - s * 0.38, width: s * 0.6, height: s * 0.13, fill: '#b23b2e' }),
    // Hull: a shallow curve rising to a stem at each end.
    svgEl('path', {
      d:
        `M ${p.x - half} ${p.y + s * 0.02} ` +
        `Q ${p.x} ${p.y + s * 0.5} ${p.x + half} ${p.y + s * 0.02} ` +
        `L ${p.x + half * 0.8} ${p.y - s * 0.14} ` +
        `Q ${p.x} ${p.y + s * 0.26} ${p.x - half * 0.8} ${p.y - s * 0.14} Z`,
      fill: '#4a3b28',
      stroke: '#e8dcc0',
      'stroke-width': 1.6,
    }),
  );
  return g;
}

/** Where the keel first touched sand — a beached hull, prow up. */
function landfallMark(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const s = HEX_SIZE;
  const g = svgEl('g', { class: 'landfall' });
  g.append(
    svgEl('path', {
      d: `M ${p.x - s * 0.42} ${p.y + s * 0.06} q ${s * 0.42} ${s * 0.34} ${s * 0.84} 0 Z`,
      fill: '#3a2c1d',
      stroke: '#d3a441',
      'stroke-width': 1.6,
    }),
    svgEl('line', {
      x1: p.x - s * 0.46, y1: p.y + s * 0.06, x2: p.x + s * 0.46, y2: p.y + s * 0.06,
      stroke: '#d3a441', 'stroke-width': 1.6,
    }),
    svgEl('line', {
      x1: p.x, y1: p.y - s * 0.34, x2: p.x, y2: p.y + s * 0.06,
      stroke: '#d3a441', 'stroke-width': 1.6,
    }),
  );
  return g;
}

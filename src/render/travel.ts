// TRAVEL renderer: the world map as layered SVG. Pure view — it reads state
// and emits a hex click; it never mutates anything.

import { cornerPoints, fromKey, fromPixel, neighbors, toPixel, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState, Tile } from '../state/types';
import { moveEffort } from '../sim/travel';
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

    if (state.settlement) {
      layerOverlay.append(steading(state.settlement.at));
    }

    layerParty.append(partyToken(state.party.at));
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

function partyToken(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const g = svgEl('g', { class: 'party-token' });
  // A shield on a spear: readable at thumb size.
  g.append(
    svgEl('circle', {
      cx: p.x,
      cy: p.y,
      r: HEX_SIZE * 0.46,
      fill: '#1d1a14',
      opacity: 0.55,
    }),
    svgEl('circle', {
      cx: p.x,
      cy: p.y,
      r: HEX_SIZE * 0.36,
      fill: '#b23b2e',
      stroke: '#e8dcc0',
      'stroke-width': 2.5,
    }),
    svgEl('circle', { cx: p.x, cy: p.y, r: HEX_SIZE * 0.1, fill: '#e8dcc0' }),
  );
  return g;
}

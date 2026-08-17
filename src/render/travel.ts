// TRAVEL renderer: the world map as layered SVG. Pure view — it reads state
// and emits a hex click; it never mutates anything.

import { cornerPoints, fromKey, fromPixel, key, neighbors, toPixel, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState, Neighbour, Place, Tile } from '../state/types';
import { clanKind, standingFor } from '../data/clans';
import { atSea, moveEffort } from '../sim/travel';
import { mapDefs, svgEl } from './svg';
import { isIdle, repaintWork, type Lit } from './repaint';
import { terrainFill, terrainPatterns } from './terrainArt';

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
  return terrainFill(tile.terrain, visible);
}

export function createTravelView(onHexTap: (h: Hex) => void): TravelView {
  const root = svgEl('svg', {
    class: 'map',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid slice',
    // Otherwise this is the largest thing on the page and a screen reader
    // has nothing at all to say about it. A summary, not a hex-by-hex
    // reading: the panel underneath already reports the ground the band is
    // standing on, so what this adds is the shape of the situation.
    role: 'img',
  });
  // Built once, and the whole point of them: the terrain patterns are what
  // every hex's fill points at, so the map's texture costs no per-hex nodes.
  const defs = mapDefs();
  defs.append(...terrainPatterns());
  root.append(defs);

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

  /** The band's token, kept between repaints so it can be moved rather than remade. */
  let token: SVGGElement | null = null;
  let tokenAfloat = false;

  /**
   * The country already in the document, and the light it was drawn in.
   *
   * Two maps rather than one so `repaintWork` can stay a pure function of
   * hex keys and light, with no idea that SVG exists.
   */
  const drawn = new Map<string, { poly: SVGPolygonElement; river: SVGCircleElement | null }>();
  const lit = new Map<string, Lit>();

  function centreOn(h: Hex): void {
    const p = toPixel(h, HEX_SIZE);
    camera.x = p.x;
    camera.y = p.y;
    applyCamera();
  }

  function paint(state: GameState): void {
    latest = state;
    // The terrain and river layers are NOT cleared — see chartCountry. The
    // overlay is: it is a few dozen nodes that change every single turn, and
    // diffing something that small would cost more than rebuilding it.
    layerOverlay.replaceChildren();
    // The token is kept across repaints too, so it can glide from one hex to
    // the next rather than being destroyed and rebuilt somewhere else.

    chartCountry(state);

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

    // The fixed points of the country, once the fog has come off them.
    for (const p of state.world.places) {
      if (!state.world.seen[key(p.at)]) continue;
      layerOverlay.append(placeMark(p));
    }

    // Where the keel first touched sand. Kept on the map because it is the
    // one fixed point on a coast you are otherwise reading for the first time.
    if (state.world.seen[key(state.world.landing)]) {
      layerOverlay.append(landfallMark(state.world.landing));
    }

    if (state.settlement) {
      layerOverlay.append(steading(state.settlement.at));
    }

    placeToken(state);
  }

  /**
   * The country, built once and then only corrected.
   *
   * A repaint follows every action, and the terrain under a hex never changes
   * — sim/worldgen.ts writes it and nothing else ever touches it. So the only
   * things that can move are which hexes are on the chart and which of them
   * are lit, and both come off `world.seen`. `repaintWork` works out which is
   * which; this puts the answer into the document.
   *
   * What it replaces cleared the layer and rebuilt every seen hex every time,
   * which cost the size of the chart per repaint and therefore grew as the
   * run went on. Measured over runs/long.json in test/repaint.test.ts:
   * 102,612 polygons built, against 78 here.
   */
  function chartCountry(state: GameState): void {
    const seen = state.world.seen as Record<string, Lit>;
    const work = repaintWork(lit, seen);
    if (isIdle(work)) return;

    for (const k of work.added) {
      const tile = state.world.tiles[k];
      const now = seen[k];
      if (!tile || now === undefined) continue;
      const p = toPixel(fromKey(k), HEX_SIZE);
      const visible = now === 'visible';

      const poly = svgEl('polygon', {
        points: cornerPoints(p.x, p.y, HEX_SIZE),
        fill: tileFill(tile, visible),
        stroke: terrainDef(tile.terrain).edge,
        'stroke-width': 1,
        opacity: visible ? 1 : 0.55,
      });
      layerTerrain.append(poly);

      // Mountains, forest and hills used to get a group of paths each here.
      // They are in the terrain pattern now — see render/terrainArt.ts — so
      // all eight terrains have texture and none of them costs a node.

      let river: SVGCircleElement | null = null;
      if (tile.river) {
        river = svgEl('circle', {
          cx: p.x,
          cy: p.y,
          r: HEX_SIZE * 0.24,
          fill: '#3f7d94',
          opacity: visible ? 0.85 : 0.4,
        });
        layerRivers.append(river);
      }

      drawn.set(k, { poly, river });
      lit.set(k, now);
    }

    for (const k of work.relit) {
      const held = drawn.get(k);
      const tile = state.world.tiles[k];
      const now = seen[k];
      if (!held || !tile || now === undefined) continue;
      const visible = now === 'visible';
      held.poly.setAttribute('fill', tileFill(tile, visible));
      held.poly.setAttribute('opacity', visible ? '1' : '0.55');
      held.river?.setAttribute('opacity', visible ? '0.85' : '0.4');
      lit.set(k, now);
    }

    for (const k of work.dropped) {
      const held = drawn.get(k);
      if (!held) continue;
      held.poly.remove();
      held.river?.remove();
      drawn.delete(k);
      lit.delete(k);
    }
  }

  /**
   * Puts the band where it is now. The element is made once and then only
   * moved, which is the whole trick: a CSS transition on the group's
   * transform turns a state change into a glide, with no timer and no
   * animation frame anywhere in the game.
   *
   * Swapping between walking and afloat rebuilds it, because a helmet cannot
   * tween into a longship and pretending otherwise would look worse than the
   * cut it actually is.
   */
  function placeToken(state: GameState): void {
    const afloat = atSea(state);
    const p = toPixel(state.party.at, HEX_SIZE);
    if (!token || tokenAfloat !== afloat) {
      token = afloat ? shipToken() : partyToken();
      tokenAfloat = afloat;
      // Positioned BEFORE it goes into the document. A transition needs two
      // computed values to move between, and an element that arrives already
      // in the right place never has a first one — so a new token appears
      // where it belongs instead of flying in from the corner of the map.
      token.setAttribute('transform', `translate(${p.x} ${p.y})`);
      layerParty.replaceChildren(token);
      return;
    }
    token.setAttribute('transform', `translate(${p.x} ${p.y})`);
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

/**
 * A place on the map: a glyph you can read at map scale, dimmed to a memory
 * once the place has been taken — the mark stays, because the saga happened
 * there.
 */
function placeMark(place: Place): SVGGElement {
  const p = toPixel(place.at, HEX_SIZE);
  const taken = place.sackedOn !== undefined;
  const g = svgEl('g', { class: `place place-${place.kind}`, opacity: taken ? 0.35 : 0.95 });
  const r = HEX_SIZE * 0.3;
  const ink = taken ? '#6f675a' : '#d9c9a3';

  if (place.kind === 'monastery') {
    // A cross over a low cell.
    g.append(
      svgEl('rect', { x: p.x - r * 0.8, y: p.y, width: r * 1.6, height: r * 0.7, fill: '#4a4133', stroke: ink, 'stroke-width': 1.4 }),
      svgEl('path', { d: `M ${p.x} ${p.y - r * 1.1} V ${p.y} M ${p.x - r * 0.45} ${p.y - r * 0.7} H ${p.x + r * 0.45}`, stroke: ink, 'stroke-width': 1.8, fill: 'none' }),
    );
  } else if (place.kind === 'town') {
    // Three gables shoulder to shoulder: more roofs than anywhere else has.
    for (const dx of [-r * 0.9, 0, r * 0.9]) {
      g.append(
        svgEl('path', {
          d: `M ${p.x + dx - r * 0.45} ${p.y + r * 0.5} V ${p.y} L ${p.x + dx} ${p.y - r * 0.6} L ${p.x + dx + r * 0.45} ${p.y} V ${p.y + r * 0.5} Z`,
          fill: '#4a4133',
          stroke: ink,
          'stroke-width': 1.3,
        }),
      );
    }
  } else if (place.kind === 'wreck') {
    // A hull broken-backed: two arcs that no longer meet.
    g.append(
      svgEl('path', { d: `M ${p.x - r} ${p.y} Q ${p.x - r * 0.3} ${p.y + r * 0.8} ${p.x - r * 0.05} ${p.y + r * 0.3}`, stroke: ink, 'stroke-width': 1.8, fill: 'none' }),
      svgEl('path', { d: `M ${p.x + r} ${p.y - r * 0.2} Q ${p.x + r * 0.4} ${p.y + r * 0.7} ${p.x + r * 0.1} ${p.y + r * 0.35}`, stroke: ink, 'stroke-width': 1.8, fill: 'none' }),
    );
  } else {
    // Ore: a stain in the ground with heavy stones in it.
    g.append(
      svgEl('circle', { cx: p.x, cy: p.y + r * 0.2, r: r * 0.55, fill: '#8a4f2d', opacity: 0.7 }),
      svgEl('circle', { cx: p.x - r * 0.3, cy: p.y, r: r * 0.18, fill: ink }),
      svgEl('circle', { cx: p.x + r * 0.25, cy: p.y + r * 0.35, r: r * 0.14, fill: ink }),
    );
  }
  return g;
}

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
/**
 * The band, drawn at the ORIGIN rather than at its hex.
 *
 * Position is a transform on the group, which is what lets the token glide
 * from one hex to the next instead of teleporting: the element persists
 * across repaints and a CSS transition on `transform` does the rest, with no
 * animation frame and no timer on the game side. Everything here stays
 * turn-based — the state moved the instant the tap landed; only the picture
 * takes a moment to catch up.
 */
function partyToken(): SVGGElement {
  const s = HEX_SIZE;
  const g = svgEl('g', { class: 'party-token' });

  g.append(
    // The shield he is standing behind, and the dark disc that keeps the
    // whole thing legible over meadow, sand or snow alike.
    svgEl('circle', { cx: 0, cy: 0, r: s * 0.48, fill: '#1d1a14', opacity: 0.6 }),
    svgEl('circle', {
      cx: 0,
      cy: 0,
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
        `M ${-s * 0.27} ${-s * 0.04} ` +
        `Q 0 ${s * 0.52} ${s * 0.27} ${-s * 0.04} Z`,
      fill: '#c9a15c',
      stroke: '#2a2318',
      'stroke-width': 1.1,
    }),
    // Helm: a dome sitting on the brow line, filling most of the disc.
    svgEl('path', {
      d:
        `M ${-s * 0.3} ${-s * 0.04} ` +
        `Q ${-s * 0.3} ${-s * 0.4} 0 ${-s * 0.4} ` +
        `Q ${s * 0.3} ${-s * 0.4} ${s * 0.3} ${-s * 0.04} Z`,
      fill: '#98a1ad',
      stroke: '#2a2318',
      'stroke-width': 1.3,
    }),
    // Nasal bar down past the brow, and a dark eye either side of it.
    svgEl('rect', {
      x: -s * 0.055,
      y: -s * 0.14,
      width: s * 0.11,
      height: s * 0.26,
      fill: '#98a1ad',
      stroke: '#2a2318',
      'stroke-width': 1,
    }),
    svgEl('rect', { x: -s * 0.22, y: -s * 0.13, width: s * 0.13, height: s * 0.09, fill: '#2a2318' }),
    svgEl('rect', { x: s * 0.09, y: -s * 0.13, width: s * 0.13, height: s * 0.09, fill: '#2a2318' }),
  );
  return g;
}

/** The same band, afloat: the knarr under them, shields on the rail. Also at the origin. */
function shipToken(): SVGGElement {
  const s = HEX_SIZE;
  const g = svgEl('g', { class: 'party-token afloat' });
  const half = s * 0.5;

  g.append(
    svgEl('ellipse', { cx: 0, cy: s * 0.18, rx: s * 0.62, ry: s * 0.26, fill: '#1d1a14', opacity: 0.45 }),
    // Mast, then the square sail on it: one red stripe on undyed wool, which
    // is the whole of what a longship reads as at this size.
    svgEl('line', {
      x1: 0, y1: -s * 0.56, x2: 0, y2: s * 0.16,
      stroke: '#2a2318', 'stroke-width': 2.2,
    }),
    svgEl('rect', {
      x: -s * 0.3, y: -s * 0.52, width: s * 0.6, height: s * 0.4,
      fill: '#e8dcc0', stroke: '#2a2318', 'stroke-width': 1.2,
    }),
    svgEl('rect', { x: -s * 0.3, y: -s * 0.38, width: s * 0.6, height: s * 0.13, fill: '#b23b2e' }),
    // Hull: a shallow curve rising to a stem at each end.
    svgEl('path', {
      d:
        `M ${-half} ${s * 0.02} ` +
        `Q 0 ${s * 0.5} ${half} ${s * 0.02} ` +
        `L ${half * 0.8} ${-s * 0.14} ` +
        `Q 0 ${s * 0.26} ${-half * 0.8} ${-s * 0.14} Z`,
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

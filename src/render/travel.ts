// TRAVEL renderer: the world map as layered SVG. Pure view — it reads state
// and emits a hex click; it never mutates anything.

import { cornerPoints, corners, fromKey, fromPixel, key, neighbors, toPixel, type Hex } from '../hex';
import { terrainDef } from '../data/terrain';
import type { GameState, Neighbour, Place, Tile } from '../state/types';
import { clanKind, standingFor } from '../data/clans';
import { atSea, deepOcean, moveOptions } from '../sim/road';
import { rivalSettled } from '../sim/rival';
import { charted, crossed } from '../sim/skerry';
import { mapDefs, svgEl } from './svg';
import { isIdle, repaintWork, type Lit } from './repaint';
import { anchored, midpoint, spread, worldAt, type Camera } from './camera';
import { deepOceanFill, reliefDef, terrainFill, terrainPatterns } from './terrainArt';
import { seasonTint } from './fieldWeather';
import { seasonOf } from '../sim/calendar';
import { makeRng } from '../rng';

export const HEX_SIZE = 26;

export interface TravelView {
  root: SVGSVGElement;
  /** Re-paints from current state, preserving the camera. */
  update(state: GameState): void;
  /** Centres the camera on a hex. */
  centreOn(h: Hex): void;
}

function tileFill(tile: Tile, visible: boolean, deep: boolean): string {
  if (deep) return deepOceanFill(visible);
  return terrainFill(tile.terrain, visible);
}

/**
 * Open water, asked of the sim rather than decided here: `deepOcean` is the
 * same predicate that refuses the crossing, so the map cannot promise water
 * the knarr will not row. Read off the STATIC tiles like the sim's is, so a
 * hex's depth never changes once drawn — which is what lets it live in the
 * fill and ride the build-once/relight-only repaint path untouched.
 */
function isDeep(state: GameState, k: string): boolean {
  return deepOcean(state, fromKey(k));
}

/**
 * The surf line: this ocean hex's edges that face land, as one path.
 *
 * Built from the static tiles like the depth is. A foam edge can face land
 * the fog has not lifted from, which is technically a whisper about the
 * coastline — accepted, because sight always reaches further than one hex,
 * so by the time a player can SEE the foam they can see the shore it breaks
 * on.
 */
function foamPath(state: GameState, p: { x: number; y: number }): string {
  const ring = corners(p.x, p.y, HEX_SIZE - 1.5);
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 6]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The hex on the far side of this edge, found by stepping through it —
    // no corner-to-direction table to get quietly wrong.
    const across = fromPixel(p.x + (mid.x - p.x) * 2, p.y + (mid.y - p.y) * 2, HEX_SIZE);
    const there = state.world.tiles[key(across)];
    if (!there || there.terrain === 'ocean') continue;
    d += `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} `;
  }
  return d;
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
  defs.append(...terrainPatterns(), reliefDef());
  root.append(defs);

  const sea = svgEl('rect', { class: 'sea', x: -4000, y: -4000, width: 12000, height: 12000 });
  const layerTerrain = svgEl('g');
  const layerRivers = svgEl('g');
  // The season's light over the country (art queue item 10): one tinted
  // rect, swapped only when the season turns. Under the overlay so every
  // gameplay mark stays full-strength.
  const layerLight = svgEl('g');
  const layerOverlay = svgEl('g');
  const layerParty = svgEl('g');
  root.append(sea, layerTerrain, layerRivers, layerLight, layerOverlay, layerParty);
  let litSeason = '';

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
  const drawn = new Map<
    string,
    { poly: SVGPolygonElement; river: SVGCircleElement | null; foam: SVGPathElement | null }
  >();
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

    const season = seasonOf(state.day);
    if (season !== litSeason) {
      litSeason = season;
      layerLight.replaceChildren();
      // The tint covers the sea rect's whole reach, so panning never finds
      // its edge.
      const tint = seasonTint(season, { x: -4000, y: -4000, w: 12000, h: 12000 });
      if (tint) layerLight.append(tint);
    }

    // Where we could step next — and which of those crossings the band knows
    // has rock in it. A three-hex row passes over water the player is not
    // looking at, so the marker itself has to carry the warning: seeing the
    // skerry on the map is no use if the route to somewhere else runs over
    // it.
    for (const option of travelOptions(state)) {
      const p = toPixel(option, HEX_SIZE);
      const overRock = crossed(state.party.at, option).some(
        (h) => state.world.seen[key(h)] && charted(state, h),
      );
      layerOverlay.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX_SIZE - 3),
          fill: 'none',
          stroke: overRock ? '#d3a441' : '#e8dcc0',
          'stroke-width': 2,
          'stroke-dasharray': overRock ? '2 4' : '5 5',
          opacity: overRock ? 0.9 : 0.75,
        }),
      );
    }

    // Rocks the band has learnt about. Only charted ones: the sea keeps what
    // nobody has read yet, and a chart that showed rocks before they were
    // found would make the learning worthless.
    for (const k of state.world.charted ?? []) {
      if (!state.world.seen[k]) continue;
      const p = toPixel(fromKey(k), HEX_SIZE);
      layerOverlay.append(skerryMark(p.x, p.y));
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

    // The other landnam. Only what the band has actually laid eyes on: a
    // fence on ground nobody has walked is not something they could know.
    if (state.rival && rivalSettled(state)) {
      for (const k of state.rival.claims) {
        if (!state.world.seen[k]) continue;
        const at = fromKey(k);
        const p = toPixel(at, HEX_SIZE);
        // A WASH, not another outline. The first cut drew a dashed border in
        // his colour and it read as one more move marker at phone size —
        // claimed ground is an area, and an area is said with a fill.
        layerOverlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX_SIZE - 1),
            fill: '#8a2f24',
            'fill-opacity': 0.22,
            stroke: '#b23b2e',
            'stroke-width': 1.4,
            opacity: 0.9,
          }),
        );
      }
      if (state.world.seen[key(state.rival.at)]) {
        layerOverlay.append(rivalHall(state.rival.at));
      }
    }

    // A camped band has a fire going: the glow is the mark of a night's rest,
    // gone the moment they move on.
    if (state.party.hasCamped && !atSea(state)) {
      const p = toPixel(state.party.at, HEX_SIZE);
      layerOverlay.append(
        svgEl('circle', {
          cx: p.x, cy: p.y + HEX_SIZE * 0.2, r: HEX_SIZE * 0.55,
          class: 'campglow', fill: '#d3a441',
        }),
      );
    }

    // Some days there are birds over the water. Seeded from the day, so a
    // replay has the same sky; near the band, so they are actually seen.
    const birdRng = makeRng(`landnam-birds:${state.seed}:${state.day}`);
    if (birdRng.next() < 0.35) {
      const water = neighbors(state.party.at)
        .concat(neighbors(state.party.at).flatMap((n) => neighbors(n)))
        .filter((h) => {
          const k = key(h);
          return state.world.seen[k] && state.world.tiles[k]?.terrain === 'ocean';
        });
      if (water.length > 0) {
        const at = toPixel(birdRng.pick(water), HEX_SIZE);
        for (const [dx, dy] of [[0, 0], [7, -4], [-6, -7]] as const) {
          layerOverlay.append(
            svgEl('path', {
              d: `M ${at.x + dx - 3} ${at.y + dy} q 3 -2.6 3 0 q 0 -2.6 3 0`,
              class: 'bird',
              fill: 'none',
              stroke: '#dfe6ea',
              'stroke-width': 1.1,
              opacity: 0.8,
            }),
          );
        }
      }
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

      const deep = isDeep(state, k);
      const poly = svgEl('polygon', {
        points: cornerPoints(p.x, p.y, HEX_SIZE),
        fill: tileFill(tile, visible, deep),
        stroke: terrainDef(tile.terrain).edge,
        'stroke-width': 1,
        opacity: visible ? 1 : 0.55,
      });
      layerTerrain.append(poly);

      // Surf where the sea meets the land — built once with the hex, lit
      // with it, and costing the repaint nothing after that.
      let foam: SVGPathElement | null = null;
      if (tile.terrain === 'ocean' && !deep) {
        const d = foamPath(state, p);
        if (d) {
          foam = svgEl('path', {
            d,
            fill: 'none',
            stroke: '#e8f0f2',
            'stroke-width': 1.6,
            'stroke-linecap': 'round',
            opacity: visible ? 0.45 : 0.22,
          });
          layerRivers.append(foam);
        }
      }

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

      drawn.set(k, { poly, river, foam });
      lit.set(k, now);
    }

    for (const k of work.relit) {
      const held = drawn.get(k);
      const tile = state.world.tiles[k];
      const now = seen[k];
      if (!held || !tile || now === undefined) continue;
      const visible = now === 'visible';
      held.poly.setAttribute('fill', tileFill(tile, visible, isDeep(state, k)));
      held.poly.setAttribute('opacity', visible ? '1' : '0.55');
      held.river?.setAttribute('opacity', visible ? '0.85' : '0.4');
      held.foam?.setAttribute('opacity', visible ? '0.45' : '0.22');
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

  /**
   * What the map offers — the sim's own list, not a second one kept here.
   *
   * This used to be `neighbors` filtered by `moveEffort`, which knew nothing
   * about the leash on a returning expedition, nothing about a settled band,
   * and — the one that was actually costing the player moves — nothing about
   * the knarr's day of rowing. `moveOptions` has computed all of it since the
   * rowing work and had NO caller in src/: 60 legal moves over 15 afloat
   * turns were never drawn, so the sea read as a wall three hexes thick.
   */
  function travelOptions(state: GameState): Hex[] {
    if (state.event || state.end) return [];
    return moveOptions(state);
  }

  // Pointer handling: drag to pan, pinch to zoom, tap to move.
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  let pinchStart = 0;
  let pinchZoom = 1;
  /** Where the fingers were centred last move, so the pinch can hold a point. */
  let lastMid: { x: number; y: number } | null = null;

  root.addEventListener('pointerdown', (e) => {
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchStart = spread(pointers.values());
      pinchZoom = camera.zoom;
      lastMid = midpoint(pointers.values());
    }
    dragged = false;
  });

  root.addEventListener('pointermove', (e) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const mid = midpoint(pointers.values());
      if (pinchStart > 0 && mid && lastMid) {
        const rect = root.getBoundingClientRect();
        const view = { width: rect.width, height: rect.height };
        // The world point between the fingers BEFORE this move, put back
        // between them after it. That is the pinch anchored and the
        // two-finger pan, in one call — see render/camera.ts.
        const hold = worldAt(camera, view, offsetIn(rect, lastMid));
        const next = anchored(
          hold,
          view,
          offsetIn(rect, mid),
          pinchZoom * (spread(pointers.values()) / pinchStart),
        );
        camera.x = next.x;
        camera.y = next.y;
        camera.zoom = next.zoom;
        applyCamera();
      }
      lastMid = mid;
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
    if (pointers.size < 2) {
      pinchStart = 0;
      lastMid = null;
    }
    if (!had || dragged || pointers.size > 0) return;
    if (!latest) return;
    const rect = root.getBoundingClientRect();
    const p = worldAt(camera, { width: rect.width, height: rect.height },
      offsetIn(rect, { x: e.clientX, y: e.clientY }));
    onHexTap(fromPixel(p.x, p.y, HEX_SIZE));
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
      // Under the cursor, for the same reason as under the fingers.
      const rect = root.getBoundingClientRect();
      const view = { width: rect.width, height: rect.height };
      const at = offsetIn(rect, { x: e.clientX, y: e.clientY });
      const next = anchored(
        worldAt(camera, view, at),
        view,
        at,
        camera.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
      );
      camera.x = next.x;
      camera.y = next.y;
      camera.zoom = next.zoom;
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

/** A client point as an offset inside the element. */
function offsetIn(rect: DOMRect, p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x - rect.left, y: p.y - rect.top };
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
  if (n.sackedOn === undefined) g.append(smoke(p.x + r * 0.5, p.y - r * 1.1));
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
/**
 * Hearth smoke: two puffs rising off a roof, looping. The one mark that says
 * somebody LIVES here rather than "a building stands here". Frozen static by
 * the stillness guards like every other loop.
 */
function smoke(x: number, y: number): SVGGElement {
  const g = svgEl('g', { class: 'smoke' });
  for (const [i, dx] of [[0, 0], [1, 2.4]] as const) {
    const puff = svgEl('circle', {
      cx: x + dx,
      cy: y,
      r: 1.6 + i * 0.5,
      fill: '#cfd8dc',
      class: `puff p${i}`,
    });
    g.append(puff);
  }
  return g;
}

/**
 * Rocks under the water: three teeth breaking the surface, in the surf's own
 * colour so they read as part of the sea rather than as another marker.
 */
function skerryMark(x: number, y: number): SVGGElement {
  const g = svgEl('g', { class: 'skerry' });
  const s = HEX_SIZE * 0.2;
  for (const [dx, scale] of [[-s * 1.2, 0.8], [0, 1], [s * 1.2, 0.7]] as const) {
    g.append(
      svgEl('path', {
        d: `M ${x + dx - s * 0.5 * scale} ${y + s * 0.5} L ${x + dx} ${y - s * scale} L ${x + dx + s * 0.5 * scale} ${y + s * 0.5} Z`,
        fill: '#4a555f',
        stroke: '#dfe6ea',
        'stroke-width': 0.8,
        opacity: 0.95,
      }),
    );
  }
  return g;
}

/**
 * Somebody else's hall: the same longhouse shape as ours, in their colour.
 * The same shape on purpose — he is doing what we are doing, and the map
 * should say so at a glance rather than mark him as a monster.
 */
function rivalHall(at: Hex): SVGGElement {
  const p = toPixel(at, HEX_SIZE);
  const w = HEX_SIZE * 0.5;
  const h = HEX_SIZE * 0.34;
  const g = svgEl('g', { class: 'rival-hall' });
  g.append(
    svgEl('path', {
      d: `M ${p.x - w} ${p.y + h} L ${p.x - w * 0.66} ${p.y - h} L ${p.x + w * 0.66} ${p.y - h} L ${p.x + w} ${p.y + h} Z`,
      fill: '#6b2b22',
      stroke: '#e8dcc0',
      'stroke-width': 1.2,
    }),
    smoke(p.x + w * 0.2, p.y - h * 0.9),
  );
  return g;
}

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
    smoke(p.x + w * 0.22, p.y - h * 0.55),
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
    // The wake: the water remembering where the keel has been. Two spreading
    // lines astern, drawn before everything so the hull sits on them.
    svgEl('path', {
      d: `M ${-s * 0.5} ${s * 0.22} q ${-s * 0.45} ${s * 0.1} ${-s * 0.95} ${s * 0.34}`
        + ` M ${-s * 0.5} ${s * 0.3} q ${-s * 0.4} ${s * 0.16} ${-s * 0.8} ${s * 0.5}`,
      fill: 'none',
      stroke: '#cfe0e8',
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
      opacity: 0.5,
    }),
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

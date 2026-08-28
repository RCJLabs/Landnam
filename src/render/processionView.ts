// Drawing the procession. The hand; `render/procession.ts` is the head.
//
// Shaped as a `TravelView` on purpose: `travelScreen.ts` owns a singleton map
// view, mounts it once, and re-paints it every render. Meeting that interface
// rather than inventing a second one means the screen picks a view by flag
// and everything around it — the camera survives a battle, the ambience is
// read off the same render — keeps working unchanged.

import { createFieldPaint } from './fieldOil';
import { figure } from './figures';
import { svgEl } from './svg';
import {
  BAND_X, HORIZON_Y, ROAD_Y, SCENE_H, SCENE_W, WALKER_R, fileSpots,
  processionScene, whereWeAre, type Sighting,
} from './procession';
import { ROUTE_STOPS } from '../sim/route';
import type { GameState } from '../state/types';
import type { TravelView } from './views';

/** `svgEl` takes Nodes; every label here is a string. */
function words(text: string): Node[] {
  return [document.createTextNode(text)];
}

/**
 * A thing on the coast, drawn as a shape rather than an icon.
 *
 * Silhouettes, because the milestone's bar is that distance reads as
 * distance: these are placed and sized by `sightAt`, so the nearer one is
 * simply bigger and lower, and no legend is needed to say which.
 */
function silhouette(s: Sighting): SVGGElement {
  const g = svgEl('g', {
    class: `sight sight-${s.kind}`,
    transform: `translate(${s.x} ${s.y}) scale(${s.scale})`,
    // Further off is hazier, which is the other half of how distance reads.
    opacity: 0.45 + 0.5 * s.scale,
  });
  const ink = s.ink ?? '#2f2a20';
  if (s.kind === 'place') {
    // A steep-roofed house with a tower: the shape of somewhere worth going.
    g.append(svgEl('path', {
      d: 'M -26 0 L -26 -22 L 0 -44 L 26 -22 L 26 0 Z M -6 -44 L -6 -66 L 6 -66 L 6 -44',
      fill: ink,
    }));
  } else if (s.kind === 'hall') {
    // Longer and lower, and it is ours, so it is not a silhouette but a
    // building with a lit door in it.
    g.append(svgEl('path', {
      d: 'M -40 0 L -40 -20 L 0 -40 L 40 -20 L 40 0 Z',
      fill: ink,
    }));
    // A lit door, because this one is ours and the difference should be
    // visible from a stretch away.
    g.append(svgEl('rect', { x: -7, y: -18, width: 14, height: 18, fill: '#e0a94f' }));
  } else if (s.kind === 'rival') {
    g.append(svgEl('path', { d: 'M -34 0 L -34 -18 L 0 -36 L 34 -18 L 34 0 Z', fill: ink }));
  } else {
    // A tent-line: a camp, not a building.
    g.append(svgEl('path', {
      d: 'M -30 0 L -14 -26 L 2 0 Z M 4 0 L 18 -20 L 32 0 Z',
      fill: ink,
    }));
  }
  return g;
}

/** The label under a sighting: what it is, and how far. */
function sightLabel(s: Sighting): SVGGElement {
  const g = svgEl('g', { class: 'sight-label' });
  g.append(svgEl('text', {
    x: s.x, y: s.y + 16, 'text-anchor': 'middle', class: 'sight-name',
    'font-size': Math.round(11 + 5 * s.scale),
  }, words(s.name)));
  g.append(svgEl('text', {
    x: s.x, y: s.y + 30, 'text-anchor': 'middle', class: 'sight-days',
    'font-size': Math.round(10 + 3 * s.scale),
  }, words(`${s.days} days on`)));
  return g;
}

/**
 * The travel view for a coast.
 *
 * A PICTURE, and only a picture. The two things a coast lets you do are
 * buttons in the action bar beside it, not shapes drawn on it — see
 * `travelScreen.ts`.
 *
 * That was not the first draft, and the reason it changed is worth keeping.
 * The steps were drawn into the scene at its bottom edge, which looked right
 * at 390x844 and was unpressable at 320x568: this SVG is `slice`, so it
 * overflows its slot, and on a short screen the bottom of the scene lands
 * 58px BELOW the bottom of the map slot, behind the site panel, which
 * swallows the tap. The bar caught it — `elementFromPoint` on the button's
 * own centre answered `span.site-word`. A verb drawn inside a cropped
 * picture has no reliable place to stand; the action bar does, and it is
 * where every other verb in this game already lives, with the 44px rule
 * enforced by CSS and checked by `reach.mjs`.
 */
export function createProcessionView(): TravelView {
  const root = svgEl('svg', {
    class: 'map procession',
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${SCENE_W} ${SCENE_H}`,
    preserveAspectRatio: 'xMidYMid slice',
    role: 'img',
  });

  // The painted country, the same brush the battlefield uses — which is the
  // whole reason the oil work in 8.1d was written where it was.
  const paint = createFieldPaint();
  root.append(paint.node);

  const layers = {
    sea: svgEl('g'),
    road: svgEl('g'),
    sights: svgEl('g'),
    band: svgEl('g'),
    ui: svgEl('g'),
  };
  root.append(layers.sea, layers.road, layers.sights, layers.band, layers.ui);

  // The cost meter the bars read. A still road must not move `work`, however
  // many repaints go past — the same rule `repaint.mjs` holds the hex view to.
  let drawnSights = 0;
  let work = 0;
  let lastKey = '';

  function update(state: GameState): void {
    const scene = processionScene(state);
    paint.update({ x: 0, y: 0, w: SCENE_W, h: SCENE_H }, scene.country, state.seed);

    // Everything below is rebuilt from the scene, so what makes a repaint
    // EXPENSIVE is the scene changing. Keyed on exactly what is drawn, which
    // is what lets a bar tell a still road from a busy one.
    const key = [
      scene.at, scene.country, scene.landmark ?? '',
      scene.ahead.map((a) => `${a.stop}:${a.kind}`).join(','),
      scene.onward?.stop ?? '-', scene.back?.stop ?? '-',
      state.party.people.filter((p) => p.alive).length,
    ].join('|');
    if (key !== lastKey) {
      lastKey = key;
      work += 1;
    }

    // The sea, because this is a coast and a coast has one. A flat band under
    // the horizon on the seaward side, so which way is "out" is never in
    // doubt.
    layers.sea.replaceChildren(
      svgEl('rect', {
        x: 0, y: HORIZON_Y - 8, width: SCENE_W, height: 26,
        fill: '#3f6a80', opacity: 0.55,
      }),
    );

    // The road: a band of ground running from under the band's feet to the
    // horizon, narrowing, so the picture has a direction in it.
    layers.road.replaceChildren(
      svgEl('path', {
        d: `M -20 ${SCENE_H} L ${BAND_X - 30} ${ROAD_Y} L ${SCENE_W * 0.9} ${HORIZON_Y + 6} ` +
           `L ${SCENE_W * 0.96} ${HORIZON_Y + 10} L ${SCENE_W + 40} ${SCENE_H} Z`,
        fill: '#6b5b3e', opacity: 0.4,
      }),
    );

    layers.sights.replaceChildren();
    for (const s of scene.ahead) {
      layers.sights.append(silhouette(s), sightLabel(s));
    }
    drawnSights = scene.ahead.length;

    // The band, walking. Real people, drawn by the same hand that draws them
    // in a fight — one Person, one look, everywhere.
    const walking = state.party.people.filter((p) => p.alive);
    const spots = fileSpots(walking.length);
    layers.band.replaceChildren();
    // Back of the file first, so the leader is painted over the ones behind.
    for (let i = walking.length - 1; i >= 0; i -= 1) {
      const spot = spots[i]!;
      layers.band.append(figure(spot.x, spot.y - WALKER_R, WALKER_R, walking[i]!, {
        friendly: true,
        health: walking[i]!.health ?? 100,
        active: i === 0,
        defending: false,
        broken: false,
        pennant: null,
      }));
    }

    // Where we are, said in words, and the two steps a coast offers. These
    // are on the picture rather than in a panel because the whole bar for
    // this milestone is that the picture answers it.
    layers.ui.replaceChildren();
    layers.ui.append(svgEl('text', {
      x: SCENE_W / 2, y: 34, 'text-anchor': 'middle', class: 'here-word',
    }, words(whereWeAre(scene))));

    if (scene.headland) {
      layers.ui.append(svgEl('text', {
        x: SCENE_W / 2, y: 58, 'text-anchor': 'middle', class: 'here-word',
      }, words('The land gives out here.')));
    }

    root.setAttribute(
      'aria-label',
      `${whereWeAre(scene)}. ${scene.ahead.length === 0
        ? 'Nothing in sight ahead.'
        : `Ahead: ${scene.ahead.map((s) => `${s.name}, ${s.days} days`).join('; ')}.`}`,
    );
  }

  return {
    root,
    nodes: [root],
    // The hex view's report, answered honestly for a coast rather than cast
    // into shape. `charted` is what this view is holding — the stretches it
    // can show — and `lit` is what it is actually showing right now.
    drawn: () => ({
      backend: 'oil' as const,
      charted: ROUTE_STOPS,
      lit: drawnSights,
      duplicates: 0,
      work,
    }),
    sample: (points: readonly (readonly [number, number])[]) => points.map(() => null),
    update,
    // A coast has no camera to move: the band is always in the middle of its
    // own stretch, because the picture IS where they are standing.
    centreOn: () => {},
  };
}

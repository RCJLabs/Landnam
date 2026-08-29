// Drawing the procession. The hand; `render/procession.ts` is the head.
//
// Shaped as a `TravelView` on purpose: `travelScreen.ts` owns a singleton map
// view, mounts it once, and re-paints it every render. Meeting that interface
// rather than inventing a second one means the screen picks a view by flag
// and everything around it — the camera survives a battle, the ambience is
// read off the same render — keeps working unchanged.

import { createFieldPaint } from './fieldOil';
import { seasonTint, skyNodes } from './fieldWeather';
import { lightAt, washOpacity } from './light';
import { makeRng } from '../rng';
import { walker } from './walker';
import { svgEl } from './svg';
import {
  BAND_X, HORIZON_Y, ROAD_Y, SCENE_W, WALKER_H, composeRoad, fileSpots,
  processionScene, skyWash, whereWeAre, type Sighting,
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
    // The frame is fitted to the slot by `composeRoad`, so `meet` and
    // `slice` are the same thing and nothing is cropped. It was `slice` over
    // a fixed 640-unit scene, which cropped 40 units off each end at
    // 390x599 — and the only painted ground there was lived in them.
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });

  // The road's own vignette. `fieldArt`'s is `#field-vignette` and the
  // battlefield owns it; two views cannot share one id when both may be in
  // the document, so the road defines its own with the same shape.
  const defs = svgEl('defs');
  const dusk = svgEl('radialGradient', {
    id: 'road-vignette', cx: '0.5', cy: '0.55', r: '0.78',
  });
  dusk.append(
    svgEl('stop', { offset: '0.45', 'stop-color': '#080b12', 'stop-opacity': 0 }),
    svgEl('stop', { offset: '1', 'stop-color': '#080b12', 'stop-opacity': 1 }),
  );
  // The campfire's glow. A flat ellipse read as a brown puddle on the road —
  // a glow is defined by its soft edge, so it needs a gradient, not a fill.
  const fireGlow = svgEl('radialGradient', { id: 'road-firelight', cx: '0.5', cy: '0.5', r: '0.5' });
  fireGlow.append(
    svgEl('stop', { offset: '0', 'stop-color': '#ffc061', 'stop-opacity': 1 }),
    svgEl('stop', { offset: '0.45', 'stop-color': '#e0a94f', 'stop-opacity': 0.45 }),
    svgEl('stop', { offset: '1', 'stop-color': '#e0a94f', 'stop-opacity': 0 }),
  );
  defs.append(dusk, fireGlow);
  root.append(defs);

  // The painted country, the same brush the battlefield uses — which is the
  // whole reason the oil work in 8.1d was written where it was.
  const paint = createFieldPaint();
  root.append(paint.node);

  const layers = {
    sea: svgEl('g'),
    road: svgEl('g'),
    sights: svgEl('g'),
    band: svgEl('g'),
    // The sky, OVER the band: rain is between the viewer and everything.
    // Same class the battlefield's layer carries, so the animation loop,
    // the stillness freeze and reduced-motion all come from the same CSS.
    weather: svgEl('g', { class: 'weather' }),
    fire: svgEl('g'),
    ui: svgEl('g'),
  };
  root.append(
    layers.sea, layers.road, layers.sights, layers.band, layers.weather,
    // The fire sits ABOVE the light, because a light source is not dimmed by
    // the night it lights. Under it the campfire was a grey triangle.
    layers.fire, layers.ui,
  );

  // The cost meter the bars read. A still road must not move `work`, however
  // many repaints go past — the same rule `repaint.mjs` holds the hex view to.
  let drawnSights = 0;
  let work = 0;
  let lastKey = '';
  let latest: GameState | null = null;

  function update(state: GameState): void {
    latest = state;
    const scene = processionScene(state);

    // The frame first: everything below is placed in the world it defines,
    // and the paint is handed the same box so its horizon is our horizon.
    const slot = root.getBoundingClientRect();
    const box = composeRoad(slot.width, slot.height);
    root.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    paint.update(box, scene.country, state.seed);

    // Everything below is rebuilt from the scene, so what makes a repaint
    // EXPENSIVE is the scene changing. Keyed on exactly what is drawn, which
    // is what lets a bar tell a still road from a busy one.
    const key = [
      scene.at, scene.country, scene.landmark ?? '',
      scene.weather, scene.season, scene.camped ? 'night' : 'day',
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
        x: 0, y: HORIZON_Y - 26, width: SCENE_W, height: 26,
        // A gale's sea is darker before it is anything else.
        fill: scene.weather === 'gale' ? '#31586e' : '#3f6a80',
        opacity: 0.55,
      }),
    );
    if (scene.weather === 'gale') {
      // Whitecaps: broken water on the band of sea, seeded once so the same
      // day shows the same sea. Static on purpose — see `skyWash`.
      const caps = makeRng('landnam-whitecaps');
      for (let i = 0; i < 12; i += 1) {
        const x = caps.float(0.03, 0.95) * SCENE_W;
        const y = HORIZON_Y - 6 + caps.float(0, 20);
        layers.sea.append(svgEl('path', {
          d: `M ${x} ${y} q 3 -2.4 6 0`,
          class: 'whitecap',
          fill: 'none',
          stroke: '#dfe6ea',
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
          opacity: 0.7,
        }));
      }
    }

    // The road: a band of ground running from under the band's feet to the
    // horizon, narrowing, so the picture has a direction in it.
    layers.road.replaceChildren(
      svgEl('path', {
        // From under the band's feet to the horizon, narrowing — a track
        // worn across the brushed earth rather than a wedge over the sky.
        d: `M -30 ${box.y + box.h} L ${BAND_X - 54} ${ROAD_Y + 6} ` +
           `L ${SCENE_W * 0.86} ${HORIZON_Y + 1} L ${SCENE_W * 0.94} ${HORIZON_Y + 5} ` +
           `L ${SCENE_W + 50} ${box.y + box.h} Z`,
        // Under a hard frost the road rimes over: the one static mark that
        // tells a still frost from a still sea fog, since both wash pale.
        //
        // DARKER than the earth otherwise, not lighter. A path is where the
        // turf has been walked off; at 0.4 of a mid-brown over the brush's
        // own mid-brown it was invisible, which is why the first version of
        // this looked like a wedge of nothing.
        fill: scene.weather === 'frost' ? '#c2cdd2' : '#3f3524',
        opacity: scene.weather === 'frost' ? 0.55 : 0.28,
        ...(scene.weather === 'frost' ? { class: 'rimed' } : {}),
      }),
    );

    layers.sights.replaceChildren();
    for (const s of scene.ahead) {
      layers.sights.append(silhouette(s), sightLabel(s));
    }
    drawnSights = scene.ahead.length;

    // The band, walking. Real people, and now people seen from the side:
    // `walker()` reads the same `look.ts` the battle figure does, so the
    // shield on a man's back on the road is the shield on his arm in the
    // line. That is Art 13's whole claim, and it is the reason the look
    // moved out of `figures.ts` rather than being copied.
    //
    // It also fixes a defect that had been in this view since it was
    // written: `health` here was the person's HIT POINTS, and `figure()`
    // wants a fraction. At 20 of 20 hale it drew the health bar
    // `radius * 2 * 20` wide — a green rectangle a thousand units across,
    // under every walker, which on a `slice` viewBox simply painted over the
    // road. It also meant nobody on the road ever showed a scratch, because
    // 20 is never less than 0.67.
    const walking = state.party.people.filter((p) => p.alive);
    const spots = fileSpots(walking.length);
    layers.band.replaceChildren();
    // Back of the file first, so the leader is painted over the ones behind.
    for (let i = walking.length - 1; i >= 0; i -= 1) {
      const spot = spots[i]!;
      const person = walking[i]!;
      layers.band.append(walker(spot.x, spot.y, WALKER_H * spot.scale, person, {
        friendly: true,
        health: person.maxHealth > 0 ? person.health / person.maxHealth : 1,
        // The road runs to the right, which is where the sightings stand, so
        // the band walks toward them.
        facing: 1,
        walking: true,
        leader: i === 0,
        // The sworn bear arms; the hands the steading has taken in do not.
        // Every walker carried a war shield until Art 14, which told a lie
        // about who in this band would ever stand in a wall.
        arms: person.bond === 'sworn',
      }));
    }

    // The sky, in coats: the season's own colour, the light of the hour the
    // year is at, the named weather's static wash (there even with every
    // animation stilled), and the moving weather the battlefield draws.
    layers.weather.replaceChildren();
    const bounds = box;
    const tint = seasonTint(scene.season, bounds);
    if (tint) layers.weather.append(tint);

    // THE LIGHT (Art 15). One wash and one vignette, both driven by
    // `light.ts` off the season and whether the band has camped — see that
    // file for why those two and not a clock.
    const light = lightAt(scene.season, scene.camped);
    const lightWash = washOpacity(light.level);
    if (lightWash > 0) {
      layers.weather.append(svgEl('rect', {
        x: box.x, y: box.y, width: box.w, height: box.h,
        class: 'lightwash',
        fill: light.tint,
        opacity: lightWash,
      }));
    }
    if (light.stars) {
      // Stars, seeded once so the same night has the same sky. Only above
      // the horizon, and never in summer — see `STAR_LEVEL`.
      const sky = makeRng('landnam-stars');
      const field = svgEl('g', { class: 'starfield' });
      for (let i = 0; i < 40; i += 1) {
        field.append(svgEl('circle', {
          cx: sky.float(0, 1) * SCENE_W,
          cy: box.y + sky.float(0.02, 0.86) * (HORIZON_Y - box.y),
          r: sky.float(0.5, 1.5),
          class: 'star',
          fill: '#e8ecf2',
          opacity: sky.float(0.35, 0.9).toFixed(2),
        }));
      }
      layers.weather.append(field);
    }
    const wash = skyWash(scene.weather);
    if (wash) {
      layers.weather.append(svgEl('rect', {
        x: box.x, y: box.y, width: box.w, height: box.h,
        class: 'skywash',
        fill: wash.fill,
        opacity: wash.opacity,
      }));
    }
    layers.weather.append(...skyNodes(scene.weather, bounds));

    // A camped band has a fire, and the fire is why they are not walking.
    // Above the light wash, so it lights the night rather than being dimmed
    // by it — and it burns brighter the darker the night is.
    layers.fire.replaceChildren();
    if (scene.camped) {
      const fireX = BAND_X + WALKER_H * 0.5;
      const glow = 0.22 + (1 - light.level) * 0.5;
      layers.fire.append(
        svgEl('ellipse', {
          cx: fireX, cy: ROAD_Y - 6, rx: WALKER_H * 1.15, ry: WALKER_H * 0.5,
          class: 'campglow', fill: 'url(#road-firelight)', opacity: glow.toFixed(2),
        }),
        svgEl('path', {
          d: `M ${fireX - 9} ${ROAD_Y} q 4 -9 2 -17 q 6 6 7 17 Z`,
          fill: '#e88f36',
        }),
        svgEl('path', {
          d: `M ${fireX - 4} ${ROAD_Y} q 2 -6 1 -11 q 4 4 5 11 Z`,
          fill: '#f7dda2',
        }),
      );
    }

    // Night closes the frame in: you see as far as the fire.
    layers.weather.append(svgEl('rect', {
      x: box.x, y: box.y, width: box.w, height: box.h,
      class: 'nightfall',
      fill: 'url(#road-vignette)',
      opacity: light.vignette,
    }));

    // Where we are, said in words, and the two steps a coast offers. These
    // are on the picture rather than in a panel because the whole bar for
    // this milestone is that the picture answers it.
    layers.ui.replaceChildren();
    layers.ui.append(svgEl('text', {
      x: SCENE_W / 2, y: box.y + 30, 'text-anchor': 'middle', class: 'here-word',
    }, words(whereWeAre(scene))));

    if (scene.headland) {
      layers.ui.append(svgEl('text', {
        x: SCENE_W / 2, y: box.y + 54, 'text-anchor': 'middle', class: 'here-word',
      }, words('The land gives out here.')));
    }

    root.setAttribute(
      'aria-label',
      `${whereWeAre(scene)}. ${scene.ahead.length === 0
        ? 'Nothing in sight ahead.'
        : `Ahead: ${scene.ahead.map((s) => `${s.name}, ${s.days} days`).join('; ')}.`}`,
    );
  }

  // The slot is `flex` under panels that grow and shrink, so the frame has to
  // follow the element — the same observer the battlefield and the yard use.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (latest) update(latest);
    }).observe(root);
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

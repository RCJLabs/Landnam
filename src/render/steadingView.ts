// Drawing the steading. The hand; `render/steading.ts` is the head.

import { createFieldPaint } from './fieldOil';
import { figure } from './figures';
import { svgEl } from './svg';
import {
  GROUND_Y, HOUSE_HALF, ROOF_OVERSAIL, YARD_H, steadingScene, type Raised, type Standing,
} from './steading';
import { countryHere } from '../sim/coast';
import type { GameState } from '../state/types';
import type { ColonyView } from './colony';

/** `svgEl` takes Nodes; every label here is a string. */
function words(text: string): Node[] {
  return [document.createTextNode(text)];
}

/**
 * One building, standing.
 *
 * A turf longhouse in profile: low walls, a steep roof, a door and a smoke
 * hole. Sized by `sizeOf` so a hall reads as bigger than a byre, and drawn
 * PART-BUILT when it is the one in hand — posts and a bare frame, filling in
 * as the builder-days go on, because that is the milestone's bar: raising a
 * building has to visibly change the steading.
 */
function house(r: Raised): SVGGElement {
  const g = svgEl('g', {
    class: `raised raised-${r.id}${r.done < 1 ? ' building' : ''}`,
    transform: `translate(${r.x} ${GROUND_Y}) scale(${r.size})`,
  });
  // From `steading.ts`, which lays the slots out with the same number. Two
  // copies of a width is how a building ends up off the edge of its own yard.
  const w = HOUSE_HALF;
  const wall = 22;
  const roof = 30;

  if (r.done < 1) {
    // Posts first, then the roof line closing over them. Nothing is filled
    // in: scaffolding should read as scaffolding at a glance.
    const up = roof * r.done;
    g.append(svgEl('path', {
      d: `M ${-w} 0 L ${-w} ${-wall} M ${w} 0 L ${w} ${-wall} M ${-w} ${-wall} L ${w} ${-wall}`,
      stroke: '#6f6350', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round',
    }));
    g.append(svgEl('path', {
      d: `M ${-w} ${-wall} L 0 ${-wall - up} L ${w} ${-wall}`,
      stroke: '#8a7c5e', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round',
      'stroke-dasharray': '6 4',
    }));
    return g;
  }

  // Turf walls.
  g.append(svgEl('rect', {
    x: -w, y: -wall, width: w * 2, height: wall,
    fill: '#5d5340', stroke: '#3a3324', 'stroke-width': 1.2,
  }));
  // Thatched roof, oversailing the walls the way a real one does.
  g.append(svgEl('path', {
    d: `M ${-w - ROOF_OVERSAIL} ${-wall} L 0 ${-wall - roof} L ${w + ROOF_OVERSAIL} ${-wall} Z`,
    fill: '#7a6647', stroke: '#3a3324', 'stroke-width': 1.2,
  }));
  // A lit door: a steading with people in it.
  g.append(svgEl('rect', {
    x: -5, y: -wall + 4, width: 10, height: wall - 4, fill: '#e0a94f', opacity: 0.9,
  }));
  return g;
}

/** Who is in the yard, drawn by the same hand that draws them in a fight. */
function folkMark(s: Standing): SVGGElement {
  const g = svgEl('g', { class: 'yard-folk' });
  g.append(figure(s.x, s.y - 15, 15, s.person, {
    friendly: true,
    health: s.person.health ?? 100,
    active: false,
    defending: false,
    broken: false,
    pennant: null,
  }));
  return g;
}

/**
 * The colony view for a coast.
 *
 * Same `ColonyView` shape the hex one meets, so `colonyScreen.ts` picks by
 * flag and nothing downstream changes.
 */
export function createSteadingView(): ColonyView {
  const root = svgEl('svg', {
    class: 'steading-map elevation',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });

  const paint = createFieldPaint();
  root.append(paint.node);
  const layers = { ground: svgEl('g'), houses: svgEl('g'), folk: svgEl('g'), ui: svgEl('g') };
  root.append(layers.ground, layers.houses, layers.folk, layers.ui);

  let plots = 0;

  function update(state: GameState): void {
    const scene = steadingScene(state);
    root.setAttribute('viewBox', `0 0 ${scene.width} ${YARD_H}`);
    paint.update({ x: 0, y: 0, w: scene.width, h: YARD_H }, countryHere(state), state.seed);

    // The ground the steading stands on: one band, so the buildings have
    // something to sit on rather than floating over the painting.
    layers.ground.replaceChildren(svgEl('rect', {
      x: 0, y: GROUND_Y, width: scene.width, height: YARD_H - GROUND_Y,
      fill: '#4f4634', opacity: 0.75,
    }));

    layers.houses.replaceChildren();
    for (const r of scene.raised) layers.houses.append(house(r));

    layers.folk.replaceChildren();
    for (const s of scene.folk) layers.folk.append(folkMark(s));

    layers.ui.replaceChildren();
    if (scene.name) {
      layers.ui.append(svgEl('text', {
        x: scene.width / 2, y: 26, 'text-anchor': 'middle', class: 'here-word',
      }, words(scene.name)));
    }
    if (scene.raised.length === 0) {
      layers.ui.append(svgEl('text', {
        x: scene.width / 2, y: GROUND_Y - 40, 'text-anchor': 'middle', class: 'here-word',
      }, words('Bare ground, and posts in it.')));
    }

    plots = state.settlement?.plots.length ?? 0;
    root.setAttribute(
      'aria-label',
      scene.name
        ? `${scene.name}. ${scene.raised.filter((r) => r.done >= 1).length} standing: ` +
          `${scene.raised.filter((r) => r.done >= 1).map((r) => r.name).join(', ') || 'nothing yet'}.`
        : 'No steading.',
    );
  }

  return {
    root,
    update,
    drawn: () => ({
      backend: 'oil' as const,
      plots,
      ...paint.stats(),
    }),
  };
}

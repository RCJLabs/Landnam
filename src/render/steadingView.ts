// Drawing the steading. The hand; `render/steading.ts` is the head.

import { createFieldPaint } from './fieldOil';
import { makeRng } from '../rng';
import { walker } from './walker';
import { svgEl } from './svg';
import {
  FOLK_H, GROUND_Y, HOUSE_HALF, ROOF_OVERSAIL, composeYard, steadingScene,
  type Raised, type Standing, type SteadingScene,
} from './steading';
import { mix } from './terrainArt';
import { countryHere } from '../sim/coast';
import type { GameState } from '../state/types';
import type { ColonyView } from './views';

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
 *
 * `greened` ages it: fresh-cut turf is brown-grey, and over GREENED_DAYS it
 * knits and greens, so a hall that has stood two winters looks like it.
 */
function house(r: Raised, greened: number): SVGGElement {
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

  // Turf walls, greening as they stand.
  g.append(svgEl('rect', {
    x: -w, y: -wall, width: w * 2, height: wall,
    fill: mix('#5d5340', '#4d5c38', greened * 0.75),
    stroke: '#3a3324', 'stroke-width': 1.2,
  }));
  // Thatched roof, oversailing the walls the way a real one does — and
  // weathering darker while the walls green, so age moves two colours at
  // once rather than one dial.
  g.append(svgEl('path', {
    d: `M ${-w - ROOF_OVERSAIL} ${-wall} L 0 ${-wall - roof} L ${w + ROOF_OVERSAIL} ${-wall} Z`,
    fill: mix('#7a6647', '#5c5038', greened * 0.6),
    stroke: '#3a3324', 'stroke-width': 1.2,
  }));
  // A lit door: a steading with people in it.
  g.append(svgEl('rect', {
    x: -5, y: -wall + 4, width: 10, height: wall - 4, fill: '#e0a94f', opacity: 0.9,
  }));
  return g;
}

/**
 * Who is in the yard, drawn by the same hand that draws them on the road.
 *
 * Standing rather than walking, and turned to face the middle of the yard so
 * a household reads as people who live together rather than a queue.
 *
 * The health argument was the person's HIT POINTS here too, and `figure()`
 * wants a fraction — see the note in `processionView.ts`. It drew a health
 * bar thirty times too wide across the bottom of the yard, once per head.
 */
function folkMark(s: Standing, middle: number): SVGGElement {
  const g = svgEl('g', { class: 'yard-folk' });
  g.append(walker(s.x, s.y, FOLK_H, s.person, {
    friendly: true,
    health: s.person.maxHealth > 0 ? s.person.health / s.person.maxHealth : 1,
    facing: s.x > middle ? -1 : 1,
    walking: false,
    leader: false,
    doing: s.job,
  }));
  return g;
}

/**
 * Smoke over the first house's roof-hole.
 *
 * Two pale wisps, seeded off the steading's name so the curl is this
 * steading's and stays put across repaints. Animated by CSS (`.hearth-smoke`)
 * because drift is polish; the still picture already says what it must.
 */
function smokeOver(scene: SteadingScene): SVGGElement {
  const first = scene.raised.find((r) => r.done >= 1)!;
  const top = GROUND_Y - 52 * first.size;
  const rng = makeRng(`landnam-smoke:${scene.name}`);
  const g = svgEl('g', { class: 'hearth-smoke' });
  for (let i = 0; i < 2; i += 1) {
    const sway = rng.float(6, 13) * (i === 0 ? 1 : -1);
    g.append(svgEl('path', {
      d: `M ${first.x} ${top - i * 4}` +
         ` q ${sway} ${-14 - rng.float(0, 6)} ${sway * 0.4} ${-26 - i * 8}` +
         ` q ${-sway * 0.8} ${-12} ${sway * 0.3} ${-22}`,
      fill: 'none',
      stroke: '#cfd3d6',
      'stroke-width': 2.6 - i,
      'stroke-linecap': 'round',
      opacity: 0.4 - i * 0.12,
    }));
  }
  return g;
}

/**
 * The marks a lived-in yard accumulates: the path feet wear in front of the
 * houses, the woodpile against winter, the field rows on the open ground
 * past the last house. Every input is a scene fact, so day 20 and day 200
 * differ here without a caption — which is the milestone's whole bar.
 */
function groundMarks(scene: SteadingScene): SVGGElement {
  const g = svgEl('g', { class: 'yard-marks' });

  // The trodden path, along the house fronts. Raw earth first, wearing
  // darker and wider with the days.
  if (scene.trodden > 0.02 && scene.raised.length > 0) {
    const last = scene.raised[scene.raised.length - 1]!;
    g.append(svgEl('ellipse', {
      cx: (scene.raised[0]!.x + last.x) / 2,
      cy: GROUND_Y + 8,
      rx: Math.max(60, (last.x - scene.raised[0]!.x) / 2 + 50),
      ry: 6 + 5 * scene.trodden,
      fill: '#3f3628',
      opacity: 0.14 + 0.3 * scene.trodden,
      class: 'trodden',
    }));
  }

  // The woodpile: stacked log-ends by the left margin, counted off the
  // actual firewood rather than invented.
  const logs = Math.round(scene.woodpile * 9);
  if (logs > 0) {
    const pile = svgEl('g', { class: 'woodpile' });
    for (let i = 0; i < logs; i += 1) {
      const row = Math.floor(i / 3);
      pile.append(svgEl('circle', {
        cx: 16 + (i % 3) * 9 + row * 4.5,
        cy: GROUND_Y - 4 - row * 8,
        r: 4.4,
        fill: '#8a6f43',
        stroke: '#4a3c26',
        'stroke-width': 1.2,
      }));
    }
    g.append(pile);
  }

  // The fields, on the open ground past the last house: furrow rows when
  // somebody is actually farming them, sparse tufts when the ground merely
  // could be. The difference between owning land and working it.
  if (scene.fields.count > 0 && scene.raised.length > 0) {
    const from = scene.raised[scene.raised.length - 1]!.x + HOUSE_HALF * 1.6;
    const to = scene.width - 12;
    if (to - from > 40) {
      const rows = svgEl('g', { class: scene.fields.tilled ? 'fields tilled' : 'fields' });
      const n = Math.min(scene.fields.count + 2, 6);
      for (let i = 0; i < n; i += 1) {
        const y = GROUND_Y - 3 - i * 4.5;
        // Rows foreshorten away from the yard, the cheap way.
        const inset = i * (to - from) * 0.06;
        rows.append(svgEl('line', {
          x1: from + inset, y1: y, x2: to - inset * 0.4, y2: y,
          stroke: scene.fields.tilled ? '#4a3d26' : '#5d6142',
          'stroke-width': scene.fields.tilled ? 2.2 : 1.2,
          'stroke-dasharray': scene.fields.tilled ? '' : '3 7',
          opacity: 0.55,
        }));
      }
      g.append(rows);
    }
  }
  return g;
}

/** The children, small by the door of the house they were all born in. */
function childMarks(scene: SteadingScene): SVGGElement {
  const g = svgEl('g', { class: 'yard-children' });
  const first = scene.raised.find((r) => r.done >= 1);
  if (!first) return g;
  for (const [i, name] of scene.childNames.slice(0, 4).entries()) {
    const rng = makeRng(`landnam-child:${name}`);
    const x = first.x + HOUSE_HALF + 10 + i * 11 + rng.float(-2, 2);
    const h = 14 + rng.float(0, 3);
    const tunic = ['#7a6a4e', '#916f4a', '#6b5f4a'][rng.int(0, 2)]!;
    g.append(
      svgEl('path', {
        d: `M ${x - h * 0.16} ${GROUND_Y} L ${x - h * 0.12} ${GROUND_Y - h * 0.62}` +
           ` L ${x + h * 0.12} ${GROUND_Y - h * 0.62} L ${x + h * 0.16} ${GROUND_Y} Z`,
        fill: tunic,
      }),
      svgEl('circle', {
        cx: x, cy: GROUND_Y - h * 0.78, r: h * 0.17, fill: '#c6a184',
      }),
    );
  }
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
  const layers = {
    marks: svgEl('g'), houses: svgEl('g'), life: svgEl('g'),
    folk: svgEl('g'), ui: svgEl('g'),
  };
  root.append(layers.marks, layers.houses, layers.life, layers.folk, layers.ui);

  let plots = 0;
  let latest: GameState | null = null;

  function update(state: GameState): void {
    latest = state;
    const scene = steadingScene(state);

    // The frame is fitted to the slot, so `meet` letterboxes nothing — the
    // same refit-on-what-you-actually-have discipline as the battlefield,
    // and the same observer below for when the slot itself moves.
    const slot = root.getBoundingClientRect();
    const box = composeYard(scene.width, slot.width, slot.height);
    root.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    paint.update(box, countryHere(state), state.seed);

    layers.marks.replaceChildren(groundMarks(scene));

    layers.houses.replaceChildren();
    for (const r of scene.raised) layers.houses.append(house(r, scene.greened));

    layers.life.replaceChildren();
    if (scene.smoke && scene.raised.some((r) => r.done >= 1)) {
      layers.life.append(smokeOver(scene));
    }
    layers.life.append(childMarks(scene));

    layers.folk.replaceChildren();
    for (const s of scene.folk) layers.folk.append(folkMark(s, scene.width / 2));

    layers.ui.replaceChildren();
    if (scene.name) {
      layers.ui.append(svgEl('text', {
        x: box.x + box.w / 2, y: box.y + 30, 'text-anchor': 'middle', class: 'here-word',
      }, words(scene.name)));
    }
    if (scene.raised.length === 0) {
      layers.ui.append(svgEl('text', {
        x: box.x + box.w / 2, y: GROUND_Y - 40, 'text-anchor': 'middle', class: 'here-word',
      }, words('Bare ground, and posts in it.')));
    }

    plots = state.settlement?.plots.length ?? 0;
    root.setAttribute(
      'aria-label',
      scene.name
        ? `${scene.name}. ${scene.raised.filter((r) => r.done >= 1).length} standing: ` +
          `${scene.raised.filter((r) => r.done >= 1).map((r) => r.name).join(', ') || 'nothing yet'}.` +
          `${scene.smoke ? ' Smoke over the hearth.' : ''}` +
          `${scene.childNames.length > 0 ? ` ${scene.childNames.length} born here.` : ''}`
        : 'No steading.',
    );
  }

  // The slot is `flex` under panels that grow and shrink, so the frame has
  // to follow the element, not the other way round — the same defect the
  // battlefield fixed with the same observer.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (latest?.settlement) update(latest);
    }).observe(root);
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

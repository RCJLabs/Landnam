// Drawing the strip chart. The hand; `render/strip.ts` is the head.
//
// Nothing here decides anything — every fact it draws came out of
// `stripScene`, which is pure and tested. What lives here is SVG and the one
// piece of state a picture is allowed to own: where the strip is scrolled to.

import { button, el, svgEl } from './svg';
import {
  LANE_H, LANE_Y, STOP_W, STRIP_H, pickStop, scrollFor, stripKey, stripScene,
  stripWidth, xOf, type StripMark, type StripStop,
} from './strip';
import { ROUTE_STOPS } from '../sim/route';
import type { GameState } from '../state/types';
import { PARCHMENT, ROPE, RUST, TIMBER } from './palette';

/** `svgEl` takes Nodes, and every label here is a string. */
function words(text: string): Node[] {
  return [document.createTextNode(text)];
}

/** The one glyph shape per kind, drawn small enough to read at strip scale. */
function glyph(mark: StripMark, x: number, y: number): SVGGElement {
  const g = svgEl('g', {
    class: `strip-mark strip-${mark.kind}`,
    opacity: mark.spent ? 0.4 : 0.95,
  });
  const ink = mark.ink ?? PARCHMENT;
  if (mark.kind === 'landing') {
    // A hull on the sand: the shape the saga opens with.
    g.append(svgEl('path', {
      d: `M ${x - 9} ${y} q 9 7 18 0 z`,
      fill: '#d9c9a3', stroke: ROPE, 'stroke-width': 1,
    }));
  } else if (mark.kind === 'hall') {
    g.append(svgEl('path', {
      d: `M ${x - 8} ${y + 5} L ${x - 8} ${y - 1} L ${x} ${y - 7} L ${x + 8} ${y - 1} ` +
        `L ${x + 8} ${y + 5} z`,
      fill: PARCHMENT, stroke: ROPE, 'stroke-width': 1,
    }));
  } else if (mark.kind === 'neighbour' || mark.kind === 'rival') {
    // A gable, like ours, because they are doing what we are doing — inked
    // by their temper where they have one.
    g.append(svgEl('path', {
      d: `M ${x - 7} ${y + 4} L ${x} ${y - 6} L ${x + 7} ${y + 4} z`,
      fill: ink, stroke: TIMBER, 'stroke-width': 0.8,
    }));
  } else if (mark.kind === 'landmark') {
    g.append(svgEl('circle', {
      cx: x, cy: y, r: 6, fill: 'none', stroke: PARCHMENT, 'stroke-width': 1.4,
    }));
  } else {
    g.append(svgEl('rect', {
      x: x - 6, y: y - 6, width: 12, height: 12,
      fill: '#d9c9a3', stroke: ROPE, 'stroke-width': 1,
      transform: `rotate(45 ${x} ${y})`,
    }));
  }
  return g;
}

/** One stretch of coast: its ground, what it carries, and the leg to it. */
function lane(stop: StripStop): SVGGElement {
  const g = svgEl('g', { class: `strip-stop${stop.known ? '' : ' unknown'}` });
  const x = stop.index * STOP_W;

  g.append(svgEl('rect', {
    x, y: LANE_Y, width: STOP_W, height: LANE_H,
    // Water-stained paper for a stretch nobody has learned. It says nothing
    // about itself, which is the whole of the fog discipline: the chart is a
    // record of what was earned, not a map handed out at the start.
    fill: stop.fill ?? '#6b6553',
    stroke: stop.edge ?? '#4e493c',
    'stroke-width': 0.8,
    opacity: stop.known ? (stop.trod ? 1 : 0.78) : 0.3,
  }));

  // The worn trod, the same convention the hex chart uses: ground the band
  // actually stood on is marked, so a saga can see its own road.
  if (stop.trod) {
    g.append(svgEl('line', {
      x1: x + 3, y1: LANE_Y + LANE_H - 7, x2: x + STOP_W - 3, y2: LANE_Y + LANE_H - 7,
      stroke: PARCHMENT, 'stroke-width': 2.2, opacity: 0.5,
      'stroke-linecap': 'round',
    }));
  }

  // The leg, written rather than guessed at. This is the number the whole
  // design rests on — every day out is a day that has to be spent again — so
  // it is on the picture and not only in a panel.
  if (stop.leg !== undefined) {
    g.append(svgEl('text', {
      x, y: LANE_Y - 8, 'text-anchor': 'middle', class: 'strip-leg',
    }, words(`${stop.leg}d`)));
  }

  // Marks stack upward from the top of the lane, so two things on one
  // stretch do not sit on top of each other.
  stop.marks.forEach((mark, i) => {
    g.append(glyph(mark, xOf(stop.index), LANE_Y + 18 + i * 17));
  });

  if (stop.here) {
    g.append(svgEl('circle', {
      cx: xOf(stop.index), cy: LANE_Y + LANE_H + 12, r: 7,
      fill: '#f0e3c2', stroke: TIMBER, 'stroke-width': 1.6,
    }));
  }

  // A step they could take today, priced in days. The chart IS the verb
  // until 8.3 puts a procession under it.
  if (stop.reach !== undefined) {
    g.append(svgEl('rect', {
      x: x + 1, y: LANE_Y - 1, width: STOP_W - 2, height: LANE_H + 2,
      fill: 'none', stroke: '#f0e3c2', 'stroke-width': 2, opacity: 0.85,
      rx: 3,
    }));
    g.append(svgEl('text', {
      x: xOf(stop.index), y: LANE_Y + LANE_H + 30, 'text-anchor': 'middle',
      class: 'strip-cost',
    }, words(`${stop.reach}d`)));
  }
  return g;
}

/** The key swatch for one mark, drawn with the glyph the strip itself uses. */
function keyItem(stop: number, mark: StripMark): HTMLElement {
  const swatch = svgEl('svg', {
    class: 'chart-swatch',
    viewBox: '-11 -11 22 22',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  swatch.append(glyph(mark, 0, 0));
  return el('div', { class: 'chart-key' }, [
    swatch,
    el('span', {}, [`${mark.text} · stretch ${stop}`]),
  ]);
}

/**
 * The chart in the pack, for a coast.
 *
 * `onWalk` is what makes it a decision rather than a picture: tapping a
 * stretch the band could reach today spends the days and closes the card.
 * Until 8.3 there is no other way to walk anywhere, and a chart of a coast
 * that cannot be walked would measure as travel getting worse.
 */
export function renderStrip(
  state: GameState,
  close: () => void,
  onWalk: (to: number) => void,
  daysInHand: number,
): HTMLElement {
  const scene = stripScene(state, daysInHand);

  const svg = svgEl('svg', {
    class: 'strip',
    xmlns: 'http://www.w3.org/2000/svg',
    width: stripWidth(),
    height: STRIP_H,
    viewBox: `0 0 ${stripWidth()} ${STRIP_H}`,
    role: 'img',
    'aria-label':
      `The coast, ${ROUTE_STOPS} stretches. We are standing on stretch ${scene.at}.`,
  });

  const layers = { land: svgEl('g'), limit: svgEl('g'), marks: svgEl('g') };
  svg.append(layers.land, layers.limit, layers.marks);

  for (const stop of scene.stops) layers.land.append(lane(stop));

  // How far out they could go and still come home on what they carry. The
  // sentence this whole milestone is measured against, drawn rather than
  // left for the player to work out from the legs.
  if (scene.limit > scene.at) {
    const x = (scene.limit + 1) * STOP_W;
    layers.limit.append(svgEl('line', {
      x1: x, y1: LANE_Y - 22, x2: x, y2: LANE_Y + LANE_H + 8,
      stroke: RUST, 'stroke-width': 2, 'stroke-dasharray': '5 4', opacity: 0.9,
    }));
    layers.limit.append(svgEl('text', {
      x: x - 4, y: LANE_Y - 26, 'text-anchor': 'end', class: 'strip-limit',
    }, words('as far as we could come back from')));
  }

  const frame = el('div', { class: 'strip-frame' }, [svg]);

  // Tapping the picture. One listener on the frame rather than one per
  // stretch: the hit-test is `pickStop`, which is pure and tested, and a
  // stretch the band cannot reach today simply does nothing.
  frame.addEventListener('click', (ev) => {
    const box = svg.getBoundingClientRect();
    if (box.width === 0) return;
    const x = ((ev as MouseEvent).clientX - box.left) * (stripWidth() / box.width);
    const stop = pickStop(x);
    if (stop === undefined) return;
    if (scene.stops[stop]?.reach === undefined) return;
    onWalk(stop);
  });

  const key = stripKey(scene);
  const card = el('div', { class: 'card chart-card' }, [
    el('h2', {}, ['The Chart']),
    el('p', { class: 'chart-note' }, [
      `Day ${state.day} · ${scene.walked} of ${ROUTE_STOPS} stretches walked · ` +
        (scene.limit > scene.at
          ? `we could reach stretch ${scene.limit} and still get home`
          : 'not enough in the packs to go anywhere and come back'),
    ]),
    frame,
    el('div', { class: 'chart-legend' },
      key.length > 0
        ? key.map(({ stop, mark }) => keyItem(stop, mark))
        : [el('p', { class: 'chart-note' }, ['Nothing on this coast is known yet.'])]),
    button('Close', close, { class: 'primary wide' }),
  ]);

  // Put the band in the middle of what can be seen. Deferred, because the
  // frame has no width until it is in the document — and the strip is drawn
  // at its natural width, so a scroll offset in chart pixels IS a scroll
  // offset in screen pixels and needs no scaling.
  queueMicrotask(() => {
    const view = frame.clientWidth;
    if (view > 0) frame.scrollLeft = scrollFor(scene.at, view);
  });

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

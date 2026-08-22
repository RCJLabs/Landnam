// The fight's choreography: every beat drawn as the thing it says happened.
//
// The beat stream was built so a view could show HOW a swing finished, and
// then the view drew every one of them as the same straight line. Now a
// swing sweeps, a thrust runs flat and fast past the shield-brother, a
// thrown spear actually flies, a turned blow sparks off the rim — and a
// shove, which was drawn as NOTHING at all (the one verb with no effect,
// found by reading), shows its held, pushed, crushed and drowned endings.
//
// All decoration: spawned into the .fx layer, removed on timers, and never
// spawned at all under stillness — the same contract the old effects had.

import { toPixel } from '../hex';
import type { Battle } from '../state/types';
import type { Beat } from '../sim/beats';
import { FIELD_HEX } from './fieldArt';
import { svgEl } from './svg';

const HEX = FIELD_HEX;

type Spawn = (node: SVGElement, life?: number) => void;

/** A wall link as it stood on the LAST paint, for the snap when one falls. */
export interface WallMemory {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  friendly: boolean;
}

function spotOf(battle: Battle, personId: string): { x: number; y: number } | undefined {
  const c = battle.combatants.find((f) => f.personId === personId);
  return c ? toPixel(c.at, HEX) : undefined;
}

/** The point on a fighter's rim facing another point — blows land on shields,
 * not on centres. */
function rim(from: { x: number; y: number }, toward: { x: number; y: number }, r: number) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / d) * r, y: from.y + (dy / d) * r };
}

/** Short strokes radiating from a point: iron off a rim, dust off a rock. */
function burst(x: number, y: number, colour: string, size: number, count: number): SVGElement {
  const g = svgEl('g', { class: 'fx-spark' });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    g.append(
      svgEl('line', {
        x1: x + Math.cos(a) * size * 0.35,
        y1: y + Math.sin(a) * size * 0.35,
        x2: x + Math.cos(a) * size,
        y2: y + Math.sin(a) * size,
        stroke: colour,
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
      }),
    );
  }
  return g;
}

function blowColour(soft: boolean): string {
  return soft ? '#9aa4ad' : '#e6ebee';
}

/**
 * One beat, drawn. Everything the effects layer knows how to show.
 *
 * `wallBefore` is the wall as the previous paint drew it, so a fall can show
 * the link SNAPPING — the sim has no "wall shattered" beat and must not grow
 * one for decoration's sake (beats live in the save and the parity vectors),
 * so the view remembers the one fact it needs itself.
 */
export function showBeat(
  battle: Battle,
  b: Beat,
  spawn: Spawn,
  wallBefore: Map<string, WallMemory>,
): void {
  const R = HEX * 0.42;

  if (b.kind === 'struck' || b.kind === 'reached' || b.kind === 'threw') {
    const a = spotOf(battle, b.who);
    const t = spotOf(battle, b.target);
    if (!a || !t) return;
    const soft = b.result !== 'hit';
    const from = rim(a, t, R * 0.7);
    const to = rim(t, a, R * 0.8);

    if (b.kind === 'struck') {
      // The swing: an arc, bowed to the attacker's off side, drawn on.
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      const bow = Math.min(14, d * 0.4);
      spawn(
        svgEl('path', {
          d: `M ${from.x} ${from.y} Q ${mx - (dy / d) * bow} ${my + (dx / d) * bow} ${to.x} ${to.y}`,
          class: `fx-swing${soft ? ' soft' : ''}`,
          pathLength: 100,
          fill: 'none',
          stroke: blowColour(soft),
        }),
        480,
      );
    } else if (b.kind === 'reached') {
      // The thrust: flat, fast, and past somebody — the straight line is the
      // point of the verb, so it stays one, drawn on quicker than a swing.
      spawn(
        svgEl('path', {
          d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
          class: `fx-thrust${soft ? ' soft' : ''}`,
          pathLength: 100,
          fill: 'none',
          stroke: '#e8dcc0',
        }),
        380,
      );
    } else {
      // The throw: a spear that flies. The glyph starts at the thrower and a
      // CSS variable carries it to the mark; the impact waits for it.
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const spear = svgEl('g', { class: 'fx-fly' });
      spear.append(
        svgEl('line', {
          x1: -7, y1: 0, x2: 5, y2: 0,
          stroke: '#c9a468', 'stroke-width': 1.8, 'stroke-linecap': 'round',
        }),
        svgEl('path', { d: 'M 5 0 l 4 1.8 l -1.2 -1.8 l 1.2 -1.8 Z', fill: '#9fb0c4' }),
      );
      const style = (spear as SVGElement & { style: CSSStyleDeclaration }).style;
      style.setProperty('--x0', `${from.x}px`);
      style.setProperty('--y0', `${from.y}px`);
      style.setProperty('--rot', `${angle.toFixed(1)}deg`);
      style.setProperty('--tx', `${dx}px`);
      style.setProperty('--ty', `${dy}px`);
      spawn(spear, 320);
    }

    // How it landed. Iron sparks for a shield that held; the flash and the
    // number, as ever, for a blow that got through.
    const arrival = b.kind === 'threw' ? 240 : b.kind === 'reached' ? 120 : 200;
    window.setTimeout(() => {
      if (b.result === 'turned' || b.result === 'miss') {
        spawn(burst(to.x, to.y, '#cfd8dc', b.result === 'turned' ? 9 : 6, 5), 420);
        return;
      }
      if (b.damage > 0) {
        if (b.result === 'glance') spawn(burst(to.x, to.y, '#cfd8dc', 6, 4), 380);
        spawn(svgEl('circle', { cx: t.x, cy: t.y, r: HEX * 0.5, class: 'hit-flash' }), 450);
        const text = svgEl('text', {
          x: t.x, y: t.y - HEX * 0.55,
          class: `float-dmg${soft ? ' glance' : ''}`,
          'text-anchor': 'middle',
        });
        text.textContent = `−${b.damage}`;
        spawn(text, 900);
      }
    }, arrival);
    return;
  }

  if (b.kind === 'shoved') {
    const at = toPixel(b.from, HEX);
    if (b.result === 'held') {
      // Nobody moved: the brace flash where the shove was refused.
      spawn(burst(at.x, at.y - R * 0.4, '#cfd8dc', 7, 4), 380);
      return;
    }
    if (b.result === 'crushed') {
      // Driven into what was behind them: rock dust, and the heavy flash.
      spawn(burst(at.x, at.y, '#a89f90', 12, 7), 500);
      spawn(svgEl('circle', { cx: at.x, cy: at.y, r: HEX * 0.5, class: 'hit-flash' }), 450);
      return;
    }
    const to = b.to ? toPixel(b.to, HEX) : at;
    if (b.result === 'drowned') {
      // The old trick: rings on the water where a fighter used to be.
      spawn(svgEl('circle', { cx: to.x, cy: to.y, r: 6, class: 'fx-splash' }), 700);
      spawn(svgEl('circle', { cx: to.x, cy: to.y, r: 6, class: 'fx-splash late' }), 900);
      return;
    }
    // Pushed: motion streaks along the yard of ground they gave.
    const dx = to.x - at.x;
    const dy = to.y - at.y;
    const d = Math.hypot(dx, dy) || 1;
    for (const f of [0.25, 0.5, 0.75]) {
      spawn(
        svgEl('line', {
          x1: at.x + dx * f - (dx / d) * 6,
          y1: at.y + dy * f - (dy / d) * 6,
          x2: at.x + dx * f + (dx / d) * 6,
          y2: at.y + dy * f + (dy / d) * 6,
          class: 'fx-streak',
          stroke: '#cfd8dc',
        }),
        360,
      );
    }
    return;
  }

  if (b.kind === 'warcry') {
    const p = spotOf(battle, b.who);
    if (!p) return;
    spawn(svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.6, class: 'cry-ring' }), 900);
    spawn(svgEl('circle', { cx: p.x, cy: p.y, r: HEX * 0.6, class: 'cry-ring late' }), 1100);
    return;
  }

  if (b.kind === 'fell') {
    const p = spotOf(battle, b.who);
    if (!p) return;
    // The fall, and the shield going its own way — a beat of aftermath.
    spawn(
      svgEl('circle', {
        cx: p.x, cy: p.y, r: HEX * 0.42,
        class: 'fall-fade',
        fill: b.side === 'warband' ? '#b23b2e' : '#3f4a5a',
      }),
      900,
    );
    const shield = svgEl('circle', {
      cx: p.x, cy: p.y, r: HEX * 0.26, class: 'fx-roll',
      fill: 'none', stroke: '#8a8478', 'stroke-width': 3,
    });
    (shield as SVGElement & { style: CSSStyleDeclaration }).style.setProperty(
      '--tx',
      `${b.side === 'warband' ? -14 : 14}px`,
    );
    spawn(shield, 800);

    // If they stood in a wall, the wall visibly loses them: the remembered
    // link snaps, two halves pulling apart.
    for (const link of wallBefore.values()) {
      const atA = Math.hypot(link.ax - p.x, link.ay - p.y) < 1;
      const atB = Math.hypot(link.bx - p.x, link.by - p.y) < 1;
      if (!atA && !atB) continue;
      const ox = (link.ax + link.bx) / 2;
      const oy = (link.ay + link.by) / 2;
      for (const half of [-1, 1]) {
        const snap = svgEl('line', {
          x1: ox + ((half === -1 ? link.ax : link.bx) - ox) * 0.15,
          y1: oy + ((half === -1 ? link.ay : link.by) - oy) * 0.15,
          x2: ox + ((half === -1 ? link.ax : link.bx) - ox) * 0.8,
          y2: oy + ((half === -1 ? link.ay : link.by) - oy) * 0.8,
          class: 'fx-snap',
          stroke: link.friendly ? '#e8dcc0' : '#9fb0c4',
        });
        (snap as SVGElement & { style: CSSStyleDeclaration }).style.setProperty(
          '--tx',
          `${((half === -1 ? link.ax : link.bx) - ox) * 0.25}px`,
        );
        (snap as SVGElement & { style: CSSStyleDeclaration }).style.setProperty(
          '--ty',
          `${((half === -1 ? link.ay : link.by) - oy) * 0.25}px`,
        );
        spawn(snap, 500);
      }
    }
  }
}

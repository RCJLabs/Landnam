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

import type { Battle } from '../state/types';
import type { Beat, BlowBeat } from '../sim/beats';
import { makeRng } from '../rng';
import { FIGURE_LIFT, FIGURE_R, RANK_GAP, standAt } from './line';
import { svgEl } from './svg';

/**
 * The scale effects are drawn at: THE RADIUS A FIGHTER IS ACTUALLY DRAWN AT.
 *
 * Was the hex size, then `RANK_GAP * 0.42` — and the comment here said this
 * file "has to agree with `render/battle.ts` about it or a blow lands
 * somewhere near the man who threw it. One import rather than two
 * constants." It did not agree. `battle.ts` draws every fighter at
 * `FIGURE_R`, which is `RANK_GAP * 0.46`, so the effects were laid out
 * against a man 9% smaller than the one on screen — near enough for a swing
 * arc, which is why nobody caught it, and not near enough for art queue item
 * 19, whose whole claim is that a blow lands on a PLACE on a body.
 *
 * So it is the same constant now, and the comment's promise is kept.
 */
const HEX = FIGURE_R;

type Spawn = (node: SVGElement, life?: number) => void;

/** A wall link as it stood on the LAST paint, for the snap when one falls. */
export interface WallMemory {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  friendly: boolean;
}

/**
 * Where a fighter is on screen, for an effect to play on.
 *
 * Chest height rather than the ground he stands on: a blow lands on a man,
 * not at his feet. Reads his RANK, so it is the same answer `battle.ts` is
 * drawing him at — which is the whole reason `standAt` is one function in
 * one file.
 */
function spotOf(battle: Battle, personId: string): { x: number; y: number } | undefined {
  const c = battle.combatants.find((f) => f.personId === personId);
  if (!c) return undefined;
  const spot = standAt(c.side, c.rank);
  return { x: spot.x, y: spot.y - FIGURE_LIFT };
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

// ---- where a blow lands, and what it does to the man (art queue item 19) ----

/**
 * Where on a man a blow landed.
 *
 * Every blow used to land in exactly the same place: the centre of the
 * figure, because that is where `spotOf` answers and nothing asked for
 * anything else. A flash there and a number over it is a HIT REPORTED, not
 * a blow struck, which is the whole of what this item is about.
 *
 * The sim does not say where a blow landed and must not start: beats live in
 * the save and in the parity vectors, so growing a field for decoration
 * would cost a save bump and a port change for something no rule reads. It
 * is derived here instead, seeded off the beat's own number so a replay of
 * the same fight shows the same blow in the same place — the same discipline
 * every other decoration in this game keeps.
 */
export type BlowPlace = 'head' | 'body' | 'leg';

export function blowLanding(beat: BlowBeat): BlowPlace {
  const rng = makeRng(`landnam-blow:${beat.n}:${beat.who}:${beat.target}`);
  // A GLANCE is a blow that did not land square — it caught a helm or a
  // shin. So it skews to the edges of a man, and a clean hit to his middle.
  const roll = rng.float(0, 1);
  if (beat.result === 'glance') return roll < 0.45 ? 'head' : roll < 0.9 ? 'leg' : 'body';
  return roll < 0.52 ? 'body' : roll < 0.78 ? 'head' : 'leg';
}

/**
 * How far above or below the middle that is, in world units.
 *
 * Fitted to what `figures.ts` actually DRAWS head-on, which is not a whole
 * body: a helm above the rim (its dome runs from `-r * 1.18` to `-r * 0.62`),
 * a round shield filling the middle, and the health bar below at `r + 4`. So
 * a blow to the head lands on the helm, one to the body on the shield's
 * face, and a low one under the rim where the legs are — measured off that
 * geometry rather than picked to look right in the abstract.
 */
export function placeOffset(place: BlowPlace, r: number): number {
  return place === 'head' ? -r * 0.9 : place === 'leg' ? r * 0.8 : 0;
}

/**
 * How hard the blow shoves him, in world units.
 *
 * Scaled by the damage so a blow that takes a third of a man reads heavier
 * than a scratch, and capped so nobody is punted off the line. Not read off
 * `maxHealth`, because `showBeat` is handed the battle and the people live
 * in the state — and a cap makes the difference between the numbers matter
 * more than their absolute size anyway.
 */
export function blowKick(damage: number): number {
  return HEX * Math.min(0.34, 0.11 + damage * 0.045);
}

/** Blood thrown off a blow that got through, along the line it came in on. */
function spatter(
  x: number,
  y: number,
  dx: number,
  dy: number,
  damage: number,
  seed: string,
): SVGElement {
  const g = svgEl('g', { class: 'fx-blood' });
  const rng = makeRng(`landnam-spatter:${seed}`);
  const d = Math.hypot(dx, dy) || 1;
  // Restrained on purpose. This is a saga, not a gore game: a few dark marks
  // flung the way the blow was going, gone in half a second.
  const drops = Math.min(6, 2 + Math.round(damage * 0.6));
  for (let i = 0; i < drops; i += 1) {
    const spread = rng.float(-0.7, 0.7);
    const reach = HEX * rng.float(0.35, 1.05);
    const ax = (dx / d) * Math.cos(spread) - (dy / d) * Math.sin(spread);
    const ay = (dx / d) * Math.sin(spread) + (dy / d) * Math.cos(spread);
    const drop = svgEl('circle', {
      cx: x, cy: y, r: rng.float(1.8, 4.2), fill: '#7d1f16',
    });
    const style = (drop as SVGElement & { style: CSSStyleDeclaration }).style;
    style.setProperty('--tx', `${(ax * reach).toFixed(1)}px`);
    style.setProperty('--ty', `${(ay * reach).toFixed(1)}px`);
    style.setProperty('animation-delay', `${rng.float(0, 60).toFixed(0)}ms`);
    g.append(drop);
  }
  return g;
}

/**
 * The struck man takes it: a jolt along the blow's line, then his feet again.
 *
 * Reaches OUT of the effects layer to the fighter himself, which nothing else
 * in this file does — every other effect is a node spawned and swept up. It
 * is worth the exception because a body that does not move when it is hit is
 * exactly what makes a hit read as a number: the recoil is the blow landing
 * ON somebody rather than near them. `battle.ts` marks each fighter with
 * `data-who` so there is something to find.
 *
 * If the node has been rebuilt by a repaint before this runs, nothing
 * happens and nothing breaks — the repaint has already drawn his new health,
 * which is the fact that mattered.
 */
function shove(root: ParentNode, who: string, dx: number, dy: number, kick: number): void {
  const man = root.querySelector(`g.fighter[data-who="${CSS.escape(who)}"]`);
  if (!(man instanceof SVGElement)) return;
  const d = Math.hypot(dx, dy) || 1;
  man.style.setProperty('--kx', `${((dx / d) * kick).toFixed(2)}px`);
  man.style.setProperty('--ky', `${((dy / d) * kick).toFixed(2)}px`);
  man.classList.remove('struck');
  // Force the class to take again when two blows land on one man in a round.
  void man.getBoundingClientRect();
  man.classList.add('struck');
  window.setTimeout(() => man.classList.remove('struck'), 320);
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
  /**
   * The field, so a blow can find the man it landed on and shove him. Every
   * other effect here is a node spawned into the effects layer and swept up;
   * the recoil is the one that has to touch the fighter himself.
   */
  root: ParentNode,
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

    // How it landed. Iron sparks for a shield that held; for a blow that got
    // through, a body that takes it SOMEWHERE — which is the whole of art
    // queue item 19. It was a flash on the figure's centre and a number over
    // its head: a hit reported rather than a blow struck.
    const arrival = b.kind === 'threw' ? 240 : b.kind === 'reached' ? 120 : 200;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    window.setTimeout(() => {
      if (b.result === 'turned' || b.result === 'miss') {
        // A shield that held still shoves the man behind it, a little.
        if (b.result === 'turned') shove(root, b.target, dx, dy, HEX * 0.07);
        spawn(burst(to.x, to.y, '#cfd8dc', b.result === 'turned' ? 9 : 6, 5), 420);
        return;
      }
      if (b.damage > 0) {
        // Where on him it landed, and everything placed there rather than at
        // his middle.
        const place = blowLanding(b);
        const at = { x: t.x, y: t.y + placeOffset(place, HEX) };
        if (b.result === 'glance') spawn(burst(at.x, at.y, '#cfd8dc', 6, 4), 380);
        spawn(svgEl('circle', {
          cx: at.x, cy: at.y,
          // A heavier blow flashes wider. Head blows read sharper than body
          // ones at the same damage, which is the read a player wants.
          r: HEX * (place === 'head' ? 0.34 : 0.5),
          class: 'hit-flash',
        }), 450);
        if (b.result === 'hit') {
          spawn(spatter(at.x, at.y, dx, dy, b.damage, `${b.n}:${b.target}`), 620);
        }
        shove(root, b.target, dx, dy, blowKick(b.damage));
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
    // The beat still carries the hexes it was shoved between; they describe a
    // field that no longer exists, so the effect plays where the men now
    // stand instead. The dead fields go with `Combatant.at`.
    const at = spotOf(battle, b.target);
    if (!at) return;
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
    // Pushed. `at` is where he is NOW, a rank further back; the ground he
    // gave runs from one gap nearer the meeting to here. A shove always
    // drives a man away from where the walls meet, so the direction falls
    // out of which side of x = 0 he is on and needs nobody looked up.
    const was = { x: at.x - (at.x < 0 ? -RANK_GAP : RANK_GAP), y: at.y };
    // Motion streaks along the yard of ground they gave.
    const dx = at.x - was.x;
    const dy = at.y - was.y;
    const d = Math.hypot(dx, dy) || 1;
    for (const f of [0.25, 0.5, 0.75]) {
      spawn(
        svgEl('line', {
          x1: was.x + dx * f - (dx / d) * 6,
          y1: was.y + dy * f - (dy / d) * 6,
          x2: was.x + dx * f + (dx / d) * 6,
          y2: was.y + dy * f + (dy / d) * 6,
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

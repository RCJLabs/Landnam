// BATTLE renderer: the field as layered SVG. Pure view — reads state, emits
// a hex tap. Fighters are drawn from their Person, same as anywhere else.

import { cornerPoints, fromKey, fromPixel, key, toPixel, type Hex } from '../hex';
import type { Battle, GameState, Ground } from '../state/types';
import { activeCombatant, fighterPerson, reachableHexes, strikeTargets } from '../sim/battle';
import { isLeader, reachTargets, shoveDestination, throwTargets } from '../sim/battleActions';
import { beatsSince, type Beat } from '../sim/beats';
import { isThreatened } from '../sim/zoc';
import { wallPairs } from '../sim/wall';
import type { Aim } from './battleUi';
import { svgEl } from './svg';

const HEX = 30;

/** The leader, if they are standing on this field at all. */
function isLeaderHere(state: GameState, combatant: { personId: string; side: string }): boolean {
  return isLeader(state, combatant as Parameters<typeof isLeader>[1]);
}

const GROUND_FILL: Record<Ground, string> = {
  open: '#5e6b40',
  rough: '#6d6446',
  block: '#4a453c',
  water: '#2e5468',
  wall: '#4a3b28',
};

export interface BattleView {
  root: SVGSVGElement;
  update(state: GameState, aim: Aim): void;
}

export function createBattleView(onTap: (h: Hex) => void): BattleView {
  const root = svgEl('svg', {
    class: 'field',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const layers = {
    ground: svgEl('g'),
    overlay: svgEl('g'),
    fighters: svgEl('g'),
    // Effects survive repaints and remove themselves: paint() rebuilds the
    // other layers wholesale, and an animation that gets rebuilt mid-flight
    // is an animation that never happened.
    effects: svgEl('g', { class: 'fx' }),
  };
  root.append(layers.ground, layers.overlay, layers.fighters, layers.effects);

  let latest: GameState | null = null;
  /**
   * How far into the fight's beat stream the effects layer has read.
   *
   * The whole of what this layer used to be: a `lastBlow.n` it diffed, a
   * `warCried` boolean it latched, and a Set of everyone it had seen fall.
   * Three private reconstructions of change, each with its own way of being
   * wrong — the blow slot only ever held the NEWEST one, so every swing but
   * the last of a foe's turn was invisible, and the fallen Set was never
   * cleared between fights, so a warrior who went down twice only ever
   * animated once. One mark into an ordered stream replaces all of it.
   *
   * `null` until this view has looked at any fight at all, which is how a
   * saga taken up mid-battle is told apart from a fight that has just begun:
   * the first is a backlog to adopt silently, the second is an opening to
   * play. Without the difference, loading a mid-fight save replayed forty
   * beats of a fight the player was not watching.
   */
  let beatMark: number | null = null;

  /** Beats land this far apart when a whole foe turn arrives at once. */
  const BEAT_GAP = 140;

  /** Effects are decoration; a player who asked for stillness gets none. */
  function still(): boolean {
    return (
      document.documentElement.classList.contains('still') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** A one-shot effect node that cleans up after itself. */
  function spawn(node: SVGElement, life = 750): void {
    layers.effects.append(node);
    window.setTimeout(() => node.remove(), life);
  }

  /** Where a fighter is standing, for a beat that names them. */
  function spotOf(battle: Battle, personId: string): { x: number; y: number } | undefined {
    const c = battle.combatants.find((f) => f.personId === personId);
    return c ? toPixel(c.at, HEX) : undefined;
  }

  /** One beat, drawn. Everything this layer knows how to show is in here. */
  function show(battle: Battle, b: Beat): void {
    if (b.kind === 'struck' || b.kind === 'reached' || b.kind === 'threw') {
      const a = spotOf(battle, b.who);
      const t = spotOf(battle, b.target);
      if (!a || !t) return;
      // A blow that did not land in earnest reads as a graze: a turned blow,
      // a graze and a clean miss are all the same streak with less weight.
      const soft = b.result !== 'hit';
      spawn(
        svgEl('line', {
          x1: a.x, y1: a.y, x2: t.x, y2: t.y,
          class: `blow${soft ? ' glance' : ''}`,
        }),
        450,
      );
      // The landing and the cost — unless nothing got through, where the
      // streak alone tells the story and "−0" would be noise.
      if (b.damage > 0) {
        spawn(svgEl('circle', { cx: t.x, cy: t.y, r: HEX * 0.5, class: 'hit-flash' }), 450);
        const text = svgEl('text', {
          x: t.x, y: t.y - HEX * 0.55,
          class: `float-dmg${soft ? ' glance' : ''}`,
          'text-anchor': 'middle',
        });
        text.textContent = `−${b.damage}`;
        spawn(text, 900);
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
      // The fall: the shield stays where it fell for a breath.
      const p = spotOf(battle, b.who);
      if (!p) return;
      spawn(
        svgEl('circle', {
          cx: p.x, cy: p.y, r: HEX * 0.42,
          class: 'fall-fade',
          fill: b.side === 'warband' ? '#b23b2e' : '#3f4a5a',
        }),
        900,
      );
    }
  }

  function playEffects(state: GameState): void {
    const battle = state.battle;
    if (!battle) return;

    const newest = battle.beats?.[battle.beats.length - 1]?.n ?? 0;
    // Nothing seen yet: this fight was already under way when the page
    // opened, and its history is not news.
    if (beatMark === null) beatMark = newest;
    // A fresh fight starts its numbering over, so a mark from the last one
    // would swallow the whole opening round.
    else if (newest < beatMark) beatMark = 0;

    const { beats, mark } = beatsSince(battle, beatMark);
    // The mark advances whether or not anything is drawn: a player who asked
    // for stillness should not be handed the backlog the moment they turn
    // motion back on.
    beatMark = mark;
    if (still()) return;

    // A player's action lands one beat; a foe's whole turn can land a dozen
    // at once, and firing them on the same frame is a single flicker rather
    // than a fight. They are dealt out in order instead — which is the point
    // of a stream over a slot.
    beats.forEach((b, i) => {
      if (i === 0) show(battle, b);
      else window.setTimeout(() => show(battle, b), Math.min(i, 8) * BEAT_GAP);
    });
  }

  function fitViewBox(battle: Battle): void {
    // Frame the whole field with a little breathing room.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const k of Object.keys(battle.grid)) {
      const p = toPixel(fromKey(k), HEX);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = HEX * 0.85;
    root.setAttribute(
      'viewBox',
      `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    );
  }

  function paint(state: GameState, aim: Aim): void {
    latest = state;
    const battle = state.battle;
    if (!battle) return;

    layers.ground.replaceChildren();
    layers.overlay.replaceChildren();
    layers.fighters.replaceChildren();
    fitViewBox(battle);

    for (const [k, tile] of Object.entries(battle.grid)) {
      const h = fromKey(k);
      const p = toPixel(h, HEX);
      // A palisade has to read as stakes, not as one more brown hex — it is
      // the thing the player spent eight timber on.
      if (tile.ground === 'wall') layers.overlay.append(stakes(p.x, p.y));
      layers.ground.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX - 0.5),
          fill: GROUND_FILL[tile.ground],
          stroke: '#2b2a22',
          'stroke-width': 1,
        }),
      );
      if (tile.ground === 'block') layers.ground.append(boulder(p.x, p.y));
      if (tile.ground === 'rough') layers.ground.append(tussock(p.x, p.y));
    }

    const active = activeCombatant(battle);

    if (active?.side === 'warband' && !battle.outcome) {
      // Ground the enemy threatens: step in here and your move stops.
      for (const k of Object.keys(battle.grid)) {
        const h = fromKey(k);
        if (!isThreatened(battle, h, 'warband')) continue;
        const p = toPixel(h, HEX);
        layers.overlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX - 0.5),
            fill: '#b23b2e',
            opacity: 0.13,
          }),
        );
      }

      for (const h of reachableHexes(battle)) {
        const p = toPixel(h, HEX);
        layers.overlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX - 4),
            fill: 'none',
            stroke: '#e8dcc0',
            'stroke-width': 2,
            'stroke-dasharray': '5 5',
            opacity: 0.7,
          }),
        );
      }

      // Whoever the armed action can actually reach.
      const marked =
        aim === 'throw'
          ? throwTargets(state)
          : aim === 'reach'
            ? reachTargets(state)
            : strikeTargets(state);
      for (const target of marked) {
        const p = toPixel(target.at, HEX);
        layers.overlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX - 2),
            fill: 'none',
            stroke: aim === 'throw' ? '#d3a441' : aim === 'reach' ? '#cfd8dc' : '#b23b2e',
            'stroke-width': 3,
            'stroke-dasharray': aim === 'throw' ? '6 4' : aim === 'reach' ? '3 3' : '',
          }),
        );
        // Show where a shove would send them.
        if (aim === 'shove') {
          const to = shoveDestination(active, target);
          const tile = to ? battle.grid[key(to)] : undefined;
          if (to && tile) {
            const q = toPixel(to, HEX);
            layers.overlay.append(
              svgEl('polygon', {
                points: cornerPoints(q.x, q.y, HEX - 6),
                fill: tile.ground === 'water' ? '#2e5468' : 'none',
                stroke: '#d3a441',
                'stroke-width': 2,
                opacity: 0.9,
              }),
            );
          }
        }
      }
    }

    // The wall itself: a bar of shields between shoulder-mates. Drawn under
    // the fighters so the line reads as something they are standing in.
    for (const [a, b] of wallPairs(battle)) {
      const pa = toPixel(a.at, HEX);
      const pb = toPixel(b.at, HEX);
      layers.overlay.append(
        svgEl('line', {
          x1: pa.x,
          y1: pa.y,
          x2: pb.x,
          y2: pb.y,
          stroke: a.side === 'warband' ? '#e8dcc0' : '#9fb0c4',
          'stroke-width': 6,
          'stroke-linecap': 'round',
          opacity: 0.5,
        }),
      );
    }

    for (const combatant of battle.combatants) {
      if (combatant.down || combatant.fled) continue;
      const person = fighterPerson(state, combatant.personId);
      if (!person) continue;
      const p = toPixel(combatant.at, HEX);
      const isActive = active?.personId === combatant.personId;
      layers.fighters.append(
        fighter(
          p.x,
          p.y,
          combatant.side === 'warband',
          person.health / person.maxHealth,
          isActive,
          combatant.defending,
          combatant.broken,
          isLeaderHere(state, combatant)
            ? 'gold'
            : battle.champion === combatant.personId
              ? 'blood'
              : null,
        ),
      );
    }

    playEffects(state);
  }

  root.addEventListener('pointerup', (e) => {
    if (!latest?.battle) return;
    const rect = root.getBoundingClientRect();
    const box = root.viewBox.baseVal;
    // The field uses xMidYMid meet, so work out the letterboxed draw area.
    const scale = Math.min(rect.width / box.width, rect.height / box.height);
    const drawWidth = box.width * scale;
    const drawHeight = box.height * scale;
    const originX = rect.left + (rect.width - drawWidth) / 2;
    const originY = rect.top + (rect.height - drawHeight) / 2;
    const worldX = box.x + (e.clientX - originX) / scale;
    const worldY = box.y + (e.clientY - originY) / scale;
    onTap(fromPixel(worldX, worldY, HEX));
  });

  return {
    root,
    update(state, aim) {
      paint(state, aim);
    },
  };
}

// --- Procedural marks ---

function boulder(cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { opacity: 0.9 });
  g.append(
    svgEl('path', {
      d: `M ${cx - HEX * 0.42} ${cy + HEX * 0.2} q ${HEX * 0.16} ${-HEX * 0.5} ${HEX * 0.42} ${-HEX * 0.24} q ${HEX * 0.3} ${-HEX * 0.16} ${HEX * 0.42} ${HEX * 0.44} Z`,
      fill: '#7b756b',
    }),
  );
  return g;
}

function tussock(cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { opacity: 0.55 });
  for (const dx of [-0.3, 0, 0.3]) {
    g.append(
      svgEl('path', {
        d: `M ${cx + dx * HEX} ${cy + HEX * 0.22} l ${HEX * 0.06} ${-HEX * 0.3} l ${HEX * 0.06} ${HEX * 0.3} Z`,
        fill: '#8d8459',
      }),
    );
  }
  return g;
}

function fighter(
  cx: number,
  cy: number,
  friendly: boolean,
  healthFraction: number,
  isActive: boolean,
  defending: boolean,
  broken: boolean,
  pennant: 'gold' | 'blood' | null = null,
): SVGGElement {
  const g = svgEl('g', broken ? { opacity: '0.6' } : {});
  const radius = HEX * 0.42;

  // Whoever leads carries the banner, readable from any zoom: gold over the
  // one shield that can raise the war-cry, blood over the man the raid
  // follows — the one worth singling out.
  if (pennant) {
    const mastX = cx + radius * 0.55;
    const top = cy - radius - 12;
    g.append(
      svgEl('line', {
        x1: mastX, y1: cy - radius * 0.4, x2: mastX, y2: top,
        stroke: '#e8dcc0', 'stroke-width': 1.6,
      }),
      svgEl('path', {
        d: `M ${mastX} ${top} l 11 3.5 l -11 3.5 Z`,
        fill: pennant === 'gold' ? '#d3a441' : '#b23b2e',
        class: 'leader-pennant',
      }),
    );
  }

  // A braced shield reads as a heavier rim.
  if (defending) {
    g.append(
      svgEl('circle', {
        cx,
        cy,
        r: radius + 3,
        fill: 'none',
        stroke: '#cfd8dc',
        'stroke-width': 4,
        opacity: 0.85,
      }),
    );
  }

  if (isActive) {
    g.append(
      svgEl('circle', {
        cx,
        cy,
        r: radius + 5,
        fill: 'none',
        stroke: '#d3a441',
        'stroke-width': 3,
      }),
    );
  }

  // A shield seen face-on: friendly shields carry the warband's red.
  g.append(
    svgEl('circle', { cx, cy: cy + 2, r: radius, fill: '#14110d', opacity: 0.45 }),
    svgEl('circle', {
      cx,
      cy,
      r: radius,
      fill: friendly ? '#b23b2e' : '#3f4a5a',
      stroke: '#e8dcc0',
      'stroke-width': 2,
    }),
    svgEl('circle', { cx, cy, r: radius * 0.28, fill: '#e8dcc0' }),
  );

  // Broken: a fighter with nothing left, marked so you can see the line go.
  if (broken) {
    g.append(
      svgEl('path', {
        d: `M ${cx - radius * 0.5} ${cy - radius - 6} l ${radius} 0 l ${-radius * 0.5} ${-radius * 0.6} Z`,
        fill: '#d3a441',
      }),
    );
  }

  // Health bar under the shield.
  const width = radius * 2;
  g.append(
    svgEl('rect', {
      x: cx - width / 2,
      y: cy + radius + 4,
      width,
      height: 4,
      fill: '#14110d',
      opacity: 0.6,
    }),
    svgEl('rect', {
      x: cx - width / 2,
      y: cy + radius + 4,
      width: Math.max(0, width * healthFraction),
      height: 4,
      fill: healthFraction > 0.5 ? '#7d9150' : healthFraction > 0.25 ? '#d3a441' : '#b23b2e',
    }),
  );
  return g;
}

/** Split trunks, sharpened, sunk deep. */
function stakes(cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { class: 'stakes' });
  for (const dx of [-0.42, -0.14, 0.14, 0.42]) {
    const x = cx + dx * HEX;
    g.append(
      svgEl('path', {
        d: `M ${x} ${cy + HEX * 0.42} L ${x} ${cy - HEX * 0.3} L ${x + HEX * 0.06} ${cy - HEX * 0.44}`,
        stroke: '#c9a468',
        'stroke-width': 2.4,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  g.append(
    svgEl('line', {
      x1: cx - HEX * 0.5,
      y1: cy + HEX * 0.05,
      x2: cx + HEX * 0.5,
      y2: cy + HEX * 0.05,
      stroke: '#8a6f43',
      'stroke-width': 1.6,
    }),
  );
  return g;
}

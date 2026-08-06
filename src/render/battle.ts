// BATTLE renderer: the field as layered SVG. Pure view — reads state, emits
// a hex tap. Fighters are drawn from their Person, same as anywhere else.

import { cornerPoints, fromKey, fromPixel, key, toPixel, type Hex } from '../hex';
import type { Battle, GameState, Ground } from '../state/types';
import { activeCombatant, fighterPerson, reachableHexes, strikeTargets } from '../sim/battle';
import { shoveDestination, throwTargets } from '../sim/battleActions';
import { isThreatened } from '../sim/zoc';
import { wallPairs } from '../sim/wall';
import type { Aim } from './battleUi';
import { svgEl } from './svg';

const HEX = 30;

const GROUND_FILL: Record<Ground, string> = {
  open: '#5e6b40',
  rough: '#6d6446',
  block: '#4a453c',
  water: '#2e5468',
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
  };
  root.append(layers.ground, layers.overlay, layers.fighters);

  let latest: GameState | null = null;

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
      const marked = aim === 'throw' ? throwTargets(state) : strikeTargets(state);
      for (const target of marked) {
        const p = toPixel(target.at, HEX);
        layers.overlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX - 2),
            fill: 'none',
            stroke: aim === 'throw' ? '#d3a441' : '#b23b2e',
            'stroke-width': 3,
            'stroke-dasharray': aim === 'throw' ? '6 4' : '',
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
        ),
      );
    }
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
): SVGGElement {
  const g = svgEl('g', broken ? { opacity: '0.6' } : {});
  const radius = HEX * 0.42;

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

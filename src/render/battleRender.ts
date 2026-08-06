// Tactical layer skin: battlefield terrain, units, selection, move range.

import { Axial, fromKey, key, distance, eq } from '../core/hex';
import { reachable } from '../core/path';
import { Battle, Unit } from '../sim/types';
import { attackProfile, isRouting, moveCost, wallBonus } from '../sim/tactical/combatMath';
import { HexBoard } from './canvasHex';
import { PALETTE as P } from './palette';

const TERRAIN_FILL: Record<string, string> = {
  grass: '#43603c',
  sand: '#b9a074',
  floor: '#6e5b41',
  deck: '#7a5230',
  water: '#1e4666',
  wall: '#41403c',
  rock: '#5b5a52',
};

export interface BattleSelection {
  unitId: string | null;
}

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  board: HexBoard,
  battle: Battle,
  sel: BattleSelection,
): void {
  // Terrain.
  for (const [k, tile] of Object.entries(battle.grid)) {
    const h = fromKey(k);
    board.tracePath(h, 0.5);
    ctx.fillStyle = TERRAIN_FILL[tile.terrain] ?? '#444';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (tile.terrain === 'wall') {
      board.tracePath(h, 4);
      ctx.strokeStyle = '#2c2b28';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  const selected = sel.unitId ? battle.units.find((u) => u.id === sel.unitId) : undefined;

  // Move range for the selected player unit.
  if (selected && selected.alive && !selected.escaped && selected.movesLeft > 0 && !isRouting(selected)) {
    const range = reachable(selected.at, selected.movesLeft, (h) => moveCost(battle, h));
    for (const k of range.keys()) {
      const h = fromKey(k);
      if (eq(h, selected.at)) continue;
      board.tracePath(h, 3);
      ctx.strokeStyle = 'rgba(232, 213, 163, 0.55)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Strike targets for the selected unit.
  if (selected && !selected.hasActed && !isRouting(selected)) {
    for (const u of battle.units) {
      if (u.side === 'enemy' && u.alive && !u.escaped && distance(u.at, selected.at) === 1) {
        board.tracePath(u.at, 2);
        ctx.strokeStyle = P.blood;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  // Units.
  for (const u of battle.units) {
    if (!u.alive || u.escaped) continue;
    drawUnit(ctx, board, battle, u, selected?.id === u.id);
  }

  // Hover ring.
  if (board.hovered && battle.grid[key(board.hovered)]) {
    board.tracePath(board.hovered, 1.5);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Attack preview on hovered enemy.
  if (selected && board.hovered) {
    const target = battle.units.find(
      (u) => u.alive && !u.escaped && u.side === 'enemy' && eq(u.at, board.hovered!),
    );
    if (target && distance(target.at, selected.at) === 1 && !selected.hasActed) {
      const prof = attackProfile(battle, selected, target);
      const pos = board.worldPos(target.at);
      ctx.font = 'bold 11px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = P.parchment;
      ctx.fillText(
        `${Math.round(prof.hitChance * 100)}%${prof.flanked ? ' ⚑' : ''}`,
        pos.x,
        pos.y - board.hexSize * 0.95,
      );
    }
  }
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  board: HexBoard,
  battle: Battle,
  u: Unit,
  isSelected: boolean,
): void {
  const { x, y } = board.worldPos(u.at);
  const s = board.hexSize;
  const r = s * 0.52;
  const isPlayer = u.side === 'player';

  ctx.save();
  ctx.translate(x, y);

  // Body.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = isPlayer ? '#31465a' : '#5a3131';
  ctx.fill();
  ctx.lineWidth = isSelected ? 3 : 1.5;
  ctx.strokeStyle = isSelected ? P.gold : isPlayer ? P.ship : '#c98a7a';
  ctx.stroke();

  // Shield boss / face mark.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = isPlayer ? P.ship : P.blood;
  ctx.fill();

  // Shield-wall pips (defense from neighbors).
  const wall = wallBonus(battle, u);
  if (wall > 0) {
    ctx.fillStyle = P.runeGlow;
    for (let i = 0; i < wall; i++) {
      ctx.beginPath();
      ctx.arc(-r * 0.55 + i * r * 0.55, -r * 0.85, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Braced marker.
  if (u.statuses.includes('braced')) {
    ctx.beginPath();
    ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = P.runeGlow;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Routing marker.
  if (isRouting(u)) {
    ctx.font = 'bold 12px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = P.gold;
    ctx.fillText('!', 0, -r - 4);
  }

  // Spent marker: dim acted units.
  if (isPlayer && u.hasActed && u.movesLeft <= 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
  }

  // Hp bar.
  const w = r * 1.7;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-w / 2, r + 3, w, 3.5);
  ctx.fillStyle = u.hp / u.hpMax > 0.5 ? '#7da85f' : u.hp / u.hpMax > 0.25 ? P.gold : P.blood;
  ctx.fillRect(-w / 2, r + 3, (w * u.hp) / u.hpMax, 3.5);

  ctx.restore();
}

/** Center hex of the battlefield, for camera placement. */
export function battleCenter(battle: Battle): Axial {
  const keys = Object.keys(battle.grid);
  let sq = 0;
  let sr = 0;
  for (const k of keys) {
    const h = fromKey(k);
    sq += h.q;
    sr += h.r;
  }
  return { q: Math.round(sq / keys.length), r: Math.round(sr / keys.length) };
}

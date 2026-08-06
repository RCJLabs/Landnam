// Strategic layer skin: paints the sea chart, fog, features, ship, weather.

import { Axial, key, fromKey, distance, neighbors } from '../core/hex';
import { GameRun } from '../sim/types';
import { sailCost } from '../sim/strategic/sail';
import { HexBoard } from './canvasHex';
import { PALETTE as P } from './palette';

const TERRAIN_FILL: Record<string, string> = {
  deepSea: P.deepSea,
  sea: P.sea,
  coast: P.coast,
  land: P.land,
  ice: P.ice,
};

export function drawChart(ctx: CanvasRenderingContext2D, board: HexBoard, run: GameRun): void {
  const { chart } = run;

  for (const [k, tile] of Object.entries(chart.tiles)) {
    const h = fromKey(k);
    const discovered = chart.discovered.has(k);
    board.tracePath(h, 0.5);
    if (!discovered) {
      ctx.fillStyle = P.fogUndiscovered;
      ctx.fill();
      continue;
    }
    ctx.fillStyle = TERRAIN_FILL[tile.terrain] ?? P.sea;
    ctx.fill();
    if (tile.terrain === 'land') {
      ctx.strokeStyle = P.landEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = P.grid;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
    if (tile.feature) {
      drawFeature(ctx, board, h, tile.feature.kind);
    }
  }

  // Storms (only when discovered or adjacent to discovered water).
  for (const s of run.weather.storms) {
    const visible =
      chart.discovered.has(key(s)) || neighbors(s).some((n) => chart.discovered.has(key(n)));
    if (!visible) continue;
    drawStorm(ctx, board, s);
  }

  // Dim distant discovered tiles slightly (memory vs sight).
  const sight = 2 + (run.ship.upgrades.includes('crows-nest') ? 1 : 0);
  for (const k of chart.discovered) {
    const h = fromKey(k);
    if (distance(h, chart.shipAt) > sight) {
      board.tracePath(h, 0.5);
      ctx.fillStyle = P.fogDim;
      ctx.fill();
    }
  }

  // Sailable neighbor hints.
  if (run.phase === 'voyage') {
    for (const n of neighbors(chart.shipAt)) {
      if (sailCost(run, n) === null) continue;
      board.tracePath(n, 3);
      ctx.strokeStyle = 'rgba(232, 213, 163, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Hover highlight.
  if (board.hovered && chart.tiles[key(board.hovered)]) {
    board.tracePath(board.hovered, 1.5);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawShip(ctx, board, chart.shipAt);
  drawWindRose(ctx, board, run);
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  board: HexBoard,
  h: Axial,
  kind: string,
): void {
  const { x, y } = board.worldPos(h);
  const s = board.hexSize;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 1.5;
  switch (kind) {
    case 'home':
    case 'port': {
      // Anchor-ish: pole with crossbar and curved base.
      ctx.strokeStyle = kind === 'home' ? P.gold : P.parchment;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(0, s * 0.3);
      ctx.moveTo(-s * 0.25, -s * 0.2);
      ctx.lineTo(s * 0.25, -s * 0.2);
      ctx.arc(0, s * 0.05, s * 0.28, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'monastery': {
      ctx.strokeStyle = P.parchment;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(0, s * 0.35);
      ctx.moveTo(-s * 0.28, -s * 0.15);
      ctx.lineTo(s * 0.28, -s * 0.15);
      ctx.stroke();
      break;
    }
    case 'village': {
      // Simple hut.
      ctx.strokeStyle = P.sand;
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.25);
      ctx.lineTo(-s * 0.35, -s * 0.05);
      ctx.lineTo(0, -s * 0.4);
      ctx.lineTo(s * 0.35, -s * 0.05);
      ctx.lineTo(s * 0.35, s * 0.25);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'mythic': {
      // Spiral.
      ctx.strokeStyle = P.runeGlow;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const rr = (a / (Math.PI * 4)) * s * 0.45;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case 'wreck': {
      ctx.strokeStyle = P.shipHull;
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.1);
      ctx.quadraticCurveTo(0, s * 0.45, s * 0.35, s * 0.05);
      ctx.moveTo(-s * 0.1, s * 0.2);
      ctx.lineTo(s * 0.05, -s * 0.35);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, board: HexBoard, at: Axial): void {
  const { x, y } = board.worldPos(at);
  const s = board.hexSize;
  ctx.save();
  ctx.translate(x, y);
  // Hull.
  ctx.fillStyle = P.shipHull;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, 0);
  ctx.quadraticCurveTo(-s * 0.55, -s * 0.35, -s * 0.4, -s * 0.45);
  ctx.quadraticCurveTo(0, s * 0.35, s * 0.4, -s * 0.45);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.35, s * 0.5, 0);
  ctx.quadraticCurveTo(0, s * 0.5, -s * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  // Sail.
  ctx.fillStyle = P.ship;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.65);
  ctx.lineTo(s * 0.35, -s * 0.05);
  ctx.lineTo(-s * 0.35, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  // Sail stripes.
  ctx.strokeStyle = P.blood;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.32);
  ctx.lineTo(s * 0.16, -s * 0.32);
  ctx.stroke();
  ctx.restore();
}

function drawStorm(ctx: CanvasRenderingContext2D, board: HexBoard, at: Axial): void {
  const { x, y } = board.worldPos(at);
  const s = board.hexSize;
  ctx.save();
  ctx.translate(x, y);
  board.tracePath(at, 0);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.55;
  board.tracePath(at, 0.5);
  ctx.fillStyle = P.storm;
  ctx.fill();
  // Ring of threatened hexes.
  for (const n of neighbors(at)) {
    board.tracePath(n, 0.5);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = P.storm;
    ctx.fill();
  }
  ctx.restore();
  // Swirl glyph.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = P.parchment;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.3) {
    const rr = (a / (Math.PI * 3)) * s * 0.4;
    if (a === 0) ctx.moveTo(rr, 0);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.stroke();
  ctx.restore();
}

function drawWindRose(ctx: CanvasRenderingContext2D, board: HexBoard, run: GameRun): void {
  // Drawn in world space near the ship: an arrow showing where wind blows TOWARD.
  const { x, y } = board.worldPos(run.chart.shipAt);
  const s = board.hexSize;
  const angleByDir = [0, -60, -120, 180, 120, 60]; // DIRS order, degrees
  const from = run.weather.windFrom;
  const towardDeg = angleByDir[(from + 3) % 6]! * (Math.PI / 180);
  ctx.save();
  ctx.translate(x, y - s * 1.6);
  ctx.rotate(towardDeg);
  ctx.strokeStyle = P.runeGlow;
  ctx.globalAlpha = 0.5 + run.weather.windStrength * 0.15;
  ctx.lineWidth = 2;
  const len = s * (0.4 + run.weather.windStrength * 0.2);
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - 5, -4);
  ctx.moveTo(len, 0);
  ctx.lineTo(len - 5, 4);
  ctx.stroke();
  ctx.restore();
}

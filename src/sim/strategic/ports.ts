// Port docking and trade. Prices and recruit pools are deterministic per
// port + visit count, so save/reload can't reroll the market.

import { key } from '../../core/hex';
import { makeRng } from '../../core/rng';
import { ActivePort, GameRun, SimEvent } from '../types';
import { makeRecruit } from './crewGen';

export function portHere(run: GameRun): { featureId: string; name: string; isHome: boolean } | null {
  const tile = run.chart.tiles[key(run.chart.shipAt)];
  const f = tile?.feature;
  if (!f || (f.kind !== 'port' && f.kind !== 'home')) return null;
  return { featureId: f.id, name: f.name, isHome: f.kind === 'home' };
}

export function makeActivePort(run: GameRun): ActivePort | null {
  const here = portHere(run);
  if (!here) return null;
  const visit = (run.flags[`visits_${here.featureId}`] ?? 0) + 1;
  const rng = makeRng(run.seed).fork(`port:${here.featureId}:${visit}`);
  const tile = run.chart.tiles[key(run.chart.shipAt)]!;
  const tier = tile.dangerTier;
  // Prices drift upward the further from home you trade.
  const inflate = 1 + tier * 0.35;
  const recruitCount = here.isHome ? rng.int(1, 3) : rng.int(0, 2);
  const recruits = [];
  for (let i = 0; i < recruitCount; i++) {
    recruits.push(makeRecruit(rng, run.idCounter + i + 1));
  }
  return {
    featureId: here.featureId,
    name: here.name,
    isHome: here.isHome,
    stock: {
      foodPrice: Math.round(1 * inflate),
      waterPrice: 1,
      timberPrice: Math.round(2 * inflate),
      repairPricePerHull: Math.round(2 * inflate),
      recruits,
    },
  };
}

export function dock(run: GameRun, events: SimEvent[]): boolean {
  const port = makeActivePort(run);
  if (!port) return false;
  run.flags[`visits_${port.featureId}`] = (run.flags[`visits_${port.featureId}`] ?? 0) + 1;
  run.activePort = port;
  run.phase = 'port';
  const entry = {
    turn: run.turn,
    text: `The ${run.ship.name} ties up at ${port.name}.`,
    tone: 'info' as const,
  };
  run.log.push(entry);
  events.push({ type: 'LOG', entry });
  return true;
}

export function buy(run: GameRun, item: 'food' | 'water' | 'timber', qty: number): boolean {
  const port = run.activePort;
  if (!port || qty <= 0) return false;
  const price =
    item === 'food' ? port.stock.foodPrice : item === 'water' ? port.stock.waterPrice : port.stock.timberPrice;
  const cost = price * qty;
  if (run.silver < cost) return false;
  const cargo = run.food + run.water + run.timber * 2;
  if (cargo + qty > run.ship.cargoMax) return false;
  run.silver -= cost;
  if (item === 'food') run.food += qty;
  else if (item === 'water') run.water += qty;
  else run.timber += qty;
  return true;
}

export function repairAtPort(run: GameRun): boolean {
  const port = run.activePort;
  if (!port) return false;
  const missing = run.ship.hullMax - run.ship.hull;
  if (missing <= 0) return false;
  const affordable = Math.min(missing, Math.floor(run.silver / port.stock.repairPricePerHull));
  if (affordable <= 0) return false;
  run.silver -= affordable * port.stock.repairPricePerHull;
  run.ship.hull += affordable;
  return true;
}

export function recruit(run: GameRun, recruitId: string): boolean {
  const port = run.activePort;
  if (!port) return false;
  const idx = port.stock.recruits.findIndex((r) => r.id === recruitId);
  if (idx === -1) return false;
  const hire = port.stock.recruits[idx]!;
  const price = 5;
  if (run.silver < price) return false;
  run.silver -= price;
  port.stock.recruits.splice(idx, 1);
  run.idCounter += 1;
  run.crew.push({ ...hire, id: `crew_${run.idCounter}` });
  return true;
}

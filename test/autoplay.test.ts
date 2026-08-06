// Headless autoplay: a greedy bot plays complete runs through the real
// reducers. This is the balance harness — it catches soft-locks, runaway
// run lengths, and impossible difficulty without opening a browser.

import { describe, it, expect } from 'vitest';
import { neighbors, key, distance } from '../src/core/hex';
import { newRun } from '../src/sim/strategic/state';
import { sailCost, stepStrategic } from '../src/sim/strategic/sail';
import { livingUnits, moveCost } from '../src/sim/tactical/combatMath';
import { reachable } from '../src/core/path';
import { GameRun, StrategicIntent, TacticalIntent } from '../src/sim/types';

function col(h: { q: number; r: number }): number {
  return h.q + ((h.r - (h.r & 1)) >> 1);
}

/** One bot decision for the current state. */
function botIntent(run: GameRun, step: number): StrategicIntent | TacticalIntent {
  if (run.phase === 'event') {
    const ev = run.activeEvent!;
    if (ev.outcome) return { type: 'EVENT_CONTINUE' };
    // Prefer sure things; raid when healthy, avoid when battered.
    const healthy = run.crew.filter((c) => c.alive).length >= 5;
    let best = 0;
    let bestScore = -1;
    ev.options.forEach((o, i) => {
      let score = o.detail ? parseInt(o.detail.match(/(\d+)%/)?.[1] ?? '50', 10) : 100;
      if (o.label.toLowerCase().includes('raid') || o.label.toLowerCase().includes('board')) {
        score = healthy ? score + 20 : -10;
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return { type: 'CHOOSE_OPTION', index: best };
  }

  if (run.phase === 'port') {
    // Stock hard — supplies are life out west.
    if (run.silver >= 6 && run.food < 35) return { type: 'PORT_BUY', item: 'food', qty: 5 };
    if (run.silver >= 6 && run.water < 35) return { type: 'PORT_BUY', item: 'water', qty: 5 };
    if (run.silver >= 10 && run.ship.hull < run.ship.hullMax - 3) return { type: 'PORT_REPAIR' };
    return { type: 'PORT_LEAVE' };
  }

  if (run.phase === 'battle' && run.activeBattle) {
    const battle = run.activeBattle;
    if (battle.result) return { type: 'BATTLE_CONTINUE' };
    // First actionable unit: strike if adjacent, else advance, else end turn.
    for (const u of livingUnits(battle, 'player')) {
      if (u.statuses.includes('routing')) continue;
      const foes = livingUnits(battle, 'enemy');
      if (foes.length === 0) break;
      const adjacentFoe = foes.find((f) => distance(f.at, u.at) === 1);
      if (!u.hasActed && adjacentFoe) {
        return { type: 'T_STRIKE', unitId: u.id, targetId: adjacentFoe.id };
      }
      if (u.movesLeft > 0) {
        const nearest = [...foes].sort((a, b) => distance(a.at, u.at) - distance(b.at, u.at))[0]!;
        const options = reachable(u.at, u.movesLeft, (h) => moveCost(battle, h));
        let target: { q: number; r: number } | null = null;
        let bestD = distance(u.at, nearest.at);
        for (const k of options.keys()) {
          const c = k.indexOf(',');
          const h = { q: Number(k.slice(0, c)), r: Number(k.slice(c + 1)) };
          const d = distance(h, nearest.at);
          if (d < bestD) {
            bestD = d;
            target = h;
          }
        }
        if (target) return { type: 'T_MOVE', unitId: u.id, to: target };
      }
      if (!u.hasActed && !adjacentFoe) return { type: 'T_BRACE', unitId: u.id };
    }
    return { type: 'T_END_TURN' };
  }

  // Voyage: head west — unless supplies run thin, in which case detour to
  // the nearest discovered port to restock.
  const options = neighbors(run.chart.shipAt)
    .map((n) => ({ n, cost: sailCost(run, n) }))
    .filter((o): o is { n: { q: number; r: number }; cost: number } => o.cost !== null);
  if (options.length === 0) return { type: 'WAIT' };

  // Starving at sea: stop and fish/catch rain rather than rowing on empty.
  if (run.food < 6 || run.water < 6) {
    const t = run.chart.tiles[key(run.chart.shipAt)];
    if (t && (t.terrain === 'sea' || t.terrain === 'coast')) return { type: 'WAIT' };
  }

  const lowSupplies = run.food < 12 || run.water < 12;
  if (lowSupplies && run.silver >= 10) {
    let nearestPort: { q: number; r: number } | null = null;
    let nearestD = Infinity;
    for (const [k, t] of Object.entries(run.chart.tiles)) {
      if (!t.feature || (t.feature.kind !== 'port' && t.feature.kind !== 'home')) continue;
      if (!run.chart.discovered.has(k)) continue;
      const c = k.indexOf(',');
      const h = { q: Number(k.slice(0, c)), r: Number(k.slice(c + 1)) };
      const d = distance(h, run.chart.shipAt);
      if (d < nearestD) {
        nearestD = d;
        nearestPort = h;
      }
    }
    if (nearestPort && nearestD > 0 && nearestD <= 7) {
      options.sort(
        (a, b) => distance(a.n, nearestPort) - distance(b.n, nearestPort) || a.cost - b.cost,
      );
      return { type: 'SAIL', to: options[0]!.n };
    }
  }

  options.sort((a, b) => col(a.n) - col(b.n) || a.cost - b.cost || a.n.r - b.n.r);
  // Add mild wiggle so the bot doesn't ping-pong forever on coastlines.
  const pick = options[step % 3 === 0 && options.length > 1 ? 1 : 0]!;
  return { type: 'SAIL', to: pick.n };
}

interface RunStats {
  seed: string;
  outcome: string;
  turns: number;
  intents: number;
  westward: number;
}

function playRun(seed: string, maxIntents = 800): RunStats {
  let run = newRun(seed);
  let intents = 0;
  let stuck = 0;
  while (run.phase !== 'ended' && intents < maxIntents) {
    intents++;
    const intent = botIntent(run, intents);
    const { run: next } = stepStrategic(run, intent);
    if (next === run) {
      stuck++;
      // A rejected intent is a bot bug or a soft-lock; try ending turns/waiting.
      if (stuck > 5) {
        const fallback: (StrategicIntent | TacticalIntent)[] = [
          { type: 'T_END_TURN' },
          { type: 'EVENT_CONTINUE' },
          { type: 'PORT_LEAVE' },
          { type: 'BATTLE_CONTINUE' },
          { type: 'WAIT' },
          { type: 'ABANDON_RUN' },
        ];
        for (const f of fallback) {
          const r = stepStrategic(run, f);
          if (r.run !== run) {
            run = r.run;
            stuck = 0;
            break;
          }
        }
        if (stuck !== 0) break; // truly stuck — surfaces as assertion failure
      }
      continue;
    }
    stuck = 0;
    run = next;
    // Invariants that must hold at every step of every run.
    expect(run.food).toBeGreaterThanOrEqual(0);
    expect(run.water).toBeGreaterThanOrEqual(0);
    expect(run.silver).toBeGreaterThanOrEqual(0);
  }
  return {
    seed,
    outcome: run.end?.outcome ?? 'UNFINISHED',
    turns: run.turn,
    intents,
    westward: col(run.chart.startAt) - col(run.chart.shipAt),
  };
}

describe('autoplay balance harness', () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => `autoplay-${i}`);
  const results: RunStats[] = [];

  it.each(SEEDS.map((s) => [s]))('run %s terminates cleanly', (seed) => {
    const stats = playRun(seed);
    results.push(stats);
    expect(stats.outcome).not.toBe('UNFINISHED');
    expect(stats.intents).toBeLessThan(800);
  });

  it('difficulty lands in a sane band across seeds', () => {
    expect(results.length).toBe(SEEDS.length);
    // eslint-disable-next-line no-console
    console.table(results);
    const westMax = Math.max(...results.map((r) => r.westward));
    const meanTurns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    // The greedy bot should at least clear the first third of the crossing
    // on its best seed, and average runs shouldn't drag past ~150 turns.
    expect(westMax).toBeGreaterThanOrEqual(14);
    expect(meanTurns).toBeLessThan(150);
    // Death is expected; universal instant death is not.
    const early = results.filter((r) => r.turns < 10).length;
    expect(early).toBeLessThan(results.length / 2);
  });
});

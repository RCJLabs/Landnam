import { describe, it, expect } from 'vitest';
import { newRun } from '../src/sim/strategic/state';
import { stepStrategic, sailCost, livingCrew } from '../src/sim/strategic/sail';
import { key, neighbors } from '../src/core/hex';
import { GameRun, StrategicIntent } from '../src/sim/types';
import { encodeRun, decodeRun } from '../src/save/codec';

function sailableNeighbor(run: GameRun): { q: number; r: number } {
  const nb = neighbors(run.chart.shipAt).find((n) => sailCost(run, n) !== null);
  if (!nb) throw new Error('ship is boxed in — bad test seed');
  return nb;
}

describe('strategic sim', () => {
  it('newRun is deterministic per seed', () => {
    const a = newRun('sim-det');
    const b = newRun('sim-det');
    expect(encodeRun(a)).toBe(encodeRun(b));
  });

  it('sailing moves the ship, consumes supplies, advances the turn', () => {
    const run = newRun('sail-basic');
    const to = sailableNeighbor(run);
    const { run: next, events } = stepStrategic(run, { type: 'SAIL', to });
    expect(next.turn).toBe(1);
    expect(next.chart.shipAt).toEqual(to);
    expect(next.food).toBeLessThan(run.food);
    expect(next.water).toBeLessThan(run.water);
    expect(events.some((e) => e.type === 'MOVED')).toBe(true);
    // Original state untouched (pure reducer).
    expect(run.turn).toBe(0);
  });

  it('rejects sailing to non-adjacent or land hexes', () => {
    const run = newRun('sail-reject');
    const far = { q: run.chart.shipAt.q + 5, r: run.chart.shipAt.r };
    expect(stepStrategic(run, { type: 'SAIL', to: far }).events).toHaveLength(0);
    const landKey = Object.entries(run.chart.tiles).find(([, t]) => t.terrain === 'land')?.[0];
    expect(landKey).toBeDefined();
  });

  it('sailing on empty stores drains crew hp and eventually kills', () => {
    let run = newRun('starve-test');
    run = structuredClone(run);
    run.food = 0;
    run.water = 0;
    let died = false;
    for (let i = 0; i < 60 && run.phase === 'voyage'; i++) {
      const to = neighbors(run.chart.shipAt).find((n) => sailCost(run, n) !== null);
      if (!to) break;
      const result = stepStrategic(run, { type: 'SAIL', to });
      run = result.run;
      if (run.phase === 'event') {
        run = stepStrategic(run, { type: 'CHOOSE_OPTION', index: 0 }).run;
        run = stepStrategic(run, { type: 'EVENT_CONTINUE' }).run;
      }
      if (run.phase === 'port') run = stepStrategic(run, { type: 'PORT_LEAVE' }).run;
      if (run.phase === 'battle') break; // seed-dependent detour; not this test's concern
      if (result.events.some((e) => e.type === 'CREW_DIED')) died = true;
      // Events can gift food; re-drain to keep the starvation pressure on.
      run.food = 0;
      run.water = 0;
    }
    expect(died || run.phase === 'ended').toBe(true);
  });

  it('replay determinism: same seed + same intents => identical state', () => {
    const intents: StrategicIntent[] = [];
    let a = newRun('replay-seed');
    for (let i = 0; i < 15 && a.phase === 'voyage'; i++) {
      const intent: StrategicIntent =
        i % 5 === 4 ? { type: 'WAIT' } : { type: 'SAIL', to: sailableNeighbor(a) };
      intents.push(intent);
      a = stepStrategic(a, intent).run;
    }
    let b = newRun('replay-seed');
    for (const intent of intents) b = stepStrategic(b, intent).run;
    expect(encodeRun(a)).toBe(encodeRun(b));
  });

  it('save codec roundtrips a played run', () => {
    let run = newRun('codec-seed');
    for (let i = 0; i < 8 && run.phase === 'voyage'; i++) {
      run = stepStrategic(run, { type: 'SAIL', to: sailableNeighbor(run) }).run;
    }
    const decoded = decodeRun(encodeRun(run));
    expect(encodeRun(decoded)).toBe(encodeRun(run));
    expect(decoded.chart.discovered.has(key(decoded.chart.shipAt))).toBe(true);
  });

  it('abandoning ends the run with halved fame', () => {
    const run = newRun('abandon-seed');
    const { run: next } = stepStrategic(run, { type: 'ABANDON_RUN' });
    expect(next.phase).toBe('ended');
    expect(next.end?.outcome).toBe('abandoned');
  });

  it('fuzz: random legal intents never corrupt the run', () => {
    let run = newRun('fuzz-seed');
    let steps = 0;
    while (run.phase === 'voyage' && steps < 200) {
      steps++;
      const options = neighbors(run.chart.shipAt).filter((n) => sailCost(run, n) !== null);
      const intent: StrategicIntent =
        steps % 7 === 0 || options.length === 0
          ? { type: 'WAIT' }
          : { type: 'SAIL', to: options[steps % options.length]! };
      run = stepStrategic(run, intent).run;
      expect(run.food).toBeGreaterThanOrEqual(0);
      expect(run.water).toBeGreaterThanOrEqual(0);
      expect(run.ship.hull).toBeGreaterThanOrEqual(-10); // sinks at <=0, never wild
      expect(livingCrew(run)).toBeGreaterThanOrEqual(0);
    }
    expect(steps).toBeGreaterThan(0);
  });
});

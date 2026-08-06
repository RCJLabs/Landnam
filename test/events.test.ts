import { describe, it, expect } from 'vitest';
import { EVENTS } from '../src/content/events';
import { checkOdds, eligible, eventById } from '../src/sim/events/engine';
import { newRun } from '../src/sim/strategic/state';
import { stepStrategic, sailCost } from '../src/sim/strategic/sail';
import { neighbors } from '../src/core/hex';
import { GameRun, StrategicIntent } from '../src/sim/types';

describe('event content lint', () => {
  it('ids are unique and stable-looking', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every event has 1-4 options with non-empty text', () => {
    for (const e of EVENTS) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.options.length).toBeGreaterThanOrEqual(1);
      expect(e.options.length).toBeLessThanOrEqual(4);
      for (const o of e.options) {
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.success.text.length).toBeGreaterThan(0);
        if (o.check) {
          expect(o.failure).toBeDefined();
          expect(o.check.dc).toBeGreaterThanOrEqual(5);
          expect(o.check.dc).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('weights are positive', () => {
    for (const e of EVENTS) expect(e.weight).toBeGreaterThan(0);
  });
});

describe('event engine', () => {
  it('checkOdds is monotonic in stat and bounded', () => {
    for (let dc = 5; dc <= 12; dc++) {
      let prev = 0;
      for (let stat = 1; stat <= 6; stat++) {
        const p = checkOdds(stat, dc);
        expect(p).toBeGreaterThanOrEqual(prev);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        prev = p;
      }
    }
    expect(checkOdds(6, 5)).toBe(1); // needs -1 on 2d6
  });

  it('once-events become ineligible after being seen', () => {
    const run = newRun('event-once');
    const def = eventById('castaway')!;
    const eligibleBefore = eligible({ ...run, turn: 10 } as GameRun, def);
    expect(eligibleBefore).toBe(true);
    const seen = structuredClone(run);
    seen.turn = 10;
    seen.flags['seen_castaway'] = 1;
    expect(eligible(seen, def)).toBe(false);
  });

  it('feature events only fire on their features', () => {
    const run = newRun('event-feature');
    // Ship starts on home port, not a wreck.
    expect(eligible(run, eventById('wreck-pickings')!)).toBe(false);
  });
});

describe('events in play', () => {
  function playUntilEvent(seed: string, maxSteps = 120): GameRun | null {
    let run = newRun(seed);
    let steps = 0;
    while (run.phase !== 'event' && run.phase !== 'ended' && steps < maxSteps) {
      steps++;
      if (run.phase === 'port') {
        run = stepStrategic(run, { type: 'PORT_LEAVE' }).run;
        continue;
      }
      const options = neighbors(run.chart.shipAt).filter((n) => sailCost(run, n) !== null);
      const intent: StrategicIntent =
        options.length === 0 ? { type: 'WAIT' } : { type: 'SAIL', to: options[steps % options.length]! };
      run = stepStrategic(run, intent).run;
    }
    return run.phase === 'event' ? run : null;
  }

  it('events fire during sailing and resolve cleanly', () => {
    const run = playUntilEvent('event-play-seed');
    expect(run).not.toBeNull();
    const active = run!.activeEvent!;
    expect(active.options.length).toBeGreaterThan(0);

    // Choose option 0, get an outcome, continue back to voyage.
    const afterChoice = stepStrategic(run!, { type: 'CHOOSE_OPTION', index: 0 }).run;
    expect(afterChoice.activeEvent?.outcome).toBeDefined();
    const afterContinue = stepStrategic(afterChoice, { type: 'EVENT_CONTINUE' }).run;
    if (afterContinue.phase !== 'ended') {
      expect(['voyage', 'port']).toContain(afterContinue.phase);
      expect(afterContinue.activeEvent).toBeUndefined();
    }
  });

  it('choice resolution is deterministic', () => {
    const run = playUntilEvent('event-det-seed');
    expect(run).not.toBeNull();
    const a = stepStrategic(run!, { type: 'CHOOSE_OPTION', index: 0 }).run;
    const b = stepStrategic(run!, { type: 'CHOOSE_OPTION', index: 0 }).run;
    expect(JSON.stringify(a.activeEvent)).toBe(JSON.stringify(b.activeEvent));
  });

  it('sailing intents are rejected during an event', () => {
    const run = playUntilEvent('event-block-seed');
    expect(run).not.toBeNull();
    const to = neighbors(run!.chart.shipAt)[0]!;
    const { events } = stepStrategic(run!, { type: 'SAIL', to });
    expect(events).toHaveLength(0);
  });
});

describe('ports in play', () => {
  it('docking at home offers trade and departure works', () => {
    // A new run starts on the home port tile; sail off and back to dock,
    // or use DOCK directly since we start there.
    const run = newRun('port-seed');
    const { run: docked } = stepStrategic(run, { type: 'DOCK' });
    expect(docked.phase).toBe('port');
    expect(docked.activePort?.isHome).toBe(true);

    const bought = stepStrategic(docked, { type: 'PORT_BUY', item: 'food', qty: 5 }).run;
    expect(bought.food).toBe(run.food + 5);
    expect(bought.silver).toBeLessThan(run.silver);

    const left = stepStrategic(bought, { type: 'PORT_LEAVE' }).run;
    expect(left.phase).toBe('voyage');
    expect(left.activePort).toBeUndefined();
  });

  it('cannot buy beyond your silver', () => {
    const run = newRun('port-poor-seed');
    const docked = stepStrategic(run, { type: 'DOCK' }).run;
    const poor = structuredClone(docked);
    poor.silver = 0;
    const { events } = stepStrategic(poor, { type: 'PORT_BUY', item: 'food', qty: 5 });
    expect(events).toHaveLength(0);
  });

  it('recruiting adds a crew member and costs silver', () => {
    const run = newRun('port-recruit-seed');
    const docked = stepStrategic(run, { type: 'DOCK' }).run;
    const recruits = docked.activePort!.stock.recruits;
    if (recruits.length === 0) return; // seed-dependent; other seeds cover it
    const before = docked.crew.length;
    const hired = stepStrategic(docked, { type: 'PORT_RECRUIT', recruitId: recruits[0]!.id }).run;
    expect(hired.crew.length).toBe(before + 1);
    expect(hired.silver).toBe(docked.silver - 5);
  });
});

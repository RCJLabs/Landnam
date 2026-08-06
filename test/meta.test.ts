// P5: unlocks, mythic content, saga summaries.

import { describe, it, expect } from 'vitest';
import { neighbors } from '../src/core/hex';
import { newRun } from '../src/sim/strategic/state';
import { sailCost, stepStrategic } from '../src/sim/strategic/sail';
import { UNLOCKS } from '../src/content/unlocks';
import { EVENTS } from '../src/content/events';
import { RAIDS, raidById } from '../src/content/raids';
import { ENEMIES } from '../src/content/enemies';

describe('unlock content lint', () => {
  it('ids unique, costs positive, blurbs present', () => {
    const ids = UNLOCKS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UNLOCKS) {
      expect(u.cost).toBeGreaterThan(0);
      expect(u.blurb.length).toBeGreaterThan(0);
    }
  });

  it('every startBattle effect points at a real raid, every roster at real enemies', () => {
    for (const e of EVENTS) {
      for (const o of e.options) {
        for (const branch of [o.success, o.failure]) {
          if (!branch) continue;
          for (const eff of branch.effects) {
            if (eff.t === 'startBattle') {
              expect(RAIDS.some((r) => r.id === eff.raidId), `${e.id} -> ${eff.raidId}`).toBe(true);
            }
          }
        }
      }
    }
    for (const r of RAIDS) {
      for (const roster of r.roster) {
        for (const kind of roster) {
          expect(ENEMIES.some((en) => en.id === kind)).toBe(true);
        }
      }
    }
  });
});

describe('unlocks in play', () => {
  it('hardy-crew, full-hold, war-chest change starting conditions', () => {
    const plain = newRun('unlock-seed');
    const boosted = newRun('unlock-seed', ['hardy-crew', 'full-hold', 'war-chest']);
    expect(boosted.crew[0]!.hpMax).toBe(plain.crew[0]!.hpMax + 2);
    expect(boosted.food).toBe(plain.food + 10);
    expect(boosted.water).toBe(plain.water + 10);
    expect(boosted.silver).toBe(plain.silver + 15);
    // Chart identical: unlocks must not perturb procgen.
    expect(JSON.stringify(plain.chart.tiles)).toBe(JSON.stringify(boosted.chart.tiles));
  });

  it('sealskin sails reduce adverse-wind cost', () => {
    const plain = newRun('sails-seed');
    const sailed = newRun('sails-seed', ['sealskin-sails']);
    expect(sailed.ship.upgrades).toContain('sealskin-sails');
    // For every neighbor, cost with sails <= cost without.
    for (const n of neighbors(plain.chart.shipAt)) {
      const a = sailCost(plain, n);
      const b = sailCost(sailed, n);
      if (a !== null && b !== null) expect(b).toBeLessThanOrEqual(a);
    }
  });

  it('veteran captain gets stronger, deterministically', () => {
    const a = newRun('vet-seed', ['veteran-captain']);
    const b = newRun('vet-seed', ['veteran-captain']);
    const plain = newRun('vet-seed');
    const sum = (r: typeof a) =>
      r.crew[0]!.might + r.crew[0]!.skill + r.crew[0]!.guts + r.crew[0]!.sea;
    expect(sum(a)).toBeGreaterThan(sum(plain));
    expect(JSON.stringify(a.crew[0])).toBe(JSON.stringify(b.crew[0]));
  });
});

describe('mythic raids', () => {
  it('draugr ship exists with an all-draugr roster', () => {
    const raid = raidById('draugr-ship');
    for (const roster of raid.roster) {
      expect(roster.every((k) => k === 'draugr')).toBe(true);
    }
  });
});

describe('saga summary', () => {
  it('abandoning produces deed lines', () => {
    const run = newRun('summary-seed');
    const ended = stepStrategic(run, { type: 'ABANDON_RUN' }).run;
    expect(ended.end!.summary.length).toBeGreaterThanOrEqual(2);
    expect(ended.end!.summary.some((s) => s.includes('crew'))).toBe(true);
  });
});

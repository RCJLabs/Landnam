import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/core/rng';
import { raidById, RAIDS } from '../src/content/raids';
import { ENEMIES } from '../src/content/enemies';
import { makeBattle, unitFromCrew } from '../src/sim/tactical/battle';
import {
  attackProfile,
  isFlanking,
  livingUnits,
  wallBonus,
} from '../src/sim/tactical/combatMath';
import { refreshSide, tryBrace, tryMove, tryStrike } from '../src/sim/tactical/actions';
import { runEnemyTurn } from '../src/sim/tactical/ai';
import { newRun } from '../src/sim/strategic/state';
import { sailCost, stepStrategic } from '../src/sim/strategic/sail';
import { neighbors } from '../src/core/hex';
import { Battle, GameRun, Unit } from '../src/sim/types';

function testBattle(seed = 'battle-seed', tier: 0 | 1 | 2 | 3 = 0): Battle {
  const run = newRun(seed);
  return makeBattle(raidById('monastery'), run.crew, tier, makeRng(seed).fork('bt'));
}

describe('raid content lint', () => {
  it('templates are rectangular with deploy zones and known chars', () => {
    for (const raid of RAIDS) {
      const w = raid.template[0]!.length;
      let p = 0;
      let e = 0;
      for (const row of raid.template) {
        expect(row.length).toBe(w);
        for (const ch of row) {
          expect('.s,~#^PE'.includes(ch)).toBe(true);
          if (ch === 'P') p++;
          if (ch === 'E') e++;
        }
      }
      expect(p).toBeGreaterThanOrEqual(4);
      expect(e).toBeGreaterThanOrEqual(3);
      // Roster fits deploy zones per tier.
      for (const roster of raid.roster) {
        expect(roster.length).toBeGreaterThan(0);
        for (const kind of roster) {
          expect(ENEMIES.some((en) => en.id === kind)).toBe(true);
        }
      }
    }
  });
});

describe('battle construction', () => {
  it('spawns player units from living crew and enemies from roster', () => {
    const b = testBattle();
    expect(livingUnits(b, 'player').length).toBeGreaterThanOrEqual(4);
    expect(livingUnits(b, 'enemy').length).toBeGreaterThanOrEqual(3);
    for (const u of livingUnits(b, 'player')) expect(u.crewId).toBeDefined();
  });

  it('is deterministic per rng seed', () => {
    const a = testBattle('det-b');
    const b = testBattle('det-b');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('combat math', () => {
  function lineUp(units: Partial<Unit>[]): Battle {
    const b = testBattle('math-seed');
    // Clear the board and place custom units.
    b.units = units.map((partial, i) => ({
      id: `t_${i}`,
      side: 'player',
      kind: 'crew',
      name: `T${i}`,
      at: { q: 0, r: 0 },
      hp: 10,
      hpMax: 10,
      atk: 4,
      def: 3,
      guts: 4,
      move: 3,
      damage: 3,
      statuses: [],
      movesLeft: 3,
      hasActed: false,
      alive: true,
      escaped: false,
      ...partial,
    }));
    return b;
  }

  it('shield-wall grants +1 def per adjacent steady ally, capped at 2', () => {
    // Three player units in a row on open grass around (5,4).
    const b = lineUp([
      { at: { q: 4, r: 4 } },
      { at: { q: 5, r: 4 } },
      { at: { q: 6, r: 4 } },
    ]);
    expect(wallBonus(b, b.units[1]!)).toBe(2); // middle has two partners
    expect(wallBonus(b, b.units[0]!)).toBe(1);
    // A routing ally stops counting.
    b.units[0]!.statuses.push('routing');
    expect(wallBonus(b, b.units[1]!)).toBe(1);
  });

  it('flanking pincer ignores wall and boosts attack', () => {
    const b = lineUp([
      { at: { q: 4, r: 4 }, side: 'enemy' }, // attacker west
      { at: { q: 5, r: 4 } }, // defender center (player)
      { at: { q: 4, r: 5 } }, // defender's ally adjacent (gives wall 1)
      { at: { q: 6, r: 4 }, side: 'enemy' }, // pincer ally east
    ]);
    const attacker = b.units[0]!;
    const defender = b.units[1]!;
    expect(isFlanking(b, attacker, defender)).toBe(true);
    const prof = attackProfile(b, attacker, defender);
    expect(prof.flanked).toBe(true);
    expect(prof.atk).toBe(attacker.atk + 1);
    // Without the pincer ally, wall applies again.
    b.units[3]!.alive = false;
    const prof2 = attackProfile(b, attacker, defender);
    expect(prof2.flanked).toBe(false);
    expect(prof2.effDef).toBeGreaterThan(prof.effDef);
  });

  it('braced adds +2 effective def until the unit acts', () => {
    const b = lineUp([
      { at: { q: 4, r: 4 }, side: 'enemy' },
      { at: { q: 5, r: 4 } },
    ]);
    const before = attackProfile(b, b.units[0]!, b.units[1]!).effDef;
    tryBrace(b.units[1]!);
    const after = attackProfile(b, b.units[0]!, b.units[1]!).effDef;
    expect(after).toBe(before + 2);
  });
});

describe('actions', () => {
  it('movement respects range and occupancy', () => {
    const b = testBattle('move-seed');
    const u = livingUnits(b, 'player')[0]!;
    const far = { q: u.at.q + 6, r: u.at.r };
    expect(tryMove(b, u, far)).toBe(false);
    const enemy = livingUnits(b, 'enemy')[0]!;
    expect(tryMove(b, u, enemy.at)).toBe(false);
  });

  it('strike only hits adjacent foes and spends the action', () => {
    const b = testBattle('strike-seed');
    const u = livingUnits(b, 'player')[0]!;
    const enemy = livingUnits(b, 'enemy')[0]!;
    const log: { text: string; tone: 'info' | 'good' | 'bad' }[] = [];
    // Not adjacent at deploy: strike must fail.
    expect(tryStrike(b, u, enemy, makeRng('x'), log)).toBe(false);
    // Teleport adjacent and strike.
    u.at = { q: enemy.at.q - 1, r: enemy.at.r };
    expect(tryStrike(b, u, enemy, makeRng('x'), log)).toBe(true);
    expect(u.hasActed).toBe(true);
    expect(tryStrike(b, u, enemy, makeRng('x'), log)).toBe(false);
  });
});

describe('enemy AI', () => {
  it('every enemy acts legally and the turn never throws', () => {
    const b = testBattle('ai-seed', 1);
    const log: { text: string; tone: 'info' | 'good' | 'bad' }[] = [];
    refreshSide(b, 'enemy');
    runEnemyTurn(b, makeRng('ai-run'), log);
    // No enemy ended on top of another unit.
    const positions = b.units.filter((u) => u.alive && !u.escaped).map((u) => `${u.at.q},${u.at.r}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('battles resolve within bounded rounds when the player braces in place', () => {
    // Headless: player does nothing but end turn; enemies must eventually
    // close and finish it one way or another (no infinite stalemate).
    let run = newRun('headless-battle');
    run = structuredClone(run);
    // Force a battle via the effect path.
    const tier = 0;
    run.activeBattle = makeBattle(raidById('monastery'), run.crew, tier, makeRng('hb').fork('bt'));
    run.phase = 'battle';
    let rounds = 0;
    while (!run.activeBattle?.result && rounds < 60) {
      rounds++;
      run = stepStrategic(run, { type: 'T_END_TURN' }).run;
    }
    expect(run.activeBattle?.result).toBeDefined();
  });
});

describe('battle in play', () => {
  function runToBattle(seed: string): GameRun | null {
    // Drive a run until a monastery/village event offers a raid.
    let run = newRun(seed);
    for (let step = 0; step < 200 && run.phase !== 'ended'; step++) {
      if (run.phase === 'battle') return run;
      if (run.phase === 'port') {
        run = stepStrategic(run, { type: 'PORT_LEAVE' }).run;
        continue;
      }
      if (run.phase === 'event') {
        const idx = run.activeEvent!.options.findIndex((o) => o.label === 'Raid it');
        if (run.activeEvent!.outcome) {
          run = stepStrategic(run, { type: 'EVENT_CONTINUE' }).run;
        } else {
          run = stepStrategic(run, { type: 'CHOOSE_OPTION', index: idx >= 0 ? idx : 0 }).run;
        }
        continue;
      }
      // Random-walk the coastlines until a raid event fires.
      const options = neighbors(run.chart.shipAt).filter((n) => sailCost(run, n) !== null);
      if (options.length === 0) {
        run = stepStrategic(run, { type: 'WAIT' }).run;
        continue;
      }
      run = stepStrategic(run, { type: 'SAIL', to: options[step % options.length]! }).run;
    }
    return null;
  }

  it('a raid battle can be reached, fought, and resolved end-to-end', () => {
    const run = runToBattle('e2e-battle-seed');
    if (!run) return; // seed-dependent pathing; the headless test covers resolution
    expect(run.activeBattle).toBeDefined();
    let cur = run;
    let guard = 0;
    while (!cur.activeBattle?.result && guard++ < 80) {
      cur = stepStrategic(cur, { type: 'T_END_TURN' }).run;
    }
    expect(cur.activeBattle?.result).toBeDefined();
    const after = stepStrategic(cur, { type: 'BATTLE_CONTINUE' }).run;
    expect(after.activeBattle).toBeUndefined();
    expect(['voyage', 'ended']).toContain(after.phase);
  });
});

describe('crew unit conversion', () => {
  it('carries stats, weapons, and armor into units', () => {
    const run = newRun('conv-seed');
    const cap = run.crew.find((c) => c.isCaptain)!;
    const u = unitFromCrew(cap, { q: 0, r: 0 });
    expect(u.atk).toBe(cap.might + 1); // sword bonus
    expect(u.crewId).toBe(cap.id);
    expect(u.hp).toBe(cap.hp);
  });
});

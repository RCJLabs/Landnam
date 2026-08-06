// P4 mechanics: push, rally, fatigue, injuries, boarding template.

import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/core/rng';
import { key, neighbors, fromKey } from '../src/core/hex';
import { raidById, RAIDS } from '../src/content/raids';
import { makeBattle } from '../src/sim/tactical/battle';
import { tryPush, tryRally, tryBrace, tryMove } from '../src/sim/tactical/actions';
import { attackProfile, passable } from '../src/sim/tactical/combatMath';
import { applyBattleOutcome } from '../src/sim/tactical/outcome';
import { newRun } from '../src/sim/strategic/state';
import { effStat } from '../src/sim/strategic/crewGen';
import { Battle, Unit } from '../src/sim/types';

function baseUnit(partial: Partial<Unit>): Unit {
  return {
    id: 'x',
    side: 'player',
    kind: 'crew',
    name: 'X',
    at: { q: 0, r: 0 },
    hp: 10,
    hpMax: 10,
    atk: 4,
    def: 3,
    guts: 4,
    move: 3,
    damage: 3,
    isLeader: false,
    fatigue: 0,
    statuses: [],
    movesLeft: 3,
    hasActed: false,
    alive: true,
    escaped: false,
    ...partial,
  };
}

function boardingBattle(): Battle {
  const run = newRun('push-seed');
  return makeBattle(raidById('boarding'), run.crew, 0, makeRng('push-seed').fork('bt'));
}

describe('boarding template', () => {
  it('every player deploy can reach every enemy deploy over decks', () => {
    for (const raid of RAIDS) {
      const b = makeBattle(raid, newRun(`conn-${raid.id}`).crew, 0, makeRng('c').fork('bt'));
      // Flood fill from the first player unit over passable terrain (ignoring
      // unit occupancy — formation blocking is a tactics problem, not a map bug).
      const start = b.units.find((u) => u.side === 'player')!.at;
      const seen = new Set([key(start)]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.pop()!;
        for (const nb of neighbors(cur)) {
          const k = key(nb);
          if (seen.has(k) || !passable(b, nb)) continue;
          seen.add(k);
          queue.push(nb);
        }
      }
      for (const u of b.units) {
        expect(seen.has(key(u.at)), `${raid.id}: unit ${u.id} unreachable`).toBe(true);
      }
    }
  });
});

describe('push', () => {
  it('a won shove into open water kills the defender', () => {
    const b = boardingBattle();
    // Place a strong attacker beside a weak defender whose back is to the sea.
    const water = Object.entries(b.grid).find(([, t]) => t.terrain === 'water');
    expect(water).toBeDefined();
    // Find a deck hex with a water neighbor, and a deck neighbor opposite.
    let placed = false;
    outer: for (const [k, t] of Object.entries(b.grid)) {
      if (t.terrain !== 'deck') continue;
      const h = fromKey(k);
      const nbs = neighbors(h);
      for (let dir = 0; dir < 6; dir++) {
        const front = nbs[dir]!;
        const back = nbs[(dir + 3) % 6]!;
        if (b.grid[key(front)]?.terrain === 'water' && b.grid[key(back)]?.terrain === 'deck') {
          b.units = [
            baseUnit({ id: 'a', at: back, atk: 12 }),
            baseUnit({ id: 'd', side: 'enemy', at: h, atk: 0 }),
          ];
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    const log: { text: string; tone: 'info' | 'good' | 'bad' }[] = [];
    const [attacker, defender] = b.units as [Unit, Unit];
    expect(tryPush(b, attacker, defender, makeRng('shove'), log)).toBe(true);
    expect(defender.alive).toBe(false);
    expect(log.some((l) => l.text.includes('over the side'))).toBe(true);
  });

  it('push onto open ground moves the defender back one hex', () => {
    const b = boardingBattle();
    // Line three deck hexes: attacker, defender, empty behind.
    let placed = false;
    outer: for (const [k, t] of Object.entries(b.grid)) {
      if (t.terrain !== 'deck') continue;
      const h = fromKey(k);
      const nbs = neighbors(h);
      for (let dir = 0; dir < 6; dir++) {
        const front = nbs[dir]!;
        const back = nbs[(dir + 3) % 6]!;
        if (b.grid[key(front)]?.terrain === 'deck' && b.grid[key(back)]?.terrain === 'deck') {
          b.units = [
            baseUnit({ id: 'a', at: back, atk: 12 }),
            baseUnit({ id: 'd', side: 'enemy', at: h, atk: 0 }),
          ];
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    const [attacker, defender] = b.units as [Unit, Unit];
    const before = { ...defender.at };
    const log: { text: string; tone: 'info' | 'good' | 'bad' }[] = [];
    expect(tryPush(b, attacker, defender, makeRng('shove2'), log)).toBe(true);
    expect(defender.alive).toBe(true);
    expect(defender.at).not.toEqual(before);
  });
});

describe('rally', () => {
  it('only leaders rally; routing allies within 2 hexes recover', () => {
    const b = boardingBattle();
    b.units = [
      baseUnit({ id: 'cap', at: { q: 3, r: 3 }, isLeader: true }),
      baseUnit({ id: 'runner', at: { q: 4, r: 3 }, statuses: ['routing'] }),
      baseUnit({ id: 'far', at: { q: 9, r: 3 }, statuses: ['routing'] }),
    ];
    const log: { text: string; tone: 'info' | 'good' | 'bad' }[] = [];
    const nonLeader = baseUnit({ id: 'nl', at: { q: 3, r: 4 } });
    b.units.push(nonLeader);
    expect(tryRally(b, nonLeader, log)).toBe(false);
    const moraleBefore = b.sideMorale.player;
    expect(tryRally(b, b.units[0]!, log)).toBe(true);
    expect(b.sideMorale.player).toBe(moraleBefore + 3);
    expect(b.units[1]!.statuses).not.toContain('routing');
    expect(b.units[2]!.statuses).toContain('routing'); // too far away
  });
});

describe('fatigue', () => {
  it('fatigue 6+ costs a point of attack and defense', () => {
    const b = boardingBattle();
    b.units = [
      baseUnit({ id: 'a', at: { q: 3, r: 3 } }),
      baseUnit({ id: 'd', side: 'enemy', at: { q: 4, r: 3 } }),
    ];
    const fresh = attackProfile(b, b.units[0]!, b.units[1]!);
    b.units[0]!.fatigue = 6;
    b.units[1]!.fatigue = 6;
    const tired = attackProfile(b, b.units[0]!, b.units[1]!);
    expect(tired.atk).toBe(fresh.atk - 1);
    expect(tired.effDef).toBe(fresh.effDef - 1);
  });

  it('brace sheds fatigue; sprinting adds it', () => {
    const b = boardingBattle();
    b.units = [baseUnit({ id: 'a', at: { q: 3, r: 3 }, fatigue: 4 })];
    const u = b.units[0]!;
    tryBrace(u);
    expect(u.fatigue).toBe(2);
    u.hasActed = false;
    u.movesLeft = 3;
    // A full 3-hex sprint tires.
    const target = { q: 6, r: 3 };
    if (tryMove(b, u, target)) {
      expect(u.fatigue).toBe(3);
    }
  });
});

describe('injuries', () => {
  it('downed crew can survive maimed, and injuries dent effective stats', () => {
    const run = structuredClone(newRun('injury-seed'));
    const battle = makeBattle(raidById('monastery'), run.crew, 0, makeRng('inj').fork('bt'));
    battle.result = 'won';
    // Down every player unit; over many crew + seeds, some roll injuries.
    for (const u of battle.units) {
      if (u.side === 'player') {
        u.alive = false;
        u.hp = 0;
      }
    }
    run.activeBattle = battle;
    applyBattleOutcome(run, battle, [], makeRng('injury-outcome'));
    const injured = run.crew.filter((c) => c.alive && c.injuries.length > 0);
    const dead = run.crew.filter((c) => !c.alive);
    expect(injured.length + dead.length).toBeGreaterThan(0);
    for (const c of injured) {
      const anyPenalty =
        effStat(c, 'might') < c.might ||
        effStat(c, 'skill') < c.skill ||
        effStat(c, 'guts') < c.guts ||
        effStat(c, 'sea') < c.sea;
      expect(anyPenalty).toBe(true);
    }
  });
});

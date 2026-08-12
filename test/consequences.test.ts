// 2.4: what a fight leaves behind — the dead, the maimed, the loot, and what
// the living learned. The bar for this milestone is that losing a veteran
// measurably hurts, so most of this file measures rather than asserts.

import { describe, it, expect } from 'vitest';
import { distance } from '../src/hex';
import { newGame } from '../src/state/create';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { activeCombatant, standing } from '../src/sim/battle';
import { leaveBattle, startBattle } from '../src/sim/battleTurn';
import { reachWithZoc } from '../src/sim/zoc';
import { bestStat, effectiveStat, living } from '../src/sim/people';
import { passDay } from '../src/sim/upkeep';
import { LASTING } from '../src/data/injuries';
import {
  rollFate,
  settleAftermath,
  theFallen,
  XP_PER_ADVANCE,
  XP_PER_KILL,
} from '../src/sim/consequences';
import { stream } from '../src/rng';
import type { GameState, Person, Stats } from '../src/state/types';

const STATS: (keyof Stats)[] = ['might', 'wits', 'spirit', 'craft'];

function fresh(seed: string): GameState {
  return structuredClone(newGame(seed));
}

/** Fight it out with a simple close-and-strike bot, then walk off the field. */
function fightAndLeave(state: GameState): GameState {
  let cur = state;
  for (let i = 0; i < 800 && !cur.battle?.outcome; i++) {
    const battle = cur.battle!;
    const active = activeCombatant(battle);
    if (!active || active.side !== 'warband') {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const foes = standing(battle, 'foe');
    const adjacent = foes.filter((c) => distance(c.at, active.at) === 1);
    if (!active.hasActed && adjacent.length > 0) {
      cur = apply(cur, { type: 'B_STRIKE', targetId: adjacent[0]!.personId });
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const reach = [...reachWithZoc(battle, active).keys()].map((k) => ({
      q: Number(k.split(',')[0]),
      r: Number(k.split(',')[1]),
    }));
    if (reach.length > 0 && foes.length > 0) {
      const best = [...reach].sort(
        (a, b) =>
          Math.min(...foes.map((f) => distance(a, f.at))) -
          Math.min(...foes.map((f) => distance(b, f.at))),
      )[0]!;
      const moved = apply(cur, { type: 'B_MOVE', to: best });
      cur = moved === cur ? apply(cur, { type: 'B_END_TURN' }) : moved;
      continue;
    }
    cur = apply(cur, { type: 'B_END_TURN' });
  }
  return apply(cur, { type: 'B_LEAVE' });
}

// --- Permadeath ---

describe('the dead stay dead', () => {
  // Sixteen whole battles plus twenty simulated days after each: fine on a
  // dev box, but past vitest's 5s default on a 2-core CI runner with the
  // rest of the suite competing for it — which is exactly how it flaked.
  it('a fight can kill outright, and the killed never come back', { timeout: 120_000 }, async () => {
    let deaths = 0;
    for (let i = 0; i < 16; i++) {
      // Breathe between fights: a long synchronous stretch starves the
      // worker's RPC heartbeat on CI. See balance.test.ts.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const state = fresh(`death-${i}`);
      startBattle(state, 'meadow', 2);
      let after = fightAndLeave(state);

      const fallen = theFallen(after);
      deaths += fallen.length;
      for (const person of fallen) {
        expect(person.alive).toBe(false);
        expect(person.health).toBe(0);
        expect(person.fate).toBeTruthy();
        expect(person.diedOn).toBeGreaterThan(0);
      }
      if (fallen.length === 0) continue;

      // Twenty days and another fight later, they are still gone. Nothing in
      // the day loop or the battle loop may quietly revive anyone.
      const names = fallen.map((p) => p.id);
      after = apply(after, { type: 'DISMISS_AFTERMATH' });
      for (let d = 0; d < 20 && !after.end; d++) passDay(after);
      for (const id of names) {
        const person = after.party.people.find((p) => p.id === id)!;
        expect(person.alive, `${person.name} came back`).toBe(false);
      }
    }
    // Difficulty 2 over sixteen fights must actually be lethal, or the whole
    // milestone is theatre.
    expect(deaths).toBeGreaterThan(0);
  });

  it('holding the field is what gets your people carried off it', () => {
    const rng = stream('fate', 'combat');
    const person = fresh('fate-a').party.people[0]!;
    let killedWinning = 0;
    let killedLosing = 0;
    let killedWithdrawing = 0;
    for (let i = 0; i < 400; i++) {
      if (rollFate(rng.derive(`w${i}`), person, 'held') === 'killed') killedWinning++;
      if (rollFate(rng.derive(`l${i}`), person, 'overrun') === 'killed') killedLosing++;
      if (rollFate(rng.derive(`b${i}`), person, 'withdrew') === 'killed') killedWithdrawing++;
    }
    expect(killedLosing).toBeGreaterThan(killedWinning);
    // Breaking off a fight you picked sits between the two: better than
    // being overrun, worse than holding the ground you fought for.
    expect(killedWithdrawing).toBeLessThan(killedLosing);
    expect(killedWithdrawing).toBeGreaterThan(killedWinning);
  });

  it('a dead warrior is written into the saga by name', () => {
    const state = fresh('saga-death');
    startBattle(state, 'meadow', 2);
    const battle = state.battle!;
    battle.outcome = 'lost';
    const victim = state.party.people[0]!;
    const combatant = battle.combatants.find((c) => c.personId === victim.id)!;
    combatant.down = true;
    // Force the killing roll: a spirit of 1 on a lost field cannot roll clear.
    victim.stats.spirit = 1;

    let killed = false;
    for (let i = 0; i < 12 && !killed; i++) {
      const trial = structuredClone(state);
      trial.day = 5 + i;
      const out = settleAftermath(trial, trial.battle!);
      if (out.killed.length > 0) {
        killed = true;
        expect(trial.saga.some((e) => e.text.includes(victim.name) && e.tone === 'grim')).toBe(true);
      }
    }
    expect(killed, 'a lost field with a downed warrior should sometimes kill').toBe(true);
  });
});

// --- Injuries ---

describe('wounds are carried', () => {
  it('an injury lowers the stat it took, and the band with it', () => {
    const state = fresh('inj-1');
    const person = state.party.people[0]!;
    const before = effectiveStat(person, 'wits');
    person.injuries.push({ id: 'x', label: 'Lost an eye', effect: { wits: -2 }, heals: 9999 });
    expect(effectiveStat(person, 'wits')).toBe(Math.max(1, before - 2));
    // The raw stat is untouched: injuries are a layer over the person, not a
    // rewrite of them, so mending restores exactly what was lost.
    expect(person.stats.wits).toBe(before);
  });

  it('lasting wounds outlive the season', () => {
    const state = fresh('inj-2');
    const person = state.party.people[0]!;
    person.injuries.push({ ...LASTING[0]!, id: 'lasting' });
    for (let d = 0; d < 60 && !state.end; d++) passDay(state);
    expect(person.alive ? person.injuries.length : 1).toBeGreaterThan(0);
  });

  it('a maimed warband fights worse than a whole one', { timeout: 60_000 }, () => {
    // Same headcount on both sides, so the fights are the same size and the
    // only difference is what our people are carrying.
    const SEEDS = Array.from({ length: 14 }, (_, i) => `maim-${i}`);
    let wholeWins = 0;
    let maimedWins = 0;
    let wholeLeft = 0;
    let maimedLeft = 0;

    for (const seed of SEEDS) {
      const whole = fresh(seed);
      const maimed = fresh(seed);
      for (const person of maimed.party.people) {
        person.injuries.push({ ...LASTING[0]!, id: `m_${person.id}` });
      }
      startBattle(whole, 'meadow', 2);
      startBattle(maimed, 'meadow', 2);
      const w = fightAndLeave(whole);
      const m = fightAndLeave(maimed);
      if (w.aftermath!.won) wholeWins++;
      if (m.aftermath!.won) maimedWins++;
      wholeLeft += living(w.party.people).length;
      maimedLeft += living(m.party.people).length;
    }

    // eslint-disable-next-line no-console
    console.log(
      `whole ${wholeWins}/${SEEDS.length} wins, ${wholeLeft} alive | ` +
        `maimed ${maimedWins}/${SEEDS.length} wins, ${maimedLeft} alive`,
    );

    expect(wholeWins).toBeGreaterThanOrEqual(maimedWins);
    expect(wholeLeft).toBeGreaterThan(maimedLeft);
  });
});

// --- The milestone's bar ---

describe('losing a veteran hurts', () => {
  /** What the band can actually attempt: its best hand at each of the four. */
  function capability(state: GameState): number {
    return STATS.reduce((sum, stat) => sum + bestStat(state.party.people, stat), 0);
  }

  it('a death costs the band reach it cannot get back', () => {
    let drops = 0;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const state = fresh(`vet-${i}`);
      const before = capability(state);

      // Kill the person the band leans on hardest — the one who is best at
      // the most things. That is the veteran the milestone is about.
      const veteran = [...state.party.people].sort(
        (a, b) =>
          STATS.filter((s) => effectiveStat(b, s) === bestStat(state.party.people, s)).length -
          STATS.filter((s) => effectiveStat(a, s) === bestStat(state.party.people, s)).length,
      )[0]!;
      veteran.alive = false;
      veteran.health = 0;

      const after = capability(state);
      expect(after).toBeLessThanOrEqual(before);
      if (after < before) drops++;
      total += before - after;
    }
    // eslint-disable-next-line no-console
    console.log(`veteran deaths that cost the band reach: ${drops}/20, ${total} stat points`);
    // Losing the band's best hand must bite in most bands, not in a lucky few.
    expect(drops).toBeGreaterThanOrEqual(15);
  });

  it('a bereaved band is lower in heart than one that came home whole', () => {
    let paired = 0;
    for (let i = 0; i < 24 && paired < 4; i++) {
      const state = fresh(`heart-${i}`);
      startBattle(state, 'meadow', 2);
      const before = state.party.morale;
      const after = fightAndLeave(state);
      if (after.aftermath!.killed.length === 0) continue;
      paired++;
      // A death drags harder than any victory lifts.
      expect(after.party.morale, `heart-${i}`).toBeLessThan(before);
    }
    expect(paired, 'no fatal fights found to measure').toBeGreaterThan(0);
  });

  /**
   * Death has to be a risk you run, not a tax you pay. A milestone that made
   * every fight fatal would be just as broken as one that made none of them
   * fatal — so the shape of the curve is pinned, not just its existence.
   */
  it('death rises with the odds against you, and good play mostly avoids it', { timeout: 120_000 }, () => {
    const N = 24;
    const measure = (difficulty: number) => {
      let fatal = 0;
      let dead = 0;
      let maimed = 0;
      for (let i = 0; i < N; i++) {
        const state = fresh(`leth-${difficulty}-${i}`);
        startBattle(state, 'meadow', difficulty);
        const after = fightAndLeave(state);
        const out = after.aftermath!;
        if (out.killed.length > 0) fatal++;
        dead += out.killed.length;
        maimed += out.maimed.length;
      }
      return { fatal, dead, maimed };
    };

    const easy = measure(-1);
    const even = measure(0);
    const hard = measure(1);
    // eslint-disable-next-line no-console
    console.log(
      `lethality per ${N} fights — easy ${easy.fatal} fatal/${easy.dead} dead/${easy.maimed} maimed | ` +
        `even ${even.fatal}/${even.dead}/${even.maimed} | hard ${hard.fatal}/${hard.dead}/${hard.maimed}`,
    );

    // Worse odds cost more lives. Without this, difficulty means nothing.
    // Measured easy-against-hard rather than step-by-step: one notch of
    // difficulty is inside the noise of a single sample this size.
    expect(hard.dead).toBeGreaterThan(easy.dead);
    expect(hard.fatal).toBeGreaterThan(easy.fatal);
    expect(even.dead).toBeGreaterThanOrEqual(easy.dead);
    // A fight you were meant to win must usually be survivable, or the run
    // cannot last the 73 days it is built around.
    expect(easy.fatal).toBeLessThan(N / 3);
    // But it must still cost something, or there is nothing to weigh.
    expect(easy.maimed + even.maimed + hard.maimed).toBeGreaterThan(0);
  });

  it('the dead are named in the run-end saga', () => {
    const state = fresh('fallen-list');
    const victim = state.party.people[1]!;
    victim.alive = false;
    victim.health = 0;
    victim.fate = 'cut down in the press';
    victim.diedOn = 9;
    expect(theFallen(state).map((p) => p.id)).toContain(victim.id);
    expect(theFallen(state).every((p) => !p.alive)).toBe(true);
  });
});

// --- Growth ---

describe('the living learn', () => {
  it('kills earn xp, and enough of it raises a stat for good', () => {
    const state = fresh('xp-1');
    const person = state.party.people[0]!;
    // Room to grow, so the advance has somewhere to land.
    for (const stat of STATS) person.stats[stat] = 3;
    const beforeTotal = STATS.reduce((n, s) => n + person.stats[s], 0);

    startBattle(state, 'meadow', 0);
    const battle = state.battle!;
    battle.outcome = 'won';
    const mine = battle.combatants.find((c) => c.personId === person.id)!;
    mine.kills = 3;
    for (const foe of battle.combatants.filter((c) => c.side === 'foe')) foe.down = true;

    settleAftermath(state, battle);
    const afterTotal = STATS.reduce((n, s) => n + person.stats[s], 0);
    expect(3 * XP_PER_KILL).toBeGreaterThanOrEqual(XP_PER_ADVANCE);
    expect(afterTotal).toBeGreaterThan(beforeTotal);
    expect(person.xp).toBeLessThan(XP_PER_ADVANCE);
  });

  it('the dead learn nothing', () => {
    const state = fresh('xp-dead');
    const person = state.party.people[0]!;
    person.alive = false;
    person.health = 0;
    const before = { ...person.stats };
    startBattle(state, 'meadow', 0);
    const battle = state.battle!;
    battle.outcome = 'won';
    const mine = battle.combatants.find((c) => c.personId === person.id);
    if (mine) mine.kills = 5;
    settleAftermath(state, battle);
    expect(person.stats).toEqual(before);
    expect(person.xp).toBe(0);
  });

  it('a stat never runs past the cap', () => {
    const state = fresh('xp-cap');
    const person = state.party.people[0]!;
    for (const stat of STATS) person.stats[stat] = 6;
    startBattle(state, 'meadow', 0);
    const battle = state.battle!;
    battle.outcome = 'won';
    const mine = battle.combatants.find((c) => c.personId === person.id)!;
    mine.kills = 20;
    settleAftermath(state, battle);
    for (const stat of STATS) expect(person.stats[stat]).toBe(6);
  });
});

// --- Loot ---

describe('what comes off the field', () => {
  function lootedFrom(outcome: 'won' | 'lost'): { food: number; firewood: number } {
    const state = fresh(`loot-${outcome}`);
    startBattle(state, 'meadow', 1);
    const battle = state.battle!;
    battle.outcome = outcome;
    for (const foe of battle.combatants.filter((c) => c.side === 'foe')) foe.down = true;
    const before = { food: state.party.food, firewood: state.party.firewood };
    settleAftermath(state, battle);
    return {
      food: state.party.food - before.food,
      firewood: state.party.firewood - before.firewood,
    };
  }

  it('a won field feeds the band', () => {
    const got = lootedFrom('won');
    expect(got.food).toBeGreaterThan(0);
    expect(got.firewood).toBeGreaterThan(0);
  });

  it('a lost field gives nothing', () => {
    expect(lootedFrom('lost')).toEqual({ food: 0, firewood: 0 });
  });

  it('a bloodless win gives nothing either', () => {
    const state = fresh('loot-clean');
    startBattle(state, 'meadow', 1);
    state.battle!.outcome = 'won';
    const before = state.party.food;
    settleAftermath(state, state.battle!);
    expect(state.party.food).toBe(before);
  });
});

// --- The reckoning card, and saves ---

describe('the reckoning holds the road', () => {
  it('leaving a fight puts a reckoning up, and nothing moves until it is read', () => {
    const state = fresh('reckon');
    startBattle(state, 'meadow', 1);
    const fought = fightAndLeave(state);
    if (fought.end) return; // the run ended on the field; the end card takes over

    expect(fought.aftermath).toBeDefined();
    // The road is blocked while it stands.
    const moved = apply(fought, { type: 'CAMP' });
    expect(moved).toBe(fought);
    const cleared = apply(fought, { type: 'DISMISS_AFTERMATH' });
    expect(cleared.aftermath).toBeUndefined();
    expect(apply(cleared, { type: 'DISMISS_AFTERMATH' })).toBe(cleared);
  });

  it('leaveBattle refuses a fight that is not settled', () => {
    const state = fresh('unsettled');
    startBattle(state, 'meadow', 0);
    expect(leaveBattle(state)).toBeUndefined();
    expect(state.battle).toBeDefined();
  });

  it('a v4 save comes forward with nothing earned and nobody credited', () => {
    const old = {
      version: 4,
      party: { people: [{ id: 'p1', name: 'Ari' }] },
      battle: { foes: [{ id: 'foe_1' }], combatants: [{ personId: 'p1' }] },
    } as Record<string, unknown>;
    const { save } = migrate(structuredClone(old));
    expect(save['version']).toBe(SAVE_VERSION);
    const party = save['party'] as { people: Person[] };
    expect(party.people[0]!.xp).toBe(0);
    const battle = save['battle'] as {
      foes: Person[];
      combatants: { kills: number }[];
    };
    expect(battle.foes[0]!.xp).toBe(0);
    expect(battle.combatants[0]!.kills).toBe(0);
  });
});

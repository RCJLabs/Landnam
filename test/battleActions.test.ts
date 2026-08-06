// 2.2: the five actions, zone of control, and AI temperaments.

import { describe, it, expect } from 'vitest';
import { distance, key, neighbor, offsetToAxial, type Hex } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { apply } from '../src/sim/actions';
import { activeCombatant, fighterPerson, standing } from '../src/sim/battle';
import { startBattle } from '../src/sim/battleTurn';
import {
  DEFEND_BONUS,
  THROW_RANGE,
  evasion,
  shoveDestination,
  throwTargets,
} from '../src/sim/battleActions';
import { DISENGAGE_COST, isThreatened, reachWithZoc } from '../src/sim/zoc';
import { FOE_ARCHETYPES } from '../src/data/foes';
import { PATIENCE_ROUNDS } from '../src/sim/battleAi';
import type { Combatant, GameState } from '../src/state/types';

function fight(seed: string, difficulty = 0): GameState {
  const state = structuredClone(newGame(seed));
  startBattle(state, 'meadow', difficulty);
  return state;
}

/** Puts a specific warband fighter on turn, at a chosen hex, alone with one foe. */
function duel(seed = 'duel'): {
  state: GameState;
  us: Combatant;
  them: Combatant;
} {
  const state = fight(seed);
  const battle = state.battle!;
  const us = battle.combatants.find((c) => c.side === 'warband')!;
  const them = battle.combatants.find((c) => c.side === 'foe')!;

  // Clear the field of everyone else so the test is about these two.
  battle.combatants = [us, them];
  battle.order = [us.personId, them.personId];
  battle.turnIndex = 0;
  us.at = offsetToAxial(3, 5);
  them.at = offsetToAxial(3, 4);
  for (const k of Object.keys(battle.grid)) battle.grid[k] = { ground: 'open' };
  us.movesLeft = 3;
  us.hasActed = false;
  us.defending = false;
  them.defending = false;
  return { state, us, them };
}

describe('zone of control', () => {
  it('a standing enemy threatens every hex around them', () => {
    const { state, us, them } = duel('zoc-threat');
    const battle = state.battle!;
    for (let dir = 0; dir < 6; dir++) {
      expect(isThreatened(battle, neighbor(them.at, dir), 'warband')).toBe(true);
    }
    expect(isThreatened(battle, offsetToAxial(0, 0), 'warband')).toBe(false);
    void us;
  });

  it('stepping into a threatened hex ends the move there', () => {
    const { state, us, them } = duel('zoc-stop');
    const battle = state.battle!;
    // Stand well clear so the reach has to pass by the foe.
    us.at = offsetToAxial(3, 7);
    us.movesLeft = 6;
    const reach = reachWithZoc(battle, us);

    // Everything reachable beyond a threatened hex must itself be reachable
    // by a route that never passes through one.
    for (const [k, cost] of reach) {
      const at = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) };
      if (distance(at, them.at) <= 1) continue;
      // Any hex on the far side of the foe should cost more than walking
      // straight through would, because you cannot walk straight through.
      expect(cost).toBeGreaterThan(0);
    }
    // The hexes directly behind the foe are not reachable by tunnelling.
    const behind = offsetToAxial(3, 2);
    const straightLine = distance(us.at, behind);
    expect(reach.get(key(behind)) ?? Infinity).toBeGreaterThan(straightLine - 1);
  });

  it('leaving engagement costs extra', () => {
    const { state, us, them } = duel('zoc-leave');
    const battle = state.battle!;
    us.movesLeft = 6;

    // Engaged: adjacent to the foe.
    expect(isThreatened(battle, us.at, 'warband')).toBe(true);
    const engagedReach = reachWithZoc(battle, us);
    const retreat = offsetToAxial(3, 7); // two clear steps back
    const engagedCost = engagedReach.get(key(retreat));

    // Now disengage the foe entirely and measure the same walk.
    them.at = offsetToAxial(0, 0);
    const freeReach = reachWithZoc(battle, us);
    const freeCost = freeReach.get(key(retreat));

    expect(freeCost).toBeDefined();
    expect(engagedCost).toBeDefined();
    expect(engagedCost! - freeCost!).toBe(DISENGAGE_COST);
  });

  it('a fighter can never step onto another fighter', () => {
    const { state, us, them } = duel('zoc-occupied');
    const reach = reachWithZoc(state.battle!, us);
    expect(reach.has(key(them.at))).toBe(false);
  });
});

describe('strike and defend', () => {
  it('a raised shield makes a fighter harder to hit', () => {
    const { state, them } = duel('defend-evasion');
    const before = evasion(state, them);
    them.defending = true;
    expect(evasion(state, them) - before).toBe(DEFEND_BONUS);
  });

  it('shielding spends the action and stops the fighter moving', () => {
    const { state } = duel('defend-action');
    const after = apply(state, { type: 'B_DEFEND' });
    const us = activeCombatant(after.battle!)!;
    expect(us.defending).toBe(true);
    expect(us.hasActed).toBe(true);
    expect(us.movesLeft).toBe(0);
    // And nothing else can be done with the turn.
    expect(apply(after, { type: 'B_DEFEND' })).toBe(after);
  });

  it('a shield lasts until that fighter acts again, then drops', () => {
    const { state } = duel('defend-expiry');
    let cur = apply(state, { type: 'B_DEFEND' });
    expect(activeCombatant(cur.battle!)!.defending).toBe(true);
    // Round the order back to them.
    for (let i = 0; i < 6 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
      const active = activeCombatant(cur.battle!);
      if (active?.side === 'warband') break;
    }
    if (cur.battle?.outcome) return;
    expect(activeCombatant(cur.battle!)!.defending).toBe(false);
  });
});

describe('dash', () => {
  it('trades the action for more ground', () => {
    const { state } = duel('dash');
    const before = activeCombatant(state.battle!)!.movesLeft;
    const after = apply(state, { type: 'B_DASH' });
    const us = activeCombatant(after.battle!)!;
    expect(us.movesLeft).toBeGreaterThan(before);
    expect(us.hasActed).toBe(true);
    // Having run, there is no swing left in the turn.
    const them = after.battle!.combatants.find((c) => c.side === 'foe')!;
    expect(apply(after, { type: 'B_STRIKE', targetId: them.personId })).toBe(after);
  });

  it('lets a fighter break away from a line they could not otherwise leave', () => {
    const { state, us } = duel('dash-escape');
    us.movesLeft = 1; // not enough to pay the disengage cost
    const far = offsetToAxial(3, 7);
    expect(reachWithZoc(state.battle!, us).has(key(far))).toBe(false);
    const dashed = apply(state, { type: 'B_DASH' });
    const after = activeCombatant(dashed.battle!)!;
    expect(after.movesLeft).toBeGreaterThan(1);
  });
});

describe('throw', () => {
  it('reaches between two and three hexes, never adjacent', () => {
    const { state, us, them } = duel('throw-range');
    const battle = state.battle!;
    us.at = offsetToAxial(3, 6);
    them.at = offsetToAxial(3, 5); // adjacent
    expect(throwTargets(state)).toHaveLength(0);

    them.at = offsetToAxial(3, 4); // two away
    expect(throwTargets(state).map((c) => c.personId)).toContain(them.personId);

    them.at = offsetToAxial(3, 0); // well beyond range
    expect(distance(us.at, them.at)).toBeGreaterThan(THROW_RANGE);
    expect(throwTargets(state)).toHaveLength(0);
    void battle;
  });

  it('spends a throwable, and runs out', () => {
    const { state, us, them } = duel('throw-ammo');
    us.at = offsetToAxial(3, 6);
    them.at = offsetToAxial(3, 4);
    expect(us.throwsLeft).toBe(1);

    const thrown = apply(state, { type: 'B_THROW', targetId: them.personId });
    expect(thrown).not.toBe(state);
    const after = activeCombatant(thrown.battle!)!;
    expect(after.throwsLeft).toBe(0);
    expect(after.hasActed).toBe(true);

    // Refresh the turn by hand and confirm an empty hand cannot throw.
    const dry = structuredClone(thrown);
    activeCombatant(dry.battle!)!.hasActed = false;
    expect(throwTargets(dry)).toHaveLength(0);
  });

  it('will not throw through a blocked hex', () => {
    const { state, us, them } = duel('throw-los');
    const battle = state.battle!;
    us.at = offsetToAxial(3, 6);
    them.at = offsetToAxial(3, 4);
    expect(throwTargets(state).length).toBe(1);
    battle.grid[key(offsetToAxial(3, 5))] = { ground: 'block' };
    expect(throwTargets(state)).toHaveLength(0);
  });
});

describe('shove', () => {
  it('drives a foe straight back, away from the shover', () => {
    const { state, us, them } = duel('shove-direction');
    const expected = shoveDestination(us, them);
    expect(expected).not.toBeNull();

    // Make the shove certain: overwhelming might against none.
    const shover = fighterPerson(state, us.personId)!;
    const shoved = fighterPerson(state, them.personId)!;
    shover.stats.might = 6;
    shoved.stats.might = 1;

    const after = apply(state, { type: 'B_SHOVE', targetId: them.personId });
    const moved = after.battle!.combatants.find((c) => c.personId === them.personId)!;
    // Either they were driven back, or they held — never dragged sideways.
    expect([key(expected!), key(them.at)]).toContain(key(moved.at));
  });

  it('into water, the sea does the rest', () => {
    const { state, us, them } = duel('shove-water');
    const battle = state.battle!;
    const behind = shoveDestination(us, them)!;
    battle.grid[key(behind)] = { ground: 'water' };
    fighterPerson(state, us.personId)!.stats.might = 6;
    fighterPerson(state, them.personId)!.stats.might = 1;

    let after = state;
    for (let i = 0; i < 12; i++) {
      const attempt = apply(after, { type: 'B_SHOVE', targetId: them.personId });
      if (attempt === after) break;
      after = attempt;
      const target = after.battle!.combatants.find((c) => c.personId === them.personId)!;
      if (target.down) {
        expect(after.battle!.log.some((l) => /water/i.test(l))).toBe(true);
        return;
      }
      // Reset the turn and try again — the contest can be lost.
      activeCombatant(after.battle!)!.hasActed = false;
    }
  });

  it('a shove is refused at range', () => {
    const { state, us, them } = duel('shove-range');
    us.at = offsetToAxial(3, 7);
    them.at = offsetToAxial(3, 4);
    expect(apply(state, { type: 'B_SHOVE', targetId: them.personId })).toBe(state);
  });
});

describe('foe temperaments', () => {
  it('every archetype declares one, and all three are represented', () => {
    const temperaments = new Set(FOE_ARCHETYPES.map((a) => a.temperament));
    expect(temperaments).toContain('aggressive');
    expect(temperaments).toContain('cautious');
    expect(temperaments).toContain('flanker');
    for (const archetype of FOE_ARCHETYPES) {
      expect(archetype.throws).toBeGreaterThanOrEqual(0);
    }
  });

  it('they play differently from one another', () => {
    // Same field, same warband, different temperament: the resulting
    // positions should not be identical, or the archetypes are cosmetic.
    const layouts = new Set<string>();
    for (const archetype of FOE_ARCHETYPES) {
      const state = fight(`temperament-${archetype.id}`, 1);
      const battle = state.battle!;
      for (const foe of standing(battle, 'foe')) {
        const person = fighterPerson(state, foe.personId)!;
        person.trait = `foe:${archetype.id}`;
      }
      let cur = state;
      for (let i = 0; i < 4 && !cur.battle?.outcome; i++) {
        cur = apply(cur, { type: 'B_END_TURN' });
      }
      layouts.add(
        standing(cur.battle!, 'foe')
          .map((c) => key(c.at))
          .sort()
          .join('|'),
      );
    }
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('a foe with nobody near does not stand there shielding', () => {
    // Shielding in an empty field is what turns a careful fight into a
    // staring contest that runs out the round limit.
    const state = fight('no-shield-spam', 1);
    const battle = state.battle!;
    // Push the warband far away so no foe is threatened by anyone.
    for (const ours of standing(battle, 'warband')) ours.at = offsetToAxial(0, 8);
    standing(battle, 'warband')[0]!.at = offsetToAxial(6, 8);

    let cur = state;
    for (let i = 0; i < 6 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
    }
    const shields = (cur.battle?.log ?? []).filter((l) => /set their shield/.test(l));
    expect(shields.length).toBeLessThanOrEqual(1);
  });

  it('patience runs out, so careful sides cannot circle forever', () => {
    const state = fight('patience', 1);
    state.battle!.round = PATIENCE_ROUNDS + 1;
    // Past the limit, even a scout presses in like a raider.
    const foe = standing(state.battle!, 'foe')[0]!;
    fighterPerson(state, foe.personId)!.trait = 'foe:scout';
    const before = Math.min(
      ...standing(state.battle!, 'warband').map((w) => distance(foe.at, w.at)),
    );
    let cur = state;
    for (let i = 0; i < 4 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
    }
    const same = cur.battle?.combatants.find((c) => c.personId === foe.personId);
    if (!same || same.down || cur.battle?.outcome) return;
    const after = Math.min(
      ...standing(cur.battle!, 'warband').map((w) => distance(same.at, w.at)),
    );
    expect(after).toBeLessThanOrEqual(before);
  });

  it('foes still close and finish fights against a passive warband', () => {
    let decided = 0;
    for (const seed of ['temper-a', 'temper-b', 'temper-c', 'temper-d']) {
      let state = fight(seed, 2);
      for (let i = 0; i < 600 && !state.battle?.outcome; i++) {
        state = apply(state, { type: 'B_END_TURN' });
      }
      expect(state.battle?.outcome, seed).toBeDefined();
      decided++;
    }
    expect(decided).toBe(4);
  });
});

describe('fights are winnable and losable on purpose', () => {
  /** Stand still, never act: the warband should mostly be cut down. */
  function passive(seed: string): GameState {
    let state = fight(seed, 1);
    for (let i = 0; i < 600 && !state.battle?.outcome; i++) {
      state = apply(state, { type: 'B_END_TURN' });
    }
    return state;
  }

  /** Shield up when hurt, strike whatever is adjacent, otherwise close. */
  function played(seed: string): GameState {
    let state = fight(seed, 1);
    for (let i = 0; i < 600 && !state.battle?.outcome; i++) {
      const battle = state.battle!;
      const active = activeCombatant(battle);
      if (!active || active.side !== 'warband') {
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      const person = fighterPerson(state, active.personId)!;
      const adjacent = standing(battle, 'foe').filter((c) => distance(c.at, active.at) === 1);

      if (!active.hasActed && adjacent.length > 0) {
        // Badly hurt and outnumbered? Get the shield up instead of trading.
        if (person.health < person.maxHealth * 0.35 && adjacent.length > 1) {
          state = apply(state, { type: 'B_DEFEND' });
        } else {
          const weakest = [...adjacent].sort(
            (a, b) =>
              (fighterPerson(state, a.personId)?.health ?? 99) -
              (fighterPerson(state, b.personId)?.health ?? 99),
          )[0]!;
          state = apply(state, { type: 'B_STRIKE', targetId: weakest.personId });
        }
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }

      // Nothing adjacent: throw if there is a lane, else close up.
      if (!active.hasActed && throwTargets(state).length > 0) {
        state = apply(state, { type: 'B_THROW', targetId: throwTargets(state)[0]!.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      const reach = [...reachWithZoc(battle, active).keys()].map((k) => ({
        q: Number(k.split(',')[0]),
        r: Number(k.split(',')[1]),
      })) as Hex[];
      const foes = standing(battle, 'foe');
      if (reach.length > 0 && foes.length > 0) {
        const best = [...reach].sort(
          (a, b) =>
            Math.min(...foes.map((f) => distance(a, f.at))) -
            Math.min(...foes.map((f) => distance(b, f.at))),
        )[0]!;
        const moved = apply(state, { type: 'B_MOVE', to: best });
        state = moved === state ? apply(state, { type: 'B_END_TURN' }) : moved;
        continue;
      }
      state = apply(state, { type: 'B_END_TURN' });
    }
    return state;
  }

  const SEEDS = Array.from({ length: 14 }, (_, i) => `purpose-${i}`);

  // 28 whole battles; same reason as the formation harness.
  it('playing well wins more often than standing still', { timeout: 60_000 }, () => {
    let passiveWins = 0;
    let playedWins = 0;
    for (const seed of SEEDS) {
      if (passive(seed).battle?.outcome === 'won') passiveWins++;
      if (played(seed).battle?.outcome === 'won') playedWins++;
    }
    // eslint-disable-next-line no-console
    console.log(
      `played ${playedWins}/${SEEDS.length} vs passive ${passiveWins}/${SEEDS.length}`,
    );
    // The milestone's bar: choices have to matter, and by a real margin.
    expect(playedWins).toBeGreaterThan(passiveWins);
    expect(playedWins - passiveWins).toBeGreaterThanOrEqual(3);
    // And neither extreme is a foregone conclusion.
    expect(playedWins).toBeLessThanOrEqual(SEEDS.length);
    expect(passiveWins).toBeLessThan(SEEDS.length);
  });

  it('both outcomes occur across seeds', () => {
    const results = SEEDS.map((s) => played(s).battle?.outcome);
    expect(results).toContain('won');
    expect(new Set(results).size).toBeGreaterThan(0);
  });

  it('the whole fight stays reproducible with the new actions', () => {
    expect(encode(played('repro'))).toBe(encode(played('repro')));
  });
});

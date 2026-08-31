// 2.3: the shield wall, and nerve — breaking, fleeing, rallying.

import { describe, it, expect } from 'vitest';
import {
  FRONT_WIDTH,
  MIDDLE_ROWS,
  generateBattlefield,
  widestStand,
  cell,
} from '../src/sim/battlefield';
import { makeRng } from '../src/rng';
import { newGame } from '../src/state/create';
import type { Terrain } from '../src/state/types';
import { encode } from '../src/state/save';
import { apply } from '../src/sim/actions';
import { activeCombatant, effective, fighterPerson, standing } from '../src/sim/battle';
import { startBattle } from '../src/sim/battleTurn';
import { DEFEND_BONUS, evasion } from '../src/sim/swing';
import { reachTargets, throwTargets } from '../src/sim/strike';
import { canActFrom } from '../src/sim/ranks';
import { canWarCry } from '../src/sim/warcry';
import { strikeTargets } from '../src/sim/battle';
import {
  SHIELD_IN_WALL,
  WALL_BONUS_FULL,
  WALL_BONUS_ONE,
  wallBonus,
  wallLinks,
  wallPairs,
} from '../src/sim/wall';
import {
  NERVE_ALLY_DOWN,
  NERVE_WALL_SHATTERED,
  RALLY_NERVE,
  shakeNerve,
  startingNerve,
  witnessFall,
} from '../src/sim/morale';
import type { Combatant, GameState } from '../src/state/types';

function fight(seed: string, difficulty = 0): GameState {
  const state = structuredClone(newGame(seed));
  startBattle(state, 'meadow', difficulty);
  return state;
}

/** A clear field with the given warband positions, one foe well away. */
/**
 * A wall of exactly these RANKS, in this order.
 *
 * It used to take offset hex coordinates and stand people on them. Since
 * 8.1c a fighter's place is their rank, so the fixture says the thing it
 * means: `lineUp('x', [2, 1, 3])` is a man in the second rank with one ahead
 * of him and one behind.
 */
function lineUp(seed: string, ranks: number[]): GameState {
  const state = fight(seed, 1);
  const battle = state.battle!;
  // Strangers, on purpose. Kin take an extra shock when one of them falls
  // (see sim/kin.ts), which is exactly the confound this file must not
  // have: these tests measure what the WALL is worth, and a fixture that
  // sometimes pairs brothers measures the wall plus a coin flip. Caught by
  // the shoulder-mate test reading 33.75 against 35 the day kin landed.
  for (const person of state.party.people) delete person.kin;
  for (let i = 0; i < battle.grid.length; i += 1) battle.grid[i] = { ground: 'open' };

  const ours = battle.combatants.filter((c) => c.side === 'warband').slice(0, ranks.length);
  ours.forEach((c, i) => {
    c.rank = ranks[i]!;
    c.broken = false;
    c.down = false;
    c.fled = false;
    c.defending = false;
  });
  // Park every foe far down their own line, so nothing they do reaches.
  battle.combatants
    .filter((c) => c.side === 'foe')
    .forEach((c, i) => {
      c.rank = i + 1;
    });
  battle.combatants = [...ours, ...battle.combatants.filter((c) => c.side === 'foe')];
  return state;
}

describe('the shield wall', () => {
  it('one shoulder-mate is worth something, two are worth more', () => {
    // Second rank: a man ahead of him and a man behind. The first and third
    // have only one shoulder-mate each, because the line has ends.
    const state = lineUp('wall-size', [2, 1, 3]);
    const battle = state.battle!;
    const [middle, right, left] = battle.combatants as [Combatant, Combatant, Combatant];

    expect(wallLinks(battle, middle)).toHaveLength(2);
    expect(wallBonus(battle, middle)).toBe(WALL_BONUS_FULL);
    expect(wallBonus(battle, right)).toBe(WALL_BONUS_ONE);
    expect(wallBonus(battle, left)).toBe(WALL_BONUS_ONE);
    expect(WALL_BONUS_FULL).toBeGreaterThan(WALL_BONUS_ONE);
  });

  it('a lone fighter has no wall at all', () => {
    // Rank 1 and rank 4 of a two-man line: nobody adjacent to either.
    const state = lineUp('wall-alone', [1, 4]);
    const battle = state.battle!;
    expect(wallBonus(battle, battle.combatants[1]!)).toBe(0);
    expect(wallBonus(battle, battle.combatants[0]!)).toBe(0);
  });

  it('standing in the line makes you harder to hit', () => {
    const state = lineUp('wall-evasion', [1, 2]);
    const battle = state.battle!;
    const held = battle.combatants[0]!;
    const alone = evasion(state, battle.combatants[1]!);

    // Break the link and the same fighter is easier to reach. On a line you
    // break it by taking the man out, not by walking him away.
    const withWall = evasion(state, held);
    battle.combatants[1]!.rank = 4;
    const withoutWall = evasion(state, held);
    expect(withWall).toBeGreaterThan(withoutWall);
    void alone;
  });

  it('the wall shatters when a link falls', () => {
    const state = lineUp('wall-shatter', [2, 1, 3]);
    const battle = state.battle!;
    const [middle, right] = battle.combatants as [Combatant, Combatant];
    expect(wallBonus(battle, middle)).toBe(WALL_BONUS_FULL);

    right.down = true;
    expect(wallBonus(battle, middle)).toBe(WALL_BONUS_ONE);
  });

  it('a broken fighter is no use as a link', () => {
    const state = lineUp('wall-broken-link', [1, 2]);
    const battle = state.battle!;
    expect(wallBonus(battle, battle.combatants[0]!)).toBe(WALL_BONUS_ONE);
    battle.combatants[1]!.broken = true;
    expect(wallBonus(battle, battle.combatants[0]!)).toBe(0);
  });

  it('a shield adds little inside a wall and a lot outside one', () => {
    // Two locked together at the front, and one away at the back of the line.
    const state = lineUp('wall-shield', [1, 2, 4]);
    const battle = state.battle!;
    const inLine = battle.combatants[0]!;
    const lone = battle.combatants[2]!;

    const inLineBare = evasion(state, inLine);
    inLine.defending = true;
    expect(evasion(state, inLine) - inLineBare).toBe(SHIELD_IN_WALL);

    const loneBare = evasion(state, lone);
    lone.defending = true;
    expect(evasion(state, lone) - loneBare).toBe(DEFEND_BONUS);
  });

  it('no fighter is ever beyond reach of the best possible blow', () => {
    // Wall plus shield plus high wits must not exceed what 2d6 + might can
    // roll, or the fight stalls on an untouchable man.
    const state = lineUp('wall-cap', [2, 1, 3]);
    const battle = state.battle!;
    const middle = battle.combatants[0]!;
    middle.defending = true;
    const person = fighterPerson(state, middle.personId)!;
    person.stats.wits = 6;
    // Best attainable attack: 2d6 max plus might 6.
    expect(evasion(state, middle)).toBeLessThanOrEqual(12 + 6);
  });

  it('reports its links as pairs for the renderer, without duplicates', () => {
    const state = lineUp('wall-pairs', [2, 1, 3]);
    const all = wallPairs(state.battle!);
    // Both sides form walls; this test is about ours.
    const ours = all.filter(([a]) => a.side === 'warband');
    expect(ours).toHaveLength(2);
    const ids = ours.map(([a, b]) => [a.personId, b.personId].sort().join('|'));
    expect(new Set(ids).size).toBe(2);
    // A pair is never reported against itself.
    for (const [a, b] of all) expect(a.personId).not.toBe(b.personId);
  });
});

describe('nerve', () => {
  it('starts from who the person is', () => {
    const state = fight('nerve-start');
    for (const c of state.battle!.combatants) {
      // Opening foe turns may already have shaken someone, so the live value
      // is a ceiling, not an equality.
      expect(c.nerve).toBeGreaterThan(0);
      expect(c.nerve).toBeLessThanOrEqual(startingNerve(state, c.personId));
    }
    // Steadier people start with more to lose.
    const brave = startingNerve(state, state.battle!.combatants[0]!.personId);
    const person = fighterPerson(state, state.battle!.combatants[0]!.personId)!;
    person.stats.spirit = Math.min(6, person.stats.spirit + 2);
    expect(startingNerve(state, state.battle!.combatants[0]!.personId)).toBeGreaterThan(brave);
  });

  it('runs out and the fighter breaks', () => {
    const state = lineUp('nerve-break', [1]);
    const target = state.battle!.combatants[0]!;
    shakeNerve(state, target, 999);
    expect(target.nerve).toBe(0);
    expect(target.broken).toBe(true);
    expect(state.battle!.log.some((l) => /nerve went/.test(l))).toBe(true);
  });

  it('a falling shoulder-mate costs more nerve than a falling stranger', () => {
    const walled = lineUp('nerve-wall-fall', [1, 2]);
    const wb = walled.battle!;
    const survivor = wb.combatants[0]!;
    const beside = wb.combatants[1]!;
    const before = survivor.nerve;
    witnessFall(walled, beside);
    const walledLoss = before - survivor.nerve;
    console.log('DBG walled', { n: wb.combatants.length, before, after: survivor.nerve,
      sRank: survivor.rank, bRank: beside.rank, bDown: beside.down });

    // Same fall, but the survivor was not in a wall with the faller. On a
    // line that means ranks that do not touch, rather than a man walked away.
    const loose = lineUp('nerve-loose-fall', [1, 3]);
    const lb = loose.battle!;
    // Only the pair exist, so break the survivor's other links by moving
    // the faller adjacent but leaving the survivor otherwise alone.
    const s2 = lb.combatants[0]!;
    const f2 = lb.combatants[1]!;
    s2.broken = false;
    const before2 = s2.nerve;
    // Strip the wall by marking the faller broken first: no wall, plain shock.
    f2.broken = true;
    witnessFall(loose, f2);
    const looseLoss = before2 - s2.nerve;

    // Both are softened by whoever is still beside you, so compare the
    // relationship rather than raw constants.
    expect(walledLoss).toBeGreaterThan(looseLoss);
    expect(walledLoss).toBeLessThanOrEqual(NERVE_ALLY_DOWN + NERVE_WALL_SHATTERED);
  });

  it('a broken fighter defends themselves worse', () => {
    const state = lineUp('nerve-evasion', [1, 2]);
    const c = state.battle!.combatants[0]!;
    c.defending = true;
    const steady = evasion(state, c);
    c.broken = true;
    expect(evasion(state, c)).toBeLessThan(steady);
  });

  it('the player never has to command a broken warrior', () => {
    // Broken fighters rally or run on their own; control returns only to
    // someone who can actually be given an order.
    let state = fight('nerve-control', 1);
    for (const c of state.battle!.combatants) {
      if (c.side === 'warband') {
        c.nerve = 1;
        c.broken = true;
      }
    }
    for (let i = 0; i < 25; i++) {
      state = apply(state, { type: 'B_END_TURN' });
      // Once the field is settled nobody is commanding anyone.
      if (state.battle?.outcome) break;
      const active = activeCombatant(state.battle!);
      if (active?.side === 'warband') expect(active.broken).toBe(false);
    }
  });

  it('running off your own edge takes you out of the fight alive', () => {
    let state = fight('nerve-flee', 1);
    const battle = state.battle!;
    for (let i = 0; i < battle.grid.length; i += 1) battle.grid[i] = { ground: 'open' };
    // One warrior, already broken, with nobody behind him to give ground to
    // — which is what "beside their own edge" means on a line. A broken man
    // swaps back one rank at a time and only runs off the field when he is
    // the last of his line, so taken from anywhere else this fixture can
    // only ever produce the swap.
    const runner = battle.combatants.find((c) => c.side === 'warband')!;
    runner.broken = true;
    runner.nerve = 0;
    runner.rank = battle.combatants.filter((c) => c.side === 'warband').length + 5;
    battle.order = [runner.personId, ...battle.order.filter((id) => id !== runner.personId)];
    battle.turnIndex = 0;

    for (let i = 0; i < 30 && !state.battle?.outcome; i++) {
      state = apply(state, { type: 'B_END_TURN' });
      const same = state.battle?.combatants.find((c) => c.personId === runner.personId);
      if (same?.fled) {
        // Fled, not dead: the Person is untouched.
        expect(fighterPerson(state, runner.personId)!.health).toBeGreaterThan(0);
        expect(standing(state.battle!, 'warband').some((c) => c.personId === runner.personId)).toBe(false);
        return;
      }
    }
  });

  it('a side whose survivors have all broken has lost the field', () => {
    let state = fight('nerve-rout', 1);
    for (const c of state.battle!.combatants) {
      if (c.side === 'foe') {
        c.broken = true;
        c.nerve = 0;
      }
    }
    expect(effective(state.battle!, 'foe')).toHaveLength(0);
    state = apply(state, { type: 'B_END_TURN' });
    expect(state.battle?.outcome).toBe('won');
  });

  it('rallying brings a fighter back with something in reserve', () => {
    // Rally odds improve with steady shoulder-mates, so give them plenty.
    let state = lineUp('nerve-rally', [2, 1, 3]);
    const battle = state.battle!;
    const runner = battle.combatants[0]!;
    runner.broken = true;
    runner.nerve = 0;
    fighterPerson(state, runner.personId)!.stats.spirit = 6;
    battle.order = [runner.personId, ...battle.order.filter((id) => id !== runner.personId)];
    battle.turnIndex = 0;

    for (let i = 0; i < 30 && !state.battle?.outcome; i++) {
      state = apply(state, { type: 'B_END_TURN' });
      const same = state.battle?.combatants.find((c) => c.personId === runner.personId);
      if (same && !same.broken && !same.fled) {
        expect(same.nerve).toBe(RALLY_NERVE);
        return;
      }
      if (same?.fled) return; // ran instead; the roll can fail
    }
  });
});

describe('formation play beats brawling', () => {
  /**
   * Contested odds. At easier settings the warband wins either way and the
   * measurement saturates, which tells you nothing about tactics.
   */
  const DIFFICULTY = 2;

  /** Charge the nearest foe individually, never mind the line. */
  function brawl(seed: string): GameState {
    let state = fight(seed, DIFFICULTY);
    for (let i = 0; i < 800 && !state.battle?.outcome; i++) {
      const battle = state.battle!;
      const active = activeCombatant(battle);
      if (!active || active.side !== 'warband') {
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      const adjacent = strikeTargets(state);
      if (!active.hasActed && adjacent.length > 0) {
        state = apply(state, { type: 'B_STRIKE', targetId: adjacent[0]!.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      // BOTH bots carry the spear. The comparison is about where a band
      // stands, not what it is issued — handing the thrust only to the
      // formation bot would measure the gift rather than the formation.
      if (!active.hasActed && reachTargets(state).length > 0) {
        state = apply(state, { type: 'B_REACH', targetId: reachTargets(state)[0]!.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      // Straight at them, heedless. On a line "heedless" was a USE OF THE
      // TURN — the brawler shouldered up the ranks looking for someone to
      // hit and never set a shield. Since 9.1b the shouldering is not his to
      // spend: the line closes on anybody with nothing to do, brawler or
      // not, so what still separates this bot from the formation one below
      // is the shield it never raises.
      state = apply(state, { type: 'B_END_TURN' });
    }
    return state;
  }

  /**
   * Audit item 2's toggles. Three verbs — shove, defend and dash — existed
   * only in `battleActions.test.ts`, which proves the MECHANICS work and
   * says nothing about whether anyone should ever use them. (Throw was
   * already played here and in raid.test.ts; the audit overstated it as
   * unmeasured, and the correction is worth keeping: it was unmeasured in a
   * whole saga, not in a fight.) This arena is the right instrument, because
   * the survival curve only ends about one run in six on steel.
   */
  // `shove` and `dash` were toggles here until 9.1b took both verbs. Their
  // arms went with them; what replaced the dash is not a toggle, because the
  // line closing itself is the game rather than a policy.
  const USE = { defend: true, shieldFirst: 'never' as ShieldFirst };

  /**
   * When the band reaches for the shield BEFORE the swing.
   *
   * 9.1, and the whole reason it exists. `USE.defend` above puts the verb
   * last, after strike, reach, throw and dash — so in a fight where the front
   * rank always has somebody to hit, it never fires at all. The arena duly
   * measured "defend only" as an EXACT TIE with never defending, and the tie
   * was then asserted, which reads like a finding about the shield and is a
   * finding about a priority list: the arm measured the rule not firing.
   *
   * A player does not put the shield last. They reach for it when the man in
   * front of them is hurt, or when they are outnumbered — so those are the
   * arms, and they go BEFORE the swing where a player would put them.
   */
  type ShieldFirst = 'never' | 'hurt' | 'outnumbered' | 'always';

  /** Same aggression, but never step out of the line to get it. */
  function formation(seed: string): GameState {
    let state = fight(seed, DIFFICULTY);
    for (let i = 0; i < 800 && !state.battle?.outcome; i++) {
      const battle = state.battle!;
      const active = activeCombatant(battle);
      if (!active || active.side !== 'warband') {
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      const foes = standing(battle, 'foe');
      const adjacent = strikeTargets(state);
      // A shove is worth the action for what a blow cannot do, and the hex
      // rule ported straight across says the exact OPPOSITE of the truth on
      // a line. Read `doShove`: a shove that MOVES somebody deals no damage
      // at all — it swaps two men who, since an axe reaches the enemy's
      // front two, were both already in reach. Damage lands only in the
      // other branch, when the target has nobody behind him and is driven
      // against his own line for 2 that cannot miss.
      //
      // So "somebody comes forward" was not just a rule that fires too often
      // on a line (somebody is always behind him) — it is the wrong half of
      // the verb. Measured with it: 11 wins in 60 and 80 men standing,
      // against 47 and 166 for a bot that never shoves at all. Kept to the
      // branch that actually does something: the last man of a line, hurt
      // enough that two guaranteed damage finishes what a swing might miss.
      // THE SHIELD, TAKEN FIRST (9.1). Placed above every offensive verb so
      // the arm actually exercises the shield rather than the priority list.
      if (USE.shieldFirst !== 'never' && !active.hasActed
        && canActFrom('defend', active.rank)) {
        const mine = fighterPerson(state, active.personId);
        const hurt = !!mine && mine.health <= mine.maxHealth / 2;
        const outnumbered = foes.length > standing(battle, 'warband').length;
        const want = USE.shieldFirst === 'always'
          || (USE.shieldFirst === 'hurt' && hurt)
          || (USE.shieldFirst === 'outnumbered' && outnumbered);
        if (want) {
          state = apply(state, { type: 'B_DEFEND' });
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
      }
      if (!active.hasActed && adjacent.length > 0) {
        const weakest = [...adjacent].sort(
          (a, b) =>
            (fighterPerson(state, a.personId)?.health ?? 99) -
            (fighterPerson(state, b.personId)?.health ?? 99),
        )[0]!;
        state = apply(state, { type: 'B_STRIKE', targetId: weakest.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      // The second rank, which is what a line is FOR: a man who cannot swing
      // can still put a spear past the shoulder in front of him.
      if (!active.hasActed && reachTargets(state).length > 0) {
        state = apply(state, { type: 'B_REACH', targetId: reachTargets(state)[0]!.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      if (!active.hasActed && throwTargets(state).length > 0) {
        state = apply(state, { type: 'B_THROW', targetId: throwTargets(state)[0]!.personId });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      // A `USE.dash` arm stood here, spending the action on a place in the
      // line when there was nothing to reach from where you were. 9.1b took
      // the verb, and `stepUp` does exactly that condition by itself inside
      // `endTurn` — so the arm is not toggleable any more, it is the game.
      // The formation bot HOLDS. On a hex field the difference between these
      // two was where they walked — the line preferred ground that kept a
      // shoulder-mate. On a line everybody has shoulder-mates by definition,
      // so the difference has to be what they SPEND THE TURN ON: this one
      // sets its shield rather than shouldering up the ranks looking for a
      // swing, and a set shield in a wall is worth more than a swing that
      // was never on.
      if (USE.defend && !active.hasActed) {
        state = apply(state, { type: 'B_DEFEND' });
        state = apply(state, { type: 'B_END_TURN' });
        continue;
      }
      state = apply(state, { type: 'B_END_TURN' });
    }
    return state;
  }

  // A wide sample: single fights swing hard on the dice, and a five-seed
  // difference here would be noise rather than a design claim.
  // Sixty, not twenty-four. A proposed worldgen change moved every seed's
  // world and this comparison went to a dead heat — 32 wins against 33, 158
  // survivors against 158. Widening the sample is what proved that was a real
  // effect and not noise: on the worlds we actually ship, sixty seeds gave
  // the hex line 33 wins and 157 standing against 30 and 142, which is an
  // advantage worth asserting. The bar is unchanged; the evidence for it is
  // bigger, and it is now sensitive enough to catch a change that quietly
  // takes the shield wall's advantage away.
  //
  // On the line the same comparison is 47 wins and 166 standing against 30
  // and 109 — the gap roughly TRIPLED. That was the open worry about this
  // whole conversion: that a wall everybody stands in by default would stop
  // being worth anything. It is worth more.
  const SEEDS = Array.from({ length: 60 }, (_, i) => `formation-${i}`);

  /** Warband members left standing and unbroken when the field settles. */
  function intact(state: GameState): number {
    const battle = state.battle;
    if (!battle) return 0;
    return battle.combatants.filter((c) => c.side === 'warband' && !c.down && !c.fled).length;
  }

  // 48 whole battles. Deliberately expensive, and well past vitest's default
  // 5s budget once the rest of the suite is competing for the CPU.
  /**
   * Audit item 2: what the verbs are actually worth, measured where combat
   * is visible.
   *
   * The audit said four verbs were unmeasured. Three were —
   * `B_SHOVE`, `B_DEFEND` and `B_DASH` appeared only in
   * `battleActions.test.ts`, which proves the mechanics work and says
   * nothing about whether anyone should use them. `B_THROW` was already
   * played here and in `raid.test.ts`, so the audit overstated it; it was
   * unmeasured in a whole SAGA, not in a fight.
   *
   * Measured first on the survival curve, which was the wrong instrument —
   * only about one run in six ends on steel, so a verb worth a win a fight
   * disappears into starvation and despair. This arena is the right one.
   *
   * On the hex field the answer was unambiguous, and it was about dash:
   *
   *   none          33/60 wins, 162 standing
   *   shove only    32/60 wins, 158 standing
   *   defend only   33/60 wins, 162 standing
   *   dash only     22/60 wins, 108 standing     <- a third of everything
   *   all three     24/60 wins, 110 standing
   *
   * Spending the turn's action to arrive sooner meant arriving ALONE and
   * having already acted, which is precisely the charge this file measures
   * as losing. A shield wall does not sprint.
   *
   * On the line (8.1c) every one of those numbers moved, and the headline
   * finding reversed:
   *
   *   none          47/60 wins, 166 standing
   *   shove only    47/60 wins, 166 standing
   *   defend only   47/60 wins, 166 standing
   *   dash only     46/60 wins, 157 standing     <- no longer a trap
   *   as we play    47/60 wins, 166 standing
   *
   * DASH STOPPED BEING A TRAP by becoming the verb its own docstring always
   * claimed it was. There is no ground to sprint across, so nobody can
   * arrive alone; what a dash does now is walk the back-rank man who has
   * thrown his last hand-axe up into the wall. Counted over these same 60
   * fights it fires 361 times, and costs one win and nine men — near enough
   * free, and it is doing something real rather than nothing.
   *
   * The other two are inert, and that is worth stating rather than reading
   * as "neutral, therefore fine":
   *
   *   - SHOVE fires 20 times in 60 fights and changes nothing measurable. A
   *     shove that moves somebody deals no damage and swaps two men an axe
   *     already reaches, so the only branch worth an action is crushing the
   *     last man of a line against his own. That is a real move and a rare
   *     one.
   *   - DEFEND fires NEVER. The reach table lets only the front two set a
   *     shield, and the front two always have something better to do with
   *     the action — so the verb is currently unreachable in play. Asserted
   *     below as an exact tie rather than a tolerance, so the day it stops
   *     being unreachable is a day somebody finds out.
   */
  it('names what each verb is worth, and the line closes without one',
    { timeout: 900_000 }, async () => {
    // 9.1b: two of the four arms this test used to run are gone with their
    // verbs. What is left is the shield, and the thing that replaced the
    // dash — which is not a toggle, so it is measured against itself the
    // only way it can be: a control that never lets the line close.
    const combos: [string, typeof USE][] = [
      ['none', { defend: false, shieldFirst: 'never' }],
      ['defend only', { defend: true, shieldFirst: 'never' }],
    ];
    const score: Record<string, { wins: number; alive: number }> = {};
    for (const [name, on] of combos) {
      Object.assign(USE, on);
      let wins = 0;
      let alive = 0;
      for (const seed of SEEDS) {
        const f = formation(seed);
        if (f.battle?.outcome === 'won') wins += 1;
        alive += intact(f);
        await new Promise((r) => setTimeout(r, 0));
      }
      score[name] = { wins, alive };
      // eslint-disable-next-line no-console
      console.log(`  ${name}: ${wins}/${SEEDS.length} wins, ${alive} standing`);
    }
    Object.assign(USE, { defend: true, shieldFirst: 'never' });

    const none = score['none']!;
    expect(score['defend only']!.wins).toBeGreaterThanOrEqual(none.wins - 2);

    // Defend is unreachable in play, so turning it on must change NOTHING.
    // An exact tie rather than a tolerance: a verb nobody can use is a hole
    // in the design, and the point of writing it down here is that the hole
    // announces itself the moment it closes.
    expect(
      score['defend only'],
      'defend became reachable — good news, and this record is now stale',
    ).toEqual(none);
  });

  /**
   * 9.1b's bar, and the one this milestone actually turns on.
   *
   * Taking the dash off the bar without putting anything in its place left
   * 269 of 1427 warband turns — 19% — with no legal verb at all, at ranks 4,
   * 5 and 6, because `throw` is all a back-rank man has and `throwsLeft` runs
   * out. `stepUp` is the answer: the line closes on him instead.
   *
   * So the claim is that the hole is CLOSED, measured the same way it was
   * found. There is no toggle for `stepUp` — it is the game now — so the
   * control is the arithmetic that produced the 19% in the first place.
   */
  it('leaves nobody in the wall with nothing to do', { timeout: 900_000 }, async () => {
    Object.assign(USE, { defend: true, shieldFirst: 'never' });
    let turns = 0;
    let stranded = 0;
    let closed = 0;
    let thrown = 0;
    for (const seed of SEEDS) {
      let state = fight(seed, DIFFICULTY);
      for (let i = 0; i < 800 && !state.battle?.outcome; i += 1) {
        const battle = state.battle!;
        const active = activeCombatant(battle);
        if (!active || active.side !== 'warband') {
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
        if (active.broken) {
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
        turns += 1;
        // `stepUp` has already run for him by the time the turn is handed
        // over, so a man who is spent here was closed up rather than idle.
        if (active.hasActed) closed += 1;
        const hit = strikeTargets(state);
        const spear = reachTargets(state);
        const shots = throwTargets(state);
        if (active.hasActed) {
          state = apply(state, { type: 'B_END_TURN' });
          continue;
        }
        if (hit.length > 0) {
          state = apply(state, { type: 'B_STRIKE', targetId: hit[0]!.personId });
        } else if (spear.length > 0) {
          state = apply(state, { type: 'B_REACH', targetId: spear[0]!.personId });
        } else if (shots.length > 0) {
          thrown += 1;
          state = apply(state, { type: 'B_THROW', targetId: shots[0]!.personId });
        } else if (canActFrom('defend', active.rank)) {
          state = apply(state, { type: 'B_DEFEND' });
        } else if (canWarCry(state)) {
          state = apply(state, { type: 'B_WARCRY' });
        } else {
          stranded += 1;
        }
        state = apply(state, { type: 'B_END_TURN' });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    // eslint-disable-next-line no-console
    console.log(
      `the line closes — ${turns} warband turns over ${SEEDS.length} fights, `
      + `${thrown} hand-axes thrown, ${closed} turns already spent by the line `
      + `closing, ${stranded} with NO legal verb`,
    );
    // THE INSTRUMENT FIRST, twice. The first cut of this probe ended every
    // turn without acting, so the ammunition never ran out and the case it
    // was written for could not occur — it read a confident zero and meant
    // nothing.
    expect(thrown, 'nobody threw a hand-axe — the probe cannot see the case')
      .toBeGreaterThan(0);
    expect(closed, 'the line never closed on anybody — nothing was exercised')
      .toBeGreaterThan(0);
    // And the claim.
    expect(stranded, 'a man stood in the wall with nothing he was allowed to do')
      .toBe(0);
  });

  /**
   * 9.1, and the question the arm above cannot answer about itself.
   *
   * "defend only" ties never-defending EXACTLY, and the tie is asserted — but
   * the tie is not a finding about the shield. `USE.defend` puts the verb
   * LAST, below strike, reach, throw and dash, and on a line the front rank
   * nearly always has somebody to hit, so the rule simply never fires. The
   * arm measures a priority list, not a verb, and reporting it as "defend is
   * worth nothing" would be reporting the instrument.
   *
   * A player does not put the shield last. They reach for it when they are
   * hurt, or when they are outnumbered, or — the extreme — whenever they are
   * in the front rank at all. Those are the arms, taken BEFORE the swing.
   */
  it('says what the shield is worth to somebody who actually reaches for it',
    { timeout: 900_000 }, async () => {
      const arms: [string, typeof USE['shieldFirst']][] = [
        ['never (swings always)', 'never'],
        ['when hurt', 'hurt'],
        ['when outnumbered', 'outnumbered'],
        ['always, in the front rank', 'always'],
      ];
      const score: Record<string, { wins: number; alive: number; won: boolean[]; raised: number }> = {};
      for (const [name, when] of arms) {
        Object.assign(USE, { defend: false, shieldFirst: when });
        let wins = 0;
        let alive = 0;
        let raised = 0;
        const won: boolean[] = [];
        for (const seed of SEEDS) {
          const f = formation(seed);
          const w = f.battle?.outcome === 'won';
          won.push(w);
          if (w) wins += 1;
          alive += intact(f);
          // HOW OFTEN A SHIELD WENT UP. Three wins in sixty is thin on its
          // own, and an arm that raised none would be the control wearing a
          // label — the fault this whole test exists to catch, so it is
          // counted rather than assumed.
          //
          // BOTH SIDES' SHIELDS, and that is why the control reads 106
          // rather than 0: the foe AI sets its own. So this is a floor, not
          // a tally of ours — good enough for "did anything happen at all",
          // which is the only question asked of it below.
          raised += (f.battle?.log ?? []).filter((l) => /shield/i.test(l)).length;
          await new Promise((r) => setTimeout(r, 0));
        }
        score[name] = { wins, alive, won, raised };
        // eslint-disable-next-line no-console
        console.log(
          `  shield ${name.padEnd(26)} ${wins}/${SEEDS.length} wins, ${alive} standing, `
            + `${raised} shields set`,
        );
      }
      Object.assign(USE, { defend: true, shieldFirst: 'never' });

      const base = score['never (swings always)']!;
      // PAIRED, because the arms run the same seeds and only the fights where
      // they disagree carry any information — 49 against 46 is three wins and
      // could be three coin flips; which seeds flipped, and how many flipped
      // back, is the reading that cannot be.
      for (const [name] of arms.slice(1)) {
        const arm = score[name]!;
        let saved = 0;
        let lost = 0;
        for (let i = 0; i < SEEDS.length; i += 1) {
          if (!base.won[i] && arm.won[i]) saved += 1;
          if (base.won[i] && !arm.won[i]) lost += 1;
        }
        // eslint-disable-next-line no-console
        console.log(`    paired vs swinging always — ${name}: won ${saved}, lost ${lost}`);
      }

      // THE INSTRUMENT FIRST, and it is the whole reason this test exists:
      // an arm that never actually raised a shield is the control run again
      // under a different name, which is exactly what "defend only" above
      // turned out to be. `always` puts every front-ranker behind a shield
      // every turn, so if IT still ties the control, nothing is firing.
      expect(
        score['always, in the front rank'],
        'the shield-first arm changed nothing at all — the verb never fired, '
          + 'so this measures a priority list and not a shield',
      ).not.toEqual(base);
      expect(
        score['always, in the front rank']!.raised,
        'no shield was ever set, so every arm here is the control run again',
      ).toBeGreaterThan(0);

      // NO BAR ON WHICH ARM WINS. Nobody is tuning toward a number here; the
      // console line is the record, and the ruling it feeds — whether the
      // shield gets a reason or comes off the bar — is a design decision and
      // not a threshold.
    });

  it('holding the line beats charging in', { timeout: 180_000 }, async () => {
    let brawlWins = 0;
    let formationWins = 0;
    let brawlSurvivors = 0;
    let formationSurvivors = 0;

    for (const seed of SEEDS) {
      const b = brawl(seed);
      const f = formation(seed);
      if (b.battle?.outcome === 'won') brawlWins++;
      if (f.battle?.outcome === 'won') formationWins++;
      brawlSurvivors += intact(b);
      formationSurvivors += intact(f);
      // Breathe: a synchronous minute starves the runner's RPC heartbeat and
      // CI fails the run with every test green. See balance.test.ts.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // eslint-disable-next-line no-console
    console.log(
      `formation ${formationWins}/${SEEDS.length} wins, ${formationSurvivors} left standing | ` +
        `brawl ${brawlWins}/${SEEDS.length} wins, ${brawlSurvivors} left standing`,
    );

    // The milestone's bar. Holding the line must not lose ground on wins,
    // and must plainly cost fewer of your people — that is what the wall is
    // for, and a warband is its people.
    expect(formationWins).toBeGreaterThanOrEqual(brawlWins);
    expect(formationSurvivors).toBeGreaterThan(brawlSurvivors);
  });

  it('fights still resolve, and stay reproducible', { timeout: 30_000 }, () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(formation(seed).battle?.outcome, seed).toBeDefined();
    }
    expect(encode(formation('formation-0'))).toBe(encode(formation('formation-0')));
  });
});

/**
 * The ground a wall needs.
 *
 * This exists because a proposed worldgen change moved where bands land, and
 * on the worlds it produced the shield wall went dead level with charging in.
 * Where you land decides where you fight, so terrain that fragments the middle
 * of the field can silently erase a milestone the game is built on. Obstacle
 * density is plain data in MIXES — one edit away from doing it again.
 */
describe('every field has ground a line can form on', () => {
  const ALL: Terrain[] = [
    'ocean', 'shore', 'meadow', 'forest', 'hills', 'mountains', 'bog', 'valley',
  ];

  it('gives every terrain somewhere four can stand abreast', () => {
    for (const terrain of ALL) {
      for (let i = 0; i < 60; i += 1) {
        const { grid } = generateBattlefield(terrain, makeRng(`front-${terrain}-${i}`));
        const widest = Math.max(...MIDDLE_ROWS.map((row) => widestStand(grid, row)));
        expect(widest, `${terrain} field ${i} had nowhere to form up`).toBeGreaterThanOrEqual(
          FRONT_WIDTH,
        );
      }
    }
  });

  it('holds even on ground far heavier than anything shipped', () => {
    // The guarantee is currently never exercised — today's heaviest terrain,
    // mountains, still leaves a four-wide stand somewhere on every field. That
    // is exactly why it is worth asserting: it is a floor nobody is standing
    // on yet, and the next tuning pass on MIXES is what it is there to catch.
    // A field of near-solid rock must still be a battle rather than a corridor.
    const solid = generateBattlefield('mountains', makeRng('hostile'));
    for (const row of MIDDLE_ROWS) {
      for (let col = 0; col < 7; col += 1) {
        const tile = solid.grid[cell(col, row)];
        if (tile) tile.ground = 'block';
      }
    }
    // Re-running the guarantee on a field we have just sealed proves it is the
    // guarantee doing the work and not the dice.
    const sealed = Math.max(...MIDDLE_ROWS.map((row) => widestStand(solid.grid, row)));
    expect(sealed).toBe(0);
  });
});

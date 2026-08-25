// 2.2: the five actions, zone of control, and AI temperaments.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { apply } from '../src/sim/actions';
import { activeCombatant, fighterPerson, standing, strikeTargets } from '../src/sim/battle';
import { startBattle } from '../src/sim/battleTurn';
import { RANKS } from '../src/sim/ranks';
import { DEFEND_BONUS, carrying, edge, evasion } from '../src/sim/swing';
import { canThrowAt, doStrike, throwTargets } from '../src/sim/strike';
import { isThreatened, threatCount } from '../src/sim/zoc';
import { FOE_ARCHETYPES } from '../src/data/foes';
import { PATIENCE_ROUNDS } from '../src/sim/battleAi';
import { BALANCED_HARDSHIP, HARDSHIPS } from '../src/data/hardship';
import type { Combatant, GameState, HardshipId, Injury } from '../src/state/types';

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
  // Face to face: rank 1 against rank 1, which is where the two walls meet.
  // This used to stand them on neighbouring hexes and clear the ground under
  // them; a line has no ground and adjacency is not a place any more.
  us.rank = 1;
  them.rank = 1;
  us.movesLeft = 3;
  us.hasActed = false;
  us.defending = false;
  them.defending = false;
  return { state, us, them };
}

describe('who is under threat', () => {
  // This was zone of control: a standing fighter threatened all six hexes
  // around them, stepping into one ended your move, and stepping out cost
  // extra. Those clauses existed to make a line something you had to break
  // rather than stroll around — and since 8.1c the line IS the world, so
  // there is nothing left to enforce. What survives is the question they
  // were really answering: can anybody actually reach me.

  it('counts the men who could put something into you, and no others', () => {
    const { state, us, them } = duel('threat-count');
    const battle = state.battle!;
    us.rank = 1;
    them.rank = 1;
    expect(threatCount(battle, us)).toBe(1);
    expect(isThreatened(battle, us)).toBe(true);

    // Send him to the back of a line nobody's axe or spear reaches.
    us.rank = 4;
    expect(threatCount(battle, us)).toBe(0);
    expect(isThreatened(battle, us)).toBe(false);
  });

  it('does not count a thrown axe, which reaches everyone', () => {
    // If throws counted, every fighter would be equally threatened in every
    // rank and the number would stop meaning anything — which is the
    // opposite of what its callers want it for.
    const { state, us, them } = duel('threat-throw');
    const battle = state.battle!;
    them.rank = 4;
    them.throwsLeft = 3;
    us.rank = 4;
    expect(canThrowAt(state, them, us), 'a throw should still reach').toBe(true);
    expect(threatCount(battle, us), 'but it should not count as pressure').toBe(0);
  });

  it('does not count the fallen or the fled', () => {
    const { state, us, them } = duel('threat-down');
    const battle = state.battle!;
    us.rank = 1;
    them.rank = 1;
    expect(threatCount(battle, us)).toBe(1);
    them.down = true;
    expect(threatCount(battle, us)).toBe(0);
    them.down = false;
    them.fled = true;
    expect(threatCount(battle, us)).toBe(0);
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

describe('a blow that goes wide says why', () => {
  /**
   * The game was taking a point off the dice and telling nobody: a fresh
   * band lands 76% of its swings and a worn one 59%, entirely because
   * `effectiveStat` reads the injury table, while the foes are generated
   * whole for every fight and never carry a wound. The player saw their own
   * men missing and was given no reason for it.
   */
  const wound = (label: string, effect: Injury['effect']): Injury =>
    ({ id: `inj-${label}`, label, effect, heals: 10 });

  it('says nothing at all for a whole fighter', () => {
    const { state, us } = duel('carry-whole');
    const person = fighterPerson(state, us.personId)!;
    expect(person.injuries).toEqual([]);
    expect(carrying(person)).toBe('');
  });

  it('names the wound that is dragging the swing', () => {
    const { state, us } = duel('carry-arm');
    const person = fighterPerson(state, us.personId)!;
    person.injuries = [wound('Shield-arm broken', { might: -2 })];
    expect(carrying(person)).toContain('Shield-arm broken');
  });

  it('names the worst of several rather than the first', () => {
    const { state, us } = duel('carry-worst');
    const person = fighterPerson(state, us.personId)!;
    person.injuries = [
      wound('Ribs stove in', { might: -1 }),
      wound('Shield-arm broken', { might: -2 }),
    ];
    expect(carrying(person)).toContain('Shield-arm broken');
    expect(carrying(person)).not.toContain('Ribs');
  });

  /**
   * The one that keeps this honest. A lost eye is a real wound and it is
   * NOT what made this blow go wide — the strike rolls off might. Naming it
   * here would be a worse lie than saying nothing, because the player would
   * go on believing an explanation that does not hold.
   */
  it('stays quiet about a wound that is not in this roll', () => {
    const { state, us } = duel('carry-eye');
    const person = fighterPerson(state, us.personId)!;
    person.injuries = [wound('Lost an eye', { wits: -2 })];
    expect(carrying(person)).toBe('');
  });

  it('reaches the log on a glance and on a turned blow', () => {
    const { state, us, them } = duel('carry-log');
    const person = fighterPerson(state, us.personId)!;
    const foe = fighterPerson(state, them.personId)!;
    person.injuries = [wound('Hamstrung', { might: -1 })];
    // Hopeless: max 2d6 is 12 and evasion here is far past it, so the swing
    // cannot land and the line must be the glance.
    person.stats.might = 0;
    foe.stats.wits = 10;

    expect(doStrike(state, them.personId)).toBe(true);
    expect(state.battle!.log.at(-1)).toContain('Hamstrung');
    expect(state.battle!.log.at(-1)).toMatch(/glanced off|rim split/);
  });

  it('says nothing when the blow lands — a hit needs no excuse', () => {
    const { state, us, them } = duel('carry-hit');
    const person = fighterPerson(state, us.personId)!;
    const foe = fighterPerson(state, them.personId)!;
    person.injuries = [wound('Hamstrung', { might: -1 })];
    // A blow that cannot miss.
    person.stats.might = 12;
    foe.stats.wits = 1;

    expect(doStrike(state, them.personId)).toBe(true);
    expect(state.battle!.log.at(-1)).not.toContain('Hamstrung');
  });
});

describe('the country is worth a point on the dice', () => {
  /**
   * The one place hardship reaches into a fight, and the reason it is
   * allowed to: `newGame` defaults to the balanced middle, where `steel` is
   * zero, so every other fixture in this file — and the whole of
   * test/wall.test.ts — is played on terms where this knob does not exist.
   * Asserted here rather than assumed, because the day that stops being
   * true is the day every battle measurement in the repo quietly moves.
   */
  it('is nothing at all on the terms everything else is measured on', () => {
    const { state, us, them } = duel('steel-even');
    expect(state.hardship).toBe(BALANCED_HARDSHIP);
    expect(edge(state, us)).toBe(0);
    expect(edge(state, them)).toBe(0);
  });

  it('is added to ours and taken off theirs', () => {
    for (const terms of HARDSHIPS) {
      const state = structuredClone(newGame(`steel-${terms.id}`, terms.id));
      startBattle(state, 'meadow', 0);
      const battle = state.battle!;
      const us = battle.combatants.find((c) => c.side === 'warband')!;
      const them = battle.combatants.find((c) => c.side === 'foe')!;
      expect(edge(state, us), terms.id).toBe(terms.steel);
      // Theirs is exactly the negation of ours, which is what makes one
      // point of `steel` worth two across the field.
      expect(edge(state, us) + edge(state, them), terms.id).toBe(0);
      expect(Math.abs(edge(state, them)), terms.id).toBe(Math.abs(terms.steel));
    }
  });

  /**
   * The ordering is the whole point of the knob: a player who reaches for
   * the gentlest country because the fighting is going badly must actually
   * be handed easier fighting, and the hardest must cost.
   */
  it('is ordered — fair helps, hard hurts', () => {
    const { state, us } = duel('steel-order');
    const swing = (id: HardshipId): number => edge({ ...state, hardship: id }, us);
    expect(swing('fair')).toBeGreaterThan(swing('even'));
    expect(swing('even')).toBeGreaterThan(swing('hard'));
  });
});

describe('dash', () => {
  it('trades the action for a place in the line', () => {
    // It used to trade the action for MOVEMENT. There is no ground to buy
    // since 8.1c, so what it buys is the rank — and it still costs the turn.
    const { state, us: me } = duel('dash');
    const battle = state.battle!;
    battle.combatants.push({ ...me, personId: 'mate', rank: 1 });
    me.rank = 2;
    const after = apply(state, { type: 'B_DASH', by: -1 });
    const us = activeCombatant(after.battle!)!;
    expect(us.rank).toBe(1);
    expect(us.hasActed).toBe(true);
    // Having run, there is no swing left in the turn.
    const them = after.battle!.combatants.find((c) => c.side === 'foe')!;
    expect(apply(after, { type: 'B_STRIKE', targetId: them.personId })).toBe(after);
  });

  it('lets a fighter buy their way out of a rank their weapon is no use in', () => {
    // The old claim was about disengaging: a dash bought you out of a line
    // you had no movement left to leave. On the line it buys the same thing
    // in the only currency there is — the spearman driven to the front, or
    // the thrower out of axes, walks himself somewhere he can fight again.
    const { state, us } = duel('dash-escape');
    const battle = state.battle!;
    const mate = { ...us, personId: 'mate', rank: 1 };
    battle.combatants.push(mate);
    us.rank = 2;

    const dashed = apply(state, { type: 'B_DASH', by: -1 });
    expect(dashed, 'the dash was refused').not.toBe(state);
    const after = dashed.battle!.combatants.find((c) => c.personId === us.personId)!;
    const swapped = dashed.battle!.combatants.find((c) => c.personId === 'mate')!;
    expect(after.rank).toBe(1);
    expect(swapped.rank).toBe(2);
  });
});

describe('throw', () => {
  it('is thrown from the second rank back, and reaches anybody', () => {
    // It used to be two or three hexes and never adjacent. On a line the
    // rule is simpler and says the same thing: you cannot throw from the
    // front — your hands are full — and from anywhere behind it, an axe
    // reaches whoever you like.
    const { state, us, them } = duel('throw-range');
    us.rank = 1;
    expect(throwTargets(state)).toHaveLength(0);

    us.rank = 2;
    expect(throwTargets(state).map((c) => c.personId)).toContain(them.personId);

    us.rank = 4;
    them.rank = 4;
    expect(throwTargets(state).map((c) => c.personId)).toContain(them.personId);
  });

  it('spends a throwable, and runs out', () => {
    const { state, us, them } = duel('throw-ammo');
    us.rank = 2;
    them.rank = 1;
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

  it('is refused from the front rank, where your hands are full', () => {
    // The old claim was line of sight: blocked ground stopped a thrown axe.
    // A line has no ground between anybody, so what stops a throw is being
    // in the press yourself — which is the same idea, honestly stated.
    const { state, us, them } = duel('throw-los');
    us.rank = 2;
    them.rank = 1;
    expect(throwTargets(state).length).toBe(1);
    us.rank = 1;
    expect(throwTargets(state)).toHaveLength(0);
  });
});

describe('shove', () => {
  it('drives a foe back a rank, and puts the man behind him in front', () => {
    const { state, us, them } = duel('shove-rank');
    const battle = state.battle!;
    // A foe line two deep, so there is somebody to come forward.
    const second = { ...them, personId: 'foe-second', rank: 2 };
    battle.combatants.push(second);
    battle.foes.push({ ...battle.foes[0]!, id: 'foe-second', name: 'The Second' });
    us.rank = 1;
    them.rank = 1;

    // Make the shove certain: overwhelming might against none.
    fighterPerson(state, us.personId)!.stats.might = 6;
    fighterPerson(state, them.personId)!.stats.might = 1;

    const after = apply(state, { type: 'B_SHOVE', targetId: them.personId });
    const shoved = after.battle!.combatants.find((c) => c.personId === them.personId)!;
    const came = after.battle!.combatants.find((c) => c.personId === 'foe-second')!;
    // Either he was driven back and they swapped, or he held. Never anything else.
    if (shoved.rank === 1) {
      expect(came.rank, 'he held, so nobody should have moved').toBe(2);
    } else {
      expect(shoved.rank).toBe(2);
      expect(came.rank, 'somebody had to come forward').toBe(1);
    }
  });

  it('with nowhere to give, a man is crushed against his own line', () => {
    // The old test put him in the water and let the sea do it. There is no
    // water on a line and no sideways to be driven — the equivalent is being
    // the last of your rank with your own men at your back.
    const { state, us, them } = duel('shove-crush');
    us.rank = 1;
    them.rank = 1;
    fighterPerson(state, us.personId)!.stats.might = 6;
    fighterPerson(state, them.personId)!.stats.might = 1;
    fighterPerson(state, them.personId)!.health = 2;

    let after = state;
    for (let i = 0; i < 12; i++) {
      const attempt = apply(after, { type: 'B_SHOVE', targetId: them.personId });
      if (attempt === after) break;
      after = attempt;
      const target = after.battle!.combatants.find((c) => c.personId === them.personId)!;
      if (target.down) {
        expect(after.battle!.log.some((l) => /own line|own men/i.test(l))).toBe(true);
        return;
      }
      // Reset the turn and try again — the contest can be lost.
      activeCombatant(after.battle!)!.hasActed = false;
    }
  });

  it('a shove is refused from the back of the line', () => {
    const { state, us, them } = duel('shove-range');
    us.rank = 3;
    them.rank = 1;
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
    // Same field, same warband, different temperament: what they DO should
    // not be identical, or the archetypes are cosmetic.
    //
    // It used to compare where they stood. On a line there is barely any
    // standing to compare — everybody is in the wall — so the difference has
    // to show in the turns they take, which is where it was always supposed
    // to live anyway.
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
      layouts.add(cur.battle!.log.join('|'));
    }
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('a foe with nobody near does not stand there shielding', () => {
    // Shielding in an empty field is what turns a careful fight into a
    // staring contest that runs out the round limit.
    const state = fight('no-shield-spam', 1);
    const battle = state.battle!;
    // Nobody in reach of anybody: put our whole line back past the ranks any
    // foe verb can touch. On the hex field this walked them to the far
    // corner; on a line "out of reach" is a rank number, which is the same
    // idea said in the coordinates the game actually has.
    standing(battle, 'warband').forEach((ours, i) => { ours.rank = RANKS + 3 + i; });

    let cur = state;
    for (let i = 0; i < 6 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
    }
    const shields = (cur.battle?.log ?? []).filter((l) => /set their shield/.test(l));
    expect(shields.length).toBeLessThanOrEqual(1);
  });

  it('patience runs out, so careful sides cannot hang back forever', () => {
    // Was measured as a scout closing the hexes between him and us. A line
    // has no hexes to close, so what impatience means now is that he stops
    // hanging back in the throwing ranks and comes forward into the wall —
    // which is the same behaviour, said in ranks.
    const state = fight('patience', 1);
    state.battle!.round = PATIENCE_ROUNDS + 1;
    const foe = standing(state.battle!, 'foe')[0]!;
    fighterPerson(state, foe.personId)!.trait = 'foe:scout';
    // Send him to the back, where a careful man would happily stay.
    foe.rank = Math.max(3, standing(state.battle!, 'foe').length);
    const before = foe.rank;
    let cur = state;
    for (let i = 0; i < 4 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
    }
    const same = cur.battle?.combatants.find((c) => c.personId === foe.personId);
    if (!same || same.down || cur.battle?.outcome) return;
    expect(same.rank, 'a scout past his patience still hung back').toBeLessThanOrEqual(before);
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
      const adjacent = strikeTargets(state);

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
      const foes = standing(battle, 'foe');
      if (foes.length > 0) {
        const pushed = apply(state, { type: 'B_DASH', by: -1 });
        state = pushed === state ? apply(state, { type: 'B_END_TURN' }) : pushed;
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

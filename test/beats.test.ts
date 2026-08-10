// Phase 7 item 3: the fight as data.
//
// A battle has always produced two things a view could read: a `log` of
// finished sentences, and a one-slot `lastBlow` hook. Both are shaped for the
// web build, and neither survives a second presentation layer — you cannot
// animate a swing from a sentence, and a single slot drops every blow but the
// newest. `src/sim/beats.ts` adds an ordered stream of structured events.
//
// Two things are tested here, and the second one is the one that matters.
// The first is that the emitter behaves: numbering rises, the list is capped,
// a consumer can drain it. The second is the lesson audit item 6 paid for —
// a stream nobody can prove is EMITTED is a stream that quietly stays empty,
// and it looks exactly like a stream that works. So the reach bar below plays
// real fights with a bot that uses every verb, and names the kinds it saw.

import { describe, it, expect } from 'vitest';
import { distance, fromKey, offsetToAxial, type Hex } from '../src/hex';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { activeCombatant, fighterPerson, standing } from '../src/sim/battle';
import { startBattle } from '../src/sim/battleTurn';
import { reachTargets, throwTargets } from '../src/sim/battleActions';
import { reachWithZoc } from '../src/sim/zoc';
import { takeBrokenTurn } from '../src/sim/morale';
import { BEATS_MAX, beat, beatsSince, type Beat, type BeatKind } from '../src/sim/beats';
import type { Battle, GameState } from '../src/state/types';

function empty(): Battle {
  return { round: 1, beats: [] } as unknown as Battle;
}

describe('the emitter', () => {
  it('numbers every beat, in order', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    beat(battle, { kind: 'dashed', who: 'b' });
    expect(battle.beats?.map((b) => b.n)).toEqual([1, 2]);
  });

  it('stamps the round it happened in', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    battle.round = 7;
    beat(battle, { kind: 'defended', who: 'a' });
    expect(battle.beats?.map((b) => b.round)).toEqual([1, 7]);
  });

  it('caps the list without ever reusing a number', () => {
    // The cap is what keeps a Battle in the save file from growing all fight.
    // It is only safe because `n` survives the trimming — a consumer holding
    // a mark can still tell what it has and has not seen.
    const battle = empty();
    for (let i = 0; i < BEATS_MAX + 50; i += 1) beat(battle, { kind: 'dashed', who: 'a' });
    expect(battle.beats).toHaveLength(BEATS_MAX);
    expect(battle.beats?.[0]?.n).toBe(51);
    expect(battle.beats?.[BEATS_MAX - 1]?.n).toBe(BEATS_MAX + 50);
  });

  it('drains for a consumer that holds nothing but a mark', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    beat(battle, { kind: 'dashed', who: 'b' });
    const first = beatsSince(battle, 0);
    expect(first.beats).toHaveLength(2);
    expect(first.mark).toBe(2);

    // Nothing has happened since: a second read is empty, not a repeat.
    expect(beatsSince(battle, first.mark).beats).toHaveLength(0);
    beat(battle, { kind: 'broke', who: 'a' });
    expect(beatsSince(battle, first.mark).beats.map((b) => b.kind)).toEqual(['broke']);
  });

  it('reads an absent list as no news, for a save written before Phase 7', () => {
    const old = { round: 1 } as unknown as Battle;
    expect(beatsSince(old, 0)).toEqual({ beats: [], mark: 0 });
  });
});

// --- Playing fights for real ---

/**
 * A bot that swings everything.
 *
 * Deliberately not a good player: it rotates through the verbs rather than
 * picking the best one, because what is being measured is whether each verb
 * can produce a beat, not whether the band wins. The rotation is driven off
 * the round so a single seed still plays a varied fight.
 */
function brawl(state: GameState, cap = 3000): GameState {
  let cur = state;
  for (let i = 0; i < cap && !cur.battle?.outcome; i += 1) {
    const battle = cur.battle!;
    const active = activeCombatant(battle);
    if (!active || active.side !== 'warband') {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }

    const foes = standing(battle, 'foe');
    if (foes.length === 0) {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const adjacent = foes.filter((c) => distance(c.at, active.at) === 1);
    const turn = battle.round + i;

    if (!active.hasActed) {
      // The leader's cry, whenever it is going: once a fight, and the only
      // way this beat is ever emitted.
      const cried = apply(cur, { type: 'B_WARCRY' });
      if (cried !== cur) {
        cur = apply(cried, { type: 'B_END_TURN' });
        continue;
      }

      const spear = reachTargets(cur);
      const shot = throwTargets(cur);
      const order: (() => GameState)[] = [];
      if (adjacent.length > 0) {
        const weakest = [...adjacent].sort(
          (a, b) =>
            (fighterPerson(cur, a.personId)?.health ?? 99) -
            (fighterPerson(cur, b.personId)?.health ?? 99),
        )[0]!;
        if (turn % 5 === 0) order.push(() => apply(cur, { type: 'B_SHOVE', targetId: weakest.personId }));
        if (turn % 7 === 0) order.push(() => apply(cur, { type: 'B_DEFEND' }));
        order.push(() => apply(cur, { type: 'B_STRIKE', targetId: weakest.personId }));
      }
      if (spear.length > 0) order.push(() => apply(cur, { type: 'B_REACH', targetId: spear[0]!.personId }));
      if (shot.length > 0) order.push(() => apply(cur, { type: 'B_THROW', targetId: shot[0]!.personId }));

      let acted = false;
      for (const step of order) {
        const next = step();
        if (next !== cur) {
          cur = apply(next, { type: 'B_END_TURN' });
          acted = true;
          break;
        }
      }
      if (acted) continue;
    }

    // Nothing to hit. Close the distance — and now and then break into a run
    // to do it, which is the only way `dashed` is ever emitted.
    if (!active.hasActed && (battle.round + i) % 4 === 0) {
      const ran = apply(cur, { type: 'B_DASH' });
      if (ran !== cur) {
        cur = ran;
        continue;
      }
    }
    const reach = [...reachWithZoc(battle, active).keys()].map((k) => fromKey(k));
    if (reach.length > 0) {
      const gap = (at: Hex) => Math.min(...foes.map((f) => distance(at, f.at)));
      const best = [...reach].sort((a, b) => gap(a) - gap(b))[0]!;
      const moved = apply(cur, { type: 'B_MOVE', to: best });
      cur = moved === cur ? apply(cur, { type: 'B_END_TURN' }) : moved;
      continue;
    }
    cur = apply(cur, { type: 'B_END_TURN' });
  }
  return cur;
}

/** Every beat kind seen across a run of fights, with how often. */
function sweep(fights: number, difficulty: number): Map<BeatKind, number> {
  const seen = new Map<BeatKind, number>();
  for (let i = 0; i < fights; i += 1) {
    const state = structuredClone(newGame(`beats-${i}`));
    startBattle(state, i % 2 === 0 ? 'meadow' : 'forest', difficulty);
    const done = brawl(state);
    for (const b of done.battle?.beats ?? []) {
      seen.set(b.kind, (seen.get(b.kind) ?? 0) + 1);
    }
  }
  return seen;
}

describe('the stream reaches the field', () => {
  // The whole reason this file exists. A beat kind that is never emitted in
  // play is indistinguishable from one that works, right up until somebody
  // builds an animation on it. Every kind gets played for.
  //
  // Thirteen of the fifteen turn up in bulk over thirty fights — counted, so
  // the bar is not standing on a coin flip: moved 929, struck 728, reached
  // 338, threw 207, fell 187, dashed 108, shoved 78, defended 33, opened /
  // warcry / ended 30 each, broke 29, leaderFell 28.
  const PLAYED: BeatKind[] = [
    'opened',
    'moved',
    'struck',
    'reached',
    'threw',
    'shoved',
    'defended',
    'dashed',
    'warcry',
    'fell',
    'leaderFell',
    'ended',
    'broke',
  ];

  it('emits every kind a fight reliably produces', () => {
    const seen = sweep(30, 2);
    const missing = PLAYED.filter((k) => !seen.has(k));
    expect(missing, `never emitted: ${missing.join(', ')}`).toEqual([]);
  });

  // The other two came in at four and ONE over the same thirty fights, and a
  // bar standing on a single event is a bar that fails on somebody else's
  // Tuesday. They are thin for a reason worth writing down rather than
  // papering over: a broken fighter has to survive long enough to roll for
  // their nerve, and `checkOutcome` ends the fight the moment a whole side
  // stops being willing — so rallying and running usually lose the race to
  // the end of the battle they belong to. Measured with a fixture instead,
  // which is stronger than a rare sample rather than weaker: the same roll
  // decides both, so walking the rounds gets both outcomes out of it.
  it('a broken fighter rallies or runs, and both are beats', () => {
    const seen = new Set<BeatKind>();
    for (let round = 1; round <= 40 && seen.size < 2; round += 1) {
      const state = structuredClone(newGame('beats-broken'));
      startBattle(state, 'meadow', 1);
      const battle = state.battle!;
      battle.round = round;
      battle.beats = [];
      const foe = battle.combatants.find((c) => c.side === 'foe' && !c.down && !c.fled);
      if (!foe) continue;
      // Standing on their own edge already, so the run is one step and the
      // only question is whether they find their nerve first.
      foe.at = offsetToAxial(3, 0);
      foe.broken = true;
      foe.nerve = 0;
      takeBrokenTurn(state, foe);
      for (const b of battle.beats) {
        if (b.kind === 'rallied' || b.kind === 'fled') seen.add(b.kind);
      }
    }
    expect([...seen].sort()).toEqual(['fled', 'rallied']);
  });

  it('opens exactly once and ends exactly once', () => {
    const state = structuredClone(newGame('beats-shape'));
    startBattle(state, 'meadow', 1);
    const done = brawl(state);
    const beats = done.battle!.beats!;
    expect(beats.filter((b) => b.kind === 'opened')).toHaveLength(1);
    expect(beats[0]!.kind).toBe('opened');
    expect(beats.filter((b) => b.kind === 'ended')).toHaveLength(1);
    expect(beats[beats.length - 1]!.kind).toBe('ended');
  });

  it('agrees with the fight it describes', () => {
    // The cheapest guard against a stream that drifts away from the sim:
    // everyone the beats say went down is down, and everyone who is down has
    // a beat saying so.
    for (let i = 0; i < 12; i += 1) {
      const state = structuredClone(newGame(`beats-agree-${i}`));
      startBattle(state, 'meadow', 2);
      const done = brawl(state);
      const battle = done.battle!;
      const felled = new Set(
        battle.beats!.filter((b): b is Extract<Beat, { kind: 'fell' }> => b.kind === 'fell')
          .map((b) => b.who),
      );
      const down = new Set(battle.combatants.filter((c) => c.down).map((c) => c.personId));
      expect([...felled].sort()).toEqual([...down].sort());
    }
  });

  it('says where a step began as well as where it ended', () => {
    // The field a diff cannot recover, and the reason `moved` exists at all:
    // by the time a renderer sees the new state, the old hex is gone.
    const state = structuredClone(newGame('beats-move'));
    startBattle(state, 'meadow', 1);
    const done = brawl(state);
    const moves = done.battle!.beats!.filter(
      (b): b is Extract<Beat, { kind: 'moved' }> => b.kind === 'moved',
    );
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(distance(m.from, m.to)).toBeGreaterThan(0);
    }
  });

  it('survives the round trip through a save', () => {
    const state = structuredClone(newGame('beats-save'));
    startBattle(state, 'meadow', 1);
    const before = state.battle!.beats!.length;
    const back = JSON.parse(JSON.stringify(state)) as GameState;
    expect(back.battle!.beats).toHaveLength(before);
    expect(back.battle!.beats![0]!.kind).toBe('opened');
  });
});

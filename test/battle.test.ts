import { describe, it, expect } from 'vitest';
import { distance, key, offsetToAxial, type Hex } from '../src/hex';
import { makeRng } from '../src/rng';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { apply, type Action } from '../src/sim/actions';
import {
  activeCombatant,
  beginBattle,
  combatantAt,
  fighterPerson,
  isWarbandTurn,
  reachableHexes,
  standing,
  strikeTargets,
} from '../src/sim/battle';
import { ROUND_LIMIT, startBattle } from '../src/sim/battleTurn';
import {
  generateBattlefield,
  isPassable,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MIDDLE_ROWS,
} from '../src/sim/battlefield';
import { currentMode } from '../src/modes';
import { eventById } from '../src/data/events';
import { presentEvent } from '../src/sim/events';
import type { GameState, Terrain } from '../src/state/types';

const FIGHT_TERRAINS: Terrain[] = ['shore', 'meadow', 'forest', 'hills', 'mountains', 'bog', 'valley'];

function battleState(seed = 'fight', terrain: Terrain = 'meadow', difficulty = 0): GameState {
  const state = structuredClone(newGame(seed));
  beginBattle(state, terrain, difficulty);
  return state;
}

/** Plays a battle to its end with a simple policy, returning the final state. */
function fightItOut(start: GameState, limit = 400): GameState {
  let state = start;
  for (let i = 0; i < limit && !state.battle?.outcome; i++) {
    if (!isWarbandTurn(state)) {
      state = apply(state, { type: 'B_END_TURN' });
      continue;
    }
    const targets = strikeTargets(state);
    if (targets.length > 0) {
      state = apply(state, { type: 'B_STRIKE', targetId: targets[0]!.personId });
      state = apply(state, { type: 'B_END_TURN' });
      continue;
    }
    // Close on the nearest foe.
    const battle = state.battle!;
    const active = activeCombatant(battle)!;
    const foes = standing(battle, 'foe');
    if (foes.length === 0) break;
    const options = reachableHexes(battle);
    if (options.length > 0) {
      const best = [...options].sort(
        (a, b) =>
          Math.min(...foes.map((f) => distance(a, f.at))) -
          Math.min(...foes.map((f) => distance(b, f.at))),
      )[0]!;
      const moved = apply(state, { type: 'B_MOVE', to: best });
      state = moved === state ? apply(state, { type: 'B_END_TURN' }) : moved;
      if (moved !== state) continue;
    } else {
      state = apply(state, { type: 'B_END_TURN' });
    }
    void active;
  }
  return state;
}

describe('battlefield generation', () => {
  it.each(FIGHT_TERRAINS.map((t) => [t]))('%s produces a usable field', (terrain) => {
    const { grid, warbandSpots, foeSpots } = generateBattlefield(terrain, makeRng(`bf-${terrain}`));
    expect(Object.keys(grid)).toHaveLength(FIELD_WIDTH * FIELD_HEIGHT);
    expect(warbandSpots.length).toBeGreaterThanOrEqual(FIELD_HEIGHT);
    expect(foeSpots.length).toBeGreaterThanOrEqual(FIELD_HEIGHT);

    // Deployment ground is always clear, so nobody starts entombed.
    for (const spot of [...warbandSpots, ...foeSpots]) {
      expect(isPassable(grid[key(spot)]!.ground)).toBe(true);
    }
  });

  it('is deterministic for a given rng seed', () => {
    const a = generateBattlefield('forest', makeRng('same'));
    const b = generateBattlefield('forest', makeRng('same'));
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  });

  it('always leaves a way across the middle', () => {
    // The crossability guarantee is what stops an unwinnable stalemate.
    for (let i = 0; i < 60; i++) {
      const { grid } = generateBattlefield('mountains', makeRng(`cross-${i}`));
      const anyColumnClear = Array.from({ length: FIELD_WIDTH }, (_, col) =>
        MIDDLE_ROWS.every((row) => isPassable(grid[key(offsetToAxial(col, row))]!.ground)),
      ).some(Boolean);
      expect(anyColumnClear, `seed cross-${i}`).toBe(true);
    }
  });

  it('is laid out portrait, so a hex clears a thumb on a phone', () => {
    // 390px wide over 7 columns leaves ~48 CSS px per hex; nine would not
    // reach the 44px floor the project holds itself to.
    expect(FIELD_WIDTH).toBeLessThanOrEqual(7);
    expect(FIELD_HEIGHT).toBeGreaterThan(FIELD_WIDTH);
  });
});

describe('starting a battle', () => {
  it('pushes BATTLE over travel and deploys both sides', () => {
    const state = battleState('deploy');
    expect(currentMode(state)).toBe('BATTLE');
    expect(state.modes).toEqual(['TRAVEL', 'BATTLE']);
    expect(state.battle).toBeDefined();
    expect(standing(state.battle!, 'warband').length).toBeGreaterThan(0);
    expect(standing(state.battle!, 'foe').length).toBeGreaterThan(0);
  });

  it('gives every fighter a distinct hex on passable ground', () => {
    const state = battleState('placement', 'forest');
    const battle = state.battle!;
    const seen = new Set<string>();
    for (const combatant of battle.combatants) {
      const k = key(combatant.at);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(isPassable(battle.grid[k]!.ground)).toBe(true);
    }
  });

  it('reuses Person for foes rather than duplicating stats', () => {
    const state = battleState('model');
    for (const combatant of state.battle!.combatants) {
      const person = fighterPerson(state, combatant.personId);
      expect(person, combatant.personId).toBeDefined();
      expect(person!.stats.might).toBeGreaterThanOrEqual(1);
      expect(person!.maxHealth).toBeGreaterThan(0);
    }
    // The Combatant itself carries no stats — position and turn state only.
    const sample = state.battle!.combatants[0]! as unknown as Record<string, unknown>;
    expect(sample['stats']).toBeUndefined();
    expect(sample['health']).toBeUndefined();
    expect(sample['name']).toBeUndefined();
  });

  it('orders turns by initiative, highest first', () => {
    const state = battleState('initiative');
    const battle = state.battle!;
    expect(battle.order).toHaveLength(battle.combatants.length);
    const scores = battle.order.map(
      (id) => battle.combatants.find((c) => c.personId === id)!.initiative,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
    }
  });

  it('is deterministic for a given run seed and day', () => {
    expect(encode(battleState('twin-fight'))).toBe(encode(battleState('twin-fight')));
  });
});

describe('turns', () => {
  it('reachable ground is never occupied or impassable', () => {
    // True of every fighter on every turn, whether or not they can move:
    // a hemmed-in warrior legitimately has nowhere to go.
    let cur = battleState('reachable');
    for (let round = 0; round < 20 && !cur.battle?.outcome; round++) {
      const options = reachableHexes(cur.battle!);
      for (const option of options) {
        expect(combatantAt(cur.battle!, option)).toBeUndefined();
        expect(isPassable(cur.battle!.grid[key(option)]!.ground)).toBe(true);
      }
      cur = apply(cur, { type: 'B_END_TURN' });
    }
  });

  it('every fighter opens the fight with somewhere to go', () => {
    // Deployment must leave elbow room. A warrior boxed in by their own
    // shield-mates on turn one has no legal move and nothing to do.
    for (let i = 0; i < 25; i++) {
      const state = battleState(`elbow-${i}`, 'meadow', 1);
      const battle = state.battle!;
      for (const combatant of battle.combatants) {
        battle.turnIndex = battle.order.indexOf(combatant.personId);
        combatant.movesLeft = 3;
        expect(
          reachableHexes(battle).length,
          `elbow-${i}: ${combatant.personId} is walled in`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('someone can always make a move when the fight opens', () => {
    // If nobody could move at all, the battle would be unplayable.
    for (const seed of ['open-a', 'open-b', 'open-c']) {
      const state = battleState(seed, 'mountains');
      const battle = state.battle!;
      const anyoneCanMove = battle.combatants.some((c) => {
        battle.turnIndex = battle.order.indexOf(c.personId);
        c.movesLeft = 3;
        return reachableHexes(battle).length > 0;
      });
      expect(anyoneCanMove, seed).toBe(true);
    }
  });

  it('moving spends movement and puts the fighter where asked', () => {
    let cur = battleState('moving');
    // Find a warband turn where the active fighter actually has somewhere to go.
    let options: Hex[] = [];
    for (let i = 0; i < 20; i++) {
      if (isWarbandTurn(cur)) {
        options = reachableHexes(cur.battle!);
        if (options.length > 0) break;
      }
      cur = apply(cur, { type: 'B_END_TURN' });
      if (cur.battle?.outcome) return;
    }
    if (options.length === 0) return;

    const before = activeCombatant(cur.battle!)!.movesLeft;
    const next = apply(cur, { type: 'B_MOVE', to: options[0]! });
    expect(next).not.toBe(cur);
    const after = activeCombatant(next.battle!)!;
    expect(after.at).toEqual(options[0]);
    expect(after.movesLeft).toBeLessThan(before);
  });

  it('rejects moving out of reach', () => {
    let cur = battleState('reach');
    for (let i = 0; i < 12 && !isWarbandTurn(cur); i++) cur = apply(cur, { type: 'B_END_TURN' });
    if (!isWarbandTurn(cur)) return;
    const far: Hex = { q: 40, r: 40 };
    expect(apply(cur, { type: 'B_MOVE', to: far })).toBe(cur);
  });

  it('allows only one strike per turn', () => {
    // Build a guaranteed adjacency rather than hoping the deployment gives one.
    const state = battleState('one-strike');
    const battle = state.battle!;
    const attacker = battle.combatants.find((c) => c.side === 'warband')!;
    const target = battle.combatants.find((c) => c.side === 'foe')!;
    battle.order = [attacker.personId, target.personId];
    battle.turnIndex = 0;
    target.at = { q: attacker.at.q + 1, r: attacker.at.r };
    battle.grid[key(target.at)] = { ground: 'open' };

    expect(strikeTargets(state)).toHaveLength(1);
    const first = apply(state, { type: 'B_STRIKE', targetId: target.personId });
    expect(first).not.toBe(state);
    expect(activeCombatant(first.battle!)!.hasActed).toBe(true);
    // A second blow in the same turn is refused.
    expect(apply(first, { type: 'B_STRIKE', targetId: target.personId })).toBe(first);
  });

  it('refuses strikes on anything not adjacent', () => {
    const state = battleState('reach-strike');
    const battle = state.battle!;
    const attacker = battle.combatants.find((c) => c.side === 'warband')!;
    const target = battle.combatants.find((c) => c.side === 'foe')!;
    battle.order = [attacker.personId];
    battle.turnIndex = 0;
    target.at = { q: attacker.at.q + 5, r: attacker.at.r };
    expect(apply(state, { type: 'B_STRIKE', targetId: target.personId })).toBe(state);
  });

  it('a fight is always playable the moment it opens', () => {
    // A foe can win initiative. If the field appeared on their turn the
    // player would have no legal action and no way to advance — stranded.
    for (let i = 0; i < 40; i++) {
      const state = structuredClone(newGame(`opening-${i}`));
      startBattle(state, 'meadow', 1);
      if (state.battle!.outcome) continue;
      expect(isWarbandTurn(state), `opening-${i}`).toBe(true);
      expect(activeCombatant(state.battle!)!.side).toBe('warband');
    }
  });

  it('hands control back only on a warband turn', () => {
    let cur = battleState('control');
    for (let i = 0; i < 30 && !cur.battle?.outcome; i++) {
      // After any end-turn, either the fight is over or it is ours again.
      cur = apply(cur, { type: 'B_END_TURN' });
      if (cur.battle?.outcome) break;
      expect(isWarbandTurn(cur)).toBe(true);
    }
  });
});

describe('the round trip', () => {
  it.each(['rt-a', 'rt-b', 'rt-c', 'rt-d', 'rt-e'].map((s) => [s]))(
    '%s: a full battle resolves and returns to travel',
    (seed) => {
      const start = battleState(seed, 'meadow');
      const fought = fightItOut(start);

      expect(fought.battle?.outcome, 'battle should reach an outcome').toBeDefined();
      expect(['won', 'lost']).toContain(fought.battle!.outcome);

      const returned = apply(fought, { type: 'B_LEAVE' });
      expect(currentMode(returned)).toBe('TRAVEL');
      expect(returned.modes).toEqual(['TRAVEL']);
      expect(returned.battle).toBeUndefined();
      // Everyone is settled one way or the other: on their feet, or dead with
      // a cause and a date on it. Nobody is left at zero health and alive.
      for (const person of returned.party.people) {
        if (person.alive) {
          expect(person.health, `${person.name} alive at zero`).toBeGreaterThan(0);
        } else {
          expect(person.health).toBe(0);
          expect(person.fate).toBeTruthy();
          expect(person.diedOn).toBe(returned.day);
        }
      }
      // The fight is written into the saga either way.
      expect(returned.saga.length).toBeGreaterThan(start.saga.length);
    },
  );

  it('a clean win lifts heart, a loss always costs it', () => {
    for (const seed of ['mood-a', 'mood-b', 'mood-c', 'mood-d']) {
      const start = battleState(seed);
      const before = start.party.morale;
      const fought = fightItOut(start);
      if (!fought.battle?.outcome) continue;
      const won = fought.battle.outcome === 'won';
      const left = apply(fought, { type: 'B_LEAVE' });
      const after = left.party.morale;
      // A win only lifts the band if it did not cost anyone. Since 2.4 a
      // victory paid for with a death is allowed to leave them worse off.
      if (won && left.aftermath!.killed.length === 0) {
        expect(after, `${seed} clean win`).toBeGreaterThanOrEqual(before);
      } else if (!won) {
        expect(after, `${seed} loss`).toBeLessThanOrEqual(before);
      }
    }
  });

  it('travel actions are refused while a fight is on', () => {
    const state = battleState('blocked');
    const travelActions: Action[] = [
      { type: 'CAMP' },
      { type: 'FORAGE' },
      { type: 'MOVE', to: state.party.at },
      { type: 'DISMISS_EVENT' },
    ];
    for (const action of travelActions) {
      expect(apply(state, action), action.type).toBe(state);
    }
  });

  it('leaving early is refused until the field is settled', () => {
    const state = battleState('early-leave');
    expect(apply(state, { type: 'B_LEAVE' })).toBe(state);
  });

  it('the whole fight is reproducible from the seed', () => {
    const a = fightItOut(battleState('replay-fight'));
    const b = fightItOut(battleState('replay-fight'));
    expect(encode(a)).toBe(encode(b));
  });
});

describe('reaching a battle through play', () => {
  it('a combat choice draws steel only once the card is dismissed', () => {
    const state = structuredClone(newGame('to-arms'));
    const def = eventById('landing-party')!;
    state.event = presentEvent(state, def);

    const fightIndex = def.choices.findIndex((c) =>
      c.success.effects.some((e) => e.t === 'battle'),
    );
    expect(fightIndex).toBeGreaterThanOrEqual(0);

    // Choosing resolves the card but must NOT drop us onto the field yet —
    // the player has to read what happened first.
    const chosen = apply(state, { type: 'CHOOSE', index: fightIndex });
    expect(chosen.event?.outcome).toBeDefined();
    expect(currentMode(chosen)).toBe('TRAVEL');
    expect(chosen.battle).toBeUndefined();

    const fighting = apply(chosen, { type: 'DISMISS_EVENT' });
    expect(currentMode(fighting)).toBe('BATTLE');
    expect(fighting.battle).toBeDefined();
    expect(fighting.event).toBeUndefined();
    expect(standing(fighting.battle!, 'foe').length).toBeGreaterThan(0);

    // And it round-trips home.
    const done = fightItOut(fighting);
    expect(done.battle?.outcome).toBeDefined();
    const home = apply(done, { type: 'B_LEAVE' });
    expect(currentMode(home)).toBe('TRAVEL');
    expect(home.battle).toBeUndefined();
  });

  it('the battlefield ground matches the hex the party stood on', () => {
    const state = structuredClone(newGame('ground-match'));
    const terrain = state.world.tiles[key(state.party.at)]!.terrain;
    state.event = presentEvent(state, eventById('landing-party')!);
    const fighting = apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' });
    expect(fighting.battle!.terrain).toBe(terrain);
  });

  it('a queued fight never leaves a stale flag behind', () => {
    const state = structuredClone(newGame('no-stale'));
    state.event = presentEvent(state, eventById('landing-party')!);
    const fighting = apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' });
    expect(fighting.flags['pendingBattle']).toBeUndefined();
    const home = apply(fightItOut(fighting), { type: 'B_LEAVE' });
    expect(home.flags['pendingBattle']).toBeUndefined();
  });
});

describe('termination', () => {
  it('a battle always ends, even if nobody does anything useful', () => {
    // The backstop exists so BATTLE can never trap the player on the field.
    for (const seed of ['stall-a', 'stall-b', 'stall-c']) {
      let state = battleState(seed, 'mountains', 2);
      for (let i = 0; i < 2000 && !state.battle?.outcome; i++) {
        state = apply(state, { type: 'B_END_TURN' });
      }
      expect(state.battle?.outcome, seed).toBeDefined();
      expect(state.battle!.round).toBeLessThanOrEqual(ROUND_LIMIT + 2);
    }
  });
});

describe('foes fight back', () => {
  it('a passive warband can actually lose', () => {
    // Never strike, never move: the foes must be able to finish it.
    let lost = 0;
    for (const seed of ['passive-a', 'passive-b', 'passive-c', 'passive-d']) {
      let state = battleState(seed, 'meadow', 2);
      for (let i = 0; i < 400 && !state.battle?.outcome; i++) {
        state = apply(state, { type: 'B_END_TURN' });
      }
      expect(state.battle?.outcome, seed).toBeDefined();
      if (state.battle!.outcome === 'lost') lost++;
    }
    expect(lost, 'standing still should sometimes get you killed').toBeGreaterThan(0);
  });

  it('foes close the distance rather than idling', () => {
    const state = battleState('approach', 'meadow');
    const battle = state.battle!;
    const foe = standing(battle, 'foe')[0]!;
    const startGap = Math.min(
      ...standing(battle, 'warband').map((w) => distance(foe.at, w.at)),
    );
    let cur = state;
    for (let i = 0; i < 6 && !cur.battle?.outcome; i++) {
      cur = apply(cur, { type: 'B_END_TURN' });
    }
    if (cur.battle?.outcome) return;
    const sameFoe = cur.battle!.combatants.find((c) => c.personId === foe.personId);
    if (!sameFoe || sameFoe.down) return;
    const endGap = Math.min(
      ...standing(cur.battle!, 'warband').map((w) => distance(sameFoe.at, w.at)),
    );
    expect(endGap).toBeLessThanOrEqual(startGap);
  });
});

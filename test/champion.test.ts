// Named raid leaders. Every raid is led; the open field earns a name once
// word has spread; and when the man with the pennant falls — theirs OR ours —
// the heart goes out of the whole side he led.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { startBattle, startRaid } from '../src/sim/battleTurn';
import {
  anointChampion,
  rollFoes,
  CHAMPION_TOUGHNESS,
  SCAR_MAX,
  SCAR_TOUGHNESS,
} from '../src/sim/battle';
import { leaveBattle } from '../src/sim/battleTurn';
import { seeNeighbours } from '../src/sim/neighbours';
import { CHAMPION_BYNAMES } from '../src/data/foes';
import { doStrike } from '../src/sim/battleActions';
import { NERVE_LEADER_FELL, fellLeading } from '../src/sim/morale';
import { leaderOf } from '../src/sim/people';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { fromKey, offsetToAxial } from '../src/hex';
import { stream } from '../src/rng';
import type { Combatant, GameState } from '../src/state/types';

/** A settled steading a raid can actually be rolled against. */
function settled(seed: string): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > bestScore) {
      bestScore = report.total;
      best = at;
    }
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.day = 30;
  return state;
}

describe('who leads them', () => {
  it('anointing raises the toughest and trades up his byname', () => {
    const foes = rollFoes(stream('champ-roll', 'combat'), 6, 2, true);
    expect(foes.length).toBeGreaterThanOrEqual(2);
    const toughest = foes.reduce((a, b) => (b.maxHealth > a.maxHealth ? b : a));
    const before = {
      might: toughest.stats.might,
      spirit: toughest.stats.spirit,
      maxHealth: toughest.maxHealth,
    };

    const champion = anointChampion(foes, stream('champ-anoint', 'combat'));
    expect(champion.id).toBe(toughest.id);
    expect(CHAMPION_BYNAMES).toContain(champion.byname);
    expect(champion.stats.might).toBe(Math.min(6, before.might + 1));
    expect(champion.stats.spirit).toBe(Math.min(6, before.spirit + 1));
    expect(champion.maxHealth).toBe(before.maxHealth + CHAMPION_TOUGHNESS);
    expect(champion.health).toBe(champion.maxHealth);
  });

  it('every raid worth the name is led, and the log says by whom', () => {
    const state = settled('champ-raid');
    startRaid(state, 2);
    const battle = state.battle!;
    expect(battle.champion).toBeTruthy();
    const champ = battle.foes.find((f) => f.id === battle.champion)!;
    expect(battle.log[0]).toContain(`${champ.name} ${champ.byname} led them.`);
  });

  it('the open field is nameless until word has spread', () => {
    const quiet = structuredClone(newGame('champ-quiet'));
    startBattle(quiet, 'meadow', 1);
    expect(quiet.battle!.champion).toBeUndefined();

    const famed = structuredClone(newGame('champ-famed'));
    famed.tally.sackings = 8; // word 4, bump 2: the coast talks
    startBattle(famed, 'meadow', 1);
    const battle = famed.battle!;
    expect(battle.champion).toBeTruthy();
    const champ = battle.foes.find((f) => f.id === battle.champion)!;
    expect(battle.log[0]).toContain(`${champ.name} ${champ.byname} had come to see for himself.`);
  });
});

describe('the fall of the one who led', () => {
  /** A field arranged so `attacker` cannot miss `target`, others far off. */
  function duel(seed: string, attackerSide: 'warband' | 'foe'): {
    state: GameState;
    attacker: Combatant;
    target: Combatant;
  } {
    const state = structuredClone(newGame(seed));
    startBattle(state, 'meadow', 2);
    const battle = state.battle!;
    for (const k of Object.keys(battle.grid)) battle.grid[k] = { ground: 'open' };

    const ours = battle.combatants.filter((c) => c.side === 'warband');
    const foes = battle.combatants.filter((c) => c.side === 'foe');
    const attacker = (attackerSide === 'warband' ? ours : foes)[0]!;
    const target = (attackerSide === 'warband' ? foes : ours)[0]!;
    attacker.at = offsetToAxial(3, 5);
    target.at = offsetToAxial(4, 5);
    // Everyone else parked far away AND spread out — adjacency would make
    // them wall links, and links soften the shake this test measures. Each
    // side gets its own rows, four to a row, every hex two apart.
    const parkRows: Record<'warband' | 'foe', number[]> = { warband: [0, 2], foe: [8, 6] };
    const parked: Record<'warband' | 'foe', number> = { warband: 0, foe: 0 };
    [...ours, ...foes]
      .filter((c) => c !== attacker && c !== target)
      .forEach((c) => {
        const n = parked[c.side]++;
        c.at = offsetToAxial((n % 4) * 2, parkRows[c.side][Math.floor(n / 4)]!);
        c.broken = false;
      });

    battle.order = [attacker.personId];
    battle.turnIndex = 0;
    attacker.hasActed = false;
    attacker.broken = false;

    // A blow that cannot miss and cannot fail to kill.
    const swing = state.party.people.find((p) => p.id === attacker.personId)
      ?? battle.foes.find((p) => p.id === attacker.personId)!;
    swing.stats.might = 6;
    const struck = state.party.people.find((p) => p.id === target.personId)
      ?? battle.foes.find((p) => p.id === target.personId)!;
    struck.stats.wits = 1;
    struck.health = 1;
    return { state, attacker, target };
  }

  it('dropping their champion shakes every man he led', () => {
    const { state, target } = duel('champ-fall', 'warband');
    const battle = state.battle!;
    battle.champion = target.personId;
    expect(fellLeading(state, target)).toBe(true);

    const others = battle.combatants.filter(
      (c) => c.side === 'foe' && c.personId !== target.personId,
    );
    const before = others.map((c) => c.nerve);

    expect(doStrike(state, target.personId)).toBe(true);
    expect(target.down).toBe(true);
    others.forEach((c, i) => {
      expect(c.broken || c.nerve <= before[i]! - NERVE_LEADER_FELL).toBe(true);
    });
    expect(battle.log.some((l) => l.includes('heart went out'))).toBe(true);
  });

  it('our leader falling shakes us just the same — the pennant cuts both ways', () => {
    const { state, target } = duel('champ-ours', 'foe');
    const battle = state.battle!;
    // The duel puts our first fighter in the target spot; the first living
    // sworn IS the leader, so this is the leader taking the blow.
    expect(leaderOf(state.party.people)!.id).toBe(target.personId);

    const others = battle.combatants.filter(
      (c) => c.side === 'warband' && c.personId !== target.personId,
    );
    const before = others.map((c) => c.nerve);

    expect(doStrike(state, target.personId)).toBe(true);
    others.forEach((c, i) => {
      expect(c.broken || c.nerve <= before[i]! - NERVE_LEADER_FELL).toBe(true);
    });
  });

  it('a fight nobody leads takes no such shock', () => {
    const { state, target } = duel('champ-noone', 'warband');
    const battle = state.battle!;
    battle.champion = undefined;
    expect(fellLeading(state, target)).toBe(false);
  });
});

describe('the man who comes back', () => {
  /** A steading with one thoroughly hostile neighbour to send the raid. */
  function besieged(seed: string): GameState {
    const state = settled(seed);
    seeNeighbours(state);
    expect(state.neighbours.length).toBeGreaterThan(0);
    state.neighbours.forEach((n, i) => {
      n.found = true;
      n.standing = i === 0 ? -80 : 20;
    });
    return state;
  }

  it('a raid leader belongs to whoever sent it', () => {
    const state = besieged('champ-belongs');
    startRaid(state, 2);
    const battle = state.battle!;
    expect(battle.champion).toBeTruthy();
    expect(battle.championOf).toBe(state.neighbours[0]!.id);
    // Remembered from the moment he sets foot on the field, so a mid-fight
    // save still knows whose man he is.
    const kept = state.neighbours[0]!.champion!;
    const person = battle.foes.find((f) => f.id === battle.champion)!;
    expect(kept.name).toBe(person.name);
    expect(kept.byname).toBe(person.byname);
    expect(kept.scars).toBe(0);
  });

  it('walking off the field alive earns him a scar and a saga line', () => {
    const state = besieged('champ-escapes');
    startRaid(state, 2);
    const battle = state.battle!;
    const clan = state.neighbours[0]!;
    // Won the field, but their man was not among the fallen.
    battle.outcome = 'won';
    battle.combatants.find((c) => c.personId === battle.champion)!.down = false;

    leaveBattle(state);
    expect(clan.champion?.scars).toBe(1);
    expect(clan.champion?.lastSeen).toBe(state.day);
    expect(state.saga.some((e) => e.text.includes('got off the field alive'))).toBe(true);
  });

  it('putting him down is final — the clan loses him', () => {
    const state = besieged('champ-dies');
    startRaid(state, 2);
    const battle = state.battle!;
    const clan = state.neighbours[0]!;
    const name = clan.champion!.name;
    battle.outcome = 'won';
    battle.combatants.find((c) => c.personId === battle.champion)!.down = true;

    leaveBattle(state);
    expect(clan.champion).toBeUndefined();
    expect(state.saga.some((e) => e.text.includes(name) && e.text.includes('put down'))).toBe(true);
  });

  it('he comes back under his own name, and harder every time', () => {
    const state = besieged('champ-returns');
    const clan = state.neighbours[0]!;
    clan.champion = { name: 'Starkad', byname: 'the Old Wolf', scars: 2, lastSeen: 1 };

    startRaid(state, 2);
    const battle = state.battle!;
    const him = battle.foes.find((f) => f.id === battle.champion)!;
    expect(him.name).toBe('Starkad');
    expect(him.byname).toBe('the Old Wolf');
    // The log says he is not new.
    expect(battle.log[0]).toContain('had come back for us');
    // And the scars are on him, not just in the text.
    const fresh = structuredClone(besieged('champ-returns'));
    startRaid(fresh, 2);
    const stranger = fresh.battle!.foes.find((f) => f.id === fresh.battle!.champion)!;
    expect(him.maxHealth).toBe(stranger.maxHealth + 2 * SCAR_TOUGHNESS);
  });

  it('the scars stop somewhere — he stays killable', () => {
    const state = besieged('champ-cap');
    const clan = state.neighbours[0]!;
    clan.champion = { name: 'Starkad', byname: 'the Old Wolf', scars: 99, lastSeen: 1 };
    startRaid(state, 2);
    const him = state.battle!.foes.find((f) => f.id === state.battle!.champion)!;

    const fresh = besieged('champ-cap');
    startRaid(fresh, 2);
    const stranger = fresh.battle!.foes.find((f) => f.id === fresh.battle!.champion)!;
    expect(him.maxHealth).toBe(stranger.maxHealth + SCAR_MAX * SCAR_TOUGHNESS);
    expect(him.stats.might).toBeLessThanOrEqual(6);

    // And a capped champion who escapes does not overflow.
    state.battle!.outcome = 'won';
    state.battle!.combatants.find((c) => c.personId === state.battle!.champion)!.down = false;
    leaveBattle(state);
    expect(clan.champion!.scars).toBe(SCAR_MAX);
  });

  it('an open-field champion belongs to nobody and cannot return', () => {
    const state = structuredClone(newGame('champ-nofield'));
    state.tally.sackings = 8;
    startBattle(state, 'meadow', 1);
    expect(state.battle!.champion).toBeTruthy();
    expect(state.battle!.championOf).toBeUndefined();
    // Settling up must not throw or invent a clan for him.
    state.battle!.outcome = 'won';
    expect(() => leaveBattle(state)).not.toThrow();
    expect(state.neighbours.every((n) => n.champion === undefined)).toBe(true);
  });
});

describe('old saves', () => {
  it('come forward led by nobody', () => {
    const old = structuredClone(newGame('champ-migrate')) as unknown as Record<string, unknown>;
    old['version'] = 21;
    const migrated = migrate(old).save;
    expect(migrated['version']).toBe(SAVE_VERSION);
    expect(migrated['battle']).toBeUndefined();
  });
});

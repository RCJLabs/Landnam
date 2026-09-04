// Named raid leaders. Every raid is led; the open field earns a name once
// word has spread; and when the man with the pennant falls — theirs OR ours —
// the heart goes out of the whole side he led.

import { settled as settleSomewhere } from './fixtures/settle';
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
import { doStrike } from '../src/sim/strike';
import { NERVE_LEADER_FELL, STEADIED_PER_LINK, fellLeading } from '../src/sim/morale';
import { leaderOf } from '../src/sim/people';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { stream } from '../src/rng';
import type { Combatant, GameState } from '../src/state/types';

/** A settled steading a raid can actually be rolled against. */
function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
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
    for (let i = 0; i < battle.grid.length; i += 1) battle.grid[i] = { ground: 'open' };

    const ours = battle.combatants.filter((c) => c.side === 'warband');
    const foes = battle.combatants.filter((c) => c.side === 'foe');
    const attacker = (attackerSide === 'warband' ? ours : foes)[0]!;
    const target = (attackerSide === 'warband' ? foes : ours)[0]!;
    attacker.rank = 1;
    target.rank = 2;
    // Everyone else fills the ranks behind them, in order, with nobody
    // sharing a place.
    //
    // This used to park them far apart on the hex field, on the reasoning
    // that adjacency would make them wall links and links soften the shake
    // this test measures. There is no equivalent on a line: a wall link IS
    // an adjacent rank, so standing in the line at all is being linked, and
    // the only man with no links is one standing alone in a line of one.
    // What the fixture can still guarantee is that nobody is doubled up on a
    // rank, which the old version quietly got wrong — it numbered from 1 per
    // side and collided with the two set above.
    const fill = (side: Combatant[], fixed: Combatant): void => {
      let rank = 1;
      for (const c of side) {
        if (c === fixed) continue;
        if (rank === fixed.rank) rank += 1;
        c.rank = rank;
        rank += 1;
        c.broken = false;
      }
    };
    fill(attackerSide === 'warband' ? ours : foes, attacker);
    fill(attackerSide === 'warband' ? foes : ours, target);

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

  /**
   * What the leader's fall must cost a man who is standing in the wall.
   *
   * The bar used to be the whole of `NERVE_LEADER_FELL`, and it could be,
   * because the fixture stood everybody out of the wall where nothing
   * steadied them. On a line there is no out of the wall — `shakeNerve`
   * softens every shock by a quarter per shoulder-mate, two mates at most,
   * so a man in the middle of a line feels half of anything. That is the
   * design working, not the claim weakening: the claim is that his whole
   * side feels it, and the honest floor for "feels it" is what the
   * best-steadied man in the line feels.
   */
  const FELT_IN_THE_WALL = NERVE_LEADER_FELL * (1 - 2 * STEADIED_PER_LINK);

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
      expect(c.broken || before[i]! - c.nerve >= FELT_IN_THE_WALL).toBe(true);
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
      expect(c.broken || before[i]! - c.nerve >= FELT_IN_THE_WALL).toBe(true);
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
    // 9.5: the line keeps its dread and stops PROMISING a return. He comes
    // back one time in twenty, so "he will have marked us for it" was an
    // offer the game does not keep — pinned out here so it cannot drift back.
    const line = state.saga.find((e) => e.text.includes('got off the field alive'))!.text;
    expect(line, 'the line went back to promising a return').not.toMatch(/marked us for it/i);
    expect(line).toMatch(/not have forgotten/i);
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
    // 10.5: and it says how long, which is what `lastSeen` was written for.
    // Set on day 1 and read on the day of the raid, so the gap is real.
    expect(battle.log[0], 'lastSeen went unread again').toMatch(/It had been /);
    // And the scars are on him, not just in the text.
    const fresh = structuredClone(besieged('champ-returns'));
    startRaid(fresh, 2);
    const stranger = fresh.battle!.foes.find((f) => f.id === fresh.battle!.champion)!;
    expect(him.maxHealth).toBe(stranger.maxHealth + 2 * SCAR_TOUGHNESS);
  });

  // 10.5: `Champion.lastSeen` was written and never read for four milestones,
  // though its own comment said "so the log can say how long it has been". It
  // says it now. These drive the real raid rather than the private helper,
  // because the subtle part is that the old value must be read BEFORE the
  // same function overwrites it with today — a unit test of the helper would
  // not see that, and it is the half most likely to break.
  const lineFor = (seed: string, seenOn: number): string => {
    const s2 = besieged(seed);
    const clan2 = s2.neighbours[0]!;
    clan2.champion = { name: 'Starkad', byname: 'the Old Wolf', scars: 2, lastSeen: seenOn };
    startRaid(s2, 2);
    return s2.battle!.log[0]!;
  };

  it('says how long it had been, in the largest unit that has actually passed', () => {
    // Rounding DOWN: a man seen ninety days ago has not been away a year, and
    // the log saying so would be a small lie in the one place a run is retold.
    const day = besieged('gap-scale').day;
    expect(lineFor('gap-scale', day - 5)).toMatch(/It had been 5 days\./);
    expect(lineFor('gap-scale', day - 30)).toMatch(/It had been a season\./);
    expect(lineFor('gap-scale', day - 60)).toMatch(/It had been 2 seasons\./);
    expect(lineFor('gap-scale', day - 100)).toMatch(/It had been a year\./);
  });

  it('says nothing when no time has passed', () => {
    // A save taken mid-fight and reloaded: he is not coming back from
    // anywhere, and "It had been 0 days" is worse than silence.
    const day = besieged('gap-none').day;
    expect(lineFor('gap-none', day)).not.toMatch(/It had been/);
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

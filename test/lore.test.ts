// 4.4: what the band works out.
//
// The roadmap's line is "unlocked by exploration and events, NOT a tech-tree
// menu", so this file holds itself to two bars:
//
//   1. Knowledge is earned, never bought. There is no action, anywhere in the
//      game, that hands the player a lore because they asked for it — and
//      nothing is known on day one.
//   2. Knowing a thing measurably changes the run. Every entry in data/lore.ts
//      moves a real number in the direction it claims to, and one that moves
//      nothing is a badge, which is the failure mode this milestone exists to
//      avoid.

import { describe, it, expect } from 'vitest';
import { distance, fromKey } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply, type Action } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign, finishBuilds, queueBuild, shelterSaving } from '../src/sim/colony';
import { isEligible, checkOdds, presentEvent } from '../src/sim/events';
import { moveOptions, moveEffort, isCoastalWater, SEA_EFFORT } from '../src/sim/travel';
import { holdSteading } from '../src/sim/raid';
import { doStrike } from '../src/sim/battleActions';
import { coldNight } from '../src/sim/cold';
import { forecast } from '../src/sim/winter';
import { defenceBonus, WALL_BONUS_ONE } from '../src/sim/wall';
import { bonus, knows, known, learn, unknownLore } from '../src/sim/lore';
import { LORE, loreById, type LoreId } from '../src/data/lore';
import { EVENTS } from '../src/data/events';
import type { Battle, Combatant, GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

function settled(seed: string, radius = 14): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const landing = state.world.landing;
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    if (distance(at, landing) > radius) continue;
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
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.party.food = 90;
  state.party.firewood = 90;
  state.day = 30;
  return state;
}

/**
 * Two fighters, shoulder to shoulder, with `side` holding the initiative.
 * A real battle deploys the two lines nine rows apart, which is no use for
 * measuring what a single blow is worth.
 */
function duel(base: GameState, side: 'warband' | 'foe'): GameState {
  const s = structuredClone(base);
  const ours = s.party.people.find((p) => p.alive)!;
  const foe = { ...structuredClone(ours), id: 'foe_1', name: 'Grim', trait: 'foe:raider' };
  const stand = (personId: string, at: { q: number; r: number }, from: 'warband' | 'foe') => ({
    personId,
    side: from,
    at,
    initiative: 0,
    movesLeft: 3,
    hasActed: false,
    throwsLeft: 1,
    defending: false,
    kills: 0,
    nerve: 80,
    broken: false,
    fled: false,
    down: false,
  });
  const attacker = side === 'warband' ? ours.id : foe.id;
  s.battle = {
    terrain: 'meadow',
    width: 3,
    height: 3,
    grid: { '0,0': { ground: 'open' }, '1,0': { ground: 'open' } },
    foes: [foe],
    combatants: [
      stand(ours.id, { q: 0, r: 0 }, 'warband'),
      stand(foe.id, { q: 1, r: 0 }, 'foe'),
    ],
    order: [attacker, side === 'warband' ? foe.id : ours.id],
    turnIndex: 0,
    round: 1,
    log: [],
  };
  s.modes = [...s.modes, 'BATTLE'];
  return s;
}

/** The same state, with one thing known. Nothing else differs. */
function taught(state: GameState, id: LoreId): GameState {
  const copy = structuredClone(state);
  expect(learn(copy, id)).toBe(true);
  return copy;
}

describe('content lint: lore', () => {
  it('ids are unique, resolvable and slug-shaped', () => {
    const ids = LORE.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+$/);
      expect(loreById(id)).toBeDefined();
    }
  });

  it('every lore says what it is and what it buys, and buys something', () => {
    const knobs = ['check', 'solace', 'sea', 'bite', 'warmth', 'mend', 'physic', 'wall'] as const;
    for (const lore of LORE) {
      expect(lore.name.length, lore.id).toBeGreaterThan(0);
      expect(lore.blurb.length, lore.id).toBeGreaterThan(30);
      expect(lore.gain.length, lore.id).toBeGreaterThan(10);
      // A lore that turns no knob is a badge. That is the whole failure mode
      // this milestone is trying not to ship.
      const turns = knobs.filter((k) => (lore[k] ?? 0) !== 0);
      expect(turns.length, `${lore.id} changes nothing`).toBeGreaterThan(0);
    }
  });

  it('every lore is reachable — by a card, or by something you did', () => {
    // Cards that teach.
    const byCard = new Set<string>();
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        for (const branch of [choice.success, choice.failure]) {
          for (const effect of branch?.effects ?? []) {
            if (effect.t === 'learn') byCard.add(effect.lore);
          }
        }
      }
    }
    // The two the world teaches directly, proven by their own tests below.
    const byDeed = new Set(['shipwright', 'shieldcraft']);
    for (const lore of LORE) {
      expect(
        byCard.has(lore.id) || byDeed.has(lore.id),
        `${lore.id} cannot be learned at all`,
      ).toBe(true);
    }
  });

  it('a discovery card stops being drawable the moment it is known', () => {
    let taughtBy = 0;
    for (const event of EVENTS) {
      const learns = event.choices.flatMap((c) =>
        [c.success, c.failure].flatMap((o) => o?.effects ?? []),
      ).filter((e) => e.t === 'learn');
      if (learns.length === 0) continue;
      taughtBy += 1;
      // Every teaching card must be gated on not already knowing it, or the
      // player draws the same discovery for the rest of the run.
      const gates = (event.when ?? []).filter((c) => c.c === 'unknown');
      expect(gates.length, `${event.id} is not gated on unknown`).toBeGreaterThan(0);
      for (const effect of learns) {
        expect(
          gates.some((g) => g.c === 'unknown' && g.lore === effect.lore),
          `${event.id} teaches ${effect.t === 'learn' ? effect.lore : ''} without gating on it`,
        ).toBe(true);
      }
    }
    expect(taughtBy, 'no card teaches anything').toBeGreaterThan(0);
  });
});

describe('THE BAR — knowledge is earned, never bought', () => {
  it('a band knows nothing on the morning it lands', () => {
    for (const seed of ['lore-a', 'lore-b', 'lore-c']) {
      expect(newGame(seed).lore).toEqual([]);
    }
  });

  it('no action a player can dispatch grants a lore', () => {
    // Every action the UI can send, on a settled band, on its own ground.
    const state = settled('lore-actions');
    const person = state.party.people.find((p) => p.alive)!;
    const actions: Action[] = [
      { type: 'CAMP' },
      { type: 'FORAGE' },
      { type: 'HUNT' },
      { type: 'FISH' },
      { type: 'FOUND' },
      { type: 'ENTER_COLONY' },
      { type: 'LEAVE_COLONY' },
      { type: 'ASSIGN', personId: person.id, job: 'builder' },
      { type: 'QUEUE_BUILD', building: 'longhouse' },
      { type: 'UNQUEUE_BUILD', building: 'longhouse' },
      { type: 'TURN_HOME' },
      { type: 'LAUNCH', members: [person.id], purpose: 'explore' },
      { type: 'DISMISS_EVENT' },
      { type: 'DISMISS_AFTERMATH' },
      { type: 'CHOOSE', index: 0 },
    ];
    for (const action of actions) {
      const next = apply(state, action);
      expect(next.lore, `${action.type} handed out knowledge`).toEqual([]);
    }
  });

  it('learning is idempotent and keeps its order', () => {
    const state = structuredClone(newGame('lore-once'));
    expect(learn(state, 'runes')).toBe(true);
    expect(learn(state, 'runes'), 'learned the same thing twice').toBe(false);
    expect(learn(state, 'smithing')).toBe(true);
    expect(state.lore).toEqual(['runes', 'smithing']);
    expect(known(state).map((l) => l.id)).toEqual(['runes', 'smithing']);
    expect(unknownLore(state)).toHaveLength(LORE.length - 2);
    // And it is written down where the player will see it.
    expect(state.saga.some((e) => e.text.includes('rune-craft'))).toBe(true);
  });

  it('what the band knows survives a save, and an older run comes back empty', () => {
    const state = settled('lore-save');
    learn(state, 'skywatch');
    learn(state, 'leechcraft');
    const round = migrate(JSON.parse(encode(state)) as Record<string, unknown>);
    expect(round.applied).toBe(0);
    expect((round.save as unknown as GameState).lore).toEqual(['skywatch', 'leechcraft']);

    const old = JSON.parse(encode(state)) as Record<string, unknown>;
    delete old['lore'];
    old['version'] = 13;
    const back = migrate(old);
    expect(back.applied).toBe(SAVE_VERSION - 13);
    const older = back.save as unknown as GameState;
    expect(older.lore).toEqual([]);
    // And a run that knows nothing still ticks over perfectly happily.
    expect(passDay(older)).toBe(true);
  });
});

describe('THE BAR — knowing a thing changes the run', () => {
  it('rune-craft: reckonings go better, and the dead weigh less', () => {
    const state = settled('lore-runes');
    const wise = taught(state, 'runes');
    expect(bonus(wise, 'check')).toBe(1);

    // The odds are not merely rolled better — the card SAYS so, which is what
    // makes the knowledge visible instead of a hidden thumb on the scale.
    const def = EVENTS.find((e) => e.choices.some((c) => c.check))!;
    const before = presentEvent(state, def).choices.find((c) => c.hint)!.hint!;
    const after = presentEvent(wise, def).choices.find((c) => c.hint)!.hint!;
    const pct = (h: string) => Number(h.replace(/.*·\s*/, '').replace('%', ''));
    expect(pct(after)).toBeGreaterThan(pct(before));
    expect(checkOdds(4 + bonus(wise, 'check'), 13)).toBeGreaterThan(checkOdds(4, 13));

    expect(bonus(wise, 'solace')).toBeGreaterThan(0);
    expect(bonus(state, 'solace')).toBe(0);
  });

  it("shipwright's eye: a day on the water costs less", () => {
    const state = structuredClone(newGame('lore-ship'));
    const water = moveOptions(state).find((h) => isCoastalWater(state, h));
    expect(water, 'no coastal water beside the landing').toBeTruthy();
    const plain = moveEffort(state, water!)!;

    const sailor = taught(state, 'shipwright');
    const learned = moveEffort(sailor, water!)!;
    expect(learned).toBeLessThan(plain);
    expect(learned).toBeGreaterThanOrEqual(1);
    expect(plain).toBe(SEA_EFFORT);
  });

  it('shipwright is taught by the dock, not by a menu', () => {
    const state = settled('lore-dock');
    expect(knows(state, 'shipwright')).toBe(false);
    // Force the harbour so the dock is raisable wherever we settled.
    state.settlement!.report.harbour = Math.max(1, state.settlement!.report.harbour);
    expect(queueBuild(state, 'dock')).toBe(true);
    state.settlement!.works = 999;
    const done = finishBuilds(state);
    expect(done.map((b) => b.id)).toContain('dock');
    expect(knows(state, 'shipwright'), 'the dock taught nobody anything').toBe(true);
  });

  it('iron-craft: our blows bite deeper, and theirs do not', () => {
    const state = settled('lore-iron');
    const smiths = taught(state, 'smithing');
    expect(bonus(smiths, 'bite')).toBe(1);
    expect(bonus(state, 'bite')).toBe(0);

    // Measured, not asserted: the same fighter, the same foe, the same rolls,
    // over enough days that the dice are the same dice.
    const damageOver = (base: GameState, side: 'warband' | 'foe'): number => {
      let total = 0;
      for (let day = 1; day <= 60; day++) {
        const s = duel(base, side);
        s.day = day;
        const victim = side === 'warband' ? s.battle!.foes[0]! : s.party.people[0]!;
        const before = victim.health;
        doStrike(s, victim.id);
        total += before - victim.health;
      }
      return total;
    };

    const plainHits = damageOver(state, 'warband');
    const ironHits = damageOver(smiths, 'warband');
    // eslint-disable-next-line no-console
    console.log(`sixty swings — plain iron ${plainHits}, worked iron ${ironHits}`);
    expect(ironHits).toBeGreaterThan(plainHits);

    // And the raiders coming over the ridge did not sit in on the lesson.
    expect(damageOver(smiths, 'foe')).toBe(damageOver(state, 'foe'));
  });

  it('reading the sky: a night needs less wood, and the mark knows it', () => {
    const state = settled('lore-sky');
    const wise = taught(state, 'skywatch');
    expect(shelterSaving(wise)).toBeGreaterThan(shelterSaving(state));

    // The winter mark must be computed from the same saving the day tick
    // burns from, or the panel would promise a winter the game does not run.
    state.day = 40;
    wise.day = 40;
    expect(forecast(wise).firewood).toBeLessThan(forecast(state).firewood);
  });

  it('leechcraft: hurts mend faster and a cold night bites less', () => {
    const state = settled('lore-leech');
    const wise = taught(state, 'leechcraft');
    expect(bonus(wise, 'mend')).toBeGreaterThan(0);
    expect(bonus(wise, 'physic')).toBeGreaterThan(0);

    // Mending, measured through the day tick rather than asserted.
    const hurt = (s: GameState): GameState => {
      const copy = structuredClone(s);
      for (const p of copy.party.people) {
        p.injuries = [{ id: 'cut', label: 'A deep cut', effect: { might: -1 }, heals: 8 }];
      }
      return copy;
    };
    let plain = hurt(state);
    let cared = hurt(wise);
    for (let i = 0; i < 4; i++) {
      passDay(plain);
      passDay(cared);
    }
    const left = (s: GameState) => s.party.people.reduce((n, p) => n + p.injuries.length, 0);
    expect(left(cared), 'leechcraft mended nothing faster').toBeLessThan(left(plain));

    // And the cold, over enough nights that the roll cannot be luck.
    let plainFell = 0;
    let caredFell = 0;
    for (let day = 50; day < 70; day++) {
      const a = structuredClone(state);
      const b = structuredClone(wise);
      a.day = day;
      b.day = day;
      plainFell += coldNight(a, 3).length;
      caredFell += coldNight(b, 3).length;
    }
    // eslint-disable-next-line no-console
    console.log(`twenty cold nights — untaught fell ill ${plainFell}, leechcraft ${caredFell}`);
    expect(caredFell).toBeLessThan(plainFell);
  });

  it('wall-drill: a line is worth more, and standing alone still is not', () => {
    const battle = {
      grid: {},
      combatants: [
        { personId: 'a', side: 'warband', at: { q: 0, r: 0 } },
        { personId: 'b', side: 'warband', at: { q: 1, r: 0 } },
        { personId: 'c', side: 'warband', at: { q: 9, r: 9 } },
      ].map((c) => ({
        ...c,
        initiative: 0, movesLeft: 3, hasActed: false, throwsLeft: 1, defending: false,
        kills: 0, nerve: 60, broken: false, fled: false, down: false,
      })),
    } as unknown as Battle;
    const inLine = battle.combatants[0] as Combatant;
    const alone = battle.combatants[2] as Combatant;

    expect(defenceBonus(battle, inLine, 3, 0)).toBe(WALL_BONUS_ONE);
    expect(defenceBonus(battle, inLine, 3, 1)).toBe(WALL_BONUS_ONE + 1);
    // Drill is worth nothing to somebody standing on their own, which is the
    // whole idea of drill.
    expect(defenceBonus(battle, alone, 3, 1)).toBe(0);
  });

  it('wall-drill is taught by a line that held, not by losing one', () => {
    const held = settled('lore-hold');
    expect(knows(held, 'shieldcraft')).toBe(false);
    holdSteading(held, 3);
    expect(knows(held, 'shieldcraft')).toBe(true);

    // They looked at the place and went away again: nobody learned anything.
    const bloodless = settled('lore-hold');
    holdSteading(bloodless, 0);
    expect(knows(bloodless, 'shieldcraft')).toBe(false);
  });
});

describe('discoveries in play', () => {
  it('the boulder is drawable in the right country and nowhere else', () => {
    const state = structuredClone(newGame('lore-card'));
    state.day = 12;
    const def = EVENTS.find((e) => e.id === 'carved-boulder')!;

    const here = `${state.party.at.q},${state.party.at.r}`;
    state.world.tiles[here]!.terrain = 'hills';
    expect(isEligible(state, def)).toBe(true);

    state.world.tiles[here]!.terrain = 'bog';
    expect(isEligible(state, def), 'runes turned up in a bog').toBe(false);

    state.world.tiles[here]!.terrain = 'hills';
    state.day = 2;
    expect(isEligible(state, def), 'runes on the second morning ashore').toBe(false);
  });

  it('a card that has taught its lesson never comes round again', () => {
    const state = structuredClone(newGame('lore-repeat'));
    state.day = 12;
    state.world.tiles[`${state.party.at.q},${state.party.at.r}`]!.terrain = 'hills';
    const def = EVENTS.find((e) => e.id === 'carved-boulder')!;
    expect(isEligible(state, def)).toBe(true);

    // Resolve it through the real path: choose, then dismiss.
    state.event = presentEvent(state, def);
    const settledCard = apply(apply(state, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' });
    if (knows(settledCard, 'runes')) {
      expect(isEligible(settledCard, def), 'the same boulder twice').toBe(false);
    } else {
      // A failed reading leaves the stone there to come back to, which is the
      // point of gating on the lore rather than on `once`.
      expect(isEligible(settledCard, def)).toBe(true);
    }
  });

  it('over a long run, a band that walks the country works things out', () => {
    // Not a guarantee for any one seed — discovery is a roll on top of a roll
    // — but across a handful of runs, walking must produce knowledge.
    let learnedTotal = 0;
    let runs = 0;
    for (const seed of ['walk-a', 'walk-b', 'walk-c', 'walk-d', 'walk-e', 'walk-f']) {
      let s: GameState = structuredClone(newGame(seed));
      s.party.food = 400;
      s.party.firewood = 400;
      for (let i = 0; i < 70 && !s.end; i++) {
        if (s.battle) {
          for (let g = 0; g < 400 && s.battle && !s.battle.outcome; g++) {
            s = apply(s, { type: 'B_END_TURN' });
          }
          if (s.battle?.outcome) s = apply(s, { type: 'B_LEAVE' });
          continue;
        }
        if (s.aftermath) {
          s = apply(s, { type: 'DISMISS_AFTERMATH' });
          continue;
        }
        if (s.event) {
          s = apply(apply(s, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' });
          continue;
        }
        const options = moveOptions(s);
        s = options[i % options.length]
          ? apply(s, { type: 'MOVE', to: options[i % options.length]! })
          : apply(s, { type: 'CAMP' });
      }
      learnedTotal += s.lore.length;
      runs += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`${runs} wandering runs learned ${learnedTotal} things between them`);
    expect(learnedTotal, 'walking the country taught nobody anything').toBeGreaterThan(0);
  });
});

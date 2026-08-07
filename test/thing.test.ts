// 4.6: the endgame.
//
// "Victory: survive N winters and hold a Thing to be proclaimed jarl. Defeat:
// warband extinguished." The failure mode to avoid is an endgame that is
// really a timer — a run that ends because a number went up rather than
// because the player did anything. So the bars are:
//
//   1. Surviving is no longer winning. The first thaw is a milestone; the
//      year comes round again.
//   2. The Thing is a CHECKLIST, and every item on it individually blocks the
//      claim. Each one is a system the player already has to work with.
//   3. The odds are shown before the claim is made, and they are the odds the
//      claim is actually rolled at.
//   4. It is reachable: a band that does the work gets there.

import { describe, it, expect } from 'vitest';
import { distance, fromKey } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign, finishBuilds, queueBuild } from '../src/sim/colony';
import { nextThaw, wintersStood, SEASON_LENGTH, YEAR_LENGTH } from '../src/sim/calendar';
import { checkOdds } from '../src/sim/events';
import { shiftStanding, seeNeighbours } from '../src/sim/neighbours';
import { forecast, markVisible } from '../src/sim/winter';
import { composeSaga, sagaText } from '../src/sim/sagagen';
import {
  callThing,
  canCallThing,
  hasSpeakers,
  houseAtPeace,
  layDownRule,
  thingCooldown,
  thingNeeds,
  thingOdds,
  thingReady,
  thingStanding,
  yearsRuled,
} from '../src/sim/thing';
import { JARL_WORD, wordBump, wordOf } from '../src/sim/word';
import { foeCapFor, raiderCap, rollFoes } from '../src/sim/battle';
import { stream } from '../src/rng';
import {
  FEAST_FOOD,
  LONG_LIFE_WINTERS,
  NEEDS,
  THING_ANGER_MAX,
  THING_BASE,
  THING_COOLDOWN,
  THING_DC,
  THING_MERIT_CAP,
  WINTERS_TO_JARL,
  type NeedId,
} from '../src/data/thing';
import { FEUD_THRESHOLD } from '../src/data/feuds';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/**
 * The best ground within `radius` of the landing — and if that stretch of
 * coast has none, the best anywhere. The widening is not a nicety: the
 * 52x36 world put whole seeds' worth of settleable ground outside a
 * fourteen-hex walk, and a fixture that gave up there failed on the seed
 * rather than on the thing under test. Third fixture to learn this.
 */
function settled(seed: string, radius = 14): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const landing = state.world.landing;
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const reach of [radius, Infinity]) {
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      if (distance(at, landing) > reach) continue;
      state.party.at = at;
      if (!canFound(state, at)) continue;
      const report = siteReport(state.world, at)!;
      if (report.total > bestScore) {
        bestScore = report.total;
        best = at;
      }
    }
    if (best) break;
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.party.food = 200;
  state.party.firewood = 200;
  seeNeighbours(state);
  return state;
}

/** A steading that has done everything the Thing asks for. */
function worthy(seed: string): GameState {
  const state = settled(seed);
  const home = state.settlement!;
  home.built.push('longhouse', 'meadhall');
  state.day = nextThaw(1) + YEAR_LENGTH; // two winters behind them
  state.party.food = 200;
  state.party.morale = 80;
  const friend = state.neighbours[0];
  if (friend) {
    friend.found = true;
    shiftStanding(state, friend.id, 60);
  }
  state.grudges = [];
  expect(thingReady(state), `${seed}: not worthy after setup`).toBe(true);
  return state;
}

describe('THE BAR — surviving is no longer winning', () => {
  it('the first thaw counts a winter and the run goes on', () => {
    const state = settled('end-thaw');
    state.day = 72;
    expect(wintersStood(state.day)).toBe(0);
    expect(passDay(state)).toBe(true);
    expect(state.day).toBe(73);
    expect(state.end, 'the first thaw still ended the run').toBeUndefined();
    expect(wintersStood(state.day)).toBe(1);
    // And one winter is explicitly not enough to be proclaimed anything.
    expect(WINTERS_TO_JARL).toBeGreaterThan(1);
    expect(thingNeeds(state).find((n) => n.id === 'winters')!.met).toBe(false);
  });

  it('the winter mark points at the next winter, year on year', () => {
    const state = settled('end-mark');
    state.day = 73;
    expect(markVisible(state), 'the mark was on screen through spring').toBe(false);
    expect(forecast(state).days).toBe(YEAR_LENGTH);

    state.day = 73 + YEAR_LENGTH - 40; // autumn of the second year
    expect(markVisible(state)).toBe(true);
    expect(forecast(state).days).toBe(40);
  });

  it('a whole life on the coast ends the run on its own, without a title', () => {
    const state = settled('end-long');
    state.day = LONG_LIFE_WINTERS * YEAR_LENGTH - 24; // the last winter
    state.party.food = 99999;
    state.party.firewood = 99999;
    for (let i = 0; i < 200 && !state.end; i++) passDay(state);
    expect(state.end?.cause).toBe('survived');
    expect(wintersStood(state.day)).toBeGreaterThanOrEqual(LONG_LIFE_WINTERS);
    expect(state.end!.lines.join(' ')).toContain('No title');
  });

  it('the warband being extinguished is still the defeat it always was', () => {
    const state = settled('end-dead');
    for (const p of state.party.people) {
      p.alive = false;
      p.health = 0;
      p.fate = 'the cold';
    }
    state.party.food = 0;
    passDay(state);
    expect(state.end?.cause).toBe('frozen');
  });
});

describe('THE BAR — the Thing is a checklist, and every item blocks it', () => {
  it('ships a need for every id, each with a reason', () => {
    const ids = NEEDS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const need of NEEDS) {
      expect(need.label.length, need.id).toBeGreaterThan(0);
      expect(need.why.length, need.id).toBeGreaterThan(20);
    }
  });

  it('every single requirement, on its own, stops the claim', () => {
    const breaks: Record<NeedId, (s: GameState) => void> = {
      winters: (s) => { s.day = 30; },
      hall: (s) => { s.settlement!.built = s.settlement!.built.filter((b) => b !== 'meadhall'); },
      peace: (s) => {
        s.grudges = [{ a: s.party.people[0]!.id, b: s.party.people[1]!.id, weight: FEUD_THRESHOLD, cause: 'a knife', since: 20 }];
      },
      friends: (s) => { for (const n of s.neighbours) n.standing = -10; },
      feast: (s) => { s.party.food = FEAST_FOOD - 1; },
      gathered: (s) => {
        s.expedition = { members: [s.party.people[0]!.id], purpose: 'explore', launchedOn: s.day, carried: 3 };
      },
    };

    for (const need of NEEDS) {
      const state = worthy(`block-${need.id}`);
      breaks[need.id](state);
      const after = thingNeeds(state);
      expect(after.find((n) => n.id === need.id)!.met, `${need.id} did not read as unmet`).toBe(false);
      expect(thingReady(state), `${need.id} did not block the claim`).toBe(false);
      expect(canCallThing(state)).toBe(false);
      expect(callThing(state), `${need.id} let the Thing be called anyway`).toBeNull();
      // And nothing was spent trying.
      expect(state.flags['thingCalledOn']).toBeUndefined();
    }
  });

  it('a steading that has done all of it can call one', () => {
    const state = worthy('ready');
    for (const need of thingNeeds(state)) expect(need.met, need.id).toBe(true);
    expect(canCallThing(state)).toBe(true);
  });

  it('an open feud is the block, and settling it clears the block', () => {
    const state = worthy('feud-block');
    const [a, b] = state.party.people;
    state.grudges = [{ a: a!.id, b: b!.id, weight: FEUD_THRESHOLD + 4, cause: 'a knife at the fire', since: 20 }];
    expect(houseAtPeace(state)).toBe(false);
    expect(canCallThing(state)).toBe(false);
    state.grudges[0]!.settled = true;
    expect(houseAtPeace(state)).toBe(true);
    expect(canCallThing(state)).toBe(true);
  });

  it('a coast that will not speak for you is the block', () => {
    const state = worthy('speak-block');
    for (const n of state.neighbours) n.standing = 0;
    expect(hasSpeakers(state)).toBe(false);
    expect(canCallThing(state)).toBe(false);
    // Somebody has to have actually MET you, not merely exist somewhere.
    const far = state.neighbours[0]!;
    far.standing = 60;
    far.found = false;
    expect(hasSpeakers(state)).toBe(false);
    far.found = true;
    expect(hasSpeakers(state)).toBe(true);
  });
});

describe('THE BAR — the odds are the odds', () => {
  it('what is shown is what is rolled', () => {
    const state = worthy('odds');
    expect(thingOdds(state)).toBeCloseTo(checkOdds(thingStanding(state), THING_DC), 10);
  });

  it('every lever the player has moves the claim', () => {
    // Deliberately a band that scraped in: the merits are capped together, so
    // measuring the levers off a maxed-out band would measure the cap.
    const base = worthy('odds-move');
    base.party.morale = 30;
    base.party.people.forEach((p) => { p.stats.spirit = 3; });
    base.neighbours.forEach((n, i) => { n.found = true; n.standing = i === 0 ? 25 : 0; });
    const baseline = thingStanding(base);

    const lever = (label: string, change: (s: GameState) => void): number => {
      const s = structuredClone(base);
      change(s);
      const moved = thingStanding(s);
      expect(moved, `${label} counted for nothing at the Thing`).toBeGreaterThan(baseline);
      return moved;
    };

    lever('a coast that loves you', (s) => {
      for (const n of s.neighbours) n.standing = 100;
    });
    lever('rune-craft', (s) => { s.lore = ['runes']; });
    lever('a band in good heart', (s) => { s.party.morale = 90; });
    lever('a speaker worth hearing', (s) => { s.party.people[0]!.stats.spirit = 6; });
    lever('a hall full of buildings', (s) => {
      s.settlement!.built.push('farmplots', 'palisade', 'dock', 'smokehouse');
    });
    lever('another winter behind them', (s) => { s.day += YEAR_LENGTH; });

    // And the one that goes the other way.
    const hated = structuredClone(base);
    for (const n of hated.neighbours.slice(1)) n.standing = -100;
    expect(thingStanding(hated)).toBeLessThan(baseline);
  });

  it('the odds are never a formality and never hopeless', () => {
    // A band that has scraped in against one that has done everything.
    const thin = worthy('odds-thin');
    thin.party.morale = 30;
    thin.neighbours[0]!.standing = 25;
    expect(thingOdds(thin)).toBeGreaterThan(0.05);

    const mighty = worthy('odds-fat');
    mighty.party.morale = 100;
    mighty.lore = ['runes'];
    for (const n of mighty.neighbours) { n.found = true; n.standing = 100; }
    mighty.settlement!.built.push('farmplots', 'palisade', 'dock', 'smokehouse');
    expect(thingOdds(mighty)).toBeGreaterThan(thingOdds(thin));
    // And a band that did EVERYTHING still has to roll it. A climax that
    // cannot be lost is a button that says "you win".
    expect(thingOdds(mighty), 'the Thing was a formality').toBeLessThan(1);
    expect(thingOdds(mighty)).toBeGreaterThan(0.7);
    // eslint-disable-next-line no-console
    console.log(
      `the claim — scraped in: ${Math.round(thingOdds(thin) * 100)}%, ` +
        `did everything: ${Math.round(thingOdds(mighty) * 100)}%`,
    );
  });

  it('a coast you have wronged can pull down a claim nothing else could', () => {
    const strong = worthy('odds-anger');
    strong.party.morale = 100;
    strong.lore = ['runes'];
    strong.settlement!.built.push('farmplots', 'palisade', 'dock');
    for (const n of strong.neighbours) { n.found = true; n.standing = 100; }
    const proud = thingOdds(strong);

    // One friend to speak, and everybody else hating you as hard as they can.
    for (const n of strong.neighbours.slice(1)) n.standing = -100;
    expect(thingStanding(strong)).toBe(THING_BASE + THING_MERIT_CAP - THING_ANGER_MAX);
    expect(thingOdds(strong)).toBeLessThan(proud);
    // eslint-disable-next-line no-console
    console.log(
      `a claim everything else supports — a friendly coast: ${Math.round(proud * 100)}%, ` +
        `a coast you have wronged: ${Math.round(thingOdds(strong) * 100)}%`,
    );
  });
});

describe('holding one', () => {
  it('carrying it grants the rule and does NOT end the run', () => {
    // The claim is capped below certainty by design, so find the seed-day on
    // which this band's roll actually carries rather than rigging the roll.
    let state = worthy('carried');
    state.party.morale = 100;
    state.lore = ['runes'];
    for (const n of state.neighbours) { n.found = true; n.standing = 100; }
    state.settlement!.built.push('farmplots', 'palisade', 'dock', 'smokehouse');

    let attempt = structuredClone(state);
    let result = callThing(attempt)!;
    for (let i = 0; i < 40 && !result.proclaimed; i++) {
      attempt = structuredClone(state);
      attempt.day += (i + 1) * THING_COOLDOWN;
      result = callThing(attempt)!;
    }
    const before = state.party.food;
    expect(result.proclaimed, 'never carried in forty attempts').toBe(true);
    state = attempt;
    expect(state.party.food).toBe(before - FEAST_FOOD);

    // 6.4: the Thing carrying is no longer where the run stops. The rule is
    // granted, the game goes on, and the closing belongs to the player.
    expect(state.end).toBeUndefined();
    expect(state.jarl?.name).toBe(result.jarl);
    expect(state.jarl?.since).toBe(state.day);
    expect(passDay(state)).toBe(true);
    // And there is no second jarldom to win.
    expect(canCallThing(state)).toBe(false);

    // Closing it is one call, and it writes the ending the Thing used to.
    expect(layDownRule(state)).toBe(true);
    expect(state.end?.cause).toBe('jarl');
    expect(state.end!.title).toContain(state.settlement!.name);
    expect(state.end!.title).toContain(result.jarl!);
    // Once closed, it cannot be closed again.
    expect(layDownRule(state)).toBe(false);

    const saga = sagaText(composeSaga(state));
    expect(saga).toContain('Jarl');
    expect(saga).toMatch(/weapons went up|carried it|appealed to/i);
    expect(saga).not.toMatch(/[{}]/);
  });

  it('the rule counts its winters, and the ending says how many', () => {
    const state = worthy('ruled-years');
    state.jarl = { name: 'Ketil the Quiet', since: state.day };
    expect(yearsRuled(state)).toBe(0);

    state.day += SEASON_LENGTH * 4 * 2;
    expect(yearsRuled(state)).toBe(2);
    expect(layDownRule(state)).toBe(true);
    expect(state.end!.lines.join(' ')).toContain('2 winters were held');
  });

  it('ruling on makes the coast worse, which is the price of the choice', () => {
    const quiet = worthy('word-quiet');
    const ruling = structuredClone(quiet);
    ruling.jarl = { name: 'Ketil the Quiet', since: ruling.day };

    // A jarl is the loudest name on the coast: harder open-field fights...
    expect(wordOf(ruling)).toBe(wordOf(quiet) + JARL_WORD);
    expect(wordBump(ruling)).toBeGreaterThan(wordBump(quiet));
    // ...and more men willing to cross the country for the richest hall.
    expect(raiderCap(ruling)).toBeGreaterThan(raiderCap(quiet));

    // And it BINDS. Escalation routed through a knob that a Math.min
    // downstream throws away is this project's oldest bug; the rule is that
    // no escalation ships without the fight it produces being counted.
    let quietHard = 0;
    let ruledHard = 0;
    for (let i = 0; i < 40; i += 1) {
      const seed = stream('jarl-binds', 'combat').derive(`roll:${i}`);
      const a = rollFoes(seed, 6, 1, false, foeCapFor(quiet), wordOf(quiet));
      const b = rollFoes(
        stream('jarl-binds', 'combat').derive(`roll:${i}`),
        6, 1, false, foeCapFor(ruling), wordOf(ruling),
      );
      quietHard += a.filter((f) => f.trait === 'foe:huscarl').length;
      ruledHard += b.filter((f) => f.trait === 'foe:huscarl').length;
    }
    // eslint-disable-next-line no-console
    console.log(`huscarls over 40 open-field rolls — nobody: ${quietHard}, a jarl: ${ruledHard}`);
    expect(ruledHard).toBeGreaterThan(quietHard);
  });

  it('through the action path: rule on, then lay it down when ready', () => {
    const state = worthy('rule-path');
    state.jarl = { name: 'Ketil the Quiet', since: state.day };

    const ruling = apply(state, { type: 'RULE_ON' });
    expect(ruling).not.toBe(state);
    expect(ruling.flags['ruleTaken']).toBe(state.day);
    expect(ruling.end).toBeUndefined();
    // Answering twice is a refusal, not a second answer.
    expect(apply(ruling, { type: 'RULE_ON' })).toBe(ruling);

    const closed = apply(ruling, { type: 'LAY_DOWN_RULE' });
    expect(closed.end?.cause).toBe('jarl');
    // A band that never won one has nothing to lay down.
    const nobody = worthy('rule-nobody');
    expect(apply(nobody, { type: 'LAY_DOWN_RULE' })).toBe(nobody);
  });

  it('losing it costs the feast, and it cannot be pressed again at once', () => {
    const base = worthy('refused');
    // A band that scraped in on every requirement and brought nothing more.
    base.party.morale = 0;
    base.party.people.forEach((p) => { p.stats.spirit = 1; });
    for (const n of base.neighbours) { n.found = true; n.standing = -100; }
    base.neighbours[0]!.standing = 25;
    expect(thingOdds(base)).toBeLessThan(0.15);

    // The claim is a roll, so find a day it goes against them rather than
    // rigging it into an impossibility.
    let state = structuredClone(base);
    let result = callThing(state)!;
    for (let i = 0; i < 40 && result.proclaimed; i++) {
      state = structuredClone(base);
      state.day += (i + 1) * THING_COOLDOWN;
      result = callThing(state)!;
    }
    const food = base.party.food;
    expect(result.proclaimed, 'never refused in forty attempts').toBe(false);
    expect(state.end).toBeUndefined();
    expect(state.party.food).toBe(food - FEAST_FOOD);
    expect(thingCooldown(state)).toBe(THING_COOLDOWN);
    expect(canCallThing(state)).toBe(false);

    state.day += THING_COOLDOWN;
    expect(thingCooldown(state)).toBe(0);
  });

  it('through the real action path: three days, a card to read, and a save', () => {
    const base = worthy('in-play');
    base.party.morale = 0;
    for (const n of base.neighbours) { n.found = true; n.standing = -100; }
    base.neighbours[0]!.standing = 25;
    base.party.people.forEach((p) => { p.stats.spirit = 1; });

    // Find a day the claim is refused, so there is a card to read.
    let state = base;
    let next = apply(state, { type: 'CALL_THING' });
    for (let i = 0; i < 40 && !next.event; i++) {
      state = structuredClone(base);
      state.day += (i + 1) * THING_COOLDOWN;
      next = apply(state, { type: 'CALL_THING' });
    }
    const day = state.day;
    expect(next).not.toBe(state);
    expect(next.day).toBe(day + 3);
    expect(next.event?.id, 'a refused claim vanished into the log').toBe('thing');
    expect(next.event!.outcome).toBeTruthy();

    // And it clears like any other card.
    const cleared = apply(next, { type: 'DISMISS_EVENT' });
    expect(cleared.event).toBeUndefined();

    // The whole thing round-trips.
    const round = migrate(JSON.parse(encode(cleared)) as Record<string, unknown>);
    expect(round.applied).toBe(0);
    expect((round.save as unknown as GameState).flags['thingCalledOn']).toBe(day);
  });

  it('an older save loads, and it simply has no jarl in it', () => {
    const state = worthy('old-save');
    const old = JSON.parse(encode(state)) as Record<string, unknown>;
    old['version'] = 15;
    const { save, applied } = migrate(old);
    expect(applied).toBe(SAVE_VERSION - 15);
    const back = save as unknown as GameState;
    expect(back.end).toBeUndefined();
    expect(passDay(back)).toBe(true);
  });
});

describe('THE BAR — it is reachable by doing the work', () => {
  it('a band that builds the hall, keeps the peace and makes a friend gets there', () => {
    let reached = 0;
    const seeds = ['reach-a', 'reach-b', 'reach-c', 'reach-d'];
    for (const seed of seeds) {
      const state = settled(seed);
      // The work, done the way a player would do it: raise the hall, deal
      // with the neighbours, and live through two winters.
      queueBuild(state, 'longhouse');
      state.settlement!.works = 999;
      finishBuilds(state);
      queueBuild(state, 'meadhall');
      state.settlement!.works = 999;
      finishBuilds(state);
      const friend = state.neighbours[0];
      if (friend) shiftStanding(state, friend.id, 60);

      for (let i = 0; i < 400 && !state.end; i++) {
        state.party.food = 300;
        state.party.firewood = 300;
        if (state.event) delete state.event;
        passDay(state);
        if (canCallThing(state)) break;
      }
      if (canCallThing(state)) reached += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`${reached}/${seeds.length} colonies that did the work could call a Thing`);
    expect(reached, 'nobody who did the work could reach the endgame').toBe(seeds.length);
  });
});

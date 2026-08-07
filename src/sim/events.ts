// Event engine. Interprets the data in data/events.ts: eligibility, weighted
// selection, stat checks with odds shown to the player, and effects.

import { key, neighbors, range } from '../hex';
import { stream } from '../rng';
import { EVENTS, eventById, type Condition, type Effect, type EventDef } from '../data/events';
import type { ActiveEvent, GameState, Stats } from '../state/types';
import { seasonOf } from './calendar';
import { startBattle, startRaid } from './battleTurn';
import { raidDifficulty } from './raid';
import { settleFeud } from './minds';
import { purposeDef } from './expedition';
import { bonus, knows, learn } from './lore';
import { takeIn } from './joining';
import { angerLevel, angriest, friendliest, goodwillLevel, shiftStanding, stirFactor } from './neighbours';
import { hasLineOfSight } from './fog';
import { bestStat, living } from './people';
import { chronicle } from './saga';
import { atHome } from './site';
import { WATCH_QUIET } from '../data/jobs';
import { effectiveReport } from './colony';
import { sickCount } from './winter';
import { checkRunEnd } from './upkeep';

/** Chance an event fires after a travel action. */
// 0.23, down from 0.28 — a playtest called the cards relentless, and the
// designer's ear outranks a knob the harness has already proven it cannot
// resolve (the 0.28/0.34/0.40 sweep was non-monotonic). The curve bars
// still guard the outcome.
const BASE_EVENT_CHANCE = 0.23;

/** The country takes this many days to notice a new sail on its coast. */
const SETTLING_IN_DAYS = 6;

function nearWater(state: GameState): boolean {
  const here = state.world.tiles[key(state.party.at)];
  if (here?.river || here?.terrain === 'shore') return true;
  return neighbors(state.party.at).some((n) => state.world.tiles[key(n)]?.terrain === 'ocean');
}

/**
 * Exported so the first-run lessons can be triggered by the SAME vocabulary
 * real events use. "Woven into events, not tutorial screens" is a content
 * decision, and it only holds if the two share an interpreter — otherwise the
 * lessons drift into a second, parallel engine nobody maintains.
 */
export function conditionHolds(state: GameState, condition: Condition): boolean {
  const tile = state.world.tiles[key(state.party.at)];
  switch (condition.c) {
    case 'terrain':
      return tile !== undefined && condition.any.includes(tile.terrain);
    case 'season':
      return condition.any.includes(seasonOf(state.day));
    case 'dayMin':
      return state.day >= condition.day;
    case 'moraleMax':
      return state.party.morale <= condition.value;
    case 'flagUnset':
      return (state.flags[condition.flag] ?? 0) === 0;
    case 'flagSet':
      return (state.flags[condition.flag] ?? 0) > 0;
    case 'nearWater':
      return nearWater(state);
    case 'settled':
      return !!state.settlement;
    case 'atHome':
      return atHome(state);
    case 'foodMax':
      return state.party.food <= condition.value;
    case 'firewoodMax':
      return state.party.firewood <= condition.value;
    case 'sick':
      return sickCount(state) > 0;
    case 'anger':
      return angerLevel(state) >= condition.min;
    case 'goodwill':
      return goodwillLevel(state) >= condition.min;
    case 'unknown':
      return !knows(state, condition.lore);
    case 'known':
      return knows(state, condition.lore);
    case 'built':
      return state.settlement?.built.includes(condition.building) ?? false;
  }
}

export function isEligible(state: GameState, def: EventDef): boolean {
  if (def.once && (state.flags[`seen_${def.id}`] ?? 0) > 0) return false;
  return (def.when ?? []).every((c) => conditionHolds(state, c));
}

/** Probability that 2d6 + stat meets the DC. */
export function checkOdds(stat: number, dc: number): number {
  const need = dc - stat;
  if (need <= 2) return 1;
  if (need > 12) return 0;
  let ways = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= need) ways++;
  return ways / 36;
}

const STAT_LABEL: Record<keyof Stats, string> = {
  might: 'Might',
  wits: 'Wits',
  spirit: 'Spirit',
  craft: 'Craft',
};

/** Builds the player-facing card, with the odds spelled out. */
export function presentEvent(state: GameState, def: EventDef): ActiveEvent {
  return {
    id: def.id,
    title: def.title,
    body: def.body,
    choices: def.choices.map((choice) => {
      if (!choice.check) return { label: choice.label };
      const stat = bestStat(state.party.people, choice.check.stat) + bonus(state, 'check');
      const percent = Math.round(checkOdds(stat, choice.check.dc) * 100);
      return { label: choice.label, hint: `${STAT_LABEL[choice.check.stat]} · ${percent}%` };
    }),
  };
}

/**
 * Ground you can watch is ground where fewer things walk up on you. This is
 * what the defensibility score buys — quiet, which in a survival game is the
 * most valuable thing there is.
 */
export function eventChance(state: GameState): number {
  // The opening days are quiet on purpose: a new sail takes a few days to
  // be noticed, and a new player takes a few days to find their feet. The
  // same playtest that called the cards relentless was three days in.
  const noticed = Math.min(1, state.day / SETTLING_IN_DAYS);
  // Out on the road, what the party went out FOR changes how much finds them.
  const out = state.expedition;
  if (out) return BASE_EVENT_CHANCE * purposeDef(out.purpose).stir * noticed;
  if (!atHome(state)) return BASE_EVENT_CHANCE * noticed;
  const home = state.settlement!;
  // Ground you can watch, what you have raised on it, and people actually
  // watching. A palisade counts here because it reads through the effective
  // report, which is the point of building one.
  const defence = effectiveReport(state)?.defence ?? home.report.defence;
  const quiet = defence * 0.09 + home.watch * WATCH_QUIET;
  // A coast with a grievance against you is a busier coast. Quiet ground is
  // still quieter than loud ground, but it does not buy you peace you have
  // spent elsewhere.
  return BASE_EVENT_CHANCE * Math.max(0.15, 1 - quiet) * stirFactor(state) * noticed;
}

/** Rolls for an event after a travel action. Mutates the state clone. */
export function maybeFireEvent(state: GameState): void {
  if (state.end || state.event) return;
  const rng = stream(state.seed, 'events').derive(`fire:${state.day}:${key(state.party.at)}`);
  if (!rng.chance(eventChance(state))) return;

  const pool = EVENTS.filter((def) => isEligible(state, def));
  if (pool.length === 0) return;
  const def = rng.weighted(pool, (e) => e.weight);
  state.event = presentEvent(state, def);
}

function applyEffect(state: GameState, effect: Effect): void {
  const party = state.party;
  const rng = stream(state.seed, 'events').derive(`effect:${state.day}:${effect.t}`);

  switch (effect.t) {
    case 'food':
      party.food = Math.max(0, party.food + effect.n);
      break;
    case 'firewood':
      party.firewood = Math.max(0, party.firewood + effect.n);
      break;
    case 'morale':
      party.morale = Math.max(0, Math.min(100, party.morale + effect.n));
      break;
    case 'heal':
      for (const person of living(party.people)) {
        person.health = Math.min(person.maxHealth, person.health + effect.n);
      }
      break;
    case 'wound': {
      const victims = rng.shuffle(living(party.people)).slice(0, effect.count ?? 1);
      for (const person of victims) {
        person.health -= effect.n;
        if (person.health <= 0) {
          person.health = 0;
          person.alive = false;
          person.fate = 'a hard road';
          chronicle(state, `${person.name} ${person.byname} did not get up again.`, 'grim');
        }
      }
      break;
    }
    case 'injure': {
      const victim = rng.pick(living(party.people));
      if (victim) {
        victim.injuries.push({
          id: `inj_${state.nextId++}`,
          label: 'Wasting sickness',
          effect: { might: -1, spirit: -1 },
          heals: 14,
        });
      }
      break;
    }
    case 'kill': {
      const victim = rng.pick(living(party.people));
      if (victim) {
        victim.alive = false;
        victim.health = 0;
        victim.fate = 'the land';
        chronicle(state, `${victim.name} ${victim.byname} was lost.`, 'grim');
      }
      break;
    }
    case 'flag':
      state.flags[effect.flag] = (state.flags[effect.flag] ?? 0) + effect.n;
      break;
    case 'reveal':
      for (const h of range(state.party.at, effect.radius)) {
        const k = key(h);
        if (!state.world.tiles[k]) continue;
        if (hasLineOfSight(state.world, state.party.at, h)) {
          if (state.world.seen[k] !== 'visible') state.world.seen[k] = 'seen';
        }
      }
      break;
    case 'battle':
      // Queued, not started: the player reads the outcome first, and the
      // field only appears once they dismiss the card.
      state.flags['pendingBattle'] = 1;
      state.flags['pendingBattleDifficulty'] = effect.difficulty ?? 0;
      break;
    case 'raid':
      state.flags['pendingRaid'] = 1;
      state.flags['pendingBattleDifficulty'] = effect.difficulty ?? 0;
      break;
    case 'standing': {
      const who = effect.who === 'friendliest' ? friendliest(state) : angriest(state);
      if (who) shiftStanding(state, who.id, effect.n);
      break;
    }
    case 'learn':
      learn(state, effect.lore);
      break;
    case 'join':
      takeIn(state, effect.n ?? 1, effect.why);
      break;
  }
}

/** Resolves the chosen option, stashing the outcome for the player to read. */
export function chooseOption(state: GameState, index: number): void {
  const active = state.event;
  if (!active || active.outcome) return;

  // A feud is a card like any other to the player, but its choices are about
  // two named people rather than about the world.
  if (active.feud) {
    active.outcome = settleFeud(state, index);
    chronicle(state, active.outcome.text, active.outcome.good ? 'good' : 'grim');
    checkRunEnd(state, 1);
    return;
  }
  const def = eventById(active.id);
  const choice = def?.choices[index];
  if (!def || !choice) return;

  state.flags[`seen_${def.id}`] = 1;

  let good = true;
  if (choice.check) {
    // What the band knows counts on every card: a reckoning goes better when
    // somebody can point at what was actually agreed.
    const stat = bestStat(state.party.people, choice.check.stat) + bonus(state, 'check');
    const rng = stream(state.seed, 'events').derive(`check:${def.id}:${state.day}:${index}`);
    good = rng.roll(2, 6) + stat >= choice.check.dc;
  }

  const outcome = good ? choice.success : (choice.failure ?? choice.success);
  for (const effect of outcome.effects) applyEffect(state, effect);

  active.outcome = { text: outcome.text, good };
  chronicle(state, outcome.text, good ? 'good' : 'grim');
  checkRunEnd(state, 1);
}

/** Dismisses a resolved card, drawing steel first if the choice called for it. */
export function dismissEvent(state: GameState): void {
  if (!state.event?.outcome) return;
  delete state.event;

  const raiding = (state.flags['pendingRaid'] ?? 0) > 0;
  if (((state.flags['pendingBattle'] ?? 0) > 0 || raiding) && !state.end) {
    let difficulty = state.flags['pendingBattleDifficulty'] ?? 0;
    // Fighting at your own gate is easier: you know the ground, and there are
    // only so many ways in. A strong site is worth a whole enemy.
    const defence = effectiveReport(state)?.defence ?? 0;
    if (atHome(state) && defence >= 3) difficulty -= 1;
    delete state.flags['pendingBattle'];
    delete state.flags['pendingRaid'];
    delete state.flags['pendingBattleDifficulty'];

    if (raiding && state.settlement) {
      // Raiders bring what the place is worth taking.
      startRaid(state, difficulty + raidDifficulty(state));
    } else {
      const terrain = state.world.tiles[key(state.party.at)]?.terrain ?? 'meadow';
      startBattle(state, terrain, difficulty);
    }
  }
}

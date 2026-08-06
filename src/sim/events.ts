// Event engine. Interprets the data in data/events.ts: eligibility, weighted
// selection, stat checks with odds shown to the player, and effects.

import { key, neighbors, range } from '../hex';
import { stream } from '../rng';
import { EVENTS, eventById, type Condition, type Effect, type EventDef } from '../data/events';
import type { ActiveEvent, GameState, Stats } from '../state/types';
import { seasonOf } from './calendar';
import { startBattle } from './battleTurn';
import { hasLineOfSight } from './fog';
import { bestStat, living } from './people';
import { chronicle } from './saga';
import { checkRunEnd } from './upkeep';

/** Chance an event fires after a travel action. */
const BASE_EVENT_CHANCE = 0.28;

function nearWater(state: GameState): boolean {
  const here = state.world.tiles[key(state.party.at)];
  if (here?.river || here?.terrain === 'shore') return true;
  return neighbors(state.party.at).some((n) => state.world.tiles[key(n)]?.terrain === 'ocean');
}

function conditionHolds(state: GameState, condition: Condition): boolean {
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
    case 'nearWater':
      return nearWater(state);
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
      const stat = bestStat(state.party.people, choice.check.stat);
      const percent = Math.round(checkOdds(stat, choice.check.dc) * 100);
      return { label: choice.label, hint: `${STAT_LABEL[choice.check.stat]} · ${percent}%` };
    }),
  };
}

/** Rolls for an event after a travel action. Mutates the state clone. */
export function maybeFireEvent(state: GameState): void {
  if (state.end || state.event) return;
  const rng = stream(state.seed, 'events').derive(`fire:${state.day}:${key(state.party.at)}`);
  if (!rng.chance(BASE_EVENT_CHANCE)) return;

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
  }
}

/** Resolves the chosen option, stashing the outcome for the player to read. */
export function chooseOption(state: GameState, index: number): void {
  const active = state.event;
  if (!active || active.outcome) return;
  const def = eventById(active.id);
  const choice = def?.choices[index];
  if (!def || !choice) return;

  state.flags[`seen_${def.id}`] = 1;

  let good = true;
  if (choice.check) {
    const stat = bestStat(state.party.people, choice.check.stat);
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

  if ((state.flags['pendingBattle'] ?? 0) > 0 && !state.end) {
    const difficulty = state.flags['pendingBattleDifficulty'] ?? 0;
    delete state.flags['pendingBattle'];
    delete state.flags['pendingBattleDifficulty'];
    const terrain = state.world.tiles[key(state.party.at)]?.terrain ?? 'meadow';
    startBattle(state, terrain, difficulty);
  }
}

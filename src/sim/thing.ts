// Calling the Thing, and what comes of it.
//
// The endgame. Everything the run has built points here: winters from the
// calendar, a mead hall from the queue, quiet in the hall from 4.1, a coast
// that will speak for you from 4.3, rune-craft from 4.4 — and a feast, which
// is simply food.
//
// The claim is a roll, and the roll is shown before it is made. A player who
// walks into a 41% Thing and loses it walked in knowing.

import { wintersStood } from './calendar';
import { checkOdds } from './events';
import { FEUD_THRESHOLD } from '../data/feuds';
import {
  FEAST_FOOD,
  NEEDS,
  PROCLAIMED,
  REFUSED,
  THING_ANGER_MAX,
  THING_BASE,
  THING_COOLDOWN,
  THING_DC,
  THING_MERIT_CAP,
  SPEAKER_STANDING,
  THING_OPENING,
  WINTERS_TO_JARL,
  type NeedId,
} from '../data/thing';
import { stream } from '../rng';
import {
  TRIBUTE_EVERY,
  TRIBUTE_FLOOR,
  TRIBUTE_FOOD_PER,
  TRIBUTE_LINES,
  TRIBUTE_NONE,
  TRIBUTE_WOOD_PER,
} from '../data/jarl';
import type { GameState } from '../state/types';
import { angerLevel, friendliest, goodwillLevel } from './neighbours';
import { bonus } from './lore';
import { bestStat, fullName, living } from './people';
import { chronicle } from './saga';
import { atHome } from './site';
import { standsFor } from './colony';

export interface Need {
  id: NeedId;
  label: string;
  why: string;
  met: boolean;
}

/** True when nobody at home is still owed blood. */
export function houseAtPeace(state: GameState): boolean {
  return !state.grudges.some((g) => !g.settled && g.weight >= FEUD_THRESHOLD);
}

/** True when at least one place on the coast would send anyone at all. */
export function hasSpeakers(state: GameState): boolean {
  const best = friendliest(state);
  return !!best && best.found === true && best.standing >= SPEAKER_STANDING;
}

/**
 * The checklist, always readable — met or not. It is shown from the first
 * thaw onward, because a goal the player cannot see is a goal they cannot
 * work toward, which is the whole difference between an endgame and a timer.
 */
export function thingNeeds(state: GameState): Need[] {
  const home = state.settlement;
  const met: Record<NeedId, boolean> = {
    winters: wintersStood(state.day) >= WINTERS_TO_JARL,
    hall: standsFor(state, 'meadhall'),
    peace: houseAtPeace(state),
    friends: hasSpeakers(state),
    feast: state.party.food >= FEAST_FOOD,
    gathered: !!home && atHome(state) && !state.expedition,
  };
  return NEEDS.map((need) => ({ ...need, met: met[need.id] }));
}

export function thingReady(state: GameState): boolean {
  return thingNeeds(state).every((n) => n.met);
}

/** Days before the claim can be pressed again, or 0. */
export function thingCooldown(state: GameState): number {
  const last = state.flags['thingCalledOn'];
  if (last === undefined) return 0;
  return Math.max(0, THING_COOLDOWN - (state.day - last));
}

export function canCallThing(state: GameState): boolean {
  if (state.end || state.event || state.battle) return false;
  // A coast has one jarl. Once the Thing has carried there is nothing left
  // to put to it — what remains is holding what it granted.
  if (state.jarl) return false;
  return thingReady(state) && thingCooldown(state) === 0;
}

/** Winters held since the Thing carried. What the rule is actually worth. */
export function yearsRuled(state: GameState): number {
  if (!state.jarl) return 0;
  return Math.max(0, wintersStood(state.day) - wintersStood(state.jarl.since));
}

/**
 * Lays the rule down and closes the saga: the ending the proclamation used
 * to force. It is a CHOICE now, available from the deeds sheet for as long
 * as the jarldom stands — which is the whole of 6.4. An endgame that ends
 * the moment it is reached is a trophy; one you can go on living in is a
 * game, and the player is the only one who should decide which they want.
 */
export function layDownRule(state: GameState): boolean {
  if (!state.jarl || state.end || state.battle || state.event) return false;
  const years = yearsRuled(state);
  state.end = {
    cause: 'jarl',
    title: `${state.jarl.name}, Jarl of ${state.settlement?.name ?? 'that coast'}`,
    lines: [
      `On day ${state.jarl.since} the Thing carried it, and there was a jarl on that coast where there had been nobody.`,
      years > 0
        ? `${years} winters were held after it, and every one of them was held on purpose.`
        : `${wintersStood(state.day)} winters, and a hall full of people who came when they were called.`,
    ],
  };
  chronicle(state, `${state.jarl.name} laid the rule down, and the saga was closed.`, 'saga');
  return true;
}

/**
 * What the band brings to the case, as a single number added to 2d6.
 *
 * Every term is something the player did on purpose. Rune-craft is here
 * because being able to point at what was actually agreed is exactly what
 * wins an argument in front of a hall full of people.
 */
export function thingStanding(state: GameState): number {
  const merits =
    Math.floor(bestStat(state.party.people, 'spirit') / 2) +
    Math.floor(goodwillLevel(state) / 40) +
    Math.floor(state.party.morale / 40) +
    Math.min(2, Math.max(0, wintersStood(state.day) - WINTERS_TO_JARL)) +
    Math.min(2, state.settlement ? Math.floor(state.settlement.built.length / 3) : 0) +
    bonus(state, 'check');
  const anger = Math.min(THING_ANGER_MAX, Math.floor(angerLevel(state) / 40));
  // Merits are capped together; ill-will is not, and is taken off afterwards.
  // A coast you have wronged can pull down a claim nothing else could.
  return THING_BASE + Math.min(THING_MERIT_CAP, merits) - anger;
}

/** The odds, to be shown before the claim is made and never after. */
export function thingOdds(state: GameState): number {
  return checkOdds(thingStanding(state), THING_DC);
}

export interface ThingResult {
  proclaimed: boolean;
  text: string;
  /** The person the saga will name. */
  jarl?: string;
}

/**
 * Holds the Thing. Mutates; callers hold a clone. The feast is eaten either
 * way — that is the cost of asking, and it is why asking at 30% is a real
 * decision rather than a free reroll.
 */
export function callThing(state: GameState): ThingResult | null {
  if (!canCallThing(state)) return null;

  state.party.food = Math.max(0, state.party.food - FEAST_FOOD);
  state.flags['thingCalledOn'] = state.day;
  state.flags['thingsCalled'] = (state.flags['thingsCalled'] ?? 0) + 1;

  const speaker =
    living(state.party.people).reduce<(typeof state.party.people)[number] | undefined>(
      (best, p) => (!best || p.stats.spirit > best.stats.spirit ? p : best),
      undefined,
    );
  const name = speaker ? fullName(speaker) : 'whoever was left';

  const rng = stream(state.seed, 'events').derive(`thing:${state.day}`);
  const proclaimed = rng.roll(2, 6) + thingStanding(state) >= THING_DC;

  chronicle(state, THING_OPENING, 'saga');

  if (proclaimed) {
    const text = rng.derive('carried').pick(PROCLAIMED).replace(/\{name\}/g, name);
    chronicle(state, text, 'saga');
    // Proclaimed, and the run goes ON. Where this used to write the ending
    // and stop the game, it now grants the rule and leaves the closing to
    // the player — see layDownRule. A coast that has just been told who
    // lives on it starts behaving accordingly (sim/word.ts).
    state.jarl = { name, since: state.day };
    return { proclaimed: true, text, jarl: name };
  }

  const text = rng.derive('refused').pick(REFUSED);
  chronicle(state, text, 'grim');
  state.party.morale = Math.max(0, state.party.morale - 10);
  return { proclaimed: false, text };
}

// --- What ruling is worth ---

/**
 * The coast renders what is owed, once a season.
 *
 * The reward half of the jarldom, and until audit item 9 there was no reward
 * half at all: every single thing being proclaimed changed made the game
 * harder. A jarl is owed by the people who are glad he is there, and by
 * nobody else — a neighbour below `TRIBUTE_FLOOR` acknowledges the title and
 * sends nothing, which is what a coast does to a jarl it does not like.
 *
 * Deliberately paid out of STANDING, so the coast the player spent the whole
 * run building is the thing that pays for the endgame, and a jarldom won by
 * terrifying everybody is worth the title and not much else.
 */
export function renderTribute(state: GameState): boolean {
  if (!state.jarl || state.end || !state.settlement) return false;
  if ((state.day - state.jarl.since) % TRIBUTE_EVERY !== 0) return false;
  if (state.day === state.jarl.since) return false;

  let paid = 0;
  for (const n of state.neighbours) {
    if (!n.found || n.standing < TRIBUTE_FLOOR) continue;
    const over = n.standing - TRIBUTE_FLOOR;
    const food = Math.round(over * TRIBUTE_FOOD_PER);
    const wood = Math.round(over * TRIBUTE_WOOD_PER);
    if (food <= 0 && wood <= 0) continue;
    state.party.food += food;
    state.party.firewood += wood;
    paid += 1;
    const what = [food > 0 ? `${food} of food` : '', wood > 0 ? `${wood} of wood` : '']
      .filter(Boolean)
      .join(' and ');
    const line = stream(state.seed, 'events')
      .derive(`tribute:${n.id}:${state.day}`)
      .pick(TRIBUTE_LINES)
      .replace('{who}', n.name)
      .replace('{what}', `${what[0]!.toUpperCase()}${what.slice(1)}.`);
    chronicle(state, line, 'good');
  }

  if (paid === 0) chronicle(state, TRIBUTE_NONE, 'grim');
  return paid > 0;
}

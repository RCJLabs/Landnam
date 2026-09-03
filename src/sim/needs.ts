// The four things a steading needs, read off the state as plain numbers.
//
// Nothing here is new game logic — hunger, cold, wounds and heart all already
// bite in upkeep.ts. What this does is NAME them, so the panel can say which
// one is hurting and what would answer it. A build order that has to be looked
// up is not a build order that emerged from scarcity.

import { answersFor, type Answers, type BuildingDef } from '../data/buildings';
import type { GameState } from '../state/types';
import { effectsOn } from './calendar';
import { living } from './people';
import { dayLabour, shelterSaving } from './colony';
import { foodPerDay, firewoodPerNight } from './upkeep';

export type NeedId = 'food' | 'warmth' | 'rest' | 'heart';

export interface Need {
  id: NeedId;
  name: string;
  /** 0 = dire, 1 = comfortable. */
  level: number;
  /** One line naming the actual state of it. */
  line: string;
  /** The building need this maps to, for suggestions. */
  answers: Answers;
}

/** Days of food in hand at today's rate of eating, counting today's work. */
export function daysOfFood(state: GameState): number {
  const per = foodPerDay(state);
  if (per <= 0) return 99;
  const income = dayLabour(state).food;
  // Income counts, but only at its winter value — a stockpile that only holds
  // up while the fields are producing is not a stockpile.
  const net = Math.max(0.0001, per - income);
  return state.party.food / net;
}

/** Nights of fire in hand, after whatever roof there is. */
export function nightsOfFire(state: GameState): number {
  const per = Math.max(0.0001, firewoodPerNight(state) - shelterSaving(state));
  return state.party.firewood / per;
}

function band(value: number, comfortable: number): number {
  return Math.max(0, Math.min(1, value / comfortable));
}

export function readNeeds(state: GameState): Need[] {
  const people = living(state.party.people);
  const health =
    people.length === 0
      ? 0
      : people.reduce((sum, p) => sum + p.health / p.maxHealth, 0) / people.length;
  const winterAway = Math.max(0, 49 - state.day);

  const food = daysOfFood(state);
  const fire = nightsOfFire(state);

  return [
    {
      id: 'food',
      name: 'Food',
      // Enough to see out a winter is the only number that means anything.
      level: band(food, 30),
      line:
        food >= 90
          ? 'Stores enough and to spare.'
          : food >= 30
            ? `About ${Math.round(food)} days of eating in hand.`
            : food >= 8
              ? `Only ${Math.round(food)} days of eating left.`
              : 'We are down to what we can carry in one hand.',
      answers: 'food',
    },
    {
      id: 'warmth',
      name: 'Warmth',
      level: band(fire, Math.max(12, winterAway * 0.4)),
      line:
        fire >= 40
          ? 'Wood stacked past the eaves.'
          : fire >= 12
            ? `${Math.round(fire)} nights of fire by the door.`
            : fire >= 3
              ? `${Math.round(fire)} nights of fire, and no more.`
              : 'The stack is bare. We will feel this one.',
      answers: 'warmth',
    },
    {
      id: 'rest',
      name: 'Rest',
      level: health,
      line:
        health >= 0.9
          ? 'Everyone is on their feet and sound.'
          : health >= 0.6
            ? 'Some are carrying things that have not mended.'
            : health >= 0.3
              ? 'Half of us are in no state to work, let alone fight.'
              : 'We are a band of walking wounded.',
      answers: 'rest',
    },
    {
      id: 'heart',
      name: 'Heart',
      level: band(state.party.morale, 80),
      line:
        state.party.morale >= 70
          ? 'They talk about next year as though it is coming.'
          : state.party.morale >= 45
            ? 'Quiet, mostly. Nobody is singing.'
            : state.party.morale >= 20
              ? 'There is muttering, and it is not about the weather.'
              : 'They have stopped looking at each other.',
      answers: 'heart',
    },
  ];
}

/** Whichever need is worst. What the steading should be answering right now. */
export function worstNeed(state: GameState): Need {
  return readNeeds(state).reduce((worst, need) => (need.level < worst.level ? need : worst));
}

/**
 * What to build next, given what is hurting. Deliberately a suggestion and
 * not a rule — the player can queue anything they can afford.
 */
export function suggestedBuild(
  state: GameState,
  buildable: BuildingDef[],
): BuildingDef | undefined {
  const worst = worstNeed(state);
  const direct = buildable.find((b) => b.answers === worst.answers);
  if (direct) return direct;
  // Rest has no building of its own — a roof is what mends people.
  const roof = answersFor('warmth').find((b) => buildable.some((c) => c.id === b.id));
  if (worst.id === 'rest' && roof) return roof;
  // Winter coming and nothing pressing: safety and heart keep.
  return buildable[0];
}

/**
 * Why THIS building is the one flagged, in the steading's own words — or
 * nothing, when the flag is the arbitrary fallback `suggestedBuild` takes
 * once nothing is pressing, because a made-up reason for an arbitrary pick
 * is worse than no reason at all.
 *
 * 11.U2: the build list named cost and blockers and never worth, while the
 * panel already highlighted a `primary` row with nothing on screen saying
 * why. This reuses the exact sentence `readNeeds` already wrote for the
 * worst need — never a second copy of the claim — so the highlight can
 * never say something the rest of the panel would contradict.
 */
export function buildWorthLine(state: GameState, building: BuildingDef): string | undefined {
  const worst = worstNeed(state);
  if (building.answers === worst.answers) return worst.line;
  // The one indirect case `suggestedBuild` itself takes: rest has no
  // building of its own, so a roof stands in for it.
  if (worst.id === 'rest' && building.answers === 'warmth') {
    return 'A roof mends what the road cannot.';
  }
  return undefined;
}

/** Season-aware nudge for the panel: what the year is about to do to you. */
export function pressureLine(state: GameState): string {
  const untilWinter = Math.max(0, 49 - state.day);
  const food = daysOfFood(state);
  if (untilWinter > 0 && untilWinter <= 20) {
    return food < untilWinter + 24
      ? `Winter in ${untilWinter} days, and the stores will not reach spring.`
      : `Winter in ${untilWinter} days. The stores will hold, if nothing goes wrong.`;
  }
  if (effectsOn(state.day).forage < 0.5) {
    return 'Nothing is growing. What is in the store is what there is.';
  }
  return 'The days are long. What is made now is what there is later.';
}

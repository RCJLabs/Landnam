// Who comes, and who goes.
//
// The band has been six people for the whole game up to here, and that is the
// single fact behind every failed attempt to make the late game dangerous:
// six people with nothing else to do out-produce any burn that can be set, so
// nothing priced in food or firewood could threaten them. This is the other
// half — a band that can grow, and therefore a band that can be worth
// bleeding.
//
// Everyone who arrives arrives as a HAND. The warband is six and stays six
// (see SWORN_MAX): growth buys labour, never a wider shield wall.

import { worldBeat } from './beats';
import { bladeLeftBehind } from './heirloom';
import { stream } from '../rng';
import {
  DRAW_ANGER,
  DRAW_LARDER_DAYS,
  DRAW_MAX,
  SWORD_DEEDS,
  SWORD_MAX,
  WHY_SWORDS_COME,
  WHY_THEY_COME,
} from '../data/folk';
import { JARL_DRAW } from '../data/jarl';
import { wintersStood } from './calendar';
import { capacity } from './colony';
import { angerLevel, goodwillLevel } from './neighbours';
import { foodPerDay } from './upkeep';
import { SWORN_MAX, hands, living, makePerson, sworn } from './people';
import { chronicle } from './saga';
import type { GameState, Person } from '../state/types';

/** Morale at which a hand starts thinking about walking. */
export const LEAVING_MOOD = 25;

/** Chance per day a miserable hand actually goes. */
export const LEAVING_CHANCE = 0.12;

/** A hand who has been with the band this long has made their choice. */
export const SETTLED_IN = 30;

/** Beds going spare right now. Never negative. */
export function roomLeft(state: GameState): number {
  return Math.max(0, capacity(state) - living(state.party.people).length);
}

/**
 * How far past the roof a hall will let people crowd in before it truly has
 * to turn somebody away.
 *
 * THE LINE THAT MADE `crowding` MEAN ANYTHING, and it settles a disagreement
 * between two files that had both been deliberate about it.
 *
 * This one said "a hall with no spare bed turns people away, and that refusal
 * is the whole reason capacity exists", and had three bars saying so. But
 * sim/sickness.ts built its entire tradeoff on the other side of that line:
 * "taking in another pair of hands is more work done and one more chest by
 * the fire; past what the roof has room for, it is also how a bad week
 * becomes a bad winter."
 *
 * There was no past-what-the-roof-holds. Measured over sixty sagas to day
 * 400, `crowding` returned zero on EVERY settled day — not rarely, never —
 * and the tightest a hall ever got was exactly full, because the door shut at
 * the last bed. So `CROWD_BITE` multiplied nothing, spread ran at its floor,
 * and `CARE_GUARD` guarded a floor. A shipped mechanic sat behind a
 * precondition this file forbade.
 *
 * The roof is a COMFORT you build for now, not a gate that silently stops the
 * band growing. Three is the number who can sleep on the floor between the
 * benches, and it is small on purpose: the refusal is still real, a búð still
 * buys the difference between crowded and comfortable, and what has changed
 * is that being over the roof is a state the game can actually be in.
 */
export const OVER_ROOF = 3;

/** Beds plus floor: what a hall will actually admit before it says no. */
export function willAdmit(state: GameState): number {
  return Math.max(0, capacity(state) + OVER_ROOF - living(state.party.people).length);
}

/**
 * Takes people in, as many as there is room for.
 *
 * Returns the ones who actually joined, which may be fewer than asked for and
 * may be none — a hall with no spare bed turns people away, and that refusal
 * is the whole reason capacity exists. Mutates; callers hold a clone.
 *
 * `overRoof` is the one exception and it is narrow on purpose. Capacity turns
 * away people who WANDER IN: told there is no room, they walk on to somewhere
 * else, which is what makes building worth doing. People fetched from across
 * an ocean have nowhere else to walk to. They come in and they crowd, and
 * crowding is now a thing the body feels — see sim/sickness.ts. Passing this
 * is choosing that trade, not dodging the rule.
 */
export function takeIn(
  state: GameState,
  count: number,
  why: string,
  overRoof = false,
): Person[] {
  // `overRoof` is the voyage's door — people fetched from across an ocean
  // have nowhere else to walk to. Everyone else crowds in as far as the floor
  // allows and no further.
  const room = overRoof ? count : Math.min(count, willAdmit(state));
  if (room <= 0) return [];

  const rng = stream(state.seed, 'party').derive(`join:${state.day}:${state.nextId}`);
  const joined: Person[] = [];
  for (let i = 0; i < room; i += 1) {
    const person = makePerson(rng.derive(`${i}`), `p${state.nextId}`, 'hand');
    state.nextId += 1;
    person.joinedOn = state.day;
    // Nobody arrives delighted. They arrive because the alternative was worse.
    person.morale = 45;
    state.party.people.push(person);
    joined.push(person);
  }

  for (const person of joined) {
    worldBeat(state, { kind: 'joined', who: person.id, name: person.name });
  }
  const names = joined.map((p) => p.name).join(' and ');
  chronicle(state, `${names} ${joined.length > 1 ? 'came' : 'came'} to us: ${why}`, 'good');
  return joined;
}

/**
 * How likely somebody is to come asking today, 0..1.
 *
 * Deliberately built the way `thingStanding` is: every term is something the
 * player did on purpose, and the whole of it is readable back to them. A
 * steading draws people for standing on the coast, for having stood a while,
 * for being built, and for being a place with heart in it — and a coast that
 * wants you dead keeps them away, because nobody moves in next to a feud.
 *
 * The room and the larder are FLOORS rather than terms. A hall with nowhere
 * left to put anybody takes nobody however famous it is, and a mouth you
 * cannot feed is not growth, it is a slower way of starving.
 *
 * THE ROOM FLOOR IS `willAdmit`, NOT `roomLeft`, and the difference is what
 * makes `crowding` reachable at all. Lifting the cap inside `takeIn` was a
 * half-fix that changed nothing, because the door closes HERE: at a hall
 * exactly full `roomLeft` is nought, the odds are nought, and nobody ever
 * arrives to be crowded in. A gate behind a gate, and only the outer one was
 * ever visible.
 */
export function drawOdds(state: GameState): number {
  const home = state.settlement;
  if (!home || state.end) return 0;
  if (willAdmit(state) <= 0) return 0;
  if (state.party.food < foodPerDay(state) * DRAW_LARDER_DAYS) return 0;


  // What people can actually SEE from outside, in the order they would see
  // it. Plenty first and deliberately: it is the only term a band can move
  // in its first year, and the first cut of this had none — every other term
  // needs winters already stood, so growth only arrived long after it was
  // needed. Stockpiling now pays twice.
  //
  // Morale used to be the fourth term and has been dropped: it read 0.97 on
  // average across sixty sagas, which is not a term, it is a constant with a
  // sum wrapped round it.
  const larder = foodPerDay(state) * DRAW_LARDER_DAYS;
  const plenty = Math.min(1, (state.party.food - larder) / (larder * 2));
  const known = Math.min(1, goodwillLevel(state) / 60);
  const stood = Math.min(1, wintersStood(state.day) / 2);
  const raised = Math.min(1, home.built.length / 5);
  const draw = (plenty + known + stood + raised) / 4;
  const feared = Math.min(1, angerLevel(state) / 100) * DRAW_ANGER;
  // Men come to serve a name. This is also the game answering its own
  // escalation: being proclaimed adds three to word and two to raid fame, so
  // ruling brings harder men over the ridge, and it had better bring more
  // hands to meet them. Before audit item 9 it brought only the harder men.
  const rule = state.jarl ? JARL_DRAW : 1;
  return Math.max(0, DRAW_MAX * draw * (1 - feared) * rule);
}

/**
 * How likely a fighting man is to come looking for a share today, 0..1.
 *
 * The mirror of `drawOdds`, and deliberately fed by the things that shut
 * that one down. A hall draws settlers for being safe; a band draws swords
 * for being dangerous and for having taken something worth a share of. So
 * this rises with the coast's fear of you and with what you have actually
 * carried off — a band nobody has heard of, however rich, gets nobody.
 *
 * Gated on a GAP in the warband, because the shield wall is six and stays
 * six: this replaces men who have fallen, it never widens the line. That is
 * 6.2's rule kept, and the death spiral it caused removed — a raider who
 * loses four sworn a saga could not replace one of them, and ground to
 * nothing in ninety days while a turtle stood for a hundred and sixty.
 */
export function swordOdds(state: GameState): number {
  const home = state.settlement;
  if (!home || state.end) return 0;
  if (willAdmit(state) <= 0) return 0;
  if (sworn(state.party.people).length >= SWORN_MAX) return 0;
  if (state.party.food < foodPerDay(state) * DRAW_LARDER_DAYS) return 0;

  const feared = Math.min(1, angerLevel(state) / 60);
  const deeds = Math.min(1, state.tally.sackings / SWORD_DEEDS);
  // Both, not either: a frightening band with nothing to show for it is just
  // unpleasant, and a rich one nobody fears is a farm.
  return SWORD_MAX * feared * deeds;
}

/**
 * Somebody comes and asks, or does not. Rolled once a day, beside the raid.
 *
 * The symmetry is the point. `maybeRaid` has run every day since 3.5 and
 * nothing has ever run the other way, so the coast could only ever take
 * people off a band — and 6.2's whole apparatus for growing one sat unused
 * behind a door with nothing on the other side of it.
 */
export function maybeJoin(state: GameState): void {
  if (state.end || state.battle || state.event) return;
  const odds = drawOdds(state);
  if (odds <= 0) return;
  const rng = stream(state.seed, 'events').derive(`folk:${state.day}`);
  if (!rng.chance(odds)) return;
  takeIn(state, 1, rng.derive('why').pick(WHY_THEY_COME));
}

/**
 * A sword comes looking for a share, or does not. Rolled beside the other
 * door, because a coast that has stopped sending settlers has not stopped
 * sending people.
 */
export function maybeSword(state: GameState): void {
  if (state.end || state.battle || state.event) return;
  const odds = swordOdds(state);
  if (odds <= 0) return;
  const rng = stream(state.seed, 'events').derive(`sword:${state.day}`);
  if (!rng.chance(odds)) return;
  const joined = takeIn(state, 1, rng.derive('why').pick(WHY_SWORDS_COME));
  // He came to fight, and the wall has a gap in it. `takeIn` makes hands;
  // this is the one door that makes anything else.
  for (const person of joined) person.bond = 'sworn';
}

/**
 * Hands who have had enough, and go.
 *
 * The sworn never leave — that is what sworn means, and a warband that could
 * evaporate would make every fight a morale check before it was a fight.
 * Hands are another matter: they came because the alternative was worse, and
 * when it stops being worse they walk. A crowded hall in a bad winter is
 * exactly where that happens, which is what gives capacity its teeth.
 *
 * Someone who has been with the band a month has thrown their lot in and
 * stays, so a steading that gets through a bad patch keeps the people it
 * carried through it.
 */
export function handsLeave(state: GameState): Person[] {
  const rng = stream(state.seed, 'party').derive(`leave:${state.day}`);
  const gone: Person[] = [];

  for (const person of hands(state.party.people)) {
    if (person.morale > LEAVING_MOOD) continue;
    if (state.day - (person.joinedOn ?? 0) >= SETTLED_IN) continue;
    if (!rng.derive(person.id).chance(LEAVING_CHANCE)) continue;

    // Not dead — gone. `alive: false` keeps the upkeep honest (they are not
    // eating here any more); `left` keeps the saga honest.
    person.alive = false;
    person.left = true;
    person.fate = 'walked out one morning and did not come back';
    person.diedOn = state.day;
    gone.push(person);
  }

  for (const person of gone) {
    // The sword belongs to the band, not to the hand that had it. See
    // sim/heirloom.ts — this site never calls `mourn`, so without this the
    // blade would be stranded on somebody who has walked over the hill.
    bladeLeftBehind(state, person);
    worldBeat(state, { kind: 'left', who: person.id, name: person.name });
    chronicle(state, `${person.name} left us. Nobody went after ${person.name}.`, 'grim');
  }
  return gone;
}

// TRAVEL mode logic. Pure: (state, action) -> state. Every action costs at
// least a day, and the day is what kills you.

import { cloneState } from '../state/clone';
import { worldBeat } from './beats';
import { distance, key, line, neighbors, range, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import { terrainDef } from '../data/terrain';
import type { GameState, Person, Terrain } from '../state/types';
import { effectsOn } from './calendar';
import { revealAround, sightRadius } from './fog';
import { bestAt, effectiveStat, living } from './people';
import { chronicle } from './saga';
import { atHome, foundSettlement } from './site';
import { fieldCrew, permittedStep } from './expedition';
import { bargain, bargainBlocker, canFallOn, fallOn, neighbourById, seeNeighbours } from './neighbours';
import {
  placeById, sackBlocker, settlePlace, spotLandmarks, tellOfPlace, tradeAt, tradeBlocker,
} from './places';
import { placeKind } from '../data/places';
import { mendHull, strandTarget, STRAND_FEWER, STRAND_SHAKEN } from './sea';
import { sprung, unseaworthy } from './ship';
import { bonus } from './lore';
import { note } from './tally';
import { startBattle } from './battleTurn';
import { shakeNerve } from './morale';
import { callThing, layDownRule } from './thing';
import { THING_OPENING } from '../data/thing';
import { passDay } from './upkeep';

export type TravelAction =
  | { type: 'MOVE'; to: Hex }
  | { type: 'CAMP' }
  | { type: 'FORAGE' }
  | { type: 'HUNT' }
  | { type: 'FISH' }
  | { type: 'FOUND' }
  | { type: 'BARTER'; id: string }
  | { type: 'TRADE_AT'; id: string; offer: string }
  | { type: 'FALL_ON'; id: string }
  | { type: 'SACK_PLACE'; id: string }
  | { type: 'STRANDHOGG' }
  | { type: 'CALL_THING' }
  | { type: 'RULE_ON' }
  | { type: 'LAY_DOWN_RULE' };

/** Effort to row a hex of coastal water. The knarr is faster than legs. */
export const SEA_EFFORT = 2;

/** True where the knarr can go: water with a shore in sight. */
export function isCoastalWater(state: GameState, at: Hex): boolean {
  if (state.world.tiles[key(at)]?.terrain !== 'ocean') return false;
  return neighbors(at).some((n) => {
    const tile = state.world.tiles[key(n)];
    return tile !== undefined && tile.terrain !== 'ocean';
  });
}

/** The band is afloat. */
export function atSea(state: GameState): boolean {
  return state.world.tiles[key(state.party.at)]?.terrain === 'ocean';
}

/**
 * Effort to enter a hex, or null when it cannot be entered at all.
 *
 * The knarr came with the band and it did not rot on the beach: water is
 * crossable, but only water with land in sight. Coast-hugging is what a
 * knarr actually did, and it keeps the map a country to be walked rather
 * than a lake to be cut straight across.
 */
export function moveEffort(state: GameState, to: Hex): number | null {
  const tile = state.world.tiles[key(to)];
  if (!tile) return null;
  const penalty = effectsOn(state.day).travelPenalty;
  if (tile.terrain === 'ocean') {
    if (!isCoastalWater(state, to)) return null;
    // Nothing sound left in her: she floats and will not be rowed. The band
    // is never stuck by this — `isCoastalWater` only lets them float on water
    // that touches land, so the one hex ashore is always open.
    if (unseaworthy(state.ship)) return null;
    // A band that knows how a hull is meant to sit gets more out of a day on
    // the water. Never below one: a hex of sea is still a hex of sea.
    // A sprung strake costs her the same as `hullHoled` always did; the
    // second one costs it again, which is what makes a beating worse than a
    // scratch.
    const hurt = sprung(state.ship) * SEA_EFFORT;
    return Math.max(1, SEA_EFFORT + hurt + penalty - bonus(state, 'sea'));
  }
  const def = terrainDef(tile.terrain);
  if (!Number.isFinite(def.cost)) return null;
  let effort = def.cost + penalty;
  if (tile.river) effort += 1; // fording costs time and dry clothes
  return effort;
}

/** Days spent entering a hex. Two points of effort make a day. */
export function daysForMove(state: GameState, to: Hex): number | null {
  const effort = moveEffort(state, to);
  return effort === null ? null : Math.max(1, Math.ceil(effort / 2));
}

/**
 * Once the posts are in, the band lives at the steading and only a launched
 * expedition walks the map. Before that, everyone walks together.
 */
/**
 * How far a day's rowing carries the knarr along a coast.
 *
 * The whole reason the ship exists, and until this it did not exist at all.
 * A day's travel is `ceil(effort / 2)`, and with land at 1 or 2 and
 * `SEA_EFFORT` at 2, EVERY one of them rounded to a single day per hex —
 * the knarr was exactly as fast as walking over a meadow and no faster than
 * a forest, while the guide told the player it "rows coastal water faster
 * than legs walk". That was simply false, and it is why going out cost
 * twenty days and why raiding could not be a way of living.
 *
 * The day-cost model cannot express "faster" at this granularity, so the
 * hull covers GROUND instead: three hexes of coastal water in the day it
 * takes legs to cross one. Land movement is untouched.
 */
export const ROW_REACH = 3;

/** True if every hex between here and there is water we can row. */
function rowable(state: GameState, from: Hex, to: Hex): boolean {
  if (!isCoastalWater(state, from) || !isCoastalWater(state, to)) return false;
  for (const step of line(from, to)) {
    if (!isCoastalWater(state, step)) return false;
  }
  return true;
}

export function canMove(state: GameState, to: Hex): boolean {
  if (state.settlement && !state.expedition) return false;
  if (!permittedStep(state, to)) return false;
  if (moveEffort(state, to) === null) return false;
  const span = distance(state.party.at, to);
  if (span === 1) return true;
  // Afloat, a day is worth three hexes of open coast rather than one.
  return span <= ROW_REACH && rowable(state, state.party.at, to);
}

/** Hexes the party could step into right now. */
export function moveOptions(state: GameState): Hex[] {
  if (state.settlement && !state.expedition) return [];
  const steps = neighbors(state.party.at).filter(
    (h) => moveEffort(state, h) !== null && permittedStep(state, h),
  );
  if (!isCoastalWater(state, state.party.at)) return steps;
  // A hull under way. Every stretch of coast within a day's rowing, so the
  // player is offered the thing the ship is FOR rather than one hex at a
  // time.
  const reach = new Map<string, Hex>();
  for (const h of steps) reach.set(key(h), h);
  for (const h of range(state.party.at, ROW_REACH)) {
    if (reach.has(key(h))) continue;
    if (moveEffort(state, h) === null || !permittedStep(state, h)) continue;
    if (!rowable(state, state.party.at, h)) continue;
    reach.set(key(h), h);
  }
  return [...reach.values()];
}

/** Water worth putting a net in, from where we are standing (or floating). */
function fishableWater(state: GameState): boolean {
  const here = state.world.tiles[key(state.party.at)];
  if (!here) return false;
  if (here.river || here.terrain === 'shore' || here.terrain === 'ocean') return true;
  return neighbors(state.party.at).some((n) => state.world.tiles[key(n)]?.terrain === 'ocean');
}

function actionRng(state: GameState, label: string) {
  return stream(state.seed, 'events').derive(`${label}:${state.day}`);
}

function reveal(state: GameState): void {
  const effects = effectsOn(state.day);
  revealAround(
    state.world,
    state.party.at,
    sightRadius(state.world, state.party.at, effects.sight),
  );
  // Somebody else's smoke shows up the moment the ground it stands on does.
  seeNeighbours(state);
  // And from a ridge, the things a country is navigated by — a town, a
  // monastery, a wreck — are picked out far past the ground itself.
  spotLandmarks(state);
}

/** How many entries back the chronicle remembers saying a thing. */
const ECHO = 4;

/**
 * Picks a line the chronicle has not used lately.
 *
 * Picking blind from a pool of four repeats inside three days about half the
 * time, and a quiet stretch of travel is exactly when the log is the only
 * thing moving on screen — so the repeat reads as a stutter in the writing
 * rather than as a quiet week. Falls back to the whole pool once everything
 * in it is recent, because a repeat beats saying nothing.
 */
function fresh(state: GameState, rng: Rng, pool: string[]): string {
  const recent = new Set(state.saga.slice(-ECHO).map((entry) => entry.text));
  const unused = pool.filter((line) => !recent.has(line));
  return rng.pick(unused.length > 0 ? unused : pool);
}

/**
 * Marching lines. A chronicle that says "we moved on into forest" six days
 * running is worse than saying nothing, so the phrasing varies and leans on
 * whether the ground underfoot actually changed.
 */
function marchLine(
  state: GameState,
  terrain: Terrain,
  days: number,
  changedGround: boolean,
  fromSea: boolean,
): string {
  const ground = terrainDef(terrain).name.toLowerCase();
  const rng = actionRng(state, `march:${terrain}`);

  // A day under oars is not a day's walking, and saying so is most of what
  // makes the coast feel like a coast. Eight lines, not four: the wider
  // worlds have real stretches of water now, and a pool the same size as
  // the echo window stutters the moment a voyage outlasts it — the exact
  // failure the land pool was widened for.
  if (terrain === 'ocean') {
    return fresh(state, rng, [
      'We put the knarr in the water and rowed the coast until the light went.',
      'A day on the water, with the land always on one hand.',
      'We worked along the shore under oars. It was faster than walking and colder.',
      'The sail took what wind there was and we made good water.',
      'Grey sea, grey sky, and the stroke counted out until nobody was counting.',
      'A seal watched us the whole morning and left when the rain came.',
      'The oars traded hands at midday and the coast went by like a told story.',
      'Salt in everything by evening. Nobody complained where the others could hear.',
    ]);
  }
  if (fromSea) {
    return fresh(state, rng, [
      `We ran the keel up and stepped out into ${ground}.`,
      `We came ashore on ${ground} and dragged the boat up past the tide.`,
      `The water shallowed and we walked her in. ${ground.charAt(0).toUpperCase()}${ground.slice(1)}, and dry feet.`,
      `The keel took the sand and we were glad of ${ground} under us.`,
      `We beached her below ${ground} and stretched legs that had forgotten walking.`,
    ]);
  }

  if (days > 1) {
    return fresh(state, rng, [
      `It took us ${days} days to cross into ${ground}.`,
      `${days} days of hard going, and ${ground} at the end of it.`,
      `We were ${days} days on that stretch. The ${ground} did not hurry for us.`,
    ]);
  }
  if (changedGround) {
    return fresh(state, rng, [
      `We came down into ${ground} before dark.`,
      `The ground turned to ${ground} by afternoon.`,
      `We walked out of one country and into ${ground}.`,
      `By evening we were in ${ground}.`,
    ]);
  }
  // The pool a quiet stretch draws from, and the longest one here on purpose.
  // Four lines was enough to avoid a literal repeat and not enough to avoid
  // sounding like one: three consecutive days of "we kept walking / another
  // day of the same / we made what distance we could" are three different
  // sentences saying one thing. These are deliberately about different things
  // — the light, the feet, the weather, what nobody said — so a quiet week
  // reads as a week rather than as one line stuttering. Eight of them against
  // an ECHO of 4 means a fortnight of dull country never says the same thing
  // twice running.
  return fresh(state, rng, [
    'We kept walking. The country did not change.',
    'Another day of the same ground.',
    'We made what distance we could.',
    'We walked from first light and camped where the light left us.',
    'Nothing came at us and nothing was said worth writing.',
    'The weather held, which was the best that could be said for it.',
    'Our feet were the only thing that changed, and not for the better.',
    'We went on. There is no other word for a day like that one.',
  ]);
}

/**
 * Gathering is for the road. On your own ground the steading's assigned work
 * IS the day's work, and letting the party forage on top of it paid the same
 * six people twice — enough firewood to make winter a formality.
 */
export function canGather(state: GameState): boolean {
  // Nothing grows on water either. At sea the nets are the only larder.
  return !atHome(state) && !atSea(state);
}

/** Fishing is the one thing a boat is better at than a beach. */
export function canFish(state: GameState): boolean {
  return !atHome(state) && fishableWater(state);
}

/** Whoever is on the map right now: the expedition, or the whole band. */
export function roadCrew(state: GameState): Person[] {
  return fieldCrew(state);
}

interface Gather {
  amount: number;
  scout?: Person;
}

/** Shared yield maths for forage/hunt/fish. */
function gather(
  state: GameState,
  base: number,
  stat: 'wits' | 'might',
  label: string,
): Gather {
  const effects = effectsOn(state.day);
  const scout = bestAt(fieldCrew(state), stat);
  const skill = scout ? effectiveStat(scout, stat) : 1;
  const rng = actionRng(state, label);
  const roll = rng.float(0.7, 1.3);
  const amount = Math.max(0, Math.round(base * effects.forage * (0.6 + skill * 0.16) * roll));
  return scout ? { amount, scout } : { amount };
}

function advance(state: GameState, days: number): void {
  for (let i = 0; i < days; i++) {
    if (!passDay(state)) return;
  }
}

export function applyTravel(prev: GameState, action: TravelAction): GameState {
  if (prev.end || prev.event) return prev;
  const state = cloneState(prev);
  const party = state.party;

  switch (action.type) {
    case 'MOVE': {
      if (!canMove(state, action.to)) return prev;
      const days = daysForMove(state, action.to)!;
      const tile = state.world.tiles[key(action.to)]!;
      const wasOn = state.world.tiles[key(party.at)]?.terrain;
      const changedGround = wasOn !== tile.terrain;
      const fromSea = wasOn === 'ocean' && tile.terrain !== 'ocean';
      const cameFrom = prev.party.at;
      party.at = action.to;
      party.hasCamped = false;
      // Remember the route, not just the view: the map draws where we walked.
      const there = key(action.to);
      if (state.world.trod[there] === undefined) state.world.trod[there] = state.day;
      if (tile.terrain === 'ocean') note(state, 'seaDays', days);
      advance(state, days);
      if (state.end) return state;
      reveal(state);
      worldBeat(state, {
        kind: 'marched',
        from: cameFrom,
        to: action.to,
        days,
        terrain: tile.terrain,
        ...(tile.terrain === 'ocean' ? { bySea: true as const } : {}),
      });
      chronicle(state, marchLine(state, tile.terrain, days, changedGround, fromSea));
      return state;
    }

    case 'CAMP': {
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const rng = actionRng(state, 'camp');
      const hands = fieldCrew(state).length;
      const home = atHome(state);
      const afloat = atSea(state);
      // At home the woodcutters have already been counted; camping there is
      // rest, not a second day's felling. At sea there is nothing to cut.
      const wood =
        home || afloat
          ? 0
          : Math.max(0, Math.round(def.wood * (0.5 + hands * 0.18) * rng.float(0.8, 1.2)));
      party.firewood += wood;
      party.hasCamped = true;

      // A night on a beach is when a sprung strake gets seen to. Part of the
      // night's work, not a new verb — see sim/sea.ts.
      if (!afloat) mendHull(state);

      // Rest mends bodies, but only on a full stomach — and a roof of your own
      // mends them faster than a night under a cloak.
      const fed = party.food > 0;
      const mend = fed ? (home ? 4 : 2) : 0;
      // Resting mends whoever is resting: the party on the road, or everyone
      // if there is no steading yet.
      for (const person of home ? living(party.people) : fieldCrew(state)) {
        person.health = Math.min(person.maxHealth, person.health + mend);
      }
      party.morale = Math.min(100, party.morale + (fed ? (home ? 7 : 5) : 1));

      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        home
          ? `We rested at ${state.settlement!.name}, and the work went on around us.`
          : afloat
            ? 'We lay at anchor in the lee of the land and slept in the boat.'
            : wood > 0
              ? `We made camp and cut ${wood} of firewood.`
              : 'We made camp. There was nothing here worth burning.',
        'plain',
      );
      return state;
    }

    case 'FORAGE': {
      if (!canGather(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const { amount, scout } = gather(state, def.forage, 'wits', 'forage');
      party.food += amount;
      worldBeat(state, {
        kind: 'gathered',
        how: 'forage',
        got: amount,
        ...(scout ? { who: scout.id } : {}),
      });
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0
          ? `${scout ? scout.name : 'We'} came back with ${amount} of roots and berries.`
          : 'We searched all day and found nothing worth carrying.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }

    case 'HUNT': {
      if (!canGather(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const { amount, scout } = gather(state, def.hunt, 'wits', 'hunt');
      party.food += amount;
      worldBeat(state, {
        kind: 'gathered',
        how: 'hunt',
        got: amount,
        ...(scout ? { who: scout.id } : {}),
      });
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0
          ? `${scout ? scout.name : 'We'} brought down game enough for ${amount}.`
          : 'We followed tracks all day and came back with empty hands.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }

    case 'FOUND': {
      // Setting the posts is a day's work like any other, and the last time
      // this choice will be offered.
      if (!foundSettlement(state)) return prev;
      worldBeat(state, {
        kind: 'founded',
        at: state.settlement!.at,
        name: state.settlement!.name,
      });
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'BARTER': {
      if (bargainBlocker(state, action.id) !== null) return prev;
      const host = neighbourById(state, action.id);
      if (!bargain(state, action.id)) return prev;
      // A bargain pays twice. Timber into the packs, and whatever they were
      // willing to say about the coast while it was being weighed — which
      // is the only road into the plunder economy a settled band has, the
      // fixed places being things you must first KNOW OF to walk to.
      if (host) tellOfPlace(state, host.at, host.name);
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'TRADE_AT': {
      // A day at a counter, and the day is spent either way — same as a
      // bargain in somebody's yard, because standing about being useful is
      // still standing about.
      if (tradeBlocker(state, action.id, action.offer) !== null) return prev;
      if (!tradeAt(state, action.id, action.offer)) return prev;
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    case 'FALL_ON': {
      // The day is spent whether or not it goes well, and the fight begins
      // before the day turns — you do not get to sleep on the decision.
      const difficulty = canFallOn(state, action.id) ? fallOn(state, action.id) : null;
      if (difficulty === null) return prev;
      const ground = state.world.tiles[key(party.at)]?.terrain ?? 'meadow';
      // The camp is the stake: win the field and their stores come home.
      startBattle(state, ground, difficulty, { campId: action.id });
      return state;
    }

    case 'SACK_PLACE': {
      // A guarded place is a fight first and a payoff after — the settling-up
      // happens when the field is won (see leaveBattle). An unguarded one is
      // a day's work, taken on the spot.
      if (sackBlocker(state, action.id) !== null) return prev;
      const place = placeById(state, action.id)!;
      const def = placeKind(place.kind);
      if (def.garrison !== null) {
        const ground = state.world.tiles[key(party.at)]?.terrain ?? 'meadow';
        startBattle(state, ground, def.garrison, { placeId: action.id });
        return state;
      }
      settlePlace(state, action.id);
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      return state;
    }

    // The ship's way in. Same place, taken off the water: they are lighter
    // and shaken, the hold takes more, and losing costs the cargo and the
    // hull. See sim/sea.ts.
    case 'STRANDHOGG': {
      const mark = strandTarget(state);
      if (!mark) return prev;
      const def = placeKind(mark.kind);
      const ground = state.world.tiles[key(mark.at)]?.terrain ?? 'shore';
      startBattle(state, ground, Math.max(0, (def.garrison ?? 1) - STRAND_FEWER), {
        placeId: mark.id,
      });
      if (state.battle) {
        state.battle.strandhogg = true;
        // Caught between the water and their own gate. Shaken, not fewer
        // again — the count is already the surprise, this is the nerve.
        for (const c of state.battle.combatants) {
          if (c.side === 'foe') shakeNerve(state, c, STRAND_SHAKEN);
        }
        state.battle.log.push('They had not thought to watch the water.');
      }
      return state;
    }

    case 'CALL_THING': {
      // Three days of people arriving, and the case put on the last of them.
      const result = callThing(state);
      if (!result) return prev;
      advance(state, 3);
      if (state.end) return state;
      reveal(state);
      // A claim carried grants the rule and leaves the run running — the
      // proclamation card is what asks whether to close the saga here (see
      // render/cards.ts). A claim refused has to be READ, or three days and
      // a feast vanish into the log with nothing on screen to show for them.
      if (!result.proclaimed && !state.event) {
        state.event = {
          id: 'thing',
          title: 'The Thing',
          body: THING_OPENING,
          choices: [],
          outcome: { text: result.text, good: false },
        };
      }
      return state;
    }

    // The two answers to the proclamation. Ruling on costs no day and only
    // marks the card as read; laying it down writes the ending the Thing
    // used to write for you.
    case 'RULE_ON': {
      if (!state.jarl || state.flags['ruleTaken'] !== undefined) return prev;
      state.flags['ruleTaken'] = state.day;
      return state;
    }

    case 'LAY_DOWN_RULE': {
      if (!layDownRule(state)) return prev;
      return state;
    }

    case 'FISH': {
      // Deliberately not gated on canGather: the sea is where the fish are.
      if (!canFish(state)) return prev;
      const here = state.world.tiles[key(party.at)]!;
      const def = terrainDef(here.terrain);
      const base = Math.max(def.fish, here.river ? 3 : 0, 2);
      const { amount } = gather(state, base, 'wits', 'fish');
      party.food += amount;
      worldBeat(state, { kind: 'gathered', how: 'fish', got: amount });
      advance(state, 1);
      if (state.end) return state;
      reveal(state);
      chronicle(
        state,
        amount > 0 ? `The nets came up with ${amount} of fish.` : 'The nets came up empty.',
        amount > 0 ? 'plain' : 'grim',
      );
      return state;
    }
  }
}

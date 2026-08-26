// The road: what a hex costs to enter, over ground or along a coast, what
// every day of travelling does whichever verb spent it, and what the
// chronicle says about a day's going. The verbs themselves live in
// travel.ts and gathering.ts; they all walk through here.

import { distance, key, line, neighbors, range, type Hex } from '../hex';
import { stream, type Rng } from '../rng';
import { terrainDef } from '../data/terrain';
import type { GameState, Terrain } from '../state/types';
import { effectsOn } from './calendar';
import { onHighGround, revealAround, sightRadius } from './fog';
import { chronicle, fresh } from './saga';
import { permittedStep } from './expedition';
import { seeNeighbours } from './neighbours';
import { spotLandmarks } from './places';
import { sprung, unseaworthy } from './ship';
import { meetRival } from './rival';
import { keepsBearings, spotFixedPoints } from './landmark';
import { WAY_EFFORT, WAY_REACH, madeWay, wayable } from './ways';
import { weatherOn } from './weather';
import { bonus } from './lore';
import { passDay } from './upkeep';
import { COAST_IS_A_LINE } from './flags';
import { onHeights } from './coast';

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

/**
 * Open sea: ocean the knarr cannot work, because no shore is in sight of it.
 *
 * The map draws depth from THIS, so what looks like open water and what the
 * band is refused are one fact in one place. They used to be two readings in
 * two files — the renderer asked "is every neighbour ocean?", the sim asked
 * "is any neighbour land?" — and they disagreed wherever the tiles run out at
 * the world's rim: an off-map neighbour is not ocean, so the map drew coastal
 * water, and it is not land either, so the sim refused the crossing. 1332 of
 * 2866 shallow-drawn hexes were shut like that, the whole perimeter of the
 * world, and nothing in the game said why.
 */
export function deepOcean(state: GameState, at: Hex): boolean {
  if (state.world.tiles[key(at)]?.terrain !== 'ocean') return false;
  return !isCoastalWater(state, at);
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
  const sky = weatherOn(state.seed, state.day);
  const penalty = effectsOn(state.day).travelPenalty + sky.travel;
  if (tile.terrain === 'ocean') {
    // A gale shuts the sea. Note what this does NOT block: the target being
    // ocean is the test, so a band already afloat can always row the one hex
    // ASHORE — the same rule that keeps an unseaworthy hull from ending a run
    // on the water. Weather may cost a voyage; it may not eat a saga.
    if (sky.shutsTheSea) return null;
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
  // A way the band cut walks like a meadow, and the ford it laid means the
  // river costs nothing either. The weather still bites — a road in a gale
  // is a road in a gale — so only the GROUND's share is bought off.
  if (madeWay(state, to)) return Math.max(1, WAY_EFFORT + penalty);
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

/**
 * Once the posts are in, the band lives at the steading and only a launched
 * expedition walks the map. Before that, everyone walks together.
 */
export function canMove(state: GameState, to: Hex): boolean {
  if (state.settlement && !state.expedition) return false;
  if (!permittedStep(state, to)) return false;
  if (moveEffort(state, to) === null) return false;
  const span = distance(state.party.at, to);
  // Standing still is not a move. Afloat this was ACCEPTED — `rowable` is
  // trivially true from a hex to itself, so the band could spend a day
  // rowing nowhere in 32 of 35 afloat states measured. Nothing offered it
  // until the map started drawing the knarr's true reach, which is how a
  // ten-year-old trap surfaced: the day was real and the distance was zero.
  if (span === 0) return false;
  if (span === 1) return true;
  // Along a way the band cut, a day is worth two hexes rather than one —
  // which is the only thing that makes cutting one worth the days it costs.
  if (span <= WAY_REACH && wayable(state, state.party.at, to)) return true;
  // Afloat, a day is worth three hexes of open coast rather than one.
  return span <= ROW_REACH && rowable(state, state.party.at, to);
}

/** Hexes the party could step into right now. */
export function moveOptions(state: GameState): Hex[] {
  if (state.settlement && !state.expedition) return [];
  const steps = neighbors(state.party.at).filter(
    (h) => moveEffort(state, h) !== null && permittedStep(state, h),
  );
  if (!isCoastalWater(state, state.party.at)) {
    // Standing on a way the band cut: the map has to offer what the road is
    // FOR, or it is invisible exactly like the knarr's reach used to be.
    if (!madeWay(state, state.party.at)) return steps;
    const along = new Map<string, Hex>();
    for (const h of steps) along.set(key(h), h);
    for (const h of range(state.party.at, WAY_REACH)) {
      if (key(h) === key(state.party.at)) continue;
      if (along.has(key(h))) continue;
      if (moveEffort(state, h) === null || !permittedStep(state, h)) continue;
      if (!wayable(state, state.party.at, h)) continue;
      along.set(key(h), h);
    }
    return [...along.values()];
  }
  // A hull under way. Every stretch of coast within a day's rowing, so the
  // player is offered the thing the ship is FOR rather than one hex at a
  // time.
  const reach = new Map<string, Hex>();
  for (const h of steps) reach.set(key(h), h);
  for (const h of range(state.party.at, ROW_REACH)) {
    // `range` includes its own centre; the band is already there.
    if (key(h) === key(state.party.at)) continue;
    if (reach.has(key(h))) continue;
    if (moveEffort(state, h) === null || !permittedStep(state, h)) continue;
    if (!rowable(state, state.party.at, h)) continue;
    reach.set(key(h), h);
  }
  return [...reach.values()];
}

/**
 * Every travel verb's dice, one per day per label, off the EVENTS stream —
 * not to be confused with the combat `actionRng` in swing.ts. Exported for
 * the same reason that one is: the verbs are split across files now, and a
 * verb deriving its own stream would silently fork the replay.
 */
export function actionRng(state: GameState, label: string): Rng {
  return stream(state.seed, 'events').derive(`${label}:${state.day}`);
}

/** What dusk shows: the ground, somebody's smoke, and the far landmarks. */
export function reveal(state: GameState): void {
  const effects = effectsOn(state.day);
  // Fog and gales close the country in. Never below one: a band can always
  // see the ground it is standing on.
  //
  // Unless they know where they are. A fixed point does not give a crew
  // longer eyes — it gives them their bearings — so beside a landmark the
  // SKY's penalty is cancelled and nothing else about sight moves. That is
  // what wayfinding buys, and it is why climbing a ridge to mark the Split
  // Rock is worth the day it costs.
  // A line has no fog to lift and no radius to lift it over — a coast is
  // walked, not surveyed, and `world.seen` is a hex map's memory. Sight
  // still costs something there, but it costs it in what can be picked out
  // from a height, which is the block below.
  if (!COAST_IS_A_LINE) {
    const sky = weatherOn(state.seed, state.day).sight;
    const weather = keepsBearings(state) ? Math.max(0, sky) : sky;
    const sight = Math.max(1, effects.sight + weather);
    revealAround(
      state.world,
      state.party.at,
      sightRadius(state.world, state.party.at, sight),
    );
  }
  // Somebody else's smoke shows up the moment the ground it stands on does —
  // and on a line, the moment you walk onto the stretch they live on. Both
  // rules live inside these two, so neither is gated on the fog any more:
  // hanging `meetRival` off the hex sight pass left the other landnamsmadr
  // unmeetable on a coast, which is a mechanic deleted rather than converted.
  seeNeighbours(state);
  meetRival(state);
  // From a ridge, the things a country is navigated by — a town, a
  // monastery, a wreck — are picked out far past the ground itself.
  spotLandmarks(state);
  // The natural ones too, and those are the ones a coast is remembered by.
  if (COAST_IS_A_LINE ? onHeights(state) : onHighGround(state.world, state.party.at)) {
    for (const found of spotFixedPoints(state, state.party.at)) {
      chronicle(
        state,
        `From the high ground we made out ${found.name}, and took our bearings off it.`,
        'plain',
      );
    }
  }
}

/** Spends whole days, stopping the moment one of them ends the run. */
export function advance(state: GameState, days: number): void {
  // A sail is a surprise for exactly as long as nobody has looked at it.
  // Cleared HERE rather than in each verb, because every way of spending a
  // day goes through this one function and a surprise that survived a night
  // ashore would not be one. `WALK` sets it again after it advances.
  state.party.bySea = undefined;
  for (let i = 0; i < days; i++) {
    if (!passDay(state)) return;
  }
}

/**
 * Marching lines. A chronicle that says "we moved on into forest" six days
 * running is worse than saying nothing, so the phrasing varies and leans on
 * whether the ground underfoot actually changed.
 */
export function marchLine(
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

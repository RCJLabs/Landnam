// The road: what every day of travelling does whichever verb spent it, and
// what the chronicle says about a day's going. The verbs themselves live in
// travel.ts and gathering.ts; they all walk through here.
//
// This also held what a HEX cost to enter — `moveEffort`, `daysForMove`,
// `canMove`, `moveOptions`, and the coast-hugging rule that let a knarr cross
// water with land in sight. All of it went with the map in 8.5: a route is
// walked between stops, and `sim/coast.ts` prices the legs.

import { stream, type Rng } from '../rng';
import { terrainDef } from '../data/terrain';
import type { GameState, Terrain } from '../state/types';
import { chronicle, fresh } from './saga';
import { seeNeighbours } from './neighbours';
import { spotLandmarks } from './places';
import { meetRival } from './rival';
import { spotFixedPoints } from './landmark';
import { passDay } from './upkeep';
import { onHeights } from './coast';

/**
 * The band is afloat.
 *
 * Not a place any more: a route has no water to float on, because rowing is a
 * step and not a state. What it answers is HOW THEY GOT HERE — a day at the
 * oars arrives with a sail nobody was watching for, and it lasts exactly one
 * day, because `advance` clears it. See `Party.bySea`.
 */
export function atSea(state: GameState): boolean {
  return state.party.bySea === true;
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
  // A line has no fog to lift and no radius to lift it over: a coast is
  // walked, not surveyed. Sight still costs something, but it costs it in
  // what can be picked out from a height, which is the block below.
  //
  // Somebody else's smoke shows up the moment you walk onto the stretch they
  // live on, so neither of these is gated on sight: hanging `meetRival` off
  // the hex sight pass left the other landnamsmadr unmeetable on a coast,
  // which is a mechanic deleted rather than converted.
  seeNeighbours(state);
  meetRival(state);
  // From a ridge, the things a country is navigated by — a town, a
  // monastery, a wreck — are picked out far past the ground itself.
  spotLandmarks(state);
  // The natural ones too, and those are the ones a coast is remembered by.
  if (onHeights(state)) {
    for (const found of spotFixedPoints(state)) {
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

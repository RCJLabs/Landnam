// The wind, read off the game state. Pure: (state) -> AmbienceProfile.
//
// One continuous voice rather than a cue, because weather is not an event —
// it is the thing everything else happens inside. Keeping the decision pure
// means "winter on an open shore is harsher than summer in a forest" is a
// test rather than a hope.

import { key } from '../hex';
import { currentMode } from '../modes';
import { seasonOf } from '../sim/calendar';
import { AMBIENCE_INDOORS, type AmbienceProfile } from '../data/sounds';
import type { GameState, Season, Terrain } from '../state/types';

/**
 * How much air each kind of ground has moving through it.
 *
 * `open` lifts the filter, so the bed hisses rather than rumbles — that is
 * what exposure sounds like. `stir` is how restless it is. Forest is the
 * interesting one: plenty of movement, but the trees take the top off it.
 */
const GROUND: Record<Terrain, { open: number; stir: number }> = {
  ocean: { open: 1, stir: 1 },
  shore: { open: 0.9, stir: 0.85 },
  meadow: { open: 0.6, stir: 0.5 },
  valley: { open: 0.45, stir: 0.4 },
  forest: { open: 0.25, stir: 0.55 },
  bog: { open: 0.5, stir: 0.3 },
  hills: { open: 0.75, stir: 0.7 },
  mountains: { open: 0.85, stir: 0.9 },
};

/** What each season does to the air. Winter is the loud one, and should be. */
const SEASONS: Record<Season, { open: number; stir: number; gain: number }> = {
  summer: { open: 0.8, stir: 0.7, gain: 0.75 },
  autumn: { open: 1, stir: 1, gain: 0.95 },
  winter: { open: 1.25, stir: 1.35, gain: 1.2 },
  spring: { open: 0.9, stir: 0.85, gain: 0.85 },
};

/** The corner the bed sits at with nothing pushing it, and how far it can be pushed. */
const CUTOFF_FLOOR = 240;
const CUTOFF_REACH = 900;
const GAIN_FLOOR = 0.035;
const GAIN_REACH = 0.075;

/**
 * A fight drops the wind back rather than raising it. Everything else on the
 * field is loud, and a bed competing with the horn just makes both muddy.
 */
const BATTLE_DUCK = 0.55;

export function ambienceFor(state: GameState): AmbienceProfile {
  // Inside the steading you are among buildings, and the roof is the point.
  if (currentMode(state) === 'COLONY') return { ...AMBIENCE_INDOORS };

  const terrain = state.world.tiles[key(state.party.at)]?.terrain ?? 'meadow';
  const ground = GROUND[terrain];
  const season = SEASONS[seasonOf(state.day)];

  const open = ground.open * season.open;
  const stir = ground.stir * season.stir;
  const duck = state.battle ? BATTLE_DUCK : 1;

  return {
    cutoff: CUTOFF_FLOOR + CUTOFF_REACH * clamp(open),
    gain: (GAIN_FLOOR + GAIN_REACH * clamp(open)) * season.gain * duck,
    // Two gusts every three seconds at the very worst; a still summer valley
    // breathes about once every ten.
    gustRate: 0.1 + 0.55 * clamp(stir),
    gustDepth: 0.2 + 0.45 * clamp(stir),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** True when two profiles are close enough that re-easing to one is pointless. */
export function sameAir(a: AmbienceProfile, b: AmbienceProfile): boolean {
  return (
    Math.abs(a.cutoff - b.cutoff) < 1 &&
    Math.abs(a.gain - b.gain) < 0.001 &&
    Math.abs(a.gustRate - b.gustRate) < 0.001 &&
    Math.abs(a.gustDepth - b.gustDepth) < 0.001
  );
}

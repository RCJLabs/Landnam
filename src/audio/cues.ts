// What just happened, in sound. Pure: (before, after, action) -> CueId[].
//
// The game has one dispatch and one state object, so rather than sprinkling
// play() calls through the sim — which would put an effect inside a pure
// reducer and make it untestable — the audio asks the same question the
// renderer does: what is different now? Everything here is a diff of two
// states, which means the whole of what the game sounds like can be asserted
// in Vitest without a browser or an AudioContext.

import type { Action } from '../sim/actions';
import type { CueId } from '../data/sounds';
import type { Combatant, GameState, Person } from '../state/types';
import { currentMode } from '../modes';
import { key } from '../hex';
import { SEASON_LENGTH } from '../sim/calendar';

/** Living members of the warband proper. Foes are counted on the battle. */
function standing(state: GameState): number {
  return state.party.people.filter((p) => p.alive).length;
}

/** Which season a day sits in, as an index. Only the change matters here. */
function seasonIndex(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / SEASON_LENGTH);
}

/**
 * Health by person id across everyone on the field. A fight's people live in
 * two places — the warband hangs off the party, the foes off the battle — but
 * they are the same `Person` shape, which is the whole point of the model.
 */
function healthOnField(state: GameState): Map<string, number> {
  const found = new Map<string, number>();
  const all: Person[] = [...state.party.people, ...(state.battle?.foes ?? [])];
  for (const person of all) found.set(person.id, person.health);
  return found;
}

function idsWhere(state: GameState, pick: (c: Combatant) => boolean): Set<string> {
  return new Set((state.battle?.combatants ?? []).filter(pick).map((c) => c.personId));
}

const SWINGS = new Set(['B_STRIKE', 'B_THROW']);

/**
 * Blows landing, read off the state rather than off the log.
 *
 * An earlier pass matched words in the fight log and got it wrong the first
 * time it was tested against the real wording: "beat on his shield to no
 * effect" is a MISS, and reads as a shield-wall to anything scanning for the
 * word. Health, `down` and `defending` cannot be misread, and they also catch
 * the foes' turns — which produce no player action at all, and are exactly
 * when the player most needs to hear that something hit them.
 */
function fieldCues(before: GameState, after: GameState, action: Action): CueId[] {
  const was = before.battle;
  const now = after.battle;
  if (!was || !now) return [];

  const had = healthOnField(before);
  let wounded = false;
  for (const [id, health] of healthOnField(after)) {
    const previous = had.get(id);
    if (previous !== undefined && health < previous) wounded = true;
  }

  const wasDown = idsWhere(before, (c) => c.down);
  const fell = now.combatants.some((c) => c.down && !wasDown.has(c.personId));

  const wasGuarding = idsWhere(before, (c) => c.defending);
  const raised = now.combatants.some((c) => c.defending && !wasGuarding.has(c.personId));

  const cues: CueId[] = [];
  if (raised) cues.push('wall');
  if (fell) cues.push('fell');
  else if (wounded) cues.push('strike');
  else if (SWINGS.has(action.type)) cues.push('miss');
  return cues;
}

/**
 * Every sound one dispatch should make, in the order it should make it.
 *
 * Order is deliberate: the small mechanical noise of the act comes first,
 * then what the act revealed. A move that walks the band into an ambush is a
 * footstep and then a horn, because that is the order those things happen in.
 */
export function cuesFor(before: GameState, after: GameState, action: Action): CueId[] {
  if (before === after) return [];
  const cues: CueId[] = [];

  const wasFighting = Boolean(before.battle);
  const isFighting = Boolean(after.battle);

  // --- On the field ---

  if (wasFighting) {
    if (action.type === 'B_MOVE' || action.type === 'B_DASH') cues.push('step');
    cues.push(...fieldCues(before, after, action));
    if (!before.battle?.outcome && after.battle?.outcome) {
      cues.push(after.battle.outcome === 'won' ? 'won' : 'lost');
    }
  }

  // Steel drawn: the horn goes up the moment a field exists that did not.
  if (!wasFighting && isFighting) cues.push('horn');

  // The leader's cry sounds like what it is. State-derived like everything
  // here: the horn blows because the cry HAPPENED, not because a button did.
  if (wasFighting && isFighting && !before.battle?.warCried && after.battle?.warCried) {
    cues.push('horn');
  }

  // --- On the road ---

  if (!wasFighting && !isFighting) {
    if (action.type === 'MOVE') {
      // A day under oars does not sound like a day's walking.
      const ground = after.world.tiles[key(after.party.at)]?.terrain;
      cues.push(ground === 'ocean' ? 'oar' : 'step');
    }
    if (action.type === 'CAMP') cues.push('camp');
    if (action.type === 'FORAGE' || action.type === 'HUNT' || action.type === 'FISH') {
      const got =
        after.party.food + after.party.firewood > before.party.food + before.party.firewood;
      cues.push(got ? 'gather' : 'ill');
    }
    if (action.type === 'FOUND' && after.settlement && !before.settlement) cues.push('posts');
  }

  // --- Anywhere ---

  // A card landing, and the answer to one. The outcome is what the player is
  // actually waiting on, so it speaks even though the card itself already did.
  if (!before.event && after.event) cues.push('card');
  if (before.event?.outcome === undefined && after.event?.outcome) {
    cues.push(after.event.outcome.good ? 'fair' : 'ill');
  }

  if (seasonIndex(after.day) !== seasonIndex(before.day)) cues.push('thaw');

  if ((after.settlement?.built.length ?? 0) > (before.settlement?.built.length ?? 0)) {
    cues.push('raised');
  }

  // The bell tolls once however many were lost, because two bells on top of
  // each other is a noise and one bell is a death.
  if (standing(after) < standing(before)) cues.push('knell');

  if (!before.end && after.end) {
    cues.push(after.end.cause === 'jarl' ? 'jarl' : 'ending');
  }

  return cues;
}

/** Modes that want the wind up. A hall is not a hillside. */
export function exposed(state: GameState): boolean {
  return currentMode(state) !== 'COLONY';
}

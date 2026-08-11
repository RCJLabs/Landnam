// What a player who cannot see the screen needs told.
//
// Audit item 10. The render layer had six `aria` attributes in it, on a game
// whose primary target is a phone browser — and the measured gaps were not
// the ones you would guess. Every button already had an accessible name and
// every touch target was ≥44px, because those rules have been enforced since
// 5.2. What was missing was everything about CHANGE: no live regions at all,
// so a screen reader announced nothing when a day passed, a saga line landed
// or the stores moved, and no dialog semantics, so a card that covers the
// screen read as more page.
//
// The text itself is pure and lives here rather than in the renderer, for the
// same reason `threatReading` does: it is a statement about the state, it can
// be unit-tested, and this project's rule is that anything testable does not
// belong in `render/`.

import { beats, describeMark, markOf } from './challenge';
import { wintersStood, seasonOf } from './calendar';
import { living } from './people';
import { foodPerDay, firewoodPerNight } from './upkeep';
import type { GameState } from '../state/types';

/**
 * The standing state, in one line.
 *
 * Written as a sentence rather than as the six-cell bar the sighted player
 * reads, because a screen reader announcing "DAY 29 SEASON Autumn BAND 6"
 * makes the listener assemble the sentence themselves every single turn.
 * Stores are given in DAYS as well as in sacks — "eleven, four days" is the
 * thing the number is actually for, and a listener cannot glance at the
 * winter mark to work it out.
 */
export function standing(state: GameState): string {
  const band = living(state.party.people).length;
  const days = Math.floor(state.party.food / Math.max(1, foodPerDay(state)));
  const nights = Math.floor(state.party.firewood / Math.max(1, firewoodPerNight(state)));
  const where = state.battle
    ? 'in a fight'
    : state.settlement
      ? `at ${state.settlement.name}`
      : 'on the road';
  return (
    `Day ${state.day}, ${seasonOf(state.day)}, ${where}. ` +
    `${band} ${band === 1 ? 'person' : 'people'}. ` +
    `Food ${state.party.food}, ${days} ${days === 1 ? 'day' : 'days'}. ` +
    `Wood ${state.party.firewood}, ${nights} ${nights === 1 ? 'night' : 'nights'}. ` +
    `Heart ${Math.round(state.party.morale)}.` +
    (state.chasing ? ` ${chaseLine(state)}` : '')
  );
}

/**
 * Where this run stands against the mark it is chasing.
 *
 * Seed challenges shipped with the mark on the title screen and the ending
 * screen and NOWHERE in between — so the one number the whole run was about
 * was the one number the run would not show you, and a listener had it
 * worse than a looker for once. This is that number, and it is here rather
 * than in the renderer because it is a statement about the state.
 */
export function chaseLine(state: GameState): string {
  if (!state.chasing) return '';
  const mine = markOf(state);
  if (beats(mine, state.chasing)) return `Ahead of the mark of ${describeMark(state.chasing)}.`;
  // Days to go is the number a chaser actually wants, and it is only
  // meaningful while days are what separates them — a jarldom is not
  // something you are eleven days away from.
  if (state.chasing.jarl && !mine.jarl) {
    return `Chasing ${describeMark(state.chasing)} — that one took the Thing.`;
  }
  const togo = state.chasing.day - state.day + 1;
  return `Chasing ${describeMark(state.chasing)} — ${togo} ${togo === 1 ? 'day' : 'days'} to beat it.`;
}

/**
 * What to announce right now: whatever the game just said, then where we
 * stand.
 *
 * The newest saga lines come first because they are the news — a listener
 * wants "they fired the smokehouse" before they want the woodpile. Bounded
 * at three, because a live region that reads a paragraph on every turn is one
 * a listener switches off.
 */
export function announce(state: GameState, sinceSagaLength = 0): string {
  const fresh = state.saga
    .slice(Math.max(sinceSagaLength, state.saga.length - ANNOUNCE_MAX))
    .map((entry) => entry.text);
  if (state.end) {
    return `${state.end.title}. ${state.end.lines.join(' ')}`;
  }
  const news = fresh.length > 0 ? `${fresh.join(' ')} ` : '';
  return `${news}${standing(state)}`;
}

/** How many fresh saga lines a single announcement will carry. */
export const ANNOUNCE_MAX = 3;

/**
 * A label for the map, which is otherwise a large unlabelled graphic.
 *
 * Deliberately a SUMMARY and not a description of every hex: the panel under
 * the map already reads out the ground the band is standing on, so what this
 * has to add is the shape of the situation — how much is known, and what is
 * on it that matters.
 */
export function mapLabel(state: GameState): string {
  const met = state.neighbours.filter((n) => n.found).length;
  const winters = wintersStood(state.day);
  const home = state.settlement
    ? `${state.settlement.name} stands here.`
    : 'No steading yet.';
  return (
    `Map of the country. ${home} ` +
    `${met} of ${state.neighbours.length} neighbours met. ` +
    `${winters} ${winters === 1 ? 'winter' : 'winters'} stood. ` +
    'The panel below reads the ground under the band.'
  );
}

// The cards that stop play until they are answered — an event, a lesson the
// first time a system appears, and the reckoning after a fight.
//
// Split out of a 749-line `cards.ts` on 2026-08-11. Views only.

// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import type { LessonDef } from '../../data/lessons';
import { COAST_IS_A_LINE } from '../../sim/flags';
import type { GameState } from '../../state/types';
import { button, el } from '../svg';
import type { Dispatch } from '../ui';

export function renderEventCard(state: GameState, dispatch: Dispatch): HTMLElement {
  const event = state.event!;
  const card = el('div', { class: 'card event-card' }, [
    el('h2', {}, [event.title]),
    el('p', { class: 'event-body' }, [event.body]),
  ]);

  if (event.outcome) {
    card.append(
      el('p', { class: `outcome ${event.outcome.good ? 'good' : 'grim'}` }, [event.outcome.text]),
      button('Onward', () => dispatch({ type: 'DISMISS_EVENT' }), { class: 'primary wide' }),
    );
  } else {
    const choices = el('div', { class: 'choices' });
    event.choices.forEach((choice, index) => {
      const node = button(choice.label, () => dispatch({ type: 'CHOOSE', index }), {
        class: 'choice',
      });
      if (choice.hint) node.append(el('span', { class: 'choice-hint' }, [choice.hint]));
      choices.append(node);
    });
    card.append(choices);
  }

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * A first-run lesson. Deliberately the SAME card as an event, down to the
 * class name — the point of 5.2 is that guidance arrives in the game's voice
 * at the moment it matters, not as a tutorial screen bolted on the side. The
 * only thing marking it out is the rule under the body, which is the one line
 * that is allowed to speak plainly about buttons.
 */
export function renderLesson(lesson: LessonDef, onDismiss: () => void): HTMLElement {
  const card = el('div', { class: 'card event-card lesson-card' }, [
    el('h2', {}, [lesson.title]),
    // The coast wording when there is one. A lesson is the FIRST prose a new
    // player reads, and on a coast build the hex one told them to tap a
    // marked hex — on a map with no hexes to tap.
    el('p', { class: 'event-body' }, [
      (COAST_IS_A_LINE ? lesson.coast?.body : undefined) ?? lesson.body,
    ]),
    el('p', { class: 'lesson-point' }, [
      (COAST_IS_A_LINE ? lesson.coast?.point : undefined) ?? lesson.point,
    ]),
    button('Onward', onDismiss, { class: 'primary wide' }),
  ]);
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * The reckoning after a fight. Deliberately shown on the road rather than on
 * the field: the player leaves the battle thinking they won, and then learns
 * what it cost.
 */
export function renderAftermath(state: GameState, dispatch: Dispatch): HTMLElement {
  const after = state.aftermath!;
  const card = el('div', { class: 'card' }, [
    el('h2', { class: after.killed.length > 0 ? 'grim' : after.won ? 'good' : 'grim' }, [
      after.killed.length > 0 ? 'What It Cost' : after.won ? 'The Reckoning' : 'What Was Left',
    ]),
  ]);

  if (after.killed.length > 0) {
    card.append(
      el('h3', {}, ['The dead']),
      ...after.killed.map((name) => el('p', { class: 'fallen' }, [`${name} did not get up.`])),
    );
  }
  if (after.maimed.length > 0) {
    card.append(
      el('h3', {}, ['Carried off']),
      ...after.maimed.map((name) => el('p', { class: 'event-body' }, [`${name} will feel it.`])),
    );
  }
  if (after.ran.length > 0) {
    card.append(
      el('p', { class: 'event-body' }, [`${after.ran.join(' and ')} ran and came back after.`]),
    );
  }
  if (after.food > 0 || after.firewood > 0) {
    card.append(
      el('p', { class: 'outcome good' }, [
        `Taken off the field: ${after.food} food, ${after.firewood} firewood.`,
      ]),
    );
  }
  if (after.killed.length === 0 && after.maimed.length === 0 && after.ran.length === 0) {
    card.append(
      el('p', { class: 'event-body' }, [
        after.won ? 'Every one of us walked away from it.' : 'We got away with our lives, and little else.',
      ]),
    );
  }

  card.append(button('Onward', () => dispatch({ type: 'DISMISS_AFTERMATH' }), { class: 'primary wide' }));
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

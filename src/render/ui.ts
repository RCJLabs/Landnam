// Persistent chrome: the top status bar, the action bar, and the saga log.
// Views only — every button dispatches an Action and re-renders from state.

import type { Action } from '../sim/actions';
import type { GameState } from '../state/types';
import { daysUntilWinter, effectsOn, seasonOf } from '../sim/calendar';
import { foodPerDay, firewoodPerNight } from '../sim/upkeep';
import { living } from '../sim/people';
import { canFish } from '../sim/travel';
import { button, el } from './svg';

export type Dispatch = (action: Action) => void;

function stat(label: string, value: string, warn = false): HTMLElement {
  return el('div', { class: `stat${warn ? ' warn' : ''}` }, [
    el('span', { class: 'stat-label' }, [label]),
    el('span', { class: 'stat-value' }, [value]),
  ]);
}

export function renderTopBar(state: GameState): HTMLElement {
  const season = seasonOf(state.day);
  const effects = effectsOn(state.day);
  const untilWinter = daysUntilWinter(state.day);
  const food = Math.floor(state.party.food);
  const wood = Math.floor(state.party.firewood);
  const daysOfFood = Math.floor(food / foodPerDay(state));
  const nightsOfWood = Math.floor(wood / firewoodPerNight(state));

  const bar = el('div', { class: 'topbar' }, [
    stat('Day', `${state.day}`),
    stat('Season', effects.label, season === 'winter'),
    stat('Band', `${living(state.party.people).length}`, living(state.party.people).length <= 2),
    stat('Food', `${food}`, daysOfFood <= 2),
    stat('Wood', `${wood}`, nightsOfWood <= 2),
    stat('Heart', `${Math.round(state.party.morale)}`, state.party.morale < 30),
  ]);

  if (untilWinter > 0 && untilWinter <= 16) {
    bar.append(el('div', { class: 'winter-warning' }, [`Winter in ${untilWinter} days`]));
  }
  return bar;
}

export function renderActionBar(state: GameState, dispatch: Dispatch): HTMLElement {
  const bar = el('div', { class: 'actionbar' });
  if (state.end || state.event) return bar;

  bar.append(
    button('Camp', () => dispatch({ type: 'CAMP' }), {
      class: 'action',
      title: 'Rest, mend, and cut firewood. Costs a day.',
    }),
    button('Forage', () => dispatch({ type: 'FORAGE' }), { class: 'action' }),
    button('Hunt', () => dispatch({ type: 'HUNT' }), { class: 'action' }),
  );
  if (canFish(state)) {
    bar.append(button('Fish', () => dispatch({ type: 'FISH' }), { class: 'action' }));
  }
  return bar;
}

export function renderSagaLog(state: GameState, expanded: boolean, toggle: () => void): HTMLElement {
  const entries = state.saga.slice(expanded ? -60 : -3);
  const list = el('div', { class: 'saga-entries' });
  for (const entry of entries) {
    list.append(
      el('p', { class: `saga-line tone-${entry.tone}` }, [
        el('span', { class: 'saga-day' }, [`${entry.day}`]),
        entry.text,
      ]),
    );
  }

  const panel = el('div', { class: `saga${expanded ? ' expanded' : ''}` }, [
    button(expanded ? 'Close the saga' : 'The saga so far', toggle, { class: 'saga-toggle' }),
    list,
  ]);
  // Newest line should always be the one you can see.
  queueMicrotask(() => {
    list.scrollTop = list.scrollHeight;
  });
  return panel;
}

/** A hint line telling the player what tapping the map will do. */
export function renderHint(state: GameState): HTMLElement {
  if (state.end) return el('div', { class: 'hint' }, ['The saga is finished.']);
  if (state.event) return el('div', { class: 'hint' }, ['Something needs answering.']);
  return el('div', { class: 'hint' }, ['Tap a marked hex to travel · drag to look about']);
}

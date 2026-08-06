// Persistent chrome: the top status bar, the action bar, and the saga log.
// Views only — every button dispatches an Action and re-renders from state.

import type { Action } from '../sim/actions';
import type { GameState } from '../state/types';
import { daysUntilWinter, effectsOn, seasonOf } from '../sim/calendar';
import { foodPerDay, firewoodPerNight } from '../sim/upkeep';
import { living } from '../sim/people';
import { canFish } from '../sim/travel';
import {
  atHome,
  BLOCK_REASON,
  canFound,
  foundBlocker,
  scoreWord,
  siteReport,
  verdictFor,
} from '../sim/site';
import { MEASURES, MEASURE_MAX } from '../data/sites';
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

export function renderActionBar(
  state: GameState,
  dispatch: Dispatch,
  onSettle?: () => void,
): HTMLElement {
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
  if (onSettle && canFound(state, state.party.at)) {
    bar.append(
      button('Settle', onSettle, {
        class: 'action settle',
        title: 'Take this land. There is no undoing it.',
      }),
    );
  }
  if (atHome(state)) {
    bar.append(
      button('Steading', () => dispatch({ type: 'ENTER_COLONY' }), {
        class: 'action settle',
        title: 'Set your people to work.',
      }),
    );
  }
  return bar;
}

/**
 * The reading of the ground underfoot. Always on screen while you are still
 * looking for somewhere, because the whole decision is a comparison and the
 * player cannot compare what they cannot see.
 */
export function renderSitePanel(state: GameState): HTMLElement {
  if (state.end || state.event) return el('div');
  const at = state.party.at;
  const report = siteReport(state.world, at);
  if (!report) return el('div');

  const home = atHome(state);
  const blocker = foundBlocker(state, at);
  const verdict = verdictFor(report.total);

  const bars = el('div', { class: 'site-measures' });
  for (const measure of MEASURES) {
    const score = report[measure.id];
    bars.append(
      el('div', { class: 'site-measure' }, [
        // The row itself is `display: contents`, so the tooltip has to hang
        // on a span — a box-less element cannot be hovered.
        el('span', { class: 'site-name', title: measure.meaning }, [measure.name]),
        el('span', { class: 'site-pips', 'aria-label': `${score} of ${MEASURE_MAX}` }, [
          '●'.repeat(score) + '○'.repeat(MEASURE_MAX - score),
        ]),
        el('span', { class: 'site-word' }, [scoreWord(score)]),
      ]),
    );
  }

  // A verdict that says "a steading could stand here" over ground the game
  // then refuses is a lie the player will catch within a day. When there is a
  // blocker, the blocker IS the headline.
  const refused = !!blocker && blocker !== 'settled' && blocker !== 'ended';
  const head = home
    ? `${state.settlement!.name} — our own ground · tap Steading to set the work`
    : state.settlement
      ? `This ground: ${verdict.label}`
      : refused
        ? `${verdict.label}, but we cannot hold it`
        : `${verdict.label} — ${verdict.line}`;

  const panel = el('div', { class: `site${home ? ' home' : ''}${refused ? ' refused' : ''}` }, [
    el('div', { class: 'site-head' }, [head]),
    bars,
  ]);
  // Say plainly why the button is missing, rather than leaving a blank space
  // where a choice should be.
  if (!home && refused) {
    panel.append(el('div', { class: 'site-block' }, [BLOCK_REASON[blocker!]]));
  }
  return panel;
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
  if (!state.settlement) {
    return el('div', { class: 'hint' }, ['Find ground worth holding · tap a marked hex to travel']);
  }
  return el('div', { class: 'hint' }, ['Tap a marked hex to travel · drag to look about']);
}

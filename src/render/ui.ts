// Persistent chrome: the top status bar, the action bar, and the saga log.
// Views only — every button dispatches an Action and re-renders from state.

import type { Action } from '../sim/actions';
import type { GameState } from '../state/types';
import { daysUntilWinter, effectsOn, seasonOf } from '../sim/calendar';
import { foodPerDay, firewoodPerNight } from '../sim/upkeep';
import { living } from '../sim/people';
import {
  atHome,
  BLOCK_REASON,
  foundBlocker,
  scoreWord,
  siteReport,
  verdictFor,
} from '../sim/site';
import { MEASURES, MEASURE_MAX } from '../data/sites';
import { forecast, markVisible } from '../sim/winter';
import { wintersStood } from '../sim/calendar';
import { thingNeeds, thingOdds } from '../sim/thing';
import { WINTERS_TO_JARL } from '../data/thing';
import { expeditionLine } from '../sim/expedition';
import { angriest, neighbourHere, neighbourLine, standingOf } from '../sim/neighbours';
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

/**
 * The winter mark: what the stores must reach, and where they stand. Shown
 * from the turn of autumn onward and nowhere else, because a number the player
 * cannot act on yet is noise.
 *
 * This is the milestone's whole apparatus. If a colony dies in the dark, this
 * panel was on screen for two seasons telling it the number.
 */
export function renderWinterMark(state: GameState): HTMLElement {
  if (!markVisible(state)) return el('div');
  const f = forecast(state);

  const row = (label: string, have: number, need: number, gap: number): HTMLElement =>
    el('div', { class: `mark-row${gap < 0 ? ' short' : ''}` }, [
      el('span', { class: 'mark-name' }, [label]),
      el('span', { class: 'mark-value' }, [`${Math.round(have)} / ${need}`]),
      el('span', { class: 'mark-gap' }, [
        gap < 0 ? `${-gap} short` : `${gap} spare`,
      ]),
    ]);

  return el('div', { class: `winter-mark${f.ready ? ' ready' : ''}` }, [
    el('div', { class: 'mark-head' }, [
      f.days > 24
        ? `The mark for spring, ${f.days} days out`
        : `${f.days} days of winter left`,
    ]),
    row('Food', state.party.food, f.food, f.foodGap),
    row('Wood', state.party.firewood, f.firewood, f.firewoodGap),
  ]);
}

/**
 * The road to a jarldom, as a checklist. Shown from the first thaw onward at
 * the steading and nowhere else.
 *
 * This is the endgame's whole apparatus, and it is the same trick as the
 * winter mark: a goal the player can see is a goal they can work toward, and
 * one they cannot is a timer with extra steps.
 */
export function renderThingMark(state: GameState): HTMLElement {
  if (state.end || state.event || !state.settlement) return el('div');
  if (wintersStood(state.day) < 1 || !atHome(state)) return el('div');

  const needs = thingNeeds(state);
  const ready = needs.every((n) => n.met);
  const panel = el('div', { class: `thing-mark${ready ? ' ready' : ''}` }, [
    el('div', { class: 'mark-head' }, [
      ready
        ? `The Thing can be called · ${Math.round(thingOdds(state) * 100)}%`
        : `${wintersStood(state.day)} of ${WINTERS_TO_JARL} winters · what a jarl needs`,
    ]),
  ]);
  for (const need of needs) {
    panel.append(
      el('div', { class: `need${need.met ? ' met' : ''}` }, [
        el('span', { class: 'need-mark' }, [need.met ? '✓' : '·']),
        el('span', { class: 'need-label' }, [need.label]),
      ]),
    );
  }
  return panel;
}

/**
 * Three buttons and no more. Everything that spends a day lives behind Act
 * (see render/deeds.ts); Chart and Band are views, cost nothing, and stay out
 * here where they can be reached in one tap.
 */
export function renderActionBar(
  state: GameState,
  deedCount: number,
  onAct: () => void,
  onMap?: () => void,
): HTMLElement {
  const bar = el('div', { class: 'actionbar' });
  if (state.end || state.event) return bar;

  if (deedCount > 0) {
    bar.append(
      button('Act', onAct, {
        class: 'action act',
        title: 'What to do with the day.',
      }),
    );
  }
  if (onMap) {
    bar.append(button('Chart', onMap, { class: 'action secondary', title: 'What we have seen.' }));
  }
  return bar;
}

/**
 * The mute, drawn as a horn rather than a speaker.
 *
 * Mounted once by main.ts outside the mode chrome, because it has to be
 * reachable in all three modes and on the title screen — and because the top
 * bar is already a scrolling row of numbers in every one of them, with no
 * width to spare on a phone. The crossed-out state is drawn, not coloured:
 * on a small screen at arm's length, colour alone is not an answer.
 */
export function renderMuteToggle(muted: boolean, onToggle: () => void): HTMLElement {
  const control = button('', onToggle, {
    class: `mute${muted ? ' off' : ''}`,
    title: muted ? 'Sound off. Tap for sound.' : 'Sound on. Tap to silence.',
    'aria-label': muted ? 'Turn sound on' : 'Turn sound off',
  });
  control.append(hornGlyph(muted));
  return control;
}

function hornGlyph(muted: boolean): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'mute-glyph');
  svg.setAttribute('aria-hidden', 'true');

  const horn = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // A drinking/blowing horn: narrow at the mouth, flaring and curling up.
  horn.setAttribute('d', 'M4 15c4 1.5 8 1 11-2.5S18.5 5 17 3.5c-.8 2.5-2 5-4.5 7.5S7 14 4 15z');
  horn.setAttribute('class', 'mute-horn');
  svg.append(horn);

  if (!muted) {
    for (const [index, radius] of [7, 10].entries()) {
      const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      wave.setAttribute('d', `M6 ${18 - index} a${radius} ${radius} 0 0 0 ${radius} ${radius}`);
      wave.setAttribute('class', 'mute-wave');
      svg.append(wave);
    }
  } else {
    const slash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    slash.setAttribute('d', 'M3 21 21 3');
    slash.setAttribute('class', 'mute-slash');
    svg.append(slash);
  }
  return svg;
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
  const host = neighbourHere(state);
  const head = host
    ? neighbourLine(host)
    : home
    ? `${state.settlement!.name} — our own ground · Act to set the work`
    : state.settlement
      ? `This ground: ${verdict.label}`
      : refused
        ? `${verdict.label}, but we cannot hold it`
        : `${verdict.label} — ${verdict.line}`;

  const panel = el('div', { class: `site${home ? ' home' : ''}${refused ? ' refused' : ''}` }, [
    el('div', { class: 'site-head' }, [head]),
    bars,
  ]);
  if (host) {
    panel.append(el('div', { class: `site-standing ${standingOf(host).id}` }, [standingOf(host).line]));
  } else if (home) {
    // At the hearth, what the player needs off this panel is the coast's
    // temper — the thing that decides how much comes over the ridge.
    const worst = angriest(state);
    if (worst?.found && worst.standing < 0) {
      panel.append(
        el('div', { class: `site-standing ${standingOf(worst).id}` }, [
          `${worst.name}: ${standingOf(worst).label.toLowerCase()}. ${standingOf(worst).line}`,
        ]),
      );
    }
  }
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
  const out = expeditionLine(state);
  if (out) return el('div', { class: 'hint out' }, [out]);
  return el('div', { class: 'hint' }, [
    'The band is at the steading · send a party out to go anywhere',
  ]);
}

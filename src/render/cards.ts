// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { traitById } from '../data/traits';
import { fullName, effectiveStat } from '../sim/people';
import { exploredFraction } from '../sim/fog';
import { XP_PER_ADVANCE } from '../sim/consequences';
import { scoreWord, siteReport, strongestOf, verdictFor } from '../sim/site';
import { MEASURES, MEASURE_MAX } from '../data/sites';
import type { GameState, Person } from '../state/types';
import { button, el } from './svg';
import type { Dispatch } from './ui';

export function renderTitle(
  hasExistingSave: boolean,
  onContinue: () => void,
  onNew: (seed: string) => void,
): HTMLElement {
  const seedInput = el('input', {
    class: 'seed-input',
    type: 'text',
    placeholder: 'seed (optional)',
    'aria-label': 'World seed',
  });

  const buttons = el('div', { class: 'title-buttons' });
  if (hasExistingSave) {
    buttons.append(button('Continue', onContinue, { class: 'primary' }));
  }
  buttons.append(
    button(hasExistingSave ? 'New landing' : 'Take the land', () => onNew(seedInput.value.trim()), {
      class: hasExistingSave ? '' : 'primary',
    }),
  );

  return el('div', { class: 'overlay title' }, [
    el('div', { class: 'card' }, [
      el('h1', { class: 'game-title' }, ['LANDNÁM']),
      el('p', { class: 'tagline' }, ['Sail, fight, claim, survive.']),
      el('p', { class: 'blurb' }, [
        'Six of you step off the knarr onto a coast with no name you know. Winter comes on the forty-ninth day.',
      ]),
      buttons,
      seedInput,
    ]),
  ]);
}

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

  return el('div', { class: 'overlay' }, [card]);
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
  return el('div', { class: 'overlay' }, [card]);
}

/**
 * The land-taking. Deliberately heavier than any other card in the game: it
 * names what you are giving up as well as what you are getting, and it says
 * out loud that there is no second one.
 */
export function renderFounding(
  state: GameState,
  confirm: () => void,
  cancel: () => void,
): HTMLElement {
  const report = siteReport(state.world, state.party.at)!;
  const verdict = verdictFor(report.total);
  const strongest = strongestOf(report);
  const weakest = MEASURES.reduce((worst, m) =>
    report[m.id] < report[worst.id] ? m : worst,
  );

  const table = el('div', { class: 'site-measures' });
  for (const measure of MEASURES) {
    const score = report[measure.id];
    table.append(
      el('div', { class: 'site-measure' }, [
        el('span', { class: 'site-name' }, [measure.name]),
        el('span', { class: 'site-pips' }, ['●'.repeat(score) + '○'.repeat(MEASURE_MAX - score)]),
        el('span', { class: 'site-word' }, [scoreWord(score)]),
      ]),
    );
  }

  const strong = MEASURES.find((m) => m.id === strongest)!;

  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card founding' }, [
      el('h2', { class: 'good' }, ['Take This Land?']),
      el('p', { class: 'event-body' }, [
        `${verdict.label}. ${verdict.line}`,
      ]),
      table,
      el('p', { class: 'event-body' }, [
        `Its strength is ${strong.name.toLowerCase()}. ${strong.meaning} ` +
          `Its weakness is ${weakest.name.toLowerCase()} — ${scoreWord(report[weakest.id])}, ` +
          'and it will not improve because you wish it.',
      ]),
      el('p', { class: 'outcome grim' }, [
        'The posts go in once. There is no second steading and no moving this one.',
      ]),
      el('div', { class: 'choices' }, [
        button('Set the posts', confirm, { class: 'choice primary' }),
        button('Walk on', cancel, { class: 'choice' }),
      ]),
    ]),
  ]);
}

function personRow(person: Person): HTMLElement {
  const trait = traitById(person.trait);
  const condition = !person.alive
    ? (person.fate ?? 'dead')
    : person.injuries.length > 0
      ? person.injuries.map((i) => i.label).join(', ')
      : person.health < person.maxHealth * 0.5
        ? 'hurt'
        : 'hale';

  const statLine = (['might', 'wits', 'spirit', 'craft'] as const)
    .map((s) => {
      const value = effectiveStat(person, s);
      const base = person.stats[s];
      const label = s[0]!.toUpperCase() + s.slice(1);
      return value < base ? `${label} ${value}(${base})` : `${label} ${value}`;
    })
    .join(' · ');

  return el('div', { class: `person${person.alive ? '' : ' dead'}` }, [
    el('div', { class: 'person-name' }, [fullName(person)]),
    el('div', { class: 'person-stats' }, [statLine]),
    el('div', { class: 'person-meta' }, [
      person.alive ? `${person.health}/${person.maxHealth} · ${condition}` : condition,
      trait ? ` · ${trait.name}` : '',
      person.alive && person.xp > 0 ? ` · ${person.xp}/${XP_PER_ADVANCE} xp` : '',
    ]),
  ]);
}

export function renderWarband(state: GameState, close: () => void): HTMLElement {
  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card roster' }, [
      el('h2', {}, ['The Warband']),
      ...state.party.people.map(personRow),
      button('Close', close, { class: 'primary wide' }),
    ]),
  ]);
}

export function renderRunEnd(state: GameState, onRestart: () => void): HTMLElement {
  const end = state.end!;
  const survived = end.cause === 'survived';
  const explored = Math.round(exploredFraction(state.world) * 100);

  const summary = el('div', { class: 'end-summary' });
  for (const line of end.lines) summary.append(el('p', {}, [line]));
  summary.append(
    el('p', { class: 'end-stat' }, [`${state.day} days ashore · ${explored}% of the land seen`]),
  );

  const fallen = state.party.people.filter((p) => !p.alive);
  if (fallen.length > 0) {
    summary.append(el('h3', {}, ['The Fallen']));
    for (const person of fallen) {
      summary.append(
        el('p', { class: 'fallen' }, [
          `${fullName(person)} — ${person.fate ?? 'lost'}${person.diedOn ? `, day ${person.diedOn}` : ''}`,
        ]),
      );
    }
  }

  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card end-card' }, [
      el('h2', { class: survived ? 'good' : 'grim' }, [end.title]),
      summary,
      el('p', { class: 'seed-note' }, [`seed ${state.seed}`]),
      button('Land again', onRestart, { class: 'primary wide' }),
    ]),
  ]);
}

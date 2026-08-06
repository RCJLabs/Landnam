// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { traitById } from '../data/traits';
import { fullName, effectiveStat } from '../sim/people';
import { exploredFraction } from '../sim/fog';
import { XP_PER_ADVANCE } from '../sim/consequences';
import { scoreWord, siteReport, strongestOf, verdictFor } from '../sim/site';
import { moodOf, MOOD_WORD } from '../sim/minds';
import { known } from '../sim/lore';
import { composeSaga, sagaText } from '../sim/sagagen';
import { jobOf } from '../sim/colony';
import {
  LAUNCH_REASON,
  launchBlocker,
  provisionsFor,
  PURPOSES,
} from '../sim/expedition';
import { FEUD_THRESHOLD } from '../data/feuds';
import { MEASURES, MEASURE_MAX } from '../data/sites';
import type { GameState, Person, Purpose } from '../state/types';
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

/**
 * Choosing who goes out. Kept as one card rather than a mode of its own,
 * because the decision is small and the trade-off — every name you tick is a
 * pair of hands off the fields — should be visible in one glance.
 */
export function renderLaunch(
  state: GameState,
  picked: Set<string>,
  toggle: (id: string) => void,
  purpose: Purpose,
  setPurpose: (p: Purpose) => void,
  dispatch: Dispatch,
  close: () => void,
): HTMLElement {
  const crew = state.party.people.filter((p) => p.alive);
  const going = crew.filter((p) => picked.has(p.id));
  const blocker = launchBlocker(state, [...picked]);

  const card = el('div', { class: 'card' }, [
    el('h2', {}, ['Send a Party Out']),
    el('p', { class: 'event-body' }, [
      `${state.settlement!.name} keeps working while they are gone — with however many hands are left.`,
    ]),
  ]);

  const roster = el('div', { class: 'launch-crew' });
  for (const person of crew) {
    const on = picked.has(person.id);
    const row = button('', () => toggle(person.id), {
      class: `crew-row${on ? ' selected' : ''}`,
    });
    row.replaceChildren(
      el('span', { class: 'crew-name' }, [person.name]),
      el('span', { class: 'crew-job' }, [on ? 'going' : (jobOf(person)?.name ?? 'idle')]),
      el('span', { class: 'crew-take' }, [`${MOOD_WORD[moodOf(person)]}`]),
    );
    roster.append(row);
  }
  card.append(roster);

  const purposes = el('div', { class: 'jobs' });
  for (const def of PURPOSES) {
    const node = button('', () => setPurpose(def.id), {
      class: `job${purpose === def.id ? ' primary' : ''}`,
      title: def.blurb,
    });
    node.replaceChildren(
      el('span', { class: 'job-name' }, [def.name]),
      el('span', { class: 'job-why' }, [def.blurb]),
    );
    purposes.append(node);
  }
  card.append(purposes);

  card.append(
    el('p', { class: blocker ? 'outcome grim' : 'outcome good' }, [
      blocker
        ? LAUNCH_REASON[blocker]
        : `${going.length} out, ${crew.length - going.length} left at the steading · ` +
          `${provisionsFor(going.length)} food provisioned.`,
    ]),
  );

  const choices = el('div', { class: 'choices' });
  const go = button('Set out', () => dispatch({ type: 'LAUNCH', members: [...picked], purpose }), {
    class: 'choice primary',
  });
  if (blocker) go.setAttribute('disabled', 'true');
  choices.append(go, button('Not today', close, { class: 'choice' }));
  card.append(choices);

  return el('div', { class: 'overlay' }, [card]);
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

  const mood = person.alive ? MOOD_WORD[moodOf(person)] : '';
  return el('div', { class: `person${person.alive ? '' : ' dead'}` }, [
    el('div', { class: 'person-name' }, [
      fullName(person),
      ...(mood ? [el('span', { class: `person-mood mood-${moodOf(person)}` }, [mood])] : []),
    ]),
    el('div', { class: 'person-stats' }, [statLine]),
    el('div', { class: 'person-meta' }, [
      person.alive ? `${person.health}/${person.maxHealth} · ${condition}` : condition,
      trait ? ` · ${trait.name}` : '',
      person.alive && person.xp > 0 ? ` · ${person.xp}/${XP_PER_ADVANCE} xp` : '',
    ]),
  ]);
}

export function renderWarband(state: GameState, close: () => void): HTMLElement {
  const card = el('div', { class: 'card roster' }, [
    el('h2', {}, ['The Warband']),
    ...state.party.people.map(personRow),
  ]);

  // Bad blood is a fact about the band, so it belongs on the band's page.
  const open = state.grudges.filter((g) => !g.settled);
  if (open.length > 0) {
    card.append(el('h3', {}, ['Bad Blood']));
    for (const grudge of open.sort((a, b) => b.weight - a.weight)) {
      card.append(
        el('p', { class: `grudge${grudge.weight >= FEUD_THRESHOLD ? ' ripe' : ''}` }, [
          grudge.cause,
        ]),
      );
    }
  }

  // What the band has worked out lives with the band. Deliberately NOT a
  // menu: there is nothing to click here and nothing to spend, only a record
  // of things that happened and what each one turned out to be worth.
  const learned = known(state);
  if (learned.length > 0) {
    card.append(el('h3', {}, ['What We Know']));
    for (const lore of learned) {
      card.append(
        el('div', { class: 'lore' }, [
          el('span', { class: 'lore-name' }, [lore.name]),
          el('span', { class: 'lore-gain' }, [lore.gain]),
        ]),
      );
    }
  }

  card.append(button('Close', close, { class: 'primary wide' }));
  return el('div', { class: 'overlay' }, [card]);
}

export function renderRunEnd(state: GameState, onRestart: () => void): HTMLElement {
  const end = state.end!;
  const survived = end.cause === 'survived';
  const explored = Math.round(exploredFraction(state.world) * 100);
  const saga = composeSaga(state);

  // The saga IS the ending screen now. What used to be here — the closing
  // lines, the roll of the dead — is inside it, said in prose, so the last
  // thing the player reads is a story about their run rather than a receipt.
  const body = el('div', { class: 'end-summary' });
  for (const chapter of saga.chapters) {
    body.append(
      el('h3', { class: 'saga-head' }, [chapter.heading]),
      el('p', { class: 'saga-prose' }, [chapter.text]),
    );
  }
  body.append(
    el('p', { class: 'end-stat' }, [`${state.day} days ashore · ${explored}% of the land seen`]),
  );

  // Shareable: the seed goes with the text, because a saga without the seed
  // that made it is an anecdote and a saga with it is a challenge.
  const note = el('p', { class: 'seed-note' }, [`seed "${state.seed}"`]);
  const copy = button('Copy the saga', () => {
    const ok = copyText(sagaText(saga));
    note.replaceChildren(ok ? `Copied — seed "${state.seed}"` : `seed "${state.seed}"`);
  }, { class: 'action secondary wide' });

  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card end-card' }, [
      el('h2', { class: survived ? 'good' : 'grim' }, [saga.title]),
      body,
      note,
      copy,
      button('Land again', onRestart, { class: 'primary wide' }),
    ]),
  ]);
}

/**
 * Puts text on the clipboard. The async Clipboard API needs a secure context
 * and the built page is opened from file://, where it is not available — so
 * the old selection trick is the path that actually runs, and the modern one
 * is the fallback rather than the other way round.
 */
function copyText(text: string): boolean {
  try {
    const holder = document.createElement('textarea');
    holder.value = text;
    holder.setAttribute('readonly', 'true');
    holder.style.position = 'fixed';
    holder.style.opacity = '0';
    document.body.append(holder);
    holder.select();
    const ok = document.execCommand('copy');
    holder.remove();
    if (ok) return true;
  } catch {
    // Fall through to the async API.
  }
  try {
    void navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

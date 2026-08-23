// Panels that ask the player to choose: where the posts go, who walks out,
// and who these people are.
//
// Split out of a 749-line `cards.ts` on 2026-08-11. Views only.

// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { traitById } from '../../data/traits';
import { fullName, effectiveStat } from '../../sim/people';
import { XP_PER_ADVANCE } from '../../sim/consequences';
import { scoreWord, siteReport, strongestOf, verdictFor } from '../../sim/site';
import { moodOf, MOOD_WORD } from '../../sim/minds';
import { known } from '../../sim/lore';
import { jobOf } from '../../sim/colony';
import { LAUNCH_REASON, launchBlocker, provisionsFor, PURPOSES } from '../../sim/expedition';
import type { LaunchBlock } from '../../sim/expedition';
import { CROSSING, SAIL_REASON, sailBlocker, type SailBlock } from '../../sim/voyage';
import { FEUD_THRESHOLD } from '../../data/feuds';
import { MEASURES, MEASURE_MAX } from '../../data/sites';
import type { GameState, Person, Purpose } from '../../state/types';
import { button, el } from '../svg';
import type { Dispatch } from '../ui';
import { kinPairs } from '../../sim/kin';

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

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [
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
  // A voyage has its own refusals — a hull that will not cross open water,
  // two at the least to work her — so the card asks whichever gate applies
  // rather than showing the expedition's answer to a different question.
  const voyage = purpose === 'home';
  const blocker = voyage ? sailBlocker(state, [...picked]) : launchBlocker(state, [...picked]);
  const reason = voyage
    ? (blocker ? SAIL_REASON[blocker as SailBlock] : '')
    : (blocker ? LAUNCH_REASON[blocker as LaunchBlock] : '');

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
        ? reason
        : voyage
          ? `${going.length} aboard, ${crew.length - going.length} left at the steading · `
            + `back about day ${state.day + CROSSING}.`
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

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
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

  // Who is whose. The reason a death lands harder on one person than the
  // rest, stated before it happens rather than after — that is the whole
  // difference between grief the player can play around and grief that
  // simply arrives.
  const bound = kinPairs(state.party.people);
  if (bound.length > 0) {
    card.append(el('h3', {}, ['Kin']));
    for (const [a, b] of bound) {
      const gone = !a.alive || !b.alive;
      card.append(
        el('p', { class: `kin-line${gone ? ' gone' : ''}` }, [
          `${a.name} and ${b.name} — ${b.name} is ${b.kin?.tie ?? 'kin'} to ${a.name}` +
            (gone ? ', and one of them did not come back.' : '.'),
        ]),
      );
    }
  }

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
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

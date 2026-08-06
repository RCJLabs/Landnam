// COLONY chrome: the day's projected take, the roster of who is on what, and
// the job picker. Views only.
//
// The projected take sits directly above the picker on purpose. The milestone
// asks that assignment visibly move the numbers, and it cannot do that if the
// numbers are on a different screen.

import { JOBS, jobById, SHELTER_MAX, WATCH_MAX, type JobId } from '../data/jobs';
import type { GameState, Person } from '../state/types';
import { availableJobs, dayLabour, idlers, jobOf, output } from '../sim/colony';
import { effectiveStat, living } from '../sim/people';
import { plotTally } from './colony';
import type { Dispatch } from './ui';
import { button, el } from './svg';

function stat(label: string, value: string, warn = false): HTMLElement {
  return el('div', { class: `stat${warn ? ' warn' : ''}` }, [
    el('span', { class: 'stat-label' }, [label]),
    el('span', { class: 'stat-value' }, [value]),
  ]);
}

export function renderColonyBar(state: GameState): HTMLElement {
  const home = state.settlement!;
  const take = dayLabour(state);
  return el('div', { class: 'topbar' }, [
    stat('Day', `${state.day}`),
    stat('Food/day', `+${take.food.toFixed(1)}`, take.food <= 0),
    stat('Wood/day', `+${take.firewood.toFixed(1)}`, take.firewood <= 0),
    stat('Shelter', `${home.shelter.toFixed(1)}/${SHELTER_MAX}`),
    stat('Watch', `${home.watch.toFixed(1)}/${WATCH_MAX}`),
    stat('Idle', `${take.idle}`, take.idle > 0),
  ]);
}

export function renderColonyHint(state: GameState): HTMLElement {
  const idle = idlers(state).length;
  const ground = plotTally(state)
    .filter((p) => p.kind !== 'hall' && p.kind !== 'watchpost')
    .map((p) => `${p.count} ${p.name.toLowerCase()}`)
    .join(' · ');
  return el('div', { class: 'hint' }, [
    idle > 0
      ? `${idle} with nothing to do — tap a name, then a job`
      : `${ground || 'bare ground'} — tap a name to change their work`,
  ]);
}

/**
 * One row per person: who they are, what they are on, and what that is worth
 * today. The per-person number is the honest one — it already has their skill
 * and the ground in it.
 */
export function renderCrew(
  state: GameState,
  selected: string | null,
  select: (id: string | null) => void,
): HTMLElement {
  const list = el('div', { class: 'crew' });
  for (const person of living(state.party.people)) {
    const job = jobOf(person);
    const amount = job ? output(state, person, job) : 0;
    const row = el('button', {
      class: `crew-row${selected === person.id ? ' selected' : ''}`,
      type: 'button',
    });
    row.addEventListener('click', () => select(selected === person.id ? null : person.id));
    row.append(
      el('span', { class: 'crew-name' }, [person.name]),
      el('span', { class: `crew-job${job ? '' : ' idle'}` }, [job ? job.name : 'idle']),
      el('span', { class: 'crew-take' }, [
        job ? `${amount.toFixed(1)} ${produceWord(job.produces)}` : '—',
      ]),
    );
    list.append(row);
  }
  return list;
}

function produceWord(produces: string): string {
  switch (produces) {
    case 'food':
      return 'food';
    case 'firewood':
      return 'wood';
    case 'shelter':
      return 'built';
    default:
      return 'watch';
  }
}

/**
 * The job picker for whoever is selected. Each button carries what that person
 * specifically would produce, so the comparison is right there — this is what
 * makes "visibly moves the numbers" true before you commit rather than after.
 */
export function renderJobPicker(
  state: GameState,
  person: Person,
  dispatch: Dispatch,
): HTMLElement {
  const wrap = el('div', { class: 'jobs' });
  const offered = availableJobs(state);

  for (const job of JOBS) {
    const usable = offered.some((j) => j.id === job.id);
    const amount = output(state, person, job);
    const node = button(
      '',
      () => dispatch({ type: 'ASSIGN', personId: person.id, job: job.id as JobId }),
      { class: `job${person.job === job.id ? ' primary' : ''}`, title: job.blurb },
    );
    node.replaceChildren(
      el('span', { class: 'job-name' }, [job.name]),
      el('span', { class: 'job-take' }, [
        usable ? `${amount.toFixed(1)} ${produceWord(job.produces)}` : 'no ground for it',
      ]),
      el('span', { class: 'job-why' }, [
        `${job.stat} ${effectiveStat(person, job.stat)} · ${job.measure}`,
      ]),
    );
    if (!usable) node.setAttribute('disabled', 'true');
    wrap.append(node);
  }

  wrap.append(
    button('Stand them down', () => dispatch({ type: 'ASSIGN', personId: person.id, job: null }), {
      class: 'job secondary',
    }),
  );
  return wrap;
}

export function renderColonyActions(
  state: GameState,
  selected: string | null,
  dispatch: Dispatch,
): HTMLElement {
  const person = selected ? state.party.people.find((p) => p.id === selected) : undefined;
  if (person) return renderJobPicker(state, person, dispatch);

  const bar = el('div', { class: 'actionbar' });
  bar.append(
    button('Back to the land', () => dispatch({ type: 'LEAVE_COLONY' }), {
      class: 'action primary',
    }),
  );
  return bar;
}

/** A one-line summary of what the steading is good and bad at. */
export function renderColonyFooter(state: GameState): HTMLElement {
  const home = state.settlement!;
  const take = dayLabour(state);
  const jobs = take.byPerson
    .map((p) => jobById(p.job)?.name ?? p.job)
    .reduce<Map<string, number>>((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map());
  const line =
    jobs.size === 0
      ? `Nobody at ${home.name} is working. Nothing will come of nothing.`
      : [...jobs.entries()].map(([name, n]) => `${n} ${name.toLowerCase()}`).join(', ');
  return el('div', { class: 'saga' }, [
    el('div', { class: 'saga-entries' }, [el('p', { class: 'saga-line' }, [line])]),
  ]);
}

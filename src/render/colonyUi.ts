// COLONY chrome: the day's projected take, the roster of who is on what, and
// the job picker. Views only.
//
// The projected take sits directly above the picker on purpose. The milestone
// asks that assignment visibly move the numbers, and it cannot do that if the
// numbers are on a different screen.

import { JOBS, jobById, SHELTER_MAX, WATCH_MAX, type JobId } from '../data/jobs';
import { buildingById, type BuildingDef, type BuildingId } from '../data/buildings';
import type { GameState, Person } from '../state/types';
import {
  availableJobs,
  buildBlocker,
  capacity,
  crowding,
  buildProgress,
  dayLabour,
  idlers,
  jobOf,
  offerable,
  output,
  underway,
  type BlockReason,
} from '../sim/colony';
import { pressureLine, readNeeds, suggestedBuild, worstNeed } from '../sim/needs';
import { CROWDING_BITE } from '../sim/minds';
import { foodPerDay } from '../sim/upkeep';
import { abandonBlocker, ABANDON_REASON } from '../sim/retreat';
import { ABANDON_HEART } from '../data/retreat';
import { HALF_RATION_HEART } from '../data/rations';
import { forecast, reachable, readiness, sickCount } from '../sim/winter';
import { counsel, counselLine } from '../sim/counsel';
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
  const building = underway(state);
  const bar = el('div', { class: 'topbar' }, [
    stat('Day', `${state.day}`),
    stat('Food/day', `+${take.food.toFixed(1)}`, take.food <= 0),
    stat('Wood/day', `+${take.firewood.toFixed(1)}`, take.firewood <= 0),
    stat('Shelter', `${home.shelter.toFixed(1)}/${SHELTER_MAX}`),
    stat('Watch', `${home.watch.toFixed(1)}/${WATCH_MAX}`),
    stat('Idle', `${take.idle}`, take.idle > 0),
  ]);
  const ill = sickCount(state);
  if (ill > 0) bar.append(stat('Sick', `${ill}`, true));
  if (building) {
    bar.append(
      stat(
        'Building',
        `${building.name} ${Math.round(buildProgress(state) * 100)}%`,
        take.shelter <= 0,
      ),
    );
  }
  return bar;
}

const BLOCK_WORD: Record<BlockReason, string> = {
  built: 'standing',
  queued: 'on the stocks',
  ground: 'the ground will not take it',
  // Overridden by blockWord below, which can name the actual building.
  after: 'something has to come first',
  timber: 'not enough timber',
  room: 'another would stand empty',
};

/**
 * Why this cannot be raised, in words, naming the thing it waits on.
 *
 * The flat map said "needs a longhouse first" for every prerequisite, which
 * was true of the only three buildings that had one when it was written and
 * became a lie the day the late tier landed — the panel cheerfully told a
 * player the watchtower wanted a longhouse when it wants a palisade.
 */
function blockWord(state: GameState, building: BuildingDef, reason: BlockReason): string {
  if (reason !== 'after') return BLOCK_WORD[reason];
  const missing = (building.after ?? []).find(
    (id) => !state.settlement?.built.includes(id),
  );
  const name = missing ? buildingById(missing)?.name : undefined;
  return name ? `needs a ${name.toLowerCase()} first` : BLOCK_WORD.after;
}

/**
 * The four needs, worst first, each saying what it actually is. This is where
 * a build order comes from: the panel names the scarcity, and the suggestion
 * names the answer.
 */
/**
 * How full the hall is, and what it costs to be fuller than it holds.
 *
 * Crowding takes five off everyone's mood a head per night, and until this
 * existed it did so with nothing on screen to explain it. A penalty the
 * player cannot see is not difficulty, it is a bug that looks like bad luck.
 */
export function renderRoom(state: GameState): HTMLElement {
  if (!state.settlement) return el('div');
  const room = capacity(state);
  const here = living(state.party.people).length;
  const over = crowding(state);

  return el('div', { class: `room-mark${over > 0 ? ' short' : ''}` }, [
    el('div', { class: 'mark-head' }, [
      over > 0
        ? `${over} sleeping on the floor`
        : `Room for ${room - here} more`,
    ]),
    el('div', { class: 'mark-row' }, [
      el('span', { class: 'mark-name' }, ['Under the roof']),
      el('span', { class: 'mark-value' }, [`${here} / ${room}`]),
      el('span', { class: 'mark-gap' }, [
        over > 0 ? `${over * CROWDING_BITE} off every heart` : 'enough',
      ]),
    ]),
  ]);
}

/**
 * Short commons — the winter lever, and the one thing a band can DO once the
 * frost is down.
 *
 * Shown beside the room mark rather than buried in a menu, because the whole
 * reason it exists is that a band in trouble had nothing to reach for. The
 * cost is named on the button: this game does not hide a price.
 */
export function renderRations(state: GameState, dispatch: Dispatch): HTMLElement {
  if (!state.settlement) return el('div');
  const half = state.party.rations === 'half';
  const mouths = foodPerDay(state);
  const other = half ? 'full' : 'half';
  const wouldEat = foodPerDay({ ...state, party: { ...state.party, rations: other } });

  return el('div', { class: `room-mark${half ? ' short' : ''}` }, [
    el('div', { class: 'mark-head' }, [
      half ? 'On short commons' : 'Full shares',
    ]),
    el('div', { class: 'mark-row' }, [
      el('span', { class: 'mark-name' }, ['The larder']),
      el('span', { class: 'mark-value' }, [`${mouths} a day`]),
      el('span', { class: 'mark-gap' }, [
        half ? `${HALF_RATION_HEART} off every heart` : 'nobody goes short',
      ]),
    ]),
    button(
      half ? `Full shares again (${wouldEat} a day)` : `Go onto short commons (${wouldEat} a day)`,
      () => dispatch({ type: 'SET_RATIONS', rations: other }),
      { class: 'action wide' },
    ),
    renderLeaving(state, dispatch),
  ]);
}

/**
 * The door out, and it is deliberately the quietest control on the panel.
 *
 * Walking out measured at saved nobody and killed eleven over 120 paired
 * landings — see src/data/retreat.ts. So it is offered rather than urged: no
 * primary styling, the cost written on the face of it, and a refusal that
 * says WHICH rule is refusing rather than going grey with no explanation. A
 * player who wants to leave can leave; nothing here suggests they should.
 */
function renderLeaving(state: GameState, dispatch: Dispatch): HTMLElement {
  const why = abandonBlocker(state);
  if (why === 'nosteading' || why === 'ended') return el('span');
  const home = state.settlement!;
  if (why !== null) {
    return el('div', { class: 'leave-note' }, [ABANDON_REASON[why]]);
  }
  return el('div', { class: 'leaving' }, [
    button(
      `Leave ${home.name} standing empty`,
      () => dispatch({ type: 'ABANDON' }),
      { class: 'action wide grim' },
    ),
    el('div', { class: 'leave-note' }, [
      `Everything raised here is lost, and ${ABANDON_HEART} off every heart. `
        + 'The stores come with us.',
    ]),
  ]);
}

export function renderNeeds(state: GameState): HTMLElement {
  const needs = [...readNeeds(state)].sort((a, b) => a.level - b.level);
  const panel = el('div', { class: 'needs' });
  panel.append(el('div', { class: 'needs-head' }, [pressureLine(state)]));
  // From autumn, the mark is the most important thing on this screen.
  if (state.day >= 25 && state.settlement && !state.end) {
    const f = forecast(state);
    if (f.days > 0) {
      panel.append(
        el(
          'div',
          {
            class: `needs-mark${f.ready ? ' ready' : ''}${
              !f.ready && !reachable(state) ? ' lost' : ''
            }`,
          },
          // The gap, and then what to DO about it. Measured at 21/120 bands
          // seeing spring without moving hands against 48/120 with — the
          // largest single effect in the game, and until this line existed
          // the panel named the number and never the move.
          [readiness(state), ...counselSpan(state)],
        ),
      );
    }
  }
  for (const need of needs) {
    const pips = Math.round(need.level * 5);
    panel.append(
      el('div', { class: `need${need.level < 0.34 ? ' dire' : ''}` }, [
        el('span', { class: 'need-name' }, [need.name]),
        el('span', { class: 'need-pips' }, ['\u25cf'.repeat(pips) + '\u25cb'.repeat(5 - pips)]),
        el('span', { class: 'need-line' }, [need.line]),
      ]),
    );
  }
  return panel;
}

/**
 * The build queue and everything that could join it. Each entry carries what
 * it answers and what it costs, so choosing is a comparison rather than a
 * memory test.
 */
export function renderBuilds(state: GameState, dispatch: Dispatch): HTMLElement {
  const home = state.settlement!;
  const wrap = el('div', { class: 'builds' });

  const worst = worstNeed(state);
  const offers = offerable(state);
  const suggested = suggestedBuild(
    state,
    offers.filter((b) => buildBlocker(state, b) === null),
  );

  wrap.append(
    el('div', { class: 'builds-head' }, [
      home.queue.length > 0
        ? `On the stocks: ${underway(state)?.name ?? ''} ${Math.round(buildProgress(state) * 100)}%`
        : `Nothing on the stocks. What hurts most is ${worst.name.toLowerCase()}.`,
    ]),
  );

  for (const id of home.queue) {
    const building = buildingById(id);
    if (!building) continue;
    const row = button(
      '',
      () => dispatch({ type: 'UNQUEUE_BUILD', building: building.id }),
      { class: 'build queued', title: 'Cancel — half the timber comes back.' },
    );
    row.replaceChildren(
      el('span', { class: 'build-name' }, [building.name]),
      el('span', { class: 'build-note' }, [
        id === home.queue[0] ? `${Math.round(buildProgress(state) * 100)}% — tap to cancel` : 'waiting',
      ]),
    );
    wrap.append(row);
  }

  for (const building of offers) {
    const blocker = buildBlocker(state, building);
    const node = button(
      '',
      () => dispatch({ type: 'QUEUE_BUILD', building: building.id as BuildingId }),
      {
        class: `build${suggested?.id === building.id ? ' primary' : ''}`,
        title: building.blurb,
      },
    );
    node.replaceChildren(
      el('span', { class: 'build-name' }, [building.name]),
      el('span', { class: 'build-note' }, [
        blocker
          ? blockWord(state, building, blocker)
          : `${building.timber} timber · ${building.works} days · for ${building.answers}`,
      ]),
    );
    if (blocker) node.setAttribute('disabled', 'true');
    wrap.append(node);
  }

  if (home.built.length > 0) {
    // Repeatables stack, and "Búð, Búð, Búð" reads like a stutter — count.
    const counts = new Map<string, number>();
    for (const id of home.built) counts.set(id, (counts.get(id) ?? 0) + 1);
    const names = [...counts].map(
      ([id, n]) => `${buildingById(id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`,
    );
    wrap.append(el('div', { class: 'builds-head' }, [`Standing: ${names.join(', ')}.`]));
  }
  return wrap;
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
      el('span', { class: `crew-name${person.bond === 'hand' ? ' hand' : ''}` }, [
        person.name,
        // Who bears arms and who does not is the whole of 6.2, and it was
        // shipped invisible: a player could not tell which of their people
        // would be standing in the line when a raid came.
        ...(person.bond === 'hand' ? [el('span', { class: 'crew-bond' }, ['hand'])] : []),
      ]),
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

export type ColonyTab = 'work' | 'build';

export function renderColonyActions(
  state: GameState,
  selected: string | null,
  tab: ColonyTab,
  setTab: (tab: ColonyTab) => void,
  dispatch: Dispatch,
): HTMLElement {
  const person = selected ? state.party.people.find((p) => p.id === selected) : undefined;
  if (person) return renderJobPicker(state, person, dispatch);

  const bar = el('div', { class: 'actionbar' });
  bar.append(
    button('Work', () => setTab('work'), {
      class: `action${tab === 'work' ? ' primary' : ''}`,
    }),
    button('Build', () => setTab('build'), {
      class: `action${tab === 'build' ? ' primary' : ''}`,
    }),
    button('Back to the land', () => dispatch({ type: 'LEAVE_COLONY' }), { class: 'action' }),
  );
  return bar;
}

/**
 * The move that closes the mark, when there is a safe one.
 *
 * Its own element so it can be styled apart from the gap above it: one is a
 * measurement and the other is an instruction, and they should not read as
 * one paragraph.
 */
function counselSpan(state: GameState): HTMLElement[] {
  const said = counsel(state);
  return said ? [el('span', { class: 'mark-counsel' }, [counselLine(said)])] : [];
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

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
  hearthMark,
  buildProgress,
  dayLabour,
  idlers,
  jobOf,
  offerable,
  output,
  underway,
  type BlockReason, standsFor } from '../sim/colony';
import { buildWorthLine, pressureLine, readNeeds, suggestedBuild, worstNeed } from '../sim/needs';
import { CROWDING_BITE } from '../sim/minds';
import { wallMark } from '../sim/raid';
import { foodPerDay } from '../sim/upkeep';
import { leaveNote } from '../sim/retreat';
import { HALF_RATION_HEART, tighteningWorth } from '../data/rations';
import { forecast } from '../sim/winter';
import { sickCount } from '../sim/cold';
import { reachable, readiness } from '../sim/reach';
import { counsel, counselLine } from '../sim/counsel';
import { effectiveStat, living } from '../sim/people';
import { plotTally } from '../sim/colony';
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
  // `standsFor`, NOT `built.includes` — the EXPLANATION has to ask the same
  // question as the GATE. `buildBlocker` answers 'after' when `standsFor` is
  // false, so a panel searching `built` can name a prerequisite the gate is
  // perfectly happy with: a band with a great hof has no 'hof' in `built`,
  // and would have been told it needs one.
  //
  // Unreachable today only because every `after` list happens to hold one id
  // — if the one is satisfied, the gate never says 'after' and this never
  // runs. That is precisely how the watchtower bug hid for a whole tier (see
  // sim/colony.ts), so it is fixed as a class rather than waited for.
  const missing = (building.after ?? []).find((id) => !standsFor(state, id));
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
 * What the hall is paying, and how long since anybody fed it.
 *
 * The rule in sim/hall.ts takes up to seven heart a day off a big steading
 * that has not held a feast, and a penalty the player cannot see is not
 * difficulty — it is bad luck with a bill attached. That is the same argument
 * the crowding mark above was written for, stated in the same shape. All the
 * arithmetic and every word of it is `hearthMark`; this only sets it out.
 */
export function renderHearth(state: GameState): HTMLElement {
  const mark = hearthMark(state);
  if (!mark) return el('div');

  return el('div', { class: `room-mark${mark.due ? ' short' : ''}` }, [
    el('div', { class: 'mark-head' }, [mark.head]),
    el('div', { class: 'mark-row' }, [
      el('span', { class: 'mark-name' }, ['Since the feast']),
      el('span', { class: 'mark-value' }, [`${mark.since} ${mark.since === 1 ? 'day' : 'days'}`]),
      el('span', { class: 'mark-gap' }, [mark.gap]),
    ]),
  ]);
}

/**
 * Whether the mead hall is standing open to a torch.
 *
 * Same argument as the hearth mark above, and the same shape. All the words
 * are `wallMark`, in the file that owns the rule, so the panel and the raid
 * cannot come to different conclusions about the same wall.
 */
export function renderWall(state: GameState): HTMLElement {
  const mark = wallMark(state);
  if (!mark) return el('div');

  return el('div', { class: `room-mark${mark.open ? ' short' : ''}` }, [
    el('div', { class: 'mark-head' }, [mark.head]),
    el('div', { class: 'mark-row' }, [
      el('span', { class: 'mark-name' }, ['The mead hall']),
      el('span', { class: 'mark-value' }, [mark.open ? 'unwalled' : 'behind the wall']),
      el('span', { class: 'mark-gap' }, [mark.gap]),
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
        // WORTH, NOT ONLY PRICE (9.7). On full shares this said "nobody goes
        // short", which is reassurance on the one screen where tightening is
        // the largest thing the player can do — measured at 22 bands saved in
        // 120 against 1 lost. Said only when the larder will not reach spring,
        // so it is a fact about THIS winter and not a standing lecture.
        half
          ? `${HALF_RATION_HEART} off every heart`
          : forecast(state).foodGap < 0 ? tighteningWorth() : 'nobody goes short',
      ]),
    ]),
    button(
      half ? `Full shares again (${wouldEat} a day)` : `Go onto short commons (${wouldEat} a day)`,
      () => dispatch({ type: 'SET_RATIONS', rations: other }),
      { class: 'action wide' },
    ),
  ]);
}

/**
 * The door out, and it is deliberately the quietest control on the panel.
 *
 * Walking out measured at saved nobody and killed eleven over 120 paired
 * landings, and 9.14 then swept the one case it had been shipped for — off
 * bad ground, early, before the summer is spent — and found it worse at every
 * threshold: see src/data/retreat.ts. So it is offered rather than urged: no
 * primary styling, the cost written on the face of it, THE RECORD written
 * under the cost, and a refusal that says WHICH rule is refusing rather than
 * going grey with no explanation. A player who wants to leave can leave;
 * nothing here suggests they should, and nothing here hides what happened to
 * the ones who did.
 *
 * LIFTED OUT OF `renderRations` ON 2026-09-05 (12.1). It was nested inside
 * the rations block, so the quietest control on the panel rendered ABOVE the
 * build list — 408px into a 523px slot on a phone, with zero build rows
 * visible behind it (Playwright, 390x844, day 34, six people, 2026-09-04).
 * The colony screen mounts it last now. Rations did NOT move with it: they
 * belong beside the room mark, which is a decision of its own.
 */
export function renderLeaving(state: GameState, dispatch: Dispatch): HTMLElement {
  // Every word of this is `leaveNote`, in the sim, where a test can hold the
  // three parts together without a browser. The panel used to compose them
  // here and composed only two — the price and the refusal — so the RECORD
  // was nowhere and a player could read the whole screen and still believe
  // walking out was an escape.
  const note = leaveNote(state);
  if (!note) return el('span');
  if (!note.open) return el('div', { class: 'leave-note' }, [note.reason ?? '']);
  const home = state.settlement!;
  return el('div', { class: 'leaving' }, [
    button(
      `Leave ${home.name} standing empty`,
      () => dispatch({ type: 'ABANDON' }),
      { class: 'action wide grim' },
    ),
    el('div', { class: 'leave-note' }, [note.price ?? '']),
    // The record goes under the price, in the same quiet class: stated once,
    // never urged.
    el('div', { class: 'leave-note' }, [note.record ?? '']),
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
    // 11.U2: the row named cost and blockers and never worth, while the CSS
    // already flagged one row `primary` with nothing on screen saying why.
    // Blocked rows keep the blocker word alone — a building the band cannot
    // raise yet does not need a reason it would be good.
    const worth = blocker ? undefined : buildWorthLine(state, building);
    const note = el('span', { class: 'build-note' }, [
      blocker
        ? blockWord(state, building, blocker)
        : `${building.timber} timber · ${building.works} days · for ${building.answers}`,
    ]);
    if (worth) note.append(el('span', { class: 'build-worth' }, [worth]));
    node.replaceChildren(
      el('span', { class: 'build-name' }, [building.name]),
      note,
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
    // 12.1: THE INSTRUCTION GOES BESIDE THE THING IT INSTRUCTS. The counsel
    // names the smallest move that closes the winter mark — the largest lever
    // this project has measured (crewed daily 89 of 120 saw spring against 29
    // for a crew set once; paired saved 60, killed 0; balance harness, even,
    // floor 7, 2026-09-05) — and it rendered only on the Build tab, while the
    // roster and the job picker that carry it out are here on Work. Same
    // composer, `counselSpan`, so the two mounts cannot word it differently.
    ...counselSpan(state),
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

  // TWO ROWS, and the split is what each row IS: the top one chooses which
  // view of the steading you are looking at, the bottom one does something.
  // Four across does not fit 320px — `.action` is `flex: 1 1 0` and 'Back to
  // the land' has no room at a quarter of the bar — and the battle screen
  // already stacks two bars this way (`.action-stack`, render/battleUi.ts).
  const tabs = el('div', { class: 'actionbar' });
  tabs.append(
    button('Work', () => setTab('work'), {
      class: `action${tab === 'work' ? ' primary' : ''}`,
    }),
    button('Build', () => setTab('build'), {
      class: `action${tab === 'build' ? ' primary' : ''}`,
    }),
  );

  // 12.1: the yard turns its own days. 'Rest' rather than a new word, because
  // it is the same verb the road offers at home and the same day underneath —
  // see the CAMP branch in sim/actions.ts.
  const doing = el('div', { class: 'actionbar' });
  doing.append(
    button('Rest', () => dispatch({ type: 'CAMP' }), { class: 'action primary' }),
    button('Back to the land', () => dispatch({ type: 'LEAVE_COLONY' }), { class: 'action' }),
  );

  return el('div', { class: 'action-stack' }, [tabs, doing]);
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

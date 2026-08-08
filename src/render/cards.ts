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
import type { LessonDef } from '../data/lessons';
import { GUIDE } from '../data/guide';
import type { Fallen } from '../memorial';
import { MEASURES, MEASURE_MAX } from '../data/sites';
import type { GameState, Person, Purpose } from '../state/types';
import { button, el } from './svg';
import type { Dispatch } from './ui';
import { HARDSHIPS, hardshipById, type HardshipId } from '../data/hardship';
import { lastHardship } from '../hardshipPref';
import { kinPairs } from '../sim/kin';

export function renderTitle(
  hasExistingSave: boolean,
  onContinue: () => void,
  onNew: (seed: string, hardship: HardshipId) => void,
  /** Present only for a player who has already been taught something. */
  onRelearn?: () => void,
  /** Present only once somebody has actually died. */
  onWall?: () => void,
  /** The whole shape of the game, for whoever asks. Always offered. */
  onGuide?: () => void,
): HTMLElement {
  const seedInput = el('input', {
    class: 'seed-input',
    type: 'text',
    placeholder: 'seed (optional)',
    'aria-label': 'World seed',
  });

  // How hard the country is, chosen HERE because it is a term of the run
  // rather than a preference — a saga carries the terms it was played under,
  // and a shared seed has to mean the same thing to two people.
  let picked: HardshipId = lastHardship();
  const hardshipRow = el('div', { class: 'hardship-pick' });
  const hardshipNote = el('p', { class: 'hardship-note' }, []);
  const paintHardship = (): void => {
    hardshipRow.replaceChildren(
      ...HARDSHIPS.map((terms) => {
        const chip = button(terms.name, () => {
          picked = terms.id;
          paintHardship();
        }, { class: `hardship-chip${picked === terms.id ? ' primary' : ''}` });
        return chip;
      }),
    );
    const terms = hardshipById(picked);
    hardshipNote.replaceChildren(`${terms.blurb} ${terms.measured}`);
  };
  paintHardship();

  const buttons = el('div', { class: 'title-buttons' });
  if (hasExistingSave) {
    buttons.append(button('Continue', onContinue, { class: 'primary' }));
  }
  buttons.append(
    button(
      hasExistingSave ? 'New landing' : 'Take the land',
      () => onNew(seedInput.value.trim(), picked),
      { class: hasExistingSave ? '' : 'primary' },
    ),
  );

  return el('div', { class: 'overlay title' }, [
    el('div', { class: 'card' }, [
      el('h1', { class: 'game-title' }, ['LANDNÁM']),
      el('p', { class: 'tagline' }, ['Sail, fight, claim, survive.']),
      el('p', { class: 'blurb' }, [
        'Six of you step off the knarr onto a coast with no name you know. Winter comes on the forty-ninth day.',
      ]),
      hardshipRow,
      hardshipNote,
      buttons,
      seedInput,
      // The guide is for everyone; the two below are offered only to
      // someone with a reason to want them.
      ...(onGuide ? [button('How to play', onGuide, { class: 'relearn' })] : []),
      ...(onWall ? [button('Those who did not come back', onWall, { class: 'relearn wall-link' })] : []),
      ...(onRelearn ? [button('Show the guidance again', onRelearn, { class: 'relearn' })] : []),
      // Which build this is. The only way, from a phone, to tell a fresh
      // deploy from a cached one.
      el('p', { class: 'build-stamp' }, [`build ${__BUILD__}`]),
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
 * The wall: everyone who did not come back, across every run this player has
 * ever started. Deliberately not a stats screen — no counts, no bests, no
 * "runs completed". A memorial is a list of names, and the only number on it
 * is the day each one stops at.
 */
export function renderWall(dead: Fallen[], onClose: () => void): HTMLElement {
  const card = el('div', { class: 'card wall-card' }, [
    el('h2', {}, ['Those Who Did Not Come Back']),
  ]);

  if (dead.length === 0) {
    card.append(
      el('p', { class: 'event-body' }, [
        'Nobody yet. Every band that has gone out is still out there, or has not gone.',
      ]),
    );
  } else {
    const list = el('div', { class: 'wall-list' });
    for (const person of dead) {
      list.append(
        el('div', { class: 'wall-row' }, [
          el('span', { class: 'wall-name' }, [`${person.name} ${person.byname}`]),
          el('span', { class: 'wall-fate' }, [person.fate]),
          el('span', { class: 'wall-day' }, [`day ${person.day}`]),
        ]),
      );
    }
    card.append(list);
  }

  card.append(button('Back', onClose, { class: 'primary wide' }));
  return el('div', { class: 'overlay' }, [card]);
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
    el('p', { class: 'event-body' }, [lesson.body]),
    el('p', { class: 'lesson-point' }, [lesson.point]),
    button('Onward', onDismiss, { class: 'primary wide' }),
  ]);
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

/**
 * The saga as a page of its own. It lived for six phases as a panel pinned
 * under the map; on a phone that was an eighth of the screen spent on
 * history, and the map is the game. Now the map breathes and the chronicle
 * is one tap away, whole instead of three lines at a time.
 */
export function renderSagaBook(
  state: GameState,
  onClose: () => void,
  onGuide?: () => void,
): HTMLElement {
  const list = el('div', { class: 'saga-book' });
  for (const entry of state.saga.slice(-120)) {
    list.append(
      el('p', { class: `saga-line tone-${entry.tone}` }, [
        el('span', { class: 'saga-day' }, [`${entry.day}`]),
        entry.text,
      ]),
    );
  }
  const card = el('div', { class: 'card saga-card' }, [
    el('h2', {}, ['The Saga So Far']),
    list,
    ...(onGuide ? [button('How to play', onGuide, { class: 'relearn' })] : []),
    button('Back', onClose, { class: 'primary wide' }),
  ]);
  // Newest line should be the one you arrive on.
  queueMicrotask(() => {
    list.scrollTop = list.scrollHeight;
  });
  return el('div', { class: 'overlay' }, [card]);
}

export interface SettingsOptions {
  muted: boolean;
  onToggleSound: () => void;
  motionStill: boolean;
  onToggleMotion: () => void;
  /** The current run's seed, when a run exists — the shareable thing. */
  seed?: string;
  /** The terms the current run is being played on. Shown, never edited. */
  hardship?: HardshipId;
  /** Present only for a player who has been taught something. */
  onRelearn?: () => void;
  /** Present only once somebody has died, ever. */
  onWall?: () => void;
  onClose: () => void;
}

/**
 * The settings, gathered in one place: the sound, the motion, the seed,
 * and the two links that used to crowd the title screen. Every row states
 * its current value in words — a bare toggle with no label is a guess.
 */
export function renderSettings(opts: SettingsOptions): HTMLElement {
  const toggleRow = (label: string, value: string, onTap: () => void): HTMLElement => {
    const control = button('', onTap, { class: 'settings-row' });
    control.append(
      el('span', { class: 'settings-name' }, [label]),
      el('span', { class: 'settings-value' }, [value]),
    );
    return control;
  };

  const card = el('div', { class: 'card settings-card' }, [
    el('h2', {}, ['Settings']),
    toggleRow('Sound', opts.muted ? 'Off' : 'On', opts.onToggleSound),
    toggleRow(
      'Motion',
      opts.motionStill ? 'Kept still' : 'With the device',
      opts.onToggleMotion,
    ),
  ]);

  // The terms this run is being played on. Shown and not editable: hardship
  // is chosen when the keel touches sand and belongs to the saga after that,
  // so a shared seed means the same game to two people. Changing it is what
  // the next landing is for.
  if (opts.hardship) {
    const terms = hardshipById(opts.hardship);
    const row = el('div', { class: 'settings-row settings-static' }, [
      el('span', { class: 'settings-name' }, ['This country']),
      el('span', { class: 'settings-value' }, [terms.name]),
    ]);
    card.append(row);
  }

  if (opts.seed) {
    const seed = opts.seed;
    const copy = toggleRow('Seed of this saga', seed, () => {
      void navigator.clipboard?.writeText(seed).then(() => {
        copy.querySelector('.settings-value')!.textContent = 'Copied';
      });
    });
    card.append(copy);
  }

  if (opts.onRelearn) {
    card.append(button('Show the guidance again', opts.onRelearn, { class: 'relearn' }));
  }
  if (opts.onWall) {
    card.append(button('Those who did not come back', opts.onWall, { class: 'relearn wall-link' }));
  }

  card.append(
    el('p', { class: 'build-stamp' }, [`build ${__BUILD__}`]),
    button('Back', opts.onClose, { class: 'primary wide' }),
  );
  return el('div', { class: 'overlay' }, [card]);
}

/**
 * How to play, whole. The lessons stay event-shaped and state-triggered;
 * this is the reference for whoever wants the shape all at once — chosen,
 * never imposed, which is what buys it the right to name buttons.
 */
export function renderGuide(onClose: () => void): HTMLElement {
  const card = el('div', { class: 'card guide-card' }, [el('h2', {}, ['How to Play'])]);
  const list = el('div', { class: 'guide-book' });
  for (const section of GUIDE) {
    list.append(
      el('h3', {}, [section.title]),
      el('p', { class: 'event-body guide-body' }, [section.body]),
    );
  }
  card.append(list, button('Back', onClose, { class: 'primary wide' }));
  return el('div', { class: 'overlay' }, [card]);
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
  return el('div', { class: 'overlay' }, [card]);
}

/**
 * The proclamation. The one card in the game that offers to END the game,
 * and does not insist: 6.4's whole argument is that an endgame reached is
 * not an endgame finished. It names what ruling on will cost, because a
 * choice offered without its price is not a choice.
 */
export function renderProclamation(
  state: GameState,
  onRuleOn: () => void,
  onClose: () => void,
): HTMLElement {
  const jarl = state.jarl!;
  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: 'good' }, ['The Thing Carried It']),
      el('p', { class: 'event-body' }, [
        `${jarl.name} is jarl of ${state.settlement?.name ?? 'this coast'}, and there was nobody ` +
          'here at all when the keel first touched the sand.',
      ]),
      el('p', { class: 'event-body' }, [
        'The saga can be closed on that. Or it can go on — and it will not go ' +
          'on quietly. Every man on this coast now knows exactly whose hall is ' +
          'the richest one, and they will come in greater numbers and better ' +
          'armed than they ever came for a nobody.',
      ]),
      button('Rule on', onRuleOn, { class: 'primary wide' }),
      button('Close the saga here', onClose, { class: 'action secondary wide' }),
    ]),
  ]);
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

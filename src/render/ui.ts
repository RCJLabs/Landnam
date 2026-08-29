// Persistent chrome: the top status bar, the action bar, and the saga log.
// Views only — every button dispatches an Action and re-renders from state.

import type { Action } from '../sim/actions';
import type { GameState } from '../state/types';
import { daysUntilAutumn, daysUntilWinter, effectsOn, seasonOf } from '../sim/calendar';
import { foodPerDay, firewoodPerNight } from '../sim/upkeep';
import { living } from '../sim/people';
import {
  atHome,
  BLOCK_REASON,
  foundBlocker,
  scoreWord,
  reportHere,
  verdictFor,
} from '../sim/site';
import { MEASURES, MEASURE_MAX } from '../data/sites';
import { forecast, markVisible } from '../sim/winter';
import { reachable } from '../sim/reach';
import { holed, sprung, unseaworthy } from '../sim/ship';
import { weatherNext, weatherNow } from '../sim/weather';
import { childrenOf } from '../sim/lineage';
import { ghostLine, isGhostRuin } from '../sim/haunt';
import { yearOf } from '../sim/calendar';
import { wintersStood } from '../sim/calendar';
import { thingNeeds, thingOdds, yearsRuled } from '../sim/thing';
import { autumnChance, autumnRaidDay, threatReading } from '../sim/raid';
import { beats, markOf } from '../sim/challenge';
import { chaseLine } from '../sim/announce';
import { WINTERS_TO_JARL } from '../data/thing';
import { expeditionLine } from '../sim/expedition';
import { placeHere } from '../sim/places';
import { strandTarget } from '../sim/sea';
import { placeKind } from '../data/places';
import { angriest, neighbourHere, neighbourLine, standingOf } from '../sim/neighbours';
import { button, el } from './svg';
import { makeWatch } from './motion';

export type Dispatch = (action: Action) => void;

function stat(label: string, value: string, warn = false, bump = false): HTMLElement {
  return el('div', { class: `stat${warn ? ' warn' : ''}${bump ? ' bumped' : ''}` }, [
    el('span', { class: 'stat-label' }, [label]),
    el('span', { class: 'stat-value' }, [value]),
  ]);
}

/** The top bar's own memory of the numbers, so a change can be pointed at. */
const watchTopBar = makeWatch();

export function renderTopBar(state: GameState): HTMLElement {
  const season = seasonOf(state.day);
  const effects = effectsOn(state.day);
  const untilWinter = daysUntilWinter(state.day);
  const food = Math.floor(state.party.food);
  const wood = Math.floor(state.party.firewood);
  const daysOfFood = Math.floor(food / foodPerDay(state));
  const nightsOfWood = Math.floor(wood / firewoodPerNight(state));

  const band = living(state.party.people).length;
  const heart = Math.round(state.party.morale);
  // Day is deliberately left out: it changes every single turn, so flashing
  // it would train the eye to ignore the whole bar.
  const moved = watchTopBar({ band, food, wood, heart });

  const sky = weatherNow(state);
  const next = weatherNext(state);

  const bar = el('div', { class: 'topbar' }, [
    stat('Day', `${state.day}`),
    stat('Season', effects.label, season === 'winter'),
    // The sky is only worth a slot when it is doing something. Fair weather
    // is three days in four, and a stat that reads "Fair" most of the time
    // teaches the eye to skip the bar — the same reason Day is left out.
    ...(sky.id === 'fair' ? [] : [stat('Sky', sky.label, sky.shutsTheSea || sky.firewood > 0)]),
    // TOMORROW, which is the whole of the weather item: a gale you can see
    // coming is a decision about today, and one you cannot is a dice roll.
    // A slot rather than a hint on purpose — the hint line carries the one
    // thing the player should do next, and a warning that elbowed the
    // strandhogg prompt aside would cost more than it told.
    ...(next.id === 'fair'
      ? []
      : [stat('Tomorrow', next.label, next.shutsTheSea || next.firewood > 0)]),
    stat('Band', `${band}`, band <= 2, moved.band),
    stat('Food', `${food}`, daysOfFood <= 2, moved.food),
    stat('Wood', `${wood}`, nightsOfWood <= 2, moved.wood),
    stat('Heart', `${heart}`, state.party.morale < 30, moved.heart),
  ]);

  // The rule, counted in the only currency it is measured in. Without this
  // the jarldom is a line in the log and nothing on the screen.
  if (state.jarl) {
    const years = yearsRuled(state);
    bar.append(
      el('div', { class: 'jarl-band' }, [
        years > 0
          ? `${state.jarl.name}, jarl — ${years} ${years === 1 ? 'winter' : 'winters'} held`
          : `${state.jarl.name}, jarl of this coast`,
      ]),
    );
  }

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
/**
 * Who was born here.
 *
 * Same shape as the winter and watch marks, which is the rule this file has
 * kept since the mark: the player has already learned to read one of these,
 * and a new kind of panel would be a new thing to learn for no reason.
 * Shown only once there is somebody to show — a steading that has borne
 * nobody says nothing rather than saying "none".
 */
export function renderLine(state: GameState): HTMLElement {
  const born = childrenOf(state);
  if (born.length === 0) return el('div');
  const named = state.party.people;
  return el('div', { class: 'winter-mark line' }, [
    el('div', { class: 'mark-head' }, [
      born.length === 1 ? 'Born on this coast' : `Born on this coast — ${born.length}`,
    ]),
    ...born.map((c) => {
      const mother = named.find((p) => p.id === c.mother);
      const years = Math.max(0, yearOf(state.day) - yearOf(c.bornOn));
      return el('div', { class: 'mark-row' }, [
        el('span', { class: 'mark-name' }, [c.name]),
        el('span', { class: 'mark-value' }, [years === 0 ? 'this year' : `${years} winters`]),
        el('span', { class: 'mark-gap' }, [mother ? `of ${mother.name}` : 'orphaned']),
      ]);
    }),
  ]);
}

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

  // Out of reach is the one thing this panel could never say, and the thing
  // a band on day 26 with no roof most needs to hear. See sim/winter.ts.
  const lost = !f.ready && !reachable(state);
  return el('div', { class: `winter-mark${f.ready ? ' ready' : ''}${lost ? ' lost' : ''}` }, [
    el('div', { class: 'mark-head' }, [
      lost
        ? 'We will not reach spring on what this ground gives'
        : f.days > 24
          ? `The mark for spring, ${f.days} days out`
          : `${f.days} days of winter left`,
    ]),
    row('Food', state.party.food, f.food, f.foodGap),
    row('Wood', state.party.firewood, f.firewood, f.firewoodGap),
  ]);
}

/**
 * What this run is chasing, when it was started from somebody's challenge.
 *
 * Deliberately the same shape as the winter and watch marks: the player has
 * already learned to read one of these, and a fourth kind of panel would be
 * a fourth thing to learn for a number that is only ever one sentence.
 *
 * Shown on every travel screen rather than tucked into the deeds sheet,
 * because a chase is not a detail you go looking for — it is the terms of
 * the run, and the whole complaint that produced this was that it was
 * visible at the start and at the death and never in between.
 */
export function renderChaseMark(state: GameState): HTMLElement {
  if (!state.chasing || state.end || state.event) return el('div');
  const ahead = beats(markOf(state), state.chasing);
  return el('div', { class: `watch-mark chase-mark${ahead ? ' good' : ''}` }, [
    el('div', { class: 'mark-head' }, [chaseLine(state)]),
  ]);
}

/**
 * The watch mark: how likely somebody is to come, and what is making it so.
 *
 * The same trick as the winter mark, which is the most successful panel in
 * this game — name the number, name what moves it, and let the player play
 * against it. Until this, the watch and the wall bought raid-chance down
 * invisibly while winters, buildings and a full store pushed it up
 * invisibly, so defending was guesswork dressed as strategy.
 *
 * Shown at the steading only, and only once the founding grace is over.
 */
export function renderWatchMark(state: GameState): HTMLElement {
  if (state.end || state.event || !state.settlement) return el('div');
  if (!atHome(state)) return el('div');
  const read = threatReading(state);

  if (read.respite > 0) {
    return el('div', { class: 'watch-mark quiet' }, [
      el('div', { class: 'mark-head' }, [
        `Nobody has heard of this place yet — ${read.respite} days of that left`,
      ]),
    ]);
  }
  if (read.chance <= 0 && autumnChance(state) <= 0) {
    return el('div', { class: 'watch-mark quiet' }, [
      el('div', { class: 'mark-head' }, ['The wall and the watch are holding. Nobody is coming.']),
    ]);
  }

  // WHAT THE PANEL IS FOR IS THE AUTUMN, and it used to say the one number
  // that could not be planned against. "A raid about every 469 days" is true
  // and useless in a game whose average run is 172 days: it reads as "never",
  // and a threat that reads as never is why the palisade — worth 47% to 91%
  // on a six-man defence — was the rarest building in the game.
  //
  // The reckoning comes before winter, so that is what the head says, and it
  // says the odds for THIS autumn, which is a number a summer's work can
  // move. The rest of the year keeps the old reading, because the rest of
  // the year is still a background hazard.
  const autumn = seasonOf(state.day) === 'autumn';
  const season = Math.round(autumnChance(state) * 100);
  const passed = autumn && state.day > autumnRaidDay(state);
  const untilAutumn = daysUntilAutumn(state.day);

  const head = passed
    ? 'Nothing came this autumn. The next reckoning is a year off.'
    : autumn
      ? `They come before winter — about ${season} in 100 this autumn`
      : `They come before winter — ${untilAutumn} days until the reckoning`;

  // Under a fortnight between raids is a steading in real trouble; the
  // panel says so in its border rather than in more words.
  const pressed = (autumn && !passed && season >= 50)
    || (read.everyDays !== null && read.everyDays <= 40);
  const panel = el('div', { class: `watch-mark${pressed ? ' dire' : ''}` }, [
    el('div', { class: 'mark-head' }, [head]),
  ]);

  const row = (term: { label: string; amount: number; why: string }, keeps: boolean): HTMLElement =>
    el('div', { class: `mark-row${keeps ? ' good' : ' short'}` }, [
      el('span', { class: 'mark-name wide' }, [term.label]),
      el('span', { class: 'mark-value' }, [`${keeps ? '−' : '+'}${term.amount.toFixed(1)}`]),
      el('span', { class: 'mark-gap' }, [term.why]),
    ]);

  for (const term of read.draws) panel.append(row(term, false));
  for (const term of read.keeps) panel.append(row(term, true));
  if (read.keeps.length === 0) {
    panel.append(
      el('div', { class: 'mark-row short' }, [
        el('span', { class: 'mark-name wide' }, ['Nothing holds them']),
        el('span', { class: 'mark-value' }, ['—']),
        el('span', { class: 'mark-gap' }, ['no wall, no watch']),
      ]),
    );
  }
  return panel;
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
  const report = reportHere(state);

  const home = atHome(state);
  const blocker = foundBlocker(state);
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


/** A hint line telling the player what tapping the map will do. */
export function renderHint(state: GameState): HTMLElement {
  if (state.end) return el('div', { class: 'hint' }, ['The saga is finished.']);
  if (state.event) return el('div', { class: 'hint' }, ['Something needs answering.']);
  // A holed hull is a fact the player must never have to remember unaided —
  // it halves the pace of every sea hex until a night ashore mends it.
  if (unseaworthy(state.ship)) {
    return el('div', { class: 'hint holed' }, [
      `${state.ship.name} has nothing sound left in her — she will not be rowed. Camp ashore to work on her.`,
    ]);
  }
  if (holed(state.ship)) {
    return el('div', { class: 'hint holed' }, [
      `${state.ship.name} is making water — ${sprung(state.ship)} strake${sprung(state.ship) === 1 ? '' : 's'} sprung, and slower for each. Camp ashore to mend her.`,
    ]);
  }
  // AFLOAT BESIDE SOMETHING WORTH TAKING.
  //
  // The strandhögg is a whole way of playing — the ship's way into a place,
  // with its own odds and its own stakes — and it was reachable only by
  // opening the Act sheet on exactly the right hex of water. A band could row
  // straight past a monastery and never learn the chance had been there.
  // Measured over thirty raider sagas: five days afloat beside a target, and
  // the coast is 120 places wide. Nothing about the deed changes here; the
  // player is simply told it exists while they are standing in it.
  const strand = strandTarget(state);
  if (strand) {
    const def = placeKind(strand.kind);
    return el('div', { class: 'hint strand' }, [
      `${def.name[0]!.toUpperCase()}${def.name.slice(1)}, off the bow. They are not watching the water · Act`,
    ]);
  }

  // Standing somewhere that is somewhere: the place introduces itself, and
  // the Act sheet holds the decision about it.
  const here = placeHere(state);
  if (here) {
    const def = placeKind(here.kind);
    // Whose ruin it was: the kind's blurb says what a ruin looks like, and
    // only the ghost knows who died in THIS one. Matched by id rather than by
    // kind, because `abandonSteading` leaves a ruin too — the band's own hall
    // — and a stranger's name does not belong on their posts.
    const whose = isGhostRuin(here) ? ghostLine(state) : undefined;
    // `whose` is appended OUTSIDE the branch on purpose. It used to hang off
    // the un-sacked arm alone, so taking the ruin turned it back into "a
    // steading nobody came back to" for the rest of the run — the coast
    // forgetting the one thing the ghost was there to say. A branch cannot
    // forget what it does not carry.
    const body =
      here.sackedOn !== undefined
        ? `What is left of ${def.name}. It was taken, and it shows.`
        : `${def.name[0]!.toUpperCase()}${def.name.slice(1)}. ${def.blurb}`;
    return el('div', { class: 'hint place' }, [`${body}${whose ? ` ${whose}` : ''}`]);
  }
  if (!state.settlement) {
    // There are no hexes to tap on a coast, and this is the line under the
    // picture for the whole of the walking half of the game — the first
    // instruction a player gets, telling them to do something impossible.
    return el('div', { class: 'hint' }, [
      'Find ground worth holding · walk on up the coast, or open the Chart',
    ]);
  }
  const out = expeditionLine(state);
  if (out) return el('div', { class: 'hint out' }, [out]);
  return el('div', { class: 'hint' }, [
    'The band is at the steading · send a party out to go anywhere',
  ]);
}

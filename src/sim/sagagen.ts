// The saga: a whole run retold as short prose, at the end of it.
//
// Two rules govern this file, and the tests hold it to both.
//
//   1. It only says things that happened. Every chapter is built from state —
//      names, days, counts — and a chapter with nothing behind it is left out
//      entirely rather than padded. A saga that claims a steading you never
//      founded is worse than a short saga.
//   2. It is the same saga every time. The wording is picked with the run's
//      own seed, so re-reading it, reloading it, or sharing it gives back the
//      same text — which is the whole point of shipping the seed with it.

import { stream } from '../rng';
import { exploredFraction } from './coast';
import { terrainDef } from '../data/terrain';
import { clanKind, standingFor } from '../data/clans';
import { known } from './lore';
import { fullName, living } from './people';
import { bladeStanding } from './heirloom';
import { tallyOf } from './tally';
import { verdictFor } from './site';
import { buildingById } from '../data/buildings';
import { stopAt } from './route';
import {
  AT_SEA,
  BLOOD,
  CLOSINGS,
  COUNTRY,
  FALLBACK_CLOSING,
  BLOOD_BLOODLESS,
  FALLEN_ALL,
  FALLEN_MANY,
  FALLEN_ONE,
  HELD_OUTCOME,
  FEUD,
  HELD,
  LANDFALL,
  LANDING_WEATHER,
  LANDTAKING,
  LEARNING,
  NEIGHBOURS_COLD,
  NEIGHBOURS_WARM,
  NONE_FELL,
  RIVAL_FENCED,
  RIVAL_HELD,
  RIVAL_MET,
  RIVAL_MET_DAY,
  RIVAL_UNMET,
  RAISED,
  TITLES,
  TRADED,
  fill,
} from '../data/sagaforms';
import type { GameState, Person, Terrain } from '../state/types';

export interface Chapter {
  heading: string;
  /** One paragraph. Already whole sentences, already past tense. */
  text: string;
}

export interface Saga {
  title: string;
  chapters: Chapter[];
  seed: string;
  /** Day the run ended, for the footer. */
  days: number;
}

/** "once", "twice", "five times" — never "1 times". */
function times(n: number): string {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  return `${n} times`;
}

/** Joins a list the way a person speaks it. */
function list(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The ground the band actually spent its time on. */
function commonestGround(state: GameState): Terrain | undefined {
  const counts = new Map<Terrain, number>();
  // Same count, different address. On a line the ground the band spent its
  // time on is the country of the stretches it stood on, and those are not
  // in `world.tiles` — a stop key looked up there answers undefined, which
  // would leave the saga's country line empty rather than wrong, which is a
  // worse kind of wrong to ship.
  const walked = Object.keys(state.world.trodStops ?? {})
    .map((k) => stopAt(state.seed, Number(k)).country);
  for (const terrain of walked) {
    if (!terrain || terrain === 'ocean') continue;
    counts.set(terrain, (counts.get(terrain) ?? 0) + 1);
  }
  let best: Terrain | undefined;
  let most = 0;
  for (const [terrain, n] of counts) {
    if (n > most) {
      most = n;
      best = terrain;
    }
  }
  return best;
}

/**
 * Whoever the saga hangs the landing on. Not the strongest — the one with the
 * most spirit, because a saga is told about the person who was remembered,
 * and that is rarely the one who could lift the most.
 */
function leaderOf(state: GameState): Person | undefined {
  const crew = state.party.people;
  if (crew.length === 0) return undefined;
  return crew.reduce((best, p) => (p.stats.spirit > best.stats.spirit ? p : best));
}

export function composeSaga(state: GameState): Saga {
  // Derived from the seed AND from how it ended, so two endings on one seed
  // read differently — but each is fixed once it has happened.
  const rng = stream(state.seed, 'saga').derive(`${state.end?.cause ?? 'open'}:${state.day}`);
  const world = state.world;
  const home = state.settlement;
  const tally = tallyOf(state);
  const crew = state.party.people;
  const alive = living(crew);
  // The saga mourns the killed. Somebody who walked out is not among them —
  // the chronicle already recorded them leaving, and a closing verse that
  // grieves a man who is alive and elsewhere reads as a mistake.
  const dead = crew.filter((p) => !p.alive && !p.left);
  const landing = world.landingName || 'the landing';

  // --- Title ---
  const bank = home
    ? state.end?.cause === 'jarl'
      ? TITLES.jarl
      : state.end?.cause === 'survived'
        ? TITLES.stood
        : TITLES.fell
    : alive.length === 0
      ? TITLES.lost
      : TITLES.wandering;
  const title = fill(rng.derive('title').pick(bank), {
    steading: home?.name ?? landing,
    landing,
  });

  const chapters: Chapter[] = [];

  // --- The landing ---
  const leader = leaderOf(state);
  chapters.push({
    heading: 'The Landing',
    text: fill(rng.derive('landfall').pick(LANDFALL), {
      leader: leader ? fullName(leader) : 'They',
      others: `${Math.max(0, crew.length - 1)} others`,
      crew: `${crew.length}`,
      landing,
      weather: rng.derive('weather').pick(LANDING_WEATHER),
    }),
  });

  // --- The country ---
  const walked = Object.keys(world.trodStops ?? {}).length;
  const ground = commonestGround(state);
  const country: string[] = [];
  if (walked > 1 && ground) {
    country.push(
      fill(rng.derive('country').pick(COUNTRY), {
        stretches: `${walked}`,
        seen: `${Math.round(exploredFraction(world) * 100)}%`,
        ground: terrainDef(ground).name.toLowerCase(),
      }),
    );
  }
  if (tally.seaDays > 0) country.push(rng.derive('sea').pick(AT_SEA));
  if (tally.expeditions > 0) {
    country.push(
      tally.expeditions === 1
        ? 'Once, a party went out from the hall and came back with what it found.'
        : `A party went out from the hall ${times(tally.expeditions)}, and what they brought back was the difference.`,
    );
  }
  if (country.length > 0) chapters.push({ heading: 'The Country', text: country.join(' ') });

  // --- The land-taking ---
  if (home) {
    const parts = [
      fill(rng.derive('landtaking').pick(LANDTAKING), {
        day: `${home.foundedOn}`,
        steading: home.name,
        verdict: verdictFor(home.report.total).line,
      }),
    ];
    // Articles are attached here rather than in the forms, because "what they
    // built was longhouse" is the kind of thing that makes a saga read like a
    // spreadsheet with a serif font.
    const built = home.built
      .map((id) => buildingById(id)?.name.toLowerCase())
      .filter((n): n is string => !!n)
      .map((name) => `the ${name}`);
    if (built.length > 0) {
      parts.push(fill(rng.derive('raised').pick(RAISED), { built: list(built) }));
    }
    chapters.push({ heading: 'The Land-Taking', text: parts.join(' ') });
  }

  // --- The other landnám (9.10) ---
  //
  // The rival was real in every run and vanished at the ending, which is the
  // one place a run is actually retold: `sagagen.ts` did not mention him at
  // all. The strip map has marked his hall and his fences for some time, but
  // every one of those marks is gated on `rival.met`, and measured over 60
  // sagas a band comes in sight of his hall in only **32%** of them (40% on
  // fair). So for two runs in three he was a single line on day nine and then
  // silence.
  //
  // Both cases are told, because they are different sagas. What is NOT told
  // is a verdict: he ends a played saga holding 2.0 stretches, and reaches
  // the ~5 his own docstring advertises only in the 8 runs of 60 that go the
  // whole 400 days. A "he beat us" ending would fire almost never and would
  // fire on bands that have already won — see the item.
  //
  // GATED ON `told`, not on his existence. `rivalDay` sets it when the word
  // reaches the band on day nine, and a saga that ends before that never heard
  // of him — so telling it would break this file's second rule, which is that
  // it never claims what did not happen. Caught by looking at a blessed
  // picture of an eleven-day run, not by a test.
  const rival = state.rival;
  if (rival?.told) {
    const held = (rival.claimStops ?? []).length;
    const walked = Object.keys(world.trodStops ?? {}).length;
    const parts = [
      fill(rng.derive('rival').pick(rival.met ? RIVAL_MET : RIVAL_UNMET), {
        leader: rival.leader,
        hall: rival.hall,
      }),
    ];
    // The day, only when the save remembers it. An old saga knows it met him
    // and not when, and a guess printed as a date is the kind of small lie
    // this file exists to avoid.
    if (rival.met && rival.metOn !== undefined) {
      parts.push(fill(rng.derive('metday').pick(RIVAL_MET_DAY), { day: `${rival.metOn}` }));
    }
    // Only worth a sentence once his hand has actually closed on something
    // past the stretch he landed on — one claim is where he starts.
    if (held > 1) {
      parts.push(fill(rng.derive('held').pick(RIVAL_HELD), {
        his: `${held}`,
        ours: `${walked}`,
      }));
      // Derived, not stored: the ground he fenced that we had stood on. It is
      // the game's own phrase — `rivalDay` says "a fence on ground we had
      // walked" — and it is the only part of him that ever cost the band
      // anything, which the harness puts at 30% of sagas.
      const trod = new Set(Object.keys(world.trodStops ?? {}).map(Number));
      if ((rival.claimStops ?? []).some((c) => trod.has(c))) {
        parts.push(rng.derive('fenced').pick(RIVAL_FENCED));
      }
    }
    chapters.push({ heading: 'The Other Landnám', text: parts.join(' ') });
  }

  // --- The neighbours ---
  const met = state.neighbours.filter((n) => n.found);
  if (met.length > 0) {
    const parts: string[] = [];
    const friend = met.reduce((best, n) => (n.standing > best.standing ? n : best));
    const enemy = met.reduce((worst, n) => (n.standing < worst.standing ? n : worst));
    parts.push(
      met.length === 1
        ? `There was one other place within reach of them: ${met[0]!.name}, a ${clanKind(met[0]!.kind).noun}.`
        : `They found ${met.length} other places on that coast — ${list(met.map((n) => n.name))}.`,
    );
    if (friend.standing >= 25) {
      parts.push(fill(rng.derive('warm').pick(NEIGHBOURS_WARM), { friend: friend.name }));
    }
    if (tally.sackings > 0) {
      parts.push(fill(rng.derive('cold').pick(NEIGHBOURS_COLD), { enemy: enemy.name }));
    } else if (enemy.standing <= -35) {
      parts.push(
        `Whatever they did, ${enemy.name} ended ${standingFor(enemy.standing).label.toLowerCase()} toward them.`,
      );
    }
    if (tally.bargains > 0) {
      parts.push(fill(rng.derive('traded').pick(TRADED), { bargains: times(tally.bargains) }));
    }
    chapters.push({ heading: 'The Neighbours', text: parts.join(' ') });
  }

  // --- What they learned ---
  const learned = known(state);
  if (learned.length > 0) {
    chapters.push({
      heading: 'What They Worked Out',
      text: fill(rng.derive('learning').pick(LEARNING), {
        lore: list(learned.map((l) => l.name.toLowerCase())),
      }),
    });
  }

  // --- Blood ---
  const blood: string[] = [];
  if (tally.battles > 0) {
    const bank = tally.foesFelled > 0 ? BLOOD : BLOOD_BLOODLESS;
    blood.push(
      fill(rng.derive('blood').pick(bank), {
        battles: times(tally.battles),
        felled: `${tally.foesFelled}`,
      }),
    );
  }
  if (tally.raids > 0) {
    const outcome =
      tally.raidsHeld >= tally.raids
        ? HELD_OUTCOME.all
        : tally.raidsHeld === 0
          ? HELD_OUTCOME.none
          : HELD_OUTCOME.some;
    blood.push(
      fill(rng.derive('held').pick(HELD), {
        raids: times(tally.raids),
        held: fill(rng.derive('holdout').pick(outcome), { held: `${tally.raidsHeld}` }),
      }),
    );
  }
  const feud = state.grudges.find((g) => g.hardened) ?? state.grudges[0];
  if (feud) {
    const nameOf = (id: string) => crew.find((p) => p.id === id)?.name ?? 'somebody';
    blood.push(fill(rng.derive('feud').pick(FEUD), { a: nameOf(feud.a), b: nameOf(feud.b) }));
  }
  if (dead.length === 1) {
    const one = dead[0]!;
    blood.push(
      fill(rng.derive('fell').pick(FALLEN_ONE), {
        name: fullName(one),
        day: `${one.diedOn ?? state.day}`,
        fate: one.fate ?? 'the land',
      }),
    );
  } else if (dead.length > 1) {
    blood.push(
      fill(rng.derive('fell').pick(dead.length === crew.length ? FALLEN_ALL : FALLEN_MANY), {
        crew: `${crew.length}`,
        dead: `${dead.length}`,
        names: list(dead.map((p) => fullName(p))),
      }),
    );
  } else if (tally.battles > 0) {
    blood.push(rng.derive('whole').pick(NONE_FELL));
  }
  // What the sword did, when it did anything. In `Blood` because that is
  // where the dead are named and the blade only ever moves because somebody
  // died — see sim/heirloom.ts, which is silent for a saga where it stayed
  // on one hip.
  const sword = bladeStanding(state);
  if (sword) blood.push(sword);
  if (blood.length > 0) chapters.push({ heading: 'Blood', text: blood.join(' ') });

  // --- The end ---
  const closingBank = state.end ? CLOSINGS[state.end.cause] : undefined;
  const closing = closingBank ? rng.derive('closing').pick(closingBank) : FALLBACK_CLOSING;
  chapters.push({
    heading: state.end?.title ?? 'And After',
    text: closing,
  });

  return { title, chapters, seed: state.seed, days: state.day };
}

/**
 * The shareable form: plain text, no markup, seed at the foot. This is what
 * goes on the clipboard, so it has to read on its own in a message box with
 * nothing around it.
 */
export function sagaText(saga: Saga): string {
  const body = saga.chapters.map((c) => `${c.heading}\n${c.text}`).join('\n\n');
  return `${saga.title}\n\n${body}\n\n— Landnám · ${saga.days} days · seed "${saga.seed}"`;
}

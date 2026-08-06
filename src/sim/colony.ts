// COLONY logic: the steading's own ground, who works what, and what a day of
// that work is worth.
//
// Labour only happens on days the band is at home. A warband walking the map
// is not tending a farm, and the whole point of settling is that staying put
// starts to pay.

import { key, range, type Hex } from '../hex';
import type { Rng } from '../rng';
import {
  JOBS,
  jobById,
  PLOTS,
  SHELTER_MAX,
  SHELTER_SAVES,
  WATCH_DECAY,
  WATCH_MAX,
  type JobDef,
  type JobId,
  type PlotKind,
} from '../data/jobs';
import type { GameState, Person, Plot, SiteReport, Settlement } from '../state/types';
import { effectsOn } from './calendar';
import { effectiveStat, living } from './people';
import { atHome } from './site';
import { chronicle } from './saga';

/** Rings of local ground around the hall. Nineteen hexes at radius two. */
export const PLOT_RADIUS = 2;

// --- The local map ---

/**
 * Lays out the steading's own ground from the site reading. The hall sits in
 * the middle; how much of the rest is field, wood or water is exactly what the
 * five measures said it would be, so the local map is a picture of the choice
 * the player already made.
 */
export function makePlots(report: SiteReport, centre: Hex, rng: Rng): Plot[] {
  const hexes = range(centre, PLOT_RADIUS);
  const plots: Plot[] = [];

  // Weights straight off the reading. The floor keeps every steading from
  // being wall-to-wall rough ground when the site is poor.
  const weights: [PlotKind, number][] = [
    ['field', 0.4 + report.soil * 1.1],
    ['wood', 0.4 + report.timber * 1.1],
    ['water', report.harbour * 0.9 + report.water * 0.5],
    ['rough', 1.6],
  ];
  const total = weights.reduce((sum, w) => sum + w[1], 0);

  for (const at of hexes) {
    if (at.q === centre.q && at.r === centre.r) {
      plots.push({ at, kind: 'hall' });
      continue;
    }
    let roll = rng.derive(key(at)).float(0, total);
    let kind: PlotKind = 'rough';
    for (const [candidate, weight] of weights) {
      roll -= weight;
      if (roll <= 0) {
        kind = candidate;
        break;
      }
    }
    plots.push({ at, kind });
  }

  // The watch stands on the edge, looking out. Always exactly one, so the
  // warrior always has somewhere to be.
  const edge = plots.filter(
    (p) => p.kind !== 'hall' && Math.max(...[p.at.q - centre.q, p.at.r - centre.r].map(Math.abs)) >= 1,
  );
  const post = edge[Math.floor(rng.derive('watchpost').float(0, edge.length))];
  if (post) post.kind = 'watchpost';

  return plots;
}

/** Plots of a kind the given job works. */
export function plotsFor(settlement: Settlement, job: JobId): Plot[] {
  return settlement.plots.filter((p) => PLOTS[p.kind].worked.includes(job));
}

// --- Assignment ---

export function jobOf(person: Person): JobDef | undefined {
  return person.job ? jobById(person.job) : undefined;
}

/**
 * Jobs that can actually be worked here. A fisher with no water is not a
 * hard-luck story, it is a bug in the panel — so the panel never offers it.
 */
export function availableJobs(state: GameState): JobDef[] {
  const home = state.settlement;
  if (!home) return [];
  return JOBS.filter((job) => {
    if (job.id === 'fisher') return plotsFor(home, 'fisher').length > 0;
    if (job.id === 'farmer') return plotsFor(home, 'farmer').length > 0;
    return true;
  });
}

export function assign(state: GameState, personId: string, job: JobId | null): boolean {
  if (!state.settlement) return false;
  const person = state.party.people.find((p) => p.id === personId);
  if (!person || !person.alive) return false;
  if (job === null) {
    delete person.job;
    return true;
  }
  if (!availableJobs(state).some((j) => j.id === job)) return false;
  person.job = job;
  return true;
}

/** Everyone alive with nothing to do. Idleness is its own small problem. */
export function idlers(state: GameState): Person[] {
  return living(state.party.people).filter((p) => !p.job);
}

// --- A day's work ---

/**
 * What one person's day at this job is worth. Ground and skill multiply: a
 * good farmer on bad soil is still a bad farmer, which is why WHERE you
 * settled and WHO you put on it are the same decision.
 */
export function output(state: GameState, person: Person, job: JobDef): number {
  const home = state.settlement;
  if (!home) return 0;
  const ground = job.floor + home.report[job.measure] * job.perPoint;
  const skill = 0.55 + effectiveStat(person, job.stat) * 0.15;
  return ground * skill * seasonFactor(state.day, job);
}

/**
 * What the year is doing to this job today. A farmer in midwinter is standing
 * in a frozen field; a warrior in midwinter is still a warrior.
 */
export function seasonFactor(day: number, job: JobDef): number {
  return Math.max(0, 1 + job.seasonal * (effectsOn(day).forage - 1));
}

export interface DayLabour {
  food: number;
  firewood: number;
  shelter: number;
  watch: number;
  /** Per-person breakdown, for the panel. */
  byPerson: { id: string; name: string; job: JobId; amount: number }[];
  idle: number;
}

/** What today's assignments would produce. Pure — safe to call from a view. */
export function dayLabour(state: GameState): DayLabour {
  const out: DayLabour = {
    food: 0,
    firewood: 0,
    shelter: 0,
    watch: 0,
    byPerson: [],
    idle: 0,
  };
  if (!state.settlement || !atHome(state)) return out;

  for (const person of living(state.party.people)) {
    const job = jobOf(person);
    if (!job) {
      out.idle += 1;
      continue;
    }
    const amount = output(state, person, job);
    out[job.produces] += amount;
    out.byPerson.push({ id: person.id, name: person.name, job: job.id, amount });
  }
  return out;
}

/** Firewood a night costs after what the builders have put up. */
export function shelterSaving(state: GameState): number {
  const home = state.settlement;
  if (!home || !atHome(state)) return 0;
  return home.shelter * SHELTER_SAVES;
}

/**
 * Resolves one day of work into the stockpiles. Called from the day tick, so
 * it runs exactly once per day and only when the band is home.
 */
export function workTheDay(state: GameState): DayLabour {
  const labour = dayLabour(state);
  const home = state.settlement;
  if (!home) return labour;

  state.party.food += labour.food;
  state.party.firewood += labour.firewood;
  home.shelter = Math.min(SHELTER_MAX, home.shelter + labour.shelter);

  // A watch not stood falls off; a watch stood builds up.
  home.watch = Math.max(0, Math.min(WATCH_MAX, home.watch + labour.watch - WATCH_DECAY));

  // Hands with nothing to do turn on each other. It is a small drag, but it
  // is why leaving people unassigned is never the safe option.
  if (labour.idle > 0) {
    state.party.morale = Math.max(0, state.party.morale - labour.idle * 0.6);
  } else if (labour.byPerson.length > 0) {
    state.party.morale = Math.min(100, state.party.morale + 1);
  }
  return labour;
}

/** A line for the saga on the day the steading first gets properly to work. */
export function noteFirstWork(state: GameState, labour: DayLabour): void {
  if (labour.byPerson.length === 0) return;
  if ((state.flags['workedOnce'] ?? 0) > 0) return;
  state.flags['workedOnce'] = 1;
  chronicle(
    state,
    `The work of ${state.settlement!.name} began: ${labour.byPerson.length} of us to it, and the rest to follow.`,
    'good',
  );
}

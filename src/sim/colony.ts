// COLONY logic: the steading's own ground, who works what, and what a day of
// that work is worth.
//
// The steading is worked by whoever is standing in it. Before there is one,
// nobody works at all; after, the home crew works every day and the hands you
// send out on an expedition are hands that are not farming.

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
import {
  BUILDINGS,
  buildingById,
  type BuildingDef,
  type BuildingId,
} from '../data/buildings';
import { MEASURE_MAX } from '../data/sites';
import type { GameState, Person, Plot, SiteReport, Settlement } from '../state/types';
import { effectsOn } from './calendar';
import { effectiveStat, living, SWORN_MAX } from './people';
import { homeCrew } from './expedition';
import { chronicle } from './saga';
import { bonus, learn } from './lore';
import type { LoreId } from '../data/lore';

/** Rings of local ground around the hall. Nineteen hexes at radius two. */
export const PLOT_RADIUS = 2;

/**
 * The most shelter mending alone can ever reach. Everything above this has to
 * be built and paid for.
 */
export const PATCH_SHELTER_CAP = 1;

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

// --- What is standing ---

export function standing(settlement: Settlement): BuildingDef[] {
  return settlement.built
    .map((id) => buildingById(id))
    .filter((b): b is BuildingDef => !!b);
}

export function hasBuilt(state: GameState, id: BuildingId): boolean {
  return state.settlement?.built.includes(id) ?? false;
}

/**
 * The site's measures AFTER what has been raised on it. Everything that reads
 * the ground reads it through here — farm plots really do make the soil
 * better, which is the whole reason to break them.
 */
export function effectiveReport(state: GameState): SiteReport | undefined {
  const home = state.settlement;
  if (!home) return undefined;
  const out = { ...home.report };
  for (const building of standing(home)) {
    for (const [measure, bump] of Object.entries(building.raises ?? {})) {
      const k = measure as keyof SiteReport;
      out[k] = Math.min(MEASURE_MAX, out[k] + (bump ?? 0));
    }
  }
  out.total = out.water + out.soil + out.timber + out.harbour + out.defence;
  return out;
}

/** Multiplier on food work from anything that keeps what you catch. */
export function foodKeeping(state: GameState): number {
  const home = state.settlement;
  if (!home) return 1;
  return standing(home).reduce((n, b) => n * (b.foodKeep ?? 1), 1);
}

/** Standing daily heart from the buildings that give it. */
export function heartFromBuildings(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  return standing(home).reduce((n, b) => n + (b.heart ?? 0), 0);
}

// --- The build queue ---

export type BlockReason = 'built' | 'queued' | 'ground' | 'after' | 'timber';

/** Why this cannot be raised, or null if it can. */
export function buildBlocker(state: GameState, building: BuildingDef): BlockReason | null {
  const home = state.settlement;
  if (!home) return 'ground';
  if (home.built.includes(building.id)) return 'built';
  if (home.queue.includes(building.id)) return 'queued';
  for (const id of building.after ?? []) {
    if (!home.built.includes(id)) return 'after';
  }
  // Requirements read the RAW ground: a dock cannot conjure a harbour, and
  // reading the effective report here would let a building qualify itself.
  for (const [measure, need] of Object.entries(building.needs ?? {})) {
    if (home.report[measure as keyof SiteReport] < (need ?? 0)) return 'ground';
  }
  if (state.party.firewood < building.timber) return 'timber';
  return null;
}

export function canBuild(state: GameState, building: BuildingDef): boolean {
  return buildBlocker(state, building) === null;
}

/** Everything not yet standing or queued, for the panel. */
export function offerable(state: GameState): BuildingDef[] {
  const home = state.settlement;
  if (!home) return [];
  return BUILDINGS.filter((b) => !home.built.includes(b.id) && !home.queue.includes(b.id));
}

/** What can be raised right now, timber in hand and all. */
export function buildable(state: GameState): BuildingDef[] {
  return offerable(state).filter((b) => canBuild(state, b));
}

/**
 * Queues a building and pays its timber up front. Paying on queue rather than
 * on completion is what makes the choice bite: the wood is gone, and it is
 * gone into THIS rather than into the fire.
 */
export function queueBuild(state: GameState, id: BuildingId): boolean {
  const home = state.settlement;
  const building = buildingById(id);
  if (!home || !building || !canBuild(state, building)) return false;
  state.party.firewood -= building.timber;
  home.queue.push(id);
  return true;
}

/** Cancels a queued building, returning half its timber. Half is the lesson. */
export function unqueueBuild(state: GameState, id: BuildingId): boolean {
  const home = state.settlement;
  const building = buildingById(id);
  if (!home || !building) return false;
  const index = home.queue.indexOf(id);
  if (index < 0) return false;
  home.queue.splice(index, 1);
  state.party.firewood += Math.floor(building.timber / 2);
  // Work banked against the head of the queue is lost with it.
  if (index === 0) home.works = 0;
  return true;
}

export function underway(state: GameState): BuildingDef | undefined {
  const head = state.settlement?.queue[0];
  return head ? buildingById(head) : undefined;
}

/** How far along the thing being built is, 0..1. */
export function buildProgress(state: GameState): number {
  const building = underway(state);
  if (!building || !state.settlement) return 0;
  return Math.max(0, Math.min(1, state.settlement.works / building.works));
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
  const unlocked = new Set(standing(home).map((b) => b.unlocks).filter(Boolean));
  return JOBS.filter((job) => {
    if (unlocked.has(job.id)) return true;
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
  return homeCrew(state).filter((p) => !p.job);
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
  const report = effectiveReport(state)!;
  const ground = job.floor + report[job.measure] * job.perPoint;
  const skill = 0.55 + effectiveStat(person, job.stat) * 0.15;
  const kept = job.produces === 'food' ? foodKeeping(state) : 1;
  return ground * skill * seasonFactor(state.day, job) * kept;
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
  // The steading is worked by whoever is standing in it. Since 4.2 that is
  // the home crew rather than "everyone, if nobody has wandered off" — hands
  // sent out on an expedition are hands not farming, which is the whole cost
  // of sending them.
  if (!state.settlement) return out;

  for (const person of homeCrew(state)) {
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
/**
 * Firewood a night no longer needs: what the roof keeps in, plus what the band
 * has learned about banking a fire. Both live here rather than at the two call
 * sites, because the day tick and the winter forecast MUST agree — a mark that
 * is computed differently from the burn it predicts is worse than no mark.
 */
/**
 * How many the steading has room for.
 *
 * Six under the longhouse roof and no more, until something is built for
 * them. This is what stops 6.2's recruitment from being free the moment
 * there is food, and it gives the build queue a reason to go on existing
 * after the winter is beaten — the first thing in this game that does.
 *
 * A band with no steading is sleeping under a boat and carries its own
 * ceiling: the six who came off the knarr.
 */
export function capacity(state: GameState): number {
  const built = (state.settlement?.built ?? []).reduce(
    (room, id) => room + (buildingById(id)?.room ?? 0),
    0,
  );
  // The knarr and what they can rig off it always sleeps the six who came in
  // it. Without this floor, planting the posts would make a band WORSE off
  // than one still camping — crowded on its own ground until the longhouse
  // went up — and the whole point of the roof is that it is what lets you
  // grow past six, not what lets you have six.
  return Math.max(SWORN_MAX, built);
}

/** How far past its room the steading is. Zero when there is space. */
export function crowding(state: GameState): number {
  return Math.max(0, living(state.party.people).length - capacity(state));
}

export function shelterSaving(state: GameState): number {
  const home = state.settlement;
  // A banked fire is banked wherever you are; a roof needs a roof.
  const learned = bonus(state, 'warmth');
  if (!home) return learned;
  return home.shelter * SHELTER_SAVES + learned;
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

  // Builders' days go into whatever is on the stocks. With nothing queued they
  // patch and mend — which must stay near worthless, because a builder who can
  // reach a full roof by doing nothing in particular makes the longhouse, and
  // the whole queue behind it, pointless.
  if (labour.shelter > 0) {
    if (home.queue.length > 0) {
      home.works += labour.shelter;
      finishBuilds(state);
    } else if (home.shelter < PATCH_SHELTER_CAP) {
      // Guarded: a bare min() here would CLAMP a steading that has already
      // built its way past the cap back down to it, quietly demolishing the
      // longhouse every day a builder had nothing else to do.
      home.shelter = Math.min(PATCH_SHELTER_CAP, home.shelter + labour.shelter * 0.1);
    }
  }

  // A watch not stood falls off; a watch stood builds up.
  home.watch = Math.max(0, Math.min(WATCH_MAX, home.watch + labour.watch - WATCH_DECAY));

  // Hands with nothing to do turn on each other. It is a small drag, but it
  // is why leaving people unassigned is never the safe option.
  if (labour.idle > 0) {
    state.party.morale = Math.max(0, state.party.morale - labour.idle * 0.6);
  } else if (labour.byPerson.length > 0) {
    state.party.morale = Math.min(100, state.party.morale + 1);
  }
  // A hall and a mead bench are worth something every single day.
  state.party.morale = Math.min(100, state.party.morale + heartFromBuildings(state));
  return labour;
}

/**
 * What raising a building teaches, if anything. A dock is a season of looking
 * at hulls out of the water — you do not come away from that not knowing how
 * one is put together.
 */
const TAUGHT_BY_BUILDING: Partial<Record<string, LoreId>> = {
  dock: 'shipwright',
};

/**
 * Completes anything the banked work has paid for. A single day of many
 * builders can finish more than one thing, so this loops.
 */
export function finishBuilds(state: GameState): BuildingDef[] {
  const home = state.settlement;
  if (!home) return [];
  const done: BuildingDef[] = [];
  let guard = 8;
  while (home.queue.length > 0 && guard-- > 0) {
    const building = buildingById(home.queue[0]!);
    if (!building) {
      home.queue.shift();
      continue;
    }
    if (home.works < building.works) break;
    home.works -= building.works;
    home.queue.shift();
    home.built.push(building.id);
    home.shelter = Math.min(SHELTER_MAX, home.shelter + (building.shelter ?? 0));
    done.push(building);
    chronicle(state, `${building.name} stood finished at ${home.name}.`, 'good');
    // Raising a thing teaches you the thing. Not every building has something
    // to teach, which is why this is a lookup rather than a rule.
    const taught = TAUGHT_BY_BUILDING[building.id];
    if (taught) learn(state, taught);
  }
  // Work does not bank past the thing it was for.
  if (home.queue.length === 0) home.works = 0;
  return done;
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

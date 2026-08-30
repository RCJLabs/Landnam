// COLONY logic: the steading's own ground, who works what, and what a day of
// that work is worth.
//
// The steading is worked by whoever is standing in it. Before there is one,
// nobody works at all; after, the home crew works every day and the hands you
// send out on an expedition are hands that are not farming.

import { worldBeat } from './beats';
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
import {
  HEARTH_FREE,
  KEPT_FOR,
  NEGLECTED_AFTER,
  heartPaid,
  sinceKept,
} from './hall';
import { bonus, learn } from './lore';
import type { LoreId } from '../data/lore';

/** Rings of local ground around the hall. Nineteen hexes at radius two. */
export const PLOT_RADIUS = 2;

/**
 * How many plots a steading's ground is cut into.
 *
 * Nineteen, because that is what a radius-2 hex ring held: the yard was a
 * ring of ground you looked down on until Phase 8 drew it side-on, and the
 * count came across with the steadings that already existed. A bag with an
 * index rather than a lattice — see `makePlots`.
 */
export const PLOT_COUNT = 19;

/**
 * The most shelter mending alone can ever reach. Everything above this has to
 * be built and paid for.
 */
export const PATCH_SHELTER_CAP = 1;

/**
 * What one idle hand a day takes off the band's nerve.
 *
 * Named rather than inline because the port generates its constants from
 * this file, and because it is the largest single thing that happens to
 * morale on the day the posts go in: six people with nothing to do yet is
 * -3.6, which swamps the +8 for founding at all.
 */
export const IDLE_BITE = 0.6;

// --- The local map ---

/**
 * Lays out the steading's own ground from the site reading. The hall sits in
 * the middle; how much of the rest is field, wood or water is exactly what the
 * five measures said it would be, so the local map is a picture of the choice
 * the player already made.
 */
export function makePlots(report: SiteReport, rng: Rng): Plot[] {
  // There is no ring of ground around the hall to walk out into — a steading
  // stands on a stretch of shore, and what it has is what the reading said it
  // has. So the SAME number of plots is rolled with the SAME weights, and the
  // only thing that changed is that `at` stopped being a coordinate.
  //
  // `Plot.at` is a slot index now rather than a hex. It was written as
  // `{q: i, r: 0}` while both worlds had to load, which is an index already
  // — the rolls derive off `${i},0` here so a steading built before the
  // hexes went keeps exactly the plots it was built with.
  const slots = Array.from({ length: PLOT_COUNT }, (_, i) => i);
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

  for (const at of slots) {
    if (at === 0) {
      plots.push({ at, kind: 'hall' });
      continue;
    }
    // The derive key is the hex key this slot used to carry — `${i},0` — so
    // the same steading rolls the same plots it rolled before the hexes went.
    let roll = rng.derive(`${at},0`).float(0, total);
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
  const edge = plots.filter((p) => p.kind !== 'hall');
  const post = edge[Math.floor(rng.derive('watchpost').float(0, edge.length))];
  if (post) post.kind = 'watchpost';

  return plots;
}

/**
 * Plot kinds present, for the panel's summary of the ground.
 *
 * Was in `render/colony.ts`, which drew the hex ring and is gone. It is a
 * question about the state rather than about the picture — which is why it
 * belongs here and why it never should have been over there.
 */
export function plotTally(state: GameState): { kind: string; name: string; count: number }[] {
  const home = state.settlement;
  if (!home) return [];
  const counts = new Map<string, number>();
  for (const plot of home.plots) counts.set(plot.kind, (counts.get(plot.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, name: PLOTS[kind as keyof typeof PLOTS].name, count }))
    .sort((a, b) => b.count - a.count);
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
 * Whether this steading has the thing `id` DOES, by whatever now does it.
 *
 * A great hall is a longhouse; earthworks are a palisade. Every question of
 * the form "is there a wall here?" has to go through this, because an
 * upgrade removes what it replaces — and the first cut of tiering silently
 * took the palisade off the raid battlefield, ended the Thing's mead-hall
 * requirement, and switched off two event cards, all without a test
 * failing. `hasBuilt` is still the right call when the exact building is
 * what matters; this is the right one when its ROLE is.
 */
export function standsFor(state: GameState, id: BuildingId): boolean {
  const built = state.settlement?.built;
  if (!built) return false;
  if (built.includes(id)) return true;
  return built.some((up) => {
    // Walk the chain: earthworks -> palisade, and any tier above it.
    let def = buildingById(up);
    let guard = 8;
    while (def?.replaces && guard-- > 0) {
      if (def.replaces === id) return true;
      def = buildingById(def.replaces);
    }
    return false;
  });
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

/** The heart everything standing WOULD give, before the hall is asked whether it has been kept. */
export function heartRaised(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  return standing(home).reduce((n, b) => n + (b.heart ?? 0), 0);
}

/** Standing daily heart from the buildings that give it. */
export function heartFromBuildings(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  // A HALL PAYS WHILE IT IS KEPT, not for having been built. This used to
  // return the raised total whole, every day, for ever, and that annuity is
  // what made a jarldom unkillable — see sim/hall.ts for the measurement. The
  // first point is still free, so a young band with a longhouse and nothing
  // else is exactly where it was.
  return heartPaid(state, heartRaised(state));
}

/**
 * What the hall is paying, in words, for the colony panel to say out loud.
 *
 * Here rather than in the renderer because it is arithmetic and a choice of
 * wording, both of which can be got wrong and neither of which a screenshot
 * would catch. It sits beside `heartFromBuildings` so the panel and the sim
 * cannot come to different conclusions about the same hall.
 *
 * `null` when there is nothing to say: no steading, or nothing standing worth
 * more than the free point, in which case the rule cannot cost the band
 * anything and a line about it would only be noise on a young band's screen.
 */
export interface HearthMark {
  /** The state of the hall, in the chronicle's voice. */
  head: string;
  /** Days since the last feast. */
  since: number;
  /** Heart a day being lost to neglect. Zero while the hall is kept. */
  short: number;
  /** The right-hand column: the shortfall, or what is being paid. */
  gap: string;
  /** Whether the feast is overdue — what colours the mark. */
  due: boolean;
}

export function hearthMark(state: GameState): HearthMark | null {
  const raised = heartRaised(state);
  if (!state.settlement || raised <= HEARTH_FREE) return null;

  const since = sinceKept(state);
  const short = Math.round((raised - heartPaid(state, raised)) * 10) / 10;
  const cold = since >= NEGLECTED_AFTER;
  const due = since > KEPT_FOR;

  return {
    head: cold ? 'The hall is cold' : due ? 'The hall has gone quiet' : 'The hall is glad',
    since,
    short,
    gap: short > 0 ? `${short} off every heart` : `${raised} to every heart`,
    due,
  };
}

// --- The build queue ---

export type BlockReason = 'built' | 'queued' | 'ground' | 'after' | 'timber' | 'room';

/** Why this cannot be raised, or null if it can. */
export function buildBlocker(state: GameState, building: BuildingDef): BlockReason | null {
  const home = state.settlement;
  if (!home) return 'ground';
  // Already standing, OR already superseded. The second half is not
  // theoretical: an upgrade removes what it replaces, so without this the
  // longhouse becomes buildable again the moment the great hall goes up —
  // caught by the scarcity bot, which cheerfully built
  // "...greathall > longhouse" and would have looped there forever.
  if (standsFor(state, building.id)) {
    // A repeatable is never simply "already built" — that is the whole of
    // what it is — but another hut with nobody to sleep in it is timber
    // burned. The queue goes on forever only while the steading keeps
    // outgrowing itself, which is the honest reason to raise another.
    if (building.repeat !== 'crowded') return 'built';
    if (crowding(state) <= 0) return 'room';
  }
  if (home.queue.includes(building.id)) return 'queued';
  for (const id of building.after ?? []) {
    if (!home.built.includes(id)) return 'after';
  }
  // An upgrade needs the thing it replaces actually standing.
  if (building.replaces && !home.built.includes(building.replaces)) return 'after';
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
  return BUILDINGS.filter(
    (b) => (b.repeat || !standsFor(state, b.id)) && !home.queue.includes(b.id),
  );
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
  /** Tending given today. Spent the same day — see data/jobs.ts. */
  care: number;
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
    care: 0,
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
    state.party.morale = Math.max(0, state.party.morale - labour.idle * IDLE_BITE);
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
    // An upgrade comes down on top of what it replaces: the old building
    // leaves the list and takes its grants with it, so nothing is counted
    // twice. Shelter is the only grant held as a running total rather than
    // re-derived from `built`, so it is the only one to unwind by hand.
    const replaced = building.replaces ? buildingById(building.replaces) : undefined;
    if (replaced) {
      const at = home.built.indexOf(replaced.id);
      if (at >= 0) home.built.splice(at, 1);
      home.shelter = Math.max(0, home.shelter - (replaced.shelter ?? 0));
    }
    home.built.push(building.id);
    home.shelter = Math.min(SHELTER_MAX, home.shelter + (building.shelter ?? 0));
    done.push(building);
    worldBeat(state, { kind: 'built', building: building.id });
    chronicle(
      state,
      replaced
        ? `${replaced.name} came down and ${building.name} stood in its place at ${home.name}.`
        : `${building.name} stood finished at ${home.name}.`,
      'good',
    );
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

// The first winter. Twenty-four days on which the land gives nothing back and
// the fire has to be fed four times a night.
//
// The whole design of this milestone is one claim: when a colony dies in the
// dark, the player was told the number and chose not to meet it. Everything
// here exists to make that claim true — the forecast walks the remaining days
// with YOUR people on YOUR jobs at the season factors they will actually face,
// so the target it prints is a simulation of your plan rather than a rule of
// thumb someone tuned by feel.

import type { GameState, Injury, Person } from '../state/types';
import {
  effectsOn,
  floorDepth,
  nextThaw,
  seasonOf,
  winterDepth,
  WINTER_BITE_MAX,
  WINTER_DEPTH_MAX,
} from './calendar';
import {
  availableJobs,
  buildBlocker,
  dayLabour,
  jobOf,
  output,
  seasonFactor,
  shelterSaving,
} from './colony';
import { SHELTER_SAVES } from '../data/jobs';
import { BUILDINGS, buildingById } from '../data/buildings';
import { hardshipById } from '../data/hardship';
import { living } from './people';
import { chronicle } from './saga';
import { mourn } from './kin';
import { bonus } from './lore';
import { firewoodPerNight, foodPerDay } from './upkeep';
import { stream } from '../rng';
import { weatherOn } from './weather';

/** Winter opens on day 49. Spring — and survival — on day 73. */
export const WINTER_DAY = 49;

/** How much more than the forecast to bank. The weather is not a mean. */
export const PRUDENCE = 1.15;

/**
 * How far out the mark starts being shown: the turn of autumn. Before 4.6 the
 * panel was gated on "day 25 or later", which meant the same thing exactly
 * once. It has to be a window now, because the year comes round again.
 */
export const MARK_WINDOW = 48;

/** Inside this many days the mark is exact, as it always was. */
export const HAZE_CLEARS = 20;
/** Over this many further days the haze grows to its full width. */
export const HAZE_RANGE = 40;
/** The most the mark can be out by, as a fraction of what it asks for. */
export const HAZE_MAX = 0.3;

export interface Forecast {
  /** Days between now and the ice breaking. */
  days: number;
  /** Food that must be in the store today to reach spring on this plan. */
  food: number;
  /** Firewood likewise. */
  firewood: number;
  /** What is actually in hand, minus what is needed. Negative is a shortfall. */
  foodGap: number;
  firewoodGap: number;
  /** True when both stores clear the target. */
  ready: boolean;
  /**
   * How far the true figure may sit either side of the one shown, as a
   * fraction. Zero once winter is close enough to read properly.
   */
  haze: number;
}

/**
 * Walks every remaining day and adds up what the band will fail to produce.
 *
 * Deliberately projects the CURRENT assignments forward: a colony that has
 * everyone farming is told, correctly, that its fields will stop in twenty
 * days and it will starve. Change the plan and the number changes with it.
 */
export function forecast(state: GameState): Forecast {
  // Whichever thaw is next. Before 4.6 this was the single day the run ended
  // on; the mark now points at the winter actually coming.
  const days = Math.max(0, nextThaw(state.day) - state.day);
  const home = state.settlement;
  const crew = living(state.party.people);

  let food = 0;
  let firewood = 0;
  const saved = shelterSaving(state);

  for (let i = 1; i <= days; i++) {
    const day = state.day + i;
    // The larder's own helper, never a second copy of its arithmetic — see
    // the note on `foodPerDay`. The projected crew IS the living band here,
    // so this is the same number it always was, and it stays the same number
    // when what a mouth means changes.
    const mouths = foodPerDay(state);
    // Same helper the day tick burns from, so the mark cannot lie.
    // What the band can HONESTLY plan on. Close to, it knows this winter;
    // far out it knows only the floor and the middle of the range, which is
    // exactly the gamble — stock to the mark and a hard year catches you.
    const fire = Math.max(0, plannedFirewood(state, day) - saved);

    let grown = 0;
    let cut = 0;
    if (home) {
      for (const person of crew) {
        const job = jobOf(person);
        if (!job) continue;
        // Same maths the day tick will use, at that day's season factor.
        const amount = output(state, person, job) * ratio(state.day, day, job.seasonal);
        if (job.produces === 'food') grown += amount;
        else if (job.produces === 'firewood') cut += amount;
      }
    }

    food += Math.max(0, mouths - grown);
    firewood += Math.max(0, fire - cut);
  }

  const haze = markHaze(state.day);
  const needFood = Math.round(food * PRUDENCE);
  const needWood = Math.round(firewood * PRUDENCE);
  return {
    days,
    haze,
    food: needFood,
    firewood: needWood,
    foodGap: Math.round(state.party.food) - needFood,
    firewoodGap: Math.round(state.party.firewood) - needWood,
    ready: state.party.food >= needFood && state.party.firewood >= needWood,
  };
}

/**
 * How vague the mark is, as a fraction of what it asks for.
 *
 * This is the answer to a measured failure. Three separate attempts to make
 * the late game dangerous — raid pressure at three magnitudes, winters that
 * deepen with the years — moved survival to the second winter by exactly
 * zero, and the reason was this function's absence: the mark walked every
 * remaining day with your actual people on their actual jobs and told you the
 * true number, so raising winter's cost only raised a figure the player was
 * handed for free and could always out-work.
 *
 * A forecast far out is a guess. Close to, it is a reading. The haze shuts
 * fully once the ice is near enough to see, so 3.4's promise — the game told
 * you the number — still holds where the band can act on it, and the risk
 * lands on the long-range planning where it belongs.
 */
export function markHaze(day: number): number {
  const out = Math.max(0, nextThaw(day) - day);
  if (out <= HAZE_CLEARS) return 0;
  const far = Math.min(1, (out - HAZE_CLEARS) / HAZE_RANGE);
  return HAZE_MAX * far;
}

/**
 * The firewood a night the band should plan for.
 *
 * Once the haze has cleared this is simply the truth. Before that it is the
 * floor the years guarantee plus the MIDDLE of the range the luck can add —
 * so a band that stocks exactly to the mark has provisioned for an average
 * winter and will come up short in a bad one. That shortfall is the entire
 * point: the forecast used to be an oracle, and an oracle is what made every
 * attempt to threaten the late game bounce off.
 */
function plannedFirewood(state: GameState, day: number, best = false): number {
  const terms = hardshipById(state.hardship).winter;
  if (seasonOf(day) !== 'winter') return effectsOn(day).firewood;
  const base = effectsOn(day).firewood + floorDepth(day);
  // Close enough to read, so the weather is part of the reading — the same
  // term `firewoodPerNight` adds to the actual burn. If the fire felt a frost
  // the mark did not, the mark would be quietly short by exactly the frosts
  // between here and the thaw, which is the one thing it must never be.
  //
  // NOT added to the hazy branch below, deliberately: a band cannot see a
  // gale forty days out, and that branch exists to be a guess.
  if (markHaze(state.day) === 0) {
    const sky = weatherOn(state.seed, day).firewood;
    return Math.max(0, effectsOn(day, state.seed).firewood + sky) * terms;
  }
  // The MARK plans for a middling winter on purpose — an oracle is what made
  // every attempt to threaten the late game bounce off. The VERDICT is a
  // different question: "is there any version of this that works" cannot be
  // answered against a winter that has not happened yet and might not. So the
  // ceiling gets the mildest winter the years guarantee, the same best case
  // `bestShelter` already grants the roof.
  if (best) return base * terms;
  return (
    Math.min(
      effectsOn(day).firewood + WINTER_DEPTH_MAX,
      base + Math.round(WINTER_BITE_MAX / 2),
    ) * terms
  );
}

/** Re-scales today's output to another day's season. */
function ratio(today: number, then: number, seasonal: number): number {
  const now = 1 + seasonal * (effectsOn(today).forage - 1);
  const later = 1 + seasonal * (effectsOn(then).forage - 1);
  if (now <= 0) return 0;
  return Math.max(0, later) / now;
}

/** One line naming where the band stands against the winter. */
/**
 * Whether the mark can still be met AT ALL, from here, at full effort.
 *
 * The winter mark has always told the truth about the gap and never about
 * whether the gap can be closed. A phone playtest found the difference the
 * hard way: day 26, no roof, nought wood of two hundred and seventy-four, a
 * band with forty-seven days to spring and no arrangement of six people that
 * reaches it — told only that they were "274 short", which reads like a
 * target. The harness then put a number on it: a band that settles by day 16
 * sees spring 21% of the time and one that settles on day 29 sees it 4%.
 * That is a cliff, and a cliff nobody is warned about is not difficulty.
 *
 * Deliberately NOT a parallel model. It reassigns a clone and asks the very
 * forecast the mark itself reads, so the two can never disagree — the same
 * rule that keeps the mark honest against the day tick.
 */
export function reachable(state: GameState): boolean {
  if (!state.settlement) return true;
  if (forecast(state).ready) return true;

  const crew = living(state.party.people);
  if (crew.length === 0) return false;
  const jobs = availableJobs(state);
  const onFoodJob = jobs.find((j) => j.id === 'hunter') ?? jobs.find((j) => j.produces === 'food');
  const onWoodJob = jobs.find((j) => j.produces === 'firewood');
  if (!onFoodJob || !onWoodJob) return false;

  // One projection, with the band free to move people between food and wood
  // as each day demands. A FIXED split was the first attempt and it fired on
  // 62 of 63 settled bands — no information at all beside a 76% base death
  // rate — because no single split survives a whole year: real bands hunt
  // while hunting is good and cut while the wood is dry, and a verdict has
  // to grant them that much sense before calling them dead.
  void crew;
  void onFoodJob;
  void onWoodJob;
  return survivesWinter(state);
}

/**
 * The shelter to plan the best case around.
 *
 * A roofless band burns firewood at a rate no six people can cut, which is
 * most of what killed the reported save — so a projection that leaves them
 * roofless condemns every band that has not built yet, including every band
 * that is about to. The best case therefore assumes the longhouse goes up:
 * free, instantly, timber and builder-days ignored. That is not a claim
 * about what will happen, it is the ceiling on what could, and a verdict
 * that only fires beneath the ceiling is a verdict worth trusting.
 */
function bestShelter(state: GameState): number {
  const roof = buildingById('longhouse')?.shelter ?? 3;
  return Math.max(shelterSaving(state), roof * SHELTER_SAVES + bonus(state, 'warmth'));
}

/**
 * The steading to plan the best case around — the same argument as
 * `bestShelter`, finally applied to the work as well as to the warmth.
 *
 * `bestShelter` has said since 6.1 that a projection which leaves the band
 * roofless condemns everyone who is about to build. That reasoning stopped at
 * the roof, and the harness caught what it cost: the verdict "we will not
 * reach spring on what this ground gives" was put to 26 bands in 60 sagas and
 * 12 of them saw spring anyway — 46% wrong, on a panel that does not hedge.
 * The wrongly condemned were not luckier or larger (5.4 hands against 5.3);
 * they were further along and still building, and they raised four and a half
 * more houses before the thaw that this walk credited them with none of.
 *
 * So the ceiling grants the buildings the band can actually PAY for, and
 * charges the wood — builder-days are forgiven, timber is not. The first cut
 * of this forgave timber too, on `bestShelter`'s precedent, and `cliff.test`
 * caught it immediately: a band on the best ground in the world with nought
 * wood was handed a whole steading and read as saveable. Timber IS firewood
 * here — the very store the walk goes on to spend — so a grant that ignores
 * it is not an optimistic projection, it is a different game.
 *
 * What it will not grant is anything the site itself refuses:
 * `buildBlocker` reads the raw report for that, so a band on bad ground is
 * still told the truth about it, which is the whole reason this verdict
 * exists.
 */
function bestSteading(state: GameState): GameState {
  const home = state.settlement;
  if (!home) return state;
  const built = [...home.built];
  // Its own party, because granting a building spends the wood.
  const probe: GameState = {
    ...state,
    party: { ...state.party },
    // The queue is emptied so `buildBlocker` reports what the ground allows
    // rather than what is already on the stocks.
    settlement: { ...home, built, queue: [] },
  };

  // Cheapest first, so a hut the band can afford is never crowded out by a
  // hall it cannot. Passes, not one sweep: `after` chains and `replaces`
  // mean granting one house is what makes the next one legal.
  const order = [...BUILDINGS].sort((a, b) => a.timber - b.timber);
  for (let pass = 0; pass < BUILDINGS.length; pass += 1) {
    let added = false;
    for (const b of order) {
      if (built.includes(b.id)) continue;
      // Null only — 'timber' means the wood is not there, and this ceiling
      // does not conjure wood.
      if (buildBlocker(probe, b) !== null) continue;
      // An upgrade takes the place of what it replaces rather than standing
      // beside it — without this the great hall would leave the longhouse in
      // the list and the band would be sheltered by both.
      if (b.replaces) {
        const at = built.indexOf(b.replaces);
        if (at >= 0) built.splice(at, 1);
      }
      built.push(b.id);
      probe.party.firewood -= b.timber;
      added = true;
    }
    if (!added) break;
  }
  return probe;
}

/**
 * Walks the stores forward day by day, letting the band move between food
 * and wood as each day demands, and reports whether they ever go under.
 *
 * This is NOT the forecast, and the difference is why the first cut of
 * `reachable` was wrong twice. `forecast` answers "what must be banked
 * TODAY", flooring each day's surplus at zero — deliberately, because a mark
 * that spends an imagined autumn is a mark that lies. That makes it useless
 * for "can they get there": it never credits the productive days still
 * ahead, so a healthy day-10 band with twenty of each read as doomed.
 * Replacing it with a projection under a FIXED split was the second miss —
 * no single split survives a year, so it condemned 62 of 63 settled bands.
 *
 * Same per-day helpers as the forecast and the day tick, so the three cannot
 * drift apart.
 */
function survivesWinter(state: GameState): boolean {
  // Two strategies, and the ceiling is the better of them: spend the wood on
  // the houses it will buy, or keep it and burn it. Building is not always
  // right — timber spent in a cold autumn is timber not burned in the dark —
  // so a "can this be done at all" verdict has to try both rather than
  // assume the band builds.
  // And on short commons, which is the winter lever: a verdict that ignored
  // it would go on telling bands they are dead when the game now hands them
  // something to do about it. The band eats less in every one of these walks
  // — `foodPerDay` reads `party.rations`, so this is one clone and no second
  // copy of the arithmetic.
  const lean = { ...state, party: { ...state.party, rations: 'half' as const } };
  return walkWinter(state, state)
    || walkWinter(state, bestSteading(state))
    || walkWinter(lean, lean)
    || walkWinter(lean, bestSteading(lean));
}

/**
 * One projection: `state` for the calendar and the crew, `steading` for what
 * they have to work with and what is in the store.
 */
function walkWinter(state: GameState, steading: GameState): boolean {
  const days = Math.max(0, nextThaw(state.day) - state.day);
  const crew = living(state.party.people);
  const saved = bestShelter(steading);
  const jobs = availableJobs(steading);
  // NOTE — a measured, deliberate limitation, not an oversight. This picks
  // the hunter by name rather than the best food trade available, so a band
  // whose ground and houses make a farmer the better bet is projected on the
  // wrong work. Taking the max over every producing job instead reads truer
  // and cuts the verdict's error from 33% to 29% — but it also flips
  // `cliff.test`'s pivot band (nought of both, day 40, the best site in the
  // world) from doomed to saveable, and that band being lost is a statement
  // about the game's difficulty rather than about this projection. Left
  // alone until that call is made.
  const foodJob = jobs.find((j) => j.id === 'hunter') ?? jobs.find((j) => j.produces === 'food');
  const woodJob = jobs.find((j) => j.produces === 'firewood');
  if (!foodJob || !woodJob) return false;

  // What each person is worth on either job. Fixed for the run: output()
  // reads the person and the steading, neither of which this changes.
  const asFood = crew.map((p) => output(steading, p, foodJob));
  const asWood = crew.map((p) => output(steading, p, woodJob));

  let food = steading.party.food;
  let wood = steading.party.firewood;

  for (let i = 1; i <= days; i += 1) {
    const day = state.day + i;
    // The larder's own helper, never a second copy of its arithmetic — see
    // the note on `foodPerDay`. The projected crew IS the living band here,
    // so this is the same number it always was, and it stays the same number
    // when what a mouth means changes.
    const mouths = foodPerDay(state);
    const fire = Math.max(0, plannedFirewood(state, day, true) - saved);
    const foodRatio = ratio(state.day, day, foodJob.seasonal);
    const woodRatio = ratio(state.day, day, woodJob.seasonal);

    // Today's best arrangement: the one leaving the band furthest from
    // running out of EITHER store, counted in days of cover so a day's food
    // and a day's fire weigh the same. It is what a person would do.
    let keepFood = -Infinity;
    let keepWood = -Infinity;
    let best = -Infinity;
    for (let onFood = 0; onFood <= crew.length; onFood += 1) {
      let grown = 0;
      let cut = 0;
      for (let p = 0; p < crew.length; p += 1) {
        if (p < onFood) grown += asFood[p]! * foodRatio;
        else cut += asWood[p]! * woodRatio;
      }
      const nextFood = food + grown - mouths;
      const nextWood = wood + cut - fire;
      const worst = Math.min(nextFood / Math.max(1, mouths), nextWood / Math.max(1, fire));
      if (worst > best) {
        best = worst;
        keepFood = nextFood;
        keepWood = nextWood;
      }
    }
    food = keepFood;
    wood = keepWood;
    if (food < 0 || wood < 0) return false;
  }
  return true;
}

export function readiness(state: GameState): string {
  const f = forecast(state);
  // Out of season the mark is not a live target, so it does not read like one.
  if (!markVisible(state)) return 'The ice has broken. We lived.';
  if (f.ready) {
    return `Stores will reach spring: ${f.food} food and ${f.firewood} wood is the mark, and we are past both.`;
  }
  const short: string[] = [];
  if (f.foodGap < 0) short.push(`${-f.foodGap} short of food`);
  if (f.firewoodGap < 0) short.push(`${-f.firewoodGap} short of wood`);
  const gap = `To see spring we need ${f.food} food and ${f.firewood} wood. We are ${short.join(' and ')}.`;
  // The one thing the mark never said. Told plainly and told EARLY, with
  // what is actually left to try — a band in this position can still rob
  // the coast, and being told so on day 26 is fair where finding out on
  // day 50 is not.
  if (!reachable(state)) {
    return `${gap} We cannot cut or hunt our way to that from here. What is left is taking it from somebody else, or walking out and wintering elsewhere.`;
  }
  return gap;
}

// --- Sickness ---

const ILLNESSES: Omit<Injury, 'id'>[] = [
  { label: 'A cough that will not clear', effect: { might: -1 }, heals: 14 },
  { label: 'Fever in the night', effect: { spirit: -1, wits: -1 }, heals: 12 },
  { label: 'Frostbitten hands', effect: { craft: -2 }, heals: 20 },
  { label: 'Something on the lungs', effect: { might: -1, spirit: -1 }, heals: 18 },
];

export const SICKNESS_BASE_DC = 9;

/**
 * Whether the mark is worth putting on screen. A number the player cannot act
 * on yet is noise, and a winter target shown through high summer is noise for
 * two whole seasons.
 */
export function markVisible(state: GameState): boolean {
  if (state.end || !state.settlement) return false;
  const days = forecast(state).days;
  return days > 0 && days <= MARK_WINDOW;
}

/** True while the ground is too hard for anything to mend properly. */
export function frozen(day: number): boolean {
  return seasonOf(day) === 'winter';
}

/**
 * A cold night without fire. Everyone rolls; shelter and spirit are what stand
 * between a bad night and a bad month.
 */
export function coldNight(state: GameState, severity: number): Person[] {
  const home = state.settlement;
  const shelter = home ? home.shelter : 0;
  const rng = stream(state.seed, 'colony').derive(`cold:${state.day}`);
  const fell: Person[] = [];

  for (const person of living(state.party.people)) {
    // Already ill and still cold: it gets worse rather than doubling up.
    const alreadyIll = person.injuries.some((i) => i.id.startsWith('ill_'));
    const roll =
      rng.derive(person.id).roll(2, 6) +
      Math.floor(person.stats.spirit / 2) +
      shelter +
      // Knowing what to do for a cold body is worth as much as the roof over it.
      bonus(state, 'physic');
    // Later winters do not merely burn more wood; they are colder.
    if (roll >= SICKNESS_BASE_DC + severity + Math.floor(winterDepth(state.seed, state.day) / 2)) continue;

    if (alreadyIll) {
      person.health = Math.max(0, person.health - 2);
    } else {
      const template = rng.derive(`what:${person.id}`).pick(ILLNESSES);
      person.injuries.push({ ...template, id: `ill_${state.day}_${person.id}` });
      person.health = Math.max(0, person.health - 2);
      fell.push(person);
    }

    if (person.health <= 0) {
      person.alive = false;
      person.fate = 'the sickness of that winter';
      person.diedOn = state.day;
      chronicle(state, `${person.name} did not wake. It was the cold that did it.`, 'grim');
      mourn(state, person);
    }
  }

  if (fell.length > 0) {
    // Sickness in a small band is a morale event as much as a health one.
    state.party.morale = Math.max(0, state.party.morale - fell.length * 3);
    chronicle(
      state,
      fell.length === 1
        ? `${fell[0]!.name} took ill in the night — ${fell[0]!.injuries[fell[0]!.injuries.length - 1]!.label.toLowerCase()}.`
        : `${fell.length} of us went down sick in the same week.`,
      'grim',
    );
  }
  return fell;
}

/** How many of the band are carrying an illness right now. */
export function sickCount(state: GameState): number {
  return living(state.party.people).filter((p) => p.injuries.some((i) => i.id.startsWith('ill_')))
    .length;
}

// --- Telegraphing it ---

/**
 * Saga warnings at the points where there is still time to act. Fires at most
 * once each, so a long autumn does not become a nagging.
 */
export function telegraphWinter(state: GameState): void {
  if (!state.settlement) return;
  const f = forecast(state);

  const warn = (flag: string, text: string): void => {
    if ((state.flags[flag] ?? 0) > 0) return;
    state.flags[flag] = 1;
    chronicle(state, text, 'saga');
  };

  // The turn of autumn: the first honest reckoning of what is needed.
  if (state.day >= 25 && state.day < WINTER_DAY) {
    warn(
      'winterTargetGiven',
      `The nights drew in and we counted what we had. To see spring we would need ${f.food} of food and ${f.firewood} of wood laid by. ${
        f.ready ? 'We had it, and more.' : 'We did not have it yet.'
      }`,
    );
  }

  // A week out, when there is still time to cut wood but not to grow food.
  if (state.day >= WINTER_DAY - 7 && state.day < WINTER_DAY && !f.ready) {
    warn(
      'winterLastWarning',
      `Seven days from the dark, and the store was short: ${
        f.foodGap < 0 ? `${-f.foodGap} of food` : ''
      }${f.foodGap < 0 && f.firewoodGap < 0 ? ' and ' : ''}${
        f.firewoodGap < 0 ? `${-f.firewoodGap} of wood` : ''
      }. Everyone knew it.`,
    );
  }

  if (state.day === WINTER_DAY) {
    warn(
      'winterOpened',
      f.ready
        ? 'Winter closed over us with the store full. We had done what could be done.'
        : 'Winter closed over us short, and we had known it was coming.',
    );
  }
}

/**
 * The run-end verdict on the winter. Says plainly whether the band was warned
 * and what it did about it — the milestone's whole point is that a death in
 * the dark is never a surprise.
 */
export function winterVerdict(state: GameState): string | undefined {
  if (!state.settlement) return undefined;
  const warned = (state.flags['winterTargetGiven'] ?? 0) > 0;
  const short = (state.flags['winterLastWarning'] ?? 0) > 0;
  if (!warned) return undefined;
  if (state.end?.cause === 'survived') {
    return short
      ? 'We went into the dark short, and came out of it anyway. It was closer than anyone says now.'
      : 'We had counted right in the autumn, and the counting held.';
  }
  return short
    ? 'We had been told the number in the autumn, and we went into the dark without it.'
    : 'The store had looked like enough in the autumn. It was not.';
}

/** True when the day is one the fire cannot be allowed to go out. */
export function bitingCold(day: number): boolean {
  return effectsOn(day).firewood >= 3;
}

/** The projected daily take, for the panel. Zero away from home. */
export function todaysTake(state: GameState): { food: number; firewood: number } {
  const take = dayLabour(state);
  return { food: take.food, firewood: take.firewood };
}

/** Re-exported so the panel does not have to reach into two modules. */
export { seasonFactor, shelterSaving, firewoodPerNight, foodPerDay };

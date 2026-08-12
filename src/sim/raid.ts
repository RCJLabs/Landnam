// Somebody else wants what you built.
//
// A raid is the only fight where losing costs more than people: the raiders
// are not passing through, they came for the store and the roof. That is what
// makes the palisade worth eight timber and a week of somebody's hands.

import { stream } from '../rng';
import { buildingById } from '../data/buildings';
import type { GameState } from '../state/types';
import { effectiveReport } from './colony';
import { foeCapFor, foeCount, standing } from './battle';
import { angerLevel, raidPressure } from './neighbours';
import { hands, sworn } from './people';
import { wintersStood } from './calendar';
import { fieldCrew } from './expedition';
import { wordBump } from './word';
import { hardshipById } from '../data/hardship';
import { chronicle } from './saga';
import { mourn } from './kin';
import { learn } from './lore';
import { note } from './tally';

/** What share of the store a successful sack carries off. */
export const SACK_SHARE = 0.4;

/** Raiders will not cross the whole country for a hovel. */
export const RAID_EARLIEST_DAY = 12;

export interface Sack {
  food: number;
  firewood: number;
  /** Building id burned, if any. */
  burned?: string;
  /** Names of the hands carried off. */
  taken: string[];
}

/**
 * The most hands a single sacking carries off.
 *
 * This is the conclusion of five measured levers, every one of which failed
 * for the same reason. Raid pressure, deeper winters, a vaguer mark, bigger
 * raids, more frequent raids: all of them priced the threat in food,
 * firewood or timber, and a settled band replaces material faster than
 * anything in the game can take it. The survival curve did not move once.
 *
 * Losing has to cost the thing 6.2 deliberately made scarce. A sacking that
 * carries people off takes labour that has to be recruited back, room that
 * has to be kept, and — because the warband is fixed at six — it cannot be
 * answered by fielding more of your own.
 *
 * Hands only. The sworn who were going to die did so on the field; a raid
 * that also carried off the warband would end runs by dice rather than by
 * decision.
 */
export const SACK_TAKES = 2;

/**
 * How hard the raid is. Bigger settlements are worth robbing, so the longer
 * you stand the more they bring — but a defensible site and a watch that is
 * actually kept both take the edge off.
 */
/**
 * What a building on the ground adds to how worth robbing you look.
 * Visible wealth: a coast can count roofs from a ridge.
 */
export const WORTH_PER_ROOF = 0.4;

/**
 * What a point of defensibility takes back off it — site, palisade,
 * watchtower and earthworks together.
 *
 * Raised from 0.18, and the reason is arithmetic rather than taste. At 0.18
 * a palisade cost 0.4 of difficulty for being another roof and returned
 * 2 x 0.18 = 0.36, so **building a palisade made raids very slightly
 * HARDER** (+0.04 net) and a watchtower plainly harder (+0.22). Every
 * defensive building in the game except earthworks was a trap, which is why
 * sixty sagas held two raids of forty and no amount of preparing moved it.
 * At 0.5 a palisade is worth -0.6 and a watchtower -0.6, so the things whose
 * whole purpose is defence finally pay for themselves.
 */
export const DEFENCE_PER = 0.5;

/** And a point of watch kept. A watch not kept decays, which is the point. */
export const WATCH_PER = 0.2;

export function raidDifficulty(state: GameState): number {
  const home = state.settlement;
  if (!home) return 0;
  const worthTaking =
    home.built.length * WORTH_PER_ROOF + Math.min(3, state.party.food / 40);
  const warned = effectiveReport(state)!.defence * DEFENCE_PER + home.watch * WATCH_PER;
  // Whoever you have wronged brings more of their own. This is the whole
  // reason a neighbour is a persistent object and not a card.
  //
  // The ceiling is above what rollFoes can actually field (MAX_RAIDERS), so
  // that a site worth watching still reads as safer than one that is not even
  // when both are already bringing everything they have. Clamping at the foe
  // cap would flatten the two into the same number and quietly delete the
  // reason to build a palisade.
  // Ten, not six. The old ceiling sat at the point where rollFoes saturated
  // against a band of six, so anything the coast felt about you past that was
  // silently discarded — which is why raid pressure measured as worthless.
  return Math.max(-1, Math.min(10, Math.round(worthTaking - warned + raidPressure(state))));
}

/** Days between raids at the very worst. Nobody is besieged every week. */
export const RAID_RESPITE = 14;

/** The most likely a single day can be, however rich and however hated. */
export const RAID_CHANCE_MAX = 0.055;

/**
 * What a point of being-worth-taking is worth as a daily chance.
 *
 * Tuned against test/thing.test.ts rather than against the survival curve,
 * because that test carries a promise the survival curve cannot see: a band
 * that builds the hall, keeps the peace and makes a friend must be able to
 * reach the endgame. Measured across the four bands in that test — at 0.006
 * one of the four got there, at 0.003 three did, and at 0.0015 all four do.
 * A raid every other year for a rich hall is a hazard; one every season is a
 * siege that eats the mead hall before the Thing can be called in it.
 */
const CHANCE_PER_WORTH = 0.0015;

/**
 * The chance, on a given day, that somebody comes for the steading.
 *
 * Raids used to arrive ONLY as event cards, which made their frequency a
 * function of the deck rather than of the steading: measured across whole
 * sagas, roughly one run in four never saw a single raid, and about three
 * quarters of runs saw at most one. A threat that mostly does not happen
 * cannot decide a run however large it is when it does — which is why making
 * raids bigger in 6.3 moved the curve by nothing.
 *
 * This is the other half. A hall that has stood years, is full of building,
 * and has a winter's food in it is worth crossing the country for, and a
 * coast with a grievance needs less excuse. The watch and the wall buy it
 * back down, which is the first thing in the game that has ever made the
 * watch worth standing on a quiet day.
 *
 * Deliberately capped low. This is a background hazard, not a siege: at the
 * ceiling it is about one raid a month, and a well-watched steading nobody
 * has a quarrel with sits far below that.
 */
/** One line of the reading: what it is, and what it is worth. */
export interface ThreatTerm {
  label: string;
  /** In the same units as `worth` — positive draws them, positive keeps. */
  amount: number;
  /** The plain reason, for the panel's second line. */
  why: string;
}

export interface ThreatReading {
  /** Chance per day that somebody comes. */
  chance: number;
  /** Roughly one raid every this many days, or null when nothing is coming. */
  everyDays: number | null;
  /** Days of grace left after founding, or 0. */
  respite: number;
  draws: ThreatTerm[];
  keeps: ThreatTerm[];
  /** True when the watch and the wall are holding it all off. */
  quiet: boolean;
}

/**
 * The chance, on a given day, that somebody comes for the steading —
 * BROKEN OUT, because a player defending against a number they cannot see
 * is guessing.
 *
 * This is the winter mark's trick applied to the other clock, and the rule
 * that makes the winter mark trustworthy applies here too: the panel must
 * not be a second model. `raidOdds` is this function's `chance` field and
 * nothing else, so what the player reads is arithmetically the thing the
 * dice are rolled against.
 *
 * Raids used to arrive ONLY as event cards, which made their frequency a
 * function of the deck rather than of the steading: measured across whole
 * sagas, roughly one run in four never saw a single raid. A threat that
 * mostly does not happen cannot decide a run however large it is when it
 * does — which is why making raids bigger in 6.3 moved the curve by nothing.
 *
 * Deliberately capped low. This is a background hazard, not a siege: at the
 * ceiling it is about one raid a month, and a well-watched steading nobody
 * has a quarrel with sits far below that.
 */
export function threatReading(state: GameState): ThreatReading {
  const nothing: ThreatReading = {
    chance: 0, everyDays: null, respite: 0, draws: [], keeps: [], quiet: true,
  };
  const home = state.settlement;
  if (!home || state.end) return nothing;
  // Nothing comes for a place that has only just been marked out.
  const respite = Math.max(0, RAID_RESPITE - (state.day - home.foundedOn));
  if (respite > 0) return { ...nothing, respite };

  const years = wintersStood(state.day) * 0.6;
  const raised = home.built.length * 0.35;
  const stores = Math.min(3, state.party.food / 50);
  const grievance = angerLevel(state) / 45;
  const wall = effectiveReport(state)!.defence * 0.22;
  const watch = home.watch * 0.16;

  const draws: ThreatTerm[] = [
    { label: 'Winters stood', amount: years, why: 'a hall that has lasted is worth coming for' },
    { label: 'What is raised', amount: raised, why: `${home.built.length} standing` },
    { label: 'What is in the store', amount: stores, why: 'a full store travels well' },
    { label: 'Who is angry', amount: grievance, why: 'somebody on this coast owes us blood' },
  ].filter((t) => t.amount > 0.01);
  const keeps: ThreatTerm[] = [
    { label: 'The wall', amount: wall, why: 'ground they have to come at' },
    { label: 'The watch', amount: watch, why: 'trouble seen before it arrives' },
  ].filter((t) => t.amount > 0.01);

  const drawn = Math.max(0, years + raised + stores + grievance - wall - watch);
  // RAID_CHANCE_MAX is a safety valve, not a state the game reaches: a
  // steading nine winters old, ten buildings deep, full to the rafters and
  // hated by the whole coast reads about 0.021 against a 0.055 ceiling —
  // roughly fifty-five winters short of touching it. There is deliberately
  // no "as bad as it gets" in the panel, because the panel would never get
  // to say it. Written down here so nobody builds on it later.
  const chance = Math.min(RAID_CHANCE_MAX, drawn * CHANCE_PER_WORTH * hardshipById(state.hardship).raid);
  return {
    chance,
    everyDays: chance > 0 ? Math.round(1 / chance) : null,
    respite: 0,
    draws,
    keeps,
    quiet: drawn <= 0,
  };
}

export function raidOdds(state: GameState): number {
  return threatReading(state).chance;
}

/**
 * True when a raid could happen at all. Deliberately not gated on the band
 * being home: a steading whose warriors are three days out is exactly the one
 * worth coming for, and that is the cost of sending them.
 */
export function raidable(state: GameState): boolean {
  return !!state.settlement && state.day >= RAID_EARLIEST_DAY;
}

/**
 * The steading is sacked. Called when a raid is lost — they take a share of
 * the store and put a torch to something.
 *
 * A palisade does not stop this once the line has broken, but it is why the
 * line usually does not break.
 */
export function sackSteading(state: GameState): Sack {
  const home = state.settlement!;
  const rng = stream(state.seed, 'events').derive(`sack:${state.day}`);

  const food = Math.round(state.party.food * SACK_SHARE);
  const firewood = Math.round(state.party.firewood * SACK_SHARE);
  state.party.food = Math.max(0, state.party.food - food);
  state.party.firewood = Math.max(0, state.party.firewood - firewood);

  const out: Sack = { food, firewood, taken: [] };

  // And they take people. Hands, not sworn — see SACK_TAKES.
  const takeable = hands(state.party.people);
  for (const person of rng.shuffle(takeable).slice(0, SACK_TAKES)) {
    person.alive = false;
    person.fate = `was carried off when ${home.name} was sacked`;
    person.diedOn = state.day;
    mourn(state, person);
    out.taken.push(person.name);
  }
  if (out.taken.length > 0) {
    chronicle(
      state,
      `${out.taken.join(' and ')} went with them, and we could not stop it.`,
      'grim',
    );
  }

  // Something burns. The longhouse is the last thing they fire, because it is
  // full of people — everything else goes first.
  // The roof over everyone survives a sacking, whichever tier it is.
  const burnable = home.built.filter((id) => id !== 'longhouse' && id !== 'greathall');
  const target = burnable.length > 0 ? rng.pick(burnable) : home.built[0];
  if (target) {
    home.built = home.built.filter((id) => id !== target);
    const def = buildingById(target);
    // Whatever it granted goes with it.
    if (def?.shelter) home.shelter = Math.max(0, home.shelter - def.shelter);
    out.burned = target;
    chronicle(state, `They fired the ${def?.name.toLowerCase() ?? target}. It burned all night.`, 'grim');
  }

  home.watch = 0;
  state.party.morale = Math.max(0, state.party.morale - 14);
  chronicle(
    state,
    food > 0 || firewood > 0
      ? `They took ${food} of food and ${firewood} of wood out of ${home.name}, and we watched them do it.`
      : `They went through ${home.name} and found little worth carrying.`,
    'grim',
  );
  return out;
}

/** Holding the ground. They leave what they were carrying, and their dead. */
export function holdSteading(state: GameState, foesDown: number): void {
  const home = state.settlement!;
  state.party.morale = Math.min(100, state.party.morale + 12);
  // A line that held is a line you can now explain to somebody. Nothing else
  // in the game teaches this, because nothing else is a line that held.
  if (foesDown > 0) learn(state, 'shieldcraft');
  note(state, 'raidsHeld');
  chronicle(
    state,
    foesDown > 0
      ? `They broke on ${home.name} and left ${foesDown} of their own in the yard.`
      : `They looked at ${home.name}, and thought better of it.`,
    'good',
  );
}

/** A count of the defenders still on their feet, for the raid's log line. */
export function defendersLeft(state: GameState): number {
  const battle = state.battle;
  return battle ? standing(battle, 'warband').length : 0;
}

/**
 * What the band is walking into if it draws steel on a camp: how many of us
 * are standing here, and how many of them will come out.
 *
 * Falling on a camp was the ONLY deed the game offered blind. Calling a
 * Thing states its odds and its cost, bartering states what it carries in,
 * a strandhögg says what the ship is worth — and the most consequential,
 * least reversible choice on the sheet said only "Draw steel." It docks
 * REP_RAIDED the instant it is tapped, it is measured at a five percent win
 * rate, and it kills people for good. A player deserves to see the shape of
 * it first.
 *
 * Uses `foeCount`, which the fight itself uses, so the two cannot drift.
 */
export function fallOnReport(
  state: GameState,
  might: number,
): { ours: number; theirs: number } {
  const ours = sworn(fieldCrew(state)).length;
  const theirs = foeCount(
    Math.max(1, ours),
    might + wordBump(state),
    false,
    foeCapFor(state),
  );
  return { ours, theirs };
}

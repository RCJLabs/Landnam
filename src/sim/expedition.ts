// Parties sent out from the steading, and the hands they cost while they are
// gone.
//
// Before the posts go in, the whole band walks together and this file has
// nothing to say. After, the steading is where people live: to go anywhere at
// all you send a party, and everyone you send is somebody who is not farming,
// cutting or standing the watch while they are away.

import { daysBetween } from './route';
import { standingAt } from './coast';
import { stream } from '../rng';
import type { GameState, Person, Purpose } from '../state/types';
import { effectiveStat, living, sworn } from './people';
import { chronicle } from './saga';
import { note } from './tally';
import { atHome } from './site';
import { atSeaAway } from './voyage';
import { worldBeat } from './beats';
import { hold } from './ship';

/** Provisions a party takes per member per day it expects to be out. */
export const PROVISION_PER_HEAD = 3;

/** Nobody sends the whole steading and leaves the fire unattended. */
export const MIN_HOME_CREW = 1;

export interface PurposeDef {
  id: Purpose;
  name: string;
  blurb: string;
  /** Multiplier on the chance of something happening out there. */
  stir: number;
  /** Extra hexes of sight while out. */
  sight: number;
}

export const PURPOSES: PurposeDef[] = [
  {
    id: 'explore',
    name: 'Look at the country',
    blurb: 'Walk out and see what is there. Quiet work, and the map is worth having.',
    stir: 0.85,
    sight: 1,
  },
  {
    id: 'trade',
    name: 'Go out to barter',
    blurb: 'Carry food out and bring timber and goods back. Nobody looks for a fight.',
    stir: 0.7,
    sight: 0,
  },
  {
    id: 'fish',
    name: 'Take the boat out to the fishing',
    blurb: 'Row out to a ground we know and work it while it lasts. The best '
      + 'food in the country, and only a crew afloat on it can have any.',
    // Quiet work by design. A fishing crew is not looking for anybody, and
    // the ground is close enough to home that there is little country to
    // find on the way — the errand's value is the catch, not the stir.
    stir: 0.8,
    sight: 0,
  },
  {
    id: 'raid',
    name: 'Go out under arms',
    blurb: 'Find somebody worth taking from. What you win, you carry home.',
    stir: 1.45,
    sight: 0,
  },
  {
    id: 'home',
    name: 'Sail east for home',
    blurb: 'Take the knarr across the open sea to the country we came from, and '
      + 'come back with people who want land. Most of a year, and the hall keeps '
      + 'the winter without them.',
    // Neither is read for a voyage — she is off the map, so there is nothing
    // to stir and nothing to see. They are here because PurposeDef says so.
    stir: 0,
    sight: 0,
  },
];

export function purposeDef(id: Purpose): PurposeDef {
  return PURPOSES.find((p) => p.id === id) ?? PURPOSES[0]!;
}

// --- Who is where ---

/** True once the steading exists and nobody has gone out. */
export function everyoneHome(state: GameState): boolean {
  return !!state.settlement && !state.expedition;
}

/**
 * The people out on the world map — the ones a field battle is fought with.
 *
 * A crew over the open sea is on nobody's map, so they are not here either.
 */
export function fieldCrew(state: GameState): Person[] {
  const here = living(state.party.people).filter((p) => !atSeaAway(state, p));
  const out = state.expedition;
  if (!out) return here;
  return here.filter((p) => out.members.includes(p.id));
}

/**
 * The people at the steading — the ones who work it, and who defend it.
 *
 * Whoever is away over the sea is neither. That is the whole cost of a
 * voyage: not a fee, but a season of hands, through the part of the year
 * that needs them.
 */
export function homeCrew(state: GameState): Person[] {
  if (!state.settlement) return [];
  const here = living(state.party.people).filter((p) => !atSeaAway(state, p));
  const out = state.expedition;
  if (!out) return here;
  return here.filter((p) => !out.members.includes(p.id));
}

export function isOut(state: GameState, person: Person): boolean {
  return state.expedition?.members.includes(person.id) ?? false;
}

/** How far from home they have got, in days of walking. */
export function distanceFromHome(state: GameState): number {
  if (!state.settlement) return 0;
  return daysBetween(state.seed, standingAt(state), state.settlement.stop ?? 0);
}

// --- Launching ---

export type LaunchBlock = 'nosteading' | 'away' | 'already' | 'nobody' | 'unmanned';

export function launchBlocker(state: GameState, members: string[]): LaunchBlock | null {
  if (!state.settlement) return 'nosteading';
  if (state.expedition) return 'already';
  if (!atHome(state)) return 'away';
  const crew = living(state.party.people);
  const going = crew.filter((p) => members.includes(p.id));
  if (going.length === 0) return 'nobody';
  if (crew.length - going.length < MIN_HOME_CREW) return 'unmanned';
  // NO STORES GATE. It used to refuse the launch when the steading could not
  // provision the party in full, and that closed the only door out of a
  // steading at exactly the moment a player needs it.
  //
  // A settled band cannot forage or hunt — `canGather` is false at home — so
  // once the store is empty the ONLY way to get food is to leave, and leaving
  // was the thing being refused. Reported from a phone: day 52, winter, three
  // hands, food 0, the panel saying "we will not reach spring on what this
  // ground gives" and every legal action unable to change it. That is a trap,
  // not a hard game.
  //
  // The cost did not go away, it became proportional: `launch` carries
  // whatever the store can spare, so a rich steading pays the full price and
  // a starving one sends its people out with nothing — which is a decision
  // with a real consequence rather than a locked door.
  return null;
}

export const LAUNCH_REASON: Record<LaunchBlock, string> = {
  nosteading: 'There is nowhere to come back to yet.',
  away: 'They would have to set out from the steading.',
  already: 'A party is already out.',
  nobody: 'Somebody has to go.',
  unmanned: 'Somebody has to stay and keep the fire.',
};

/** What it costs to send this many people out. */
export function provisionsFor(count: number): number {
  return count * PROVISION_PER_HEAD;
}

export function launch(state: GameState, members: string[], purpose: Purpose): boolean {
  if (launchBlocker(state, members) !== null) return false;
  const going = living(state.party.people).filter((p) => members.includes(p.id));
  // What the store can spare, not what the trip wants. Never more than there
  // is — see launchBlocker for why an empty store must not forbid the trip.
  // What the knarr will hold caps what goes out. A whole hull holds more than
  // the backs aboard her, so this never binds on a sound ship — it binds
  // exactly when she is sprung, which is the point: a damaged hull is a
  // shorter errand, not merely a slower one.
  const carried = Math.min(
    provisionsFor(going.length),
    hold(state.ship),
    Math.max(0, state.party.food),
  );
  state.party.food -= carried;

  note(state, 'expeditions');
  state.expedition = {
    members: going.map((p) => p.id),
    purpose,
    launchedOn: state.day,
    carried,
  };
  worldBeat(state, {
    kind: 'wentOut', purpose, crew: going.map((p) => p.id), carried,
  });
  chronicle(
    state,
    `${listNames(going)} went out from ${state.settlement!.name} ${purposeLine(purpose)}.`,
    'plain',
  );
  return true;
}

function purposeLine(purpose: Purpose): string {
  switch (purpose) {
    case 'raid':
      return 'under arms';
    case 'trade':
      return 'to barter';
    case 'fish':
      return 'to the fishing';
    default:
      return 'to see the country';
  }
}

function listNames(people: Person[]): string {
  const names = people.map((p) => p.name);
  if (names.length <= 1) return names[0] ?? 'Nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Turns them for home. The map still has to be walked. */
export function turnForHome(state: GameState): boolean {
  const out = state.expedition;
  if (!out || out.returning) return false;
  out.returning = true;
  chronicle(state, 'We turned for home.', 'plain');
  return true;
}

// --- Coming back ---

/**
 * Folds a returned party back into the steading. Called from the day tick the
 * moment they are standing on their own ground again.
 */
export function arriveHome(state: GameState): boolean {
  const out = state.expedition;
  const home = state.settlement;
  if (!out || !home) return false;
  // `atHome`, not a hex comparison: on a coast `home.at` and `party.at` are
  // both the frozen landing hex, so this was TRUE from every stretch of the
  // line — an expedition folded itself back into a steading it was twelve
  // stretches away from. The generous direction again, which is why nothing
  // caught it.
  if (!atHome(state)) return false;

  const days = Math.max(1, state.day - out.launchedOn);
  const crew = living(state.party.people).filter((p) => out.members.includes(p.id));

  // Whatever provisions came back go into the store.
  const left = Math.max(0, Math.round(out.carried - days * crew.length * 0.6));
  state.party.food += left;

  if (out.purpose === 'trade' && crew.length > 0) {
    // Barter: what they carried out comes back as timber and goodwill. The
    // sharpest head in the party decides how well they did.
    const sharp = crew.reduce((best, p) =>
      effectiveStat(p, 'wits') > effectiveStat(best, 'wits') ? p : best,
    );
    const rng = stream(state.seed, 'events').derive(`trade:${out.launchedOn}`);
    const wood = Math.round(
      days * crew.length * (0.6 + effectiveStat(sharp, 'wits') * 0.25) * rng.float(0.8, 1.25),
    );
    state.party.firewood += wood;
    state.party.morale = Math.min(100, state.party.morale + 4);
    chronicle(
      state,
      wood > 0
        ? `${sharp.name} came back to ${home.name} with ${wood} of timber and a good account of it.`
        : `They came back to ${home.name} with nothing anybody wanted.`,
      wood > 0 ? 'good' : 'plain',
    );
  } else {
    chronicle(
      state,
      `${listNames(crew)} came back to ${home.name} after ${days} days.`,
      'plain',
    );
  }

  worldBeat(state, {
    kind: 'cameHome', purpose: out.purpose, crew: out.members.slice(), days,
  });
  delete state.expedition;
  return true;
}

/** Everyone on the expedition is dead: the party is simply gone. */
export function pruneExpedition(state: GameState): void {
  const out = state.expedition;
  if (!out) return;
  const alive = out.members.filter((id) =>
    state.party.people.some((p) => p.id === id && p.alive),
  );
  if (alive.length === out.members.length) return;
  if (alive.length === 0) {
    delete state.expedition;
    if (state.settlement) {
      // The band's centre of gravity is the hall; nobody is out there now.
      state.party.stop = state.settlement.stop ?? 0;
      chronicle(state, 'Nobody came back from that one.', 'grim');
    }
    return;
  }
  out.members = alive;
}

/** A short line for the panel: who is out, why, and how far. */
export function expeditionLine(state: GameState): string | undefined {
  const out = state.expedition;
  if (!out) return undefined;
  const crew = fieldCrew(state);
  const days = state.day - out.launchedOn;
  const away = distanceFromHome(state);
  return (
    `${crew.length} out ${purposeLine(out.purpose)} · day ${days} · ` +
    `${away}d from home${out.returning ? ' · turning back' : ''}`
  );
}

/** Where the party may step. Once turned for home, only toward it. */
export function permittedStep(state: GameState, to: number): boolean {
  const out = state.expedition;
  if (!out?.returning || !state.settlement) return true;
  return daysBetween(state.seed, to, state.settlement.stop ?? 0) <= distanceFromHome(state);
}

/**
 * How many sworn make a wall rather than a gaggle.
 *
 * FOUR, AND IT IS A CLIFF RATHER THAN A SLOPE. Measured over 32 open-field
 * fights a cell at difficulty 2, attacking:
 *
 *   3 stood — won  3/32 ( 9%) against 4.0 foes
 *   4 stood — won 23/32 (72%) against 4.0 foes
 *   5 stood — won 22/32 (69%) against 5.0 foes
 *   6 stood — won 17/32 (53%) against 6.0 foes
 *
 * Three is half a shield wall walking into a fight. Four is a wall. And past
 * four it gets WORSE rather than better, because `foeCount` scales what comes
 * out to meet you with what you brought — six of yours meets six of theirs,
 * and the wall bonus is already full.
 */
export const WALL_ENOUGH = 4;

/**
 * What the party being picked is worth as a fighting force.
 *
 * THE NUMBER THAT DECIDED EVERYTHING AND WAS NEVER SHOWN (9.15). Party size
 * is chosen here, at the launch card, and until now its consequence appeared
 * only at the camp — as `fallOnReport`'s bare "four of ours against four of
 * theirs", which does not carry the cliff at all: four against four wins 72%
 * and six against six wins 53%, so equal numbers are not equal odds.
 *
 * Counted in SWORN, because hands are mouths and bodies round the fire and
 * are kept off the field entirely. Shown whatever the errand's purpose: the
 * camp is on the only road there is, and the fault this is for was a TRADING
 * party of two walking past one.
 */
export interface WallReading {
  /** Sworn among those going. */
  sworn: number;
  /** Whether they are short of a wall. */
  thin: boolean;
  /** What that is worth, in the panel's voice. */
  line: string;
  /** What raiding as a strategy costs, for a raid and only a raid. */
  record?: string;
}

/**
 * What going out under arms has actually cost, for the card to say.
 *
 * 11.M2. THE RECORD, AS THE OTHER TWO DOORS OUT ALREADY CARRY ONE
 * (`VOYAGE_RECORD` above, `ABANDON_RECORD` in data/retreat.ts). Raiding was
 * the third verb this project had measured a negative price for and the only
 * one whose card said nothing about it — a raid party stood shoulder to
 * shoulder, read a fight it could win, and the card never said that winning
 * fights and surviving the saga are different questions.
 *
 * MEASURED (`PROBE: 10.3`, re-taken 2026-09-03 rather than inherited — 10.1's
 * original reading was three commits and two balance changes old by the time
 * this item reached it, 11.S1's deployment fix and 11.V's verdict fix both
 * touch survival directly). ONE knob on the settler, raiding turned on and
 * nothing else changed — same crew, same site rule, same trading, same
 * seeds, 200 landings, paired:
 *
 *   raiding off   29/200 standing, avg day 150
 *   raiding on    16/200 standing, avg day 119
 *   paired — saved 7, killed 20
 *
 * Down from the item's own opening figure (saved 9, killed 22) but the same
 * shape and the same conclusion: raiding kills bands it does not save.
 * `PROBE: 10.3b` ruled out the obvious objections — a war crew recovers some
 * of it (saved 13, killed 9 against raiding-with-the-settler's-crew) but not
 * the gap to a band that never raids at all, and RAIDER's own `relaxFrom` is
 * a dead knob at this site floor (saved 0, killed 0).
 *
 * RE-TAKEN ON THE FLOOR-7 BASELINE (12.3, same probe, 200 seeds, paired,
 * 2026-09-05), and the FINDING held while the NUMBER IN THE SENTENCE did not:
 *
 *   raiding off   44/200 standing, avg day 197
 *   raiding on    25/200 standing, avg day 154
 *   paired — saved 17, killed 36
 *
 * The war crew still fails to close it (saved 18, killed 14) and `relaxFrom`
 * is still exactly dead (saved 0, killed 0) — an arm tying its control to the
 * tap, which here is the right reading rather than a broken instrument,
 * because 10.3b established the same thing on a different floor.
 *
 * SO THE RATIO CAME OFF THE PLAYER'S SENTENCE. It said "about three for every
 * one it spared", from 20 against 7 — 27 discordant pairs. At 53 pairs the
 * point estimate is 2.1, and the 95% interval on the ratio runs from about
 * 1.2 to 4.1: three was never outside it and neither is two, which is another
 * way of saying the sample cannot resolve the magnitude at all. What it can
 * resolve, and does at p = 0.01, is the SIGN. That is what the sentence says
 * now, and it says it just as hard.
 *
 * States it, never refuses — same rule as `VOYAGE_RECORD` and
 * `ABANDON_RECORD`: the game does not tell the player what to do anywhere
 * else, and a band with a wrong worth avenging is entitled to go and be
 * wrong.
 */
export const RAID_RECORD =
  'Of the bands that went out under arms, more died for it than were saved '
  + 'by it, and by no small margin. Winning the fight and surviving the saga '
  + 'are not the same question.';

export function wallReading(state: GameState, going: string[], purpose?: Purpose): WallReading {
  // Through `sworn()` rather than filtering on the bond here, so the cap it
  // applies is applied once: a save that somehow holds more than SWORN_MAX
  // must not be able to field a wider wall on this card than on the field.
  const count = sworn(state.party.people).filter((p) => going.includes(p.id)).length;
  const record = purpose === 'raid' ? RAID_RECORD : undefined;
  if (count === 0) {
    return {
      sworn: 0,
      thin: true,
      line: 'Nobody going is sworn. They cannot hold a line if anything meets them.',
      record,
    };
  }
  if (count < WALL_ENOUGH) {
    return {
      sworn: count,
      thin: true,
      line: `${count} sworn is half a wall — about one open fight in ten goes their way. `
        + `${WALL_ENOUGH} stand shoulder to shoulder.`,
      record,
    };
  }
  return {
    sworn: count,
    thin: false,
    line: `${count} sworn stand shoulder to shoulder — about seven open fights in ten. `
      + 'More than four only brings more of them out to meet you.',
    record,
  };
}

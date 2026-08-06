// Parties sent out from the steading, and the hands they cost while they are
// gone.
//
// Before the posts go in, the whole band walks together and this file has
// nothing to say. After, the steading is where people live: to go anywhere at
// all you send a party, and everyone you send is somebody who is not farming,
// cutting or standing the watch while they are away.

import { distance, key, type Hex } from '../hex';
import { stream } from '../rng';
import type { GameState, Person, Purpose } from '../state/types';
import { effectiveStat, living } from './people';
import { chronicle } from './saga';
import { atHome } from './site';

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
    id: 'raid',
    name: 'Go out under arms',
    blurb: 'Find somebody worth taking from. What you win, you carry home.',
    stir: 1.45,
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

/** The people out on the world map — the ones a field battle is fought with. */
export function fieldCrew(state: GameState): Person[] {
  const out = state.expedition;
  if (!out) return living(state.party.people);
  return living(state.party.people).filter((p) => out.members.includes(p.id));
}

/** The people at the steading — the ones who work it, and who defend it. */
export function homeCrew(state: GameState): Person[] {
  if (!state.settlement) return [];
  const out = state.expedition;
  if (!out) return living(state.party.people);
  return living(state.party.people).filter((p) => !out.members.includes(p.id));
}

export function isOut(state: GameState, person: Person): boolean {
  return state.expedition?.members.includes(person.id) ?? false;
}

/** How far from home they have got. */
export function distanceFromHome(state: GameState): number {
  if (!state.settlement) return 0;
  return distance(state.party.at, state.settlement.at);
}

// --- Launching ---

export type LaunchBlock = 'nosteading' | 'away' | 'already' | 'nobody' | 'unmanned' | 'stores';

export function launchBlocker(state: GameState, members: string[]): LaunchBlock | null {
  if (!state.settlement) return 'nosteading';
  if (state.expedition) return 'already';
  if (!atHome(state)) return 'away';
  const crew = living(state.party.people);
  const going = crew.filter((p) => members.includes(p.id));
  if (going.length === 0) return 'nobody';
  if (crew.length - going.length < MIN_HOME_CREW) return 'unmanned';
  if (state.party.food < provisionsFor(going.length)) return 'stores';
  return null;
}

export const LAUNCH_REASON: Record<LaunchBlock, string> = {
  nosteading: 'There is nowhere to come back to yet.',
  away: 'They would have to set out from the steading.',
  already: 'A party is already out.',
  nobody: 'Somebody has to go.',
  unmanned: 'Somebody has to stay and keep the fire.',
  stores: 'There is not enough in the store to provision them.',
};

/** What it costs to send this many people out. */
export function provisionsFor(count: number): number {
  return count * PROVISION_PER_HEAD;
}

export function launch(state: GameState, members: string[], purpose: Purpose): boolean {
  if (launchBlocker(state, members) !== null) return false;
  const going = living(state.party.people).filter((p) => members.includes(p.id));
  const carried = provisionsFor(going.length);
  state.party.food -= carried;

  state.expedition = {
    members: going.map((p) => p.id),
    purpose,
    launchedOn: state.day,
    carried,
  };
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
  if (key(state.party.at) !== key(home.at)) return false;

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
      state.party.at = { ...state.settlement.at };
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
    `${away} from home${out.returning ? ' · turning back' : ''}`
  );
}

/** Where the party may step. Once turned for home, only toward it. */
export function permittedStep(state: GameState, to: Hex): boolean {
  const out = state.expedition;
  if (!out?.returning || !state.settlement) return true;
  return distance(to, state.settlement.at) <= distanceFromHome(state);
}

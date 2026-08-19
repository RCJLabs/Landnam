// A saga somebody else can play.
//
// The carried-over task, and the part of it the headless runner did not
// already do. A run is a seed and the terms it was played under — that is
// the whole of what has to travel for two people to land on the same coast.
// So a challenge is a short line of text rather than a file:
//
//   LN1 raven-skerry-317 even d128 w2 jarl
//
// **Deliberately not base64.** Every instinct says to encode a blob, and it
// would be wrong here: this game is played on phones, the code gets pasted
// into a chat and read out loud and retyped with a thumb, and the failure
// mode of a base64 blob is that one wrong character produces silence. This
// format survives a mangled copy — a lost trailing token costs you the mark
// and still lands you on the right coast — and a player can SEE that
// `raven-skerry-317` is in there.
//
// What it does not do is prove anything. A mark is a claim, the way a seed
// challenge has always been a claim; `scripts/play.ts` is where a claim can
// be checked, because that replays actions and this does not carry them.
// Saying so plainly here rather than implying otherwise in the UI.

import { hardshipById, type HardshipId } from '../data/hardship';
import { wintersStood } from './calendar';
import type { GameState, Ghost } from '../state/types';

/** What a run got to. The thing another player is chasing. */
export interface Mark {
  day: number;
  winters: number;
  /** They took the Thing and ruled. The high bar. */
  jarl?: boolean;
}

export interface Challenge {
  seed: string;
  hardship: HardshipId;
  /** The result to beat, when the code came off a finished saga. */
  mark?: Mark;
  /**
   * First eight hex of the world hash, when the code carries one.
   *
   * Cheap insurance against the worst possible confusion: worldgen changes
   * between builds, and then the same seed is a different country and two
   * players comparing marks are comparing nothing. With this, the game can
   * tell them.
   */
  world?: string;
  /**
   * A fallen steading to stand in the receiver's country.
   *
   * One token, comma-separated inside it, because the format is a line of
   * text people retype with a thumb and a second space-separated field would
   * be one more thing to lose. A mangled ghost costs the ruin and still lands
   * you on the right coast, which is the rule the whole format is built on.
   */
  ghost?: Ghost;
}

const PREFIX = 'LN1';

/** Seeds are one token, so a space in one has to survive as something else. */
const packSeed = (seed: string) => (seed === '' ? '~' : seed.replace(/\s+/g, '+'));
const unpackSeed = (token: string) => (token === '~' ? '' : token.replace(/\+/g, ' '));

/**
 * `g<q>,<r>,<name>,<day>,<cause>` — one whitespace-free token.
 *
 * The name is packed the way a seed is, because a steading called "Two Rivers"
 * would otherwise split the line in half and take the world hash with it.
 * Commas are stripped from it for the same reason they separate the fields.
 */
function packGhost(g: Ghost): string {
  const name = g.name.replace(/[\s,]+/g, '+') || '~';
  const cause = g.cause.replace(/[^a-z]/gi, '').toLowerCase() || 'gone';
  return `g${Math.round(g.at.q)},${Math.round(g.at.r)},${name},${Math.max(0, Math.round(g.day))},${cause}`;
}

function unpackGhost(token: string): Ghost | undefined {
  const bits = token.slice(1).split(',');
  if (bits.length < 5) return undefined;
  const q = Number(bits[0]);
  const r = Number(bits[1]);
  const day = Number(bits[3]);
  if (!Number.isFinite(q) || !Number.isFinite(r) || !Number.isFinite(day)) return undefined;
  const name = (bits[2] ?? '').replace(/\+/g, ' ').trim();
  if (name === '' || name === '~') return undefined;
  return { name, at: { q, r }, day: Math.max(0, day), cause: bits[4] ?? 'gone' };
}

export function encodeChallenge(c: Challenge): string {
  const parts = [PREFIX, packSeed(c.seed), c.hardship];
  if (c.mark) {
    parts.push(`d${Math.max(0, Math.round(c.mark.day))}`);
    parts.push(`w${Math.max(0, Math.round(c.mark.winters))}`);
    if (c.mark.jarl) parts.push('jarl');
  }
  if (c.ghost) parts.push(packGhost(c.ghost));
  if (c.world) parts.push(`#${c.world}`);
  return parts.join(' ');
}

/**
 * Reads a code, or returns null if that is not what this is.
 *
 * Forgiving on purpose: whitespace, case and a missing tail are all things
 * that happen to a string on its way through a chat app, and none of them
 * should cost the player the coast. What it will NOT do is guess — text
 * without the prefix is somebody's ordinary seed, and treating it as a
 * broken challenge would be worse than ignoring it.
 */
export function decodeChallenge(text: string): Challenge | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens[0]!.toUpperCase() !== PREFIX) return null;

  const seed = unpackSeed(tokens[1]!);
  // An unreadable or absent difficulty falls back to the balanced terms
  // rather than refusing the code: landing on the right coast on the wrong
  // terms is a far better failure than not landing at all.
  const asked = tokens[2]?.toLowerCase();
  const hardship = (asked && hardshipById(asked as HardshipId)?.id === asked
    ? (asked as HardshipId)
    : 'even');

  const challenge: Challenge = { seed, hardship };
  let day: number | undefined;
  let winters: number | undefined;
  let jarl = false;

  for (const token of tokens.slice(3)) {
    const lower = token.toLowerCase();
    if (lower === 'jarl') jarl = true;
    else if (/^d\d+$/.test(lower)) day = Number(lower.slice(1));
    else if (/^w\d+$/.test(lower)) winters = Number(lower.slice(1));
    else if (/^#[0-9a-f]{1,16}$/.test(lower)) challenge.world = lower.slice(1);
    // Case is NOT lowered for a ghost: a steading is named, and a name that
    // comes back as "eikstead" is not the same steading.
    else if (/^g-?\d+,-?\d+,/.test(lower)) {
      const ghost = unpackGhost(token);
      if (ghost) challenge.ghost = ghost;
    }
  }

  // A mark needs a day to mean anything; winters and the jarldom are colour
  // on top of it.
  if (day !== undefined) {
    challenge.mark = { day, winters: winters ?? 0, ...(jarl ? { jarl: true } : {}) };
  }
  return challenge;
}

/** What this run has got to, as a mark. */
export function markOf(state: GameState): Mark {
  return {
    day: state.day,
    winters: wintersStood(state.day),
    ...(state.jarl ? { jarl: true } : {}),
  };
}

/**
 * Did `mine` beat `theirs`?
 *
 * A jarldom outranks any number of days, because it is the thing the whole
 * game points at and a band that ruled did something a band that merely
 * lasted did not. Below that it is days survived, and a tie is not a win —
 * you have to actually pass them.
 */
export function beats(mine: Mark, theirs: Mark): boolean {
  if (mine.jarl && !theirs.jarl) return true;
  if (!mine.jarl && theirs.jarl) return false;
  return mine.day > theirs.day;
}

/** The mark in words, for a screen. */
export function describeMark(mark: Mark): string {
  const winters = `${mark.winters} ${mark.winters === 1 ? 'winter' : 'winters'}`;
  if (mark.jarl) return `day ${mark.day}, ${winters} stood, and a jarldom taken`;
  return `day ${mark.day}, ${winters} stood`;
}

/**
 * The COAST, with no mark on it: land where I landed, on the terms I took.
 *
 * The one a player can send while they are still playing, and the reason it
 * carries no mark is that mid-run there is nothing yet to beat. "Beat day
 * 40" sent on day 40 is a claim the sender has not earned and may lose on
 * day 41. A finished saga has a result and says so; a run in progress has a
 * country worth recommending, which is the thing people actually want to
 * pass on. `decodeChallenge` reads a markless code as an ordinary
 * challenge — same seed, same terms, nothing to chase.
 */
export function coastOf(state: GameState): string {
  return encodeChallenge({ seed: state.seed, hardship: state.hardship ?? 'even' });
}

/**
 * This run's steading as somebody else's ruin, or nothing.
 *
 * Only from a saga that ENDED. A run still being played has a steading, not a
 * ruin, and sending one would be claiming a death that has not happened —
 * the same reason `coastOf` carries no mark.
 */
export function ghostOf(state: GameState): Ghost | undefined {
  const home = state.settlement;
  if (!home || !state.end) return undefined;
  return { name: home.name, at: home.at, day: state.day, cause: state.end.cause };
}

/** The code for the run as it stands, mark and all. */
export function challengeOf(state: GameState, world?: string): string {
  return encodeChallenge({
    seed: state.seed,
    hardship: state.hardship ?? 'even',
    mark: markOf(state),
    ...(ghostOf(state) ? { ghost: ghostOf(state)! } : {}),
    ...(world ? { world: world.slice(0, 8) } : {}),
  });
}

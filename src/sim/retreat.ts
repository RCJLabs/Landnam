// Walking out on a steading.
//
// The verb `readiness()` has been naming since the winter work and the game
// did not have. See src/data/retreat.ts for why it is shaped the way it is.
//
// It is the mirror of `foundSettlement` and is written to be exactly that:
// what founding builds, this takes down, and what founding could not do —
// happen twice — this is the whole reason for.

import type { Child, GameState } from '../state/types';
import { ABANDON_AFTER, ABANDON_HEART, ABANDON_RECORD } from '../data/retreat';
import { childrenOf } from './lineage';
import { atHome } from './site';
import { chronicle } from './saga';
import { ruinIdFor } from './places';

/**
 * Why the band cannot walk out, or null when it can.
 *
 * A blocker rather than a boolean for the reason `birthBlocker` and
 * `launchBlocker` are: each of these is a thing the player did or did not do,
 * and a refusal that cannot say which is one the player cannot act on.
 */
export type AbandonBlock = 'nosteading' | 'away' | 'toosoon' | 'ended';

export function abandonBlocker(state: GameState): AbandonBlock | null {
  if (state.end) return 'ended';
  if (!state.settlement) return 'nosteading';
  // You cannot give up ground you are not standing on. A band away on an
  // errand does not get to abandon the hall the rest of them are sitting in.
  if (!atHome(state)) return 'away';
  if (state.day - state.settlement.foundedOn < ABANDON_AFTER) return 'toosoon';
  return null;
}

export const ABANDON_REASON: Record<AbandonBlock, string> = {
  nosteading: 'There are no posts in the ground to leave.',
  away: 'We are not there to leave it.',
  toosoon: 'The turf is not even settled. We came here to stay a while first.',
  ended: 'The saga is finished.',
};

export function canAbandon(state: GameState): boolean {
  return abandonBlocker(state) === null;
}

/**
 * Gives up the steading. Mutates the state clone; returns false if refused.
 *
 * THE GROUND REMEMBERS, AND IT PAYS NOTHING. A `ruin` place goes where the
 * hall stood — the same kind `haunt.ts` puts on the map for somebody else's
 * dead steading — and it is marked sacked the day it is made. That is not
 * bookkeeping, it is the one thing standing between this and an exploit: the
 * ruin kind carries loot, so a band that could walk out and then go through
 * its own ruin would get its timber back and the retreat would be a windfall
 * instead of a cost. Already picked clean, it is a landmark and a grave.
 */
export function abandonSteading(state: GameState): boolean {
  if (!canAbandon(state)) return false;
  const home = state.settlement!;

  // The children come along. They are records kept on the settlement, so a
  // naive retreat would simply delete them — and since `childrenOf` feeds
  // `foodPerDay`, that would make walking out a way to stop feeding your own
  // children. They ride on the state until there are posts to keep them at.
  const born: Child[] = [...childrenOf(state)];
  if (born.length > 0) state.bairns = [...(state.bairns ?? []), ...born];

  state.world.places.push({
    id: ruinIdFor({ stop: home.stop }),
    kind: 'ruin',
    // The stop is the address. Without it the band's own posts were in the
    // world and unreachable from it — `placeHere` matches on stop, so a band
    // that walked out could never stand on what it had left.
    stop: home.stop ?? 0,
    // Made empty. See the note above: a lootable ruin turns this into a
    // windfall and the whole design of the cost falls over.
    sackedOn: state.day,
  });

  delete state.settlement;
  state.party.morale = Math.max(0, state.party.morale - ABANDON_HEART);
  state.flags['abandoned'] = (state.flags['abandoned'] ?? 0) + 1;

  chronicle(
    state,
    `We took what we could carry and left ${home.name} standing empty. `
      + 'The posts will be there a long time after us, and nobody will know what we called it.',
    'saga',
  );
  return true;
}

/**
 * What the door out says: whether it opens, what it costs, and what became of
 * the bands that took it.
 *
 * IN THE SIM BECAUSE IT CAN BE GOT WRONG. The panel used to build these lines
 * itself, and it built only two of the three — the price was on the face of
 * the control and the record was nowhere, so a player could read the whole
 * screen and still believe walking out was an escape. Composed here, the
 * three cannot come apart, and a test can hold them to it without a browser.
 *
 * `open` false means the control is not offered and `reason` says which rule
 * is refusing — never a grey button with no explanation.
 */
export interface LeaveNote {
  open: boolean;
  /** Why not, when it is not offered. */
  reason?: string;
  /** What leaving costs, when it is. */
  price?: string;
  /** What happened to the bands that did. */
  record?: string;
}

export function leaveNote(state: GameState): LeaveNote | null {
  const why = abandonBlocker(state);
  // Nothing to leave, or nothing left to decide: the door is not refused,
  // it simply is not there, and a note about it would be noise.
  if (why === 'nosteading' || why === 'ended') return null;
  if (why !== null) return { open: false, reason: ABANDON_REASON[why] };
  return {
    open: true,
    price: `Everything raised here is lost, and ${ABANDON_HEART} off every heart. `
      + 'The stores come with us.',
    record: ABANDON_RECORD,
  };
}

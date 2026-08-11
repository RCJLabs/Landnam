// Copying a GameState, which the sim does on every single action.
//
// `apply` is `(state, action) => state` and never mutates its input, which
// is the rule that makes the whole thing testable, replayable and portable.
// The cost of that rule was being paid in the dumbest possible place:
// `structuredClone(state)` copied the **entire world** every turn, and the
// world is 78 KB of terrain generated once at worldgen and never written
// again. Measured 2026-08-11: 2.2 ms an action for the whole state against
// 0.045 ms for everything except the world. Ninety-eight percent of the cost
// of a turn was duplicating ground that cannot change, on a game whose
// primary target is a phone.
//
// So the tiles are SHARED between a state and its copy rather than
// duplicated. Everything else about the world — `seen`, `trod`, `places` —
// is written during play and is still copied.
//
// Sharing is only safe while nothing writes a tile, and "nothing writes a
// tile" is not a thing to take on trust: it is one careless line away from
// two states silently sharing a mutation, which is the worst class of bug
// this codebase could grow. Two guards, deliberately belt and braces:
//
//   1. `tiles` is FROZEN the first time a state is copied. A write throws at
//      the exact line that did it, in dev, in tests, in the harness — not in
//      a player's save three weeks later.
//   2. `test/clone.test.ts` plays real sagas and fails if a tile moves.
//
// If a future feature genuinely needs to change the ground — terrain that
// burns, a river that shifts — the fix is to give the world another
// play-state record beside `seen` and `trod`, not to unfreeze this.

import type { GameState, Tile } from './types';

/**
 * Freezes the generated ground so a write announces itself.
 *
 * Both levels matter: freezing the record stops a tile being replaced,
 * freezing each tile stops one being edited in place. Costs a single pass
 * over the map, once per run.
 */
function freezeTiles(tiles: Record<string, Tile>): void {
  for (const tile of Object.values(tiles)) Object.freeze(tile);
  Object.freeze(tiles);
}

/**
 * A copy of the state that shares the ground it stands on.
 *
 * Every `structuredClone(state)` in the sim goes through here. Anything that
 * wants a fully independent copy — a fixture that means to edit terrain, say
 * — should call `structuredClone` directly and know it is paying for it.
 */
/**
 * Rebuilds `copied` in the key order of `original`, swapping one field for a
 * value that was not copied.
 *
 * Order matters because `JSON.stringify` is order-sensitive and `encode()`
 * is a stringify. Destructuring a field out and putting it back moves it to
 * the end of the object, which makes a copy that is deep-equal to its
 * original and textually different — quietly changing the bytes of every
 * save, and breaking any invariant written as string equality. Both levels
 * of this function got that wrong in turn, and the same test caught both.
 */
function inOrder<T extends object>(
  original: T,
  copied: Record<string, unknown>,
  swap: string,
  value: unknown,
): T {
  const out: Record<string, unknown> = {};
  for (const field of Object.keys(original)) {
    out[field] = field === swap ? value : copied[field];
  }
  return out as T;
}

export function cloneState(state: GameState): GameState {
  const { world } = state;
  const { tiles, ...ground } = world;
  // Cheap after the first call: an already-frozen record short-circuits.
  if (!Object.isFrozen(tiles)) freezeTiles(tiles);

  const nextWorld = inOrder(
    world,
    structuredClone(ground) as Record<string, unknown>,
    'tiles',
    tiles,
  );
  const { world: _dropped, ...rest } = state;
  return inOrder(state, structuredClone(rest) as Record<string, unknown>, 'world', nextWorld);
}

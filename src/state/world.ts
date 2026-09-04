// The empty country a run starts on.
//
// There is nothing to generate. Everything the coast is made of — the route,
// its stops, their country, the becks, the fisheries, the places, the
// neighbours and the rival's stretch — is DERIVED from `(seed, stop)` and
// asked for when it is wanted. A `World` is therefore the few facts a saga
// accumulates about a coast rather than the coast itself: what it has walked,
// what it knows, what it has worked, and what stands on it.
//
// This was `bareWorld` inside `state/create.ts` until 8.5, private to the one
// caller that needed it. `sailOn` needed it too and did not have it, which is
// how a coast band that took the land a second time got the whole retired hex
// island written into its save — 3.2 kB to 81.1 kB, of tiles nothing reads.

import type { World } from './types';

export function bareWorld(): World {
  return { landingName: '', places: [] };
}

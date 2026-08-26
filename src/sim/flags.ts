// What is switched on while it is being built.
//
// Phase 8 turns a hex game into a side-on one, and the roadmap's rule for it
// is "behind a flag" — because the conversion is too big to land in one
// commit and a half-converted game that cannot be played is a game nobody
// can measure. So both worlds exist for a while, and this is the switch.
//
// A build-time constant rather than a save field or a URL parameter, and
// deliberately so: the flag is scaffolding with a demolition date, not a
// setting. A player never sees it, no save carries it, and when the last
// slice of Phase 8 lands this file is deleted along with the branch it was
// guarding. A flag that lives in the save is a flag you have to migrate
// forever.

/**
 * Travel runs on the ROUTE — one coast, walked out and back — rather than on
 * the hex map.
 *
 * Off until 8.2c has re-addressed the places, the neighbours, the fisheries
 * and the sea to a stop index. Turning it on before then gives a band a coast
 * to walk with nothing on it, which measures as "travel is worse now" and
 * would be true.
 *
 * The walking itself is live and tested behind this: `sim/coast.ts` and the
 * `WALK` action. What the flag gates is whether the game OFFERS it.
 */
export const COAST_IS_A_LINE = false;

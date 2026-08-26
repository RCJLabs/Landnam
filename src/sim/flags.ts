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
 *
 * Still a build-time constant: Vite replaces `import.meta.env.VITE_COAST`
 * statically and drops the dead branch, exactly as it did the bare `false`.
 * It reads an environment variable so that a build of the coast can be MADE
 * — `VITE_COAST=1 npm run build` — which is what `scripts/strip.mjs` needs
 * to put a thumb on the strip chart, and what makes the half-built coast
 * something to open and look at rather than only read about. Unset is false,
 * so every ordinary build and every test is the hex game as before.
 *
 * WRITE IT EXACTLY LIKE THIS. The first draft said `import.meta.env?.` with
 * an optional chain, which looks harmless and is not: Vite's define matches
 * the expression TEXTUALLY, so the guard stopped folding to a constant and
 * every branch behind this flag stayed in the bundle. The ordinary build went
 * from 399kB to 421kB and shipped a whole coast nobody could reach — the flag
 * still read false, so nothing failed and nothing looked wrong. Caught by
 * grepping the built page for a string only the strip chart contains, which
 * is the only way this kind of thing ever announces itself.
 */
export const COAST_IS_A_LINE = import.meta.env.VITE_COAST === '1';

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
 * ON BY DEFAULT SINCE 2026-08-28. This is the hinge of 8.5 and it was held
 * shut by one thing: a coast build had to pass every bar the hex game passes,
 * on its own terms rather than by having its bars loosened. It does — 90
 * files green, nothing failing, after the site report was calibrated and the
 * last of the hex-shaped fixtures were rewritten. The default is now the
 * coast and `VITE_HEX=1` builds the old game, which is the same switch read
 * the other way round.
 *
 * The hex game is kept buildable rather than deleted in the same commit,
 * because the deletion is a save break (job 4 of 8.5) and because a
 * side-by-side is the only way to answer "is this actually better" while both
 * still exist. `npm run publish:hex` puts it at `/hex/`.
 *
 * Still a build-time constant: Vite replaces `import.meta.env.VITE_HEX`
 * statically and drops the dead branch. A flag that lived in the save would
 * be a flag we had to migrate forever.
 *
 * WRITE IT EXACTLY LIKE THIS. An earlier draft said `import.meta.env?.` with
 * an optional chain, which looks harmless and is not: Vite's define matches
 * the expression TEXTUALLY, so the guard stopped folding to a constant and
 * every branch behind this flag stayed in the bundle. The build went from
 * 399kB to 421kB and shipped a whole coast nobody could reach — the flag
 * still read false, so nothing failed and nothing looked wrong. Caught by
 * grepping the built page for a string only the strip chart contains, which
 * is the only way this kind of thing ever announces itself.
 *
 * The same hazard now runs the other way: if this stops folding, an ordinary
 * build ships the hex map's renderers as dead weight behind a `true`.
 */
export const COAST_IS_A_LINE = import.meta.env.VITE_HEX !== '1';

// The full-screen overlays, split by what they are FOR.
//
// This was one 749-line file against a style rule of about 300, and the
// challenge work made it worse. Splitting it by TYPE — one file of cards,
// one of panels — would have been the easy cut and the wrong one; the rule
// in CLAUDE.md says by domain, so these are grouped by the job they do in a
// run: getting in, interrupting, deciding, ending, and the two menus that
// are about the game rather than about the saga.
//
// Re-exported here so `./render/cards` still means what it meant, and the
// move stayed a move.

export * from './title';
export * from './interrupt';
export * from './decide';
export * from './closing';
export * from './menus';

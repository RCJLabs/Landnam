// What a repaint actually has to build.
//
// `paint()` used to clear the terrain layer and make a fresh polygon for
// every hex the band had ever seen, on every repaint — and a repaint happens
// after every action. That is the wrong shape twice over: the cost is paid
// again for country that has not changed since the day it was walked, and it
// GROWS as the run goes on, so the game gets slower the longer you play it.
// A four-hundred-day run repaints most of a 52 x 36 map more than a thousand
// times over.
//
// Nothing about that country changes, either. Terrain and rivers are written
// once in sim/worldgen.ts and never touched again, so what a hex looks like
// depends on exactly two things: whether it is on the chart at all, and
// whether it is lit now or only remembered. Both come off `world.seen`.
//
// So this is the whole decision: given what is drawn and what should be,
// which hexes need a NODE (never drawn before), which need two attributes
// changed (the light on them moved), and which should not be there at all.
// It is pure and it is where the interesting mistakes live — a diff that
// misses a relit hex leaves the map lying about what the band can see — so
// it is here, with a test, rather than inline in the renderer.

/** Lit now, or remembered from a day the band was standing there. */
export type Lit = 'seen' | 'visible';

export interface Repaint {
  /** Never drawn. A node has to be made and put in the document. */
  readonly added: string[];
  /** Drawn, but in the other light. Two attributes, no node. */
  readonly relit: string[];
  /** Drawn and no longer on the chart. Nodes come out. */
  readonly dropped: string[];
}

const NOTHING: Repaint = { added: [], relit: [], dropped: [] };

/**
 * The work one repaint owes.
 *
 * `drawn` is what the renderer is holding; `seen` is `state.world.seen`.
 *
 * The `dropped` pass is skipped whenever every drawn hex was accounted for
 * on the way through — which is every repaint of a normal run, because fog
 * does not close again. It is not dead code: a view handed a state from a
 * different world (a load, or a new game into a mounted map) has to let go
 * of the old country rather than draw two islands on top of each other.
 */
export function repaintWork(
  drawn: ReadonlyMap<string, Lit>,
  seen: Readonly<Record<string, Lit>>,
): Repaint {
  const added: string[] = [];
  const relit: string[] = [];
  let held = 0;

  for (const k in seen) {
    const now = seen[k];
    if (now === undefined) continue;
    const was = drawn.get(k);
    if (was === undefined) {
      added.push(k);
      continue;
    }
    held++;
    if (was !== now) relit.push(k);
  }

  // Every hex being held is still on the chart, so nothing can have been
  // dropped and the second walk is not worth taking.
  if (held === drawn.size) {
    return added.length === 0 && relit.length === 0 ? NOTHING : { added, relit, dropped: [] };
  }

  const dropped: string[] = [];
  for (const k of drawn.keys()) {
    if (!(k in seen)) dropped.push(k);
  }
  return { added, relit, dropped };
}

/** True when a repaint has nothing to do — the common case mid-run. */
export function isIdle(work: Repaint): boolean {
  return work.added.length === 0 && work.relit.length === 0 && work.dropped.length === 0;
}

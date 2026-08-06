// A* over hexes with a caller-supplied cost function.
// cost(hex) returns the cost to ENTER that hex, or Infinity if impassable.

import { Axial, HexKey, key, fromKey, neighbors, distance } from './hex';

export interface PathResult {
  /** Path from start to goal inclusive; empty if unreachable. */
  path: Axial[];
  cost: number;
}

export function findPath(
  start: Axial,
  goal: Axial,
  cost: (h: Axial) => number,
  maxExpansions = 20000,
): PathResult {
  const startKey = key(start);
  const goalKey = key(goal);
  if (startKey === goalKey) return { path: [start], cost: 0 };
  if (!isFinite(cost(goal))) return { path: [], cost: Infinity };

  const gScore = new Map<HexKey, number>([[startKey, 0]]);
  const cameFrom = new Map<HexKey, HexKey>();
  // Binary-heap-free priority queue: small maps make a sorted-insert array fine.
  const open: { k: HexKey; f: number }[] = [{ k: startKey, f: distance(start, goal) }];
  const closed = new Set<HexKey>();
  let expansions = 0;

  while (open.length > 0 && expansions < maxExpansions) {
    // Pop lowest f.
    let bestI = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bestI]!.f) bestI = i;
    const current = open.splice(bestI, 1)[0]!;
    if (current.k === goalKey) {
      // Reconstruct.
      const path: Axial[] = [];
      let k: HexKey | undefined = goalKey;
      while (k !== undefined) {
        path.push(fromKey(k));
        k = cameFrom.get(k);
      }
      path.reverse();
      return { path, cost: gScore.get(goalKey)! };
    }
    if (closed.has(current.k)) continue;
    closed.add(current.k);
    expansions++;

    const cur = fromKey(current.k);
    const g = gScore.get(current.k)!;
    for (const nb of neighbors(cur)) {
      const nbKey = key(nb);
      if (closed.has(nbKey)) continue;
      const stepCost = cost(nb);
      if (!isFinite(stepCost)) continue;
      const tentative = g + stepCost;
      const known = gScore.get(nbKey);
      if (known === undefined || tentative < known) {
        gScore.set(nbKey, tentative);
        cameFrom.set(nbKey, current.k);
        open.push({ k: nbKey, f: tentative + distance(nb, goal) });
      }
    }
  }
  return { path: [], cost: Infinity };
}

/** All hexes reachable within maxCost, as a map of key -> cost. Dijkstra flood. */
export function reachable(
  start: Axial,
  maxCost: number,
  cost: (h: Axial) => number,
): Map<HexKey, number> {
  const dist = new Map<HexKey, number>([[key(start), 0]]);
  const frontier: { k: HexKey; d: number }[] = [{ k: key(start), d: 0 }];
  while (frontier.length > 0) {
    let bestI = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i]!.d < frontier[bestI]!.d) bestI = i;
    const cur = frontier.splice(bestI, 1)[0]!;
    if (cur.d > dist.get(cur.k)!) continue;
    for (const nb of neighbors(fromKey(cur.k))) {
      const stepCost = cost(nb);
      if (!isFinite(stepCost)) continue;
      const nd = cur.d + stepCost;
      const nbKey = key(nb);
      if (nd <= maxCost && (dist.get(nbKey) === undefined || nd < dist.get(nbKey)!)) {
        dist.set(nbKey, nd);
        frontier.push({ k: nbKey, d: nd });
      }
    }
  }
  return dist;
}

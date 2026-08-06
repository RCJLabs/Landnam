// A* pathfinding and Dijkstra flood-fill over the hex grid.
// Callers supply the movement cost; the grid itself knows nothing about terrain.

import { Hex, HexKey, key, fromKey } from './coords';
import { distance, neighbors } from './grid';

/** Cost to ENTER a hex. Return Infinity for impassable. */
export type CostFn = (h: Hex) => number;

export interface Path {
  /** Start-to-goal inclusive; empty when unreachable. */
  hexes: Hex[];
  cost: number;
}

/** Min-heap keyed by priority — keeps A* near-linear on open maps. */
interface HeapEntry {
  k: HexKey;
  priority: number;
}

function heapPush(heap: HeapEntry[], entry: HeapEntry): void {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent]!.priority <= heap[i]!.priority) break;
    [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
    i = parent;
  }
}

function heapPop(heap: HeapEntry[]): HeapEntry | undefined {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0 && last !== undefined) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < heap.length && heap[l]!.priority < heap[smallest]!.priority) smallest = l;
      if (r < heap.length && heap[r]!.priority < heap[smallest]!.priority) smallest = r;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i]!, heap[smallest]!];
      i = smallest;
    }
  }
  return top;
}

export function findPath(start: Hex, goal: Hex, cost: CostFn): Path {
  const startKey = key(start);
  const goalKey = key(goal);
  if (startKey === goalKey) return { hexes: [{ ...start }], cost: 0 };
  if (!Number.isFinite(cost(goal))) return { hexes: [], cost: Infinity };

  const gScore = new Map<HexKey, number>([[startKey, 0]]);
  const cameFrom = new Map<HexKey, HexKey>();
  const closed = new Set<HexKey>();
  const open: HeapEntry[] = [];
  heapPush(open, { k: startKey, priority: distance(start, goal) });

  for (;;) {
    const current = heapPop(open);
    if (current === undefined) break;
    if (closed.has(current.k)) continue;
    if (current.k === goalKey) {
      const hexes: Hex[] = [];
      let k: HexKey | undefined = goalKey;
      while (k !== undefined) {
        hexes.push(fromKey(k));
        k = cameFrom.get(k);
      }
      hexes.reverse();
      return { hexes, cost: gScore.get(goalKey)! };
    }
    closed.add(current.k);

    const here = fromKey(current.k);
    const g = gScore.get(current.k)!;
    for (const next of neighbors(here)) {
      const nextKey = key(next);
      if (closed.has(nextKey)) continue;
      const step = cost(next);
      if (!Number.isFinite(step)) continue;
      const tentative = g + step;
      const known = gScore.get(nextKey);
      if (known === undefined || tentative < known) {
        gScore.set(nextKey, tentative);
        cameFrom.set(nextKey, current.k);
        heapPush(open, { k: nextKey, priority: tentative + distance(next, goal) });
      }
    }
  }
  return { hexes: [], cost: Infinity };
}

/** Every hex reachable within `budget`, mapped to its cheapest cost. */
export function reachable(start: Hex, budget: number, cost: CostFn): Map<HexKey, number> {
  const best = new Map<HexKey, number>([[key(start), 0]]);
  const frontier: HeapEntry[] = [];
  heapPush(frontier, { k: key(start), priority: 0 });

  for (;;) {
    const current = heapPop(frontier);
    if (current === undefined) break;
    const d = best.get(current.k);
    if (d === undefined || current.priority > d) continue;
    for (const next of neighbors(fromKey(current.k))) {
      const step = cost(next);
      if (!Number.isFinite(step)) continue;
      const total = current.priority + step;
      if (total > budget) continue;
      const nextKey = key(next);
      const known = best.get(nextKey);
      if (known === undefined || total < known) {
        best.set(nextKey, total);
        heapPush(frontier, { k: nextKey, priority: total });
      }
    }
  }
  return best;
}

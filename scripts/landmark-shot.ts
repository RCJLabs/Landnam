// A save standing on a ridge with the country's fixed points marked, so the
// landmarks can be LOOKED at. Writes JSON to stdout.
import { newGame } from '../src/state/create';
import { revealAround } from '../src/sim/fog';
import { onHighGround } from '../src/sim/fog';
import { landmarkAt, spotFixedPoints } from '../src/sim/landmark';
import { fromKey, key } from '../src/hex';
import type { GameState } from '../src/state/types';
import type { Hex } from '../src/hex';

const state: GameState = newGame(process.argv[2] ?? 'landmark-shot');

// A ridge with fixed points around it: what a band gets for climbing.
let best: { at: Hex; n: number } | null = null;
for (const k of Object.keys(state.world.tiles)) {
  const at = fromKey(k);
  if (!onHighGround(state.world, at)) continue;
  let n = 0;
  for (const j of Object.keys(state.world.tiles)) {
    const there = fromKey(j);
    const d = Math.max(
      Math.abs(there.q - at.q), Math.abs(there.r - at.r),
      Math.abs(there.q + there.r - at.q - at.r),
    );
    if (d <= 3 && landmarkAt(state.world, state.seed, there)) n++;
  }
  if (!best || n > best.n) best = { at, n };
  if (n >= 3) break;
}
if (best) {
  state.party.at = best.at;
  revealAround(state.world, best.at, 4);
  spotFixedPoints(state, best.at);
  // Light everything nearby so the shot shows the country rather than fog.
  for (const k of Object.keys(state.world.tiles)) {
    const there = fromKey(k);
    const d = Math.max(
      Math.abs(there.q - best.at.q), Math.abs(there.r - best.at.r),
      Math.abs(there.q + there.r - best.at.q - best.at.r),
    );
    if (d <= 5) state.world.seen[key(there)] = 'visible';
  }
}
state.party.food = 80;
process.stdout.write(JSON.stringify(state));

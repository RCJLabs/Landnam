// A save with the band afloat on a coast it has begun to read, so the chart
// and the warning on a crossing can be LOOKED at. Writes JSON to stdout.
import { newGame } from '../src/state/create';
import { revealAround } from '../src/sim/fog';
import { isCoastalWater } from '../src/sim/road';
import { chart, skerryAt } from '../src/sim/skerry';
import { fromKey, neighbors } from '../src/hex';
import type { GameState } from '../src/state/types';
import type { Hex } from '../src/hex';

const state: GameState = newGame(process.argv[2] ?? 'skerry-shot');

// Find water with rocks beside it, put the band on that water, and chart
// what a crew that had rowed this coast once would know.
let stand: Hex | null = null;
for (const k of Object.keys(state.world.tiles)) {
  const at = fromKey(k);
  if (!isCoastalWater(state, at)) continue;
  const rocks = neighbors(at).filter((n) => skerryAt(state, n));
  if (rocks.length === 0) continue;
  stand = at;
  for (const r of rocks) chart(state, r);
  // And anything else nearby they would have felt go by.
  for (const n of neighbors(at)) {
    for (const m of neighbors(n)) if (skerryAt(state, m)) chart(state, m);
  }
  break;
}
if (stand) {
  state.party.at = stand;
  revealAround(state.world, stand, 4);
  for (const k of state.world.charted ?? []) state.world.seen[k] = 'visible';
}
state.party.food = 90;
process.stdout.write(JSON.stringify(state));

// Builds a save with the band standing at the other landnamsmadr's fences,
// so the map can be LOOKED at rather than trusted. Writes JSON to stdout.
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { rivalDay } from '../src/sim/rival';
import { revealAround } from '../src/sim/fog';
import { RIVAL_SETTLES, CLAIM_EVERY } from '../src/sim/rival';
import type { GameState } from '../src/state/types';

let state: GameState = newGame(process.argv[2] ?? 'rival-shot');
// His clock, driven directly. This is a fixture for LOOKING at the map, not
// a play-through: the band gets ambushed on the way in some seeds, and a
// screenshot should not depend on surviving that.
void apply;
for (let i = 0; i < RIVAL_SETTLES + CLAIM_EVERY * 5 + 4; i++) {
  state.day += 1;
  rivalDay(state);
}
if (state.rival) {
  // Put the band on his doorstep and lift the fog, which is what walking
  // there would have done.
  state.party.at = { q: state.rival.at.q + 2, r: state.rival.at.r };
  revealAround(state.world, state.party.at, 5);
  // Line of sight is real and a ridge can hide a hall, which is right in
  // play and useless in a fixture: the point here is to LOOK at the marks,
  // so his ground is lit explicitly rather than left to the terrain.
  for (const k of state.rival.claims) state.world.seen[k] = 'visible';
  state.rival.met = true;
}
state.party.food = 120;
process.stdout.write(JSON.stringify({ ...state, version: state.version }));

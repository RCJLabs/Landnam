// A save with a ripe quarrel and the feud card already on the table, so the
// court can be LOOKED at. Writes JSON to stdout.
import { newGame } from '../src/state/create';
import { presentFeud } from '../src/sim/minds';
import type { GameState, Grudge } from '../src/state/types';

const state: GameState = newGame(process.argv[2] ?? 'feud-shot');
const [a, b] = state.party.people;
const grudge: Grudge = {
  a: a!.id,
  b: b!.id,
  cause: `${a!.name} would not be told what to do by ${b!.name}, and would not let it go.`,
  weight: 12,
  since: 1,
};
state.grudges.push(grudge);
presentFeud(state, grudge);
process.stdout.write(JSON.stringify(state));

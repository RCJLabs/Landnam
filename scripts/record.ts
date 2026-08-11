// Record a script for `scripts/play.ts` to replay.
//
//   npx vite-node scripts/record.ts -- --seed raven-skerry-317 --out runs/x.json
//
// Plays a seed with a deliberately DULL policy — camp, forage, take the
// first option, dismiss what needs dismissing — and writes down every action
// the sim accepted. The point is not to play well; it is to produce a real
// action list of real length so a replay has something to be faithful to.
//
// The bot that plays properly lives in `test/balance.test.ts` and stays
// there: it is a measuring instrument with its own policies, and copying it
// here would make two of it, which is how they drift.

import { writeFileSync } from 'node:fs';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import type { HardshipId } from '../src/state/types';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seed = flag('seed') ?? 'raven-skerry-317';
const hardship = flag('hardship') as HardshipId | undefined;
const out = flag('out') ?? 'runs/recorded.json';
const limit = Number(flag('limit') ?? 2000);

let state = structuredClone(newGame(seed, hardship));
const actions: Action[] = [];

for (let i = 0; i < limit && !state.end; i += 1) {
  // Whatever the game is currently asking for, in the order a player would
  // meet it: a card on screen outranks a fight, which outranks the road.
  const tries: Action[] = state.event
    // A card is CHOSEN while it is still a question and DISMISSED once it
    // has an outcome — the same rule the balance harness uses. Getting this
    // backwards is what made the first recording 1,973 actions of nothing.
    ? state.event.outcome
      ? [{ type: 'DISMISS_EVENT' }]
      : [{ type: 'CHOOSE', index: 0 }]
    : state.aftermath
      ? [{ type: 'DISMISS_AFTERMATH' }]
      : state.battle
        ? [{ type: 'B_END_TURN' }, { type: 'B_LEAVE' }]
        // Camping always succeeds, so it has to come LAST or the band never
        // feeds itself and every recorded script is a short one. (It was:
        // the first version starved on day 24 every time.)
        : state.party.food < 14
          ? [{ type: 'FORAGE' }, { type: 'HUNT' }, { type: 'FISH' }, { type: 'CAMP' }]
          : [{ type: 'CAMP' }];

  let moved = false;
  for (const action of tries) {
    const next = apply(state, action);
    if (next === state) continue;
    actions.push(action);
    state = next;
    moved = true;
    break;
  }
  // Nothing legal left. A script that keeps proposing refused actions is
  // noise, so it stops here rather than padding.
  if (!moved) break;
}

writeFileSync(out, `${JSON.stringify({ seed, ...(hardship ? { hardship } : {}), actions }, null, 1)}\n`);
// eslint-disable-next-line no-console
console.log(`${out}: ${actions.length} actions, reached day ${state.day}, ${state.end?.cause ?? 'still alive'}`);

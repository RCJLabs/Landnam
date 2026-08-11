// Record a script for `scripts/play.ts` to replay.
//
//   npx vite-node scripts/record.ts -- --seed raven-skerry-317 --out runs/x.json
//   npm run record -- --seed grim-fjord-100 --hardship fair --out runs/long.json
//
// Plays a seed with a competent-but-plain policy and writes down every action
// the sim accepted. The point is to produce a REAL run of real length: a repro
// case for a bug on day 340 is worth nothing if the recorder dies on day 36,
// and a seed challenge nobody can reach the endgame in is not a challenge.
//
// **This is not the balance harness's bot, and it cannot be.** The bot in
// `test/balance.test.ts` plays far better and its play is not expressible as
// a script at all: it calls `assign`, `queueBuild` and `foundSettlement`
// straight into the state rather than dispatching actions, so a replay of the
// actions it issues would found nothing, employ nobody and build nothing. It
// is a measuring instrument and that shortcut is fine for measuring; it just
// means the recorder has to play the game the way the player's interface
// plays it, through `apply` and nothing else.
//
// So there are two bots on purpose, and neither pretends to be the other:
// that one measures balance, this one produces artifacts.

import { writeFileSync } from 'node:fs';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { currentMode } from '../src/modes';
import { moveOptions } from '../src/sim/travel';
import { markVisible, forecast } from '../src/sim/winter';
import type { GameState, HardshipId } from '../src/state/types';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seed = flag('seed') ?? 'raven-skerry-317';
const hardship = flag('hardship') as HardshipId | undefined;
const out = flag('out') ?? 'runs/recorded.json';
const limit = Number(flag('limit') ?? 20000);
/** Not before this day: a band that plants the posts on day one has seen nothing. */
const settleFrom = Number(flag('settle') ?? 8);

const CREW = ['farmer', 'hunter', 'woodcutter', 'builder', 'fisher', 'warrior'];
const WANT = [
  'longhouse', 'farmplots', 'smokehouse', 'bud', 'storehouse',
  'palisade', 'watchtower', 'meadhall',
];

interface Memo {
  /** Set once somebody cannot be given any job at all, so it stops asking. */
  jobsDone: boolean;
  /** Whose turn it is to be moved onto whatever the winter mark says is short. */
  shifted: number;
  /**
   * The last day the band went inside to do steading business. One trip a
   * day, and no more.
   *
   * Every branch of that trip is an action the sim ACCEPTS — enter, assign,
   * queue, leave — so without a day-stamp the loop never reaches `CAMP` and
   * the day never ends. Measured before the gate: 9,960 ENTER_COLONY and
   * 9,959 LEAVE_COLONY against 52 camps, twenty thousand actions to reach
   * day 62. The cause was the queue rather than the reassignment I first
   * suspected — nothing on the want-list was affordable, so "the queue is
   * empty" stayed true forever and the bot went back in to look at it again
   * every turn. Which is exactly why this is one gate over the whole trip
   * and not a fix aimed at whichever branch was blamed first.
   */
  insideOn: number;
  /**
   * The last day somebody was moved onto a short job. ONE a day.
   *
   * The trip gate above is not enough on its own, because a successful
   * reassignment returns before the trip is stamped: the bot moved every
   * person onto `woodcutter`, which made food short, which made `wants` flip
   * to `hunter`, which moved everybody back. 19,722 ASSIGNs against 116
   * camps. `test/balance.test.ts` carries a comment about the identical bug
   * biting its own bot — sagas reaching day 259 with a hundred and sixty
   * firewood and nothing built — which is a fair warning that this shape of
   * mistake is the natural one to make here.
   */
  shiftedOn: number;
}

const actions: Action[] = [];

/**
 * Applies an action and writes it down if the sim took it.
 *
 * The recording happens HERE rather than in the loop because `apply`'s
 * refusal is an identity check — same object back means no — and the only
 * place that can be seen is next to the call. A loop that recorded the action
 * it thought it issued would write down every refusal too, and a script full
 * of refused actions is a script that replays as something else.
 */
function attempt(state: GameState, action: Action): GameState | null {
  const next = apply(state, action);
  if (next === state) return null;
  actions.push(action);
  return next;
}

/**
 * One turn, as the player's interface would take it.
 *
 * Every branch below is an `apply` call and nothing else, which is the whole
 * constraint: what this records has to be replayable, so it cannot reach past
 * the action layer the way the harness does.
 */
function step(state: GameState, memo: Memo): GameState | null {
  if (state.event) {
    return attempt(state, state.event.outcome
      ? { type: 'DISMISS_EVENT' }
      : { type: 'CHOOSE', index: 0 });
  }
  if (state.aftermath) return attempt(state, { type: 'DISMISS_AFTERMATH' });
  if (state.battle) {
    return attempt(state, { type: 'B_LEAVE' }) ?? attempt(state, { type: 'B_END_TURN' });
  }

  if (state.settlement) return atHome(state, memo);

  // Still walking. Eat off the land while that is still allowed — foraging is
  // refused at a steading, so anything taken has to be taken now.
  if (state.party.food < 30) {
    for (const type of ['FORAGE', 'HUNT', 'FISH'] as const) {
      const got = attempt(state, { type });
      if (got) return got;
    }
  }
  if (state.day >= settleFrom) {
    const founded = attempt(state, { type: 'FOUND' });
    if (founded) return founded;
  }
  const options = moveOptions(state);
  const unwalked = options.find((h) => state.world.trod[`${h.q},${h.r}`] === undefined);
  const to = unwalked ?? options[0];
  if (to) {
    const moved = attempt(state, { type: 'MOVE', to });
    if (moved) return moved;
  }
  return attempt(state, { type: 'CAMP' });
}

/** The steading's turn: jobs, the queue, and heeding the winter mark. */
function atHome(state: GameState, memo: Memo): GameState | null {
  const home = state.settlement!;
  const idle = memo.jobsDone ? [] : state.party.people.filter((p) => p.alive && !p.job);

  // What the winter mark says is short, which is the one piece of real
  // judgement in here — the game states the number, so a competent player
  // moves somebody onto whatever is missing.
  let wants: string | null = null;
  if (markVisible(state)) {
    const need = forecast(state);
    if (state.party.firewood < need.firewood) wants = 'woodcutter';
    else if (state.party.food < need.food) wants = 'hunter';
  }
  const shifting = wants !== null && home.queue.length === 0 && memo.shiftedOn !== state.day;
  const needsQueue = home.queue.length === 0;

  if (currentMode(state) === 'COLONY') {
    const person = idle[0];
    if (person) {
      // Rotated by the person's place in the band so the crew comes out
      // MIXED. Trying the list from the top each time gives everybody the
      // first job that is accepted — six farmers, nobody cutting wood, and
      // a band dead of despair inside forty days.
      const from = state.party.people.indexOf(person);
      for (let i = 0; i < CREW.length; i += 1) {
        const job = CREW[(from + i) % CREW.length]!;
        const done = attempt(state, { type: 'ASSIGN', personId: person.id, job: job as never });
        if (done) return done;
      }
      memo.jobsDone = true;
    }
    for (const building of WANT) {
      if (home.built.includes(building as never)) continue;
      const queued = attempt(state, { type: 'QUEUE_BUILD', building: building as never });
      if (queued) return queued;
    }
    if (shifting) {
      // One person at a time, cycled, so the whole band is never swept onto
      // the same job and the builder is never wiped mid-roof.
      const living = state.party.people.filter((p) => p.alive);
      for (let i = 0; i < living.length; i += 1) {
        const person2 = living[(memo.shifted + i) % living.length]!;
        if (person2.job === wants) continue;
        const done = attempt(state, { type: 'ASSIGN', personId: person2.id, job: wants as never });
        if (done) {
          memo.shifted = (memo.shifted + i + 1) % living.length;
          memo.shiftedOn = state.day;
          return done;
        }
      }
      memo.shiftedOn = state.day;
    }
    // Always a way back outside, or the days stop passing. The day is
    // stamped on the way out, so today's business is finished.
    memo.insideOn = state.day;
    const outside = attempt(state, { type: 'LEAVE_COLONY' });
    if (outside) return outside;
  } else if (memo.insideOn !== state.day && (idle.length > 0 || needsQueue || shifting)) {
    const inside = attempt(state, { type: 'ENTER_COLONY' });
    if (inside) return inside;
  }
  return attempt(state, { type: 'CAMP' });
}

let state = structuredClone(newGame(seed, hardship));
const memo: Memo = { jobsDone: false, shifted: 0, insideOn: -1, shiftedOn: -1 };

for (let i = 0; i < limit && !state.end; i += 1) {
  const next = step(state, memo);
  // Nothing legal left. A script that goes on proposing refused actions is
  // noise, so it stops here rather than padding.
  if (!next) break;
  state = next;
}

writeFileSync(out, `${JSON.stringify({ seed, ...(hardship ? { hardship } : {}), actions }, null, 1)}\n`);
// eslint-disable-next-line no-console
console.log(
  `${out}: ${actions.length} actions, reached day ${state.day}, ${state.end?.cause ?? 'still alive'}`,
);

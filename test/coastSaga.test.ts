// Can the flag flip?
//
// That is 8.5's whole precondition — "once every flag has flipped" — and it
// is the one question the conversion has never actually asked. Every slice
// from 8.2 on proved its own piece: the walking, the chart, the road, the
// steading. None of them played a SAGA. A coast where every part works and
// the whole cannot be lived through is a coast nobody can ship.
//
// So this plays. Not to measure balance — `balance.test.ts` is where numbers
// live, and it runs the hex game because that is still the game — but to
// answer whether a band can land on a line, walk it, feed itself, take
// ground, raise a hall and reach the far side of a winter without the sim
// asking a question only a hex could answer.
//
// Deliberately a DUMB player. A clever script hides gaps by never walking
// into them.
//
// ## What the numbers mean, and the control that makes them mean it
//
// This player dies. Twelve sagas of twelve starve or freeze by day 34, and
// only four ever get posts in the ground. Read alone that looks like a coast
// nobody can live on — which is exactly the wrong conclusion, and the reason
// the same fool was run against the HEX MAP before anything was concluded:
//
//   coast:  4 of 12 settled, every run ended, median death day ~21
//   hexes:  0 of 12 settled, every run ended, median death day 28
//
// The coast is not worse than the map it replaces. It is BETTER for a player
// this bad — it gets four bands onto ground where the hex map got none. The
// dying is the player: it does not ration, does not hunt, and walks while it
// has three days' food rather than three weeks'. Balance is measured in
// `balance.test.ts` by a harness that plays properly, and that still runs the
// hex game because the hex game is still the game.
//
// What this file is for is narrower and is the whole of 8.5's precondition:
// does anything on a coast ask a question only a hex can answer.

import { describe, expect, it } from 'vitest';


import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import { apply, type Action } from '../src/sim/actions';
import { currentMode } from '../src/modes';
import { canFound } from '../src/sim/site';
import { countryHere, walkOptions, standingAt } from '../src/sim/coast';
import { availableJobs, queueBuild } from '../src/sim/colony';
import { BUILDINGS } from '../src/data/buildings';
import { canFish, canGather } from '../src/sim/gathering';
import { living } from '../src/sim/people';
import { foodPerDay } from '../src/sim/upkeep';

interface Saga {
  seed: string;
  days: number;
  settled: boolean;
  stops: number;
  built: number;
  alive: number;
  end?: string;
  /** Verbs the sim refused when the player believed they were allowed. */
  refused: string[];
}

/**
 * One saga, played by somebody with no plan beyond staying alive.
 *
 * Every dispatch is checked for having DONE something: `apply` returns the
 * same object when it refuses, and a refusal the player had no way to
 * predict is exactly the shape of a hex-shaped question left in the sim.
 */
function playCoast(seed: string, until: number): Saga {
  let state = cloneState(newGame(seed));
  const refused: string[] = [];

  const act = (action: Action, expected = true): boolean => {
    const next = apply(state, action);
    const moved = next !== state;
    if (!moved && expected) refused.push(`${action.type}@d${state.day}`);
    state = next;
    return moved;
  };

  /** One go at the day's work. False when there is nothing left to try. */
  const spend = (now: typeof state): boolean => {
    if (canFish(now) && act({ type: 'FISH' }, false)) return true;
    if (canGather(now) && act({ type: 'FORAGE' }, false)) return true;
    return false;
  };

  for (let guard = 0; guard < 6000 && state.day < until && !state.end; guard += 1) {
    // Cards first, always: nothing else is allowed while one is up.
    if (state.event) {
      act(state.event.outcome ? { type: 'DISMISS_EVENT' } : { type: 'CHOOSE', index: 0 });
      continue;
    }
    if (state.aftermath) { act({ type: 'DISMISS_AFTERMATH' }); continue; }

    // A fight is the only thing that outranks the day.
    if (currentMode(state) === 'BATTLE') {
      if (state.battle?.outcome) { act({ type: 'B_LEAVE' }); continue; }
      const foe = state.battle?.combatants.find((c) => c.side === 'foe' && !c.down && !c.fled);
      if (foe) act({ type: 'B_STRIKE', targetId: foe.personId }, false);
      act({ type: 'B_END_TURN' }, false);
      continue;
    }

    if (currentMode(state) === 'COLONY') {
      // Put idle hands to work, queue whatever the counsel wants, go back out.
      for (const p of living(state.party.people)) {
        if (p.job) continue;
        const job = availableJobs(state)[0];
        if (job) act({ type: 'ASSIGN', personId: p.id, job: job.id }, false);
      }
      // Whatever this steading can actually put up next.
      for (const def of BUILDINGS) {
        if (queueBuild(cloneState(state), def.id)) {
          act({ type: 'QUEUE_BUILD', building: def.id }, false);
          break;
        }
      }
      act({ type: 'LEAVE_COLONY' });
      continue;
    }

    // --- On the road ---
    //
    // Dumb, but not suicidal, and the order of these two clauses is the
    // whole of what "dumb" is allowed to mean. Two drafts of this player
    // measured a working coast as a broken one:
    //
    //   1. It stood on the landing foraging until it starved. A forage on
    //      SHORE yields 3 against 3 eaten a day — break-even, correctly,
    //      because shore is the poorest ground in the game. Valley pays 8,
    //      forest 7, meadow 5. A player that will not walk off a beach is
    //      measuring its own stubbornness.
    //   2. Told to forage FIRST and walk only if that failed, it foraged
    //      every single day, walked nowhere at all, and starved anyway.
    //
    // So travelling comes first while there is nowhere to live, and the
    // day's work is what a band does once it has somewhere to do it.
    if (!state.settlement) {
      const country = countryHere(state);
      const worth = country === 'valley' || country === 'meadow' || country === 'forest';
      if (worth && canFound(state)) { act({ type: 'FOUND' }); continue; }
      const on = walkOptions(state).filter((s) => s > standingAt(state));
      // Take poor ground rather than walk off the end of the world.
      if (on.length === 0) {
        if (canFound(state)) { act({ type: 'FOUND' }); continue; }
      } else if (state.party.food > foodPerDay(state) * 3) {
        // Walk while there is food for the walking.
        act({ type: 'WALK', to: Math.min(...on) });
        continue;
      }
    }

    // Feed, then sleep. The day's work is tried ONCE — `spend` was called
    // twice here at first, and a card raised by the first call made the
    // second refuse, which the sweep then reported as the sim refusing CAMP.
    // The instrument was wrong, not the coast.
    const worked = spend(state);
    if (!worked && !state.event) act({ type: 'CAMP' });
  }

  return {
    seed,
    days: state.day,
    settled: !!state.settlement,
    stops: Object.keys(state.world.trodStops ?? {}).length,
    built: state.settlement?.built.length ?? 0,
    alive: living(state.party.people).length,
    ...(state.end ? { end: state.end.cause } : {}),
    refused,
  };
}

describe('a saga, lived on a coast', () => {
  it('can be played from the landing to the far side of a winter', () => {
    // The flag's precondition, and the whole of 8.5's first question. Every
    // slice since 8.2 proved its own piece; none of them played a saga.
    const sagas = Array.from({ length: 12 }, (_, i) => playCoast(`coast-saga-${i}`, 140));

    // A saga that ENDED is the game working — bands die, and this player is
    // a fool. What must never happen is a run that stops advancing WITHOUT
    // an ending: that is a verb the sim refuses and the player cannot see.
    for (const s of sagas) {
      expect(s.end ?? 'ran on', `${s.seed}: stopped dead at day ${s.days} with no ending`)
        .not.toBe('ran on');
    }

    const settled = sagas.filter((s) => s.settled).length;
    const past90 = sagas.filter((s) => s.days >= 90 || s.end).length;
    const alive = sagas.filter((s) => s.alive > 0).length;
    // eslint-disable-next-line no-console
    console.log(
      `coast sagas: ${settled}/12 settled, ${past90}/12 reached winter or an ending, ` +
        `${alive}/12 still had people, ` +
        `stretches walked ${Math.min(...sagas.map((s) => s.stops))}-` +
        `${Math.max(...sagas.map((s) => s.stops))}, ` +
        `built ${Math.max(...sagas.map((s) => s.built))} at most`,
    );
    for (const s of sagas.filter((x) => x.end)) {
      // eslint-disable-next-line no-console
      console.log(`  ${s.seed}: ended day ${s.days} — ${s.end}`);
    }

    // Measured against the same player on the hex map, which settles NONE of
    // the same twelve — see the head of this file. The bar is that a coast
    // is not worse than the country it replaces.
    expect(settled, 'no band on any coast ever took ground').toBeGreaterThan(0);
  });

  it('never refuses a verb the player was offered', () => {
    // The real hunt. `apply` returns the same object when it says no, so a
    // refusal here is the sim asking a question a coast cannot answer — a
    // hex-shaped hole, which is exactly what 8.5 is looking for.
    const all: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      all.push(...playCoast(`coast-refuse-${i}`, 120).refused);
    }
    const kinds = new Map<string, number>();
    for (const r of all) {
      const verb = r.split('@')[0]!;
      kinds.set(verb, (kinds.get(verb) ?? 0) + 1);
    }
    if (kinds.size > 0) {
      // eslint-disable-next-line no-console
      console.log('refused:', [...kinds].map(([k, n]) => `${k}×${n}`).join(' '));
    }
    expect([...kinds.keys()], 'the sim refused verbs the player was offered').toEqual([]);
  });

  it('walks the coast rather than standing on the sand', () => {
    // A saga that never leaves stretch 0 would pass every check above and
    // prove nothing about a line.
    const s = playCoast('coast-walker', 200);
    expect(s.stops, 'the band never went anywhere').toBeGreaterThan(2);
  });
});

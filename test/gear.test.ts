// Gear you can see.
//
// The premise measured before building: the game already knew what everybody
// was carrying and showed none of it.
//
//   - `Combatant.throwsLeft` — `sim/ranks.ts` says in as many words that
//     "`throw` is a hand-axe. It reaches anybody, which is what makes the
//     back rank worth standing in". The whole of that resource reached the
//     screen as a digit on a button: "Throw 1".
//   - `Person.bond` — `sim/joining.ts` says growth "buys labour, never a
//     wider shield wall", and the road drew a painted war shield on the back
//     of every walker, hands included.
//   - `Person.job` — a woodcutter and a fisher were the same silhouette.
//
// Nothing here needed a new field, and none of it is stored: it is all read
// off state the sim already keeps.

import { describe, expect, it } from 'vitest';
import { JOBS, jobById, type JobId } from '../src/data/jobs';
import { steadingScene } from '../src/render/steading';
import { newGame } from '../src/state/create';
import { cloneState } from '../src/state/clone';
import { foundSettlement } from '../src/sim/site';
import { learnStop } from '../src/sim/coast';
import { ROUTE_STOPS } from '../src/sim/route';
import type { GameState } from '../src/state/types';

function withHall(seed = 'gear-seed'): GameState {
  for (let stop = 4; stop < ROUTE_STOPS; stop += 1) {
    const state = cloneState(newGame(seed));
    state.party.stop = stop;
    for (let s = 0; s < ROUTE_STOPS; s += 1) learnStop(state, s);
    if (foundSettlement(state)) return state;
  }
  throw new Error('nowhere would take a hall');
}

describe('a job puts something in your hands', () => {
  it('gives every job that works with a tool one, as data', () => {
    // The pillar: adding content must never mean touching engine code
    // (CLAUDE.md). A job's tool lives on the job, so a new job arrives with
    // its own gear and `render/gear.ts` is the only place that draws.
    const toolless = JOBS.filter((j) => !j.tool).map((j) => j.id);
    // The warrior is the one deliberate exception, and it is not an
    // omission: his gear is the shield and spear every sworn man carries, so
    // a tool as well would draw him holding two things he does not have.
    expect(toolless).toEqual(['warrior']);
  });

  it('draws every tool it names', () => {
    // A tool id nothing knows how to draw is a person holding nothing.
    const drawable = new Set(['sickle', 'bow', 'net', 'axe', 'adze', 'herbs']);
    for (const job of JOBS) {
      if (!job.tool) continue;
      expect(drawable, `${job.id} carries an undrawable ${job.tool}`).toContain(job.tool);
    }
  });

  it('gives no two jobs the same tool, or the picture says nothing', () => {
    const tools = JOBS.filter((j) => j.tool).map((j) => j.tool!);
    expect(new Set(tools).size).toBe(tools.length);
  });

  it('carries the job\'s own tool into the yard', () => {
    const state = withHall();
    for (const id of ['farmer', 'woodcutter', 'fisher'] as JobId[]) {
      for (const person of state.party.people) person.job = id;
      const scene = steadingScene(state);
      expect(scene.folk.length).toBeGreaterThan(0);
      for (const f of scene.folk) {
        expect(f.tool, `a ${id} carries nothing`).toBe(jobById(id)?.tool);
      }
    }
  });

  it('gives an idle person nothing to hold', () => {
    const state = withHall();
    for (const person of state.party.people) delete person.job;
    for (const f of steadingScene(state).folk) expect(f.tool).toBeUndefined();
  });

  it('gives a warrior no tool, because he already has arms', () => {
    const state = withHall();
    for (const person of state.party.people) person.job = 'warrior';
    for (const f of steadingScene(state).folk) expect(f.tool).toBeUndefined();
  });
});

describe('who bears arms', () => {
  it('starts a band that is all sworn, so all six carry shields', () => {
    // The six who came off the knarr are the warband. Everybody the steading
    // takes in afterwards is a `hand`.
    const band = newGame('gear-band').party.people.filter((p) => p.alive);
    expect(band.length).toBeGreaterThan(0);
    expect(band.every((p) => p.bond === 'sworn')).toBe(true);
  });

  it('keeps the two bonds distinguishable, which is what the picture reads', () => {
    // `walker()` takes `arms` and hangs the shield on it. If `bond` ever
    // stopped being the answer to "does this person fight", the road would
    // go back to telling the same lie silently.
    const state = withHall();
    const person = state.party.people[0]!;
    expect(person.bond === 'sworn' || person.bond === 'hand').toBe(true);
  });
});

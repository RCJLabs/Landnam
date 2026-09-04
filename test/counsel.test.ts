// The counsel under the winter mark.
//
// THE STANDARD THIS HAS TO MEET is not "it says something helpful". It is
// that the sentence is TRUE: if the panel says two more hands at the woodpile
// would close it, then moving two hands to the woodpile has to close it, in
// the same projection the panel above it is drawn from. Advice that is merely
// plausible is the hand-written `measured` string all over again — a claim
// that exists rather than a claim that holds.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { assign } from '../src/sim/colony';
import { counsel, counselLine, roadCounsel, roadCounselLine } from '../src/sim/counsel';
import { atHome } from '../src/sim/site';
import { distanceFromHome, launchBlocker } from '../src/sim/expedition';
import { standingAt, walkOptions } from '../src/sim/coast';
import { apply } from '../src/sim/actions';
import { forecast, markVisible } from '../src/sim/winter';
import type { GameState } from '../src/state/types';

describe('the counsel is arithmetic, not encouragement', () => {
  /**
   * THE BAR THAT MATTERS. Over a real spread of worlds, every counsel the
   * game is willing to give is carried out and the mark is re-read. If the
   * gap it promised to close is still open, the panel lied.
   */
  it('says nothing it cannot back up', () => {
    let given = 0;
    let held = 0;
    for (let s = 0; s < 60; s += 1) {
      const state = settled(`counsel-${s}`);
      if (!state) continue;
      state.day = 30; // inside the mark window, autumn, still time to act
      state.party.food = 12;
      state.party.firewood = 8;
      if (!markVisible(state)) continue;

      const said = counsel(state);
      if (!said) continue;
      given += 1;

      // Carry out exactly what it counted.
      const done = structuredClone(state);
      for (const id of said.who) assign(done, id, said.job);
      const after = forecast(done);
      const gap = said.closes === 'food' ? after.foodGap : after.firewoodGap;
      if (gap >= 0) held += 1;
    }

    // eslint-disable-next-line no-console
    console.log(`counsel offered on ${given} of 60 landings; ${held} held up when carried out`);
    expect(given, 'the counsel never spoke once — nothing was tested').toBeGreaterThan(0);
    expect(held, `${given - held} of ${given} counsels did not close the gap they promised`)
      .toBe(given);
  });

  /**
   * AND IT HOLDS WHICHEVER HANDS THE PLAYER PICKS.
   *
   * The panel says "two more hands at the woodpile". It does not name them,
   * so the promise is only worth anything if ANY two will do — which is what
   * counting the least productive hands buys, and the reason `tryClosing`
   * sorts worst-first after the best-first version failed 22 of 51 here.
   *
   * Checked by moving hands the counsel did NOT count: swap its picks for
   * everybody else eligible, same number, and the gap must still close.
   */
  it('holds up when a different set of hands does the work', () => {
    let tested = 0;
    for (let s = 0; s < 60; s += 1) {
      const state = settled(`counsel-swap-${s}`);
      if (!state) continue;
      state.day = 30;
      state.party.food = 12;
      state.party.firewood = 8;
      if (!markVisible(state)) continue;
      const said = counsel(state);
      if (!said) continue;

      const others = state.party.people
        .filter((p) => p.alive && p.job !== said.job && !said.who.includes(p.id))
        .slice(0, said.hands);
      if (others.length < said.hands) continue;

      const done = structuredClone(state);
      for (const p of others) assign(done, p.id, said.job);
      const after = forecast(done);
      const gap = said.closes === 'food' ? after.foodGap : after.firewoodGap;
      tested += 1;
      expect(
        gap,
        `"${counselLine(said)}" held for the hands it counted and failed for a different `
          + `${said.hands} — the player is not told which ones to move`,
      ).toBeGreaterThanOrEqual(0);
    }
    expect(tested, 'no landing had a spare set of hands to swap in').toBeGreaterThan(0);
  });

  /**
   * AND IT NEVER ROBS THE STORE IT IS NOT TALKING ABOUT.
   *
   * A band short of wood must never be told to move its food-hands: a player
   * who follows that once and starves stops reading the panel, and the panel
   * is the most valuable thing on the screen. Checked as an OUTCOME rather
   * than by inspecting who was eligible — carry the counsel out and the other
   * store must be no worse off than it was.
   *
   * The first cut of this asserted `expect(anyOnOther || true).toBe(true)`,
   * which is a tautology wearing an assertion's clothes. It would have passed
   * against advice that emptied the larder.
   */
  it('never robs the store it is not talking about', () => {
    let checked = 0;
    for (let s = 0; s < 60; s += 1) {
      const state = settled(`counsel-rob-${s}`);
      if (!state) continue;
      state.day = 30;
      state.party.food = 6;
      state.party.firewood = 6;
      if (!markVisible(state)) continue;
      const said = counsel(state);
      if (!said) continue;

      const other = said.closes === 'food' ? 'firewood' : 'food';
      const gap = (g: GameState) => (other === 'food' ? forecast(g).foodGap : forecast(g).firewoodGap);
      const before = gap(state);

      const done = structuredClone(state);
      let moved = 0;
      for (const p of [...done.party.people].filter((q) => q.alive && q.job !== said.job)) {
        if (moved >= said.hands) break;
        if (assign(done, p.id, said.job)) moved += 1;
      }
      checked += 1;
      expect(
        gap(done),
        `counsel to close ${said.closes} cost the band ${before - gap(done)} of ${other}`,
      ).toBeGreaterThanOrEqual(before);
    }
    expect(checked, 'no counsel was ever offered — nothing was tested').toBeGreaterThan(0);
  });
});

describe('when it holds its tongue', () => {
  it('says nothing once the stores already reach spring', () => {
    const state = settled('counsel-ready');
    expect(state).toBeTruthy();
    state!.day = 30;
    state!.party.food = 999;
    state!.party.firewood = 999;
    expect(forecast(state!).ready).toBe(true);
    expect(counsel(state!)).toBeUndefined();
  });

  it('says nothing out of season, when the mark is not a live target', () => {
    const state = settled('counsel-season');
    expect(state).toBeTruthy();
    state!.day = 80; // past the thaw, mark not visible
    state!.party.food = 1;
    state!.party.firewood = 1;
    expect(markVisible(state!)).toBe(false);
    expect(counsel(state!)).toBeUndefined();
  });

  it('says nothing to a band with no steading to crew', () => {
    const state = structuredClone(newGame('counsel-homeless'));
    expect(counsel(state)).toBeUndefined();
  });
});

describe('the counsel on the road (11.U3)', () => {
  /**
   * A settled band inside the mark's window with nobody on food or wood, and
   * genuinely away from its own yard.
   *
   * IT LAUNCHES AND WALKS, rather than setting `party.stop` by hand, and the
   * difference is the whole honesty of this bar. `canWalk` refuses outright
   * while `state.settlement && !state.expedition` — a settled band with no
   * party out CANNOT be anywhere but home — so a fixture that teleports the
   * roster off its stop builds a state the game never produces, and a bar
   * standing on one is CLAUDE.md's trap 1 wearing a test's clothes. (The
   * first cut of this file did exactly that; the away-from-home days the
   * harness counted for 11.U3 are all expedition days.)
   *
   * MEASURED 2026-09-03 that the window is real and not an edge: 216 settler
   * and 161 raider away-from-home mark-window days over 20 sagas, with a
   * live counsel behind 109 and 122 of them.
   */
  function counselledAndAway(seed: string): GameState | undefined {
    let state = settled(seed);
    if (!state) return undefined;
    state.day = 24; // room to walk and still land inside the window
    // Enough in the store that the launch is not refused for want of it.
    state.party.food = 200;
    state.party.firewood = 200;

    const going = state.party.people.filter((p) => p.alive).slice(0, 2).map((p) => p.id);
    if (launchBlocker(state, going) !== null) return undefined;
    state = apply(state, { type: 'LAUNCH', members: going, purpose: 'explore' });
    if (!state.expedition) return undefined;

    // Now the party can move, because a party is out. Three steps up the
    // coast, whichever way the route allows.
    for (let step = 0; step < 3; step += 1) {
      const options = walkOptions(state);
      const here = standingAt(state);
      const to = options.find((o) => o > here) ?? options[0];
      if (to === undefined) break;
      state = apply(state, { type: 'WALK', to });
      if (state.end || state.event || state.battle) return undefined;
    }
    if (atHome(state)) return undefined;

    // Set the stores AFTER the walk — the days just spent moved them.
    state.party.food = 12;
    state.party.firewood = 8;
    if (!markVisible(state) || !counsel(state)) return undefined;
    return state;
  }

  it('holds its tongue while the band is standing in its own yard', () => {
    const state = settled('road-counsel-home');
    expect(state).toBeTruthy();
    state!.day = 30;
    state!.party.food = 12;
    state!.party.firewood = 8;
    state!.party.stop = state!.settlement!.stop;
    expect(atHome(state!)).toBe(true);
    // The colony panel already carries it there, so the road must not.
    expect(counsel(state!), 'the fixture stopped producing a counsel').toBeDefined();
    expect(roadCounsel(state!)).toBeUndefined();
  });

  it('speaks once the band is away, and says the same thing the colony would', () => {
    let spoke = 0;
    for (let s = 0; s < 40; s += 1) {
      const state = counselledAndAway(`road-counsel-${s}`);
      if (!state) continue;
      spoke += 1;
      // NOT a second opinion: the road asks `counsel` itself, so the two can
      // never drift into disagreeing about the same steading.
      expect(roadCounsel(state)).toEqual(counsel(state));
    }
    // eslint-disable-next-line no-console
    console.log(`road counsel spoke on ${spoke} of 40 landings taken away from home`);
    expect(spoke, 'no landing produced an away-from-home counsel — nothing was tested')
      .toBeGreaterThan(0);
  });

  it('names the walk home as well as the move, and never a walk of nought days', () => {
    let checked = 0;
    for (let s = 0; s < 40; s += 1) {
      const state = counselledAndAway(`road-counsel-line-${s}`);
      if (!state) continue;
      const said = roadCounsel(state)!;
      const line = roadCounselLine(state, said);
      checked += 1;

      // The colony's sentence is reused WHOLE — not rephrased, not trimmed.
      expect(line.startsWith(counselLine(said))).toBe(true);
      // And the road's own half names the walk it is asking for.
      const days = Math.round(distanceFromHome(state));
      expect(days).toBeGreaterThan(0);
      expect(line).toMatch(/ walk home\.$/);
      expect(line).not.toContain('Nought');
      expect(line.length).toBeGreaterThan(counselLine(said).length);
    }
    expect(checked, 'no landing was tested').toBeGreaterThan(0);
  });

  it('says nothing to a band that has no steading to walk back to', () => {
    const state = structuredClone(newGame('road-counsel-homeless'));
    expect(roadCounsel(state)).toBeUndefined();
  });
});

describe('the sentence', () => {
  it('names the work and the number, and reads as one line of the game', () => {
    expect(counselLine({ job: 'woodcutter', hands: 1, closes: 'firewood', who: [] }))
      .toBe('One more hand at the woodpile would close it.');
    expect(counselLine({ job: 'fisher', hands: 3, closes: 'food', who: [] }))
      .toBe('Three more hands on the water would close it.');
  });

  it('does not fall back to a bare job id for any job it can name', () => {
    for (const job of ['woodcutter', 'hunter', 'fisher', 'farmer'] as const) {
      expect(counselLine({ job, hands: 2, closes: 'food', who: [] })).not.toContain(job);
    }
  });
});

function settled(seed: string): GameState | undefined {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  const crew = ['builder', 'warrior', 'warrior', 'builder', 'warrior', 'builder'] as const;
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, ix) => assign(state, p.id, crew[ix % crew.length]!));
  return state;
}

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
import { counsel, counselLine } from '../src/sim/counsel';
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

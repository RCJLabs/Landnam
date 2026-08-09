// Audit item 10: what a player who cannot see the screen is told.
//
// The render layer had six `aria` attributes in it, on a game whose primary
// target is a phone browser — and the measured gaps were not the obvious
// ones. Driving the built page found every button already had an accessible
// name and every touch target was at or over 44px bar ONE (the Saga button,
// at 43 wide, unnoticed for months because nothing counted). What was missing
// was everything about CHANGE: no live region anywhere, so a turn-based game
// that rewrites the whole page every action announced nothing at all; no
// dialog semantics, so a card covering the screen read as more page; and the
// largest thing on screen, the map, was an unlabelled graphic.
//
// The wiring is in the renderer and verified by driving the built page. The
// TEXT is pure and lives in src/sim, which is where this project puts
// anything that can be unit-tested — so it is tested here.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { ANNOUNCE_MAX, announce, mapLabel, standing } from '../src/sim/announce';
import { chronicle } from '../src/sim/saga';
import type { GameState } from '../src/state/types';

function band(seed = 'cry'): GameState {
  return structuredClone(newGame(seed));
}

describe('what the listener is told', () => {
  it('reads as a sentence, not as six cells of a bar', () => {
    const line = standing(band());
    expect(line).toMatch(/^Day \d+, \w+, /);
    expect(line).toContain('people');
    expect(line).toContain('Heart');
  });

  it('gives the stores in days as well as in sacks', () => {
    // The number a listener actually needs is how long it lasts, and they
    // cannot glance at the winter mark to work it out.
    const state = band();
    state.party.food = 60;
    state.party.firewood = 20;
    const line = standing(state);
    expect(line).toMatch(/Food 60, \d+ days/);
    expect(line).toMatch(/Wood 20, \d+ nights/);
  });

  it('counts one day and one night in the singular', () => {
    const state = band();
    state.party.food = 3;
    state.party.firewood = 1;
    const line = standing(state);
    expect(line).toContain('1 day.');
    expect(line).toContain('1 night.');
    expect(line).not.toContain('1 days');
  });

  it('says where the band is standing', () => {
    const road = band();
    expect(standing(road)).toContain('on the road');

    const home = band();
    home.settlement = { ...(home.settlement ?? {}), name: 'Hvallund' } as never;
    expect(standing(home)).toContain('at Hvallund');

    const fighting = band();
    fighting.battle = { foes: [] } as never;
    expect(standing(fighting)).toContain('in a fight');
  });
});

describe('the news comes before the ledger', () => {
  it('leads with what just happened', () => {
    const state = band();
    chronicle(state, 'They fired the smokehouse.', 'grim');
    const said = announce(state, state.saga.length - 1);
    expect(said.indexOf('smokehouse')).toBeLessThan(said.indexOf('Day '));
  });

  it('carries only the newest lines, never the whole chronicle', () => {
    const state = band();
    for (let i = 0; i < 20; i += 1) chronicle(state, `Line ${i}.`, 'plain');
    const said = announce(state, 0);
    // A live region that reads a paragraph every turn is one a listener
    // switches off.
    expect(said).not.toContain('Line 0.');
    expect(said).toContain(`Line ${19}.`);
    expect(said.match(/Line \d+\./g)?.length).toBeLessThanOrEqual(ANNOUNCE_MAX);
  });

  it('says nothing twice when nothing has happened', () => {
    const state = band();
    const first = announce(state, state.saga.length);
    expect(first).toBe(standing(state));
  });

  it('and when the run ends, says that instead of the ledger', () => {
    const state = band();
    state.end = { cause: 'starved', title: 'The Stores Gave Out', lines: ['It was day 90.'] };
    const said = announce(state, 0);
    expect(said).toContain('The Stores Gave Out');
    expect(said).toContain('It was day 90.');
    expect(said).not.toContain('Heart');
  });
});

describe('the map has something to say for itself', () => {
  it('summarises rather than reading out every hex', () => {
    const state = band();
    const label = mapLabel(state);
    expect(label).toContain('Map of the country');
    expect(label).toContain('No steading yet');
    expect(label).toMatch(/\d+ of \d+ neighbours met/);
    // The panel under the map is the detailed view; the label points at it
    // rather than trying to be it.
    expect(label).toContain('panel below');
  });

  it('names the steading once there is one', () => {
    const state = band();
    state.settlement = { ...(state.settlement ?? {}), name: 'Ravakr' } as never;
    expect(mapLabel(state)).toContain('Ravakr stands here');
  });
});

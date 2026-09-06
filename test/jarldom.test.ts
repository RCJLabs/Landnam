// 12.13: the title outlives the man, and the coast can take it back.
//
// `Jarldom` was `{name, since}`, written once in `thing.ts` and cleared
// nowhere. `mourn` — the one funnel all six death paths run through — passed
// the hall, the blade and the orphans and knew nothing about the title, so a
// band went on ruling under a dead man and went on being paid for it: three
// of word, a raider cap two higher, the joining draw, goodwill that stops
// cooling, a season's tribute, and the Thing shut behind them forever.
//
// Every claim below is asserted through `mourn` rather than by calling
// `titleLapses` directly, because "the title ends when the man does" is a
// claim about the DEATH PATH, and a test that calls the new function itself
// would pass on a build where nothing ever calls it — which is the exact
// shape of the bug it is here to prevent coming back.

import { describe, expect, it } from 'vitest';
import { settled } from './fixtures/settle';
import { mourn } from '../src/sim/kin';
import { JARLDOMS, TITLE_LOST, everRuled, isTheJarl } from '../src/sim/jarldom';
import { callThing, canCallThing, thingReady, yearsRuled } from '../src/sim/thing';
import { THING_COOLDOWN } from '../src/data/thing';
import { nextThaw, YEAR_LENGTH } from '../src/sim/calendar';
import { shiftStanding } from '../src/sim/neighbours';
import { markOf } from '../src/sim/challenge';
import { raiderCap } from '../src/sim/battle';
import { wordOf } from '../src/sim/word';
import { fullName, living } from '../src/sim/people';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import type { GameState, Person } from '../src/state/types';

/** A band the Thing would carry for. Same shape `thing.test.ts` uses. */
function worthy(seed: string): GameState {
  const state = settled(seed);
  const home = state.settlement!;
  home.built.push('longhouse', 'meadhall');
  state.day = nextThaw(1) + YEAR_LENGTH;
  state.party.food = 200;
  state.party.morale = 80;
  const friend = state.neighbours[0];
  if (friend) {
    friend.found = true;
    shiftStanding(state, friend.id, 60);
  }
  state.grudges = [];
  expect(thingReady(state), `${seed}: not worthy after setup`).toBe(true);
  return state;
}

/**
 * A band that has actually been proclaimed, through `callThing`.
 *
 * Rolled rather than assigned, so the jarl is whoever the game would really
 * have named and carries whatever id the game would really have stamped. A
 * hand-built `state.jarl = {...}` would be a fixture asserting about itself.
 */
function ruling(seed: string): { state: GameState; jarl: Person } {
  for (let i = 0; i < 60; i += 1) {
    // Not every seed grows a coast with ground a hall will stand on, and
    // `settled` says so by failing. That is the fixture working, so skip the
    // seed rather than let it read as a jarldom that did not carry.
    let state: GameState;
    try {
      state = worthy(`${seed}-${i}`);
    } catch {
      continue;
    }
    const result = callThing(state);
    if (!result?.proclaimed) continue;
    const jarl = state.party.people.find((p) => isTheJarl(state, p));
    expect(jarl, 'proclaimed, but the state names nobody in the band').toBeDefined();
    return { state, jarl: jarl! };
  }
  throw new Error('sixty worthy bands and the Thing carried for none of them');
}

describe('the title ends with the man', () => {
  it('stamps the person, not just their name', () => {
    const { state, jarl } = ruling('stamp');
    expect(state.jarl!.id).toBe(jarl.id);
    expect(state.jarl!.name).toBe(fullName(jarl));
  });

  it('clears the jarldom when the man the Thing named dies', () => {
    const { state, jarl } = ruling('dies');
    state.flags['ruleTaken'] = state.day;
    state.day += 40;

    jarl.alive = false;
    mourn(state, jarl);

    expect(state.jarl, 'the band is still jarl under a dead man').toBeUndefined();
    expect(state.flags[TITLE_LOST]).toBe(1);
    expect(yearsRuled(state)).toBe(0);
    // And it says so, once, in the book — a title that ends in silence is a
    // set of numbers quietly changing under the player.
    expect(state.saga.some((e) => e.text.includes('the rule went into the ground'))).toBe(true);
  });

  it('does not end on anybody else', () => {
    const { state, jarl } = ruling('other');
    const other = living(state.party.people).find((p) => p.id !== jarl.id)!;
    other.alive = false;
    mourn(state, other);
    expect(state.jarl, 'somebody else died and the coast lost its jarl').toBeDefined();
    expect(state.flags[TITLE_LOST]).toBeUndefined();
  });

  it('reopens the Thing, which is the half that makes it a game', () => {
    const { state, jarl } = ruling('reopen');
    expect(canCallThing(state), 'the Thing was callable while a jarl sat').toBe(false);

    // Past the Thing's own cooldown first. `callThing` stamps
    // `thingCalledOn` and the coast will not be called back inside twelve
    // days, which is a rule about the Thing rather than about the title —
    // without this the assertion below would be reading the cooldown and
    // reporting it as a jarldom that never lapsed.
    state.day += THING_COOLDOWN + 1;
    jarl.alive = false;
    mourn(state, jarl);

    // The winters are still stood, the hall still stands, the friends are
    // still friends. What it costs to take it back is a feast and the roll.
    expect(thingReady(state)).toBe(true);
    expect(canCallThing(state), 'the title lapsed and the coast could not be asked again')
      .toBe(true);
  });

  it('takes back what ruling was worth', () => {
    const { state, jarl } = ruling('worth');
    const ruledWord = wordOf(state);
    const ruledCap = raiderCap(state);

    jarl.alive = false;
    mourn(state, jarl);

    expect(wordOf(state)).toBeLessThan(ruledWord);
    expect(raiderCap(state)).toBeLessThan(ruledCap);
  });

  it('says it again when the coast grants it a second time', () => {
    const { state, jarl } = ruling('again');
    state.flags['ruleTaken'] = state.day;
    jarl.alive = false;
    mourn(state, jarl);
    // The proclamation card is gated on this being unset. Left set, a second
    // jarldom would arrive without a word said about it.
    expect(state.flags['ruleTaken']).toBeUndefined();
  });
});

describe('what the band DID is not lost with the title', () => {
  it('still counts as ever having ruled', () => {
    const { state, jarl } = ruling('record');
    expect(state.flags[JARLDOMS]).toBe(1);

    jarl.alive = false;
    mourn(state, jarl);

    expect(everRuled(state), 'a band that ruled and buried its jarl never ruled').toBe(true);
    // The challenge mark reads "a jarldom taken". Taken, not still held.
    expect(markOf(state).jarl).toBe(true);
    expect(state.flags[JARLDOMS]).toBe(1);
  });

  it('says nothing of a band that was never proclaimed', () => {
    const state = worthy('never');
    expect(everRuled(state)).toBe(false);
    expect(markOf(state).jarl).toBeUndefined();
  });
});

describe('a save from before the title could end', () => {
  it('has its jarl resolved to a person on the way in', () => {
    const { state, jarl } = ruling('migrate');
    // Exactly the v65 shape, and one version behind.
    const old = JSON.parse(JSON.stringify({ ...state, jarl: { name: fullName(jarl), since: 300 } }));
    old.version = 65;
    delete old.jarl.id;

    const now = migrate(old).save as unknown as GameState;
    expect(now.version).toBe(SAVE_VERSION);
    expect(now.jarl!.id, 'the migration left the jarldom guessing from a string').toBe(jarl.id);
  });

  it('leaves the id absent when the name picks out more than one person', () => {
    const { state, jarl } = ruling('twins');
    const twin = state.party.people.find((p) => p.id !== jarl.id)!;
    twin.name = jarl.name;
    twin.byname = jarl.byname;

    const old = JSON.parse(JSON.stringify({ ...state, jarl: { name: fullName(jarl), since: 300 } }));
    old.version = 65;
    delete old.jarl.id;

    const now = migrate(old).save as unknown as GameState;
    // Two people answer to it, so the migration declines rather than picks —
    // and the name fallback below is what carries such a save.
    expect(now.jarl!.id).toBeUndefined();
    expect(now.jarl!.name).toBe(fullName(jarl));
  });

  it('is matched by name, because that is all it carries', () => {
    const { state, jarl } = ruling('oldsave');
    // Exactly the shape v65 and earlier wrote: a name and a day, no id.
    state.jarl = { name: fullName(jarl), since: state.jarl!.since };

    expect(isTheJarl(state, jarl)).toBe(true);
    jarl.alive = false;
    mourn(state, jarl);
    expect(state.jarl, 'an old save kept ruling under its dead man').toBeUndefined();
  });
});

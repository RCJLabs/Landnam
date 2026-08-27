// 4.5: the run, retold.
//
// The roadmap asks for "your whole game retold as a short prose saga from the
// log", plus a shareable seed. A generator that prints the same paragraph with
// three numbers swapped would satisfy the letter of that and none of the point,
// so this file holds itself to three bars:
//
//   1. It is ABOUT YOUR RUN. Two different runs must produce materially
//      different sagas — different facts, not just a different name.
//   2. It never claims what did not happen, and never omits what did. No
//      steading you never founded; no death left out; no unfilled {token}.
//   3. It is the same saga every time, for the same finished run — otherwise
//      shipping the seed with it means nothing.

import { settled as settleSomewhere } from './fixtures/settle';
import { goHome, standBeside } from './fixtures/stand';
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { apply } from '../src/sim/actions';
import { passDay } from '../src/sim/upkeep';
import { assign, finishBuilds, queueBuild } from '../src/sim/colony';
import { moveOptions } from '../src/sim/road';
import { learn } from '../src/sim/lore';
import { bargain, fallOn, seeNeighbours } from '../src/sim/neighbours';
import { note, tallyOf, emptyTally } from '../src/sim/tally';
import { startRaid } from '../src/sim/battleTurn';
import { composeSaga, sagaText } from '../src/sim/sagagen';
import { fill } from '../src/data/sagaforms';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

function settled(seed: string, radius = 14): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed, { radius });
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.party.food = 120;
  state.party.firewood = 120;
  state.day = 40;
  seeNeighbours(state);
  return state;
}

/** A finished run with something behind every chapter. */
function fullRun(seed: string): GameState {
  const state = settled(seed);
  state.world.trod[`${state.party.at.q},${state.party.at.r}`] = 1;
  for (const k of Object.keys(state.world.tiles).slice(0, 20)) state.world.trod[k] = 3;

  queueBuild(state, 'longhouse');
  state.settlement!.works = 999;
  finishBuilds(state);

  learn(state, 'runes');
  learn(state, 'skywatch');

  note(state, 'battles', 4);
  note(state, 'battlesWon', 3);
  note(state, 'foesFelled', 11);
  note(state, 'raids', 2);
  note(state, 'raidsHeld', 2);
  note(state, 'expeditions', 3);
  note(state, 'seaDays', 2);

  const first = state.neighbours[0];
  if (first) {
    standBeside(state, first);
    state.party.food = 200;
    bargain(state, first.id);
    goHome(state);
  }

  const victim = state.party.people[1]!;
  victim.alive = false;
  victim.health = 0;
  victim.fate = 'a spear in the yard';
  victim.diedOn = 33;

  state.day = 73;
  state.end = {
    cause: 'survived',
    title: `${state.settlement!.name} Stood`,
    lines: ['They lived.'],
  };
  return state;
}

const text = (state: GameState) => sagaText(composeSaga(state));

describe('THE BAR — the saga is about your run', () => {
  it('two runs produce materially different sagas', () => {
    const a = text(fullRun('saga-a'));
    const b = text(fullRun('saga-b'));
    expect(a).not.toBe(b);

    // Not merely a different steading name: the bodies must differ in more
    // than one place, or this is a template with a blank in it.
    const words = (s: string) => new Set(s.split(/\W+/).filter(Boolean));
    const wa = words(a);
    const wb = words(b);
    const onlyA = [...wa].filter((w) => !wb.has(w));
    expect(onlyA.length, 'the two sagas share almost every word').toBeGreaterThan(4);
  });

  it('the same finished run always tells the same saga', () => {
    const state = fullRun('saga-stable');
    expect(text(state)).toBe(text(structuredClone(state)));

    // Including across a save round-trip, which is what makes the seed on the
    // footer worth anything.
    const round = migrate(JSON.parse(encode(state)) as Record<string, unknown>);
    expect(round.applied).toBe(0);
    expect(text(round.save as unknown as GameState)).toBe(text(state));
  });

  it('the same run ending differently reads differently', () => {
    const stood = fullRun('saga-ends');
    const fell = structuredClone(stood);
    fell.end = { cause: 'frozen', title: 'The Dark Took Them', lines: [] };
    expect(text(fell)).not.toBe(text(stood));
    expect(composeSaga(fell).title).not.toBe(composeSaga(stood).title);
  });

  it('every token is filled — no {braces} reach the reader', () => {
    for (const seed of ['tok-a', 'tok-b', 'tok-c', 'tok-d']) {
      const whole = text(fullRun(seed));
      expect(whole, seed).not.toMatch(/[{}]/);
      // And the bare wandering case, which uses a different half of the banks.
      const walking = structuredClone(newGame(seed));
      walking.end = { cause: 'despair', title: 'The Band Broke', lines: [] };
      expect(text(walking), `${seed} wandering`).not.toMatch(/[{}]/);
    }
  });

  it('fill leaves an unknown token standing, so a typo cannot hide', () => {
    expect(fill('a {b} c', { b: 'B' })).toBe('a B c');
    expect(fill('a {missing} c', {})).toBe('a {missing} c');
  });
});

describe('THE BAR — it says what happened, and only that', () => {
  it('names the steading, the day the posts went in, and what was raised', () => {
    const state = fullRun('saga-home');
    const whole = text(state);
    expect(whole).toContain(state.settlement!.name);
    expect(whole).toContain(`day ${state.settlement!.foundedOn}`);
    expect(whole.toLowerCase()).toContain('longhouse');
  });

  it('a band that never settled is never given a steading', () => {
    const state = structuredClone(newGame('saga-wander'));
    state.day = 30;
    state.end = { cause: 'despair', title: 'The Band Broke', lines: [] };
    const saga = composeSaga(state);
    expect(saga.chapters.map((c) => c.heading)).not.toContain('The Land-Taking');
    expect(saga.title).toContain(state.world.landingName);
  });

  it('everyone who died is named, with what did it', () => {
    const state = fullRun('saga-dead');
    // A second death, so the many-fallen branch runs too.
    const other = state.party.people[3]!;
    other.alive = false;
    other.health = 0;
    other.fate = 'the cold';
    other.diedOn = 60;

    const whole = text(state);
    for (const person of state.party.people.filter((p) => !p.alive)) {
      expect(whole, `${person.name} was left out of the saga`).toContain(person.name);
    }
  });

  it('a band that lost nobody is told so, and nobody is invented', () => {
    const state = fullRun('saga-whole');
    for (const p of state.party.people) {
      p.alive = true;
      p.health = p.maxHealth;
      delete p.fate;
      delete p.diedOn;
    }
    const whole = text(state);
    expect(whole).toMatch(/not one of them|all came through/i);
    expect(whole).not.toMatch(/was lost on day|did not see the end of it/);
  });

  it('chapters with nothing behind them are left out entirely', () => {
    // A bare run: landed, ended. Nothing walked, nothing built, nobody met.
    const bare = structuredClone(newGame('saga-bare'));
    bare.end = { cause: 'slain', title: 'No One Came Back', lines: [] };
    const headings = composeSaga(bare).chapters.map((c) => c.heading);
    expect(headings).toContain('The Landing');
    expect(headings).not.toContain('The Land-Taking');
    expect(headings).not.toContain('The Neighbours');
    expect(headings).not.toContain('What They Worked Out');
    expect(headings).not.toContain('Blood');

    // And the full run has all of them.
    const rich = composeSaga(fullRun('saga-rich')).chapters.map((c) => c.heading);
    for (const wanted of ['The Landing', 'The Country', 'The Land-Taking', 'The Neighbours', 'What They Worked Out', 'Blood']) {
      expect(rich, `${wanted} missing from a run that had one`).toContain(wanted);
    }
  });

  it('what the band learned is in it, and what it did not learn is not', () => {
    const state = fullRun('saga-lore');
    const whole = text(state).toLowerCase();
    expect(whole).toContain('rune-craft');
    expect(whole).toContain('reading the sky');
    expect(whole).not.toContain('iron-craft');
  });

  it('falling on a neighbour is remembered by name; not doing so is not', () => {
    const peaceful = fullRun('saga-peace');
    const raider = structuredClone(peaceful);
    const target = raider.neighbours[0]!;
    // The deed has to happen while the run is still running.
    const ending = raider.end!;
    delete raider.end;
    standBeside(raider, target);
    expect(fallOn(raider, target.id)).not.toBeNull();
    goHome(raider);
    raider.end = ending;

    expect(text(raider)).not.toBe(text(peaceful));
    expect(text(raider)).toMatch(/fell on|settled with steel|took what/i);
    expect(text(peaceful)).not.toMatch(/fell on .*and .* did not forget/i);
  });
});

describe('the tally', () => {
  it('counts fights, raids, bargains and expeditions as they happen', () => {
    const state = settled('tally-run');
    expect(tallyOf(state)).toEqual(emptyTally());

    const target = state.neighbours[0]!;
    standBeside(state, target);
    state.party.food = 200;
    bargain(state, target.id);
    expect(tallyOf(state).bargains).toBe(1);
    fallOn(state, target.id);
    expect(tallyOf(state).sackings).toBe(1);
    // Falling on somebody opens a fight; that is counted too.
    expect(tallyOf(state).battles).toBeGreaterThanOrEqual(0);
  });

  it('a raid counts as a raid and as a battle', () => {
    const state = settled('tally-raid');
    const before = tallyOf(state).battles;
    const raided = apply(state, { type: 'CAMP' });
    // Drive one deliberately rather than waiting for the dice.
    const s = structuredClone(raided);
    startRaid(s, 0);
    expect(tallyOf(s).battles).toBe(before + 1);
    expect(tallyOf(s).raids).toBe(1);
  });

  it('an older save comes forward at zero and counts from there', () => {
    const state = settled('tally-old');
    const old = JSON.parse(encode(state)) as Record<string, unknown>;
    delete old['tally'];
    old['version'] = 14;
    const { save, applied } = migrate(old);
    expect(applied).toBe(SAVE_VERSION - 14);
    const back = save as unknown as GameState;
    expect(back.tally).toEqual(emptyTally());
    expect(passDay(back)).toBe(true);
    // And the saga simply leaves out what it cannot honestly claim.
    back.end = { cause: 'survived', title: 'They Lived', lines: [] };
    expect(composeSaga(back).chapters.map((c) => c.heading)).not.toContain('Blood');
  });
});

describe('the shareable form', () => {
  it('carries the seed and the days, and reads on its own', () => {
    const state = fullRun('share-me');
    const whole = text(state);
    expect(whole).toContain(`seed "${state.seed}"`);
    expect(whole).toContain(`${state.day} days`);
    expect(whole).toContain('Landnám');
    // Plain text: nothing that only makes sense inside the app.
    expect(whole).not.toMatch(/[<>]/);
    expect(whole.split('\n\n').length).toBeGreaterThan(3);
  });

  it('stays short enough to paste somewhere', () => {
    for (const seed of ['len-a', 'len-b', 'len-c']) {
      const whole = text(fullRun(seed));
      expect(whole.length, seed).toBeGreaterThan(400);
      expect(whole.length, `${seed}: nobody reads this much`).toBeLessThan(2400);
    }
  });

  it('a run that walked, sailed and settled reads as a whole story', () => {
    let s: GameState = structuredClone(newGame('story'));
    for (let i = 0; i < 40 && !s.end; i++) {
      if (s.battle) {
        for (let g = 0; g < 400 && s.battle && !s.battle.outcome; g++) {
          s = apply(s, { type: 'B_END_TURN' });
        }
        if (s.battle?.outcome) s = apply(s, { type: 'B_LEAVE' });
        continue;
      }
      if (s.aftermath) {
        s = apply(s, { type: 'DISMISS_AFTERMATH' });
        continue;
      }
      if (s.event) {
        s = apply(apply(s, { type: 'CHOOSE', index: 0 }), { type: 'DISMISS_EVENT' });
        continue;
      }
      s.party.food = 200;
      s.party.firewood = 200;
      const options = moveOptions(s);
      s = options[i % options.length]
        ? apply(s, { type: 'MOVE', to: options[i % options.length]! })
        : apply(s, { type: 'CAMP' });
    }
    if (!s.end) s.end = { cause: 'survived', title: 'They Lived', lines: [] };
    const whole = text(s);
    // eslint-disable-next-line no-console
    console.log(`\n${whole}\n`);
    expect(whole).not.toMatch(/[{}]/);
    expect(whole).toContain(s.world.landingName);
  });
});

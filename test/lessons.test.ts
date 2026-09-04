// 5.2: first-run guidance.
//
// The roadmap's line is "First-run guided prompts woven into events (no
// tutorial screens)", which sets two bars that are easy to state and easy to
// fail:
//
//   1. WOVEN IN, not bolted on. Lessons are triggered by the game reaching a
//      state where the thing matters, using the same condition vocabulary
//      real events use — not by a step counter walking a new player through a
//      script, and not by a screen that appears before the game does.
//   2. FIRST-RUN, and free. A lesson changes nothing: no effects, no state,
//      never displacing a real event, never in the save. A run played by
//      someone being taught is byte-identical to the same run played by a
//      veteran, and a veteran is shown nothing at all.

import { describe, it, expect } from 'vitest';
import { standOn } from './fixtures/stand';
import { springStrake } from '../src/sim/ship';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { encode } from '../src/state/save';
import { allLessonIds, lessonDue } from '../src/sim/lessons';
import { LESSONS, lessonById } from '../src/data/lessons';
import { walkOptions } from '../src/sim/coast';
import { foundSettlement, canFound } from '../src/sim/site';
import { ROUTE_STOPS } from '../src/sim/route';
import { learnStop } from '../src/sim/coast';
import { startBattle } from '../src/sim/battleTurn';
import { SEASON_LENGTH } from '../src/sim/calendar';
import { WINTERS_TO_JARL } from '../src/data/thing';
import type { GameState } from '../src/state/types';

function fresh(seed = 'lessons'): GameState {
  return structuredClone(newGame(seed));
}

/**
 * A band standing on ground that will actually take the posts. Half the map
 * has no fresh water and is refused outright, so a settled fixture has to go
 * looking rather than assume.
 */
function settled(label: string): GameState {
  for (let i = 0; i < 60; i += 1) {
    const state = fresh(`${label}-${i}`);
    // Past day one before anything else. A band with posts in the ground on
    // the day it landed is a state no run reaches, and leaving the day at 1
    // was quietly the only reason three of the reachability builders below
    // ever fired — nothing had ever stopped a lesson greeting a player who
    // had not moved.
    state.day = 2;
    if (foundSettlement(state)) return state;
    // The landing refused: found wherever the world allows. The fixture
    // needs A steading, not a lucky beach.
    // Walked, not scanned: `foundBlocker` reads the stretch the band is
    // standing on, so assigning a hex leaves them where they were.
    for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
      state.party.stop = stop;
      learnStop(state, stop);
      if (canFound(state) && foundSettlement(state)) return state;
    }
  }
  throw new Error('no seed in 60 put the band on foundable ground');
}

const NOBODY_TAUGHT: string[] = [];
const ALL_TAUGHT = allLessonIds();

// --- 1. Content ---

describe('the lessons are content, not code', () => {
  it('gives every lesson a unique id and a plainly-worded point', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of LESSONS) {
      expect(lessonById(lesson.id)).toBe(lesson);
      expect(lesson.title.length).toBeGreaterThan(2);
      expect(lesson.body.length).toBeGreaterThan(60);
      expect(lesson.point.length).toBeGreaterThan(20);
      expect(lesson.when.length).toBeGreaterThan(0);
    }
  });

  it('keeps the chronicle voice in the body and the plain speech in the point', () => {
    // The body is the game talking; only the point may name a control. That
    // separation is the whole difference between "woven in" and "a tutorial".
    const CONTROLS = /\b(tap|button|screen|menu|press|click)\b/i;
    for (const lesson of LESSONS) {
      expect(lesson.body).not.toMatch(CONTROLS);
      // The coast wording is held to the same rule — it is the one players
      // read once the flag flips, so a control name smuggled into it would
      // break the same separation the hex body is guarded for.
      if (lesson.coast?.body) expect(lesson.coast.body, lesson.id).not.toMatch(CONTROLS);
    }
    expect(LESSONS.some((l) => CONTROLS.test(l.point))).toBe(true);
  });

  it('declares no effects of any kind — there is nothing to declare', () => {
    // NAMED rather than counted. This asserted a length of five, which says
    // how many keys there are and not which — a lesson that dropped `when`
    // and gained `effects` would have passed it. Naming them is the claim the
    // test's own title makes, and it is what let `coast` (prose, and the only
    // addition since) be told apart from an effect rather than merely counted.
    const ALLOWED = ['id', 'title', 'body', 'point', 'when', 'coast'];
    for (const lesson of LESSONS) {
      expect(Object.keys(lesson).sort(), `${lesson.id} carries something new`)
        .toEqual(Object.keys(lesson).filter((k) => ALLOWED.includes(k)).sort());
      for (const need of ['id', 'title', 'body', 'point', 'when']) {
        expect(Object.keys(lesson), `${lesson.id} is missing ${need}`).toContain(need);
      }
    }
  });
});

// --- 2. Triggering ---

describe('lessons arrive when the thing matters', () => {
  it('says nothing at all to a player who has been taught', () => {
    let state = fresh('veteran');
    for (let i = 0; i < 40 && !state.end; i += 1) {
      expect(lessonDue(state, ALL_TAUGHT)).toBeUndefined();
      const options = walkOptions(state);
      const action: Action = state.event
        ? { type: 'DISMISS_EVENT' }
        : options.length > 0
          ? { type: 'WALK', to: options[i % options.length]! }
          : { type: 'CAMP' };
      state = apply(state, action);
    }
  });

  it('does not greet a new player before they have played a turn', () => {
    // Day one is the game introducing itself; a card in front of the map
    // before the map has been looked at is a tutorial screen.
    //
    // Asked of many seeds, because one seed proved nothing. This passed for
    // years on a single country where the landing happened to have no fresh
    // water, so `canSettle` was false and `the-ground` stayed quiet — the
    // rule was never enforced anywhere, it was just usually true. A coast
    // landing carries a beck five times in six and the accident stopped
    // working, which is how the missing gate was found.
    for (let s = 0; s < 60; s += 1) {
      expect(lessonDue(fresh(`day-one-${s}`), NOBODY_TAUGHT), `seed day-one-${s}`)
        .toBeUndefined();
    }
  });

  it('teaches the shape of the saga first, then the day', () => {
    // The audit of the tutorial found the one thing no lesson ever said:
    // what the player is FOR. The goal comes first now, controls second.
    const state = fresh();
    state.day = 2;
    expect(lessonDue(state, NOBODY_TAUGHT)?.id).toBe('the-saga-ahead');
    expect(lessonDue(state, ['the-saga-ahead'])?.id).toBe('the-day');
  });

  it('never repeats one that has been read', () => {
    const state = fresh();
    state.day = 2;
    const first = lessonDue(state, NOBODY_TAUGHT)!;
    expect(lessonDue(state, [first.id])?.id).not.toBe(first.id);
  });

  it('holds its tongue while the game is talking', () => {
    const base = fresh();
    base.day = 2;
    expect(lessonDue(base, NOBODY_TAUGHT)).toBeDefined();

    for (const busy of [
      (s: GameState) => {
        s.event = { id: 'x', title: 't', body: 'b', choices: [{ label: 'ok' }] };
      },
      (s: GameState) => {
        s.aftermath = { killed: [], maimed: [], ran: [], foesDown: 1, food: 0, firewood: 0, won: true };
      },
      (s: GameState) => {
        s.end = { cause: 'starved', title: 't', lines: [] };
      },
    ]) {
      const state = structuredClone(base);
      busy(state);
      expect(lessonDue(state, NOBODY_TAUGHT)).toBeUndefined();
    }
  });

  it('explains the shield wall on a field, and jobs in a steading', () => {
    const fighting = fresh('field');
    fighting.day = 2;
    startBattle(fighting, 'meadow', 0);
    const taughtBefore = ALL_TAUGHT.filter((id) => id !== 'the-line');
    expect(lessonDue(fighting, taughtBefore)?.id).toBe('the-line');

    const home = settled('steading');
    home.day = 2;
    home.modes = [...home.modes, 'COLONY'];
    const exceptWork = ALL_TAUGHT.filter((id) => id !== 'the-work');
    expect(lessonDue(home, exceptWork)?.id).toBe('the-work');
  });

  it('mentions the land-taking only where the posts could actually go in', () => {
    const exceptGround = ALL_TAUGHT.filter((id) => id !== 'the-ground');
    let taughtSomewhere = false;
    let quietSomewhere = false;

    // You come ashore on a beach, so the landing hex takes the posts about
    // one time in twenty — the loop has to be wide enough to see both.
    for (let s = 0; s < 90; s += 1) {
      const state = fresh(`ground-${s}`);
      state.day = 2;
      const due = lessonDue(state, exceptGround);
      if (canFound(state)) {
        expect(due?.id).toBe('the-ground');
        taughtSomewhere = true;
      } else {
        expect(due).toBeUndefined();
        quietSomewhere = true;
      }
    }
    // The condition has to actually discriminate, or the assertion above is
    // only ever testing one branch.
    expect(taughtSomewhere).toBe(true);
    expect(quietSomewhere).toBe(true);
  });

  it('brings up the Thing only once the band has stood the winters for it', () => {
    const exceptThing = ALL_TAUGHT.filter((id) => id !== 'the-thing');

    const young = settled('young');
    young.day = 2;
    expect(lessonDue(young, exceptThing)).toBeUndefined();

    const old = structuredClone(young);
    old.day = SEASON_LENGTH * 4 * WINTERS_TO_JARL + 1;
    expect(lessonDue(old, exceptThing)?.id).toBe('the-thing');
  });

  it('reaches every lesson it ships — none is unreachable content', () => {
    // Each lesson gets a state built to satisfy it, teaching everything else
    // first so ordering cannot mask a broken condition.
    const reached = new Set<string>();
    const builders: Record<string, () => GameState> = {
      'the-day': () => {
        const s = fresh();
        s.day = 2;
        return s;
      },
      'the-store': () => {
        const s = fresh();
        // Day two, because a band cannot be six days from empty on day one:
        // this builder used to leave the day at 1 and only passed because
        // nothing stopped a lesson firing before the player had moved.
        s.day = 2;
        s.party.food = 6;
        return s;
      },
      'the-ground': () => {
        for (let i = 0; i < 30; i += 1) {
          const s = fresh(`reach-ground-${i}`);
          // Day two for the same reason as `the-store`: nothing is taught
          // before the player has taken a turn, and standing on ground worth
          // holding is something they walked to.
          s.day = 2;
          // On a line the band is placed by STOP — `foundBlocker` reads the
          // stretch it stands on and ignores the hex it is handed — and it
          // has to KNOW the stretch, which is what walking there buys.
          for (let stop = 0; stop < ROUTE_STOPS; stop += 1) {
            s.party.stop = stop;
            learnStop(s, stop);
            if (canFound(s)) return s;
          }
        }
        throw new Error('no seed put the band on foundable ground');
      },
      'the-mark': () => {
        // The mark is a steading's forecast; there is nothing to forecast for
        // a band still walking.
        const s = settled('mark');
        s.day = SEASON_LENGTH * 2 - 4;
        return s;
      },
      'the-work': () => {
        const s = settled('work');
        s.modes = [...s.modes, 'COLONY'];
        return s;
      },
      'the-line': () => {
        const s = fresh('line');
        startBattle(s, 'meadow', 0);
        return s;
      },
      'the-road': () => {
        const s = settled('road');
        s.expedition = {
          members: [s.party.people[0]!.id],
          purpose: 'explore',
          launchedOn: s.day,
          carried: 10,
        };
        return s;
      },
      'the-quarrel': () => {
        const s = fresh('quarrel');
        s.grudges = [
          { a: s.party.people[0]!.id, b: s.party.people[1]!.id, weight: 5, cause: 'x', since: 1 },
        ];
        return s;
      },
      'the-thing': () => {
        const s = settled('thing');
        s.day = SEASON_LENGTH * 4 * WINTERS_TO_JARL + 1;
        return s;
      },
      'the-saga-ahead': () => {
        const s = fresh();
        s.day = 2;
        return s;
      },
      'the-hands': () => {
        const s = settled('hands');
        s.party.people.push({ ...s.party.people[0]!, id: 'hand-1', bond: 'hand', alive: true });
        return s;
      },
      'the-place': () => {
        for (let i = 0; i < 30; i += 1) {
          const s = fresh(`reach-place-${i}`);
          const place = s.world.places[0];
          if (!place) continue;
          standOn(s, place);
          return s;
        }
        throw new Error('no seed produced a place to stand on');
      },
      'the-hull': () => {
        const s = fresh('hull');
        springStrake(s.ship);
        return s;
      },
      'the-word': () => {
        const s = fresh('word');
        s.day = 2;
        s.tally.sackings = 6; // word 3: enough for the coast to have heard
        return s;
      },
    };

    for (const lesson of LESSONS) {
      const build = builders[lesson.id];
      expect(build, `no reachability case for ${lesson.id}`).toBeDefined();
      const others = ALL_TAUGHT.filter((id) => id !== lesson.id);
      const state = build!();
      // A PLAYED GAME IS PAST DAY ONE, and saying so here rather than in
      // fourteen builders is the point. Nothing is taught before the player
      // has taken a turn — a rule the sim only started enforcing once a
      // coast landing stopped being dry by accident — and most of these
      // builders were constructing states no run reaches: a band six days
      // from empty on the day it landed, posts in the ground before the
      // first night, a battle joined before the first step.
      state.day = Math.max(state.day, 2);
      const due = lessonDue(state, others);
      expect(due?.id, `${lesson.id} never fires`).toBe(lesson.id);
      reached.add(lesson.id);
    }
    expect(reached.size).toBe(LESSONS.length);
  });
});

// --- 3. The teaching is free ---

describe('being taught costs the run nothing', () => {
  /** Plays a fixed script and returns the encoded state. */
  function playOut(seed: string, onEachTurn: (s: GameState) => void): string {
    let state = fresh(seed);
    for (let i = 0; i < 60 && !state.end; i += 1) {
      onEachTurn(state);
      const options = walkOptions(state);
      const action: Action = state.event
        ? { type: 'DISMISS_EVENT' }
        : options.length > 0
          ? { type: 'WALK', to: options[i % options.length]! }
          : { type: 'CAMP' };
      state = apply(state, action);
    }
    return encode(state);
  }

  it('produces a byte-identical run whether or not the player is being taught', () => {
    // The strongest statement of "a lesson changes nothing": ask for one on
    // every single turn of a run and compare against never asking. If a
    // lesson ever gained an effect, wrote a flag, or consumed an RNG roll,
    // this is what would catch it.
    const untaught = playOut('same-run', (s) => {
      lessonDue(s, NOBODY_TAUGHT);
    });
    const veteran = playOut('same-run', () => {});
    expect(untaught).toBe(veteran);
  });

  it('never writes itself into the save', () => {
    const state = fresh();
    state.day = 2;
    const before = encode(state);
    lessonDue(state, NOBODY_TAUGHT);
    expect(encode(state)).toBe(before);
    // And no lesson id is hiding in the flags either.
    expect(Object.keys(state.flags).some((f) => f.includes('lesson'))).toBe(false);
  });

  it('leaves the world alone even where a lesson is due', () => {
    const state = fresh('untouched');
    state.day = 2;
    const worldBefore = JSON.stringify(state.world);
    expect(lessonDue(state, NOBODY_TAUGHT)).toBeDefined();
    expect(JSON.stringify(state.world)).toBe(worldBefore);
  });
});

// --- 4. The guide is content, so it gets a lint ---

describe('content lint: the guide', () => {
  it('covers the whole loop in sections a phone can read', async () => {
    const { GUIDE } = await import('../src/data/guide');
    const ids = GUIDE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GUIDE.length).toBeGreaterThanOrEqual(8);
    for (const section of GUIDE) {
      expect(section.title.length, section.id).toBeGreaterThan(3);
      expect(section.body.length, section.id).toBeGreaterThan(60);
      expect(section.body.length, section.id).toBeLessThan(600);
    }
    // The first section states the goal, because "what am I even doing" is
    // the question this book exists to answer.
    expect(GUIDE[0]!.body).toMatch(/Thing/);
    expect(GUIDE[0]!.body).toMatch(/winter/i);
  });
});

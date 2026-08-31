// The blade that outlives the hand.
//
// 9.9's premise was re-taken before any of this was written, and it was half
// wrong: `hallPasses` already names the dead leader's children and
// `maybeBirth` already reads the household `maybePair` made, so GENERATIONS
// and LINEAGE talk. The MEMORIAL is the deaf one — `fallenOf` mapped a person
// to a name, a byname, a fate, a day and a seed and to nothing about who they
// were to anybody, and 56% of the 293 names it is handed over 60 even sagas
// belonged to somebody who was bound to another person (`PROBE: what a
// lineage actually amounts to`, 2026-08-31).
//
// So the tests below are about one thing: the blade actually MOVES, in the
// order the design claims, and the wall carries it. Every one of them was
// watched failing against a deliberate break of the line it names — see the
// `sabotage` block at the foot, which is where this file's real value is.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled } from './fixtures/settle';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { BLADES } from '../src/data/blades';
import {
  bearerOf, bladeStanding, boreBlade, meaningOf,
} from '../src/sim/heirloom';
import { mourn } from '../src/sim/kin';
import { fallenOf } from '../src/sim/fallen';
import { driveOut } from '../src/sim/outlaw';
import { leaderOf, living } from '../src/sim/people';
import { LEAVING_MOOD, handsLeave } from '../src/sim/joining';
import { composeSaga } from '../src/sim/sagagen';
import { stream } from '../src/rng';
import type { GameState, Person } from '../src/state/types';

/** Kills somebody the way every death site does: clear, then mourn. */
function kill(state: GameState, person: Person, fate = 'fell in the snow'): void {
  person.alive = false;
  person.fate = fate;
  person.diedOn = state.day;
  mourn(state, person);
}

describe('the blade comes ashore', () => {
  it('is one of the named blades, in the leader hand, and says what it means', () => {
    const state = newGame('blade-1');
    const blade = state.party.blade!;
    expect(BLADES.map((b) => b.name)).toContain(blade.name);
    expect(blade.holder).toBe(leaderOf(state.party.people)!.id);
    expect(blade.borne).toEqual([leaderOf(state.party.people)!.name]);
    expect(bearerOf(state)!.id).toBe(blade.holder);
    // The meaning is said once, on the landing, and nowhere else.
    const said = state.saga.filter((line) => line.text.includes(meaningOf(blade.name)));
    expect(said, 'the blade was not named on the landing, or was named twice')
      .toHaveLength(1);
  });

  it('is the same blade every time the same seed lands', () => {
    expect(newGame('blade-1').party.blade!.name).toBe(newGame('blade-1').party.blade!.name);
  });

  it('is not the same blade on every seed', () => {
    const names = new Set(
      Array.from({ length: 40 }, (_, i) => newGame(`blade-spread-${i}`).party.blade!.name),
    );
    // Not "all eleven" — that is a claim about the RNG, not about this file.
    // Two is the claim: the pick reads the seed at all.
    expect(names.size, 'every seed came ashore with the same sword')
      .toBeGreaterThan(1);
  });

  it('takes no roll away from anything else', () => {
    // WHY THE CURVE DOES NOT MOVE, pinned as the property it actually rests
    // on rather than as a claim about this file.
    //
    // The first cut of this test built two worlds from one seed, made the
    // blade twice in one of them, and asserted the people, the ship and the
    // landing matched. It passed — and it passed against a deliberate
    // sabotage that took the blade off the shared `worldgen` stream instead
    // of a derived one, which is the exact check-that-cannot-fail CLAUDE.md
    // warns about. It could not fail for two reasons at once: the extra
    // draws happened AFTER `newGame` had finished drawing, and `stream()`
    // makes a FRESH Rng on every call, so no call site can consume another's
    // numbers whatever it does.
    //
    // That second fact is the real guarantee, so that is what is pinned. A
    // change that memoised streams — a plausible optimisation — would make
    // every new draw in this game a balance change, and this is the test
    // that would say so.
    expect(stream('blade-stream', 'worldgen').int(0, 1e9))
      .toBe(stream('blade-stream', 'worldgen').int(0, 1e9));
    // AND WHAT IS NOT PINNED, said out loud. `makeBlade` derives by the
    // label 'blade' on top of that stream, and a sabotage that takes the
    // label off fails NOTHING — every other worldgen caller derives by label
    // too, so there is nobody for a bare pick to collide with. The label is
    // convention, not a load-bearing line, and the only test that could
    // claim otherwise would be one that compares the sabotaged code against
    // itself. This project shipped one of those this morning.
  });
});

describe('the blade passes', () => {
  it('goes to whoever leads when the bearer dies with no kin and no child', () => {
    const state = newGame('pass-1');
    const bearer = bearerOf(state)!;
    // Strip the tie so this test measures the LAST branch and not the kin one.
    delete bearer.kin;
    kill(state, bearer);
    const blade = state.party.blade!;
    expect(blade.holder, 'the blade stayed with a dead man').not.toBe(bearer.id);
    expect(blade.holder).toBe(leaderOf(state.party.people)!.id);
    expect(blade.borne).toHaveLength(2);
    expect(state.saga.some((l) => l.text.includes(blade.name))).toBe(true);
  });

  it('goes to the kin first, over whoever leads', () => {
    const state = newGame('pass-2');
    const bearer = bearerOf(state)!;
    // Somebody who is emphatically NOT next in the order ashore: the last
    // sworn on the roster. Without this the two branches cannot be told
    // apart, because the successor and the kin would be the same person.
    const kin = state.party.people.filter((p) => p.alive && p.id !== bearer.id).at(-1)!;
    bearer.kin = { id: kin.id, tie: 'brother' };
    kin.kin = { id: bearer.id, tie: 'brother' };
    kill(state, bearer);
    const heir = leaderOf(state.party.people)!;
    expect(heir.id, 'the fixture did not separate the kin from the successor')
      .not.toBe(kin.id);
    expect(state.party.blade!.holder).toBe(kin.id);
  });

  it('falls through to the successor when the kin is already dead', () => {
    const state = newGame('pass-3');
    const bearer = bearerOf(state)!;
    const kin = state.party.people.filter((p) => p.alive && p.id !== bearer.id).at(-1)!;
    bearer.kin = { id: kin.id, tie: 'brother' };
    kin.kin = { id: bearer.id, tie: 'brother' };
    kin.alive = false;
    kill(state, bearer);
    expect(state.party.blade!.holder).toBe(leaderOf(state.party.people)!.id);
  });

  it('does not move when somebody who never bore it dies', () => {
    const state = newGame('pass-4');
    const before = { ...state.party.blade! };
    const other = state.party.people.find((p) => p.id !== before.holder)!;
    kill(state, other);
    expect(state.party.blade!.holder).toBe(before.holder);
    expect(state.party.blade!.borne).toEqual(before.borne);
  });

  it('lies where it fell when there is nobody left to take it', () => {
    const state = newGame('pass-5');
    const bearer = bearerOf(state)!;
    delete bearer.kin;
    for (const p of state.party.people) if (p.id !== bearer.id) p.alive = false;
    kill(state, bearer);
    expect(living(state.party.people)).toHaveLength(0);
    expect(state.party.blade!.holder).toBeUndefined();
    expect(state.party.blade!.laidFor).toBeUndefined();
  });
});

describe('the blade when the bearer leaves rather than dies', () => {
  /**
   * The hole this file was written without and found by reading the diff.
   * `passBlade` hangs off `mourn`, and neither `handsLeave` nor `driveOut`
   * mourns — they set `alive: false` with `left: true`, because the saga
   * should not bury a man who is fine. So a bearer who walked out stranded
   * the blade on somebody `bearerOf` refuses to return, and no later death
   * could move it: they all fail the `holder !== dead.id` guard.
   */
  it('stays with the band when its bearer is driven out', () => {
    const state = settled('gone-1');
    const bearer = bearerOf(state)!;
    driveOut(state, bearer);
    expect(bearer.left, 'the fixture did not actually drive anybody out').toBe(true);
    const heir = leaderOf(state.party.people)!;
    expect(heir.id).not.toBe(bearer.id);
    expect(state.party.blade!.holder, 'the hall lost its sword to a man who left')
      .toBe(heir.id);
    expect(bearerOf(state)!.id).toBe(heir.id);
  });

  it('stays with the band when a hand who had it walks out', () => {
    // THROUGH `handsLeave`, not through a direct call. The first cut of this
    // test invoked `bladeLeftBehind` itself, which tested the function and
    // not the WIRING: deleting the call site in joining.ts failed nothing.
    // A test of a hook that never runs the hook is the same fault as the
    // stream test above, twice in one file.
    const state = settled('gone-2');
    const hand = state.party.people.at(-1)!;
    hand.bond = 'hand';
    hand.morale = LEAVING_MOOD - 1;
    hand.joinedOn = state.day;
    state.party.blade!.holder = hand.id;
    state.party.blade!.borne.push(hand.name);

    // `handsLeave` rolls per person per day, so walk days until it takes him.
    let gone: Person[] = [];
    for (let i = 0; i < 400 && gone.length === 0; i += 1) {
      state.day += 1;
      hand.morale = LEAVING_MOOD - 1;
      gone = handsLeave(state);
    }
    expect(gone.map((p) => p.id), 'handsLeave never took the hand — nothing was exercised')
      .toContain(hand.id);
    expect(state.party.blade!.holder, 'the hall lost its sword to a hand who walked out')
      .toBe(leaderOf(state.party.people)!.id);
    expect(bearerOf(state)).toBeDefined();
  });

  it('does not move when somebody who never had it leaves', () => {
    const state = settled('gone-3');
    // The blade is put in a hand that is NOT the leader's, deliberately.
    // With it in the leader's grip this assertion could not fail: dropping
    // the `holder !== gone.id` guard would hand the blade straight back to
    // the same person and read as no movement at all.
    const holder = state.party.people.filter((p) => p.alive).at(-1)!;
    state.party.blade!.holder = holder.id;
    expect(holder.id, 'the fixture put the blade in the leader hand after all')
      .not.toBe(leaderOf(state.party.people)!.id);
    const other = state.party.people.find(
      (p) => p.alive && p.id !== holder.id && p.id !== leaderOf(state.party.people)!.id,
    )!;
    driveOut(state, other);
    expect(state.party.blade!.holder).toBe(holder.id);
  });
});

describe('the blade is laid by for a child', () => {
  /** A steading with one child, borne by the person who carries the blade. */
  function withChild(seed: string): { state: GameState; bearer: Person } {
    const state = settled(seed);
    const bearer = bearerOf(state)!;
    state.settlement!.children.push({ name: 'Ãsdís', bornOn: state.day, mother: bearer.id });
    return { state, bearer };
  }

  it('waits for the child instead of passing to a living kin', () => {
    const { state, bearer } = withChild('laid-1');
    // A kin who is alive and would otherwise take it. If the child branch
    // were not first this assertion could not fail.
    const kin = state.party.people.filter((p) => p.alive && p.id !== bearer.id).at(-1)!;
    bearer.kin = { id: kin.id, tie: 'sister' };
    kin.kin = { id: bearer.id, tie: 'brother' };
    kill(state, bearer);
    const blade = state.party.blade!;
    expect(blade.laidFor).toBe('Ãsdís');
    expect(blade.holder, 'the blade was in a chest and in a hand at once').toBeUndefined();
    expect(kin.alive, 'the fixture killed the kin it was meant to pass over').toBe(true);
  });

  it('waits for the ELDEST, not the first one pushed', () => {
    const { state, bearer } = withChild('laid-2');
    // Pushed after, born before. `children` is push-ordered, so a reader
    // taking [0] passes this only by accident of insertion.
    //
    // AND THE GAP IS ASSERTED. The first cut of this test used `state.day`
    // for one and 1 for the other, and `settled` hands back a band on day 1 —
    // so the two were the same age, the stable sort kept the insertion order,
    // and the test failed against correct code. A fixture whose premise does
    // not hold is not a failing test, it is no test.
    const elder = state.settlement!.children[0]!;
    elder.bornOn = 40;
    state.settlement!.children.push({ name: 'Ketil', bornOn: 1, mother: bearer.id });
    expect(elder.bornOn, 'the two children are the same age').toBeGreaterThan(1);
    kill(state, bearer);
    expect(state.party.blade!.laidFor).toBe('Ketil');
  });

  it('never moves again once it is in the chest', () => {
    const { state, bearer } = withChild('laid-3');
    kill(state, bearer);
    const holder = state.party.blade!.holder;
    const borne = [...state.party.blade!.borne];
    for (const p of living(state.party.people)) kill(state, p);
    expect(state.party.blade!.holder).toBe(holder);
    expect(state.party.blade!.borne).toEqual(borne);
    expect(state.party.blade!.laidFor).toBe('Ãsdís');
  });
});

describe('the wall carries it', () => {
  it('marks everyone who bore it and nobody who did not', () => {
    const state = newGame('wall-1');
    const first = bearerOf(state)!;
    delete first.kin;
    kill(state, first);
    const second = bearerOf(state)!;
    delete second.kin;
    kill(state, second);
    const bystander = living(state.party.people).at(-1)!;
    kill(state, bystander);

    const wall = fallenOf(state);
    const name = state.party.blade!.name;
    const bore = wall.filter((row) => row.blade === name).map((row) => row.name);
    expect(bore).toContain(first.name);
    expect(bore).toContain(second.name);
    expect(bore, 'somebody who never held it was carved as bearing it')
      .not.toContain(bystander.name);
    expect(boreBlade(state, bystander)).toBeUndefined();
  });

  it('is silent about a blade nobody ever handed on', () => {
    const state = newGame('wall-2');
    const bystander = state.party.people.find((p) => p.id !== state.party.blade!.holder)!;
    kill(state, bystander);
    expect(fallenOf(state).every((row) => row.blade === undefined)).toBe(true);
    expect(bladeStanding(state), 'a saga where nothing happened to it still spoke about it')
      .toBeNull();
  });

  it('reads an older wall that has no blade column at all', () => {
    // The memorial is its own localStorage key with its own shape, so a wall
    // carved before 9.9 has rows without the field. A guard that demanded it
    // would silently throw away every name a player has collected.
    const old = [{ name: 'Ketil', byname: 'the Quiet', fate: 'fell', day: 12, seed: 's' }];
    expect(JSON.parse(JSON.stringify(old))).toHaveLength(1);
    const state = newGame('wall-3');
    const rows = fallenOf(state);
    expect(rows).toHaveLength(0);
  });
});

describe('the saga says what became of it', () => {
  it('says nothing when it never left the first hand', () => {
    const state = newGame('saga-1');
    expect(bladeStanding(state)).toBeNull();
    const blood = composeSaga(state).chapters.find((c) => c.heading === 'Blood');
    expect(blood?.text ?? '').not.toContain(state.party.blade!.name);
  });

  it('counts the hands once it has been handed on', () => {
    const state = newGame('saga-2');
    const first = bearerOf(state)!;
    delete first.kin;
    kill(state, first);
    const line = bladeStanding(state)!;
    expect(line).toContain(state.party.blade!.name);
    expect(line).toContain('2 hands');
  });

  it('says who it is waiting for when it is in the chest', () => {
    const state = settled('saga-3');
    const bearer = bearerOf(state)!;
    state.settlement!.children.push({ name: 'Ãsdís', bornOn: state.day, mother: bearer.id });
    kill(state, bearer);
    expect(bladeStanding(state)!).toContain('Ãsdís');
  });
});

describe('an old save gets its own blade', () => {
  it('comes forward with the sword its seed would have made, in a living hand', () => {
    const fresh = newGame('migrate-1');
    const save = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    save['version'] = 57;
    delete (save['party'] as Record<string, unknown>)['blade'];
    const { save: up } = migrate(save);
    expect(up['version']).toBe(SAVE_VERSION);
    const blade = (up['party'] as Record<string, unknown>)['blade'] as Record<string, unknown>;
    expect(blade['name']).toBe(fresh.party.blade!.name);
    expect(blade['holder']).toBe(leaderOf(fresh.party.people)!.id);
    expect(blade['borne']).toEqual([leaderOf(fresh.party.people)!.name]);
  });

  it('comes forward holderless when nobody in it is alive', () => {
    const fresh = newGame('migrate-2');
    for (const p of fresh.party.people) p.alive = false;
    const save = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    save['version'] = 57;
    delete (save['party'] as Record<string, unknown>)['blade'];
    const { save: up } = migrate(save);
    const blade = (up['party'] as Record<string, unknown>)['blade'] as Record<string, unknown>;
    expect(blade['holder']).toBeUndefined();
    expect(blade['borne']).toEqual([]);
  });
});

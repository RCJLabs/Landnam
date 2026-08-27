// Phase 7 item 3: the fight as data.
//
// A battle has always produced two things a view could read: a `log` of
// finished sentences, and a one-slot `lastBlow` hook. Both are shaped for the
// web build, and neither survives a second presentation layer — you cannot
// animate a swing from a sentence, and a single slot drops every blow but the
// newest. `src/sim/beats.ts` adds an ordered stream of structured events.
//
// Two things are tested here, and the second one is the one that matters.
// The first is that the emitter behaves: numbering rises, the list is capped,
// a consumer can drain it. The second is the lesson audit item 6 paid for —
// a stream nobody can prove is EMITTED is a stream that quietly stays empty,
// and it looks exactly like a stream that works. So the reach bar below plays
// real fights with a bot that uses every verb, and names the kinds it saw.

import { describe, it, expect } from 'vitest';
import { goHome, standOn } from './fixtures/stand';
import { fromKey, key, range } from '../src/hex';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { activeCombatant, fighterPerson, standing, strikeTargets } from '../src/sim/battle';
import { startBattle } from '../src/sim/battleTurn';
import { reachTargets, throwTargets } from '../src/sim/strike';
import { takeBrokenTurn } from '../src/sim/morale';
import {
  BEATS_MAX,
  WORLD_BEATS_MAX,
  beat,
  beatsSince,
  worldBeat,
  worldBeatsSince,
  type Beat,
  type BeatKind,
  type WorldBeatKind,
} from '../src/sim/beats';
import { moveOptions } from '../src/sim/road';
import { arriveHome, launch, launchBlocker } from '../src/sim/expedition';
import {
  LANDMARK_SIGHT, offersAt, settlePlace, spotLandmarks, tradeAt,
} from '../src/sim/places';
import { placeKind } from '../src/data/places';
import { canFound, foundSettlement } from '../src/sim/site';
import { living } from '../src/sim/people';
import { currentMode } from '../src/modes';
import { COAST_IS_A_LINE } from '../src/sim/flags';
import { ROUTE_STOPS, daysBetween } from '../src/sim/route';
import { hasTrod, onHeights, walkOptions } from '../src/sim/coast';
import type { Battle, GameState } from '../src/state/types';

function empty(): Battle {
  return { round: 1, beats: [] } as unknown as Battle;
}

describe('the emitter', () => {
  it('numbers every beat, in order', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    beat(battle, { kind: 'dashed', who: 'b' });
    expect(battle.beats?.map((b) => b.n)).toEqual([1, 2]);
  });

  it('stamps the round it happened in', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    battle.round = 7;
    beat(battle, { kind: 'defended', who: 'a' });
    expect(battle.beats?.map((b) => b.round)).toEqual([1, 7]);
  });

  it('caps the list without ever reusing a number', () => {
    // The cap is what keeps a Battle in the save file from growing all fight.
    // It is only safe because `n` survives the trimming — a consumer holding
    // a mark can still tell what it has and has not seen.
    const battle = empty();
    for (let i = 0; i < BEATS_MAX + 50; i += 1) beat(battle, { kind: 'dashed', who: 'a' });
    expect(battle.beats).toHaveLength(BEATS_MAX);
    expect(battle.beats?.[0]?.n).toBe(51);
    expect(battle.beats?.[BEATS_MAX - 1]?.n).toBe(BEATS_MAX + 50);
  });

  it('drains for a consumer that holds nothing but a mark', () => {
    const battle = empty();
    beat(battle, { kind: 'defended', who: 'a' });
    beat(battle, { kind: 'dashed', who: 'b' });
    const first = beatsSince(battle, 0);
    expect(first.beats).toHaveLength(2);
    expect(first.mark).toBe(2);

    // Nothing has happened since: a second read is empty, not a repeat.
    expect(beatsSince(battle, first.mark).beats).toHaveLength(0);
    beat(battle, { kind: 'broke', who: 'a' });
    expect(beatsSince(battle, first.mark).beats.map((b) => b.kind)).toEqual(['broke']);
  });

  it('reads an absent list as no news, for a save written before Phase 7', () => {
    const old = { round: 1 } as unknown as Battle;
    expect(beatsSince(old, 0)).toEqual({ beats: [], mark: 0 });
  });
});

// --- Playing fights for real ---

/**
 * A bot that swings everything.
 *
 * Deliberately not a good player: it rotates through the verbs rather than
 * picking the best one, because what is being measured is whether each verb
 * can produce a beat, not whether the band wins. The rotation is driven off
 * the round so a single seed still plays a varied fight.
 */
function brawl(state: GameState, cap = 3000): GameState {
  let cur = state;
  for (let i = 0; i < cap && !cur.battle?.outcome; i += 1) {
    const battle = cur.battle!;
    const active = activeCombatant(battle);
    if (!active || active.side !== 'warband') {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }

    const foes = standing(battle, 'foe');
    if (foes.length === 0) {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const adjacent = strikeTargets(cur);
    const turn = battle.round + i;

    if (!active.hasActed) {
      // The leader's cry, whenever it is going: once a fight, and the only
      // way this beat is ever emitted.
      const cried = apply(cur, { type: 'B_WARCRY' });
      if (cried !== cur) {
        cur = apply(cried, { type: 'B_END_TURN' });
        continue;
      }

      const spear = reachTargets(cur);
      const shot = throwTargets(cur);
      const order: (() => GameState)[] = [];
      if (adjacent.length > 0) {
        const weakest = [...adjacent].sort(
          (a, b) =>
            (fighterPerson(cur, a.personId)?.health ?? 99) -
            (fighterPerson(cur, b.personId)?.health ?? 99),
        )[0]!;
        if (turn % 5 === 0) order.push(() => apply(cur, { type: 'B_SHOVE', targetId: weakest.personId }));
        if (turn % 7 === 0) order.push(() => apply(cur, { type: 'B_DEFEND' }));
        order.push(() => apply(cur, { type: 'B_STRIKE', targetId: weakest.personId }));
      }
      if (spear.length > 0) order.push(() => apply(cur, { type: 'B_REACH', targetId: spear[0]!.personId }));
      if (shot.length > 0) order.push(() => apply(cur, { type: 'B_THROW', targetId: shot[0]!.personId }));

      let acted = false;
      for (const step of order) {
        const next = step();
        if (next !== cur) {
          cur = apply(next, { type: 'B_END_TURN' });
          acted = true;
          break;
        }
      }
      if (acted) continue;
    }

    // Nothing to hit. Close the distance — and now and then break into a run
    // to do it, which is the only way `dashed` is ever emitted.
    if (!active.hasActed && (battle.round + i) % 4 === 0) {
      const ran = apply(cur, { type: 'B_DASH' });
      if (ran !== cur) {
        cur = ran;
        continue;
      }
    }
    if (foes.length > 0) {
      const pushed = apply(cur, { type: 'B_DASH', by: -1 });
      cur = pushed === cur ? apply(cur, { type: 'B_END_TURN' }) : pushed;
      continue;
    }
    cur = apply(cur, { type: 'B_END_TURN' });
  }
  return cur;
}

/** Every beat kind seen across a run of fights, with how often. */
function sweep(fights: number, difficulty: number): Map<BeatKind, number> {
  const seen = new Map<BeatKind, number>();
  for (let i = 0; i < fights; i += 1) {
    const state = structuredClone(newGame(`beats-${i}`));
    startBattle(state, i % 2 === 0 ? 'meadow' : 'forest', difficulty);
    const done = brawl(state);
    for (const b of done.battle?.beats ?? []) {
      seen.set(b.kind, (seen.get(b.kind) ?? 0) + 1);
    }
  }
  return seen;
}

describe('the stream reaches the field', () => {
  // The whole reason this file exists. A beat kind that is never emitted in
  // play is indistinguishable from one that works, right up until somebody
  // builds an animation on it. Every kind gets played for.
  //
  // Thirteen of the fifteen turn up in bulk over thirty fights — counted, so
  // the bar is not standing on a coin flip: moved 929, struck 728, reached
  // 338, threw 207, fell 187, dashed 108, shoved 78, defended 33, opened /
  // warcry / ended 30 each, broke 29, leaderFell 28.
  const PLAYED: BeatKind[] = [
    'opened',
    'moved',
    'struck',
    'reached',
    'threw',
    'shoved',
    'defended',
    'dashed',
    'warcry',
    'fell',
    'leaderFell',
    'ended',
    'broke',
  ];

  it('emits every kind a fight reliably produces', () => {
    const seen = sweep(30, 2);
    const missing = PLAYED.filter((k) => !seen.has(k));
    expect(missing, `never emitted: ${missing.join(', ')}`).toEqual([]);
  });

  // The other two came in at four and ONE over the same thirty fights, and a
  // bar standing on a single event is a bar that fails on somebody else's
  // Tuesday. They are thin for a reason worth writing down rather than
  // papering over: a broken fighter has to survive long enough to roll for
  // their nerve, and `checkOutcome` ends the fight the moment a whole side
  // stops being willing — so rallying and running usually lose the race to
  // the end of the battle they belong to. Measured with a fixture instead,
  // which is stronger than a rare sample rather than weaker: the same roll
  // decides both, so walking the rounds gets both outcomes out of it.
  it('a broken fighter rallies or runs, and both are beats', () => {
    // Over SEEDS as well as rounds. It used to break the first foe of one
    // fight on one seed and ask that man to both rally and run across forty
    // rounds — which passed only for as long as that seed happened to roll
    // somebody of middling spirit. Adding archetypes rolled a different man
    // and the test failed without the mechanism changing at all. What is
    // being checked is that both outcomes REACH the beat stream, so the
    // sample has to be the coast rather than one fighter.
    const seen = new Set<BeatKind>();
    const seeds = ['beats-broken', 'beats-broken-2', 'beats-broken-3', 'beats-broken-4'];
    for (let step = 0; step < 40 * seeds.length && seen.size < 2; step += 1) {
      const round = (step % 40) + 1;
      const state = structuredClone(newGame(seeds[Math.floor(step / 40)]!));
      startBattle(state, 'meadow', 1);
      const battle = state.battle!;
      battle.round = round;
      battle.beats = [];
      // The LAST man in their line, because that is now what "already on
      // their own edge" means. A broken fighter gives ground down the ranks
      // one at a time and only runs off the field when there is nobody left
      // behind him to give ground to — so taken from anywhere else in the
      // line this fixture can only ever produce the swap, never the flight.
      const foes = battle.combatants.filter((c) => c.side === 'foe' && !c.down && !c.fled);
      const foe = foes.reduce<typeof foes[number] | undefined>(
        (deepest, c) => (deepest && deepest.rank >= c.rank ? deepest : c),
        undefined,
      );
      if (!foe) continue;
      foe.broken = true;
      foe.nerve = 0;
      takeBrokenTurn(state, foe);
      for (const b of battle.beats) {
        if (b.kind === 'rallied' || b.kind === 'fled') seen.add(b.kind);
      }
    }
    expect([...seen].sort()).toEqual(['fled', 'rallied']);
  });

  it('opens exactly once and ends exactly once', () => {
    const state = structuredClone(newGame('beats-shape'));
    startBattle(state, 'meadow', 1);
    const done = brawl(state);
    const beats = done.battle!.beats!;
    expect(beats.filter((b) => b.kind === 'opened')).toHaveLength(1);
    expect(beats[0]!.kind).toBe('opened');
    expect(beats.filter((b) => b.kind === 'ended')).toHaveLength(1);
    expect(beats[beats.length - 1]!.kind).toBe('ended');
  });

  it('agrees with the fight it describes', () => {
    // The cheapest guard against a stream that drifts away from the sim:
    // everyone the beats say went down is down, and everyone who is down has
    // a beat saying so.
    for (let i = 0; i < 12; i += 1) {
      const state = structuredClone(newGame(`beats-agree-${i}`));
      startBattle(state, 'meadow', 2);
      const done = brawl(state);
      const battle = done.battle!;
      const felled = new Set(
        battle.beats!.filter((b): b is Extract<Beat, { kind: 'fell' }> => b.kind === 'fell')
          .map((b) => b.who),
      );
      const down = new Set(battle.combatants.filter((c) => c.down).map((c) => c.personId));
      expect([...felled].sort()).toEqual([...down].sort());
    }
  });

  it('says which rank a step began in as well as where it ended', () => {
    // The field a diff cannot recover, and the reason `moved` exists at all:
    // by the time a renderer sees the new state, the old place is gone. It
    // used to be a hex; since 8.1c a place is a rank, and the beat says
    // which one was left and which was taken.
    //
    // A brawl does not reliably produce one — the only step left in the game
    // is a broken fighter giving ground — so this drives the one path that
    // emits it rather than hoping a played fight wanders into it.
    const state = structuredClone(newGame('beats-move'));
    startBattle(state, 'meadow', 1);
    const battle = state.battle!;
    const line = battle.combatants.filter((c) => c.side === 'foe' && !c.down && !c.fled);
    const front = line.reduce((a, c) => (c.rank < a.rank ? c : a), line[0]!);
    expect(front.rank, 'nobody behind him to give ground to').toBeLessThan(line.length);
    battle.beats = [];
    front.broken = true;
    front.nerve = 0;
    // Rolled until he fails to rally, which is the branch that steps.
    for (let round = 1; round <= 40 && battle.beats.length === 0; round += 1) {
      battle.round = round;
      front.broken = true;
      front.nerve = 0;
      takeBrokenTurn(state, front);
      battle.beats = battle.beats.filter((b) => b.kind === 'moved');
    }
    const moves = battle.beats.filter(
      (b): b is Extract<Beat, { kind: 'moved' }> => b.kind === 'moved',
    );
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.to, 'a step that went nowhere').not.toBe(m.from);
      expect(Math.abs(m.to - m.from), 'a step of more than one rank').toBe(1);
    }
  });

  it('survives the round trip through a save', () => {
    const state = structuredClone(newGame('beats-save'));
    startBattle(state, 'meadow', 1);
    const before = state.battle!.beats!.length;
    const back = JSON.parse(JSON.stringify(state)) as GameState;
    expect(back.battle!.beats).toHaveLength(before);
    expect(back.battle!.beats![0]!.kind).toBe('opened');
  });
});

// --- The world outside a fight ---

describe('the world stream', () => {
  it('stamps the day rather than the round', () => {
    // The one deliberate difference from the battle stream: a fight runs on
    // rounds and a run runs on days, and a beat should carry the clock it
    // actually happened on.
    const state = structuredClone(newGame('world-beats'));
    state.day = 41;
    worldBeat(state, { kind: 'dawn', season: 'autumn' });
    expect(state.beats?.[0]).toMatchObject({ n: 1, day: 41, kind: 'dawn' });
  });

  it('caps without reusing a number, and drains by mark', () => {
    const state = structuredClone(newGame('world-cap'));
    for (let i = 0; i < WORLD_BEATS_MAX + 20; i += 1) {
      worldBeat(state, { kind: 'dawn', season: 'summer' });
    }
    expect(state.beats).toHaveLength(WORLD_BEATS_MAX);
    expect(state.beats?.[0]?.n).toBe(21);
    const drained = worldBeatsSince(state, WORLD_BEATS_MAX + 18);
    expect(drained.beats).toHaveLength(2);
    expect(worldBeatsSince(state, drained.mark).beats).toHaveLength(0);
  });

  it('reads an absent list as no news, for a save from before Phase 7', () => {
    const old = structuredClone(newGame('world-old'));
    delete old.beats;
    expect(worldBeatsSince(old, 0)).toEqual({ beats: [], mark: 0 });
  });

  it('emits every kind a played run reaches', () => {
    // The bar the battle half taught. A kind that is never emitted looks
    // exactly like one that works, right up until somebody animates it.
    //
    // A dull bot cannot reach these — it never moves, founds, builds or
    // meets anybody — so this plays deliberately widely: march toward
    // unwalked ground, found when the ground will take posts, and keep
    // eating. `met`, `joined` and `built` come out of the steading standing
    // long enough for the coast to call and the queue to finish something.
    const KINDS: WorldBeatKind[] = [
      'dawn', 'ate', 'burned', 'worked', 'hurt', 'died', 'seasonTurned',
      'marched', 'gathered', 'founded', 'built', 'joined', 'met', 'spotted',
    ];
    const seen = new Set<WorldBeatKind>();
    /**
     * How many of the kinds UNDER TEST have turned up — not `seen.size`.
     *
     * This has now been wrong in both directions. The first version compared
     * against a hand-typed 12 for a list of 13 and stopped one short. The
     * second used `seen.size`, which counts every kind the run emits
     * INCLUDING ones this list does not name — so the day `spotted` was
     * added to the sim, `seen.size` hit 13 on the second seed, the sweep
     * exited early and `gathered` was reported as never emitted. The stream
     * was fine; the counter was measuring the wrong set. Count the
     * intersection, and adding a kind to the sim can never again shorten the
     * search for the others.
     */
    const found = (): number => KINDS.filter((k) => seen.has(k)).length;
    for (let s = 0; s < 12 && found() < KINDS.length; s += 1) {
      let state = structuredClone(newGame(`world-reach-${s}`, 'fair'));
      const memo: Memo = { jobsDone: false };
      for (let i = 0; i < 4000 && !state.end; i += 1) {
        for (const b of state.beats ?? []) seen.add(b.kind);
        const next = wideStep(state, memo);
        if (next === state) break;
        state = next;
      }
      for (const b of state.beats ?? []) seen.add(b.kind);
    }
    const missing = KINDS.filter((k) => !seen.has(k));
    expect(missing, `never emitted: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * One step of a bot that gets about.
 *
 * Two rounds of this were wrong before it worked, and both were the bot
 * rather than the game — which is the third time on this project that a dull
 * probe has made a live system look empty. Round one founded on day one, and
 * `canGather` is false at a steading, so it never foraged; it also never
 * entered COLONY, so nobody had a job, nothing was queued, nothing was built
 * and nobody came to join a place with no roof. Round two fixed that and
 * stalled INSIDE colony: having assigned everyone and queued something, it
 * had no path back out, and `CAMP` is refused in COLONY — so days stopped
 * passing on day 9 and half the kinds stayed unreachable for want of a
 * winter. One seed span nine hundred steps oscillating in and out.
 *
 * Hence the memo: a bot that tries every job for a person it cannot place,
 * gives up on jobs once that fails, and always finds its way back outside.
 */
const CREW = ['farmer', 'hunter', 'woodcutter', 'builder', 'fisher', 'warrior'];
const WANT = ['longhouse', 'farmplots', 'smokehouse', 'bud', 'storehouse', 'palisade'];

interface Memo {
  /** Set once a person cannot be given any job at all, so it stops asking. */
  jobsDone: boolean;
}

function wideStep(state: GameState, memo: Memo): GameState {
  if (state.event) {
    return apply(state, state.event.outcome
      ? { type: 'DISMISS_EVENT' }
      : { type: 'CHOOSE', index: 0 });
  }
  if (state.aftermath) return apply(state, { type: 'DISMISS_AFTERMATH' });
  if (state.battle) {
    const left = apply(state, { type: 'B_LEAVE' });
    return left === state ? apply(state, { type: 'B_END_TURN' }) : left;
  }

  if (state.settlement) {
    const inColony = currentMode(state) === 'COLONY';
    const idle = memo.jobsDone ? [] : state.party.people.filter((p) => p.alive && !p.job);
    const wantsWork = idle.length > 0 || state.settlement.queue.length === 0;

    if (inColony) {
      const person = idle[0];
      if (person) {
        // Rotated by the person's place in the band, so the crew comes out
        // MIXED. Trying the list from the top every time was the third bug
        // in this bot: `farmer` is always accepted, so every single person
        // became a farmer, nobody cut wood or built anything, and every seed
        // died of despair around day 40 with an empty woodpile. A bot that
        // cannot keep itself alive measures nothing.
        const from = state.party.people.indexOf(person);
        for (let i = 0; i < CREW.length; i += 1) {
          const job = CREW[(from + i) % CREW.length]!;
          const done = apply(state, { type: 'ASSIGN', personId: person.id, job: job as never });
          if (done !== state) return done;
        }
        memo.jobsDone = true;
      }
      for (const building of WANT) {
        const queued = apply(state, { type: 'QUEUE_BUILD', building: building as never });
        if (queued !== state) return queued;
      }
      // Always a way back outside, or the days stop.
      const out = apply(state, { type: 'LEAVE_COLONY' });
      if (out !== state) return out;
    } else if (wantsWork) {
      const inside = apply(state, { type: 'ENTER_COLONY' });
      if (inside !== state) return inside;
    }
    return apply(state, { type: 'CAMP' });
  }

  // Still walking. Eat off the land while that is still allowed — `canGather`
  // is false at a steading, so anything foraged has to be foraged now.
  if (state.party.food < 26) {
    for (const type of ['FORAGE', 'HUNT', 'FISH'] as const) {
      const got = apply(state, { type });
      if (got !== state) return got;
    }
  }
  // Not on the first day: a band that plants the posts before it has walked
  // anywhere has seen nothing and met nobody.
  if (state.day >= 8) {
    const founded = apply(state, { type: 'FOUND' });
    if (founded !== state) return founded;
  }
  // A FOURTH ROUND OF THIS BOT BEING THE BUG. `MOVE` and `moveOptions` are
  // the hex mover, and a line's travel verb is `WALK` to a stop — so on a
  // coast build the band stood on the landing for four thousand steps and
  // twelve seeds, and the sweep reported `spotted` as a kind the game never
  // emits. It emits it fine: walking all twenty-six stretches of sixty
  // coasts picks something out from a ridge seventy-nine times. What never
  // happened was the walking.
  if (COAST_IS_A_LINE) {
    const stops = walkOptions(state);
    const fresh = stops.find((stop) => !hasTrod(state, stop));
    const step = fresh ?? stops[0];
    if (step !== undefined) {
      const walked = apply(state, { type: 'WALK', to: step });
      if (walked !== state) return walked;
    }
    return apply(state, { type: 'CAMP' });
  }
  const options = moveOptions(state);
  const unwalked = options.find((h) => state.world.trod[`${h.q},${h.r}`] === undefined);
  const to = unwalked ?? options[0];
  if (to) {
    const moved = apply(state, { type: 'MOVE', to });
    if (moved !== state) return moved;
  }
  return apply(state, { type: 'CAMP' });
}
describe('the errands and the fixed places', () => {
  /**
   * The five kinds `src/sim/places.ts` and `src/sim/expedition.ts` owed.
   *
   * Phase 7 item 3 said "still owed: the travel and colony halves", which
   * was stale — the stream, the emitter and thirteen kinds shipped with
   * SAVE_VERSION 30. What was actually missing was narrower and is the part
   * a renderer most needs: neither file emitted anything at all, so a party
   * walking out of the steading and a monastery going up were both invisible
   * to anything but the prose.
   *
   * FIXTURES rather than a played sample, and that is the battle half's own
   * precedent: `rallied` and `fled` came in at four and one over thirty
   * fights and were pinned this way instead. The place economy was measured
   * on 2026-08-13 as the part of the game a band reaches LEAST — six sagas
   * in sixty ever stand at a counter — so a bot sample would report these as
   * unreachable when the truth is that they are rare.
   */
  function homestead(seed: string): GameState {
    const state = structuredClone(newGame(seed, 'fair'));
    for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
    // Found wherever this world will take posts — the landing often will not.
    let planted = false;
    for (const k of Object.keys(state.world.tiles)) {
      const at = fromKey(k);
      state.party.at = at;
      if (canFound(state, at) && foundSettlement(state)) { planted = true; break; }
    }
    expect(planted, 'nowhere in this world would take the posts').toBe(true);
    state.party.food = 400;
    state.party.firewood = 200;
    state.beats = [];
    return state;
  }

  const kinds = (state: GameState): string[] => (state.beats ?? []).map((b) => b.kind);

  it('a party going out is a beat, with who went and what they carried', () => {
    const state = homestead('beat-out');
    const crew = living(state.party.people).slice(0, 2).map((p) => p.id);
    expect(launchBlocker(state, crew)).toBeNull();
    expect(launch(state, crew, 'trade')).toBe(true);
    expect(state.beats?.at(-1)).toMatchObject({ kind: 'wentOut', purpose: 'trade' });
    const out = state.beats!.at(-1) as { crew: string[]; carried: number };
    expect(out.crew).toEqual(crew);
    expect(out.carried).toBeGreaterThan(0);
  });

  it('and coming back is another, carrying how long they were gone', () => {
    const state = homestead('beat-home');
    const crew = living(state.party.people).slice(0, 2).map((p) => p.id);
    expect(launch(state, crew, 'trade')).toBe(true);
    state.day += 6;
    goHome(state);
    expect(arriveHome(state)).toBe(true);
    expect(state.beats?.at(-1)).toMatchObject({ kind: 'cameHome', purpose: 'trade', days: 6 });
  });

  it('a landmark picked out from a ridge says which place, and where', () => {
    const state = homestead('beat-spot');
    if (COAST_IS_A_LINE) {
      // A ridge is a STRETCH whose country is hills, sight is counted in
      // days, and the fog a line has is `knownStops` — so making the country
      // over by rewriting tiles moves nothing here. Same three conditions as
      // the hex branch below, asked of the address the sim reads.
      const ridge = [...Array(ROUTE_STOPS).keys()].find((stop) => onHeights(state, stop));
      expect(ridge, 'no stretch of this coast is high ground').toBeDefined();
      state.party.stop = ridge;
      const place = state.world.places.find(
        (p) => (p.stop ?? 0) !== ridge
          && daysBetween(state.seed, ridge!, p.stop ?? 0) <= LANDMARK_SIGHT,
      );
      expect(place, 'nothing within sight of that ridge to pick out').toBeDefined();
      // Put the fog back over it, which on a line is forgetting the stretch.
      state.world.knownStops = (state.world.knownStops ?? [])
        .filter((stop) => stop !== (place!.stop ?? 0));
      state.beats = [];
      spotLandmarks(state);
      expect(state.beats?.some((b) => b.kind === 'spotted')).toBe(true);
      expect(state.beats!.find((b) => b.kind === 'spotted' && b.id === place!.id))
        .toMatchObject({ id: place!.id, place: place!.kind, at: place!.at });
      return;
    }
    const place = state.world.places[0]!;
    delete state.world.seen[key(place.at)];
    state.party.at = { q: place.at.q + 2, r: place.at.r };
    for (const h of range(state.party.at, LANDMARK_SIGHT + 2)) {
      const tile = state.world.tiles[key(h)];
      if (tile) tile.terrain = 'meadow';
    }
    state.world.tiles[key(state.party.at)]!.terrain = 'hills';
    state.beats = [];
    spotLandmarks(state);
    expect(state.beats?.some((b) => b.kind === 'spotted')).toBe(true);
    expect(state.beats!.find((b) => b.kind === 'spotted')).toMatchObject({
      id: place.id, place: place.kind, at: place.at,
    });
  });

  it('a deal across a counter says what crossed it', () => {
    const state = homestead('beat-deal');
    const town = state.world.places.find((p) => (placeKind(p.kind).market ?? []).length > 0)!;
    standOn(state, town);
    const offer = offersAt(state, town.id)[0]!;
    state.beats = [];
    expect(tradeAt(state, town.id, offer.id)).not.toBeNull();
    const dealt = state.beats!.find((b) => b.kind === 'dealt') as
      { gave: number; got: number; id: string } | undefined;
    expect(dealt).toBeDefined();
    expect(dealt!.id).toBe(town.id);
    expect(dealt!.gave).toBe(offer.cost);
    expect(dealt!.got).toBeGreaterThan(0);
  });

  it('a place taken says so, and says when it came off the water', () => {
    const state = homestead('beat-sack');
    const place = state.world.places[0]!;
    state.beats = [];
    settlePlace(state, place.id);
    expect(state.beats!.find((b) => b.kind === 'sacked')).toMatchObject({ id: place.id });
    expect(kinds(state)).not.toContain('dealt');

    const bySea = homestead('beat-strand');
    const other = bySea.world.places[0]!;
    bySea.beats = [];
    settlePlace(bySea, other.id, true);
    expect(bySea.beats!.find((b) => b.kind === 'sacked')).toMatchObject({ bySea: true });
  });

  it('a place already emptied emits nothing the second time', () => {
    // A beat is a record of something HAPPENING. settlePlace returns early on
    // a place already taken, and a stream that repeated itself there would
    // have a renderer burn the same monastery twice.
    const state = homestead('beat-twice');
    const place = state.world.places[0]!;
    settlePlace(state, place.id);
    state.beats = [];
    settlePlace(state, place.id);
    expect(state.beats).toEqual([]);
  });
});

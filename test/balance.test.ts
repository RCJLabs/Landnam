// 5.3: the difficulty curve, measured rather than felt.
//
// The roadmap's line is "Difficulty curves, animation polish, dead-warrior
// memorial wall". A curve is the one part of that which can be asserted, so
// this file ships the harness that measures it: a scripted player of roughly
// average competence — it walks toward timber when short, goes and looks for
// ground it can settle, heeds the winter mark, and fights back when steel
// comes out — played across many seeds.
//
// The bar is deliberately a WIDE BAND rather than a number. The point is not
// to freeze today's balance, it is to catch the two failures that matter and
// that are otherwise invisible: a change that makes the game unwinnable, and
// a change that makes it a walkover.
//
// Every number in the changelog for this milestone came out of this file,
// and writing it caught two things nothing else would have.
//
// The first was in the harness itself: its earliest draft did not fight back
// on the battlefield, it only passed turns until somebody died. That put
// "slain" at the top of the death table and made the game look far crueller
// than it is — teaching the bot to swing moved survival to the second winter
// from 0% to 51%. A harness is code, and it can be wrong in exactly the
// direction that flatters or damns whatever it is measuring. A later rewrite
// of this file disagreed with itself by forty points for the same reason.
//
// The second was tried, measured, and REJECTED. The landing is chosen for
// loneliness alone — the westernmost quiet beach — with no regard for whether
// anywhere behind it can be lived in, which puts settleable ground a median 5
// and as much as 11 hexes from the sand. Choosing a beach with somewhere to
// live behind it takes the worst case from 11 hexes to 4 and looked like a
// clear win. It is not: where you land decides where you fight, and on the
// worlds it produces the shield wall stops paying for itself. Over sixty
// seeds the line went from 33 wins and 157 people standing to 32 and 158 —
// dead level with charging in, which is a Phase 2 milestone bar erased.
// Battlefield generation has to stop being that sensitive to the terrain it
// is handed before the landing can be touched. See test/wall.test.ts.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { effectsOn, winterDepth } from '../src/sim/calendar';
import { markHaze } from '../src/sim/winter';
import { fallenOf } from '../src/sim/fallen';
import { bumped, makeWatch } from '../src/render/motion';
import { apply, type Action } from '../src/sim/actions';
import { moveOptions, canGather, canFish } from '../src/sim/travel';
import { canFound, siteReport } from '../src/sim/site';
import { assign, queueBuild } from '../src/sim/colony';
import { BAND_BASE, foodPerDay, firewoodPerNight } from '../src/sim/upkeep';
import { SWORN_MAX, sworn } from '../src/sim/people';
import { migrate } from '../src/state/migrations';
import { startBattle } from '../src/sim/battleTurn';
import { distance, key, fromKey, neighbors } from '../src/hex';
import { isWarbandTurn } from '../src/sim/battle';
import { terrainDef } from '../src/data/terrain';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';
import { forecast, markVisible } from '../src/sim/winter';

const CREW: JobId[] = ['farmer','farmer','woodcutter','hunter','builder','warrior'];
const WANT = ['longhouse','farm-plots','smokehouse','palisade'];

/**
 * A competent-but-not-clairvoyant player: walks toward timber when the
 * woodpile is low, settles on the best ground it has actually seen, and
 * otherwise explores outward from the landing.
 */
function step(state: GameState): Action {
  if (state.event) {
    return state.event.outcome ? { type:'DISMISS_EVENT' } : { type:'CHOOSE', index:0 };
  }
  if (state.aftermath) return { type:'DISMISS_AFTERMATH' };
  if (state.battle) {
    if (state.battle.outcome) return { type:'B_LEAVE' };
    if (!isWarbandTurn(state)) return { type:'B_END_TURN' };
    const b = state.battle;
    const me = b.combatants.find(c => c.personId === b.order[b.turnIndex]);
    if (!me) return { type:'B_END_TURN' };
    const foes = b.combatants.filter(c => c.side === 'foe' && !c.down && !c.fled);
    if (foes.length === 0) return { type:'B_END_TURN' };
    const near = foes.reduce((a,c)=>distance(c.at,me.at)<distance(a.at,me.at)?a=c:a, foes[0]!);
    if (!me.hasActed && distance(near.at, me.at) === 1) {
      return { type:'B_STRIKE', targetId: near.personId };
    }
    if (me.movesLeft > 0) {
      const opts = neighbors(me.at).filter(h => {
        const t = b.grid[key(h)];
        return t && t.ground !== 'block' && t.ground !== 'water'
          && !b.combatants.some(c => !c.down && !c.fled && c.at.q===h.q && c.at.r===h.r);
      });
      if (opts.length) {
        const to = opts.reduce((a,h)=>distance(h,near.at)<distance(a,near.at)?h:a);
        if (distance(to, near.at) < distance(me.at, near.at)) return { type:'B_MOVE', to };
      }
    }
    return { type:'B_END_TURN' };
  }

  const days = state.party.food / Math.max(1, foodPerDay(state));
  const nights = state.party.firewood / Math.max(1, firewoodPerNight(state));

  if (state.settlement) return { type:'CAMP' };

  // Settle on anything workable rather than holding out for perfection.
  if (canFound(state, state.party.at)) {
    const r = siteReport(state.world, state.party.at);
    if (r && r.total >= 9) return { type:'FOUND' };
  }

  const here = state.world.tiles[key(state.party.at)]!.terrain;
  const wooded = here === 'forest' || here === 'hills' || here === 'valley';
  if (nights < 6 && wooded) return { type:'CAMP' };
  if (days < 4 && canGather(state)) return { type:'FORAGE' };
  if (days < 4 && canFish(state)) return { type:'FISH' };

  const opts = moveOptions(state);
  if (opts.length === 0) return { type:'CAMP' };

  // Actually go and look for somewhere to live: among ground we have SEEN,
  // find the nearest hex that would take the posts and walk toward it.
  let target: {q:number;r:number}|null = null; let bestD = 99;
  for (const k of Object.keys(state.world.tiles)) {
    if (state.world.seen[k] === undefined || state.world.seen[k] === 'unseen') continue;
    const at = fromKey(k);
    const probe = { ...state, party: { ...state.party, at } } as GameState;
    if (!canFound(probe, at)) continue;
    const r = siteReport(state.world, at);
    if (!r || r.total < 9) continue;
    const d = distance(at, state.party.at);
    if (d < bestD) { bestD = d; target = at; }
  }
  if (target) {
    const t = target;
    return { type:'MOVE', to: opts.reduce((a,b)=>distance(b,t)<distance(a,t)?b:a) };
  }

  // Nothing seen yet: push inland into the dark, favouring timber when short.
  const score = (h: typeof opts[0]) => {
    const t = state.world.tiles[key(h)]!.terrain;
    return (nights < 8 ? terrainDef(t).wood * 6 : 0)
      + distance(h, state.world.landing)
      + (t === 'ocean' ? -8 : 0);
  };
  return { type:'MOVE', to: opts.reduce((a,b)=>score(b)>score(a)?b:a) };
}

/**
 * Plays one seed until it dies or reaches `maxDay`, and hands back the state.
 *
 * Deliberately a fresh run per milestone rather than one pass with snapshots.
 * The snapshot version was written first and disagreed with this one by forty
 * points, which is a good reminder that a harness is code and can be wrong in
 * exactly the direction that flatters whatever it is measuring.
 */
function run(seed: string, maxDay: number): GameState {
  let state = structuredClone(newGame(seed));
  let jobsSet = false;
  let queued = false;

  for (let i = 0; i < 6000 && !state.end && state.day <= maxDay; i += 1) {
    if (state.settlement && !jobsSet) {
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => assign(state, p.id, CREW[ix % CREW.length]!));
      jobsSet = true;
    }
    if (state.settlement && !queued) {
      for (const b of WANT) queueBuild(state, b as never);
      queued = true;
    }
    // Heed the mark: the game states what the stores must reach, so a
    // competent player moves people onto whatever is short.
    if (state.settlement && markVisible(state)) {
      const need = forecast(state);
      const shortWood = state.party.firewood < need.firewood;
      const shortFood = state.party.food < need.food;
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => {
          if (shortWood && shortFood) assign(state, p.id, ix % 2 ? 'woodcutter' : 'hunter');
          else if (shortWood) assign(state, p.id, ix < 4 ? 'woodcutter' : 'hunter');
          else if (shortFood) assign(state, p.id, ix < 4 ? 'hunter' : 'woodcutter');
        });
    }

    const next = apply(state, step(state));
    if (next === state) break;
    state = next;
  }
  return state;
}

// --- The bars ---

const SEEDS = 30;

interface Curve {
  reachedWinter: number;
  sawSpring: number;
  twoWinters: number;
  settledByWinter: number;
}

let cached: Curve | null = null;

/** Measured once, read by every bar below. */
function measured(): Curve {
  if (cached) return cached;
  const total: Curve = { reachedWinter: 0, sawSpring: 0, twoWinters: 0, settledByWinter: 0 };
  for (let s = 0; s < SEEDS; s += 1) {
    const atWinter = run(`curve-${s}`, 49);
    if (!atWinter.end) {
      total.reachedWinter += 1;
      if (atWinter.settlement) total.settledByWinter += 1;
    }
    if (!run(`curve-${s}`, 73).end) total.sawSpring += 1;
    if (!run(`curve-${s}`, 169).end) total.twoWinters += 1;
  }
  cached = total;
  return total;
}

// Playing thirty seeds three times over is not a five-second job, and the
// default timeout is the only thing here that has any opinion about that.
const CURVE_TIMEOUT = 120_000;

describe('the difficulty curve', () => {
  const pct = (n: number) => Math.round((100 * n) / SEEDS);

  it('is winnable by an average player, and not a walkover', { timeout: CURVE_TIMEOUT }, () => {
    const m = measured();
    console.log(`curve over ${SEEDS} seeds: winter ${pct(m.reachedWinter)}%, spring ${pct(m.sawSpring)}%, two winters ${pct(m.twoWinters)}%, settled by winter ${m.settledByWinter}`);
    // Measured at 73% / 53% / 51% when this bar was written. The band is wide
    // on purpose: this is a tripwire for "unwinnable" and "trivial", not a
    // lock on today's numbers.
    expect(pct(m.reachedWinter)).toBeGreaterThanOrEqual(45);
    expect(pct(m.reachedWinter)).toBeLessThanOrEqual(95);
    expect(pct(m.twoWinters)).toBeGreaterThanOrEqual(20);
    expect(pct(m.twoWinters)).toBeLessThanOrEqual(80);
  });

  it('kills more bands than it spares before the first thaw', { timeout: CURVE_TIMEOUT }, () => {
    // Whatever else moves, the first winter has to be the wall. If as many
    // bands see spring as reach winter, winter has stopped meaning anything.
    const m = measured();
    expect(m.sawSpring).toBeLessThan(m.reachedWinter);
  });

  it('gets most surviving bands settled before the dark', { timeout: CURVE_TIMEOUT }, () => {
    // A band still walking when winter lands is a band that cannot stockpile,
    // and that failure should be a mistake rather than the default.
    const m = measured();
    expect(m.settledByWinter * 2).toBeGreaterThan(m.reachedWinter);
  });
});

// --- The wall ---

// --- What the late game is NOT short of ---
//
// Two levers were built, measured and thrown away trying to fix the flat late
// game (41 of 43 bands through the first winter reach the second). Both are
// recorded here so the third attempt does not start by repeating them.
//
//   1. Raid pressure rising with the steading's fame. Built, then tried at
//      three magnitudes up to three times the original. The curve moved by
//      nothing at any of them: raids do fire — 61 across 80 runs, 38 runs saw
//      one — and settled bands simply hold them.
//   2. Winters that deepen with the years: +2 firewood a night per winter
//      already stood, so winter two burns 8 and winter three 10, plus a
//      colder night for the sickness roll. Implemented correctly and verified
//      at the boundaries. It changed survival to the second winter by zero
//      for a careful player AND by zero for a careless one (18/40 either
//      way), because the winter mark is a perfect forecast and surplus labour
//      can always be moved onto whatever it says is short.
//
// The diagnosis both point at: by the second year a settled band has more
// labour than it has uses for, so NOTHING routed through the material
// survival loop — food, firewood, cold — can threaten it. A lever that works
// has to take away people or bring something a small band cannot beat, not
// raise a number the band can simply out-work.

describe('the memorial outlives the run', () => {
  it('names everyone the run buried, oldest death first', () => {
    const state = structuredClone(newGame('wall'));
    state.party.people[0]!.alive = false;
    state.party.people[0]!.fate = 'took a spear at the ford';
    state.party.people[0]!.diedOn = 30;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.fate = 'did not wake';
    state.party.people[1]!.diedOn = 12;

    const dead = fallenOf(state);
    expect(dead).toHaveLength(2);
    expect(dead[0]!.day).toBe(12);
    expect(dead[1]!.day).toBe(30);
    expect(dead[0]!.fate).toBe('did not wake');
    // The seed goes on the stone, so two Ketils from two sagas are two people.
    expect(dead.every((f) => f.seed === state.seed)).toBe(true);
  });

  it('gives a nameless death a fate and a day rather than dropping it', () => {
    const state = structuredClone(newGame('vague'));
    state.day = 41;
    state.party.people[0]!.alive = false;
    const dead = fallenOf(state);
    expect(dead).toHaveLength(1);
    expect(dead[0]!.fate.length).toBeGreaterThan(0);
    expect(dead[0]!.day).toBe(41);
  });

  it('leaves the living off it', () => {
    const state = structuredClone(newGame('living'));
    expect(fallenOf(state)).toHaveLength(0);
  });
});

// --- Motion ---

describe('the chrome points at what changed', () => {
  it('says nothing on the first reading', () => {
    // Opening the game is not a moment where six numbers changed. Flashing
    // the whole bar on load is noise with no information in it.
    expect(bumped(null, { food: 24, wood: 8 })).toEqual({});
  });

  it('marks only the numbers that actually moved', () => {
    const moved = bumped({ food: 24, wood: 8, heart: 70 }, { food: 21, wood: 8, heart: 70 });
    expect(moved.food).toBe(true);
    expect(moved.wood).toBe(false);
    expect(moved.heart).toBe(false);
  });

  it('does not bump a number it has never seen before', () => {
    // A stat that appears mid-run (a bar gaining a column) has not changed.
    expect(bumped({ food: 24 }, { food: 24, wood: 8 }).wood).toBe(false);
  });

  it('remembers between readings, and each watch keeps its own memory', () => {
    const bar = makeWatch();
    const other = makeWatch();
    expect(bar({ food: 24 })).toEqual({});
    expect(bar({ food: 24 }).food).toBe(false);
    expect(bar({ food: 20 }).food).toBe(true);
    // Reading the same value twice in a row is not a change either.
    expect(bar({ food: 20 }).food).toBe(false);
    // The other bar has seen nothing, so it is still on its first reading.
    expect(other({ food: 20 })).toEqual({});
  });
});

// --- Winters that differ, and a mark that admits it ---

describe('no two winters are the same, and the mark says so', () => {
  it('fixes each winter with the run seed, so replays stay stable', () => {
    const a = winterDepth('same-saga', 150);
    expect(winterDepth('same-saga', 150)).toBe(a);
    expect(winterDepth('same-saga', 160)).toBe(a);
  });

  it('gives different sagas different winters', () => {
    const depths = new Set(
      Array.from({ length: 20 }, (_, i) => winterDepth(`saga-${i}`, 150)),
    );
    expect(depths.size).toBeGreaterThan(1);
  });

  it('leaves the first winter alone — it is the early game and it is tuned', () => {
    for (let i = 0; i < 20; i += 1) expect(winterDepth(`saga-${i}`, 60)).toBe(0);
  });

  it('makes later winters cost more than the first, whatever the luck', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(effectsOn(150, `saga-${i}`).firewood).toBeGreaterThan(effectsOn(60).firewood);
    }
  });

  it('is exact close to, and admits its vagueness far out', () => {
    // 3.4's promise was that the game tells you the number. It still does,
    // where you can act on it — the haze only clouds long-range planning.
    expect(markHaze(150)).toBe(0);
    expect(markHaze(100)).toBeGreaterThan(0);
    expect(markHaze(90)).toBeGreaterThan(markHaze(110));
  });
});

// --- 6.2 groundwork: growth has to cost something ---

describe('the fire scales with the band round it', () => {
  /** A band of exactly this many living people, on this day. */
  function bandOf(heads: number, day: number): GameState {
    const state = structuredClone(newGame('hearth'));
    state.day = day;
    while (state.party.people.length < heads) {
      state.party.people.push({ ...state.party.people[0]!, id: `extra-${state.party.people.length}` });
    }
    state.party.people.forEach((person, i) => {
      person.alive = i < heads;
    });
    return state;
  }

  const MIDWINTER = 60;

  it('leaves the band the game was tuned for exactly where it was', () => {
    // Six off the knarr is the figure every winter number was balanced
    // against, and 80% of bands reaching the first winter is a number worth
    // not disturbing. Scaling must pivot on it, not shift it.
    for (const day of [10, 30, MIDWINTER, 80]) {
      const six = bandOf(BAND_BASE, day);
      expect(firewoodPerNight(six)).toBe(effectsOn(day, six.seed).firewood);
    }
  });

  it('makes a bigger hall cost more to keep', () => {
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const nine = firewoodPerNight(bandOf(9, MIDWINTER));
    const twelve = firewoodPerNight(bandOf(12, MIDWINTER));
    expect(nine).toBeGreaterThan(six);
    expect(twelve).toBeGreaterThan(nine);
  });

  it('does not turn losing people into a windfall', () => {
    // A fire warms a room, not a headcount. If half the band dying halved the
    // burn, a death would be a saving — which is the opposite of what
    // permadeath and the memorial wall are for.
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const three = firewoodPerNight(bandOf(3, MIDWINTER));
    expect(three).toBeLessThan(six);
    expect(three * 2).toBeGreaterThan(six);
  });

  it('never lets a night be free', () => {
    for (const heads of [1, 2, 3]) {
      for (const day of [10, MIDWINTER]) {
        expect(firewoodPerNight(bandOf(heads, day))).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('closes the asymmetry that made extra hands free', () => {
    // The whole reason this exists: food scaled with mouths and firewood did
    // not, so every additional person was labour at no cost in wood. Three
    // separate attempts to threaten the late game bounced off exactly that.
    // Both must now move together before 6.2 offers anybody a way to grow.
    const small = bandOf(4, MIDWINTER);
    const large = bandOf(12, MIDWINTER);
    expect(foodPerDay(large)).toBeGreaterThan(foodPerDay(small));
    expect(firewoodPerNight(large)).toBeGreaterThan(firewoodPerNight(small));
  });
});

// --- 6.2: who bears arms ---

describe('the warband is six, whatever the steading holds', () => {
  /** A band with `armed` sworn and `workers` hands. */
  function household(armed: number, workers: number): GameState {
    const state = structuredClone(newGame('household'));
    const template = state.party.people[0]!;
    state.party.people = [
      ...Array.from({ length: armed }, (_, i) => ({
        ...template, id: `sworn-${i}`, bond: 'sworn' as const, alive: true,
      })),
      ...Array.from({ length: workers }, (_, i) => ({
        ...template, id: `hand-${i}`, bond: 'hand' as const, alive: true,
      })),
    ];
    return state;
  }

  it('never fields more than six however many are at home', () => {
    for (const workers of [0, 4, 9, 20]) {
      const state = household(6, workers);
      expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    }
  });

  it('caps the sworn even if a save somehow holds more', () => {
    expect(sworn(household(10, 0).party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps the hands off the field entirely', () => {
    const state = household(4, 8);
    startBattle(state, 'meadow', 0);
    const ours = state.battle!.combatants.filter((c) => c.side === 'warband');
    // Four sworn, eight hands, four on the field. More people at the steading
    // must never become a wider shield wall.
    expect(ours).toHaveLength(4);
    for (const c of ours) expect(c.personId.startsWith('sworn-')).toBe(true);
  });

  it('counts the hands as mouths and as bodies round the fire', () => {
    // They do not fight, but they eat and they need warming — which is what
    // stops taking people in from being free.
    const lean = household(6, 0);
    const full = household(6, 6);
    lean.day = 60;
    full.day = 60;
    expect(foodPerDay(full)).toBeGreaterThan(foodPerDay(lean));
    expect(firewoodPerNight(full)).toBeGreaterThan(firewoodPerNight(lean));
  });

  it('brings an older save forward with everyone sworn', () => {
    // Everyone in a pre-6.2 save came off the knarr with a weapon.
    const old = structuredClone(newGame('older')) as unknown as Record<string, unknown>;
    old['version'] = 16;
    const party = old['party'] as { people: Record<string, unknown>[] };
    for (const person of party.people) delete person['bond'];
    const migrated = migrate(old).save;
    const people = (migrated['party'] as { people: Record<string, unknown>[] }).people;
    expect(people.every((p) => p['bond'] === 'sworn')).toBe(true);
  });
});

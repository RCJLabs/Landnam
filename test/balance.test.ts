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
//
// The third was the largest, and it was found teaching the bot to form a
// shield wall. The run loop below treated ANY refused action as the end of
// the saga, and the old bot proposed battle moves without costing the ground
// or the disengage — so doMove refused them, and THIRTY of sixty runs were
// cut off mid-battle, one as early as day 7, every one counted as alive at
// every milestone thereafter. The 83/55/50 curve this file used to print was
// those thirty truncated sagas. Played out legally, the same charge-in bot
// reads 78/22/2; the wall-forming bot that replaced it reads 78/30/7 with
// zero refusals — better at every mark, on fights that actually get fought.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { effectsOn, winterDepth } from '../src/sim/calendar';
import { markHaze } from '../src/sim/winter';
import { bumped, makeWatch } from '../src/render/motion';
import { apply, type Action } from '../src/sim/actions';
import { moveOptions, canGather, canFish } from '../src/sim/travel';
import { canFound, siteReport } from '../src/sim/site';
import { assign, queueBuild } from '../src/sim/colony';
import { BAND_BASE, foodPerDay, firewoodPerNight } from '../src/sim/upkeep';
import { SWORN_MAX, hands, leaderOf, living, sworn } from '../src/sim/people';
import { handsLeave, roomLeft, SETTLED_IN, takeIn } from '../src/sim/joining';
import { migrate } from '../src/state/migrations';
import { startBattle } from '../src/sim/battleTurn';
import { MAX_RAIDERS, MAX_RAIDERS_FAMED, raiderCap } from '../src/sim/battle';
import { RAID_CHANCE_MAX, SACK_TAKES, raidDifficulty, raidOdds, sackSteading } from '../src/sim/raid';
import { fallenOf } from '../src/sim/fallen';
import { capacity, crowding } from '../src/sim/colony';
import { moodTarget } from '../src/sim/minds';
import { foundSettlement } from '../src/sim/site';
import { distance, key, fromKey } from '../src/hex';
import { isWarbandTurn } from '../src/sim/battle';
import { reachWithZoc } from '../src/sim/zoc';
import { placeHere } from '../src/sim/places';
import { placeKind } from '../src/data/places';
import { canFallOn, neighbourHere } from '../src/sim/neighbours';
import { terrainDef } from '../src/data/terrain';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';
import { forecast, markVisible } from '../src/sim/winter';

const CREW: JobId[] = ['farmer','farmer','woodcutter','hunter','builder','warrior'];
// NOTE: 'farmplots' has no hyphen. The first version of this list wrote
// 'farm-plots', which matches no building, so that entry silently never
// queued and the measured bot had been building three things while this file
// claimed four. A búð is on the list because 6.2 gave the band a way to grow
// and a harness that cannot grow reports growth as worthless — the same
// mistake as the bot that would not fight back.
const WANT = ['longhouse', 'farmplots', 'bud', 'smokehouse', 'palisade'];

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
    // The game gained the war-cry, so the bot cries it in the same commit.
    // The average player spends the leader's action on it when the press is
    // real — two or more foes in earshot — and never on a stray skirmisher.
    if (!me.hasActed && !b.warCried && !me.broken
      && me.personId === leaderOf(state.party.people)?.id
      && foes.filter(f => distance(f.at, me.at) <= 2).length >= 2) {
      return { type:'B_WARCRY' };
    }
    if (!me.hasActed && distance(near.at, me.at) === 1) {
      return { type:'B_STRIKE', targetId: near.personId };
    }
    if (me.movesLeft > 0) {
      // The wall, formed on the way in rather than instead of it. This is the
      // exact rule test/wall.test.ts measures as beating the charge: closing
      // at 4 a hex outweighs shoulders at 3 a mate, two mates at most, so
      // shoulders decide BETWEEN approaches and can never argue anyone into
      // standing still. The first attempt here weighted shoulders above
      // ground and the band huddled: raids held rose and the open-field curve
      // collapsed — a bot that plays worse overall measures nothing.
      const score = (at: {q:number;r:number}) => {
        const mates = b.combatants.filter(c =>
          c.side === 'warband' && c.personId !== me.personId
          && !c.down && !c.fled && distance(c.at, at) === 1).length;
        const gap = Math.min(...foes.map(f => distance(at, f.at)));
        return -gap * 4 + Math.min(mates, 2) * 3;
      };
      // reachWithZoc only offers legal moves, so a chosen B_MOVE cannot be
      // refused — and a refused action is how this harness ends a run.
      const reach = [...reachWithZoc(b, me).keys()].map(fromKey);
      if (reach.length) {
        const to = reach.reduce((a,h)=>score(h)>score(a)?h:a);
        if (score(to) > score(me.at)) return { type:'B_MOVE', to };
      }
    }
    return { type:'B_END_TURN' };
  }

  const days = state.party.food / Math.max(1, foodPerDay(state));
  const nights = state.party.firewood / Math.max(1, firewoodPerNight(state));

  // A place worth taking, under our feet, still standing: take it. The rule
  // that put this here is the same one that taught the bot to swing — the
  // game gained raidable places, so the bot raids them in the same commit,
  // or the measurement reports them as worthless. An average player robs
  // the soft targets and leaves the town to a braver run.
  const here2 = placeHere(state);
  if (here2 && here2.sackedOn === undefined) {
    const def = placeKind(here2.kind);
    if (def.garrison === null || def.garrison <= 1) {
      return { type:'SACK_PLACE', id: here2.id };
    }
  }

  // Starving on a cold doorstep: the average player robs it before they die.
  // Friends stay friends — this only fires on a camp that already dislikes
  // the band, when there are under three days of food left.
  const host = neighbourHere(state);
  if (host && days < 3 && host.standing < 10 && canFallOn(state, host.id)) {
    return { type:'FALL_ON', id: host.id };
  }

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

  // Short on food with a soft larder in sight: the average player robs it.
  if (days < 5) {
    let larder: {q:number;r:number}|null = null; let larderD = 7;
    for (const p of state.world.places) {
      if (p.sackedOn !== undefined) continue;
      const def = placeKind(p.kind);
      if (def.garrison !== null && def.garrison > 1) continue;
      if (def.loot.food <= 0) continue;
      if (state.world.seen[key(p.at)] === undefined) continue;
      const d = distance(p.at, state.party.at);
      if (d < larderD) { larderD = d; larder = p.at; }
    }
    if (larder) {
      const t = larder;
      return { type:'MOVE', to: opts.reduce((a,b)=>distance(b,t)<distance(a,t)?b:a) };
    }
  }

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

    let next = apply(state, step(state));
    if (next === state && state.battle) {
      // A refused battle action must never end the saga — a player whose tap
      // is refused is still in the fight, and the turn can always be ended.
      // The old break here ate half of every sample: see the header.
      next = apply(state, { type: 'B_END_TURN' });
    }
    if (next === state) break;
    state = next;
  }
  return state;
}


/**
 * Founds at the landing if the landing will take posts, else wherever the
 * world will. The wider sea margin (52x36 worldgen) made foundable LANDINGS
 * rare, and a fixture that only ever tried the landing started failing on
 * ground that exists eight hexes away.
 */
function foundAnywhere(state: GameState): boolean {
  if (foundSettlement(state)) return true;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    if (canFound(state, at) && foundSettlement(state)) return true;
  }
  return false;
}

// --- The bars ---

/**
 * Sixty, not thirty.
 *
 * Thirty was enough to be a tripwire and not enough to tune on, and an audit
 * proved it: sweeping the base event chance through 0.28, 0.34 and 0.40 gave
 * 53%, 30% and 43% at the two-winter mark — a fourteen-point swing that went
 * the WRONG WAY in the middle. That is not a response curve, it is noise
 * being read as signal. At a fixed setting the same measurement moved five
 * points between thirty seeds and sixty, so anything smaller than about ten
 * points is below what this harness can see.
 *
 * The bars below are deliberately wide for the same reason. They exist to
 * catch "unwinnable" and "walkover", not to pin a number.
 */
const SEEDS = 60;

interface Curve {
  reachedWinter: number;
  sawSpring: number;
  twoWinters: number;
  settledByWinter: number;
  /**
   * Item 4 of the audit: WHAT kills bands in the wall window (day 40-73,
   * where the curve falls from ~78% to ~25%). Keyed by the person's own
   * fate string, raw and uninterpreted — the instrument counts, it does
   * not editorialise. Run-endings over the same window count beside it.
   */
  deaths: Record<string, number>;
  ends: Record<string, number>;
}

let cached: Curve | null = null;

/**
 * Measured once, read by every bar below.
 *
 * Async for one reason: the loop is minutes of solid computation, and a
 * worker whose event loop never yields cannot answer the test runner's RPC
 * heartbeat — CI then fails the run with "[vitest-worker]: Timeout calling
 * onTaskUpdate" under 560 green tests. One yielded macrotask per seed keeps the
 * loop breathing and costs nothing anyone can measure.
 */
async function measured(): Promise<Curve> {
  if (cached) return cached;
  const total: Curve = {
    reachedWinter: 0, sawSpring: 0, twoWinters: 0, settledByWinter: 0,
    deaths: {}, ends: {},
  };
  for (let s = 0; s < SEEDS; s += 1) {
    const atWinter = run(`curve-${s}`, 49);
    if (!atWinter.end) {
      total.reachedWinter += 1;
      if (atWinter.settlement) total.settledByWinter += 1;
    }
    const atSpring = run(`curve-${s}`, 73);
    if (!atSpring.end) total.sawSpring += 1;
    // The wall window: who died between the first frost and the thaw, and of
    // what. `left` is excluded — walking out is not a death, per item 2 of
    // the LAST audit, and this table must not repeat that lie.
    for (const p of atSpring.party.people) {
      if (p.alive || p.left) continue;
      if ((p.diedOn ?? 0) < 40 || (p.diedOn ?? 0) > 73) continue;
      const fate = p.fate ?? 'unrecorded';
      total.deaths[fate] = (total.deaths[fate] ?? 0) + 1;
    }
    if (atSpring.end) total.ends[atSpring.end.cause] = (total.ends[atSpring.end.cause] ?? 0) + 1;
    if (!run(`curve-${s}`, 169).end) total.twoWinters += 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  cached = total;
  return total;
}

// Playing thirty seeds three times over is not a five-second job, and the
// default timeout is the only thing here that has any opinion about that.
const CURVE_TIMEOUT = 120_000;

describe('the difficulty curve', () => {
  const pct = (n: number) => Math.round((100 * n) / SEEDS);

  it('is winnable by an average player, and not a walkover', { timeout: CURVE_TIMEOUT }, async () => {
    const m = await measured();
    console.log(`curve over ${SEEDS} seeds: winter ${pct(m.reachedWinter)}%, spring ${pct(m.sawSpring)}%, two winters ${pct(m.twoWinters)}%, settled by winter ${m.settledByWinter}`);
    // Measured at 78% / 30% / 7% when these bars were re-based. The figures
    // they replaced (83/55/50) were the truncation artifact in the header,
    // not the game. The band stays wide on purpose: a tripwire for
    // "unwinnable" and "trivial", not a lock on today's numbers.
    //
    // The floor moved from two winters to spring, because an instrument that
    // resolves to ±5 points cannot honestly put a floor under a 7% figure.
    // Two winters keeps only the walkover ceiling; whether 7% is the brutal
    // late game Phase 6 wanted or an overshoot is a design decision the
    // roadmap now owns, and a bar must not take it by default.
    expect(pct(m.reachedWinter)).toBeGreaterThanOrEqual(45);
    expect(pct(m.reachedWinter)).toBeLessThanOrEqual(95);
    expect(pct(m.sawSpring)).toBeGreaterThanOrEqual(10);
    expect(pct(m.twoWinters)).toBeLessThanOrEqual(60);
  });

  it('kills more bands than it spares before the first thaw', { timeout: CURVE_TIMEOUT }, async () => {
    // Whatever else moves, the first winter has to be the wall. If as many
    // bands see spring as reach winter, winter has stopped meaning anything.
    const m = await measured();
    expect(m.sawSpring).toBeLessThan(m.reachedWinter);
  });

  it('gets most surviving bands settled before the dark', { timeout: CURVE_TIMEOUT }, async () => {
    // A band still walking when winter lands is a band that cannot stockpile,
    // and that failure should be a mistake rather than the default.
    const m = await measured();
    expect(m.settledByWinter * 2).toBeGreaterThan(m.reachedWinter);
  });

  it('names what the wall window kills with', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 4 of the audit. Half the game's deaths land between day 40 and
    // 73, and until this table existed nobody could say of WHAT — which is
    // the difference between a hard game and an opaque one. No bars on the
    // shape: the table is an instrument, and the one assertion is that it
    // cannot silently go blind.
    const m = await measured();
    const deaths = Object.entries(m.deaths).sort((a, b) => b[1] - a[1]);
    const ends = Object.entries(m.ends).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `the wall window (day 40-73) over ${SEEDS} seeds — deaths: ` +
        deaths.map(([fate, n]) => `${fate} ${n}`).join(', ') +
        ` | runs ended: ${ends.map(([cause, n]) => `${cause} ${n}`).join(', ')}`,
    );
    const total = deaths.reduce((sum, [, n]) => sum + n, 0);
    expect(total).toBeGreaterThan(0);
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

// --- 6.2: room to put people ---

describe('a steading holds who it has room for', () => {
  function settledAt(seed: string): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) return state;
    }
    throw new Error('nothing foundable');
  }

  it('gives a band with no steading room only for the six it landed with', () => {
    expect(capacity(structuredClone(newGame('roofless')))).toBe(SWORN_MAX);
  });

  it('opens room only when something is built for it', () => {
    const state = settledAt('room');
    // Posts in and nothing raised: still the six the boat sleeps. Settling
    // must never make a band worse off than camping.
    expect(capacity(state)).toBe(SWORN_MAX);
    state.settlement!.built.push('longhouse');
    expect(capacity(state)).toBe(6);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBe(10);
    state.settlement!.built.push('meadhall');
    expect(capacity(state)).toBe(13);
  });

  it('counts nobody as crowded while there is space', () => {
    const state = settledAt('space');
    state.settlement!.built.push('longhouse');
    expect(crowding(state)).toBe(0);
  });

  it('bites harder the further past the roof the band is', () => {
    const state = settledAt('packed');
    state.settlement!.built.push('longhouse');
    const template = state.party.people[0]!;
    const roomy = moodTarget(state, template, { hungry: false, cold: false, grieving: false });

    for (let i = 0; i < 4; i += 1) {
      state.party.people.push({ ...template, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(crowding(state)).toBe(4);
    const packed = moodTarget(state, template, { hungry: false, cold: false, grieving: false });
    expect(packed).toBeLessThan(roomy);
  });

  it('makes the build queue worth keeping after the winter is beaten', () => {
    // The point of capacity: raising a búð is what lets a band grow, so the
    // queue stops being a thing you finish and becomes a thing you extend.
    const state = settledAt('queue');
    state.settlement!.built.push('longhouse');
    const before = capacity(state);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBeGreaterThan(before);
  });
});

// --- 6.2: the ways in, and the way out ---

describe('a band that can grow, and can bleed', () => {
  function roofed(seed: string, rooms: string[] = ['longhouse']): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) {
        state.settlement!.built.push(...rooms);
        return state;
      }
    }
    throw new Error('nothing foundable');
  }

  it('takes people in as hands, never as fighters', () => {
    const state = roofed('join', ['longhouse', 'bud']);
    const joined = takeIn(state, 2, 'they had nowhere else to be');
    expect(joined).toHaveLength(2);
    expect(joined.every((p) => p.bond === 'hand')).toBe(true);
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('turns people away when there is no bed, and says nothing about it', () => {
    // A full hall refusing help is the whole reason capacity exists — and it
    // is what makes a búð worth five timber.
    const full = roofed('full');
    expect(roomLeft(full)).toBe(0);
    expect(takeIn(full, 2, 'they had nowhere else to be')).toHaveLength(0);
    expect(living(full.party.people)).toHaveLength(6);
  });

  it('takes as many as there is room for and no more', () => {
    const state = roofed('partial', ['longhouse', 'bud']);
    expect(roomLeft(state)).toBe(4);
    expect(takeIn(state, 9, 'word had got round that we had ground')).toHaveLength(4);
    expect(roomLeft(state)).toBe(0);
  });

  it('writes every arrival into the saga with the reason they came', () => {
    const state = roofed('saga', ['longhouse', 'bud']);
    const before = state.saga.length;
    takeIn(state, 1, 'she came out of the trees with nothing');
    expect(state.saga.length).toBeGreaterThan(before);
    expect(state.saga.at(-1)!.text).toContain('trees');
  });

  it('lets a miserable hand walk, and never a sworn one', () => {
    const state = roofed('leaving', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    state.day += 1;
    for (const person of state.party.people) person.morale = 1;

    let walked = 0;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      walked += handsLeave(state).length;
    }
    expect(walked).toBeGreaterThan(0);
    // The warband cannot evaporate. A fight must never be a morale check
    // before it is a fight.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps a hand who has thrown their lot in', () => {
    const state = roofed('stayer', ['longhouse', 'bud']);
    takeIn(state, 2, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 1;
    state.day += SETTLED_IN + 1;
    expect(handsLeave(state)).toHaveLength(0);
  });

  it('keeps a contented hand whatever the weather', () => {
    const state = roofed('content', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 80;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      expect(handsLeave(state)).toHaveLength(0);
    }
  });

  it('empties a hall that is too crowded to bear', () => {
    // Capacity with teeth: taking in more than there is room for makes
    // everyone miserable, and misery is what makes hands walk.
    const state = roofed('overfull', ['longhouse', 'bud', 'meadhall']);
    takeIn(state, 7, 'word had got round that we had ground');
    const packed = crowding(state);
    for (const person of state.party.people) person.morale = 20;
    // Now take the room away, as a burnt búð or a bad winter would.
    state.settlement!.built = ['longhouse'];
    expect(crowding(state)).toBeGreaterThan(packed);
  });
});

// --- 6.3: force that outscales the warband ---

describe('a steading worth taking draws more than six can hold', () => {
  function famed(seed: string, built: string[], winters: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      // wintersStood counts from the first thaw, so winters=0 has to stay
      // BEFORE it — 73 is already one winter come through, not none.
      state.day = winters === 0 ? 30 : 73 + (winters - 1) * 96;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('brings the old nine against a steading nobody has heard of', () => {
    expect(raiderCap(famed('new', ['longhouse'], 0))).toBe(MAX_RAIDERS);
  });

  it('brings more against a hall that has stood years and been built up', () => {
    const young = raiderCap(famed('young', ['longhouse'], 0));
    const old = raiderCap(famed('old', ['longhouse', 'bud', 'meadhall', 'palisade'], 3));
    expect(old).toBeGreaterThan(young);
  });

  it('never fields more than the ground can hold', () => {
    const enormous = famed('huge', ['longhouse', 'bud', 'meadhall', 'palisade', 'smokehouse', 'dock'], 12);
    expect(raiderCap(enormous)).toBeLessThanOrEqual(MAX_RAIDERS_FAMED);
  });

  it('lets a coast that hates you actually send more', () => {
    // The measured dead end this exists to fix: with six sworn, rollFoes hit
    // the old cap of nine at difficulty four, so every point of pressure past
    // that was discarded by a Math.min and raid pressure measured as
    // worthless at three separate magnitudes. The lever was disconnected from
    // the thing it moved. What matters is that provocation now reaches the
    // field, not that it clears any particular number.
    const liked = famed('liked', ['longhouse', 'bud', 'meadhall'], 2);
    liked.party.food = 400;
    for (const n of liked.neighbours) n.standing = 60;

    const hated = structuredClone(liked);
    for (const n of hated.neighbours) n.standing = -100;

    expect(raidDifficulty(hated)).toBeGreaterThan(raidDifficulty(liked));
  });

  it('cannot be answered by fielding more of your own', () => {
    // Growth buys labour, never a wider line. That is what forces the answer
    // to be the wall, the watch, and who on this coast owes you anything.
    const state = famed('answer', ['longhouse', 'bud', 'meadhall'], 3);
    for (let i = 0; i < 7; i += 1) {
      state.party.people.push({ ...state.party.people[0]!, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    expect(raiderCap(state)).toBeGreaterThan(SWORN_MAX);
  });
});

describe('a steading worth taking is visited', () => {
  function steading(seed: string, built: string[], winters: number, food = 60): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      state.day = 73 + Math.max(0, winters - 1) * 96;
      state.party.food = food;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('leaves a steading alone while the posts are still fresh', () => {
    const fresh = steading('fresh', ['longhouse'], 1);
    fresh.settlement!.foundedOn = fresh.day - 2;
    expect(raidOdds(fresh)).toBe(0);
  });

  it('comes more for a hall that has stood years and been built up', () => {
    const young = raidOdds(steading('young', ['longhouse'], 1));
    const old = raidOdds(steading('old', ['longhouse', 'bud', 'meadhall', 'smokehouse'], 4));
    expect(old).toBeGreaterThan(young);
  });

  it('makes the watch and the wall worth keeping on a quiet day', () => {
    const open = steading('open', ['longhouse', 'bud', 'meadhall'], 3);
    const walled = structuredClone(open);
    walled.settlement!.built.push('palisade');
    walled.settlement!.watch = 6;
    expect(raidOdds(walled)).toBeLessThan(raidOdds(open));
  });

  it('stays a background hazard rather than a siege', () => {
    const richest = steading('rich', ['longhouse', 'bud', 'meadhall', 'smokehouse', 'dock'], 9, 900);
    for (const n of richest.neighbours) n.standing = -100;
    expect(raidOdds(richest)).toBeLessThanOrEqual(RAID_CHANCE_MAX);
  });
});

describe('somebody who walked out is not somebody who died', () => {
  it('keeps a leaver off the memorial and out of the saga', () => {
    const state = structuredClone(newGame('walked'));
    const killed = state.party.people[0]!;
    killed.alive = false;
    killed.fate = 'took a spear at the ford';
    killed.diedOn = 20;

    const gone = state.party.people[1]!;
    gone.alive = false;
    gone.left = true;
    gone.fate = 'walked out one morning and did not come back';
    gone.diedOn = 22;

    const wall = fallenOf(state);
    expect(wall).toHaveLength(1);
    expect(wall[0]!.name).toBe(killed.name);
  });

  it('still stops counting them as a mouth to feed', () => {
    // `alive: false` has to stand, whatever the fiction: somebody who has
    // gone is not eating here any more, and the upkeep must agree.
    const state = structuredClone(newGame('mouths'));
    const before = foodPerDay(state);
    state.party.people[0]!.alive = false;
    state.party.people[0]!.left = true;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.left = true;
    expect(foodPerDay(state)).toBeLessThan(before);
  });
});

// --- 3, 4 and 5 of the audit, deliberately in one place ---

describe('losing a raid costs the one thing that is scarce', () => {
  function sacked(seed: string, extraHands: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push('longhouse', 'bud', 'meadhall');
      state.party.food = 120;
      state.party.firewood = 90;
      for (let h = 0; h < extraHands; h += 1) {
        state.party.people.push({
          ...state.party.people[0]!, id: `hand-${h}`, bond: 'hand', alive: true, joinedOn: 1,
        });
      }
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('carries hands off, and never the sworn', () => {
    const state = sacked('taken', 4);
    const out = sackSteading(state);
    expect(out.taken.length).toBeGreaterThan(0);
    expect(out.taken.length).toBeLessThanOrEqual(SACK_TAKES);
    // The warband is fixed at six and a raid must not end a run by dice.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('takes nobody when there is nobody but the sworn to take', () => {
    const state = sacked('bare', 0);
    expect(sackSteading(state).taken).toHaveLength(0);
    expect(living(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('puts the carried-off on the memorial, unlike somebody who walked out', () => {
    // Taken is not the same as left. A man carried off by raiders genuinely
    // did not come back, and the wall is exactly the place to say so.
    const state = sacked('wall', 3);
    sackSteading(state);
    expect(fallenOf(state).some((f) => f.fate.includes('carried off'))).toBe(true);
  });

  it('costs labour the band has to win back rather than simply out-work', () => {
    const state = sacked('labour', 4);
    const before = living(state.party.people).length;
    sackSteading(state);
    expect(living(state.party.people).length).toBeLessThan(before);
  });
});

describe('raids are measured, not assumed', () => {
  it('records how often a raid comes and how often it is held', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 5 of the audit: nothing counted how often a raid was LOST, only
    // how often one fired — so the change above had no baseline to move.
    let fired = 0;
    let held = 0;
    let sagas = 0;
    for (let s = 0; s < 20; s += 1) {
      const state = run(`curve-${s}`, 169);
      fired += state.tally.raids;
      held += state.tally.raidsHeld;
      if (state.tally.raids > 0) sagas += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // eslint-disable-next-line no-console
    console.log(`raids over 20 sagas: ${fired} came, ${held} held, ${fired - held} lost; ${sagas} sagas saw one`);
    expect(fired).toBeGreaterThan(0);
    expect(held).toBeLessThanOrEqual(fired);
  });
});

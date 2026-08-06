// 3.5: raids on the steading. The bar is that the palisade earns its lumber,
// so the centre of this file runs the same raid on the same steading with and
// against without one, and weighs the difference against what it cost.

import { describe, it, expect } from 'vitest';
import { distance, fromKey, key, offsetToAxial } from '../src/hex';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { EVENTS } from '../src/data/events';
import { buildingById } from '../src/data/buildings';
import { apply } from '../src/sim/actions';
import { isEligible } from '../src/sim/events';
import { canFound, foundSettlement, siteReport } from '../src/sim/site';
import { assign, standing as builtIn } from '../src/sim/colony';
import { activeCombatant, standing } from '../src/sim/battle';
import { startBattle, startRaid } from '../src/sim/battleTurn';
import { throwTargets } from '../src/sim/battleActions';
import { reachWithZoc } from '../src/sim/zoc';
import { fighterPerson } from '../src/sim/battle';
import { isPassable, groundCost, WALL_ROW, FIELD_HEIGHT, FIELD_WIDTH } from '../src/sim/battlefield';
import { raidDifficulty, RAID_EARLIEST_DAY, SACK_SHARE, sackSteading } from '../src/sim/raid';
import { living } from '../src/sim/people';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/** Offset row of an axial hex, matching offsetToAxial in the hex library. */
function offsetRow(at: { q: number; r: number }): number {
  return at.r;
}

function settled(seed: string, radius = 14): GameState {
  const state = structuredClone(newGame(seed));
  for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
  const landing = state.world.landing;
  let best: GameState['party']['at'] | null = null;
  let bestScore = -1;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    const gap =
      (Math.abs(at.q - landing.q) +
        Math.abs(at.r - landing.r) +
        Math.abs(at.q + at.r - landing.q - landing.r)) /
      2;
    if (gap > radius) continue;
    state.party.at = at;
    if (!canFound(state, at)) continue;
    const report = siteReport(state.world, at)!;
    if (report.total > bestScore) {
      bestScore = report.total;
      best = at;
    }
  }
  expect(best, `${seed}: nothing foundable`).toBeTruthy();
  state.party.at = best!;
  expect(foundSettlement(state)).toBe(true);
  state.party.people
    .filter((p) => p.alive)
    .forEach((p, i) => assign(state, p.id, CREW[i % CREW.length]!));
  state.day = 30;
  state.party.food = 90;
  state.party.firewood = 90;
  return state;
}

/** Same steading, with the longhouse and store a raider would come for. */
function stocked(seed: string, palisade: boolean): GameState {
  const state = settled(seed);
  const home = state.settlement!;
  home.built.push('longhouse', 'farmplots');
  home.shelter = 3;
  if (palisade) home.built.push('palisade');
  return state;
}

/** Defends the yard: strike what is adjacent, otherwise hold the line. */
function defend(state: GameState): GameState {
  let cur = state;
  for (let i = 0; i < 900 && !cur.battle?.outcome; i++) {
    const battle = cur.battle!;
    const active = activeCombatant(battle);
    if (!active || active.side !== 'warband') {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const foes = standing(battle, 'foe');
    const adjacent = foes.filter((c) => distance(c.at, active.at) === 1);
    if (!active.hasActed && adjacent.length > 0) {
      const weakest = [...adjacent].sort(
        (a, b) =>
          (fighterPerson(cur, a.personId)?.health ?? 99) -
          (fighterPerson(cur, b.personId)?.health ?? 99),
      )[0]!;
      cur = apply(cur, { type: 'B_STRIKE', targetId: weakest.personId });
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    if (!active.hasActed && throwTargets(cur).length > 0) {
      cur = apply(cur, { type: 'B_THROW', targetId: throwTargets(cur)[0]!.personId });
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    // Hold: keep shoulder to shoulder in the yard rather than charging out
    // past the wall, which is the whole point of having one.
    const reach = [...reachWithZoc(battle, active).keys()].map((k) => fromKey(k));
    if (reach.length > 0 && foes.length > 0) {
      const score = (at: { q: number; r: number }) => {
        const mates = standing(battle, 'warband').filter(
          (c) => c.personId !== active.personId && distance(c.at, at) === 1,
        ).length;
        const gap = Math.min(...foes.map((f) => distance(at, f.at)));
        // Hold the yard. Climbing out over your own palisade to meet them in
        // the open throws away the only thing it was built for, so the bot
        // will not do it — and neither should a player.
        const outside = battle.raid && offsetRow(at) < WALL_ROW + 1 ? 40 : 0;
        return -Math.max(gap, 2) * 3 + Math.min(mates, 2) * 4 - outside;
      };
      const best = [...reach].sort((a, b) => score(b) - score(a))[0]!;
      const moved = apply(cur, { type: 'B_MOVE', to: best });
      cur = moved === cur ? apply(cur, { type: 'B_END_TURN' }) : moved;
      continue;
    }
    cur = apply(cur, { type: 'B_END_TURN' });
  }
  return apply(cur, { type: 'B_LEAVE' });
}

// --- The ground ---

describe('the steading under attack', () => {
  it('is fought on your own ground, with the hall at your back', () => {
    const state = stocked('ground-1', true);
    startRaid(state, 0);
    const battle = state.battle!;
    expect(battle.raid).toBe(true);
    expect(battle.width).toBe(FIELD_WIDTH);
    expect(battle.height).toBe(FIELD_HEIGHT);

    // The hall stands in the yard and cannot be walked through.
    const hall = offsetToAxial(Math.floor(FIELD_WIDTH / 2), FIELD_HEIGHT - 1);
    expect(battle.grid[key(hall)]!.ground).toBe('block');
    // And nobody deployed inside it.
    expect(battle.combatants.some((c) => key(c.at) === key(hall))).toBe(false);
  });

  it('raises the palisade only if one was built, with a gate in it', () => {
    const walled = stocked('ground-wall', true);
    startRaid(walled, 0);
    const open = stocked('ground-wall', false);
    startRaid(open, 0);

    const wallRow = (state: GameState) =>
      Array.from({ length: FIELD_WIDTH }, (_, col) =>
        state.battle!.grid[key(offsetToAxial(col, WALL_ROW))]!.ground,
      );

    const walls = wallRow(walled).filter((g) => g === 'wall').length;
    expect(walls).toBe(FIELD_WIDTH - 1);
    // Exactly one way through that is not a climb.
    expect(wallRow(walled).filter((g) => g !== 'wall')).toHaveLength(1);
    expect(wallRow(open).filter((g) => g === 'wall')).toHaveLength(0);
  });

  it('slows them rather than stopping them — a sealed field would strand the AI', () => {
    expect(Number.isFinite(groundCost('wall'))).toBe(true);
    expect(groundCost('wall')).toBeGreaterThan(groundCost('rough'));
    expect(isPassable('wall')).toBe(true);
  });

  it('leaves a way in that does not need climbing', () => {
    for (const seed of ['gate-a', 'gate-b', 'gate-c']) {
      const state = stocked(seed, true);
      startRaid(state, 0);
      const grid = state.battle!.grid;
      // Some column runs from the raiders' edge to the wall row without a
      // climb, or the gate is not actually the fast way in.
      const clear = Array.from({ length: FIELD_WIDTH }, (_, col) =>
        Array.from({ length: WALL_ROW + 1 }, (_, row) => grid[key(offsetToAxial(col, row))]!.ground)
          .every((g) => g !== 'wall' && isPassable(g)),
      );
      expect(clear.some(Boolean), `${seed}: no gate lane`).toBe(true);
    }
  });
});

// --- The milestone's bar ---

describe('the palisade earns its lumber', () => {
  const SEEDS = Array.from({ length: 10 }, (_, i) => `raid-${i}`);

  function fightRaid(seed: string, palisade: boolean) {
    const state = stocked(seed, palisade);
    const foodBefore = state.party.food;
    const woodBefore = state.party.firewood;
    const builtBefore = state.settlement!.built.length;
    // The game's own scaling, not a fixed number: a walled steading is worth
    // more to rob, so it draws a bigger band. Testing at a flat difficulty
    // would quietly hand the wall an advantage the real game does not.
    startRaid(state, raidDifficulty(state));
    const after = defend(state);
    return {
      won: after.aftermath!.won,
      standing: living(after.party.people).length,
      dead: after.aftermath!.killed.length,
      lostBuildings: builtBefore - after.settlement!.built.length,
      // Positive is loss. A held field usually leaves you better off than you
      // started, so this can be negative — that difference is the point.
      stolen: foodBefore - after.party.food + (woodBefore - after.party.firewood),
    };
  }

  it('a walled steading holds where an open one is sacked', { timeout: 120_000 }, () => {
    const tally = {
      walled: { won: 0, alive: 0, dead: 0, burned: 0, stolen: 0 },
      open: { won: 0, alive: 0, dead: 0, burned: 0, stolen: 0 },
    };

    for (const seed of SEEDS) {
      for (const [name, palisade] of [['walled', true], ['open', false]] as const) {
        const r = fightRaid(seed, palisade);
        const t = tally[name];
        if (r.won) t.won++;
        t.alive += r.standing;
        t.dead += r.dead;
        t.burned += r.lostBuildings;
        t.stolen += r.stolen;
      }
    }

    const palisade = buildingById('palisade')!;
    // eslint-disable-next-line no-console
    console.log(
      `over ${SEEDS.length} raids — walled: ${tally.walled.won} held, ${tally.walled.alive} alive, ` +
        `${tally.walled.dead} dead, ${tally.walled.burned} burned, ${tally.walled.stolen} stolen | ` +
        `open: ${tally.open.won} held, ${tally.open.alive} alive, ${tally.open.dead} dead, ` +
        `${tally.open.burned} burned, ${tally.open.stolen} stolen ` +
        `(palisade costs ${palisade.timber} timber, ${palisade.works} days)`,
    );

    // THIS is the milestone. The wall has to hold the line more often and
    // keep more of your people and your store, by enough to be worth eight
    // timber and a week of somebody's hands.
    expect(tally.walled.won).toBeGreaterThan(tally.open.won);
    expect(tally.walled.alive).toBeGreaterThan(tally.open.alive);
    expect(tally.walled.dead).toBeLessThan(tally.open.dead);
    expect(tally.walled.burned).toBeLessThan(tally.open.burned);
    expect(tally.walled.stolen).toBeLessThan(tally.open.stolen);
    // What the wall saves in one run of raids dwarfs what it cost to raise.
    expect(tally.open.stolen - tally.walled.stolen).toBeGreaterThan(palisade.timber);
    // But it is a mitigation, not an off-switch: a raid still gets through.
    expect(tally.walled.won).toBeLessThan(SEEDS.length);
  });
});

// --- Losing ---

describe('a sacked steading', () => {
  it('loses a share of the store, a building, and its watch', () => {
    const state = stocked('sack-1', true);
    state.settlement!.watch = 5;
    const food = state.party.food;
    const wood = state.party.firewood;
    const built = [...state.settlement!.built];

    const sack = sackSteading(state);
    expect(sack.food).toBe(Math.round(food * SACK_SHARE));
    expect(sack.firewood).toBe(Math.round(wood * SACK_SHARE));
    expect(state.party.food).toBe(food - sack.food);
    expect(state.settlement!.built.length).toBe(built.length - 1);
    expect(sack.burned).toBeTruthy();
    expect(state.settlement!.watch).toBe(0);
    expect(state.saga.some((e) => e.tone === 'grim' && e.text.includes(state.settlement!.name)))
      .toBe(true);
  });

  it('burns the roof last — everything else goes first', () => {
    for (const seed of ['burn-a', 'burn-b', 'burn-c', 'burn-d']) {
      const state = stocked(seed, true);
      const sack = sackSteading(state);
      expect(sack.burned).not.toBe('longhouse');
      expect(state.settlement!.built).toContain('longhouse');
    }
  });

  it('takes the burned building\'s shelter with it', () => {
    const state = settled('burn-shelter');
    state.settlement!.built.push('longhouse');
    state.settlement!.shelter = 3;
    sackSteading(state);
    expect(state.settlement!.built).toHaveLength(0);
    expect(state.settlement!.shelter).toBe(0);
    expect(builtIn(state.settlement!)).toHaveLength(0);
  });

  it('losing a raid sacks the steading, and losing a field fight does not', () => {
    const raided = stocked('lose-raid', false);
    const built = raided.settlement!.built.length;
    startRaid(raided, 4);
    raided.battle!.outcome = 'lost';
    const afterRaid = apply(raided, { type: 'B_LEAVE' });
    expect(afterRaid.settlement!.built.length).toBeLessThan(built);

    const field = stocked('lose-field', false);
    const fieldBuilt = field.settlement!.built.length;
    const foodBefore = field.party.food;
    // A plain fight, away from the steading and with nothing of it at stake.
    field.party.at = { q: field.settlement!.at.q + 4, r: field.settlement!.at.r };
    const fought = apply(field, { type: 'MOVE', to: field.party.at });
    void fought;
    startBattle(field, 'meadow', 0);
    field.battle!.outcome = 'lost';
    const afterField = apply(field, { type: 'B_LEAVE' });
    expect(afterField.settlement!.built.length).toBe(fieldBuilt);
    expect(afterField.party.food).toBe(foodBefore);
  });

  it('holding the ground keeps everything', () => {
    const state = stocked('hold', true);
    const built = [...state.settlement!.built];
    const food = state.party.food;
    startRaid(state, 0);
    state.battle!.outcome = 'won';
    for (const c of state.battle!.combatants) if (c.side === 'foe') c.down = true;
    const after = apply(state, { type: 'B_LEAVE' });
    expect(after.settlement!.built).toEqual(built);
    // Won fields yield loot rather than losing it.
    expect(after.party.food).toBeGreaterThanOrEqual(food);
    expect(after.saga.some((e) => e.text.includes('broke on'))).toBe(true);
  });
});

// --- Triggering ---

describe('raids arrive', () => {
  it('there are raid cards, and they only fire at a steading you are standing in', () => {
    const raidCards = EVENTS.filter((e) =>
      e.choices.some((c) =>
        [c.success, c.failure].some((o) => o?.effects.some((f) => f.t === 'raid')),
      ),
    );
    expect(raidCards.length).toBeGreaterThanOrEqual(3);

    const wandering = structuredClone(newGame('raid-nohome'));
    wandering.day = 40;
    for (const def of raidCards) expect(isEligible(wandering, def), def.id).toBe(false);

    const home = settled('raid-home');
    home.day = 40;
    expect(raidCards.some((def) => isEligible(home, def))).toBe(true);

    // Standing away from the steading, nobody raids the empty hall.
    home.party.at = { q: home.settlement!.at.q + 3, r: home.settlement!.at.r };
    for (const def of raidCards) expect(isEligible(home, def), `away: ${def.id}`).toBe(false);
  });

  it('nobody crosses the country for a hovel on day one', () => {
    const state = settled('raid-early');
    state.day = 2;
    const raidCards = EVENTS.filter((e) =>
      e.choices.some((c) =>
        [c.success, c.failure].some((o) => o?.effects.some((f) => f.t === 'raid')),
      ),
    );
    for (const def of raidCards) expect(isEligible(state, def), def.id).toBe(false);
    expect(RAID_EARLIEST_DAY).toBeGreaterThan(1);
  });

  it('the bigger the prize, the more of them come — and a watch takes the edge off', () => {
    const bare = settled('raid-scale');
    bare.party.food = 0;
    const rich = settled('raid-scale');
    rich.settlement!.built.push('longhouse', 'farmplots', 'smokehouse', 'meadhall');
    rich.party.food = 200;
    expect(raidDifficulty(rich)).toBeGreaterThan(raidDifficulty(bare));

    const watched = structuredClone(rich);
    watched.settlement!.watch = 6;
    watched.settlement!.built.push('palisade');
    expect(raidDifficulty(watched)).toBeLessThan(raidDifficulty(rich));
  });

  it('a raid round-trips through a save', () => {
    const state = stocked('raid-save', true);
    startRaid(state, 0);
    const round = JSON.parse(encode(state)) as GameState;
    expect(round.battle!.raid).toBe(true);
    expect(round.battle!.grid).toEqual(state.battle!.grid);
  });

  it('a v9 save comes forward with no raid in progress', () => {
    const { save } = migrate({ version: 9, battle: { terrain: 'meadow' } });
    expect(save['version']).toBe(SAVE_VERSION);
    expect((save['battle'] as { raid?: boolean }).raid).toBeUndefined();
  });
});

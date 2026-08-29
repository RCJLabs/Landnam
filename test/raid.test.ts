// 3.5: raids on the steading. The bar is that the palisade earns its lumber,
// so the centre of this file runs the same raid on the same steading with and
// against without one, and weighs the difference against what it cost.

import { settled as settleSomewhere } from './fixtures/settle';
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { encode } from '../src/state/save';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { EVENTS } from '../src/data/events';
import { buildingById } from '../src/data/buildings';
import { apply } from '../src/sim/actions';
import { isEligible } from '../src/sim/events';
import { assign, standing as builtIn } from '../src/sim/colony';
import { activeCombatant, standing, strikeTargets } from '../src/sim/battle';
import { startBattle, startRaid } from '../src/sim/battleTurn';
import { throwTargets } from '../src/sim/strike';
import { fighterPerson } from '../src/sim/battle';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FRONT_WIDTH,
  MIDDLE_ROWS,
  WALL_ROW,
  groundCost,
  isPassable,
  pickRaidField,
  steadingFieldFrom,
  widestStand,
  cell,
} from '../src/sim/battlefield';
import { RAID_FIELDS } from '../src/data/raidFields';
import { MAX_RAIDERS_FAMED } from '../src/sim/battle';
import { SWORN_MAX } from '../src/sim/people';
import { makeRng } from '../src/rng';
import { raidDifficulty, RAID_EARLIEST_DAY, SACK_SHARE, sackSteading } from '../src/sim/raid';
import { living } from '../src/sim/people';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';

const CREW: JobId[] = ['farmer', 'farmer', 'woodcutter', 'hunter', 'builder', 'warrior'];

/** Offset row of an axial hex, matching offsetToAxial in the hex library. */

function settled(seed: string, radius = 14): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed, { radius });
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
  // Two thousand, not nine hundred. This is a cap on APPLY CALLS, not on
  // rounds — the engine ends a grinding fight at ROUND_LIMIT (50) and decides
  // it on who is upright. Item 5 made defenders survive long enough to
  // actually reach that limit: a walled steading now stands in the yard for
  // forty rounds instead of dying in fifteen, which at roughly twenty-four
  // calls a round ran the old cap out mid-fight and left `aftermath`
  // undefined. Sized off ROUND_LIMIT rather than guessed.
  for (let i = 0; i < 2000 && !cur.battle?.outcome; i++) {
    const battle = cur.battle!;
    const active = activeCombatant(battle);
    if (!active || active.side !== 'warband') {
      cur = apply(cur, { type: 'B_END_TURN' });
      continue;
    }
    const foes = standing(battle, 'foe');
    const adjacent = strikeTargets(cur);
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
    if (foes.length > 0) {
      // The bot used to score ground: stay near your mates, keep a gap, and
      // above all do not climb out over your own palisade. On a line none of
      // that is a choice about WHERE to stand — the only place to go is up
      // the ranks — so it pushes forward and the palisade rule is carried by
      // the line itself rather than by refusing to leave a row.
      const pushed = apply(cur, { type: 'B_DASH', by: -1 });
      cur = pushed === cur ? apply(cur, { type: 'B_END_TURN' }) : pushed;
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

    // The hall stands in the yard. Authored fields place it where they like
    // along the yard row and there is exactly one of it.
    //
    // "...and nobody deploys inside it" used to be checked here and cannot
    // be any more: since 8.1d nobody deploys anywhere, because a fighter's
    // place is his rank. The grid survives only to say whether the stakes
    // were up (see `atThePalisade`), and since 8.5 it is a plain rectangle
    // rather than a hex lattice.
    const yardBlocks = Array.from({ length: FIELD_WIDTH }, (_, col) =>
      cell(col, FIELD_HEIGHT - 1),
    ).filter((i) => battle.grid[i]!.ground === 'block');
    expect(yardBlocks).toHaveLength(1);
  });

  it('raises the palisade only if one was built, with a gate in it', () => {
    const walled = stocked('ground-wall', true);
    startRaid(walled, 0);
    const open = stocked('ground-wall', false);
    startRaid(open, 0);

    const wallRow = (state: GameState) =>
      Array.from({ length: FIELD_WIDTH }, (_, col) =>
        state.battle!.grid[cell(col, WALL_ROW)]!.ground,
      );

    // Authored fields may end the wall against water or trees, so the line
    // is "most of the row" rather than all-but-one — but there is still
    // exactly one way through that is neither a climb nor a swim.
    const walls = wallRow(walled).filter((g) => g === 'wall').length;
    expect(walls).toBeGreaterThanOrEqual(4);
    expect(wallRow(walled).filter((g) => g !== 'wall' && isPassable(g))).toHaveLength(1);
    expect(wallRow(open).filter((g) => g === 'wall')).toHaveLength(0);
  });

  it('fights different raids on different ground, and a replay on the same', () => {
    // The whole complaint item 7 answers: every raid read as the last one.
    // Across steadings the approach varies; replayed, it must not.
    const a = stocked('ground-vary-0', true);
    const b = structuredClone(a);
    startRaid(a, 0);
    startRaid(b, 0);
    expect(a.battle!.log[0]).toBe(b.battle!.log[0]);

    const openings = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const state = stocked(`ground-vary-${i}`, true);
      startRaid(state, 0);
      openings.add(state.battle!.log[0]!.split('.')[0]!);
    }
    expect(openings.size).toBeGreaterThan(1);
  });

  it('slows them rather than stopping them — a sealed field would strand the AI', () => {
    expect(Number.isFinite(groundCost('wall'))).toBe(true);
    expect(groundCost('wall')).toBeGreaterThan(groundCost('rough'));
    expect(isPassable('wall')).toBe(true);
  });
});

// --- Content lint: the authored fields ---
//
// The fields are data, so like the event deck they get a lint instead of
// trust. Every promise the procedural field used to enforce in code is
// asserted here against every map, walled and unwalled — a map that breaks
// one cannot ship.

describe('content lint: raid fields', () => {
  it('ids are unique and slug-shaped, and every field says how they came', () => {
    const ids = RAID_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const field of RAID_FIELDS) {
      expect(field.id).toMatch(/^[a-z0-9-]+$/);
      expect(field.line.length, field.id).toBeGreaterThan(15);
    }
  });

  it('is shaped like the battlefield, in legal marks only', () => {
    for (const field of RAID_FIELDS) {
      expect(field.rows, field.id).toHaveLength(FIELD_HEIGHT);
      for (const row of field.rows) expect(row, field.id).toMatch(/^[.,#~=GH]{7}$/);
      // One gate, on the wall line; one hall, in the yard; the wall only
      // ever runs along its own row.
      const flat = field.rows.join('');
      expect(flat.split('G'), field.id).toHaveLength(2);
      expect(flat.split('H'), field.id).toHaveLength(2);
      expect(field.rows[WALL_ROW]!.includes('G'), field.id).toBe(true);
      expect(field.rows[FIELD_HEIGHT - 1]!.includes('H'), field.id).toBe(true);
      field.rows.forEach((row, i) => {
        if (i !== WALL_ROW) expect(row.includes('='), `${field.id} row ${i}`).toBe(false);
      });
    }
  });

  it('keeps every promise, walled and unwalled', () => {
    for (const field of RAID_FIELDS) {
      for (const palisade of [true, false]) {
        const label = `${field.id} ${palisade ? 'walled' : 'open'}`;
        const { grid, warbandSpots, foeSpots } = steadingFieldFrom(field, palisade);

        // Room for the biggest raid the game can send, and for six sworn.
        const passableAt = (i: number) => isPassable(grid[i]?.ground ?? 'block');
        expect(foeSpots.filter(passableAt).length, label).toBeGreaterThanOrEqual(MAX_RAIDERS_FAMED);
        expect(warbandSpots.filter(passableAt).length, label).toBeGreaterThanOrEqual(SWORN_MAX);

        // A way in that needs no climbing: some column runs clear from the
        // raiders' edge through the wall line.
        const lane = Array.from({ length: FIELD_WIDTH }, (_, col) =>
          Array.from({ length: WALL_ROW + 1 }, (_, row) => grid[cell(col, row)]!.ground)
            .every((g) => g !== 'wall' && isPassable(g)),
        );
        expect(lane.some(Boolean), `${label}: no gate lane`).toBe(true);

        // Ground a line can form on, and a field that can be crossed at all.
        const widest = Math.max(...MIDDLE_ROWS.map((row) => widestStand(grid, row)));
        expect(widest, `${label}: nowhere to form up`).toBeGreaterThanOrEqual(FRONT_WIDTH);
        const crossable = Array.from({ length: FIELD_WIDTH }, (_, col) =>
          MIDDLE_ROWS.every((row) => isPassable(grid[cell(col, row)]!.ground)),
        );
        expect(crossable.some(Boolean), `${label}: cannot be crossed`).toBe(true);
      }
    }
  });

  it('never offers the sea to a dry steading, and always has something to offer', () => {
    // At least two fields must fit ANY steading, or the picker collapses to
    // one map and the raids blur again the day somebody edits the data.
    expect(RAID_FIELDS.filter((f) => !f.needs).length).toBeGreaterThanOrEqual(2);

    const rng = makeRng('field-pick');
    for (let i = 0; i < 20; i += 1) {
      const dry = pickRaidField(['field', 'rough'], rng.derive(`dry-${i}`));
      expect(dry.needs, dry.id).not.toBe('water');
      expect(dry.needs, dry.id).not.toBe('wood');
    }
    const wet = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      wet.add(pickRaidField(['water', 'wood', 'field'], rng.derive(`wet-${i}`)).id);
    }
    // A steading that has the ground can draw the fields that need it.
    expect([...wet].some((id) => RAID_FIELDS.find((f) => f.id === id)?.needs)).toBe(true);
  });

  it('leaves a way in that does not need climbing', () => {
    for (const seed of ['gate-a', 'gate-b', 'gate-c']) {
      const state = stocked(seed, true);
      startRaid(state, 0);
      const grid = state.battle!.grid;
      // Some column runs from the raiders' edge to the wall row without a
      // climb, or the gate is not actually the fast way in.
      const clear = Array.from({ length: FIELD_WIDTH }, (_, col) =>
        Array.from({ length: WALL_ROW + 1 }, (_, row) => grid[cell(col, row)]!.ground)
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
    // THE SUBJECT USED TO BE THE LONGHOUSE, and that made this file assert
    // two opposite things: the test above says the longhouse survives a
    // sacking, and this one said a lone longhouse burns — because
    // `sackSteading` fell back to `home.built[0]` when it had nothing else
    // to fire, undoing the rule its own comment stated two lines earlier.
    // Raids were rare enough that no steading was ever stripped to its roof,
    // so nothing noticed until autumn became a reckoning.
    //
    // The claim here is about SHELTER following the building that burns, so
    // it is made on a building that can actually burn.
    const state = settled('burn-shelter');
    state.settlement!.built = ['bud'];
    const roof = buildingById('bud')!.shelter ?? 0;
    expect(roof).toBeGreaterThan(0);
    state.settlement!.shelter = roof + 2;
    const sack = sackSteading(state);
    // The drop is what burned, not a number that happened to match.
    expect(sack.burned).toBe('bud');
    expect(state.settlement!.built).toHaveLength(0);
    expect(state.settlement!.shelter).toBe(2);
    expect(builtIn(state.settlement!)).toHaveLength(0);
  });

  it('leaves a band its roof and its mead hall, however often they come', () => {
    // Nothing to fire but the two that are spared, so nothing is fired. The
    // stores and the people still go: a sacking is a loss, not a locked door.
    const state = settled('burn-nothing');
    state.settlement!.built = ['longhouse', 'meadhall'];
    state.party.food = 200;
    const sack = sackSteading(state);
    expect(sack.burned).toBeUndefined();
    expect(state.settlement!.built).toEqual(['longhouse', 'meadhall']);
    expect(sack.food).toBeGreaterThan(0);
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
    field.party.stop = (field.settlement!.stop ?? 0) + 4;
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
  it('there are raid cards, and they need a steading to come for', () => {
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

    // And since 4.2, a hall whose warriors are three days out is exactly the
    // one worth coming for — that is the cost of sending them.
    home.party.stop = (home.settlement!.stop ?? 0) + 3;
    expect(raidCards.some((def) => isEligible(home, def))).toBe(true);
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

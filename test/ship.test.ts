// The knarr, now that she is a thing.
//
// She was one boolean. The point of these is not that a ship exists — it is
// that every number on her BITES, which is the failure the Thing's checklist
// was just caught in: `peace` and `gathered` are needs met by 78 settled
// sagas out of 78, requirements that never once refused anybody. A hold that
// never caps a load, or a strake that never costs a day, would be the same
// mistake with a sail on it.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import {
  hold,
  holdShare,
  holed,
  makeShip,
  mendCost,
  mendStrake,
  springStrake,
  sprung,
  unseaworthy,
} from '../src/sim/ship';
import { HOLD_PER_STRAKE, HOLD_WHOLE, SHIP_STRAKES, STRAKE_MEND_WOOD } from '../src/data/ships';
import { launch, provisionsFor } from '../src/sim/expedition';
import { isCoastalWater, moveEffort } from '../src/sim/road';
import { fromKey } from '../src/hex';
import type { GameState } from '../src/state/types';

describe('she is a ship, and she is hers', () => {
  it('comes with a name off the run seed, and the same one every time', () => {
    const a = newGame('knarr-name');
    const b = newGame('knarr-name');
    expect(a.ship.name.length).toBeGreaterThan(0);
    expect(a.ship.name).toBe(b.ship.name);
    expect(a.ship.strakes).toBe(SHIP_STRAKES);
    // Two different sagas should not always be sailing the same hull.
    const names = new Set(
      Array.from({ length: 40 }, (_, i) => makeShip(`hull-${i}`).name),
    );
    expect(names.size).toBeGreaterThan(3);
  });
});

describe('the strakes grade, and every one of them costs something', () => {
  it('springs one at a time and never past nothing', () => {
    const ship = makeShip('spring');
    for (let i = 0; i < SHIP_STRAKES + 3; i += 1) springStrake(ship);
    expect(ship.strakes).toBe(0);
    expect(unseaworthy(ship)).toBe(true);
    expect(sprung(ship)).toBe(SHIP_STRAKES);
  });

  it('costs a day on the water for each one, not merely for the first', () => {
    // The old `hullHoled` was one bit: holed or not, and a second bad fight
    // was free. This is the difference the grading buys.
    const state = structuredClone(newGame('knarr-pace'));
    const water = Object.keys(state.world.tiles)
      .map(fromKey)
      .find((at) => isCoastalWater(state, at));
    expect(water, 'no coastal water to price').toBeTruthy();

    const sound = moveEffort(state, water!)!;
    springStrake(state.ship);
    const one = moveEffort(state, water!)!;
    springStrake(state.ship);
    const two = moveEffort(state, water!)!;

    expect(one).toBeGreaterThan(sound);
    expect(two, 'the second strake was free — the flag is back').toBeGreaterThan(one);
  });

  it('will not be rowed with nothing sound left, and land does not care', () => {
    const state = structuredClone(newGame('knarr-dead'));
    const water = Object.keys(state.world.tiles)
      .map(fromKey)
      .find((at) => isCoastalWater(state, at));
    const land = Object.entries(state.world.tiles)
      .find(([, t]) => t.terrain === 'meadow')![0];
    expect(moveEffort(state, water!)).not.toBeNull();
    state.ship.strakes = 0;
    expect(moveEffort(state, water!)).toBeNull();
    // SHORT OF SUNK. The run does not end on the water: the hull that cannot
    // be rowed can still be walked away from, because coastal water always
    // touches ground.
    expect(moveEffort(state, fromKey(land))).not.toBeNull();
  });
});

describe('the hold holds something', () => {
  it('shrinks with every sprung strake', () => {
    const ship = makeShip('hold');
    expect(hold(ship)).toBe(HOLD_WHOLE);
    expect(holdShare(ship)).toBe(1);
    springStrake(ship);
    expect(hold(ship)).toBe(HOLD_WHOLE - HOLD_PER_STRAKE);
    expect(holdShare(ship)).toBeLessThan(1);
  });

  it('holds more than the backs aboard her, or the strandhogg is a lie', () => {
    // `STRAND_HAUL`'s comment has said "the hold takes more than backs can
    // carry" since the sea work. A whole hull has to actually beat six backs
    // or that sentence is decoration.
    expect(hold(makeShip('roomy'))).toBeGreaterThan(provisionsFor(6));
  });

  it('caps what an errand carries once she is hurt — and only then', () => {
    const sound = settled('knarr-load');
    const hurt = structuredClone(sound);
    springStrake(hurt.ship);
    springStrake(hurt.ship);

    const crew = sound.party.people.filter((p) => p.alive).slice(0, 3).map((p) => p.id);
    sound.party.food = 200;
    hurt.party.food = 200;

    expect(launch(sound, crew, 'raid')).toBe(true);
    expect(launch(hurt, hurt.party.people.filter((p) => p.alive).slice(0, 3).map((p) => p.id), 'raid')).toBe(true);

    // A sound hull is not the constraint — the backs are, exactly as before.
    expect(sound.expedition!.carried).toBe(provisionsFor(3));
    // A sprung one is.
    expect(hurt.expedition!.carried).toBeLessThan(sound.expedition!.carried);
    expect(hurt.expedition!.carried).toBe(hold(hurt.ship));
  });
});

describe('mending her', () => {
  it('takes a night and timber per strake, and says what it will cost', () => {
    const state = structuredClone(newGame('knarr-mend'));
    springStrake(state.ship);
    springStrake(state.ship);
    expect(mendCost(state.ship)).toBe(2 * STRAKE_MEND_WOOD);

    state.party.firewood = 10;
    expect(mendStrake(state)).toBe(true);
    expect(sprung(state.ship)).toBe(1);
    expect(state.party.firewood).toBe(10 - STRAKE_MEND_WOOD);
    expect(mendStrake(state)).toBe(true);
    expect(holed(state.ship)).toBe(false);
    // Whole is whole: there is nothing further to do to her.
    expect(mendStrake(state)).toBe(false);
  });

  it('refuses with no timber, and leaves her exactly as she was', () => {
    const state = structuredClone(newGame('knarr-nowood'));
    springStrake(state.ship);
    state.party.firewood = STRAKE_MEND_WOOD - 1;
    expect(mendStrake(state)).toBe(false);
    expect(sprung(state.ship)).toBe(1);
    expect(state.party.firewood).toBe(STRAKE_MEND_WOOD - 1);
  });
});

describe('old saves', () => {
  it('come forward sailing the hull they were saved with', () => {
    const holedSave = structuredClone(newGame('knarr-old-holed')) as unknown as Record<string, unknown>;
    holedSave['version'] = 31;
    (holedSave['party'] as Record<string, unknown>)['hullHoled'] = true;
    delete holedSave['ship'];
    const out = migrate(holedSave).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect((out['ship'] as { strakes: number }).strakes).toBe(SHIP_STRAKES - 1);
    expect((out['party'] as { hullHoled?: boolean }).hullHoled).toBeUndefined();
  });

  it('come forward whole when the flag was never set', () => {
    const save = structuredClone(newGame('knarr-old-sound')) as unknown as Record<string, unknown>;
    save['version'] = 31;
    delete save['ship'];
    const out = migrate(save).save;
    expect((out['ship'] as { strakes: number }).strakes).toBe(SHIP_STRAKES);
  });
});

/** A state with posts in the ground, so an errand can be launched from it. */
function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  return state;
}

/**
 * THE LORE'S PROMISE, AND WHY IT NEEDED A SECOND HALF.
 *
 * "Shipwright's eye" carried `sea: 1` and a gain line reading "A day on the
 * water costs less than it did". Measured on 2026-08-19, that was false for
 * a sound hull in three seasons out of four, and STRUCTURALLY so rather than
 * by a tuning accident: a hex costs `ceil(effort / 2)` days with a floor of
 * one, a sound hull in fair weather is effort 2, and one day is already the
 * floor. No reduction can beat it. The knob only bought a day when a travel
 * penalty made the effort odd — which means winter.
 *
 * So the lore mends now, which is what a shipwright does and what the ship
 * work of item 7 gave it something to do.
 */
describe("the shipwright's eye", () => {
  it('cannot buy a day on a sound hull in fair weather, which is why it also mends', () => {
    // The arithmetic stated outright, so a later change to SEA_EFFORT or to
    // the effort-to-days rule has to come and argue with it.
    const days = (effort: number): number => Math.max(1, Math.ceil(effort / 2));
    expect(days(2), 'a sound hull in fair weather').toBe(1);
    expect(days(2 - 1), 'and the same with the lore').toBe(1);
    // Odd effort — winter's travel penalty — is where it does pay.
    expect(days(3)).toBe(2);
    expect(days(3 - 1)).toBe(1);
  });

  it('puts two strakes right in a night, for two strakes of timber', () => {
    const state = structuredClone(newGame('knarr-wright'));
    springStrake(state.ship);
    springStrake(state.ship);
    state.party.firewood = 20;
    state.lore = ['shipwright'];

    expect(mendStrake(state)).toBe(true);
    expect(holed(state.ship), 'a shipwright still needed two nights').toBe(false);
    expect(state.party.firewood, 'the second strake was free').toBe(20 - 2 * STRAKE_MEND_WOOD);
  });

  it('still only mends what there is timber for', () => {
    const state = structuredClone(newGame('knarr-wright-poor'));
    springStrake(state.ship);
    springStrake(state.ship);
    state.party.firewood = STRAKE_MEND_WOOD;
    state.lore = ['shipwright'];
    expect(mendStrake(state)).toBe(true);
    expect(sprung(state.ship), 'timber it did not have was spent').toBe(1);
    expect(state.party.firewood).toBe(0);
  });

  it('leaves a band that never learned it mending one a night', () => {
    const state = structuredClone(newGame('knarr-nowright'));
    springStrake(state.ship);
    springStrake(state.ship);
    state.party.firewood = 20;
    expect(mendStrake(state)).toBe(true);
    expect(sprung(state.ship)).toBe(1);
  });
});

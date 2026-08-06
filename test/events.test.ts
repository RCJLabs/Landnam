import { describe, it, expect } from 'vitest';
import { EVENTS, eventById } from '../src/data/events';
import { TRAITS, traitById } from '../src/data/traits';
import { LAND_TERRAINS, terrainDef } from '../src/data/terrain';
import { checkOdds, isEligible, presentEvent } from '../src/sim/events';
import { newGame } from '../src/state/create';
import { apply } from '../src/sim/actions';
import { moveOptions } from '../src/sim/travel';
import { encode } from '../src/state/save';
import type { GameState, Terrain } from '../src/state/types';

const ALL_TERRAIN: Terrain[] = ['ocean', ...LAND_TERRAINS];
const SEASONS = ['summer', 'autumn', 'winter', 'spring'];
const STATS = ['might', 'wits', 'spirit', 'craft'];

describe('content lint: events', () => {
  it('ids are unique and slug-shaped', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('ships at least fifteen events', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(15);
  });

  it('every event is well formed', () => {
    for (const event of EVENTS) {
      expect(event.title.length, event.id).toBeGreaterThan(0);
      expect(event.body.length, event.id).toBeGreaterThan(20);
      expect(event.weight, event.id).toBeGreaterThan(0);
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(1);
      expect(event.choices.length, event.id).toBeLessThanOrEqual(4);

      for (const choice of event.choices) {
        expect(choice.label.length, event.id).toBeGreaterThan(0);
        expect(choice.success.text.length, event.id).toBeGreaterThan(0);
        if (choice.check) {
          // A check without a failure branch is a silent always-success bug.
          expect(choice.failure, `${event.id}: checked choice needs a failure`).toBeDefined();
          expect(STATS).toContain(choice.check.stat);
          // 2d6 + a best-of-band stat (typically 4-6) meets DC 11 about
          // seven times in ten and DC 14 about three. Outside 10..16 a
          // check is either a formality or a punishment.
          expect(choice.check.dc, event.id).toBeGreaterThanOrEqual(10);
          expect(choice.check.dc, event.id).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  it('every condition references real terrain and seasons', () => {
    for (const event of EVENTS) {
      for (const condition of event.when ?? []) {
        if (condition.c === 'terrain') {
          for (const terrain of condition.any) expect(ALL_TERRAIN, event.id).toContain(terrain);
        }
        if (condition.c === 'season') {
          for (const season of condition.any) expect(SEASONS, event.id).toContain(season);
        }
        if (condition.c === 'dayMin') expect(condition.day).toBeGreaterThan(0);
      }
    }
  });

  it('every effect is a known shape with sane numbers', () => {
    const known = [
      'food', 'firewood', 'morale', 'wound', 'heal', 'injure', 'kill', 'flag', 'reveal', 'battle',
      'raid', 'standing',
    ];
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        for (const branch of [choice.success, choice.failure]) {
          if (!branch) continue;
          for (const effect of branch.effects) {
            expect(known, `${event.id}: ${effect.t}`).toContain(effect.t);
            if (effect.t === 'wound') {
              expect(effect.n).toBeGreaterThan(0);
              if (effect.count !== undefined) expect(effect.count).toBeGreaterThan(0);
            }
            if (effect.t === 'reveal') expect(effect.radius).toBeGreaterThan(0);
            if (effect.t === 'standing') {
              // A single card must not be able to swing a whole standing band
              // from hostile to sworn.
              expect(Math.abs(effect.n), event.id).toBeLessThanOrEqual(35);
              expect(effect.n, event.id).not.toBe(0);
            }
            if ((effect.t === 'battle' || effect.t === 'raid') && effect.difficulty !== undefined) {
              // Difficulty shifts the foe count; anything wilder is a typo.
              expect(effect.difficulty, event.id).toBeGreaterThanOrEqual(-2);
              expect(effect.difficulty, event.id).toBeLessThanOrEqual(2);
            }
          }
        }
      }
    }
  });
});

describe('content lint: traits and terrain', () => {
  it('trait ids are unique and resolvable', () => {
    const ids = TRAITS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(traitById(id)).toBeDefined();
    for (const trait of TRAITS) {
      expect(trait.blurb.length).toBeGreaterThan(0);
      expect(trait.tags.length).toBeGreaterThan(0);
    }
  });

  it('every terrain has a definition and land is walkable', () => {
    for (const terrain of ALL_TERRAIN) {
      const def = terrainDef(terrain);
      expect(def.id).toBe(terrain);
      expect(def.fill).toMatch(/^#[0-9a-f]{6}$/i);
      if (terrain === 'ocean') expect(Number.isFinite(def.cost)).toBe(false);
      else expect(def.cost).toBeGreaterThan(0);
    }
  });
});

describe('stat checks', () => {
  it('odds rise with the stat and stay bounded', () => {
    for (let dc = 5; dc <= 12; dc++) {
      let previous = -1;
      for (let stat = 1; stat <= 6; stat++) {
        const odds = checkOdds(stat, dc);
        expect(odds).toBeGreaterThanOrEqual(previous);
        expect(odds).toBeGreaterThanOrEqual(0);
        expect(odds).toBeLessThanOrEqual(1);
        previous = odds;
      }
    }
  });

  it('matches the 2d6 distribution at the edges', () => {
    // DC 5 with stat 6 needs a roll of -1: impossible to fail.
    expect(checkOdds(6, 5)).toBe(1);
    // DC 12 with stat 1 needs 11+: (5,6) (6,5) (6,6) — three ways in 36.
    expect(checkOdds(1, 12)).toBeCloseTo(3 / 36, 5);
    // DC 12 with stat 0 needs 12: one way in 36.
    expect(checkOdds(0, 12)).toBeCloseTo(1 / 36, 5);
    // Needing 7+ is the classic 21-in-36.
    expect(checkOdds(0, 7)).toBeCloseTo(21 / 36, 5);
  });
});

describe('eligibility', () => {
  it('once-only events stop being eligible after they fire', () => {
    const state = newGame('once-seed');
    const def = eventById('standing-stones')!;
    const seen = structuredClone(state);
    seen.flags['seen_standing-stones'] = 1;
    expect(isEligible(seen, def)).toBe(false);
  });

  it('a winter event is ineligible in summer', () => {
    const state = newGame('season-seed');
    expect(state.day).toBe(1);
    expect(isEligible(state, eventById('hard-frost')!)).toBe(false);
  });

  it('no checked choice is a formality or a hopeless case', () => {
    // A fresh band is the benchmark: its best stat is what the player sees.
    const state = newGame('odds-seed');
    for (const def of EVENTS) {
      for (const choice of def.choices) {
        if (!choice.check) continue;
        const stat = Math.max(
          ...state.party.people.map((p) => p.stats[choice.check!.stat]),
        );
        const odds = checkOdds(stat, choice.check.dc);
        expect(odds, `${def.id}: "${choice.label}"`).toBeLessThan(0.95);
        expect(odds, `${def.id}: "${choice.label}"`).toBeGreaterThan(0.1);
      }
    }
  });

  it('cards present a hint for every checked choice', () => {
    const state = newGame('present-seed');
    for (const def of EVENTS) {
      const card = presentEvent(state, def);
      expect(card.choices).toHaveLength(def.choices.length);
      def.choices.forEach((choice, i) => {
        if (choice.check) expect(card.choices[i]!.hint, def.id).toMatch(/\d+%/);
        else expect(card.choices[i]!.hint).toBeUndefined();
      });
    }
  });
});

describe('events in play', () => {
  function playUntilEvent(seed: string, limit = 200): GameState | null {
    let state = newGame(seed);
    for (let i = 0; i < limit && !state.end; i++) {
      if (state.event) return state;
      const options = moveOptions(state);
      state = options[i % options.length]
        ? apply(state, { type: 'MOVE', to: options[i % options.length]! })
        : apply(state, { type: 'CAMP' });
    }
    return null;
  }

  it('events fire while travelling and resolve cleanly', () => {
    const state = playUntilEvent('event-fires');
    expect(state).not.toBeNull();
    const card = state!.event!;
    expect(card.choices.length).toBeGreaterThan(0);

    const chosen = apply(state!, { type: 'CHOOSE', index: 0 });
    expect(chosen.event?.outcome).toBeDefined();
    // The outcome is chronicled in the saga.
    expect(chosen.saga[chosen.saga.length - 1]!.text).toBe(chosen.event!.outcome!.text);

    const dismissed = apply(chosen, { type: 'DISMISS_EVENT' });
    if (!dismissed.end) expect(dismissed.event).toBeUndefined();
  });

  it('travel is blocked while a card is on the table', () => {
    const state = playUntilEvent('event-blocks');
    expect(state).not.toBeNull();
    const target = moveOptions(state!)[0]!;
    expect(apply(state!, { type: 'MOVE', to: target })).toBe(state);
    expect(apply(state!, { type: 'CAMP' })).toBe(state);
  });

  it('resolving the same choice twice from the same state is identical', () => {
    const state = playUntilEvent('event-determinism');
    expect(state).not.toBeNull();
    const a = apply(state!, { type: 'CHOOSE', index: 0 });
    const b = apply(state!, { type: 'CHOOSE', index: 0 });
    expect(encode(a)).toBe(encode(b));
  });

  it('a fired card always matches a real event definition', () => {
    for (const seed of ['card-a', 'card-b', 'card-c', 'card-d']) {
      const state = playUntilEvent(seed);
      if (!state) continue;
      const def = eventById(state.event!.id);
      expect(def, state.event!.id).toBeDefined();
      expect(state.event!.choices).toHaveLength(def!.choices.length);
    }
  });
});

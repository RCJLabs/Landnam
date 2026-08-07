// The console hand-hold.
//
// Lives here rather than in main.ts because it is not part of booting the
// game. It is a set of levers for testing and for poking at a run from a
// browser console: drop straight onto a battlefield rather than wandering
// until a combat event happens to fire, fill the store so a playtest can
// spend its days on the thing being tested, wind the calendar on rather than
// playing two years of turns honestly.
//
// main.ts was six hundred lines and every milestone added to it. This is the
// part with no business being in a boot router at all.

import { key } from './hex';
import { currentMode } from './modes';
import type { GameState } from './state/types';
import { startBattle, startRaid } from './sim/battleTurn';

/**
 * What the debug levers need from the app: the current state, a way to
 * replace it, and a way to redraw. Passing these in rather than reaching for
 * main.ts's module-level `state` is what lets this file exist separately at
 * all — and it means every lever goes through the same save-and-render path
 * the real game uses, instead of quietly inventing a second one.
 */
export interface DebugHooks {
  get(): GameState | null;
  /** Saves and redraws, exactly as a dispatch would. */
  commit(next: GameState): void;
}

declare global {
  interface Window {
    landnam?: {
      state(): GameState | null;
      fight(difficulty?: number): void;
      raid(difficulty?: number): void;
      visit(id?: string): void;
      stock(food?: number, firewood?: number): void;
      skip(days?: number): void;
    };
  }
}

export function installDebug(hooks: DebugHooks): void {
  /** Every lever works on a clone and hands it back, like a reducer would. */
  const onTravel = (change: (next: GameState) => boolean): void => {
    const state = hooks.get();
    if (!state || currentMode(state) !== 'TRAVEL') return;
    const next = structuredClone(state);
    if (change(next) === false) return;
    hooks.commit(next);
  };

  window.landnam = {
    state: () => hooks.get(),

    fight(difficulty = 0) {
      onTravel((next) => {
        const here = next.world.tiles[key(next.party.at)]?.terrain ?? 'meadow';
        startBattle(next, here, difficulty);
        return true;
      });
    },

    raid(difficulty = 0) {
      onTravel((next) => {
        if (!next.settlement) return false;
        next.party.at = { ...next.settlement.at };
        startRaid(next, difficulty);
        return true;
      });
    },

    // Stands the band in somebody else's yard, which otherwise takes a walk of
    // several days and the luck to have looked in the right direction.
    visit(id?: string) {
      onTravel((next) => {
        const target = id ? next.neighbours.find((n) => n.id === id) : next.neighbours[0];
        if (!target) return false;
        next.party.at = { ...target.at };
        target.found = true;
        return true;
      });
    },

    // Fills the store, so a playtest can spend its days on the thing being
    // tested rather than on not starving.
    stock(food = 200, firewood = 200) {
      const state = hooks.get();
      if (!state) return;
      const next = structuredClone(state);
      next.party.food = food;
      next.party.firewood = firewood;
      next.party.morale = Math.max(next.party.morale, 70);
      hooks.commit(next);
    },

    // Winds the calendar on. Reaching the endgame honestly is two years of
    // turns, which is a fine thing to ask of a player and a poor thing to ask
    // of a playtest.
    skip(days = 96) {
      onTravel((next) => {
        next.day += days;
        return true;
      });
    },
  };
}

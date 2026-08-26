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

import { cloneState } from './state/clone';
import { distance, fromKey, key } from './hex';
import { currentMode } from './modes';
import { wantPainting } from './render/oilFlag';
import { travelDrawn, travelSample } from './render/travelScreen';
import { steadingDrawn } from './render/colonyScreen';
import { fieldDrawn } from './render/battleScreen';
import type { GameState } from './state/types';
import { startBattle, startRaid } from './sim/battleTurn';
import { canFound, foundSettlement } from './sim/site';
import { COAST_IS_A_LINE } from './sim/flags';
import { learnStop, standingAt } from './sim/coast';
import { ROUTE_STOPS } from './sim/route';
import { buildingById, type BuildingId } from './data/buildings';

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
  /** Tears the travel view down and builds it again, keeping the run. */
  remount(): void;
}

declare global {
  interface Window {
    landnam?: {
      state(): GameState | null;
      fight(difficulty?: number): void;
      raid(difficulty?: number): void;
      visit(id?: string): void;
      settle(): boolean;
      build(id: string): boolean;
      stock(food?: number, firewood?: number): void;
      skip(days?: number): void;
      paint(on?: boolean | null): void;
      drawn(): unknown;
      steading(): unknown;
      field(): unknown;
      painted(points: readonly (readonly [number, number])[]): (number | null)[];
    };
  }
}

export function installDebug(hooks: DebugHooks): void {
  /** Every lever works on a clone and hands it back, like a reducer would. */
  const onTravel = (change: (next: GameState) => boolean): void => {
    const state = hooks.get();
    if (!state || currentMode(state) !== 'TRAVEL') return;
    const next = cloneState(state);
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

    /**
     * Puts the steading up wherever the band can put one up.
     *
     * Reaching the colony screen honestly means wandering until the ground is
     * right, which is a long walk for a test that only wants to look at the
     * steading. Walks out to the nearest ground that will take a hall rather
     * than forcing one where the rules say no, so what it settles is a
     * settlement the game would have allowed.
     */
    settle() {
      const state = hooks.get();
      if (!state || currentMode(state) !== 'TRAVEL' || state.settlement) return false;
      const next = cloneState(state);
      // On a coast the walk is along the line rather than across a map, so
      // the search is the same idea in the other coordinate system: outward
      // from where the band stands, marking each stretch learned — because
      // knowing the ground is one of the rules and this fabricates the walk
      // rather than waiving it.
      if (COAST_IS_A_LINE) {
        const from = standingAt(next);
        for (let stop = from; stop < ROUTE_STOPS; stop += 1) {
          learnStop(next, stop);
          next.party.stop = stop;
          if (canFound(next, next.party.at)) break;
        }
        if (!canFound(next, next.party.at)) return false;
        if (!foundSettlement(next)) return false;
        hooks.commit(next);
        return true;
      }
      if (!canFound(next, next.party.at)) {
        // Nearest first, so the steading lands somewhere the band could
        // plausibly have walked to rather than across the map.
        const here = next.party.at;
        const spot = Object.keys(next.world.tiles)
          .map((k) => fromKey(k))
          .sort((a, b) => distance(here, a) - distance(here, b))
          .find((at) => {
            // Standing on the ground is one of the rules, so the walk is
            // fabricated rather than waived: mark it seen, then ask.
            next.world.seen[key(at)] = 'seen';
            next.party.at = at;
            return canFound(next, at);
          });
        if (!spot) return false;
      }
      if (!foundSettlement(next)) return false;
      hooks.commit(next);
      return true;
    },

    /**
     * Raises a building outright, without the season of work.
     *
     * `scripts/hearth.mjs` is about whether raising a building CHANGES the
     * picture; how long it takes is the colony's business and is measured
     * elsewhere. Refuses a building the game does not know, so a typo in a
     * bar reads as a failure rather than as a steading that quietly gained
     * nothing.
     */
    build(id: string) {
      const state = hooks.get();
      if (!state?.settlement || !buildingById(id as BuildingId)) return false;
      const next = cloneState(state);
      const home = next.settlement!;
      if (home.built.includes(id)) return true;
      home.built.push(id);
      home.queue = home.queue.filter((q) => q !== id);
      hooks.commit(next);
      return true;
    },

    // Fills the store, so a playtest can spend its days on the thing being
    // tested rather than on not starving.
    stock(food = 200, firewood = 200) {
      const state = hooks.get();
      if (!state) return;
      const next = cloneState(state);
      next.party.food = food;
      next.party.firewood = firewood;
      next.party.morale = Math.max(next.party.morale, 70);
      hooks.commit(next);
    },

    // Paints the country instead of drawing it — art queue, oil renderer.
    // Takes effect on the next mount, so this remounts by hand rather than
    // pretending a live swap works.
    paint(on: boolean | null = true) {
      wantPainting(on);
      hooks.remount();
    },

    // What the map renderer is holding, in terms both backends can answer.
    // scripts/repaint.mjs reads this rather than counting SVG nodes, so the
    // same bar defends the painted map and the drawn one.
    drawn() {
      return travelDrawn();
    },

    // What the STEADING's brush has done: how many times it has been loaded,
    // and how many repaints reused the painting instead. scripts/steading.mjs
    // reads this — a kept painting and a remade one look identical.
    steading() {
      return steadingDrawn();
    },

    field() {
      return fieldDrawn();
    },

    // Brightness of the PAINTED country at world points. scripts/repaint.mjs
    // uses it to check the glaze tiles rather than stacks, which cannot be
    // asked of the screen: seeing a field big enough to measure means zooming
    // out, and zooming out is what blurs the seam away.
    painted(points) {
      return travelSample(points);
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

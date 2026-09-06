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

import { standsFor } from './sim/colony';
import { cloneState } from './state/clone';
import { currentMode } from './modes';
import { travelDrawn } from './render/travelScreen';
import { figure } from './render/figures';
import { svgEl } from './render/svg';
import { steadingDrawn } from './render/colonyScreen';
import { fieldDrawn } from './render/battleScreen';
import type { GameState } from './state/types';
import { startBattle, startRaid } from './sim/battleTurn';
import { canFound, foundSettlement, stopReport } from './sim/site';
import { weatherNow } from './sim/weather';
import { countryHere, learnStop, standingAt } from './sim/coast';
import { ROUTE_STOPS } from './sim/route';
import { buildingById, type BuildingId } from './data/buildings';
import { JOBS, type JobId } from './data/jobs';

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
      sky(): string | null;
      work(job?: string | null): boolean;
      fight(difficulty?: number): void;
      raid(difficulty?: number): void;
      visit(id?: string): void;
      settle(): boolean;
      standOn(from: number, to: number): number | null;
      build(id: string): boolean;
      stock(food?: number, firewood?: number): void;
      skip(days?: number): void;
      drawn(): unknown;
      steading(): unknown;
      field(): unknown;
      /** Two men at a given size, one whole and one at a third. 12.15. */
      twoMen(px: number): void;
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

    // Today's sky, by its id. `scripts/procession.mjs` steers by this to
    // find a gale day and then asks whether the WINDOW shows one — the sim
    // is deterministic about the sky, and the bar should not have to parse
    // a localized label out of the top bar to know what it is standing in.
    sky: () => {
      const state = hooks.get();
      return state ? weatherNow(state).id : null;
    },

    fight(difficulty = 0) {
      onTravel((next) => {
        startBattle(next, countryHere(next), difficulty);
        return true;
      });
    },

    raid(difficulty = 0) {
      onTravel((next) => {
        if (!next.settlement) return false;
        next.party.stop = next.settlement.stop ?? 0;
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
        next.party.stop = target.stop ?? 0;
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
    /**
     * Walks the band to the first stretch whose site total falls in
     * `[from, to)` and stands them on it, without founding.
     *
     * 12.6, and it exists for the reason `visit()` does: the founding card's
     * record speaks only on ground totalling 12 or 13, and reaching such a
     * stretch by playing is several days' walk and the luck to have looked in
     * the right direction. The walk is FABRICATED, not waived — each stretch
     * is learned on the way, because knowing the ground is one of the rules
     * and `foundBlocker` refuses an unknown one.
     *
     * Returns the total it stopped on, or null if the coast has no such
     * stretch, so a bar reads "there was nothing to stand on" as a skip
     * rather than as a card that failed to say its line.
     */
    standOn(from: number, to: number): number | null {
      const state = hooks.get();
      if (!state || currentMode(state) !== 'TRAVEL' || state.settlement) return null;
      const next = cloneState(state);
      for (let stop = 0; stop < ROUTE_STOPS; stop += 1) learnStop(next, stop);
      for (let stop = standingAt(next); stop < ROUTE_STOPS; stop += 1) {
        next.party.stop = stop;
        const total = stopReport(next.seed, stop).total;
        if (total >= from && total < to && canFound(next)) {
          hooks.commit(next);
          return total;
        }
      }
      return null;
    },

    settle() {
      const state = hooks.get();
      if (!state || currentMode(state) !== 'TRAVEL' || state.settlement) return false;
      const next = cloneState(state);
      // The walk is along the line: outward from where the band stands,
      // marking each stretch learned — because knowing the ground is one of
      // the rules, and this fabricates the walk rather than waiving it.
      const from = standingAt(next);
      for (let stop = from; stop < ROUTE_STOPS; stop += 1) {
        learnStop(next, stop);
        next.party.stop = stop;
        if (canFound(next)) break;
      }
      if (!canFound(next)) return false;
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
      // `standsFor`, so `build('longhouse')` on a steading with a great hall
      // is a no-op rather than a hall standing beside the thing that replaced
      // it. The browser bars drive this, and a bar that builds a nonsense
      // steading measures a game nobody plays.
      if (standsFor(next, id as BuildingId)) return true;
      home.built.push(id);
      home.queue = home.queue.filter((q) => q !== id);
      hooks.commit(next);
      return true;
    },

    /**
     * Puts the whole band to work, one job each.
     *
     * Same reason `stock` exists: a playtest should spend its days on the
     * thing being tested. Reaching a yard where everybody is working means
     * six taps through a roster, and `scripts/hearth.mjs` needs it to check
     * that a job puts a tool in somebody's hand — which is invisible while
     * the whole band is idle, and idle is what a fresh steading is.
     *
     * Assigns the job named, or deals the jobs out in turn when given none.
     * Refuses a job the game does not have, so a typo in a bar reads as a
     * failure rather than as a band that quietly stayed idle.
     */
    work(job: string | null = null) {
      const state = hooks.get();
      if (!state?.settlement) return false;
      const ids = JOBS.map((j) => j.id);
      if (job !== null && !ids.includes(job as JobId)) return false;
      const next = cloneState(state);
      const alive = next.party.people.filter((p) => p.alive);
      alive.forEach((person, i) => {
        person.job = (job ?? ids[i % ids.length]!) as string;
      });
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

    // TWO MEN AT A GIVEN SIZE, one whole and one at a third.
    //
    // 12.15 took the health bar off the fighters, and that is only honest if
    // the figure answers the same question — at 44px, the tap minimum this
    // game holds itself to, where a shield crack is two pixels. A claim about
    // what a person can SEE wants a picture compared, not an attribute read,
    // so `scripts/field.mjs` calls this and diffs the two halves.
    //
    // It draws through `figure()` itself. A fixture that redrew a man its own
    // way would be measuring the fixture (CLAUDE.md, trap 1).
    twoMen(px: number) {
      document.getElementById('twomen')?.remove();
      const host = document.createElement('div');
      host.id = 'twomen';
      host.style.cssText = `position:fixed;left:0;top:0;z-index:9999;background:#4a5340;`
        + `width:${px * 2}px;height:${px * 2}px;display:flex`;
      const state = hooks.get();
      const person = state?.party.people[0];
      if (!person) return;
      for (const health of [1, 0.33]) {
        const svg = svgEl('svg', {
          viewBox: `0 0 ${px} ${px * 2}`,
          width: `${px}`, height: `${px * 2}`,
        });
        svg.append(figure(px / 2, px * 0.62, px * 0.42, person, {
          friendly: true, health, active: false, defending: false,
          broken: false, pennant: null, facing: 1, throws: 0,
        }));
        host.append(svg);
      }
      document.body.append(host);
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

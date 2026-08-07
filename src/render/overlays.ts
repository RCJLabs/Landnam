// The travel-mode overlay chain: which one card, if any, sits over the map.
//
// This is a PRIORITY, not a set of independent toggles, and the order is the
// point: the run's end outranks everything, what the player opened outranks
// what the game wants to say, the game's own cards outrank the teaching. It
// lived in main.ts for six phases because its branches closed over ten loose
// module-level `let`s; once those became uistate.ts, the chain could be
// handed what it needs and lifted whole.
//
// Still a renderer: it reads state and returns a node. Everything that
// CHANGES anything goes back through the hooks.

import type { GameState } from '../state/types';
import type { Action } from '../sim/actions';
import type { UiState } from '../uistate';
import { canFound } from '../sim/site';
import { renderMap } from './map';
import { renderDeeds, type Deed } from './deeds';
import {
  renderAftermath,
  renderEventCard,
  renderFounding,
  renderLaunch,
  renderProclamation,
  renderRunEnd,
  renderGuide,
  renderSagaBook,
  renderWarband,
} from './cards';

export interface OverlayHooks {
  ui: UiState;
  dispatch: (action: Action) => void;
  rerender: () => void;
  /** The run-end card's one button: wipe the save, back to the title. */
  onRunOver: () => void;
  /** The lesson, if one is due. The caller owns what has been taught. */
  lesson: () => HTMLElement | null;
}

/** The one overlay travel mode should be showing, or null for none. */
export function travelOverlay(
  state: GameState,
  deeds: Deed[],
  hooks: OverlayHooks,
): HTMLElement | null {
  const { ui, dispatch, rerender } = hooks;

  if (state.end) {
    return renderRunEnd(state, hooks.onRunOver);
  }

  // Proclaimed and not yet answered. Above everything the player opened,
  // because it is the game asking whether there is any more game.
  if (state.jarl && state.flags['ruleTaken'] === undefined) {
    return renderProclamation(
      state,
      () => dispatch({ type: 'RULE_ON' }),
      () => dispatch({ type: 'LAY_DOWN_RULE' }),
    );
  }

  if (ui.launchOpen && state.settlement && !state.expedition) {
    return renderLaunch(
      state,
      ui.launchPicked,
      (id) => {
        if (ui.launchPicked.has(id)) ui.launchPicked.delete(id);
        else ui.launchPicked.add(id);
        rerender();
      },
      ui.launchPurpose,
      (p) => {
        ui.launchPurpose = p;
        rerender();
      },
      (action) => {
        ui.launchOpen = false;
        dispatch(action);
      },
      () => {
        ui.launchOpen = false;
        rerender();
      },
    );
  }

  if (ui.actOpen) {
    return renderDeeds(deeds, () => {
      ui.actOpen = false;
      rerender();
    });
  }

  if (ui.mapOpen) {
    return renderMap(state, () => {
      ui.mapOpen = false;
      rerender();
    });
  }

  if (ui.foundingOpen && canFound(state, state.party.at)) {
    return renderFounding(
      state,
      () => {
        ui.foundingOpen = false;
        dispatch({ type: 'FOUND' });
      },
      () => {
        ui.foundingOpen = false;
        rerender();
      },
    );
  }

  if (ui.rosterOpen) {
    return renderWarband(state, () => {
      ui.rosterOpen = false;
      rerender();
    });
  }

  if (ui.guideOpen) {
    return renderGuide(() => {
      ui.guideOpen = false;
      rerender();
    });
  }

  if (ui.sagaOpen) {
    return renderSagaBook(
      state,
      () => {
        ui.sagaOpen = false;
        rerender();
      },
      () => {
        ui.sagaOpen = false;
        ui.guideOpen = true;
        rerender();
      },
    );
  }

  if (state.aftermath) return renderAftermath(state, dispatch);
  if (state.event) return renderEventCard(state, dispatch);

  // Last, so nothing the game itself is saying is ever pushed aside by the
  // teaching. lessonDue() enforces the same rule from the other side.
  return hooks.lesson();
}

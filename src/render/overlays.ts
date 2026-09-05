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
import { renderStrip } from './stripMap';
import { daysInHand } from '../sim/coast';
import { renderDeeds, type Deed } from './deeds';
import { coastOf } from '../sim/challenge';
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
/**
 * What the GAME is saying that cannot wait — above anything the player opened,
 * because it is the game asking whether there is any more game.
 *
 * Split out of `travelOverlay` on 2026-09-05 (12.1) so the yard can ask the
 * same questions in the same order. Two copies of a priority chain drift; one
 * cannot.
 */
function urgent(state: GameState, hooks: OverlayHooks): HTMLElement | null {
  if (state.end) return renderRunEnd(state, hooks.onRunOver);
  if (state.jarl && state.flags['ruleTaken'] === undefined) {
    return renderProclamation(
      state,
      () => hooks.dispatch({ type: 'RULE_ON' }),
      () => hooks.dispatch({ type: 'LAY_DOWN_RULE' }),
    );
  }
  return null;
}

/**
 * What the game is waiting to be ANSWERED — below anything the player opened,
 * so a card never snatches a panel out from under a tap, and the teaching last
 * of all so nothing the game itself is saying is pushed aside by it.
 */
function answering(state: GameState, hooks: OverlayHooks): HTMLElement | null {
  if (state.aftermath) return renderAftermath(state, hooks.dispatch);
  if (state.event) return renderEventCard(state, hooks.dispatch);
  return hooks.lesson();
}

/**
 * The yard's overlay: everything the game is saying, and none of the road's
 * own panels — the map, the deeds sheet and the founding card belong to a band
 * that is walking.
 *
 * 12.1. Until this existed the colony screen mounted the lesson alone
 * (`colonyScreen.ts`), so a card drawn on a day passed in the yard could be
 * neither seen nor answered there. That did not matter while the yard could
 * not turn a day; it is load-bearing now that it can.
 */
export function colonyOverlay(state: GameState, hooks: OverlayHooks): HTMLElement | null {
  return urgent(state, hooks) ?? answering(state, hooks);
}

export function travelOverlay(
  state: GameState,
  deeds: Deed[],
  hooks: OverlayHooks,
): HTMLElement | null {
  const { ui, dispatch, rerender } = hooks;

  const speaking = urgent(state, hooks);
  if (speaking) return speaking;

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
    }, coastOf(state));
  }

  if (ui.mapOpen) {
    const shut = () => {
      ui.mapOpen = false;
      rerender();
    };
    // On a coast the chart is a strip, and it is also the only way to walk
    // anywhere until 8.3 puts a procession under it — so tapping a stretch
    // dispatches the step and shuts the card. See render/strip.ts.
    return renderStrip(state, shut, (to) => {
      shut();
      dispatch({ type: 'WALK', to });
    }, daysInHand(state));
  }

  if (ui.foundingOpen && canFound(state)) {
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

  return answering(state, hooks);
}

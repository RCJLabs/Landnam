// Colony mode's frame: the steading view in the map slot, the roster or the
// build list in the hint slot, and the picker's small rules — a dead
// selection must not strand it open, and setting someone to work returns to
// the roster. Pure view wiring; the steading's rules live in sim/colony.ts.

import type { GameState } from '../state/types';
import type { Action } from '../sim/actions';
import { createSteadingView } from './steadingView';
import type { ColonyView } from './views';
import {
  renderBuilds,
  renderColonyActions,
  renderColonyBar,
  renderColonyFooter,
  renderColonyHint,
  renderCrew,
  renderNeeds,
  renderRoom,
  renderHearth,
  renderWall,
  renderRations,
} from './colonyUi';
import {
  actionSlot,
  asNodes,
  hintSlot,
  mapSlot,
  nameOverlays,
  overlaySlot,
  sagaSlot,
  topbarSlot,
  type ScreenHooks,
} from '../shell';

let colonyView: ColonyView | null = null;

/**
 * What the steading's brush has done, for the debug read-out and the bars.
 *
 * The view is built lazily and kept, so this is the only handle on it from
 * outside — and scripts/steading.mjs needs it to tell a painting that was
 * KEPT from one that was made again, which no screenshot can show.
 */
export function steadingDrawn(): unknown {
  return colonyView ? colonyView.drawn() : null;
}

export function renderColonyScreen(state: GameState, h: ScreenHooks): void {
  if (!state.settlement) return;
  const { ui, dispatch, rerender } = h;
  // A steading on a coast is a place you walk into, not a ring of ground you
  // look down on. Both meet `ColonyView`, so nothing below this line changes.
  if (!colonyView) {
    colonyView = createSteadingView();
  }
  if (mapSlot.firstChild !== colonyView.root) mapSlot.replaceChildren(colonyView.root);

  // A dead or departed selection must not strand the picker open.
  if (ui.picked && !state.party.people.some((p) => p.id === ui.picked && p.alive)) ui.picked = null;

  // Setting someone to work returns you to the roster, so the next person is
  // one tap away rather than two. On a phone that is the difference between
  // the panel being usable and being a chore.
  const colonyDispatch = (action: Action): void => {
    if (action.type === 'ASSIGN') ui.picked = null;
    dispatch(action);
  };

  colonyView.update(state);
  topbarSlot.replaceChildren(renderColonyBar(state));

  // Work and Build are two views of the same steading. Selecting a person
  // always wins, because the picker replaces the action bar.
  if (ui.colonyTab === 'build' && !ui.picked) {
    hintSlot.replaceChildren(
      renderNeeds(state),
      renderRoom(state),
      renderHearth(state),
      renderWall(state),
      renderRations(state, colonyDispatch),
      renderBuilds(state, colonyDispatch),
    );
  } else {
    hintSlot.replaceChildren(
      renderColonyHint(state),
      renderCrew(state, ui.picked, (id) => {
        ui.picked = id;
        rerender();
      }),
    );
  }

  actionSlot.replaceChildren(
    renderColonyActions(state, ui.picked, ui.colonyTab, (tab) => {
      ui.colonyTab = tab;
      ui.picked = null;
      rerender();
    }, colonyDispatch),
  );
  sagaSlot.replaceChildren(renderColonyFooter(state));
  overlaySlot.replaceChildren(...asNodes(h.lesson()));
  nameOverlays();
}

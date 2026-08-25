// Travel mode's frame — the default screen, and the owner of the world map
// view. The map view survives battles and seasons so it keeps its camera,
// which is why the singleton lives here and mounting is a separate step from
// painting. The ambience easing lives here too: what the road sounds like is
// read off the same render that draws it.

import { equals, type Hex } from '../hex';
import type { GameState } from '../state/types';
import { currentMode } from '../modes';
import { createTravelView } from './travel';
import { paintingWanted } from './oilFlag';
import { travelOverlay } from './overlays';
import { deedsFor } from './deeds';
import {
  renderActionBar,
  renderHint,
  renderChaseMark,
  renderSitePanel,
  renderThingMark,
  renderWatchMark,
  renderTopBar,
  renderWinterMark,
  renderLine,
} from './ui';
import { button } from './svg';
import { ambienceFor, sameAir, setAmbience } from '../audio';
import type { AmbienceProfile } from '../data/sounds';
import { mapLabel } from '../sim/announce';
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

let travelView: ReturnType<typeof createTravelView> | null = null;
let hooks: ScreenHooks | null = null;

/** The last air we asked for, so an unchanged profile is not re-eased every render. */
let air: AmbienceProfile | null = null;

function onHexTap(target: Hex): void {
  if (!hooks) return;
  const { ui, dispatch } = hooks;
  const state = hooks.current();
  if (!state || state.event || state.aftermath || state.end) return;
  if (ui.foundingOpen || ui.mapOpen || ui.launchOpen || ui.actOpen) return;
  if (equals(target, state.party.at)) return;
  dispatch({ type: 'MOVE', to: target });
}

/** A new run: build the map view fresh and put the party in the frame. */
export function mountTravel(h: ScreenHooks): void {
  hooks = h;
  travelView = createTravelView(onHexTap, { paint: paintingWanted() });
  mapSlot.replaceChildren(...travelView.nodes);
  const state = h.current();
  if (state) travelView.centreOn(state.party.at);
}

/** Back to the title: drop the view and the eased air with it. */
export function unmountTravel(): void {
  travelView = null;
  air = null;
}

export function travelMounted(): boolean {
  return travelView !== null;
}

/** What the map renderer is holding, whichever one is mounted. */
export function travelDrawn(): unknown {
  return travelView ? travelView.drawn() : null;
}

/** Brightness of the painted country at world points, for the repaint bar. */
export function travelSample(
  points: readonly (readonly [number, number])[],
): (number | null)[] {
  return travelView ? travelView.sample(points) : points.map(() => null);
}

/** The world map's name for a listener, kept fresh whichever mode is up. */
export function labelTravelMap(state: GameState): void {
  travelView?.root.setAttribute('aria-label', mapLabel(state));
}

export function renderTravelScreen(state: GameState, h: ScreenHooks): void {
  hooks = h;
  if (!travelView) return;
  const { ui, dispatch, rerender } = h;

  // Back on the road: make sure the map is the thing on screen.
  // lastChild, not firstChild: with the painting on, the canvas is mounted
  // under the map and the SVG is the one at the end.
  if (mapSlot.lastChild !== travelView.root) {
    mapSlot.replaceChildren(...travelView.nodes);
    travelView.centreOn(state.party.at);
  }

  topbarSlot.replaceChildren(renderTopBar(state));
  travelView.update(state);
  hintSlot.replaceChildren(
    renderHint(state),
    renderChaseMark(state),
    renderWinterMark(state),
    renderLine(state),
    renderWatchMark(state),
    renderThingMark(state),
    renderSitePanel(state),
  );

  const deeds = deedsFor(
    state,
    dispatch,
    () => {
      ui.foundingOpen = true;
      rerender();
    },
    () => {
      ui.launchOpen = true;
      ui.launchPicked = new Set();
      rerender();
    },
  );

  const actions = renderActionBar(state, deeds.length, () => {
    ui.actOpen = true;
    rerender();
  }, () => {
    ui.mapOpen = true;
    rerender();
  });
  if (!state.end && !state.event) {
    actions.append(
      button('Band', () => {
        ui.rosterOpen = true;
        rerender();
      }, { class: 'action secondary' }),
      button('Saga', () => {
        ui.sagaOpen = true;
        rerender();
      }, { class: 'action secondary' }),
    );
  }
  actionSlot.replaceChildren(actions);

  // The saga lives behind its button now — the map gets the height the
  // panel used to hold. Battle and colony still use this slot for theirs.
  sagaSlot.replaceChildren();

  // Which one card sits over the map is a priority chain with opinions of
  // its own — see render/overlays.ts.
  overlaySlot.replaceChildren(...asNodes(travelOverlay(state, deeds, h)));
  nameOverlays();

  // Keep the party in view after it moves.
  if (currentMode(state) === 'TRAVEL') travelView.centreOn(state.party.at);

  // And keep the weather honest. Easing means calling this every render costs
  // nothing when nothing has changed.
  const wanted = ambienceFor(state);
  if (!air || !sameAir(air, wanted)) {
    air = wanted;
    setAmbience(wanted);
  }
}

// What is on screen that is not in the save.
//
// Which overlay is open, who is selected in the steading, which half of the
// colony panel you are looking at, which action a tap on a foe performs — all
// of it is a fact about the person holding the phone, not about the band. It
// has never belonged in the save and it does not.
//
// It was, however, ten loose `let`s at the top of main.ts, which is what made
// the overlay chain impossible to lift out of that file: every branch closed
// over module-level variables that only existed there. Gathered into one
// object, the chain can be handed what it needs.

import type { Purpose } from './state/types';
import type { ColonyTab } from './render/colonyUi';
import type { Aim } from './render/battleUi';

export interface UiState {
  /** The saga book, opened from the action bar. The map owns the screen. */
  sagaOpen: boolean;
  rosterOpen: boolean;
  /** The land-taking card. The decision itself is the only thing saved. */
  foundingOpen: boolean;
  /** Who is selected in the steading. Selection is a view concern. */
  picked: string | null;
  /** Which half of the steading: the work, or the building. */
  colonyTab: ColonyTab;
  /** The chart overlay. A view of the save, not part of it. */
  mapOpen: boolean;
  /** The how-to-play book — reachable from the title and the saga. */
  guideOpen: boolean;
  /** The settings card. Lives in its own pinned slot, like the mute. */
  settingsOpen: boolean;
  /** The day's-work sheet behind the Act button. */
  actOpen: boolean;
  /** The send-out card: who is ticked, and what for. */
  launchOpen: boolean;
  launchPicked: Set<string>;
  launchPurpose: Purpose;
  /** Which action a tap on a foe performs. Resets to Strike each turn. */
  aim: Aim;
  aimTurnKey: string;
}

export function freshUi(): UiState {
  return {
    sagaOpen: false,
    rosterOpen: false,
    foundingOpen: false,
    picked: null,
    colonyTab: 'work',
    mapOpen: false,
    guideOpen: false,
    settingsOpen: false,
    actOpen: false,
    launchOpen: false,
    launchPicked: new Set(),
    launchPurpose: 'explore',
    aim: 'strike',
    aimTurnKey: '',
  };
}

/**
 * Clears everything a new run should not inherit.
 *
 * Deliberately not `freshUi()` wholesale: the aim and its turn key belong to
 * whatever fight is on screen and are reset by the battle renderer, and
 * resetting them here would be two places owning one field.
 */
export function resetForRun(ui: UiState): void {
  const fresh = freshUi();
  ui.sagaOpen = fresh.sagaOpen;
  ui.rosterOpen = fresh.rosterOpen;
  ui.foundingOpen = fresh.foundingOpen;
  ui.picked = fresh.picked;
  ui.colonyTab = fresh.colonyTab;
  ui.mapOpen = fresh.mapOpen;
  ui.guideOpen = fresh.guideOpen;
  ui.settingsOpen = fresh.settingsOpen;
  ui.actOpen = fresh.actOpen;
  ui.launchOpen = fresh.launchOpen;
  ui.launchPicked = fresh.launchPicked;
  ui.launchPurpose = fresh.launchPurpose;
}

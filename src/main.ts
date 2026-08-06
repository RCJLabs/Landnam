// Boot and mode router. Owns the mutable "current state" reference; every
// change flows through dispatch -> sim -> save -> render.

import './style.css';

import { equals, key, type Hex } from './hex';
import { currentMode } from './modes';
import { makeSeedPhrase } from './rng';
import { newGame } from './state/create';
import { clearSave, hasSave, load, save } from './state/save';
import type { GameState } from './state/types';
import { apply, type Action } from './sim/actions';
import { createTravelView } from './render/travel';
import { createBattleView } from './render/battle';
import { createColonyView } from './render/colony';
import { renderMap } from './render/map';
import {
  renderBuilds,
  renderColonyActions,
  renderColonyBar,
  renderColonyFooter,
  renderColonyHint,
  renderCrew,
  renderNeeds,
  type ColonyTab,
} from './render/colonyUi';
import {
  renderAftermath,
  renderEventCard,
  renderFounding,
  renderRunEnd,
  renderTitle,
  renderWarband,
} from './render/cards';
import {
  renderActionBar,
  renderHint,
  renderSagaLog,
  renderSitePanel,
  renderTopBar,
  renderWinterMark,
} from './render/ui';
import {
  renderBattleActions,
  renderBattleBar,
  renderBattleHint,
  renderBattleLog,
  renderBattleResult,
  type Aim,
} from './render/battleUi';
import { combatantAt, isWarbandTurn } from './sim/battle';
import { canFound } from './sim/site';
import { startBattle } from './sim/battleTurn';
import { button, el } from './render/svg';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

let state: GameState | null = null;
let travelView: ReturnType<typeof createTravelView> | null = null;
let battleView: ReturnType<typeof createBattleView> | null = null;
let colonyView: ReturnType<typeof createColonyView> | null = null;
let sagaExpanded = false;
let rosterOpen = false;
/** The land-taking card is UI state — the decision itself is the only thing saved. */
let foundingOpen = false;
/** Who is selected in the steading. Selection is a view concern, not a save. */
let picked: string | null = null;
/** Which half of the steading you are looking at: the work, or the building. */
let colonyTab: ColonyTab = 'work';
/** The chart overlay. A view of the save, not part of it. */
let mapOpen = false;
/** Which action a tap on a foe performs. Resets to Strike each turn. */
let aim: Aim = 'strike';
let aimTurnKey = '';

// Chrome that persists across renders, so the map keeps its camera.
const topbarSlot = el('div', { class: 'slot topbar-slot' });
const mapSlot = el('div', { class: 'slot map-slot' });
const hintSlot = el('div', { class: 'slot hint-slot' });
const actionSlot = el('div', { class: 'slot action-slot' });
const sagaSlot = el('div', { class: 'slot saga-slot' });
const overlaySlot = el('div', { class: 'slot overlay-slot' });

function shell(): HTMLElement {
  return el('div', { class: 'shell' }, [
    topbarSlot,
    mapSlot,
    hintSlot,
    actionSlot,
    sagaSlot,
    overlaySlot,
  ]);
}

function dispatch(action: Action): void {
  if (!state) return;
  const next = apply(state, action);
  if (next === state) return;
  state = next;
  save(state);
  render();
}

function onHexTap(target: Hex): void {
  if (!state || state.event || state.aftermath || state.end || foundingOpen || mapOpen) return;
  if (equals(target, state.party.at)) return;
  dispatch({ type: 'MOVE', to: target });
}

/** On the field, a tap is either a step or the armed action on a foe. */
function onFieldTap(target: Hex): void {
  if (!state?.battle || state.battle.outcome || !isWarbandTurn(state)) return;
  const occupant = combatantAt(state.battle, target);
  if (occupant) {
    if (occupant.side !== 'foe') return;
    const id = occupant.personId;
    if (aim === 'throw') dispatch({ type: 'B_THROW', targetId: id });
    else if (aim === 'shove') dispatch({ type: 'B_SHOVE', targetId: id });
    else dispatch({ type: 'B_STRIKE', targetId: id });
    return;
  }
  dispatch({ type: 'B_MOVE', to: target });
}

function startRun(seed: string): void {
  const finalSeed = seed || makeSeedPhrase(Date.now());
  state = newGame(finalSeed);
  save(state);
  sagaExpanded = false;
  rosterOpen = false;
  foundingOpen = false;
  picked = null;
  colonyTab = 'work';
  mapOpen = false;
  mountGame();
}

function continueRun(): void {
  const loaded = load();
  if (!loaded) {
    startRun('');
    return;
  }
  state = loaded;
  mountGame();
}

function mountGame(): void {
  app!.replaceChildren(shell());
  travelView = createTravelView(onHexTap);
  mapSlot.replaceChildren(travelView.root);
  if (state) travelView.centreOn(state.party.at);
  render();
}

function showTitle(): void {
  state = null;
  travelView = null;
  app!.replaceChildren(
    renderTitle(hasSave(), continueRun, (seed) => startRun(seed)),
  );
}

function renderBattle(): void {
  if (!state?.battle) return;
  if (!battleView) {
    battleView = createBattleView(onFieldTap);
  }
  if (mapSlot.firstChild !== battleView.root) {
    mapSlot.replaceChildren(battleView.root);
  }
  // A fresh fighter starts with a sword in hand, not a spear cocked.
  const turnKey = `${state.battle.round}:${state.battle.turnIndex}`;
  if (turnKey !== aimTurnKey) {
    aimTurnKey = turnKey;
    aim = 'strike';
  }

  topbarSlot.replaceChildren(renderBattleBar(state));
  battleView.update(state, aim);
  hintSlot.replaceChildren(renderBattleHint(state, aim));
  actionSlot.replaceChildren(
    renderBattleActions(state, aim, (next) => {
      aim = next;
      render();
    }, dispatch),
  );
  sagaSlot.replaceChildren(renderBattleLog(state));
  overlaySlot.replaceChildren(
    state.battle.outcome ? renderBattleResult(state, dispatch) : document.createTextNode(''),
  );
}

function renderColony(): void {
  if (!state?.settlement) return;
  if (!colonyView) colonyView = createColonyView();
  if (mapSlot.firstChild !== colonyView.root) mapSlot.replaceChildren(colonyView.root);

  // A dead or departed selection must not strand the picker open.
  if (picked && !state.party.people.some((p) => p.id === picked && p.alive)) picked = null;

  // Setting someone to work returns you to the roster, so the next person is
  // one tap away rather than two. On a phone that is the difference between
  // the panel being usable and being a chore.
  const colonyDispatch = (action: Action): void => {
    if (action.type === 'ASSIGN') picked = null;
    dispatch(action);
  };

  colonyView.update(state);
  topbarSlot.replaceChildren(renderColonyBar(state));

  // Work and Build are two views of the same steading. Selecting a person
  // always wins, because the picker replaces the action bar.
  if (colonyTab === 'build' && !picked) {
    hintSlot.replaceChildren(renderNeeds(state), renderBuilds(state, colonyDispatch));
  } else {
    hintSlot.replaceChildren(
      renderColonyHint(state),
      renderCrew(state, picked, (id) => {
        picked = id;
        render();
      }),
    );
  }

  actionSlot.replaceChildren(
    renderColonyActions(state, picked, colonyTab, (tab) => {
      colonyTab = tab;
      picked = null;
      render();
    }, colonyDispatch),
  );
  sagaSlot.replaceChildren(renderColonyFooter(state));
  overlaySlot.replaceChildren();
}

function render(): void {
  if (!state || !travelView) return;

  if (currentMode(state) === 'BATTLE' && state.battle) {
    renderBattle();
    return;
  }

  if (currentMode(state) === 'COLONY') {
    renderColony();
    return;
  }

  // Back on the road: make sure the map is the thing on screen.
  if (mapSlot.firstChild !== travelView.root) {
    mapSlot.replaceChildren(travelView.root);
    travelView.centreOn(state.party.at);
  }

  topbarSlot.replaceChildren(renderTopBar(state));
  travelView.update(state);
  hintSlot.replaceChildren(renderHint(state), renderWinterMark(state), renderSitePanel(state));

  const actions = renderActionBar(
    state,
    dispatch,
    () => {
      foundingOpen = true;
      render();
    },
    () => {
      mapOpen = true;
      render();
    },
  );
  if (!state.end && !state.event) {
    actions.append(
      button('Band', () => {
        rosterOpen = true;
        render();
      }, { class: 'action secondary' }),
    );
  }
  actionSlot.replaceChildren(actions);

  sagaSlot.replaceChildren(
    renderSagaLog(state, sagaExpanded, () => {
      sagaExpanded = !sagaExpanded;
      render();
    }),
  );

  if (state.end) {
    overlaySlot.replaceChildren(
      renderRunEnd(state, () => {
        clearSave();
        showTitle();
      }),
    );
  } else if (mapOpen) {
    overlaySlot.replaceChildren(
      renderMap(state, () => {
        mapOpen = false;
        render();
      }),
    );
  } else if (foundingOpen && canFound(state, state.party.at)) {
    overlaySlot.replaceChildren(
      renderFounding(
        state,
        () => {
          foundingOpen = false;
          dispatch({ type: 'FOUND' });
        },
        () => {
          foundingOpen = false;
          render();
        },
      ),
    );
  } else if (rosterOpen) {
    overlaySlot.replaceChildren(
      renderWarband(state, () => {
        rosterOpen = false;
        render();
      }),
    );
  } else if (state.aftermath) {
    overlaySlot.replaceChildren(renderAftermath(state, dispatch));
  } else if (state.event) {
    overlaySlot.replaceChildren(renderEventCard(state, dispatch));
  } else {
    overlaySlot.replaceChildren();
  }

  // Keep the party in view after it moves.
  if (currentMode(state) === 'TRAVEL') travelView.centreOn(state.party.at);
}

// A small hand-hold for testing and for poking at a run from the console:
// inspect the state, or drop straight onto a battlefield rather than
// wandering until a combat event happens to fire.
declare global {
  interface Window {
    landnam?: {
      state(): GameState | null;
      fight(difficulty?: number): void;
    };
  }
}
window.landnam = {
  state: () => state,
  fight(difficulty = 0) {
    if (!state || currentMode(state) !== 'TRAVEL') return;
    const next = structuredClone(state);
    const here = next.world.tiles[key(next.party.at)]?.terrain ?? 'meadow';
    startBattle(next, here, difficulty);
    state = next;
    save(state);
    render();
  },
};

showTitle();

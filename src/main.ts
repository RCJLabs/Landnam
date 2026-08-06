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
import { renderEventCard, renderRunEnd, renderTitle, renderWarband } from './render/cards';
import { renderActionBar, renderHint, renderSagaLog, renderTopBar } from './render/ui';
import {
  renderBattleActions,
  renderBattleBar,
  renderBattleHint,
  renderBattleLog,
  renderBattleResult,
} from './render/battleUi';
import { combatantAt, isWarbandTurn } from './sim/battle';
import { startBattle } from './sim/battleTurn';
import { button, el } from './render/svg';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

let state: GameState | null = null;
let travelView: ReturnType<typeof createTravelView> | null = null;
let battleView: ReturnType<typeof createBattleView> | null = null;
let sagaExpanded = false;
let rosterOpen = false;

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
  if (!state || state.event || state.end) return;
  if (equals(target, state.party.at)) return;
  dispatch({ type: 'MOVE', to: target });
}

/** On the field, a tap is either a step or a blow, depending what is there. */
function onFieldTap(target: Hex): void {
  if (!state?.battle || state.battle.outcome || !isWarbandTurn(state)) return;
  const occupant = combatantAt(state.battle, target);
  if (occupant) {
    if (occupant.side === 'foe') dispatch({ type: 'B_STRIKE', targetId: occupant.personId });
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
  topbarSlot.replaceChildren(renderBattleBar(state));
  battleView.update(state);
  hintSlot.replaceChildren(renderBattleHint(state));
  actionSlot.replaceChildren(renderBattleActions(state, dispatch));
  sagaSlot.replaceChildren(renderBattleLog(state));
  overlaySlot.replaceChildren(
    state.battle.outcome ? renderBattleResult(state, dispatch) : document.createTextNode(''),
  );
}

function render(): void {
  if (!state || !travelView) return;

  if (currentMode(state) === 'BATTLE' && state.battle) {
    renderBattle();
    return;
  }

  // Back on the road: make sure the map is the thing on screen.
  if (mapSlot.firstChild !== travelView.root) {
    mapSlot.replaceChildren(travelView.root);
    travelView.centreOn(state.party.at);
  }

  topbarSlot.replaceChildren(renderTopBar(state));
  travelView.update(state);
  hintSlot.replaceChildren(renderHint(state));

  const actions = renderActionBar(state, dispatch);
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
  } else if (rosterOpen) {
    overlaySlot.replaceChildren(
      renderWarband(state, () => {
        rosterOpen = false;
        render();
      }),
    );
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

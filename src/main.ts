// Boot and mode router. Owns the mutable "current state" reference; every
// change flows through dispatch -> sim -> save -> render.

import './style.css';

import { equals, type Hex } from './hex';
import { currentMode } from './modes';
import { makeSeedPhrase } from './rng';
import { newGame } from './state/create';
import { clearSave, hasSave, load, save } from './state/save';
import type { GameState } from './state/types';
import { apply, type Action } from './sim/actions';
import { createTravelView } from './render/travel';
import { renderEventCard, renderRunEnd, renderTitle, renderWarband } from './render/cards';
import { renderActionBar, renderHint, renderSagaLog, renderTopBar } from './render/ui';
import { button, el } from './render/svg';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

let state: GameState | null = null;
let travelView: ReturnType<typeof createTravelView> | null = null;
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

function render(): void {
  if (!state || !travelView) return;

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

showTitle();

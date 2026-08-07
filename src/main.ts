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
  renderRoom,
} from './render/colonyUi';
import {
  renderAftermath,
  renderEventCard,
  renderFounding,
  renderLaunch,
  renderLesson,
  renderRunEnd,
  renderTitle,
  renderWall,
  renderWarband,
} from './render/cards';
import { deedsFor, renderDeeds } from './render/deeds';
import {
  renderActionBar,
  renderHint,
  renderMuteToggle,
  renderSagaLog,
  renderSitePanel,
  renderThingMark,
  renderTopBar,
  renderWinterMark,
} from './render/ui';
import {
  renderBattleActions,
  renderBattleBar,
  renderBattleHint,
  renderBattleLog,
  renderBattleResult,
} from './render/battleUi';
import { combatantAt, isWarbandTurn } from './sim/battle';
import { canFound } from './sim/site';
import { button, el } from './render/svg';
import { watchForNewBuild } from './freshness';
import {
  ambienceFor,
  cuesFor,
  hushAmbience,
  isMuted,
  play,
  playAll,
  sameAir,
  setAmbience,
  toggleMute,
  wake,
} from './audio';
import type { AmbienceProfile } from './data/sounds';
import { lessonDue } from './sim/lessons';
import { forgetTeaching, markTaught, taught } from './taught';
import { fallen, remember } from './memorial';
import { fallenOf } from './sim/fallen';
import { installDebug } from './debug';
import { freshUi, resetForRun } from './uistate';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

let state: GameState | null = null;
let travelView: ReturnType<typeof createTravelView> | null = null;
let battleView: ReturnType<typeof createBattleView> | null = null;
let colonyView: ReturnType<typeof createColonyView> | null = null;
/** Everything on screen that is not in the save. See src/uistate.ts. */
const ui = freshUi();

/** The last air we asked for, so an unchanged profile is not re-eased every render. */
let air: AmbienceProfile | null = null;

/**
 * The mute lives outside the shell: it has to be there in all three modes and
 * on the title screen, and it must survive replaceChildren on #app.
 */
const muteSlot = el('div', { class: 'mute-slot' });

function paintMute(): void {
  muteSlot.replaceChildren(
    renderMuteToggle(isMuted(), () => {
      // Toggling is itself a gesture, so it is also a valid moment to start
      // the audio — tapping "sound on" must actually produce sound.
      wake();
      const nowMuted = toggleMute();
      paintMute();
      if (!nowMuted) {
        play('tap');
        if (state) setAmbience(ambienceFor(state));
      }
    }),
  );
}

/**
 * Every mobile browser refuses to start an AudioContext outside a real user
 * gesture, so the game stays silent until the player touches it — which is
 * also the polite default. One listener, removed once it has done its job.
 */
function armAudio(): void {
  const start = (): void => {
    wake();
    if (state) setAmbience(ambienceFor(state));
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
  };
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);
}

/**
 * The lesson, if one is due, as a ready-to-mount overlay. Every mode asks,
 * because the things worth explaining happen in all three — the shield wall
 * is a battle lesson and jobs are a colony one — and because a lesson that
 * only ever appeared on the map would be a tutorial screen wearing a hat.
 */
function lessonOverlay(): HTMLElement | null {
  if (!state) return null;
  const due = lessonDue(state, taught());
  if (!due) return null;
  return renderLesson(due, () => {
    markTaught(due.id);
    render();
  });
}

// Chrome that persists across renders, so the map keeps its camera.
const topbarSlot = el('div', { class: 'slot topbar-slot' });
const mapSlot = el('div', { class: 'slot map-slot' });
const hintSlot = el('div', { class: 'slot hint-slot' });
const actionSlot = el('div', { class: 'slot action-slot' });
const sagaSlot = el('div', { class: 'slot saga-slot' });
const overlaySlot = el('div', { class: 'slot overlay-slot' });

/** replaceChildren wants a list; a missing overlay is an empty one. */
function asNodes(node: HTMLElement | null): HTMLElement[] {
  return node ? [node] : [];
}

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
  const before = state;
  const next = apply(before, action);
  if (next === before) return;
  state = next;
  save(state);
  // What changed IS what the game sounds like — see src/audio/cues.ts. Doing
  // it here rather than inside the sim keeps every reducer pure.
  playAll(cuesFor(before, next, action));
  // The wall outlives the run, so it is written the moment the run is over
  // rather than when the ending card is dismissed — a player who closes the
  // tab on the death screen has still lost those people.
  if (!before.end && next.end) remember(fallenOf(next));
  render();
}

function onHexTap(target: Hex): void {
  if (!state || state.event || state.aftermath || state.end) return;
  if (ui.foundingOpen || ui.mapOpen || ui.launchOpen || ui.actOpen) return;
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
    if (ui.aim === 'throw') dispatch({ type: 'B_THROW', targetId: id });
    else if (ui.aim === 'shove') dispatch({ type: 'B_SHOVE', targetId: id });
    else dispatch({ type: 'B_STRIKE', targetId: id });
    return;
  }
  dispatch({ type: 'B_MOVE', to: target });
}

function startRun(seed: string): void {
  const finalSeed = seed || makeSeedPhrase(Date.now());
  state = newGame(finalSeed);
  save(state);
  resetForRun(ui);
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
  air = null;
  hushAmbience();
  if (ui.wallOpen) {
    app!.replaceChildren(
      renderWall(fallen(), () => {
        ui.wallOpen = false;
        showTitle();
      }),
    );
    return;
  }

  const beenTaught = taught().length > 0;
  const anyDead = fallen().length > 0;
  app!.replaceChildren(
    renderTitle(
      hasSave(),
      continueRun,
      (seed) => startRun(seed),
      beenTaught
        ? () => {
            forgetTeaching();
            showTitle();
          }
        : undefined,
      anyDead
        ? () => {
            ui.wallOpen = true;
            showTitle();
          }
        : undefined,
    ),
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
  if (turnKey !== ui.aimTurnKey) {
    ui.aimTurnKey = turnKey;
    ui.aim = 'strike';
  }

  topbarSlot.replaceChildren(renderBattleBar(state));
  battleView.update(state, ui.aim);
  hintSlot.replaceChildren(renderBattleHint(state, ui.aim));
  actionSlot.replaceChildren(
    renderBattleActions(state, ui.aim, (next) => {
      ui.aim = next;
      render();
    }, dispatch),
  );
  sagaSlot.replaceChildren(renderBattleLog(state));
  overlaySlot.replaceChildren(
    ...(state.battle.outcome ? [renderBattleResult(state, dispatch)] : asNodes(lessonOverlay())),
  );
}

function renderColony(): void {
  if (!state?.settlement) return;
  if (!colonyView) colonyView = createColonyView();
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
      renderBuilds(state, colonyDispatch),
    );
  } else {
    hintSlot.replaceChildren(
      renderColonyHint(state),
      renderCrew(state, ui.picked, (id) => {
        ui.picked = id;
        render();
      }),
    );
  }

  actionSlot.replaceChildren(
    renderColonyActions(state, ui.picked, ui.colonyTab, (tab) => {
      ui.colonyTab = tab;
      ui.picked = null;
      render();
    }, colonyDispatch),
  );
  sagaSlot.replaceChildren(renderColonyFooter(state));
  overlaySlot.replaceChildren(...asNodes(lessonOverlay()));
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
  hintSlot.replaceChildren(
    renderHint(state),
    renderWinterMark(state),
    renderThingMark(state),
    renderSitePanel(state),
  );

  const deeds = deedsFor(
    state,
    dispatch,
    () => {
      ui.foundingOpen = true;
      render();
    },
    () => {
      ui.launchOpen = true;
      ui.launchPicked = new Set();
      render();
    },
  );

  const actions = renderActionBar(state, deeds.length, () => {
    ui.actOpen = true;
    render();
  }, () => {
    ui.mapOpen = true;
    render();
  });
  if (!state.end && !state.event) {
    actions.append(
      button('Band', () => {
        ui.rosterOpen = true;
        render();
      }, { class: 'action secondary' }),
    );
  }
  actionSlot.replaceChildren(actions);

  sagaSlot.replaceChildren(
    renderSagaLog(state, ui.sagaExpanded, () => {
      ui.sagaExpanded = !ui.sagaExpanded;
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
  } else if (ui.launchOpen && state.settlement && !state.expedition) {
    overlaySlot.replaceChildren(
      renderLaunch(
        state,
        ui.launchPicked,
        (id) => {
          if (ui.launchPicked.has(id)) ui.launchPicked.delete(id);
          else ui.launchPicked.add(id);
          render();
        },
        ui.launchPurpose,
        (p) => {
          ui.launchPurpose = p;
          render();
        },
        (action) => {
          ui.launchOpen = false;
          dispatch(action);
        },
        () => {
          ui.launchOpen = false;
          render();
        },
      ),
    );
  } else if (ui.actOpen) {
    overlaySlot.replaceChildren(
      renderDeeds(deeds, () => {
        ui.actOpen = false;
        render();
      }),
    );
  } else if (ui.mapOpen) {
    overlaySlot.replaceChildren(
      renderMap(state, () => {
        ui.mapOpen = false;
        render();
      }),
    );
  } else if (ui.foundingOpen && canFound(state, state.party.at)) {
    overlaySlot.replaceChildren(
      renderFounding(
        state,
        () => {
          ui.foundingOpen = false;
          dispatch({ type: 'FOUND' });
        },
        () => {
          ui.foundingOpen = false;
          render();
        },
      ),
    );
  } else if (ui.rosterOpen) {
    overlaySlot.replaceChildren(
      renderWarband(state, () => {
        ui.rosterOpen = false;
        render();
      }),
    );
  } else if (state.aftermath) {
    overlaySlot.replaceChildren(renderAftermath(state, dispatch));
  } else if (state.event) {
    overlaySlot.replaceChildren(renderEventCard(state, dispatch));
  } else {
    // Last, so nothing the game itself is saying is ever pushed aside by the
    // teaching. lessonDue() enforces the same rule from the other side.
    overlaySlot.replaceChildren(...asNodes(lessonOverlay()));
  }

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

paintMute();
document.body.append(muteSlot);
armAudio();

// Console levers for testing. See src/debug.ts — they go through the same
// save-and-render path a real dispatch does.
installDebug({
  get: () => state,
  commit: (next) => {
    state = next;
    save(state);
    render();
  },
});

showTitle();
// If the server has moved on since this page was cached, say so.
watchForNewBuild();

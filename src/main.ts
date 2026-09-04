// Boot and mode router. Owns the mutable "current state" reference; every
// change flows through dispatch -> sim -> save -> render. The frame the modes
// paint into is src/shell.ts, the pinned chrome around it is src/chrome.ts,
// and each mode's screen wiring is render/*Screen.ts — this file is what
// connects them to the one state.

import './style.css';

import { currentMode } from './modes';
import { makeSeedPhrase } from './rng';
import { newGame } from './state/create';
import { clearSave, hasSave, load, save } from './state/save';
import type { GameState } from './state/types';
import { apply, type Action } from './sim/actions';
import { renderGuide, renderLesson, renderTitle } from './render/cards';
import { applyMotionPref } from './motion';
import { installKnot } from './render/knot';
import { buzz } from './haptics';
import { lastHardship, rememberHardship } from './hardshipPref';
import { decodeChallenge } from './sim/challenge';
import { haunt } from './sim/haunt';
import type { HardshipId } from './data/hardship';
import { cuesFor, hushAmbience, playAll } from './audio';
import { lessonDue } from './sim/lessons';
import { markTaught, taught } from './taught';
import { remember } from './memorial';
import { fallenOf } from './sim/fallen';
import { installDebug } from './debug';
import { freshUi, resetForRun } from './uistate';
import { cry, shell, type ScreenHooks } from './shell';
import { installChrome } from './chrome';
import { renderBattleScreen } from './render/battleScreen';
import { renderColonyScreen } from './render/colonyScreen';
import {
  labelTravelMap,
  mountTravel,
  renderTravelScreen,
  travelMounted,
  unmountTravel,
} from './render/travelScreen';
import { watchForNewBuild } from './freshness';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

let state: GameState | null = null;
/** Everything on screen that is not in the save. See src/uistate.ts. */
const ui = freshUi();

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

/** The one bundle every screen and overlay works through. */
const hooks: ScreenHooks = {
  current: () => state,
  ui,
  dispatch,
  rerender: render,
  onRunOver: () => {
    clearSave();
    showTitle();
  },
  lesson: lessonOverlay,
};

function dispatch(action: Action): void {
  if (!state) return;
  const before = state;
  const next = apply(before, action);
  if (next === before) return;
  state = next;
  save(state);
  // What changed IS what the game sounds like — see src/audio/cues.ts. Doing
  // it here rather than inside the sim keeps every reducer pure.
  //
  // The hand reads the same list, so a blow that makes a noise and a blow
  // that makes a buzz can never disagree about whether it landed.
  const cues = cuesFor(before, next, action);
  playAll(cues);
  buzz(cues);
  // The wall outlives the run, so it is written the moment the run is over
  // rather than when the ending card is dismissed — a player who closes the
  // tab on the death screen has still lost those people.
  if (!before.end && next.end) remember(fallenOf(next));
  render();
}

function startRun(seed: string, hardship: HardshipId = lastHardship()): void {
  // What was typed may be a challenge code rather than a seed, in which case
  // it brings its own seed AND its own terms — a shared run has to mean the
  // same thing to both people, and half of what it means is the country.
  const challenge = decodeChallenge(seed);
  const finalSeed = challenge ? challenge.seed || makeSeedPhrase(Date.now())
    : seed || makeSeedPhrase(Date.now());
  const terms = challenge ? challenge.hardship : hardship;
  // Remembered for the next title screen only; the terms themselves ride on
  // the run, so a saga carries the country it was played in.
  rememberHardship(terms);
  state = newGame(finalSeed, terms);
  if (challenge?.mark) state.chasing = challenge.mark;
  // Somebody else's steading, if the code brought one. Never fatal: a ghost
  // naming ground this world put under the sea simply is not there.
  if (challenge?.ghost) haunt(state, challenge.ghost);
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
  mountTravel(hooks);
  render();
}

function showTitle(): void {
  state = null;
  unmountTravel();
  hushAmbience();
  if (ui.guideOpen) {
    app!.replaceChildren(
      renderGuide(() => {
        ui.guideOpen = false;
        showTitle();
      }),
    );
    return;
  }

  // The teaching reset and the memorial live in Settings now — the pinned
  // gear reaches them from here and from every mode.
  app!.replaceChildren(
    renderTitle(hasSave(), continueRun, (seed, hardship) => startRun(seed, hardship), undefined, undefined, () => {
      ui.guideOpen = true;
      showTitle();
    }),
  );
}

function render(): void {
  if (!state || !travelMounted()) return;
  // Whatever else this render does, the listener is told. Placed at the top
  // so the three mode branches below cannot each forget it.
  cry(state);
  labelTravelMap(state);

  if (currentMode(state) === 'BATTLE' && state.battle) {
    renderBattleScreen(state, hooks);
    return;
  }

  if (currentMode(state) === 'COLONY') {
    renderColonyScreen(state, hooks);
    return;
  }

  // Back on the road.
  renderTravelScreen(state, hooks);
}

installChrome(ui, () => state);
// The stillness choice has to be on the root before anything animates.
applyMotionPref();
// The knot the stylesheet's rules are drawn with. One definition, set on the
// root, so `style.css` never carries a second copy of it. See render/knot.ts.
installKnot();

// Console levers for testing. See src/debug.ts — they go through the same
// save-and-render path a real dispatch does.
installDebug({
  get: () => state,
  commit: (next) => {
    state = next;
    save(state);
    render();
  },
  // The travel view is a singleton so it can keep its camera across battles
  // and seasons; swapping the renderer under it means building a new one.
  remount: () => {
    if (!state) return;
    unmountTravel();
    mountTravel(hooks);
    render();
  },
});

showTitle();
// If the server has moved on since this page was cached, say so.
watchForNewBuild();

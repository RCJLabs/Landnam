// Battle mode's frame: which slots hold what while a fight is on, and what a
// tap on the field means. The view itself stays in battle.ts and stays pure;
// this file is the wiring between it and the shell.

import type { Hex } from '../hex';
import type { GameState } from '../state/types';
import { combatantAt, isWarbandTurn } from '../sim/battle';
import { createBattleView } from './battle';
import {
  renderBattleActions,
  renderBattleBar,
  renderBattleHint,
  renderBattleLog,
  renderBattleResult,
} from './battleUi';
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

// The field survives leaving and re-entering battle, like the map's camera.
let battleView: ReturnType<typeof createBattleView> | null = null;
let hooks: ScreenHooks | null = null;

/** On the field, a tap is either a step or the armed action on a foe. */
function onFieldTap(target: Hex): void {
  if (!hooks) return;
  const { ui, dispatch } = hooks;
  const state = hooks.current();
  if (!state?.battle || state.battle.outcome || !isWarbandTurn(state)) return;
  const occupant = combatantAt(state.battle, target);
  if (occupant) {
    if (occupant.side !== 'foe') return;
    const id = occupant.personId;
    if (ui.aim === 'throw') dispatch({ type: 'B_THROW', targetId: id });
    else if (ui.aim === 'shove') dispatch({ type: 'B_SHOVE', targetId: id });
    else if (ui.aim === 'reach') dispatch({ type: 'B_REACH', targetId: id });
    else dispatch({ type: 'B_STRIKE', targetId: id });
    return;
  }
  dispatch({ type: 'B_MOVE', to: target });
}

export function renderBattleScreen(state: GameState, h: ScreenHooks): void {
  if (!state.battle) return;
  hooks = h;
  const { ui, dispatch, rerender } = h;
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
      rerender();
    }, dispatch),
  );
  sagaSlot.replaceChildren(renderBattleLog(state));
  overlaySlot.replaceChildren(
    ...(state.battle.outcome ? [renderBattleResult(state, dispatch)] : asNodes(h.lesson())),
  );
  nameOverlays();
}

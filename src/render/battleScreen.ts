// Battle mode's frame: which slots hold what while a fight is on, and what a
// tap on the field means. The view itself stays in battle.ts and stays pure;
// this file is the wiring between it and the shell.

import type { GameState } from '../state/types';
import { isWarbandTurn } from '../sim/battle';
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

/**
 * On the field, a tap is the armed action on the foe who was tapped.
 *
 * `personId` rather than a hex since 8.1d: the view knows where every rank
 * stands, so it resolves who was under the thumb and says so. Nothing here
 * does geometry, which is the point — there is one place that knows where a
 * man is drawn, and it is `render/line.ts`.
 *
 * `null` is a tap on bare ground. It used to be a move; there is nowhere to
 * move, so it does nothing, and `scripts/pan.mjs` holds that as a bar.
 */
function onFieldTap(personId: string | null): void {
  if (!hooks || personId === null) return;
  const { ui, dispatch } = hooks;
  const state = hooks.current();
  if (!state?.battle || state.battle.outcome || !isWarbandTurn(state)) return;
  const target = state.battle.combatants.find((c) => c.personId === personId);
  if (!target || target.side !== 'foe' || target.down || target.fled) return;
  if (ui.aim === 'throw') dispatch({ type: 'B_THROW', targetId: personId });
  else if (ui.aim === 'shove') dispatch({ type: 'B_SHOVE', targetId: personId });
  else if (ui.aim === 'reach') dispatch({ type: 'B_REACH', targetId: personId });
  else dispatch({ type: 'B_STRIKE', targetId: personId });
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

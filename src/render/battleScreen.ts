// Battle mode's frame: which slots hold what while a fight is on, and what a
// tap on the field means. The view itself stays in battle.ts and stays pure;
// this file is the wiring between it and the shell.

import type { GameState } from '../state/types';
import { isWarbandTurn } from '../sim/battle';
import { createBattleView } from './battle';
import { turnIsSpent } from '../sim/battleTurn';
import { keptStill } from '../motion';
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
  else if (ui.aim === 'reach') dispatch({ type: 'B_REACH', targetId: personId });
  else dispatch({ type: 'B_STRIKE', targetId: personId });
}

/** What the painted field cost. See BattleView.drawn. */
export function fieldDrawn(): unknown {
  return battleView ? battleView.drawn() : null;
}

/**
 * How long the blow is left on screen before the turn ends itself.
 *
 * Not zero, and that is the whole of the care in 9.13. The tap being deleted
 * was ceremony, but it was also the beat where a player watched their own
 * blow land — end the turn on the same frame as the strike and the foes move
 * over the top of it. One beat's grace is what a player was buying with that
 * tap, so it is given back rather than taken.
 */
const SPENT_GAP = 420;

/** The turn an auto-end is already booked for, so a repaint cannot stack another. */
let endingTurn: string | null = null;

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

  // THE TURN THAT ENDS ITSELF (9.13). Once a fighter has acted, ending the
  // turn is the only legal move — proven in test/battleActions.test.ts against
  // every verb the player has — so the screen stops asking. The rule is
  // `turnIsSpent` in the sim; all this does is press the button.
  //
  // Booked against the turn key rather than fired on the spot, because this
  // function runs on every repaint and a timeout per repaint would end
  // several turns for one blow.
  if (turnIsSpent(state)) {
    if (endingTurn !== turnKey) {
      endingTurn = turnKey;
      const end = (): void => {
        // Re-asked against the LIVE state at the moment it fires, and pinned
        // to the turn it was booked for. A fight can be won by the very blow
        // that spent the turn, and a player can leave the field while this is
        // in the air — either way the turn key has moved and this must not
        // fire, or it spends somebody else's turn for them.
        const now = h.current();
        if (!now?.battle || now.battle.outcome) return;
        if (`${now.battle.round}:${now.battle.turnIndex}` !== turnKey) return;
        if (turnIsSpent(now)) dispatch({ type: 'B_END_TURN' });
      };
      // Deferred even when motion is stilled. `end` dispatches, and
      // dispatching from inside a render re-enters this function while it is
      // still painting; a zero timeout costs a stilled player nothing and
      // keeps the render a render.
      window.setTimeout(end, keptStill() ? 0 : SPENT_GAP);
    }
  } else if (endingTurn === turnKey) {
    endingTurn = null;
  }
}

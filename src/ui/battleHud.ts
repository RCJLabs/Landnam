// Battle HUD: round/morale strip, selected unit card, actions, battle result.

import { Battle, GameRun, TacticalIntent, Unit } from '../sim/types';
import { isRouting, livingUnits } from '../sim/tactical/combatMath';
import { el, button, replaceChildren } from './dom';

function unitCard(u: Unit): HTMLElement {
  return el('div', { class: 'stat unit-card' }, [
    el('span', { class: 'stat-label' }, [u.name]),
    el('span', { class: 'stat-value' }, [
      `${u.hp}/${u.hpMax} hp · atk ${u.atk} · def ${u.def} · move ${u.movesLeft}${u.hasActed ? ' · acted' : ''}`,
    ]),
  ]);
}

export function renderBattleHud(
  root: HTMLElement,
  run: GameRun,
  battle: Battle,
  selectedId: string | null,
  pendingPush: boolean,
  onTogglePush: () => void,
  dispatch: (intent: TacticalIntent) => void,
): void {
  const strip = el('div', { class: 'hud-strip' }, [
    el('div', { class: 'stat' }, [
      el('span', { class: 'stat-label' }, ['Round']),
      el('span', { class: 'stat-value' }, [String(battle.round)]),
    ]),
    el('div', { class: 'stat' }, [
      el('span', { class: 'stat-label' }, ['Crew']),
      el('span', { class: 'stat-value' }, [
        `${livingUnits(battle, 'player').length} · morale ${battle.sideMorale.player}`,
      ]),
    ]),
    el('div', { class: 'stat' }, [
      el('span', { class: 'stat-label' }, ['Foe']),
      el('span', { class: 'stat-value' }, [
        `${livingUnits(battle, 'enemy').length} · morale ${battle.sideMorale.enemy}`,
      ]),
    ]),
  ]);

  const selected = selectedId ? battle.units.find((u) => u.id === selectedId) : undefined;
  if (selected && selected.alive && !selected.escaped) strip.append(unitCard(selected));

  const actions = el('div', { class: 'hud-actions' });
  if (
    selected &&
    selected.side === 'player' &&
    selected.alive &&
    !selected.hasActed &&
    !isRouting(selected)
  ) {
    actions.append(
      button('Brace', () => dispatch({ type: 'T_BRACE', unitId: selected.id }), {
        title: '+2 defense until your next turn; shakes off fatigue',
      }),
      button(pendingPush ? 'Push: pick a foe…' : 'Push', onTogglePush, {
        title: 'Contested shove — a foe pushed into water is finished',
        class: pendingPush ? 'btn-primary' : '',
      }),
    );
    if (selected.isLeader) {
      actions.append(
        button('Rally', () => dispatch({ type: 'T_RALLY', unitId: selected.id }), {
          title: 'Steady the line: +3 morale, nearby routing allies recover',
        }),
      );
    }
  }
  actions.append(
    button('End turn', () => dispatch({ type: 'T_END_TURN' }), { class: 'btn-primary' }),
  );

  const hint = el('div', { class: 'battle-hint' }, [
    pendingPush
      ? 'Click an adjacent foe to shove them'
      : selected
        ? 'Click a dashed hex to move · click an adjacent foe to strike'
        : 'Click one of your warriors to command them',
  ]);

  const logBox = el('div', { class: 'log-box' });
  for (const entry of run.log.slice(-14)) {
    logBox.append(el('div', { class: `log-line log-${entry.tone}` }, [entry.text]));
  }

  replaceChildren(root, strip, actions, hint, logBox);
  logBox.scrollTop = logBox.scrollHeight;
}

export function renderBattleResult(
  battle: Battle,
  dispatch: (intent: TacticalIntent) => void,
): HTMLElement {
  const overlay = el('div', { class: 'overlay overlay-light' });
  const won = battle.result === 'won';
  const panel = el('div', { class: 'panel' }, [
    el('h2', { class: won ? 'title-good' : 'title-grim' }, [won ? 'The Field Is Yours' : 'Driven Back']),
    el('p', { class: 'event-text' }, [
      won ? battle.lootText : 'The shore fight is lost. The survivors fall back to the sea.',
    ]),
    button('Continue', () => dispatch({ type: 'BATTLE_CONTINUE' }), { class: 'btn-primary' }),
  ]);
  overlay.append(panel);
  return overlay;
}

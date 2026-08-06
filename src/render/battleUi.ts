// Battle chrome: whose turn it is, what they have left, the blow-by-blow,
// and the card that hands the field back to travel.

import type { GameState } from '../state/types';
import { activeCombatant, fighterPerson, isWarbandTurn, standing } from '../sim/battle';
import type { Dispatch } from './ui';
import { button, el } from './svg';

export function renderBattleBar(state: GameState): HTMLElement {
  const battle = state.battle!;
  const active = activeCombatant(battle);
  const person = active ? fighterPerson(state, active.personId) : undefined;

  const stat = (label: string, value: string, warn = false) =>
    el('div', { class: `stat${warn ? ' warn' : ''}` }, [
      el('span', { class: 'stat-label' }, [label]),
      el('span', { class: 'stat-value' }, [value]),
    ]);

  const bar = el('div', { class: 'topbar' }, [
    stat('Round', `${battle.round}`),
    stat('Ours', `${standing(battle, 'warband').length}`),
    stat('Theirs', `${standing(battle, 'foe').length}`),
  ]);

  if (person && active) {
    bar.append(
      stat(
        active.side === 'warband' ? 'Acting' : 'Their turn',
        `${person.name} ${person.health}/${person.maxHealth}`,
        person.health <= person.maxHealth * 0.3,
      ),
      stat('Steps', `${active.movesLeft}`, active.movesLeft === 0),
    );
  }
  return bar;
}

export function renderBattleActions(state: GameState, dispatch: Dispatch): HTMLElement {
  const battle = state.battle!;
  const bar = el('div', { class: 'actionbar' });
  if (battle.outcome) return bar;

  const active = activeCombatant(battle);
  const person = active ? fighterPerson(state, active.personId) : undefined;

  if (isWarbandTurn(state) && active && person) {
    bar.append(
      button(
        active.hasActed ? 'Struck' : 'Strike: tap a foe',
        () => undefined,
        { class: 'action', disabled: active.hasActed ? 'true' : 'false' },
      ),
      button('End turn', () => dispatch({ type: 'B_END_TURN' }), { class: 'action primary' }),
    );
  }
  return bar;
}

export function renderBattleHint(state: GameState): HTMLElement {
  const battle = state.battle!;
  if (battle.outcome) return el('div', { class: 'hint' }, ['The field is settled.']);
  if (!isWarbandTurn(state)) return el('div', { class: 'hint' }, ['They are moving.']);
  const active = activeCombatant(battle);
  const person = active ? fighterPerson(state, active.personId) : undefined;
  return el('div', { class: 'hint' }, [
    person ? `${person.name}: tap a dashed hex to move, a ringed foe to strike` : 'Waiting',
  ]);
}

export function renderBattleLog(state: GameState): HTMLElement {
  const battle = state.battle!;
  const list = el('div', { class: 'saga-entries' });
  for (const line of battle.log.slice(-40)) {
    list.append(el('p', { class: 'saga-line' }, [line]));
  }
  const panel = el('div', { class: 'saga expanded' }, [
    el('div', { class: 'saga-toggle' }, ['The fight']),
    list,
  ]);
  queueMicrotask(() => {
    list.scrollTop = list.scrollHeight;
  });
  return panel;
}

export function renderBattleResult(state: GameState, dispatch: Dispatch): HTMLElement {
  const battle = state.battle!;
  const won = battle.outcome === 'won';
  const downed = battle.combatants.filter((c) => c.side === 'warband' && c.down).length;

  const lines: string[] = [];
  if (won) {
    lines.push(
      downed > 0
        ? `The field is ours. ${downed} of us were carried off it.`
        : 'The field is ours, and every one of us walked off it.',
    );
  } else {
    lines.push('We could not hold. What we left behind, we left behind.');
  }

  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: won ? 'good' : 'grim' }, [won ? 'The Field Is Ours' : 'They Broke Us']),
      ...lines.map((line) => el('p', { class: 'event-body' }, [line])),
      button('Back to the road', () => dispatch({ type: 'B_LEAVE' }), { class: 'primary wide' }),
    ]),
  ]);
}

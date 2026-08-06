// Battle chrome: whose turn it is, what they have left, the blow-by-blow,
// and the card that hands the field back to travel.

import type { GameState } from '../state/types';
import { activeCombatant, fighterPerson, isWarbandTurn, standing } from '../sim/battle';
import { throwTargets } from '../sim/battleActions';
import { wallBonus, wallLinks } from '../sim/wall';
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
    const links = wallLinks(battle, active).length;
    bar.append(
      // The name is the label and the health is the value: one long string
      // holding both was what overflowed the cell in the first place, and
      // whose turn it is already reads off the hint line.
      stat(person.name, `${person.health}/${person.maxHealth}`,
        person.health <= person.maxHealth * 0.3),
      stat('Nerve', active.broken ? 'BROKEN' : `${Math.round(active.nerve)}`, active.nerve < 30),
      stat('Wall', links > 0 ? `+${wallBonus(battle, active)}` : '—', links === 0),
      stat('Steps', `${active.movesLeft}`, active.movesLeft === 0),
    );
  }
  return bar;
}

/** Which tap-target action the player has armed. */
export type Aim = 'strike' | 'throw' | 'shove';

export function renderBattleActions(
  state: GameState,
  aim: Aim,
  setAim: (aim: Aim) => void,
  dispatch: Dispatch,
): HTMLElement {
  const battle = state.battle!;
  const bar = el('div', { class: 'actionbar' });
  if (battle.outcome) return bar;

  const active = activeCombatant(battle);
  if (!isWarbandTurn(state) || !active) return bar;

  const spent = active.hasActed;
  const aimButton = (id: Aim, label: string, enabled: boolean) => {
    const node = button(label, () => setAim(id), {
      class: `action${aim === id ? ' primary' : ''}`,
    });
    if (!enabled) node.setAttribute('disabled', 'true');
    return node;
  };

  bar.append(
    aimButton('strike', 'Strike', !spent),
    aimButton('throw', `Throw${active.throwsLeft > 0 ? ` ${active.throwsLeft}` : ''}`,
      !spent && active.throwsLeft > 0 && throwTargets(state).length > 0),
    aimButton('shove', 'Shove', !spent),
  );

  const second = el('div', { class: 'actionbar' });
  const defend = button('Shield', () => dispatch({ type: 'B_DEFEND' }), { class: 'action' });
  if (spent) defend.setAttribute('disabled', 'true');
  const dash = button('Run', () => dispatch({ type: 'B_DASH' }), { class: 'action' });
  if (spent) dash.setAttribute('disabled', 'true');
  second.append(
    defend,
    dash,
    button('End turn', () => dispatch({ type: 'B_END_TURN' }), { class: 'action primary' }),
  );

  const wrap = el('div', { class: 'action-stack' }, [bar, second]);
  return wrap;
}

const AIM_HINT: Record<Aim, string> = {
  strike: 'tap a ringed foe to strike',
  throw: 'tap a marked foe to throw',
  shove: 'tap a ringed foe to shove them back',
};

export function renderBattleHint(state: GameState, aim: Aim): HTMLElement {
  const battle = state.battle!;
  if (battle.outcome) return el('div', { class: 'hint' }, ['The field is settled.']);
  if (!isWarbandTurn(state)) return el('div', { class: 'hint' }, ['They are moving.']);
  const active = activeCombatant(battle);
  const person = active ? fighterPerson(state, active.personId) : undefined;
  if (!person || !active) return el('div', { class: 'hint' }, ['Waiting']);

  const parts: string[] = [];
  if (active.movesLeft > 0) parts.push('tap a dashed hex to move');
  if (!active.hasActed) parts.push(AIM_HINT[aim]);
  if (parts.length === 0) parts.push('nothing left this turn — end it');
  return el('div', { class: 'hint' }, [`${person.name}: ${parts.join(' · ')}`]);
}

export function renderBattleLog(state: GameState): HTMLElement {
  const battle = state.battle!;
  const list = el('div', { class: 'saga-entries' });
  for (const line of battle.log.slice(-40)) {
    list.append(el('p', { class: 'saga-line' }, [line]));
  }
  const panel = el('div', { class: 'saga expanded fight' }, [
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
  const ran = battle.combatants.filter((c) => c.side === 'warband' && c.fled).length;

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
  if (ran > 0) {
    lines.push(`${ran} of us ran, and nobody spoke of it afterward.`);
  }

  return el('div', { class: 'overlay' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: won ? 'good' : 'grim' }, [won ? 'The Field Is Ours' : 'They Broke Us']),
      ...lines.map((line) => el('p', { class: 'event-body' }, [line])),
      button('Back to the road', () => dispatch({ type: 'B_LEAVE' }), { class: 'primary wide' }),
    ]),
  ]);
}

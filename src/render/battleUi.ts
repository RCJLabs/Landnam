// Battle chrome: whose turn it is, what they have left, the blow-by-blow,
// and the card that hands the field back to travel.

import type { GameState } from '../state/types';
import { activeCombatant, fighterPerson, isWarbandTurn, standing } from '../sim/battle';
import { throwTargets, reachTargets } from '../sim/strike';
import { canWarCry, isLeader } from '../sim/warcry';
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
export type Aim = 'strike' | 'throw' | 'reach';

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

  // Broken counts as spent, and until 9.13 it did not: every verb in the sim
  // refuses a man whose nerve has gone — `broken` sits in the same guard as
  // `hasActed` — but this line asked only whether he had acted, so he was
  // shown a live Strike and Throw that silently did nothing when
  // tapped. Controls that look able and are not are worse than absent ones.
  const spent = active.hasActed || active.broken;
  const aimButton = (id: Aim, label: string, enabled: boolean) => {
    const node = button(label, () => setAim(id), {
      class: `action${aim === id ? ' primary' : ''}`,
    });
    if (!enabled) node.setAttribute('disabled', 'true');
    return node;
  };

  // Spear appears only when there is actually a mate to thrust past, which
  // is the whole rule — a button that is always there would teach the player
  // it is a weapon rather than a position.
  const canSpear = !spent && reachTargets(state).length > 0;
  bar.append(
    aimButton('strike', 'Strike', !spent),
    aimButton('throw', `Throw${active.throwsLeft > 0 ? ` ${active.throwsLeft}` : ''}`,
      !spent && active.throwsLeft > 0 && throwTargets(state).length > 0),
  );
  if (canSpear) bar.append(aimButton('reach', 'Spear', true));

  const second = el('div', { class: 'actionbar' });
  const defend = button('Shield', () => dispatch({ type: 'B_DEFEND' }), { class: 'action' });
  if (spent) defend.setAttribute('disabled', 'true');
  // The Run button stood beside the shield until 9.1b. Changing rank is not
  // something anybody spends an action on any more — the line closes itself
  // on a man with nothing legal left (see sim/footwork.ts) — so there is
  // nothing here to press.
  second.append(defend);
  // The leader's button, and only the leader's: its absence on everyone
  // else's turn is what makes leading mean something.
  if (isLeader(state, active)) {
    const cry = button('War-cry', () => dispatch({ type: 'B_WARCRY' }), {
      class: 'action warcry',
      title: 'Once a fight: heart into every friend in earshot, dread into every foe.',
    });
    if (!canWarCry(state)) cry.setAttribute('disabled', 'true');
    second.append(cry);
  }
  // END TURN IS A CHOICE ONLY BEFORE THE BLOW (9.13). Declining to act is a
  // real decision — on a rank that reaches nobody it is often the right one —
  // so the button stays for a fighter who has not acted. After acting it had
  // exactly one outcome and the turn now takes it without being asked, so
  // offering it would be offering to do what is already happening.
  //
  // It keeps the name it had. "Hold and end turn" reads better for what it
  // now exclusively means, and it is not worth it: two browser bars match
  // this label exactly, and "End turn" is still what the button does.
  if (!spent) {
    second.append(
      button('End turn', () => dispatch({ type: 'B_END_TURN' }), { class: 'action primary' }),
    );
  }

  const wrap = el('div', { class: 'action-stack' }, [bar, second]);
  return wrap;
}

const AIM_HINT: Record<Aim, string> = {
  strike: 'tap a marked foe to strike',
  throw: 'tap a marked foe to throw',
  reach: 'tap a marked foe to thrust past your shield-brother',
};

export function renderBattleHint(state: GameState, aim: Aim): HTMLElement {
  const battle = state.battle!;
  if (battle.outcome) return el('div', { class: 'hint' }, ['The field is settled.']);
  if (!isWarbandTurn(state)) return el('div', { class: 'hint' }, ['They are moving.']);
  const active = activeCombatant(battle);
  const person = active ? fighterPerson(state, active.personId) : undefined;
  if (!person || !active) return el('div', { class: 'hint' }, ['Waiting']);

  const parts: string[] = [];
  if (!active.hasActed) parts.push(AIM_HINT[aim]);
  // THE SHIELD'S ONE CASE (9.1) STOOD HERE, AND 9.1b OVERTURNED IT.
  //
  // The line said "hurt — the shield is worth more than the swing", on a
  // measurement of 49 wins in 60 against 46 for always swinging. Re-taken on
  // the same instrument after the line began closing itself, the arm INVERTS:
  // 31 in 60 against 42, paired won 0 and lost 11. Fights are more crowded
  // now — men who used to stand safe in the back rank walk into the wall — so
  // a turn spent on the shield instead of the blow costs more than it saves.
  //
  // The sentence is gone rather than left saying something the harness calls
  // false, and `shieldAdvised` has followed it. The arm that had never been
  // run settled it: set the shield ONLY when there is nothing to attack — the
  // one case that costs no blow — and it ties swinging-always exactly,
  // because over sixty fights the front two had something to hit on EVERY
  // turn. The walls deploy in contact and `defend` is a front-two verb, so
  // the shield's free case does not exist here; it can only be bought with a
  // blow, and buying it loses. A helper that advised buying it is worse than
  // no helper. See sim/footwork.ts.
  //
  // The Shield BUTTON stays. The foe AI reaches for it, nothing measures that
  // as wrong, and a player is entitled to a defensive choice the harness
  // dislikes. Whether it should cost less than a whole turn is a design
  // ruling and not a thing to invent here.
  //
  // "or push forward a rank" stood beside it and named the Run button, which
  // 9.1b deleted. The look bar caught it: `fight-late@320x568` still offered
  // a control that was no longer on the screen. Third lie in this one slot,
  // after "tap a dashed hex to move" — so the hint now names no control for
  // where a man stands, because there is nothing to name.
  // "nothing left this turn — end it" stood here, and 9.13 deleted the tap it
  // was asking for: the turn now ends itself. What is left to say is what is
  // HAPPENING, not what to press.
  if (parts.length === 0) parts.push('the blow is struck');
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

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: won ? 'good' : 'grim' }, [won ? 'The Field Is Ours' : 'They Broke Us']),
      ...lines.map((line) => el('p', { class: 'event-body' }, [line])),
      button('Back to the road', () => dispatch({ type: 'B_LEAVE' }), { class: 'primary wide' }),
    ]),
  ]);
}

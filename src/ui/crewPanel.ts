// Crew roster: stats, hp, condition. Read-only in P2.

import { CrewMember, GameRun } from '../sim/types';
import { el, button } from './dom';

function crewRow(c: CrewMember): HTMLElement {
  const condition = !c.alive
    ? 'Dead'
    : c.hp < c.hpMax / 2
      ? 'Wounded'
      : c.fatigue > 4
        ? 'Weary'
        : 'Hale';
  return el('div', { class: `crew-row${c.alive ? '' : ' crew-dead'}` }, [
    el('span', { class: 'crew-name' }, [
      `${c.isCaptain ? '★ ' : ''}${c.name}${c.epithet ? ' ' + c.epithet : ''}`,
    ]),
    el('span', { class: 'crew-stats' }, [
      `Might ${c.might} · Skill ${c.skill} · Guts ${c.guts} · Sea ${c.sea}`,
    ]),
    el('span', { class: 'crew-hp' }, [c.alive ? `${c.hp}/${c.hpMax} hp · ${condition}` : condition]),
  ]);
}

export function renderCrewPanel(run: GameRun, onClose: () => void): HTMLElement {
  const overlay = el('div', { class: 'overlay overlay-light' });
  const panel = el('div', { class: 'panel crew-panel' }, [
    el('h2', { class: 'event-title' }, [`Crew of the ${run.ship.name}`]),
    ...run.crew.map(crewRow),
    button('Close', onClose, { class: 'btn-primary' }),
  ]);
  overlay.append(panel);
  return overlay;
}

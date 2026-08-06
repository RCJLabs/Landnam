// Crew roster: stats, hp, condition. Read-only in P2.

import { CrewMember, GameRun } from '../sim/types';
import { effStat } from '../sim/strategic/crewGen';
import { el, button } from './dom';

function statText(c: CrewMember, label: string, stat: 'might' | 'skill' | 'guts' | 'sea'): string {
  const eff = effStat(c, stat);
  return eff < c[stat] ? `${label} ${eff} (${c[stat]})` : `${label} ${c[stat]}`;
}

function crewRow(c: CrewMember): HTMLElement {
  const condition = !c.alive
    ? 'Dead'
    : c.injuries.length > 0
      ? c.injuries.map((i) => i.label).join(', ')
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
      [statText(c, 'Might', 'might'), statText(c, 'Skill', 'skill'), statText(c, 'Guts', 'guts'), statText(c, 'Sea', 'sea')].join(' · '),
    ]),
    el('span', { class: 'crew-hp' }, [
      c.alive ? `${c.hp}/${c.hpMax} hp${c.fatigue > 0 ? ` · fatigue ${c.fatigue}` : ''} · ${condition}` : condition,
    ]),
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

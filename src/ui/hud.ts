// Voyage HUD: resource strip, action buttons, log.

import { GameRun, StrategicIntent } from '../sim/types';
import { BALANCE } from '../content/balance';
import { livingCrew } from '../sim/strategic/sail';
import { portHere } from '../sim/strategic/ports';
import { el, button, replaceChildren } from './dom';

export function renderHud(
  root: HTMLElement,
  run: GameRun,
  dispatch: (intent: StrategicIntent) => void,
  onToggleCrew: () => void,
): void {
  const stat = (label: string, value: string, warn = false) =>
    el('div', { class: `stat${warn ? ' stat-warn' : ''}` }, [
      el('span', { class: 'stat-label' }, [label]),
      el('span', { class: 'stat-value' }, [value]),
    ]);

  const winterIn = BALANCE.morale.winterOnset - run.turn;
  const strip = el('div', { class: 'hud-strip' }, [
    stat('Turn', String(run.turn)),
    winterIn > 0 ? stat('Winter in', String(winterIn), winterIn <= 15) : stat('Winter', 'HERE', true),
    stat('Crew', String(livingCrew(run)), livingCrew(run) <= 3),
    stat('Food', String(Math.floor(run.food)), run.food < 8),
    stat('Water', String(Math.floor(run.water)), run.water < 8),
    stat('Hull', `${run.ship.hull}/${run.ship.hullMax}`, run.ship.hull <= 6),
    stat('Morale', String(Math.round(run.moraleShip)), run.moraleShip < 30),
    stat('Silver', String(run.silver)),
    stat('Timber', String(run.timber)),
  ]);

  const actions = el('div', { class: 'hud-actions' });
  actions.append(button('Crew', onToggleCrew, { title: 'View the crew roster' }));
  if (run.phase === 'voyage') {
    const port = portHere(run);
    if (port) {
      actions.append(
        button(`Dock at ${port.name}`, () => dispatch({ type: 'DOCK' }), { class: 'btn-primary' }),
      );
    }
    actions.append(
      button('Hold position', () => dispatch({ type: 'WAIT' }), {
        title: 'Hold a turn: fish (+food), catch rain (+water), rest wounds and fatigue',
      }),
    );
    if (run.timber > 0 && run.ship.hull < run.ship.hullMax) {
      actions.append(
        button('Patch hull', () => dispatch({ type: 'REPAIR' }), { title: 'Spend timber to repair' }),
      );
    }
    actions.append(
      button('Give up the voyage', () => {
        if (confirm('Turn back for home? The run ends and half your fame is kept.')) {
          dispatch({ type: 'ABANDON_RUN' });
        }
      }, { class: 'btn-danger' }),
    );
  }

  const logBox = el('div', { class: 'log-box' });
  for (const entry of run.log.slice(-40)) {
    logBox.append(el('div', { class: `log-line log-${entry.tone}` }, [entry.text]));
  }

  replaceChildren(root, strip, actions, logBox);
  logBox.scrollTop = logBox.scrollHeight;
}

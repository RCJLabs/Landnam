// Port screen: buy supplies, repair, recruit, leave.

import { GameRun, StrategicIntent } from '../sim/types';
import { el, button } from './dom';

export function renderPortPanel(
  run: GameRun,
  dispatch: (intent: StrategicIntent) => void,
): HTMLElement {
  const port = run.activePort!;
  const s = port.stock;
  const overlay = el('div', { class: 'overlay overlay-light' });

  const tradeRow = (label: string, item: 'food' | 'water' | 'timber', price: number) =>
    el('div', { class: 'trade-row' }, [
      el('span', { class: 'trade-label' }, [`${label} — ${price} silver`]),
      button('+1', () => dispatch({ type: 'PORT_BUY', item, qty: 1 })),
      button('+5', () => dispatch({ type: 'PORT_BUY', item, qty: 5 })),
    ]);

  const panel = el('div', { class: 'panel port-panel' }, [
    el('h2', { class: 'event-title' }, [port.name]),
    el('p', { class: 'port-sub' }, [
      port.isHome ? 'Home port. The ale is familiar and the prices honest.' : 'A foreign quay. Sharp eyes and sharper prices.',
    ]),
    el('p', { class: 'port-purse' }, [
      `Purse: ${run.silver} silver · Hold: ${Math.floor(run.food)} food, ${Math.floor(run.water)} water, ${run.timber} timber`,
    ]),
    tradeRow('Food', 'food', s.foodPrice),
    tradeRow('Water', 'water', s.waterPrice),
    tradeRow('Timber', 'timber', s.timberPrice),
  ]);

  if (run.ship.hull < run.ship.hullMax) {
    panel.append(
      el('div', { class: 'trade-row' }, [
        el('span', { class: 'trade-label' }, [
          `Hull ${run.ship.hull}/${run.ship.hullMax} — ${s.repairPricePerHull} silver per plank`,
        ]),
        button('Repair all', () => dispatch({ type: 'PORT_REPAIR' })),
      ]),
    );
  }

  if (s.recruits.length > 0) {
    panel.append(el('h3', { class: 'port-heading' }, ['Hands for hire — 5 silver']));
    for (const r of s.recruits) {
      panel.append(
        el('div', { class: 'trade-row' }, [
          el('span', { class: 'trade-label' }, [
            `${r.name}${r.epithet ? ' ' + r.epithet : ''} · M${r.might} S${r.skill} G${r.guts} Sea${r.sea}`,
          ]),
          button('Hire', () => dispatch({ type: 'PORT_RECRUIT', recruitId: r.id })),
        ]),
      );
    }
  }

  panel.append(button('Cast off', () => dispatch({ type: 'PORT_LEAVE' }), { class: 'btn-primary cast-off' }));
  overlay.append(panel);
  return overlay;
}

// Title screen: continue or start a new voyage, and the fame legacy shop.

import { MetaProfile } from '../sim/types';
import { UNLOCKS } from '../content/unlocks';
import { el, button } from './dom';

export function renderTitle(
  meta: MetaProfile,
  hasSave: boolean,
  onContinue: () => void,
  onNewRun: (seed?: string) => void,
  onBuyUnlock: (id: string) => void,
): HTMLElement {
  const overlay = el('div', { class: 'overlay title-screen' });
  const seedInput = el('input', {
    type: 'text',
    placeholder: 'seed (optional)',
    class: 'seed-input',
    'aria-label': 'seed',
  });
  const children: (HTMLElement | string)[] = [
    el('h1', { class: 'game-title' }, ['WHALE ROAD']),
    el('p', { class: 'subtitle' }, ['A saga of salt, silver, and the long way west']),
  ];
  if (meta.runsPlayed > 0) {
    children.push(
      el('p', { class: 'meta-line' }, [
        `Fame: ${meta.fame} · Voyages: ${meta.runsPlayed} · Vinland reached: ${meta.victories}`,
      ]),
    );
  }
  const buttons = el('div', { class: 'title-buttons' });
  if (hasSave) {
    buttons.append(button('Continue voyage', onContinue, { class: 'btn-primary' }));
  }
  buttons.append(
    button(hasSave ? 'New voyage' : 'Set sail', () => onNewRun(seedInput.value.trim() || undefined), {
      class: hasSave ? '' : 'btn-primary',
    }),
  );
  children.push(buttons, seedInput);

  // Legacy shop appears once there is fame to brag about.
  if (meta.runsPlayed > 0) {
    const owned = new Set(meta.unlocks);
    const shop = el('div', { class: 'legacy-shop' }, [
      el('h3', { class: 'port-heading' }, ['Legacy of the Line']),
    ]);
    for (const u of UNLOCKS) {
      const row = el('div', { class: 'trade-row' }, [
        el('span', { class: 'trade-label' }, [
          el('strong', {}, [u.name]),
          el('span', { class: 'legacy-blurb' }, [` — ${u.blurb}`]),
        ]),
      ]);
      if (owned.has(u.id)) {
        row.append(el('span', { class: 'legacy-owned' }, ['Yours']));
      } else if (meta.fame >= u.cost) {
        row.append(button(`${u.cost} fame`, () => onBuyUnlock(u.id)));
      } else {
        row.append(el('span', { class: 'legacy-locked' }, [`${u.cost} fame`]));
      }
      shop.append(row);
    }
    children.push(shop);
  }

  const panel = el('div', { class: 'panel title-panel' }, children);
  overlay.append(panel);
  return overlay;
}

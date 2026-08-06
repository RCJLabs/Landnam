// Title screen: continue or start a new voyage (optionally with a chosen seed).

import { MetaProfile } from '../sim/types';
import { el, button } from './dom';

export function renderTitle(
  meta: MetaProfile,
  hasSave: boolean,
  onContinue: () => void,
  onNewRun: (seed?: string) => void,
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
  const panel = el('div', { class: 'panel title-panel' }, children);
  overlay.append(panel);
  return overlay;
}

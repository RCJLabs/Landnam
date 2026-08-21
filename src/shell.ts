// The persistent frame every mode paints into, and what a screen reader is
// told about it. The slots outlive each render on purpose — replacing them
// wholesale would cost the map its camera — and there is exactly one screen,
// so they are module-level the same way main.ts keeps one state reference.

import { el } from './render/svg';
import type { GameState } from './state/types';
import type { OverlayHooks } from './render/overlays';
import { announce } from './sim/announce';

export const topbarSlot = el('div', { class: 'slot topbar-slot' });
export const mapSlot = el('div', { class: 'slot map-slot' });
export const hintSlot = el('div', { class: 'slot hint-slot' });
export const actionSlot = el('div', { class: 'slot action-slot' });
export const sagaSlot = el('div', { class: 'slot saga-slot' });
export const overlaySlot = el('div', { class: 'slot overlay-slot' });

/**
 * What a screen reader hears. Audit item 10.
 *
 * Off-screen and always present: a polite live region is only announced when
 * its contents CHANGE, so it has to exist from the first render and be
 * rewritten rather than replaced. The game is turn-based and every action
 * rewrites the whole page, which is exactly the case a live region is for —
 * without one a listener took an action and was told nothing at all.
 *
 * `announce()` is pure and lives in src/sim, with the tests. This is only
 * the wire.
 */
const criesSlot = el('div', {
  class: 'offscreen',
  'aria-live': 'polite',
  'aria-atomic': 'true',
  role: 'status',
});
let criedFrom = 0;

/** Says what just happened, then where we stand. */
export function cry(state: GameState): void {
  const text = announce(state, criedFrom);
  criedFrom = state.saga.length;
  // Same string twice is not a change and would be swallowed; a hair of
  // difference is cheaper than tracking every reason it might repeat.
  criesSlot.textContent = criesSlot.textContent === text ? `${text} ` : text;
}

/**
 * Gives every card that covers the screen the semantics of one.
 *
 * Twelve overlay sites all build `.overlay`, and each is now `role="dialog"`
 * `aria-modal="true"` — but a dialog also needs a NAME and needs the reading
 * position to be inside it, or a listener is told "dialog" and left at the
 * top of the page behind it. Both come off the card's own heading, so no
 * call site has to remember anything.
 */
export function nameOverlays(): void {
  for (const node of overlaySlot.querySelectorAll('[role="dialog"]')) {
    const heading = node.querySelector('h2');
    if (heading?.textContent) node.setAttribute('aria-label', heading.textContent);
    const card = node.querySelector<HTMLElement>('.card');
    if (!card) continue;
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
    if (!node.contains(document.activeElement)) card.focus({ preventScroll: true });
  }
}

export function shell(): HTMLElement {
  return el('div', { class: 'shell' }, [
    criesSlot,
    topbarSlot,
    mapSlot,
    hintSlot,
    actionSlot,
    sagaSlot,
    overlaySlot,
  ]);
}

/** replaceChildren wants a list; a missing overlay is an empty one. */
export function asNodes(node: HTMLElement | null): HTMLElement[] {
  return node ? [node] : [];
}

/**
 * What a mode screen needs from the shell's owner: the overlay hooks, plus a
 * way to read the CURRENT state, because a tap handler outlives the render
 * that installed it.
 */
export interface ScreenHooks extends OverlayHooks {
  current: () => GameState | null;
}

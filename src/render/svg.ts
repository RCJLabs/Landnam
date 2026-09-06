// Minimal SVG/DOM construction helpers. Renderers are pure views: they read
// state and produce elements. No game logic lives here.

import { play } from '../audio/engine';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  children: Node[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  attrs: Record<string, string> = {},
): HTMLButtonElement {
  const node = el('button', { type: 'button', ...attrs }, [label]);
  node.addEventListener('click', (e) => {
    e.preventDefault();
    // Every button in the game comes through here, so this is the one place a
    // tap needs a sound. It fires BEFORE the handler, so a button that also
    // swings an axe reads as a click and then a blow — which is the order the
    // player's finger and the game actually go in. Kept very quiet on purpose:
    // it is heard hundreds of times a run.
    play('tap');
    onClick();
  });
  return node;
}

export function clear(node: Element): void {
  node.replaceChildren();
}

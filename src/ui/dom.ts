// Tiny DOM helpers — the whole UI is coarse-grained "replace this panel's
// contents on state change", no framework needed.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) throw new Error('use addEventListener, not on* attrs');
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  attrs: Record<string, string> = {},
): HTMLButtonElement {
  const b = el('button', attrs, [label]);
  b.addEventListener('click', onClick);
  return b;
}

export function replaceChildren(parent: HTMLElement, ...children: (Node | string)[]): void {
  parent.replaceChildren(...children);
}

export function must<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

// Minimal SVG/DOM construction helpers. Renderers are pure views: they read
// state and produce elements. No game logic lives here.

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
    onClick();
  });
  return node;
}

export function clear(node: Element): void {
  node.replaceChildren();
}

/** Shared filter/gradient defs — water shimmer and parchment grain. */
export function mapDefs(): SVGDefsElement {
  const defs = svgEl('defs');

  // Restless sea: low-frequency turbulence displacing a flat fill.
  const water = svgEl('filter', {
    id: 'water',
    x: '-20%',
    y: '-20%',
    width: '140%',
    height: '140%',
  });
  water.append(
    svgEl('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.014 0.05',
      numOctaves: '3',
      seed: '7',
      result: 'noise',
    }),
    svgEl('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'noise',
      scale: '9',
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );

  // Soft haze over remembered-but-unseen country.
  const fog = svgEl('filter', { id: 'fog', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  fog.append(
    svgEl('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.05',
      numOctaves: '2',
      seed: '3',
      result: 'grain',
    }),
    svgEl('feColorMatrix', { in: 'grain', type: 'saturate', values: '0', result: 'grey' }),
    svgEl('feComposite', { in: 'SourceGraphic', in2: 'grey', operator: 'over' }),
  );

  defs.append(water, fog);
  return defs;
}

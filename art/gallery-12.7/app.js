const DIRECTIONS = [
  {
    id: 'stands', fn: 'asItStands', kind: 'svg',
    name: 'As it stands',
    tech: 'SVG', control: true,
    thesis: 'The game today, drawn from the same data as the other nine. Without it on the wall there is nothing to prefer anything to.',
    assets: 'n/a — this is the baseline.',
    cost: 'None. It is what ships.',
  },
  {
    id: 'woodcut', fn: 'woodcut', kind: 'svg',
    name: 'Woodcut',
    tech: 'SVG',
    thesis: 'Heavy keylines, hatching for tone, one spot colour on the whole block. Reads at arm’s length on a phone in a way none of the painted directions do.',
    assets: 'Little. Hatching is a pattern tile, and the repo already treats a tile as a paint (render/knot.ts).',
    cost: 'Lowest of the nine. Stays SVG, so every bar keeps its selectors. Drops the built page’s distinct colours sharply, which is a size win, not a cost.',
  },
  {
    id: 'embroidery', fn: 'embroidery', kind: 'svg',
    name: 'Embroidery',
    tech: 'SVG',
    thesis: 'Linen ground, wool laid in couched stitch, flat fills, figures in profile, a captioned border. The game is already side-on with figures in profile — this is the smallest change that reads as a different object.',
    assets: 'Little. The weave is a 3px tile; the stitch is a dashed stroke.',
    cost: 'Low. Quantises every look to a wool palette, so lookOf’s output is mapped rather than used raw — the one place it stops being “one person, one look” in the literal sense.',
  },
  {
    id: 'pixel', fn: 'pixel', kind: 'canvas',
    name: '16-bit pixel',
    tech: 'Canvas',
    thesis: 'A quarter-scale buffer, a sixteen-colour ramp, an ordered dither, blitted up hard-edged. The ramp is the game’s own palette.',
    assets: 'Large. Hand-drawn sprites would beat anything procedural here, and this is the direction where the zero-asset rule costs the most.',
    cost: 'High. The figures leave the DOM, so the CSS keyframes and every bar that counts SVG nodes need rewriting, and battle.ts’s pointer path converts screen to world through an SVG viewBox.',
  },
  {
    id: 'vellum', fn: 'vellum', kind: 'svg',
    name: 'Illuminated vellum',
    tech: 'SVG',
    thesis: 'Gold leaf, a rubricated initial, a decorated border, ruled text. The saga stops being a log beside the picture and becomes the object you are looking at.',
    assets: 'Some. Gold is a gradient; a real illuminator’s letterforms are not.',
    cost: 'Low to middling. Stays SVG. Wants a display face the game does not have, and the zero-asset rule means drawing it or living with a system serif.',
  },
  {
    id: 'runestone', fn: 'runestone', kind: 'svg',
    name: 'Carved rune-stone',
    tech: 'SVG',
    thesis: 'Every form cut three times — a pale edge, a dark edge, pigment in the groove — so it reads as incised rather than drawn. Grey granite, red in the cuts.',
    assets: 'Little. The speckle is procedural; the relief is two offset strokes.',
    cost: 'Middling. Three strokes per form is roughly triple the node count of the same drawing flat, which is the one thing the repo has measured itself against before.',
  },
  {
    id: 'inkwash', fn: 'inkwash', kind: 'canvas',
    name: 'Ink wash',
    tech: 'Canvas',
    thesis: 'A man is three strokes and no more. Tone builds where the brush lingered, the ground is mostly empty, and one red seal signs it.',
    assets: 'Some. Real brush textures would help; the wet edge is the hard part procedurally.',
    cost: 'High, same as pixel — it leaves the DOM. Also the least legible of the ten at 320px, which is the width the bars hold the game to.',
  },
  {
    id: 'papercraft', fn: 'papercraft', kind: 'svg',
    name: 'Papercraft',
    tech: 'SVG',
    thesis: 'Layered cut sheets, each with a shadow under it, so depth is physical rather than painted. The one modern mobile idiom on the wall.',
    assets: 'Little.',
    cost: 'Low, with one catch: a drop-shadow filter per layer is the most expensive thing on this page for a phone to composite, and the repo has already been bitten once by a backdrop that quietly repainted every turn.',
  },
  {
    id: 'terminal', fn: 'terminal', kind: 'svg',
    name: 'Glyph lattice',
    tech: 'DOM text',
    thesis: 'The same geometry resolved to a 7×11 character grid. Radical, nearly free, and honest about a game that is fundamentally numbers.',
    assets: 'None. This is the only direction the zero-asset rule costs nothing at all.',
    cost: 'Total, and cheap. Every visual bar becomes meaningless and would be deleted rather than translated — which is exactly what 8.5 did to the five map bars, so there is precedent for doing it honestly.',
  },
  {
    id: 'enamel', fn: 'enamel', kind: 'svg',
    name: 'Cloisonné enamel',
    tech: 'SVG',
    thesis: 'Gold wire bounds every cell; one saturated glass colour fills it. No blends anywhere — the wire draws and the glass colours. Period-plausible for the brooches these people actually wore.',
    assets: 'Little.',
    cost: 'Low. Stays SVG and halves the palette. Costs lookOf the most of any direction here: cell colours are chosen for the glass, so a person’s own shield ground stops being what you see.',
  },
];

function panelSVG(inner) {
  return `<svg viewBox="0 0 440 260" role="img" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

function build(scene, T) {
  const wall = document.getElementById('wall');
  for (const d of DIRECTIONS) {
    const fig = document.createElement('figure');
    fig.className = `panel${d.control ? ' control' : ''}`;
    fig.innerHTML = `
      <div class="plate" data-id="${d.id}"></div>
      <figcaption>
        <p class="eyebrow">${d.tech}${d.control ? ' · baseline' : ''}</p>
        <h3>${d.name}</h3>
        <p class="thesis">${d.thesis}</p>
        <dl class="spec">
          <dt>Costs</dt><dd>${d.cost}</dd>
          <dt>With assets</dt><dd>${d.assets}</dd>
        </dl>
      </figcaption>`;
    wall.append(fig);
    const plate = fig.querySelector('.plate');
    if (d.kind === 'canvas') {
      const c = document.createElement('canvas');
      c.className = 'cv';
      plate.append(c);
      const r = T[d.fn](scene, c);
      if (r && r.then) r.catch(() => {});
    } else {
      plate.innerHTML = panelSVG(T[d.fn](scene));
    }
  }
}

export function start(scene, T) {
  document.getElementById('prov-seed').textContent = scene.seed;
  document.getElementById('prov-day').textContent = scene.day;
  document.getElementById('prov-stop').textContent = scene.stop;
  document.getElementById('prov-country').textContent = `${scene.season}, ${scene.weather}, ${scene.country}`;
  document.getElementById('prov-steading').textContent = `${scene.steading.name} (${scene.steading.raised.length} raised)`;
  document.getElementById('prov-rival').textContent = scene.rival ?? '—';
  document.getElementById('prov-round').textContent = scene.round;
  const log = document.getElementById('prov-log');
  log.innerHTML = scene.log.map((l) => `<li>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('');
  build(scene, T);
}

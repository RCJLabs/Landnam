// Ten treatments of one moment.
//
// Each function takes the scene and returns SVG (or paints a canvas). They all
// call the same `figures()`, `parts()` and `roofline()` from geom.js, so what
// differs between any two panels is the MATERIAL — the ink, the ground, the
// mark — and never the subject. That is the whole design of this page: a
// style gallery whose panels show different things compares nothing.

import { W, H, px, py, figures, parts, fallenParts, roofline, makeRng } from './geom.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const n = (v) => Math.round(v * 100) / 100;

/** Place a unit-box part into panel space. */
function fit(f) {
  return {
    // A man occupies exactly FIGURE_W across his shoulders. This read
    // `f.w * 2.1` in the first cut and the wall came out a smear: the ranks
    // are 21px apart and every man was drawn 102px wide. The 2.29x overlap
    // that remains is the game's own — line.ts really does stand them that
    // close — and it is what makes a wall read as a wall.
    X: (ux) => n(f.cx + ux * f.w),
    Y: (uy) => n(f.feet - f.h + uy * f.h),
    S: (u) => n(u * f.h),
    W: (u) => n(u * f.w),
  };
}

/** A part path, with its unit coordinates mapped into the panel. */
function path(f, d) {
  const { X, Y } = fit(f);
  return d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, a, b) => `${X(+a)} ${Y(+b)}`);
}

// ---------------------------------------------------------------- 1. as it stands

export function asItStands(scene) {
  const rng = makeRng('stands');
  const fs = figures(scene);
  const roofs = roofline(scene, 150, 40, 400);
  let s = `<defs><linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c3a48"/><stop offset="1" stop-color="#6b7887"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#s1sky)"/>`;
  // Winter, and the band is camped — so this is night, the way render/light.ts
  // decides it: `hasCamped` plus the season, not an hour the sim does not have.
  s += `<circle cx="360" cy="44" r="15" fill="#dfe6ea" opacity=".85"/>`;
  s += roofs.map((r) => `<path d="M ${n(r.cx - r.w / 2)} ${r.y} L ${n(r.cx)} ${n(r.peak)} L ${n(r.cx + r.w / 2)} ${r.y} Z" fill="#3f4a5a"/>`).join('');
  s += `<rect x="0" y="150" width="${W}" height="${H - 150}" fill="#4a5340"/>`;
  s += `<rect x="0" y="150" width="${W}" height="4" fill="#5d6a4d"/>`;
  for (let i = 0; i < 26; i += 1) {
    const x = rng() * W; const h = 16 + rng() * 22;
    s += `<path d="M ${n(x)} 152 L ${n(x - h * 0.22)} ${n(152 - h)} L ${n(x + h * 0.22)} ${n(152 - h)} Z" fill="#2f3a2c" opacity=".8"/>`;
  }
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    if (f.down) {
      const p = fallenParts(f);
      s += `<path d="${path(f, p.body)}" fill="${f.tunic}" opacity=".9"/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#c6a184"/>`;
      s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="${f.field}" opacity=".8"/>`;
      continue;
    }
    const p = parts(f);
    s += `<ellipse cx="${X(p.shadow.cx)}" cy="${Y(p.shadow.cy)}" rx="${S(p.shadow.rx)}" ry="${S(p.shadow.ry)}" fill="#000" opacity=".28"/>`;
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="#8a6f43" stroke-width="2"/>`;
    s += `<path d="${path(f, p.cloak)}" fill="${f.cloak}"/>`;
    s += `<path d="${path(f, p.legBack)}" fill="#4a4033"/><path d="${path(f, p.legFront)}" fill="#5a4e3e"/>`;
    s += `<path d="${path(f, p.body)}" fill="${f.tunic}"/>`;
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#c6a184"/>`;
    s += `<path d="${path(f, p.hair)}" fill="${f.hair}"/>`;
    if (p.beard) s += `<path d="${path(f, p.beard)}" fill="${f.hair}"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="${f.field}"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx * 0.34)}" ry="${S(p.shield.ry * 0.34)}" fill="${f.accent}"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- 2. woodcut

export function woodcut(scene) {
  const rng = makeRng('woodcut');
  const fs = figures(scene);
  const roofs = roofline(scene, 150, 40, 400);
  const K = '#14110d';
  let s = `<defs>
    <pattern id="w2h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${K}" stroke-width="1.5"/></pattern>
    <pattern id="w2t" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <line x1="0" y1="0" x2="0" y2="4" stroke="${K}" stroke-width="1"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#e8dcc0"/>`;
  // Tone is hatching, never a tint: a block prints or it does not.
  s += `<rect x="0" y="0" width="${W}" height="150" fill="url(#w2t)" opacity=".5"/>`;
  s += roofs.map((r) => `<path d="M ${n(r.cx - r.w / 2)} ${r.y} L ${n(r.cx)} ${n(r.peak)} L ${n(r.cx + r.w / 2)} ${r.y} Z" fill="${K}"/>`).join('');
  s += `<rect x="0" y="150" width="${W}" height="${H - 150}" fill="url(#w2h)" opacity=".55"/>`;
  s += `<line x1="0" y1="150" x2="${W}" y2="150" stroke="${K}" stroke-width="3"/>`;
  for (let i = 0; i < 22; i += 1) {
    const x = rng() * W; const h = 14 + rng() * 20;
    s += `<path d="M ${n(x)} 151 L ${n(x - h * 0.24)} ${n(151 - h)} L ${n(x + h * 0.24)} ${n(151 - h)} Z" fill="${K}"/>`;
  }
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    const ink = `fill="#e8dcc0" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"`;
    if (f.down) {
      const p = fallenParts(f);
      s += `<path d="${path(f, p.body)}" ${ink}/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" ${ink}/>`;
      s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="#b23b2e" stroke="${K}" stroke-width="2.4"/>`;
      continue;
    }
    const p = parts(f);
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="${K}" stroke-width="3"/>`;
    s += `<path d="${path(f, p.cloak)}" fill="url(#w2h)" stroke="${K}" stroke-width="2.4"/>`;
    s += `<path d="${path(f, p.legBack)}" ${ink}/><path d="${path(f, p.legFront)}" ${ink}/>`;
    s += `<path d="${path(f, p.body)}" fill="url(#w2t)" stroke="${K}" stroke-width="2.4"/>`;
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" ${ink}/>`;
    s += `<path d="${path(f, p.hair)}" fill="${K}"/>`;
    if (p.beard) s += `<path d="${path(f, p.beard)}" fill="${K}"/>`;
    // THE ONE SPOT COLOUR. Every shield, and nothing else on the block.
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="#b23b2e" stroke="${K}" stroke-width="2.6"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- 3. embroidery

const WOOL = ['#b8482f', '#2f4b63', '#7a8b3f', '#c9a02c', '#3d3227', '#9c6a3a', '#d8cbb0'];
const toWool = (hex) => {
  const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = c(hex);
  let best = WOOL[0]; let bd = 1e9;
  for (const w of WOOL) {
    const [wr, wg, wb] = c(w);
    const d = (r - wr) ** 2 + (g - wg) ** 2 + (b - wb) ** 2;
    if (d < bd) { bd = d; best = w; }
  }
  return best;
};

export function embroidery(scene) {
  const fs = figures(scene);
  const roofs = roofline(scene, 158, 50, 390);
  const LINEN = '#e3d8bd';
  let s = `<defs>
    <pattern id="e3weave" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="${LINEN}"/>
      <line x1="0" y1="1.5" x2="3" y2="1.5" stroke="#cfc2a2" stroke-width=".7"/>
      <line x1="1.5" y1="0" x2="1.5" y2="3" stroke="#d8ccae" stroke-width=".7"/></pattern>
  </defs><rect width="${W}" height="${H}" fill="url(#e3weave)"/>`;
  // The borders are the form, not decoration: a Bayeux panel is captioned
  // above and populated below, and the caption is the game's own saga line.
  const band = (y) => {
    let o = `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#8a7c5e" stroke-width="1.2"/>`;
    for (let x = 6; x < W; x += 22) o += `<path d="M ${x} ${y - 7} q 5 7 11 0 q -5 -7 -11 0" fill="none" stroke="#8a7c5e" stroke-width="1.2"/>`;
    return o;
  };
  s += band(30) + band(H - 26);
  s += `<text x="${W / 2}" y="21" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#4b3f2c" letter-spacing="1.5">HIC SKARPHEDIN CECIDIT</text>`;
  s += roofs.map((r) => `<path d="M ${n(r.cx - r.w / 2)} ${r.y} L ${n(r.cx)} ${n(r.peak)} L ${n(r.cx + r.w / 2)} ${r.y} Z" fill="#c9a02c" stroke="#3d3227" stroke-width="1.4"/>`).join('');
  s += `<path d="M 0 158 L ${W} 158" stroke="#3d3227" stroke-width="1.6"/>`;
  s += `<rect x="0" y="158" width="${W}" height="60" fill="#7a8b3f" opacity=".35"/>`;
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    // Stitch, not line: a dashed stroke with round caps is what wool laid in
    // couching actually looks like at this size.
    const stitch = `stroke="#3d3227" stroke-width="1.9" stroke-dasharray="3 2.4" stroke-linecap="round" fill="none"`;
    if (f.down) {
      const p = fallenParts(f);
      s += `<path d="${path(f, p.body)}" fill="${toWool(f.tunic)}"/><path d="${path(f, p.body)}" ${stitch}/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#d8cbb0"/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" ${stitch}/>`;
      continue;
    }
    const p = parts(f);
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="#3d3227" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round"/>`;
    for (const [d, fill] of [[p.cloak, toWool(f.cloak)], [p.legBack, '#3d3227'], [p.legFront, '#9c6a3a'], [p.body, toWool(f.tunic)]]) {
      s += `<path d="${path(f, d)}" fill="${fill}"/><path d="${path(f, d)}" ${stitch}/>`;
    }
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#d8cbb0"/>`;
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" ${stitch}/>`;
    s += `<path d="${path(f, p.hair)}" fill="${toWool(f.hair)}"/>`;
    if (p.beard) s += `<path d="${path(f, p.beard)}" fill="${toWool(f.hair)}"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="${toWool(f.field)}"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" ${stitch}/>`;
  }
  return s;
}

// ---------------------------------------------------------------- 4. pixel (canvas)

const RAMP = ['#14110d', '#2b2a22', '#463c2c', '#5b6570', '#8a6f43', '#c2703a', '#b23b2e',
  '#d3a441', '#e8dcc0', '#7d9150', '#3f4a5a', '#2e5468', '#8b9aa8', '#dfe6ea', '#c6a184', '#ffffff'];

function quantise(r, g, b) {
  let best = RAMP[0]; let bd = 1e9;
  for (const h of RAMP) {
    const R = parseInt(h.slice(1, 3), 16); const G = parseInt(h.slice(3, 5), 16); const B = parseInt(h.slice(5, 7), 16);
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

export function pixel(scene, canvas) {
  // Drawn STRAIGHT to the canvas with Path2D, not by rasterising the SVG
  // panel through a data: URI. That round trip worked locally and would have
  // been the one panel on this page able to fail silently under a stricter
  // image policy — a blank plate and no error is exactly what a broken check
  // looks like. Path2D takes SVG path data, so the geometry is still shared.
  const SC = 4;
  const w = Math.round(W / SC); const h = Math.round(H / SC);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const o = off.getContext('2d');
  o.scale(1 / SC, 1 / SC);
  const rng = makeRng('stands');

  const sky = o.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2c3a48'); sky.addColorStop(1, '#6b7887');
  o.fillStyle = sky; o.fillRect(0, 0, W, H);
  o.fillStyle = '#dfe6ea';
  o.beginPath(); o.arc(360, 44, 15, 0, Math.PI * 2); o.fill();
  o.fillStyle = '#3f4a5a';
  for (const r of roofline(scene, 150, 40, 400)) {
    o.beginPath(); o.moveTo(r.cx - r.w / 2, r.y); o.lineTo(r.cx, r.peak); o.lineTo(r.cx + r.w / 2, r.y); o.fill();
  }
  o.fillStyle = '#4a5340'; o.fillRect(0, 150, W, H - 150);
  o.fillStyle = '#5d6a4d'; o.fillRect(0, 150, W, 4);
  o.fillStyle = '#2f3a2c';
  for (let i = 0; i < 26; i += 1) {
    const x = rng() * W; const th = 16 + rng() * 22;
    o.beginPath(); o.moveTo(x, 152); o.lineTo(x - th * 0.22, 152 - th); o.lineTo(x + th * 0.22, 152 - th); o.fill();
  }
  const fill = (d, col) => { o.fillStyle = col; o.fill(new Path2D(d)); };
  for (const f of figures(scene)) {
    const { X, Y, S } = fit(f);
    if (f.down) {
      const fp = fallenParts(f);
      fill(path(f, fp.body), f.tunic);
      o.fillStyle = '#c6a184'; o.beginPath(); o.arc(X(fp.head.cx), Y(fp.head.cy), S(fp.head.r), 0, Math.PI * 2); o.fill();
      continue;
    }
    const pt = parts(f);
    o.fillStyle = 'rgba(0,0,0,.28)';
    o.beginPath(); o.ellipse(X(pt.shadow.cx), Y(pt.shadow.cy), S(pt.shadow.rx), S(pt.shadow.ry), 0, 0, Math.PI * 2); o.fill();
    o.strokeStyle = '#8a6f43'; o.lineWidth = 2;
    o.beginPath(); o.moveTo(X(pt.spear.x1), Y(pt.spear.y1)); o.lineTo(X(pt.spear.x2), Y(pt.spear.y2)); o.stroke();
    fill(path(f, pt.cloak), f.cloak);
    fill(path(f, pt.legBack), '#4a4033');
    fill(path(f, pt.legFront), '#5a4e3e');
    fill(path(f, pt.body), f.tunic);
    o.fillStyle = '#c6a184'; o.beginPath(); o.arc(X(pt.head.cx), Y(pt.head.cy), S(pt.head.r), 0, Math.PI * 2); o.fill();
    fill(path(f, pt.hair), f.hair);
    if (pt.beard) fill(path(f, pt.beard), f.hair);
    o.fillStyle = f.field;
    o.beginPath(); o.ellipse(X(pt.shield.cx), Y(pt.shield.cy), S(pt.shield.rx), S(pt.shield.ry), 0, 0, Math.PI * 2); o.fill();
    o.fillStyle = f.accent;
    o.beginPath(); o.ellipse(X(pt.shield.cx), Y(pt.shield.cy), S(pt.shield.rx * 0.34), S(pt.shield.ry * 0.34), 0, 0, Math.PI * 2); o.fill();
  }

  // Sixteen colours and an ordered dither. The ramp IS the game's palette —
  // that is what makes this the game at 16-bit rather than a filter over it.
  const d = o.getImageData(0, 0, w, h);
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const bias = (BAYER[y % 4][x % 4] / 16 - 0.5) * 42;
      const clamp = (v) => Math.max(0, Math.min(255, v + bias));
      const hex = quantise(clamp(d.data[i]), clamp(d.data[i + 1]), clamp(d.data[i + 2]));
      d.data[i] = parseInt(hex.slice(1, 3), 16);
      d.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      d.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      d.data[i + 3] = 255;
    }
  }
  o.putImageData(d, 0, 0);
  const c = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  c.imageSmoothingEnabled = false;
  c.drawImage(off, 0, 0, W, H);
}

// ---------------------------------------------------------------- 5. vellum

export function vellum(scene) {
  const rng = makeRng('vellum');
  const fs = figures(scene);
  const GOLD = '#c8a13c';
  let s = `<defs>
    <linearGradient id="v5g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6c964"/><stop offset=".5" stop-color="#f2e3a8"/><stop offset="1" stop-color="#b8902f"/></linearGradient>
  </defs><rect width="${W}" height="${H}" fill="#efe4c6"/>`;
  for (let i = 0; i < 90; i += 1) {
    s += `<circle cx="${n(rng() * W)}" cy="${n(rng() * H)}" r="${n(0.4 + rng() * 1.1)}" fill="#c9b territory"/>`.replace('#c9b territory', '#cbbb93');
  }
  // The decorated border and the rubricated initial ARE the object: the
  // saga is the thing you are looking at, and the fight is an illustration in it.
  s += `<rect x="9" y="9" width="${W - 18}" height="${H - 18}" fill="none" stroke="${GOLD}" stroke-width="3"/>`;
  s += `<rect x="15" y="15" width="${W - 30}" height="${H - 30}" fill="none" stroke="#8a2f24" stroke-width="1.2"/>`;
  for (let x = 22; x < W - 22; x += 26) {
    s += `<path d="M ${x} 12 q 6.5 9 13 0 q -6.5 -9 -13 0" fill="none" stroke="${GOLD}" stroke-width="1.4"/>`;
    s += `<path d="M ${x} ${H - 12} q 6.5 -9 13 0 q -6.5 9 -13 0" fill="none" stroke="${GOLD}" stroke-width="1.4"/>`;
  }
  // The caption sits in the LOWER margin, under a ruled line — where a
  // manuscript actually puts it. It ran across the top in the first cut and
  // the shield wall was drawn straight through the words.
  s += `<line x1="26" y1="${H - 52}" x2="${W - 26}" y2="${H - 52}" stroke="#8a7c5e" stroke-width=".9"/>`;
  s += `<text x="30" y="${H - 26}" font-family="Georgia,serif" font-size="30" fill="#8a2f24" font-weight="700">H</text>`;
  s += `<text x="52" y="${H - 34}" font-family="Georgia,serif" font-size="12" fill="#3b3225">ér fell Skarphedin í annarri hríð,</text>`;
  s += `<text x="52" y="${H - 21}" font-family="Georgia,serif" font-size="12" fill="#3b3225">ok Hallvard stóð yfir honum.</text>`;
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    const outline = `stroke="#3b3225" stroke-width="1.3"`;
    if (f.down) {
      const p = fallenParts(f);
      s += `<path d="${path(f, p.body)}" fill="#8a6f43" ${outline}/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#e8d9b8" ${outline}/>`;
      continue;
    }
    const p = parts(f);
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="#3b3225" stroke-width="1.6"/>`;
    s += `<path d="${path(f, p.cloak)}" fill="${f.cloak}" ${outline}/>`;
    s += `<path d="${path(f, p.legBack)}" fill="#6b5a44" ${outline}/><path d="${path(f, p.legFront)}" fill="#7d6a50" ${outline}/>`;
    s += `<path d="${path(f, p.body)}" fill="${f.tunic}" ${outline}/>`;
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#e8d9b8" ${outline}/>`;
    s += `<path d="${path(f, p.hair)}" fill="${f.hair}"/>`;
    if (p.beard) s += `<path d="${path(f, p.beard)}" fill="${f.hair}"/>`;
    // Gold leaf, and only on the shields — the expensive thing goes where the
    // eye is meant to go.
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="url(#v5g)" stroke="#8a6a1f" stroke-width="1.3"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- 6. rune-stone

export function runestone(scene) {
  const rng = makeRng('stone');
  const fs = figures(scene);
  let s = `<defs>
    <linearGradient id="r6s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8e8c85"/><stop offset="1" stop-color="#6d6b64"/></linearGradient>
  </defs><rect width="${W}" height="${H}" fill="url(#r6s)"/>`;
  for (let i = 0; i < 240; i += 1) {
    s += `<circle cx="${n(rng() * W)}" cy="${n(rng() * H)}" r="${n(0.4 + rng() * 1.3)}" fill="${rng() > 0.5 ? '#a3a099' : '#585650'}" opacity=".5"/>`;
  }
  // FIRST CUT WAS A TANGLE, and the fault is worth naming: it outlined every
  // part of every man, so ten overlapping figures came out as scribble. A
  // carver does not outline — he sinks the ground away and leaves the figure
  // proud. So each form is a FILLED plane with a lit edge above and a shadow
  // edge below, and the red pigment goes only in the deepest cuts.
  const relief = (d, fill) => `<path d="${d}" fill="#4a4842" opacity=".5" transform="translate(1.6,1.6)"/>`
    + `<path d="${d}" fill="#b4b1a8" opacity=".55" transform="translate(-1.4,-1.4)"/>`
    + `<path d="${d}" fill="${fill}"/>`;
  const ellipse = (cx, cy, rx, ry) => `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  const groove = (d, w) => `<path d="${d}" fill="none" stroke="#9e3b2c" stroke-width="${w}" stroke-linecap="round"/>`;

  s += `<path d="M 14 14 L ${W - 14} 14 L ${W - 14} ${H - 14} L 14 ${H - 14} Z" fill="none" stroke="#4a4842" stroke-width="5" opacity=".6" transform="translate(1.4,1.4)"/>`;
  s += `<path d="M 14 14 L ${W - 14} 14 L ${W - 14} ${H - 14} L 14 ${H - 14} Z" fill="none" stroke="#b4b1a8" stroke-width="5" opacity=".6" transform="translate(-1.4,-1.4)"/>`;
  s += groove(`M 14 14 L ${W - 14} 14 L ${W - 14} ${H - 14} L 14 ${H - 14} Z`, 2.6);
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    if (f.down) {
      const p = fallenParts(f);
      s += relief(path(f, p.body), '#7d7b73');
      continue;
    }
    const p = parts(f);
    // The whole man as ONE plane, so a wall of them reads as a frieze.
    s += relief(path(f, p.cloak), '#77756d');
    s += relief(path(f, p.legBack), '#75736b');
    s += relief(path(f, p.legFront), '#7d7b73');
    s += relief(path(f, p.body), '#828077');
    s += relief(ellipse(X(p.head.cx), Y(p.head.cy), S(p.head.r), S(p.head.r)), '#8a887f');
    s += relief(ellipse(X(p.shield.cx), Y(p.shield.cy), S(p.shield.rx), S(p.shield.ry)), '#6f6d66');
    // Pigment: the shield boss and the spear, the two things a carver picks out.
    s += groove(ellipse(X(p.shield.cx), Y(p.shield.cy), S(p.shield.rx * 0.42), S(p.shield.ry * 0.42)), 2.6);
    s += groove(`M ${X(p.spear.x1)} ${Y(p.spear.y1)} L ${X(p.spear.x2)} ${Y(p.spear.y2)}`, 2);
  }
  // A band of runes along the foot, which is where they actually go.
  s += groove(`M 30 ${H - 30} q 62 -14 124 0 q 62 14 124 0 q 62 -14 124 0`, 2.6);
  for (let i = 0; i < 16; i += 1) {
    const x = 40 + i * 23;
    s += groove(`M ${x} ${H - 40} L ${x} ${H - 22}`, 1.8);
    if (i % 3 === 0) s += groove(`M ${x} ${H - 38} L ${x + 7} ${H - 31}`, 1.8);
    if (i % 4 === 1) s += groove(`M ${x} ${H - 30} L ${x + 6} ${H - 24}`, 1.8);
  }
  return s;
}

// ---------------------------------------------------------------- 7. ink wash (canvas)

export function inkwash(scene, canvas) {
  canvas.width = W * 2; canvas.height = H * 2;
  const c = canvas.getContext('2d');
  c.scale(2, 2);
  c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, W, H);
  const rng = makeRng('wash');
  const fs = figures(scene);

  // FIRST CUT WAS BLOBS AND STICKS. A brush does not paint an ellipse; it is
  // laid down, dragged and lifted, so a stroke is WIDE where it started and
  // dry where it left. This is that: a tapered quad from A to B, with the
  // edge jittered and the ink re-laid a few times so tone builds where the
  // hand lingered.
  const stroke = (x1, y1, x2, y2, w1, w2, a, col) => {
    const ang = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const dx = Math.cos(ang); const dy = Math.sin(ang);
    // Soft edge and low alpha per pass: ink SOAKS, it does not print. The
    // first cut used alpha .40 over three passes with 1.6px of jitter and came
    // out as cut rectangles — the label said wet and the mark said vinyl.
    c.save(); c.globalAlpha = a; c.fillStyle = col;
    c.filter = 'blur(1.1px)';
    for (let k = 0; k < 5; k += 1) {
      const j = () => (rng() - 0.5) * 5.5;
      c.beginPath();
      c.moveTo(x1 + dx * w1 + j(), y1 + dy * w1 + j());
      c.quadraticCurveTo((x1 + x2) / 2 + dx * w1 * 0.8 + j() * 2, (y1 + y2) / 2 + dy * w1 * 0.8 + j() * 2,
        x2 + dx * w2 + j(), y2 + dy * w2 + j());
      c.lineTo(x2 - dx * w2 + j(), y2 - dy * w2 + j());
      c.quadraticCurveTo((x1 + x2) / 2 - dx * w1 * 0.8 + j() * 2, (y1 + y2) / 2 - dy * w1 * 0.8 + j() * 2,
        x1 - dx * w1 + j(), y1 - dy * w1 + j());
      c.closePath(); c.fill();
    }
    c.restore();
  };
  const dab = (x, y, r, a, col) => {
    c.save(); c.globalAlpha = a; c.fillStyle = col;
    c.filter = 'blur(1.4px)';
    c.beginPath();
    for (let k = 0; k < 4; k += 1) {
      c.ellipse(x + (rng() - 0.5) * r * 0.5, y + (rng() - 0.5) * r * 0.5,
        r * (0.75 + rng() * 0.4), r * (0.7 + rng() * 0.4), rng() * 3, 0, Math.PI * 2);
    }
    c.fill(); c.restore();
  };

  // The ground is one dragged stroke and nothing else. The space is the picture.
  stroke(48, 215, 396, 211, 2, 8, 0.10, '#3a3830');
  for (const f of fs) {
    const { X, Y } = fit(f);
    const p = f.down ? fallenParts(f) : parts(f);
    if (f.down) {
      stroke(X(-1.1), Y(0.97), X(1.05), Y(0.93), 4, 2, 0.16, '#22201b');
      continue;
    }
    // A man: one loaded downstroke for the body, a dab for the head, a dry
    // drag for the spear. Three marks, as promised on the label.
    stroke(X(0), Y(0.16), X(0.14 * f.facing), Y(0.99), f.w * 0.32, f.w * 0.14, 0.13, '#22201b');
    dab(X(0.07 * f.facing), Y(0.085), f.w * 0.16, 0.22, '#14110d');
    stroke(X(p.spear.x1), Y(p.spear.y1), X(p.spear.x2), Y(p.spear.y2), 1.7, 0.4, 0.15, '#3a3830');
    // The shield: one turn of a loaded brush, and the only red on the page
    // besides the seal — where the eye is meant to go.
    dab(X(p.shield.cx), Y(p.shield.cy), f.w * 0.21, 0.20, '#8a3a2c');
  }
  // One seal, bottom right, the way a wash is signed.
  c.fillStyle = '#a8322a'; c.fillRect(W - 54, H - 50, 30, 30);
  c.fillStyle = '#f4f1e8';
  c.font = '600 11px Georgia, serif'; c.textAlign = 'center';
  c.fillText('LAND', W - 39, H - 34); c.fillText('NÁM', W - 39, H - 23);
}

// ---------------------------------------------------------------- 8. papercraft

export function papercraft(scene) {
  const rng = makeRng('paper');
  const fs = figures(scene);
  const roofs = roofline(scene, 152, 40, 400);
  let s = `<defs>
    <filter id="p8s" x="-30%" y="-30%" width="170%" height="170%">
      <feDropShadow dx="0" dy="2.4" stdDeviation="2.4" flood-color="#2a2418" flood-opacity=".34"/></filter>
    <filter id="p8f" x="-30%" y="-30%" width="170%" height="170%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#2a2418" flood-opacity=".3"/></filter>
  </defs><rect width="${W}" height="${H}" fill="#cfd9de"/>`;
  // Every layer is a sheet with a shadow under it, so depth is physical
  // rather than painted — the one idiom on this page that a phone screen was
  // designed for.
  s += `<path d="M 0 116 Q 110 100 220 116 Q 330 132 440 112 L 440 260 L 0 260 Z" fill="#9fb4bd" filter="url(#p8s)"/>`;
  s += roofs.map((r) => `<path d="M ${n(r.cx - r.w / 2)} ${r.y} L ${n(r.cx)} ${n(r.peak)} L ${n(r.cx + r.w / 2)} ${r.y} Z" fill="#7c6a52" filter="url(#p8f)"/>`).join('');
  s += `<path d="M 0 150 Q 120 142 240 152 Q 350 160 440 148 L 440 260 L 0 260 Z" fill="#7f8f5c" filter="url(#p8s)"/>`;
  s += `<path d="M 0 188 Q 130 180 260 190 Q 360 197 440 186 L 440 260 L 0 260 Z" fill="#63754a" filter="url(#p8s)"/>`;
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * W; const h = 20 + rng() * 26;
    s += `<path d="M ${n(x)} 154 L ${n(x - h * 0.3)} ${n(154 - h)} L ${n(x + h * 0.3)} ${n(154 - h)} Z" fill="#4e6040" filter="url(#p8f)"/>`;
  }
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    if (f.down) {
      const p = fallenParts(f);
      s += `<path d="${path(f, p.body)}" fill="${f.tunic}" filter="url(#p8f)"/>`;
      s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#d3ae8d" filter="url(#p8f)"/>`;
      continue;
    }
    const p = parts(f);
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="#8a6f43" stroke-width="3" filter="url(#p8f)"/>`;
    s += `<path d="${path(f, p.cloak)}" fill="${f.cloak}" filter="url(#p8f)"/>`;
    s += `<path d="${path(f, p.legBack)}" fill="#584a38" filter="url(#p8f)"/><path d="${path(f, p.legFront)}" fill="#6a5a44" filter="url(#p8f)"/>`;
    s += `<path d="${path(f, p.body)}" fill="${f.tunic}" filter="url(#p8s)"/>`;
    s += `<circle cx="${X(p.head.cx)}" cy="${Y(p.head.cy)}" r="${S(p.head.r)}" fill="#d3ae8d" filter="url(#p8f)"/>`;
    s += `<path d="${path(f, p.hair)}" fill="${f.hair}"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx)}" ry="${S(p.shield.ry)}" fill="${f.field}" filter="url(#p8s)"/>`;
    s += `<ellipse cx="${X(p.shield.cx)}" cy="${Y(p.shield.cy)}" rx="${S(p.shield.rx * 0.36)}" ry="${S(p.shield.ry * 0.36)}" fill="${f.accent}"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- 9. terminal

export function terminal(scene) {
  // A glyph lattice. Every figure is resolved to the cells it occupies, so
  // this is the same geometry as every other panel — read at 6x10 instead of
  // in colour.
  //
  // The first cut drew each man as a single column of `|` and came out as
  // scattered punctuation: at 21px between ranks and 7px cells, most men fell
  // in the same column and overwrote each other. A man is three columns wide
  // here, which is what FIGURE_W actually is in cells, and the wall closes up
  // the way it does in every other panel.
  const CW = 6; const CH = 10;
  const cols = Math.floor(W / CW); const rows = Math.floor(H / CH);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  const ink = Array.from({ length: rows }, () => Array(cols).fill(0));
  const put = (c, r, ch, weight = 1) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (weight >= ink[r][c]) { grid[r][c] = ch; ink[r][c] = weight; }
  };
  const groundRow = Math.floor(py(638) / CH);
  for (let c = 0; c < cols; c += 1) put(c, groundRow + 1, '=', 0.5);
  for (const r of roofline(scene, 150, 40, 400)) {
    const c = Math.floor(r.cx / CW); const top = Math.floor(r.peak / CH);
    put(c, top, '/', 0.6); put(c + 1, top, '\\', 0.6);
    for (let y = top + 1; y <= groundRow - 4; y += 1) { put(c, y, '|', 0.4); put(c + 1, y, '|', 0.4); }
  }
  for (const f of figures(scene)) {
    const c = Math.floor(f.cx / CW);
    const feet = Math.floor(f.feet / CH);
    const top = Math.floor((f.feet - f.h) / CH);
    const w = f.side === 'warband' ? 1 : -1;
    if (f.down) {
      for (let i = -3; i <= 3; i += 1) put(c + i, feet, '~', 3);
      put(c + 3 * w, feet, '@', 3);
      continue;
    }
    // A man: head, mailed body over three columns, legs, and his shield in
    // the column facing the enemy.
    put(c, top, '@', 2);
    const chest = top + 1;
    const hip = Math.round(top + (feet - top) * 0.62);
    for (let y = chest; y <= hip; y += 1) {
      put(c - 1, y, '#', 2); put(c, y, '#', 2); put(c + 1, y, '#', 2);
    }
    for (let y = hip + 1; y < feet; y += 1) { put(c - 1, y, '|', 2); put(c + 1, y, '|', 2); }
    put(c + 2 * w, Math.round(top + (feet - top) * 0.34), '0', 3);
    put(c + 2 * w, Math.round(top + (feet - top) * 0.34) + 1, '0', 3);
    // The spear, raked forward over the man in front.
    for (let k = 1; k <= 6; k += 1) put(c + k * w, chest - Math.round(k * 0.55), '/', 1.5);
  }
  const text = grid.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
  return `<rect width="${W}" height="${H}" fill="#0d0f0c"/>
    <text font-family="ui-monospace,Menlo,Consolas,monospace" font-size="9.5" fill="#e0a94f" xml:space="preserve">`
    + text.split('\n').map((l, i) => `<tspan x="4" y="${11 + i * CH}">${esc(l)}</tspan>`).join('')
    + `</text>`;
}

// ---------------------------------------------------------------- 10. enamel

export function enamel(scene) {
  const fs = figures(scene);
  const roofs = roofline(scene, 150, 46, 394);
  const GOLD = '#d8b451';
  let s = `<defs>
    <linearGradient id="n10b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3226"/><stop offset="1" stop-color="#241f18"/></linearGradient>
    <linearGradient id="n10h" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  </defs><rect width="${W}" height="${H}" fill="url(#n10b)"/>`;
  // Cloisonné: every cell is bounded by a gold wire and filled with one
  // saturated, glassy colour. No blends anywhere — the wire does the drawing
  // and the glass does the colour.
  const cell = (d, fill) => `<path d="${d}" fill="${fill}"/><path d="${d}" fill="none" stroke="${GOLD}" stroke-width="1.9" stroke-linejoin="round"/>`;
  s += cell(`M 0 150 L ${W} 150 L ${W} ${H} L 0 ${H} Z`, '#1d4a52');
  s += cell(`M 0 190 Q 120 182 240 192 Q 350 199 440 188 L 440 260 L 0 260 Z`, '#2c6b5c');
  s += roofs.map((r) => cell(`M ${n(r.cx - r.w / 2)} ${r.y} L ${n(r.cx)} ${n(r.peak)} L ${n(r.cx + r.w / 2)} ${r.y} Z`, '#7b2d24')).join('');
  for (const f of fs) {
    const { X, Y, S } = fit(f);
    if (f.down) {
      const p = fallenParts(f);
      s += cell(path(f, p.body), '#5a3a6b');
      continue;
    }
    const p = parts(f);
    s += `<line x1="${X(p.spear.x1)}" y1="${Y(p.spear.y1)}" x2="${X(p.spear.x2)}" y2="${Y(p.spear.y2)}" stroke="${GOLD}" stroke-width="2.2"/>`;
    s += cell(path(f, p.cloak), f.side === 'warband' ? '#2f4f7a' : '#6b2f2a');
    s += cell(path(f, p.legBack), '#3d3227');
    s += cell(path(f, p.legFront), '#4d4030');
    s += cell(path(f, p.body), f.side === 'warband' ? '#1f6a72' : '#8a3b1e');
    const r = S(p.head.r);
    s += cell(`M ${X(p.head.cx) - r} ${Y(p.head.cy)} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`, '#e6d3a8');
    const rx = S(p.shield.rx); const ry = S(p.shield.ry);
    const sh = `M ${X(p.shield.cx) - rx} ${Y(p.shield.cy)} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
    s += cell(sh, '#9c1f2e');
    s += `<path d="${sh}" fill="url(#n10h)"/>`;
  }
  return s;
}

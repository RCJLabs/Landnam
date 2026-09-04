// The sky over the battlefield.
//
// The sim already knows the day's weather — the top bar has named it since
// the weather work — and the field ignored it: a gale read as a movement
// penalty, never as a gale. Now the sky the band fights under is drawn:
// streaks in a gale, snow in a frost, a drifting bank in sea fog, and the
// season's own light over everything.
//
// The animation contract: these loop (weather does not stop between turns),
// so unlike the one-shot .fx effects they exist even under stillness and are
// FROZEN there by CSS — see the `.weather` rules and their still guards.
// Positions are seeded with a fixed label, like every other decoration.

import { makeRng } from '../rng';
import type { Season } from '../state/types';
import type { WeatherId } from '../data/weather';
import { svgEl } from './svg';
import { GOLD, SNOW } from './palette';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The season's light, one tinted rect: winter is blue and thin, autumn
 * amber, spring green-gold. Summer is the palette everything was tuned in,
 * so it adds nothing. */
export function seasonTint(season: Season, b: Bounds): SVGElement | null {
  const tint =
    season === 'winter'
      ? { fill: '#9db8d6', opacity: 0.1 }
      : season === 'autumn'
        ? { fill: GOLD, opacity: 0.07 }
        : season === 'spring'
          ? { fill: '#b9d67a', opacity: 0.05 }
          : null;
  if (!tint) return null;
  return svgEl('rect', {
    x: b.x, y: b.y, width: b.w, height: b.h,
    fill: tint.fill, opacity: tint.opacity,
  });
}

/**
 * What the named sky adds over the field. Fair and thaw add nothing — thaw
 * is a fact about the snowpack, not the air.
 */
export function skyNodes(weather: WeatherId, b: Bounds): SVGElement[] {
  const rng = makeRng(`landnam-field-sky:${weather}`);
  const out: SVGElement[] = [];

  if (weather === 'gale') {
    // Wind made visible: long streaks tearing across, staggered so the field
    // never empties.
    for (let i = 0; i < 9; i++) {
      const y = b.y + rng.float(0.05, 0.95) * b.h;
      const len = 26 + rng.float(0, 22);
      const line = svgEl('line', {
        x1: b.x - len, y1: y, x2: b.x, y2: y - len * 0.18,
        class: 'gust',
        stroke: SNOW,
        'stroke-width': 1.4,
        'stroke-linecap': 'round',
      });
      const style = (line as SVGElement & { style: CSSStyleDeclaration }).style;
      style.setProperty('--drift', `${b.w + len * 2}px`);
      style.setProperty('animation-delay', `${rng.float(0, 2.4).toFixed(2)}s`);
      style.setProperty('animation-duration', `${rng.float(1.6, 2.6).toFixed(2)}s`);
      out.push(line);
    }
    return out;
  }

  if (weather === 'frost') {
    // Slow snow, each flake with its own fall and sway.
    for (let i = 0; i < 16; i++) {
      const flake = svgEl('circle', {
        cx: b.x + rng.float(0.02, 0.98) * b.w,
        cy: b.y,
        r: 1.1 + rng.float(0, 1.2),
        class: 'flake',
        fill: '#eef2f5',
      });
      const style = (flake as SVGElement & { style: CSSStyleDeclaration }).style;
      style.setProperty('--fall', `${b.h + 8}px`);
      style.setProperty('--sway', `${rng.float(-14, 14).toFixed(1)}px`);
      style.setProperty('animation-delay', `${rng.float(0, 7).toFixed(2)}s`);
      style.setProperty('animation-duration', `${rng.float(6, 9).toFixed(2)}s`);
      out.push(flake);
    }
    return out;
  }

  if (weather === 'seafog') {
    // A bank that breathes across the field. Ellipses, not filters: soft
    // enough at this opacity, and cheap enough for any phone.
    for (let i = 0; i < 3; i++) {
      const fog = svgEl('ellipse', {
        cx: b.x + rng.float(0.15, 0.85) * b.w,
        cy: b.y + (0.22 + i * 0.28) * b.h,
        rx: b.w * rng.float(0.42, 0.6),
        ry: b.h * 0.14,
        class: 'fogbank',
        fill: SNOW,
      });
      const style = (fog as SVGElement & { style: CSSStyleDeclaration }).style;
      style.setProperty('--drift', `${rng.float(18, 34).toFixed(0)}px`);
      style.setProperty('animation-delay', `${rng.float(0, 4).toFixed(2)}s`);
      style.setProperty('animation-duration', `${rng.float(9, 14).toFixed(2)}s`);
      out.push(fog);
    }
    return out;
  }

  return out;
}

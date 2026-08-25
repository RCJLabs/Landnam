// BATTLE renderer: the field as layered SVG. Pure view — reads state, emits
// a hex tap. Fighters are drawn from their Person, same as anywhere else.

import { cornerPoints, fromKey, fromPixel, key, toPixel, type Hex } from '../hex';
import type { Battle, GameState } from '../state/types';
import { activeCombatant, fighterPerson, strikeTargets } from '../sim/battle';
import { reachTargets, throwTargets } from '../sim/strike';
import { shoveDestination } from '../sim/footwork';
import { isLeader } from '../sim/warcry';
import { beatsSince } from '../sim/beats';
import { wallPairs } from '../sim/wall';
import type { Aim } from './battleUi';
import { svgEl } from './svg';
import {
  FIELD_HEX,
  duskVignette,
  fieldFill,
  fieldPatterns,
  lightDefs,
  sunWash,
} from './fieldArt';
import { figure } from './figures';
import { showBeat, type WallMemory } from './fx';
import { seasonTint, skyNodes } from './fieldWeather';
import { seasonOf } from '../sim/calendar';
import { weatherOn } from '../sim/weather';

const HEX = FIELD_HEX;

/**
 * The thumb rule, and the scale a hex needs to meet it.
 *
 * A battle hex is a touch target — tap one to move, another to strike — so it
 * is bound by the 44px minimum the rest of the game holds. A pointy-top hex
 * of size `HEX` is `sqrt(3) * HEX` across the flats, which is its smallest
 * dimension and the one a thumb actually has to land on.
 */
const TAP_MIN = 44;

/**
 * The size a tile is DRAWN at, which is not the size it is spaced at.
 *
 * `HEX` is the layout size — what `toPixel` steps by. The polygon is drawn a
 * half-unit inside it so the tiles have a hairline between them, and that
 * smaller shape is the one a thumb actually lands on. Deriving the rule from
 * `HEX` instead put the hex at 43.27px against a 44px bar and predicted 44.00
 * — a miss of less than a pixel, invisible in the code and caught only by
 * measuring the rendered polygon. They are one constant now so they cannot
 * drift apart again.
 */
const HEX_TILE = HEX - 0.5;
const NEEDED_SCALE = TAP_MIN / (Math.sqrt(3) * HEX_TILE);

/** The leader, if they are standing on this field at all. */
function isLeaderHere(state: GameState, combatant: { personId: string; side: string }): boolean {
  return isLeader(state, combatant as Parameters<typeof isLeader>[1]);
}

export interface BattleView {
  root: SVGSVGElement;
  update(state: GameState, aim: Aim): void;
}

export function createBattleView(onTap: (h: Hex) => void): BattleView {
  const root = svgEl('svg', {
    class: 'field',
    xmlns: 'http://www.w3.org/2000/svg',
    preserveAspectRatio: 'xMidYMid meet',
  });
  // The ground's patterns and the light's gradients, built once. Same move
  // as the travel map's terrain defs, for the same repaint reason.
  const defs = svgEl('defs');
  defs.append(...fieldPatterns(), ...lightDefs());
  root.append(defs);

  const layers = {
    ground: svgEl('g'),
    // The low sun: a wash between the ground and the men, and a vignette
    // over everything, so the fight sits IN the country instead of on a
    // diagram of one. Two rects, resized to the field each paint.
    light: svgEl('g'),
    overlay: svgEl('g'),
    fighters: svgEl('g'),
    // Effects survive repaints and remove themselves: paint() rebuilds the
    // other layers wholesale, and an animation that gets rebuilt mid-flight
    // is an animation that never happened.
    effects: svgEl('g', { class: 'fx' }),
    // The sky: over the men (fog and snow fall in FRONT of people), under
    // the vignette. Looping decoration — see the .weather CSS for how
    // stillness freezes rather than clears it.
    weather: svgEl('g', { class: 'weather' }),
    shade: svgEl('g'),
  };
  root.append(
    layers.ground,
    layers.light,
    layers.overlay,
    layers.fighters,
    layers.effects,
    layers.weather,
    layers.shade,
  );

  let latest: GameState | null = null;
  /**
   * Where a zoomed field is looking, or null to follow whoever is acting.
   *
   * Only ever non-null on a screen too narrow to frame the grid at 44px, and
   * cleared when the turn passes so the view goes back to the action rather
   * than stranding the player where they last dragged.
   */
  let panAt: { x: number; y: number } | null = null;
  /** Whose turn the view last followed, so a new one re-centres. */
  let followed = '';
  /**
   * Whether the field is currently showing less than the whole grid — which
   * is the only condition under which a drag means anything. Set by
   * `fitViewBox`, which is the one place that decides it.
   */
  let canPan = false;
  /**
   * How far into the fight's beat stream the effects layer has read.
   *
   * The whole of what this layer used to be: a `lastBlow.n` it diffed, a
   * `warCried` boolean it latched, and a Set of everyone it had seen fall.
   * Three private reconstructions of change, each with its own way of being
   * wrong — the blow slot only ever held the NEWEST one, so every swing but
   * the last of a foe's turn was invisible, and the fallen Set was never
   * cleared between fights, so a warrior who went down twice only ever
   * animated once. One mark into an ordered stream replaces all of it.
   *
   * `null` until this view has looked at any fight at all, which is how a
   * saga taken up mid-battle is told apart from a fight that has just begun:
   * the first is a backlog to adopt silently, the second is an opening to
   * play. Without the difference, loading a mid-fight save replayed forty
   * beats of a fight the player was not watching.
   */
  let beatMark: number | null = null;
  /** The field's extent, kept by fitViewBox for the light layers. */
  let bounds: { x: number; y: number; w: number; h: number } | null = null;
  /**
   * The wall as the LAST paint drew it, so a fall can snap the link it was
   * holding — the fallen are already out of `wallPairs` by the time their
   * `fell` beat plays. View memory, not sim state: beats live in the save
   * and the parity vectors, and must not grow kinds for decoration's sake.
   */
  let wallBefore = new Map<string, WallMemory>();

  /** Beats land this far apart when a whole foe turn arrives at once. */
  const BEAT_GAP = 140;

  /** Effects are decoration; a player who asked for stillness gets none. */
  function still(): boolean {
    return (
      document.documentElement.classList.contains('still') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** A one-shot effect node that cleans up after itself. */
  function spawn(node: SVGElement, life = 750): void {
    layers.effects.append(node);
    window.setTimeout(() => node.remove(), life);
  }

  function playEffects(state: GameState): void {
    const battle = state.battle;
    if (!battle) return;

    const newest = battle.beats?.[battle.beats.length - 1]?.n ?? 0;
    // Nothing seen yet: this fight was already under way when the page
    // opened, and its history is not news.
    if (beatMark === null) beatMark = newest;
    // A fresh fight starts its numbering over, so a mark from the last one
    // would swallow the whole opening round.
    else if (newest < beatMark) beatMark = 0;

    const { beats, mark } = beatsSince(battle, beatMark);
    // The mark advances whether or not anything is drawn: a player who asked
    // for stillness should not be handed the backlog the moment they turn
    // motion back on.
    beatMark = mark;
    if (still()) return;

    // A player's action lands one beat; a foe's whole turn can land a dozen
    // at once, and firing them on the same frame is a single flicker rather
    // than a fight. They are dealt out in order instead — which is the point
    // of a stream over a slot.
    const wall = wallBefore;
    beats.forEach((b, i) => {
      if (i === 0) showBeat(battle, b, spawn, wall);
      else window.setTimeout(() => showBeat(battle, b, spawn, wall), Math.min(i, 8) * BEAT_GAP);
    });
  }

  function fitViewBox(battle: Battle): void {
    // Frame the whole field with a little breathing room.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const k of Object.keys(battle.grid)) {
      const p = toPixel(fromKey(k), HEX);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = HEX * 0.85;
    const box = {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
    bounds = box;

    // How big a hex would be if the whole field were framed. `xMidYMid meet`
    // scales by the tighter axis, and a pointy-top hex is narrower than it is
    // tall, so its smallest on-screen dimension — the one a thumb has to hit,
    // and the one scripts/field.mjs measures — is the flat-to-flat width.
    const rect = root.getBoundingClientRect();
    const framed = rect.width > 0 && rect.height > 0
      ? Math.min(rect.width / box.w, rect.height / box.h)
      : NEEDED_SCALE;

    if (framed >= NEEDED_SCALE) {
      // The field frames itself, exactly as it always has. Nothing below this
      // line runs on a phone the game was designed for.
      panAt = null;
      canPan = false;
      root.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
      return;
    }

    // It cannot. A 320px screen tops out at a 39px hex however much height it
    // is given, because the whole grid always fits — so the choice is a hex
    // under the thumb rule or a field that moves. Zoom is NOT a user control:
    // it goes exactly as far as 44px demands and no further, so the field
    // still frames as much of itself as it possibly can.
    canPan = true;
    const w = rect.width / NEEDED_SCALE;
    const h = rect.height / NEEDED_SCALE;
    const centre = panAt ?? focusOf(battle) ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    // Clamped to the field: panning must not sail off into empty space. An
    // axis that still fits whole is centred rather than clamped.
    const cx = w >= box.w
      ? box.x + box.w / 2
      : Math.min(Math.max(centre.x, box.x + w / 2), box.x + box.w - w / 2);
    const cy = h >= box.h
      ? box.y + box.h / 2
      : Math.min(Math.max(centre.y, box.y + h / 2), box.y + box.h - h / 2);
    root.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
  }

  /** Where a zoomed field looks by default: whoever is taking their turn. */
  function focusOf(battle: Battle): { x: number; y: number } | undefined {
    const active = activeCombatant(battle);
    return active ? toPixel(active.at, HEX) : undefined;
  }

  function paint(state: GameState, aim: Aim): void {
    latest = state;
    // A new turn drops the player's pan: on a narrow screen the fighter who
    // is acting may be off the edge of where they last dragged to, and a
    // field that will not show you whose turn it is is worse than one that
    // moves under you.
    const acting = state.battle ? activeCombatant(state.battle)?.personId ?? '' : '';
    if (acting !== followed) {
      followed = acting;
      panAt = null;
    }
    const battle = state.battle;
    if (!battle) return;

    layers.ground.replaceChildren();
    layers.light.replaceChildren();
    layers.overlay.replaceChildren();
    layers.fighters.replaceChildren();
    layers.shade.replaceChildren();
    fitViewBox(battle);
    layers.weather.replaceChildren();
    if (bounds) {
      layers.light.append(sunWash(bounds.x, bounds.y, bounds.w, bounds.h));
      layers.shade.append(duskVignette(bounds.x, bounds.y, bounds.w, bounds.h));
      const tint = seasonTint(seasonOf(state.day), bounds);
      if (tint) layers.light.append(tint);
      layers.weather.append(...skyNodes(weatherOn(state.seed, state.day).id, bounds));
    }

    for (const [k, tile] of Object.entries(battle.grid)) {
      const h = fromKey(k);
      const p = toPixel(h, HEX);
      // A palisade has to read as stakes, not as one more brown hex — it is
      // the thing the player spent eight timber on.
      if (tile.ground === 'wall') layers.overlay.append(stakes(p.x, p.y));
      layers.ground.append(
        svgEl('polygon', {
          points: cornerPoints(p.x, p.y, HEX_TILE),
          // The country the fight stands on decides what open ground looks
          // like — the log has always said "they met us on wet sand", and
          // now the sand is there to be met on.
          fill: fieldFill(tile.ground, battle.terrain),
          stroke: '#2b2a22',
          'stroke-width': 1,
        }),
      );
      if (tile.ground === 'block') layers.ground.append(boulder(p.x, p.y));
    }

    const active = activeCombatant(battle);

    if (active?.side === 'warband' && !battle.outcome) {
      // Ground the enemy threatens: step in here and your move stops.
      // The threatened-ground shading and the move-target ring stood here.
      // Both drew answers to "where could this fighter go", and since 8.1c
      // there is nowhere to go — the line-shaped controls arrive with 8.1d.

      // Whoever the armed action can actually reach.
      const marked =
        aim === 'throw'
          ? throwTargets(state)
          : aim === 'reach'
            ? reachTargets(state)
            : strikeTargets(state);
      for (const target of marked) {
        const p = toPixel(target.at, HEX);
        layers.overlay.append(
          svgEl('polygon', {
            points: cornerPoints(p.x, p.y, HEX - 2),
            fill: 'none',
            stroke: aim === 'throw' ? '#d3a441' : aim === 'reach' ? '#cfd8dc' : '#b23b2e',
            'stroke-width': 3,
            'stroke-dasharray': aim === 'throw' ? '6 4' : aim === 'reach' ? '3 3' : '',
          }),
        );
        // Show who a shove would put in front instead.
        if (aim === 'shove') {
          const came = shoveDestination(battle, target);
          const to = came?.at;
          const tile = to ? battle.grid[key(to)] : undefined;
          if (to && tile) {
            const q = toPixel(to, HEX);
            layers.overlay.append(
              svgEl('polygon', {
                points: cornerPoints(q.x, q.y, HEX - 6),
                fill: tile.ground === 'water' ? '#2e5468' : 'none',
                stroke: '#d3a441',
                'stroke-width': 2,
                opacity: 0.9,
              }),
            );
          }
        }
      }
    }

    // The wall itself, drawn as the thing it is: a brace of overlapped
    // shields between shoulder-mates — a plank with its lit edge and the
    // studs where the rims cross — under the fighters, so the line reads as
    // something they stand IN. A fighter braced on BOTH shoulders gets the
    // full-wall ring, since that is the state every wall number keys off.
    const pairs = wallPairs(battle);
    const linkCount = new Map<string, number>();
    const wallNow = new Map<string, WallMemory>();
    for (const [a, b] of pairs) {
      const pa = toPixel(a.at, HEX);
      const pb = toPixel(b.at, HEX);
      const friendly = a.side === 'warband';
      const ink = friendly ? '#e8dcc0' : '#9fb0c4';
      linkCount.set(a.personId, (linkCount.get(a.personId) ?? 0) + 1);
      linkCount.set(b.personId, (linkCount.get(b.personId) ?? 0) + 1);
      wallNow.set(`${a.personId}|${b.personId}`, {
        ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y, friendly,
      });
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      layers.overlay.append(
        svgEl('line', {
          x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
          stroke: ink, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.4,
        }),
        svgEl('line', {
          x1: pa.x + nx * 2, y1: pa.y + ny * 2, x2: pb.x + nx * 2, y2: pb.y + ny * 2,
          stroke: '#ffffff', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.18,
        }),
      );
      for (const f of [0.32, 0.5, 0.68]) {
        layers.overlay.append(
          svgEl('circle', {
            cx: pa.x + dx * f, cy: pa.y + dy * f, r: 2.4,
            fill: '#5b6570', stroke: '#2b2a22', 'stroke-width': 0.8, opacity: 0.9,
          }),
        );
      }
    }
    for (const combatant of battle.combatants) {
      if ((linkCount.get(combatant.personId) ?? 0) < 2) continue;
      const p = toPixel(combatant.at, HEX);
      layers.overlay.append(
        svgEl('circle', {
          cx: p.x, cy: p.y, r: HEX * 0.42 + 4.5,
          fill: 'none',
          stroke: combatant.side === 'warband' ? '#e8dcc0' : '#9fb0c4',
          'stroke-width': 4,
          opacity: 0.3,
        }),
      );
    }

    for (const combatant of battle.combatants) {
      if (combatant.down || combatant.fled) continue;
      const person = fighterPerson(state, combatant.personId);
      if (!person) continue;
      const p = toPixel(combatant.at, HEX);
      const isActive = active?.personId === combatant.personId;
      layers.fighters.append(
        figure(p.x, p.y, HEX * 0.42, person, {
          friendly: combatant.side === 'warband',
          health: person.health / person.maxHealth,
          active: isActive,
          defending: combatant.defending,
          broken: combatant.broken,
          pennant: isLeaderHere(state, combatant)
            ? 'gold'
            : battle.champion === combatant.personId
              ? 'blood'
              : null,
        }),
      );
    }

    playEffects(state);
    wallBefore = wallNow;
  }

  // The field is `flex: 1 1 auto` under a log that grows as the fight is
  // written, so the element it is measured against changes size AFTER a paint
  // has already fitted the box to it. Left alone that costs the hex a pixel or
  // two exactly when the log fills — measured at 43px against the 44px rule,
  // which is the whole defect this work exists to fix, reappearing by the
  // back door. Refit whenever the element actually changes.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (latest?.battle) fitViewBox(latest.battle);
    }).observe(root);
  }

  /** The world point under a pointer, whatever the field is framed at. */
  function worldUnder(e: PointerEvent): { x: number; y: number } {
    const rect = root.getBoundingClientRect();
    const box = root.viewBox.baseVal;
    // The field uses xMidYMid meet, so work out the letterboxed draw area.
    // When the field is zoomed the box fills the element and both margins are
    // zero, so the same arithmetic covers framed and panned alike.
    const scale = Math.min(rect.width / box.width, rect.height / box.height);
    const originX = rect.left + (rect.width - box.width * scale) / 2;
    const originY = rect.top + (rect.height - box.height * scale) / 2;
    return {
      x: box.x + (e.clientX - originX) / scale,
      y: box.y + (e.clientY - originY) / scale,
    };
  }

  // Dragging the field, on the screens that need it. A drag must never end in
  // a tap: the same pointerup that finishes a pan would otherwise order a
  // fighter to walk there, which is the one way this feature could be worse
  // than the problem it solves. Same `dragged` guard render/travel.ts uses.
  let dragging: number | null = null;
  let dragged = false;
  let from: { x: number; y: number } | null = null;
  let fromScreen: { x: number; y: number } | null = null;

  root.addEventListener('pointerdown', (e) => {
    dragged = false;
    // Tracked at EVERY width, not just where the field can pan. A drag must
    // never end in a tap anywhere: before this, dragging a finger across a
    // 390px field — reaching for the action bar, or trying to scroll the
    // page — ordered whoever was up to walk to wherever the finger stopped,
    // because pointerup was a tap unconditionally. Only the PANNING below is
    // gated on there being anything to pan.
    dragging = e.pointerId;
    from = worldUnder(e);
    fromScreen = { x: e.clientX, y: e.clientY };
    root.setPointerCapture(e.pointerId);
  });

  root.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId || !from || !fromScreen || !latest?.battle) return;
    // The slop that separates a tap from a drag is measured in SCREEN pixels,
    // the way a thumb is: two world units is under two pixels once the field
    // is zoomed, which would make a slightly shaky tap read as a drag and do
    // nothing at all.
    if (Math.abs(e.clientX - fromScreen.x) + Math.abs(e.clientY - fromScreen.y) > 3) {
      dragged = true;
    }
    if (!dragged || !canPan) return;
    const now = worldUnder(e);
    const box = root.viewBox.baseVal;
    panAt = {
      x: box.x + box.width / 2 - (now.x - from.x),
      y: box.y + box.height / 2 - (now.y - from.y),
    };
    fitViewBox(latest.battle);
  });

  function endDrag(e: PointerEvent): void {
    if (dragging === e.pointerId) {
      dragging = null;
      from = null;
      fromScreen = null;
    }
  }

  root.addEventListener('pointercancel', endDrag);

  root.addEventListener('pointerup', (e) => {
    const wasDragged = dragged;
    endDrag(e);
    if (wasDragged || !latest?.battle) return;
    const p = worldUnder(e);
    onTap(fromPixel(p.x, p.y, HEX));
  });

  return {
    root,
    update(state, aim) {
      paint(state, aim);
    },
  };
}

// --- Procedural marks ---

function boulder(cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { opacity: 0.9 });
  g.append(
    svgEl('path', {
      d: `M ${cx - HEX * 0.42} ${cy + HEX * 0.2} q ${HEX * 0.16} ${-HEX * 0.5} ${HEX * 0.42} ${-HEX * 0.24} q ${HEX * 0.3} ${-HEX * 0.16} ${HEX * 0.42} ${HEX * 0.44} Z`,
      fill: '#7b756b',
    }),
  );
  return g;
}

/** Split trunks, sharpened, sunk deep. */
function stakes(cx: number, cy: number): SVGGElement {
  const g = svgEl('g', { class: 'stakes' });
  for (const dx of [-0.42, -0.14, 0.14, 0.42]) {
    const x = cx + dx * HEX;
    g.append(
      svgEl('path', {
        d: `M ${x} ${cy + HEX * 0.42} L ${x} ${cy - HEX * 0.3} L ${x + HEX * 0.06} ${cy - HEX * 0.44}`,
        stroke: '#c9a468',
        'stroke-width': 2.4,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  g.append(
    svgEl('line', {
      x1: cx - HEX * 0.5,
      y1: cy + HEX * 0.05,
      x2: cx + HEX * 0.5,
      y2: cy + HEX * 0.05,
      stroke: '#8a6f43',
      'stroke-width': 1.6,
    }),
  );
  return g;
}

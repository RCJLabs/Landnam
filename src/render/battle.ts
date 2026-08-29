// BATTLE renderer: two walls meeting, as layered SVG. Pure view — reads
// state, emits a tap on a fighter. Fighters are drawn from their Person, the
// same as anywhere else.
//
// Side-on since 8.1d. The sim has been a line since 8.1c and this was still
// drawing a hex grid, which was the worst of both: every man was painted at
// `Combatant.at`, frozen wherever he deployed, so the picture had stopped
// describing where anybody stood. All the geometry now comes from
// `render/line.ts`, which is pure and tested, so the paint, the effects and
// the tap cannot drift apart about where a rank is.

import type { Battle, Combatant, GameState } from '../state/types';
import { activeCombatant, fighterPerson, strikeTargets } from '../sim/battle';
import { reachTargets, throwTargets } from '../sim/strike';
import { shoveDestination } from '../sim/footwork';
import { isLeader } from '../sim/warcry';
import { beatsSince } from '../sim/beats';
import { atThePalisade, wallPairs } from '../sim/wall';
import type { Aim } from './battleUi';
import { svgEl } from './svg';
import {
  duskVignette,
  fieldFill,
  fieldPatterns,
  lightDefs,
  sunWash,
} from './fieldArt';
import {
  FIGURE_LIFT, FIGURE_R, FIGURE_W, GROUND_Y, RANK_GAP,
  extent, paintOrder, pick, standAt,
} from './line';
import { figure } from './figures';
import { createFieldPaint, type FieldPaint } from './fieldOil';
import { showBeat, type WallMemory } from './fx';
import { seasonTint, skyNodes } from './fieldWeather';
import { seasonOf } from '../sim/calendar';
import { weatherOn } from '../sim/weather';

/**
 * The thumb rule, and the scale a rank needs to meet it.
 *
 * A fighter is a touch target — tap the man you mean to hit — so he is bound
 * by the 44px minimum the rest of the game holds. On the hex field this was
 * measured across a hex's flats; on a line it is the gap between ranks,
 * which `line.ts` keeps constant precisely so this number cannot drift with
 * the size of the band.
 */
const TAP_MIN = 44;
/**
 * Measured against the MAN, not the gap between ranks.
 *
 * The first draft used the gap, on the reasoning that a rank is a slot. What
 * a thumb lands on is a drawn fighter, and he is a little narrower than his
 * slot — so a view scaled to put 44px between ranks put 42px of man on a
 * 320px screen. `scripts/field.mjs` measures the fighter and caught it.
 */
const NEEDED_SCALE = TAP_MIN / FIGURE_W;

/** Everyone still on their feet, which is everyone the field draws. */
function upright(battle: Battle): Combatant[] {
  return battle.combatants.filter((c) => !c.down && !c.fled);
}

/** How deep the deeper of the two walls is standing. Sizes the field. */
function deepest(battle: Battle): number {
  let deep = 1;
  for (const c of upright(battle)) deep = Math.max(deep, c.rank);
  return deep;
}

/** The leader, if they are standing on this field at all. */
function isLeaderHere(state: GameState, combatant: { personId: string; side: string }): boolean {
  return isLeader(state, combatant as Parameters<typeof isLeader>[1]);
}

export interface BattleView {
  root: SVGSVGElement;
  update(state: GameState, aim: Aim): void;
  /**
   * What the backdrop cost, for the debug read-out and the bars.
   *
   * The same shape the colony's `drawn()` reports, and for the same reason:
   * a painted backdrop that quietly repaints every turn is a phone getting
   * hot, and the only way to know is to count.
   */
  drawn(): ReturnType<FieldPaint['stats']>;
}

export function createBattleView(onTap: (personId: string | null) => void): BattleView {
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

  // The painted country, under everything. A live canvas in a foreignObject
  // at the field's own world bounds — see fieldOil.ts for why that rather
  // than a sibling canvas or a PNG.
  const country = createFieldPaint();
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
  // The aim the last paint was made with. The tap handler needs it to know
  // which men are targets, and it arrives with `update` rather than with the
  // pointer event. `strike` until told otherwise, which is the aim the fight
  // opens on.
  let latestAim: Aim = 'strike';
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
      if (i === 0) showBeat(battle, b, spawn, wall, root);
      else {
        window.setTimeout(
          () => showBeat(battle, b, spawn, wall, root),
          Math.min(i, 8) * BEAT_GAP,
        );
      }
    });
  }

  function fitViewBox(battle: Battle): void {
    // The field is sized to the deeper wall — a fixed gap and a box that
    // grows, rather than a fixed box and men who shrink. See line.ts for why
    // that is the load-bearing decision and not a detail.
    const box = extent(deepest(battle));

    // How big a rank would be if the whole field were framed. `xMidYMid meet`
    // scales by the tighter axis, and a line is far wider than it is tall, so
    // the width is what binds — which is the one a thumb has to hit, and the
    // one scripts/field.mjs measures.
    const rect = root.getBoundingClientRect();
    const framed = rect.width > 0 && rect.height > 0
      ? Math.min(rect.width / box.w, rect.height / box.h)
      : NEEDED_SCALE;

    if (framed >= NEEDED_SCALE) {
      // The field frames itself. A small fight on a wide screen, which a
      // shallow line manages far more often than a hex grid ever did.
      panAt = null;
      canPan = false;
      bounds = box;
      root.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
      return;
    }

    // It cannot: six sworn against six raiders is twelve ranks, and twelve
    // ranks on a 320px screen is a 27px target. So the choice is a fighter
    // under the thumb rule or a field that moves. Zoom is NOT a user control:
    // it goes exactly as far as 44px demands and no further, so the field
    // still frames as much of itself as it possibly can.
    canPan = true;
    // Fill the height with the FIELD, and take whatever width that leaves.
    //
    // Scaling by the thumb rule alone drew a view twice as tall as the field
    // and left the men at 7% of it — a shield wall seen from the far end of
    // a car park, with unpainted page showing above and below the country.
    // The height is what a side-on scene is composed on, so it binds first,
    // and the thumb rule is the floor underneath it rather than the target.
    const scale = Math.max(rect.height / box.h, NEEDED_SCALE);
    const w = rect.width / scale;
    const h = rect.height / scale;
    const centre = panAt ?? focusOf(battle) ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    // Clamped to the field: panning must not sail off into empty space. An
    // axis that still fits whole is centred rather than clamped.
    const cx = w >= box.w
      ? box.x + box.w / 2
      : Math.min(Math.max(centre.x, box.x + w / 2), box.x + box.w - w / 2);
    // THE VERTICAL IS NEVER PANNED, only framed. A drag can move the view
    // along the line, because a deep fight can be longer than the screen;
    // it must not move the view up and down, because there is nothing above
    // the wall but sky and nothing below it but ground, and a player who
    // drags into either has lost the fight off the screen for nothing.
    //
    // Caught by `scripts/pan.mjs` on a 320x568 screen, where the slot is
    // short enough that the height binds: the view showed 689 of the field's
    // 900 units and a drag slid it from y=210 to y=0 through empty sky. The
    // horizontal was already still by then, so this was the last way left to
    // lose sight of the fight.
    const onTheWall = GROUND_Y - FIGURE_LIFT;
    const cy = h >= box.h
      ? box.y + box.h / 2
      : Math.min(Math.max(onTheWall, box.y + h / 2), box.y + box.h - h / 2);
    // The light, the vignette and the weather cover what is SHOWN, not what
    // the line happens to span — otherwise a view wider or taller than the
    // field paints sky onto part of it and bare page onto the rest.
    bounds = { x: cx - w / 2, y: cy - h / 2, w, h };
    root.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
  }

  /** Where a zoomed field looks by default: whoever is taking their turn. */
  /**
   * The men the current aim can actually act on.
   *
   * One function, because the MARK under a man and the TAP that hits him
   * have to agree about who is a target — the same discipline `standAt` and
   * `pick` keep about where he stands. They were two expressions of the same
   * thing until the tap needed it too.
   */
  function markedFor(state: GameState, aim: string | undefined): Combatant[] {
    return aim === 'throw'
      ? throwTargets(state)
      : aim === 'reach'
        ? reachTargets(state)
        : strikeTargets(state);
  }

  function focusOf(battle: Battle): { x: number; y: number } | undefined {
    const active = activeCombatant(battle);
    if (!active) return undefined;
    const spot = standAt(active.side, active.rank);
    return { x: spot.x, y: spot.y - FIGURE_LIFT };
  }

  function paint(state: GameState, aim: Aim): void {
    latest = state;
    latestAim = aim;
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

    // The ground, seen from the side: sky, the country behind, and the
    // ground the men stand on. Painted with the oil brush rather than drawn
    // — see fieldOil.ts.
    //
    // Flat fills go down FIRST and cover what is SHOWN, which can be larger
    // than the painted box on a short, wide element. Cheap insurance against
    // the one failure mode that looks like a broken page rather than a
    // plain one: bare background where the country should be.
    const box = bounds ?? extent(deepest(battle));
    layers.ground.append(
      svgEl('rect', {
        x: box.x, y: box.y, width: box.w, height: GROUND_Y - box.y,
        fill: 'var(--sky, #8b9aa8)',
      }),
      svgEl('rect', {
        x: box.x, y: GROUND_Y, width: box.w, height: box.y + box.h - GROUND_Y,
        fill: fieldFill('open', battle.terrain),
      }),
    );
    // The painting covers the FIELD, not the view: the field does not change
    // while the player drags, so panning costs nothing and only a line that
    // gained or lost a rank loads the brush again.
    //
    // Appended AFTER the flat fills and into the same layer, which is the
    // whole of the ordering. Its first home was a layer of its own beneath
    // this one, where the insurance fills sat on top and hid the painting
    // completely — a canvas that is present, correct, and invisible.
    // Re-appending the same node keeps the canvas and its contents.
    country.update(extent(deepest(battle)), battle.terrain, state.seed);
    layers.ground.append(country.node);

    // The palisade, if the raiders are climbing one. On the hex field it was
    // stakes drawn on whichever tiles were 'wall'; side-on it is the thing
    // the two walls are meeting ACROSS, which is what the player spent eight
    // timber on and what `wall.ts` prices as the raiders' front rank being
    // exposed.
    if (atThePalisade(battle)) layers.overlay.append(stakes(0, GROUND_Y));

    const active = activeCombatant(battle);

    if (active?.side === 'warband' && !battle.outcome) {
      // Ground the enemy threatens: step in here and your move stops.
      // The threatened-ground shading and the move-target ring stood here.
      // Both drew answers to "where could this fighter go", and since 8.1c
      // there is nowhere to go — the line-shaped controls arrive with 8.1d.

      // Whoever the armed action can actually reach.
      const marked = markedFor(state, aim);
      for (const target of marked) {
        const p = standAt(target.side, target.rank);
        const ink = aim === 'throw' ? '#d3a441' : aim === 'reach' ? '#cfd8dc' : '#b23b2e';
        // A mark UNDER the man, not a ring around a tile. On a line the
        // thing being aimed at is a person, and the ground he is standing on
        // is the only part of him nobody else overlaps.
        layers.overlay.append(
          svgEl('ellipse', {
            // Classed so `scripts/pan.mjs` can find what the game says is in
            // reach rather than sniffing for a stroke colour.
            class: 'mark',
            cx: p.x, cy: p.y, rx: RANK_GAP * 0.42, ry: RANK_GAP * 0.13,
            fill: 'none',
            stroke: ink,
            'stroke-width': 3,
            'stroke-dasharray': aim === 'throw' ? '6 4' : aim === 'reach' ? '3 3' : '',
          }),
        );
        // Show who a shove would put in front instead — the whole worth of
        // the verb is which man ends up holding their line.
        if (aim === 'shove') {
          const came = shoveDestination(battle, target);
          if (came) {
            const q = standAt(came.side, came.rank);
            layers.overlay.append(
              svgEl('path', {
                d: `M ${q.x} ${q.y - FIGURE_LIFT} L ${p.x} ${p.y - FIGURE_LIFT}`,
                stroke: '#d3a441', 'stroke-width': 2.5, fill: 'none',
                'stroke-dasharray': '5 4', opacity: 0.9,
              }),
              svgEl('ellipse', {
                cx: q.x, cy: q.y, rx: RANK_GAP * 0.34, ry: RANK_GAP * 0.1,
                fill: 'none', stroke: '#d3a441', 'stroke-width': 2, opacity: 0.9,
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
      // Shoulder to shoulder is adjacent RANKS, so the brace runs along the
      // line rather than across the field. Drawn at chest height, which is
      // where a shield is held.
      const sa = standAt(a.side, a.rank);
      const sb = standAt(b.side, b.rank);
      const pa = { x: sa.x, y: sa.y - FIGURE_LIFT };
      const pb = { x: sb.x, y: sb.y - FIGURE_LIFT };
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
      const spot = standAt(combatant.side, combatant.rank);
      layers.overlay.append(
        svgEl('ellipse', {
          cx: spot.x, cy: spot.y, rx: FIGURE_R + 4.5, ry: RANK_GAP * 0.16,
          fill: 'none',
          stroke: combatant.side === 'warband' ? '#e8dcc0' : '#9fb0c4',
          'stroke-width': 4,
          opacity: 0.3,
        }),
      );
    }

    // Back ranks first, so the front of each wall overlaps the men behind it
    // the way a real one does — and the two walls interleaved by depth, or
    // one would sit wholly in front of the other where they meet.
    for (const combatant of paintOrder(upright(battle))) {
      const person = fighterPerson(state, combatant.personId);
      if (!person) continue;
      const spot = standAt(combatant.side, combatant.rank);
      const p = { x: spot.x, y: spot.y - FIGURE_LIFT };
      const isActive = active?.personId === combatant.personId;
      const drawn = figure(p.x, p.y, FIGURE_R, person, {
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
      });
      // So a blow can find the body it landed on and shove it — see the
      // recoil in `fx.ts`. Marked HERE rather than inside `figure()`, which
      // is shared with the road and the yard and has no business knowing
      // about beats.
      drawn.setAttribute('data-who', combatant.personId);
      layers.fighters.append(drawn);
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
    // Who was tapped, or nobody. `pick` is the tap half of `standAt` and
    // lives beside it so the two cannot disagree; it answers undefined for
    // bare ground rather than rounding to the nearest man, because since
    // 8.1c bare ground is not an order and must not become one.
    // A TARGET FIRST, and with a generous strip around him.
    //
    // Ranks overlap now (see `RANK_STEP`), so half a step is a 12px strip on
    // a 390px screen — fine for asking "who is standing exactly here", far
    // too mean for "which foe did they mean to hit". But there are at most
    // two of those, `REACH` says so, and they stand a wall apart: giving
    // each of them most of a man's width to be tapped in is what keeps the
    // 44px rule true of the things that are actually targets, which is what
    // it was always for.
    const where = worldUnder(e);
    const targets = markedFor(latest, latestAim);
    const hit = (targets.length > 0 ? pick(targets, where, FIGURE_W * 0.75) : undefined)
      ?? pick(upright(latest.battle), where);
    onTap(hit ? hit.personId : null);
  });

  return {
    root,
    update(state, aim) {
      paint(state, aim);
    },
    drawn: () => country.stats(),
  };
}

// --- Procedural marks ---


/**
 * The palisade, seen from the side: split trunks, sharpened, sunk deep,
 * standing between the two walls.
 *
 * On the hex field this was a clump drawn on every tile whose ground was
 * 'wall'. Side-on there is one palisade and the fight is happening ACROSS
 * it — which is what `sim/wall.ts` prices when it makes the raiders' front
 * rank hold no line and take `WALL_EXPOSED`. Drawn tall enough to be
 * something a man has to get over rather than a decorative fence.
 */
function stakes(cx: number, groundY: number): SVGGElement {
  const g = svgEl('g', { class: 'stakes' });
  const tall = RANK_GAP * 0.95;
  const step = RANK_GAP * 0.13;
  for (let i = -3; i <= 3; i += 1) {
    const x = cx + i * step;
    // Uneven heights: a palisade is trunks somebody cut, not a picket fence.
    const h = tall * (0.86 + ((i * 7) % 5) * 0.035);
    g.append(
      svgEl('path', {
        d: `M ${x} ${groundY + 4} L ${x} ${groundY - h} L ${x + step * 0.34} ${groundY - h - step * 0.55}`,
        stroke: '#c9a468',
        'stroke-width': 4,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  // The rail they are lashed to, and the shadow they throw on the ground.
  g.append(
    svgEl('line', {
      x1: cx - step * 3.4, y1: groundY - tall * 0.42,
      x2: cx + step * 3.4, y2: groundY - tall * 0.42,
      stroke: '#8a6f43', 'stroke-width': 3,
    }),
    svgEl('ellipse', {
      cx, cy: groundY + 4, rx: step * 3.6, ry: RANK_GAP * 0.07,
      fill: '#000', opacity: 0.22,
    }),
  );
  return g;
}

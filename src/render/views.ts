// What the two map slots promise the screens above them.
//
// These two interfaces lived in `render/travel.ts` and `render/colony.ts` —
// the hex map and the hex steading ring — because those were the only things
// that met them. Phase 8 wrote a second implementation of each, and 8.5
// deleted the first, which leaves the contract with no natural home except
// its own file. That is the right place for it anyway: a view contract that
// lives inside one of its implementations reads as that implementation's
// details rather than as the promise every view has to keep.

import type { GameState } from '../state/types';

/**
 * What a travel view is holding, asked of the renderer rather than of the
 * document.
 *
 * The bars read this. `work` is the cost meter that matters: a still picture
 * must not move it, however many repaints go past, which is the whole claim
 * `scripts/repaint.mjs` used to make about the map and `procession.mjs` makes
 * about the road.
 */
export interface DrawnReport {
  backend: 'svg' | 'oil';
  /** Stretches the renderer is holding. */
  charted: number;
  /** Of those, the ones it is showing rather than remembering. */
  lit: number;
  /** Anything it has built or painted more often than it was owed. */
  duplicates: number;
  /** Every expensive thing done since mount. Monotonic. */
  work: number;
}

export interface TravelView {
  root: SVGSVGElement;
  /** What the slot mounts, in order: the painting, if any, then the picture. */
  nodes: Node[];
  drawn(): DrawnReport;
  /** Brightness of the painting at world points. Empty unless it is painted. */
  sample(points: readonly (readonly [number, number])[]): (number | null)[];
  /** Re-draws from current state, preserving whatever the view is showing. */
  update(state: GameState): void;
  /**
   * Puts the band back in frame.
   *
   * Took a `Hex` until 8.5 and takes nothing now: a coast has no camera to
   * move, because the band is always in the middle of its own stretch and the
   * picture IS where they are standing.
   */
  centreOn(): void;
}

export interface ColonyView {
  root: SVGSVGElement;
  update(state: GameState): void;
  /** What the brush has done, for the debug read-out and the bars. */
  drawn(): { backend: 'svg' | 'oil'; plots: number; painted: number; kept: number };
}

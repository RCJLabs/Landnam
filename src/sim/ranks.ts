// Where a fighter stands in the line, and what that lets them do.
//
// This replaces the hex battlefield. A shield wall is not a plane, it is a
// LINE with depth: rank 1 is the front, where the two walls meet, and rank 4
// is the back, where the throwers stand. Everything tactical falls out of
// that one fact — a spear works from the second rank because it goes past
// the shoulder of the man in front, and an axe does not, because there is a
// man in the way.
//
// Two reasons this is the shape rather than a grid.
//
// The measured one: `distance(a, b) === 1` was doing nearly all the spatial
// work in the old battle — eight places, and every one of them meant
// "adjacent", not "somewhere on a plane". A 7x9 grid was carrying about a
// dozen lines of real geometry.
//
// The one that matters more: on a grid, a shield wall is something the
// player has to build and the renderer has to explain. In a line it is the
// default state of the world, and breaking it is the thing that costs you.
//
// Pure, and deliberately structural: nothing here imports Combatant, so it
// can be tested without a battle, a person, or a GameState.

/** How deep a line stands. Four is the band; a bigger warband still forms four deep. */
export const RANKS = 4;

/** The verbs that care where you are standing. `warcry` does not, so it is absent. */
export type RankVerb = 'strike' | 'reach' | 'throw' | 'shove' | 'defend' | 'dash';

export interface Reach {
  /** Ranks this can be done FROM. */
  readonly from: readonly number[];
  /** Enemy ranks it lands on. Empty means it is done to yourself. */
  readonly at: readonly number[];
}

/**
 * What each verb can do, and from where.
 *
 * The numbers are the whole design, so they live in one table rather than
 * scattered through the verbs — adding a weapon should be editing this, in
 * the spirit of the project's oldest rule about data and engine.
 *
 * - `strike` is axe-work: the heaviest blow, and only the front two can land
 *   it, on the front two.
 * - `reach` is a spear past the shoulder of the man in front. Less damage,
 *   but it is the only thing that touches the third rank, and it is why
 *   standing second is worth anything.
 * - `throw` is a hand-axe. It reaches anybody, which is what makes the back
 *   rank useful, but you carry only so many.
 * - `shove` is shield to shoulder. Small damage; the point is that it drives
 *   a man back a rank and puts somebody else in front of him.
 * - `defend` is setting the shield, and only the front two have anything to
 *   set it against.
 * - `dash` is no longer movement across ground. It is changing rank — the
 *   spearman who has been shoved to the front buying his way back.
 */
export const REACH: Record<RankVerb, Reach> = {
  strike: { from: [1, 2], at: [1, 2] },
  reach: { from: [2, 3], at: [1, 2, 3] },
  throw: { from: [2, 3, 4], at: [1, 2, 3, 4] },
  shove: { from: [1, 2], at: [1, 2] },
  defend: { from: [1, 2], at: [] },
  dash: { from: [1, 2, 3, 4], at: [] },
};

/**
 * The least a fighter needs to have a place in the line.
 *
 * Structural on purpose. `Combatant` satisfies this once it carries a rank,
 * and so does a two-line object in a test, which is the point.
 */
export interface Ranked {
  side: string;
  rank: number;
  down: boolean;
  fled: boolean;
}

/** Still in the fight: not dropped, not run off. */
export function standing<T extends Ranked>(line: readonly T[], side: string): T[] {
  return line.filter((c) => c.side === side && !c.down && !c.fled);
}

/** Whoever is holding the given rank on a side, if anybody is. */
export function atRank<T extends Ranked>(line: readonly T[], side: string, rank: number): T | undefined {
  return standing(line, side).find((c) => c.rank === rank);
}

/** How deep this side is still standing. */
export function depth(line: readonly Ranked[], side: string): number {
  return standing(line, side).length;
}

/**
 * Close the line up.
 *
 * The single most important rule in the mode: when a man goes down, the line
 * does not leave a hole where he was — everyone behind steps forward, and
 * whoever was second is suddenly first. That is what makes losing a
 * front-rank man cost more than his own health bar, and it is the trap the
 * whole tactical layer rests on: a spearman shoved into rank 1 has nothing
 * to do there.
 *
 * Relative order is preserved, so this is stable: closing up twice changes
 * nothing, and it never reshuffles a line that has lost nobody.
 */
export function closeUp<T extends Ranked>(line: readonly T[], side: string): void {
  standing(line, side)
    .sort((a, b) => a.rank - b.rank)
    .forEach((c, i) => { c.rank = i + 1; });
}

/** Can this verb be used from where this fighter is standing? */
export function canActFrom(verb: RankVerb, rank: number): boolean {
  return REACH[verb].from.includes(rank);
}

/**
 * Everyone on the other side this verb can actually touch.
 *
 * Returns nothing for `defend` and `dash`, which are done to yourself — the
 * caller asks `canActFrom` for those.
 */
export function targetsFor<T extends Ranked>(
  line: readonly T[],
  actor: Ranked,
  verb: RankVerb,
  foeSide: string,
): T[] {
  if (!canActFrom(verb, actor.rank)) return [];
  const reach = REACH[verb].at;
  if (reach.length === 0) return [];
  return standing(line, foeSide).filter((c) => reach.includes(c.rank));
}

/**
 * Drive a fighter back one rank, swapping with whoever was behind them.
 *
 * Returns the one who came forward, or null when the shoved man was already
 * at the back of his line and had nowhere to go — a shove into the last rank
 * still lands its blow, it just does not move anybody.
 */
export function shoveBack<T extends Ranked>(line: readonly T[], target: T): T | null {
  const behind = atRank(line, target.side, target.rank + 1);
  if (!behind) return null;
  const was = target.rank;
  target.rank = behind.rank;
  behind.rank = was;
  return behind;
}

/**
 * Step a rank forward (`-1`) or back (`+1`), swapping with whoever is there.
 *
 * Stepping into an empty rank is allowed only when it is inside the line —
 * you cannot dash off the back of your own wall into open ground.
 */
export function shift<T extends Ranked>(line: readonly T[], actor: T, by: -1 | 1): boolean {
  const want = actor.rank + by;
  if (want < 1 || want > Math.max(RANKS, depth(line, actor.side))) return false;
  const there = atRank(line, actor.side, want);
  if (there) {
    there.rank = actor.rank;
    actor.rank = want;
    return true;
  }
  if (want > depth(line, actor.side)) return false;
  actor.rank = want;
  return true;
}

/**
 * Are these two shoulder to shoulder in the wall?
 *
 * This is what `distance(a, b) === 1` used to mean, and it is the check the
 * shield wall is built on. Adjacent ranks on the same side: the man in front
 * and the man behind him hold the wall together.
 */
export function linked(a: Ranked, b: Ranked): boolean {
  if (a.side !== b.side) return false;
  if (a.down || a.fled || b.down || b.fled) return false;
  return Math.abs(a.rank - b.rank) === 1;
}

/** Whoever this fighter is engaged with: the enemy front rank meets yours. */
export function engaged<T extends Ranked>(line: readonly T[], actor: Ranked, foeSide: string): T[] {
  if (actor.rank > 2) return [];
  return standing(line, foeSide).filter((c) => c.rank <= 2);
}

// How a wall forms up: who stands in the front rank, and who falls in behind.
//
// NOT to be confused with render/line.ts, which is where a rank stands on the
// SCREEN. This file decides who is in which rank; that one decides where the
// rank is drawn.
//
// THIS FILE EXISTS BECAUSE OF A BUG, and the bug is worth stating because it
// is the kind that hides in plain sight for a whole phase.
//
// Rank used to be the order people came off the boat. `battle.ts` handed it
// out as `combatants.filter(side==='warband').length + 1` over
// `sworn(fieldCrew(state))`, and `sworn` is `state.party.people` filtered and
// sliced — so a fighter's place in the shield wall was his ROSTER INDEX.
//
// That index is not a spare number. `leaderOf` is `sworn(people)[0]`, so the
// band's leader stood in the front rank of every fight it ever had; and
// `bindKin` pairs `free[0]` with `free[1]` and `free[2]` with `free[3]`, so
// both kin pairs stood shoulder to shoulder. Three unrelated systems keyed to
// one array position, all correlated perfectly, and nobody chose any of it.
//
// MEASURED (11.S1, 2026-09-02) before this file was written: over 300 arena
// fights an arm, the shipped roster line won 178 while a line drawn AT RANDOM
// won 218 and a reversed one 240. The game was deploying its shield wall in
// an order worse than chance. In whole sagas — 150 landings, to day 500 — the
// same reorder took bands still standing from 7 to 19.
//
// What did NOT measure is sorting the line by quality: best-men-front won 222
// against random's 218, inside the noise. So this is not a clever ordering
// and does not pretend to be one. It is a legible rule that breaks the
// correlation, and the whole of its value is in no longer being the roster.
//
// SYMMETRIC, and that is not politeness. sim/battleAi.ts's own comment states
// the rule: "a formation trick that only the warband can play is not a
// formation, it is a bonus." Both walls form up the same way.

import type { Person } from '../state/types';
import { effectiveStat } from './people';

/**
 * How fit a fighter is to hold the front rank.
 *
 * The front is where the blows land and where the axe-work is done, so it is
 * held by whoever can take a blow and return one: current health, plus might.
 *
 * Health rather than maxHealth ON PURPOSE — it is what makes the rule do
 * something a static one could not. A man who takes a wound in the spring
 * stands further back in the autumn without anybody deciding it, and the line
 * re-forms around him every fight. Might is the smaller term by design: it
 * separates two hale men, and it never outweighs being hurt.
 */
export function heft(person: Person): number {
  return person.health + effectiveStat(person, 'might');
}

/**
 * The order a wall forms in, front rank first.
 *
 * Pure, total and stable: ties break on `id`, so the same band forms the same
 * line twice and a replayed save does not fork. Does not mutate its argument.
 */
export function formUp(people: readonly Person[]): Person[] {
  return [...people].sort((a, b) => heft(b) - heft(a) || a.id.localeCompare(b.id));
}

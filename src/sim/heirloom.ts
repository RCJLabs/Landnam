// The blade that outlives the hand.
//
// WHAT THIS ITEM'S PREMISE GOT WRONG, and it is worth having in the file
// rather than only in the roadmap. 9.9 was written as "the memorial, the
// lineage and the generations exist and do not talk to each other". Two of
// those three already talk, and the source says so plainly: `hallPasses`
// imports `childrenOf` and names the dead leader's children, and `maybeBirth`
// reads `kinOf` to record a father that `maybePair` made. The system that is
// genuinely deaf is the MEMORIAL — `fallenOf` maps a person to a name, a
// byname, a fate, a day and a seed, and to nothing at all about who they were
// to anybody.
//
// And it is deaf about something dense. Measured over 60 sagas an arm
// (`PROBE: what a lineage actually amounts to`, 2026-08-31): the wall is
// handed 293 names on even and 277 on fair, and **56% of them were bound to
// somebody**. A third of even sagas and 57% of fair ones see a child born.
// The hall passes 158 times on even. So there is plenty for a thing to be
// carried BY; there was simply no thing.
//
// WHAT IT DOES NOT DO. It does not touch a stat, a roll or a wound. That is
// a decision, not an omission: the second-year killer is morale (9.12), and
// a heart term on a death would soften exactly the pressure that diagnosis
// found, in a feature whose job is to connect three systems rather than to
// tune one. The bar it is held to is that the curve does not move — see
// `test/heirloom.test.ts`.

import type { Blade, GameState, Person } from '../state/types';
import { BLADES } from '../data/blades';
import { leaderOf } from './people';
import { childrenOf } from './lineage';
import { chronicle } from './saga';
import { stream } from '../rng';

/**
 * The blade this seed's band came ashore with.
 *
 * Off its own derived stream, so adding it perturbs no other roll and every
 * curve this repo has measured stays where it was. The first hand is the
 * leader's: a sword with a name is the thing a landnamsmadr is carrying, and
 * having it appear later would need a giver the game has not got.
 */
export function makeBlade(seed: string, bearer: Person): Blade {
  const pick = stream(seed, 'worldgen').derive('blade').pick(BLADES);
  return { name: pick.name, holder: bearer.id, borne: [bearer.name] };
}

/** What the blade means, for the one line that says it. */
export function meaningOf(name: string): string {
  return BLADES.find((b) => b.name === name)?.means ?? name;
}

/** Whoever is carrying it, or nobody. */
export function bearerOf(state: GameState): Person | undefined {
  const blade = state.party.blade;
  if (!blade?.holder) return undefined;
  return state.party.people.find((p) => p.id === blade.holder && p.alive);
}

/** What this person bore, for the memorial. Undefined for everybody else. */
export function boreBlade(state: GameState, person: Person): string | undefined {
  const blade = state.party.blade;
  if (!blade) return undefined;
  return blade.borne.includes(person.name) ? blade.name : undefined;
}

/**
 * The blade changes hands, or does not. Called from `mourn`.
 *
 * Three ways out, in this order, and the order IS the feature:
 *
 * 1. **A child.** If the dead left one, the blade is laid by for them and
 *    stops moving. That is the lineage talking to the succession, and it is
 *    the branch the whole item exists for — nothing else in the game says
 *    that a four-year-old is owed anything.
 * 2. **Kin.** Whoever they were bound to, if that person is still alive.
 * 3. **Whoever leads now.** `mourn` runs after the death site has cleared
 *    `alive`, so `leaderOf` already names the successor — the same fact
 *    `hallPasses` relies on.
 *
 * A blade already laid by does not move again. A chest is a chest.
 */
export function passBlade(state: GameState, dead: Person): void {
  const blade = state.party.blade;
  if (!blade || blade.holder !== dead.id) return;
  delete blade.holder;

  const heirs = childrenOf(state).filter(
    (c) => c.mother === dead.id || c.father === dead.id,
  );
  if (heirs.length > 0) {
    // The eldest: the one born first, which is the one who might live to
    // lift it. Sorted rather than [0] — `children` is push-ordered today and
    // a reader should not have to know that.
    const eldest = [...heirs].sort((a, b) => a.bornOn - b.bornOn)[0]!;
    blade.laidFor = eldest.name;
    chronicle(
      state,
      `${blade.name} was wrapped and laid in the chest for ${eldest.name}, `
        + 'who cannot yet lift it. Nobody argued.',
      'saga',
    );
    return;
  }

  const kin = dead.kin ? state.party.people.find((p) => p.id === dead.kin!.id) : undefined;
  const heir = kin?.alive ? kin : leaderOf(state.party.people);
  if (!heir || !heir.alive) {
    // Nobody left to take it. The run is over or nearly, and saying so is
    // better than a blade that silently belongs to no one.
    chronicle(state, `${blade.name} lay where it fell.`, 'grim');
    return;
  }

  blade.holder = heir.id;
  if (!blade.borne.includes(heir.name)) blade.borne.push(heir.name);
  chronicle(
    state,
    kin?.alive
      ? `${blade.name} went to ${heir.name}, who was ${dead.kin?.tie ?? 'kin'} to ${dead.name}.`
      : `${heir.name} took up ${blade.name}. It has been in ${blade.borne.length} hands now.`,
    'saga',
  );
}

/**
 * The bearer LEAVES the band — walked out, or was driven out. Mutates.
 *
 * Found by reading this file's own diff rather than by a test failing, which
 * is why it is worth a paragraph. `passBlade` hangs off `mourn`, and `mourn`
 * is only called for the dead: `handsLeave` and `driveOut` set `alive: false`
 * with `left: true` and never mourn, because the saga should not bury a man
 * who is fine. So a bearer who walked out left `holder` pointing at somebody
 * `bearerOf` refuses to return — and no later death could move the blade,
 * because every one of them fails the `holder !== dead.id` guard. The band's
 * heirloom would silently cease to exist, in a saga that never mentioned it
 * again.
 *
 * It stays with the band, and that is a decision. The sword is on the PARTY,
 * not on the man; a hand who leaves in the night does not carry off what the
 * hall owns. No child branch either — he is not dead, and laying his sword by
 * for his daughter would be saying he was.
 */
export function bladeLeftBehind(state: GameState, gone: Person): void {
  const blade = state.party.blade;
  if (!blade || blade.holder !== gone.id) return;
  delete blade.holder;
  const heir = leaderOf(state.party.people);
  if (!heir || !heir.alive) return;
  blade.holder = heir.id;
  if (!blade.borne.includes(heir.name)) blade.borne.push(heir.name);
  chronicle(
    state,
    `${gone.name} did not take ${blade.name} away. ${heir.name} has it now.`,
    'saga',
  );
}

/**
 * Where the blade stands, for the closing card, or null when there is none.
 *
 * Written here rather than in the renderer because it is a reading of state
 * and this repo's fourth hard constraint says so.
 */
export function bladeStanding(state: GameState): string | null {
  const blade = state.party.blade;
  if (!blade) return null;
  // Silent when nothing happened to it. A blade that spent the whole saga on
  // one hip is a fact about the run, not an event in it, and a closing line
  // in every single saga saying so is the decoration this project keeps
  // catching in checklists.
  if (blade.borne.length === 1 && !blade.laidFor) return null;
  const hands = blade.borne.length;
  const through = hands === 1 ? 'one hand' : `${hands} hands`;
  if (blade.laidFor) {
    return `${blade.name} went through ${through}, and lies in a chest for `
      + `${blade.laidFor}, who was not old enough.`;
  }
  const holder = bearerOf(state);
  if (holder) return `${blade.name} went through ${through}, and ${holder.name} has it.`;
  return `${blade.name} went through ${through}, and nobody has it now.`;
}

// Who is whose, and what it costs to lose them.
//
// Grief is already the game's chief killer — every deaths-by-fate reading
// since the first one has put despair at the top, ahead of hunger, cold and
// steel together. What was missing was a NAME on it. A band of six strangers
// mourns arithmetically; a band where two of them are brothers mourns the
// way the sagas do, and the player can see it coming and play around it.

import type { GameState, Person } from '../state/types';
import { ELDER_TIES, GENERATION, KIN_GRIEF, PEER_TIES } from '../data/kin';
import { MEN, WOMEN } from '../data/names';
import type { Rng } from '../rng';
import { chronicle } from './saga';
import { ORPHAN_GRIEF } from '../data/lineage';

/** What a death does to the children it leaves. */
function orphaned(state: GameState, dead: Person): void {
  const left = (state.settlement?.children ?? []).filter(
    (c) => c.mother === dead.id || c.father === dead.id,
  );
  if (left.length === 0) return;
  state.party.morale = Math.max(0, state.party.morale - ORPHAN_GRIEF * left.length);
  chronicle(
    state,
    left.length === 1
      ? `${left[0]!.name} was left without ${isWoman(dead) ? 'a mother' : 'a father'}, and the steading felt it.`
      : `${left.length} children were left short a parent that day.`,
    'grim',
  );
}
import { fullName } from './people';

/**
 * Whether this person is a woman, recovered from which pool their name came
 * out of.
 *
 * Deliberately DERIVED rather than stored. makePerson already decides this
 * to pick a name and then throws it away, and the two pools are disjoint
 * (asserted in test/kin.test.ts), so the name is the record. Adding a field
 * would have meant a save migration to reconstruct something already sitting
 * in plain sight.
 */
export function isWoman(person: Person): boolean {
  return WOMEN.includes(person.name);
}

/** The person this one is bound to, if they are still in the band. */
export function kinOf(people: Person[], person: Person): Person | undefined {
  if (!person.kin) return undefined;
  return people.find((p) => p.id === person.kin!.id);
}

/** What `person` calls their kin — "his brother", "her mother". */
export function kinLine(people: Person[], person: Person): string | undefined {
  const other = kinOf(people, person);
  if (!other || !person.kin) return undefined;
  return `${person.kin.tie} to ${other.name}`;
}

function pairFor(a: Person, b: Person, rng: Rng): [string, string] {
  const aWoman = isWoman(a);
  const bWoman = isWoman(b);
  const gap = Math.abs(a.age - b.age);

  if (gap >= GENERATION) {
    // The elder is the parent, whichever way round they came off the boat.
    const elder = a.age >= b.age ? a : b;
    const younger = elder === a ? b : a;
    const key = `${isWoman(elder) ? 'f' : 'm'}${isWoman(younger) ? 'f' : 'm'}` as
      keyof typeof ELDER_TIES;
    const [elderWord, youngerWord] = ELDER_TIES[key];
    return elder === a ? [elderWord, youngerWord] : [youngerWord, elderWord];
  }

  const key = aWoman && bWoman ? 'ff' : !aWoman && !bWoman ? 'mm' : 'mf';
  const pick = rng.pick(PEER_TIES[key]);
  // The mixed table is written man-first, so it flips when `a` is the woman.
  if (key === 'mf' && aWoman) return [pick[1], pick[0]];
  return [pick[0], pick[1]];
}

/**
 * Binds pairs among the people who came off the knarr together.
 *
 * Two pairs of six: enough that most runs carry at least one bond through
 * to the point where it can be broken, and not so many that the whole band
 * is one family and every death is the maximum death.
 */
export function bindKin(people: Person[], rng: Rng, pairs = 2): void {
  const free = people.filter((p) => !p.kin);
  for (let i = 0; i < pairs; i += 1) {
    const a = free[i * 2];
    const b = free[i * 2 + 1];
    if (!a || !b) return;
    const [aWord, bWord] = pairFor(a, b, rng.derive(`tie:${i}`));
    a.kin = { id: b.id, tie: aWord };
    b.kin = { id: a.id, tie: bWord };
  }
}

/**
 * Someone has died. If anyone was bound to them, it lands on that person
 * far harder than on the band, and the saga says whose loss it was.
 *
 * Called from every place a member of the band can die — there are five,
 * and there is deliberately no clever central hook: a death that forgets to
 * mourn is a bug you find months later, and an explicit call at each site
 * is a thing a reader can check.
 */
export function mourn(state: GameState, dead: Person): void {
  // A death that leaves a child costs the steading something for who is left
  // behind rather than only for who is gone — the item's "consequences beyond
  // subtraction", made concrete.
  //
  // Here rather than in `lineage.ts` for one reason: `mourn` is the single
  // funnel all six death paths already run through, and lineage imports this
  // file for `isWoman` and `kinOf`, so putting it the other way round would
  // be a cycle. Only the constant is imported.
  orphaned(state, dead);
  const other = kinOf(state.party.people, dead);
  if (!other || !other.alive) return;
  other.morale = Math.max(0, other.morale - KIN_GRIEF);
  chronicle(
    state,
    `${fullName(other)} had no words. ${dead.name} was ${other.kin?.tie ?? 'kin'} to ${other.name}.`,
    'grim',
  );
}

/** Men and women of the band, for a roster that reads like people. */
export function kinPairs(people: Person[]): [Person, Person][] {
  const seen = new Set<string>();
  const out: [Person, Person][] = [];
  for (const person of people) {
    const other = kinOf(people, person);
    if (!other || seen.has(person.id)) continue;
    seen.add(person.id);
    seen.add(other.id);
    out.push([person, other]);
  }
  return out;
}

/** Exported for the pool-disjointness lint. */
export const NAME_POOLS = { MEN, WOMEN };

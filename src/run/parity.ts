// The parity contract for the sim, facet by facet.
//
// Phase 7 item 1 was decided on 2026-08-13: the rules get rewritten in C++
// and the TypeScript becomes the reference implementation. That only works
// if the two are checked against each other continuously, which is item 5,
// and item 5 has to exist BEFORE the port rather than after — a subsystem
// that lands with nothing to be wrong against is a subsystem nobody can tell
// is wrong.
//
// `stateHash` in headless.ts already hashes a whole GameState, and it is the
// wrong instrument for this one job. It is ALL-OR-NOTHING: a port that has
// worldgen and nothing else cannot match it, so it stays red from the first
// day of the port to the last and tells you nothing on any of them. A bar
// that cannot go green until everything is done is a bar nobody can work
// against.
//
// So: FACETS. Each is a named, independently hashed slice of the state, and
// they are ordered to match the order the port lands in. Worldgen lands, the
// `world` facet goes green and STAYS green — any later drift in worldgen is
// caught the day it happens rather than at the end. Nothing else needs to
// pass for that to be true.
//
// Two things are stored beside every hash on purpose, and the second is the
// one the RNG fixture taught:
//
//  - the CANONICAL LENGTH, so a mismatch immediately separates "these are
//    different states" from "these are different SHAPES" — a port missing a
//    field entirely reads very differently from one that computed a value
//    wrong, and the hash alone cannot tell them apart.
//  - a handful of PLAIN SAMPLES — integers and short strings, never
//    fractions — so a red test says "your day 40 food is 12 and mine is 31"
//    instead of "two hex strings differ". A bare hash is a smoke alarm with
//    no address on it.

import { hashOf, canonical } from './headless';
import type { GameState } from '../state/types';

/**
 * The slices, in the order the port takes them.
 *
 * Deliberately a PARTITION of what `stateHash` covers rather than an
 * arbitrary set of views: every field of GameState that is about the run
 * (as opposed to the telling of it) belongs to exactly one facet, so
 * "all facets match" and "the states match" mean the same thing. A field
 * that belonged to two would be checked twice and one that belonged to
 * none would be checked never, and the second is how a port ships a
 * silently divergent subsystem.
 */
export type FacetId = 'world' | 'band' | 'ship' | 'coast' | 'steading' | 'field' | 'run';

export interface Facet {
  id: FacetId;
  /** What it covers, and which port stage owns it. */
  blurb: string;
  of(state: GameState): unknown;
  /** Legible values, for a mismatch that has to be diagnosed. */
  samples(state: GameState): Record<string, number | string>;
}

export const FACETS: Facet[] = [
  {
    id: 'world',
    blurb: 'The generated country: tiles, landing, places. Stage 1 — worldgen.',
    of: (s) => s.world,
    samples: (s) => ({
      tiles: Object.keys(s.world.tiles).length,
      places: s.world.places.length,
      landingQ: s.world.landing.q,
      landingR: s.world.landing.r,
      seen: Object.keys(s.world.seen).length,
    }),
  },
  {
    id: 'band',
    blurb: 'The people and what they carry. Stage 2 — party, upkeep, calendar.',
    of: (s) => s.party,
    samples: (s) => ({
      people: s.party.people.length,
      alive: s.party.people.filter((p) => p.alive).length,
      food: Math.round(s.party.food),
      firewood: Math.round(s.party.firewood),
      morale: Math.round(s.party.morale),
      atQ: s.party.at.q,
      atR: s.party.at.r,
    }),
  },
  {
    id: 'ship',
    /**
     * Her own facet rather than a field folded into `band`, and the reason is
     * the port rather than tidiness: `band` serialises `s.party` by identity,
     * so nesting it to make room would rewrite stage 2's canonical bytes and
     * churn a stage that already passes. Additive costs the port one small
     * new check and nothing else.
     */
    blurb: 'The knarr — her name and what is sound in her. Stage 2 — sea, travel.',
    of: (s) => ({ ship: s.ship }),
    samples: (s) => ({
      name: s.ship.name,
      strakes: s.ship.strakes,
    }),
  },
  {
    id: 'coast',
    blurb: 'Who else is out there and what they think of you. Stage 3 — neighbours, feuds.',
    of: (s) => ({ neighbours: s.neighbours, grudges: s.grudges, lore: s.lore }),
    samples: (s) => ({
      neighbours: s.neighbours.length,
      found: s.neighbours.filter((n) => n.found).length,
      standing: s.neighbours.reduce((a, n) => a + n.standing, 0),
      grudges: s.grudges.length,
      lore: s.lore.length,
    }),
  },
  {
    id: 'steading',
    blurb: 'The settlement and anyone out from it. Stage 4 — colony, expeditions.',
    of: (s) => ({ settlement: s.settlement, expedition: s.expedition, jarl: s.jarl }),
    samples: (s) => ({
      settled: s.settlement ? 1 : 0,
      foundedOn: s.settlement?.foundedOn ?? -1,
      built: s.settlement?.built.length ?? 0,
      queued: s.settlement?.queue.length ?? 0,
      out: s.expedition?.members.length ?? 0,
    }),
  },
  {
    id: 'field',
    blurb: 'A fight in progress, if one is. Stage 5 — battle.',
    of: (s) => ({ battle: s.battle, aftermath: s.aftermath }),
    samples: (s) => ({
      fighting: s.battle ? 1 : 0,
      round: s.battle?.round ?? -1,
      combatants: s.battle?.combatants.length ?? 0,
      standing: s.battle?.combatants.filter((c) => !c.down && !c.fled).length ?? 0,
    }),
  },
  {
    id: 'run',
    blurb: 'The bookkeeping the rest of it is scored on. Stage 6 — tally, flags, ending.',
    // `beats` is deliberately absent: it is a presentation stream, emitted
    // and never read, and it is CAPPED — so two implementations that agree
    // about the game can hold different windows of it and still be right.
    // `saga` is absent for the reason `stateHash` gives: prose gets reworded.
    of: (s) => ({
      day: s.day, version: s.version, seed: s.seed, hardship: s.hardship,
      flags: s.flags, tally: s.tally, end: s.end, modes: s.modes,
      nextId: s.nextId, chasing: s.chasing, event: s.event,
    }),
    samples: (s) => ({
      day: s.day,
      ended: s.end?.cause ?? '-',
      mode: s.modes[s.modes.length - 1] ?? '-',
      flags: Object.keys(s.flags).length,
      battles: s.tally.battles,
    }),
  },
];

export interface FacetReading {
  hash: string;
  /** Characters of canonical form — shape mismatch, told apart from value mismatch. */
  size: number;
  samples: Record<string, number | string>;
}

export function readFacet(state: GameState, facet: Facet): FacetReading {
  const value = facet.of(state);
  return { hash: hashOf(value), size: canonical(value).length, samples: facet.samples(state) };
}

export function readAll(state: GameState): Record<string, FacetReading> {
  const out: Record<string, FacetReading> = {};
  for (const facet of FACETS) out[facet.id] = readFacet(state, facet);
  return out;
}

/**
 * Every field of GameState, and the facet that owns it.
 *
 * The partition claim above is only worth anything if something checks it,
 * and `test/parity.test.ts` does: it walks a real state's own keys and fails
 * on any that no facet covers. Add a field to GameState without deciding
 * where it belongs and the parity harness says so, rather than quietly
 * declining to check it — which is exactly the failure the reach probes have
 * turned up three times in other clothes.
 */
export const NOT_IN_ANY_FACET = ['saga', 'beats'] as const;

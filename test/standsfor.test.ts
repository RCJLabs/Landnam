// One question about what is standing, asked one way.
//
// THE BUG THIS EXISTS TO PREVENT, and it shipped. `buildBlocker` checked a
// building's `after` list with `home.built.includes(id)`, and an upgrade
// REMOVES what it replaces — so the moment earthworks went up, the palisade
// left `built` and the watchtower (`after: ['palisade']`) became unbuildable
// for the rest of the run. Nothing caught it, because every bot policy in the
// harness happens to want the watchtower before the earthworks. A player who
// built in the other order silently lost a building.
//
// It was found sideways, in 9.11, when a NEW building gated on the hof
// measured "never raised in sixty sagas" — and the cause turned out not to be
// its cost.
//
// `data/buildings.ts` has stated the rule in its `replaces` docstring for a
// long time: "Everything that asks 'is there a palisade here?' must ask
// `standsFor`". A rule stated in a comment is a suggestion. This is the file
// that makes it a rule, in the same spirit as test/palette.test.ts — which is
// what stops a renderer respelling a shared colour.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { settled } from './fixtures/settle';
import { buildBlocker, hasBuilt, standsFor } from '../src/sim/colony';
import { buildingById } from '../src/data/buildings';

/** Every .ts under src/, path included, so a failure names the file. */
function sources(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(path));
    else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Source with `//` and `/* *\/` comments removed — a rule about CODE. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
}

describe('asking what stands', () => {
  /**
   * The two sanctioned places. `colony.ts` is where `hasBuilt` and
   * `standsFor` are DEFINED, so it necessarily touches `built` directly; and
   * `buildBlocker`'s `replaces` check is deliberately `built.includes`,
   * because an upgrade needs its immediate predecessor physically standing
   * rather than a role filled by something further up the chain.
   */
  const ALLOWED = new Set(['src/sim/colony.ts']);

  it('never asks `built.includes` outside the file that defines the question', () => {
    const offenders = sources()
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /\.built\.includes\(|\bbuilt\.includes\(/.test(code(f)));
    expect(
      offenders,
      `${offenders.join(', ')} asks what is standing with built.includes. An `
      + 'upgrade removes what it replaces, so that is false for a role a tier '
      + 'is filling — use standsFor, or hasBuilt if the EXACT building matters.',
    ).toEqual([]);
  });

  it('is not vacuous — the pattern it bans is one this repo can express', () => {
    // A lint whose regex never matches anything is a lint that passes because
    // it is broken. The defining file must still trip it.
    const inColony = /built\.includes\(/.test(code('src/sim/colony.ts'));
    expect(inColony, 'the pattern no longer occurs anywhere — is the regex stale?')
      .toBe(true);
  });
});

describe('standsFor and hasBuilt answer different questions', () => {
  it('a great hall IS a longhouse, and is not the longhouse', () => {
    const state = settled('stands-tier');
    state.settlement!.built.push('longhouse');
    expect(standsFor(state, 'longhouse')).toBe(true);
    expect(hasBuilt(state, 'longhouse')).toBe(true);

    // Upgrade: the longhouse comes down as the great hall goes up.
    state.settlement!.built = state.settlement!.built.filter((b) => b !== 'longhouse');
    state.settlement!.built.push('greathall');
    expect(standsFor(state, 'longhouse'), 'the role went away with the building').toBe(true);
    expect(hasBuilt(state, 'longhouse'), 'the exact building is gone, and should read gone').toBe(false);
  });

  it('the watchtower survives its wall being upgraded — the shipped bug', () => {
    const state = settled('stands-watch');
    state.party.firewood = 400;
    state.settlement!.built.push('longhouse', 'palisade');
    expect(buildBlocker(state, buildingById('watchtower')!)).toBeNull();

    // The wall goes up a tier. `built` no longer contains 'palisade'.
    state.settlement!.built = state.settlement!.built.filter((b) => b !== 'palisade');
    state.settlement!.built.push('earthworks');
    expect(state.settlement!.built).not.toContain('palisade');
    expect(
      buildBlocker(state, buildingById('watchtower')!),
      'upgrading the wall took the watchtower away again',
    ).toBeNull();
  });

  it('still refuses a prerequisite that was never raised in any form', () => {
    // The fix must not become a hole: nothing replaces the mead hall, so the
    // hof has no back door.
    const bare = settled('stands-refuse');
    bare.party.firewood = 400;
    bare.settlement!.built.push('longhouse');
    expect(buildBlocker(bare, buildingById('hof')!)).toBe('after');
  });

  it('knows nothing stands when there is no steading at all', () => {
    expect(standsFor(newGame('stands-none'), 'longhouse')).toBe(false);
    expect(hasBuilt(newGame('stands-none'), 'longhouse')).toBe(false);
  });
});

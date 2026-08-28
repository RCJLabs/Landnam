// A coast with somebody else's dead steading on it.
//
// The zero-network constraint is the whole point: no server, no account, no
// request. A challenge code is a line of text that goes through a chat app
// and gets retyped with a thumb, and this is that line carrying one more
// thing. So the two properties worth guarding are the ones that make it
// survivable text rather than a protocol:
//
//   - a mangled ghost costs the RUIN and never the coast;
//   - and a haunted coast is not an easier coast, or the code is worth more
//     than the seed it was cut from and every shared run is softer than the
//     one being bragged about.

import { describe, expect, it } from 'vitest';
import { ROUTE_STOPS, onRoute } from '../src/sim/route';
import { standOn } from './fixtures/stand';
import { newGame } from '../src/state/create';
import { settled as settleSomewhere } from './fixtures/settle';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import {
  decodeChallenge,
  encodeChallenge,
  challengeOf,
  ghostOf,
} from '../src/sim/challenge';
import {
  GHOST_RUIN_ID,
  ghostLine,
  haunt,
  theRuin,
} from '../src/sim/haunt';
import { PLACE_KINDS, placeKind } from '../src/data/places';
import { settlePlace } from '../src/sim/places';
import type { GameState, Ghost } from '../src/state/types';

const GHOST: Ghost = { name: 'Eikstead', day: 128, cause: 'starved' };

describe('the code carries a steading and survives being retyped', () => {
  it('round-trips a ghost through the text', () => {
    const code = encodeChallenge({ seed: 'raven-skerry-317', hardship: 'fair', ghost: GHOST });
    const back = decodeChallenge(code);
    expect(back?.ghost).toEqual(GHOST);
    // Still one line of readable text with the seed visible in it, which is
    // the reason this format is not base64.
    expect(code).toContain('raven-skerry-317');
    expect(code.split(/\s+/).length).toBeLessThan(8);
  });

  it('keeps a steading whose name has a space in it', () => {
    const two: Ghost = { ...GHOST, name: 'Two Rivers' };
    const back = decodeChallenge(encodeChallenge({ seed: 's', hardship: 'even', ghost: two }));
    expect(back?.ghost?.name).toBe('Two Rivers');
  });

  it('does not lower the case of a name, because a name is a name', () => {
    const back = decodeChallenge(encodeChallenge({ seed: 's', hardship: 'even', ghost: GHOST }));
    expect(back?.ghost?.name).toBe('Eikstead');
  });

  it('loses the ruin and keeps the coast when the ghost is mangled', () => {
    // THE RULE THE WHOLE FORMAT IS BUILT ON. Every one of these is a thing
    // that happens to a string on its way through a chat app.
    const bad = [
      'LN1 raven-skerry-317 fair g3',
      'LN1 raven-skerry-317 fair g3,-2',
      'LN1 raven-skerry-317 fair g3,-2,Eikstead',
      'LN1 raven-skerry-317 fair gx,y,Eikstead,128,starved',
      'LN1 raven-skerry-317 fair g3,-2,,128,starved',
    ];
    for (const code of bad) {
      const back = decodeChallenge(code);
      expect(back, `${code} cost the player the coast`).toBeTruthy();
      expect(back!.seed, code).toBe('raven-skerry-317');
      expect(back!.hardship, code).toBe('fair');
      expect(back!.ghost, `${code} was read as a ghost anyway`).toBeUndefined();
    }
  });

  it('only offers a ghost from a saga that actually ended', () => {
    // A run still being played has a steading, not a ruin. Sending one would
    // be claiming a death that has not happened — the same reason `coastOf`
    // carries no mark.
    const live = settled('haunt-live');
    expect(ghostOf(live)).toBeUndefined();
    live.end = { cause: 'starved', title: 'x', lines: [] };
    expect(ghostOf(live)?.name).toBe(live.settlement!.name);
    expect(challengeOf(live)).toContain('g');
  });
});

describe('worldgen never grows its own ruin', () => {

  it('marks exactly the ruin as unseeded', () => {
    expect(PLACE_KINDS.filter((k) => k.seeded === false).map((k) => k.id)).toEqual(['ruin']);
  });
});

describe('the haunting itself', () => {
  it('stands the ruin on the ground the ghost named', () => {
    const state = structuredClone(newGame('haunt-place'));
    // A DIFFERENT CLAIM, because on a line there is no ground the ghost
    // named. `ghostOf` cuts the ghost from `settlement.at`, and on a coast
    // that field is the frozen landing hex — every coast ghost carries the
    // same meaningless pair. So what is owed here is that the ruin lands
    // somewhere a band can actually walk to, which is the thing that was
    // broken: it used to be pushed with no `stop` at all, so `placeHere`
    // could never match it and a haunted coast had a grave nobody could
    // reach.
    expect(haunt(state, GHOST)).toBe(true);
    const ruin = theRuin(state)!;
    expect(ruin.stop, 'the ruin is not on the coast').not.toBeUndefined();
    expect(ruin.stop, 'the ruin is on the landing beach').toBeGreaterThan(0);
    expect(onRoute(ruin.stop!), 'the ruin is off the end of the route').toBe(true);
    // And the same code puts it in the same place for everybody.
    const twin = structuredClone(newGame('haunt-place'));
    expect(haunt(twin, GHOST)).toBe(true);
    expect(theRuin(twin)!.stop).toBe(ruin.stop);
    expect(ghostLine(state)).toContain('Eikstead');
  });


  it('gives up quietly rather than throwing when nothing will hold it', () => {
    const state = structuredClone(newGame('haunt-nowhere'));
    // A hex off the end of the map is not a way to say "nowhere" on a line
    // — the stop search ignores the ghost's hex entirely. So the coast's
    // version of nowhere is a route with every stretch already spoken for.
    for (let stop = 1; stop < ROUTE_STOPS; stop += 1) {
      state.world.places.push({ id: `pl_full_${stop}`, kind: 'town', stop });
    }
    expect(() => haunt(state, GHOST)).not.toThrow();
    expect(theRuin(state), 'a full coast still took a ruin').toBeUndefined();
  });

});

describe('a haunted coast is not an easier coast', () => {
  /**
   * The property that keeps a challenge worth what it claims.
   *
   * If the ruin were a windfall, a code would be worth more than the seed it
   * was cut from, and every shared run would be softer than the one being
   * bragged about. So it is small, it is mostly TIMBER — what survives an
   * abandoned steading is the woodpile, not the larder, because the larder is
   * what ran out — and it is worth less than anything the country grows.
   */
  it('never out-pays the salvage it most resembles, and is mostly wood', () => {
    // Measured against the WRECK rather than against every kind, and the
    // first cut of this bar got that wrong: it demanded the ruin be the
    // poorest thing on the coast, which cannot be true because the oreseam
    // pays nothing in goods at all — it pays in lore. Comparing goods totals
    // across kinds that trade in different currencies is not a comparison.
    // The wreck is the right comparator: both are an unowned thing taken
    // apart in a day, with no garrison and nobody to anger.
    const ruin = placeKind('ruin');
    const worth = (id: string) => {
      const k = placeKind(id as 'wreck');
      return k.loot.food + k.loot.firewood;
    };
    expect(worth('ruin'), 'the ruin out-pays the wreck').toBeLessThan(worth('wreck'));
    expect(placeKind('wreck').garrison, 'the wreck stopped being the right comparator').toBeNull();
    expect(ruin.loot.firewood).toBeGreaterThan(ruin.loot.food);
    // And nobody is angered by going through a dead steading.
    expect(ruin.infamy).toBe(0);
    expect(ruin.garrison).toBeNull();
  });
});

describe('old saves', () => {
  it('come forward unhaunted, which is what they were', () => {
    const save = structuredClone(newGame('haunt-old')) as unknown as Record<string, unknown>;
    save['version'] = 33;
    delete save['ghost'];
    const out = migrate(save).save;
    expect(out['version']).toBe(SAVE_VERSION);
    expect(out['ghost']).toBeUndefined();
  });
});

function settled(seed: string): GameState {
  // The site search is shared now — see test/fixtures/settle.ts.
  const state = settleSomewhere(seed);
  return state;
}

// --- Audit #8: the coast remembering the ghost ---
//
// Measured first, because the obvious guess was wrong. The fear was that a
// band never walks onto the ruin at all — the place economy has taught this
// repo that lesson twice. It does not hold: across 30 haunted settler sagas
// the bot found and TOOK the dead steading 17 times, and stood in it 78.
//
// What it never did once, in 17 takings, was record whose it was. The name
// reaches the permanent log exactly once, on day one, in a rumour written
// before anybody has seen the place — "Nobody said where it was" — and the
// taking itself closes the loop anonymously. Stand in the ruin and the panel
// names them; take it and the coast forgets them for the rest of the run.
describe('the coast remembers whose steading it was', () => {
  /** A world with the ruin standing, and the band on top of it. */
  function haunted(seed: string): { state: GameState; ruinId: string } {
    const state = structuredClone(newGame(seed));
    // `hauntedStop` finds the stretch itself, derived from the ghost's own
    // name, day and cause — the hex fixture that stood here searched the
    // island for ground the kind would take, which a line has no need of.
    expect(haunt(state, GHOST), 'no stretch of this coast holds a ruin').toBe(true);
    const ruin = theRuin(state)!;
    standOn(state, ruin);
    return { state, ruinId: ruin.id };
  }

  it('names them in the saga when the band takes the ruin', () => {
    const { state, ruinId } = haunted('ghost-taking');
    const before = state.saga.length;
    settlePlace(state, ruinId);
    const written = state.saga.slice(before).map((e) => e.text).join(' ');
    // The generic line still says what was carried off.
    expect(written).toContain('stacked against a winter');
    // And the record now says whose winter it was.
    expect(written, 'the taking never named the ghost').toContain('Eikstead');
    expect(written, 'the taking never said what finished them').toContain('ran out of food');
  });

  it('is written once, not on every later day', () => {
    // A saga line is permanent; a band that camps in the ruin for a week must
    // not get the same sentence seven times.
    const { state, ruinId } = haunted('ghost-once');
    settlePlace(state, ruinId);
    settlePlace(state, ruinId);
    const named = state.saga.filter((e) => e.text.includes('Eikstead')
      && !e.text.includes('Nobody said where it was'));
    expect(named).toHaveLength(1);
  });

  it('still knows whose it was after the ruin has been taken', () => {
    // The panel reads `ghostLine`, and this is the half of that guarantee a
    // node-environment suite can hold: the fact survives the sacking. The
    // renderer's own half — that the SACKED branch prints it, which it did
    // not — is structural now: `whose` is appended outside the branch, so no
    // arm of it can drop the name. This repo runs no DOM tests by design;
    // the render layer is checked in a real browser instead.
    const { state, ruinId } = haunted('ghost-panel');
    settlePlace(state, ruinId);
    expect(theRuin(state)?.sackedOn).toBeDefined();
    expect(ghostLine(state), 'the ruin forgot whose it was once taken').toContain('Eikstead');
  });

  it("never puts the ghost's name on a ruin that is not theirs", () => {
    // `abandonSteading` leaves a ruin behind too — the band's OWN hall, under
    // `ruin:<stop>`. Keying the name off the KIND meant a band that walked
    // out and later stood on its own posts was told a stranger had died
    // there. Nothing caught it because the balance bot never walks out.
    const { state } = haunted('ghost-own');
    const own = state.party.stop ?? 0;
    // Unshifted, so a find-by-kind would pick this one first.
    state.world.places.unshift({ id: `ruin:${own}`, kind: 'ruin', stop: own });
    expect(theRuin(state)?.id).toBe(GHOST_RUIN_ID);
    const before = state.saga.length;
    settlePlace(state, `ruin:${own}`);
    const written = state.saga.slice(before).map((e) => e.text).join(' ');
    expect(written, "a stranger's name on the band's own posts").not.toContain('So this was');
    expect(written).not.toContain(GHOST.name);
  });

  it('says nothing extra when the ruin is not a ghost of anyone', () => {
    // Defensive: a ruin with no ghost on the state must not produce a line
    // with an empty name in it.
    const { state, ruinId } = haunted('ghost-absent');
    delete state.ghost;
    const before = state.saga.length;
    settlePlace(state, ruinId);
    const written = state.saga.slice(before).map((e) => e.text).join(' ');
    expect(written).toContain('stacked against a winter');
    expect(written).not.toContain('undefined');
    expect(written).not.toContain('  ');
  });
});

// 12.16: the other landnám can be answered.
//
// He was a man you could see and not speak to. `PROBE 12.11` (2026-09-07) put
// the figure on it: met in a third of sagas, and no verb in the whole `Action`
// union named him — his one reader in `src/` was `foundBlocker`, saying no.
//
// THIS IS NOT 12.11, WHICH WAS CLOSED. That item wanted hands for him because
// he was thought to cost more than he gives, and the re-take measured that
// away: 3% of sagas, 0 saved and 3 killed of 120 paired. Nothing here is
// meant to reduce a cost, and nothing here simulates a colony behind him —
// the 2026-08-26 decision stands. He is still a name, a hall, and the ground
// he has taken; what is new is that he has an opinion.
//
// Asserted through `apply` wherever the claim is about the VERB, because a
// test that calls `speakToRival` directly would pass on a build where nothing
// dispatches it — the exact fault `PROBE 12.12` exists about.

import { describe, expect, it } from 'vitest';
import { apply } from '../src/sim/actions';
import { migrate } from '../src/state/migrations';
import { SAVE_VERSION } from '../src/state/version';
import { newGame } from '../src/state/create';
import {
  GUEST_GIFT,
  RIVAL_OPENING,
  RIVAL_SETTLES,
  RIVAL_YIELDS,
  SPEAK_EVERY,
  rivalHere,
  rivalStanding,
  shiftRivalStanding,
  speakBlocker,
  speakBlurb,
  speakOdds,
} from '../src/sim/rival';
import { deedsFor } from '../src/render/deeds';
import type { GameState } from '../src/state/types';

/**
 * A band standing in sight of his hall, with something to carry in.
 *
 * Built off `newGame` rather than a literal so the rival is the one the seed
 * really makes — a hand-written rival would be a fixture asserting about
 * itself, which is trap 1 in CLAUDE.md.
 */
function atHisDoor(seed = 'speak'): GameState {
  for (let i = 0; i < 40; i += 1) {
    const state = structuredClone(newGame(`${seed}-${i}`));
    const rival = state.rival;
    if (!rival || rival.stop === undefined) continue;
    state.day = RIVAL_SETTLES + 30;
    state.party.stop = rival.stop;
    state.party.food = 60;
    rival.met = true;
    return state;
  }
  throw new Error('forty seeds and no rival with a hall on any of them');
}

describe('his hall can be walked up to', () => {
  it('is offered on the sheet, and goes through apply', () => {
    const state = atHisDoor();
    expect(rivalHere(state)).toBe(true);
    expect(speakBlocker(state)).toBeNull();

    // ON THE DEEDS SHEET. `PROBE 12.12`'s rule: a verb the interface cannot
    // reach is a verb the player does not have.
    const deed = deedsFor(state, () => {}, () => {}, () => {}).find((d) => d.id === 'speak-rival');
    expect(deed, 'his hall is in sight and the sheet does not offer it').toBeDefined();
    expect(deed!.blocked, 'offered greyed with nothing blocking it').toBeUndefined();
    expect(deed!.label).toContain(state.rival!.hall);

    const after = apply(state, { type: 'SPEAK_RIVAL' });
    expect(after, 'the verb did nothing at his own door').not.toBe(state);
    expect(after.day, 'the walk cost no day').toBeGreaterThan(state.day);
    // THE GIFT, MEASURED AGAINST A DAY THAT WAS NOT SPENT ON HIM. The day
    // itself costs food — the band eats whatever it does — so a bare
    // subtraction here would be asserting the upkeep as well and would move
    // the moment either number did.
    const camped = apply(state, { type: 'CAMP' });
    expect(camped.day).toBe(after.day);
    expect(camped.party.food - after.party.food).toBe(GUEST_GIFT);
  });

  it('is refused from anywhere else, with the reason on the button', () => {
    const state = atHisDoor('elsewhere');
    state.party.stop = (state.rival!.stop! + 6) % 26;
    expect(rivalHere(state)).toBe(false);
    expect(speakBlocker(state)).toBe('nowhere');
    expect(apply(state, { type: 'SPEAK_RIVAL' }), 'he was spoken to from six stretches away')
      .toBe(state);
    expect(deedsFor(state, () => {}, () => {}, () => {}).some((d) => d.id === 'speak-rival')).toBe(false);
  });

  it('costs the gift whether he hears us or not', () => {
    // The Thing's feast rule, and for the same reason: an ask that is free
    // when it fails is a reroll rather than a decision. Both outcomes are
    // reached by walking seeds rather than by forcing the roll, so this is
    // about the rule and not about a die somebody held.
    let heard = 0;
    let turned = 0;
    for (let i = 0; i < 24; i += 1) {
      const state = atHisDoor(`gift-${i}`);
      const after = apply(state, { type: 'SPEAK_RIVAL' });
      const camped = apply(state, { type: 'CAMP' });
      expect(camped.party.food - after.party.food, 'the gift was not carried in')
        .toBe(GUEST_GIFT);
      if (rivalStanding(after) > rivalStanding(state)) heard += 1;
      else turned += 1;
    }
    expect(heard, 'he never once heard anybody out').toBeGreaterThan(0);
    expect(turned, 'he never once turned anybody away, so the roll does nothing')
      .toBeGreaterThan(0);
  });

  it('will not be visited daily', () => {
    const state = atHisDoor('cooldown');
    const once = apply(state, { type: 'SPEAK_RIVAL' });
    expect(speakBlocker(once)).toBe('soon');
    expect(apply(once, { type: 'SPEAK_RIVAL' }), 'he was pestered the next day')
      .toBe(once);
    // And he does hear us again once it has been long enough.
    const later = { ...once, day: once.day + SPEAK_EVERY };
    expect(speakBlocker(later)).toBeNull();
  });

  it('will not be visited empty-handed', () => {
    const state = atHisDoor('empty');
    state.party.food = GUEST_GIFT - 1;
    expect(speakBlocker(state)).toBe('stores');
    expect(apply(state, { type: 'SPEAK_RIVAL' })).toBe(state);
  });

  it('says what it will cost and what the odds are, before it is tapped', () => {
    const state = atHisDoor('blurb');
    const said = speakBlurb(state);
    expect(said).toContain(`${Math.round(speakOdds(state) * 100)}%`);
    expect(said).toContain(String(GUEST_GIFT));
    expect(said).toMatch(/costs a day/);
  });
});

describe('his opinion is on the same scale as everybody else’s', () => {
  it('starts where a Norse neighbour starts', () => {
    const state = atHisDoor('opening');
    expect(rivalStanding(state)).toBe(RIVAL_OPENING);
  });

  it('clamps the way a neighbour’s does', () => {
    const state = atHisDoor('clamp');
    shiftRivalStanding(state, 500);
    expect(rivalStanding(state)).toBe(100);
    shiftRivalStanding(state, -500);
    expect(rivalStanding(state)).toBe(-100);
  });
});

describe('the fence can open, and only that far', () => {
  it('gives back the stretch nearest our hall once he thinks well enough of us', () => {
    const state = atHisDoor('yield');
    const rival = state.rival!;
    // Ground he holds beyond his own hall's stretch, which is the only kind
    // he will ever give up.
    const spare = (rival.stop! + 2) % 26;
    rival.claimStops = [rival.stop!, spare];
    rival.standing = RIVAL_YIELDS - 1;
    // NO SETTLEMENT AND NO MOVING THE BAND, and both were wrong first.
    //
    // Spreading `{stop}` onto whatever `state.settlement` was — undefined for
    // a band that has not founded — gave `passDay` a settlement with no
    // `built` array to walk into. Standing the band on `spare` instead broke
    // it the other way: `rivalHere` wants his hall within one stretch, spare
    // is two, so every visit was refused and the test reported that he never
    // gives ground back. `yieldNearest` falls back to the ground underfoot
    // when there is no hall, and `spare` is the only claim that is not his
    // own — so staying at his door asks exactly the right question.

    // Walk him up over the threshold by speaking until he hears us.
    //
    // STORES ENOUGH TO SURVIVE THE WALKING. The first cut left the band on
    // sixty of food and jumped the calendar twelve times: the band starved,
    // `apply` began refusing everything, and the test reported that he never
    // gives ground back. A fixture that runs out of food is measuring the
    // larder.
    let now = { ...state, party: { ...state.party, food: 4000 } };
    for (let i = 0; i < 12 && (now.rival!.claimStops ?? []).includes(spare); i += 1) {
      now = apply({ ...now, day: now.day + SPEAK_EVERY }, { type: 'SPEAK_RIVAL' });
      expect(now.end, 'the band died partway through, so this measures the larder')
        .toBeUndefined();
    }
    expect(rivalStanding(now)).toBeGreaterThanOrEqual(RIVAL_YIELDS);
    expect(now.rival!.claimStops, 'he never gave the fenced ground back')
      .not.toContain(spare);
    // AND NEVER HIS OWN. Taking the ground his posts are in would be the
    // second colony this deliberately is not.
    expect(now.rival!.claimStops).toContain(rival.stop!);
    expect(now.saga.some((e) => e.text.includes('took his fence off it'))).toBe(true);
  });

  it('gives nothing back while he holds only his own hall', () => {
    const state = atHisDoor('onlyhall');
    const rival = state.rival!;
    rival.claimStops = [rival.stop!];
    rival.standing = 90;
    const after = apply(state, { type: 'SPEAK_RIVAL' });
    expect(after.rival!.claimStops).toEqual([rival.stop!]);
  });
});

describe('a save from before he could be spoken to', () => {
  it('comes back with him at the clan opening', () => {
    const state = atHisDoor('oldsave');
    const old = JSON.parse(JSON.stringify(state));
    old.version = 66;
    delete old.rival.standing;

    const now = migrate(old).save as unknown as GameState;
    expect(now.version).toBe(SAVE_VERSION);
    expect(now.rival!.standing, 'an old save came back with no opinion written in it')
      .toBe(RIVAL_OPENING);
  });

  it('passes a coast with no rival on it straight through', () => {
    const state = atHisDoor('norival');
    const old = JSON.parse(JSON.stringify(state));
    old.version = 66;
    delete old.rival;
    const now = migrate(old).save as unknown as GameState;
    expect(now.version).toBe(SAVE_VERSION);
    expect(now.rival).toBeUndefined();
  });
});

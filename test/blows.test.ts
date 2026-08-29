// Blows that land somewhere.
//
// Every blow used to land in exactly the same place — the centre of the
// figure, because that is where `spotOf` answers and nothing asked for
// anywhere else. A flash there and a number over it is a HIT REPORTED, not a
// blow struck, and that is the whole of what this item was about.
//
// The sim does not say where a blow landed and must not start: beats live in
// the save and in the parity vectors, so a field for decoration would cost a
// save bump and a port change for something no rule reads. It is derived in
// `render/fx.ts` instead, seeded off the beat, which is what these hold.

import { describe, expect, it } from 'vitest';
import { blowKick, blowLanding, placeOffset, type BlowPlace } from '../src/render/fx';
import { FIGURE_R, RANK_GAP } from '../src/render/line';
import type { BlowBeat, BlowResult } from '../src/sim/beats';

function blow(n: number, result: BlowResult = 'hit', damage = 3): BlowBeat {
  return {
    n, round: 1, kind: 'struck', who: 'p1', target: 'p2', result, damage,
  } as BlowBeat;
}

describe('a blow lands in a place, and the same place on a replay', () => {
  it('gives one beat the same answer every time it is asked', () => {
    for (let n = 1; n <= 40; n += 1) {
      const once = blowLanding(blow(n));
      for (let again = 0; again < 3; again += 1) {
        expect(blowLanding(blow(n))).toBe(once);
      }
    }
  });

  it('does not put every blow in the same place', () => {
    const seen = new Set<BlowPlace>();
    for (let n = 1; n <= 60; n += 1) seen.add(blowLanding(blow(n)));
    expect([...seen].sort()).toEqual(['body', 'head', 'leg']);
  });

  it('tells one blow from another, so a round is not a drumbeat', () => {
    // Two different beats must be able to disagree; a derivation keyed on
    // something constant would pass everything above and still land every
    // blow of a fight in the same spot.
    const places = Array.from({ length: 30 }, (_, i) => blowLanding(blow(i + 1)));
    expect(new Set(places).size).toBeGreaterThan(1);
  });

  it('sends a glance to the edges of a man and a clean hit to his middle', () => {
    // A glance is a blow that did not land square — it caught a helm or a
    // shin. Measured over 400 beats rather than asserted on one.
    const share = (result: BlowResult) => {
      let body = 0;
      for (let n = 1; n <= 400; n += 1) if (blowLanding(blow(n, result)) === 'body') body += 1;
      return body / 400;
    };
    const clean = share('hit');
    const glance = share('glance');
    expect(clean, `clean hits found the body ${(clean * 100).toFixed(0)}% of the time`)
      .toBeGreaterThan(0.4);
    expect(glance, `glances found the body ${(glance * 100).toFixed(0)}% of the time`)
      .toBeLessThan(0.2);
    expect(clean).toBeGreaterThan(glance);
  });
});

describe('where that is on the body', () => {
  it('puts the head above the chest and the leg below it', () => {
    const r = 20;
    expect(placeOffset('head', r)).toBeLessThan(0);
    expect(placeOffset('body', r)).toBe(0);
    expect(placeOffset('leg', r)).toBeGreaterThan(0);
  });

  it('keeps every landing on the man rather than beside him', () => {
    const r = 20;
    for (const place of ['head', 'body', 'leg'] as const) {
      expect(Math.abs(placeOffset(place, r))).toBeLessThan(r);
    }
  });
});

describe('the man takes it, and harder for a heavier blow', () => {
  it('shoves further the more the blow took', () => {
    expect(blowKick(6)).toBeGreaterThan(blowKick(1));
    expect(blowKick(1)).toBeGreaterThan(0);
  });

  it('never punts anybody off the line', () => {
    // Damage is a small integer today, but a balance change is exactly the
    // kind of thing that would send a man across the field for free.
    //
    // Measured against the MAN, not against a number I guessed: the first
    // cut of this asserted `< 12` world units, which was a figure picked out
    // of the air and failed at 13.7. What has to hold is that a blow jolts
    // him rather than moving him — well under his own width, and nowhere
    // near the gap to the next rank, or the line stops being a line.
    for (const damage of [1, 4, 12, 40, 400]) {
      const kick = blowKick(damage);
      expect(kick, `${damage} damage shoves ${kick.toFixed(1)}`)
        .toBeLessThan(FIGURE_R * 0.75);
      expect(kick).toBeLessThan(RANK_GAP * 0.2);
    }
  });

  it('flattens out, so the difference between blows beats their size', () => {
    // Past a point a bigger number should not keep buying more shove: what
    // a player reads is one blow against another, not the absolute figure.
    expect(blowKick(40) - blowKick(12)).toBeLessThan(blowKick(4) - blowKick(1));
  });
});

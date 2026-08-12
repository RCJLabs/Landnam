// Seed challenges: a saga somebody else can play.
//
// The format is a line of text rather than an encoded blob, and these tests
// are mostly about why. A code gets pasted into a chat, wrapped by an email
// client, read out over a table and retyped with a thumb — so what is tested
// here is chiefly what it survives, and what it correctly refuses to guess
// at.

import { describe, it, expect } from 'vitest';
import {
  beats,
  challengeOf,
  coastOf,
  decodeChallenge,
  describeMark,
  encodeChallenge,
  markOf,
  type Mark,
} from '../src/sim/challenge';
import { newGame } from '../src/state/create';

describe('the code', () => {
  it('reads as itself, seed and all', () => {
    // A player can see their own seed in it, which a base64 blob would take
    // away for nothing.
    const code = encodeChallenge({ seed: 'raven-skerry-317', hardship: 'even' });
    expect(code).toBe('LN1 raven-skerry-317 even');
    expect(code).toContain('raven-skerry-317');
  });

  it('carries a mark when there is one', () => {
    const code = encodeChallenge({
      seed: 'grim-fjord-100',
      hardship: 'fair',
      mark: { day: 128, winters: 2, jarl: true },
    });
    expect(code).toBe('LN1 grim-fjord-100 fair d128 w2 jarl');
  });

  it('round-trips', () => {
    const cases = [
      { seed: 'raven-skerry-317', hardship: 'even' as const },
      { seed: 'a', hardship: 'hard' as const, mark: { day: 7, winters: 0 } },
      { seed: 'Þórr-ríki', hardship: 'fair' as const, mark: { day: 400, winters: 5, jarl: true } },
      { seed: '', hardship: 'even' as const },
      { seed: 'two words', hardship: 'even' as const },
    ];
    for (const c of cases) {
      expect(decodeChallenge(encodeChallenge(c)), c.seed).toEqual(c);
    }
  });
});

describe('what a code survives', () => {
  const code = 'LN1 grim-fjord-100 fair d128 w2 jarl';

  it('whitespace a chat app added', () => {
    expect(decodeChallenge(`   ${code}\n`)).toEqual(decodeChallenge(code));
    expect(decodeChallenge(code.replace(/ /g, '   '))).toEqual(decodeChallenge(code));
    // Wrapped across lines by an email client.
    expect(decodeChallenge('LN1 grim-fjord-100\nfair d128 w2 jarl')).toEqual(decodeChallenge(code));
  });

  it('a shouted prefix and shouted terms', () => {
    expect(decodeChallenge('ln1 grim-fjord-100 FAIR D128 W2 JARL'))
      .toEqual(decodeChallenge(code));
  });

  it('but NOT a shouted seed, and that is not fixable', () => {
    // `hashString` walks code units, so `Grim` and `grim` are different
    // worlds — a decoder that lowercased the seed to be helpful would land
    // players who typed a capital somewhere else entirely. The seed comes
    // back exactly as it was written.
    //
    // Which makes this a real hazard on the platform this game is played
    // on: a phone keyboard autocapitalises the first word of a pasted line.
    // The answer is not here, it is on the input — the seed box carries
    // autocapitalize/autocorrect/spellcheck off for exactly this reason.
    expect(decodeChallenge('LN1 Grim-Fjord-100 fair')?.seed).toBe('Grim-Fjord-100');
    expect(decodeChallenge('LN1 grim-fjord-100 fair')?.seed).toBe('grim-fjord-100');
  });

  it('losing its tail', () => {
    // The whole reason for a readable format: a truncated code still lands
    // you on the right coast, which is most of what it was for.
    const cut = decodeChallenge('LN1 grim-fjord-100 fair d128');
    expect(cut?.seed).toBe('grim-fjord-100');
    expect(cut?.mark).toEqual({ day: 128, winters: 0 });

    const bare = decodeChallenge('LN1 grim-fjord-100 fair');
    expect(bare?.seed).toBe('grim-fjord-100');
    expect(bare?.mark).toBeUndefined();
  });

  it('a difficulty from a build that does not have it', () => {
    // Landing on the right coast on the wrong terms beats not landing.
    const odd = decodeChallenge('LN1 grim-fjord-100 brutal d40');
    expect(odd?.seed).toBe('grim-fjord-100');
    expect(odd?.hardship).toBe('even');
  });
});

describe('what a code refuses to be', () => {
  it('is not an ordinary seed', () => {
    // The important refusal. Somebody typing their own seed into the box
    // must not have it read as a mangled challenge.
    expect(decodeChallenge('raven-skerry-317')).toBeNull();
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('   ')).toBeNull();
    expect(decodeChallenge('my great saga')).toBeNull();
  });

  it('is not a prefix on its own', () => {
    expect(decodeChallenge('LN1')).toBeNull();
  });

  it('ignores tokens it does not know rather than failing on them', () => {
    const c = decodeChallenge('LN1 seedy even d10 w1 sparkles ???');
    expect(c?.mark).toEqual({ day: 10, winters: 1 });
  });
});

describe('the world stamp', () => {
  it('travels when it is given, and is optional', () => {
    const withStamp = decodeChallenge('LN1 s even d10 w0 #688411ba');
    expect(withStamp?.world).toBe('688411ba');
    expect(decodeChallenge('LN1 s even d10 w0')?.world).toBeUndefined();
  });

  it('comes off a real run, truncated to eight', () => {
    const state = structuredClone(newGame('raven-skerry-317'));
    const code = challengeOf(state, '688411ba38a7cea1');
    expect(code).toContain('#688411ba');
    expect(decodeChallenge(code)?.world).toBe('688411ba');
  });
});

describe('beating a mark', () => {
  const day100: Mark = { day: 100, winters: 1 };

  it('is more days', () => {
    expect(beats({ day: 101, winters: 1 }, day100)).toBe(true);
    expect(beats({ day: 99, winters: 1 }, day100)).toBe(false);
  });

  it('is not a tie', () => {
    expect(beats({ day: 100, winters: 1 }, day100)).toBe(false);
  });

  it('puts a jarldom above any number of days', () => {
    // The whole game points at the Thing. A band that ruled did something a
    // band that merely lasted did not.
    expect(beats({ day: 60, winters: 1, jarl: true }, { day: 500, winters: 6 })).toBe(true);
    expect(beats({ day: 500, winters: 6 }, { day: 60, winters: 1, jarl: true })).toBe(false);
    // Between two jarls it is days again.
    expect(beats({ day: 200, winters: 3, jarl: true }, { day: 100, winters: 1, jarl: true })).toBe(true);
  });
});

describe('a mark off a real run', () => {
  it('reads the day and the winters out of the state', () => {
    const state = structuredClone(newGame('mark'));
    state.day = 180;
    expect(markOf(state)).toEqual({ day: 180, winters: 2 });
    state.jarl = { name: 'Ketil', since: 170 };
    expect(markOf(state).jarl).toBe(true);
  });

  it('says itself in words', () => {
    expect(describeMark({ day: 128, winters: 2 })).toBe('day 128, 2 winters stood');
    expect(describeMark({ day: 60, winters: 1 })).toBe('day 60, 1 winter stood');
    expect(describeMark({ day: 300, winters: 4, jarl: true })).toContain('a jarldom taken');
  });

  it('carries the terms the run was actually played under', () => {
    // A shared seed has to mean the same thing to two people, and the terms
    // are half of what it means.
    const state = structuredClone(newGame('terms-carry', 'fair'));
    expect(decodeChallenge(challengeOf(state))?.hardship).toBe('fair');
  });
});

describe('the coast, sent from a run still going', () => {
  /**
   * The code used to exist on the ending screen and nowhere else, so a
   * player who wanted to send a friend the country they were enjoying had
   * to lose first. `coastOf` is the mid-run half, and what it deliberately
   * leaves OUT is the mark.
   */
  it('carries the seed and the terms and nothing to beat', () => {
    const state = structuredClone(newGame('bright-fjord', 'fair'));
    state.day = 40;
    const code = coastOf(state);
    expect(code).toBe('LN1 bright-fjord fair');
    const read = decodeChallenge(code);
    expect(read?.seed).toBe('bright-fjord');
    expect(read?.hardship).toBe('fair');
    // The point of the whole function: mid-run there is nothing yet to
    // beat. "Beat day 40" sent on day 40 is a claim the sender has not
    // earned and may lose on day 41.
    expect(read?.mark).toBeUndefined();
  });

  it('does not move as the run goes on', () => {
    // A coast is a coast. Two players comparing codes a week apart must be
    // able to see they are talking about the same country.
    const state = structuredClone(newGame('steady', 'even'));
    const early = coastOf(state);
    state.day = 300;
    state.jarl = { name: 'Ketil', since: 290 };
    expect(coastOf(state)).toBe(early);
  });

  it('is the finished code with the result taken off', () => {
    const state = structuredClone(newGame('both-halves', 'hard'));
    state.day = 128;
    // The ending screen's code says what the run got to; this one does not.
    expect(challengeOf(state)).toContain('d128');
    expect(coastOf(state)).not.toContain('d128');
    // Same coast underneath, though — seed and terms agree.
    const ended = decodeChallenge(challengeOf(state));
    const live = decodeChallenge(coastOf(state));
    expect(live?.seed).toBe(ended?.seed);
    expect(live?.hardship).toBe(ended?.hardship);
  });

  it('survives a seed with a space in it, like every other code', () => {
    const state = structuredClone(newGame('two words', 'even'));
    expect(decodeChallenge(coastOf(state))?.seed).toBe('two words');
  });
});

// A counter with a calendar.
//
// The game is about surviving a winter, and until now its only market charged
// the same in high summer as in deep frost — a fixed exchange rate rather than
// a decision. `GOOD_WORTH` gives it a year: nobody pays much for grain the
// week after harvest, and everybody pays for it in the frost.
//
// The dangerous half of that is arithmetic, not flavour. A town buys and sells
// the SAME two goods on one hex, so it must lose on the spread or a player can
// stand still and make timber out of nothing. Seasons multiply both directions
// and could have broken that, which is what most of this file is about.

import { describe, expect, it } from 'vitest';
import { newGame } from '../src/state/create';
import { GOOD_WORTH, PLACE_KINDS, placeKind } from '../src/data/places';
import { offerGot } from '../src/sim/places';
import { SEASON_LENGTH, SEASON_ORDER, seasonOf } from '../src/sim/calendar';
import type { PlaceOffer } from '../src/data/places';
import type { Season } from '../src/state/types';

/** A day well inside each season, so nothing lands on a boundary. */
const dayIn = (season: Season): number =>
  SEASON_ORDER.indexOf(season) * SEASON_LENGTH + 12;

const everyOffer = (): { kind: string; offer: PlaceOffer }[] =>
  PLACE_KINDS.flatMap((def) => (def.market ?? []).map((offer) => ({ kind: def.id, offer })));

describe('the seasons reach the counter', () => {
  it('picks the season the day is actually in', () => {
    for (const season of SEASON_ORDER) {
      expect(seasonOf(dayIn(season))).toBe(season);
    }
  });

  it('pays more for what it is short of', () => {
    // The monastery takes firewood and gives bread. In autumn its grain is
    // cheap and the wood you cut in summer is wanted, so that is when to go.
    const bread = placeKind('monastery').market!.find((o) => o.id === 'bread')!;
    const autumn = offerGot(bread, dayIn('autumn'));
    const summer = offerGot(bread, dayIn('summer'));
    const winter = offerGot(bread, dayIn('winter'));
    expect(autumn).toBeGreaterThan(summer);
    // Deep winter: both dear together, so the deal is no better than base.
    expect(winter).toBeLessThan(autumn);
  });

  it('gives the town its own best month, and it is not the same one', () => {
    // Carrying food OUT to buy timber pays best when food is dear and wood is
    // cheap — high summer, the opposite of the monastery's month. Two markets
    // with two calendars is the decision this was built for.
    const buy = placeKind('town').market!.find((o) => o.id === 'buy-timber')!;
    const best = SEASON_ORDER
      .map((s) => ({ s, got: offerGot(buy, dayIn(s)) }))
      .reduce((a, b) => (b.got > a.got ? b : a));
    expect(best.s).toBe('summer');
  });
});

describe('no season makes goods out of nothing', () => {
  /**
   * THE PROPERTY THE WHOLE DESIGN RESTS ON.
   *
   * A town's two offers are reciprocal: food in for timber, timber in for
   * food. Seasons scale a rate by `worth(given) / worth(taken)`, so on a
   * round trip the two ratios are exact reciprocals and cancel — leaving the
   * base spread, in every season. If they did not cancel there would be a
   * month in which standing on one hex and dealing twice made stores.
   */
  it('loses on the town spread in all four seasons', () => {
    const market = placeKind('town').market!;
    const buy = market.find((o) => o.id === 'buy-timber')!;
    const sell = market.find((o) => o.id === 'sell-timber')!;

    for (const season of SEASON_ORDER) {
      const day = dayIn(season);
      // Ten food in, timber out, that timber back in for food.
      const timber = offerGot(buy, day);
      const roundTrips = Math.floor(timber / sell.cost);
      const backAsFood = roundTrips * offerGot(sell, day);
      expect(backAsFood, `${season}: ${buy.cost} food came back as ${backAsFood}`)
        .toBeLessThan(buy.cost);
    }
  });

  it('keeps the raw rate ratio identical in every season', () => {
    // The same property stated on the numbers rather than on one town, so a
    // market added later cannot quietly break it.
    for (const season of SEASON_ORDER) {
      const worth = GOOD_WORTH[season];
      const there = worth.food / worth.firewood;
      const back = worth.firewood / worth.food;
      expect(there * back).toBeCloseTo(1, 12);
    }
  });
});

describe('a price is always a price', () => {
  it('never returns nothing for something', () => {
    for (const { kind, offer } of everyOffer()) {
      for (const season of SEASON_ORDER) {
        const got = offerGot(offer, dayIn(season));
        expect(got, `${kind}/${offer.id} in ${season}`).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(got)).toBe(true);
      }
    }
  });

  it('is worth naming every good the table prices', () => {
    // A good with no seasonal worth would divide by undefined and produce NaN
    // — silently, and only for the offer that used it.
    for (const season of SEASON_ORDER) {
      for (const good of ['food', 'firewood'] as const) {
        expect(GOOD_WORTH[season][good]).toBeGreaterThan(0);
      }
    }
    for (const { offer } of everyOffer()) {
      expect(GOOD_WORTH.summer[offer.give]).toBeGreaterThan(0);
      expect(GOOD_WORTH.summer[offer.take]).toBeGreaterThan(0);
    }
  });

  it('moves enough to be worth waiting for', () => {
    // A seasonal market nobody notices is flavour, not a decision. Every
    // offer has to swing by a fifth across the year or the calendar is
    // decoration.
    for (const { kind, offer } of everyOffer()) {
      const got = SEASON_ORDER.map((s) => offerGot(offer, dayIn(s)));
      const swing = Math.max(...got) / Math.min(...got);
      expect(swing, `${kind}/${offer.id} swings ${swing.toFixed(2)}x`).toBeGreaterThan(1.2);
    }
  });
});

describe('the counter and the button agree', () => {
  it('quotes the same number the deal pays', () => {
    // These were two copies of the same arithmetic — the deed's blurb and
    // `tradeAt` — which is how a shown price and a paid price come to differ.
    const state = newGame('market-quote', 'fair');
    const bread = placeKind('monastery').market!.find((o) => o.id === 'bread')!;
    for (const season of SEASON_ORDER) {
      state.day = dayIn(season);
      expect(offerGot(bread, state.day)).toBe(offerGot(bread, dayIn(season)));
    }
  });
});

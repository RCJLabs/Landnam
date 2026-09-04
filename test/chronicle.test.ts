// The saga as a chronicle.
//
// Measured on a real sixty-one-day run before any of this: 87 entries, 61 of
// them `plain`, and the screenful a player lands on read
//
//     51  We made camp and cut 1 of firewood.
//     53  a long swell coming in with no wind behind it — a gale by morning
//     53  We made camp and cut 1 of firewood.
//     55  Thorbjorn's shield-arm broken had mended.
//     55  We made camp and cut 1 of firewood.
//
// The camp line five times in a screen and a man's arm healing given exactly
// the same weight as a night's firewood. The shape of a saga — its years, its
// winters, the things worth telling — was all in the data and none of it on
// the page.
//
// The bar these hold is not "it looks better". It is that arranging a record
// must not falsify it: a player's saga is their own account of their run.

import { describe, expect, it } from 'vitest';
import { chronicle, dayOfSeason, headingFor, isTold, ordinal, told } from '../src/render/chronicle';
import { SEASON_LENGTH } from '../src/sim/calendar';
import type { SagaEntry, SagaTone } from '../src/state/types';

const line = (day: number, text: string, tone: SagaTone = 'plain'): SagaEntry =>
  ({ day, text, tone });

describe('a chronicle is kept by the year, not the day', () => {
  it('opens each season under its own name', () => {
    expect(headingFor(1)).toBe('The first summer');
    expect(headingFor(SEASON_LENGTH + 1)).toBe('The first autumn');
    expect(headingFor(SEASON_LENGTH * 2 + 1)).toBe('The first winter');
    expect(headingFor(SEASON_LENGTH * 3 + 1)).toBe('The first spring');
    expect(headingFor(SEASON_LENGTH * 4 + 1)).toBe('The second summer');
  });

  it('counts in words as far as a saga is likely to run, then in figures', () => {
    expect(ordinal(1)).toBe('first');
    expect(ordinal(10)).toBe('tenth');
    expect(ordinal(11)).toBe('11th');
  });

  it('breaks a block at every turn of the season', () => {
    const saga = [line(1, 'a'), line(2, 'b'), line(SEASON_LENGTH + 1, 'c')];
    const blocks = chronicle(saga);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.heading).toBe('The first summer');
    expect(blocks[1]!.heading).toBe('The first autumn');
  });

  it('numbers a line by its day IN the season, which is what the heading buys', () => {
    expect(dayOfSeason(1)).toBe(1);
    expect(dayOfSeason(SEASON_LENGTH)).toBe(SEASON_LENGTH);
    expect(dayOfSeason(SEASON_LENGTH + 1)).toBe(1);
  });
});

describe('arranging a record must not falsify it', () => {
  it('loses nothing: every entry in is an entry out, counted', () => {
    const saga = [
      line(1, 'camp'), line(2, 'fog'), line(3, 'camp'), line(4, 'fog'), line(5, 'camp'),
      line(6, 'Finnbogi landed', 'grim'),
    ];
    const blocks = chronicle(saga);
    const total = blocks.flatMap((b) => b.lines).reduce((n, l) => n + l.times, 0);
    expect(total, 'the chronicle dropped or invented entries').toBe(saga.length);
  });

  it('gathers the day\'s business however it was interleaved', () => {
    // The actual failure: camp, forecast, camp, forecast — alternating, so
    // an adjacent-only fold caught none of it and the page read as noise.
    const saga = [
      line(1, 'camp'), line(2, 'fog'), line(3, 'camp'), line(4, 'fog'), line(5, 'camp'),
    ];
    const lines = chronicle(saga)[0]!.lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ text: 'camp', times: 3, day: 1 });
    expect(lines[1]).toMatchObject({ text: 'fog', times: 2, day: 2 });
  });

  it('dates a gathered line to the night it started', () => {
    const lines = chronicle([line(4, 'camp'), line(9, 'camp')])[0]!.lines;
    expect(lines[0]!.day).toBe(4);
  });

  it('NEVER folds a told line, however identical', () => {
    // Two grim days with the same words are two things that happened, and
    // their order is the whole point of a chronicle.
    const saga = [line(1, 'A man died.', 'grim'), line(3, 'A man died.', 'grim')];
    const lines = chronicle(saga)[0]!.lines;
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.day)).toEqual([1, 3]);
    expect(lines.every((l) => l.times === 1)).toBe(true);
  });

  it('never moves a told line out of its order', () => {
    const saga = [
      line(1, 'camp'), line(2, 'first blood', 'grim'), line(3, 'camp'),
      line(4, 'a birth', 'good'), line(5, 'camp'),
    ];
    const lines = chronicle(saga)[0]!.lines;
    const story = lines.filter((l) => isTold(l.tone)).map((l) => l.text);
    expect(story).toEqual(['first blood', 'a birth']);
    // And each keeps its own day.
    expect(lines.find((l) => l.text === 'first blood')!.day).toBe(2);
    expect(lines.find((l) => l.text === 'a birth')!.day).toBe(4);
  });

  it('does not gather across a turn of the season', () => {
    // A camp in summer and a camp in autumn are two seasons' business, and
    // the heading is what makes that legible.
    const saga = [line(1, 'camp'), line(SEASON_LENGTH + 1, 'camp')];
    const blocks = chronicle(saga);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.lines[0]!.times === 1)).toBe(true);
  });

  it('keeps the seasons in the order they happened', () => {
    const saga = [line(1, 'a'), line(SEASON_LENGTH + 1, 'b'), line(SEASON_LENGTH * 2 + 1, 'c')];
    expect(chronicle(saga).map((b) => b.season)).toEqual(['summer', 'autumn', 'winter']);
  });

  it('handles a saga with nothing in it', () => {
    expect(chronicle([])).toEqual([]);
    expect(told([])).toBe(0);
  });
});

describe('what is worth the telling', () => {
  it('counts the story, not the housekeeping', () => {
    const saga = [
      line(1, 'camp'), line(2, 'fog'),
      line(3, 'a death', 'grim'), line(4, 'a landing', 'saga'), line(5, 'a mending', 'good'),
    ];
    expect(told(saga)).toBe(3);
  });

  it('treats every tone but plain as worth a capital', () => {
    expect(isTold('plain')).toBe(false);
    for (const tone of ['good', 'grim', 'saga'] as SagaTone[]) {
      expect(isTold(tone)).toBe(true);
    }
  });
});

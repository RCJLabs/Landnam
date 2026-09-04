// Saying it before it happens.
//
// Split out of `winter.ts` on 2026-08-21. Everything here is the game
// speaking: warnings at the points where there is still time to act, and the
// verdict when there is not. It reads the mark and the reach and writes prose;
// nothing in it decides anything.
//
// Fires at most once each, which is the whole discipline of a telegraph — a
// warning repeated every morning is weather, not news.

import type { GameState } from '../state/types';
import { chronicle } from './saga';
import { forecast, WINTER_DAY } from './winter';
import { bite, seasonStartDay, seasonOf, winterIndex } from './calendar';

/**
 * Saga warnings at the points where there is still time to act. Fires at most
 * once each, so a long autumn does not become a nagging.
 */
export function telegraphWinter(state: GameState): void {
  if (!state.settlement) return;
  const f = forecast(state);

  const warn = (flag: string, text: string): void => {
    if ((state.flags[flag] ?? 0) > 0) return;
    state.flags[flag] = 1;
    chronicle(state, text, 'saga');
  };

  // The turn of autumn: the first honest reckoning of what is needed.
  if (state.day >= 25 && state.day < WINTER_DAY) {
    warn(
      'winterTargetGiven',
      `The nights drew in and we counted what we had. To see spring we would need ${f.food} of food and ${f.firewood} of wood laid by. ${
        f.ready ? 'We had it, and more.' : 'We did not have it yet.'
      }`,
    );
  }

  // What KIND of winter this is, said once at the moment autumn opens.
  // Separate from the reckoning above on purpose: that one is a first-run
  // tutorial beat (`winterTargetGiven` only ever fires in the FIRST autumn,
  // because its own day window is `< WINTER_DAY`, a constant that only
  // falls inside year one) and stays that way — this has to speak every
  // year, because a different winter is drawing every year. Gated on the DAY
  // rather than a `flags` entry for the same reason the '8 days out' line in
  // upkeep.ts needs none: the day is crossed exactly once, ever, per winter.
  if (state.day === seasonStartDay(state.day) && seasonOf(state.day) === 'autumn') {
    const said = characterOfTheComingWinter(state);
    if (said) chronicle(state, said.trim(), 'saga');
  }

  // A week out, when there is still time to cut wood but not to grow food.
  if (state.day >= WINTER_DAY - 7 && state.day < WINTER_DAY && !f.ready) {
    warn(
      'winterLastWarning',
      `Seven days from the dark, and the store was short: ${
        f.foodGap < 0 ? `${-f.foodGap} of food` : ''
      }${f.foodGap < 0 && f.firewoodGap < 0 ? ' and ' : ''}${
        f.firewoodGap < 0 ? `${-f.firewoodGap} of wood` : ''
      }. Everyone knew it.`,
    );
  }

  if (state.day === WINTER_DAY) {
    warn(
      'winterOpened',
      f.ready
        ? 'Winter closed over us with the store full. We had done what could be done.'
        : 'Winter closed over us short, and we had known it was coming.',
    );
  }
}

/**
 * What the autumn reckoning says about the WINTER ITSELF, not the stores —
 * 11.S5, finishing 6.1. `winterDepth` has had a seeded, unknowable-in-advance
 * component since 6.1 shipped, but nothing ever told the player which kind
 * of year they had drawn: the mark only ever showed a bigger or smaller
 * firewood figure, indistinguishable from the YEARS doing what years do.
 * This names the part the years cannot explain.
 *
 * Only the BITE, not the whole depth. The floor is guaranteed and the band
 * already has its own lines for that ("one winter behind us", "N winters
 * stood") — what is worth a sentence is the piece that could not have been
 * planned for, which is `bite()`'s whole reason to exist.
 *
 * Silent for the first winter, matching `bite()` itself: the roll is forced
 * to zero there on purpose, so there is nothing true left to say about it.
 */
function characterOfTheComingWinter(state: GameState): string {
  // `winterIndex` counts winters STOOD, not winters entered, but the two
  // agree from the autumn before a winter through the winter itself — both
  // read off `wintersStood`, which only turns over at the FOLLOWING spring.
  // So asking on an autumn day already answers for the winter it leads into.
  if (winterIndex(state.day) === 0) return '';
  const luck = bite(state.seed, state.day);
  if (luck <= 1) return 'The autumn opened mild, and the old hands said this looked to be an easy year.';
  if (luck <= 2) return 'The autumn opened as autumns do — no better a sign in it than any other year.';
  return 'The autumn opened with something wrong in the colour of the sky, and the old hands said so.';
}

/**
 * The run-end verdict on the winter. Says plainly whether the band was warned
 * and what it did about it — the milestone's whole point is that a death in
 * the dark is never a surprise.
 */
export function winterVerdict(state: GameState): string | undefined {
  if (!state.settlement) return undefined;
  const warned = (state.flags['winterTargetGiven'] ?? 0) > 0;
  const short = (state.flags['winterLastWarning'] ?? 0) > 0;
  if (!warned) return undefined;
  if (state.end?.cause === 'survived') {
    return short
      ? 'We went into the dark short, and came out of it anyway. It was closer than anyone says now.'
      : 'We had counted right in the autumn, and the counting held.';
  }
  return short
    ? 'We had been told the number in the autumn, and we went into the dark without it.'
    : 'The store had looked like enough in the autumn. It was not.';
}

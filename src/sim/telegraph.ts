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

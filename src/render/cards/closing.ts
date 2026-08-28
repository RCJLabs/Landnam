// The end of things and the record of them: the dead, the saga, the
// proclamation, and the screen that closes a run.
//
// Split out of a 749-line `cards.ts` on 2026-08-11. Views only.

// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { exploredFraction } from '../../sim/coast';
import { composeSaga, sagaText } from '../../sim/sagagen';
import type { Fallen } from '../../memorial';
import type { GameState } from '../../state/types';
import { button, el } from '../svg';
import { beats, challengeOf, describeMark, markOf } from '../../sim/challenge';
import { copyText } from '../clipboard';

export function renderWall(dead: Fallen[], onClose: () => void): HTMLElement {
  const card = el('div', { class: 'card wall-card' }, [
    el('h2', {}, ['Those Who Did Not Come Back']),
  ]);

  if (dead.length === 0) {
    card.append(
      el('p', { class: 'event-body' }, [
        'Nobody yet. Every band that has gone out is still out there, or has not gone.',
      ]),
    );
  } else {
    const list = el('div', { class: 'wall-list' });
    for (const person of dead) {
      list.append(
        el('div', { class: 'wall-row' }, [
          el('span', { class: 'wall-name' }, [`${person.name} ${person.byname}`]),
          el('span', { class: 'wall-fate' }, [person.fate]),
          el('span', { class: 'wall-day' }, [`day ${person.day}`]),
        ]),
      );
    }
    card.append(list);
  }

  card.append(button('Back', onClose, { class: 'primary wide' }));
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * The saga as a page of its own. It lived for six phases as a panel pinned
 * under the map; on a phone that was an eighth of the screen spent on
 * history, and the map is the game. Now the map breathes and the chronicle
 * is one tap away, whole instead of three lines at a time.
 */
export function renderSagaBook(
  state: GameState,
  onClose: () => void,
  onGuide?: () => void,
): HTMLElement {
  const list = el('div', { class: 'saga-book' });
  for (const entry of state.saga.slice(-120)) {
    list.append(
      el('p', { class: `saga-line tone-${entry.tone}` }, [
        el('span', { class: 'saga-day' }, [`${entry.day}`]),
        entry.text,
      ]),
    );
  }
  const card = el('div', { class: 'card saga-card' }, [
    el('h2', {}, ['The Saga So Far']),
    list,
    ...(onGuide ? [button('How to play', onGuide, { class: 'relearn' })] : []),
    button('Back', onClose, { class: 'primary wide' }),
  ]);
  // Newest line should be the one you arrive on.
  queueMicrotask(() => {
    list.scrollTop = list.scrollHeight;
  });
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * The proclamation. The one card in the game that offers to END the game,
 * and does not insist: 6.4's whole argument is that an endgame reached is
 * not an endgame finished. It names what ruling on will cost, because a
 * choice offered without its price is not a choice.
 */
export function renderProclamation(
  state: GameState,
  onRuleOn: () => void,
  onClose: () => void,
): HTMLElement {
  const jarl = state.jarl!;
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'card' }, [
      el('h2', { class: 'good' }, ['The Thing Carried It']),
      el('p', { class: 'event-body' }, [
        `${jarl.name} is jarl of ${state.settlement?.name ?? 'this coast'}, and there was nobody ` +
          'here at all when the keel first touched the sand.',
      ]),
      el('p', { class: 'event-body' }, [
        'The saga can be closed on that. Or it can go on — and it will not go ' +
          'on quietly. Every man on this coast now knows exactly whose hall is ' +
          'the richest one, and they will come in greater numbers and better ' +
          'armed than they ever came for a nobody.',
      ]),
      // What ruling BRINGS, said on the card that offers it. Until audit
      // item 9 this screen named only the cost, because the cost was all
      // there was: everything being proclaimed changed made the game harder.
      el('p', { class: 'event-body' }, [
        'They will also render what is owed. Every season the neighbours who ' +
          'are glad of you send their portion up the road, and men looking for ' +
          'a place will come to a hall with a name on it. The ones who hate ' +
          'you send nothing — a title is not the same as a following.',
      ]),
      button('Rule on', onRuleOn, { class: 'primary wide' }),
      button('Close the saga here', onClose, { class: 'action secondary wide' }),
    ]),
  ]);
}

export function renderRunEnd(state: GameState, onRestart: () => void): HTMLElement {
  const end = state.end!;
  const survived = end.cause === 'survived';
  const explored = Math.round(exploredFraction(state.world) * 100);
  const saga = composeSaga(state);

  // The saga IS the ending screen now. What used to be here — the closing
  // lines, the roll of the dead — is inside it, said in prose, so the last
  // thing the player reads is a story about their run rather than a receipt.
  const body = el('div', { class: 'end-summary' });
  for (const chapter of saga.chapters) {
    body.append(
      el('h3', { class: 'saga-head' }, [chapter.heading]),
      el('p', { class: 'saga-prose' }, [chapter.text]),
    );
  }
  body.append(
    el('p', { class: 'end-stat' }, [`${state.day} days ashore · ${explored}% of the land seen`]),
  );

  // If this run was chasing somebody, say so before anything else about
  // sharing — it is the thing the player opened the screen to find out.
  const verdict: HTMLElement[] = [];
  if (state.chasing) {
    const mine = markOf(state);
    const won = beats(mine, state.chasing);
    verdict.push(
      el('p', { class: `chase-verdict ${won ? 'good' : 'grim'}` }, [
        won
          ? `You beat it. Theirs was ${describeMark(state.chasing)}. Yours was ${describeMark(mine)}.`
          : `Not this time. Theirs was ${describeMark(state.chasing)}. Yours was ${describeMark(mine)}.`,
      ]),
    );
  }

  // Shareable: the seed goes with the text, because a saga without the seed
  // that made it is an anecdote and a saga with it is a challenge. The CODE
  // goes with it too, so the anecdote is one somebody can actually take up —
  // it carries the terms as well, which the bare seed never did.
  const code = challengeOf(state);
  const note = el('p', { class: 'seed-note' }, [code]);
  const copy = button('Copy the saga', () => {
    const ok = copyText(`${sagaText(saga)}\n\nBeat this: ${code}`);
    note.replaceChildren(ok ? `Copied — ${code}` : code);
  }, { class: 'action secondary wide' });
  const copyCode = button('Copy the challenge only', () => {
    const ok = copyText(code);
    note.replaceChildren(ok ? `Copied — ${code}` : code);
  }, { class: 'action secondary wide' });

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'card end-card' }, [
      el('h2', { class: survived ? 'good' : 'grim' }, [saga.title]),
      ...verdict,
      body,
      note,
      copy,
      copyCode,
      button('Land again', onRestart, { class: 'primary wide' }),
    ]),
  ]);
}


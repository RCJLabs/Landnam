// The way in: the title screen, where a seed or somebody's challenge code
// decides what country the run happens on.
//
// Split out of a 749-line `cards.ts` on 2026-08-11. Views only.

// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { button, el } from '../svg';
import { createProcessionView } from '../processionView';
import { newGame } from '../../state/create';
import { HARDSHIPS, hardshipById, type HardshipId } from '../../data/hardship';
import { decodeChallenge, describeMark } from '../../sim/challenge';
import { measuredLine } from '../../data/hardship';
import { lastHardship } from '../../hardshipPref';

export function renderTitle(
  hasExistingSave: boolean,
  onContinue: () => void,
  onNew: (seed: string, hardship: HardshipId) => void,
  /** Present only for a player who has already been taught something. */
  onRelearn?: () => void,
  /** Present only once somebody has actually died. */
  onWall?: () => void,
  /** The whole shape of the game, for whoever asks. Always offered. */
  onGuide?: () => void,
): HTMLElement {
  const seedInput = el('input', {
    class: 'seed-input',
    type: 'text',
    placeholder: 'seed or challenge code',
    'aria-label': 'World seed, or a challenge code somebody sent you',
    // A phone keyboard autocapitalises the first word of a pasted line, and
    // a seed is hashed by code unit — so `Grim` and `grim` are different
    // countries. Two people comparing a shared seed would have been playing
    // different games and had no way to tell. Off, all three.
    autocapitalize: 'none',
    autocorrect: 'off',
    spellcheck: 'false',
  });

  // A challenge code carries its own terms, so pasting one takes the choice
  // away — and says so, rather than silently ignoring the chips.
  const chase = el('p', { class: 'chase-note' }, []);
  const readChallenge = () => decodeChallenge(seedInput.value);
  const paintChase = (): void => {
    const c = readChallenge();
    if (!c) {
      chase.replaceChildren();
      chase.classList.remove('on');
      return;
    }
    chase.classList.add('on');
    const terms = hardshipById(c.hardship);
    chase.replaceChildren(
      c.mark
        ? `A challenge: seed "${c.seed}" on ${terms.name}. To beat — ${describeMark(c.mark)}.`
        : `A challenge: seed "${c.seed}" on ${terms.name}.`,
    );
  };
  seedInput.addEventListener('input', () => {
    paintChase();
    paintHardship();
  });

  // How hard the country is, chosen HERE because it is a term of the run
  // rather than a preference — a saga carries the terms it was played under,
  // and a shared seed has to mean the same thing to two people.
  let picked: HardshipId = lastHardship();
  const hardshipRow = el('div', { class: 'hardship-pick' });
  const hardshipNote = el('p', { class: 'hardship-note' }, []);
  const paintHardship = (): void => {
    const forced = decodeChallenge(seedInput.value)?.hardship;
    const showing = forced ?? picked;
    hardshipRow.replaceChildren(
      ...HARDSHIPS.map((terms) => {
        const chip = button(terms.name, () => {
          if (forced) return;
          picked = terms.id;
          paintHardship();
        }, { class: `hardship-chip${showing === terms.id ? ' primary' : ''}${forced ? ' fixed' : ''}` });
        if (forced) chip.setAttribute('aria-disabled', 'true');
        return chip;
      }),
    );
    const terms = hardshipById(showing);
    hardshipNote.replaceChildren(`${terms.blurb} ${measuredLine(terms)}`);
  };
  paintChase();
  paintHardship();

  const buttons = el('div', { class: 'title-buttons' });
  if (hasExistingSave) {
    buttons.append(button('Continue', onContinue, { class: 'primary' }));
  }
  buttons.append(
    button(
      hasExistingSave ? 'New landing' : 'Take the land',
      () => onNew(seedInput.value.trim(), picked),
      { class: hasExistingSave ? '' : 'primary' },
    ),
  );

  // THE COAST YOU ARE ABOUT TO LAND ON, painted behind the card.
  //
  // The title was a wordmark and a paragraph on a black field: a player who
  // had never pressed the button had seen nothing of the game. Everything
  // needed to show them was already built — the oil brush, the walkers, the
  // light — and a whole `GameState` is a pure function of a seed and costs
  // about 3 kB, so the title can simply BE the game's own travel view.
  //
  // And it is the seed's own country. Type a seed, or paste somebody's
  // challenge code, and the coast behind the card changes to the one that
  // seed makes. The screen stops being a menu about the game and becomes a
  // window onto the particular run you are choosing.
  const scene = el('div', { class: 'title-scene', 'aria-hidden': 'true' });
  const view = createProcessionView();
  scene.append(view.root);
  // A sentinel no seed can equal. It was `''` and that is a REAL seed — the
  // one you get by typing nothing, which is the state the title opens in —
  // so the first paint compared empty against empty, decided nothing had
  // changed, and returned. The scene mounted at full size and stayed blank.
  const NEVER = '\u0000';
  let painted = NEVER;
  let pending = 0;
  const paintScene = (): void => {
    // A challenge code carries its own seed, so the picture follows what the
    // run would actually be played on rather than the raw text.
    const typed = seedInput.value.trim();
    const seed = decodeChallenge(typed)?.seed ?? typed;
    if (seed === painted) return;
    painted = seed;
    // `newGame` is cheap but the oil brush is not — about 200ms for a
    // country. Debounced, so holding a key down does not repaint per stroke.
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      try {
        view.update(newGame(seed));
      } catch {
        // A seed that cannot make a world must not take the title screen
        // down with it. The picture is decoration; the button still works.
      }
    }, 220);
  };
  seedInput.addEventListener('input', paintScene);
  // The element has to be in the document before the view can measure it.
  queueMicrotask(() => {
    painted = NEVER;
    paintScene();
  });

  return el('div', { class: 'overlay title', role: 'dialog', 'aria-modal': 'true' }, [
    scene,
    el('div', { class: 'card' }, [
      el('h1', { class: 'game-title' }, ['LANDNÁM']),
      el('p', { class: 'tagline' }, ['Sail, fight, claim, survive.']),
      el('p', { class: 'blurb' }, [
        'Six of you step off the knarr onto a coast with no name you know. Winter comes on the forty-ninth day.',
      ]),
      hardshipRow,
      hardshipNote,
      buttons,
      seedInput,
      chase,
      // The guide is for everyone; the two below are offered only to
      // someone with a reason to want them.
      ...(onGuide ? [button('How to play', onGuide, { class: 'relearn' })] : []),
      ...(onWall ? [button('Those who did not come back', onWall, { class: 'relearn wall-link' })] : []),
      ...(onRelearn ? [button('Show the guidance again', onRelearn, { class: 'relearn' })] : []),
      // Which build this is. The only way, from a phone, to tell a fresh
      // deploy from a cached one.
      el('p', { class: 'build-stamp' }, [`build ${__BUILD__}`]),
    ]),
  ]);
}

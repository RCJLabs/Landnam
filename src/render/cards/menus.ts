// Preferences and reference — the two overlays that are about the GAME
// rather than about the run.
//
// Split out of a 749-line `cards.ts` on 2026-08-11. Views only.

// Full-screen overlays: the title, the event card, the warband roster, and
// the run's ending. Views only.

import { GUIDE } from '../../data/guide';
import { button, el } from '../svg';
import { hardshipById, type HardshipId } from '../../data/hardship';

export interface SettingsOptions {
  muted: boolean;
  onToggleSound: () => void;
  motionStill: boolean;
  onToggleMotion: () => void;
  /** The current run's seed, when a run exists — the shareable thing. */
  seed?: string;
  /** The terms the current run is being played on. Shown, never edited. */
  hardship?: HardshipId;
  /** Present only for a player who has been taught something. */
  onRelearn?: () => void;
  /** Present only once somebody has died, ever. */
  onWall?: () => void;
  onClose: () => void;
}

/**
 * The settings, gathered in one place: the sound, the motion, the seed,
 * and the two links that used to crowd the title screen. Every row states
 * its current value in words — a bare toggle with no label is a guess.
 */
export function renderSettings(opts: SettingsOptions): HTMLElement {
  const toggleRow = (label: string, value: string, onTap: () => void): HTMLElement => {
    const control = button('', onTap, { class: 'settings-row' });
    control.append(
      el('span', { class: 'settings-name' }, [label]),
      el('span', { class: 'settings-value' }, [value]),
    );
    return control;
  };

  const card = el('div', { class: 'card settings-card' }, [
    el('h2', {}, ['Settings']),
    toggleRow('Sound', opts.muted ? 'Off' : 'On', opts.onToggleSound),
    toggleRow(
      'Motion',
      opts.motionStill ? 'Kept still' : 'With the device',
      opts.onToggleMotion,
    ),
  ]);

  // The terms this run is being played on. Shown and not editable: hardship
  // is chosen when the keel touches sand and belongs to the saga after that,
  // so a shared seed means the same game to two people. Changing it is what
  // the next landing is for.
  if (opts.hardship) {
    const terms = hardshipById(opts.hardship);
    const row = el('div', { class: 'settings-row settings-static' }, [
      el('span', { class: 'settings-name' }, ['This country']),
      el('span', { class: 'settings-value' }, [terms.name]),
    ]);
    card.append(row);
  }

  if (opts.seed) {
    const seed = opts.seed;
    const copy = toggleRow('Seed of this saga', seed, () => {
      void navigator.clipboard?.writeText(seed).then(() => {
        copy.querySelector('.settings-value')!.textContent = 'Copied';
      });
    });
    card.append(copy);
  }

  if (opts.onRelearn) {
    card.append(button('Show the guidance again', opts.onRelearn, { class: 'relearn' }));
  }
  if (opts.onWall) {
    card.append(button('Those who did not come back', opts.onWall, { class: 'relearn wall-link' }));
  }

  card.append(
    el('p', { class: 'build-stamp' }, [`build ${__BUILD__}`]),
    button('Back', opts.onClose, { class: 'primary wide' }),
  );
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

/**
 * How to play, whole. The lessons stay event-shaped and state-triggered;
 * this is the reference for whoever wants the shape all at once — chosen,
 * never imposed, which is what buys it the right to name buttons.
 */
export function renderGuide(onClose: () => void): HTMLElement {
  const card = el('div', { class: 'card guide-card' }, [el('h2', {}, ['How to Play'])]);
  const list = el('div', { class: 'guide-book' });
  for (const section of GUIDE) {
    list.append(
      el('h3', {}, [section.title]),
      el('p', { class: 'event-body guide-body' }, [section.body]),
    );
  }
  card.append(list, button('Back', onClose, { class: 'primary wide' }));
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

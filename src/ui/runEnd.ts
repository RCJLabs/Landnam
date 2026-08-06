// Run-end overlay: victory or death, saga summary, fame.

import { GameRun } from '../sim/types';
import { el, button } from './dom';

const OUTCOME_TITLES: Record<string, string> = {
  victory: 'Vinland the Good',
  starved: 'The Hungry Sea',
  sunk: 'Ran Takes Her Due',
  slain: 'A Red Ending',
  mutiny: 'The Crew Turns Home',
  abandoned: 'The Long Way Back',
};

export function renderRunEnd(run: GameRun, onNewRun: () => void): HTMLElement {
  const end = run.end!;
  const overlay = el('div', { class: 'overlay' });
  const panel = el('div', { class: 'panel run-end-panel' }, [
    el('h1', { class: end.outcome === 'victory' ? 'title-good' : 'title-grim' }, [
      OUTCOME_TITLES[end.outcome] ?? 'The Saga Ends',
    ]),
    el('div', { class: 'saga-summary' }, end.summary.map((s) => el('p', {}, [s]))),
    el('p', { class: 'fame-line' }, [`Fame earned: ${end.fame}`]),
    button('Begin a new voyage', onNewRun, { class: 'btn-primary' }),
  ]);
  overlay.append(panel);
  return overlay;
}

// Choice-event dialog: title, prose, options with visible odds, outcome.

import { GameRun, StrategicIntent } from '../sim/types';
import { el, button } from './dom';

export function renderEventPanel(
  run: GameRun,
  dispatch: (intent: StrategicIntent) => void,
): HTMLElement {
  const ev = run.activeEvent!;
  const overlay = el('div', { class: 'overlay overlay-light' });
  const panel = el('div', { class: 'panel event-panel' }, [
    el('h2', { class: 'event-title' }, [ev.title]),
    el('p', { class: 'event-text' }, [ev.text]),
  ]);

  if (ev.outcome) {
    panel.append(
      el('p', { class: `event-outcome ${ev.outcome.success ? 'outcome-good' : 'outcome-bad'}` }, [
        ev.outcome.text,
      ]),
      button('Continue', () => dispatch({ type: 'EVENT_CONTINUE' }), { class: 'btn-primary' }),
    );
  } else {
    const opts = el('div', { class: 'event-options' });
    ev.options.forEach((o, i) => {
      const b = button(o.label, () => dispatch({ type: 'CHOOSE_OPTION', index: i }), {
        class: 'event-option',
      });
      if (o.detail) b.append(el('span', { class: 'option-detail' }, [o.detail]));
      opts.append(b);
    });
    panel.append(opts);
  }
  overlay.append(panel);
  return overlay;
}

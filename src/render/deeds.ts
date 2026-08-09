// Everything the band can spend a day on, as one list.
//
// These used to be a row of buttons across the bottom of the phone. By 4.3
// there were nine of them at 46px wide with labels wrapping onto three lines,
// and a player had no way of knowing what any of them cost. One button opens
// this instead: every deed with a line saying what it does, and the ones you
// cannot take still listed, greyed, with the reason.

import type { Action } from '../sim/actions';
import type { GameState } from '../state/types';
import { atHome, BLOCK_REASON, foundBlocker } from '../sim/site';
import { atSea, canFish, canGather } from '../sim/travel';
import { everyoneHome } from '../sim/expedition';
import { BARGAIN_REASON, bargainBlocker, neighbourHere } from '../sim/neighbours';
import { placeHere, tradeBlocker, TRADE_REASON } from '../sim/places';
import { placeKind } from '../data/places';
import { BARTER_FOOD } from '../data/clans';
import { FEAST_FOOD } from '../data/thing';
import { wintersStood } from '../sim/calendar';
import { thingCooldown, thingNeeds, thingOdds, yearsRuled } from '../sim/thing';
import { strandTarget } from '../sim/sea';
import { button, el } from './svg';

export interface Deed {
  id: string;
  label: string;
  blurb: string;
  /** Set when the deed is shown but refused, and why. */
  blocked?: string;
  /** 'weighty' for one-way choices, 'grim' for drawing steel. */
  tone?: 'weighty' | 'grim';
  run(): void;
}

export type Dispatch = (action: Action) => void;

/**
 * The day's choices, in the order a player thinks about them: the ordinary
 * work first, then whoever is standing in front of you, then the decisions
 * that change the run.
 */
export function deedsFor(
  state: GameState,
  dispatch: Dispatch,
  onSettle: () => void,
  onLaunch: () => void,
): Deed[] {
  const deeds: Deed[] = [];
  if (state.end || state.event) return deeds;

  const home = atHome(state);
  const afloat = atSea(state);
  const host = neighbourHere(state);

  deeds.push({
    id: 'camp',
    label: home ? 'Rest' : afloat ? 'Lie at anchor' : 'Camp',
    blurb: home
      ? 'Pass the day at the steading. The work goes on around you.'
      : afloat
        ? 'Hold in the lee of the land and sleep aboard. No wood, no forage.'
        : 'Rest, mend, and cut firewood. Costs a day.',
    run: () => dispatch({ type: 'CAMP' }),
  });

  // Gathering is for the road: at the steading the jobs already are the day's
  // work, and at sea there is nothing ashore to pick.
  if (!home && !host) {
    if (canGather(state)) {
      deeds.push({
        id: 'forage',
        label: 'Forage',
        blurb: 'Search the ground for roots and berries. Best wits leads.',
        run: () => dispatch({ type: 'FORAGE' }),
      });
      deeds.push({
        id: 'hunt',
        label: 'Hunt',
        blurb: 'Follow tracks for meat. Slow, and some days it is nothing.',
        run: () => dispatch({ type: 'HUNT' }),
      });
    }
    if (canFish(state)) {
      deeds.push({
        id: 'fish',
        label: 'Fish',
        blurb: afloat
          ? 'Put the nets over the side. The best water there is.'
          : 'Set nets in the water here.',
        run: () => dispatch({ type: 'FISH' }),
      });
    }
  }

  const here = placeHere(state);
  if (here && here.sackedOn === undefined) {
    const def = placeKind(here.kind);
    // What they will DEAL in comes before what they can be robbed of. A
    // trading town that offered steel and nothing else was the report that
    // started this: jetties and warehouses, and no counter to stand at.
    for (const offer of def.market ?? []) {
      const blocked = tradeBlocker(state, here.id, offer.id);
      const gave = offer.give === 'food' ? 'food' : 'firewood';
      const took = offer.take === 'food' ? 'food' : 'timber';
      const got = Math.max(1, Math.round(offer.cost * offer.rate));
      deeds.push({
        id: `trade-${offer.id}`,
        label: offer.deed,
        blurb: `${offer.blurb} ${offer.cost} ${gave} for ${got} ${took}.`,
        ...(blocked ? { blocked: TRADE_REASON[blocked] } : {}),
        run: () => dispatch({ type: 'TRADE_AT', id: here.id, offer: offer.id }),
      });
    }
    deeds.push({
      id: 'sack-place',
      label: def.deed,
      blurb:
        def.garrison !== null
          ? `${def.blurb} Steel first: whoever holds it will not hand it over.`
          : `${def.blurb} A day's work.`,
      ...(def.garrison !== null ? { tone: 'grim' as const } : {}),
      run: () => dispatch({ type: 'SACK_PLACE', id: here.id }),
    });
  }

  if (host) {
    const blocked = bargainBlocker(state, host.id);
    deeds.push({
      id: 'barter',
      label: `Barter with ${host.name}`,
      blurb: `Carry ${BARTER_FOOD} of food in and come out with timber and goods.`,
      ...(blocked ? { blocked: BARGAIN_REASON[blocked] } : {}),
      run: () => dispatch({ type: 'BARTER', id: host.id }),
    });
    deeds.push({
      id: 'fallon',
      label: `Fall on ${host.name}`,
      blurb: 'Draw steel. Whatever you take, they will remember who took it.',
      tone: 'grim',
      run: () => dispatch({ type: 'FALL_ON', id: host.id }),
    });
  }

  if (!state.settlement) {
    // Shown even when refused, with the ground's own reason. A missing button
    // teaches nothing; a greyed one that says "no fresh water" teaches the
    // whole system in a sentence.
    const blocker = foundBlocker(state, state.party.at);
    deeds.push({
      id: 'settle',
      label: 'Take this land',
      blurb: 'Set the posts here. There is no undoing it and no second steading.',
      tone: 'weighty',
      ...(blocker ? { blocked: BLOCK_REASON[blocker] } : {}),
      run: onSettle,
    });
  }

  if (home) {
    deeds.push({
      id: 'steading',
      label: 'The steading',
      blurb: 'Set your people to work, and see what wants building.',
      tone: 'weighty',
      run: () => dispatch({ type: 'ENTER_COLONY' }),
    });
  }

  if (everyoneHome(state) && home) {
    deeds.push({
      id: 'launch',
      label: 'Send a party out',
      blurb: 'Only a launched party walks the map. Everyone you send stops working.',
      tone: 'weighty',
      run: onLaunch,
    });
  }

  // The off-ramp, for as long as the rule stands. A jarldom you cannot lay
  // down would be a run with no ending at all, which is worse than one that
  // ends too early — so the closing stays one tap away, forever.
  if (state.jarl) {
    const years = yearsRuled(state);
    deeds.push({
      id: 'laydown',
      label: 'Lay down the rule',
      blurb:
        years > 0
          ? `Close the saga here, ${years} winters into the jarldom. Nothing comes after it.`
          : 'Close the saga here, with the rule newly granted. Nothing comes after it.',
      tone: 'weighty',
      run: () => dispatch({ type: 'LAY_DOWN_RULE' }),
    });
  }

  // The ship's way in. Only ever offered afloat beside a place worth taking,
  // and the blurb names the whole bargain — the take, and what losing costs.
  const strand = strandTarget(state);
  if (strand) {
    const def = placeKind(strand.kind);
    deeds.push({
      id: 'strandhogg',
      label: `Fall on ${def.name.toLowerCase()} from the ship`,
      blurb:
        'They do not watch the water. One fewer of them, and shaken — and the hold ' +
        'takes half again what backs could carry. Lose, and the packs go over the ' +
        'side and the hull with them.',
      tone: 'weighty',
      run: () => dispatch({ type: 'STRANDHOGG' }),
    });
  }

  // The endgame. Offered from the first thaw onward so the player knows the
  // shape of what they are working toward, and blocked with the reason until
  // the whole checklist is met. Gone once it has been won.
  if (state.settlement && !state.jarl && wintersStood(state.day) >= 1) {
    const cooling = thingCooldown(state);
    const missing = thingNeeds(state).find((n) => !n.met);
    const blocked = cooling > 0
      ? `They will not be called back for another ${cooling} days.`
      : missing
        ? `${missing.label} — ${missing.why}`
        : undefined;
    deeds.push({
      id: 'thing',
      label: 'Call a Thing',
      blurb: `Send word the length of the coast and put the case. ${Math.round(thingOdds(state) * 100)}% · costs 3 days and ${FEAST_FOOD} of food.`,
      tone: 'weighty',
      ...(blocked ? { blocked } : {}),
      run: () => dispatch({ type: 'CALL_THING' }),
    });
  }

  if (state.expedition && !state.expedition.returning) {
    deeds.push({
      id: 'turnhome',
      label: 'Turn back',
      blurb: 'Head for the steading. From then on the map only offers the way home.',
      run: () => dispatch({ type: 'TURN_HOME' }),
    });
  }

  return deeds;
}

/** The sheet itself. One row per deed, each a full-width tap target. */
export function renderDeeds(deeds: Deed[], close: () => void): HTMLElement {
  const list = el('div', { class: 'deeds' });
  for (const deed of deeds) {
    const row = el(
      'button',
      {
        type: 'button',
        class: `deed${deed.tone ? ` ${deed.tone}` : ''}${deed.blocked ? ' blocked' : ''}`,
        ...(deed.blocked ? { disabled: 'true' } : {}),
      },
      [
        el('span', { class: 'deed-label' }, [deed.label]),
        el('span', { class: 'deed-blurb' }, [deed.blocked ?? deed.blurb]),
      ],
    );
    if (!deed.blocked) {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        deed.run();
      });
    }
    list.append(row);
  }

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'card deeds-card' }, [
      el('h2', {}, ['The Day']),
      list,
      button('Not yet', close, { class: 'primary wide' }),
    ]),
  ]);
}

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
import { atSea } from '../sim/road';
import { canFish, canGather } from '../sim/gathering';
import { thinWord, thinness, type Larder } from '../sim/abundance';
import { WAY_REASON, wayBlocker, wayDays } from '../sim/ways';
import { canHoldBlot } from '../sim/blot';
import { everyoneHome } from '../sim/expedition';
import { BARGAIN_REASON, bargainBlocker, neighbourHere } from '../sim/neighbours';
import { offerGot, placeHere, tradeBlocker, TRADE_REASON } from '../sim/places';
import { placeKind } from '../data/places';
import { BARTER_FOOD } from '../data/clans';
import { FEAST_FOOD } from '../data/thing';
import { wintersStood } from '../sim/calendar';
import { thingCooldown, thingNeeds, thingOdds, yearsRuled } from '../sim/thing';
import { strandTarget } from '../sim/sea';
import { fallOnReport } from '../sim/raid';
import { button, el } from './svg';
import { copyText } from './clipboard';

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
  // What the ground has left, said BEFORE the day is spent. A larder that
  // quietly pays less is a tax the player cannot see; one that says the
  // tracks are old is a reason to move camp, which is the whole point.
  const state_ = state;
  const leftHere = (kind: Larder, full: string): string => {
    const how = thinness(state_, kind, state_.party.at);
    return how === 'good' ? full : `${full} ${thinWord(kind, how)}`;
  };

  if (!home && !host) {
    if (canGather(state)) {
      deeds.push({
        id: 'forage',
        label: 'Forage',
        blurb: leftHere('forage', 'Search the ground for roots and berries. Best wits leads.'),
        run: () => dispatch({ type: 'FORAGE' }),
      });
      deeds.push({
        id: 'hunt',
        label: 'Hunt',
        blurb: leftHere('hunt', 'Follow tracks for meat. Slow, and some days it is nothing.'),
        run: () => dispatch({ type: 'HUNT' }),
      });
    }
    if (canFish(state)) {
      deeds.push({
        id: 'fish',
        label: 'Fish',
        blurb: leftHere(
          'fish',
          afloat ? 'Put the nets over the side. The best water there is.' : 'Set nets in the water here.',
        ),
        run: () => dispatch({ type: 'FISH' }),
      });
    }
  }

  // Breaking ground. Offered wherever it would actually pay — `wayBlocker`
  // refuses ground that already walks easily rather than selling a wasted
  // day — and priced in the sheet, because days are the one thing this game
  // never gives back.
  if (!home && !afloat) {
    const blocked = wayBlocker(state, state.party.at);
    if (blocked === null) {
      const days = wayDays(state, state.party.at);
      deeds.push({
        id: 'make-way',
        label: 'Break ground',
        // The chaining has to be said. A lone made hex is nearly worthless —
        // ways pay by JOINING UP — and a verb that hides that sells the
        // player days for nothing.
        blurb: `${days} ${days === 1 ? 'day' : 'days'} of work. Ways join up: two made hexes in a row are `
          + 'crossed in a single day, so a road pays back on the journeys you take again.',
        run: () => dispatch({ type: 'MAKE_WAY' }),
      });
    } else if (blocked === 'made') {
      deeds.push({
        id: 'make-way',
        label: 'Break ground',
        blurb: 'Cut a way through. The going here is easier ever after.',
        blocked: WAY_REASON.made,
        run: () => {},
      });
    }
  }

  // The blood-month rite. Only at the hall, only in autumn, and only when
  // no oath already stands — `canHoldBlot` asks the card's own `when`, so
  // the gate lives in one place.
  if (canHoldBlot(state)) {
    deeds.push({
      id: 'blot',
      label: 'Hold the blót',
      blurb: 'Kill the beasts that will not winter, and let anyone who means to '
        + 'swear something do it where the hall can hear.',
      tone: 'weighty',
      run: () => dispatch({ type: 'HOLD_BLOT' }),
    });
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
      const got = offerGot(offer, state.day);
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
    const odds = fallOnReport(state, host.might);
    deeds.push({
      id: 'fallon',
      label: `Fall on ${host.name}`,
      // The numbers first, because this is the one deed on the sheet that
      // used to say nothing. Standing is docked the moment it is tapped and
      // people die for good, so "how many of us, how many of them" is the
      // least the sheet owes a player.
      blurb:
        `${odds.ours} of us here against about ${odds.theirs} of them. ` +
        (odds.theirs > odds.ours
          ? 'They have the numbers. '
          : '') +
        'Whatever you take, they will remember who took it.',
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

/**
 * The sheet itself. One row per deed, each a full-width tap target.
 *
 * `coast` is the challenge code for the run in progress, and it hangs below
 * the list rather than sitting in it: the list is what the band can spend a
 * DAY on, and passing somebody the seed costs no day. It is here because
 * until now the code existed on the ending screen and nowhere else, so a
 * player who wanted to send a friend the country they were enjoying had to
 * lose first.
 */
export function renderDeeds(deeds: Deed[], close: () => void, coast?: string): HTMLElement {
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

  const card = el('div', { class: 'card deeds-card' }, [el('h2', {}, ['The Day']), list]);

  if (coast) {
    // The code itself is on screen, not hidden behind the button: copying
    // fails silently in more browsers than it works in, and a player who can
    // READ the line can always retype it. That is also why the format is
    // plain text — see the header of sim/challenge.ts.
    const note = el('p', { class: 'coast-code' }, [coast]);
    card.append(
      el('div', { class: 'coast' }, [
        el('p', { class: 'coast-blurb' }, ['This coast, for somebody else to land on.']),
        note,
        button('Copy the coast', () => {
          note.replaceChildren(copyText(coast) ? `Copied — ${coast}` : coast);
        }, { class: 'action secondary wide' }),
      ]),
    );
  }

  card.append(button('Not yet', close, { class: 'primary wide' }));
  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, [card]);
}

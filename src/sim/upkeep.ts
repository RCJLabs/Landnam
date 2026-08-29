// What every passing day costs. This is the clock that kills you: mouths to
// feed, a fire to keep, and a season that stops giving.

import type { GameState, Person, RunEnd } from '../state/types';
import { effectsOn, nextThaw, seasonOf, wintersStood, SEASON_LENGTH, YEAR_LENGTH } from './calendar';
import { LONG_LIFE_WINTERS } from '../data/thing';
import { worldBeat } from './beats';
import { omenFor, weatherOn } from './weather';
import { ageTheBand, childrenOf, maybeBirth } from './lineage';
import { maybePair } from './household';
import { careToday, maybeSpread } from './sickness';
import { oathDay } from './oath';
import { atSeaAway, voyageDay } from './voyage';
import { markReckoning } from './landnam';
import { CHILD_APPETITE } from '../data/lineage';
import { HALF_RATION_HEART, HALF_RATION_TOLL, RATION_SHARE } from '../data/rations';
import { hardshipById } from '../data/hardship';
import { living } from './people';
import { stream } from '../rng';
import { noteFirstWork, shelterSaving, workTheDay } from './colony';
import { coldNight, sickCount } from './cold';
import { telegraphWinter, winterVerdict } from './telegraph';
import { driftMoods, feudsComeDue, maybeFireFeud, stirGrudges } from './minds';
import { arriveHome, pruneExpedition } from './expedition';
import { driftStandings, neighboursCallOn } from './neighbours';
import { rivalDay } from './rival';
import { maybeOutlawStrike } from './outlaw';
import { renderTribute } from './thing';
import { handsLeave, maybeJoin, maybeSword } from './joining';
import {
  QUIET_SEASON_SHARE,
  autumnChance,
  autumnRaidDay,
  raidable,
  raidDifficulty,
  raidOdds,
} from './raid';
import { startRaid } from './battleTurn';
import { bonus } from './lore';
import { chronicle } from './saga';
import { mourn } from './kin';

/**
 * The first thaw. Until 4.6 this ended the run in victory; now it is the day
 * the endgame OPENS — the checklist in sim/thing.ts starts being shown, and
 * the year comes round again. See LONG_LIFE_WINTERS for the far end.
 */
export const SURVIVAL_DAY = 73;

/**
 * Somebody comes for the steading, or does not.
 *
 * Rolled on its own rather than drawn from the event deck, because the deck
 * made raids a matter of which card came up: a quarter of whole sagas never
 * saw one at all, so their size could not decide a run however large 6.3 made
 * them.
 *
 * The rate is tuned against test/thing.test.ts, not against the survival
 * curve, because that test carries a promise the curve cannot see — a band
 * that builds the hall, keeps the peace and makes a friend must still be able
 * to reach the endgame. The first cut took that from 4 of 4 to 1 of 4, which
 * is harder in the wrong way: a siege that eats the mead hall before the
 * Thing can be called in it is not difficulty, it is a dead end.
 */
export function maybeRaid(state: GameState): void {
  if (state.end || state.battle || state.event) return;
  if (!raidable(state)) return;

  // AUTUMN IS A RECKONING, NOT A TRICKLE. The rest of the year keeps the
  // daily hazard — opportunists, a feud coming to a head, somebody who
  // heard about the store. Autumn is when they come for the winter's food,
  // and it is one roll on one day, so a band can see it approaching and
  // spend the summer on a wall. See `AUTUMN_WORTH_K` for the measurement
  // that asked for this: the threat was never too small, it was too random.
  if (seasonOf(state.day) === 'autumn') {
    if (state.day !== autumnRaidDay(state)) return;
    const odds = autumnChance(state);
    if (odds <= 0) return;
    if (!stream(state.seed, 'events').derive(`raid-autumn:${state.day}`).chance(odds)) return;
    startRaid(state, raidDifficulty(state));
    return;
  }

  // The rest of the year is the background hazard it always was, quartered:
  // autumn now carries most of the year's risk, and the whole point was to
  // MOVE the risk rather than add it. See `QUIET_SEASON_SHARE`.
  const odds = raidOdds(state) * QUIET_SEASON_SHARE;
  if (odds <= 0) return;
  if (!stream(state.seed, 'events').derive(`raid:${state.day}`).chance(odds)) return;
  startRaid(state, raidDifficulty(state));
}

export function foodPerDay(state: GameState): number {
  // Adults at a half share each, and the children born here at a quarter —
  // `CHILD_APPETITE` is measured against a grown share, and a grown share is
  // already a half. Two children come to one more food a day on a band of six.
  //
  // THE ONLY COPY OF THIS FORMULA. `winter.ts` had its own, twice, computed
  // off the projected crew — which was harmless while a mouth was always an
  // adult and would have gone quietly wrong the moment children ate. The mark
  // and the larder have to move together for the same reason the mark and the
  // fire do.
  // A crew over the open sea took their stores with them and eats out of
  // those; counting them here would feed them twice.
  const mouths = living(state.party.people).filter((p) => !atSeaAway(state, p)).length
    + childrenOf(state).length * CHILD_APPETITE;
  // Short commons, applied HERE and nowhere else — which is the whole payoff
  // of there being one copy of this formula. The winter mark, the verdict and
  // the night's eating all read this function, so a band that goes on half
  // rations is told a smaller number by the mark at the same moment it starts
  // eating less. Split across two copies, the mark would have gone on asking
  // for a full winter's food.
  const share = state.party.rations === 'half' ? RATION_SHARE : 1;
  return Math.max(1, Math.ceil((mouths / 2) * share));
}

/**
 * The band the firewood figures were tuned against. Six off the knarr.
 */
export const BAND_BASE = 6;

/**
 * How much of a night's fire is the hearth itself rather than the people
 * round it.
 *
 * A fire warms a room, not a headcount, so cost cannot scale straight off the
 * roster — but a hall of twelve does not keep warm on what six burned either.
 * This splits the difference: a little over half the burn is the hearth and
 * is paid whoever is home, and the rest follows the band.
 *
 * The reason this exists at all: food already scaled with mouths and firewood
 * did not, so every extra person was pure labour at no cost in wood. That is
 * precisely what made a settled band untouchable — three separate attempts to
 * threaten the late game bounced off six people out-producing any burn that
 * could be set. Phase 6.2 lets the band GROW, and growth had to cost
 * something before it could be offered.
 */
export const HEARTH_SHARE = 0.55;

/**
 * How long a burial hangs over the band's moods.
 *
 * Was a bare `3` in `passDay`. It is exported because the C++ port generates
 * its constants from this file rather than retyping them, and a number the
 * two builds have to agree on cannot live inside an expression.
 */
export const GRIEF_DAYS = 3;

/**
 * What tonight actually costs. Seeded, because how hard THIS winter is was
 * decided when the run was — see winterDepth in calendar.ts — and scaled by
 * how many are round the fire.
 */
export function firewoodPerNight(state: GameState): number {
  const heads = living(state.party.people).length;
  // The winter's bite, by how hard this country is. Applied HERE, on the
  // actual burn, and mirrored in winter.ts's plannedFirewood — the mark and
  // the fire have to move together or the mark is lying to the player.
  // Weather rides on top of the season, and it is added HERE and in
  // winter.ts's plannedFirewood together — `test/weather.test.ts` pins the
  // two, because the comment below has been true since the mark was written
  // and a frost the fire felt but the mark did not would break it silently.
  const sky = weatherOn(state.seed, state.day).firewood;
  const base = Math.max(0, effectsOn(state.day, state.seed).firewood + sky)
    * hardshipById(state.hardship).winter;
  const share = HEARTH_SHARE + (1 - HEARTH_SHARE) * (heads / BAND_BASE);
  // Never below one: a fire is a fire. Rounded up, because you cannot burn
  // half a log and the alternative is a band that quietly gets free nights.
  return Math.max(1, Math.ceil(base * share));
}

function weakest(people: Person[]): Person | undefined {
  const alive = living(people);
  if (alive.length === 0) return undefined;
  return alive.reduce((worst, p) => (p.health < worst.health ? p : worst));
}

function wound(state: GameState, person: Person, amount: number, fate: string): void {
  person.health -= amount;
  worldBeat(state, { kind: 'hurt', who: person.id, amount, cause: fate });
  if (person.health <= 0) {
    person.health = 0;
    person.alive = false;
    person.fate = fate;
    worldBeat(state, { kind: 'died', who: person.id, cause: fate });
    chronicle(state, `${person.name} ${person.byname} died of ${fate}. We had no ground fit to bury them in.`, 'grim');
    mourn(state, person);
  }
}

function endRun(state: GameState, cause: RunEnd['cause'], title: string, lines: string[]): void {
  if (state.end) return;
  state.end = { cause, title, lines };
}

/** Heals injuries and knits wounds over time. */
function mendInjuries(state: GameState): void {
  // Nothing mends in a cold hall on short rations. Winter illness that ticked
  // down like a summer scratch would take the teeth out of the whole season.
  const frozen = seasonOf(state.day) === 'winter';
  // Somebody who knows what they are doing gets more out of a day's rest —
  // what the band has LEARNED, plus whoever is set to tending today. The
  // healer's day is spent here rather than banked, which is the whole reason
  // `care` is not a stockpile.
  const tending = careToday(state);
  const care = 1 + bonus(state, 'mend') + tending;
  for (const person of state.party.people) {
    if (!person.alive) continue;
    person.injuries = person.injuries.filter((injury) => {
      // WINTER ILLNESS MENDS FOR A HEALER AND FOR NOBODY ELSE, and this line
      // is what the healer is FOR.
      //
      // The rule above is right and was total: no `ill_` mended between the
      // frost and the thaw, whatever the hall did. Measured, that switched
      // the healer's mending off in the only season that hands illness out —
      // `coldNight` is where `ill_` comes from — while its other lever, the
      // guard on `catchingOdds`, was already guarding a floor, because
      // `crowding` returns zero on every settled day this harness has ever
      // measured. Both levers neutralised, and the job read as worth nothing:
      // 364 days of tending moved illness 0.48 to 0.46 person-days per day
      // lived and survival not at all.
      //
      // So the season keeps its teeth against a band that has nobody set to
      // it, and a hall that spends a hand on tending can nurse somebody
      // through. That is the trade the job is supposed to be, and it is the
      // one thing a healer in a Norse winter would actually have done.
      if (frozen && injury.id.startsWith('ill_')) {
        if (tending <= 0) return true;
        injury.heals -= tending;
        if (injury.heals <= 0) {
          chronicle(
            state,
            `${person.name} was nursed through the worst of it, and the ${injury.label.toLowerCase()} `
              + 'let go before the thaw.',
            'good',
          );
          return false;
        }
        return true;
      }
      injury.heals -= care;
      if (injury.heals <= 0) {
        chronicle(state, `${person.name}'s ${injury.label.toLowerCase()} had mended.`, 'good');
        return false;
      }
      return true;
    });
  }
}

/**
 * Advances a single day and applies its costs. Mutates the state clone.
 * Returns false once the run has ended, so callers can stop early.
 */
export function passDay(state: GameState): boolean {
  if (state.end) return false;

  const wasSeason = seasonOf(state.day);
  state.day += 1;
  const party = state.party;
  const season = seasonOf(state.day);
  const effects = effectsOn(state.day);
  worldBeat(state, { kind: 'dawn', season });
  // The turn of the year, said once and at the moment it happens. A view
  // that diffed two states could work this out; a view being handed a
  // sequence should not have to.
  if (season !== wasSeason) worldBeat(state, { kind: 'seasonTurned', season });

  // Somebody else's day, taken before ours: their fences go up whether the
  // band spent the day marching, resting or arguing.
  rivalDay(state);
  // And a man we drove out, who has been waiting.
  maybeOutlawStrike(state);

  // Work comes before eating: what the day produced is available to the mouths
  // it has to feed that same evening.
  const foodBefore = party.food;
  const woodBefore = party.firewood;
  const labour = workTheDay(state);
  if (party.food !== foodBefore || party.firewood !== woodBefore) {
    worldBeat(state, {
      kind: 'worked',
      food: party.food - foodBefore,
      firewood: party.firewood - woodBefore,
      works: 0,
    });
  }

  // Mouths.
  const needed = foodPerDay(state);
  const eaten = Math.min(party.food, needed);
  party.food -= eaten;
  const hungry = eaten < needed;
  worldBeat(state, { kind: 'ate', took: eaten, needed, short: needed - eaten });

  // Fire. A roof of your own is worth firewood you do not have to cut.
  const wood = Math.max(0, firewoodPerNight(state) - shelterSaving(state));
  const burned = Math.min(party.firewood, wood);
  party.firewood -= burned;
  const cold = burned < wood;
  worldBeat(state, { kind: 'burned', took: burned, needed: wood, short: wood - burned });

  // What short commons cost, on a day the band actually ate its (smaller)
  // share. Paid whether or not the store held out: going hungry ON half
  // rations is both penalties, which is correct — that band is in real
  // trouble and the game should not soften it.
  if (party.rations === 'half') {
    party.morale = Math.max(0, party.morale - HALF_RATION_HEART);
    const lean = (state.flags['leanDays'] ?? 0) + 1;
    state.flags['leanDays'] = lean;
    if (lean % HALF_RATION_TOLL === 0) {
      const thin = weakest(party.people);
      if (thin) wound(state, thin, 1, 'short commons');
    }
  } else {
    state.flags['leanDays'] = 0;
  }

  if (hungry) {
    party.morale = Math.max(0, party.morale - 8);
    const victim = weakest(party.people);
    if (victim) wound(state, victim, 2, 'hunger');
    const streak = (state.flags['hungerStreak'] ?? 0) + 1;
    state.flags['hungerStreak'] = streak;
    chronicle(state, hungerLine(streak), 'grim');
  } else {
    state.flags['hungerStreak'] = 0;
  }

  if (cold) {
    // Cold only truly bites outside summer; a summer night without fire is
    // merely miserable.
    const bite = season === 'winter' ? 3 : season === 'summer' ? 0 : 1;
    party.morale = Math.max(0, party.morale - (season === 'winter' ? 7 : 3));
    if (bite > 0) {
      for (const person of living(party.people)) wound(state, person, bite, 'the cold');
      chronicle(state, 'The fire went out in the night. We did not sleep.', 'grim');
    }
    // A night without fire in the dark half of the year is how people get
    // ill, and illness is what turns a bad winter into a fatal one.
    if (season === 'winter' || season === 'autumn') {
      coldNight(state, season === 'winter' ? 3 : 0);
    }
  }

  // Illness drags on everyone, not only the one carrying it.
  const ill = sickCount(state);
  if (ill > 0) party.morale = Math.max(0, party.morale - ill * 0.8);

  // A well-kept camp slowly restores nerve.
  if (!hungry && !cold) {
    party.morale = Math.min(100, party.morale + 1);
  }

  mendInjuries(state);
  // A party standing on its own doorstep is home; a party with nobody left
  // in it is simply gone.
  pruneExpedition(state);
  arriveHome(state);
  noteFirstWork(state, labour);
  telegraphWinter(state);
  // A year older, on the turn of the year, and then whether anybody was born.
  // Ageing first: the year that makes somebody old enough to bear is the year
  // they can.
  if (ageTheBand(state)) {
    chronicle(state, 'Another year on this coast, and every one of us a year older for it.', 'plain');
  }
  // A household made before a child can come of it: `maybeBirth` names a
  // father only where a tie exists, so this is what reopens that door for a
  // hall that has buried one.
  maybePair(state);
  maybeBirth(state);
  // And what is already in the hall goes round it, faster the more of them
  // there are under one roof.
  maybeSpread(state);
  // Whatever the band swore at the blót is watched here, every day of it.
  oathDay(state);
  // And the keel, if she is due.
  voyageDay(state);
  // The evening's reading of the sky. This is the whole weather item: a gale
  // announced the night before is a decision about tomorrow, and the same
  // gale arriving unannounced is a dice roll. Said once, at the end of the
  // day, in the log the player already reads for everything else.
  const omen = omenFor(state);
  if (omen) chronicle(state, omen, 'plain');

  // What the band makes of all this. Moods move first, then bad blood, then
  // whatever bad blood has been left to go bad.
  const grieving = state.party.people.some(
    (p) => !p.alive && p.diedOn !== undefined && state.day - p.diedOn <= GRIEF_DAYS,
  );
  const pressure = { hungry, cold, grieving };
  driftMoods(state, pressure);
  // Moods have just moved, so this is the moment somebody decides they have
  // had enough. Only hands ever do — the sworn are sworn.
  handsLeave(state);
  maybeRaid(state);
  // And the other direction, which the coast never had: somebody comes and
  // asks. Rolled beside the raid on purpose — the same world that sends men
  // over the ridge is the one that sends people up the strand.
  maybeJoin(state);
  // And the other door: a band with a name draws men who want a share of it.
  maybeSword(state);
  stirGrudges(state, pressure);
  feudsComeDue(state);
  // The coast forgets slowly, and only a little each day.
  driftStandings(state);
  // And it comes to look at anyone new on it.
  neighboursCallOn(state);
  // And it renders what is owed, if there is anybody on it to owe.
  renderTribute(state);

  // Season turned?
  if ((state.day - 1) % 24 === 0) {
    chronicle(state, seasonOpening(season), 'saga');
  }
  // Each thaw is now a milestone rather than the end of the run, so it is
  // marked as one — and it is the moment the Thing becomes worth thinking
  // about, so the band is told how many winters it has behind it.
  if (state.day === nextThaw(state.day - 1)) {
    const stood = wintersStood(state.day);
    state.party.morale = Math.min(100, state.party.morale + 10);
    chronicle(
      state,
      stood === 1
        ? 'We had lived through it. One winter behind us, and the country still ours to argue about.'
        : `${stood} winters stood. There were people on this coast now who had never known us not being here.`,
      'saga',
    );
  }
  // Telegraph the coming winter while there is still time to act.
  if (daysUntilNextWinter(state.day) === 8) {
    chronicle(state, 'The light was going early. Winter was eight days out, and our stores were what they were.', 'saga');
  }

  checkRunEnd(state, effects.forage);
  // A quarrel that has ripened waits for the road, not for the middle of a
  // fight — maybeFireFeud refuses while a battle or another card is up.
  if (!state.end) maybeFireFeud(state);
  return !state.end;
}

/** Days until the next winter closes in, whichever year it is. */
function daysUntilNextWinter(day: number): number {
  const winterStart = 2 * SEASON_LENGTH + 1;
  const thisYear = Math.floor((day - 1) / YEAR_LENGTH) * YEAR_LENGTH + winterStart;
  const start = day <= thisYear ? thisYear : thisYear + YEAR_LENGTH;
  return start - day;
}

/**
 * Hunger escalates rather than repeating itself day after day — and past the
 * first week it must never say the same sentence two days running, because
 * a starving band is exactly when the log is the only thing moving. The
 * plateau lines used to be one sentence for days six-through-eight and one
 * for everything after, and the stutter guard caught them the moment the
 * wider worlds made long hungry walks real.
 */
function hungerLine(streak: number): string {
  if (streak === 1) return 'We ate nothing that day, and felt it in the morning.';
  if (streak === 2) return 'A second day with nothing. Nobody spoke much.';
  if (streak === 3) return 'Three days empty. We boiled leather and drank the water off it.';
  if (streak <= 5) return `${streak} days without food. The walking had gone slow and strange.`;
  if (streak === 6) return 'We had stopped feeling hungry, which the old hands said was the bad sign.';
  if (streak === 7) return 'Somebody went down on the flat and took a long time getting up.';
  if (streak === 8) return 'The talk had gone out of the band. We walked in a silence with edges.';
  const late = [
    'There was nothing left to eat and nothing left to say about it.',
    'We chewed bark because mouths want work, and called it nothing.',
    'The days had stopped having names. There was only the next ridge.',
  ];
  return late[streak % late.length]!;
}

function seasonOpening(season: string): string {
  switch (season) {
    case 'autumn':
      return 'The first frost came, and the birds went south over us in their thousands.';
    case 'winter':
      return 'Winter closed its hand. Nothing grew, nothing moved, and the dark came at noon.';
    case 'spring':
      return 'The ice broke in the shallows. We had lived through it.';
    default:
      return 'The long days came, and the sun barely left the water.';
  }
}

export function checkRunEnd(state: GameState, _forage: number): void {
  const alive = living(state.party.people);

  // FIVE WINTERS USED TO END IT HERE. It does not any more.
  //
  // The old rule said "the run has to stop somewhere, and a band that has
  // stood five winters has said everything it is going to say", and it fired
  // whatever had been built — measured, day 457, jarldom or no jarldom. That
  // was right while there was one coast. But a landnám is a thing people did
  // more than once: a coast gives what it has, and then a household goes back
  // on the ship and takes land somewhere else.
  //
  // So this is a RECKONING now. The saga says the coast is finished; laying
  // it down and sailing on are both deeds the player takes. See sim/landnam.
  //
  // And it does NOT return: the endings below still apply. A band past the
  // reckoning can still starve and can still break, and an early return here
  // would have made five winters a kind of immortality.
  if (wintersStood(state.day) >= LONG_LIFE_WINTERS && alive.length > 0) {
    markReckoning(state);
  }

  if (alive.length === 0) {
    const starved = state.party.people.some((p) => p.fate === 'hunger');
    const froze = state.party.people.some((p) => p.fate === 'the cold');
    endRun(
      state,
      starved ? 'starved' : froze ? 'frozen' : 'slain',
      'No One Came Back',
      [`The warband ended on day ${state.day}.`, 'The sea keeps no account of who it carries out.'],
    );
    appendVerdict(state);
    return;
  }

  if (state.party.morale <= 0) {
    // WHY the band broke, which the ending used to guess at and get wrong.
    //
    // "Despair ends more runs than hunger, cold and steel put together" has
    // been in ROADMAP.md for three audits, and it sent three separate
    // sweeps of the morale levers — winter sickness, bereavement, kin grief
    // — all of which moved nothing at all. Measured properly it is a
    // labelling artifact: of thirty runs ending in despair, TWENTY-EIGHT
    // had an empty larder the day before, averaging one food between them.
    // They did not stop listening to each other. They had not eaten for
    // weeks, and the last thing to go was the wanting to.
    //
    // So a band that breaks with nothing in the store is told it starved,
    // because that is what happened and it is what they could have done
    // something about. Despair keeps the case it was always FOR: fed, and
    // out of heart anyway.
    const starving = state.party.food < foodPerDay(state);
    if (starving) {
      endRun(state, 'starved', 'The Stores Gave Out', [
        `By day ${state.day} there had been nothing in the store for a long time.`,
        'Nobody starved outright. They simply stopped getting up, one after another, and there was no reason to argue with them.',
      ]);
    } else {
      endRun(state, 'despair', 'The Band Broke', [
        `On day ${state.day} what was left of us stopped listening to each other.`,
        'There was food in the store. It made no difference to anybody.',
      ]);
    }
    appendVerdict(state);
  }
}

/**
 * Adds the winter's verdict to the ending. A colony that dies in the dark is
 * always told, on the last screen, that it was told in the autumn.
 */
function appendVerdict(state: GameState): void {
  const verdict = winterVerdict(state);
  if (verdict && state.end) state.end.lines.push(verdict);
}

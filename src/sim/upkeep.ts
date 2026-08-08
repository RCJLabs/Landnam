// What every passing day costs. This is the clock that kills you: mouths to
// feed, a fire to keep, and a season that stops giving.

import type { GameState, Person, RunEnd } from '../state/types';
import { effectsOn, nextThaw, seasonOf, wintersStood, SEASON_LENGTH, YEAR_LENGTH } from './calendar';
import { LONG_LIFE_WINTERS } from '../data/thing';
import { hardshipById } from '../data/hardship';
import { living } from './people';
import { stream } from '../rng';
import { noteFirstWork, shelterSaving, workTheDay } from './colony';
import { coldNight, sickCount, telegraphWinter, winterVerdict } from './winter';
import { driftMoods, feudsComeDue, maybeFireFeud, stirGrudges } from './minds';
import { arriveHome, pruneExpedition } from './expedition';
import { driftStandings } from './neighbours';
import { handsLeave } from './joining';
import { raidable, raidDifficulty, raidOdds } from './raid';
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
  const odds = raidOdds(state);
  if (odds <= 0) return;
  if (!stream(state.seed, 'events').derive(`raid:${state.day}`).chance(odds)) return;
  startRaid(state, raidDifficulty(state));
}

export function foodPerDay(state: GameState): number {
  return Math.max(1, Math.ceil(living(state.party.people).length / 2));
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
 * What tonight actually costs. Seeded, because how hard THIS winter is was
 * decided when the run was — see winterDepth in calendar.ts — and scaled by
 * how many are round the fire.
 */
export function firewoodPerNight(state: GameState): number {
  const heads = living(state.party.people).length;
  // The winter's bite, by how hard this country is. Applied HERE, on the
  // actual burn, and mirrored in winter.ts's plannedFirewood — the mark and
  // the fire have to move together or the mark is lying to the player.
  const base = effectsOn(state.day, state.seed).firewood * hardshipById(state.hardship).winter;
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
  if (person.health <= 0) {
    person.health = 0;
    person.alive = false;
    person.fate = fate;
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
  // Somebody who knows what they are doing gets more out of a day's rest.
  const care = 1 + bonus(state, 'mend');
  for (const person of state.party.people) {
    if (!person.alive) continue;
    person.injuries = person.injuries.filter((injury) => {
      if (frozen && injury.id.startsWith('ill_')) return true;
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

  state.day += 1;
  const party = state.party;
  const season = seasonOf(state.day);
  const effects = effectsOn(state.day);

  // Work comes before eating: what the day produced is available to the mouths
  // it has to feed that same evening.
  const labour = workTheDay(state);

  // Mouths.
  const needed = foodPerDay(state);
  const eaten = Math.min(party.food, needed);
  party.food -= eaten;
  const hungry = eaten < needed;

  // Fire. A roof of your own is worth firewood you do not have to cut.
  const wood = Math.max(0, firewoodPerNight(state) - shelterSaving(state));
  const burned = Math.min(party.firewood, wood);
  party.firewood -= burned;
  const cold = burned < wood;

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

  // What the band makes of all this. Moods move first, then bad blood, then
  // whatever bad blood has been left to go bad.
  const grieving = state.party.people.some(
    (p) => !p.alive && p.diedOn !== undefined && state.day - p.diedOn <= 3,
  );
  const pressure = { hungry, cold, grieving };
  driftMoods(state, pressure);
  // Moods have just moved, so this is the moment somebody decides they have
  // had enough. Only hands ever do — the sworn are sworn.
  handsLeave(state);
  maybeRaid(state);
  stirGrudges(state, pressure);
  feudsComeDue(state);
  // The coast forgets slowly, and only a little each day.
  driftStandings(state);

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

  // A whole life on that coast, without ever being proclaimed anything. Not a
  // failure — but the run has to stop somewhere, and a band that has stood
  // five winters has said everything it is going to say.
  if (wintersStood(state.day) >= LONG_LIFE_WINTERS && alive.length > 0) {
    const home = state.settlement;
    endRun(state, 'survived', home ? `${home.name} Endured` : 'We Held the Land', [
      `${alive.length} of ${state.party.people.length} were still there after ${wintersStood(state.day)} winters.`,
      home
        ? `${home.name} was founded on day ${home.foundedOn} and never fell.`
        : 'We never set a post in the ground. We wintered where we stood, year on year.',
      'No title, and no need of one.',
    ]);
    appendVerdict(state);
    return;
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
    endRun(state, 'despair', 'The Band Broke', [
      `On day ${state.day} what was left of us stopped listening to each other.`,
      'Some walked inland. Some walked into the water. None of it was a plan.',
    ]);
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

// Somebody else wants this island.
//
// Every clock in the game was the weather's: winter came, stores ran down,
// and the land itself waited politely while the band decided what to do with
// it. Nothing in the world had an ambition of its own. So a second
// landnámsmaðr comes ashore the same spring you do, with the same six posts
// in the same kind of boat, and takes ground on a schedule that does not
// care whether you are ready.
//
// The whole mechanism is deliberately small and deterministic: they settle on
// a known day, and from then on they claim one hex at a time, always the best
// unclaimed ground nearest their hall. No hidden simulation, no second colony
// to balance — just a hand closing on the map, which is enough to make a
// dawdling band pay for dawdling.

import { stream } from '../rng';
import { MEN, BYNAMES } from '../data/names';
import { NAME_ROOTS, NAME_SUFFIX } from '../data/sites';
import { terrainDef } from '../data/terrain';
import type { GameState, Rival } from '../state/types';
import { chronicle } from './saga';
import { ROUTE_STOPS, neighbourStops, stopAt } from './route';
import { standingAt } from './coast';
import { atSea } from './road';
import { BARTER_FOOD, CLAN_COUNT, CLAN_ELBOW, CLAN_MAX_GAP, clanKind } from '../data/clans';
import { bestStat } from './people';
import { checkOdds } from './events';

/** How far from our landing theirs is. Far enough that we do not start in their yard. */
export const RIVAL_APART = 7;

/** The day their posts go in. Ours can go in sooner; theirs never slips. */
export const RIVAL_SETTLES = 9;

/** Days between one claim and the next. */
export const CLAIM_EVERY = 11;

/** How far their hand can reach from the hall. A neighbour, not an empire. */
export const CLAIM_REACH = 4;

/** Ground nobody may put posts in because they are standing on it. */
export const RIVAL_ELBOW = 2;

/**
 * How far his hand reaches from the hall, in STOPS.
 *
 * Not `CLAIM_REACH` read as stops, and the difference is the whole of this
 * conversion. On the hex map a reach of four covers 61 of 1139 hexes — five
 * per cent, which is what "a neighbour, not an empire" was calibrated
 * against. Four stops of 26 is thirty-five per cent, which is an empire.
 *
 * Three, so he holds seven stretches at full spread: about a quarter of the
 * coast, more than one of the older clans and less than the coast itself,
 * which is right for the one man on it who is doing exactly what you are
 * doing.
 */
export const CLAIM_REACH_STOPS = 3;

/**
 * Days between one claim and the next, on a line.
 *
 * The number that had to move, and the measurement says why. What makes the
 * rival a CLOCK rather than a fact is that on the hex map he never finishes:
 * 61 hexes at one every eleven days is 680, longer than any saga, so the hand
 * is still closing at the last day the band plays. On a line the same eleven
 * days fills his whole reach by day 75 and he is scenery for the rest of the
 * run.
 *
 * Preserving the property by widening the reach would take the whole coast.
 * So the interval gives instead, which is the honest lever: on a line one
 * claim is worth 1/26 of the country against the hex map's 1/1139, and a
 * thing worth forty times more should not come forty times as often.
 *
 * Measured over 150 coasts with the flag on, which is the only way to
 * measure it — the first probe read `claimStops` while the hex path was
 * filling `claims` and reported him completely inert, which he is not. He
 * ends up holding a median of six stretches of a possible seven, never
 * fewer than three, and his last claim lands on a median of day 309. He is
 * still taking ground past day 200 on 135 coasts of 150, and past day 300 on
 * 90 of them — the hand still closing when a long saga ends, which is the
 * whole point of him.
 */
export const CLAIM_EVERY_STOPS = 60;

/**
 * How many stretches of coast lie between his hall and ours.
 *
 * `RIVAL_APART` is seven, and it means "far enough that we do not start in
 * their yard". Read as DAYS on a line that is a median of two stops, and
 * measured over 200 coasts his elbow alone covers the landing on 24 of them
 * — the exact failure `neighbourStops` needed a floor to avoid. So it is
 * read as what it MEANT: far enough that neither his elbow nor his reach can
 * ever touch the sand we were put down on.
 */
export const RIVAL_APART_STOPS = RIVAL_ELBOW + CLAIM_REACH_STOPS + 1;

/**
 * How much room his FENCES keep from somebody else's stretch of coast.
 *
 * One, not `RIVAL_ELBOW`, and it is the third time this conversion has caught
 * a hex-scaled distance being over-read onto a coarser grid. Two hexes of
 * 1139 is a courtesy; two stops around each of four clans blocks twelve of
 * twenty-six, and measured across the sample it left him holding three
 * stretches of a possible seven — a hand that closes twice and jams.
 *
 * A fence is also not a hall. `RIVAL_ELBOW` still governs where POSTS may go
 * — ours and his — because that is a bigger commitment than a fence line,
 * and `CLAN_ELBOW` already answers the same question from the clans' side.
 * This is only "do not build right on top of somebody", which on a line is
 * their own stretch and no further.
 *
 * It leaves the older clans CONTAINING him, which is the better game and was
 * not designed: he spreads from what he holds, so a stretch he may not fence
 * is a wall his block cannot grow past. That containment is why he holds a
 * median of six stretches rather than the full seven, and why the worst
 * coast leaves him three.
 */
export const CLAIM_CLEAR_STOPS = 1;

/**
 * Where he comes ashore.
 *
 * His taste is ours — he is doing the same thing we are, which is what makes
 * him a rival rather than scenery — read off the country's own forage rather
 * than off a site report, because a report was a thing you built from
 * neighbouring hexes and a stretch of coast has none. Nearer wins ties: he
 * came ashore the same spring in the same kind of boat, not after a season
 * of prospecting.
 *
 * He also keeps out of the older clans' yards. On 1872 hexes two systems
 * placing independently never collided; on 26 stops they would collide
 * constantly, and a hall inside a native camp is not a rival, it is a bug.
 */
export function rivalStopFor(seed: string): number | null {
  const clans = neighbourStops(seed, CLAN_COUNT, CLAN_MAX_GAP, CLAN_ELBOW);
  let best: { stop: number; score: number } | null = null;
  for (let s = RIVAL_APART_STOPS; s < ROUTE_STOPS; s += 1) {
    if (clans.some((c) => Math.abs(c - s) < CLAN_ELBOW)) continue;
    const score = terrainDef(stopAt(seed, s).country).forage * 100 - s;
    if (!best || score > best.score) best = { stop: s, score };
  }
  return best ? best.stop : null;
}

/** The band that is not ours, made at the start of a run. */
export function makeRival(seed: string): Rival | null {
  const stop = rivalStopFor(seed);
  if (stop === null) return null;
  const rng = stream(seed, 'worldgen').derive('rival');
  // The draws happen in the order they always did, so he is the same man he
  // was on the map: name, byname, hall root, hall suffix.
  const suffix = rng.pick(NAME_SUFFIX.soil);
  return {
    leader: `${rng.pick(MEN)} ${rng.pick(BYNAMES)}`,
    hall: `${rng.pick(NAME_ROOTS)}${suffix}`,
    stop,
    claimStops: [stop],
    lastClaim: RIVAL_SETTLES,
    met: false,
    told: false,
  };
}

/** Every stretch of coast he holds. */
export function rivalStops(state: GameState): number[] {
  return state.rival?.claimStops ?? [];
}

/** True once their posts are in — before that they are a boat somewhere. */
export function rivalSettled(state: GameState): boolean {
  return !!state.rival && state.day >= RIVAL_SETTLES;
}

/** Ground they have taken. */
export function rivalHolds(state: GameState): boolean {
  if (!rivalSettled(state)) return false;
  return rivalStops(state).includes(standingAt(state));
}

/**
 * Ground we cannot put posts in because of them — their claims and the elbow
 * room around their hall, the same courtesy the older clans get.
 */
export function rivalBlocks(state: GameState): boolean {
  if (!rivalSettled(state)) return false;
  const rival = state.rival!;
  if (rival.stop === undefined) return false;
  const here = standingAt(state);
  if (Math.abs(rival.stop - here) < RIVAL_ELBOW) return true;
  return (rival.claimStops ?? []).includes(here);
}

/**
 * The next stretch of coast his hand closes on.
 *
 * The best ground he can reach that nobody holds, touching what he already
 * holds so the claim is a block of coast rather than scattered flags, and
 * never on ours or an older clan's. "Best" is the country's forage: a stretch
 * of coast has no ring of ground around it to build a site report out of.
 */
export function nextClaimStop(state: GameState): number | null {
  const rival = state.rival;
  if (!rival || rival.stop === undefined) return null;
  const held = rival.claimStops ?? [];
  const home = state.settlement?.stop;
  let best: { stop: number; score: number } | null = null;
  for (let s = Math.max(0, rival.stop - CLAIM_REACH_STOPS);
       s <= Math.min(ROUTE_STOPS - 1, rival.stop + CLAIM_REACH_STOPS);
       s += 1) {
    if (held.includes(s)) continue;
    if (home !== undefined && Math.abs(home - s) < CLAIM_CLEAR_STOPS) continue;
    if (state.neighbours.some(
      (n) => n.stop !== undefined && Math.abs(n.stop - s) < CLAIM_CLEAR_STOPS,
    )) {
      continue;
    }
    if (!held.includes(s - 1) && !held.includes(s + 1)) continue;
    const score = terrainDef(stopAt(state.seed, s).country).forage * 100
      - Math.abs(rival.stop - s);
    if (!best || score > best.score) best = { stop: s, score };
  }
  return best ? best.stop : null;
}

/**
 * One day of somebody else's ambition. Called from `passDay`, so it happens
 * on every day the band spends however it spends it — which is the point: the
 * cost of a slow week is that the map is smaller at the end of it.
 */
export function rivalDay(state: GameState): void {
  const rival = state.rival;
  if (!rival || !rivalSettled(state)) return;

  // Their landing, told once, when it is first true.
  if (!rival.told) {
    rival.told = true;
    chronicle(
      state,
      `Word came that ${rival.leader} had put his posts in at ${rival.hall}, `
        + 'a few days up the coast from us. We were not the only boat that spring.',
      'grim',
    );
  }

  if (state.day - rival.lastClaim < CLAIM_EVERY_STOPS) return;
  const stop = nextClaimStop(state);
  if (stop === null) return;
  (rival.claimStops ??= []).push(stop);
  rival.claimStops.sort((a, b) => a - b);
  rival.lastClaim = state.day;
  // Only chronicled once we know who they are — a claim on ground we have
  // never seen is not news the band could have had.
  if (rival.met) {
    chronicle(
      state,
      `${rival.leader}'s people had put up a fence on ground we had walked. `
        + `${rival.hall} is getting bigger.`,
      'grim',
    );
  }
}

/** Called when sight falls on their hall: the first time we know for certain. */
export function meetRival(state: GameState): void {
  const rival = state.rival;
  if (!rival || rival.met) return;
  if (rival.stop === undefined) return;
  // The stretch he lives on or either side of it. Wider than a neighbour's
  // yard on purpose and for a reason the fiction already gives: he has
  // "smoke going up and his fences already out around it", which is the one
  // thing on this coast you see from the next headland.
  if (Math.abs(rival.stop - standingAt(state)) > 1) return;
  rival.met = true;
  // For the ending to name (9.10). Recorded here rather than derived later
  // because nothing else in the save remembers when sight first fell.
  rival.metOn = state.day;
  chronicle(
    state,
    `We came in sight of ${rival.hall}. ${rival.leader}'s hall, smoke going up, `
      + 'and his fences already out around it. This island has two landnams on it.',
    'grim',
  );
}

// --- 12.16: he can be answered ---
//
// He was a man you could see and not speak to. `PROBE 12.11` put a number on
// how much of the run that is: he is met in a third of sagas, and until this
// there was no verb in the whole `Action` union that named him — his single
// reader in `src/` was `foundBlocker`, saying no.
//
// THIS IS NOT 12.11. That item wanted hands for him because he was thought to
// cost more than he gives, and the re-take (2026-09-07) closed that: he is
// the reason posts are refused in 3% of sagas, and paired he saved nought and
// killed three of a hundred and twenty. Nothing here is meant to reduce a
// cost. It is meant to answer a man.
//
// AND IT SIMULATES NOTHING BEHIND HIM. The 2026-08-26 decision — "there is no
// second colony being simulated behind him and there is not meant to be" —
// stands exactly as it did. He is still a name, a hall, and the ground he has
// taken. What is new is that he has an opinion of us, and it can move.

/**
 * Where his opinion of us starts.
 *
 * The clan opening, taken from the same place a Norse neighbour's is rather
 * than respelled here, and its own comment is the argument: "Another Norse
 * hall on the same coast is a rival before it is anything." That is a
 * description of this man.
 */
export const RIVAL_OPENING = clanKind('clan').opening;

/**
 * What you carry to a man's hall.
 *
 * `BARTER_FOOD`, because it is the same act — stores carried in to somebody
 * else's fire — and a second number for it would be a second number to keep
 * in step with the first.
 */
export const GUEST_GIFT = BARTER_FOOD;

/** Days before he will hear us again. He is up the coast, not next door. */
export const SPEAK_EVERY = 12;

/** 2d6 against this, with what the speaker is worth added. */
export const SPEAK_DC = 9;

/** What a good hearing and a bad one are worth. */
export const SPEAK_WELL = 14;
export const SPEAK_ILL = -8;

/**
 * The standing at which he will give ground back.
 *
 * From `RIVAL_OPENING` that is three good hearings, and at `SPEAK_EVERY` days
 * apart the earliest a fence can open is about five weeks of deliberately
 * going to see him. THESE FIVE NUMBERS ARE A FIRST CUT, not a measurement:
 * they are chosen so the thing is reachable and not free, and the sweep that
 * prices them is 12.16's own, not something this comment can stand in for.
 */
export const RIVAL_YIELDS = 30;

/** His opinion of us, with the opening for a save that never had one. */
export function rivalStanding(state: GameState): number {
  return state.rival?.standing ?? RIVAL_OPENING;
}

/**
 * Move it, clamped the way a neighbour's is.
 *
 * Deliberately the same shape as `shiftStanding` rather than a call to it:
 * that one looks a neighbour up by id in `state.neighbours`, and he is not in
 * that array — he is a person with a schedule, not one of the coast's clans.
 * What must not differ is the SCALE, so the clamp is the same and so is the
 * opening, and `standingFor` reads his number the same way it reads theirs.
 */
export function shiftRivalStanding(state: GameState, delta: number): void {
  const rival = state.rival;
  if (!rival) return;
  rival.standing = Math.max(-100, Math.min(100, rivalStanding(state) + delta));
}

/** True when his hall is close enough to walk up to. */
export function rivalHere(state: GameState): boolean {
  const rival = state.rival;
  if (!rival || !rival.met || rival.stop === undefined) return false;
  if (!rivalSettled(state)) return false;
  // The same window `meetRival` uses to say sight has fallen on the hall: if
  // you can see the smoke you can walk to the door, and the day this costs
  // IS that walk.
  return Math.abs(rival.stop - standingAt(state)) <= 1;
}

export type SpeakBlock = 'nowhere' | 'atsea' | 'soon' | 'stores';

export const SPEAK_REASON: Record<SpeakBlock, string> = {
  nowhere: 'His hall is not in sight of here.',
  atsea: 'Not from the water.',
  soon: 'We were there lately. Going back again this soon would say the wrong thing.',
  stores: `We have nothing like ${GUEST_GIFT} to carry in, and you do not come empty-handed.`,
};

/** Days before he will hear us again, or 0. */
export function speakCooldown(state: GameState): number {
  const last = state.rival?.spokeOn;
  if (last === undefined) return 0;
  return Math.max(0, SPEAK_EVERY - (state.day - last));
}

export function speakBlocker(state: GameState): SpeakBlock | null {
  if (!rivalHere(state)) return 'nowhere';
  if (atSea(state)) return 'atsea';
  if (speakCooldown(state) > 0) return 'soon';
  if (state.party.food < GUEST_GIFT) return 'stores';
  return null;
}

/** The odds, shown before it is tapped and never after. */
export function speakOdds(state: GameState): number {
  return checkOdds(speakWorth(state), SPEAK_DC);
}

/**
 * What the band brings to the conversation.
 *
 * The best spirit among whoever is standing here — `callThing` picks its
 * speaker the same way — and a jarl is heard differently from a man with six
 * posts in the ground. A band that has been sacking its way up the coast is
 * heard worse, and that is the one place in this file where what the player
 * DID reaches him.
 */
export function speakWorth(state: GameState): number {
  const spirit = bestStat(state.party.people, 'spirit');
  return Math.floor(spirit / 2) + (state.jarl ? 2 : 0) - Math.floor(state.tally.sackings / 2);
}

/** The sheet's own words for it, composed here so a test can hold them. */
export function speakBlurb(state: GameState): string {
  const rival = state.rival;
  if (!rival) return '';
  const odds = Math.round(speakOdds(state) * 100);
  const standing = rivalStanding(state);
  const yields = standing >= RIVAL_YIELDS ? '' : ` He would want a great deal more of us before he gave any of it back.`;
  return `${odds}% that he hears us out · costs a day and ${GUEST_GIFT} of food.`
    + `${yields}`;
}

/**
 * One hearing. Mutates; callers hold a clone.
 *
 * The gift is eaten either way — that is the cost of asking, and it is what
 * makes going at bad odds a decision rather than a free reroll. Same shape as
 * the Thing's feast, and for the same reason.
 */
export function speakToRival(state: GameState): boolean {
  if (speakBlocker(state) !== null) return false;
  const rival = state.rival!;
  state.party.food = Math.max(0, state.party.food - GUEST_GIFT);
  rival.spokeOn = state.day;

  const rng = stream(state.seed, 'events').derive(`rival:speak:${state.day}`);
  const heard = rng.roll(2, 6) + speakWorth(state) >= SPEAK_DC;
  shiftRivalStanding(state, heard ? SPEAK_WELL : SPEAK_ILL);

  if (!heard) {
    chronicle(
      state,
      `${rival.leader} took what we brought and heard us out standing, in the `
        + 'doorway, and we walked back the way we came.',
      'grim',
    );
    return true;
  }

  chronicle(
    state,
    `We ate at ${rival.hall} and ${rival.leader} talked about the winter coming. `
      + 'Two landnams on one island, and neither of us going anywhere.',
    'good',
  );

  // AND THE FENCE CAN OPEN. The one thing he does that a player could never
  // answer: ground he has closed his hand on. He gives back the stretch
  // nearest our hall, because that is the one that was in the way.
  if (rivalStanding(state) >= RIVAL_YIELDS) yieldNearest(state);
  return true;
}

/**
 * He gives up the claim nearest our hall, if he holds one that is not his own
 * hall's stretch. Never the hall: a man does not hand over the ground his
 * posts are in, and taking that would be the second colony this refuses to be.
 */
function yieldNearest(state: GameState): boolean {
  const rival = state.rival;
  if (!rival || rival.stop === undefined) return false;
  const held = (rival.claimStops ?? []).filter((s) => s !== rival.stop);
  if (held.length === 0) return false;
  const from = state.settlement?.stop ?? standingAt(state);
  const give = held.reduce((best, s) => (Math.abs(s - from) < Math.abs(best - from) ? s : best));
  rival.claimStops = (rival.claimStops ?? []).filter((s) => s !== give);
  chronicle(
    state,
    `${rival.leader} said the ${terrainDef(stopAt(state.seed, give).country).name.toLowerCase()} `
      + 'up the coast was more trouble to him than it was worth, and took his '
      + 'fence off it.',
    'saga',
    true,
  );
  return true;
}

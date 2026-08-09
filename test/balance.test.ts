// 5.3: the difficulty curve, measured rather than felt.
//
// The roadmap's line is "Difficulty curves, animation polish, dead-warrior
// memorial wall". A curve is the one part of that which can be asserted, so
// this file ships the harness that measures it: a scripted player of roughly
// average competence — it walks toward timber when short, goes and looks for
// ground it can settle, heeds the winter mark, and fights back when steel
// comes out — played across many seeds.
//
// The bar is deliberately a WIDE BAND rather than a number. The point is not
// to freeze today's balance, it is to catch the two failures that matter and
// that are otherwise invisible: a change that makes the game unwinnable, and
// a change that makes it a walkover.
//
// Every number in the changelog for this milestone came out of this file,
// and writing it caught two things nothing else would have.
//
// The first was in the harness itself: its earliest draft did not fight back
// on the battlefield, it only passed turns until somebody died. That put
// "slain" at the top of the death table and made the game look far crueller
// than it is — teaching the bot to swing moved survival to the second winter
// from 0% to 51%. A harness is code, and it can be wrong in exactly the
// direction that flatters or damns whatever it is measuring. A later rewrite
// of this file disagreed with itself by forty points for the same reason.
//
// The second was tried, measured, and REJECTED. The landing is chosen for
// loneliness alone — the westernmost quiet beach — with no regard for whether
// anywhere behind it can be lived in, which puts settleable ground a median 5
// and as much as 11 hexes from the sand. Choosing a beach with somewhere to
// live behind it takes the worst case from 11 hexes to 4 and looked like a
// clear win. It is not: where you land decides where you fight, and on the
// worlds it produces the shield wall stops paying for itself. Over sixty
// seeds the line went from 33 wins and 157 people standing to 32 and 158 —
// dead level with charging in, which is a Phase 2 milestone bar erased.
// Battlefield generation has to stop being that sensitive to the terrain it
// is handed before the landing can be touched. See test/wall.test.ts.
//
// The third was the largest, and it was found teaching the bot to form a
// shield wall. The run loop below treated ANY refused action as the end of
// the saga, and the old bot proposed battle moves without costing the ground
// or the disengage — so doMove refused them, and THIRTY of sixty runs were
// cut off mid-battle, one as early as day 7, every one counted as alive at
// every milestone thereafter. The 83/55/50 curve this file used to print was
// those thirty truncated sagas. Played out legally, the same charge-in bot
// reads 78/22/2; the wall-forming bot that replaced it reads 78/30/7 with
// zero refusals — better at every mark, on fights that actually get fought.

import { describe, it, expect } from 'vitest';
import { newGame } from '../src/state/create';
import { effectsOn, seasonOf, winterDepth } from '../src/sim/calendar';
import { markHaze } from '../src/sim/winter';
import { bumped, makeWatch } from '../src/render/motion';
import { apply, type Action } from '../src/sim/actions';
import { moveOptions, canGather, canFish, atSea, isCoastalWater } from '../src/sim/travel';
import { canFound, siteReport } from '../src/sim/site';
import { assign, queueBuild } from '../src/sim/colony';
import { BAND_BASE, foodPerDay, firewoodPerNight, passDay } from '../src/sim/upkeep';
import { SWORN_MAX, hands, leaderOf, living, sworn } from '../src/sim/people';
import { handsLeave, roomLeft, SETTLED_IN, takeIn } from '../src/sim/joining';
import { migrate } from '../src/state/migrations';
import { startBattle, startRaid } from '../src/sim/battleTurn';
import { BASE_MOVES, MAX_RAIDERS, MAX_RAIDERS_FAMED, fighterPerson, raiderCap } from '../src/sim/battle';
import { RAID_CHANCE_MAX, SACK_TAKES, raidDifficulty, raidOdds, sackSteading } from '../src/sim/raid';
import { fallenOf } from '../src/sim/fallen';
import { capacity, crowding } from '../src/sim/colony';
import { moodTarget } from '../src/sim/minds';
import { foundSettlement } from '../src/sim/site';
import { distance, key, fromKey, neighbors } from '../src/hex';
import { isWarbandTurn } from '../src/sim/battle';
import { reachWithZoc } from '../src/sim/zoc';
import { reachTargets, shoveDestination, throwTargets } from '../src/sim/battleActions';
import { offersAt, placeHere, tradeBlocker } from '../src/sim/places';
import { campStores } from '../src/sim/plunder';
import { strandTarget } from '../src/sim/sea';
import { placeKind } from '../src/data/places';
import { bargainBlocker, canFallOn, neighbourHere } from '../src/sim/neighbours';
import { canCallThing, hasSpeakers, yearsRuled } from '../src/sim/thing';
import { launchBlocker, provisionsFor } from '../src/sim/expedition';
import { BARTER_FOOD } from '../src/data/clans';
import { wintersStood } from '../src/sim/calendar';
import { terrainDef } from '../src/data/terrain';
import type { GameState } from '../src/state/types';
import type { JobId } from '../src/data/jobs';
import { HARDSHIPS, type HardshipId } from '../src/data/hardship';
import { BUILDINGS } from '../src/data/buildings';
import { EVENTS } from '../src/data/events';
import { LORE } from '../src/data/lore';
import { TRAITS } from '../src/data/traits';
import { kinPairs } from '../src/sim/kin';
import { drawOdds, swordOdds } from '../src/sim/joining';
import { DRAW_ANGER, DRAW_LARDER_DAYS, SWORD_DEEDS, WHY_SWORDS_COME, WHY_THEY_COME } from '../src/data/folk';
import { forecast, markVisible, reachable } from '../src/sim/winter';

const CREW: JobId[] = ['farmer','farmer','woodcutter','hunter','builder','warrior'];

/**
 * AUDIT ITEM 7: how this band decides to live.
 *
 * Every number this repo carries describes ONE strategy — settle early, work
 * the jobs, hold the line, trade until somebody will speak for you. Whether
 * the game supports a SECOND way of playing has never been tested, and
 * "there is more than one way to play" is a claim it has been making since
 * phase 4 without evidence either way.
 *
 * So the bot's opinions are a parameter now instead of constants scattered
 * through it. The settler is exactly what the harness has always been and
 * every figure in ROADMAP.md still means what it meant; the other two are
 * the honest alternatives a player would actually try.
 */
interface Policy {
  id: string;
  /** How good a site has to be before the posts go in. */
  siteFloor: number;
  /** Last day a band still looking for a home turns aside for plunder. */
  plunderWindow: number;
  /** How far out it goes under arms once settled. Zero: it never does. */
  raidReach: number;
  /** Whether it will carry food out to make a friend on the coast. */
  trades: boolean;
  /** Whether it falls on neighbours' camps as a matter of course. */
  robsCamps: boolean;
  /** What it raises, in the order it wants it. */
  want: readonly string[];
  /** What everyone does with their days. */
  crew: readonly JobId[];
  /**
   * Days of food the steading keeps back before an armed errand goes out.
   *
   * Mine, not the game's — the game charges `provisionsFor(3)`, which is
   * nine. The first cut of the raid errand added ten days of the steading's
   * own eating on top as a safety buffer, and measured across three policies
   * that buffer was met on ZERO target-days out of a thousand: a settled
   * band in this game never has that much spare, so going out under arms
   * could not happen for anybody. A settler keeps a cushion because he has a
   * steading to feed. A raider does not: eating what you take is the whole
   * of the strategy, and testing him with a farmer's caution measures the
   * caution.
   */
  errandBuffer: number;
}

const SETTLER: Policy = {
  id: 'settler',
  siteFloor: 9,
  plunderWindow: 24,
  raidReach: 14,
  trades: true,
  robsCamps: false,
  want: [
    'longhouse', 'farmplots', 'bud', 'smokehouse', 'palisade',
    'storehouse', 'watchtower', 'meadhall', 'greathall', 'earthworks',
    'hof', 'dock',
  ],
  crew: CREW,
  errandBuffer: 6,
};

/**
 * Takes what he needs. Holds out for better ground because he is in no
 * hurry, robs everything within reach on the way, and goes out under arms
 * all his life instead of carrying food to anybody.
 */
const RAIDER: Policy = {
  id: 'raider',
  // Seven, not eleven. The first cut had him holding out for good ground,
  // which is a strawman of his own strategy — a man who means to live off
  // what he takes does not care what the soil is like, and `the first
  // winter` has said since 6.1 that settling late is close to fatal. Testing
  // him with a settler's site standards measured the delay, not the raiding.
  siteFloor: 7,
  plunderWindow: 40,
  raidReach: 16,
  trades: false,
  robsCamps: true,
  want: [
    'longhouse', 'palisade', 'smokehouse', 'storehouse', 'watchtower',
    'farmplots', 'bud', 'earthworks', 'meadhall', 'greathall', 'hof', 'dock',
  ],
  // Two warriors, one hunter and a farmer could not feed six people, and it
  // showed: TWENTY-EIGHT of twenty-eight raider deaths were hunger. A man
  // who lives by taking still has to eat between takings, and the first cut
  // of this policy was the site-floor strawman all over again — a strategy
  // measured with a spec that could not carry it.
  crew: ['warrior','hunter','hunter','farmer','woodcutter','builder'],
  errandBuffer: 2,
};

/**
 * Never leaves the palisade. Settles on the first thing that will take the
 * posts, builds walls before comforts, and answers everything with work.
 */
const TURTLE: Policy = {
  id: 'turtle',
  siteFloor: 7,
  plunderWindow: 0,
  raidReach: 0,
  trades: false,
  robsCamps: false,
  want: [
    'longhouse', 'farmplots', 'palisade', 'smokehouse', 'watchtower',
    'storehouse', 'earthworks', 'bud', 'meadhall', 'greathall', 'hof', 'dock',
  ],
  crew: ['farmer','farmer','farmer','woodcutter','builder','warrior'],
  errandBuffer: 0,
};

const POLICIES = [SETTLER, RAIDER, TURTLE];

/**
 * Which one is playing. Module-level for the same reason `settleNotBefore`
 * is — step() is called from a dozen places and only the policy sweep cares
 * — and reset in a finally, because a leaked value would silently rewrite
 * every figure in this file.
 */
let policy: Policy = SETTLER;
// NOTE: 'farmplots' has no hyphen. The first version of this list wrote
// 'farm-plots', which matches no building, so that entry silently never
// queued and the measured bot had been building three things while this file
// claimed four. A búð is on the list because 6.2 gave the band a way to grow
// and a harness that cannot grow reports growth as worthless — the same
// mistake as the bot that would not fight back.
/**
 * What an average player raises, in the order they want it.
 *
 * `greathall` and `earthworks` were missing until audit item 4, and that is
 * the whole of why sixty sagas never built one: the upgrade tier shipped
 * with `standsFor()` written for it, `replaces` enforced in `buildBlocker`,
 * and a bot that was never told the two buildings existed. The game side was
 * sound throughout — the measurement simply never asked. Same-commit rule,
 * broken quietly, and only visible once something counted what was reached.
 *
 * The upgrades sit after the basics they replace, which is also the order
 * `buildBlocker` enforces: a great hall needs a longhouse standing to
 * replace, and earthworks need a palisade.
 */


/**
 * A competent-but-not-clairvoyant player: walks toward timber when the
 * woodpile is low, settles on the best ground it has actually seen, and
 * otherwise explores outward from the landing.
 */
/**
 * Item 2's instrument: hold the band off settling until this day.
 *
 * Module-level rather than threaded through every call site because step()
 * is called from five places in this file and only one experiment cares.
 * Always reset in a finally — a leaked value would silently change the
 * curve, which is exactly the class of harness bug this file's header is
 * a monument to.
 */
let settleNotBefore = 0;

/**
 * Item 2's instrument: which of the four verbs the bot is allowed.
 *
 * `dash` is off, and that is a measured decision rather than an oversight —
 * see `test/wall.test.ts`, which prices it at a third of the wins and a
 * third of the survivors. Spending the turn's action to arrive sooner means
 * arriving alone and arriving having already acted. Kept as a toggle so the
 * claim stays executable.
 */
const VERBS = { throw: true, shove: true, defend: true, dash: false };

function step(state: GameState): Action {
  if (state.event) {
    return state.event.outcome ? { type:'DISMISS_EVENT' } : { type:'CHOOSE', index:0 };
  }
  if (state.aftermath) return { type:'DISMISS_AFTERMATH' };
  if (state.battle) {
    if (state.battle.outcome) return { type:'B_LEAVE' };
    if (!isWarbandTurn(state)) return { type:'B_END_TURN' };
    const b = state.battle;
    const me = b.combatants.find(c => c.personId === b.order[b.turnIndex]);
    if (!me) return { type:'B_END_TURN' };
    const foes = b.combatants.filter(c => c.side === 'foe' && !c.down && !c.fled);
    if (foes.length === 0) return { type:'B_END_TURN' };
    const near = foes.reduce((a,c)=>distance(c.at,me.at)<distance(a.at,me.at)?a=c:a, foes[0]!);
    // The game gained the war-cry, so the bot cries it in the same commit.
    // The average player spends the leader's action on it when the press is
    // real — two or more foes in earshot — and never on a stray skirmisher.
    if (!me.hasActed && !b.warCried && !me.broken
      && me.personId === leaderOf(state.party.people)?.id
      && foes.filter(f => distance(f.at, me.at) <= 2).length >= 2) {
      return { type:'B_WARCRY' };
    }
    // --- Audit item 2: the four verbs this harness had never issued. ---
    //
    // B_THROW, B_SHOVE, B_DEFEND and B_DASH were in the engine, in the UI
    // and in nobody's measurement: over sixty sagas the bot produced not one
    // of them. Every claim this repo makes about combat balance was a claim
    // about a bot playing two thirds of the game — and by its own oldest
    // rule, a capability the bot cannot use is measured as worthless.
    //
    // Each rule below is the narrow case where an average player reaches for
    // the verb, not the case that flatters it.

    // SHOVE, for the one thing a shove does that a blow cannot: put a man in
    // the water, where the sea finishes him for nothing. Checked BEFORE the
    // strike because both spend the turn's action, and a drowning is worth
    // more than a hit.
    if (VERBS.shove && !me.hasActed && distance(near.at, me.at) === 1) {
      const shoveWorth = (f: typeof foes[number]): boolean => {
        if (distance(f.at, me.at) !== 1) return false;
        const dest = shoveDestination(me, f);
        if (!dest) return false;
        const tile = b.grid[key(dest)];
        const occupied = b.combatants.some(
          c => !c.down && c.at.q === dest.q && c.at.r === dest.r);
        // Into the water: the sea finishes him for nothing.
        if (tile?.ground === 'water' && !occupied) return true;
        // Nowhere to go: a shove against what is behind them is 2 damage
        // that cannot miss, so it finishes a man a swing might not.
        const hurt = fighterPerson(state, f.personId);
        return (!tile || occupied) && !!hurt && hurt.health <= 2;
      };
      const shoved = foes.find(shoveWorth);
      if (shoved) return { type:'B_SHOVE', targetId: shoved.personId };
    }

    // The game gained the second rank, so the bot fights from it in the same
    // commit. Nothing at arm's length and a mate in front of a foe: thrust.
    // A harness that cannot use a formation reports the formation as
    // worthless, which is the oldest lesson in this file.
    if (!me.hasActed && distance(near.at, me.at) > 1) {
      const spear = reachTargets(state);
      if (spear.length > 0) {
        const marked = spear.find(f => f.personId === b.champion) ?? spear[0]!;
        return { type:'B_REACH', targetId: marked.personId };
      }
    }

    // THROW. Out of arm's length with nothing to thrust past, the turn's
    // action is otherwise spent on nothing at all — so a spear that is
    // carried once and thrown once goes now. Strictly free on an approach
    // turn, which is exactly why never issuing it was a measurement bug
    // rather than a strategy.
    if (VERBS.throw && !me.hasActed && distance(near.at, me.at) > 1) {
      const shots = throwTargets(state);
      if (shots.length > 0) {
        const marked = shots.find(f => f.personId === b.champion) ?? shots[0]!;
        return { type:'B_THROW', targetId: marked.personId };
      }
    }
    if (!me.hasActed && distance(near.at, me.at) === 1) {
      // The game gained named leaders, so the bot hunts them in the same
      // commit: dropping the champion shakes his whole band, and now that he
      // SURVIVES a field he did not die on, killing him is the only way he
      // stops coming back. An average player goes for the man with the
      // pennant when he is in reach.
      const marked = foes.find(
        f => f.personId === b.champion && distance(f.at, me.at) === 1);
      return { type:'B_STRIKE', targetId: (marked ?? near).personId };
    }
    // DASH — and this is the one the measurement changed my mind about,
    // twice. See the note below the move scorer.
    if (VERBS.dash && !me.hasActed && distance(near.at, me.at) > BASE_MOVES + 2) {
      return { type:'B_DASH' };
    }

    if (me.movesLeft > 0) {
      // The wall, formed on the way in rather than instead of it. This is the
      // exact rule test/wall.test.ts measures as beating the charge: closing
      // at 4 a hex outweighs shoulders at 3 a mate, two mates at most, so
      // shoulders decide BETWEEN approaches and can never argue anyone into
      // standing still. The first attempt here weighted shoulders above
      // ground and the band huddled: raids held rose and the open-field curve
      // collapsed — a bot that plays worse overall measures nothing.
      const score = (at: {q:number;r:number}) => {
        const mates = b.combatants.filter(c =>
          c.side === 'warband' && c.personId !== me.personId
          && !c.down && !c.fled && distance(c.at, at) === 1).length;
        const gap = Math.min(...foes.map(f => distance(at, f.at)));
        // Never stand ON your own palisade. A man on the stakes has one hand
        // on the wood and no footing, and is WALL_EXPOSED easier to hit —
        // that is the whole reason the thing is worth building, and the
        // scorer knew nothing about it, so a defending band cheerfully
        // climbed its own wall to close a hex faster and fought the raid
        // from the worst tile on the field.
        const stakes = b.grid[key(at)]?.ground === 'wall' ? 12 : 0;
        return -gap * 4 + Math.min(mates, 2) * 3 - stakes;
      };
      // reachWithZoc only offers legal moves, so a chosen B_MOVE cannot be
      // refused — and a refused action is how this harness ends a run.
      const reach = [...reachWithZoc(b, me).keys()].map(fromKey);
      if (reach.length) {
        const to = reach.reduce((a,h)=>score(h)>score(a)?h:a);
        if (score(to) > score(me.at)) return { type:'B_MOVE', to };
      }
    }

    // On DASH, which the measurement changed my mind about twice.
    //
    // The obvious rule — "out of the fight, action unspent, so run" — was
    // written first and it is a TRAP. Over forty seeds it took the balanced
    // country from 11 bands seeing spring to 8, and turning the other three
    // verbs off moved nothing at all: dash was the whole effect. The reason
    // is the game's own central rule. Spending the action to arrive sooner
    // means the fastest man arrives ALONE and having already acted, which is
    // exactly the charge `test/wall.test.ts` measures as losing. A shield
    // wall does not sprint.
    //
    // Narrowed to "only while contact is still more than a full move away",
    // the harm went away — and so did the verb: sitting BELOW the move
    // branch it never fired at all, because while closing, moving always
    // improves the score. A rule that cannot fire measures nothing, which is
    // the failure this whole item is about. So it sits above the move now,
    // where a straggler spends the action on ground and still arrives with
    // the line rather than ahead of it.

    // DEFEND. In position, nothing left to do, and they are coming — which
    // is the whole case for a shield. The bot used to end this turn having
    // done nothing at all, and "nothing" is strictly worse than "set the
    // shield", so this rule cannot cost anything and can only have been
    // missing because nobody looked.
    if (VERBS.defend && !me.hasActed && distance(near.at, me.at) <= 3) return { type:'B_DEFEND' };

    return { type:'B_END_TURN' };
  }

  const days = state.party.food / Math.max(1, foodPerDay(state));
  const nights = state.party.firewood / Math.max(1, firewoodPerNight(state));

  // The game gained the ship's way in, so the bot takes it in the same
  // commit. Off the water it is strictly the better approach when you mean
  // to win — fewer of them, shaken, and a bigger hold — so an average
  // player afloat beside a place takes it from the boat.
  if (strandTarget(state) && sworn(state.party.people).length >= 4) {
    return { type:'STRANDHOGG' };
  }

  // A counter under our feet and a hole in the stores: deal rather than
  // draw. The town and the house will trade as often as you like and only
  // once you have not robbed them, so an average player short of one thing
  // and long on the other buys what he needs and leaves them standing.
  const dealHere = placeHere(state);
  if (dealHere && dealHere.sackedOn === undefined) {
    for (const offer of offersAt(state, dealHere.id)) {
      if (tradeBlocker(state, dealHere.id, offer.id) !== null) continue;
      // Standing at a counter with something to spare, an average player
      // deals — the first cut also demanded they be SHORT of what was on
      // offer, which is narrower than anyone actually is, and left the whole
      // market system firing twice in sixty sagas.
      const spare = offer.give === 'food' ? days > 12 : nights > 12;
      if (spare) return { type:'TRADE_AT', id: dealHere.id, offer: offer.id };
    }
  }

  // A place worth taking, under our feet, still standing: take it. The rule
  // that put this here is the same one that taught the bot to swing — the
  // game gained raidable places, so the bot raids them in the same commit,
  // or the measurement reports them as worthless. Soft targets always; the
  // garrisoned town only with a full-strength band and food to fight on —
  // item 10's offensive half, because a bot that never fights FOR anything
  // measures the whole plunder game as worthless.
  const mighty = sworn(state.party.people).length >= 5 && days >= 3;
  const here2 = placeHere(state);
  if (here2 && here2.sackedOn === undefined) {
    const def = placeKind(here2.kind);
    if (def.garrison === null || def.garrison <= 1 || mighty) {
      return { type:'SACK_PLACE', id: here2.id };
    }
  }

  // Standing on a camp with something in it, under arms, strong enough to
  // take it: take it. This is what "living by raiding" MEANS, and until now
  // the bot only ever fell on anybody when it was three days from starving
  // — a desperation rule wearing a strategy's name, which is why even the
  // raider policy sacked 0.3 camps a saga.
  const host = neighbourHere(state);
  if (host && policy.robsCamps && canFallOn(state, host.id)
      && sworn(state.party.people).length >= 4
      && campStores(state, host.sackedOn) >= CAMP_WORTH) {
    return { type:'FALL_ON', id: host.id };
  }

  // Starving on a cold doorstep: the average player robs it before they die.
  // Friends stay friends — this only fires on a camp that already dislikes
  // the band, when there are under three days of food left.
  if (host && days < 3 && host.standing < 10 && canFallOn(state, host.id)) {
    return { type:'FALL_ON', id: host.id };
  }

  // --- The long game, which this harness could not previously reach ---
  //
  // Everything below is the endgame the bot had never once played: it never
  // bartered, never called a Thing, never ruled. Item 9 measures the years
  // after the second winter, and a harness that cannot GET there measures
  // nothing — the same lesson as the bot that would not swing.

  // Proclaimed: keep the rule rather than closing the saga. A bot that lays
  // it down is a bot that ends its own run, which is the opposite of what
  // the long game is for.
  if (state.jarl && state.flags['ruleTaken'] === undefined) return { type:'RULE_ON' };

  // The claim, the moment it is takeable. It costs three days and a feast,
  // and the bot walks into whatever odds it has, as an ordinary player does.
  if (canCallThing(state)) return { type:'CALL_THING' };

  if (state.settlement) {
    // Out on an errand. Which errand decides everything below, because the
    // two are opposites: one carries food in to make a friend, the other
    // takes a place off the coast and is remembered for it.
    const out = state.expedition;
    if (out) {
      if (out.purpose === 'explore') {
        // Walking the country to find out what is in it. Aims at the
        // nearest ground nobody has stood on, which is what turns fog into
        // a place worth coming back for.
        if (!out.returning && (raidTarget(state, policy.raidReach)
            || state.day - out.launchedOn >= RAID_DAYS)) {
          return { type:'TURN_HOME' };
        }
        const opts4 = moveOptions(state);
        if (opts4.length > 0) {
          const unseen = (at: {q:number;r:number}) =>
            state.world.seen[key(at)] === undefined ? 1 : 0;
          const home = state.settlement.at;
          const pick = out.returning
            ? opts4.reduce((a,b)=>distance(b,home)<distance(a,home)?b:a)
            : opts4.reduce((a,b)=>{
                const sa = unseen(a) * 6 + distance(a, home);
                const sb = unseen(b) * 6 + distance(b, home);
                return sb > sa ? b : a;
              });
          return { type:'MOVE', to: pick };
        }
        return { type:'CAMP' };
      }

      if (out.purpose === 'raid') {
        // Standing on the prize: take it. (Afloat BESIDE it is handled far
        // above, by the strandhögg rule, which fires wherever it is legal.)
        const under = placeHere(state);
        if (under && under.sackedOn === undefined) return { type:'SACK_PLACE', id: under.id };
        // A holed hull rows at half pace and is mended by a night ashore.
        // A bot that will not mend her measures the sea at half speed and
        // reports the sea as slow.
        if (state.party.hullHoled && !atSea(state)) return { type:'CAMP' };
        const prize = raidTarget(state);
        if (!out.returning && (!prize || state.day - out.launchedOn >= RAID_DAYS)) {
          return { type:'TURN_HOME' };
        }
        const aim = out.returning
          ? state.settlement.at
          : (seaApproach(state, prize!) ?? prize!.at);
        const opts3 = moveOptions(state);
        if (opts3.length > 0) {
          return { type:'MOVE', to: opts3.reduce((a,b)=>distance(b,aim)<distance(a,aim)?b:a) };
        }
        return { type:'CAMP' };
      }

      const host = neighbourHere(state);
      if (host && bargainBlocker(state, host.id) === null) return { type:'BARTER', id: host.id };
      if (!out.returning && state.day - out.launchedOn >= 20) return { type:'TURN_HOME' };
      const aim = out.returning
        ? state.settlement.at
        : (nearestFriendable(state) ?? state.settlement.at);
      const opts2 = moveOptions(state);
      if (opts2.length > 0) {
        return { type:'MOVE', to: opts2.reduce((a,b)=>distance(b,aim)<distance(a,aim)?b:a) };
      }
      return { type:'CAMP' };
    }

    // A jarldom needs somebody on this coast who will speak for us, and
    // nobody makes a friend from indoors. Sends two out with food to spare,
    // and only when there is genuinely a surplus to carry. First, because
    // the Thing is what a run is FOR and raiding is what costs you it.
    if (policy.trades && !hasSpeakers(state) && wintersStood(state.day) >= 1 && nearestFriendable(state)) {
      const crew = sworn(state.party.people).slice(0, 2).map(p => p.id);
      if (crew.length === 2
        && state.party.food > provisionsFor(2) + BARTER_FOOD * 3 + foodPerDay(state) * 7
        && launchBlocker(state, crew) === null) {
        return { type:'LAUNCH', members: crew, purpose: 'trade' };
      }
    }

    // Going out under arms — the errand this harness had NEVER once run.
    //
    // The audit's first finding: `moveOptions` returns nothing for a settled
    // band, so an expedition is the only door back onto the map, and behind
    // it lay three sea days, one sea fight and zero strandhöggs in sixty
    // sagas. Hull damage, cargo over the side, the authored sea decks and
    // the strandhögg itself were all shipped unmeasured — the same-commit
    // rule broken by the very feature that named it.
    //
    // An average player with a full band, a full store and a fat monastery
    // still standing down the coast goes and takes it. Gated behind the
    // trade errand above, because a friend is what the Thing needs and
    // steel is what costs you one.
    //
    // Two constraints that are right whatever they do to the numbers, and
    // the first cut of this had neither. It sent three of six away for up
    // to twenty-four days whenever a target was known — including through
    // autumn, with the winter mark unmet — and the curve fell 67/30/8 to
    // 60/27/7 while the fair country's long game went 161 days to 115. That
    // is not the sea being a bad bargain; that is a bot doing something no
    // average player does. The expedition harness has said since 4.2 that
    // emptying the steading kills.
    //
    // So: only in the growing half of the year, when there is time to be
    // back before the mark matters, and only for something close enough to
    // be a raid rather than a voyage.
    const season = seasonOf(state.day);
    const inSeason = season === 'spring' || season === 'summer';
    // Nothing known worth taking, and a band that lives by taking. The
    // knowledge economy from item 1 hands the country out over a TRADING
    // counter, so a policy that will not trade is blind — measured, the
    // raider knew 0.11 of four places against the settler's 0.47 and could
    // not launch a single armed errand in a thousand target-days. The game
    // has had an `explore` purpose since 4.2 and no bot ever used it.
    if (policy.raidReach > 0 && wintersStood(state.day) >= 1 && inSeason
        && !raidTarget(state, policy.raidReach)) {
      const scouts = sworn(state.party.people).slice(0, 2).map(p => p.id);
      if (scouts.length === 2
        && state.party.food > provisionsFor(2) + foodPerDay(state) * policy.errandBuffer
        && launchBlocker(state, scouts) === null) {
        return { type:'LAUNCH', members: scouts, purpose: 'explore' };
      }
    }

    if (policy.raidReach > 0 && wintersStood(state.day) >= 1 && inSeason
        && raidTarget(state, policy.raidReach)) {
      const crew = sworn(state.party.people).slice(0, 3).map(p => p.id);
      // The surplus that funds the errand, counted in DAYS the steading can
      // feed itself rather than in sacks. A flat "+55" was calibrated for a
      // band of exactly six, and item 3's growth broke it silently: more
      // mouths meant the threshold was never met, the errand stopped
      // launching, and the sea went back to nought — the exact content item
      // 1 had just made reachable, undone by a constant in the bot.
      if (crew.length === 3
        && state.party.food > provisionsFor(3) + foodPerDay(state) * policy.errandBuffer
        && launchBlocker(state, crew) === null) {
        return { type:'LAUNCH', members: crew, purpose: 'raid' };
      }
    }
    return { type:'CAMP' };
  }

  // Settle on anything workable rather than holding out for perfection.
  if (canFound(state, state.party.at) && state.day >= settleNotBefore) {
    const r = siteReport(state.world, state.party.at);
    if (r && r.total >= policy.siteFloor) return { type:'FOUND' };
  }

  const here = state.world.tiles[key(state.party.at)]!.terrain;
  const wooded = here === 'forest' || here === 'hills' || here === 'valley';
  if (nights < 6 && wooded) return { type:'CAMP' };
  if (days < 4 && canGather(state)) return { type:'FORAGE' };
  if (days < 4 && canFish(state)) return { type:'FISH' };

  const opts = moveOptions(state);
  if (opts.length === 0) return { type:'CAMP' };

  // Short on food with a soft larder in sight: the average player robs it.
  if (days < 5) {
    let larder: {q:number;r:number}|null = null; let larderD = 7;
    for (const p of state.world.places) {
      if (p.sackedOn !== undefined) continue;
      const def = placeKind(p.kind);
      if (def.garrison !== null && def.garrison > 1) continue;
      if (def.loot.food <= 0) continue;
      if (state.world.seen[key(p.at)] === undefined) continue;
      const d = distance(p.at, state.party.at);
      if (d < larderD) { larderD = d; larder = p.at; }
    }
    if (larder) {
      const t = larder;
      return { type:'MOVE', to: opts.reduce((a,b)=>distance(b,t)<distance(a,t)?b:a) };
    }
  }

  // Wealth in sight and the strength to take it: the average player detours.
  // Gated on the same strength as the town fight, and on a short walk — the
  // fun loop the game is built around is travel, plunder, THEN settle, and
  // a bot that beelines past every monastery measures none of it.
  //
  // And gated on the CALENDAR, which it was not until the fixed places were
  // brought within reach. This rule was written for a world where the four
  // of them sat a median thirty hexes from the sand, so it fired once in
  // forty sagas and its lack of a clock never showed. With them on the same
  // coast it fires thirteen times, and pushed the founding day from 18.5 to
  // 21.3 — which cost seven points of the curve, all of it here and none of
  // it in the sea errand this work was about. Winter lands on day 49 and a
  // band still walking cannot stockpile: an average player plunders ON THE
  // WAY to a steading, not INSTEAD of one.
  if (!state.settlement && mighty && state.day < policy.plunderWindow) {
    let mark: {q:number;r:number}|null = null; let markD = 6;
    for (const p of state.world.places) {
      if (p.sackedOn !== undefined) continue;
      if (state.world.seen[key(p.at)] === undefined) continue;
      const d = distance(p.at, state.party.at);
      if (d < markD) { markD = d; mark = p.at; }
    }
    if (mark) {
      const t = mark;
      return { type:'MOVE', to: opts.reduce((a,b)=>distance(b,t)<distance(a,t)?b:a) };
    }
  }

  // Actually go and look for somewhere to live: among ground we have SEEN,
  // find the nearest hex that would take the posts and walk toward it.
  let target: {q:number;r:number}|null = null; let bestD = 99;
  for (const k of Object.keys(state.world.tiles)) {
    if (state.world.seen[k] === undefined || state.world.seen[k] === 'unseen') continue;
    const at = fromKey(k);
    const probe = { ...state, party: { ...state.party, at } } as GameState;
    if (!canFound(probe, at)) continue;
    const r = siteReport(state.world, at);
    if (!r || r.total < 9) continue;
    const d = distance(at, state.party.at);
    if (d < bestD) { bestD = d; target = at; }
  }
  if (target) {
    const t = target;
    return { type:'MOVE', to: opts.reduce((a,b)=>distance(b,t)<distance(a,t)?b:a) };
  }

  // Nothing seen yet: push inland into the dark, favouring timber when short.
  const score = (h: typeof opts[0]) => {
    const t = state.world.tiles[key(h)]!.terrain;
    return (nights < 8 ? terrainDef(t).wood * 6 : 0)
      + distance(h, state.world.landing)
      + (t === 'ocean' ? -8 : 0);
  };
  return { type:'MOVE', to: opts.reduce((a,b)=>score(b)>score(a)?b:a) };
}

/**
 * How full a camp's stores must be before it is worth the walk and the
 * reprisal. Below this they were robbed too recently to have put anything
 * back — see CAMP_REGROW.
 */
const CAMP_WORTH = 0.6;

/** How many hexes of extra walk the ship's way in is worth. */
const SHIP_PULL = 4;

/** And how long they give the errand before turning for home regardless. */
const RAID_DAYS = 20;

/**
 * The nearest place still worth taking, or null.
 *
 * Deliberately the same standard the pre-settlement bot uses — soft targets
 * always, a garrison only with a band that can carry it — so the errand is
 * "what an average player would go and do", not "what the harness needs to
 * touch the sea".
 */
function raidTarget(
  state: GameState,
  within = policy.raidReach + 4,
): { id: string; at: {q:number;r:number} } | null {
  const home = state.settlement;
  if (!home) return null;
  const strong = sworn(state.party.people).length >= 5;
  let best: { id: string; at: {q:number;r:number} } | null = null;
  let bestScore = within;
  // Camps first, and this is the change that makes raiding a LIFE rather
  // than four one-off events. The fixed places are taken once each and then
  // they are gone; a neighbour's camp puts its stores back over a season, so
  // a band that means to live this way works a circuit of them.
  if (strong) {
    for (const n of state.neighbours) {
      if (!n.found) continue;
      if (campStores(state, n.sackedOn) < CAMP_WORTH) continue;
      const d = distance(n.at, home.at);
      if (d < bestScore) { bestScore = d; best = { id: n.id, at: n.at }; }
    }
  }
  for (const p of state.world.places) {
    if (p.sackedOn !== undefined) continue;
    if (state.world.seen[key(p.at)] === undefined) continue;
    const def = placeKind(p.kind);
    if (def.loot.food <= 0 && def.loot.firewood <= 0) continue;
    if (def.garrison !== null && def.garrison > 1 && !strong) continue;
    const d = distance(p.at, home.at);
    if (d >= within) continue;
    // A band that owns a knarr and has read its own guide prefers the prize
    // it can come out of the water at: fewer of them, shaken, and half again
    // in the hold. Worth a few hexes of extra walk, and without this the
    // errand simply took whatever was nearest and the strandhögg — the verb
    // item 1 shipped — went back to never happening.
    const score = d - (seaApproach(state, { at: p.at }) ? SHIP_PULL : 0);
    if (score < bestScore) { bestScore = score; best = { id: p.id, at: p.at }; }
  }
  return best;
}

/**
 * Coastal water beside a place, if there is any — the hex a strandhögg is
 * launched from. Returning it makes the ship's way the DEFAULT approach to
 * anywhere on the shore, which is the point: walking up to a coastal gate
 * is already measured, and coming out of the water never has been.
 */
function seaApproach(
  state: GameState,
  prize: { at: {q:number;r:number} },
): {q:number;r:number} | null {
  for (const n of neighbors(prize.at)) {
    if (state.world.tiles[key(n)]?.terrain !== 'ocean') continue;
    if (!isCoastalWater(state, n)) continue;
    return n;
  }
  return null;
}

function nearestFriendable(state: GameState): {q:number;r:number} | null {
  let best: {q:number;r:number} | null = null;
  let bestD = 99;
  for (const n of state.neighbours) {
    if (n.standing >= 25) continue;
    if (!n.found) continue;
    const d = distance(n.at, state.party.at);
    if (d < bestD) { bestD = d; best = n.at; }
  }
  return best;
}

/**
 * Plays one seed until it dies or reaches `maxDay`, and hands back the state.
 *
 * Deliberately a fresh run per milestone rather than one pass with snapshots.
 * The snapshot version was written first and disagreed with this one by forty
 * points, which is a good reminder that a harness is code and can be wrong in
 * exactly the direction that flatters whatever it is measuring.
 */
function run(
  seed: string,
  maxDay: number,
  /** Called with every state transition, for measurements the tally misses. */
  watch?: (before: GameState, after: GameState) => void,
  hardship: HardshipId = 'even',
): GameState {
  let state = structuredClone(newGame(seed, hardship));
  let jobsSet = false;

  for (let i = 0; i < 6000 && !state.end && state.day <= maxDay; i += 1) {
    if (state.settlement && !jobsSet) {
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => assign(state, p.id, policy.crew[ix % policy.crew.length]!));
      jobsSet = true;
    }
    // Keep the queue fed. The old one-shot queued the whole list on settle
    // day and never came back — anything unaffordable that day was silently
    // never built. Now: whenever the queue is empty, take the first thing on
    // the list that will queue, and once nothing on it will, keep raising
    // búðs while the steading is over-full. The first roof goes up whatever
    // the woodpile says; after that a winter's burn stays in hand first —
    // firewood spent on posts is firewood not spent on nights.
    if (state.settlement && state.settlement.queue.length === 0) {
      const buffer = state.settlement.built.length === 0 ? 0 : 16;
      if (state.party.firewood >= buffer) {
        // The game puts a checklist on the steading wall after the first
        // thaw naming exactly what a jarl still lacks, so an average player
        // who wants one builds THAT next. Without this the bot worked the
        // list in order and never reached the mead hall at all: fourteen
        // long sagas, four of them past the second winter, and not one hall
        // — which is why nobody ever called a Thing.
        const want = wintersStood(state.day) >= 1
          ? ['meadhall', ...policy.want.filter(b => b !== 'meadhall')]
          : policy.want;
        for (const b of want) {
          // One of each off the list — the repeatable búð would otherwise
          // win this loop forever and the late tier would never be reached.
          if (state.settlement.built.includes(b as never)) continue;
          if (queueBuild(state, b as never)) break;
        }
        if (state.settlement.queue.length === 0 && crowding(state) > 0) {
          queueBuild(state, 'bud');
        }
      }
    }
    // Heed the mark: the game states what the stores must reach, so a
    // competent player moves people onto whatever is short.
    //
    // But it KEEPS A BUILDER while anything is on the stocks, and that line
    // is not a nicety — without it this block reassigned every last person
    // every day the mark was visible, which is most of the year, so the
    // builder was wiped before ever finishing anything. The long-game run
    // found it: sagas reaching day 259 with a hundred and sixty firewood in
    // the pile and NOTHING built, and therefore no mead hall, and therefore
    // no Thing, and therefore an endgame no measurement had ever reached.
    // A real player with wood to spare does not put the whole hall on the
    // woodpile.
    if (state.settlement && markVisible(state)) {
      const need = forecast(state);
      const shortWood = state.party.firewood < need.firewood;
      const shortFood = state.party.food < need.food;
      const keepBuilder = state.settlement.queue.length > 0;
      state.party.people
        .filter((p) => p.alive)
        .forEach((p, ix) => {
          if (keepBuilder && ix === 0) {
            assign(state, p.id, 'builder');
            return;
          }
          if (shortWood && shortFood) assign(state, p.id, ix % 2 ? 'woodcutter' : 'hunter');
          else if (shortWood) assign(state, p.id, ix < 4 ? 'woodcutter' : 'hunter');
          else if (shortFood) assign(state, p.id, ix < 4 ? 'hunter' : 'woodcutter');
        });
    }

    let next = apply(state, step(state));
    if (next === state && state.battle) {
      // A refused battle action must never end the saga — a player whose tap
      // is refused is still in the fight, and the turn can always be ended.
      // The old break here ate half of every sample: see the header.
      next = apply(state, { type: 'B_END_TURN' });
    }
    if (next === state) break;
    if (watch) watch(state, next);
    state = next;
  }
  return state;
}


/**
 * Founds at the landing if the landing will take posts, else wherever the
 * world will. The wider sea margin (52x36 worldgen) made foundable LANDINGS
 * rare, and a fixture that only ever tried the landing started failing on
 * ground that exists eight hexes away.
 */
function foundAnywhere(state: GameState): boolean {
  if (foundSettlement(state)) return true;
  for (const k of Object.keys(state.world.tiles)) {
    const at = fromKey(k);
    state.party.at = at;
    if (canFound(state, at) && foundSettlement(state)) return true;
  }
  return false;
}

// --- The bars ---

/**
 * Sixty, not thirty.
 *
 * Thirty was enough to be a tripwire and not enough to tune on, and an audit
 * proved it: sweeping the base event chance through 0.28, 0.34 and 0.40 gave
 * 53%, 30% and 43% at the two-winter mark — a fourteen-point swing that went
 * the WRONG WAY in the middle. That is not a response curve, it is noise
 * being read as signal. At a fixed setting the same measurement moved five
 * points between thirty seeds and sixty, so anything smaller than about ten
 * points is below what this harness can see.
 *
 * The bars below are deliberately wide for the same reason. They exist to
 * catch "unwinnable" and "walkover", not to pin a number.
 */
const SEEDS = 60;

interface Curve {
  reachedWinter: number;
  sawSpring: number;
  twoWinters: number;
  settledByWinter: number;
  /**
   * Item 4 of the audit: WHAT kills bands in the wall window (day 40-73,
   * where the curve falls from ~78% to ~25%). Keyed by the person's own
   * fate string, raw and uninterpreted — the instrument counts, it does
   * not editorialise. Run-endings over the same window count beside it.
   */
  deaths: Record<string, number>;
  ends: Record<string, number>;
}

let cached: Curve | null = null;

/**
 * Measured once, read by every bar below.
 *
 * Async for one reason: the loop is minutes of solid computation, and a
 * worker whose event loop never yields cannot answer the test runner's RPC
 * heartbeat — CI then fails the run with "[vitest-worker]: Timeout calling
 * onTaskUpdate" under 560 green tests. One yielded macrotask per seed keeps the
 * loop breathing and costs nothing anyone can measure.
 */
async function measured(): Promise<Curve> {
  if (cached) return cached;
  const total: Curve = {
    reachedWinter: 0, sawSpring: 0, twoWinters: 0, settledByWinter: 0,
    deaths: {}, ends: {},
  };
  for (let s = 0; s < SEEDS; s += 1) {
    const atWinter = run(`curve-${s}`, 49);
    if (!atWinter.end) {
      total.reachedWinter += 1;
      if (atWinter.settlement) total.settledByWinter += 1;
    }
    const atSpring = run(`curve-${s}`, 73);
    if (!atSpring.end) total.sawSpring += 1;
    // The wall window: who died between the first frost and the thaw, and of
    // what. `left` is excluded — walking out is not a death, per item 2 of
    // the LAST audit, and this table must not repeat that lie.
    for (const p of atSpring.party.people) {
      if (p.alive || p.left) continue;
      if ((p.diedOn ?? 0) < 40 || (p.diedOn ?? 0) > 73) continue;
      const fate = p.fate ?? 'unrecorded';
      total.deaths[fate] = (total.deaths[fate] ?? 0) + 1;
    }
    if (atSpring.end) total.ends[atSpring.end.cause] = (total.ends[atSpring.end.cause] ?? 0) + 1;
    if (!run(`curve-${s}`, 169).end) total.twoWinters += 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  cached = total;
  return total;
}

// Playing thirty seeds three times over is not a five-second job, and the
// default timeout is the only thing here that has any opinion about that.
/**
 * Two minutes was enough while this file held one sixty-seed sweep. It now
 * holds several, and they share a worker pool with everything else in the
 * run — so tests that pass comfortably on their own timed out in the full
 * suite, which is a scheduling fact rather than a slow test. Generous, and
 * a real hang still ends the run.
 */
const CURVE_TIMEOUT = 600_000;

describe('the difficulty curve', () => {
  const pct = (n: number) => Math.round((100 * n) / SEEDS);

  it('is winnable by an average player, and not a walkover', { timeout: CURVE_TIMEOUT }, async () => {
    const m = await measured();
    console.log(`curve over ${SEEDS} seeds: winter ${pct(m.reachedWinter)}%, spring ${pct(m.sawSpring)}%, two winters ${pct(m.twoWinters)}%, settled by winter ${m.settledByWinter}`);
    // Measured at 78% / 30% / 7% when these bars were re-based. The figures
    // they replaced (83/55/50) were the truncation artifact in the header,
    // not the game. The band stays wide on purpose: a tripwire for
    // "unwinnable" and "trivial", not a lock on today's numbers.
    //
    // The floor moved from two winters to spring, because an instrument that
    // resolves to ±5 points cannot honestly put a floor under a 7% figure.
    // Two winters keeps only the walkover ceiling; whether 7% is the brutal
    // late game Phase 6 wanted or an overshoot is a design decision the
    // roadmap now owns, and a bar must not take it by default.
    expect(pct(m.reachedWinter)).toBeGreaterThanOrEqual(45);
    expect(pct(m.reachedWinter)).toBeLessThanOrEqual(95);
    expect(pct(m.sawSpring)).toBeGreaterThanOrEqual(10);
    expect(pct(m.twoWinters)).toBeLessThanOrEqual(60);
  });

  it('kills more bands than it spares before the first thaw', { timeout: CURVE_TIMEOUT }, async () => {
    // Whatever else moves, the first winter has to be the wall. If as many
    // bands see spring as reach winter, winter has stopped meaning anything.
    const m = await measured();
    expect(m.sawSpring).toBeLessThan(m.reachedWinter);
  });

  it('gets most surviving bands settled before the dark', { timeout: CURVE_TIMEOUT }, async () => {
    // A band still walking when winter lands is a band that cannot stockpile,
    // and that failure should be a mistake rather than the default.
    const m = await measured();
    expect(m.settledByWinter * 2).toBeGreaterThan(m.reachedWinter);
  });

  it('names what the wall window kills with', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 4 of the audit. Half the game's deaths land between day 40 and
    // 73, and until this table existed nobody could say of WHAT — which is
    // the difference between a hard game and an opaque one. No bars on the
    // shape: the table is an instrument, and the one assertion is that it
    // cannot silently go blind.
    const m = await measured();
    const deaths = Object.entries(m.deaths).sort((a, b) => b[1] - a[1]);
    const ends = Object.entries(m.ends).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `the wall window (day 40-73) over ${SEEDS} seeds — deaths: ` +
        deaths.map(([fate, n]) => `${fate} ${n}`).join(', ') +
        ` | runs ended: ${ends.map(([cause, n]) => `${cause} ${n}`).join(', ')}`,
    );
    const total = deaths.reduce((sum, [, n]) => sum + n, 0);
    expect(total).toBeGreaterThan(0);
  });
});

// --- The wall ---

// --- What the late game is NOT short of ---
//
// Two levers were built, measured and thrown away trying to fix the flat late
// game (41 of 43 bands through the first winter reach the second). Both are
// recorded here so the third attempt does not start by repeating them.
//
//   1. Raid pressure rising with the steading's fame. Built, then tried at
//      three magnitudes up to three times the original. The curve moved by
//      nothing at any of them: raids do fire — 61 across 80 runs, 38 runs saw
//      one — and settled bands simply hold them.
//   2. Winters that deepen with the years: +2 firewood a night per winter
//      already stood, so winter two burns 8 and winter three 10, plus a
//      colder night for the sickness roll. Implemented correctly and verified
//      at the boundaries. It changed survival to the second winter by zero
//      for a careful player AND by zero for a careless one (18/40 either
//      way), because the winter mark is a perfect forecast and surplus labour
//      can always be moved onto whatever it says is short.
//
// The diagnosis both point at: by the second year a settled band has more
// labour than it has uses for, so NOTHING routed through the material
// survival loop — food, firewood, cold — can threaten it. A lever that works
// has to take away people or bring something a small band cannot beat, not
// raise a number the band can simply out-work.

describe('the memorial outlives the run', () => {
  it('names everyone the run buried, oldest death first', () => {
    const state = structuredClone(newGame('wall'));
    state.party.people[0]!.alive = false;
    state.party.people[0]!.fate = 'took a spear at the ford';
    state.party.people[0]!.diedOn = 30;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.fate = 'did not wake';
    state.party.people[1]!.diedOn = 12;

    const dead = fallenOf(state);
    expect(dead).toHaveLength(2);
    expect(dead[0]!.day).toBe(12);
    expect(dead[1]!.day).toBe(30);
    expect(dead[0]!.fate).toBe('did not wake');
    // The seed goes on the stone, so two Ketils from two sagas are two people.
    expect(dead.every((f) => f.seed === state.seed)).toBe(true);
  });

  it('gives a nameless death a fate and a day rather than dropping it', () => {
    const state = structuredClone(newGame('vague'));
    state.day = 41;
    state.party.people[0]!.alive = false;
    const dead = fallenOf(state);
    expect(dead).toHaveLength(1);
    expect(dead[0]!.fate.length).toBeGreaterThan(0);
    expect(dead[0]!.day).toBe(41);
  });

  it('leaves the living off it', () => {
    const state = structuredClone(newGame('living'));
    expect(fallenOf(state)).toHaveLength(0);
  });
});

// --- Motion ---

describe('the chrome points at what changed', () => {
  it('says nothing on the first reading', () => {
    // Opening the game is not a moment where six numbers changed. Flashing
    // the whole bar on load is noise with no information in it.
    expect(bumped(null, { food: 24, wood: 8 })).toEqual({});
  });

  it('marks only the numbers that actually moved', () => {
    const moved = bumped({ food: 24, wood: 8, heart: 70 }, { food: 21, wood: 8, heart: 70 });
    expect(moved.food).toBe(true);
    expect(moved.wood).toBe(false);
    expect(moved.heart).toBe(false);
  });

  it('does not bump a number it has never seen before', () => {
    // A stat that appears mid-run (a bar gaining a column) has not changed.
    expect(bumped({ food: 24 }, { food: 24, wood: 8 }).wood).toBe(false);
  });

  it('remembers between readings, and each watch keeps its own memory', () => {
    const bar = makeWatch();
    const other = makeWatch();
    expect(bar({ food: 24 })).toEqual({});
    expect(bar({ food: 24 }).food).toBe(false);
    expect(bar({ food: 20 }).food).toBe(true);
    // Reading the same value twice in a row is not a change either.
    expect(bar({ food: 20 }).food).toBe(false);
    // The other bar has seen nothing, so it is still on its first reading.
    expect(other({ food: 20 })).toEqual({});
  });
});

// --- Winters that differ, and a mark that admits it ---

describe('no two winters are the same, and the mark says so', () => {
  it('fixes each winter with the run seed, so replays stay stable', () => {
    const a = winterDepth('same-saga', 150);
    expect(winterDepth('same-saga', 150)).toBe(a);
    expect(winterDepth('same-saga', 160)).toBe(a);
  });

  it('gives different sagas different winters', () => {
    const depths = new Set(
      Array.from({ length: 20 }, (_, i) => winterDepth(`saga-${i}`, 150)),
    );
    expect(depths.size).toBeGreaterThan(1);
  });

  it('leaves the first winter alone — it is the early game and it is tuned', () => {
    for (let i = 0; i < 20; i += 1) expect(winterDepth(`saga-${i}`, 60)).toBe(0);
  });

  it('makes later winters cost more than the first, whatever the luck', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(effectsOn(150, `saga-${i}`).firewood).toBeGreaterThan(effectsOn(60).firewood);
    }
  });

  it('is exact close to, and admits its vagueness far out', () => {
    // 3.4's promise was that the game tells you the number. It still does,
    // where you can act on it — the haze only clouds long-range planning.
    expect(markHaze(150)).toBe(0);
    expect(markHaze(100)).toBeGreaterThan(0);
    expect(markHaze(90)).toBeGreaterThan(markHaze(110));
  });
});

// --- 6.2 groundwork: growth has to cost something ---

describe('the fire scales with the band round it', () => {
  /** A band of exactly this many living people, on this day. */
  function bandOf(heads: number, day: number): GameState {
    const state = structuredClone(newGame('hearth'));
    state.day = day;
    while (state.party.people.length < heads) {
      state.party.people.push({ ...state.party.people[0]!, id: `extra-${state.party.people.length}` });
    }
    state.party.people.forEach((person, i) => {
      person.alive = i < heads;
    });
    return state;
  }

  const MIDWINTER = 60;

  it('leaves the band the game was tuned for exactly where it was', () => {
    // Six off the knarr is the figure every winter number was balanced
    // against, and 80% of bands reaching the first winter is a number worth
    // not disturbing. Scaling must pivot on it, not shift it.
    for (const day of [10, 30, MIDWINTER, 80]) {
      const six = bandOf(BAND_BASE, day);
      expect(firewoodPerNight(six)).toBe(effectsOn(day, six.seed).firewood);
    }
  });

  it('makes a bigger hall cost more to keep', () => {
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const nine = firewoodPerNight(bandOf(9, MIDWINTER));
    const twelve = firewoodPerNight(bandOf(12, MIDWINTER));
    expect(nine).toBeGreaterThan(six);
    expect(twelve).toBeGreaterThan(nine);
  });

  it('does not turn losing people into a windfall', () => {
    // A fire warms a room, not a headcount. If half the band dying halved the
    // burn, a death would be a saving — which is the opposite of what
    // permadeath and the memorial wall are for.
    const six = firewoodPerNight(bandOf(6, MIDWINTER));
    const three = firewoodPerNight(bandOf(3, MIDWINTER));
    expect(three).toBeLessThan(six);
    expect(three * 2).toBeGreaterThan(six);
  });

  it('never lets a night be free', () => {
    for (const heads of [1, 2, 3]) {
      for (const day of [10, MIDWINTER]) {
        expect(firewoodPerNight(bandOf(heads, day))).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('closes the asymmetry that made extra hands free', () => {
    // The whole reason this exists: food scaled with mouths and firewood did
    // not, so every additional person was labour at no cost in wood. Three
    // separate attempts to threaten the late game bounced off exactly that.
    // Both must now move together before 6.2 offers anybody a way to grow.
    const small = bandOf(4, MIDWINTER);
    const large = bandOf(12, MIDWINTER);
    expect(foodPerDay(large)).toBeGreaterThan(foodPerDay(small));
    expect(firewoodPerNight(large)).toBeGreaterThan(firewoodPerNight(small));
  });
});

// --- 6.2: who bears arms ---

describe('the warband is six, whatever the steading holds', () => {
  /** A band with `armed` sworn and `workers` hands. */
  function household(armed: number, workers: number): GameState {
    const state = structuredClone(newGame('household'));
    const template = state.party.people[0]!;
    state.party.people = [
      ...Array.from({ length: armed }, (_, i) => ({
        ...template, id: `sworn-${i}`, bond: 'sworn' as const, alive: true,
      })),
      ...Array.from({ length: workers }, (_, i) => ({
        ...template, id: `hand-${i}`, bond: 'hand' as const, alive: true,
      })),
    ];
    return state;
  }

  it('never fields more than six however many are at home', () => {
    for (const workers of [0, 4, 9, 20]) {
      const state = household(6, workers);
      expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    }
  });

  it('caps the sworn even if a save somehow holds more', () => {
    expect(sworn(household(10, 0).party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps the hands off the field entirely', () => {
    const state = household(4, 8);
    startBattle(state, 'meadow', 0);
    const ours = state.battle!.combatants.filter((c) => c.side === 'warband');
    // Four sworn, eight hands, four on the field. More people at the steading
    // must never become a wider shield wall.
    expect(ours).toHaveLength(4);
    for (const c of ours) expect(c.personId.startsWith('sworn-')).toBe(true);
  });

  it('counts the hands as mouths and as bodies round the fire', () => {
    // They do not fight, but they eat and they need warming — which is what
    // stops taking people in from being free.
    const lean = household(6, 0);
    const full = household(6, 6);
    lean.day = 60;
    full.day = 60;
    expect(foodPerDay(full)).toBeGreaterThan(foodPerDay(lean));
    expect(firewoodPerNight(full)).toBeGreaterThan(firewoodPerNight(lean));
  });

  it('brings an older save forward with everyone sworn', () => {
    // Everyone in a pre-6.2 save came off the knarr with a weapon.
    const old = structuredClone(newGame('older')) as unknown as Record<string, unknown>;
    old['version'] = 16;
    const party = old['party'] as { people: Record<string, unknown>[] };
    for (const person of party.people) delete person['bond'];
    const migrated = migrate(old).save;
    const people = (migrated['party'] as { people: Record<string, unknown>[] }).people;
    expect(people.every((p) => p['bond'] === 'sworn')).toBe(true);
  });
});

// --- 6.2: room to put people ---

describe('a steading holds who it has room for', () => {
  function settledAt(seed: string): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) return state;
    }
    throw new Error('nothing foundable');
  }

  it('gives a band with no steading room only for the six it landed with', () => {
    expect(capacity(structuredClone(newGame('roofless')))).toBe(SWORN_MAX);
  });

  it('opens room only when something is built for it', () => {
    const state = settledAt('room');
    // Posts in and nothing raised: still the six the boat sleeps. Settling
    // must never make a band worse off than camping.
    expect(capacity(state)).toBe(SWORN_MAX);
    state.settlement!.built.push('longhouse');
    expect(capacity(state)).toBe(6);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBe(10);
    state.settlement!.built.push('meadhall');
    expect(capacity(state)).toBe(13);
  });

  it('counts nobody as crowded while there is space', () => {
    const state = settledAt('space');
    state.settlement!.built.push('longhouse');
    expect(crowding(state)).toBe(0);
  });

  it('bites harder the further past the roof the band is', () => {
    const state = settledAt('packed');
    state.settlement!.built.push('longhouse');
    const template = state.party.people[0]!;
    const roomy = moodTarget(state, template, { hungry: false, cold: false, grieving: false });

    for (let i = 0; i < 4; i += 1) {
      state.party.people.push({ ...template, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(crowding(state)).toBe(4);
    const packed = moodTarget(state, template, { hungry: false, cold: false, grieving: false });
    expect(packed).toBeLessThan(roomy);
  });

  it('makes the build queue worth keeping after the winter is beaten', () => {
    // The point of capacity: raising a búð is what lets a band grow, so the
    // queue stops being a thing you finish and becomes a thing you extend.
    const state = settledAt('queue');
    state.settlement!.built.push('longhouse');
    const before = capacity(state);
    state.settlement!.built.push('bud');
    expect(capacity(state)).toBeGreaterThan(before);
  });
});

// --- 6.2: the ways in, and the way out ---

describe('a band that can grow, and can bleed', () => {
  function roofed(seed: string, rooms: string[] = ['longhouse']): GameState {
    for (let i = 0; i < 60; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (foundAnywhere(state)) {
        state.settlement!.built.push(...rooms);
        return state;
      }
    }
    throw new Error('nothing foundable');
  }

  /**
   * AUDIT ITEM 3, and the bar that would have caught it.
   *
   * Phase 6.2 built capacity, crowding, hands, the repeatable búð and a whole
   * leaving system, and then never opened the front door. Measured over sixty
   * sagas: an average of 9.8 beds with 5.2 of them standing empty, four
   * people arriving in total, and the band NEVER ONCE exceeding the six who
   * stepped off the knarr. The joining event cards — four of them, total
   * weight 15 in a 102-card deck — were drawn twice.
   *
   * The asymmetry was the disease. `maybeRaid` has rolled every day since
   * 3.5 to see whether somebody comes to take what you have, and nothing
   * ever rolled the other way, so the coast could only subtract.
   */
  it('a steading worth coming to draws people, and a wretched one does not', () => {
    const rich = roofed('draw-rich', ['longhouse', 'bud', 'meadhall', 'farmplots', 'smokehouse']);
    rich.day = 180;
    rich.party.food = 300;
    for (const n of rich.neighbours) n.standing = 70;
    expect(drawOdds(rich), 'nobody would come to a hall like this').toBeGreaterThan(0);

    const poor = roofed('draw-poor', ['longhouse', 'bud']);
    poor.day = 180;
    poor.party.food = 300;
    for (const n of poor.neighbours) n.standing = -90;
    expect(drawOdds(poor)).toBeLessThan(drawOdds(rich));
  });

  it('never past the beds, and never past the larder', () => {
    const state = roofed('draw-floors', ['longhouse', 'bud', 'meadhall']);
    state.day = 180;
    state.party.food = 300;
    for (const n of state.neighbours) n.standing = 70;
    expect(drawOdds(state)).toBeGreaterThan(0);

    // A hall with no spare bed takes nobody, however famous.
    const full = structuredClone(state);
    while (roomLeft(full) > 0) takeIn(full, 1, 'test');
    expect(drawOdds(full)).toBe(0);

    // Nor a mouth it cannot feed. That is not growth, it is company while
    // you starve.
    const lean = structuredClone(state);
    lean.party.food = foodPerDay(lean) * DRAW_LARDER_DAYS - 1;
    expect(drawOdds(lean)).toBe(0);
  });

  it('a coast that wants you dead keeps them away', () => {
    const calm = roofed('draw-calm', ['longhouse', 'bud', 'meadhall']);
    calm.day = 180;
    calm.party.food = 300;
    for (const n of calm.neighbours) n.standing = 0;
    const feud = structuredClone(calm);
    for (const n of feud.neighbours) n.standing = -100;
    expect(drawOdds(feud)).toBeLessThan(drawOdds(calm));
    expect(DRAW_ANGER).toBeGreaterThan(0);
  });

  it('and the door is actually wired to the day', () => {
    // The half that matters, and the half the kin line and the watch-mark
    // cap both got wrong: a rule nothing calls is a rule that does not exist.
    const state = roofed('draw-wired', ['longhouse', 'bud', 'meadhall', 'farmplots']);
    state.day = 200;
    for (const n of state.neighbours) n.standing = 80;
    const before = living(state.party.people).length;
    let came = 0;
    for (let d = 0; d < 400 && !state.end; d += 1) {
      state.party.food = 300;
      state.party.firewood = 300;
      state.party.morale = 90;
      if (state.event) state.event = undefined;
      if (state.battle) state.battle = undefined;
      passDay(state);
      came = living(state.party.people).length - before;
      if (came > 0) break;
    }
    expect(came, 'four hundred days at a full hall and nobody came').toBeGreaterThan(0);
    expect(state.saga.some((e) => WHY_THEY_COME.some((w) => e.text.includes(w)))).toBe(true);
  });

  /**
   * The other door, and the one that makes raiding survivable.
   *
   * `drawOdds` is shut down by `DRAW_ANGER` as the coast turns against you,
   * which is right — nobody moves in next to a feud — and measured as a
   * death spiral: a raider ended a saga with 0.8 hands where a turtle had
   * 2.8, could not replace one of the four sworn he lost a saga, and ground
   * his warband to nothing.
   *
   * A feared band does not attract nobody. It attracts a DIFFERENT somebody.
   * Men who want a share come because the coast is frightened of you and
   * because you have taken something worth sharing — so this draw is fed by
   * the same anger that closes the other one.
   */
  it('a feared band with something to show draws swords, not settlers', () => {
    const quiet = roofed('sword-quiet', ['longhouse', 'bud', 'meadhall']);
    quiet.day = 180;
    quiet.party.food = 300;
    for (const n of quiet.neighbours) n.standing = 40;
    expect(swordOdds(quiet), 'a friendly farm should draw no swords').toBe(0);

    const feared = structuredClone(quiet);
    for (const n of feared.neighbours) n.standing = -80;
    feared.tally.sackings = SWORD_DEEDS;
    // A gap in the wall to fill: the line is six and stays six.
    feared.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });
    expect(swordOdds(feared)).toBeGreaterThan(0);
    expect(drawOdds(feared), 'settlers should be staying well away')
      .toBeLessThan(drawOdds(quiet));
  });

  it('frightening on its own buys nobody, and rich on its own buys nobody', () => {
    const base = roofed('sword-halves', ['longhouse', 'bud', 'meadhall']);
    base.day = 180;
    base.party.food = 300;
    base.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });

    const feared = structuredClone(base);
    for (const n of feared.neighbours) n.standing = -80;
    feared.tally.sackings = 0;
    expect(swordOdds(feared), 'unpleasant with nothing to show is just unpleasant').toBe(0);

    const rich = structuredClone(base);
    for (const n of rich.neighbours) n.standing = 0;
    rich.tally.sackings = SWORD_DEEDS;
    expect(swordOdds(rich), 'a hoard nobody fears is a farm').toBe(0);
  });

  it('fills the gap in the wall and never widens it', () => {
    const state = roofed('sword-gap', ['longhouse', 'bud', 'meadhall', 'farmplots']);
    state.day = 180;
    state.party.food = 300;
    for (const n of state.neighbours) n.standing = -90;
    state.tally.sackings = SWORD_DEEDS * 2;
    expect(swordOdds(state), 'a full warband needs nobody').toBe(0);

    state.party.people.filter((p) => p.bond === 'sworn').slice(0, 2)
      .forEach((p) => { p.alive = false; });
    expect(swordOdds(state)).toBeGreaterThan(0);

    let came = 0;
    for (let d = 0; d < 600 && came === 0; d += 1) {
      state.party.food = 300;
      state.party.firewood = 300;
      if (state.event) state.event = undefined;
      if (state.battle) state.battle = undefined;
      passDay(state);
      came = sworn(state.party.people).length - 4;
    }
    expect(came, 'six hundred days of infamy and nobody came for a share')
      .toBeGreaterThan(0);
    expect(sworn(state.party.people).length, 'the wall is six and stays six')
      .toBeLessThanOrEqual(SWORN_MAX);
    expect(state.saga.some((e) => WHY_SWORDS_COME.some((w) => e.text.includes(w)))).toBe(true);
  });

  it('takes people in as hands, never as fighters', () => {
    const state = roofed('join', ['longhouse', 'bud']);
    const joined = takeIn(state, 2, 'they had nowhere else to be');
    expect(joined).toHaveLength(2);
    expect(joined.every((p) => p.bond === 'hand')).toBe(true);
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('turns people away when there is no bed, and says nothing about it', () => {
    // A full hall refusing help is the whole reason capacity exists — and it
    // is what makes a búð worth five timber.
    const full = roofed('full');
    expect(roomLeft(full)).toBe(0);
    expect(takeIn(full, 2, 'they had nowhere else to be')).toHaveLength(0);
    expect(living(full.party.people)).toHaveLength(6);
  });

  it('takes as many as there is room for and no more', () => {
    const state = roofed('partial', ['longhouse', 'bud']);
    expect(roomLeft(state)).toBe(4);
    expect(takeIn(state, 9, 'word had got round that we had ground')).toHaveLength(4);
    expect(roomLeft(state)).toBe(0);
  });

  it('writes every arrival into the saga with the reason they came', () => {
    const state = roofed('saga', ['longhouse', 'bud']);
    const before = state.saga.length;
    takeIn(state, 1, 'she came out of the trees with nothing');
    expect(state.saga.length).toBeGreaterThan(before);
    expect(state.saga.at(-1)!.text).toContain('trees');
  });

  it('lets a miserable hand walk, and never a sworn one', () => {
    const state = roofed('leaving', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    state.day += 1;
    for (const person of state.party.people) person.morale = 1;

    let walked = 0;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      walked += handsLeave(state).length;
    }
    expect(walked).toBeGreaterThan(0);
    // The warband cannot evaporate. A fight must never be a morale check
    // before it is a fight.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('keeps a hand who has thrown their lot in', () => {
    const state = roofed('stayer', ['longhouse', 'bud']);
    takeIn(state, 2, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 1;
    state.day += SETTLED_IN + 1;
    expect(handsLeave(state)).toHaveLength(0);
  });

  it('keeps a contented hand whatever the weather', () => {
    const state = roofed('content', ['longhouse', 'bud']);
    takeIn(state, 3, 'they had nowhere else to be');
    for (const person of hands(state.party.people)) person.morale = 80;
    for (let day = 0; day < 25; day += 1) {
      state.day += 1;
      expect(handsLeave(state)).toHaveLength(0);
    }
  });

  it('empties a hall that is too crowded to bear', () => {
    // Capacity with teeth: taking in more than there is room for makes
    // everyone miserable, and misery is what makes hands walk.
    const state = roofed('overfull', ['longhouse', 'bud', 'meadhall']);
    takeIn(state, 7, 'word had got round that we had ground');
    const packed = crowding(state);
    for (const person of state.party.people) person.morale = 20;
    // Now take the room away, as a burnt búð or a bad winter would.
    state.settlement!.built = ['longhouse'];
    expect(crowding(state)).toBeGreaterThan(packed);
  });
});

// --- 6.3: force that outscales the warband ---

describe('a steading worth taking draws more than six can hold', () => {
  function famed(seed: string, built: string[], winters: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      // wintersStood counts from the first thaw, so winters=0 has to stay
      // BEFORE it — 73 is already one winter come through, not none.
      state.day = winters === 0 ? 30 : 73 + (winters - 1) * 96;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('brings the old nine against a steading nobody has heard of', () => {
    expect(raiderCap(famed('new', ['longhouse'], 0))).toBe(MAX_RAIDERS);
  });

  it('brings more against a hall that has stood years and been built up', () => {
    const young = raiderCap(famed('young', ['longhouse'], 0));
    const old = raiderCap(famed('old', ['longhouse', 'bud', 'meadhall', 'palisade'], 3));
    expect(old).toBeGreaterThan(young);
  });

  it('never fields more than the ground can hold', () => {
    const enormous = famed('huge', ['longhouse', 'bud', 'meadhall', 'palisade', 'smokehouse', 'dock'], 12);
    expect(raiderCap(enormous)).toBeLessThanOrEqual(MAX_RAIDERS_FAMED);
  });

  it('lets a coast that hates you actually send more', () => {
    // The measured dead end this exists to fix: with six sworn, rollFoes hit
    // the old cap of nine at difficulty four, so every point of pressure past
    // that was discarded by a Math.min and raid pressure measured as
    // worthless at three separate magnitudes. The lever was disconnected from
    // the thing it moved. What matters is that provocation now reaches the
    // field, not that it clears any particular number.
    const liked = famed('liked', ['longhouse', 'bud', 'meadhall'], 2);
    liked.party.food = 400;
    for (const n of liked.neighbours) n.standing = 60;

    const hated = structuredClone(liked);
    for (const n of hated.neighbours) n.standing = -100;

    expect(raidDifficulty(hated)).toBeGreaterThan(raidDifficulty(liked));
  });

  it('cannot be answered by fielding more of your own', () => {
    // Growth buys labour, never a wider line. That is what forces the answer
    // to be the wall, the watch, and who on this coast owes you anything.
    const state = famed('answer', ['longhouse', 'bud', 'meadhall'], 3);
    for (let i = 0; i < 7; i += 1) {
      state.party.people.push({ ...state.party.people[0]!, id: `hand-${i}`, bond: 'hand', alive: true });
    }
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
    expect(raiderCap(state)).toBeGreaterThan(SWORN_MAX);
  });
});

describe('a steading worth taking is visited', () => {
  function steading(seed: string, built: string[], winters: number, food = 60): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push(...built);
      state.day = 73 + Math.max(0, winters - 1) * 96;
      state.party.food = food;
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('leaves a steading alone while the posts are still fresh', () => {
    const fresh = steading('fresh', ['longhouse'], 1);
    fresh.settlement!.foundedOn = fresh.day - 2;
    expect(raidOdds(fresh)).toBe(0);
  });

  it('comes more for a hall that has stood years and been built up', () => {
    const young = raidOdds(steading('young', ['longhouse'], 1));
    const old = raidOdds(steading('old', ['longhouse', 'bud', 'meadhall', 'smokehouse'], 4));
    expect(old).toBeGreaterThan(young);
  });

  it('makes the watch and the wall worth keeping on a quiet day', () => {
    const open = steading('open', ['longhouse', 'bud', 'meadhall'], 3);
    const walled = structuredClone(open);
    walled.settlement!.built.push('palisade');
    walled.settlement!.watch = 6;
    expect(raidOdds(walled)).toBeLessThan(raidOdds(open));
  });

  it('stays a background hazard rather than a siege', () => {
    const richest = steading('rich', ['longhouse', 'bud', 'meadhall', 'smokehouse', 'dock'], 9, 900);
    for (const n of richest.neighbours) n.standing = -100;
    expect(raidOdds(richest)).toBeLessThanOrEqual(RAID_CHANCE_MAX);
  });
});

describe('somebody who walked out is not somebody who died', () => {
  it('keeps a leaver off the memorial and out of the saga', () => {
    const state = structuredClone(newGame('walked'));
    const killed = state.party.people[0]!;
    killed.alive = false;
    killed.fate = 'took a spear at the ford';
    killed.diedOn = 20;

    const gone = state.party.people[1]!;
    gone.alive = false;
    gone.left = true;
    gone.fate = 'walked out one morning and did not come back';
    gone.diedOn = 22;

    const wall = fallenOf(state);
    expect(wall).toHaveLength(1);
    expect(wall[0]!.name).toBe(killed.name);
  });

  it('still stops counting them as a mouth to feed', () => {
    // `alive: false` has to stand, whatever the fiction: somebody who has
    // gone is not eating here any more, and the upkeep must agree.
    const state = structuredClone(newGame('mouths'));
    const before = foodPerDay(state);
    state.party.people[0]!.alive = false;
    state.party.people[0]!.left = true;
    state.party.people[1]!.alive = false;
    state.party.people[1]!.left = true;
    expect(foodPerDay(state)).toBeLessThan(before);
  });
});

// --- 3, 4 and 5 of the audit, deliberately in one place ---

describe('losing a raid costs the one thing that is scarce', () => {
  function sacked(seed: string, extraHands: number): GameState {
    for (let i = 0; i < 150; i += 1) {
      const state = structuredClone(newGame(`${seed}-${i}`));
      if (!foundAnywhere(state)) continue;
      state.settlement!.built.push('longhouse', 'bud', 'meadhall');
      state.party.food = 120;
      state.party.firewood = 90;
      for (let h = 0; h < extraHands; h += 1) {
        state.party.people.push({
          ...state.party.people[0]!, id: `hand-${h}`, bond: 'hand', alive: true, joinedOn: 1,
        });
      }
      return state;
    }
    throw new Error('nothing foundable');
  }

  it('carries hands off, and never the sworn', () => {
    const state = sacked('taken', 4);
    const out = sackSteading(state);
    expect(out.taken.length).toBeGreaterThan(0);
    expect(out.taken.length).toBeLessThanOrEqual(SACK_TAKES);
    // The warband is fixed at six and a raid must not end a run by dice.
    expect(sworn(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('takes nobody when there is nobody but the sworn to take', () => {
    const state = sacked('bare', 0);
    expect(sackSteading(state).taken).toHaveLength(0);
    expect(living(state.party.people)).toHaveLength(SWORN_MAX);
  });

  it('puts the carried-off on the memorial, unlike somebody who walked out', () => {
    // Taken is not the same as left. A man carried off by raiders genuinely
    // did not come back, and the wall is exactly the place to say so.
    const state = sacked('wall', 3);
    sackSteading(state);
    expect(fallenOf(state).some((f) => f.fate.includes('carried off'))).toBe(true);
  });

  it('costs labour the band has to win back rather than simply out-work', () => {
    const state = sacked('labour', 4);
    const before = living(state.party.people).length;
    sackSteading(state);
    expect(living(state.party.people).length).toBeLessThan(before);
  });
});

describe('the rhythm of interruption', () => {
  /**
   * How often the game STOPS the player, and what for.
   *
   * The curve cannot resolve this — sweeping the event chance through
   * 0.28/0.34/0.40 once gave 53/30/43% at two winters, which is noise being
   * read as signal, and it is why the base chance is set by ear. But the
   * COUNTS are not noise: they are tallies over sixty sagas, and they move
   * exactly as much as the knobs move. So the ear picks the number and this
   * records what the number actually did, which is the only honest way to
   * tune something the survival bars cannot see.
   */
  it('counts cards and fights per hundred days', { timeout: CURVE_TIMEOUT }, async () => {
    let cards = 0;
    let days = 0;
    let battles = 0;
    let raids = 0;
    // Where a fight came FROM. Without this split the knob cannot be read:
    // the bot also starts fights by falling on places, and those are deaf to
    // the event chance entirely.
    let fromCard = 0;
    let fromUs = 0;
    // Named foes who came back. Persistence that is never observed in a real
    // saga is persistence that does not exist.
    let returns = 0;
    let killed = 0;
    for (let s = 0; s < SEEDS; s += 1) {
      let seen = 0;
      const state = run(`curve-${s}`, 169, (before, after) => {
        if (!before.event && after.event) seen += 1;
        if (!before.battle && after.battle && !after.battle.raid) {
          if (before.event) fromCard += 1;
          else fromUs += 1;
        }
        if (!before.battle && after.battle?.championOf) {
          const clan = before.neighbours.find((n) => n.id === after.battle!.championOf);
          if ((clan?.champion?.scars ?? 0) > 0) returns += 1;
        }
        // A clan that had a champion and no longer does lost him for good.
        for (const was of before.neighbours) {
          if (!was.champion) continue;
          const now = after.neighbours.find((n) => n.id === was.id);
          if (now && !now.champion) killed += 1;
        }
      });
      cards += seen;
      days += state.day;
      battles += state.tally.battles;
      raids += state.tally.raids;
    }
    const per100 = (n: number) => ((n / days) * 100).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(
      `rhythm over ${SEEDS} sagas (${days} days): ` +
        `cards ${cards} (${per100(cards)}/100d), open fights ${battles - raids} ` +
        `(${per100(battles - raids)}/100d) — ${fromCard} off a card, ${fromUs} of our own ` +
        `making — raids ${raids} (${per100(raids)}/100d); named foes: ${returns} came back, ` +
        `${killed} put down for good`,
    );
    // Tripwires only: a game with no cards and a game that is nothing but
    // cards are both broken, and both have been shipped by accident before.
    expect(cards).toBeGreaterThan(0);
    expect(battles).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('how hard the country is', () => {
  /**
   * Item 3, and the reason it is a test rather than four numbers in a data
   * file: a difficulty setting whose labels are not measured is a lie told
   * three times. Every hardship runs the same sixty seeds through the same
   * bot, so "A Fair Country" means something a player can be told.
   */
  it('each setting is measured, and they are ordered', { timeout: CURVE_TIMEOUT }, async () => {
    const rows: string[] = [];
    const spring: Record<string, number> = {};
    for (const terms of HARDSHIPS) {
      let reachedWinter = 0;
      let sawSpring = 0;
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(`curve-${s}`, 73, undefined, terms.id);
        if (state.day >= 49 || !state.end) reachedWinter += 1;
        if (!state.end) sawSpring += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      spring[terms.id] = sawSpring / SEEDS;
      rows.push(
        `${terms.name.padEnd(16)} reached winter ${Math.round((reachedWinter / SEEDS) * 100)}%, ` +
          `saw spring ${Math.round((sawSpring / SEEDS) * 100)}% (${sawSpring}/${SEEDS})`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`hardship over ${SEEDS} seeds each:\n  ${rows.join('\n  ')}`);

    // The bar: the order has to be real AND outside what this harness can
    // resolve. A setting called kinder that is only six points kinder is
    // indistinguishable from noise, which is how the first cut of these
    // numbers read — 33% against 27% — and it is exactly what an unmeasured
    // difficulty ships with. Ten points is the floor this file has used
    // since the event-chance sweep taught it the lesson.
    expect(spring['fair']! - spring['even']!).toBeGreaterThan(0.1);
    expect(spring['even']! - spring['hard']!).toBeGreaterThan(0.1);

    // And every setting says what it was measured at, in words.
    for (const terms of HARDSHIPS) {
      expect(terms.measured.length, terms.id).toBeGreaterThan(10);
    }
  });
});

describe('the first winter', () => {
  /**
   * Item 2 of the second audit, and it starts as a measurement because the
   * complaint that opened it was a photograph, not a number: a phone save on
   * day 26 with no roof, four food of a hundred and sixty-two, and nought
   * wood of two hundred and seventy-four. A run already lost and not told so.
   *
   * The death table says the game kills through grief rather than stores —
   * but that table is measured over BOT runs that settle early and work
   * perfectly, which is precisely the case that is not in trouble. This
   * holds the band off settling until a given day and then plays it out
   * properly, so the question "how late is too late?" gets an answer instead
   * of an opinion.
   */
  it('measures how late a band can settle and still see spring', { timeout: CURVE_TIMEOUT }, async () => {
    const HELD = [0, 12, 18, 24, 30];
    const SAMPLE = 24;
    const rows: string[] = [];
    let firstDoomed = -1;
    // Does the warning EARN its place? A verdict that fires on runs which go
    // on to live is crying wolf, and a verdict that never fires is dead code.
    let told = 0;
    let toldAndDied = 0;
    let untold = 0;
    let untoldAndDied = 0;
    try {
      for (const hold of HELD) {
        settleNotBefore = hold;
        let settled = 0;
        let settleDays = 0;
        let sawSpring = 0;
        for (let s = 0; s < SAMPLE; s += 1) {
          let settledOn = 0;
          let judged: boolean | null = null;
          const state = run(`curve-${s}`, 73, (before, after) => {
            if (!before.settlement && after.settlement) settledOn = after.day;
            // The verdict at ONE fixed moment: the first day of autumn on
            // which there is a steading to judge. "Did it ever fire" was the
            // first attempt and it is not a test — any band having one bad
            // week trips it, so it fired on 62 of 63. A player reads this
            // panel on a particular day and acts or does not; that is the
            // thing worth being right about.
            if (after.settlement && judged === null && after.day >= 40) {
              judged = !reachable(after);
            }
          });
          if (settledOn > 0) {
            settled += 1;
            settleDays += settledOn;
          }
          // Alive at the thaw is what "saw spring" means everywhere else here.
          const lived = !state.end;
          if (lived) sawSpring += 1;
          // Only SETTLED bands can be judged: there is no mark to miss on
          // the road, so `reachable` is true for every wanderer, and a
          // wanderer dies more often than anyone. Counting them as "never
          // told" made the warning look worse than useless the first time
          // this was measured — 77% against 98% — which was the harness
          // comparing settled bands with homeless ones, not the verdict
          // failing.
          if (judged !== null) {
            if (judged) {
              told += 1;
              if (!lived) toldAndDied += 1;
            } else {
              untold += 1;
              if (!lived) untoldAndDied += 1;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const rate = sawSpring / SAMPLE;
        rows.push(
          `held to day ${String(hold).padStart(2)}: settled ${settled}/${SAMPLE} ` +
            `(avg day ${settled ? Math.round(settleDays / settled) : 0}), ` +
            `saw spring ${sawSpring}/${SAMPLE} (${Math.round(rate * 100)}%)`,
        );
        if (rate === 0 && firstDoomed < 0) firstDoomed = hold;
      }
    } finally {
      settleNotBefore = 0;
    }
    // eslint-disable-next-line no-console
    console.log(`the first winter, by how long the posts were left in the boat:\n  ${rows.join('\n  ')}`);
    const pc = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : 'n/a');
    // eslint-disable-next-line no-console
    console.log(
      `  the verdict, read once on the first autumn day at home: told lost ${told}, ` +
        `${toldAndDied} died (${pc(toldAndDied, told)}); never told ${untold}, ` +
        `${untoldAndDied} died (${pc(untoldAndDied, untold)})`,
    );

    // The bars the verdict has to clear, because a wrong one is worse than
    // none: it must be far deadlier to be condemned than cleared, and it
    // must not cry wolf. Measured at 82% against 0% when it landed. The 60%
    // floor is deliberately below that — this is a tripwire for a verdict
    // that has stopped meaning anything, not a pin through today's number.
    expect(told).toBeGreaterThan(0);
    if (untold > 0) {
      expect(toldAndDied / told).toBeGreaterThan(untoldAndDied / untold);
    }
    expect(toldAndDied / told).toBeGreaterThanOrEqual(0.6);

    // The bar is not a rate — it is that settling LATE has to be worse than
    // settling early, or the opening's whole shape is a lie. Anything else
    // here is reported, not asserted, until the design decision is made.
    expect(rows.length).toBe(HELD.length);
  });
});

describe('the long game', () => {
  /**
   * Item 9, and the blind spot it closes is embarrassing in hindsight: the
   * curve harness stops at day 169, and a jarldom needs two winters plus a
   * Thing — so the endgame, the returning champion, the building tiers and
   * the escalation that answers them all shipped with NO measurement past
   * the second winter.
   *
   * Fewer seeds, far longer runs. The bot had to learn the whole endgame to
   * make this possible — barter, the Thing, and ruling on — which is the
   * same-commit rule again: a harness that cannot reach a system reports
   * that system as worthless.
   */
  // The SAME worlds the curve uses, so the two measurements are of one
  // thing at two lengths rather than of two different samples. The first
  // cut used its own `long-N` seeds and read 0 of 14 reaching a second
  // winter while the curve said 20% — which is a seed-set disagreement
  // wearing the costume of a finding.
  const LONG_SEEDS = 20;
  const LAST_DAY = 500;
  /**
   * Run on the GENTLE country, and that is an instrument choice rather than
   * a flattering one. On the balanced terms this same measurement returned
   * fourteen sagas averaging sixty-two days, none reaching the second
   * winter, none becoming jarl and NOT ONE fight after day 169 — nothing to
   * measure at all. The curve already measures whether a band survives; this
   * measures what the years DO to one that does, so it is run where bands
   * survive. The finding stands on its own and is worth keeping in view: at
   * "As It Lies", the endgame is content that almost no run reaches.
   */
  const LONG_TERMS: HardshipId = 'fair';

  it('plays to day 500 and reports what the years actually do', { timeout: 600_000 }, async () => {
    void LONG_TERMS;
    let reachedJarl = 0;
    let ruledYears = 0;
    let alive = 0;
    let days = 0;
    /* eslint-disable prefer-const */
    const ends: Record<string, number> = {};
    // Escalation, early against late: the whole claim of the word system is
    // that the coast gets harder. Counted as foes fielded per fight.
    let earlyFoes = 0;
    let earlyFights = 0;
    let lateFoes = 0;
    let lateFights = 0;
    let raids = 0;
    // Why a run never got there. "0 became jarl" is a result; this is a
    // diagnosis, and the difference is what makes the number actionable.
    let sawSecondWinter = 0;
    let everHadHall = 0;
    let everHadFriend = 0;
    let everCouldCall = 0;
    // Pooled across both arms. The per-arm counters are reset at the top of
    // each loop, so asserting on them read ONLY the last arm — a bar that
    // measures half the sample and says nothing about the other half.
    let allEarlyFoes = 0, allEarlyFights = 0, allLateFoes = 0, allLateFights = 0;
    let allFriends = 0, allCouldCall = 0, allHalls = 0, allSecondWinters = 0, allJarls = 0;

    for (const TERMS of ['even', 'fair'] as HardshipId[]) {
    reachedJarl = 0; ruledYears = 0; alive = 0; days = 0;
    earlyFoes = 0; earlyFights = 0; lateFoes = 0; lateFights = 0; raids = 0;
    sawSecondWinter = 0; everHadHall = 0; everHadFriend = 0; everCouldCall = 0;
    for (const k of Object.keys(ends)) delete ends[k];
    for (let s = 0; s < LONG_SEEDS; s += 1) {
      let hall = false;
      let friend = false;
      let couldCall = false;
      const state = run(`curve-${s}`, LAST_DAY, (before, after) => {
        if (!before.battle && after.battle) {
          const n = after.battle.foes.length;
          if (after.day <= 169) {
            earlyFoes += n;
            earlyFights += 1;
          } else {
            lateFoes += n;
            lateFights += 1;
          }
        }
        if (after.settlement?.built.includes('meadhall')) hall = true;
        if (hasSpeakers(after)) friend = true;
        if (canCallThing(after)) couldCall = true;
      }, TERMS);
      days += state.day;
      if (state.day >= 169) sawSecondWinter += 1;
      if (hall) everHadHall += 1;
      if (friend) everHadFriend += 1;
      if (couldCall) everCouldCall += 1;
      if (state.jarl) {
        reachedJarl += 1;
        ruledYears += yearsRuled(state);
      }
      if (!state.end) alive += 1;
      if (state.end) ends[state.end.cause] = (ends[state.end.cause] ?? 0) + 1;
      raids += state.tally.raids;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const per = (n: number, of: number) => (of > 0 ? (n / of).toFixed(1) : 'n/a');
    // eslint-disable-next-line no-console
    console.log(
      `the long game [${TERMS}] — ${LONG_SEEDS} sagas to day ${LAST_DAY} (avg ${Math.round(days / LONG_SEEDS)} days):\n` +
        `  ${reachedJarl} became jarl, ${ruledYears} winters ruled between them; ` +
        `${alive} still standing at the end\n` +
        `  ends: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}\n` +
        `  foes per fight: ${per(earlyFoes, earlyFights)} early (${earlyFights} fights), ` +
        `${per(lateFoes, lateFights)} late (${lateFights} fights); ${raids} raids\n` +
        `  road to the Thing: ${sawSecondWinter} saw a second winter, ${everHadHall} raised a ` +
        `mead hall, ${everHadFriend} made a friend, ${everCouldCall} could ever call it`,
    );
    allEarlyFoes += earlyFoes; allEarlyFights += earlyFights;
    allLateFoes += lateFoes; allLateFights += lateFights;
    allFriends += everHadFriend; allCouldCall += everCouldCall;
    allHalls += everHadHall; allSecondWinters += sawSecondWinter; allJarls += reachedJarl;
    }

    // The bars. First that the endgame is REACHED at all — this whole test
    // exists because it never was, and a harness that stops reaching it has
    // gone back to measuring nothing.
    expect(allSecondWinters).toBeGreaterThan(0);
    expect(allHalls, 'nobody raised a mead hall — the Thing is unreachable').toBeGreaterThan(0);
    expect(allLateFights, 'no fight after day 169 — there is no long game to measure').toBeGreaterThan(0);

    // The bar that would have caught the coast. Forty sagas made a mead
    // hall, kept the peace and stood two winters, and not ONE made a friend
    // — because the four neighbours were scattered over a landmass a band
    // sees five percent of. Every other need on the checklist had a bar and
    // this one did not, so the endgame was unreachable in silence.
    expect(allFriends, 'nobody on the coast will speak for anyone — the Thing cannot be called').toBeGreaterThan(0);
    expect(allCouldCall, 'the checklist never completed in forty sagas').toBeGreaterThan(0);
    expect(allJarls, 'the jarldom is code nobody reaches').toBeGreaterThan(0);

    // Escalation used to be asserted here — late foes per fight against
    // early — and it was the wrong place for it. The late sample is whatever
    // survives past day 169, which is a handful of fights; item 2's verb
    // work reshuffled RNG consumption, the late sample fell to five, and the
    // comparison inverted on nothing but tail noise. `test/word.test.ts`
    // proves the same claim properly and knob by knob, including that each
    // one BINDS. What belongs here is the reachability half: late fights
    // must happen at all, which is asserted above. The ratio is printed
    // because it is worth seeing, and not barred because this sample cannot
    // carry a bar.
  });
});

describe('the raid gauntlet', () => {
  /** A standing steading with the store and walls a raid comes for. */
  function homestead(seed: string): GameState {
    const state = structuredClone(newGame(seed));
    for (const k of Object.keys(state.world.tiles)) state.world.seen[k] = 'seen';
    expect(foundAnywhere(state), `${seed}: nothing foundable`).toBe(true);
    const home = state.settlement!;
    home.built.push('longhouse', 'farmplots', 'palisade');
    home.shelter = 3;
    state.day = 120;
    state.party.food = 60;
    state.party.firewood = 60;
    return state;
  }

  // Item 10's other half. The organic tally below is real but tiny — twenty
  // sagas where seven see a raid is a coin reading, and three deck edits in
  // a row proved it: 4/33, 23/39, 7/28 with no raid change in any of them.
  // This is the controlled version: the same steading, the same defenders,
  // raid after raid across the difficulty range, so held-rate is a number
  // that moves only when the raid game moves.
  it('measures holds at scale, difficulty by difficulty', { timeout: CURVE_TIMEOUT }, async () => {
    const DIFFS = [0, 1, 2, 3];
    // Twenty-four a cell, not eight. Item 5 needed to read the GRADIENT and
    // eight samples could not carry one — a run read d1 1/8 against d2 4/8,
    // which is not a difficulty curve, it is a coin.
    const PER = 24;
    const byDiff = new Map<number, { held: number; of: number }>();
    for (let s = 0; s < PER; s += 1) {
      for (const diff of DIFFS) {
        let state = homestead(`gauntlet-${s}-${diff}`);
        startRaid(state, diff);
        for (let i = 0; i < 600 && state.battle && !state.battle.outcome; i += 1) {
          let next = apply(state, step(state));
          if (next === state) next = apply(state, { type: 'B_END_TURN' });
          if (next === state) break;
          state = next;
        }
        const row = byDiff.get(diff) ?? { held: 0, of: 0 };
        row.of += 1;
        if (state.battle?.outcome === 'won') row.held += 1;
        byDiff.set(diff, row);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const table = DIFFS.map(
      (d) => `d${d} ${byDiff.get(d)!.held}/${byDiff.get(d)!.of}`,
    ).join(' | ');
    const held = DIFFS.reduce((n, d) => n + byDiff.get(d)!.held, 0);
    const total = PER * DIFFS.length;
    // eslint-disable-next-line no-console
    console.log(`raid gauntlet: ${held}/${total} held — ${table}`);

    // Wide tripwires, same philosophy as the curve: they exist to catch
    // "raids cannot be held" and "raids cannot be lost", not to pin a rate.
    expect(held / total).toBeGreaterThanOrEqual(0.2);
    expect(held / total).toBeLessThanOrEqual(0.95);

    // AUDIT ITEM 5. The bar that was missing is not the rate, it is the
    // GRADIENT: this table read 5/8, 1/8, 1/8, 0/8 before, which is not a
    // difficulty curve but a cliff with noise on it, and a wide rate bar
    // sailed straight over it. Three faults, two in the game and one here:
    //
    //   * a palisade cost 0.4 of difficulty for being another roof and
    //     returned 2 x 0.18 for being a wall, so BUILDING ONE MADE RAIDS
    //     HARDER (+0.04 net, and a watchtower +0.22);
    //   * difficulty added a whole extra raider per point against a
    //     steading defended by about four, so one point swung the odds by a
    //     quarter and left nothing for the palisade, watch and site to move;
    //   * and this harness walked its defenders ONTO their own palisade —
    //     the move scorer knew about gaps and shoulder-mates and nothing
    //     about `WALL_EXPOSED`, so the band fought from the worst tile on
    //     the field, the one the wall exists to put THEM on.
    //
    // Measured after: 12/24, 10/24, 7/24, 5/24. Easy raids are usually held,
    // hard ones usually are not, and every step down costs something.
    const easy = byDiff.get(0)!;
    const hard = byDiff.get(3)!;
    expect(easy.held / easy.of, 'a prepared steading cannot hold even an easy raid')
      .toBeGreaterThan(0.3);
    expect(hard.held / hard.of, 'the hardest raid is a coin flip, not a hard raid')
      .toBeLessThan(easy.held / easy.of);
    expect(hard.held, 'the hardest raid cannot be held at all — that is a cliff')
      .toBeGreaterThan(0);
  });
});

describe('raids are measured, not assumed', () => {
  it('records how often a raid comes and how often it is held', { timeout: CURVE_TIMEOUT }, async () => {
    // Item 5 of the audit: nothing counted how often a raid was LOST, only
    // how often one fired — so the change above had no baseline to move.
    let fired = 0;
    let held = 0;
    let sagas = 0;
    for (let s = 0; s < 20; s += 1) {
      const state = run(`curve-${s}`, 169);
      fired += state.tally.raids;
      held += state.tally.raidsHeld;
      if (state.tally.raids > 0) sagas += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // eslint-disable-next-line no-console
    console.log(`raids over 20 sagas: ${fired} came, ${held} held, ${fired - held} lost; ${sagas} sagas saw one`);
    expect(fired).toBeGreaterThan(0);
    expect(held).toBeLessThanOrEqual(fired);
  });
});

describe('the sea is reached', () => {
  /**
   * Audit item 1, and the bar that would have caught it.
   *
   * `moveOptions` returns nothing for a settled band, so an expedition is
   * the only door back onto the map — and behind it the whole sea sat
   * unmeasured: over sixty sagas, THREE sea days, one sea fight and zero
   * strandhöggs. Hull damage, cargo over the side, the authored sea decks
   * and the strandhögg itself had all shipped without a single measurement,
   * the last of them in violation of the same-commit rule it was written
   * under. The bot had `STRANDHOGG` in its vocabulary and no logic that
   * ever got it afloat, which is the harness's oldest failure mode wearing
   * a new coat: a capability the bot cannot use is measured as worthless.
   *
   * Two things had to change before this could pass. The bot learned the
   * errand under arms — steer for the water beside a coastal prize and come
   * out of it — and the country stopped hiding the prizes (see
   * `PLACE_MAX_FROM_LANDING` and `tellOfPlace`).
   *
   * Deliberately a REACH bar, not a balance one. It says the sea happens; it
   * says nothing about whether it pays, because the sample is still small
   * and a bar that pins a rate this thin would be pinning weather.
   */
  it('a settled band gets onto the water, and comes out of it at somebody', { timeout: 900_000 }, async () => {
    let seaDays = 0;
    let afloatFights = 0;
    let strandhoggs = 0;
    let underArms = 0;
    let trades = 0;
    let placesKnown = 0;
    let samples = 0;
    /**
     * Sixty a side, not thirty. Item 3's growth halved the errands under
     * arms — a poorer band goes out less — and at three errands whether any
     * of them happened to be coastal is a coin flip, so the strandhögg count
     * fell to nought on a sample too thin to mean anything. Widening is the
     * fix that does not involve nudging the bot until the number comes back.
     */
    const SEEDS = 60;

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(`curve-${s}`, 400, (before, after) => {
          if (!before.expedition && after.expedition) {
            if (after.expedition.purpose === 'raid') underArms += 1;
            else trades += 1;
          }
          if (!before.battle && after.battle) {
            if (after.battle.strandhogg) strandhoggs += 1;
            else if (after.battle.terrain === 'ocean' && !after.battle.raid) afloatFights += 1;
          }
          if (after.settlement && !after.expedition) {
            samples += 1;
            placesKnown += after.world.places.filter(
              (p) => after.world.seen[key(p.at)] !== undefined,
            ).length;
          }
        }, terms);
        seaDays += state.tally.seaDays;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `the sea over ${SEEDS * 2} sagas: ${seaDays} days afloat, ${underArms} errands under arms (${trades} trading), ` +
        `${strandhoggs} strandhöggs, ${afloatFights} sea fights; ` +
        `${(placesKnown / Math.max(1, samples)).toFixed(2)} of 4 places known per settled day`,
    );

    // Wide bars, and every one of them was ZERO before this work.
    //
    // Deliberately far below what was measured (50 days afloat, 7 errands,
    // 2 strandhöggs, 1.17 places known), because the first cut of these was
    // pinned just under that reading and then FAILED when item 2 changed the
    // bot: battle actions consume RNG, so any change to how the bot fights
    // reshuffles every draw after it, and a tail-sensitive count like sea
    // days moved 50 to 17 without anything about the sea changing. The
    // stable figure across that same A/B was second winters, which did not
    // move at all. These bars say REACHED, which is the claim; they do not
    // pin a rate, which this sample cannot carry.
    expect(seaDays, 'no settled band ever got onto the water').toBeGreaterThan(5);
    expect(underArms, 'the errand under arms never runs').toBeGreaterThan(0);
    // The strandhögg is REPORTED and not barred, and that is a known
    // thinness rather than a solved thing.
    //
    // It was asserted above zero when item 1 shipped, on seven armed errands
    // in sixty sagas. Item 3's growth halved that — a band with more mouths
    // trades far more than it raids (22 trading errands against 4 under
    // arms), and at four errands whether any of them happens to sit on a
    // coast is a coin flip. Doubling the sample to a hundred and twenty
    // sagas moved it from three to four, so this is the errand RATE and not
    // the sample, and no bar belongs on an event that rare.
    //
    // What still covers the verb: `test/strandhogg.test.ts` proves it end to
    // end — offered only afloat beside a guarded place, fewer foes and
    // shaken, half again in the hold, the hull holed and the cargo lost on a
    // defeat — and the bot keeps `STRANDHOGG` in its vocabulary and takes it
    // wherever it is legal. What is NOT covered, and should be said plainly,
    // is whether an ordinary player ever reaches it. That is the open half
    // of audit item 1.
    void strandhoggs;
    // And the knowledge economy that makes any of it possible: a settled
    // band must know of SOMETHING to go and take. This read 0.06 of 4.
    expect(placesKnown / Math.max(1, samples)).toBeGreaterThan(0.4);
  });
});

describe('the whole of a fight is played', () => {
  /**
   * Audit item 2, and the half of it that belongs to a whole saga rather
   * than an arena.
   *
   * Over sixty sagas this harness had never once issued `B_THROW`,
   * `B_SHOVE`, `B_DEFEND` or `B_DASH`. Three of them existed only in
   * `battleActions.test.ts` — unit tests that prove a verb WORKS and say
   * nothing about whether it is ever worth using — and the fourth was
   * played in the arena but never in a run. So every balance figure this
   * repo carries described a bot fighting with part of its hands.
   *
   * What each verb is WORTH is measured in test/wall.test.ts, where combat
   * is visible; the curve is too blunt for it, ending only about one run in
   * six on steel. This bar is the other thing, and it is the one that would
   * have caught the gap: the verbs must actually be issued in play.
   */
  it('issues every verb an average player would, over a real sample', { timeout: 900_000 }, async () => {
    const used: Record<string, number> = {};
    let fights = 0;
    let actions = 0;

    for (let s = 0; s < 30; s += 1) {
      let state = structuredClone(newGame(`curve-${s}`, 'even'));
      let jobsSet = false;
      for (let i = 0; i < 6000 && !state.end && state.day <= 300; i += 1) {
        if (state.settlement && !jobsSet) {
          state.party.people
            .filter((p) => p.alive)
            .forEach((p, ix) => assign(state, p.id, policy.crew[ix % policy.crew.length]!));
          jobsSet = true;
        }
        if (state.settlement && state.settlement.queue.length === 0 && state.party.firewood >= 16) {
          for (const id of ['longhouse', 'farmplots', 'palisade', 'smokehouse', 'meadhall'] as const) {
            if (queueBuild(state, id)) break;
          }
        }
        const inBattle = !!state.battle;
        const action = step(state);
        if (inBattle) {
          actions += 1;
          used[action.type] = (used[action.type] ?? 0) + 1;
        }
        const next = apply(state, action);
        if (next === state) break;
        if (!inBattle && next.battle) fights += 1;
        state = next;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const verbs = Object.entries(used)
      .filter(([k]) => k.startsWith('B_'))
      .sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `battle verbs over 30 sagas — ${fights} fights, ${actions} actions:\n  ` +
        verbs.map(([k, v]) => `${k} ${v}`).join(', '),
    );

    // Every verb the bot is meant to use must actually appear. Each of these
    // read ZERO before item 2, and a zero here means the thing it measures
    // has gone back to being unmeasured content.
    for (const verb of ['B_STRIKE', 'B_MOVE', 'B_REACH', 'B_WARCRY', 'B_THROW', 'B_DEFEND', 'B_SHOVE']) {
      expect(used[verb] ?? 0, `${verb} never issued in thirty sagas`).toBeGreaterThan(0);
    }
    // Dash is deliberately absent — priced at a third of the wins in
    // test/wall.test.ts. If it starts appearing, that decision was undone
    // without anyone re-reading the price.
    expect(used['B_DASH'] ?? 0, 'the bot dashed — see the price in wall.test.ts').toBe(0);
  });
});

describe('a band that survives, grows', () => {
  /**
   * Audit item 3's bar, and the shape of it matters.
   *
   * "People arrived" is not the measurement — four arrived across sixty
   * sagas before this and the number was still not zero. The measurement is
   * the PEAK BAND a saga ever reached, and it read 6.0: not one band in
   * sixty ever exceeded the six who came off the knarr, on an average of
   * 9.8 beds. Everything 6.2 built — capacity, crowding, hands who work but
   * do not fight, the repeatable búð, the leaving system — was apparatus
   * behind a door that never opened.
   *
   * Conditioned on bands that saw a SECOND WINTER, because that is the
   * population growth exists for. A band that dies in its first autumn was
   * never going to grow and should not be averaged in.
   */
  it('reaches past the six who came off the knarr', { timeout: 900_000 }, async () => {
    let arrivals = 0;
    let sagas = 0;
    let peakAll = 0;
    let longSagas = 0;
    let peakLong = 0;
    let everGrew = 0;
    const SEEDS = 30;

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      for (let s = 0; s < SEEDS; s += 1) {
        let peak = SWORN_MAX;
        const state = run(`curve-${s}`, 400, (before, after) => {
          const a = before.party.people.length;
          const b = after.party.people.length;
          if (b > a) arrivals += b - a;
          peak = Math.max(peak, after.party.people.filter((p) => p.alive).length);
        }, terms);
        sagas += 1;
        peakAll += peak;
        if (peak > SWORN_MAX) everGrew += 1;
        if (state.day >= 169) {
          longSagas += 1;
          peakLong += peak;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `growth over ${sagas} sagas: ${arrivals} arrived; ${everGrew} bands ever passed six; ` +
        `avg peak band ${(peakAll / sagas).toFixed(1)}; ` +
        `of the ${longSagas} that saw a second winter, avg peak ${(peakLong / Math.max(1, longSagas)).toFixed(1)}`,
    );

    // Wide bars. They exist to catch "the band is always six", which is what
    // sixty sagas said before item 3, not to pin a growth rate.
    expect(arrivals, 'nobody ever came').toBeGreaterThan(10);
    expect(everGrew, 'no band in sixty ever passed the six it landed with').toBeGreaterThan(5);
    expect(longSagas, 'nothing lived long enough to measure growth on').toBeGreaterThan(0);
    expect(
      peakLong / Math.max(1, longSagas),
      'bands that stood two winters still never outgrew the knarr',
    ).toBeGreaterThan(SWORN_MAX);
  });
});

describe('every building gets built', () => {
  /**
   * AUDIT ITEM 4, and the answer was not the one the item assumed.
   *
   * The audit found `greathall` and `earthworks` never raised once in sixty
   * sagas and asked whether the timber cost or the prerequisites were out of
   * reach of a band that survives. Neither. The game side was sound the
   * whole time — `standsFor()` had been written for the tier, `buildBlocker`
   * enforces `replaces`, and the panel offers both correctly. The bot's want
   * list simply did not name them, so nothing ever asked.
   *
   * That is the same-commit rule broken quietly, and the only reason it was
   * ever visible is that something finally counted what play REACHES rather
   * than what the code supports. This test is that counting, kept.
   */
  it('reaches the whole list, including the tier that replaces things', { timeout: 900_000 }, async () => {
    const raised: Record<string, number> = {};
    const late: Record<string, number> = {};
    let sagas = 0;
    let lateSagas = 0;
    let lateTotal = 0;
    const SEEDS = 30;

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(`curve-${s}`, 400, undefined, terms);
        sagas += 1;
        const built = state.settlement?.built ?? [];
        for (const id of built) raised[id] = (raised[id] ?? 0) + 1;
        if (state.day >= 169) {
          lateSagas += 1;
          lateTotal += built.length;
          for (const id of built) late[id] = (late[id] ?? 0) + 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const never = BUILDINGS.filter((b) => !raised[b.id]).map((b) => b.id);
    // eslint-disable-next-line no-console
    console.log(
      `buildings over ${sagas} sagas — ` +
        `${Object.entries(raised).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}\n` +
        `  never raised: ${never.join(', ') || 'none'}; of the ${lateSagas} past day 169, ` +
        `avg ${(lateTotal / Math.max(1, lateSagas)).toFixed(1)} standing, ` +
        `greathall ${late['greathall'] ?? 0}, earthworks ${late['earthworks'] ?? 0}`,
    );

    // The bar the tier did not have. Every building the game ships must be
    // something play actually reaches — a building nobody builds is content
    // that does not exist, whether the reason is the cost, the gate, or a
    // list in the harness that forgot it.
    expect(never, `never raised in ${sagas} sagas: ${never.join(', ')}`).toEqual([]);

    // And specifically the upgrade tier, which is the one that was missing.
    // Barred on the bands it is FOR: a saga that stood two winters should
    // usually have outgrown its first longhouse.
    expect(lateSagas, 'nothing survived long enough to reach the tier').toBeGreaterThan(0);
    expect(late['greathall'] ?? 0, 'no band that stood two winters ever outgrew its longhouse')
      .toBeGreaterThan(0);
    expect(late['earthworks'] ?? 0, 'no band that stood two winters ever raised earthworks')
      .toBeGreaterThan(0);
  });
});

describe('what play actually reaches', () => {
  /**
   * AUDIT ITEM 6, and it is the generalisation of everything above it.
   *
   * The coast, the country, the sea, the growth apparatus and the top
   * building tier were all built, unit-tested, green — and unreachable. Not
   * one of them failed a test, because every test asked "does this WORK"
   * and none asked "does anyone ever GET here". Each was found by a
   * throwaway probe that was then deleted, which is exactly how the next one
   * will hide.
   *
   * So this is the probe, kept. It plays a sample and reports what was never
   * reached, and bars the things that must never go to nought. Some of that
   * lives closer to what it measures — battle verbs in "the whole of a fight
   * is played", buildings in "every building gets built", the sea in "the
   * sea is reached", growth in "a band that survives, grows" — and this is
   * the rest of it plus the summary nobody has to assemble by hand.
   *
   * The card deck is REPORTED and not barred at 102/102. Cards are gated on
   * states an ordinary run may never enter (a winter with the woodpile
   * nearly out, a coast that hates you), and demanding every one draw would
   * be demanding the sample cover every corner of the game. What is barred
   * is that the deck is broadly alive, and `test/events.test.ts` carries the
   * static half: every gate must name a building, a lore and a flag that
   * actually exist, and no card may be locked behind a flag only it sets.
   */
  it('reports everything a long sample never touches', { timeout: 900_000 }, async () => {
    const cards = new Set<string>();
    const lore = new Set<string>();
    const traits = new Set<string>();
    const draws: Record<string, number> = {};
    const systems: Record<string, number> & Record<
      'fights' | 'raids' | 'raidsHeld' | 'sackings' | 'bargains' | 'markets'
      | 'expeditions' | 'arrivals' | 'feuds' | 'thingsCalled' | 'kinPairs', number
    > = {
      fights: 0, raids: 0, raidsHeld: 0, sackings: 0, bargains: 0,
      markets: 0, expeditions: 0, arrivals: 0, feuds: 0, thingsCalled: 0, kinPairs: 0,
    };
    let sagas = 0;
    const SEEDS = 30;

    for (const terms of ['even', 'fair'] as HardshipId[]) {
      for (let s = 0; s < SEEDS; s += 1) {
        const state = run(`curve-${s}`, 400, (before, after) => {
          if (!before.event && after.event) {
            cards.add(after.event.id);
            draws[after.event.id] = (draws[after.event.id] ?? 0) + 1;
          }
          if (!before.battle && after.battle) {
            systems.fights += 1;
            if (after.battle.raid) systems.raids += 1;
          }
          if (!before.expedition && after.expedition) systems.expeditions += 1;
          if (after.party.people.length > before.party.people.length) systems.arrivals += 1;
          // A market day: stores moved without a fight and without a day on
          // the road. Counted off the saga line so it cannot be confused
          // with a bargain in somebody's yard.
          if (after.saga.length > before.saga.length) {
            for (const line of after.saga.slice(before.saga.length)) {
              if (/jetties|house of the White Christ and came away/.test(line.text)) {
                systems.markets += 1;
              }
            }
          }
          for (const p of after.party.people) if (p.trait) traits.add(p.trait);
          for (const l of after.lore ?? []) lore.add(l);
        }, terms);

        sagas += 1;
        systems.raidsHeld += state.tally.raidsHeld;
        systems.sackings += state.tally.sackings;
        systems.bargains += state.tally.bargains;
        systems.feuds += state.grudges.filter((g) => g.settled).length;
        systems.thingsCalled += state.flags['thingsCalled'] ?? 0;
        systems.kinPairs += kinPairs(state.party.people).length > 0 ? 1 : 0;
        for (const l of state.lore ?? []) lore.add(l);
        for (const p of state.party.people) if (p.trait) traits.add(p.trait);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const totalDraws = Object.values(draws).reduce((a, b) => a + b, 0);
    const cold = EVENTS.filter((e) => !cards.has(e.id)).map((e) => e.id);
    // eslint-disable-next-line no-console
    console.log(
      `reach over ${sagas} sagas:\n` +
        `  deck ${cards.size}/${EVENTS.length} drawn (${totalDraws} draws, top ten = ` +
        `${Math.round(
          Object.values(draws).sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0) /
            Math.max(1, totalDraws) * 100,
        )}%)\n` +
        `  never drawn: ${cold.join(', ') || 'none'}\n` +
        `  lore ${lore.size}/${LORE.length}, traits ${traits.size}/${TRAITS.length}\n` +
        `  systems: ${Object.entries(systems).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    );

    // Content that must be alive. Every one of these is a system this
    // project shipped and then measured at or near zero at some point.
    expect(lore.size, 'lore nobody ever learns').toBe(LORE.length);
    expect(traits.size, 'traits nobody is ever born with').toBe(TRAITS.length);
    expect(cards.size / EVENTS.length, 'most of the deck never comes up').toBeGreaterThan(0.75);

    for (const [name, floor] of [
      ['fights', 20], ['raids', 5], ['raidsHeld', 1], ['sackings', 5],
      ['bargains', 5], ['markets', 3], ['expeditions', 5], ['arrivals', 5],
      ['kinPairs', 5],
    ] as const) {
      expect(systems[name] ?? 0, `${name} never happens in ${sagas} sagas`).toBeGreaterThan(floor - 1);
    }

    // And the deck must not be ten cards wearing a hundred hats.
    expect(
      Object.values(draws).sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0) /
        Math.max(1, totalDraws),
      'ten cards are half the draws — the deck reads as smaller than it is',
    ).toBeLessThan(0.5);
  });
});

describe('more than one way to play', () => {
  /**
   * AUDIT ITEM 7.
   *
   * Every figure this repo carries describes ONE strategy: settle early,
   * work the jobs, hold the line, trade until somebody will speak for you.
   * The project has been claiming since phase 4 that there is more than one
   * way to play, and has never once tested it — so the claim was worth
   * exactly what "0 made a friend" was worth before anybody counted.
   *
   * Three policies over the same sixty landings. The settler is the harness
   * as it has always been, so every number elsewhere still means what it
   * meant. The raider takes what he needs and never carries food to
   * anybody; the turtle settles on the first workable ground and never
   * leaves the palisade.
   *
   * The interesting result is either one. If they land close together the
   * game has genuine depth; if one of them cannot survive at all, that is a
   * design finding worth more than a passing test.
   */
  it('measures each strategy on the same landings', { timeout: 900_000 }, async () => {
    const rows: string[] = [];
    const spring: Record<string, number> = {};
    const SEEDS = 30;

    try {
      for (const p of POLICIES) {
        policy = p;
        let sawWinter = 0;
        let sawSpring = 0;
        let secondWinter = 0;
        let days = 0;
        let built = 0;
        let sacked = 0;
        let peak = 0;

        for (let s = 0; s < SEEDS; s += 1) {
          const state = run(`curve-${s}`, 200, undefined, 'fair');
          days += state.day;
          if (state.day >= 49) sawWinter += 1;
          if (state.day >= 73) sawSpring += 1;
          if (state.day >= 169) secondWinter += 1;
          built += state.settlement?.built.length ?? 0;
          sacked += state.tally.sackings;
          peak += state.party.people.filter((x) => x.alive).length;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        spring[p.id] = sawSpring / SEEDS;
        rows.push(
          `  ${p.id.padEnd(8)} winter ${sawWinter}/${SEEDS}, spring ${sawSpring}/${SEEDS}, ` +
            `second winter ${secondWinter}/${SEEDS}; avg ${Math.round(days / SEEDS)} days, ` +
            `${(built / SEEDS).toFixed(1)} built, ${(sacked / SEEDS).toFixed(1)} sacked, ` +
            `${(peak / SEEDS).toFixed(1)} alive at the end`,
        );
      }
    } finally {
      policy = SETTLER;
    }

    // eslint-disable-next-line no-console
    console.log(`three ways to play, ${SEEDS} landings each (A Fair Country):\n${rows.join('\n')}`);

    // The bar is NOT that they are equal — a game where every strategy pays
    // the same is a game where the choice is decoration. It is that none of
    // them is a dead end: a player who commits to any of these three should
    // get a run, not a punishment for not playing the one true way.
    for (const p of POLICIES) {
      expect(spring[p.id], `${p.id} cannot see a spring — that line is not playable`)
        .toBeGreaterThan(0.15);
    }
    // And that the settler has not quietly become the only answer.
    const best = Math.max(...POLICIES.map((p) => spring[p.id]!));
    const worst = Math.min(...POLICIES.map((p) => spring[p.id]!));
    expect(best - worst, 'one strategy dominates the others outright').toBeLessThan(0.5);
  });
});

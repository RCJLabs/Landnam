// The turn cycle: whose turn it is, playing out the foes' turns, and handing
// the field back to travel when it is settled.

import { popMode } from '../modes';
import type { Battle, GameState, Terrain } from '../state/types';
import { chronicle } from './saga';
import {
  activeCombatant,
  beginBattle,
  effective,
  isWarbandTurn,
  refreshTurn,
  standing,
} from './battle';
import { SCAR_MAX } from './battle';
import { takeFoeTurn } from './battleAi';
import { beat } from './beats';
import { pressureAtTurnStart, takeBrokenTurn } from './morale';
import { settleAftermath, type Aftermath } from './consequences';
import { holdSteading, sackSteading } from './raid';
import { settlePlace } from './places';
import { sackCamp } from './plunder';
import { isSeaFight, settleSeaFight } from './sea';
import { noteRaidSent } from './neighbours';
import { bonus } from './lore';
import { note } from './tally';
import { checkRunEnd } from './upkeep';
import { stopAt } from './route';

/**
 * Pure safety net on the auto-played foe turns. Generous enough never to fire
 * in real play — the round limit is what actually ends a grinding fight — but
 * finite, so a bad state cannot spin forever.
 */
const MAX_AUTO_TURNS = 2000;

/**
 * A fight that cannot end is worse than a fight that ends badly: BATTLE must
 * always hand control back. If neither side can finish it in this many
 * rounds, the field is decided on who is still upright.
 */
export const ROUND_LIMIT = 50;

export function checkOutcome(battle: Battle): void {
  if (battle.outcome) return;
  // A side is beaten when nobody is left standing, and equally when everyone
  // still up has lost their nerve — a broken line has already lost the field.
  const ours = standing(battle, 'warband').length;
  const theirs = standing(battle, 'foe').length;
  const oursWilling = effective(battle, 'warband').length;
  const theirsWilling = effective(battle, 'foe').length;

  if (theirs === 0) {
    battle.outcome = 'won';
    beat(battle, { kind: 'ended', outcome: 'won', why: 'wiped' });
  } else if (ours === 0) {
    battle.outcome = 'lost';
    beat(battle, { kind: 'ended', outcome: 'lost', why: 'wiped' });
  } else if (theirsWilling === 0 && oursWilling > 0) {
    battle.outcome = 'won';
    beat(battle, { kind: 'ended', outcome: 'won', why: 'broke' });
    battle.log.push('Their line broke, and what was left of it ran.');
  } else if (oursWilling === 0 && theirsWilling > 0) {
    battle.outcome = 'lost';
    beat(battle, { kind: 'ended', outcome: 'lost', why: 'broke' });
    battle.log.push('Our line broke. There was nothing to do but run.');
  } else if (battle.round > ROUND_LIMIT) {
    battle.outcome = ours >= theirs ? 'won' : 'lost';
    beat(battle, { kind: 'ended', outcome: battle.outcome, why: 'dark' });
    battle.log.push('Neither side could finish it. We drew apart in the dark.');
  }
}

/** Advances to the next fighter still standing. */
function advanceTurn(battle: Battle): void {
  for (let i = 0; i < battle.order.length + 1; i++) {
    battle.turnIndex += 1;
    if (battle.turnIndex >= battle.order.length) {
      battle.turnIndex = 0;
      battle.round += 1;
    }
    if (activeCombatant(battle)) return; // found someone still up
  }
}

/**
 * Plays out foe turns until the warband has the field or the fight is over.
 * Control is never handed back on someone else's turn — there would be no
 * legal action to take, and the player would be stuck watching.
 */
function playUntilOurTurn(state: GameState): void {
  const battle = state.battle;
  if (!battle) return;

  for (let i = 0; i < MAX_AUTO_TURNS; i++) {
    checkOutcome(battle);
    if (battle.outcome) return;

    const active = activeCombatant(battle);
    if (!active) {
      advanceTurn(battle);
      refreshTurn(battle);
      continue;
    }

    // Pressure comes first, because standing surrounded can be the thing
    // that breaks them — and a fighter who breaks right now must be handled
    // as broken, not handed to the player with no legal orders.
    pressureAtTurnStart(state, active);

    // A fighter who has lost their nerve is not taking orders, from the
    // player or from anyone. They rally or they run, and the turn moves on.
    if (active.broken) {
      takeBrokenTurn(state, active);
      checkOutcome(battle);
      if (battle.outcome) return;
      // A rally hands the turn back to whoever it belongs to.
      if (!active.broken && active.side === 'warband') return;
      advanceTurn(battle);
      refreshTurn(battle);
      continue;
    }

    if (active.side === 'warband') return;

    takeFoeTurn(state);
    checkOutcome(battle);
    if (battle.outcome) return;
    advanceTurn(battle);
    refreshTurn(battle);
  }
}

/**
 * Opens a fight and settles it onto the warband's turn, so the field is
 * always playable the moment it appears — even when a foe wins initiative.
 */
/** What a fight is FOR, beyond the people in it. */
export interface Stake {
  placeId?: string;
  campId?: string;
}

export function startBattle(
  state: GameState,
  terrain: Terrain,
  difficulty = 0,
  stake?: Stake,
): void {
  beginBattle(state, terrain, difficulty, false, !!(stake?.campId || stake?.placeId));
  // Stamped before any turn plays out, so a mid-fight save still knows what
  // the fight is for.
  if (state.battle) {
    if (stake?.placeId) state.battle.placeId = stake.placeId;
    if (stake?.campId) state.battle.campId = stake.campId;
  }
  playUntilOurTurn(state);
}

/** Opens a raid on the steading — same machinery, your own ground. */
export function startRaid(state: GameState, difficulty = 0): void {
  // THE GROUND THE HALL STANDS ON, which on a line is its stretch. The
  // steading's `at` is a placeholder on a coast, so this read the LANDING's
  // terrain from every steading — and once the island stopped being generated
  // it read nothing at all and fell back to meadow. A raid fought on the
  // wrong country is a raid whose weather, cover and footing are all somebody
  // else's.
  const terrain = stopAt(state.seed, state.settlement!.stop ?? 0).country;
  // Somebody sent them, and it goes on their account.
  noteRaidSent(state);
  beginBattle(state, terrain, difficulty, true);
  playUntilOurTurn(state);
}

/** Ends the current fighter's turn and plays every foe turn that follows. */
/**
 * Whether the fighter whose turn it is has nothing left to decide.
 *
 * THE TAP THIS EXISTS TO DELETE. Every verb in the fight — strike, reach,
 * throw, shove, defend, the war cry, and changing rank — is gated on
 * `!hasActed` and sets it, so the moment a fighter acts the only legal action
 * left is ending the turn. The screen said so out loud ("nothing left this
 * turn — end it") and then made the player tap it anyway: one mandatory tap
 * per fighter per round with exactly one outcome, which is ceremony rather
 * than a decision.
 *
 * NOT true before acting, and that is why the button stays. A fighter who has
 * not acted CAN end their turn — declining to do anything is a real choice,
 * and on a rank that cannot reach anybody it is often the right one. Only the
 * tap after the blow is dead.
 *
 * AND A BROKEN MAN IS SPENT BEFORE HE STARTS. `activeCombatant` skips the
 * down and the fled but not the broken, so a fighter whose nerve has gone
 * still gets a turn — and every verb refuses him, `broken` sitting in the
 * same guard as `hasActed`. The roadmap's wording ("once a fighter has
 * acted") did not reach him, which would have left the one player most
 * likely to be panicking tapping a button with one outcome. He has nothing
 * to decide either, so his turn ends itself too.
 *
 * A predicate rather than a rule inside the verbs, deliberately. Making
 * `B_STRIKE` end the turn itself would rewrite what an action sequence means:
 * every recorded `[strike, end turn]` pair — the golden runs, the port's
 * parity fixtures, the fights in this suite — would spend the NEXT fighter's
 * turn on the second action. The sim keeps its shape; the view stops asking
 * for a tap it already knows the answer to.
 */
export function turnIsSpent(state: GameState): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;
  if (!isWarbandTurn(state)) return false;
  const active = activeCombatant(battle);
  return !!active && (active.hasActed || active.broken);
}

export function endTurn(state: GameState): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;

  checkOutcome(battle);
  if (battle.outcome) return true;

  advanceTurn(battle);
  refreshTurn(battle);
  playUntilOurTurn(state);
  return true;
}

/**
 * Leaves the field: pops BATTLE, settles everything the fight leaves behind,
 * and picks the warband back up. This is where a battle stops being reversible
 * — the dead stay dead and the maimed carry it.
 */
/**
 * What became of the enemy's named man.
 *
 * Down means dead and gone: the clan loses its champion and has to find
 * another, which is what makes hunting him on the field worth a blow that
 * could have gone anywhere. Anything else — he fled, he was still standing
 * when we broke, the fight simply ended around him — means he got away, and
 * a man who gets away comes back worse.
 */
function settleChampion(state: GameState, battle: Battle): void {
  const id = battle.champion;
  const clanId = battle.championOf;
  if (!id || !clanId) return;
  const clan = state.neighbours.find((n) => n.id === clanId);
  if (!clan?.champion) return;
  const him = battle.combatants.find((c) => c.personId === id);
  const name = `${clan.champion.name} ${clan.champion.byname}`;

  if (him?.down) {
    delete clan.champion;
    chronicle(state, `${name} was put down, and ${clan.name} lost the man who led them.`, 'good');
    return;
  }
  clan.champion = {
    ...clan.champion,
    scars: Math.min(SCAR_MAX, clan.champion.scars + 1),
    lastSeen: state.day,
  };
  chronicle(state, `${name} got off the field alive. He will have marked us for it.`, 'grim');
}

export function leaveBattle(state: GameState): Aftermath | undefined {
  const battle = state.battle;
  if (!battle || !battle.outcome) return undefined;

  const won = battle.outcome === 'won';
  const wasRaid = battle.raid === true;

  // The field first — deaths, wounds, loot and what the living learned — so
  // the closing lines can speak to what it actually cost.
  const aftermath = settleAftermath(state, battle);
  if (won) note(state, 'battlesWon');
  note(state, 'foesFelled', aftermath.foesDown);

  // A raid is the only fight where the ground itself is the stake.
  if (wasRaid && state.settlement) {
    if (won) holdSteading(state, aftermath.foesDown);
    else sackSteading(state);
  }

  // A fight FOR something pays out only if the field was won. A place lost
  // is left standing to come back for; a camp that threw you back keeps its
  // stores and its opinion of you.
  if (battle.placeId && won) settlePlace(state, battle.placeId, battle.strandhogg === true);
  if (battle.campId && won) sackCamp(state, battle.campId);
  // Afloat, the hull and the packs are always at stake, both ways — and a
  // raid off the water is fought with the ship behind you, so it settles the
  // same way. There is no walking home from a beach you were thrown off.
  if (isSeaFight(battle) || battle.strandhogg) settleSeaFight(state, won);

  // Their man, settled up. He is either dead for good or he is out there
  // with one more scar and a longer memory — the recurring antagonist is
  // the entire point, and it only works if killing him is FINAL and letting
  // him go is not.
  settleChampion(state, battle);

  // Running is remembered. It costs the band's heart even in victory.
  if (aftermath.ran.length > 0) {
    state.party.morale = Math.max(0, state.party.morale - aftermath.ran.length * 4);
    chronicle(
      state,
      `${aftermath.ran.join(' and ')} ran, and came back to us later saying nothing.`,
      'grim',
    );
  }

  // Every death drags on the band harder than the win lifts it. That asymmetry
  // is the whole point of the milestone: a victory you paid a veteran for is
  // not a victory you want twice.
  // A band that can cut a name in stone carries its dead differently. It does
  // not make the death cheaper — it makes it bearable, which is not the same.
  const solace = Math.max(0, Math.min(0.8, bonus(state, 'solace')));
  const bereaved = aftermath.killed.length * 12 * (1 - solace);

  if (won) {
    state.party.morale = Math.min(100, Math.max(0, state.party.morale + 10 - bereaved));
    chronicle(
      state,
      aftermath.killed.length > 0
        ? 'We held the ground, and it was not worth what we left on it.'
        : aftermath.maimed.length > 0
          ? 'We held the ground, and carried our hurt off it.'
          : 'We held the ground, and none of us stayed on it.',
      aftermath.killed.length > 0 ? 'grim' : 'good',
    );
  } else {
    state.party.morale = Math.max(0, state.party.morale - 15 - bereaved);
    chronicle(state, 'They broke us, and we ran. What we left behind we left behind.', 'grim');
  }

  const next = popMode(state);
  state.modes = next.modes;
  delete state.battle;
  state.aftermath = aftermath;

  // A fight can finish the run outright — there may be nobody left to walk on.
  checkRunEnd(state, 0);
  return aftermath;
}

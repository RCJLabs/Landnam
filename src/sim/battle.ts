// BATTLE mode. Turn order from stats, move plus one action per turn, and a
// result that hands control back to travel.
//
// Fighters are Person objects on both sides; a Combatant only says where
// they stand and what they have left this turn.

import { key } from '../hex';
import type { Rng } from '../rng';
import { stream } from '../rng';
import {
  CHAMPION_BYNAMES,
  FOE_ARCHETYPES,
  FOE_BYNAMES,
  FOE_NAMES,
  archetypeById,
  type FoeArchetype,
} from '../data/foes';
import type { Battle, Champion, Combatant, GameState, Person, Stats, Terrain } from '../state/types';
import { pushMode } from '../modes';
import { beat } from './beats';
import { canActFrom, canLandOn } from './ranks';
import { effectiveStat, standAtHome, sworn } from './people';
import { wintersStood } from './calendar';
import { fieldCrew, homeCrew } from './expedition';
import { standsFor } from './colony';
import { raidSource } from './neighbours';
import { note } from './tally';
import { chronicle } from './saga';
import { startingNerve } from './morale';
import { weightFor, wordBump, wordOf } from './word';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  generateBattlefield,
  groundName,
  pickRaidField,
  pickSeaField,
  seaFieldFrom,
  steadingFieldFrom,
} from './battlefield';

export const BASE_MOVES = 3;

// --- Lookups ---

/**
 * A foe's archetype, recovered from the trait we stamped at generation.
 * Warband members have no archetype — they have traits instead.
 */
export function archetypeOf(person: Person): FoeArchetype | undefined {
  if (!person.trait.startsWith('foe:')) return undefined;
  return archetypeById(person.trait.slice(4));
}

export function fighterPerson(state: GameState, personId: string): Person | undefined {
  return (
    state.party.people.find((p) => p.id === personId) ??
    state.battle?.foes.find((p) => p.id === personId)
  );
}

/** Still on the field: not dropped, not run off. Broken fighters still count. */
export function standing(battle: Battle, side: Combatant['side']): Combatant[] {
  return battle.combatants.filter((c) => c.side === side && !c.down && !c.fled);
}

/** Still fighting: standing AND willing. What decides a fight. */
export function effective(battle: Battle, side: Combatant['side']): Combatant[] {
  return standing(battle, side).filter((c) => !c.broken);
}

export function activeCombatant(battle: Battle): Combatant | undefined {
  const personId = battle.order[battle.turnIndex % battle.order.length];
  return battle.combatants.find((c) => c.personId === personId && !c.down && !c.fled);
}

export function isWarbandTurn(state: GameState): boolean {
  const battle = state.battle;
  if (!battle || battle.outcome) return false;
  return activeCombatant(battle)?.side === 'warband';
}

// --- Foe generation ---

function makeFoe(rng: Rng, archetypeId: string, index: number): Person {
  const archetype = archetypeById(archetypeId) ?? FOE_ARCHETYPES[1]!;
  const stats: Stats = { might: 1, wits: 1, spirit: 1, craft: 1 };
  let left = archetype.budget;
  let guard = 200;
  while (left > 0 && guard-- > 0) {
    // Favoured stats appear more than once in the pool, so they win more often.
    const pool: (keyof Stats)[] = [...archetype.favours, 'might', 'wits', 'spirit', 'craft'];
    const stat = rng.pick(pool);
    if (stats[stat] < 6) {
      stats[stat] += 1;
      left -= 1;
    }
  }
  const maxHealth = Math.max(4, 8 + stats.might * 2 + archetype.toughness);
  return {
    // A foe is a Person like anyone else, and every foe on a field is there
    // to fight — there is no such thing as a raider's kitchen hand.
    bond: 'sworn',
    id: `foe_${index}`,
    name: rng.pick(FOE_NAMES),
    byname: rng.pick(FOE_BYNAMES),
    age: rng.int(18, 45),
    stats,
    trait: `foe:${archetype.id}`,
    health: maxHealth,
    maxHealth,
    morale: 60,
    injuries: [],
    xp: 0,
    alive: true,
  };
}

/** The most a wandering encounter brings, and the most a raid brings. */
export const MAX_FOES = 6;
export const MAX_RAIDERS = 9;

/**
 * The most a raid can bring against a steading worth coming for.
 *
 * Two deployment rows of seven is fourteen bodies, and that is the hard
 * ceiling — a raid that cannot be put on the field is not a raid.
 */
export const MAX_RAIDERS_FAMED = 14;

/**
 * How many they actually field. This is 6.3's whole mechanism, and it exists
 * because of a measured dead end: raising raid PRESSURE did nothing at three
 * separate magnitudes, and the reason turned out to be arithmetic rather than
 * design. With six sworn, `rollFoes` reaches the old cap of nine at
 * difficulty four, so every point of pressure past that was being thrown away
 * by a Math.min. The lever was disconnected from the thing it moved.
 *
 * A hall that has stood years, is full of building, and has a store worth
 * crossing the country for, now draws more than nine — and the warband is
 * capped at six for good, so the answer can never be to field more of your
 * own. It has to be the wall, the watch, and who on this coast owes you
 * anything.
 */
export function raiderCap(state: GameState): number {
  const home = state.settlement;
  if (!home) return MAX_RAIDERS;
  // A jarl's hall is the richest thing on the coast and everybody knows
  // where it is. Ruling on has to COST, or 6.4 is a victory lap.
  const fame = wintersStood(state.day) + home.built.length * 0.5 + (state.jarl ? 2 : 0);
  return Math.min(MAX_RAIDERS_FAMED, MAX_RAIDERS + Math.floor(fame));
}

/**
 * What the warband is up against, scaled loosely to its own strength.
 *
 * A raid brings more than a chance meeting does: nobody crosses the country
 * for somebody else's store with four scouts. Without the larger cap a full
 * band behind a palisade simply cannot be threatened, and the wall stops
 * being a mitigation and becomes an off-switch.
 */
/**
 * The most an open-field fight can bring, grown a little by word: a band the
 * coast talks about draws crowds. Two extra at the very most — the warband
 * is six and every fight is balanced against that width.
 *
 * This exists because of the Math.min lesson: with six sworn the count
 * formula reaches MAX_FOES at difficulty two, so any escalation routed
 * through difficulty alone was being thrown away by the cap. Raising the
 * cap with word is what lets the difficulty bump BIND.
 */
export function foeCapFor(state: GameState): number {
  return MAX_FOES + Math.min(2, Math.floor(wordOf(state) / 3));
}

/** Exported for the prove-it-binds tests: escalation has been swallowed by
 *  a clamp before, and nobody trusts an unmeasured knob here any more. */
/**
 * How many more of them a point of raid difficulty is worth.
 *
 * One-for-one was the cliff, and the arithmetic of small numbers is why. A
 * steading is defended by about four people, so every point of difficulty
 * was a 25% swing in the odds — measured, the gauntlet held 5 of 8 at
 * difficulty 0 and 1 of 8 at difficulty 1. A single extra body took a fight
 * a prepared band usually won to one it almost always lost, which leaves no
 * room at all for the palisade, the watch and the site to mean anything:
 * every term they move is worth less than the rounding.
 *
 * Halved, so the scalar has somewhere to act. Open-field fights are
 * untouched — they are fought by a full warband on ground nobody built, and
 * the arena in test/wall.test.ts is tuned against them.
 */
export const RAID_PER_POINT = 0.5;

/**
 * How many they field. Split out of `rollFoes` so that a screen can tell the
 * player what they are walking into using the SAME arithmetic the fight is
 * built from — the alternative is a second copy of this sum in the UI, which
 * would be wrong the first time either changed.
 */
export function foeCount(
  warbandSize: number,
  difficulty: number,
  raid = false,
  cap = raid ? MAX_RAIDERS : MAX_FOES,
): number {
  const base = warbandSize * (raid ? 0.9 : 0.6);
  return Math.max(
    1,
    Math.min(cap, Math.round(base + difficulty * (raid ? RAID_PER_POINT : 1))),
  );
}

export function rollFoes(
  rng: Rng,
  warbandSize: number,
  difficulty: number,
  raid = false,
  cap = raid ? MAX_RAIDERS : MAX_FOES,
  word = 0,
): Person[] {
  const count = foeCount(warbandSize, difficulty, raid, cap);
  const foes: Person[] = [];
  for (let i = 0; i < count; i++) {
    const archetype = rng.weighted(FOE_ARCHETYPES, (a) => weightFor(a, word));
    foes.push(makeFoe(rng, archetype.id, i + 1));
  }
  return foes;
}

/** What leading a band adds to the man who leads it. */
export const CHAMPION_MIGHT = 1;
export const CHAMPION_SPIRIT = 1;
export const CHAMPION_TOUGHNESS = 4;

/**
 * What each field he has walked off alive is worth to him.
 *
 * Capped, and capped low: a foe who compounds without limit stops being a
 * recurring antagonist and becomes a wall the run ends against. Four scars
 * is +4 might-or-nothing (the stat cap bites first) and +8 hide — worse
 * every time, killable every time.
 */
export const SCAR_MAX = 4;
export const SCAR_TOUGHNESS = 2;

/**
 * Raises the strongest of a band to lead it, and returns him. He keeps his
 * archetype and trades up everything else: a heavier byname, a point of
 * might and spirit, and hide enough to be worth singling out. Nobody leads
 * a band of one — callers gate on size.
 *
 * `known` is a man who has done this before. He arrives under his own name
 * with his scars on him, because the whole value of a recurring enemy is
 * that the player recognises him.
 */
export function anointChampion(foes: Person[], rng: Rng, known?: Champion): Person {
  const champion = foes.reduce((a, b) => (b.maxHealth > a.maxHealth ? b : a));
  const scars = Math.min(SCAR_MAX, known?.scars ?? 0);
  champion.name = known?.name ?? champion.name;
  champion.byname = known?.byname ?? rng.pick(CHAMPION_BYNAMES);
  champion.stats.might = Math.min(6, champion.stats.might + CHAMPION_MIGHT + scars);
  champion.stats.spirit = Math.min(6, champion.stats.spirit + CHAMPION_SPIRIT);
  champion.maxHealth += CHAMPION_TOUGHNESS + scars * SCAR_TOUGHNESS;
  champion.health = champion.maxHealth;
  return champion;
}

// --- Setting up ---

/** Initiative: quick wits act first, with a roll to break the ties. */
function rollInitiative(state: GameState, battle: Battle, rng: Rng): string[] {
  const scored = battle.combatants.map((c) => {
    const person = fighterPerson(state, c.personId);
    const wits = person ? effectiveStat(person, 'wits') : 1;
    const initiative = wits * 2 + rng.roll(1, 6);
    c.initiative = initiative;
    return { personId: c.personId, initiative };
  });
  scored.sort((a, b) => b.initiative - a.initiative || a.personId.localeCompare(b.personId));
  return scored.map((s) => s.personId);
}

/**
 * Creates the battle and pushes BATTLE onto the mode stack.
 * Mutates — callers are already working on a state clone.
 */
export function beginBattle(
  state: GameState,
  terrain: Terrain,
  difficulty = 0,
  raid = false,
  /** The band went out and picked this fight, rather than meeting one. */
  picked = false,
): void {
  state.modes = pushMode(state, 'BATTLE').modes;
  const rng = stream(state.seed, 'combat').derive(
    `${raid ? 'raid' : 'battle'}:${state.day}:${key(state.party.at)}`,
  );

  // A raid is fought on the ground you built, and a fight afloat on an
  // authored pair of ships — everything else on ground rolled from the
  // country. See data/raidFields.ts and data/seaFields.ts.
  const home = state.settlement;
  const raidField = raid && home ? pickRaidField(home.plots.map((p) => p.kind), rng.derive('ground')) : undefined;
  const seaField = !raid && terrain === 'ocean' ? pickSeaField(rng.derive('ground')) : undefined;
  const { grid } =
    raidField && home
      ? steadingFieldFrom(raidField, standsFor(state, 'palisade'))
      : seaField
        ? seaFieldFrom(seaField)
        : generateBattlefield(terrain, rng.derive('ground'));
  // A raid is fought by whoever stayed at the steading; a fight out on the
  // road is fought by whoever went. Sending your warriors away is exactly the
  // decision this makes real.
  // Only the sworn stand in a line. The hands are at the steading and stay
  // there whatever is happening outside — that is the whole bargain of 6.2:
  // more people is more work done, never a wider shield wall.
  // At home, everyone who is there stands — see `standAtHome`. On the road,
  // the line is the sworn who walked there.
  const ourSide = raid ? standAtHome(homeCrew(state)) : sworn(fieldCrew(state));
  // Word reaches the open field only: the home raid has its own escalation,
  // and sackings already arrive there through standing.
  // Nor does word decide WHO is standing there, for the same reason it does
  // not decide how many. `weightFor` leans a famous band's fights toward
  // huscarls, and against a camp the player chose to walk into that meant
  // the fishing village quietly fielded veterans because the attacker was
  // well known. Word is what comes LOOKING for you.
  const word = raid || picked ? 0 : wordOf(state);
  const foes = rollFoes(
    rng.derive('foes'),
    Math.max(1, ourSide.length),
    // Word does NOT harden a fight the band PICKED, and that is task 31's
    // answer. `wordOf` counts sackings, so every camp a band fell on made
    // the next camp it fell on bigger — measured, the raider drew steel on
    // camps 85 times and won 4, and the more it raided the worse the odds
    // got. Word means more men come LOOKING for a known band; it cannot
    // mean the camp you walk into has quietly recruited. The archetype mix
    // still leans harder everywhere (`weightFor`), so fame is still felt in
    // WHO stands there, just not in how many.
    raid || picked ? difficulty : difficulty + wordBump(state),
    raid,
    raid ? raiderCap(state) : foeCapFor(state),
    word,
  );

  // Every raid is led — nobody crosses the country for another man's store
  // without somebody whose idea it was. The open field earns a name only
  // once word has spread: the same threshold that makes a fight bigger is
  // the one that makes it somebody's.
  //
  // A RAID's leader belongs to whoever sent it, and if that clan already has
  // a man who walked off our field alive, it is him again — same name, same
  // byname, one more scar. Open-field champions stay nameless-until-met:
  // nobody sent them, so there is nobody for them to come back to.
  const sender = raid ? raidSource(state) : undefined;
  const champion =
    foes.length >= 2 && (raid || wordBump(state) > 0)
      ? anointChampion(foes, rng.derive('champion'), sender?.champion)
      : undefined;
  const returning = (sender?.champion?.scars ?? 0) > 0;
  if (champion && sender) {
    // Remembered from the moment he sets foot on the field, so a save taken
    // mid-fight still knows whose man he is.
    sender.champion = {
      name: champion.name,
      byname: champion.byname,
      scars: sender.champion?.scars ?? 0,
      lastSeen: state.day,
    };
  }

  const battle: Battle = {
    terrain,
    ...(raid ? { raid: true } : {}),
    ...(champion ? { champion: champion.id } : {}),
    ...(champion && sender ? { championOf: sender.id } : {}),
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    grid,
    foes,
    combatants: [],
    order: [],
    turnIndex: 0,
    round: 1,
    log: [],
    beats: [],
  };

  // Deployment used to be a placement problem: find a free, passable spot on
  // the authored grid, prefer elbow room, and if there was nowhere left the
  // fighter simply did not stand. Since 8.1d a fighter's place is his RANK
  // and there is no ground to place him on, so the whole search is gone and
  // everyone who turned up stands, in the order they turned up.
  //
  // Measured before cutting, because "and then nobody deploys" is exactly the
  // kind of rule that turns out to be load-bearing: across 40 open fights and
  // 20 raids the spot search refused NOBODY. It was capping a number the band
  // rules had already capped.

  for (const person of ourSide) {
    battle.combatants.push({
      personId: person.id,
      side: 'warband',
      // The order they took the field is the order they stand in, front
      // first. This was a note ABOUT a hex once; it is the whole of where
      // somebody is now.
      rank: battle.combatants.filter((c) => c.side === 'warband').length + 1,
      initiative: 0,
      movesLeft: BASE_MOVES,
      hasActed: false,
      // Everyone carries something worth throwing once.
      throwsLeft: 1,
      defending: false,
      kills: 0,
      nerve: 0,
      broken: false,
      fled: false,
      down: false,
    });
  }

  for (const foe of foes) {
    battle.combatants.push({
      personId: foe.id,
      side: 'foe',
      rank: battle.combatants.filter((c) => c.side === 'foe').length + 1,
      initiative: 0,
      movesLeft: BASE_MOVES,
      hasActed: false,
      throwsLeft: archetypeOf(foe)?.throws ?? 1,
      defending: false,
      kills: 0,
      nerve: 0,
      broken: false,
      fled: false,
      down: false,
    });
  }

  note(state, 'battles');
  if (raid) note(state, 'raids');
  state.battle = battle;
  // Nerve needs the battle in place, because it reads each fighter's Person.
  for (const c of battle.combatants) c.nerve = startingNerve(state, c.personId);
  battle.order = rollInitiative(state, battle, rng.derive('initiative'));
  if (raid && home) {
    // A raid with a name on it reads differently from weather. If nobody on
    // the coast has a quarrel with us, it is strangers and stays strangers.
    // The approach line comes off the authored field, so the ground is the
    // first thing the log says about the fight.
    const from = raidSource(state);
    battle.log.push(
      `${raidField?.line ?? `They came at ${home.name} out of the trees.`}` +
        ` ${foes.length} against ${standing(battle, 'warband').length}.` +
        (champion
          ? returning
            ? ` ${champion.name} ${champion.byname} had come back for us.`
            : ` ${champion.name} ${champion.byname} led them.`
          : '') +
        (from ? ` ${from.name} had not forgotten us.` : '') +
        (standsFor(state, 'palisade') ? ' The wall was between us.' : ''),
    );
    chronicle(
      state,
      from
        ? `Men out of ${from.name} came on ${home.name} before we saw them.`
        : `Raiders came on ${home.name} before we saw them.`,
      'grim',
    );
  } else {
    battle.log.push(
      `${seaField ? `${seaField.line} ` : ''}They met us on ${groundName(terrain)}. ${foes.length} against ${standing(battle, 'warband').length}.` +
        // Escalation must never be a hidden punishment: when word is what
        // made this fight bigger or harder, the log says so — and names
        // the man it drew.
        (wordBump(state) > 0 ? ' They had heard of us.' : '') +
        (champion ? ` ${champion.name} ${champion.byname} had come to see for himself.` : ''),
    );
    chronicle(state, `We were brought to a fight on ${groundName(terrain)}.`, 'grim');
  }
  beat(battle, {
    kind: 'opened',
    raid: raid === true,
    ours: standing(battle, 'warband').length,
    theirs: foes.length,
    ...(champion ? { champion: champion.id } : {}),
  });
  refreshTurn(battle);
}

// --- Movement and reach ---

/** Hexes the active fighter can still reach this turn, zone of control included. */
// `reachableHexes` and `reachCosts` stood here. They answered "where can this
// fighter walk, and what does each step cost", and since 8.1c there is nowhere
// to walk — a fighter's place is their rank, and changing it is `dash`.
//
/** Enemies the active fighter could strike right now. */
export function strikeTargets(state: GameState): Combatant[] {
  const battle = state.battle;
  const active = battle ? activeCombatant(battle) : undefined;
  if (!battle || !active || active.hasActed || battle.outcome) return [];
  if (!canActFrom('strike', active.rank)) return [];
  return battle.combatants.filter(
    (c) => !c.down && !c.fled && c.side !== active.side && canLandOn('strike', c.rank),
  );
}

function refreshTurn(battle: Battle): void {
  const active = activeCombatant(battle);
  if (!active) return;
  active.movesLeft = BASE_MOVES;
  active.hasActed = false;
  // A raised shield lasts until your own next turn, and no longer.
  active.defending = false;
}

export { refreshTurn };

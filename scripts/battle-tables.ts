// Generates the C++ header the port's battle engine reads.
//
//   npm run battle-tables
//
// Third of the generators, and for the same reason as the other two: the
// foes, the ground mixes, the authored fields and the lore are content, they
// live in src/data, and the port must never become a second place to add a
// foe. A separate header from party-tables because a battle-side edit should
// not churn the file that holds names and traits.
//
// **Two orders in here are load-bearing.**
//
//  - `FOE_ARCHETYPES` is walked by `rng.weighted`, which subtracts weights in
//    declaration order until the roll goes negative. Reorder it and every
//    seed fields a different band.
//  - `SEA_FIELDS` and `RAID_FIELDS` are picked by index off `rng.pick`, and
//    `RAID_FIELDS` is FILTERED by what the steading holds before the pick —
//    so the surviving order decides which approach a raid comes by.
//
// The lore table is here rather than in party-tables because the only thing
// that reads it is a fight: `bonus(state,'bite')` on a landed blow and
// `bonus(state,'wall')` on the drill. Both are nought until something is
// learned, which is exactly why they had been hardcoded to nought and needed
// to stop being.

import { writeFileSync } from 'node:fs';
import { FOE_ARCHETYPES, FOE_NAMES, FOE_BYNAMES, CHAMPION_BYNAMES } from '../src/data/foes';
import { RAID_FIELDS } from '../src/data/raidFields';
import { SEA_FIELDS } from '../src/data/seaFields';
import { LORE, type LoreKnob } from '../src/data/lore';
import { INJURIES, LASTING, DEATHS, type InjuryTemplate } from '../src/data/injuries';
import {
  XP_PER_ADVANCE,
  XP_PER_KILL,
  XP_SURVIVED,
  XP_WON,
  LOOT_FOOD_PER_FOE,
  LOOT_WOOD_PER_FOE,
} from '../src/sim/consequences';
import {
  SACK_SHARE,
  SACK_TAKES,
  WORTH_PER_ROOF,
  DEFENCE_PER,
  WATCH_PER,
} from '../src/sim/raid';
import { KIN_GRIEF } from '../src/data/kin';
import { GRIEF_DAYS } from '../src/sim/upkeep';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  MIDDLE_ROWS,
  FRONT_WIDTH,
  WALL_ROW,
} from '../src/sim/battlefield';
import {
  BASE_MOVES,
  MAX_FOES,
  MAX_RAIDERS,
  MAX_RAIDERS_FAMED,
  RAID_PER_POINT,
  CHAMPION_MIGHT,
  CHAMPION_SPIRIT,
  CHAMPION_TOUGHNESS,
  SCAR_MAX,
  SCAR_TOUGHNESS,
} from '../src/sim/battle';
import {
  NERVE_HIT,
  NERVE_ALLY_DOWN,
  NERVE_WALL_SHATTERED,
  NERVE_OUTNUMBERED,
  NERVE_KILL,
  NERVE_LEADER_FELL,
  RALLY_NERVE,
  RALLY_DC,
  STEADIED_PER_LINK,
} from '../src/sim/morale';
import {
  THROW_RANGE,
  DEFEND_BONUS,
  WALL_EXPOSED,
  OUTNUMBERED_PENALTY,
  MAX_OUTNUMBERED,
  WALL_PUSH_MAX,
  REACH_RANGE,
  REACH_PENALTY,
  REACH_DAMAGE_OFF,
  WARCRY_RANGE,
  WARCRY_HEART,
  WARCRY_DREAD,
} from '../src/sim/battleActions';
import { PATIENCE_ROUNDS } from '../src/sim/battleAi';
import { ROUND_LIMIT } from '../src/sim/battleTurn';
import { DISENGAGE_COST } from '../src/sim/zoc';
import { WALL_BONUS_ONE, WALL_BONUS_FULL, SHIELD_IN_WALL } from '../src/sim/wall';
import { NERVE_KIN_FELL } from '../src/data/kin';
import { JARL_WORD } from '../src/sim/word';

const quote = (s: string): string => JSON.stringify(s);
const list = (values: readonly string[]): string => `{ ${values.map(quote).join(', ')} }`;

/**
 * A number, checked.
 *
 * Same guard party-tables grew: a constant that stops being exported comes
 * through as `undefined` and would be written into C++ as the string
 * "undefined", which compiles to nothing useful and diverges silently.
 */
const num = (n: number): string => {
  if (typeof n !== 'number' || Number.isNaN(n)) {
    throw new Error(`battle-tables: not a number (${String(n)}) — is it still exported?`);
  }
  return Number.isInteger(n) ? String(n) : String(n);
};

/** The knobs, in the order the generated struct declares them. */
const KNOBS: LoreKnob[] = ['check', 'solace', 'sea', 'bite', 'warmth', 'mend', 'physic', 'wall'];

/**
 * One injury template.
 *
 * `effect` is a Partial<Stats> and the ABSENT keys matter: the canonical form
 * drops them rather than writing a nought, so the header carries a present
 * flag per stat instead of four numbers.
 */
function injury(i: InjuryTemplate): string {
  const stat = (k: 'might' | 'wits' | 'spirit' | 'craft'): string =>
    i.effect[k] === undefined ? 'false, 0' : `true, ${num(i.effect[k]!)}`;
  return `\t\t{ ${quote(i.label)}, ${num(i.heals)}, `
    + `${stat('craft')}, ${stat('might')}, ${stat('spirit')}, ${stat('wits')} },`;
}

export function renderBattleTables(): string {
  const archetypes = FOE_ARCHETYPES.map(
    (a) =>
      `\t\t{ ${quote(a.id)}, ${quote(a.kind)}, ${a.budget}, ${list(a.favours)}, `
      + `${a.toughness}, ${quote(a.temperament)}, ${a.throws}, ${a.weight}, ${num(a.renown)} },`,
  ).join('\n');

  const lore = LORE.map(
    (l) => `\t\t{ ${quote(l.id)}, ${KNOBS.map((k) => num(l[k] ?? 0)).join(', ')} },`,
  ).join('\n');

  const seaFields = SEA_FIELDS.map(
    (f) => `\t\t{ ${quote(f.id)}, ${quote(f.line)}, ${list(f.rows)} },`,
  ).join('\n');

  const raidFields = RAID_FIELDS.map(
    (f) =>
      `\t\t{ ${quote(f.id)}, ${quote(f.line)}, ${quote(f.needs ?? '')}, ${list(f.rows)} },`,
  ).join('\n');

  const injuries = INJURIES.map(injury).join('\n');
  const lasting = LASTING.map(injury).join('\n');

  return `// GENERATED by scripts/battle-tables.ts — do not edit.
//
//   npm run battle-tables
//
// The foes, the ground, the authored fields and the lore, out of src/data.
// Content is authored in ONE place and this is a copy of it, which is the
// project's oldest architectural rule carried across the port.
//
// Order is load-bearing twice over: \`FOE_ARCHETYPES\` is walked by
// \`rng.weighted\` in declaration order, and the two field tables are picked
// out of by index. Both are emitted exactly as declared.

#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace Landnam
{
namespace Tables
{
	// ---- The men who come (src/data/foes.ts) ----

	struct FFoeArchetype
	{
		std::string Id;
		std::string Kind;
		/** Points spread over the four stats, on top of a base of 1 each. */
		int32_t Budget;
		/**
		 * Leans the spread toward these. Favoured stats appear MORE THAN ONCE
		 * and the pool is these followed by all four in stat order, so a
		 * favourite is drawn more often — the duplication IS the weighting.
		 */
		std::vector<std::string> Favours;
		int32_t Toughness;
		std::string Temperament;
		int32_t Throws;
		int32_t Weight;
		/**
		 * How much the band's word moves this one's odds. The port's
		 * WeightFor is \`max(0, Weight + Word * Renown)\` — it used to name
		 * 'huscarl' and 'raider' in code on both sides.
		 */
		int32_t Renown;
	};

	const std::vector<FFoeArchetype> FoeArchetypes = {
${archetypes}
	};

	inline const FFoeArchetype* ArchetypeById(const std::string& Id)
	{
		for (const FFoeArchetype& Row : FoeArchetypes) if (Row.Id == Id) return &Row;
		return nullptr;
	}

	const std::vector<std::string> FoeNames = ${list(FOE_NAMES)};
	const std::vector<std::string> FoeBynames = ${list(FOE_BYNAMES)};
	const std::vector<std::string> ChampionBynames = ${list(CHAMPION_BYNAMES)};

	// ---- The ground a fight is rolled on (src/sim/battlefield.ts) ----

	struct FGroundMix
	{
		std::string Terrain;
		double Rough, Block, Water;
	};

	/**
	 * Read in this order and no other: block, then water, then rough, each
	 * against the running sum. One \`next()\` per hex decides all three.
	 */
	const std::vector<FGroundMix> GroundMixes = {
		{ "ocean", 0.06, 0.14, 0.24 },
		{ "shore", 0.12, 0.03, 0.1 },
		{ "meadow", 0.08, 0.02, 0 },
		{ "forest", 0.2, 0.16, 0 },
		{ "hills", 0.26, 0.1, 0 },
		{ "mountains", 0.3, 0.22, 0 },
		{ "bog", 0.42, 0.04, 0.12 },
		{ "valley", 0.1, 0.03, 0.04 },
	};

	inline const FGroundMix& MixFor(const std::string& Terrain)
	{
		for (const FGroundMix& Row : GroundMixes) if (Row.Terrain == Terrain) return Row;
		// \`MIXES[terrain] ?? MIXES.meadow\` — the fallback is meadow, index 2.
		return GroundMixes[2];
	}

	/** What the log calls the ground. Same switch as \`groundName\`. */
	inline std::string GroundName(const std::string& Terrain)
	{
		if (Terrain == "bog") return "the sucking peat";
		if (Terrain == "forest") return "close trees";
		if (Terrain == "hills") return "broken slope";
		if (Terrain == "mountains") return "bare rock";
		if (Terrain == "shore") return "wet sand";
		if (Terrain == "ocean") return "lashed hulls";
		if (Terrain == "valley") return "good grass";
		return "open ground";
	}

	// ---- The authored fields (src/data/seaFields.ts, src/data/raidFields.ts) ----

	struct FSeaField
	{
		std::string Id;
		std::string Line;
		std::vector<std::string> Rows;
	};

	const std::vector<FSeaField> SeaFields = {
${seaFields}
	};

	struct FRaidField
	{
		std::string Id;
		std::string Line;
		/** A plot the steading must hold for this approach to be possible. */
		std::string Needs;
		std::vector<std::string> Rows;
	};

	const std::vector<FRaidField> RaidFields = {
${raidFields}
	};

	// ---- What the band has worked out (src/data/lore.ts) ----

	struct FLoreRow
	{
		std::string Id;
		double Check, Solace, Sea, Bite, Warmth, Mend, Physic, Wall;
	};

	const std::vector<FLoreRow> Lore = {
${lore}
	};

	// ---- What a bad hour leaves behind (src/data/injuries.ts) ----

	struct FInjuryTemplate
	{
		std::string Label;
		int32_t Heals;
		/**
		 * A stat the wound drags, and whether it drags it at all. The absent
		 * ones are DROPPED from the canonical form, never written as nought,
		 * so "has it" and "how much" are two fields. Declared in the order the
		 * canonical form sorts them: craft, might, spirit, wits.
		 */
		bool bCraft; int32_t Craft;
		bool bMight; int32_t Might;
		bool bSpirit; int32_t Spirit;
		bool bWits; int32_t Wits;
	};

	const std::vector<FInjuryTemplate> Injuries = {
${injuries}
	};

	/** Some wounds never mend. Rolled rarely; \`heals\` is absurdly high. */
	const std::vector<FInjuryTemplate> LastingInjuries = {
${lasting}
	};

	/** How a fighter died, for the saga — and for the hashed \`fate\`. */
	const std::vector<std::string> Deaths = ${list(DEATHS)};

	// ---- The numbers ----

	constexpr int32_t FieldWidth = ${num(FIELD_WIDTH)};
	constexpr int32_t FieldHeight = ${num(FIELD_HEIGHT)};
	constexpr int32_t FrontWidth = ${num(FRONT_WIDTH)};
	constexpr int32_t WallRow = ${num(WALL_ROW)};
	constexpr int32_t MiddleRowFirst = ${num(MIDDLE_ROWS[0]!)};
	constexpr int32_t MiddleRowCount = ${num(MIDDLE_ROWS.length)};

	constexpr int32_t BaseMoves = ${num(BASE_MOVES)};
	constexpr int32_t MaxFoes = ${num(MAX_FOES)};
	constexpr int32_t MaxRaiders = ${num(MAX_RAIDERS)};
	constexpr int32_t MaxRaidersFamed = ${num(MAX_RAIDERS_FAMED)};
	constexpr double RaidPerPoint = ${num(RAID_PER_POINT)};
	constexpr int32_t JarlWord = ${num(JARL_WORD)};

	constexpr int32_t ChampionMight = ${num(CHAMPION_MIGHT)};
	constexpr int32_t ChampionSpirit = ${num(CHAMPION_SPIRIT)};
	constexpr int32_t ChampionToughness = ${num(CHAMPION_TOUGHNESS)};
	constexpr int32_t ScarMax = ${num(SCAR_MAX)};
	constexpr int32_t ScarToughness = ${num(SCAR_TOUGHNESS)};

	constexpr double NerveHit = ${num(NERVE_HIT)};
	constexpr double NerveAllyDown = ${num(NERVE_ALLY_DOWN)};
	constexpr double NerveWallShattered = ${num(NERVE_WALL_SHATTERED)};
	constexpr double NerveOutnumbered = ${num(NERVE_OUTNUMBERED)};
	constexpr double NerveKill = ${num(NERVE_KILL)};
	constexpr double NerveLeaderFell = ${num(NERVE_LEADER_FELL)};
	constexpr double NerveKinFell = ${num(NERVE_KIN_FELL)};
	constexpr double RallyNerve = ${num(RALLY_NERVE)};
	constexpr int32_t RallyDc = ${num(RALLY_DC)};
	constexpr double SteadiedPerLink = ${num(STEADIED_PER_LINK)};

	constexpr int32_t ThrowRange = ${num(THROW_RANGE)};
	constexpr int32_t DefendBonus = ${num(DEFEND_BONUS)};
	constexpr int32_t WallExposed = ${num(WALL_EXPOSED)};
	constexpr int32_t OutnumberedPenalty = ${num(OUTNUMBERED_PENALTY)};
	constexpr int32_t MaxOutnumbered = ${num(MAX_OUTNUMBERED)};
	constexpr int32_t WallPushMax = ${num(WALL_PUSH_MAX)};
	constexpr int32_t ReachRange = ${num(REACH_RANGE)};
	constexpr int32_t ReachPenalty = ${num(REACH_PENALTY)};
	constexpr int32_t ReachDamageOff = ${num(REACH_DAMAGE_OFF)};
	constexpr int32_t WarcryRange = ${num(WARCRY_RANGE)};
	constexpr double WarcryHeart = ${num(WARCRY_HEART)};
	constexpr double WarcryDread = ${num(WARCRY_DREAD)};

	constexpr int32_t WallBonusOne = ${num(WALL_BONUS_ONE)};
	constexpr int32_t WallBonusFull = ${num(WALL_BONUS_FULL)};
	constexpr int32_t ShieldInWall = ${num(SHIELD_IN_WALL)};
	constexpr int32_t DisengageCost = ${num(DISENGAGE_COST)};
	constexpr int32_t PatienceRounds = ${num(PATIENCE_ROUNDS)};
	constexpr int32_t RoundLimit = ${num(ROUND_LIMIT)};

	constexpr int32_t XpPerAdvance = ${num(XP_PER_ADVANCE)};
	constexpr int32_t XpPerKill = ${num(XP_PER_KILL)};
	constexpr int32_t XpSurvived = ${num(XP_SURVIVED)};
	constexpr int32_t XpWon = ${num(XP_WON)};
	constexpr int32_t LootFoodPerFoe = ${num(LOOT_FOOD_PER_FOE)};
	constexpr int32_t LootWoodPerFoe = ${num(LOOT_WOOD_PER_FOE)};
	constexpr double KinGrief = ${num(KIN_GRIEF)};
	constexpr int32_t GriefDays = ${num(GRIEF_DAYS)};

	/**
	 * What holding, breaking off, or being overrun is worth to the roll that
	 * decides whether somebody dragged off the field lives.
	 */
	constexpr int32_t FateHeld = 2;
	constexpr int32_t FateWithdrew = 1;
	constexpr int32_t FateOverrun = -1;

	// ---- What somebody coming for the steading is worth (src/sim/raid.ts) ----

	/** What share of the store a successful sack carries off. */
	constexpr double SackShare = ${num(SACK_SHARE)};
	/** The most hands a single sacking carries off. Hands, never sworn. */
	constexpr int32_t SackTakes = ${num(SACK_TAKES)};
	/** Visible wealth: a coast can count roofs from a ridge. */
	constexpr double WorthPerRoof = ${num(WORTH_PER_ROOF)};
	/** What a point of defensibility takes back off it. */
	constexpr double DefencePer = ${num(DEFENCE_PER)};
	/** And a point of watch kept. A watch not kept decays. */
	constexpr double WatchPer = ${num(WATCH_PER)};
}
}
`;
}

// Writing is the CLI's job, not the module's — see event-tables.ts for why,
// and for why the guard is "was I given a path" rather than argv[1].
const out = process.argv.find((arg) => arg.endsWith('.h'));
if (out) {
  const text = renderBattleTables();
  writeFileSync(out, text);
  // eslint-disable-next-line no-console
  console.log(
    `battle-tables: wrote ${out} — ${FOE_ARCHETYPES.length} archetypes, `
    + `${SEA_FIELDS.length} sea fields, ${RAID_FIELDS.length} raid fields, ${text.length} chars`,
  );
}

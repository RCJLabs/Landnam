// Generates the C++ header the port's party generation reads.
//
//   npm run party-tables
//
// The content stays authored in src/data — this only restates it in a form a
// compiler can eat, exactly as ue-port's exporter restates terrain and foes
// as DataTables. The project's oldest architectural rule is that adding a
// name or a trait must never require touching engine code, and it still does
// not: add it in src/data/*.ts and re-run this.
//
// A generated HEADER rather than a JSON file, for one reason worth writing
// down. The sim core is deliberately free of Unreal so the identical
// translation unit compiles in a standalone harness that can be run against
// the parity vectors on any machine with a compiler — and that harness has no
// JSON parser and should not grow one. Stage 1 found two real bugs that way.
// A header needs nothing but the compiler.

import { writeFileSync } from 'node:fs';
import { MEN, WOMEN, BYNAMES, LANDING_NAMES } from '../src/data/names';
import { TRAITS } from '../src/data/traits';
import { ELDER_TIES, PEER_TIES } from '../src/data/kin';
import {
  CLAN_COUNT, CLAN_MAX_GAP, CLAN_MIN_GAP, CLAN_NAMES, NATIVE_NAMES, clanKind,
} from '../src/data/clans';
import { LAND_TERRAINS, terrainDef } from '../src/data/terrain';
import type { Terrain } from '../src/state/types';
import { PLACE_KINDS, PLACE_MAX_FROM_LANDING } from '../src/data/places';
import { LANDMARK_SIGHT } from '../src/sim/places';
import {
  SEASON_ORDER, SEASON_LENGTH, YEAR_LENGTH, seasonEffects,
  WINTER_BITE_MAX, WINTER_DEEPENING, WINTER_DEPTH_MAX, effectsOn,
} from '../src/sim/calendar';
import { HARDSHIPS, BALANCED_HARDSHIP } from '../src/data/hardship';
import { REP_DRIFT } from '../src/data/clans';
import { CROWDING_BITE, MOOD_DRIFT } from '../src/sim/minds';
import { BAND_BASE, HEARTH_SHARE } from '../src/sim/upkeep';
import { BASE_EVENT_CHANCE, SETTLING_IN_DAYS } from '../src/sim/events';
import { LONG_LIFE_WINTERS } from '../src/data/thing';
import { ROW_REACH, SEA_EFFORT } from '../src/sim/travel';
import { START_FIREWOOD, START_FOOD } from '../src/state/create';
import { SAVE_VERSION } from '../src/state/version';

const quote = (s: string): string => JSON.stringify(s);
const list = (name: string, values: readonly string[]): string =>
  `const std::vector<std::string> ${name} = {\n\t${values.map(quote).join(',\n\t')},\n};`;

/**
 * A double, written so a C++ compiler reads back the identical bits.
 *
 * `JSON.stringify` gives the shortest round-tripping form and `strtod` reads
 * it back exactly, both being IEEE 754 — which matters here more than it
 * looks: 0.28 and 0.12 are the mood drift and the standing drift, and a
 * literal that was rounded on the way through would put every person and
 * every neighbour a hair off for the rest of the run.
 */
const num = (n: number): string => {
  // A constant that arrived as `undefined` — because the module stopped
  // exporting it — used to reach the header as the literal text `undefined`
  // and only fail at the C++ compiler, a repo away from the cause. `scripts`
  // is outside the tsconfig `include`, so nothing else here would say so.
  if (typeof n !== 'number' || Number.isNaN(n)) {
    throw new Error(`party-tables: not a number (${String(n)}) — is it still exported?`);
  }
  if (Number.isFinite(n)) return JSON.stringify(n);
  return n > 0
    ? 'std::numeric_limits<double>::infinity()'
    : '-std::numeric_limits<double>::infinity()';
};

/** Same guard, for the values written as C++ integers. */
const int = (n: number): string => {
  if (!Number.isInteger(n)) {
    throw new Error(`party-tables: not an integer (${String(n)}) — is it still exported?`);
  }
  return String(n);
};

const strings = (values: readonly string[]): string => `{ ${values.map(quote).join(', ')} }`;

/**
 * Every terrain, sea first — `LAND_TERRAINS` is the walkable ones only, and
 * the port needs the water too because a knarr goes on it.
 */
const ALL_TERRAINS: Terrain[] = ['ocean', ...LAND_TERRAINS];

const traits = TRAITS.map((t) =>
  `\t{ ${quote(t.id)}, ${t.stats.might ?? 0}, ${t.stats.wits ?? 0}, `
  + `${t.stats.spirit ?? 0}, ${t.stats.craft ?? 0}, ${num(t.temper ?? 1)}, `
  + `${strings(t.tags)}, ${strings(t.frictions ?? [])} },`).join('\n');

/** PEER_TIES holds a LIST of pairs per key; a peer tie is drawn from it. */
const peerTies = (name: string, table: Record<string, readonly (readonly string[])[]>): string => {
  const rows = Object.entries(table)
    .map(([k, pairs]) => `\t{ ${quote(k)}, { ${pairs
      .map((p) => `{ ${quote(p[0]!)}, ${quote(p[1]!)} }`).join(', ')} } },`)
    .join('\n');
  return `const std::map<std::string, std::vector<std::pair<std::string, std::string>>> ${name} = {\n${rows}\n};`;
};

/** ELDER_TIES holds exactly ONE pair per key — parent and child, not a choice. */
const elderTies = (name: string, table: Record<string, readonly string[]>): string => {
  const rows = Object.entries(table)
    .map(([k, p]) => `\t{ ${quote(k)}, { ${quote(p[0]!)}, ${quote(p[1]!)} } },`)
    .join('\n');
  return `const std::map<std::string, std::pair<std::string, std::string>> ${name} = {\n${rows}\n};`;
};

export function renderPartyTables(): string {
  return `// GENERATED by scripts/party-tables.ts from src/data — do not hand-edit.
// Add a name or a trait in src/data/*.ts and re-run \`npm run party-tables\`.
//
// Order matters and is load-bearing: every list here is drawn from with
// \`rng.pick(index)\`, so reordering one silently changes every warband ever
// rolled from every seed. That is why this is generated rather than retyped.

#pragma once

#include <cstdint>
#include <limits>
#include <map>
#include <string>
#include <utility>
#include <vector>

namespace Landnam
{
namespace Tables
{
\t${list('Men', MEN).replace(/\n/g, '\n\t')}

\t${list('Women', WOMEN).replace(/\n/g, '\n\t')}

\t${list('Bynames', BYNAMES).replace(/\n/g, '\n\t')}

\t${list('LandingNames', LANDING_NAMES).replace(/\n/g, '\n\t')}

\t/**
\t * A trait: a stat nudge applied once at generation, how hard the mood
\t * swings, and the tags two people grate over.
\t *
\t * \`Temper\` scales the daily mood drift, so a steadfast man moves half as
\t * far toward the day's target as an ordinary one. \`Tags\` and \`Frictions\`
\t * are what \`friction()\` counts across a pair — a Quarrelsome beside a
\t * Berserk is bad blood waiting for a bad day.
\t */
\tstruct FTraitRow
\t{
\t\tstd::string Id;
\t\tint Might, Wits, Spirit, Craft;
\t\tdouble Temper;
\t\tstd::vector<std::string> Tags, Frictions;
\t};
\tconst std::vector<FTraitRow> Traits = {
${traits.replace(/^\t/gm, '\t\t')}
\t};

\t${elderTies('ElderTies', ELDER_TIES as never).replace(/\n/g, '\n\t')}

\t${peerTies('PeerTies', PEER_TIES as never).replace(/\n/g, '\n\t')}

\t${list('ClanNames', CLAN_NAMES).replace(/\n/g, '\n\t')}

\t${list('NativeNames', NATIVE_NAMES).replace(/\n/g, '\n\t')}

\tconstexpr int32_t ClanCount = ${CLAN_COUNT};
\tconstexpr int32_t ClanMinGap = ${CLAN_MIN_GAP};
\tconstexpr int32_t ClanMaxGap = ${CLAN_MAX_GAP};
\tconstexpr int32_t ClanOpening = ${clanKind('clan').opening};
\tconstexpr int32_t NativeOpening = ${clanKind('native').opening};
\tconst std::string ClanNoun = ${quote(clanKind('clan').noun)};
\tconst std::string NativeNoun = ${quote(clanKind('native').noun)};

\t/**
\t * Terrain, as the sim reads it: what it costs to enter and whether it
\t * stops a view. \`Cost\` is infinite for open sea — impassable on foot, and
\t * the knarr's own rules are in the travel code rather than here.
\t */
\tstruct FTerrainRow { std::string Id; double Cost; bool bBlocksSight; };
\tconst std::vector<FTerrainRow> Terrains = {
${ALL_TERRAINS.map((t) => `\t\t{ ${quote(t)}, ${num(terrainDef(t).cost)}, ${terrainDef(t).blocksSight ? 'true' : 'false'} },`).join('\n')}
\t};
\tinline const FTerrainRow* TerrainById(const std::string& Id)
\t{
\t\tfor (const FTerrainRow& Row : Terrains) if (Row.Id == Id) return &Row;
\t\treturn nullptr;
\t}
\tinline bool BlocksSight(const std::string& Id)
\t{
\t\tconst FTerrainRow* Row = TerrainById(Id);
\t\treturn Row && Row->bBlocksSight;
\t}

\t/**
\t * The year, IN ORDER OF PLAY — day 1 is high summer. The index into this
\t * list is \`floor((day-1) / SeasonLength) % 4\`, so reordering it moves
\t * every season of every run.
\t */
\tstruct FSeasonRow
\t{
\t\tstd::string Id;
\t\tdouble Forage;
\t\tint32_t TravelPenalty, Sight, Firewood;
\t};
\tconst std::vector<FSeasonRow> Seasons = {
${SEASON_ORDER.map((s) => {
  const e = seasonEffects(s);
  return `\t\t{ ${quote(s)}, ${num(e.forage)}, ${e.travelPenalty}, ${e.sight}, ${e.firewood} },`;
}).join('\n')}
\t};
\tconstexpr int32_t SeasonLength = ${int(SEASON_LENGTH)};
\tconstexpr int32_t YearLength = ${int(YEAR_LENGTH)};
\tconstexpr int32_t WinterDeepening = ${int(WINTER_DEEPENING)};
\tconstexpr int32_t WinterDepthMax = ${int(WINTER_DEPTH_MAX)};
\tconstexpr int32_t WinterBiteMax = ${int(WINTER_BITE_MAX)};

\t/** How hard the country is. Every knob the balance harness reads. */
\tstruct FHardshipRow
\t{
\t\tstd::string Id;
\t\tdouble Stir, Raid, Winter, Stores;
\t\tint32_t Steel;
\t};
\tconst std::vector<FHardshipRow> Hardships = {
${HARDSHIPS.map((h) => `\t\t{ ${quote(h.id)}, ${num(h.stir)}, ${num(h.raid)}, ${num(h.winter)}, ${num(h.stores)}, ${h.steel} },`).join('\n')}
\t};
\t/** What \`newGame\` uses when the caller names no terms. */
\tconst std::string DefaultHardship = ${quote(BALANCED_HARDSHIP)};
\tinline const FHardshipRow& HardshipById(const std::string& Id)
\t{
\t\tfor (const FHardshipRow& Row : Hardships) if (Row.Id == Id) return Row;
\t\tfor (const FHardshipRow& Row : Hardships) if (Row.Id == DefaultHardship) return Row;
\t\treturn Hardships[0];
\t}

\t/** Fixed places, IN SEEDING ORDER — seedPlaces walks this list. */
\tstruct FPlaceKindRow { std::string Id; std::vector<std::string> Ground; int32_t MinFromLanding; };
\tconst std::vector<FPlaceKindRow> PlaceKinds = {
${PLACE_KINDS.map((k) => `\t\t{ ${quote(k.id)}, { ${k.ground.map(quote).join(', ')} }, ${k.minFromLanding} },`).join('\n')}
\t};
\tconstexpr int32_t PlaceMaxFromLanding = ${PLACE_MAX_FROM_LANDING};

\t/** How far the band sees on day one — Seasons[0].Sight, named for stage 1. */
\tconstexpr int32_t SightOnDayOne = ${int(effectsOn(1).sight)};
\tconstexpr int32_t LandmarkSight = ${int(LANDMARK_SIGHT)};

\t/** Stores off the knarr, before the country's terms multiply them. */
\tconstexpr int32_t StartFood = ${int(START_FOOD)};
\tconstexpr int32_t StartFirewood = ${int(START_FIREWOOD)};

\t// --- The day cycle (stage 5) ---

\t/** How much of a night's fire is the hearth rather than the heads round it. */
\tconstexpr double HearthShare = ${num(HEARTH_SHARE)};
\t/** The band the firewood figures were tuned against. Six off the knarr. */
\tconstexpr int32_t BandBase = ${int(BAND_BASE)};
\t/** How fast a mood moves toward where the day is pushing it. */
\tconstexpr double MoodDrift = ${num(MOOD_DRIFT)};
\t/** What each body past the roof's room takes off everyone's mood. */
\tconstexpr int32_t CrowdingBite = ${int(CROWDING_BITE)};
\t/** How far a neighbour's standing creeps back toward indifference a day. */
\tconstexpr double RepDrift = ${num(REP_DRIFT)};
\t/** The road's base chance of interrupting you, and the quiet opening days. */
\tconstexpr double BaseEventChance = ${num(BASE_EVENT_CHANCE)};
\tconstexpr int32_t SettlingInDays = ${int(SETTLING_IN_DAYS)};
\t/** Winters stood before the run closes itself out. */
\tconstexpr int32_t LongLifeWinters = ${int(LONG_LIFE_WINTERS)};
\t/** Effort to row a hex of coast, and how far a day's rowing carries. */
\tconstexpr int32_t SeaEffort = ${int(SEA_EFFORT)};
\tconstexpr int32_t RowReach = ${int(ROW_REACH)};

\tconstexpr int32_t SaveVersion = ${SAVE_VERSION};
}
}
`;
}

// Writing is the CLI's job, not the module's. `test/tables.test.ts` imports
// renderPartyTables to check the committed header is still what the data
// produces, and an import that wrote a file as a side effect would make that
// test pass by rewriting the very thing it is checking.
//
// Keyed on being GIVEN a path rather than on argv[0], because under vite-node
// argv[1] is vite-node itself — the obvious `endsWith('party-tables.ts')`
// guard is simply always false, and silently.
const out = process.argv.find((arg) => arg.endsWith('.h'));
if (out) {
  const text = renderPartyTables();
  writeFileSync(out, text);
  // eslint-disable-next-line no-console
  console.log(
    `party-tables: wrote ${out} — ${MEN.length} men, ${WOMEN.length} women, `
    + `${BYNAMES.length} bynames, ${TRAITS.length} traits, ${LANDING_NAMES.length} landings`,
  );
}

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
import {
  BEARING_MAX, BEARING_MIN, BIRTH_COOLDOWN, BIRTH_FOOD_FLOOR, BIRTH_HEART, BIRTH_ODDS,
  CHILD_APPETITE, ORPHAN_GRIEF } from '../src/data/lineage';
import { ILLNESSES, SICKNESS_BASE_DC } from '../src/sim/winter';
import { WEATHER } from '../src/data/weather';
import { HALF_RATION_HEART, HALF_RATION_TOLL, RATION_SHARE } from '../src/data/rations';
import { PLACE_KINDS, PLACE_MAX_FROM_LANDING } from '../src/data/places';

/**
 * The kinds `seedPlaces` ACTUALLY walks, which is not all of them.
 *
 * `src/sim/places.ts` skips any kind marked `seeded: false`, and the header
 * below documents its table as "IN SEEDING ORDER — seedPlaces walks this
 * list". Emitting the unseeded ones broke that promise, and the port believed
 * it: `ruin` shipped as the SECOND row, so the C++ seeded a ruin the reference
 * never seeds AND consumed draws from the `places` stream before town, wreck
 * and oreseam — every place after it landed somewhere else, and the two builds
 * disagreed about the map from day one.
 *
 * It went unnoticed for five days because the port was verifying against
 * vectors as stale as its own code. The contract sync of 2026-08-19 handed it
 * current ones and the parity workflow went red immediately, which is exactly
 * what that sync was built to do.
 */
const SEEDED_KINDS = PLACE_KINDS.filter((k) => k.seeded !== false);
import { LANDMARK_SIGHT } from '../src/sim/places';
import { SOIL } from '../src/sim/site';
import {
  MEASURE_MAX, NAME_ROOTS, NAME_SUFFIX, WATER_FLOOR, type Measure,
} from '../src/data/sites';
import { CLAN_ELBOW, CLAN_CALLS_EVERY } from '../src/data/clans';
import {
  JOBS, PLOTS, SHELTER_MAX, SHELTER_SAVES, WATCH_DECAY, WATCH_MAX,
} from '../src/data/jobs';
import { BUILDINGS } from '../src/data/buildings';
import {
  DRAW_ANGER, DRAW_LARDER_DAYS, DRAW_MAX, SWORD_DEEDS, SWORD_MAX,
} from '../src/data/folk';
import {
  CHANCE_PER_WORTH, RAID_CHANCE_MAX, RAID_EARLIEST_DAY, RAID_RESPITE,
} from '../src/sim/raid';
import {
  HAZE_CLEARS, HAZE_MAX, HAZE_RANGE, PRUDENCE, WINTER_DAY,
} from '../src/sim/winter';
import {
  PRESSURE_MAX, PRESSURE_PER_ANGER, PRESSURE_STIR,
} from '../src/sim/neighbours';
import { WATCH_QUIET } from '../src/data/jobs';
import { SWORN_MAX } from '../src/sim/people';
import { LEAVING_CHANCE, LEAVING_MOOD, SETTLED_IN } from '../src/sim/joining';
import { IDLE_BITE, PATCH_SHELTER_CAP, PLOT_RADIUS } from '../src/sim/colony';
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

const MEASURES: Measure[] = ['water', 'soil', 'timber', 'harbour', 'defence'];

/** A building's `needs` / `raises`, as a flat list of measure and amount. */
const measures = (table?: Partial<Record<Measure, number>>): string =>
  `{ ${MEASURES.filter((m) => table?.[m] !== undefined)
    .map((m) => `{ ${quote(m)}, ${int(table![m]!)} }`).join(', ')} }`;

const jobs = JOBS.map((j) =>
  `\t\t{ ${quote(j.id)}, ${quote(j.stat)}, ${quote(j.measure)}, ${quote(j.produces)}, `
  + `${num(j.floor)}, ${num(j.perPoint)}, ${num(j.seasonal)} },`).join('\n');

const buildings = BUILDINGS.map((b) =>
  `\t\t{ ${quote(b.id)}, ${int(b.timber)}, ${int(b.works)}, ${num(b.shelter ?? 0)}, `
  + `${int(b.heart ?? 0)}, ${int(b.room ?? 0)}, ${strings(b.after ?? [])}, `
  + `${measures(b.needs)}, ${measures(b.raises)}, ${num(b.foodKeep ?? 1)}, `
  + `${quote(b.replaces ?? '')}, ${quote(b.repeat ?? '')}, ${quote(b.unlocks ?? '')} },`)
  .join('\n');

const plots = Object.values(PLOTS).map((p) =>
  `\t\t{ ${quote(p.kind)}, ${strings(p.worked)} },`).join('\n');

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
\t/** How hard each kind hits when it comes. */
\tconstexpr double ClanStrength = ${num(clanKind('clan').strength)};
\tconstexpr double NativeStrength = ${num(clanKind('native').strength)};
\tconstexpr int32_t NativeOpening = ${clanKind('native').opening};
\tconst std::string ClanNoun = ${quote(clanKind('clan').noun)};
\tconst std::string NativeNoun = ${quote(clanKind('native').noun)};

\t/**
\t * Terrain, as the sim reads it: what it costs to enter, the firewood a
\t * camp night on it yields, and whether it stops a view. \`Cost\` is infinite
\t * for open sea — impassable on foot, and the knarr's own rules live in the
\t * travel code rather than here. \`Wood\` is also what the timber measure of
\t * a site is summed from, over the hex and its ring. \`Forage\`, \`Hunt\` and
\t * \`Fish\` are the base yields a day's gathering starts from.
\t */
\tstruct FTerrainRow
\t{
\t\tstd::string Id;
\t\tdouble Cost;
\t\tint32_t Wood, Forage, Hunt, Fish;
\t\tbool bBlocksSight;
\t};
\tconst std::vector<FTerrainRow> Terrains = {
${ALL_TERRAINS.map((t) => `\t\t{ ${quote(t)}, ${num(terrainDef(t).cost)}, ${int(terrainDef(t).wood)}, `
  + `${int(terrainDef(t).forage)}, ${int(terrainDef(t).hunt)}, ${int(terrainDef(t).fish)}, `
  + `${terrainDef(t).blocksSight ? 'true' : 'false'} },`).join('\n')}
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

\t/**
\t * The weather, IN DECLARATION ORDER — weighted() subtracts in this order.
\t *
\t * Weights are per season and an absent season means never, so the pool is
\t * filtered to the ones with a weight above nought before the pick, keeping
\t * this order. Reorder the rows and every seed gets a different sky.
\t */
\tstruct FWeatherRow
\t{
\t\tstd::string Id, Label;
\t\tint32_t Travel;
\t\tbool bShutsTheSea;
\t\tint32_t Firewood, Sight;
\t\t/** Per season, in SeasonOrder. Nought means it never happens then. */
\t\tstd::vector<double> Weight;
\t};
\tconst std::vector<FWeatherRow> Weathers = {
${WEATHER.map((w) => `\t\t{ ${quote(w.id)}, ${quote(w.label)}, ${w.travel}, ${w.shutsTheSea ? 'true' : 'false'}, ${w.firewood}, ${w.sight}, { ${SEASON_ORDER.map((s) => num(w.weight[s] ?? 0)).join(', ')} } },`).join('\n')}
\t};

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
${SEEDED_KINDS.map((k) => `\t\t{ ${quote(k.id)}, { ${k.ground.map(quote).join(', ')} }, ${k.minFromLanding} },`).join('\n')}
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

\t/**
\t * Being born, and getting older — src/data/lineage.ts.
\t *
\t * A generation is sixteen years and a run is five, so nobody here grows UP:
\t * a child is a mouth, a lift to the band's heart, and a name the saga ends
\t * with. ChildAppetite is what one of them eats against a grown share.
\t */
\tconstexpr int32_t BirthCooldown = ${int(BIRTH_COOLDOWN)};
\tconstexpr double BirthOdds = ${num(BIRTH_ODDS)};
\tconstexpr int32_t BirthFoodFloor = ${int(BIRTH_FOOD_FLOOR)};
\tconstexpr double ChildAppetite = ${num(CHILD_APPETITE)};
\tconstexpr int32_t BirthHeart = ${int(BIRTH_HEART)};
\tconstexpr int32_t BearingMin = ${int(BEARING_MIN)};
\tconstexpr int32_t BearingMax = ${int(BEARING_MAX)};
\t/**
\t * What a death costs the steading for the children it leaves behind.
\t *
\t * Per orphaned child, off the BAND's heart rather than one person's — the
\t * kin grief beside it is the one who lost somebody, this is everyone
\t * looking at who is left. Emitted since 2026-08-21: it was the only lineage
\t * number the port did not carry, because the port's Mourn did the kin
\t * half and not this one, and five points of it was the last divergence in
\t * runs/long.json.
\t */
\tconstexpr int32_t OrphanGrief = ${int(ORPHAN_GRIEF)};

\t/**
\t * What a cold night gives you, IN PICK ORDER — pick() indexes this list.
\t */
\tstruct FIllnessRow
\t{
\t\tstd::string Label;
\t\tstd::map<std::string, int32_t> Effect;
\t\tint32_t Heals;
\t};
\tconst std::vector<FIllnessRow> Illnesses = {
${ILLNESSES.map((i) => `\t\t{ ${quote(i.label)}, { ${Object.entries(i.effect).map(([k, v]) => `{ ${quote(k)}, ${int(v as number)} }`).join(', ')} }, ${int(i.heals)} },`).join('\n')}
\t};
\t/** What a body has to beat to come through a fireless night unharmed. */
\tconstexpr int32_t SicknessBaseDc = ${int(SICKNESS_BASE_DC)};

\t/**
\t * Short commons — the winter lever, ported 2026-08-20.
\t *
\t * The band can choose to eat less. RationShare multiplies the mouths
\t * formula, HalfRationHeart is taken off morale every day it is kept, and
\t * the weakest is wounded every HalfRationToll lean days.
\t */
\tconstexpr double RationShare = ${num(RATION_SHARE)};
\tconstexpr int32_t HalfRationHeart = ${int(HALF_RATION_HEART)};
\tconstexpr int32_t HalfRationToll = ${int(HALF_RATION_TOLL)};
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

\t// --- The steading (stage 5, rung 3) ---

\t/** Name parts. The SUFFIX is drawn first — see nameFor's draw order. */
\t${list('NameRoots', NAME_ROOTS).replace(/\n/g, '\n\t')}
\t/** Keyed by the measure a site is best at, in MEASURES order. */
\tconst std::map<std::string, std::vector<std::string>> NameSuffix = {
${MEASURES.map((m) => `\t\t{ ${quote(m)}, ${strings(NAME_SUFFIX[m])} },`).join('\n')}
\t};

\t/** Ground that will take barley, by terrain. From src/sim/site.ts. */
\tconst std::map<std::string, int32_t> SoilByTerrain = {
${ALL_TERRAINS.map((t) => `\t\t{ ${quote(t)}, ${int(SOIL[t])} },`).join('\n')}
\t};

\tconstexpr int32_t MeasureMax = ${int(MEASURE_MAX)};
\tconstexpr int32_t WaterFloor = ${int(WATER_FLOOR)};
\t/** How close a neighbour may be before the ground is already somebody's. */
\tconstexpr int32_t ClanElbow = ${int(CLAN_ELBOW)};
\tconstexpr int32_t ClanCallsEvery = ${int(CLAN_CALLS_EVERY)};
\tconstexpr int32_t PlotRadius = ${int(PLOT_RADIUS)};
\tconstexpr double ShelterSaves = ${num(SHELTER_SAVES)};
\tconstexpr int32_t WatchMax = ${int(WATCH_MAX)};
\tconstexpr double WatchDecay = ${num(WATCH_DECAY)};
\tconstexpr int32_t PatchShelterCap = ${int(PATCH_SHELTER_CAP)};
\tconstexpr int32_t ShelterMax = ${int(SHELTER_MAX)};
\tconstexpr int32_t RaidEarliestDay = ${int(RAID_EARLIEST_DAY)};
\t/** Nothing comes for a place only just marked out. */
\tconstexpr int32_t RaidRespite = ${int(RAID_RESPITE)};
\tconstexpr double RaidChanceMax = ${num(RAID_CHANCE_MAX)};
\tconstexpr double ChancePerWorth = ${num(CHANCE_PER_WORTH)};
\t/** A coast with a grievance is a busier coast. */
\tconstexpr double PressureMax = ${num(PRESSURE_MAX)};
\tconstexpr double PressurePerAnger = ${num(PRESSURE_PER_ANGER)};
\tconstexpr double PressureStir = ${num(PRESSURE_STIR)};
\t/** What a stood watch buys in quiet, per point. */
\tconstexpr double WatchQuiet = ${num(WATCH_QUIET)};
\t/** The day the dark closes in, and the day the telegraph stops warning. */
\tconstexpr int32_t WinterDay = ${int(WINTER_DAY)};
\t/** The winter mark: what it asks for over what it needs, and how vague it is. */
\tconstexpr double Prudence = ${num(PRUDENCE)};
\tconstexpr int32_t HazeClears = ${int(HAZE_CLEARS)};
\tconstexpr int32_t HazeRange = ${int(HAZE_RANGE)};
\tconstexpr double HazeMax = ${num(HAZE_MAX)};
\tconstexpr int32_t DrawLarderDays = ${int(DRAW_LARDER_DAYS)};
\t/** Somebody comes and asks; a sword comes looking for a share. */
\tconstexpr double DrawMax = ${num(DRAW_MAX)};
\tconstexpr double DrawAnger = ${num(DRAW_ANGER)};
\tconstexpr double SwordMax = ${num(SWORD_MAX)};
\tconstexpr int32_t SwordDeeds = ${int(SWORD_DEEDS)};
\tconstexpr int32_t SwornMax = ${int(SWORN_MAX)};
\t/** Hands who have had enough, and go. The sworn never do. */
\tconstexpr int32_t LeavingMood = ${int(LEAVING_MOOD)};
\tconstexpr double LeavingChance = ${num(LEAVING_CHANCE)};
\tconstexpr int32_t SettledIn = ${int(SETTLED_IN)};
\t/** What idleness costs the band's nerve, a head a day. */
\tconstexpr double IdleBite = ${num(IDLE_BITE)};

\t/** A job: what it reads, what it makes, and how much of it. */
\tstruct FJobRow
\t{
\t\tstd::string Id, Stat, Measure, Produces;
\t\tdouble Floor, PerPoint, Seasonal;
\t};
\tconst std::vector<FJobRow> Jobs = {
${jobs}
\t};

\t/** A measure and an amount — a building's needs or raises. */
\tstruct FMeasureRow { std::string Measure; int32_t Value; };

\t/**
\t * A building. \`Replaces\`, \`Repeat\` and \`Unlocks\` are empty where the
\t * data left them out, which is how an absent field is spelled here.
\t */
\tstruct FBuildingRow
\t{
\t\tstd::string Id;
\t\tint32_t Timber, Works;
\t\tdouble Shelter;
\t\tint32_t Heart, Room;
\t\tstd::vector<std::string> After;
\t\tstd::vector<FMeasureRow> Needs, Raises;
\t\t/** Multiplier on food work. 1 where the data left it out. */
\t\tdouble FoodKeep;
\t\tstd::string Replaces, Repeat, Unlocks;
\t};
\tconst std::vector<FBuildingRow> Buildings = {
${buildings}
\t};
\tinline const FBuildingRow* BuildingById(const std::string& Id)
\t{
\t\tfor (const FBuildingRow& Row : Buildings) if (Row.Id == Id) return &Row;
\t\treturn nullptr;
\t}

\t/** Which jobs each kind of ground is worked by. */
\tstruct FPlotRow { std::string Kind; std::vector<std::string> Worked; };
\tconst std::vector<FPlotRow> Plots = {
${plots}
\t};

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

// GameRun construction: crew generation, starting resources, weather.

import { key } from '../../core/hex';
import { revealRadius } from '../../core/fov';
import { makeRng, Rng } from '../../core/rng';
import { BALANCE } from '../../content/balance';
import { EPITHETS, FEMALE_NAMES, MALE_NAMES, SHIP_NAMES } from '../../content/names';
import { generateChart } from '../../procgen/chart';
import { CrewMember, GameRun, Weather } from '../types';

export const RUN_VERSION = 1;

function makeCrewMember(rng: Rng, n: number, isCaptain: boolean): CrewMember {
  const female = rng.chance(0.2);
  const name = rng.pick(female ? FEMALE_NAMES : MALE_NAMES);
  const statBudget = isCaptain ? 16 : rng.int(10, 14);
  // Distribute the budget across four stats, each 1..6.
  const stats = [1, 1, 1, 1];
  let left = statBudget - 4;
  let guard = 100;
  while (left > 0 && guard-- > 0) {
    const i = rng.int(0, 3);
    if (stats[i]! < 6) {
      stats[i]!++;
      left--;
    }
  }
  const hpMax = BALANCE.crew.hpBase + stats[0]!; // might adds hp
  return {
    id: `crew_${n}`,
    name,
    epithet: isCaptain || rng.chance(0.35) ? rng.pick(EPITHETS) : undefined,
    isCaptain,
    female,
    might: stats[0]!,
    skill: stats[1]!,
    guts: stats[2]!,
    sea: stats[3]!,
    traits: [],
    weapon: isCaptain ? 'sword' : rng.pick(['axe', 'axe', 'spear', 'spear', 'seax']),
    armor: isCaptain ? 'mail' : rng.chance(0.3) ? 'leather' : undefined,
    hp: hpMax,
    hpMax,
    injuries: [],
    fatigue: 0,
    morale: BALANCE.morale.start,
    alive: true,
  };
}

function initialWeather(rng: Rng, chart: GameRun['chart']): Weather {
  // Prevailing westerlies: wind blows FROM the west most of the time,
  // i.e. adverse for a westward crossing.
  const windFrom = rng.chance(0.65) ? 3 : rng.int(0, 5);
  const stormCount = rng.int(BALANCE.chart.stormSeedCount[0], BALANCE.chart.stormSeedCount[1]);
  const storms = [];
  const seaKeys = Object.entries(chart.tiles)
    .filter(([, t]) => t.terrain === 'sea' || t.terrain === 'deepSea')
    .map(([k]) => k)
    .sort();
  for (let i = 0; i < stormCount; i++) {
    const k = rng.pick(seaKeys);
    const c = k.indexOf(',');
    storms.push({ q: Number(k.slice(0, c)), r: Number(k.slice(c + 1)) });
  }
  return { windFrom, windStrength: rng.int(1, 2) as 1 | 2, storms };
}

export function newRun(seed: string): GameRun {
  const rng = makeRng(seed);
  const chart = generateChart(rng.fork('chart'));
  const crewRng = rng.fork('crew');
  const crew: CrewMember[] = [];
  for (let i = 0; i < BALANCE.crew.startCount; i++) {
    crew.push(makeCrewMember(crewRng, i + 1, i === 0));
  }
  const shipName = crewRng.pick(SHIP_NAMES);
  const run: GameRun = {
    version: RUN_VERSION,
    seed,
    turn: 0,
    phase: 'voyage',
    chart,
    ship: {
      name: shipName,
      hull: BALANCE.ship.hullMax,
      hullMax: BALANCE.ship.hullMax,
      cargoMax: BALANCE.ship.cargoMax,
      upgrades: [],
    },
    crew,
    food: BALANCE.resources.startFood,
    water: BALANCE.resources.startWater,
    silver: BALANCE.resources.startSilver,
    timber: BALANCE.resources.startTimber,
    moraleShip: BALANCE.morale.start,
    weather: initialWeather(rng.fork('weather'), chart),
    flags: {},
    log: [
      {
        turn: 0,
        text: `The ${shipName} slips from Hafnarvik at dawn. West lies the whale-road.`,
        tone: 'saga',
      },
    ],
    idCounter: BALANCE.crew.startCount,
  };
  // Reveal home waters.
  for (const h of revealRadius(chart.shipAt, BALANCE.chart.fogRadius + 1)) {
    chart.discovered.add(key(h));
  }
  return run;
}

/** The per-turn RNG stream: forked from the run seed + turn, so replays hold. */
export function turnRng(run: GameRun): Rng {
  return makeRng(run.seed).fork(`turn:${run.turn}`);
}

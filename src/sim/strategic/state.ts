// GameRun construction: crew generation, starting resources, weather.

import { key } from '../../core/hex';
import { revealRadius } from '../../core/fov';
import { makeRng, Rng } from '../../core/rng';
import { BALANCE } from '../../content/balance';
import { SHIP_NAMES } from '../../content/names';
import { generateChart } from '../../procgen/chart';
import { CrewMember, GameRun, Weather } from '../types';
import { makeCrewMember } from './crewGen';

export const RUN_VERSION = 1;

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

export function newRun(seed: string, unlocks: string[] = []): GameRun {
  const rng = makeRng(seed);
  const chart = generateChart(rng.fork('chart'));
  const crewRng = rng.fork('crew');
  const crew: CrewMember[] = [];
  for (let i = 0; i < BALANCE.crew.startCount; i++) {
    crew.push(makeCrewMember(crewRng, `crew_${i + 1}`, i === 0));
  }
  const has = (id: string) => unlocks.includes(id);
  if (has('hardy-crew')) {
    for (const c of crew) {
      c.hpMax += 2;
      c.hp += 2;
    }
  }
  if (has('veteran-captain')) {
    const cap = crew[0]!;
    const capRng = rng.fork('veteran');
    for (let i = 0; i < 2; i++) {
      const stat = capRng.pick(['might', 'skill', 'guts', 'sea'] as const);
      if (cap[stat] < 6) cap[stat] += 1;
    }
    cap.armor = 'mail';
    cap.weapon = 'sword';
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
      upgrades: unlocks.filter((u) => u === 'crows-nest' || u === 'sealskin-sails'),
    },
    crew,
    food: BALANCE.resources.startFood + (has('full-hold') ? 10 : 0),
    water: BALANCE.resources.startWater + (has('full-hold') ? 10 : 0),
    silver: BALANCE.resources.startSilver + (has('war-chest') ? 15 : 0),
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

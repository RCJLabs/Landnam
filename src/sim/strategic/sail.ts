// The voyage reducer: validates a StrategicIntent against the run,
// mutates a structured-clone of the state, and returns the events that
// happened. Pure — all randomness from the deterministic turn stream.

import { Axial, key, distance, dirTo, neighbors } from '../../core/hex';
import { revealRadius } from '../../core/fov';
import { BALANCE } from '../../content/balance';
import { GameRun, SimEvent, StrategicIntent, RunEnd } from '../types';
import { turnRng } from './state';
import { Rng } from '../../core/rng';

export interface StepResult {
  run: GameRun;
  events: SimEvent[];
}

export function livingCrew(run: GameRun): number {
  return run.crew.filter((c) => c.alive).length;
}

/** Cost multiplier for entering a hex, or null if not sailable. */
export function sailCost(run: GameRun, to: Axial): number | null {
  const t = run.chart.tiles[key(to)];
  if (!t || t.terrain === 'land' || t.terrain === 'ice') return null;
  let cost = BALANCE.sailing.baseMoveCost;
  // Adverse wind: moving toward where the wind is blowing FROM.
  const dir = dirTo(run.chart.shipAt, to);
  if (dir >= 0 && run.weather.windStrength > 0) {
    const diff = Math.min(
      (dir - run.weather.windFrom + 6) % 6,
      (run.weather.windFrom - dir + 6) % 6,
    );
    if (diff <= 1) cost += BALANCE.sailing.adverseWindExtra;
  }
  if (run.weather.storms.some((s) => distance(s, to) <= 1)) {
    cost += BALANCE.sailing.stormEntryExtra;
  }
  return cost;
}

function log(run: GameRun, events: SimEvent[], text: string, tone: 'info' | 'good' | 'bad' | 'saga' = 'info') {
  const entry = { turn: run.turn, text, tone };
  run.log.push(entry);
  events.push({ type: 'LOG', entry });
}

function endRun(run: GameRun, events: SimEvent[], end: RunEnd) {
  run.phase = 'ended';
  run.end = end;
  events.push({ type: 'RUN_ENDED', end });
}

function computeFame(run: GameRun, victory: boolean): number {
  const westward = run.chart.startAt.q + ((run.chart.startAt.r - (run.chart.startAt.r & 1)) >> 1)
    - (run.chart.shipAt.q + ((run.chart.shipAt.r - (run.chart.shipAt.r & 1)) >> 1));
  let fame = Math.max(0, westward) * 2 + (run.flags['fameEarned'] ?? 0);
  if (victory) fame += BALANCE.morale.victoryFameBase;
  return fame;
}

/** Everything that ticks after the ship acts: weather drift, storm damage, checks. */
function endOfTurn(run: GameRun, events: SimEvent[], rng: Rng) {
  const w = run.weather;
  // Wind wanders.
  const windRng = rng.fork('wind');
  if (windRng.chance(0.25)) w.windFrom = (w.windFrom + windRng.pick([-1, 1]) + 6) % 6;
  if (windRng.chance(0.3)) {
    w.windStrength = Math.max(0, Math.min(3, w.windStrength + windRng.pick([-1, 1]))) as 0 | 1 | 2 | 3;
  }
  // Storms drift; over land they dissipate and respawn elsewhere at sea.
  const stormRng = rng.fork('storms');
  w.storms = w.storms.map((s) => {
    const drift = neighbors(s)[stormRng.int(0, 5)]!;
    const t = run.chart.tiles[key(drift)];
    return t && t.terrain !== 'land' && t.terrain !== 'ice' ? drift : s;
  });

  // Storm sitting on the ship: hull damage + morale.
  if (w.storms.some((s) => distance(s, run.chart.shipAt) <= 1)) {
    const dmg = stormRng.int(BALANCE.ship.stormHullDamage[0], BALANCE.ship.stormHullDamage[1]);
    run.ship.hull -= dmg;
    run.moraleShip = Math.max(0, run.moraleShip - BALANCE.ship.stormMoraleHit);
    events.push({ type: 'STORM_HIT', at: run.chart.shipAt, hullDamage: dmg });
    log(run, events, `A storm hammers the ${run.ship.name}. The hull groans (-${dmg} hull).`, 'bad');
  }

  // Death checks.
  if (run.ship.hull <= 0) {
    log(run, events, `The sea claims the ${run.ship.name}. No one reaches shore.`, 'saga');
    endRun(run, events, {
      outcome: 'sunk',
      fame: computeFame(run, false),
      summary: [`Sunk on turn ${run.turn}.`],
    });
    return;
  }
  if (livingCrew(run) === 0) {
    endRun(run, events, {
      outcome: 'slain',
      fame: computeFame(run, false),
      summary: [`The crew perished on turn ${run.turn}.`],
    });
    return;
  }
  if (run.moraleShip <= 0) {
    const starving = run.food <= 0 || run.water <= 0;
    if (starving) {
      log(run, events, 'Hollow-eyed and silent, the crew stops rowing. The sea does the rest.', 'saga');
    } else {
      log(run, events, 'The crew has had enough. They turn the ship for home without you.', 'saga');
    }
    endRun(run, events, {
      outcome: starving ? 'starved' : 'mutiny',
      fame: computeFame(run, false),
      summary: [starving ? `Starved at sea on turn ${run.turn}.` : `Mutiny on turn ${run.turn}.`],
    });
  }
}

function consumeSupplies(run: GameRun, events: SimEvent[], rng: Rng) {
  const alive = livingCrew(run);
  const foodNeed = alive * BALANCE.crew.foodPerCrewPerMove;
  const waterNeed = alive * BALANCE.crew.waterPerCrewPerMove;
  const foodUsed = Math.min(run.food, foodNeed);
  const waterUsed = Math.min(run.water, waterNeed);
  run.food = Math.round((run.food - foodUsed) * 100) / 100;
  run.water = Math.round((run.water - waterUsed) * 100) / 100;
  events.push({ type: 'SUPPLIES_CONSUMED', food: foodUsed, water: waterUsed });

  const starving = foodUsed < foodNeed || waterUsed < waterNeed;
  if (starving) {
    events.push({ type: 'STARVING' });
    run.moraleShip = Math.max(0, run.moraleShip - BALANCE.sailing.moveMoralePenaltyStarving);
    // The weakest living crew member suffers.
    const victims = run.crew.filter((c) => c.alive).sort((a, b) => a.hp - b.hp);
    const victim = victims[0];
    if (victim) {
      victim.hp -= BALANCE.sailing.starvationHpLoss;
      if (victim.hp <= 0) {
        victim.alive = false;
        victim.hp = 0;
        events.push({ type: 'CREW_DIED', crewId: victim.id, name: victim.name, cause: 'hunger and thirst' });
        log(run, events, `${victim.name} dies of hunger and thirst. The crew sings them to Ran's halls.`, 'bad');
      } else {
        log(run, events, `Rations run dry. ${victim.name} weakens (${victim.hp}/${victim.hpMax}).`, 'bad');
      }
    }
    void rng;
  }
}

function discoverAround(run: GameRun, events: SimEvent[]) {
  const radius = BALANCE.chart.fogRadius + (run.ship.upgrades.includes('crows-nest') ? 1 : 0);
  for (const h of revealRadius(run.chart.shipAt, radius)) {
    const k = key(h);
    if (run.chart.discovered.has(k)) continue;
    run.chart.discovered.add(k);
    const t = run.chart.tiles[k];
    if (t?.feature && distance(h, run.chart.shipAt) <= 1 && t.feature.kind !== 'home') {
      events.push({ type: 'DISCOVERED_FEATURE', at: h, kind: t.feature.kind, name: t.feature.name });
    }
  }
}

export function stepStrategic(prev: GameRun, intent: StrategicIntent): StepResult {
  const run = structuredClone(prev);
  const events: SimEvent[] = [];
  if (run.phase !== 'voyage') {
    return { run: prev, events: [] };
  }
  const rng = turnRng(run);

  switch (intent.type) {
    case 'SAIL': {
      const from = run.chart.shipAt;
      if (distance(from, intent.to) !== 1) return { run: prev, events: [] };
      const cost = sailCost(run, intent.to);
      if (cost === null) return { run: prev, events: [] };
      run.turn += 1;
      run.chart.shipAt = intent.to;
      events.push({ type: 'MOVED', from, to: intent.to });
      // Higher cost = harder leg = supplies consumed once per cost point.
      for (let i = 0; i < cost; i++) consumeSupplies(run, events, rng);
      discoverAround(run, events);

      // Victory check: reaching Vinland's coast.
      const t = run.chart.tiles[key(intent.to)];
      if (t && t.region === 'vinland' && (t.terrain === 'coast' || t.feature)) {
        log(run, events, 'Land. Green shores no Norseman has named. Vinland the Good!', 'saga');
        endRun(run, events, {
          outcome: 'victory',
          fame: computeFame(run, true),
          summary: [
            `Reached Vinland on turn ${run.turn}.`,
            `${livingCrew(run)} of ${run.crew.length} crew survived the crossing.`,
          ],
        });
        return { run, events };
      }
      endOfTurn(run, events, rng);
      return { run, events };
    }
    case 'WAIT': {
      run.turn += 1;
      const hadFood = run.food > 0 && run.water > 0;
      consumeSupplies(run, events, rng);
      log(run, events, 'The crew rests at anchor, watching the sky.');
      // Resting recovers a little fatigue — and hp, but only on full bellies.
      for (const c of run.crew) {
        if (!c.alive) continue;
        c.fatigue = Math.max(0, c.fatigue - 2);
        if (hadFood) c.hp = Math.min(c.hpMax, c.hp + 1);
      }
      endOfTurn(run, events, rng);
      return { run, events };
    }
    case 'REPAIR': {
      if (run.timber <= 0 || run.ship.hull >= run.ship.hullMax) return { run: prev, events: [] };
      run.turn += 1;
      consumeSupplies(run, events, rng);
      const spend = Math.min(run.timber, 2, run.ship.hullMax - run.ship.hull);
      run.timber -= spend;
      run.ship.hull = Math.min(run.ship.hullMax, run.ship.hull + spend * 2);
      events.push({ type: 'HULL_REPAIRED', amount: spend * 2 });
      log(run, events, `The crew patches the hull with ${spend} timber (+${spend * 2} hull).`, 'good');
      endOfTurn(run, events, rng);
      return { run, events };
    }
    case 'ABANDON_RUN': {
      endRun(run, events, {
        outcome: 'abandoned',
        fame: Math.floor(computeFame(run, false) / 2),
        summary: [`Turned back on turn ${run.turn}.`],
      });
      return { run, events };
    }
  }
}

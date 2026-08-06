// The voyage reducer: validates a StrategicIntent against the run,
// mutates a structured-clone of the state, and returns the events that
// happened. Pure — all randomness from the deterministic turn stream.

import { Axial, key, distance, dirTo, neighbors } from '../../core/hex';
import { revealRadius } from '../../core/fov';
import { BALANCE } from '../../content/balance';
import { GameRun, SimEvent, StrategicIntent, TacticalIntent, RunEnd } from '../types';
import { turnRng } from './state';
import { makeRng, Rng } from '../../core/rng';
import { activate, pickEvent, resolveOption } from '../events/engine';
import { buy, dock, portHere, recruit, repairAtPort } from './ports';
import {
  BattleLogLine,
  battleOutcome,
  fleeMoves,
  refreshSide,
  routChecks,
  tryBrace,
  tryMove,
  tryPush,
  tryRally,
  tryStrike,
  unitById,
} from '../tactical/actions';
import { runEnemyTurn } from '../tactical/ai';
import { applyBattleOutcome } from '../tactical/outcome';

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
  // Adverse wind: moving toward where the wind is blowing FROM, when it
  // blows hard. Sealskin sails shrug off all but a dead-on headwind.
  const dir = dirTo(run.chart.shipAt, to);
  if (dir >= 0 && run.weather.windStrength >= 2) {
    const diff = Math.min(
      (dir - run.weather.windFrom + 6) % 6,
      (run.weather.windFrom - dir + 6) % 6,
    );
    const threshold = run.ship.upgrades.includes('sealskin-sails') ? 0 : 1;
    if (diff <= threshold) cost += BALANCE.sailing.adverseWindExtra;
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
  const alive = livingCrew(run);
  const raids = run.flags['raidsWon'] ?? 0;
  const deeds: string[] = [];
  if (end.outcome !== 'victory') {
    deeds.push(`${run.turn} turns on the whale-road.`);
  }
  deeds.push(
    alive > 0
      ? `${alive} of ${run.crew.length} crew ${end.outcome === 'victory' ? 'set foot on the new shore' : 'lived to tell it'}.`
      : 'None of the crew survived.',
  );
  if (raids > 0) deeds.push(`${raids} raid${raids > 1 ? 's' : ''} carried.`);
  if (run.silver > 0) deeds.push(`${run.silver} silver in the hold.`);
  run.phase = 'ended';
  run.end = { ...end, summary: [...end.summary, ...deeds] };
  events.push({ type: 'RUN_ENDED', end: run.end });
}

function computeFame(run: GameRun, victory: boolean): number {
  const westward = run.chart.startAt.q + ((run.chart.startAt.r - (run.chart.startAt.r & 1)) >> 1)
    - (run.chart.shipAt.q + ((run.chart.shipAt.r - (run.chart.shipAt.r & 1)) >> 1));
  let fame = Math.max(0, westward) * 2 + (run.flags['fameEarned'] ?? 0);
  if (victory) fame += BALANCE.morale.victoryFameBase;
  return fame;
}

/** Lethal-state checks shared by turn-end and event resolution. */
function checkRunEnd(run: GameRun, events: SimEvent[]): boolean {
  if (run.phase === 'ended') return true;
  if (run.ship.hull <= 0) {
    log(run, events, `The sea claims the ${run.ship.name}. No one reaches shore.`, 'saga');
    endRun(run, events, {
      outcome: 'sunk',
      fame: computeFame(run, false),
      summary: [`Sunk on turn ${run.turn}.`],
    });
    return true;
  }
  if (livingCrew(run) === 0) {
    endRun(run, events, {
      outcome: 'slain',
      fame: computeFame(run, false),
      summary: [`The crew perished on turn ${run.turn}.`],
    });
    return true;
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
    return true;
  }
  return false;
}

/** Everything that ticks after the ship acts: weather drift, storm damage, checks. */
function endOfTurn(run: GameRun, events: SimEvent[], rng: Rng) {
  // Wounds knit slowly at sea.
  for (const c of run.crew) {
    if (!c.alive) continue;
    c.injuries = c.injuries.filter((inj) => {
      inj.healTurns -= 1;
      if (inj.healTurns <= 0) {
        log(run, events, `${c.name}'s ${inj.label.toLowerCase()} has healed.`, 'good');
        return false;
      }
      return true;
    });
  }

  // Winter is the voyage's clock: linger too long and the crew's spirit
  // bleeds out no matter how full the hold is.
  if (run.turn === BALANCE.morale.winterOnset) {
    log(run, events, 'The nights grow long and the water darker. Winter is coming for this crossing.', 'saga');
  }
  if (run.turn >= BALANCE.morale.winterOnset) {
    const bite = 1 + Math.floor((run.turn - BALANCE.morale.winterOnset) / 25);
    run.moraleShip = Math.max(0, run.moraleShip - bite);
  }

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

  checkRunEnd(run, events);
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

/** Battle-phase sub-reducer. `run` is already a clone of `prev`. */
function stepBattle(
  prev: GameRun,
  run: GameRun,
  events: SimEvent[],
  intent: StrategicIntent | TacticalIntent,
): StepResult {
  const battle = run.activeBattle!;

  // Result screen showing: only Continue applies the outcome.
  if (battle.result) {
    if (intent.type === 'BATTLE_CONTINUE') {
      const rng = makeRng(run.seed).fork(`battle-outcome:${run.turn}`);
      applyBattleOutcome(run, battle, events, rng);
      delete run.activeBattle;
      run.phase = 'voyage';
      checkRunEnd(run, events);
      return { run, events };
    }
    return { run: prev, events: [] };
  }

  battle.actionN += 1;
  const brng = makeRng(run.seed).fork(`battle:${run.turn}:${battle.actionN}`);
  const blog: BattleLogLine[] = [];
  let acted = false;

  switch (intent.type) {
    case 'T_MOVE': {
      const unit = unitById(battle, intent.unitId);
      if (unit && unit.side === 'player' && unit.alive && !unit.escaped) {
        acted = tryMove(battle, unit, intent.to);
      }
      break;
    }
    case 'T_STRIKE': {
      const unit = unitById(battle, intent.unitId);
      const target = unitById(battle, intent.targetId);
      if (unit && target && unit.side === 'player') {
        acted = tryStrike(battle, unit, target, brng.fork('strike'), blog);
      }
      break;
    }
    case 'T_BRACE': {
      const unit = unitById(battle, intent.unitId);
      if (unit && unit.side === 'player' && unit.alive && !unit.escaped) {
        acted = tryBrace(unit);
      }
      break;
    }
    case 'T_PUSH': {
      const unit = unitById(battle, intent.unitId);
      const target = unitById(battle, intent.targetId);
      if (unit && target && unit.side === 'player') {
        acted = tryPush(battle, unit, target, brng.fork('push'), blog);
      }
      break;
    }
    case 'T_RALLY': {
      const unit = unitById(battle, intent.unitId);
      if (unit && unit.side === 'player' && unit.alive && !unit.escaped) {
        acted = tryRally(battle, unit, blog);
      }
      break;
    }
    case 'T_END_TURN': {
      acted = true;
      refreshSide(battle, 'enemy');
      routChecks(battle, 'enemy', brng.fork('rout-e'), blog);
      fleeMoves(battle, 'enemy', blog);
      if (!battleOutcome(battle)) runEnemyTurn(battle, brng.fork('ai'), blog);
      if (!battleOutcome(battle)) {
        battle.round += 1;
        refreshSide(battle, 'player');
        routChecks(battle, 'player', brng.fork('rout-p'), blog);
        fleeMoves(battle, 'player', blog);
      }
      break;
    }
    default:
      break;
  }

  if (!acted) return { run: prev, events: [] };
  for (const line of blog) {
    const entry = { turn: run.turn, text: line.text, tone: line.tone };
    run.log.push(entry);
    events.push({ type: 'LOG', entry });
  }
  const oc = battleOutcome(battle);
  if (oc) battle.result = oc;
  return { run, events };
}

/** Roll for (and fire) a voyage event on the current tile. */
function maybeFireEvent(run: GameRun, rng: Rng): void {
  const tile = run.chart.tiles[key(run.chart.shipAt)];
  const onEventFeature =
    tile?.feature &&
    !tile.feature.used &&
    ['wreck', 'village', 'monastery', 'mythic'].includes(tile.feature.kind);
  const eventRng = rng.fork('event-roll');
  const fires =
    onEventFeature || eventRng.chance(0.2 + (tile?.dangerTier ?? 0) * 0.05);
  if (!fires) return;
  const def = pickEvent(run, eventRng.fork('pick'));
  if (!def) return;
  run.activeEvent = activate(run, def);
  run.phase = 'event';
}

export function stepStrategic(
  prev: GameRun,
  intent: StrategicIntent | TacticalIntent,
): StepResult {
  const run = structuredClone(prev);
  const events: SimEvent[] = [];
  const rng = turnRng(run);

  // Phase-gated intents outside the voyage phase.
  if (run.phase === 'event') {
    if (intent.type === 'CHOOSE_OPTION') {
      resolveOption(run, events, intent.index, rng.fork(`resolve:${run.turn}`));
      if (run.activeEvent?.outcome) {
        log(run, events, run.activeEvent.outcome.text, run.activeEvent.outcome.success ? 'good' : 'bad');
      }
      checkRunEnd(run, events);
      return { run, events };
    }
    if (intent.type === 'EVENT_CONTINUE' && run.activeEvent?.outcome) {
      delete run.activeEvent;
      if (run.activeBattle) {
        // The event's outcome raised shields — go to the beach.
        run.phase = 'battle';
        log(run, events, 'Shields down from the rack. The crew wades ashore.', 'saga');
        return { run, events };
      }
      run.phase = 'voyage';
      // Landing on a port right after an event (e.g. arrival event) still docks.
      if (portHere(run)) dock(run, events);
      return { run, events };
    }
    return { run: prev, events: [] };
  }

  if (run.phase === 'battle' && run.activeBattle) {
    return stepBattle(prev, run, events, intent);
  }

  if (run.phase === 'port') {
    switch (intent.type) {
      case 'PORT_BUY':
        return buy(run, intent.item, intent.qty) ? { run, events } : { run: prev, events: [] };
      case 'PORT_REPAIR':
        return repairAtPort(run) ? { run, events } : { run: prev, events: [] };
      case 'PORT_RECRUIT':
        return recruit(run, intent.recruitId) ? { run, events } : { run: prev, events: [] };
      case 'PORT_LEAVE': {
        delete run.activePort;
        run.phase = 'voyage';
        log(run, events, 'Lines cast off. The open sea again.');
        return { run, events };
      }
      default:
        return { run: prev, events: [] };
    }
  }

  if (run.phase !== 'voyage') {
    return { run: prev, events: [] };
  }

  switch (intent.type) {
    case 'SAIL': {
      const from = run.chart.shipAt;
      if (distance(from, intent.to) !== 1) return { run: prev, events: [] };
      const cost = sailCost(run, intent.to);
      if (cost === null) return { run: prev, events: [] };
      run.turn += 1;
      run.chart.shipAt = intent.to;
      events.push({ type: 'MOVED', from, to: intent.to });
      // Higher cost = harder leg = supplies consumed once per cost point,
      // and hard rowing tires the crew (they carry it into any fight).
      for (let i = 0; i < cost; i++) consumeSupplies(run, events, rng);
      if (cost > 1) {
        for (const c of run.crew) if (c.alive) c.fatigue = Math.min(8, c.fatigue + 1);
      } else {
        for (const c of run.crew) if (c.alive) c.fatigue = Math.max(0, c.fatigue - 1);
      }
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
      if (run.phase === 'voyage') {
        // Ports auto-dock; other unused features (or plain sea) may fire events.
        if (portHere(run)) {
          dock(run, events);
        } else {
          maybeFireEvent(run, rng);
        }
      }
      return { run, events };
    }
    case 'WAIT': {
      run.turn += 1;
      const hadFood = run.food > 0 && run.water > 0;
      consumeSupplies(run, events, rng);
      // A held day is a working day: lines over the side, and canvas
      // spread for rain if a storm is near.
      const tile = run.chart.tiles[key(run.chart.shipAt)];
      const canFish = tile?.terrain === 'sea' || tile?.terrain === 'coast';
      const rainNear = run.weather.storms.some((s) => distance(s, run.chart.shipAt) <= 2);
      let gains = '';
      if (canFish) {
        run.food += 3;
        gains = ' Lines out — the catch is fair (+3 food).';
      }
      if (rainNear) {
        run.water += 4;
        gains += ' Storm-rain drums on the spread sail (+4 water).';
      } else {
        run.water += 2;
        gains += ' A passing squall wets the canvas (+2 water).';
      }
      log(run, events, `The crew holds position, watching the sky.${gains}`);
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
    case 'DOCK': {
      return dock(run, events) ? { run, events } : { run: prev, events: [] };
    }
    default:
      return { run: prev, events: [] };
  }
}

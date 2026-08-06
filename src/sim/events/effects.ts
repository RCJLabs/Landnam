// Typed effect interpreter — the only way events touch the run state.

import { key } from '../../core/hex';
import { Rng } from '../../core/rng';
import { BALANCE } from '../../content/balance';
import { raidById } from '../../content/raids';
import { Effect, GameRun, SimEvent } from '../types';
import { makeRecruit } from '../strategic/crewGen';
import { makeBattle } from '../tactical/battle';

export function applyEffects(run: GameRun, events: SimEvent[], effects: Effect[], rng: Rng): void {
  for (const eff of effects) applyEffect(run, events, eff, rng);
}

function clampRes(run: GameRun): void {
  run.food = Math.max(0, run.food);
  run.water = Math.max(0, run.water);
  run.silver = Math.max(0, run.silver);
  run.timber = Math.max(0, run.timber);
  run.ship.hull = Math.min(run.ship.hullMax, run.ship.hull);
}

function applyEffect(run: GameRun, events: SimEvent[], eff: Effect, rng: Rng): void {
  switch (eff.t) {
    case 'res': {
      run.food += eff.food ?? 0;
      run.water += eff.water ?? 0;
      run.silver += eff.silver ?? 0;
      run.timber += eff.timber ?? 0;
      if (eff.hull) run.ship.hull += eff.hull;
      clampRes(run);
      break;
    }
    case 'morale': {
      run.moraleShip = Math.max(0, Math.min(BALANCE.morale.max, run.moraleShip + eff.amount));
      break;
    }
    case 'hurtRandom': {
      const alive = run.crew.filter((c) => c.alive);
      const count = Math.min(eff.count ?? 1, alive.length);
      const victims = rng.shuffle([...alive]).slice(0, count);
      for (const v of victims) {
        v.hp -= eff.amount;
        if (v.hp <= 0) {
          v.hp = 0;
          v.alive = false;
          events.push({ type: 'CREW_DIED', crewId: v.id, name: v.name, cause: 'misfortune' });
        }
      }
      break;
    }
    case 'healAll': {
      for (const c of run.crew) {
        if (c.alive) c.hp = Math.min(c.hpMax, c.hp + eff.amount);
      }
      break;
    }
    case 'killWeakest': {
      const alive = run.crew.filter((c) => c.alive && !c.isCaptain).sort((a, b) => a.hp - b.hp);
      const victim = alive[0];
      if (victim) {
        victim.alive = false;
        victim.hp = 0;
        events.push({ type: 'CREW_DIED', crewId: victim.id, name: victim.name, cause: 'the sea' });
      }
      break;
    }
    case 'recruitCastaway': {
      run.idCounter += 1;
      run.crew.push(makeRecruit(rng, run.idCounter));
      break;
    }
    case 'setFlag': {
      run.flags[eff.flag] = eff.value;
      break;
    }
    case 'fame': {
      run.flags['fameEarned'] = (run.flags['fameEarned'] ?? 0) + eff.amount;
      break;
    }
    case 'markUsed': {
      const tile = run.chart.tiles[key(run.chart.shipAt)];
      if (tile?.feature) tile.feature.used = true;
      break;
    }
    case 'startBattle': {
      const tile = run.chart.tiles[key(run.chart.shipAt)];
      run.activeBattle = makeBattle(
        raidById(eff.raidId),
        run.crew,
        tile?.dangerTier ?? 0,
        rng.fork('battle-setup'),
      );
      break;
    }
  }
}

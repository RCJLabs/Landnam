// Mapping battle results back onto the voyage: crew hp/deaths, loot, morale.

import { key } from '../../core/hex';
import { Rng } from '../../core/rng';
import { Battle, GameRun, SimEvent } from '../types';
import { applyEffects } from '../events/effects';

export function applyBattleOutcome(
  run: GameRun,
  battle: Battle,
  events: SimEvent[],
  rng: Rng,
): void {
  // Sync unit state back to crew.
  for (const unit of battle.units) {
    if (!unit.crewId) continue;
    const crew = run.crew.find((c) => c.id === unit.crewId);
    if (!crew) continue;
    if (!unit.alive) {
      // A downed viking has a chance to be dragged back to the ship alive.
      const saved = rng.roll(2, 6) + crew.guts >= 10;
      if (saved && battle.result === 'won') {
        crew.hp = 1;
        const entry = {
          turn: run.turn,
          text: `${crew.name} is carried back aboard, bloodied but breathing.`,
          tone: 'info' as const,
        };
        run.log.push(entry);
        events.push({ type: 'LOG', entry });
      } else {
        crew.alive = false;
        crew.hp = 0;
        events.push({ type: 'CREW_DIED', crewId: crew.id, name: crew.name, cause: 'battle' });
        const entry = {
          turn: run.turn,
          text: `${crew.name} dies ${battle.result === 'won' ? 'in the hour of victory' : 'on foreign sand'}. Valhalla has them now.`,
          tone: 'bad' as const,
        };
        run.log.push(entry);
        events.push({ type: 'LOG', entry });
      }
    } else {
      crew.hp = Math.max(1, unit.hp);
    }
  }

  const tile = run.chart.tiles[key(run.chart.shipAt)];
  if (battle.result === 'won') {
    applyEffects(run, events, battle.loot, rng);
    run.moraleShip = Math.min(100, run.moraleShip + 8);
    if (tile?.feature) tile.feature.used = true;
    const entry = {
      turn: run.turn,
      text: `Victory! ${battle.lootText}`,
      tone: 'saga' as const,
    };
    run.log.push(entry);
    events.push({ type: 'LOG', entry });
  } else {
    run.moraleShip = Math.max(0, run.moraleShip - 12);
    const entry = {
      turn: run.turn,
      text: 'The survivors pull hard for the ship, leaving the shore to the enemy.',
      tone: 'bad' as const,
    };
    run.log.push(entry);
    events.push({ type: 'LOG', entry });
  }
}

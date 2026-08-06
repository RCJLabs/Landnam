// Event engine: eligibility, weighted selection, stat checks, resolution.

import { key } from '../../core/hex';
import { Rng } from '../../core/rng';
import { EVENTS } from '../../content/events';
import {
  ActiveEvent,
  Cond,
  EventDef,
  EventOption,
  GameRun,
  SimEvent,
  StatCheck,
} from '../types';
import { applyEffects } from './effects';

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

function condHolds(run: GameRun, cond: Cond): boolean {
  const tile = run.chart.tiles[key(run.chart.shipAt)];
  switch (cond.c) {
    case 'region':
      return tile !== undefined && cond.is.includes(tile.region);
    case 'dangerMin':
      return tile !== undefined && tile.dangerTier >= cond.tier;
    case 'turnMin':
      return run.turn >= cond.turn;
    case 'moraleMax':
      return run.moraleShip <= cond.value;
    case 'flagUnset':
      return (run.flags[cond.flag] ?? 0) === 0;
    case 'flagMin':
      return (run.flags[cond.flag] ?? 0) >= cond.value;
    case 'onFeature':
      return tile?.feature?.kind === cond.kind && !tile.feature.used;
  }
}

export function eligible(run: GameRun, def: EventDef): boolean {
  if (def.once && (run.flags[`seen_${def.id}`] ?? 0) > 0) return false;
  return (def.conditions ?? []).every((c) => condHolds(run, c));
}

/** Chance that 2d6 + stat >= dc. */
export function checkOdds(statValue: number, dc: number): number {
  const need = dc - statValue;
  if (need <= 2) return 1;
  if (need > 12) return 0;
  // Ways to roll >= need on 2d6.
  let ways = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) if (a + b >= need) ways++;
  }
  return ways / 36;
}

export function checkStatValue(run: GameRun, check: StatCheck): number {
  const alive = run.crew.filter((c) => c.alive);
  if (alive.length === 0) return 0;
  if (check.who === 'captain') {
    const cap = alive.find((c) => c.isCaptain) ?? alive[0]!;
    return cap[check.stat];
  }
  if (check.who === 'best') {
    return Math.max(...alive.map((c) => c[check.stat]));
  }
  return Math.round(alive.reduce((s, c) => s + c[check.stat], 0) / alive.length);
}

const STAT_LABEL = { might: 'Might', skill: 'Skill', guts: 'Guts', sea: 'Seacraft' } as const;

function optionDetail(run: GameRun, opt: EventOption): string | undefined {
  if (!opt.check) return undefined;
  const value = checkStatValue(run, opt.check);
  const odds = Math.round(checkOdds(value, opt.check.dc) * 100);
  return `${STAT_LABEL[opt.check.stat]} check — ${odds}%`;
}

/** Build the player-facing snapshot for a firing event. */
export function activate(run: GameRun, def: EventDef): ActiveEvent {
  return {
    eventId: def.id,
    title: def.title,
    text: def.text,
    options: def.options.map((o) => {
      const detail = optionDetail(run, o);
      return detail === undefined ? { label: o.label } : { label: o.label, detail };
    }),
  };
}

/** Pick an eligible event for this tile-entry, or null. Weighted. */
export function pickEvent(run: GameRun, rng: Rng): EventDef | null {
  const pool = EVENTS.filter((e) => eligible(run, e));
  if (pool.length === 0) return null;
  return rng.weightedPick(pool, (e) => e.weight);
}

/** Resolve a chosen option: roll the check, apply effects, stash outcome text. */
export function resolveOption(
  run: GameRun,
  events: SimEvent[],
  optionIndex: number,
  rng: Rng,
): void {
  const active = run.activeEvent;
  if (!active || active.outcome) return;
  const def = eventById(active.eventId);
  const opt = def?.options[optionIndex];
  if (!def || !opt) return;

  run.flags[`seen_${def.id}`] = 1;

  let success = true;
  if (opt.check) {
    const value = checkStatValue(run, opt.check);
    success = rng.roll(2, 6) + value >= opt.check.dc;
  }
  const branch = success ? opt.success : (opt.failure ?? opt.success);
  applyEffects(run, events, branch.effects, rng);
  active.outcome = { text: branch.text, success };
}

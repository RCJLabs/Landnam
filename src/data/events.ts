// Travel events. Pure data — the engine in sim/events.ts interprets these,
// so adding an event never touches engine code.
//
// Card bodies are written in the moment; outcome text is past tense, because
// outcomes are what gets copied into the saga log.

import type { Season, Stats, Terrain } from '../state/types';
import { EVENTS } from './eventCards';
import type { LoreId } from './lore';
import type { BuildingId } from './buildings';

export type Condition =
  | { c: 'terrain'; any: Terrain[] }
  | { c: 'season'; any: Season[] }
  | { c: 'dayMin'; day: number }
  | { c: 'moraleMax'; value: number }
  | { c: 'flagUnset'; flag: string }
  /** The flag has been raised. How one card's choice opens another card. */
  | { c: 'flagSet'; flag: string }
  | { c: 'nearWater' }
  /** The posts are in the ground somewhere. */
  | { c: 'settled' }
  /** Standing on your own hearth. */
  | { c: 'atHome' }
  /** The store is at or below this. Lets scarcity pull its own events. */
  | { c: 'foodMax'; value: number }
  | { c: 'firewoodMax'; value: number }
  /** Someone in the band is carrying an illness. */
  | { c: 'sick' }
  /** The angriest neighbour is at least this far below nothing. */
  | { c: 'anger'; min: number }
  /** The friendliest neighbour thinks at least this well of us. */
  | { c: 'goodwill'; min: number }
  /** The band has NOT worked this out yet. How a discovery stops repeating. */
  | { c: 'unknown'; lore: LoreId }
  /** The band already knows this. Lets one discovery lead to another. */
  | { c: 'known'; lore: LoreId }
  /** This building is standing at the steading. */
  | { c: 'built'; building: BuildingId };

export type Effect =
  | { t: 'food'; n: number }
  | { t: 'firewood'; n: number }
  | { t: 'morale'; n: number }
  | { t: 'wound'; n: number; count?: number }
  | { t: 'heal'; n: number }
  | { t: 'injure' }
  | { t: 'kill' }
  | { t: 'flag'; flag: string; n: number }
  | { t: 'reveal'; radius: number }
  /** Draws steel: the fight begins once the card is dismissed. */
  | { t: 'battle'; difficulty?: number }
  /** They came for the steading. Fought on your own ground, with it at stake. */
  | { t: 'raid'; difficulty?: number }
  /** Moves what one neighbour thinks of you. Cards say which one they mean. */
  | { t: 'standing'; n: number; who: 'angriest' | 'friendliest' }
  /** The band works something out. See data/lore.ts. */
  | { t: 'learn'; lore: LoreId }
  /**
   * Somebody throws their lot in with the band, as a hand. Turned away with
   * nothing said if there is no bed for them, which is what makes a búð worth
   * building. See sim/joining.ts.
   */
  | { t: 'join'; n?: number; why: string };

export interface Outcome {
  text: string;
  effects: Effect[];
}

export interface EventChoice {
  label: string;
  /** Absent means the choice always succeeds. */
  check?: { stat: keyof Stats; dc: number };
  success: Outcome;
  failure?: Outcome;
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  weight: number;
  once?: boolean;
  when?: Condition[];
  choices: EventChoice[];
}

/**
 * The deck lives in eventCards.ts. It is re-exported here so that every
 * consumer still writes `from '../data/events'` — the split is about where
 * the lines live, not about making thirty call sites move.
 */
export { EVENTS } from './eventCards';

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
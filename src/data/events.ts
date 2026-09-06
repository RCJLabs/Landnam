// Travel events. Pure data — the engine in sim/events.ts interprets these,
// so adding an event never touches engine code.
//
// Card bodies are written in the moment; outcome text is past tense, because
// outcomes are what gets copied into the saga log.

import type { Season, Stats, Tally, Terrain } from '../state/types';
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
  /**
   * The band is on the water TODAY — the deck of a knarr under way, not a
   * beach with a view of it.
   *
   * Its own condition rather than `terrain: ['ocean']`, because the two maps
   * answer that differently and one of them cannot answer it at all. On the
   * hex island being at sea is a tile you stand on; on a coast rowing is a
   * STEP and not a state, so `route.COUNTRY` has no ocean in it and a card
   * gated on ocean ground is a card that can never be drawn. `a-lean-sail`
   * was exactly that for the length of the conversion, and the harness's
   * "cards never once eligible" sweep is what found it.
   */
  | { c: 'afloat' }
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
  | { c: 'built'; building: BuildingId }
  // --- WHAT THE BAND HAS DONE (12.14) ---
  //
  // Eighteen kinds before these four, and not one of them could ask about the
  // band's own history: no tally, no outlaw, no rival, no jarl. The deck knew
  // where you were standing, what season it was and what was in the store,
  // and nothing at all about who you had become. Of 103 cards, none mentioned
  // the jarl, the outlaw or the rival — the words do not appear in the file.
  /**
   * A named counter in the tally has reached at least this.
   *
   * ONE KIND rather than four, because `Tally` is already a record of named
   * counters and a `sackings` condition beside a `battles` condition beside a
   * `foesFelled` condition would be three copies of the same idea drifting
   * apart. `of` is keyed to the interface, so a counter added there is
   * immediately askable and a counter renamed fails the type check.
   */
  | { c: 'tally'; of: keyof Tally; min: number }
  /**
   * The band rules — an assembly carried them and they have not laid it down.
   *
   * NOT `flagSet: 'ruleTaken'`, which is what the item's verifier suggested
   * and is a different fact: `travel.ts` sets that flag in the `RULE_ON`
   * player action, where the comment says it "marks the card as read". Gating
   * content on it would mean "the player pressed Rule on", and a band that
   * rules but left the proclamation unread would be told it does not.
   */
  | { c: 'ruling' }
  /** The band has driven at least this many of its own people out. */
  | { c: 'outlawed'; min: number }
  /** The other landnamsmadr has been met — face to face, not heard of. */
  | { c: 'metRival' };

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
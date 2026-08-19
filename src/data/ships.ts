// The knarr, as numbers.
//
// She was one boolean — `party.hullHoled` — from the sea work until now: a
// flag saying "slower", mended by a night and two of timber. Everything the
// sea does hung off that one bit, including `STRAND_HAUL`, whose comment has
// always said "the hold takes more than backs can carry" while there was no
// hold to take anything.
//
// The rule these numbers are chosen against: a SOUND hull must behave
// exactly as the old flag did, and a hull with one strake sprung exactly as
// `hullHoled` did. Everything new happens past that — a second strake, a
// third — so the recorded runs and the parity vectors do not move for any
// voyage the old model could describe.

/** Strakes of soundness a whole hull has. */
export const SHIP_STRAKES = 3;

/** Timber a night ashore spends putting one sprung strake right. */
export const STRAKE_MEND_WOOD = 2;

/** What a whole hull carries. Six backs carry eighteen; she carries more. */
export const HOLD_WHOLE = 24;

/**
 * What each sprung strake costs the hold — water in the bilge, cargo shifted.
 *
 * Eight, not six, and the first cut had six. Six made the cap decoration: a
 * hull with two strakes gone still held twelve, more than three backs carry,
 * so the number existed and never once refused a load. At eight she holds
 * 24 / 16 / 8, which means one sprung strake already bites on a full band of
 * six (eighteen) — a damaged hull is a shorter errand from the first hit.
 */
export const HOLD_PER_STRAKE = 8;

/**
 * Names for a knarr — a trader's ship, not a longship, so these are working
 * names rather than a king's boasts: sea-horses, weather, and the animals a
 * hull is shaped like.
 */
export const KNARR_NAMES: readonly string[] = [
  'Sævarfoli',
  'Bylgjuhestr',
  'Marfaxi',
  'Selreið',
  'Vágabrúðr',
  'Ýmisdóttir',
  'Straumkarl',
  'Hafgríma',
  'Norðrfari',
  'Kaldbaka',
  'Salthveli',
  'Vindkápa',
];

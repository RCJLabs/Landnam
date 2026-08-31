// The named blades, as data.
//
// A sword with a name is the one possession a saga-age Norseman is recorded
// as caring about after he is dead. Hákon's Kvernbítr, Grettir's
// Ættartangi, Kormák's Hvítingr — the sagas name them, say who gave them,
// and go on naming them through three or four owners. That is the whole of
// what this file is for: the game already had a memorial, a lineage and a
// succession, and nothing that PASSED between them.
//
// Attested where possible, and glossed rather than left as a noise of
// consonants — the saga log says the name and the meaning the first time a
// hand closes on it, and the name alone ever after.

export interface BladeName {
  name: string;
  /** What it means, said once when the blade is first named. */
  means: string;
}

/**
 * One per run, picked off the seed.
 *
 * A pool rather than a generator: eleven blades a player can come to
 * recognise across a wall of sixty dead beats an infinity of blades a player
 * sees once. The memorial is the whole reason — a name that never repeats
 * cannot be recognised on somebody else's row.
 */
export const BLADES: BladeName[] = [
  { name: 'Fótbítr', means: 'Leg-biter' },
  { name: 'Kvernbítr', means: 'Quern-biter' },
  { name: 'Skofnung', means: 'Shin-bone' },
  { name: 'Grásíða', means: 'Grey-flank' },
  { name: 'Hvítingr', means: 'the White One' },
  { name: 'Ættartangi', means: 'Kin-tang' },
  { name: 'Gramr', means: 'the Fierce' },
  { name: 'Naðr', means: 'Adder' },
  { name: 'Langhvass', means: 'Long-and-keen' },
  { name: 'Bláfeldr', means: 'Blue-cloak' },
  { name: 'Sáttmáli', means: 'the Settlement' },
];

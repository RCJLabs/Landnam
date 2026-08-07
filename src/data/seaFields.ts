// The authored sea battlefields.
//
// A fight on the water used to be the ocean's terrain mix — random blocks
// and pools that read as nothing. These are ships: two hulls lashed for
// boarding, bows locked with one way across, a scramble among the skerries
// at low water. The audit's fifth finding was that ships were a terrain
// skin; this is the half of the fix that gives a sea fight a SHAPE. The
// stakes — cargo over the side, a holed hull — live in sim/sea.ts.
//
// Pure data, linted like the raid fields: room for six a side to deploy,
// somewhere four can stand abreast, a crossable line between the decks.
//
// Legend — 9 rows of 7, simpler than the raid maps because the sea has no
// walls and no halls:
//   .  deck, sand, or footing
//   ,  rough going (thwarts, gear, gunwales to clamber, knee-deep water)
//   #  blocked (a mast, a cargo stack, a skerry)
//   ~  the sea itself
//
// Row 0 is their end; rows 0-1 their deployment, rows 7-8 ours.

export interface SeaFieldDef {
  id: string;
  /** Written into the battle log as the fight opens. Chronicle voice. */
  line: string;
  /** Nine rows of seven characters. */
  rows: string[];
}

export const SEA_FIELDS: SeaFieldDef[] = [
  {
    id: 'lashed-hulls',
    line: 'The hulls came together and the lashings went over the rails: one deck now, and no ground to give.',
    rows: [
      '~.....~',
      '~..#..~',
      '~.,...~',
      '~,,.,,~',
      '~.....~',
      '~..,..~',
      '~.#...~',
      '~.....~',
      '~.....~',
    ],
  },
  {
    id: 'the-boarding',
    line: 'Their bow rode up over ours and locked there, and the only way this ends is across it.',
    rows: [
      '~.....~',
      '~..#..~',
      '~~....~',
      '~~~,~~~',
      '~~,.~~~',
      '~.....~',
      '~.#...~',
      '~.....~',
      '~.....~',
    ],
  },
  {
    id: 'the-shallows',
    line: 'Both keels took the sand at once, and it was fought out in the shallows, knee-deep among the skerries.',
    rows: [
      '.......',
      '...,...',
      '~,.#.,~',
      '.,~.~,.',
      '..,.,..',
      '~.#.,.~',
      '.,...,.',
      '.......',
      '.......',
    ],
  },
];

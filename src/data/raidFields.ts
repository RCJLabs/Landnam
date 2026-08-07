// The authored raid battlefields.
//
// A raid is the one fight where the ground is yours: you cleared it, walled
// it, and stacked your winter in the middle of it. Rolling that ground from
// a terrain table made every defence blur into the last one. These are drawn
// by hand instead — a handful of approaches with character, picked by what
// the steading actually is, so the sea can only flank a steading that has
// water and raiders only come out of trees that exist.
//
// Pure data. The parser and picker live in sim/battlefield.ts; adding a
// field here never touches engine code, and test/raid.test.ts lints every
// map, walled and unwalled, against the promises the game has already made:
// room for fourteen raiders to deploy, room for six defenders behind the
// wall, exactly one gate, a way in that needs no climbing, and somewhere
// four can stand abreast.
//
// Legend — each map is 9 rows of 7:
//   .  open ground
//   ,  rough going (stubble, mud, a sunken lane)
//   #  blocked outright (trees, ricks, a midden, banked earth)
//   ~  water
//   =  the palisade line: a wall if one is built, open ground if not
//   G  the gate: always walkable, and where the wall parts if it stands
//   H  the hall: a block, the thing they came for
//
// Row 0 is the raiders' edge; rows 0-1 are their deployment. The wall line
// runs on row 5 (WALL_ROW), the defenders form up on rows 6-7, and the hall
// stands in the yard on row 8.

export interface RaidFieldDef {
  id: string;
  /** Written into the battle log as the raid opens. Chronicle voice. */
  line: string;
  /** Ground the steading must actually hold for this approach to exist. */
  needs?: 'water' | 'wood';
  /** Nine rows of seven characters. See the legend above. */
  rows: string[];
}

export const RAID_FIELDS: RaidFieldDef[] = [
  {
    id: 'open-approach',
    line: 'They came straight up the in-field, the way we walk it ourselves.',
    rows: [
      '.......',
      '.......',
      '..,.#..',
      '.,..,..',
      '#..,...',
      '==G====',
      '.......',
      '.......',
      '..,H...',
    ],
  },
  {
    id: 'the-strand-gate',
    line: 'They beached below us and came along the strand, between the wall and the water.',
    needs: 'water',
    rows: [
      '.......',
      '.......',
      '~~,....',
      '~,.....',
      '~~..,..',
      '~=G====',
      '~......',
      '.......',
      '...H,..',
    ],
  },
  {
    id: 'the-wood-shoulder',
    line: 'They came out of our own trees, where the wood shoulders the wall.',
    needs: 'wood',
    rows: [
      '.......',
      '.......',
      '...,##.',
      '....,##',
      '.,...#.',
      '===G==#',
      '......,',
      '.......',
      '..H....',
    ],
  },
  {
    id: 'the-hollow-way',
    line: 'They came up the hollow way, single file between the banks, because it is the only way there is.',
    rows: [
      '.......',
      '.......',
      '.#,#...',
      '.#,#,..',
      '.#,#...',
      '==G====',
      '.......',
      '.......',
      '...H...',
    ],
  },
  {
    id: 'the-ford',
    line: 'They took the stream at both fords, wet to the knee before a blow was struck.',
    needs: 'water',
    rows: [
      '.......',
      '.......',
      '.......',
      '~~,~~,~',
      '.......',
      '==G====',
      '.......',
      '.......',
      '..H....',
    ],
  },
  {
    id: 'the-burnt-fields',
    line: 'They came through the stubble with the ricks for cover, burning nothing yet.',
    rows: [
      '.......',
      '.......',
      ',,..,,.',
      '..#,...',
      ',..,.#,',
      '====G==',
      '.......',
      '..,....',
      '....H..',
    ],
  },
];

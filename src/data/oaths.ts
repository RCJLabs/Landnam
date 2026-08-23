// What a band swears at the blót, and what it costs to be foresworn.
//
// The Norse vocabulary was all over this game and none of it bound anything:
// the Thing was a roll, wergild was a price, and an oath was a word in a
// tie-table. An oath here is a CONSTRAINT the player takes on purpose — the
// only thing in the game that makes the band worse at something in exchange
// for what keeping it is worth.
//
// Pure data. sim/oath.ts holds it to what it says.

export type OathId = 'noSack' | 'holdFast';

export interface OathDef {
  id: OathId;
  /** The flag the blót card raises. Flags are the save's own vocabulary. */
  flag: string;
  /** What was sworn, for the saga. */
  sworn: string;
  /** Said when the year turns and it was kept. */
  kept: string;
  /** Said the moment it is broken. */
  broken: string;
}

export const OATHS: OathDef[] = [
  {
    id: 'noSack',
    flag: 'oath:noSack',
    sworn: 'We swore at the blót to take nothing by force until the year turned.',
    kept: 'The year turned and we had taken nothing by force. The oath was kept, and everyone knew it.',
    broken: 'We had sworn to take nothing by force, and we took it anyway. The oath was broken in front of everybody who heard it given.',
  },
  {
    id: 'holdFast',
    flag: 'oath:holdFast',
    sworn: 'We swore at the blót not to leave this hall before the year turned, whatever came.',
    kept: 'The year turned and the posts were still ours. We had said we would not leave, and we did not.',
    broken: 'We had sworn to hold this hall a year and we walked out of it. There is no way to say that which sounds well.',
  },
];

/** Where the day it was sworn is kept, and the count it is measured against. */
export const OATH_SINCE = 'oath:since';
export const OATH_MARK = 'oath:mark';
/** How many the band has broken. Nothing forgets this. */
export const OATH_FORESWORN = 'oath:foresworn';

/** Heart an oath carried to its term is worth. */
export const OATH_KEPT_HEART = 14;

/** Heart it costs to be foresworn. Heavier than keeping it is worth. */
export const OATH_BROKEN_HEART = 22;

/** What every neighbour on the coast thinks of an oath-breaker. */
export const OATH_BROKEN_STANDING = -12;

export function oathDef(id: OathId): OathDef {
  const found = OATHS.find((o) => o.id === id);
  if (!found) throw new Error(`no oath: ${id}`);
  return found;
}

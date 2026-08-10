// The Thing: the assembly where a man is either proclaimed jarl or is not.
//
// This is the run's goal, and it is deliberately a CHECKLIST rather than a
// timer. Everything on it is something the player already has a system for —
// winters from the calendar, a mead hall from the build queue, peace in the
// hall from 4.1, standing on the coast from 4.3, a feast from the store. The
// endgame asks for all of it at once, which is the only thing Phase 4 has not
// asked for yet.

/** Winters the band must have come through before anyone will hear it. */
export const WINTERS_TO_JARL = 2;

/** What feeding everyone who comes costs. */
export const FEAST_FOOD = 30;

/**
 * Standing a neighbour needs before they will speak for you at the Thing —
 * the 'friendly' band in `data/clans.ts`.
 *
 * Named rather than left as a bare 25 in `hasSpeakers` because it turned out
 * to be the wall in front of the whole endgame, and a number the harness bars
 * against should be a number with a name. Measured 2026-08-10 over 88 settled
 * sagas: every one of them met a neighbour, and the MEDIAN band's best
 * standing with anyone was 10.9 — the opening a native camp gives away for
 * nothing. Twenty-one of the 88 ever crossed this line.
 */
export const SPEAKER_STANDING = 25;

/** 2d6 plus what the band has made of itself, against this. */
export const THING_DC = 14;

/** What simply standing there and asking is worth. */
export const THING_BASE = 4;

/**
 * The most every good thing the band has done can add up to, together.
 *
 * Without a cap the merits stack — a speaker with spirit 6, a coast that
 * loves you, a full hall, high heart, rune-craft and a spare winter — into a
 * claim that cannot fail, and the climax of the whole run becomes a button
 * that says "you win". Capped, a band that has done everything is around
 * five in six, which is a reward rather than a formality.
 */
export const THING_MERIT_CAP = 5;

/**
 * And the most a coast that hates you can drag it back down by. Standing
 * bottoms out at -100, so this is exactly what a coast that hates you as much
 * as it is able to is worth.
 */
export const THING_ANGER_MAX = 2;

/** Days before a refused claim can be made again. */
export const THING_COOLDOWN = 12;

/** Past this many winters the run ends on its own: a life, if not a title. */
export const LONG_LIFE_WINTERS = 5;

export type NeedId = 'winters' | 'hall' | 'peace' | 'friends' | 'feast' | 'gathered';

export interface NeedDef {
  id: NeedId;
  label: string;
  /** Why it is asked for. Shown under the label when it is not met. */
  why: string;
}

export const NEEDS: NeedDef[] = [
  {
    id: 'winters',
    label: `${WINTERS_TO_JARL} winters stood`,
    why: 'Nobody is proclaimed anything for surviving one bad season.',
  },
  {
    id: 'hall',
    label: 'A mead hall to hold it in',
    why: 'A Thing is held somewhere. That is what the mead hall is for.',
  },
  {
    id: 'peace',
    label: 'No blood unanswered at home',
    why: 'A claim made over an open feud is a claim somebody will contest.',
  },
  {
    id: 'friends',
    label: 'Somebody on this coast to speak for us',
    why: 'A jarl of a coast that will not come to his Thing is a jarl of nothing.',
  },
  {
    id: 'feast',
    label: `${FEAST_FOOD} of food for the feast`,
    why: 'Everyone who comes is fed. That is not optional and never was.',
  },
  {
    id: 'gathered',
    label: 'The whole band at the steading',
    why: 'You cannot be acclaimed by people who are three days out.',
  },
];

// --- Voice ---

export const THING_OPENING =
  'They came in over three days — the near ones walking, the far ones by water — and by the third evening there were more people at the steading than had ever stood in it at once. The fires were lit and the case was put.';

export const PROCLAIMED: string[] = [
  'It was carried on the second day, and not narrowly. Weapons went up along the whole length of the hall, and the word they used was jarl.',
  'The old man from the far camp spoke last and spoke shortest, and after that there was nothing left to argue. They named {name} jarl of that coast before the fires were out.',
  'Nobody spoke against it in the end, which surprised everyone including {name}. The title stuck because the people who could have refused it did not.',
];

export const REFUSED: string[] = [
  'It was heard out and it was not carried. Nothing was said that could not be walked back from, and nothing was said that anybody forgot either.',
  'The case was put and the case was found wanting. They ate the feast and went home, and the matter was left where it lay.',
  'There were too many who would not raise a weapon to it, and a claim that half a hall will not carry is not a claim worth pressing.',
];

/** Blocked, and it is the checklist's job to say which. */
export const THING_BLOCKED = 'The Thing cannot be called yet.';

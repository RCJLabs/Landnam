// What people fall out over, and what a band does about it.
//
// Pure data. The sim in src/sim/minds.ts decides WHO and WHEN; this file says
// what it looked like and what can be done. `{A}` and `{B}` are replaced with
// the two names when the card is built.

export interface FeudCause {
  id: string;
  /** Past tense — this goes in the saga as well as on the card. */
  line: string;
  /** Weight when this cause is available. */
  weight: number;
  /** Only offered when the band is going hungry. */
  needsHunger?: boolean;
  /** Only offered when somebody has died. */
  needsDeath?: boolean;
}

export const FEUD_CAUSES: FeudCause[] = [
  {
    id: 'ration',
    line: '{A} said {B} had taken more than a share, and said it where everyone could hear.',
    weight: 12,
    needsHunger: true,
  },
  {
    id: 'blame',
    line: '{A} said out loud what everyone had been thinking about who was to blame.',
    weight: 14,
    needsDeath: true,
  },
  {
    id: 'work',
    line: '{A} would not be told what to do by {B}, and would not let it go.',
    weight: 11,
  },
  {
    id: 'insult',
    line: 'Something {B} said about {A} went round the fire twice before it got back to them.',
    weight: 10,
  },
  {
    id: 'oldwrong',
    line: '{A} and {B} had not spoken since a thing neither of them would explain.',
    weight: 8,
  },
];

/** What a settled feud is worth, and what it costs. */
export const WERGILD_FOOD = 10;

/** A grudge at or past this is a feud, and demands answering. */
export const FEUD_THRESHOLD = 10;

/** Above this, someone gets hurt. */
export const BLOOD_THRESHOLD = 18;

export const FEUD_TITLE = 'A Thing to Be Settled';

export const FEUD_BODY =
  'It has been coming for a while and now it is here, in front of everyone, ' +
  'and nobody is going back to work until it is dealt with one way or another.';

export interface FeudChoice {
  label: string;
  hint?: string;
  /** 'wergild' pays it off, 'thing' rolls for it, 'ignore' walks away. */
  kind: 'wergild' | 'thing' | 'ignore';
}

export const FEUD_CHOICES: FeudChoice[] = [
  {
    label: 'Pay the wergild out of the stores',
    hint: `${WERGILD_FOOD} food`,
    kind: 'wergild',
  },
  { label: 'Hold a Thing and let it be argued out', kind: 'thing' },
  { label: 'Tell them both to get back to work', kind: 'ignore' },
];

/** Difficulty of talking two angry people down. */
export const THING_DC = 12;

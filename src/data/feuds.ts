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
  /**
   * 'wergild' pays it off, 'thing' rolls for it, 'ignore' walks away, and
   * 'banish' drives one of them into the country for good.
   *
   * `banish` rather than `outlaw` because `outlaw` is also a FOE ARCHETYPE
   * id, and test/foes.test.ts forbids the engine naming one — a rule that
   * keeps combat content data-driven. This is a different namespace and the
   * bar cannot tell, so the name moves rather than the bar.
   */
  kind: 'wergild' | 'thing' | 'ignore' | 'banish';
}

/** Morale the whole band loses when one of its own is driven out. */
export const OUTLAW_MORALE = 12;

/** Days an outlaw keeps away before there is any chance of them coming back. */
export const OUTLAW_LIE_LOW = 30;

export const FEUD_CHOICES: FeudChoice[] = [
  {
    label: 'Pay the wergild out of the stores',
    hint: `${WERGILD_FOOD} food`,
    kind: 'wergild',
  },
  { label: 'Hold a Thing and let it be argued out', kind: 'thing' },
  { label: 'Tell them both to get back to work', kind: 'ignore' },
  {
    // The certain one, and the dearest. Wergild spends stores and the Thing
    // spends a roll; this spends a PERSON, which in a band of six is the
    // most expensive thing there is — and it does not end there, because a
    // man driven into the country is still in the country.
    //
    // LAST on purpose, not by taste. `settleFeud` takes an index and the
    // recorded runs in runs/*.json replay CHOOSE actions BY that index, so
    // inserting a choice in the middle silently rewrites what an old run
    // did — a run that told two men to get back to work would drive one of
    // them out instead. Appending cannot do that.
    label: 'Drive {A} out — let them be outlaw',
    hint: 'A hand, for good',
    kind: 'banish',
  },
];

/** Difficulty of talking two angry people down. */
export const THING_DC = 12;

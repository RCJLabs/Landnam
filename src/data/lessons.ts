// First-run guidance, written as cards rather than as a tutorial.
//
// The roadmap's line is "woven into events (no tutorial screens)", and the
// distinction that makes that real is this: a lesson is triggered by the game
// getting into a state where the thing matters, using the SAME condition
// vocabulary real events use — not by a step counter walking a new player
// through a script. You are told what firewood is on the evening the woodpile
// gets low, in the game's own voice, and never again.
//
// The hard rule, enforced in test/lessons.test.ts: a lesson changes NOTHING.
// It has no effects, it cannot fail, it never displaces a real event, and it
// is not stored in the save. A run played by someone being taught and the
// same run played by a veteran are byte-identical.

import type { Condition } from './events';

/**
 * Lesson triggers: every event condition, plus a few situations only the
 * teaching cares about. Kept as an extension rather than folded into
 * `Condition` because no real event wants to fire on "the player is looking
 * at the colony screen" — that is a fact about the viewer, not the world.
 */
export type LessonWhen =
  | Condition
  /** Steel is out. */
  | { c: 'inBattle' }
  /** Looking at the steading rather than the map. */
  | { c: 'inColony' }
  /** The ground underfoot would take the posts. */
  | { c: 'canSettle' }
  /** The winter mark is on screen, which means winter is close enough to plan for. */
  | { c: 'markVisible' }
  /** Somebody in the band has fallen out with somebody else. */
  | { c: 'grudge' }
  /** A party is out from the steading. */
  | { c: 'away' }
  /** The band has come far enough that the Thing is worth explaining. */
  | { c: 'couldClaim' };

export interface LessonDef {
  id: string;
  title: string;
  /** Two or three sentences. Chronicle voice, like everything else. */
  body: string;
  /** What the player should take away, in one line under the body. */
  point: string;
  when: LessonWhen[];
}

/**
 * Order is the teaching order: the first lesson whose conditions hold is the
 * one shown, so an early lesson never queue-jumps a later one it depends on.
 * A player who settles on day three is told about the posts before the wind.
 */
export const LESSONS: LessonDef[] = [
  {
    id: 'the-day',
    title: 'The First Day',
    body: 'Six of you came off the knarr with what you could carry, and the country in front of you is nobody\'s. Every hex you cross is a day of your life, and the days are what run out first.',
    point: 'Tap a marked hex to walk. Tap Act for everything else you can do with a day.',
    when: [{ c: 'dayMin', day: 2 }],
  },
  {
    id: 'the-store',
    title: 'The Store',
    body: 'The sacks came down faster than anyone had reckoned on. Six people eat whether the day went well or badly, and a night without a fire costs more than a day without food.',
    point: 'Forage, hunt and fish put food back. Camp gathers firewood. Both cost the day.',
    // Twelve, not the twenty-four the band lands with: at three a day for six
    // people that is four days of food left, which is when the store becomes
    // a problem to solve rather than a number to read. Set at the starting
    // figure it fired on the title screen, before a single day had passed —
    // which is the exact tutorial-screen failure this milestone is against.
    when: [{ c: 'foodMax', value: 12 }],
  },
  {
    id: 'the-ground',
    title: 'Ground Worth Holding',
    body: 'This is the kind of place a man could put posts in. The reading under the map is what the land is actually good for — and no two good things ever come together, so the choice is which lack you can live with.',
    point: 'Founding is one way and there is no second steading. Without fresh water it is refused outright.',
    when: [{ c: 'canSettle' }],
  },
  {
    id: 'the-mark',
    title: 'The Mark',
    body: 'The light is going earlier and the old hands have started counting sacks out loud. What the mark shows is not a rule of thumb — it walks every remaining day with your people on their jobs and tells you what the stores must reach.',
    point: 'Reach the mark before the dark. A band that ignores it usually does not see spring.',
    when: [{ c: 'markVisible' }],
  },
  {
    id: 'the-work',
    title: 'The Work',
    body: 'The posts are in, and from here the steading is where the band lives. Everyone gets a job or wastes the day, and the ground decides which jobs are worth anything: you cannot farm a crag or cut timber on a shore.',
    point: 'Give everyone work. Queue what you lack. Builders turn timber into what the winter cannot take.',
    when: [{ c: 'inColony' }],
  },
  {
    id: 'the-line',
    title: 'The Line',
    body: 'They came on faster than anyone could form up. A man alone with his shield is a man being flanked; two standing shoulder to shoulder are worth more than three scattered across the field.',
    point: 'Stand your people next to each other. The wall is worth more than any single blow.',
    when: [{ c: 'inBattle' }],
  },
  {
    id: 'the-road',
    title: 'The Road Out',
    body: 'They took provisions and went, and the steading closed up behind them. Whoever stayed works every day they are gone, and whoever went is the only part of the band the country can reach.',
    point: 'A hall whose warriors are three days out is the one worth raiding. Send what you can spare.',
    when: [{ c: 'away' }],
  },
  {
    id: 'the-quarrel',
    title: 'Bad Blood',
    body: 'It started over nothing, the way these things do, and by the second week nobody was pretending otherwise. Hunger and cold and bad work make quarrels; the quarrels do not go away because the weather improved.',
    point: 'Settle it, or it comes to knives. A quarrel the band refused to name hardens instead of fading.',
    when: [{ c: 'grudge' }],
  },
  {
    id: 'the-thing',
    title: 'The Thing',
    body: 'Two winters stood, and men on this coast have started saying the name of this place as if it were somewhere. A jarl is not a man who declares himself one — he is a man an assembly will carry.',
    point: 'Everything the Thing asks for is a system you already run. The checklist says which one is short.',
    when: [{ c: 'couldClaim' }],
  },
];

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function lessonById(id: string): LessonDef | undefined {
  return BY_ID.get(id);
}

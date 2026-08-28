// The shapes a saga is told in. Pure data: sim/sagagen.ts picks among these
// with the run's own seed and fills the tokens from what actually happened.
//
// Every line here is past tense and third-hand — the voice of somebody
// recounting a thing years later, who was not there. That is why nothing in
// this file says "you".
//
// Tokens are {braced} and substituted verbatim. A form that names a fact the
// run does not have must never be reachable; the composer decides which bank
// applies, and the banks are grouped so it cannot pick wrongly.

export interface TitleForms {
  /** Settled, and lived to the ice breaking. */
  stood: string[];
  /** Settled, and did not. */
  fell: string[];
  /** Never set a post. */
  wandering: string[];
  /** Nobody came back. */
  lost: string[];
  /** Proclaimed at the Thing. */
  jarl: string[];
}

export const TITLES: TitleForms = {
  stood: [
    'The Saga of {steading}',
    'The Saga of {steading}, Which Stood',
    'How {steading} Came to Be',
  ],
  fell: [
    'The Saga of {steading}, and How It Ended',
    'The Short Saga of {steading}',
    'What Became of {steading}',
  ],
  wandering: [
    'The Saga of the Landing at {landing}',
    'The Saga of the Band That Kept Walking',
    'What Happened After {landing}',
  ],
  jarl: [
    'The Saga of the Jarl of {steading}',
    'How {steading} Got Itself a Jarl',
    'The Saga of {steading}, and the Thing That Carried It',
  ],
  lost: [
    'The Saga of Those Who Did Not Come Back',
    'The Saga of {landing}, Told by Nobody',
    'What the Sea Carried Out',
  ],
};

// --- Chapter openings ---

export const LANDFALL: string[] = [
  '{leader} and {others} came ashore at {landing} out of a {weather} sea, and there was nobody there to say whose land it was.',
  'They put in at {landing} — {crew} of them, and one knarr — and the country in front of them had no name they knew.',
  'The keel touched sand at {landing}. {leader} stepped down first, which was afterwards remembered.',
  '{crew} came off the water at {landing} with what they could carry, and the ship was hauled up past the tide and left there.',
];

export const COUNTRY: string[] = [
  'They walked {stretches} stretches of country and saw {seen} of it, and most of what they saw was {ground}.',
  'The band went inland through {ground} and back again, and by the end had the shape of {seen} of the country in their heads.',
  'They crossed {stretches} stretches of ground before it was done, and it was {ground} that they came to know best.',
];

export const AT_SEA: string[] = [
  'They put the knarr back in the water more than once, and worked the coast under oars where the walking was worst.',
  'Some of that country they took by sea, hugging the shore with the land always on one hand.',
];

export const LANDTAKING: string[] = [
  'On day {day} they set the first post at {steading}, and {verdict}',
  'The posts went into the ground at {steading} on day {day}. {verdict}',
  'They stopped walking on day {day} and called the place {steading}. {verdict}',
];

export const RAISED: string[] = [
  'They raised {built} there.',
  'Before the year turned they had {built} standing.',
  'What they built was {built}, and it was enough or it was not.',
];

export const NEIGHBOURS_WARM: string[] = [
  'They came to terms with {friend}, and the terms held.',
  'There were oaths between them and {friend} by the end of it, and food went both ways.',
  '{friend} thought well enough of them to send things down the valley unasked.',
];

export const NEIGHBOURS_COLD: string[] = [
  'They fell on {enemy}, and {enemy} did not forget it.',
  'Whatever was between them and {enemy} was settled with steel, and settled badly.',
  'They took what {enemy} had, and paid for it every season after.',
];

export const TRADED: string[] = [
  'They dealt honestly with them {bargains}, and were the better for it.',
  'What they could not grow they bartered for, {bargains} in all.',
];

export const LEARNING: string[] = [
  'They worked out {lore}, which none of them had known coming off the ship.',
  'In among all of it they learned {lore}.',
  'What they took away that was not food or timber was {lore}.',
];

// {battles} and {raids} arrive as whole phrases — "once", "four times" — so
// a saga never says "1 times". Counting words is the composer's job.
export const BLOOD: string[] = [
  'It came to steel {battles}, and {felled} men went down in front of them.',
  'They were brought to a fight {battles}, and left {felled} of other men on the ground.',
  '{battles} it came to blows, and {felled} did not get up again.',
];

/** They fought, and killed nobody worth counting. */
export const BLOOD_BLOODLESS: string[] = [
  'It came to steel {battles}, and each time it was ended by somebody backing away rather than by anybody falling.',
  'They were brought to a fight {battles}, and came away with nothing anyone would boast of.',
];

export const HELD: string[] = [
  'Raiders came at the steading {raids}, and {held}.',
  '{raids} somebody came over the ridge for what they had, and {held}.',
];

/** Fills {held}. */
export const HELD_OUTCOME = {
  all: ['the line held every time', 'not once did they get past the yard'],
  some: ['the line held {held} of those', 'they were still holding the yard after {held} of them'],
  none: ['the line did not hold', 'each time they took what they came for'],
};

export const FEUD: string[] = [
  'It was not all outsiders: {a} and {b} had a thing between them that never quite went away.',
  'There was bad blood in the hall too, between {a} and {b}, and everybody knew about it.',
];

export const FALLEN_ONE: string[] = [
  '{name} was lost on day {day}, of {fate}.',
  'They buried {name} on day {day}. It was {fate} that did it.',
];

export const FALLEN_ALL: string[] = [
  'Not one of the {crew} who came ashore saw the end of it: {names}.',
  'All {crew} of them were left in that country — {names} — and nobody carried the account home.',
];

export const FALLEN_MANY: string[] = [
  'Of the {crew} who came ashore, {dead} did not see the end of it: {names}.',
  '{dead} of them were left in that country — {names} — and the rest went on without them.',
];

export const NONE_FELL: string[] = [
  'Not one of them was left in the ground there, which is worth saying on its own.',
  'They all came through it, which is rarer than the sagas make out.',
];

// --- Closings, by how it ended ---

export const CLOSINGS: Record<string, string[]> = {
  survived: [
    'The ice broke in the shallows and they were still there. The land had not taken them, not that year.',
    'They lived to see the ice go out. Whatever came after, it came after this.',
    'Spring found them alive and where they had put themselves, and that was the whole of the victory.',
  ],
  jarl: [
    'They called the Thing and the Thing carried it, and after that there was somebody on that coast who could be appealed to. Which is all a jarl has ever been.',
    'The weapons went up along the length of the hall, and the coast had a jarl. Nobody who had come off that knarr had expected to see it.',
    'It was carried, and the carrying of it was the end of the story anybody tells. What came after was administration.',
  ],
  starved: [
    'The stores ran out before the season turned, and hunger finished what the crossing had started.',
    'There was nothing left to eat and nothing left to say about it.',
  ],
  frozen: [
    'The fire went out one night and did not come back, and neither did they.',
    'The cold got into them and stayed, and the dark half of the year did the rest.',
  ],
  slain: [
    'They were killed where they stood, and the country kept what it took.',
    'It ended with steel, in a place that never got a name from them.',
  ],
  despair: [
    'In the end they stopped listening to each other, and after that there was no band to speak of.',
    'What broke was not their bodies. Some walked inland, some walked into the water, and none of it was a plan.',
  ],
};

export const FALLBACK_CLOSING =
  'What happened after that is not recorded, and the sea keeps no account of who it carries out.';

/** Weather at the landing, picked for flavour only. */
export const LANDING_WEATHER = ['grey', 'flat', 'hard', 'quiet', 'rolling'];

/** Fills {tokens} from a plain record. An absent token is left standing so a
 *  missing fact shows up loudly in a test rather than reading as prose. */
export function fill(form: string, tokens: Record<string, string | number>): string {
  return form.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in tokens ? String(tokens[name]) : whole,
  );
}

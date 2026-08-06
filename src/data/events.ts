// Travel events. Pure data — the engine in sim/events.ts interprets these,
// so adding an event never touches engine code.
//
// Card bodies are written in the moment; outcome text is past tense, because
// outcomes are what gets copied into the saga log.

import type { Season, Stats, Terrain } from '../state/types';

export type Condition =
  | { c: 'terrain'; any: Terrain[] }
  | { c: 'season'; any: Season[] }
  | { c: 'dayMin'; day: number }
  | { c: 'moraleMax'; value: number }
  | { c: 'flagUnset'; flag: string }
  | { c: 'nearWater' }
  /** The posts are in the ground somewhere. */
  | { c: 'settled' }
  /** Standing on your own hearth. */
  | { c: 'atHome' }
  /** The store is at or below this. Lets scarcity pull its own events. */
  | { c: 'foodMax'; value: number }
  | { c: 'firewoodMax'; value: number }
  /** Someone in the band is carrying an illness. */
  | { c: 'sick' };

export type Effect =
  | { t: 'food'; n: number }
  | { t: 'firewood'; n: number }
  | { t: 'morale'; n: number }
  | { t: 'wound'; n: number; count?: number }
  | { t: 'heal'; n: number }
  | { t: 'injure' }
  | { t: 'kill' }
  | { t: 'flag'; flag: string; n: number }
  | { t: 'reveal'; radius: number }
  /** Draws steel: the fight begins once the card is dismissed. */
  | { t: 'battle'; difficulty?: number }
  /** They came for the steading. Fought on your own ground, with it at stake. */
  | { t: 'raid'; difficulty?: number };

export interface Outcome {
  text: string;
  effects: Effect[];
}

export interface EventChoice {
  label: string;
  /** Absent means the choice always succeeds. */
  check?: { stat: keyof Stats; dc: number };
  success: Outcome;
  failure?: Outcome;
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  weight: number;
  once?: boolean;
  when?: Condition[];
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'driftwood',
    title: 'Driftwood',
    body: 'The tide has left a tangle of sea-stripped timber along the strand — grey, salt-hard, and dry enough to burn.',
    weight: 10,
    when: [{ c: 'terrain', any: ['shore'] }],
    choices: [
      {
        label: 'Haul what we can carry',
        success: { text: 'We hauled driftwood up past the tideline and stacked it to dry.', effects: [{ t: 'firewood', n: 5 }] },
      },
      { label: 'Leave it; we have far to walk', success: { text: 'We left the wood to the tide and walked on.', effects: [] } },
    ],
  },
  {
    id: 'deer-herd',
    title: 'A Herd in the Clearing',
    body: 'Red deer, a dozen of them, heads down in the long grass. They have not caught our scent yet. There will not be a better shot than this.',
    weight: 9,
    when: [{ c: 'terrain', any: ['forest', 'meadow', 'valley'] }],
    choices: [
      {
        label: 'Take the shot',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'The arrow went true. We ate well for the first time since landing.', effects: [{ t: 'food', n: 9 }, { t: 'morale', n: 6 }] },
        failure: { text: 'A twig went under someone\'s heel and the clearing emptied in a heartbeat.', effects: [{ t: 'morale', n: -3 }] },
      },
      {
        label: 'Drive them toward the rocks',
        check: { stat: 'might', dc: 13 },
        success: { text: 'We ran them onto broken ground and took two before the rest scattered.', effects: [{ t: 'food', n: 13 }, { t: 'morale', n: 4 }] },
        failure: { text: 'We ran ourselves ragged across half a valley and caught nothing but our own breath.', effects: [{ t: 'wound', n: 1, count: 2 }, { t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'standing-stones',
    title: 'Nine Stones',
    body: 'Nine stones stand in a ring, taller than a man, furred with lichen. Someone raised them. Whoever it was is not here now.',
    weight: 7,
    once: true,
    when: [{ c: 'terrain', any: ['meadow', 'hills', 'valley'] }],
    choices: [
      {
        label: 'Leave an offering',
        success: { text: 'We left bread on the flat stone and did not look back. The band walked easier for it.', effects: [{ t: 'food', n: -2 }, { t: 'morale', n: 8 }] },
      },
      {
        label: 'Climb the tallest and look about',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'From the top of the stone we could see the shape of the whole country.', effects: [{ t: 'reveal', radius: 5 }, { t: 'morale', n: 2 }] },
        failure: { text: 'The lichen was slick. We came down faster than we went up.', effects: [{ t: 'wound', n: 3 }] },
      },
      { label: 'Walk wide of them', success: { text: 'We gave the ring a wide berth. Some things are not ours.', effects: [] } },
    ],
  },
  {
    id: 'sleet',
    title: 'Sleet Off the Sea',
    body: 'The wind swings around and comes at us sideways, half water and half ice. There is no shelter in sight worth the name.',
    weight: 11,
    when: [{ c: 'season', any: ['autumn', 'winter', 'spring'] }],
    choices: [
      {
        label: 'Push through it',
        check: { stat: 'spirit', dc: 13 },
        success: { text: 'We put our heads down and kept walking. It passed by dusk.', effects: [{ t: 'morale', n: -2 }] },
        failure: { text: 'The sleet found every gap in our clothes. We were wet through for two days.', effects: [{ t: 'wound', n: 2, count: 3 }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Burn wood and wait it out',
        success: { text: 'We built the fire high and sat close around it until the sky cleared.', effects: [{ t: 'firewood', n: -3 }, { t: 'morale', n: 2 }] },
      },
    ],
  },
  {
    id: 'wolves',
    title: 'Wolves on the Ridge',
    body: 'They have been pacing us since midday, keeping to the high ground — six of them, unhurried, waiting to see whether we falter.',
    weight: 8,
    when: [{ c: 'terrain', any: ['forest', 'hills', 'mountains'] }, { c: 'dayMin', day: 4 }],
    choices: [
      {
        label: 'Form up and face them',
        check: { stat: 'might', dc: 12 },
        success: { text: 'We made a wall of ourselves and shouted them off the ridge. They wanted easier meat.', effects: [{ t: 'morale', n: 5 }] },
        failure: { text: 'They came in fast at the flank. We drove them off, but not before they had blood.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Give them meat and move on',
        success: { text: 'We threw down what meat we had and walked while they fought over it.', effects: [{ t: 'food', n: -4 }] },
      },
    ],
  },
  {
    id: 'bog-body',
    title: 'What the Bog Held',
    body: 'A hand stands out of the peat, brown as leather and perfectly whole. Around the wrist, a twist of gold wire.',
    weight: 9,
    when: [{ c: 'terrain', any: ['bog'] }],
    choices: [
      {
        label: 'Take the gold',
        check: { stat: 'spirit', dc: 13 },
        success: { text: 'We took the ring and covered the hand again. Nothing came of it, whatever the others said.', effects: [{ t: 'morale', n: -4 }, { t: 'flag', flag: 'tookBogGold', n: 1 }] },
        failure: { text: 'The peat gave way. One of us went in to the chest and came out grey and shaking.', effects: [{ t: 'wound', n: 5 }, { t: 'morale', n: -8 }] },
      },
      { label: 'Cover it over', success: { text: 'We pressed the peat back over the hand and said the words we could remember.', effects: [{ t: 'morale', n: 3 }] } },
    ],
  },
  {
    id: 'salmon-run',
    title: 'The River Boils',
    body: 'The shallows are thick with salmon running upstream, so many that the water looks like it is being rained on from below.',
    weight: 10,
    when: [{ c: 'nearWater' }, { c: 'season', any: ['summer', 'autumn'] }],
    choices: [
      {
        label: 'Weir the shallows',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'We stoned a weir across the narrows and took fish until our arms ached.', effects: [{ t: 'food', n: 12 }, { t: 'morale', n: 5 }] },
        failure: { text: 'The weir washed out twice and we gave it up with little to show.', effects: [{ t: 'food', n: 3 }] },
      },
      { label: 'Spear what we can and move on', success: { text: 'We speared what we could reach and carried it wet.', effects: [{ t: 'food', n: 5 }] } },
    ],
  },
  {
    id: 'burnt-steading',
    title: 'A Burnt Steading',
    body: 'A longhouse, or what is left of one. The turf roof has fallen in and the timbers are charred. The burning was not recent, and it was not an accident.',
    weight: 8,
    once: true,
    when: [{ c: 'terrain', any: ['meadow', 'valley', 'shore'] }, { c: 'dayMin', day: 6 }],
    choices: [
      {
        label: 'Search the wreck',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'Under a fallen beam we found a grain pit the fire had missed.', effects: [{ t: 'food', n: 8 }, { t: 'firewood', n: 3 }] },
        failure: { text: 'We turned over black timber for half a day and found only black timber.', effects: [{ t: 'morale', n: -3 }] },
      },
      {
        label: 'Take the standing timber',
        success: { text: 'We pulled down what would still burn and carried it out.', effects: [{ t: 'firewood', n: 6 }, { t: 'morale', n: -2 }] },
      },
      { label: 'Leave it be — someone did this', success: { text: 'We left the steading to its ghosts, and kept a better watch after.', effects: [{ t: 'flag', flag: 'wary', n: 1 }, { t: 'morale', n: -1 }] } },
    ],
  },
  {
    id: 'strangers-smoke',
    title: 'Smoke to the North',
    body: 'A thread of smoke, too straight and too steady to be anything but a hearth. Someone else is wintering on this coast.',
    weight: 7,
    once: true,
    when: [{ c: 'dayMin', day: 10 }],
    choices: [
      {
        label: 'Go and speak with them',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'They were few and as frightened as we were. We traded words, and they gave us grain to be rid of us.', effects: [{ t: 'food', n: 7 }, { t: 'morale', n: 5 }] },
        failure: { text: 'They would not open the door, and something was nocked to a string behind it. We withdrew.', effects: [{ t: 'morale', n: -4 }, { t: 'flag', flag: 'wary', n: 1 }] },
      },
      { label: 'Mark it and stay clear', success: { text: 'We noted where the smoke rose and went nowhere near it.', effects: [{ t: 'flag', flag: 'wary', n: 1 }] } },
    ],
  },
  {
    id: 'scouts',
    title: 'Watchers at the Treeline',
    body: 'Two men at the edge of the wood, armed, making no attempt to hide. They watch us pass, and then they are not there.',
    weight: 7,
    when: [{ c: 'dayMin', day: 12 }, { c: 'terrain', any: ['forest', 'hills', 'meadow', 'valley'] }],
    choices: [
      {
        label: 'Hail them',
        check: { stat: 'spirit', dc: 13 },
        success: { text: 'They came out and spoke. We learned the shape of the land, and whose it was.', effects: [{ t: 'reveal', radius: 4 }, { t: 'morale', n: 3 }] },
        failure: { text: 'They melted into the trees without a word. We slept badly.', effects: [{ t: 'morale', n: -5 }, { t: 'flag', flag: 'wary', n: 1 }] },
      },
      {
        label: 'Take them before they carry word',
        success: { text: 'We went into the trees after them, and they did not run far.', effects: [{ t: 'battle', difficulty: -1 }] },
      },
      { label: 'Keep walking, weapons loose', success: { text: 'We walked on with our hands near our axes and nothing came of it.', effects: [{ t: 'flag', flag: 'wary', n: 1 }] } },
    ],
  },
  {
    id: 'landing-party',
    title: 'Another Keel on the Sand',
    body: 'A ship drawn up where ours should be, and men around a fire who stand when they see us. They have the same look we do: too far from home, and not going back empty.',
    weight: 9,
    when: [{ c: 'dayMin', day: 7 }, { c: 'terrain', any: ['shore', 'meadow', 'valley'] }],
    choices: [
      {
        label: 'Go at them',
        success: { text: 'No words were wasted. We went down the sand at them.', effects: [{ t: 'battle', difficulty: 1 }] },
      },
      {
        label: 'Try to treat with them',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'Their leader heard us out. We parted with the coast divided between us, after a fashion.', effects: [{ t: 'morale', n: 5 }, { t: 'flag', flag: 'wary', n: 1 }] },
        failure: { text: 'Someone reached for an axe, and after that there was nothing to say.', effects: [{ t: 'battle', difficulty: 1 }] },
      },
      {
        label: 'Withdraw before they count us',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'We went back the way we came, quietly, and they never followed.', effects: [{ t: 'morale', n: -3 }] },
        failure: { text: 'They saw us go, and they were faster than we were.', effects: [{ t: 'battle', difficulty: 0 }] },
      },
    ],
  },
  {
    id: 'wolves-press',
    title: 'The Pack Comes In',
    body: 'The wolves that shadowed us have stopped shadowing. They are between us and the open ground, and they are not pacing any more.',
    weight: 7,
    when: [{ c: 'dayMin', day: 14 }, { c: 'terrain', any: ['forest', 'hills', 'bog'] }],
    choices: [
      {
        label: 'Set our backs together and meet them',
        success: { text: 'We put our backs together and let them come.', effects: [{ t: 'battle', difficulty: -1 }] },
      },
      {
        label: 'Fire and noise',
        check: { stat: 'craft', dc: 12 },
        success: { text: 'Burning brands and shouting. They went, grudging every step.', effects: [{ t: 'firewood', n: -2 }, { t: 'morale', n: 2 }] },
        failure: { text: 'The brands guttered in the wet and the pack came on anyway.', effects: [{ t: 'firewood', n: -2 }, { t: 'battle', difficulty: 0 }] },
      },
    ],
  },
  {
    id: 'ravens',
    title: 'Two Ravens',
    body: 'They come down and sit on the same dead branch, and neither of them makes a sound. Everyone has stopped walking.',
    weight: 6,
    when: [{ c: 'dayMin', day: 8 }],
    choices: [
      { label: 'Call it a good omen', success: { text: 'We said aloud that it was a good sign, and it became one.', effects: [{ t: 'morale', n: 6 }] } },
      { label: 'Say nothing at all', success: { text: 'Nobody said what everyone was thinking. The ravens left before we did.', effects: [{ t: 'morale', n: -2 }] } },
    ],
  },
  {
    id: 'fever',
    title: 'A Fever in the Camp',
    body: 'One of the band woke shaking and could not get warm. By evening they could not stand.',
    weight: 8,
    when: [{ c: 'dayMin', day: 9 }],
    choices: [
      {
        label: 'Halt and tend them',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'We lost two days to it, but the fever broke and they walked out on their own feet.', effects: [{ t: 'heal', n: 3 }, { t: 'food', n: -3 }] },
        failure: { text: 'Nothing we knew to do made any difference. It ran its course and left them hollowed out.', effects: [{ t: 'injure' }, { t: 'morale', n: -5 }] },
      },
      {
        label: 'Carry them and keep moving',
        check: { stat: 'might', dc: 12 },
        success: { text: 'We took turns carrying them and did not stop. They mended on the move.', effects: [{ t: 'morale', n: -2 }] },
        failure: { text: 'Carrying them cost us more than the days would have. Two more went down with it.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'morale', n: -6 }] },
      },
    ],
  },
  {
    id: 'cave',
    title: 'A Dry Cave',
    body: 'A cleft in the rock, deeper than it looks, with a floor of dry sand and an old ring of fire-blackened stones.',
    weight: 9,
    when: [{ c: 'terrain', any: ['hills', 'mountains'] }],
    choices: [
      {
        label: 'Shelter here for the night',
        success: { text: 'We slept dry and out of the wind, which we had not done in some time.', effects: [{ t: 'heal', n: 2 }, { t: 'morale', n: 6 }, { t: 'firewood', n: -1 }] },
      },
      {
        label: 'Search the back of it',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'Someone had cached food here against a hard season, and never come back for it.', effects: [{ t: 'food', n: 7 }, { t: 'morale', n: 3 }] },
        failure: { text: 'The passage narrowed to nothing. We came out scraped and no richer.', effects: [{ t: 'wound', n: 2 }] },
      },
    ],
  },
  {
    id: 'quarrel',
    title: 'Words at the Fire',
    body: 'It starts over a share of food and it is not about the food. Two of them are on their feet, and the rest are choosing sides.',
    weight: 14,
    when: [{ c: 'moraleMax', value: 40 }],
    choices: [
      {
        label: 'Put a stop to it',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'It was settled with words, which surprised everyone, including the two of them.', effects: [{ t: 'morale', n: 12 }] },
        failure: { text: 'It was settled with hands. Both of them carried it afterward, and so did the band.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Let them have it out',
        success: { text: 'We let them swing until they were tired. Afterward the camp was quieter, one way or another.', effects: [{ t: 'wound', n: 2, count: 2 }, { t: 'morale', n: 4 }] },
      },
    ],
  },
  {
    id: 'whale-strand',
    title: 'A Whale on the Sand',
    body: 'It stranded on the falling tide and it is beyond saving. There is more meat here than the band could eat in a season.',
    weight: 6,
    once: true,
    when: [{ c: 'terrain', any: ['shore'] }, { c: 'dayMin', day: 5 }],
    choices: [
      {
        label: 'Cut and carry all we can',
        check: { stat: 'might', dc: 11 },
        success: { text: 'We worked it for two days and carried away more than we thought we could.', effects: [{ t: 'food', n: 20 }, { t: 'morale', n: 10 }] },
        failure: { text: 'We worked until the tide turned and lost most of it to the water and the birds.', effects: [{ t: 'food', n: 7 }, { t: 'morale', n: 2 }] },
      },
      { label: 'Take a little and go', success: { text: 'We took what we could carry easily and left the rest to the gulls.', effects: [{ t: 'food', n: 6 }] } },
    ],
  },
  {
    id: 'hard-frost',
    title: 'The Frost Comes Early',
    body: 'The ground rings underfoot and the last of the standing water has gone hard. It is too early for this.',
    weight: 12,
    when: [{ c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Build the fire high and hold',
        success: { text: 'We burned more than we could spare, and lived through the night for it.', effects: [{ t: 'firewood', n: -4 }, { t: 'morale', n: 2 }] },
      },
      {
        label: 'Keep moving to stay warm',
        check: { stat: 'spirit', dc: 14 },
        success: { text: 'We walked through the worst of it and were warmer for walking.', effects: [{ t: 'morale', n: -1 }] },
        failure: { text: 'The cold got into all of us. One went down and did not get up quickly.', effects: [{ t: 'wound', n: 4, count: 3 }, { t: 'morale', n: -7 }] },
      },
    ],
  },
  {
    id: 'the-long-dark',
    title: 'The Long Dark',
    body: 'The sun clears the ridge for an hour and is gone again. Nobody has seen a clear day in a fortnight, and the talk in the hall has gone quiet and strange.',
    weight: 14,
    when: [{ c: 'season', any: ['winter'] }, { c: 'settled' }],
    choices: [
      {
        label: 'Keep everyone to a routine',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'We set hours and kept them, dark or not. It held the shape of the days together.', effects: [{ t: 'morale', n: 6 }] },
        failure: { text: 'The hours slipped. People slept when they liked and stopped speaking at meals.', effects: [{ t: 'morale', n: -7 }] },
      },
      {
        label: 'Burn wood and tell stories',
        success: { text: 'We built the fire past what it needed and talked until it burned low. Worth it.', effects: [{ t: 'firewood', n: -4 }, { t: 'morale', n: 9 }] },
      },
    ],
  },
  {
    id: 'lung-sickness',
    title: 'It Goes Through the Hall',
    body: 'It starts as one cough in the night and by the third day half the hall has it. The smoke does not help. Nothing helps.',
    weight: 15,
    when: [{ c: 'season', any: ['winter'] }, { c: 'settled' }, { c: 'sick' }],
    choices: [
      {
        label: 'Nurse them and burn wood to keep the hall warm',
        success: { text: 'We kept the fire high and sat with them in turns. Most of it passed.', effects: [{ t: 'firewood', n: -6 }, { t: 'heal', n: 4 }, { t: 'morale', n: 2 }] },
      },
      {
        label: 'Brew what the old ones brewed',
        check: { stat: 'craft', dc: 13 },
        success: { text: 'Bitter, and it worked. They were sitting up in two days.', effects: [{ t: 'heal', n: 6 }, { t: 'morale', n: 4 }] },
        failure: { text: 'Whatever it was, it did nothing but make them sicker for a night.', effects: [{ t: 'wound', n: 3, count: 3 }, { t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'empty-store',
    title: 'The Bottom of the Store',
    body: 'Someone comes back from the store with an honest face and says what everyone already knew. There is less in there than there should be, and it is a long way to spring.',
    weight: 16,
    when: [{ c: 'season', any: ['winter'] }, { c: 'settled' }, { c: 'foodMax', value: 14 }],
    choices: [
      {
        label: 'Cut the ration and say so plainly',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'Half rations, announced to everyone at once. Nobody liked it. Nobody argued.', effects: [{ t: 'food', n: 4 }, { t: 'morale', n: -4 }] },
        failure: { text: 'The cut was announced badly and taken worse. Two of them stopped speaking to the rest.', effects: [{ t: 'food', n: 3 }, { t: 'morale', n: -10 }] },
      },
      {
        label: 'Go out onto the ice after seals',
        check: { stat: 'wits', dc: 14 },
        success: { text: 'Three days on the ice, and we came back dragging enough to matter.', effects: [{ t: 'food', n: 14 }, { t: 'morale', n: 6 }] },
        failure: { text: 'Three days on the ice for nothing, and one of us went through it to the waist.', effects: [{ t: 'wound', n: 5 }, { t: 'morale', n: -6 }] },
      },
    ],
  },
  {
    id: 'wood-runs-low',
    title: 'Counting the Stack',
    body: 'The woodpile has a shape to it now that everyone can read at a glance, and the shape is wrong for the time of year.',
    weight: 15,
    when: [{ c: 'season', any: ['winter'] }, { c: 'settled' }, { c: 'firewoodMax', value: 12 }],
    choices: [
      {
        label: 'Go out and cut in the snow',
        check: { stat: 'might', dc: 13 },
        success: { text: 'Frozen wood and frozen hands, but we came back with a load.', effects: [{ t: 'firewood', n: 12 }, { t: 'wound', n: 2, count: 2 }] },
        failure: { text: 'We got nothing worth the walk and one of us cannot feel two fingers.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -5 }] },
      },
      {
        label: 'Burn what the steading can spare',
        success: { text: 'A bench, a spare rafter, the frame of something we would want later. It burned.', effects: [{ t: 'firewood', n: 8 }, { t: 'morale', n: -5 }] },
      },
    ],
  },
  {
    id: 'midwinter',
    title: 'Midwinter',
    body: 'The shortest day. From here the light comes back, a little at a time, whatever the cold does. Someone says it out loud and it lands harder than expected.',
    weight: 10,
    once: true,
    when: [{ c: 'season', any: ['winter'] }, { c: 'dayMin', day: 58 }],
    choices: [
      {
        label: 'Keep the feast, whatever it costs',
        success: { text: 'We ate what should have been three days of food in one night, and every one of us needed it.', effects: [{ t: 'food', n: -6 }, { t: 'morale', n: 16 }] },
      },
      {
        label: 'Mark it and eat as usual',
        success: { text: 'A word said over the fire and nothing more. It was still something.', effects: [{ t: 'morale', n: 4 }] },
      },
    ],
  },
  {
    id: 'smoke-on-the-ridge',
    title: 'Smoke on the Ridge',
    body: 'A thread of smoke where no smoke should be, and it has moved since morning. Somebody is camped within a day of us and taking no trouble to hide it.',
    weight: 13,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 12 }],
    choices: [
      {
        label: 'Go out and meet them before they come to us',
        check: { stat: 'wits', dc: 13 },
        success: { text: 'We found them at their fire and settled it away from the hall.', effects: [{ t: 'battle', difficulty: 0 }] },
        failure: { text: 'We walked half a day and found a cold fire. They had already gone past us.', effects: [{ t: 'raid', difficulty: 1 }] },
      },
      {
        label: 'Stand the watch and let them come',
        success: { text: 'We doubled the watch and waited. They came on the third night.', effects: [{ t: 'raid' }] },
      },
    ],
  },
  {
    id: 'they-came-at-dawn',
    title: 'They Came at Dawn',
    body: 'No warning worth the name. The dogs went off and then there were men in the yard, and after that there was no time to decide anything.',
    weight: 12,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 20 }],
    choices: [
      {
        label: 'Form up in front of the hall',
        success: { text: 'Whatever we had, we put between them and the door.', effects: [{ t: 'raid' }] },
      },
    ],
  },
  {
    id: 'a-price-asked',
    title: 'A Price Is Asked',
    body: 'Six of them at the edge of the field, weapons grounded, and one walks forward to say what it would cost to make them go away.',
    weight: 11,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 16 }],
    choices: [
      {
        label: 'Pay them and be rid of it',
        success: { text: 'We counted it out in front of everyone. They took it and went, and nobody looked at anybody.', effects: [{ t: 'food', n: -12 }, { t: 'morale', n: -8 }] },
      },
      {
        label: 'Tell them what they can have',
        success: { text: 'The answer was short. They were back inside the hour.', effects: [{ t: 'raid', difficulty: -1 }, { t: 'morale', n: 4 }] },
      },
    ],
  },
];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
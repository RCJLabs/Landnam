// Travel events. Pure data — the engine in sim/events.ts interprets these,
// so adding an event never touches engine code.
//
// Card bodies are written in the moment; outcome text is past tense, because
// outcomes are what gets copied into the saga log.

import type { Season, Stats, Terrain } from '../state/types';
import type { LoreId } from './lore';
import type { BuildingId } from './buildings';

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
  | { c: 'sick' }
  /** The angriest neighbour is at least this far below nothing. */
  | { c: 'anger'; min: number }
  /** The friendliest neighbour thinks at least this well of us. */
  | { c: 'goodwill'; min: number }
  /** The band has NOT worked this out yet. How a discovery stops repeating. */
  | { c: 'unknown'; lore: LoreId }
  /** The band already knows this. Lets one discovery lead to another. */
  | { c: 'known'; lore: LoreId }
  /** This building is standing at the steading. */
  | { c: 'built'; building: BuildingId };

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
  | { t: 'raid'; difficulty?: number }
  /** Moves what one neighbour thinks of you. Cards say which one they mean. */
  | { t: 'standing'; n: number; who: 'angriest' | 'friendliest' }
  /** The band works something out. See data/lore.ts. */
  | { t: 'learn'; lore: LoreId }
  /**
   * Somebody throws their lot in with the band, as a hand. Turned away with
   * nothing said if there is no bed for them, which is what makes a búð worth
   * building. See sim/joining.ts.
   */
  | { t: 'join'; n?: number; why: string };

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

  // --- The neighbours ---

  {
    id: 'tribute-asked',
    title: 'A Man Comes to the Gate',
    body: 'One man, no weapon showing, and a message he has clearly said before. His people are owed something for the ground we are standing on, and he would like it in food.',
    weight: 14,
    when: [{ c: 'settled' }, { c: 'anger', min: 15 }, { c: 'dayMin', day: 14 }],
    choices: [
      {
        label: 'Count it out and let him carry it back',
        success: {
          text: 'We counted it into his sack ourselves so there could be no argument later. He went back the way he came, and said we would not be troubled.',
          effects: [{ t: 'food', n: -14 }, { t: 'standing', n: 22, who: 'angriest' }, { t: 'morale', n: -4 }],
        },
      },
      {
        label: 'Send him back with nothing',
        success: {
          text: 'He listened to the whole of it without changing his face, which was worse than shouting would have been.',
          effects: [{ t: 'standing', n: -18, who: 'angriest' }, { t: 'morale', n: 3 }],
        },
      },
      {
        label: 'Ask what it would take to end it properly',
        check: { stat: 'wits', dc: 12 },
        success: {
          text: 'We talked until dark and found a price that was not only food. Whatever had been building went out of it.',
          effects: [{ t: 'food', n: -8 }, { t: 'standing', n: 30, who: 'angriest' }],
        },
        failure: {
          text: 'We talked past each other for an afternoon. He left thinking he had been laughed at.',
          effects: [{ t: 'standing', n: -10, who: 'angriest' }],
        },
      },
    ],
  },
  {
    id: 'they-remember',
    title: 'They Remember',
    body: 'Tracks in the frost on the ridge, a dozen sets, walking a slow line across everything we can see from the door. Nobody is hiding this. It is being shown to us.',
    weight: 22,
    // Only a band that has made enemies can draw this. A coast you have not
    // wronged does not send people to walk your skyline.
    when: [{ c: 'settled' }, { c: 'anger', min: 35 }, { c: 'dayMin', day: 14 }],
    choices: [
      {
        label: 'Bring everyone inside and wait',
        success: { text: 'We brought the beasts in and barred what could be barred. They came the next night.', effects: [{ t: 'raid' }] },
      },
      {
        label: 'Go up the ridge and be seen doing it',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'We stood on the ridge until they had had a long look at us. They came anyway, but they came carefully.', effects: [{ t: 'raid', difficulty: -1 }, { t: 'morale', n: 3 }] },
        failure: { text: 'We were still climbing when the smoke went up behind us.', effects: [{ t: 'raid', difficulty: 1 }] },
      },
    ],
  },
  {
    id: 'a-basket-at-the-door',
    title: 'A Basket at the Door',
    body: 'Nobody saw it left. Dried fish, a coil of good rope, and a stone with a mark cut into it that none of us can read but all of us understand.',
    weight: 12,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 25 }],
    choices: [
      {
        label: 'Take it in and be grateful',
        success: {
          text: 'We ate the fish and kept the stone on the sill. It was not much and it was not nothing.',
          effects: [{ t: 'food', n: 8 }, { t: 'morale', n: 4 }],
        },
      },
      {
        label: 'Send something better back',
        success: {
          text: 'We walked out a wool cloak and left it where the basket had been. Twice more that season, things arrived.',
          effects: [{ t: 'food', n: 8 }, { t: 'firewood', n: -6 }, { t: 'standing', n: 16, who: 'friendliest' }],
        },
      },
    ],
  },
  {
    id: 'word-from-the-camp',
    title: 'Word from the Camp',
    body: 'Two of them at the field edge, waiting to be noticed rather than walking in. They have come a long way to tell us something, and they are not in a hurry to say it.',
    weight: 10,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 40 }, { c: 'dayMin', day: 20 }],
    choices: [
      {
        label: 'Sit them down and hear it out',
        success: {
          text: 'They told us where the ice would go out first and which of the bays was worth walking to. We wrote none of it down and forgot none of it.',
          effects: [{ t: 'reveal', radius: 4 }, { t: 'standing', n: 10, who: 'friendliest' }, { t: 'morale', n: 5 }],
        },
      },
      {
        label: 'Hear it standing, and get back to the work',
        success: {
          text: 'We took the news at the field edge and went back to the barley. They noticed that we had.',
          effects: [{ t: 'reveal', radius: 2 }, { t: 'standing', n: -6, who: 'friendliest' }],
        },
      },
    ],
  },

  // --- Discoveries (4.4) ---
  //
  // Every one of these is gated on `unknown`, so it stops appearing the moment
  // the band has the thing. That is the whole of the "not a tech tree" rule:
  // knowledge arrives because you were somewhere, not because you chose it off
  // a list. A failed check is not a dead end — the card can come round again.

  {
    id: 'carved-boulder',
    title: 'Marks on the Boulder',
    body: 'A boulder the size of a byre, and one flat face of it covered in cut lines — angular, deliberate, weathered but not worn away. Somebody wanted this remembered.',
    weight: 16,
    when: [
      { c: 'unknown', lore: 'runes' },
      { c: 'terrain', any: ['hills', 'mountains', 'meadow', 'valley'] },
      { c: 'dayMin', day: 5 },
    ],
    choices: [
      {
        label: 'Sit with it until the marks make sense',
        check: { stat: 'wits', dc: 12 },
        success: {
          text: 'By the second day we had it: not a picture but a voice, the same few marks over and over for the same few sounds. We cut our own names into the back of it before we left.',
          effects: [{ t: 'learn', lore: 'runes' }, { t: 'morale', n: 5 }],
        },
        failure: {
          text: 'We stared at it until the light went and came away with nothing but a copy of it scratched on bark.',
          effects: [{ t: 'morale', n: -2 }],
        },
      },
      {
        label: 'Copy what we can and walk on',
        success: {
          text: 'We took a rubbing in charcoal and left the stone to whoever it belonged to.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'red-stone',
    title: 'Red Stone in the Bank',
    body: 'Where the stream has cut the bank there is a seam of it — heavy, rust-coloured, and nothing like the rock around it. One of the older hands turns a lump of it over and does not put it down.',
    weight: 16,
    when: [
      { c: 'unknown', lore: 'smithing' },
      { c: 'terrain', any: ['bog', 'hills', 'mountains'] },
      { c: 'dayMin', day: 8 },
    ],
    choices: [
      {
        label: 'Build a bank of charcoal and try it',
        check: { stat: 'craft', dc: 13 },
        success: {
          text: 'Three days of it, and most of that spent failing. What came out of the fourth burn was a bloom the size of a fist, and what came off the anvil after that held an edge.',
          effects: [{ t: 'learn', lore: 'smithing' }, { t: 'firewood', n: -6 }],
        },
        failure: {
          text: 'We burned a week of firewood and got slag and blisters. Somebody said we had not got the colour right, which nobody could argue with.',
          effects: [{ t: 'firewood', n: -5 }, { t: 'morale', n: -3 }],
        },
      },
      {
        label: 'Note where it is and get on',
        success: {
          text: 'We marked the bend in the stream and left it in the ground. It was not going anywhere.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'the-old-sky',
    title: 'The Sky Before a Hard Night',
    body: 'Clear as glass at dusk, and cold in a way that has intent behind it. The oldest of us looks up for a long while and says we should bank the fire differently tonight.',
    weight: 15,
    when: [
      { c: 'unknown', lore: 'skywatch' },
      { c: 'season', any: ['autumn', 'winter'] },
      { c: 'dayMin', day: 24 },
    ],
    choices: [
      {
        label: 'Do it their way and watch how',
        check: { stat: 'spirit', dc: 11 },
        success: {
          text: 'Turf over the embers, a stone at the windward side, and a hollow left for the air. There were coals in the morning. There had not been, any morning before.',
          effects: [{ t: 'learn', lore: 'skywatch' }],
        },
        failure: {
          text: 'We smothered it entirely and woke to cold ash and a lecture.',
          effects: [{ t: 'firewood', n: -2 }, { t: 'morale', n: -2 }],
        },
      },
      {
        label: 'Build it high and sit up with it',
        success: {
          text: 'We burned through the night and were warm the whole of it, which was one way of solving the problem.',
          effects: [{ t: 'firewood', n: -4 }, { t: 'morale', n: 3 }],
        },
      },
    ],
  },
  {
    id: 'the-yarrow',
    title: 'Yarrow and Birch Bark',
    body: 'The sick one is no better and the arguments about what to do have started. Somebody remembers what their mother used, and somebody else remembers it differently.',
    weight: 18,
    when: [{ c: 'unknown', lore: 'leechcraft' }, { c: 'sick' }],
    choices: [
      {
        label: 'Try it, and keep account of what works',
        check: { stat: 'craft', dc: 12 },
        success: {
          text: 'Yarrow on the wound, birch bark boiled down for the fever, and the sick one kept warm and left alone. By the third day there was no arguing with the result.',
          effects: [{ t: 'learn', lore: 'leechcraft' }, { t: 'heal', n: 3 }],
        },
        failure: {
          text: 'We tried everything anybody could remember, all at once, and learned nothing from any of it.',
          effects: [{ t: 'morale', n: -3 }],
        },
      },
      {
        label: 'Keep them warm and let it run its course',
        success: {
          text: 'We wrapped them up, kept the fire in, and waited. It was not nothing.',
          effects: [{ t: 'heal', n: 2 }],
        },
      },
    ],
  },
  {
    id: 'the-herb-woman',
    title: 'She Brings Her Own Bag',
    body: 'One of them walks up from the camp with a satchel and no escort, points at the worst of our sick, and starts unpacking on the floor of the hall without asking anybody.',
    weight: 14,
    when: [
      { c: 'unknown', lore: 'leechcraft' },
      { c: 'goodwill', min: 30 },
      { c: 'settled' },
    ],
    choices: [
      {
        label: 'Stand out of her way and watch her hands',
        success: {
          text: 'She worked for two days and explained nothing, and we learned the whole of it anyway by watching. Whatever we owe them, it went up.',
          effects: [{ t: 'learn', lore: 'leechcraft' }, { t: 'heal', n: 4 }, { t: 'standing', n: 8, who: 'friendliest' }],
        },
      },
      {
        label: 'Thank her and see her out',
        success: {
          text: 'We took the herbs and sent her home with bread, which was polite and cost us the rest of it.',
          effects: [{ t: 'heal', n: 2 }, { t: 'standing', n: -4, who: 'friendliest' }],
        },
      },
    ],
  },
  {
    id: 'where-she-takes-water',
    title: 'Where She Takes Water',
    body: 'The knarr is making more water than she should and nobody can agree where from. Somebody proposes hauling her out and going over the whole hull plank by plank.',
    weight: 15,
    when: [
      { c: 'unknown', lore: 'shipwright' },
      { c: 'nearWater' },
      { c: 'dayMin', day: 10 },
    ],
    choices: [
      {
        label: 'Haul her out and go over every plank',
        check: { stat: 'craft', dc: 12 },
        success: {
          text: 'A day lost and a strake sprung near the stem, which nobody would have found from inside her. We learned more about how a hull is meant to sit than we had in a season of sailing one.',
          effects: [{ t: 'learn', lore: 'shipwright' }, { t: 'morale', n: 3 }],
        },
        failure: {
          text: 'We had her up on rollers all day, found nothing, and put her back in wetter than she came out.',
          effects: [{ t: 'morale', n: -3 }],
        },
      },
      {
        label: 'Bail her and get on with it',
        success: {
          text: 'We set somebody to bailing and said no more about it.',
          effects: [],
        },
      },
    ],
  },
  // --- 6.2: the ways in ---
  //
  // Three, and every one of them hangs off a system that already exists: a
  // coast that likes you (4.3), a winter that hurts (3.4), and a raid you
  // held (3.5). Nobody joins because a counter ticked over.
  {
    id: 'sons-of-the-camp',
    title: 'Two From Along the Coast',
    body: 'They walked up in the afternoon with their own bedding and stood about until somebody spoke to them. Their people have more mouths than ground, and word has got round that we do not.',
    weight: 3,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 30 }],
    choices: [
      {
        label: 'Find them somewhere to sleep',
        success: {
            text: 'They were put in with the others and set to work the same morning. Neither of them complained about it, which was noticed.',
            effects: [{ t: 'join', n: 2, why: 'their own coast had more mouths than ground' }],
        },
      },
      {
        label: 'Send them home',
        success: {
            text: 'They took it better than expected and walked back the way they came. Their people did not take it as well.',
            effects: [{ t: 'standing', n: -12, who: 'friendliest' }],
        },
      },
    ],
  },
  {
    id: 'the-half-frozen',
    title: 'Somebody At the Door',
    body: 'A woman came out of the trees at dusk with nothing on her but what she was wearing, and would not say what had happened to whoever she had been with. She has been standing at the edge of the firelight for an hour.',
    weight: 3,
    once: true,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Bring her in',
        success: {
            text: 'She ate what was put in front of her and slept a day and a half. She has been working since, and still has not said what happened.',
            effects: [{ t: 'join', n: 1, why: 'she came out of the trees at dusk with nothing' }],
        },
      },
      {
        label: 'Give her food and send her on',
        success: {
            text: 'She took the bag without a word. Nobody in the hall enjoyed watching her go, and one or two said so.',
            effects: [
              { t: 'food', n: -4 },
              { t: 'morale', n: -6 },
            ],
        },
      },
    ],
  },
  {
    id: 'taken-off-the-field',
    title: 'What Was Left Standing',
    body: 'Two of the ones who came at us are alive and disarmed, sitting where they were put. They are somebody, from somewhere, and nobody here is going to walk them home.',
    weight: 3,
    once: true,
    when: [{ c: 'settled' }, { c: 'anger', min: 20 }],
    choices: [
      {
        label: 'Set them to work',
        success: {
            text: 'They were put on the wood and the water and watched for a while. The watching stopped before the work did.',
            effects: [{ t: 'join', n: 2, why: 'they were left standing after the raid and nobody walked them home' }],
        },
      },
      {
        label: 'Turn them loose',
        success: {
            text: 'They went east without looking back. Whoever sent them knows now that we do not kill people who have stopped fighting.',
            effects: [{ t: 'standing', n: 10, who: 'angriest' }],
        },
      },
    ],
  },

  // --- Deck expansion, batch one ---
  //
  // The deck is what the game has instead of scenery: it is the only thing
  // that happens on a quiet day, and thirty-nine cards across four seasons
  // and four phases repeat inside a single run. These lean on conditions the
  // engine already has, so none of them costs a line of engine code.
  {
    id: 'the-drowned-field',
    title: 'Water Where the Grass Was',
    body: 'The river has come up over its bank in the night and is standing in the low ground. It will go down. What is under it may not come back up.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'season', any: ['spring', 'autumn'] }],
    choices: [
      {
        label: 'Dig a cut and let it run off',
        check: { stat: 'craft', dc: 12 },
        success: { text: 'We cut a channel down to the old bed and the water went where it was told.', effects: [{ t: 'morale', n: 4 }] },
        failure: { text: 'The cut filled faster than we dug it and took a week of growing with it.', effects: [{ t: 'food', n: -8 }, { t: 'morale', n: -4 }] },
      },
      { label: 'Let it do what it will', success: { text: 'We left it. It went down in its own time and left silt behind, which is not the worst thing.', effects: [{ t: 'food', n: -3 }] } },
    ],
  },
  {
    id: 'whale-fall',
    title: 'A Whale on the Sand',
    body: 'It came in on the tide sometime in the night and it is bigger than the boat. The smell has already carried. So has the news, probably.',
    weight: 6,
    once: true,
    when: [{ c: 'terrain', any: ['shore'] }],
    choices: [
      {
        label: 'Cut and carry all of it',
        check: { stat: 'might', dc: 12 },
        success: { text: 'Three days of filthy work and we came away with more meat than we could smoke. It fed us for weeks.', effects: [{ t: 'food', n: 15 }, { t: 'morale', n: 6 }] },
        failure: { text: 'We worked two days and it turned before we were half done. Most of it went back to the birds.', effects: [{ t: 'food', n: 5 }, { t: 'wound', n: 2, count: 2 }] },
      },
      { label: 'Take what we can carry today', success: { text: 'We took the good cuts off the top and left the rest to whoever came next.', effects: [{ t: 'food', n: 7 }] } },
    ],
  },
  {
    id: 'bog-iron',
    title: 'Rust in the Water',
    body: 'The pool at the low end runs orange and leaves a skin on everything that sits in it. Somebody says that is iron, and that it can be got out.',
    weight: 6,
    once: true,
    when: [{ c: 'terrain', any: ['bog'] }, { c: 'unknown', lore: 'smithing' }],
    choices: [
      {
        label: 'Rake it and try to work it',
        check: { stat: 'craft', dc: 13 },
        success: { text: 'Four days of failing at it and then, on the fifth, something that would take an edge.', effects: [{ t: 'learn', lore: 'smithing' }, { t: 'morale', n: 5 }] },
        failure: { text: 'We came away orange to the elbow and no wiser. The pool is still there.', effects: [{ t: 'morale', n: -3 }] },
      },
      { label: 'Leave it; there is walking to do', success: { text: 'We noted where it was and went on.', effects: [] } },
    ],
  },
  {
    id: 'the-quiet-camp',
    title: 'Nobody At Home',
    body: 'Somebody was living here until recently. The fire is cold but the bedding is dry, and there is a pot still hanging over it. No sign of them at all.',
    weight: 7,
    when: [{ c: 'terrain', any: ['forest', 'valley', 'hills'] }, { c: 'dayMin', day: 8 }],
    choices: [
      {
        label: 'Take what is useful',
        success: { text: 'We took the pot and what food was left and did not talk about it much afterwards.', effects: [{ t: 'food', n: 4 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Look for whoever left it',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'We found the tracks going east, all of them going, none coming back. We left the camp as we found it.', effects: [{ t: 'reveal', radius: 4 }, { t: 'morale', n: 2 }] },
        failure: { text: 'We spent half a day casting about and found nothing at all. The pot was still there when we came back.', effects: [{ t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'the-sunless-noon',
    title: 'The Sun Does Not Get Up',
    body: 'It is grey at what should be noon and dark again by the middle of the afternoon. Nobody says anything about it, which is worse than if they did.',
    weight: 9,
    when: [{ c: 'season', any: ['winter'] }, { c: 'settled' }],
    choices: [
      {
        label: 'Keep everyone working',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'Work is work whether you can see it or not. The days went by and were got through.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'People worked slowly and badly and two of them stopped altogether for a while.', effects: [{ t: 'morale', n: -7 }] },
      },
      {
        label: 'Burn wood and tell stories',
        success: { text: 'We built the fire up past what was sensible and somebody told the one about the seal-wife. It helped more than the wood cost.', effects: [{ t: 'firewood', n: -6 }, { t: 'morale', n: 9 }] },
      },
    ],
  },
  {
    id: 'the-boundary-stone',
    title: 'Somebody Else\'s Mark',
    body: 'A stone set upright at the edge of the good grazing, with a mark cut into the face of it. It is not weathered. Somebody put it there this year.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 10 }],
    choices: [
      {
        label: 'Leave it standing and keep our beasts off',
        success: { text: 'We grazed the near side and nothing was said. Some things are cheaper honoured than argued.', effects: [{ t: 'food', n: -4 }, { t: 'standing', n: 12, who: 'friendliest' }] },
      },
      {
        label: 'Put it on its back',
        success: { text: 'It took three of us to lay it down. Word of that will have gone somewhere.', effects: [{ t: 'standing', n: -20, who: 'friendliest' }, { t: 'morale', n: 3 }] },
      },
    ],
  },
  {
    id: 'the-old-hand',
    title: 'The One Who Has Done This Before',
    body: 'One of the older ones has been quietly banking the fire a particular way all week — turf on the windward side, a hollow underneath. It burns half the night on what we were putting into an hour.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'unknown', lore: 'skywatch' }, { c: 'season', any: ['autumn', 'winter'] }],
    choices: [
      {
        label: 'Have them show everyone',
        success: { text: 'It took an evening to teach and it changed what a night costs us.', effects: [{ t: 'learn', lore: 'skywatch' }, { t: 'morale', n: 4 }] },
      },
      { label: 'Let them get on with it', success: { text: 'Nobody asked and nobody was told. The fire went on burning well at one end of the hall.', effects: [] } },
    ],
  },
  {
    id: 'gulls-inland',
    title: 'Gulls a Long Way From Water',
    body: 'They are working the ground behind us in numbers, and gulls do not come this far in for nothing. Something has been turned over, or something is dying.',
    weight: 7,
    when: [{ c: 'terrain', any: ['meadow', 'valley', 'hills'] }],
    choices: [
      {
        label: 'Go and see',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'A deer, down a week and mostly gone, but the ground around it was thick with what the gulls had missed.', effects: [{ t: 'food', n: 6 }] },
        failure: { text: 'We walked out to it and it was nothing worth the walk. The gulls went up and came straight back down.', effects: [{ t: 'morale', n: -2 }] },
      },
      { label: 'Keep walking', success: { text: 'We left the birds to it.', effects: [] } },
    ],
  },
  {
    id: 'the-rotten-roof',
    title: 'Turf Coming Through',
    body: 'There is a wet patch over the sleeping end that was not there in the autumn, and the turf above it has gone soft. It is dripping on somebody every night.',
    weight: 7,
    when: [{ c: 'built', building: 'longhouse' }, { c: 'season', any: ['spring', 'autumn', 'winter'] }],
    choices: [
      {
        label: 'Strip it back and re-lay it',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'A cold wet day on the roof and it has been dry ever since.', effects: [{ t: 'firewood', n: -3 }, { t: 'morale', n: 5 }] },
        failure: { text: 'We opened more than we could close before dark and it rained on all of us that night.', effects: [{ t: 'wound', n: 2, count: 2 }, { t: 'morale', n: -5 }] },
      },
      { label: 'Move the bedding and live with it', success: { text: 'We shifted everyone up the hall. The drip went on all winter and everyone learned to sleep through it.', effects: [{ t: 'morale', n: -3 }] } },
    ],
  },
  {
    id: 'the-sea-mark',
    title: 'A Stack Off the Point',
    body: 'A pillar of rock standing off the headland with the sea working through the foot of it, and every gull on the coast on top. From the water it would be visible for a day\'s sailing.',
    weight: 6,
    once: true,
    when: [{ c: 'terrain', any: ['shore', 'ocean'] }],
    choices: [
      {
        label: 'Fix it in the mind and take a bearing off it',
        check: { stat: 'wits', dc: 10 },
        success: { text: 'We put it against the hills behind and now we know this piece of coast from the water.', effects: [{ t: 'reveal', radius: 6 }] },
        failure: { text: 'We looked at it a long while. It is a rock with birds on it.', effects: [] },
      },
      { label: 'Take eggs off the foot of it', success: { text: 'Wet, cold, and worth it. Eggs by the basket.', effects: [{ t: 'food', n: 4 }, { t: 'wound', n: 1 }] } },
    ],
  },

  // --- Deck expansion, batch two ---
  //
  // Deliberately NOT food-positive. Batch one was written for flavour and
  // moved the first winter from 77% to 90% on its own, because most of it
  // ended in finding something. These cost, or trade, or ask a question — the
  // deck needs texture that is not a larder.
  {
    id: 'the-lame-ox',
    title: 'Something Wrong With Its Foot',
    body: 'It has been favouring the near hind since yesterday and this morning it will not put weight on it at all. It is worth more alive and working than it will ever be as meat.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'built', building: 'farmplots' }],
    choices: [
      {
        label: 'Rest it and try to bring it round',
        check: { stat: 'craft', dc: 12 },
        success: { text: 'A fortnight of poultices and doing its work ourselves, and it walked out sound.', effects: [{ t: 'food', n: -5 }, { t: 'morale', n: 4 }] },
        failure: { text: 'It never came right. We had it in the end anyway, and by then it was thin.', effects: [{ t: 'food', n: 5 }, { t: 'morale', n: -6 }] },
      },
      { label: 'Take it now while there is still meat on it', success: { text: 'It was done quickly and nobody watched who did not have to.', effects: [{ t: 'food', n: 11 }, { t: 'morale', n: -5 }] } },
    ],
  },
  {
    id: 'the-argument',
    title: 'Two of Them, Over Nothing',
    body: 'It started over a place at the fire and it has not stopped. Everyone has taken a side by now, including the ones saying they have not.',
    weight: 8,
    when: [{ c: 'settled' }, { c: 'moraleMax', value: 55 }],
    choices: [
      {
        label: 'Hear it out in front of everyone',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'It was said aloud, which took the poison out of it. They are not friends. They are working.', effects: [{ t: 'morale', n: 7 }] },
        failure: { text: 'Saying it aloud made it a thing with witnesses. It will be back.', effects: [{ t: 'morale', n: -6 }] },
      },
      { label: 'Put them on the same job until it stops', success: { text: 'Three days of hauling together and they were too tired to keep it up.', effects: [{ t: 'morale', n: 2 }] } },
    ],
  },
  {
    id: 'seed-corn',
    title: 'The Last of the Seed',
    body: 'What is in the bottom of the sack is either next year\'s crop or this month\'s bread. It cannot be both, and it will not keep for ever.',
    weight: 8,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter', 'spring'] }, { c: 'foodMax', value: 30 }],
    choices: [
      {
        label: 'Keep it back for the ground',
        success: { text: 'We went hungry looking at it. In the spring it went in and came up.', effects: [{ t: 'food', n: -6 }, { t: 'morale', n: -4 }, { t: 'flag', flag: 'sowed', n: 1 }] },
      },
      {
        label: 'Eat it',
        success: { text: 'It was a good week and a bad year. Everyone knew which they were choosing.', effects: [{ t: 'food', n: 9 }, { t: 'morale', n: 5 }] },
      },
    ],
  },
  {
    id: 'the-debt',
    title: 'They Remember What We Owe',
    body: 'Two of them walked up and did not sit down. There was a matter of what was carried away last season, and they have come to say that it is still a matter.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'anger', min: 15 }],
    choices: [
      {
        label: 'Pay it and be done',
        success: { text: 'It cost more than it should have and it ended there, which is what we were paying for.', effects: [{ t: 'food', n: -12 }, { t: 'standing', n: 22, who: 'angriest' }] },
      },
      {
        label: 'Tell them what we think the debt is worth',
        check: { stat: 'spirit', dc: 13 },
        success: { text: 'They went away having got less than they came for and no more than they could argue with.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: 4 }] },
        failure: { text: 'They went away with nothing and a great deal to say about us.', effects: [{ t: 'standing', n: -16, who: 'angriest' }] },
      },
    ],
  },
  {
    id: 'ice-in-the-bay',
    title: 'The Water Has Skinned Over',
    body: 'It is not thick enough to walk on and it is too thick to put a boat through. Whatever we were going to do with the water, we are not doing it for a while.',
    weight: 8,
    when: [{ c: 'season', any: ['winter'] }, { c: 'nearWater' }],
    choices: [
      {
        label: 'Break a channel out to open water',
        check: { stat: 'might', dc: 13 },
        success: { text: 'A day of it with poles and axes and the boat could get out. It refroze behind us by evening.', effects: [{ t: 'wound', n: 2, count: 2 }, { t: 'morale', n: 3 }] },
        failure: { text: 'We got half way and somebody went through to the waist. That ended it.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -5 }] },
      },
      { label: 'Wait for it to go', success: { text: 'It went eventually. Nothing came out of the water in the meantime.', effects: [{ t: 'morale', n: -3 }] } },
    ],
  },
  {
    id: 'the-runaway',
    title: 'One of Them Is Not Here',
    body: 'A bed not slept in and a bag gone from the peg. Nobody saw them go and nobody is saying much about why they might have.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'moraleMax', value: 40 }],
    choices: [
      {
        label: 'Go after them',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'We caught them at the ford by the middle of the day. Nothing was said on the walk back.', effects: [{ t: 'morale', n: 3 }] },
        failure: { text: 'We lost the trail in the wet ground and came back at dark with nothing.', effects: [{ t: 'morale', n: -7 }] },
      },
      { label: 'Let them go', success: { text: 'Nobody went after them. It was talked about for a day and then it was not.', effects: [{ t: 'morale', n: -4 }] } },
    ],
  },
  {
    id: 'the-tooth',
    title: 'It Has To Come Out',
    body: 'They have not eaten properly in three days and the side of the face has gone up like a fist. There is one thing to be done about it and nobody wants to be the one doing it.',
    weight: 7,
    when: [{ c: 'dayMin', day: 20 }],
    choices: [
      {
        label: 'Take it out',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'It came out whole and the swelling was down by the next evening. They ate like a man who had not.', effects: [{ t: 'heal', n: 4 }, { t: 'morale', n: 3 }] },
        failure: { text: 'It broke. What was left had to be dug for, and the digging was worse than the tooth.', effects: [{ t: 'wound', n: 5 }, { t: 'morale', n: -5 }] },
      },
      { label: 'Let it run its course', success: { text: 'It burst on its own in the end, which is a mercy of a kind and not a pleasant one.', effects: [{ t: 'wound', n: 3 }] } },
    ],
  },
  {
    id: 'the-wrong-word',
    title: 'Something Said At the Wrong Time',
    body: 'It was meant as a joke and it landed on the one thing that is not a joke to the person it landed on. The hall has gone quiet in the particular way it does.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 30 }],
    choices: [
      {
        label: 'Make them take it back in front of everyone',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'It was taken back badly and accepted anyway, which was enough.', effects: [{ t: 'morale', n: 5 }] },
        failure: { text: 'Making a man apologise in front of people teaches him who made him do it.', effects: [{ t: 'morale', n: -8 }] },
      },
      { label: 'Pretend nobody heard it', success: { text: 'Everyone went back to what they were doing. Both of them remembered it.', effects: [{ t: 'morale', n: -2 }] } },
    ],
  },
  {
    id: 'the-good-offer',
    title: 'They Want the Harbour',
    body: 'A proposition, put politely and at length: their people would take the water side and work it, and we would have the whole of the upland to ourselves. It is not an unreasonable offer.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 20 }, { c: 'built', building: 'dock' }],
    choices: [
      {
        label: 'Give them the water side',
        success: { text: 'They had the beach by the summer and we have not wanted for timber since. It still rankles with some.', effects: [{ t: 'firewood', n: 30 }, { t: 'standing', n: 25, who: 'friendliest' }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Refuse, politely',
        success: { text: 'It was refused the way it was offered, and both sides went on as before. Mostly.', effects: [{ t: 'standing', n: -10, who: 'friendliest' }, { t: 'morale', n: 3 }] },
      },
    ],
  },
  {
    id: 'the-hard-frost',
    title: 'Iron Ground',
    body: 'The spade rings off it. Nothing can be dug, nothing can be sunk, and anything that was going into the ground this week is not.',
    weight: 8,
    when: [{ c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Burn fires over the ground to soften it',
        success: { text: 'A night of fire over the spot and a morning of fast digging before it closed again.', effects: [{ t: 'firewood', n: -7 }, { t: 'morale', n: 3 }] },
      },
      { label: 'Stop work until it lifts', success: { text: 'Everything stopped. People sat and looked at the door and got on each other\'s nerves.', effects: [{ t: 'morale', n: -5 }] } },
    ],
  },

];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
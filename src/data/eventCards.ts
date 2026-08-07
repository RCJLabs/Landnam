// The deck.
//
// Split out of data/events.ts, which had grown past eleven hundred lines by
// holding the whole event VOCABULARY — conditions, effects, the shapes a card
// can take — in the same file as every card written against it. Those are two
// different kinds of thing with two different reasons to change: the
// vocabulary moves when the engine gains a capability, and this file moves
// every time somebody writes a card.
//
// Everything here is data. The engine that reads it is sim/events.ts, and
// adding a card still never touches engine code.

import type { EventDef } from './events';

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
    weight: 13,
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
    weight: 16,
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
    weight: 13,
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
    weight: 23,
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
    // flagUnset: a crop already in the ground is a promise already made —
    // this card must not collect the price twice before the payout card
    // (the-seed-came-up) has cleared it.
    when: [{ c: 'settled' }, { c: 'season', any: ['winter', 'spring'] }, { c: 'foodMax', value: 30 }, { c: 'flagUnset', flag: 'sowed' }],
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
    id: 'the-seed-came-up',
    title: 'What the Spring Kept Back',
    body: 'The rows that cost bread in the lean weeks stand heavy-headed and gold. Nobody says the word out loud until it is cut — but the count is already plain, and so is who was right.',
    weight: 14,
    // The other half of seed-corn's bargain, and the audit's ninth finding:
    // the sowed flag was set, paid for, and read by NOTHING. Now it is read
    // here, and cleared, so the year can turn and the choice come round
    // again. A promise a player pays for is a promise the game keeps.
    when: [{ c: 'settled' }, { c: 'season', any: ['autumn'] }, { c: 'flagSet', flag: 'sowed' }],
    choices: [
      {
        label: 'Cut it now, while the weather holds',
        success: { text: 'Two days with every knife in the steading, and the store took what the spring had promised it.', effects: [{ t: 'food', n: 15 }, { t: 'morale', n: 6 }, { t: 'flag', flag: 'sowed', n: -1 }] },
      },
      {
        label: 'Let it stand a week for the last of the fat',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'The week held, and the heads filled. It came in heavy and everyone carried some.', effects: [{ t: 'food', n: 20 }, { t: 'morale', n: 7 }, { t: 'flag', flag: 'sowed', n: -1 }] },
        failure: { text: 'The weather turned on the fifth day and beat half of it flat into the mud.', effects: [{ t: 'food', n: 8 }, { t: 'morale', n: -4 }, { t: 'flag', flag: 'sowed', n: -1 }] },
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

  // --- Deck expansion, batch three ---
  //
  // The dilution question, answered for this batch: since 6.3, raids arrive
  // by a daily roll off the steading itself, not from this deck — so a bigger
  // deck no longer waters the raid rate down, only the share of draws that
  // are weather, sickness and steel. This batch keeps that share: it is
  // costly or a trade almost throughout, and two of its cards can draw
  // blood. Measured either side on the honest harness (see balance.test.ts);
  // the drift is recorded in the roadmap changelog.
  {
    id: 'the-ford',
    title: 'The Ford Is Up',
    body: 'The river that was ankle-deep on the way out is brown and loud and carrying whole branches. The far bank is right there, and it might as well be another country.',
    weight: 8,
    when: [{ c: 'season', any: ['spring', 'autumn'] }, { c: 'nearWater' }],
    choices: [
      {
        label: 'Rope up and cross now',
        check: { stat: 'might', dc: 12 },
        success: { text: 'We went over in a chain, shoulder to shoulder against the pull, and lost nothing but our breath.', effects: [{ t: 'morale', n: 3 }] },
        failure: { text: 'The middle took somebody\'s feet from under them and the rope had to do the rest. The packs drank half the river.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'firewood', n: -3 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Camp and let it fall',
        success: { text: 'We sat a day watching the water argue with itself, and crossed the next morning dry.', effects: [{ t: 'food', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-scree',
    title: 'Loose Ground Above the Path',
    body: 'The slope over the trail is all broken stone, and some of it has come down recently enough that the scars are still pale. The only other way round is a long one.',
    weight: 7,
    when: [{ c: 'terrain', any: ['hills', 'mountains'] }],
    choices: [
      {
        label: 'Read the slope and pick a line',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'We went one at a time, quiet as church, and the mountain let us pass.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'It went while the third of us was under it. Not the big stones, but big enough.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Take the long way round',
        success: { text: 'We gave the slope its room and paid for it in shoe-leather and daylight.', effects: [{ t: 'food', n: -2 }, { t: 'morale', n: -1 }] },
      },
    ],
  },
  {
    id: 'the-ship-grave',
    title: 'A Keel Under the Grass',
    body: 'A long mound above the tideline, and the grass grows in the shape of a ship. Whoever they laid in it went into the ground with everything a dead man is owed.',
    weight: 6,
    once: true,
    when: [{ c: 'terrain', any: ['shore'] }, { c: 'dayMin', day: 6 }],
    choices: [
      {
        label: 'Open it for what is in there',
        success: { text: 'Grave-oak burns as well as any other, and nobody said a word the whole time we carried it. The dead man kept his arm-rings; we could not make ourselves.', effects: [{ t: 'firewood', n: 6 }, { t: 'morale', n: -7 }, { t: 'flag', flag: 'openedShipGrave', n: 1 }] },
      },
      {
        label: 'Leave the dead their boat',
        success: { text: 'We walked the length of the mound once, said what is said, and left it riding there above the tide.', effects: [{ t: 'morale', n: 3 }] },
      },
    ],
  },
  {
    id: 'sea-fog',
    title: 'The Country Goes Missing',
    body: 'It came in off the water between one look and the next, and now there is no ridge, no shore, and no sun — only grey, and the sound of everyone breathing.',
    weight: 7,
    when: [{ c: 'terrain', any: ['shore', 'ocean'] }],
    choices: [
      {
        label: 'Hold a line by wind and water-sound',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'We kept the sea on the one hand and the slope on the other and came out where we meant to.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'We walked a long circle and knew it when we found our own morning fire. A day gone into the grey.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Sit down where we stand',
        success: { text: 'We stopped, ate cold, and waited for the world to come back. It did, eventually.', effects: [{ t: 'food', n: -2 }, { t: 'morale', n: -1 }] },
      },
    ],
  },
  {
    id: 'adders',
    title: 'A Nest in the Warm Stones',
    body: 'The flat rocks above the camp have been holding the sun all day, and they are not empty. Somebody nearly learned that with a hand.',
    weight: 6,
    when: [{ c: 'season', any: ['summer'] }, { c: 'terrain', any: ['hills', 'meadow', 'valley'] }],
    choices: [
      {
        label: 'Clear them off with a forked stick',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'Slow work and nobody hurried it. The stones were ours by dusk.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'One came off the stick. The arm went up like a bolster and the owner of it sweated out two bad days.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -3 }] },
      },
      {
        label: 'Move the camp instead',
        success: { text: 'We shifted everything a bowshot along the slope and let the stones keep their tenants.', effects: [{ t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'the-bull-seal',
    title: 'The Strand Has an Owner',
    body: 'A bull seal the size of a rowing bench has hauled out across the landing, and he has already sent one of us backwards over a thwart. He is not leaving.',
    weight: 6,
    when: [{ c: 'terrain', any: ['shore'] }],
    choices: [
      {
        label: 'Take him',
        check: { stat: 'might', dc: 12 },
        success: { text: 'It was not quick and it was not pretty, but there is meat and oil in a bull that big to make it worth the bruises.', effects: [{ t: 'food', n: 8 }, { t: 'morale', n: 3 }] },
        failure: { text: 'He broke somebody\'s forearm against the shingle and went down the strand at his own pace, unhurried and unmarked.', effects: [{ t: 'wound', n: 5 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Give him the strand until he tires of it',
        success: { text: 'We worked around him for a day and a half. He left on his own tide, answering to nobody.', effects: [{ t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'rats-in-the-store',
    title: 'Something Has Been at the Grain',
    body: 'Droppings along the wall-foot and a corner of the best sack chewed through. However much is gone already, more goes every night this is not dealt with.',
    weight: 8,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 20 }],
    choices: [
      {
        label: 'Turn the whole store out and rebuild it',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'Everything came out, the floor went up on stones, and everything went back in. What was lost was lost; nothing more went.', effects: [{ t: 'food', n: -3 }, { t: 'morale', n: 2 }] },
        failure: { text: 'We turned the store out in a wet week and the damp got what the rats had missed.', effects: [{ t: 'food', n: -8 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Smoke the runs and hope',
        success: { text: 'We burned green wood in the runs and lost less after that. Less is not none.', effects: [{ t: 'firewood', n: -4 }, { t: 'food', n: -4 }] },
      },
    ],
  },
  {
    id: 'the-foul-well',
    title: 'The Water Has Turned',
    body: 'It comes up with a smell on it and a slick that was not there last week. Somebody drank it anyway, and now everybody is watching them out of the sides of their eyes.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 30 }],
    choices: [
      {
        label: 'Dig it out and sink it deeper',
        check: { stat: 'might', dc: 12 },
        success: { text: 'Two days in the cold and the dark of it, and the water came back sweet from below the bad layer.', effects: [{ t: 'morale', n: 4 }] },
        failure: { text: 'The side slumped in on the digging and the well is worse than it was. We are carrying water now.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'morale', n: -5 }] },
      },
      {
        label: 'Boil every drop until it clears',
        success: { text: 'Every pot in the steading on the fire, every day, until the well came round on its own. The woodpile paid for the water.', effects: [{ t: 'firewood', n: -6 }] },
      },
    ],
  },
  {
    id: 'the-hay-fire',
    title: 'Smoke Over the Winter Feed',
    body: 'Dry weeks, a hot wind, and now there is smoke standing over the stacked feed with nobody near it. It has a hold already, and it is between the stack and the water.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'built', building: 'farmplots' }, { c: 'season', any: ['summer', 'autumn'] }],
    choices: [
      {
        label: 'Beat it out before it crowns',
        check: { stat: 'might', dc: 12 },
        success: { text: 'Cloaks, flails, and everyone who could stand. We lost the near end of the stack and kept the rest.', effects: [{ t: 'food', n: -4 }, { t: 'wound', n: 1, count: 2 }] },
        failure: { text: 'The wind turned into it while we were winning. What the winter was going to eat went up in an afternoon.', effects: [{ t: 'food', n: -11 }, { t: 'wound', n: 2, count: 2 }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Cut a break and give it the near stack',
        success: { text: 'We tore up ground on the windward side and let it have what it already held. It died at the bare earth.', effects: [{ t: 'food', n: -7 }, { t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-second-keel',
    title: 'A Sail Standing In',
    body: 'One sail, square and patched, standing in past the point on a falling wind. Whoever they are, they will be on the beach by dark, and they have seen the smoke of us.',
    weight: 13,
    when: [{ c: 'settled' }, { c: 'dayMin', day: 24 }],
    choices: [
      {
        label: 'Meet them at the tideline and hail them',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'Traders, of a rough kind, blown off a coast they liked better. They told us more of the country than they meant to and left on the morning tide.', effects: [{ t: 'reveal', radius: 4 }, { t: 'morale', n: 3 }] },
        failure: { text: 'They were not traders. The talking stopped when they had counted us.', effects: [{ t: 'battle', difficulty: 0 }] },
      },
      {
        label: 'Stand armed on the strand and be counted',
        success: { text: 'They read the beach, and what stood on it, and came in anyway.', effects: [{ t: 'battle', difficulty: -1 }] },
      },
    ],
  },
  {
    id: 'wolves-at-the-byre',
    title: 'Tracks Round the Byre',
    body: 'Every morning the snow around the byre is written over with pad-marks, and every morning they are closer to the door. Last night something tried the hinge-end.',
    weight: 14,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Sit up in the cold and meet them',
        success: { text: 'Two nights of nothing, and on the third the dark got up and came at the lantern.', effects: [{ t: 'battle', difficulty: -1 }] },
      },
      {
        label: 'Give the winter its toll',
        success: { text: 'We kept to the hall and counted the store short in the mornings. Cheaper than blood, everyone said, not quite believing it.', effects: [{ t: 'food', n: -7 }, { t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'snowed-under',
    title: 'The Door Opens Inward',
    body: 'It snowed all night without wind, and the drift is at the eaves. The hall is warm, dark, and buried, and the wood is stacked on the far side of the yard.',
    weight: 8,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Dig the yard out at once',
        check: { stat: 'might', dc: 11 },
        success: { text: 'We cut steps up into the daylight and trenched a path to the woodpile before it could set.', effects: [{ t: 'morale', n: 3 }] },
        failure: { text: 'The digging went slow and wet, and the cold found hands and feet before the wood was reached.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'firewood', n: -3 }] },
      },
      {
        label: 'Burn close and wait for the thaw to help',
        success: { text: 'We fed the fire from the near stack and let the sky decide when we owned a yard again.', effects: [{ t: 'firewood', n: -6 }, { t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-lean-weeks',
    title: 'The Gap Before the Green',
    body: 'The winter store is a memory and nothing in the ground is ready. These are the weeks the old ones would not talk about, and now nobody here needs telling why.',
    weight: 9,
    when: [{ c: 'settled' }, { c: 'season', any: ['spring'] }, { c: 'foodMax', value: 18 }],
    choices: [
      {
        label: 'Grind bark into the last of the meal',
        success: { text: 'Birch bark, dried and pounded, and bread that tasted of the woodshed. It filled people without feeding them.', effects: [{ t: 'food', n: 3 }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Send the best two out beyond the far ridge',
        check: { stat: 'wits', dc: 13 },
        success: { text: 'Four days, and they came back bent under a good kill from country nobody had hunted.', effects: [{ t: 'food', n: 9 }, { t: 'morale', n: 4 }] },
        failure: { text: 'Four days, and they came back with one thin hare and a limp between them.', effects: [{ t: 'wound', n: 3 }, { t: 'morale', n: -5 }] },
      },
    ],
  },
  {
    id: 'the-feast-bid',
    title: 'An Invitation, of a Kind',
    body: 'A man comes to say his people are holding a feast at the turn of the season, and that we would be welcome. It is friendliness, and it is also a counting of heads, and both sides know both things.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 20 }],
    choices: [
      {
        label: 'Go, and go generous',
        success: { text: 'We walked over with a full sack and ate a bigger one. Songs were traded, and by the end the counting of heads had stopped mattering to either side.', effects: [{ t: 'food', n: -8 }, { t: 'standing', n: 16, who: 'friendliest' }, { t: 'morale', n: 6 }] },
      },
      {
        label: 'Send thanks and stay home',
        success: { text: 'The thanks were carried back politely and received the same way, and something that had been warming cooled a little.', effects: [{ t: 'standing', n: -8, who: 'friendliest' }] },
      },
    ],
  },
  {
    id: 'the-boundary-walk',
    title: 'They Are Walking the Bounds',
    body: 'A dozen of them, walking their boundary the old way, with witnesses. The line they are walking runs closer to our ground than it used to, and they have sent a boy to ask if we will stand witness too.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'anger', min: 10 }],
    choices: [
      {
        label: 'Walk it with them and argue where it matters',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'We walked the whole of it and gave ground nowhere that counted. The line was cut in witness of both peoples, which is worth more than the ground was.', effects: [{ t: 'standing', n: 14, who: 'angriest' }, { t: 'morale', n: 2 }] },
        failure: { text: 'It came to shouting at the third stone, and the line stands where they walked it, witnessed by their own.', effects: [{ t: 'standing', n: -8, who: 'angriest' }, { t: 'morale', n: -3 }] },
      },
      {
        label: 'Refuse to dignify it',
        success: { text: 'We stayed home and let them walk. A line walked unanswered has a way of becoming the line.', effects: [{ t: 'standing', n: -10, who: 'angriest' }, { t: 'morale', n: 2 }] },
      },
    ],
  },
  {
    id: 'the-wreck-wood',
    title: 'A Wreck on the Shared Strand',
    body: 'A ship\'s worth of good timber is coming ashore a plank at a time on the stretch of beach both coasts use, and both coasts have noticed. Wreck-right is a thing people here take seriously.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 10 }, { c: 'terrain', any: ['shore', 'ocean', 'meadow', 'valley'] }],
    choices: [
      {
        label: 'Split the strand and haul our half',
        success: { text: 'We met at the mid-rock and divided the beach by eye, and both sides hauled till dark within their own ground.', effects: [{ t: 'firewood', n: 8 }, { t: 'standing', n: 8, who: 'friendliest' }] },
      },
      {
        label: 'Work all night and take the whole of it',
        success: { text: 'By morning there was nothing on the sand but drag-marks. Nobody came to argue. Nobody came at all, for a while.', effects: [{ t: 'firewood', n: 15 }, { t: 'standing', n: -18, who: 'friendliest' }, { t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'black-ice',
    title: 'Glass on Every Stone',
    body: 'Rain over frozen ground in the night, and now the whole country is poured glass. Standing still is work; the day\'s walking is somewhere between a joke and a wager.',
    weight: 7,
    when: [{ c: 'season', any: ['winter', 'spring'] }],
    choices: [
      {
        label: 'Bind the shoes with cord and go on',
        check: { stat: 'craft', dc: 11 },
        success: { text: 'Corded soles and short steps. We moved like old people all day, and everyone arrived whole.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'The cord wore through on the second slope. One went down hard on the point of an elbow, and we heard it.', effects: [{ t: 'wound', n: 4 }, { t: 'morale', n: -3 }] },
      },
      {
        label: 'Make a cold camp and wait for the melt',
        success: { text: 'We stood down where we stood and burned wood we had meant to keep, waiting for the world to get its grip back.', effects: [{ t: 'firewood', n: -4 }, { t: 'food', n: -2 }] },
      },
    ],
  },
  {
    id: 'the-ember',
    title: 'Fire in the Bedding',
    body: 'A spat ember, a straw tick, and half a breath of wind through the smoke-hole. The smell wakes the far end of the hall before the light does.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'season', any: ['autumn', 'winter'] }],
    choices: [
      {
        label: 'Haul water in the dark',
        check: { stat: 'might', dc: 11 },
        success: { text: 'A bucket-chain in shirt-sleeves and it was out before it reached the wall-posts. The hall smelled of wet char for a fortnight.', effects: [{ t: 'wound', n: 1 }, { t: 'morale', n: 2 }] },
        failure: { text: 'The chain fumbled in the dark and the fire got into the roof-end before the water won. Two burned hands and a bad corner of thatch.', effects: [{ t: 'wound', n: 4, count: 2 }, { t: 'morale', n: -6 }] },
      },
      {
        label: 'Smother it with what is nearest',
        success: { text: 'Cloaks and a winter blanket went onto it and stayed there. Cheap, counted against a hall; dear, counted against a winter\'s bedding.', effects: [{ t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'the-rowing-song',
    title: 'Somebody Starts the Old Song',
    body: 'A bad day, a low fire, and out of the quiet somebody starts the rowing song from the crossing — the one with the stroke in it. One voice, then three.',
    weight: 5,
    when: [{ c: 'dayMin', day: 15 }, { c: 'moraleMax', value: 50 }],
    choices: [
      {
        label: 'Take it up',
        success: { text: 'The whole band came in on the stroke like they were pulling one oar. For the length of it, everyone was going home.', effects: [{ t: 'morale', n: 7 }] },
      },
      {
        label: 'Let it die out',
        success: { text: 'Nobody joined, and the singer let it go after a verse. The quiet afterwards was quieter than before.', effects: [{ t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-recount',
    title: 'The Count Was Wrong',
    body: 'The autumn count and the store disagree, and the store is the one telling the truth. Somewhere between the tally-sticks and the sacks, food that was written down was never there.',
    weight: 8,
    when: [{ c: 'settled' }, { c: 'season', any: ['autumn'] }],
    choices: [
      {
        label: 'Say it plainly at the evening meal',
        success: { text: 'The real number was said out loud once, to everyone, and the plans changed that night to fit it.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: -3 }] },
      },
      {
        label: 'Quietly stretch the cooking instead',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'Thinner stews, no announcement. By the time anyone noticed, the gap had mostly been cooked across.', effects: [{ t: 'food', n: -2 }] },
        failure: { text: 'People can count what is in a bowl. The quiet stretching was noticed, named, and resented more than the shortfall.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: -7 }] },
      },
    ],
  },

  // --- Deck expansion, batch four: the hundred ---
  //
  // The last batch of item 6. Same bargain as batch three — costly or a
  // trade almost throughout — and it deliberately spends the corners of the
  // vocabulary the deck had never used: a card gated on lore the band KNOWS,
  // one on the palisade, one on the smokehouse. Measured either side on the
  // honest harness, with batch three's warning live: a second ten-point
  // winter drop makes the drift real and buys a trim.
  {
    id: 'the-cairn',
    title: 'A Cairn on the High Ground',
    body: 'Stones stacked shoulder-high on the rise, grey with lichen at the base and pale at the crown. People have been adding to it for longer than anyone has been counting.',
    weight: 6,
    when: [{ c: 'terrain', any: ['hills', 'mountains', 'meadow'] }],
    choices: [
      {
        label: 'Put a stone on it and go on',
        success: { text: 'Each of us carried one up. The way is watched, the old ones say, and it does no harm to be polite to it.', effects: [{ t: 'morale', n: 4 }] },
      },
      {
        label: 'Read the country from the rise',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'From the cairn the land laid itself out like a told story: the water, the woods, the ways between.', effects: [{ t: 'reveal', radius: 3 }] },
        failure: { text: 'Cloud sat down on the rise while we stood there, and we came down knowing what we already knew.', effects: [{ t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'hail-out-of-a-blue-sky',
    title: 'Hail Out of a Blue Sky',
    body: 'The first stones bounce off the packs like slung shot and the sky is still half blue. It is on us before anyone has finished saying what it is.',
    weight: 7,
    when: [{ c: 'season', any: ['summer', 'autumn'] }, { c: 'terrain', any: ['meadow', 'valley', 'hills'] }],
    choices: [
      {
        label: 'Cover the packs with our own backs',
        success: { text: 'We knelt over the food and took it on the shoulders. The stores came through dry and whole; not everyone did.', effects: [{ t: 'wound', n: 2, count: 2 }, { t: 'morale', n: -2 }] },
      },
      {
        label: 'Run for the treeline',
        check: { stat: 'wits', dc: 11 },
        success: { text: 'We made the trees with the worst of it hammering the ground behind us.', effects: [{ t: 'morale', n: 1 }] },
        failure: { text: 'The run scattered us and the packs. What the hail did not bruise, the wet got.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-old-road',
    title: 'A Way Through the Wood',
    body: 'A trodden line through the trees, too wide for deer and too old for yesterday — but not too old for last week. Roads go where people are.',
    weight: 13,
    when: [{ c: 'terrain', any: ['forest', 'valley'] }, { c: 'dayMin', day: 6 }],
    choices: [
      {
        label: 'Follow it and see who made it',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'It ran to a ford and a summer shieling, empty this season. We know this country better for the walking of it.', effects: [{ t: 'reveal', radius: 4 }] },
        failure: { text: 'It had been walked more recently than we thought, and the walkers heard us first.', effects: [{ t: 'battle', difficulty: 0 }] },
      },
      {
        label: 'Cross it and leave it alone',
        success: { text: 'We stepped over it like a stream and put ground between us and it before dark.', effects: [{ t: 'morale', n: -1 }] },
      },
    ],
  },
  {
    id: 'the-masterless-dog',
    title: 'A Dog With No One Behind It',
    body: 'It has been keeping pace at the edge of sight since morning — a rough grey working dog, ribs showing, collar of plaited hide and no one in the world at the end of it.',
    weight: 6,
    when: [{ c: 'dayMin', day: 10 }],
    choices: [
      {
        label: 'Feed it and let it choose',
        success: { text: 'It ate at arm\'s length for two days and then one morning it was lying against the packs as if it had always been ours. It hears things we do not.', effects: [{ t: 'food', n: -3 }, { t: 'morale', n: 5 }, { t: 'flag', flag: 'dog', n: 1 }] },
      },
      {
        label: 'Drive it off — we cannot feed it',
        success: { text: 'Stones thrown to miss, and it understood them. It sat at the ridgeline a long time before it went.', effects: [{ t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'midge-summer',
    title: 'The Air Is Alive',
    body: 'The wind has dropped and the low ground has come up in a haze of midges, in every eye and every mouthful. The beasts of the country have all gone to the high bare places, which says something.',
    weight: 6,
    when: [{ c: 'season', any: ['summer'] }, { c: 'terrain', any: ['bog', 'forest', 'valley'] }],
    choices: [
      {
        label: 'Burn smudge-fires and sit in the smoke',
        success: { text: 'Green wood and smoke thick enough to lean on. Eyes streamed either way, but the smoke was ours.', effects: [{ t: 'firewood', n: -3 }] },
      },
      {
        label: 'Push through to the high ground',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'A foul afternoon, walked through with hoods up and mouths shut, and clean wind on the far side of it.', effects: [{ t: 'morale', n: -1 }] },
        failure: { text: 'The band came apart into a dozen swatting, cursing islands. Tempers went before the daylight did.', effects: [{ t: 'wound', n: 1, count: 3 }, { t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'the-hot-pool',
    title: 'Steam Off the Water',
    body: 'A pool in the rocks with steam standing over it and no fire anywhere: the ground itself is doing it. The water smells faintly of eggs and holds its warmth like a grudge.',
    weight: 5,
    once: true,
    when: [{ c: 'terrain', any: ['hills', 'mountains'] }],
    choices: [
      {
        label: 'Halt a day and soak the road out of everyone',
        success: { text: 'A day lost and worth double. Old aches came out in the steam, and the band walked on the next morning like new-shod horses.', effects: [{ t: 'food', n: -2 }, { t: 'heal', n: 3 }, { t: 'morale', n: 6 }] },
      },
      {
        label: 'Mark it and keep walking',
        success: { text: 'We fixed the place in memory, each of us privately planning to come back, and went on.', effects: [{ t: 'morale', n: -1 }] },
      },
    ],
  },
  {
    id: 'over-the-ice',
    title: 'The Short Way Is White',
    body: 'The water that cost half a day to walk around in autumn is a flat white road now. Somewhere under the snow-crust is ice, and the only question that matters is how much.',
    weight: 7,
    when: [{ c: 'season', any: ['winter'] }, { c: 'nearWater' }],
    choices: [
      {
        label: 'Test it and cross spread out',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'An axe-head through the crust showed a hand-span of good black ice. We crossed a spear-length apart, and the lake talked under us the whole way.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'It held until it did not. We got them out by the rope, but the cold had its bite first, and the packs drank.', effects: [{ t: 'wound', n: 5 }, { t: 'firewood', n: -3 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Go the long way round',
        success: { text: 'We walked the shore like people with time to spend, which we were not.', effects: [{ t: 'food', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-dry-summer',
    title: 'The Barley Is Asking',
    body: 'No rain since the last quarter-moon and none in the sky. The barley has gone grey-green and quiet, and the stream the plots drink from is a stride narrower than it was.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'season', any: ['summer'] }, { c: 'built', building: 'farmplots' }],
    choices: [
      {
        label: 'Carry water till it rains',
        check: { stat: 'might', dc: 12 },
        success: { text: 'Yoke and bucket, dawn and dusk, every back in the steading. The crop held on until the sky remembered us.', effects: [{ t: 'morale', n: 2 }, { t: 'wound', n: 1 }] },
        failure: { text: 'We carried until shoulders gave, and it was a cup of water on a burning house. The near rows lived; the far ones stand like straw.', effects: [{ t: 'food', n: -6 }, { t: 'wound', n: 1, count: 2 }, { t: 'morale', n: -3 }] },
      },
      {
        label: 'Let the sky decide',
        success: { text: 'It rained nine days too late. What came off the plots was thin and knew it.', effects: [{ t: 'food', n: -5 }, { t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'salt-runs-short',
    title: 'The Salt Is Counted',
    body: 'The smokehouse is hung full and the salt-crock is not equal to it. Meat half-cured is meat on a timer, and everybody who has wintered before knows what the timer sounds like.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'built', building: 'smokehouse' }, { c: 'season', any: ['autumn'] }],
    choices: [
      {
        label: 'Boil sea-water down at the pans',
        success: { text: 'Days of fire under the pans for a crock of grey salt that tasted of the whole coast. It was enough, barely.', effects: [{ t: 'firewood', n: -6 }] },
      },
      {
        label: 'Smoke it harder and hang it higher',
        check: { stat: 'craft', dc: 12 },
        success: { text: 'Cold-smoked long and slow, high in the peak where the draught lives. It kept. It also bent every knife that met it.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'The middle of the hang went soft in the first warm week, and the smell told everyone at once.', effects: [{ t: 'food', n: -7 }, { t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'the-net-lifter',
    title: 'The Nets Come Up Light',
    body: 'Three mornings running, the nets have come up wrong — lifted, picked, and set back almost right. The water is feeding somebody, and it is not us.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'built', building: 'dock' }],
    choices: [
      {
        label: 'Lie out on the water overnight',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'A boat with no lamp, two hours before dawn. We rose alongside and said good morning. The nets have come up honest ever since, and heavier.', effects: [{ t: 'food', n: 5 }, { t: 'morale', n: 4 }] },
        failure: { text: 'A cold wet night of nothing. Whoever it is knew we were out, and the nets were lifted at the far end instead.', effects: [{ t: 'food', n: -3 }, { t: 'morale', n: -4 }] },
      },
      {
        label: 'Let the water keep its thief',
        success: { text: 'We set the nets shallower and nearer, and counted the far water lost. It grated every single morning.', effects: [{ t: 'food', n: -4 }, { t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'the-winter-guest',
    title: 'An Old Man Out of the Weather',
    body: 'One of theirs, old enough to have stopped counting, walked in ahead of the storm with frost in his beard and his hands inside his shirt. Guest-right is guest-right on every coast there is.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }, { c: 'goodwill', min: 15 }],
    choices: [
      {
        label: 'Bed him by the fire till the weather turns',
        success: { text: 'He stayed four days, ate like a bird, and told stories that made the hall forget the wind. His people came for him with thanks that were not just words.', effects: [{ t: 'food', n: -5 }, { t: 'standing', n: 14, who: 'friendliest' }, { t: 'morale', n: 3 }] },
      },
      {
        label: 'Feed him once and point at the sky',
        success: { text: 'He took the bowl, ate it standing, and went back into the weather with a straight back. The story of that walked the coast faster than he did.', effects: [{ t: 'standing', n: -12, who: 'friendliest' }, { t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'lights-on-the-barrow',
    title: 'Lights Where the Dead Live',
    body: 'Twice now the night-watch has seen it: a pale light moving on the old barrow, there and gone. Nobody has said the word for what walks with a light and no lantern, and everybody is thinking it.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Walk up to the barrow and look',
        check: { stat: 'spirit', dc: 12 },
        success: { text: 'Foxfire on wet rot, and the marks of a fox that had been at it. We carried a piece of the glowing wood home, and the hall laughed at itself for a week.', effects: [{ t: 'morale', n: 6 }] },
        failure: { text: 'Whatever it was, it was not there when we were, and the dark on the way home had eyes in it. Nobody slept well after.', effects: [{ t: 'morale', n: -6 }] },
      },
      {
        label: 'Bar the door and build the fire high',
        success: { text: 'The fire was kept up and the door kept barred, and nobody looked out. The wood knew what the nerves cost.', effects: [{ t: 'firewood', n: -4 }, { t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'the-fosterling',
    title: 'They Offer a Son',
    body: 'The offer is made formally, with witnesses: a boy of theirs, twelve winters, to live under our roof and learn our ways — and to be, in the way of these things, a knot tied between the coasts.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 35 }],
    choices: [
      {
        label: 'Take him in and stand for him',
        success: { text: 'He came with his own knife and a change of clothes, homesick and hiding it well. He works, he listens, and two peoples now have one boy in common.', effects: [{ t: 'join', n: 1, why: 'his people sent him to learn our ways, and to be a knot tied between the coasts' }, { t: 'standing', n: 15, who: 'friendliest' }] },
      },
      {
        label: 'Decline, with every courtesy there is',
        success: { text: 'It was declined so politely that nobody could name the insult, and everybody could feel it.', effects: [{ t: 'standing', n: -10, who: 'friendliest' }] },
      },
    ],
  },
  {
    id: 'the-autumn-meeting',
    title: 'The Coast Comes to Market',
    body: 'Word goes round the way it does: at the river-mouth, at the full moon, whoever has surplus and whoever has need. Half the coast will be on that gravel, trading and looking each other over.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'season', any: ['autumn'] }, { c: 'goodwill', min: 20 }],
    choices: [
      {
        label: 'Go down with meat to trade',
        success: { text: 'Smoked meat went across the blankets and seasoned timber came back, and names were put to faces on both sides. Worth the walk twice over.', effects: [{ t: 'food', n: -6 }, { t: 'firewood', n: 10 }, { t: 'standing', n: 8, who: 'friendliest' }] },
      },
      {
        label: 'Stay home this year',
        success: { text: 'We kept our meat and our own company. The coast met, traded, and talked — and was told we had not come.', effects: [{ t: 'standing', n: -4, who: 'friendliest' }] },
      },
    ],
  },
  {
    id: 'the-mocking-verse',
    title: 'A Verse Is Going Round',
    body: 'Somebody over there has made a verse about us — tidy, cruel, and easy to remember, which is the dangerous kind. It has already crossed the water. A verse left standing becomes the truth.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'anger', min: 15 }],
    choices: [
      {
        label: 'Answer it verse for verse',
        check: { stat: 'wits', dc: 12 },
        success: { text: 'Ours was better. It came back to us within the month off a trader\'s tongue, and word is even their own hall laughed — which ends a verse-war cleaner than blood does.', effects: [{ t: 'morale', n: 6 }, { t: 'standing', n: 6, who: 'angriest' }] },
        failure: { text: 'Ours limped. Theirs got a second life out of mocking it, and now there are two verses.', effects: [{ t: 'morale', n: -5 }, { t: 'standing', n: -6, who: 'angriest' }] },
      },
      {
        label: 'Let it wear itself out',
        success: { text: 'We said nothing, which was dignified, and heard it hummed at us from a passing boat, which was not.', effects: [{ t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'a-wedding-asked',
    title: 'Two of Them Stand Up Together',
    body: 'One of ours and one of theirs, and neither of them is asking permission so much as announcing terms. The two coasts have been many things to each other; married is not yet one of them.',
    weight: 6,
    once: true,
    when: [{ c: 'settled' }, { c: 'goodwill', min: 40 }],
    choices: [
      {
        label: 'Hold the feast under our roof',
        success: { text: 'Both peoples under one roof for two days, and the only fight was over who sang worse. There is a hearth on this coast now that belongs to both sides of the water.', effects: [{ t: 'food', n: -10 }, { t: 'standing', n: 25, who: 'friendliest' }, { t: 'morale', n: 8 }] },
      },
      {
        label: 'Forbid it',
        success: { text: 'It was forbidden, and it happened anyway, at their hall instead of ours. We lost the marriage and kept the bill.', effects: [{ t: 'standing', n: -15, who: 'friendliest' }, { t: 'morale', n: -5 }] },
      },
    ],
  },
  {
    id: 'frost-heave',
    title: 'The Wall Has Moved',
    body: 'A length of the palisade has heaved with the frost and leans out like a drunk against a doorpost. A wall that leans is a wall that teaches people to try it.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'built', building: 'palisade' }, { c: 'season', any: ['winter', 'spring'] }],
    choices: [
      {
        label: 'Dig it and reset it now, frost or no',
        check: { stat: 'might', dc: 11 },
        success: { text: 'Frozen ground fought us for every post-hole, and lost. The line stands true again, and was seen being made to.', effects: [{ t: 'morale', n: 2 }] },
        failure: { text: 'A post came free wrong and took two of us down the bank with it. The wall stands, but it cost more than timber.', effects: [{ t: 'wound', n: 3, count: 2 }, { t: 'morale', n: -2 }] },
      },
      {
        label: 'Wedge it and wait for soft ground',
        success: { text: 'Props and wedges and a promise to do it properly in the thaw. Every day it leans, somebody looks at it.', effects: [{ t: 'morale', n: -2 }] },
      },
    ],
  },
  {
    id: 'rot-under-the-thatch',
    title: 'A Smell in the Store',
    body: 'Sweetish, faint, and wrong, somewhere at the back of the stack. Damp has got in under the thatch and something in there has started to turn. Rot spreads at the speed of touching.',
    weight: 7,
    when: [{ c: 'settled' }, { c: 'season', any: ['autumn'] }],
    choices: [
      {
        label: 'Turn the whole stack and dry it by the fire',
        success: { text: 'Everything out, everything sniffed, the bad cut away and the damp dried at the hearth. Two days of work bought with firewood, and the stack went back sound.', effects: [{ t: 'firewood', n: -4 }, { t: 'food', n: -2 }] },
      },
      {
        label: 'Trust the stack and watch it',
        check: { stat: 'craft', dc: 12 },
        success: { text: 'It was one bag, caught early, and the stack around it was sound. This time.', effects: [{ t: 'food', n: -1 }] },
        failure: { text: 'By the time the smell was strong enough to argue about, the rot had walked through the whole corner.', effects: [{ t: 'food', n: -8 }, { t: 'morale', n: -3 }] },
      },
    ],
  },
  {
    id: 'the-drift-net',
    title: 'Somebody\'s Net, Nobody\'s Fish',
    body: 'A torn net is coming down the tide, floats and all, and it is heavy with a catch nobody stayed to claim. Whatever tore it loose from its owner had weather in it.',
    weight: 6,
    when: [{ c: 'terrain', any: ['shore', 'ocean'] }],
    choices: [
      {
        label: 'Haul it in',
        check: { stat: 'might', dc: 11 },
        success: { text: 'It came in fighting the whole way, full of fish and weed and one very angry crab. The net will mend; the catch went on the racks.', effects: [{ t: 'food', n: 6 }] },
        failure: { text: 'It wrapped a leg on the third pull and nearly took its haulier with it down the tide. We cut it free and watched it go.', effects: [{ t: 'wound', n: 3 }, { t: 'morale', n: -2 }] },
      },
      {
        label: 'Let the sea keep what it took',
        success: { text: 'It went past and out, floats winking. Somebody up-coast is poorer tonight, and it is not us, and it could have been.', effects: [{ t: 'morale', n: -1 }] },
      },
    ],
  },
  {
    id: 'the-white-owl',
    title: 'The White Owl',
    body: 'It has taken to hunting the in-field at dusk, white as washed wool and silent as the inside of a drum. Every head in the steading turns to watch it. Nobody agrees on what it means.',
    weight: 5,
    when: [{ c: 'settled' }, { c: 'season', any: ['winter'] }],
    choices: [
      {
        label: 'Call it good hunting and a clean winter',
        success: { text: 'It was said aloud at the fire — an owl that fat means mice, and mice mean grain, and grain means we are richer than we feel. The hall chose to believe it.', effects: [{ t: 'morale', n: 5 }] },
      },
      {
        label: 'Say nothing and count heads',
        success: { text: 'Somebody said, too quietly and not quietly enough, whose face it had. It was nobody\'s face. It was an owl. The saying still sat at the fire all evening.', effects: [{ t: 'morale', n: -4 }] },
      },
    ],
  },
  {
    id: 'a-lean-sail',
    title: 'A Lean Sail Closing',
    body: 'She has been on the same tack as us for an hour and she is faster. A crew that eats shows it in the rowing; this one rows like men who have not, and they are not closing to trade news.',
    weight: 14,
    when: [{ c: 'terrain', any: ['ocean'] }, { c: 'dayMin', day: 5 }],
    choices: [
      {
        label: 'Ship oars and let them come alongside',
        success: { text: 'We took the way off her and got the shields up along the rail. They came on.', effects: [{ t: 'battle', difficulty: 0 }] },
      },
      {
        label: 'Throw them meat and pull away',
        success: { text: 'A sack went over the side and they stopped for it, which told everyone what kind of winter they were having.', effects: [{ t: 'food', n: -5 }, { t: 'morale', n: -2 }] },
      },
      {
        label: 'Race them for the shallows',
        check: { stat: 'might', dc: 12 },
        success: { text: 'We pulled until the oars bent and took her in over sand they did not dare follow across.', effects: [{ t: 'morale', n: 4 }] },
        failure: { text: 'They had the legs of us, and we met them tired.', effects: [{ t: 'battle', difficulty: 1 }] },
      },
    ],
  },
  {
    id: 'the-cold-forge',
    title: 'The Forge Stands Cold',
    body: 'The band knows iron now, and knowing is not burning: the charcoal is gone, and bog-ore is patient in a way that edges are not. Every dull axe in the steading has an opinion.',
    weight: 6,
    when: [{ c: 'settled' }, { c: 'known', lore: 'smithing' }],
    choices: [
      {
        label: 'Burn a stack down to charcoal',
        success: { text: 'A turf-covered stack, three days of smoke and judgement, and sacks of good black charcoal at the end of it. The forge rang again the same evening.', effects: [{ t: 'firewood', n: -8 }, { t: 'morale', n: 3 }] },
      },
      {
        label: 'Let it stand cold till there is wood to spare',
        success: { text: 'The smith\'s hands went back to hauling and the whetstone did what it could. Everything cuts a little worse than it ought to.', effects: [{ t: 'morale', n: -3 }] },
      },
    ],
  },

];

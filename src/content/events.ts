// Voyage events. Data only — the engine interprets conditions, checks,
// and effects. Keep ids stable: save flags reference them.

import { EventDef } from '../sim/types';

export const EVENTS: EventDef[] = [
  {
    id: 'drifting-cask',
    title: 'A Drifting Cask',
    text: 'A sealed cask bobs in the swell, tarred and heavy. Weathered runes on the lid — or are those just scratches?',
    weight: 10,
    options: [
      {
        label: 'Haul it aboard',
        check: { stat: 'sea', who: 'best', dc: 7 },
        success: { text: 'Salted herring and a skin of sour ale. The crew cheers.', effects: [{ t: 'res', food: 6 }, { t: 'morale', amount: 5 }] },
        failure: { text: 'The cask splits on the gunwale. Brine and rot. The smell stays for days.', effects: [{ t: 'morale', amount: -4 }] },
      },
      { label: 'Let it drift', success: { text: 'Some gifts of the sea are better refused.', effects: [] } },
    ],
  },
  {
    id: 'whale-pod',
    title: 'The Whale-Road Earns Its Name',
    text: 'Grey backs breach off the bow — a pod of whales, close enough to smell. Harpoons wait in the hold.',
    weight: 8,
    options: [
      {
        label: 'Hunt one',
        check: { stat: 'might', who: 'best', dc: 9 },
        success: { text: 'Blood and triumph. Meat for weeks, and a tale for the fire.', effects: [{ t: 'res', food: 12 }, { t: 'morale', amount: 8 }, { t: 'fame', amount: 5 }] },
        failure: { text: 'A fluke the size of a door smashes the strakes. The pod sounds and is gone.', effects: [{ t: 'res', hull: -3 }, { t: 'morale', amount: -5 }] },
      },
      { label: 'Watch them pass', success: { text: 'They pass like moving islands. The crew watches in silence.', effects: [{ t: 'morale', amount: 2 }] } },
    ],
  },
  {
    id: 'becalmed',
    title: 'Dead Air',
    text: 'The sail hangs like a dead man. The sea is a sheet of hammered tin from horizon to horizon.',
    weight: 8,
    options: [
      {
        label: 'Row until it breaks',
        check: { stat: 'sea', who: 'crewAvg', dc: 8 },
        success: { text: 'Backs bend, the oars bite, and by dusk a breeze finds you.', effects: [] },
        failure: { text: 'Hours of rowing for nothing. Blisters, curses, and an extra ration gone.', effects: [{ t: 'res', food: -3, water: -3 }, { t: 'morale', amount: -3 }] },
      },
      { label: 'Wait it out', success: { text: 'You drift, and eat, and wait.', effects: [{ t: 'res', food: -2, water: -2 }] } },
    ],
  },
  {
    id: 'sprung-leak',
    title: 'A Sprung Plank',
    text: 'Cold water sloshes over the ballast stones. Somewhere below the waterline, a seam has opened.',
    weight: 9,
    options: [
      {
        label: 'Find and caulk it',
        check: { stat: 'skill', who: 'best', dc: 8 },
        success: { text: 'Wool, tar, and a steady hand. The seam holds.', effects: [] },
        failure: { text: 'The patch slips twice before it takes. You lose timber and temper.', effects: [{ t: 'res', timber: -1, hull: -1 }] },
      },
      { label: 'Bail and press on', success: { text: 'The crew bails in shifts. It costs strength you may want later.', effects: [{ t: 'res', hull: -2 }, { t: 'morale', amount: -2 }] } },
    ],
  },
  {
    id: 'rats-in-stores',
    title: 'Rats in the Stores',
    text: 'Droppings in the meal sack. Something has been eating well on your silver-bought stores.',
    weight: 6,
    options: [
      {
        label: 'Hunt them down',
        check: { stat: 'skill', who: 'crewAvg', dc: 7 },
        success: { text: 'Six rats nailed to the mast by their tails. A warning to the rest.', effects: [{ t: 'res', food: -2 }, { t: 'morale', amount: 2 }] },
        failure: { text: 'The rats are faster than sailors. The stores keep shrinking.', effects: [{ t: 'res', food: -5 }] },
      },
      { label: 'Live and let live', success: { text: 'Every ship feeds a few rats. These eat like jarls.', effects: [{ t: 'res', food: -4 }] } },
    ],
  },
  {
    id: 'seal-rocks',
    title: 'Seal Rocks',
    text: 'A skerry black with seals, fat and fearless. Easy meat, if the surf allows a landing.',
    weight: 8,
    conditions: [{ c: 'region', is: ['shetland', 'faroes', 'iceland', 'greenland', 'norway'] }],
    options: [
      {
        label: 'Take the boat in',
        check: { stat: 'might', who: 'best', dc: 7 },
        success: { text: 'Clubs rise and fall. Grim work, but the hold fills.', effects: [{ t: 'res', food: 8 }] },
        failure: { text: 'The surf flips the boat. Bruises all around and a lost oar.', effects: [{ t: 'hurtRandom', amount: 2 }, { t: 'morale', amount: -3 }] },
      },
      { label: 'Sail past', success: { text: 'The seals watch you go, unimpressed.', effects: [] } },
    ],
  },
  {
    id: 'driftwood-tangle',
    title: 'Driftwood',
    text: 'A tangle of wave-stripped timber rides the current — some of it good straight birch.',
    weight: 7,
    options: [
      { label: 'Haul the best aboard', success: { text: 'Wet work, but the wood is sound.', effects: [{ t: 'res', timber: 2 }] } },
      { label: 'Ignore it', success: { text: 'No time for beachcombing at sea.', effects: [] } },
    ],
  },
  {
    id: 'fog-bank',
    title: 'The White Blindness',
    text: 'Fog swallows the ship whole. Sound dies. The steering oar might as well point anywhere.',
    weight: 8,
    conditions: [{ c: 'dangerMin', tier: 1 }],
    options: [
      {
        label: 'Steer by swell and wind',
        check: { stat: 'sea', who: 'captain', dc: 8 },
        success: { text: 'The captain reads the water like runes. You hold your line.', effects: [] },
        failure: { text: 'When the fog lifts, no one can say how far you wandered. Supplies burned for nothing.', effects: [{ t: 'res', food: -3, water: -3 }, { t: 'morale', amount: -3 }] },
      },
      { label: 'Drop sail and wait', success: { text: 'A day lost to the white silence.', effects: [{ t: 'res', food: -2, water: -2 }] } },
    ],
  },
  {
    id: 'serpent-shadow',
    title: 'A Shadow Under the Hull',
    text: 'Something long and patient keeps pace beneath the ship. Longer than the ship. The crew stops talking.',
    weight: 4,
    once: true,
    conditions: [{ c: 'dangerMin', tier: 2 }],
    options: [
      {
        label: 'Hold course and voice steady',
        check: { stat: 'guts', who: 'captain', dc: 9 },
        success: { text: 'The captain sings the old rowing song, and one by one the crew joins. The shadow sinks away.', effects: [{ t: 'morale', amount: 6 }, { t: 'fame', amount: 8 }] },
        failure: { text: 'Panic spreads faster than the shadow swims. Oars clash; a man is hurt in the scramble.', effects: [{ t: 'hurtRandom', amount: 3 }, { t: 'morale', amount: -8 }] },
      },
      { label: 'Throw the salt-pork overboard as an offering', success: { text: 'The shadow circles the sinking pork once, then is gone. Superstition, or wisdom?', effects: [{ t: 'res', food: -6 }, { t: 'morale', amount: 3 }] } },
    ],
  },
  {
    id: 'castaway',
    title: 'A Voice on the Water',
    text: 'A waterlogged skiff, and in it a sun-blistered wretch waving a broken oar. Another mouth — or another pair of arms.',
    weight: 5,
    once: true,
    conditions: [{ c: 'turnMin', turn: 5 }],
    options: [
      { label: 'Take them aboard', success: { text: 'They drink half a skin in one pull, then reach for an oar. They will do.', effects: [{ t: 'recruitCastaway' }, { t: 'res', water: -3 }, { t: 'morale', amount: 3 }] } },
      { label: 'Sail on', success: { text: 'The voice follows you a long time. Longer than it should.', effects: [{ t: 'morale', amount: -4 }] } },
    ],
  },
  {
    id: 'mutiny-brewing',
    title: 'Low Words at the Oars',
    text: 'Talk dies when the captain walks the deck. Knives are being sharpened that have no fish to clean.',
    weight: 20,
    conditions: [{ c: 'moraleMax', value: 30 }],
    options: [
      {
        label: 'Face them down',
        check: { stat: 'guts', who: 'captain', dc: 9 },
        success: { text: 'The captain names the ringleader, stares him down, and doubles his watch. The grumbling stops — for now.', effects: [{ t: 'morale', amount: 12 }] },
        failure: { text: 'The words come out wrong. The silence afterward is worse than the muttering.', effects: [{ t: 'morale', amount: -6 }] },
      },
      { label: 'Break out the mead', success: { text: 'A wet crew is a warm crew. It buys goodwill, and costs the last of the good drink.', effects: [{ t: 'res', food: -4 }, { t: 'morale', amount: 8 }] } },
    ],
  },
  {
    id: 'scurvy-tooth',
    title: 'The Sailor’s Sickness',
    text: 'Bleeding gums, old scars reopening. The long-voyage sickness has found the weakest aboard.',
    weight: 6,
    conditions: [{ c: 'turnMin', turn: 15 }],
    options: [
      { label: 'Double their ration', success: { text: 'Fresh food and rest. It costs the stores, but the sickness retreats.', effects: [{ t: 'res', food: -5 }, { t: 'healAll', amount: 2 }] } },
      { label: 'They row or they rot', success: { text: 'Hard hearts make hard voyages.', effects: [{ t: 'hurtRandom', amount: 3, count: 2 }, { t: 'morale', amount: -4 }] } },
    ],
  },
  {
    id: 'northern-lights',
    title: 'The Sky Burns Green',
    text: 'Curtains of green fire ripple over the masthead. The old hands say it is the Bifrost bridge, or the dead riding.',
    weight: 5,
    conditions: [{ c: 'dangerMin', tier: 2 }],
    options: [
      { label: 'Take it as an omen of favor', success: { text: 'The crew rows the night through under the burning sky, and no one is tired.', effects: [{ t: 'morale', amount: 8 }] } },
      { label: 'Keep eyes on the water', success: { text: 'Pretty lights never rowed a ship. But you feel watched, and not unkindly.', effects: [{ t: 'morale', amount: 3 }] } },
    ],
  },
  {
    id: 'growler-ice',
    title: 'Growlers',
    text: 'Low ice, barely showing, rides the black water — hull-breakers the size of oxen.',
    weight: 10,
    conditions: [{ c: 'region', is: ['greenland', 'openSea'] }, { c: 'dangerMin', tier: 2 }],
    options: [
      {
        label: 'Thread the field slow',
        check: { stat: 'sea', who: 'captain', dc: 9 },
        success: { text: 'Boat-hook and patience. The ice scrapes past like teeth that decided not to bite.', effects: [] },
        failure: { text: 'A growler kisses the bow. The whole ship shudders.', effects: [{ t: 'res', hull: -4 }, { t: 'morale', amount: -4 }] },
      },
      { label: 'Swing wide south', success: { text: 'The long way around costs stores but spares the strakes.', effects: [{ t: 'res', food: -3, water: -3 }] } },
    ],
  },
  {
    id: 'hidden-cove',
    title: 'A Hidden Cove',
    text: 'Behind a fang of rock, a sheltered cove — and the cold fire-rings of sailors who camped here before you.',
    weight: 6,
    conditions: [{ c: 'region', is: ['shetland', 'faroes', 'iceland'] }],
    options: [
      {
        label: 'Search the camp',
        check: { stat: 'skill', who: 'best', dc: 7 },
        success: { text: 'Under a flat stone: a purse of hack-silver someone meant to come back for.', effects: [{ t: 'res', silver: 8 }] },
        failure: { text: 'Nothing but ash and sheep bones. Still, a dry night’s rest.', effects: [{ t: 'healAll', amount: 1 }] },
      },
      { label: 'Anchor and rest', success: { text: 'Still water and solid sleep — worth more than silver, some nights.', effects: [{ t: 'healAll', amount: 2 }, { t: 'morale', amount: 3 }] } },
    ],
  },
  {
    id: 'bad-barrel',
    title: 'Foul Water',
    text: 'The forward water barrel has gone green and stinking. Someone sealed it badly — no one admits it.',
    weight: 6,
    conditions: [{ c: 'turnMin', turn: 8 }],
    options: [
      { label: 'Pour it out', success: { text: 'Better thirsty than poisoned.', effects: [{ t: 'res', water: -6 }] } },
      {
        label: 'Boil it and hope',
        check: { stat: 'skill', who: 'crewAvg', dc: 8 },
        success: { text: 'Boiled with juniper twigs, it tastes of smoke and is drinkable.', effects: [{ t: 'res', water: -2 }] },
        failure: { text: 'Half the crew spends two days at the leeward rail.', effects: [{ t: 'res', water: -4 }, { t: 'hurtRandom', amount: 2, count: 3 }] },
      },
    ],
  },
  {
    id: 'singing-whale',
    title: 'The Deep Sings',
    text: 'Through the hull, all night: a song without words from the black water below. Old, and sad, and very large.',
    weight: 4,
    once: true,
    conditions: [{ c: 'dangerMin', tier: 1 }],
    options: [
      { label: 'Listen', success: { text: 'No one sleeps, and no one minds. The skald will spend years failing to describe it.', effects: [{ t: 'morale', amount: 5 }, { t: 'fame', amount: 4 }] } },
    ],
  },
  {
    id: 'wreck-pickings',
    title: 'The Broken Hull',
    text: 'A dead ship rides low in the water, mast snapped, crew long gone to the crabs. Her cargo may yet live.',
    weight: 100,
    conditions: [{ c: 'onFeature', kind: 'wreck' }],
    options: [
      {
        label: 'Board and search her',
        check: { stat: 'guts', who: 'best', dc: 7 },
        success: { text: 'Sea-chests below: silver, tools, and a bolt of good wool cloth.', effects: [{ t: 'res', silver: 12, timber: 2 }, { t: 'markUsed' }, { t: 'fame', amount: 3 }] },
        failure: { text: 'The dead ship rolls as you board. A man goes into the water between the hulls and comes up bleeding.', effects: [{ t: 'hurtRandom', amount: 4 }, { t: 'res', silver: 5 }, { t: 'markUsed' }] },
      },
      { label: 'Leave the dead their due', success: { text: 'You pour an ale-offering on the water and pass by.', effects: [{ t: 'morale', amount: 2 }, { t: 'markUsed' }] } },
    ],
  },
  {
    id: 'village-barter',
    title: 'Smoke on the Shore',
    text: 'A fishing village watches your sail with well-earned dread. But your hold has room, and they have winter stores.',
    weight: 100,
    conditions: [{ c: 'onFeature', kind: 'village' }],
    options: [
      {
        label: 'Trade fairly',
        success: { text: 'Silver for smoked fish and clean water. They are glad to see your stern.', effects: [{ t: 'res', silver: -6, food: 8, water: 8 }, { t: 'markUsed' }] },
      },
      {
        label: 'Raid it',
        success: { text: 'The war-horn sounds. The village men snatch up spears and boar-hunting bows.', effects: [{ t: 'startBattle', raidId: 'village' }] },
      },
      {
        label: 'Demand tribute',
        check: { stat: 'might', who: 'crewAvg', dc: 8 },
        success: { text: 'They pay to see your sail leave. No blood, this time.', effects: [{ t: 'res', food: 6, silver: 6 }, { t: 'morale', amount: -2 }, { t: 'markUsed' }, { t: 'fame', amount: 2 }] },
        failure: { text: 'The villagers scatter into the hills with everything worth taking. Empty huts and wasted hours.', effects: [{ t: 'morale', amount: -4 }, { t: 'markUsed' }] },
      },
      { label: 'Pass by', success: { text: 'Their watch-fires burn all night behind you.', effects: [] } },
    ],
  },
  {
    id: 'monastery-bells',
    title: 'Bells Across the Water',
    text: 'A stone chapel on a green holm, fat with candle-silver and guarded by prayer alone. The crew looks to the captain.',
    weight: 100,
    conditions: [{ c: 'onFeature', kind: 'monastery' }],
    options: [
      {
        label: 'Raid it',
        success: { text: 'Oars muffled, shields up. The keel bites the shingle below the chapel.', effects: [{ t: 'startBattle', raidId: 'monastery' }] },
      },
      { label: 'Trade for provisions', success: { text: 'The monks trade gladly, eyes on your axes the whole while.', effects: [{ t: 'res', silver: -4, food: 6 }, { t: 'markUsed' }] } },
      { label: 'Leave the god-men be', success: { text: 'Their singing follows you out to sea.', effects: [] } },
    ],
  },
  {
    id: 'strange-waters',
    title: 'Strange Waters',
    text: 'The sea here turns without wind. Gulls will not cross it. The compass-stone spins slow circles in its bowl.',
    weight: 100,
    conditions: [{ c: 'onFeature', kind: 'mythic' }],
    options: [
      {
        label: 'Row through the heart of it',
        check: { stat: 'guts', who: 'crewAvg', dc: 9 },
        success: { text: 'At the center, utter stillness — and fish rising dead-eyed to the surface, easy as harvest. You do not speak of it after.', effects: [{ t: 'res', food: 10 }, { t: 'fame', amount: 6 }, { t: 'markUsed' }] },
        failure: { text: 'Halfway through, every man aboard hears his own name called from below. You row out faster than you rowed in.', effects: [{ t: 'morale', amount: -8 }, { t: 'markUsed' }] },
      },
      { label: 'Go around', success: { text: 'Whatever hunts here goes hungry tonight.', effects: [{ t: 'res', food: -2, water: -2 }] } },
    ],
  },
  {
    id: 'old-charts',
    title: 'The Old Hand Remembers',
    text: 'The oldest sailor aboard squints at the coastline and claims he shipped this way as a boy.',
    weight: 5,
    once: true,
    conditions: [{ c: 'turnMin', turn: 10 }],
    options: [
      {
        label: 'Trust his memory',
        check: { stat: 'sea', who: 'crewAvg', dc: 7 },
        success: { text: 'He calls the landmarks one by one before they rise. The crew stands him a double ration.', effects: [{ t: 'morale', amount: 5 }, { t: 'res', food: 2, water: 2 }] },
        failure: { text: '"It has changed," he mutters, as the promised harbor turns out to be bare rock.', effects: [{ t: 'morale', amount: -3 }] },
      },
      { label: 'Trust the sun-stone instead', success: { text: 'Old men and old tales. You steer by what you can see.', effects: [] } },
    ],
  },
];

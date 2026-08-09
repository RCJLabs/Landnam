// How to play, as a book the player opens on purpose.
//
// 5.2's rule stands: no tutorial SCREEN ever interrupts anyone — the lessons
// fire when the game reaches the state they explain, and they are free. This
// is the other thing: a reference, sitting behind a link on the title screen
// and a button in the saga book, for the player who wants the whole shape at
// once. Because it is chosen rather than imposed, it is allowed to name
// buttons plainly.

export interface GuideSection {
  id: string;
  title: string;
  body: string;
}

export const GUIDE: GuideSection[] = [
  {
    id: 'the-shape',
    title: 'The Shape of It',
    body: 'Find ground worth holding and settle it before the first winter lands on day 49. Stand what the winters and the coast send. After two winters stood, a band with a mead hall, food for a feast, and a friend on the coast can call a Thing — win it, and the saga ends in a jarldom. Everything below serves that.',
  },
  {
    id: 'the-day',
    title: 'The Day',
    body: 'Everything costs a day: walking a hex, foraging, camping, bartering, fighting. The Act button lists what this ground offers today, with each deed\'s cost and gain — greyed deeds tell you why they are refused. Days are the resource that actually runs out.',
  },
  {
    id: 'the-ground',
    title: 'Ground Worth Holding',
    body: 'The panel under the map reads any hex you stand on: water, soil, timber, harbour, defensibility. Founding needs fresh water outright, and the posts go in ONCE — there is no second steading. Settle lean rather than late: a band still walking when winter lands cannot stockpile.',
  },
  {
    id: 'the-winter',
    title: 'Winter and the Mark',
    body: 'From autumn the winter mark shows what the stores must reach and how short you stand. It walks every remaining day with your people on their jobs — trust it near, gamble on it far, because later winters vary and the far forecast is deliberately vague. Sickness and grief kill more bands than hunger; keep hearts up, not just sacks full.',
  },
  {
    id: 'the-steading',
    title: 'The Steading',
    body: 'Once settled, tap the hall to enter the steading. Everyone needs a job the ground supports; the Build tab queues what timber becomes — the longhouse sleeps you, the palisade holds raids, the búð makes room to grow. A steading that is fed, built and on good terms with the coast DRAWS settlers, who arrive as hands: labour, never fighters. A band that is FEARED and has taken something worth sharing draws men of the other kind, who come armed and fill a gap in the wall. Both need a bed and food to spare.',
  },
  {
    id: 'the-fight',
    title: 'Steel',
    body: 'Fights are turn-based on a small field. Stand your people SHOULDER TO SHOULDER: the shield wall guards everyone in it and adds weight to their blows. The gold pennant marks the leader, whose war-cry — once a fight — puts heart into every friend in earshot and dread into every foe. A man with a shield-brother between him and a foe can put a SPEAR past him: reach beats standing idle in the back rank. Nerve breaks before bodies do — a side whose fighters all break has lost.',
  },
  {
    id: 'the-coast',
    title: 'The Coast',
    body: 'Four neighbours share this coast, and they remember everything. Once the posts are in they come and look at YOU, one a fortnight, and each goes on the map. Barter feeds standing, and traders talk — every bargain names something on the coast you would never have found. Falling on a camp is the other trade: a season of their stores for forty-five standing and a fight. Robbed camps put their stores back over a season, so a band that lives this way works a circuit. The angriest neighbour is where raids come from, and a raid always names its sender.',
  },
  {
    id: 'the-places',
    title: 'Places',
    body: 'The map holds fixed places: a monastery, a trading town, a wreck and an iron seam. They are on this coast, not across the world — but you must LEARN of them, by walking past or by hearing of one from somebody you trade with. Stand on one and Act offers what it will do for you. The town keeps a market and deals both ways; the house will sell you bread for firewood. Steel is the OTHER option, and it is final: a place is taken once, and a place you have taken has nobody left to deal with.',
  },
  {
    id: 'the-sea',
    title: 'The Sea',
    body: 'The knarr rows coastal water — sea with land in sight — faster than legs walk. Fights afloat are fought hull to hull, and losing one puts cargo over the side and holes the hull; camp ashore a night to mend her. Afloat beside a guarded place you may fall on it FROM THE SHIP: they do not watch the water, so they are fewer and shaken, and the hold carries half again what backs could — but losing costs the cargo and the hull. The nets are best at sea, and there is no forage out there.',
  },
  {
    id: 'the-long-game',
    title: 'The Long Game',
    body: 'Stand long enough, or take enough, and word travels: harder men come looking, in bigger numbers. Growth answers it — hands to work, walls to hold, friends to call on. The Thing checklist appears at the steading after the first thaw and names exactly what a jarl still lacks. Ruling is not the end: a jarl is owed a portion each season by every neighbour glad of him, and men come to serve a name — but harder men come with them.',
  },
];

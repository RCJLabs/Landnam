# Landnám

*The land-taking. Sail, fight, claim, survive.*

Six of you step off a knarr onto a coast with no name you know. Behind you,
open sea. Ahead, a country that does not care whether you live. Winter comes
on the forty-ninth day.

Landnám is a Viking survival-strategy game: hex-map travel, turn-based tactical
combat, and colony survival, sharing one data model. It runs in a browser,
including a phone browser, and ships as a **single self-contained
`index.html`** that works offline from a `file://` open — no images, no fonts,
no audio files, no network.

## Playing (v0.3 — the full loop)

- **Travel** by tapping a marked hex. Rough country costs more days than open
  ground, and each day eats food and burns firewood.
- **Camp** to rest, mend wounds, and cut firewood. **Forage**, **Hunt**, and
  **Fish** to eat — yields depend on terrain, season, and who in the band is
  best suited to the work.
- **Events** put choices in front of you with the odds shown. Checks roll
  2d6 plus your best hand for the job; they are meant to be lost sometimes.
- **Fights** zoom into a hex battlefield made from the ground you were
  standing on. Turn order comes from wits; each fighter gets a move and one
  action: **Strike**, **Throw** a spear (two or three hexes, clear line only,
  and then it is gone), **Shove** (contested — into water, the sea finishes
  it), **Shield** (harder to hit until your next turn) or **Run** (trade the
  action for a second move).
- **Hold the line.** Every standing enemy threatens the six hexes around
  them: step into that ground and your move stops there, and stepping back
  out costs extra. Run is how you break away. A line is something to be
  broken, not walked around.
- **The shield wall is the whole game.** A warrior with a shoulder-mate is
  harder to kill; with two, harder still — and the wall shatters the instant
  a link falls. Meanwhile every enemy past the first standing on you makes
  all of their blows land easier. Charge in alone and you will be surrounded
  and cut down; hold the line and your flanks are somebody else's problem.
- **Nerve breaks.** Wounds, a shoulder-mate falling, being surrounded — it
  all wears a fighter down, though the men beside you absorb some of it. When
  nerve runs out they stop taking orders, run for their own edge, and may
  rally if steady hands are near. A side whose survivors have all broken has
  lost the field, however many are still standing.

  Enemies fight to type — raiders close and swing, scouts throw and keep
  their distance, skirmishers hunt whoever is already busy. Win or lose, you
  come back to the road.
- **The dead do not come back.** A warrior dragged off the field rolls
  against death. Holding the ground means your people get carried off it;
  losing means they are left where they fell, which is most of why a defeat
  costs so much more than a victory. The ones who live carry a wound that
  docks their stats until it mends, and some of them never mend. Kills earn
  experience, and enough of it raises a stat for good — which is exactly why
  the veteran you lose is worth more than the one you started with. Win a
  field with bodies on it and you strip it for food and firewood. The
  reckoning waits until you are back on the road.
- **Take the land.** Every hex you stand on is read on five measures — fresh
  water, soil, timber, harbour, defensibility — from the ground and what
  surrounds it. They pull against each other: the best farmland is open
  country you cannot defend, a crag you can hold grows nothing, a harbour
  wants sand. No fresh water and you cannot settle at all. When you set the
  posts it is permanent: one steading, no moving it, and the place takes its
  name from whatever it is best at. After that, your own ground gives back —
  more from the fields, more firewood, deeper sleep, and fewer things walking
  up on you in the night.
- **Set them to work.** Once the posts are in, **Steading** opens your own
  ground: nineteen hexes of field, wood, water and rough laid out from the
  site you chose. Put people on six jobs — farmer, hunter, fisher,
  woodcutter, builder, warrior. Each leans on one stat and one thing about
  the land, and the panel shows you what *that* person would produce at
  *that* job before you commit. Builders raise shelter and burn less
  firewood; warriors keep a watch that goes quiet the moment nobody stands
  it. Nothing grows in a frozen field, so what you bank in summer is what you
  eat in winter — and nobody works on the days you are away walking.
- **Build what you lack.** The steading tracks four needs — food, warmth,
  rest, heart — and says what each one actually is, worst first. Six
  buildings each answer one of them: a longhouse for the cold, farm plots for
  the fields, a smokehouse to keep what you catch, a dock for the water, a
  palisade for the ways in, a mead hall for everything a ledger does not
  measure. Builders work a queue, timber is paid when you commit, and what
  gets finished changes the ground itself. The panel names the scarcity and
  marks the answer, so the order comes out of your winter rather than a wiki.
- **The winter is the boss.** From the turn of autumn the game prints the
  mark: the food and firewood your stores must reach to see spring. It is a
  forecast of *your* plan, not a rule of thumb — put everyone in the fields
  and it will tell you your fields are about to stop. Six firewood a night in
  the dark, and a woodcutter works at well under half, so the stack has to be
  built in the autumn or not at all. Cold nights bring sickness that docks
  stats and will not mend until the thaw. If the colony dies in the dark, the
  number was on screen for two seasons — and the ending will say so.
- **The saga log** writes down what happened, in chronicle voice. It is the
  record of the run.
- **Reaching spring** on day 73 with anyone still alive is the win.

Runs are fully seeded — enter a seed on the title screen to replay or share a
coast.

## Development

```bash
npm install
npm run dev       # dev server
npm test          # vitest: hex math, RNG, worldgen, sim, saves, content lint
npm run build     # typecheck + single-file dist/index.html
npm run release   # build, verify self-containment, zip source
```

`npm run release` is a real check, not a formality: it fails the build if
`dist/` contains anything but `index.html`, or if the page references an
external script, stylesheet, or URL.

## Architecture

The load-bearing rules live in [`CLAUDE.md`](./CLAUDE.md); the plan and its
status live in [`ROADMAP.md`](./ROADMAP.md). In brief:

- **One data model, three renderers.** A `Person` is one object — a party
  token in travel, a unit in battle, a worker in colony. Never duplicated.
- **Everything is turn-based.** Day turns, initiative turns, season ticks.
  No `requestAnimationFrame` game loops.
- **Pure sim, dumb renderers.** Logic is `(state, action) => state` in
  `src/sim/`, fully unit-tested. `src/render/` reads state and draws SVG.
- **Deterministic RNG.** `Math.random` is banned. Everything flows through
  seeded, independently-named streams in `src/rng.ts`.
- **Data-driven content.** Events, traits, and terrain are typed data in
  `src/data/`; adding content never touches engine code.
- **Saves never break.** `SAVE_VERSION` bumps ship with a migration.

```
src/
  main.ts        boot + mode router
  modes.ts       TRAVEL | BATTLE | COLONY stack
  hex/           shared hex math — world map AND battle grid
  rng.ts         seeded streams
  state/         GameState, saves, migrations
  sim/           pure logic: worldgen, travel, events, upkeep, calendar
  render/        SVG views + UI chrome
  data/          events, traits, terrain, names
```

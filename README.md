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

## Playing (v0.1 — the overworld)

- **Travel** by tapping a marked hex. Rough country costs more days than open
  ground, and each day eats food and burns firewood.
- **Camp** to rest, mend wounds, and cut firewood. **Forage**, **Hunt**, and
  **Fish** to eat — yields depend on terrain, season, and who in the band is
  best suited to the work.
- **Events** put choices in front of you with the odds shown. Checks roll
  2d6 plus your best hand for the job; they are meant to be lost sometimes.
- **Fights** zoom into a hex battlefield made from the ground you were
  standing on. Turn order comes from wits; each fighter gets a move and one
  action. Tap a dashed hex to step, a ringed foe to strike. Win or lose, you
  come back to the road.
- **The saga log** writes down what happened, in chronicle voice. It is the
  record of the run.
- **Winter** starts on day 49 and stops the land from giving. Reaching spring
  on day 73 with anyone still alive is the win.

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

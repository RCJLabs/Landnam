# Whale Road

*A saga of salt, silver, and the long way west.*

Whale Road is a single-player Viking voyage roguelike that runs entirely in the
browser. Sail a longship hex by hex across a procedurally generated North
Atlantic — Norway, Shetland, the Faroes, Iceland, Greenland, and at last
Vinland — managing food, water, hull, and the tempers of your named crew.
Raids and boardings zoom into small tactical hex battles where shield-walls,
flanking, and a well-timed shove over the rail decide who sails home.

Death is permanent. Fame is not: it buys legacy unlocks that make the next
bloodline's voyage a little less doomed.

## How to play

- **Sail** by clicking a hex next to your ship. West is Vinland; west is the win.
- **Supplies**: every leg costs food and water. Hard legs (headwinds, storms)
  cost more and tire the crew. **Hold position** to fish, catch rain, and rest.
- **Ports** (anchor icon) sell supplies, repairs, and hired hands. Silver is
  earned the old way: raiding.
- **Raids**: monasteries and villages trigger tactical hex battles. Keep your
  warriors adjacent for shield-wall bonuses (+1 defense per steady neighbor,
  max +2), flank to ignore theirs, **Brace** to hold a line, **Push** foes into
  the sea on boarding fights, and **Rally** with your captain when the line
  shakes. The dead stay dead; the maimed heal slowly.
- **Weather is terrain**: storms drift, sink ships, and fill your water barrels
  if you shadow them at a respectful distance.
- **Winter is the clock.** Linger past ~60 turns and morale bleeds until the
  crew turns for home without you.
- **Fame** from deeds and raids persists across runs — spend it on the title
  screen (war-chest, hardy crew, crow's nest, sealskin sails, and more).

Runs are seeded: enter a seed on the title screen to replay or share a chart.

## Development

```bash
npm install
npm run dev       # dev server
npm test          # vitest suite incl. headless autoplay balance harness
npm run build     # typecheck + production build (deployable to GitHub Pages)
```

The game is a Vite + TypeScript app with zero runtime dependencies, rendered
on a single Canvas (both the sea chart and the battlefields share one hex-math
core) with DOM panels for chrome. All game logic is pure and deterministic —
every run derives from its seed string, randomness flows through forked
seeded streams, and the full game is playable headlessly in tests (see
`test/autoplay.test.ts`, which bots complete voyages through the real
reducers and asserts the difficulty stays in a sane band).

### Layout

```
src/core      hex math, A*, FOV, seeded RNG      (pure)
src/procgen   North Atlantic chart generation    (pure)
src/sim       voyage + battle reducers, events   (pure)
src/content   data: events, raids, enemies, balance knobs
src/render    canvas painters (chart + battle skins)
src/ui        DOM panels (HUD, events, ports, crew, title)
src/save      versioned localStorage persistence
```

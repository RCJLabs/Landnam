# CLAUDE.md — Landnám

Viking survival-strategy game: hex-map travel → turn-based tactical combat → colony simulation. TypeScript + Vite + procedural SVG. Solo dev (Evan, RCJ Labs). Played primarily on mobile browsers.

## Start every session

1. Read `ROADMAP.md`. Find the `CURRENT MILESTONE` marker.
2. Work ONLY on that milestone unless told otherwise. Propose a plan before multi-file changes.
3. When the milestone's "Done when" criteria pass: update its status in ROADMAP.md, add a changelog line, advance the CURRENT MILESTONE marker, and commit.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build; MUST emit a single self-contained `dist/index.html` (vite-plugin-singlefile)
- `npm run test` — Vitest (hex math, RNG, sim logic, save migrations)
- `npm run release` — build + zip source to `release/landnam-src.zip`
- `npm run publish` — build + copy to `docs/index.html`, which Pages serves

## Architecture (load-bearing rules)

**One data model, three renderers.** All game state lives in one serializable `GameState` object (`src/state/`). A `Person` is a single object used by all three modes — never duplicate character data per mode. Renderers (`src/render/travel.ts`, `battle.ts`, `colony.ts`) are pure views: they read state and draw SVG; they never own state.

**Everything is turn-based.** Travel advances in day turns, battle in initiative turns, colony in day/season ticks. No `requestAnimationFrame` game loops, no real-time simulation. Animation/tweening for visual polish only.

**Mode stack.** `TRAVEL | BATTLE | COLONY` managed as a stack in `src/modes.ts` — battle pushes onto travel or colony and pops back with a result object.

**Shared hex library.** `src/hex/` (axial coords, neighbors, distance, A*, line, range) is pure, fully unit-tested, and used by BOTH the world map and the battle grid. Never reimplement hex math inline.

**Deterministic RNG.** `Math.random` is banned. All randomness goes through the seeded RNG in `src/rng.ts`, with separate named streams (worldgen, events, combat) so replays stay stable.

**Data-driven content.** Events, traits, buildings, jobs, enemies are plain typed data in `src/data/` — adding content must never require touching engine code.

## Directory map

```
src/
  main.ts        # boot + mode router
  modes.ts       # mode stack
  state/         # GameState, save/load, migrations
  hex/           # shared hex math (pure, tested)
  rng.ts         # seeded RNG streams
  sim/           # travel.ts, battle.ts, colony.ts (pure logic, tested)
  render/        # SVG renderers per mode + ui.ts (panels, bars)
  data/          # events, traits, buildings, enemies, names
  audio/         # WebAudio synth (no files)
```

## Hard constraints

1. **Zero external assets.** No image/font/audio files, no CDN loads, no external requests at runtime. Visuals = inline SVG; audio = WebAudio synthesis. The built `index.html` must run offline from a file:// open.
2. **Single-file build.** If a change breaks the singlefile build, the change is wrong.
3. **Save discipline.** Saves in localStorage under `landnam_save`. Any change to save shape bumps `SAVE_VERSION` in `src/state/version.ts` AND ships a migration in the migration registry — old saves must always load.
4. **Sim/render split.** Game logic lives in `src/sim/` as pure functions `(state, action) → state` with Vitest coverage. Renderers stay logic-free. If it can be unit-tested, it doesn't belong in `render/`.
5. **Mobile first.** Touch targets ≥ 44px, portrait layout is primary, pinch/drag pan-zoom on maps. Test at 390×844.
6. **Norse flavor everywhere.** Names, item text, and saga-log lines use grounded Viking-age vocabulary (knarr, thrall, Thing, wergild). Saga log is written in past-tense chronicle voice.

## Style

- Vanilla TypeScript, strict mode. No frameworks, no state libraries.
- Small files (< ~300 lines); split by domain, not by type.
- Named exports only. No classes for game logic — plain objects + pure functions.
- Comments explain *why*, not *what*.

## Release ritual (end of every phase)

`npm run release`, verify `dist/index.html` runs standalone, `npm run publish`,
update ROADMAP.md statuses + changelog, tag `v0.X`, push. Deliverables are
always: `index.html` + source zip + updated `ROADMAP.md`.

**Deploying is a committed file, not a workflow.** GitHub Pages serves `main`. `npm run publish` builds and writes `docs/index.html`,
`docs/build.txt` and `docs/.nojekyll`. There is no Deploy action: the old one
pushed to `gh-pages` and left GitHub's own `pages build and deployment` to
publish it, which failed repeatedly inside `actions/deploy-pages` with
"Invalid actions OIDC token" and left the live site hours behind the branch.
A committed artifact has no moving parts.

**The Vite source entry is `app.html`, not `index.html`.** `index.html` at the
repo root is the BUILT page, because Pages serves whatever sits at the root of
the published branch and a source entry there publishes as a blank screen with
a dead `/src/main.ts` tag. `npm run publish` writes the build to BOTH the root
and `docs/`, so the site works whether Pages points at the branch root or at
`/docs` — we cannot see which is configured. `scripts/publish.mjs` refuses to
run if `app.html` stops looking like an entry, or if the built page carries no
build stamp.

Run `npm run publish` in any commit that should change what is live — a
source-only commit will otherwise leave the site on the old build.

**A build behind a flag gets its own folder.** Phase 8's whole side-on
conversion lives behind `VITE_COAST=1`, so `npm run publish` shows none of it —
it builds the default, which is still the hex game. `npm run publish:coast`
writes the coast build to `coast/index.html` and `docs/coast/index.html`,
leaving the live game exactly where it is. Two pages, one branch: `/` is what
players open, `/coast/` is what the conversion looks like today.

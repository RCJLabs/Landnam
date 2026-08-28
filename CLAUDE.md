# CLAUDE.md — Landnám

Viking survival-strategy game: coast travel → turn-based tactical combat → colony simulation, drawn side-on. TypeScript + Vite + procedural SVG. Solo dev (Evan, RCJ Labs). Played primarily on mobile browsers.

Travel runs along a ROUTE — one coast of 26 stops, walked out and back (`src/sim/route.ts`, `src/sim/coast.ts`). The hex map it replaced was deleted in 8.5 (2026-08-28): there is one build, one coordinate, and the address of everything is a stop on the route.

## Start every session

1. Read `ROADMAP.md`. Find the `CURRENT MILESTONE` marker.
2. Work ONLY on that milestone unless told otherwise. Propose a plan before multi-file changes.
3. When the milestone's "Done when" criteria pass: update its status in ROADMAP.md, add a changelog line, advance the CURRENT MILESTONE marker, and commit.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build; MUST emit a single self-contained `dist/index.html` (vite-plugin-singlefile)
- `npm run test` — Vitest (route maths, RNG, sim logic, save migrations)
- `node scripts/bars.mjs` — all ten browser bars
- `npm run release` — build + zip source to `release/landnam-src.zip`
- `npm run publish` — build + copy to `docs/index.html`, which Pages serves

## Architecture (load-bearing rules)

**One person, one look.** What somebody looks like is derived once, in
`render/look.ts`, from the person themselves — shield ground, paint, motif,
cloak, tunic, hair, beard, stride, build. `render/figures.ts` draws them
head-on for the shield wall and `render/walker.ts` draws them in profile for
the road and the yard; `render/shield.ts` draws the shield for both. A view
that invents its own colours for a person has broken the pillar below.

**One data model, three renderers.** All game state lives in one serializable `GameState` object (`src/state/`). A `Person` is a single object used by all three modes — never duplicate character data per mode. Renderers (`src/render/processionView.ts`, `battle.ts`, `steadingView.ts`) are pure views: they read state and draw SVG; they never own state. The two they replaced — the hex map and the hex colony ring — went with the hexes in 8.5, and the contract they both met lives in `src/render/views.ts`.

**Everything is turn-based.** Travel advances in day turns, battle in initiative turns, colony in day/season ticks. No `requestAnimationFrame` game loops, no real-time simulation. Animation/tweening for visual polish only.

**Mode stack.** `TRAVEL | BATTLE | COLONY` managed as a stack in `src/modes.ts` — battle pushes onto travel or colony and pops back with a result object.

**One address.** Everything on the coast — the band, the steading, the places, the neighbours, the rival, the landmarks, the fisheries — is at a STOP: an index into the 26-stop route. `src/hex/` and the `at: Hex` fields that pointed into it were deleted in 8.5. Distances are days (`daysBetween`), not tiles. The battlefield is a plain rectangle addressed by `cell(col, row)`.

**Derived, not stored.** A coast is a function of `(seed, stop)`: its country, its becks, its fisheries, its places, its people and the other landnamsmadr all come out of the seed when they are asked for. A whole save is about 3 kB. If a fact can be computed, it does not go in the save.

**Deterministic RNG.** `Math.random` is banned. All randomness goes through the seeded RNG in `src/rng.ts`, with separate named streams (worldgen, events, combat) so replays stay stable.

**Data-driven content.** Events, traits, buildings, jobs, enemies are plain typed data in `src/data/` — adding content must never require touching engine code.

## Directory map

```
src/
  main.ts        # boot + mode router
  modes.ts       # mode stack
  state/         # GameState, save/load, migrations
  rng.ts         # seeded RNG streams
  sim/           # route.ts, coast.ts, travel.ts, battle.ts, colony.ts (pure, tested)
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

**THE HEXES ARE GONE since 2026-08-28.** Phase 8's side-on conversion was
behind `VITE_COAST=1` while it was being built, then the default while the two
ran side by side, and 8.5 deleted the other one. There is no `VITE_HEX`, no
`npm run test:hex`, no `npm run publish:hex` and no `hex/` page. `npm test` and
`npm run build` are the game; `node scripts/bars.mjs` runs the ten browser bars
that have a subject on a line.

The five bars that went with the map — `sea`, `pinch`, `way-look`, `repaint`,
`steading` — each made a claim about a coordinate system that no longer exists.
They were deleted rather than translated; the three the line needed (`strip`,
`procession`, `hearth`) were written for it in 8.5's job 2.

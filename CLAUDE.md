# CLAUDE.md — Landnám

Viking survival-strategy game: coast travel → turn-based tactical combat → colony simulation, drawn side-on. TypeScript + Vite + procedural SVG. Solo dev (Evan, RCJ Labs). Played primarily on mobile browsers.

Travel runs along a ROUTE — one coast of 26 stops, walked out and back (`src/sim/route.ts`, `src/sim/coast.ts`). The hex map it replaced was deleted in 8.5 (2026-08-28): there is one build, one coordinate, and the address of everything is a stop on the route.

## Start every session

1. Read `ROADMAP.md`. Find the `CURRENT MILESTONE` marker.
2. Work ONLY on that milestone unless told otherwise. Propose a plan before multi-file changes.
3. When the milestone's "Done when" criteria pass: update its status in ROADMAP.md, add a changelog line, advance the CURRENT MILESTONE marker, and commit.

## A number in the roadmap is a reading, not a fact

ROADMAP.md is full of measurements, and every one is a reading taken from an
instrument, on a date, at some N. None of them is a property of the game.

**Ten Phase 9 items in a row were opened on numbers that did not survive being
re-taken** (2026-08-30/31). Not one was carelessness; each was a measurement
written down as a conclusion and then inherited:

- **two counters measured something other than their own name** — a variable
  called `raised` holding what was STANDING at the end, which made the
  palisade look like the rarest building in the game when it is the fifth
  most raised and merely the most upgraded; and a champion tally counting
  clan transitions to day 169 rather than fights;
- **two bot policies were read as rules of the game** — `outWith >= 4` in the
  harness became "party size decides whether steel comes out", and a priority
  list that put `B_DEFEND` last became "the shield is worth nothing";
- **a tie was asserted as a finding** when it only meant the code never ran;
- **a figure from a fixture that forces its own build list** was offered as a
  fact about play, and a decision was made on it;
- **a ratio's denominator selected itself** — "64% of overdue days had no
  food", on a sample that could only contain days a band was short.

So: **before building on a number in the roadmap, re-take it.** When writing
one down, put the instrument, the date and the N beside it. Three traps are
worth naming because each cost real time:

1. A figure measured in a fixture is not a figure about the game.
2. A ratio is not a reading until you know what selected its denominator.
3. An arm that ties its control exactly is usually evidence the feature never
   ran, not that it is worthless.

**And this applies to your own verification, not only to inherited claims.**
The same day produced a sabotage that hit the wrong one of two identical
lines, a threshold test written in terms of the constant it was testing, and a
"byte-identical" PNG comparison against a file the tool had not rewritten. A
check that cannot fail looks exactly like a check that passes.

**The next day was worse, and it is the reason this section is worth its
length.** One probe for 9.11 carried three instrument faults in a row —
classifying turns by the HARNESS's mode stack and reporting "colony 0%";
merging two reasons for "nothing to build" so a pressed band and a finished
one read alike; and asking `home.built.includes(id)` where the codebase has
`standsFor`, which reported "the build list is never finished" when the true
figure is 74% by year four. **That last one is trap 1 above, committed again
by the hand that wrote trap 1.** Knowing the rule is not the same as applying
it, so apply it to the reading in front of you, every time, including when you
are the one who wrote the warning.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build; MUST emit a single self-contained `dist/index.html` (vite-plugin-singlefile)
- `npm run test` — Vitest (route maths, RNG, sim logic, save migrations)
- `node scripts/bars.mjs` — all twelve browser bars
- `npm run look:bless` — approve a deliberate change to how the game LOOKS
- `npm run release` — build + zip source to `release/landnam-src.zip`
- `npm run publish` — build + copy to `docs/index.html`, which Pages serves

## Architecture (load-bearing rules)

**One person, one look.** What somebody looks like is derived once, in
`render/look.ts`, from the person themselves — shield ground, paint, motif,
cloak, tunic, hair, beard, stride, build. `render/figures.ts` draws them
head-on for the shield wall and `render/walker.ts` draws them in profile for
the road and the yard; `render/shield.ts` draws the shield for both. A view
that invents its own colours for a person has broken the pillar below.

**One ink.** A colour used by more than one renderer is named in
`render/palette.ts` and spelled nowhere else; a colour only one painter uses
stays with that painter. `style.css` keeps its own `:root` block so the page
does not wait for JavaScript to learn what colour its text is, and
`test/palette.test.ts` asserts the two say the same thing. That test is also
what makes the rule a rule: it fails on any renderer that respells a shared
colour, and on any file that keeps its own copy of `look.ts`'s wardrobe.

**One knot.** The interlace is drawn once, in `render/knot.ts`, as a single
period of a plait — a tile. It is put on the document root at boot as
`--knot` and `--knot-dim`, so the stylesheet never holds a second copy and
the two cannot drift. A tile is a PAINT, not a tree: a rule of any length
costs the document no nodes. Ornament that is drawn as shapes instead is the
thing art queue item 8 measured, declined, and was right to decline.

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
`npm run build` are the game; `node scripts/bars.mjs` runs the twelve browser
bars that have a subject on a line.

The five bars that went with the map — `sea`, `pinch`, `way-look`, `repaint`,
`steading` — each made a claim about a coordinate system that no longer exists.
They were deleted rather than translated; the three the line needed (`strip`,
`procession`, `hearth`) were written for it in 8.5's job 2.

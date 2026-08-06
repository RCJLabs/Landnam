# LANDNÁM — Roadmap

**Working title:** Landnám (the land-taking)
**Pitch:** Sail, fight, claim, survive. Lead a Viking warband across a procedural hex map, resolve encounters in turn-based tactical combat, then settle the land and keep a colony alive through the winters.
**Stack:** TypeScript + Vite + SVG. Zero art assets. Ships as a single `index.html`. Repo: `github.com/RCJLabs/landnam` → live at `landnam.rcjlabs.com`.

---

## Design Pillars (never violate)

1. **One data model, three renderers.** A warband member is one object rendered three ways: party token (travel), unit (battle), worker (colony). No duplicated character systems.
2. **Everything is turn-based.** Travel = day turns. Battle = initiative turns. Colony = day/season turns. No real-time loops.
3. **Zero assets.** All visuals are procedural SVG (shapes, paths, filters). All audio is synthesized WebAudio. No image, font, or sound files.
4. **Every phase is a playable game.** Each phase ends in something fun on its own, not scaffolding.
5. **Saves never break.** `SAVE_VERSION` bumps only ship with a migration function.

## Delivery Ritual (every phase completion)

1. `npm run build` → single-file `dist/index.html`
2. Zip full source
3. Update this roadmap (statuses + changelog)
4. Tag release `v0.X`, push, deploy to GitHub Pages

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done

> **CURRENT MILESTONE: 2.1**

---

## Phase 0 — Foundation ("walking skeleton")

Goal: an empty but deployed, saveable, mode-switching app.

- [x] **0.1 Scaffold** — Vite + vanilla TS + `vite-plugin-singlefile`. Vitest installed. GitHub Actions deploy to Pages. *Done when: repo builds to one `index.html` and auto-deploys on push to main.*
- [x] **0.2 Hex library** — Axial-coordinate hex math (neighbors, distance, range, line, pathfinding via A*). Pure functions, fully unit-tested. Shared by world map AND battle grid. *Done when: all hex tests pass.*
- [x] **0.3 State, saves, RNG** — Central `GameState` object. `save()/load()` via localStorage with `SAVE_VERSION` + migration registry. Seeded RNG (mulberry32) — `Math.random` is banned. *Done when: refresh restores state; same seed = same world.*
- [x] **0.4 Mode machine + shell UI** — Modes: `TRAVEL | BATTLE | COLONY`, stack-based (battle pushes over travel, pops back). Top bar (day/season/supplies), bottom action bar, saga log panel. Mobile-first layout. *Done when: modes switch with placeholder scenes on phone-sized viewport.*

## Phase 1 — The Whale Road (overworld) → v0.1

Goal: land on a hostile coast, explore, and survive to winter.

- [x] **1.1 World generation** — Seeded hex map (~40×30): coastline, ocean, rivers, forest, hills, mountains, bog, fertile valleys. Terrain drawn as layered SVG polygons + `feTurbulence` water/fog. *Done when: every seed produces a distinct, readable landmass.*
- [x] **1.2 Party & movement** — Warband of 6 generated (name, age, 4 core stats, 1 trait each). Party token moves hex-to-hex; terrain movement costs; each move advances the day. Fog of war (unseen / seen / visible). *Done when: you can explore and the clock runs.*
- [x] **1.3 Supplies & camp** — Food + firewood consumed daily. Forage/hunt/fish actions vary by terrain. Camp action to rest and heal. Starvation and cold drain health and morale. *Done when: doing nothing kills you; playing well doesn't.*
- [x] **1.4 Event system** — Data-driven event cards on travel: weather, wildlife, ruins, hostile scouts, omens, rival landing parties. Choices with stat checks; outcomes auto-resolved for now (combat events stubbed for Phase 2). *Done when: ~15 events fire by terrain/season triggers.*
- [x] **1.5 Seasons & saga log** — Season affects forage yields, movement, visibility. Every meaningful outcome appends a narrated line to the saga log. Run summary on death. *Done when: surviving to first winter feels like an achievement — ship v0.1.*

## Phase 2 — Shield Wall (tactical combat) → v0.2

Goal: encounters zoom into battles worth winning.

- [ ] **2.1 Battle scene** — Combat events push BATTLE mode: small hex battlefield (~9×7) generated from the overworld hex's terrain. Initiative order from stats. Move + one action per turn. *Done when: a full battle round-trips back to travel.*
- [ ] **2.2 Actions & AI** — Strike, throw (axe/spear), shove, defend, dash. Facing-free, zone-of-control melee. Simple enemy AI (aggressive / cautious / flanker archetypes). *Done when: fights are winnable and losable on purpose.*
- [ ] **2.3 Shield wall & morale** — Adjacent allied warriors form a shield wall: shared defense bonus that shatters when a link falls. Unit morale: breaking, fleeing, rallying. *Done when: formation play beats brawling.*
- [ ] **2.4 Consequences** — Persistent injuries, permadeath, loot, XP → stat growth. Deaths written into the saga. *Done when: losing a veteran hurts — ship v0.2.*

## Phase 3 — Landnám (settlement) → v0.3

Goal: the full loop closes — travel, fight, settle, survive winter.

- [ ] **3.1 Land-taking** — Any claimable hex shows site quality derived from surroundings (fresh water, soil, timber, harbor, defensibility). Founding is a one-way ritual moment. *Done when: choosing where to settle is a real decision.*
- [ ] **3.2 Colony view & jobs** — COLONY mode: zoomed local map of the settled hex. Assign warband to jobs: farmer, hunter, fisher, woodcutter, builder, warrior. Day-tick resolves labor into stockpiles. *Done when: job assignment visibly moves the numbers.*
- [ ] **3.3 Needs & buildings** — Needs: food, warmth, rest, morale. Build queue: longhouse, smokehouse, farm plots, palisade, dock, mead hall. Buildings unlock capacity and jobs. *Done when: a build order emerges naturally from scarcity.*
- [ ] **3.4 The First Winter** — Winter as boss fight: no forage, firewood burn, sickness events, morale spiral. Stockpile targets telegraphed in autumn. *Done when: an unprepared colony dies and it's clearly your fault — ship v0.3 (full loop).*
- [ ] **3.5 Raid defense** — Rival clans attack the colony; battle layer reuses the colony map with palisade/buildings as terrain. Losses damage structures and people. *Done when: the palisade earns its lumber.*

## Phase 4 — Depth passes → v0.4–v0.9

Order negotiable; each is a shippable minor version.

- [ ] **4.1 Minds & feuds** — Moods from needs/events; trait interactions; grudges between settlers; feud events with blood-price resolutions.
- [ ] **4.2 Expeditions** — Launch parties FROM the colony back onto the world map (raid, trade, explore) while the colony sims on. The loop becomes a wheel.
- [ ] **4.3 Neighbors** — Persistent rival clans and native settlements: reputation, trade, tribute, alliances, escalation.
- [ ] **4.4 Knowledge** — Discovery-driven progression (runes, shipwright, smithing) unlocked by exploration and events, not a tech-tree menu.
- [ ] **4.5 The Saga** — Run-end saga generator: your whole game retold as a short prose saga from the log. Shareable seed + saga.
- [ ] **4.6 Endgame** — Victory: survive N winters and hold a Thing to be proclaimed jarl. Defeat: warband extinguished.

## Phase 5 — Ship it → v1.0

- [ ] **5.1 Sound** — WebAudio synth: wind, drums, horn, UI ticks. Mute toggle.
- [ ] **5.2 Onboarding** — First-run guided prompts woven into events (no tutorial screens).
- [ ] **5.3 Balance & juice** — Difficulty curves, animation polish, dead-warrior memorial wall.
- [ ] **5.4 Release** — v1.0 tag, `landnam.rcjlabs.com` CNAME. THEN decide TWA/Capacitor wrap (stay web during development).

---

## Parking Lot (ideas, not commitments)

Naval battles · winter solstice festivals · named legendary weapons · bloodline/generation play · daily-seed challenge mode · god-favor system

## Changelog

- **2026-08-06 — v0.1 "The Whale Road"** — Phases 0 and 1 complete. Single-file
  build (49 kB, runs offline from `file://`). Shared axial hex library with A*
  and LOS. Seeded worldgen: 40×30 coast with rivers, fog of war, and a
  guaranteed walkable landmass. Warband of six with four stats and traits.
  Travel, camp, forage/hunt/fish, daily food and firewood upkeep, starvation
  and cold. 16 data-driven events with 2d6 stat checks and visible odds.
  Four seasons on a 24-day turn; winter on day 49, survival on day 73. Saga
  log in chronicle voice. Saves with a migration registry. 95 tests.
- **2026-08-05** — Roadmap v1 created. Project defined: hex travel + turn-based tactics + colony survival, one shared character model, all turn-based, zero assets.

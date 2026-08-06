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

> **CURRENT MILESTONE: 3.1**

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

- [x] **2.1 Battle scene** — Combat events push BATTLE mode: small hex battlefield (7×9, portrait) generated from the overworld hex's terrain. Initiative order from stats. Move + one action per turn. *Done when: a full battle round-trips back to travel.*
- [x] **2.2 Actions & AI** — Strike, throw (axe/spear), shove, defend, dash. Facing-free, zone-of-control melee. Simple enemy AI (aggressive / cautious / flanker archetypes). *Done when: fights are winnable and losable on purpose.*
- [x] **2.3 Shield wall & morale** — Adjacent allied warriors form a shield wall: shared defense bonus that shatters when a link falls. Unit morale: breaking, fleeing, rallying. *Done when: formation play beats brawling.*
- [x] **2.4 Consequences** — Persistent injuries, permadeath, loot, XP → stat growth. Deaths written into the saga. *Done when: losing a veteran hurts — ship v0.2.*

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

- **2026-08-06 — v0.2 "Shield Wall"** — Phase 2 complete. Battles are now
  something you can lose people in permanently.
- **2026-08-06 — 2.4 Consequences** — A warrior dragged off the field rolls
  against death: spirit helps, and holding the ground helps most, because
  losing means leaving them where they fell. The killed are gone for good,
  with a cause and a date, and are named in the saga and on the run-end wall.
  The rest are carried off carrying something — nine wounds that dock stats
  while they mend, two of which never do. A won field with bodies on it
  yields food and firewood rather than silver, because supplies feed the
  survival loop that already exists and coin would have nothing to buy.
  Kills earn xp; twelve of it raises a stat for good, capped at 6, and might
  brings health with it. A death drags the band's heart down harder than any
  victory lifts it, so a win paid for with a veteran leaves you worse off
  than before the fight. The reckoning is shown on the road, not on the
  field: you walk off thinking you won, and then find out what it cost.
  Measured: a maimed band wins 4 of 14 where a whole one wins 7, killing a
  band's best hand costs it reach in 16 of 20 bands, and per 24 fights the
  dead run 2 at favourable odds against 10 at unfavourable.
  `SAVE_VERSION` 5 with a migration. 195 tests.
- **2026-08-06 — 2.3 Shield wall & morale** — Standing shoulder to shoulder
  is worth +2 defence, +3 with two mates, and it shatters the moment a link
  falls. Being surrounded is the other half: every enemy past the first on you
  is worth 2 to all their blows, so the warrior who runs in alone dies and the
  one with mates at both shoulders does not. A shield adds only +1 inside a
  wall — in a line, the shield IS the wall — which also stops evasion stacking
  past anything an attack roll can reach. Nerve breaks, flees for its own edge,
  and rallies (helped by steady shoulder-mates); shoulder-mates also absorb a
  quarter of any shock each, so a lone fighter breaks first. A side whose
  survivors have all broken has lost the field. Measured at contested odds:
  the line wins 13 of 24 and keeps 67 warriors standing, charging wins 12 and
  keeps 57. `SAVE_VERSION` 4 with a migration. 176 tests.
- **2026-08-06 — 2.2 Actions & AI** — Five actions: Strike, Throw (range 2–3,
  needs a clear lane, spends a carried spear), Shove (contested might; into
  water the sea finishes it), Shield (+3 to be hit, until your next turn) and
  Run (trade the action for a second move). Facing-free zone of control in two
  clauses: stepping into a threatened hex ends your move, leaving engagement
  costs 2 — and Run is the answer to both. Foes come in three temperaments
  (aggressive, cautious, flanker) that score the field differently, with
  patience running out after round 12 so careful sides cannot circle forever.
  Measured against the milestone's bar: playing well wins 10 of 14 seeds where
  standing still wins none. `SAVE_VERSION` 3 with a migration. 158 tests.
- **2026-08-06 — 2.1 Battle scene** — BATTLE mode pushes over travel and pops
  back. Foes are `Person` objects like anyone else, so a `Combatant` carries
  only position and turn state. Battlefield generated from the overworld hex's
  terrain (7×9 portrait, so a hex clears the 44px touch target on a phone),
  with a guaranteed crossable lane and deployment that leaves elbow room.
  Initiative from wits; move plus one strike per turn; foes close and swing on
  their own. Three combat events now draw steel. `SAVE_VERSION` 2 with a
  migration. 135 tests.

- **2026-08-06 — v0.1 "The Whale Road"** — Phases 0 and 1 complete. Single-file
  build (49 kB, runs offline from `file://`). Shared axial hex library with A*
  and LOS. Seeded worldgen: 40×30 coast with rivers, fog of war, and a
  guaranteed walkable landmass. Warband of six with four stats and traits.
  Travel, camp, forage/hunt/fish, daily food and firewood upkeep, starvation
  and cold. 16 data-driven events with 2d6 stat checks and visible odds.
  Four seasons on a 24-day turn; winter on day 49, survival on day 73. Saga
  log in chronicle voice. Saves with a migration registry. 95 tests.
- **2026-08-05** — Roadmap v1 created. Project defined: hex travel + turn-based tactics + colony survival, one shared character model, all turn-based, zero assets.

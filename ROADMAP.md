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

> **CURRENT MILESTONE: 5.4**

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

- [x] **3.1 Land-taking** — Any claimable hex shows site quality derived from surroundings (fresh water, soil, timber, harbor, defensibility). Founding is a one-way ritual moment. *Done when: choosing where to settle is a real decision.*
- [x] **3.2 Colony view & jobs** — COLONY mode: zoomed local map of the settled hex. Assign warband to jobs: farmer, hunter, fisher, woodcutter, builder, warrior. Day-tick resolves labor into stockpiles. *Done when: job assignment visibly moves the numbers.*
- [x] **3.3 Needs & buildings** — Needs: food, warmth, rest, morale. Build queue: longhouse, smokehouse, farm plots, palisade, dock, mead hall. Buildings unlock capacity and jobs. *Done when: a build order emerges naturally from scarcity.*
- [x] **3.4 The First Winter** — Winter as boss fight: no forage, firewood burn, sickness events, morale spiral. Stockpile targets telegraphed in autumn. *Done when: an unprepared colony dies and it's clearly your fault — ship v0.3 (full loop).*
- [x] **3.5 Raid defense** — Rival clans attack the colony; battle layer reuses the colony map with palisade/buildings as terrain. Losses damage structures and people. *Done when: the palisade earns its lumber.*

## Phase 4 — Depth passes → v0.4–v0.9

Order negotiable; each is a shippable minor version.

- [x] **4.1 Minds & feuds** — Moods from needs/events; trait interactions; grudges between settlers; feud events with blood-price resolutions.
- [x] **4.2 Expeditions** — Launch parties FROM the colony back onto the world map (raid, trade, explore) while the colony sims on. The loop becomes a wheel.
- [x] **4.3 Neighbors** — Persistent rival clans and native settlements: reputation, trade, tribute, alliances, escalation.
- [x] **4.4 Knowledge** — Discovery-driven progression (runes, shipwright, smithing) unlocked by exploration and events, not a tech-tree menu.
- [x] **4.5 The Saga** — Run-end saga generator: your whole game retold as a short prose saga from the log. Shareable seed + saga.
- [x] **4.6 Endgame** — Victory: survive N winters and hold a Thing to be proclaimed jarl. Defeat: warband extinguished.

## Phase 5 — Ship it → v1.0

- [x] **5.1 Sound** — WebAudio synth: wind, drums, horn, UI ticks. Mute toggle. *Done when: the game has a voice, makes no request to get it, and is silent until touched.*
- [x] **5.2 Onboarding** — First-run guided prompts woven into events (no tutorial screens). *Done when: a new player is taught by the game reaching a state, a veteran sees nothing, and the teaching changes the run not at all.*
- [x] **5.3 Balance & juice** — Difficulty curves, animation polish, dead-warrior memorial wall. *Done when: the curve is measured and asserted in CI, the dead outlive the run, and the screen stops cutting. Two findings left open and written down rather than rushed — see the changelog.*
- [ ] **5.4 Release** — v1.0 tag, `landnam.rcjlabs.com` CNAME. THEN decide TWA/Capacitor wrap (stay web during development).

## Phase 6 — The long saga (post-1.0 direction)

Goal: a run that can go on as long as you can hold it, and a late game that
can actually kill you. Set from a design conversation after the 5.3
measurements: the material survival loop cannot threaten a settled band,
because by year two it has more labour than uses for it.

- [~] **6.1 Winters that vary** — Each winter's severity is fixed by the run
  seed and grows with the years; the mark is exact close to and vague far out,
  so long-range stockpiling is a gamble rather than arithmetic. *Shipped, and
  measured at no change to the curve — see the changelog. It is a prerequisite
  for 6.2, not a fix on its own.*
- [~] **6.2 Hands** — The band can grow: thralls taken, survivors taken in, a
  neighbour's sons. Losing people becomes recoverable, which is what makes
  losing them affordable to inflict — and the labour surplus becomes a choice
  instead of a given. THE unlock for everything below.
  *Groundwork done: the fire now scales with the band round it, so growth has
  a price before growth is offered. Still to come: capacity from buildings,
  the four ways in, and whether a thrall is a full person (SAVE_VERSION 17).*
- [ ] **6.3 Overwhelming force** — Raids that outscale six warriors, so the
  answer is walls, allies and standing rather than a bigger woodpile. Makes
  4.3's neighbours load-bearing.
- [ ] **6.4 No last winter** — Remove the five-winter forced ending; a run
  goes as long as it is held. The Thing becomes a milestone in a saga rather
  than its final page.

---

## Parking Lot (ideas, not commitments)

Naval battles · winter solstice festivals · named legendary weapons · bloodline/generation play · daily-seed challenge mode · god-favor system

## Changelog

- **2026-08-06 — 6.2 groundwork: the fire scales with the band** — Before the
  band can grow, growing has to cost something. Food already scaled with
  mouths and firewood did not — it was a flat seasonal figure — so every extra
  person was pure labour at no charge in wood. That asymmetry is the whole
  reason a settled band was untouchable, and why three separate attempts to
  threaten the late game bounced off it: six people out-produce any burn that
  can be set, and a seventh would have made it worse.
  A night's fire is now part hearth and part headcount — a little over half is
  paid whoever is home, because a fire warms a room rather than a roster, and
  the rest follows the band. It pivots exactly on the six who came off the
  knarr, so the tuned early game does not move by a single log: measured at
  80% reaching the first winter, 50% seeing spring, 50% reaching the second,
  unchanged. A hall of twelve burns 9 a night in midwinter where six burn 6,
  and a band cut to three still burns 5 — losing people must never be a
  saving, or permadeath and the memorial wall are arguing with the upkeep.
  This ships as groundwork and claims nothing about the curve on its own.
  Nobody can grow yet. 498 tests.

- **2026-08-06 — 6.1 Winters that vary, and a mark that admits it** — Each
  winter now has a severity fixed by the run's own seed: a floor that grows
  with the years, plus a bite of nought to four that varies from winter to
  winter and cannot be seen coming. The first winter is exempt — it is the
  shape of the early game, it is tuned to 80% of bands reaching it, and a run
  that opens on an unlucky roll is a coin toss rather than a harder game. A
  test caught that exemption missing on the first pass.
  The winter mark stops being an oracle. It is still exact inside twenty days
  — 3.4's promise was that the game tells you the number, and it still does
  where you can act on it — but further out it plans on the floor plus the
  MIDDLE of the range, so a band that stocks exactly to the mark has
  provisioned for an average winter and comes up short in a bad one.
  Measured honestly: the curve did not move. 80% reach the first winter, 50%
  see spring, 50% reach the second — against 80/47/47 before. That is the
  third distinct lever to bounce off the same wall, and the diagnosis is now
  certain rather than suspected: six people with no competing demands
  out-produce any burn you can set, so nothing priced in firewood can
  threaten a settled band. The fix is not a bigger number, it is fewer hands
  or a foe that hands cannot answer — Phase 6.2 and 6.3. This milestone ships
  because it changes what the player DECIDES (a range they can be wrong
  about, rather than a number they cannot), and because a varying winter is
  what 6.2 needs underneath it. 493 tests.

- **2026-08-06 — A save-migration bug, and the ground a wall needs** — Two
  audit items. The first found a real bug within a minute of existing: a
  fixture test that carries a v1 save forward and then asks whether it is
  PLAYABLE — every field a new game has, every field a person has, decoded,
  played on for twelve turns, and re-saved to a fixed point. Personal morale
  arrived at version 11 and lives on the person, but the migration only added
  the root-level `grudges: []` — so every save older than 4.1 came forward
  with people whose morale was `undefined`, and every mood, drift and grudge
  calculation downstream of it quietly became NaN. They now come forward at
  the band's own morale, which before that version WAS everyone's figure.
  The second is a floor under the shield wall. Battlefields already guarantee
  a walkable LANE, which is the opposite of what a line needs — a corridor
  admits single file, and single file is how you lose the fight the wall was
  meant to win. Fields now also guarantee somewhere four can stand abreast.
  Honest accounting: the guarantee is currently inert. No terrain the game
  ships ever produces a field without a four-wide stand, so it fires never and
  the shield-wall figures are unchanged at 33 wins to 30. It is a regression
  guard on data — obstacle density is a table anyone can tune — and it does
  NOT on its own make the rejected landing change safe, because the mechanism
  there is row DENSITY, not existence: four can stand abreast in 98% of meadow
  rows and 40% of ocean ones, and that spread is what decides whether a line
  is worth forming. 488 tests.

- **2026-08-06 — Two levers for the flat late game, both thrown away** — The
  game's difficulty lives entirely in one season: 41 of 43 bands that get
  through the first winter reach the second. Two fixes were built and
  measured, and neither survived contact with the harness. Raid pressure
  rising with the steading's fame moved the curve by nothing at three
  magnitudes — raids do fire, 61 across 80 runs, and settled bands simply hold
  them. Winters that deepen with the years (+2 firewood a night per winter
  already stood, so the second burns 8 and the third 10, and the cold bites
  harder for the sickness roll) was implemented correctly, verified at the
  season boundaries, and changed survival to the second winter by exactly zero
  — for a careful player and, checked separately, for a careless one too, 18
  of 40 either way.
  The negative result is the finding. By its second year a settled band has
  more labour than it has uses for, and the winter mark is a perfect forecast,
  so anything routed through the material survival loop is a number the band
  simply out-works. A lever that bites has to take people away or bring
  something a small band cannot beat. Both dead ends are written into
  test/balance.test.ts so the third attempt does not begin by repeating them.
  481 tests.

- **2026-08-06 — 5.3 closes: one fix measured and thrown away** — The landing
  is chosen for loneliness alone, which puts ground you could settle a median
  5 and as much as 11 hexes from where the keel touches sand; a band that
  draws a far beach spends its first season walking. Choosing a beach with
  somewhere to live behind it takes that worst case to 4 while leaving GOOD
  ground a median 12 away, so the gamble survives. It looked like a clear win
  and it is not one. Where you land decides where you fight, and on the worlds
  it produces the shield wall stops paying: over sixty seeds the line went
  from 33 wins and 157 people left standing to 32 and 158 — dead level with
  charging in, which is a Phase 2 milestone bar erased. The change is
  rejected, and the reason is written into the two tests that caught it.
  Getting there was itself a correction. The first read of the wall figures
  called it a sample too small to measure what it asserted; widening from
  twenty-four seeds to sixty is what proved the opposite — the effect was
  real. The wider sample is kept, because it is strictly more evidence for a
  bar the game already claimed, and because it is now sensitive enough to
  catch a change that quietly takes the shield wall's advantage away.
  Left open on purpose: the late game is flat — 41 of 43 bands through the
  first winter reach the second — and raid pressure, tried at three
  magnitudes, moves it by nothing. Both want their own milestone rather than
  a number nudged at the end of a long session. 481 tests.

- **2026-08-06 — 5.3 (part): motion** — The screen stops cutting. The band's
  token is now drawn at the origin and positioned by a transform on its group,
  and the element is kept between repaints rather than destroyed and rebuilt
  somewhere else — so a CSS transition turns a move into a glide, with no
  timer and no animation frame anywhere in the game. Everything stays
  turn-based: the state moved the instant the tap landed and only the picture
  takes 260ms to catch up. A token that has just been built is positioned
  BEFORE it enters the document, because a transition needs two values to move
  between and a new token should appear where it belongs rather than fly in
  from the corner of the map; swapping between helmet and longship rebuilds
  it, because a helmet cannot tween into a ship and pretending otherwise looks
  worse than the cut it actually is.
  Cards rise as they arrive. Numbers in the top bar flash when they move, and
  only when they move: the bar keeps its own memory of the last reading, the
  FIRST reading never flashes — opening the game is not a moment where six
  numbers changed — and a stat it has never seen before is not a change
  either. Day is deliberately left out, because it changes every single turn
  and flashing it would train the eye to ignore the whole bar.
  All of it is off for anyone who has asked for reduced motion. 481 tests.

- **2026-08-06 — 5.3 (part): the curve, measured — and a wall** — The
  difficulty of this game had never been measured, only felt. It is now: a
  scripted player of roughly average competence — walks toward timber when
  short, goes looking for ground it can settle, heeds the winter mark, and
  fights back when steel comes out — played across thirty seeds, asserted in
  CI as a wide band rather than a number, so a change that makes the game
  unwinnable or trivial cannot land quietly. Measured today: **80% reach the
  first winter, 47% see spring, 47% reach the two-winter mark** the Thing
  needs.
  Writing the harness was worth more than the numbers. Its own first draft did
  not fight back on the battlefield — it passed turns until somebody died —
  which put "slain" at the top of the death table and made the game look far
  crueller than it is. Teaching the bot to swing moved survival to the second
  winter from 0% to 51%. A later rewrite of the same file disagreed with
  itself by forty points. Both are recorded in the test's own header, because
  a harness is code and can be wrong in exactly the direction that flatters
  whatever it measures.
  Two findings are recorded but deliberately NOT acted on yet. The late game
  is flat — a band through its first winter reached the second in 41 of 43
  cases, so one season holds the entire difficulty; raid pressure is the
  obvious lever and moving it at three different magnitudes changed the curve
  by nothing, so it needs real work rather than a number nudged at the end of
  a session. And the landing is chosen for loneliness alone, which puts
  settleable ground a median 5 and up to 11 hexes from the beach; the fix is
  written and measured (worst case 11 hexes down to 4) but it moves every
  seed's world and destabilises four seeded fixtures elsewhere, so it wants
  its own pass.
  Shipped alongside: the wall. Everyone who did not come back, across every
  run this player has started, with the fate and the day the saga already
  recorded — the third thing to outlive a run, stored beside the mute and the
  teaching rather than in the save, because a memorial that died with the band
  would not be one. Deliberately not a stats screen: no counts, no bests, only
  names. 477 tests.

- **2026-08-06 — 5.2 Onboarding** — Nine lessons, and not one of them a
  tutorial screen. Each is triggered by the game reaching a state where the
  thing actually matters — the store card comes up the evening the food is
  down to four days, the land-taking card the first time you stand on ground
  that would take the posts, the shield wall the first time steel is out —
  and they are evaluated by the SAME condition interpreter real events use,
  so the two can never drift into parallel engines. They wear the event card,
  down to the class name; the only thing setting them apart is one line under
  the body, which is the only place in the game allowed to name a button. The
  body stays in chronicle voice and a test enforces it.
  The teaching is free, and that is the load-bearing claim: a lesson has no
  effects, cannot be failed, never displaces a real event, an aftermath or an
  ending, and is not in the save. Asking for a lesson on every single turn of
  a sixty-turn run produces a byte-identical encoded state to never asking at
  all, which is what stops a "harmless" hint from ever quietly consuming an
  RNG roll or a card slot. What a PLAYER has read lives beside the mute in its
  own localStorage key, not in the save — otherwise every new landing would
  re-teach the game, and the same seed would play differently depending on who
  loaded it. A player who has been taught gets a line on the title screen to
  put it all back. Nothing fires on the title screen or on day one; the
  measurement caught the first draft firing "The Store" at a full store,
  because the threshold had been set to the number the band lands with.
  No `SAVE_VERSION` bump — there is nothing new in the save. 471 tests.

- **2026-08-06 — 5.1 Sound** — The game has a voice, and it is synthesised on
  the spot: twenty-three sounds written down as recipes — oscillators,
  filtered noise, envelopes — with not one audio file anywhere, because the
  built page still has to run offline from a `file://` open. Under all of it
  is the wind, one continuous voice read off the world rather than triggered
  by it: exposed ground opens the filter and a forest closes it, winter is
  louder and more restless than summer on the same shore, a fight ducks the
  bed so the horn has room, and inside the steading you can hear the roof.
  What the game sounds like is a pure function of what changed — `cuesFor
  (before, after, action)` — so a blow that lands and a blow that misses
  differ because the STATE differs, not because the button did. That is what
  makes it testable, and the test caught the first attempt scraping the fight
  log for the word "shield" and calling "beat on his shield to no effect" a
  shield-wall when it is a miss. It also means the foes' turns speak: you hear
  what hit you on a turn you did not take. Silence is the default and it is
  real — zero AudioContexts exist until the player touches the screen, muted
  builds zero nodes rather than zero volume, and a browser with no WebAudio at
  all gets a no-op instead of a thrown error. The mute is a horn glyph pinned
  outside the mode chrome so it is there in all three modes and on the title
  screen, 44px, crossed out rather than merely dimmed; it remembers itself in
  its own localStorage key, deliberately NOT in the save, because a preference
  is not part of a run — so no `SAVE_VERSION` bump. There is still no game
  loop: cues go on the audio clock and the gusts are an LFO in the audio
  thread. 456 tests.
- **2026-08-06 — The chronicle stops stuttering** — Off a phone screenshot:
  three consecutive days of quiet travel wrote three entries that read as one
  line said three ways. Two things were wrong. The pool was picked blind, so
  it could repeat outright — now every march line is chosen against the last
  four entries and a literal repeat inside three days went from 4.9% of
  windows to 0. And the quiet pool held four sentences that all said "nothing
  happened", which no amount of de-duplication fixes; it now holds eight that
  are about different things — the light, the feet, the weather, what nobody
  said — so a fortnight of dull country reads as a fortnight.

- **2026-08-06 — 4.6 Endgame** — Phase 4 closes. Surviving the first winter is
  no longer winning: the thaw is a milestone, the year comes round again, and
  the winter mark now points at whichever winter is actually next. Victory is a
  Thing held and carried, and the road to it is a checklist on screen from the
  first thaw onward — two winters stood, a mead hall to hold it in, no blood
  unanswered at home, somebody on the coast who will speak for you, thirty of
  food for the feast, and the whole band at the steading. Every item is a
  system Phase 4 already built, and every item on its own blocks the claim.
  Calling it costs three days and the feast whether it carries or not, and the
  odds are shown before the case is put: a band that scraped in is around 58%,
  one that did everything is 83% — capped below certainty on purpose, because a
  climax that cannot be lost is a button that says "you win". A coast you
  wronged drags a strong claim from 83% down to 58%. Carried, the run ends as a
  jarldom and the saga is titled for it; refused, there is a card to read and
  twelve days before it can be pressed again. Five winters without a title ends
  the run anyway: a life, if not a jarldom. `SAVE_VERSION` 16 with a migration.
  429 tests.
- **2026-08-06 — 4.5 The Saga** — The ending screen is now the run, retold. Six
  chapters — the landing, the country, the land-taking, the neighbours, what
  they worked out, blood — and a closing, every one of them assembled from what
  actually happened and every one of them left out entirely when there is
  nothing behind it. A band that never settled is never given a steading; a
  band that lost nobody is told so; everyone who died is named with what did
  it. The wording is picked with the run's own seed and its ending, so the same
  finished run always tells the same saga — which is what makes shipping the
  seed with it worth anything. One button copies the whole thing as plain text
  with `seed "..."` at the foot. To make it possible, the state gained a tally
  of the things a finished run cannot reconstruct about itself — fights, raids
  held, foes felled, bargains struck, parties sent, days on the water — because
  a settled battle leaves no trace and a bargain leaves only firewood.
  `SAVE_VERSION` 15 with a migration; an older run comes forward at zero and
  its saga simply omits what it cannot honestly claim. 411 tests.
- **2026-08-06 — 4.4 Knowledge** — Six things a band can work out, and not one
  of them bought. There is no research screen and nothing to spend: rune-craft
  comes off a carved boulder in the hills, iron-craft off a seam of bog ore and
  four days of failing at it, sky-reading off an old hand banking a fire in a
  particular way, leechcraft off somebody being ill — or off a woman walking up
  from a friendly camp with her own bag and explaining nothing. The other two
  are taught by things you did rather than cards you drew: finishing the dock
  teaches you how a hull is put together, and holding a raid teaches you what a
  shield wall actually is. Every entry moves exactly one existing formula and
  says so in one line on the roster: reckonings go better and the dead weigh
  less, a day on the water costs less, blows bite deeper, a night needs less
  wood, hurts mend faster and the cold bites less, a line is worth more.
  Measured: sixty identical swings deal 134 without iron-craft and 160 with;
  twenty cold nights put 101 people down untaught and 72 with leechcraft. Every
  discovery card is gated on not already knowing the thing, so it stops
  appearing the moment you have it and a failed attempt leaves the stone there
  to come back to. `SAVE_VERSION` 14 with a migration. 393 tests.
- **2026-08-06 — The sea, one button, and a face** — Three fixes off a phone
  playtest. The knarr is on the map now: a beached hull marks where you came
  ashore, and coastal water — any sea hex with land in sight — can be rowed at
  2 effort, so a coast is a road rather than a wall. Open water with no land
  beside it is still refused, which keeps the map a country to be walked
  instead of a lake to be cut across. At sea there is no forage and no
  firewood, the nets are the best they get anywhere, and a fight on the water
  is fought across lashed hulls. Second: the row of nine wrapping buttons is
  gone. One **Act** button opens the day's work as a list, each choice with a
  line saying what it does and what it costs — and the ones you cannot take
  still listed, greyed, with the ground's own reason. Third: the red dot is a
  Viking — helm, nasal bar and beard over a red shield, and a longship under
  a striped sail when the band is afloat. 374 tests.
- **2026-08-06 — 4.3 Neighbors** — The coast has other people on it, and they
  remember. Four places are seeded at worldgen — natives who were here first
  and open warm, rival Norse who came last year and open cold — each carrying
  a standing from hostile to sworn that is stored, not derived, and drifts
  back toward nothing at 0.12 a day. Stand in somebody's yard and you get two
  buttons: barter, which trades food for timber at a rate that rises across
  the whole standing range, or fall on them, which docks 45 on the spot. What
  that buys you is the milestone: the angriest neighbour on the coast adds
  directly to how many raiders come over the wall, raises how often the
  country stirs around your hall, and unlocks a raid card a peaceful band
  cannot draw at all — while a coast you have dealt with sends a basket to
  your door and word of where the ice goes out first. Tribute is a real
  lever in both directions. Measured across eight coasts: fall on your
  neighbours and they field 72 raiders against you where dealing with them
  fields 56, and the same 8 of food buys 39 of timber where an honest
  neighbour gives 130 — and four of the eight will not deal with you at all.
  Two whole seasons of drift later, the difference is still there. Raids now
  arrive with a name on them in the saga. `SAVE_VERSION` 13 with a migration.
  372 tests.
- **2026-08-06 — 4.2 Expeditions** — Once the posts are in, the steading is
  where the band lives: to go anywhere at all you send a party, and the map
  only opens up while one is out. Three purposes — look at the country, go out
  to barter, go out under arms — each changing how much finds you out there.
  The band splits in two: whoever went walks the map and fights the fights,
  whoever stayed works the steading every single day. That split is the whole
  milestone, and it cuts both ways: a hall whose warriors are three days out
  is exactly the one worth raiding, and the raid is defended by whoever
  stayed. Provisions come out of the store on the way out and what is left
  comes back; a trading party comes home with timber the steading could not
  cut for itself. Measured over eight settled years: never leaving survives 4
  of 8 with 122 wood; sending two out to barter survives 6 with 872; sending
  five out brings home the MOST timber of all — 1478 — and survives 1, because
  the fields went untended for weeks to get it. `SAVE_VERSION` 12 with a
  migration. 350 tests.
- **2026-08-06 — 4.1 Minds & feuds** — Personal morale is live at last: each
  day a person drifts toward a target built from hunger, cold, their own
  wounds, whether the job they were given suits them, and the room. Traits
  decide how hard they swing — Steadfast barely moves, Quarrelsome swings
  nearly four times as far — and each mood has a word on the roster. Traits
  also grate: a Quarrelsome and a Berserk sharing a bad week fall out, where
  a Hardy and a Leechcraft do not. Bad blood is stored by pair with the line
  that started it, deepens on hard days and fades on good ones — unless the
  band was asked about it and walked away, in which case it hardens and sits
  there. Past a threshold it becomes a card: pay the wergild, hold a Thing,
  or tell them to get back to work. Left long enough it comes to knives.
  Phase 4 sets no bar in the roadmap, so this milestone held itself to two:
  feuds come out of pressure rather than dice (over twelve bands and forty
  days, a fed band produced 0 grudges and a starving one 38, of which 12
  ripened), and settling beats ignoring (over ten bands a season on: 0 knifed
  and more mood and strength, against 3 knifed). `SAVE_VERSION` 11 with a
  migration. 334 tests.
- **2026-08-06 — 3.5 Raid defense — Phase 3 complete** — Rival clans come for
  the store and the roof, and the fight happens on the ground you built: the
  hall at your back, your fields and woods in the middle, raiders coming in
  from the open edge. The palisade runs across the approach with one gate in
  it — and it is *passable at high cost* rather than solid, which is both what
  its own blurb promised and what stops a sealed field stranding an enemy AI
  that paths by hex distance. A raider astride the stakes has one hand on them
  and no footing: 3 easier to hit, and no place in a shield wall. Raids bring
  a bigger band than a chance meeting does. Losing one means the steading is
  sacked — two fifths of the store carried off, the watch broken, and a
  building fired (the longhouse last, because it is full of people). Measured
  over ten raids at the game's own scaling: walled holds 4 and loses 5 people,
  1 building and 346 supplies; open holds 1 and loses 22 people, 9 buildings
  and 632 supplies. The wall earns its eight timber many times over and is
  still not an off-switch. `SAVE_VERSION` 10 with a migration. 314 tests.
- **2026-08-06 — The chart, and two battle-layout bugs** — A **Chart** overlay
  on the travel screen: everything the band has seen, fitted to one screen,
  with the knarr where it came ashore, the steading, where the party is
  standing, and the route actually walked. The world now records `trod` —
  the day each hex was first stood on — so the trail is history rather than
  decoration; segments join only where two steps are genuinely adjacent, since
  revisits are not re-recorded. Legend swatches are the same glyphs the chart
  draws. Two layout bugs from a phone screenshot: the battle top bar let a
  fighter's name overflow its cell and paint over the next stat (flex items
  shrink by default, which defeated the bar's own horizontal scroll — the name
  is now the label and the health the value), and the fight log reused the
  saga's expanded 46vh cap, so it grew as the fight went on and squeezed the
  battlefield down to a strip. Verified over a seventeen-round fight: no
  overlap, log pinned at 74px, field steady. `SAVE_VERSION` 9 with a
  migration. 299 tests.
- **2026-08-06 — v0.3 "Landnám"** — Phase 3 all but complete and the full loop
  closed: land, fight, settle, work, build, and hold the winter.
- **2026-08-06 — 3.4 The First Winter** — Winter is now a season you survive on
  stores rather than one you work through: six firewood a night, and a
  woodcutter at well under half in the dark. From the turn of autumn the game
  prints the mark — the food and firewood the stores must reach to see spring
  — and it is a forecast, not a rule of thumb: it walks every remaining day
  with YOUR people on YOUR jobs at the season factors they will actually
  face, so a band with everyone in the fields is told, correctly, that its
  fields are about to stop. Cold nights bring sickness that docks stats,
  drags the whole band, and will not mend while the ground is frozen. Five
  winter cards, gated on the actual state of the store, the woodpile and who
  is ill. The ending says whether the band was warned. Measured over eight
  winters: heeding the mark survives 7 of 8, ignoring it 2 of 8, and going
  into the dark with an empty store kills all 8. One long-standing bug the
  playtest caught: camping at home gathered firewood while the steading's
  woodcutters were also working, paying the same six people twice — 664 wood
  by day 72 made winter a formality. Gathering is now for the road only.
  292 tests.
- **2026-08-06 — 3.3 Needs & buildings** — Four needs read off the state and
  named plainly — food, warmth, rest, heart — each saying what it actually is
  ("seven nights of fire, and no more") rather than showing a bar. Six
  buildings, each answering exactly one of them: longhouse, farm plots,
  smokehouse, dock, palisade, mead hall. Builders' days now go into a queue
  instead of accruing abstract shelter, and what they finish changes the
  ground itself — farm plots really do raise the soil, a dock raises the
  harbour and unlocks fishing inland of the water, a palisade raises defence
  and quiets the steading, a smokehouse keeps a quarter more of everything
  caught, a mead hall lifts the heart every day. Timber is paid on queue and
  half returns on cancel, so the queue is a decision and not a scratchpad.
  Measured over six years: building what you lack survives 3 of 6 and averages
  67 days, against 1 and 49 for a fixed showy order and 1 and 60 for never
  building at all — and under three manufactured scarcities the same steading
  wants three different things first. Two design bugs the measurement caught:
  an idle builder could trickle to a FULL roof for free, which made the
  longhouse pointless; and the guard that fixed it clamped shelter downward,
  quietly demolishing finished buildings every day nothing was queued.
  `SAVE_VERSION` 8 with a migration. 271 tests.
- **2026-08-06 — 3.2 Colony view & jobs** — COLONY mode pushes over travel:
  nineteen hexes of your own ground, laid out from the site reading, so the
  local map is a picture of the choice you already made. Six jobs — farmer,
  hunter, fisher, woodcutter, builder, warrior — each leaning on one stat and
  one measure of the ground, so a site is good at some and bad at others and
  the move is finding where your people and your land agree. Builder raises
  shelter, which cuts the firewood burn; warrior keeps the watch, which decays
  the moment nobody stands it and which makes the steading quieter while it
  holds. The season owns the fields entirely and the watch not at all: a
  farmer in midwinter produces almost nothing, which is what stops the colony
  from making the clock meaningless. Labour resolves only on days the band is
  home — walking away from the farm costs you the farm. Measured over four
  settled years on ground a careful player would pick: a balanced steading
  survives 3 of 4 and averages 67 days, all-farmers freeze at 43, all-cutters
  starve at 23. `SAVE_VERSION` 7 with a migration. 246 tests.
- **2026-08-06 — 3.1 Land-taking** — Every hex you stand on is read on five
  measures: fresh water, soil, timber, harbour and defensibility, each 0–5,
  each derived from the hex AND its ring, because a steading is not one hex —
  it is the walk to the river, the walk to the woodpile, and the ways in you
  cannot watch at once. The five are in structural tension: good farmland is
  open ground and open ground cannot be held (soil/defence correlate at
  −0.55, timber/defence at −0.75), and across 7,769 hexes there is not one
  that scores 4+ on all five. No fresh water is a hard refusal — half the
  land is unsettleable — and the readout leads with the refusal rather than
  a verdict that promises what the gate denies. Founding is one way: the card
  names the site's strength and its weakness, says out loud that there is no
  second steading, and can be walked away from. The place names itself from
  what it is best at, so a Ravavík is a harbour and a Steinborg is a crag.
  Home ground then pays the promise back: soil doubles what you forage there
  (186 against 93 over twenty days), timber pays out in firewood, a night
  under your own roof mends more, and a defensible site is a quieter one —
  fewer things walk up on you, and what does is a whole enemy easier.
  `SAVE_VERSION` 6 with a migration. 220 tests.
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

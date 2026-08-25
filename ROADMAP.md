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

> **CURRENT MILESTONE: Phase 7 — the Unreal build. Item 1 is DECIDED
> (C++), item 5 (parity CI) is BUILT on both sides, and BOTH SCRIPTED RUNS
> ARE GREEN END TO END: `PARITY OK — 39 checkpoints across two runs, six
> facets each`, 1478 actions and 457 days on `runs/long.json` and 66 actions
> to day 15 on `runs/example.json`, with `unported=0` — nothing anywhere in
> either was skipped.**
>
> **Re-earned on 2026-08-21 after five days of drift.** The figures above
> read "41 checkpoints, 1320 actions" until then, and were true when written;
> the recorded runs have since been re-recorded and the sim has moved. The
> workflow went red on 2026-08-19 the moment the contract sync started
> handing the port CURRENT vectors instead of the stale ones it had been
> grading itself against, and it stayed red until today. Four rounds of
> causes, all in the changelog: two generator bugs in the TypeScript repo, a
> stale hardcoded checkpoint list in the port's own harness, four unported
> features (weather, short commons, cold nights, the `wound` effect), and
> three separate copies of the mouths formula collapsed into one.
>
> **AND IT HAS NOW RUN IN A REAL UNREAL EDITOR — both automation tests pass.**
> `Landnam.SimParity`: sim.day 308 checks, sim.landing 40, sim.coast 10,
> sim.band 10, sim.worldgen 5, canonical 33. `Landnam.Parity`: rng.streams
> 3300, hex 2830, rng.hashString 17. Nothing in the port is unverified any
> more.
>
> **THE TWO LINES ARE MERGED.** The island worldgen, `LandnamNoise` and
> `BP_HexGrid` now sit on the same branch as the rules port. The one
> conflict was `golden.json`, and it was worth having: the `worldgen`
> vectors existed only on the Unreal side, owned by nobody. They are owned
> and recomputed here now.
>
> **THE PORT WAS PAUSED ON PURPOSE (2026-08-17), AND THAT PAUSE IS OVER —
> not by decision but by arithmetic.** Evan's call was to polish the
> TypeScript build first and carry more into C++ later. What that missed is
> that the reference kept moving: a paused port beside a live reference is
> not a stopping point, it is a widening gap, and by 2026-08-19 the two
> builds disagreed about the map on day one. The port is caught up now and
> the pause cannot simply resume — anything that changes the sim has to be
> carried across in the same breath, or the workflow goes red and says so.
> That is the contract sync working as designed rather than a new burden.
>
> The item below is what the port's own FEATURE work resumes on, whenever
> that is; keeping parity green is not optional in the meantime.
>
> Ten candidates were surveyed against the live tree on 2026-08-17 and
> written up in chat. FIVE are DONE and in the changelog: terrain you can
> tell apart without reading the colour; a repaint that costs what changed
> instead of what is on the map; `dvh` in all seven ceilings; a pinch that
> holds the point between your fingers; and a game you can feel in the hand.
> The place economy's INSTRUMENT is fixed too — the bot can reach a market
> now — which leaves the design half of it waiting on a decision rather than
> on a measurement (see the autopsy below).
> Landscape has rules now too — a phone on its side lays out in two columns
> and the map keeps 88% of the height instead of 32%. The battlefield item
> turned out to be **the wrong worry**: the field was never squeezed to a
> strip, but a battle hex fell to 45px on a small phone against a 44px rule,
> and 320px-wide screens cannot reach 44px at all without the field learning
> to pan. **ALL TEN ARE DONE.** One-thumb reach was audited last, over ten
> surfaces: every target clears 44px and the action bar sits at 92–97%, but
> the Act sheet was putting Camp — what a player does most nights — at 25%
> of the screen, in the band where the hand has to shuffle. Overlay cards
> are bottom-anchored on phone widths now and it sits at 38%.
>
> **Both of the two that were left are now closed.** The 320px battlefield is
> DECIDED and BUILT (2026-08-21): it pans, and a hex clears 44px at every
> width. And the place economy's design half is ANSWERED (2026-08-22): the
> market is not under-visited by mistake — visiting it more is worse every
> way it was measured, the gate is the harness's rather than the game's, and
> three-quarters of all counter volume was the band selling its own winter.
> Both are Evan's call. And the port resumes on the worldgen adapter.
>
> **Two bugs came back from a real phone on 2026-08-18 and both were real.**
> The terrain patterns were being sliced by hex edges — the tile is the hex
> lattice now, and no mark may reach past the inradius. And a settled
> steading with an empty store had NO legal action that could get food: it
> cannot forage at home, and the expedition that would have fed it was
> refused for want of the provisions it was leaving to find. Neither was
> reachable by any harness here, which is worth remembering before trusting
> a green suite about how the game FEELS.
>
> **The `dvh` half is the one thing here that has NOT been observed working.**
> Headless Chrome has no URL bar, so `dvh` and `vh` resolve identically and
> the overflow it fixes cannot be reproduced in this harness. What is checked
> is that all seven rules survive minification with the `vh` fallback intact,
> that the browser accepts the unit, and that nothing overflows now. Whether
> the panels stop overshooting on a real phone is a thing only a real phone
> can say.
>
> **A correction worth keeping, because it was stated confidently and was
> wrong.** The repaint item was pitched as "late game that is most of 1,872
> hexes rebuilt per action". It is not. Both scripted runs settle on day 11
> and stop walking, so their charts hold **78** hexes for four hundred days,
> and a band that keeps travelling was measured charting 130–200 before it
> starved. The cost was real and the fix was right, but the number was
> invented rather than measured, and the measurement was there to be taken.
> `test/repaint.test.ts` now takes it.
>
> **NEXT IN THE PORT, when it resumes: one algorithm still exists twice.** `Source/LandnamUE/
> LandnamWorldgen.cpp` (UE-typed, Blueprint-facing) and
> `Sim/LandnamSimWorldgen.cpp` (plain, used by the port) are the same generator
> transcribed twice. Both are now pinned to the same eight golden worlds, so
> neither can drift in silence — but the fix is for the UE one to become a
> thin ADAPTER over the sim one, keeping `FWorldTile`, `FLandnamWorld` and
> the four `UFUNCTION`s exactly as Blueprints see them and replacing only
> the bodies. **Both prerequisites are DONE as of 2026-08-22** (landnam-ue
> `54d10c0`): `Sim::GenerateWorld` reports `Attempts` and `bValid`, and
> `ULandnamRng::GetState()` exists so a live generator's POSITION can be
> carried across — seeding from `GetSeed()` alone would rewind it and build
> a different island. Parity stayed green through both. A third unknown was
> settled on the way: the sim inserts tiles `for Row { for Col }`, which is
> the row-major offset order `FLandnamWorld.Tiles` documents, so the
> conversion can copy in order.
>
> **The adapter itself is deliberately NOT written, and this is not a
> deferral for lack of time.** It cannot be verified from a container with
> no Unreal and no UnrealHeaderTool: `Tools/run-parity.sh` compiles only
> `Sim/`, which is exactly why that core is kept free of Unreal, and the
> Blueprint-facing file is covered only by the in-editor automation test.
> A hundred lines written blind into the path that feeds the game's map
> would be found by whoever next opens the editor. Compiling it behind a
> stub Unreal was considered and rejected: UHT parses those macros
> separately and generates the `.generated.h`, so a shim that compiled
> would prove syntax while LOOKING like verification — a fourth hollow bar.
> It is an hour's work for anyone with the editor open, and nothing is in
> its way now.

---

## Where we are now

*This section is the living head of the document: it is rewritten whenever it
stops being true, unlike the changelog below, which is append-only history.
Anyone — or any future session — should be able to read this and the "dead
ends" table and pick the work up without re-deriving a day of measurement.*

### STATE AS OF 2026-08-21 — read this paragraph before any figure below it

**Both repos are green and pushed.** `npm test` 1072/1072 across 62 files,
`tsc` clean, the site published. The port reaches **PARITY OK — 39
checkpoints across two runs, six facets each** for the first time: 1478
actions and 457 days on `runs/long.json`, 66 to day 15 on
`runs/example.json`, `unported=0`. The Parity workflow on `landnam-ue` is
passing.

**The difficulty curve is 87% / 72% / 23% to spring** (fair / even / hard) and
97% / 92% / 83% to the first winter, restated 2026-08-22. **ANY curve dated
before 2026-08-22 is superseded**, and this is the second such restatement:
the first was 2026-08-20, when the bot learned to use the winter lever. This
one is bigger. The bot held out for good ground on a FIXED floor and so never
settled at all in 45 of 120 seeds — it died walking, with the posts still in
the boat, and every figure this project has published was read off that band.
It gives way as winter closes now. The winter marks are properly ordered for
the first time as a result (83 was tied with 82 before). `src/data/hardship.ts`
holds the numbers and the menu generates its prose from them — never hand-type
an odds sentence.

**Four measured facts not to re-derive.** Each cost a day and each is written
up in the changelog with the seeds and the paired counts:
1. **Reading the winter mark and moving hands to what it says is short is the
   biggest lever in the game** — 21/120 → 48/120 seeing spring, saved 30 and
   killed 3. Bigger than anything else measured. `src/sim/counsel.ts` is the
   panel that finally says so.
2. **Short commons saves 14 and kills 1** over 120 paired landings.
3. **`readiness()`'s escape hatch — raiding out — saves nobody**, and so does
   **walking out** (50 retreats, saved 0, killed 11). The retreat verb ships
   anyway and the panel does not recommend it; the reason is in
   `src/data/retreat.ts`.
4. **Re-crewing by SEASON on top of crewing by need changes nothing** — 236
   hands moved over 120 seeds, not one seed's outcome altered.

**Open threads, in the order I would take them:**
- **Waiting on a human, not on code:** `Content/Data/foes.uasset` and
  `terrain.uasset` in the port need a re-import in the Unreal editor. The
  JSON beside them is generated and correct; the assets are LFS binaries and
  the import is a manual editor step. Until then the DataTables still hold
  four foes and no renown column. See `port/sim.md`.
- ~~**The other long files.**~~ CLOSED 2026-08-21: all three followed
  `winter.ts`'s template the same day — `battleActions.ts` into the swing,
  the strikes, the footwork and the cry; `main.ts` into the router, the
  shell, the chrome and three mode screens (verified in a real browser,
  since no unit test reaches it); `travel.ts` into the reducer, the road
  and the gathering. Every split found a stranded doc comment, four for
  four. The three commits and the changelog entries have the detail.
- ~~**Audit #8, the coast remembering the ghost.**~~ CLOSED 2026-08-21, and
  the premise it was built on was the opposite of the guess. The fear was
  that a band never walks onto the ruin at all; measured, they take it in
  about half of all haunted runs (15 of 30 settler sagas, 87 visits). What
  never happened was the RECORD naming them: 0 takings out of 17 wrote whose
  steading it was. Fixed, plus a bug the fix would otherwise have shipped —
  the band's own abandoned hall is a ruin too. See the changelog.
- ~~**The retreat verb's real case is unmeasured**~~ CLOSED 2026-08-21.
  Measured, and the verb has no case even in the best one the game can be
  made to produce: a band taking the FIRST legal ground still measures
  **saved 0, killed 11**. The "worse-settling bot is a strawman" objection
  did not survive contact — `siteFloor` is a dial the Policy type already
  exposes and RAIDER already sets to 7 — and the case itself is thinner than
  it looked: only 0.5% of foundable ground scores below "Hard ground".
- ~~**NEW, and it is Evan's call: the settler bot's `siteFloor` of 9**~~
  DONE 2026-08-22. The bot gives way as winter closes now, and **every
  hardship figure in this document dated before 2026-08-22 is superseded**
  — read 97/92/83 to winter and 87/72/23 to spring. See the changelog.

**How this project works, and it is not optional.** Measure the premise before
building: five design intuitions died on contact on 2026-08-20 and four
artifact comparisons survived, and that ratio has held all month. Watch every
bar fail before trusting it — this file records three hollow bars that passed
while measuring nothing. Two things not to do: lower a bar so a change
passes, and commit with the suite red. Before any commit: `npm test` and
`npx tsc --noEmit`.

**Traps that have each cost real time:**
- `scripts/*-tables.ts` emit C++ from TEMPLATE LITERALS — a backtick in a
  comment you add is a syntax error, twice now.
- `settleNotBefore` in `test/balance.test.ts` is module-level and shared
  across a whole sample; a per-run hold belongs in its own variable, reset in
  `run()`. Getting this wrong read as "killed 46" off three retreats.
- `Tools/run-parity.sh` stops at the FIRST failing script, so a green
  `example.json` proves nothing until you run it alone with `RUNS=`.
- When a facet's size matches and its hash does not, it is a VALUE, and
  `LANDNAM_DUMP=<action>` prints the canonical bytes to find it. Three
  separate one-value divergences were found that way and none was findable
  otherwise.

**Shipped:** Phases 0–4 complete. 5.1 Sound, 5.2 Onboarding and 5.3 Balance &
juice are done. **Phase 6 is complete**: 6.2 Hands, 6.3 Overwhelming force
and 6.4 No last winter are all in, and 6.1 Winters that vary shipped and was
measured at no change to the curve — it is a prerequisite for 6.2 rather
than a fix on its own, and is left at `[~]` to say so honestly.

**The audit of 2026-08-11 is finished** — all ten items, two of them bugs
shipped in the last two days, and item 9 turned out to be a fault in the
instrument rather than in the game.

**Raiding is a way to play now** (task 31, closed 2026-08-12): the hands
hold their own hall when a raid comes to the yard, which frees the whole
sworn band to go out, and an open-field fight is decided by how many stood
in the line — 9% of camps won with three, 47% with six. Raider second
winters went 3/30 to 7/30, level with the settler. The strandhögg is still
unreached (3 in 120 sagas) and that is a question about the PLACE economy
rather than about raiding — see task 33 in the changelog.

**Hardship reaches combat now** (2026-08-13). `steel` on `HardshipDef` — +1
fair, 0 even, -1 hard, added to our swings and taken off theirs — is in, and
the curve is properly ordered at both marks for the first time: 87/78/73 to
the first winter, 62/27/12 to spring. What had blocked it for a day was a
`markets` floor that turned out not to be measuring reach; the section below
is the autopsy, and it is worth reading before trusting any other count in
this document.

**Those spring figures are superseded as of 2026-08-20 — read 73/45/10, not
62/27/12.** Nothing got easier. The harness bot started pulling the winter
lever, which is signposted on the steading panel the moment the mark says the
stores are short, so every curve in this document below that date is the game
as an inattentive band plays it. The winter mark reads 88/82/82 now, and the
last two being equal is the honest reading rather than an ordering: with the
belt in hand the harder countries fail at the thaw rather than at the frost.
`src/data/hardship.ts` carries the restated numbers and the menu generates
its prose from them.

**The place economy was measured to the bottom on 2026-08-13, and the finding
went three layers deep.** Places are not consumed, they are never LEARNED (11
of 120 emptied; 42 known and still standing). Widening word of mouth is a
measured null — the tap is the number of bargains, not the width of the pipe.
Landmark-sighting from high ground fixed discovery (first sighting day 74 →
46) and moved no downstream verb. And the last link was that the harness
never aimed at a market.

**That last link is FIXED as of 2026-08-18, and the answer changed shape.**
The bot can walk to a known counter and deal there now; counter bargains
went 10 → 195 over thirty settler sagas and settled days 3,709 → 4,261. The
2026-08-13 warning that this "rewrites every figure in this document" turned
out to be false — the errand is gated behind the first winter, so the
hardship curve (87/78/73, then 62/27/12) did not move by a single point, and
all 83 balance assertions passed untouched.

**That design question is ANSWERED as of 2026-08-22, and the answer is no.**
The gate turned out to be the HARNESS's, not the game's — `!hasSpeakers`, the
winter and the surplus are all `test/balance.test.ts`, and the only rule the
game imposes is `launchBlocker`. So "under-visited" was a statement about the
bot, which goes to market to find somebody to speak for it and stops once it
has them. Measured over 60 sagas to day 400, opening it is worse every way it
was tried, and even a PLACEBO errand that deals nothing is worse: two hands
away from the steading is a real cost that no trading recovers. And
**three-quarters of the volume the market has ever produced was the band
selling its own firewood** — the resource winter kills it for. Reach was never
the constraint; the trip is. See the changelog.

**Phase 7 is the Unreal build, and it is under way.** Item 1 is decided: the
rules get rewritten in C++, the TypeScript becomes the reference
implementation and the balance lab, and `port/sim.md` is the contract that
makes the second half of that true. Item 5 exists on both sides. Stages 1–4
are green — worldgen, the party, the coast and the rest of the landing — so a
new game in C++ matches a new game in TypeScript across all six facets. **The
first rung of stage 5 is green too: the C++ can spend a day.** `apply`,
`MOVE` and the unsettled `passDay` match every facet at `runs/long.json` @1,
@2, @3 and @5, which is the first time the two builds have agreed about
something that happened rather than about a state that was generated.

The port's method is worth keeping: the sim core in `landnam-ue` is written
FREE OF UNREAL, so the identical translation unit compiles in the editor and
in a standalone harness run against the vectors with nothing but `g++`. Every
stage has been compiled and checked rather than read over, and that has caught
FOUR portability traps reading would not have — a precedence error in
mulberry32, a NUL byte in the hash salt, `localeCompare` not being code-unit
order, and the epsilon nudge in `line()` that decides what a forest hides.
All four are written up in `port/sim.md`, and the harness that found them is
committed now as `Tools/run-parity.sh` rather than rewritten each stage.

**Not yet verified:** `Landnam.SimParity` has never been run in a real editor.
The sim core is proven by compilation here — every line of it, against the
vectors — but the UE-typed glue around it is not, and stage 5 added about a
hundred lines of that. Expect ordinary first-compile friction there, not logic
errors.

### OFF THE BENCH — hardship reaches combat, and a floor that was measuring nothing

**Asked for, built, measured, reverted, and then landed a day later once the
thing blocking it was understood rather than worked around.** The change is
four edits; the finding underneath it is worth more than the change.

**The ask.** Hardship touched `stir`, `raid`, `winter` and `stores` and
nothing about a fight, so A Fair Country made fights RARER and left every
blow exactly as hard to land as A Hard Country did. A player who reaches for
the gentlest setting because the fighting is going badly was handed no help
with the fighting. Easiest should be easier combat, medium equal, hardest
harder.

**What shipped.** `HardshipDef` gains `steel` (`fair: 1`, `even: 0`,
`hard: -1`); `edge()` in `src/sim/battleActions.ts` adds it to our to-hit
roll and takes it off theirs, so one point is worth two across the field.
On the STRIKE only — the thrust already carries `REACH_PENALTY` and the
thrown spear rolls off wits, and that scope is recorded at the function.

The licence for letting a difficulty this deep in is one line: **`newGame`
defaults to `BALANCED_HARDSHIP`, where `steel` is 0**, so `test/wall.test.ts`
and the whole battle suite are played on terms where the knob does not exist.
The setting moves the player's fights and touches none of the measurements.
`test/hardship.test.ts` now asserts that zero, because the day it stops being
true is the day every battle figure in this repo silently moves.

Measured on the same sixty landings each, and properly ordered at BOTH marks
for the first time — it could not be ordered at the winter mark before,
because every country's blows landed alike:

| setting | reached the first winter | saw spring | long game (20 sagas) |
| --- | --- | --- | --- |
| A Fair Country | 87% | 65% | 153 days a saga, 11 mead halls, 4 jarls |
| As It Lies | 80% | 28% | 82 days, 4 mead halls, 1 jarl |
| A Hard Country | 73% | 12% | 61 days, 0 mead halls, 0 jarls |

**Why it was reverted the first time, and what that turned out to be.**

It broke the content-reach probe: `markets` fell from 14 to 2 against a floor
of 3, verified as caused rather than assumed — a clean tree reads 14. The
hypothesis on the bench was that easier fights mean more bands survive to
SETTLE, and a settled band stops walking past the trading places.

**That hypothesis is false, and the measurement says so flatly.** Settle-rate
and days-on-the-road are now reported per arm by the probe itself:

| A Fair Country, 30 landings | without steel | with steel |
| --- | --- | --- |
| settled | 28/30 | 28/30 |
| average founding day | 13.1 | 13.1 |
| days on the road | 460 | 432 |
| **sagas that reached a counter** | **4/30** | **4/30** |
| ...while it was still trading | 4/30 | 4/30 |
| market DAYS | 14 | 2 |

Bands settle at exactly the same rate, on exactly the same day, and walk
nearly as much. Reach did not move at all.

**What the floor was actually measuring.** Six of sixty sagas ever stand at a
counter, before and after. Of those six, TWO ever dealt — and twelve of the
fourteen market days came from a single band that settled beside a live
counter and traded over and over. A trade day multiplies with however long
one band loiters, so the floor of 3 sat on a statistic with an effective
sample of ONE SAGA. It passed on the clean tree by luck and failed on the
changed tree by luck, and neither reading was ever about whether the game's
markets can be got to.

The mechanism behind the specific drop is real and is not a reach problem
either: a band that wins its fights arrives at the trading town with five
sworn still on their feet instead of four, which trips the harness bot's own
`mighty` rule, so it sacks the town on day 16 rather than dealing there
twelve times. *Steel ends a market* — `tradeBlocker` returns `taken` forever
after. That is the bot preferring plunder to a counter. It is a fact about
the bot, not about the game.

**So the floor was re-derived rather than moved.** It is a count of SAGAS
now, with the reasoning written into `test/balance.test.ts`: how many of
sixty landings ever stand at a counter that is still trading. Same numeral —
3 — on a sample of sixty instead of one, and strictly HARDER to satisfy by
luck, because three trade days can come from a single band in an afternoon
where three sagas cannot. Set at half the measured six, because this probe is
a collapse detector and not a tripwire for the dice. A second bar keeps the
system honest: somebody, somewhere in the sample, has to actually deal.

**The lesson, which generalises past this change:** a count of DAYS is not a
count of reach. Any bar over an event a single long-lived saga can repeat has
an effective sample of one, however large the total looks. This is the jarl
count's lesson (below) arriving a second time through a different door, and
the probe now prints the per-saga distribution beside every total so the next
one is visible at a glance rather than after a day of measuring.

**The legibility half also landed**, and it was always independent.
`carrying()` in `battleActions.ts` names the wound dragging a swing — "Ribs
stove in, and the swing showed it" — appended to the glance and shield-turned
lines and nowhere else, because a hit needs no excuse and a wound recited on
every swing stops being read by the second fight. MIGHT only, because might
is what is in the roll; a lost eye is a real wound and it is not what made
this blow go wide. Measured cause: a fresh band lands 76% of its swings and a
worn one 59%, while foes are generated whole for every fight and never carry
a wound — so the game was taking a point off the dice and telling nobody.

**The measured curve** (a scripted player of roughly average competence over
SIXTY seeds — see `test/balance.test.ts`, which is the source of every number
in this document. It resolves to about ±5 points; anything smaller than ten
points is below what it can see, so treat every figure here as directional):

| milestone | reached |
| --- | --- |
| the first winter (day 49) | 82% |
| spring (day 73) | 25% |
| the second winter — the Thing's window (day 169) | 7% |

**The three countries, measured on the same sixty landings each** — and the
default is deliberately NOT the balanced one:

| setting | first winter | saw the first spring | over 500 days (20 sagas) |
| --- | --- | --- | --- |
| A Fair Country *(default)* | 87% | 62% | 153 days a saga, 11 mead halls, 4 jarls |
| As It Lies *(what everything is tuned against)* | 78% | 27% | 82 days a saga, 4 mead halls, 1 jarl |
| A Hard Country | 73% | 12% | 61 days a saga, 0 mead halls, 0 jarls |

**Re-read 2026-08-13 with `steel` and landmark-sighting in, and the whole
table is a fresh sweep** — the spring column moved 1-3 points when bands
started spotting landmarks from ridges, which is inside what this harness
resolves and was left alone rather than tuned back. The long-game column did
not move at all.
The spring figures were
60/25/7 before hardship reached the dice of a fight, so the gaps went from
35 and 18 points to 37 and 16 — no wider in truth, but the FIRST WINTER
column is new and is the real gain. It could not be ordered at all while
every country's blows landed alike, and a difficulty a player feels in the
first fifty days is worth more than one that only separates at spring.

**The jarl counts in that last column are not readings.** A jarldom happens
once or twice in twenty sagas, and 2026-08-10 established the hard way that
a count that small will swing by a factor of three on nothing at all — see
the changelog. At sixty seeds an arm the same measurement gives 5 jarldoms
in 120 sagas. Treat the column as "does the endgame happen", never as a
number that moved.

`DEFAULT_HARDSHIP` and `BALANCED_HARDSHIP` are separate constants on purpose.
"As It Lies" stays the terms every fixture measures; pointing `newGame`'s
parameter default at the menu default would have moved the baseline of the
whole suite the moment the menu changed, with nothing failing to say so.

These are not yesterday's figures, and the game did not change: the
instrument did. Every earlier curve was read off a run loop that treated a
refused action as the end of the saga, under a bot that proposed battle
moves without costing the ground — so HALF of sixty runs were cut off
mid-battle, one as early as day 7, and every one counted as alive at every
milestone after. 83/55/50 was those truncated sagas. The bot now forms a
line while advancing (the rule `test/wall.test.ts` always said wins) and the
loop plays every fight to its end; the same game, honestly played, read
78/30/7 when that was fixed, and 83/30/7 today.

**Raiding is now a way to live, and it is still not the best one.** Work
started on the item-7 finding (2026-08-09). What shipped: hauls worth the
reprisal, camps that put their stores back over a season so plunder is a
CIRCUIT rather than four one-off events, a bot that actually raids as a
strategy (0.3 sackings a saga to 2.5), and a second door on the hall — a
feared band with something to show draws fighting men who fill a gap in the
wall, where a peaceable one draws hands. That last is what stopped the death
spiral: `DRAW_ANGER` shuts the settler door as the coast turns, and a raider
who loses four sworn a saga could not replace one of them.
Then the ship, which turned out to be the sharpest finding of the lot: **the
knarr was never faster than walking.** A day is `ceil(effort / 2)`, land is 1
or 2 and `SEA_EFFORT` is 2, so every hex of everything rounded to one day —
the hull was exactly as quick as a meadow and no quicker than a forest, while
the guide told the player it "rows coastal water faster than legs walk". It
does now: `ROW_REACH` hexes of coast in the day legs take to cross one.

**It is still not the best line, and the reason is now a design question
rather than a missing mechanic.** Raiding gets a band to spring exactly as
reliably as turtling (25/30 both) and no further: second winters read 20/30
for the turtle against 4/30 for the raider. Sorties went from 23.9 days to
15.7 and doubled in number, and **sackings did not move at all** — 1.9 a
saga either way, because most sorties come home empty. Trip length was not
the binding constraint.

What the measurements point at is structural: a raid costs a settled band
**28% of its labour-days with half the household away**, whatever the trip
length, and the steading needs those people. Historically nobody raided like
that — a warband went in ships, in season, and the farm ran on the people who
stayed. Making raiding win probably means a warband that is not simply
half the household on loan. That is the next question, and it is a design
decision rather than a tuning pass.

**The autopsy (2026-08-12), which moved the answer.** That paragraph rested
on a cost — 28% of labour-days — that nothing had checked was the binding
one. Two probes now follow every armed errand the raider flies and put the
strategy to the game with the harness's own scruples removed
(`where an armed sortie dies`, `can a raider actually live by it`).

The labour cost is **not** what binds. Over 5,982 settled days the errand
was refused for a thin store on 1% of them; it launched on 0.4%. The rest
was the conjunction: 53% of those days failed on the bot's own
`wintersStood >= 1`, 17% on its own in-season rule, 15% on nothing being
worth taking. More than half of "raiding is rare" was the harness's
scruples, not the game's economy — so none of the earlier raiding figures
measured whether a band CAN live this way.

Removing the scruples answers it, and the answer is no, sharply:

| 30 landings, A Fair Country | winter | spring | 2nd winter | avg days | dead by steel |
| --- | --- | --- | --- | --- | --- |
| raider as it was | 29/30 | 25/30 | **3/30** | 107 | 42 |
| 5 sworn a trip | 29/30 | 25/30 | **3/30** | 112 | 46 |
| unleashed (5 sworn, any season, from day one) | 12/30 | 6/30 | **3/30** | 60 | **59** |
| turtle, for scale | 30/30 | 26/30 | **21/30** | 169 | 41 |

Three readings, and the third is the design finding:

1. **A bigger party fixes the errand and not the strategy.** Sending five
   instead of three halves the wipe rate (67% → 25% of errands end with
   nobody coming back) and nearly doubles the haul (25.3 → 43.2 stores).
   Second winters do not move at all, because at ~1.5 errands a saga the
   errand is not what the run is made of.
2. **Raiding more is strictly worse.** The unleashed arm loses first
   winters 29/30 → 12/30 and half its lifespan. The bot's caution was
   load-bearing.
3. **And it dies by STEEL, not by hunger** — 59 dead on the field, the only
   arm where steel outranks the season. So the cost that binds is not the
   labour the errand takes away. It is that **a raid is fought by the same
   six people whose survival is the entire run.** Losing two of them is not
   a setback, it is the end, and no haul of 43 stores prices that.

That points at the standing warband after all, but for a sharper reason
than the write-up above gives: not because raiders are your farmers —
because they are your *only people*. A hird that is separate bodies, drawn
by fame and replaceable by it, makes a lost raid cost the warband instead
of the colony. Repeatable risk is what lets raiding compound into a living;
today every raid is staked against the run.

Still Evan's call, and still a design decision — but it is now a decision
with the alternatives ruled out rather than assumed.

**Option D was built and it did not work (2026-08-12).** The chosen next
step was the cheap test of the risk-isolation thesis: give a raid a line of
retreat, so a lost one costs the haul and not the crew.

It could not be built as scoped. The ship was meant to be the escape route,
and raids are never fought off the water — **3 strandhöggs in 120 sagas**,
and not one stake-fight afloat on an armed errand in either arm of the
autopsy. A retreat-by-ship would have been a retreat from something that
does not happen. (That the strandhögg is unreached in play is its own
finding, and it is a content-reach problem rather than a raiding one.)

So the thesis was tested on the fights that DO occur. `rollFate` grew a
third case: `held` when you keep the ground, `overrun` when you lose ground
you had to stand on, and `withdrew` when you lose a fight you went out to
pick — a band that chose the fight can break it off; a band in its own yard
cannot.

The mechanism works and the thesis is dead:

| 30 landings, A Fair Country | before | after |
| --- | --- | --- |
| raider, dead by steel | 42 | **28** |
| raider, sackings a saga | 1.9 | **3.0** |
| raider, alive at the end | 2.8 | **4.1** |
| raider, second winters | 3/30 | **3/30** |
| 5 sworn, second winters | 3/30 | **4/30** |
| turtle, second winters | 21/30 | **21/30** |

A third fewer men die on the field, bands raid half again as often and end
with more people standing — and whether a raider lives to a second winter
does not move at all. Four candidate causes are now measured and dead:
the labour cost (1% of days), the party size, the raid rate (worse), and
the lethality. What is left is the exchange rate itself: a raid pays about
43 stores and buys permanent enmity, against a farm that simply works. The
haul was dismissed earlier as a lottery ticket on a run-ending bet — with
withdrawal in, that objection is weaker, and pricing is the last lever
standing before the hird.

The withdrawal rule is KEPT regardless of the raiding question, because it
is right on its own: two thirds of armed errands used to end with nobody
coming back, and a fight the player chose to pick should not annihilate the
band that picked it. All 838 tests hold with it in.

**The haul cannot be priced, and the fifth cause is the real one
(2026-08-12).** The last lever before the hird: multiply what camps and
places hold and find the price at which raiding pays. There is none.

| 30 landings, A Fair Country | 2nd winter | days | stores at the end | morale | coast anger |
| --- | --- | --- | --- | --- | --- |
| turtle | **21/30** | 168 | 280 | **65** | **1** |
| raider, haul ×1 | 3/30 | 99 | 99 | 19 | 49 |
| raider, haul ×2 | 3/30 | 99 | 108 | 19 | 49 |
| raider, haul ×4 | 2/30 | 96 | 117 | 18 | 52 |
| raider, haul ×8 | 2/30 | 95 | 147 | 16 | 55 |

Eight times the haul is a single camp yielding 894 stores — months of
eating — and it makes the raider slightly WORSE. The knob was proved live
first (112 → 224 → 447 → 894 from one camp) so this is a real null and not
another dull probe.

Which finally names the binding constraint, because the last two columns
never move with the haul and never stop being the difference: **the raider
dies at morale 19 on a coast that hates it, and the turtle lives at morale
65 on a coast that does not.** More plunder buys more anger — 49 to 55 —
and anger buys reprisal, and reprisal costs heart. The cost of raiding is
paid in morale and in enmity, and neither is purchasable with stores. That
is why every supply-side lever failed: bodies, party size, rate, lethality
and price were all answers to a question the game was not asking.

**And there is a gap that fits the symptom exactly.** `sim/plunder.ts`
contains no morale line at all. A sacked camp pays food, firewood and
sometimes a thrall, and NOTHING to the band's heart — while a sacked place
pays `def.loot.morale`, a lost fight costs 15 plus bereavement, a sacking
of your own steading costs 14. Camps are the repeatable circuit the whole
"raiding as a life" design rests on, and coming home from one loaded does
not lift the band at all. Glory is missing from the one act the game is
named for.

So the next thing to try is not the hird and not a bigger haul: it is
paying a raid in RENOWN, and raiding a coast that is not the one you live
on. Both are cheap, both are historically true, and neither has been tried.

**Glory was tried, and it found the actual answer (2026-08-12).** Camps now
pay `plunder.morale` — 9 off a camp, 12 off a hall, scaled by how full the
place was, matching what a sacked PLACE has always paid. Swept at 0, 6, 12,
20 and 30, the raider's numbers came back **identical to the digit**: second
winters 3/30, morale 19, anger 49, every time.

Because `sackCamp` almost never runs. Counted:

| the fights the raider PICKS, 30 sagas | fought | won |
| --- | --- | --- |
| camps, three sworn | 85 | **4 (5%)** |
| camps, five sworn | 59 | 7 (12%) |
| camps, five sworn in any season | 56 | 11 (20%) |
| fixed places, three sworn | 15 | **0** |

**Falling on a camp is a fight the band loses nineteen times in twenty**, and
that is the whole of task 31. Every lever tried sat behind this gate: the
haul cannot be priced because it is almost never collected, glory cannot be
paid because the payment runs four times in thirty sagas, a bigger party
moves 5% to 12%, and raiding more only loses more of the fights you picked.
And `REP_RAIDED` is docked at the DECISION, not the outcome — so the band
pays the coast's memory a hundred times and is paid back four. That is not
a strategy that needs pricing; it is a tax.

The design question is finally the right one, and it is not the hird:
**should falling on a camp be a fight the band can win?** Camp might rises
every time you sack one (`might + 1`, capped at 4) and `raidTarget` only
offers camps to a roster of five while the bot sends three — so the fight is
sized for a band that never shows up. Sizing the fight to the party that
actually arrives is the next thing to measure.

The renown payment is KEPT even though it moved nothing measurable, because
the asymmetry it fixes is real — a sacked place paid heart and a sacked camp
paid none — and it goes live the moment camps become winnable. Said plainly
here so nobody later reads it as a change that was shown to work.

**Two things this work cost, recorded rather than buried.** The settler
briefly gained armed sorties and the long game answered at once: jarldoms
fell from five in forty sagas to none, because a steading-first band that
spends its summers away from the steading is not one. `raidReach: 0` is the
settler's IDENTITY now, not a limitation. And even with that put back, the
long game read thinner than it had that morning — **1 jarldom against 5** —
which I could not attribute to any one of the day's changes and did not
pretend to have explained, noting only that twenty seeds is a thin
instrument for an event that happens once or twice in it.

**That regression was not real, and the widening proved it (2026-08-10).**
Sixty seeds an arm — three times the sample, same code — against the same
measurement on `e1b9c9c`, the commit before the day's raiding work:

| 120 sagas | before the raiding work | after |
| --- | --- | --- |
| became jarl | 2 | **5** |
| saw a second winter | 12 | **15** |
| raised a mead hall | 26 | **35** |
| made a friend | 7 | **21** |

Every count moved the other way. Nothing had regressed; twenty seeds had.
The lesson is the one this project keeps relearning from the other side: a
thin instrument does not merely fail to see an effect, it invents one, and
it is just as convincing either way. The long game now says so in the file,
and carries a seed knob so the next person can widen it in one command:
`LANDNAM_LONG_SEEDS=60 npx vitest run test/balance.test.ts -t 'plays to day
500'`, about two minutes.

**What the widening found instead: the coast is met and never befriended.**
Chasing the jarldom count meant asking which of the Thing's six needs is
actually the one that fails, and the answer was `friends` — so the next
probe measured standing itself over every settled saga rather than the
handful that reach an endgame. Over 88 settled sagas:

- **88 of 88 met a neighbour.** The 4.3 placement fix works completely; the
  coast is no longer unreachable in any sense.
- **The median band's best standing with ANYONE was 10.9** — which is the
  +10 a native camp opens at, plus drift. The median relationship never
  moves at all, over a whole saga.
- **21 of 88 ever crossed the 25 a speaker needs.** When it moves it moves
  all the way: the best readings sit at 99–100. Friendship is bimodal —
  either a band gets a bargain circuit going and rockets to sworn, or it
  stands at the opening its whole life.

So the wall in front of the endgame is not survival and not the mead hall.
The measurement is now permanent: the long game prints the standing
distribution every run and bars that SOMEBODY still reaches speaking terms,
so a change that quietly flattens the coast fails loudly instead of closing
the endgame in silence the way placement once did.

**And the obvious explanation for it was wrong.** The reading above was
first written up as arithmetic — `REP_TRADED` is +9 a bargain against
`REP_DRIFT` taking 0.12 a day back, so a band that trades occasionally is
running down an escalator — and that is a tidy story that measurement does
not support. Barter was diagnosed rather than tuned, over 88 settled sagas
(2026-08-10):

| bargains struck | sagas | median peak standing | reached 25 |
| --- | --- | --- | --- |
| none | 65 | 6.9 | **1** |
| two | 3 | 17.8 | 0 |
| three or more | 20 | 53–75 | **20 of 20** |

**Bartering works perfectly. Three bargains is the whole game**, and every
single band that struck three reached speaking terms. Nothing about the
+9 needs changing; the escalator is not the wall.

What IS the wall is getting to them at all. Pooled over the same sagas:

- **The median band spent ZERO days of its life standing on a neighbour's
  hex**, and 58 of 88 never stood on one at all. Neighbours sit up to
  `CLAN_MAX_GAP` (13) hexes off, which is a week's walk each way.
- When a band does get there it deals: 123 bargains struck on the 151
  visit-days that were free to deal. This is not the bot declining to
  trade.
- **29% of visit-days were blocked on `stores`** — 64 of 221. A band walks
  a fortnight to barter and arrives unable to spare the 8 food it came to
  spend, which is the cruellest possible way to lose the trip.

So the design question is not "what is a bargain worth" but **"why does
dealing with the coast require a fortnight's walk"**. The shape of the
answer is already in the file: every neighbour walks over to look at a new
steading (`neighboursCallOn`), and that visit does nothing but put them on
the map. A visit that could be DEALT with is the fix, and it is what
actually happened on that coast — the trader came to you.

But it is a new mechanism rather than a hook on an old one, and the first
write-up of this said "half-built", which overstates it. `neighboursCallOn`
reveals each neighbour ONCE and stops the moment all four are found, so it
fires four times inside the first two months of a steading and then never
again — which is precisely the window in which a band has least food to
spare, and the `stores` block above says so. Making callers RECURRING is
the actual work.

**The `stores` block turned out to need no fix at all** (measured
2026-08-11). On a blocked visit-day the median band had **1.1 food**,
against **28.4** on the visit-days that were free to deal and 17–20 across
all settled days — and half the sagas that hit one were dead within twenty
days. Poor bands are poor. `BARTER_FOOD` is eight, a band of six eats three
a day, and anybody with a working larder carries three and a half bargains'
worth to the door. The 29% is a symptom being reported accurately, and
cheapening the bargain would move a number that is stopping nobody.

So the coast has ONE lever, not two: the walk.

**Every number here describes ONE way of playing, and it is not the best
one.** Audit item 7 gave the harness three policies over the same thirty
landings on A Fair Country:

| policy | saw spring | second winter | avg days | built | sacked |
| --- | --- | --- | --- | --- | --- |
| turtle *(never leaves the palisade)* | 25/30 | 20/30 | 163 | 6.9 | 0.0 |
| raider *(lives by taking)* | 20/30 | 11/30 | 128 | 6.2 | 0.3 |
| settler *(what this document measures)* | 16/30 | 5/30 | 102 | 4.6 | 0.4 |

All three are playable, which is the good news and the bar the test holds.
The rest is not: **staying home wins**, the outward half of the game is a
net cost, and even the policy built around plunder sacks less than one camp
in three sagas. A Viking game in which raiding is the losing line is a
design question, not a bug, and it is the biggest one still open.

**The endgame is reachable, as of 2026-08-08.** It was not before, and the
suite was green throughout: neighbours were placed with a floor and no
ceiling, so across forty full-length sagas **not one band ever met anybody**,
no Thing could be called, and the jarldom was dead content. The coast now has
a walkable ceiling and comes to look at a new steading of its own accord.
Five jarldoms across forty sagas where there had been none. The general
lesson is in the dead-ends table: every requirement an endgame names needs
its own bar, or the one without a bar is the one that is broken.

**The open problem, inverted.** The late game is not flat — it is a cliff.
Raids run about three to a saga and even a line-forming defender loses most
of them (4 held of 33 across twenty sagas), and each loss burns a building,
takes two fifths of the store and carries hands off, which compounds.
Whether 7% at the Thing's window is the brutal late game Phase 6 wanted or
an overshoot is now a design decision to be taken on an instrument that
finally tells the truth. And the five-lever conclusion — that a settled band
replaces material faster than anything can take it — was drawn entirely on
the broken instrument. It may still hold; it is no longer evidence.

**The finished queue** (from the audit of 2026-08-06 — every item done but
the release's two at-home steps, kept here for item 10's checklist and for
the figures the entries carry):

1. **[x] Surface 6.2 in the UI.** `bond`, `capacity`, `crowding` and
   `roomLeft` appear in ZERO renderer files. Who fights, who works and how
   much room the hall has are all invisible, and crowding drains morale with
   nothing on screen to say so — a hidden punishment, which is the one thing
   this project's rules exist to prevent.
2. **[x] Tell a leaver from a corpse.** Hands who walk out are marked
   `alive: false` so the upkeep accounting stays right, which counts them
   among the dead and puts them on the memorial. The fate text distinguishes
   them; the tally and the saga do not.
3. **[x] Make a lost raid cost hands.** The conclusion of five measured
   levers. A sacking takes stores and fires a building, both replaceable.
   Taking people is the only untried lever not priced in material.
4. **[x] Teach the balance bot 6.2.** It never accepts joiners, never manages
   capacity, never sees the sworn/hand split — so every measurement about
   GROWTH is unreliable. Must land in the same commit as item 3.
5. **[x] Measure raid outcomes.** Baseline: **15 raids came, 0 held**. Nothing counts how often a raid is LOST,
   only how often one fires. That is the number item 3 moves, and there is no
   baseline for it.
5b. **[x] Teach the bot to form a line, THEN judge the raids.** Done, and it
   found the seventh harness artifact — the largest yet. The rule that works
   was in `test/wall.test.ts` all along: closing at 4 a hex outweighs
   shoulders at 3 a mate (two at most), scored over the full zone-of-control
   reach — a line formed WHILE advancing, where the reverted first attempt
   weighted shoulders above ground and huddled. In clean arena fights it
   takes the old charge-in bot from 18/60 wins and 89 standing to 34/60 and
   162. Wiring it in "collapsed" the curve — and checking the mechanism
   before trusting the number showed the collapse belonged to the BASELINE:
   the run loop ended the saga on any refused action, the old bot proposed
   battle moves without costing the ground or the disengage, and half of
   every sample truncated mid-battle and counted as alive. Honest figures:
   old bot 78/22/2, wall bot 78/30/7 — better at every mark. Raids held went
   1 of 15 to 4 of 33; the truncated sagas had been under-counting the raids
   themselves. The verdict on the raids: they are genuinely lost — 29 of
   33 — even by a defender who forms a line, and each loss compounds. That
   is the cliff in the head of this document, and pricing it is a design
   decision, not a bot fix.
6. **[x] Triple the event deck** (39 → 59 → 79 → 100). *Done, four batches.
   The dilution finding's teeth have dulled since 6.3: raids arrive by a
   daily roll off the steading, not from the deck, so deck size only waters
   down the weather, sickness and steel draws. Batches three and four were
   the first measured on the honest harness, and they bracketed the noise
   floor neatly: winter read 78 → 68 → 78 across them, so batch three's
   drop that looked like drift was the instrument, and nothing was trimmed.
   A second lesson came free: the raid tally over twenty sagas is far more
   volatile than the curve — raids held read 4/33, then 23/39, then 7/28
   across three deck states that should not move it — so nobody should tune
   raid fairness on that number without a much bigger sample.* The deck now
   exercises every corner of the vocabulary, including `known` lore, the
   palisade and the smokehouse.
7. **[x] Authored raid battlefields.** Done: six hand-drawn approaches in
   `data/raidFields.ts` — the open in-field, the strand between wall and
   water, the wood shouldering the wall, the hollow way, the double ford,
   the burnt stubble — picked by what the steading actually holds (the sea
   cannot flank a dry steading) and by the raid's own rng, so raids vary
   and replays do not. Pure data with a content lint like the deck's: every
   promise the old procedural field enforced in code (room for fourteen,
   room for six, one gate, a climb-free lane, a four-wide stand, a
   crossable field) is asserted against every map, walled and unwalled.
   The opening log line now names the approach. The milestone bar
   STRENGTHENED on authored ground: over ten paired raids, walled held 5
   with 18 dead and 246 stolen against open's 0 held, 29 dead, 720 stolen.
   The survival curve did not move (77/20/8 against 78/25/10 — all below
   resolution), which is the correct result: the fields change what a raid
   feels like, not what the game costs.
8. **[x] Split `data/events.ts` and `main.ts`.** Done in four cuts: the
   console levers (`debug.ts`), the deck out of the vocabulary
   (`eventCards.ts`, 1,294 → 91), the UI-state bag (`uistate.ts`), and
   finally the overlay chain itself (`render/overlays.ts`) — the nine-branch
   priority that decides which one card sits over the map, liftable exactly
   because the `uistate` cut had already gathered what its branches closed
   over. main.ts is 614 → 453 and is a boot router again. Verified in a
   browser, per this file's own rule about tsc: the Act sheet, the Chart and
   the Band roster all open and close through the lifted chain, and an event
   card fires and resolves, with no console errors.
9. **[x] Version the localStorage preferences.** One `store.ts`, a version
   stamp, and a migration for the mute's old format. *(The audit's claim that
   `fallen` grew unboundedly was wrong — it has been capped at 60 since it
   shipped.)*
10. **[~] 5.4 Release** — the v1.0 build is DONE and pushed on the release
    ritual: source zipped to `release/landnam-src.zip`, the built page
    verified standalone from a `file://` open, published to both Pages
    roots, release commit `52e6673`. The remote tag is NOT: this session's
    credentials can push branches but 403 on tags, so minting `v1.0` rides
    along with the steps that already live outside the repo:
    0. **GitHub → Releases → New release**: tag `v1.0`, target `main`
       (commit `52e6673`), attach `release/landnam-src.zip`. Creating the
       release creates the tag.
    1. **DNS** (at rcjlabs.com's provider): a CNAME record,
       `landnam` → `rcjlabs.github.io`.
    2. **GitHub → Settings → Pages → Custom domain**: enter
       `landnam.rcjlabs.com`, save, and tick Enforce HTTPS once the
       certificate is issued. GitHub commits the CNAME file itself to
       whichever source Pages serves; `scripts/publish.mjs` writes only its
       own three files and will not clobber it. Do the DNS record FIRST —
       the moment the CNAME file exists, the github.io address redirects to
       the custom domain, so a domain without DNS is an outage.
    The open design question is deliberately released as-is and stays on
    the books: 7-10% of average-competence runs reach the Thing's window on
    the honest harness. If play says that is an overshoot, tuning it is
    v1.0.1 — a patch on a truthful instrument, not a blocker on a stamp.

**The queue (from the audit of 2026-08-07)** — the loop audit, taken against
the game the pitch describes: travel, sea-fights, raiding, settling,
defending, keeping people. The finding under most of it: **the game's whole
threat economy is defensive.** The player's offensive verbs exist but have no
economy behind them, nothing outside the steading ever escalates, and the
measuring bot has never once used the offensive half.

1. **[x] The map needs destinations.** Done: four kinds of place in
   `data/places.ts` — a monastery rich and soft (garrison 1, and it can
   teach runes), a trading town rich and hard (garrison 4), a wreck and an
   iron seam free for the working (shipwright and smithing) — seeded one
   each per world where the ground allows, discovered under the fog,
   marked on the map, named by the hint panel, taken through the Act
   sheet. A guarded place is a fight first (the battle carries `placeId`
   and pays only if won; a lost fight leaves it standing to come back
   for); every taking is once-only, goes to the saga, and moves the
   NEAREST neighbour's standing by the kind's infamy — so robbing the
   coast feeds the pressure machinery that was already listening.
   `SAVE_VERSION` 18: old saves re-derive exactly the places their seed
   would have been born with, against their SAVED tiles. The bot robs
   soft targets when hungry, same commit; the curve did not move
   (75/20/8 against 77/20/8), which is right — places are opportunity,
   not pressure. 555 tests.
2. **[x] A plunder economy.** Done: a camp that falls is emptied. Each clan
   kind carries its stores in data (`plunder` on `ClanKindDef` — a hall
   keeps timber, a camp keeps food), scaled up by their might, and paid
   only when the field is WON — the fight carries `Battle.campId` the way
   a place-fight carries `placeId`, and losing leaves their stores where
   they were. The standing cost stays priced at the DECISION (−45 the
   moment steel comes out), a thrall can be carried home as a hand when
   the hall has a bed (takeIn owns the room question, and a band still
   walking has no hall at all), and a sacked camp ARMS — might rises by
   one, so the second visit is dearer than the first: escalation the
   player chose. `SAVE_VERSION` 19. The bot robs a hostile doorstep only
   when starving; the curve did not move (75/20/8, unchanged). 560 tests.
3. **[x] The world must escalate with the years, everywhere.** Done:
   `sim/word.ts` — word of the band, built from exactly two things, winters
   stood and sackings chosen. It feeds OPEN-FIELD fights only (the home
   raid has its own machinery, and sackings already reach it through
   standing — one deed is never counted twice): a difficulty bump, a foe
   cap that grows with word so the bump can BIND past the old MAX_FOES
   swallow (the Math.min lesson, applied in advance, with tests proving
   count, mix and cap all move), and archetype weights that lean huscarl
   and raider as word grows — the same six men, but a harder six, which is
   the knob that binds even at the cap. Word is nought through the whole
   tuned first year for a band that robs nobody; the fight log says "They
   had heard of us" whenever word is why the fight is worse. Curve
   unchanged at 75/20/8 and the Thing's 4/4 promise holds — the effect
   lives in year three and beyond, past the harness's day-169 horizon,
   which is exactly where the audit said the game went flat. 582 tests.
4. **[x] Diagnose the mid-winter cliff before tuning it.** Done, and the
   diagnosis is clean: the cliff is NOT material. The harness now prints a
   deaths-by-fate table for the wall window (day 40-73) beside the curve.
   Measured over 60 seeds: sickness 28, and five battle fates totalling 52
   — while starvation and cold END just 10 of 48 dead runs between them.
   The top run-killer is DESPAIR at 26, twice "slain" at 12: fights and
   winter sickness take people, every death drags the band's heart, and the
   morale spiral is what actually closes the saga. The five-lever
   conclusion is confirmed from the honest side — the game already kills
   through people and grief, never stores. The tuning levers, when wanted:
   bereavement stacking, winter sickness, winter fight frequency. NOT food.
5. **[x] Ships are a terrain skin, not a system.** Done. Three authored sea
   decks in `data/seaFields.ts` — hulls lashed rail to rail, a boarding
   over locked bows, a scramble in the shallows among the skerries — linted
   like the raid fields and picked with the fight's own rng; every ocean
   battle now opens on one, with its line first in the log. And the sea has
   stakes: losing puts ~35% of the packs over the side and HOLES the hull
   (she rows at half pace until a night ashore and two of wood mend her —
   short of sunk on purpose, because a run must end by decision); winning
   strips their hull instead. A new ocean card, A Lean Sail Closing, makes
   fights afloat actually reachable (deck 102). `SAVE_VERSION` 20; the
   holed state is on the hint bar so it is never a hidden punishment; the
   bot fights sea battles with the same line-forming policy and mends the
   hull through its normal camping. Curve unchanged (75/20/8). 574 tests.
6. **[~] Raids need a face.** HALF done, and the half is worth naming
   honestly. Shipped: a champion leads every raid and every word-drawn
   open-field fight — boosted, grimly bynamed, blood pennant, named in the
   log, and felling him shakes the whole side he led (symmetric with our
   own leader falling). NOT shipped: persistence. He is born and dies
   inside one battle; he does not belong to a hostile neighbour, does not
   carry the grudge history, and cannot escape to come back. The
   recurring antagonist is the better half of this idea and is item 1 of
   the next queue.
7. **[x] The build queue must not end.** Done: three late-tier buildings
   (storehouse, watchtower, hof) and one repeatable búð, gated on crowding
   after the unconditional version was measured as a timber sink. After the búð there is nothing to
   spend a surplus on, and surplus labour is the diagnosed root of the flat
   material game. Late buildings as data: wall tiers (the authored fields
   read them), a beacon for the watch, a feasting-hall tier the Thing
   reads. Spending surplus is the player's answer to escalation (item 3).
8. **[x] 6.4, shaped as escalation.** Done: the Thing grants the rule and
   the run goes on; word and the raider cap both count the jarldom; the
   saga closes when the player says it closes. Original note:
   Remove the five-winter guillotine;
   after the Thing the jarldom is a bigger prize on the same coast — item
   3's scalar keeps climbing, and holding what you claimed becomes the
   long game. The Thing stops being the last page.
9. **[x] Give farming its year, and wire the promise already made.** Done:
   the vocabulary gains `flagSet` (the mirror `flagUnset` always implied),
   and the sowed flag is finally read. Seed-corn is now gated on the flag
   being CLEAR, so one crop is paid for once; a new autumn card — "What the
   Spring Kept Back" — opens only over a sown field, pays 8-20 food on a
   cut-now-or-gamble-a-week choice, and clears the flag so the year can
   turn and the bargain come round again. The deck stands at 101; a
   player's paid promise is now a kept one.
10. **[ ] Teach the bot the offensive half, in the same commits.** The
    balance bot has never launched an expedition, bartered, or fallen on
    anyone — every measurement of trade, growth and provocation is blind,
    which is this project's oldest lesson wearing new clothes. And the
    raid-outcome tally needs its bigger sample (it swung 4/33 → 23/39 →
    7/28 on deck edits) before anyone tunes raid fairness on it.

**Known and not urgent:** there is no meta-progression and no daily seed;
accessibility is minimal (keyboard play is not possible); and
`render/travel.ts` still breaches the ~300-line guidance.

## Phase 7 — The Unreal build

*Landnám is being rebuilt as an Unreal Engine game. A hex grid and top-down
movement are working there already. This section is what that port needs from
THIS repo, and what it should be careful of — written for whoever is holding
both codebases at once.*

**The thing being ported is the simulation, and it is the whole asset.**
`src/sim/` and `src/hex/` are 10,500 lines of pure `(state, action) → state`
with 5,000 more of typed content in `src/data/`, standing under **846 tests
in 45 files**. `src/render/` and `main.ts` are 4,500 lines that draw SVG and
are worth nothing to Unreal. The split the CLAUDE.md rules have enforced from
day one — *if it can be unit-tested, it does not belong in `render/`* — is
what makes this a port rather than a rewrite. Every item below exists to
protect it.

Ordered, as the audits are: the expensive-to-change decisions first, then
what 3D actually buys, then what gets harder.

### The decisions that are expensive to change later

1. **[x] Choose the sim boundary — DECIDED 2026-08-13: the rules get
   rewritten in C++.**

   **Evan's call, on the grounds of what makes the best Unreal game rather
   than what is cheapest for this repo.** The reasoning is below, and the
   four arguments that decided it are ones the analysis under this heading
   had underweighted, because it framed the question around bridge cost and
   the balance record:

   - **Consoles and iOS forbid JIT.** Embedding JS means an interpreter-only
     build, which slows the SIM and not merely the bridge — and `apply()`
     already spends 2.2 ms an action deep-cloning. The 0.031 ms bridge
     figure below was measured with a JIT. If a console is ever a target
     this decides it alone.
   - **The content rule maps onto DataTables.** "Adding content must never
     require touching engine code" is this project's oldest architectural
     rule, and Unreal's DataTable/DataAsset tooling is built for exactly
     that. Behind an embedded sim, all of `src/data/` sits behind a boundary
     the editor cannot see. `Source/LandnamUE/LandnamDataRows.h` had already
     started down this road before the decision was taken.
   - **Native tooling.** Insights, Live Coding, breakpoints and the profiler
     work on C++. An embedded JS heap is opaque to all of them.
   - **Saves and replication** want native USTRUCTs.

   **The objection was real and is answered rather than dismissed.** "The
   balance record only follows one codebase" is the strongest argument
   against, and the answer is that the TypeScript does not become a dead
   branch: it becomes the **reference implementation and the balance lab**,
   with parity CI as the thing that stops the two drifting. That is item 5,
   it is now a prerequisite rather than a nicety, and it should be built
   BEFORE the rules port rather than after. The machinery is already half
   there — `port/golden.json`, `LandnamParityTest.cpp` and the `worldHash`
   runner — and content already works this way, exported from `src/data/*.ts`
   rather than reimplemented.

   **Order of work, so the record survives the crossing:** parity CI first;
   then port along the dependency graph — `state/types`, `worldgen`,
   `calendar`/`upkeep`, `travel`, `battle`, `colony` — each stage landing
   with its TypeScript tests as UE automation tests, and each required to
   match the TS hash on N seeds before the next begins.

   *What follows is the analysis the decision was taken on, kept as written.*

   **Half of it was already chosen.** *Read this before deciding anything; it was written after
   actually looking at `landnam-ue` on 2026-08-11, and the repo says
   something different from what the plan assumed.*

   **`src/hex` and `src/rng` are already ported to C++** — 1,637 lines in
   `Source/LandnamUE/`, Blueprint-exposed, with an automation test
   (`LandnamParityTest.cpp`) driven by a large golden-vector file. It is not
   stale: 1,620 values regenerated from today's TypeScript matched exactly,
   zero disagreements. That is items 2 and 4 of this list, done before they
   were written down.

   **The fork is still ahead, because none of it is game RULES.** There is no
   worldgen, no upkeep, no combat resolution in Unreal — `src/sim` (9,337
   lines) and `src/data` (5,076) are untouched. And porting hex and RNG does
   not commit you: an engine wants native coordinates and pathfinding for
   rendering and input whichever way the rules go. So the question is
   unchanged and still open — **do the RULES get rewritten in C++, or does
   Unreal ask the TypeScript?**

   What is measured, for whoever decides:
   - **The sim is host-free.** Grepping `src/sim`, `src/hex`, `src/data`,
     `src/state` for `document`/`window`/`localStorage`/DOM types matches
     five files and **four of them are comments**. The only real dependency
     is four `localStorage` lines in `src/state/save.ts` — the persistence
     adapter, which any host replaces anyway. There is nothing to untangle.
   - **Performance is not the axis.** A JSON round-trip of the mutable state
     — what a bridge costs per action — is **0.031 ms**. `apply()` already
     spends **2.2 ms** an action deep-cloning. The bridge would be ~1.4% of
     what the sim spends on itself, and this is turn-based, so it is crossed
     a few times a second, never per frame.
   - **The payload is small.** A GameState is 80 KB but 78 KB of that is the
     world, generated once and never written again. What changes is 2 KB
     travelling, 7 KB mid-battle.

   The argument for embedding is that the balance record only follows one
   codebase — every figure in this document came out of `test/balance.test.ts`
   — and that the game is still moving: two design questions opened this week
   alone, and under a fork each of them lands twice. The argument for C++ is
   Blueprint-authorable rules and no bridge. *Measured by: N seeds played
   through both, asserting identical `GameState`, in CI.*

   **The runner that makes that measurable now exists** (2026-08-11):
   `npm run play -- --seed raven-skerry-317` prints a `worldHash`, and that
   is the cheapest cross-implementation check there is — one command a side,
   and if the two disagree nothing else is worth comparing. A full run
   hashes to sixteen hex digits over a canonical form with sorted keys and
   explicitly written numbers, built on the same `hashString` the RNG
   contract already pins, so a port that passes item 2 has nothing new to
   agree about. See `runs/README.md`.

2. **[x] Nail cross-language determinism before anything depends on it.**
   *Shipped 2026-08-10.* `port/rng-fixture.json` pins 174 absolute values
   generated from `src/rng.ts` — hashes, raw uint32 draws, every stream
   name, derive chains, and the helpers with their draw COUNTS. Stored as
   integers, never decimals, because a decimal is somewhere two languages
   can print the same number differently. `port/rng.md` is the spec;
   `port/rng_reference.cpp` is a C++ implementation that was compiled and
   run against the fixture rather than merely written beside it — g++ 13.3,
   174 of 174 matching.

   The fixture earns its keep here too, which was not the plan. `test/rng.
   test.ts` proves the generator is SELF-consistent and would pass if the
   algorithm were swapped wholesale; `test/rngport.test.ts` fails on a
   one-digit change to the FNV prime, checked by making that change. This
   repo could previously alter every seed in every save with nothing to say
   so.

   The seed cases were then validated rather than assumed, and the reading
   sharpened the spec: hashing `landnam` as UTF-8 bytes, UTF-16 units or
   code points gives **the same answer all three ways** — so no ASCII seed
   can ever catch this. `Þórr` catches a UTF-8 port. Only `😀` catches a
   code-point port. All four are in the fixture for that reason.

   *Reconciled 2026-08-11.* This was built without knowing `landnam-ue`
   already had its own golden vectors, so there were briefly two contracts.
   `port/golden.json` is now the shared one — this repo generates it,
   `test/goldenport.test.ts` guards it, Unreal consumes a copy — and
   `port/rng-fixture.json` is kept only for the helper edges the shared file
   does not carry. The standalone C++ reference was deleted: a real, tested
   port exists, and a second implementation nobody runs is one that rots.

3. **[x] Design the sim→presentation event stream now.** *Battle half
   shipped 2026-08-10.* `src/sim/beats.ts` — fifteen kinds covering
   everything a fight can do, actors named by `personId`, ground given as
   hexes, each beat numbered so a view drains "everything since n" holding
   nothing but a mark. `Battle.beats` (SAVE_VERSION 28). Emitted, never
   read by the sim, so it cannot change how a fight goes: the arena reads
   formation 32/60 and brawl 29/60 either side of the change.

   Proved rather than asserted, twice. **Reach:** thirteen kinds turn up in
   bulk over thirty played fights (moved 929, struck 728, reached 338, threw
   207, fell 187, dashed 108, shoved 78, defended 33, opened / warcry /
   ended 30 each, broke 29, leaderFell 28) and the bar is checked against a
   kind that does not exist, so it can fail. `rallied` and `fled` came in at
   four and ONE — a broken fighter usually loses the race to `checkOutcome`
   ending the battle around them — so they get a fixture instead of a
   sample. **Use:** the web build's effects layer was rewired onto the
   stream, which found the thing an argument would have missed. Same save,
   same script, same fight: the old one-slot `lastBlow` showed **6** blows;
   the stream shows **31**. A slot holds the newest blow and a foe's whole
   turn arrives between repaints, so every swing but the last was invisible.
   `lastBlow` is gone.

   *Travel and colony shipped too (SAVE_VERSION 30), and the "still owed"
   that stood here until 2026-08-13 was stale.* `worldBeat` carries the same
   shape stamped with the DAY rather than the round, and fifteen kinds are
   emitted across `upkeep`, `travel`, `colony`, `joining`, `neighbours`,
   `places` and `expedition`.
   The last gap was narrower than the note claimed and is now closed: neither
   `places.ts` nor `expedition.ts` emitted anything at all, so a party walking
   out of the steading and a monastery going up were invisible to everything
   but the prose. `wentOut`, `cameHome`, `spotted`, `dealt` and `sacked` fill
   it. Those five are pinned by FIXTURES rather than by a played sample, which
   is the battle half's own precedent for `rallied` and `fled` — the place
   economy is the part of the game a band reaches least (six sagas in sixty
   ever stand at a counter), so a bot sample would report them unreachable
   when the truth is that they are rare.

   Closing it also caught a fault in the reach test that had nothing to do
   with the stream. It looped while `seen.size < KINDS.length`, where `seen`
   collects every kind the run emits and `KINDS` is only the ones under test
   — so adding `spotted` to the sim pushed `seen.size` to thirteen on the
   second seed, ended the sweep early, and reported `gathered` as never
   emitted. The stream was fine and the counter was measuring the wrong set;
   it counts the intersection now. **A coverage bar that can be satisfied by
   something it is not testing is not a coverage bar** — and this file's
   header already records the same test being wrong in the other direction.

4. **[x] Port `src/hex/` first and hardest.** *Already done in
   `landnam-ue` (`LandnamHex.cpp/.h`, 672 lines) and verified in parity on
   2026-08-11 — round, toPixel/fromPixel, distance, line, neighbors and
   directionTo, ring, range, the offset conversions, findPath and reachable,
   every vector recomputed from live `src/hex` and matching.* Pure, fully tested, and both
   the world map and the battle grid stand on it — axial coords, neighbours,
   distance, `line`, `range`, `ring`, `findPath`, and the pixel conversions.
   Its tests port almost verbatim and give a real green baseline on day one.
   Nothing else should be started before this is green.

5. **[~] Keep the balance harness running against the PORTED sim — the
   contract now EXISTS (2026-08-13); what is left is the C++ side of it.**
   `port/parity.json` pins seven runs and thirteen checkpoints across six
   facets, `test/parity.test.ts` recomputes every reading from the live sim
   so it cannot go stale unnoticed, `npm run parity` regenerates it, and
   `port/sim.md` is the spec. Built BEFORE the port, deliberately — **and
   both ends of it now exist**: `landnam-ue` has `LandnamCanonical` (the
   shared canonical form and state hash, ported first because every facet
   becomes a string it produced) and `Landnam.SimParity`, a harness that is
   honestly green today, checks the canonical form for real, and skips the
   six sim facets BY NAME until a stage fills in `ReadFacet()`. Worldgen
   turns `world` green without one rule ported. Item 1 chose C++ on
   2026-08-13, which makes this the load-bearing piece: it is the only reason
   the TypeScript is a reference implementation instead of a branch that
   rots. Build it BEFORE the rules port, so every ported subsystem has
   something to be wrong against on the day it lands. The one to fight for. Everything found in the 2026-08 audits — a coast no band
   ever reached, a palisade that made raids HARDER, a knarr that was never
   faster than walking — came out of `test/balance.test.ts` playing sixty
   sagas and counting. If the Unreal sim forks and the harness stays behind,
   the entire balance record in this document becomes fiction inside a month.

### What 3D actually buys

6. **[ ] The shield wall is what gains most.** `wallLinks`, `wallBonus`,
   `wallPush`, zone of control and the spear from the second rank are all
   currently inferred from a flat SVG. In three dimensions a line LOOKS like
   a line and a man who steps out of it looks wrong. The arena measures
   formation at 32 wins of 60 against brawling's 29, with 158 left standing
   against 140 — in 3D that should be legible before it is arithmetic.

7. **[ ] Terrain and sight become physical.** The sim already models
   `blocksSight`, high ground raising sight radius, and per-terrain movement
   cost. That is a heightmap and real occlusion rather than a fog overlay —
   and it is already balanced, so the work is visualising a system rather
   than inventing one.

8. **[ ] The saga wants a voice.** Every line is written in past-tense
   chronicle prose specifically so it can be read aloud, and there are 102
   event cards plus a generated end-of-run saga already written. A skald
   narrating the run is nearly free content.

### What gets harder

9. **[ ] Save discipline has to survive the port.** `SAVE_VERSION` is 31,
   every bump ships a migration, and the rule is that old saves must always
   load — see `src/state/migrations.ts`, which is a written record of every
   shape this game has ever had. Unreal `SaveGame` has no such culture by
   default. Decide deliberately whether saves are shared with the web build
   or a clean break, and write the answer down.

10. **[ ] The mobile rules stop applying — decide what replaces them.**
    44px touch targets and portrait-first were load-bearing constraints and
    are now irrelevant; gamepad navigation and readable-at-distance text are
    the equivalent questions. The accessibility work of 2026-08-09 has direct
    analogues worth carrying rather than rediscovering: a live region becomes
    a screen-reader-facing status, dialog semantics become focus discipline,
    and `src/sim/announce.ts` is already pure text that ports as-is.

**Two cautions.** Item 1 genuinely is a fork and the right answer depends on
target platform and team — embedding JS keeps one sim and one suite at the
cost of native performance and Blueprint ergonomics; C++ is the exact
opposite. And **do not port the colony UI early**: it is the least visual
mode and the most work per unit of payoff. Travel and battle first.

## The next queue — audit of 2026-08-11

Written from the far side of three days of port work, and it is a different
kind of list again. The 2026-08-08 audit asked what the game REACHES. This
one is mostly things this week's own work broke, left half-done, or measured
and walked past — which is the honest place to look after a stretch of
building. Two of the ten are bugs shipped inside the last two days.

Ordered as the others are: what is wrong now, then depth, then reach. Every
item names how it would be measured, because an item that cannot be measured
is a wish.

### Wrong now

1. **[x] The chase is invisible until you die.** *Fixed 2026-08-11.*
   `chaseLine(state)` in `sim/announce.ts` — pure, so it is unit-tested —
   and `renderChaseMark` in `render/ui.ts`, deliberately the same box as the
   winter and watch marks because the player has already learned to read one
   of those. It rides on `standing()` too, so the live region carries it and
   a listener is not worse off than a looker.
   It says the useful number rather than the tidy one: **days left to beat
   it** while days are what separate you, "ahead of the mark" once you pass
   them, and — the case worth getting right — no day count at all against a
   mark that took the Thing, because "eleven days to beat it" is a lie when
   what they did was become jarl and no number of days gets you there.
   Driven in the built page: mark on screen from the first turn, and the
   count moved 128 → 127 as day 1 became day 2. The first drive proved
   nothing and said so — it used a jarl mark, which hides the countdown by
   design, and clicked a button selector that did not exist, so the day
   never advanced.

2. **[x] Every action deep-clones a world that never changes.** *Fixed
   2026-08-11.* `src/state/clone.ts` — a copy that SHARES the generated
   tiles and copies everything play actually writes. **1.950 ms an action to
   0.069 ms, twenty-eight times cheaper**, on a game whose primary target is
   a phone slower than this container.

   Which parts are safe to share was settled by grep rather than by
   sampling: `world.seen` (fog, events, places), `world.trod` (travel) and
   `place.sackedOn` (plunder, places) all have write sites, and
   `world.tiles` has **none anywhere in `src/`**. A play-sample said the
   same thing and could not be trusted — the bot never moved, founded or
   sacked, so its clean result covered nothing. (`Tile.explored` turns out
   to be declared and never written at all: a dead field.)

   The saving is real and so is the risk, since two states sharing an object
   one of them later mutates would surface as a corrupted save weeks later
   rather than as a test failure. So the tiles are FROZEN on first copy — a
   write throws at the line that does it — and `test/clone.test.ts` proves
   the freeze bites rather than assuming it. The real guard is that the
   whole suite, balance harness included, plays sixty sagas to day 500 with
   the ground frozen throughout.

   **The unlooked-for win: the test suite went from ~15 minutes to under
   4** (923 s → 235 s). The harness is clone-bound, and nobody knew.

3. **[x] Finish the coast diagnosis: what was in the larder.** *Measured
   2026-08-11, and the answer is that there is nothing here to fix.* On the
   visit-days blocked by `stores`, the median band had **1.1 food**. Not
   six, not seven — one. Against a median of **28.4** on the visit-days that
   WERE free to deal, and 17–20 across all settled days.

   So the 29% is a symptom, correctly reported, and `BARTER_FOOD` is not too
   dear: a band that walks to a neighbour with a working larder carries
   three and a half bargains' worth. The ones that arrive unable to trade
   arrive with a day's food, and **half of them are dead within twenty days**
   (12 of 23 sagas). Poor bands are poor, exactly as suspected, and pricing
   the bargain down would move a number that is not stopping anybody.

   Which leaves the coast design with one lever instead of two: the walk.

### Depth

4. **[x] The beat stream's travel and colony half.** *Shipped 2026-08-11.*
   Thirteen `WorldBeat` kinds — dawn, ate, burned, worked, hurt, died,
   seasonTurned, marched, gathered, founded, built, joined, met — on
   `GameState.beats` (SAVE_VERSION 30). Stamped with the DAY where a battle
   beat carries its round, because that is the clock each mode actually runs
   on.
   `chronicle()` turned out to be the wrong seam. Emitting a beat per saga
   line would only have handed a renderer the prose again, structured as
   `{day, text, tone}` — which `state.saga` already is. What a presentation
   layer needs is the ordered inside of `passDay`: six mouths eating the
   last of the food, the fire going out, a roof finished, somebody walking
   over the ridge. So the beats sit at those sites instead.
   The reach bar cost four rounds and every one of them was the BOT, never
   the game — founding on day one so `canGather` was false and nothing was
   ever foraged; stalling inside COLONY with no way back out, so days
   stopped on day 9; trying jobs from the top of the list every time, so all
   six people became farmers, nobody cut wood, and every seed died of
   despair by day 40; and a stop condition of `seen.size < 12` against a
   list of 13, which reported the last kind unreachable without looking for
   it. Checked against a kind that does not exist, so the bar can fail.

5. **[x] The harness can play well and cannot write it down.** *Shipped
   2026-08-11 — and the item was half wrong, which is how it earned its
   keep.* The harness cannot emit a script and never will: it calls
   `assign`, `queueBuild` and `foundSettlement` straight into the state
   rather than dispatching actions, so a replay of the actions it issues
   would found nothing, employ nobody and build nothing. **Its play is not
   expressible through the player's own interface.** That is fine for a
   measuring instrument and worth knowing about the numbers it produces.
   So `scripts/record.ts` got a competent bot of its own that plays through
   `apply` and nothing else. `runs/long.json` — 1,331 actions, **day 457,
   survived** — is committed and replayed by the suite with zero refusals.
   Two bots on purpose now, and neither pretends to be the other.

   **Writing it found a shipped bug worth more than the item.** See the
   changelog: the first six people ever to join a band took the ids of the
   six who came off the knarr.

6. **[x] `render/cards.ts` is 749 lines and I made it worse.** *Split
   2026-08-11* into `src/render/cards/` — title 123, interrupt 105, decide
   236, closing 208, menus 107, and a 17-line barrel so `./render/cards`
   still means what it meant. Every part is under the rule; the largest is
   236.
   Grouped by what each overlay is FOR rather than by what it is: getting
   in, interrupting play, asking the player to decide, ending the run, and
   the two menus that are about the game rather than the saga. Splitting by
   type — one file of cards, one of panels — was the easy cut and the wrong
   one, and CLAUDE.md says so.
   A pure move, and checked as one: the whole overlay layer was driven in
   the built page afterwards — title, guide, challenge note, chase mark,
   band roster, saga book, settings — because a missing export shows up
   there as a dead button, not as a type error. 826 tests unchanged.
   Still over: `main.ts` (609) and `render/travel.ts` (593).

7. **[x] Nothing permanently checks the offline guarantee.** *Fixed
   2026-08-11,* in two halves, because they catch different mistakes.
   `test/offline.test.ts` runs in `npm test` and reads the PUBLISHED bytes —
   `index.html`, what a player actually loads — failing on any URL but the
   SVG namespace, any external script/link/img/iframe/`@import`, and any
   mention of `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon`.
   It also reads the SOURCE, and asserts that **exactly one file in `src/`
   makes a request at all**: a `fetch` added to a new module fails the suite
   even if its URL is assembled at runtime.
   `npm run offline` is the other half — the built page opened from
   `file://` with the wire cut, played for a couple of days, failing on
   anything that tries to leave. It needs Playwright, which this project
   deliberately does not depend on, and it says so and exits rather than
   pretending to have passed.
   Both halves were checked by making the mistakes: a CDN stylesheet in the
   page (static half fails, naming the URL), a `fetch` in a new module
   (source half fails, naming the file), and a request assembled by string
   concatenation (invisible to the static half by design, and caught by the
   runtime one).
   The audit also settled what the page is ALLOWED, which turned out to be
   worth stating: two `fetch(` calls survive into the artifact. One is
   Vite's modulepreload helper iterating a list that is empty in a
   single-file build; the other is `src/freshness.ts` asking for
   `build.txt`, same-origin and gated on `location.protocol`, so it cannot
   fire from `file://`. Both were traced rather than assumed.
   *Worth adding `npm run offline` to the release ritual in CLAUDE.md —
   that file is yours, so it is left alone here.*

### Reach

8. **[x] Is A Hard Country a difficulty or a wall?** *Measured 2026-08-11:
   a difficulty.* Sixty sagas to day 500 on `hard`, beside `even`:

   | over 60 sagas | As It Lies | A Hard Country |
   | --- | --- | --- |
   | reached the first winter | 48 | **44** |
   | saw spring | 17 | 5 |
   | second winter | 7 | 1 |
   | became jarl | 4 | **1** |
   | founded a steading | 38 | 26 |
   | built something | 33 | 21 |
   | met a neighbour | 58 | 45 |
   | avg days | 95 | 65 |

   Everything is reachable, including the endgame — one band in sixty takes
   a jarldom on the hardest terms the menu offers, and one survived to day
   500. Punishing, and not a brick wall, which is what the label promises.

   **The sharper reading is what hardship actually does.** It barely changes
   whether a band reaches the first winter — 44 against 48, and at twenty
   seeds `hard` and `even` both read 17/20. What it changes is whether they
   survive it: 5 springs against 17. The first forty-nine days are mostly
   walking, and the terms bite in the dark half.
   `hard` is now a permanent third arm of the long game, barred on the first
   winter — the one reading on that country a twenty-seed sample can carry
   (17/20 measured, barred at half). Jarldoms on `hard` happen about once in
   sixty and cannot be barred on at any affordable N, so they are printed
   and not asserted.

9. **[x] Re-run the content-reach probe and act on the top miss.** Done, and
   the top miss was the probe. It printed `never drawn: <fifteen ids>` and
   stopped, which reads like fifteen pieces of dead content; every one of
   them turns out to be reachable, and a fair deck on a sample this size
   leaves about thirteen cards cold no matter what. The list was reporting
   the arithmetic of sampling, not reach — and reading a different sample
   renames it.

   Two real faults came out of chasing it. The probe ran `curve-0..29` under
   BOTH hardships, and `state.seed` carries no hardship, and nor does any
   RNG label — so `curve-7` on 'even' and `curve-7` on 'fair' are the same
   country, the same landing hex and the same card on the same day. "Sixty
   sagas" was thirty played twice with every count doubled. Three other
   probes in the file made the same claim and are fixed with it (`armSeed`).
   And the deck ratio counted `feud` and `thing`, cards the sim builds by
   hand, which pushed coverage above 100% of a deck they are not in.

   The probe now measures the cold list against what a healthy deck predicts
   — `sum(e^-expected)` off the real pools, printed beside a control drawing
   from the same pools on an unrelated stream. 15 cold against a prediction
   of 12.5 and a control of 12. What is barred is a card no state ever makes
   eligible, and a cold count far above prediction; a cold LIST is not a
   finding. *Measured by: the probe's own output, which now carries its own
   baseline.*

10. **[x] A challenge you can only send after you die.** Done. The Act sheet
    now carries the code for the run in progress, ruled off below the deed
    list because it is not a deed — the list is what the day can be spent
    on, and passing somebody the seed costs no day.

    What it sends is the COAST and not a mark: `LN1 <seed> <terms>`, no `d`,
    no `w`. Mid-run there is nothing yet to beat, and "beat day 40" sent on
    day 40 is a claim the sender has not earned and may lose on day 41. The
    ending screen still sends the full result. `decodeChallenge` already
    read a markless code, and the title screen already worded it as a coast
    rather than a chase, so both ends of this existed and only the
    producing half was missing.

    `scripts/drive-coast.mjs` measures it in the built page: start a run on
    a chosen seed and terms, play to day 4, open the Act sheet, read the
    code, copy it, then paste it back into a fresh title screen and check it
    is recognised. Driven on **A Hard Country deliberately** — `fair` is the
    default, so a run started on it would print the right terms whether or
    not the pick ever reached the code, and the assertion would pass on a
    broken path. `copyText` moved to `render/clipboard.ts`, shared with the
    ending screen instead of duplicated.

## The next queue — audit of 2026-08-08

Written after the coast fix, and it is a different KIND of audit from the two
before it. Those read the code and asked what was missing. This one ran sixty
full-length sagas and asked a single question — **what does the game actually
reach?** — because the coast taught the lesson the hard way: a system can be
built, unit-tested and green, and still be something no player ever touches.

The instrument was a throwaway probe over 60 sagas to day 400 (30 seeds ×
both playable difficulties, avg 124 days). It was wrong twice on the first
pass — it read `p.traits` where the field is `trait`, and counted
`tally.joined`/`tally.left`, which do not exist — and both bugs produced
clean, believable zeros. **Check the mechanism before trusting the null**
held again, on the very tool built to check it.

What it found, corrected:

```
cards seen 90/102        buildings raised 10/12      lore 6/6     traits 10/10
fights 190 (raids 57, sea 1, strandhogg 0)           sackings 38
expeditions 16           people arrived 6            hands alive at end 1
sea days 3               Things called 7             feuds settled 10
ends: despair 23, starved 22, slain 10, frozen 2   (mislabelled — see item 8)
deck health: 783 draws, top ten = 33% of all draws
```

The deck is healthy and the traits, lore and building list mostly land. Four
whole systems do not.

1. **[~] A settled band never leaves home.** Mostly done, and one part
   reopened by item 3: the armed errand halved once bands had more mouths,
   and the strandhögg's play-level bar had to come off. See the changelog
   for 2026-08-08. The fix was mostly
   not where the item said it was — see the changelog. The bot learned the
   errand under arms and the ship's way in, but the binding constraint was
   that the fixed places were seeded a MEDIAN of 30 hexes from the sand with
   no ceiling, exactly as the neighbours had been. Bounded, plus a
   knowledge economy (`tellOfPlace`) so a bargain names what is on the
   coast. Sea days 3 → 50, strandhöggs 0 → 2, errands under arms 1 → 7 over
   sixty sagas, and there is now a bar so it cannot go back to zero
   quietly. Original text follows.
   **[ ] (as written)** `moveOptions` returns `[]` for a
   settled band, so an expedition is the ONLY door back onto the map — and it
   opens 16 times in 60 sagas. Behind that door: 3 sea days, 1 sea fight and
   **0 strandhöggs** across the whole sample. Hull damage, cargo over the
   side, the authored sea decks in `seaFields.ts` and yesterday's strandhögg
   are all unmeasured content. The strandhögg shipped in violation of this
   repo's own first rule — the bot has `STRANDHOGG` in its vocabulary and no
   logic that ever gets it afloat. Two halves: teach the bot to sail (and
   therefore measure the sea at last), and give a settled band a REASON to,
   because a door nobody opens is a door that is not there. Measured by sea
   days and sea fights per saga, and by whether the strandhögg's bargain
   (better if you win, much worse if you lose) survives contact with a real
   sample.

2. **[x] Four battle verbs the harness has never seen.** Done, with one
   correction to the item and one design finding worth more than the item
   was. THREE were unmeasured (`B_SHOVE`, `B_DEFEND`, `B_DASH` lived only in
   `battleActions.test.ts`, which proves a verb works and says nothing about
   whether to use it); `B_THROW` was already played in the arena and in
   `raid.test.ts`, so it was unmeasured in a whole SAGA rather than in a
   fight. All four are now played, and the finding is that **dash is a
   trap** — see the changelog. Original text follows.
   **[ ] (as written)** The bot issues
   `B_MOVE`, `B_STRIKE`, `B_REACH`, `B_WARCRY`, `B_END_TURN`, `B_LEAVE` —
   and never `B_THROW`, `B_DEFEND`, `B_SHOVE` or `B_DASH`. Throwing is an
   entire ranged layer (spears and hand-axes, one use each); shove is the
   wall's own tool. Every claim this document makes about combat balance is
   made about a bot playing two thirds of the game. Measured the way the
   wall was: each verb's use rate, and its effect on wins and standing.

3. **[x] Growth never happens.** Done. The measurement was not the one the
   item expected: capacity was never the problem — 9.8 beds a settled day
   with 5.2 standing empty. The band simply never grew, because the coast
   had a daily roll to send men who take (`maybeRaid`) and none to send
   people who come. See the changelog. Original text follows.
   **[ ] (as written)** Phase 6.2 — `capacity`, `crowding`,
   `roomLeft`, `SETTLED_IN`, the repeatable búð, hands who work but do not
   fight — is dead in play: **6 people arrived across 60 sagas, and 1 hand
   was alive at the end of all of them.** Joining exists only as event-card
   outcomes, on cards that need goodwill or a soft landing most bands never
   see. A band that cannot grow cannot man walls, cannot fill a mead hall,
   and hits the raid cliff with the same six people it landed with. Measured
   by band size over time, which nothing currently reports.

4. **[x] The top building tier is unreachable.** Done, and the answer was
   not the one the item assumed: nothing was wrong with the game. The bot's
   want list simply never named the two buildings. See the changelog.
   Original text follows.
   **[ ] (as written)** `greathall` and
   `earthworks` were never built once in 60 sagas. They are the upgrade tier
   `standsFor()` was written for, and no measurement has ever included them.
   Either the timber cost is out of reach of a band that survives, or the
   prerequisites are, and the build-rate-per-tier figure that would say which
   does not exist yet.

5. **[x] The raid cliff — price it or accept it.** Done, and the answer was
   "price it": the cliff was three arithmetic faults, two in the game and one
   in the harness, not a design choice anybody had made. Holds went 1-in-9 to
   1-in-3 and the difficulty table is monotonic for the first time. See the
   changelog. Original text follows.
   **[ ] (as written)** Still the oldest open
   question in this document and now the best measured: 1 raid held of 9 in
   real play, and the gauntlet reads 4/8 at difficulty 0, 1/8 at 2 and
   **0/8 at 3**. Each loss burns a building, takes two fifths of the store
   and carries hands off, which compounds into the next one. This is a design
   decision that has been deferred three times because the instrument was
   untrustworthy. The instrument is trustworthy now.

6. **[x] Make the content-reach probe a permanent fixture.** Done, in two
   halves: a play-reach fixture that reports what a sixty-saga sample never
   touches and bars what must not go to nought, and a static gate lint in
   `test/events.test.ts` — every `when` naming a building, a lore or a flag
   must name one that exists, and no card may be locked behind a flag only
   it sets. Original text follows.
   **[ ] (as written)** Everything
   above came from a throwaway that was deleted afterwards, which is exactly
   how the coast stayed broken for weeks behind a green suite. A standing
   test that plays a sample and reports what was never reached — cards,
   buildings, verbs, lore, systems — with bars on the ones that must not go
   to zero. It also names the twelve cards that never draw and why: two need
   the sea (`driftwood`, `a-lean-sail`), the rest need states bands do not
   live long enough to enter (`wood-runs-low`, `the-runaway`, `the-yarrow`).
   The generalised form of the coast lesson: **every system needs a bar, or
   the one without a bar is the one that is broken.**

7. **[x] A second bot, playing differently.** Done, and it produced the
   most uncomfortable result of the audit: **the settler — the one strategy
   every figure in this document describes — is the WORST of the three**,
   and turtling behind a palisade is the best by a wide margin. See the
   changelog. Original text follows.
   **[ ] (as written)** Every number in this document
   describes ONE strategy: settle early, work jobs, hold the line, trade for
   a friend. Whether the game supports a second viable line — the raider who
   takes what he needs, the turtle who never leaves the palisade — is
   completely unknown, and "there is more than one way to play" is a claim
   the project has never tested. Two policies over the same sixty seeds, and
   the interesting result is either one.

8. **[x] Despair and hunger are three quarters of all endings.** Done, and
   the answer was neither of the two the item offered. It was not the
   survival game working and it was not three systems collapsing into one:
   **it was one system wearing three names.** Twenty-eight of thirty despair
   deaths had an empty larder. See the changelog. Original text follows.
   **[ ] (as written)** despair 23,
   starved 22, slain 10, frozen 2. Steel and cold barely kill; the two
   survival meters do nearly all the work, and despair is downstream of the
   others (see the dead-ends table — three morale levers moved nothing
   because despair is a symptom). A death table this lopsided means most of
   the game's threats resolve into the same two numbers. Worth deciding
   whether that is the survival game working or three systems collapsing
   into one.

9. **[x] What ruling is actually worth.** Done. It was worth five things
   and every one of them made the game harder — ruling was a difficulty
   setting with a name on it. A jarl is owed and a jarl draws men now, both
   paid out of standing. See the changelog. Original text follows.
   **[ ] (as written)** Five jarldoms across forty sagas,
   and `yearsRuled` is the only thing that changes when one is won. 6.4 made
   the endgame endless on the argument that a trophy is not a game — but
   after the Thing carries, the coast gets `JARL_WORD` harder and nothing
   else is different. Either ruling changes what a day looks like, or the
   proclamation is the ending it was rewritten not to be.

10. **[x] Screen-reader and touch semantics.** Done, and the measured gaps
    were not the ones the item guessed at: names and touch targets were
    already right (one button was 43px wide), and what was missing was
    everything about CHANGE. See the changelog. Original text follows.
    **[ ] (as written)** Six `aria-`/`role` attributes
    in the whole render layer, on a game whose primary target is a mobile
    browser. Touch targets and portrait layout have had attention; assistive
    technology has had none. Low glamour, genuinely small, and the kind of
    thing that never gets done once there is a v1.0 tag.

**Seed challenges shipped 2026-08-11** (item 10 of the 2026-08-07 queue,
carried for four days). A challenge is a line of text — `LN1
grim-fjord-100 fair d128 w2 jarl` — pasted into the seed box that was
already on the title screen, so there is no new screen and no new button.
It carries the TERMS as well as the seed, which the bare seed never did and
which is half of what a shared run means. The ending screen says whether you
beat it and hands you your own code.
Deliberately not base64: this is played on phones, and a code gets pasted
into a chat, wrapped by an email client and retyped with a thumb. A readable
format survives all of that — a truncated code still lands you on the right
coast — where one wrong character of base64 produces silence. What it does
NOT do is prove anything; a mark is a claim, as a seed challenge has always
been, and `scripts/play.ts` is where a claim can actually be checked.
The v1.0 release's two at-home steps
(GitHub Release targeting `main`; DNS `CNAME landnam -> rcjlabs.github.io`
BEFORE the Pages custom domain and Enforce HTTPS) are still Evan's.

## The next queue — audit of 2026-08-07 (evening)

Written after the first ten were cleared, with the phone photograph of the
stuck build panel fresh. Ordered: the first three are things the game is
currently getting WRONG, the middle four are depth on systems that already
exist and are underused, the last three are reach. Every one names how it
would be measured, because an item that cannot be measured is a wish.

1. **[x] The champion should survive the battle.** Done: he belongs to the
   clan that sent him, walks off any field he was not put down on, and
   comes back under his own name with his scars on him. Measured recurring
   in real sagas — 6 came back, 17 were put down for good, over 60 runs. Item 6 of the last
   queue landed half: champions are born and die inside one fight. Give a
   beaten-but-not-killed champion an escape at low nerve, store him on the
   hostile neighbour that sent him, and let him come back harder, angrier
   and remembered — "the man who burned the smokehouse two winters ago".
   The Person model, the feud system and the grudge weights all already
   exist; this is mostly persistence plumbing on top of work that shipped
   today. Measured by: a long-game harness run reporting how often a named
   foe recurs, and the saga naming him more than once.

2. **[x] The first winter is a cliff nobody is warned about.** Done, and it
   was measured before it was designed: settle by day 16 and 21% see spring;
   settle on day 29 and 4% do. The cliff is real, so the mark now says when
   it cannot be met — verified at 82% deadly against 0% for bands it clears. The reported
   phone save was day 26 with 0 of 274 wood and 4 of 162 food, no roof, six
   people — a run already lost that has not been told so. The deaths table
   says the killer is grief, not stores, but that is measured over sixty
   BOT runs that settle early and work perfectly. Measure the human case:
   time-to-first-longhouse across seeds, and what fraction of settle-days
   leave a band unable to reach the mark at all. Then either move the
   opening or make the advisor say the true thing loudly — "you cannot
   reach spring from here; go raiding or move" is a fair thing to be told
   on day 26 and a brutal thing to discover on day 50.

3. **[x] No difficulty setting.** Done: three countries, each measured over
   the same sixty seeds — 75% / 27% / 10% seeing the first spring — chosen at
   the landing and carried on the run rather than in preferences. The settings menu shipped with sound,
   motion and the guide; difficulty is the obvious hole. Three named
   settings driving the knobs the harness can already read — event chance,
   raid pressure, winter severity, starting stores — with each one MEASURED
   over the 60-seed curve so the labels are honest rather than decorative.
   This is also the cheapest answer to item 2 if the opening turns out to
   be too hard rather than too quiet.

4. **[x] Reach weapons, and the wall gets deeper.** Done: a spear thrust at
   range 2 past a shield-brother, symmetric for foes. The formation bar
   widened from 5 bodies to 21, which was the bar this item set itself. Everyone carries one
   throw and then swings. Spears that strike at range 2 from the SECOND
   rank would make the shield wall a formation with an inside and an
   outside rather than a line of equals — the single highest-value combat
   addition left, and it compounds directly with the wall-push and
   glancing-turn rules that shipped today. Bows for foes as the pressure
   answer. Measured by: the formation-vs-brawl bar must widen, not narrow.

5. **[x] Buildings should tier, not just multiply.** Done: great hall
   replaces longhouse, earthworks replace palisade, each consuming the last.
   `standsFor` keeps every by-name read honest across an upgrade. The late tier and the
   repeatable búð answered "the queue must not end" horizontally. Vertical
   is better: longhouse → great hall, palisade → earthworks, each
   consuming the last and raising what it granted. It gives a surplus
   somewhere to go that is not a row of huts, and the authored raid fields
   can read the wall tier the way they already read the palisade.

6. **[x] The threat clock should be visible.** Done: the watch mark names
   the chance and every term moving it, derived from the same arithmetic the
   dice roll against rather than a second model of it. Watch and palisade buy raid
   chance down invisibly; word and wealth push it up invisibly. A player
   defending against a number they cannot see is guessing. Show the
   pressure and what is driving it (winters stood, what you have taken,
   who is angry, how rich the hall looks) — the same trick as the winter
   mark, which is the single most successful UI in the game.

7. **[x] People need kin, not just stats.** Done: two pairs among the six,
   with real ties, a heavy personal grief when one is lost, an extra nerve
   shock on the field, and a line on the warband page naming who is whose. Grudges, morale and traits
   exist; relationships do not. Who is whose brother, who came off the
   knarr together. Despair ends more runs than anything else, so grief is
   already the game's chief killer — make it legible, and a death reshapes the
   survivors in a way the player can see coming and work against.

8. **[x] The sea wants its own verbs.** Done: the strandhögg — falling on a
   coastal place from the ship. Fewer of them and shaken, a bigger hold, a
   heavier standing hit, and a sea fight's stakes if it goes wrong. Hull, cargo and sea fights shipped,
   but rowing is still just walking on water. A coastal raiding run — load
   the knarr, go out for N days, hit places along the coast, come home
   heavy or not at all — would turn the sea into the game's risk engine
   and give the plunder economy somewhere to point.

9. **[x] The long game is untested at scale.** Done, and it immediately
   found a harness bug that had hidden the entire endgame: the bot's winter
   reassignment wiped its own builder, so sagas reached day 259 with 160
   firewood and NOTHING built. Fixed, and the endgame is measurable at last. The curve harness stops at
   day 169; a jarldom needs two winters plus the Thing, so 6.4 shipped
   with NO harness coverage of the thing it created. A day-500 run over
   fewer seeds, reporting what actually kills a jarl and whether the
   escalation keeps up, is the honest follow-through on today's work.

10. **[ ] Seed challenges, and a saga worth showing.** Deterministic RNG
    plus a copyable saga is most of a challenge mode already. A daily or
    weekly seed, a compact result code, and a "compare sagas" flow costs
    little and is the thing that makes anyone talk about the game to
    anyone else. Meta-progression stays out — the run is the unit.

## Dead ends — measured, and not to be repeated

Every one of these was built, measured, and reverted or corrected. They are
here so the next attempt does not begin by repeating them.

| Attempt | What happened |
| --- | --- |
| Raid pressure rising with the steading's fame | No curve change at three magnitudes. **The reason was a clamp, not the design** — see below. |
| Winters deepening with the years, alone | Zero change for a careful player AND a careless one (18/40 either way): the winter mark was a perfect forecast, so the band simply stocked to the bigger number. Shipped later as 6.1, once the mark was made vague. |
| A landing chosen near settleable ground | Fixed a real problem (settleable ground a median 5 and up to 11 hexes from the sand) and broke a bigger one: where you land decides where you fight, and on the worlds it produced the shield wall went dead level with charging in — 33 wins/157 standing became 32/158 over sixty seeds. Rejected. |
| Rolling a raid every day instead of drawing one from the deck | Shipped after tuning. The first rate took `test/thing.test.ts` from 4 of 4 bands reaching the endgame to 1 of 4; measured at 0.006 → 1/4, 0.003 → 3/4, 0.0015 → 4/4. Raids now fire regularly and the curve STILL does not move, because bands hold them and losing one costs only stores. |
| Defensive buildings, as originally priced | A palisade added 0.4 to raid difficulty for being another roof and returned 2 x 0.18 for being a wall: **net +0.04, so building one made raids harder.** A watchtower was +0.22. Every defensive building but earthworks was a trap, and no amount of preparing moved a hold rate of 2-in-40. |
| One extra raider per point of difficulty | A steading is defended by about four people, so a single point swung the odds by a quarter: the gauntlet held 5/8 at d0 and 1/8 at d1. That leaves no room for the palisade, the watch and the site to mean anything — every term they move is worth less than the rounding. Halved for raids; open-field fights untouched. |
| A defending bot that climbed its own palisade | The move scorer knew about gaps and shoulder-mates and nothing about `WALL_EXPOSED`, so a band under attack walked onto the stakes — the worst tile on the field, and the one the wall exists to put THEM on. Worth 20% to 33% of raids held on its own. |
| Teaching the bot to DASH into contact | Priced at a third of the wins and a third of the survivors over sixty arena fights (22/108 against 33/162). Not a bug — spending the turn's action to arrive sooner means arriving alone and already spent, which is the charge the shield wall is measured against. The bot does not dash; the A/B is kept executable in `wall.test.ts`. |
| Measuring a combat verb on the survival curve | The four verbs looked harmful (11 bands seeing spring falling to 8) on an instrument that ends only one run in six on steel. The arena found the real answer, and it was a different one: three of the four were neutral. **Match the instrument to the effect.** |
| Guaranteeing a four-wide front on every battlefield | Shipped, but currently inert: no terrain the game ships ever fails it. A regression guard on tunable data, not a fix. The real mechanism is row DENSITY — 98% of meadow rows can hold a line against 40% of ocean ones. |
| Sweeping the morale levers the death table kept naming | Winter sickness DC 9→7, bereavement 12→7, kin grief 30→15 — all three, and two winters sat at 10% through every one. Despair was a SYMPTOM. A band that misses the winter mark takes 8 morale a day for hunger and 7 for cold plus wounds, so it dies of everything at once and despair merely arrives first. The lever was arithmetic: `SHELTER_SAVES`. **And it was worse than a symptom — see item 8: the label itself was wrong.** |
| Reading the death table without reading the larder | "Despair ends more runs than hunger, cold and steel put together" stood for three audits, sent three sweeps of the morale levers to nothing, and is a large part of why the kin system exists. Measured with the STATE at the moment of death: 28 of 30 despair endings had an empty store, averaging one food. It was hunger under another name, and the ending told the player to manage morale. **A cause is not a diagnosis. Record the state, not just the label.** |
| `SHELTER_SAVES` at 1.0 | Fixed survival and broke the game's central promise. `SHELTER_MAX` is 6, so 1.0 means a fully built steading cancels an ordinary winter's burn outright — and over 24 winters, heeding the mark against ignoring it went 19/6 at 0.7, 19/8 at 0.8, **19/17 at 1.0**. Preparing for winter had stopped mattering. Settled at 0.8. |
| "Easier fights settle bands sooner, so they stop walking past the markets" | The hypothesis that held hardship-steel off the tree for a day, and it is false in every term. Settle-rate 28/30 either way, founding day 13.1 either way, road-days 460 → 432, sagas reaching a counter 6/60 → 6/60. The real fault was the bar: `markets` counted trade DAYS, and twelve of fourteen came from one band that settled beside a live counter. **A count of days is not a count of reach.** |
| "Word of mouth is what starves the place economy — widen it" | Aimed at a real constraint and measured as a weak, saturating lever. Telling more than one place per bargain does **nothing at all** (2 and 3 byte-identical to 1, at every range — and the mechanism was checked to fire before the null was believed): at bargain time there is never more than one unseen place in a teller's reach. Widening the RANGE moves places-ever-seen 53/120 → 59 at sixteen → 61 at twenty, where twenty already covers the whole coast. The tap is the number of bargains (~1–2 a saga), not the width of the pipe. |
| "A band that trades out beats one that never leaves" | Held on a margin of ONE seed in eight, which by this repo's own noise floor is weather. At 24 seeds the survival arms sit level or behind (19 against 21) — correctly, because the roof is a home thing. What going out actually buys is stores: nearly 4× the timber home. Bar rewritten to the effect that is real. |

**The lesson under most of these:** four null results in one day, and the
worst of them was measuring plumbing rather than design. Raids were capped at
nine; against six sworn the foe roll saturates that cap at difficulty four;
and difficulty itself was clamped at six. Everything the coast felt about you
past that was discarded by a `Math.min` before it reached a battlefield.
**Before trusting any null result, check that the mechanism can physically
produce a non-null one.**

**A system nobody can reach is a system that does not exist.** The coast —
four named neighbours, standing that remembers, barter, tribute, the friend a
jarldom needs — was fully built, fully unit-tested, and unreachable. Placement
had a floor (6 hexes off the landing) and no ceiling, so on an 1872-tile
landmass the four of them scattered: measured at 6, 12, 26 and 27 hexes from
one steading, and 23, 24, 25 and 38 from another. A band sees 2–7% of that map
in a whole 500-day saga. The result: **0 of 32 clans met across eight
full-length sagas, and 0 of 40 sagas ever made a friend** — so no Thing could
be called at either difficulty, and the entire endgame was dead content behind
a green suite. Every other need on the Thing's checklist had a bar; that one
did not, so it failed in silence. **Every requirement an endgame names needs
its own bar, or the one without a bar is the one that is broken.**

**The harness is code, and it has now been wrong seven times.** The worst
four: it did not fight back on the battlefield (which put "slain" at the top
of the death table and made the game look far crueller than it is — teaching
it to swing took the two-winter figure from 0% to 51%); a cheaper single-pass
rewrite disagreed with itself by forty points; its build list said
`farm-plots` where the building is `farmplots`, so that entry silently never
queued; and — the largest — its run loop treated any refused action as the
end of the saga while its bot proposed battle moves the engine refused, so
HALF of every sixty-seed sample was truncated mid-battle and counted as
alive at every milestone. Every curve figure this document carried before
2026-08-07 sits on that artifact. **Every time the game gains a capability,
the bot must gain it in the same commit**, or the measurement reports the
new thing as worthless — and a run that stops must be a run that DIED, or
the measurement reports the dead as living.

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
- [~] **5.4 Release** — v1.0 tag, `landnam.rcjlabs.com` CNAME. THEN decide TWA/Capacitor wrap (stay web during development). *Tagged; the CNAME's two steps (DNS, Pages setting) are written into queue item 10.*

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
- [x] **6.2 Hands** — The band can grow: thralls taken, survivors taken in, a
  neighbour's sons. Losing people becomes recoverable, which is what makes
  losing them affordable to inflict — and the labour surplus becomes a choice
  instead of a given. THE unlock for everything below.
  *Done: the fire scales with the band, a person is sworn or a hand, the
  steading holds who it has room for, three cards bring people in, and hands
  who have had enough walk out. The curve did not move — growth is possible
  but rare, and it takes 6.3's pressure to make a bigger band necessary.*
- [x] **6.3 Overwhelming force** — Raids that outscale six warriors, so the
  answer is walls, allies and standing rather than a bigger woodpile. Makes
  4.3's neighbours load-bearing.
  *Done: raids field up to fourteen, provocation reaches the field, and a
  steading worth taking is now visited on its own schedule rather than when
  the deck happens to offer it. The curve still has not moved — bands hold
  the raids. What a LOST raid costs is the remaining lever: it takes stores,
  and stores are the one thing a settled band always replaces.*
- [x] **6.4 No last winter** — Done. A run goes as long as it is held: the
  Thing grants a jarldom instead of writing an ending, and the closing is a
  deed the player takes when they are ready. The rule costs what it is
  worth — +3 word and +2 raiders, both proven to bind rather than vanish
  into a clamp. The Thing is a milestone in a saga now, not its final page.

---

## Parking Lot (ideas, not commitments)

Naval battles · winter solstice festivals · named legendary weapons · bloodline/generation play · daily-seed challenge mode · god-favor system

## Changelog

- **2026-08-25 — The steading in oil** — the painted renderer reaches colony,
  and a second person who was not there.

  The world map's backdrop is a careful thing: a canvas sized to the charted
  bounding box, a ledger, and a proof that no hex is ever painted twice.
  Almost none of it applies to a steading, which is a handful of plots you can
  see all of at once. So the ground is painted whole — and what it is careful
  about instead is WHEN.

  `describeColony` rebuilds its whole description on every repaint, and almost
  every repaint changes only where people are standing. So the painting is
  kept until the GROUND changes: a new plot, a plot that became different
  ground, a different world. Somebody taking a job, somebody dying, a
  longhouse going up — none of those reload the brush, because a raised
  building is drawn on top as SVG and people were never part of the paint.
  Measured in the built page: six repaints in a row, six reuses, zero
  repaints of the ground.

  It mounts INSIDE the colony SVG, in a `<foreignObject>` at the scene's own
  world bounds. The colony map has no camera — it sizes itself with a viewBox
  and letterboxes into whatever box the panel gives it — so a sibling canvas
  would have to reproduce that fit and stay in step through every resize. A
  foreignObject is carried by the viewBox for free and cannot drift out of
  register. The bar checks it lands within 0.001 world units of the ground it
  paints.

  **It holds the live canvas, and that is worth 320 ms.** The first cut put a
  `canvas.toDataURL()` into an `<image>`, which works — and opening the
  steading took 455 ms against the drawn one's 18 ms, which is a hitch you can
  see and would be over a second on a phone. Split apart, the brush was not
  the problem:

  | | laying the paint | encoding the PNG |
  |---|---|---|
  | 2136x1909 | 47 ms | **268 ms** |
  | 1246x1113 | 21 ms | 136 ms |

  Nothing needed the PNG. The canvas is already something the page can draw,
  and a foreignObject can hold it directly. Opening the steading went from
  455 ms to 84 ms with the picture unchanged to the eye.

  This is the second time on this arc that the obvious cost was not the real
  one — the world map's was the canvas SIZE, not the strokes. Both times the
  fix came from measuring the halves separately rather than tuning the part
  that looked expensive.

  **The brush is now one brush.** `paintPatch` came out of `paintGround`:
  everything sizes off a radius, so the same code paints a world hex at 26 and
  a plot at 34. Two knobs came out with it, because a steading is not country:

  - *bleed* — on the map, generous bleed dissolves the lattice and a hex's
    overspill lands on the country beside it. A steading has an OUTSIDE, so
    the same bleed fringed the whole thing with spikes against the dark. 1.16
    on the map, 1.02 here.
  - *grain* — a plot is a third bigger than a world hex and seen at much the
    same size, so marks that scaled with it read as scattered rice. Finer
    marks, and proportionally more of them to hold the cover.

  The extraction had to leave the map's painting untouched to the pixel, and
  the check for that already existed: the repaint bar measures the glaze
  lattice at a fixed seed. 10.2% before, 10.2% after.

  **Six people with jobs drew four.**

  Yesterday's fix counted the crowd on a plot per JOB. But the wood is worked
  by the hunter AND the woodcutter, and each of them thought they were first
  to arrive, so both stood dead centre — a hunter and a woodcutter on one
  wood were one figure. Two counts now, answering different questions: `taken`
  is per job and picks WHICH of that job's plots you walk to; `crowd` is per
  plot and decides where you stand once you get there.

  This was found by looking at the screen — the tests were green, the seam was
  committed, and the picture had four people in it where the state had six.

  `scripts/steading.mjs` is the browser witness, and it is on `npm run bars`
  from the start this time. Three claims, none reachable from a unit test: the
  paint lands on the ground it paints, everybody with a job is drawn and no
  two in one place, and moving people does not reload the brush. It reads
  pixels back off the canvas rather than trusting the brush was called — a
  frame in the right place holding nothing would otherwise pass. It runs both
  backends, because the middle claim is about the drawn steading too, and when
  the per-job counting is put back both fail it. Twelve bars now.

  `window.landnam.settle()` puts the steading up, because reaching the colony
  screen honestly is a long walk for a test that only wants to look at it. It
  fabricates the journey, not the rules: it marks the ground seen, then asks
  `canFound` like anybody else.

- **2026-08-25 — Where your people stand** — the colony seam, and a bug it
  found in its first hour.

  `render/colony.ts` decided and drew in one pass, like travel did. The
  decision moves to `render/colonyScene.ts`. It matters more here than the
  file size suggests: the whole point of drawing the steading is that
  assignment is a thing you SEE — put someone on the fields and a figure
  appears in the fields — and that promise could only be checked by reading
  SVG attributes out of a browser, so it never was.

  **Nine workers on three plots drew three people. Every warrior in the band
  drew one.**

  The nudge that spreads a crowd within a plot came from the running count:
  `(nth / plots) * 2pi`. The fourth farmer of three fields goes back to the
  first field AND back to an angle of 2pi, which is the first farmer's place
  down to the pixel. The steading could never show more figures than it had
  plots for that job, however big the band grew:

  | workers · plots | drawn, as shipped | drawn now |
  |---|---|---|
  | 4 · 2 | 2 | 4 |
  | 6 · 3 | 3 | 6 |
  | 9 · 3 | **3** | 9 |
  | 12 · 4 | **4** | 12 |

  It is worst where the divisor is 1. `warrior` is worked by the watchpost and
  `builder` by the hall, and there is one of each: `nth / 1` is a whole number
  of turns for every single person, so all of them landed on the same point to
  fifteen decimal places. The watch drew **one figure** whether two stood there
  or twenty-five.

  | warriors | drawn, as shipped | drawn now |
  |---|---|---|
  | 2 | 1 | 2 |
  | 12 | **1** | 12 |
  | 25 | **1** | 25 |

  The nudge comes from the ROUND now, stepped by the golden angle so no two
  rounds can ever coincide, and the first person on a plot stands in the
  middle of it rather than off to one side.

  Fixing that exposed a softer version of the same thing. A ring puts every
  round at one radius, and a head is 7.5px across at HEX 34: the eighth
  person to reach a plot lands 5.7px from a neighbour, which is hiding again
  under another name. No job has a headcount cap, so with one watchpost that
  is eight warriors — an ordinary band, not an extreme.

  So the nudge spirals rather than circles, widening by the square root of
  the round. Every head stays clear up to twenty-one on one plot instead of
  seven, and a clamp keeps the last of them on the plot rather than out on
  the grass. Past twenty-one they touch — twenty-five figures this size do
  not fit in one plot without drawing them smaller, which is a different
  change — but they never coincide, so nobody vanishes.

  This is a shipped bug, not one the refactor introduced — the old formula is
  above and it is the one that was live. It was invisible in exactly the way
  the repaint duplicate check is invisible: the second figure is drawn, it is
  simply drawn underneath the first.

  `test/colonyScene.test.ts` pins fifteen claims that nothing could reach
  before — a worker stands on ground their job is worked on, nobody with no
  job stands anywhere, the dead stand nowhere, a crowd spreads across the
  plots it has, nothing is hidden under anything, a raised building never
  lands on the hall and is drawn over the ground rather than under it, and the
  frame never clips a plot, and a whole band on one plot neither overlaps nor
  spills off it. Eight mutations run against it, all caught — including the
  ring this change replaced, which the new bar catches at 5.7px, and the
  spiral with its clamp removed, which walks a figure 25.8px off centre onto
  ground it does not belong to.

- **2026-08-25 — The glaze tiles instead of stacking** — remembered country
  had a dark grid along every hex seam, and it was the flat glaze overlapping
  itself: a translucent layer drawn at an eighth of a hex past its own edge
  puts TWO half-dark plates in the band two neighbours share.

  Pointy-top hexes tile exactly at their circumradius, so the flat layers are
  drawn at 1.0 now and only the strokes cross the seam. The opaque ground
  keeps a hair of overlap at 1.03, where overlap costs nothing and hides the
  anti-aliased hairline between two fills.

  | | seams vs middles |
  |---|---|
  | glaze at 1.12 — overlapping | **28.3% darker** |
  | glaze at 1.0 — tiling | **10.2% darker** |

  The 10.2 that remains is not stacking. It is the anti-aliased line where two
  fills meet, one pixel wide, and unavoidable for any two translucent shapes
  that share an edge. Said out loud rather than rounded to nothing.

  The fog did not pay for it: remembered country still reads 35–46% darker
  than the same terrain in the light, across three terrains.

  **Three things about the measurement were wrong before it was worth
  keeping**, and every one of them would have shipped a bar that lied.

  *The metric was confounded by terrain.* The midpoint of a seam between a
  meadow and a forest is a blend of the two, so with the lattice gone the
  number was measuring terrain variance. Only same-terrain seams are sampled.

  *Sampling the screen destroyed the thing being sampled.* Seeing a field big
  enough to measure means zooming out, and zooming out is exactly what blurs a
  one-pixel seam away. The bar asks the PAINTING now, in world units, through
  `window.landnam.painted()` — the renderer answering for itself, as
  `drawn()` already does.

  *The bar never fixed a seed.* Every run was a different country, and the
  same unchanged code measured 9%, then 16%, then 10%. A threshold on an input
  that varies run to run is not a threshold, it is a coin flip, and it would
  have flapped in CI forever. With a seed it reads 10.2% twice.

- **2026-08-25 — A bar that can see both renderers** — `scripts/repaint.mjs`
  guarded the SVG map by counting children of the terrain layer. The painted
  map hides those layers, so the bar went silent on the new renderer at
  exactly the moment a second renderer made the claim worth checking: it
  would have passed a backdrop that painted every hex twice, or grew without
  bound, or never dimmed anything.

  The claim was never about nodes. It is that a hex is built ONCE, that the
  chart never loses country, that country left behind goes dim, and that a
  repaint charting nothing costs nothing. So the renderer answers for itself
  through `window.landnam.drawn()`, and the same four claims are made of both
  backends. The DOM is still read where it is an INDEPENDENT witness — the SVG
  path can leave a node behind that its own bookkeeping has forgotten, and
  only the document knows that.

  **Three holes were found by trying to break it, and every one of them was in
  the bar rather than the renderer.**

  *The duplicate count was vacuous by construction.* One call incremented both
  "passes the brush made" and "passes the repaint owed", so they could never
  disagree. A backdrop mutated to paint every hex twice sailed through. Owed
  is now set from the diff and passes are counted inside the brush, so an
  extra call to the brush is counted whether or not the caller meant it.

  *The still-map check tapped dead space.* Six clicks on an empty corner,
  which the app is entitled to ignore entirely — so a backdrop that threw its
  cache away and repainted the whole chart every turn was never asked to paint
  at all. It commits a state through `stock` now, which re-renders exactly as
  a dispatch does and charts nothing. That mutation now costs 402 extra hexes
  and is caught.

  *Nothing was ever revealed in the dark.* Country is always first charted from
  close enough to be lit, so the glaze-on-reveal branch never ran on the
  itinerary and deleting it changed nothing. A remount does chart a pile of
  remembered hexes in one go — the same path a loaded save takes — so the bar
  rebuilds the view over charted country and checks the ledger again. That
  mutation now trips two separate checks, one of them the user-visible one:
  *a remount lit every hex — remembered country came back to life.*

  Seven mutations, six of them in the painted renderer, all caught. A bar that
  cannot see the thing it is guarding is not a bar.

- **2026-08-25 — The country, painted** — the oil renderer, behind `?paint`.

  Ten art directions were mocked up and three shortlisted; oil on canvas won.
  The objection to it was never taste, it was arithmetic: a painting sounds
  impossible because you picture repainting one whenever anything happens.
  You never do. **The game is turn-based — no `requestAnimationFrame`, by
  rule — so a hex is painted ONCE, on the turn it is first charted, and never
  again.** Measured here: 2.85 ms to paint a revealed hex, 1.03 ms to blit
  the viewport, and the cost per turn does not grow as the painting does.

  **Two experiments gated it and both passed.**

  *Zoom.* A canvas painted at the opening zoom keeps 85% of its sharpness at
  0.55x — visually identical — and **46%** at full pinch, measured as mean
  |Laplacian| against the same patch painted natively there. Soft, not broken;
  it reads as a canvas you have moved closer to. Painting at 2.0x instead
  would fix it and comes to 4864 px on the long axis, which iOS Safari
  refuses. So 1.35x is a ceiling, not a preference.

  *Fog.* The one expected to fail. Opacity greys an oil painting and kills
  it; a **scumble** — a cold, thin, dry glaze dragged over the marks already
  there — does not. Remembered country measures **39% darker** than the same
  terrain lit, and is still recognisably the ground the band walked on. That
  is what `terrainPatterns()` already guarantees for the SVG map — the light
  goes out of it, the trees do not move — carried over to paint.

  **A published figure was wrong and is corrected.** "17.8 MB for the world
  canvas" assumed 60 *device* pixels per hex; at dpr 3 a hex is 182, so the
  whole world is 9667x5845 and 215 MB. The canvas is sized to the SEEN
  BOUNDING BOX instead, which is the only thing that works — replaying
  `runs/long.json`, a saga that runs 531 days to its end charts **78 hexes in
  a 17x11 box**, 3283x1896, 24 MB.

  **Nothing is stored.** Every stroke comes from a stream derived per hex from
  the seed and the coordinate, the same derived-not-stored trick skerries and
  landmarks use. No save change, no `SAVE_VERSION` bump, no migration — and a
  hex paints the same marks at any scale, so a sharper repaint would be the
  same painting rather than a second one.

  **The flag cannot break the shipped renderer.** The SVG picture layers are
  still built exactly as they were and are only hidden, so the two paths share
  no code. Landmarks moved to a layer of their own first, because they are
  wayfinding rather than picture and hiding one must never hide the other.
  With the flag off the map draws byte-identically: 614 node signatures across
  11 frames, unchanged.

  **What the first real screen exposed, which no mockup had.** The paint was
  handsome and the map was unreadable — a whole screen of bog, meadow and
  valley came out as one khaki, because strokes nearly a hex long and a
  generous bleed had dissolved every terrain boundary, and a shared warm
  highlight had dragged every hue together. Bleed 1.34 to 1.16, strokes to
  half their length, bristles cut from each stroke's own colour. Legibility
  first: a map is read before it is admired.

- **2026-08-25 — What the map shows, and how it is drawn** — `render/travel.ts`
  did both jobs in one pass, which is fine with one renderer and untestable
  with one renderer. The decision moves to `render/travelScene.ts` as plain
  data in world coordinates.

  Split deliberately into `describeGround` — the half of a hex that NEVER
  changes — and `describeLight` — the only half that can, because that is the
  invariant the build-once repaint path rests on, and putting it in the type
  is how the next renderer inherits it instead of rediscovering it. The first
  cut answered both in one call and quietly put six tile lookups per relit hex
  back into every turn.

  Verified as a pure restructure by fingerprinting `svg.map` on a fixed seed
  over a ten-step walk: identical before and after. `test/travelScene.test.ts`
  pins thirteen claims no test could reach before, and six mutations of the
  source were run against it to check it can fail. Three of those tests were
  vacuous when written and are now built rather than replayed, because
  `runs/long.json` flags a rocky crossing zero times in 1,585 actions,
  relights no river hex in 900, and puts the band within sight of seen water
  on exactly one turn.

- **2026-08-25 — Pin what the terrain patterns are for, not how many there
  are** — `npm run repaint` was red and had been since the deep got its own
  lit/dim pair: eight terrains became eight terrains and a deep, 16 became 18,
  and the bar still asserted 16. It went unnoticed because `repaint` was not
  in `scripts/bars.mjs`, so `npm run bars` never ran it.

  18 is correct, so the count was not the thing to restate — a count has to be
  restated every time art is added and nobody remembers to, which is exactly
  how it drifted. The bar now pins the invariant the patterns are *for*: every
  terrain fill is stamped twice from the same marks, bright and dim. It
  catches a fill with no dim twin, a dim with no light, and a pattern that is
  not a terrain fill, and it stays quiet when a ninth terrain arrives.

- **2026-08-24 — The hall will take one more** — item 30. `crowding` was
  unreachable, and the reason was not that roofs are generous.

  **Two deliberate designs, both tested, pointing opposite ways.**
  `sim/joining.ts` said "a hall with no spare bed turns people away, and that
  refusal is the whole reason capacity exists", and had three bars saying so —
  one of them naming the stake: "it is what makes a búð worth five timber".
  `sim/sickness.ts` built its entire tradeoff on the other side of that line:
  "taking in another pair of hands is more work done and one more chest by the
  fire; past what the roof has room for, it is also how a bad week becomes a
  bad winter."

  There was no past-what-the-roof-holds. Over sixty sagas to day 400
  `crowding` returned zero on EVERY settled day, and the tightest a hall ever
  got was *exactly full* — the slack bottomed out at 0 and stopped. So
  `CROWD_BITE` multiplied nothing, spread ran at its floor of `CATCHING *
  down`, and `CARE_GUARD` guarded a floor. A shipped mechanic sat behind a
  precondition another file forbade.

  **The roof is a comfort you build for now, not a gate that silently stops
  the band growing.** `OVER_ROOF` is three — the number who can sleep on the
  floor between the benches. The refusal is still real and still falls, three
  later; a búð still buys the difference between crowded and comfortable.

  **The half-fix is worth recording, because it looked like a fix.** Lifting
  the cap inside `takeIn` changed nothing at all: the door closes in
  `drawOdds`, which returns zero at `roomLeft <= 0`, so at a hall exactly full
  nobody ever arrives to be crowded in. A gate behind a gate, and only the
  outer one was visible. Both had to read the same number.

  **What it bought:**

  | | before | after |
  |---|---|---|
  | crowded days, no healer | 0 | 309 |
  | crowded days, a healer | 0 | 626 |
  | illness per day lived, no healer | 0.52 | 0.58 |
  | illness per day lived, a healer | 0.45 | 0.54 |
  | tightest slack ever | 0 | −3 |

  Growth now costs something, and the healer's guard finally has something to
  guard. The first-winter curve holds at 86/52/15 against a published
  86/53/17 — crowding happens after settling and growth, past the day the
  curve stops. The long game is harder: bands take in people they must then
  house, and day-400 survival in the probe fell 4/30 to 3/30 untended and 7/30
  to 6/30 tended.

  **Three bars were restated, not loosened,** and one wrong turn was found in
  a fourth. The three now say where the refusal falls rather than that it
  falls at the last bed. The fourth — `the winter mark shrinks as the winter
  is walked through` — was walking from autumn to autumn and never entering
  winter at all: `forecast` accumulates `max(0, mouths - grown)` a day, so a
  day the fields cover contributes nothing and dropping it off the front
  changes the food figure not at all. It passed only by accident of band size,
  and the change exposed it. It walks thirty days into the frost now, and
  pins the roster so a join cannot masquerade as the countdown.

  Both recorded runs were re-recorded, which is what `runs/README.md` says to
  do: "if it ever starts refusing actions, that is a rules change worth
  knowing about — not a broken test." `example.json` did not need it and was
  put back — a re-record produced a worse artifact, 23 actions to a day-24
  starvation against the 66 it had.

  Thirteenth rule for the port, and this one the contract can see. 1219 tests,
  all ten browser bars.

- **2026-08-24 — A winter illness mends for a healer and for nobody else** —
  item 29, which set out to make the healer worth a hand and instead found it
  already was, and corrected a wrong finding of my own.

  **Item 25 said the healer bought nothing. That was the instrument.** It
  counted bands that SAW SPRING, and nearly every band sees a first spring, so
  the number read 17 of 30 in both arms whatever happened downstream of it.
  Counting bands still standing when the harness stops — same seeds, same
  code, one line changed in the probe — the two arms are **4 of 30 against 7**,
  and the days lived between them differ by an eighth, 4570 against 5147. The
  healer was never worthless. The measure was blunt.

  That is the fourth time this week a measurement rather than the game turned
  out to be the finding, and the probe now carries the lesson: an A/B is only
  as sharp as the thing it counts, so pick an outcome most bands do not reach
  or the arms will agree no matter what the code does.

  **The one real gap was in the season that matters.** `mendInjuries` refused
  to tick any `ill_` between the frost and the thaw — a rule with a good
  stated reason, that winter illness mending like a summer scratch would take
  the teeth out of the season. But the rule was TOTAL, and `coldNight` is
  where illness comes from, so the healer's mending lever was dead in the only
  season that uses it. Its other lever, the guard on `catchingOdds`, was
  already guarding a floor, because `crowding` returns zero on every settled
  day this harness has ever measured. Both levers off.

  So the season keeps its teeth against a hall with nobody set to tending, and
  a hall that spends a hand can nurse somebody through. Measured over twelve
  winter days: a fourteen-day illness is still fourteen days from mending with
  no healer, and 6.6 days closer with one — against 14.0 for the same illness
  in summer, so the frost still bites, it is simply survivable now.

  **It does not move the aggregate**, and that is said plainly rather than
  buried: the probe reads identically with and without it, because a hall that
  has a healer crewed AND somebody ill AND is in winter is rare in bot play —
  364 tended days across thirty sagas. It fires, it is the one thing a healer
  in a Norse winter would actually have done, and it costs no balance risk.
  What it fixes is the job's coherence, not its rate.

  Parity is unmoved for the same reason — no recorded run has a healer tending
  through a winter illness. No save change.

  1216 tests, all ten browser bars.

- **2026-08-24 — Settlers arrive with what it takes to start** — the voyage
  home made worth taking, and gated behind a store you have to build first.

  **It was measurable as a trap.** Forced to take every crossing she could, a
  band went from 5 of 40 standing at day 400 to 3, and lived a fifth fewer
  days. Two changes fixed it, and only one of them was the obvious one.

  **A voyage now needs the hall provisioned before she will sail** — a season
  of food and a season of wood banked, or the card refuses and says which is
  short and by how much. This is not a tax. It is the thing that decides
  whether the people she brings home are hands or mouths, and the measurement
  that showed it was separate: three extra pairs of hands dropped on a going
  concern take a band from 6 of 40 standing to 7 and add nine per cent to the
  days it lives, while eating the surplus down from 2934 food to 667. Six
  pairs take it to 4 of 40 — worse than none at all. **People are worth having
  exactly as far as they can be fed.**

  The first cut of the rule asked for a whole crossing's food, about 312,
  against a hall holding a median of 13 on a day it might have sailed. It
  opened for nobody, ever, in forty sagas. What it had confused is who eats: a
  crew at sea comes off the ration, so the hall is not feeding them while they
  are gone. What a voyage costs is their LABOUR, which is a season's gap and
  not a year's. Rebased on a season, the bar asks 72 food against a hall
  holding 60 on a median autumn day and 162 at the ninetieth percentile — a
  bar a working steading clears and a lean one does not.

  **And settlers arrive with a season's eating each.** This is the line that
  actually turned it. The hold used to return a flat share of itself whoever
  was aboard — about twenty food — and twenty food feeds three new arrivals
  for two days. Four separate measurements this week say the band is
  FOOD-limited rather than hand-limited: fishing grounds changed the whole
  shape of the sea by adding food; three hands help and six sink you; the
  voyage converted a banked surplus into people. A crossing that trades the
  scarce thing for the plentiful one cannot pay. Nobody sailed to a new
  country empty-handed, so now they do not.

  | | standing at day 400 | souls | days lived |
  |---|---|---|---|
  | voyage refused | 5/40 | 127 | 5684 |
  | may sail | **6/40** | **138** | 5696 |
  | every crossing she can take | 6/40 | 141 | 5696 |

  That last row is the one that matters: overusing the voyage used to read 3
  and 108. It is no longer a trap even when taken badly.

  **A wrong turn worth keeping.** The first fix attempted was shortening the
  crossing from 78 days to two seasons, on the theory that the problem was a
  payback period — two hands gone against two and a third returned, breaking
  even past the end of most sagas. It measured WORSE: 3 of 40 standing against
  4, 108 souls against 124. What comes home sooner is not only hands, it is
  mouths, arriving sooner in a hall whose binding constraint was never labour.
  `CROSSING` is still 78 and the note explaining why is in the code.

  **The bot sails again**, and its season is a tactic rather than a rule:
  autumn, not spring. The store is at its thinnest in spring — a median of 13
  food on a day she could otherwise have gone — and at its fullest after the
  harvest. And a crew at sea is off the ration, so sending two away over
  winter sheds two mouths through the season that kills.

  The published odds are unmoved at 86/53/17: a voyage needs a first winter
  behind it and the curve runs to day 73.

  Thirteenth rule the port does not have — though the contract itself did not
  move, because the parity runs are recorded action streams and none of them
  ever launches a voyage. The hashes are silent about a rule that changed.

  1213 tests, all ten browser bars.

- **2026-08-23 — The crossing has to be worth taking before it is worth
  decorating** — queue item 27 (a cargo manifest and a season of cards at sea)
  measured, and not built.

  **Both halves assume there is a voyage to elaborate.** There was not.
  `sailForHome` has existed since the ship became a place and no bot had ever
  issued it, so the crossing, what she brings back and the season without
  those hands were all unmeasured. Unlike the sea before the fishing errand,
  the door was never shut — 'home' rides the same picker as trade and raid —
  the bot simply never reached for it. So the first thing this needed was a
  bot that does.

  **Under a sane gate she sails about five times in forty sagas and changes
  nothing.** Spring only, because 78 days away means she must be back before
  the mark matters — and spring is the leanest the store ever is. Of 2527
  spring days past the first winter, **2471 were too poor to spare a season**.
  Loosening the purse from thirty days of food to ten moved that to five
  crossings and left survival flat.

  **The forced arm is the one that answers it.** Told to take every crossing
  `sailBlocker` allowed, in any season, on any store:

  | | sagas that sailed | crossings | people fetched | standing at day 400 | days lived |
  |---|---|---|---|---|---|
  | no voyage | 0/40 | 0 | 0 | 5/40 | 5684 |
  | spare 30 | 2/40 | 2 | 2 | 5/40 | 5499 |
  | spare 10 | 5/40 | 5 | 11 | 7/40 | 5888 |
  | whenever she can | 16/40 | 26 | 40 | **3/40** | **4607** |

  There is no setting at which the voyage is both common and good. Two hands
  gone through a growing season cost more than twenty food and three people
  return.

  **Which makes sense of a note left in `sim/voyage.ts` when it was written.**
  Gated on `roomLeft` the voyage brought back nobody and was called "a trap,
  not a decision"; the fix was to land people over the roof, on the grounds
  that "crowding is what makes a hall sick". Item 25 then measured `crowding`
  returning zero on every settled day of sixty sagas. So the extra people cost
  the hall nothing AND buy it too little at once, and the fix for the trap was
  resting on a mechanic that never fires.

  **The bot keeps the verb and does not use it.** `policy.sails` is false on
  every policy, and that is a finding rather than an oversight: the bot models
  an average player, an average player who sails does worse, and a bot that
  sailed would push that into every published figure in the file. The probe
  turns it on; nothing else does.

  No source changed. 1208 tests.

- **2026-08-23 — The promise was never true** — queue item 26 closed, and its
  premise turned out to be the wrong way round.

  **The item asked what drifted the curve. Nothing drifted.** As It Lies
  published 72% seeing the first spring and the harness kept measuring 63%,
  and the obvious reading was that something between the two had made the game
  harder. Re-measured at three hundred landings instead of sixty, the answer
  came out somewhere else entirely: the game runs at **53%**, and the commit
  that published 72% — `89c82c9`, on 2026-08-22 — was itself running at
  **52%** when it wrote the number.

  | | promised | at 89c82c9 (300) | today (300) |
  |---|---|---|---|
  | A Fair Country | 87% | 85% | 86% |
  | As It Lies | 72% | 52% | 53% |
  | A Hard Country | 23% | 20% | 17% |

  **The instrument was too coarse to set a promise with, and the promise was
  set with it anyway.** At sixty seeds the standard error on a rate near 0.7
  is about six points, so a single sample can sit nine or ten points off the
  truth and read like a result. 72% was one such sample, written the same day
  it was measured, and then guarded by a bar running on the same sixty seeds
  with a ten-point tolerance — a tolerance chosen precisely because sixty
  seeds cannot resolve better than that. The promise and its proof agreed with
  each other and neither agreed with the game.

  **The same disease, in a second place nobody had looked.** The menu's
  jarldom figures were published at 40% / 10% / 5% off a *twenty*-seed sample
  and guarded by a bar that also runs at twenty. At sixty the same measurement
  reads 27% / 23% / 7% — A Fair Country and As It Lies four points apart where
  the menu said thirty. At a hundred and twenty the ordering comes back, 28% /
  19% / 6%, and that recovery is the tell: a jarldom is rare, rare events need
  sample, and twenty sagas cannot see one setting from another.

  **What changed, all of it measurement rather than game:**

  - Every published figure restated from a wide sample — spring at 300
    landings a setting, ruling at 120 (As It Lies at 240).
  - `each setting is measured` now runs at **300 seeds** with a **five**-point
    tolerance, down from sixty seeds and ten. Two extra minutes.
  - The long game's default sample is **120**, up from 20, and the ruling bar
    asks for **eight** points rather than ten. About five more minutes.
  - `LANDNAM_SEEDS` and the existing `LANDNAM_LONG_SEEDS` make both
    overridable, and hardship.ts now states the rule plainly: a figure printed
    on the menu is measured at 300 and nothing less.

  **The old tolerance's reasoning was right and its conclusion was backwards.**
  It said a jarldom is rare enough that forty seeds resolve it to about a
  tenth, so the bar should be loose. The answer to a sample too thin to
  resolve a figure is a bigger sample, not a tolerance wide enough to accept
  whatever the thin one says.

  **And one rationale had quietly rotted.** The `DEFAULT_HARDSHIP` bar picked
  its quarter-of-sagas threshold off a spread where a quarter was "nearly
  double what the balanced country does". At 120 seeds the balanced country
  reaches a second winter 27% of the time, so a quarter is now just under it.
  The threshold survives on its own terms — the default country should put one
  saga in four past the thaw, and A Fair Country puts one in two — but it can
  no longer be what argues against As It Lies. The spring figure does that, at
  53% against 86%.

  No game logic changed. The menu tells the truth now, and the bars can tell
  when it stops.

- **2026-08-23 — The healer buys nothing, and the hall is never full** —
  queue item 25 (herbs as the healer's input) measured, and not built.

  **The item carried its own doubt and it was the right one to test:** does
  gating care behind a stock make the healer a decision, or just a chore? A
  resource nobody gathers, feeding a job nobody crews, to answer a problem
  nobody has, is three layers of decoration. So the layers underneath were
  measured before anything was built on them — thirty landings to day 400,
  the same seeds run twice, once with a healer in the crew and once without.

  | | no healer | a healer |
  |---|---|---|
  | person-days ill, per day lived | 0.48 | 0.46 |
  | new illnesses | 33 | 36 |
  | days tended | 0 | 364 |
  | saw spring | 17/30 | 17/30 |

  **364 days of tending changed survival by nothing.** That is not a job with
  a bad rate, it is a job with no measurable output, and putting a herb stock
  in front of it would only have made an ineffective job harder to use.

  **The mechanism is the more useful half of the finding.** `crowding`
  returned zero on EVERY settled day of sixty sagas — not rarely, never. The
  roof runs a long way ahead of the band: 8.1 souls to 14.6 of room on the
  average settled day, and the most crowded moment any saga reached was 19
  souls to 19 of roof, which is still not crowded. So `CROWD_BITE` never
  multiplies anything, spread runs at its floor rate of `CATCHING * down`, and
  `CARE_GUARD` is a guard against a floor.

  **Which means the tradeoff item 8 was built around cannot happen.** Its own
  note says it plainly — "taking in another pair of hands is more work done
  and one more chest by the fire; past what the roof has room for, it is also
  how a bad week becomes a bad winter." There is no past-what-the-roof-holds.
  The band never gets there, because the bot builds room faster than the band
  grows and the game gives it no reason not to.

  Making either half real — a healer worth a hand, or a roof the band can
  outgrow — moves survival odds, so it is a design call rather than a fix, and
  it is queued rather than taken.

  **The probe is kept, and its own first cut is kept with it.** That cut
  swapped the BUILDER out for the healer and read the healer arm as twice as
  ill per day lived. That is not what care does, it is what losing the builder
  does: no builder, no shelter, and shelter is what stops the cold nights that
  hand out `ill_` in the first place. An A/B is only an A/B if one thing
  changed.

  No source changed. 1207 tests.

- **2026-08-23 — Somewhere on the water worth going to** — fishing grounds
  (queue item 28), and the answer to the finding that killed item 23.

  **The sea was not dull, it was empty.** The item-23 probe measured a game
  that offers a wet hex on a fifth of every band's moving days, a third of the
  menu on those days, and is declined ninety-four times in a hundred. Nothing
  out there was worth the day. What the same measurements say bands actually
  want is food: starvation causes eleven endings in twenty, more than
  everything else put together.

  **So the reason the sea needed is a larder, and the sea already half had
  one.** Ocean pays 5 to a beach's 4 — measured, a day afloat and a day
  foraging a valley both grossed 5.72 for a net of 2.73. That is not a
  gradient anybody rows for. A fishing ground is that gradient made worth the
  trip: it pays a multiple, and it pays ONLY to a crew floating on it. The
  beach next door is still a beach. **You cannot walk to a fishing ground**,
  and that refusal is the whole design.

  **Derived, not stored,** for the two reasons everything else on this map is:
  worldgen's hash is a contract with the port, and a fact that can be computed
  does not belong in a save. Knowing about one needs no field either — the
  landmark note says it best, a ground sits on a hex and the fog already
  remembers which hexes have been seen. The map draws them as birds working
  the water, because that is what tells a crew.

  **The multiplier was set from arithmetic, and the first cut of it was
  wrong.** It was picked at 2.6 by reasoning about NET food per day and
  measured at forty times the land verbs over five days — a solved food
  problem rather than a reason to sail. Upkeep is a flat 3 a day, so
  multiplying the GROSS take when the baseline net is small is hugely
  leveraged: 2.6x gross is 4.3x net. At 2x a five-day trip returns 4.5 a day
  against 3.3 for staying home, about half again as good.

  **Then the diagnosis that made it real.** With the ground built, the probe
  barely moved, and the instrument said why: on 4492 days a settled band had a
  known ground within TWO HEXES and worked almost none of them — 2747 of those
  days it was well fed, and on 1617 it was settled and could not move.
  `moveOptions` returns nothing once the posts are in. The sea was not being
  declined by a settled band; it was shut to one, and settled bands are the
  ones that starve. The larder was out there and the door was locked. So a
  settled band can now send an errand to the fishing, which is what opens it.

  **The errand cost thirteen points before it earned two.** Its first cut
  launched whenever the store fell under eight days, in any season, for a
  ground up to seven hexes out, and As It Lies fell from 63% to 50% — the same
  failure the raid errand had, and the same one the expedition harness has
  been saying since 4.2: emptying the steading kills. A larder on the water
  does not repeal it. Constrained to a genuine shortage, the growing half of
  the year, and a ground close enough to be a day's row, the odds came back:

  | | baseline | with fisheries |
  |---|---|---|
  | A Fair Country, saw spring | 87% | 87% |
  | As It Lies, saw spring | 63% | 65% |
  | A Hard Country, saw spring | 17% | 17% |

  One saga in sixty is noise, and that is the right result: the sea is a
  reachable OPTION now, not a free win. What did move is the traffic — sagas
  that ever floated 9/40 to 27/40, water hexes entered 0.6 to 1.8 a saga,
  water days taken 80 to 256, and the median band's nearest approach to a
  ground from one hex to nought, which is to say they now stand on them.

  **A count in a bar became a list.** `every purpose is offered, named and
  explained` asserted `toHaveLength(3)` — a bar that must be edited whenever an
  errand is added and has no opinion about which errands exist. It now asks
  for each door by name.

  Twelfth rule for the port. 1206 tests, all ten browser bars.

- **2026-08-23 — The sea is offered and declined** — queue item 23 (tidal
  races and named waters) measured, and not built. The measurement is the
  deliverable.

  **Both halves rested on one premise: that the sea is a place the band moves
  around in.** Tidal races want a strait narrow enough that which way you are
  going matters. Named waters want stretches of coast distinct enough that a
  band comes to know them. The world's geometry says both are plausible —
  twelve worlds measured 123 coastal-water hexes each in 4.6 connected bodies,
  2.7 of them eight hexes or more, and 5.2 gates: water with land on four
  sides whose two wet neighbours do not touch, so a hull must pass through
  rather than around.

  **Geometry is the map, not the saga.** Forty raider sagas to day 400 — the
  most sea-inclined band the harness has, the only policy that leaves under
  arms at all, so this is the generous reading:

  - 9 of 40 ever floated at all
  - 0.6 distinct water hexes entered per saga, of 121.8 coastal in the world
  - 0.2 bodies of water touched; **0.0 true gates entered, in any saga**
  - 2.8 waters big enough to name per world; 1.0 ever glimpsed, **0.0 ever a
    third uncovered**
  - mean 1.01 hexes per move afloat, of a possible 3

  A directional cost at a gate would fire zero times. A name on a water the
  band never uncovers a third of is a name on nothing. Neither ships.

  **The line worth keeping is the one that says why, and it clears the
  instrument.** The obvious suspicion about all of the above is that it
  measures the bot rather than the game — that the harness simply never steers
  for water. It does not hold: `6782 days with a move to make, 1436 of them
  offering water, 35% of the options on those days, 80 taken.` The sea is on
  the menu on a fifth of every band's moving days and is declined 94 times in
  a hundred. The game is not refusing the water; nobody wants it.

  **So the sea does not need more texture, it needs a reason.** Both halves of
  item 23 make the water more interesting for a band that already sails.
  Neither gives anybody cause to sail. That is the same shape as the As It
  Lies finding (item 26) and the same shape the five-winter wall had: content
  behind a door nobody opens. Building either would have added code to a room
  with no traffic.

  **The probe is kept, not deleted with the idea it killed.** It is an
  instrument: any future work that means to give the sea a reason should move
  these numbers, and this is what it will be read against. It asserts only
  that the water is still being offered — pinning the take-rate would pin the
  bot rather than the sea, and the take-rate is the finding.

- **2026-08-23 — Five winters is a reckoning, not an ending** — a saga can now
  outlive the coast it started on (queue item 24).

  **The wall was measurable and it was always in the same place.** `checkRunEnd`
  fired `survived` the day `wintersStood` hit five, whatever the band had built,
  and the harness read day 457 every time. Every long-game measurement in
  `balance.test.ts` was really a measurement of the wall: bands that were going
  to make it stopped there because the code said so, not because the coast had
  finished with them.

  **A landnám is a thing people did, not a place they were.** They did it more
  than once. A coast gives what it has — the larder thins, another
  landnámsmaðr's posts are in the good ground, the ways are cut and there is
  nothing left to cut — and the ninth-century answer was to put the household
  back aboard and go and take land somewhere else. So the five-winter mark says
  so, once, in the saga log, and then offers two deeds. Both are the player's.

  **"Lay the saga down here" is the old ending, chosen.** The lines are the ones
  `checkRunEnd` used to write, because what they said was true and the only
  thing wrong with them was that nobody picked them. It is a deed on the Act
  sheet now, and it names the steading exactly as it did before.

  **"Take land somewhere else" derives a new world** from `${seed}:landnam:N`,
  the same rule every derived thing in this game follows, so a replay finds the
  same second island. What crosses is the band and its memory: people, bairns,
  saga, tally, lore, grudges. What does not is the coast — its country, its
  neighbours, the rival's fences, and the man you drove out of your hall, who
  is on that island and you are not. Stores are capped by `hold(ship)`, which
  is the cost: five winters of larder does not fit in a knarr, and what will
  not fit stays on the beach.

  **`checkRunEnd` deliberately does not return early there.** An early return
  would have made five winters a kind of immortality — the band would stop
  starving, stop freezing, stop being killable, which is the opposite of what
  removing the wall was for. The reckoning is a door, not a roof.

  **What it did to the long game, measured at twenty seeds to day 500:** on the
  balanced country the `survived` ending is simply gone from the tally, and
  7/20 sagas are still standing when the harness stops instead of being told
  they are finished at 457 — average length 315 days against a wall that used
  to cap it. On the hard country nothing moved (avg 76 days), because almost
  nothing there ever reached the wall to be stopped by it. That asymmetry is
  the finding: the endgame was content that only the gentle country ever saw,
  and now the gentle country has somewhere to spend it.

  **Two bars had to be rewritten rather than loosened.** `surviving is no longer
  winning` and `the steading is named in the ending you earn by enduring` both
  asserted an ending that fires at you; their INTENT — that enduring earns no
  title, and that the steading is named in what you get — survives the change
  intact, so both now reach that ending through the deed and assert the same
  things about it. Neither bar was weakened; one word in each title changed
  from *earn* to *choose*.

  **The reach bar gained a screen.** The deeds sheet at the reckoning is the
  longest it ever gets, and measuring it on day 1 said nothing about the day it
  matters: `npm run reach` now winds the calendar on, clears what the skipped
  days raise, and reads the sheet where the two heaviest deeds in the game sit
  — 78% and 89% of the screen, both under the thumb, everything clearing 44px.

  Eleventh rule for the port. 1196 tests, all ten browser bars.

- **2026-08-23 — The knarr goes somewhere that is not on the map** — the ship
  as a place (queue idea 10), and the last of the ten.

  **She could already do a great deal and all of it inside the same eighteen
  hundred hexes.** Row a coast, fight on the water, carry a strandhögg home,
  spring a strake on rock — the hold was even there, scaling what a raid
  brought back. What could not happen was the one thing a knarr was actually
  FOR: crossing open water to somewhere else and coming back with what was
  there.

  **A voyage is not an expedition,** and that distinction is the whole
  design. An expedition walks the map, can be seen, and can be recalled. A
  voyage leaves the map entirely: the crew are simply gone, for most of a
  year, and what it costs is their hands through the part of the year that
  needs them. They are off the fields, off the map, and off the ration —
  counting them at home would feed them twice, and `homeCrew`, `fieldCrew`
  and `foodPerDay` all had to learn about them.

  **It rides the picker the expedition already had.** "Sail east for home" is
  a fourth PURPOSE rather than a second roster card, because the question is
  the same one — which hands can the hall spare — and asking it twice with
  two cards would be worse. `LAUNCH` branches on it; the card asks the
  voyage's own refusals, which are its own: a hull with nothing sound left
  will not cross open water, and two at the least or she does not answer the
  steering-oar.

  **What she brings back had to be measured before it was right.** Gated on
  the hall's spare beds — the rule that governs everybody else who joins —
  a voyage brought back **nobody** in the ordinary case, because a fresh
  steading holds exactly the six already in it. The whole thing was **156
  hand-days for nine food**: a trap, not a decision. So the knarr's own hold
  decides how many, not the roof: people fetched from across an ocean have
  nowhere else to walk to, and they crowd in. Measured now over forty
  voyages: **2.77 people and 9.3 food back for 156 hand-days, and nine
  crossings in forty spring a strake.**
  That exception is narrow and written down where `takeIn` explains itself:
  capacity turns away people who WANDER IN, because being told there is no
  room they walk on somewhere else, and that is what makes building worth
  doing. It does not turn away people you sailed an ocean to fetch. What it
  costs instead is crowding — which, since the sickness work, is a thing the
  body feels.

  **Stated plainly: the harness does not sail.** The balance bot has no
  reason to pick a purpose it was never taught, so the published odds are
  unmoved (Fair 87%, As It Lies 63%, Hard 17%) and that is a measurement of
  the voyage costing nothing, not of it being balanced. What a voyage does to
  a run is the player's to find, and the numbers above are what it hands them.

  **Downscoped, and said:** no cargo manifest and no per-voyage events. The
  hold is still a capacity rather than a list of goods, and the crossing is
  one roll rather than a season of cards at sea. Both are real features and
  both want their own measurement.

  Save goes to **v43** (`voyage` on the root).


- **2026-08-23 — An oath that binds, and what the deck costs** — oaths, blót
  and omens (queue idea 9).

  **Omens already existed and already worked.** `omenFor` reads the next
  day's weather back as a portent the band plans around — the forecast IS the
  omen, and has been since the weather work. Nothing here touched it.

  **Oaths did not, and nothing else in the game does what they do.** The
  Norse vocabulary was everywhere and none of it bound anything: the Thing is
  a roll, wergild is a price, "oath-brother" is a word in a tie-table. An
  oath is the only thing in the game that makes the band WORSE at something
  on purpose — take nothing by force until the year turns, or do not leave
  this hall — in exchange for what keeping it is worth. Carried to the turn
  of the year it pays heart; broken it costs more than that, and every
  neighbour on the coast hears, because an oath is given in front of
  witnesses and that is the whole reason it is worth anything.
  It needed **no new save field and no new engine vocabulary**: the blót card
  raises a flag, which the deck could already do and the save already had.
  Only the holding-to-it is engine code.

  **Then the odds bar spent the afternoon teaching a lesson about decks.**
  Four measurements, in order:

  1. As a weighted card at 7, only **half of settled runs ever met it** —
     a headline mechanic half the players would never see.
  2. At weight 30 it reached 90% of runs and **spring survival on As It Lies
     fell 72% → 53%**. The event deck is ZERO-SUM: every draw the blót wins
     is a draw an autumn food card loses, right before the winter.
  3. Putting the slaughter into the card (which is what a blood-month blót
     IS) bought back four points. Not the cause.
  4. Reordering so the NON-binding choice is first bought back nothing
     measurable — but it stays, and it is right on its own terms: the
     harness answers every card with choice 0 and so does a player in a
     hurry, and a card that BINDS you must not make binding the easiest
     button. The card says nobody is made to say anything; now it means it.

  5. Off the deck, fired by the calendar on the turn into autumn: no
     crowding, full reach — and a card on the table that nobody asked for,
     which **desynced every recorded run in `runs/*.json`**. A replay meets
     an event it never agreed to and refuses every action after it; eight
     bars went red, and the fix would have meant re-recording the fixture
     the C++ port is checked against. Too much blast radius for one card.

  **The answer was to let the player call for it.** "Hold the blót" is a deed
  at the hall in autumn, so the card only ever exists because somebody asked
  for it: no crowding, no interruption, nothing to re-record. Weight 0 now
  means "something else puts this on the table", and the content lint knows
  the difference between that and a card that fell to zero by accident —
  which is what the lint is for.
  A rite you choose to hold is also better fiction than one that ambushes you
  anyway.

  **And a finding that predates all of it, which Evan should see.** Measured
  at HEAD before a line of this was written: **As It Lies promised 72% and
  the game delivered 63%** — nine points adrift, one point inside the bar's
  own tolerance, so any small change trips it. That is what made a
  noise-level change look like a regression at first. With the blót off the
  deck the reading is **68%**, closer to the promise than the baseline was,
  because a reliable autumn slaughter is a real if small buff to a settled
  band. The drift itself is still there and is worth its own look.

  Ten bars, and no save bump.


- **2026-08-23 — What goes round a hall, and who stops it** — wounds,
  sickness and the healer (queue idea 8), scoped by what was already built.

  **Two thirds of the item already existed.** Injuries outlive the battle and
  always have — `data/injuries.ts` carries stat penalties and a `heals`
  countdown, and `mendInjuries` ticks them down and refuses to in winter.
  Illness existed too, and `coldNight` gives it when the fire goes out. What
  neither could do was SPREAD. A cough in a longhouse with eleven people in it
  and room for six behaved exactly like a cough in a hall with room to spare,
  so crowding — which the game already counts and already docks morale for —
  cost the band nothing it could feel in the body.

  **Now it goes round, and the roof is the reason.** One person a day at most,
  never on the road (six people walking in the open air is not a crowded
  hall), scaled by how many are already down and by every body past what the
  roof holds. Measured over one cough and one season, sixty halls each: **0.42
  more went down with room to spare, 2.67 with six past the roof.** That is
  the tradeoff taking in another pair of hands was missing.

  **And it is answerable.** A healer is the seventh job and the only one that
  produces no stockpile: `care` is spent the day it is given. It cuts the odds
  of it going round AND goes into the mending rate beside what the band has
  learned. Both halves priced, because pricing one would have mis-tuned it:
  **2.67 catches falls to 2.22, and an illness that takes 14.0 days to mend
  alone takes 9.1 with somebody tending it.** A hand that grows no food, for a
  third off the recovery and fewer people going down.

  **The instrument lied first, and it took the shape of good news.** The
  fixture built its settlement by hand and left out `report`, so
  `effectiveReport` spread `undefined`, the healer's output came out `NaN`,
  and `chance(NaN)` is always false — which read as "a healer stops it
  completely, 0.00". A fixture that founds the hall the way the game founds
  one gave the real numbers above. Worth writing down: a measurement that
  makes a new feature look perfect is the one to distrust.

  **Downscoped, and said plainly:** no herbs. The item asked for them as the
  healer's input, and a second resource with its own gathering, storage and
  spoilage is a system rather than a detail — it deserves its own measurement
  rather than riding in on this one.

  No save bump: illnesses are `ill_`-marked entries in the `injuries` list a
  Person already had, and `care` is a per-day figure that is never stored.
  Published odds measured unchanged. `port/parity.json` regenerated.


- **2026-08-23 — A hall makes households, and the high seat passes** —
  queue idea 7, and the measurement that decided what it could honestly be.

  **The item asked for children who grow into working hands. They cannot,
  and the arithmetic is not close.** Measured rather than assumed: every run
  ends on **day 457** — four years and ten months, and a jarldom does not
  change it, because `checkRunEnd` fires at `LONG_LIFE_WINTERS` whatever the
  Thing decided. A generation is sixteen years, **1536 days**. A child born
  in the first hour of a saga is four years old when it closes: **3.4 whole
  sagas short**. `data/lineage.ts` reached this conclusion years ago and said
  so plainly, and it was right; the queue item inherited a wish rather than a
  premise. Growing children up means moving the end of a run, which moves
  every balance curve this project has measured — a decision about what the
  game IS, not a feature to slip in behind one. It is queued as its own
  question now, and a bar pins the arithmetic so that if a saga ever gets
  longer, the test fails and the question is reopened on purpose.

  **What DID fit was the hole underneath it.** `bindKin` runs exactly once,
  in `makeWarband`, and nothing in the game has ever made a tie since. So a
  woman widowed on day forty spent the next four years alone in a hall of
  six, and every child she bore afterwards was recorded with no father — not
  because the game decided anything about her, but because the only code that
  could bind two people had already run before the run began.

  Now a settled hall at peace makes households: one man, one woman, both
  grown and bound to nobody, a year between weddings. It binds the tie the
  sim already understands, which is what lets a birth name a father again.
  Measured across forty sagas with every tie broken: **1.32 weddings a saga,
  and 36 of 40 halls see one** — enough that the door is real, rare enough
  that a marginal steading is not a village fete.

  **And the high seat passes out loud.** Leadership already moved by
  seniority — `leaderOf` returns the next sworn in first-ashore order — but
  it moved SILENTLY, so the most important thing that can happen to a band
  happened without the saga noticing. It is announced now, with what the dead
  leader left behind, and the end of the line is marked when there is nobody
  to hand it to. Hooked into `mourn`, which every death site already calls:
  a succession that forgets to be announced is the same bug as a death that
  forgets to be mourned. Asked of who the dead WERE, not who leads now —
  every death site clears `alive` before it mourns.

  **No save bump:** `Person.kin` and `flags` already existed, so this is
  behaviour rather than shape — the worldgen parity readings did not move and
  only the replayed run did, which is exactly the signature of a rule change
  rather than a state change. `port/parity.json` regenerated. Published odds
  measured unchanged.


- **2026-08-23 — The judgement that makes an enemy** — the Thing as a living
  court (queue idea 6), scoped by what was already there.

  **Checking first cut the job in half, again.** The task said "disputes
  brought to the player: wergild, outlawry, judgements that change standing".
  The wergild court already EXISTS — `sim/minds.ts` ripens grudges into a
  feud card and offers three answers: pay it out of the stores, hold a Thing
  and let it be argued out, or tell them both to get back to work. What did
  not exist was outlawry, and an `outlaw` archetype has been sitting unused
  in `data/foes.ts` the whole time.

  **So: a fourth answer, and it is the certain one.** Wergild spends stores
  and can fail for want of them; the Thing spends a roll and can fail
  outright; outlawry spends a PERSON and cannot fail. In a band of six that
  is the dearest thing there is, and it ends the quarrel absolutely — one of
  the two is gone. The card NAMES him, because a judgement this heavy must
  not be a generic label the player reads afterwards and finds they picked
  somebody they did not mean to.

  **And he is still in the country.** That is the whole reason the verb is
  worth building: every other hostile thing in this game is dealt out by the
  world — a camp that was always there, a garrison, a rival who landed the
  same spring — and an outlaw is one the player MADE. He keeps his head down
  for thirty days, and after that he is sometimes waiting on the road, with
  men the band does not know. He is `left`, not dead: upkeep stops feeding
  him and the saga does not bury somebody who is walking around.

  Measured over a year, thirty seeds: **one man driven out is about two
  fights a year; three is six or seven.** The rest between raids is each
  man's own, so a band that drove three people out really is in three men's
  worth of danger — which was worth measuring, because the code comment
  claimed the opposite until the number contradicted it and the comment was
  fixed to match. Steep on purpose: it is the price of ending a quarrel for
  good, and nobody drives out half their band by accident. Nothing happens
  while a card or a fight is on the table, and nothing happens at sea — a man
  on foot cannot reach a hull under way, which is also the one place the band
  could not run.

  **Two things this turned up that had nothing to do with outlawry.**

  *The judgements are a contract with the past.* The new answer was written
  third in the list, which pushed "tell them to get back to work" to fourth —
  and `settleFeud` takes an INDEX, which the recorded runs in `runs/*.json`
  replay by. So an old saga that told two men to go back to work would have
  driven one of them out instead. It is appended now, and a bar pins the
  order so the next person cannot do it either.

  *A bar had been failing silently for a whole commit.* The reach audit exits
  1 on a thumb-rule breach, and this session had been running it as
  `node scripts/reach.mjs | tail -6` — which reports the exit code of `tail`,
  always 0. The 390x844 audit had been RED since the ways commit: fourteen
  deeds took the Act sheet to its 88dvh cap, `margin-top: auto` resolved to
  nought exactly as it does on a short screen, and Camp rode up to 26% — the
  hard band. Fixed with the same medicine the short-screen rule already used,
  one size up (`.deeds-card` capped at 74dvh so the sheet drops back under
  the thumb and the overflow scrolls). `scripts/bars.mjs` now runs all ten
  browser bars and reports by EXIT CODE, because a bar that cannot fail
  loudly is not a bar.

  The card carries four choices at 390x844 with no scroll, seen by eye. Save
  goes to **v42** (`outlaws` on the root, carried in the `coast` facet beside
  the grudges that made them — a man driven out is the far end of a quarrel,
  not a separate system). Published odds measured unchanged.
  `port/parity.json` regenerated and handed over.


- **2026-08-23 — The band writes something onto the country** — the land
  remembers your work (queue idea 4).

  **Everything in this game happened TO the band.** Winter came, the sea
  sprang a strake, another landnamsmadr fenced the good ground. The band's
  own work went into a steading and stopped at its fence: the map itself was
  a fixed thing, walked over identically on the four hundredth day as on the
  first. A made way is the exception — slow, permanent, and the only thing
  here that outlives whoever dug it.

  **The first design was wrong, and the bar that priced it said so before it
  shipped.** A way was to buy a point of movement effort. But a day is
  `ceil(effort / 2)`, so on forest and hills — the two commonest hard grounds
  — cutting a way cost two days and saved **literally nothing** per crossing.
  That is the trap this file's own comment had just warned against, written
  into the very verb that warned about it. The day-cost model cannot express
  "a bit faster"; it is the same wall `ROW_REACH` hit when the knarr was
  exactly as fast as walking, and this is the same answer. **A made way
  covers GROUND: two hexes of it in the day one hex of rough country takes.**

  Which turns the verb into the thing a road actually is. One made hex is
  nearly worthless; a CHAIN is a road. Measured: **a road of four costs six
  to eight days to cut and saves a day a journey, so it pays back on the
  sixth to eighth time the band walks it** — an investment in the trips you
  take AGAIN (the trading run, the way out to the coast the raids go from),
  which is exactly what a road is for.
  That also reversed a refusal: easy ground may now be broken, because a
  chain that has to jump a meadow is not a road. The deed sheet carries the
  catch instead of the rules forbidding it — "Ways join up: two made hexes in
  a row are crossed in a single day" — since a verb that hides the chaining
  sells the player days for nothing.

  **Drawn where the player can see their own work.** In the OVERLAY, not on
  the build-once path: a hex is built the first time it is SEEN, and ground
  is usually broken long after that, so a track built with its hex would
  never appear on the hex that most needs it. The first cut of the track was
  a pale dotted arc and vanished on sand; it is dark-under-light now, which
  reads on any ground. The repaint bar is **still 78 work items**.

  No new beat kind, deliberately: beats live in the save and the parity
  vectors, so each is an obligation on the port, and nothing has to animate a
  road being dug — the chronicle says it happened.

  Save goes to **v41** (`world.made` — the one thing on the world the PLAYER
  authors, so unlike skerries and landmarks it cannot be derived).
  Published odds measured unchanged. `port/parity.json` regenerated and
  handed over.


- **2026-08-22 — The country has fixed points, and the data model stops
  lying about it** — landmarks and wayfinding (queue idea 3).

  **The idea had been DECLARED and never built.** `Tile.landmark` has sat in
  the state shape for years pointing at a `data/landmarks` that was never
  written, beside an `explored` flag with the same story — and a search of
  both repos found nothing that ever set either one. `spotLandmarks` was
  named for them and actually spots PLACES. So the map had no fixed points at
  all: every march line named a terrain ("we moved on into hills"), three
  days' walking read as the same day three times, and a player who passed one
  waterfall twice had nothing to tell them it was the same water.

  **Landmarks are real now, and derived from the seed.** Six kinds in
  `data/landmarks.ts` — a split rock, a falls, a burnt wood, a cairn, a sea
  stack, a black mere — each only on ground it belongs on, each named twice
  over ("the Broken Falls", "Stormcairn"). Measured at **5.1% of eligible
  hexes**, roughly sixty in a world: enough to steer by, sparse enough to
  mean something. Nothing is stored: `landmarkAt` is a hash of the seed and
  the hex, so worldgen's hash (a contract with the C++ port) does not move,
  and which ones the band KNOWS needs no field either — a landmark stands on
  a hex, and the fog already remembers which hexes have been seen.

  **What wayfinding buys, stated exactly.** Weather takes sight away; a
  fixed point does not give a crew longer eyes, it gives them their
  bearings — so beside a known landmark the SKY's penalty is cancelled and
  nothing else about sight moves. And from a ridge they are picked out to
  eight hexes, far past ordinary sight, which is the reason to climb one.

  **Said in words a person would use.** The saga names where the night was
  spent ("we made camp under the Split Rock"), and arriving at one is
  chronicled ONCE, keyed off `world.trod`, which already remembered first
  visits — so it costs no new state and reads as arriving somewhere rather
  than as scenery.

  **The chart carries the names; the map carries the marks.** Names were
  tried on the chart first and could not be read — it is the whole island in
  300px, so a name there is three pixels tall and overlaps its neighbours.
  The chart marks WHERE with a ring and the key says WHICH, nearest first,
  capped at twelve. On the travel map each kind has its own small glyph,
  built once with its hex and relit with it: the repaint bar is **still 78
  work items**. (The naive baseline in that bar moved from 102,612 to 114,936
  polygons, because a band that can spot fixed points from a ridge sees more
  country — the comment in `render/travel.ts` was restated rather than left
  stale.)

  Save goes to **v40**, and it goes DOWN a field: `landmark` and `explored`
  are gone from `Tile`. No save on earth carries them, so the migration
  strips nothing — the version moves because the shape did, and a save's
  shape is the contract. Published odds measured unchanged.
  `port/parity.json` regenerated and handed over.


- **2026-08-22 — The coast has teeth, and a chart is something you earn** —
  the sea gets opinions (queue idea 1), scoped to the half that changes how
  the game is played.

  **The knarr's three-hex day was free speed.** Rowing hard had no case
  against it: water was uniform, every coastal hex cost the same and risked
  nothing, and "hug the coast carefully" was a line in the guide rather than
  a decision on the map. Now there are skerries — rocks in about a sixth of
  coastal water — and the risk is charged PER HEX CROSSED, so a fast
  three-hex day gambles three times and a careful step gambles once. That is
  the whole mechanic, and it is the case the reach never had.

  **The rocks are a fact of the seed, not of the save.** `skerryAt` is a hash
  of the seed and the hex: no worldgen change (its hash is a contract with
  the C++ port), no rocks in the save, and the same coast on every replay.
  What IS stored is the CHART — the rocks the band has learnt about — because
  that is the part a saga earns. Measured over 400 crossings of the same
  rock: **28% of blind crossings spring a strake, against 8% once it is
  charted.** Passing clear teaches as much as striking does, so a second
  voyage along a coast is genuinely different from the first.

  **What it costs, priced both ways.** Forty voyages each way over the same
  coasts: **long hops make 1.71 hexes a day and lose 25 strakes; short steps
  make 0.71 a day and lose 12.** Roughly two and a half times the pace for
  about twice the damage — a decision with both sides on the table, not a
  tax. An earlier cut of that bar compared days for the same number of
  CROSSINGS and read the fast route as simply worse; a long hop covers three
  times the water, so that was comparing unequal journeys. Ground per day is
  the honest figure.
  Nothing here can sink her — the rule the whole ship file is built on. The
  worst a coast can do is take every strake, and a night ashore with timber
  puts them back.

  **The chart is on the map, and so is the warning.** Charted rocks are drawn
  as teeth breaking the surface, and any crossing whose line runs over known
  rock is marked in gold instead of cream — because with a three-hex reach
  the dangerous water is water the player is not looking at, and a hazard you
  cannot see before you commit is bad luck rather than a choice.

  Save goes to **v39** (`world.charted`, migration: an old band never struck
  a rock, so it has learnt nothing, and absent IS the empty chart). The
  published survival odds are measured unchanged. `port/parity.json`
  regenerated and handed over.

  **Downscoped, and still queued:** tidal races and named waters. The idea
  named three things; this is the one that changes a decision, and the other
  two are flavour and wayfinding that deserve their own measurement rather
  than being tacked on here.


- **2026-08-22 — The land runs out, and somebody else wants it** — two ideas
  off the enhancement queue, both measured against the difficulty screen's
  own promises before either was allowed to stand.

  **The larder has a bottom (idea 2).** Forage, hunt and fish paid the same
  yield on the hundredth day in a valley as on the first, so a band that
  found one good hex had no reason ever to leave it. Now each larder in each
  hex remembers how hard it has been worked, and recovers — stored lazily, so
  a take folds the regrowth since the last one into the figure it writes:
  no per-day tick, nothing to walk on load, and a hex nobody has worked costs
  the save nothing. Measured on the real verb: **a valley hunted twelve days
  pays 0.39x what it paid the first three.**

  **The first cut was wrong and the odds said so.** It taxed the FIRST take,
  which is the take a starving band makes, and the published survival odds
  for As It Lies fell from 72% to 52%. Softening the slope barely moved it
  (55%) while gutting the decision (a 1.71x edge became 1.03x) — which is
  what proved the slope was never the problem. The fix is a GRACE of two
  days: one band of six does not strip a valley in an afternoon, so passing
  through is free and squatting is what costs. The promise on the difficulty
  screen is measured true again, unchanged.
  The warning reaches the player BEFORE the day is spent — the deed sheet
  says "The game has been driven off this ground" — because a depletion you
  cannot read is not a decision, it is bad luck. `scripts/larder.mjs` holds
  that in the built page.

  **Somebody else wants this island (idea 5).** Every clock in this game
  belonged to the weather; the land waited politely while the band made up
  its mind. Now a second landnamsmadr comes ashore the same spring, puts his
  posts in on day nine whatever we are doing, and closes his hand on the map
  one hex at a time — always the best unclaimed ground nearest his hall, so
  he wants what we want. Ground he holds is ground we cannot found on: the
  refusal the older clans already had, in his name. Measured: **he holds
  three hexes by day sixty, and every one of them is shut to us.**
  He is deliberately small — a name, a hall, and the ground he has taken.
  There is no second colony being simulated behind him and there is not meant
  to be. What makes him a rival is that the good land runs out while you
  decide.
  He is drawn as what he is: the same longhouse shape as ours in his own
  colour, and his claim as a red WASH rather than an outline — the first cut
  drew a dashed border and it read as one more move marker at phone size.

  Save goes to **v38** (two shapes, two migrations: an old world has worked
  nothing and has this coast to itself, which is exactly what absent says).
  `port/parity.json` regenerated — **the C++ port needs a re-sync**, and the
  rival is carried in the `coast` facet because he is a person with a
  schedule, not terrain.


- **2026-08-22 — "Some hexes aren't travelable even when you are right next
  to them"** — a bug report about shallow water, and it was three bugs, two
  of them older than the report.

  **The map and the sim read the same fact two ways.** The renderer asked "is
  every neighbour ocean?" to decide deep water; the sim asked "is any
  neighbour land?" to decide whether the knarr could row there. Those agree
  everywhere except where the tiles run out — the world is a finite 52x36
  rectangle — and at the rim an off-map neighbour is *not ocean* (so the map
  drew ordinary coastal water) and *not land* (so the sim refused the
  crossing). Measured before anything was touched: **1332 of 2866
  shallow-drawn hexes could never be entered, every single one on the rim,
  none of them touching real land.** The whole perimeter of the world was a
  promise the game would not keep. Fixed by deleting the second reading:
  `deepOcean` lives in `sim/road.ts` beside the rule it must agree with, and
  the renderer asks it. The rim now reads as open sea, which is what it is.
  After: **0**.

  **The knarr's reach was invisible.** `moveOptions` has computed the ship's
  three-hex day since the rowing work and **had no caller in `src/`** — the
  renderer kept its own list of immediate neighbours. So the thing the ship
  exists for was never offered: **60 legal moves over 15 afloat turns, undrawn**,
  and the sea read as a wall three hexes thick. The renderer now calls the
  sim's list, which also hands it the returning-expedition leash and the
  settled-band rule for free. After: **0** hidden moves, **0** phantoms.

  **And the fix exposed a trap.** With the real reach drawn, the new browser
  bar found a marker at span ZERO — the band's own hex. `rowable` is trivially
  true from a hex to itself, so afloat the sim accepted a MOVE that advanced
  the day and moved nobody: **32 of 35 afloat states could spend a day rowing
  nowhere.** Nothing had ever offered it, so nobody had found it; drawing the
  truth is what made it visible. Standing still is not a move now. After: **0**.

  New: `scripts/sea.mjs` (drives a band onto real water in the BUILT page,
  reads the markers back out of the document, and fails if any sits on water
  the sim refuses or if none reaches past one hex) and `test/reachable.test.ts`
  (5 bars). Verified: the suite, tsc clean, all seven browser bars, and the
  reach seen by eye on a knarr under way.

- **2026-08-22 — The chart is an artifact and the land is lived-in (art queue
  8+9+10 of 10 — the queue is finished)** — three travel-side items in one
  render-only commit.

  **The map as the saga's artifact (8).** The world map sits inside an edge
  vignette and a faint chart frame now — a `::after` on the map slot, scoped
  with `:has(> svg.map)` so the battlefield, which draws its own vignette,
  never gets a second one. And the trod is WORN: the chart's trail fades with
  the days since it was walked (`1 − age/220`, floored at 0.28), so the early
  road reads as an old road and the chart keeps its record — never to
  nothing, because the map is the saga's memory, not a snapshot.
  One honest downscope: the queue said "parchment, knot border" — the frame
  is a plain inset line, not interlace. Knotwork corners at 1px inset cost
  real nodes on every paint of the slot and read as noise at phone size; the
  vignette and the worn trod carry the artifact reading on their own.

  **Life marks (9).** A steading is lived-in now, not just built: hearth
  smoke rises off the settlement's longhouse and off every neighbour camp
  that has not been sacked — two puffs on staggered loops, and the loop is
  what a sacked camp loses. A camped band sleeps beside a visible fire
  (`campglow`, breathing, gone the moment they move on — it keys off
  `hasCamped`, a fact the sim already kept). Some days there are gulls over
  seen water near the band — seeded `landnam-birds:${seed}:${day}`, so a
  replay has the same sky and the sim rolls nothing for decoration.
  Stillness discipline, same as the field's weather: every loop is frozen by
  `:root.still` and `prefers-reduced-motion` — and because the smoke's
  animation is the only thing that makes its puffs visible, stillness gives
  them a static opacity instead of erasing the lived-in read.

  **Season light on the country (10).** The travel map takes the same
  season tint the battlefield already wears — `seasonTint` from
  `fieldWeather`, reused rather than a second palette that could drift —
  over the sea rect's whole reach so panning never finds its edge, swapped
  only when the season actually turns. Under the overlay layer, so every
  gameplay mark stays full-strength. The queue said "via CSS variables";
  one shared function turned out to be the smaller mechanism, and one
  mechanism for one fact is the rule that matters.

  Verified by eye at the settled steading and at a camp (smoke, glow, frame
  all present; smoke sits behind the band's token when they are home, which
  is right — they are standing in front of their own house), 57 targeted
  pins, all six browser bars at 390x844, tsc clean, and the full suite.

- **2026-08-22 — The sea lives and the land is lit (art queue 6+7 of 10)** —
  the travel map's turn, inside the repaint discipline it already paid for.

  **A living sea.** Surf breaks where the water meets the land: each coastal
  ocean hex carries one foam path along its land-facing edges, found by
  stepping THROUGH each edge with `fromPixel` rather than by a
  corner-to-direction table that could be quietly wrong. Open water with no
  land beside it is THE DEEP — darker, quieter, its own pattern — so a coast
  reads as a coast and not as a lake's edge. The crests drift (CSS on the
  pattern's own mark group, frozen by stillness), and the knarr trails a
  wake astern. All of it rides the build-once/relight-only path: foam is
  built with its hex and relit with it, depth lives in the FILL, and the
  repaint bar (78 builds across the long run) is untouched — it counts work
  items, which was checked before a line was written.
  One accepted whisper, stated rather than hidden: foam is computed from the
  static tiles, so an edge can face land the fog has not lifted from. Sight
  always reaches past one hex, so by the time the foam is visible the shore
  it breaks on is too.

  **Relief light.** Every LAND pattern carries one shared NW-light gradient —
  in the pattern, so it costs no per-hex nodes — and the mountains got the
  foot shadow that seats a peak on the ground. **The sea skips the relief,
  and that was watched, not guessed:** the gradient spans the 8-hex tile,
  which on textured ground reads as gentle undulation and on flat water read
  as diagonal banding in the first screenshot. The sea's light is its
  crests.

  Verified by eye at the landing and afloat (the wake shot), 57 targeted
  pins (repaint, camera, chart, terrainArt, fieldArt), all six browser bars,
  and the suite.

- **2026-08-22 — The beats are choreographed, the wall is drawn, and the sky
  reaches the field (art queue 3+4+5 of 10)** — three battle-side items in
  one render-only commit.

  **Choreography (`render/fx.ts`).** The beat stream was built so a view
  could show HOW a swing finished, and the view drew every one as the same
  straight line. Now each verb has its shape: a swing sweeps in an arc bowed
  to the off side, a thrust runs flat and fast, a thrown spear actually
  flies (CSS-variable keyframes, since every flight is its own length) and
  the impact waits for it to land, a turned blow sparks iron off the rim.
  **And a reading bug: `shoved` beats were never drawn at all** — the one
  verb with no effect, invisible except for its log line since the beat
  stream shipped. All four endings show now: the brace flash when they held,
  motion streaks when they gave ground, rock dust when they were crushed,
  rings on the water when they drowned.

  **The wall (`render/battle.ts`).** wallPairs drew as a translucent line;
  it is a brace now — the plank, its lit edge, iron studs where the rims
  cross — and a fighter braced on BOTH shoulders gets the full-wall ring,
  because two links is the state every wall number keys off. When a fighter
  falls out of a wall the link visibly SNAPS, two halves pulling apart. That
  needed the wall as it stood on the PREVIOUS paint (the fallen are already
  out of `wallPairs` when their `fell` beat plays), and it is view memory,
  deliberately: beats live in the save and the parity vectors, and must not
  grow kinds for decoration's sake.

  **The sky (`render/fieldWeather.ts`).** The top bar has named the day's
  weather since the weather work and the field ignored it. Now a gale
  streaks across, frost falls as snow with each flake's own sway, sea fog
  drifts as breathing banks — ellipses, not filters — and the season tints
  the light (winter blue and thin, autumn amber, spring green-gold; summer
  is the palette everything was tuned in). Weather LOOPS, unlike the
  one-shot fx layer, so stillness FREEZES it by CSS rather than clearing
  it: gusts and flakes only exist mid-animation, so a still field reads as
  a calm day, and the fog bank simply stops breathing.

  Verified with caught frames — a spear mid-flight and sparks off a rim,
  polled out of real foe turns — plus the sea-fog field, all five browser
  bars, and the suite. Render-only throughout.

- **2026-08-22 — The fight looks like a saga illustration (art queue 1+2 of
  10)** — the first of the visual work, and the answer to "can we enhance the
  art without separate assets" is what this commit is: yes, because the
  zero-assets rule bans FILES, not drawing. Everything here is seeded
  procedural SVG, the same philosophy WebAudio already proved for sound.

  **Fighters are people now, not counters** (`render/figures.ts`). Every
  combatant used to be the same circle with a dot. A Person is one object
  across the whole game — pillar 1 — so their LOOK is too: shield paint
  (halved, quartered, sunwheel, rayed or ringed, in period colours — warband
  warm, foes cold), cloak, helm with a nasal, a spear behind the shield, all
  seeded from `person.id + name` the way terrainArt seeds its marks, so the
  same Ulf carries the same quartered madder shield every time he stands on a
  field. Damage is painted as well as counted: the shield cracks past
  two-thirds health and dulls past a third; broken, it sags and tilts. The
  leader's pennant flies from the spear instead of a floating mast. Every
  signal the counter carried — side, health bar, active ring, defend rim,
  broken mark — is unchanged in geometry, so nothing a player learned moves.

  **The field is a place now, not a diagram** (`render/fieldArt.ts`). Open
  ground takes its base colour and its marks from `battle.terrain` — the
  country the fight actually stands on. The log has said "they met us on wet
  sand" over meadow-green fills since the field existed; now the sand is
  there to be met on, pebbles and all. Grass tufts inland, scree on stone,
  crested pools on water, churned earth under the palisade. Plus the low
  sun: one NW wash and one vignette — four nodes, no filters, because
  filter-class effects are the one genuinely expensive thing on a phone GPU.

  **Built with the machinery the travel map already paid for.**
  `scatter`/`copies` took optional lattice parameters (defaults unchanged,
  all 14 terrainArt pins green) and the field tiles them at its own hex
  size. `test/fieldArt.test.ts` holds the same bars terrainArt's phone bug
  wrote: every recipe's `spread + reach` inside the field inradius, the
  scatter deterministic, every terrain mapped. Patterns build once into
  `<defs>` and are referenced by fill string, for the exact repaint reason
  terrainArt documents — per-hex glyph groups were the old cost model.

  Verified the way art has to be: screenshots at 390 and at the 320 panned
  view, judged by eye, plus all five browser bars (field, pan, reach at two
  widths, offline) and the suite. Bundle 351→358 kB. Render-only: sim,
  saves, parity untouched.

  **The queue (ideas 3–10, in order):** choreographed beats (swing arcs,
  thrust ghosts, shield sparks); the shield wall drawn (wallPairs visible);
  weather and season reaching the field; a living sea (drifting waves, foam,
  depth, wake); relief light on terrain; the map as the saga's artifact
  (parchment, knot border, worn trod); life marks (hearth smoke, birds,
  fire-glow); a unified season/day light pass via CSS variables.

- **2026-08-22 — The one-thumb audit had never been run on a small phone, and
  it was flaky** — the small-screen sweep. `scripts/reach.mjs` has audited ten
  surfaces since the mobile work, and it ran at 390x844 and nothing else: the
  size CLAUDE.md names as the design target. But 44px is a rule about thumbs,
  not about the design size, and a control that clears it at 390 can fall
  under it at 320 where every width-bound thing shrinks — which is exactly
  what the battlefield did yesterday. It takes a viewport now
  (`node scripts/reach.mjs 320x568`), defaulting to 390x844 so the old
  behaviour is the default.

  **The instrument was broken before it found anything, and intermittently,
  which is worse than broken.** The audit died twice with "lesson-card
  intercepts pointer events" and then passed on a rerun. Only its
  save-loading path dismissed cards; a fresh run can raise a lesson too, so
  `act` would sometimes reach for a control a card was sitting on. Two
  failures in four runs, on a script that is in no CI and that nobody would
  suspect, because rerunning it makes the problem go away. It clears the
  screen on every path now — and this is the second script in two days with
  that exact fault, after `pan.mjs`.

  **Then it found something real at 320: Camp at 25% of the screen, the hard
  band.** That is the same failure the mobile audit recorded FIXING at 390
  ("Overlay cards are bottom-anchored on phone widths now and it sits at
  38%") — the fix holds at the design size and fails one size down.

  **Why, measured rather than guessed.** The Act sheet needs ~601px for seven
  deeds. `.card` caps at 88dvh: 743px at 844 tall, so the card is shorter
  than its cap, `margin-top: auto` engages and it floats to the thumb. At 568
  tall the cap is 500px, the card is exactly at it, the auto margin resolves
  to nought and the sheet starts at the TOP — which is the documented,
  deliberate fallback, chosen because `align-items: end` would push the
  overflow off the top where scrolling cannot reach it. Bottom-anchoring
  cannot help a card taller than the space it is anchored in.

  **So the card gives up height on a short screen** — `.deeds-card` caps at
  64dvh below 700px tall, and the deeds themselves tighten (padding 9→5, gap
  6→3, line-height 1.35→1.25, all still over the 44px `min-height`). The card
  is smaller than the container again, the margin engages, the sheet drops to
  the thumb, and the deeds that no longer fit scroll — which the card already
  did. Keyed to HEIGHT, like the fight log's cap below 700px, because the
  constraint is the cap and the cap is a height.

  **The first cut capped `.card` and not `.deeds-card`, and the audit priced
  it:** the title screen went from one control behind a scroll to three, and
  settings and the battle result gained one each — four surfaces paying for
  one. Scoped to the sheet, they are all back where they were. Nothing is
  removed anywhere: every deed keeps the blurb it was given when they moved
  off the action bar.

  `reach OK` at 320x568, 360x640 and 390x844, and the other five browser bars
  — field, pan, offline, landscape, pinch — all still green.

- **2026-08-22 — The market is not under-visited by mistake (design question
  closed)** — the last open design call, and reading the gate answered half of
  it before anything was measured: **every condition on it is the harness's,
  not the game's.** `!hasSpeakers`, the winter stood and the food surplus all
  live in `test/balance.test.ts`; the only rule the game imposes is
  `launchBlocker`. The bot goes to market to find somebody who will SPEAK for
  it at the Thing, so once it has speakers it stops going. "The market is
  under-visited" was a description of that strategy, not of a shut door — the
  same mistake `siteFloor` was, two days running.

  So the question worth asking was not whether a band CAN go more often but
  whether going more often is worth anything. 60 sagas to day 400, paired:

  | | errands | deals | settled days | wood at the end | alive at 400 | vs today |
  | --- | --- | --- | --- | --- | --- | --- |
  | gated (today) | 30 | 974 | 31,140 | 296 | 12/60 | — |
  | freely, after a winter | 48 | 1,495 | 27,298 | 190 | 8/60 | saved 0, killed 4 |
  | freely, from the start | 62 | 1,770 | 22,726 | 186 | 8/60 | saved 2, killed 6 |
  | freely, never sells wood | 67 | 381 | 28,542 | 271 | 10/60 | saved 2, killed 4 |
  | placebo — goes, deals nothing | 66 | 269 | 29,415 | 328 | 10/60 | saved 3, killed 5 |

  **Every way of visiting more measured at worse**, so the gate is protective
  rather than restrictive and should not open.

  **Two arms exist to say WHY, because "worse" on its own names no fix.** The
  placebo walks to the counter and comes home having dealt nothing: it keeps
  more wood than today's bot does (328 against 296) and is still net harmful,
  which prices the errand itself — two of the sworn away from the steading are
  two pairs of hands not cutting wood, and no trade recovers that. And
  refusing to sell firewood cuts the deals from 1,495 to **381**: three
  quarters of everything the market has ever traded was the band selling the
  one resource winter kills it for. The 195-deals-from-10-errands figure that
  made the market look reachable was mostly a band liquidating its own winter.

  **What this leaves for design, stated as a direction rather than a verdict.**
  Reach is not the problem and never was. If the market is to matter, either
  the trip has to stop costing two workers for days, or what is on the counter
  has to be worth more than the labour it costs to fetch. Opening the gate buys
  nothing.

  The measurement is kept rather than deleted, because the next person to read
  "under-visited" will reach for the gate. It costs **456s**, which is real —
  the effect sizes are 4 to 6 deaths in 60, so fewer seeds would measure
  nothing at all, making it keep-at-full-price or not at all. Instrument bars
  only, no bar on the outcome, for the reason the walk-out measurement beside
  it gives.

  **Two printouts were relabelled in the same commit, and the reason is the
  point.** Adopting the relaxing floor earlier the same day changed what
  `SETTLER` IS, which silently made two existing measurements describe a band
  that no longer exists: the retreat table still called its baseline "floor 9
  (the published settler)" while that arm now gives way, and the floor
  measurement ended up comparing today against itself — "gives way from day
  14 vs today: saved 0, killed 0". Both passed. A green test whose printout
  misdescribes what it ran is the same defect as a stranded doc comment, and
  this file found four of those in two days. The floor table names the old bot
  explicitly now and pairs against it, so it reads as what the change bought:
  48/120 to 67/120 seeing spring, saved 20 against killed 1.

- **2026-08-22 — The worldgen adapter is unblocked, and stops one step
  short on purpose** — the port's own next item. `LandnamWorldgen.cpp`
  (UE-typed, Blueprint-facing) and `Sim/LandnamSimWorldgen.cpp` are the same
  generator transcribed twice; the fix is for the first to become a thin
  adapter over the second. Both prerequisites shipped in landnam-ue
  `54d10c0`, and parity stayed green through both — `PARITY OK, 39
  checkpoints across two runs`, plus the 8 golden worlds hex for hex.
  **`Attempts` and `bValid` on `FSimWorld`**, because `FLandnamWorld` has
  always reported both and an adapter that re-derived them would keep the
  duplicate it exists to remove. They cannot move a parity hash and that was
  checked rather than assumed: `CanonicalWorld` names the TypeScript world's
  keys one at a time and does not reflect over the struct.
  **`ULandnamRng::GetState()`**, because `FSimRng` is `{ Seed, State }` and a
  generator handed to the adapter may already have been advanced — seeding
  from the seed alone would silently rewind it and build a different island
  from the one the caller was about to get. Not a `UFUNCTION`: the Blueprint
  surface is a promise and this is not part of it.
  **And the one part of the conversion that could have been silently wrong**
  rather than loudly wrong: tile ORDER. `FLandnamWorld.Tiles` documents
  row-major offset order and `FSimWorld.Keys` is insertion order that
  worldgen deliberately leans on. They agree — the sim inserts under
  `for Row { for Col }`.
  **Why the adapter itself is not written.** It cannot be verified from
  here: no Unreal, no UHT, and `run-parity.sh` compiles only `Sim/`. The
  Blueprint-facing file is covered only by the in-editor automation test, so
  writing it blind means a compile error found by somebody with an editor and
  no author. A stub-Unreal shim was considered and rejected — UHT parses
  those macros separately, so a shim that compiled would prove syntax while
  looking like verification. This document records three hollow bars already.

- **2026-08-22 — The bot gives way as winter closes, and every published
  curve is restated** — the finding that fell out of closing the retreat
  thread, chased to the bottom. **This supersedes every hardship figure in
  this document dated before today.**

  **The instrument was defective, not merely different.** `policy.siteFloor`
  was a FIXED 9, so the band held out for Fair-to-Good ground for as long as
  it took — and in **45 of 120 seeds it never settled at all**, dying on the
  road with the posts still in the boat. No player does that: winter comes on
  day 49, and a band still walking on day 40 takes what it can get. The
  file's own comment above that branch said "settle on anything workable
  rather than holding out for perfection", which is exactly what the fixed
  floor did not do.

  **Four strategies, same seeds, same day, paired.**

  | | settled | ground | day | saw spring | vs today |
  | --- | --- | --- | --- | --- | --- |
  | holds out (floor 9, the old bot) | 75/120 | 9.4 | 16 | 48/120 | — |
  | takes anything (floor 0) | 102/120 | 8.5 | 15 | 75/120 | saved 29, killed 2 |
  | **gives way from day 14** | 98/120 | 8.9 | 18 | **67/120** | **saved 20, killed 1** |
  | gives way from day 21 | 98/120 | 8.9 | 20 | 63/120 | saved 16, killed 1 |

  **Floor 0 wins and was NOT adopted, which is a judgement and is worth
  stating as one.** The instrument's job is to stand in for a reasonable
  band, not to play optimally: a player does not plant posts on the first
  legal hex on day two without looking, and one who did would make every
  curve describe a strategy nobody uses. `relaxFrom: 14` gives up a point a
  week and never goes below the bottom of "Hard ground" — the verdict the
  game itself writes as "it could be held, by people with nothing better".
  **And the sharper finding underneath: WHEN you settle beats WHAT you settle
  on.** Taking anything lands on worse ground than giving way (8.5 against
  8.9) and still sees more springs, because it settles three days earlier.

  **What it cost to adopt: two assertions, both honest restatements.** The
  whole suite was run with the new bot before anything was decided, and
  exactly 2 of 1080 failed — both the published `odds` in
  `src/data/hardship.ts` no longer matching what the harness measures. Those
  are promises the difficulty menu reads its prose from, so a promise that no
  longer holds is a lie to the player, not a bar to loosen. Restated:

  | | reached winter | saw spring | ever rule |
  | --- | --- | --- | --- |
  | A Fair Country | 88 → **97%** | 73 → **87%** | 28 → **40%** |
  | As It Lies | 82 → **92%** | 45 → **72%** | 8 → **10%** |
  | A Hard Country | 82 → **83%** | 10 → **23%** | 3 → **5%** |

  **The winter marks are properly ordered for the first time.** They read
  88/82/82 before, and this document recorded the tie honestly as "the honest
  reading rather than an ordering". With a band that actually settles they
  separate: 97/92/83. An instrument that could not tell As It Lies from A
  Hard Country at the winter mark was hiding a real difference.

  Nothing about the GAME changed here — `siteFloor` is the harness, not the
  sim — so no save shape moved, the port is untouched (the odds are web-only
  prose, generated into no C++ table), and the parity fixtures recompute
  unchanged. What changed is that the numbers now describe a band that plays
  like a person.

- **2026-08-21 — The narrow field moves, and a hex clears 44px at every
  width** — the 320px battlefield, decided and built. It had sat as an open
  design question since the mobile audit: a battle hex is a touch target, the
  field frames the whole grid so hex size falls out of screen WIDTH, and
  320px tops out below the 44px rule however much height it is given.

  **Two ways out, and one of them is not a design call at all.** Panning is a
  renderer change. A smaller grid on small screens is not: `FIELD_WIDTH = 7`
  is a SIM constant and it is generated into the port as
  `constexpr int32_t FieldWidth = 7`, so a screen-dependent grid would make
  the same seed play differently on different phones, break replay
  determinism, break parity, and let the renderer dictate sim state. That
  ruled it out on grounds the open thread never stated.

  **What shipped.** The field zooms exactly as far as 44px demands and no
  further — zoom is NOT a user control — and the player drags for the rest.
  Above 360px nothing changed at all: `canPan` is false, the field frames
  itself as it always has, and a drag on it does nothing. The pan follows
  whoever is acting and a new turn drops it, because a field that will not
  show you whose turn it is is worse than one that moves.

  | | hex before | hex after |
  | --- | --- | --- |
  | 412×915 | 54px | 54px, untouched |
  | 390×844 | 51px | 51px, untouched |
  | 360×640 | 47px | 47px, untouched |
  | 320×568 | **39–43px** | **44px** |

  **The measurement corrected me twice before a line was written.** The
  ROADMAP's own 42px figure for 320 is the WIDTH-bound ceiling taken with
  height removed; the real viewport measures 39px, so the shortfall was 5px
  and not 2. And the first cut derived the rule from `HEX`, the layout size —
  but the tile is DRAWN at `HEX - 0.5` for the hairline between hexes, and
  that smaller shape is what a thumb lands on. It predicted 44.00 and
  rendered 43.27: a miss of under a pixel, invisible in the code, caught only
  by measuring the rendered polygon in a browser. They are one constant now.

  **It found a bug that predates it, on every screen size.** A drag on the
  field ended in a tap, because `pointerup` was a tap unconditionally — so
  dragging a finger across a 390px battlefield, reaching for the action bar
  or trying to scroll, ordered whoever was up to WALK to wherever the finger
  stopped. It had nothing to do with 320px and had been there as long as the
  field has. The drag is tracked at every width now and only the panning is
  gated on there being anything to pan; the slop that separates a tap from a
  drag is measured in screen pixels, since two world units is under two
  pixels once the field is zoomed and would make a shaky tap read as a drag.

  **`scripts/pan.mjs`, and the hazard it exists for.** The same `pointerup`
  that ends a pan used to order a fighter to walk there — a drag that marches
  a warrior into a shield wall because the player wanted to see the left
  flank is worse than the 5px it fixes, and no unit test in this repo can see
  it, because the suite runs in node and the renderer is deliberately
  untested there. `npm run pan` drives a real fight at 320 and 390 and checks
  that the narrow field pans, the wide one does not, neither taps by
  accident, and a tap still moves a fighter.
  **And the first version of that check was itself flaky**, which is worth
  more than the feature. It dragged once and asserted the view moved; the
  zoom is only ~1.7%, so a few pixels are ever off screen and the view is
  usually already hard against a clamp, where dragging legitimately changes
  nothing. It read "did not pan" on two runs in four. A flaky check is worse
  than no check: it compares both extremes now, and was run five times before
  it was believed.

  `scripts/field.mjs` holds the 44px line at every width now instead of
  exempting 320 — the exemption and its `SUPPORTED` constant are gone.

- **2026-08-21 — Walking out has no real case either, and being choosy is
  what actually kills (open thread closed)** — the last item on the
  open-threads list, and it was filed as unmeasurable: *"the bot only settles
  on ground that already clears its site floor, and inventing a worse-settling
  bot would measure a strawman."*

  **Half of that objection was wrong.** The floor is not a property of the
  game — it is `policy.siteFloor`, a dial the `Policy` type already exposes,
  and one RAIDER already sets to 7 against the settler's 9. Dropping it to 0
  is not a bot that hunts for bad ground; it is a band that takes the first
  ground the game will let it have, which is the impatient player and exactly
  the thread's own case. One variable moved. The seeds, the day count, the
  hardship and the McNemar pairing are the published walk-out measurement's
  own, and the floor-9 arm reproduces its **48/120** exactly, which is the
  cross-check that says the instrument is the same one.

  | arm | settled | ground | day | saw spring |
  | --- | --- | --- | --- | --- |
  | floor 9 — the published settler | 75/120 | 9.4 | 16 | 48/120 |
  | floor 0 — first legal ground | 102/120 | 8.5 | 15 | **75/120** |
  | floor 0 + walks out | — | — | — | 64/120 |

  **The verb still has no case: saved 0, killed 11**, paired against floor 0.
  That is its most favourable possible setting and it is no better than the
  measurement it already had. The thread is closed on the answer it was
  asking for.

  **The case itself is thinner than the thread assumed.** Over 10,899
  foundable hexes in 20 worlds the scores run 4–16, half of them at exactly 7
  ("Hard ground — it could be held, by people with nothing better"), and only
  **53 of them, 0.5%, fall below 6** into "a place to die in, slowly". A band
  cannot easily take ground bad enough to regret: `canFound` already refuses
  sea, rock and waterless ground. That is why a floor of 6 and a floor of 0
  are the same policy in practice — nothing below is ever offered — and why
  the rash arm still lands on a mean of 8.5.

  **And the thing that fell out of it, which is bigger than the item.**
  Dropping the floor took **48/120 to 75/120 seeing spring** — the same size
  as the winter-mark lever, the largest effect ever measured in this project.
  It is not that poor ground is fine; it is that the picky band **never
  settles at all** in 45 of 120 seeds and dies on the road. Being choosy
  costs more than bad ground does. The mechanism is stated rather than
  inferred: the arms are decomposed into who saw spring with posts in the
  ground (46 vs 73) and who was still roaming (2 vs 2).

  **What is NOT decided here.** Whether `SETTLER.siteFloor` should change.
  Every hardship curve in this document was measured with it at 9, so moving
  it would restate all of them, and that is a call to make deliberately
  rather than as a side effect of closing an unrelated thread. It is on the
  open-threads list now with the number attached.

- **2026-08-21 — The coast remembers whose steading it was (audit #8)** —
  the last unchased design idea, and **the premise was the opposite of the
  guess**, which is why it got measured first.

  **What I expected to find, and did not.** The fear was reach: that a band
  never walks onto the ruin, the way places are never LEARNED and the market
  turned out to be under-VISITED. It is false. Across 30 haunted sagas the
  bot found the ruin and TOOK it 15 times (raider 14), standing in it 87
  times; the ruin is placed in 29 of 30 worlds and its hex is seen in 21.
  A haunted coast meets its ghost about half the time it is offered one.

  **What was actually missing was the record.** In 17 takings the saga named
  the ghost **zero** times. The name reached the permanent log exactly once,
  on day one, in a rumour written before anybody had seen the place — *"they
  called their steading Eikstead. Nobody said where it was"* — and the taking
  closed that loop anonymously, with a data-table line about a winter someone
  did not see the end of. The panel knew whose it was while the band stood in
  the ruin; the saga, which is what a player reads back and what a run is
  remembered by, did not. That is exactly the "narrower than the idea" the
  audit judged and never wrote down.

  **What shipped.** `ghostTakenLine` in `sim/haunt.ts`, written by
  `settlePlace`: *"So this was Eikstead, that we had been told of. They ran
  out of food on day 128."* It shares one `theirEnd` sentence with
  `ghostLine` on purpose — two surfaces onto one fact, and two copies of a
  sentence are two sentences that disagree the first time somebody edits one.
  And the panel keeps naming them after the ruin is taken: `whose` used to
  hang off the un-sacked arm of a ternary alone, so taking the ruin turned it
  back into "a steading nobody came back to" for the rest of the run. It is
  appended outside the branch now — a branch cannot forget what it does not
  carry.

  **A bug the fix would otherwise have shipped.** `abandonSteading` leaves a
  ruin behind too — the band's OWN hall, under `ruin:<hex>` — and the name
  was keyed off the KIND. Own-ruins are marked sacked the day they are made,
  so showing the name in the sacked branch would have put a stranger's name
  on the band's own posts. It is keyed by id (`GHOST_RUIN_ID`) now. Nothing
  in the suite caught it because the balance bot never walks out
  (`retreats: false` on all three policies); the bar for it was watched
  failing against the old rule before it was trusted.

  **Three instrument faults, all of which produced believable numbers.** This
  is the part worth keeping.
  1. The probe's ghost was named `Eikstead` — a name the GAME can compose for
     the band's own steading, so every line about home counted as the ghost.
     Found only because 76 writes from 17 sackings is arithmetic that cannot
     happen. The name in the bar cannot be composed from the pool.
  2. The write counter keyed off `saga.length` growing, but `chronicle`
     splices at the 300-entry cap, so a write into a full log was invisible.
     That read as 13 of 14 and looked like a game fault. It keys off the
     sacking transition now.
  3. The ghost's hex came from another world's LANDING, and landings sit in
     similar places across worlds — the ruin was arriving on the band's own
     doorstep and being taken on day 2. It comes from a real steading in a
     real saga now (the sender seed played 90 days; 15 of 30 had posts in the
     ground by then, the rest fall back to their landing, which is stated
     rather than hidden).

  **The port is unaffected, checked rather than assumed.** The ruin is
  `seeded: false`, so worldgen draws exactly what it drew before, and no
  recorded run carries a ghost — the `contract` and `goldenport` fixtures
  recompute every stored vector unchanged. Nothing to carry across; when the
  port reaches places, this is one line in `settlePlace` and an id check.
  No save-shape change. npm test green, tsc clean.

- **2026-08-21 — `travel.ts` is the reducer again, and the fourth stranded
  doc comment of the day is found** — the last of the four ~630-line files.
  All four are now split; the open thread is closed.

  | file | lines | what it is |
  | --- | --- | --- |
  | `travel.ts` | 227 | the reducer: every verb's guard-and-spend, MOVE through LAY_DOWN_RULE |
  | `road.ts` | 255 | what a hex costs over ground or coast, what a day advances, what dusk reveals, and the march lines |
  | `gathering.ts` | 181 | living off the land: camp, forage, hunt, fish |
  | `saga.ts` | 44 | gains `fresh` — the don't-repeat-yourself picker belongs beside `chronicle` |

  `road.ts` exports `actionRng`, `advance` and `reveal` that were
  module-private, with the same note as swing.ts's: verbs split across
  files must roll from the same derived stream (events, here — NOT swing's
  combat stream) and spend days through the same walk, or a replayed save
  forks. The four gathering verbs moved whole and the reducer delegates to
  them, which is the shape `actions.ts` already uses for battle verbs.
  **The stranded doc:** "Once the posts are in, the band lives at the
  steading and only a launched expedition walks the map" sat stacked above
  `ROW_REACH`'s doc; it describes `canMove`'s first line, 30 lines away.
  Reattached. Four files split this month, four stranded docs found —
  that is not a coincidence, it is what 630-line files do.
  No behaviour change, checked where it counts: the headless replay
  fixtures recompute both recorded runs' checkpoints, so a forked stream
  or a reordered day could not pass. npm test 1072/1072, tsc clean.
  Twenty-one import sites repointed; only `actions.ts` and the reducer's
  own test still import `travel.ts`, which is now true to its name.

- **2026-08-21 — `main.ts` is a 199-line boot router again, verified in a
  real browser because no unit test can see it** — the third ~630-line file.
  Its seams were the ones its own comments had already drawn: the pinned
  chrome "outside the shell", the screen-reader wiring of audit item 10, and
  the three mode paints.

  | file | lines | what it is |
  | --- | --- | --- |
  | `main.ts` | 199 | boot, the one state reference, dispatch, run lifecycle, the router |
  | `shell.ts` | 91 | the persistent slots, the live region, `nameOverlays`, `ScreenHooks` |
  | `chrome.ts` | 169 | the pinned mute/gear/settings and the first-gesture audio start |
  | `render/travelScreen.ts` | 157 | the road's screen; owns the map view and the ambience easing |
  | `render/battleScreen.ts` | 82 | the fight's screen; owns the field view and the field tap |
  | `render/colonyScreen.ts` | 83 | the steading's screen and the picker's small rules |

  The screens thread through `ScreenHooks` — `OverlayHooks` (the shape
  `travelOverlay` already used) plus a `current()` getter, because a tap
  handler outlives the render that installed it. No new machinery, one
  interface. `debug.ts`'s own header had already named this split: "main.ts
  was six hundred lines and every milestone added to it."
  **Verification is the real point.** `main.ts` is the one file the suite
  cannot reach, so the bar was a browser, not an assertion: the repo's
  offline check (boots the built page with the network cut, plays to day 2,
  zero page errors) plus a 16-check Playwright smoke — settings card open
  and shut in travel AND colony, Band overlay, a fight started and a Shield
  set with the log advancing, the save reloaded INTO battle mode, and a
  settled save reloaded into the colony with both tabs painting. All green,
  `tsc` clean, singlefile build unchanged in size class. The suite does not
  import any touched file, so 1072/1072 stands.

- **2026-08-21 — `battleActions.ts` is four files, and this one had a
  stranded doc comment too** — the second of the four ~630-line files, split
  to the winter.ts template: along the file's own verb banners, importers
  repointed at the module that owns what they use, no facade.

  | file | lines | what it is |
  | --- | --- | --- |
  | `swing.ts` | 179 | what every blow shares: evasion, the country's edge, the wall's push, the named wound, the fall |
  | `strike.ts` | 289 | the three ways iron reaches a man: swing, second-rank thrust, thrown spear |
  | `footwork.ts` | 150 | legs and stance: move, shove, defend, dash |
  | `warcry.ts` | 62 | the leader's cry — an action, so it sits beside morale.ts rather than in it |

  Not `reach.ts` for the thrust: winter's reach already owns that name, which
  is itself an argument for the split — two unrelated `reach` concepts were
  one grep before. **Two helpers are exported that were module-private**,
  `actionRng` and `drop`, noted in place: every verb must roll from the same
  derived stream or a replayed save forks, and every kill must walk the same
  fall bookkeeping (tally, nerve while the fallen still counts as a link,
  the leader's fall after the cause) or the verbs grow two orderings. `blow`
  and `ourBite` stayed private — they moved into `strike.ts`, the only
  module that uses them. **The same disease the winter split found, found
  here:** the doc "How hard this fighter is to land a blow on right now"
  sat stacked on `ourBite`'s doc at the top of the file, 155 lines from the
  undocumented `evasion` it describes. They are back together. And the
  `groundCost` re-export "for the renderer's preview" at the bottom was
  DEAD — every real consumer already imports `battlefield.ts` — so it died
  with the file rather than being carried.
  No behaviour change, checked: npm test 1072/1072 including the parity
  fixtures, tsc clean. Fifteen import sites repointed;
  `test/battleActions.test.ts` keeps its name because the five verbs are
  still one suite, and two other test files cite it by name.

- **2026-08-21 — `winter.ts` is four files, and one of them found a stray
  doc comment** — audit item 10, on the one file that actually earned it.
  The ~300-line rule was surveyed on 2026-08-20 and the honest finding was
  that most of the 52 files over it are tests and data tables; the source
  files that genuinely read long were `winter.ts`, `battleActions.ts`,
  `main.ts` and `travel.ts` at ~630 each. This is the first of those, and it
  was picked because every winter investigation this project has run has had
  to navigate it by grep.

  | file | lines | what it is |
  | --- | --- | --- |
  | `winter.ts` | 237 | the mark: the forecast, the haze, what is needed |
  | `reach.ts` | 289 | whether it can still be met, and what to say about it |
  | `cold.ts` | 106 | a fire that goes out, and the illness that follows |
  | `telegraph.ts` | 79 | saying it before it happens |

  **The seams were already drawn** — the file's own `// --- Sickness ---` and
  `// --- Telegraphing it ---` banners. `reachable` had to move too, because
  it alone is 225 lines: it is a whole second projection, reassigning a clone
  and asking the forecast again at full effort.
  **Two helpers are now exported that were module-private**,
  `plannedFirewood` and `ratio`, and the note on them says why: they are the
  projection the mark walks, and `reachable` walks the same ground. Sharing
  them is what stops the two from being parallel models that can disagree,
  which is the rule the original file was written to.
  **And the thing worth doing it for.** There were TWO stacked doc comments
  above `reachable`. The first — "One line naming where the band stands
  against the winter" — describes `readiness`, which sat 226 lines below it
  with no doc of its own, stranded by some earlier move. Nothing catches that
  but reading, and nobody reads 655 lines. They are back together.
  **No behaviour change**, and it is checked rather than asserted: 1072 tests
  pass unchanged, including the parity fixtures that recompute every stored
  reading, and the single-file build is unmoved.

- **2026-08-21 — PARITY OK: 39 checkpoints, two runs, six facets each** — the
  port reproduces the reference exactly, across 1478 actions and 457 days on
  one script and 66 on the other. Four causes, and the last three are the same
  cause wearing different clothes.
  **1. Orphan grief.** `ORPHAN_GRIEF` was the only lineage constant the
  generator never emitted, because nothing on the port side read it: the
  port's `Mourn` did the kin half and not the children half. Ported, and
  called BEFORE the kin guard, because the reference calls `orphaned` before
  it looks for kin at all — a death that leaves a child costs the steading
  whether or not the dead had anybody bound to them. Putting it after the
  early return would have been right on every death that happened to have kin
  and silently wrong on the rest. First divergence moved 220 actions later.
  **2. A THIRD copy of the mouths formula.** The draw odds inlined
  `(Household + 1) / 2` — grown heads only — where the reference calls
  `foodPerDay`. On day 412, with three children under the roof, the port read
  a larder of four against the reference's five; a smaller larder makes
  `plenty` bigger; the odds cleared a roll of 0.0647 that the reference's
  0.0596 did not, and the port took in a hand that never existed on the other
  side. Two copies of this formula were already collapsed when short commons
  landed and this one was missed. It is the whole argument for there being
  one.
  **3. The `wound` event effect**, which the port had been declaring as
  unported all along. A card took four health off a sworn man; `health: 7`
  against `health: 11` was the last byte in an 8,350-character facet.
  **A latent divergence closed on the way out.** The first cut of the wound
  port stamped `diedOn` on a card death. The reference does not — it sets
  health, alive and fate and nothing else. Nobody dies of a card in either
  recorded run, so it would have passed today and diverged on the first save
  that did. Matched exactly instead. Whether the reference SHOULD stamp it is
  a real question for that repo and not a licence for the port to differ.
  **What made all of this findable** was a per-action trace on both sides and
  `LANDNAM_DUMP`. Every one of these was a value at a matching size — five
  points of morale, one hand, one digit of health — and a size cannot name any
  of them.

- **2026-08-21 — The last parity gap is one child** — the three refusals
  chased to a single named root cause, and `runs/example.json` verified green
  independently rather than taken on trust.
  **The signal.** `runs/long.json` matched at 13 of 14 checkpoints with the
  final one at day 457 reading `refused=3` against the reference's
  `refused=0` — and the reference refuses NOTHING across all 1478 actions, so
  all three were the port's.
  **Which three.** Read out of the harness's per-action log rather than
  guessed: `QUEUE_BUILD watchtower` on day 439, and `CHOOSE 0` and
  `DISMISS_EVENT` on day 456.
  **But they are all consequence.** A per-action trace of the reference,
  written with the same canonical function the vectors use, put the FIRST
  divergence 379 actions earlier: **action 1099, day 353, the `band` facet at
  5161 bytes on both sides and a different hash.** Same size, different value
  — which is the mismatch a size cannot name.
  **One digit, and it is a whole feature.** `LANDNAM_DUMP` (added to the port
  harness for this, and kept) printed the port's band: morale **39** against
  the reference's **34**. The arithmetic of the lost raid accounts for 39
  exactly — two ran (−8), two killed (−15 −24), the sacking (−14). The
  reference pays five more, and five is `ORPHAN_GRIEF`.
  **The chain, proven rather than assumed.** The reference bore two children,
  Halli on day 140 and Bersi on day 291. A raid on day 353 killed Bersi's
  mother. `orphaned()` took 5 heart for the child left behind, and the port
  never paid it.
  **CORRECTED THE NEXT DAY — the reason given here was wrong.** This entry
  said the port had no children "because BIRTHS ARE NOT PORTED, blocked on
  `houseAtPeace` and the Thing". Births WERE ported, and the evidence was in
  the same readout: the steading facet matched at the divergence, which it
  could not have if one side held two children and the other none. What was
  missing was only the other half of mourning — `orphaned()` — and
  `ORPHAN_GRIEF` was the single lineage constant the generator never emitted,
  because nothing on the port side used it. The diagnosis of WHAT (five
  points, that child, that raid) was right; the diagnosis of WHY was not
  checked and should have been. See the entry above this one.
  **`runs/example.json` is green on its own** — 17 checkpoints, six facets,
  run separately because the harness stops at the first failure and I had not
  actually seen it pass since the cold-night work.

- **2026-08-20 — The door is built, and measured at not worth walking
  through** — audit item 6 again, and it answers the question the entry below
  explicitly left open rather than re-fixing the same thing.
  **What shipped.** `ABANDON`, a steading verb: it gives up the hall, puts the
  band back on the road, and lets it found again — which `foundSettlement` had
  said in its own comment was impossible ("no unfound, no second steading").
  It costs the whole of the work — buildings, shelter, watch, queue and banked
  builder-days — plus 12 heart against the 8 founding paid, so the round trip
  is a net loss and cannot be done idly, and a ten-day floor since founding
  stops it being a free look at the site report. Save v36 with a migration.
  **Two hazards closed on the way, both watched failing.** The ruin left
  behind is marked SACKED THE DAY IT IS MADE: the `ruin` kind carries loot for
  `haunt.ts`, and a lootable one would have made walking out a way to get your
  own timber back, so the cost would have funded itself. And the CHILDREN come
  along — `Settlement.children` is a record kept on the ground and
  `childrenOf` feeds `foodPerDay`, so a naive retreat would have been a way to
  stop feeding your own children. They ride on `state.bairns` until there are
  posts to keep them at.
  **Then it was measured, and it is bad.** Given to the bot as "walk out when
  the verdict condemns this ground", 120 paired landings on As It Lies:
  **50 retreats, saved 0, killed 11**, spring 48/120 down to 37/120. Obvious
  once said — what dooms a band in autumn is empty stores and no time, and
  retreating spends the buildings and a week of road to make both worse.
  **So the panel still does not offer it**, and the reason has changed from
  "that verb does not exist" to "that verb is measured to kill you". The
  control sits on the steading screen as the quietest thing there, with the
  cost on its face. A band that wants to leave can leave; nothing suggests
  they should. The bar in `winter.test.ts` turned out to be one-directional in
  code while its comment claimed a pair — the comment was corrected to match
  what it actually holds, which is the direction that was ever a defect: the
  game must not advertise a move it would REFUSE. Advertising a move it merely
  disagrees with is a design call, not something a string search should make.
  **The instrument earned its keep again.** The first cut parked the walk-out
  delay in `settleNotBefore`, which is shared across a whole sample, so one
  retreat on day 54 barred all 119 later landings from settling at all. It
  read **"killed 46" off THREE retreats** — arithmetic that cannot happen, and
  the retreat count printed beside the outcome is what caught it.
  **What is NOT claimed:** that the verb is useless. The case it is actually
  for — ground taken too fast, walked off early in the summer — cannot be
  measured with this bot, which only ever settles on ground that already
  clears its site floor. Saying so beats inventing a bot that would.

- **2026-08-20 — The panel stopped offering a door that is not there** — audit
  item 6, "abandon a steading without dying", and the measurement turned it
  into a truthfulness fix rather than a feature.
  **The premise checked out, and worse than stated.** There is no abandon
  verb: `foundBlocker` answers `settled` the moment the posts are in, and
  NOTHING anywhere clears `state.settlement`. But `readiness()` — the line a
  band reads when the mark has written it off — said *"What is left is taking
  it from somebody else, or walking out and wintering elsewhere."* Half that
  sentence named a move the game would refuse, offered at the worst moment it
  could be offered.
  **So it names one way out now, and it is the one that exists.** Falling on a
  place is a real verb; walking out is not.
  **Barred as a PAIR so it cannot rot in either direction:** the test reads
  the action union off `src/sim/actions.ts` AND `src/sim/travel.ts` and
  asserts the prose may only promise walking out when an `ABANDON` verb is
  actually there. Build the verb and the test tells you to put the sentence
  back. Watched fail by restoring the old line. Its first cut read only
  `actions.ts` and went red on `FALL_ON`, which lives in travel.ts — the right
  way for a bar like that to be wrong.
  **What is NOT decided here.** Whether a band should be able to walk out is
  a live design question. The "saved nobody" figure everyone quotes measured
  the escape hatch AS IT EXISTS — raids and errands — and an
  abandon-and-resettle has never existed, so nothing has ever measured it.
  Removing a promise is not the same as ruling out a feature.
  **The other three audit ideas, measured and reported rather than built:**
  - **#9, a reason to go inland — premise is false.** 47 of 120 places across
    30 worlds are off the shore, and every world carries all four kinds. The
    sharper question underneath it is real and different: the oreseam, the one
    place that is always inland, pays no goods.
  - **#10, the ~300-line rule — 52 files, not 20.** Most are tests and
    `eventCards.ts`, which is a data table; the rule is about domains, and a
    5,159-line harness and a 2,046-line card list are not the defect it was
    written against. The source files that genuinely read long are
    `winter.ts`, `battleActions.ts`, `main.ts` and `travel.ts` at ~630 each.
  - **#8, the coast remembering the ghost** — `sim/haunt.ts` already ships the
    ruin a challenge code carries onto somebody else's coast. What is missing
    is narrower than the idea and was not chased today.

- **2026-08-20 — One run green, the other one checkpoint short** — the second
  parity push. Everything the port had DECLARED as skipped is now ported, and
  `runs/example.json` passes outright.
  **Cold nights.** The port reported two gaps by name — `passDay: a cold night
  with teeth in it` and `coldNight: a fireless night in the dark half of the
  year` — and both are in: the bite that wounds everyone, and the roll that
  decides who takes ill. The illness table and `SicknessBaseDc` are generated
  rather than retyped, and `winterDepth` was split out of `FirewoodOn` so the
  wood and the sickness read ONE seeded draw instead of two. **It took the
  `band` facet from the wrong shape to the right one**: 3537 bytes against an
  expected 4745 before, 4745 after.
  **Lineage.** Ageing on the turn of the year, and births — six gates, the
  name pool that refuses a name already standing in the band, `lastBorn`, the
  heart it lifts, and children counted as mouths at `ChildAppetite`.
  `houseAtPeace` is the sixth gate and reads a grudge list this rung does not
  have; that is written down as safe rather than convenient, because
  `stirGrudges` already reports the moment bad blood WOULD form, so any run
  where the gate could have closed is one the harness has already flagged.
  **Where it stands:**

  | | before today | now |
  | --- | --- | --- |
  | `runs/example.json` | failing | **PARITY OK, 17 checkpoints** |
  | `runs/long.json` | 0 of 14 | **13 of 14** |
  | self-declared gaps | `unported=2` | **`unported=0`** |

  **What is left is one checkpoint and a new investigation.** At @1478, day
  457, the port reaches the right day and refuses 3 actions the reference
  accepts. The `run` facet is 23 bytes light — about one `"seen_<card>":1`
  flag — so an event card was dealt on one side and not the other, and the
  child born on day 408 gets a different NAME as a result (steading differs by
  four bytes, which is a name length, not a child). World, coast and field all
  match at that checkpoint. That is a fresh thread rather than a known gap,
  and it is not claimed as done.
  **Two C++ helpers are named oddly on purpose** — `DiceRoll` and
  `BornAWoman` rather than `Roll` and `IsWoman` — because the harness compiles
  every file as ONE translation unit the way UnrealBuildTool does, and two
  anonymous-namespace copies of a name are ambiguous there rather than
  private. Both were caught by compiling, which is the point of compiling.

- **2026-08-20 — Parity chased from day one to day 273, and two of the four
  causes were bugs on THIS side** — the red Parity workflow, diagnosed and
  driven back. It had been failing since the first contract hand-over on
  2026-08-19 and the reading "the port is five days behind" was only a
  quarter right.
  **Where it started.** Every facet diverged at checkpoint @0, day 1, before
  a single action. Reproduced locally with `Tools/run-parity.sh`, which
  compiles the sim core with g++ and needs no editor.
  **Cause 1 — a generator bug here, not missing port work.** `PLACE_KINDS`
  gained a `ruin` marked `seeded: false` when the shared-coast work landed;
  `src/sim/places.ts` skips it, and `scripts/party-tables.ts` emitted it
  anyway into a table its own header documents as "IN SEEDING ORDER —
  seedPlaces walks this list". The port believed the header. `ruin` sat
  SECOND, so the C++ seeded a place the reference never seeds and consumed
  draws from the `places` stream before town, wreck and oreseam — every place
  after it landed elsewhere and the two builds disagreed about the map from
  day one. One `.filter(k => k.seeded !== false)`.
  **Cause 2 — a stale hardcoded list in the port's harness.** `run-parity.sh`
  asked for checkpoints `132/660/852/874/875/1320`; `runs/long.json` had been
  re-recorded and grew from 1320 actions to 1478, moving them to
  `147/739/855/883/884/1478`. Six indices the vectors no longer carried: the
  expected side emitted nothing for them, the port printed its state at those
  wrong offsets, and the diff compared sixteen lines against twenty-two. It
  read as six deep divergences and was an artifact of asking the wrong
  questions. The harness reads the indices out of the vectors now — the same
  "unowned copy of a generated fact" defect as `foes.json`, in the same day.
  **Cause 3 — short commons was genuinely unported.** The `run` facet was
  exactly 13 bytes light: `"leanDays":0,`. Ported properly rather than
  papered over — `RationShare`/`HalfRationHeart`/`HalfRationToll` generated,
  a three-state `Rations` on the party (absent, "full" and "half" are three
  different things to a canonical writer), the day's morale-and-toll block,
  and `SET_RATIONS` as a colony verb. It also collapsed the port's TWO copies
  of the mouths formula into one, which is the lesson `src/sim/upkeep.ts`
  already had written on it.
  **Cause 4 — weather was genuinely unported.** `reveal()` adds
  `weatherOn(seed, day).sight`, so the port's sight radius was wrong from the
  first day a gale or a sea fog turned up: four tiles stayed `"visible"` that
  should have read `"seen"`, twelve bytes of the world facet. The table is
  generated and `WeatherOn` is a pure function of seed and day, matching
  `rng.weighted` subtraction order exactly. Its `firewood` is applied to the
  night's burn too.
  **Plus the `children` list**, fourteen bytes of steading from the day the
  posts go in.
  **Where it stands, measured rather than claimed:**

  | | before | after |
  | --- | --- | --- |
  | first divergence | @0, day 1 | @739, **day 273** |
  | checkpoints matching | 0 of 14 | **9 of 14** |
  | facets clean to day 81 | none | **all six** |

  **What is still out, and it says so itself.** The port reports
  `unported=2` at the point it diverges — `passDay: a cold night with teeth
  in it` and `coldNight: a fireless night in the dark half of the year`. That
  is the next rung, and it is declared rather than faked. BIRTHS are the other
  one: `birthBlocker` gates on `houseAtPeace` and the Thing is not ported, so
  the children list ships empty, which is the honest state of these runs — the
  vectors and the port agree on every facet to day 81 with an empty array.

- **2026-08-20 — The port was building against half a roster, and now nothing
  owns nothing** — the known-and-deferred `foes.json` drift, closed. An
  artifact comparison, which continues to be the category that survives
  measurement.
  **What was wrong.** `Content/Data/foes.json` held FOUR of this repo's eight
  archetypes — `spearman`, `bondi`, `wolfcoat` and `outlaw` simply absent —
  and `FFoeArchetypeRow` had no `Renown` column at all, so the knob that
  decides which foes a famous band meets could not have been imported even if
  the rows had been there.
  **Why no parity run could ever have caught it.** The C++ sim reads
  `Tables::FoeArchetypes` out of `port/LandnamBattleTables.gen.h` — generated,
  under contract, correct with all eight throughout. What drifted was the
  editor and Blueprint side. **The half a parity harness cannot see is the
  half that drifted**, which is the general lesson and worth more than the fix.
  **The cause was written on the file next door.** `foe-names.json` credits a
  generator — `ue-port/tools/export-data.mjs` — that exists in neither repo.
  Generated once, generator lost, hand-maintained ever after. Of the three
  files it produced, `terrain.json` and `foe-names.json` were still correct
  and `foes.json` was not: unowned files are right by luck, not by property.
  **So all three are generated, not just the broken one.**
  `scripts/port-data.ts` emits them from `src/data`, `npm run port:sync`
  carries them (10 contract files now, was 7), and `test/contract.test.ts`
  goes red when they move. The port-sync comment that honestly said "nothing
  here generates them" is no longer true, so it no longer says it.
  **The proof the generator is right rather than plausible:** it reproduces
  `terrain.json` BYTE FOR BYTE against what the port already held — same key
  order, same one-space indent, same `Name` row key, same `-1`-for-impassable
  convention — and the four pre-existing foe rows come out with nothing
  changed and only `Renown` added. Watched fail three ways: a single altered
  terrain value, a dropped archetype, and a stripped renown column.
  **What is NOT done, and cannot be from here.** `foes.uasset` and
  `terrain.uasset` are real DataTable binaries in LFS; the JSON beside them is
  only the source they were imported from. **Until somebody opens the project
  and re-imports, the DataTable still holds four foes and no renown column.**
  Recorded in `port/sim.md` rather than quietly left as a green tick.

- **2026-08-20 — The mark says what to do about it now** — the follow-through
  on the winter-work measurement, and the first thing in a while whose premise
  was measured before it was built rather than after.
  **The case.** Crewing to the winter mark is worth 21/120 bands seeing spring
  against 48/120 — the largest single effect this project has measured. The
  game showed it as a NUMBER (`Wood 40 / 62`) and never as a move. Worse,
  `readiness()` — the one line of advice in the game — named the two ways out
  it knew when the gap looked hopeless: rob somebody, or walk out and winter
  elsewhere. **Both of those measured at zero bands saved and two killed.**
  The advice named the two things that do not work and omitted the one that
  doubles survival.
  **`src/sim/counsel.ts`.** Under the gap, one line: *"Two more hands at the
  woodpile would close it."* It re-runs `forecast()` on a copy with the hands
  moved rather than doing its own arithmetic — the `foodPerDay` lesson, one
  formula not two, so the counsel can never contradict the panel it sits
  under. Conservative by construction: it only moves hands that are idle, on
  the watch, on the walls, or producing something the band already has enough
  of. It never robs the larder to fill the woodpile.
  **The bar that made it honest, and it failed first.** "Says nothing it
  cannot back up" carries out every counsel over sixty landings and re-reads
  the mark. First cut: **22 of 51 did not close the gap they promised** — the
  counsel counted its BEST hands while the panel says "two more hands"
  without naming which two, so a player moving their two weakest came up
  short. Fixed by counting the WORST eligible hands: if the worst two close
  it, any two do. Now 51 of 51, with a second bar that swaps in a completely
  different set of hands and requires the promise to survive that too.
  **Also caught before shipping:** the first cut of the style rule coloured
  the line `--ink`, which is the page BACKGROUND in this palette — it would
  have been invisible on every screen it appears on. It is `--gold` now, the
  ink this game already reserves for the thing you act on.
  And one tautology of my own, written and then deleted: an assertion reading
  `expect(anyOnOther || true).toBe(true)`, which would have passed against
  advice that emptied the larder. Replaced with the outcome check — carry the
  counsel out and the other store must be no worse off.
  No save-shape change, so no version bump. The render wiring itself is not
  unit-tested, which is this repo's convention rather than an omission: there
  is no DOM environment because renderers are meant to hold no logic.

- **2026-08-20 — Winter work: the premise was wrong twice, and the thing it
  was wrong about turns out to be the biggest lever in the game** — audit
  item 7, which asked for "winter work that isn't food and wood". Nothing was
  built. What shipped is a knob, a measurement and the first bar that has
  ever touched the most consequential thing the bot does.
  **Wrong the first time: "`ASSIGN` is issued once a saga."** It is not.
  `run()` sets a crew on settling day AND re-crews every day the winter mark
  says the band is short of wood or food. The bot has been doing winter work
  since the mark existed.
  **Wrong the second time: "nobody accounts for the season."** Winter forage
  is 0.15, so `seasonFactor` pays a farmer 0.15 of a day against a fisher at
  0.575, and that looked like a lever lying in the open. Measured: a band
  that re-crews its food-hands on every turn of the year moves **236 hands
  over 120 sagas and changes the outcome on not one seed**. It is already
  crewed by need, daily, which is strictly better information than a
  calendar.
  **What was actually left is the question nobody had asked.** The daily
  crewing had run unconditionally since the mark existed, so it had never
  been a knob, so no bar in this file had ever measured it. Three arms, same
  120 seeds, As It Lies:

  | | saw spring | |
  | --- | --- | --- |
  | crew set once, never touched | 21/120 | |
  | crewed to the mark, daily | **48/120** | saved 30, killed 3 |
  | and re-crewed by season too | 48/120 | saved 0, killed 0 on top |

  **Reading the winter mark and moving hands to what it says is short more
  than doubles survival** — bigger than short commons, which saved 14. It is
  the largest single effect this project has measured, and until today it sat
  below every bar in the file rather than on one.
  **So item 7's premise is false in every direction.** There is winter work,
  it is decisive, and the game already tells the player: the mark panel
  carries Food and Wood as held-against-needed with the gap, which is exactly
  the signal the bot reads. Nothing needed building.
  **It has a bar now.** "Says what winter work is worth" asserts the daily
  crewing saves more than it kills. **Watched fail** by making the crewing
  answer every shortfall with the watch instead of the woodpile: spring falls
  21 → 2 of 120 and it goes red with *"saved 0 and killed 19"*.
  The knob stays in the harness (`crewsToNeed`, `recrews`), because the arm
  that measures a lever has to be able to switch it off — that is the whole
  reason this was invisible for so long.

- **2026-08-20 — The default difficulty was re-argued, kept, and turned into
  a bar** — and two smaller things were found on the way that were worth more
  than the question.
  **The question.** `DEFAULT_HARDSHIP` is A Fair Country, and the reason
  written beside it was "As It Lies gives 28% a first spring, which is not a
  game most people get to see the middle of". The winter lever took As It
  Lies to 45% that same morning, so the default was resting on a figure that
  had moved seventeen points and nobody had re-checked.
  **Measured at sixty sagas a country** (`LANDNAM_LONG_SEEDS=60`, four
  minutes) rather than the twenty the long game defaults to, **and the
  argument survived — but it lives somewhere else now.** The lever fixed the
  first winter and did almost nothing for the second:

  | | avg saga | 2nd winter | mead hall | friend | jarl |
  | --- | --- | --- | --- | --- | --- |
  | A Fair Country | 220 days | 27/60 | 36/60 | 33/60 | 17/60 |
  | As It Lies | 119 days | **9/60** | 17/60 | 12/60 | 5/60 |
  | A Hard Country | 74 days | 2/60 | 3/60 | 5/60 | 2/60 |

  On the balanced terms one band in seven reaches a second winter and one in
  five ever makes a friend on that coast — so the hall, the Thing and the
  jarldom are content a default player would essentially never see. The
  default stays where it is, for a reason that is now about the back half of
  the game rather than the first winter.
  **And it is a bar rather than a paragraph.** "The country a player gets
  without choosing" asserts that `DEFAULT_HARDSHIP` reaches a second winter
  in at least a quarter of sagas. A quarter is picked off the spread — half
  of what fair delivers, nearly double what even does — with room on both
  sides for the twenty-seed sample it normally runs at. **Watched fail** by
  pointing the default at `even`: *"the default country is even, where only
  10% of sagas reach a second winter."* The next time these figures move,
  something goes red instead of a comment going quietly stale, which is
  precisely what had happened here.
  **Found on the way #1 — the jarldom odds shipped that morning were read off
  too thin a sample.** They came from twenty seeds; sixty says A Fair Country
  is 17/60 rather than 7/20. Restated to 28% / 8% / 3%, and the menu now
  reads "Six in twenty ruled" for fair and tells As It Lies and A Hard
  Country apart, which twenty seeds could not. The old ±10 bar passed the
  thin numbers, so nothing would have caught this — the lesson is that a bar
  wide enough to survive a small sample is not permission to quote one.
  **Found on the way #2 — the blurbs never mentioned that the country reaches
  into the fighting.** `steel` shipped 2026-08-13 for one stated reason: a
  player who reaches for the gentlest setting because the fighting is going
  badly should get help with the fighting. The blurbs list the other knobs
  almost exhaustively — strangers on the road, the bite of the winter, the
  hold off the knarr — and silently omitted the only one that answers "will
  this make fights easier?". A Fair Country now says *"your blows fall a
  little truer than theirs"* and A Hard Country *"every one of them a shade
  harder to put down"*. The odds were made honest a day earlier; this is the
  mechanism being made honest too.

- **2026-08-20 — The bot pulls the lever, and the menu says the odds of the
  game people actually play** — a one-line change to `SETTLER` and a
  restatement of every number on the difficulty screen.
  **The premise.** Short commons shipped the day before and the harness bot
  never touched it. That is a defensible control for measuring the lever
  itself, and an indefensible basis for a menu: the button is on the steading
  panel, lit the moment the winter mark says the stores are short, and a
  player who reads the panel presses it. `SETTLER` is the bot that stands for
  "what an average competent player does", so every published figure was the
  game as played by a band that ignores its own winter mark.
  **`SETTLER.tightensBelt = true`.** The short-commons measurement keeps its
  beltless control as a separate policy — and the instrument bar caught the
  omission before a human did, failing with *"the control went onto short
  commons too: expected 6468 to be +0"*. That bar exists because this file
  has shipped two hollow ones before.
  **Measured, and the whole menu moved:**

  | setting | reached the first winter | saw spring | long game (20 sagas) |
  | --- | --- | --- | --- |
  | A Fair Country | 88% | **73%** | 223 days a saga, 11 mead halls, 7 jarls |
  | As It Lies | 82% | **45%** | 118 days, 8 mead halls, 1 jarl |
  | A Hard Country | 82% | **10%** | 79 days, 1 mead hall, 1 jarl |

  Against 87/80/73 and 62/27/12 beltless, and against a menu that was
  promising 60/28/12. Spring gaps of 28 and 35 points, both past the ±10 this
  harness resolves, so the three names still mean three different things.
  **Two claims were withdrawn rather than restated.** The winter mark is no
  longer ordered — As It Lies and A Hard Country both read 82% — and that is
  written down as the honest reading: with the belt in hand the harder
  countries fail at the thaw, not at the frost. And "None of twenty ever
  ruled" is gone from A Hard Country, because one of the twenty did. It now
  reads one in twenty, the same as As It Lies, with a note saying plainly
  that twenty seeds cannot tell those two apart at the far end and claiming a
  difference there would be inventing one.
  **What the same run says about everything else.** The lever itself is
  unchanged where it is measured directly, which is the point of a control:
  120 seeds on As It Lies, 35/120 against 48/120, **saved 14 and killed 1**.
  `readiness()`'s escape hatch is still worthless beside it — saved 1, killed
  2. And the verdict got better as a side effect, because `reachable` walks
  the lean case now: it wrote off 17 bands and 3 of them saw spring, **18%
  wrong against 33% before the lever existed**.
  The prose on the menu is generated from the numbers by `measuredLine`, so
  none of this is hand-typed twice: A Fair Country now reads "Three bands in
  four saw the first spring. Seven in twenty ruled."

- **2026-08-19 — Short commons: the first winter has a lever now** — THE
  WINTER CALL, answered. Three investigations from three directions found the
  same thing: winter is not a phase the player plays. Stores on its first
  morning predict spring **94–98%** of the time, deaths run **flat across all
  four weeks** (9/8/7/6) rather than at some playable moment, 27 of 30 are
  plain starvation, and `readiness()`'s two named ways out were measured at
  **zero bands saved and four killed**. There was nothing on the board to
  reach for.
  **The band can go onto short commons.** A full six eat 3 a day and 2 lean,
  which over a twenty-four day winter is 72 against 48 — and the measured gap
  between bands that saw spring and bands that did not was about 33 of stores
  at the frost. So it can turn a near miss and cannot turn a rout, which is
  the point: a lever that saved everybody would be a lower difficulty with
  extra steps.
  It is paid for in **heart**, the currency that already kills most — 2 a day
  against the +1 a well-kept camp returns, so a net point a day and about 24
  across a winter — and the weakest starts to show it every ten lean days.
  Deliberately cheaper than the 8 involuntary hunger costs: choosing to eat
  less is not the same as having nothing, and pricing them alike would mean
  nobody ever chose it.
  **The mark moves with the belt, and that is the lineage work paying off.**
  `foodPerDay` is the single copy of the mouths formula, read by the night's
  eating, the winter mark and the verdict alike — so a band that tightens is
  told a smaller number by the mark at the same moment it starts eating less.
  Split across two copies, as it was until item 9, the mark would have gone on
  demanding a full winter's food. `reachable` walks the lean case too, so the
  verdict no longer condemns a band that could live on short commons.
  **Measured, paired on the same seeds, which is the only reason it shipped.**
  At 60 seeds it read "saved 3, killed 1" — four discordant pairs, noise, and
  a bar built on it would have flipped on the dice. At **240 seeds: saved 32,
  killed 3, and spring goes 64/240 to 93/240.** The committed bar runs 120
  (saved 14, killed 1) with an explicit timeout, and the sample size is
  written down as measured rather than picked. Watched fail by setting
  `RATION_SHARE` to 1 — a lever that costs heart and saves no food reads
  "saved 0, killed 2" and goes red on the first assertion.
  Save v35 with a migration; absent means full shares, and a test proves
  absent still EATS like full shares rather than comparing the number to
  itself, which is what the first cut of that bar did.

- **2026-08-19 — The coast has plenty to fall on, and a lore that promised
  nothing** — audit idea 4. The framing was "give the band a reason to be
  afloat beside a place; the gap is proximity". **Tested first, and the
  proximity half is false**: over 40 worlds, 56 of 80 guarded places (70%) can
  be reached from the water and **not one world has none**. The opportunity
  exists everywhere; a bar pins it, because a world with nothing strandable in
  it makes the whole verb unreachable content there and no policy fixes that.
  **A fourth wrong reading, caught before it was built on.** Following the
  thread, `SEA_EFFORT` is 2 and shore costs 1, so I had "the sea is the slow
  road" half-written — until checking what effort does. `daysForMove` is
  `ceil(effort / 2)` with a floor of one, so **sea and shore both cost one day
  a hex**. The sea is not slower. That would have been the fourth
  interpretation of this audit to dissolve, and the first I nearly acted on.
  **The same arithmetic turned up a real defect.** "Shipwright's eye" carried
  `sea: 1` and the gain line *"A day on the water costs less than it did"*.
  Measured across every hull condition and both travel penalties: a point off
  an even effort buys **nothing**, and a sound hull in fair weather is effort
  2 — one day, which is already the floor. It bought a day only when a
  penalty made the effort odd, which in practice means winter. A promise in
  player-facing text that the numbers cannot keep, in three seasons out of
  four.
  So the lore mends now — **two strakes in a night instead of one, and two
  strakes' worth of timber** — which is what a shipwright does and what item
  7's strakes gave it to do. `sea: 1` is kept, because a day saved in winter
  is a day saved, and both halves are named in the gain line. Watched fail by
  zeroing the bonus.
  The strandhögg itself was NOT retuned. Its opportunity is real, and when a
  band is beside a target it strikes about one time in five; what it is short
  of is days afloat, and that is a bigger question than this item.

- **2026-08-19 — Neither dead need was dead, and the checklist keeps all six**
  — audit idea 3, and **the premise was mine and it was wrong**. It was
  written as "make `peace` and `gathered` bite, or cut the checklist to four",
  on the reading that both were met by 76 settled sagas out of 76 and so
  refused nobody. Item 6 said the same thing first, from the same readout.
  **It was the instrument, twice.** "Ever ticked" is nearly free for a
  MOMENTARY need — `gathered` asks only that nobody is away right now — so of
  course every band satisfies it at some point. Measured on days a settled
  band actually had each need unmet, out of 29,220: **winters 19947, friends
  18894, feast 16981, hall 15223, gathered 2637, peace 143.** Rare is not
  vestigial, and a requirement standing for a rare event is allowed to be
  rare. **No need was cut and no rule changed.**
  **What the right question turned up instead.** Counting which need is the
  LAST one standing — the only one missing on a day when everything else is
  there — the checklist has a dominant gate nobody knew about: **feast 3066
  days, against friends 615, winters 455, hall 206, gathered 109, peace 0.**
  Five times the next. The commonest thing between a band and its Thing is
  thirty spare food on the day, and it is on the checklist, so the player is
  told — but nothing had ever said it was the wall.
  **The guard item 6 wanted and could not state** is in now: every need must
  be unmet on at least one settled day across the long game, or it is a line
  of text pretending to be a rule. Watched fail by making `houseAtPeace`
  always true, which names it — *"the Thing's `peace` was never once unmet
  across 29220 settled days"*.
  Third interpretation of mine this audit that dissolved on measurement,
  after the speaker wall and both halves of the difficulty menu. The
  measurements have held; the stories I told about them have not.

- **2026-08-19 — The difficulty menu says what it measured, and now it has to
  be true** — audit idea 5, and **the premise was wrong twice over**, which is
  worth recording because both errors were mine.
  It was written as "the difficulty picker is the one place this game does not
  tell the player the number, and As It Lies is the default at 28% spring".
  Neither holds. Every setting has carried a `measured` line since the
  hardship work — *"Three bands in ten saw the first spring. One in twenty
  ruled."* — and `DEFAULT_HARDSHIP` is **`fair`**, not `even`. I had read
  `BALANCED_HARDSHIP = 'even'` and assumed it was what a new player gets; the
  file separates the two deliberately and its comment says the default is Fair
  so "the hard truth is one menu tap away rather than the price of admission".
  Checked against today's audit, all three claims were still accurate: 60% /
  28% / 12% measured against three-in-five, three-in-ten, one-in-eight.
  **The real gap was that nothing kept them true.** The only bar on the
  player-facing promise was
  `expect(terms.measured.length).toBeGreaterThan(10)` — an assertion that a
  claim EXISTS, not that it is correct. The menu could have promised anything
  over ten characters long and the suite would have passed, while balance
  moved five times in a single day's work. The comment beside the numbers had
  already rotted a little on its own: "Latest: 62% / 27% / 12%" against
  today's 60 / 28 / 12.
  So the claim is numbers now — `odds: { spring, ruled }` — and the sentence
  the player reads is **generated** from them by `measuredLine`, so prose and
  data cannot drift apart. The generated text is byte-identical to the three
  hand-written strings it replaced: the player sees exactly what they saw.
  The harness bars both halves where each can actually be seen: the hardship
  sweep checks `spring` against the sixty seeds it has just run, and the long
  game checks `ruled` against its jarldom counts, since a sweep to day 73
  cannot see a jarldom. Watched fail first — a claim of 75% against a measured
  28% is named in the failure: *"As It Lies promises 75% see spring; the
  harness measured 28%."*
  This is the one screen where the game tells a player what it will do to them
  before they agree to it, and it was the screen with the weakest bar in the
  repo.

- **2026-08-19 — The port was building against numbers that no longer
  existed, and the speaker wall was never a wall** — an audit and the two
  things it turned up.
  **The port had silently diverged.** Comparing the two repos file by file:
  `Content/Data/parity.json` five regenerations behind, both recorded runs
  re-recorded twice since the last copy, and two of three generated tables
  stale. Every one had come out of a green `npm run parity` here and then not
  been carried across, because carrying it across was a thing a person
  remembered to do and nothing failed when they did not.
  `npm run port:sync` copies the seven files this repo owns into
  `../landnam-ue` and stamps `port/contract.json` with their hashes;
  `test/contract.test.ts` goes red the moment they no longer hash to that.
  Watched fail first — no manifest, then again on a single changed byte of
  `runs/example.json`, which it named. `Content/Data/foes.json` is still stale
  (four archetypes against eight) and is deliberately NOT in the contract,
  because nothing here generates it: it is maintained on the port side, and
  listing it would claim a sync this script does not perform.
  The port has the new contract now and that does **not** make it green — it
  carries a seventh facet, `ship`, that nothing there implements, and
  `SaveVersion` 34. Said plainly in the hand-over commit rather than implied.
  **The speaker wall was the wrong target, and the measurement says so.** The
  audit read median peak standing 10.7 against the 25 a speaker needs, 22 of
  76 settled sagas crossing it — a number that had not moved since 2026-08-10
  and that gates the whole endgame, since every band that can call the Thing
  wins it. Two suspects: the threshold, and `REP_DRIFT` bleeding goodwill at
  0.12 a day. Switching the positive drift off entirely moved the median to
  **15.0** and speakers from 22 to 25 — real, and nowhere near enough.
  Split by fate instead, and it is not close: **17 bands that stood a second
  winter peaked at 60.7 standing and 15 of them spoke; the 59 that did not
  peaked at 10.7 and 7 spoke.** A band that lives reaches more than twice the
  bar. Standing comes almost entirely from trading at +9 a bargain, and a band
  cannot trade until it has stood a winter — so the coast is silent because
  the band is dead, not because the number is high. `SPEAKER_STANDING` is
  well-calibrated and was never the problem; the endgame is gated on the first
  winter, which is the same finding items 5 and 6 landed on from two other
  directions. The split is a permanent readout now so it cannot be
  mis-attributed again.

- **2026-08-19 — A shared coast, and still no server** — Item 10, and the
  premise held: challenge codes carried seed, hardship, mark and world hash,
  and nothing of the band that cut them. A code now carries a **ghost** —
  where a fallen steading stood, what it was called, and what finished it —
  and the receiving world stands it up as a ruin to find.
  **Zero network, still.** No server, no account, no request: a line of text
  somebody pastes into a chat. `LN1 raven-skerry-317 fair d128 w2
  g3,-2,Eikstead,128,starved #a1b2c3d4`.
  **One token, comma-separated inside it**, because the format's whole
  reason for not being base64 is that it survives being retyped with a thumb,
  and a second space-separated field is one more thing to lose. A steading
  called "Two Rivers" packs the way a seed does; the name is NOT lowered,
  because a name is a name.
  **A mangled ghost costs the ruin and never the coast.** Five ways a string
  gets chewed on its way through a chat app are tested by name, and every one
  of them still lands the player on the right seed and the right terms with
  no ghost.
  **Worldgen never grows its own.** `PlaceKindDef.seeded: false` — a kind that
  only exists when something deliberately places it. Skipped before any
  candidate is gathered, so worldgen draws exactly the numbers it drew before
  the ruin existed and the `world` parity vectors do not move — **verified
  rather than asserted**: across the regenerated `port/parity.json` exactly
  zero `world` facets changed, and only `run` moved, because `SAVE_VERSION`
  sits inside it. A test pins
  that the ruin is the only unseeded kind AND that every other kind is still
  seeded, so the flag cannot quietly spread.
  **It never fails loudly.** A ghost naming ground this world put under the
  sea settles for the nearest hex that will hold it, never the landing beach,
  and if there is none it simply is not there.
  **A haunted coast is not an easier coast**, which is the property that keeps
  a challenge worth what it claims — a windfall would make the code worth more
  than the seed it was cut from and every shared run softer than the one being
  bragged about. The ruin pays **2 food and 8 firewood**, under the wreck's
  2/9: mostly timber, because what survives an abandoned steading is the
  woodpile and not the larder — the larder is what ran out.
  **My own bar was mis-specified and my own numbers were wrong.** The first
  cut paid 3/12, which out-paid the wreck, and the bar demanded the ruin be
  the poorest thing on the coast — unsatisfiable, because the oreseam pays
  nothing in goods at all, it pays in lore. Comparing goods totals across
  kinds that trade in different currencies is not a comparison. The bar names
  the wreck now and says why.
  A ghost is only ever offered from a saga that **ended**: a run still being
  played has a steading, not a ruin, and sending one claims a death that has
  not happened — the same reason `coastOf` carries no mark.
  Save v34 with a migration; absence is exactly true of every older saga.

- **2026-08-19 — Born on this coast, and everybody a year older** — Item 9,
  and **the item as written cannot be built**. It asked for "children born in
  the steading who grow into the band". `GENERATION` is 16 years,
  `LONG_LIFE_WINTERS` is 5, and until now nobody aged at all — a child born on
  day 100 is four when the saga closes. The second half of the premise,
  "give a death consequences beyond subtraction", was already built: `kin.ts`
  binds brothers and parents, `mourn` fires, and despair is the top cause of
  death in every reading there has ever been. So the honest half shipped and
  the impossible half did not, and `test/lineage.test.ts` pins
  `LONG_LIFE_WINTERS < GENERATION` so a later change cannot quietly start
  promising a grown second generation.
  **Everybody ages**, once a year, on the turn of the year. `age` was stored
  and printed at a death and never once moved.
  **Children are born** into a settled steading, and they are NOT `Person`s —
  that is the load-bearing decision. A Person is counted by `living`, handed a
  job, put in the shield wall and offered the chance to walk out, so a child
  modelled as one is a baby in the line. They are a record on the ground they
  were born on: a mouth, a name, and a line for the saga.
  A birth is **earned**, through a blocker that names what is missing —
  no steading, nobody bearing, a larder under 40, no room, an open feud, or
  too soon after the last. **A child eats**, at a quarter ration, and that is
  the bar item 6 earned: the Thing's checklist was caught carrying two needs
  met by 78 settled sagas out of 78, and a birth the larder never felt would
  be the same mistake with a cradle in it. Verified by making children
  weightless and watching the bar go red.
  **The mouths formula now has exactly one copy.** `winter.ts` carried its own,
  twice, computed off the projected crew — harmless while every mouth was an
  adult and silently wrong the moment children ate. Same drift the weather
  work had to fix between the mark and the fire; a test fails if `winter.ts`
  starts computing mouths itself again.
  **A death that leaves a child** costs the steading heart for who is left
  behind, in `mourn` — the single funnel all six death paths already run
  through.
  **Two bugs of my own, caught and fixed.** The birth line said "named her"
  for a son and called every child "the first of us". And the determinism test
  called `maybeBirth` once on two clones and compared: at 2% a day both were
  `undefined`, so it asserted undefined === undefined and would have passed
  with births switched off entirely. It walks days until one fires now, which
  also proves the mechanism is reachable.
  One existing bar needed a confound pinned out rather than weakened: the
  winter mark's "shrinks as the winter is walked through" runs a band on 500
  food, which is exactly what makes it eligible to bear, and a new mouth
  raises the mark by more than twenty days of countdown lowers it. The
  cooldown holds all else equal; the assertion is untouched.
  Save v33 with a migration. No new parity facet — children live on the
  settlement, which the `steading` facet already covers. `runs/long.json`
  re-recorded at **1478 actions to day 457, and it SURVIVES**, where the same
  seed was slain at day 390 before this; the birth lift plausibly matters
  where despair is the chief killer.

- **2026-08-19 — Weather, and it is announced the night before** — Item 8.
  The premise held and was stronger than stated: weather was not an invisible
  modifier, it **did not exist**. `effectsOn` returned the same four numbers
  on every day of a season with one per-winter constant on top, so a day in
  summer was exactly like the day before it.
  **No save bump, no migration, no new facet**, because weather is a pure
  function of the seed and the day — the shape `bite()` has used for how hard
  a given winter is. That is the whole design rather than a shortcut: asking
  about TOMORROW costs nothing and changes nothing, which is what makes a
  forecast possible at all.
  Five kinds in `data/weather.ts`, three days in four fair. A **gale** shuts
  the sea; **hard frost** burns more; **thaw** is mud overland and a cheaper
  fire; **sea fog** closes the country in. Every one carries an `omen` — what
  the evening before looked like — and the day tick chronicles it, so nothing
  arrives unannounced. Today's sky and tomorrow's sit in the top bar, as slots
  rather than as a hint, because a warning that elbowed the strandhögg prompt
  aside would cost more than it told.
  **A gale never eats a saga.** The target being ocean is the test, so a band
  already afloat can always row the one hex ashore — the same guarantee the
  unseaworthy hull got in item 7, and `sea.ts`'s rule since the sea work: a
  run ends by decision, not by weather.
  **Three bars had to be rewritten before one of them could fail.** The
  mark-and-fire coupling is the invariant `upkeep.ts` has asked for since the
  winter mark: weather is added to the night's burn AND to `plannedFirewood`,
  two places and one number. The first bar asserted `forecast().firewood > 0`,
  which was meaningless. The second — "the mark must cover what the nights
  will burn" — **also passed with the coupling deliberately broken**, because
  PRUDENCE is 1.15 and a winter's frosts come to less than that margin. Only
  the third, which recomputes the mark weather-included and demands the exact
  number, fails when the link is cut (30 against 32). A bar with slack in it
  cannot pin an invariant.
  **Two things I got wrong and corrected.** The omen repeated itself on
  consecutive rough days, which put a literal stutter in the saga log —
  `travel.test` caught it, and the fix is also better writing: weather is
  announced when it ARRIVES, not re-forecast into a gale already blowing. And
  I read the curve moving 82% → 77% to the first winter as a five-point cost
  and took the gale's overland penalty off to fix it; removing it left the
  figure at 77%, because three sagas in sixty is about one standard error and
  the difference was noise. Spring and two-winters moved the other way by the
  same margin. **Weather does not measurably change the curve.** The land
  penalty stayed off for the design reason — a gale's identity is that the sea
  is shut — and the comment says so rather than claiming a measurement.
  **The reach probe had a real gap, and it was not the game's.**
  `the-seed-came-up` came up "never eligible (unreachable)". It is a CHAIN
  card: it needs `sowed`, which only a settled band with 30 food or less ever
  sets, and which is read a season and a half later — the same bands that
  starve. Probed, the flag fired in **2 of 60 sagas** and neither lived to the
  next autumn, so the chain was completing on luck and one saga's worth of
  drift broke it. `openDays === 0` conflated "walled off" with "the sample
  never finished a two-card chain", so the probe now separates them: a chain
  card whose flag NEVER fires is still unreachable content and still fails —
  verified by pointing the card at a flag nothing sets, which still goes red.
  Costs: `runs/long.json` re-recorded at **1277 actions to day 390**, from
  1385 to day 439. `runs/example.json` is unchanged at 66 actions. Parity
  regenerated.

- **2026-08-19 — The knarr became a thing** — Item 7. She was
  `party.hullHoled`: one bit, two states, mended by a night and two of timber.
  Everything the sea does hung off it — sea fights, cargo over the side,
  salvage, the strandhögg — including `STRAND_HAUL`, whose comment has said
  "the hold takes more than backs can carry" since the sea work while there
  was no hold to take anything.
  **The premise checked out first, unlike items 5 and 6.** 30 raider sagas
  spend **543 days afloat**, so the sea is genuinely reached and a ship that
  is a thing has days to matter on.
  She has a **name** off the run seed (she is named in the landing line now),
  and **three strakes** instead of a boolean. Each sprung strake costs a day
  on the water again — the old flag charged for the first and gave the second
  away free — and shrinks the **hold**: 24 whole, 16, 8. Nothing sound left
  and she will not be rowed at all.
  **Short of sunk, still.** `sea.ts` has said since the sea work that a run
  must end by decision rather than one bad fight on the water, and that holds:
  `isCoastalWater` only ever lets the band float on water touching land, so a
  hull with nothing left can always be rowed the one hex ashore. There is a
  test that says so.
  **The hold bites, which was the whole risk.** Item 6 had just caught the
  Thing's checklist carrying two needs met by 78 settled sagas out of 78, and
  a hold that never capped a load would be the same mistake with a sail on it.
  The first cut had `HOLD_PER_STRAKE = 6`, which left a two-strake hull
  holding twelve — more than three backs carry — so the cap existed and never
  once refused anybody. At **8** she holds 24 / 16 / 8, and one sprung strake
  already bites on a full band of six.
  **It changed no gameplay, by construction.** A sound hull behaves exactly as
  the old flag did and one sprung strake exactly as `hullHoled` did, so
  everything new happens past what the old model could describe. Proved rather
  than asserted: across the regenerated `port/parity.json`, `world`, `band`,
  `coast`, `steading` and `field` are **byte-identical**, and `run` moved only
  because `SAVE_VERSION` sits inside it. Neither recorded run needed
  re-recording.
  `ship` is its own parity facet rather than a field folded into `band` — for
  the port, not for tidiness: `band` serialises `s.party` by identity, so
  making room would have rewritten stage 2's canonical bytes and churned a
  stage that already passes. A port green on the six stays green and owes only
  the new one.
  Save v32, with a migration: a holed old save comes forward with one strake
  sprung — the same speed, the same mend, the same night ashore.

- **2026-08-19 — The middle of a run is not shapeless, it is unreached** —
  Item 6, and the premise did not survive contact. It was written as "the only
  goals are survive five winters and be proclaimed jarl, so the middle has no
  shape". Both halves are wrong: `WINTERS_TO_JARL` is **2**, not five —
  `LONG_LIFE_WINTERS` is the five, and it is where the run ends on its own —
  and the Thing has been a six-item checklist, readable from the first thaw,
  since Phase 4.
  **Measured, 40 sagas per country to day 500.** On A Fair Land: 13 saw a
  second winter, 20 raised a mead hall, 17 made a friend, 8 could ever call
  the Thing, and **8 became jarl**. On As It Lies: 2 could call it, 2 became
  jarl. *Every band that could ever call it won it.* The checklist is not the
  bottleneck; entering the middle at all is. Adding named ambitions now would
  be content for a phase two runs in five never see.
  **The instrument had been watching half the checklist.** The road-to-the-
  Thing counters have tracked winters, hall and friends since 4.3 and never
  peace, feast or gathered — so "the endgame is gated on survival" rested on
  a readout that could not have seen a fourth gate if there were one. All six
  are counted now, pooled over settled sagas, plus which single need a band
  that ticked five of six never got.
  **What that turned up**: over 78 settled sagas — winters 20, hall 32, peace
  **78**, friends 24, feast 59, gathered **78**. Two of the six needs are met
  by every band that ever puts posts in the ground. The checklist reads as
  six requirements and functions as two: standing two winters (20) and
  finding somebody to speak for you (24), which are exactly the two that the
  eleven bands one short of the whole list were missing.
  Diagnosis only, no bar — peace and gathered at 78/78 would fail any honest
  "every need must sometimes bite" bar today, and whether they should bite is
  a difficulty question, not a bug. Test-only change; nothing published.

- **2026-08-19 — The first winter was measured, and the panel was wrong about
  it** — Item 5. The curve has said for months that more than half of every
  band reaching the first winter dies in it, and nothing had ever looked at
  WHERE inside it they die, of what, or whether the answer was settled before
  the frost.
  **Measured, 60 seeds on As It Lies**: 52 reached the frost, 22 saw spring.
  Deaths are flat across the season — 9 / 8 / 7 / 6 by week — so it is a
  slope, not a cliff. 27 of 30 are plain starvation. The bands that lived
  held 37 food and 63 wood on the first morning; the bands that died held 4
  and 13, and **stores at the frost predict spring 94% of the time**. Winter
  is a report card on autumn.
  **Which put the question on the warning, and the warning failed it.** The
  mark's own panel says "We will not reach spring on what this ground gives"
  without hedging. It said so to 26 bands in 60 sagas and **12 of them saw
  spring anyway — 46% wrong**. Two real bugs in `reachable`, both of them the
  same mistake `bestShelter` had already been fixed for:
  `survivesWinter` froze the steading for the whole walk, crediting none of
  the buildings the band was plainly about to raise (the wrongly condemned
  had 1.7 standing and went on to raise 4.5 more), and it read the winter at
  the MARK's middling estimate rather than the mildest the years guarantee —
  a ceiling computed against an average-bad year is not a ceiling.
  `bestSteading` grants the houses the band can PAY for and charges the wood;
  the first cut forgave timber on `bestShelter`'s precedent and `cliff.test`
  caught it at once, handing a whole steading to a band with nought wood.
  Timber is firewood here — the very store the walk spends — so forgiving it
  is a different game, not an optimistic projection. The walk now runs twice,
  building and not building, and takes the better: spending wood on houses in
  a cold autumn is not always right.
  **46% wrong to 33%**, still firing on 21 bands of 60 — narrowed, not
  silenced. The bar in `balance.test` sits at 40%: a ratchet that fails the
  defect and passes the repair, not a claim that 33% is acceptable.
  **Two things were tried and are deliberately NOT in.** A `VERDICT_MARGIN`,
  letting the walk end a couple of days light without speaking — every
  remaining false condemnation reaches spring on 0–4 food, so the idea fits
  the evidence, but any margin at all, down to half a day, flips
  `cliff.test`'s pivot band and a band holding nothing should be told so.
  And taking the max over every producing job instead of naming the hunter,
  which reads truer (**33% to 29%**) and flips the same band from doomed to
  saveable. Both are noted in the code. Whether that band is lost is a
  statement about difficulty, not about this projection, and it is not a call
  to make quietly inside a bug fix.
  **The second finding fell out of the first.** `readiness()` ends a hopeless
  forecast by naming the two ways out — take it from somebody else, or walk
  out and winter elsewhere — and no policy in the harness could do either
  before the first winter, so "winter is decided at the frost" had been
  measured on a bot with no move to make. A `desperate` knob drops the BOT's
  scruples when the mark says spring is out of reach, leaving the GAME's
  rules (`launchBlocker`, somebody left to keep the fire) exactly in place.
  Paired on the same 60 seeds it **saved 0 bands and killed 10** — and after
  the `reachable` fix, killed 6. Much of the harm was the false verdicts
  themselves: the bot was abandoning winnable positions because the panel
  told it they were lost. **The out is still worth nothing — zero bands saved
  in any run — and that is the open design question**, not something to
  retune quietly.
  No save-shape change; the `reachable` vectors in `port/golden.json` belong
  to the hex pathfinder, not to this verdict, so parity and both recorded
  runs are untouched.

- **2026-08-19 — Four kinds of man became eight, and the rule that said they
  could not** — Item 4. Four archetypes carried the whole combat game against
  shield walls, nerve, zone-of-control and five actions — a rich system fed
  by very little.
  **It could not be content until an engine rule was fixed.** `weightFor` in
  `sim/word.ts` was `if (archetype.id === 'huscarl') … if (id === 'raider')`,
  so a new foe could not respond to reputation without an engine edit —
  against this project's oldest rule, quietly, for months. `renown` is a
  field on `FoeArchetype` now and `weightFor` is one line of arithmetic.
  A test walks every file in `src/sim` (comments stripped) and fails if any
  of them names an archetype id.
  The four added are meant to make different FIGHTS: a **Spearman** whose
  three throws are a real volley before contact, **Bondi** levies who are
  cheap and many and make a shield wall worth forming, a **Wolf-coat** who
  has to be dealt with, and an **Outlaw** who hunts whoever is already busy.
  Renown ties them to the coast's memory: levies thin to nothing as your word
  grows (`renown: -2`) while wolf-coats and huscarls come looking.
  **Measured — the curve barely moved and stayed ordered**: 87/83/70 to the
  first winter and 65/30/12 to spring, against 87/78/73 and 62/27/12. The
  levies offset the heavy men, which is what the negative renown is for.
  **The cost was the fixtures, and it was real.** Changing who turns up
  changes the draws in every fight, so both recorded runs had to be
  re-recorded and `port/parity.json` regenerated — `runs/long.json` is 1385
  actions to day 439 now and **ends slain where it used to survive 457
  days**. `test/headless.test.ts` says this outright: "a refusal here means
  the sim now offers different choices than it did when this was recorded —
  which is a real finding about a rules change, not a broken test." The C++
  port's vectors move with it and it must be re-run when it resumes.
  **Two bars were wrong and both were mine.** `word.test.ts` asserted "only
  huscarl and raider scale with word" — the same list of ids the engine
  carried — so it broke on a foe that scales DOWN, which is the rule rather
  than a violation. Restated on the outcome: the expected budget of a man
  drawn at random must never fall as word grows. That proved too blunt to
  catch a levy given strongly positive renown (the heavy men's growth masks
  it), so a sharp rule sits beside it: **a foe may only grow with word if it
  is at least as hard as the average**. And `beats.test.ts` broke one foe of
  one seed and asked him to both rally and run; it samples four seeds now,
  because what is being checked is that both outcomes reach the beat stream.
  977 tests.
- **2026-08-19 — A counter with a calendar** — Items 1–3 of the brainstorm,
  and **two of the three premises were wrong.** They rested on numbers that
  measure the BOT's itinerary, and the game-side rules turned out to be
  sound: a settled player can launch an errand freely (the one real gate,
  the stores block, went last commit), **markets already repeat
  indefinitely** — "traded with as often as you like, until somebody draws
  on them" — and the strandhögg is reachable, its 3-in-120 being a want of
  OPPORTUNITY (five afloat-days beside a target in thirty sagas) rather than
  a gate. The oreseam and the wreck are one-shot on purpose: the seam is a
  LORE source at 80% smithing, and once you understand a thing you
  understand it.
  What was real, and is the honest version of all three: **the economy was
  season-blind.** The whole game is surviving a winter and its only counter
  charged the same in high summer as in deep frost. `GOOD_WORTH` in
  `data/places.ts` gives each good a worth per season and a rate is scaled by
  `worth(given) / worth(taken)` — so carrying the scarce thing is what pays.
  Timber to the monastery in autumn; food to the town in summer. Two markets
  with two calendars, which is the decision that was missing.
  **The spread cannot be broken by waiting**, and that is a property rather
  than a hope: on a round trip the two ratios are exact reciprocals and
  cancel, so a town that buys and sells the same goods still loses on the
  spread in every month. Watched failing on the natural mistake — scaling by
  the given good and forgetting the divisor — with "winter: 10 food came back
  as 14", a free 40% standing on one hex.
  The deed's blurb and `tradeAt` were two copies of the same arithmetic,
  which is how a shown price and a paid price come to differ; both go
  through `offerGot` now.
  **Measured, thirty settler sagas: counter bargains 195 → 261 (+34%)**,
  settled days 4,261 → 4,233 — the market got worth using without moving
  survival.
  And the strandhögg is SURFACED: it was reachable only by opening the Act
  sheet on exactly the right hex of water, so a band could row past a
  monastery and never learn the chance was there. The hint line now says so
  while you are in it. Nothing about the deed itself changed.
  968 tests.
- **2026-08-18 — Can a thumb get to it?** — Mobile item 7, the last of the
  ten, and the audit found something the eye had not.
  Ten surfaces measured at 390×844 — title, travel, the Act sheet, a fight,
  settings, the roster, and the settled work and build screens. **Every
  target clears 44px** and everything in the action bar is at 92–97%, so the
  shell was already thumb-friendly. What was not: **the Act sheet put Camp
  at 25% of the screen — the hard band**, with Forage, Hunt and Fish behind
  it at 33, 40 and 48%. Camping is what a player does most nights of a run,
  and it was the highest control in the game after the mute and the gear.
  The cause was `.overlay { place-items: center }`: right on a desktop,
  wrong in a hand. Cards are bottom-anchored on phone widths now, with
  `align-items: start` plus `margin-top: auto` rather than `align-items:
  end` — when the card is taller than the screen the auto margin resolves to
  nought and its head stays reachable, where `end` would push the overflow
  off the top where no scrolling reaches. Camp went **25% → 38%**, out of the
  hard band; the sheet's foot sits at 93%.
  **The bar is the hard band, not the easy one, and that is a judgement
  worth stating.** The first version demanded every primary control below
  55%; a sheet of five options is 300px tall and its first row cannot sit
  there on an 844px screen however it is anchored, so that bar could only
  ever be met by having fewer menus. What a design can promise is that
  nothing pressed every turn sits where the hand must shuffle.
  Two things the instrument got wrong first, both fixed: it judged "primary"
  by a list of LABELS, which silently exempts any deed added later, so it
  asks the DOM instead (`.action-slot button, button.deed, …`); and it read
  a long build list's scrolled-away rows as though they were on screen, so
  it now walks up for a scrolling ancestor and reports those as behind a
  scroll. `scripts/reach.mjs` (`npm run reach`), watched failing on the
  centred card with the right words — "Camp is a primary control at 25% of
  the screen — the hard band, where the hand has to shuffle".
  The mute and the gear stay at 10% and 16%, and that is deliberate rather
  than missed: pressed once a session, sitting over the map and out of the
  way of everything pressed constantly. They are printed on every run so the
  choice stays visible.
- **2026-08-18 — Two things a phone found that no harness had** — Both
  reported from real play on a real Android, and both were mine.
  **The terrain marks were being sliced by the hex edges.** The patterns from
  the texture pass tiled 120×104 in world space, deliberately NOT a whole
  number of hexes so the same three trees would not be stamped on every
  forest. That reasoning was about repetition and ignored what a pattern fill
  IS: the hex polygon clips it. A tree straddling an edge was cut in half; a
  mountain, reach 20 against an inradius of 22.5, was cut apart on nearly
  every hex it landed on. "The mountains and trees and hills are in the hexes
  weird" is exactly right.
  The tile is the hex lattice now — two columns by four rows, the smallest
  that closes, giving **eight hex centres** each with its own marks. So the
  variety the old tile was reaching for survives, without the slicing. Marks
  are laid around their hex's centre on a sunflower (golden angle, radius by
  root of index) rather than a grid: a handful on a ring reads as a ring, and
  a handful at random clumps. Every recipe's `spread + reach` is now held
  under the inradius **by a test**, so nothing can be cut by construction
  rather than by luck. Watched failing — "mountains reaches 30 against an
  inradius of 22.5". Valley was reworked too: three long furrows had to sit
  dead centre to fit and read as worms, so they are shorter and there are
  four.
  **A settled steading with an empty store was a trap.** Day 52, winter,
  three hands, food 0, the panel reading "we will not reach spring on what
  this ground gives" — and no legal action could change it. A settled band
  cannot forage or hunt (`canGather` is false at home), so leaving is the
  only way to get food, and `launchBlocker` refused the launch for want of
  the food they were leaving to find. The gate is gone; `launch` now carries
  whatever the store can spare. The cost did not disappear, it became
  proportional — a rich steading pays the full price, a starving one sends
  its people out with nothing, which is a decision with a consequence rather
  than a locked door. `carried` only ever mattered on the way home (leftovers
  go back in the store), so an empty-handed party is safe: it can forage the
  moment it is off its own ground. Three tests, watched failing against the
  old gate.
  959 tests. All four browser checks still green.
- **2026-08-18 — The battlefield was not the problem; the thumb was** —
  Mobile item 8, and **the premise was wrong.** It was pitched as "the
  battlefield gets squeezed to a strip as the fight goes on, the 46vh cap is
  a ceiling rather than a budget". Measured over fourteen turns of a real
  fight at 390×844: the field holds **69% of the screen and falls to 67%**.
  It is `flex: 1 1 auto` and genuinely budgeted, and the 74px cap on the
  fight log does exactly the job its comment claims. No strip.
  **What the measuring did turn up is a 44px rule.** A battle hex is a touch
  target — tap one to move, another to strike — and the field fits the WHOLE
  grid on screen, so hex size falls out of screen size rather than being
  chosen. With height taken out of the question (a 1400px viewport) the
  ceiling is a pure function of WIDTH: 320px → 42px hex, 360 → 47, 390 → 51,
  412 → 54. And the log filling up took 360×640 from 47px to **45px** — one
  line short of breaking a rule held since 5.2, and nothing was watching.
  The fix is one media query. The log's cap was absolute, so it cost a 915px
  phone 8% of its screen and a 640px phone 12% — most where there is least
  to give. Below 700px tall the fight log now caps at 44px instead of 74.
  | | field, 14 turns | hex |
  | --- | --- | --- |
  | 412×915 | 677 → 633 (74→69%) | 54px, untouched |
  | 390×844 | 606 → 562 (72→67%) | 51px, untouched |
  | 360×640 | 402 → **388** (was 358) | 47px held (was 47→45) |
  | 320×568 | 315 → **301** (was 271) | 39px — see below |
  **320px wide cannot be fixed this way and is recorded as such**: 42px is
  the hard ceiling there however much height it is given, because the whole
  grid always fits on screen. Making it pass means letting the field pan and
  zoom — which it deliberately does not, "the battlefield frames itself, so
  no panning, just tap" — or a smaller grid. Both are design calls, so
  `scripts/field.mjs` measures 320 and prints it rather than holding a line
  it cannot reach, and holds 44px at 360 and up.
  **The first bar it shipped with was insensitive and that is worth
  recording.** Asserting only "hex ≥ 44px" passed the pre-fix state, because
  45 ≥ 44 and because at 390 and up the hex is width-bound so no amount of
  log growth can move it at all. The bar that works measures what the log
  actually does: a whole fight may not cost the field more than a tenth of
  what it opened with. Watched failing on the pre-fix CSS with exactly the
  right words — "fourteen turns took the field from 402px to 358px, 11% of
  it, and the log took it".
- **2026-08-18 — A phone held sideways** — Mobile item 6. Landscape was
  never broken the way a layout is usually broken: measured at 844×390
  BEFORE any change, nothing overflowed, nothing was clipped, every button
  was reachable. **The map was 125px tall against 579 in portrait** — the
  panels kept the height they were given for a tall screen and the game
  became a letterbox strip. No assertion about overflow would ever have
  caught that, so the bar is about proportion.
  Landscape is two columns now: a grid places the map in one and the
  reading matter — ground report, action bar, saga — in a narrow aside
  beside it. All three modes mount into `.map-slot`, so travel, the field
  and the colony all get it from one rule. It also fixed something the
  strip made ugly on its own: the site panel's labels sat at the far left
  and its values seven hundred pixels away at the far right.
  | | before | after |
  | --- | --- | --- |
  | 844×390 | 125px (32%) | **342px (88%)** |
  | 740×360 | 95px (26%) | **312px (87%)** |
  | 667×375 | 110px (29%) | **327px (87%)** |
  | portrait 390×844 | 579px | 579px, untouched |
  `max-height: 560px` rather than `min-width` is what picks a phone out: a
  tablet or a desktop window in landscape has no height problem and keeps
  the single column it reads well in, and small phones (667×375) never
  reach the existing 700px rule at all.
  **The check caught two things a screenshot could not.** My first attempt
  moved the mute and gear left with a rule that came BEFORE their own, so
  `left: 8px` and `right: 8px` both applied and the slot became an
  invisible full-width strip at `z-index: 40`, sitting on the site report
  and swallowing taps across it. And disabling the new rule to watch the
  bar fail turned up a PRE-EXISTING version of the same thing at 740×360,
  where the right-edge glyphs already covered the hint line.
  `scripts/landscape.mjs` (`npm run landscape`) checks proportion, overflow,
  clipping, glyph cover, and that a modal on a 390px screen may scroll
  inside itself but may not strand its own way out. Watched failing on all
  three shapes with the rule switched off.
- **2026-08-18 — The bot can reach a market now, and the coast looks
  different** — Mobile item 9, first half. NOT a change to the game: a fix
  to the instrument that was measuring it.
  `nearestFriendable()` iterated `state.neighbours` and never
  `world.places`, so a `trade` errand could end at a camp and nowhere else,
  and the bot had no branch that dealt at a counter it was standing on. The
  settler carried `trades: true` and launched nine errands over thirty
  sagas without one being able to reach a market. Every market figure in
  this document was therefore measuring the bot's itinerary. `nearestMarket`
  and `nearestCounter` aim the errand at whichever of a friendly camp or a
  known counter is nearer — a place is KNOWN exactly when its hex is on the
  chart, since word of mouth and landmark-sighting both write `world.seen`
  — and the errand now trades when it arrives.
  **Measured A/B, same thirty landings, only the bot changed:**
  | settler | before | after |
  | --- | --- | --- |
  | bargains struck at a counter | 10 | **195** |
  | settled days | 3,709 | **4,261** (+15%) |
  | trade errands launched | 9 | 10 |
  | places emptied | 12 (day 19) | 13 (day 29) |
  | places ever seen | 60 of 120 | 60 of 120 |
  Raider and turtle are byte-identical, which is the control: neither
  trades, so neither should move, and neither did.
  **The headline curve did not move at all** — 87/78/73 to the first winter
  and 62/27/12 to spring, exactly as recorded. The fear written down on
  2026-08-13, that teaching the settler to walk to a market "rewrites every
  figure in this document", was wrong: the trade errand is gated behind
  `wintersStood >= 1`, so it fires past the point those figures measure.
  All 83 balance assertions pass untouched. No bar was moved.
  **What it says about the game, for Evan.** Ten errands produced 195
  deals, so REACH was never what limited the volume — an errand that
  arrives trades plenty. Discovery is not the constraint either: the
  settler knew of an open counter on 2,310 of 4,261 settled days. The
  constraint is how rarely an errand launches at all — ten times in thirty
  sagas, behind `!hasSpeakers`, a winter, and a food surplus. The market is
  not under-discovered, it is **under-visited**. Whether that gate should
  open is a design call and is deliberately not made here.
  One caveat on the 195: it is the bot dealing repeatedly while parked at a
  counter, about twenty deals an errand. A person might not grind that, so
  read it as the ceiling reach buys rather than as a forecast.
- **2026-08-18 — A game you can feel in the hand** — Mobile item 5. There
  was no `navigator.vibrate` anywhere in the tree. `src/haptics.ts` reads
  the SAME `CueId[]` the sound does — `cuesFor` already diffs two states —
  so a blow that makes a noise and a blow that makes a buzz can never
  disagree about whether it landed, and no second way of noticing things
  had to be written.
  The design is all restraint. **One buzz per dispatch, heaviest wins**, so
  a turn that kills a man and raises a shield is a death rather than a mush
  of both — the same rule as the bell tolling once. **The common cues are
  silent**: `step`, `oar`, `miss`, `gather`, `camp` reach the hand never,
  because a phone that buzzes on every footstep is a phone being put down.
  **Still means still** — the game's own motion setting and
  `prefers-reduced-motion` both stop it, since a buzz is motion whatever it
  is that moves. `keptStill()` in `motion.ts` now states in TypeScript what
  the stylesheet already said in CSS.
  Measured over `runs/long.json`: **115 buzzes across 1320 dispatches, 8.7%
  of turns.**
  **IT DOES NOTHING ON AN IPHONE.** `navigator.vibrate` has never shipped in
  Safari on iOS and no substitute is open to a web page. This is an Android
  improvement, and the Rumble settings row hides itself where the browser
  cannot vibrate rather than offering a switch wired to nothing.
  22 tests, mostly about what does NOT happen. The 200ms ceiling caught its
  own author on the first run (`jarl` was 238). Watched failing on a
  buzzing `step` and on a dropped stillness gate — **and the first version
  of the walking test was too weak to catch either**: it used CAMP, which
  makes no `step`, and `runs/long.json` walks eight hexes in four hundred
  days, so the run-wide percentage barely moved. Rewritten to walk the real
  fog, it fails with "8 of 8 plain steps reached the hand".
- **2026-08-18 — A pinch that holds what is between your fingers** — Mobile
  items 3 and 4, together because both are the map answering a finger.
  **Item 4:** `pinchStart` scaled `camera.zoom` and left `camera.x/y` alone,
  which scales about the middle of the SCREEN. Pinch anything not already
  centred and it walked away from you and you chased it — the sort of thing
  that reads as cheap without ever being reported as a bug. The camera maths
  is pure, so it left the renderer: `src/render/camera.ts` holds `worldAt`
  and `anchored`, and the rule is one line — **zooming keeps a point still**.
  The same call does the two-finger pan, because holding the world point
  under a MOVED midpoint is the same operation; the wheel is anchored at the
  cursor for the same reason; and `release`'s hand-rolled screen-to-world
  copy is now the shared one.
  `test/camera.test.ts` takes it across four corners, three interior points,
  sixty small steps (drift of a pixel per event is invisible in a one-step
  test and obvious in the hand) and both clamps — clamping is where anchored
  zoom usually breaks, because the camera gets moved for the zoom that was
  ASKED for rather than the one used. Watched failing: nine of fifteen, and
  **the six that still passed included dead centre**, which is the one place
  the broken version was right and the only place a hand test would land.
  `scripts/pinch.mjs` (`npm run pinch`) dispatches two real pointers at the
  built page and reads the answer off the viewBox, because the unit tests
  cannot see whether the renderer feeds them the midpoint or one finger, or
  client coordinates instead of element offsets. Measured slip against a
  26-unit hex: **0.039 units pinching out, 0.149 pinching in.** Watched
  failing at 4,479 units with the zoom division dropped.
  **Item 3:** all seven `vh` ceilings are `dvh` now, written twice so an old
  browser keeps the ceiling rather than losing it. `vh` is defined against
  the viewport with the URL bar HIDDEN, so every cap was taller than the
  screen by exactly that bar — the same overflow a photograph once reported,
  still there and smaller. **Not observed working**: headless Chrome has no
  URL bar, so this harness cannot reproduce what it fixes. Checked instead
  that all seven rules survive minification with the fallback, that the
  browser accepts the unit, and that nothing overflows. A real phone is the
  only thing that can confirm the rest.
- **2026-08-17 — A repaint that costs what changed** — Mobile item 2. Every
  action repaints the map, and `paint()` cleared the terrain layer and built
  a fresh polygon for every hex the band had ever seen. Terrain never
  changes: `sim/worldgen.ts` writes it and nothing else touches it, so the
  only things that can move are which hexes are charted and which are lit,
  and both come off `world.seen`. `src/render/repaint.ts` works out which
  hexes need a node, which need two attributes, and which should go;
  `chartCountry` puts the answer in the document.
  **Measured over runs/long.json: 102,612 polygons built before, 78 after.**
  The old cost grew with the run — a chart that gets bigger, redrawn a
  number of times that also gets bigger — and the new one is the size of the
  country, once.
  **The pitch had a made-up number in it and the measurement corrected it**:
  "most of 1,872 hexes" was wrong, because both scripted runs settle on day
  11 and their charts stay at 78. The fix was still right; the claim was not
  measured when it was made.
  Two bars, because the pure half cannot see a document and the browser half
  cannot see the logic. `test/repaint.test.ts` pins the decision and was
  watched failing on a dropped relight and on a size-instead-of-match
  shortcut that would leave an old island on screen. `scripts/repaint.mjs`
  (`npm run repaint`, Playwright optional, exits 2 when absent — same trade
  as `offline.mjs`) loads a real save into the BUILT page, walks the band,
  and fails if the chart loses country, draws a hex twice, stops dimming, or
  grows on a repaint that charted nothing; watched failing with the layer
  clearing restored. Proved equal to the old renderer by moving one save
  between both builds: same DOM, and **pixel-identical screenshots** across
  a landing, a twelve-step walk, and a map with 27 rivers charted lit and dim.
- **2026-08-17 — Ground you can tell apart without reading the colour** —
  Every hex was one flat polygon: a `fill`, a darker `edge`, and nothing
  else. Three terrains — mountains, forest, hills — got a little group of
  paths appended on top, and the other five got nothing at all. So **colour
  was the only channel separating meadow from bog from valley**, and colour
  is the first channel a phone screen in daylight gives up.

  Eight `<pattern>` tiles now, in `src/render/terrainArt.ts`: chop on the
  sea, stipple and shingle on the shore, tufts on meadow, conifers in
  forest, lit mounds on hills, two-faced peaks with snow on the mountains,
  black pools in the bog, furrows down the valley. Bright and dim variants
  of each, stamped from the SAME marks — country the band has walked away
  from is recognisably the ground it was, the light goes out of it and the
  trees do not move.

  **It cost fewer nodes than it replaced.** A pattern lives in `<defs>`, is
  rasterised once, and is referenced by a fill string; the per-hex glyph
  groups it replaced were rebuilt on every repaint, for every seen hex, and
  `paint()` rebuilds all of them on every action. Three textured terrains
  became eight and the per-hex cost went to zero. The built page grew 2.7 kB.

  Two things were got right by looking rather than by reasoning. The tile is
  120 x 104 against a hex 45 across on rows 39 apart — deliberately NOT a
  whole number of hexes, so the pattern lands somewhere different on every
  one instead of stamping the same three trees on every forest. And the
  first pass was too timid: hills, meadow, valley and bog still read as flat
  fields, and mountains as grey speckle. Rendered, looked at, pushed, looked
  at again — three rounds before the eight were distinguishable by SHAPE.

  `test/terrainArt.test.ts` pins the half that could fail silently: the
  colour maths, the scatter, and the wrap across a tile edge. A mark that
  hangs off the right edge has to be drawn again on the left or a seam is
  ruled straight across the country every 120 units — invisible to the type
  checker and to every other test here. Watched failing on a dropped wrap
  and a dropped hex pad before being trusted.

- **2026-08-14 — The island meets the rules** — The two lines of Unreal work
  had never met: the island worldgen and `LandnamNoise` on one branch, the
  rules port on the other, both forked from `master`, neither containing the
  other. Merged.

  **One conflict, and it was the one worth having.** `golden.json` had grown
  a `worldgen` section — terrain codes, 64 noise samples, 8 whole islands —
  on the UNREAL side only. The repo that owns golden.json had never seen
  them. That is exactly the hole `test/goldenport.test.ts` opens by
  describing: *"a green parity test that cannot see one side of the parity
  is worse than none, because it is reassuring."* Reopened one directory
  over.

  The vectors are TRUE — all 8 worlds and all 64 samples reproduce exactly
  from live TypeScript, once you know the noise probe is built from a bare
  `makeRng(seed).derive(label)` rather than from the worldgen stream. So
  nothing had diverged; they simply were not owned. Now they are, and
  `goldenport.test.ts` recomputes every one. Both new bars were watched
  failing on a nudged hex and a nudged sample before being believed.

  **And there are now two C++ worldgens in one module** — UE-typed and
  Blueprint-facing, plain and used by the port — the same algorithm
  transcribed twice, agreeing today only because both were checked against
  the same eight worlds. `Tools/run-parity.sh` now checks the sim one
  against those worlds hex for hex, in CI, and the editor already checks the
  other. Neither can drift from the vectors without going red, so neither
  can drift from the other in silence. A guard, not a fix — see the
  milestone marker for the adapter that would end it.

- **2026-08-14 — The editor build, and four things only it could find** —
  The port was built and run in an actual Unreal editor for the first time
  in the project's history. **Both automation tests pass.**

  It did not build at first, and none of the four failures were about the
  rules. SHADOWING: Unreal compiles with warnings as errors and MSVC
  C4456/C4459 are among them — two parameters named `WarbandSize`, which is
  a global constant; two locals named `Line` in a scope where `Line` was
  already the shield wall and `Approach->Line` was the log's opening prose;
  two `Heads` in one day. C4883 on the event deck — "function size
  suppresses optimizations" against the initializer for 102 cards, a
  diagnostic about the OPTIMIZER that stopped the editor building at all.
  And **UE 5.8 changed the JSON container**: `FJsonObject::Values` is keyed
  by `UE::FSharedString` now, so `LandnamCanonical.cpp` — stage 0 code that
  nothing had ever compiled — no longer built.

  `-Wshadow` is on in the harness now, alongside the unity-build check, so
  most of that class fails on Linux first.

  Then the tests passed and printed, underneath 308 passing facet checks,
  `[sim.facets] NOT YET PORTED, so not checked: band, coast, field, run,
  steading, world`. That was stage 0's scaffold, still reporting. On the
  first editor build the port ever passed, it also stated the opposite of
  the truth about itself. Deleted — a bar that does that is worse than none.

  Also fixed on the way: the project's `.uasset` files were Git LFS pointers
  on the dev machine, so 33 assets failed to parse. Unrelated to the port,
  and worth writing down because the symptom — `Array length (996524687)
  would overflow` — reads like corruption rather than a missing `git lfs
  pull`.

- **2026-08-14 — Both runs, end to end** — The raid was the last thing
  between the port and the end of the scripts, and `runs/long.json` @852,
  @874 and @875 all matched first try: the authored approach picked by what
  the steading holds, the hands standing in the line beside the sworn, a
  band capped by how famous the hall has become, a leader raised because
  every raid is led — and then the place lost. Two hands carried off, a
  building fired, the watch back to nought.

  Two things behind it did not match first try, and both are the same shape:
  something the port had been REPORTING rather than running, which is the
  bargain the whole of stage 5 was scoped on. A card can raid too, and it
  brings `difficulty + raidDifficulty(state)` — the fight a card draws onto
  a rich hall is not the one it draws onto a shieling. And an empty larder
  wounds the weakest, which was the last line in `passDay` still gated,
  because it can kill and killing needed the mourning and the kin.

  **41 checkpoints green: BOTH SCRIPTED RUNS, END TO END.** 1320 actions,
  457 days, seven fights and a run that ends `survived` on one; 62 actions
  and a band that breaks on day 22 on the other. Replaying the long script
  in full reports `unported=0`, which is the stronger claim: not that the
  checkpoints agree, but that nothing anywhere in 457 days was skipped.

  One duplicate went with it: the verb-name mapping existed twice, once in
  the editor's test and once in the standalone harness, and every rung had
  been adding to both by hand. `ActionKindOf` is in the sim core now. Lore
  became real at the same time — a card, a raid held, and a finished dock
  all teach — which retired another reported gate.

  One half of the champion is ported and NOT verified, and it is worth
  saying so: he is anointed and everything downstream of that draw matches,
  but on this coast nobody is angry enough to have SENT him, so the clan
  never remembers him and `settleChampion` never runs. The recurring-enemy
  code is written against the reference and pinned by nothing.

  **And the sim core did not compile as a UNITY BUILD.** Unreal concatenates
  several .cpp files into one translation unit; anonymous namespaces then
  merge, and every rung of this port was verified by compiling a file at a
  time, which is blind to that. Asked what an editor build would need, the
  honest answer was "it would not have started": `Skipped` defined
  identically in three files, `FromKey` in two, a private `Distance`
  shadowing the real one so every call site in four files went ambiguous,
  `FField` meaning two different things, and a FOURTH private copy of
  `CanonicalString` escaping only two characters — the one the note in
  LandnamCanon.h says was already consolidated. All fixed by having one of
  each, and `Tools/run-parity.sh` compiles the whole core as one translation
  unit now, on every run and in CI. A bar that was failing the entire time
  nobody had written it. The generated tables are `*.gen.h` rather than
  `*.generated.h` with them: that suffix belongs to UnrealHeaderTool, which
  really does run on this module.

  What that leaves is the thing this port has never had. `Landnam.SimParity`
  has still never been run in a real Unreal editor. The sim core is proven
  by g++ and by CI; the UE-typed glue around it is proven by nothing, and
  there is a great deal more of it than there was a week ago. Nothing in
  either repo can close that — what has been done instead is to shrink it,
  so that the canonical form, the facets and the action mapping each have
  exactly one implementation and the editor asserts on the same translation
  units the harness compiles.

- **2026-08-14 — The field, and the last page** — `field` was the one facet
  that had only ever been `{}`. It is not now. `Sim/LandnamBattle.{h,cpp}`
  ports the whole of a fight — the ground rolled from the country, the foes,
  the deployment, initiative, the turn cycle, the foe AI's three
  temperaments, all five things a fighter can do, nerve and the shield wall
  — and it matched at `runs/example.json` @16 on the FIRST RUN, and kept
  matching through thirty-five turns of it. Then the aftermath: who lives,
  who is maimed, what was stripped off the field, and what the living
  learned. Then the run simply ends, on day 22: As It Lies leaves five of six
  alive with no firewood and no heart left, and `end` was the last field of
  the run facet that nothing in the port could write.

  **37 checkpoints green: ALL of `runs/example.json` — the whole 62-action
  script, landing to last page — and `runs/long.json` @0 through @660.**

  Three things are worth keeping from it. **`battle.beats` is hashed and the
  top-level `beats` is not**; they are different streams with the same name,
  and the fight's own is 173 characters of the first checkpoint. **A
  JavaScript `Map` iterates in insertion order and the battle AI leans on
  it** — `reposition` compares scores with a strict `>`, so two hexes that
  score alike are settled by which one the search reached first, and a
  `std::map` would have sorted them and played a different, perfectly
  plausible fight. **The deployment rows take no draw**: 35 hexes of 63 are
  rolled for, and a port that rolled the whole grid would have fielded five
  different men.

  Two things stopped being placeholders on the way past. The run facet's
  `tally` was nine literal noughts — true right up until something could
  count a fight. And `FSimPerson::Injuries` was a COUNT, which was right
  while only the mood target looked at it and wrong the moment a wound
  started subtracting from a swing.

  `runs/long.json` @852 turns out to be a RAID, and the harness names it in
  those words rather than reporting a disagreement about the rules.

- **2026-08-13 — Half the script** — The two blockers the port named at @132
  were the last big ones this side of a fight. `neighboursCallOn` and the
  winter FORECAST both landed first try; then @660 named `maybeJoin` — people
  actually arriving — and `takeIn` opened two more gates behind it,
  `handsLeave` and `stirGrudges`, because a joiner arrives at 45 morale and
  that is what makes either of those possible at all.

  **27 checkpoints green: `runs/long.json` @0 through @660 and
  `runs/example.json` @0 through @13.** 660 actions, 248 days, six facets
  each. It stops at `B_END_TURN`, and the harness says so in those words.

  Three things worth keeping. The winter forecast is the only place a
  hardship term is applied ASYMMETRICALLY — `plannedFirewood` does not
  multiply its non-winter branch by the country's terms and does multiply the
  other two, and tidying that into consistency would forecast a different
  summer. `takeIn` reuses `makePerson` exactly, bond and all, because `bond`
  is a plain parameter that takes no draw — which is the whole reason the
  rung was small. And `nextId` had to become a real field: a headcount plus
  one is true right up until somebody joins and somebody else dies.

- **2026-08-13 — A second country, and vectors nobody was watching** — The
  parity harness runs BOTH scripted runs now. `runs/example.json` is the same
  seed with no terms named, which defaults to As It Lies; until now every
  checkpoint the port had ever met was A Fair Country, so the hardship table
  had never been exercised past a landing. 25 checkpoints across the two.

  It cost one verb — `FORAGE` — and found three things the first run could
  not. The hardship id was never NORMALISED, so a run that names no terms
  carried the right numbers off the right row and wrote down the wrong name.
  On As It Lies the stores are thin enough that **the fire actually goes
  out**, which A Fair Country never reaches in either script. And the harness
  read `SEED HARDSHIP MOVES` off one line, so a null hardship let `read` hand
  it the first MOVE — the port ran on terms called "forage", one action
  short, and two characters in a facet were the only symptom.

  **The committed vectors had drifted and nothing was looking.**
  `Content/Data/golden.json` was missing six `hashString` vectors — every
  non-ASCII case and the emoji, the ones that pin the UTF-16 surrogate
  handling. The editor's `Landnam.Parity` has been passing a contract with
  its hardest cases removed. The harness diffs all four copies against the
  originals now and refuses to run on a stale one; watched failing before
  being trusted.

  And `.github/workflows/parity.yml`: the Unreal repo had no CI at all. A
  check somebody has to remember is a check that eventually nobody runs.

- **2026-08-13 — Stage 5, fourth rung: a settled band works, and a lesson
  about gates** — `CAMP` and the production model. **Sixteen checkpoints
  green — @0 through @55**: fifty-five actions, thirty-two days, a longhouse
  and farm plots standing and a smokehouse on the stocks.

  The production model matched first try. What did not is worth more.

  **A hardcoded gate answer is a time bomb the skip mechanism cannot see.**
  The earlier rungs dismissed subsystems two ways: with a check that
  evaluates the gate and reports if it opens, and — more often — with a
  COMMENT saying the gate was shut. Every comment was true when written.
  Three stopped being true the moment the posts went in, and nothing said so,
  because `Unported` only reports what a check reports. `settled`, `atHome`
  and `built` answered a flat `false`, so the port dealt a walking band's
  deck to a settled one (a different card on day 24). `telegraphWinter` was
  dismissed in a comment and writes hashed flags from day 25. And
  `eventChance` has a settled-at-home branch — defence and a stood watch buy
  quiet, which is what the defence score is FOR — that the port never took.

  All three now read the state, and every remaining dismissal in `passDay` is
  an evaluated check. The raid roll and both joining rolls are TAKEN, off
  ported odds. What that buys shows at @132: it fails by naming its own two
  blockers instead of quietly mismatching.

  One more of the same shape, and nothing would have caught it either:
  `Flags["workedOnce"]` to ASK whether the band had worked would have
  INSERTED a nought. `operator[]` on a std::map is not a query, and the flags
  are hashed, so merely asking would have written down the answer.

- **2026-08-13 — Stage 5, third rung: the posts go in the ground** —
  `Sim/LandnamSteading.{h,cpp}` ports the site reading and the structural half
  of the colony, and matches @11 `FOUND`, @12 `ENTER_COLONY`, @13 `ASSIGN`,
  @19 `QUEUE_BUILD` and @21 `LEAVE_COLONY`.

  Founding turns half the day cycle back on: every subsystem the first rung
  walked past because its gate read `state.settlement` now runs.

  Two things did not match first try and both are worth keeping. **`range()`
  in the port was a `Dq`/`Dr` double loop**, which is the same SET as
  `src/hex/grid.ts` and a different ORDER; invisible since stage 1 because
  the only caller was the fog, which puts its answers in a map. `makePlots`
  iterates it and stores an array, so the order became the value the day the
  posts went in. And **`moodTarget` grows a job term** the moment there is a
  hearth to stand on: on the founding day all six are unassigned and every
  one takes −12. Every facet size was right and one hash was wrong, which is
  the shape of a value error and exactly what `size` sits beside the hash to
  tell you.

  The measured surprise: **six idle hands cost 3.6 morale, more than the +8
  for founding at all.** The day reads 78 → 86 → 82.4 → 83.4. `IDLE_BITE` is
  a named export now rather than an inline `0.6`, because the port generates
  its constants from this repo and a literal typed into C++ is a second place
  to author content. `SOIL` in `src/sim/site.ts` is exported for the same
  reason, and the terrain table now carries `wood`.

  `food` and `firewood` became doubles on both sides of the port. A roof
  saves 0.8 of a night's firewood per point of shelter and a farmer's day
  produces a fraction of a meal — they are numbers in the TypeScript, and
  being whole so far is not the same as being integers.

  (This entry was written for the previous commit and silently dropped by a
  bad anchor in the script that inserted it. Recorded here in its place.)

- **2026-08-13 — Stage 5, second rung: the deck deals, and a size that was
  measuring bytes** — `Sim/LandnamEvents.{h,cpp}` interprets the event deck
  and matches @8 (a MOVE deals a card), @9 (CHOOSE) and @10 (DISMISS_EVENT).
  **The port is green at @0 through @10 now — eight checkpoints, six facets
  each** — and stops where the posts go in at @11.

  The rung's whole difficulty is one thing: `maybeFireEvent` takes TWO draws
  off ONE derived generator, the chance first and the weighted pick second.
  The licence that made rung 1 cheap — no draw site holds a position — does
  not reach inside a single call, and skipping the first draw returns a
  different card that reads as a disagreement about the deck. The pool's
  ORDER is load-bearing for the same reason, so `scripts/event-tables.ts`
  writes all 102 cards in declaration order and `test/tables.test.ts` pins it.

  **The `size` beside every hash was measuring the wrong thing, and had been
  since stage 2.** It exists to separate "different values" from "different
  SHAPE", and both harnesses compared UTF-8 BYTES against a number the
  TypeScript produced in UTF-16 CODE UNITS. Identical on ASCII, and nowhere
  else. It surfaced as a contradiction — the hash matched and the size was
  three too long, on text the hash was computed from — the first time a card
  body with an em dash reached a facet. It was already wrong: the `Þórr-vik`
  seed's `run` facet is 245 units and 247 bytes, so stage 4's size check
  would have failed by two the first time anyone opened the editor, on a
  state it had computed perfectly. `Landnam::CanonicalLength` counts units.

  `test/tables.test.ts` is new and closes a gap nobody would have noticed:
  add a card, forget `npm run event-tables`, and the port goes on dealing
  yesterday's deck. It compiles, it passes its own vectors — because those
  were regenerated from the same live source — and the only symptom is that
  Unreal plays a slightly different game. The test regenerates both headers
  in memory and diffs, and it has been watched failing.

  `Tools/run-parity.sh` caches objects per file now. The deck header is
  ninety kilobytes of nested initialisers and 27 seconds of compiler at -O0
  (86 at -O2, and the harness runs in a tenth of a second either way), so it
  builds at -O0 and rebuilds only what changed. Editing the day cycle is a
  second; only editing a card pays the eight. It is also kept out of
  `LandnamEvents.h` so nothing else has to include it.

- **2026-08-13 — Stage 5, first rung: the C++ can spend a day now** —
  `Sim/LandnamDay.{h,cpp}` ports `apply`, `applyTravel`'s `MOVE` and `passDay`
  for a band with no steading, and matches **every facet at `runs/long.json`
  @1, @2, @3 and @5**. Five checkpoints counting the landing, six facets each,
  and it is the first time the two implementations have agreed about
  something that HAPPENED rather than about a state that was generated.

  The scoping in `port/sim.md` held exactly. `passDay` fans out to twenty
  subsystems and a whole unsettled day moves seven things, so the rung came
  to about two hundred lines rather than the two thousand reading it
  suggests. What was added to make that honest is `FSimState::Unported`:
  **every skipped subsystem is ported as far as its gate and records a reason
  if the gate ever opens** — an unsworn hand, a pair with heat between them,
  a cold night, a card dealt. Both harnesses fail on a non-empty `Unported`
  however well the hashes match, because a green reached by quietly not
  running something is not a green. That turns "the RNG has no position, so
  you may skip what does not move" from a licence into a checked claim.

  **A fourth portability trap, and the reason the method is compile-and-run.**
  `line()` in `src/hex/grid.ts` adds 1e-6 to both axials before rounding —
  one comment, easy to read past — and `round()` in `src/hex/coords.ts` has
  only two branches, so on a tie it leaves both coordinates alone. The C++ was
  a cube-space rewrite with a third branch and no nudge. It passed stage 4,
  because no sight line from a landing hits a tie. The band's first step hits
  one: from 4,15 the line to 6,14 goes through 5,15 in the TypeScript and
  5,14 in the port, and 5,14 blocks sight. One hex of fog, seventeen
  characters, a whole facet red. Reading the two side by side would not have
  found it; diffing the canonical text found it in a minute.

  **`Tools/run-parity.sh` is committed this time.** It compiles the sim core
  with `g++` and checks it against `port/parity.json` with nothing but a
  compiler and node — no Unreal, no editor. It has been throwaway for four
  stages and four traps; it is worth keeping. It parses no JSON: the harness
  prints a reading per checkpoint and the script pulls the expectations, the
  seed and the moves out of this repo, so nothing about the run is retyped on
  the C++ side.

  Content stayed authored in `src/data`. `scripts/party-tables.ts` now also
  restates hardship, the seasons, terrain costs, trait tempers and frictions
  and a dozen constants — and stage 2's three hard-coded `stores` multipliers
  were collapsed onto the generated table, which is where they should always
  have come from. The generator now throws on a value that is not a number,
  because `BASE_EVENT_CHANCE` stopped being exported for ten minutes and the
  literal text `undefined` reached the header: `scripts` is outside the
  tsconfig `include`, so nothing else would have said so.

  One more consolidation: `ULandnamCanonical::Number` now delegates to
  `Landnam::CanonicalNumber` in the sim core. A clock produces fractions and
  the standalone harness has to print them, so the formatter had to leave
  `FString`. The twenty vectors that already pinned it now pin the single
  implementation, so the move is covered rather than trusted.

  Next rung: the event deck, at @8. Five facets already match there and `run`
  does not, with `maybeFireEvent: the road dealt a card` printed beside it —
  which is what a bar naming the thing to go and look at is supposed to do.

- **2026-08-13 — Both ends of the parity contract now exist** — The C++ half
  of item 5. `LandnamCanonical` in `landnam-ue` is the shared canonical form
  and state hash, and it is ported FIRST on purpose: every facet of every
  checkpoint ends up as a string it produced, so a disagreement there would
  be read as a disagreement about the rules for as long as it took to find.

  Its number formatting was **compiled and run against the vectors rather
  than merely written beside them** — 20 of 20, including the two thresholds
  JavaScript switches at (`1e+21` upward, `1.00000000000000e-7` downward),
  `1e+300`, and negative zero as plain `0`. Number formatting is the likeliest
  place two languages disagree about identical values, and now it is settled
  before anything can hide it. The vectors that made that possible are new
  too: a `canonical` section in `port/parity.json` that needs no sim at all.

  `Landnam.SimParity` is the harness, and the shape of it is the point. **It
  has to be honestly green today and meaningfully red the day a ported facet
  disagrees** — a test that stays red for the months a port takes is one
  everybody learns to ignore, and by the time it matters nobody is reading
  it. So it checks the canonical form for real and SKIPS the six sim facets
  by name, saying how many checkpoints are waiting for each. `ReadFacet()` is
  the hook: fill it in for the facet your stage owns and it is checked at
  once against vectors that were already sitting there. Worldgen turns
  `world` green without a single rule ported.

  The port can start. Stage 1 has a bar waiting for it, which is the whole
  thing this was built early to guarantee.

- **2026-08-13 — The sim parity contract, built before the port rather than
  after** — Item 1 chose C++, so item 5 stopped being a nicety. `port/parity.json`
  is the sim's `golden.json`: seven runs, thirteen checkpoints, six facets,
  regenerated by `npm run parity`, guarded by `test/parity.test.ts`, specified
  in `port/sim.md`, and destined for `landnam-ue` at `Content/Data/parity.json`.

  **Facets, because one hash was the wrong instrument.** `stateHash` covers a
  whole GameState in sixteen hex digits and is all-or-nothing: a port with
  worldgen and nothing else can never match it, so it would stay red from the
  first day of the port to the last and say nothing useful on any of them. A
  bar that cannot go green until everything is done is a bar nobody can work
  against. So the state is cut into six independently hashed slices ordered to
  match the port — `world`, `band`, `coast`, `steading`, `field`, `run`.
  Worldgen lands, `world` goes green and stays green, and later drift in
  worldgen is caught the day it happens.

  The facets are a PARTITION rather than an arbitrary set of views, so "all
  facets match" and "the states match" mean the same thing — and the test
  walks a real state's own keys and fails on any field no facet owns, so
  adding to GameState without placing it is caught instead of silently going
  unchecked. **Verified by orphaning a field and watching it fail**, because a
  coverage bar nobody has seen fail is not known to work — which is the lesson
  the beat-stream reach test taught earlier the same day, having been wrong in
  both directions.

  Two things are stored beside every hash and both earn their place. `size`,
  the canonical length, separates "different states" from "different SHAPES"
  — a port missing a field entirely reads nothing like one that computed a
  value wrong, and a hash cannot tell them apart. And plain integer `samples`,
  so a red test says "your day 40 food is 12 and mine is 31" rather than only
  that two hex strings differ. A bare hash is a smoke alarm with no address.

  `saga` and `beats` are excluded on purpose: prose gets reworded, and the
  beat stream is capped, so two implementations that agree about the game can
  legitimately hold different windows of it.

- **2026-08-13 — PHASE 7 ITEM 1 DECIDED: the rules get rewritten in C++** —
  Evan's call, taken on "what makes the best Unreal game" rather than on what
  is cheapest for this repo, and the answer went against the analysis that had
  been sitting under the heading.

  Four arguments decided it, and all four are ones that analysis
  underweighted because it framed the question around bridge cost and the
  balance record. **Consoles and iOS forbid JIT** — embedding JS means an
  interpreter-only build, which slows the SIM rather than merely the bridge,
  and the 0.031 ms bridge figure was measured with a JIT. **The content rule
  maps onto DataTables** — "adding content must never require touching engine
  code" is this project's oldest architectural rule and Unreal's tooling is
  built for exactly it, where an embedded sim leaves all of `src/data/` behind
  a boundary the editor cannot see. **Native tooling** — Insights, Live
  Coding, breakpoints and the profiler are C++ or nothing. **Saves and
  replication** want native USTRUCTs.

  The strongest objection — that the balance record only follows one codebase
  — is answered rather than waved off: the TypeScript does not become a dead
  branch, it becomes the **reference implementation and the balance lab**,
  with parity CI as the thing that stops the two drifting. Content already
  works this way, exported from `src/data/*.ts` into DataTables rather than
  reimplemented, and `Source/LandnamUE/LandnamDataRows.h` had started down
  that road before the decision was taken.

  That promotes item 5 from a nicety to a prerequisite, and it is the next
  piece of work: parity CI first, then the port along the dependency graph —
  `state/types`, `worldgen`, `calendar`/`upkeep`, `travel`, `battle`,
  `colony` — each stage landing with its TypeScript tests as UE automation
  tests and required to match the TS hash on N seeds before the next begins.
  Items 5 through 10 are unblocked.

- **2026-08-13 — The beat stream's last gap, and a coverage bar that could be
  satisfied by something it was not testing** — Phase 7 item 3 read "still
  owed: the travel and colony halves". That was **stale**: `worldBeat`, the
  drain, thirteen kinds and SAVE_VERSION 30 had all shipped. Checking before
  building saved the day's work and left a much narrower real gap.

  `src/sim/places.ts` and `src/sim/expedition.ts` emitted **nothing at all**,
  so a party walking out of the steading and a monastery going up were
  invisible to anything but the prose — and those are exactly the moments a
  renderer has to animate rather than print. Five kinds close it: `wentOut`,
  `cameHome`, `spotted`, `dealt`, `sacked`.

  Pinned by FIXTURES rather than a played sample, which is the battle half's
  own precedent for `rallied` and `fled`. The place economy is the part of the
  game a band reaches least — six sagas in sixty ever stand at a counter — so
  a bot sample would report these as unreachable when the truth is that they
  are rare. `spotted` is the one the wide bot does reach, so it joins the
  played list.

  **And closing it caught a fault in the reach test that had nothing to do
  with the stream.** It looped while `seen.size < KINDS.length`, where `seen`
  collects every kind a run emits and `KINDS` names only the ones under test.
  Adding `spotted` to the sim pushed `seen.size` to thirteen on the second
  seed, ended the sweep three seeds early, and reported `gathered` as never
  emitted. The stream was fine; the counter was measuring the wrong set. It
  counts the intersection now, so a new kind can never again shorten the
  search for the others.

  Worth recording twice over: the failure looked exactly like a regression in
  the code just written, and stashing the change to isolate it is what showed
  the emits were innocent. **A coverage bar that can be satisfied by something
  it is not testing is not a coverage bar** — and this same test is already on
  record in its own comments for being wrong in the opposite direction, having
  once compared a hand-typed 12 against a list of 13.

  No SAVE_VERSION bump: `beats` is an existing optional field and the new
  kinds are variants no old save can contain, so there is nothing to migrate.

- **2026-08-13 — Nobody was ever sent: the last link in the markets chain** —
  The "no door" hypothesis, verified, and the answer is sharper than the
  guess. Three probes today read markets as unreachable content. The last
  link is that **the harness never aims at one.**

  | 30 landings a policy | settled days | ...knowing the way to a counter still trading | trade errands |
  | --- | --- | --- | --- |
  | settler | 3,709 | **1,996 (54%)** | 9, none able to aim at one |
  | raider | 4,458 | 976 | 0 |
  | turtle | 8,563 | 745 | 0 |

  For more than half of every settled day the settler knows where an open
  market is, and never goes. Two separable reasons, and it matters which is
  which:

  **The game is not broken.** `moveOptions` returns nothing for a settled
  band, so an expedition is the only door back onto the map — already an
  audit finding — but the door exists and is generic: the `trade` purpose
  reads "Carry food out and bring timber and goods back", which is exactly
  what a market is for. A human player can launch one and walk to the town.

  **The bot is.** `nearestFriendable()` iterates `state.neighbours` and never
  `world.places`, so a trade errand can only ever be aimed at a camp. The
  settler carries `trades: true`, launches nine errands over thirty sagas,
  and not one of them can end at a counter. That is this repo's oldest rule
  arriving late — a capability the bot cannot use is measured as worthless —
  and it means **today's market figures measure the bot's itinerary, not the
  game's reach**, the re-derived floor included.

  Not fixed in this commit, deliberately. Teaching the settler to walk to a
  known market rewrites every figure in this document, and the settler's
  identity is load-bearing for all of them — `raidReach: 0` is already a
  measured decision that cost five jarldoms when it was loosened. The change
  is a paragraph of bot; the measurement it invalidates is a day of sweeps.
  That is Evan's call, not a tuning pass.

- **2026-08-13 — A landmark seen from a ridge: discovery fixed, and it buys
  less than it should** — The channel the place-economy probe indicated:
  `spotLandmarks` marks a place KNOWN when the band stands on high ground
  within `LANDMARK_SIGHT` (8) of it and the line of sight is clear. High
  ground only, which is the point rather than a limitation — hills and
  mountains already raise sight and already break line of sight, so the climb
  now pays in knowledge instead of two more hexes of grass. Sight only: it
  tells you a place is there and nothing about what is in it.

  What it bought, thirty landings a policy:

  | | places ever seen | first sighting |
  | --- | --- | --- |
  | settler | 53 → **60** of 120 | day 74 → **day 46** |
  | raider | 31 → **50** of 120 | day 65 → 77 |
  | turtle | 13 → **13** | day 11 |

  The town — the thing that gates markets — goes from 21 of 90 sagas to
  **32**. The curve did not move: 87/62, 78/27, 73/12 against 87/65, 80/28,
  73/12, every movement inside the ±10 this harness resolves, and the long
  game is identical (fair 153 days, 11 mead halls, 4 jarls).

  **Three honest costs, recorded because the case for this change named two
  of them as benefits.** It does NOT help the turtle — 13 of 120 either way,
  because a band that settles on day 11 and never leaves never stands on a
  ridge, and "the only channel that helps a band which never trades" was
  wrong. Word of mouth partly SUBSTITUTES rather than adds: places learned
  across a counter fell 32 → 17, so the settler's net gain is seven. And the
  downstream verbs did not move at all — sagas reaching a still-trading
  counter stayed at 6 of 60, market days at 2, strandhöggs 4 → 2 on a sample
  far too small to read.

  So the constraint moved rather than closed. Knowing where a place is turns
  out not to be the same as having a reason to go: the settler only detours
  to one while `mighty && day < plunderWindow`, which is a fortnight of the
  run. That is the next question, and it is about what a band WANTS from a
  place, not about how it hears of one.

- **2026-08-13 — The place economy: discovery is the constraint, and word of
  mouth cannot fix it** — Task 33 was closed with "the four on a coast are
  one-shot: taken early, or never known at all." A probe that follows every
  place from unknown to emptied says the first half is **false**, and the
  correction matters because it points somewhere else entirely.

  Thirty landings a policy, A Fair Country, 4 places a world:

  | | places | ever seen | emptied | known and still standing at the end |
  | --- | --- | --- | --- | --- |
  | settler | 120 | **53 (44%)** | **11** | **42** |
  | raider | 120 | 31 (26%) | 8 | 23 |
  | turtle | 120 | 13 (11%) | 0 | 13 |

  The coast is barely touched — eleven of a hundred and twenty emptied over
  thirty settler sagas, against forty-two left known and standing at the end.
  Places are not consumed. They are never LEARNED, and a place is first seen
  on day 74 on average, well after the band has settled and stopped walking.

  Three things follow. The strandhögg's bottleneck is one number: **4 days
  afloat beside a place out of 4,949**, and the raider converts those 4 of 4
  — the verb was never the problem, being there is. **The town is seen in 21
  of 90 sagas**, which independently explains this morning's markets finding:
  "6 of 60 sagas reach a counter" was never about counters being burned, it
  is that three quarters of bands never learn the town exists. Two probes,
  one root cause. And discovery already runs mostly on word of mouth — 32 of
  the settler's 53 come across a counter via `tellOfPlace`, while the turtle,
  who never trades, sees 13 of 120.

  **So word of mouth was widened, and it does not work.** Telling more than
  one place per bargain is byte-identical to telling one, at every range
  tried — and the mechanism was checked to fire first, so the null is real:
  the candidate set at bargain time is size 0 or 1. Widening the range moves
  places-ever-seen 53 → 59 at sixteen → 61 at twenty, saturating, where
  twenty is wider than the radius places are seeded in. Both knobs are left
  where they were with the measurement written at each, because the finding
  is that **the tap is the number of bargains, not the width of the pipe**,
  and no amount of widening fixes an event that happens once or twice a saga.

  What that indicates, unbuilt: a discovery channel that is not a bargain.
  The sim already models `onHighGround`, `sightRadius` and `hasLineOfSight`,
  so a landmark sighted from a ridge is nearly free, and it is the only
  candidate that helps a band which never trades.

- **2026-08-13 — Hardship reaches combat, and a floor that was measuring
  nothing** — `steel` on `HardshipDef` (+1 fair, 0 even, -1 hard) is in,
  added to our swings and taken off theirs on the strike. The curve is
  properly ordered at both marks for the first time — 87/80/73 to the first
  winter, 65/28/12 to spring — and the winter column could not be ordered at
  all while every country's blows landed alike. The licence for letting a
  difficulty this deep in is that `newGame` defaults to the balanced middle,
  where `steel` is 0, so `test/wall.test.ts` and the whole battle suite are
  played on terms where the knob does not exist; `test/hardship.test.ts`
  asserts that zero now rather than trusting it.

  **The day this cost was spent on the bar, not the change.** It had been
  held off by `markets` falling 14 → 2 in the content-reach probe against a
  floor of 3. The hypothesis on the bench — easier fights, more bands settle,
  a settled band stops walking past the counters — is FALSE: bands settle
  28/30 either way, on day 13.1 either way, and road-days barely move
  (460 → 432).

  What the floor was really measuring is the finding. Six of sixty sagas ever
  stand at a counter, before and after; **reach did not move at all**. Of
  those six, two ever dealt, and twelve of the fourteen market days came from
  a single band that settled beside a live counter and traded over and over.
  A trade day multiplies with however long one band loiters, so a floor of 3
  sat on a statistic with an effective sample of ONE SAGA — it passed by luck
  and failed by luck. (The specific drop is real and is also not about reach:
  a band that wins its fights reaches the trading town with five sworn
  instead of four, trips the harness bot's own `mighty` rule and sacks the
  town on day 16 instead of dealing there twelve times. Steel ends a market.
  That is the bot preferring plunder to a counter.)

  So the floor was **re-derived rather than moved**: a count of SAGAS that
  reach a still-trading counter, same numeral, sample of sixty instead of
  one, and strictly harder to satisfy by luck — three trade days can come
  from one band in an afternoon where three sagas cannot. The reasoning is
  written into `test/balance.test.ts`, and the probe now prints settle-rate,
  days-on-the-road and the per-saga distribution beside every total, so the
  next bar with a sample of one is visible at a glance. **A count of days is
  not a count of reach** — the jarl count's lesson arriving a second time
  through a different door.

  Also in: `carrying()` names the wound dragging a swing on the two lines
  where a blow fails ("Ribs stove in, and the swing showed it"), might only,
  because might is what is in the roll. The game had been taking a point off
  the dice and telling nobody — a fresh band lands 76% of its swings and a
  worn one 59%, while foes are generated whole for every fight and never
  carry a wound. Three `measured:` labels rewritten off the fresh sweep, and
  `runs/long.json` re-recorded: combat changed, so the old script diverged by
  one turn. Still stands 457 days and survives.

- **2026-08-12 — Hardship reaching combat: built, measured, reverted** — The
  work is written up under "OFF THE BENCH" at the head of this document
  (that section was called "ON THE BENCH" on the day this entry was written,
  and was renamed when the change landed on 2026-08-13), in
  enough detail to retype in ten minutes. Short version: `steel` on
  `HardshipDef` (+1 fair, 0 even, -1 hard) added to our swings and taken off
  theirs; the curve ordered beautifully (87/65, 80/28, 73/12 for winter and
  spring); and it dropped `markets` in the content-reach probe from 14 to 2
  against a floor of 3. Verified as caused rather than assumed — a clean
  tree reads 14. Reverted rather than landed red or landed with the bar
  quietly lowered, because the bars are the only reason six real findings
  turned up today.

- **2026-08-12 — "My warriors miss more than the enemy": measured, and half
  of it is true** — A playtest report, and the half that holds is a real
  asymmetry rather than a feeling.

  A **fresh** band out-hits its foes: 76% of swings land against 68%. The
  band is not worse at fighting. A **worn** band inverts it — half health
  and one bad arm apiece, which is an ordinary state a season in — **59%
  against 70%**. The to-hit roll is `2d6 + effectiveStat(might)`, injuries
  come straight off `effectiveStat`, and **foes are generated fresh for
  every fight and never carry a wound**. So the band's fighting strength
  decays across a run and the enemy's cannot.

  That is defensible as attrition and it is worth knowing it is happening,
  because nothing in the game says so and the player feels it as the dice
  turning against them.

  The other half of the report — "on the easiest difficulty" — turns out to
  be the sharper finding: **hardship does not touch combat at all.**
  `HardshipDef` carries `stir`, `raid`, `winter` and `stores`. A Fair
  Country makes fights rarer, the winter shorter and the hold fuller, and
  leaves every blow exactly as hard to land as it is on A Hard Country. A
  player who picks the gentlest setting because fights are going badly gets
  no help with fights.

  Open question, not decided here: should the easiest setting ease combat —
  a to-hit or damage term on `HardshipDef` — or should attrition be visible
  instead, so a wounded band reads as wounded rather than as unlucky? The
  first changes the curve every figure in this document rests on; the second
  changes nothing but what the player is told.

  Instrumented either way: `who lands their blows` now measures both sides'
  hit rates, barred on the fresh case (a band at full strength must not be
  worse at landing a blow than what it meets) and reporting the worn case,
  because how fast a band should decay is the open question.

- **2026-08-12 — The strandhogg works, and the band never gets to use it** —
  Task 33, and the answer is that nothing is broken. Worldgen puts a
  strandhogg-able place in **60 of 60 worlds** (1.4 apiece). The routing
  works: of the places the errand aimed at, **172 of 173** were reachable
  from the water. The bot takes the shot when it has one — twice in the four
  days it ever spent floating beside a place it could hit.

  What is missing is the opportunity. Over thirty raider sagas the errand
  aimed at a CAMP on 1611 settled days and at a place on 173, and 162 days
  afloat produced four chances.

  And it is not distance and not preference, which is the part worth
  keeping. Ranking sea prizes above camps outright changed the numbers by
  exactly nothing; widening how far a prize counts as reachable by eight
  hexes, on the grounds that rowing is cheap, also changed them by exactly
  nothing. Byte-identical, three runs. The candidate set is EMPTY, not
  mis-ordered: a place has to be seen, unsacked, and lightly enough held for
  the band that is standing there, and the four on a coast are one-shot —
  taken early or never learned at all. Camps regrow every sixty days and so
  the circuit is always camps.

  Which makes this not a raiding problem and not a ship problem. It is a
  question about the PLACE economy — how a band learns where places are, and
  whether four one-shot prizes to a world is the right shape — and that is a
  design decision, not a tuning pass. Both bot experiments were reverted
  rather than left in as dead complexity, and the probe is kept so the next
  reader starts from the numbers instead of the guess.

- **2026-08-12 — TASK 31 CLOSED: the hands hold their own hall** — #34 said
  the width of the shield wall decides an open-field fight (9% won with
  three, 47% with six) and that a band of six can never raid with six,
  because somebody must hold the steading. The cheap way to satisfy that is
  not a standing warband: it is letting the people already at home defend
  it. Hands now stand in the line when a raid comes to the yard — sworn
  first, hands filling the gaps, never wider than the same six places.

  It does not widen the wall and it does not put hands on the road: away
  from home the line is still the sworn who walked there, so what 6.2 bought
  (labour, never army) is intact. And the bot took the capability in the
  same commit — it sends the whole wall now instead of a detachment of it.

  | A Fair Country, 30 landings | before | after |
  | --- | --- | --- |
  | camps won, of the fights picked | 4/85 (5%) | **12/34 (35%)** |
  | raider second winters | 3/30 | **7/30** |
  | raider days a saga | 99 | **125** |
  | settler second winters, for scale | 7/30 | 7/30 |
  | turtle second winters, for scale | 21/30 | 21/30 |

  **Raiding is a way to play now** — level with settling, where it was a
  dead end this morning. Not level with turtling, and that is a separate
  question about the turtle rather than about raiding.

  Defence did not become free: the raid gauntlet holds 34/96 with its
  gradient intact (12/10/7/5 across difficulty 0–3), which is what the extra
  bodies were checked against.

  Two things this touched that are easy to miss. The recorded long run
  stopped replaying at action #1010 — a genuine rules change, which is
  exactly what that test exists to report, and it was re-recorded rather
  than relaxed. And the guide and the hand lesson both stated the old rule
  in so many words ("labour, never fighters"; "they never stand in the
  line"), so both were rewritten: the game must not teach a rule it no
  longer has.

- **2026-08-12 — TASK 31 ANSWERED: the band cannot take its wall with it** —
  The comparison every earlier measurement was missing. Same band, same
  difficulty, thirty-two fights a cell, at every width from three to six, in
  three postures:

  | 32 fights a cell, difficulty 2 | 3 stood | 4 | 5 | 6 |
  | --- | --- | --- | --- | --- |
  | attacking | **9%** | 34% | 34% | **47%** |
  | defending, no palisade | 13% | 6% | 22% | **47%** |
  | defending, behind a palisade | 0% | 19% | 31% | 22% |

  Two readings, and the first ends the question. **Attacking is not
  punished**: six attacking and six defending open ground both come out at
  47%, dead level. What decides an open-field fight is how many stood in the
  line — 9% at three against 47% at six, a fivefold swing, monotonic and far
  outside what this harness can mistake for noise.

  So raiding fails for a reason none of the six levers tried today were
  aimed at. A band of six must leave somebody to hold the steading, so a
  raiding party is three or four, and three or four is a broken wall. The
  band cannot take its wall with it. That is why the haul could not be
  priced, why glory could not be paid, why a survivable retreat changed
  nothing and why word was worth three points: every one of them was
  downstream of a fight already lost nine times in ten.

  **Which makes the answer the hird after all** — not for risk isolation and
  not for economics, but for WIDTH. A standing warband is bodies enough that
  a raiding party is itself a full wall of six without emptying the hall.
  That is now a measured requirement rather than a historical intuition.

  One reading deliberately NOT claimed: the palisade shows no benefit in
  this frame and at width six looks worse. At 32 samples a cell those gaps
  are inside the noise, the raid difficulty curve is scaled differently from
  the open field (`RAID_PER_POINT`), and `the raid gauntlet` measures walls
  properly. Flagged as a question, not a finding.

- **2026-08-12 — The one deed the game offered blind, and where the losses
  are not coming from** — Falling on a camp said only *"Draw steel.
  Whatever you take, they will remember who took it."* No odds, no strength,
  no count — while calling a Thing states its percentage and its cost,
  bartering states what it carries in, and a strandhögg says what the ship
  is worth. The single least reversible choice on the sheet, docking
  REP_RAIDED the instant it is tapped and measured at a 5% win rate, was the
  only one a player could not see into. It now reads "4 of us here against
  about 6 of them", and says plainly when they have the numbers. The count
  comes from `foeCount`, split out of `rollFoes` so the sheet and the fight
  cannot drift apart.

  Then the balance half, and it is a partial result honestly reported. Word
  no longer hardens a fight the band PICKED — neither the number of them
  (`wordBump`) nor who they are (`weightFor`). `wordOf` counts sackings, so
  every camp a band fell on made the next camp bigger and staffed it with
  huscarls: a fishing village quietly fielding veterans because the attacker
  was well known. Word is what comes LOOKING for a famous band; it cannot be
  what the place you walk into recruits.

  Right on its own terms, and **not the cause**: camps went 4/85 (5%) to
  6/76 (8%). The losses are not word, and they are not the foe count — three
  sworn draw about four defenders. What is left is per-head strength and the
  shield wall itself: the band's whole combat design is a wall, a wall wants
  the whole band, and a raiding party is by definition half of one. Five
  sworn only reach 12% where the same band behind a palisade holds 39% of
  the raids that come to it. The next measurement is that comparison held
  properly — same numbers attacking and defending — and it is not done.

- **2026-08-12 — Falling on a camp is a fight the band loses 19 times in
  20** — Glory was the hypothesis: camps paid nothing to the band's heart
  where a sacked place always had, so raiding's morale could only go one
  way. Camps now pay `plunder.morale`, scaled by how full the place was.
  Swept at 0, 6, 12, 20 and 30 the raider came back **identical to the
  digit** — second winters 3/30, morale 19, anger 49 — because `sackCamp`
  runs four times in thirty sagas.

  Counting the fights the raider PICKS is the whole answer: **85 camp fights
  and 4 wins**, 15 fixed places and none. Five sworn instead of three moves
  it to 7/59; five sworn in any season, 11/56. One in five is the ceiling.
  Every lever tried this session sat behind that gate — the haul cannot be
  priced because it is almost never collected, glory cannot be paid because
  the payment barely runs, and raiding more only loses more of the fights
  you picked. `REP_RAIDED` is docked at the decision rather than the
  outcome, so the band pays the coast's memory a hundred times and is paid
  back four. Raiding is not a strategy that needs pricing; as shipped it is
  a tax.

  So the design question is not the standing warband after all. It is
  whether falling on a camp should be a fight a band can win: camp might
  rises each time you sack one, and `raidTarget` only offers camps to a
  roster of five while the bot sends three, so the fight is sized for a
  band that never arrives.

  The renown payment is kept although it moved nothing measurable, because
  the asymmetry was real and it goes live the moment camps are winnable —
  recorded plainly rather than dressed up as a fix that worked.

- **2026-08-12 — The haul cannot be priced, and raiding's real cost is
  morale** — Task 31's last supply-side lever. Multiply what camps and
  places hold and find the price at which raiding pays: there is none.
  Doubling changes nothing at all (identical runs), and eight times — one
  camp yielding 894 stores, months of eating — makes the raider slightly
  worse, 2/30 second winters against 3/30. The knob was proved live before
  the null was believed: 112 → 224 → 447 → 894 from a single camp.

  The columns that never move with the haul are the ones that matter. The
  raider dies at **morale 19 on a coast at anger 49**; the turtle lives at
  **morale 65 on a coast at anger 1**. More plunder buys more anger (49 →
  55), anger buys reprisal, reprisal costs heart. Raiding is not paid for
  in food or in bodies — it is paid for in morale and in enmity, and
  neither can be bought with stores. That is why five levers in a row
  failed: labour cost, party size, raid rate, lethality and price were all
  answers to a question the game was not asking.

  And the gap that fits: `sim/plunder.ts` has no morale line anywhere. A
  sacked camp pays food, firewood and sometimes a thrall and nothing to the
  band's heart, while a sacked place pays `def.loot.morale`, a lost fight
  costs 15 plus bereavement, and a sacking of your own steading costs 14.
  Camps are the repeatable circuit the whole design rests on, and coming
  home from one loaded lifts nobody. Glory is missing from the act the game
  is named for.

- **2026-08-12 — A fight you picked can be broken off, and it did not save
  raiding** — Task 31's cheap experiment. `rollFate` used to know two
  states, holding the field or losing it, and a lost raid killed better than
  half the men who went down: two thirds of armed errands ended with nobody
  coming back. It knows three now — `held`, `withdrew`, `overrun` — and a
  band that WENT OUT to take something can break the fight off, where a band
  standing in its own yard cannot.

  It was meant to be the ship that did this, and could not be: raids are
  never fought off the water (3 strandhöggs in 120 sagas), so a
  retreat-by-ship would have been a retreat from something that never
  happens. The strandhögg being unreached in play is a separate finding and
  still open.

  The rule works and the thesis it was testing is dead. Raider deaths by
  steel fall 42 → 28, sackings rise 1.9 → 3.0 a saga, survivors 2.8 → 4.1
  — and second winters do not move: 3/30 before, 3/30 after, against the
  turtle's 21/30. Four candidate causes are now measured and buried: the
  labour cost, the party size, the raid rate, the lethality. What is left is
  the exchange rate — 43 stores and a permanent enemy against a farm that
  works.

  Kept anyway, because it is right on its own terms: a fight the player
  chose should not annihilate the band that chose it. And `more than one way
  to play` now reads the SECOND WINTER, where the lines actually differ
  (7 settler, 3 raider, 21 turtle) rather than only spring, where all three
  sit within a few points and the old bar passed while the game was nothing
  like balanced. Barred on reach — every line must stand a second winter
  sometimes — and deliberately not on parity, because the 3-against-21 gap
  IS task 31.

- **2026-08-12 — What actually stops a band living by raiding** — Task 31's
  design question rested on a cost nothing had checked was the binding one:
  a raid takes 28% of a settled band's labour-days. Two probes now follow
  every armed errand from launch to whatever it carried home, and put the
  strategy to the game with the harness's own scruples taken off.

  The labour cost is not it. Over 5,982 settled days the errand was refused
  for a thin store on 1% of them and actually launched on 0.4%; 53% of those
  days failed on the BOT's `wintersStood >= 1` rule and 17% on its own
  in-season rule, neither of which is a rule of the game. So every earlier
  raiding figure was measuring a bot that raided rarely, late and
  shorthanded, not whether raiding works.

  Unscrupled, it is answered. A party of five instead of three halves the
  wipe rate (67% → 25% of errands end with nobody coming back) and nearly
  doubles the haul (25.3 → 43.2 stores) — and second winters do not move,
  3/30 either way, because at 1.5 errands a saga the errand is not what the
  run is made of. Raiding MORE is worse, not better: first winters fall
  29/30 → 12/30 and lifespan halves. And the unleashed arm is the only one
  where **steel outranks the season** as a cause of death, 59 to 44.

  Which relocates the problem. What binds is not the labour a raid takes
  away — it is that a raid is fought by the same six people whose survival
  is the whole run, so every raid is staked against the saga and a haul of
  43 stores cannot price that. The standing warband is still the answer, for
  a better reason: not because raiders are your farmers, but because they
  are your only people.

  One probe bug worth recording: the first run reported that no errand ever
  carried anything home, which was false. `checkOutcome` writes the result
  but `sackCamp` pays out in `leaveBattle`, several transitions later, in
  the same call that deletes the battle — so a haul measured where the
  outcome appears reads zero for every errand ever flown. A dull probe
  making a live system look empty, again.

- **2026-08-12 — The coast, passed on while you are still standing** — The
  challenge code was produced on the ending screen and nowhere else, so a
  player who wanted to send a friend the country they were enjoying had to
  lose first. The Act sheet now carries it, ruled off below the deeds
  because it is not one — the list is what a DAY can be spent on, and this
  costs no day.

  It sends the coast, not a result: `LN1 <seed> <terms>` with no mark on it.
  Mid-run there is nothing yet to beat, and a "beat day 40" sent on day 40
  is a claim the sender has not earned and may lose on day 41. The ending
  screen keeps the full mark. Both the decoder and the title screen already
  handled a markless code, so only the producing half was ever missing.

  Driven end to end in the built page (`scripts/drive-coast.mjs`): start on
  a chosen seed, play to day 4, open the sheet, read the code, copy it,
  paste it back into a fresh title screen and see it recognised. On **A Hard
  Country on purpose** — `fair` is the default, so driving it on `fair`
  would have printed the right terms whether or not the pick ever reached
  the code.

- **2026-08-11 — The cold list was arithmetic, and the sample was half what
  it said** — The content-reach probe has been reporting fifteen cards
  "never drawn" and it means nothing: no card in the deck is unreachable,
  every one of the fifteen was eligible — some for hundreds of days — and a
  perfectly fair 102-card deck, given 857 draws from pools averaging 29,
  leaves about thirteen cold. Fifteen IS that number. The probe now prints
  the prediction and a control replay next to the count, and bars a card no
  state ever opens rather than a card the dice never picked.

  Chasing it turned up the fault worth having. The probe played
  `curve-0..29` under both hardships, and no hardship reaches the RNG: same
  seed, same country, same landing hex, the same card drawn on the same day.
  Sixty sagas were thirty played twice, every count doubled and every
  deviation with them — which is what made fifteen zeros look impossible
  when they were ordinary. Three other probes claimed sixty on the same
  thirty and now get their own landings (`armSeed`). Also: deck coverage was
  counting `feud` and `thing`, which the sim builds by hand and are not in
  the deck, so 89 of 102 was printed beside a list of 15.

  Recorded because it cost an afternoon: the fifteen ids are SELECTED for
  being zero, so the joint probability of "all fifteen zero" is meaningless
  and computes to one in a million. The statistic that means something is
  the expected NUMBER of cold cards. Along the way the RNG, the weighted
  picker and the fire path were each cleared by direct measurement — the
  picker draws all 102 cards at their stated rates over 200k trials.

- **2026-08-11 — A Hard Country is a difficulty, not a wall** — The hardest
  setting the menu offers was the one nothing knew anything about: the
  hardship sweep stops at day 73 and the long game ran `even` and `fair`
  only, so past the first spring `hard` was unmeasured. Sixty sagas to day
  500 settle it. Everything is reachable — 26 steadings founded, 21 that
  built something, 45 that met the coast, one second winter, **one jarldom**
  and one band alive on day 500. Punishing, and not a brick wall, which is
  what the label promises.
  The sharper reading is what hardship actually DOES. It barely changes
  whether a band reaches the first winter — 44 of 60 against `even`'s 48,
  and at twenty seeds the two read the same 17/20. What it changes is
  whether they survive it: 5 springs against 17. The first forty-nine days
  are mostly walking; the terms bite in the dark half of the year.
  `hard` is a permanent third arm of the long game now, barred on the first
  winter, which is the one reading on that country a twenty-seed sample can
  carry. Jarldoms there happen about once in sixty and cannot be barred on
  at any affordable N, so they are printed and not asserted — the same rule
  the jarldom scare of the morning taught.

- **2026-08-11 — The oldest rule in the project, finally asserted** — Hard
  constraint 1 says the built page runs from a `file://` open with no
  external requests. It has held since the beginning and was checked
  nowhere, which made it the most load-bearing untested rule here: the day
  somebody adds a font or a CDN script, the only thing that notices is a
  player with no signal, and the failure is total because the whole game is
  one file.
  Two halves. `test/offline.test.ts` runs in `npm test` against the
  PUBLISHED bytes and against the source, and its sharpest assertion is that
  **exactly one file in `src/` makes a request at all** — so a `fetch` in a
  new module fails the suite even when its URL is built at runtime and
  appears nowhere. `npm run offline` is the other half: the page opened from
  `file://` with the wire cut, played for two days, failing on anything that
  tries to leave. It needs Playwright, which this project deliberately does
  not depend on, and it says so and exits rather than pretending to pass.
  Both were checked by making the mistake — a CDN stylesheet, a `fetch` in a
  new module, and a URL assembled by string concatenation that the static
  half cannot see by design and the runtime half caught.
  The audit also settled what the page is ALLOWED to do, which nobody had
  written down: two `fetch(` calls survive into the artifact, and both were
  traced rather than waved through. One is Vite's modulepreload helper
  walking a list that is empty in a single-file build. The other is
  `src/freshness.ts` asking for `build.txt` — same-origin, and gated on
  `location.protocol`, so it cannot fire from `file://` at all.

- **2026-08-11 — The first six people to join a band took the founders'
  names** — A shipped bug, found sideways. `makeWarband` hands the six who
  come off the knarr `p1`..`p6`; `newGame` set `nextId: 1`; so the first
  joiner was created as `p1` and the next five took the rest. Everything in
  this game is keyed by personId — `fighterPerson` resolves a combatant by
  it, kin point at each other by it, grudges name two people by it, jobs are
  given by it, the memorial buries by it — and every one of those lookups is
  a `find`, which returns the FIRST match. So the twin was a ghost: it ate,
  it could die, and nothing could address it.
  Latent until 2026-08-08 made growth actually happen, and silent
  afterwards. Found by a recorder bot that assigned `farmer` to the same
  person **19,717 times** and could not work out why it never took — the
  roster printed seven people and `p1` twice.
  `nextId` starts past the founders now, and the v31 migration repairs a
  save that already carries a twin. The migration does one thing and
  deliberately stops: it renames the later twin and moves NO references. The
  thorough-looking version came first and was wrong — every reference to
  `p1` reached the founder for as long as the duplicate existed, so carrying
  them across would hand the twin a history it never had and take a brother
  away from the founder. The test caught it pointing a brother at the wrong
  brother.
  The balance figures moved in the direction the fix predicts, since a
  joiner can now be given a job instead of being a mouth that cannot work:
  the settler's second winters went **4/30 to 7/30**, the turtle's survivors
  5.2 to 6.3, and everything else sat still. Most of it is inside what this
  harness can resolve; the settler reading is at the edge of it.

- **2026-08-11 — The rest of the fight, and the rest of the year** — The
  beat stream's travel and colony half, completing Phase 7 item 3. Thirteen
  `WorldBeat` kinds on `GameState.beats` (SAVE_VERSION 30), stamped with the
  day where a battle beat carries its round.
  `chronicle()` was the seam the plan named and it was the wrong one: a beat
  per saga line hands a renderer the prose back, shaped as `{day, text,
  tone}`, which is what `state.saga` already is. What a second engine needs
  is the ordered inside of `passDay` — the mouths eating the last of the
  food, the fire going out, a roof finished, somebody coming over the ridge
  — so the beats sit at those sites instead.
  The reach bar took four rounds to satisfy and **every failure was the bot,
  not the game**: it founded on day one, and `canGather` is false at a
  steading, so it never foraged; it stalled inside COLONY with no way back
  out, so days stopped passing on day 9 and one seed span 900 steps
  oscillating; it tried jobs from the top of the list each time, so all six
  people became farmers, nobody cut wood or built, and every seed died of
  despair by day 40; and it stopped collecting at `seen.size < 12` against a
  list of thirteen, reporting the last kind unreachable without ever looking
  for it. A dull probe makes a live system look empty, and this is the third
  time that has cost a measurement here. Checked against a kind that does
  not exist, so the bar can fail.

- **2026-08-11 — The larder reading, and a fix that was not needed** — The
  barter diagnosis left one number unread: 29% of trade visit-days blocked
  on `stores`, a band walking a fortnight and arriving unable to spare the
  eight food it came to spend. That reading had two possible causes wanting
  opposite fixes, so it got measured instead of guessed. On a blocked
  visit-day the median band had **1.1 food** — against **28.4** on the days
  that were free to deal, and 17–20 across all settled days — and **half the
  sagas that hit one were dead within twenty days**. Poor bands are poor.
  `BARTER_FOOD` is not too dear; a band with a working larder brings three
  and a half bargains' worth to the door. Nothing shipped, because nothing
  was broken, and the coast design now has one lever instead of two.

- **2026-08-11 — Ninety-eight percent of a turn was copying ground that
  cannot change** — `apply` is `(state, action) => state` and never mutates
  its input, which is the rule the whole project stands on. It was paying
  for that rule in the dumbest available place: `structuredClone(state)`
  duplicated the entire world every action, and the world is 78 KB of
  terrain generated once at worldgen and never written. **1.950 ms a copy
  became 0.069 ms — twenty-eight times cheaper** — by sharing the tiles and
  copying only what play actually writes.
  Which parts those are was settled by grep, not by sampling. `world.seen`,
  `world.trod` and `place.sackedOn` all have write sites; `world.tiles` has
  NONE anywhere in `src/`. A play-sample agreed and was worthless — the bot
  never moved, founded or sacked, so its clean result covered nothing it was
  asked about. (`Tile.explored` is declared and never written: a dead field.)
  Two states sharing an object one later mutates would show up as a corrupt
  save weeks later rather than a red test, so the tiles are frozen on first
  copy and a write throws at the line that does it. `test/clone.test.ts`
  proves the freeze actually bites instead of assuming it, and the real
  guard is the whole suite — sixty sagas to day 500, founding, building,
  raiding, sailing and fighting — running with the ground frozen throughout.
  Two things fell out of it. The first cut moved `world` to the end of the
  state object and `tiles` to the end of the world, which is deep-equal and
  textually different — and `encode()` is a `JSON.stringify`, so it would
  have quietly changed the bytes of every save. Both levels are rebuilt in
  the original key order now, and the same test caught both. And the
  unlooked-for prize: **the test suite went from about fifteen minutes to
  under four** (923 s to 235 s). The balance harness was clone-bound the
  whole time and nobody knew.

- **2026-08-11 — A saga somebody else can play** — Seed challenges, carried
  since 2026-08-07. A challenge is a line of text — `LN1 grim-fjord-100 fair
  d128 w2 jarl` — and it goes in the seed box the title screen already had,
  so there is no new screen and no new button. It carries the TERMS as well
  as the seed: a shared seed on a different country is not the same run, and
  the bare seed the ending screen used to print could not say so. Paste one
  and the difficulty chips stop being a choice and start being a statement;
  the ending screen says whether you beat the mark and hands you your own
  code. `SAVE_VERSION` 29 for the `chasing` mark, which has to survive the
  tab being closed on day 12 of a chase.
  **Deliberately not base64**, against every instinct. This is played on
  phones: a code gets pasted into a chat, wrapped by an email client, read
  out over a table and retyped with a thumb, and the failure mode of a blob
  is that one wrong character produces silence. A readable format survives
  all of it — a truncated code still lands you on the right coast, which is
  most of what it was for — and a player can SEE their own seed in it. What
  it does not do is prove anything, and the code says so rather than
  implying otherwise: a mark is a claim, the way a seed challenge has always
  been a claim, and `scripts/play.ts` is where a claim can be checked.
  A test found a real bug on the way: uppercasing a code changes the seed,
  because `hashString` walks code units — so `Grim` and `grim` are different
  countries. A decoder that lowercased to be helpful would strand anyone who
  typed a capital, so the fix belongs on the input, and the seed box now
  carries `autocapitalize="none"` (plus autocorrect and spellcheck off).
  Phone keyboards autocapitalise the first word of a pasted line. Two people
  comparing a shared seed could have been playing different games with no
  way to tell, and that was true before challenges existed.

- **2026-08-11 — The sim, played with nobody watching** — A headless runner:
  seed and a list of actions in, the finished state and a hash out. `npm run
  play`, `npm run record`, `src/run/headless.ts` pure and `scripts/*.ts`
  holding all the impurity there is. Three jobs that are really one — the
  differential test Phase 7 item 1 asks for, seed challenges (a challenge is
  a file and a claimed result is checkable against a hash), and repro cases,
  because a bug on day 340 of a five-hundred-day saga is currently a story
  and is now a file.
  The hash is sixteen hex digits over a canonical form with **sorted keys**
  and **explicitly written numbers** — both there so a second language can
  produce the same string without guessing, since insertion order and
  shortest-round-trip double printing are exactly the sort of thing two
  runtimes disagree about while both being right. It is built on
  `hashString`, already pinned in `port/golden.json`, so a port that passes
  item 2 has nothing new to agree about. The saga is excluded: prose gets
  reworded, and a hash that moved on a reworded sentence would cry wolf until
  nobody looked at it.
  **It earned its keep on the first day.** The recorder produced 1,973
  actions across 28 days, all of them `CHOOSE` — because `apply` ACCEPTED a
  choice on an already-answered card and returned a fresh clone that was
  identical in every respect. Harmless in the web build, which only offers
  the choices while they exist, and not harmless at all to anything reading
  `apply`'s "same object means refused" contract, which is the runner's only
  signal. Both fixed: the sim refuses it now, and the recorder drives cards
  the way the balance harness always did (choose while it is a question,
  dismiss once it has an outcome).

- **2026-08-11 — The parity harness could only see one side of the parity** —
  Went looking at `landnam-ue` to answer "what have I already decided about
  item 1" and found the answer was *more than the plan thought*: `src/hex`
  and `src/rng` have been ported to C++ since 2026-08-10, Blueprint-exposed,
  with an automation test driven by golden vectors. Verified in parity, not
  assumed — **1,620 values regenerated from today's TypeScript, zero
  disagreements**.
  But the generator that produced those vectors was never committed to THIS
  repo, which is the exact hole a parity harness exists to close: change
  `src/rng.ts`, nobody regenerates, and the Unreal test goes on passing
  against yesterday's expectations while the two builds quietly disagree. A
  green parity test that can only see one side is worse than none, because it
  is reassuring. `port/golden.json` now lives here — the repo that owns the
  code the vectors describe — and `test/goldenport.test.ts` recomputes every
  one of them from live `src/`. Checked by breaking `offsetToAxial` and
  watching it fail.
  Four things came out of writing the verifier. The section recipes were
  **solved rather than guessed** — `wideInts` is `int(-50, 250)`, `floats` is
  `float(-2.5, 7.5)`, and `chances` is `chance(0.3)`, pinned by the six
  streams jointly admitting only p ∈ (0.297557, 0.302485]. Two apparent
  parity breaks were my verifier's assumptions, not the port's: unreachable
  path costs are stored as `-1` because JSON cannot write `Infinity`, and
  `Path` has no `reachable` field. And the golden file **carried no
  non-ASCII hash case at all**, so it could not catch the one bug the spec
  is loudest about — six were added. Finally the duplicate contract I created
  the day before was reconciled: one shared file, and the standalone C++
  reference deleted now that a real tested port exists.

- **2026-08-10 — The seed is the world, so the seed gets a contract (Phase 7
  item 2)** — `port/` is new: the things a second implementation of this sim
  must agree with this one about. First entry is the generator, because
  every world, event and blow comes out of it and `Math.random` is banned,
  so a port that is one bit off reproduces nothing — while passing its own
  test suite the whole time, since a self-consistent generator is still
  self-consistent when it is wrong.
  `port/rng-fixture.json` pins 174 absolute values as INTEGERS (a decimal is
  somewhere two languages can disagree without either being wrong): hashes,
  raw uint32 draws, all six stream names, derive chains, and the helpers
  with their draw counts — a `roll(2,6)` that takes one draw instead of two
  stays in step for exactly one call and diverges forever after.
  `port/rng.md` is the spec and `port/rng_reference.cpp` a C++
  implementation **compiled and run against the fixture**, 174 of 174.
  Two things it turned out to be worth beyond the port. It is a tripwire
  this repo did not have: `test/rng.test.ts` never pins an absolute value,
  so the generator could be changed by accident and every seed in every save
  with it — `test/rngport.test.ts` now fails on a one-digit change to the
  FNV prime, verified by making it. And checking the seed cases instead of
  trusting them sharpened the spec: `landnam` hashes identically as UTF-8,
  UTF-16 or code points, so **no ASCII seed can ever catch this bug**;
  `Þórr` catches a UTF-8 port; only `😀` catches a code-point one.

- **2026-08-10 — Bartering was never the problem; the walk was** — The
  standing wall, diagnosed before being tuned, and the tidy explanation
  recorded the same day turned out to be wrong. The story was arithmetic:
  +9 a bargain against 0.12 a day of drift, a band running down an
  escalator. Measured over 88 settled sagas, that story dies — **every one
  of the 20 bands that struck three or more bargains reached speaking
  terms** (median peak 53–75), against 1 of the 65 that struck none. Three
  bargains is the whole game and the +9 needs no changing.
  What binds is access. **The median band spent zero days of its life
  standing on a neighbour's hex** and 58 of 88 never stood on one at all —
  neighbours sit up to thirteen hexes off, a week's walk each way. When a
  band does get there it deals readily (123 bargains on 151 days free to
  deal, so this is not the bot declining), and **29% of visit-days were
  blocked on `stores`**: a fortnight's walk ending with too little food to
  spare the eight it came to spend.
  The fix is therefore a different shape entirely: a visit that can be
  dealt with, rather than a bargain worth more. `neighboursCallOn` is the
  pattern but not half the work — it reveals each neighbour ONCE and stops
  when all four are found, so it fires four times in a steading's first two
  months and never again, which is exactly when a band cannot spare the
  food. Recurring callers are the actual job. Nothing shipped but the
  finding; the design call is open. Recorded
  because the wrong explanation was convincing, cheap to act on, and would
  have produced a tuning pass that moved a number nobody was blocked by.

- **2026-08-10 — Twenty seeds had regressed, not the game** — The one
  unexplained number in this document, closed. The long game's jarldom count
  fell from 5 in forty sagas to 1 on 2026-08-09; I could not attribute it and
  recorded it as unattributed rather than papering over it. Widened to sixty
  seeds an arm and run against `e1b9c9c` — the commit before that day's
  raiding work — the direction reverses outright: 5 jarldoms against 2,
  second winters 15 against 12, mead halls 35 against 26, friends 21 against
  7. The regression was the instrument. The long game now carries a
  `LANDNAM_LONG_SEEDS` knob and says in the file that per-saga COUNTS at the
  default cannot be read as findings — its bars are reachability bars for
  exactly that reason.
  Chasing it found something real underneath. Asking which of the Thing's six
  needs actually fails gave `friends`, so standing itself was measured over
  every settled saga rather than the few that reach an endgame: **88 of 88
  met a neighbour, the median band's best standing with anyone was 10.9 —
  the opening a native camp gives away for nothing — and 21 of 88 ever
  crossed the 25 a speaker needs**, with the ones that do sitting at 99–100.
  Friendship is bimodal and the median relationship never moves. The cause
  written down here first — `REP_TRADED` at +9 against `REP_DRIFT` taking
  0.12 a day back — was wrong, and the next entry says how.
  That is the wall in front of the endgame and it is a design decision, so
  what shipped is the instrument, not a fix: the long game prints the
  standing distribution every run and bars that somebody still reaches
  speaking terms. `SPEAKER_STANDING` is a named constant now instead of a
  bare 25 inside `hasSpeakers`.

- **2026-08-10 — The fight as data (Phase 7 item 3, battle half)** — Unreal
  needs ordered events an animation can play; a fight offered prose and a
  one-slot hook. `src/sim/beats.ts` adds fifteen beat kinds — opened, moved,
  struck, reached, threw, shoved, defended, dashed, warcry, fell, leaderFell,
  broke, rallied, fled, ended — numbered so a view drains by mark, actors as
  `personId`, ground as hexes. `Battle.beats`, SAVE_VERSION 28. Nothing in
  the sim reads a beat, so emitting one cannot change a fight: the arena
  reads formation 32/60 and brawl 29/60 either side.
  Two things were measured rather than argued. The reach bar plays thirty
  real fights and names what it saw (moved 929, struck 728, reached 338,
  threw 207, fell 187 … leaderFell 28) and is checked against a kind that
  does not exist, so it can fail — the lesson audit item 6 paid for. And the
  web effects layer was rewired onto the stream instead of being left to
  rot, which found what the argument would have missed: same save, same
  script, same fight, the old `lastBlow` slot showed **6** blows where the
  stream shows **31**. A slot holds the newest blow and a foe's whole turn
  lands between repaints, so every swing but the last was never drawn.
  `lastBlow` is deleted, along with the fallen-fighter Set beside it that
  was never cleared between fights. Travel and colony still owe their half;
  `chronicle()` is the seam.

- **2026-08-09 — The knarr was never faster than walking (raiding, part
  two)** — Chasing the cost of going out, and the first thing measured was
  the sharpest finding in the whole sequence. A day's travel is
  `ceil(effort / 2)`; land costs 1 or 2 and `SEA_EFFORT` is 2. **Every hex
  of everything rounds to one day.** The knarr was exactly as fast as
  crossing a meadow and no faster than a forest — while the guide had been
  telling the player since 5.x that it "rows coastal water faster than legs
  walk". The claim was simply false, and had been for as long as the ship
  existed.
  The day-cost model cannot express "faster" at that granularity, so the
  hull covers GROUND instead: `ROW_REACH` (three) hexes of coastal water in
  the day it takes legs to cross one, over a clear water line, land movement
  untouched. The bot steers for the water and stays on it — greedy stepping
  toward a target only ever touched water on the last hex, which measured as
  1.7 sea days a saga in a band built entirely around going out. It is 7.6
  now.
  Sorties were also a season long: twenty days out plus the walk home is
  **23.9 days door to door** with half the band away. `RAID_DAYS` is ten, so
  a raid is a sortie rather than an expedition — trips fell to 15.7 days and
  doubled in number.
  **And none of it made raiding win, which is the honest result.** Raiding
  reaches spring exactly as reliably as turtling (25/30 both) and no
  further: second winters read 20/30 turtle against 4/30 raider. Sackings
  stayed at **1.9 a saga through every one of those changes**, because most
  sorties come home empty — trip length was never the binding constraint,
  and the thing that is has not been found.
  Two costs, recorded rather than buried. The settler briefly gained armed
  sorties, and the long game answered immediately: **jarldoms fell from five
  in forty sagas to none.** A steading-first band that spends its summers
  away from the steading is not one, so `raidReach: 0` is the settler's
  identity now rather than a limitation — going out under arms belongs to
  the policy built for it. And even with that put back, the long game reads
  thinner than it did this morning (1 jarldom against 5), which I could not
  attribute to any single change and am not going to pretend to have
  explained.
  One good thing fell out of the same correction. The strandhögg's play-level
  bar had been dropped a few commits ago as "too rare to bar" — measured on
  the SETTLER, a band that does not go out under arms at all. Asked of the
  raider, the same sample reads **351 days afloat, 50 armed errands and 6
  strandhöggs** against 47, 2 and 0. The verb was never as rare as the
  measurement said; the measurement was pointed at the wrong band. The bar
  is back, and so is the lesson: **a reach bar has to be asked of a policy
  that would ever reach.**
  What the numbers point at is structural rather than tunable: a raid costs
  a settled band **28% of its labour-days with half the household away**,
  whatever the trip length, and the steading needs those people. Nobody
  raided like that — a warband went in ships, in season, and the farm ran on
  whoever stayed. Making raiding win probably means a warband that is not
  half the household on loan, and that is a design decision, not a sweep.
  Curve 57/27/7, unmoved.

- **2026-08-09 — A camp is a crop (raiding, part one)** — Following the
  item-7 finding that staying home wins and even the raider policy sacked
  0.3 camps a saga. The economics said why: a native camp at might two paid
  **24 food — eight days of eating for six people** — against forty-five
  standing, a permanent enemy, and a fight that kills people for good.
  Nobody sane takes that trade.
  **The haul is worth the reprisal now**, roughly tripled, so a camp is a
  third of a winter rather than a week of it. What stops that being free
  money is the other half: **a robbed camp has nothing left in it.** Stores
  grow back over `CAMP_REGROW` (sixty days), so a band that lives this way
  works a circuit of the coast instead of standing on one camp forever.
  `Neighbour.sackedOn` is a new save field — SAVE_VERSION 27, with a
  migration that reads an absent value as "never touched", which is the
  kindest true thing to say about a history the file does not contain.
  The bot learned to live by it in the same commit: it falls on any camp
  worth robbing while it is out under arms and strong enough, where before
  it only ever robbed anybody when it was three days from starving — a
  desperation rule wearing a strategy's name. Sackings went **0.3 to 2.5 a
  saga**, and the armed errand now steers at camps as well as at the fixed
  places, which matters because the places are taken once each and gone
  while a camp comes back.
  Then the measurement said raiding was killing them, and named the reason:
  a raider ended a saga with **0.8 hands where a turtle had 2.8**. Raiding
  maxes `DRAW_ANGER`, which shuts the settler door — correctly, nobody moves
  in next to a feud — so a raider who lost four sworn a saga could not
  replace one of them and ground his warband to nothing.
  **So there is a second door.** A feared band with something to show draws
  men who want a share, and they come armed: `swordOdds` is fed by the same
  anger that closes the other door, times what you have actually taken.
  Both halves are required — unpleasant with nothing to show is just
  unpleasant, and a hoard nobody fears is a farm. It fills a GAP in the
  warband and never widens it, so 6.2's rule stands: the wall is six.
  One fault of mine on the way, and the same one as last time: **a strategy
  tested with a spec that cannot carry it is not tested.** The raider's crew
  was two warriors, one hunter and a farmer trying to feed six, and
  twenty-eight of twenty-eight of his deaths were hunger. A man who lives by
  taking still has to eat between takings.
  Where it stands: the raider lives 104 days against the turtle's 163, and
  26 of 29 deaths are still hunger — plunder covers about a third of what
  the band eats. **The remaining lever is the cost of going out**, and it is
  the one the period actually used: a twenty-day errand on foot to reach one
  camp is not how anybody raided. The knarr is the answer and it is the next
  piece of work.
  Curve 57/27/7, unmoved.

- **2026-08-09 — Told, not shown (audit item 10)** — Six `aria` attributes
  in the whole render layer, on a game whose primary target is a phone
  browser. The item assumed the gap was labels and touch targets. Driving
  the built page said otherwise: **every interactive element already had an
  accessible name**, and every touch target was at or over the 44px this
  project has required since 5.2 — bar exactly one, the Saga button at 43
  wide, which had been a pixel short for months because nothing counted it.
  What was missing was everything about CHANGE.
  **No live region anywhere.** A turn-based game rewrites its whole page on
  every action, which is the case a live region exists for, and a listener
  took a turn and was told nothing. There is now an off-screen polite status
  that says what just happened and then where the band stands — the newest
  saga lines first, because a listener wants "they fired the smokehouse"
  before they want the woodpile, bounded at three because a region that
  reads a paragraph a turn is one people switch off.
  **No dialog semantics.** Fifteen overlay sites all built a bare `.overlay`,
  so a card covering the screen read as more page. Each is `role="dialog"`
  `aria-modal="true"` now, and the name and the reading position are taken
  from the card's own heading centrally, so no call site has to remember.
  **An unlabelled map**, which is the largest thing on screen. It has a
  summary — how much of the coast is known, what stands on it — and points
  at the panel underneath, which already reads the ground in detail.
  The TEXT is pure and lives in `src/sim/announce.ts` with unit tests,
  because this project's rule is that anything testable does not belong in
  `render/`. The wiring is verified by driving the built page: dialog named
  "The Day", focus inside it, the map labelled, and the live region opening
  with the landing line followed by the ledger.
  Stores are announced in DAYS as well as sacks — "Food 60, 20 days" — since
  a listener cannot glance at the winter mark to work out what the number is
  for.

- **2026-08-09 — A jarl is owed (audit item 9)** — 6.4 made the jarldom
  endless on the argument that an endgame reached is not an endgame
  finished. The audit then counted what actually CHANGED when the Thing
  carried, and the answer was five things: three points of word, two of raid
  fame, the Thing closed behind you, a line on the band page, a different
  title on the last screen. **Every one of them makes the game harder.**
  Ruling was a difficulty setting with a name on it.
  Two halves, both paid out of STANDING — so the coast the player spent the
  whole run building is the thing that pays for the endgame, and a jarldom
  won by frightening everybody is worth the title and not much else.
  **A jarl is owed.** Every season each neighbour glad of him sends a
  portion, food and timber, scaled by how glad. Below `TRIBUTE_FLOOR` they
  acknowledge the title and send nothing — and the saga says so: *a title is
  not the same as a following.*
  **A jarl draws men.** `JARL_DRAW` multiplies item 3's draw. This is also
  the game answering its own escalation: being proclaimed brings harder men
  over the ridge, so it had better bring more hands to meet them. Before
  this it brought only the harder men.
  One thing had to change for either to be worth anything: **a jarl is not
  forgotten while he is still jarl.** Tribute is paid out of standing and
  standing bled 0.12 a day into indifference, so the one band in sixty that
  ruled a hundred and eighty days was owed nothing by anybody by its second
  season. Goodwill now holds while the rule does; ill-will still cools,
  because a grudge against the man who rules the coast is a harder thing to
  keep up than a liking for him.
  Measured on a controlled fixture rather than in play, and deliberately:
  the endgame is reached about once in sixty sagas, so play offers a sample
  of ONE and any bar on it would be a coin. The bar is that the same
  steading, over three seasons, takes in measurably more with the title than
  without — which before this commit it did not, by a single unit.
  Two probe bugs on the way, both mine and both the same mistake in
  different clothes: **measuring the stock instead of the flow.** The play
  probe read zero tribute across a jarldom that had in fact rendered seven
  times, and the fixture compared woodpiles after three seasons when a
  steading burns what it is given. Neither was a finding about the game.
  The proclamation card now names what ruling brings as well as what it
  costs. It only ever named the cost, because the cost was all there was.

- **2026-08-09 — A cause is not a diagnosis (audit item 8)** — The item
  asked whether a death table three-quarters made of despair and hunger was
  the survival game working or three systems collapsing into one. It was
  neither. It was **one system wearing three names.**
  Nobody had ever recorded the STATE at the moment a run ended, only the
  label. Doing that: of thirty runs ending in despair, **twenty-eight had an
  empty larder the day before, averaging one food between them.** They had
  not stopped listening to each other. They had not eaten for weeks, and the
  last thing to go was the wanting to.
  This is not a small correction. "Despair ends more runs than hunger, cold
  and steel put together" has been in this document for three audits. It
  sent three separate sweeps of the morale levers — winter sickness,
  bereavement, kin grief — every one of which moved nothing, and it is a
  large part of why the kin system was built. The lever kept not moving
  because the thing it was aimed at was not there.
  A band that breaks with nothing in the store is now told it starved,
  because that is what happened and it is the thing they could have done
  something about — the death table is the player's only feedback on what to
  do differently, and it was telling most of them to manage morale when the
  answer was food. Despair keeps the case it was always FOR, and it turns
  out to be a real and rather good one: fed, and out of heart anyway. In
  sixty sagas it happens twice, late — day 144, twenty food on the shelf,
  five people still alive and five points of heart between them.
  The table, honestly: **starved 48, slain 7, frozen 2, despair 2**. A
  survival game about a winter mark, which is what this one says it is, and
  now says on the last screen.

- **2026-08-08 — Three ways to play, and the one we measure is the worst
  (audit item 7)** — The project has claimed since phase 4 that there is
  more than one way to play and had never tested it, so the claim was worth
  what "0 made a friend" was worth before anybody counted. The bot's
  opinions — site standards, build order, job mix, whether it trades,
  whether it goes out under arms, what it keeps back before it does — are a
  `Policy` now instead of constants scattered through it. The settler is
  exactly what the harness has always been, so every other figure still
  means what it meant.
  Over thirty landings each: **turtle 25/30 springs, raider 20/30, settler
  16/30**, and on second winters 20, 11 and 5. All three are playable and
  the test bars that; what it will not bar is that they are equal, because a
  game where every line pays the same is a game where the choice is
  decoration.
  The uncomfortable part is the ordering. **Staying home wins**, by a wide
  margin, and the settler — the only policy that goes out, and the one every
  number in this document describes — comes last. That is now the biggest
  open design question in the project, and it is recorded in the head of
  this file rather than quietly fixed.
  Two faults found on the way, both of them mine and both of the same
  family: **a strategy tested with another strategy's assumptions is not
  tested.** The raider was first given a settler's site standards, holding
  out for good ground when the whole point of him is that he does not care
  what the soil is like — that measured the delay, not the raiding, and read
  3/30. And the armed errand demanded ten days of the steading's own eating
  on top of its nine food of provisions; measured across a thousand
  target-days that buffer was met **zero times for any policy**, so going
  out under arms could not happen for anybody at all. It is a per-policy
  number now: a settler keeps a cushion because he has a steading to feed, a
  raider does not.
  And one real design coupling, which took the raider from unplayable to
  playable: **the knowledge economy gates the plunder economy.** Item 1
  hands the country out over a trading counter, so a band that will not
  trade is blind — the raider knew 0.11 of four places against the settler's
  0.47 and could not launch one armed errand. The game has had an `explore`
  purpose since 4.2 that no bot ever used; teaching it took him to 0.40 and
  seventeen errands. That trade should be the only road to knowing your own
  coast is worth a second look.
  Curve 57/27/7 under the settler default, unmoved.

- **2026-08-08 — The probe, kept (audit item 6)** — The generalisation of
  the whole audit. The coast, the country, the sea, the growth apparatus and
  the top building tier were each built, unit-tested and green, and each
  unreachable. Not one failed a test, because every test asked *does this
  work* and none asked *does anyone ever get here* — and each was found by a
  throwaway probe that was then deleted, which is precisely how the next one
  would have hidden.
  Two halves. **Play-reach**: one standing test that runs sixty sagas and
  reports the deck, the lore, the traits and eleven systems, barring the ones
  that must never read nought. Some of it already lives closer to what it
  measures — battle verbs, buildings, the sea, growth — and this is the rest
  plus the summary nobody has to assemble by hand.
  **Static gates**: the existing card lint checked terrain and seasons and
  left the gates that name things by ID unchecked, which are exactly the ones
  that fail silently. This project has already lost a build entry to
  `farm-plots` where the building is `farmplots`. Now every `when` naming a
  building, a lore or a flag must name one that exists, and — the cheap check
  that is impossible to see by reading — no card may require a flag that only
  that card sets.
  Latest reading: deck 86/102 drawn over 671 draws with the top ten at 36%,
  lore 6/6, traits 10/10, and `fights 152, raids 49, raidsHeld 16, sackings
  29, bargains 52, markets 11, expeditions 12, arrivals 54, feuds 17,
  thingsCalled 3, kinPairs 60`.
  The deck is reported rather than barred at 102/102: cards are gated on
  states an ordinary run may never enter, and demanding every one draw is
  demanding the sample cover every corner of the game. What is barred is that
  three quarters of it comes up and that ten cards are not half the draws.
  One thing the fixture caught immediately, which is the point of it:
  **markets fired twice in sixty sagas** — a system shipped an hour earlier.
  The bot's rule wanted the band to be short of what was on offer AND long on
  what it cost, which is narrower than any player is; standing at a counter
  with something to spare is enough. Two became eleven, and the bar has room
  under it now instead of being fitted to a coin.
  Curve 57/27/7, unmoved.

- **2026-08-08 — Pricing the raid cliff (audit item 5)** — The oldest open
  question in this document, deferred three times for want of a trustworthy
  instrument. Measured properly it was worse than the audit had said: **40
  raids came and 2 were held**, and of the 26 sagas that lost one, **20 were
  dead within thirty days**. Not a brutal late game — a coin that always
  lands the same way.
  It was not a design choice anybody had made. It was three faults.
  **First, the defensive buildings were priced backwards.** Raid difficulty
  reads `built.length * 0.4` for looking worth robbing against
  `defence * 0.18` for being warned — so a palisade cost 0.4 for being
  another roof and returned 2 × 0.18, a **net +0.04**. Building a palisade
  made raids harder. A watchtower was +0.22, plainly harder. Only earthworks
  helped, and only because it replaces rather than adds. `DEFENCE_PER` is now
  0.5 and the watchtower is worth two points instead of one, so the things
  whose whole purpose is defence pay for themselves.
  **Second, difficulty added a whole raider per point** against a steading
  defended by about four people — a 25% swing in the odds per point, which
  left nothing for the palisade, the watch and the site to move. Halved for
  raids only; the open field is fought by a full warband on ground nobody
  built and the arena in `wall.test.ts` is tuned against it, so it is
  untouched (32/60 wins, unmoved).
  **Third, and this one was mine: the defending bot climbed its own
  palisade.** The move scorer knew about gaps and shoulder-mates and nothing
  about `WALL_EXPOSED`, so a band under attack walked onto the stakes — one
  hand on the wood, no footing, three easier to hit, the exact tile the wall
  exists to put the raiders on. That fault alone was worth 20% to 33% of
  raids held.
  Measured after: **16 of 49 raids held in play against 2 of 40**, and the
  gauntlet is monotonic for the first time — 12/24 at d0, 10/24 at d1, 7/24
  at d2, 5/24 at d3. Easy raids are usually held, hard ones usually are not,
  and every step down costs something. `test/raid.test.ts` now reads walled
  5 held / 48 alive / 299 stolen against open 1 / 37 / 648, so eight timber
  and a week of somebody's hands finally buys something.
  The gauntlet's bar changed shape to match: it barred the RATE, which a
  cliff sails straight over, and now bars the GRADIENT. Its cells went from
  eight samples to twenty-four, because eight read d1 1/8 against d2 4/8 —
  a coin, not a curve.
  Two fixtures moved with it. `buildings.test.ts` asserted the watchtower's
  old one point. And `raid.test.ts` capped its own loop at 900 apply calls,
  which was fine while defenders died in fifteen rounds and ran out
  mid-fight now that a walled steading stands for forty — resized off
  `ROUND_LIMIT` rather than guessed.
  Curve 58/27/7, unmoved.

- **2026-08-08 — The tier nobody asked for (audit item 4)** — The shortest
  entry here and the one with the sharpest lesson. The audit found
  `greathall` and `earthworks` never raised once in sixty sagas, and asked
  whether the timber cost or the prerequisites were out of reach of a band
  that survives.
  **Neither. Nothing was wrong with the game.** `standsFor()` had been
  written for the tier, `buildBlocker` enforces `replaces` correctly (a
  great hall needs a longhouse standing to replace, earthworks a palisade),
  and the Build panel offers both properly. The bot's `WANT` list — ten
  buildings, hand-written — did not contain them, so across sixty sagas
  nothing ever asked for one.
  Two names added to a list. The result: **every building the game ships is
  now raised in play**, and of the six sagas that stood past day 169, six
  built a great hall and five raised earthworks. The tier was always
  reachable; the measurement was simply never pointed at it.
  A permanent bar now asserts that no building goes unbuilt across sixty
  sagas, and that a band standing two winters outgrows its first longhouse.
  It is the buildings' share of the content-reach fixture the audit asked
  for as item 6, landed early because this is exactly what it is for: **a
  building nobody builds is content that does not exist, whether the reason
  is the cost, the gate, or a list in the harness that forgot it.**
  One thing checked and cleared while in there: eighteen sagas have a
  watchtower against ten palisades and six earthworks. The two missing are
  not a broken prerequisite — a lost raid burns a building, and a palisade
  can go up in smoke long after the tower on it was finished.
  Curve 58/25/7, unmoved.

- **2026-08-08 — The door that was never opened (audit item 3)** — Phase 6.2
  built `capacity`, `crowding`, hands who work but do not fight, the
  repeatable búð and a whole leaving system, and then shut the front door.
  The probe named it exactly: an average of **9.8 beds a settled day with
  5.2 of them standing empty**, four people arriving across sixty sagas, and
  the band **never once exceeding the six who stepped off the knarr**. The
  four joining event cards — total weight 15 in a 102-card deck, three of
  them gated on goodwill or anger — were drawn twice in sixty sagas.
  So the diagnosis was not the one the item expected. Room was never the
  constraint; the **asymmetry** was. `maybeRaid` has rolled every single day
  since 3.5 to see whether somebody comes over the ridge to take what you
  have, and nothing has ever rolled the other way. The coast could only
  subtract.
  `maybeJoin` is the mirror, rolled beside it: a steading draws people for
  what can be seen from outside — **plenty** in the store, standing on the
  coast, winters behind it, and what has been raised — less what a coast
  that wants you dead takes away. Room and larder are FLOORS rather than
  terms: a hall with no bed takes nobody however famous, and a mouth you
  cannot feed is not growth, it is company while you starve. The larder is
  counted in DAYS so it scales with the band; a flat number was the first
  cut and shut the door on 45% of settled days while a hall of ten with the
  same sacks counted as comfortable.
  One term was dropped after measurement rather than tuned: morale read
  **0.97 on average** across sixty sagas, which is not a term, it is a
  constant with a sum wrapped round it. Plenty replaced it, and does the
  early work — every other term needs winters already stood, so the first
  cut only granted growth long after it was needed.
  The rate was swept on the figure that matters, the peak band a saga that
  saw a SECOND WINTER ever reached: 0.06 gave 6.8 with ten bands getting
  there, 0.10 gave 7.4 with eight, 0.16 gave 9.0 with only five. Past 0.10
  growth eats its own — hands are mouths first and hands second. Settled at
  **0.10**.
  Measured: 68 arrivals over sixty sagas against 4, thirteen bands passing
  six against none, and second-winter bands peaking at **7.4**. The new bar
  asserts the peak band, not the arrivals — four arrivals was already
  non-zero and told nobody anything. Curve 58/25/7 against 63/28/7, inside
  the noise floor and in the direction more mouths should push it.
  **And it broke item 1's sea bar, which is the honest part of this entry.**
  A band with more mouths trades far more than it raids — 22 trading errands
  against 4 under arms — so the armed errand halved and the strandhögg count
  fell to nought. Two of the bot's food gates turned out to be calibrated for
  a band of exactly six (`+55`, `+40` in sacks) and are now counted in DAYS
  the steading can feed itself, which fixed the errands; doubling the sample
  to a hundred and twenty sagas moved the strandhögg from three to four, so
  the shortfall is the errand RATE and not the sample. The bar came off it.
  `test/strandhogg.test.ts` still proves the verb end to end and the bot
  still takes it wherever it is legal, but **whether an ordinary player ever
  reaches a strandhögg is now an open question**, and it is the unfinished
  half of item 1 rather than something item 3 fixed.

- **2026-08-08 — A town you can trade with** — Reported from a phone, and
  the screenshot said it better than any audit could: a band standing on *a
  trading town* — "jetties, warehouses, and a watch that is paid to be
  awake" — with an Act panel offering **Fall on the town** and nothing else.
  Every fixed place in the game was a thing to be robbed, including the two
  whose own descriptions are about people who would rather sell you
  something. Neighbours had barter from 4.3; places never got a counter.
  Places can now keep a **market**: a list of offers, in `data/places.ts`, so
  a new one is a new entry and never a change to the engine. The town deals
  both ways (10 food for 16 timber; 20 firewood for 10 food) and the house
  of the White Christ sells bread for firewood, which is the door a band with
  a full woodshed and an empty larder has never had. A market is repeatable —
  it is not a thing you use up — and it survives exactly as long as your
  patience does: **steel ends it**, because a place you have emptied has
  nobody left to deal with.
  Prices at a place are FIXED, where a neighbour's move with their opinion
  of you and the wits of whoever carried the sack. That is the difference
  between a market and a haggle, and it is also what makes the arithmetic
  checkable — a lint asserts that no counter pays for standing at it: buying
  and selling the same goods on one hex must lose on the spread (1.6 out
  against 0.5 back, a fifth gone per round trip). Cross-place loops are
  deliberately NOT policed: the legs are hexes apart and a band walking
  between them eats more in provisions than any spread returns.
  The bot learned it in the same commit — short of one thing and long on the
  other, standing on a counter, it deals rather than draws. Curve 63/28/7,
  unmoved. Trading also carries the coast's news, so a day on the jetties
  names a place the same way a bargain in a yard does.

- **2026-08-08 — What the four verbs are worth (audit item 2)** — And the
  first thing to record is that the audit was partly wrong. Three verbs were
  genuinely unmeasured — `B_SHOVE`, `B_DEFEND` and `B_DASH` appeared only in
  `battleActions.test.ts`, which proves the mechanics work and says nothing
  about whether anyone should ever use them — but `B_THROW` was already
  played by the arena bot and by `raid.test.ts`. The true finding is
  narrower and still real: it was unmeasured in a whole SAGA, not in a
  fight. The grep behind the claim only looked at `test/balance.test.ts`.
  The first instrument was wrong too. Measured on the survival curve, the
  four verbs together LOOKED harmful — 11 bands seeing spring falling to 8 —
  but the curve ends only about one run in six on steel, so a verb worth a
  win a fight drowns in starvation and despair. The arena in
  `test/wall.test.ts` is the sensitive instrument, and on sixty seeds it is
  unambiguous:
  `none 33/60 wins, 162 standing · shove only 32/158 · defend only 33/162 ·
  dash only 22/108 · as we play 32/158`.
  Shove and defend are neutral: narrow tools that fire rarely and correctly
  (27 shoves and 129 shields over thirty sagas). **Dash costs a third of the
  wins and a third of the survivors** — and that is not a bug, it is the
  game's central rule enforcing itself. Spending the turn's action to arrive
  sooner means arriving ALONE and arriving having already acted, which is
  exactly the charge `wall.test.ts` exists to price. A shield wall does not
  sprint. So the bot does not dash, and the A/B is kept executable as the
  standing record of why: the day dash stops being a trap is a day somebody
  finds out.
  Two bars added. The arena test asserts the verbs the bot uses cost it
  nothing and that dash remains plainly worse; the saga harness asserts every
  verb an average player would issue actually gets issued over thirty sagas,
  and that `B_DASH` stays at zero. Each of those counts read ZERO before
  this work.
  Two of my own bars had to be loosened, and the reason is worth more than
  the bars were. Item 1's sea test pinned `seaDays > 20` and the long game
  asserted late foes per fight against early — both fitted to the sample
  they were written on. Battle actions consume RNG, so ANY change to how the
  bot fights reshuffles every draw after it: sea days moved 50 to 17 and the
  late-fight sample fell to five, with nothing about the sea or the
  escalation changed. Across the same A/B the STABLE figure never moved —
  second winters read 12/40 in every arm. So the sea bars now say REACHED
  rather than pinning a rate, and the escalation claim moved out entirely:
  `test/word.test.ts` proves it knob by knob, including that each one binds,
  which is where a claim like that belongs. **A bar fitted to the sample it
  was written on is a bar that fails the next honest change.**
  One harness bug found and fixed on the way: two of the three new rules were
  pasted into the BRAWLER rather than the formation bot, because the
  edit matched its first occurrence. It showed up as the control arm moving
  when only the treatment had been touched — brawl going 29/140 to 20/97
  while `brawl()` was untouched — which is the clearest possible signal that
  a measurement has been contaminated, and worth naming: **when the control
  moves, suspect the edit before the finding.**
  Curve: 62/28/7, against 60/25/7 before — inside the noise floor, no
  regression.

- **2026-08-08 — The country becomes reachable too (audit item 1)** — The
  item said "teach the bot to sail". Doing that changed almost nothing —
  1 errand under arms in sixty sagas — and the diagnosis was the same
  disease as the coast, one audit later and in a different costume.
  `seedPlaces` gave every kind a floor on how near the landing it could be
  seeded and no ceiling at all, so across forty worlds the monastery, town,
  wreck and iron seam sat a **median of 30 hexes from the sand and as far as
  52**. Measured in play: 4.00 places still standing per settled day, and
  **0.06 of them ever seen**. The whole plunder economy, the reason the
  knarr exists and the only thing a settled band can go OUT for were placed
  where nobody would ever look.
  Bounded at 16 hexes — a little further than the neighbours' 13, which is
  right: a neighbour is somebody you deal with, a monastery is somewhere you
  go. But a ceiling alone is not enough, and here the fiction had to differ
  from the coast's: clans can be made to come and look at a new steading, a
  monastery cannot walk over. **Word of it travels instead.** Every bargain
  now pays twice — timber into the packs, and one place on the map, nearest
  to the teller first, named while the goods were being weighed. That gives
  the plunder economy a road into it that is not "walk two hundred hexes and
  hope", and gives standing a second thing to buy.
  The bot learned the rest in the same commit, as the rule requires: the
  errand under arms, steering for the water beside a coastal prize, coming
  out of it, and mending a holed hull ashore. Two constraints on it that are
  right whatever they do to the numbers — only in the growing half of the
  year, and only for something close enough to be a raid rather than a
  voyage — because the first cut sent three of six away for twenty-four days
  through autumn, which no average player does.
  Sea days **3 → 50**, strandhöggs **0 → 2**, errands under arms **1 → 7**,
  places known per settled day **0.06 → 1.17**, all over sixty sagas. A new
  bar in `test/balance.test.ts` holds every one of those above zero.
  The Chart gained the fixed places too, which was not on the item and had
  to be: a trader who names a monastery and leaves it off the map has told
  the player nothing they can act on — the same "found but not findable"
  trap the coast fell into, caught this time before shipping. Ringed marks,
  hollowed once a place has been picked clean, with legend rows beside the
  neighbours.
  **What it cost, honestly:** the curve reads 60/25/7 against 67/30/8.
  Isolated by measurement — with the new world and the OLD bot it reads
  identically, so none of it is the sea errand; it is that a coast with a
  garrisoned town actually on it is harder than one with the town thirty
  hexes away. Pre-settlement fights went 37 → 47 and deaths 53 → 64 across
  forty sagas. Two attempts to buy it back were tried and rejected: gating
  the plunder detour on the calendar moved nothing, and pushing the place
  floors out made the fair country WORSE (55%). Seven points on sixty seeds
  is inside the ±10 this harness declares it cannot resolve, and the
  project's own rule is not to tune on it. Recorded rather than chased.

- **2026-08-08 — The coast becomes reachable, and winter keeps its teeth** —
  A re-measure that was meant to confirm the day's work and instead found
  the largest hole in the game. The long-game harness reported the same
  line for both difficulties: `0 made a friend, 0 could ever call it`.
  Forty sagas had raised mead halls, kept the peace and stood two winters,
  and not one had met anybody.
  The cause was placement. Neighbours were kept at least six hexes off the
  landing and no further away than *anywhere* — on an 1872-tile landmass
  that put them 6, 12, 26 and 27 hexes from one steading and 23, 24, 25 and
  38 from another, against a band that sees 2–7% of the map in five hundred
  days. Standing, barter, tribute and the friend a jarldom needs were all
  real, tested code nobody could get to.
  Three fixes, one idea: **the coast has to actually be a coast.** A ceiling
  of thirteen hexes, so "neighbour" means about a week's walk. Neighbours
  now come and look at YOU — one a fortnight after the posts go in, nearest
  first, each with a line in the saga and a marker on the chart, because
  being found is how it actually goes and hunting for somebody's exact hex
  is a search problem the player has no tools for. And a raid names whoever
  sent it: the tracks go back the way you thought they would. A walkable
  coast means camps near the landing, so founding inside a two-hex elbow is
  refused — measured at 2/203 landings boxed out at an elbow of 0, 1 or 2,
  and 3/203 at 3.
  Result: 31 of 32 clans met, standing worked up to 89, and the endgame is
  reached at last — 5 jarldoms across 40 sagas where there had been none.
  The same re-measure then condemned yesterday's own fix. `SHELTER_SAVES`
  had been raised 0.5 → 1.0 on survival numbers alone, and a second reading
  showed what it cost: `SHELTER_MAX` is 6, so at 1.0 a fully built steading
  cancels an ordinary winter's burn outright. Over 24 winters, heeding the
  winter mark against ignoring it read 19/6 at 0.7, 19/8 at 0.8 and **19/17
  at 1.0**. Preparing for winter had stopped mattering — a worse game than
  a hard one. Settled at **0.8**: a full roof takes four-fifths off an
  ordinary night and nothing like all of a deep one.
  Two fixtures were measuring on eight seeds and one-seed margins; both
  widened to 24, and the wheel test's survival claim was rewritten to the
  effect that is actually large (nearly 4× the timber home).
  Finally, the default difficulty moved to **A Fair Country**. "As It Lies"
  is exactly what it says and stays the terms everything is tuned against
  (`BALANCED_HARDSHIP`, kept deliberately separate from the menu default so
  a UI change can never silently move every fixture in the suite) — but the
  long game measured what those terms produce: 86 days a saga and one band
  in twenty ever ruling. On A Fair Country the same forty sagas ran 161
  days, raised 13 mead halls and put 3 jarls on the coast. The hard truth is
  one menu tap away rather than the price of admission.
  Curve: 67% / 30% / 8% see the first spring. All 686 tests green.

- **2026-08-08 — The strandhögg** — Item 8, and the last of the audit's
  additive half. The sea already had a hull that could be holed, cargo that
  could go over the side and hull-to-hull fights on authored decks — but
  every VERB that mattered was still a land verb, so rowing was walking on
  water. This is the one the period actually ran on: afloat beside a
  guarded place, the band can come out of the water at it instead of
  walking up the road.
  It earns its place by being a different bargain rather than a re-skin of
  the same one. Nobody watches the water the way they watch the road, so
  the garrison is a man lighter and starts shaken by 25 nerve. The hold
  takes half again what backs could carry. But the coast remembers a sail
  longer than it remembers men — the standing hit is 1.5×. And there is no
  line of retreat off a beach: lose, and it settles as a sea fight does,
  packs over the side and the hull holed getting clear. Better if you win,
  much worse if you do not, on the same target.
  Nine tests, including the two that keep it honest: it is never offered
  from dry land or against a place with no garrison to surprise, and the
  reduced garrison has a floor so the deed can never become a free take.
  The bot takes the ship's way in the same commit whenever it is afloat
  beside a mark with four sworn still standing. Curve 77/22/10, unmoved.

- **2026-08-08 — Kin** — Item 7. Every deaths-by-fate reading this project
  has taken says the same thing: despair ends more runs than hunger, cold
  and steel together. The game has always killed through grief; it had just
  never said WHOSE. Two pairs among the six who come off the knarr are now
  bound — brothers, sisters, a husband and wife, a father and son when the
  ages allow it — and the warband page names them: "Vemund and Thorgeir —
  Thorgeir is brother to Vemund."
  Losing one takes a third of the other's heart, on top of what losing
  anyone takes out of the band, with a saga line that says which loss it
  was. On the field, kin falling shakes the survivor from ANYWHERE — you
  do not have to be stood beside your brother to see him go down. Both are
  hooked at all five places a member of the band can die, explicitly and
  without a clever central hook: a death that forgets to mourn is a bug
  found months later.
  Gender is DERIVED rather than stored. makePerson already decides it to
  pick a name and throws it away, and the two pools are disjoint — asserted
  by a lint, because that assertion is the only thing holding the derivation
  up. No new field, no migration to reconstruct what was in plain sight.
  Two existing fixtures had to learn about it, and one of them mattered:
  wall.test's nerve comparison read 33.75 against 35 the day this landed,
  because its "stranger" sometimes happened to be the observer's brother.
  That file measures what the WALL is worth, so its fixture now makes
  strangers on purpose — a test that measures the wall plus a coin flip
  measures neither. Curve 77/22/10, unmoved. SAVE_VERSION 26; an older band
  comes forward as strangers, because inventing families retroactively
  would rewrite a run's history.

- **2026-08-08 — The long game, finally measured** — Item 9, and it earned
  its place in the first ten minutes. The curve harness stops at day 169 and
  a jarldom needs two winters plus a Thing, so the endless jarldom, the
  returning champion, the building tiers and the escalation meant to answer
  them had all shipped with no measurement past the second winter.
  Getting there needed the bot to learn the whole endgame it had never
  played: barter, the Thing, and ruling on. Then the first reading came back
  empty — fourteen sagas, none reaching jarl, and the diagnosis line said
  why: SIX raised a mead hall, zero. Runs were dying at day 259 with a
  hundred and sixty firewood on the pile and NOTHING built.
  The cause was in the harness, and it is the fourth of its kind this file
  now documents. The bot's "heed the winter mark" rule reassigned every last
  person to food and wood every day the mark was visible — which is most of
  the year — so the builder was wiped before ever finishing anything. A real
  player with wood to spare does not put the whole hall on the woodpile. One
  line keeping a builder while anything is on the stocks, and the endgame
  opened: 6 mead halls, 2 jarldoms, 3 winters ruled, sagas reaching day 392.
  With that, the word system's oldest claim is checkable for the first time.
  Foes per fight: 4.3 before day 169, 7.4 after. The coast really does get
  harder with the years, and there is now a test that fails if it stops.
  The honest cost: the curve moved 78/25/12 to 77/23/8, inside the ±10 this
  harness resolves — a bot that spends a pair of hands on building survives
  a little less, and measures a great deal more. Also recorded, because it
  is a design finding and not a bug: on the balanced terms this run returns
  fourteen sagas averaging sixty-two days with no fight after day 169 at
  all. The long game is run on the gentle country because that is where
  bands live long enough to have one.

- **2026-08-08 — The watch mark** — Item 6. Winters stood, buildings raised
  and a full store pushed raid-chance up invisibly, while the wall and the
  watch pushed it down invisibly, so defending the steading was guesswork
  dressed as strategy. Now a panel names it: "A raid about every 194 days",
  and under it every term with its weight and its reason — what is in the
  store +3.0, a full store travels well; the wall −1.1, ground they have to
  come at.
  Built to the rule that makes the winter mark trustworthy: the panel is not
  a second model. `threatReading` computes the terms AND the chance, and
  `raidOdds` is now that one field, so a panel disagreeing with the dice is
  impossible rather than merely unlikely — asserted with `toBe` across
  twenty-seven situations, not `toBeCloseTo`. A further test proves every
  row the panel shows actually moves the number the panel shows, because a
  displayed-but-inert row is worse than no panel: it teaches the player to
  spend on nothing.
  One branch was written and deleted before shipping. The panel was going to
  say "as bad as it gets" at the ceiling — and the test fixture could not
  reach the ceiling: nine winters, ten buildings, a full store and a coast
  that hates you reads 0.021 against a 0.055 cap, about fifty-five winters
  short. Dead UI, so it went, and the finding is a test now so the next
  person to look at RAID_CHANCE_MAX knows it is a guard rail rather than a
  target. 661 tests.

- **2026-08-08 — Buildings grow upward** — Item 5. The late tier and the
  repeatable búð answered "the queue must not end" horizontally; this is
  the vertical answer. A great hall REPLACES the longhouse — pulled down
  and raised again twice the length, five shelter against three, twelve
  beds against six — and earthworks replace the palisade, four defence
  against two. The old building comes down as the new one goes up and
  takes its grants with it, so a surplus has somewhere to go that is not
  another hut.
  The whole risk in tiering is that six places in this codebase ask "is
  there a palisade here?" BY NAME — the raid battlefield's wall, the
  Thing's mead hall, what a sacking may burn, the steading renderer, and
  two event cards. An upgrade that removes the palisade silently answers
  no to all of them, taking the wall off the battlefield and switching off
  content, with nothing failing. So `standsFor` asks by ROLE — a great
  hall IS a longhouse, earthworks ARE a palisade — and every one of those
  reads goes through it, with a test that fails if a tier stops doing what
  it replaced.
  The scarcity bot then found the other half by itself: its build order
  came out "...watchtower > greathall > longhouse", because an upgrade
  removes its predecessor and the panel duly offered to raise another one,
  forever. What has been superseded is never offered again. Curve unmoved
  at 78/25/12; 652 tests.

- **2026-08-08 — The second rank** — Item 4. The shield wall had an inside
  and an outside in name only: a six-wide line on a seven-wide field always
  has somebody stood behind somebody, and those men could do nothing but
  wait for a gap. Now a fighter with a living shield-brother between him
  and a foe can put a spear past him at two hexes. The rule is POSITIONAL
  and not equipment — no man in front, no thrust — so it needs no item
  system and it means what a formation means.
  The trade is honest: harder to land (−1 to the roll), lighter when it
  does (−1 damage), and a miss that does nothing at all where a proper
  swing would at least have chipped a shield. That is what standing where
  nothing can hit you costs. Symmetric for foes, and their AI thrusts from
  its own second rank — a formation trick only the warband can play is not
  a formation, it is a bonus.
  Measured against the bar this item set itself, with BOTH bots carrying
  the spear so the comparison is about where a band stands rather than what
  it was issued: the formation-vs-brawl gap went from 38/60 wins and 170
  standing against 35/60 and 165, to 33/60 and 159 against 29/60 and 138.
  Five bodies of advantage became twenty-one. Both sides fall further in
  absolute terms because the foes got spears too, and the curve took it
  without moving — 78/25/12 against 82/27/7, inside the ±10 this harness
  resolves. The death table names it in the game's own voice: "took a spear
  and did not get up, 8".
  The Spear button appears only when there is genuinely a mate to thrust
  past, because a button that is always there teaches the player it is a
  weapon rather than a position. Eleven tests in test/reach.test.ts; the
  harness bot fights from the second rank in the same commit.

- **2026-08-07 — Three countries, and every one of them measured** — Item 3.
  A Fair Country, As It Lies, A Hard Country, turning four knobs the harness
  already reads: what finds you on the road, how often they come for the
  steading, what the fire costs in deep winter, and what came off the knarr.
  Deliberately no further in — a difficulty that reached into the dice of a
  fight would make the shield wall mean something different at each setting,
  and then no measurement of the wall would mean anything at all.
  The names are earned rather than asserted. The harness runs all sixty
  seeds through every setting: 75% / 27% / 10% see the first spring, and the
  title screen quotes it — "Three bands in four saw the first spring." The
  first cut of the gentle setting read 33% against 27%, a six-point gap that
  is inside the ±10 this harness can resolve, so it was strengthened until
  the difference was real; the test now asserts a TEN-POINT margin rather
  than mere ordering, because a setting called kinder that is only
  noise-kinder is exactly what an unmeasured difficulty ships with.
  The terms ride on the RUN, not on the device: a saga carries the country
  it was played in, and a shared seed means the same game to two people.
  Settings shows it and will not edit it — changing the terms is what the
  next landing is for. 'even' is pinned to 1/1/1/1 by test, so every other
  measurement in this repo keeps its meaning. SAVE_VERSION 25; old saves
  come forward as 'even', which is what they were played on. Nine tests in
  test/hardship.test.ts, one per knob, each checking the number the player
  actually meets — this project's oldest bug is a knob a clamp downstream
  throws away.

- **2026-08-07 — The mark learns to say the one thing it never could** —
  Item 2, and it began as a measurement because the complaint arrived as a
  photograph rather than a number. Holding the bot off settling until a
  given day and then playing it out: settle by day 16 and 21% see spring;
  by day 24, 13%; by day 29, 4%. The cliff is real and it is around the
  turn of autumn.
  So the mark now answers the question it was silent on. `reachable()`
  projects the stores forward to the thaw, day by day, letting the band
  move between hunting and cutting as each day demands, and assuming a
  roof it has not built yet — a deliberate CEILING, so "lost" means lost
  even at the best the band could manage. When it is out of reach both the
  travel mark and the steading's needs panel say so plainly, in blood, and
  name what is left: take it from somebody else, or walk out and winter
  elsewhere.
  Three wrong versions were measured and thrown away before this one, and
  each is written into the comments so it is not tried again. Building the
  check on `forecast` was the first: the forecast floors each day's surplus
  at zero — correctly, a mark that spends an imagined autumn lies — so it
  never credits the productive days ahead and called a healthy day-10 band
  doomed. A projection under one FIXED food/wood split was the second: no
  single split survives a year, so it condemned 62 of 63 settled bands, a
  verdict indistinguishable from "you have a steading". And the first
  VALIDATION was wrong too — asking "did it ever fire" catches any band
  having one bad week. Read once, on the first autumn day at home, the
  verdict is worth having: 49 bands told they were lost, 40 died (82%); 6
  cleared, none died. The 18% told they were lost who lived did it exactly
  the way the message says — by taking it from somebody else.
  Curve unmoved at 82/27/7, because this is a panel and not a knob.

- **2026-08-07 — The Old Wolf comes back** — Next-queue item 1, and the
  half of the old item 6 that did not land. A raid's champion now BELONGS
  to the clan that sent it: he is stamped onto that neighbour the moment
  he sets foot on the field, so a mid-fight save knows whose man he is.
  Put him down and he is gone for good — the clan loses its leader and the
  saga says so, which is what makes hunting the blood pennant worth a blow
  that could have gone anywhere. Anything else — he fled, he was standing
  when we broke, the fight ended around him — and he walks off with one
  more scar, coming back under the same name and byname, +1 might and +2
  hide per scar, capped at four so he stays killable rather than becoming
  a wall the run ends against.
  Open-field champions still belong to nobody, which is the honest reading:
  nobody sent them, so there is nobody for them to return to.
  Persistence that is never observed is persistence that does not exist,
  so the rhythm test counts it: over sixty sagas, 6 named foes came back
  and 17 were put down for good. The bot hunts the champion for the new
  reason in the same commit. Curve 83/27/7 → 82/27/7, unmoved.
  SAVE_VERSION 24; the returning raid driven in the built page, which
  names him and says he came back.

- **2026-08-07 — Quieter days, and more of them end in steel** — Asked for
  directly: fewer cards, slightly more fights. Two independent knobs, and
  the second is what makes it possible — the base event chance comes down
  0.23 → 0.19, and the eight cards that draw steel have their weights
  raised to 1.8× (66 → 119 of the deck's 911), taking the steel share of a
  draw from 7.7% to 13.1%. Raid cards were left alone; raids have their
  own pressure system and the gauntlet to measure it.
  This knob has defeated the harness before — sweeping the chance through
  0.28/0.34/0.40 gave 53/30/43% at two winters, a swing that went the
  wrong way in the middle — so the survival bars were never going to show
  it. COUNTS are not noise, though, so the harness gained a rhythm test
  that tallies interruptions per hundred days across the same sixty
  sagas, split by where a fight came from. Before: 21.32 cards, 1.76 open
  fights, 1.01 raids. After: 17.25 cards, 2.10 open fights, 1.00 raids.
  Fewer interruptions by a fifth, more fights by a fifth, raids untouched.
  The split earned its keep immediately: the first attempt (weights ×1.5)
  read as fights going DOWN, because a fight is a SHARE of cards and
  cutting the draw rate cuts everything — the share had to outrun the cut,
  not merely rise. Curve moved 78/20/10 → 83/27/7: the early marks are
  easier, which is the honest cost of fewer cards, since the deck nets
  harm; two winters is unchanged inside the ±10 the harness can resolve.

- **2026-08-07 — The build panel was a trap, reported from a phone** — A
  photograph of the Build tab on a real handset: ten rows running off the
  bottom of the screen, no scroll, and no way out of the panel. The hint
  slot was `flex: 0 0 auto` with no ceiling, so it grew to whatever it
  held and pushed the Work/Build tabs and "Back to the land" past the
  viewport — and `#app` has `overflow: hidden`, so there was no page
  scroll to rescue it. Seven rows fit; the late tier made it ten and
  turned a tight fit into a dead end. The fix is general rather than
  per-panel — the hint slot is capped at 62vh and scrolls itself, which
  covers a long crew roster on the Work tab too. Verified at 390×844 in
  the built page: "Back to the land" bottoms out at y=799, and the list
  scrolls.
  The same shot showed two more: every locked row read "needs a longhouse
  first", a hardcoded string that was true of all three prerequisites the
  day it was written and became a lie the day the late tier landed — the
  panel told players the watchtower wanted a longhouse when it wants a
  palisade. It names the actual building now, with a data lint so a typo
  in an `after` id cannot print a blank. And "Under the roof" was folding
  into three lines inside the winter mark's 3.5em label column; the room
  mark gets its own width and is one 18px line.

- **2026-08-07 — No last winter: the jarldom you can go on living in** —
  Item 8, and roadmap 6.4 with it. The Thing carrying no longer writes an
  ending. It grants the rule — `state.jarl`, a name and the day it carried
  — and the game keeps running. The proclamation card offers both answers
  and names the price of the second one: rule on, or close the saga here.
  Whichever is chosen, the closing stays one tap away forever, as a deed
  on the Act sheet, because a run with no ending at all is worse than one
  that ends too early.
  Ruling costs what it is worth. A jarl's hall is the richest thing on the
  coast and everyone knows where it is: +3 to word, +2 to the raider cap.
  Both were checked against this project's oldest bug rather than assumed
  — a knob that a downstream `Math.min` throws away is escalation that
  never happened — so the test rolls forty open-field fights each way and
  counts what actually turns up: 39 huscarls for a nobody, 72 for a jarl.
  The top bar carries the rule in gold ("Ketil the Quiet, jarl — 1 winter
  held"), the Call a Thing deed disappears once won, and the ending counts
  the winters held after the proclamation rather than before it.
  SAVE_VERSION 23; the whole flow driven in the built page. Also widened
  thing.test's settled fixture to fall back to a world-wide search — the
  third fixture the 52x36 world has broken this way, and the last one that
  should have to learn it.

- **2026-08-07 — The build queue stops being a checklist** — Item 7. Three
  late-tier buildings for a steading that has beaten its first winter: the
  storehouse (after the smokehouse, another 15% of what is caught), the
  watchtower (after the palisade, another point of defence) and the hof
  (after the mead hall, standing heart). And one repeatable — the búð,
  which can go up again and again, each one four more beds. That is the
  tail that makes the queue endless: a steading that keeps taking people
  in keeps needing roofs.
  The first cut of the repeatable was UNCONDITIONAL, and the harness
  caught it inside one run: the expedition comparison lost a seed and the
  never-leaving arm went into winter a hundred firewood light, because
  any bot taking the panel's own suggestion poured wood into empty huts
  forever. So a repeatable is gated on the honest reason to raise one —
  `repeat: 'crowded'`, offered only when there are more people than beds,
  and shown on the panel with its reason ("another would stand empty")
  rather than silently vanishing. The seed came straight back: trading 6
  against never-leaving 5, as before. Curve 78/20/10, unmoved. The
  standing line counts duplicates now (Búð ×3) instead of stuttering.

- **2026-08-07 — The bot's offensive half, and a raid number worth reading**
  — Item 10, in two parts. The balance bot now plays the plunder game the
  runs are built around: with five sworn and food to fight on it sacks the
  garrisoned town instead of only the soft targets, and on the road it
  detours up to six hexes to any seen, unsacked place — travel, plunder,
  THEN settle, which is the loop the audit said the game is for. The
  open-field curve did not pay for the aggression: 78/22/12 against
  75/22/12 before it, noise. Second part: the organic 20-saga raid tally
  was proven a coin reading three deck-edits ago (4/33, 23/39, 7/28 with
  no raid change in any of them), so raids-held now has a controlled
  measurement — the raid gauntlet. Same stocked, palisaded steading,
  thirty-two forced raids across difficulties 0-3, bot defending. First
  reading: 11/32 held, and it is a real response curve at last —
  6/8 at difficulty 0 falling to 0/8 at difficulty 3 — in under seven
  seconds of harness time. Tripwires at 20% and 95% overall, wide on
  purpose like every bar in this file. The organic tally stays, asserting
  only its weak invariants; the gauntlet is the number future raid
  tuning reads.

- **2026-08-07 — Named raid leaders** — The men who come for the steading
  stopped being anonymous. Every raid of two or more is led: the toughest
  of them is raised to champion — a point of might and spirit, four more
  health, and a byname out of the heavier pool (Skull-Splitter, the Old
  Wolf, Ship-Burner) — and the raid log names him from the first line.
  The open field earns a champion only once word has spread, on the same
  wordBump threshold that already makes those fights bigger, so the log's
  "They had heard of us" now arrives with the name of the man it drew.
  On the field he flies a BLOOD pennant beside our leader's gold one, and
  he is worth singling out: when a side's leader falls — theirs or ours,
  symmetric on purpose — every man he led takes a 25-point nerve shock
  that no distance softens, wall links damping it as they damp anything.
  The bot hunts the champion in the same commit (prefers him among
  adjacent targets), per the standing rule. Measured after: curve
  75/22/12 against the 72/18/7 of the overhaul — noise; the formation
  bar holds at 38/60 wins, 170 standing against 35/60 and 165. Raid
  tally at 20 sagas read 3/12 held — recorded, not tuned on; that
  sample's day is item 10's. SAVE_VERSION 22; seven tests in
  test/champion.test.ts.

- **2026-08-07 — The combat overhaul: a leader worth following** — The band
  now HAS a leader on the field: the first living sworn — first off the
  knarr, succession by seniority, never a hand — marked by a gold pennant
  on the mast so there is no guessing who. The leader alone carries the
  war-cry, once a fight: heart back into every friend within two hexes
  (capped at where their nerve started), dread into every foe, and the
  horn sounds it. The wall pushes as well as guards — one shoulder-mate
  is +1 to hit, two are +2, symmetric because their line is a line too.
  Misses stopped being dead turns: a whiffed swing glances for a chip of
  one that can never kill — UNLESS the target stands in a full wall,
  whose overlapping shields turn glances aside. That last rule was
  measured in, not guessed: with the chip alone, sixty fights took the
  formation bot's ~15-body survival edge to a dead heat (167 vs 169);
  with the full wall turning glances it stands at 38/60 wins and 166
  standing against 35/60 and 163. And the field finally moves: an
  effects layer that survives repaints draws the blow streak, the hit
  flash, the floating cost, the cry's double ring, and the fall's fade —
  all self-removing nodes, all silenced by reduced-motion or the
  stillness setting. The bot cries the cry in the same commit
  (two-plus foes in earshot, leader's turn), per the standing rule.
  Curve after all of it: winter 72%, spring 18%, two winters 7% —
  within noise of 78/23/10. Twelve new tests in test/leader.test.ts;
  SAVE_VERSION 21. Also caught sea.test pinning a version literal the
  way places.test once did; it asserts SAVE_VERSION now.

- **2026-08-07 — A wider country, and a quieter first week** — Off a phone
  playtest that hit the world's edge on day four. The world grows from
  40x30 to 52x36 — half again the area — with a wider sea
  margin in the west, so open water is somewhere to BE rather than the edge
  of the picture, and the interior is real dark to walk into. Only seen
  tiles are drawn, so the render cost arrives only as the country is
  discovered. Old saves keep the worlds they were born with; only new
  landings get the bigger coast.
  The same playtest called the cards relentless, three days in. Two
  changes: the base event chance comes down from 0.28 to 0.23 — the
  designer's ear outranks a knob the harness has already proven it cannot
  resolve — and the opening is quiet ON PURPOSE: the country takes six
  days to notice a new sail, so the chance ramps from nothing over the
  first week while a new player finds their feet.
  Measured: 78/23/10 against 75/20/8 — the beginning eases a shade, every
  delta inside the noise floor, and the wall-window death table shows the
  early battle deaths thinned exactly as intended. The Thing's
  four-of-four promise holds.
  Two fixture patterns broke honestly and were fixed at the root: helpers
  that only ever tried to settle the LANDING hex (rare on the wider coast)
  now found wherever the world allows, and the stutter guard caught the
  hunger chronicle repeating its plateau line on long starving walks the
  old small world never made possible — the escalation now never says the
  same sentence two days running. 583 tests. Published.

- **2026-08-07 — A place for the switches** — Settings, and everything that
  had been waiting for somewhere to live. A gear sits pinned under the
  horn — outside the mode chrome for the same reason the horn is, so it is
  reachable on the title screen and in all three modes — and opens one
  card: the sound (the same preference the horn flips), the motion, the
  seed, and the two links that had been crowding the title screen.
  Motion is the new capability: the game has honoured the device's
  reduced-motion setting since 5.3, but that is a switch buried in an OS
  menu, and somebody who wants THIS game's screen still should not have
  to still their whole phone. "Kept still" lives beside the mute in the
  versioned preference store and puts a class on the root that the same
  CSS rules read.
  The seed is the other one: it has been the shareable name of a run
  since 4.5, and it was invisible from inside the run. It now sits in
  settings with copy-on-tap.
  The teaching reset and the memorial moved off the title screen into the
  card — and the memorial is reachable MID-RUN for the first time, opening
  in the settings slot and coming back. The title screen ends the day
  holding five things instead of seven.
  Driven in a browser: the gear opens on the title and in a run, the
  motion toggle flips the root class and survives a reload, the sound row
  flips the horn, the seed shows in-run and not on the title, and Back
  closes. 583 tests. Published.

- **2026-08-07 — The game finally says what it is for** — The tutorial,
  diagnosed before it was built: 5.2's nine lessons teach mechanics the
  moment they matter, but not one of them ever stated the GOAL — and
  everything built since 5.2 (places, plunder, hands, the hull, word) had
  no lesson at all. Three fixes, none of them a tutorial screen.
  First, the shape of the saga is now the FIRST lesson: settle before
  winter, stand two of them, call the Thing — said once, on day two, in
  chronicle voice, before the game explains any button.
  Second, a How to Play book: ten short sections covering the whole loop —
  the day, the ground, winter and the mark, the steading, steel, the
  coast, places, the sea, the long game — reachable from the title screen
  and from inside the saga book. Chosen rather than imposed, which is what
  buys it the right to name buttons; 5.2's no-tutorial-screens rule
  stands untouched, and the lessons' byte-identical guarantee still holds
  over the grown set.
  Third, four new lessons for the systems that had none: hands (growth
  buys labour, never a wider wall), places (some worth taking, taken
  once), the holed hull (camp ashore to mend her), and word (fame draws
  harder men, and sackings feed it). The lesson vocabulary gained four
  conditions to carry them.
  Driven in a browser end to end: the guide opens from the title with the
  goal in it, the shape-of-the-saga card fires in play on day two, the
  saga book hands off to the guide and back, no console errors. 583
  tests. Published.

- **2026-08-07 — The map gets the screen** — Off a phone playtest: the
  saga panel sat pinned under the travel map, an eighth of a phone screen
  spent on history, and the map is the game. The chronicle now lives
  behind a Saga button beside Chart and Band, opening as a full card —
  the last hundred-odd entries, scrolled to the newest, one tap to close
  — and the travel map takes the height the panel held. Battle keeps its
  fight log and the colony its footer; only travel changes. The old
  three-line panel renderer is deleted rather than stranded. Verified in
  a driven browser: the panel is gone, the map measures a hundred pixels
  taller, the book opens on the landing line and closes, and the other
  buttons still work. 582 tests. Published.

- **2026-08-07 — The coast learns your name** — The audit's third item:
  the world escalates with the years, everywhere. `sim/word.ts` holds the
  scalar — word of the band, winters stood plus sackings chosen, so a
  quiet band ages into mild fame and a band that robs the coast buys its
  escalation by hand. It reaches open-field and sea fights only; the home
  raid keeps its own machinery, and a sacking already reaches it through
  standing, so no deed is counted twice.
  Three knobs, each PROVEN to bind before anything was measured, because
  this project once spent a day discovering that three escalation levers
  were being swallowed by a Math.min: the difficulty bump is paired with
  a word-grown foe cap so it reaches the field past the old six-man
  swallow (tested: a famous band fights more than MAX_FOES); the
  archetype weights lean huscarl and raider as word grows, which binds
  even at the cap — the same six men, but a harder six (tested: the
  huscarl share rises); and the raid path is tested UNTOUCHED by the
  tally. Word is nought through the whole tuned first year for a band
  that has robbed nobody, and the fight log says "They had heard of us"
  whenever word is why the fight is worse — escalation is never a hidden
  punishment.
  The curve did not move (75/20/8; the Thing's four-of-four promise
  holds), and this time that is the DESIGN: the effect lives in year
  three and beyond, past the harness's day-169 horizon, exactly where
  the audit said the long game went flat. Measuring it properly is 6.4's
  business, when the five-winter guillotine comes off. 582 tests.
  Published.

- **2026-08-07 — The sea gets its teeth** — The audit's fifth item: ships
  stop being a terrain skin. A fight afloat used to be the ocean's random
  ground mix — a meadow fight with a blue background. It is now fought on
  one of three authored decks in `data/seaFields.ts`: two hulls lashed rail
  to rail with no ground to give, a boarding action over locked bows with
  one way across, and both keels on the sand fighting it out knee-deep in
  the shallows. Linted like the raid fields — room for six a side, a line
  four can hold, a way between the decks — and the fight's opening line
  comes off the map itself.
  And the sea finally has stakes. Losing a sea fight puts a third of the
  packs over the side and holes the hull: she still swims, at half the
  pace, baled as much as rowed, until a night camped ashore and two of
  wood put a sound strake over the sprung one. Short of sunk on purpose —
  a run must end by decision, not by one bad fight on the water. Winning
  strips their hull instead. The holed state sits on the hint bar the
  whole time it is true, because a halved pace with nothing on screen to
  say so would be the exact hidden punishment this project's rules exist
  to prevent. A new ocean card — A Lean Sail Closing, a hungry crew that
  rows like men who have not eaten — makes fights afloat reachable at all;
  the deck stands at 102. `SAVE_VERSION` 20 with a migration (an old
  save's hull is sound; nothing had ever been able to hole it). The bot
  needed no new verbs: it fights sea battles with the same line-forming
  policy and mends the hull through its normal camping, and the curve did
  not move — 75/20/8, unchanged. 574 tests. Published.

- **2026-08-07 — The cliff has a name, and the seed comes up** — Two audit
  items in one sitting, an instrument and a promise.
  Item 4: the harness now prints a deaths-by-fate table for the wall
  window, day 40 to 73, where the curve falls from 78 to 20. The table
  settles a question nobody could answer before it existed: the cliff is
  not material. Over sixty seeds — sickness 28, battle fates 52, while
  starvation and cold together end ten runs of forty-eight. The top
  run-killer is despair at 26, double "slain" at 12. Fights and winter
  sickness take people; every death drags on the band's heart harder than
  any victory lifts it; and it is the MORALE spiral that closes the saga.
  The five-lever lesson stands confirmed from the honest side: this game
  kills through people and grief, never through stores — so the levers
  that matter, when tuning is wanted, are bereavement, sickness, and how
  often winter draws steel. Deliberately measured and NOT tuned.
  Item 9: the sowed flag is read at last. The vocabulary gains `flagSet`
  (the mirror its `flagUnset` always implied), seed-corn is gated so one
  crop is paid for once, and a new autumn card — What the Spring Kept
  Back — opens only over a sown field, pays out on a cut-now-or-gamble-
  a-week choice, and clears the flag so the year can turn. The deck
  stands at 101, and a promise a player pays for is now a promise the
  game keeps. 564 tests. Published.

- **2026-08-07 — What winning is worth** — The audit's second item: the
  plunder economy. Falling on a neighbour used to dock 45 standing on the
  spot and pay two of food a foe — strictly worse than bartering, an
  aggressive choice with nothing behind it. Now the camp itself is the
  stake: the fight carries `campId` beside the places' `placeId`, and a
  WON field empties their stores — sized by who they are (a hall keeps
  timber, a camp keeps food; plain data on the clan kind) and by their
  might, because a camp that can defend itself is a camp worth having.
  Losing pays nothing and leaves them untouched. The standing cost stays
  priced at the decision, not the outcome — they saw who came over the
  wall whether or not it went well for you.
  Two consequences with teeth. A thrall can be carried home from a won
  camp — as a HAND, through takeIn and its room rules, which makes
  aggression the one way to buy the scarcest thing in the game and makes
  a búð worth even more. And a sacked camp arms: might rises by one, so
  the second visit is dearer than the first, and the player's own greed
  is now a difficulty knob they turn themselves.
  `SAVE_VERSION` 19. The bot learned the capability in the same commit at
  the rate an average player would use it — it robs a hostile doorstep
  only when there are under three days of food — and the curve did not
  move: 75/20/8, unchanged, which is right for a lever the player has to
  CHOOSE to pull. 560 tests. Published.

- **2026-08-07 — Somewhere worth walking to** — The audit's first item: the
  map gains places. A house of the White Christ on a far shore, stone cells
  and a bell and more in the store than in the yard; a trading town with a
  watch that is paid to be awake; a wreck broken-backed on the rocks; a seam
  of bog iron in an orange pool. One of each per world where the ground
  allows, seeded from the run's own seed, hidden under the fog until
  somebody lays eyes on them, drawn on the map with their own glyphs — and
  dimmed to a memory once taken, because the mark is where the saga
  happened. Standing on one, the hint panel introduces it and the Act sheet
  offers the deed: a day's work for the free ones, steel first for the
  guarded ones. The fight carries the stake — `Battle.placeId` — and pays
  only if the field is won; losing leaves the place standing to come back
  for. Taking one is once-only, is chronicled, can teach (runes off the
  monastery's books, shipwright off the wreck's bones, smithing off the
  seam), and moves the nearest neighbour's standing by the kind's infamy:
  robbing the coast is now a CHOICE that feeds the pressure machinery 4.3
  and 6.3 already built. `SAVE_VERSION` 18 with a migration that re-derives
  places from the save's own seed against its SAVED tiles, so every old
  save gains exactly the country it always had. The bot learned it in the
  same commit — it robs a soft larder when hungry — and the curve did not
  move (75/20/8 against 77/20/8, below resolution), which is the right
  answer: a place is opportunity, and the game's difficulty was never
  supposed to live there. 555 tests. Published.

- **2026-08-07 — The loop audit: the game only defends** — Ten new queue
  items from an audit taken against the pitch's own loop. The finding under
  most of them: the threat economy is entirely defensive. "Go out under
  arms" is a stir multiplier with no destination — nothing on the map is
  worth walking to; falling on a neighbour docks 45 standing and pays 2
  food a foe, strictly worse than bartering; nothing outside the steading
  escalates, ever — the same four archetypes at the same weights on day 700
  as day 7; the knarr cannot be lost or fought for; and the balance bot has
  never launched an expedition, so every measurement of the offensive half
  is blind. Two smaller catches with teeth: the seed-corn card charges 6
  food and 4 morale to set a `sowed` flag nothing reads — a paid promise,
  unwired — and the honest curve's real wall is mid-winter (78% reach it,
  25% come out), with no deaths-by-cause table to say why. The new queue
  orders the fixes; the finished 2026-08-06 queue stays above it for its
  figures and the release checklist. 540 tests.

- **2026-08-07 — v1.0** — The first tag this repository has ever carried,
  and it goes on a release-ritual build: `npm run release` zips the source
  beside a page verified to run standalone from a `file://` open with no
  console errors, and `npm run publish` puts the same build at both roots
  Pages can serve. Everything the queue demanded before a stamp is in:
  6.2 on screen, leavers told from corpses, raids that cost hands, a bot
  that forms a line on an instrument that tells the truth, a hundred-card
  deck, authored raid ground, and a main.ts that is a boot router again.
  The domain is the one piece that cannot be done from inside the repo,
  so its two steps — the DNS record, then the Pages custom-domain setting,
  in that order — are written into queue item 10 rather than into hope.
  Released with its eyes open: the honest curve says 7-10% of average
  runs reach the Thing's window. If play calls that an overshoot, tuning
  it is v1.0.1 on a truthful instrument, which is exactly what the last
  two days of harness work were for. 540 tests. Published.

- **2026-08-07 — The overlay chain moves out, and main.ts is a boot router
  again** — The last cut of item 8. The nine-branch priority that decides
  which one card sits over the travel map — the run's end outranks
  everything, what the player opened outranks what the game wants to say,
  the game's cards outrank the teaching — is now `render/overlays.ts`, a
  function that reads state and returns a node. It could not move while its
  branches closed over ten loose module-level `let`s; the `uistate.ts` cut
  gathered those, and this cut is what that one was for. main.ts ends the
  item at 453 lines, from 614 when the item opened, and owns nothing now
  but boot, the dispatch loop, and the slots.
  Verified in a browser rather than assumed, per this file's own rule —
  tsc has signed off on real breakage twice this session. A scripted
  Chromium drove the built page through every path the lift touched: the
  Act sheet opens to the day's deeds and closes, the Chart opens and
  closes, the Band roster opens and closes, and a travel event fires its
  card and resolves through a choice, with zero console errors. 540 tests.
  Published.

- **2026-08-07 — The ground remembers being built** — Item 7: raids stop
  being fought on rolled ground. Six approaches are drawn by hand in
  `data/raidFields.ts` — ASCII maps, seven marks wide and nine tall — and a
  raid picks among the ones its steading can actually offer: the strand and
  the ford need water on the ground, the wood-shoulder needs trees, and the
  open in-field, the hollow way and the burnt stubble fit anywhere. The
  palisade is drawn INTO each map as a line that rises if the wall is built
  and lies open if it is not, which is the item's whole phrase — the
  palisade as ground rather than as a number — made literal. The opening
  line of the battle log now says how they came, off the map itself.
  The old procedural steading field enforced its promises in code; the
  authored fields get them as a content lint instead, the same bargain as
  the event deck: room for fourteen raiders and six sworn, exactly one
  gate on the wall line, a way in that needs no climbing, somewhere four
  can stand abreast, a field that can be crossed — every map, walled and
  unwalled, or it does not ship. Adding a seventh approach is data and a
  lint run, no engine code.
  Measured both ways, and both results are the right ones. The curve did
  not move (77/20/8 against 78/25/10, every delta below resolution) —
  fields change what a raid feels like, not what the game costs. And the
  3.5 milestone bar strengthened: over ten paired raids, a walled steading
  held 5 with 18 dead and 246 stolen, against the open steading's none
  held, 29 dead and 720 stolen. On ground with a real approach drawn on
  it, the wall is worth more than it has ever measured. 540 tests.
  Published.

- **2026-08-07 — The hundred, and a correction about raids** — Batch four
  closes item 6: twenty-one cards, and the deck stands at exactly one
  hundred. A cairn on the high ground, hail out of a blue sky, a road
  through the wood that was walked more recently than it looked, a
  masterless dog, the midge-haze, a hot pool in the rocks, black ice
  crossed a spear-length apart, barley asking for rain, salt that does not
  equal the smokehouse, nets coming up light, an old man out of the weather
  and the guest-right he is owed, foxfire on the barrow, a fosterling
  offered with witnesses, the coast at market, a mocking verse answered
  verse for verse, a wedding neither side asked permission for, a palisade
  heaved by frost, rot under the thatch, a drift-net heavy with nobody's
  fish, a white owl nobody agrees about, and a forge standing cold for
  want of charcoal — that last gated on lore the band KNOWS, a corner of
  the vocabulary the deck had never spent, alongside first uses of the
  palisade and the smokehouse.
  The measurement mattered more than the cards. Batch three had dropped
  the first winter to 68% — flagged as exactly at the resolution floor,
  with a trim promised if batch four drifted the same way. It did the
  opposite: 78/25/10, winter back precisely where it started. There is no
  drift; there was never a drift; the instrument's own noise walked ten
  points down and ten points back, which is what a ±5-per-reading harness
  does. Nothing was trimmed, and batch three's caution is hereby retired.
  And a correction to yesterday's entry: raids held read 4 of 33, then 23
  of 39, then 7 of 28, across three deck states that should barely move
  it. The three mechanisms offered for the jump were honest guesses and
  are hereby demoted — the raid tally at twenty sagas is simply volatile,
  and nobody should tune raid fairness on it without a far bigger sample.
  Written into the queue where the raid work will happen. 535 tests.
  Published.

- **2026-08-07 — Twenty cards that bite, measured on the honest instrument** —
  Batch three, and the deck stands at seventy-nine: a ford in spate, loose
  stone over the path, a keel-shaped mound above the tideline that nobody
  felt good about opening, sea-fog that steals a day, adders in the warm
  stones, a bull seal that owns the landing, rats in the grain, a well gone
  foul, fire in the winter feed, a patched sail standing in, wolf-tracks at
  the byre closer every morning, a hall snowed to the eaves, the lean weeks
  before the green, a feast invitation that is also a counting of heads, a
  boundary walked with witnesses, wreck-wood on a shared strand, black ice,
  an ember in the bedding, the rowing song from the crossing, and an autumn
  count the store contradicts. Costly or a trade almost throughout, per
  batch two's lesson, and two of them can draw blood.
  The dilution question every batch must answer has changed shape: since
  6.3, raids arrive by a daily roll off the steading rather than from this
  deck, so a bigger deck no longer waters the raid rate down. And this
  batch is the first measured on the fixed harness: 78/30/7 → 68/22/12.
  The winter drop sits exactly at the ±10 resolution floor, so by this
  document's own rule nothing was tuned on it — recorded instead, with the
  note that a second batch drifting the same way makes it real. Raids held
  jumped from 4 of 33 to 23 of 39, mechanisms unconfirmed but all three
  candidates design-positive: leaner stores shrink what a raid thinks the
  steading is worth, two new fights feed the band XP before raids come, and
  the neighbour cards give grievance a way to be paid down. 535 tests.

- **2026-08-07 — The bot forms a line, and half the sample turns out to be
  fiction** — Item 5b. The wall rule that works was sitting in
  `test/wall.test.ts` all along: closing at 4 a hex outweighs shoulders at 3
  a mate, two mates at most, scored over the full zone-of-control reach — a
  line formed WHILE advancing, where the reverted first attempt weighted
  shoulders above ground and huddled. In clean arena fights at difficulty
  two it takes the old charge-in bot from 18 of 60 wins and 89 left standing
  to 34 and 162.
  Wiring it into the balance harness "collapsed" the curve, 83/55/50 to
  78/30/7 — which, by this session's own rule, meant checking the mechanism
  before trusting the number. The mechanism was rotten. The harness's run
  loop treats a refused action as the end of the saga, and the old bot
  proposed battle moves without costing the ground or the disengage, so
  `doMove` refused them — and THIRTY of sixty runs were being cut off
  mid-battle, one as early as day 7, every one counted as alive at every
  milestone thereafter. Those thirty truncated sagas are exactly where
  83/55/50 came from: played out legally, the old bot reads 78/22/2. The
  wall-forming bot reads 78/30/7 with zero refusals — better at every mark,
  on fights that actually get fought. Raids held went 1 of 15 to 4 of 33,
  because the truncated sagas had been under-counting the raids themselves.
  The seventh harness artifact, and the largest.
  Landed together: the loop now ends the turn instead of the saga when a
  battle action is refused; the curve bars are re-based around the honest
  reading, with the floor moved to spring because ±5 points of resolution
  cannot honestly put a floor under 7%; and the head of this document tells
  the new truth — the late game is not flat, it is a cliff, and every
  "the curve did not move" verdict before today was delivered by an
  instrument that discarded half its sample. 535 tests.

- **2026-08-07 — Two cuts, and the third made possible** — `data/events.ts`
  had grown to 1,294 lines by holding the event VOCABULARY — conditions,
  effects, the shapes a card can take — in the same file as every card written
  against it. Two different things with two different reasons to change: the
  vocabulary moves when the engine gains a capability, the deck moves whenever
  somebody writes a card. The deck is now `eventCards.ts` and the vocabulary
  is 91 lines, re-exporting it so no consumer had to move.
  Then the ten loose `let`s at the top of main.ts — which overlay is open, who
  is selected in the steading, which action a tap on a foe performs — became
  one `uistate.ts`. That is the change that matters, and not for the sixty
  lines: the overlay chain could not be lifted out of main.ts while its nine
  branches each closed over module-level variables that existed nowhere else.
  Now they can be handed what they need, so the chain is the next cut rather
  than an impossible one.
  Verified in a browser, which was worth doing: the Act sheet opens to five
  deeds, acting closes it and advances the day, and Chart correctly refuses to
  open while a card is up. main.ts 614 → 524. 535 tests.

- **2026-08-07 — The console levers move out of the boot router** — main.ts
  had grown to six hundred and fourteen lines and every milestone added to
  it. The debug handle went first, because it is the part with no business
  being in a boot router at all: it is not how the game starts, it is a set of
  levers for dropping onto a battlefield, filling the store, or winding the
  calendar past two years of honest turns.
  It takes its hooks rather than reaching for main.ts's module-level state,
  which is what lets it be a separate file — and it means every lever now goes
  through the same save-and-render path a real dispatch uses instead of
  quietly maintaining a second one. Each also works on a clone and hands it
  back, the way a reducer does.
  Verified in a browser rather than assumed: `state()` reads, `stock()` fills,
  `fight()` puts the band on a field, no console errors. 554 lines and 108,
  where there were 614. 535 tests.

- **2026-08-07 — One way to store a preference** — Three things outlive a run
  beside the save — the mute, the teaching, the memorial — and each had grown
  its own try/catch, its own JSON parse, and its own idea of what to do when a
  browser refuses storage. Three copies of the same twenty lines, none of them
  stamped with a version.
  They now go through one `store.ts`: read with a type guard and a fallback,
  write with a version stamp, and never throw. A browser with storage disabled
  is simply a player with no preferences, which is a perfectly good thing to
  be, and there is now somewhere for a future shape change to hook.
  The mute needed an actual migration on the way. It shipped as the raw string
  `'1'`, so anybody who silenced the game yesterday had that in their browser
  today; it is read in the old form once and rewritten in the new one. Four
  lines, and the difference between a preference honoured and one silently
  lost — which is the same failure as the `Person.morale` bug, in the one
  place that had no safety net.
  One correction to the audit that ordered this work: it claimed the memorial
  grew unboundedly toward a quota. It does not, and never did — `WALL_LIMIT`
  has capped it at sixty names since the day it shipped. 535 tests.

- **2026-08-06 — The harness cannot be tuned on, and now says so** — An audit
  went to fix the deck-dilution drift by lifting the base event chance to
  match the bigger deck. Sweeping it through 0.28, 0.34 and 0.40 gave 53%, 30%
  and 43% at the two-winter mark — a fourteen-point swing that went the wrong
  way in the middle. That is not a response curve. It is noise being read as
  signal, and every one of today's tuning decisions was taken on the same
  instrument.
  So nothing was tuned. The event chance is back at 0.28 where it shipped, and
  the sample went from thirty seeds to sixty instead. At a fixed setting the
  same measurement moves about five points between the two, which puts the
  floor of what this harness can see at roughly ten — comfortably larger than
  several differences that were treated as real earlier today.
  Both the test and the roadmap now state the resolution up front, and the
  curve figures are labelled directional. The wide bars in the difficulty test
  were already right for the wrong reason: they catch "unwinnable" and
  "walkover", which is all a sixty-seed sample can honestly support.
  532 tests.

- **2026-08-06 — Ten cards that cost, and a lesson about decks** — Batch two,
  written deliberately against batch one's habit of ending in a find: a lame
  ox worth more working than butchered, an argument over a place at the fire,
  the last of the seed corn that is either next year's crop or this month's
  bread, a debt somebody has walked up to collect, ice too thin to walk on and
  too thick to row, an empty bed and a bag gone from the peg, a tooth that has
  to come out, something said at the wrong time, a neighbour who wants the
  harbour, and ground the spade rings off. Fifty-nine cards now.
  And the curve went UP: 80/40/37 to 83/60/53. Every card in the batch costs
  something, and the game still got easier — because deck SIZE is a difficulty
  knob on its own. Twenty new cards dilute the share of any draw that is a
  raid, a fight or a hard weather card, so the same event chance now delivers
  less harm per day. That is not a thing anybody would notice by reading the
  cards; it only shows up in the measurement.
  Recorded rather than corrected. Fixing it means either weighting the harmful
  cards up or lifting the base event chance to match the bigger deck, and both
  want their own measured pass rather than a number nudged now. Every future
  batch has to answer it. 532 tests.

- **2026-08-06 — Ten more cards, and what they quietly did to the curve** —
  The deck goes from thirty-nine to forty-nine: a river over its bank, a whale
  on the sand, bog iron in an orange pool, a camp whose people are simply
  gone, the sun not getting up, somebody else's boundary stone, an old hand
  who banks a fire in a particular way, gulls a long way inland, turf coming
  through the roof, and a stack off the point worth taking a bearing from.
  Every one leans on conditions the engine already has, so not a line of
  engine code changed.
  They are not free, though, and the harness said so before anybody played
  them. The first draft took the first winter from 77% to 90% — a whale worth
  twenty-six food, found on the shore where every band starts, is most of a
  season's larder handed over on day two. Trimmed to fifteen, with the other
  food cards cut back alongside, and the curve settles at 80/40/37.
  Worth stating plainly: content is balance. Ten cards written purely for
  flavour moved the game's opening difficulty by thirteen points, and the only
  reason that was caught before it shipped is that the deck expansion ran
  through the same measurement as everything else. 532 tests.

- **2026-08-06 — The bot cannot form a line, confirmed and half-solved** —
  The suspicion was right: a wall-forming rule for the balance harness — score
  a hex by shoulders gained minus ground lost — took raids held from 0 of 15
  to 6 of 29. The raids were never broken; the instrument was, which makes it
  the sixth harness artifact of the day.
  The rule is reverted anyway, because it is not good enough. Weighting
  shoulders that heavily makes the band huddle rather than close, which helps
  a defensive raid and wrecks an open-field fight: the survival curve fell
  from 77/47/47 to 77/20/13. A bot that plays worse overall cannot be used to
  judge whether raids are fair, and shipping it would have replaced one bad
  measurement with another. `SACK_TAKES` 2 → 1 moved that by exactly nothing,
  which rules the sacking out as the cause and leaves the movement rule.
  What it needs is to form a line WHILE advancing rather than instead of it,
  and to be judged on both numbers at once — raids held up, curve not
  collapsed. Written into the queue with the figures. 532 tests.

- **2026-08-06 — The raids may not be broken; the bot cannot form a line** —
  Fifteen raids came across twenty sagas and none were held, which looked like
  6.3 having overshot. It is not that. Sweeping the raider cap through 14, 11
  and 10 and the difficulty clamp through 10, 8 and 7 produced **identical**
  numbers at every setting — because neither binds. The foe count is
  `round(warband × 0.9) + difficulty`, so six defenders draw about nine
  raiders whatever the ceiling is set to, and both knobs were sitting above
  the value that actually decides the fight.
  What loses those fights is almost certainly the measuring instrument. The
  balance harness charges the nearest foe and never stands shoulder to
  shoulder — and `test/wall.test.ts` exists precisely because charging loses
  to holding the line. That makes "0 held" the sixth harness artifact of the
  day rather than a finding about the game, and the two cannot be told apart
  until the bot can form a wall.
  Nothing was tuned on the strength of it. The cap and clamp are back exactly
  where they shipped, and the queue now says to fix the bot first and judge
  the raids afterwards. 532 tests.

- **2026-08-06 — A sacking takes people, and the raids turn out to be
  unholdable** — Five levers had failed on one number and every one of them
  was priced in food, firewood or timber, which a settled band replaces
  faster than anything can take it. So a sacking now carries hands off: two
  at most, never the sworn, because the warband is fixed at six and a raid
  that could take it would end runs by dice rather than by decision. That
  costs the one thing 6.2 made scarce — labour that has to be recruited back
  and given room — and it cannot be answered by fielding more of your own.
  The carried-off go on the memorial, unlike somebody who walked out: a man
  taken by raiders genuinely did not come back.
  Shipped in the same commit as the measurement, on purpose, because
  separating the two is exactly how three misleading readings were produced
  earlier today. And the measurement immediately earned it: across twenty
  sagas, **fifteen raids came and the band held none of them**. Not one. A
  palisade and six sworn are supposed to hold some — that is what 3.5
  measured, and it is what the wall's eight timber is for. Raising the raider
  cap to fourteen and the difficulty clamp to ten in 6.3 went too far
  together, and nothing was watching that number until now.
  The fix is the next thing in the queue rather than a rushed edit at the end
  of a long session. 532 tests.

- **2026-08-06 — Two audit fixes: the invisible system, and the lie about the
  dead** — An audit found that `bond`, `capacity`, `crowding` and `roomLeft`
  appeared in exactly zero renderer files. The whole of 6.2 had shipped
  invisible: a player could not see which of their people would be standing in
  the line when a raid came, how much room the hall had, or why everyone's
  heart was dropping in a crowded steading. That last one is the worst of it —
  a penalty with nothing on screen to explain it is not difficulty, it is a
  bug that looks like bad luck.
  The roster now marks a hand as a hand, and the steading has a room panel
  that reads like the winter mark does: how many are under the roof, how many
  more will fit, and — when it is over — how many are sleeping on the floor
  and exactly what it is taking off every heart.
  Second: hands who walk out were marked dead. They are still `alive: false`,
  because somebody who has gone is not eating here any more and the upkeep has
  to agree, but they now carry `left` — and the memorial and the saga skip
  them. A wall titled "those who did not come back" listing a man who is fine
  and elsewhere is a lie about what happened to him.
  527 tests.

- **2026-08-06 — Raids come on their own schedule now** — A steading worth
  taking is visited because it is worth taking, not because the event deck
  happened to offer the card: years stood, building raised and food in the
  store all draw them, a coast with a grievance needs less excuse, and the
  watch and the wall buy it back down — the first thing in this game that has
  ever made standing the watch worth it on a quiet day.
  The rate was tuned against `test/thing.test.ts` rather than the survival
  curve, because that test carries a promise the curve cannot see: a band
  that builds the hall, keeps the peace and makes a friend must still be able
  to reach the endgame. Measured across its four bands — 0.006 got one of
  them there, 0.003 got three, 0.0015 gets all four. A raid every other year
  for a rich hall is a hazard; one every season is a siege that eats the mead
  hall before the Thing can be called in it, which is harder in the wrong
  direction.
  And the curve still does not move: 77% reach the first winter, 47% see
  spring, 47% reach the second. That is now five levers aimed at one number
  without shifting it, and the evidence has stopped being ambiguous. Four of
  the five were priced in food, firewood or timber, and a settled band
  replaces those faster than anything can take them. A lost raid carries off
  two fifths of the store and fires a building — both of which come back. The
  next lever, and the roadmap says so plainly, is that losing must cost
  HANDS. 525 tests.

- **2026-08-06 — Raid frequency, written and switched off** — 6.3 made raids
  bigger and the curve did not move, because raids were rare: they arrived
  only as event cards, so how often a steading was visited was a fact about
  the deck rather than about the steading, and about a quarter of whole sagas
  never saw one. `raidOdds` fixes that at the root — a hall that has stood
  years, is full of building and has a winter's food in it is worth crossing
  the country for, a coast with a grievance needs less excuse, and the watch
  and the wall buy it back down. That last part is the first thing in this
  game that has ever made standing the watch worth it on a quiet day.
  It is not wired in. Rolling it each day does exactly what was wanted and
  takes the Phase 4 bar — a band that builds the hall, keeps the peace and
  makes a friend can reach the endgame — from 4 of 4 down to 1 of 4. Harder
  is the goal; unreachable is not, and a band that did everything asked of it
  must still be able to call a Thing. The function ships tested and switched
  off, with the reason written where the next person will find it.
  The roadmap gains a living head: where the project stands, what is next,
  and a table of every measured dead end, so none of today's four null
  results has to be rediscovered. 525 tests.

- **2026-08-06 — 6.3 part: the lever was disconnected** — Raid pressure had
  been measured as worthless at three separate magnitudes, and the reason
  turned out to be arithmetic rather than design. Raids were capped at nine
  raiders; against six sworn, the roll saturates that cap at difficulty four;
  and the difficulty itself was clamped at six. Everything the coast felt
  about you past that point was being discarded by a `Math.min` before it
  reached a battlefield. The lever had never been connected to the thing it
  moved.
  A hall that has stood years and been built up now draws more than nine, to
  a ceiling of fourteen — two deployment rows, the most ground that can hold
  a raid. The difficulty clamp goes to ten so provocation reaches the field.
  And because the warband is fixed at six for good, none of it can be
  answered by fielding more of your own: the answer has to be the wall, the
  watch, and who on this coast owes you anything.
  The curve still did not move: 73% reach the first winter, 47% see spring,
  47% reach the second. Raids are simply rare — roughly three runs in four
  see one at all across a whole saga — so their size is not yet what decides
  a run. Frequency, not force, is the next thing to look at. 521 tests.

- **2026-08-06 — 6.2 completes: people come, and people go** — Three ways in,
  each hanging off a system that already existed rather than a counter
  ticking over: two from along the coast when a neighbour thinks well enough
  of you (4.3), somebody out of the trees at dusk in winter with nothing on
  them (3.4), and two left standing after a raid whom nobody is going to walk
  home (3.5). Every one of them can be refused, and refusing costs something
  real — standing, food, or the band's own opinion of itself.
  Everyone arrives as a hand, and a hall with no spare bed turns them away
  with nothing said, which is what makes a búð worth five timber. Hands who
  have had enough walk out; the sworn never do, because a warband that could
  evaporate would make every fight a morale check before it was a fight. A
  hand who has been with the band a month has thrown their lot in and stays,
  so a steading that carries people through a bad patch keeps them.
  The curve did not move — 73% reach the first winter, 47% see spring, 47%
  reach the second. Growth is possible and rare by design: three once-only
  cards behind real gates. What is missing is a REASON to grow, and that is
  6.3's job — nothing yet threatens a band badly enough that more hands are
  the answer.
  The harness taught the same lesson a third time. Its build list said
  'farm-plots' where the building is 'farmplots', so that entry had silently
  never queued and the bot had been building three things while the file
  claimed four; and it never built a búð, so the measured player could not
  grow at all. Fixing both moved the first winter from 80% to 73% — a truer
  reading of the same game, not a change to it. 516 tests.

- **2026-08-06 — 6.2: room to put people** — Buildings now grant room, and a
  steading holds who it has room for. The longhouse sleeps six; a búð —
  turf walls and a low roof thrown up against it, that nobody wants to sleep
  in and people do — adds four; the mead hall three, because people slept in
  the hall and always did. Thirteen at the outside, which is a roster that
  still reads on a phone.
  Past that room, everyone's mood drops five a head per night. That is what
  stops taking hands in from being free the moment there is food in the
  store, and it gives the build queue the first reason it has ever had to go
  on existing after the winter is beaten: a búð is not a thing you finish, it
  is how the band grows.
  One correction on the way. The first cut gave a steading with the posts in
  but nothing raised a capacity of nought — so planting posts made a band
  WORSE off than one still camping, crowded on its own ground until the
  longhouse went up. Capacity now floors at the six the knarr sleeps: the
  roof is what lets you grow past six, not what lets you have six. Curve
  re-measured either side of that fix — 80/50/47 with the perverse dip,
  80/50/50 without, matching where it stood before. 508 tests.

- **2026-08-06 — 6.2: six bear arms, the rest work** — A person is now sworn
  or a hand. The sworn are the warband and there are never more than six of
  them, because six is what came off the knarr and every fight in the game is
  balanced against a line that wide; a steading that could answer a raid by
  turning up with more bodies would make 2.3's shield wall a headcount
  contest. Hands do everything else: they hold jobs, they eat, they need
  warming, they can be killed, and — once the ways in exist — they can walk
  away. They never see a battlefield. Growth therefore buys labour and never
  an army, which is the whole bargain of the milestone.
  With the hearth change from earlier, taking somebody in now costs food AND
  firewood, so a bigger hall is a real decision rather than a free hand.
  `SAVE_VERSION` 17 with a migration: everyone in an older save comes forward
  sworn, which is exactly what they were — they all came off the knarr with a
  weapon. 503 tests.

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

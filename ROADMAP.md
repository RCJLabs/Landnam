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

> **CURRENT MILESTONE: 6.3**

---

## Where we are now

*This section is the living head of the document: it is rewritten whenever it
stops being true, unlike the changelog below, which is append-only history.
Anyone — or any future session — should be able to read this and the "dead
ends" table and pick the work up without re-deriving a day of measurement.*

**Shipped:** Phases 0–4 complete. 5.1 Sound, 5.2 Onboarding and 5.3 Balance &
juice are done. Phase 6 is under way: 6.1 and 6.2 shipped, 6.3 part-done.

**The measured curve** (a scripted player of roughly average competence over
SIXTY seeds — see `test/balance.test.ts`, which is the source of every number
in this document. It resolves to about ±5 points; anything smaller than ten
points is below what it can see, so treat every figure here as directional):

| milestone | reached |
| --- | --- |
| the first winter (day 49) | 78% |
| spring (day 73) | 30% |
| the second winter — the Thing's window (day 169) | 7% |

These are not yesterday's figures, and the game did not change: the
instrument did. Every earlier curve was read off a run loop that treated a
refused action as the end of the saga, under a bot that proposed battle
moves without costing the ground — so HALF of sixty runs were cut off
mid-battle, one as early as day 7, and every one counted as alive at every
milestone after. 83/55/50 was those truncated sagas. The bot now forms a
line while advancing (the rule `test/wall.test.ts` always said wins) and the
loop plays every fight to its end; the same game, honestly played, reads
78/30/7.

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
6. **[ ] Raids need a face.** raidSource names a clan; the raid itself is
   anonymous men. A named raid-leader per hostile neighbour — persistent, a
   huscarl, carrying the grudge history — who can be felled (pressure
   breaks, saga names him) or keep coming back (he remembers too). Rides
   the Person model and the feud system that already exist.
7. **[ ] The build queue must not end.** After the búð there is nothing to
   spend a surplus on, and surplus labour is the diagnosed root of the flat
   material game. Late buildings as data: wall tiers (the authored fields
   read them), a beacon for the watch, a feasting-hall tier the Thing
   reads. Spending surplus is the player's answer to escalation (item 3).
8. **[ ] 6.4, shaped as escalation.** Remove the five-winter guillotine;
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

## Dead ends — measured, and not to be repeated

Every one of these was built, measured, and reverted or corrected. They are
here so the next attempt does not begin by repeating them.

| Attempt | What happened |
| --- | --- |
| Raid pressure rising with the steading's fame | No curve change at three magnitudes. **The reason was a clamp, not the design** — see below. |
| Winters deepening with the years, alone | Zero change for a careful player AND a careless one (18/40 either way): the winter mark was a perfect forecast, so the band simply stocked to the bigger number. Shipped later as 6.1, once the mark was made vague. |
| A landing chosen near settleable ground | Fixed a real problem (settleable ground a median 5 and up to 11 hexes from the sand) and broke a bigger one: where you land decides where you fight, and on the worlds it produced the shield wall went dead level with charging in — 33 wins/157 standing became 32/158 over sixty seeds. Rejected. |
| Rolling a raid every day instead of drawing one from the deck | Shipped after tuning. The first rate took `test/thing.test.ts` from 4 of 4 bands reaching the endgame to 1 of 4; measured at 0.006 → 1/4, 0.003 → 3/4, 0.0015 → 4/4. Raids now fire regularly and the curve STILL does not move, because bands hold them and losing one costs only stores. |
| Guaranteeing a four-wide front on every battlefield | Shipped, but currently inert: no terrain the game ships ever fails it. A regression guard on tunable data, not a fix. The real mechanism is row DENSITY — 98% of meadow rows can hold a line against 40% of ocean ones. |

**The lesson under most of these:** four null results in one day, and the
worst of them was measuring plumbing rather than design. Raids were capped at
nine; against six sworn the foe roll saturates that cap at difficulty four;
and difficulty itself was clamped at six. Everything the coast felt about you
past that was discarded by a `Math.min` before it reached a battlefield.
**Before trusting any null result, check that the mechanism can physically
produce a non-null one.**

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
- [ ] **6.4 No last winter** — Remove the five-winter forced ending; a run
  goes as long as it is held. The Thing becomes a milestone in a saga rather
  than its final page.

---

## Parking Lot (ideas, not commitments)

Naval battles · winter solstice festivals · named legendary weapons · bloodline/generation play · daily-seed challenge mode · god-favor system

## Changelog

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

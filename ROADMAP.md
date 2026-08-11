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

**The current queue is the audit of 2026-08-11** — ten items, all doable
without leaving this repo, two of them bugs shipped in the last two days.

**Phase 7 is the Unreal build**, running in parallel in another repo — a hex
grid and top-down movement are working there. What this repo owes it, and
what it must be careful of, is written up below. The short version: the
simulation is the asset (10,500 lines of pure logic and 5,000 of typed
content under 831 tests), the renderers are disposable, and the port lives
or dies on whether the balance harness follows the sim across.

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

| setting | saw the first spring | over 500 days (20 sagas) |
| --- | --- | --- |
| A Fair Country *(default)* | 60% | 161 days a saga, 13 mead halls, 3 jarls |
| As It Lies *(what everything is tuned against)* | 25% | 86 days a saga, 1 jarl |
| A Hard Country | 7% | 65 days a saga, 1 jarl (60 sagas) |

The spring figures fell 7, 5 and 1 point when the fixed places were brought
onto the same coast as the band (audit item 1) — a country with a garrisoned
town actually on it is harder than one with the town thirty hexes away. All
three movements are inside the ±10 this harness can resolve, and were left
alone rather than tuned back; the long-game figures are from before that
change and have not been re-read.

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
with 5,000 more of typed content in `src/data/`, standing under **831 tests
in 45 files**. `src/render/` and `main.ts` are 4,500 lines that draw SVG and
are worth nothing to Unreal. The split the CLAUDE.md rules have enforced from
day one — *if it can be unit-tested, it does not belong in `render/`* — is
what makes this a port rather than a rewrite. Every item below exists to
protect it.

Ordered, as the audits are: the expensive-to-change decisions first, then
what 3D actually buys, then what gets harder.

### The decisions that are expensive to change later

1. **[ ] Choose the sim boundary — and know that half of it is already
   chosen.** *Read this before deciding anything; it was written after
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

   Still owed: the travel and colony halves. `chronicle()` is the seam —
   300-odd call sites that already write ordered prose and want the same
   structured payload beside it.

4. **[x] Port `src/hex/` first and hardest.** *Already done in
   `landnam-ue` (`LandnamHex.cpp/.h`, 672 lines) and verified in parity on
   2026-08-11 — round, toPixel/fromPixel, distance, line, neighbors and
   directionTo, ring, range, the offset conversions, findPath and reachable,
   every vector recomputed from live `src/hex` and matching.* Pure, fully tested, and both
   the world map and the battle grid stand on it — axial coords, neighbours,
   distance, `line`, `range`, `ring`, `findPath`, and the pixel conversions.
   Its tests port almost verbatim and give a real green baseline on day one.
   Nothing else should be started before this is green.

5. **[ ] Keep the balance harness running against the PORTED sim.** The one
   to fight for. Everything found in the 2026-08 audits — a coast no band
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

9. **[ ] Save discipline has to survive the port.** `SAVE_VERSION` is 28,
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

9. **[ ] Re-run the content-reach probe and act on the top miss.** It is a
   permanent fixture now (audit item 6) and it has not been read since the
   raiding work, three save versions ago. An instrument that reports and is
   never acted on is decoration. *Measured by: the probe's own output, and a
   fix for whatever it names.*

10. **[ ] A challenge you can only send after you die.** The code is
    produced on the ending screen and nowhere else, so a player who wants to
    set a friend the seed they are enjoying has to lose first. The deeds
    sheet is the natural home. Small, and it is the difference between a
    feature people use and one they meet once. *Measured by: reaching the
    code from a live run in the built page, and its terms matching the run.*

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

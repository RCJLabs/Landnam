# The sim parity contract

Companion to `rng.md`. That one pins the generator; this one pins the
**game** — what a seed and a list of actions must produce, on both sides.

Phase 7 item 1 was decided on 2026-08-13: the rules get rewritten in C++, and
the TypeScript becomes the reference implementation and the balance lab. This
file is the whole of what makes that second claim true. Without it the two
builds drift and nobody finds out until the numbers in `ROADMAP.md` describe
a game nobody is playing.

## Files

| File | Owner | Consumer |
| --- | --- | --- |
| `port/golden.json` | this repo | `landnam-ue` → `Content/Data/golden.json` |
| `port/parity.json` | this repo | `landnam-ue` → `Content/Data/parity.json` |
| `runs/example.json`, `runs/long.json` | this repo | copied alongside |

`test/goldenport.test.ts` and `test/parity.test.ts` recompute every stored
value from the live source and fail if it moved. **The stored inputs are the
spec and the stored outputs are the expectation**, so the same file is both
what Unreal asserts against and what this repo cannot drift from without
being told.

Regenerate with `npm run parity` (and `npm run parity -- --check` to see
whether it is stale without writing). Both sides move together or neither
does.

## Why facets, and not one hash

`stateHash` in `src/run/headless.ts` hashes a whole `GameState` in sixteen
hex digits, and for this job it is the wrong instrument, because it is
all-or-nothing. A port that has worldgen and nothing else cannot match it —
so it stays red from the first day of the port to the last and says nothing
useful on any of them. **A bar that cannot go green until everything is done
is a bar nobody can work against.**

So the state is cut into **facets**: independently hashed slices, ordered to
match the order the port lands in. Worldgen lands, `world` goes green and
stays green, and any later drift in worldgen is caught the day it happens
rather than at the end.

| Facet | Covers | Port stage |
| --- | --- | --- |
| `world` | tiles, landing, places | 1 — worldgen |
| `band` | people, stores, position | 2 — party, upkeep, calendar |
| `coast` | neighbours, grudges, lore | 3 — the social layer |
| `steading` | settlement, expedition, jarldom | 4 — colony |
| `field` | battle, aftermath | 5 — combat |
| `run` | day, flags, tally, ending, modes | 6 — bookkeeping |

The facets are a **partition**, not an arbitrary set of views: every field of
`GameState` that is about the run belongs to exactly one, so "all facets
match" and "the states match" mean the same thing. `test/parity.test.ts`
walks a real state's own keys and fails on any field no facet owns — checked
by deliberately orphaning one and watching it fail, because a coverage bar
nobody has seen fail is not known to work.

Two fields are excluded on purpose, and both would otherwise cause false
alarms:

- **`saga`** — prose. Gets reworded; a hash that moved on a rewritten
  sentence would cry wolf until nobody looked.
- **`beats`** — the presentation stream. Emitted, never read, and **capped**,
  so two implementations that agree about the game can legitimately hold
  different windows of it.

## What is stored beside each hash, and why

A bare hash is a smoke alarm with no address on it. Each reading carries:

- **`hash`** — FNV-1a over the canonical form, twice with a salt. Same
  `hashString` already pinned by `golden.json`, so a port that passes the RNG
  contract has nothing new to agree about but the canonical form.
- **`size`** — characters of canonical form. Separates *"these are different
  states"* from *"these are different **shapes**"*. A port missing a field
  entirely reads very differently from one that computed a value wrong, and
  the hash alone cannot tell you which you have.
- **`samples`** — a handful of plain integers and short strings, never
  fractions. So a red test says *"your day 40 food is 12 and mine is 31"*
  rather than only that two hex strings differ.

## The salt has a NUL in it

The second hash pass is salted with **`landnam-state` followed by a NUL
byte**, not by a space. The literal in `headless.ts` is
`` `landnam-state\0${text}` ``, the NUL is invisible in every editor, and it
is why `grep` reports that file as binary.

This cost an hour during the worldgen port and it fails in a uniquely
misleading way: the **first** half of every hash matches and the second does
not, which reads like a deep disagreement about the game and is nothing of
the kind. In C++, build the salt explicitly — `std::string("landnam-state\0", 14)`
or `FString` plus `AppendChar(0)` — never as a string literal, which stops at
the NUL.

It is **pinned, not fixed**. Nothing depends on which separator it is, only
that both implementations agree, and changing it would move every stored
vector for no gain. What was missing was anybody being able to see it;
`test/parity.test.ts` now asserts it explicitly.

## The canonical form

Documented in `src/run/headless.ts` and tested in `test/headless.test.ts`.
Two rules, both there so a second implementation can produce the same string
without guessing:

- **Object keys are sorted.** JavaScript preserves insertion order and
  another language's map will not.
- **Numbers are written explicitly.** Integers as integers; fractions to 15
  significant digits. Left to a runtime's shortest-round-trip printing, two
  languages disagree quietly about identical values. `-0` hashes as `0`.

## The ramp: one bar per verb

Porting `apply()` needs a finer instrument than the facets. The scripted runs
checkpoint at 10, 50 and 100 percent, and **ten percent of a 1320-action
script is action 132** — a hundred days and a dozen verbs in. A port with
`CAMP` wrong and `MOVE` right fails there with no way to tell which. That is
the all-or-nothing bar again, one level below where facets solved it.

So every scripted run also carries a checkpoint **immediately after the first
appearance of each action type**, plus a doubling scale through the opening.
Each one records the `action` that got there and is flagged `firstOf` when it
is a verb's first outing, so a red mark names the thing to go and look at.

`runs/long.json` is the ladder worth porting against:

| after | action | what it first exercises |
| --- | --- | --- |
| 1 | `MOVE` | travel, a day passing |
| 9 | `CHOOSE` | the event deck |
| 10 | `DISMISS_EVENT` | event teardown |
| 11 | `FOUND` | a settlement exists |
| 12 | `ENTER_COLONY` | the mode stack |
| 13 | `ASSIGN` | jobs |
| 19 | `QUEUE_BUILD` | the build queue |
| 21 | `LEAVE_COLONY` | popping the stack |
| 22 | `CAMP` | the day cycle and upkeep |

`runs/example.json` adds `FORAGE` at 1 and `B_END_TURN` at 17, which is the
first battle turn. Implement one verb, watch one mark go green.

Each run also carries `actionCounts`, so the order to implement verbs in can
be read off rather than discovered by failing.

## Stage 5, scoped: the RNG has no position

`passDay` fans out to about twenty subsystems — raids, joins, moods, grudges,
tribute, feuds, standings — and read straight down it looks like an
all-or-nothing port: implement everything, or the random stream falls out of
step and nothing matches.

**It is not.** Every draw site in `src/sim` derives a fresh generator from
CONTENT rather than holding a sequential one — `stream(seed, 'events')
.derive(\`grudge:${day}\`)`, `.derive(\`plunder:${id}:${day}\`)`,
`actionRng` keyed by day, round and turn. Twenty-eight of twenty-eight,
checked. So **the number of draws taken before a call cannot change what that
call returns**, and a port may skip any subsystem that produces no state
change without the stream drifting. Implement what moves state; add the rest
as they start to matter.

That turns stage 5 from a cliff into a ladder. Measured over the first eight
actions of `runs/long.json` — eight pre-settlement `MOVE`s — a whole day is:

| what | how much |
| --- | --- |
| day | +1 |
| food | −`ceil(alive / 2)` |
| firewood | −`firewoodPerNight` (season × hardship × band share) |
| party morale | +1 when neither hungry nor cold |
| `flags.hungerStreak` | set to 0 |
| each person's mood | drifts toward its target |
| each neighbour's standing | drifts 0.12 toward nought |
| position, `trod`, fog | the `world` facet |

Nothing else moves: no health change, no illness, no arrivals, no raids. The
subsystems that would do those things are all gated on a settlement, an
expedition or a grudge, and a band eight days off the knarr has none.

So the first rung of stage 5 is the **unsettled** day cycle plus `MOVE`, and
it is worth perhaps a hundred and fifty lines rather than the two thousand
that reading `passDay` suggests.

### The first rung is done and green

`Sim/LandnamDay.{h,cpp}` ports `apply`, `applyTravel`'s `MOVE` and `passDay`
for a band with no steading, and matches every facet at `runs/long.json`
@1, @2, @3 and @5. It came to about two hundred lines, and the estimate above
held. With the deck, the steading and the work pass below, the port is green
at **@0 through @55 — sixteen checkpoints, six facets each** — and stops at
@132, where it names its own two blockers.

**The draw order, written out before any C++ as stages 2 to 4 taught.** A
whole unsettled day, in the order the TypeScript walks it:

1. `day += 1`, then `workTheDay` — which returns on its first line with no
   settlement, so the stores are untouched.
2. Mouths: `eaten = min(food, max(1, ceil(alive / 2)))`.
3. Fire: `max(1, ceil(effectsOn(day, seed).firewood * hardship.winter *
   (0.55 + 0.45 * heads / 6)))`, less `shelterSaving`, which is a roof plus
   learned lore and so nought here.
4. Fed → `flags.hungerStreak = 0`. **Set, not deleted** — which is why the
   `run` facet grows by seventeen characters the moment a day passes.
5. Fed and warm → `party.morale += 1`.
6. `driftMoods`, **reading `party.morale` after that +1**. Per person:
   `target` off the band's morale, their health, the pressures and their
   injuries; `step = (target - morale) * 0.28 * temperOf(trait)`.
7. `driftStandings`: every neighbour 0.12 nearer nought. This is where the
   `coast` facet stops being whole numbers.
8. The thaw's +10 morale, and `checkRunEnd`.

Then `MOVE` writes `trod[key(to)] = day` **before** `advance` — after it, the
stamp is off by one per step, in a hashed field, with nothing else pointing
at it — reveals, and rolls `derive(\`fire:${day}:${key(at)}\`)` for a card.

**The gates are evaluated, not assumed.** The licence above says a port may
skip a subsystem that produces no state change; that is only worth having if
something checks the subsystem really was inert. So each skipped one is
ported as far as its gate and records a reason in `FSimState::Unported` if
the gate opens — an unsworn hand, a pair with heat between them, a cold
night, a card dealt. Both harnesses fail on a non-empty `Unported` however
well the hashes match, because a green reached by quietly not running
something is not a green. Run past the rung and it says so by name: at @8
five facets still match and `run` does not, with `maybeFireEvent: the road
dealt a card` printed beside it.

**And it caught a fourth portability trap, which is the reason for all this.**
`line()` in `src/hex/grid.ts` adds **1e-6 to both axials before rounding** —
"epsilon nudge breaks exact-tie rounding deterministically", one comment, easy
to read past — and `round()` in `src/hex/coords.ts` has only TWO branches, so
on a `dr`/`ds` tie it leaves both coordinates alone and lets `s` absorb the
error. The C++ was a cube-space rewrite with a third branch and no nudge. It
passed stage 4, because no sight line from a landing happens to hit a tie.
The band's first step hits one: from 4,15 the line to 6,14 passes through
5,15 in the TypeScript and 5,14 in the port, and 5,14 blocks sight. One hex
of fog, seventeen characters, a whole facet red. Reading the two versions
side by side would not have found it; compiling both and diffing the
canonical text found it in a minute.

Two smaller things landed with it. `seeNeighbours` is **not** skippable on
this rung — a hall three hexes off the fourth day's march comes into view and
`found` is thirteen characters of the `coast` facet — so it is ported.
And the number formatter moved: `ULandnamCanonical::Number` now delegates to
`Landnam::CanonicalNumber` in the sim core, because a clock produces fractions
and the standalone harness has to be able to print them. The twenty vectors
that already pinned it now pin the one implementation.

### The second rung: the event deck

`Sim/LandnamEvents.{h,cpp}` interprets the deck and matches @8 (a `MOVE`
deals a card), @9 (`CHOOSE`) and @10 (`DISMISS_EVENT`). Eight checkpoints
green now, counting the landing.

**This is the one place in the sim where the stream has a position, and it is
the whole difficulty of the rung.** `maybeFireEvent` takes TWO draws off ONE
derived generator, in order:

```ts
const rng = stream(seed,'events').derive(`fire:${day}:${key(at)}`);
if (!rng.chance(eventChance(state))) return;    // draw 1
const def = rng.weighted(pool, e => e.weight);  // draw 2, SAME rng
```

The licence at the head of this section — that a port may skip a subsystem
because no draw site holds a position — does not reach INSIDE a single call.
Skip the first draw and the second returns a different card, and it reads as
a disagreement about the deck rather than about the order.

Two more things are load-bearing and easy to miss:

- **The pool's order.** `weighted` walks the eligible cards subtracting
  weights until a roll goes negative, so the port must filter the deck in
  DECLARATION order. A sort or a map deals a different card from the same
  seed. `test/tables.test.ts` pins the generated header against that order.
- **`flags['seen_<id>']` is set BEFORE the check**, so a card that was
  answered is marked whether it went well or badly. Set it after and a
  `once` card comes round again after a failure.

All sixteen eligibility conditions are ported, none stubbed. The
settlement-shaped ones are genuinely false rather than unimplemented, and
that distinction is the rung: a port that answered `settled` wrong would
deal a different card and match nothing after it.

Effects split the way the rung does. The seven that only move numbers, flags,
standing or fog are ported; the six that reach into a fight, a death, an
injury, a hand joining or a thing learned record themselves in `Unported`.

### The third rung: the posts go in the ground

`Sim/LandnamSteading.{h,cpp}` ports `src/sim/site.ts` and the structural half
of `src/sim/colony.ts`, and matches @11 (`FOUND`), @12 (`ENTER_COLONY`),
@13 (`ASSIGN`), @19 (`QUEUE_BUILD`) and @21 (`LEAVE_COLONY`). **Thirteen
checkpoints green now — @0 through @21.** It stops at @22, the first day a
settled band actually works.

**Founding turns half the day cycle back on.** Every subsystem rung 1 walked
past because its gate read `state.settlement` now runs for real. Most are
still shut on day ten — a raid cannot come before day twelve, nobody calls
before fifteen — but they are shut for reasons the port evaluates.

Two draw orders in here are easy to get backwards:

- **The steading's name draws its SUFFIX first**, off the same generator as
  the root, and the two are concatenated the other way round. Draw the root
  first and every steading in the country is misnamed from a stream that
  still looks perfectly healthy.
- **`makePlots` walks `range()` in RING order**, and `plots` is an array in
  the hashed state. The C++ `Range` had been a `Dq`/`Dr` double loop since
  stage 1 — the same SET, a different ORDER, and invisible while the only
  caller was the fog, which puts its answers in a map. A set that is only
  ever a set is a fine place to take a shortcut, right up until somebody
  iterates it. It is `ring()` now, exactly as `src/hex/grid.ts` writes it.

The one thing that did not match first try was `moodTarget`, and it is worth
recording because the failure was so quiet: it grows a JOB TERM the moment
`state.settlement && atHome(state)`, and on the founding day all six are
unassigned, so every one of them takes the full −12. Every facet size was
right and one hash was wrong — which is the shape of a value error, and
exactly what `size` is beside the hash to tell you.

`workTheDay`'s idle penalty is the other measured surprise: six hands with
nothing to do is −3.6 morale, **larger than the +8 for founding at all**.
The founding day reads 78 → 86 → 82.4 → 83.4.

The stores became doubles here. A roof saves 0.8 of a night's firewood per
point of shelter and a farmer's day produces a fraction of a meal, so `food`
and `firewood` are numbers rather than counts in the TypeScript; they were
whole on both sides until something fractional touched them, which is not
the same as being integers.

### The fourth rung: a settled band works, and a lesson about gates

`CAMP` and the production model. **Sixteen checkpoints green — @0 through
@55**, which is fifty-five actions and thirty-two days: the landing, the
road, two cards, the posts, a longhouse and farm plots standing, a smokehouse
on the stocks.

The production model matched first try — `output` is `ground * skill *
seasonFactor * kept`, entirely deterministic, and writing the draw order out
first meant there was nothing to find. What did not match is more useful.

**A hardcoded gate answer is a time bomb the skip mechanism cannot see.**

Rungs 1 to 3 dismissed subsystems two ways: with a `Skipped` call that
evaluates the gate and reports if it opens, and — much more often — with a
COMMENT saying the gate was shut. Every comment was true when written. Three
of them stopped being true the moment the posts went in, and nothing said so,
because `Unported` only reports what a check reports and a comment is not a
check:

- `conditionHolds` answered `settled`, `atHome` and `built` with a flat
  `false`. The port went on dealing a walking band's deck to a settled one.
  First symptom: a different card on day 24, fourteen characters into the
  `run` facet.
- `telegraphWinter` was dismissed as "gated on a settlement, and this rung
  has none". It writes FLAGS, which are hashed, from day 25. Symptom: a
  twenty-two character gap on day 25.
- `eventChance` has a settled-at-home branch — defence and a stood watch buy
  QUIET, which is what the defence score is for — and the port used the
  road's flat chance everywhere. Symptom: a card dealt on day 28 that the
  reference implementation never deals.

All three are fixed by reading the state instead of asserting about it, and
every remaining dismissal in `passDay` is now an evaluated check. The raid
roll and both joining rolls are TAKEN, off ported odds, and report rather
than fight or recruit. What that buys is visible at @132, which fails by
naming its own two blockers: `neighboursCallOn` and the winter forecast.

One more of the same shape, and nothing would have caught this one either:
`State.Flags["workedOnce"]` to ASK whether the band had worked yet would have
INSERTED a nought — `operator[]` on a `std::map` is not a query, and the flags
are hashed, so merely asking would have written down the answer. It is a
`find` now.

### The size check was measuring the wrong thing

`size` beside every hash is meant to separate *"different values"* from
*"different SHAPE"*. Both harnesses compared `std::string::size()` — UTF-8
BYTES — against a number the TypeScript produced with `.length`, which is
UTF-16 CODE UNITS. They agree on ASCII and nowhere else.

It surfaced the first time a card body with an em dash and a hint with a
middle dot reached a facet: **the hash matched and the size was three too
long**, which is a contradiction, because the hash is computed from the very
text being measured. `Landnam::CanonicalLength` counts units now.

It was already wrong before this rung and nobody could have known: the
`Þórr-vik` seed's `run` facet is 245 units and 247 bytes, so stage 4's own
size check would have failed by two the first time anyone opened the editor —
on a state it had computed perfectly.

### The standalone harness is committed now

`Tools/run-parity.sh` compiles the sim core with `g++` and checks it against
`port/parity.json`. It needs a compiler and node and **nothing else** — no
Unreal, no editor. Every stage of this port has been compiled and run rather
than read over, and it was throwaway each time; four traps in, it is worth
keeping. It parses no JSON: the harness prints a reading per checkpoint and
the script pulls the expectations, the seed and the moves out of the repo
that owns the rules, so nothing about the run is retyped on the C++ side.

## How to use it from the C++ side

1. Load `parity.json`. For each run, take `seed` and `hardship`.
2. If `script` is null there are no actions — this is the worldgen bar, and
   it is the one to turn green first.
3. Otherwise load the named `runs/*.json` and apply its actions in order.
4. At each checkpoint's `afterActions`, assert `day` and `refusedSoFar`, then
   assert **only the facets your stage owns**. Ignore the rest until you
   own them.

`refusedSoFar` matters as much as the hashes. `apply` declines an action by
handing back the same state, and a replay that starts refusing has already
diverged — the script was recorded against a game that offered different
choices. It is the earliest possible warning and it says *where*.

## The C++ side, as it stands

| File | What it is |
| --- | --- |
| `Source/LandnamUE/LandnamCanonical.{h,cpp}` | the canonical form and the state hash |
| `Source/LandnamUE/LandnamSimParityTest.cpp` | the harness — `Landnam.SimParity` |
| `Source/LandnamUE/Sim/LandnamWorldgen.{h,cpp}` | **stage 1**: the country itself |
| `Source/LandnamUE/Sim/LandnamParty.{h,cpp}` | **stage 2**: the six off the knarr |
| `Source/LandnamUE/Sim/LandnamCoast.{h,cpp}` | **stage 3**: who else is on this coast |
| `Source/LandnamUE/Sim/LandnamLanding.{h,cpp}` | **stage 4**: the rest of the landing, and `FSimState` |
| `Source/LandnamUE/Sim/LandnamDay.{h,cpp}` | **stage 5**: the day cycle and `MOVE` |
| `Source/LandnamUE/Sim/LandnamEvents.{h,cpp}` | **stage 5**: the event deck |
| `Source/LandnamUE/Sim/LandnamSteading.{h,cpp}` | **stage 5**: the steading and the work pass |
| `Source/LandnamUE/Sim/LandnamEventTables.generated.h` | the deck, from `npm run event-tables` |
| `Source/LandnamUE/Sim/LandnamCanon.{h,cpp}` | the canonical form, in the sim core's own types |
| `Tools/parity-harness.cpp`, `Tools/run-parity.sh` | the standalone `g++` check |
| `Source/LandnamUE/Sim/LandnamPartyTables.generated.h` | names and traits, from `npm run party-tables` |
| `Content/Data/parity.json`, `Content/Data/runs/*.json` | copies of the files above |

**`LandnamCanonical` is ported first on purpose.** Every facet of every
checkpoint ends up as a string it produced, so a disagreement there would be
mistaken for a disagreement about the rules for as long as it took to find.
Its number formatting was compiled and run against the vectors rather than
merely written beside them — 20 of 20, including `1e+21`,
`1.00000000000000e-7`, `1e+300` and `-0`.

**The harness is honestly green today.** It checks the canonical form for
real, and it SKIPS the six sim facets by name, because none of them is ported
yet. That is deliberate: a test that stays red for the months a port takes is
a test everybody learns to ignore, and by the time it matters nobody is
reading it.

**Stage 1 is done and green.** `Sim/LandnamWorldgen` ports `src/sim/worldgen.ts`
and `src/sim/noise.ts` and matches `worldgenHash` on all five seeds, the
non-ASCII one included. It is written free of Unreal — plain C++ and the
standard library — so the identical translation unit compiles in the editor
and in a standalone harness that can be run against the vectors on any machine
with a compiler. That is not tidiness: it is the only reason the port could be
verified at all before an editor was opened, and it caught two real bugs (a
precedence error in mulberry32, and the NUL salt above) that reading the code
would not have.

**Stage 2 is done and green too.** `Sim/LandnamParty` ports
`src/sim/people.ts`, `src/sim/kin.ts` and the stores in `create.ts`, and
matches the `band` facet at checkpoint 0 on all five seeds — canonical
lengths and hardship-varying stores included. It matched first try, which is
worth attributing: the one thing written out before any code was the DRAW
ORDER, because every value comes off one stream in one sequence and an extra
draw, a missing one or two swapped puts every person after it wrong. Two
places where that bites are commented at the call sites — a duplicate name is
discarded draws-and-all without rewinding the stream, and `byname` and `age`
are drawn AFTER the stats because they sit in an object literal, which
JavaScript evaluates in property order.

Its tables come from `npm run party-tables`, which restates `src/data/*.ts`
as a C++ header. A generated header rather than JSON because the standalone
harness has no JSON parser and should not grow one. Content is still authored
in exactly one place: add a name or a trait in `src/data` and re-run it.

**Stage 3 is done and green.** `Sim/LandnamCoast` ports
`src/sim/neighbours.ts` and matches the `coast` facet at checkpoint 0 on all
five seeds. It turned up one hazard worth knowing about: the TS sorts hex keys
with `localeCompare`, which is ICU collation and **not** code-unit order —
`'-,'.localeCompare(',')` is -1 where `'-,' < ','` is false — and is
ICU-version dependent, so C++ cannot copy it. It does not have to: on the
alphabet a hex key can use the two orderings coincide, measured across five
worlds and 1872 keys each. The port sorts by bytes and `test/parity.test.ts`
pins the equivalence, so a future ICU that disagrees fails in the repo that
owns the rules rather than silently in Unreal.

**Stage 4 closes checkpoint 0 entirely, and it is the milestone worth
naming: a new game in C++ is bit-identical to a new game in TypeScript across
every facet** — world, band, coast, steading, field and run, twenty of twenty
checks over five seeds. It adds what `newGame` does after `generateWorld` and
the `world` facet carries: the landing's name, the trodden hex, the seeded
places, and the fog lifted around the beach (which needed hex line, range and
line-of-sight, plus the terrain table that says what stops a view).

`steading` and `field` are `{}` at a landing, and checking them is not a
formality — a band off the knarr has no settlement and is in no fight, so
empty is the right answer and a port that invented either would fail.

**Stage 4 was the last thing reachable before `apply()`.** Every checkpoint
past 0 needs the action loop, which stage 5 opens.

Stages 2, 3 and 4 are checked at checkpoint 0 and on the bare runs only, which is exactly
as far as it reaches — every later checkpoint needs upkeep and travel, and
claiming those would turn a real bar into a red one nobody could act on.

Stage 1 targets `worldgenHash` rather than the `world` facet on purpose — the
facet also carries the landing's name, the trodden hexes and the seeded
places, which need the place tables ported first.

`ReadFacet(facet, seed, hardship, afterActions)` in the test is where a later
stage plugs in. Return `{ true, canonicalText }` for the facet you own and it is
checked against vectors that were already there; leave the rest and they go
on being skipped. Worldgen turns `world` green without a single rule ported.

## Adding a field to GameState

Place it in a facet in `src/run/parity.ts`, or add it to `NOT_IN_ANY_FACET`
with a reason. `test/parity.test.ts` fails until you do one or the other.
That is deliberate: the alternative is a new subsystem that every green
facet quietly declines to check.

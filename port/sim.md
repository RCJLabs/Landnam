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
at **@0 through @55 of `runs/long.json` and @0 through @13 of
`runs/example.json` — 25 checkpoints across two countries, six facets each**
— and stops where it names its own blockers.

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

### The fifth rung: half the script

The two blockers the port named at @132 turned out to be the last big ones on
this side of a fight. `neighboursCallOn` and the winter FORECAST both landed
first try, and then @660 named `maybeJoin` — people actually arriving — and
`takeIn` opened two more gates behind it, `handsLeave` and `stirGrudges`,
because a joiner arrives at 45 morale and that is what makes both of those
possible at all.

**27 checkpoints green: `runs/long.json` @0 through @660 and
`runs/example.json` @0 through @13.** Six hundred and sixty actions, two
hundred and forty-eight days, six facets each. The stop is `B_END_TURN` at
@852 — the battle, and `field` is the one facet that has only ever been `{}`.

Three things worth keeping from it:

- **The forecast is the only place a `hardship` term is applied
  asymmetrically.** `plannedFirewood` does NOT multiply the non-winter branch
  by the country's terms and does multiply the other two. Tidying that into
  consistency would forecast a different summer.
- **`takeIn` reuses `makePerson` exactly**, bond and all — somebody who walks
  up the strand is drawn from the same sequence as somebody who stepped off
  the knarr, because `bond` is a plain parameter and takes no draw. That is
  what made the rung small.
- **`nextId` had to become a real field.** It was a headcount plus one, which
  is true right up until somebody joins and somebody else dies.

### The sixth rung: the field

`field` is the one facet that has only ever been `{}`, and both scripts stop
at the same verb. The smaller of the two openings is the one to take:
**`runs/example.json` @16**, where a card's outcome is dismissed and a fight
appears. Every action before it — `FORAGE`, `MOVE`, `CHOOSE`,
`DISMISS_EVENT` — is already in the harness's vocabulary, so the rung needs
no new verb to be REACHED, only one (`B_END_TURN`) to be carried past.

Measured first, as every rung before it. At @16 the `field` facet is 5289
characters where it was 2, and `run` has shrunk from 819 to 303 — the card
gone, `BATTLE` on the mode stack, `battles` counted. Five foes, six of ours,
eleven combatants, a 7×9 grid, an initiative order, one log line and **two
beats**. `battle.beats` is hashed: the `beats` that `port/sim.md` excludes
from the facets is the top-level presentation stream, not the fight's own,
which lives inside the `battle` object and is 173 of those 5289 characters.

**The draw order, written out before any C++.** One derived generator per
concern, and inside `generateBattlefield` one draw per hex in a fixed sweep:

1. `pushMode('BATTLE')`.
2. `rng = stream(seed,'combat').derive("battle:" + day + ":" + key(at))` —
   `"raid:"` when it is a raid, which is a different stream entirely.
3. `pickSeaField` only on ocean, `pickRaidField` only on a raid: **neither
   draws here**, and getting that wrong would shift everything after it.
4. `generateBattlefield(terrain, rng.derive('ground'))` — `rng.next()` once
   per NON-deployment hex, **row-major, rows 2 to 6, columns 0 to 6**: 35
   draws. Deployment rows (0, 1, 7, 8) are open ground and take no draw.
   Then `ensureCrossable` draws `int(1,5)` only if no column runs walkable
   end to end, and `ensureFront` draws `pick(MIDDLE_ROWS)` and `int(0,3)`
   only if no middle row can hold four abreast. Both are conditional, and
   both are counted before they are needed.
5. `rollFoes(rng.derive('foes'), ...)`, and the two draw sites **alternate**:
   `weighted(FOE_ARCHETYPES)` for each foe, then that foe's own draws, then
   the next foe's archetype. Per foe: the stat loop, then `name`, `byname`,
   `age` — in the object literal's source order, which is where they happen.
   The stat loop **draws on every iteration, including the ones that hit the
   cap of 6 and change nothing**, so the number of draws a foe costs depends
   on what it rolled.
6. `anointChampion(foes, rng.derive('champion'))` — only when two or more
   stand and either it is a raid or word has spread. On day 15 with nothing
   sacked, `wordBump` is nought and no champion is raised.
7. Deployment takes **no draws at all**: `place()` scores every free spot by
   elbow room and centring and takes the first best, ours then theirs.
8. `startingNerve` per combatant — no draws — then
   `rollInitiative(rng.derive('initiative'))`, **one `roll(1,6)` per
   combatant in the order they were placed**, sorted afterwards by
   initiative and then by personId.
9. `refreshTurn`, and then `playUntilOurTurn` runs foe turns until the
   warband has the field. Each blow derives its own generator from
   `label:day:round:turnIndex`, which is the positionless pattern again — a
   foe's swing cannot be moved by what any other foe did.

The AI is deterministic apart from those blows, and its scoring is where a
port goes quietly wrong: `positionScore` is compared with a strict `>` and
the reach map is walked in insertion order, so two hexes that score alike
are decided by which one Dijkstra found first.

**It matched on the first run, and that is what the draw order buys.**
`Sim/LandnamBattle.{h,cpp}` is about twelve hundred lines and it went green
at `runs/example.json` @16, @17, @21, @31 and @34 without a single failed
attempt — the ground, the five foes, the deployment, the initiative order,
the log line, the beats, and then thirty-five turns of fighting with strikes,
glances, shoves, thrown spears, broken nerve and men going down. **33
checkpoints across two runs.** Run it past the last vector and it keeps
matching to @51, which is the whole fight.

Three things are worth writing down, because none of them would have been
found by reading:

- **`battle.beats` is hashed and the top-level `beats` is not.** They are
  different streams with the same name. The facet table above excludes the
  presentation window because it is capped and two implementations may
  legitimately hold different parts of it; the fight's own stream lives
  INSIDE the battle object, is 173 characters of the first checkpoint, and
  has to match exactly. The port stores each beat as its finished canonical
  text at the moment it is emitted — a beat is a record and nothing ever
  reads one back, so the only property it needs is the string it hashes to,
  and nine shapes with different optional fields are far safer sorted once
  than modelled twice.
- **A JavaScript `Map` iterates in insertion order, and the AI leans on it.**
  `reachWithZoc` returns one, `reposition` walks it comparing with a strict
  `>`, and two hexes that score alike are settled by which one the search
  reached first. A `std::map` would have sorted them and played a different,
  perfectly plausible fight. Same lesson as `Range` in the third rung, one
  level up: a container that is only ever a set is a fine place to take a
  shortcut right until somebody iterates it.
- **The deployment rows take no draw at all.** `generateBattlefield` rolls
  once per hex only where the ground is not a deployment row — 35 of 63 — so
  a port that rolled for the whole grid would be 28 draws ahead by the time
  it rolled the foes, and every foe on the field would be a different man.

And one thing the rung fixed on the way past: the run facet's `tally` was
nine literal noughts with `seaDays` carried beside it. True for exactly as
long as nothing could count a fight.

### The seventh rung: what the field leaves behind, and the last page

`B_LEAVE` at @51, the reckoning at @52, and then the run simply ends. **All
nineteen checkpoints of `runs/example.json` are green — the whole script, 62
actions, from the landing to the last page.** With `runs/long.json` @0
through @660 that is **37 checkpoints across two countries**.

It is three things that only look like one:

- **`settleAftermath`.** Who was dragged off the field lives, is maimed or is
  not: `roll(2,6) + floor(spirit/2)` against a bonus that says whether the
  ground was held, broken off, or lost. Then the loot, then what the living
  learned. `rollFate` reads the RAW spirit — `person.stats.spirit`, not
  `effectiveStat` — so the wounds a man is already carrying do not decide
  whether the next one kills him.
- **Injuries stopped being a count.** `FSimPerson::Injuries` had been an
  `int32_t` for five rungs and that was RIGHT: the only thing that looked at
  them was the mood target, which takes 9 off per injury. The aftermath is
  where a wound starts subtracting from a swing, so labels, stat penalties
  and healing times all had to become real — and `mendInjuries` with them,
  which had been an evaluated gate reporting itself since the first rung.
  The `effect` is a *partial*: the stats a wound does not touch are ABSENT
  from the canonical form, never written as nought, which is why the
  generated table carries a present-flag beside every number.
- **`end` was the last field of the run facet nothing could write.** Every
  path that would set one reported itself in `Unported` instead — honest,
  and not the same as playing a run to its end. As It Lies closes on day 22
  with five of six alive, no firewood, thirty food and no heart left: the
  ending is `despair`, and it is the branch's own distinction that decides
  it — a band that breaks with an EMPTY store is told it starved, because
  that is what happened and it is what they could have done something about.
  Thirty in the larder is the case despair was always for.

Two draw orders inside it, both written down before the code and both
right first time: `maim` draws the 0.18 chance BEFORE it picks the template
off whichever table that chose, and the loot draws food's multiplier before
firewood's off one generator. Named locals for both, because `+` still does
not sequence its operands in C++.

**And `Apply` had to be put back in `apply`'s order.** The port had answered
the CARD first and then routed by mode, which is the other way round from
`apply` — the aftermath sits between the colony verbs and the card, and it
has a visible consequence: a band standing on its own hearth can step into
the colony with its dead still unnamed. Nothing had ever collided, because
`dismissEvent` clears the card before it draws steel. Moving it surfaced one
real thing the old order had been hiding for free: `ENTER_COLONY` refuses
while a card is on the table, and it refuses because IT checks, not because
something upstream got there first.

### `runs/long.json` @852 is a RAID, and the harness says so

The obvious next step was the fight in the long run, and it is a different
one: the port reaches @852 and stops with `maybeRaid: somebody came over the
ridge`. A raid is fought on an authored approach filtered by what the
steading holds, defended by whoever stayed behind rather than by the sworn,
and settled by holding or losing the ground. Three facets still match there,
which is the ramp doing its job — the disagreement is named and bounded
rather than being "the states differ".

### The eighth rung: somebody comes for the steading

Every action type in `runs/long.json` is now in the harness's vocabulary, so
the raid is the ONLY thing between the port and @1320 — the whole
1320-action script, 457 days, seven fights, and a run that ends `survived`.

**The draw order, written out before any C++, as every rung before it.**

1. `maybeRaid`, in the day cycle: gated on no ending, no fight, no card, a
   settlement, and day 12. Then **one** draw off
   `stream(seed,'events').derive("raid:" + day)` against `raidOdds`, which
   the port has taken and thrown away since the fourth rung.
2. `startRaid`: terrain off the tile under the STEADING. `noteRaidSent`
   takes no draw — it marks the angriest neighbour found and lifts the fog
   on their hex, which is `coast` and `world`.
3. `rng = stream(seed,'combat').derive("raid:" + day + ":" + key(party.at))`
   — **the party's hex, not the steading's**, and `"raid"` where the open
   field says `"battle"`. Two chances to derive a different stream entirely.
4. `pickRaidField(home.plots.map(kind), rng.derive('ground'))` — ONE draw,
   off the SAME label the open field spends 35 on. The authored map is
   parsed with no draws at all, so a raid is 34 draws cheaper than a meeting
   on the road; the shared label is what keeps everything after it in step.
5. `standAtHome(homeCrew(state))`: the sworn first, then hands to fill the
   line, never wider than `SWORN_MAX`. This is 6.2's whole bargain — the
   hands hold their own hall, which is what frees the sworn to go out.
6. `rollFoes(rng.derive('foes'), …, raid = true, raiderCap(state), word = 0)`
   — same alternation as the open field, different arithmetic:
   `round(size * 0.9 + difficulty * 0.5)` against
   `min(14, 9 + floor(winters + roofs/2 + jarl*2))`. Word does not reach a
   raid; a raid has its own escalation.
7. **Every raid is led.** `anointChampion(foes, rng.derive('champion'),
   sender?.champion)` fires whenever two or more stand, where the open field
   needs word to have spread. The byname is `known?.byname ??
   rng.pick(CHAMPION_BYNAMES)` and `??` SHORT-CIRCUITS — a man who has
   walked off our field before arrives under his own name and takes no draw
   at all.
8. Deployment into the two rows behind the palisade and the raiders' two at
   the top; then nerve, then initiative, exactly as the open field.

And the settling-up, which is the half a raid has that nothing else does:

- Held → `holdSteading`: +12 morale, `raidsHeld`, and `learn('shieldcraft')`
  if anything fell. A line that held is a line you can explain to somebody,
  and it is the only thing in the game that teaches it — which puts it in
  the `coast` facet.
- Lost → `sackSteading`, off `stream(seed,'events').derive("sack:" + day)`:
  **shuffle the hands and take two FIRST**, then pick what burns. One
  generator, that order.

**@852, @874 and @875 all matched first try**, and the raid on day 312 is
lost: two hands carried off, a building fired, the watch back to nought.

**One half of the champion is ported and NOT verified, and it is worth
saying so.** He is anointed — that draw happens, and everything downstream
of it matches — but on this coast nobody is angry enough to have sent him:
`raidSource` wants a neighbour at negative standing and finds none, so
`championOf` is never set, the `champion` field on a neighbour is never
written, and `settleChampion` never runs. The `coast` facet is byte-identical
at @660 and @1320. So the code for a RECURRING enemy — the scars, the
short-circuited byname, the clan that loses the man who led them — is
written against the reference implementation and pinned by nothing. It is
the only part of this rung with that status, and it stays flagged until a
run reaches it.
Two things behind it did not:

- **A card can raid too**, and it brings its own arithmetic:
  `startRaid(state, difficulty + raidDifficulty(state))`, so a card that
  draws raiders onto a rich hall is not the fight it draws onto a shieling.
  The port had that branch reported rather than run, and it fires on day
  390 of the long script.
- **An empty larder wounds the weakest**, and that is the last thing in
  `passDay` that had been reported since the first rung. The order inside
  the branch is morale, then the wound, then the streak; `weakest` reduces
  with a strict `<` so it keeps the first of equals; and `wound` does NOT
  set `diedOn`, which is what keeps a starved band from also counting as
  grieving.

**Both scripted runs are now green end to end — 41 checkpoints.**
`runs/long.json` is 1320 actions, 457 days, seven fights and a run that ends
`survived`; `runs/example.json` is 62 actions on the same seed with no terms
named, and ends `despair` on day 22. That is the whole of stage 5 as the
vectors measure it.

What is still reported rather than run, and what it would take:

| Reported | What it needs |
| --- | --- |
| a cold night with teeth in it | `coldNight` and the illness table |
| a fight afloat | `seaFields`, and what a hull is worth losing |
| an expedition launched | `src/sim/expedition.ts` |
| a Thing called | `src/sim/thing.ts` and the jarldom |
| bad blood between two of them | `src/sim/feuds.ts` |
| the `wound`, `injure` and `kill` card effects | nothing new — `Wound`, the injury table and `Mourn` all landed with the aftermath, so each is a few lines. They stay REPORTED because neither script deals one, and a port written against a bar that cannot fail is how the fourth rung's gates got in. |

None of them is reached by either script, which is exactly why they are
still `Unported` entries rather than code: the bar cannot see them, and a
port written against a bar nobody can fail is how the fourth rung's three
hardcoded gates got in.

**Lore is real now, and it retires a report.** `learn` had been gated since
the second rung because nothing could hold what was learned. Three things
teach: a card's `learn` effect, a raid HELD (`shieldcraft` — a line that
held is a line you can explain to somebody, and it is the only thing in the
game that teaches it), and finishing a DOCK, which is a season of looking at
hulls out of the water. That last one had been an `Unported` entry;
`LearnLore` is three lines and it is gone.

**One duplicate went with it.** The verb name → `ESimAction` mapping existed
TWICE — once in the editor's automation test, once in `parity-harness.cpp` —
and every rung that added a verb had to add it to both by hand. They had
already drifted. `ActionKindOf` is in the sim core now; the two harnesses
still read their own arguments, because one is handed a JSON object and the
other a command line, but which verb a name means is one fact in one place.

### What is left is the thing this port has never had

`Landnam.SimParity` has never been run in a real Unreal editor. It has been
true since the first rung and it is now the largest unverified claim in the
port: the sim core is proven by `g++` and by CI on every push, and the
hundred-odd lines of UE-typed glue around it — the JSON reader, the
`FString`↔`std::string` conversions, the automation assertions — are proven
by nothing at all. Every rung since has added more of them.

Nothing in this repo can close that. What has been done instead is to shrink
it: the canonical form has one implementation, the facets have one, the
action mapping now has one, and everything the editor test asserts is
computed by the same translation units the standalone harness compiles.

### The sim core did not compile as a unity build, and nothing could see it

Unreal builds a module by concatenating several `.cpp` files into ONE
translation unit. Anonymous namespaces from different files then merge, and
a helper each file kept privately to itself stops being private. Every rung
of this port was verified by compiling a FILE AT A TIME, which is blind to
all of it.

Asked what an editor build would need, the honest answer turned out to be
"it would not have started". Six collisions, in a core that has been green
against the vectors for a week:

- **`Skipped` defined identically in three files** — a hard redefinition.
- **`FromKey` in two** — the same.
- **A private `Distance` in `LandnamCoast.cpp` shadowing the exported one**,
  which is not an error where it is defined but makes EVERY call site in
  four files ambiguous.
- **`FField` meaning two different things** — a noise sample in worldgen, a
  beat's key/value pair on the field — and then a cascade of unrelated
  `std::pair` errors downstream of the clash.
- **A fourth private copy of `CanonicalString`**, escaping only `"` and
  `\`. `LandnamCanon.h` says in its own header comment that three copies
  were consolidated; this was the one that got missed, and it is the exact
  drift that note exists to prevent.

All six are fixed by having one of each thing: `Skipped` is a real function
in the sim core, `Distance` and `HexFromKey` moved in beside `HexKey` and
`Neighbors` where the other hex primitives live, and the two name clashes
got names of their own.

**`Tools/run-parity.sh` now compiles the whole core as one translation unit
on every run**, which costs about a second and is the closest this repo can
get to proving the editor build without an editor. CI runs it on every push.
It is a bar that was failing the entire time nobody had written it.

**And the generated headers are `*.gen.h` now, not `*.generated.h`.** That
suffix is UnrealHeaderTool's, and this module really does have `UCLASS` and
`USTRUCT` types in it, so UHT runs and writes files by exactly that name
into `Intermediate/`. Three hand-written tables sitting in `Source/` under
the tool's reserved convention is a collision waiting for a build nobody has
done yet — and it misleads a human reader too, who would reasonably assume
UHT produced them.

### Two runs, not one — and what the second one found

`runs/example.json` is the same seed with **no terms named**, which defaults
to As It Lies. Until now nothing had exercised the hardship table past a
landing: every scripted checkpoint the port had ever met was A Fair Country.
Running both is 25 checkpoints, and it cost one verb — `FORAGE` — and found
three things the first run could not:

- **The hardship id was never normalised.** `newGame(seed, hardship =
  BALANCED_HARDSHIP)` defaults an unnamed country, and `hardship` is a hashed
  field. The port carried the right NUMBERS off the right row and wrote down
  the wrong name — four characters, and only on a run that names no terms.
- **On As It Lies the fire goes out.** Stores off the knarr are 8 firewood
  instead of 20, so the cold branch of `passDay` runs — a branch A Fair
  Country never reaches in either script. Summer's bite is nought, so it is
  three points of morale and no wounds; autumn and winter have teeth and
  report themselves.
- **A field that can be empty must not be positional.** The harness read
  `SEED HARDSHIP MOVES` off one line, and a null hardship let `read` hand
  `HARDSHIP` the first MOVE — so the port ran on terms called "forage", one
  action short. Two characters in the run facet were the only symptom. It
  reads three lines now.

### The committed vectors had drifted, and nothing was looking

`Content/Data` holds copies of the vectors so a bare clone can be checked and
so the editor's tests have something to read. Nothing compared them to the
originals. **The committed `golden.json` was missing six `hashString`
vectors — every non-ASCII case and the emoji**, which are precisely the ones
that pin the UTF-16 surrogate handling that `ToUtf16` exists for. The
editor's `Landnam.Parity` was passing a contract with its hardest cases taken
out.

`Tools/run-parity.sh` diffs all four copies against the originals whenever
the real repo is beside it, and refuses to run on a stale one — a green
against vectors nobody maintains is worse than a red. It is a CHECK rather
than a copy on purpose: this script must not quietly rewrite the thing it is
about to assert against.

### The harness runs itself now

`.github/workflows/parity.yml` runs it on every push to a work branch. The
repo had no CI at all, and a check somebody has to remember is a check that
eventually nobody runs. It needs `g++` and node and nothing else — which is
only possible because the sim core is free of Unreal.

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
| `Source/LandnamUE/Sim/LandnamBattle.{h,cpp}` | **stage 5**: the field, the turn cycle and the foe AI |
| `Source/LandnamUE/Sim/LandnamEventTables.gen.h` | the deck, from `npm run event-tables` |
| `Source/LandnamUE/Sim/LandnamBattleTables.gen.h` | foes, ground and lore, from `npm run battle-tables` |
| `Source/LandnamUE/Sim/LandnamCanon.{h,cpp}` | the canonical form, in the sim core's own types |
| `Tools/parity-harness.cpp`, `Tools/run-parity.sh` | the standalone `g++` check |
| `Source/LandnamUE/Sim/LandnamPartyTables.gen.h` | names and traits, from `npm run party-tables` |
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

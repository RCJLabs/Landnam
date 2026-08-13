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

## The canonical form

Documented in `src/run/headless.ts` and tested in `test/headless.test.ts`.
Two rules, both there so a second implementation can produce the same string
without guessing:

- **Object keys are sorted.** JavaScript preserves insertion order and
  another language's map will not.
- **Numbers are written explicitly.** Integers as integers; fractions to 15
  significant digits. Left to a runtime's shortest-round-trip printing, two
  languages disagree quietly about identical values. `-0` hashes as `0`.

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

`ReadFacet(facet, seed, hardship, afterActions)` in the test is where a stage
plugs in. Return `{ true, canonicalText }` for the facet you own and it is
checked against vectors that were already there; leave the rest and they go
on being skipped. Worldgen turns `world` green without a single rule ported.

## Adding a field to GameState

Place it in a facet in `src/run/parity.ts`, or add it to `NOT_IN_ANY_FACET`
with a reason. `test/parity.test.ts` fails until you do one or the other.
That is deliberate: the alternative is a new subsystem that every green
facet quietly declines to check.

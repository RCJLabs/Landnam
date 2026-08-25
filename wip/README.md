# Work in progress, parked on purpose

Nothing in here is built, imported, or run. It is work that was finished
enough to be worth keeping and stopped for a reason recorded in ROADMAP.md.

## `8.1c-source-conversion.patch`

The whole `src/` half of Phase 8.1c — the battle verbs moving off hexes and
onto the line. Written 2026-08-25, `tsc` clean across all of `src/`, and
reverted the same day without being committed.

It was not abandoned because it was wrong. It was parked because finishing it
means finishing 8.1e in the same sitting: the moment the verbs move onto the
line, every tuned number in `wall.test.ts` and `balance.test.ts` moves with
them, so there is no green state between "converted" and "re-tuned". See
ROADMAP.md, Phase 8.1c.

What it contains, nine files:

| file | what changes |
|---|---|
| `sim/strike.ts` | strike, reach and throw ask the rank table, not hex distance |
| `sim/wall.ts` | the shield wall is adjacent RANKS |
| `sim/footwork.ts` | `doMove` gone; shove drives back a rank; dash changes rank |
| `sim/ranks.ts` | gains `screen()` — the man directly in front |
| `sim/actions.ts` | `B_MOVE` removed, `B_DASH` takes a direction |
| `render/battle.ts` | shove preview names who comes forward |
| `render/battleScreen.ts` | a tap on bare ground no longer moves anybody |
| `audio/cues.ts` | the step cue drops `B_MOVE` |
| `test/reach.test.ts` | `screenFor` loses its now-irrelevant target argument |

To pick it up: `git apply wip/8.1c-source-conversion.patch`, then do the test
half. It may not apply cleanly if `src/sim` has moved since — the patch is a
head start, not a promise.

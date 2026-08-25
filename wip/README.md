# Work in progress, parked on purpose

Nothing in here is built, imported, or run. It is work that was finished
enough to be worth keeping and stopped for a reason recorded in ROADMAP.md.

## `8.1c-source-conversion.patch`

Phase 8.1c — the battle moving off hexes and onto the line. **All of `src/`
and most of the tests**, 2,556 lines across 23 files. `tsc` is clean on the
whole tree with it applied. 1,182 of 1,198 tests pass; 15 fail.

It is not abandoned and it is not broken. It is parked because of what the
second attempt proved, which is worth more than the code:

> **8.1c cannot be finished by fixing a list of failures, because every fix
> moves the numbers.** `wall.test.ts` was green mid-session — formation 31/60
> against brawl 23/60 — and went red again after later changes to
> `strikeTargets` and the test fixtures. This is a CONVERGENCE exercise
> against the balance sweeps, not a patch list, and it needs a sitting where
> the 40-minute sweep can run repeatedly until the numbers settle.

### What the conversion did

| file | what changed |
|---|---|
| `sim/ranks.ts` | the reach table, `screen()`, `canLandOn()`, open-ended back ranks |
| `sim/strike.ts` | strike/reach/throw ask the rank table, not hex distance |
| `sim/wall.ts` | the shield wall is adjacent RANKS |
| `sim/footwork.ts` | `doMove` gone; shove drives back a rank; dash changes rank |
| `sim/zoc.ts` | rewritten — zone of control becomes "who can reach me" |
| `sim/morale.ts` | shoulder-mates by rank; a broken man gives ground down the line |
| `sim/battle.ts` | `strikeTargets` on ranks; `reachableHexes`/`reachCosts` deleted |
| `sim/battleAi.ts` | `reposition` becomes `takeRank` |
| `sim/warcry.ts` | earshot is ranks, not hexes |
| `render/*`, `audio/cues.ts` | `B_MOVE` gone; no move-target or threat overlays |
| 12 test files | bots, fixtures and claims re-expressed in ranks |

### Three findings worth keeping

**The old design was already a line wearing a grid.** `canReachAt` demanded
distance 2 PLUS a mate adjacent to both the thruster and the target — which
is a hex spelling of "you are in the second rank, behind your shield-brother".
`strike.ts` is 289 lines and six of them were hex.

**Formation still beats brawling, and by MORE.** Measured mid-conversion:
31/60 wins and 147 standing against 23/60 and 117. The hex version was 33 v 30
and 157 v 142. The worry that a line would make the shield wall free — because
everybody always has shoulder-mates — did not survive measurement.

**Dash is still a trap, but the opposite trap.** On the hex field, spending
the turn running got you killed: fewer wins AND fewer survivors. On a line
there is nowhere to run to, so a band that shuffles ranks never closes with
anybody — `dash only` came home with 9/60 wins and 268 survivors against
30/60 and 143. It survives by not fighting, and loses.

### A real bug it found, and fixed

`RANKS = 4`, but a warband is six sworn. The reach tables listed ranks 1–4, so
the fifth and sixth men could do NOTHING — no strike, throw, defend or dash.
They stood in the wall with nothing they were allowed to do. `ranks.test.ts`
had asserted "every rank can act" but only checked as far as `RANKS`, so a
played battle caught it rather than the bar. Fixed with `deep` on the reach
table: an axe and a spear have a length and stop where the list stops; a
thrown axe and a man shouldering forward do not. The bar now checks past
`RANKS`.

### What is left, and the one piece with a blast radius

Eight files, fifteen tests. Most are fixtures still placing fighters by hex.
Two of them are not:

- **`headless.test.ts` and `parity.test.ts` need `runs/*.json` RE-RECORDED.**
  The recorded runs contain `MOVE` actions that no longer exist, so they
  cannot replay. `scripts/record.ts` has to be converted too — its bot issues
  the actions. This is the piece to think about before starting: those runs
  are also the parity fixture's input, the repaint browser bar's input, and
  the source of the "531 days, 78 hexes charted" figures the whole oil arc was
  measured against. Re-recording moves all of it.
- **`wall.test.ts` and `balance.test.ts`** hold the tuned numbers and will
  keep moving until the rest settles.

To pick it up: `git apply wip/8.1c-source-conversion.patch`. It may not apply
cleanly if `src/sim` has moved since — it is a head start, not a promise.

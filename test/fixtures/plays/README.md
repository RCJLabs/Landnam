# Runs a person actually played

Empty, and that is 12.12's unfinished half.

Everything else in that item is built: the recorder (`src/record.ts`), *Copy
the play* on the Day card, the replay, and the interface bot. What is missing
is the only part a bot cannot supply — **a run somebody played by hand**.

`PROBE 12.12` is why it matters. Over 30 settler sagas to day 400 the harness
landed 18,733 steading moves by calling the sim directly, and the player's
interface would have refused every one: 11,639 taken from the road and 7,094
taken from inside a battle. Every figure in ROADMAP.md belongs to a band that
crews its yard mid-fight. A recorded human run is the only fixture in this
repo that a bot cannot re-record to whatever the rules now say — which is
precisely why the hex-era long run got re-recorded four times and stopped
being evidence of anything.

## Putting one here

1. Play. Any length; a first winter is already worth having.
2. Open **The Day** and tap **Copy the play**.
3. Save what is on the clipboard as `test/fixtures/plays/<a-name>.json`.
4. `node scripts/play.mjs test/fixtures/plays/<a-name>.json` — this replays it
   and writes the state hash into the file.
5. Delete the "no human play yet" assertion at the bottom of
   `test/humanplay.test.ts`. It exists to fail the moment this folder stops
   being empty, so that nobody has to remember this step.

## When one of these fails later

It means a rule moved under a run a person played. That is the finding, not
the fixture's fault. **Do not re-record it.** Read `stoppedAt` — the index of
the first action the rules would no longer take — and decide whether the rule
change was meant. A fixture re-recorded to agree with the code is a bar that
has been quietly lowered to whatever the code now does.

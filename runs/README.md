# Runs

Scripts for the headless runner. A run is a **seed, terms, and a list of
actions** — nothing else, because everything else about a saga is derivable
from those three. That is what a deterministic sim is for. A script that
needed the state to make sense would be a save, not a script.

```bash
npm run play -- --seed raven-skerry-317          # generate a world, print its hash
npm run play -- --script runs/example.json       # replay a recorded run
npm run play -- --script runs/example.json --saga
npm run record -- --seed grim-fjord-100 --out runs/mine.json
```

`example.json` is a real recording, replayed by `test/headless.test.ts` on
every run. If it ever starts refusing actions, that is a rules change worth
knowing about — not a broken test.

## What the hashes are for

`worldHash` is the generated country alone; `hash` is the whole run minus the
saga (prose gets reworded, and a hash that moved on a reworded sentence would
cry wolf until nobody looked at it).

Both are FNV-1a over a canonical form with sorted keys and explicitly written
numbers — deliberately, because the hash's real job is to be reproducible in
a **second implementation**. `hashString` is already pinned bit-for-bit in
`port/golden.json`, so a port that passes the RNG contract has nothing new to
agree about but the canonical form, which is documented in
`src/run/headless.ts` and tested in `test/headless.test.ts`.

That makes the cheapest possible cross-implementation check one command on
each side: same seed, same `worldHash`, or the two builds are not playing the
same game. Nothing else is worth comparing until that matches.

## What it does not do

The recorder plays badly on purpose — camp, forage, take the first option —
because its job is to produce a real action list of real length, not to play
well. The bot that plays properly is in `test/balance.test.ts` and stays
there: it is a measuring instrument with its own policies, and a second copy
here is how the two would drift.

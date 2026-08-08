# ue-port — the Landnám → Unreal porting kit

Landnám's game logic is a pure library that knows nothing about SVG. That is what
makes an Unreal version tractable: the rules travel, and only the pictures get
rebuilt. This folder is the bridge — the foundation layer already ported to C++,
the content tables already exported, and proof that the port behaves identically to
the game you can play in a browser today.

Nothing here affects the web game. `ue-port/` sits outside `src/`, so Vite never
bundles it and `tsconfig.json` never type-checks it. The single-file build is untouched.

**Start with [GETTING_STARTED.md](GETTING_STARTED.md)** — it walks from a fresh Blueprint
project to a hex grid you can click on.

## What is in here

```
Source/
  LandnamHex.h/.cpp        FHex + UHexLib — axial coords, neighbours, distance,
                           ring, range, line, A*, and Dijkstra movement range.
                           A port of src/hex/coords.ts, grid.ts, path.ts.
  LandnamRng.h/.cpp        ULandnamRng — seeded mulberry32 with named streams.
                           A port of src/rng.ts, bit-for-bit.
  LandnamDataRows.h        FTerrainRow / FFoeArchetypeRow, so the exported JSON
                           imports as DataTables. Plus ColorFromHex.
  LandnamParityTest.cpp    The automation test that proves all of the above.

Content/Data/
  terrain.json             8 terrain types, DataTable-ready.
  foes.json                4 enemy archetypes, DataTable-ready.
  foe-names.json           Name and byname lists (plain JSON, not a DataTable).
  golden.json              Parity vectors measured from the real TS.

tools/
  load-game.mjs            Bundles src/*.ts so node can import the real modules.
  export-data.mjs          src/data/*.ts  ->  Content/Data/*.json
  golden.mjs               src/hex + src/rng  ->  Content/Data/golden.json
  verify-port.mjs          Checks the C++ algorithms without needing Unreal.
```

## Why the parity test matters

The Unreal build has to agree with the browser build about what a seed means. If
`raven-skerry-317` grows a different island in Unreal, then every balance number in
`ROADMAP.md` — the 25% that see first spring, the 60-seed bot runs — describes a
game that no longer exists, and the design work has to start over.

So the port is held to bit-exactness rather than "close enough":

- `tools/golden.mjs` runs the **real** `src/hex` and `src/rng` and records what they
  produce — 6,141 measurements covering rounding at tie boundaries, A* routes over a
  blocked cost field, and 250 raw 32-bit draws from each of the six named streams.
- `LandnamParityTest.cpp` makes the C++ reproduce every one of them.
- `tools/verify-port.mjs` checks the same vectors against a faithful transliteration
  of the C++, so the algorithms can be validated on any machine, with no engine installed.

That last one is the quick gate. Run it any time you touch the hex or RNG code:

```sh
node ue-port/tools/verify-port.mjs
```

It is a real test, not a rubber stamp — flipping the rounding rule, reordering the
six directions, or changing one shift in the generator each make it fail.

## Regenerating

After changing `src/hex/`, `src/rng.ts`, or `src/data/`:

```sh
node ue-port/tools/golden.mjs        # refresh parity vectors
node ue-port/tools/export-data.mjs   # refresh DataTable JSON
node ue-port/tools/verify-port.mjs   # confirm the port still matches
```

Then copy the changed files from `Content/Data/` into the Unreal project's
`Content/Data/` and re-import the DataTables.

Both generators are deterministic — running one twice produces a byte-identical file,
so a no-op regeneration never shows up as a diff.

## What is not ported yet

The battle, travel, and colony rules in `src/sim/` are still TypeScript. They are the
next layer, and they port the same way: pure functions with Vitest suites that become
the acceptance spec. The battle slice — selection, movement range, A* move, Strike,
turn order — is the milestone after the grid is on screen.

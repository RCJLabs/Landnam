# From a blank project to a hex grid you can click

You have Unreal 5.6 installed and a Blueprint Top Down project called `LandnamUE`.
This walks you the rest of the way: version control, Landnám's real hex math running
as C++, and a grid on screen that answers clicks.

Budget an evening. Nothing here needs C++ knowledge — you copy four files in and
never edit them. Everything you build, you build in Blueprints.

Paths below assume the project lives at `Documents/Unreal Projects/LandnamUE`.

---

## Step 0 — Version control, before you change anything

Unreal projects grow fast and are full of binary files. Set this up now, while there
is nothing to lose.

Close the editor. Open a terminal in the project folder and run:

```sh
cd "$HOME/Documents/Unreal Projects/LandnamUE"
git init
git lfs install
git lfs track "*.uasset" "*.umap"
```

Create a `.gitignore` in that folder containing:

```gitignore
Binaries/
Build/
DerivedDataCache/
Intermediate/
Saved/
.vs/
*.sln
*.VC.db
*.opensdf
*.sdf
*.suo
```

Then:

```sh
git add .gitattributes .gitignore .
git commit -m "Top Down template, before any changes"
```

Those ignored folders are all regenerated from source — committing them would add
gigabytes and constant churn for nothing. `.gitattributes` is written by `git lfs track`
and **must** be committed, or LFS does nothing on other machines.

---

## Step 1 — Make it a C++ project

The project is Blueprint-only right now, so it has no `Source` folder to put the hex
library in. One throwaway class creates the whole C++ scaffolding.

1. Open the project.
2. **Tools → New C++ Class…**
3. Parent class: scroll down and pick **None**. Click **Next**.
4. Name it `LandnamBootstrap`. Click **Create Class**.
5. Unreal writes the Source folder, compiles, and offers to open your IDE. Let it finish,
   then **close the editor**.

You now have `Source/LandnamUE/` containing `LandnamUE.Build.cs` and the bootstrap
class. The bootstrap class does nothing and can be deleted later; it existed only to
turn the project into a code project.

---

## Step 2 — Copy the kit in

From this repo into your Unreal project:

| From `ue-port/` | To `LandnamUE/` |
| --- | --- |
| `Source/LandnamHex.h`, `LandnamHex.cpp` | `Source/LandnamUE/` |
| `Source/LandnamRng.h`, `LandnamRng.cpp` | `Source/LandnamUE/` |
| `Source/LandnamDataRows.h` | `Source/LandnamUE/` |
| `Source/LandnamParityTest.cpp` | `Source/LandnamUE/` |
| `Content/Data/*.json` | `Content/Data/` (create the folder) |

Then open `Source/LandnamUE/LandnamUE.Build.cs` in any text editor and add `"Json"`
to the dependency list, so the parity test can read `golden.json`:

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core", "CoreUObject", "Engine", "InputCore", "Json"
});
```

Leave the rest of the file alone — your list may have more entries than this from the
template, and they all stay.

---

## Step 3 — Compile

New files need a full build; Unreal's Live Coding only handles edits to files it already
knows about.

1. In Explorer, right-click `LandnamUE.uproject` → **Generate Visual Studio project files**.
   (On Windows 11 it may be under *Show more options*.)
2. Open `LandnamUE.sln`.
3. Set the configuration to **Development Editor** and the platform to **Win64**.
4. **Build → Build Solution**, and wait.
5. Reopen the project in Unreal.

If the build fails, read the *first* error, not the last — later ones are usually
knock-on effects. The most common cause here is `"Json"` missing from `Build.cs`.

---

## Step 4 — Prove the port is correct

This is the step that makes everything afterwards trustworthy.

**Tools → Test Automation**, expand the tree to find **Landnam → Parity**, tick it, and
click **Start Tests**.

It should pass, having made about six thousand checks. What it just proved: this C++
produces exactly the same hexes, the same A* routes, and the same random numbers as the
TypeScript game. A seed means the same thing in both. Every balance figure in
`ROADMAP.md` still describes the game you are building.

If it fails with *"Could not read .../Content/Data/golden.json"*, the JSON files from
Step 2 did not land in the right folder.

---

## Step 5 — Import the content tables

1. In the Content Browser, make a folder called `Data`.
2. Drag `terrain.json` into it (from the project's `Content/Data`, or use **Import**).
3. Unreal asks for a row type. Choose **TerrainRow**. Import.
4. Repeat with `foes.json`, choosing **FoeArchetypeRow**.

Open the terrain table and you should see 8 rows — ocean, shore, meadow, forest, hills,
mountains, bog, valley — with the same costs and yields the web game uses. `Cost` of
`-1` means impassable, which is how the ocean's `Infinity` survives the trip through JSON.

Skip `golden.json` and `foe-names.json` — those are read as plain files, not imported.

---

## Step 6 — Make a hex mesh

1. Top-left mode dropdown (it says **Selection**) → **Modeling**.
2. **Shapes → Cylinder**.
3. In the tool settings on the right, set **Radius** `100`, **Height** `10`,
   and **Radial Steps** `6`.
4. Click in the viewport to place it, then **Accept**.
5. Find the new mesh in the Content Browser and rename it `SM_HexTile`.

Radius 100 matters: the library measures a hex by its **centre-to-corner** distance, so a
radius of 100 tiles perfectly at `HexSize = 100`. If your tiles overlap or leave gaps
later, this number and `HexSize` disagree.

Also make a material to colour them:

1. Content Browser → **Add → Material**, name it `M_HexTile`.
2. Open it. Add a **VectorParameter** (hold `V` and click), name it `Colour`, and connect
   it to **Base Color**.
3. Save.

---

## Step 7 — BP_HexTile

**Add → Blueprint Class → Actor**, name it `BP_HexTile`. Open it.

1. **Add Component → Static Mesh**. Set its **Static Mesh** to `SM_HexTile`.
2. In **My Blueprint**, add a variable named `Hex`, type **Hex** — that is the struct from
   the C++ library. Tick **Instance Editable**.
3. Add a variable `TileMaterial`, type **Material Instance Dynamic** (Object Reference).
4. On **Event BeginPlay**:
   - `Static Mesh` → **Create Dynamic Material Instance** (Element Index 0, Source Material
     `M_HexTile`) → promote the result into `TileMaterial`.
5. Add a function **SetColour** with a `Colour` input of type **Linear Color**:
   - `TileMaterial` → **Set Vector Parameter Value**, Parameter Name `Colour`, Value = input.

Compile and save.

A dynamic material instance is what lets each tile hold its own colour — without it,
every tile shares one material and they would all change together.

---

## Step 8 — BP_HexGrid: the grid comes from Landnám's own maths

**Add → Blueprint Class → Actor**, name it `BP_HexGrid`. Open it.

Add these variables:

| Name | Type | Default | Instance Editable |
| --- | --- | --- | --- |
| `Radius` | Integer | `6` | yes |
| `HexSize` | Float (Double) | `100.0` | yes |
| `TileClass` | Class Reference → BP_HexTile | `BP_HexTile` | yes |
| `Tiles` | Map: **Hex** → **BP_HexTile** (Object Reference) | — | no |

On **Event BeginPlay**:

1. **Make Hex** (Q `0`, R `0`) → feed into **Hex Range** along with `Radius`.
   This returns every hex within `Radius` steps — the same function the web game's
   world map uses.
2. **For Each Loop** over that array. For each element:
   - **Hex To World** (Hex = element, Size = `HexSize`) → gives a world location.
   - **Spawn Actor from Class**: Class = `TileClass`, Location = that result,
     Collision Handling = **Always Spawn, Ignore Collisions**.
   - On the returned actor: **Set Hex** = the loop element.
   - **Add** to `Tiles`: Key = loop element, Value = the spawned actor.
3. After the loop: **Get Player Controller (0)** → **Set Show Mouse Cursor** `true`,
   and **Set Enable Click Events** `true`.

Drag `BP_HexGrid` into the level. Delete the template's floor if it gets in the way, and
lift the grid actor to `Z = 100` or so if tiles are buried in it.

Press **Play**. You should see 127 hexes in a neat hexagonal field — radius 6 — with no
gaps and no overlaps.

That field is `HexRange`, straight out of `src/hex/grid.ts`. You did not reimplement it.

---

## Step 9 — Click a tile, light up its neighbours

In **BP_HexTile**:

1. Select the **Static Mesh** component. In Details, search for *collision*, and set
   **Collision Presets** to **BlockAll** so clicks can hit it.
2. In the **Class Defaults**, or on the component, ensure clicks are received.
3. Add the event **On Clicked** (right-click in the graph → *Add Event → Actor → On Clicked*).
4. From it: **Get Owner**… actually simpler — add a variable `Grid` of type
   `BP_HexGrid` (Object Reference), set it from the grid when spawning in Step 8, then
   call `Grid → HighlightAround(Hex)`.

In **BP_HexGrid**, add a function **HighlightAround** with a `Centre` input of type **Hex**:

1. **For Each Loop** over `Tiles` (use *Get Keys* / *Values*) → call `SetColour` with a
   plain grey. This clears the last selection.
2. **Hex Neighbors** (`Centre`) → **For Each Loop** → **Find** in `Tiles` → if valid,
   `SetColour` with a warm colour.
3. Finally, look up `Centre` itself in `Tiles` and `SetColour` it something brighter.

Press Play and click around.

The interesting part is the edges: click a tile on the rim and only three or four
neighbours light up, because the others were never spawned. Nothing special-cases
that — `HexNeighbors` always returns six, and the map lookup simply misses for the
ones outside the grid. That is the same reason the web game's edge-of-map handling
works without edge cases.

**You have now built the foundation of the battle grid.** Selection, movement range,
and pathing are the same three functions with different colours.

---

## Step 10 (optional) — Paint it with real terrain

A five-minute payoff that ties both libraries together.

In `BP_HexGrid`, add a variable `Seed` (String, default `raven-skerry-317`) and a
`TerrainTable` (Data Table reference, pointing at your imported `terrain` table).

In the spawn loop, before setting the colour:

1. **Make Stream** (Seed = `Seed`, Stream = **worldgen**) — do this once before the loop
   and store it.
2. Per tile: **Pick Index** with the number of terrain rows → **Get Data Table Row Names**
   → index into it → **Get Data Table Row** → gives you an `FTerrainRow`.
3. **Colour From Hex** on the row's `Fill` → feed into `SetColour`.

Now the map is painted in Landnám's own palette, from Landnám's own generator, and the
same seed gives you the same map every launch. Change one character of the seed and it
is a different island.

This is not worldgen yet — real worldgen lives in `src/sim/worldgen.ts` and weights
terrain by latitude and neighbours. But it proves the seeded pipeline works end to end.

---

## What to do next

The battle vertical slice, in this order, each step playable before the next:

1. One unit actor standing on a hex; click to select it.
2. Movement range: `Reachable` with the unit's budget and a cost function that reads the
   terrain table. Tint every hex it returns.
3. Movement: `Find Path` to the clicked hex, then walk the unit along the returned hexes.
4. A second, hostile unit. Strike when adjacent, using the rules in `src/sim/battle.ts`.
5. Turn order, then shield-wall adjacency, zone of control, and morale — one rule at a
   time, with `test/battle.test.ts` as the answer key.

Steps 2 and 3 need no new C++ at all: `Reachable` and `Find Path` are already there,
already tested, and already agree with the game you can play in a browser.

## If something goes wrong

**The build fails on `LandnamParityTest.cpp`.** `"Json"` is missing from `Build.cs`
(Step 2).

**Blueprint cannot find "Hex To World" or "Make Hex".** The C++ did not compile, or the
editor was not restarted after building. Also uncheck *Context Sensitive* in the node
search box while you look.

**Tiles overlap or leave gaps.** `HexSize` on the grid and the radius of `SM_HexTile`
disagree. Both should be `100`.

**Every hex looks rotated 30°.** The mesh's flat edges should face east and west, with
points north and south. Set the Static Mesh component's **Rotation Z** to `30` in
`BP_HexTile`.

**Clicks do nothing.** The mesh needs a blocking collision preset, and the player
controller needs `Enable Click Events` and `Show Mouse Cursor` (Steps 8 and 9).

**The parity test fails after you changed the TypeScript.** That is the test doing its
job. Regenerate the vectors — `node ue-port/tools/golden.mjs` — copy `golden.json` over,
and run it again.

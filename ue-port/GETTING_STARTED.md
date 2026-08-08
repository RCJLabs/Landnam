# From a blank project to a hex grid you can click

You have Unreal 5.6 installed and a Blueprint Top Down project called `LandnamUE`.
This walks you the rest of the way: version control, Landnám's real hex math running
as C++, and a grid on screen that answers clicks.

Budget an evening. Nothing here needs C++ knowledge — you copy four files in and
never edit them. Everything you build, you build in Blueprints.

Paths below assume the project lives at `Documents/Unreal Projects/LandnamUE`.

## Before you start

Two things must be installed, not one:

- **Unreal Engine 5.6**, via the Epic Games Launcher.
- **Visual Studio 2022**, with the **Game development with C++** workload ticked during
  installation. Unreal does not ship a C++ compiler — it borrows Microsoft's, and that
  workload is what supplies it. Community edition is free; budget about 15 GB.

Note that **Visual Studio and VS Code are different programs**. VS Code is a text editor
and cannot build Unreal C++, so having it installed does not cover this.

Check whether you already have Visual Studio:

```powershell
Test-Path "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
```

**True** means it is installed. **False** means install it before Step 3 — Steps 0 to 2
will run fine without it, and then the build will have nothing to compile with.

---

## Step 0 — Version control, before you change anything

Unreal projects grow fast and are full of binary files. Set this up now, while there
is nothing to lose.

Close the editor and open a terminal. Either **PowerShell** (the Windows default — hit
Start and type *PowerShell*) or **Git Bash** works; the commands below are given for
both where they differ. Old-style CMD does not understand `$HOME`, so if you end up
there, use `cd /d "%USERPROFILE%\Documents\Unreal Projects\LandnamUE"` for the first line.

```sh
cd "$HOME/Documents/Unreal Projects/LandnamUE"
git init
git lfs install
git lfs track "*.uasset" "*.umap"
```

Now write the ignore list. Do not try to make this file in File Explorer — right-click →
New will not accept a name that starts with a dot, and Notepad will quietly save it as
`.gitignore.txt`, which git ignores completely. Paste the whole block instead.

**PowerShell:**

```powershell
@'
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
'@ | Set-Content -Encoding utf8 .gitignore
```

**Git Bash:**

```bash
cat > .gitignore <<'EOF'
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
EOF
```

(If you would rather skip the terminal: open the project folder in VS Code and use
**New File**. It has no problem with leading dots.)

Check it took effect before committing:

```sh
git status
```

You should see a short list — `Config/`, `Content/`, `LandnamUE.uproject` and a handful
more. If instead you get a wall of paths under `Intermediate/` or `Binaries/`, the ignore
file did not land. Run `dir .git*` (PowerShell) or `ls -a` (Git Bash) and look for a stray
`.gitignore.txt`.

Once the list looks short:

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

### 2a. Get the kit onto this machine

`ue-port/` lives on the `claude/game-choice-unreal-engine-jy3yv5` branch of the Landnám
repo, so a clone sitting on `main` will not have it.

If you already have Landnám cloned here:

```powershell
cd "path\to\your\Landnam"
git fetch origin claude/game-choice-unreal-engine-jy3yv5
git checkout claude/game-choice-unreal-engine-jy3yv5
```

If you do not, put a copy anywhere convenient — it never has to live near the Unreal project:

```powershell
cd "$HOME\Documents"
git clone -b claude/game-choice-unreal-engine-jy3yv5 https://github.com/RCJLabs/Landnam.git
```

Either way you should end up with a `ue-port` folder holding `Source`, `Content` and `tools`.

### 2b. What goes where

| From `ue-port/` | To `LandnamUE/` |
| --- | --- |
| `Source/LandnamHex.h`, `LandnamHex.cpp` | `Source/LandnamUE/` |
| `Source/LandnamRng.h`, `LandnamRng.cpp` | `Source/LandnamUE/` |
| `Source/LandnamDataRows.h` | `Source/LandnamUE/` |
| `Source/LandnamParityTest.cpp` | `Source/LandnamUE/` |
| `Content/Data/*.json` | `Content/Data/` (create the folder) |

Mind the doubled folder name: module code belongs in `Source\LandnamUE\`, next to
`LandnamUE.Build.cs` — **not** in `Source\`. Unreal only compiles what sits inside a
module folder, so files one level too high are ignored without any error, and the first
sign of trouble is Blueprint not finding the nodes in Step 8.

Set the two paths once, and confirm them before copying anything:

```powershell
$kit  = "$HOME\Documents\Landnam\ue-port"              # adjust to your clone
$proj = "$HOME\Documents\Unreal Projects\LandnamUE"

Test-Path "$kit\Source\LandnamHex.h"
Test-Path "$proj\Source\LandnamUE\LandnamUE.Build.cs"
```

Both must print **True**. A wrong path otherwise copies nothing and only shows up much
later as a baffling build error. Once both are True:

```powershell
Copy-Item "$kit\Source\*" "$proj\Source\LandnamUE\"
New-Item -ItemType Directory -Force -Path "$proj\Content\Data" | Out-Null
Copy-Item "$kit\Content\Data\*" "$proj\Content\Data\"
```

**Or do it in Explorer**, which is just as good: open `ue-port\Source`, press `Ctrl+A`
then `Ctrl+C`, click into `LandnamUE\Source\LandnamUE`, press `Ctrl+V`. Then make a
`Content\Data` folder inside `LandnamUE` and copy the four JSON files across the same way.

While you are in there, one thing looks wrong but is not: `LandnamHex` and `LandnamRng`
each appear **twice** in the kit folder. Windows hides known extensions by default, so
the `.h` and the `.cpp` show the same name — the Type column tells them apart. Six
entries, six real files.

These are copies, not links, and that is deliberate — the Unreal project is its own repo
and should not be entangled with the game's. The trade is that regenerating the kit means
re-running these two `Copy-Item` lines.

### 2c. Declare the Json module

```powershell
notepad "$proj\Source\LandnamUE\LandnamUE.Build.cs"
```

Find the line beginning `PublicDependencyModuleNames.AddRange(new string[] {`. It already
has several entries — the Top Down template brings its own (`EnhancedInput`,
`NavigationSystem`, `AIModule`, `UMG` and more, depending on the variant).

**Add `, "Json"` immediately before the closing `}`.** Every existing entry stays; you are
appending one word, not rewriting the line. So if yours reads:

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput" });
```

it becomes:

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "Json" });
```

Save and close. `LandnamParityTest.cpp` reads `golden.json` with Unreal's JSON parser, and
Unreal refuses to link a module you have not declared. Miss this and Step 3 fails on that
one file.

### 2d. Check it before the long build

```powershell
(dir "$proj\Source\LandnamUE").Count
(dir "$proj\Content\Data").Count
Select-String -Path "$proj\Source\LandnamUE\LandnamUE.Build.cs" -Pattern "Json"
```

Expected answers: **11**, **4**, and one line echoing your dependency list with `Json` in
it. Eleven is the five files Step 1 created plus the six you just copied. Silence from the
third command means Notepad did not save.

`golden.json` is a plain file rather than a Unreal asset, so the Content Browser will not
show it. That is expected — the parity test reads it straight off disk.

---

## Step 3 — Compile

New files need a full build; Unreal's Live Coding only handles edits to files it already
knows about. Make sure Visual Studio is installed first (see *Before you start*) — nothing
below can work without a compiler.

### The easy way: let Unreal do it

1. **Close the Unreal editor** if it is open.
2. In Explorer, open the `LandnamUE` project folder and right-click **`LandnamUE.uproject`**
   → *Show more options* (Windows 11 hides it there) → **Generate Visual Studio project
   files**. It takes about half a minute.
3. **Double-click `LandnamUE.uproject`.**
4. Unreal notices the module has no compiled binaries and asks *"The following modules are
   missing or built with a different engine version: LandnamUE. Would you like to rebuild
   them now?"* Click **Yes**.
5. Expect **5 to 15 minutes** the first time — it is compiling the engine headers your
   module touches, not just six files. It is not hung.
6. The editor opens with everything loaded. Go to Step 4.

You never have to open Visual Studio for this. It only needs to exist, so Unreal can find
the compiler inside it.

### If that fails: build in Visual Studio

Unreal's failure box says little more than "could not be compiled", which is not enough to
act on. Visual Studio gives you real error messages with file names and line numbers.

1. Open **`LandnamUE.sln`** from the project folder.
2. In the toolbar, set the two dropdowns to **Development Editor** and **Win64**.
3. **Build → Build Solution** (`Ctrl+Shift+B`), and watch the Output pane. You want
   `Build: 1 succeeded`.
4. Reopen the project in Unreal.

This is the first time this C++ meets a compiler on your machine, so an error here is
ordinary, not a sign something is deeply wrong. Read the *first* error, not the last —
the rest are usually knock-on effects. The most common cause is `"Json"` missing from
`Build.cs`.

---

## Step 4 — Prove the port is correct

This is the step that makes everything afterwards trustworthy.

The test runner lives inside the Session Frontend, not on a menu of its own:

1. **Tools → Session Frontend**, then click the **Automation** tab.
2. Your running editor should already be picked in the session list at the top. If nothing
   is selected there, select it — the test tree stays empty otherwise.
3. **Refresh Tests** if the tree is empty, then type `Landnam` in the search box.
4. Tick **Landnam** (or expand it and tick **Parity**) and click **Start Tests**.

It finishes in a second or two, having made about six thousand checks. Click the test row
to read its log — it prints a line per section even when everything passes:

```
[hex.round] 169 checks, 0 failed
[hex.fromPixel] 441 checks, 0 failed
[rng.streams] 3294 checks, 0 failed
```

What that proves: this C++ produces exactly the same hexes, the same A* routes, and the
same random numbers as the TypeScript game. A seed means the same thing in both. Every
balance figure in `ROADMAP.md` still describes the game you are building.

A failing section names its first few mismatches with actual and expected values, so the
section name plus one line of output is usually enough to find the cause.

If it fails with *"Could not read .../Content/Data/golden.json"*, the JSON files from
Step 2 did not land in the right folder.

---

## Step 5 — Import the content tables

Unreal spots the new files on startup and offers to import all four as DataTables. Only
two of them are tables, so answer per file — the dialog names the one it is asking about
on its *Current File* line:

| File | Answer |
| --- | --- |
| `terrain` | Import As **DataTable**, Row Type **TerrainRow**, then **Apply** |
| `foes` | Import As **DataTable**, Row Type **FoeArchetypeRow**, then **Apply** |
| `foe-names` | **Cancel** — plain word lists, read at runtime |
| `golden` | **Cancel** — parity vectors, read off disk by the test |

Do not click **Apply to All**; it would force one row type onto all four. For the two that
are not tables the row-type dropdown is empty and `Apply` stays greyed out, which is the
dialog telling you the same thing.

If you dismissed the prompt, import them by hand instead: open the **Data** folder in the
Content Browser first (Import lands in whatever folder you are viewing), click **Import**,
pick `terrain.json`, and set the same two options.

**Then save.** Imported assets live only in memory until you do — `Ctrl+S` or
**File → Save All**. Skip it and they are gone when the editor closes.

Open the terrain table and you should see 8 rows — ocean, shore, meadow, forest, hills,
mountains, bog, valley — with the same costs and yields the web game uses. `Cost` of
`-1` means impassable, which is how the ocean's `Infinity` survives the trip through JSON.

To stop Unreal asking about the two raw files on every restart, turn off
**Edit → Editor Preferences → Loading & Saving → Auto Import → Monitor Content Directories**.

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

1. Content Browser → **Add → Material**, name it `M_HexTile`. Double-click to open it.
2. **Right-click in the empty graph space**, left of the `M_HexTile` node. A node search
   box appears — type `Vector Parameter` and pick **VectorParameter**.
3. With the new node selected, set **Parameter Name** to `Colour` in the Details panel on
   the left, and click its colour swatch to give it a mid-grey default.
4. Drag from the node's **top output pin** — the topmost of the five on its right edge —
   onto **Base Color** on the `M_HexTile` node.
5. **Apply**, then **Save**.

It has to be a *parameter*, not a plain colour. The `V`-and-click shortcut you may see
elsewhere makes a **Constant3Vector**, which is a fixed colour with no name — nothing can
change it at runtime, so every tile would be stuck grey.

---

## Step 7 — BP_HexTile

**Add → Blueprint Class → Actor**, name it `BP_HexTile`. Open it.

1. **Add Component → Static Mesh**. Set its **Static Mesh** to `SM_HexTile`.
2. In **My Blueprint**, add a variable named `Hex`, type **Hex** — that is the struct from
   the C++ library. Tick **Instance Editable**.
3. Add a variable `TileMaterial`, type **Material Instance Dynamic** (Object Reference).
   Add another named `Grid`, type **BP Hex Grid → Object Reference**, **Instance Editable**
   — Step 9 has the tile call back to its grid through this, and Step 8 fills it in.
   (`BP_HexGrid` does not exist yet, so add this one after Step 8 creates it.)
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

Two fiddly ones:

- **`TileClass`** must be a **Class Reference**, not an Object Reference. A class
  reference says "spawn one of these"; an object reference points at one that already
  exists, which is not what you have yet.
- **`Tiles`**: set the type to `Hex`, click the **container icon** beside the type
  dropdown and choose **Map**, and only then set the *second* dropdown that appears to
  `BP_HexTile` → Object Reference. **The first dropdown is the key, the second is the
  value** — get them the wrong way round and the Add node later offers an "Actions for
  2 pins" conversion menu instead of accepting the wire. Hover its Key pin to check:
  it should say `Hex`, not `BP Hex Tile Object Reference`.

Compile once before filling in the defaults — Blueprint will not let you set them until
the variables exist.

On **Event BeginPlay**:

1. **Make Hex** (Q `0`, R `0`) → feed into **Hex Range** along with `Radius`.
   This returns every hex within `Radius` steps — the same function the web game's
   world map uses.
2. **For Each Loop** over that array. For each element, chained by their exec pins:
   - **Hex To World** (Hex = element, Size = `HexSize`) → gives a world location. Set its
     **Z** pin to `20` so tiles are not buried in whatever the level's floor is.
   - **Spawn Actor from Class**: Class = `TileClass`, Collision Handling =
     **Always Spawn, Ignore Collisions**. Right-click its **Spawn Transform** pin →
     **Split Struct Pin**, then plug the location into the **Location** pin that appears.
   - Drag off the spawned actor's **Return Value** → **Set Hex** = the loop element.
   - Drag off **Return Value** again → **Set Grid**. For its value, right-click empty
     space → *Get a reference to self*. Step 9 needs this to call back.
   - **Add** to `Tiles`: Key = loop element, Value = the spawned actor.
3. After the loop — from **Completed**, not Loop Body: **Get Player Controller (0)** →
   **Set Show Mouse Cursor** `true`, and **Set Enable Click Events** `true`.

Drag `BP_HexGrid` into the level and set its Location to `0, 0, 0`. Tiles spawn at
absolute world coordinates, so the actor's own position does not move them; parking it at
the origin keeps the two in agreement.

The Top Down template ships a demo playground that will swallow the grid. Delete the
**Playground** folder in the Outliner — keep Lighting, `NavMeshBoundsVolume` and
`PlayerStart` — and save the level. The character will fall into the void afterwards,
which does not matter while you are looking at a grid.

Press **Play**. You should see 127 hexes in a neat hexagonal field — radius 6 — with no
gaps and no overlaps.

That field is `HexRange`, straight out of `src/hex/grid.ts`. You did not reimplement it.

---

## Step 9 — Click a tile, light up its neighbours

Build the grid's function first, so the tile has something to call.

### 9a. Give the mesh collision

A mesh built in Modeling Mode usually has none, and a click passes straight through it.

To find the asset: open `BP_HexTile`, select the **Static Mesh** component, and click the
**magnifying glass** beside its Static Mesh slot to browse to it. Modeling Mode saves
shapes wherever its *New Asset Location* setting points — often an `AutoGenerated` folder
— so it is not always where you left it.

1. Double-click `SM_HexTile` to open the Static Mesh Editor.
2. In **Details → Collision**, set **Collision Complexity** to
   **Use Complex Collision As Simple**. Save and close.
3. Back in `BP_HexTile`, select the **Static Mesh** component and set
   **Collision Presets** to **BlockAll**.

Complex-as-simple makes the collision the exact hex outline. The `Collision → Add Box
Simplified Collision` menu in that editor works too, but a box overhangs the corners, and
clicks near an edge would select the neighbour instead.

### 9b. BP_HexGrid: the HighlightAround function

**My Blueprint → Functions → +**, name it `HighlightAround`. Select its entry node and add
an input called `Centre`, type **Hex**.

Three sections, chained by their exec pins:

**Clear what was lit last time**

- `Tiles` (Get) → drag off → **Values**. That is every tile, as an array.
- Drag off that → **For Each Loop**.
- In the body: drag the **Array Element** → **Set Colour**. Click the Colour pin's swatch
  and choose a dark grey.
- Entry node ▶ this loop.

**Light the six neighbours**

- **Hex Neighbors**, with `Centre` plugged in.
- Drag off its output → **For Each Loop**.
- In the body: `Tiles` (Get) → drag off → **Find**, with the loop's **Array Element** as
  the **Key**.
- Drag off Find's **Found** boolean → **Branch**.
- Branch **True** → **Set Colour** on Find's **Value**, in a warm amber.
- Loop 1's **Completed** ▶ this loop.

**Light the clicked hex itself**

- `Tiles` (Get) → **Find**, Key = `Centre` → **Branch** on Found → True → **Set Colour**
  on the Value, in a bright yellow.
- Loop 2's **Completed** ▶ this.

Compile and save.

### 9c. BP_HexTile: report the click

1. In the Event Graph, right-click → search `On Clicked` → add
   **On Clicked (ActorOnClickedSignature)**.
2. Drag `Grid` in (Get) → drag off it → search `Highlight Around`.
3. Plug the tile's own `Hex` (Get) into that call's **Centre** pin.
4. Chain: **On Clicked** ▶ **Highlight Around**.

Compile and save.

Press Play and click around.

The interesting part is the edges: click a tile on the rim and only three or four
neighbours light up, because the others were never spawned. Nothing special-cases
that — `HexNeighbors` always returns six, and the map lookup simply misses for the
ones outside the grid. That is the same reason the web game's edge-of-map handling
works without edge cases.

**You have now built the foundation of the battle grid.** Selection, movement range,
and pathing are the same three functions with different colours.

If clicking does nothing, work down this list: the mesh has no collision (9a); the tile's
`Grid` was never filled in when it spawned (Step 8); or `Show Mouse Cursor` and
`Enable Click Events` were wired to the loop's Loop Body rather than its **Completed** pin,
so they only ran mid-loop or not at all.

---

## Step 10 — Terrain, and a real movement range

Step 9's highlight was adjacency. This one is the thing a tactics game actually runs on:
give every hex a terrain with a movement cost, then ask **how far can I get from here**.

The answer comes from `Reachable` in `src/hex/path.ts` — Dijkstra over the grid — and it
needs no new C++. It also finally uses the two things you imported in Step 5 and have not
touched since: the seeded RNG and the terrain DataTable.

### 10a. Let a tile remember its own colour

The range highlight has to be undoable, so each tile needs to know what it looked like
before. In **BP_HexTile**:

1. Add a variable `BaseColour`, type **Linear Color**, **Instance Editable**.
2. Add a function `ResetColour` with no inputs. In it: `BaseColour` (Get) → into a call to
   your own `Set Colour`. Entry node ▶ that call.

Compile and save.

### 10b. Give every hex a terrain

In **BP_HexGrid**, add three variables (compile once so you can set defaults):

| Name | Type | Default |
| --- | --- | --- |
| `Seed` | String | `raven-skerry-317` |
| `TerrainTable` | **Data Table** (Object Reference) | your imported `terrain` table |
| `Costs` | Map: **Hex** → **Float** | — |

Remember: the first type dropdown is the key, the second is the value.

Now extend the BeginPlay chain from Step 8. **Before** the For Each Loop:

1. **Make Stream** — Seed = `Seed`, Stream = **worldgen**. Right-click its return value →
   **Promote to Variable**, name it `Rng`.
2. **Get Data Table Row Names**, Data Table = `TerrainTable`. Promote its output to a
   variable named `TerrainNames`.
3. Exec: `Make Stream` ▶ `Get Data Table Row Names` ▶ the loop.

**Inside** the loop, after `SET Grid` and before `ADD`:

| # | Node | Connections |
| --- | --- | --- |
| 1 | `Rng` (Get) → **Pick Index** | Num ← `TerrainNames` **Length** |
| 2 | `TerrainNames` (Get) → **Get (a copy)** | Index ← node 1 |
| 3 | **Get Data Table Row** | Data Table ← `TerrainTable`, Row Name ← node 2 |
| 4 | **Break TerrainRow** | drag off node 3's **Out Row** and search `Break` |
| 5 | **Colour From Hex** | Hex ← node 4's **Fill** |
| 6 | **Set Base Colour** on the tile | Target ← SpawnActor Return Value, value ← node 5 |
| 7 | **Set Colour** on the tile | Target ← Return Value, Colour ← node 5 |
| 8 | **Add** to `Costs` | Key ← loop Array Element, Value ← node 4's **Cost** |

Exec: `SET Grid` ▶ node 3 ▶ node 6 ▶ node 7 ▶ node 8 ▶ `ADD` (nodes 1, 2, 4 and 5 are
pure — no exec pins, they just feed data).

Press Play. The board is now painted in Landnám's own palette, from Landnám's own
generator. **Change one character of the seed and it is a different island**, every time,
identically — that is what the parity test bought you.

The dark blue tiles are `ocean`, whose cost is `-1`: impassable, straight from the
`Infinity` in `src/data/terrain.ts`. Note that this is not worldgen — real worldgen lives
in `src/sim/worldgen.ts` and weights terrain by latitude and neighbours. This is a flat
random draw, which is enough to make movement cost visible.

### 10c. Show how far a unit could walk

In **BP_HexGrid**, add a variable `MoveBudget` (Float, default `6.0`), then a new function
`ShowRange` with a `Centre` input of type **Hex**.

**Clear the board:**

- `Tiles` (Get) → **Values** → **For Each Loop** → in the body, `Array Element` →
  **Reset Colour**.
- Entry ▶ Values ▶ loop; `Loop Body` ▶ Reset Colour.

**Then the range:**

| # | Node | Connections |
| --- | --- | --- |
| 1 | **Reachable In Map** | Start ← `Centre`, Budget ← `MoveBudget`, Costs ← `Costs` (Get) |
| 2 | **For Each Loop** | Array ← node 1 |
| 3 | **Break HexReach** | drag off node 2's Array Element → search `Break` |
| 4 | `Tiles` (Get) → **Find** | Key ← node 3's **Hex** |
| 5 | **Branch** | Condition ← node 4's Found |
| 6 | **Set Colour** | Target ← node 4's Value, Colour = a pale blue |

Exec: loop 1's **Completed** ▶ node 2; node 2's **Loop Body** ▶ node 5; node 5's **True**
▶ node 6.

Finally, in **BP_HexTile**, repoint the click: change the `On Clicked` chain to call
`Show Range` instead of `Highlight Around` (same `Centre` = `Hex` input).

Compile both, save, Play.

### What you should see

Click a hex and a blue region spreads out from it — **not a circle**. It reaches further
across meadow and shore than across hills and bog, and it stops dead at ocean, flowing
around it instead. Click next to a stretch of water and watch the range bend.

That shape is Dijkstra, from `src/hex/path.ts`, over costs from `src/data/terrain.ts` —
both running the same way they do in the browser. Nothing here approximates anything.

**This is the battle grid's movement system.** Give the budget to a unit instead of the
grid, and it is finished.

### Next after this

`FindPathInMap` is already sitting there, same shape: feed it Start, Goal and the same
`Costs` map, and it returns the actual route as an array of hexes. Colour that array and
you have a movement preview; walk a unit along it and you have movement.

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

**`git status` lists thousands of files.** The `.gitignore` from Step 0 is not being
read — almost always because it was saved as `.gitignore.txt`. Windows hides known
extensions, so check the true name with `dir .git*` or `ls -a`, rename it, and run
`git status` again. Do not commit until that list is short.

**`LandnamUE.sln` opens in Notepad.** Visual Studio is not installed — Windows has no
handler for `.sln` and falls back to a text editor. Install it per *Before you start*,
then re-run *Generate Visual Studio project files* so the solution targets it. If
Visual Studio *is* installed and this still happens, it is only a file association:
right-click the `.sln` → **Open with** → **Visual Studio 2022** → tick *Always use this app*.

**The build fails on `LandnamParityTest.cpp`.** `"Json"` is missing from `Build.cs`
(Step 2).

**Blueprint cannot find "Hex To World" or "Make Hex".** The C++ did not compile, or the
editor was not restarted after building. Also uncheck *Context Sensitive* in the node
search box while you look. If the build reported success but had suspiciously little to
do, check that the `.h` and `.cpp` files are in `Source\LandnamUE\` and not `Source\` —
Unreal skips anything outside a module folder without complaining (Step 2b).

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

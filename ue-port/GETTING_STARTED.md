# From a blank project to a hex grid you can click

You have Unreal 5.6 installed and a Blueprint Top Down project called `LandnamUE`.
This walks you the rest of the way: version control, Landnám's real hex math running as
C++, the full 52 × 36 world map painted from the game's own terrain table, and a unit that
walks it hex by hex.

Budget an evening. Nothing here needs C++ knowledge — you copy four files in and
never edit them. Everything you build, you build in Blueprints.

**One habit worth forming first.** Almost every failure in this guide is silent: a node
that never runs, a colour written to a material nobody renders, a volume moved instead of
resized. Blueprint rarely tells you. When something does nothing at all, select all in the
graph (`Ctrl+A`), copy (`Ctrl+C`) and paste the text somewhere you can read it — that dump
contains every node, wire and pin default, and it will show you in seconds what an hour of
squinting at the graph will not.

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
3. With the new node selected, set **Parameter Name** to `BaseColour` in the Details panel
   on the left, and click its colour swatch to give it a mid-grey default.
4. Drag from the node's **top output pin** — the topmost of the five on its right edge —
   onto **Base Color** on the `M_HexTile` node.
5. **Apply**, then **Save**.

It has to be a *parameter*, not a plain colour. The `V`-and-click shortcut you may see
elsewhere makes a **Constant3Vector**, which is a fixed colour with no name — nothing can
change it at runtime, so every tile would be stuck grey.

**Write `BaseColour` down.** Step 7 types that same name into a `Set Vector Parameter
Value` node, and the two must match character for character. A mismatch does not error —
the write simply goes nowhere and every tile stays the material's default grey. This is
the first of several failures in this guide that are completely silent.

---

## Step 7 — BP_HexTile

**Add → Blueprint Class → Actor**, name it `BP_HexTile`. Open it.

1. **Add Component → Static Mesh**. Set its **Static Mesh** to `SM_HexTile`.
2. **With that component still selected**, find **Materials → Element 0** in the Details
   panel and set it to `M_HexTile`. This one line matters more than it looks; see below.
3. In **My Blueprint**, add a variable named `Hex`, type **Hex** — that is the struct from
   the C++ library. Tick **Instance Editable**.
4. Add another named `Grid`, type **BP Hex Grid → Object Reference**, **Instance Editable**
   — Step 9 has the tile call back to its grid through this, and Step 8 fills it in.
   (`BP_HexGrid` does not exist yet, so add this one after Step 8 creates it.)
5. Add a function **SetColour** with a `Colour` input of type **Linear Color**. Three nodes
   in one straight line, no branch:

   | Node | Settings |
   | --- | --- |
   | `Static Mesh` (drag the component into the graph) | — |
   | **Create Dynamic Material Instance** | Element Index `0`, **Source Material empty** |
   | **Set Vector Parameter Value** | Target ← previous Return Value, Parameter Name `BaseColour`, Value ← the `Colour` input |

   Exec: entry ▶ Create Dynamic Material Instance ▶ Set Vector Parameter Value.

Compile and save.

**`BP_HexTile` has no Event BeginPlay.** It needs none, and giving it one causes a bug that
is genuinely hard to find.

A dynamic material instance (MID) is what lets each tile hold its own colour — without one,
every tile shares a single material and they all change together. But `Create Dynamic
Material Instance` does *two* things: it makes the MID **and** applies it to the mesh. Call
it in BeginPlay and again from the grid, and you end up with two MIDs per tile where only
the last one is actually being rendered. Colour writes land on the other one and vanish.
Which tiles work then depends on BeginPlay ordering, which looks random.

Doing it inside `SetColour` avoids all of that, because the node is idempotent: **if the
mesh already carries a MID, it returns that same one instead of making another.** That is
also why **Source Material must be left empty** — empty means "use whatever material is
already on this mesh as the parent". Naming `M_HexTile` there instead makes it call
`SetMaterial` first, replacing the MID and minting a fresh one on every single call.

And that is why step 2 assigns `M_HexTile` to the component. With Source Material empty,
nothing else ever puts a material on the tile — the mesh's own default has no `BaseColour`
parameter, so every write would silently do nothing and the whole map would stay grey.
The material belongs to what a tile *is*, not to something BeginPlay has to remember.

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

On **Event BeginPlay**, *first* — before anything else on the wire:

- **Get Player Controller (0)** → **Set Show Mouse Cursor** `true` → **Set Enable Click
  Events** `true`.

Put these at the **front** of BeginPlay, not after the loop. They are what makes clicking
possible at all in Step 9, and anything downstream of a loop is one wiring mistake away
from never running. They also cost nothing, so there is no reason to defer them.

Then, continuing that same exec chain:

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

**Both SET nodes, every spawn.** `Set Grid` is the one that gets dropped, and a tile with a
null `Grid` cannot report its own click — the call just does nothing, with no error. If
Step 9 ends up doing nothing at all, this is the first thing to check.

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
- Entry node ▶ **Values** ▶ this loop.

**`Values` has an exec pin and needs it wired.** It looks like a pure getter and is not.
Leave its white input arrow empty and Blueprint prunes the node, hands the loop an empty
array, and warns only in the compiler log — the function then runs, does nothing, and
reports no error at runtime.

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

**Set all three colour swatches deliberately.** A `Colour` pin left alone defaults to pure
black, which on a dark map reads as "nothing happened" rather than as a bug. The centre one
is the easiest to forget, because it is the last node you place.

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

Exec: `SET Grid` ▶ node 1 ▶ node 3 ▶ node 6 ▶ node 7 ▶ node 8 ▶ `ADD`, taking node 3's
**Row Found** output rather than its plain exec.

**Node 1, `Pick Index`, is on that wire — every RNG draw is.** `Pick Index`, `Next`,
`Roll`, `Chance`, `Shuffle Indices` and `Weighted Index` all have exec pins, because each
one advances the generator. A pure node may be evaluated any number of times depending on
how the graph compiles, which would scramble the sequence and cost you the determinism the
whole port is built on. Leave one unwired and Blueprint prunes it, its return value reads
as 0, and every tile silently gets the same terrain.

Nodes 2, 4 and 5 really are pure — they only read.

**Every node with a white left-hand arrow must have something plugged into it.** An
unwired impure node does not error; it just never runs. That is the single most common way
this step comes out grey.

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

## Step 11 — The real map: 52 × 36

Radius 6 was a first light. The actual world map is rectangular, and its dimensions are
already decided — `WORLD_WIDTH = 52`, `WORLD_HEIGHT = 36` in `src/sim/worldgen.ts`. That is
1,872 hexes, about fifteen times the radius-6 field.

Rectangular maps are authored in **odd-r offset space** (plain columns and rows) and stored
as axial. `OffsetToAxial` does that conversion, and it is already in the library.

In **BP_HexGrid**, add one variable:

| Name | Type | Instance Editable |
| --- | --- | --- |
| `MapHexes` | Array of **Hex** | no |

Then replace the `Make Hex` → `Hex Range` pair from Step 8 — delete both nodes, and the
`Radius` getter feeding them — with this, on the same exec chain:

1. **Clear** on `MapHexes`. (Without this, replaying in the editor appends a second map.)
2. **For Loop**, First Index `0`, **Last Index `35`** — the rows.
3. Its **Loop Body** ▶ a second **For Loop**, First Index `0`, **Last Index `51`** — the
   columns.
4. The inner loop's **Loop Body** ▶ **Add** on `MapHexes`, New Item ← **Offset To Axial**
   with **Col** = the inner loop's Index and **Row** = the outer loop's Index.
5. The **outer** loop's **Completed** ▶ the **For Each Loop** that spawns tiles (the one
   from Step 8, now iterating `MapHexes` instead of the `Hex Range` output).

Written out:

```
For Loop (rows, Last Index 35)
  └ Loop Body ▶ For Loop (cols, Last Index 51)
                  └ Loop Body ▶ Add to MapHexes
                  └ Completed ▶ (nothing)
  └ Completed ▶ For Each Loop (MapHexes) ▶ Spawn Actor …
```

**Step 5 is the whole trap.** It is natural to drag the spawn loop off the *inner* loop's
`Completed`, because that is the pin nearest your cursor when you finish building the inner
loop. Do that and the spawn loop runs once per row, over a `MapHexes` array that grows each
time: 52 tiles, then 104, then 156… `52 × (1+2+…+36)` = **34,632 actors** for an 1,872-hex
map.

What makes it vicious is that it still *looks* right. `Tiles` reports exactly 1,872, because
a map keyed by hex de-duplicates and keeps only the last actor spawned at each hex. All the
earlier duplicates are still in the world, stacked on top of it. Clicks hit the topmost
duplicate; `HighlightAround` recolours the registered one underneath. Colours change and you
cannot see them, on some tiles and not others, in a pattern that follows row number.

Symptoms worth recognising, because none of them point at a loop: a slow load, clicks that
do nothing, tiles that light up somewhere other than where you clicked, and highlights that
work near one edge of the map and not the other.

Also set **Last Index**, not Last Index minus one. A For Loop in Blueprint is inclusive of
both ends, so `0` to `35` is 36 rows. And check neither loop is left at the default `-1`,
which runs the body zero times and produces an empty map in silence.

### Where the map ends up

`HexToWorld` maps the browser's x-east/y-south into Unreal's X-north/Y-east, so at
`HexSize = 100` the grid occupies roughly:

- **X** from `0` to about `-5250`
- **Y** from `0` to about `+8900`

Which puts the centre near **`(-2600, 4500)`**. Two things want to know that:

- **`PlayerStart`** — leave it at the origin and you begin at a far corner of the map.
  Move it to about `(-2600, 4500, 200)`.
- The **NavMeshBoundsVolume**, in Step 12.

Press Play. Same generator, same palette, same seed behaviour as radius 6 — just the map
the game is actually designed around.

---

## Step 12 — Walk a unit, hex by hex

The Top Down template already has click-to-move. What it does not have is any notion that
the world is made of hexes: it walks the pawn to the exact point under your cursor, so it
stops between tiles and "which hex am I on" has no answer.

Three changes fix that. The first is a level setting, and the other two are in the player
controller.

### 12a. Give the map a NavMesh

`Simple Move to Location` only works inside a NavMesh, and the template ships one sized for
its little starting room — a fraction of a 52 × 36 map. Outside it, clicks do nothing at
all: no movement, no warning, no log line.

1. Select **`NavMeshBoundsVolume`** in the Outliner.
2. Set **Transform → Location** to `-2600, 4500, 0`.
3. **In the Details panel, click the top row — `NavMeshBoundsVolume (Instance)` — not the
   `BrushComponent` row below it.** With the component selected you get a Transform and
   nothing else, and the size fields are simply absent.
4. Scroll to **Brush Settings** and set **X** `8000`, **Y** `12000`, **Z** `2000`.

If Brush Settings still does not appear, scale it instead: unlock the padlock beside
**Scale** and set `4.0, 6.0, 2.0`. The template's volume is roughly 2000 × 2000 × 1000, so
that lands in the same place, and navmesh generation cannot tell the difference.

**Location is not size.** Typing `8000, 12000, 2000` into the Transform's Location fields
teleports the volume 8,000 units away at its original size, leaving the map with no
navmesh — which presents identically to having no volume at all.

Verify before moving on: hit Play and press **P** over the viewport. Green should cover the
hexes. No green means nothing below this step can work.

### 12b. Snap the destination to a hex centre

Find the player controller by asking the level rather than hunting folders:
**Window → World Settings → GameMode Override**, expand **Selected GameMode**, and
double-click **Player Controller Class**. (It is `BP_TopDownController`, under
`Content/TopDown/Blueprints/`.)

Open its **`MoveTo`** function. It takes a `Location` and hands it to `Simple Move to
Location` and to the click-marker effect. Splice two pure nodes into that wire:

```
MoveTo entry ─ Location ▶ Hex From World ▶ Hex To World ─┬─▶ Simple Move to Location (Goal)
                          Size = 100        Size = 100    └─▶ Spawn System at Location
                                            Z    = 0
```

Both `Size` pins must match `HexSize` on `BP_HexGrid`. If they disagree the pawn walks to
the centre of the *wrong* hex, and the error grows with distance from the origin — which
reads as "movement drifts" rather than as a mismatched constant.

**Snap here, not where the cursor is read.** The template writes its destination variable
in four places — mouse and touch, each on both Started and Triggered — and they overwrite
each other within a single frame. `MoveTo` is the one point where a destination is
committed, so one edit covers every path, now and for any input you add later.

### 12c. Turn off free steering

That alone will not change what you see, because most clicks never reach `MoveTo`. The
template has two movement systems on the same button:

| Event | Runs | Result |
| --- | --- | --- |
| **Triggered**, every frame held | `Follow` → `Add Movement Input` at the raw cursor | free roam |
| **Completed**, if held briefly | `MoveTo` → `Simple Move to Location` | snapped |

Any click held longer than an instant goes down the `Follow` path and steers the pawn
directly, never touching `MoveTo`. Hold-to-steer has no place in a hex game.

In the controller's Event Graph:

1. Find the **`Follow`** node fed from `IA_SetDestination_Click` and **Alt+click its exec
   input** to disconnect it. Leave the `SET Cached Destination` before it wired — you still
   want the destination tracking the cursor while the button is down.
2. Do the same to the second **`Follow`**, the one fed from `IA_SetDestination_Touch`.
3. Select the **`PressedThreshold`** variable in My Blueprint and set its **Default Value**
   to `1000`.

Step 3 is not optional. `Completed` only calls `MoveTo` when the hold was shorter than
`PressedThreshold`; with `Follow` gone, a longer hold would otherwise do nothing at all.

Compile, save, Play. Click a hex: the pawn paths to it and stops dead-centre, and the click
marker lands on the centre too. Hold and drag: nothing moves until you release.

### What you have now

One hex library — the same C++, parity-tested against the same TypeScript — driving the
map's shape, the tiles' terrain, the highlight under the cursor, and where a unit can
stand. Four systems, one source of truth, and a seed that means the same thing here as it
does in the browser.

### Next after this

`Find Path In Map` closes the loop: from the pawn's current hex (`Hex From World` on its
actor location) to the clicked one, over the same `Costs` map. Walk the pawn along the
returned array one hex at a time instead of letting the navmesh smooth the corner, and
movement stops being pathfinding-with-a-hex-shaped-destination and becomes actual hex
movement.

---

## What to do next

Steps 10 and 12 already built, at world scale, what the battle grid needs: a range
highlight from `Reachable`, and a unit that occupies one hex at a time. The battle slice is
mostly a matter of moving that from the grid onto a unit.

In this order, each step playable before the next:

1. A unit actor that owns its own `Hex` and `MoveBudget`, instead of the grid owning them.
   Click to select it; `ShowRange` from where it stands.
2. Step the pawn along `Find Path In Map`'s array one hex at a time, rather than letting
   the navmesh smooth the route. This is what makes movement cost mean something.
3. A second, hostile unit. Strike when adjacent, using the rules in `src/sim/battle.ts`.
4. Turn order, then shield-wall adjacency, zone of control, and morale — one rule at a
   time, with `test/battle.test.ts` as the answer key.

None of steps 1 and 2 need new C++: `ReachableInMap` and `FindPathInMap` are already there,
already tested, and already agree with the game you can play in a browser.

Real worldgen is a separate thread. Step 10 draws terrain at flat random, which is enough to
make cost visible; `src/sim/worldgen.ts` weights by latitude and neighbours to produce an
island rather than noise. Porting it is the difference between a hex map and Landnám's map.

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

**Every hex is grey, or colours never change.** In order of likelihood: the Static Mesh
component's **Element 0** is not set to `M_HexTile` (Step 7), so `SetColour` is writing into
an instance of the default material that has no such parameter; the material's parameter is
not named exactly `BaseColour`; `Create Dynamic Material Instance` inside `SetColour` has
`M_HexTile` in its **Source Material** pin instead of being left empty; or `BP_HexTile` has
a BeginPlay that makes a second, competing material instance. All four fail without a word.

**Some tiles respond and others do not, in no obvious pattern.** Two tiles are stacked at
the same hex. See the loop-order trap in Step 11 — the give-away is that the tiles which
misbehave correlate with row number, and `Tiles` still reports the correct count.

**The pawn moves freely instead of hex to hex.** `Follow` is still connected (Step 12c). The
snap in `MoveTo` is correct and simply never runs.

**The pawn does not move at all.** Either `PressedThreshold` was not raised after
disconnecting `Follow` (Step 12c), or there is no navmesh under it (Step 12a — press **P**
in Play to check). Both fail silently. A `Print String` on `MoveTo`'s entry separates them
in one click: no print means the input path, a printed vector means navigation.

**A node has a white left-hand arrow and nothing plugged into it.** It will never run, and
it will never say so. Blueprint prunes it, reads its return value as the type's default —
`0`, empty array, black — and carries on. This is the single most common failure mode in
this guide; it has caused, at various points, identical terrain on every tile, an empty
highlight loop, and a material that was created but never coloured. When something does
nothing, look for an unwired exec pin before you look at anything else.

**The parity test fails after you changed the TypeScript.** That is the test doing its
job. Regenerate the vectors — `node ue-port/tools/golden.mjs` — copy `golden.json` over,
and run it again.

**An asset fails to save, naming a path under `__ExternalActors__`.** The level uses One
File Per Actor, so each actor is its own file, and something is blocking the write. Click
**Retry** once, then **Cancel** — never **Continue**, which skips that asset and quietly
discards your change. The usual cause is the project sitting inside a OneDrive-synced
folder; move it somewhere like `C:\Dev\`. Otherwise check for read-only files, free disk
space, and a project path long enough to bump the 260-character limit.

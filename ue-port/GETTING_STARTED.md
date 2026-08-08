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

// Bumping SAVE_VERSION without shipping a migration is a bug. See
// migrations.ts — old saves must always load.

// v2 (2.1): GameState gained the optional `battle` field.
// v3 (2.2): Combatant gained throwsLeft and defending.
// v4 (2.3): Combatant gained nerve, broken and fled.
// v5 (2.4): Person gained xp (and diedOn), Combatant gained kills, and the
//           root gained the optional post-battle `aftermath`.
// v6 (3.1): the root gained the optional `settlement`.
// v7 (3.2): Settlement gained plots/shelter/watch; Person gained job.
// v8 (3.3): Settlement gained built/queue/works.
// v9 (map): World gained trod and landingName.
// v10 (3.5): Ground gained 'wall'; Battle gained the optional raid flag.
// v11 (4.1): the root gained grudges.
// v12 (4.2): the root gained the optional expedition.
// v13 (4.3): the root gained neighbours.
// v14 (4.4): the root gained lore.
// v15 (4.5): the root gained the tally.
// v16 (4.6): RunEnd gained the 'jarl' cause.
// v17 (6.2): a Person is sworn or a hand.
// v18 (places): World gained places; Battle gained the optional placeId.
// v19 (plunder): Battle gained the optional campId; ClanKindDef gained
//                plunder (data, not save — the bump is for the Battle field).
// v20 (sea): Party gained the optional hullHoled.
// v21 (combat): Battle gained warCried and lastBlow.
// v27 (raiding): Neighbour gained the optional `sackedOn` — their stores
//                 grow back over CAMP_REGROW days, so plunder is a circuit
//                 rather than a one-off.
// v28 (beats): Battle gained the optional `beats` — the fight as an ordered
//                list of structured events, for a presentation layer that has
//                to animate it rather than print it — and LOST `lastBlow`,
//                the one-slot version of the same idea, which the beat
//                stream replaces outright.
// v29 (challenges): the root gained the optional `chasing` — the mark a
//                    challenge code set this run to beat.
// v30 (world beats): the root gained the optional `beats` — the travel and
//                     colony half of the sim's event stream.
// v31 (ids): `nextId` starts past the founders. Before this the first six
//             people to join took the ids of the six who came off the knarr.
// v32 (ship): the root gained `ship` — a knarr with a name and strakes that
//              grade — and Party LOST `hullHoled`, the one-bit version of the
//              same idea. A holed hull comes forward as one sprung strake,
//              which is exactly what the flag meant.
// v33 (lineage): Settlement gained `children` — everyone born on this coast.
//                 An old save's steading has borne nobody, which is exactly
//                 what an empty list says.
// v34 (ghost): the root gained the optional `ghost` — somebody else's fallen
//               steading, carried in on a challenge code. Absent is the truth
//               about every saga played before anyone could send one.
// v35 (rations): Party gained the optional `rations`. An absent value is
//                 full shares, which is what every band before the winter
//                 lever was eating.
// v36 (retreat): the root gained the optional `bairns` — children carried
//                 between steadings by a band that walked out on one. Absent
//                 is the truth about every saga played before there was a way
//                 to leave.
// v37 (larder): World gained the optional `worked` — how hard each hex's
//                forage, game and fishing have been pressed, so a valley can
//                be hunted out and grow back. Absent is the truth about every
//                saga played on ground that never ran thin.
// v38 (rival): the root gained the optional `rival` — a second landnamsmadr
//               taking ground on his own schedule. Absent is the truth about
//               every saga played on an island with one boat on it.
// v39 (skerries): World gained the optional `charted` — the rocks the band
//                  has learnt about. The skerries themselves are derived from
//                  the seed and stored nowhere. Absent is an unread coast,
//                  which is what every old saga has.
// v40 (landmarks): Tile LOST `landmark` and `explored`. They were declared
//                   years ago, pointed at a `data/landmarks` that was never
//                   written, and were set by nothing in either repo — a
//                   promise in the data model that no code kept. Landmarks
//                   are real now and are DERIVED from the seed (sim/landmark
//                   .ts), so they need no field at all.
// v41 (ways): World gained the optional `made` — hexes the band has cut a
//              way through, which walk like a meadow ever after. The first
//              thing in this game the player writes onto the country itself.
//              Absent is ground nobody has broken.
// v42 (outlawry): the root gained the optional `outlaws` — people the band
//                  drove out, who are still in the country and can come back
//                  for it. Absent is a band that never made anybody outlaw.
// v43 (voyage): the root gained the optional `voyage` — the knarr away over
//                the open sea with a crew aboard, gone from the map for a
//                season. Absent is a band that never sailed for home.
// v44 (fisheries): Purpose gained 'fish' — the errand a settled band sends
//                   out to work a fishing ground. The grounds themselves are
//                   DERIVED from the seed (sim/fishery.ts) and stored nowhere,
//                   and which ones the band knows needs no field either: a
//                   ground sits on a hex, and the fog already remembers which
//                   hexes have been seen. Only the errand is new shape.
// v45 (ranks): Combatant gained `rank` — where in the line a fighter stands,
//               1 at the front. The hex battlefield is being replaced by a
//               line with depth (sim/ranks.ts), and this is the first step:
//               ranks are assigned and carried, and nothing reads them yet,
//               so a fight saved mid-swing keeps going exactly as it was.
//               A save from before this has combatants with no rank, and the
//               migration ranks them in the order they are stored, which is
//               the order they took the field.
// v46 (the line): `moved` beats carry RANKS, not hexes. The battlefield is a
//                  line now, so a step is a change of rank and the move-point
//                  cost it used to carry paid for movement that no longer
//                  exists. Beats are a presentation stream — capped, drained
//                  and disposable — so the migration drops the `moved` beats
//                  a pre-line save is holding rather than inventing ranks for
//                  hexes. Nothing else in the stream changes.
// v47 (the hexes leave the fight): `Combatant.at` is gone, and with it the
//                  `from`/`to` hexes on a `shoved` beat and the `drowned`
//                  shove result. A fighter's place has been his RANK since
//                  8.1c and the renderer stopped reading `at` in 8.1d, so
//                  what was left was a coordinate three parts of the game
//                  disagreed about — the sim ignored it, the view drew
//                  people at it, and it had not moved since deployment.
//                  Dropping a field cannot orphan a saga: a fight caught
//                  mid-swing keeps every man, his rank, his wounds and his
//                  nerve, and simply stops carrying a hex nobody read.
// v48 (the coast): Party gained `stop` — where the band is standing on the
//                  route (sim/route.ts), counted from the landing. Additive,
//                  and nothing reads it while `COAST_IS_A_LINE` is off, so a
//                  saga saved mid-walk carries on across the hex map exactly
//                  as it was. Absent means the landing, which is the honest
//                  answer for every save written before a coast existed.
// v49 (places on the coast): Place gained `stop` — which stop on the route it
//                  stands at. Only ever written on a world seeded with
//                  `COAST_IS_A_LINE` on, so an existing save is byte for byte
//                  what it was; the bump is here because the SHAPE changed
//                  and this project's rule about that has no "but nothing
//                  writes it yet" clause.
// v50 (out of the water): Party gained `bySea` — they arrived at a stop under
//                  oars and have not been seen yet. The strandhögg's whole
//                  condition on a line: a route has no "floating offshore"
//                  to be in, so the difference between the two ways of
//                  taking a place moves from where the band IS to how they
//                  got there. Lasts one day; `advance` clears it. Absent
//                  means they walked, which is what every save so far did.
// v51 (people on the coast): Neighbour and Settlement gained `stop` — which
//                  stretch of the route they live on, and which one the posts
//                  went into. Same rule as v49: only ever written on a world
//                  seeded with `COAST_IS_A_LINE` on, so an existing save is
//                  byte for byte what it was. Absent on a neighbour means
//                  they live on a hex; absent on a settlement means the hall
//                  stands on one.
// v52 (the coast remembered): World gained `trodStops` and `knownStops` —
//                  where the band has stood on the route and what it knows
//                  stands there. The line's `trod` and `seen`, kept as their
//                  own fields rather than folded into the hex-keyed ones,
//                  because eight places iterate those expecting hexes and a
//                  stop key would not throw, only make a percentage wrong.
//                  Absent on every save the hex map ever wrote.
// v53 (the other boat, on a coast): Rival gained `stop` and `claimStops` —
//                  where his posts went in on the route and which stretches
//                  his hand has closed on. Same rule as v49 and v51: only
//                  written on a world seeded with `COAST_IS_A_LINE` on.
// v54 (8.5): a coast save stops carrying the hex island. 1872 tiles is 96%
//            of an 81 kB save and a coast build reads none of them. The
//            migration only strips them when COAST_IS_A_LINE — the hex page
//            still navigates by those tiles, and taking them would delete the
//            country out from under a band mid-saga.
// v55 (8.5): `battle.grid` stops being a hex-keyed record and becomes a plain
//            rectangle indexed `row * width + col`. Nothing had walked that
//            ground since 8.1c moved the fight onto ranks — its one surviving
//            reader asks whether any tile is a wall — and every access to it
//            already went `key(offsetToAxial(col, row))`, a column and a row
//            wearing a coordinate system. A save caught mid-fight keeps its
//            ground: the migration recomputes the old axial keys rather than
//            assuming them, with the formula written out inline because
//            `src/hex/` does not survive this milestone.
// v56 (8.5): THE HEXES GO. Every hex-shaped field leaves at once —
//            `world.tiles`, `seen`, `trod`, `made`, `charted`, `landing`,
//            `width`, `height`, `rival.claims`, and the `at` on the party,
//            the settlement, the places, the neighbours, the rival, the ghost
//            and the plots. A plot's `at` becomes the slot index it always
//            was. What is left is the address a coast has: a stop.
//
//            THE DOCUMENTED BREAK. A save written by the hex map has no stop
//            for anybody — v49 through v53 each declined to invent one, and
//            were right to. Such a save still LOADS, with its people, ship,
//            stores, lore, grudges and whole saga log intact, but it comes
//            forward standing on the landing of a coast derived fresh from
//            its own seed: the hall is re-sited on the landing stretch, and
//            the places, the neighbours and the rival are re-derived. What it
//            loses is where everything was, because that ground is gone.
// v57 (9.12): Settlement gained `kept` — the day the hall last held a feast.
//             A hall's heart is paid while it is kept and fades when it is
//             not, which is the third act; see sim/hall.ts. An old save is
//             credited with having been kept on the day it is loaded, so
//             nobody's jarldom collapses because they saved before this
//             existed.
// v58 (9.9): Party gained `blade` — a sword with a name, whose hand it is in,
//             and everyone who has borne it. The one possession in the game
//             that outlives its owner: it passes on death, it is laid by for
//             a child when the dead left one, and the memorial carries it, so
//             two rows on the wall can be about the same thing. An old save is
//             given the blade its own seed would have produced, held by
//             whoever leads it now — the hands before cannot be recovered and
//             are not invented. See sim/heirloom.ts.
// v59 (9.1b): the shove and the dash come off the bar, and the `shoved` and
//             `dashed` beats go with them. Beats are a presentation stream —
//             capped, drained, disposable — so a fight caught mid-swing drops
//             the ones it is holding rather than having them translated, the
//             way v46 dropped hex-shaped `moved` beats. Every man keeps his
//             rank, wounds, nerve and hand-axes. What changes from the next
//             turn is that a man with no legal verb shoulders forward by
//             himself instead of being offered a Run button — see `stepUp` in
//             sim/footwork.ts, and the 19% of turns that measured as having
//             nothing legal in them when the dash was taken and nothing put
//             in its place.
// v60 (9.10): Rival gained the optional `metOn` — the day sight first fell on
//             the other landnám's hall, so the ending can name it. NOT
//             backfilled: a save that already met him met him on a day nothing
//             recorded, and the saga says nothing rather than guessing a date.
//             Absent is the honest answer for every saga played before this.
// v61 (8.1): `battle.width` and `battle.height` go. 8.1 listed them to leave
//             with `src/hex/` — "none of it is load-bearing" — and 8.5 took
//             everything else on that list. They were written once from
//             `FIELD_WIDTH`/`FIELD_HEIGHT` and read by NOTHING: `cell(col,
//             row)` indexes off the constants, so the pair in the save could
//             only ever agree with them. Their one reader was a test
//             asserting each constant against itself. A save caught mid-fight
//             keeps its ground — only the two numbers describing its shape
//             are dropped, and the shape they described is the only shape
//             there has ever been.
export const SAVE_VERSION = 61;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

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
export const SAVE_VERSION = 43;

/** localStorage key. Never reuse across incompatible shapes. */
export const SAVE_KEY = 'landnam_save';

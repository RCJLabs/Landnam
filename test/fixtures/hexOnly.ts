// Tests of the hex map, which retire with it.
//
// A coast build stopped generating the eighteen-hundred-tile island on
// 2026-08-28 — it was 77.2 kB of an 81.1 kB save, 96% of it, and the game did
// not read one of those tiles. Every derived thing that used to come off the
// map comes off the seed now: `seedPlaces`, `placeNeighbours` and `makeRival`
// answer in stops, and the five site measures read `stopReport`.
//
// Sixty-four tests across twenty-one files went red on that, and every one of
// them was a test of the HEX SYSTEMS — worldgen, the fog, hex movement, the
// skerries, the hex fishery, the map renderer. They had been green on a coast
// build the whole time, which is the part worth saying out loud: they were
// passing against a country the game does not have. That is the same trap
// `site.test.ts` fell into and the same one the recorded runs fell into, and
// it is why this is a guard rather than a deletion — the hex build still ships
// behind `VITE_HEX=1` and these are what keep it honest until it goes.
//
// So: `describe.skipIf(RETIRED_WITH_THE_HEXES)` on a block that can only mean
// something on the map, and a coast branch on anything the line asks
// differently. When 8.5's last job deletes `src/hex/`, these blocks go with
// it and this file goes with them.
import { COAST_IS_A_LINE } from '../../src/sim/flags';

export const RETIRED_WITH_THE_HEXES = COAST_IS_A_LINE;

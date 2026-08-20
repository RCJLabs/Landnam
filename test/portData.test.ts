// The DataTable JSON the port's editor side reads.
//
// WHY THIS FILE EXISTS. `Content/Data/foes.json` in the port carried four of
// this repo's eight archetypes, and its row struct had no `Renown` column at
// all. The C++ sim was never wrong — it reads the generated battle tables,
// which are under the port contract and have always held all eight — so no
// parity run could ever have caught it. The half of the port that a parity
// harness cannot see is exactly the half that drifted.
//
// The cause was written on the file next door: `foe-names.json` credited a
// generator, `ue-port/tools/export-data.mjs`, that exists in neither repo any
// more. Generated once, generator lost, hand-maintained ever after.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FOE_ARCHETYPES, FOE_BYNAMES, FOE_NAMES, CHAMPION_BYNAMES } from '../src/data/foes';
import { ALL_TERRAINS } from '../src/data/terrain';
import { CONTRACT } from '../scripts/port-sync.mjs';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('the port carries the whole roster', () => {
  it('has a row for every archetype this repo defines, in declaration order', () => {
    const rows = read('port/foes.json') as { Id: string }[];
    // ORDER IS LOAD-BEARING and not a tidiness point: `FOE_ARCHETYPES` is
    // walked by `rng.weighted`, which subtracts weights in declaration order
    // until the roll goes negative. A reordered table fields a different band
    // for every seed.
    expect(rows.map((r) => r.Id)).toEqual(FOE_ARCHETYPES.map((f) => f.id));
    expect(rows).toHaveLength(8);
  });

  it('carries every field the archetype has, renown included', () => {
    const rows = read('port/foes.json') as Record<string, unknown>[];
    for (const foe of FOE_ARCHETYPES) {
      const row = rows.find((r) => r['Id'] === foe.id);
      expect(row, `${foe.id} has no row`).toBeTruthy();
      expect(row!['Kind']).toBe(foe.kind);
      expect(row!['Budget']).toBe(foe.budget);
      expect(row!['Favours']).toEqual(foe.favours);
      expect(row!['Toughness']).toBe(foe.toughness);
      expect(row!['Temperament']).toBe(foe.temperament);
      expect(row!['Throws']).toBe(foe.throws);
      expect(row!['Weight']).toBe(foe.weight);
      // The column the port did not have. `renown` moved out of sim/word.ts
      // so that adding a foe would be a one-file job; it was not one on the
      // port side, because the port could not see this number.
      expect(row!['Renown'], `${foe.id} lost its renown crossing over`).toBe(foe.renown);
    }
  });

  it('every DataTable row carries the row name UE keys it by', () => {
    for (const path of ['port/foes.json', 'port/terrain.json']) {
      for (const row of read(path) as Record<string, unknown>[]) {
        expect(row['Name'], `a row in ${path} has no Name`).toBe(row['Id']);
      }
    }
  });
});

describe('the generator reproduces what it did not need to change', () => {
  /**
   * THE BAR THAT MAKES THE OTHERS WORTH ANYTHING.
   *
   * A generator that emits well-formed JSON nobody can import is no better
   * than the stale file it replaced. `terrain.json` was already correct — all
   * eight rows, every value matching — so regenerating it has to produce the
   * bytes that are already on disk in the port. It does, and that equality is
   * the evidence that the format, the key order, the indent, the `Name` key
   * and the -1-for-impassable convention are all right, rather than merely
   * plausible.
   */
  it('emits terrain.json byte for byte as the port already holds it', () => {
    const ue = process.env['LANDNAM_UE'] ?? '../landnam-ue';
    let held: string;
    try {
      held = readFileSync(`${ue}/Content/Data/terrain.json`, 'utf8');
    } catch {
      // The port is not always checked out beside this repo — in CI it is not.
      // Skipping is honest; failing would be a bar on the checkout, not the code.
      return;
    }
    expect(readFileSync('port/terrain.json', 'utf8')).toBe(held);
  });

  it('carries the same names it always did', () => {
    const names = read('port/foe-names.json');
    expect(names.FoeNames).toEqual(FOE_NAMES);
    expect(names.FoeBynames).toEqual(FOE_BYNAMES);
    expect(names.ChampionBynames).toEqual(CHAMPION_BYNAMES);
    // And the note names a script that EXISTS, which was the whole tell that
    // these files had stopped being generated.
    expect(names.note).toContain('scripts/port-data.ts');
  });

  it('covers every terrain the game can paint', () => {
    const rows = read('port/terrain.json') as { Id: string }[];
    expect(rows.map((r) => r.Id)).toEqual(ALL_TERRAINS);
  });
});

describe('and they are under the contract now', () => {
  it('port-sync carries all three, so drift goes red instead of silent', () => {
    const from = CONTRACT.map((c: { from: string }) => c.from);
    for (const f of ['port/foes.json', 'port/terrain.json', 'port/foe-names.json']) {
      expect(from, `${f} is generated but not handed over`).toContain(f);
    }
  });
});

// The generated headers, checked against the data they are generated from.
//
// `port/*.generated.h` is how content reaches the C++ port: names, traits,
// terrain, the hardship table and all hundred and two event cards. It is
// generated from src/data so that adding a card never means touching engine
// code — the project's oldest architectural rule.
//
// Nothing enforced it. Add a card, forget `npm run event-tables`, and the
// port goes on dealing yesterday's deck: it still compiles, it still passes
// its own parity vectors (which were regenerated from the same live source
// and so agree with the TypeScript), and the ONLY symptom is that Unreal
// plays a slightly different game. That is the exact failure mode
// `port/sim.md` exists to prevent, one level down.
//
// So: regenerate in memory and compare. Same shape as `npm run parity --
// check`, and for the same reason — both sides move together or neither
// does.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderPartyTables } from '../scripts/party-tables';
import { renderEventTables } from '../scripts/event-tables';
import { renderBattleTables } from '../scripts/battle-tables';

const HEADERS = [
  {
    path: 'port/LandnamPartyTables.gen.h',
    render: renderPartyTables,
    command: 'npm run party-tables',
  },
  {
    path: 'port/LandnamEventTables.gen.h',
    render: renderEventTables,
    command: 'npm run event-tables',
  },
  {
    path: 'port/LandnamBattleTables.gen.h',
    render: renderBattleTables,
    command: 'npm run battle-tables',
  },
];

describe('the generated port tables', () => {
  for (const { path, render, command } of HEADERS) {
    it(`${path} is what src/data currently says`, () => {
      const onDisk = readFileSync(path, 'utf8');
      const fresh = render();
      // Length first, and separately: a header that is a few characters out
      // is a changed string, where one that is thousands out is a card added
      // or removed. The parity vectors carry `size` beside every hash for
      // exactly this reason.
      expect(
        fresh.length,
        `${path} is ${onDisk.length} chars and the data now makes ${fresh.length}. `
        + `Run \`${command}\` and copy it into landnam-ue.`,
      ).toBe(onDisk.length);
      expect(fresh, `${path} is stale. Run \`${command}\`.`).toBe(onDisk);
    });
  }

  /**
   * The deck's ORDER is part of every seed.
   *
   * `maybeFireEvent` filters EVENTS in declaration order and hands the
   * survivors to `rng.weighted`, which walks them subtracting weights until a
   * roll goes negative. So the header must carry the cards in the same order
   * the data does — a generator that sorted or deduplicated them would
   * produce a header that compiles, matches nothing, and looks like a
   * disagreement about the rules.
   */
  it('writes the event deck in declaration order', async () => {
    const { EVENTS } = await import('../src/data/eventCards');
    const header = readFileSync('port/LandnamEventTables.gen.h', 'utf8');
    const found = [...header.matchAll(/^\t\{ "([a-z0-9-]+)", /gm)].map((m) => m[1]);
    expect(found).toEqual(EVENTS.map((e) => e.id));
  });

  /**
   * And the foe table's order is part of every fight, for the same reason:
   * `rollFoes` hands FOE_ARCHETYPES to the same `rng.weighted`. Reorder it
   * and every seed fields a different band, on ground that still hashes
   * correctly — which is exactly the kind of divergence that reads as a
   * disagreement about the rules rather than about a list.
   */
  it('writes the foe archetypes in declaration order', async () => {
    const { FOE_ARCHETYPES } = await import('../src/data/foes');
    const header = readFileSync('port/LandnamBattleTables.gen.h', 'utf8');
    const found = [...header.matchAll(/^\t\t\{ "([a-z]+)", "[A-Z]/gm)].map((m) => m[1]);
    expect(found).toEqual(FOE_ARCHETYPES.map((a) => a.id));
  });
});

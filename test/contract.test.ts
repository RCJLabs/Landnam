// Does the port have the contract this repo is holding?
//
// THE FAILURE THIS EXISTS FOR, found by an audit on 2026-08-19 rather than by
// anything in the suite. Five files the C++ port verifies against had gone
// stale: `parity.json` five regenerations behind, both recorded runs
// re-recorded twice since the last copy, and two of three generated tables
// out of date. Every one had been produced by a green `npm run parity` here
// and then not carried across — because carrying them across was a thing a
// person remembered to do, and nothing failed when they did not.
//
// So the bar is not "the two repos are identical" — this suite cannot see the
// other repo, and a test that quietly passes when it is absent would be worse
// than none. The bar is: THE CONTRACT HAS NOT MOVED SINCE IT WAS LAST HANDED
// OVER. `npm run port:sync` copies and stamps; this fails the moment a
// regeneration orphans the port, which is the thing nothing could see.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CONTRACT, MANIFEST, currentHashes } from '../scripts/port-sync.mjs';

/**
 * THE CONTRACT IS DELIBERATELY FROZEN. Decided 2026-08-25.
 *
 * Phase 8 turns this game side-on and retires the hex layer, which means the
 * C++ port is currently a port of something being replaced. Carrying every
 * regeneration across to it, step by step through a conversion that will
 * delete the shapes being carried, is work spent on a contract that is going
 * to be rewritten wholesale.
 *
 * So the hand-over is paused rather than kept up. That is a bar being lowered
 * and it is recorded as one — the drift is PRINTED on every run below rather
 * than swallowed, and the freeze itself is checked: it has to name a reason
 * and that reason has to still be written down in ROADMAP.md, so this cannot
 * quietly outlive the decision that made it.
 *
 * To lift it: set this to null and run `npm run port:sync`.
 */
const FROZEN: { since: string; because: string; where: string } | null = {
  since: '2026-08-25',
  because: 'Phase 8 — the side-on conversion — makes the port a port of a game being replaced',
  where: 'ROADMAP.md',
};

describe('the port contract', () => {
  it('has a manifest, because a hand-over nobody recorded is a hand-over nobody can check', () => {
    expect(
      existsSync(MANIFEST),
      `${MANIFEST} is missing — run \`npm run port:sync\``,
    ).toBe(true);
  });

  it('says out loud what the port is missing while the hand-over is frozen', () => {
    // The freeze must never be the quiet kind. Whatever has drifted is named
    // on every run, so the cost of the pause is visible in the log rather
    // than discovered by an audit a month later — which is exactly how the
    // original five-regenerations-behind bug was found.
    if (!FROZEN) return;
    const manifest = existsSync(MANIFEST)
      ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
      : { files: {} };
    const now = currentHashes();
    const had: Record<string, string> = manifest.files ?? {};
    const moved = Object.keys(now).filter((f) => now[f] !== had[f]);
    // eslint-disable-next-line no-console
    console.log(
      `contract: FROZEN since ${FROZEN.since} — ${FROZEN.because}.\n`
        + (moved.length === 0
          ? '  nothing has drifted yet.'
          : `  the port is building against older copies of:\n`
            + moved.map((f) => `    ${f}  ${had[f] ?? '(never synced)'} -> ${now[f]}`).join('\n'))
        + `\n  lift it by clearing FROZEN in this file and running \`npm run port:sync\`.`,
    );
  });

  it('keeps the freeze honest: it names a reason, and the reason is still written down', () => {
    // A freeze that outlives its cause is just rot with a comment on it.
    if (!FROZEN) return;
    expect(FROZEN.because.length, 'the freeze has no stated reason').toBeGreaterThan(20);
    const where = readFileSync(FROZEN.where, 'utf8');
    expect(
      where.includes('port contract is frozen'),
      `${FROZEN.where} no longer records why the port hand-over is frozen —`
        + ' either write it back or lift the freeze',
    ).toBe(true);
  });

  it.skipIf(FROZEN !== null)('still hashes to what the port was last handed', () => {
    // Guarded rather than left to throw: an absent manifest is the same
    // finding as a moved one — the port has not been handed this — and it
    // should read that way instead of as an ENOENT stack.
    const manifest = existsSync(MANIFEST)
      ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
      : { files: {} };
    const now = currentHashes();
    const had: Record<string, string> = manifest.files ?? {};
    const moved = Object.keys(now).filter((f) => now[f] !== had[f]);
    expect(
      moved,
      `these files have moved since the port was last handed the contract:\n`
        + moved.map((f) => `  ${f}  ${had[f] ?? '(never synced)'} -> ${now[f]}`).join('\n')
        + `\n\nRun \`npm run port:sync\` to copy them across and re-stamp. The C++ port is`
        + ` building against the old ones until you do.`,
    ).toEqual([]);
  });

  it('covers every file this repo owns and the port consumes', () => {
    // A contract that quietly stopped listing a file would go green while the
    // port drifted on exactly that file — which is the original bug wearing a
    // manifest. Pinned by name.
    expect(CONTRACT.map((c: { from: string }) => c.from).sort()).toEqual([
      'port/LandnamBattleTables.gen.h',
      'port/LandnamEventTables.gen.h',
      'port/LandnamPartyTables.gen.h',
      // The three DataTable files, added 2026-08-20. They were outside the
      // contract for the honest reason that nothing generated them — and
      // `foes.json` had drifted to four of eight archetypes in the meantime,
      // which is what an unowned file does. `scripts/port-data.ts` owns them
      // now. See test/portData.test.ts.
      'port/foe-names.json',
      'port/foes.json',
      'port/golden.json',
      'port/terrain.json',
      // `port/parity.json`, `runs/example.json` and `runs/long.json` left the
      // contract in 8.5 when they were deleted: the vectors and the recorded
      // scripts retired with the hexes, as DECIDED on 2026-08-27. Named here
      // rather than quietly dropped, because a shrinking contract is exactly
      // what this bar exists to notice.
    ]);
  });

  it('names a real destination for each of them', () => {
    for (const entry of CONTRACT as { from: string; to: string }[]) {
      expect(existsSync(entry.from), `${entry.from} is in the contract and not on disk`).toBe(true);
      expect(entry.to.length, entry.from).toBeGreaterThan(0);
    }
  });
});

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

describe('the port contract', () => {
  it('has a manifest, because a hand-over nobody recorded is a hand-over nobody can check', () => {
    expect(
      existsSync(MANIFEST),
      `${MANIFEST} is missing — run \`npm run port:sync\``,
    ).toBe(true);
  });

  it('still hashes to what the port was last handed', () => {
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
      'port/golden.json',
      'port/parity.json',
      'runs/example.json',
      'runs/long.json',
    ]);
  });

  it('names a real destination for each of them', () => {
    for (const entry of CONTRACT as { from: string; to: string }[]) {
      expect(existsSync(entry.from), `${entry.from} is in the contract and not on disk`).toBe(true);
      expect(entry.to.length, entry.from).toBeGreaterThan(0);
    }
  });
});

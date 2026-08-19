// Hand the port the contract it is supposed to be building against.
//
//   npm run port:sync           copy into ../landnam-ue and stamp the manifest
//   npm run port:sync -- --check  say what has moved, change nothing
//
// WHY THIS EXISTS, measured rather than supposed. On 2026-08-19 an audit
// compared the two repos file by file and found the port verifying against a
// contract that no longer existed: `parity.json` five regenerations behind,
// both recorded runs re-recorded twice since the copy, and two of the three
// generated tables stale. Every one of those had been produced by a green
// `npm run parity` in this repo and then simply not carried across, because
// carrying them across was a thing a person remembered to do.
//
// So the manifest is the point, not the copying. `port/contract.json` records
// what the contract hashed to when it was last handed over, and
// `test/contract.test.ts` fails when the files no longer hash to that. The
// suite therefore goes red the moment a regeneration orphans the port, which
// is the one thing nothing could see before.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Where the port lives, when it is checked out beside this repo. */
const UE = process.env['LANDNAM_UE'] ?? join(process.cwd(), '..', 'landnam-ue');

/**
 * Every file this repo OWNS and the port consumes, and where it lands.
 *
 * `Content/Data/foes.json` and its neighbours are deliberately absent: nothing
 * here generates them, they are maintained on the port side, and listing them
 * would be claiming a sync this script does not perform. They have drifted too
 * — see ROADMAP — but that is a different job and pretending otherwise here
 * would be the worse bug.
 */
export const CONTRACT = [
  { from: 'port/parity.json', to: 'Content/Data/parity.json' },
  { from: 'port/golden.json', to: 'Content/Data/golden.json' },
  { from: 'port/LandnamPartyTables.gen.h', to: 'Source/LandnamUE/Sim/LandnamPartyTables.gen.h' },
  { from: 'port/LandnamEventTables.gen.h', to: 'Source/LandnamUE/Sim/LandnamEventTables.gen.h' },
  { from: 'port/LandnamBattleTables.gen.h', to: 'Source/LandnamUE/Sim/LandnamBattleTables.gen.h' },
  { from: 'runs/example.json', to: 'Content/Data/runs/example.json' },
  { from: 'runs/long.json', to: 'Content/Data/runs/long.json' },
];

export const MANIFEST = 'port/contract.json';

/** First sixteen hex of the sha256, which is plenty to notice a change. */
export function hashOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}

/** What the contract hashes to right now. */
export function currentHashes() {
  const out = {};
  for (const { from } of CONTRACT) out[from] = hashOf(from);
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  const now = currentHashes();
  const had = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8')).files ?? {}
    : {};

  const moved = Object.keys(now).filter((f) => now[f] !== had[f]);
  if (check) {
    if (moved.length === 0) {
      console.log('port:sync — the port has the contract this repo is holding.');
      return;
    }
    console.log(`port:sync — ${moved.length} contract file(s) moved since the last hand-over:`);
    for (const f of moved) console.log(`  ${f}  ${had[f] ?? '(never synced)'} -> ${now[f]}`);
    process.exitCode = 1;
    return;
  }

  let copied = 0;
  const haveUE = existsSync(UE);
  if (haveUE) {
    for (const { from, to } of CONTRACT) {
      const dest = join(UE, to);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(from, dest);
      copied += 1;
    }
  }

  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        note:
          'What the port was last handed. Written by scripts/port-sync.mjs; '
          + 'test/contract.test.ts fails when the files no longer hash to this.',
        files: now,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `port:sync — stamped ${Object.keys(now).length} contract files`
    + (haveUE ? `, copied ${copied} into ${UE}` : `, ${UE} not checked out so nothing was copied`),
  );
}

// Only when run as a script; the test imports the helpers.
if (process.argv[1] && process.argv[1].endsWith('port-sync.mjs')) main();

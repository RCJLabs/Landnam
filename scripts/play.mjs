// Stamps a recorded run with the state it ends on.
//
//   node scripts/play.mjs test/fixtures/plays/<name>.json
//
// Takes the JSON that `Copy the play` puts on the clipboard, replays it
// through the real `apply`, and writes `hash` and `endsOn` into the file so
// `test/humanplay.test.ts` has something to pin against. See the README in
// test/fixtures/plays for why a human run is the one fixture that must never
// be re-recorded to agree with the code.

import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const file = process.argv[2];
if (!file) {
  console.error('play: name a recording, e.g. test/fixtures/plays/first-winter.json');
  process.exit(2);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { replay } = await server.ssrLoadModule('/src/record.ts');
const { fnv } = await server.ssrLoadModule('/src/sim/hash.ts');

const play = JSON.parse(readFileSync(file, 'utf8'));
const { state, stoppedAt } = replay(play);
await server.close();

if (stoppedAt >= 0) {
  console.error(
    `play: the rules refused action ${stoppedAt} of ${play.acts.length}`
    + ` (${JSON.stringify(play.acts[stoppedAt])}).`
    + ' This recording no longer replays — that is a finding about the rules,'
    + ' not a reason to re-record it.',
  );
  process.exit(1);
}

const { version: _v, ...rest } = state;
const stamped = { ...play, endsOn: state.day, hash: fnv(JSON.stringify(rest)) };
writeFileSync(file, `${JSON.stringify(stamped, null, 2)}\n`);
console.log(
  `play: ${file} — ${play.acts.length} moves to day ${state.day}, hash ${stamped.hash}`,
);

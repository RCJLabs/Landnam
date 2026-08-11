// Play a seed headlessly and print what became of it.
//
//   npx vite-node scripts/play.ts -- --seed raven-skerry-317
//   npx vite-node scripts/play.ts -- --script runs/day-340-crash.json
//   npx vite-node scripts/play.ts -- --seed grim-fjord-100 --hardship fair --saga
//
// Run through vite-node because the sim is TypeScript and this repo has no
// build step for anything but the page. All of the impurity in the runner
// lives in this file; `src/run/headless.ts` is pure and is where the actual
// work is.
//
// With no script it generates the world and stops, which is the cheapest
// possible cross-implementation check: two builds on the same seed must
// print the same worldHash before anything else is worth comparing.

import { readFileSync } from 'node:fs';
import { play, type Script } from '../src/run/headless';
import type { HardshipId } from '../src/state/types';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const scriptPath = flag('script');
const script: Script = scriptPath
  ? (JSON.parse(readFileSync(scriptPath, 'utf8')) as Script)
  : { seed: flag('seed') ?? 'raven-skerry-317', actions: [] };

// An explicit --seed or --hardship overrides the file, so one recorded script
// can be replayed across seeds — which is what turns a repro case into a
// question about whether the bug is the seed's fault.
const seed = flag('seed');
if (seed) script.seed = seed;
const hardship = flag('hardship');
if (hardship) script.hardship = hardship as HardshipId;

const result = play(script);

const report: Record<string, unknown> = {
  seed: script.seed,
  hardship: script.hardship ?? 'even',
  actions: script.actions.length,
  applied: result.applied,
  refused: result.refused.length,
  day: result.day,
  people: result.state.party.people.filter((p) => p.alive).length,
  settlement: result.state.settlement?.name ?? null,
  ended: result.ended ?? null,
  worldHash: result.worldHash,
  hash: result.hash,
};
// Where a replay first went wrong is worth more than how often it did.
if (result.refused.length > 0) report['firstRefused'] = result.refused[0];
if (has('saga')) report['saga'] = result.state.saga.map((e) => `${e.day}: ${e.text}`);

// eslint-disable-next-line no-console
console.log(JSON.stringify(report, null, 2));

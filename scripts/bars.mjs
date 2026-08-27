// Run every browser bar and report by EXIT CODE, not by what it printed.
//
// Written after a real miss: `node scripts/reach.mjs | tail -6` reports the
// exit code of `tail`, which is always 0, so a FAILING reach audit read as a
// passing one with a warning line. The 390x844 thumb rule was broken for a
// whole commit because of it. A bar that cannot fail loudly is not a bar.
import { spawnSync } from 'node:child_process';

// `repaint` was not on this list, so `npm run bars` never ran it and it sat
// red for however long it took the deep to get its own pattern pair. A bar
// nothing runs is not a bar either.
const BARS = [
  ['offline', []], ['sea', []], ['larder', []], ['pan', []],
  ['field', []], ['pinch', []], ['landscape', []], ['way-look', []],
  ['repaint', []], ['steading', []], ['reach', []], ['reach', ['320x568']],
];

const build = (env) => spawnSync('npm', ['run', 'build'], {
  encoding: 'utf8', env: { ...process.env, ...env },
});

let bad = 0;
let ran = 0;
function bar(name, args, label = args.length ? `${name} ${args.join(' ')}` : name) {
  ran++;
  const run = spawnSync('node', [`scripts/${name}.mjs`, ...args], { encoding: 'utf8' });
  if (run.status === 0) {
    console.log(`  PASS  ${label}`);
    return;
  }
  bad++;
  const said = (run.stdout + run.stderr).trim().split('\n').filter(Boolean).slice(-2).join(' | ');
  console.log(`  FAIL  ${label} (exit ${run.status}) — ${said}`);
}

// BUILD THE ORDINARY PAGE FIRST, rather than trusting whatever is in `dist/`.
//
// This ran the first twelve against whatever the last command happened to
// leave there, and the tail of this script has always put the ordinary build
// back — so it was correct as long as nothing else ever built. Then
// `npm run publish:coast` arrived, and a run straight after it reported six
// red bars: `sea`, `pinch`, `way-look`, `repaint` and `steading` are exactly
// the five the coast has no subject for, plus `landscape` falling over. Six
// false failures, and the script's own comment below warns about precisely
// this hazard in the other direction.
if (build({ VITE_COAST: '' }).status !== 0) {
  console.error('bars: the ordinary build did not build — nothing was measured.');
  process.exit(2);
}

for (const [name, args] of BARS) bar(name, args);

// The coast's three bars need a build of the COAST, which is not
// the default build — see src/sim/flags.ts. So they cannot share `dist/` with
// the twelve above and get their own build here, with the ordinary one put
// back afterwards: leaving a coast build in `dist/` would be a quiet way for
// one to reach somebody's browser.
if (build({ VITE_COAST: '1' }).status !== 0) {
  bad += 3; ran += 3;
  console.log('  FAIL  strip, procession, hearth — the coast build did not build');
} else {
  bar('strip', []);
  bar('procession', []);
  bar('hearth', []);
}
if (build({ VITE_COAST: '' }).status !== 0) {
  bad++;
  console.log('  FAIL  (the ordinary build could not be put back)');
}

console.log(bad === 0 ? `\nall ${ran} browser bars pass` : `\n${bad} of ${ran} FAILED`);
process.exit(bad === 0 ? 0 : 1);

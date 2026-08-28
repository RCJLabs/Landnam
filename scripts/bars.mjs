// Run every browser bar and report by EXIT CODE, not by what it printed.
//
// Written after a real miss: `node scripts/reach.mjs | tail -6` reports the
// exit code of `tail`, which is always 0, so a FAILING reach audit read as a
// passing one with a warning line. The 390x844 thumb rule was broken for a
// whole commit because of it. A bar that cannot fail loudly is not a bar.
import { spawnSync } from 'node:child_process';

// THE GAME'S OWN BARS, run against the default build — which since
// 2026-08-28 is the COAST. Every bar the shipping game has is now measured
// against the shipping game; before the flip the coast's own three were the
// afterthought at the bottom of this file.
//
// Keep every bar on one of these two lists. `repaint` was once on neither, so
// `npm run bars` never ran it and it sat red for however long it took the
// deep to get its own pattern pair. A bar nothing runs is not a bar.
const BARS = [
  ['offline', []], ['larder', []], ['pan', []], ['field', []],
  ['landscape', []], ['reach', []], ['reach', ['320x568']],
  ['strip', []], ['procession', []], ['hearth', []],
];

// Bars whose CLAIM does not exist on a coast, each decided on its own terms
// rather than ported — see 8.5's job 2 in ROADMAP.md. `sea` asks what the map
// promises afloat and a line is never afloat; `pinch` and `way-look` and
// `repaint` are the hex map's own pan, sight and paint cache; `steading` is
// the hex colony yard. They keep running while `VITE_HEX=1` still builds.
const HEX_BARS = [
  ['sea', []], ['pinch', []], ['way-look', []], ['repaint', []], ['steading', []],
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
// This once ran against whatever the last command happened to leave in
// `dist/`, and was correct only as long as nothing else ever built. Then a
// publish of the other build arrived, and a run straight after it reported
// six red bars that were all false. Both builds get their own build step
// here, and the default one goes back at the end: leaving the wrong page in
// `dist/` is a quiet way for it to reach somebody's browser.
if (build({ VITE_HEX: '' }).status !== 0) {
  console.error('bars: the ordinary build did not build — nothing was measured.');
  process.exit(2);
}

for (const [name, args] of BARS) bar(name, args);

// The hex game's own five, which need a build of it.
if (build({ VITE_HEX: '1' }).status !== 0) {
  bad += HEX_BARS.length; ran += HEX_BARS.length;
  console.log(`  FAIL  ${HEX_BARS.map(([n]) => n).join(', ')} — the hex build did not build`);
} else {
  for (const [name, args] of HEX_BARS) bar(name, args, `${name} (hex)`);
}
if (build({ VITE_HEX: '' }).status !== 0) {
  bad++;
  console.log('  FAIL  (the ordinary build could not be put back)');
}

console.log(bad === 0 ? `\nall ${ran} browser bars pass` : `\n${bad} of ${ran} FAILED`);
process.exit(bad === 0 ? 0 : 1);

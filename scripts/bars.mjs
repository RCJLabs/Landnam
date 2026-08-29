// Run every browser bar and report by EXIT CODE, not by what it printed.
//
// Written after a real miss: `node scripts/reach.mjs | tail -6` reports the
// exit code of `tail`, which is always 0, so a FAILING reach audit read as a
// passing one with a warning line. The 390x844 thumb rule was broken for a
// whole commit because of it. A bar that cannot fail loudly is not a bar.
import { spawnSync } from 'node:child_process';

// THE GAME'S OWN BARS. There is one build now — the coast — so there is one
// list, and everything the shipping game has is measured against it.
//
// Five bars used to sit on a second list below, run against `VITE_HEX=1`:
// `sea` asked what the map promised afloat, `pinch`, `way-look` and `repaint`
// were the hex map's own pan, sight and paint cache, and `steading` was the
// hex colony yard. Every one of them made a claim about a coordinate system
// that no longer exists, so they were deleted with it in 8.5 rather than
// translated into claims about a line — the three the line needed
// (`strip`, `procession`, `hearth`) were written for it in job 2.
//
// Keep every bar on this list. `repaint` was once on neither list, so
// `npm run bars` never ran it and it sat red for however long it took the
// deep to get its own pattern pair. A bar nothing runs is not a bar.
const BARS = [
  ['offline', []], ['larder', []], ['pan', []], ['field', []],
  ['landscape', []], ['reach', []], ['reach', ['320x568']],
  ['strip', []], ['procession', []], ['hearth', []], ['ending', []],
];

const build = () => spawnSync('npm', ['run', 'build'], { encoding: 'utf8' });

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

// BUILD FIRST, rather than trusting whatever is in `dist/`.
//
// This once ran against whatever the last command happened to leave there,
// and was correct only as long as nothing else ever built. Then a publish of
// the other build arrived and a run straight after it reported six red bars
// that were all false.
if (build().status !== 0) {
  console.error('bars: the build did not build — nothing was measured.');
  process.exit(2);
}

for (const [name, args] of BARS) bar(name, args);

console.log(bad === 0 ? `\nall ${ran} browser bars pass` : `\n${bad} of ${ran} FAILED`);
process.exit(bad === 0 ? 0 : 1);

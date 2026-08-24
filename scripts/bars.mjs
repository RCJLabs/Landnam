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
  ['repaint', []], ['reach', []], ['reach', ['320x568']],
];

let bad = 0;
for (const [name, args] of BARS) {
  const run = spawnSync('node', [`scripts/${name}.mjs`, ...args], { encoding: 'utf8' });
  const label = args.length ? `${name} ${args.join(' ')}` : name;
  if (run.status === 0) {
    console.log(`  PASS  ${label}`);
  } else {
    bad++;
    const said = (run.stdout + run.stderr).trim().split('\n').filter(Boolean).slice(-2).join(' | ');
    console.log(`  FAIL  ${label} (exit ${run.status}) — ${said}`);
  }
}
console.log(bad === 0 ? `\nall ${BARS.length} browser bars pass` : `\n${bad} of ${BARS.length} FAILED`);
process.exit(bad === 0 ? 0 : 1);

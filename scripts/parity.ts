// Regenerates port/parity.json — the sim's parity contract with the Unreal
// build, facet by facet.
//
//   npm run parity          # write port/parity.json
//   npm run parity -- --check   # print what moved, write nothing
//
// Same arrangement as port/golden.json, and for the same reason: the repo
// that owns the code owns the expectations. `test/parity.test.ts` recomputes
// every reading here from the live sim and fails if any moved, so this file
// cannot go stale without somebody being told. Copy it to the Unreal project
// beside golden.json when a change is deliberate.

import { writeFileSync, readFileSync } from 'node:fs';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { worldHash } from '../src/run/headless';
import { FACETS, readAll } from '../src/run/parity';
import type { Script } from '../src/run/headless';
import type { GameState, HardshipId } from '../src/state/types';

/**
 * The runs the contract is pinned on.
 *
 * Two kinds, deliberately. The bare seeds carry NO actions and exist so the
 * very first stage of the port — worldgen, before a single rule is ported —
 * has a bar it can turn green on its own. The scripted runs are the real
 * ones: recorded games that already reach day 457, replayed by
 * test/headless.test.ts, and exercising travel, battle and colony in one
 * pass. Both sides ship the same runs/*.json, so the actions are a shared
 * input rather than something either implementation invents.
 */
const BARE: { seed: string; hardship: HardshipId }[] = [
  { seed: 'raven-skerry-317', hardship: 'fair' },
  { seed: 'grim-fjord-100', hardship: 'even' },
  { seed: 'curve-7', hardship: 'even' },
  { seed: 'curve-7', hardship: 'hard' },
  { seed: 'Þórr-vik', hardship: 'even' },
];

const SCRIPTED = ['runs/example.json', 'runs/long.json'];

/**
 * Where along a run to take a reading.
 *
 * Fractions of the script rather than fixed indices, so the checkpoints stay
 * meaningful when a script is re-recorded — and one at 0, because the state
 * before anybody acts is the one a port can match on day one.
 */
const AT = [0, 0.1, 0.5, 1];

interface Checkpoint {
  afterActions: number;
  day: number;
  refusedSoFar: number;
  facets: Record<string, unknown>;
}

function checkpointsOf(seed: string, hardship: HardshipId | undefined, actions: Action[]) {
  const marks = [...new Set(AT.map((f) => Math.floor(actions.length * f)))].sort((a, b) => a - b);
  let state = structuredClone(newGame(seed, hardship));
  const out: Checkpoint[] = [];
  let refused = 0;

  for (let i = 0; i <= actions.length; i += 1) {
    if (marks.includes(i)) {
      out.push({ afterActions: i, day: state.day, refusedSoFar: refused, facets: readAll(state) });
    }
    const action = actions[i];
    if (!action) break;
    const next = apply(state, action);
    if (next === state) refused += 1;
    state = next;
  }
  return out;
}

const runs = [
  ...BARE.map(({ seed, hardship }) => ({
    name: `${seed} (${hardship}), worldgen only`,
    seed,
    hardship,
    script: null,
    worldHash: worldHash(newGame(seed, hardship) as GameState),
    checkpoints: checkpointsOf(seed, hardship, []),
  })),
  ...SCRIPTED.map((path) => {
    const script = JSON.parse(readFileSync(path, 'utf8')) as Script;
    return {
      name: `${path}, replayed`,
      seed: script.seed,
      hardship: script.hardship ?? null,
      script: path,
      worldHash: worldHash(newGame(script.seed, script.hardship) as GameState),
      checkpoints: checkpointsOf(script.seed, script.hardship, script.actions),
    };
  }),
];

const fixture = {
  note:
    'Parity vectors for the Unreal port of the SIM. GENERATED FROM src/ — do not hand-edit. '
    + 'This repo owns them (test/parity.test.ts recomputes every one and fails if src/ moved); '
    + 'landnam-ue consumes a copy at Content/Data/parity.json, together with the runs/*.json '
    + 'named below. Facets are hashed SEPARATELY so a port can turn one green at a time: match '
    + 'the facet your stage owns and ignore the rest. `size` is the length of the canonical '
    + 'form, which separates a shape mismatch from a value mismatch; `samples` are plain '
    + 'integers so a red test can say what differs rather than only that something does.',
  facets: FACETS.map((f) => ({ id: f.id, blurb: f.blurb })),
  runs,
};

const text = `${JSON.stringify(fixture, null, 1)}\n`;

if (process.argv.includes('--check')) {
  const old = readFileSync('port/parity.json', 'utf8');
  if (old === text) {
    // eslint-disable-next-line no-console
    console.log('parity: port/parity.json is current');
  } else {
    // eslint-disable-next-line no-console
    console.log(`parity: port/parity.json is STALE (${old.length} -> ${text.length} chars)`);
    process.exitCode = 1;
  }
} else {
  writeFileSync('port/parity.json', text);
  // eslint-disable-next-line no-console
  console.log(
    `parity: wrote port/parity.json — ${runs.length} runs, `
    + `${runs.reduce((a, r) => a + r.checkpoints.length, 0)} checkpoints, `
    + `${FACETS.length} facets each`,
  );
}

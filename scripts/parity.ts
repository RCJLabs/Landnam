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
import { generateWorld } from '../src/sim/worldgen';
import { stream } from '../src/rng';
import { hashOf } from '../src/run/headless';
import { apply, type Action } from '../src/sim/actions';
import { canonical, worldHash } from '../src/run/headless';
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
 * Fractions of the script, so the checkpoints stay meaningful when a script
 * is re-recorded — and one at 0, because the state before anybody acts is
 * the one a port can match on day one.
 */
const AT = [0, 0.1, 0.5, 1];

/**
 * The RAMP: a checkpoint immediately after the first time each action type
 * appears, plus a doubling scale through the opening.
 *
 * The fractions above are the wrong instrument for porting `apply()`. Ten
 * percent of a 1320-action script is action 132, by which point a hundred
 * days have passed and a dozen verbs have fired — so a port that gets CAMP
 * wrong and MOVE right fails at 132 with no way to tell which. That is the
 * all-or-nothing bar again, one level down from the facets it was solved at.
 *
 * So: one bar per verb, at the exact action that first exercises it. Land
 * `MOVE` and the first mark goes green; land `CAMP` and the next one does.
 * The doubling marks catch what only shows up with accumulation — a day
 * counter that drifts, stores that round the wrong way — which a
 * first-occurrence mark never would.
 */
const DOUBLING = [1, 2, 3, 5, 8, 13, 21, 34, 55];

function rampMarks(actions: Action[]): number[] {
  const marks = new Set<number>([0]);
  const seen = new Set<string>();
  actions.forEach((action, i) => {
    if (seen.has(action.type)) return;
    seen.add(action.type);
    // AFTER the action, so the checkpoint shows what it did.
    marks.add(i + 1);
  });
  for (const n of DOUBLING) if (n <= actions.length) marks.add(n);
  for (const f of AT) marks.add(Math.floor(actions.length * f));
  return [...marks].sort((a, b) => a - b);
}

interface Checkpoint {
  afterActions: number;
  /** The action type that got here, so a red mark names the verb to look at. */
  action: string | null;
  /** True when this is the FIRST time that verb appears — the ramp's rungs. */
  firstOf?: true;
  day: number;
  refusedSoFar: number;
  facets: Record<string, unknown>;
}

function checkpointsOf(seed: string, hardship: HardshipId | undefined, actions: Action[]) {
  const marks = rampMarks(actions);
  const firstSeen = new Map<string, number>();
  actions.forEach((a, i) => { if (!firstSeen.has(a.type)) firstSeen.set(a.type, i); });
  let state = structuredClone(newGame(seed, hardship));
  const out: Checkpoint[] = [];
  let refused = 0;

  for (let i = 0; i <= actions.length; i += 1) {
    if (marks.includes(i)) {
      const last = i > 0 ? actions[i - 1] : undefined;
      out.push({
        afterActions: i,
        action: last?.type ?? null,
        ...(last && firstSeen.get(last.type) === i - 1 ? { firstOf: true as const } : {}),
        day: state.day,
        refusedSoFar: refused,
        facets: readAll(state),
      });
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
    // Stage 1's own bar, and deliberately SMALLER than the `world` facet.
    // `generateWorld` is the terrain and nothing else; the facet also carries
    // the landing's name, the trodden hexes and the seeded places, which come
    // from `newGame` afterwards and need the place tables ported first. A
    // stage that had to land all of that before anything could go green would
    // be back to the all-or-nothing bar facets exist to avoid.
    worldgenHash: hashOf(generateWorld(stream(seed, 'worldgen'))),
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
      // What this run exercises and how often, so a porter can pick the
      // order to implement verbs in rather than discovering it by failing.
      actionCounts: Object.fromEntries(
        Object.entries(
          script.actions.reduce<Record<string, number>>((a, x) => {
            a[x.type] = (a[x.type] ?? 0) + 1;
            return a;
          }, {}),
        ).sort((a, b) => b[1] - a[1]),
      ),
      checkpoints: checkpointsOf(script.seed, script.hardship, script.actions),
    };
  }),
];

/**
 * The canonical form of a NUMBER, pinned on its own.
 *
 * This is the single most likely place two languages disagree about
 * identical values, and it is worth catching before it is buried under a
 * half-ported sim: `toPrecision(15)` switches to exponential at both ends of
 * the range, an integer prints through `String()` which ALSO goes
 * exponential past 1e21, and negative zero has to come out as plain zero or
 * two implementations hash the same state differently.
 *
 * Testable with no sim at all, which is the point — the C++ side can pass
 * this on the day the port starts and stop worrying about it.
 */
const CANONICAL_NUMBERS = [
  0, 1, -1, 42, -42, 100, 2.5, -0.75, 0.1, 0.5,
  1 / 3, 2 / 3, 0.1 + 0.2, 3.14159265358979, 1234567.891,
  1e21, 1e-7, 1e300, 9007199254740991, -9007199254740991,
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
  canonical: {
    note:
      'The canonical form of a number, and of the two values JSON cannot carry. '
      + 'Verifiable with no sim at all, so a port can settle number formatting — the '
      + 'likeliest place two languages disagree about identical values — before it is '
      + 'buried under half-ported rules.',
    numbers: CANONICAL_NUMBERS.map((value) => ({ value, text: canonical(value) })),
    negativeZero: canonical(-0),
    emptyObject: canonical({}),
    sortedKeys: canonical({ b: 2, a: 1, C: 3, '': 0 }),
    nested: canonical({ z: [1, { y: 'x' }], a: null }),
    strings: ['', 'a', 'Þórr', 'quote"back\\slash', '😀'].map((value) => ({
      value, text: canonical(value),
    })),
  },
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

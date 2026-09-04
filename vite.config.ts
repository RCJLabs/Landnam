import { execSync } from 'node:child_process';
import { configDefaults, defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * A build stamp baked into the page.
 *
 * Without one there is no way to tell a stale deploy from a working one from
 * inside the game — which is exactly the question a phone browser holding a
 * cached index.html makes you ask. On the title screen it is one glance.
 */
function buildStamp(): string {
  const sha = (process.env['GITHUB_SHA'] ?? gitSha()).slice(0, 7);
  return `${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
}

function gitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

// Relative base + singlefile: the built index.html must run from a file://
// open with no external requests (hard constraint 1).
export default defineConfig({
  base: './',
  define: {
    __BUILD__: JSON.stringify(buildStamp()),
  },
  plugins: [viteSingleFile()],
  // The source entry is app.html, not index.html. index.html at the repo root
  // is the BUILT page — GitHub Pages serves whatever sits at the root of the
  // published branch, and a Vite entry there (four lines that load
  // /src/main.ts) publishes as a blank screen with a dead script tag.
  server: { open: '/app.html' },
  test: {
    // The balance harness pegs a core for eighty seconds at a stretch, and
    // on a two-core CI runner the default worker-thread pool misses its RPC
    // heartbeat under that load — "[vitest-worker]: Timeout calling
    // onTaskUpdate" — which fails the run with every one of 560 tests green.
    // Forked child processes tolerate a pegged CPU where worker threads do
    // not, and CI is the environment this config exists to survive.
    pool: 'forks',
    // The same two cores make the 5s default test budget a lottery: any
    // test that simulates a few whole battles or a month of days runs in
    // under a second on a dev box and past 5s with the suite competing for
    // the runner. Two consecutive CI runs failed GREEN suites on two
    // DIFFERENT such tests. A minute is not a license for slow tests; it
    // is the same test on slower hardware. The truly long harnesses still
    // carry their own explicit, larger budgets.
    testTimeout: 60_000,
    /**
     * THE PROBES DO NOT RUN IN `npm test`, and this is what made CI green.
     *
     * `test/probes.test.ts` holds the diagnostic sweeps — instruments that
     * exist so a reading can be RE-TAKEN. They print tables and assert almost
     * nothing. Running them on every push was a category error: the bars are
     * the gate, the probes are the microscope.
     *
     * It was also FAILING THE BUILD. Every CI run finished `92 passed, 1569
     * tests passed` and then exited 1 on an unhandled
     * `[vitest-worker]: Timeout calling "onTaskUpdate"` — the exact hazard the
     * note above records as having failed a run once before with every test
     * green. Measured 2026-09-02: with the probes excluded the error does not
     * occur at all (0 occurrences, against 3 of 3 runs with them), and the
     * suite goes 2,465s → 1,273s.
     *
     * Two other fixes were tried and rejected ON MEASUREMENT. Capping the fork
     * pool (`VITEST_MAX_FORKS=2`) was 80% SLOWER and still errored. And the
     * mechanism it assumed — two CPU-pegged forks starving the main process —
     * is refuted: `probes.test.ts` reproduces the error running ALONE. What
     * survives is a correlation with one very long, very chatty file, and
     * excluding it is the only fix measured to work.
     *
     * Run them with `npm run probes`. They are not deleted, not skipped and
     * not weakened — they are simply not a gate.
     *
     * THE ENV TOGGLE IS NOT DECORATION. vitest applies `exclude` even to an
     * explicit file filter, so `vitest run test/probes.test.ts` against a
     * config that excludes it exits with "No test files found" — and passing
     * `--exclude` on the command line does not override it either. Both were
     * tried. Without this flag the script named two lines above would be an
     * instruction that does not work.
     */
    exclude: [
      ...configDefaults.exclude,
      ...(process.env['PROBES'] ? [] : ['test/probes.test.ts']),
    ],
  },
  build: {
    rollupOptions: { input: 'app.html' },
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});

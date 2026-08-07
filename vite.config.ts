import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
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
  },
  build: {
    rollupOptions: { input: 'app.html' },
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});

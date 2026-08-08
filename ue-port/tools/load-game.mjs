// Bundles the game's TypeScript to ESM so plain node can import it. The tools here
// read the real src/ modules rather than copies, so an export can never drift from
// what the game actually ships.

import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, '../..');

/**
 * @param {Record<string, string>} modules  namespace -> path relative to the repo root
 * @returns the namespaces, e.g. loadGame({ Hex: './src/hex/index.ts' }) -> { Hex }
 */
export async function loadGame(modules) {
  const contents = Object.entries(modules)
    .map(([name, path]) => `export * as ${name} from '${path}';`)
    .join('\n');

  const built = await build({
    stdin: { contents, resolveDir: repoRoot, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });

  // A unique filename per run keeps concurrent invocations from clobbering each other.
  const bundlePath = resolve(tmpdir(), `landnam-ue-${process.pid}-${Object.keys(modules).join('-')}.mjs`);
  writeFileSync(bundlePath, built.outputFiles[0].text);
  return import(pathToFileURL(bundlePath).href);
}

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Relative base + singlefile: the built index.html must run from a file://
// open with no external requests (hard constraint 1).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});

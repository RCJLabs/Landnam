import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves from /<repo>/ — override with BASE env if needed.
  base: process.env.BASE ?? '/Viking-Sim/',
  build: { target: 'es2022' },
});

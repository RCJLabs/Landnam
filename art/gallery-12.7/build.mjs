// Inline the three modules and the scene into one file: an Artifact is a
// single page, and the scene is 5 kB.
import { readFileSync, writeFileSync } from 'node:fs';
const strip = (f) => readFileSync(f, 'utf8')
  .replace(/^import .*?;\n/gms, '')
  .replace(/^export (const|function|interface) /gm, '$1 ')
  .replace(/^export /gm, '');
const scene = readFileSync('gallery-scene.json', 'utf8');
const html = readFileSync('shell.html', 'utf8');
const js = `<script>
const SCENE = ${scene};
${strip('geom.js')}
${strip('treatments.js')}
${strip('app.js')}
const T = { asItStands, woodcut, embroidery, pixel, vellum, runestone, inkwash, papercraft, terminal, enamel };
start(SCENE, T);
</script>`;
writeFileSync('index.html', `${html}\n${js}\n`);
console.log('built', (html.length + js.length / 1) / 1024 | 0, 'kB');

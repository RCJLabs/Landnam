# The 12.7 wall — one scene, ten treatments

Published at
<https://claude.ai/code/artifact/825ab2dc-2533-402c-9b9e-9d697220d37e>.

## Why it draws nothing of its own

The only identity decision on record is one sentence — "Ten art directions
were mocked up and three shortlisted; oil on canvas won" (ROADMAP.md
:11247-11249, 2026-08-25) — the ten unnamed, the seven dropped unrecorded,
and the mockup it was made on drew a **hex** island and loaded Google Fonts.
A figure measured in a fixture is not a figure about the game (CLAUDE.md,
trap 1).

So every position, colour, name, proportion and roofline on this wall is read
out of the game's own derivations — `standAt`, `lookOf`, `steadingScene`,
`processionScene` — for a single real moment. The ten panels differ in
MATERIAL and in nothing else. A style gallery whose panels show different
subjects compares nothing.

## Rebuilding it

```
npm run scene      # replays the saga, writes gallery-scene.json
node build.mjs     # inlines geom/treatments/app + the scene into index.html
node check.mjs     # 390x844, 320x568, 1280x900: every plate drawn, no overflow
node zoom.mjs woodcut vellum   # screenshot single panels, to look at them
```

`npm run scene` is `test/scene.test.ts`, excluded from `npm test` the way the
probes are — it asserts nothing about the game and writes a file, so it is a
tool that happens to need the TypeScript sim.

## The files

| file | what it is |
|---|---|
| `geom.js` | the shared geometry — every panel draws this and only this |
| `treatments.js` | the ten materials, one function each |
| `app.js` | the ten labels, and the wall |
| `shell.html` | the page around it |
| `gallery-scene.json` | the moment, written by `npm run scene` |
| `index.html` | the built page, by `build.mjs` |

## What the wall found

**`check.mjs` cannot see a wrong drawing.** It was green through four faults
that a person spotted in a second: a wall drawn at 2.1x `FIGURE_W` against a
21px rank step, so it smeared; a rune-stone that outlined every part into
scribble; an ink wash that printed instead of soaking; and a pixel panel that
rasterised through a `data:` URI — the one plate on the page able to go blank
with no error at all. Look at the pictures.

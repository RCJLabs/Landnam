// THE SCENE EXTRACTOR for the 12.7 gallery. Not a bar and not a probe.
//
// It asserts nothing about the game. It plays one seeded saga with the
// harness and writes out what the game's OWN derivations say about a single
// moment, so the gallery in `art/gallery-12.7/` draws the thing rather than a
// drawing of it. Excluded from `npm test` the way the probes are — run it
// with `npm run scene`.
//
// THIS IS THE WHOLE REASON IT EXISTS. The identity decision on record
// (:11247-11249, 2026-08-25) was made on a mockup that drew a HEX island and
// loaded Google Fonts: a figure measured in a fixture, offered as a fact
// about the game — trap 1 in CLAUDE.md. Ten treatments of a scene somebody
// invented would repeat it exactly. So: one seed, one stop, one fight moment,
// and every colour, name, position and proportion below comes out of
// `processionScene`, `steadingScene`, `standAt` and `lookOf`.

import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GameState } from '../src/state/types';
import { run, SETTLER, setPolicy } from './fixtures/harness';
import { processionScene } from '../src/render/procession';
import { steadingScene } from '../src/render/steading';
import { lookOf } from '../src/render/look';
import { standAt, extent, FIGURE_H, FIGURE_W, RANK_GAP, GROUND_Y } from '../src/render/line';
import { SHARED } from '../src/render/palette';

const OUT = 'art/gallery-12.7/gallery-scene.json';

/** A look without its RNG — the stream is not JSON and the gallery is. */
function lookFor(person: Parameters<typeof lookOf>[0], friendly: boolean) {
  const { rng, ...rest } = lookOf(person, friendly);
  void rng;
  return rest;
}

describe('the 12.7 gallery scene', () => {
  it('writes one real moment out of the real derivations', () => {
    setPolicy(SETTLER);

    // The fight is caught AS IT HAPPENS rather than reconstructed after: the
    // first round where blood has been drawn and the outcome is still open,
    // because a fight that has ended has nobody standing in the second rank.
    let fight: GameState | null = null;
    const state = run('landnam-gallery', 260, (_before, after) => {
      const b = after.battle;
      if (!b || b.outcome || fight) return;
      if (b.combatants.some((c) => c.down || c.fled)) fight = structuredClone(after);
    });
    if (!state.settlement) throw new Error('no steading: the gallery needs a roofline');
    if (!fight) throw new Error('no fight was caught: the gallery needs a moment');

    const caught: GameState = fight;
    const road = processionScene(state);
    const yard = steadingScene(state);

    const scene = {
      seed: state.seed,
      day: state.day,
      stop: road.at,
      country: road.country,
      weather: road.weather,
      season: road.season,
      rival: road.ahead.find((a) => a.kind === 'rival')?.name ?? null,
      steading: {
        name: yard.name,
        greened: yard.greened,
        trodden: yard.trodden,
        smoke: yard.smoke,
        woodpile: yard.woodpile,
        width: yard.width,
        ground: yard.ground,
        children: yard.childNames,
        raised: yard.raised.map((b) => ({ name: b.name, x: b.x, size: b.size })),
      },
      round: caught.battle!.round,
      log: caught.battle!.log.slice(-6),
      figures: caught.battle!.combatants.map((c) => {
        // BOTH SIDES. Foes are Person objects too — "same model, same
        // renderer treatment" (state/types.ts) — but they live on
        // `battle.foes`, not in the party. Looking only in `party.people`
        // gave every enemy no look at all, and the gallery drew four men
        // whose every proportion was NaN. It failed loudly here and would
        // have failed silently in a panel that swallowed the error.
        const person = caught.party.people.find((p) => p.id === c.personId)
          ?? caught.battle!.foes.find((p) => p.id === c.personId);
        if (!person) throw new Error(`no person behind combatant ${c.personId}`);
        const spot = standAt(c.side, c.rank);
        return {
          name: person.name,
          side: c.side,
          rank: c.rank,
          down: c.down,
          nerve: Math.round(c.nerve),
          x: spot.x,
          y: spot.y,
          ...lookFor(person, c.side === 'warband'),
        };
      }),
      // The proportions the drawing hangs off. A man is the SAME height in
      // every rank (line.ts: "a deep line is a longer field, not smaller
      // men"), so the gallery must not add perspective the game does not have.
      line: {
        rankGap: RANK_GAP,
        figureH: FIGURE_H,
        figureW: FIGURE_W,
        groundY: GROUND_Y,
        extent: extent(2),
      },
      palette: Object.fromEntries(SHARED.map(([n, hex]) => [n, hex])),
    };

    mkdirSync('art/gallery-12.7', { recursive: true });
    writeFileSync(OUT, `${JSON.stringify(scene, null, 1)}\n`);
    console.log(
      `${OUT}: day ${scene.day}, stop ${scene.stop}, ${scene.season}/${scene.weather}, `
      + `${scene.steading.name} (${scene.steading.raised.length} raised), `
      + `round ${scene.round}, ${scene.figures.length} in the line`,
    );
  });
});

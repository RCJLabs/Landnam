// What one person looks like, decided once from who they are.
//
// This is CLAUDE.md's first pillar made visible. A `Person` is a single
// object across travel, battle and the colony, so their LOOK has to be a
// single object too — and it was not. `figures.ts` derived a shield paint,
// a cloak and a motif inline, which meant the only place in the game that
// knew what Ulf looked like was the one place that drew Ulf head-on with a
// shield in front of his face. The road and the yard called the same
// function, got the same head-on fighter, and at 26px it read as a coloured
// disc: six people, six discs, nobody recognisable.
//
// So the derivation moved out here, where a side-on walker can ask the same
// question and get the same answer. `walker.ts` and `figures.ts` now draw
// two views of ONE person rather than two people who happen to share a name.
//
// Seeded, and off the person rather than off any run stream: decoration
// consumes nothing the sim rolls, and the same Ulf looks the same on every
// paint and every reload.

import { makeRng, type Rng } from '../rng';
import type { Person } from '../state/types';
import { mix } from './terrainArt';
import { BLACK, BLOOD, GOLD, HAFT, INK, IRON, PARCHMENT, SKIN, SLATE, WATER, WHITE } from './palette';

export const darken = (hex: string, amount: number): string => mix(hex, BLACK, amount);
export const lighten = (hex: string, amount: number): string => mix(hex, WHITE, amount);

/**
 * Period shield paint, split by side so the one glance that decides a fight
 * — who is ours — never has to be read off a motif. The warband paints warm
 * (madder, ochre, oxblood, parchment); the foes cold (woad, sea, iron,
 * slate). Any pairing within a family stays inside that read.
 *
 * Four of the warm grounds and two of the cold ones ARE the game's own ink —
 * the madder is the blood, the ochre is the gold, the pale is the parchment
 * — so they come from `palette.ts` rather than being spelled again here. A
 * shield painted in a colour nothing else in the game uses is a shield from
 * a different game. The rest are wardrobe and belong to this file.
 */
export const WARM = [BLOOD, GOLD, '#8a2f24', PARCHMENT, HAFT];
export const COLD = [SLATE, WATER, '#6a7684', '#4a555f', '#8fa0b4'];

// Kept as re-exports: half the renderers import IRON and INK from here, and
// this is the file they think of as the source for what a person is made of.
export { IRON, INK };

/** Undyed and cheaply dyed wool. What a tunic is, when nobody is showing off. */
const WOOL = ['#7a6a4e', '#6b5f4a', '#8a7b5c', '#5f5642', '#7d7360', '#916f4a'];

/** Hair, north Atlantic: flax, red, brown, dark. */
const HAIR = ['#c9a86a', '#a55a34', '#6b4a30', '#3d2f22'];

/** The age a head starts going grey. Not a cliff — see `lookOf`. */
const GREYING = 42;

/**
 * How much taller or shorter than nominal a person is drawn.
 *
 * Six people the same height is a sprite repeated; six people who differ by a
 * hand's breadth is a band. `walker.ts` sizes its own bounding box off
 * `BUILD_MAX`, which is why these are named rather than inline.
 */
export const BUILD_MIN = 0.92;
export const BUILD_MAX = 1.08;

export interface Look {
  /** The shield's ground. */
  field: string;
  /** The paint on it. */
  accent: string;
  cloak: string;
  /** Which of the five motifs, and how it sits. */
  motifKind: number;
  motifTilt: number;
  tunic: string;
  hair: string;
  /** 0 clean-shaven, 1 trimmed, 2 full. */
  beard: number;
  /** Where in a stride they are, so a file does not march in lockstep. */
  stride: number;
  /** 0.92..1.08 of the nominal height. Six people are not six of one person. */
  build: number;
  /**
   * The stream, left exactly where the look derivation stopped.
   *
   * `figure()` draws its crack angles off it, and did so before this file
   * existed, so it is handed back live rather than replaced by a fresh one.
   * The paint is therefore unchanged — every shield in the game is the
   * shield it was. The crack ANGLES did move, by exactly the five draws the
   * side-on figure added below, and that is the one visible consequence of
   * this refactor: a scratch on a battered shield points somewhere else.
   */
  rng: Rng;
}

/**
 * Everything about how this person is drawn, anywhere.
 *
 * The first five draws are in the order `figures.ts` made them, and must
 * stay that way: reordering them repaints every shield in the game for no
 * reason anyone could see a reason for.
 */
export function lookOf(person: Person, friendly: boolean): Look {
  // `name` joins the id so two runs' "p3" are not condemned to the same
  // shield.
  const rng = makeRng(`landnam-figure:${person.id}:${person.name}`);
  const palette = friendly ? WARM : COLD;
  const fieldIx = rng.int(0, palette.length - 1);
  let accentIx = rng.int(0, palette.length - 2);
  if (accentIx >= fieldIx) accentIx += 1;
  const field = palette[fieldIx]!;
  const accent = palette[accentIx]!;
  const cloak = darken(palette[rng.int(0, palette.length - 1)]!, 0.35);
  const motifKind = rng.int(0, 4);
  const motifTilt = rng.float(0, Math.PI * 2);

  // Everything below is new with the side-on figure, and is drawn AFTER the
  // five above for that reason.
  const tunic = WOOL[rng.int(0, WOOL.length - 1)]!;
  const born = HAIR[rng.int(0, HAIR.length - 1)]!;
  const beard = rng.int(0, 2);
  const stride = rng.float(0, 1);
  const build = BUILD_MIN + rng.float(0, BUILD_MAX - BUILD_MIN);

  // Grey comes in over about fifteen years rather than on a birthday, so a
  // man the player has walked beside for two hundred days goes grey while
  // they watch. Age is the one part of a look that is not seeded: it is a
  // fact about the person, and the picture should carry it.
  const grey = Math.max(0, Math.min(0.7, (person.age - GREYING) / 15));
  const hair = grey > 0 ? mix(born, '#cfc9bd', grey) : born;

  return { field, accent, cloak, motifKind, motifTilt, tunic, hair, beard, stride, build, rng };
}

/**
 * What somebody who is not in the warband is wearing, from their name.
 *
 * THIS EXISTS BECAUSE A VIEW HAD INVENTED ITS OWN. `steadingView.ts` drew the
 * children of the household with
 *
 *     const tunic = ['#7a6a4e', '#916f4a', '#6b5f4a'][rng.int(0, 2)]!;
 *
 * — three of this file's six wools, copied out, so a child could only ever
 * wear half the wardrobe and would keep wearing those three if the wardrobe
 * here ever changed. CLAUDE.md's first pillar says it in as many words: a
 * view that invents its own colours for a person has broken it. The children
 * are named people with a seed of their own; they were just not going through
 * the file that decides what people look like.
 *
 * They are not a `Person` — they have a name and nothing else — so this is
 * the name-only door into the same wardrobe rather than a second one.
 */
export function folkLook(name: string): { tunic: string; skin: string } {
  const rng = makeRng(`landnam-folk:${name}`);
  return { tunic: WOOL[rng.int(0, WOOL.length - 1)]!, skin: SKIN };
}

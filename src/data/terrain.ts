// Terrain definitions: movement, yields, and the palette the SVG renderer
// paints with. All terrain tuning lives here, never in engine or render code.

import type { Terrain } from '../state/types';

export interface TerrainDef {
  id: Terrain;
  name: string;
  /** Effort to enter. Infinity means impassable on foot. */
  cost: number;
  /** Base yields per forage action, before season and stat modifiers. */
  forage: number;
  hunt: number;
  fish: number;
  /** Firewood gathered per camp night. */
  wood: number;
  /** Blocks sight beyond it (hills, mountains, dense forest). */
  blocksSight: boolean;
  /** Base fill and a darker edge, both painted as flat SVG. */
  fill: string;
  edge: string;
}

const DEFS: Record<Terrain, TerrainDef> = {
  ocean: {
    id: 'ocean',
    name: 'Open Sea',
    // Impassable on foot. The knarr crosses coastal water — see SEA_EFFORT in
    // sim/travel.ts, which is where the sea's own rules live.
    cost: Infinity,
    forage: 0,
    hunt: 0,
    fish: 5,
    wood: 0,
    blocksSight: false,
    fill: '#1d3b52',
    edge: '#163043',
  },
  shore: {
    id: 'shore',
    name: 'Shore',
    cost: 1,
    forage: 2,
    hunt: 1,
    fish: 4,
    wood: 1,
    blocksSight: false,
    fill: '#b9a173',
    edge: '#9c8760',
  },
  meadow: {
    id: 'meadow',
    name: 'Meadow',
    cost: 1,
    forage: 3,
    hunt: 2,
    fish: 0,
    wood: 1,
    blocksSight: false,
    fill: '#6b7f4a',
    edge: '#5a6c3e',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    cost: 2,
    forage: 4,
    hunt: 4,
    fish: 0,
    wood: 4,
    blocksSight: true,
    fill: '#3f5a35',
    edge: '#33492b',
  },
  hills: {
    id: 'hills',
    name: 'Hills',
    cost: 2,
    forage: 2,
    hunt: 3,
    fish: 0,
    wood: 2,
    blocksSight: true,
    fill: '#77704a',
    edge: '#635d3e',
  },
  mountains: {
    id: 'mountains',
    name: 'Mountains',
    cost: 4,
    forage: 1,
    hunt: 1,
    fish: 0,
    wood: 0,
    blocksSight: true,
    fill: '#6d6a66',
    edge: '#565350',
  },
  bog: {
    id: 'bog',
    name: 'Bog',
    cost: 3,
    forage: 2,
    hunt: 2,
    fish: 1,
    wood: 1,
    blocksSight: false,
    fill: '#4c5340',
    edge: '#3e4435',
  },
  valley: {
    id: 'valley',
    name: 'Fertile Valley',
    cost: 1,
    forage: 5,
    hunt: 3,
    fish: 0,
    wood: 2,
    blocksSight: false,
    fill: '#7d9150',
    edge: '#697b43',
  },
};

export function terrainDef(terrain: Terrain): TerrainDef {
  return DEFS[terrain];
}

export function isLand(terrain: Terrain): boolean {
  return terrain !== 'ocean';
}

/** Every terrain except ocean, for worldgen weighting. */
export const LAND_TERRAINS: Terrain[] = [
  'shore',
  'meadow',
  'forest',
  'hills',
  'mountains',
  'bog',
  'valley',
];

// Battle construction from a raid template + the living crew.

import { Axial, key, offsetToAxial } from '../../core/hex';
import { Rng } from '../../core/rng';
import { RaidDef } from '../../content/raids';
import { enemyById } from '../../content/enemies';
import { effStat } from '../strategic/crewGen';
import { Battle, BattleTile, BattleTerrain, CrewMember, Unit } from '../types';

const CHAR_TERRAIN: Record<string, BattleTerrain> = {
  '.': 'grass',
  s: 'sand',
  ',': 'floor',
  d: 'deck',
  '~': 'water',
  '#': 'wall',
  '^': 'rock',
  P: 'sand',
  E: 'grass',
};

export function unitFromCrew(c: CrewMember, at: Axial): Unit {
  const weaponBonus = c.weapon === 'sword' ? 1 : 0;
  const weaponDamage = c.weapon === 'spear' ? 3 : c.weapon === 'axe' ? 3 : c.weapon === 'sword' ? 3 : 2;
  const armorBonus = c.armor === 'mail' ? 2 : c.armor === 'leather' ? 1 : 0;
  return {
    id: `u_${c.id}`,
    crewId: c.id,
    side: 'player',
    kind: 'crew',
    name: c.name,
    at,
    hp: c.hp,
    hpMax: c.hpMax,
    atk: effStat(c, 'might') + weaponBonus,
    def: Math.ceil(effStat(c, 'skill') / 2) + armorBonus,
    guts: effStat(c, 'guts'),
    move: 3,
    damage: weaponDamage,
    isLeader: c.isCaptain,
    fatigue: c.fatigue,
    statuses: [],
    movesLeft: 3,
    hasActed: false,
    alive: true,
    escaped: false,
  };
}

export function makeBattle(
  raid: RaidDef,
  crew: CrewMember[],
  dangerTier: 0 | 1 | 2 | 3,
  rng: Rng,
): Battle {
  const grid: Record<string, BattleTile> = {};
  const playerSpots: Axial[] = [];
  const enemySpots: Axial[] = [];
  const height = raid.template.length;
  const width = raid.template[0]!.length;

  // On shipboard maps, deploy zones are deck rather than beach/grass.
  const afloat = raid.template.some((row) => row.includes('d'));
  raid.template.forEach((row, r) => {
    for (let col = 0; col < row.length; col++) {
      const ch = row[col]!;
      const h = offsetToAxial(col, r);
      const terrain = ch === 'P' || ch === 'E' ? (afloat ? 'deck' : CHAR_TERRAIN[ch]!) : (CHAR_TERRAIN[ch] ?? 'grass');
      grid[key(h)] = { terrain, cover: terrain === 'floor' ? 1 : 0 };
      if (ch === 'P') playerSpots.push(h);
      if (ch === 'E') enemySpots.push(h);
    }
  });

  const units: Unit[] = [];
  const fighters = crew.filter((c) => c.alive).slice(0, playerSpots.length);
  fighters.forEach((c, i) => units.push(unitFromCrew(c, playerSpots[i]!)));

  const roster = raid.roster[dangerTier];
  const spots = rng.shuffle([...enemySpots]);
  roster.forEach((kind, i) => {
    const spot = spots[i % spots.length];
    if (!spot || units.some((u) => u.side === 'enemy' && u.at.q === spot.q && u.at.r === spot.r)) return;
    const def = enemyById(kind);
    units.push({
      id: `e_${i + 1}`,
      side: 'enemy',
      kind,
      name: def.name,
      at: spot,
      hp: def.hp,
      hpMax: def.hp,
      atk: def.atk,
      def: def.def,
      guts: def.guts,
      move: def.move,
      damage: def.damage,
      isLeader: def.leader ?? false,
      fatigue: 0,
      statuses: [],
      movesLeft: def.move,
      hasActed: false,
      alive: true,
      escaped: false,
    });
  });

  return {
    raidId: raid.id,
    title: raid.title,
    width,
    height,
    grid,
    units,
    round: 1,
    actionN: 0,
    sideMorale: {
      player: 10 + 2 * units.filter((u) => u.side === 'player').length,
      enemy: 10 + 2 * units.filter((u) => u.side === 'enemy').length,
    },
    lootText: raid.lootText,
    loot: raid.loot,
  };
}

// Enemy archetypes for tactical battles.

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  guts: number;
  move: number;
  damage: number;
  /** AI temperament: brave units press in, cowards keep distance/flee early. */
  brave: boolean;
  leader?: boolean;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'monk', name: 'Brother', hp: 6, atk: 2, def: 2, guts: 2, move: 3, damage: 2, brave: false },
  { id: 'levy', name: 'Levyman', hp: 8, atk: 3, def: 3, guts: 3, move: 3, damage: 2, brave: false },
  { id: 'warrior', name: 'Shore-Guard', hp: 11, atk: 4, def: 4, guts: 4, move: 3, damage: 3, brave: true },
  { id: 'huscarl', name: 'Huscarl', hp: 14, atk: 5, def: 5, guts: 5, move: 3, damage: 4, brave: true, leader: true },
  { id: 'seawolf', name: 'Sea-Wolf', hp: 10, atk: 4, def: 3, guts: 4, move: 3, damage: 3, brave: true },
  { id: 'wolfchief', name: 'Wolf-Chief', hp: 13, atk: 5, def: 4, guts: 5, move: 3, damage: 4, brave: true, leader: true },
  { id: 'draugr', name: 'Draugr', hp: 12, atk: 4, def: 3, guts: 6, move: 2, damage: 3, brave: true },
];

export function enemyById(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`unknown enemy ${id}`);
  return def;
}

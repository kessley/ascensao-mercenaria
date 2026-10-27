import type { TerrainZone } from "../world/TerrainMap";
import type { EnemyKind } from "../../utils/constants";
import type { Point } from "../../utils/math";

export type MapId = "GOBLIN_NEST" | "FOREST_ROAD" | "SWAMP_FORD" | "CAMP";

export interface EnemyGroupDef {
  x: number;
  y: number;
  units: [EnemyKind, number][];
}

/** Tudo o que a BattleScene precisa para montar uma batalha. */
export interface BattleSetup {
  mapId: MapId;
  name: string;
  /** Onde o Comandante começa (os batalhões surgem atrás dele). */
  start: Point;
  terrain: TerrainZone[];
  enemyGroups: EnemyGroupDef[];
}

/** Mapas base. O Comandante sempre parte do oeste; os inimigos estão a leste. */
export const BATTLE_MAPS: Record<Exclude<MapId, "CAMP">, BattleSetup> = {
  // Colina livre à frente, lama no sul, emboscada na floresta ao norte, arqueiros numa colina a leste
  GOBLIN_NEST: {
    mapId: "GOBLIN_NEST",
    name: "Ninho goblin",
    start: { x: 500, y: 1200 },
    terrain: [
      { type: "HILL", x: 1100, y: 1050, rx: 230, ry: 170 },
      { type: "MUD", x: 1400, y: 1650, rx: 260, ry: 150 },
      { type: "SWAMP", x: 2150, y: 1950, rx: 380, ry: 200 },
      { type: "FOREST", x: 1850, y: 620, rx: 380, ry: 250 },
      { type: "HILL", x: 2650, y: 1250, rx: 220, ry: 160 },
    ],
    enemyGroups: [
      { x: 1750, y: 1200, units: [["GOBLIN", 6]] },
      { x: 1850, y: 640, units: [["GOBLIN", 6]] },
      { x: 2500, y: 1450, units: [["GOBLIN", 7]] },
      { x: 2680, y: 1240, units: [["GOBLIN_ARCHER", 5]] },
    ],
  },
  // Estrada aberta entre duas florestas: emboscadas dos dois lados, bloqueio no fim da estrada
  FOREST_ROAD: {
    mapId: "FOREST_ROAD",
    name: "Estrada da floresta",
    start: { x: 400, y: 1200 },
    terrain: [
      { type: "FOREST", x: 1500, y: 750, rx: 700, ry: 260 },
      { type: "FOREST", x: 1500, y: 1650, rx: 700, ry: 260 },
      { type: "HILL", x: 800, y: 1200, rx: 170, ry: 140 },
      { type: "FOREST", x: 2700, y: 600, rx: 300, ry: 220 },
      { type: "MUD", x: 2350, y: 1200, rx: 160, ry: 110 },
    ],
    enemyGroups: [
      { x: 1300, y: 830, units: [["GOBLIN", 5]] },
      { x: 1700, y: 1580, units: [["GOBLIN", 5]] },
      { x: 1950, y: 880, units: [["GOBLIN_ARCHER", 4]] },
      { x: 2700, y: 1200, units: [["GOBLIN", 8]] },
    ],
  },
  // Faixa de pântano cortando o mapa, com um vau estreito no meio; arqueiros na colina do outro lado
  SWAMP_FORD: {
    mapId: "SWAMP_FORD",
    name: "Vau do pântano",
    start: { x: 450, y: 1200 },
    terrain: [
      { type: "SWAMP", x: 1600, y: 600, rx: 260, ry: 520 },
      { type: "SWAMP", x: 1600, y: 1850, rx: 260, ry: 520 },
      { type: "MUD", x: 1600, y: 1220, rx: 150, ry: 120 },
      { type: "HILL", x: 2300, y: 1200, rx: 260, ry: 200 },
      { type: "FOREST", x: 900, y: 600, rx: 260, ry: 180 },
    ],
    enemyGroups: [
      { x: 1950, y: 1200, units: [["GOBLIN", 8]] },
      { x: 2350, y: 1180, units: [["GOBLIN_ARCHER", 6]] },
      { x: 2650, y: 1500, units: [["GOBLIN", 6]] },
    ],
  },
};

/** Batalha do motim: campo aberto do acampamento; os amotinados surgem a leste. */
export function mutinySetup(units: [EnemyKind, number][]): BattleSetup {
  return {
    mapId: "CAMP",
    name: "Motim no acampamento",
    start: { x: 1200, y: 1200 },
    terrain: [{ type: "HILL", x: 900, y: 900, rx: 160, ry: 120 }],
    enemyGroups: [{ x: 1750, y: 1200, units }],
  };
}

/** Escala os grupos inimigos de um mapa conforme a dificuldade do contrato. */
export function scaledSetup(base: BattleSetup, multiplier: number): BattleSetup {
  return {
    ...base,
    enemyGroups: base.enemyGroups.map((g) => ({
      ...g,
      units: g.units.map(([kind, n]) => [kind, Math.max(1, Math.round(n * multiplier))] as [EnemyKind, number]),
    })),
  };
}

import type { TerrainZone } from "../world/TerrainMap";
import type { EnemyGroupDef } from "./battleMaps";
import { WORLD, WORLD_COLS, WORLD_HEIGHT, WORLD_ROWS, WORLD_WIDTH } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Tipos do mundo procedural (Marcos 7 e 9). Cada campanha gera um WorldDef a partir de uma
 * semente (src/game/worldgen/generateWorld.ts); o que muda durante o jogo (dono dos povoados,
 * prosperidade, guerras) fica no store.
 */

export type Biome = "PLAINS" | "FOREST" | "HILLS" | "MARSH";

export interface RegionDef {
  col: number;
  row: number;
  name: string;
  biome: Biome;
}

export type SettlementKind = "VILLAGE" | "CITY" | "FORT";

/** Mercado de um povoado (preços base, antes da prosperidade). */
export interface MarketDef {
  rationPrice: number;
  ironBuy: number;
  ironSell: number;
}

/** Povoado como foi gerado (o estado vivo é o `Settlement` do store). */
export interface SettlementSeed {
  id: string;
  name: string;
  kind: SettlementKind;
  x: number;
  y: number;
  /** Id da facção dona, ou "FREE" (independente). */
  owner: string;
  population: number;
  garrison: number;
  market: MarketDef;
  description: string;
}

export type Temperament = "BELLIGERENT" | "MERCANTILE" | "PIOUS";

export interface FactionDef {
  id: string;
  name: string;
  ruler: string;
  color: number;
  capitalId: string;
  temperament: Temperament;
}

export type SiteTheme = "GOBLIN_NEST" | "BANDIT_CAMP" | "HAUNTED_RUINS" | "SWAMP_FORD";

/** Local de contrato: terreno próprio (já incluído no terreno do mundo) e grupos inimigos base. */
export interface SiteDef {
  id: string;
  name: string;
  theme: SiteTheme;
  center: Point;
  groups: EnemyGroupDef[];
}

export interface HistoryEntry {
  year: number;
  text: string;
}

/** Acampamento: canto do layout (campLayout.ts) no mundo e pontos úteis. */
export interface CampDef {
  origin: Point;
  center: Point;
  spawn: Point;
  gate: Point;
}

export interface WorldDef {
  seed: number;
  name: string;
  era: string;
  /** Ano atual (a história acontece antes dele). */
  year: number;
  bandName: string;
  regions: RegionDef[];
  terrain: TerrainZone[];
  camp: CampDef;
  settlements: SettlementSeed[];
  factions: FactionDef[];
  sites: SiteDef[];
  lairs: Point[];
  roads: Point[][];
  history: HistoryEntry[];
}

export const SITE_THEME_LABEL: Record<SiteTheme, string> = {
  GOBLIN_NEST: "Ninho goblin",
  BANDIT_CAMP: "Covil de bandidos",
  HAUNTED_RUINS: "Ruínas assombradas",
  SWAMP_FORD: "Vau do pântano",
};

export const SETTLEMENT_KIND_LABEL: Record<SettlementKind, string> = {
  VILLAGE: "Aldeia",
  CITY: "Cidade",
  FORT: "Fortaleza",
};

export function regionAt(world: WorldDef, p: Point): RegionDef {
  const col = Math.max(0, Math.min(WORLD_COLS - 1, Math.floor(p.x / WORLD.REGION_WIDTH)));
  const row = Math.max(0, Math.min(WORLD_ROWS - 1, Math.floor(p.y / WORLD.REGION_HEIGHT)));
  return world.regions[row * WORLD_COLS + col];
}

export function regionName(world: WorldDef, p: Point): string {
  return regionAt(world, p).name;
}

/** Dias de marcha entre dois pontos. */
export function travelDaysBetween(a: Point, b: Point): number {
  return distance(a, b) / WORLD.DAY_DISTANCE;
}

export const clampToWorldBounds = (p: Point, pad = 40): Point => ({
  x: Math.min(WORLD_WIDTH - pad, Math.max(pad, p.x)),
  y: Math.min(WORLD_HEIGHT - pad, Math.max(pad, p.y)),
});

/** Destinos conhecidos da viagem rápida. */
export interface PointOfInterest {
  id: string;
  name: string;
  kind: "CAMP" | "TOWN" | "SITE";
  x: number;
  y: number;
}

export function pointsOfInterest(world: WorldDef, settlements: readonly { id: string; name: string; x: number; y: number }[]): PointOfInterest[] {
  return [
    { id: "CAMP", name: "Acampamento", kind: "CAMP", ...world.camp.gate },
    ...settlements.map((t) => ({ id: t.id, name: t.name, kind: "TOWN" as const, x: t.x, y: t.y + 280 })),
    ...world.sites.map((s) => ({ id: s.id, name: s.name, kind: "SITE" as const, x: s.center.x, y: s.center.y })),
  ];
}

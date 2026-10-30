import type { TerrainZone } from "../world/TerrainMap";
import type { EnemyGroupDef } from "./battleMaps";
import { WORLD, WORLD_HEIGHT, WORLD_WIDTH, type WorldOptions } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Tipos do mundo procedural (Marcos 7, 9 e 11). Cada campanha gera um WorldDef a partir de uma
 * semente e das opções (src/game/worldgen/generateWorld.ts); o que muda durante o jogo (dono
 * dos povoados, prosperidade, guerras, pontes queimadas) fica no store.
 */

export type Biome =
  | "OCEAN"
  | "COAST"
  | "PLAINS"
  | "FOREST"
  | "DEEP_FOREST"
  | "HILLS"
  | "MOUNTAINS"
  | "MARSH"
  | "STEPPE"
  | "DESERT"
  | "TUNDRA";

export const BIOME_LABEL: Record<Biome, string> = {
  OCEAN: "Mar",
  COAST: "Costa",
  PLAINS: "Campos",
  FOREST: "Floresta",
  DEEP_FOREST: "Floresta densa",
  HILLS: "Colinas",
  MOUNTAINS: "Montanhas",
  MARSH: "Pântano",
  STEPPE: "Estepe",
  DESERT: "Deserto",
  TUNDRA: "Tundra",
};

export type RiverKind = "STREAM" | "RIVER" | "GREAT";

export const RIVER_KIND_LABEL: Record<RiverKind, string> = { STREAM: "riacho", RIVER: "rio", GREAT: "rio grande" };

/** Rio: linha da nascente à foz, com a largura em cada ponto. */
export interface RiverDef {
  id: string;
  name: string;
  /** O maior tipo ao longo do curso (decide se tem vaus). */
  kind: RiverKind;
  points: Point[];
  widths: number[];
}

/** Travessia de um rio: ponte (queimável), vau (raso) ou balsa (rios grandes, com cais nas duas margens). */
export interface CrossingDef {
  id: string;
  kind: "BRIDGE" | "FORD" | "FERRY";
  x: number;
  y: number;
  /** Direção do rio no ponto (a travessia é perpendicular a ela). */
  angle: number;
  /** Largura do rio ali. */
  width: number;
  riverId: string;
}

/** Trecho de passo nas montanhas aberto por uma estrada. */
export interface PassDef {
  x: number;
  y: number;
  r: number;
}

/** Relevo, clima, biomas e águas do continente (células de GEO.CELL px). */
export interface GeoDef {
  cell: number;
  cols: number;
  rows: number;
  seaLevel: number;
  mountainLevel: number;
  hillLevel: number;
  detailSeed: number;
  elevation: number[];
  temperature: number[];
  moisture: number[];
  biome: Biome[];
  /** 1 = lago. */
  lake: number[];
  rivers: RiverDef[];
  crossings: CrossingDef[];
  passes: PassDef[];
}

export interface RegionDef {
  col: number;
  row: number;
  name: string;
  biome: Biome;
}

export type SettlementKind = "VILLAGE" | "CITY" | "FORT";

/** Mercado de um povoado (preços base, antes da prosperidade). */
/** Recursos da terra em volta de um povoado (Marco 11, completado no Marco 12). */
export type ResourceId = "GRAIN" | "FISH" | "WOOD" | "STONE" | "IRON" | "SALT" | "FURS" | "HORSES" | "HERBS";

export const RESOURCE_LABEL: Record<ResourceId, string> = {
  GRAIN: "Grão",
  FISH: "Peixe",
  WOOD: "Madeira",
  STONE: "Pedra",
  IRON: "Ferro",
  SALT: "Sal",
  FURS: "Peles",
  HORSES: "Cavalos",
  HERBS: "Ervas",
};

/** Cais das duas margens de uma balsa (perpendicular ao rio). */
export function ferryDocks(c: CrossingDef): [Point, Point] {
  const nx = -Math.sin(c.angle);
  const ny = Math.cos(c.angle);
  const d = c.width / 2 + 70;
  return [
    { x: c.x + nx * d, y: c.y + ny * d },
    { x: c.x - nx * d, y: c.y - ny * d },
  ];
}

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
  /** Id da facção dona, "FREE" (independente) ou "RUINED" (arrasado na história). */
  owner: string;
  /** Na costa: porto (ainda sem uso; navios chegam no Marco 17). */
  port?: boolean;
  /** À beira de um rio. */
  river?: boolean;
  population: number;
  garrison: number;
  market: MarketDef;
  description: string;
  /** O que a terra em volta dá (barateia o mercado local; rende para o dono). */
  resources: ResourceId[];
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
  options: WorldOptions;
  /** Regiões de largura e altura (cada uma de REGION_WIDTH×REGION_HEIGHT). */
  cols: number;
  rows: number;
  geo: GeoDef;
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
  const col = Math.max(0, Math.min(world.cols - 1, Math.floor(p.x / WORLD.REGION_WIDTH)));
  const row = Math.max(0, Math.min(world.rows - 1, Math.floor(p.y / WORLD.REGION_HEIGHT)));
  return world.regions[row * world.cols + col];
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

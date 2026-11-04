import type { BattleResult } from "../../store/useGameStore";
import type { NobleTrait } from "../sim/nobility";
import type { BandKind } from "../sim/realm";
import { BALANCE, DEFAULT_WORLD_OPTIONS, GEO, PROGRESSION, REGION_HEIGHT, REGION_WIDTH, SEASONS, TIME, TROOPS, WAR_AI, type EnemyKind, type Formation, type Season, type TroopType, type WarDifficulty, type Weather } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { seasonDay, seasonOf } from "../../utils/season";
import { createRng, seedFromText, type Rng } from "../worldgen/rng";
import type { TerrainZone } from "../world/TerrainMap";
import { TOWN_SIZE } from "../world/townLayout";
import { campDefAt } from "./campLayout";
import type { Biome, CrossingDef, GeoDef, RegionDef, RiverDef, SettlementSeed, WorldDef } from "./world";
import { newId } from "../../utils/id";

/**
 * Batalhas personalizadas: um cenário diz onde, quando, com quem e contra quem se luta. A batalha
 * usa o mesmo motor da campanha (tropas, moral, ordens e o comando inimigo do Marco 16), num mapa
 * pequeno gerado aqui, com o relógio parado e sem economia.
 */

export type ScenarioMapId = "PLAINS" | "CLEARING" | "HILL" | "FORD" | "BRIDGE" | "MARSH" | "PASS" | "DUNES" | "DECK";
export type ScenarioHour = "DAWN" | "NOON" | "DUSK" | "NIGHT";
export type ScenarioObjective = "ROUT" | "SURVIVE" | "SLAY_CHIEF";
export type EnemyFactionId = "GOBLINS" | "BANDITS" | "KINGDOM" | "UNDEAD" | "ORCS";
export type ForceSide = "FRONT" | "LEFT" | "RIGHT" | "REAR" | "WALLS";
export type ForceStance = "ATTACK" | "HOLD";
export type SiegeRole = "ATTACK" | "DEFEND";
export type SiegeTown = "VILLAGE" | "FORT" | "CITY";

/** Batalha de cerco: um povoado murado no centro do mapa, com um lado de cada parte da muralha. */
export interface ScenarioSiege {
  role: SiegeRole;
  town: SiegeTown;
  /** De quem ataca a muralha, seja o bando ou o inimigo. */
  ladders: number;
  rams: number;
}

export interface ScenarioBattalion {
  id: string;
  troop: TroopType;
  soldiers: number;
  level: number;
  /** Tier de arma e armadura. */
  gear: number;
  formation: Formation;
  lieutenant: boolean;
}

export interface ScenarioArmy {
  battalions: ScenarioBattalion[];
  scouts: number;
  messengers: number;
  wagons: number;
}

/** Uma força inimiga, com o próprio comandante. */
export interface ScenarioForce {
  id: string;
  faction: EnemyFactionId;
  units: Partial<Record<EnemyKind, number>>;
  side: ForceSide;
  stance: ForceStance;
  /** Segundos até entrar em campo (0 = desde o início). */
  delay: number;
  /** 1 a 5: reage devagar e conhece poucos planos, ou grande capitão. */
  competence: number;
  trait: NobleTrait;
  /** Vazio: o chefe recebe um nome sorteado. */
  chief: string;
  /** Mão do comandante no um contra um, de 1 a 5 (Marco 21); sem valor, sai da competência. */
  duel?: number;
}

export interface BattleScenario {
  id: string;
  name: string;
  description: string;
  /** Cenário que vem com o jogo: pode ser copiado, não alterado. */
  builtin?: boolean;
  map: ScenarioMapId;
  hour: ScenarioHour;
  season: Season;
  weather: Weather;
  objective: ScenarioObjective;
  surviveMinutes: number;
  /** Distância entre os exércitos no início (px). */
  distance: number;
  /** Névoa de guerra: sem ela, todo o campo fica à vista. */
  fog: boolean;
  /** Todo o exército ouve as ordens na hora; sem isso, valem voz, trombeta e mensageiros. */
  directOrders: boolean;
  difficulty: WarDifficulty;
  army: ScenarioArmy;
  forces: ScenarioForce[];
  siege: ScenarioSiege | null;
  /** Abordagem em alto-mar (Marco 17): quem luta é o exército de verdade, e quem morre não volta. */
  boarding?: boolean;
}

export interface ScenarioBattalionResult {
  id: string;
  name: string;
  troop: TroopType;
  start: number;
  alive: number;
  kills: number;
}

export interface ScenarioResult {
  outcome: Extract<BattleResult, "VICTORY" | "DEFEAT">;
  reason: string;
  seconds: number;
  enemyTotal: number;
  enemyKilled: number;
  enemyFled: number;
  battalions: ScenarioBattalionResult[];
  commanderHp: number;
  commanderMaxHp: number;
  /** Oficiais inimigos que caíram. */
  officers: string[];
  /** Flechas que caíram sobre os nossos. */
  friendlyFire: number;
}

/** O que a barra da batalha mostra enquanto ela dura. */
export interface ScenarioHud {
  seconds: number;
  enemies: number;
  enemyTotal: number;
  /** Reforços inimigos que ainda vão chegar (o jogador não sabe quando). */
  waiting: boolean;
  siege?: ScenarioSiegeHud;
}

/** Como estão os muros, para a barra da batalha. */
export interface ScenarioSiegeHud {
  gatesUp: number;
  gates: number;
  /** Vida do portão mais batido (0 a 1). */
  weakest: number;
  ladders: number;
  /** Alguma tropa está ao pé da muralha (dá para erguer a escada). */
  atWall: boolean;
  /** Já há um aríete em campo. */
  ramOut: boolean;
}

export const SCENARIO_LIMITS = {
  BATTALIONS: 8,
  SOLDIERS: [2, 16] as const,
  SCOUTS: 3,
  MESSENGERS: 4,
  WAGONS: 4,
  FORCES: 4,
  /** Por tipo de inimigo. */
  UNITS: 120,
  /** Acima disso o combate fica pesado (o Marco 16 mediu até 300 em campo). */
  SAFE_TOTAL: 300,
  DELAY: 600,
  SURVIVE: [1, 20] as const,
  DISTANCE: [900, 2400] as const,
  LADDERS: 6,
  RAMS: 2,
};

export const SCENARIO_MAPS: Record<ScenarioMapId, { label: string; description: string; biome: Biome }> = {
  PLAINS: { label: "Campo aberto", description: "Terreno limpo: vence quem manobra melhor.", biome: "PLAINS" },
  CLEARING: { label: "Clareira na mata", description: "Mata fechada nos dois lados, boa para emboscadas.", biome: "FOREST" },
  HILL: { label: "Colina central", description: "Quem toma o alto enxerga e atira de cima.", biome: "HILLS" },
  FORD: { label: "Vau do rio", description: "Um rio entre os exércitos, com dois vaus.", biome: "PLAINS" },
  BRIDGE: { label: "Ponte estreita", description: "Uma ponte no centro e um vau distante.", biome: "PLAINS" },
  MARSH: { label: "Pântano", description: "Lama e charco cortam o passo da cavalaria.", biome: "MARSH" },
  PASS: { label: "Desfiladeiro", description: "Corredor entre montanhas, sem flancos.", biome: "HILLS" },
  DUNES: { label: "Dunas", description: "Deserto aberto, com dunas para se esconder.", biome: "DESERT" },
  DECK: { label: "Convés", description: "Dois navios amarrados por pranchas.", biome: "PLAINS" },
};

/** Abordagem: nosso navio a oeste, o deles a leste, e as pranchas no eixo das rotas (células de 80 px). */
export const DECK = {
  OURS: { x: 3400, y: 3300, w: 1100, h: 660 },
  THEIRS: { x: 5100, y: 3300, w: 1100, h: 660 },
  PLANKS: [3400, 3640, 3880],
  PLANK_WIDTH: 96,
  RAIL: 20,
};

export const SCENARIO_HOURS: Record<ScenarioHour, { label: string; hour: number }> = {
  DAWN: { label: "Aurora", hour: (TIME.DAWN[0] + TIME.DAWN[1]) / 2 },
  NOON: { label: "Meio-dia", hour: 12 },
  DUSK: { label: "Crepúsculo", hour: (TIME.DUSK[0] + TIME.DUSK[1]) / 2 },
  NIGHT: { label: "Noite", hour: 23 },
};

export const SCENARIO_OBJECTIVES: Record<ScenarioObjective, { label: string; description: string }> = {
  ROUT: { label: "Expulsar o inimigo", description: "Vença quando todos caírem, fugirem ou deixarem o campo." },
  SURVIVE: { label: "Resistir", description: "Mantenha o Comandante vivo até o tempo acabar." },
  SLAY_CHIEF: { label: "Matar o chefe", description: "Vença ao derrubar quem comanda a primeira força." },
};

export const FORCE_SIDES: Record<ForceSide, string> = { FRONT: "À frente", LEFT: "Flanco esquerdo", RIGHT: "Flanco direito", REAR: "Pela retaguarda", WALLS: "Atrás dos muros" };
export const FORCE_STANCES: Record<ForceStance, string> = { ATTACK: "Vem atacar", HOLD: "Espera em posição" };

export const ENEMY_FACTIONS: Record<EnemyFactionId, { label: string; band: BandKind; units: readonly EnemyKind[]; name: string }> = {
  GOBLINS: { label: "Goblins", band: "GOBLIN", units: ["GOBLIN", "GOBLIN_ARCHER", "GOBLIN_SPEAR", "WOLF_RIDER"], name: "Bando goblin" },
  BANDITS: { label: "Salteadores", band: "GOBLIN", units: ["BANDIT", "BANDIT_ARCHER", "BANDIT_JAVELIN", "BANDIT_RIDER"], name: "Salteadores" },
  KINGDOM: { label: "Exército de um reino", band: "FACTION", units: ["SOLDIER", "PIKEMAN", "MAN_AT_ARMS", "LONGBOW", "CROSSBOW", "LANCER", "KNIGHT", "OUTRIDER"], name: "Exército" },
  UNDEAD: { label: "Mortos-vivos", band: "HORDE", units: ["SKELETON", "SKELETON_ARCHER", "BONE_GUARD"], name: "Horda dos mortos" },
  ORCS: { label: "Orcs", band: "HORDE", units: ["ORC", "ORC_BRUTE", "GOBLIN_ARCHER", "WOLF_RIDER"], name: "Horda orc" },
};

export const SIEGE_ROLES: Record<SiegeRole, { label: string; description: string }> = {
  ATTACK: { label: "Você ataca os muros", description: "Leve uma tropa ao pé da muralha para erguer a escada, ou mande o aríete ao portão. Quem chega de fora vem socorrer os cercados." },
  DEFEND: { label: "Você defende os muros", description: "Quem atira fica em cima da muralha, sem gastar munição. As forças inimigas vêm de fora, com as escadas e os aríetes abaixo." },
};

export const SIEGE_TOWNS: Record<SiegeTown, { label: string; name: string; description: string }> = {
  VILLAGE: { label: "Aldeia com paliçada", name: "a aldeia", description: "Dois portões e muro de madeira, que cede rápido." },
  FORT: { label: "Forte de pedra", name: "o forte", description: "Dois portões e muralha grossa." },
  CITY: { label: "Cidade murada", name: "a cidade", description: "Quatro portões e muralha longa: é difícil guardá-la inteira." },
};

/** Mapas sem rio nem montanha no meio: a fortaleza cabe neles. */
export const SIEGE_MAPS: readonly ScenarioMapId[] = ["PLAINS", "CLEARING", "HILL", "MARSH", "DUNES"];

export const SCENARIO_TOWN = "scenario-town";

export const FORCE_TRAITS: readonly NobleTrait[] = ["BRAVE", "CUNNING", "COWARD", "CRUEL", "AMBITIOUS", "HONORABLE", "GREEDY", "PIOUS"];

export const SCENARIO_COLS = 2;
export const SCENARIO_ROWS = 2;
export const SCENARIO_WIDTH = SCENARIO_COLS * REGION_WIDTH;
export const SCENARIO_HEIGHT = SCENARIO_ROWS * REGION_HEIGHT;
const CENTER: Point = { x: SCENARIO_WIDTH / 2, y: SCENARIO_HEIGHT / 2 };

/** Folga entre a muralha e quem começa do lado de fora dela. */
const WALL_MARGIN = 300;

/** Onde o bando começa: a oeste do centro, de frente para o leste (ou dentro dos muros, se defende). */
export function armyStart(s: Pick<BattleScenario, "distance" | "siege"> & { map?: ScenarioMapId }): Point {
  if (s.map === "DECK") return { x: DECK.OURS.x + 260, y: DECK.OURS.y + DECK.OURS.h / 2 };
  if (s.siege?.role === "DEFEND") return { ...CENTER };
  const wall = s.siege ? TOWN_SIZE[s.siege.town].w / 2 + WALL_MARGIN : 0;
  return { x: CENTER.x - wall - s.distance / 2, y: CENTER.y };
}

/** Onde uma força começa; quem chega depois vem de mais longe, fora de vista. */
export function forceStart(s: Pick<BattleScenario, "distance" | "forces" | "siege"> & { map?: ScenarioMapId }, force: ScenarioForce): Point {
  if (s.map === "DECK") return { x: DECK.THEIRS.x + DECK.THEIRS.w / 2, y: DECK.THEIRS.y + DECK.THEIRS.h / 2 };
  if (force.side === "WALLS") return { ...CENTER };
  const peers = s.forces.filter((f) => f.side === force.side);
  const lateral = (peers.indexOf(force) - (peers.length - 1) / 2) * 420;
  const far = force.delay > 0 ? 1100 : 0;
  const town = s.siege ? TOWN_SIZE[s.siege.town] : null;
  const front = town ? town.w / 2 + WALL_MARGIN : 0;
  const wide = town ? town.h / 2 + WALL_MARGIN + s.distance / 2 : Math.max(s.distance, 1300);
  const inMap = (p: Point): Point => ({ x: Math.max(300, Math.min(SCENARIO_WIDTH - 300, p.x)), y: Math.max(300, Math.min(SCENARIO_HEIGHT - 300, p.y)) });
  switch (force.side) {
    case "FRONT":
      return inMap({ x: CENTER.x + front + s.distance / 2 + far, y: CENTER.y + lateral });
    case "LEFT":
      return inMap({ x: CENTER.x - 200 + lateral, y: CENTER.y - wide - far });
    case "RIGHT":
      return inMap({ x: CENTER.x - 200 + lateral, y: CENTER.y + wide + far });
    case "REAR":
      return inMap({ x: (s.siege?.role === "DEFEND" ? CENTER.x - front - s.distance / 2 : armyStart(s).x - s.distance) - far, y: CENTER.y + lateral });
  }
}

/** O que uma força faz de verdade: num cerco, quem está dentro espera e quem assalta vem. */
export function forceStance(s: Pick<BattleScenario, "siege">, force: ScenarioForce): ForceStance {
  if (force.side === "WALLS") return "HOLD";
  return s.siege?.role === "DEFEND" ? "ATTACK" : force.stance;
}

/** Primeiro dia da campanha naquela estação (a cheia da primavera fica de fora: os vaus têm de existir). */
export function scenarioDay(season: Season): number {
  for (let d = 1; d < SEASONS.DAYS * 5; d++) if (seasonOf(d) === season && seasonDay(d) > SEASONS.FLOOD_DAYS) return d;
  return 1;
}

export function scenarioProgress(hour: ScenarioHour): number {
  return ((SCENARIO_HOURS[hour].hour - TIME.DAY_START_HOUR + 24) % 24) / 24;
}

/** Quantos inimigos o cenário põe em campo. */
export function forceSize(force: ScenarioForce): number {
  return Object.values(force.units).reduce((n, c) => n + (c ?? 0), 0);
}

export function scenarioEnemyTotal(s: BattleScenario): number {
  return s.forces.reduce((n, f) => n + forceSize(f), 0);
}

export function scenarioArmyTotal(s: BattleScenario): number {
  return s.army.battalions.reduce((n, b) => n + b.soldiers, 0);
}

/** O que impede a batalha de começar (null = pode começar). */
export function scenarioProblem(s: BattleScenario): string | null {
  if (s.army.battalions.length === 0) return "Monte pelo menos um batalhão.";
  if (s.forces.length === 0 || scenarioEnemyTotal(s) === 0) return "Coloque pelo menos um inimigo em campo.";
  if (s.objective === "SLAY_CHIEF" && forceSize(s.forces[0]) === 0) return "A primeira força precisa de soldados para ter um chefe.";
  if (s.siege) {
    if (!SIEGE_MAPS.includes(s.map)) return "A fortaleza não cabe neste mapa: escolha um sem rio nem desfiladeiro.";
    if (s.siege.role === "ATTACK") {
      if (s.siege.ladders + s.siege.rams === 0) return "Sem escadas nem aríete, o exército não tem como entrar.";
      if (!s.forces.some((f) => f.side === "WALLS" && forceSize(f) > 0)) return "Coloque uma força atrás dos muros.";
    } else if (s.forces.some((f) => f.side === "WALLS")) {
      return "Quem defende os muros é você: as forças inimigas vêm de fora.";
    }
  }
  return null;
}

/** Liga, muda ou desliga o cerco, deixando o mapa e as forças de acordo com ele. */
export function withSiege(s: BattleScenario, siege: ScenarioSiege | null): BattleScenario {
  const map = siege && !SIEGE_MAPS.includes(s.map) ? "PLAINS" : s.map;
  if (siege?.role === "ATTACK") {
    const forces = s.forces.some((f) => f.side === "WALLS") ? s.forces : s.forces.map((f, i): ScenarioForce => (i === 0 ? { ...f, side: "WALLS" } : f));
    return { ...s, siege, map, forces };
  }
  return { ...s, siege, map, forces: s.forces.map((f): ScenarioForce => (f.side === "WALLS" ? { ...f, side: "FRONT" } : f)) };
}

// --- Mapa ---

const zone = (type: TerrainZone["type"], x: number, y: number, rx: number, ry: number): TerrainZone => ({ type, x, y, rx, ry });

function scatter(rng: Rng, list: TerrainZone[], type: TerrainZone["type"], count: number, area: { x: number; y: number; w: number; h: number }, r: [number, number]): void {
  for (let i = 0; i < count; i++) {
    const rx = rng.range(r[0], r[1]);
    list.push(zone(type, area.x + rng.next() * area.w, area.y + rng.next() * area.h, rx, rx * rng.range(0.6, 1)));
  }
}

function zonesOf(map: ScenarioMapId, rng: Rng): TerrainZone[] {
  const { x: cx, y: cy } = CENTER;
  const z: TerrainZone[] = [];
  const edge = { x: 300, y: 300, w: SCENARIO_WIDTH - 600, h: SCENARIO_HEIGHT - 600 };
  switch (map) {
    case "DECK":
      break;
    case "PLAINS":
      z.push(zone("HILL", cx - 300, cy - 1500, 520, 300), zone("FOREST", cx + 500, cy + 1600, 640, 320));
      scatter(rng, z, "FOREST", 6, { ...edge, h: 1700 }, [260, 520]);
      scatter(rng, z, "FOREST", 6, { ...edge, y: cy + 1900, h: 1400 }, [260, 520]);
      break;
    case "CLEARING":
      for (const side of [-1, 1]) {
        for (let x = 300; x < SCENARIO_WIDTH; x += 620) z.push(zone("FOREST", x + rng.range(-120, 120), cy + side * rng.range(960, 1120), rng.range(460, 640), rng.range(420, 560)));
        scatter(rng, z, "FOREST", 10, { ...edge, y: side < 0 ? 200 : cy + 1400, h: 1900 }, [420, 720]);
      }
      z.push(zone("FOREST", cx, cy - 520, 300, 190), zone("FOREST", cx + 260, cy + 560, 280, 180));
      break;
    case "HILL":
      z.push(zone("HILL", cx, cy, 820, 620), zone("HILL", cx - 1900, cy + 1300, 520, 340), zone("HILL", cx + 1900, cy - 1300, 520, 340));
      scatter(rng, z, "FOREST", 8, { ...edge, h: 1500 }, [260, 480]);
      scatter(rng, z, "FOREST", 8, { ...edge, y: cy + 2000, h: 1300 }, [260, 480]);
      break;
    case "FORD":
    case "BRIDGE":
      for (let y = 300; y < SCENARIO_HEIGHT; y += 900) z.push(zone("MUD", cx + rng.range(-40, 40), y, 300, 340));
      scatter(rng, z, "FOREST", 10, { ...edge, x: 300, w: cx - 900 }, [240, 460]);
      scatter(rng, z, "FOREST", 10, { ...edge, x: cx + 600, w: cx - 900 }, [240, 460]);
      // A vegetação não fecha a passagem de frente para a travessia
      return z.filter((a) => a.type === "MUD" || Math.abs(a.y - cy) > 700);
    case "MARSH":
      scatter(rng, z, "MUD", 26, edge, [340, 640]);
      scatter(rng, z, "SWAMP", 22, edge, [280, 560]);
      z.push(zone("HILL", cx, cy - 300, 260, 180));
      break;
    case "PASS":
      scatter(rng, z, "HILL", 6, { x: 300, y: cy - 900, w: SCENARIO_WIDTH - 600, h: 1800 }, [180, 320]);
      break;
    case "DUNES":
      scatter(rng, z, "HILL", 30, edge, [240, 520]);
      break;
  }
  return z;
}

/** Rio norte-sul pelo centro do mapa. */
function riverOf(rng: Rng, width: number): RiverDef {
  const points: Point[] = [];
  for (let y = -300; y <= SCENARIO_HEIGHT + 300; y += 500) points.push({ x: CENTER.x + rng.range(-70, 70), y });
  return { id: "R0", name: "Rio da Batalha", kind: width > GEO.RIVER_WIDTH.RIVER ? "GREAT" : "RIVER", points, widths: points.map(() => width) };
}

function riverX(river: RiverDef, y: number): number {
  const i = Math.max(1, Math.min(river.points.length - 1, Math.ceil((y + 300) / 500)));
  const a = river.points[i - 1];
  const b = river.points[i];
  return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
}

function crossingOf(id: string, kind: CrossingDef["kind"], river: RiverDef, y: number, width: number): CrossingDef {
  return { id, kind, x: riverX(river, y), y, angle: Math.PI / 2, width, riverId: river.id };
}

/** Relevo plano com montanhas só no desfiladeiro (mais fechado no meio). */
function geoOfMap(s: BattleScenario, rng: Rng): GeoDef {
  const cell = GEO.CELL;
  const cols = Math.ceil(SCENARIO_WIDTH / cell);
  const rows = Math.ceil(SCENARIO_HEIGHT / cell);
  const biome = SCENARIO_MAPS[s.map].biome;
  const elevation: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      const half = 780 + (Math.abs(x - CENTER.x) / CENTER.x) * 900;
      elevation.push(s.map === "PASS" && Math.abs(y - CENTER.y) > half ? 0.95 : 0.45);
    }
  }
  const rivers: RiverDef[] = [];
  const crossings: CrossingDef[] = [];
  if (s.map === "FORD") {
    const river = riverOf(rng, GEO.RIVER_WIDTH.RIVER);
    rivers.push(river);
    crossings.push(crossingOf("X0", "FORD", river, CENTER.y - 620, river.widths[0]), crossingOf("X1", "FORD", river, CENTER.y + 620, river.widths[0]));
  } else if (s.map === "BRIDGE") {
    const river = riverOf(rng, GEO.RIVER_WIDTH.RIVER + 30);
    rivers.push(river);
    crossings.push(crossingOf("X0", "BRIDGE", river, CENTER.y, river.widths[0]), crossingOf("X1", "FORD", river, CENTER.y + 2500, river.widths[0]));
  }
  const n = cols * rows;
  return {
    cell,
    cols,
    rows,
    seaLevel: 0.1,
    mountainLevel: 0.8,
    hillLevel: 0.65,
    detailSeed: rng.int(1, 1_000_000),
    elevation,
    // No inverno neva, mas os rios não congelam: os vaus e a ponte continuam valendo
    temperature: new Array<number>(n).fill(s.season === "WINTER" ? SEASONS.SNOW_BELOW - 0.03 : 0.62),
    moisture: new Array<number>(n).fill(0.5),
    biome: new Array<Biome>(n).fill(biome),
    lake: new Array<number>(n).fill(0),
    rivers,
    crossings,
    passes: [],
  };
}

/** O povoado do cerco, no centro do mapa e sem guarnição própria: quem luta são as forças do cenário. */
function siegeTown(siege: ScenarioSiege): SettlementSeed {
  return {
    id: SCENARIO_TOWN,
    name: SIEGE_TOWNS[siege.town].name,
    kind: siege.town,
    x: CENTER.x,
    y: CENTER.y,
    owner: siege.role === "DEFEND" ? "PLAYER" : "FREE",
    population: 300,
    garrison: 0,
    market: { rationPrice: 1, ironBuy: 1, ironSell: 1 },
    description: "",
    resources: [],
  };
}

/** Mata, morro e lama ficam fora dos muros e de quem marcha em volta deles. */
function clearOfWalls(zones: TerrainZone[], siege: ScenarioSiege): TerrainZone[] {
  const town = TOWN_SIZE[siege.town];
  return zones.filter((z) => Math.abs(z.x - CENTER.x) > town.w / 2 + z.rx + WALL_MARGIN || Math.abs(z.y - CENTER.y) > town.h / 2 + z.ry + WALL_MARGIN);
}

/** Mundo só com o campo de batalha: sem reinos nem acampamento montado (povoado, só o do cerco). */
export function buildScenarioWorld(s: BattleScenario): WorldDef {
  const seed = seedFromText(`${s.map}|${s.season}`) || 1;
  const rng = createRng(seed);
  const geo = geoOfMap(s, rng);
  const biome = SCENARIO_MAPS[s.map].biome;
  const regions: RegionDef[] = [];
  for (let row = 0; row < SCENARIO_ROWS; row++) for (let col = 0; col < SCENARIO_COLS; col++) regions.push({ col, row, name: s.name, biome });
  return {
    seed,
    options: DEFAULT_WORLD_OPTIONS,
    cols: SCENARIO_COLS,
    rows: SCENARIO_ROWS,
    geo,
    name: s.name,
    era: "Era das Batalhas",
    year: 1,
    bandName: "Companhia do Comandante",
    regions,
    terrain: s.siege ? clearOfWalls(zonesOf(s.map, rng), s.siege) : zonesOf(s.map, rng),
    camp: campDefAt({ x: 700, y: SCENARIO_HEIGHT - 700 }),
    settlements: s.siege ? [siegeTown(s.siege)] : [],
    factions: [],
    sites: [],
    lairs: [],
    roads: [],
    history: [],
  };
}

// --- Cenários novos e prontos ---

export function newBattalionSpec(troop: TroopType, level = 1, gear = 0, lieutenant = false, soldiers = BALANCE.BATTALION_SIZE): ScenarioBattalion {
  return { id: newId(), troop, soldiers, level, gear, formation: TROOPS[troop].formations[0], lieutenant };
}

export function newForce(faction: EnemyFactionId = "GOBLINS"): ScenarioForce {
  const [first, second] = ENEMY_FACTIONS[faction].units;
  return { id: newId(), faction, units: { [first]: 18, ...(second ? { [second]: 6 } : {}) }, side: "FRONT", stance: "ATTACK", delay: 0, competence: 3, trait: "BRAVE", chief: "" };
}

export function blankScenario(): BattleScenario {
  return {
    id: newId(),
    name: "Novo cenário",
    description: "",
    map: "PLAINS",
    hour: "NOON",
    season: "SUMMER",
    weather: "CLEAR",
    objective: "ROUT",
    surviveMinutes: 5,
    distance: 1500,
    fog: true,
    directOrders: true,
    difficulty: "VETERAN",
    army: { battalions: [newBattalionSpec("INFANTRY", 1, 0, true), newBattalionSpec("ARCHERS")], scouts: 1, messengers: 1, wagons: 0 },
    forces: [newForce()],
    siege: null,
  };
}

export function newSiege(role: SiegeRole = "ATTACK"): ScenarioSiege {
  return { role, town: "FORT", ladders: 3, rams: 1 };
}

/** Os piratas: uma batalha sem o menu de cenários, com o exército que estiver a bordo. */
export function boardingScenario(units: ScenarioForce["units"], difficulty: WarDifficulty): BattleScenario {
  return {
    ...blankScenario(),
    id: "boarding",
    name: "Abordagem",
    description: "Ganchos no costado! Atravessem as pranchas ou segurem o convés.",
    map: "DECK",
    fog: false,
    difficulty,
    boarding: true,
    forces: [{ ...newForce("BANDITS"), units, stance: "ATTACK", competence: 3, trait: "CRUEL", chief: "Capitão Sem-Porto" }],
  };
}

const B = newBattalionSpec;

function force(faction: EnemyFactionId, units: ScenarioForce["units"], extra: Partial<ScenarioForce> = {}): ScenarioForce {
  return { ...newForce(faction), units, ...extra };
}

type Preset = Pick<BattleScenario, "name" | "description" | "map" | "army" | "forces"> & Partial<BattleScenario>;

function preset(id: string, p: Preset): BattleScenario {
  return { ...blankScenario(), ...p, id: `preset-${id}`, builtin: true };
}

/** Cenários que vêm com o jogo. */
export const PRESET_SCENARIOS: readonly BattleScenario[] = [
  preset("primeiro-sangue", {
    name: "Primeiro Sangue",
    description: "Goblins saqueiam o campo. Um bom começo para aprender formações e ordens.",
    map: "PLAINS",
    army: { battalions: [B("INFANTRY"), B("INFANTRY"), B("ARCHERS")], scouts: 1, messengers: 1, wagons: 0 },
    forces: [force("GOBLINS", { GOBLIN: 16, GOBLIN_ARCHER: 5 }, { competence: 1, trait: "BRAVE" })],
  }),
  preset("olhos-na-mata", {
    name: "Olhos na Mata",
    description: "Salteadores conhecem cada trilha desta mata. Mande os batedores na frente.",
    map: "CLEARING",
    hour: "DUSK",
    season: "AUTUMN",
    weather: "FOG",
    army: { battalions: [B("INFANTRY", 2, 1, true), B("INFANTRY", 2), B("ARCHERS", 2)], scouts: 2, messengers: 1, wagons: 2 },
    forces: [force("BANDITS", { BANDIT: 18, BANDIT_ARCHER: 8, BANDIT_JAVELIN: 6, BANDIT_RIDER: 4 }, { competence: 4, trait: "CUNNING", stance: "HOLD" })],
  }),
  preset("colina-do-rei", {
    name: "A Colina do Rei",
    description: "Um lorde tomou o alto com besteiros e cavalaria. Tire-o de lá.",
    map: "HILL",
    distance: 1800,
    army: { battalions: [B("HEAVY", 3, 1, true), B("INFANTRY", 3, 1), B("SPEARMEN", 3, 1), B("ARCHERS", 3, 1), B("CROSSBOW", 3, 1), B("KNIGHTS", 3, 1, true)], scouts: 1, messengers: 2, wagons: 0 },
    forces: [force("KINGDOM", { SOLDIER: 22, PIKEMAN: 10, MAN_AT_ARMS: 6, CROSSBOW: 8, LONGBOW: 6, LANCER: 6, OUTRIDER: 2 }, { competence: 4, trait: "HONORABLE", stance: "HOLD" })],
  }),
  preset("vau-de-sangue", {
    name: "O Vau de Sangue",
    description: "A horda orc quer atravessar sob a chuva. Segure as margens: os arcos alcançam menos.",
    map: "FORD",
    season: "SPRING",
    weather: "RAIN",
    army: { battalions: [B("INFANTRY", 3, 2, true), B("SPEARMEN", 3, 2), B("HEAVY", 3, 1), B("ARCHERS", 3, 1)], scouts: 1, messengers: 2, wagons: 0 },
    forces: [force("ORCS", { ORC: 14, ORC_BRUTE: 3, GOBLIN_ARCHER: 8, WOLF_RIDER: 5 }, { competence: 3, trait: "CRUEL" })],
  }),
  preset("ponte-dos-mortos", {
    name: "A Ponte dos Mortos",
    description: "Eles não param. Segure a ponte até o amanhecer: novas levas vêm da escuridão.",
    map: "BRIDGE",
    hour: "NIGHT",
    objective: "SURVIVE",
    surviveMinutes: 6,
    army: { battalions: [B("INFANTRY", 4, 2, true), B("INFANTRY", 4, 2), B("ARCHERS", 4, 2), B("ARCHERS", 4, 2)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [
      force("UNDEAD", { SKELETON: 26, SKELETON_ARCHER: 4 }, { competence: 3, trait: "CRUEL" }),
      force("UNDEAD", { SKELETON: 24, BONE_GUARD: 6, SKELETON_ARCHER: 6 }, { competence: 3, trait: "CRUEL", delay: 120 }),
      force("UNDEAD", { SKELETON: 30, BONE_GUARD: 10, SKELETON_ARCHER: 8 }, { competence: 4, trait: "BRAVE", delay: 240 }),
    ],
  }),
  preset("garganta", {
    name: "A Garganta",
    description: "Poucos contra muitos num corredor de pedra. Sem flancos, ninguém cerca ninguém.",
    map: "PASS",
    objective: "SURVIVE",
    surviveMinutes: 5,
    season: "WINTER",
    weather: "SNOW",
    army: { battalions: [B("HEAVY", 5, 3, true), B("SPEARMEN", 5, 3, true), B("CROSSBOW", 5, 3)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [
      force("KINGDOM", { SOLDIER: 34, MAN_AT_ARMS: 6, CROSSBOW: 16, OUTRIDER: 2 }, { competence: 4, trait: "AMBITIOUS" }),
      force("KINGDOM", { SOLDIER: 24, LANCER: 8, KNIGHT: 4, PIKEMAN: 4 }, { competence: 3, trait: "BRAVE", delay: 150 }),
    ],
  }),
  preset("cabeca-da-serpente", {
    name: "A Cabeça da Serpente",
    description: "Mate o chefe orc e a horda se desfaz. A lama vai segurar os cavalos.",
    map: "MARSH",
    objective: "SLAY_CHIEF",
    hour: "DAWN",
    army: { battalions: [B("KNIGHTS", 4, 2, true), B("INFANTRY", 4, 2), B("JAVELINS", 4, 2)], scouts: 2, messengers: 1, wagons: 0 },
    forces: [force("ORCS", { ORC: 20, ORC_BRUTE: 4, GOBLIN_ARCHER: 8 }, { competence: 3, trait: "AMBITIOUS", chief: "Gor Ossos-Partidos" })],
  }),
  preset("areias-traicoeiras", {
    name: "Areias Traiçoeiras",
    description: "A caravana parou nas dunas. Eles vêm pela frente, e a verdadeira força vem por trás.",
    map: "DUNES",
    army: { battalions: [B("INFANTRY", 3, 1, true), B("ARCHERS", 3, 1), B("CAVALRY", 3, 1)], scouts: 2, messengers: 1, wagons: 3 },
    forces: [
      force("BANDITS", { BANDIT: 14, BANDIT_ARCHER: 6, BANDIT_JAVELIN: 4 }, { competence: 3, trait: "GREEDY" }),
      force("GOBLINS", { GOBLIN: 10, GOBLIN_SPEAR: 4, WOLF_RIDER: 8 }, { competence: 4, trait: "CUNNING", side: "REAR", delay: 45 }),
    ],
  }),
  preset("martelo-e-bigorna", {
    name: "Martelo e Bigorna",
    description: "Prenda a linha deles com as lanças e entre pelo lado com a cavalaria. A investida em ciclo (N) faz o resto.",
    map: "PLAINS",
    army: { battalions: [B("SPEARMEN", 3, 1, true), B("SPEARMEN", 3, 1), B("CAVALRY", 3, 1), B("CAVALRY", 3, 1)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [force("KINGDOM", { SOLDIER: 26, LONGBOW: 8, OUTRIDER: 2 }, { competence: 3, trait: "BRAVE" })],
  }),
  preset("chuva-de-flechas", {
    name: "Chuva de Flechas",
    description: "Duelo de arqueiros num campo aberto. Abra a formação, e cuidado para onde as suas flechas caem quando as linhas se encontrarem.",
    map: "HILL",
    season: "AUTUMN",
    army: { battalions: [B("ARCHERS", 3, 1), B("ARCHERS", 3, 1), B("CROSSBOW", 3, 1), B("INFANTRY", 3, 1, true)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [force("KINGDOM", { SOLDIER: 12, LONGBOW: 18, CROSSBOW: 6 }, { competence: 3, trait: "CUNNING" })],
  }),
  preset("muralha-de-lancas", {
    name: "Muralha de Lanças",
    description: "Cavaleiros do reino vêm a galope. Firme as lanças de frente para eles, e deixe que se quebrem.",
    map: "PLAINS",
    hour: "DAWN",
    army: { battalions: [B("SPEARMEN", 3, 2, true), B("SPEARMEN", 3, 2), B("SPEARMEN", 3, 1), B("ARCHERS", 3, 1)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [force("KINGDOM", { KNIGHT: 8, LANCER: 12, MAN_AT_ARMS: 6, SOLDIER: 8 }, { competence: 3, trait: "BRAVE" })],
  }),
  preset("palicada", {
    name: "A Paliçada",
    description: "Salteadores se entrincheiraram numa aldeia. Madeira cede rápido: escolha por onde entrar.",
    map: "CLEARING",
    siege: { role: "ATTACK", town: "VILLAGE", ladders: 3, rams: 1 },
    army: { battalions: [B("INFANTRY", 3, 1, true), B("INFANTRY", 3, 1), B("ARCHERS", 3)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [force("BANDITS", { BANDIT: 16, BANDIT_ARCHER: 6, BANDIT_JAVELIN: 4 }, { competence: 3, trait: "CRUEL", side: "WALLS" })],
  }),
  preset("forte-da-fronteira", {
    name: "O Forte da Fronteira",
    description: "Tome o forte antes que o socorro chegue, ou lute com a muralha de um lado e um exército do outro.",
    map: "PLAINS",
    distance: 1500,
    siege: { role: "ATTACK", town: "FORT", ladders: 4, rams: 1 },
    army: { battalions: [B("HEAVY", 3, 1, true), B("INFANTRY", 3, 1), B("SPEARMEN", 3, 1), B("ARCHERS", 3, 1), B("CROSSBOW", 3, 1), B("CAVALRY", 3, 1)], scouts: 1, messengers: 2, wagons: 0 },
    forces: [
      force("KINGDOM", { SOLDIER: 10, PIKEMAN: 4, CROSSBOW: 6, LONGBOW: 4 }, { competence: 3, trait: "HONORABLE", side: "WALLS" }),
      force("KINGDOM", { SOLDIER: 8, LANCER: 6, OUTRIDER: 2 }, { competence: 3, trait: "BRAVE", side: "REAR", delay: 300 }),
    ],
  }),
  preset("ultimo-portao", {
    name: "O Último Portão",
    description: "A horda vem com escadas e aríete. Ponha os arcos nos muros e guarde a infantaria para onde eles entrarem.",
    map: "DUNES",
    hour: "DUSK",
    siege: { role: "DEFEND", town: "FORT", ladders: 3, rams: 1 },
    army: { battalions: [B("INFANTRY", 3, 2, true), B("SPEARMEN", 3, 2), B("ARCHERS", 3, 2), B("ARCHERS", 3, 2), B("CROSSBOW", 3, 1)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [
      force("ORCS", { ORC: 12, ORC_BRUTE: 2, GOBLIN_ARCHER: 8 }, { competence: 3, trait: "CRUEL" }),
      force("ORCS", { ORC: 8, WOLF_RIDER: 4, GOBLIN_ARCHER: 6 }, { competence: 3, trait: "BRAVE", side: "LEFT", delay: 120 }),
    ],
  }),
];

// --- Cenários do jogador e recordes ---

const STORAGE_KEY = "ascensao-mercenaria.cenarios";
const RECORDS_KEY = "ascensao-mercenaria.cenarios.recordes";

export interface ScenarioRecord {
  plays: number;
  wins: number;
  /** Vitória mais rápida (segundos). */
  best: number | null;
}

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const oneOf = <T extends string>(v: unknown, list: Record<T, unknown> | readonly T[], fallback: T): T => {
  const keys = (Array.isArray(list) ? list : Object.keys(list)) as readonly string[];
  return typeof v === "string" && keys.includes(v) ? (v as T) : fallback;
};

function cleanBattalion(raw: Partial<ScenarioBattalion>): ScenarioBattalion {
  const troop = oneOf<TroopType>(raw.troop, TROOPS, "INFANTRY");
  const [min, max] = SCENARIO_LIMITS.SOLDIERS;
  return {
    id: typeof raw.id === "string" ? raw.id : newId(),
    troop,
    soldiers: clamp(raw.soldiers, min, max, BALANCE.BATTALION_SIZE),
    level: clamp(raw.level, 1, PROGRESSION.MAX_LEVEL, 1),
    gear: clamp(raw.gear, 0, PROGRESSION.MAX_EQUIPMENT_TIER, 0),
    formation: oneOf<Formation>(raw.formation, TROOPS[troop].formations, TROOPS[troop].formations[0]),
    lieutenant: !!raw.lieutenant,
  };
}

function cleanSiege(raw: Partial<ScenarioSiege> | null | undefined): ScenarioSiege | null {
  if (!raw) return null;
  return {
    role: oneOf<SiegeRole>(raw.role, SIEGE_ROLES, "ATTACK"),
    town: oneOf<SiegeTown>(raw.town, SIEGE_TOWNS, "FORT"),
    ladders: clamp(raw.ladders, 0, SCENARIO_LIMITS.LADDERS, 3),
    rams: clamp(raw.rams, 0, SCENARIO_LIMITS.RAMS, 1),
  };
}

function cleanForce(raw: Partial<ScenarioForce>): ScenarioForce {
  const faction = oneOf<EnemyFactionId>(raw.faction, ENEMY_FACTIONS, "GOBLINS");
  const units: ScenarioForce["units"] = {};
  for (const kind of ENEMY_FACTIONS[faction].units) {
    const n = clamp(raw.units?.[kind], 0, SCENARIO_LIMITS.UNITS, 0);
    if (n > 0) units[kind] = n;
  }
  return {
    id: typeof raw.id === "string" ? raw.id : newId(),
    faction,
    units,
    side: oneOf<ForceSide>(raw.side, FORCE_SIDES, "FRONT"),
    stance: oneOf<ForceStance>(raw.stance, FORCE_STANCES, "ATTACK"),
    delay: clamp(raw.delay, 0, SCENARIO_LIMITS.DELAY, 0),
    competence: clamp(raw.competence, 1, 5, 3),
    trait: oneOf<NobleTrait>(raw.trait, FORCE_TRAITS, "BRAVE"),
    chief: typeof raw.chief === "string" ? raw.chief.slice(0, 40) : "",
  };
}

/** Cenário vindo do armazenamento: o que não fizer sentido volta ao padrão. */
export function cleanScenario(raw: Partial<BattleScenario>): BattleScenario {
  const base = blankScenario();
  const army: Partial<ScenarioArmy> = raw.army ?? {};
  const clean: BattleScenario = {
    ...base,
    id: typeof raw.id === "string" ? raw.id : base.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.slice(0, 40) : base.name,
    description: typeof raw.description === "string" ? raw.description.slice(0, 160) : "",
    map: oneOf<ScenarioMapId>(raw.map, SCENARIO_MAPS, "PLAINS"),
    hour: oneOf<ScenarioHour>(raw.hour, SCENARIO_HOURS, "NOON"),
    season: oneOf<Season>(raw.season, SEASONS.ORDER, "SUMMER"),
    weather: oneOf<Weather>(raw.weather, ["CLEAR", "RAIN", "FOG", "SNOW", "STORM"], "CLEAR"),
    objective: oneOf<ScenarioObjective>(raw.objective, SCENARIO_OBJECTIVES, "ROUT"),
    surviveMinutes: clamp(raw.surviveMinutes, SCENARIO_LIMITS.SURVIVE[0], SCENARIO_LIMITS.SURVIVE[1], 5),
    distance: clamp(raw.distance, SCENARIO_LIMITS.DISTANCE[0], SCENARIO_LIMITS.DISTANCE[1], 1500),
    fog: raw.fog !== false,
    directOrders: raw.directOrders !== false,
    difficulty: oneOf<WarDifficulty>(raw.difficulty, WAR_AI.DIFFICULTY, "VETERAN"),
    army: {
      battalions: (Array.isArray(army.battalions) ? army.battalions : []).slice(0, SCENARIO_LIMITS.BATTALIONS).map(cleanBattalion),
      scouts: clamp(army.scouts, 0, SCENARIO_LIMITS.SCOUTS, 1),
      messengers: clamp(army.messengers, 0, SCENARIO_LIMITS.MESSENGERS, 1),
      wagons: clamp(army.wagons, 0, SCENARIO_LIMITS.WAGONS, 0),
    },
    forces: (Array.isArray(raw.forces) ? raw.forces : []).slice(0, SCENARIO_LIMITS.FORCES).map(cleanForce),
  };
  return withSiege(clean, cleanSiege(raw.siege));
}

export function loadScenarios(): BattleScenario[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as Partial<BattleScenario>[]).map(cleanScenario) : [];
  } catch {
    return [];
  }
}

/** Devolve o motivo se não der para gravar. */
export function storeScenarios(list: readonly BattleScenario[]): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return null;
  } catch {
    return "Não foi possível gravar os cenários (armazenamento cheio ou bloqueado).";
  }
}

export function loadRecords(): Record<string, ScenarioRecord> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Record<string, ScenarioRecord>) : {};
  } catch {
    return {};
  }
}

export function noteResult(id: string, result: ScenarioResult): void {
  const all = loadRecords();
  const had = all[id] ?? { plays: 0, wins: 0, best: null };
  const won = result.outcome === "VICTORY";
  all[id] = {
    plays: had.plays + 1,
    wins: had.wins + (won ? 1 : 0),
    best: won ? Math.min(had.best ?? Infinity, Math.round(result.seconds)) : had.best,
  };
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  } catch {
    // sem armazenamento: o recorde só não fica guardado
  }
}

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __scenarios?: unknown }).__scenarios = { blankScenario, newForce, newBattalionSpec, newSiege, withSiege, presets: PRESET_SCENARIOS };

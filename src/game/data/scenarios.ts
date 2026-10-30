import type { BattleResult } from "../../store/useGameStore";
import type { NobleTrait } from "../sim/nobility";
import type { BandKind } from "../sim/realm";
import { BALANCE, DEFAULT_WORLD_OPTIONS, GEO, PROGRESSION, REGION_HEIGHT, REGION_WIDTH, SEASONS, TIME, TROOPS, WAR_AI, type EnemyKind, type Formation, type Season, type TroopType, type WarDifficulty, type Weather } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { seasonDay, seasonOf } from "../../utils/season";
import { createRng, seedFromText, type Rng } from "../worldgen/rng";
import type { TerrainZone } from "../world/TerrainMap";
import { campDefAt } from "./campLayout";
import type { Biome, CrossingDef, GeoDef, RegionDef, RiverDef, WorldDef } from "./world";

/**
 * Batalhas personalizadas: um cenário diz onde, quando, com quem e contra quem se luta. A batalha
 * usa o mesmo motor da campanha (tropas, moral, ordens e o comando inimigo do Marco 16), num mapa
 * pequeno gerado aqui, com o relógio parado e sem economia.
 */

export type ScenarioMapId = "PLAINS" | "CLEARING" | "HILL" | "FORD" | "BRIDGE" | "MARSH" | "PASS" | "DUNES";
export type ScenarioHour = "DAWN" | "NOON" | "DUSK" | "NIGHT";
export type ScenarioObjective = "ROUT" | "SURVIVE" | "SLAY_CHIEF";
export type EnemyFactionId = "GOBLINS" | "BANDITS" | "KINGDOM" | "UNDEAD" | "ORCS";
export type ForceSide = "FRONT" | "LEFT" | "RIGHT" | "REAR";
export type ForceStance = "ATTACK" | "HOLD";

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
  difficulty: WarDifficulty;
  army: ScenarioArmy;
  forces: ScenarioForce[];
}

export interface ScenarioBattalionResult {
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
}

/** O que a barra da batalha mostra enquanto ela dura. */
export interface ScenarioHud {
  seconds: number;
  enemies: number;
  enemyTotal: number;
  /** Reforços inimigos que ainda vão chegar (o jogador não sabe quando). */
  waiting: boolean;
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

export const FORCE_SIDES: Record<ForceSide, string> = { FRONT: "À frente", LEFT: "Flanco esquerdo", RIGHT: "Flanco direito", REAR: "Pela retaguarda" };
export const FORCE_STANCES: Record<ForceStance, string> = { ATTACK: "Vem atacar", HOLD: "Espera em posição" };

export const ENEMY_FACTIONS: Record<EnemyFactionId, { label: string; band: BandKind; units: readonly EnemyKind[]; name: string }> = {
  GOBLINS: { label: "Goblins", band: "GOBLIN", units: ["GOBLIN", "GOBLIN_ARCHER", "WOLF_RIDER"], name: "Bando goblin" },
  BANDITS: { label: "Salteadores", band: "GOBLIN", units: ["BANDIT", "BANDIT_ARCHER"], name: "Salteadores" },
  KINGDOM: { label: "Exército de um reino", band: "FACTION", units: ["SOLDIER", "CROSSBOW", "LANCER", "OUTRIDER"], name: "Exército" },
  UNDEAD: { label: "Mortos-vivos", band: "HORDE", units: ["SKELETON"], name: "Horda dos mortos" },
  ORCS: { label: "Orcs", band: "HORDE", units: ["ORC", "GOBLIN_ARCHER", "WOLF_RIDER"], name: "Horda orc" },
};

export const FORCE_TRAITS: readonly NobleTrait[] = ["BRAVE", "CUNNING", "COWARD", "CRUEL", "AMBITIOUS", "HONORABLE", "GREEDY", "PIOUS"];

export const SCENARIO_COLS = 2;
export const SCENARIO_ROWS = 2;
export const SCENARIO_WIDTH = SCENARIO_COLS * REGION_WIDTH;
export const SCENARIO_HEIGHT = SCENARIO_ROWS * REGION_HEIGHT;
const CENTER: Point = { x: SCENARIO_WIDTH / 2, y: SCENARIO_HEIGHT / 2 };

/** Onde o bando começa: sempre a oeste do centro, de frente para o leste. */
export function armyStart(s: Pick<BattleScenario, "distance">): Point {
  return { x: CENTER.x - s.distance / 2, y: CENTER.y };
}

/** Onde uma força começa; quem chega depois vem de mais longe, fora de vista. */
export function forceStart(s: Pick<BattleScenario, "distance" | "forces">, force: ScenarioForce): Point {
  const peers = s.forces.filter((f) => f.side === force.side);
  const lateral = (peers.indexOf(force) - (peers.length - 1) / 2) * 420;
  const far = force.delay > 0 ? 1100 : 0;
  const wide = Math.max(s.distance, 1300);
  switch (force.side) {
    case "FRONT":
      return { x: CENTER.x + s.distance / 2 + far, y: CENTER.y + lateral };
    case "LEFT":
      return { x: CENTER.x - 200 + lateral, y: CENTER.y - wide - far };
    case "RIGHT":
      return { x: CENTER.x - 200 + lateral, y: CENTER.y + wide + far };
    case "REAR":
      return { x: armyStart(s).x - s.distance - far, y: CENTER.y + lateral };
  }
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
  return null;
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

/** Mundo só com o campo de batalha: sem povoados, reinos nem acampamento montado. */
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
    terrain: zonesOf(s.map, rng),
    camp: campDefAt({ x: 700, y: SCENARIO_HEIGHT - 700 }),
    settlements: [],
    factions: [],
    sites: [],
    lairs: [],
    roads: [],
    history: [],
  };
}

// --- Cenários novos e prontos ---

export function newBattalionSpec(troop: TroopType, level = 1, gear = 0, lieutenant = false, soldiers = BALANCE.BATTALION_SIZE): ScenarioBattalion {
  return { id: crypto.randomUUID(), troop, soldiers, level, gear, formation: TROOPS[troop].formations[0], lieutenant };
}

export function newForce(faction: EnemyFactionId = "GOBLINS"): ScenarioForce {
  const [first, second] = ENEMY_FACTIONS[faction].units;
  return { id: crypto.randomUUID(), faction, units: { [first]: 18, ...(second ? { [second]: 6 } : {}) }, side: "FRONT", stance: "ATTACK", delay: 0, competence: 3, trait: "BRAVE", chief: "" };
}

export function blankScenario(): BattleScenario {
  return {
    id: crypto.randomUUID(),
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
    difficulty: "VETERAN",
    army: { battalions: [newBattalionSpec("INFANTRY", 1, 0, true), newBattalionSpec("ARCHERS")], scouts: 1, messengers: 1, wagons: 0 },
    forces: [newForce()],
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
    forces: [force("BANDITS", { BANDIT: 22, BANDIT_ARCHER: 10 }, { competence: 4, trait: "CUNNING", stance: "HOLD" })],
  }),
  preset("colina-do-rei", {
    name: "A Colina do Rei",
    description: "Um lorde tomou o alto com besteiros e cavalaria. Tire-o de lá.",
    map: "HILL",
    distance: 1800,
    army: { battalions: [B("INFANTRY", 3, 1, true), B("INFANTRY", 3, 1), B("ARCHERS", 3, 1), B("ARCHERS", 3, 1), B("CAVALRY", 3, 1, true)], scouts: 1, messengers: 2, wagons: 0 },
    forces: [force("KINGDOM", { SOLDIER: 30, CROSSBOW: 10, LANCER: 6, OUTRIDER: 2 }, { competence: 4, trait: "HONORABLE", stance: "HOLD" })],
  }),
  preset("vau-de-sangue", {
    name: "O Vau de Sangue",
    description: "A horda orc quer atravessar sob a chuva. Segure as margens: os arcos alcançam menos.",
    map: "FORD",
    season: "SPRING",
    weather: "RAIN",
    army: { battalions: [B("INFANTRY", 3, 2, true), B("INFANTRY", 3, 2), B("INFANTRY", 3, 1), B("ARCHERS", 3, 1)], scouts: 1, messengers: 2, wagons: 0 },
    forces: [force("ORCS", { ORC: 18, GOBLIN_ARCHER: 8, WOLF_RIDER: 4 }, { competence: 3, trait: "CRUEL" })],
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
      force("UNDEAD", { SKELETON: 30 }, { competence: 3, trait: "CRUEL" }),
      force("UNDEAD", { SKELETON: 30 }, { competence: 3, trait: "CRUEL", delay: 120 }),
      force("UNDEAD", { SKELETON: 40 }, { competence: 4, trait: "BRAVE", delay: 240 }),
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
    army: { battalions: [B("INFANTRY", 5, 3, true), B("INFANTRY", 5, 3, true), B("ARCHERS", 5, 3)], scouts: 1, messengers: 1, wagons: 0 },
    forces: [
      force("KINGDOM", { SOLDIER: 40, CROSSBOW: 16, OUTRIDER: 2 }, { competence: 4, trait: "AMBITIOUS" }),
      force("KINGDOM", { SOLDIER: 30, LANCER: 10 }, { competence: 3, trait: "BRAVE", delay: 150 }),
    ],
  }),
  preset("cabeca-da-serpente", {
    name: "A Cabeça da Serpente",
    description: "Mate o chefe orc e a horda se desfaz. A lama vai segurar os cavalos.",
    map: "MARSH",
    objective: "SLAY_CHIEF",
    hour: "DAWN",
    army: { battalions: [B("CAVALRY", 4, 2, true), B("INFANTRY", 4, 2), B("ARCHERS", 4, 2)], scouts: 2, messengers: 1, wagons: 0 },
    forces: [force("ORCS", { ORC: 24, GOBLIN_ARCHER: 8 }, { competence: 3, trait: "AMBITIOUS", chief: "Gor Ossos-Partidos" })],
  }),
  preset("areias-traicoeiras", {
    name: "Areias Traiçoeiras",
    description: "A caravana parou nas dunas. Eles vêm pela frente, e a verdadeira força vem por trás.",
    map: "DUNES",
    army: { battalions: [B("INFANTRY", 3, 1, true), B("ARCHERS", 3, 1), B("CAVALRY", 3, 1)], scouts: 2, messengers: 1, wagons: 3 },
    forces: [
      force("BANDITS", { BANDIT: 16, BANDIT_ARCHER: 8 }, { competence: 3, trait: "GREEDY" }),
      force("GOBLINS", { GOBLIN: 14, WOLF_RIDER: 8 }, { competence: 4, trait: "CUNNING", side: "REAR", delay: 45 }),
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
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    troop,
    soldiers: clamp(raw.soldiers, min, max, BALANCE.BATTALION_SIZE),
    level: clamp(raw.level, 1, PROGRESSION.MAX_LEVEL, 1),
    gear: clamp(raw.gear, 0, PROGRESSION.MAX_EQUIPMENT_TIER, 0),
    formation: oneOf<Formation>(raw.formation, TROOPS[troop].formations, TROOPS[troop].formations[0]),
    lieutenant: !!raw.lieutenant,
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
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
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
  return {
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
    difficulty: oneOf<WarDifficulty>(raw.difficulty, WAR_AI.DIFFICULTY, "VETERAN"),
    army: {
      battalions: (Array.isArray(army.battalions) ? army.battalions : []).slice(0, SCENARIO_LIMITS.BATTALIONS).map(cleanBattalion),
      scouts: clamp(army.scouts, 0, SCENARIO_LIMITS.SCOUTS, 1),
      messengers: clamp(army.messengers, 0, SCENARIO_LIMITS.MESSENGERS, 1),
      wagons: clamp(army.wagons, 0, SCENARIO_LIMITS.WAGONS, 0),
    },
    forces: (Array.isArray(raw.forces) ? raw.forces : []).slice(0, SCENARIO_LIMITS.FORCES).map(cleanForce),
  };
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
if (import.meta.env.DEV) (window as unknown as { __scenarios?: unknown }).__scenarios = { blankScenario, newForce, newBattalionSpec };

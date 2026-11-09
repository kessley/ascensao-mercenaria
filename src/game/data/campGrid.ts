import type { TroopType } from "../../utils/constants";
import type { FollowerRole } from "../sim/campEvents";

/**
 * Marco 22, parte 1: a planta do acampamento numa grade quadrada (GDD, seção 9).
 *
 * A área é um quadrado de células de 40 px em volta do centro do acampamento. As coordenadas de
 * cada construção são da célula do canto de cima, à esquerda, contadas a partir do centro: assim
 * a paliçada cresce por igual nos quatro lados sem tirar nada do lugar. Tudo aqui é regra pura
 * (sem Phaser), usada pelo store, pela cena e pelos testes.
 */

export const CELL = 40;
/** Lado do quadrado, em células: o bivaque e a paliçada pequena, média e grande. */
export const CAMP_SIZES = [10, 16, 22, 28] as const;
export type CampSize = (typeof CAMP_SIZES)[number];
export type CampSide = "N" | "E" | "S" | "W";
export const CAMP_SIDES: readonly CampSide[] = ["N", "E", "S", "W"];
export type CampNeed = "BEDS" | "FOOD" | "SALUBRITY" | "CURE" | "MORALE" | "SECURITY" | "CRAFT";
export const CAMP_NEEDS: readonly CampNeed[] = ["BEDS", "FOOD", "SALUBRITY", "CURE", "MORALE", "SECURITY", "CRAFT"];

export type CampKind =
  | "COMMAND_TENT"
  | "CAMPFIRE"
  | "BARRACK"
  | "RECRUIT_MAST"
  | "QUARTERMASTER"
  | "RECRUIT_POST"
  | "TRAINING"
  | "ARCHERY"
  | "STABLE"
  | "FORGE"
  | "OFFICERS_TENT"
  | "KITCHEN"
  | "INFIRMARY"
  | "WELL"
  | "TOWER"
  // Parte 2: vida
  | "OVEN"
  | "SMOKEHOUSE"
  | "LATRINE"
  | "HERBALIST"
  | "CAPTAIN_TENT"
  // moral
  | "CAMP_TAVERN"
  | "DICE"
  | "STANDARD"
  | "TROPHY"
  | "CEMETERY"
  | "STORY_FIRE"
  | "ALTAR"
  // ofício
  | "CARPENTRY"
  | "SADDLERY"
  | "TAILOR"
  | "LUMBER"
  | "GARDEN"
  // militar
  | "RIDING"
  | "ARSENAL"
  | "PEN"
  | "MAP_TENT"
  | "CALTROPS"
  | "SENTRY";

export interface CampCost {
  gold: number;
  wood?: number;
  iron?: number;
}

export interface CampBuildingDef {
  label: string;
  /** Lado, em células: pequena 2, média 3, grande 4. */
  size: 2 | 3 | 4;
  cost: CampCost;
  /** Custo de cada nível a mais (o primeiro é o do nível 2). */
  upgrades?: readonly CampCost[];
  /** Carga nas carroças ao levantar o acampamento. */
  cargo: number;
  /** Patamar mínimo: 0 já no bivaque, 1 só dentro da paliçada. */
  tier: 0 | 1;
  max: number;
  need?: CampNeed;
  /** Já vem pronto: não se desmonta, mas dá para mudar de lugar. */
  fixed?: boolean;
  /** Cavado no chão: não vai nas carroças. */
  stays?: boolean;
  /**
   * Tem um posto: só funciona com alguém nele (Marco 22, parte 2). Os seguidores destes papéis
   * vão primeiro; qualquer outro seguidor, ou um soldado do turno de obra, também serve.
   */
  post?: readonly FollowerRole[];
  /** Quanto soma à moral do acampamento. */
  mood?: number;
  /** Conta como oficina (a necessidade de Ofício). */
  craft?: boolean;
  /** Ouro por semana para manter (quem tem posto paga com o trabalhador). */
  upkeep?: number;
  effect: string;
}

export const CAMP_BUILDINGS: Record<CampKind, CampBuildingDef> = {
  COMMAND_TENT: { label: "Tenda do Comandante", size: 3, cost: { gold: 0 }, cargo: 2, tier: 0, max: 1, fixed: true, effect: "A mesa dos contratos, o diário e a planta do acampamento." },
  CAMPFIRE: { label: "Fogueira", size: 2, cost: { gold: 0 }, cargo: 0, tier: 0, max: 1, fixed: true, need: "FOOD", effect: "Cozinha para 2 batalhões." },
  BARRACK: { label: "Barraca de soldados", size: 3, cost: { gold: 40 }, upgrades: [{ gold: 60, wood: 3 }], cargo: 1, tier: 0, max: 12, need: "BEDS", effect: "Leitos para mais 1 batalhão (no nível 2, o barracão, para 2)." },
  RECRUIT_MAST: { label: "Mastro de recrutamento", size: 2, cost: { gold: 50 }, cargo: 1, tier: 0, max: 1, effect: "Atrai 1 voluntário por dia, até 8 esperando. Com 8, forma-se um batalhão." },
  QUARTERMASTER: { label: "Intendência", size: 3, cost: { gold: 60, wood: 2 }, cargo: 2, tier: 0, max: 1, effect: "O mercado de rações, o depósito e as carroças." },
  TRAINING: { label: "Campo de Treino", size: 4, cost: { gold: 80, wood: 4 }, cargo: 2, tier: 0, max: 1, effect: "Treina os batalhões. Libera os lanceiros." },
  ARCHERY: { label: "Estande de tiro", size: 4, cost: { gold: 70, wood: 3 }, upgrades: [{ gold: 90, wood: 4 }], cargo: 2, tier: 0, max: 1, effect: "Libera os arqueiros (no nível 2, os dardeiros) e treina quem atira." },
  RECRUIT_POST: { label: "Posto de Recrutamento", size: 2, cost: { gold: 120, wood: 4 }, cargo: 1, tier: 1, max: 1, effect: "Recruta batalhões inteiros na hora e dobra os voluntários." },
  STABLE: { label: "Estábulo", size: 3, cost: { gold: 140, wood: 6 }, cargo: 3, tier: 1, max: 1, effect: "Libera a cavalaria. Contrata batedores e mensageiros." },
  FORGE: { label: "Ferraria", size: 3, cost: { gold: 150, wood: 6, iron: 8 }, cargo: 4, tier: 1, max: 1, post: ["SMITH"], craft: true, effect: "Conserto e armas. Libera a guarda pesada e os besteiros." },
  OFFICERS_TENT: { label: "Tenda dos oficiais", size: 3, cost: { gold: 120, wood: 2 }, upgrades: [{ gold: 150 }, { gold: 200 }], cargo: 2, tier: 1, max: 1, effect: "Abre vaga para 1 tenente por nível, até 3." },
  KITCHEN: { label: "Cozinha", size: 3, cost: { gold: 70, wood: 4 }, upgrades: [{ gold: 100, wood: 4 }], cargo: 2, tier: 1, max: 2, need: "FOOD", post: ["COOK"], effect: "Cozinha para mais 3 batalhões (no nível 2, o refeitório, para 5)." },
  INFIRMARY: { label: "Enfermaria", size: 3, cost: { gold: 90, wood: 4 }, upgrades: [{ gold: 140, wood: 6 }], cargo: 2, tier: 1, max: 2, need: "CURE", post: ["HEALER"], effect: "8 leitos: quem está nela sara no ritmo do acampamento (no nível 2, o hospital de campanha, 16)." },
  WELL: { label: "Poço", size: 2, cost: { gold: 50, wood: 2 }, cargo: 0, tier: 1, max: 2, stays: true, need: "SALUBRITY", effect: "Água limpa: o acampamento aguenta 30 soldados a mais antes de lotar." },
  TOWER: { label: "Torre de vigia", size: 2, cost: { gold: 80, wood: 4 }, cargo: 2, tier: 1, max: 4, need: "SECURITY", upkeep: 1, effect: "Vigia longe. Cada torre evita 10% do saque." },
  // --- Parte 2: vida ---
  OVEN: { label: "Forno de pão", size: 2, cost: { gold: 60, wood: 2 }, cargo: 2, tier: 1, max: 1, need: "FOOD", post: ["COOK"], effect: "O pão rende: quem come no acampamento gasta 10% menos rações." },
  SMOKEHOUSE: { label: "Defumadouro", size: 2, cost: { gold: 70, wood: 3 }, cargo: 2, tier: 1, max: 1, need: "FOOD", post: ["COOK"], effect: "Rações de marcha: em campo, o exército gasta 15% menos." },
  LATRINE: { label: "Latrina", size: 2, cost: { gold: 30, wood: 1 }, cargo: 0, tier: 1, max: 3, stays: true, need: "SALUBRITY", effect: "30 soldados a mais antes de lotar, e menos surtos no acampamento." },
  HERBALIST: { label: "Herbário", size: 2, cost: { gold: 80, wood: 2 }, cargo: 1, tier: 1, max: 1, need: "CURE", post: ["HEALER"], effect: "Ervas contra a febre e a disenteria: os doentes saram mais depressa." },
  CAPTAIN_TENT: { label: "Tenda do capitão", size: 3, cost: { gold: 100, wood: 3 }, cargo: 2, tier: 1, max: 3, upkeep: 2, effect: "A companhia acampa junta: o capitão ganha lealdade toda semana (uma tenda por capitão)." },
  // --- Moral ---
  CAMP_TAVERN: { label: "Taverna de campanha", size: 3, cost: { gold: 90, wood: 4 }, cargo: 2, tier: 1, max: 1, need: "MORALE", post: ["PEDDLER"], mood: 4, effect: "Cerveja e conversa: muita moral." },
  DICE: { label: "Mesa de dados", size: 2, cost: { gold: 20 }, cargo: 0, tier: 0, max: 1, need: "MORALE", mood: 2, effect: "Moral barata, mas às vezes sai briga." },
  STANDARD: { label: "Estandarte do bando", size: 2, cost: { gold: 40, wood: 1 }, cargo: 1, tier: 0, max: 1, need: "MORALE", mood: 2, effect: "A bandeira do bando no meio do acampamento: moral." },
  TROPHY: { label: "Mastro de troféus", size: 2, cost: { gold: 30, wood: 1 }, cargo: 1, tier: 1, max: 1, need: "MORALE", mood: 1, effect: "Os estandartes tomados dão 0,1 de fama por dia com o acampamento montado." },
  CEMETERY: { label: "Cemitério", size: 3, cost: { gold: 20 }, cargo: 0, tier: 1, max: 1, stays: true, need: "MORALE", mood: 2, effect: "Os mortos têm onde descansar: moral." },
  STORY_FIRE: { label: "Fogueira das histórias", size: 2, cost: { gold: 40 }, cargo: 0, tier: 1, max: 1, need: "MORALE", mood: 2, effect: "Um bardo espalha as façanhas: moral e 0,05 de fama por dia." },
  ALTAR: { label: "Altar", size: 2, cost: { gold: 50, wood: 1 }, cargo: 1, tier: 1, max: 1, need: "MORALE", mood: 3, upkeep: 1, effect: "Fé e cerimônias (Marco 23): moral." },
  // --- Ofício ---
  CARPENTRY: { label: "Carpintaria", size: 3, cost: { gold: 110, wood: 6 }, cargo: 3, tier: 1, max: 1, need: "CRAFT", post: ["FAMILY"], craft: true, effect: "Com madeira, faz carroças, escadas e aríetes, que as carroças levam ao próximo cerco." },
  SADDLERY: { label: "Selaria e curtume", size: 3, cost: { gold: 90, wood: 3 }, cargo: 2, tier: 1, max: 1, need: "CRAFT", post: ["SMITH", "FAMILY"], craft: true, effect: "Couro e selas: conserta o que a ferraria não conserta." },
  TAILOR: { label: "Alfaiataria", size: 2, cost: { gold: 80, wood: 2 }, cargo: 1, tier: 1, max: 1, need: "CRAFT", post: ["FAMILY"], craft: true, mood: 2, effect: "Uniforme na cor do bando: moral, e conserta as roupas." },
  LUMBER: { label: "Posto do lenhador", size: 2, cost: { gold: 40 }, cargo: 1, tier: 1, max: 1, post: ["FAMILY"], effect: "Madeira todo dia, se o acampamento estiver perto de floresta." },
  GARDEN: { label: "Horta e curral", size: 4, cost: { gold: 50, wood: 2 }, cargo: 0, tier: 1, max: 1, stays: true, need: "FOOD", post: ["FAMILY", "COOK"], effect: "3 rações por dia com o acampamento montado." },
  // --- Militar ---
  RIDING: { label: "Picadeiro", size: 4, cost: { gold: 120, wood: 6 }, cargo: 2, tier: 1, max: 1, upkeep: 1, effect: "Treina a cavalaria. Com o estábulo, libera os arqueiros montados." },
  ARSENAL: { label: "Arsenal", size: 3, cost: { gold: 100, wood: 4, iron: 4 }, cargo: 3, tier: 1, max: 1, need: "CRAFT", craft: true, upkeep: 2, effect: "Guarda e troca o equipamento entre batalhões: conta como oficina." },
  PEN: { label: "Cercado de cativos", size: 3, cost: { gold: 50, wood: 3 }, cargo: 1, tier: 1, max: 1, effect: "Os prisioneiros fogem pela metade." },
  MAP_TENT: { label: "Tenda de mapas", size: 2, cost: { gold: 90, wood: 1 }, cargo: 1, tier: 1, max: 1, upkeep: 1, effect: "Os batedores exploram uma região 30% maior." },
  CALTROPS: { label: "Estrepes", size: 2, cost: { gold: 30, wood: 2 }, cargo: 0, tier: 1, max: 4, stays: true, need: "SECURITY", effect: "Pontas no chão: cada campo de estrepes evita mais 5% do saque." },
  SENTRY: { label: "Posto de sentinela", size: 2, cost: { gold: 40, wood: 2 }, cargo: 1, tier: 1, max: 2, need: "SECURITY", effect: "Avisa do ataque: ninguém é pego de surpresa, e evita 5% do saque." },
};

/** O que se pode construir, na ordem do painel (a tenda e a fogueira já vêm prontas). */
export const BUILD_ORDER: readonly CampKind[] = [
  "BARRACK", "RECRUIT_MAST", "QUARTERMASTER", "ARCHERY", "TRAINING", "DICE", "STANDARD",
  "RECRUIT_POST", "OFFICERS_TENT", "KITCHEN", "INFIRMARY", "WELL", "LATRINE", "STABLE", "FORGE", "TOWER",
  "OVEN", "SMOKEHOUSE", "HERBALIST", "CAPTAIN_TENT",
  "CAMP_TAVERN", "TROPHY", "CEMETERY", "STORY_FIRE", "ALTAR",
  "CARPENTRY", "SADDLERY", "TAILOR", "LUMBER", "GARDEN",
  "RIDING", "ARSENAL", "PEN", "MAP_TENT", "CALTROPS", "SENTRY",
];

/** As seções do catálogo no painel. */
export const BUILD_GROUPS: readonly { label: string; kinds: readonly CampKind[] }[] = [
  { label: "Vida", kinds: ["BARRACK", "QUARTERMASTER", "OFFICERS_TENT", "KITCHEN", "OVEN", "SMOKEHOUSE", "WELL", "LATRINE", "INFIRMARY", "HERBALIST", "CAPTAIN_TENT"] },
  { label: "Moral", kinds: ["DICE", "STANDARD", "CAMP_TAVERN", "TROPHY", "CEMETERY", "STORY_FIRE", "ALTAR"] },
  { label: "Ofício", kinds: ["FORGE", "CARPENTRY", "SADDLERY", "TAILOR", "LUMBER", "GARDEN"] },
  { label: "Militar", kinds: ["RECRUIT_MAST", "RECRUIT_POST", "TRAINING", "ARCHERY", "STABLE", "RIDING", "ARSENAL", "PEN", "MAP_TENT", "TOWER", "CALTROPS", "SENTRY"] },
];

export interface CampBuilding {
  id: string;
  kind: CampKind;
  /** Célula do canto de cima, à esquerda, a partir do centro. */
  x: number;
  y: number;
  level: number;
  /** Obra em andamento: o trabalho já feito (sem o campo, está pronta). Ver `workOf`. */
  built?: number;
  /** Posto fechado pelo jogador: o trabalhador fica livre e a construção para. */
  off?: boolean;
}

export interface CampPlan {
  size: CampSize;
  gate: CampSide;
  /** Fosso em volta da paliçada (cavado: fica para trás ao levantar). */
  ditch: boolean;
  buildings: CampBuilding[];
  /** Save de antes do Marco 22: guarda o que já tinha (todas as tropas e as vagas de tenente). */
  legacy?: boolean;
}

/** A paliçada em três tamanhos: o que custa, quanto pesa nas carroças e o que pede para subir. */
export interface PalisadeStep {
  label: string;
  cost: CampCost;
  cargo: number;
  fame: number;
  battalions: number;
  needs: readonly (readonly [CampKind, number])[];
  /** Quanto do saque um ataque ao acampamento desguarnecido deixa de levar. */
  guard: number;
}

export const PALISADE: Record<CampSize, PalisadeStep> = {
  10: { label: "Bivaque", cost: { gold: 0 }, cargo: 0, fame: 0, battalions: 0, needs: [], guard: 0 },
  16: { label: "Paliçada pequena", cost: { gold: 160, wood: 8 }, cargo: 2, fame: 4, battalions: 2, needs: [["RECRUIT_MAST", 1], ["BARRACK", 2]], guard: 0.2 },
  22: { label: "Paliçada média", cost: { gold: 280, wood: 16 }, cargo: 3, fame: 15, battalions: 3, needs: [["KITCHEN", 1], ["OFFICERS_TENT", 1]], guard: 0.3 },
  28: { label: "Paliçada grande", cost: { gold: 420, wood: 24 }, cargo: 4, fame: 30, battalions: 4, needs: [["INFIRMARY", 1], ["FORGE", 1], ["STABLE", 1]], guard: 0.35 },
};

export const DITCH = { label: "Fosso", cost: { gold: 70 } as CampCost, guard: 0.25, effect: "Lama funda em volta da paliçada (só o portão fica firme). Não vai nas carroças." };
export const TOWER_GUARD = 0.1;
/** Estrepes e posto de sentinela. */
export const SMALL_GUARD = 0.05;
/** O saque evitado não passa disto, por mais defesa que haja. */
export const MAX_GUARD = 0.85;
/** Carga de acampamento que cada carroça leva ao levantar. */
export const CARGO_PER_WAGON = 6;
/** Desmontar devolve esta fração do que a construção custou. */
export const REFUND = 0.5;
/** Voluntários do mastro: por dia e quantos esperam (o posto de recrutamento dobra os dois). */
export const VOLUNTEERS = { PER_DAY: 1, CAP: 8 } as const;
/** Formar um batalhão com voluntários custa esta fração da tropa (só o equipamento). */
export const VOLUNTEER_COST = 0.5;
/** Taverna: contratar um batalhão de infantaria custa a tropa vezes isto, uma vez por semana em cada povoado. */
export const TAVERN_HIRE = { COST: 1.3, EVERY_DAYS: 7 } as const;
/** Cozinha e enfermaria: quanto cada uma dá. */
export const FIRE_COOKS = 2;
export const KITCHEN_COOKS = 3;
export const INFIRMARY_BEDS = 8;
export const WELL_CROWD = 30;
/** Montar sobre floresta: cada célula de árvores cortada vira esta madeira. */
export const WOOD_PER_FOREST_CELL = 0.2;
/** Quem come cru gasta isto a mais de rações. */
export const RAW_FOOD = 1.25;

export const halfOf = (plan: Pick<CampPlan, "size">) => plan.size / 2;
export const tierOf = (plan: Pick<CampPlan, "size">): 0 | 1 => (plan.size > 10 ? 1 : 0);
export const countOf = (plan: CampPlan, kind: CampKind) => plan.buildings.filter((b) => b.kind === kind).length;
export const levelOf = (plan: CampPlan, kind: CampKind) => Math.max(0, ...plan.buildings.filter((b) => b.kind === kind).map((b) => b.level));
export const has = (plan: CampPlan, kind: CampKind) => plan.buildings.some((b) => b.kind === kind);

/** Trabalho para erguer uma construção (dias de gente: 1 seguidor faz 1 por dia; um batalhão na obra, 4). */
export const WORK_BY_SIZE: Record<2 | 3 | 4, number> = { 2: 3, 3: 6, 4: 10 };
export const workOf = (kind: CampKind) => (CAMP_BUILDINGS[kind].fixed ? 0 : WORK_BY_SIZE[CAMP_BUILDINGS[kind].size]);
/** Pronta (a obra acabou)? */
export const isBuilt = (b: CampBuilding) => b.built === undefined || b.built >= workOf(b.kind);
/** As construções prontas de um tipo: só elas fazem efeito. */
export const readyOf = (plan: CampPlan, kind: CampKind) => plan.buildings.filter((b) => b.kind === kind && isBuilt(b));
export const ready = (plan: CampPlan, kind: CampKind) => readyOf(plan, kind).length > 0;
export const readyLevel = (plan: CampPlan, kind: CampKind) => Math.max(0, ...readyOf(plan, kind).map((b) => b.level));

const key = (x: number, y: number) => `${x},${y}`;

/** As células de uma construção. */
export function cellsOf(b: Pick<CampBuilding, "kind" | "x" | "y">): [number, number][] {
  const k = CAMP_BUILDINGS[b.kind].size;
  const out: [number, number][] = [];
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) out.push([b.x + i, b.y + j]);
  return out;
}

/** As células logo por dentro do portão (2 de largura, 2 de fundo): ficam sempre livres. */
export function gateLane(plan: Pick<CampPlan, "size" | "gate">, side: CampSide = plan.gate): [number, number][] {
  const h = halfOf(plan);
  const out: [number, number][] = [];
  for (let a = -1; a <= 0; a++) {
    for (let d = 0; d < 2; d++) {
      if (side === "W") out.push([-h + d, a]);
      else if (side === "E") out.push([h - 1 - d, a]);
      else if (side === "N") out.push([a, -h + d]);
      else out.push([a, h - 1 - d]);
    }
  }
  return out;
}

/** Ocupação da grade: célula → construção (sem a de `ignoreId`). */
function occupancy(plan: CampPlan, ignoreId?: string): Map<string, CampBuilding> {
  const out = new Map<string, CampBuilding>();
  for (const b of plan.buildings) {
    if (b.id === ignoreId) continue;
    for (const [x, y] of cellsOf(b)) out.set(key(x, y), b);
  }
  return out;
}

const inside = (h: number, x: number, y: number) => x >= -h && y >= -h && x < h && y < h;

/** Células livres que se alcançam a pé do portão. */
function reachable(plan: CampPlan, occ: Map<string, CampBuilding>): Set<string> {
  const h = halfOf(plan);
  const seen = new Set<string>();
  const queue: [number, number][] = [];
  for (const [x, y] of gateLane(plan)) {
    if (occ.has(key(x, y))) continue;
    seen.add(key(x, y));
    queue.push([x, y]);
  }
  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = key(nx, ny);
      if (!inside(h, nx, ny) || seen.has(k) || occ.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** Células em volta da construção, a começar pelo meio do lado de baixo (a porta, na vista 3/4). */
function ringOf(b: Pick<CampBuilding, "kind" | "x" | "y">): [number, number][] {
  const k = CAMP_BUILDINGS[b.kind].size;
  const mid = Math.floor((k - 1) / 2);
  const order = [mid, mid + 1, mid - 1, 0, k - 1].filter((v, i, a) => v >= 0 && v < k && a.indexOf(v) === i);
  const out: [number, number][] = [];
  for (const i of order) out.push([b.x + i, b.y + k]);
  for (const j of order) out.push([b.x + k, b.y + j], [b.x - 1, b.y + j]);
  for (const i of order) out.push([b.x + i, b.y - 1]);
  return out;
}

/** A célula diante da porta: a primeira em volta que se alcança do portão (null = emparedada). */
export function doorCell(plan: CampPlan, b: CampBuilding): [number, number] | null {
  const occ = occupancy(plan);
  const reach = reachable(plan, occ);
  return ringOf(b).find(([x, y]) => reach.has(key(x, y))) ?? null;
}

/** Todas as portas de uma vez (a cena usa para os pontos de conversa e as trilhas). */
export function doorCells(plan: CampPlan): Map<string, [number, number]> {
  const occ = occupancy(plan);
  const reach = reachable(plan, occ);
  const out = new Map<string, [number, number]>();
  for (const b of plan.buildings) {
    const d = ringOf(b).find(([x, y]) => reach.has(key(x, y)));
    if (d) out.set(b.id, d);
  }
  return out;
}

/** Algo ficaria sem caminho até o portão? Devolve o nome do que fica emparedado. */
function walledIn(plan: CampPlan): string | null {
  const occ = occupancy(plan);
  const reach = reachable(plan, occ);
  if (reach.size === 0) return "o portão";
  for (const b of plan.buildings) if (!ringOf(b).some(([x, y]) => reach.has(key(x, y)))) return CAMP_BUILDINGS[b.kind].label;
  return null;
}

/**
 * Por que a construção não cabe ali (null = cabe): fora da área, em cima de outra, na frente do
 * portão ou fechando o caminho de alguém. `ignoreId` = a que está sendo mudada de lugar.
 */
export function placeProblem(plan: CampPlan, kind: CampKind, x: number, y: number, ignoreId?: string): string | null {
  const h = halfOf(plan);
  const k = CAMP_BUILDINGS[kind].size;
  if (x < -h || y < -h || x + k > h || y + k > h) return "Fora da área do acampamento";
  const occ = occupancy(plan, ignoreId);
  const cells = cellsOf({ kind, x, y });
  if (cells.some(([cx, cy]) => occ.has(key(cx, cy)))) return "Em cima de outra construção";
  const lane = new Set(gateLane(plan).map(([a, b]) => key(a, b)));
  if (cells.some(([cx, cy]) => lane.has(key(cx, cy)))) return "Na frente do portão";
  const trial: CampPlan = { ...plan, buildings: [...plan.buildings.filter((b) => b.id !== ignoreId), { id: "?", kind, x, y, level: 1 }] };
  const shut = walledIn(trial);
  return shut ? `Fecha o caminho até ${shut === CAMP_BUILDINGS[kind].label ? "ela mesma" : shut}` : null;
}

/** O portão pode ir para esse lado? (a faixa por dentro precisa estar livre e ninguém pode ficar preso) */
export function gateProblem(plan: CampPlan, side: CampSide): string | null {
  const occ = occupancy(plan);
  if (gateLane(plan, side).some(([x, y]) => occ.has(key(x, y)))) return "Há construções por dentro desse lado";
  const shut = walledIn({ ...plan, gate: side });
  return shut ? `Fecha o caminho até ${shut}` : null;
}

/** Primeiro lugar livre para uma construção, a partir do centro (para quem não escolheu onde). */
export function freeSpot(plan: CampPlan, kind: CampKind): { x: number; y: number } | null {
  const h = halfOf(plan);
  const k = CAMP_BUILDINGS[kind].size;
  const spots: { x: number; y: number; d: number }[] = [];
  for (let y = -h; y + k <= h; y++) for (let x = -h; x + k <= h; x++) spots.push({ x, y, d: Math.hypot(x + k / 2, y + k / 2) });
  spots.sort((a, b) => a.d - b.d);
  return spots.find((p) => placeProblem(plan, kind, p.x, p.y) === null) ?? null;
}

export interface Stock {
  gold: number;
  wood: number;
  iron: number;
}

/** O que falta para pagar (null = dá). */
export function shortOf(cost: CampCost, have: Stock): string | null {
  const miss: string[] = [];
  if (have.gold < cost.gold) miss.push(`${cost.gold - have.gold} de ouro`);
  if (have.wood < (cost.wood ?? 0)) miss.push(`${(cost.wood ?? 0) - have.wood} de madeira`);
  if (have.iron < (cost.iron ?? 0)) miss.push(`${(cost.iron ?? 0) - have.iron} de ferro`);
  return miss.length > 0 ? `Faltam ${miss.join(", ")}` : null;
}

export const costText = (c: CampCost) => [`${c.gold} ouro`, c.wood ? `${c.wood} madeira` : "", c.iron ? `${c.iron} ferro` : ""].filter(Boolean).join(" · ");

/** Por que essa construção não se pode erguer agora (o patamar e o máximo), sem olhar o lugar nem o preço. */
export function buildProblem(plan: CampPlan, kind: CampKind): string | null {
  const def = CAMP_BUILDINGS[kind];
  if (def.tier > tierOf(plan)) return "Só dentro da paliçada";
  if (countOf(plan, kind) >= def.max) return def.max === 1 ? "Já existe" : `No máximo ${def.max}`;
  return null;
}

/** Custo do próximo nível (null = já está no último). */
export function upgradeCost(b: CampBuilding): CampCost | null {
  return CAMP_BUILDINGS[b.kind].upgrades?.[b.level - 1] ?? null;
}

/** Quanto volta ao desmontar: metade do que custou, contando os níveis. */
export function refundOf(b: CampBuilding): CampCost {
  const def = CAMP_BUILDINGS[b.kind];
  const paid = [def.cost, ...(def.upgrades ?? []).slice(0, b.level - 1)];
  const sum = (f: (c: CampCost) => number | undefined) => Math.floor(paid.reduce((n, c) => n + (f(c) ?? 0), 0) * REFUND);
  return { gold: sum((c) => c.gold), wood: sum((c) => c.wood), iron: sum((c) => c.iron) };
}

// --- A paliçada ---

/** O próximo tamanho da paliçada (null = já é a grande). */
export function nextSize(plan: CampPlan): CampSize | null {
  const i = CAMP_SIZES.indexOf(plan.size);
  return i >= 0 && i < CAMP_SIZES.length - 1 ? CAMP_SIZES[i + 1] : null;
}

/** O que falta para a paliçada crescer (sem o preço): fama, soldados e as construções de baixo. */
export function growProblem(plan: CampPlan, ctx: { fame: number; battalions: number }): string | null {
  const next = nextSize(plan);
  if (!next) return "A paliçada já é a grande";
  const step = PALISADE[next];
  const miss: string[] = [];
  if (ctx.fame < step.fame) miss.push(`fama ${step.fame}`);
  if (ctx.battalions < step.battalions) miss.push(`${step.battalions} batalhões`);
  for (const [kind, n] of step.needs) if (readyOf(plan, kind).length < n) miss.push(n > 1 ? `${n} × ${CAMP_BUILDINGS[kind].label.toLowerCase()}` : CAMP_BUILDINGS[kind].label.toLowerCase());
  return miss.length > 0 ? `Falta: ${miss.join(", ")}` : null;
}

/** A paliçada cresce 3 células de cada lado; as construções ficam onde estavam. */
export function grown(plan: CampPlan): CampPlan {
  const next = nextSize(plan);
  return next ? { ...plan, size: next } : plan;
}

// --- As sete necessidades (GDD 9.3) ---

export interface NeedState {
  have: number;
  need: number;
}

export type CampNeeds = Record<CampNeed, NeedState>;

/** Saque que a defesa evita num ataque ao acampamento desguarnecido. */
export function guardOf(plan: CampPlan): number {
  const small = readyOf(plan, "CALTROPS").length + readyOf(plan, "SENTRY").length;
  return Math.min(MAX_GUARD, PALISADE[plan.size].guard + readyOf(plan, "TOWER").length * TOWER_GUARD + small * SMALL_GUARD + (plan.ditch ? DITCH.guard : 0));
}

/** Leitos de cada barraca, pelo nível (barraca, barracão). */
export const BEDS_BY_LEVEL = [0, 1, 2];
export const KITCHEN_BY_LEVEL = [0, KITCHEN_COOKS, 5];
export const INFIRMARY_BY_LEVEL = [0, INFIRMARY_BEDS, 16];
export const LATRINE_CROWD = 30;

/**
 * As construções que funcionam: prontas e, se têm posto, com alguém nele. `working` vem de
 * `staffPosts` (campDays.ts); sem ele, toda construção pronta conta (os testes e o painel antigo).
 */
export type Working = ReadonlySet<string> | undefined;
export const works = (b: CampBuilding, working: Working) => isBuilt(b) && (working ? working.has(b.id) : !CAMP_BUILDINGS[b.kind].post || !b.off);
const workingOf = (plan: CampPlan, kind: CampKind, working: Working) => plan.buildings.filter((b) => b.kind === kind && works(b, working));

/** Leitos: um batalhão por barraca (dois por barracão). */
export const bedsOf = (plan: CampPlan) => readyOf(plan, "BARRACK").reduce((n, b) => n + (BEDS_BY_LEVEL[b.level] ?? 1), 0);
/** Batalhões que a fogueira e as cozinhas dão conta. */
export const cooksOf = (plan: CampPlan, working?: Working) =>
  (has(plan, "CAMPFIRE") ? FIRE_COOKS : 0) + workingOf(plan, "KITCHEN", working).reduce((n, b) => n + (KITCHEN_BY_LEVEL[b.level] ?? KITCHEN_COOKS), 0);
/** Leitos da enfermaria e do hospital. */
export const sickBedsOf = (plan: CampPlan, working?: Working) => workingOf(plan, "INFIRMARY", working).reduce((n, b) => n + (INFIRMARY_BY_LEVEL[b.level] ?? INFIRMARY_BEDS), 0);
/** Moral que as construções dão. */
export const moodOf = (plan: CampPlan, working?: Working) => plan.buildings.reduce((n, b) => n + (works(b, working) ? CAMP_BUILDINGS[b.kind].mood ?? 0 : 0), 0);
/** Oficinas funcionando. */
export const craftOf = (plan: CampPlan, working?: Working) => plan.buildings.filter((b) => CAMP_BUILDINGS[b.kind].craft && works(b, working)).length;
/** Funciona (pronta e com gente, se tiver posto)? */
export const running = (plan: CampPlan, kind: CampKind, working?: Working) => workingOf(plan, kind, working).length > 0;

export interface NeedsCtx {
  battalions: number;
  /** Batalhões e soldados no acampamento. */
  inCamp: number;
  soldiers: number;
  patients: number;
  fame: number;
  /** Batalhões no turno de guarda. */
  guards?: number;
  working?: Working;
}

/** Oficinas que o bando precisa: uma a cada 3 batalhões. */
export const craftNeed = (battalions: number) => Math.ceil(battalions / 3);
/** Cada batalhão no turno de guarda evita isto do saque. */
export const GUARD_SHIFT = 0.15;

export function needsOf(plan: CampPlan, ctx: NeedsCtx): CampNeeds {
  const w = ctx.working;
  return {
    BEDS: { have: bedsOf(plan), need: ctx.battalions },
    FOOD: { have: cooksOf(plan, w), need: ctx.inCamp },
    SALUBRITY: { have: crowdLimit(plan, BASE_CROWD), need: ctx.soldiers },
    CURE: { have: sickBedsOf(plan, w), need: ctx.patients },
    MORALE: { have: moodOf(plan, w), need: ctx.inCamp },
    // Quem tem fama atrai ataque: a partir de 10, espera-se uma defesa à altura
    SECURITY: { have: Math.min(MAX_GUARD, guardOf(plan) + (ctx.guards ?? 0) * GUARD_SHIFT), need: Math.min(MAX_GUARD, Math.max(0, ctx.fame - 5) / 60) },
    CRAFT: { have: craftOf(plan, w), need: craftNeed(ctx.battalions) },
  };
}

export const NEED_LABEL: Record<CampNeed, string> = {
  BEDS: "Leitos",
  FOOD: "Comida",
  SALUBRITY: "Salubridade",
  CURE: "Cura",
  MORALE: "Moral",
  SECURITY: "Segurança",
  CRAFT: "Ofício",
};

/** O que cada falta faz (o painel mostra ao lado da necessidade). */
export const NEED_SHORT: Record<CampNeed, string> = {
  BEDS: "quem dorme ao relento perde humor e adoece mais",
  FOOD: "quem come cru gasta 25% mais rações",
  SALUBRITY: "acampamento lotado vira doença",
  CURE: "ferido sem leito sara no ritmo do campo",
  MORALE: "o humor do acampamento cai, e a tropa sai para a luta com menos moral",
  SECURITY: "um ataque ao acampamento leva mais",
  CRAFT: "o equipamento gasto não é consertado",
};

/** Soldados que o acampamento aguenta antes de lotar, sem poço nem latrina (= HEALTH.CAMP_CROWD). */
export const BASE_CROWD = 60;

/** Quantos soldados o acampamento aguenta antes de lotar (o poço e a latrina ajudam). */
export const crowdLimit = (plan: CampPlan, base: number) => base + readyOf(plan, "WELL").length * WELL_CROWD + readyOf(plan, "LATRINE").length * LATRINE_CROWD;

// --- Tropas e tenentes liberados por construção (GDD 9.6) ---

/** Por que essa tropa não se recruta (null = pode). Saves antigos têm tudo o que já tinham. */
export function troopProblem(plan: CampPlan, troop: TroopType): string | null {
  if (plan.legacy) return null;
  switch (troop) {
    case "INFANTRY":
      return null;
    case "SPEARMEN":
      return ready(plan, "TRAINING") ? null : "Precisa do campo de treino";
    case "ARCHERS":
      return ready(plan, "ARCHERY") ? null : "Precisa do estande de tiro";
    case "JAVELINS":
      return readyLevel(plan, "ARCHERY") >= 2 ? null : "Precisa do estande de tiro, nível 2";
    case "HEAVY":
    case "CROSSBOW":
      return ready(plan, "FORGE") ? null : "Precisa da ferraria";
    case "CAVALRY":
      return ready(plan, "STABLE") ? null : "Precisa do estábulo";
    case "HORSE_ARCHERS":
      return ready(plan, "STABLE") && ready(plan, "RIDING") ? null : "Precisa do estábulo e do picadeiro";
    case "KNIGHTS":
      return "Precisa do estábulo, do picadeiro e da fortaleza (Marco 22, parte 3)";
  }
}

/** Vagas de tenente: uma por nível da tenda dos oficiais. */
export function lieutenantSlots(plan: CampPlan, cap: number): number {
  return plan.legacy ? cap : Math.min(cap, readyLevel(plan, "OFFICERS_TENT"));
}

/** Voluntários que o mastro atrai por dia e quantos esperam no máximo. */
export function volunteerRate(plan: CampPlan): { perDay: number; cap: number } {
  if (!ready(plan, "RECRUIT_MAST") && !ready(plan, "RECRUIT_POST")) return { perDay: 0, cap: 0 };
  const k = ready(plan, "RECRUIT_POST") && ready(plan, "RECRUIT_MAST") ? 2 : 1;
  return { perDay: VOLUNTEERS.PER_DAY * k, cap: VOLUNTEERS.CAP * k };
}

// --- Levantar e montar ---

/** Carga do acampamento inteiro nas carroças (a paliçada também viaja). */
export function planCargo(plan: CampPlan): number {
  return PALISADE[plan.size].cargo + plan.buildings.reduce((n, b) => n + (CAMP_BUILDINGS[b.kind].stays ? 0 : CAMP_BUILDINGS[b.kind].cargo), 0);
}

/** Na pressa de levantar, o que vai primeiro: a tenda, a fogueira, a paliçada, as barracas e o resto na ordem da planta. */
const PACK_FIRST: readonly CampKind[] = ["COMMAND_TENT", "CAMPFIRE", "BARRACK"];

/**
 * Levanta o acampamento: cabe nas carroças o que der, na ordem de importância. O que não cabe
 * (e o que é cavado, como o poço e o fosso) fica para trás. Sem lugar para a paliçada, o
 * acampamento volta a ser bivaque e o que ficaria fora dele também fica.
 */
export function packPlan(plan: CampPlan, wagons: number): { plan: CampPlan; left: CampBuilding[] } {
  let room = Math.max(0, wagons) * CARGO_PER_WAGON;
  const fixed = plan.buildings.filter((b) => CAMP_BUILDINGS[b.kind].fixed);
  room -= fixed.reduce((n, b) => n + CAMP_BUILDINGS[b.kind].cargo, 0);
  let size = plan.size;
  if (PALISADE[size].cargo > room) size = 10;
  else room -= PALISADE[size].cargo;
  const kept: CampBuilding[] = [...fixed];
  const left: CampBuilding[] = [];
  const rest = plan.buildings.filter((b) => !CAMP_BUILDINGS[b.kind].fixed);
  rest.sort((a, b) => {
    const pa = PACK_FIRST.indexOf(a.kind);
    const pb = PACK_FIRST.indexOf(b.kind);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });
  const h = size / 2;
  for (const b of rest) {
    const def = CAMP_BUILDINGS[b.kind];
    const k = def.size;
    const fits = b.x >= -h && b.y >= -h && b.x + k <= h && b.y + k <= h;
    if (def.stays || !fits || def.cargo > room || def.tier > (size > 10 ? 1 : 0)) {
      left.push(b);
      continue;
    }
    room -= def.cargo;
    kept.push(b);
  }
  // A tenda e a fogueira sempre vão; se ficaram fora do bivaque, voltam para perto do centro
  const out: CampPlan = { ...plan, size, ditch: false, buildings: [] };
  const moved: CampBuilding[] = [];
  for (const b of kept) {
    if (placeProblem(out, b.kind, b.x, b.y) === null) out.buildings.push(b);
    else if (CAMP_BUILDINGS[b.kind].fixed) moved.push(b);
    else left.push(b);
  }
  for (const b of moved) {
    const spot = freeSpot(out, b.kind);
    if (spot) out.buildings.push({ ...b, ...spot });
  }
  return { plan: out, left };
}

// --- Em pixels: a cena, o chão e o fosso usam a mesma conta ---

/** O quadrado do acampamento no mundo: centro, meio lado em pixels e o portão. */
export interface CampShape {
  cx: number;
  cy: number;
  half: number;
  gate: CampSide;
  /** Meia largura do vão do portão, em pixels. */
  gateHalf: number;
}

export function shapeOf(plan: Pick<CampPlan, "size" | "gate">, center: { x: number; y: number }): CampShape {
  return { cx: center.x, cy: center.y, half: halfOf(plan) * CELL, gate: plan.gate, gateHalf: CELL };
}

/** Retângulo, no mundo, de `k`×`k` células a partir da célula (x, y). */
export function cellRect(center: { x: number; y: number }, x: number, y: number, k = 1): { x: number; y: number; w: number; h: number } {
  return { x: center.x + x * CELL, y: center.y + y * CELL, w: k * CELL, h: k * CELL };
}

/** Centro, no mundo, da célula (x, y). */
export const cellCenter = (center: { x: number; y: number }, x: number, y: number) => ({ x: center.x + (x + 0.5) * CELL, y: center.y + (y + 0.5) * CELL });

/** Célula onde cai um ponto do mundo. */
export const cellAt = (center: { x: number; y: number }, p: { x: number; y: number }): [number, number] => [Math.floor((p.x - center.x) / CELL), Math.floor((p.y - center.y) / CELL)];

/** Dentro do quadrado (`pad` > 0 = mais para dentro)? */
export function insideShape(s: CampShape, p: { x: number; y: number }, pad = 0): boolean {
  const h = s.half - pad;
  return Math.abs(p.x - s.cx) <= h && Math.abs(p.y - s.cy) <= h;
}

/** O ponto está no vão do portão (na faixa da cerca, de dentro a fora)? */
export function onGate(s: CampShape, p: { x: number; y: number }, depth = 60): boolean {
  const dx = p.x - s.cx;
  const dy = p.y - s.cy;
  const near = (v: number) => Math.abs(v - s.half) <= depth;
  if (s.gate === "W") return near(-dx) && Math.abs(dy) <= s.gateHalf;
  if (s.gate === "E") return near(dx) && Math.abs(dy) <= s.gateHalf;
  if (s.gate === "N") return near(-dy) && Math.abs(dx) <= s.gateHalf;
  return near(dy) && Math.abs(dx) <= s.gateHalf;
}

/** Os pontos do meio do portão: por dentro e por fora (`out` px para fora da cerca). */
export function gatePoints(s: CampShape, out = 60): { inner: { x: number; y: number }; outer: { x: number; y: number }; angle: number } {
  const dir = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] }[s.gate];
  const at = (d: number) => ({ x: s.cx + dir[0] * d, y: s.cy + dir[1] * d });
  return { inner: at(s.half - out), outer: at(s.half + out), angle: Math.atan2(dir[1], dir[0]) };
}

/**
 * Os trechos da cerca: os quatro lados, com o vão do portão. Cada trecho é [x0, y0, x1, y1]
 * no mundo (horizontal ou vertical).
 */
export function fenceRuns(s: CampShape): [number, number, number, number][] {
  const { cx, cy, half: h, gateHalf: g } = s;
  const sides: Record<CampSide, [number, number, number, number]> = {
    N: [cx - h, cy - h, cx + h, cy - h],
    S: [cx - h, cy + h, cx + h, cy + h],
    W: [cx - h, cy - h, cx - h, cy + h],
    E: [cx + h, cy - h, cx + h, cy + h],
  };
  const out: [number, number, number, number][] = [];
  for (const side of CAMP_SIDES) {
    const [x0, y0, x1, y1] = sides[side];
    if (side !== s.gate) {
      out.push([x0, y0, x1, y1]);
      continue;
    }
    if (y0 === y1) out.push([x0, y0, cx - g, y1], [cx + g, y0, x1, y1]);
    else out.push([x0, y0, x1, cy - g], [x0, cy + g, x1, y1]);
  }
  return out;
}

// --- Começos ---

let seq = 0;
const nextId = (kind: CampKind) => `${kind.toLowerCase()}-${++seq}-${Math.floor(Math.random() * 1e6).toString(36)}`;
export const newBuilding = (kind: CampKind, x: number, y: number, level = 1): CampBuilding => ({ id: nextId(kind), kind, x, y, level });
/** Uma obra nova: precisa de `workOf(kind)` de trabalho para ficar pronta. */
export const newWork = (kind: CampKind, x: number, y: number): CampBuilding => ({ ...newBuilding(kind, x, y), built: 0 });

/** O começo humilde (GDD 9.9): a tenda, a fogueira e uma barraca, num bivaque de 10×10. */
export function startingPlan(): CampPlan {
  return {
    size: 10,
    gate: "W",
    ditch: false,
    buildings: [newBuilding("COMMAND_TENT", -1, -4), newBuilding("CAMPFIRE", -1, 0), newBuilding("BARRACK", 2, 0)],
  };
}

/** Lugares das barracas no acampamento de um save antigo. */
const LEGACY_BARRACKS: readonly [number, number][] = [[-10, 9], [-6, 9], [-2, 9], [2, 9], [6, 9], [10, 9]];

/**
 * Save de antes do Marco 22: o acampamento fixo de hoje vira peças na grade, com tudo o que já
 * tinha (as 6 construções, uma barraca por batalhão, a enfermaria, a cozinha e as obras).
 */
export function legacyPlan(battalions: number, works: readonly string[]): CampPlan {
  const b = (kind: CampKind, x: number, y: number, level = 1) => newBuilding(kind, x, y, level);
  const buildings: CampBuilding[] = [
    b("COMMAND_TENT", -2, -9),
    b("CAMPFIRE", -1, -1),
    b("QUARTERMASTER", -9, -2),
    b("RECRUIT_POST", 7, -2),
    b("RECRUIT_MAST", -3, -5),
    b("TRAINING", -11, 4),
    b("STABLE", 5, -8),
    b("FORGE", 9, 4),
    b("ARCHERY", -11, -10, 2),
    b("OFFICERS_TENT", -7, -9, 3),
    b("KITCHEN", 2, 2),
    b("INFIRMARY", -5, 2),
    b("INFIRMARY", -5, 6),
    b("WELL", 5, 6),
  ];
  const n = Math.max(1, Math.min(LEGACY_BARRACKS.length, battalions));
  for (let i = 0; i < n; i++) buildings.push(b("BARRACK", LEGACY_BARRACKS[i][0], LEGACY_BARRACKS[i][1]));
  if (works.includes("TOWERS")) buildings.push(b("TOWER", -13, -13), b("TOWER", 11, -13), b("TOWER", -13, 12));
  return { size: 28, gate: "W", ditch: works.includes("DITCH"), buildings, legacy: true };
}

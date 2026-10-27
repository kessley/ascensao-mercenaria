import { create } from "zustand";
import {
  BALANCE,
  ECONOMY,
  LIEUTENANTS,
  MUTINEER_OF,
  PROGRESSION,
  SUPPORT,
  TROOPS,
  type EnemyKind,
  type Formation,
  type GroupArrangement,
  type TerrainType,
  type TroopType,
} from "../utils/constants";
import { BATTLE_MAPS, mutinySetup, scaledSetup, type BattleSetup } from "../game/data/battleMaps";
import { DIFFICULTY, generateContract, generateContracts, type Contract } from "../game/data/contracts";
import { battalionWage, dailyRations, reinforceCostPerSoldier, weeklyWages } from "../utils/economy";
import { canLearn, forgeCost, gainXp, type EquipmentSlot } from "../utils/progression";
import { SKILLS, type SkillId } from "../game/data/skills";
import { fullName, generateLieutenant, opinionOn, PASSIVES, type LieutenantData } from "../game/data/lieutenants";
import {
  messengerLevelFor,
  newMessenger,
  newScout,
  supportWages,
  type MessengerData,
  type ScoutData,
} from "../game/data/riders";

export type Screen = "CAMP" | "BATTLE";

/** Painel aberto ao interagir com um local do acampamento. */
export type CampPanel =
  | { kind: "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE" }
  | { kind: "BATTALION"; battalionId: string }
  | { kind: "LIEUTENANT"; lieutenantId: string }
  | { kind: "STABLE" };

/** Dados persistentes de um batalhão (sobrevivem entre batalhas). */
export interface BattalionData {
  id: string;
  name: string;
  troopType: TroopType;
  /** Última formação usada; o batalhão entra na próxima batalha com ela. */
  formation: Formation;
  level: number;
  /** XP acumulada no nível atual. */
  xp: number;
  skillPoints: number;
  skills: SkillId[];
  /** Tiers de equipamento (0 a MAX_EQUIPMENT_TIER), forjados na Ferraria. */
  equipment: Record<EquipmentSlot, number>;
  /** Inimigos abatidos em toda a carreira (história do batalhão). */
  totalKills: number;
  soldiers: number;
  maxSoldiers: number;
}

export type BattalionStatus = "READY" | "MOVING" | "ENGAGED" | "FLEEING" | "DESTROYED";

/** Snapshot publicado pela BattleScene (~10 Hz) para o HUD React. */
export interface BattleHud {
  commanderHp: number;
  commanderMaxHp: number;
  battalions: {
    id: string;
    name: string;
    troopType: TroopType;
    formation: Formation;
    /** Terreno sob o centro do batalhão. */
    terrain: TerrainType;
    level: number;
    /** Abates nesta batalha (viram XP no fim). */
    kills: number;
    lieutenant: { name: string; alive: boolean; kills: number } | null;
    alive: number;
    max: number;
    morale: number;
    status: BattalionStatus;
    selected: boolean;
    /** Dentro do raio de comando (ordens instantâneas)? */
    inCommand: boolean;
    /** Melhor meio sem mensageiro: voz (tudo), trombeta (toques), estandarte (sinais) ou nenhum. */
    reach: CommandReach;
    /** Enxerga o estandarte do Comandante (coesão)? */
    seesBanner: boolean;
    /** Ordem a caminho por mensageiro. */
    pendingOrder: string | null;
  }[];
  scouts: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    mode: "VANGUARD" | "EXPLORE" | "RECALL";
    alive: boolean;
    selected: boolean;
    fleeing: boolean;
  }[];
  messengers: { id: string; name: string; level: number; state: "IDLE" | "OUTBOUND" | "RETURNING" | "DEAD" }[];
  /** Últimos acontecimentos (mensageiros, interceptações...). */
  feed: string[];
  /** Situação de batedores/mensageiros (usada também no recuo). */
  support: SupportReport;
  /** Câmera presa no Comandante ou solta; zoom atual. */
  camera: { locked: boolean; zoom: number };
  /** Segundos até o próximo grito de guerra (0 = pronto). */
  warCryIn: number;
  /** Comandante muito ferido: o estandarte vacila. */
  bannerFaltering: boolean;
  enemiesAlive: number;
  enemiesTotal: number;
}

export type BattleResult = "VICTORY" | "DEFEAT" | "RETREAT";

export interface BattleReport {
  result: BattleResult;
  title: string;
  goldEarned: number;
  /** Saque dos inimigos (só em contrato vencido). */
  loot: { gold: number; iron: number };
  casualties: number;
  /** Experiência ganha por batalhão sobrevivente (e novo nível, se subiu). */
  xpGains: { name: string; xp: number; kills: number; newLevel?: number }[];
  /** Batalhões dizimados: perdidos para sempre (permadeath). */
  lostBattalions: string[];
  /** Consequências extras (motim, ouro roubado...). */
  notes: string[];
}

export interface BattalionSurvivors {
  id: string;
  survivors: number;
  formation?: Formation;
  kills?: number;
  /** Destino do tenente que comandava o batalhão (se havia um). */
  lieutenantAlive?: boolean;
  lieutenantKills?: number;
}

/** O que aconteceu com batedores e mensageiros numa batalha. */
export interface SupportReport {
  deadScoutIds: string[];
  deadMessengerIds: string[];
  /** Entregas feitas por mensageiro (id → quantidade). */
  deliveries: Record<string, number>;
}

/** Batalha em andamento: um contrato ou o motim. */
export type CurrentBattle =
  | { kind: "CONTRACT"; setup: BattleSetup; contract: Contract }
  | { kind: "MUTINY"; setup: BattleSetup; rebel: BattalionData };

export type LogTone = "info" | "good" | "bad";
export interface LogEntry {
  id: number;
  day: number;
  text: string;
  tone: LogTone;
}

/**
 * Comandos que a UI React envia à BattleScene (consumidos a cada frame).
 * As ordens valem para um ou vários batalhões (`ids`).
 * - CHARGE: cada batalhão ataca o inimigo mais próximo dele.
 * - FOCUS: todos atacam o mesmo inimigo (o mais próximo do centro do grupo).
 * - ARRANGEMENT: reorganiza o grupo conforme o arranjo (e o guarda como preferência).
 */
export type BattleCommand =
  | { type: "FOLLOW" | "HOLD" | "CHARGE" | "FOCUS"; ids: string[] }
  | { type: "FORMATION"; ids: string[]; formation: Formation }
  | { type: "ARRANGEMENT"; ids: string[]; arrangement: GroupArrangement }
  | { type: "SELECT"; ids: string[]; additive: boolean }
  | { type: "SELECT_SCOUT"; ids: string[]; additive: boolean }
  | { type: "SCOUT_MODE"; ids: string[]; mode: "VANGUARD" | "RECALL" }
  | { type: "CAMERA"; ids: string[]; action: "TOGGLE" | "CENTER" }
  /** Toque de trombeta pré-combinado para os batalhões `ids` (vazio = todo o exército). */
  | { type: "TRUMPET"; ids: string[]; call: TrumpetCall }
  | { type: "WAR_CRY"; ids: string[] };

/** Toques de trombeta combinados de antemão (só ordens básicas viajam pelo som). */
export type TrumpetCall = "ADVANCE" | "HALT" | "CHARGE" | "RETREAT" | "RALLY";

/** Por qual meio as ordens alcançam um batalhão sem mensageiro. */
export type CommandReach = "VOICE" | "TRUMPET" | "BANNER" | "NONE";

/** Menu de contexto aberto pelo botão direito sobre um ou vários batalhões (coordenadas da tela). */
export interface BattalionContextMenu {
  battalionIds: string[];
  x: number;
  y: number;
}

export interface GameState {
  currentScreen: Screen;

  // --- Acampamento e economia ---
  day: number;
  gold: number;
  rations: number;
  /** Ferro (saque e comércio), usado na Ferraria. */
  iron: number;
  /** Dias seguidos sem comida (reduz a moral inicial). */
  hungryDays: number;
  /** Salários devidos e não pagos. */
  debt: number;
  /** Semanas seguidas de salário atrasado (deserção; motim ao chegar em MUTINY_AFTER_WEEKS). */
  arrearsWeeks: number;
  /** Motim estourou: precisa ser resolvido antes de aceitar contratos. */
  pendingMutiny: boolean;
  battalions: BattalionData[];
  /** Tenentes contratados (lideram batalhões; têm personalidade, lealdade e crônica). */
  lieutenants: LieutenantData[];
  /** Candidatos a tenente no Posto de Recrutamento (renovados a cada volta de contrato). */
  lieutenantCandidates: LieutenantData[];
  /** Batedores e mensageiros a cavalo (Estábulo). */
  scouts: ScoutData[];
  messengers: MessengerData[];
  contracts: Contract[];
  log: LogEntry[];

  // --- Batalha ---
  currentBattle: CurrentBattle | null;
  battleHud: BattleHud | null;
  battleReport: BattleReport | null;
  contextMenu: BattalionContextMenu | null;
  battleCommands: BattleCommand[];
  /** Arranjo preferido para grupos de batalhões (persiste entre batalhas). */
  groupArrangement: GroupArrangement;

  // --- Ações do acampamento ---
  recruitBattalion: (troopType: TroopType) => boolean;
  /** Repõe soldados perdidos (até onde o ouro alcançar). */
  reinforceBattalion: (id: string) => boolean;
  buyRations: (packs: number) => boolean;
  payDebt: () => boolean;
  /** Aceita o contrato: recebe o adiantamento, marcha os dias de viagem e entra na batalha. */
  acceptContract: (id: string) => boolean;
  /** Enfrenta os amotinados (quando não há ouro para pagar os atrasados). */
  confrontMutiny: () => void;

  // --- Progressão (Marco 4) ---
  /** Treina os batalhões no Campo de Treino: passam os dias de treino e cada um ganha XP. */
  trainBattalions: (ids: string[]) => boolean;
  learnSkill: (battalionId: string, skill: SkillId) => boolean;
  /** Forja o próximo tier de arma ou armadura (ouro + ferro). */
  forgeEquipment: (battalionId: string, slot: EquipmentSlot) => boolean;
  tradeIron: (amount: number) => boolean;

  // --- Tenentes (Marco 5) ---
  hireLieutenant: (candidateId: string) => boolean;
  /** Põe o tenente no comando do batalhão (o comandante anterior fica sem batalhão); null = dispensa do comando. */
  assignLieutenant: (lieutenantId: string, battalionId: string | null) => void;
  dismissLieutenant: (lieutenantId: string) => void;

  // --- Estábulo (Marco 6) ---
  hireScout: () => boolean;
  hireMessenger: () => boolean;

  // --- Batalha ---
  setBattleHud: (hud: BattleHud) => void;
  /** Aplica baixas, recompensas e consequências. Batalhões com 0 sobreviventes são removidos. */
  endBattle: (result: BattleResult, survivors: BattalionSurvivors[], support?: SupportReport) => void;
  /** Recuo pelo HUD: usa as baixas do último snapshot do HUD. */
  retreat: () => void;
  /** Volta ao acampamento (gasta o dia de retorno). */
  returnToCamp: () => void;

  // --- Acampamento explorável ---
  /** Painel aberto (ex.: mesa estratégica ao entrar na tenda); null = andando pelo acampamento. */
  campPanel: CampPanel | null;
  /** Aviso de interação mostrado no HUD (ex.: "E — Tenda do Comandante"). */
  campPrompt: string | null;
  setCampPanel: (panel: CampPanel | null) => void;
  setCampPrompt: (prompt: string | null) => void;

  setContextMenu: (menu: BattalionContextMenu | null) => void;
  sendBattleCommand: (command: BattleCommand) => void;
  /** Retira e devolve os comandos pendentes (usado pela BattleScene). */
  drainBattleCommands: () => BattleCommand[];
  setGroupArrangement: (arrangement: GroupArrangement) => void;
}

const BATTALION_NAMES = [
  "Lanças Cinzentas",
  "Corvos de Ferro",
  "Lâminas do Vau",
  "Escudos Partidos",
  "Lobos da Charneca",
  "Martelos Rubros",
];

function newBattalion(existing: BattalionData[], troopType: TroopType): BattalionData {
  const used = new Set(existing.map((b) => b.name));
  const name = BATTALION_NAMES.find((n) => !used.has(n)) ?? `Companhia ${existing.length + 1}`;
  return {
    id: crypto.randomUUID(),
    name,
    troopType,
    formation: TROOPS[troopType].formations[0],
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: [],
    equipment: { weapon: 0, armor: 0 },
    totalKills: 0,
    soldiers: BALANCE.BATTALION_SIZE,
    maxSoldiers: BALANCE.BATTALION_SIZE,
  };
}

/** Bando inicial: uma infantaria e uma companhia de arqueiros. */
function initialArmy(): BattalionData[] {
  const army: BattalionData[] = [];
  army.push(newBattalion(army, "INFANTRY"));
  army.push(newBattalion(army, "ARCHERS"));
  return army;
}

let logSeq = 0;
function entry(day: number, text: string, tone: LogTone = "info"): LogEntry {
  return { id: ++logSeq, day, text, tone };
}

/** Parte do estado que a passagem dos dias altera. */
type DayState = Pick<
  GameState,
  | "day"
  | "gold"
  | "rations"
  | "hungryDays"
  | "debt"
  | "arrearsWeeks"
  | "pendingMutiny"
  | "battalions"
  | "lieutenants"
  | "scouts"
  | "messengers"
>;

const addHistory = (history: string[], line: string) => [...history, line].slice(-LIEUTENANTS.HISTORY_SIZE);

/**
 * Aplica mudanças de lealdade (Leais perdem pela metade). Quem cair até LOYALTY_DESERT_AT
 * abandona o bando. `why` vai para a crônica pessoal de cada tenente afetado.
 */
function applyLoyalty(
  lieutenants: readonly LieutenantData[],
  delta: (l: LieutenantData) => number,
  day: number,
  why: string,
): { lieutenants: LieutenantData[]; log: LogEntry[] } {
  const log: LogEntry[] = [];
  const out: LieutenantData[] = [];
  for (const l of lieutenants) {
    let d = delta(l);
    if (d < 0 && l.traits.includes("LOYAL")) d = Math.trunc(d / 2);
    if (d === 0) {
      out.push(l);
      continue;
    }
    const loyalty = Math.max(0, Math.min(100, l.loyalty + d));
    if (loyalty <= LIEUTENANTS.LOYALTY_DESERT_AT) {
      log.push(entry(day, `${fullName(l)} perdeu a fé no Comandante e abandonou o bando (${why}).`, "bad"));
      continue;
    }
    out.push({ ...l, loyalty, history: addHistory(l.history, `Dia ${day}: ${why} (${d > 0 ? "+" : ""}${d} lealdade).`) });
  }
  return { lieutenants: out, log };
}

/**
 * Avança `days` dias: consome rações, controla a fome e, no dia de pagamento,
 * paga salários ou gera dívida, deserção e motim. Função pura: devolve o novo estado e o diário.
 */
function passDays(start: DayState, days: number): { state: DayState; log: LogEntry[] } {
  const s: DayState = { ...start, battalions: start.battalions.map((b) => ({ ...b })), lieutenants: [...start.lieutenants] };
  const log: LogEntry[] = [];

  for (let i = 0; i < days; i++) {
    s.day++;

    // Comida
    const need = dailyRations(s.battalions);
    if (s.rations >= need) {
      s.rations -= need;
      if (s.hungryDays > 0) log.push(entry(s.day, "O exército voltou a comer. A fome acabou.", "good"));
      s.hungryDays = 0;
    } else {
      s.rations = 0;
      s.hungryDays++;
      log.push(entry(s.day, `Sem rações! ${s.hungryDays} dia(s) de fome: a moral vai despencar.`, "bad"));
    }

    // Pagamento
    if (s.day % ECONOMY.PAYDAY_INTERVAL !== 0) continue;

    // Ambiciosos sem batalhão se ressentem a cada semana
    const idle = applyLoyalty(
      s.lieutenants,
      (l) => (l.traits.includes("AMBITIOUS") && !l.battalionId ? LIEUTENANTS.LOYALTY.UNASSIGNED_AMBITIOUS : 0),
      s.day,
      "mais uma semana sem comando",
    );
    s.lieutenants = idle.lieutenants;
    log.push(...idle.log);

    const wages = weeklyWages(s.battalions, s.lieutenants) + supportWages(s.scouts.length, s.messengers.length);
    if (wages === 0) continue;
    const due = wages + s.debt;
    if (s.gold >= due) {
      s.gold -= due;
      log.push(
        entry(s.day, `Dia de pagamento: ${due} de ouro${s.debt > 0 ? " (incluindo atrasados)" : ""}.`, "good"),
      );
      s.debt = 0;
      s.arrearsWeeks = 0;
      continue;
    }

    s.debt += wages;
    s.arrearsWeeks++;
    const deserted: string[] = [];
    for (const b of s.battalions) {
      const lost = Math.max(1, Math.round(b.soldiers * ECONOMY.DESERTION_RATE));
      b.soldiers = Math.max(0, b.soldiers - lost);
      deserted.push(`${b.name} −${lost}`);
    }
    const gone = s.battalions.filter((b) => b.soldiers === 0).map((b) => b.name);
    s.battalions = s.battalions.filter((b) => b.soldiers > 0);
    log.push(
      entry(s.day, `Salários atrasados (dívida: ${s.debt}). Deserções: ${deserted.join(", ")}.`, "bad"),
    );
    if (gone.length) log.push(entry(s.day, `${gone.join(", ")} desertou por completo.`, "bad"));
    s.lieutenants = unassignMissing(s.lieutenants, s.battalions);

    const unpaid = applyLoyalty(
      s.lieutenants,
      (l) =>
        LIEUTENANTS.LOYALTY.PAYDAY_MISSED + (l.traits.includes("GREEDY") ? LIEUTENANTS.LOYALTY.PAYDAY_MISSED_GREEDY : 0),
      s.day,
      "salário atrasado",
    );
    s.lieutenants = unpaid.lieutenants;
    log.push(...unpaid.log);

    if (s.arrearsWeeks >= ECONOMY.MUTINY_AFTER_WEEKS && s.battalions.length > 0 && !s.pendingMutiny) {
      s.pendingMutiny = true;
      log.push(entry(s.day, "MOTIM! As tropas exigem os atrasados ou pegarão em armas.", "bad"));
    }
  }
  return { state: s, log };
}

function dayState(s: GameState): DayState {
  return {
    day: s.day,
    gold: s.gold,
    rations: s.rations,
    hungryDays: s.hungryDays,
    debt: s.debt,
    arrearsWeeks: s.arrearsWeeks,
    pendingMutiny: s.pendingMutiny,
    battalions: s.battalions,
    lieutenants: s.lieutenants,
    scouts: s.scouts,
    messengers: s.messengers,
  };
}

/** Tenentes cujo batalhão deixou de existir ficam sem comando. */
function unassignMissing(lieutenants: LieutenantData[], battalions: readonly BattalionData[]): LieutenantData[] {
  return lieutenants.map((l) =>
    l.battalionId && !battalions.some((b) => b.id === l.battalionId) ? { ...l, battalionId: null } : l,
  );
}

const appendLog = (log: LogEntry[], entries: LogEntry[]) => [...log, ...entries].slice(-ECONOMY.LOG_SIZE);

/** Batalhão que lidera o motim: o maior (mais soldados insatisfeitos). */
export function mutinyLeader(battalions: readonly BattalionData[]): BattalionData | null {
  return battalions.reduce<BattalionData | null>((best, b) => (!best || b.soldiers > best.soldiers ? b : best), null);
}

const START_ARMY = initialArmy();
/** O primeiro tenente: acompanha o Comandante desde o início e comanda a infantaria. */
const START_LIEUTENANT: LieutenantData = (() => {
  const l = generateLieutenant(1);
  return {
    ...l,
    loyalty: Math.max(l.loyalty, 65),
    battalionId: START_ARMY[0].id,
    history: [`Dia 1: está ao lado do Comandante desde a fundação do bando.`],
  };
})();

/**
 * Ponte de estado entre React e Phaser.
 * - React: use o hook com seletores, ex. `useGameStore((s) => s.gold)`.
 * - Phaser: use `useGameStore.getState()` e `useGameStore.subscribe(...)` (fora do ciclo de render).
 */
export const useGameStore = create<GameState>()((set, get) => ({
  currentScreen: "CAMP",

  day: 1,
  gold: ECONOMY.START_GOLD,
  rations: ECONOMY.START_RATIONS,
  iron: PROGRESSION.START_IRON,
  hungryDays: 0,
  debt: 0,
  arrearsWeeks: 0,
  pendingMutiny: false,
  battalions: START_ARMY,
  lieutenants: [START_LIEUTENANT],
  lieutenantCandidates: Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(1)),
  scouts: Array.from({ length: SUPPORT.START_SCOUTS }, newScout),
  messengers: Array.from({ length: SUPPORT.START_MESSENGERS }, newMessenger),
  contracts: generateContracts(ECONOMY.CONTRACTS_OFFERED),
  log: [entry(1, "O bando montou acampamento. Entre na tenda do Comandante para escolher um contrato.")],

  currentBattle: null,
  battleHud: null,
  battleReport: null,
  contextMenu: null,
  battleCommands: [],
  groupArrangement: "ARCHERS_BACK",

  recruitBattalion: (troopType) => {
    const { gold, battalions, day, log } = get();
    const cost = TROOPS[troopType].cost;
    if (gold < cost) return false;
    const b = newBattalion(battalions, troopType);
    set({
      gold: gold - cost,
      battalions: [...battalions, b],
      log: appendLog(log, [entry(day, `Recrutado: ${b.name} (${TROOPS[troopType].label}) por ${cost} de ouro.`)]),
    });
    return true;
  },

  reinforceBattalion: (id) => {
    const { gold, battalions, day, log } = get();
    const b = battalions.find((x) => x.id === id);
    if (!b) return false;
    const per = reinforceCostPerSoldier(b);
    const count = Math.min(b.maxSoldiers - b.soldiers, Math.floor(gold / per));
    if (count <= 0) return false;
    set({
      gold: gold - count * per,
      battalions: battalions.map((x) => (x.id === id ? { ...x, soldiers: x.soldiers + count } : x)),
      log: appendLog(log, [entry(day, `${b.name} recebeu ${count} recruta(s) por ${count * per} de ouro.`)]),
    });
    return true;
  },

  buyRations: (packs) => {
    const { gold, rations, day, log } = get();
    const cost = packs * ECONOMY.RATION_PACK_PRICE;
    if (packs <= 0 || gold < cost) return false;
    const amount = packs * ECONOMY.RATION_PACK_SIZE;
    set({
      gold: gold - cost,
      rations: rations + amount,
      log: appendLog(log, [entry(day, `Compradas ${amount} rações por ${cost} de ouro.`)]),
    });
    return true;
  },

  payDebt: () => {
    const { gold, debt, day, log, pendingMutiny } = get();
    if (debt <= 0 || gold < debt) return false;
    set({
      gold: gold - debt,
      debt: 0,
      arrearsWeeks: 0,
      pendingMutiny: false,
      log: appendLog(log, [
        entry(day, `Atrasados pagos: ${debt} de ouro.${pendingMutiny ? " O motim foi contido." : ""}`, "good"),
      ]),
    });
    return true;
  },

  acceptContract: (id) => {
    const s = get();
    const contract = s.contracts.find((c) => c.id === id);
    if (!contract || s.pendingMutiny) return false;

    const intro = [
      entry(s.day, `Contrato aceito: "${contract.title}" para ${contract.client}. Adiantamento: ${contract.advance}.`),
    ];
    // O conselho reage à escolha do Comandante
    const council = applyLoyalty(
      s.lieutenants,
      (l) => {
        const o = opinionOn(l, contract);
        if (!o) return 0;
        return o.stance === "APPROVE" ? LIEUTENANTS.LOYALTY.CONTRACT_APPROVED : LIEUTENANTS.LOYALTY.CONTRACT_DISAPPROVED;
      },
      s.day,
      `opinião sobre o contrato "${contract.title}"`,
    );
    for (const l of s.lieutenants) {
      const o = opinionOn(l, contract);
      if (o) {
        intro.push(
          entry(s.day, `${fullName(l)} ${o.stance === "APPROVE" ? "aprovou" : "desaprovou"} a escolha: ${o.reason}.`, o.stance === "APPROVE" ? "good" : "bad"),
        );
      }
    }
    intro.push(...council.log, entry(s.day, `Marcha de ${contract.travelDays} dia(s) até o local.`));
    const { state, log } = passDays(
      { ...dayState(s), gold: s.gold + contract.advance, lieutenants: council.lieutenants },
      contract.travelDays,
    );
    const setup = scaledSetup(BATTLE_MAPS[contract.mapId], DIFFICULTY[contract.difficulty].enemyMultiplier);

    set({
      ...state,
      contracts: [...s.contracts.filter((c) => c.id !== id), generateContract()],
      log: appendLog(s.log, [...intro, ...log]),
      currentBattle: { kind: "CONTRACT", setup, contract },
      battleHud: null,
      battleReport: null,
      campPanel: null,
      campPrompt: null,
      currentScreen: "BATTLE",
    });
    return true;
  },

  confrontMutiny: () => {
    const s = get();
    const rebel = mutinyLeader(s.battalions);
    if (!s.pendingMutiny || !rebel) return;

    // O tenente do batalhão rebelado escolhe um lado conforme a lealdade
    const entries = [entry(s.day, `${rebel.name} pegou em armas contra o Comandante!`, "bad")];
    const leader = s.lieutenants.find((l) => l.battalionId === rebel.id);
    let lieutenants = s.lieutenants;
    const units: [EnemyKind, number][] = [[MUTINEER_OF[rebel.troopType], rebel.soldiers]];
    if (leader && leader.loyalty < 50) {
      lieutenants = lieutenants.filter((l) => l.id !== leader.id);
      units.push([MUTINEER_OF[rebel.troopType], 1]);
      entries.push(entry(s.day, `${fullName(leader)} ficou do lado dos amotinados.`, "bad"));
    } else if (leader) {
      lieutenants = lieutenants.map((l) =>
        l.id === leader.id
          ? { ...l, battalionId: null, history: addHistory(l.history, `Dia ${s.day}: ficou ao lado do Comandante quando ${rebel.name} se amotinou.`) }
          : l,
      );
      entries.push(entry(s.day, `${fullName(leader)} recusou o motim e ficou ao lado do Comandante.`, "good"));
    }

    set({
      // O batalhão rebelado sai do exército e vira inimigo
      battalions: s.battalions.filter((b) => b.id !== rebel.id),
      lieutenants,
      pendingMutiny: false,
      log: appendLog(s.log, entries),
      currentBattle: {
        kind: "MUTINY",
        setup: mutinySetup(units),
        rebel,
      },
      battleHud: null,
      battleReport: null,
      campPanel: null,
      campPrompt: null,
      currentScreen: "BATTLE",
    });
  },

  setBattleHud: (hud) => set({ battleHud: hud }),

  endBattle: (result, survivors, support) => {
    const s = get();
    if (s.battleReport || !s.currentBattle) return; // já encerrada

    const byId = new Map(survivors.map((x) => [x.id, x]));
    let casualties = 0;
    const lostBattalions: string[] = [];
    const remaining: BattalionData[] = [];
    const xpGains: BattleReport["xpGains"] = [];
    const logEntries: LogEntry[] = [];

    for (const b of s.battalions) {
      const report = byId.get(b.id);
      const alive = report?.survivors ?? b.soldiers;
      casualties += b.soldiers - alive;
      if (alive <= 0) {
        lostBattalions.push(b.name);
        continue;
      }
      // Experiência: abates + sobreviver + vencer (tenente Instrutor vivo dá bônus)
      const kills = report?.kills ?? 0;
      const leader = s.lieutenants.find((l) => l.battalionId === b.id);
      const xpMult = leader && report?.lieutenantAlive !== false ? (PASSIVES[leader.passive].xp ?? 1) : 1;
      const xp = Math.round(
        (kills * PROGRESSION.XP_PER_KILL +
          PROGRESSION.XP_PARTICIPATION +
          (result === "VICTORY" ? PROGRESSION.XP_VICTORY : 0)) *
          xpMult,
      );
      const { battalion, levelsGained } = gainXp(
        { ...b, soldiers: alive, formation: report?.formation ?? b.formation, totalKills: b.totalKills + kills },
        xp,
      );
      remaining.push(battalion);
      xpGains.push({ name: b.name, xp, kills, newLevel: levelsGained > 0 ? battalion.level : undefined });
      if (levelsGained > 0) {
        logEntries.push(entry(s.day, `${b.name} subiu para o nível ${battalion.level}!`, "good"));
      }
    }

    const battle = s.currentBattle;
    const notes: string[] = [];
    let gold = s.gold;
    let iron = s.iron;
    let goldEarned = 0;
    let loot = { gold: 0, iron: 0 };
    let debt = s.debt;
    let arrearsWeeks = s.arrearsWeeks;
    let title: string;

    if (battle.kind === "CONTRACT") {
      title = battle.contract.title;
      if (result === "VICTORY") {
        goldEarned = battle.contract.reward;
        // Saque dos inimigos derrotados
        const enemies = battle.setup.enemyGroups.reduce((n, g) => n + g.units.reduce((m, [, c]) => m + c, 0), 0);
        loot = {
          gold: enemies * PROGRESSION.LOOT_GOLD_PER_ENEMY,
          iron: Math.floor(enemies * PROGRESSION.LOOT_IRON_PER_ENEMY),
        };
        gold += goldEarned + loot.gold;
        iron += loot.iron;
        logEntries.push(entry(s.day, `Contrato cumprido: "${title}". Bônus: ${goldEarned} de ouro.`, "good"));
        logEntries.push(entry(s.day, `Saque: ${loot.gold} de ouro e ${loot.iron} de ferro.`, "good"));
      } else {
        notes.push("Contrato não cumprido: sem o bônus (o adiantamento fica).");
        logEntries.push(entry(s.day, `Contrato fracassado: "${title}".`, "bad"));
      }
    } else {
      title = "Motim";
      // Os atrasados devidos aos rebeldes deixam de existir; o exemplo restaura a ordem
      const rebelShare = battalionWage(battle.rebel) * s.arrearsWeeks;
      debt = Math.max(0, debt - rebelShare);
      arrearsWeeks = 0;
      if (result === "VICTORY") {
        notes.push(`${battle.rebel.name} foi esmagado. A ordem voltou ao acampamento.`);
        logEntries.push(entry(s.day, `Motim esmagado: ${battle.rebel.name} não existe mais.`, "good"));
      } else {
        const stolen = Math.floor(gold * ECONOMY.MUTINY_GOLD_LOSS);
        gold -= stolen;
        notes.push(`Os amotinados fugiram levando ${stolen} de ouro.`);
        logEntries.push(entry(s.day, `Os amotinados fugiram com ${stolen} de ouro.`, "bad"));
      }
    }
    if (lostBattalions.length) {
      logEntries.push(entry(s.day, `Perdidos para sempre: ${lostBattalions.join(", ")}.`, "bad"));
    }

    // --- Tenentes: destino em campo, crônica e lealdade ---
    const outcome = result === "VICTORY" ? "vitória" : result === "DEFEAT" ? "derrota" : "recuo";
    let lieutenants: LieutenantData[] = [];
    const orphaned = new Set<string>();
    for (const l of s.lieutenants) {
      const report = l.battalionId ? byId.get(l.battalionId) : undefined;
      const battalion = s.battalions.find((b) => b.id === l.battalionId);
      if (!report || !battalion) {
        lieutenants.push(l);
        continue;
      }
      if (report.lieutenantAlive === false) {
        notes.push(`${fullName(l)} morreu em combate liderando ${battalion.name}.`);
        logEntries.push(entry(s.day, `${fullName(l)} tombou liderando ${battalion.name}. Descanse em paz.`, "bad"));
        continue;
      }
      const lk = report.lieutenantKills ?? 0;
      let line = `Dia ${s.day}: liderou ${battalion.name} em "${title}" (${outcome}${lk ? `, ${lk} abate${lk === 1 ? "" : "s"}` : ""}).`;
      let next: LieutenantData = { ...l, kills: l.kills + lk };
      if (lostBattalions.includes(battalion.name)) {
        line = `Dia ${s.day}: sobreviveu ao massacre de ${battalion.name} em "${title}".`;
        next = { ...next, battalionId: null };
        orphaned.add(l.id);
        notes.push(`${fullName(l)} sobreviveu, mas ${battalion.name} foi dizimado.`);
      }
      lieutenants.push({ ...next, history: addHistory(next.history, line) });
    }
    const morale = applyLoyalty(
      lieutenants,
      (l) => {
        const L = LIEUTENANTS.LOYALTY;
        let d = orphaned.has(l.id) ? L.BATTALION_LOST : 0;
        if (result === "VICTORY") d += L.VICTORY + (l.traits.includes("BRAVE") || l.traits.includes("BLOODTHIRSTY") ? L.VICTORY_BRAVE : 0);
        else if (result === "DEFEAT") d += L.DEFEAT;
        else {
          d += L.RETREAT;
          if (l.traits.includes("HONORABLE")) d += L.RETREAT_HONORABLE;
          if (l.traits.includes("CAUTIOUS")) d += L.RETREAT_CAUTIOUS;
        }
        return d;
      },
      s.day,
      `${outcome} em "${title}"`,
    );
    lieutenants = morale.lieutenants;
    logEntries.push(...morale.log);

    // --- Batedores e mensageiros: baixas, missões e nível de comando ---
    const scouts = s.scouts
      .filter((x) => {
        if (!support?.deadScoutIds.includes(x.id)) return true;
        notes.push(`O batedor ${x.name} foi abatido.`);
        logEntries.push(entry(s.day, `O batedor ${x.name} caiu em "${title}".`, "bad"));
        return false;
      })
      .map((x) => ({ ...x, missions: x.missions + 1 }));
    const messengers = s.messengers
      .filter((x) => {
        if (!support?.deadMessengerIds.includes(x.id)) return true;
        notes.push(`O mensageiro ${x.name} foi interceptado e morto.`);
        logEntries.push(entry(s.day, `O mensageiro ${x.name} foi interceptado e morto em "${title}".`, "bad"));
        return false;
      })
      .map((x) => {
        const deliveries = x.deliveries + (support?.deliveries[x.id] ?? 0);
        const level = messengerLevelFor(deliveries);
        if (level > x.level) {
          logEntries.push(entry(s.day, `O mensageiro ${x.name} ganhou autoridade: nível de comando ${level}.`, "good"));
        }
        return { ...x, deliveries, level };
      });

    set({
      gold,
      iron,
      debt,
      arrearsWeeks,
      battalions: remaining,
      lieutenants,
      scouts,
      messengers,
      log: appendLog(s.log, logEntries),
      battleReport: { result, title, goldEarned, loot, casualties, lostBattalions, xpGains, notes },
    });
  },

  retreat: () => {
    const hud = get().battleHud;
    get().endBattle(
      "RETREAT",
      hud?.battalions.map((b) => ({
        id: b.id,
        survivors: b.alive,
        formation: b.formation,
        kills: b.kills,
        lieutenantAlive: b.lieutenant?.alive,
        lieutenantKills: b.lieutenant?.kills,
      })) ?? [],
      hud?.support,
    );
  },

  hireScout: () => {
    const s = get();
    if (s.gold < SUPPORT.SCOUT.COST || s.scouts.length >= SUPPORT.SCOUT.MAX) return false;
    const scout = newScout();
    set({
      gold: s.gold - SUPPORT.SCOUT.COST,
      scouts: [...s.scouts, scout],
      log: appendLog(s.log, [entry(s.day, `O batedor ${scout.name} entrou para o bando.`)]),
    });
    return true;
  },

  hireMessenger: () => {
    const s = get();
    if (s.gold < SUPPORT.MESSENGER.COST || s.messengers.length >= SUPPORT.MESSENGER.MAX) return false;
    const messenger = newMessenger();
    set({
      gold: s.gold - SUPPORT.MESSENGER.COST,
      messengers: [...s.messengers, messenger],
      log: appendLog(s.log, [entry(s.day, `O mensageiro ${messenger.name} entrou para o bando.`)]),
    });
    return true;
  },

  trainBattalions: (ids) => {
    const s = get();
    const trainees = s.battalions.filter((b) => ids.includes(b.id) && b.level < PROGRESSION.MAX_LEVEL);
    const cost = trainees.length * PROGRESSION.TRAINING_COST;
    if (trainees.length === 0 || s.gold < cost || s.pendingMutiny) return false;

    // O treino consome dias (rações, possível dia de pagamento) como uma marcha
    const { state, log } = passDays({ ...dayState(s), gold: s.gold - cost }, PROGRESSION.TRAINING_DAYS);
    const entries = [
      entry(s.day, `Treino de ${PROGRESSION.TRAINING_DAYS} dias no campo: ${trainees.map((b) => b.name).join(", ")} (${cost} de ouro).`),
      ...log,
    ];
    const battalions = state.battalions.map((b) => {
      if (!trainees.some((t) => t.id === b.id)) return b;
      const leader = state.lieutenants.find((l) => l.battalionId === b.id);
      const xp = Math.round(PROGRESSION.TRAINING_XP * (leader ? (PASSIVES[leader.passive].xp ?? 1) : 1));
      const { battalion, levelsGained } = gainXp(b, xp);
      if (levelsGained > 0) entries.push(entry(state.day, `${b.name} subiu para o nível ${battalion.level}!`, "good"));
      return battalion;
    });
    set({ ...state, battalions, log: appendLog(s.log, entries) });
    return true;
  },

  learnSkill: (battalionId, skill) => {
    const s = get();
    const b = s.battalions.find((x) => x.id === battalionId);
    if (!b || canLearn(b, skill)) return false;
    set({
      battalions: s.battalions.map((x) =>
        x.id === battalionId ? { ...x, skills: [...x.skills, skill], skillPoints: x.skillPoints - 1 } : x,
      ),
      log: appendLog(s.log, [entry(s.day, `${b.name} aprendeu ${SKILLS[skill].label}.`, "good")]),
    });
    return true;
  },

  forgeEquipment: (battalionId, slot) => {
    const s = get();
    const b = s.battalions.find((x) => x.id === battalionId);
    if (!b || b.equipment[slot] >= PROGRESSION.MAX_EQUIPMENT_TIER) return false;
    const cost = forgeCost(b.equipment[slot]);
    if (s.gold < cost.gold || s.iron < cost.iron) return false;
    const tier = b.equipment[slot] + 1;
    set({
      gold: s.gold - cost.gold,
      iron: s.iron - cost.iron,
      battalions: s.battalions.map((x) =>
        x.id === battalionId ? { ...x, equipment: { ...x.equipment, [slot]: tier } } : x,
      ),
      log: appendLog(s.log, [
        entry(s.day, `O ferreiro forjou ${slot === "weapon" ? "armas" : "armaduras"} nível ${tier} para ${b.name}.`),
      ]),
    });
    return true;
  },

  tradeIron: (amount) => {
    const s = get();
    if (amount > 0) {
      const cost = amount * PROGRESSION.IRON_BUY_PRICE;
      if (s.gold < cost) return false;
      set({ gold: s.gold - cost, iron: s.iron + amount });
    } else if (amount < 0) {
      if (s.iron < -amount) return false;
      set({ gold: s.gold - amount * PROGRESSION.IRON_SELL_PRICE, iron: s.iron + amount });
    }
    return amount !== 0;
  },

  hireLieutenant: (candidateId) => {
    const s = get();
    const c = s.lieutenantCandidates.find((x) => x.id === candidateId);
    if (!c || s.gold < c.hireCost || s.lieutenants.length >= LIEUTENANTS.MAX_HIRED) return false;
    const hired: LieutenantData = {
      ...c,
      history: addHistory(c.history, `Dia ${s.day}: entrou para o bando por ${c.hireCost} de ouro.`),
    };
    set({
      gold: s.gold - c.hireCost,
      lieutenants: [...s.lieutenants, hired],
      lieutenantCandidates: s.lieutenantCandidates.filter((x) => x.id !== candidateId),
      log: appendLog(s.log, [entry(s.day, `${fullName(c)} foi contratado(a) como tenente.`, "good")]),
    });
    return true;
  },

  assignLieutenant: (lieutenantId, battalionId) => {
    const s = get();
    const l = s.lieutenants.find((x) => x.id === lieutenantId);
    if (!l) return;
    const battalion = battalionId ? s.battalions.find((b) => b.id === battalionId) : undefined;
    set({
      lieutenants: s.lieutenants.map((x) => {
        if (x.id === lieutenantId) {
          const line = battalion
            ? `Dia ${s.day}: assumiu o comando de ${battalion.name}.`
            : `Dia ${s.day}: foi afastado(a) do comando.`;
          return { ...x, battalionId, history: addHistory(x.history, line) };
        }
        // Quem comandava esse batalhão fica sem comando
        return battalionId && x.battalionId === battalionId ? { ...x, battalionId: null } : x;
      }),
      log: appendLog(s.log, [
        entry(s.day, battalion ? `${fullName(l)} assumiu o comando de ${battalion.name}.` : `${fullName(l)} ficou sem comando.`),
      ]),
    });
  },

  dismissLieutenant: (lieutenantId) => {
    const s = get();
    const l = s.lieutenants.find((x) => x.id === lieutenantId);
    if (!l) return;
    set({
      lieutenants: s.lieutenants.filter((x) => x.id !== lieutenantId),
      log: appendLog(s.log, [entry(s.day, `${fullName(l)} foi dispensado(a) do bando.`)]),
    });
  },

  returnToCamp: () => {
    const s = get();
    const back = s.currentBattle?.kind === "CONTRACT";
    const { state, log } = back ? passDays(dayState(s), ECONOMY.RETURN_DAYS) : { state: dayState(s), log: [] };
    set({
      ...state,
      log: appendLog(s.log, back ? [entry(s.day, "Marcha de volta ao acampamento."), ...log] : log),
      // Novos aventureiros chegam ao acampamento procurando trabalho
      lieutenantCandidates: back
        ? Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(state.day))
        : s.lieutenantCandidates,
      currentScreen: "CAMP",
      currentBattle: null,
      battleHud: null,
      battleReport: null,
      contextMenu: null,
      battleCommands: [],
    });
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),

  sendBattleCommand: (command) => set((state) => ({ battleCommands: [...state.battleCommands, command] })),

  drainBattleCommands: () => {
    const commands = get().battleCommands;
    if (commands.length > 0) set({ battleCommands: [] });
    return commands;
  },

  setGroupArrangement: (arrangement) => set({ groupArrangement: arrangement }),

  campPanel: null,
  campPrompt: null,
  setCampPanel: (panel) => set({ campPanel: panel }),
  setCampPrompt: (prompt) => {
    if (get().campPrompt !== prompt) set({ campPrompt: prompt });
  },
}));

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV) (window as unknown as { __store?: typeof useGameStore }).__store = useGameStore;

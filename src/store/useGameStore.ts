import { create } from "zustand";
import {
  AGENTS,
  BALANCE,
  ECONOMY,
  LIEUTENANTS,
  MUTINEER_OF,
  PROGRESSION,
  SUPPORT,
  TROOPS,
  BUILDINGS,
  GEO,
  REALM,
  SAVE,
  WORLD,
  setWorldSize,
  type BuildingId,
  type EnemyKind,
  type Formation,
  type GroupArrangement,
  type TerrainType,
  type TroopType,
} from "../utils/constants";
import { generateContract, type Contract } from "../game/data/contracts";
import type { WorldDef } from "../game/data/world";
import {
  bandStrength,
  bridgeController,
  buildingCost,
  calamityDelay,
  playerBridges,
  garrisonCap,
  isCalamityOwner,
  isFactionOwner,
  realmDay,
  resolveRaid,
  settlementFromSeed,
  titleFor,
  townPrices,
  type BandKind,
  type Calamity,
  type CalamityKind,
  type FactionState,
  type RaidOutcome,
  type Settlement,
} from "../game/sim/realm";
import { ofRealm, settlementName } from "../game/worldgen/names";
import { generateWorld } from "../game/worldgen/generateWorld";
import { captureField, readSave, writeSave, type FieldSave } from "../game/save/saveGame";
import {
  FOLLOWERS,
  applyCampEvent,
  driftBonds,
  hasFollower,
  pickCampEvent,
  shareVictory,
  type CampContext,
  type CampEvent,
  type Follower,
} from "../game/sim/campEvents";
import { createRng, randomSeed } from "../game/worldgen/rng";
import type { Point } from "../utils/math";
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

/** Painel aberto ao interagir com um local (do acampamento ou de uma cidade). */
export type CampPanel =
  | { kind: "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE" }
  | { kind: "BATTALION"; battalionId: string }
  | { kind: "LIEUTENANT"; lieutenantId: string }
  | { kind: "STABLE" }
  | { kind: "TOWN"; settlementId: string }
  /** Ponte sobre um rio: queimar, reconstruir. */
  | { kind: "BRIDGE"; bridgeId: string }
  /** Salvar, carregar e novo mundo (aberto pelo HUD, em qualquer lugar). */
  | { kind: "GAME" };

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
  /** Inimigos visíveis agora. */
  enemiesInSight: number;
  /** Há combate em andamento (o relógio para; viagem rápida bloqueada). */
  engaged: boolean;
  /** O Comandante está dentro da paliçada do acampamento. */
  inCamp: boolean;
  /** Região do mundo onde o Comandante está. */
  region: string;
  /** Por que não dá para fundar uma vila aqui (null = dá). */
  foundBlocked: string | null;
  /** Tochas acesas (à noite: enxerga mais, mas é visto de longe). */
  torches: boolean;
  /** Pode descansar até o amanhecer? (null = sim; senão, o motivo) */
  restBlocked: string | null;
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

/** Contrato aceito: os inimigos estão no local marcado no mapa até o prazo. */
export interface ActiveContract {
  contract: Contract;
  acceptedDay: number;
  /** Último dia para cumprir; depois disso o cliente desiste. */
  deadline: number;
}

/** Motim em curso: os rebeldes pegaram em armas dentro do acampamento. */
export interface MutinyState {
  rebel: BattalionData;
  units: [EnemyKind, number][];
}

/** Cerco em andamento: a guarnição do povoado está em campo. */
export interface SiegeState {
  settlementId: string;
}

/** Bando que chegou a um povoado ou ao acampamento (combate abstrato, sem o exército por perto). */
export interface BandArrival {
  name: string;
  kind: BandKind;
  members: number;
  /** Facção ou calamidade dona do bando (bandos goblins não têm). */
  ownerId: string | null;
  calamityKind?: CalamityKind;
}

/** O que a cena informa ao encerrar um combate. */
export interface EngagementInfo {
  /** Nome do combate quando não é contrato nem motim (ex.: "Escaramuça na Charneca do Sul"). */
  title: string;
  enemiesKilled: number;
  /** Todos os inimigos do contrato ativo morreram neste combate. */
  contractDone: boolean;
  /** Os amotinados foram derrotados (ou o motim acabou de outro jeito). */
  mutinyOver: boolean;
  /** Outras linhas para o relatório (povoado tomado, calamidade derrotada...). */
  notes?: string[];
}

/** Bando inimigo como aparece no Mapa do Continente. */
export interface WarbandSighting {
  id: string;
  name: string;
  x: number;
  y: number;
  count: number;
  /** Visto agora (senão é a última posição conhecida). */
  visible: boolean;
  seenDay: number;
  /** Para onde marcha (só quando visível). */
  heading: Point | null;
  /** Tipo do bando (patrulha, mensageiro, refugiados não são ameaça) e se ataca o bando. */
  kind?: string;
  hostile?: boolean;
}

/** Retrato do mundo publicado pela cena quando o Mapa do Continente está aberto. */
export interface WorldSnapshot {
  cols: number;
  rows: number;
  cell: number;
  /** Uma letra por célula da névoa: 0 nunca visto, 1 explorado, 2 visível agora. */
  fog: string;
  commander: Point;
  battalions: Point[];
  warbands: WarbandSighting[];
  /** Mensageiros fora (a viagem espera eles voltarem). */
  messengersOut: number;
  /** Covis de calamidade já vistos. */
  calamityLairs: { id: string; x: number; y: number; name: string }[];
}

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
  | { type: "WAR_CRY"; ids: string[] }
  /** Viagem rápida pelo Mapa do Continente até o ponto (x, y) do mundo. */
  | { type: "TRAVEL"; ids: string[]; x: number; y: number }
  /** Fundar uma vila onde o Comandante está. */
  | { type: "FOUND"; ids: string[] }
  /** Acender ou apagar as tochas do bando. */
  | { type: "TORCHES"; ids: string[] }
  /** Descansar até o amanhecer (no acampamento ou ao relento). */
  | { type: "REST"; ids: string[] };

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
  /** Tela de criação do mundo ou campanha em andamento. */
  phase: "NEW_GAME" | "PLAYING";
  /** Campo a restaurar quando a cena do mundo for criada (jogo carregado). */
  pendingField: FieldSave | null;
  /** Muda a cada jogo carregado: o Phaser é recriado do zero. */
  loadNonce: number;
  /** Mundo gerado desta campanha (null antes de começar). */
  world: WorldDef | null;

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

  // --- Mundo (Marco 7) ---
  /** Fração do dia corrente (0–1); o relógio anda com a marcha e com o tempo fora do acampamento. */
  dayProgress: number;
  activeContract: ActiveContract | null;
  mutiny: MutinyState | null;
  /** Povoados vivos: dono, prosperidade, guarnição, construções (Marco 9). */
  settlements: Settlement[];
  factions: FactionState[];
  calamities: Calamity[];
  nextCalamityDay: number;
  siege: SiegeState | null;
  /** Pontes queimadas (ids das travessias do mundo). */
  burnedBridges: string[];

  // --- Vida no acampamento (Marco 12) ---
  /** Honra do bando (0–100): cumprir a palavra, poupar os fracos. Ganha peso no Marco 15. */
  honor: number;
  /** Humor do acampamento (−30..+30): soma na moral inicial e volta devagar ao normal. */
  campMood: number;
  /** Cozinheiro, mascate, curandeira, capelão, famílias. */
  followers: Follower[];
  /** Relação entre cada par de tenentes (−100..100; chave "idA|idB"). */
  bonds: Record<string, number>;
  /** Evento com escolha esperando a decisão do Comandante (pausa o mundo). */
  campEvent: CampEvent | null;
  /** Antes deste dia não há evento novo no acampamento. */
  nextEventDay: number;
  /** Dia da última vitória (a festa no acampamento). */
  lastVictoryDay: number | null;
  /** Campos de batalha recentes (corvos voando em cima por uns dias). */
  battlefields: { x: number; y: number; day: number }[];
  worldMapOpen: boolean;
  worldSnapshot: WorldSnapshot | null;

  // --- Batalha ---
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
  /** Aceita o contrato: recebe o adiantamento e os inimigos aparecem no local marcado no mapa. */
  acceptContract: (id: string) => boolean;
  abandonContract: () => void;
  /** Enfrenta os amotinados (quando não há ouro para pagar os atrasados): eles pegam em armas no acampamento. */
  confrontMutiny: () => void;

  // --- Mundo ---
  /** Avança o relógio (frações de dia); dias inteiros consomem rações, pagam salários etc. */
  advanceTime: (days: number) => void;
  /** Novo mundo a partir de um WorldDef gerado: zera a campanha inteira. */
  startCampaign: (world: WorldDef) => void;
  /** Salva a campanha no espaço; devolve o motivo se não der (ex.: em combate). */
  saveGame: (slot: string) => string | null;
  /** Carrega um save (o mundo é gerado de novo pela semente); devolve o motivo se falhar. */
  loadGame: (slot: string) => string | null;
  /** A cena pega o campo a restaurar (uma vez). */
  consumePendingField: () => FieldSave | null;
  /** Volta para a tela de criação de mundo. */
  newGame: () => void;
  /** Um bando chegou a um povoado (combate abstrato) ou ao acampamento desguarnecido. */
  bandArrives: (targetId: string, band: BandArrival) => RaidOutcome;
  raidCamp: (band: string) => void;
  /** Mercado de um povoado (preços locais conforme a prosperidade). */
  buyRationsAt: (settlementId: string, packs: number) => boolean;
  tradeIronAt: (settlementId: string, amount: number) => boolean;

  // --- Reino (Marco 9) ---
  foundSettlement: (x: number, y: number) => boolean;
  rebuildSettlement: (id: string) => boolean;
  /** Ataca um povoado: guerra com o dono (se for um reino) e a guarnição sai para lutar. */
  besiege: (id: string) => boolean;
  liftSiege: () => void;
  conquerSettlement: (id: string) => void;
  build: (id: string, building: BuildingId) => boolean;
  setTax: (id: string, rate: 0 | 1 | 2) => void;
  armMilitia: (id: string) => boolean;
  payTribute: (factionId: string) => boolean;
  /** O líder da calamidade caiu. */
  defeatCalamity: (id: string) => void;
  revealCalamity: (id: string) => void;
  markHorde: (id: string, day: number) => void;
  markArmy: (factionId: string, day: number) => void;
  setWorldMapOpen: (open: boolean) => void;
  /** Queima uma ponte (irrita quem a controla); reconstruir custa madeira (ouro). */
  burnBridge: (id: string) => boolean;
  rebuildBridge: (id: string) => boolean;
  /** O Comandante chegou ao acampamento ou descansou nele: às vezes acontece um evento. */
  campTick: (reason: "ENTER" | "REST") => void;
  /** Escolha de uma resposta do evento do acampamento. */
  resolveCampEvent: (option: number) => void;
  /** Dispensa um seguidor do acampamento. */
  dismissFollower: (id: string) => void;
  /** O bando atacou uma patrulha ou mensageiro de um reino em paz: o reino fica sabendo. */
  provokeFaction: (factionId: string, what: string) => void;
  /** Mensageiro real abatido: despachos lidos (o que diziam volta como texto). */
  interceptCourier: (factionId: string) => string;
  /** O bando atacou refugiados. */
  attackRefugees: (from: string) => void;
  /** Um combate terminou aqui: corvos por uns dias. */
  markBattlefield: (x: number, y: number) => void;
  /** Pedágio ao cruzar a ponte de outro; devolve o texto do que aconteceu (ou null se não há cobrança). */
  crossBridge: (id: string) => string | null;
  /** Acontecimento do mundo que entra no diário (bandos avistados, destruídos...). */
  chronicle: (text: string, tone?: LogTone) => void;
  setWorldSnapshot: (snapshot: WorldSnapshot | null) => void;

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
  /**
   * Fim de um combate no mundo: aplica baixas, XP, saque, contrato/motim e tenentes.
   * Só os batalhões que lutaram (`survivors`) ganham XP. Dizimados são removidos (permadeath).
   */
  resolveEngagement: (
    result: BattleResult,
    survivors: BattalionSurvivors[],
    support: SupportReport,
    info: EngagementInfo,
  ) => void;
  /** Fecha o relatório do combate. */
  clearReport: () => void;

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

/** O que os eventos do acampamento olham e mudam. */
function campContext(s: GameState): CampContext {
  return {
    day: s.day,
    gold: s.gold,
    rations: s.rations,
    debt: s.debt,
    battalions: s.battalions,
    lieutenants: s.lieutenants,
    followers: s.followers,
    honor: s.honor,
    campMood: s.campMood,
    bonds: s.bonds,
    arrearsWeeks: s.arrearsWeeks,
    hungryDays: s.hungryDays,
    pendingMutiny: s.pendingMutiny,
    lastVictoryDay: s.lastVictoryDay,
    bandName: s.world?.bandName ?? "mercenários",
  };
}

/** Estado de interface (ou recriado na carga) que não vai para o save. */
const TRANSIENT_KEYS = new Set<string>([
  "phase",
  "world",
  "pendingField",
  "loadNonce",
  "worldMapOpen",
  "worldSnapshot",
  "battleHud",
  "battleReport",
  "contextMenu",
  "battleCommands",
  "campPanel",
  "campPrompt",
]);
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
  | "followers"
  | "campMood"
  | "bonds"
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

    // Humor do acampamento volta devagar ao normal; tenentes convivendo se aproximam ou se afastam
    s.campMood = s.campMood > 0 ? Math.max(0, s.campMood - 2) : Math.min(0, s.campMood + 2);
    s.bonds = driftBonds(s.bonds, s.lieutenants);

    // Comida (soldados, Comandante e seguidores; o cozinheiro aproveita melhor)
    const need = dailyRations(s.battalions, s.followers);
    if (s.rations >= need) {
      s.rations -= need;
      if (s.hungryDays > 0) log.push(entry(s.day, "O exército voltou a comer. A fome acabou.", "good"));
      s.hungryDays = 0;
    } else {
      s.rations = 0;
      s.hungryDays++;
      log.push(entry(s.day, `Sem rações! ${s.hungryDays} dia(s) de fome: a moral vai despencar.`, "bad"));
      // Seguidores não ficam para passar fome
      const leaving = s.hungryDays >= 2 ? s.followers[s.followers.length - 1] : undefined;
      if (leaving) {
        s.followers = s.followers.slice(0, -1);
        log.push(entry(s.day, `${leaving.name} (${FOLLOWERS[leaving.role].label.toLowerCase()}) foi embora: não há o que comer.`, "bad"));
      }
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
    // Quem tem a família no acampamento pensa duas vezes antes de desertar
    const rate = ECONOMY.DESERTION_RATE * (hasFollower(s.followers, "FAMILY") ? 0.5 : 1);
    for (const b of s.battalions) {
      const lost = Math.max(1, Math.round(b.soldiers * rate));
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
    followers: s.followers,
    campMood: s.campMood,
    bonds: s.bonds,
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

export { townPrices };

const BUILDINGS_LABEL = (id: BuildingId) => BUILDINGS[id].label;

/** Povoados que podem oferecer contratos: não arruinados, não do jogador, nem de calamidade ou reino em guerra. */
function contractClients(settlements: readonly Settlement[], factions: readonly FactionState[]): Settlement[] {
  return settlements.filter(
    (t) =>
      t.owner !== "RUINED" &&
      t.owner !== "PLAYER" &&
      !isCalamityOwner(t.owner) &&
      !factions.some((f) => f.id === t.owner && f.atWar),
  );
}

function freshContract(s: Pick<GameState, "world" | "settlements" | "factions">): Contract | null {
  if (!s.world) return null;
  return generateContract(s.world, contractClients(s.settlements, s.factions), s.world.camp.center);
}

function playerSettlements(settlements: readonly Settlement[]): Settlement[] {
  return settlements.filter((t) => t.owner === "PLAYER");
}

/** Título novo ao ganhar (ou perder) povoados vira notícia. */
function titleChange(before: readonly Settlement[], after: readonly Settlement[], day: number): LogEntry[] {
  const a = titleFor(playerSettlements(before).length);
  const b = titleFor(playerSettlements(after).length);
  if (a === b) return [];
  const seat = playerSettlements(after)[0];
  return [entry(day, `O Comandante agora é ${b}${seat ? ` de ${seat.name}` : ""}.`, "good")];
}

type CampaignState = Omit<GameState, { [K in keyof GameState]: GameState[K] extends (...args: never[]) => unknown ? K : never }[keyof GameState]>;

/** Tudo o que uma campanha nova precisa: exército inicial, povoados e reinos do mundo gerado. */
function campaignState(world: WorldDef | null): CampaignState {
  const army = initialArmy();
  const first = generateLieutenant(1);
  const lieutenant: LieutenantData = {
    ...first,
    loyalty: Math.max(first.loyalty, 65),
    battalionId: army[0].id,
    history: [`Dia 1: está ao lado do Comandante desde a fundação do bando.`],
  };
  const settlements = world ? world.settlements.map(settlementFromSeed) : [];
  const factions: FactionState[] = world
    ? world.factions.map((f) => ({ id: f.id, ruler: f.ruler, relation: 0, atWar: false, lastArmyDay: 0 }))
    : [];
  const base = { world, settlements, factions };
  const contracts = Array.from({ length: ECONOMY.CONTRACTS_OFFERED }, () => freshContract(base)).filter(
    (c): c is Contract => c !== null,
  );
  const r = createRng(randomSeed());
  return {
    phase: world ? "PLAYING" : "NEW_GAME",
    pendingField: null,
    loadNonce: 0,
    world,
    day: 1,
    gold: ECONOMY.START_GOLD,
    rations: ECONOMY.START_RATIONS,
    iron: PROGRESSION.START_IRON,
    hungryDays: 0,
    debt: 0,
    arrearsWeeks: 0,
    pendingMutiny: false,
    battalions: army,
    lieutenants: [lieutenant],
    lieutenantCandidates: Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(1)),
    scouts: Array.from({ length: SUPPORT.START_SCOUTS }, newScout),
    messengers: Array.from({ length: SUPPORT.START_MESSENGERS }, newMessenger),
    contracts,
    log: world
      ? [
          entry(1, `Ano ${world.year} da ${world.era}. Os ${world.bandName} montaram acampamento em ${world.name}.`),
          entry(1, "Entre na tenda do Comandante para escolher um contrato."),
        ]
      : [],
    // A campanha começa às 8h (o dia vira na aurora, às 6h)
    dayProgress: 2 / 24,
    activeContract: null,
    mutiny: null,
    settlements,
    factions,
    calamities: [],
    nextCalamityDay: Math.round(r.int(REALM.CALAMITY_FIRST_DAY[0], REALM.CALAMITY_FIRST_DAY[1]) * (world ? calamityDelay(world) : 1)),
    siege: null,
    burnedBridges: [],
    honor: 50,
    campMood: 0,
    followers: [],
    bonds: {},
    campEvent: null,
    nextEventDay: 2,
    lastVictoryDay: null,
    battlefields: [],
    worldMapOpen: false,
    worldSnapshot: null,
    battleHud: null,
    battleReport: null,
    contextMenu: null,
    battleCommands: [],
    groupArrangement: "ARCHERS_BACK",
    campPanel: null,
    campPrompt: null,
  };
}

/**
 * Ponte de estado entre React e Phaser.
 * - React: use o hook com seletores, ex. `useGameStore((s) => s.gold)`.
 * - Phaser: use `useGameStore.getState()` e `useGameStore.subscribe(...)` (fora do ciclo de render).
 */
export const useGameStore = create<GameState>()((set, get) => ({
  ...campaignState(null),

  startCampaign: (world) => {
    setWorldSize(world.cols, world.rows);
    set(campaignState(world));
  },
  newGame: () => set(campaignState(null)),

  saveGame: (slot) => {
    const s = get();
    if (!s.world || s.phase !== "PLAYING") return "Nenhuma campanha em andamento.";
    const field = captureField();
    if (typeof field === "string") return field;
    const store: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(s)) {
      if (typeof value !== "function" && !TRANSIENT_KEYS.has(key)) store[key] = value;
    }
    return writeSave({
      version: SAVE.VERSION,
      slot,
      savedAt: new Date().toISOString(),
      seed: s.world.seed,
      options: s.world.options,
      worldName: s.world.name,
      bandName: s.world.bandName,
      day: s.day,
      store,
      field,
    });
  },

  loadGame: (slot) => {
    const file = readSave(slot);
    if (!file) return "Save não encontrado.";
    if (file.version !== SAVE.VERSION) return "Save de outra versão do jogo.";
    const world = generateWorld(file.seed, file.options);
    if (world.name !== file.worldName) return "Este mundo não pôde ser recriado (o gerador mudou desde o save).";
    const loaded = file.store as Partial<CampaignState>;
    logSeq = Math.max(0, ...(loaded.log ?? []).map((e) => e.id));
    set({
      ...campaignState(world),
      ...loaded,
      world,
      phase: "PLAYING",
      pendingField: file.field,
      loadNonce: get().loadNonce + 1,
    });
    return null;
  },

  consumePendingField: () => {
    const field = get().pendingField;
    if (field) set({ pendingField: null });
    return field;
  },

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
    if (!contract || s.pendingMutiny || s.mutiny || s.activeContract) return false;

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
    const deadline = s.day + contract.travelDays + WORLD.CONTRACT_GRACE_DAYS;
    intro.push(...council.log, entry(s.day, `O local está marcado no Mapa do Continente (Tab). Prazo: dia ${deadline}.`));

    set({
      gold: s.gold + contract.advance,
      lieutenants: council.lieutenants,
      contracts: [...s.contracts.filter((c) => c.id !== id), freshContract(s)].filter((c): c is Contract => c !== null),
      log: appendLog(s.log, intro),
      activeContract: { contract, acceptedDay: s.day, deadline },
      campPanel: null,
    });
    return true;
  },

  abandonContract: () => {
    const s = get();
    if (!s.activeContract) return;
    const { contract } = s.activeContract;
    set({
      activeContract: null,
      log: appendLog(s.log, [entry(s.day, `Contrato abandonado: "${contract.title}". ${contract.client} não esquecerá.`, "bad")]),
    });
  },

  confrontMutiny: () => {
    const s = get();
    const rebel = mutinyLeader(s.battalions);
    if (!s.pendingMutiny || !rebel || s.mutiny) return;

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
      // O batalhão rebelado sai do exército e vira inimigo ali mesmo, nos alojamentos
      battalions: s.battalions.filter((b) => b.id !== rebel.id),
      lieutenants,
      pendingMutiny: false,
      mutiny: { rebel, units },
      log: appendLog(s.log, entries),
      battleReport: null,
      campPanel: null,
      campPrompt: null,
    });
  },

  advanceTime: (days) => {
    if (days <= 0) return;
    const s = get();
    if (!s.world) return;
    const total = s.dayProgress + days;
    const whole = Math.floor(total);
    if (whole === 0) {
      set({ dayProgress: total });
      return;
    }
    let state = dayState(s);
    let realm = {
      settlements: s.settlements,
      factions: s.factions,
      calamities: s.calamities,
      nextCalamityDay: s.nextCalamityDay,
      gold: s.gold,
      rations: s.rations,
      iron: s.iron,
    };
    const entries: LogEntry[] = [];
    for (let i = 0; i < whole; i++) {
      const day = state.day + 1;
      const r = realmDay({ ...realm, gold: state.gold, rations: state.rations }, s.world, day, s.world.camp.center);
      realm = r.state;
      if (day % 7 === 0) {
        const tolls = playerBridges(s.world, realm.settlements, s.burnedBridges) * GEO.BRIDGE_TOLL;
        if (tolls > 0) {
          realm = { ...realm, gold: realm.gold + tolls };
          entries.push(entry(day, `Pedágio das pontes do bando: +${tolls} de ouro.`, "good"));
        }
      }
      for (const l of r.log) entries.push(entry(day, l.text, l.tone));
      const passed = passDays({ ...state, gold: realm.gold, rations: realm.rations }, 1);
      state = passed.state;
      entries.push(...passed.log);
    }
    // Prazo do contrato
    let activeContract = s.activeContract;
    let lieutenantCandidates = s.lieutenantCandidates;
    if (activeContract && state.day > activeContract.deadline) {
      entries.push(entry(state.day, `Prazo esgotado: "${activeContract.contract.title}" foi entregue a outro bando.`, "bad"));
      activeContract = null;
      lieutenantCandidates = Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(state.day));
    }
    // Ofertas de reinos que entraram em guerra conosco somem da mesa
    const clients = new Set(contractClients(realm.settlements, realm.factions).map((t) => t.id));
    let contracts = s.contracts.filter((c) => clients.has(c.clientId));
    while (contracts.length < ECONOMY.CONTRACTS_OFFERED) {
      const c = freshContract({ world: s.world, settlements: realm.settlements, factions: realm.factions });
      if (!c) break;
      contracts = [...contracts, c];
    }
    set({
      ...state,
      iron: realm.iron,
      settlements: realm.settlements,
      factions: realm.factions,
      calamities: realm.calamities,
      nextCalamityDay: realm.nextCalamityDay,
      dayProgress: total - whole,
      activeContract,
      lieutenantCandidates,
      contracts,
      log: appendLog(s.log, entries),
    });
  },

  bandArrives: (targetId, band) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === targetId);
    if (!t) return "IGNORED";
    const { settlement, outcome } = resolveRaid(
      t,
      { kind: band.kind, strength: bandStrength(band.kind, band.members), ownerId: band.ownerId, calamityKind: band.calamityKind },
      s.day,
    );
    if (outcome === "IGNORED") return outcome;
    const settlements = s.settlements.map((x) => (x.id === targetId ? settlement : x));
    const mine = t.owner === "PLAYER";
    const text: Record<Exclude<RaidOutcome, "IGNORED">, string> = {
      REPELLED: `${t.name} resistiu ao ataque do ${band.name}.`,
      RAIDED: `${band.name} saqueou ${t.name}! Os preços por lá vão subir.`,
      CAPTURED: `${t.name} caiu nas mãos do ${band.name}.`,
      RUINED: `${t.name} foi tomada pelos mortos: hoje é uma cidade em ruínas.`,
    };
    const tone = outcome === "REPELLED" ? (mine ? "good" : "info") : mine || outcome === "RUINED" ? "bad" : "info";
    // Cidade que cai alimenta a calamidade
    const calamities =
      outcome === "RUINED" || (outcome === "CAPTURED" && band.ownerId && isCalamityOwner(band.ownerId))
        ? s.calamities.map((c) => (c.id === band.ownerId ? { ...c, power: c.power + 2 } : c))
        : s.calamities;
    set({
      settlements,
      calamities,
      log: appendLog(s.log, [entry(s.day, text[outcome], tone), ...titleChange(s.settlements, settlements, s.day)]),
    });
    return outcome;
  },

  raidCamp: (band) => {
    const s = get();
    const rations = Math.floor(s.rations * WORLD.WARBAND.CAMP_RAID_RATIONS);
    const gold = Math.floor(s.gold * WORLD.WARBAND.CAMP_RAID_GOLD);
    const lines = [entry(s.day, `${band} atacou o acampamento desguarnecido: levou ${rations} rações e ${gold} de ouro.`, "bad")];
    // Os seguidores não têm quem os defenda
    let followers = s.followers;
    if (followers.length > 0 && Math.random() < 0.5) {
      const victim = followers[Math.floor(Math.random() * followers.length)];
      followers = followers.filter((f) => f.id !== victim.id);
      lines.push(entry(s.day, `${victim.name} (${FOLLOWERS[victim.role].label.toLowerCase()}) foi morto no ataque ao acampamento.`, "bad"));
    }
    set({ rations: s.rations - rations, gold: s.gold - gold, followers, log: appendLog(s.log, lines) });
  },

  campTick: (reason) => {
    const s = get();
    if (!s.world || s.campEvent || s.mutiny || s.battleReport || s.day < s.nextEventDay) return;
    // Nem todo dia tem drama; sem evento hoje, só amanhã de novo
    if (Math.random() > (reason === "REST" ? 0.6 : 0.5)) {
      set({ nextEventDay: s.day + 1 });
      return;
    }
    const event = pickCampEvent(campContext(s));
    set({ campEvent: event, nextEventDay: s.day + (event ? 2 : 1) });
  },

  resolveCampEvent: (option) => {
    const s = get();
    const e = s.campEvent;
    if (!e || !e.options[option] || e.options[option].disabled) return;
    const r = applyCampEvent(campContext(s), e, option);
    const logs = r.log.map((l) => entry(s.day, l.text, l.tone));
    let lieutenants = r.ctx.lieutenants;
    for (const d of r.loyalty) {
      const res = applyLoyalty(lieutenants, (l) => (l.id === d.id ? d.delta : 0), s.day, `"${e.title}" no acampamento`);
      lieutenants = res.lieutenants;
      logs.push(...res.log);
    }
    set({
      campEvent: null,
      gold: r.ctx.gold,
      rations: r.ctx.rations,
      debt: r.ctx.debt,
      battalions: r.ctx.battalions,
      lieutenants: unassignMissing(lieutenants, r.ctx.battalions),
      followers: r.ctx.followers,
      honor: r.ctx.honor,
      campMood: r.ctx.campMood,
      bonds: r.ctx.bonds,
      log: appendLog(s.log, logs),
    });
  },

  provokeFaction: (factionId, what) => {
    const s = get();
    const def = s.world?.factions.find((f) => f.id === factionId);
    const factions = s.factions.map((f) => {
      if (f.id !== factionId) return f;
      const relation = Math.max(-100, f.relation + AGENTS.PROVOKE_RELATION);
      return { ...f, relation, atWar: f.atWar || relation <= REALM.WAR_BELOW };
    });
    const war = factions.find((f) => f.id === factionId)?.atWar && !s.factions.find((f) => f.id === factionId)?.atWar;
    set({
      factions,
      log: appendLog(s.log, [
        entry(s.day, `Os ${s.world?.bandName ?? "mercenários"} atacaram ${what} ${ofRealm(def?.name ?? "reino")}.${war ? " É guerra!" : ""}`, "bad"),
      ]),
    });
  },

  interceptCourier: (factionId) => {
    const s = get();
    const def = s.world?.factions.find((f) => f.id === factionId);
    const state = s.factions.find((f) => f.id === factionId);
    const atWar = !!state?.atWar;
    const factions = atWar ? s.factions : s.factions.map((f) => (f.id === factionId ? { ...f, relation: Math.max(-100, f.relation + AGENTS.COURIER_RELATION) } : f));
    const towns = s.settlements.filter((t) => t.owner === factionId);
    const garrison = towns.reduce((n, t) => n + t.garrison, 0);
    const next = state ? state.lastArmyDay + REALM.ARMY_EVERY_DAYS : 0;
    const text = `Despachos ${ofRealm(def?.name ?? "reino")}: ${towns.length} povoado(s), ${garrison} homens de guarnição${
      atWar ? `; próximo exército contra nós por volta do dia ${next}` : ""
    }. Na bolsa, ${AGENTS.COURIER_GOLD} de ouro.`;
    set({
      gold: s.gold + AGENTS.COURIER_GOLD,
      factions,
      log: appendLog(s.log, [entry(s.day, `Mensageiro real interceptado. ${text}`, atWar ? "good" : "bad")]),
    });
    return text;
  },

  attackRefugees: (from) => {
    const s = get();
    set({
      honor: Math.max(0, s.honor + AGENTS.REFUGEE_HONOR),
      log: appendLog(s.log, [entry(s.day, `Os ${s.world?.bandName ?? "mercenários"} atacaram refugiados de ${from}. A notícia corre.`, "bad")]),
    });
  },

  markBattlefield: (x, y) => {
    const s = get();
    set({ battlefields: [...s.battlefields.filter((b) => s.day - b.day <= 2), { x: Math.round(x), y: Math.round(y), day: s.day }].slice(-12) });
  },

  dismissFollower: (id) => {
    const s = get();
    const f = s.followers.find((x) => x.id === id);
    if (!f) return;
    set({
      followers: s.followers.filter((x) => x.id !== id),
      log: appendLog(s.log, [entry(s.day, `${f.name} (${FOLLOWERS[f.role].label.toLowerCase()}) foi dispensado do acampamento.`)]),
    });
  },

  buyRationsAt: (settlementId, packs) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t) return false;
    const cost = packs * townPrices(t).rationPack;
    if (packs <= 0 || s.gold < cost) return false;
    const amount = packs * ECONOMY.RATION_PACK_SIZE;
    set({
      gold: s.gold - cost,
      rations: s.rations + amount,
      log: appendLog(s.log, [entry(s.day, `Compradas ${amount} rações em ${t.name} por ${cost} de ouro.`)]),
    });
    return true;
  },

  tradeIronAt: (settlementId, amount) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t) return false;
    const prices = townPrices(t);
    if (amount > 0) {
      const cost = amount * prices.ironBuy;
      if (s.gold < cost) return false;
      set({ gold: s.gold - cost, iron: s.iron + amount });
    } else if (amount < 0) {
      if (s.iron < -amount) return false;
      set({ gold: s.gold - amount * prices.ironSell, iron: s.iron + amount });
    }
    return amount !== 0;
  },

  // --- Reino ---

  foundSettlement: (x, y) => {
    const s = get();
    const { gold, iron } = REALM.FOUND_COST;
    if (!s.world || s.gold < gold || s.iron < iron) return false;
    const near = [...s.settlements, s.world.camp.center].some((t) => Math.hypot(t.x - x, t.y - y) < REALM.FOUND_MIN_DISTANCE);
    if (near) return false;
    const name = settlementName(createRng(randomSeed()), new Set(s.settlements.map((t) => t.name)));
    const village: Settlement = {
      id: `P${s.settlements.length}-${s.day}`,
      name,
      kind: "VILLAGE",
      x: Math.round(x),
      y: Math.round(y),
      owner: "PLAYER",
      prosperity: 60,
      population: 40,
      garrison: 3,
      buildings: [],
      taxRate: 1,
      market: { rationPrice: 0.8, ironBuy: 9, ironSell: 4 },
      description: `Fundada pelos ${s.world.bandName} no dia ${s.day}.`,
      lastRaidDay: null,
    };
    const settlements = [...s.settlements, village];
    set({
      gold: s.gold - gold,
      iron: s.iron - iron,
      settlements,
      log: appendLog(s.log, [
        entry(s.day, `Os ${s.world.bandName} fundaram a aldeia de ${name}.`, "good"),
        ...titleChange(s.settlements, settlements, s.day),
      ]),
    });
    return true;
  },

  rebuildSettlement: (id) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    const { gold, iron } = REALM.REBUILD_COST;
    if (!t || t.owner !== "RUINED" || s.gold < gold || s.iron < iron) return false;
    const settlements = s.settlements.map((x) =>
      x.id === id ? { ...x, owner: "PLAYER", prosperity: 40, population: Math.max(40, x.population), garrison: 4, taxRate: 1 as const } : x,
    );
    set({
      gold: s.gold - gold,
      iron: s.iron - iron,
      settlements,
      log: appendLog(s.log, [entry(s.day, `${t.name} foi reconstruída sob a bandeira do bando.`, "good"), ...titleChange(s.settlements, settlements, s.day)]),
    });
    return true;
  },

  besiege: (id) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    if (!s.world || !t || s.siege || t.owner === "PLAYER" || t.owner === "RUINED") return false;
    const entries: LogEntry[] = [];
    let factions = s.factions;
    if (isFactionOwner(t.owner)) {
      const fname = s.world.factions.find((f) => f.id === t.owner)?.name ?? "reino";
      factions = factions.map((f) => (f.id === t.owner ? { ...f, atWar: true, relation: Math.min(f.relation, -80) } : f));
      entries.push(entry(s.day, `Os ${s.world.bandName} atacaram ${t.name}: guerra com o ${fname}!`, "bad"));
    } else if (t.owner === "FREE") {
      // Tomar gente livre pela espada assusta todas as coroas
      factions = factions.map((f) => ({ ...f, relation: f.relation - 10 }));
      entries.push(entry(s.day, `Os ${s.world.bandName} marcham contra a aldeia livre de ${t.name}.`, "bad"));
    } else {
      entries.push(entry(s.day, `Os ${s.world.bandName} atacam ${t.name} para libertá-la.`, "good"));
    }
    set({ siege: { settlementId: id }, factions, campPanel: null, log: appendLog(s.log, entries) });
    return true;
  },

  liftSiege: () => set({ siege: null }),

  conquerSettlement: (id) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    if (!t || !s.world) return;
    const liberated = isCalamityOwner(t.owner);
    const settlements = s.settlements.map((x) =>
      x.id === id ? { ...x, owner: "PLAYER", prosperity: Math.max(20, x.prosperity - 20), garrison: 4, taxRate: 1 as const } : x,
    );
    // Libertar uma cidade das garras de uma calamidade é visto com bons olhos por todos
    const factions = liberated ? s.factions.map((f) => ({ ...f, relation: Math.min(100, f.relation + 10) })) : s.factions;
    set({
      siege: null,
      settlements,
      factions,
      log: appendLog(s.log, [
        entry(s.day, liberated ? `${t.name} foi libertada e jura lealdade ao Comandante.` : `${t.name} foi tomada e agora pertence ao bando.`, "good"),
        ...titleChange(s.settlements, settlements, s.day),
      ]),
    });
  },

  build: (id, building) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    const cost = buildingCost(building);
    if (!t || t.owner !== "PLAYER" || t.buildings.includes(building) || s.gold < cost.gold || s.iron < cost.iron) return false;
    set({
      gold: s.gold - cost.gold,
      iron: s.iron - cost.iron,
      settlements: s.settlements.map((x) => (x.id === id ? { ...x, buildings: [...x.buildings, building] } : x)),
      log: appendLog(s.log, [entry(s.day, `Construído em ${t.name}: ${BUILDINGS_LABEL(building)}.`, "good")]),
    });
    return true;
  },

  setTax: (id, rate) =>
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === id && x.owner === "PLAYER" ? { ...x, taxRate: rate } : x)) })),

  armMilitia: (id) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    if (!t || t.owner !== "PLAYER" || s.gold < REALM.MILITIA.GOLD || t.garrison >= garrisonCap(t)) return false;
    set({
      gold: s.gold - REALM.MILITIA.GOLD,
      settlements: s.settlements.map((x) =>
        x.id === id ? { ...x, garrison: Math.min(garrisonCap(x), x.garrison + REALM.MILITIA.MEN) } : x,
      ),
    });
    return true;
  },

  payTribute: (factionId) => {
    const s = get();
    const f = s.factions.find((x) => x.id === factionId);
    if (!f || !s.world || s.gold < REALM.TRIBUTE.GOLD) return false;
    const relation = Math.min(100, f.relation + REALM.TRIBUTE.RELATION);
    const peace = f.atWar && relation > REALM.WAR_BELOW;
    const name = s.world.factions.find((x) => x.id === factionId)?.name ?? "reino";
    set({
      gold: s.gold - REALM.TRIBUTE.GOLD,
      factions: s.factions.map((x) => (x.id === factionId ? { ...x, relation, atWar: peace ? false : x.atWar } : x)),
      log: appendLog(s.log, [
        entry(s.day, peace ? `Paz selada com o ${name} mediante tributo.` : `Tributo enviado ao ${name}.`, peace ? "good" : "info"),
      ]),
    });
    return true;
  },

  defeatCalamity: (id) => {
    const s = get();
    const c = s.calamities.find((x) => x.id === id);
    if (!c || c.defeated) return;
    const r = createRng(randomSeed());
    set({
      gold: s.gold + REALM.CALAMITY_REWARD,
      calamities: s.calamities.map((x) => (x.id === id ? { ...x, defeated: true } : x)),
      // Povoados ocupados pela horda ficam livres (o jogador pode reivindicá-los)
      settlements: s.settlements.map((t) => (t.owner === id ? { ...t, owner: "FREE", garrison: 3 } : t)),
      factions: s.factions.map((f) => ({ ...f, relation: Math.min(100, f.relation + REALM.CALAMITY_RELATION) })),
      nextCalamityDay: s.day + Math.round(r.int(REALM.CALAMITY_GAP_DAYS[0], REALM.CALAMITY_GAP_DAYS[1]) * (s.world ? calamityDelay(s.world) : 1)),
      log: appendLog(s.log, [
        entry(s.day, `${c.leader} caiu diante dos ${s.world?.bandName ?? "mercenários"}! ${c.name} chegou ao fim.`, "good"),
        entry(s.day, `Os reinos agradecem: ${REALM.CALAMITY_REWARD} de ouro e a gratidão das coroas.`, "good"),
      ]),
    });
  },

  revealCalamity: (id) =>
    set((s) => ({ calamities: s.calamities.map((c) => (c.id === id ? { ...c, revealed: true } : c)) })),
  markHorde: (id, day) =>
    set((s) => ({ calamities: s.calamities.map((c) => (c.id === id ? { ...c, lastHordeDay: day } : c)) })),
  markArmy: (factionId, day) =>
    set((s) => ({ factions: s.factions.map((f) => (f.id === factionId ? { ...f, lastArmyDay: day } : f)) })),

  burnBridge: (id) => {
    const s = get();
    const c = s.world?.geo.crossings.find((x) => x.id === id && x.kind === "BRIDGE");
    if (!s.world || !c || s.burnedBridges.includes(id)) return false;
    const river = s.world.geo.rivers.find((r) => r.id === c.riverId)?.name ?? "rio";
    const owner = bridgeController(s.settlements, c)?.owner;
    const factions = s.factions.map((f) => {
      if (f.id !== owner) return f;
      const relation = Math.max(-100, f.relation + GEO.BRIDGE_BURN_RELATION);
      return { ...f, relation, atWar: f.atWar || relation <= REALM.WAR_BELOW };
    });
    const def = s.world.factions.find((f) => f.id === owner);
    set({
      burnedBridges: [...s.burnedBridges, id],
      factions,
      log: appendLog(s.log, [
        entry(s.day, `Os ${s.world.bandName} queimaram a ponte sobre o ${river}${def ? `; o ${def.name} não vai esquecer` : ""}.`, "bad"),
      ]),
    });
    return true;
  },

  rebuildBridge: (id) => {
    const s = get();
    if (!s.world || !s.burnedBridges.includes(id) || s.gold < GEO.BRIDGE_REBUILD_GOLD) return false;
    const c = s.world.geo.crossings.find((x) => x.id === id);
    const river = s.world.geo.rivers.find((r) => r.id === c?.riverId)?.name ?? "rio";
    set({
      gold: s.gold - GEO.BRIDGE_REBUILD_GOLD,
      burnedBridges: s.burnedBridges.filter((x) => x !== id),
      log: appendLog(s.log, [entry(s.day, `A ponte sobre o ${river} foi reconstruída (−${GEO.BRIDGE_REBUILD_GOLD} de ouro em madeira).`, "good")]),
    });
    return true;
  },

  crossBridge: (id) => {
    const s = get();
    const c = s.world?.geo.crossings.find((x) => x.id === id);
    if (!s.world || !c) return null;
    const town = bridgeController(s.settlements, c);
    // Ponte do bando, de ninguém, de calamidade ou de reino em guerra: ninguém cobra
    if (!town || town.owner === "PLAYER" || isCalamityOwner(town.owner) || s.factions.some((f) => f.id === town.owner && f.atWar)) return null;
    const toll = Math.round(GEO.BRIDGE_TOLL / 2);
    if (s.gold >= toll) {
      set({ gold: s.gold - toll });
      return `Pedágio na ponte de ${town.name}: −${toll} de ouro.`;
    }
    // Sem dinheiro: passa à força, e o dono não gosta
    if (isFactionOwner(town.owner)) {
      set({ factions: s.factions.map((f) => (f.id === town.owner ? { ...f, relation: Math.max(-100, f.relation - 3) } : f)) });
    }
    return `Sem ouro para o pedágio de ${town.name}: o bando passou à força.`;
  },

  setWorldMapOpen: (open) => set({ worldMapOpen: open, contextMenu: null, ...(open ? {} : { worldSnapshot: null }) }),
  setWorldSnapshot: (snapshot) => set({ worldSnapshot: snapshot }),
  chronicle: (text, tone = "info") => set((s) => ({ log: appendLog(s.log, [entry(s.day, text, tone)]) })),

  setBattleHud: (hud) => set({ battleHud: hud }),

  resolveEngagement: (result, survivors, support, info) => {
    const s = get();
    if (s.battleReport) return; // relatório anterior ainda aberto

    const byId = new Map(survivors.map((x) => [x.id, x]));
    const healer = hasFollower(s.followers, "HEALER");
    let healed = 0;
    let casualties = 0;
    const lostBattalions: string[] = [];
    const remaining: BattalionData[] = [];
    const xpGains: BattleReport["xpGains"] = [];
    const logEntries: LogEntry[] = [];

    for (const b of s.battalions) {
      const report = byId.get(b.id);
      // Quem não lutou segue como estava (sem XP)
      if (!report) {
        remaining.push(b);
        continue;
      }
      let alive = report.survivors;
      // A curandeira tira do chão um em cada três caídos (feridos que ainda tinham salvação)
      if (healer && alive > 0 && b.soldiers - alive >= 2) {
        const saved = Math.floor((b.soldiers - alive) / 3);
        alive += saved;
        healed += saved;
      }
      casualties += b.soldiers - alive;
      if (alive <= 0) {
        lostBattalions.push(b.name);
        continue;
      }
      // Experiência: abates + sobreviver + vencer (tenente Instrutor vivo dá bônus)
      const kills = report.kills ?? 0;
      const leader = s.lieutenants.find((l) => l.battalionId === b.id);
      const xpMult = leader && report.lieutenantAlive !== false ? (PASSIVES[leader.passive].xp ?? 1) : 1;
      const xp = Math.round(
        (kills * PROGRESSION.XP_PER_KILL +
          PROGRESSION.XP_PARTICIPATION +
          (result === "VICTORY" ? PROGRESSION.XP_VICTORY : 0)) *
          xpMult,
      );
      const { battalion, levelsGained } = gainXp(
        { ...b, soldiers: alive, formation: report.formation ?? b.formation, totalKills: b.totalKills + kills },
        xp,
      );
      remaining.push(battalion);
      xpGains.push({ name: b.name, xp, kills, newLevel: levelsGained > 0 ? battalion.level : undefined });
      if (levelsGained > 0) {
        logEntries.push(entry(s.day, `${b.name} subiu para o nível ${battalion.level}!`, "good"));
      }
    }

    const notes: string[] = [];
    if (healed > 0) notes.push(`A curandeira salvou ${healed} ferido(s) que tinham caído.`);
    let gold = s.gold;
    let iron = s.iron;
    let goldEarned = 0;
    let loot = { gold: 0, iron: 0 };
    let debt = s.debt;
    let arrearsWeeks = s.arrearsWeeks;
    let title = info.title;
    let activeContract = s.activeContract;
    let mutiny = s.mutiny;
    let lieutenantCandidates = s.lieutenantCandidates;
    let factions = s.factions;
    notes.push(...(info.notes ?? []));

    // Saque de quem caiu (só se o campo ficou com o bando; amotinados não são saqueados)
    if (result === "VICTORY" && info.enemiesKilled > 0 && !mutiny) {
      loot = {
        // O mascate revende o que o bando tira dos mortos por um preço melhor
        gold: Math.round(info.enemiesKilled * PROGRESSION.LOOT_GOLD_PER_ENEMY * (hasFollower(s.followers, "PEDDLER") ? 1.25 : 1)),
        iron: Math.floor(info.enemiesKilled * PROGRESSION.LOOT_IRON_PER_ENEMY),
      };
      gold += loot.gold;
      iron += loot.iron;
      logEntries.push(entry(s.day, `Saque: ${loot.gold} de ouro e ${loot.iron} de ferro.`, "good"));
    }

    if (info.contractDone && activeContract) {
      const { contract } = activeContract;
      title = contract.title;
      goldEarned = contract.reward;
      gold += goldEarned;
      notes.push(`Contrato cumprido para ${contract.client}.`);
      const clientOwner = s.settlements.find((t) => t.id === contract.clientId)?.owner;
      factions = s.factions.map((f) =>
        f.id === clientOwner ? { ...f, relation: Math.min(100, f.relation + REALM.CONTRACT_RELATION) } : f,
      );
      logEntries.push(entry(s.day, `Contrato cumprido: "${title}". Bônus: ${goldEarned} de ouro.`, "good"));
      activeContract = null;
      // A notícia corre: novos aventureiros procuram o bando
      lieutenantCandidates = Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(s.day));
    } else if (activeContract && result === "DEFEAT") {
      notes.push(`O contrato "${activeContract.contract.title}" continua de pé até o dia ${activeContract.deadline}.`);
    }

    if (mutiny && (info.mutinyOver || result === "DEFEAT")) {
      title = "Motim";
      // Os atrasados devidos aos rebeldes deixam de existir; o exemplo restaura a ordem
      const rebelShare = battalionWage(mutiny.rebel) * s.arrearsWeeks;
      debt = Math.max(0, debt - rebelShare);
      arrearsWeeks = 0;
      if (result === "VICTORY") {
        notes.push(`${mutiny.rebel.name} foi esmagado. A ordem voltou ao acampamento.`);
        logEntries.push(entry(s.day, `Motim esmagado: ${mutiny.rebel.name} não existe mais.`, "good"));
      } else {
        const stolen = Math.floor(gold * ECONOMY.MUTINY_GOLD_LOSS);
        gold -= stolen;
        notes.push(`Os amotinados fugiram levando ${stolen} de ouro.`);
        logEntries.push(entry(s.day, `Os amotinados fugiram com ${stolen} de ouro.`, "bad"));
      }
      mutiny = null;
    }
    if (result === "DEFEAT") {
      notes.push("O Comandante tombou ferido e foi carregado de volta ao acampamento. O exército recuou com ele.");
      logEntries.push(entry(s.day, `Derrota em "${title}": o Comandante foi levado ferido ao acampamento.`, "bad"));
    }
    if (lostBattalions.length) {
      logEntries.push(entry(s.day, `Perdidos para sempre: ${lostBattalions.join(", ")}.`, "bad"));
    }

    // --- Tenentes: destino em campo, crônica e lealdade ---
    const outcome = result === "VICTORY" ? "vitória" : result === "DEFEAT" ? "derrota" : "recuo";
    let lieutenants: LieutenantData[] = [];
    const orphaned = new Set<string>();
    /** Só quem lutou (ou perdeu o batalhão) muda de lealdade com o resultado. */
    const fought = new Set<string>();
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
      fought.add(l.id);
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
        if (!fought.has(l.id)) return 0;
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
    // Entregas feitas desde o último relatório também contam fora de combate
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

    // Vitória: festa no acampamento e tenentes que lutaram lado a lado mais próximos
    const together = lieutenants.filter((l) => fought.has(l.id)).map((l) => l.id);
    set({
      gold,
      iron,
      debt,
      arrearsWeeks,
      battalions: remaining,
      lieutenants,
      scouts,
      messengers,
      activeContract,
      mutiny,
      lieutenantCandidates,
      factions,
      bonds: result === "VICTORY" ? shareVictory(s.bonds, together) : s.bonds,
      lastVictoryDay: result === "VICTORY" && !info.mutinyOver ? s.day : s.lastVictoryDay,
      log: appendLog(s.log, logEntries),
      battleReport: { result, title, goldEarned, loot, casualties, lostBattalions, xpGains, notes },
    });
    // Derrota: o Comandante passa o dia se recuperando
    if (result === "DEFEAT") get().advanceTime(1);
  },

  clearReport: () => set({ battleReport: null }),

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

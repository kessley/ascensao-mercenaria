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
  PRISONERS,
  SIEGE,
  WAR_AI,
  type WarDifficulty,
  WORLD,
  SUPPLY,
  CAMP_WORKS,
  CAMP_WORK_RAID,
  HEALTH,
  GOODS,
  GOOD_LIST,
  CARAVAN,
  TRADE,
  KINGDOM,
  REPUTE,
  COURT,
  setWorldSize,
  type Good,
  type CampWork,
  type Weather,
  type BuildingId,
  type EnemyKind,
  type Formation,
  type GroupArrangement,
  type TerrainType,
  type TroopType,
} from "../utils/constants";
import { generateContract, type Contract } from "../game/data/contracts";
import { regionName, type WorldDef } from "../game/data/world";
import {
  bandStrength,
  bridgeController,
  buildingCost,
  calamityDelay,
  playerBridges,
  garrisonCap,
  isCalamityOwner,
  isFactionOwner,
  isSick,
  realmDay,
  resolveRaid,
  restock,
  settlementFromSeed,
  titleFor,
  townPrices,
  type BandKind,
  type Calamity,
  type CalamityKind,
  type FactionState,
  type KingdomWar,
  type RaidOutcome,
  type Settlement,
} from "../game/sim/realm";
import { applyTrade, foodGood, initEconomy, quote, rationPackPrice } from "../game/sim/market";
import { generateNobles } from "../game/sim/nobility";
import { hearRumors, rumorLine, type Ear, type Rumor } from "../game/sim/rumors";
import { INITIAL_COURT, courtSlice, type CourtActions, type CourtState } from "./courtSlice";
import { INITIAL_WAR, warSlice, type WarActions, type WarState } from "./warSlice";
import { buildScenarioWorld, noteResult, scenarioDay, scenarioProgress, type BattleScenario, type ScenarioHud, type ScenarioResult } from "../game/data/scenarios";
import {
  GUILD_BUILDINGS,
  addLot,
  addNote,
  canHost,
  freightOf,
  freightWeight,
  isContraband,
  noteOf,
  stakeDividend,
  takeLots,
  type GuildStake,
  type Loan,
  type NoteSource,
  type OwnCaravan,
  type PriceNote,
  type TradeLot,
} from "../game/sim/trade";
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
import { resourcesAround } from "../game/worldgen/resources";
import { geoOf } from "../game/worldgen/geoMap";
import { distance, type Point } from "../utils/math";
import { battalionWage, cargoCapacity, dailyRations, reinforceCostPerSoldier, weeklyWages } from "../utils/economy";
import { NO_EXPOSURE, eatDay, healthDay, loadAmount, woundedOf, type Exposure, type Sickness } from "../game/sim/logistics";
import { campDefAt } from "../game/data/campLayout";
import { seasonOf } from "../utils/season";
import { canLearn, forgeCost, gainXp, type EquipmentSlot } from "../utils/progression";
import { SKILLS, type SkillId } from "../game/data/skills";
import { fullName, generateLieutenant, opinionOn, PASSIVES, type LieutenantData } from "../game/data/lieutenants";
import {
  messengerLevelFor,
  newHarpy,
  newMessenger,
  newScout,
  supportWages,
  type MessengerData,
  type ScoutData,
} from "../game/data/riders";
import type { ScoutMode, ScoutOrder } from "../game/entities/Scout";
import type { NobleTrait } from "../game/sim/nobility";
import type { Doctrine } from "../game/systems/WarHost";
import type { HarpyState } from "../game/entities/Harpy";

/** Um batalhão no Campo de Treino: treina de verdade até `until` (dia + fração do dia). */
export interface TrainingOrder {
  battalionId: string;
  until: number;
}

/** Painel aberto ao interagir com um local (do acampamento ou de uma cidade). */
export type CampPanel =
  | { kind: "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE" }
  /** Banca do mascate (seguidor): vinho, ataduras, cobertores. */
  | { kind: "PEDDLER" }
  | { kind: "BATTALION"; battalionId: string }
  | { kind: "LIEUTENANT"; lieutenantId: string }
  | { kind: "STABLE" }
  /** Povoado: aberto pela praça, pelo paço, pelo acampamento da guarnição ou pelo portão (só ali se ataca). */
  | { kind: "TOWN"; settlementId: string; at?: "MARKET" | "HALL" | "CAMP" | "GATE" }
  /** Marco 14: Casa dos Mercadores (feitoria, guildas, câmbio, caravanas próprias), taverna e templo. */
  | { kind: "GUILD" | "TAVERN" | "TEMPLE"; settlementId: string }
  /** Livro de Preços (na mesa da Tenda) e a saída do acampamento (quem vai, quem fica). */
  | { kind: "PRICE_BOOK" | "DEPARTURE" }
  /** Livro da Nobreza (Marco 15): as cortes, os favores e o nome do bando. */
  | { kind: "NOBILITY" }
  /** Ponte sobre um rio: queimar, reconstruir. */
  | { kind: "BRIDGE"; bridgeId: string }
  /** Cais de uma balsa num rio grande: atravessar o exército. */
  | { kind: "FERRY"; ferryId: string }
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
  /** Soldados em condição de lutar. */
  soldiers: number;
  maxSoldiers: number;
  /** Marco 16: gente que veio de prisioneiro; até este dia, moral baixa e olho na porta. */
  turncoatUntil?: number;
  /** Fora das fileiras (Marco 13): feridos na enfermaria e doentes (não lutam, mas comem e voltam). */
  wounded?: number;
  sick?: number;
  sickness?: Sickness;
}

/** O que o mascate vende na banca dele (Marco 12). */
export type PeddlerItem = "WINE" | "BANDAGES" | "BLANKETS";
export const PEDDLER_ITEMS: Record<PeddlerItem, { label: string; gold: number; effect: string }> = {
  WINE: { label: "Barril de vinho para a tropa", gold: 40, effect: "humor do acampamento +8" },
  BANDAGES: { label: "Ataduras e unguento", gold: 30, effect: "3 feridos voltam às fileiras na hora" },
  BLANKETS: { label: "Cobertores de lã", gold: 50, effect: "por 20 dias, o frio do inverno não adoece a tropa" },
};

/** Carroça do trem de suprimentos (a carga é de todas juntas: `cargo`). */
export interface WagonData {
  id: string;
  hp: number;
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
    mode: ScoutMode;
    alive: boolean;
    selected: boolean;
    fleeing: boolean;
    /** Perto o bastante para a visão ser ao vivo. */
    contact: boolean;
    sneaking: boolean;
    rank: number;
    /** A harpia dele (state null = ainda em treino). */
    harpy: { name: string; readyDay: number; state: HarpyState | null; sheltering: boolean; orders: number } | null;
  }[];
  messengers: { id: string; name: string; level: number; state: "IDLE" | "OUTBOUND" | "RETURNING" | "DEAD" }[];
  /** Últimos acontecimentos (mensageiros, interceptações...). */
  feed: string[];
  /** Comandantes inimigos à vista (Marco 16): quem são e como estão. */
  foes: { key: string; name: string; trait: NobleTrait | null; status: string; morale: number; count: number }[];
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
  /** Tempo onde o Comandante está e a previsão de amanhã (só com um tenente Cauteloso). */
  weather: Weather;
  forecast: Weather | null;
  /** Marcha forçada ligada. */
  forced: boolean;
  /** Pode forragear aqui? (null = sim; senão, o motivo) */
  forageBlocked: string | null;
  /** Fadiga de cada batalhão (0–100), na ordem de `battalions`. */
  fatigue: Record<string, number>;
  /** Carroças em campo: vivas e a vida somada. */
  wagonsAlive: number;
  /** Pode montar o acampamento aqui (com ele levantado)? null = sim. */
  pitchBlocked: string | null;
  /** Carroças perto do Comandante (Marco 14): dá para comprar e vender carga pesada. */
  wagonsNear: boolean;
}

/** Diálogo num interior (Marco 14): quem fala, o texto e as respostas (a cena trata a escolha). */
export interface Dialog {
  speaker: string;
  text: string;
  options: { id: string; label: string }[];
}

/** Prédio onde o Comandante entrou (Marco 14). */
export interface InteriorRef {
  /** Chave do prédio (ex.: "camp:TENT", "S3:tavern", "S3:house:12"). */
  key: string;
  title: string;
  settlementId?: string;
}

export type BattleResult = "VICTORY" | "DEFEAT" | "RETREAT";

export interface BattleReport {
  result: BattleResult;
  title: string;
  goldEarned: number;
  /** Saque dos inimigos (só em contrato vencido). */
  loot: { gold: number; iron: number };
  casualties: number;
  /** Dos que caíram, quantos foram para a enfermaria (Marco 13). */
  wounded: number;
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
  /** Contratos do Marco 14: caravanas abatidas (sabotagem) e carga recuperada (já nas carroças). */
  progress?: number;
  recovered?: boolean;
}

/** Motim em curso: os rebeldes pegaram em armas dentro do acampamento. */
export interface MutinyState {
  rebel: BattalionData;
  units: [EnemyKind, number][];
}

/** Cerco em andamento: a guarnição do povoado está em campo. */
export interface SiegeState {
  settlementId: string;
  /** Cerco de verdade, com os portões fechados (sem isso, foi a guarnição que saiu para lutar). */
  walled?: boolean;
  startDay?: number;
  /** Dias de comida que a cidade ainda tem (negativo: dias de fome). */
  food?: number;
  /** Madeira juntada, escadas e aríete prontos para usar. */
  wood?: number;
  ladders?: number;
  ram?: number;
  /** Mensageiro da cidade saiu pedindo socorro: quando o exército chega. */
  reliefDay?: number;
}

/** Ordens do cerco (painel do HUD). */
export type SiegeAction = "WAIT" | "LADDER" | "RAM" | "ASSAULT" | "LIFT" | "DEMAND";

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
  /** Caravana do próprio bando (Marco 14). */
  own?: boolean;
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
  /** Batedores: onde o Comandante sabe que estão (fora de contato, o último lugar). */
  scouts?: { id: string; name: string; x: number; y: number; live: boolean; mode: ScoutMode }[];
  /** Dia do retrato (para dizer há quanto tempo cada bando foi visto). */
  day?: number;
  /** Covis de calamidade já vistos. */
  calamityLairs: { id: string; x: number; y: number; name: string }[];
  /** Barcaças e navios à vista (Marco 14). */
  ships?: { x: number; y: number; kind: "BARGE" | "SHIP" }[];
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
  | { type: "SCOUT_MODE"; ids: string[]; mode: "VANGUARD" | "RECALL" | "RETURN" }
  /** Missão de um batedor (Marco 16): vigiar, explorar região, patrulhar rota, seguir bando. */
  | { type: "SCOUT_ORDER"; ids: string[]; order: ScoutOrder }
  /** Postura furtiva liga/desliga; soltar a harpia com o relatório. */
  | { type: "SCOUT_STEALTH" | "HARPY_SEND"; ids: string[] }
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
  | { type: "REST"; ids: string[] }
  /** Esperar o treino em andamento terminar (o tempo passa de uma vez). */
  | { type: "WAIT_TRAINING"; ids: string[] }
  /** Atravessar o rio de balsa (o exército inteiro passa para o outro cais). */
  | { type: "FERRY"; ids: string[]; ferryId: string }
  /** Um preso contou onde estão os exércitos de um reino (`ids`: os reinos). */
  | { type: "REVEAL"; ids: string[] }
  /** Ordens do cerco de um povoado (Marco 16). */
  | { type: "SIEGE"; ids: string[]; action: SiegeAction }
  /** Marcha forçada liga/desliga; forragear aqui; levantar e montar o acampamento (Marco 13). */
  | { type: "FORCED_MARCH" | "FORAGE" | "PACK_CAMP" | "PITCH_CAMP"; ids: string[] };

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

export interface GameState extends CourtState, CourtActions, WarState, WarActions {
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
  /** Quão bem o inimigo decide (Marco 16): os atributos não mudam. */
  warDifficulty: WarDifficulty;
  setWarDifficulty: (d: WarDifficulty) => void;
  /** Filhotes de harpia achados em ninhos, esperando um batedor. */
  harpyChicks: number;
  /** Ninhos já encontrados. */
  nestsFound: string[];
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
  /** Batalhões treinando no Campo de Treino e quando o treino termina (dia + fração). */
  training: TrainingOrder[];
  /** Campos de batalha recentes (corvos voando em cima por uns dias). */
  battlefields: { x: number; y: number; day: number; spoils?: number }[];
  /** O que cada reino aprendeu a reforçar depois de apanhar do bando (Marco 16). */
  warLessons: Record<string, Doctrine | undefined>;

  // --- Estações e logística (Marco 13) ---
  /** Trem de carroças e as rações que ele leva (o resto, `rations`, fica no depósito do acampamento). */
  wagons: WagonData[];
  cargo: number;
  /** Onde o exército está e o que o expõe (fome, pântano, frio, febre): a cena informa. */
  exposure: Exposure;
  /** Esgotamento da forragem por região ("col,row" → 0..1). */
  forage: Record<string, number>;
  /** Acampamento montado em outro lugar (fogueira); null = onde o mundo o pôs. */
  campAt: Point | null;
  /** Acampamento levantado: tudo nas carroças, à procura de um lugar novo. */
  campPacked: boolean;
  /** Obras do acampamento fixo. */
  campWorks: CampWork[];
  /** Cobertores de lã do mascate: até este dia o frio do inverno não adoece a tropa. */
  blanketsUntil: number;

  // --- Economia e comércio (Marco 14) ---
  /** Guerras entre os reinos (embargo, armas caras). */
  wars: KingdomWar[];
  /** Depósito de mercadorias do acampamento (o ferro continua em `iron`). */
  depot: Partial<Record<Good, number>>;
  /** Mercadorias que o bando leva (carroças ou, sem elas, a bolsa do Comandante). */
  freight: TradeLot[];
  /** Livro de Preços: o que o bando sabe de cada mercado e de quando é a notícia. */
  priceBook: Record<string, PriceNote[]>;
  /** Feitorias do bando (povoados). */
  posts: string[];
  /** Participações em guildas. */
  stakes: GuildStake[];
  loans: Loan[];
  ownCaravans: OwnCaravan[];
  /** Ração de cerveja: toda semana a tropa bebe do depósito (humor). */
  aleRation: boolean;
  /** Taxa de mercado ganha na semana (caravanas nos povoados do bando). */
  marketTaxIncome: number;
  /** Carga roubada por goblins (vira contrato de recuperação). */
  stolenCargo: { bandId: string; bandName: string; good: Good; qty: number; townId: string; day: number }[];
  /** Batalhões que ficam no acampamento quando o Comandante sai (os outros vão com ele). */
  campStay: string[];
  /** Quanto das carroças vai cheio de comida ao sair (o resto fica livre para mercadoria). */
  rationLoad: number;
  /** Prédio onde o Comandante está e o diálogo aberto (Marco 14). */
  interior: InteriorRef | null;
  dialog: Dialog | null;
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
  /** Prisioneiros que aceitaram lutar pelo bando: um batalhão novo, de pouca confiança. */
  recruitCaptives: (troop: TroopType, count: number, label: string) => number;
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
  /** Batalha personalizada em andamento (null = campanha). */
  scenario: BattleScenario | null;
  scenarioHud: ScenarioHud | null;
  scenarioPaused: boolean;
  scenarioResult: ScenarioResult | null;
  /** Começa (ou recomeça) uma batalha personalizada. */
  startScenario: (scenario: BattleScenario) => void;
  setScenarioPaused: (paused: boolean) => void;
  /** Volta ao menu; com um id, abre direto a tela dos cenários naquele. */
  leaveScenario: (reopen: string | null) => void;
  /** Cenário a reabrir no menu. */
  menuTarget: string | null;
  finishScenario: (result: ScenarioResult) => void;
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
  /** Paga a balsa (false = sem ouro). */
  payFerry: (gold: number, river: string) => boolean;
  rebuildSettlement: (id: string) => boolean;
  /** Ataca um povoado: guerra com o dono (se for um reino) e a guarnição sai para lutar. */
  besiege: (id: string) => boolean;
  /** Em guerra, o exército chegou perto dos muros: a guarnição sai dos acampamentos para lutar. */
  garrisonSally: (id: string, soldiers?: number) => boolean;
  /** Soldados da guarnição mortos num cerco que não tomou o povoado. */
  garrisonLosses: (id: string, dead: number) => void;
  liftSiege: () => void;
  /** Cerco com os muros fechados em vez de assalto imediato (Marco 16). */
  blockade: (id: string) => boolean;
  /** Um dia de cerco: comida, madeira, fome; devolve o que aconteceu de importante. */
  siegeDay: (soldiers: number) => { surrendered: boolean; starving: boolean; sally: boolean };
  siegeBuild: (what: "LADDER" | "RAM") => string;
  useLadder: () => boolean;
  useRam: () => boolean;
  demandSurrender: () => string;
  /** O que um batedor descobriu de um povoado. */
  townIntel: Record<string, { day: number; garrison: number; food: number; weakGate: string }>;
  noteTownIntel: (id: string, weakGate: string) => void;
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
  markBattlefield: (x: number, y: number, spoils?: number) => void;
  /** Recolhe o que ficou num campo de batalha; devolve o texto do que achou. */
  lootBattlefield: (x: number, y: number) => string;
  learnFrom: (factionId: string, army: { infantry: number; archers: number; cavalry: number }) => void;
  /** Pedágio ao cruzar a ponte de outro; devolve o texto do que aconteceu (ou null se não há cobrança). */
  crossBridge: (id: string) => string | null;
  /** Acontecimento do mundo que entra no diário (bandos avistados, destruídos...). */
  chronicle: (text: string, tone?: LogTone) => void;
  setWorldSnapshot: (snapshot: WorldSnapshot | null) => void;

  // --- Logística (Marco 13) ---
  buyWagon: () => boolean;
  /** Saindo do acampamento: as carroças carregam (deixando a reserva de quem fica). */
  loadWagons: () => void;
  /** Chegando ao acampamento: tudo vai para o depósito e as carroças são consertadas. */
  unloadWagons: () => void;
  /** Uma carroça destruída: a parte da carga dela se perde. */
  loseWagon: (id: string, by: string) => void;
  setWagonHp: (hp: Record<string, number>) => void;
  setExposure: (e: Exposure) => void;
  /** Forrageia aqui: devolve o texto do resultado. */
  forageAt: (region: string, biome: string, owner: { id: string; name: string } | null) => string;
  buildCampWork: (work: CampWork) => boolean;
  /** Compra na banca do mascate. */
  buyFromPeddler: (item: PeddlerItem) => boolean;
  /** Levanta o acampamento (obras perdidas; tudo nas carroças). Devolve o motivo se não der. */
  packCamp: () => string | null;
  /** Monta o acampamento com a fogueira em `center`; o campo (posições) é recriado a partir de `field`. */
  pitchCamp: (center: Point, field: FieldSave) => void;

  // --- Economia e comércio (Marco 14) ---
  /** Compra (qty > 0) ou vende (qty < 0) um bem no mercado de um povoado. Devolve o motivo se não der. */
  tradeGood: (settlementId: string, good: Good, qty: number) => string | null;
  /** Entrega a carga de um contrato (entrega ou carga recuperada) no povoado do cliente. */
  deliverContract: () => string | null;
  /** Fim de um contrato da economia (escolta que chegou ou se perdeu, sabotagem feita). */
  finishContract: (success: boolean, why: string) => void;
  /** Leva mercadorias do depósito para as carroças (no acampamento) ou o contrário. */
  moveGoods: (good: Good, qty: number) => boolean;
  /** Intendência: grão e carne do depósito viram rações. */
  millFood: (good: Good, qty: number) => boolean;
  setAleRation: (on: boolean) => void;
  /** Anota o que se sabe de um mercado (visita, viajantes, taverna, feitoria...), com o atraso da notícia. */
  notePrices: (settlementId: string, source: NoteSource, ageDays?: number) => void;
  /** Caravanas da cena: sai (compra na origem), chega (vende no destino), é roubada pelo bando ou perdida. */
  /** Devolve o valor da compra (0 = não partiu com carga: estoque vazio ou, se própria, sem ouro). */
  caravanDeparts: (from: string, good: Good, qty: number, ownId?: string) => number;
  caravanArrives: (to: string, cargo: { good: Good; qty: number; from: string; cost: number; own?: string }) => void;
  /** Caravana alheia passando por `towns` povoados do bando: pedágio de estrada. */
  roadToll: (towns: number) => void;
  robCaravan: (band: { name: string; ownerId: string | null; good: Good; qty: number; from: string }) => string;
  caravanStolen: (band: { bandId: string; bandName: string; good: Good; qty: number; townId: string }) => void;
  ownCaravanLost: (id: string, by: string) => void;
  /** Recupera a carga roubada (bando goblin destruído pelo bando). */
  recoverCargo: (bandId: string) => string | null;
  buyPost: (settlementId: string) => boolean;
  investGuild: (settlementId: string, building: BuildingId) => boolean;
  takeLoan: (settlementId: string, amount: number) => boolean;
  repayLoan: (id: string) => boolean;
  hireOwnCaravan: (a: string, b: string) => boolean;
  dismissOwnCaravan: (id: string) => void;
  setMarketTax: (settlementId: string, rate: 0 | 1 | 2) => void;
  /** Rodada na taverna: notícias e preços de mercados distantes. Devolve o que se ouviu. */
  buyRound: (settlementId: string) => string;
  /** Esmola no templo (honra; a febre da cidade passa mais depressa). */
  donateTemple: (settlementId: string, gold: number) => boolean;
  /** Dá uma unidade de grão ou carne da carga a uma família com fome (honra). */
  giveFood: (settlementId: string) => boolean;

  // --- Saída do acampamento e interiores (Marco 14) ---
  setCampStay: (ids: string[]) => void;
  setRationLoad: (share: number) => void;
  enterInterior: (ref: InteriorRef) => void;
  leaveInterior: () => void;
  setDialog: (dialog: Dialog | null) => void;

  // --- Progressão (Marco 4) ---
  /** Treina os batalhões no Campo de Treino: passam os dias de treino e cada um ganha XP. */
  /** Manda batalhões ao Campo de Treino: treinam de verdade por alguns dias, e o XP vem no fim. */
  trainBattalions: (ids: string[]) => boolean;
  /** Treinos cujo prazo chegou: o XP é aplicado. Devolve os batalhões que terminaram. */
  finishTraining: () => string[];
  cancelTraining: (battalionId: string) => void;
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
  /** Batedores e harpias (Marco 16). */
  scoutLost: (id: string) => void;
  scoutReturned: (id: string) => void;
  nestFound: (id: string, by: string) => void;
  /** Comprar uma ave do falcoeiro (ou dar um filhote de ninho) a um batedor. */
  harpyBuy: (scoutId: string) => string;
  harpyAdopt: (scoutId: string) => string;
  harpyLost: (scoutId: string) => void;
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
  "interior",
  "dialog",
  "city",
  "duel",
  "scenario",
  "scenarioHud",
  "scenarioPaused",
  "scenarioResult",
  "menuTarget",
]);
function entry(day: number, text: string, tone: LogTone = "info"): LogEntry {
  return { id: ++logSeq, day, text, tone };
}

/** Os portões de um povoado se fecham: começa o cerco de verdade (Marco 16). */
function closeGates(id: string, get: () => GameState, set: (partial: Partial<GameState>) => void): void {
  const s = get();
  const t = s.settlements.find((x) => x.id === id);
  if (!t) return;
  const stored = (t.econ?.stock.GRAIN ?? 0) + (t.econ?.stock.MEAT ?? 0);
  const food = (SIEGE.FOOD_DAYS[t.kind] ?? 5) + Math.min(6, Math.floor(stored / Math.max(20, t.population / 4)));
  set({
    siege: { settlementId: id, walled: true, startDay: s.day, food, wood: 0, ladders: 0, ram: 0 },
    campPanel: null,
    log: appendLog(s.log, [entry(s.day, `Os portões de ${t.name} se fecharam: é um cerco. Lá dentro há comida para uns ${food} dias.`, "info")]),
  });
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
  | "cargo"
  | "exposure"
  | "training"
  | "campPacked"
  | "depot"
  | "freight"
  | "aleRation"
  | "campStay"
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

    // Comida (soldados, Comandante e seguidores; o cozinheiro aproveita melhor). Em campo, o
    // exército come o que as carroças levam; o depósito fica no acampamento (Marco 13). Quem
    // treina ou ficou guardando o acampamento (Marco 14) come do depósito
    const training = new Set([...s.training.map((t) => t.battalionId), ...(s.exposure.away ? s.campStay : [])]);
    // Grão e carne viram rações quando elas acabam: nas carroças, em campo; no depósito, no acampamento
    const fieldNeed = s.exposure.away && !s.campPacked ? dailyRations(s.battalions.filter((b) => !training.has(b.id)), []) : 0;
    let milled = 0;
    while (s.cargo < fieldNeed) {
      const food = (["GRAIN", "MEAT"] as Good[]).find((g) => freightOf(s.freight, g) > 0);
      if (!food) break;
      s.freight = takeLots(s.freight, food, 1).lots;
      s.cargo += TRADE.RATIONS_PER_FOOD;
      milled++;
    }
    const campNeed = dailyRations(s.exposure.away ? s.battalions.filter((b) => training.has(b.id)) : s.battalions, s.followers);
    while (s.rations < campNeed) {
      const food = (["GRAIN", "MEAT"] as Good[]).find((g) => (s.depot[g] ?? 0) > 0);
      if (!food) break;
      s.depot = { ...s.depot, [food]: (s.depot[food] ?? 0) - 1 };
      s.rations += TRADE.RATIONS_PER_FOOD;
      milled++;
    }
    if (milled > 0) log.push(entry(s.day, `As rações acabaram: ${milled} de grão e carne da carga viraram comida.`, "info"));
    const meal = eatDay(s.rations, s.cargo, s.battalions, s.followers, training, s.exposure.away, s.campPacked);
    s.rations = meal.rations;
    s.cargo = meal.cargo;
    // Harpias comem da carne do bando (sem comida, caçam sozinhas)
    const birds = s.scouts.filter((x) => x.harpy).length * SUPPORT.HARPY.RATIONS;
    if (s.exposure.away && !s.campPacked) s.cargo = Math.max(0, s.cargo - birds);
    else s.rations = Math.max(0, s.rations - birds);
    // Enfermaria e doenças
    const health = healthDay(s.battalions, training, s.exposure, hasFollower(s.followers, "HEALER"), meal.hungry);
    s.battalions = health.battalions;
    for (const l of health.log) log.push(entry(s.day, l.text, l.tone));
    if (!meal.hungry) {
      if (s.hungryDays > 0) log.push(entry(s.day, "O exército voltou a comer. A fome acabou.", "good"));
      s.hungryDays = 0;
    } else {
      s.hungryDays++;
      log.push(
        entry(
          s.day,
          s.exposure.away && !s.campPacked
            ? `As carroças estão vazias! ${s.hungryDays} dia(s) de fome em campo: a moral vai despencar.`
            : `Sem rações! ${s.hungryDays} dia(s) de fome: a moral vai despencar.`,
          "bad",
        ),
      );
      // Seguidores não ficam para passar fome
      const leaving = s.hungryDays >= 2 ? s.followers[s.followers.length - 1] : undefined;
      if (leaving) {
        s.followers = s.followers.slice(0, -1);
        log.push(entry(s.day, `${leaving.name} (${FOLLOWERS[leaving.role].label.toLowerCase()}) foi embora: não há o que comer.`, "bad"));
      }
    }

    // Pagamento
    if (s.day % ECONOMY.PAYDAY_INTERVAL !== 0) continue;

    // Ração de cerveja (Marco 14): a tropa bebe do depósito (ou do que vai nas carroças)
    if (s.aleRation) {
      const soldiers = s.battalions.reduce((sum, b) => sum + b.soldiers, 0);
      const need = Math.max(1, Math.ceil((soldiers / 20) * TRADE.ALE_PER_20));
      const fromDepot = Math.min(need, s.depot.ALE ?? 0);
      s.depot = { ...s.depot, ALE: (s.depot.ALE ?? 0) - fromDepot };
      const fromFreight = Math.min(need - fromDepot, freightOf(s.freight, "ALE"));
      s.freight = takeLots(s.freight, "ALE", fromFreight).lots;
      if (fromDepot + fromFreight >= need) {
        s.campMood = Math.min(30, s.campMood + TRADE.ALE_MOOD);
        log.push(entry(s.day, `Ração de cerveja: ${need} barril(is) para a tropa. O humor melhora.`, "good"));
      } else {
        s.campMood = Math.max(-30, s.campMood - 3);
        log.push(entry(s.day, "A cerveja acabou! A tropa esperava a ração da semana e reclama.", "bad"));
      }
    }

    // Ex-prisioneiros somem na primeira chance (Marco 16)
    for (const b of s.battalions) {
      if ((b.turncoatUntil ?? 0) <= s.day || Math.random() > PRISONERS.TURNCOAT_DESERT) continue;
      b.soldiers = Math.max(0, b.soldiers - 1);
      log.push(entry(s.day, `Um dos ex-prisioneiros de ${b.name} sumiu durante a noite.`, "info"));
    }
    s.battalions = s.battalions.filter((b) => b.soldiers > 0);

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
    cargo: s.cargo,
    exposure: s.exposure,
    training: s.training,
    campPacked: s.campPacked,
    depot: s.depot,
    freight: s.freight,
    aleRation: s.aleRation,
    campStay: s.campStay,
  };
}

/** Tenentes cujo batalhão deixou de existir ficam sem comando. */
function unassignMissing(lieutenants: LieutenantData[], battalions: readonly BattalionData[]): LieutenantData[] {
  return lieutenants.map((l) =>
    l.battalionId && !battalions.some((b) => b.id === l.battalionId) ? { ...l, battalionId: null } : l,
  );
}

const appendLog = (log: LogEntry[], entries: LogEntry[]) => [...log, ...entries].slice(-ECONOMY.LOG_SIZE);

const townName = (settlements: readonly Settlement[], id: string) => settlements.find((t) => t.id === id)?.name ?? "?";

/** O mercado aberto ao bando mais perto do acampamento (onde o vivandeiro e o negociante compram). */
export function nearestMarket(s: Pick<GameState, "world" | "settlements" | "factions">): Settlement | null {
  const camp = s.world?.camp.center;
  if (!camp) return null;
  let best: Settlement | null = null;
  for (const t of s.settlements) {
    if (t.owner === "RUINED" || isCalamityOwner(t.owner) || s.factions.some((f) => f.id === t.owner && f.atWar)) continue;
    if (!best || distance(t, camp) < distance(best, camp)) best = t;
  }
  return best;
}

/** Pacote de rações do vivandeiro: o preço da comida no mercado mais perto, mais o transporte. */
export function sutlerPackPrice(s: Pick<GameState, "world" | "settlements" | "factions">): number {
  const t = nearestMarket(s);
  return t ? Math.round(rationPackPrice(t.econ) * TRADE.SUTLER_MARKUP) : ECONOMY.RATION_PACK_PRICE * 2;
}

/**
 * Cavalos para a cavalaria: os do estábulo primeiro; os que faltam, o negociante traz do
 * mercado mais perto (ao preço de lá, mais o transporte). `ok` = há cavalos no mercado.
 */
export function horseDeal(
  s: Pick<GameState, "depot" | "settlements" | "factions" | "world">,
  need: number,
): { ok: boolean; cost: number; fromStable: number; apply: Partial<GameState> } {
  const fromStable = Math.min(need, s.depot.HORSES ?? 0);
  const missing = need - fromStable;
  const t = missing > 0 ? nearestMarket(s) : null;
  if (missing > 0 && (!t || t.econ.stock.HORSES < missing)) return { ok: false, cost: 0, fromStable, apply: {} };
  const cost = t ? Math.round(quote(t.econ, "HORSES", missing, "BUY").total * TRADE.SUTLER_MARKUP) : 0;
  const apply: Partial<GameState> = {
    depot: { ...s.depot, HORSES: (s.depot.HORSES ?? 0) - fromStable },
    ...(t ? { settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: applyTrade(x.econ, "HORSES", missing, "BUY") } : x)) } : {}),
  };
  return { ok: true, cost, fromStable, apply };
}

/** O bando leva a carga nas carroças (perto do Comandante) ou só na bolsa dele. */
function carryCapacity(s: GameState): number {
  const wagonsNear = s.battleHud?.wagonsNear ?? true;
  return wagonsNear ? cargoCapacity(s.wagons.length) : TRADE.PURSE_CAPACITY;
}

/** Peso que o bando leva agora: rações nas carroças (em campo) e mercadorias. */
function carriedWeight(s: GameState): number {
  return (s.exposure.away && !s.campPacked ? s.cargo : 0) + freightWeight(s.freight);
}

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

function freshContract(s: Pick<GameState, "world" | "settlements" | "factions" | "wars" | "stolenCargo" | "armies" | "nobles" | "fame">): Contract | null {
  const world = s.world;
  if (!world) return null;
  const c = generateContract(world, contractClients(s.settlements, s.factions), world.camp.center, {
    settlements: s.settlements,
    wars: s.wars,
    stolenCargo: s.stolenCargo,
    factionName: (id) => world.factions.find((f) => f.id === id)?.name ?? "reino",
    armies: s.armies,
    nobles: s.nobles,
    relationOf: (id) => s.factions.find((f) => f.id === id)?.relation ?? 0,
  });
  // A fama paga: até +50% num nome conhecido em todo o continente
  return c ? { ...c, reward: Math.round(c.reward * (1 + s.fame * REPUTE.CONTRACT_FAME_BONUS)) } : null;
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
  const settlements = world ? world.settlements.map(settlementFromSeed).map((t) => ({ ...t, loyalty: KINGDOM.LOYALTY_START })) : [];
  const factions: FactionState[] = world
    ? world.factions.map((f) => ({ id: f.id, ruler: f.ruler, relation: 0, atWar: false, lastArmyDay: 0, seatId: f.capitalId, treasury: 300, levy: 0, weariness: 0 }))
    : [];
  const base = { world, settlements, factions, wars: [] as KingdomWar[], stolenCargo: [], day: 1, ...INITIAL_COURT };
  const contracts = Array.from({ length: ECONOMY.CONTRACTS_OFFERED }, () => freshContract(base)).filter(
    (c): c is Contract => c !== null,
  );
  const r = createRng(randomSeed());
  // O bando chega sabendo os preços dos mercados mais perto (o que os mercadores contaram na estrada)
  let priceBook: Record<string, PriceNote[]> = {};
  if (world) {
    const near = [...settlements].filter((t) => t.owner !== "RUINED").sort((a, b) => distance(a, world.camp.center) - distance(b, world.camp.center)).slice(0, 3);
    for (const t of near) priceBook = addNote(priceBook, t.id, { ...noteOf(t.econ, 1, "TRAVELER"), day: -2 });
  }
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
    harpyChicks: 0,
    nestsFound: [],
    warDifficulty: "VETERAN",
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
    training: [],
    battlefields: [],
    warLessons: {},
    townIntel: {},
    wagons: Array.from({ length: SUPPLY.START_WAGONS }, () => ({ id: crypto.randomUUID(), hp: SUPPLY.WAGON.hp })),
    cargo: 0,
    exposure: NO_EXPOSURE,
    forage: {},
    campAt: null,
    campPacked: false,
    campWorks: [],
    blanketsUntil: 0,
    wars: [],
    depot: {},
    freight: [],
    priceBook,
    posts: [],
    stakes: [],
    loans: [],
    ownCaravans: [],
    aleRation: false,
    marketTaxIncome: 0,
    stolenCargo: [],
    campStay: [],
    rationLoad: 1,
    interior: null,
    dialog: null,
    ...INITIAL_COURT,
    ...INITIAL_WAR,
    nobles: world ? generateNobles(world, settlements) : [],
    worldMapOpen: false,
    worldSnapshot: null,
    battleHud: null,
    battleReport: null,
    contextMenu: null,
    battleCommands: [],
    groupArrangement: "ARCHERS_BACK",
    campPanel: null,
    campPrompt: null,
    scenario: null,
    scenarioHud: null,
    scenarioPaused: false,
    scenarioResult: null,
    menuTarget: null,
  };
}

/** Campanha mínima de uma batalha personalizada: o exército do cenário, sem economia nem eventos. */
function scenarioState(scenario: BattleScenario, world: WorldDef): CampaignState {
  const battalions: BattalionData[] = [];
  const lieutenants: LieutenantData[] = [];
  for (const spec of scenario.army.battalions) {
    const b: BattalionData = {
      ...newBattalion(battalions, spec.troop),
      id: spec.id,
      formation: spec.formation,
      level: spec.level,
      equipment: { weapon: spec.gear, armor: spec.gear },
      soldiers: spec.soldiers,
      maxSoldiers: spec.soldiers,
    };
    battalions.push(b);
    if (spec.lieutenant) lieutenants.push({ ...generateLieutenant(1), battalionId: b.id });
  }
  return {
    ...campaignState(world),
    day: scenarioDay(scenario.season),
    dayProgress: scenarioProgress(scenario.hour),
    battalions,
    lieutenants,
    lieutenantCandidates: [],
    scouts: Array.from({ length: scenario.army.scouts }, newScout),
    messengers: Array.from({ length: scenario.army.messengers }, newMessenger),
    wagons: Array.from({ length: scenario.army.wagons }, () => ({ id: crypto.randomUUID(), hp: SUPPLY.WAGON.hp })),
    contracts: [],
    log: [],
    gold: 0,
    campPacked: true,
    nextEventDay: Infinity,
    nextCalamityDay: Infinity,
    warDifficulty: scenario.difficulty,
    scenario,
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

  startScenario: (scenario) => {
    const world = buildScenarioWorld(scenario);
    setWorldSize(world.cols, world.rows);
    // O mapa de um cenário sai sempre igual: a chave do Phaser muda pelo contador
    set({ ...scenarioState(scenario, world), loadNonce: get().loadNonce + 1 });
  },
  setScenarioPaused: (paused) => set({ scenarioPaused: paused }),
  leaveScenario: (reopen) => set({ ...campaignState(null), menuTarget: reopen }),
  finishScenario: (result) => {
    const s = get();
    if (!s.scenario || s.scenarioResult) return;
    noteResult(s.scenario.id, result);
    set({ scenarioResult: result, scenarioPaused: false, contextMenu: null });
  },

  saveGame: (slot) => {
    const s = get();
    if (!s.world || s.phase !== "PLAYING") return "Nenhuma campanha em andamento.";
    if (s.scenario) return "Batalhas personalizadas não são salvas.";
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
    // Acampamento montado em outro lugar (Marco 13)
    if (loaded.campAt) world.camp = campDefAt(loaded.campAt);
    // Reinos nascidos de guerras civis voltam ao mundo (Marco 15)
    world.factions.push(...(loaded.extraFactions ?? []));
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
    const s = get();
    // Cavalaria (Marco 14): um cavalo por cavaleiro; os que faltam no estábulo vêm do negociante
    const horses = troopType === "CAVALRY" ? horseDeal(s, BALANCE.BATTALION_SIZE * TRADE.HORSES_PER_RIDER) : null;
    const cost = TROOPS[troopType].cost + (horses?.cost ?? 0);
    if (s.gold < cost || (horses && !horses.ok)) return false;
    const b = newBattalion(s.battalions, troopType);
    set({
      gold: s.gold - cost,
      battalions: [...s.battalions, b],
      ...(horses ? horses.apply : {}),
      log: appendLog(s.log, [entry(s.day, `Recrutado: ${b.name} (${TROOPS[troopType].label}) por ${cost} de ouro${horses && horses.cost > 0 ? " (com cavalos do negociante)" : ""}.`)]),
    });
    return true;
  },

  recruitCaptives: (troop, count, label) => {
    const s = get();
    const n = Math.min(count, BALANCE.BATTALION_SIZE);
    const b: BattalionData = { ...newBattalion(s.battalions, troop), soldiers: n, turncoatUntil: s.day + PRISONERS.TURNCOAT_DAYS };
    set({ battalions: [...s.battalions, b], log: appendLog(s.log, [entry(s.day, `${n} ${label} formam ${b.name}. Ninguém confia neles ainda.`)]) });
    return n;
  },

  reinforceBattalion: (id) => {
    const s = get();
    const b = s.battalions.find((x) => x.id === id);
    if (!b) return false;
    const per = reinforceCostPerSoldier(b);
    let count = Math.min(b.maxSoldiers - b.soldiers, Math.floor(s.gold / per));
    if (count <= 0) return false;
    let horses: ReturnType<typeof horseDeal> | null = null;
    if (b.troopType === "CAVALRY") {
      // Cada cavaleiro novo precisa de um cavalo
      while (count > 0) {
        horses = horseDeal(s, count * TRADE.HORSES_PER_RIDER);
        if (horses.ok && count * per + horses.cost <= s.gold) break;
        count--;
      }
      if (count <= 0 || !horses) return false;
    }
    const total = count * per + (horses?.cost ?? 0);
    set({
      gold: s.gold - total,
      battalions: s.battalions.map((x) => (x.id === id ? { ...x, soldiers: x.soldiers + count } : x)),
      ...(horses ? horses.apply : {}),
      log: appendLog(s.log, [entry(s.day, `${b.name} recebeu ${count} recruta(s) por ${total} de ouro.`)]),
    });
    return true;
  },

  buyRations: (packs) => {
    const s = get();
    // O vivandeiro compra no mercado mais perto do acampamento e cobra o transporte (Marco 14)
    const t = nearestMarket(s);
    if (!t || packs <= 0) return false;
    const g = foodGood(t.econ);
    if (t.econ.stock[g] < packs) return false;
    const cost = packs * sutlerPackPrice(s);
    if (s.gold < cost) return false;
    const amount = packs * ECONOMY.RATION_PACK_SIZE;
    set({
      gold: s.gold - cost,
      rations: s.rations + amount,
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: applyTrade(x.econ, g, packs, "BUY") } : x)),
      log: appendLog(s.log, [entry(s.day, `Compradas ${amount} rações por ${cost} de ouro (o vivandeiro buscou em ${t.name}).`)]),
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
      wars: s.wars,
      nobles: s.nobles,
      plots: s.plots,
      alliances: s.alliances,
      armies: s.armies,
      courtEvents: s.courtEvents,
      revolts: s.revolts,
      extraFactions: s.extraFactions,
      honor: s.honor,
      fear: s.fear,
      liege: s.liege,
      spouseId: s.spouseId,
      wanted: s.wanted,
    };
    const entries: LogEntry[] = [];
    // Notícias na estrada (Marco 15)
    let rumors: Rumor[] = s.rumors;
    let rumorSeq = s.rumorSeq;
    let summons = s.summons;
    // Finanças do comércio (Marco 14)
    let honor = s.honor;
    let posts = s.posts;
    let stakes = s.stakes;
    let loans = s.loans;
    let ownCaravans = s.ownCaravans;
    let marketTaxIncome = s.marketTaxIncome;
    let priceBook = s.priceBook;
    const world = s.world;
    const factionOf = (id: string) => realm.settlements.find((t) => t.id === id)?.owner ?? "";
    const hostileTo = (owner: string) => owner === "RUINED" || isCalamityOwner(owner) || realm.factions.some((f) => f.id === owner && f.atWar);
    const hitRelation = (owner: string, delta: number) => {
      realm = { ...realm, factions: realm.factions.map((f) => (f.id === owner ? { ...f, relation: Math.max(-100, f.relation + delta) } : f)) };
    };
    for (let i = 0; i < whole; i++) {
      const day = state.day + 1;
      const r = realmDay({ ...realm, gold: state.gold, rations: state.rations, honor }, world, day, world.camp.center);
      realm = { ...r.state, fear: Math.max(0, r.state.fear - REPUTE.FEAR_DECAY) };
      // Feitorias mandam os preços de cada dia
      for (const id of posts) {
        const t = realm.settlements.find((x) => x.id === id);
        if (t && t.owner !== "RUINED") priceBook = addNote(priceBook, id, noteOf(t.econ, day, "POST"));
      }
      if (day % 7 === 0) {
        const tolls = playerBridges(world, realm.settlements, s.burnedBridges) * GEO.BRIDGE_TOLL;
        if (tolls > 0) {
          realm = { ...realm, gold: realm.gold + tolls };
          entries.push(entry(day, `Pedágio das pontes do bando: +${tolls} de ouro.`, "good"));
        }
        // Taxa de mercado dos povoados do bando (caravanas que chegaram na semana)
        if (marketTaxIncome > 0) {
          realm = { ...realm, gold: realm.gold + marketTaxIncome };
          entries.push(entry(day, `Taxa de mercado dos povoados do bando: +${marketTaxIncome} de ouro.`, "good"));
          marketTaxIncome = 0;
        }
        // Feitorias: manutenção; em povoado inimigo ou arruinado, confiscadas
        const lostPosts = posts.filter((id) => hostileTo(factionOf(id)));
        for (const id of lostPosts) entries.push(entry(day, `A feitoria de ${townName(realm.settlements, id)} foi confiscada.`, "bad"));
        posts = posts.filter((id) => !lostPosts.includes(id));
        // Guildas: dividendos (ou confisco, se o povoado virou inimigo)
        let dividends = 0;
        const kept: GuildStake[] = [];
        for (const st of stakes) {
          const t = realm.settlements.find((x) => x.id === st.settlementId);
          if (!t || hostileTo(t.owner)) {
            entries.push(entry(day, `A parte do bando na guilda de ${t?.name ?? "?"} foi perdida.`, "bad"));
            continue;
          }
          const d = stakeDividend(t, st);
          dividends += d;
          kept.push({ ...st, paid: st.paid + d });
        }
        stakes = kept;
        const upkeep = posts.length * TRADE.POST_UPKEEP + ownCaravans.filter((c) => !c.lost).length * TRADE.OWN_CARAVAN_WAGE;
        if (dividends > 0 || upkeep > 0) {
          realm = { ...realm, gold: Math.max(0, realm.gold + dividends - upkeep) };
          entries.push(entry(day, `Comércio: +${dividends} de dividendos das guildas, −${upkeep} de feitorias e caravaneiros.`, dividends >= upkeep ? "good" : "info"));
        }
        ownCaravans = ownCaravans.filter((c) => !c.lost || day - c.lost < 7);
        // Empréstimos: juros toda semana; no vencimento, o principal (sem ouro, calote)
        const nextLoans: Loan[] = [];
        for (const loan of loans) {
          const lender = factionOf(loan.from);
          const due = day >= loan.dueDay;
          const owed = loan.interest + (due ? loan.principal : 0);
          if (realm.gold >= owed) {
            realm = { ...realm, gold: realm.gold - owed };
            entries.push(entry(day, due ? `Empréstimo de ${townName(realm.settlements, loan.from)} quitado (${owed} de ouro com os juros).` : `Juros do empréstimo: −${loan.interest} de ouro.`, due ? "good" : "info"));
            if (!due) nextLoans.push(loan);
            continue;
          }
          if (due) {
            honor = Math.max(0, honor + TRADE.LOAN_DEFAULT_HONOR);
            if (isFactionOwner(lender)) hitRelation(lender, TRADE.LOAN_DEFAULT_RELATION);
            entries.push(entry(day, `Calote! O bando não pagou o empréstimo de ${townName(realm.settlements, loan.from)}. A casa de câmbio espalha o nome do Comandante.`, "bad"));
            continue;
          }
          honor = Math.max(0, honor - 2);
          if (isFactionOwner(lender)) hitRelation(lender, -5);
          entries.push(entry(day, `Os juros do empréstimo de ${townName(realm.settlements, loan.from)} não foram pagos (${loan.missed + 1}ª semana).`, "bad"));
          nextLoans.push({ ...loan, missed: loan.missed + 1, principal: loan.principal + loan.interest });
        }
        loans = nextLoans;
      }
      for (const l of r.log) {
        if (l.where) rumors = [...rumors, { id: ++rumorSeq, day, x: l.where.x, y: l.where.y, text: l.text, tone: l.tone }];
        else entries.push(entry(day, l.text, l.tone));
      }
      // As notícias chegam a quem escuta pelo bando: o Comandante, as feitorias e os povoados do bando
      const ears: Ear[] = [];
      const near = (p: Point) => realm.settlements.find((t) => t.owner !== "RUINED" && distance(t, p) < 2600);
      if (s.commanderAt) {
        const t = near(s.commanderAt);
        const inCamp = distance(s.commanderAt, world.camp.center) < 1600;
        ears.push({ ...s.commanderAt, to: inCamp ? "ao acampamento" : t ? `a ${t.name}` : "ao bando, na estrada" });
      }
      for (const t of realm.settlements) if (t.owner === "PLAYER" || posts.includes(t.id)) ears.push({ x: t.x, y: t.y, to: `a ${t.name}` });
      const news = hearRumors(rumors, day, ears);
      rumors = news.left;
      for (const h of news.heard) entries.push(entry(day, rumorLine(h), h.rumor.tone));
      // Convocação do suserano: o bando precisa estar na capital até o prazo
      const lord = realm.liege ? realm.factions.find((f) => f.id === realm.liege) : undefined;
      if (summons && day > summons.deadline) {
        const seat = realm.settlements.find((t) => t.id === summons?.townId);
        const answered = !!seat && !!s.commanderAt && distance(seat, s.commanderAt) < 5000;
        if (answered) {
          realm = { ...realm, gold: realm.gold + 120, factions: realm.factions.map((f) => (f.id === summons?.factionId ? { ...f, relation: Math.min(100, f.relation + 8) } : f)) };
          entries.push(entry(day, `O bando atendeu à convocação em ${seat?.name}: +120 de ouro e o suserano agradece.`, "good"));
        } else {
          honor = Math.max(0, honor + COURT.SUMMONS_HONOR);
          realm = { ...realm, factions: realm.factions.map((f) => (f.id === summons?.factionId ? { ...f, relation: Math.max(-100, f.relation + COURT.SUMMONS_RELATION) } : f)) };
          entries.push(entry(day, `O bando faltou à convocação do suserano: honra ${COURT.SUMMONS_HONOR} e relação ${COURT.SUMMONS_RELATION}.`, "bad"));
        }
        summons = null;
      }
      if (!summons && lord && day % 7 === 0 && Math.random() < COURT.SUMMONS_CHANCE && realm.wars.some((w) => w.peace === undefined && (w.a === lord.id || w.b === lord.id))) {
        // Com exército do suserano em campanha, a convocação é para o cerco; senão, para a capital
        const camp = realm.armies.find((a) => a.factionId === lord.id && !a.outcome);
        const front = camp ? realm.settlements.find((t) => t.id === camp.targetId) : undefined;
        const seat = front ?? realm.settlements.find((t) => t.id === lord.seatId);
        if (seat) {
          summons = { factionId: lord.id, townId: seat.id, deadline: day + COURT.SUMMONS_DAYS, why: front ? `a campanha contra ${front.name}` : "a guerra" };
          entries.push(entry(day, `CONVOCAÇÃO! ${lord.ruler} chama o bando a ${seat.name} até o dia ${summons.deadline}${front ? ", onde o exército do reino está em campanha" : ""}. Faltar custa honra e relação.`, "bad"));
        }
      }
      const passed = passDays({ ...state, gold: realm.gold, rations: realm.rations }, 1);
      state = passed.state;
      entries.push(...passed.log);
    }
    // Favores vencidos: quem pediu lembra (Marco 15)
    const late = s.quests.filter((q) => q.deadline < state.day);
    for (const q of late) {
      entries.push(entry(state.day, `Favor esquecido: ${q.title}. Quem pediu não vai gostar.`, "bad"));
      realm = { ...realm, nobles: realm.nobles.map((n) => (n.id === q.giverId ? { ...n, opinion: Math.max(-100, n.opinion - 10), memory: [...n.memory, { day: state.day, text: `o Comandante faltou com um favor: ${q.title}`, delta: -10 }].slice(-8) } : n)) };
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
    // Verão é temporada de campanha (mais trabalho); no inverno, menos
    const season = seasonOf(state.day);
    const offered = ECONOMY.CONTRACTS_OFFERED + (season === "SUMMER" ? 1 : season === "WINTER" ? -1 : 0);
    if (contracts.length > offered) contracts = contracts.slice(0, offered);
    const stolenCargo = s.stolenCargo.filter((c) => state.day - c.day <= 20);
    while (contracts.length < offered) {
      const c = freshContract({ world: s.world, settlements: realm.settlements, factions: realm.factions, wars: realm.wars, stolenCargo, armies: realm.armies, nobles: realm.nobles, fame: s.fame });
      if (!c) break;
      contracts = [...contracts, c];
    }
    // A forragem volta devagar
    const forage: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.forage)) {
      const left = v - whole * SUPPLY.FORAGE_REGROW_PER_DAY;
      if (left > 0) forage[k] = left;
    }
    set({
      ...state,
      forage,
      iron: realm.iron,
      settlements: realm.settlements,
      factions: realm.factions,
      calamities: realm.calamities,
      nextCalamityDay: realm.nextCalamityDay,
      wars: realm.wars,
      nobles: realm.nobles,
      plots: realm.plots,
      alliances: realm.alliances,
      armies: realm.armies,
      courtEvents: realm.courtEvents,
      revolts: realm.revolts,
      extraFactions: realm.extraFactions,
      fear: realm.fear,
      spouseId: realm.spouseId,
      wanted: realm.wanted,
      rumors,
      rumorSeq,
      summons,
      quests: s.quests.filter((q) => q.deadline >= state.day),
      dayProgress: total - whole,
      activeContract,
      lieutenantCandidates,
      contracts,
      honor,
      posts,
      stakes,
      loans,
      ownCaravans,
      marketTaxIncome,
      priceBook,
      stolenCargo,
      log: appendLog(s.log, entries),
    });
  },

  ...courtSlice((partial) => set(partial), get),
  ...warSlice(set, get),

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
    // Paliçada reforçada, torres e fosso seguram parte do saque (Marco 13)
    const kept = Math.min(0.85, s.campWorks.reduce((n, w) => n + CAMP_WORK_RAID[w], 0));
    const rations = Math.floor(s.rations * WORLD.WARBAND.CAMP_RAID_RATIONS * (1 - kept));
    const gold = Math.floor(s.gold * WORLD.WARBAND.CAMP_RAID_GOLD * (1 - kept));
    // As mercadorias do depósito também vão (Marco 14)
    const depot: Partial<Record<Good, number>> = {};
    let goods = 0;
    for (const [g, v] of Object.entries(s.depot) as [Good, number][]) {
      const lost = Math.floor(v * WORLD.WARBAND.CAMP_RAID_RATIONS * (1 - kept));
      depot[g] = v - lost;
      goods += lost;
    }
    const lines = [
      entry(
        s.day,
        `${band} atacou o acampamento desguarnecido: levou ${rations} rações${goods > 0 ? `, ${goods} de mercadorias do depósito` : ""} e ${gold} de ouro${kept > 0 ? " (as obras do acampamento seguraram parte do saque)" : ""}.`,
        "bad",
      ),
    ];
    // Os seguidores não têm quem os defenda
    let followers = s.followers;
    if (followers.length > 0 && Math.random() < 0.5) {
      const victim = followers[Math.floor(Math.random() * followers.length)];
      followers = followers.filter((f) => f.id !== victim.id);
      lines.push(entry(s.day, `${victim.name} (${FOLLOWERS[victim.role].label.toLowerCase()}) foi morto no ataque ao acampamento.`, "bad"));
    }
    set({ rations: s.rations - rations, gold: s.gold - gold, depot, followers, log: appendLog(s.log, lines) });
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
    // Os despachos trazem o que ainda está na estrada (Marco 15)
    const seat = towns.find((t) => t.id === state?.seatId) ?? towns[0];
    if (seat) get().hearNews(seat, "nos despachos do mensageiro", WORLD.DAY_DISTANCE * 2);
    set({
      gold: s.gold + AGENTS.COURIER_GOLD,
      factions,
      log: appendLog(get().log, [entry(s.day, `Mensageiro real interceptado. ${text}`, atWar ? "good" : "bad")]),
    });
    return text;
  },

  attackRefugees: (from) => {
    const s = get();
    set({
      honor: Math.max(0, s.honor + AGENTS.REFUGEE_HONOR),
      fear: Math.min(100, s.fear + REPUTE.FEAR.MASSACRE),
      log: appendLog(s.log, [entry(s.day, `Os ${s.world?.bandName ?? "mercenários"} atacaram refugiados de ${from}. A notícia corre.`, "bad")]),
    });
  },

  markBattlefield: (x, y, spoils) => {
    const s = get();
    set({ battlefields: [...s.battlefields.filter((b) => s.day - b.day <= WAR_AI.SPOILS_DAYS), { x: Math.round(x), y: Math.round(y), day: s.day, spoils }].slice(-12) });
  },

  lootBattlefield: (x, y) => {
    const s = get();
    const b = s.battlefields.find((f) => f.x === x && f.y === y);
    if (!b?.spoils) return "Já levaram tudo.";
    const gold = Math.round(b.spoils * WAR_AI.SPOILS_GOLD);
    const iron = Math.floor(b.spoils * WAR_AI.SPOILS_IRON);
    set({
      gold: s.gold + gold,
      iron: s.iron + iron,
      battlefields: s.battlefields.map((f) => (f === b ? { ...f, spoils: 0 } : f)),
      log: appendLog(s.log, [entry(s.day, `O bando recolheu os restos de uma batalha alheia: ${gold} de ouro e ${iron} de ferro.`, "good")]),
    });
    return `Restos da batalha: +${gold} de ouro e +${iron} de ferro.`;
  },

  learnFrom: (factionId, army) =>
    set((s) => {
      const L = WAR_AI.LESSON_SHARE;
      // Muita flecha pede cavalo; muita cavalaria pede besta; o resto, escudos
      const doctrine: Doctrine = army.archers >= L ? "RIDERS" : army.cavalry >= L ? "BOWS" : "SHIELDS";
      return { warLessons: { ...s.warLessons, [factionId]: doctrine } };
    }),

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
    if (!t || packs <= 0) return false;
    // Rações são comida do mercado (Marco 14): cada pacote tira uma unidade de grão ou de carne
    const g = foodGood(t.econ);
    if (t.econ.stock[g] < packs) return false;
    const cost = packs * townPrices(t, s.day).rationPack;
    if (s.gold < cost) return false;
    const amount = packs * ECONOMY.RATION_PACK_SIZE;
    const settlements = s.settlements.map((x) => (x.id === t.id ? { ...x, econ: applyTrade(x.econ, g, packs, "BUY") } : x));
    // Em campo, o que se compra vai nas carroças (até onde couber); com o acampamento levantado, vai junto
    if (s.exposure.away && !s.campPacked) {
      if (s.cargo + freightWeight(s.freight) + amount > carryCapacity(s)) return false;
      set({
        gold: s.gold - cost,
        cargo: s.cargo + amount,
        settlements,
        log: appendLog(s.log, [entry(s.day, `Compradas ${amount} rações em ${t.name} por ${cost} de ouro (nas carroças).`)]),
      });
      return true;
    }
    set({
      gold: s.gold - cost,
      rations: s.rations + amount,
      settlements,
      log: appendLog(s.log, [entry(s.day, `Compradas ${amount} rações em ${t.name} por ${cost} de ouro.`)]),
    });
    return true;
  },

  tradeIronAt: (settlementId, amount) => get().tradeGood(settlementId, "IRON", amount) === null,

  // --- Reino ---

  payFerry: (gold, river) => {
    const s = get();
    if (s.gold < gold) return false;
    set({ gold: s.gold - gold, log: appendLog(s.log, [entry(s.day, `O bando atravessou o ${river} de balsa (${gold} de ouro).`)]) });
    return true;
  },

  foundSettlement: (x, y) => {
    const s = get();
    const { gold, iron } = REALM.FOUND_COST;
    if (!s.world || s.gold < gold || s.iron < iron) return false;
    const near = [...s.settlements, s.world.camp.center].some((t) => Math.hypot(t.x - x, t.y - y) < REALM.FOUND_MIN_DISTANCE);
    if (near) return false;
    const name = settlementName(createRng(randomSeed()), new Set(s.settlements.map((t) => t.name)));
    const base = {
      id: `P${s.settlements.length}-${s.day}`,
      name,
      kind: "VILLAGE" as const,
      x: Math.round(x),
      y: Math.round(y),
      owner: "PLAYER",
      prosperity: 60,
      population: 40,
      garrison: 3,
      buildings: [],
      taxRate: 1 as const,
      market: { rationPrice: 0.8, ironBuy: 9, ironSell: 4 },
      description: `Fundada pelos ${s.world.bandName} no dia ${s.day}.`,
      lastRaidDay: null,
      resources: resourcesAround(geoOf(s.world.geo), s.world.geo, { x, y }, createRng(Math.round(x * 31 + y))),
    };
    const village: Settlement = { ...base, econ: initEconomy(base) };
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
    // Temor (Marco 15): uma guarnição pequena abre os portões sem lutar diante de um nome temido
    if (s.fear >= 50 && t.garrison <= 8 && Math.random() < s.fear / 120) {
      set({ factions, campPanel: null, log: appendLog(s.log, [...entries, entry(s.day, `${t.name} se rendeu sem lutar: ninguém quis enfrentar os ${s.world.bandName}.`, "bad")]) });
      get().conquerSettlement(id);
      return true;
    }
    set({ siege: { settlementId: id }, factions, campPanel: null, log: appendLog(s.log, entries) });
    return true;
  },

  garrisonSally: (id, soldiers = 0) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    if (!s.world || !t || s.siege || t.garrison <= 0) return false;
    const atWar = isFactionOwner(t.owner) && s.factions.some((f) => f.id === t.owner && f.atWar);
    if (!atWar && !isCalamityOwner(t.owner)) return false;
    // Guarnição pequena não sai para morrer: fecha os portões e espera (Marco 16)
    if (t.garrison < soldiers * SIEGE.FIELD_SHARE) {
      closeGates(id, get, set);
      return true;
    }
    const text = isCalamityOwner(t.owner)
      ? `Os ocupantes de ${t.name} saíram dos acampamentos para enfrentar os ${s.world.bandName}.`
      : `A guarnição de ${t.name} saiu dos acampamentos para enfrentar os ${s.world.bandName}.`;
    set({ siege: { settlementId: id }, campPanel: null, log: appendLog(s.log, [entry(s.day, text, "bad")]) });
    return true;
  },

  garrisonLosses: (id, dead) =>
    set((s) => ({ settlements: s.settlements.map((t) => (t.id === id ? { ...t, garrison: Math.max(0, t.garrison - dead) } : t)) })),

  liftSiege: () => set({ siege: null }),

  blockade: (id) => {
    const ok = get().besiege(id);
    const s = get();
    if (!ok || s.siege?.settlementId !== id) return ok;
    closeGates(id, get, set);
    return true;
  },

  siegeDay: (soldiers) => {
    const s = get();
    const c = s.siege;
    const t = c ? s.settlements.find((x) => x.id === c.settlementId) : undefined;
    if (!c?.walled || !t) return { surrendered: false, starving: false, sally: false };
    const food = (c.food ?? 0) - 1;
    const wood = (c.wood ?? 0) + soldiers * SIEGE.WOOD_PER_SOLDIER;
    const starving = food <= 0;
    const lost = starving ? Math.max(1, Math.round(t.garrison * SIEGE.STARVE_LOSS)) : 0;
    const log: LogEntry[] = [];
    if (food === 0) log.push(entry(s.day, `A comida de ${t.name} acabou. Os soldados começam a desertar pelos muros.`, "good"));
    const surrendered = food <= -SIEGE.SURRENDER_AFTER || t.garrison - lost <= 0;
    // Quem está cercado e ainda tem força sai para queimar as obras; quem passa fome tenta a sorte
    const sally = !surrendered && t.garrison >= 4 && Math.random() < SIEGE.SALLY_CHANCE;
    set({
      siege: { ...c, food, wood },
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, garrison: Math.max(0, x.garrison - lost) } : x)),
      log: appendLog(s.log, log),
    });
    return { surrendered, starving, sally };
  },

  siegeBuild: (what) => {
    const s = get();
    const c = s.siege;
    if (!c?.walled) return "Não há cerco.";
    const cost = what === "LADDER" ? SIEGE.LADDER_WOOD : SIEGE.RAM_WOOD;
    if ((c.wood ?? 0) < cost) return `Falta madeira (${Math.floor(c.wood ?? 0)} de ${cost}).`;
    if (what === "LADDER" && (c.ladders ?? 0) >= SIEGE.MAX_LADDERS) return "Escadas de sobra.";
    if (what === "RAM" && (c.ram ?? 0) >= 1) return "O aríete já está pronto.";
    set({ siege: { ...c, wood: (c.wood ?? 0) - cost, ladders: (c.ladders ?? 0) + (what === "LADDER" ? 1 : 0), ram: (c.ram ?? 0) + (what === "RAM" ? 1 : 0) } });
    return what === "LADDER" ? "Mais uma escada pronta." : "O aríete está pronto.";
  },

  useLadder: () => {
    const c = get().siege;
    if (!c || (c.ladders ?? 0) <= 0) return false;
    set({ siege: { ...c, ladders: (c.ladders ?? 0) - 1 } });
    return true;
  },

  useRam: () => {
    const c = get().siege;
    if (!c || (c.ram ?? 0) <= 0) return false;
    set({ siege: { ...c, ram: (c.ram ?? 0) - 1 } });
    return true;
  },

  demandSurrender: () => {
    const s = get();
    const c = s.siege;
    const t = c ? s.settlements.find((x) => x.id === c.settlementId) : undefined;
    if (!c || !t) return "Não há cerco.";
    const hungry = (c.food ?? 5) <= 0 ? SIEGE.DEMAND_HUNGER : 0;
    const chance = s.fear * SIEGE.DEMAND_FEAR + hungry + Math.max(0, 0.2 - t.garrison * 0.02);
    if (Math.random() >= chance) return `${t.name} respondeu com flechas.`;
    set({ honor: Math.min(100, s.honor + SIEGE.SURRENDER_HONOR) });
    get().conquerSettlement(t.id);
    return `${t.name} abriu os portões: ninguém precisou morrer.`;
  },

  noteTownIntel: (id, weakGate) =>
    set((s) => {
      const t = s.settlements.find((x) => x.id === id);
      if (!t) return {};
      const food = s.siege?.settlementId === id ? (s.siege.food ?? 0) : SIEGE.FOOD_DAYS[t.kind] ?? 5;
      return { townIntel: { ...s.townIntel, [id]: { day: s.day, garrison: t.garrison, food, weakGate } } };
    }),

  conquerSettlement: (id) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === id);
    if (!t || !s.world) return;
    const liberated = isCalamityOwner(t.owner);
    const settlements = s.settlements.map((x) =>
      x.id === id ? { ...x, owner: "PLAYER", prosperity: Math.max(20, x.prosperity - 20), garrison: 4, taxRate: 1 as const, conqueredDay: s.day, besiegedBy: undefined } : x,
    );
    // Libertar uma cidade das garras de uma calamidade é visto com bons olhos por todos
    const factions = liberated ? s.factions.map((f) => ({ ...f, relation: Math.min(100, f.relation + 10) })) : s.factions;
    set({
      siege: null,
      settlements,
      factions,
      fear: liberated ? s.fear : Math.min(100, s.fear + REPUTE.FEAR.CONQUER),
      fame: Math.min(100, s.fame + (liberated ? 6 : 4)),
      nobles: s.nobles.map((n) => (n.fiefs.includes(id) ? { ...n, fiefs: n.fiefs.filter((x) => x !== id), opinion: Math.max(-100, n.opinion - 30), memory: [...n.memory, { day: s.day, text: `perdeu ${t.name} para o bando`, delta: -30 }].slice(-8) } : n)),
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
    if (!t || t.owner !== "PLAYER" || t.buildings.includes(building) || !canHost(t, building) || s.gold < cost.gold || s.iron < cost.iron) return false;
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
      fame: Math.min(100, s.fame + REPUTE.FAME.CALAMITY),
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
    if (s.activeContract?.contract.kind === "BURN" && s.activeContract.contract.crossingId === id) queueMicrotask(() => get().finishContract(true, "a ponte queimou"));
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
    let woundedTotal = 0;
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
      const alive = report.survivors;
      // Parte dos que caíram está ferida, não morta (mais com a curandeira): vai para a enfermaria.
      // Batalhão dizimado: ninguém ficou para recolher os feridos
      const fell = Math.max(0, b.soldiers - alive);
      if (alive <= 0) {
        casualties += fell;
        lostBattalions.push(b.name);
        continue;
      }
      const wounded = woundedOf(fell, healer);
      woundedTotal += wounded;
      casualties += fell - wounded;
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
        { ...b, soldiers: alive, wounded: (b.wounded ?? 0) + wounded, formation: report.formation ?? b.formation, totalKills: b.totalKills + kills },
        xp,
      );
      remaining.push(battalion);
      xpGains.push({ name: b.name, xp, kills, newLevel: levelsGained > 0 ? battalion.level : undefined });
      if (levelsGained > 0) {
        logEntries.push(entry(s.day, `${b.name} subiu para o nível ${battalion.level}!`, "good"));
      }
    }

    const notes: string[] = [];
    if (woundedTotal > 0) {
      notes.push(
        `${woundedTotal} ferido(s) foram recolhidos${healer ? " (a curandeira salvou mais gente)" : ""}: voltam da enfermaria em alguns dias, se resistirem.`,
      );
    }
    let gold = s.gold;
    let iron = s.iron;
    let freight = s.freight;
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
      // Em campo, o ferro do saque vai nas carroças, até onde couber (Marco 14)
      if (s.exposure.away && !s.campPacked) {
        const room = Math.max(0, carryCapacity(s) - carriedWeight(s));
        const carried = Math.min(loot.iron, Math.floor(room / GOODS.IRON.weight));
        freight = addLot(freight, { good: "IRON", qty: carried, from: "LOOT", faction: null, cost: 0 });
        if (carried < loot.iron) notes.push(`${loot.iron - carried} de ferro do saque ficou no campo: não cabia nas carroças.`);
        loot = { ...loot, iron: carried };
      } else {
        iron += loot.iron;
      }
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
      freight,
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
      // Fama (Marco 15): vencer dá nome ao bando; vencer muitos, mais ainda
      fame: result === "VICTORY" && info.enemiesKilled > 0 && !info.mutinyOver ? Math.min(100, s.fame + (info.enemiesKilled >= 10 ? REPUTE.FAME.BIG_VICTORY : REPUTE.FAME.VICTORY)) : s.fame,
      log: appendLog(s.log, logEntries),
      battleReport: { result, title, goldEarned, loot, casualties, wounded: woundedTotal, lostBattalions, xpGains, notes },
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

  scoutLost: (id) =>
    set((s) => {
      const lost = s.scouts.find((x) => x.id === id);
      if (!lost) return {};
      return { scouts: s.scouts.filter((x) => x.id !== id), log: appendLog(s.log, [entry(s.day, `O batedor ${lost.name} não voltou.`, "bad")]) };
    }),

  scoutReturned: (id) => set((s) => ({ scouts: s.scouts.map((x) => (x.id === id ? { ...x, missions: x.missions + 1 } : x)) })),

  nestFound: (id, by) =>
    set((s) => {
      if (s.nestsFound.includes(id)) return {};
      return {
        nestsFound: [...s.nestsFound, id],
        harpyChicks: s.harpyChicks + 1,
        log: appendLog(s.log, [entry(s.day, `${by} achou um ninho de harpia nas montanhas e trouxe um filhote. No Estábulo, um batedor pode criá-lo.`, "good")]),
      };
    }),

  harpyBuy: (scoutId) => {
    const s = get();
    const H = SUPPORT.HARPY;
    const scout = s.scouts.find((x) => x.id === scoutId);
    if (!scout) return "Esse batedor não está mais no bando.";
    if (scout.harpy) return `${scout.name} já tem uma ave.`;
    if (s.fame < H.FAME) return "Aves reais não vão para quem ninguém conhece.";
    if (s.gold < H.COST) return `Uma harpia treinada custa ${H.COST} de ouro.`;
    const harpy = newHarpy(s.day + H.TRAIN_DAYS);
    set({
      gold: s.gold - H.COST,
      scouts: s.scouts.map((x) => (x.id === scoutId ? { ...x, harpy } : x)),
      log: appendLog(s.log, [entry(s.day, `${scout.name} ganhou a harpia ${harpy.name}: em ${H.TRAIN_DAYS} dias ela aprende a voltar para ele.`, "good")]),
    });
    return `${harpy.name} é sua. Em ${H.TRAIN_DAYS} dias ela aprende a mão de ${scout.name}.`;
  },

  harpyAdopt: (scoutId) => {
    const s = get();
    const H = SUPPORT.HARPY;
    const scout = s.scouts.find((x) => x.id === scoutId);
    if (!scout || scout.harpy || s.harpyChicks <= 0) return "";
    const harpy = newHarpy(s.day + H.TRAIN_DAYS * 2);
    set({
      harpyChicks: s.harpyChicks - 1,
      scouts: s.scouts.map((x) => (x.id === scoutId ? { ...x, harpy } : x)),
      log: appendLog(s.log, [entry(s.day, `${scout.name} começou a criar o filhote ${harpy.name}.`, "good")]),
    });
    return harpy.name;
  },

  harpyLost: (scoutId) =>
    set((s) => {
      const scout = s.scouts.find((x) => x.id === scoutId);
      if (!scout?.harpy) return {};
      return {
        scouts: s.scouts.map((x) => (x.id === scoutId ? { ...x, harpy: null } : x)),
        log: appendLog(s.log, [entry(s.day, `${scout.name} perdeu a harpia ${scout.harpy.name}.`, "bad")]),
      };
    }),

  setWarDifficulty: (d) => set({ warDifficulty: d }),

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

  // --- Logística (Marco 13) ---

  buyWagon: () => {
    const s = get();
    if (s.gold < SUPPLY.WAGON_COST || s.wagons.length >= SUPPLY.MAX_WAGONS) return false;
    set({
      gold: s.gold - SUPPLY.WAGON_COST,
      wagons: [...s.wagons, { id: crypto.randomUUID(), hp: SUPPLY.WAGON.hp }],
      log: appendLog(s.log, [entry(s.day, `Uma carroça nova (e a junta de bois) por ${SUPPLY.WAGON_COST} de ouro.`)]),
    });
    return true;
  },

  loadWagons: () => {
    const s = get();
    // Quem treina e quem fica guardando o acampamento (Marco 14) come do depósito
    const home = new Set([...s.training.map((t) => t.battalionId), ...s.campStay]);
    const marching = s.battalions.some((b) => !home.has(b.id));
    // Acampamento levantado: o depósito inteiro já vai junto. O Comandante sozinho leva só a mochila
    const amount = s.campPacked
      ? 0
      : marching
        ? Math.min(
            loadAmount(s.rations, s.cargo + freightWeight(s.freight), s.wagons.length, s.battalions, s.followers, home),
            // A parte das carroças que o Comandante reservou para a comida
            Math.max(0, Math.floor(cargoCapacity(s.wagons.length) * (s.rationLoad ?? 1)) - s.cargo),
          )
        : Math.min(s.rations, Math.max(0, 6 - s.cargo));
    set({ rations: s.rations - amount, cargo: s.cargo + amount, exposure: { ...s.exposure, away: true } });
  },

  unloadWagons: () => {
    const s = get();
    // O ferro vai para a Ferraria e os cavalos para o estábulo; o resto da mercadoria fica nas carroças
    const iron = freightOf(s.freight, "IRON");
    const horses = freightOf(s.freight, "HORSES");
    const freight = s.freight.filter((l) => l.good !== "IRON" && l.good !== "HORSES");
    set({
      rations: s.rations + s.cargo,
      cargo: 0,
      iron: s.iron + iron,
      depot: horses > 0 ? { ...s.depot, HORSES: (s.depot.HORSES ?? 0) + horses } : s.depot,
      freight,
      wagons: s.wagons.map((w) => ({ ...w, hp: SUPPLY.WAGON.hp })),
      exposure: { ...NO_EXPOSURE },
    });
  },

  loseWagon: (id, by) => {
    const s = get();
    if (!s.wagons.some((w) => w.id === id)) return;
    const cap = cargoCapacity(s.wagons.length);
    // A carga é de todas juntas: some a parte que cabia nesta carroça
    const lost = Math.round(s.cargo * (SUPPLY.WAGON_CAPACITY / cap));
    const depot = s.campPacked ? Math.round(s.rations / s.wagons.length) : 0;
    set({
      wagons: s.wagons.filter((w) => w.id !== id),
      cargo: s.cargo - lost,
      rations: s.rations - depot,
      log: appendLog(s.log, [
        entry(s.day, `${by} destruiu uma carroça do bando: ${lost + depot} rações perdidas.`, "bad"),
      ]),
    });
  },

  setWagonHp: (hp) => set((s) => ({ wagons: s.wagons.map((w) => (hp[w.id] !== undefined ? { ...w, hp: Math.round(hp[w.id]) } : w)) })),

  setExposure: (e) => {
    const x = get().exposure;
    if (x.away !== e.away || x.swamp !== e.swamp || x.cold !== e.cold || x.sickTown !== e.sickTown) set({ exposure: e });
  },

  forageAt: (region, biome, owner) => {
    const s = get();
    const soldiers = s.battalions.reduce((n, b) => n + b.soldiers, 0);
    const depleted = s.forage[region] ?? 0;
    const gained = Math.round(
      soldiers * SUPPLY.FORAGE_PER_SOLDIER * SUPPLY.FORAGE_SEASON[seasonOf(s.day)] * (SUPPLY.FORAGE_BIOME[biome] ?? 0.8) * (1 - depleted),
    );
    const room = s.campPacked ? Infinity : cargoCapacity(s.wagons.length) - s.cargo;
    const got = Math.max(0, Math.min(gained, room));
    const lines = [
      entry(
        s.day,
        got > 0
          ? `O bando forrageou ${got} rações${got < gained ? " (as carroças não levam mais)" : ""}${depleted > 0.3 ? "; a região já está rapada" : ""}.`
          : "O bando forrageou e quase nada achou: a região está rapada (ou é inverno).",
        got > 0 ? "good" : "bad",
      ),
    ];
    let factions = s.factions;
    if (owner && got > 0) {
      factions = factions.map((f) => {
        if (f.id !== owner.id) return f;
        const relation = Math.max(-100, f.relation + SUPPLY.FORAGE_RELATION);
        return { ...f, relation, atWar: f.atWar || relation <= REALM.WAR_BELOW };
      });
      lines.push(entry(s.day, `O ${owner.name} não gostou de ver o bando rapando os campos dos seus camponeses.`, "bad"));
    }
    set({
      ...(s.campPacked ? { rations: s.rations + got } : { cargo: s.cargo + got }),
      forage: { ...s.forage, [region]: Math.min(1, depleted + SUPPLY.FORAGE_DEPLETION) },
      factions,
      log: appendLog(s.log, lines),
    });
    return lines[0].text;
  },

  buildCampWork: (work) => {
    const s = get();
    const c = CAMP_WORKS[work];
    if (s.campWorks.includes(work) || s.campPacked || s.gold < c.gold || s.iron < c.iron) return false;
    set({
      gold: s.gold - c.gold,
      iron: s.iron - c.iron,
      campWorks: [...s.campWorks, work],
      log: appendLog(s.log, [entry(s.day, `Obra no acampamento: ${c.label}.`, "good")]),
    });
    return true;
  },

  buyFromPeddler: (item) => {
    const s = get();
    const it = PEDDLER_ITEMS[item];
    if (!hasFollower(s.followers, "PEDDLER") || s.gold < it.gold) return false;
    const line = entry(s.day, `Comprado na banca do mascate: ${it.label.toLowerCase()} (${it.gold} de ouro).`);
    if (item === "WINE") {
      set({ gold: s.gold - it.gold, campMood: Math.min(30, s.campMood + 8), log: appendLog(s.log, [line]) });
      return true;
    }
    if (item === "BANDAGES") {
      let left = 3;
      const battalions = [...s.battalions]
        .sort((a, b) => (b.wounded ?? 0) - (a.wounded ?? 0))
        .map((b) => {
          const n = Math.min(left, b.wounded ?? 0);
          left -= n;
          return n > 0 ? { ...b, wounded: (b.wounded ?? 0) - n, soldiers: b.soldiers + n } : b;
        });
      if (left === 3) return false; // ninguém ferido
      const order = (id: string) => s.battalions.findIndex((b) => b.id === id);
      set({ gold: s.gold - it.gold, battalions: battalions.sort((a, b) => order(a.id) - order(b.id)), log: appendLog(s.log, [line]) });
      return true;
    }
    set({ gold: s.gold - it.gold, blanketsUntil: s.day + 20, log: appendLog(s.log, [line]) });
    return true;
  },

  packCamp: () => {
    const s = get();
    if (s.campPacked) return "O acampamento já está levantado.";
    if (s.mutiny || s.pendingMutiny) return "Motim no acampamento.";
    if (s.training.length > 0) return "Há batalhões no Campo de Treino.";
    set({
      campPacked: true,
      campWorks: [],
      campPanel: null,
      log: appendLog(s.log, [
        entry(s.day, `Os ${s.world?.bandName ?? "mercenários"} levantaram acampamento: barracas, depósito e seguidores vão nas carroças.`),
      ]),
    });
    return null;
  },

  pitchCamp: (center, field) => {
    const s = get();
    if (!s.world || !s.campPacked) return;
    const world = s.world;
    world.camp = campDefAt(center);
    set({
      campAt: { x: Math.round(center.x), y: Math.round(center.y) },
      campPacked: false,
      pendingField: field,
      // O mundo é recriado (o acampamento novo, a colisão, as rotas)
      loadNonce: s.loadNonce + 1,
      log: appendLog(s.log, [entry(s.day, `O acampamento foi montado de novo em ${regionName(world, center)}.`, "good")]),
    });
  },

  // --- Economia e comércio (Marco 14) ---

  tradeGood: (settlementId, good, qty) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || qty === 0) return "Nada a negociar.";
    if (t.owner === "RUINED" || isCalamityOwner(t.owner)) return "Não há mercado aqui.";
    if (s.factions.some((f) => f.id === t.owner && f.atWar)) return "Em guerra: o mercado está fechado para o bando.";
    const margin = s.posts.includes(t.id) ? TRADE.POST_MARGIN : 0;
    const label = GOODS[good].label.toLowerCase();
    const note = addNote(s.priceBook, t.id, noteOf(t.econ, s.day, "VISIT"));
    if (qty > 0) {
      if (t.econ.stock[good] < qty) return `O mercado só tem ${Math.floor(t.econ.stock[good])} de ${label}.`;
      const room = carryCapacity(s) - carriedWeight(s);
      if (GOODS[good].weight * qty > room) {
        return s.battleHud?.wagonsNear === false ? "Sem as carroças por perto, o Comandante só leva o que cabe na bolsa." : "Não cabe nas carroças.";
      }
      const q = quote(t.econ, good, qty, "BUY", margin);
      if (s.gold < q.total) return "Falta ouro.";
      const after = applyTrade(t.econ, good, qty, "BUY");
      set({
        gold: s.gold - q.total,
        settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: after } : x)),
        freight: addLot(s.freight, { good, qty, from: t.id, faction: isFactionOwner(t.owner) ? t.owner : null, cost: q.total / qty }),
        priceBook: addNote(note, t.id, noteOf(after, s.day, "VISIT")),
        log: appendLog(s.log, [entry(s.day, `Comprados ${qty} de ${label} em ${t.name} por ${q.total} de ouro.`)]),
      });
      return null;
    }
    const n = -qty;
    if (freightOf(s.freight, good) < n) return "Não há tanto na carga.";
    // Vende primeiro o que não é contrabando
    const legal = (l: TradeLot) => !isContraband(l, t, s.wars);
    const legalQty = s.freight.filter((l) => l.good === good && legal(l)).reduce((sum, l) => sum + l.qty, 0);
    const first = takeLots(s.freight, good, Math.min(n, legalQty), legal);
    const second = takeLots(first.lots, good, n - Math.min(n, legalQty));
    const taken = [...first.taken, ...second.taken];
    const smuggled = second.taken.reduce((sum, l) => sum + l.qty, 0);
    const q = quote(t.econ, good, n, "SELL", margin);
    const cost = taken.reduce((sum, l) => sum + l.cost * l.qty, 0);
    let revenue = q.total;
    let factions = s.factions;
    const lines: LogEntry[] = [];
    if (smuggled > 0) {
      const share = smuggled / n;
      if (Math.random() < TRADE.SMUGGLE_CATCH) {
        // Pegos: a carga ilegal é confiscada e o bando paga multa
        const fine = Math.round(q.total * share * TRADE.SMUGGLE_FINE);
        revenue = Math.round(q.total * (1 - share)) - fine;
        factions = factions.map((f) => (f.id === t.owner ? { ...f, relation: Math.max(-100, f.relation + TRADE.SMUGGLE_RELATION) } : f));
        lines.push(entry(s.day, `Contrabando apreendido em ${t.name}! Os guardas confiscaram ${smuggled} de ${label} e cobraram ${fine} de multa.`, "bad"));
      } else {
        revenue = Math.round(q.total * (1 - share) + q.total * share * TRADE.SMUGGLE_BONUS);
        lines.push(entry(s.day, `Contrabando: ${smuggled} de ${label} do reino inimigo vendidos por baixo do pano em ${t.name}.`, "info"));
      }
    }
    const after = applyTrade(t.econ, good, n, "SELL");
    const profit = revenue - Math.round(cost);
    lines.unshift(entry(s.day, `Vendidos ${n} de ${label} em ${t.name} por ${revenue} de ouro (${profit >= 0 ? "lucro" : "prejuízo"} de ${Math.abs(profit)}).`, profit >= 0 ? "good" : "info"));
    set({
      gold: Math.max(0, s.gold + revenue),
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: after } : x)),
      freight: second.lots,
      factions,
      priceBook: addNote(note, t.id, noteOf(after, s.day, "VISIT")),
      log: appendLog(s.log, lines),
    });
    return null;
  },

  deliverContract: () => {
    const s = get();
    const active = s.activeContract;
    const c = active?.contract;
    if (!active || !c || !c.good || !c.qty) return "Nenhuma entrega a fazer.";
    if (c.kind === "RECOVER" && !active.recovered) return "A carga ainda está com os goblins.";
    if (freightOf(s.freight, c.good) < c.qty) return `Faltam ${GOODS[c.good].label.toLowerCase()}: o contrato pede ${c.qty}.`;
    const t = s.settlements.find((x) => x.id === (c.targetId ?? c.clientId));
    if (!t) return "O cliente não existe mais.";
    const factions = s.factions.map((f) => (f.id === t.owner ? { ...f, relation: Math.min(100, f.relation + REALM.CONTRACT_RELATION) } : f));
    set({
      gold: s.gold + c.reward,
      honor: Math.min(100, s.honor + 3),
      fame: Math.min(100, s.fame + REPUTE.FAME.CONTRACT),
      freight: takeLots(s.freight, c.good, c.qty).lots,
      factions,
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: restock(x.econ, { [c.good as Good]: c.qty }), prosperity: Math.min(100, x.prosperity + 5) } : x)),
      activeContract: null,
      lieutenantCandidates: Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(s.day)),
      log: appendLog(s.log, [entry(s.day, `Contrato cumprido: "${c.title}". ${t.name} pagou ${c.reward} de ouro.`, "good")]),
    });
    return null;
  },

  finishContract: (success, why) => {
    const s = get();
    const c = s.activeContract?.contract;
    if (!c) return;
    const owner = s.settlements.find((t) => t.id === c.clientId)?.owner;
    // O lado contrário lembra (Marco 15): quem o bando prejudicou guarda rancor
    const rivalRuler = c.rival && success ? s.nobles.find((n) => n.alive && n.factionId === c.rival && n.rank === "RULER") : undefined;
    set({
      gold: s.gold + (success ? c.reward : 0),
      honor: success ? Math.min(100, s.honor + 3) : s.honor,
      fame: success ? Math.min(100, s.fame + REPUTE.FAME.CONTRACT) : s.fame,
      factions: s.factions.map((f) => {
        if (f.id === owner) return { ...f, relation: Math.max(-100, Math.min(100, f.relation + (success ? REALM.CONTRACT_RELATION : -5))) };
        return success && f.id === c.rival ? { ...f, relation: Math.max(-100, f.relation - 12) } : f;
      }),
      nobles: rivalRuler ? s.nobles.map((n) => (n.id === rivalRuler.id ? { ...n, opinion: Math.max(-100, n.opinion - 12), memory: [...n.memory, { day: s.day, text: `o bando trabalhou contra o reino: ${c.title}`, delta: -12 }].slice(-8) } : n)) : s.nobles,
      activeContract: null,
      lieutenantCandidates: success ? Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(s.day)) : s.lieutenantCandidates,
      log: appendLog(s.log, [
        entry(s.day, success ? `Contrato cumprido: "${c.title}" (${why}). ${c.client} pagou ${c.reward} de ouro.` : `Contrato perdido: "${c.title}" (${why}).`, success ? "good" : "bad"),
      ]),
    });
  },

  moveGoods: (good, qty) => {
    const s = get();
    if (s.exposure.away || qty === 0) return false;
    const inDepot = good === "IRON" ? s.iron : (s.depot[good] ?? 0);
    if (qty > 0) {
      const room = cargoCapacity(s.wagons.length) - freightWeight(s.freight);
      if (inDepot < qty || GOODS[good].weight * qty > room) return false;
      set({
        ...(good === "IRON" ? { iron: s.iron - qty } : { depot: { ...s.depot, [good]: inDepot - qty } }),
        freight: addLot(s.freight, { good, qty, from: "CAMP", faction: null, cost: 0 }),
      });
      return true;
    }
    const n = -qty;
    if (freightOf(s.freight, good) < n) return false;
    set({
      ...(good === "IRON" ? { iron: s.iron + n } : { depot: { ...s.depot, [good]: inDepot + n } }),
      freight: takeLots(s.freight, good, n).lots,
    });
    return true;
  },

  millFood: (good, qty) => {
    const s = get();
    if ((good !== "GRAIN" && good !== "MEAT") || qty <= 0 || (s.depot[good] ?? 0) < qty) return false;
    set({
      depot: { ...s.depot, [good]: (s.depot[good] ?? 0) - qty },
      rations: s.rations + qty * TRADE.RATIONS_PER_FOOD,
      log: appendLog(s.log, [entry(s.day, `A Intendência transformou ${qty} de ${GOODS[good].label.toLowerCase()} em ${qty * TRADE.RATIONS_PER_FOOD} rações.`)]),
    });
    return true;
  },

  setAleRation: (on) => set({ aleRation: on }),

  notePrices: (settlementId, source, ageDays = 0) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || t.owner === "RUINED") return;
    const note = noteOf(t.econ, s.day - ageDays, source);
    // Notícia velha: os preços daquele dia (o histórico guarda um a cada 2 dias)
    if (ageDays >= 2) {
      const back = Math.floor(ageDays / 2);
      for (const g of GOOD_LIST) {
        const h = t.econ.history[g] ?? [];
        if (h.length > back) note.prices[g] = h[h.length - 1 - back];
      }
    }
    set({ priceBook: addNote(s.priceBook, t.id, note) });
  },

  caravanDeparts: (from, good, qty, ownId) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === from);
    if (!t || qty <= 0) return 0;
    const n = Math.min(qty, Math.floor(t.econ.stock[good]));
    if (n <= 0) return 0;
    const value = quote(t.econ, good, n, "BUY").total;
    // Caravana própria: o bando paga a compra (sem ouro, ela parte vazia)
    if (ownId && s.gold < value) return 0;
    const tax = t.owner === "PLAYER" ? Math.round(value * TRADE.MARKET_TAX[t.marketTax ?? 1] * (t.buildings.includes("MARKET") ? 1.4 : 1)) : 0;
    set({
      settlements: s.settlements.map((x) =>
        x.id === from ? { ...x, econ: applyTrade(x.econ, good, n, "BUY"), prosperity: Math.min(100, x.prosperity + CARAVAN.PROSPERITY / 2) } : x,
      ),
      marketTaxIncome: s.marketTaxIncome + (ownId ? 0 : tax),
      ...(ownId ? { gold: s.gold - value } : {}),
    });
    return value;
  },

  roadToll: (towns) => {
    if (towns > 0) set((s) => ({ marketTaxIncome: s.marketTaxIncome + towns * TRADE.ROAD_TOLL }));
  },

  caravanArrives: (to, cargo) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === to);
    if (!t || t.owner === "RUINED" || cargo.qty <= 0) {
      if (cargo.own) set({ ownCaravans: s.ownCaravans.map((c) => (c.id === cargo.own ? { ...c, at: to, trips: c.trips + 1 } : c)) });
      return;
    }
    const { good, qty } = cargo;
    const value = quote(t.econ, good, qty, "SELL").total;
    const tax = t.owner === "PLAYER" && !cargo.own ? Math.round(value * TRADE.MARKET_TAX[t.marketTax ?? 1] * (t.buildings.includes("MARKET") ? 1.4 : 1)) : 0;
    // A febre viaja com os mercadores (Marco 13): de um povoado doente, às vezes chega junto
    const origin = s.settlements.find((x) => x.id === cargo.from);
    const fever = origin && isSick(origin, s.day) && !isSick(t, s.day) && Math.random() < 0.3;
    const settlements = s.settlements.map((x) =>
      x.id === to
        ? {
            ...x,
            econ: applyTrade(x.econ, good, qty, "SELL"),
            prosperity: Math.min(100, x.prosperity + CARAVAN.PROSPERITY),
            ...(fever ? { sickUntil: s.day + HEALTH.TOWN_SICK_DAYS } : {}),
          }
        : x,
    );
    const lines: LogEntry[] = fever ? [entry(s.day, `A febre de ${origin?.name} chegou a ${t.name} com uma caravana.`, t.owner === "PLAYER" ? "bad" : "info")] : [];
    const own = cargo.own ? s.ownCaravans.find((c) => c.id === cargo.own) : undefined;
    if (!own) {
      set({ settlements, marketTaxIncome: s.marketTaxIncome + tax, ...(lines.length ? { log: appendLog(s.log, lines) } : {}) });
      return;
    }
    const profit = value - Math.round(cargo.cost);
    lines.push(
      entry(s.day, `${own.name} vendeu ${qty} de ${GOODS[good].label.toLowerCase()} em ${t.name}: ${value} de ouro (${profit >= 0 ? "lucro" : "prejuízo"} de ${Math.abs(profit)}).`, profit >= 0 ? "good" : "info"),
    );
    set({
      settlements,
      gold: s.gold + value,
      ownCaravans: s.ownCaravans.map((c) => (c.id === cargo.own ? { ...c, trips: c.trips + 1, profit: c.profit + profit, at: to } : c)),
      priceBook: addNote(s.priceBook, t.id, noteOf(t.econ, s.day, "CARAVAN")),
      log: appendLog(s.log, lines),
    });
  },

  robCaravan: (band) => {
    const s = get();
    const room = Math.max(0, carryCapacity(s) - carriedWeight(s));
    const w = GOODS[band.good].weight;
    const kept = w > 0 ? Math.min(band.qty, Math.floor(room / w)) : band.qty;
    const atWar = s.factions.some((f) => f.id === band.ownerId && f.atWar);
    const factions = band.ownerId && !atWar ? s.factions.map((f) => (f.id === band.ownerId ? { ...f, relation: Math.max(-100, f.relation + CARAVAN.ROB_RELATION) } : f)) : s.factions;
    // Sabotagem: caravanas do reino inimigo do cliente contam
    let activeContract = s.activeContract;
    const c = activeContract?.contract;
    if (activeContract && c?.kind === "SABOTAGE" && band.ownerId === c.factionTarget) activeContract = { ...activeContract, progress: (activeContract.progress ?? 0) + 1 };
    const label = GOODS[band.good].label.toLowerCase();
    const text =
      kept > 0
        ? `Saqueamos ${band.name}: ${kept} de ${label} foram para as carroças${kept < band.qty ? ` (o resto ficou na estrada: não cabia)` : ""}.`
        : `Saqueamos ${band.name}, mas não havia onde levar a carga (${band.qty} de ${label} ficou na estrada).`;
    const lines = [entry(s.day, text, "info")];
    if (!atWar) lines.push(entry(s.day, `Roubar mercadores mancha o nome do bando (honra ${CARAVAN.ROB_HONOR}).`, "bad"));
    set({
      freight: kept > 0 ? addLot(s.freight, { good: band.good, qty: kept, from: "LOOT", faction: band.ownerId && isFactionOwner(band.ownerId) ? band.ownerId : null, cost: 0 }) : s.freight,
      honor: atWar ? s.honor : Math.max(0, s.honor + CARAVAN.ROB_HONOR),
      fear: Math.min(100, s.fear + REPUTE.FEAR.ROB),
      factions,
      activeContract,
      log: appendLog(s.log, lines),
    });
    if (activeContract && c?.kind === "SABOTAGE" && (activeContract.progress ?? 0) >= (c.need ?? 1)) get().finishContract(true, "as caravanas do inimigo não chegaram");
    return text;
  },

  caravanStolen: (band) => {
    const s = get();
    set({ stolenCargo: [...s.stolenCargo.filter((c) => c.bandId !== band.bandId), { ...band, day: s.day }].slice(-6) });
  },

  ownCaravanLost: (id, by) => {
    const s = get();
    const c = s.ownCaravans.find((x) => x.id === id);
    if (!c || c.lost) return;
    set({
      ownCaravans: s.ownCaravans.map((x) => (x.id === id ? { ...x, lost: s.day } : x)),
      log: appendLog(s.log, [entry(s.day, `${c.name} foi destruída por ${by}. A carga e a carroça se perderam.`, "bad")]),
    });
  },

  recoverCargo: (bandId) => {
    const s = get();
    const lost = s.stolenCargo.find((c) => c.bandId === bandId);
    if (!lost) return null;
    const room = Math.max(0, carryCapacity(s) - carriedWeight(s));
    const w = GOODS[lost.good].weight;
    const kept = w > 0 ? Math.min(lost.qty, Math.floor(room / w)) : lost.qty;
    let activeContract = s.activeContract;
    if (activeContract?.contract.kind === "RECOVER" && activeContract.contract.bandId === bandId) {
      activeContract = { ...activeContract, recovered: true, contract: { ...activeContract.contract, qty: Math.min(activeContract.contract.qty ?? kept, Math.max(1, kept)) } };
    }
    const text = `Carga recuperada do ${lost.bandName}: ${kept} de ${GOODS[lost.good].label.toLowerCase()}${kept < lost.qty ? " (o resto não cabia nas carroças)" : ""}.`;
    set({
      stolenCargo: s.stolenCargo.filter((c) => c.bandId !== bandId),
      freight: kept > 0 ? addLot(s.freight, { good: lost.good, qty: kept, from: "LOOT", faction: null, cost: 0 }) : s.freight,
      activeContract,
      log: appendLog(s.log, [entry(s.day, text, "good")]),
    });
    return text;
  },

  buyPost: (settlementId) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || s.posts.includes(t.id) || s.gold < TRADE.POST_COST || t.owner === "RUINED" || isCalamityOwner(t.owner)) return false;
    set({
      gold: s.gold - TRADE.POST_COST,
      posts: [...s.posts, t.id],
      priceBook: addNote(s.priceBook, t.id, noteOf(t.econ, s.day, "POST")),
      log: appendLog(s.log, [entry(s.day, `O bando abriu uma feitoria em ${t.name}: preços frescos todo dia e negócios com margem melhor.`, "good")]),
    });
    return true;
  },

  investGuild: (settlementId, building) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || t.owner === "PLAYER" || t.owner === "RUINED" || isCalamityOwner(t.owner) || s.gold < TRADE.GUILD_COST) return false;
    if (!GUILD_BUILDINGS.includes(building) || t.buildings.includes(building) || !canHost(t, building)) return false;
    set({
      gold: s.gold - TRADE.GUILD_COST,
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, buildings: [...x.buildings, building] } : x)),
      stakes: [...s.stakes, { settlementId: t.id, building, invested: TRADE.GUILD_COST, since: s.day, paid: 0 }],
      log: appendLog(s.log, [entry(s.day, `O bando investiu ${TRADE.GUILD_COST} de ouro na guilda de ${t.name}: ${BUILDINGS[building].label} (dividendos toda semana).`, "good")]),
    });
    return true;
  },

  takeLoan: (settlementId, amount) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || t.kind === "VILLAGE" || s.loans.some((l) => l.from === t.id) || !(TRADE.LOAN_SIZES as readonly number[]).includes(amount)) return false;
    const loan: Loan = { id: crypto.randomUUID(), from: t.id, principal: amount, interest: Math.round(amount * TRADE.LOAN_INTEREST), dueDay: s.day + TRADE.LOAN_WEEKS * 7, missed: 0 };
    set({
      gold: s.gold + amount,
      loans: [...s.loans, loan],
      log: appendLog(s.log, [entry(s.day, `Empréstimo de ${amount} de ouro da casa de câmbio de ${t.name}: ${loan.interest} de juros por semana, vence no dia ${loan.dueDay}.`)]),
    });
    return true;
  },

  repayLoan: (id) => {
    const s = get();
    const loan = s.loans.find((l) => l.id === id);
    if (!loan || s.gold < loan.principal) return false;
    set({
      gold: s.gold - loan.principal,
      loans: s.loans.filter((l) => l.id !== id),
      log: appendLog(s.log, [entry(s.day, `Empréstimo de ${townName(s.settlements, loan.from)} quitado antes do prazo.`, "good")]),
    });
    return true;
  },

  hireOwnCaravan: (a, b) => {
    const s = get();
    const alive = s.ownCaravans.filter((c) => !c.lost);
    if (!s.world || a === b || alive.length >= TRADE.OWN_CARAVAN_MAX || s.gold < TRADE.OWN_CARAVAN_COST) return false;
    const n = s.ownCaravans.length + 1;
    const caravan: OwnCaravan = { id: crypto.randomUUID(), name: `Caravana nº ${n} dos ${s.world.bandName}`, a, b, trips: 0, profit: 0 };
    set({
      gold: s.gold - TRADE.OWN_CARAVAN_COST,
      ownCaravans: [...s.ownCaravans, caravan],
      log: appendLog(s.log, [entry(s.day, `${caravan.name} vai fazer a rota ${townName(s.settlements, a)} ↔ ${townName(s.settlements, b)}.`, "good")]),
    });
    return true;
  },

  dismissOwnCaravan: (id) => set((s) => ({ ownCaravans: s.ownCaravans.filter((c) => c.id !== id) })),

  setMarketTax: (settlementId, rate) =>
    set((s) => ({ settlements: s.settlements.map((t) => (t.id === settlementId && t.owner === "PLAYER" ? { ...t, marketTax: rate } : t)) })),

  buyRound: (settlementId) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || s.gold < TRADE.TAVERN_ROUND) return "Falta ouro para a rodada.";
    // Viajantes contam os preços de mercados de longe (com o atraso da viagem deles)
    const others = s.settlements
      .filter((x) => x.id !== t.id && x.owner !== "RUINED")
      .map((x) => ({ x, d: distance(x, t) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    const heard = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    let priceBook = s.priceBook;
    const parts: string[] = [];
    for (const { x, d } of heard) {
      const age = Math.max(1, Math.round(d / WORLD.DAY_DISTANCE));
      const note = noteOf(x.econ, s.day - age, "TAVERN");
      priceBook = addNote(priceBook, x.id, note);
      const dear = GOOD_LIST.filter((g) => x.econ.price[g] >= GOODS[g].base * 1.8);
      const cheap = GOOD_LIST.filter((g) => x.econ.price[g] <= GOODS[g].base * 0.5);
      parts.push(
        `${x.name} (há ${age} dia(s)): ${dear.length ? `falta ${dear.map((g) => GOODS[g].label.toLowerCase()).join(", ")}` : "nada em falta"}${
          cheap.length ? `; sobra ${cheap.map((g) => GOODS[g].label.toLowerCase()).join(", ")}` : ""
        }`,
      );
    }
    const war = s.wars.find((w) => w.peace === undefined);
    const famine = s.settlements.find((x) => x.econ.famine && x.id !== t.id);
    const name = (id: string) => s.world?.factions.find((f) => f.id === id)?.name ?? "?";
    const news = war ? ` Dizem que o ${name(war.a)} e o ${name(war.b)} estão em guerra: armas e cavalos valem ouro na fronteira.` : famine ? ` Contam que há fome em ${famine.name}.` : "";
    const text = `Os viajantes falam: ${parts.join(" · ")}.${news}`;
    set({ gold: s.gold - TRADE.TAVERN_ROUND, campMood: Math.min(30, s.campMood + 1), priceBook, log: appendLog(s.log, [entry(s.day, `Na taverna de ${t.name}: ${text}`)]) });
    return text;
  },

  donateTemple: (settlementId, gold) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || gold <= 0 || s.gold < gold) return false;
    const sick = isSick(t, s.day);
    set({
      gold: s.gold - gold,
      honor: Math.min(100, s.honor + Math.min(6, Math.round(gold / 10))),
      campMood: Math.min(30, s.campMood + 2),
      settlements: s.settlements.map((x) => (x.id === t.id && sick ? { ...x, sickUntil: Math.max(s.day, (x.sickUntil ?? s.day) - 3) } : x)),
      log: appendLog(s.log, [entry(s.day, `O Comandante deu ${gold} de ouro ao templo de ${t.name}.${sick ? " Os monges cuidam melhor dos febris." : ""}`, "good")]),
    });
    return true;
  },

  giveFood: (settlementId) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    const food = (["GRAIN", "MEAT"] as Good[]).find((g) => freightOf(s.freight, g) > 0);
    if (!t || !food) return false;
    set({
      freight: takeLots(s.freight, food, 1).lots,
      honor: Math.min(100, s.honor + 2),
      settlements: s.settlements.map((x) => (x.id === t.id ? { ...x, econ: restock(x.econ, { [food]: 1 }) } : x)),
      log: appendLog(s.log, [entry(s.day, `O Comandante deu ${GOODS[food].label.toLowerCase()} a uma família faminta de ${t.name}.`, "good")]),
    });
    return true;
  },

  setCampStay: (ids) => set({ campStay: ids }),
  setRationLoad: (share) => set({ rationLoad: Math.max(0.25, Math.min(1, share)) }),
  enterInterior: (ref) => set({ interior: ref, dialog: null, campPanel: null, campPrompt: null, contextMenu: null }),
  leaveInterior: () => set({ interior: null, dialog: null, campPanel: null, campPrompt: null }),
  setDialog: (dialog) => set({ dialog }),

  trainBattalions: (ids) => {
    const s = get();
    const trainees = s.battalions.filter(
      (b) => ids.includes(b.id) && b.level < PROGRESSION.MAX_LEVEL && !s.training.some((t) => t.battalionId === b.id),
    );
    const cost = trainees.length * PROGRESSION.TRAINING_COST;
    if (trainees.length === 0 || s.gold < cost || s.pendingMutiny) return false;
    // O treino acontece de verdade no Campo de Treino; o tempo corre (rações, pagamento) e o XP vem no fim
    const until = s.day + s.dayProgress + PROGRESSION.TRAINING_DAYS;
    set({
      gold: s.gold - cost,
      training: [...s.training, ...trainees.map((b) => ({ battalionId: b.id, until }))],
      log: appendLog(s.log, [
        entry(s.day, `${trainees.map((b) => b.name).join(", ")} foram para o Campo de Treino: ${PROGRESSION.TRAINING_DAYS} dias de treino (${cost} de ouro).`),
      ]),
    });
    return true;
  },

  finishTraining: () => {
    const s = get();
    const now = s.day + s.dayProgress;
    const exists = (t: TrainingOrder) => s.battalions.some((b) => b.id === t.battalionId);
    const due = s.training.filter((t) => exists(t) && t.until <= now + 1e-6);
    const stale = s.training.filter((t) => !exists(t));
    if (due.length === 0 && stale.length === 0) return [];
    const entries: LogEntry[] = [];
    const battalions = s.battalions.map((b) => {
      if (!due.some((t) => t.battalionId === b.id)) return b;
      const leader = s.lieutenants.find((l) => l.battalionId === b.id);
      const xp = Math.round(PROGRESSION.TRAINING_XP * (leader ? (PASSIVES[leader.passive].xp ?? 1) : 1));
      const { battalion, levelsGained } = gainXp(b, xp);
      entries.push(entry(s.day, `${b.name} terminou o treino (+${xp} XP).`, "good"));
      if (levelsGained > 0) entries.push(entry(s.day, `${b.name} subiu para o nível ${battalion.level}!`, "good"));
      return battalion;
    });
    set({
      battalions,
      training: s.training.filter((t) => !due.includes(t) && !stale.includes(t)),
      log: appendLog(s.log, entries),
    });
    return due.map((t) => t.battalionId);
  },

  cancelTraining: (battalionId) => set((s) => ({ training: s.training.filter((t) => t.battalionId !== battalionId) })),

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
    const cost = forgeCost(b.equipment[slot], hasFollower(s.followers, "SMITH"));
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

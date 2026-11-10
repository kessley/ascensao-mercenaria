import { create } from "zustand";
import {
  AGENTS,
  BALANCE,
  ECONOMY,
  LIEUTENANTS,
  CAPTAINS,
  EXPEDITION,
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
  HEALTH,
  GOODS,
  GOOD_LIST,
  CARAVAN,
  TRADE,
  KINGDOM,
  REPUTE,
  COURT,
  FAITH,
  setWorldSize,
  type Good,
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
  type RealmState,
  type Settlement,
} from "../game/sim/realm";
import { applyTrade, foodGood, initEconomy, quote, rationPackPrice } from "../game/sim/market";
import { generateNobles } from "../game/sim/nobility";
import { hearRumors, rumorLine, type Ear, type Rumor } from "../game/sim/rumors";
import { INITIAL_COURT, courtSlice, type CourtActions, type CourtState } from "./courtSlice";
import { FOUNDER, INITIAL_LEGACY, legacySlice, type LegacyActions, type LegacyState } from "./legacySlice";
import { leaderBonus, type Leader } from "../game/sim/legacy";
import type { SiteLife } from "../game/sim/siteLife";
import { trimAnnals } from "../game/sim/legends";
import { rememberSaga, type SagaRecord } from "../game/data/sagas";
import { personName } from "../game/worldgen/names";
import { CONTINENT_KEYS, INITIAL_SEA, seaSlice, type ContinentKey, type SeaActions, type SeaState } from "./seaSlice";
import { INITIAL_WAR, warSlice, type WarActions, type WarState } from "./warSlice";
import { fieldCampOf } from "../game/sim/fortress";
import { INITIAL_FORTRESS, fortressSlice, ironBuyPrice, migrateSeatCity, type FortressActions, type FortressState } from "./fortressSlice";
import { INITIAL_MAGIC, magicSlice, type MagicActions, type MagicState } from "./magicSlice";
import { courtMageSpell, spellDef, SPELL_IDS, type SpellId } from "../game/sim/magic";

/** A magia no HUD da batalha (Marco 19). */
export interface MagicHud {
  arcane: number;
  max: number;
  aiming: SpellId | null;
  spells: { id: SpellId; name: string; hint: string; cost: number; readyIn: number; key: string }[];
}
import { realmFigures, type SeatCity } from "../game/sim/seatCity";
import { INITIAL_CAPTAINS, allCaptains, captainSlice, captainsWeek, desertions, freshCaptains, pruneCompanies, shiftLoyalty, type CaptainActions, type CaptainState } from "./captainSlice";
import { captainName, type CaptainData } from "../game/data/captains";
import type { CompanyHud, CompanyStance } from "../game/sim/companies";
import { SCENARIO_TOWN, buildScenarioWorld, noteResult, scenarioDay, scenarioProgress, type BattleScenario, type ScenarioHud, type ScenarioResult } from "../game/data/scenarios";
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
import { nameIn, ofRealm, settlementName } from "../game/worldgen/names";
import { TONGUE, barrierOf, garble, heardNote, interpreterTitle, isFluent, learnDay, priceMargin, voiceFor, type Voice } from "../game/sim/language";
import { hashString } from "../utils/hash";
import { continentWorld, generateWorld } from "../game/worldgen/generateWorld";
import { generatePlanet, type CultureId } from "../game/data/planet";
import { BAND_HOME, CULTURE_IDS, cultureOf, folkOf, mainCulture, nearestFolk, officerCulture, pickCulture } from "../game/sim/culture";
import { FAITHS, addFavor, decayFavor, factionFaith, faithMix, faithOf, faithToday, fastEnds, fastKey, friction, isFasting, isHolyDay, keeps, pickFaith, preacherShare, townFaith, type FaithFavor, type FaithId } from "../game/sim/faith";
import { LANGUAGE, LEGACY, MAGIC } from "../utils/constants";
import { captureField, readSave, writeSave, type FieldSave } from "../game/save/saveGame";
import {
  FOLLOWERS,
  applyCampEvent,
  driftBonds,
  hasFollower,
  newFollower,
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
import { NO_EXPOSURE, convoyDays, convoyFate, eatDay, fillPacks, healthDay, loadAmount, packCapacity, packOf, packsTotal, takeFieldFood, woundedOf, type Exposure, type Sickness } from "../game/sim/logistics";
import { campDefAt } from "../game/data/campLayout";
import {
  CAMP_BUILDINGS,
  DITCH,
  PALISADE as PALISADE_STEPS,
  TAVERN_HIRE,
  VOLUNTEERS,
  VOLUNTEER_COST,
  RAW_FOOD,
  bedsOf,
  buildProblem,
  cooksOf,
  costText,
  crowdLimit,
  isBuilt,
  moodOf,
  newWork,
  readyOf,
  ready,
  running,
  sickBedsOf,
  workOf,
  gateProblem,
  growProblem,
  grown,
  guardOf,
  legacyPlan,
  lieutenantSlots,
  needsOf,
  nextSize,
  packPlan,
  placeProblem,
  refundOf,
  shortOf,
  startingPlan,
  tierOf,
  isFortress,
  troopProblem,
  upgradeCost,
  volunteerRate,
  type CampCost,
  type CampKind,
  type CampPlan,
  type CampSide,
} from "../game/data/campGrid";
import {
  carpentryCost,
  DICE_BRAWL,
  advanceWorks,
  bedded,
  campProduce,
  carpentryProblem,
  driftMood,
  moodTarget,
  shiftXp,
  staffPosts,
  upkeepOf,
  type CarpentryItem,
  type Shift,
  type SiegeKit,
  type Staffing,
} from "../game/sim/campDays";
import { seasonDay, seasonOf } from "../utils/season";
import { canPromote, canTrain, promotionCost, trainingCost, canLearn, forgeCost, gainXp, type EquipmentSlot } from "../utils/progression";
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
import { newId } from "../utils/id";
import { canDelegate, captainReport, expeditionDays, expeditionRations, resolveExpedition } from "../game/sim/expeditions";

/** Um batalhão no Campo de Treino: treina de verdade até `until` (dia + fração do dia). */
export interface TrainingOrder {
  battalionId: string;
  until: number;
}

/** Painel aberto ao interagir com um local (do acampamento ou de uma cidade). */
export type CampPanel =
  /** Os locais de antes do Marco 22, agora construções da planta (`buildingId`). */
  | { kind: "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE"; buildingId?: string }
  /** Uma construção nova do Marco 22 (mastro, tenda dos oficiais, cozinha, enfermaria, poço...). */
  | { kind: "CAMP_BUILDING"; buildingId: string }
  /** A planta do acampamento: construir, o portão, a paliçada e as necessidades. */
  | { kind: "CAMP_PLAN" }
  /** Banca do mascate (seguidor): vinho, ataduras, cobertores. */
  | { kind: "PEDDLER" }
  | { kind: "BATTALION"; battalionId: string }
  | { kind: "LIEUTENANT"; lieutenantId: string }
  | { kind: "CAPTAIN"; captainId: string }
  /** Comida em campo, carroças e comboio de suprimentos (rações refeitas na Fase 3). */
  | { kind: "SUPPLY" }
  | { kind: "STABLE"; buildingId?: string }
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
  | { kind: "GAME" }
  /** Diário de missões: contrato, tropas fora e favores da corte. */
  | { kind: "MISSIONS" }
  /** Cais de um porto (Marco 17): cartas náuticas, navios e viagens. */
  | { kind: "DOCK"; settlementId: string }
  /** Livro do Bando (Marco 18): o Comandante, o testamento, as ambições e as Lendas. */
  | { kind: "SAGA" };

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
  /** Comida na mochila (rações refeitas na Fase 3): ver `packCapacity`. */
  pack?: number;
  sickness?: Sickness;
  /** De onde a tropa veio (Marco 23); sem o campo, da terra natal do bando. */
  culture?: CultureId;
  /** A fé da tropa (Marco 23); sem o campo, a da terra de onde veio. */
  faith?: FaithId;
}

/** Mortos do bando esperando enterro no campo (Marco 23): quem guarda o preceito não quer marchar antes. */
export interface Unburied {
  x: number;
  y: number;
  day: number;
  dead: number;
  faiths: FaithId[];
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

/**
 * Onde as carroças estão (rações refeitas na Fase 3): paradas no acampamento (o normal: cada
 * batalhão leva a própria comida), andando com o exército ou na estrada, num comboio.
 */
export type WagonTrain = "CAMP" | "ARMY" | "ROAD";

/** Comboio de suprimentos a caminho do exército (ou voltando ao acampamento). */
export interface SupplyConvoy {
  id: string;
  departAt: number;
  arriveAt: number;
  /** De onde saiu (o acampamento, ou onde o exército estava, na volta). */
  from: { x: number; y: number };
  /** Rações que leva. */
  load: number;
  /** Quem escolta (sai do acampamento com o comboio e fica com o exército). */
  escort: BattalionData[];
  /** Voltando para o acampamento, com o que sobrou. */
  returning: boolean;
}

export type BattalionStatus = "READY" | "MOVING" | "ENGAGED" | "FLEEING" | "DESTROYED";

/** As barras de um duelista: vida, fôlego e postura de 0 a 1. */
export interface DuelistHud {
  name: string;
  hp: number;
  stamina: number;
  posture: number;
  /** Do nosso lado. */
  ally: boolean;
}

/** O duelo no campo: quem luta e quanto falta para os homens separarem os dois. */
export interface DuelHud {
  /** Sem o Comandante (um capitão nosso): as duas cabeças lutam sozinhas. */
  auto: boolean;
  /** Segundos até o fim do tempo. */
  left: number;
  fighters: [DuelistHud, DuelistHud];
}

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
    /** Em passo acelerado. */
    running: boolean;
    /** Apanhando pelo lado ou por trás agora. */
    flanked: boolean;
    /** Tiros que restam (null = não atira). */
    ammo: number | null;
    holdFire: boolean;
    cycle: boolean;
    kiting: boolean;
    /** Cavalaria de choque: sabe investir em ciclo. */
    mayCycle: boolean;
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
  /** Companhias em campo (Marco 20): quem manda, a postura e o plano que o capitão escolheu. */
  companies: CompanyHud[];
  /** Comandantes inimigos à vista (Marco 16): quem são e como estão. */
  foes: { key: string; name: string; trait: NobleTrait | null; status: string; morale: number; count: number }[];
  /** Situação de batedores/mensageiros (usada também no recuo). */
  support: SupportReport;
  /** Câmera presa no Comandante ou solta; zoom atual. */
  camera: { locked: boolean; zoom: number };
  /** Segundos até o próximo grito de guerra (0 = pronto). */
  warCryIn: number;
  /** A magia do Comandante (Marco 19); null = ele não sabe nenhuma. */
  magic: MagicHud | null;
  /** O mundo está parado, esperando ordens. */
  tacticalPause: boolean;
  /** Onde o Comandante está. */
  position: { x: number; y: number };
  /** Caravana sob escolta, se houver. */
  escort: { x: number; y: number; waiting: boolean } | null;
  /** Câmera lenta: ms que faltam e ms de espera até poder usar de novo. */
  slow: { left: number; wait: number };
  /** Duelo no campo (Marco 21) em andamento, ou null. */
  duel: DuelHud | null;
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
  /** A muralha da fortaleza cabe em volta do acampamento? null = sim (Marco 22, parte 3). */
  standardBlocked: string | null;
  /** Pode montar o acampamento de campo aqui? null = sim. */
  fieldBlocked: string | null;
  /** Carroças perto do Comandante (Marco 14): dá para comprar e vender carga pesada. */
  wagonsNear: boolean;
}

/** Diálogo num interior (Marco 14): quem fala, o texto e as respostas (a cena trata a escolha). */
export interface Dialog {
  speaker: string;
  text: string;
  options: { id: string; label: string }[];
  /** Quando quem fala é um nobre: a caixa mostra o retrato dele (G5). */
  nobleId?: string;
  /** Em que língua veio a fala, e quem traduziu (Marco 23). */
  tongue?: string;
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
  /** O capitão que marchou com este batalhão (Marco 20). */
  captainId?: string;
  captainAlive?: boolean;
  captainKills?: number;
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

/** Tropas cumprindo um contrato sem o Comandante: marcham até o serviço e voltam (ver ExpeditionParty). */
export interface Expedition {
  id: string;
  contract: Contract;
  battalions: BattalionData[];
  departDay: number;
  /** Momento exato da partida (dia com a fração). */
  departAt?: number;
  returnDay: number;
  /** Por onde vai (a cena traça a rota quando a tropa sai do campo). */
  path?: Point[];
  /** Ponto da rota em que o serviço começa. */
  meet?: number;
  /** Quem conduz a companhia (Marco 20); fica fora da lista de capitães até voltar. */
  captain?: CaptainData;
}

/** No que deu uma expedição (fica no diário). */
export interface ExpeditionReport {
  id: string;
  title: string;
  success: boolean;
  gold: number;
  casualties: number;
  lost: string[];
  day: number;
  /** O capitão e o relatório dele, na voz dele (Marco 20). */
  captain?: string;
  lines?: string[];
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
export type SiegeAction = "WAIT" | "LADDER" | "RAM" | "ASSAULT" | "LIFT" | "DEMAND" | "PLANT_LADDER" | "SEND_RAM";

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
  /** Onde foi o combate (os mortos ficam ali; Marco 23). */
  at?: { x: number; y: number };
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
  /** Ordem larga a uma companhia (Marco 20): `ids` = [id do capitão]. */
  | { type: "COMPANY"; ids: string[]; stance: CompanyStance }
  /** Toque de trombeta pré-combinado para os batalhões `ids` (vazio = todo o exército). */
  | { type: "TRUMPET"; ids: string[]; call: TrumpetCall }
  | { type: "WAR_CRY"; ids: string[] }
  /** Arma (ou desarma) a mira de uma magia do Comandante (Marco 19). */
  | { type: "SPELL"; ids: string[]; spell: SpellId }
  /** Pausa tática liga/desliga; selecionados correm ou voltam ao passo. */
  | { type: "TACTICAL_PAUSE" | "RUN" | "SLOW_MOTION" | "HOLD_FIRE" | "CYCLE" | "KITE"; ids: string[] }
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
  | { type: "FORCED_MARCH" | "FORAGE" | "PACK_CAMP" | "PITCH_CAMP" | "FIELD_CAMP"; ids: string[] };

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

export interface GameState extends CourtState, CourtActions, WarState, WarActions, SeaState, SeaActions, LegacyState, LegacyActions, CaptainState, CaptainActions, FortressState, FortressActions, MagicState, MagicActions {
  /** Mesma semente, séculos depois de uma saga terminada. */
  revisitSaga: (saga: SagaRecord) => void;
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
  /** Moradores dos locais de missão: o quanto cada um tinha e desde quando (sem registro, cheio). */
  siteLife: Record<string, SiteLife>;
  messengers: MessengerData[];
  contracts: Contract[];
  log: LogEntry[];

  // --- Mundo (Marco 7) ---
  /** Fração do dia corrente (0–1); o relógio anda com a marcha e com o tempo fora do acampamento. */
  dayProgress: number;
  activeContract: ActiveContract | null;
  /** Tropas fora, cumprindo contratos por conta própria. */
  expeditions: Expedition[];
  expeditionReports: ExpeditionReport[];
  /** Manda um capitão e a companhia dele cumprirem uma oferta sem o Comandante; devolve o motivo se não der. */
  sendExpedition: (contractId: string, captainId: string) => string | null;
  /** Quem já cumpriu o tempo fora volta e presta contas. */
  returnExpeditions: () => void;
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
  /** O que cada templo pensa do bando (Marco 23): o sacerdote fala por ele, ou contra, na corte. */
  faithFavor: FaithFavor;
  /** Mortos do último combate esperando enterro (Marco 23). */
  unburied: Unburied | null;
  /** Jejuns quebrados ("FÉ:ano"). */
  fastBroken: string[];
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
  /** Rações que marcham fora das mochilas: a bolsa do Comandante e, com o exército, as carroças. */
  cargo: number;
  train: WagonTrain;
  convoy: SupplyConvoy | null;
  /** Ao sair do acampamento, as carroças vão junto (escolha do Portão). */
  takeWagons: boolean;
  setTakeWagons: (take: boolean) => void;
  /** Manda as carroças do acampamento ao exército, carregadas, com a escolta escolhida; devolve o motivo se não der. */
  sendSupplies: (escortIds: string[]) => string | null;
  /** As carroças que andam com o exército voltam ao acampamento com o que sobrou. */
  sendWagonsHome: () => string | null;
  /** O comboio chegou (a cena chama quando o relógio manda). */
  convoyArrives: () => void;
  /** Onde o exército está e o que o expõe (fome, pântano, frio, febre): a cena informa. */
  exposure: Exposure;
  /** Esgotamento da forragem por região ("col,row" → 0..1). */
  forage: Record<string, number>;
  /** Acampamento montado em outro lugar (fogueira); null = onde o mundo o pôs. */
  campAt: Point | null;
  /** Acampamento levantado: tudo nas carroças, à procura de um lugar novo. */
  campPacked: boolean;
  /** A planta do acampamento na grade (Marco 22): construções, paliçada, portão e fosso. Viaja nas carroças. */
  campPlan: CampPlan;
  /** Voluntários que o mastro de recrutamento atraiu e esperam para formar um batalhão. */
  volunteers: number;
  /** Taverna de cada povoado: o dia em que o bando contratou um batalhão lá pela última vez. */
  tavernHires: Record<string, number>;
  /** Turno de cada batalhão no acampamento (Marco 22, parte 2); sem entrada, descanso. */
  shifts: Record<string, Shift>;
  /** Quanto da volta do acampamento é floresta (0 a 1): o lenhador tira madeira dela. */
  campForest: number;
  /** Escadas e aríetes da carpintaria, prontos para o próximo cerco (vão com o exército). */
  siegeKit: SiegeKit;
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
  /** Ataque ao acampamento: desguarnecido, ou de surpresa (há gente, mas ninguém de guarda). */
  raidCamp: (band: string, surprise?: boolean) => void;
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
  // --- A planta do acampamento (Marco 22): cada uma devolve o motivo se não der ---
  placeBuilding: (kind: CampKind, x: number, y: number) => string | null;
  moveBuilding: (id: string, x: number, y: number) => string | null;
  dismantleBuilding: (id: string) => string | null;
  upgradeBuilding: (id: string) => string | null;
  setCampGate: (side: CampSide) => string | null;
  growPalisade: () => string | null;
  digDitch: () => string | null;
  /** Os voluntários do mastro formam um batalhão de infantaria (só o equipamento se paga). */
  formVolunteers: () => string | null;
  /** Taverna de um povoado: um batalhão de infantaria por semana, mais caro. */
  hireAtTavern: (settlementId: string) => string | null;
  /** Taverna: um intérprete de uma língua que se fala ali e o Comandante não fala (Marco 23). */
  hireInterpreter: (settlementId: string) => string | null;
  /** Os dias passados num lugar: o Comandante aprende a língua de lá (Marco 23). */
  languageDay: (days: number) => void;
  /** O turno de um batalhão no acampamento. */
  setShift: (battalionId: string, shift: Shift) => void;
  /** Fecha ou abre um posto (o trabalhador fica livre). */
  togglePost: (buildingId: string) => void;
  /** A carpintaria faz uma carroça, uma escada ou o aríete. */
  carpentry: (item: CarpentryItem) => string | null;
  setCampForest: (share: number) => void;
  /** Compra na banca do mascate. */
  buyFromPeddler: (item: PeddlerItem) => boolean;
  /** Levanta o acampamento: a planta vai nas carroças (o que não cabe fica). Devolve o motivo se não der. */
  packCamp: () => string | null;
  /** Monta o acampamento com a fogueira em `center`; o campo (posições) é recriado a partir de `field`. */
  pitchCamp: (center: Point, field: FieldSave, wood?: number, forest?: number) => void;

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
  /** Enterrar os mortos do último combate: leva horas, e os fiéis agradecem (Marco 23). */
  buryDead: () => string | null;
  /** O exército se afastou dos mortos sem enterrá-los. */
  leaveDead: () => void;
  /** Quebrar o jejum de uma fé: os fiéis comem e lutam inteiros, e o templo não perdoa. */
  breakFast: (faith: FaithId) => string | null;
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
  /** Muda o ofício do batalhão; devolve o motivo se não der. */
  promoteBattalion: (battalionId: string, to: TroopType) => string | null;
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
  setSiteLife: (id: string, life: SiteLife) => void;
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
  /** Modo construção (Marco 22): a peça fantasma segue o ponteiro até o clique (null = fora do modo). */
  campBuild: { kind: CampKind; moveId?: string } | null;
  setCampBuild: (build: { kind: CampKind; moveId?: string } | null) => void;
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

function newBattalion(existing: BattalionData[], troopType: TroopType, origin?: { culture?: CultureId; faith?: FaithId }): BattalionData {
  const used = new Set(existing.map((b) => b.name));
  const name = BATTALION_NAMES.find((n) => !used.has(n)) ?? `Companhia ${existing.length + 1}`;
  return {
    id: newId(),
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
    ...(origin?.culture ? { culture: origin.culture } : {}),
    ...(origin?.faith ? { faith: origin.faith } : {}),
  };
}

/**
 * Quem se alista perto de um ponto: a gente do povoado mais perto, com a fé da sua terra ou a
 * dos pregadores (mais onde o rei se converteu) (Marco 23).
 */
function localRecruits(s: Pick<GameState, "settlements" | "world" | "factions">, at: { x: number; y: number } | undefined): { culture: CultureId; faith: FaithId } {
  const land = s.world?.culture ?? BAND_HOME;
  const town = at ? nearestFolk(s.settlements.filter((t) => t.owner !== "RUINED"), at) : null;
  const culture = town ? pickCulture(folkOf(town, land), Math.random()) : land;
  const owner = town ? s.factions.find((f) => f.id === town.owner) : undefined;
  return { culture, faith: pickFaith(culture, preacherShare(owner ? factionFaith(owner, land) : null), Math.random()) };
}

/** O templo de um povoado (Marco 23): o do rei, ou o da gente de lá. */
export function templeFaith(s: Pick<GameState, "factions" | "world">, t: Settlement): FaithId {
  const land = s.world?.culture ?? BAND_HOME;
  const owner = s.factions.find((f) => f.id === t.owner);
  return townFaith(mainCulture(folkOf(t, land)), owner ? factionFaith(owner, land) : null);
}

// --- As línguas (Marco 23, parte 3) ---

/** A língua de um povoado: a da gente de mais gente lá. */
export function townTongue(s: Pick<GameState, "world">, t: Settlement): CultureId {
  return mainCulture(folkOf(t, s.world?.culture ?? BAND_HOME));
}

/** A língua de onde se está: a do povoado mais perto, ou a da terra. */
export function placeTongue(s: Pick<GameState, "world" | "settlements">, at: Point | null | undefined): CultureId {
  const land = s.world?.culture ?? BAND_HOME;
  if (!at) return land;
  const t = nearestFolk(s.settlements.filter((x) => x.owner !== "RUINED"), at);
  return t && distance(t, at) < LANGUAGE.PLACE_RADIUS ? townTongue(s, t) : land;
}

type Speakers = Pick<GameState, "leader" | "lieutenants" | "captains" | "followers">;

/** Quem fala pelo bando numa língua (o Comandante, o intérprete, um oficial ou ninguém). */
export const voiceIn = (s: Speakers, t: CultureId): Voice => voiceFor(t, s);

/** O quanto o bando não entende numa língua (0 a 1). */
export const barrierIn = (s: Speakers, t: CultureId): number => barrierOf(voiceFor(t, s));

/** A barreira no povoado: a da língua da gente de lá. */
export const townBarrier = (s: Speakers & Pick<GameState, "world">, t: Settlement): number => barrierIn(s, townTongue(s, t));

/** Uma fala de gente de lá, como o Comandante a entende (com quem traduziu). */
export function heardIn(s: Speakers, t: CultureId, text: string, seed = ""): { text: string; tongue?: string } {
  const v = voiceFor(t, s);
  const note = heardNote(t, v);
  return { text: garble(text, t, barrierOf(v), hashString(seed)), ...(note ? { tongue: note } : {}) };
}

/** A língua do intérprete que a taverna oferece: a de mais gente ali que o Comandante ainda não fala. */
export function interpreterTongue(s: Pick<GameState, "world" | "leader">, t: Settlement): CultureId | null {
  const mix = folkOf(t, s.world?.culture ?? BAND_HOME);
  return CULTURE_IDS.filter((c) => mix[c] >= 0.05 && !isFluent(s.leader, c)).sort((a, b) => mix[b] - mix[a])[0] ?? null;
}

/** O exército deixou os mortos sem enterro: os templos dos fiéis que guardam o preceito não perdoam. */
function abandonDead(s: { unburied: Unburied | null; faithFavor: FaithFavor; campMood: number; day: number }): { faithFavor: FaithFavor; campMood: number; line: LogEntry } | null {
  const u = s.unburied;
  if (!u) return null;
  let favor = s.faithFavor;
  for (const f of u.faiths) favor = addFavor(favor, f, FAITH.UNBURIED_FAVOR);
  const who = u.faiths.map((f) => FAITHS[f].of).join(" e ");
  return {
    faithFavor: favor,
    campMood: Math.max(-30, s.campMood + FAITH.UNBURIED_MOOD),
    line: entry(s.day, `${u.dead} morto(s) do bando ficaram sem enterro. Os fiéis ${who} não perdoam: o humor do acampamento azedou.`, "bad"),
  };
}

/**
 * O dia das fés (Marco 23): as festas (um dia de rações a mais para os fiéis), o começo e o fim
 * dos jejuns, os mortos que ficaram sem enterro e, uma vez por semana, o capelão, o templo do
 * acampamento e os templos que esquecem devagar.
 */
function faithDay(s: DayState, worship: { altar: boolean; temple: boolean }, log: LogEntry[]): void {
  const today = faithToday(s.day);
  const present = new Set(s.battalions.filter((b) => b.soldiers > 0).map(faithOf));
  for (const f of present) {
    const def = FAITHS[f];
    if (today.feast.has(f)) {
      const faithful = s.battalions.filter((b) => faithOf(b) === f);
      const extra = Math.max(1, dailyRations(faithful, []) - 1);
      const field = s.exposure.away && !s.campPacked;
      if ((field ? s.cargo : s.rations) >= extra) {
        if (field) s.cargo -= extra;
        else s.rations -= extra;
        s.campMood = Math.min(30, s.campMood + FAITH.FEAST_MOOD);
        s.faithFavor = addFavor(s.faithFavor, f, FAITH.FEAST_FAVOR);
        log.push(entry(s.day, `${def.feast.label}: os fiéis ${def.of} comem e bebem (${extra} rações a mais), e o acampamento canta.`, "good"));
      } else {
        s.campMood = Math.max(-30, s.campMood + FAITH.FEAST_MISSED_MOOD);
        log.push(entry(s.day, `${def.feast.label}, e não há comida para a festa: os fiéis ${def.of} reclamam.`, "bad"));
      }
    }
    const fast = def.fast;
    if (fast && today.fasting.has(f) && !s.fastBroken.includes(fastKey(f, s.day))) {
      if (seasonDay(s.day) === fast.from) log.push(entry(s.day, `Começou o ${fast.label}: por ${fast.days} dias os fiéis ${def.of} comem a metade e batem com menos força. Dá para quebrar o jejum na tenda, mas o templo não perdoa.`, "info"));
      if (fastEnds(f, s.day)) {
        s.faithFavor = addFavor(s.faithFavor, f, FAITH.FAST_KEPT_FAVOR);
        log.push(entry(s.day, `Os fiéis ${def.of} cumpriram o ${fast.label}. O templo fala bem do bando.`, "good"));
      }
    }
  }
  // Os mortos de anteontem ficaram no campo (sem marchar, dá um dia para cavar)
  const left = s.unburied && s.day > s.unburied.day + 1 ? abandonDead(s) : null;
  if (left) {
    s.unburied = null;
    s.faithFavor = left.faithFavor;
    s.campMood = left.campMood;
    log.push(left.line);
  }
  if (s.day % ECONOMY.PAYDAY_INTERVAL !== 0) return;
  s.faithFavor = decayFavor(s.faithFavor);
  const chaplain = s.followers.find((x) => x.role === "CHAPLAIN");
  if (chaplain) s.faithFavor = addFavor(s.faithFavor, chaplain.faith ?? faithOf(null), FAITH.CHAPLAIN_FAVOR + (worship.temple ? FAITH.TEMPLE_FAVOR : 0));
}

/** Candidatos a tenente: gente da terra onde o bando está, e uns da terra natal (Marco 23). */
function freshLieutenants(day: number, land: CultureId = BAND_HOME): LieutenantData[] {
  return Array.from({ length: LIEUTENANTS.CANDIDATES }, () => generateLieutenant(day, officerCulture(Math.random(), land), land));
}

/** Bando inicial (Marco 22, GDD 9.9): um batalhão de infantaria só. */
function initialArmy(): BattalionData[] {
  const army: BattalionData[] = [];
  army.push(newBattalion(army, "INFANTRY"));
  return army;
}

/**
 * Save de antes do Marco 22 (ou um continente guardado dele): sem planta, o acampamento de hoje
 * vira a planta antiga (`legacyPlan`), com as obras que tinha. A lista de obras sai do save.
 */
export function migrateCampPlan(store: Record<string, unknown>, battalions?: number): void {
  if (!store.campPlan) {
    const works = Array.isArray(store.campWorks) ? (store.campWorks as string[]) : [];
    const n = battalions ?? (Array.isArray(store.battalions) ? store.battalions.length : 1);
    store.campPlan = legacyPlan(n, works);
  }
  delete store.campWorks;
}

/** A vila da sede vira um povoado do bando no reino (Marco 22, parte 4): no lugar da fortaleza, com nome novo. */
function seatSettlement(s: GameState, city: SeatCity): Settlement {
  const world = s.world as WorldDef;
  const at = world.camp.center;
  const fig = realmFigures(city);
  const name = settlementName(createRng(randomSeed()), new Set(s.settlements.map((t) => t.name)));
  const base = {
    id: `SEDE-${s.day}`,
    name,
    kind: fig.kind,
    x: Math.round(at.x),
    y: Math.round(at.y),
    owner: "PLAYER",
    prosperity: 55,
    population: fig.population,
    garrison: fig.garrison,
    buildings: [],
    taxRate: city.tax,
    market: { rationPrice: 0.8, ironBuy: 9, ironSell: 4 },
    description: `Nasceu em volta da fortaleza dos ${world.bandName}, fincada no dia ${city.since}.`,
    lastRaidDay: null,
    resources: resourcesAround(geoOf(world.geo), world.geo, at, createRng(Math.round(at.x * 31 + at.y))),
    seat: true,
  };
  return { ...base, econ: initEconomy(base) };
}

/** O que o bando tem para pagar uma construção: ouro, a madeira do depósito e o ferro. */
function stockOf(s: Pick<GameState, "gold" | "iron" | "depot">): { gold: number; wood: number; iron: number } {
  return { gold: s.gold, wood: s.depot.WOOD ?? 0, iron: s.iron };
}

/** Paga uma construção (o custo já foi conferido). */
function paid(s: Pick<GameState, "gold" | "iron" | "depot">, c: CampCost): Pick<GameState, "gold" | "iron" | "depot"> {
  return { gold: s.gold - c.gold, iron: s.iron - (c.iron ?? 0), depot: c.wood ? { ...s.depot, WOOD: (s.depot.WOOD ?? 0) - c.wood } : s.depot };
}

/** Não se mexe na planta com o acampamento levantado, em motim ou numa batalha personalizada. */
function campBusy(s: GameState): string | null {
  if (s.scenario) return "Não numa batalha personalizada.";
  if (s.campPacked) return "O acampamento está levantado.";
  if (s.mutiny) return "Motim no acampamento.";
  return null;
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
  "atlasOpen",
  "arrival",
  "legendsOpen",
  "epilogue",
  "worldSnapshot",
  "battleHud",
  "battleReport",
  "contextMenu",
  "battleCommands",
  "campPanel",
  "campPrompt",
  "campBuild",
  "interior",
  "dialog",
  "city",
  "duel",
  "scenario",
  "scenarioHud",
  "scenarioPaused",
  "scenarioResult",
  "menuTarget",
  "seatBattle",
]);

/** Uma terra nova: reinos, nobres e mercado dela; o bando chega sem nome e sem acampamento. */
function freshLand(world: WorldDef, day: number): Pick<GameState, ContinentKey> {
  const fresh = campaignState(world);
  const out = {} as Pick<GameState, ContinentKey>;
  for (const k of CONTINENT_KEYS) Object.assign(out, { [k]: fresh[k] });
  return { ...out, fame: 0, fear: 0, campPacked: true, nextCalamityDay: day + out.nextCalamityDay };
}
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
    siege: { settlementId: id, walled: true, startDay: s.day, food, wood: 0, ladders: s.siegeKit.ladders, ram: Math.min(1, s.siegeKit.rams) },
    siegeKit: { ladders: 0, rams: 0 },
    campPanel: null,
    log: appendLog(s.log, [
      entry(s.day, `Os portões de ${t.name} se fecharam: é um cerco. Lá dentro há comida para uns ${food} dias.`, "info"),
      ...(s.siegeKit.ladders + s.siegeKit.rams > 0
        ? [entry(s.day, `As carroças trouxeram o que a carpintaria fez: ${s.siegeKit.ladders} escada(s)${s.siegeKit.rams > 0 ? " e o aríete" : ""}.`, "good")]
        : []),
    ]),
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
  | "expeditions"
  | "lieutenants"
  | "captains"
  | "scouts"
  | "messengers"
  | "followers"
  | "campMood"
  | "faithFavor"
  | "unburied"
  | "fastBroken"
  | "bonds"
  | "cargo"
  | "train"
  | "exposure"
  | "training"
  | "campPacked"
  | "depot"
  | "freight"
  | "aleRation"
  | "campStay"
  | "campPlan"
  | "volunteers"
  | "fame"
  | "shifts"
  | "campForest"
  | "fortress"
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

    // Marco 22, parte 2: quem está no acampamento, os postos e quem dorme ao relento
    const staffing = s.campPacked ? null : campStaffing(s);
    const inCamp = inCampOf(s);
    const inBed = bedded(inCamp.map((b) => b.id), bedsOf(s.campPlan));
    const unbedded = staffing ? new Set(inCamp.filter((b) => !inBed.has(b.id)).map((b) => b.id)) : new Set<string>();
    // O humor do acampamento anda para o que as construções dão (levantado, volta ao normal);
    // tenentes convivendo se aproximam ou se afastam
    // Fés em conflito no bando azedam o humor; o altar e o templo do acampamento acalmam (Marco 23)
    const worship = { altar: !!staffing && running(s.campPlan, "ALTAR", staffing.working), temple: !!staffing && running(s.campPlan, "TEMPLE", staffing.working) };
    const quarrel = friction(faithMix(s.battalions), worship);
    s.campMood = driftMood(s.campMood, (staffing ? moodTarget(moodOf(s.campPlan, staffing.working), inCamp.length, unbedded.size) : 0) + quarrel.mood);
    s.bonds = driftBonds(s.bonds, s.lieutenants);

    // Comida (soldados, Comandante e seguidores; o cozinheiro aproveita melhor). Em campo, o
    // exército come o que as carroças levam; o depósito fica no acampamento (Marco 13). Quem
    // treina ou ficou guardando o acampamento (Marco 14) come do depósito
    const training = new Set([...s.training.map((t) => t.battalionId), ...(s.exposure.away ? s.campStay : [])]);
    // Grão e carne viram rações quando elas acabam: nas carroças, em campo; no depósito, no acampamento
    // A mercadoria anda nas carroças: só dá para moer o que está com o exército
    const fieldNeed = s.exposure.away && !s.campPacked && s.train === "ARMY" ? dailyRations(s.battalions.filter((b) => !training.has(b.id)), []) : 0;
    const packed = packsTotal(s.battalions.filter((b) => !training.has(b.id)));
    let milled = 0;
    while (s.cargo + packed < fieldNeed) {
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
    // O defumadouro faz rações de marcha: em campo, o exército gasta menos
    const smoked = staffing && running(s.campPlan, "SMOKEHOUSE", staffing.working) ? SMOKED_SHARE : 1;
    // Quem guarda o jejum da sua fé come a metade (Marco 23)
    const holy = faithToday(s.day);
    const fasting = new Set(s.battalions.filter((b) => holy.fasting.has(faithOf(b)) && !s.fastBroken.includes(fastKey(faithOf(b), s.day))).map((b) => b.id));
    const meal = eatDay(s.rations, s.cargo, s.battalions, s.followers, training, s.exposure.away, s.campPacked, smoked, fasting);
    // Comida cozida (Marco 22): a fogueira e as cozinhas dão conta de tantos batalhões; o resto come cru e gasta mais
    if (!s.campPacked) {
      const eating = s.exposure.away ? s.battalions.filter((b) => training.has(b.id)) : s.battalions;
      const cooks = cooksOf(s.campPlan, staffing?.working);
      const raw = eating.slice(cooks);
      if (raw.length > 0) meal.rations = Math.max(0, meal.rations - Math.ceil(dailyRations(raw, []) * (RAW_FOOD - 1)));
      // O forno faz o pão render
      if (staffing && running(s.campPlan, "OVEN", staffing.working)) meal.rations += Math.floor(dailyRations(eating, []) * OVEN_SAVES);
    }
    s.rations = meal.rations;
    s.cargo = meal.cargo;
    s.battalions = meal.battalions;
    // Harpias comem da carne do bando (sem comida, caçam sozinhas)
    const birds = s.scouts.filter((x) => x.harpy).length * SUPPORT.HARPY.RATIONS;
    if (s.exposure.away && !s.campPacked) {
      const fed = takeFieldFood(s.battalions, s.cargo, birds, (b) => !training.has(b.id));
      s.battalions = fed.battalions;
      s.cargo = fed.cargo;
    } else s.rations = Math.max(0, s.rations - birds);
    // Enfermaria e doenças
    // A enfermaria tem tantos leitos, e o poço deixa caber mais gente antes de lotar (Marco 22)
    const health = healthDay(s.battalions, training, s.exposure, hasFollower(s.followers, "HEALER"), meal.hungry, {
      beds: staffing ? sickBedsOf(s.campPlan, staffing.working) : 0,
      crowd: crowdLimit(s.campPlan, HEALTH.CAMP_CROWD),
      clean: staffing && readyOf(s.campPlan, "LATRINE").length > 0 ? LATRINE_CLEAN : 0,
      herbs: !!staffing && running(s.campPlan, "HERBALIST", staffing.working),
      unbedded,
      // O acampamento de campo (parte 3): a enfermaria do kit cuida dos feridos em campo
      fieldBeds: s.exposure.field && s.fortress ? fieldCampOf(s.fortress.kit).sickBeds : 0,
    });
    // O mastro de recrutamento atrai voluntários enquanto o acampamento está montado
    if (!s.campPacked) {
      const rate = volunteerRate(s.campPlan);
      const before = s.volunteers;
      s.volunteers = Math.min(rate.cap, s.volunteers + rate.perDay);
      if (before < VOLUNTEERS.CAP && s.volunteers >= VOLUNTEERS.CAP) log.push(entry(s.day, `${s.volunteers} voluntários esperam no mastro: dá para formar um batalhão.`, "good"));
    }
    s.battalions = health.battalions;
    for (const l of health.log) log.push(entry(s.day, l.text, l.tone));
    if (staffing) {
      // Turno de treino: um pouco de experiência todo dia (quem está no Campo de Treino pago já ganha lá)
      const levels: string[] = [];
      s.battalions = s.battalions.map((b) => {
        if (!inCamp.some((x) => x.id === b.id) || shiftOf(s, b.id) !== "TRAIN" || s.training.some((t) => t.battalionId === b.id)) return b;
        const r = gainXp(b, shiftXp(s.campPlan, b.troopType));
        if (r.levelsGained > 0) levels.push(`${b.name} subiu para o nível ${r.battalion.level}`);
        return r.battalion;
      });
      for (const l of levels) log.push(entry(s.day, `${l} no turno de treino!`, "good"));
      // As obras andam com o trabalho que sobrou dos postos
      const works = advanceWorks(s.campPlan, staffing.labor);
      s.campPlan = works.plan;
      for (const b of works.finished) log.push(entry(s.day, `Obra pronta no acampamento: ${CAMP_BUILDINGS[b.kind].label.toLowerCase()}.`, "good"));
      // A horta, o lenhador, os troféus e o bardo
      const made = campProduce(s.campPlan, staffing.working, s.campForest);
      s.rations += made.rations;
      if (made.wood > 0) s.depot = { ...s.depot, WOOD: Math.round(((s.depot.WOOD ?? 0) + made.wood) * 10) / 10 };
      s.fame = Math.min(100, s.fame + made.fame);
    }
    if (!meal.hungry) {
      if (s.hungryDays > 0) log.push(entry(s.day, "O exército voltou a comer. A fome acabou.", "good"));
      s.hungryDays = 0;
    } else {
      s.hungryDays++;
      log.push(
        entry(
          s.day,
          s.exposure.away && !s.campPacked
            ? `As mochilas estão vazias${meal.starving.length > 0 ? ` (${meal.starving.join(", ")})` : ""}! ${s.hungryDays} dia(s) de fome em campo: a moral vai despencar. Mande buscar comida no acampamento.`
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

    faithDay(s, worship, log);

    // Pagamento
    if (s.day % ECONOMY.PAYDAY_INTERVAL !== 0) continue;

    if (staffing) {
      // A mesa de dados às vezes acaba em briga
      if (running(s.campPlan, "DICE", staffing.working) && Math.random() < DICE_BRAWL) {
        s.campMood = Math.max(-30, s.campMood - 4);
        log.push(entry(s.day, "Briga na mesa de dados: dois soldados no chão e o humor do acampamento azedou.", "bad"));
      }
      // Sem oficinas que deem conta, o equipamento gasto não é consertado
      const craft = campNeeds(s).CRAFT;
      for (let k = craft.have; k < craft.need; k++) {
        if (Math.random() >= WEAR_CHANCE) continue;
        const worn = s.battalions.filter((b) => b.equipment.weapon > 0 || b.equipment.armor > 0);
        const b = worn[Math.floor(Math.random() * worn.length)];
        if (!b) break;
        const slot = b.equipment.weapon >= b.equipment.armor ? "weapon" : "armor";
        b.equipment = { ...b.equipment, [slot]: b.equipment[slot] - 1 };
        log.push(entry(s.day, `Ninguém consertou ${slot === "weapon" ? "as armas" : "as armaduras"} de ${b.name}: o equipamento caiu um nível. Faltam oficinas no acampamento.`, "bad"));
      }
    }

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

    // Quem está fora em expedição também recebe
    const away = s.expeditions.flatMap((e) => e.battalions);
    const captainWages = allCaptains(s).reduce((sum, c) => sum + c.wage, 0);
    // A manutenção das construções entra no pagamento (Marco 22, parte 2)
    const upkeep = s.campPacked ? 0 : upkeepOf(s.campPlan);
    const wages = weeklyWages([...s.battalions, ...away], s.lieutenants) + supportWages(s.scouts.length, s.messengers.length) + captainWages + upkeep;
    if (wages === 0) continue;
    const due = wages + s.debt;
    const paid = s.gold >= due;
    // Capitães (Marco 20): a ambição pesa toda semana; o atraso, quando falta ouro
    const gone = desertions(captainsWeek(s.captains, paid, s.day), s.battalions);
    if (gone.log.length > 0) {
      s.captains = gone.captains;
      s.battalions = gone.battalions;
      s.lieutenants = unassignMissing(s.lieutenants, [...s.battalions, ...away]);
      for (const l of gone.log) log.push(entry(s.day, l.text, l.tone));
    } else s.captains = gone.captains;
    // A tenda do capitão: a companhia acampa junta
    const tents = s.campPacked ? 0 : readyOf(s.campPlan, "CAPTAIN_TENT").length;
    if (tents > 0) s.captains = s.captains.map((c, i) => (i < tents ? shiftLoyalty(c, CAPTAIN_TENT_LOYALTY, s.day, "a companhia acampou junta") : c));
    if (paid) {
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
    const emptied = s.battalions.filter((b) => b.soldiers === 0).map((b) => b.name);
    s.battalions = s.battalions.filter((b) => b.soldiers > 0);
    log.push(
      entry(s.day, `Salários atrasados (dívida: ${s.debt}). Deserções: ${deserted.join(", ")}.`, "bad"),
    );
    if (emptied.length) log.push(entry(s.day, `${emptied.join(", ")} desertou por completo.`, "bad"));
    s.lieutenants = unassignMissing(s.lieutenants, [...s.battalions, ...away]);

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
    expeditions: s.expeditions,
    lieutenants: s.lieutenants,
    captains: s.captains,
    scouts: s.scouts,
    messengers: s.messengers,
    followers: s.followers,
    campMood: s.campMood,
    faithFavor: s.faithFavor,
    unburied: s.unburied,
    fastBroken: s.fastBroken,
    bonds: s.bonds,
    cargo: s.cargo,
    train: s.train,
    exposure: s.exposure,
    training: s.training,
    campPacked: s.campPacked,
    depot: s.depot,
    freight: s.freight,
    aleRation: s.aleRation,
    campStay: s.campStay,
    campPlan: s.campPlan,
    volunteers: s.volunteers,
    fame: s.fame,
    shifts: s.shifts,
    campForest: s.campForest,
    fortress: s.fortress,
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

/**
 * Por que essa tropa não se recruta no posto (null = pode): o posto de recrutamento precisa
 * estar de pé, e cada tropa pede a sua construção (Marco 22, GDD 9.6).
 */
export function recruitProblem(s: Pick<GameState, "campPlan">, troop: TroopType): string | null {
  if (!s.campPlan.legacy && !ready(s.campPlan, "RECRUIT_POST")) return "Precisa do posto de recrutamento";
  return troopProblem(s.campPlan, troop);
}

/** Defumadouro: o exército em campo gasta esta fração; forno: o acampamento economiza isto. */
export const SMOKED_SHARE = 0.85;
export const OVEN_SAVES = 0.1;
/** Latrina: os surtos no acampamento caem por esta fração. */
export const LATRINE_CLEAN = 0.3;
/** Por oficina que falta, chance por semana de um batalhão perder um nível de equipamento. */
export const WEAR_CHANCE = 0.3;
export const CAPTAIN_TENT_LOYALTY = 2;

type CampView = Pick<GameState, "campPlan" | "battalions" | "exposure" | "training" | "campStay" | "fame" | "followers" | "shifts" | "campPacked">;

/** Batalhões no acampamento agora: todos, com o Comandante nele; senão, quem treina e quem ficou. */
export function inCampOf(s: Pick<GameState, "battalions" | "exposure" | "training" | "campStay">): BattalionData[] {
  if (!s.exposure.away) return [...s.battalions];
  const home = new Set([...s.training.map((t) => t.battalionId), ...s.campStay]);
  return s.battalions.filter((b) => home.has(b.id));
}

/** O turno de um batalhão (quem está no Campo de Treino pago, treina). */
export function shiftOf(s: Pick<GameState, "shifts" | "training">, id: string): Shift {
  return s.training.some((t) => t.battalionId === id) ? "TRAIN" : s.shifts[id] ?? "REST";
}

/** Quem está em cada posto hoje e quanto trabalho sobra para as obras. */
export function campStaffing(s: Omit<CampView, "fame" | "campPacked">): Staffing {
  const work = inCampOf(s).filter((b) => shiftOf(s, b.id) === "WORK").length;
  return staffPosts(s.campPlan, s.followers, work);
}

/** Alguém vigia o acampamento: um batalhão no turno de guarda ou um posto de sentinela pronto. */
export function campWatched(s: Pick<GameState, "battalions" | "exposure" | "training" | "campStay" | "shifts" | "campPlan">): boolean {
  return ready(s.campPlan, "SENTRY") || inCampOf(s).some((b) => shiftOf(s, b.id) === "GUARD");
}

/** As sete necessidades do painel do acampamento (Marco 22). */
export function campNeeds(s: CampView) {
  const inCamp = inCampOf(s);
  const patients = inCamp.reduce((n, b) => n + (b.wounded ?? 0) + (b.sick ?? 0), 0);
  return needsOf(s.campPlan, {
    battalions: s.battalions.length,
    inCamp: inCamp.length,
    soldiers: inCamp.reduce((n, b) => n + b.soldiers, 0),
    patients,
    fame: s.fame,
    guards: inCamp.filter((b) => shiftOf(s, b.id) === "GUARD").length,
    working: s.campPacked ? new Set() : campStaffing(s).working,
  });
}

/** Carroças que andam com o exército (todas, com o acampamento levantado; nenhuma, se ficaram ou estão na estrada). */
export function wagonsWithArmy(s: Pick<GameState, "train" | "campPacked" | "wagons">): number {
  return s.campPacked || s.train === "ARMY" ? s.wagons.length : 0;
}

/** O bando leva a carga nas carroças (perto do Comandante) ou só na bolsa dele. */
function carryCapacity(s: GameState): number {
  const wagonsNear = s.battleHud?.wagonsNear ?? true;
  return wagonsNear ? cargoCapacity(s.exposure.away ? wagonsWithArmy(s) : s.wagons.length) : TRADE.PURSE_CAPACITY;
}

/** Peso que o bando leva agora: rações nas carroças (em campo) e mercadorias. */
function carriedWeight(s: GameState): number {
  return (s.exposure.away && !s.campPacked ? s.cargo : 0) + freightWeight(s.freight);
}

/** Batalhões que marcham com o Comandante (fora quem treina e quem ficou de guarda). */
export function marchingIds(s: Pick<GameState, "battalions" | "training" | "campStay">): Set<string> {
  const home = new Set([...s.training.map((t) => t.battalionId), ...s.campStay]);
  return new Set(s.battalions.filter((b) => !home.has(b.id)).map((b) => b.id));
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

function freshContract(s: Pick<GameState, "world" | "settlements" | "factions" | "wars" | "stolenCargo" | "armies" | "nobles" | "fame"> & { leader?: Leader }): Contract | null {
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
  // Em terra estranha ninguém conhece o bando: os primeiros serviços pagam mal (Marco 17)
  const stranger = world.culture && world.culture !== "REALMS" && s.fame < 10 ? 0.7 : 1;
  const boss = s.leader ? leaderBonus(s.leader).reward : 1;
  return c ? { ...c, reward: Math.round(c.reward * (1 + s.fame * REPUTE.CONTRACT_FAME_BONUS) * stranger * boss) } : null;
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
  // O começo humilde (Marco 22): sem tenente; o primeiro vem com a tenda dos oficiais
  const army = initialArmy();
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
    lieutenants: [],
    lieutenantCandidates: freshLieutenants(1, world?.culture),
    scouts: Array.from({ length: SUPPORT.START_SCOUTS }, newScout),
    harpyChicks: 0,
    nestsFound: [],
    siteLife: {},
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
    expeditions: [],
    expeditionReports: [],
    mutiny: null,
    settlements,
    factions,
    calamities: [],
    nextCalamityDay: Math.round(r.int(REALM.CALAMITY_FIRST_DAY[0], REALM.CALAMITY_FIRST_DAY[1]) * (world ? calamityDelay(world) : 1)),
    siege: null,
    burnedBridges: [],
    honor: 50,
    campMood: 0,
    faithFavor: {},
    unburied: null,
    fastBroken: [],
    followers: [],
    bonds: {},
    campEvent: null,
    nextEventDay: 2,
    lastVictoryDay: null,
    training: [],
    battlefields: [],
    warLessons: {},
    townIntel: {},
    wagons: Array.from({ length: SUPPLY.START_WAGONS }, () => ({ id: newId(), hp: SUPPLY.WAGON.hp })),
    cargo: 0,
    train: "CAMP",
    convoy: null,
    takeWagons: false,
    exposure: NO_EXPOSURE,
    forage: {},
    campAt: null,
    campPacked: false,
    campPlan: startingPlan(),
    volunteers: 0,
    tavernHires: {},
    shifts: {},
    campForest: 0,
    siegeKit: { ladders: 0, rams: 0 },
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
    ...INITIAL_SEA,
    ...INITIAL_LEGACY,
    ...INITIAL_CAPTAINS,
    ...INITIAL_FORTRESS,
    ...INITIAL_MAGIC,
    captainCandidates: freshCaptains(1, world?.culture),
    leader: { ...FOUNDER, name: personName(r), age: r.int(LEGACY.START_AGE[0], LEGACY.START_AGE[1]) },
    planet: world ? generatePlanet(world) : null,
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
    campBuild: null,
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
    captains: [],
    captainCandidates: [],
    // O exército do cenário já está em campo, com o que tem
    train: "ARMY",
    scouts: Array.from({ length: scenario.army.scouts }, newScout),
    messengers: Array.from({ length: scenario.army.messengers }, newMessenger),
    wagons: Array.from({ length: scenario.army.wagons }, () => ({ id: newId(), hp: SUPPLY.WAGON.hp })),
    contracts: [],
    log: [],
    gold: 0,
    campPacked: true,
    nextEventDay: Infinity,
    nextCalamityDay: Infinity,
    warDifficulty: scenario.difficulty,
    scenario,
    // O Comandante mago (Marco 19): sabe todas as magias e começa com o arcano cheio
    ...(scenario.magic ? { spells: [...SPELL_IDS], arcane: MAGIC.ARCANE_MAX } : {}),
    // Escadas e aríete vêm prontos: o relógio parado não deixa ninguém cortar madeira
    siege: scenario.siege && { settlementId: SCENARIO_TOWN, walled: true, startDay: 0, food: 0, wood: 0, ladders: scenario.siege.role === "ATTACK" ? scenario.siege.ladders : 0, ram: scenario.siege.role === "ATTACK" ? scenario.siege.rams : 0 },
  };
}

/** Contrato encerrado: o pagamento, o nome do bando e o rancor de quem saiu perdendo. */
function contractClosing(s: GameState, c: Contract, success: boolean, text: string): Partial<GameState> {
  const owner = s.settlements.find((t) => t.id === c.clientId)?.owner;
  // O lado contrário lembra (Marco 15): quem o bando prejudicou guarda rancor
  const rivalRuler = c.rival && success ? s.nobles.find((n) => n.alive && n.factionId === c.rival && n.rank === "RULER") : undefined;
  return {
    gold: s.gold + (success ? c.reward : 0),
    honor: success ? Math.min(100, s.honor + 3 + leaderBonus(s.leader).honor) : s.honor,
    fame: success ? Math.min(100, s.fame + REPUTE.FAME.CONTRACT) : s.fame,
    factions: s.factions.map((f) => {
      if (f.id === owner) return { ...f, relation: Math.max(-100, Math.min(100, f.relation + (success ? REALM.CONTRACT_RELATION : -5))) };
      return success && f.id === c.rival ? { ...f, relation: Math.max(-100, f.relation - 12) } : f;
    }),
    nobles: rivalRuler ? s.nobles.map((n) => (n.id === rivalRuler.id ? { ...n, opinion: Math.max(-100, n.opinion - 12), memory: [...n.memory, { day: s.day, text: `o bando trabalhou contra o reino: ${c.title}`, delta: -12 }].slice(-8) } : n)) : s.nobles,
    lieutenantCandidates: success ? freshLieutenants(s.day, s.world?.culture) : s.lieutenantCandidates,
    captainCandidates: success ? freshCaptains(s.day, s.world?.culture) : s.captainCandidates,
    log: appendLog(s.log, [entry(s.day, text, success ? "good" : "bad")]),
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
    if (!s.scenario.boarding && !s.scenario.seat) noteResult(s.scenario.id, result);
    set({ scenarioResult: result, scenarioPaused: false, contextMenu: null });
  },

  saveGame: (slot) => {
    const s = get();
    if (!s.world || s.phase !== "PLAYING") return "Nenhuma campanha em andamento.";
    if (s.scenario) return "Batalhas personalizadas não são salvas.";
    if (s.voyage) return "Em alto-mar não dá para salvar: espere chegar ao porto.";
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
    const loaded = file.store as Partial<CampaignState>;
    // Longe de casa, o mundo a recriar é o do continente onde o bando está (Marco 17)
    const away = loaded.planet?.continents.find((c) => c.id === loaded.continent && !c.home);
    const world = away ? continentWorld(away, file.options) : generateWorld(file.seed, file.options);
    if (world.name !== file.worldName) return "Este mundo não pôde ser recriado (o gerador mudou desde o save).";
    world.bandName = file.bandName;
    if (loaded.echo && !away) rememberSaga(world, loaded.echo);
    logSeq = Math.max(0, ...(loaded.log ?? []).map((e) => e.id));
    // Acampamento montado em outro lugar (Marco 13)
    if (loaded.campAt) world.camp = campDefAt(loaded.campAt);
    // Reinos nascidos de guerras civis voltam ao mundo (Marco 15)
    world.factions.push(...(loaded.extraFactions ?? []));
    // Save de antes do Marco 22: o acampamento fixo vira peças na grade, com tudo o que tinha
    migrateCampPlan(loaded as Record<string, unknown>);
    for (const land of Object.values(loaded.parked ?? {})) migrateCampPlan(land.store as Record<string, unknown>, loaded.battalions?.length ?? 1);
    // Save com fortaleza de antes da cidade da sede (Marco 22, parte 4)
    migrateSeatCity(loaded as Record<string, unknown>);
    for (const land of Object.values(loaded.parked ?? {})) migrateSeatCity({ ...(land.store as Record<string, unknown>), followers: [], battalions: [] });
    set({
      ...campaignState(world),
      ...loaded,
      train: loaded.train ?? (loaded.exposure?.away || loaded.campPacked ? "ARMY" : "CAMP"),
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
    const horses = TROOPS[troopType].family === "CAVALRY" ? horseDeal(s, BALANCE.BATTALION_SIZE * TRADE.HORSES_PER_RIDER) : null;
    const cost = TROOPS[troopType].cost + (horses?.cost ?? 0);
    if (s.gold < cost || (horses && !horses.ok) || recruitProblem(s, troopType)) return false;
    const b = newBattalion(s.battalions, troopType, localRecruits(s, s.world?.camp.center));
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
    const land = s.world?.culture ?? BAND_HOME;
    const b: BattalionData = { ...newBattalion(s.battalions, troop, { culture: land, faith: pickFaith(land, preacherShare(null), Math.random()) }), soldiers: n, turncoatUntil: s.day + PRISONERS.TURNCOAT_DAYS };
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
    if (TROOPS[b.troopType].family === "CAVALRY") {
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

  sendExpedition: (contractId, captainId) => {
    const s = get();
    const contract = s.contracts.find((c) => c.id === contractId);
    if (!contract) return "Esse contrato não está mais na mesa.";
    if (!canDelegate(contract)) return "Este serviço pede o Comandante em pessoa.";
    if (s.pendingMutiny || s.mutiny) return "Com um motim no acampamento, ninguém sai.";
    const captain = s.captains.find((c) => c.id === captainId);
    if (!captain) return "Escolha um capitão: só eles levam uma companhia sem o Comandante.";
    // Quem está em treino fica: o resto da companhia vai
    const party = s.battalions.filter((b) => captain.battalionIds.includes(b.id) && !s.training.some((t) => t.battalionId === b.id));
    if (party.length === 0) return `A companhia de ${captainName(captain)} não tem ninguém pronto para sair.`;
    const days = expeditionDays(contract);
    const food = expeditionRations(party, days);
    if (food > s.rations) return `Faltam rações: a viagem pede ${food}.`;
    const away = new Set(party.map((b) => b.id));
    set({
      gold: s.gold + contract.advance,
      rations: s.rations - food,
      battalions: s.battalions.filter((b) => !away.has(b.id)),
      captains: s.captains.filter((c) => c.id !== captainId),
      contracts: [...s.contracts.filter((c) => c.id !== contractId), freshContract(s)].filter((c): c is Contract => c !== null),
      expeditions: [...s.expeditions, { id: newId(), contract, battalions: party, captain, departDay: s.day, departAt: s.day + s.dayProgress, returnDay: s.day + days }],
      campStay: s.campStay.filter((id) => !away.has(id)),
      log: appendLog(s.log, [entry(s.day, `${captainName(captain)} partiu com ${party.map((b) => b.name).join(", ")} para "${contract.title}". Adiantamento: ${contract.advance}. Volta prevista: dia ${s.day + days}.`)]),
    });
    return null;
  },

  returnExpeditions: () => {
    const s = get();
    const due = s.expeditions.filter((e) => e.returnDay <= s.day);
    if (due.length === 0) return;
    for (const e of due) {
      const now = get();
      const led = (b: BattalionData) => now.lieutenants.some((l) => l.battalionId === b.id);
      const r = resolveExpedition(e.battalions, e.contract, led, Math.random, e.captain?.tactics);
      const c = e.contract;
      const lostNote = r.lost.length > 0 ? ` ${r.lost.join(", ")} não voltou.` : "";
      // O capitão volta com quem sobrou; se ninguém sobrou, ele caiu junto
      const cap = e.captain;
      const lines = cap ? captainReport(cap, c, e.battalions, r) : undefined;
      const capBack = cap && r.battalions.length > 0
        ? shiftLoyalty({ ...cap, battles: cap.battles + 1 }, r.success ? CAPTAINS.LOYALTY.MISSION_DONE : CAPTAINS.LOYALTY.MISSION_FAILED, now.day, `${r.success ? "cumpriu" : "fracassou em"} "${c.title}"`)
        : null;
      const capNote = cap && !capBack ? ` ${captainName(cap)} caiu com a companhia.` : "";
      const text = r.success
        ? `Chegou notícia: "${c.title}" foi cumprido sem o Comandante. ${c.client} pagou ${c.reward} de ouro, ao preço de ${r.casualties} baixa(s).${lostNote}${capNote}`
        : `Chegou notícia: "${c.title}" fracassou. Foram ${r.casualties} baixa(s).${lostNote}${capNote}`;
      set({
        ...contractClosing(now, c, r.success, text),
        battalions: [...now.battalions, ...r.battalions],
        captains: capBack ? [...now.captains, capBack] : now.captains,
        lieutenants: unassignMissing(now.lieutenants, [...now.battalions, ...r.battalions, ...now.expeditions.filter((x) => x !== e).flatMap((x) => x.battalions)]),
        expeditions: now.expeditions.filter((x) => x !== e),
        expeditionReports: [{ id: e.id, title: c.title, success: r.success, gold: r.success ? c.reward : 0, casualties: r.casualties, lost: r.lost, day: now.day, captain: cap ? captainName(cap) : undefined, lines }, ...now.expeditionReports].slice(0, EXPEDITION.REPORTS),
      });
    }
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
    const units: [EnemyKind, number][] = [[MUTINEER_OF[TROOPS[rebel.troopType].family], rebel.soldiers]];
    if (leader && leader.loyalty < 50) {
      lieutenants = lieutenants.filter((l) => l.id !== leader.id);
      units.push([MUTINEER_OF[TROOPS[rebel.troopType].family], 1]);
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
    // O arcano volta com os dias (Marco 19)
    get().restoreArcane(days);
    const s = get();
    if (!s.world) return;
    const total = s.dayProgress + days;
    const whole = Math.floor(total);
    if (whole === 0) {
      set({ dayProgress: total });
      return;
    }
    let state = dayState(s);
    let realm: RealmState = {
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
      bandCulture: cultureOf(s.leader),
      faithFavor: s.faithFavor,
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
      let commanderEar: Ear | null = null;
      if (s.commanderAt) {
        const t = near(s.commanderAt);
        const inCamp = distance(s.commanderAt, world.camp.center) < 1600;
        commanderEar = { ...s.commanderAt, to: inCamp ? "ao acampamento" : t ? `a ${t.name}` : "ao bando, na estrada" };
        ears.push(commanderEar);
      }
      for (const t of realm.settlements) if (t.owner === "PLAYER" || posts.includes(t.id)) ears.push({ x: t.x, y: t.y, to: `a ${t.name}` });
      const news = hearRumors(rumors, day, ears);
      rumors = news.left;
      // O que chega ao Comandante vem na língua do lugar: sem quem a fale, chega truncado (Marco 23)
      const earTongue = commanderEar ? placeTongue({ world, settlements: realm.settlements }, commanderEar) : null;
      const earBarrier = earTongue ? barrierIn(s, earTongue) : 0;
      for (const h of news.heard) {
        const lost = !!earTongue && h.ear === commanderEar && earBarrier > 0;
        entries.push(entry(day, rumorLine(lost && earTongue ? { ...h, rumor: { ...h.rumor, text: garble(h.rumor.text, earTongue, earBarrier, h.rumor.id) } } : h), h.rumor.tone));
      }
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
      lieutenantCandidates = freshLieutenants(state.day, s.world?.culture);
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
    get().returnExpeditions();
    get().farTick();
    get().legacyDay(whole);
    get().languageDay(whole);
    get().fortressDays(s.day, get().day);
  },

  languageDay: (days) => {
    const s = get();
    if (!s.world || days <= 0) return;
    const place = placeTongue(s, s.commanderAt ?? s.world.camp.center);
    const v = voiceFor(place, s);
    // A língua do lugar (mais depressa com quem a fale ao lado), e a de cada intérprete, que ensina
    // um pouco todo dia onde quer que o bando esteja
    const lessons: { t: CultureId; helped: boolean; days: number }[] = [{ t: place, helped: v.by === "INTERPRETER" || v.by === "OFFICER", days }];
    for (const f of s.followers) if (f.role === "INTERPRETER" && f.tongue && f.tongue !== place) lessons.push({ t: f.tongue, helped: false, days: days * LANGUAGE.TUTOR_SHARE });
    let leader = s.leader;
    const lines: LogEntry[] = [];
    for (const l of lessons) {
      const learned = learnDay(leader, l.t, l.helped, l.days);
      if (!learned) continue;
      leader = { ...leader, tongues: learned.tongues };
      if (learned.reached === "FLUENT") lines.push(entry(s.day, `${s.leader.name} já fala ${TONGUE[l.t].label} sem ajuda.`, "good"));
      if (learned.reached === "BASIC") lines.push(entry(s.day, `${s.leader.name} já entende o básico: ${TONGUE[l.t].label} não é mais só barulho.`, "good"));
    }
    if (leader === s.leader) return;
    set({ leader, ...(lines.length > 0 ? { log: appendLog(s.log, lines) } : {}) });
  },

  ...courtSlice((partial) => set(partial), get),
  ...magicSlice((partial) => set(partial), get),
  ...warSlice(set, get),
  ...captainSlice(set, get, {
    note: (text, tone = "info") => set((s) => ({ log: appendLog(s.log, [entry(s.day, text, tone)]) })),
  }),
  ...legacySlice(set, get, {
    note: (text, tone = "info") => set((s) => ({ log: appendLog(s.log, [entry(s.day, text, tone)]) })),
    heirName: () => personName(createRng(randomSeed())),
    heirAge: () => createRng(randomSeed()).int(LEGACY.HEIR_AGE[0], LEGACY.HEIR_AGE[1]),
  }),
  revisitSaga: (saga) => {
    const world = generateWorld(saga.seed, saga.options);
    rememberSaga(world, saga.echo);
    set({ ...campaignState(world), echo: saga.echo, loadNonce: get().loadNonce + 1 });
  },
  ...fortressSlice(set, get, {
    note: (text, tone = "info") => set((s) => ({ log: appendLog(s.log, [entry(s.day, text, tone)]) })),
    stock: stockOf,
    paid,
    fresh: (world, day) => freshLand(world, day),
    seatTown: (s, city) => seatSettlement(s, city),
  }),
  ...seaSlice(set, get, {
    fresh: (world, day) => {
      // Uma terra nova: reinos, nobres e mercado dela; o bando chega sem nome e sem acampamento
      const fresh = campaignState(world);
      const out = {} as Pick<GameState, ContinentKey>;
      for (const k of CONTINENT_KEYS) Object.assign(out, { [k]: fresh[k] });
      return { ...out, fame: 0, fear: 0, campPacked: true, nextCalamityDay: day + out.nextCalamityDay };
    },
    note: (text, tone = "info") => set((s) => ({ log: appendLog(s.log, [entry(s.day, text, tone)]) })),
  }),

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

  raidCamp: (band, surprise = false) => {
    const s = get();
    // A paliçada, as torres e o fosso seguram parte do saque (Marco 22: a segurança da planta).
    // De surpresa (há gente, mas ninguém de guarda), o bando leva só metade do que levaria
    const kept = 1 - (1 - guardOf(s.campPlan)) * (surprise ? 0.5 : 1);
    const rations = Math.floor(s.rations * WORLD.WARBAND.CAMP_RAID_RATIONS * (1 - kept));
    // A tesouraria da fortaleza guarda o ouro num cofre
    const gold = ready(s.campPlan, "TREASURY") ? 0 : Math.floor(s.gold * WORLD.WARBAND.CAMP_RAID_GOLD * (1 - kept));
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
        `${band} atacou o acampamento ${surprise ? "de surpresa (ninguém estava de guarda)" : "desguarnecido"}: levou ${rations} rações${goods > 0 ? `, ${goods} de mercadorias do depósito` : ""} e ${gold} de ouro${kept > 0 ? " (a defesa do acampamento segurou parte do saque)" : ""}.`,
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
      lieutenants: unassignMissing(lieutenants, [...r.ctx.battalions, ...s.expeditions.flatMap((e) => e.battalions)]),
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
    // Em campo, o que se compra vai nas mochilas e, o que sobrar, nas carroças ou na bolsa (até onde couber)
    if (s.exposure.away && !s.campPacked) {
      const going = marchingIds(s);
      const filled = fillPacks(s.battalions, amount, (b) => going.has(b.id));
      const rest = amount - filled.used;
      if (rest > 0 && s.cargo + freightWeight(s.freight) + rest > carryCapacity(s)) return false;
      set({
        gold: s.gold - cost,
        cargo: s.cargo + rest,
        battalions: filled.battalions,
        settlements,
        log: appendLog(s.log, [entry(s.day, `Compradas ${amount} rações em ${t.name} por ${cost} de ouro (nas mochilas${rest > 0 ? " e nas carroças" : ""}).`)]),
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
    // O mago da corte de uma cidade tomada (Marco 19, parte 3): fica preso, com a magia que sabe
    if (!liberated && t.owner !== "RUINED" && (t.kind === "CITY" || t.kind === "CAPITAL")) {
      const now = get();
      const held = now.captiveOfficers.flatMap((o) => (o.mage ? [o.mage] : []));
      const spell = courtMageSpell(t.id, [...now.spells, ...now.grimoires, ...held]);
      if (spell) {
        now.addCaptiveOfficer({ name: `o mago da corte de ${t.name}`, factionId: s.factions.some((f) => f.id === t.owner) ? t.owner : null, nobleId: null, ransom: MAGIC.LEARN.MAGE_RANSOM, mage: spell });
        now.chronicle(`Em ${t.name}, o mago da corte foi preso: ele sabe ${spellDef(spell).name}.`, "good");
      }
    }
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
      calamitiesSlain: s.calamitiesSlain + 1,
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

  setBattleHud: (hud) => {
    // A cena publica dez vezes por segundo: igual ao anterior (parado no acampamento), nada se redesenha
    const prev = get().battleHud;
    if (prev && JSON.stringify(prev) === JSON.stringify(hud)) return;
    set({ battleHud: hud });
  },

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
    let captainCandidates = s.captainCandidates;
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
      lieutenantCandidates = freshLieutenants(s.day, s.world?.culture);
      captainCandidates = freshCaptains(s.day, s.world?.culture);
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

    // --- Capitães (Marco 20): quem marchou com a companhia volta com a crônica; quem caiu, não ---
    const captains: CaptainData[] = [];
    for (const c of s.captains) {
      const report = survivors.find((r) => r.captainId === c.id);
      if (!report) {
        captains.push(c);
        continue;
      }
      if (report.captainAlive === false) {
        notes.push(`O capitão ${captainName(c)} morreu em combate.`);
        logEntries.push(entry(s.day, `O capitão ${captainName(c)} tombou em "${title}". A companhia volta às ordens do Comandante.`, "bad"));
        continue;
      }
      const ck = report.captainKills ?? 0;
      let next: CaptainData = { ...c, kills: c.kills + ck, battles: c.battles + 1, history: addHistory(c.history, `Dia ${s.day}: conduziu a companhia em "${title}" (${outcome}${ck ? `, ${ck} abate${ck === 1 ? "" : "s"}` : ""}).`) };
      if (result === "VICTORY") next = shiftLoyalty(next, CAPTAINS.LOYALTY.VICTORY, s.day, `vitória em "${title}"`);
      captains.push(next);
    }

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

    // --- Fés (Marco 23): lutar no dia santo, e os mortos que pedem enterro ---
    const inBattle = [...new Set(s.battalions.filter((b) => byId.has(b.id)).map(faithOf))];
    let faithFavor = s.faithFavor;
    let campMood = s.campMood;
    const sinners = inBattle.filter((f) => isHolyDay(f, s.day));
    for (const f of sinners) faithFavor = addFavor(faithFavor, f, FAITH.HOLY_BROKEN_FAVOR);
    if (sinners.length > 0) {
      campMood = Math.max(-30, campMood + FAITH.HOLY_BROKEN_MOOD);
      const who = sinners.map((f) => FAITHS[f].of).join(" e ");
      notes.push(`Os fiéis ${who} lutaram no dia santo: o templo não esquece.`);
      logEntries.push(entry(s.day, `O bando lutou no dia santo ${who}. Os fiéis resmungam, e o templo não esquece.`, "bad"));
    }
    let unburied = s.unburied;
    const buriers = inBattle.filter((f) => keeps(f, "BURY"));
    if (casualties > 0 && buriers.length > 0 && info.at) {
      const faiths = [...new Set([...(unburied?.faiths ?? []), ...buriers])];
      unburied = { x: Math.round(info.at.x), y: Math.round(info.at.y), day: s.day, dead: casualties + (unburied?.dead ?? 0), faiths };
      notes.push(`${unburied.dead} morto(s) esperam no campo: os fiéis ${faiths.map((f) => FAITHS[f].of).join(" e ")} querem enterrá-los antes de marchar.`);
    }

    // Vitória: festa no acampamento e tenentes que lutaram lado a lado mais próximos
    const together = lieutenants.filter((l) => fought.has(l.id)).map((l) => l.id);
    set({
      faithFavor,
      campMood,
      unburied,
      gold,
      iron,
      freight,
      debt,
      arrearsWeeks,
      battalions: remaining,
      lieutenants,
      captains,
      scouts,
      messengers,
      activeContract,
      mutiny,
      lieutenantCandidates,
      captainCandidates,
      factions,
      bonds: result === "VICTORY" ? shareVictory(s.bonds, together) : s.bonds,
      lastVictoryDay: result === "VICTORY" && !info.mutinyOver ? s.day : s.lastVictoryDay,
      // Fama (Marco 15): vencer dá nome ao bando; vencer muitos, mais ainda
      fame: result === "VICTORY" && info.enemiesKilled > 0 && !info.mutinyOver ? Math.min(100, s.fame + (info.enemiesKilled >= 10 ? REPUTE.FAME.BIG_VICTORY : REPUTE.FAME.VICTORY)) : s.fame,
      log: appendLog(s.log, logEntries),
      battles: [...s.battles, { day: s.day, title, won: result === "VICTORY", casualties, lost: lostBattalions, land: s.world?.name ?? "" }],
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

  setSiteLife: (id, life) => set((s) => ({ siteLife: { ...s.siteLife, [id]: life } })),

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
      wagons: [...s.wagons, { id: newId(), hp: SUPPLY.WAGON.hp }],
      log: appendLog(s.log, [entry(s.day, `Uma carroça nova (e a junta de bois) por ${SUPPLY.WAGON_COST} de ouro.`)]),
    });
    return true;
  },

  loadWagons: () => {
    const s = get();
    // Quem treina e quem fica guardando o acampamento (Marco 14) come do depósito
    const going = marchingIds(s);
    const home = new Set(s.battalions.filter((b) => !going.has(b.id)).map((b) => b.id));
    if (s.campPacked) {
      // Acampamento levantado: o depósito inteiro já vai junto, nas carroças
      set({ train: "ARMY", exposure: { ...s.exposure, away: true } });
      return;
    }
    // Cada batalhão sai com a mochila cheia (sem tirar a reserva de quem fica)
    const reserve = Math.max(0, dailyRations(s.battalions.filter((b) => home.has(b.id)), s.followers) - 1) * SUPPLY.CAMP_RESERVE_DAYS;
    const packs = fillPacks(s.battalions, Math.max(0, s.rations - reserve), (b) => going.has(b.id));
    let rations = s.rations - packs.used;
    // A bolsa do Comandante
    const bag = Math.min(Math.max(0, rations - reserve), Math.max(0, SUPPLY.PACK_CAPACITY - s.cargo));
    rations -= bag;
    let cargo = s.cargo + bag;
    // As carroças só vão se o Comandante quis levá-las (e se alguém marcha com ele)
    const take = s.takeWagons && going.size > 0 && s.wagons.length > 0 && s.train === "CAMP";
    if (take) {
      const load = Math.min(
        loadAmount(rations, cargo + freightWeight(s.freight), s.wagons.length, packs.battalions, s.followers, home),
        // A parte das carroças que o Comandante reservou para a comida
        Math.max(0, Math.floor(cargoCapacity(s.wagons.length) * (s.rationLoad ?? 1)) - cargo),
      );
      rations -= load;
      cargo += load;
    }
    set({ rations, cargo, battalions: packs.battalions, train: take ? "ARMY" : s.train, exposure: { ...s.exposure, away: true } });
  },

  unloadWagons: () => {
    const s = get();
    // O ferro vai para a Ferraria, os cavalos para o estábulo e a madeira para as obras (Marco 22);
    // o resto da mercadoria fica nas carroças
    const iron = freightOf(s.freight, "IRON");
    const horses = freightOf(s.freight, "HORSES");
    const wood = freightOf(s.freight, "WOOD");
    const freight = s.freight.filter((l) => l.good !== "IRON" && l.good !== "HORSES" && l.good !== "WOOD");
    set({
      rations: s.rations + s.cargo,
      cargo: 0,
      iron: s.iron + iron,
      depot: horses + wood > 0 ? { ...s.depot, HORSES: (s.depot.HORSES ?? 0) + horses, WOOD: (s.depot.WOOD ?? 0) + wood } : s.depot,
      freight,
      wagons: s.wagons.map((w) => ({ ...w, hp: SUPPLY.WAGON.hp })),
      // As carroças que andavam com o exército estacionam; um comboio na estrada volta sozinho
      train: s.train === "ROAD" ? "ROAD" : "CAMP",
      exposure: { ...NO_EXPOSURE },
    });
  },

  setTakeWagons: (take) => set({ takeWagons: take }),

  sendSupplies: (escortIds) => {
    const s = get();
    if (!s.exposure.away) return "O exército está no acampamento: come do depósito.";
    if (s.campPacked) return "Com o acampamento levantado, o depósito já anda com o exército.";
    if (s.train === "ARMY") return "As carroças já estão com o exército.";
    if (s.convoy) return "Já há um comboio na estrada.";
    if (s.wagons.length === 0) return "O bando não tem carroças: compre uma na Intendência.";
    const army = s.battleHud?.position;
    const camp = s.world?.camp.center;
    if (!army || !camp) return "Ninguém sabe onde o exército está.";
    // Quem fica no acampamento come do depósito: o comboio não leva a reserva deles
    const home = s.battalions.filter((b) => !marchingIds(s).has(b.id));
    const escort = home.filter((b) => escortIds.includes(b.id) && !s.training.some((t) => t.battalionId === b.id));
    const staying = home.filter((b) => !escort.includes(b));
    const reserve = Math.max(0, dailyRations(staying, s.followers) - 1) * SUPPLY.CAMP_RESERVE_DAYS;
    const load = Math.min(s.wagons.length * SUPPLY.WAGON_CAPACITY, Math.max(0, s.rations - reserve));
    if (load <= 0 && escort.length === 0) return "O depósito está vazio: não há o que mandar.";
    // A escolta sai com a mochila cheia
    const packs = fillPacks(s.battalions, Math.max(0, s.rations - reserve - load), (b) => escort.includes(b));
    const leaving = new Set(escort.map((b) => b.id));
    const now = s.day + s.dayProgress;
    const days = convoyDays(distance(camp, army));
    set({
      rations: s.rations - load - packs.used,
      battalions: packs.battalions.filter((b) => !leaving.has(b.id)),
      campStay: s.campStay.filter((id) => !leaving.has(id)),
      train: "ROAD",
      convoy: { id: newId(), departAt: now, arriveAt: now + days, from: { x: camp.x, y: camp.y }, load, escort: packs.battalions.filter((b) => leaving.has(b.id)), returning: false },
      campPanel: null,
      log: appendLog(s.log, [
        entry(
          s.day,
          `Saiu do acampamento um comboio com ${Math.floor(load)} rações${escort.length > 0 ? `, escoltado por ${escort.map((b) => b.name).join(" e ")}` : ", sem escolta"}. Chega em cerca de ${Math.max(1, Math.round(days * 24))} hora(s).`,
        ),
      ]),
    });
    return null;
  },

  sendWagonsHome: () => {
    const s = get();
    if (s.train !== "ARMY" || s.campPacked) return "As carroças não estão com o exército.";
    const army = s.battleHud?.position;
    const camp = s.world?.camp.center;
    if (!army || !camp) return "Ninguém sabe o caminho de volta.";
    // A bolsa do Comandante fica; o resto da comida das carroças volta para o depósito
    const load = Math.max(0, s.cargo - SUPPLY.PACK_CAPACITY);
    const now = s.day + s.dayProgress;
    const days = convoyDays(distance(camp, army));
    set({
      cargo: s.cargo - load,
      train: "ROAD",
      convoy: { id: newId(), departAt: now, arriveAt: now + days, from: { x: army.x, y: army.y }, load, escort: [], returning: true },
      campPanel: null,
      log: appendLog(s.log, [entry(s.day, `As carroças voltam ao acampamento${load >= 1 ? ` com ${Math.floor(load)} rações` : ""}.`)]),
    });
    return null;
  },

  convoyArrives: () => {
    const s = get();
    const c = s.convoy;
    if (!c) return;
    const fate = convoyFate(c.load, s.wagons.length, c.escort, Math.max(0, c.arriveAt - c.departAt));
    const lines: LogEntry[] = [];
    if (fate.raided) {
      lines.push(
        entry(
          s.day,
          c.escort.length > 0
            ? `Salteadores caíram sobre o comboio; a escolta os repeliu (${fate.escortLost} baixa(s)) e quase tudo chegou.`
            : `Salteadores caíram sobre o comboio sem escolta: levaram ${Math.round(c.load - fate.load)} rações${fate.wagonsLost > 0 ? " e uma carroça" : ""}.`,
          "bad",
        ),
      );
    }
    const wagons = s.wagons.slice(0, Math.max(0, s.wagons.length - fate.wagonsLost));
    // Voltou ao acampamento (ou o exército já estava lá): a carga entra no depósito
    if (c.returning || !s.exposure.away) {
      lines.push(entry(s.day, `O comboio chegou ao acampamento${fate.load >= 1 ? ` com ${Math.floor(fate.load)} rações` : ""}.`, "good"));
      set({
        rations: s.rations + fate.load,
        wagons,
        battalions: [...s.battalions, ...fate.escort],
        campStay: [...s.campStay, ...fate.escort.map((b) => b.id)],
        train: "CAMP",
        convoy: null,
        log: appendLog(s.log, lines),
      });
      return;
    }
    // Chegou ao exército: as mochilas enchem e o resto fica nas carroças, que passam a andar com ele
    const battalions = [...s.battalions, ...fate.escort];
    const going = marchingIds({ ...s, battalions });
    const packs = fillPacks(battalions, fate.load, (b) => going.has(b.id));
    const rest = fate.load - packs.used;
    lines.push(
      entry(
        s.day,
        `O comboio alcançou o exército: ${[packs.used >= 1 ? `${Math.round(packs.used)} rações encheram as mochilas` : "", rest >= 1 ? `${Math.round(rest)} ficam nas carroças` : ""].filter(Boolean).join(", ") || "as carroças chegaram vazias"}${fate.escort.length > 0 ? `. ${fate.escort.map((b) => b.name).join(" e ")} se junta ao exército` : ""}.`,
        "good",
      ),
    );
    set({ battalions: packs.battalions, cargo: s.cargo + rest, wagons, train: "ARMY", convoy: null, log: appendLog(s.log, lines) });
  },

  loseWagon: (id, by) => {
    const s = get();
    if (!s.wagons.some((w) => w.id === id)) return;
    const cap = cargoCapacity(s.wagons.length);
    // A carga é de todas juntas: some a parte que cabia nesta carroça (paradas no acampamento, vazias)
    const lost = s.train === "ARMY" ? Math.round(s.cargo * (SUPPLY.WAGON_CAPACITY / cap)) : 0;
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
    if (x.away !== e.away || x.swamp !== e.swamp || x.cold !== e.cold || x.sickTown !== e.sickTown || x.field !== e.field) set({ exposure: e });
  },

  forageAt: (region, biome, owner) => {
    const s = get();
    const soldiers = s.battalions.reduce((n, b) => n + b.soldiers, 0);
    const depleted = s.forage[region] ?? 0;
    const gained = Math.round(
      soldiers * SUPPLY.FORAGE_PER_SOLDIER * SUPPLY.FORAGE_SEASON[seasonOf(s.day)] * (SUPPLY.FORAGE_BIOME[biome] ?? 0.8) * (1 - depleted),
    );
    const going = marchingIds(s);
    const packRoom = s.battalions.filter((b) => going.has(b.id)).reduce((n, b) => n + Math.max(0, packCapacity(b) - packOf(b)), 0);
    const room = s.campPacked ? Infinity : packRoom + Math.max(0, cargoCapacity(wagonsWithArmy(s)) - s.cargo - freightWeight(s.freight));
    const got = Math.max(0, Math.min(gained, room));
    const lines = [
      entry(
        s.day,
        got > 0
          ? `O bando forrageou ${got} rações${got < gained ? " (as mochilas não levam mais)" : ""}${depleted > 0.3 ? "; a região já está rapada" : ""}.`
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
    const filled = fillPacks(s.battalions, s.campPacked ? 0 : got, (b) => going.has(b.id));
    set({
      ...(s.campPacked ? { rations: s.rations + got } : { cargo: s.cargo + got - filled.used, battalions: filled.battalions }),
      forage: { ...s.forage, [region]: Math.min(1, depleted + SUPPLY.FORAGE_DEPLETION) },
      factions,
      log: appendLog(s.log, lines),
    });
    return lines[0].text;
  },

  // --- A planta do acampamento (Marco 22, parte 1) ---

  placeBuilding: (kind, x, y) => {
    const s = get();
    const def = CAMP_BUILDINGS[kind];
    const why = campBusy(s) ?? buildProblem(s.campPlan, kind) ?? placeProblem(s.campPlan, kind, x, y) ?? shortOf(def.cost, stockOf(s));
    if (why) return why;
    // Obras levam dias (Marco 22, parte 2): quem ergue são os seguidores e os batalhões no turno de obra
    set({
      ...paid(s, def.cost),
      campPlan: { ...s.campPlan, buildings: [...s.campPlan.buildings, newWork(kind, x, y)] },
      log: appendLog(s.log, [entry(s.day, `Obra começada no acampamento: ${def.label.toLowerCase()} (${workOf(kind)} de trabalho).`, "good")]),
    });
    return null;
  },

  moveBuilding: (id, x, y) => {
    const s = get();
    const b = s.campPlan.buildings.find((v) => v.id === id);
    if (!b) return "Essa construção não existe mais.";
    const why = campBusy(s) ?? placeProblem(s.campPlan, b.kind, x, y, id);
    if (why) return why;
    set({ campPlan: { ...s.campPlan, buildings: s.campPlan.buildings.map((v) => (v.id === id ? { ...v, x, y } : v)) } });
    return null;
  },

  dismantleBuilding: (id) => {
    const s = get();
    const b = s.campPlan.buildings.find((v) => v.id === id);
    if (!b) return "Essa construção não existe mais.";
    const def = CAMP_BUILDINGS[b.kind];
    if (def.fixed) return `${def.label} não se desmonta.`;
    const busy = campBusy(s);
    if (busy) return busy;
    if (b.kind === "TRAINING" && s.training.length > 0) return "Há batalhões treinando.";
    // Obra que nem começou volta inteira; o resto, metade
    const back = b.built === 0 ? { gold: def.cost.gold, wood: def.cost.wood ?? 0, iron: def.cost.iron ?? 0 } : refundOf(b);
    set({
      gold: s.gold + back.gold,
      iron: s.iron + (back.iron ?? 0),
      depot: { ...s.depot, WOOD: (s.depot.WOOD ?? 0) + (back.wood ?? 0) },
      campPlan: { ...s.campPlan, buildings: s.campPlan.buildings.filter((v) => v.id !== id) },
      log: appendLog(s.log, [entry(s.day, `Desmontado: ${def.label.toLowerCase()} (voltaram ${costText({ gold: back.gold, wood: back.wood, iron: back.iron })}).`)]),
    });
    return null;
  },

  upgradeBuilding: (id) => {
    const s = get();
    const b = s.campPlan.buildings.find((v) => v.id === id);
    if (!b) return "Essa construção não existe mais.";
    if (!isBuilt(b)) return "Ainda está em obra.";
    const cost = upgradeCost(b);
    if (!cost) return "Já está no último nível.";
    const why = campBusy(s) ?? shortOf(cost, stockOf(s));
    if (why) return why;
    set({
      ...paid(s, cost),
      campPlan: { ...s.campPlan, buildings: s.campPlan.buildings.map((v) => (v.id === id ? { ...v, level: v.level + 1 } : v)) },
      log: appendLog(s.log, [entry(s.day, `${CAMP_BUILDINGS[b.kind].label} subiu para o nível ${b.level + 1}.`, "good")]),
    });
    return null;
  },

  setCampGate: (side) => {
    const s = get();
    if (s.campPlan.gate === side) return null;
    const why = campBusy(s) ?? gateProblem(s.campPlan, side);
    if (why) return why;
    set({ campPlan: { ...s.campPlan, gate: side } });
    return null;
  },

  growPalisade: () => {
    const s = get();
    const next = nextSize(s.campPlan);
    if (!next) return "A paliçada já é a grande.";
    // A fortaleza não é só uma paliçada maior: pede a terra (Marco 22, parte 3)
    if (next === 34) return "Para virar fortaleza, o bando finca o estandarte.";
    const step = PALISADE_STEPS[next];
    const why = campBusy(s) ?? growProblem(s.campPlan, { fame: s.fame, battalions: s.battalions.length }) ?? shortOf(step.cost, stockOf(s));
    if (why) return why;
    set({
      ...paid(s, step.cost),
      campPlan: grown(s.campPlan),
      log: appendLog(s.log, [entry(s.day, next === 16 ? "O bivaque virou acampamento: a paliçada pequena está de pé." : `${step.label}: o acampamento cresceu.`, "good")]),
    });
    return null;
  },

  digDitch: () => {
    const s = get();
    if (s.campPlan.ditch) return "O fosso já está cavado.";
    if (tierOf(s.campPlan) < 1) return "Só em volta de uma paliçada.";
    const why = campBusy(s) ?? shortOf(DITCH.cost, stockOf(s));
    if (why) return why;
    set({ ...paid(s, DITCH.cost), campPlan: { ...s.campPlan, ditch: true }, log: appendLog(s.log, [entry(s.day, "O fosso está cavado em volta da paliçada.", "good")]) });
    return null;
  },

  setShift: (battalionId, shift) => set((s) => ({ shifts: { ...s.shifts, [battalionId]: shift } })),

  togglePost: (buildingId) =>
    set((s) => ({ campPlan: { ...s.campPlan, buildings: s.campPlan.buildings.map((b) => (b.id === buildingId ? { ...b, off: !b.off } : b)) } })),

  setCampForest: (share) => set({ campForest: Math.max(0, Math.min(1, share)) }),

  carpentry: (item) => {
    const s = get();
    const working = campStaffing(s).working;
    const def = { cost: carpentryCost(s.campPlan, working, item) };
    const why = campBusy(s) ?? carpentryProblem(s.campPlan, working, item, s.siegeKit, s.wagons.length) ?? shortOf(def.cost, stockOf(s));
    if (why) return why;
    const kit = { ...s.siegeKit };
    if (item === "LADDER") kit.ladders++;
    if (item === "RAM") kit.rams++;
    set({
      ...paid(s, def.cost),
      siegeKit: kit,
      wagons: item === "WAGON" ? [...s.wagons, { id: newId(), hp: SUPPLY.WAGON.hp }] : s.wagons,
      log: appendLog(s.log, [entry(s.day, `A carpintaria fez ${item === "WAGON" ? "uma carroça" : item === "LADDER" ? "uma escada de cerco" : "um aríete"}.`, "good")]),
    });
    return null;
  },

  formVolunteers: () => {
    const s = get();
    const rate = volunteerRate(s.campPlan);
    if (rate.cap === 0) return "Sem mastro de recrutamento, ninguém vem.";
    if (s.volunteers < VOLUNTEERS.CAP) return `Faltam ${VOLUNTEERS.CAP - s.volunteers} voluntários.`;
    const cost = Math.round(TROOPS.INFANTRY.cost * VOLUNTEER_COST);
    if (s.gold < cost) return `Faltam ${cost - s.gold} de ouro para o equipamento.`;
    const b = newBattalion(s.battalions, "INFANTRY", localRecruits(s, s.world?.camp.center));
    set({
      gold: s.gold - cost,
      volunteers: s.volunteers - VOLUNTEERS.CAP,
      battalions: [...s.battalions, b],
      log: appendLog(s.log, [entry(s.day, `Os voluntários do mastro formam ${b.name} (${cost} de ouro em equipamento).`, "good")]),
    });
    return null;
  },

  hireInterpreter: (settlementId) => {
    const s = get();
    const t = s.settlements.find((v) => v.id === settlementId);
    if (!t) return "Povoado desconhecido.";
    const tongue = interpreterTongue(s, t);
    if (!tongue) return "Ninguém aqui fala uma língua que o Comandante já não fale.";
    const mine = s.followers.filter((f) => f.role === "INTERPRETER");
    if (mine.some((f) => f.tongue === tongue)) return `O bando já tem quem fale ${TONGUE[tongue].label}.`;
    if (mine.length >= LANGUAGE.INTERPRETERS) return `O bando já leva ${LANGUAGE.INTERPRETERS} intérpretes.`;
    if (s.gold < LANGUAGE.INTERPRETER_COST) return `Faltam ${LANGUAGE.INTERPRETER_COST - s.gold} de ouro.`;
    const f: Follower = { ...newFollower("INTERPRETER", s.day), name: nameIn(tongue, Math.random() < 0.5), tongue };
    set({
      gold: s.gold - LANGUAGE.INTERPRETER_COST,
      followers: [...s.followers, f],
      log: appendLog(s.log, [entry(s.day, `Na taverna de ${t.name}, ${interpreterTitle(f.name)} do bando, assinou: fala ${TONGUE[tongue].label}.`, "good")]),
    });
    return null;
  },

  hireAtTavern: (settlementId) => {
    const s = get();
    const t = s.settlements.find((v) => v.id === settlementId);
    if (!t) return "Povoado desconhecido.";
    const last = s.tavernHires[settlementId];
    if (last !== undefined && s.day - last < TAVERN_HIRE.EVERY_DAYS) return `Ninguém mais quer assinar esta semana. Volte em ${TAVERN_HIRE.EVERY_DAYS - (s.day - last)} dia(s).`;
    const cost = Math.round(TROOPS.INFANTRY.cost * TAVERN_HIRE.COST);
    if (s.gold < cost) return `Faltam ${cost - s.gold} de ouro.`;
    const b = newBattalion(s.battalions, "INFANTRY", localRecruits(s, t));
    set({
      gold: s.gold - cost,
      battalions: [...s.battalions, b],
      tavernHires: { ...s.tavernHires, [settlementId]: s.day },
      log: appendLog(s.log, [entry(s.day, `Na taverna de ${t.name}, ${b.name} assinou com o bando por ${cost} de ouro.`, "good")]),
    });
    return null;
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
    if (isFortress(s.campPlan)) return "A fortaleza não sai do lugar: em campanha, o bando leva o acampamento de campo.";
    if (s.mutiny || s.pendingMutiny) return "Motim no acampamento.";
    if (s.training.length > 0) return "Há batalhões no Campo de Treino.";
    if (s.convoy) return "Espere o comboio voltar: as carroças estão na estrada.";
    // A planta vai nas carroças (Marco 22): o que não cabe, e o que é cavado, fica para trás
    const packed = packPlan(s.campPlan, s.wagons.length);
    const left = packed.left.filter((b) => !CAMP_BUILDINGS[b.kind].stays);
    const lines = [entry(s.day, `Os ${s.world?.bandName ?? "mercenários"} levantaram acampamento: barracas, depósito e seguidores vão nas carroças.`)];
    if (left.length > 0) lines.push(entry(s.day, `Não coube nas carroças e ficou para trás: ${left.map((b) => CAMP_BUILDINGS[b.kind].label.toLowerCase()).join(", ")}.`, "bad"));
    if (packed.plan.size < s.campPlan.size) lines.push(entry(s.day, "A paliçada não coube nas carroças: o acampamento volta a ser um bivaque.", "bad"));
    set({
      campPacked: true,
      train: "ARMY",
      campPlan: packed.plan,
      campPanel: null,
      log: appendLog(s.log, lines),
    });
    return null;
  },

  pitchCamp: (center, field, wood = 0, forest = 0) => {
    const s = get();
    if (!s.world || !s.campPacked) return;
    const world = s.world;
    world.camp = campDefAt(center);
    const lines = [entry(s.day, `O acampamento foi montado de novo em ${regionName(world, center)}.`, "good")];
    if (wood > 0) lines.push(entry(s.day, `As árvores de dentro da paliçada viraram ${wood} de madeira.`, "good"));
    set({
      campAt: { x: Math.round(center.x), y: Math.round(center.y) },
      campPacked: false,
      campForest: forest,
      depot: wood > 0 ? { ...s.depot, WOOD: (s.depot.WOOD ?? 0) + wood } : s.depot,
      pendingField: field,
      // O mundo é recriado (o acampamento novo, a colisão, as rotas)
      loadNonce: s.loadNonce + 1,
      log: appendLog(s.log, lines),
    });
  },

  // --- Economia e comércio (Marco 14) ---

  tradeGood: (settlementId, good, qty) => {
    const s = get();
    const t = s.settlements.find((x) => x.id === settlementId);
    if (!t || qty === 0) return "Nada a negociar.";
    if (t.owner === "RUINED" || isCalamityOwner(t.owner)) return "Não há mercado aqui.";
    if (s.factions.some((f) => f.id === t.owner && f.atWar)) return "Em guerra: o mercado está fechado para o bando.";
    // A feitoria melhora a margem; sem quem fale a língua de lá, ela piora (Marco 23)
    const margin = (s.posts.includes(t.id) ? TRADE.POST_MARGIN : 0) + priceMargin(townBarrier(s, t));
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
      saltSold: s.saltSold + (good === "SALT" ? n : 0),
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
      lieutenantCandidates: freshLieutenants(s.day, s.world?.culture),
      captainCandidates: freshCaptains(s.day, s.world?.culture),
      log: appendLog(s.log, [entry(s.day, `Contrato cumprido: "${c.title}". ${t.name} pagou ${c.reward} de ouro.`, "good")]),
    });
    return null;
  },

  finishContract: (success, why) => {
    const s = get();
    const c = s.activeContract?.contract;
    if (!c) return;
    set({
      ...contractClosing(s, c, success, success ? `Contrato cumprido: "${c.title}" (${why}). ${c.client} pagou ${c.reward} de ouro.` : `Contrato perdido: "${c.title}" (${why}).`),
      activeContract: null,
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
    const loan: Loan = { id: newId(), from: t.id, principal: amount, interest: Math.round(amount * TRADE.LOAN_INTEREST), dueDay: s.day + TRADE.LOAN_WEEKS * 7, missed: 0 };
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
    const caravan: OwnCaravan = { id: newId(), name: `Caravana nº ${n} dos ${s.world.bandName}`, a, b, trips: 0, profit: 0 };
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
    // O templo da cidade lembra da esmola (Marco 23)
    const faith = templeFaith(s, t);
    set({
      gold: s.gold - gold,
      honor: Math.min(100, s.honor + Math.min(6, Math.round(gold / 10))),
      campMood: Math.min(30, s.campMood + 2),
      faithFavor: addFavor(s.faithFavor, faith, gold / FAITH.GOLD_PER_FAVOR),
      settlements: s.settlements.map((x) => (x.id === t.id && sick ? { ...x, sickUntil: Math.max(s.day, (x.sickUntil ?? s.day) - 3) } : x)),
      log: appendLog(s.log, [entry(s.day, `O Comandante deu ${gold} de ouro ao templo de ${t.name}.${sick ? " Os monges cuidam melhor dos febris." : ""}`, "good")]),
    });
    return true;
  },

  buryDead: () => {
    const s = get();
    const u = s.unburied;
    if (!u) return "Não há mortos esperando enterro.";
    let favor = s.faithFavor;
    for (const f of u.faiths) favor = addFavor(favor, f, FAITH.BURY_FAVOR);
    set({
      unburied: null,
      faithFavor: favor,
      campMood: Math.min(30, s.campMood + FAITH.BURY_MOOD),
      log: appendLog(s.log, [entry(s.day, `O bando enterrou os seus ${u.dead} morto(s) antes de marchar. Os fiéis ${u.faiths.map((f) => FAITHS[f].of).join(" e ")} rezaram por eles.`, "good")]),
    });
    // Cavar leva horas: o relógio anda (e o inimigo também)
    get().advanceTime(FAITH.BURY_DAYS);
    return null;
  },

  leaveDead: () => {
    const s = get();
    const left = abandonDead(s);
    if (!left) return;
    set({ unburied: null, faithFavor: left.faithFavor, campMood: left.campMood, log: appendLog(s.log, [left.line]) });
  },

  breakFast: (faith) => {
    const s = get();
    if (!isFasting(faith, s.day)) return "Não é tempo de jejum.";
    const key = fastKey(faith, s.day);
    if (s.fastBroken.includes(key)) return "O jejum já foi quebrado.";
    const def = FAITHS[faith];
    set({
      fastBroken: [...s.fastBroken.filter((k) => !k.startsWith(`${faith}:`)), key],
      faithFavor: addFavor(s.faithFavor, faith, FAITH.FAST_BROKEN_FAVOR),
      campMood: Math.max(-30, s.campMood + FAITH.FAST_BROKEN_MOOD),
      log: appendLog(s.log, [entry(s.day, `O Comandante mandou quebrar o ${def.fast?.label ?? "jejum"}: os fiéis ${def.of} comem e lutam inteiros, mas o templo não perdoa.`, "bad")]),
    });
    return null;
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
      (b) => ids.includes(b.id) && canTrain(b.level) && !s.training.some((t) => t.battalionId === b.id),
    );
    const cost = trainees.reduce((n, b) => n + trainingCost(b.level), 0);
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

  promoteBattalion: (battalionId, to) => {
    const s = get();
    const b = s.battalions.find((x) => x.id === battalionId);
    if (!b) return "Batalhão não encontrado.";
    const why = canPromote(b, to);
    if (why) return why;
    if (s.training.some((t) => t.battalionId === b.id)) return "Está em treino.";
    const price = promotionCost(b.troopType, to);
    // Quem passa a montar precisa de cavalo (Marco 14)
    const mounts = TROOPS[to].family === "CAVALRY" && TROOPS[b.troopType].family !== "CAVALRY";
    const horses = mounts ? horseDeal(s, b.soldiers * TRADE.HORSES_PER_RIDER) : null;
    if (horses && !horses.ok) return "Faltam cavalos.";
    const gold = price.gold + (horses?.cost ?? 0);
    if (s.gold < gold) return `Falta ouro: custa ${gold}.`;
    if (s.iron < price.iron) return `Falta ferro: custa ${price.iron}.`;
    // Outro ofício, outras habilidades: os pontos voltam para a escolha
    const sameCraft = TROOPS[to].family === TROOPS[b.troopType].family;
    const formation = TROOPS[to].formations.includes(b.formation) ? b.formation : TROOPS[to].formations[0];
    set({
      ...(horses?.apply ?? {}),
      gold: s.gold - gold,
      iron: s.iron - price.iron,
      battalions: s.battalions.map((x) =>
        x.id === b.id ? { ...x, troopType: to, formation, skills: sameCraft ? x.skills : [], skillPoints: sameCraft ? x.skillPoints : x.skillPoints + x.skills.length } : x,
      ),
      log: appendLog(s.log, [entry(s.day, `${b.name} agora serve como ${TROOPS[to].label} (${gold} de ouro e ${price.iron} de ferro).`, "good")]),
    });
    return null;
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
      const cost = amount * ironBuyPrice(s);
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
    if (!c || s.gold < c.hireCost || s.lieutenants.length >= lieutenantSlots(s.campPlan, LIEUTENANTS.MAX_HIRED)) return false;
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
  setCampBuild: (build) => set({ campBuild: build, ...(build ? { campPanel: null } : {}) }),
  setCampPrompt: (prompt) => {
    if (get().campPrompt !== prompt) set({ campPrompt: prompt });
  },
}));

// A crônica nunca se perde: o diário é curto, as Lendas guardam tudo (Marco 18)
useGameStore.subscribe((s, prev) => {
  if (s.log === prev.log && s.lieutenants === prev.lieutenants && s.captains === prev.captains) return;
  const last = s.annals[s.annals.length - 1]?.id ?? 0;
  const fresh = s.log.filter((e) => e.id > last);
  const unseen = [...s.lieutenants, ...s.captains].filter((l) => s.roll[l.id]?.history.length !== l.history.length);
  if (fresh.length === 0 && unseen.length === 0) return;
  const land = s.world?.name ?? "";
  useGameStore.setState({
    annals: fresh.length > 0 ? trimAnnals([...s.annals, ...fresh.map((e) => ({ id: e.id, day: e.day, text: e.text, tone: e.tone, land }))], LEGACY.ANNALS_MAX) : s.annals,
    roll: unseen.length > 0 ? { ...s.roll, ...Object.fromEntries(unseen.map((l) => [l.id, { name: l.name, history: l.history }])) } : s.roll,
  });
});

// Companhia não guarda batalhão que deixou de existir (morreu, desertou, ficou noutra terra)
useGameStore.subscribe((s, prev) => {
  if (s.battalions === prev.battalions && s.expeditions === prev.expeditions && s.captains === prev.captains) return;
  const ids = new Set([...s.battalions, ...s.expeditions.flatMap((e) => e.battalions)].map((b) => b.id));
  const captains = pruneCompanies(s.captains, (id) => ids.has(id));
  if (captains !== s.captains) useGameStore.setState({ captains });
});

// Acesso para depuração/testes automatizados (somente em dev)
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __store?: typeof useGameStore }).__store = useGameStore;

import Phaser from "phaser";
import { Commander, type CommanderKeys } from "../entities/Commander";
import { Battalion } from "../entities/Battalion";
import { Enemy } from "../entities/Enemy";
import { Messenger, type MissionStop } from "../entities/Messenger";
import { Scout, type ScoutMode } from "../entities/Scout";
import { Unit, type TownAccess } from "../entities/Unit";
import { Wagon } from "../entities/Wagon";
import { WeatherLayer } from "../world/WeatherLayer";
import { isFlood, seasonOf, weatherAt } from "../../utils/season";
import { CAMP_HEIGHT, CAMP_WIDTH } from "../data/campLayout";
import { resolveAttacks } from "../systems/CombatSystem";
import { FogOfWar, type VisionSource } from "../systems/FogOfWar";
import { updateMorale } from "../systems/MoraleSystem";
import { clampToWorld, separateUnits } from "../systems/MovementSystem";
import { layoutGroup } from "../systems/GroupLayout";
import { WarbandManager, bandSize, type Warband, type WarbandEvent } from "../systems/Warbands";
import { TerrainMap, TerrainStreamer } from "../world/TerrainMap";
import { NightLayer, type Light } from "../world/NightLayer";
import { CampArea, type Interactable } from "../world/CampArea";
import { StaticCuller } from "../world/StaticCuller";
import { SettlementLayer, drawCalamityLair, drawSites, ownerColor } from "../world/Settlements";
import { NavGrid } from "../systems/NavGrid";
import { TOWN_SIZE, insideTown, nearestGate, specialHouses, type Rect, type TownLayout } from "../world/townLayout";
import { kingdomsAtWar } from "../sim/realm";
import { nobleName } from "../sim/nobility";
import { GarrisonManager } from "../world/Garrisons";
import { WildlifeManager, type WildlifeContext } from "../world/Wildlife";
import { CampLife, type CampState } from "../world/CampLife";
import { MapLife, type MapLifeContext } from "../world/MapLife";
import { TradeRoutes, type TradeNews } from "../world/TradeRoutes";
import { FRIEND_AT, bondOf, followerCap } from "../sim/campEvents";
import { geoOf } from "../worldgen/geoMap";
import { TheRealm, ofRealm } from "../worldgen/names";
import { scaleGroups, type EnemyGroupDef } from "../data/battleMaps";
import { DIFFICULTY, type Contract } from "../data/contracts";
import { ferryDocks, regionName, type WorldDef } from "../data/world";
import { isCalamityOwner, isFactionOwner, isRaiderKind, isSick, type Settlement } from "../sim/realm";
import { AUTO_SLOT, registerFieldCapture, unregisterFieldCapture, type EnemySave, type FieldSave } from "../save/saveGame";
import {
  mutinyLeader,
  useGameStore,
  type BattalionData,
  type BattalionSurvivors,
  type BattleCommand,
  type BattleResult,
  type GameState,
  type SupportReport,
  type TrumpetCall,
  type WarbandSighting,
} from "../../store/useGameStore";
import {
  BALANCE,
  CAMERA,
  COLORS,
  FORMATIONS,
  SUPPORT,
  AGENTS,
  GEO,
  PROGRESSION,
  REALM,
  KINGDOM,
  TERRAIN,
  TIME,
  WOLF,
  WORLD,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  CAMP_MOVE,
  ECONOMY,
  FATIGUE,
  SEASONS,
  SUPPLY,
  WEATHER,
  TRADE,
  GOODS,
  setWorldSize,
  type EnemyKind,
  type Formation,
  type Season,
  type TerrainType,
  type Weather,
} from "../../utils/constants";
import { campMoraleBonus, cargoCapacity, dailyRations, startingMorale } from "../../utils/economy";
import { freightWeight } from "../sim/trade";
import { roadGraphOf } from "../sim/roadGraph";
import { darknessAt, daysUntilHour, formatHour, hourOf, phaseOf } from "../../utils/time";
import { AudioEngine } from "../../audio/AudioEngine";
import { sfx, startCampfireAmbience, stopCampfireAmbience } from "../../audio/sounds";
import { angleTo, centroid, distance, nearest, type Point } from "../../utils/math";

type BattleKeys = CommanderKeys & {
  SPACE: Phaser.Input.Keyboard.Key;
  F: Phaser.Input.Keyboard.Key;
  Q: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
  ONE: Phaser.Input.Keyboard.Key;
  TWO: Phaser.Input.Keyboard.Key;
  THREE: Phaser.Input.Keyboard.Key;
  FOUR: Phaser.Input.Keyboard.Key;
  C: Phaser.Input.Keyboard.Key;
  H: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
  R: Phaser.Input.Keyboard.Key;
  E: Phaser.Input.Keyboard.Key;
  TAB: Phaser.Input.Keyboard.Key;
  T: Phaser.Input.Keyboard.Key;
  V: Phaser.Input.Keyboard.Key;
  G: Phaser.Input.Keyboard.Key;
};

const FORMATION_KEYS: [keyof BattleKeys, Formation][] = [
  ["ONE", "LINE"],
  ["TWO", "SHIELD_WALL"],
  ["THREE", "WEDGE"],
  ["FOUR", "LOOSE"],
];

const SCOUT_MODE_LABEL: Record<ScoutMode, string> = {
  VANGUARD: "Vanguarda",
  EXPLORE: "Explorar",
  RECALL: "Recolher",
};

/** Arrasto menor que isto (px de mundo) conta como clique, não como caixa de seleção. */
const DRAG_THRESHOLD = 6;
const FEED_SIZE = 5;

function isShiftHeld(pointer: Phaser.Input.Pointer): boolean {
  return (pointer.event as MouseEvent | undefined)?.shiftKey ?? false;
}

/** Quem pode receber ordens (batalhão ou batedor). */
type OrderRecipient = Battalion | Scout;

/**
 * Natureza da ordem, que define por qual meio ela pode chegar:
 * COMPLEX (ponto, alvo, foco, arranjo) só por voz ou mensageiro; BASIC também por trombeta;
 * VISUAL (formação) também por estandarte; BASIC_VISUAL (seguir/reunir) por qualquer um.
 */
type OrderChannel = "COMPLEX" | "BASIC" | "VISUAL" | "BASIC_VISUAL";
type Reach = "VOICE" | "TRUMPET" | "BANNER";

/** Entrega que precisa de mensageiro, aguardando o fim do lote para ser agrupada. */
interface PendingDelivery {
  order: string;
  stop: MissionStop;
  recipient: OrderRecipient;
}

/** Combate em andamento no mundo: quem lutou, como estava no começo e o que já aconteceu. */
interface Engagement {
  enemies: Set<Enemy>;
  /** Batalhões que entraram no combate (só eles ganham XP e entram no relatório). */
  participants: Set<Battalion>;
  /** Abates de cada batalhão (e do tenente) quando entrou no combate. */
  startKills: Map<Battalion, { kills: number; lieutenantKills: number }>;
  quietSince: number | null;
  region: string;
  contractDone: boolean;
  /** Acontecimentos para o relatório (povoado tomado, líder abatido...). */
  notes: string[];
}

/** A cena do mundo mais recente (ao carregar um jogo, a antiga ainda vive por um quadro). */
let activeScene: WorldScene | null = null;

/**
 * Portões de um povoado (Marco 12): o exército do bando só entra nos povoados do bando e nas
 * ruínas; o Comandante e os cavaleiros entram nos outros, menos em guerra, sob calamidade ou
 * durante um cerco.
 */
interface GateRule {
  id: string;
  name: string;
  bounds: Rect;
  army: boolean;
  visitor: boolean;
}

/** O reino conhece o bando o bastante para deixar passar sem portagem. */
const isFactionFriend = (s: GameState, owner: string) => owner === "PLAYER" || (s.factions.find((f) => f.id === owner)?.relation ?? 0) >= 15;

const inRect = (r: Rect, p: Point, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
/** Distância de um ponto até um retângulo (0 dentro dele). */
const rectDistance = (r: Rect, p: Point) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

/** Passos da viagem rápida (fração de dia por passo). */
const TRAVEL_STEP_DAYS = 0.05;
/** O relógio do store é atualizado em lotes (não a cada quadro). */
const CLOCK_FLUSH_MS = 500;
const SNAPSHOT_MS = 500;

const TRUMPET_LABEL: Record<TrumpetCall, string> = {
  ADVANCE: "Avançar",
  HALT: "Alto",
  CHARGE: "Carregar",
  RETREAT: "Recuar",
  RALLY: "Reunir ao estandarte",
};

/**
 * O mundo contínuo (Marco 7): exploração, gestão e combate no mesmo mapa em tempo real.
 * O acampamento, as cidades e os locais de contrato são lugares do mapa; o combate começa
 * quando inimigos e tropas se encontram e termina com um relatório, sem trocar de cena.
 */
export class WorldScene extends Phaser.Scene {
  private commander!: Commander;
  private battalions: Battalion[] = [];
  private scouts: Scout[] = [];
  private messengers: Messenger[] = [];
  private enemies: Enemy[] = [];
  private keys!: BattleKeys;
  private lastHudAt = 0;
  private lastFogAt = -Infinity;

  private campArea!: CampArea;
  /** Rotina dos soldados e seguidores no acampamento (Marco 12). */
  private campLife!: CampLife;
  /** Gente e bichos perto da câmera, e os sinais do mapa (fumaça, corvos, rastros). */
  private mapLife!: MapLife;
  private lastCampStateAt = -Infinity;
  private culler!: StaticCuller;
  /** Chão e terreno carregados em pedaços perto da câmera. */
  private terrainStreamer!: TerrainStreamer;
  private night!: NightLayer;
  /** Rotas por terra (rios, mar e montanhas bloqueiam; estradas são preferidas). */
  private nav!: NavGrid;
  /** Pontes do mundo como lugares de interação (queimar, reconstruir). */
  private bridgeSpots: Interactable[] = [];
  /** Ponte que o Comandante está cruzando agora (o pedágio é cobrado uma vez por travessia). */
  private onBridge: string | null = null;
  /** Tochas acesas: o bando enxerga mais à noite, mas é visto de longe. */
  private torches = true;
  /** Quando cada inimigo apareceu à vista (emboscada noturna = surgiu do escuro há pouco). */
  private firstSeenAt = new WeakMap<Enemy, number>();
  private lastAutosaveAt = -Infinity;
  /** Mundo gerado desta campanha. */
  private world!: WorldDef;
  private settlementLayer!: SettlementLayer;
  /** Quando acabou o último combate (feridos na enfermaria por um dia). */
  private lastCombatDay = -Infinity;
  /** Povoado sob cerco (a guarnição luta contra o bando). */
  private siegeId: string | null = null;
  /** Guarnições de verdade nos povoados perto do bando. */
  private garrisons!: GarrisonManager;
  /** Alcateias de lobos. */
  private wildlife!: WildlifeManager;
  /** Rotas das tropas do bando (povoados que barram o exército contam como muro). */
  private armyNav!: NavGrid;
  /** Povoados e para quem os portões estão fechados (ver updateGateRules). */
  private gateRules: GateRule[] = [];
  /** O Comandante está dentro de um povoado que barrou o exército: onde a tropa espera. */
  private visit: { townId: string; hold: { point: Point; facing: number } } | null = null;
  private lastGarrisonAt = -Infinity;
  /** Covis de calamidade já postos no mapa (desenho, líder e guardas). */
  private calamityObjects = new Map<string, { objects: Phaser.GameObjects.GameObject[]; boss: Enemy }>();
  private nearestSpot: Interactable | null = null;
  /** Caminhada por clique até um local (e o painel a abrir ao chegar). */
  private walkPath: { path: Point[]; open?: Interactable["panel"]; enter?: Interactable } | null = null;
  private inCamp = true;
  /** Batalhões descansando nos alojamentos (voltam a seguir o Comandante quando ele sai). */
  private quartered = new Set<string>();
  private warbands!: WarbandManager;
  private engagement: Engagement | null = null;
  /** Inimigos do contrato ativo e do motim, já postos no mapa. */
  private contractEnemies: Enemy[] = [];
  private contractId: string | null = null;
  private mutineers: Enemy[] = [];
  /** Dados do exército mudaram no store (recrutar, reforçar, desertar...): recriar em campo. */
  private armyDirty = false;
  private clockAccum = 0;
  private lastClockFlush = 0;
  private lastCommanderPos: Point = { x: 0, y: 0 };
  private lastSnapshotAt = -Infinity;
  /** Baixas de batedores/mensageiros já informadas ao store. */
  private reportedDead = new Set<string>();
  private dragStart: Point | null = null;
  /** Assinatura de quem está seguindo o Comandante (ver assignFollowSlots). */
  private followKey = "";
  private selectionBox!: Phaser.GameObjects.Graphics;

  private fog!: FogOfWar;
  /** Último lugar e momento em que cada inimigo foi visto (fantasmas na névoa). */
  private lastSeen = new Map<Enemy, { x: number; y: number; t: number }>();
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private commandRing!: Phaser.GameObjects.Graphics;
  private missionGfx!: Phaser.GameObjects.Graphics;
  private feed: string[] = [];
  private deadScoutIds: string[] = [];
  private deadMessengerIds: string[] = [];

  /** Câmera presa no Comandante (padrão) ou solta para comandar a distância. */
  private cameraLocked = true;
  /** Arrasto com o botão do meio: ponto inicial da tela e da câmera. */
  private panDrag: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  /** O mouse se moveu dentro do jogo e não saiu (evita rolar pela borda com posição velha). */
  private pointerInGame = false;
  /** Entregas por mensageiro acumuladas durante uma ordem em grupo (ver withOrderBatch). */
  private pendingBatch: PendingDelivery[] | null = null;
  private lastTrumpetFx = -Infinity;
  private lastBannerFx = -Infinity;
  private warCryAt = -Infinity;

  // --- Estações, clima e logística (Marco 13) ---
  /** Carroças do trem de suprimentos em campo. */
  private wagons: Wagon[] = [];
  /** Marcha forçada: o dia rende mais caminho, a tropa cansa muito mais. */
  private forced = false;
  private weatherLayer!: WeatherLayer;
  /** Tempo onde o Comandante está (vale para a ação perto dele). */
  private weather: Weather = "CLEAR";
  private season: Season = "SUMMER";
  private lastWeatherAt = -Infinity;
  /** Estação aplicada no terreno (gelo, cheia, neve): muda o chão e as rotas. */
  private seasonKey = "";
  private lastIceAt = 0;
  /** Fadiga de cada batalhão (sobrevive a quando ele é recriado) e onde estava no quadro anterior. */
  private fatigueById = new Map<string, number>();
  private fatiguePos = new Map<string, Point>();

  // --- Economia e comércio (Marco 14) ---
  /** Caravanas, barcaças e navios dos mercadores (e as do bando). */
  private trade!: TradeRoutes;

  constructor() {
    super("WorldScene");
  }

  /** Sem simulação com o mapa, um relatório ou um painel abertos (pausa tática). */
  private get ended(): boolean {
    const s = useGameStore.getState();
    return s.worldMapOpen || s.battleReport !== null || s.campPanel !== null || s.campEvent !== null;
  }

  create(): void {
    this.battalions = [];
    this.scouts = [];
    this.messengers = [];
    this.enemies = [];
    this.lastHudAt = 0;
    this.lastFogAt = -Infinity;
    this.dragStart = null;
    this.lastSeen = new Map();
    this.feed = [];
    this.deadScoutIds = [];
    this.deadMessengerIds = [];
    this.reportedDead = new Set();
    this.cameraLocked = true;
    this.panDrag = null;
    this.pointerInGame = false;
    this.lastTrumpetFx = -Infinity;
    this.lastBannerFx = -Infinity;
    this.warCryAt = -Infinity;
    this.walkPath = null;
    this.inCamp = true;
    this.quartered = new Set();
    this.engagement = null;
    this.contractEnemies = [];
    this.contractId = null;
    this.mutineers = [];
    this.armyDirty = false;
    this.clockAccum = 0;
    this.lastClockFlush = 0;
    this.lastSnapshotAt = -Infinity;

    this.siegeId = null;
    this.gateRules = [];
    this.visit = null;
    this.lastGarrisonAt = -Infinity;
    this.calamityObjects = new Map();
    this.torches = true;
    this.firstSeenAt = new WeakMap();
    this.lastAutosaveAt = -Infinity;
    this.lastVisitNoteAt = -Infinity;
    this.wagons = [];
    this.forced = false;
    this.weather = "CLEAR";
    this.lastWeatherAt = -Infinity;
    this.seasonKey = "";
    this.lastIceAt = 0;
    this.fatigueById = new Map();
    this.fatiguePos = new Map();
    this.interiorReturn = null;
    this.houseCache = null;

    const store = useGameStore.getState();
    if (!store.world) throw new Error("Mundo não gerado");
    this.world = store.world;
    setWorldSize(this.world.cols, this.world.rows);
    this.onBridge = null;

    // Mundo gerado: chão, terreno, estradas, locais de contrato, povoados e o acampamento
    this.culler = new StaticCuller();
    const terrain = new TerrainMap(this.world.terrain, geoOf(this.world.geo));
    terrain.setBurned(store.burnedBridges);
    this.terrainStreamer = new TerrainStreamer(this, terrain, this.world);
    Unit.terrain = terrain;
    // Navegação: água funda e montanha bloqueiam; vau, lama e pântano custam; estrada é atalho
    const NAV_COST: Partial<Record<string, number>> = { SHALLOW: 3, MUD: 2, SWAMP: 2.5, FOREST: 1.4, HILL: 1.2 };
    const cost = (x: number, y: number) => {
      const t = terrain.typeAt(x, y);
      // Dentro da paliçada, barracas e estruturas não entram na grade (as rotas do acampamento
      // desviam delas por conta própria; a colisão vale para todos): só a paliçada e o portão
      if (t === "BUILDING" && this.campArea?.contains({ x, y }, 20)) return 1;
      return TERRAIN[t].blocked ? Infinity : (NAV_COST[t] ?? 1);
    };
    const nav = new NavGrid(WORLD_WIDTH, WORLD_HEIGHT, GEO.NAV_CELL, cost);
    // As tropas do bando não passam pelos portões dos povoados alheios: para elas, o povoado é muro
    const armyNav = new NavGrid(WORLD_WIDTH, WORLD_HEIGHT, GEO.NAV_CELL, (x, y) =>
      this.gateRules.some((r) => r.army && inRect(r.bounds, { x, y })) ? Infinity : cost(x, y),
    );
    for (const road of this.world.roads) {
      nav.markRoad(road, 0.7);
      armyNav.markRoad(road, 0.7);
    }
    this.nav = nav;
    this.armyNav = armyNav;
    Unit.nav = nav;
    Unit.armyNav = armyNav;
    Unit.closedTown = (access, x, y) => this.closedRule(access, { x, y }) !== null;
    this.buildBridgeSpots(store.burnedBridges);
    drawSites(this, this.world, this.culler);
    const geo = geoOf(this.world.geo);
    this.settlementLayer = new SettlementLayer(this, this.world, this.culler, (p) => geo.isOpenLand(p));
    this.settlementLayer.sync(store.settlements, store.calamities);
    // Muralhas e casas viram obstáculo (antes de a navegação avaliar qualquer célula)
    terrain.setTowns(this.settlementLayer.layouts);
    this.updateGateRules();
    this.campArea = new CampArea(this, this.world.camp, store.campPacked, store.campWorks);
    // Barracas, fogueira e paliçada bloqueiam todo mundo (não só o Comandante)
    this.campArea.onSolidsChanged = () => this.applyCampSolids();
    // Fosso (obra do acampamento): lama funda em volta da paliçada
    terrain.setDitch(!store.campPacked && store.campWorks.includes("DITCH") ? this.campArea.palisade : null);
    this.applyCampSolids();
    this.campLife = new CampLife(this, this.campArea, this.world.camp.origin);
    this.mapLife = new MapLife(this);
    this.campLife.setFollowers(store.campPacked ? [] : store.followers);
    // Chão da estação: lama na primavera e na chuva fora das estradas, neve no frio do inverno
    Unit.ground = (x, y, t) => this.groundAt(x, y, t);
    this.season = seasonOf(store.day);
    this.applySeason();
    this.lastCampStateAt = -Infinity;

    this.commander = new Commander(this, this.world.camp.spawn.x, this.world.camp.spawn.y);
    this.commander.setFacing(-Math.PI / 2);
    this.lastCommanderPos = { x: this.commander.x, y: this.commander.y };
    this.commandRing = this.add.graphics().setDepth(-3);
    this.drawCommandRing();

    // O bando começa descansando no acampamento: cada batalhão no seu alojamento
    store.battalions.forEach((data, i) => this.spawnBattalion(data, i, null));
    this.followKey = "";
    this.spawnRiders();
    this.campArea.buildQuarters(store, new Set());

    this.warbands = new WarbandManager(
      (x, y, kind, color) => this.spawnEnemy(x, y, kind, color),
      () => ({ settlements: useGameStore.getState().settlements, camp: this.campArea.packed ? null : this.world.camp.center }),
      // O centro de uma capital fica dentro da muralha interna: vale o ponto aberto mais perto
      (from, to) => this.nav.findPath(this.nav.nearestOpen(from, 1400) ?? from, this.nav.nearestOpen(to, 1400) ?? to, 200000),
      () => {
        const s = useGameStore.getState();
        return s.day + s.dayProgress;
      },
    );

    // Bandos marcham pelas mesmas regras de chão (lama, neve); inverno: os reinos recolhem os exércitos
    this.warbands.marchFactor = (p) => this.groundAt(p.x, p.y, "GRASS");
    this.warbands.setWinter(this.season === "WINTER");
    this.warbands.atWar = (a, b) => kingdomsAtWar(useGameStore.getState().wars, a, b);
    this.trade = new TradeRoutes(this, this.world, this.warbands, (id) => this.settlementLayer.layoutOf(id));
    this.syncWagons();

    const despawn = (e: Enemy) => {
      e.unitState = "DEAD";
      e.destroy();
    };
    this.garrisons = new GarrisonManager(
      (x, y, kind, color) => this.spawnEnemy(x, y, kind, color),
      despawn,
      (id, dead) => useGameStore.getState().garrisonLosses(id, dead),
      (id) => this.provokeTown(id),
    );
    this.wildlife = new WildlifeManager((x, y, kind) => this.spawnEnemy(x, y, kind), despawn);

    this.missionGfx = this.add.graphics().setDepth(14);
    this.fog = new FogOfWar(this, WORLD_WIDTH, WORLD_HEIGHT);
    // Lugares conhecidos desde o início: o acampamento e as cidades (destinos da viagem rápida)
    this.fog.revealExplored(this.world.camp.center, WORLD.KNOWN_RADIUS + 300);
    for (const t of store.settlements) this.fog.revealExplored(t, WORLD.KNOWN_RADIUS);
    this.ghostGfx = this.add.graphics().setDepth(16);
    this.night = new NightLayer(this);
    this.weatherLayer = new WeatherLayer(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this.commander, true, 0.1, 0.1);
    this.updateVision(0);

    this.setupInput();
    startCampfireAmbience();
    this.syncContract();
    this.syncCalamities();
    this.syncSiege();
    // Jogo carregado: o campo volta como estava (posições, névoa, bandos, inimigos feridos)
    this.restoreField(useGameStore.getState().consumePendingField());
    const capture = () => this.captureField();
    registerFieldCapture(capture);

    // Mudanças no exército (recrutas, reforços, deserções, motim, novos cavaleiros) chegam pelo store
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (
        s.battalions !== prev.battalions ||
        s.lieutenants !== prev.lieutenants ||
        s.scouts !== prev.scouts ||
        s.messengers !== prev.messengers ||
        s.pendingMutiny !== prev.pendingMutiny ||
        s.mutiny !== prev.mutiny
      ) {
        this.armyDirty = true;
      }
      if (s.activeContract !== prev.activeContract) this.syncContract();
      if (s.settlements !== prev.settlements || s.calamities !== prev.calamities) {
        if (this.settlementLayer.sync(s.settlements, s.calamities)) this.applyTowns();
        this.syncCalamities();
      }
      if (s.siege !== prev.siege) this.syncSiege();
      if (s.settlements !== prev.settlements || s.factions !== prev.factions || s.siege !== prev.siege) this.updateGateRules();
      if (s.burnedBridges !== prev.burnedBridges) this.applyBridges(s.burnedBridges, prev.burnedBridges);
      if (s.followers !== prev.followers && !this.campArea.packed) this.campLife.setFollowers(s.followers);
      if (s.wagons.length !== prev.wagons.length) this.syncWagons();
      // Caravana própria dispensada: sai da estrada
      if (s.ownCaravans !== prev.ownCaravans) this.trade.dropOwn(new Set(s.ownCaravans.filter((c) => !c.lost).map((c) => c.id)));
      // Obra nova: o acampamento é redesenhado com ela (paliçada, torres, fosso)
      if (s.campWorks.length > prev.campWorks.length) this.reloadWorld();
      if (s.worldMapOpen && !prev.worldMapOpen) this.lastSnapshotAt = -Infinity;
    });
    activeScene = this;
    const cleanup = () => {
      unsubscribe();
      unregisterFieldCapture(capture);
      this.terrainStreamer.destroy();
      this.campLife.destroy();
      this.mapLife.destroy();
      this.trade.destroy();
      if (Unit.terrain === terrain) Unit.terrain = null;
      if (Unit.nav === nav) Unit.nav = null;
      if (Unit.armyNav === armyNav) {
        Unit.armyNav = null;
        Unit.closedTown = null;
      }
      // Ao carregar um jogo, a cena antiga morre depois de a nova nascer: só a mais nova mexe no que é global
      if (activeScene !== this) return;
      activeScene = null;
      stopCampfireAmbience();
      useGameStore.getState().setCampPrompt(null);
      Unit.darkness = 0;
      Unit.weather = "CLEAR";
      Unit.ground = null;
      Unit.pace = 1;
      Enemy.perception = 1;
      Enemy.weatherSight = 1;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    // Volta de um interior (Marco 14)
    const wake = (_sys: unknown, data?: { after?: string | null; text?: string }) => this.onWake(data);
    this.events.on(Phaser.Scenes.Events.WAKE, wake);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, wake));

    this.publishHud();

    // Acesso para depuração/testes automatizados (somente em dev)
    if (import.meta.env.DEV) {
      const w = window as unknown as { __world?: WorldScene; __followerCap?: typeof followerCap; __weatherAt?: typeof weatherAt };
      w.__world = this;
      w.__followerCap = followerCap;
      w.__weatherAt = weatherAt;
    }
  }

  update(time: number, delta: number): void {
    const store = useGameStore.getState();
    const view = this.cameras.main.worldView;
    this.culler.update(this.cameras.main);
    this.terrainStreamer.update(this.cameras.main);
    this.updateNight(store.dayProgress);
    this.updateWeather(time);
    this.weatherLayer.update(this.cameras.main, this.weather, this.ended ? 0 : Math.min(delta, 50) / 1000);
    AudioEngine.setListener(view.centerX, view.centerY, view.width);
    AudioEngine.setLoopVolume("campfire", Math.max(0, 1 - distance({ x: view.centerX, y: view.centerY }, this.campArea.campfire) / 1100));

    // Pausa tática: mapa, relatório ou painel abertos (comandos da UI ainda valem, ex.: viajar)
    if (this.ended) {
      this.processUiCommands();
      if (store.worldMapOpen && time - this.lastSnapshotAt >= SNAPSHOT_MS) this.publishSnapshot(time);
      if (time - this.lastHudAt >= BALANCE.HUD_UPDATE_MS * 3) {
        this.lastHudAt = time;
        this.publishHud();
      }
      if (this.commander.isAlive) this.commander.unitState = "IDLE";
      this.walkPath = null;
      return;
    }

    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys;

    this.processUiCommands();
    if (this.armyDirty && !this.engagement) this.reconcileArmy();

    const prev = { x: this.commander.x, y: this.commander.y };
    const walking = this.commander.handleMovement(k, dt);
    if (walking) this.walkPath = null;
    else this.followWalkPath(dt);
    this.updateDoorPush(walking, dt);
    if (k.SPACE.isDown) this.commander.trySwing(this.activeEnemies(), time);
    this.updateFreeCamera(dt);

    const allies = this.allAllies();
    if (time - this.lastFogAt >= SUPPORT.FOG_UPDATE_MS) this.updateVision(time);
    else this.updateReveal(allies, time);
    this.updateHostility();
    const active = this.activeEnemies();
    // Só os hostis contam para alvos automáticos, moral e combate (patrulhas em paz, refugiados e mensageiros não)
    const hostiles = active.filter((e) => e.hostile);
    const visibleEnemies = hostiles.filter((e) => e.revealed);

    // Lados do mundo: povoado (guarnições, patrulhas, exércitos) × selvagens (goblins, hordas);
    // a guarnição do bando ainda enfrenta quem for hostil ao bando
    const wild: Enemy[] = [];
    const town: Enemy[] = [];
    const friendly: Enemy[] = [];
    for (const e of active) {
      if (e.side === "WILD") wild.push(e);
      else if (e.side === "TOWN") town.push(e);
      if (e.friendly) friendly.push(e);
    }
    const foesOfFriendly = active.filter((e) => e.side === "WILD" || (e.hostile && !e.friendly));
    const wildAndFriendly = [...wild, ...friendly];
    for (const e of active) {
      const rivals = e.friendly ? foesOfFriendly : e.side === "WILD" ? town : e.side === "TOWN" ? (e.hostile ? wildAndFriendly : wild) : e.hostile ? friendly : [];
      e.think(dt, allies, rivals);
    }
    this.handleWarbandEvents(this.warbands.update(dt));
    this.tradeNews(this.trade.update(dt, view, this.presence()));
    this.assignFollowSlots();
    // Marcha forçada: o passo apertado só vale fora de combate
    Unit.pace = this.forced && !this.engagement && !this.inCamp ? FATIGUE.FORCED_SPEED : 1;
    for (const b of this.battalions) b.update(dt, visibleEnemies);
    Wagon.load = this.loadPace();
    this.updateWagons(dt);
    for (const s of this.scouts) s.think(dt, this.commander, active);
    this.updateMessengers(dt);

    const everyone: Unit[] = [...allies, ...active];
    resolveAttacks(this, everyone, time);
    const faltering = this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP;
    for (const b of this.battalions) {
      const seen = !b.isDestroyed && this.seesBanner(b.center);
      updateMorale(b, hostiles, this.commander, dt, time, { seen, faltering });
    }

    separateUnits(everyone);
    clampToWorld(everyone);
    if (this.commander.isAlive) this.campArea.collide(this.commander, prev);
    this.commandRing.setPosition(this.commander.x, this.commander.y);

    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.collectSupportLosses();
    this.collectWagonLosses();
    this.updateFatigue(dt);
    this.checkThinIce(time);
    this.drawMissions();

    if (!this.commander.isAlive) {
      this.defeat();
      return;
    }
    this.updateCampPresence();
    this.updateGuards();
    this.noteVisit(time);
    this.updateTownVisit();
    this.updateGarrisons(time);
    this.updateGarrisonUnits();
    this.wildlife.update(time, this.wildlifeContext());
    this.updateCampLife(time, dt);
    this.updateMapLife(time, dt);
    this.updateBridgeCrossing();
    this.updatePrompt();
    this.checkObjectives();
    this.updateEngagement(time, active);
    this.tickClock(time, dt);

    if (time - this.lastHudAt >= BALANCE.HUD_UPDATE_MS) {
      this.lastHudAt = time;
      this.publishHud();
    }
  }

  // --- Exército em campo (criado a partir do store) ---

  private spawnBattalion(data: BattalionData, index: number, at: Point | null): Battalion {
    const store = useGameStore.getState();
    const lieutenant = store.lieutenants.find((l) => l.battalionId === data.id) ?? null;
    const slot = this.campArea.quarterSlot(index);
    const spawn = this.world.camp.spawn;
    const pos = at ?? slot ?? { x: spawn.x - 120, y: spawn.y + 80 * index };
    const b = new Battalion(this, data, pos.x, pos.y, this.commander, lieutenant);
    // Fome, salários atrasados e o humor do acampamento: os batalhões já saem animados ou desanimados
    b.morale = startingMorale(store.hungryDays, store.arrearsWeeks, campMoraleBonus(store.campMood, store.followers)).value;
    b.fatigue = this.fatigueById.get(data.id) ?? 0;
    if (!at && slot) this.quarter(b, index, slot);
    this.fieldSignatures.set(b, this.battalionSignature(data, lieutenant?.id ?? null));
    this.battalions.push(b);
    return b;
  }

  private spawnRiders(): void {
    const store = useGameStore.getState();
    const spawn = this.world.camp.spawn;
    const base = this.inCamp ? { x: spawn.x + 220, y: spawn.y - 40 } : { x: this.commander.x, y: this.commander.y };
    this.scouts = store.scouts.map((data, i) => new Scout(this, base.x + 60, base.y - 40 + i * 40, data));
    this.messengers = store.messengers.map((data, i) => new Messenger(this, base.x - 30 + i * 20, base.y + 40, data, i));
  }

  private battalionSignature(data: BattalionData, lieutenantId: string | null): string {
    return [data.troopType, data.level, data.skills.join(","), data.equipment.weapon, data.equipment.armor, data.soldiers, lieutenantId].join("|");
  }

  /** Assinatura de cada batalhão em campo (o que estava nos dados quando ele foi criado). */
  private fieldSignatures = new WeakMap<Battalion, string>();

  /**
   * Recria em campo o que mudou no store: batalhões recrutados, reforçados, que subiram de
   * nível, trocaram de tenente, desertaram ou se amotinaram; batedores e mensageiros novos.
   * Só fora de combate. Quem não mudou continua onde está, com a ordem que tinha.
   */
  private reconcileArmy(): void {
    this.armyDirty = false;
    const store = useGameStore.getState();
    this.syncMutiny(store);

    const kept: Battalion[] = [];
    const old = this.battalions;
    for (const b of old) {
      const data = store.battalions.find((d) => d.id === b.id);
      const lieutenantId = store.lieutenants.find((l) => l.battalionId === b.id)?.id ?? null;
      if (data && this.fieldSignatures.get(b) === this.battalionSignature(data, lieutenantId) && b.aliveCount === data.soldiers) {
        kept.push(b);
      }
    }
    const rebuilt = old.filter((b) => !kept.includes(b));
    const centers = new Map(rebuilt.filter((b) => b.soldiers.length > 0).map((b) => [b.id, b.center]));
    // Quem descansava no acampamento (ex.: acabou de treinar) volta ao alojamento, não ao Comandante
    const wasQuartered = new Set(rebuilt.filter((b) => this.quartered.has(b.id)).map((b) => b.id));
    for (const b of rebuilt) {
      this.campLife.release(b);
      b.destroy();
      this.quartered.delete(b.id);
    }
    this.battalions = kept;
    store.battalions.forEach((data, i) => {
      if (kept.some((b) => b.id === data.id)) return;
      // Recriado onde estava (ou no alojamento, se o Comandante está no acampamento)
      const was = centers.get(data.id);
      const at = was && !this.inCamp && !wasQuartered.has(data.id) ? was : null;
      const b = this.spawnBattalion(data, i, at);
      if (at) b.orderFollow(this.commander);
    });
    const order = (id: string) => store.battalions.findIndex((d) => d.id === id);
    this.battalions.sort((a, b) => order(a.id) - order(b.id));
    this.followKey = "";

    // Batedores e mensageiros: recriados se a lista ou o nível mudou (e ninguém está em missão)
    const riderKey = [...store.scouts.map((r) => r.id), ...store.messengers.map((r) => `${r.id}:${r.level}`)].join("|");
    const fieldKey = [
      ...this.scouts.filter((s) => s.isAlive).map((s) => s.rider.id),
      ...this.messengers.filter((m) => m.isAlive).map((m) => `${m.rider.id}:${m.rider.level}`),
    ].join("|");
    if (riderKey !== fieldKey && this.messengers.every((m) => !m.isAlive || m.available)) {
      for (const r of [...this.scouts, ...this.messengers]) r.destroy();
      this.spawnRiders();
    } else if (riderKey !== fieldKey) {
      this.armyDirty = true; // tenta de novo quando os mensageiros voltarem
    }

    this.campArea.buildQuarters(store, this.awayBattalions());
  }

  private awayBattalions(): Set<string> {
    return new Set(this.battalions.filter((b) => !this.quartered.has(b.id)).map((b) => b.id));
  }

  /** Motim: o batalhão rebelado vira inimigo ali mesmo, onde está. */
  private syncMutiny(store: GameState): void {
    if (!store.mutiny || this.mutineers.length > 0) return;
    const rebel = this.battalions.find((b) => b.id === store.mutiny?.rebel.id);
    const at = rebel && rebel.soldiers.length > 0 ? rebel.center : (this.campArea.quarterSlot(store.battalions.length) ?? this.world.camp.center);
    this.mutineers = this.spawnEnemyGroup({ x: at.x, y: at.y, units: store.mutiny.units }, { kind: "MUTINY" });
    this.pushFeed(`Motim! ${store.mutiny.rebel.name} pegou em armas no acampamento.`);
  }

  /** Contrato aceito: os inimigos aparecem no local marcado; abandonado ou vencido o prazo, eles somem. */
  private syncContract(): void {
    const active = useGameStore.getState().activeContract;
    if ((active?.contract.id ?? null) === this.contractId) return;
    for (const e of this.contractEnemies) {
      if (!e.isAlive) continue;
      // Quem está à vista não some do nada: fica como inimigo sem dono
      if (e.revealed) e.owner = null;
      else {
        e.unitState = "DEAD";
        e.destroy();
      }
    }
    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.contractEnemies = [];
    const was = this.contractId;
    this.contractId = active?.contract.id ?? null;
    // Escolta abandonada ou vencida: a caravana da guilda desiste, e os salteadores largam a tocaia
    if (was && !active) {
      this.trade.dropEscort();
      for (const b of this.warbands.bands) if (b.rest > 1e8) b.rest = 0;
    }
    if (!active) return;

    const { contract } = active;
    if (contract.kind && contract.kind !== "SITE") {
      this.syncTradeContract(contract);
      return;
    }
    const site = this.world.sites.find((x) => x.id === contract.siteId);
    if (!site) return;
    for (const group of scaleGroups(site.groups, DIFFICULTY[contract.difficulty].enemyMultiplier)) {
      this.contractEnemies.push(...this.spawnEnemyGroup(group, { kind: "CONTRACT", contractId: contract.id }));
    }
    // O cliente indicou o lugar: ele fica conhecido no mapa (destino da viagem rápida)
    this.fog?.revealExplored(site.center, 700);
    this.pushFeed(`Contrato: "${contract.title}" — o local (${site.name}) está marcado no Mapa do Continente.`);
  }

  /**
   * Contratos da economia (Marco 14): a caravana a escoltar espera no portão (e salteadores
   * esperam no meio da estrada); o bando goblin com a carga roubada e as caravanas do reino a
   * sabotar aparecem no Mapa do Continente.
   */
  private syncTradeContract(contract: Contract): void {
    const s = useGameStore.getState();
    const day = s.day;
    const name = (id?: string) => s.settlements.find((t) => t.id === id)?.name ?? "?";
    if (contract.kind === "ESCORT" && contract.fromId && contract.targetId) {
      const band = this.trade.spawnEscort(contract.fromId, contract.targetId);
      if (!band) return;
      band.spotted = true;
      band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      this.fog?.revealExplored(band.anchor, 700);
      // Salteadores esperam a caravana no meio do caminho
      const mid = band.route[Math.floor(band.route.length * 0.55)];
      if (mid) {
        const n = 4 + contract.difficulty * 2;
        const ambush = this.warbands.spawnBand({
          name: `Salteadores da estrada de ${name(contract.targetId)}`,
          kind: "GOBLIN",
          units: [
            ["BANDIT", Math.ceil(n * 0.65)],
            ["BANDIT_ARCHER", Math.floor(n * 0.35)],
          ],
          origin: { x: mid.x + 500, y: mid.y + 300 },
          ownerId: null,
        });
        // Esperam escondidos até a caravana passar perto (aí caçam a carga)
        ambush.route = [];
        ambush.goal = { kind: "WANDER" };
        ambush.goalPoint = { ...ambush.anchor };
        ambush.rest = 1e9;
      }
      this.pushFeed(`Contrato: a caravana espera o bando no portão de ${name(contract.fromId)} (marcada no Mapa do Continente).`);
      return;
    }
    if (contract.kind === "ROUTE" && contract.fromId && contract.targetId) {
      // Salteadores no meio da estrada: o id deles fica no contrato (vai no save)
      const road = roadGraphOf(this.world).route(contract.fromId, contract.targetId);
      const mid = road?.points[Math.floor(road.points.length * 0.5)];
      if (!mid) return;
      const n = 6 + contract.difficulty * 2;
      const band = this.warbands.spawnBand({
        name: `Salteadores da estrada de ${name(contract.targetId)}`,
        kind: "GOBLIN",
        units: [
          ["BANDIT", Math.ceil(n * 0.65)],
          ["BANDIT_ARCHER", Math.floor(n * 0.35)],
        ],
        origin: { x: mid.x, y: mid.y },
        ownerId: null,
      });
      band.route = [];
      band.goal = { kind: "WANDER" };
      band.goalPoint = { ...band.anchor };
      band.rest = 1e9;
      band.spotted = true;
      band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      this.fog?.revealExplored(band.anchor, 500);
      useGameStore.setState((st) => (st.activeContract ? { activeContract: { ...st.activeContract, contract: { ...st.activeContract.contract, bandId: band.id } } } : {}));
      this.pushFeed(`Contrato: ${band.name} — marcados no Mapa do Continente.`);
      return;
    }
    if (contract.kind === "RECOVER" && contract.bandId) {
      const band = this.warbands.bands.find((b) => b.id === contract.bandId);
      if (band) {
        band.spotted = true;
        band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
        this.pushFeed(`Contrato: o ${band.name} foi visto pela última vez perto de ${this.placeName(band.anchor)} (Mapa do Continente).`);
      } else {
        this.pushFeed("Contrato: ninguém sabe onde o bando com a carga está. Procurem nos ermos.");
      }
      return;
    }
    if (contract.kind === "SABOTAGE" && contract.factionTarget) {
      for (const b of this.warbands.bands) {
        if (b.kind !== "CARAVAN" || b.ownerId !== contract.factionTarget) continue;
        b.spotted = true;
        b.lastSeen = { x: b.anchor.x, y: b.anchor.y, day };
      }
      this.pushFeed(`Contrato: os espiões do cliente marcaram as caravanas inimigas na estrada (Mapa do Continente).`);
      return;
    }
    // Marco 15: quem o bando precisa enfrentar aparece no Mapa do Continente
    if ((contract.kind === "RELIEF" || contract.kind === "CIVIL") && contract.armyId) {
      const army = s.armies.find((a) => a.id === contract.armyId);
      const band = this.warbands.bands.find((b) => b.id === army?.bandId);
      if (band) {
        band.spotted = true;
        band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      }
      this.pushFeed(`Contrato: ${band?.name ?? "o exército inimigo"} está marcado no Mapa do Continente.`);
      return;
    }
    if (contract.kind === "BURN" && contract.crossingId) {
      const c = this.world.geo.crossings.find((x) => x.id === contract.crossingId);
      if (c) this.fog?.revealExplored(c, 700);
      this.pushFeed(`Contrato: a ponte a queimar fica em ${c ? this.placeName(c) : "lugar incerto"} (revelada no Mapa do Continente).`);
      return;
    }
    if (contract.kind === "RANSOM") {
      this.pushFeed(`Contrato: o preso está na masmorra de ${name(contract.targetId)}. Fale com o Camareiro-mor na Cidade Alta, ou vá pelos esgotos.`);
      return;
    }
    if (contract.kind === "DELIVERY") {
      this.pushFeed(`Contrato: levem ${contract.qty} de ${contract.good ? GOODS[contract.good].label.toLowerCase() : "mercadoria"} a ${name(contract.targetId)} — falem com o mercado de lá.`);
    }
  }

  // --- Acampamento, cidades e caminhada ---

  /** Entrar na paliçada: as tropas que seguiam vão descansar nos alojamentos; sair: voltam a seguir. */
  private updateCampPresence(): void {
    const inside = this.campArea.contains(this.commander);
    if (inside === this.inCamp) {
      // Batalhão recriado (ou que voltou a seguir) já dentro da paliçada: vai para o alojamento
      if (inside) this.quarterStragglers();
      return;
    }
    this.inCamp = inside;
    const store = useGameStore.getState();
    if (inside) {
      store.battalions.forEach((data, i) => {
        const b = this.battalions.find((x) => x.id === data.id);
        const slot = this.campArea.quarterSlot(i);
        if (!b || !slot || b.isDestroyed || !b.isFollowing) return;
        this.quarter(b, i, slot);
      });
      // As carroças descarregam no depósito e vão para o conserto
      this.storeWagonHp();
      store.unloadWagons();
      for (const w of this.wagons) w.restoreHp(w.maxHp);
      this.pushFeed("De volta ao acampamento: as tropas descansam nos alojamentos e as carroças descarregam.");
      this.autosave();
      // Às vezes o acampamento tem algo para o Comandante resolver
      store.campTick("ENTER");
    } else {
      const training = new Set(store.training.map((t) => t.battalionId));
      // Marco 14: quem o Comandante escolheu deixar fica de guarda no acampamento
      const guard = new Set(store.campStay.filter((id) => store.battalions.some((b) => b.id === id)));
      const stay = new Set([...training, ...guard]);
      for (const b of this.battalions) {
        if (!this.quartered.has(b.id) || b.isDestroyed || stay.has(b.id)) continue;
        this.unquarter(b);
        b.orderFollow(this.commander);
      }
      for (const id of [...this.quartered]) if (!stay.has(id)) this.quartered.delete(id);
      // As carroças carregam o que cabe (deixando a reserva de quem fica)
      const before = useGameStore.getState().cargo;
      store.loadWagons();
      const loaded = useGameStore.getState().cargo - before;
      const marching = store.battalions.filter((b) => !stay.has(b.id));
      const names = (ids: ReadonlySet<string>) => store.battalions.filter((b) => ids.has(b.id)).map((b) => b.name).join(", ");
      this.pushFeed(
        marching.length === 0
          ? "O Comandante saiu sozinho: os batalhões ficam guardando o acampamento (e as carroças com eles)."
          : `O bando deixou o acampamento${guard.size > 0 ? ` (ficam de guarda: ${names(guard)})` : ""}${training.size > 0 ? " — quem está no Campo de Treino fica" : ""}.${
              loaded > 0 ? ` As carroças levam ${useGameStore.getState().cargo} rações.` : ""
            }`,
      );
    }
    this.campArea.buildQuarters(store, this.awayBattalions());
  }

  /** Passado o combate, quem ficou parado ou seguindo dentro da paliçada (ex.: se recompôs do pânico) vai descansar. */
  private quarterStragglers(): void {
    if (this.engagement) return;
    const store = useGameStore.getState();
    let changed = false;
    store.battalions.forEach((data, i) => {
      const b = this.battalions.find((x) => x.id === data.id);
      const slot = this.campArea.quarterSlot(i);
      if (!b || !slot || b.isDestroyed || b.panicking || this.quartered.has(b.id) || !this.campArea.contains(b.center)) return;
      if (b.order.type !== "FOLLOW" && b.order.type !== "HOLD") return;
      this.quarter(b, i, slot);
      changed = true;
    });
    if (changed) this.campArea.buildQuarters(store, this.awayBattalions());
  }

  /**
   * Guardas do acampamento chamados por uma ordem (mensageiro, trombeta, voz): largam o
   * alojamento e saem para encontrar o Comandante (Marco 14).
   */
  private updateGuards(): void {
    if (this.inCamp || this.quartered.size === 0) return;
    const store = useGameStore.getState();
    const training = new Set(store.training.map((t) => t.battalionId));
    for (const b of this.battalions) {
      if (!this.quartered.has(b.id) || training.has(b.id) || b.isDestroyed || b.order.type === "HOLD") continue;
      this.unquarter(b);
      this.quartered.delete(b.id);
      store.setCampStay(store.campStay.filter((id) => id !== b.id));
      this.pushFeed(`${b.name} deixou o acampamento atendendo à ordem do Comandante.`);
      this.campArea.buildQuarters(useGameStore.getState(), this.awayBattalions());
    }
  }

  private spots(): Interactable[] {
    return [...this.campArea.interactables, ...this.settlementLayer.interactables, ...this.bridgeSpots, ...this.followerSpots(), ...this.houseSpots(), ...this.armySpots()];
  }

  /** Exércitos à vista, em paz com o bando: dá para ir à tenda do lorde (Marco 15). */
  private armySpots(): Interactable[] {
    const s = useGameStore.getState();
    const out: Interactable[] = [];
    for (const b of this.warbands.bands) {
      if (!b.armyId || !b.materialized || this.bandHostile(b)) continue;
      const lordId = s.armies.find((a) => a.id === b.armyId)?.lordId;
      const lord = lordId ? s.nobles.find((n) => n.id === lordId && n.alive) : undefined;
      if (!lord) continue;
      const realm = this.world.factions.find((f) => f.id === lord.factionId)?.name ?? "reino";
      const c = b.anchor;
      out.push({ label: `Tenda de ${nobleName(lord, realm)}`, door: { x: c.x, y: c.y }, panel: { kind: "GAME" }, bounds: new Phaser.Geom.Rectangle(c.x - 60, c.y - 60, 120, 120), radius: 170, enter: `field:${lord.id}` });
    }
    return out;
  }

  /** Banca do mascate (quando ele segue o bando). */
  private followerSpots(): Interactable[] {
    const stall = this.campArea.packed ? null : this.campLife.peddlerStall();
    if (!stall) return [];
    return [{ label: "Banca do mascate", door: { x: stall.x, y: stall.y + 36 }, panel: { kind: "PEDDLER" }, bounds: new Phaser.Geom.Rectangle(stall.x - 40, stall.y - 20, 80, 50), radius: 70, enter: "camp:PEDDLER" }];
  }

  private updatePrompt(): void {
    this.nearestSpot = this.campArea.nearestInteractable(this.commander, [...this.settlementLayer.interactables, ...this.bridgeSpots, ...this.followerSpots(), ...this.houseSpots(), ...this.armySpots()]);
    const store = useGameStore.getState();
    store.setCampPrompt(this.nearestSpot && !store.campPanel ? `E — ${this.nearestSpot.enter ? "Entrar: " : ""}${this.nearestSpot.label}` : null);
  }

  /** Casas dos moradores do povoado onde o Comandante está (Marco 14): todas têm porta. */
  private houseCache: { townId: string; spots: Interactable[] } | null = null;
  private houseSpots(): Interactable[] {
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => {
      const l = this.settlementLayer.layoutOf(x.id);
      return l && x.owner !== "RUINED" && insideTown(l, this.commander);
    });
    if (!t) return [];
    if (this.houseCache?.townId === t.id) return this.houseCache.spots;
    const layout = this.settlementLayer.layoutOf(t.id);
    if (!layout) return [];
    const special = specialHouses(layout);
    const spots: Interactable[] = layout.houses
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => i !== special.tavern && i !== special.guild)
      .map(({ h, i }) => ({
        label: "Casa de moradores",
        door: h.door,
        panel: { kind: "TOWN", settlementId: t.id, at: "MARKET" } as const,
        bounds: new Phaser.Geom.Rectangle(h.rect.x, h.rect.y, h.rect.w, h.rect.h),
        radius: 40,
        enter: `town:${t.id}:house:${i}`,
      }));
    this.houseCache = { townId: t.id, spots };
    return spots;
  }

  /** Dentro de um povoado, o Comandante vê os preços da praça: anota no Livro (uma vez por dia). */
  private lastVisitNoteAt = -Infinity;
  private noteVisit(time: number): void {
    if (time - this.lastVisitNoteAt < 2000) return;
    this.lastVisitNoteAt = time;
    const s = useGameStore.getState();
    const t = s.settlements.find((x) => {
      const l = this.settlementLayer.layoutOf(x.id);
      return l && x.owner !== "RUINED" && insideTown(l, this.commander);
    });
    if (!t) return;
    const book = s.priceBook[t.id];
    if (book && book[book.length - 1].day >= s.day) return;
    s.notePrices(t.id, "VISIT");
  }

  /** Como num mapa de Pokémon: andar de encontro à porta de um prédio é entrar nele. */
  private doorPush = 0;
  private updateDoorPush(walking: boolean, dt: number): void {
    const spot = this.nearestSpot;
    const c = this.commander;
    if (!walking || !spot?.enter || distance(c, spot.door) > 46) {
      this.doorPush = 0;
      return;
    }
    const to = { x: spot.bounds.centerX - spot.door.x, y: spot.bounds.centerY - spot.door.y };
    const heading = (Math.cos(c.facing) * to.x + Math.sin(c.facing) * to.y) / (Math.hypot(to.x, to.y) || 1);
    this.doorPush = heading >= 0.7 ? this.doorPush + dt : 0;
    if (this.doorPush >= 0.18) {
      this.doorPush = 0;
      this.enterBuilding(spot);
    }
  }

  /** Lugar de onde o Comandante entrou num prédio (volta para lá ao sair). */
  private interiorReturn: { x: number; y: number; facing: number } | null = null;

  /**
   * Entra numa estrutura (Marco 14): o mundo escurece e dorme (o tempo para) e a cena do
   * interior assume. Com inimigos por perto, não dá.
   */
  private enterBuilding(spot: Interactable): void {
    if (!spot.enter || this.interiorReturn) return;
    const store = useGameStore.getState();
    if (this.engagement || this.enemies.some((e) => e.isAlive && e.hostile && distance(e, this.commander) < 900)) {
      this.pushFeed("Inimigos por perto: não é hora de entrar em lugar nenhum.");
      return;
    }
    // Marco 15: o portão da muralha interna leva à Cidade Alta, que é outro mapa
    const capital = spot.enter.startsWith("capital:") ? spot.enter.slice(8) : null;
    if (capital && !this.cityGate(capital)) return;
    store.setCampPanel(null);
    this.walkPath = null;
    // Volta de costas para o prédio
    this.interiorReturn = { x: spot.door.x, y: spot.door.y, facing: Math.atan2(spot.door.y - spot.bounds.centerY, spot.door.x - spot.bounds.centerX) };
    const cam = this.cameras.main;
    cam.fadeOut(160, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (capital) this.scene.launch("CapitalScene", { townId: capital });
      else this.scene.launch("InteriorScene", { key: spot.enter, title: spot.label });
      this.scene.sleep();
    });
  }

  /**
   * Portão da muralha interna: em guerra ou com mandado, só de disfarce; quem ninguém conhece
   * paga a portagem. Os guardas falam pelo HUD (o resto dos portões fica lá dentro).
   */
  private cityGate(townId: string): boolean {
    const store = useGameStore.getState();
    const t = store.settlements.find((x) => x.id === townId);
    if (!t) return false;
    const check = store.access("CITY", townId);
    const disguised = store.disguiseUntil > store.day + store.dayProgress;
    if (!check.open && !disguised) {
      this.pushFeed(`Guardas de ${t.name}: "${check.why}"`);
      return false;
    }
    if (check.open && store.fame < 15 && !isFactionFriend(store, t.owner)) {
      const paid = store.passGate(townId, "CITY", "TOLL");
      this.pushFeed(`Portão da Cidade Alta: ${paid.text}`);
      return paid.ok;
    }
    return true;
  }

  /** Tempo corrido na Cidade Alta: o mundo dorme na tela, mas não para (Marco 15). */
  advanceAbroad(days: number): void {
    this.handleWarbandEvents(this.warbands.advance(days));
    this.tradeNews(this.trade.advance(days));
    this.passTime(days);
  }

  /** O Comandante caminha pela Cidade Alta sem levantar a tropa: ela espera na muralha. */
  get commanderPosition(): Point {
    return { x: this.commander.x, y: this.commander.y };
  }

  /** Saiu do prédio: o Comandante aparece diante da porta, de costas para ela. */
  private onWake(data?: { after?: string | null; text?: string }): void {
    const r = this.interiorReturn;
    this.interiorReturn = null;
    // Quem entrou segurando uma tecla soltou lá dentro: aqui ela ficaria "apertada" para sempre
    this.input.keyboard?.resetKeys();
    this.doorPush = 0;
    const cam = this.cameras.main;
    cam.fadeIn(200, 0, 0, 0);
    if (r) {
      this.commander.x = r.x;
      this.commander.y = r.y;
      this.commander.setFacing(r.facing);
      this.lastCommanderPos = { x: r.x, y: r.y };
    }
    this.houseCache = null;
    this.lastHudAt = 0;
    if (data?.after === "rest") this.restUntilDawn();
    // Duelo pedido no paço de um lorde (Marco 15): a Liça improvisada no pátio
    if (data?.after === "duel") {
      this.scene.launch("DuelScene");
      this.scene.sleep();
    }
    if (data?.after === "duelover" && data.text) this.pushFeed(data.text);
  }

  private walkTo(spot: Interactable | null, point: Point): void {
    const goal = spot ? spot.door : point;
    const shut = this.closedRule("VISITOR", goal);
    if (shut && !this.closedRule("VISITOR", this.commander)) {
      this.pushFeed(`Os portões de ${shut.name} estão fechados para o bando.`);
      return;
    }
    const path = this.campArea.contains(this.commander) && this.campArea.contains(goal) ? this.campArea.findPath(this.commander, goal, this.commander.radius) : [goal];
    this.walkPath = { path, open: spot?.panel, enter: spot?.enter ? spot : undefined };
  }

  private followWalkPath(dt: number): void {
    const w = this.walkPath;
    if (!w || !this.commander.isAlive) return;
    if (this.commander.moveTowards(w.path[0].x, w.path[0].y, dt)) {
      w.path.shift();
      if (w.path.length === 0) {
        this.walkPath = null;
        if (w.enter) this.enterBuilding(w.enter);
        else if (w.open) useGameStore.getState().setCampPanel(w.open);
      }
    } else {
      this.commander.unitState = "MOVING";
    }
  }

  private allAllies(): Unit[] {
    const allies: Unit[] = [];
    if (this.commander.isAlive) allies.push(this.commander);
    for (const b of this.battalions) for (const s of b.soldiers) if (s.isAlive) allies.push(s);
    for (const s of this.scouts) if (s.isAlive) allies.push(s);
    for (const m of this.messengers) if (m.isAlive) allies.push(m);
    for (const w of this.wagons) if (w.isAlive) allies.push(w);
    return allies;
  }

  // --- Trem de carroças (Marco 13) ---

  /** Carroças em campo = as do store (compradas, perdidas). Novas saem do acampamento (ou do Comandante). */
  private syncWagons(): void {
    const store = useGameStore.getState();
    for (const w of this.wagons) {
      if (store.wagons.some((d) => d.id === w.wagonId) && w.isAlive) continue;
      if (w.isAlive) w.destroy();
    }
    this.wagons = this.wagons.filter((w) => w.active && w.isAlive && store.wagons.some((d) => d.id === w.wagonId));
    store.wagons.forEach((d, i) => {
      if (this.wagons.some((w) => w.wagonId === d.id)) return;
      const at = this.inCamp && !this.campArea.packed ? this.campArea.wagonPark(i) : this.wagonSlot(i);
      this.wagons.push(new Wagon(this, at.x, at.y, d.id, d.hp));
    });
  }

  /** Lugar da carroça `i` na coluna: atrás do exército (ou estacionada no acampamento). */
  private wagonSlot(i: number): Point {
    if (this.inCamp && !this.campArea.packed) return this.campArea.wagonPark(i);
    const c = this.commander;
    // Comandante dentro de um povoado que barra o exército: as carroças esperam com a tropa no portão
    const hold = this.visit?.hold;
    const following = this.battalions.filter((b) => !b.isDestroyed && b.isFollowing).length;
    // Tropa parada em outro lugar (o Comandante saiu sozinho): as carroças ficam com ela
    const troops = this.battalions.filter((b) => !b.isDestroyed && !this.quartered.has(b.id));
    // Ninguém marchou (a tropa toda ficou nos alojamentos): as carroças também ficam
    if (troops.length === 0 && this.battalions.length > 0 && !this.campArea.packed) return this.campArea.wagonPark(i);
    const stay =!hold && following === 0 && troops.length > 0 ? centroid(troops.map((b) => b.center)) : null;
    const base = hold ? hold.point : (stay ?? { x: c.x, y: c.y });
    const facing = hold ? hold.facing : c.facing;
    const back = BALANCE.FOLLOW_DISTANCE + Math.ceil(following / 2) * 110 + 90 + Math.floor(i / 2) * 70;
    const lateral = (i % 2 === 0 ? -1 : 1) * 36;
    return {
      x: base.x - Math.cos(facing) * back - Math.sin(facing) * lateral,
      y: base.y - Math.sin(facing) * back + Math.cos(facing) * lateral,
    };
  }

  private updateWagons(dt: number): void {
    const parked = this.inCamp && !this.campArea.packed;
    this.wagons.forEach((w, i) => {
      if (!w.isAlive) return;
      const slot = this.wagonSlot(i);
      // Ficaram muito para trás (viagem, cais da balsa): alcançam a coluna
      if (parked || distance(w, slot) > 2600) {
        if (distance(w, slot) > 40) {
          w.x = slot.x;
          w.y = slot.y;
        }
        w.unitState = "IDLE";
        return;
      }
      w.follow(slot, dt);
    });
  }

  /** Carroça destruída: a carga dela se perde (e vira notícia). */
  private collectWagonLosses(): void {
    const dead = this.wagons.filter((w) => !w.isAlive);
    if (dead.length === 0) return;
    this.wagons = this.wagons.filter((w) => w.isAlive);
    const store = useGameStore.getState();
    for (const w of dead) {
      const by = w.lastHitFrom instanceof Enemy ? (w.lastHitFrom.side === "WILD" ? "Os saqueadores" : "O inimigo") : "O inimigo";
      store.loseWagon(w.wagonId, by);
      this.engagement?.notes.push(`${by} destruiu uma carroça: a comida que ela levava se perdeu.`);
      this.pushFeed(`Uma carroça foi destruída! As rações que ela levava se perderam.`);
    }
  }

  /** Vida das carroças no store (antes de salvar, ao fim de um combate). */
  private storeWagonHp(): void {
    const hp: Record<string, number> = {};
    for (const w of this.wagons) if (w.isAlive) hp[w.wagonId] = w.hp;
    useGameStore.getState().setWagonHp(hp);
  }

  // --- Fadiga (Marco 13) ---

  /**
   * Fadiga de cada batalhão: marchar cansa (à noite, em terreno ruim, na neve e na marcha
   * forçada, mais); lutar cansa; parado, recupera (nos alojamentos, depressa).
   */
  private updateFatigue(dt: number): void {
    const F = FATIGUE;
    const night = 1 + Unit.darkness * (F.NIGHT - 1);
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const c = b.center;
      const prev = this.fatiguePos.get(b.id) ?? c;
      this.fatiguePos.set(b.id, c);
      const moved = Math.min(distance(prev, c), 80);
      let f = b.fatigue;
      if (this.quartered.has(b.id)) f -= F.CAMP_PER_SEC * dt;
      else if (b.soldiers.some((s) => s.target)) f += F.COMBAT_PER_SEC * dt;
      else if (moved > 0.4) {
        const t = Unit.terrain?.typeAt(c.x, c.y) ?? "GRASS";
        const rough = t === "MUD" || t === "SWAMP" || t === "FOREST" || t === "SHALLOW" || t === "ICE" || this.groundAt(c.x, c.y, t) < 0.85;
        f += (moved / WORLD.DAY_DISTANCE) * F.MARCH_PER_DAY * night * (rough ? F.ROUGH : 1) * (this.forced ? F.FORCED : 1);
      } else if (!this.engagement) f -= (F.REST_PER_DAY * dt) / WORLD.DAY_SECONDS;
      b.fatigue = Math.max(0, Math.min(100, f));
      this.fatigueById.set(b.id, b.fatigue);
    }
  }

  /** Dias de marcha cansam todos os batalhões que marcharam (viagem rápida). */
  private tireBy(days: number): void {
    const add = days * FATIGUE.MARCH_PER_DAY * (this.forced ? FATIGUE.FORCED : 1);
    for (const b of this.battalions) {
      if (b.isDestroyed || this.quartered.has(b.id)) continue;
      b.fatigue = Math.min(100, b.fatigue + add);
      this.fatigueById.set(b.id, b.fatigue);
    }
  }

  private restBy(amount: number): void {
    for (const b of this.battalions) {
      b.fatigue = Math.max(0, b.fatigue - amount);
      this.fatigueById.set(b.id, b.fatigue);
    }
  }

  // --- Estações e clima (Marco 13) ---

  /**
   * Chão da estação num ponto: lama da primavera e da chuva fora das estradas, neve no frio do
   * inverno (na estrada pesa menos). Ruas, o acampamento e pontes são firmes.
   */
  private groundAt(x: number, y: number, t: TerrainType): number {
    if (t === "BRIDGE" || t === "WALL" || t === "BUILDING") return 1;
    const terrain = Unit.terrain;
    if (!terrain) return 1;
    const snow = terrain.season.snowBelow;
    const wet = this.weather === "RAIN" || this.weather === "STORM";
    const muddy = this.season === "SPRING" || wet;
    if (!muddy && snow === null) return 1;
    const p = { x, y };
    if (this.campArea.contains(p) || this.settlementLayer.layouts.some((l) => insideTown(l, p))) return 1;
    const road = this.nav.isRoad(x, y);
    let f = 1;
    if (muddy && !road) f *= (this.season === "SPRING" ? SEASONS.SPRING_MUD : 1) * (wet ? WEATHER.RAIN_MUD : 1);
    if (snow !== null && geoOf(this.world.geo).temperatureAt(x, y) < snow) f *= road ? SEASONS.SNOW_ROAD_SPEED : SEASONS.SNOW_SPEED;
    return f;
  }

  /**
   * A estação no terreno: rios e lagos do frio congelam no inverno, a cheia da primavera
   * afoga os vaus, a neve cobre o norte e as montanhas, o outono amarela as matas. O chão é
   * redesenhado, as rotas refeitas e ninguém fica dentro d'água no degelo.
   */
  private applySeason(): void {
    const store = useGameStore.getState();
    const season = seasonOf(store.day);
    const flood = isFlood(store.day);
    const key = `${season}|${flood}`;
    if (key === this.seasonKey) return;
    const first = this.seasonKey === "";
    const before = this.season;
    this.seasonKey = key;
    this.season = season;
    const terrain = this.terrainStreamer ? Unit.terrain : null;
    if (!terrain) return;
    const winter = season === "WINTER";
    terrain.setSeason({ freezeBelow: winter ? SEASONS.FREEZE_BELOW : null, flood, snowBelow: winter ? SEASONS.SNOW_BELOW : null, autumn: season === "AUTUMN" });
    Unit.groundStamp++;
    if (first) return;
    this.terrainStreamer.invalidateAll();
    this.nav.invalidateAll();
    this.armyNav.invalidateAll();
    for (const u of [...this.allAllies(), ...this.enemies]) {
      if (!u.isAlive || !terrain.isBlocked(u.x, u.y)) continue;
      const safe = this.nav.nearestOpen(u, 800);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
    this.warbands.setWinter(winter);
    this.warbands.repathAll();
    if (season !== before) {
      const text: Record<Season, string> = {
        SPRING: "Chegou a primavera: degelo e cheia. Os vaus dos rios ficam fundos por uns dias e o chão fora das estradas vira lama.",
        SUMMER: "Chegou o verão, a temporada de campanha: mais contratos, e os reinos põem exércitos em marcha.",
        AUTUMN: "Chegou o outono: colheita e feiras. A comida fica barata e os povoados pagam os impostos rurais.",
        WINTER: "Chegou o inverno: neve no norte e nas montanhas, rios congelados. Os reinos recolhem os exércitos aos quartéis de inverno — os mortos-vivos não.",
      };
      this.pushFeed(text[season]);
      store.chronicle(text[season], season === "WINTER" ? "bad" : "info");
    } else if (!flood) {
      this.pushFeed("A cheia baixou: os vaus voltam a dar passagem.");
    }
  }

  /** Tempo do dia onde o Comandante está (muda de região para região e a cada dia). */
  private updateWeather(time: number): void {
    if (time - this.lastWeatherAt < 1000) return;
    this.lastWeatherAt = time;
    const s = useGameStore.getState();
    const w = weatherAt(this.world.seed, s.day, this.commander, geoOf(this.world.geo));
    if (w === this.weather) return;
    const was = this.weather;
    this.weather = w;
    Unit.weather = w;
    Unit.groundStamp++;
    Enemy.weatherSight = WEATHER.VISION[w];
    if (this.lastHudAt === 0) return;
    const text: Record<Weather, string> = {
      CLEAR: was === "FOG" ? "O nevoeiro se abriu." : was === "SNOW" ? "Parou de nevar." : was === "STORM" ? "A tempestade passou." : "Parou de chover.",
      RAIN: "Começou a chover: arcos e bestas alcançam menos, e o chão fora da estrada vira lama.",
      FOG: "Nevoeiro: ninguém enxerga longe — bom para emboscadas.",
      SNOW: "Começou a nevar.",
      STORM: "Tempestade vinda do mar: vento, chuva forte, arcos quase inúteis. Nenhum navio sai do porto hoje.",
    };
    this.pushFeed(text[w]);
  }

  /** Previsão de amanhã: um tenente Cauteloso lê o céu. */
  private forecast(): Weather | null {
    const s = useGameStore.getState();
    if (!s.lieutenants.some((l) => l.traits.includes("CAUTIOUS"))) return null;
    return weatherAt(this.world.seed, s.day + 1, this.commander, geoOf(this.world.geo));
  }

  /** Gelo fino (perto do limite do frio): cavaleiros e carroças às vezes afundam. */
  private checkThinIce(time: number): void {
    if (this.season !== "WINTER" || time - this.lastIceAt < 1000) return;
    this.lastIceAt = time;
    const geo = geoOf(this.world.geo);
    const heavy: Unit[] = [...this.wagons];
    for (const b of this.battalions) for (const s of b.soldiers) if (s.canCharge) heavy.push(s);
    for (const u of heavy) {
      if (!u.isAlive || u.terrainType !== "ICE") continue;
      if (geo.temperatureAt(u.x, u.y) < SEASONS.FREEZE_BELOW - SEASONS.THIN_ICE || Math.random() > SEASONS.THIN_ICE_CHANCE) continue;
      u.restoreHp(u.hp - u.maxHp * SEASONS.THIN_ICE_DAMAGE);
      u.floatText("o gelo cedeu!", "#bfe6ff");
      this.pushFeed("O gelo fino cedeu sob o peso: cavalos e carroças não deviam cruzar ali.");
    }
  }

  /** O que expõe o bando hoje (fome, pântano, frio, febre): o store usa na virada do dia. */
  private updateExposure(): void {
    const s = useGameStore.getState();
    const c = this.commander;
    const geo = geoOf(this.world.geo);
    const away = !this.inCamp;
    const sheltered = this.settlementLayer.layouts.some((l) => insideTown(l, c, 600));
    s.setExposure({
      away,
      swamp: away && (c.terrainType === "SWAMP" || geo.biomeAt(c.x, c.y) === "MARSH"),
      // Cobertores do mascate protegem do frio
      cold: away && !sheltered && s.day >= s.blanketsUntil && this.season === "WINTER" && geo.temperatureAt(c.x, c.y) < SEASONS.SNOW_BELOW,
      sickTown: s.settlements.some((t) => isSick(t, s.day) && distance(t, c) < 2500),
    });
  }

  // --- Forragear e acampamento móvel (Marco 13) ---

  private forageBlocked(): string | null {
    const s = useGameStore.getState();
    if (this.inCamp) return "Saia do acampamento";
    if (this.engagement) return "Em combate";
    if (s.mutiny) return "Motim no acampamento";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    if (this.settlementLayer.layouts.some((l) => insideTown(l, this.commander, 300))) return "Dentro de um povoado";
    return null;
  }

  /** Forragear: passa um quarto de dia (bandos podem chegar), rende conforme estação, bioma e esgotamento. */
  private forage(): void {
    const why = this.forageBlocked();
    if (why) return this.pushFeed(`Não dá para forragear agora: ${why.toLowerCase()}.`);
    const s = useGameStore.getState();
    const c = { x: this.commander.x, y: this.commander.y };
    const r = this.simulateMarch([c], SUPPLY.FORAGE_DAYS, WORLD.WARBAND.CAMP_GUARD_RADIUS);
    this.passTime(r.elapsed);
    if (r.interceptedBy) return this.pushFeed(`Forragem interrompida: o ${r.interceptedBy} chegou perto!`);
    const region = `${Math.floor(c.x / WORLD.REGION_WIDTH)},${Math.floor(c.y / WORLD.REGION_HEIGHT)}`;
    const owner = [...s.settlements]
      .filter((t) => isFactionOwner(t.owner) && distance(t, c) < SUPPLY.FORAGE_OWNER_RADIUS && !s.factions.some((f) => f.id === t.owner && f.atWar))
      .sort((a, b) => distance(a, c) - distance(b, c))[0];
    const def = owner ? this.world.factions.find((f) => f.id === owner.owner) : undefined;
    const text = useGameStore.getState().forageAt(region, geoOf(this.world.geo).biomeAt(c.x, c.y), def ? { id: def.id, name: def.name } : null);
    this.pushFeed(text);
    this.updateVision(this.time.now);
  }

  /** Onde nasce o acampamento montado aqui: a leste do Comandante, com o portão (oeste) virado para ele. */
  private pitchSite(): Point {
    return { x: Math.round(this.commander.x + CAMP_WIDTH / 2 + 260), y: Math.round(this.commander.y) };
  }

  private pitchBlocked(): string | null {
    const s = useGameStore.getState();
    if (!s.campPacked) return "O acampamento está montado";
    if (this.engagement) return "Em combate";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    const site = this.pitchSite();
    const near = [...s.settlements, ...this.world.sites.map((x) => x.center)].some((t) => distance(t, site) < CAMP_MOVE.MIN_TOWN_DISTANCE);
    if (near) return "Perto demais de um povoado ou de um local";
    const geo = geoOf(this.world.geo);
    const w = CAMP_WIDTH + 200;
    const h = CAMP_HEIGHT + 200;
    for (let j = 0; j <= 4; j++) {
      for (let i = 0; i <= 4; i++) {
        const p = { x: site.x - w / 2 + (w * i) / 4, y: site.y - h / 2 + (h * j) / 4 };
        if (!geo.isOpenLand(p, 60) || Unit.terrain?.isBlocked(p.x, p.y)) return "Terreno impróprio (água, rio, montanha ou construções)";
      }
    }
    return null;
  }

  /** Levantar o acampamento: um dia e meio de trabalho; o bando sai com tudo nas carroças. */
  private packCamp(): void {
    const s = useGameStore.getState();
    if (!this.inCamp) return this.pushFeed("O acampamento só se levanta de dentro dele.");
    if (this.engagement || this.messengers.some((m) => m.isAlive && !m.available)) return this.pushFeed("Agora não dá para levantar o acampamento.");
    if (s.training.length > 0) return this.pushFeed("Há batalhões no Campo de Treino: espere o treino terminar.");
    this.passTime(CAMP_MOVE.PACK_DAYS);
    const why = useGameStore.getState().packCamp();
    if (why) return this.pushFeed(`Não dá para levantar o acampamento: ${why.toLowerCase()}`);
    const gate = this.world.camp.gate;
    this.placeArmy({ x: gate.x - 260, y: gate.y }, Math.PI);
    useGameStore.getState().loadWagons();
    this.restBy(-10);
    this.reloadWorld();
  }

  /** Montar o acampamento aqui: um dia de trabalho; o mundo é refeito com ele no lugar novo. */
  private pitchCamp(): void {
    const why = this.pitchBlocked();
    if (why) return this.pushFeed(`Não dá para montar o acampamento aqui: ${why.toLowerCase()}.`);
    const site = this.pitchSite();
    this.passTime(CAMP_MOVE.PITCH_DAYS);
    const field = this.captureField();
    if (typeof field === "string") return this.pushFeed(field);
    useGameStore.getState().pitchCamp(site, field);
  }

  /** Recria o mundo com o campo como está (acampamento redesenhado, levantado ou montado). */
  private reloadWorld(): boolean {
    const field = this.captureField();
    if (typeof field === "string") {
      this.pushFeed(field);
      return false;
    }
    useGameStore.setState((s) => ({ pendingField: field, loadNonce: s.loadNonce + 1 }));
    return true;
  }

  private spawnEnemy(x: number, y: number, kind: EnemyKind, color?: number): Enemy {
    const at = this.nav?.nearestOpen({ x, y }, 600) ?? { x, y };
    const e = new Enemy(this, at.x, at.y, kind, color);
    e.dormant = true; // acorda quando alguém do bando chegar perto
    e.setVisible(false);
    this.enemies.push(e);
    return e;
  }

  private spawnEnemyGroup(group: EnemyGroupDef, owner: Enemy["owner"], color?: number): Enemy[] {
    const kinds = group.units.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind));
    const cols = Math.ceil(Math.sqrt(kinds.length));
    return kinds.map((kind, i) => {
      const x = group.x + ((i % cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      const y = group.y + (Math.floor(i / cols) - (cols - 1) / 2) * 30 + Phaser.Math.Between(-6, 6);
      const e = this.spawnEnemy(x, y, kind, color);
      e.owner = owner;
      return e;
    });
  }

  /** Inimigos perto de alguém do bando (os outros "dormem": o mundo é grande demais para simular tudo). */
  private activeEnemies(): Enemy[] {
    return this.enemies.filter((e) => e.isAlive && !e.dormant);
  }

  /** Onde o bando do jogador está: centro da bolha de detalhe e de quem "acorda" os inimigos. */
  private presence(): Point[] {
    const anchors: Point[] = [this.commander, ...this.scouts.filter((s) => s.isAlive), ...this.messengers.filter((m) => m.isAlive)];
    for (const b of this.battalions) if (!b.isDestroyed) anchors.push(b.center);
    return anchors;
  }

  private updateDormancy(): void {
    const anchors = this.presence();
    const r2 = WORLD.ACTIVE_RADIUS ** 2;
    for (const e of this.enemies) {
      const near = anchors.some((a) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 <= r2);
      if (e.dormant && near) e.dormant = false;
      else if (!e.dormant && !near && !e.target) e.dormant = true;
    }
  }

  // --- Mundo: combate, objetivos, relógio, bandos e viagem ---

  /** Inimigos "quentes": perseguindo alguém do bando ou à vista e perto de uma tropa. */
  private isHot(e: Enemy, allyPoints: readonly Point[]): boolean {
    if (!e.hostile) return false;
    if (e.target?.isAlive && e.target.team === "ALLY") return true;
    if (!e.revealed) return false;
    const r2 = WORLD.ENGAGE_RADIUS ** 2;
    return allyPoints.some((a) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 <= r2);
  }

  /**
   * O combate começa quando inimigos e tropas se encontram e acaba depois de alguns
   * segundos sem ninguém lutando: aí sai o relatório (XP, saque, baixas, contrato).
   */
  private updateEngagement(time: number, active: readonly Enemy[]): void {
    const allyPoints: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) allyPoints.push(b.center);
    const hot = active.filter((e) => this.isHot(e, allyPoints));

    if (hot.length > 0) {
      if (!this.engagement) {
        this.engagement = {
          enemies: new Set(),
          participants: new Set(),
          startKills: new Map(),
          quietSince: null,
          region: this.placeName(this.commander),
          contractDone: false,
          notes: [],
        };
        this.pushFeed(`Combate em ${this.engagement.region}!`);
        this.checkNightAmbush(hot, time);
      }
      const eng = this.engagement;
      eng.quietSince = null;
      for (const e of hot) eng.enemies.add(e);
      // Entra no combate quem está perto dos inimigos ou já trocou golpes
      for (const b of this.battalions) {
        if (b.isDestroyed || eng.participants.has(b)) continue;
        const c = b.center;
        const close = hot.some((e) => distance(e, c) <= WORLD.ENGAGE_RADIUS * 1.5);
        if (close || b.soldiers.some((s) => s.target)) {
          eng.participants.add(b);
          eng.startKills.set(b, { kills: b.kills, lieutenantKills: b.lieutenantKills });
        }
      }
      return;
    }

    if (!this.engagement) return;
    this.engagement.quietSince ??= time;
    if (time - this.engagement.quietSince >= WORLD.ENGAGE_END_MS) this.endEngagement(this.engagementResult());
  }

  private engagementResult(): BattleResult {
    const eng = this.engagement;
    if (!eng) return "RETREAT";
    return [...eng.enemies].every((e) => !e.isAlive) ? "VICTORY" : "RETREAT";
  }

  /** Contrato cumprido (todos os inimigos do local mortos), povoado tomado ou líder de calamidade abatido. */
  private checkObjectives(): void {
    if (this.contractId && this.contractEnemies.length > 0 && this.contractEnemies.every((e) => !e.isAlive)) {
      if (this.engagement) this.engagement.contractDone = true;
      this.contractEnemies = [];
    }
    const store = useGameStore.getState();
    const sieged = this.siegeId ? store.settlements.find((x) => x.id === this.siegeId) : undefined;
    if (sieged && sieged.garrison <= 0 && this.garrisons.defeated(sieged.id)) {
      const t = sieged;
      {
        // O cerco acaba no store; syncSiege limpa a guarnição em campo e devolve os acampamentos
        store.conquerSettlement(t.id);
        this.engagement?.notes.push(`${t.name} agora pertence ao bando.`);
        this.pushFeed(`${t.name} foi tomada!`);
      }
    }
    for (const [id, c] of this.calamityObjects) {
      if (c.boss.isAlive) continue;
      const cal = store.calamities.find((x) => x.id === id);
      for (const o of c.objects) o.destroy();
      this.calamityObjects.delete(id);
      if (cal && !cal.defeated) {
        store.defeatCalamity(id);
        this.engagement?.notes.push(`${cal.leader} caiu: ${cal.name} chegou ao fim (+${REALM.CALAMITY_REWARD} de ouro).`);
        this.pushFeed(`${cal.leader} caiu!`);
      }
    }
  }

  /**
   * Cerco declarado (ou guarnição que saiu em guerra): os soldados que vivem nos acampamentos
   * por dentro dos portões passam a lutar contra o bando ali mesmo, e moradores armados
   * completam a defesa (ver Garrisons). Cerco desfeito: a milícia volta para casa e a
   * guarnição, para a rotina.
   */
  private syncSiege(): void {
    const store = useGameStore.getState();
    const id = store.siege?.settlementId ?? null;
    if (id === this.siegeId) return;
    this.siegeId = id;
    const t = id ? store.settlements.find((x) => x.id === id) : null;
    if (!t) return;
    const layout = this.settlementLayer.layoutOf(t.id);
    for (const c of layout?.camps ?? []) this.fog.revealExplored(c.fire, 500);
    this.fog.revealExplored(t, 600);
    const n = Math.min(REALM.SIEGE_MAX_DEFENDERS, Math.max(REALM.SIEGE_MIN_DEFENDERS, t.garrison));
    this.pushFeed(`${t.name}: a guarnição (${n}) sai dos acampamentos para lutar.`);
  }

  /** Atacamos um soldado de um povoado em paz: é atacar o povoado (guerra e cerco). */
  private provokeTown(id: string): void {
    const store = useGameStore.getState();
    const t = store.settlements.find((x) => x.id === id);
    if (!t || store.siege) return;
    this.pushFeed(`Atacamos a guarnição de ${t.name}!`);
    store.besiege(id);
  }

  /** Lobos: quem anda sozinho no mato é presa; as peles dos abatidos valem ouro. */
  private wildlifeContext(): WildlifeContext {
    const s = useGameStore.getState();
    const allies = this.allAllies();
    const lone = allies.filter((a) => !this.inCamp && allies.filter((b) => b !== a && distance(a, b) < WOLF.ESCORT_RADIUS).length < 2);
    const geo = geoOf(this.world.geo);
    return {
      allies,
      lone,
      canSee: (p) => this.fog.canSee(p),
      reachable: (from, to) => this.nav.findPath(from, to, 6000) !== null,
      night: Unit.darkness > 0.6,
      wild: (p) => {
        const biome = geo.biomeAt(p.x, p.y);
        if (biome !== "FOREST" && biome !== "DEEP_FOREST" && biome !== "TUNDRA" && biome !== "HILLS") return false;
        if (!geo.isOpenLand(p, 40) || Unit.terrain?.isBlocked(p.x, p.y)) return false;
        return distance(p, this.world.camp.center) > 3000 && s.settlements.every((t) => distance(t, p) > 2800);
      },
      onPelts: (n) => {
        useGameStore.setState((st) => ({ gold: st.gold + n * WOLF.PELT_GOLD }));
        this.pushFeed(`Peles de lobo: +${n * WOLF.PELT_GOLD} de ouro.`);
      },
    };
  }

  /** Guarnições de verdade perto do bando (soldados nos acampamentos, nas portas e nas ruas). */
  private updateGarrisonUnits(): void {
    const s = useGameStore.getState();
    const presence = this.presence();
    const threats = this.warbands.bands.filter((b) => isRaiderKind(b.kind)).map((b) => b.anchor);
    this.garrisons.update({
      settlements: s.settlements,
      layoutOf: (id) => this.settlementLayer.layoutOf(id),
      garrisonOf: (id) => useGameStore.getState().settlements.find((t) => t.id === id)?.garrison ?? 0,
      presence,
      hostile: (t) => this.gateRules.some((r) => r.id === t.id && r.visitor),
      siegeId: this.siegeId,
      hour: hourOf(s.dayProgress),
      danger: (id) => {
        const t = s.settlements.find((x) => x.id === id);
        return !!t && threats.some((p) => distance(p, t) < 2600);
      },
      color: (owner) => (isCalamityOwner(owner) ? undefined : ownerColor(this.world, s.calamities, owner)),
      calamityKind: (owner) => s.calamities.find((c) => c.id === owner)?.kind,
    });
  }

  /** Portões fechados para quem tem esse acesso, neste ponto (null = pode passar). */
  private closedRule(access: TownAccess, p: Point, pad = 0): GateRule | null {
    if (access === "ANY") return null;
    for (const r of this.gateRules) if ((access === "ARMY" ? r.army : r.visitor) && inRect(r.bounds, p, pad)) return r;
    return null;
  }

  /** Quem pode passar por quais portões (muda com o dono, a guerra e o cerco). */
  private updateGateRules(): void {
    const s = useGameStore.getState();
    const before = new Map(this.gateRules.map((r) => [r.id, r.army]));
    const rules: GateRule[] = [];
    for (const t of s.settlements) {
      const layout = this.settlementLayer.layoutOf(t.id);
      if (!layout || t.owner === "RUINED") continue;
      const army = t.owner !== "PLAYER";
      const war = isCalamityOwner(t.owner) || s.factions.some((f) => f.id === t.owner && f.atWar) || s.siege?.settlementId === t.id || (!!t.besiegedBy && !s.factions.some((f) => f.id === t.besiegedBy && f.atWar && t.owner === "PLAYER"));
      rules.push({ id: t.id, name: t.name, bounds: layout.bounds, army, visitor: army && war });
    }
    this.gateRules = rules;
    // Povoado que passou a barrar (ou a deixar entrar) o exército: as rotas das tropas em volta são refeitas
    const changed = new Set<string>();
    for (const r of rules) if (before.get(r.id) !== r.army) changed.add(r.id);
    for (const [id, army] of before) if (army && !rules.some((r) => r.id === id)) changed.add(id);
    for (const id of changed) {
      const l = this.settlementLayer.layoutOf(id);
      if (l) this.armyNav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 200);
    }
  }

  /** Onde o exército espera diante do portão de um povoado mais perto de `near` (virado para ele). */
  private gateWait(townId: string, near: Point): { point: Point; facing: number } {
    const layout = this.settlementLayer.layoutOf(townId) as TownLayout;
    const gate = nearestGate(layout, near);
    const point = this.armyNav.nearestOpen(gate.wait, 600) ?? gate.wait;
    return { point, facing: Math.atan2(gate.y - point.y, gate.x - point.x) };
  }

  /** O Comandante entrou num povoado que barra o exército: a tropa que o segue espera no portão. */
  private updateTownVisit(): void {
    const rule = this.closedRule("ARMY", this.commander);
    if (!rule) {
      if (this.visit) {
        this.visit = null;
        for (const b of this.battalions) b.followHold = null;
      }
      return;
    }
    if (this.visit?.townId !== rule.id) {
      this.visit = { townId: rule.id, hold: this.gateWait(rule.id, this.commander) };
      if (this.battalions.some((b) => b.isFollowing)) this.pushFeed(`${rule.name}: os guardas deixam o Comandante entrar; o exército espera no portão.`);
    }
    for (const b of this.battalions) b.followHold = this.visit.hold;
  }

  /**
   * Guarnições: em guerra (ou sob calamidade), o exército perto dos muros faz a guarnição sair
   * dos acampamentos para lutar; o bando que se afasta de um cerco o levanta.
   */
  private updateGarrisons(time: number): void {
    if (time - this.lastGarrisonAt < 500) return;
    this.lastGarrisonAt = time;
    const store = useGameStore.getState();
    const army: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) army.push(b.center);
    if (store.siege) {
      const t = store.settlements.find((x) => x.id === store.siege?.settlementId);
      const layout = t ? this.settlementLayer.layoutOf(t.id) : undefined;
      if (t && layout && !this.engagement && army.every((p) => rectDistance(layout.bounds, p) > REALM.SIEGE_LEAVE_RADIUS)) {
        store.liftSiege();
        this.pushFeed(`O cerco a ${t.name} foi levantado: a guarnição volta aos acampamentos.`);
      }
      return;
    }
    for (const r of this.gateRules) {
      if (!r.visitor || army.every((p) => rectDistance(r.bounds, p) > REALM.SALLY_RADIUS)) continue;
      if (store.garrisonSally(r.id)) break;
    }
  }

  /** Calamidade nova: o covil aparece no mapa com o líder e a guarda dele. */
  private syncCalamities(): void {
    for (const c of useGameStore.getState().calamities) {
      if (c.defeated || this.calamityObjects.has(c.id)) continue;
      const objects = drawCalamityLair(this, c);
      const guard: EnemyGroupDef["units"] = [[c.kind === "NECROMANCER" ? "SKELETON" : "ORC", 6 + c.power]];
      this.spawnEnemyGroup({ x: c.lair.x + 120, y: c.lair.y + 60, units: guard }, { kind: "CALAMITY", id: c.id });
      const [boss] = this.spawnEnemyGroup(
        { x: c.lair.x, y: c.lair.y, units: [[c.kind === "NECROMANCER" ? "NECROMANCER" : "ORC_WARLORD", 1]] },
        { kind: "CALAMITY", id: c.id },
      );
      this.calamityObjects.set(c.id, { objects, boss });
    }
  }

  /** Virando o dia: hordas das calamidades e exércitos dos reinos em guerra marcham. */
  private spawnArmies(day: number): void {
    const store = useGameStore.getState();
    const playerSeats = store.settlements.filter((t) => t.owner === "PLAYER");
    const season = seasonOf(day);
    for (const c of store.calamities) {
      // Os orcs se arrastam na neve; os mortos-vivos não sentem frio
      const every = REALM.HORDE_EVERY_DAYS * (season === "WINTER" && c.kind === "ORC_HORDE" ? SEASONS.WINTER_HORDE_EVERY : 1);
      if (c.defeated || day - c.lastHordeDay < every) continue;
      store.markHorde(c.id, day);
      // A horda sai do covil ou de uma cidade que já caiu nas mãos dela
      const held = store.settlements.filter((t) => t.owner === c.id);
      const origin = held.length > 0 && Math.random() < 0.5 ? held[Math.floor(Math.random() * held.length)] : c.lair;
      const size = REALM.HORDE_BASE_SIZE + c.power * 2;
      this.warbands.spawnBand({
        name: c.kind === "NECROMANCER" ? `Mortos de ${c.leader}` : `Horda de ${c.leader}`,
        kind: "HORDE",
        units: [[c.kind === "NECROMANCER" ? "SKELETON" : "ORC", size]],
        origin: { x: origin.x, y: origin.y },
        ownerId: c.id,
        calamityKind: c.kind,
      });
      store.chronicle(`${c.kind === "NECROMANCER" ? "Uma nova leva de mortos" : "Uma nova horda"} (${size}) saiu de ${c.region}.`, "bad");
    }
    // Inverno: quartéis de inverno (nenhum exército sai); verão: temporada de campanha
    const armyEvery = REALM.ARMY_EVERY_DAYS * (season === "SUMMER" ? SEASONS.SUMMER_ARMY_EVERY : 1);
    for (const f of store.factions) {
      if (season === "WINTER" || !f.atWar || day - f.lastArmyDay < armyEvery) continue;
      const own = store.settlements.filter((t) => t.owner === f.id);
      if (own.length === 0) continue;
      store.markArmy(f.id, day);
      const target = playerSeats[0] ?? this.world.camp.center;
      const origin = [...own].sort((a, b) => distance(a, target) - distance(b, target))[0];
      const size = REALM.ARMY_BASE_SIZE + own.length * 2;
      const archers = Math.round(size / 3);
      const def = this.world.factions.find((x) => x.id === f.id);
      // Um lorde do reino lidera, se houver quem (Marco 15)
      const lord = store.nobles.find((n) => n.alive && n.factionId === f.id && n.rank === "LORD" && !n.armyId && !n.captiveOf);
      this.warbands.spawnBand({
        name: lord ? `Exército de ${nobleName(lord, def?.name ?? "reino")}` : `Exército ${ofRealm(def?.name ?? "reino")}`,
        kind: "FACTION",
        units: [
          ["SOLDIER", size - archers],
          ["CROSSBOW", archers],
        ],
        origin: { x: origin.x, y: origin.y + 300 },
        ownerId: f.id,
        color: def?.color,
      });
      store.chronicle(`${TheRealm(def?.name ?? "reino")} pôs um exército (${size}) em marcha contra os ${this.world.bandName}.`, "bad");
    }
    this.syncArmies();
    this.syncRevolts();
  }

  /**
   * Exércitos dos lordes (Marco 15): a simulação decide; aqui eles viram bandos de verdade,
   * marcham, cercam, e os que acabaram (tomaram a cidade, desistiram) deixam o mapa.
   */
  private syncArmies(): void {
    const store = useGameStore.getState();
    for (const a of store.armies) {
      const band = a.bandId ? this.warbands.bands.find((b) => b.id === a.bandId) : undefined;
      if (a.outcome) {
        if (band && a.outcome !== "TOOK") {
          if (!band.homeward) this.warbands.sendHome(band);
          continue;
        }
        if (band) this.warbands.disband(band);
        useGameStore.getState().armyDone(a.id, a.size);
        continue;
      }
      if (band) continue;
      // Sumiu do mapa, ou o inverno chegou antes de sair: a convocação acaba
      if (a.bandId || this.season === "WINTER") {
        useGameStore.getState().armyDone(a.id);
        continue;
      }
      const from = store.settlements.find((t) => t.id === a.fromId);
      const target = store.settlements.find((t) => t.id === a.targetId);
      const def = this.world.factions.find((f) => f.id === a.factionId);
      if (!from || !target || !def) {
        useGameStore.getState().armyDone(a.id);
        continue;
      }
      const layout = this.settlementLayer.layoutOf(from.id);
      const origin = layout ? nearestGate(layout, target).outside : { x: from.x, y: from.y + 300 };
      const lord = a.lordId ? store.nobles.find((n) => n.id === a.lordId) : undefined;
      const archers = Math.round(a.size / 3);
      const spawned = this.warbands.spawnBand({
        name: lord ? `Exército de ${nobleName(lord, def.name)}` : `Exército ${ofRealm(def.name)}`,
        kind: "FACTION",
        units: [
          ["SOLDIER", a.size - archers],
          ["CROSSBOW", archers],
        ],
        origin,
        ownerId: a.factionId,
        color: def.color,
        goalId: target.id,
        armyId: a.id,
      });
      useGameStore.getState().armySpawned(a.id, spawned.id);
    }
  }

  /** Povoado em revolta: a gente sai de casa com foices e marcha contra os próprios muros. */
  private syncRevolts(): void {
    const store = useGameStore.getState();
    for (const id of store.revolts) {
      if (this.warbands.bands.some((b) => b.kind === "REBELS" && b.goal.kind === "SETTLEMENT" && b.goal.id === id)) continue;
      const t = store.settlements.find((x) => x.id === id);
      const layout = t ? this.settlementLayer.layoutOf(id) : undefined;
      if (!t || !layout) {
        store.revoltHandled(id);
        continue;
      }
      const n = Math.max(6, Math.min(KINGDOM.REVOLT_MAX, Math.round((t.population / 100) * KINGDOM.REVOLT_PER_100)));
      const gate = layout.gates[0];
      this.warbands.spawnBand({ name: `Camponeses revoltados de ${t.name}`, kind: "REBELS", units: [["BANDIT", n]], origin: { x: gate.wait.x, y: gate.wait.y }, ownerId: null, goalId: id });
    }
  }

  private endEngagement(result: BattleResult): void {
    const eng = this.engagement;
    this.engagement = null;
    const clock = useGameStore.getState();
    this.lastCombatDay = clock.day + clock.dayProgress;
    if (!eng && result !== "DEFEAT") return;

    const store = useGameStore.getState();
    const participants = eng ? [...eng.participants] : this.battalions;
    const survivors: BattalionSurvivors[] = participants.map((b) => {
      const start = eng?.startKills.get(b) ?? { kills: 0, lieutenantKills: 0 };
      return {
        id: b.id,
        survivors: b.aliveCount,
        formation: b.formation,
        kills: b.kills - start.kills,
        lieutenantAlive: b.lieutenant ? b.lieutenantAlive : undefined,
        lieutenantKills: b.lieutenantKills - start.lieutenantKills,
      };
    });
    const killed = eng ? [...eng.enemies].filter((e) => !e.isAlive).length : 0;
    if (eng && killed >= 4) {
      const fallen = [...eng.enemies];
      store.markBattlefield(fallen.reduce((n, e) => n + e.x, 0) / fallen.length, fallen.reduce((n, e) => n + e.y, 0) / fallen.length);
    }
    const mutinyOver = !!store.mutiny && this.mutineers.length > 0 && this.mutineers.every((e) => !e.isAlive);
    // Só o contrato de limpar um local termina em combate (os da economia têm fim próprio)
    const siteContract = !!store.activeContract && (store.activeContract.contract.kind ?? "SITE") === "SITE";
    const contractDone = !!eng?.contractDone || (!!this.contractId && this.contractEnemies.length === 0 && siteContract);

    if (result === "VICTORY") sfx.victory();
    else if (result === "DEFEAT") sfx.defeat();
    this.storeWagonHp();
    this.selectionBox.clear();
    store.setContextMenu(null);
    store.resolveEngagement(result, survivors, this.supportReport(), {
      title: `Combate em ${eng?.region ?? this.placeName(this.commander)}`,
      enemiesKilled: killed,
      contractDone,
      mutinyOver,
      notes: eng?.notes ?? [],
    });
    // O que já foi informado não entra no próximo relatório
    for (const m of this.messengers) m.deliveries = 0;
    for (const id of [...this.deadScoutIds, ...this.deadMessengerIds]) this.reportedDead.add(id);
    if (mutinyOver || (result === "DEFEAT" && store.mutiny)) this.mutineers = [];
    if (contractDone) this.contractId = null;
    // Quem sobreviveu ao combate (XP, nível, baixas) é recriado a partir dos dados novos
    this.armyDirty = true;
    this.publishHud();
  }

  /**
   * O Comandante caiu: o combate é perdido, os amotinados (se houver) fogem e o bando
   * recua carregando-o ferido para o acampamento.
   */
  private defeat(): void {
    if (!this.engagement) {
      this.engagement = {
        enemies: new Set(this.activeEnemies().filter((e) => e.target)),
        participants: new Set(this.battalions.filter((b) => !b.isDestroyed)),
        startKills: new Map(),
        quietSince: null,
        region: this.placeName(this.commander),
        contractDone: false,
        notes: [],
      };
    }
    const store = useGameStore.getState();
    const mutiny = !!store.mutiny;
    this.endEngagement("DEFEAT");
    // Cerco perdido: a guarnição volta para trás dos muros
    if (useGameStore.getState().siege) useGameStore.getState().liftSiege();
    if (mutiny) {
      for (const e of this.enemies) {
        if (e.owner?.kind !== "MUTINY") continue;
        e.unitState = "DEAD";
        e.destroy();
      }
      this.enemies = this.enemies.filter((e) => e.isAlive);
    }

    // Novo Comandante (o mesmo, recuperado) no acampamento; o exército volta com ele
    const spawn = this.world.camp.spawn;
    this.commander = new Commander(this, spawn.x, spawn.y);
    this.commander.setFacing(-Math.PI / 2);
    this.cameras.main.startFollow(this.commander, true, 0.1, 0.1);
    this.cameraLocked = true;
    this.lastCommanderPos = { x: this.commander.x, y: this.commander.y };
    this.walkPath = null;
    this.inCamp = true;
    for (const b of this.battalions) this.unquarter(b);
    this.quartered.clear();
    useGameStore.getState().battalions.forEach((data, i) => {
      const b = this.battalions.find((x) => x.id === data.id);
      const slot = this.campArea.quarterSlot(i) ?? spawn;
      if (!b || b.isDestroyed) return;
      if (b.panicking) b.rally();
      b.teleportTo(slot);
      this.quarter(b, i, slot);
    });
    for (const r of [...this.scouts, ...this.messengers]) {
      if (!r.isAlive) continue;
      r.x = spawn.x + Phaser.Math.Between(150, 260);
      r.y = spawn.y + Phaser.Math.Between(-60, 60);
      r.target = null;
    }
    for (const e of this.enemies) if (e.target) e.target = null;
    // O que sobrou do trem de carroças volta com o Comandante e descarrega
    useGameStore.getState().unloadWagons();
    this.wagons.forEach((w, i) => {
      const p = this.wagonSlot(i);
      w.x = p.x;
      w.y = p.y;
    });
    this.armyDirty = true;
  }

  /**
   * Relógio do mundo: fora do acampamento e fora de combate, o dia corre com a marcha
   * (DAY_DISTANCE por dia) e devagar com o tempo parado (DAY_SECONDS). Dentro das muralhas de
   * um povoado só o relógio parado corre (andar pelas ruas não é marcha); dentro da paliçada
   * do acampamento o tempo para.
   */
  private tickClock(time: number, dt: number): void {
    const moved = distance(this.commander, this.lastCommanderPos);
    this.lastCommanderPos = { x: this.commander.x, y: this.commander.y };
    if (!this.inCamp && !this.engagement && moved < 200) {
      const inTown = this.settlementLayer.layouts.some((l) => insideTown(l, this.commander));
      // Marcha forçada rende mais caminho por dia; lama, neve e a coluna do acampamento levantado, menos
      const c = this.commander;
      const pace = (this.forced ? FATIGUE.FORCED_DAY : 1) * this.groundAt(c.x, c.y, c.terrainType) * (this.campArea.packed ? CAMP_MOVE.PACKED_SPEED : 1);
      this.clockAccum += (inTown ? 0 : moved / (WORLD.DAY_DISTANCE * pace)) + dt / WORLD.DAY_SECONDS;
    } else if (this.inCamp && !this.engagement && useGameStore.getState().training.length > 0) {
      // No acampamento o tempo para — menos enquanto alguém treina (assiste-se ao treino)
      this.clockAccum += dt / PROGRESSION.TRAINING_CAMP_DAY_SECONDS;
    }
    if (time - this.lastClockFlush < CLOCK_FLUSH_MS || this.clockAccum <= 0) return;
    this.lastClockFlush = time;
    this.updateExposure();
    this.passTime(this.clockAccum);
    this.clockAccum = 0;
  }

  /** Passa tempo no store; virando o dia, um bando novo pode surgir num covil. */
  private passTime(days: number): void {
    const store = useGameStore.getState();
    const before = store.day;
    // Notícias alcançam o Comandante onde ele está (Marco 15)
    if (days > 0 && before !== Math.floor(before + store.dayProgress + days)) useGameStore.setState({ commanderAt: { x: Math.round(this.commander.x), y: Math.round(this.commander.y) } });
    const logBefore = store.log[store.log.length - 1]?.id ?? 0;
    store.advanceTime(days);
    const after = useGameStore.getState().day;
    if (after === before) return;
    // As notícias que chegaram hoje aparecem no HUD (as três mais novas)
    for (const l of useGameStore.getState().log.filter((e) => e.id > logBefore && e.text.startsWith("Chegou")).slice(-3)) this.pushFeed(l.text);
    this.applySeason();
    // Inverno: os goblins saem menos dos covis
    const band = this.warbands.maybeSpawnGoblins(after, this.world.lairs, (p) => this.fog.canSee(p), this.season === "WINTER" ? SEASONS.WINTER_GOBLIN_EVERY : 1);
    if (band) useGameStore.getState().chronicle(`Rumores: um bando goblin deixou seu covil nos ermos.`, "bad");
    this.spawnArmies(after);
    this.spawnAgents();
    // Comércio (Marco 14): o mar fecha com a tempestade; mercadores mandam carga
    this.tradeNews(this.trade.weatherCheck(after));
    this.tradeNews(this.trade.daily(after));
    this.autosave();
  }

  /**
   * Chegadas dos bandos sem o exército por perto: combate abstrato no povoado (resistiu,
   * saqueado, tomado, arruinado) ou saque ao acampamento desguarnecido.
   */
  private handleWarbandEvents(events: readonly WarbandEvent[]): void {
    const store = useGameStore.getState();
    for (const ev of events) {
      // Caravanas (Marco 14): chegada, saque, destruição; goblins com carga roubada
      const contractBand = ev.type === "DESTROYED" && ev.band.id === store.activeContract?.contract.bandId;
      if (ev.type === "DELIVERED" || ev.type === "CARAVAN_RAIDED" || (ev.type === "DESTROYED" && (ev.band.kind === "CARAVAN" || ev.band.loot || contractBand))) {
        const near = (p: Point) => this.presence().some((a) => distance(a, p) < 2600);
        this.tradeNews(this.trade.onEvent(ev, near));
        if (ev.type !== "DESTROYED" || ev.band.kind === "CARAVAN") continue;
      }
      // Exércitos dos lordes (Marco 15)
      if (ev.type === "ARMY_AT") {
        if (ev.band.armyId) store.armyArrived(ev.band.armyId);
        if (ev.band.spotted || distance(this.commander, ev.band.anchor) < 5000) this.pushFeed(`${ev.band.name} acampou diante de ${this.placeName(ev.band.anchor)}: é um cerco.`);
        continue;
      }
      if (ev.type === "ARMY_HOME") {
        if (ev.band.armyId) store.armyDone(ev.band.armyId, bandSize(ev.band));
        continue;
      }
      if (ev.type === "ARMY_CLASH") {
        const near = ev.winner.spotted || ev.loser.spotted || distance(this.commander, ev.at) < 5000;
        if (near) this.pushFeed(`${ev.winner.name} destroçou o ${ev.loser.name} perto de ${this.placeName(ev.at)}.`);
        store.armiesClash(ev.winner.armyId ?? null, ev.loser.armyId ?? null, ev.at);
        store.markBattlefield(ev.at.x, ev.at.y);
        continue;
      }
      if (ev.type === "SKIRMISH") {
        const near = ev.winner.spotted || ev.loser.spotted || distance(this.commander, ev.at) < 5000;
        if (near) {
          const text = `${ev.winner.name} venceu o ${ev.loser.name} perto de ${this.placeName(ev.at)}.`;
          this.pushFeed(text);
          store.chronicle(text, ev.winner.kind === "PATROL" ? "good" : "bad");
        }
        store.markBattlefield(ev.at.x, ev.at.y);
        continue;
      }
      if (ev.type === "SHELTERED") {
        const t = useGameStore.getState().settlements.find((x) => x.id === ev.settlementId);
        if (ev.band.spotted && t) this.pushFeed(`Os ${ev.band.name.toLowerCase()} chegaram a ${t.name}.`);
        continue;
      }
      if (ev.type === "MASSACRE") {
        const text = `O ${ev.by.name} alcançou os ${ev.band.name.toLowerCase()} na estrada. Ninguém sobreviveu.`;
        store.chronicle(text, "bad");
        if (distance(this.commander, ev.band.anchor) < 6000) this.pushFeed(text);
        store.markBattlefield(ev.band.anchor.x, ev.band.anchor.y);
        continue;
      }
      if (ev.type === "QUARTERED") {
        // O exército vira guarnição do povoado onde passa o inverno
        const t = useGameStore.getState().settlements.find((x) => x.id === ev.settlementId);
        const n = bandSize(ev.band);
        if (t) {
          useGameStore.setState((st) => ({
            settlements: st.settlements.map((x) => (x.id === t.id ? { ...x, garrison: Math.min(REALM.SIEGE_MAX_DEFENDERS, x.garrison + n) } : x)),
          }));
          store.chronicle(`O ${ev.band.name} recolheu-se aos quartéis de inverno em ${t.name}.`);
          if (ev.band.spotted) this.pushFeed(`O ${ev.band.name} foi passar o inverno em ${t.name}.`);
        }
        continue;
      }
      const band = ev.band;
      if (ev.type === "DESTROYED") {
        // Mensageiro real abatido pelo bando: os despachos são lidos
        if (band.kind === "COURIER") {
          if (band.materialized && band.ownerId) {
            this.pushFeed(`Mensageiro real interceptado! ${store.interceptCourier(band.ownerId)}`);
            this.revealArmiesOf(band.ownerId);
          }
          continue;
        }
        if (band.kind === "REFUGEES") continue;
        // Exército de um lorde caiu: quem esteve perto do bando conta como obra do bando
        if (band.armyId) {
          store.armyDestroyed(band.armyId, distance(this.commander, band.anchor) < 2500, band.anchor);
          this.pushFeed(`O ${band.name} não existe mais.`);
          continue;
        }
        // Revolta acabou: a gente volta para casa com medo (e menos gente)
        if (band.kind === "REBELS") {
          if (band.goal.kind === "SETTLEMENT") store.revoltHandled(band.goal.id);
          store.chronicle(`A revolta de ${this.placeName(band.anchor)} foi esmagada.`, "info");
          continue;
        }
        if (band.spotted || band.kind !== "GOBLIN") {
          // Patrulha que caiu (diante dos goblins) é má notícia; bando hostil destruído, boa
          store.chronicle(`${band.kind === "PATROL" ? "A" : "O"} ${band.name} foi destruíd${band.kind === "PATROL" ? "a" : "o"}.`, isRaiderKind(band.kind) ? "good" : "bad");
          this.pushFeed(`O ${band.name} não existe mais.`);
        }
        continue;
      }
      // O exército por perto defende: o bando luta em vez de resolver no abstrato
      const guarded = this.commander.isAlive && distance(this.commander, band.anchor) < WORLD.WARBAND.CAMP_GUARD_RADIUS;
      if (guarded || band.members.some((m) => m.target)) continue;
      if (ev.goal.kind === "CAMP") {
        const camp = this.world.camp.center;
        const defenders = this.battalions.some((b) => !b.isDestroyed && distance(b.center, camp) < WORLD.WARBAND.CAMP_GUARD_RADIUS);
        // Acampamento levantado: só um chão vazio para trás
        if (!defenders && !this.campArea.packed) {
          store.raidCamp(band.name);
          this.pushFeed(`${band.name} atacou o acampamento desguarnecido!`);
        }
        this.warbands.retarget(band);
        continue;
      }
      if (ev.goal.kind !== "SETTLEMENT") continue;
      const outcome = store.bandArrives(ev.goal.id, {
        name: band.name,
        kind: band.kind,
        members: bandSize(band),
        ownerId: band.ownerId,
        calamityKind: band.calamityKind,
      });
      const t = useGameStore.getState().settlements.find((x) => x.id === (ev.goal as { id: string }).id);
      // Camponeses: acabou de um jeito ou de outro
      if (band.kind === "REBELS") {
        store.revoltHandled(ev.goal.id);
        if (t) this.pushFeed(outcome === "CAPTURED" ? `${t.name} expulsou o senhor: a aldeia é livre.` : `A revolta de ${t.name} foi contida pela guarnição.`);
        this.warbands.disband(band);
        continue;
      }
      if (outcome === "REPELLED") {
        // Os defensores derrubam metade do bando antes de ele recuar
        this.warbands.loseHalf(band);
        if (t) this.pushFeed(`${t.name} repeliu o ${band.name}.`);
      } else if (outcome === "CAPTURED") {
        if (t) this.pushFeed(`${t.name} caiu nas mãos do ${band.name}.`);
        if (t) this.spawnRefugees(t);
        this.warbands.disband(band); // o bando vira a guarnição do povoado
        continue;
      } else if (outcome === "RUINED" || outcome === "RAIDED") {
        if (t) this.pushFeed(outcome === "RUINED" ? `${t.name} foi tomada pelos mortos!` : `${band.name} saqueou ${t.name}!`);
      }
      // Quem escapou foge pela estrada até o povoado de pé mais perto
      if (t && (outcome === "RAIDED" || outcome === "RUINED")) this.spawnRefugees(t);
      this.warbands.retarget(band);
    }
  }

  /** Notícias do comércio: no HUD (se perto) e na crônica. */
  private tradeNews(news: readonly TradeNews[]): void {
    for (const n of news) {
      if (!n.quiet) this.pushFeed(n.text);
      useGameStore.getState().chronicle(n.text, n.tone);
    }
  }

  /** Nome do lugar para o HUD e os relatórios: povoado, acampamento, local de contrato ou região. */
  private placeName(p: Point): string {
    if (this.campArea.contains(p, -200)) return "o acampamento";
    const town = useGameStore.getState().settlements.find((t) => {
      const layout = this.settlementLayer.layoutOf(t.id);
      // Os acampamentos da guarnição e o portão (onde o exército espera) contam como o povoado
      return layout ? insideTown(layout, p, 800) : distance(t, p) < 600;
    });
    if (town) return town.name;
    const site = this.world.sites.find((x) => distance(x.center, p) < 1200);
    if (site) return site.name;
    const river = geoOf(this.world.geo).riverAt(p.x, p.y, 250);
    if (river) return `margens do ${river.river.name}`;
    return regionName(this.world, p);
  }

  /** Onde nasce a aldeia fundada: logo à frente (ao sul) do Comandante, com o portão norte para ele. */
  private foundSite(): Point {
    return { x: Math.round(this.commander.x), y: Math.round(this.commander.y + TOWN_SIZE.VILLAGE.h / 2 + 380) };
  }

  /**
   * Plantas mudaram (aldeia fundada, povoado em ruínas ou reconstruído): colisão, navegação e
   * rotas são refeitas, e quem ficou dentro de uma parede sai para a rua mais próxima.
   */
  private applyTowns(): void {
    const terrain = Unit.terrain;
    if (!terrain) return;
    terrain.setTowns(this.settlementLayer.layouts);
    // (o raio cobre os acampamentos da guarnição, do lado de fora dos muros)
    for (const l of this.settlementLayer.layouts) {
      this.nav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 700);
      this.armyNav.invalidate({ x: l.cx, y: l.cy }, Math.max(l.bounds.w, l.bounds.h) / 2 + 700);
    }
    for (const u of [...this.allAllies(), ...this.enemies]) {
      if (!u.isAlive || !terrain.isBlocked(u.x, u.y)) continue;
      const safe = this.nav.nearestOpen(u, 800);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
    this.warbands.repathAll();
  }

  /** Sólidos do acampamento mudaram (alojamentos refeitos): colisão e rotas em volta dele. */
  private applyCampSolids(): void {
    const terrain = Unit.terrain;
    if (!terrain || !this.campArea) return;
    terrain.setExtraSolids(this.campArea.solids());
    const c = this.world.camp.center;
    this.nav?.invalidate(c, 1100);
    this.armyNav?.invalidate(c, 1100);
    for (const u of [...(this.commander ? this.allAllies() : []), ...this.enemies]) {
      if (!u.isAlive || !terrain.isBlocked(u.x, u.y) || distance(u, c) > 1100) continue;
      const safe = this.nav.nearestOpen(u, 300);
      if (safe) {
        u.x = safe.x;
        u.y = safe.y;
      }
    }
  }

  /** Pode fundar uma vila aqui? (null = sim; senão, o motivo) */
  private foundBlocked(): string | null {
    const store = useGameStore.getState();
    if (this.inCamp) return "Saia do acampamento";
    if (this.engagement) return "Em combate";
    // A mesma regra do store: distância medida de onde a aldeia nasce (à frente do Comandante)
    const site = this.foundSite();
    const near = [...store.settlements, this.world.camp.center].some((t) => distance(t, site) < REALM.FOUND_MIN_DISTANCE);
    if (near) return "Perto demais de outro povoado";
    const { w, h } = TOWN_SIZE.VILLAGE;
    const geo = geoOf(this.world.geo);
    const terrain = Unit.terrain;
    for (let j = 0; j <= 4; j++) {
      for (let i = 0; i <= 4; i++) {
        const p = { x: site.x - w / 2 - 150 + ((w + 300) * i) / 4, y: site.y - h / 2 - 150 + ((h + 300) * j) / 4 };
        if (!geo.isOpenLand(p, 60) || terrain?.isBlocked(p.x, p.y)) return "Terreno impróprio (água, rio, montanha ou construções)";
      }
    }
    if (store.gold < REALM.FOUND_COST.gold || store.iron < REALM.FOUND_COST.iron) return "Ouro ou ferro insuficiente";
    return null;
  }

  /**
   * Viagem rápida (Mapa do Continente): o exército marcha pela rota por terra até o destino em passos de
   * fração de dia, os bandos marcham junto, e a viagem para se algum deles cruzar o caminho.
   */
  private fastTravel(dest: Point): void {
    const store = useGameStore.getState();
    const refuse = (why: string) => {
      this.pushFeed(why);
      this.publishHud();
    };
    if (this.engagement) return refuse("Em combate: impossível viajar.");
    if (store.mutiny) return refuse("Motim no acampamento: resolva antes de partir.");
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) {
      return refuse("Inimigos à vista: impossível viajar.");
    }
    if (this.messengers.some((m) => m.isAlive && !m.available)) return refuse("Aguarde os mensageiros voltarem antes de viajar.");
    if (!this.fog.isExplored(dest)) return refuse("Destino desconhecido: explore a região antes.");
    const start = { x: this.commander.x, y: this.commander.y };
    // O exército marcha pelas rotas das tropas: povoado que o barra = a marcha termina no portão
    const shut = this.closedRule("ARMY", dest, 400);
    const target = this.armyNav.nearestOpen(shut ? this.gateWait(shut.id, start).point : dest, 800);
    if (!target) return refuse("Não há onde parar ali (água ou montanha).");
    const path = this.armyNav.findPath(this.armyNav.nearestOpen(start, 1500) ?? start, target, 250000);
    if (!path) return refuse("Não há caminho por terra até lá (rio sem ponte, mar ou montanha).");

    const route = [start, ...path];
    const days = routeLength(route) / (WORLD.DAY_DISTANCE * this.marchPace(route));
    const { at, elapsed, interceptedBy, facing } = this.simulateMarch(route, days, WORLD.INTERCEPT_RADIUS);

    this.placeArmy(at, facing);
    this.passTime(elapsed);
    this.tireBy(elapsed);
    store.setWorldMapOpen(false);
    const dayText = elapsed < 1 ? "menos de um dia" : `${elapsed.toFixed(1).replace(".", ",")} dias`;
    this.pushFeed(
      interceptedBy
        ? `Interceptados pelo ${interceptedBy} no caminho! (${dayText} de marcha)`
        : `Chegamos a ${this.placeName(at)} após ${dayText} de marcha.`,
    );
    this.updateVision(this.time.now);
    this.publishHud();
  }

  /**
   * Passo da marcha numa rota (multiplica o caminho por dia): o chão da estação ao longo dela,
   * a marcha forçada, a tropa cansada, as carroças na lama e a coluna do acampamento levantado.
   */
  private marchPace(route: readonly Point[]): number {
    const total = routeLength(route);
    const n = Math.max(1, Math.ceil(total / 800));
    let ground = 0;
    for (let i = 0; i < n; i++) {
      const p = pointAlong(route, (total * (i + 0.5)) / n);
      ground += this.groundAt(p.x, p.y, Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS");
    }
    ground /= n;
    const marching = this.battalions.filter((b) => !b.isDestroyed && !this.quartered.has(b.id));
    const tired = marching.length > 0 ? Math.min(...marching.map((b) => b.fatigueSpeed)) : 1;
    // Carroças atolam mais que gente: o exército espera por elas; carregadas de mercadoria, mais ainda (Marco 14)
    const wagons = (this.wagons.length > 0 && ground < 0.9 ? 0.9 : 1) * (this.wagons.length > 0 ? this.loadPace() : 1);
    return ground * wagons * tired * (this.forced ? FATIGUE.FORCED_DAY : 1) * (this.campArea.packed ? CAMP_MOVE.PACKED_SPEED : 1);
  }

  /** Carroças pesadas de mercadoria andam mais devagar (até −15% com tudo cheio). */
  private loadPace(): number {
    const s = useGameStore.getState();
    const cap = cargoCapacity(s.wagons.length);
    return cap > 0 ? 1 - TRADE.LOAD_SLOW * Math.min(1, freightWeight(s.freight) / cap) : 1;
  }

  /**
   * Dias que passam de uma vez (viagem rápida ou descanso): o exército percorre a rota em
   * passos de fração de dia, os bandos marcham junto, e tudo para se algum chegar perto.
   */
  private simulateMarch(
    route: readonly Point[],
    totalDays: number,
    interceptRadius: number,
  ): { at: Point; elapsed: number; interceptedBy: string | null; facing: number } {
    for (const e of this.enemies) e.dormant = true; // ninguém vê o caminho inteiro: tudo anda em bloco
    const total = routeLength(route);
    const steps = Math.max(1, Math.ceil(totalDays / TRAVEL_STEP_DAYS));
    let at = route[0];
    let elapsed = 0;
    let interceptedBy: string | null = null;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      at = pointAlong(route, total * t);
      elapsed = totalDays * t;
      this.handleWarbandEvents(this.warbands.advance(totalDays / steps));
      this.tradeNews(this.trade.advance(totalDays / steps));
      this.fog.revealExplored(at, SUPPORT.VISION.SCOUT);
      const band = this.warbands.bands.find((b) => this.bandHostile(b) && distance(b.anchor, at) < interceptRadius);
      if (band) {
        interceptedBy = band.name;
        // Para um pouco antes, de frente para o bando
        at = pointAlong(route, Math.max(0, total * t - 250));
        break;
      }
    }
    // Olhando na direção do último trecho da rota
    const last = route[route.length - 1];
    const prev = route[route.length - 2];
    const facing = prev ? Math.atan2(last.y - prev.y, last.x - prev.x) : this.commander.facing;
    return { at, elapsed, interceptedBy, facing };
  }

  // --- Pontes ---

  private buildBridgeSpots(burned: readonly string[]): void {
    const riverName = (id: string) => this.world.geo.rivers.find((r) => r.id === id)?.name ?? "rio";
    this.bridgeSpots = this.world.geo.crossings
      .filter((c) => c.kind === "BRIDGE")
      .map((c) => {
        const river = riverName(c.riverId);
        return {
          label: burned.includes(c.id) ? `Ponte queimada sobre o ${river}` : `Ponte sobre o ${river}`,
          door: { x: c.x, y: c.y },
          panel: { kind: "BRIDGE" as const, bridgeId: c.id },
          bounds: new Phaser.Geom.Rectangle(c.x - 120, c.y - 120, 240, 240),
          radius: 230,
        };
      });
    // Balsas: um cais em cada margem
    for (const c of this.world.geo.crossings.filter((x) => x.kind === "FERRY")) {
      for (const dock of ferryDocks(c)) {
        this.bridgeSpots.push({
          label: `Balsa do ${riverName(c.riverId)}`,
          door: dock,
          panel: { kind: "FERRY" as const, ferryId: c.id },
          bounds: new Phaser.Geom.Rectangle(dock.x - 70, dock.y - 70, 140, 140),
          radius: 170,
        });
      }
    }
  }

  /** Balsa: o exército inteiro passa ao cais da outra margem (ouro e um pedaço do dia). */
  private crossFerry(id: string): void {
    const store = useGameStore.getState();
    const c = this.world.geo.crossings.find((x) => x.id === id && x.kind === "FERRY");
    if (!c) return;
    if (this.engagement) return this.pushFeed("Em combate: o barqueiro não sai.");
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return this.pushFeed("Inimigos à vista: o barqueiro não sai.");
    if (this.messengers.some((m) => m.isAlive && !m.available)) return this.pushFeed("Aguarde os mensageiros voltarem antes de atravessar.");
    const [a, b] = ferryDocks(c);
    const from = distance(this.commander, a) <= distance(this.commander, b) ? a : b;
    const to = from === a ? b : a;
    const river = this.world.geo.rivers.find((r) => r.id === c.riverId)?.name ?? "rio";
    if (!store.payFerry(GEO.FERRY_GOLD, river)) return this.pushFeed("Sem ouro para a balsa.");
    // Desembarca terra adentro, virado para longe do rio (a tropa fica entre o Comandante e o cais)
    const dir = Math.atan2(to.y - from.y, to.x - from.x);
    const land = { x: to.x + Math.cos(dir) * 480, y: to.y + Math.sin(dir) * 480 };
    this.placeArmy(this.armyNav.nearestOpen(land, 400) ?? land, dir);
    this.passTime(GEO.FERRY_DAYS);
    this.pushFeed(`O exército atravessou o ${river} de balsa.`);
    this.updateVision(this.time.now);
  }

  /** Ponte queimada ou reconstruída: terreno, desenho, rotas e o que os bandos planejavam mudam. */
  private applyBridges(burned: readonly string[], before: readonly string[]): void {
    const terrain = Unit.terrain;
    if (!terrain) return;
    terrain.setBurned(burned);
    const changed = [...burned.filter((id) => !before.includes(id)), ...before.filter((id) => !burned.includes(id))];
    for (const id of changed) {
      const c = this.world.geo.crossings.find((x) => x.id === id);
      if (!c) continue;
      this.terrainStreamer.invalidate(c, 500);
      this.nav.invalidate(c, 400);
      // Quem estava sobre a ponte em chamas cai na margem mais próxima
      for (const u of [...this.allAllies(), ...this.enemies]) {
        if (!u.isAlive || !terrain.isBlocked(u.x, u.y) || distance(u, c) > 400) continue;
        const safe = this.nav.nearestOpen(u, 600);
        if (safe) {
          u.x = safe.x;
          u.y = safe.y;
        }
      }
    }
    this.warbands.repathAll();
    this.buildBridgeSpots(burned);
  }

  /** Pedágio: ao pisar numa ponte de outro, paga (ou passa à força). */
  private updateBridgeCrossing(): void {
    const c = this.commander;
    const id = c.terrainType === "BRIDGE" ? (geoOf(this.world.geo).crossingAt(c.x, c.y)?.id ?? null) : null;
    if (id === this.onBridge) return;
    this.onBridge = id;
    if (!id) return;
    const msg = useGameStore.getState().crossBridge(id);
    if (msg) this.pushFeed(msg);
  }

  // --- Agentes do mundo (Marco 12) ---

  /** O bando ataca o jogador? Goblins, exércitos e hordas sim; patrulhas e mensageiros só em guerra ou provocados. */
  private bandHostile(b: Warband): boolean {
    const s = useGameStore.getState();
    // Camponeses só querem a terra deles; só são inimigos do senhor (Marco 15)
    if (b.kind === "REBELS") return b.goal.kind === "SETTLEMENT" && s.settlements.find((t) => t.id === (b.goal as { id: string }).id)?.owner === "PLAYER";
    // Exércitos dos reinos só atacam o bando em guerra com ele (ou provocados)
    if (b.kind === "FACTION") return b.provoked || s.factions.some((f) => f.id === b.ownerId && f.atWar) || !b.armyId;
    if (isRaiderKind(b.kind)) return true;
    if (b.kind === "REFUGEES" || b.ownerId === "PLAYER") return false;
    if (b.provoked) return true;
    return s.factions.some((f) => f.id === b.ownerId && f.atWar);
  }

  /** Hostilidade de quem está em campo; quem foi atacado pelo bando é provocado (e o dono fica sabendo). */
  private updateHostility(): void {
    for (const band of this.warbands.bands) {
      if (!band.materialized) continue;
      // Caravana do próprio bando (Marco 14): luta do nosso lado
      if (band.ownerId === "PLAYER") {
        for (const m of band.members) if (!m.friendly) m.setFriendly(true);
        continue;
      }
      if (!band.provoked && band.members.some((m) => m.provoked)) {
        band.provoked = true;
        const store = useGameStore.getState();
        // Caravana atacada: a honra e a relação pesam quando ela cair (o saque é do bando)
        if (band.kind === "CARAVAN") {
          this.pushFeed(`Atacamos ${band.name} (${this.trade.realmOf(band)})! Se ela cair, a carga é nossa — e o nome do bando, sujo.`);
          for (const m of band.members) m.hostile = true;
          continue;
        }
        if (band.kind === "REFUGEES") store.attackRefugees(band.name.replace(/^Refugiados de /, ""));
        else if (band.ownerId && !store.factions.some((f) => f.id === band.ownerId && f.atWar)) {
          store.provokeFaction(band.ownerId, band.kind === "PATROL" ? "uma patrulha" : band.kind === "FACTION" ? "um exército" : "o mensageiro real");
        }
        const realm = this.world.factions.find((f) => f.id === band.ownerId)?.name ?? "reino";
        this.pushFeed(
          `Atacamos ${band.kind === "REFUGEES" ? "refugiados" : band.kind === "PATROL" ? `a patrulha ${ofRealm(realm)}` : `o mensageiro ${ofRealm(realm)}`}!`,
        );
      }
      // Mensageiros e refugiados nunca lutam (fogem); patrulhas lutam em guerra ou provocadas
      const hostile = band.kind !== "COURIER" && band.kind !== "REFUGEES" && this.bandHostile(band);
      for (const m of band.members) m.hostile = hostile;
    }
  }

  /** Patrulhas e mensageiros: cada reino mantém os seus em movimento. */
  private spawnAgents(): void {
    const s = useGameStore.getState();
    for (const f of s.factions) {
      const own = s.settlements.filter((t) => t.owner === f.id);
      const def = this.world.factions.find((x) => x.id === f.id);
      if (own.length === 0 || !def) continue;
      const gateOf = (t: Settlement) => {
        const layout = this.settlementLayer.layoutOf(t.id);
        return layout ? layout.gates[Math.floor(Math.random() * layout.gates.length)].outside : { x: t.x, y: t.y };
      };
      const patrols = this.warbands.bands.filter((b) => b.kind === "PATROL" && b.ownerId === f.id).length;
      const want = Math.min(AGENTS.PATROL_MAX, Math.ceil(own.length / AGENTS.PATROL_PER_SETTLEMENTS));
      // Inverno: patrulhas novas não saem (as que estão na estrada terminam a ronda)
      if (patrols < want && this.season !== "WINTER") {
        this.warbands.spawnBand({
          name: `Patrulha ${ofRealm(def.name)}`,
          kind: "PATROL",
          units: [
            ["SOLDIER", AGENTS.PATROL_SIZE.SOLDIER],
            ["CROSSBOW", AGENTS.PATROL_SIZE.CROSSBOW],
          ],
          origin: gateOf(own[Math.floor(Math.random() * own.length)]),
          ownerId: f.id,
          color: def.color,
        });
      }
      if (own.length >= 2 && !this.warbands.bands.some((b) => b.kind === "COURIER" && b.ownerId === f.id)) {
        const capital = own.find((t) => t.id === def.capitalId) ?? own[0];
        this.warbands.spawnBand({ name: `Mensageiro ${ofRealm(def.name)}`, kind: "COURIER", units: [["COURIER", 1]], origin: gateOf(capital), ownerId: f.id, color: def.color });
      }
    }
  }

  /** Povoado atacado: quem escapou foge pela estrada. */
  private spawnRefugees(t: Settlement): void {
    const layout = this.settlementLayer.layoutOf(t.id);
    const origin = layout ? layout.gates[0].outside : { x: t.x, y: t.y };
    const n = Math.max(4, Math.min(10, Math.round(t.population / 80)));
    this.warbands.spawnBand({ name: `Refugiados de ${t.name}`, kind: "REFUGEES", units: [["CIVILIAN", n]], origin, ownerId: null });
  }

  /** Despachos interceptados: os exércitos do reino em marcha aparecem no mapa. */
  private revealArmiesOf(factionId: string): void {
    const day = useGameStore.getState().day;
    for (const b of this.warbands.bands) {
      if (b.ownerId !== factionId || (b.kind !== "FACTION" && b.kind !== "PATROL")) continue;
      b.lastSeen = { x: b.anchor.x, y: b.anchor.y, day };
      b.spotted = true;
    }
  }

  /** Gente perto da câmera e os sinais do mapa. */
  private updateMapLife(time: number, dt: number): void {
    const s = useGameStore.getState();
    const now = s.day + s.dayProgress;
    const towns: MapLifeContext["towns"] = [];
    for (const t of s.settlements) {
      const layout = this.settlementLayer.layoutOf(t.id);
      if (layout) towns.push({ settlement: t, layout });
    }
    const smoke: MapLifeContext["smoke"] = [];
    const crows: Point[] = s.battlefields.filter((b) => s.day - b.day <= 2);
    for (const t of s.settlements) {
      const raided = t.lastRaidDay !== null && s.day - t.lastRaidDay <= 2;
      if (raided || isCalamityOwner(t.owner)) smoke.push({ x: t.x, y: t.y, strength: 1 });
      else if (t.owner === "RUINED") smoke.push({ x: t.x, y: t.y, strength: 0.45 });
      else if (t.besiegedBy) smoke.push({ x: t.x, y: t.y, strength: 0.7 });
      if (raided) crows.push({ x: t.x, y: t.y - 200 });
    }
    const tracks: MapLifeContext["tracks"] = [];
    // Na lama (primavera, chuva) e na neve os rastros ficam fundos e duram o dobro
    const soft = this.season === "SPRING" || this.season === "WINTER" || this.weather === "RAIN";
    for (const b of this.warbands.bands) {
      for (let i = 1; i < b.trail.length; i++) {
        const p = b.trail[i];
        const q = b.trail[i - 1];
        const deep = soft && this.groundAt(p.x, p.y, "GRASS") < 1;
        tracks.push({ x: p.x, y: p.y, dir: Math.atan2(p.y - q.y, p.x - q.x), age: (now - p.day) / (deep ? 2 : 1) });
      }
    }
    const army: Point[] = [this.commander];
    for (const b of this.battalions) if (!b.isDestroyed) army.push(b.center);
    this.mapLife.update(time, dt, {
      view: this.cameras.main.worldView,
      hour: hourOf(s.dayProgress),
      darkness: Unit.darkness,
      towns,
      roads: this.world.roads,
      canSee: (p) => this.fog.canSee(p),
      threats: this.warbands.bands.filter((b) => this.bandHostile(b)).map((b) => b.anchor),
      army,
      factionColor: (owner) => ownerColor(this.world, s.calamities, owner),
      terrain: Unit.terrain,
      smoke,
      crows,
      tracks,
    });
  }

  /** Pode descansar até o amanhecer? (null = sim; senão, o motivo) */
  private restBlocked(): string | null {
    const store = useGameStore.getState();
    if (this.engagement) return "Em combate";
    if (store.mutiny) return "Motim no acampamento";
    if (this.visibleEnemies().some((e) => distance(e, this.commander) < WORLD.TRAVEL_BLOCK_RADIUS)) return "Inimigos à vista";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Mensageiros fora";
    if (phaseOf(store.dayProgress) === "DAY") return "Ainda é dia";
    return null;
  }

  /**
   * Descansar até o amanhecer: a noite passa de uma vez (rações e salários correm), os bandos
   * marcham, e o descanso é interrompido se algum chegar perto do bando.
   */
  private restUntilDawn(): void {
    const why = this.restBlocked();
    if (why) {
      this.pushFeed(`Não dá para descansar agora: ${why.toLowerCase()}.`);
      this.publishHud();
      return;
    }
    const store = useGameStore.getState();
    const here = { x: this.commander.x, y: this.commander.y };
    const r = this.simulateMarch([here], daysUntilHour(store.dayProgress, TIME.DAWN[1]), WORLD.WARBAND.CAMP_GUARD_RADIUS);
    this.passTime(r.elapsed);
    // Uma noite de sono: no acampamento a tropa acorda inteira; ao relento, só em parte
    const full = daysUntilHour(store.dayProgress, TIME.DAWN[1]) || 1;
    this.restBy((this.inCamp ? FATIGUE.NIGHT_REST.CAMP : FATIGUE.NIGHT_REST.FIELD) * Math.min(1, r.elapsed / full));
    const now = formatHour(useGameStore.getState().dayProgress);
    this.pushFeed(
      r.interceptedBy
        ? `Alarme às ${now}! O ${r.interceptedBy} chegou perto do bando.`
        : this.inCamp
          ? `O bando dormiu no acampamento e acordou com o sol (${now}).`
          : `O bando dormiu ao relento e levantou acampamento ao amanhecer (${now}).`,
    );
    if (this.inCamp && !r.interceptedBy) useGameStore.getState().campTick("REST");
    this.updateVision(this.time.now);
    this.publishHud();
  }

  // --- Vida no acampamento ---

  /** O batalhão descansa no alojamento: segura a posição e a rotina do acampamento assume. */
  private quarter(b: Battalion, index: number, slot: Point): void {
    b.restAt(slot);
    b.restDriver = this.campLife.driverFor(b, index);
    this.quartered.add(b.id);
  }

  /** O batalhão deixa de descansar (sai com o Comandante, viaja, foi derrotado). */
  private unquarter(b: Battalion): void {
    if (!b.restDriver) return;
    b.restDriver = null;
    this.campLife.release(b);
  }

  /** O que o acampamento está vivendo (para a rotina dos soldados): lido do store 2 vezes por segundo. */
  private updateCampLife(time: number, dt: number): void {
    if (time - this.lastCampStateAt > 500) {
      this.lastCampStateAt = time;
      const s = useGameStore.getState();
      const morale = startingMorale(s.hungryDays, s.arrearsWeeks, campMoraleBonus(s.campMood, s.followers)).value;
      const assigned = s.lieutenants.filter((l) => l.battalionId);
      const friends: [string, string][] = [];
      for (let i = 0; i < assigned.length; i++) {
        for (let j = i + 1; j < assigned.length; j++) {
          if (bondOf(s.bonds, assigned[i].id, assigned[j].id) >= FRIEND_AT) friends.push([assigned[i].id, assigned[j].id]);
        }
      }
      const state: CampState = {
        hour: hourOf(s.dayProgress),
        hungry: s.hungryDays > 0 || s.rations < dailyRations(s.battalions, s.followers),
        lowMorale: morale < 60,
        arrears: s.arrearsWeeks > 0,
        rebelId: s.pendingMutiny ? (mutinyLeader(s.battalions)?.id ?? null) : null,
        party: s.lastVictoryDay !== null && s.day - s.lastVictoryDay <= 1 && s.hungryDays === 0,
        friends,
        training: s.training.map((t) => t.battalionId).filter((id) => this.quartered.has(id)),
        // Feridos e doentes na enfermaria (Marco 13), ou um combate de ontem
        wounded: s.day + s.dayProgress - this.lastCombatDay < 1 || s.battalions.some((b) => (b.wounded ?? 0) + (b.sick ?? 0) > 0),
        // Dia do soldo (pago em dia): de manhã, fila diante da tenda do Comandante
        payday: s.day % ECONOMY.PAYDAY_INTERVAL === 0 && s.arrearsWeeks === 0 && hourOf(s.dayProgress) >= 8 && hourOf(s.dayProgress) < 13,
        iron: s.iron > 0,
      };
      this.campLife.setState(state);
      // Treino: o que falta, sobre o Campo de Treino; terminado, o XP entra
      const done = s.finishTraining();
      if (done.length > 0) this.pushFeed(`Treino concluído: ${done.map((id) => s.battalions.find((b) => b.id === id)?.name ?? id).join(", ")}.`);
      const now = s.day + s.dayProgress;
      this.campLife.setTrainingText(
        s.training
          .map((t) => `${s.battalions.find((b) => b.id === t.battalionId)?.name ?? "?"}: ${Math.max(0, t.until - now).toFixed(1).replace(".", ",")} dia`)
          .join(" · ")
          .replace(/^(.+)$/, "Treino — $1"),
      );
    }
    const view = this.cameras.main.worldView;
    const near = distance({ x: view.centerX, y: view.centerY }, this.campArea.campfire) < 1800;
    this.campLife.update(time, dt, near);
  }

  // --- Noite ---

  /** Escuridão, regras da noite (visão, percepção dos inimigos) e as luzes do mundo. */
  private updateNight(progress: number): void {
    const d = darknessAt(progress);
    Unit.darkness = d;
    // Tochas denunciam o bando de longe; no escuro ele passa despercebido
    Enemy.perception = 1 + d * ((this.torches ? TIME.NIGHT_AGGRO_TORCHES : TIME.NIGHT_AGGRO_DARK) - 1);
    this.night.update(this.cameras.main, d, d > 0.01 ? this.nightLights() : []);
  }

  /** Raio de visão do bando em relação ao dia (tochas ajudam a enxergar no escuro). */
  private nightVision(): number {
    return 1 - Unit.darkness * (1 - (this.torches ? TIME.TORCH_VISION : TIME.NIGHT_VISION));
  }

  private nightLights(): Light[] {
    const L = TIME.LIGHT;
    const out: Light[] = [{ x: this.campArea.campfire.x, y: this.campArea.campfire.y, radius: L.CAMPFIRE }];
    if (this.torches) {
      if (this.commander.isAlive) out.push({ x: this.commander.x, y: this.commander.y, radius: L.TORCH });
      for (const b of this.battalions) if (!b.isDestroyed) out.push({ ...b.center, radius: L.BATTALION });
      for (const m of this.messengers) if (m.isAlive) out.push({ x: m.x, y: m.y, radius: L.TORCH * 0.6 });
    }
    const store = useGameStore.getState();
    out.push(...this.settlementLayer.lights);
    for (const p of this.campLife.lights()) out.push({ x: p.x, y: p.y, radius: L.TORCH });
    for (const p of this.mapLife.lanterns()) out.push({ x: p.x, y: p.y, radius: 140 });
    for (const p of this.garrisons.lights()) out.push({ x: p.x, y: p.y, radius: L.TORCH });
    for (const c of store.calamities) if (!c.defeated) out.push({ ...c.lair, radius: L.LAIR });
    return out;
  }

  private setForced(on: boolean): void {
    this.forced = on;
    this.pushFeed(
      on
        ? "Marcha forçada: o dia rende mais caminho, mas a tropa cansa muito mais depressa."
        : "Passo normal de marcha.",
    );
    this.publishHud();
  }

  private setTorches(on: boolean): void {
    this.torches = on;
    this.pushFeed(
      on
        ? "Tochas acesas: o bando enxerga mais longe no escuro, mas é visto de longe."
        : "Tochas apagadas: o bando se esconde na noite (goblins e mortos-vivos enxergam no escuro).",
    );
    this.updateVision(this.time.now);
    this.publishHud();
  }

  /** Emboscada noturna: inimigos que surgem do escuro e já atacam abalam quem é pego de surpresa. */
  private checkNightAmbush(hot: readonly Enemy[], time: number): void {
    const eng = this.engagement;
    if (!eng || Unit.darkness < 0.5) return;
    const sudden = hot.filter((e) => {
      const seen = this.firstSeenAt.get(e);
      return seen === undefined || time - seen < TIME.AMBUSH_WINDOW_MS;
    });
    if (sudden.length === 0 || sudden.length < hot.length / 2) return;
    const caught = this.battalions.filter((b) => !b.isDestroyed && sudden.some((e) => distance(e, b.center) <= WORLD.ENGAGE_RADIUS * 1.5));
    if (caught.length === 0) return;
    for (const b of caught) b.morale = Math.max(0, b.morale - TIME.AMBUSH_MORALE);
    eng.notes.push("Emboscada noturna: o inimigo surgiu do escuro.");
    this.pushFeed(`Emboscada noturna! ${caught.map((b) => b.name).join(", ")} foram pegos de surpresa.`);
  }

  // --- Salvar e carregar ---

  /** Salva no espaço automático (no máximo a cada 15 s, nunca em combate). */
  private autosave(): void {
    if (this.engagement || this.time.now - this.lastAutosaveAt < 15000) return;
    if (useGameStore.getState().saveGame(AUTO_SLOT) === null) this.lastAutosaveAt = this.time.now;
  }

  /** Retrato do campo para o save, ou o motivo de não dar para salvar agora. */
  private captureField(): FieldSave | string {
    if (this.engagement) return "Em combate: não dá para salvar agora.";
    if (this.messengers.some((m) => m.isAlive && !m.available)) return "Aguarde os mensageiros voltarem para salvar.";
    const c = this.commander;
    const enemies: EnemySave[] = this.enemies
      // Guarnições e bichos não vão no save: voltam a aparecer quando o bando chega perto
      .filter((e) => e.isAlive && e.owner?.kind !== "WARBAND" && e.owner?.kind !== "MUTINY" && e.owner?.kind !== "GARRISON" && e.owner?.kind !== "WILDLIFE")
      .map((e) => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp, color: e.bodyColor, owner: e.owner }));
    return {
      commander: { x: c.x, y: c.y, hp: c.hp, facing: c.facing },
      quartered: [...this.quartered],
      battalions: this.battalions.filter((b) => !b.isDestroyed).map((b) => ({ id: b.id, ...b.center, morale: b.morale })),
      scouts: this.scouts.filter((s) => s.isAlive).map((s) => ({ id: s.rider.id, x: s.x, y: s.y, hp: s.hp })),
      messengers: this.messengers.filter((m) => m.isAlive).map((m) => ({ id: m.rider.id, x: m.x, y: m.y })),
      fog: this.fog.exportExplored(),
      warbands: this.warbands.serialize(),
      enemies,
      torches: this.torches,
      wagons: this.wagons.filter((w) => w.isAlive).map((w) => ({ id: w.wagonId, x: w.x, y: w.y, hp: w.hp })),
      fatigue: Object.fromEntries(this.battalions.map((b) => [b.id, b.fatigue])),
      forced: this.forced,
      trade: this.trade.serialize(),
    };
  }

  /** Jogo carregado: põe tudo onde estava (o mundo e o exército já foram criados a partir do store). */
  private restoreField(field: FieldSave | null): void {
    if (!field) return;
    const store = useGameStore.getState();
    const c = this.commander;
    c.x = field.commander.x;
    c.y = field.commander.y;
    c.setFacing(field.commander.facing);
    c.restoreHp(field.commander.hp);
    this.lastCommanderPos = { x: c.x, y: c.y };
    this.inCamp = this.campArea.contains(c);

    // Batalhões: quem descansava continua no alojamento; os outros voltam a seguir o Comandante
    const quartered = new Set(field.quartered);
    for (const b of this.battalions) {
      b.fatigue = field.fatigue?.[b.id] ?? 0;
      this.fatigueById.set(b.id, b.fatigue);
      const saved = field.battalions.find((x) => x.id === b.id);
      if (!saved) continue;
      b.morale = saved.morale;
      if (quartered.has(b.id)) continue;
      this.quartered.delete(b.id);
      this.unquarter(b);
      b.teleportTo(saved);
      b.orderFollow(c);
    }
    this.followKey = "";
    this.campArea.buildQuarters(store, this.awayBattalions());
    for (const s of this.scouts) {
      const saved = field.scouts.find((x) => x.id === s.rider.id);
      if (!saved) continue;
      s.x = saved.x;
      s.y = saved.y;
      s.restoreHp(saved.hp);
    }
    for (const m of this.messengers) {
      const saved = field.messengers.find((x) => x.id === m.rider.id);
      if (!saved) continue;
      m.x = saved.x;
      m.y = saved.y;
    }

    this.fog.importExplored(field.fog);
    this.warbands.restore(field.warbands);
    this.trade.restore(field.trade);

    // Inimigos dos locais (contrato, cerco, covis) com a vida que tinham
    for (const e of this.enemies) {
      if (!e.isAlive || e.owner?.kind === "WARBAND") continue;
      e.unitState = "DEAD";
      e.destroy();
    }
    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.contractEnemies = [];
    for (const saved of field.enemies) {
      const e = this.spawnEnemy(saved.x, saved.y, saved.kind, saved.color);
      e.owner = saved.owner;
      e.restoreHp(saved.hp);
      if (saved.owner?.kind === "CONTRACT") this.contractEnemies.push(e);
      else if (saved.owner?.kind === "CALAMITY" && e.isBoss) {
        const lair = this.calamityObjects.get(saved.owner.id);
        if (lair) lair.boss = e;
      }
    }
    // Um líder de calamidade sem registro no save volta inteiro (nunca é dado por morto)
    for (const [id, lair] of this.calamityObjects) {
      if (lair.boss.isAlive) continue;
      const cal = store.calamities.find((x) => x.id === id);
      if (!cal) continue;
      const [boss] = this.spawnEnemyGroup(
        { x: cal.lair.x, y: cal.lair.y, units: [[cal.kind === "NECROMANCER" ? "NECROMANCER" : "ORC_WARLORD", 1]] },
        { kind: "CALAMITY", id },
      );
      lair.boss = boss;
    }

    this.torches = field.torches;
    this.forced = field.forced ?? false;
    // Carroças onde estavam (no acampamento, estacionadas)
    for (const w of this.wagons) {
      const saved = field.wagons?.find((x) => x.id === w.wagonId);
      if (!saved || this.inCamp) {
        const p = this.wagonSlot(this.wagons.indexOf(w));
        w.x = p.x;
        w.y = p.y;
        continue;
      }
      w.x = saved.x;
      w.y = saved.y;
      w.restoreHp(saved.hp);
    }
    if (store.mutiny) this.armyDirty = true;
    this.cameras.main.centerOn(c.x, c.y);
    this.updateVision(this.time.now);
    this.pushFeed(`Jogo carregado: dia ${store.day}, ${formatHour(store.dayProgress)}.`);
  }

  /** Põe o exército inteiro em marcha atrás do Comandante, num ponto novo do mapa. */
  private placeArmy(at: Point, facing: number): void {
    const c = this.commander;
    c.x = at.x;
    c.y = at.y;
    c.setFacing(facing);
    this.lastCommanderPos = { x: c.x, y: c.y };
    this.walkPath = null;
    // Fora do acampamento por um quadro: se o ponto é dentro dele, a entrada é detectada e a tropa vai aos alojamentos
    // (saindo dele de uma vez — viagem rápida — as carroças carregam antes de partir)
    if (this.inCamp) useGameStore.getState().loadWagons();
    this.inCamp = false;
    const training = new Set(useGameStore.getState().training.map((t) => t.battalionId));
    for (const b of this.battalions) if (!training.has(b.id)) this.unquarter(b);
    for (const id of [...this.quartered]) if (!training.has(id)) this.quartered.delete(id);
    // Comandante dentro de um povoado que barra o exército: a tropa fica no portão
    const shut = this.closedRule("ARMY", c);
    const base = shut ? this.gateWait(shut.id, c) : { point: { x: c.x, y: c.y }, facing };
    const back = (d: number, lateral: number): Point => {
      const o = base.point;
      const f = base.facing;
      const p = { x: o.x - Math.cos(f) * d - Math.sin(f) * lateral, y: o.y - Math.sin(f) * d + Math.cos(f) * lateral };
      return this.armyNav.nearestOpen(p, 600) ?? { x: o.x, y: o.y };
    };
    const alive = this.battalions.filter((b) => !b.isDestroyed && !training.has(b.id));
    alive.forEach((b, i) => {
      if (b.panicking) b.rally();
      b.teleportTo(back(BALANCE.FOLLOW_DISTANCE + Math.floor(i / 2) * 110, (i % 2 === 0 ? -1 : 1) * 70));
      b.orderFollow(c);
    });
    this.followKey = "";
    [...this.scouts, ...this.messengers].forEach((r, i) => {
      if (!r.isAlive) return;
      const p = back(-60 + i * 25, (i % 2 === 0 ? -1 : 1) * 50);
      r.x = p.x;
      r.y = p.y;
    });
    // As carroças vêm no fim da coluna
    this.wagons.forEach((w, i) => {
      if (!w.isAlive) return;
      const p = back(BALANCE.FOLLOW_DISTANCE + Math.ceil(alive.length / 2) * 110 + 90 + Math.floor(i / 2) * 70, (i % 2 === 0 ? -1 : 1) * 36);
      w.x = p.x;
      w.y = p.y;
    });
    this.cameras.main.centerOn(c.x, c.y);
    this.campArea.buildQuarters(useGameStore.getState(), this.awayBattalions());
  }

  /** Retrato para o Mapa do Continente: névoa, exército e bandos avistados (ou a última posição conhecida). */
  private publishSnapshot(time: number): void {
    this.lastSnapshotAt = time;
    const day = useGameStore.getState().day;
    const warbands: WarbandSighting[] = [];
    for (const band of this.warbands.bands) {
      const seen = band.members.filter((m) => m.revealed);
      // As caravanas do bando mandam notícia de onde estão
      if (band.ownerId === "PLAYER") band.lastSeen = { x: band.anchor.x, y: band.anchor.y, day };
      if (seen.length > 0) {
        const c = centroid(seen);
        band.lastSeen = { x: c.x, y: c.y, day };
      }
      if (!band.lastSeen) continue;
      warbands.push({
        id: band.id,
        name: band.name,
        x: band.lastSeen.x,
        y: band.lastSeen.y,
        // Só se conta quem está à vista; da última vez, o tamanho é estimado
        count: seen.length > 0 ? seen.length : bandSize(band),
        visible: seen.length > 0,
        seenDay: band.lastSeen.day,
        heading: seen.length > 0 ? band.goalPoint : null,
        kind: band.kind,
        hostile: this.bandHostile(band),
        own: band.ownerId === "PLAYER",
      });
    }
    useGameStore.getState().setWorldSnapshot({
      cols: this.fog.gridCols,
      rows: this.fog.gridRows,
      cell: this.fog.cellSize,
      fog: this.fog.snapshot(),
      commander: { x: this.commander.x, y: this.commander.y },
      battalions: this.battalions.filter((b) => !b.isDestroyed).map((b) => b.center),
      warbands,
      messengersOut: this.messengers.filter((m) => m.isAlive && !m.available).length,
      calamityLairs: useGameStore
        .getState()
        .calamities.filter((c) => c.revealed && !c.defeated)
        .map((c) => ({ id: c.id, x: c.lair.x, y: c.lair.y, name: c.leader })),
      ships: this.trade.positions().filter((p) => this.fog.canSee(p)),
    });
  }

  /** Bandos e covis à vista: o primeiro avistamento vira notícia no diário. */
  private noteSightings(): void {
    const day = useGameStore.getState().day;
    for (const c of useGameStore.getState().calamities) {
      if (c.revealed || c.defeated || !this.fog.canSee(c.lair)) continue;
      useGameStore.getState().revealCalamity(c.id);
      useGameStore.getState().chronicle(`O covil de ${c.leader} foi encontrado em ${c.region}.`, "bad");
      this.pushFeed(`Encontramos o covil de ${c.leader}!`);
    }
    for (const band of this.warbands.bands) {
      const seen = band.members.filter((m) => m.revealed);
      if (seen.length === 0) continue;
      const c = centroid(seen);
      band.lastSeen = { x: c.x, y: c.y, day };
      if (band.spotted) continue;
      band.spotted = true;
      if (!isRaiderKind(band.kind)) {
        // Patrulhas, mensageiros e refugiados: só uma nota (não são ameaça)
        const what = band.kind === "REFUGEES" ? `${band.name} na estrada, fugindo` : `${band.name} passando`;
        this.pushFeed(`${what} perto de ${this.placeName(c)}.`);
        continue;
      }
      const text = `${band.name} avistado perto de ${this.placeName(c)} (cerca de ${bandSize(band)} combatentes).`;
      this.pushFeed(text);
      useGameStore.getState().chronicle(text, "bad");
    }
  }

  // --- Névoa de guerra e visão ---

  /** Raio de visão de uma fonte conforme o terreno onde está (colina amplia, floresta reduz). */
  private visionAt(p: Point, base: number): number {
    const t = Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS";
    if (t === "HILL") return base * SUPPORT.VISION_HILL_BONUS;
    if (t === "FOREST") return base * SUPPORT.VISION_FOREST_PENALTY;
    return base;
  }

  private visionSources(): VisionSource[] {
    const V = SUPPORT.VISION;
    const sources: VisionSource[] = [];
    // Noite e tempo (nevoeiro, neve, chuva) encurtam a visão
    const night = this.nightVision() * WEATHER.VISION[this.weather];
    const add = (p: Point, base: number) => sources.push({ x: p.x, y: p.y, radius: this.visionAt(p, base) * night });
    if (this.commander.isAlive) add(this.commander, V.COMMANDER);
    for (const b of this.battalions) if (!b.isDestroyed) add(b.center, V.BATTALION);
    for (const s of this.scouts) if (s.isAlive) add(s, V.SCOUT);
    for (const m of this.messengers) if (m.isAlive) add(m, V.MESSENGER);
    // Torres de vigia do acampamento (obra): enxergam longe em volta dele
    if (!this.campArea.packed && useGameStore.getState().campWorks.includes("TOWERS")) {
      for (const t of this.campArea.watchtowers) sources.push({ x: t.x, y: t.y, radius: V.SCOUT * 1.1 * night });
    }
    return sources;
  }

  private updateVision(time: number): void {
    this.lastFogAt = time;
    // Bandos entram na bolha (viram unidades) ou saem dela (voltam a ser dados)
    this.warbands.updateBubble(this.presence());
    this.updateDormancy();
    this.fog.update(this.visionSources(), this.cameras.main.worldView);
    this.updateReveal(this.allAllies(), time);
    this.noteSightings();
  }

  /**
   * Inimigo visível = dentro da visão de alguém (névoa) e, se estiver na floresta,
   * só com um aliado bem perto. Atacar revela por um instante. Quem some deixa um "fantasma".
   */
  private updateReveal(allies: readonly Unit[], time: number): void {
    for (const e of this.enemies) {
      if (e.dormant) {
        // Longe de todos: invisível (e sem custo de visão)
        e.revealed = false;
        e.setVisible(false);
        continue;
      }
      const recentAttack = time - e.lastAttackAt < BALANCE.REVEAL_AFTER_ATTACK_MS;
      const seen = this.fog.canSee(e);
      const forestOk = !e.isInForest || allies.some((a) => distance(a, e) <= BALANCE.FOREST_REVEAL_RANGE);
      const was = e.revealed;
      e.revealed = (seen && forestOk) || recentAttack;
      if (e.revealed && !was) this.firstSeenAt.set(e, time);
      if (e.isAlive) e.setVisible(e.revealed);
      if (e.revealed) this.lastSeen.set(e, { x: e.x, y: e.y, t: time });
    }
    for (const a of allies) a.setAlpha(a.isInForest ? 0.6 : 1);
    this.drawGhosts(time);
  }

  private drawGhosts(time: number): void {
    const g = this.ghostGfx;
    g.clear();
    for (const [e, seen] of this.lastSeen) {
      if (!e.isAlive) {
        this.lastSeen.delete(e);
        continue;
      }
      if (e.revealed || !e.hostile || time - seen.t > SUPPORT.GHOST_MS) continue;
      const s = e.radius;
      g.fillStyle(COLORS.ENEMY, 0.3);
      g.fillRect(seen.x - s, seen.y - s, s * 2, s * 2);
      g.lineStyle(1, COLORS.ENEMY, 0.6);
      g.strokeRect(seen.x - s, seen.y - s, s * 2, s * 2);
    }
  }

  /** Inimigos à vista (só os hostis: patrulhas em paz, refugiados e mensageiros não contam). */
  private visibleEnemies(): Enemy[] {
    return this.enemies.filter((e) => e.revealed && e.hostile);
  }

  // --- Câmera ---

  /** Presa: segue o Comandante. Solta: fica onde está e rola com setas, borda da tela ou botão do meio. */
  private setCameraLocked(locked: boolean): void {
    if (this.cameraLocked === locked) return;
    this.cameraLocked = locked;
    const cam = this.cameras.main;
    if (locked) cam.startFollow(this.commander, true, 0.1, 0.1);
    else cam.stopFollow();
    this.publishHud();
  }

  /** Leva a visão até o Comandante sem prender a câmera. */
  private centerOnCommander(): void {
    this.cameras.main.centerOn(this.commander.x, this.commander.y);
  }

  private updateFreeCamera(dt: number): void {
    if (this.cameraLocked || this.panDrag) return;
    const cam = this.cameras.main;
    const k = this.keys;
    let vx = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
    let vy = (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0);

    // Mouse encostado na borda da tela rola a visão (só com o mouse de fato dentro do jogo)
    const p = this.input.activePointer;
    if (this.pointerInGame) {
      if (p.x <= CAMERA.EDGE_PX) vx -= 1;
      else if (p.x >= this.scale.width - CAMERA.EDGE_PX) vx += 1;
      if (p.y <= CAMERA.EDGE_PX) vy -= 1;
      else if (p.y >= this.scale.height - CAMERA.EDGE_PX) vy += 1;
    }
    if (vx === 0 && vy === 0) return;
    const speed = (CAMERA.PAN_SPEED / cam.zoom) * dt;
    cam.setScroll(cam.scrollX + Math.sign(vx) * speed, cam.scrollY + Math.sign(vy) * speed);
  }

  // --- Raio de comando e mensageiros ---

  /** Dois anéis pontilhados: alcance da voz (forte) e da trombeta (fraco). */
  private drawCommandRing(): void {
    const g = this.commandRing;
    g.clear();
    const ring = (r: number, alpha: number, dashes: number) => {
      g.lineStyle(2, COLORS.COMMAND_RING, alpha);
      for (let i = 0; i < dashes; i += 2) {
        g.beginPath();
        g.arc(0, 0, r, (i / dashes) * Math.PI * 2, ((i + 1) / dashes) * Math.PI * 2);
        g.strokePath();
      }
    };
    ring(SUPPORT.COMMAND_RADIUS, 0.28, 56);
    ring(SUPPORT.TRUMPET_RADIUS, 0.12, 120);
  }

  /** Onda que se expande a partir de quem sinaliza (trombeta, bandeira, grito de guerra). */
  private signalWave(x: number, y: number, color: number, radius: number): void {
    // Redesenha o anel a cada quadro (escalar engrossaria a linha)
    const g = this.add.graphics({ x, y }).setDepth(13);
    const wave = { r: 20, a: 0.9 };
    this.tweens.add({
      targets: wave,
      r: radius,
      a: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, color, wave.a);
        g.strokeCircle(0, 0, wave.r);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** O batalhão enxerga o estandarte do Comandante? (alcance e sem floresta no caminho de nenhum dos dois) */
  private seesBanner(p: Point): boolean {
    if (!this.commander.isAlive || this.commander.isInForest) return false;
    if ((Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS") === "FOREST") return false;
    return distance(p, this.commander) <= SUPPORT.BANNER_RADIUS;
  }

  /** Por qual meio uma ordem deste tipo chega ao destinatário sem mensageiro (ou null). */
  private reachOf(r: OrderRecipient, channel: OrderChannel): Reach | null {
    const p = this.recipientPosition(r);
    const d = distance(p, this.commander);
    if (d <= SUPPORT.COMMAND_RADIUS) return "VOICE";
    if ((channel === "BASIC" || channel === "BASIC_VISUAL") && d <= SUPPORT.TRUMPET_RADIUS) return "TRUMPET";
    if ((channel === "VISUAL" || channel === "BASIC_VISUAL") && this.seesBanner(p)) return "BANNER";
    return null;
  }

  private recipientPosition(r: OrderRecipient): Point {
    return r instanceof Battalion ? r.center : { x: r.x, y: r.y };
  }

  private recipientName(r: OrderRecipient): string {
    return r instanceof Battalion ? r.name : `batedor ${r.rider.name}`;
  }

  /** Dentro do alcance da voz qualquer ordem é instantânea. */
  private inCommand(r: OrderRecipient): boolean {
    return distance(this.recipientPosition(r), this.commander) <= SUPPORT.COMMAND_RADIUS;
  }

  /** Toque de trombeta: onda visual + a melodia daquela ordem (uma vez por ordem em grupo). */
  private trumpetFx(order: string): void {
    if (this.time.now - this.lastTrumpetFx < 300) return;
    this.lastTrumpetFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PENNANT, 260);
    sfx.trumpet(order, this.commander);
  }

  private bannerFx(): void {
    if (this.time.now - this.lastBannerFx < 300) return;
    this.lastBannerFx = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.LIEUTENANT, 160);
    this.commander.floatText("⚑ sinal", "#dfe3ee");
    sfx.banner(this.commander);
  }

  /**
   * Grito de guerra: o nome do bando ecoa. Batalhões próximos ganham moral;
   * os em pânico bem perto do Comandante se reagrupam. Recarga de 30 s.
   */
  private warCry(): void {
    const W = SUPPORT.WAR_CRY;
    if (this.ended || !this.commander.isAlive || this.time.now - this.warCryAt < W.COOLDOWN_MS) return;
    this.warCryAt = this.time.now;
    this.signalWave(this.commander.x, this.commander.y, COLORS.PANIC, W.RADIUS);
    this.commander.floatText("Pela Ascensão!", "#ffb4a8");
    sfx.warCry(this.commander);
    const heard: string[] = [];
    for (const b of this.battalions) {
      if (b.isDestroyed) continue;
      const d = distance(b.center, this.commander);
      if (d > W.RADIUS) continue;
      b.morale = Math.min(BALANCE.MORALE.MAX, b.morale + W.MORALE);
      if (b.panicking && d <= W.RALLY_RADIUS) b.rally();
      heard.push(b.name);
    }
    this.pushFeed(heard.length ? `Grito de guerra! ${heard.join(", ")} recobram o ânimo.` : "Grito de guerra! Ninguém perto o bastante para ouvir.");
    this.publishHud();
  }

  /** Toques de trombeta pré-combinados, para os selecionados (ou todos). */
  private trumpetCall(call: TrumpetCall, targets: readonly Battalion[]): void {
    // O trombeteiro do Comandante sempre toca (mesmo que todos estejam ao alcance da voz)
    this.trumpetFx(TRUMPET_LABEL[call]);
    this.withOrderBatch(() => this.soundTrumpetCall(call, targets));
  }

  private soundTrumpetCall(call: TrumpetCall, targets: readonly Battalion[]): void {
    const label = TRUMPET_LABEL[call];
    for (const b of targets) {
      if (b.isDestroyed) continue;
      const apply = (): void => {
        switch (call) {
          case "ADVANCE": {
            const p = { x: b.center.x + Math.cos(b.facing) * SUPPORT.ADVANCE_DISTANCE, y: b.center.y + Math.sin(b.facing) * SUPPORT.ADVANCE_DISTANCE };
            b.orderMove(p, b.facing);
            break;
          }
          case "HALT":
            b.holdPosition();
            break;
          case "CHARGE":
            b.orderCharge(this.visibleEnemies());
            break;
          case "RETREAT": {
            const c = this.commander;
            b.orderMove({ x: c.x - Math.cos(c.facing) * 120, y: c.y - Math.sin(c.facing) * 120 }, c.facing);
            break;
          }
          case "RALLY":
            b.orderFollow(this.commander);
            break;
        }
      };
      this.dispatch(b, label, apply, call === "RALLY" ? "BASIC_VISUAL" : "BASIC");
    }
  }

  /**
   * Envia uma ordem pelo meio que a época permitiria:
   * - VOZ (raio de comando): qualquer ordem, na hora;
   * - TROMBETA: só toques básicos combinados (Avançar, Alto, Carregar, Recuar, Reunir);
   *   no meio do corpo a corpo o batalhão pode não ouvir;
   * - ESTANDARTE/BANDEIRAS: sinais visuais (formações, seguir), com linha de visão;
   * - MENSAGEIRO: ordens complexas (ponto, alvo, foco, arranjo) ou quando nada mais alcança.
   *   Ele cavalga até ficar ao alcance do próprio sinal — não precisa encostar na tropa.
   */
  private dispatch(recipient: OrderRecipient, order: string, apply: () => void, channel: OrderChannel = "COMPLEX"): boolean {
    const name = this.recipientName(recipient);
    const reach = this.reachOf(recipient, channel);
    if (reach === "VOICE") {
      apply();
      return true;
    }
    if (reach === "TRUMPET") {
      this.trumpetFx(order);
      if (recipient instanceof Battalion && recipient.status === "ENGAGED" && Math.random() < SUPPORT.TRUMPET_MISS_IN_MELEE) {
        this.pushFeed(`${name} não ouviu o toque "${order}" no meio do combate.`);
        return false;
      }
      apply();
      this.pushFeed(`Trombeta: "${order}" — ${name} obedece.`);
      return true;
    }
    if (reach === "BANNER") {
      this.bannerFx();
      apply();
      this.pushFeed(`Bandeiras: "${order}" — ${name} viu o sinal.`);
      return true;
    }

    // Precisa de mensageiro: numa ordem em grupo, entra no lote (um mensageiro por grupo próximo)
    if (recipient instanceof Battalion) recipient.pendingOrder = order;
    const stop = this.missionStop(recipient, apply);
    if (this.pendingBatch) {
      this.pendingBatch.push({ order, stop, recipient });
      return true;
    }
    return this.sendMessengers(order, [{ order, stop, recipient }]);
  }

  /** Destinatário de uma missão: na entrega, a autoridade do mensageiro age antes da ordem. */
  private missionStop(recipient: OrderRecipient, apply: () => void): MissionStop {
    return {
      recipient: this.recipientName(recipient),
      position: () => this.recipientPosition(recipient),
      gone: () => (recipient instanceof Battalion ? recipient.isDestroyed : !recipient.isAlive),
      deliver: (m) => {
        if (recipient instanceof Battalion) {
          recipient.pendingOrder = null;
          if (recipient.panicking && m.canRally) {
            recipient.rally();
            this.pushFeed(`${m.rider.name} reagrupou ${recipient.name} em pânico!`);
          }
          recipient.morale = Math.min(BALANCE.MORALE.MAX, recipient.morale + m.authority);
        }
        apply();
      },
    };
  }

  /**
   * Executa `fn` agrupando as entregas por mensageiro: uma ordem dada a vários batalhões
   * sai com UM mensageiro para cada grupo de batalhões próximos (não um por batalhão).
   */
  private withOrderBatch<T>(fn: () => T): T {
    if (this.pendingBatch) return fn(); // já dentro de um lote
    this.pendingBatch = [];
    try {
      return fn();
    } finally {
      const batch = this.pendingBatch;
      this.pendingBatch = null;
      const byOrder = new Map<string, PendingDelivery[]>();
      for (const p of batch) byOrder.set(p.order, [...(byOrder.get(p.order) ?? []), p]);
      for (const [order, deliveries] of byOrder) this.sendMessengers(order, deliveries);
    }
  }

  /**
   * Agrupa os destinatários por proximidade e manda um mensageiro por grupo.
   * Faltando mensageiros, os grupos que sobram entram na rota de quem já está saindo
   * com essa ordem; sem nenhum mensageiro livre, a ordem não sai.
   */
  private sendMessengers(order: string, deliveries: PendingDelivery[]): boolean {
    const groups: PendingDelivery[][] = [];
    for (const d of deliveries) {
      const p = d.stop.position();
      const group = groups.find((g) => g.some((x) => distance(x.stop.position(), p) <= SUPPORT.MESSENGER.GROUP_RADIUS));
      if (group) group.push(d);
      else groups.push([d]);
    }

    const used: Messenger[] = [];
    let sent = false;
    for (const group of groups) {
      const names = group.map((d) => d.stop.recipient).join(", ");
      const messenger = this.messengers.find((m) => m.available);
      if (messenger) {
        messenger.send({ order, stops: group.map((d) => d.stop) });
        used.push(messenger);
        sent = true;
        this.pushFeed(`${messenger.rider.name} partiu com "${order}" para ${names}.`);
      } else if (used.length > 0) {
        const carrier = used[used.length - 1];
        carrier.addStops(group.map((d) => d.stop));
        sent = true;
        this.pushFeed(`Sem outro mensageiro: ${carrier.rider.name} também levará "${order}" a ${names}.`);
      } else {
        for (const d of group) if (d.recipient instanceof Battalion) d.recipient.pendingOrder = null;
        this.pushFeed(`Sem mensageiro livre: "${order}" não chegou a ${names}.`);
      }
    }
    return sent;
  }

  private updateMessengers(dt: number): void {
    for (const m of this.messengers) {
      const event = m.think(dt, this.commander);
      if (event?.type === "DELIVERED") {
        // O mensageiro sinaliza de longe: trombeta e bandeira até onde a tropa vê e ouve
        this.signalWave(event.at.x, event.at.y, COLORS.PENNANT, m.signalRange);
        sfx.messengerHorn(event.at);
        const more = event.remaining > 0 ? ` Segue para mais ${event.remaining}.` : "";
        this.pushFeed(`${m.rider.name} sinalizou "${event.order}" a ${event.recipients.join(" e ")}.${more}`);
      }
      if (event?.type === "ABORTED") this.pushFeed(`${m.rider.name} voltou: os destinatários de "${event.order}" não existem mais.`);
    }
  }

  /** Registra batedores e mensageiros abatidos (ordens em mãos se perdem). */
  private collectSupportLosses(): void {
    for (const m of this.messengers) {
      if (m.isAlive || this.deadMessengerIds.includes(m.rider.id)) continue;
      this.deadMessengerIds.push(m.rider.id);
      if (m.mission) {
        const names = m.mission.stops.map((s) => s.recipient);
        this.pushFeed(`${m.rider.name} foi interceptado! A ordem "${m.mission.order}" para ${names.join(", ")} se perdeu.`);
        for (const b of this.battalions) if (names.includes(b.name)) b.pendingOrder = null;
        m.mission = null;
      } else {
        this.pushFeed(`O mensageiro ${m.rider.name} caiu.`);
      }
    }
    for (const s of this.scouts) {
      if (s.isAlive || this.deadScoutIds.includes(s.rider.id)) continue;
      this.deadScoutIds.push(s.rider.id);
      this.pushFeed(`O batedor ${s.rider.name} foi abatido.`);
    }
  }

  /** Linha pontilhada de cada mensageiro em missão até cada destinatário que falta. */
  private drawMissions(): void {
    const g = this.missionGfx;
    g.clear();
    for (const m of this.messengers) {
      if (!m.isAlive || m.riderState !== "OUTBOUND" || !m.mission) continue;
      const current = m.currentStop();
      for (const stop of m.mission.stops) {
        const p = stop.position();
        const d = distance(m, p);
        const steps = Math.floor(d / 18);
        // Destino atual em destaque; os seguintes, mais fracos
        g.fillStyle(COLORS.PENNANT, stop === current ? 0.8 : 0.35);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          g.fillCircle(m.x + (p.x - m.x) * t, m.y + (p.y - m.y) * t, 2);
        }
      }
    }
  }

  private pushFeed(line: string): void {
    this.feed = [...this.feed, line].slice(-FEED_SIZE);
  }

  // --- Cortejo ---

  /**
   * Organiza o cortejo atrás do Comandante com os batalhões que estão seguindo,
   * conforme o arranjo de grupo escolhido (ex.: arqueiros na fileira de trás).
   * Só recalcula quando muda quem segue, a formação de alguém ou o arranjo,
   * para não ficar trocando de lugar.
   */
  private assignFollowSlots(): void {
    const followers = this.battalions.filter((b) => b.isFollowing);
    const arrangement = useGameStore.getState().groupArrangement;
    const key = arrangement + "#" + followers.map((b) => `${b.id}:${b.formation}:${b.soldiers.length}`).join("|");
    if (key === this.followKey) return;
    this.followKey = key;

    for (const slot of layoutGroup(followers, arrangement, this.commander.facing, this.commander)) {
      slot.battalion.followSlot = { lateral: slot.lateral, back: slot.back + BALANCE.FOLLOW_DISTANCE };
    }
  }

  // --- Entrada ---

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Teclado indisponível");
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,F,Q,ESC,ONE,TWO,THREE,FOUR,C,H,UP,DOWN,LEFT,RIGHT,R,E,TAB,T,V,G") as BattleKeys;

    // V: marcha forçada; G: forragear (Marco 13)
    this.keys.V.on("down", () => {
      if (!this.ended) this.setForced(!this.forced);
    });
    this.keys.G.on("down", () => {
      if (!this.ended) this.forage();
    });

    // E: interagir com o local mais próximo (tenda, alojamento, mercado de uma cidade...);
    // estruturas com lado de dentro (Marco 14): entrar
    this.keys.E.on("down", () => {
      const store = useGameStore.getState();
      if (store.worldMapOpen || store.battleReport || store.interior) return;
      if (store.campPanel) store.setCampPanel(null);
      else if (this.nearestSpot?.enter) this.enterBuilding(this.nearestSpot);
      else if (this.nearestSpot) store.setCampPanel(this.nearestSpot.panel);
    });
    // Tab: Mapa do Continente (viagem rápida e observação de exércitos)
    this.keys.TAB.on("down", () => {
      const store = useGameStore.getState();
      if (store.battleReport) return;
      store.setCampPanel(null);
      store.setWorldMapOpen(!store.worldMapOpen);
    });

    // T: acender ou apagar as tochas do bando
    this.keys.T.on("down", () => {
      if (!this.ended) this.setTorches(!this.torches);
    });

    this.input.mouse?.disableContextMenu();
    this.selectionBox = this.add.graphics().setDepth(20);

    // --- Câmera: C prende/solta, H centraliza, roda = zoom, botão do meio arrasta ---
    this.keys.C.on("down", () => this.setCameraLocked(!this.cameraLocked));
    this.keys.H.on("down", () => this.centerOnCommander());
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const zoom = Phaser.Math.Clamp(cam.zoom - Math.sign(dy) * CAMERA.ZOOM_STEP, CAMERA.MIN_ZOOM, CAMERA.MAX_ZOOM);
      cam.setZoom(Math.round(zoom * 100) / 100);
      this.publishHud();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.ended) return;
      useGameStore.getState().setContextMenu(null);

      if (pointer.middleButtonDown()) {
        // Arrastar a visão solta a câmera
        this.setCameraLocked(false);
        const cam = this.cameras.main;
        this.panDrag = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      } else if (pointer.rightButtonDown()) {
        this.withOrderBatch(() => this.handleRightClick(pointer));
      } else if (pointer.leftButtonDown()) {
        this.dragStart = { x: pointer.worldX, y: pointer.worldY };
      }
    });

    this.input.on("gameout", () => {
      this.pointerInGame = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.pointerInGame = true;
      if (this.panDrag && pointer.middleButtonDown()) {
        const cam = this.cameras.main;
        cam.setScroll(
          this.panDrag.scrollX - (pointer.x - this.panDrag.x) / cam.zoom,
          this.panDrag.scrollY - (pointer.y - this.panDrag.y) / cam.zoom,
        );
        return;
      }
      if (!this.dragStart || !pointer.leftButtonDown()) return;
      this.drawSelectionBox(this.selectionRect(pointer));
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1) this.panDrag = null;
      if (!this.dragStart || pointer.button !== 0) return;
      const rect = this.selectionRect(pointer);
      const additive = isShiftHeld(pointer);
      this.dragStart = null;
      this.selectionBox.clear();
      if (this.ended) return;

      if (rect.width < DRAG_THRESHOLD && rect.height < DRAG_THRESHOLD) {
        const scout = this.scoutAt(pointer.worldX, pointer.worldY);
        const hit = scout ? null : this.battalionAt(pointer.worldX, pointer.worldY);
        const point = { x: pointer.worldX, y: pointer.worldY };
        // Clique num local (tenda, alojamento, praça de uma cidade): o Comandante vai até lá e abre
        const spot = scout || hit ? null : this.spots().find((it) => it.bounds.contains(point.x, point.y));
        if (spot || (!scout && !hit && this.inCamp && this.campArea.contains(point))) {
          this.walkTo(spot ?? null, point);
          if (!additive) this.select([], [], false);
        } else if (additive && (scout || hit)) {
          if (scout) scout.selected = !scout.selected;
          if (hit) hit.selected = !hit.selected;
        } else {
          this.select(hit ? [hit] : [], scout ? [scout] : [], additive);
        }
      } else {
        this.select(
          this.battalions.filter((b) => b.intersectsRect(rect)),
          this.scouts.filter((s) => s.isAlive && rect.contains(s.x, s.y)),
          additive,
        );
      }
      this.publishHud();
    });

    this.keys.F.on("down", () => {
      if (this.ended) return;
      this.withOrderBatch(() => {
        for (const b of this.commandTargets()) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
      });
    });

    this.keys.Q.on("down", () => {
      if (this.ended) return;
      const near = this.battalions.filter(
        (b) => !b.isDestroyed && distance(b.center, this.commander) <= BALANCE.NEARBY_SELECT_RADIUS,
      );
      this.select(near, [], false);
      this.publishHud();
    });

    this.keys.ESC.on("down", () => {
      const store = useGameStore.getState();
      if (store.worldMapOpen) store.setWorldMapOpen(false);
      if (store.campPanel) store.setCampPanel(null);
      store.setContextMenu(null);
      this.select([], [], false);
      this.publishHud();
    });

    this.keys.R.on("down", () => this.warCry());

    // 1–4: formação dos selecionados (cada tipo de tropa ignora as que não sabe fazer)
    for (const [key, formation] of FORMATION_KEYS) {
      this.keys[key].on("down", () => {
        if (this.ended) return;
        this.withOrderBatch(() => {
          for (const b of this.commandTargets()) {
            if (b.canUseFormation(formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[formation].label}`, () => b.setFormation(formation), "VISUAL");
            }
          }
        });
        this.publishHud();
      });
    }
  }

  /**
   * Botão direito:
   * - sobre um batalhão aliado → abre o menu de contexto (React);
   * - sobre um inimigo → batalhões selecionados atacam;
   * - no chão → batalhões selecionados marcham e batedores selecionados exploram o ponto.
   * Ordens para quem está fora do raio de comando vão por mensageiro.
   */
  private handleRightClick(pointer: Phaser.Input.Pointer): void {
    const { worldX: x, worldY: y } = pointer;

    const selected = this.battalions.filter((b) => b.selected);
    const selectedScouts = this.scouts.filter((s) => s.selected && s.isAlive);

    // Sobre um batalhão: menu do grupo selecionado (se ele faz parte de uma seleção múltipla) ou só dele
    const own = this.battalionAt(x, y);
    if (own) {
      const ev = pointer.event as MouseEvent;
      const ids = own.selected && selected.length > 1 ? selected.map((b) => b.id) : [own.id];
      useGameStore.getState().setContextMenu({ battalionIds: ids, x: ev.clientX, y: ev.clientY });
      return;
    }

    if (selected.length === 0 && selectedScouts.length === 0) return;

    const point = { x, y };
    let accepted = false;
    for (const s of selectedScouts) {
      accepted = this.dispatch(s, "Explorar", () => s.setMode("EXPLORE", point)) || accepted;
    }

    const enemy = nearest(
      this.enemies.filter((e) => e.isAlive && e.revealed && !e.friendly),
      point,
      40,
    );
    let marker = point;
    if (enemy) {
      for (const b of selected) accepted = this.dispatch(b, "Atacar", () => b.orderAttack(enemy)) || accepted;
    } else if (selected.length > 0) {
      // Povoado que barra o exército: a tropa vai até o portão e espera ali
      const shut = this.closedRule("ARMY", point);
      if (shut) {
        const wait = this.gateWait(shut.id, point);
        marker = wait.point;
        this.pushFeed(`Os guardas de ${shut.name} não deixam o exército entrar: os batalhões esperam no portão.`);
        accepted = this.groupMove(selected, wait.point, wait.facing) || accepted;
      } else {
        accepted = this.groupMove(selected, point) || accepted;
      }
    }
    if (accepted) this.showOrderMarker(marker.x, marker.y, enemy ? COLORS.ORDER_ATTACK : COLORS.ORDER_MOVE);
  }

  /**
   * Marcha em grupo: os batalhões se dispõem conforme o arranjo escolhido
   * (fileira da frente centrada no ponto clicado, demais fileiras atrás),
   * todos virados para a mesma direção e sem cruzar o caminho um do outro.
   */
  private groupMove(group: readonly Battalion[], target: Point, facing?: number): boolean {
    const movable = group.filter((b) => !b.isDestroyed);
    if (movable.length === 0) return false;
    const origin = centroid(movable.map((b) => b.center));
    const dir = facing ?? angleTo(origin, target);
    if (movable.length === 1) {
      const b = movable[0];
      return this.dispatch(b, "Marchar", () => b.orderMove(target, dir));
    }

    const fx = Math.cos(dir);
    const fy = Math.sin(dir);
    const arrangement = useGameStore.getState().groupArrangement;
    let sent = false;
    for (const { battalion, lateral, back } of layoutGroup(movable, arrangement, dir, origin)) {
      const p = { x: target.x - fx * back - fy * lateral, y: target.y - fy * back + fx * lateral };
      sent = this.dispatch(battalion, "Marchar", () => battalion.orderMove(p, dir)) || sent;
    }
    return sent;
  }

  /** Reorganiza o grupo no lugar onde já está (após trocar o arranjo), mantendo a direção da frente. */
  private regroupInPlace(group: readonly Battalion[]): void {
    const movable = group.filter((b) => !b.panicking && !b.isDestroyed && !b.isFollowing);
    if (movable.length < 2) return;
    // Direção média das frentes atuais
    const sx = movable.reduce((s, b) => s + Math.cos(b.facing), 0);
    const sy = movable.reduce((s, b) => s + Math.sin(b.facing), 0);
    const dir = Math.atan2(sy, sx);
    const origin = centroid(movable.map((b) => b.center));
    // Centraliza o grupo inteiro (não só a fileira da frente) onde ele já está
    const slots = layoutGroup(movable, useGameStore.getState().groupArrangement, dir, origin);
    const meanBack = slots.reduce((s, x) => s + x.back, 0) / slots.length;
    this.groupMove(movable, { x: origin.x + Math.cos(dir) * meanBack, y: origin.y + Math.sin(dir) * meanBack }, dir);
  }

  /** Aplica os comandos enviados pela UI React (menu de contexto, cards do HUD). */
  private processUiCommands(): void {
    const commands = useGameStore.getState().drainBattleCommands();
    if (commands.length === 0) return;
    // Cada comando da UI é UMA ordem: batalhões próximos dividem o mesmo mensageiro
    for (const cmd of commands) this.withOrderBatch(() => this.applyUiCommand(cmd));
    this.publishHud();
  }

  private applyUiCommand(cmd: BattleCommand): void {
    {
      const picked = this.battalions.filter((b) => cmd.ids.includes(b.id) && !b.isDestroyed);

      switch (cmd.type) {
        case "SELECT":
          if (cmd.additive && picked.every((b) => b.selected)) for (const b of picked) b.selected = false;
          else this.select(picked, [], cmd.additive);
          break;
        case "SELECT_SCOUT": {
          const scouts = this.scouts.filter((s) => cmd.ids.includes(s.rider.id) && s.isAlive);
          if (cmd.additive && scouts.every((s) => s.selected)) for (const s of scouts) s.selected = false;
          else this.select([], scouts, cmd.additive);
          break;
        }
        case "CAMERA":
          if (cmd.action === "TOGGLE") this.setCameraLocked(!this.cameraLocked);
          else this.centerOnCommander();
          break;
        case "TRUMPET": {
          // Sem seleção, o toque vale para todo o exército
          const targets = picked.length > 0 ? picked : this.battalions.filter((b) => !b.isDestroyed);
          this.trumpetCall(cmd.call, targets);
          break;
        }
        case "WAR_CRY":
          this.warCry();
          break;
        case "TRAVEL":
          this.fastTravel({ x: cmd.x, y: cmd.y });
          break;
        case "TORCHES":
          this.setTorches(!this.torches);
          break;
        case "REST":
          this.restUntilDawn();
          break;
        case "FORCED_MARCH":
          this.setForced(!this.forced);
          break;
        case "FORAGE":
          this.forage();
          break;
        case "PACK_CAMP":
          this.packCamp();
          break;
        case "PITCH_CAMP":
          this.pitchCamp();
          break;
        case "FERRY":
          this.crossFerry(cmd.ferryId);
          break;
        case "WAIT_TRAINING": {
          const s = useGameStore.getState();
          const left = Math.max(0, ...s.training.map((t) => t.until - (s.day + s.dayProgress)));
          if (this.engagement || s.mutiny || left <= 0) break;
          this.passTime(left + 0.001);
          const done = useGameStore.getState().finishTraining();
          if (done.length > 0) this.pushFeed(`Treino concluído após ${left.toFixed(1).replace(".", ",")} dia(s).`);
          break;
        }
        case "FOUND": {
          const why = this.foundBlocked();
          if (why) this.pushFeed(`Não dá para fundar uma vila aqui: ${why.toLowerCase()}.`);
          else if (useGameStore.getState().foundSettlement(this.foundSite().x, this.foundSite().y)) {
            this.pushFeed("Uma nova aldeia nasce sob a bandeira do bando!");
          }
          break;
        }
        case "SCOUT_MODE":
          for (const s of this.scouts.filter((x) => cmd.ids.includes(x.rider.id) && x.isAlive)) {
            this.dispatch(s, SCOUT_MODE_LABEL[cmd.mode], () => s.setMode(cmd.mode), "BASIC");
          }
          break;
        case "FOLLOW":
          for (const b of picked) this.dispatch(b, "Reunir ao estandarte", () => b.orderFollow(this.commander), "BASIC_VISUAL");
          break;
        case "HOLD":
          for (const b of picked) this.dispatch(b, "Alto", () => b.holdPosition(), "BASIC");
          break;
        case "FORMATION":
          for (const b of picked) {
            if (b.canUseFormation(cmd.formation)) {
              this.dispatch(b, `Formação: ${FORMATIONS[cmd.formation].label}`, () => b.setFormation(cmd.formation), "VISUAL");
            }
          }
          break;
        case "CHARGE":
          for (const b of picked) {
            this.dispatch(
              b,
              "Carregar",
              () => {
                if (b.orderCharge(this.visibleEnemies()) && b.order.type === "ATTACK") {
                  this.showOrderMarker(b.order.target.x, b.order.target.y, COLORS.ORDER_ATTACK);
                }
              },
              "BASIC",
            );
          }
          break;
        case "FOCUS": {
          // Todos no mesmo alvo: o inimigo visível mais próximo do centro do grupo
          const target = nearest(this.visibleEnemies(), centroid(picked.map((b) => b.center)));
          if (!target) break;
          let accepted = false;
          for (const b of picked) accepted = this.dispatch(b, "Foco no alvo", () => b.orderAttack(target)) || accepted;
          if (accepted) this.showOrderMarker(target.x, target.y, COLORS.ORDER_ATTACK);
          break;
        }
        case "ARRANGEMENT":
          useGameStore.getState().setGroupArrangement(cmd.arrangement);
          this.regroupInPlace(picked); // quem segue o Comandante se reorganiza via assignFollowSlots
          break;
      }
    }
  }

  private select(battalions: readonly Battalion[], scouts: readonly Scout[], additive: boolean): void {
    if (!additive) {
      for (const b of this.battalions) b.selected = false;
      for (const s of this.scouts) s.selected = false;
    }
    for (const b of battalions) if (!b.isDestroyed) b.selected = true;
    for (const s of scouts) if (s.isAlive) s.selected = true;
  }

  /** Selecionados; sem seleção, todos (atalho de teclado). */
  private commandTargets(): Battalion[] {
    const selected = this.battalions.filter((b) => b.selected);
    return selected.length > 0 ? selected : this.battalions;
  }

  private battalionAt(x: number, y: number): Battalion | null {
    return this.battalions.find((b) => !b.isDestroyed && b.containsPoint({ x, y })) ?? null;
  }

  private scoutAt(x: number, y: number): Scout | null {
    return this.scouts.find((s) => s.isAlive && distance(s, { x, y }) <= s.radius + 10) ?? null;
  }

  private selectionRect(pointer: Phaser.Input.Pointer): Phaser.Geom.Rectangle {
    const start = this.dragStart ?? { x: pointer.worldX, y: pointer.worldY };
    return new Phaser.Geom.Rectangle(
      Math.min(start.x, pointer.worldX),
      Math.min(start.y, pointer.worldY),
      Math.abs(pointer.worldX - start.x),
      Math.abs(pointer.worldY - start.y),
    );
  }

  private drawSelectionBox(rect: Phaser.Geom.Rectangle): void {
    const g = this.selectionBox;
    g.clear();
    g.fillStyle(COLORS.SELECTION, 0.12);
    g.fillRectShape(rect);
    g.lineStyle(1, COLORS.SELECTION, 0.9);
    g.strokeRectShape(rect);
  }

  private showOrderMarker(x: number, y: number, color: number): void {
    const marker = this.add.graphics({ x, y }).setDepth(4);
    marker.lineStyle(2, color, 1);
    marker.strokeCircle(0, 0, 14);
    marker.lineBetween(-6, 0, 6, 0);
    marker.lineBetween(0, -6, 0, 6);
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scale: 1.6,
      duration: 450,
      onComplete: () => marker.destroy(),
    });
  }

  // --- HUD e fim de batalha ---

  /** Baixas e entregas ainda não informadas ao store (cada relatório leva só as novas). */
  private supportReport(): SupportReport {
    return {
      deadScoutIds: this.deadScoutIds.filter((id) => !this.reportedDead.has(id)),
      deadMessengerIds: this.deadMessengerIds.filter((id) => !this.reportedDead.has(id)),
      deliveries: Object.fromEntries(this.messengers.map((m) => [m.rider.id, m.deliveries])),
    };
  }

  private publishHud(): void {
    useGameStore.getState().setBattleHud({
      commanderHp: this.commander.hp,
      commanderMaxHp: this.commander.maxHp,
      battalions: this.battalions.map((b) => ({
        id: b.id,
        name: b.name,
        troopType: b.troopType,
        formation: b.formation,
        terrain: Unit.terrain?.typeAt(b.center.x, b.center.y) ?? "GRASS",
        level: b.level,
        kills: b.kills,
        lieutenant: b.lieutenant ? { name: b.lieutenant.name, alive: b.lieutenantAlive, kills: b.lieutenantKills } : null,
        alive: b.aliveCount,
        max: b.startingCount,
        morale: Math.round(b.morale),
        status: b.status,
        selected: b.selected,
        inCommand: !b.isDestroyed && this.inCommand(b),
        reach: b.isDestroyed ? "NONE" : (this.reachOf(b, "BASIC_VISUAL") ?? "NONE"),
        seesBanner: !b.isDestroyed && this.seesBanner(b.center),
        pendingOrder: b.pendingOrder,
      })),
      scouts: this.scouts.map((s) => ({
        id: s.rider.id,
        name: s.rider.name,
        hp: Math.ceil(s.hp),
        maxHp: s.maxHp,
        mode: s.mode,
        alive: s.isAlive,
        selected: s.selected,
        fleeing: s.unitState === "FLEEING",
      })),
      messengers: this.messengers.map((m) => ({
        id: m.rider.id,
        name: m.rider.name,
        level: m.rider.level,
        state: m.isAlive ? m.riderState : "DEAD",
      })),
      feed: this.feed,
      support: this.supportReport(),
      camera: { locked: this.cameraLocked, zoom: this.cameras.main.zoom },
      warCryIn: Math.max(0, Math.ceil((SUPPORT.WAR_CRY.COOLDOWN_MS - (this.time.now - this.warCryAt)) / 1000)),
      bannerFaltering: this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP,
      enemiesInSight: this.visibleEnemies().length,
      engaged: this.engagement !== null,
      inCamp: this.inCamp,
      region: this.placeName(this.commander),
      foundBlocked: this.foundBlocked(),
      torches: this.torches,
      restBlocked: this.restBlocked(),
      weather: this.weather,
      forecast: this.forecast(),
      forced: this.forced,
      forageBlocked: this.forageBlocked(),
      fatigue: Object.fromEntries(this.battalions.map((b) => [b.id, Math.round(b.fatigue)])),
      wagonsAlive: this.wagons.filter((w) => w.isAlive).length,
      pitchBlocked: this.pitchBlocked(),
      // Carroças perto do Comandante: no acampamento elas estão no pátio; em campo, a até um tanto dele
      wagonsNear: this.inCamp || this.wagons.some((w) => w.isAlive && distance(w, this.commander) < TRADE.WAGON_REACH),
    });
  }
}

/** Comprimento de uma linha de pontos. */
function routeLength(route: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += distance(route[i - 1], route[i]);
  return total;
}

/** Ponto a `d` px do começo da linha. */
function pointAlong(route: readonly Point[], d: number): Point {
  let left = d;
  for (let i = 1; i < route.length; i++) {
    const seg = distance(route[i - 1], route[i]);
    if (left <= seg) {
      const t = seg > 0 ? left / seg : 0;
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * t, y: route[i - 1].y + (route[i].y - route[i - 1].y) * t };
    }
    left -= seg;
  }
  return route[route.length - 1];
}

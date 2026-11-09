import Phaser from "phaser";
import { Commander } from "../entities/Commander";
import { Battalion } from "../entities/Battalion";
import { Enemy } from "../entities/Enemy";
import { Messenger, type MissionStop } from "../entities/Messenger";
import { Scout } from "../entities/Scout";
import { Harpy } from "../entities/Harpy";
import { Unit } from "../entities/Unit";
import { lodOf } from "../art/atlas";
import { Corpses } from "../art/corpses";
import { Wagon } from "../entities/Wagon";
import { WeatherLayer } from "../world/WeatherLayer";
import { isFlood, seasonOf, weatherAt } from "../../utils/season";
import { resolveAttacks } from "../systems/CombatSystem";
import { FogOfWar } from "../systems/FogOfWar";
import { spreadRout, updateMorale, type MoraleGroup } from "../systems/MoraleSystem";
import { setArrowField } from "../systems/ProjectileSystem";
import { clampToWorld, separateUnits } from "../systems/MovementSystem";
import { timeRate } from "../gameClock";
import { WarbandManager, type ArmyIntel, type Warband } from "../systems/Warbands";
import { ExpeditionParty } from "../entities/ExpeditionParty";
import { SiegeWorks } from "../systems/SiegeWorks";
import { HostManager, type HostWorld } from "../systems/WarHost";
import { TerrainMap, TerrainStreamer } from "../world/TerrainMap";
import { ForestArt } from "../world/ForestArt";
import { NightLayer } from "../world/NightLayer";
import { CampArea, type Interactable } from "../world/CampArea";
import { StaticCuller } from "../world/StaticCuller";
import { SettlementLayer } from "../world/Settlements";
import { NavGrid } from "../systems/NavGrid";
import { Companies } from "../systems/Companies";
import { insideTown } from "../world/townLayout";
import { kingdomsAtWar } from "../sim/realm";
import { GarrisonManager } from "../world/Garrisons";
import { WildlifeManager } from "../world/Wildlife";
import { SiteResidents } from "../world/SiteResidents";
import { CampLife } from "../world/CampLife";
import { MapLife } from "../world/MapLife";
import { TradeRoutes } from "../world/TradeRoutes";
import { followerCap } from "../sim/campEvents";
import { geoOf } from "../worldgen/geoMap";
import { harpyNests, type HarpyNest } from "../worldgen/nests";
import { type WorldDef } from "../data/world";
import { type ScenarioForce } from "../data/scenarios";
import { isSick } from "../sim/realm";
import { registerFieldCapture, unregisterFieldCapture } from "../save/saveGame";
import { useGameStore } from "../../store/useGameStore";
import { BALANCE, COMBAT, SUPPORT, GEO, TERRAIN, WORLD, WORLD_HEIGHT, WORLD_WIDTH, FATIGUE, SEASONS, WEATHER, SIEGE, WAR_AI, setWorldSize, type Season, type TerrainType, type Weather } from "../../utils/constants";
import { AudioEngine } from "../../audio/AudioEngine";
import { sfx, startCampfireAmbience, stopCampfireAmbience } from "../../audio/sounds";
import { distance, type Point } from "../../utils/math";
import { type BattleKeys, type PendingDelivery, type Engagement, type ScenarioRun, type GateRule, inRect, SNAPSHOT_MS } from "./worldScene/shared";
import { armyMethods, type ArmyMethods } from "./worldScene/army";
import { campMethods, type CampMethods } from "./worldScene/camp";
import { seaMethods, type SeaMethods } from "./worldScene/sea";
import { scenarioMethods, type ScenarioMethods } from "./worldScene/scenario";
import { combatMethods, type CombatMethods } from "./worldScene/combat";
import { siegeMethods, type SiegeMethods } from "./worldScene/siege";
import { realmMethods, type RealmMethods } from "./worldScene/realm";
import { agentsMethods, type AgentsMethods } from "./worldScene/agents";
import { saveMethods, type SaveMethods } from "./worldScene/save";
import { ordersMethods, type OrdersMethods } from "./worldScene/orders";
import { inputMethods, type InputMethods } from "./worldScene/input";
import { scoutsMethods, type ScoutsMethods } from "./worldScene/scouts";
import { hudMethods, type HudMethods } from "./worldScene/hud";
import { duelMethods, type DuelMethods, type FieldDuel } from "./worldScene/duel";
import type { DuelInput } from "../sim/duel";

/** A cena do mundo mais recente (ao carregar um jogo, a antiga ainda vive por um quadro). */
let activeScene: WorldScene | null = null;

/**
 * O mundo contínuo (Marco 7): exploração, gestão e combate no mesmo mapa em tempo real.
 * O acampamento, as cidades e os locais de contrato são lugares do mapa; o combate começa
 * quando inimigos e tropas se encontram e termina com um relatório, sem trocar de cena.
 */
export class WorldScene extends Phaser.Scene {
  commander!: Commander;
  battalions: Battalion[] = [];
  scouts: Scout[] = [];
  messengers: Messenger[] = [];
  enemies: Enemy[] = [];
  keys!: BattleKeys;
  lastHudAt = 0;
  lastFogAt = -Infinity;

  campArea!: CampArea;
  /** Rotina dos soldados e seguidores no acampamento (Marco 12). */
  campLife!: CampLife;
  /** Gente e bichos perto da câmera, e os sinais do mapa (fumaça, corvos, rastros). */
  mapLife!: MapLife;
  lastCampStateAt = -Infinity;
  culler!: StaticCuller;
  /** Chão e terreno carregados em pedaços perto da câmera. */
  terrainStreamer!: TerrainStreamer;
  night!: NightLayer;
  /** Mortos caídos no chão (só aparecem de perto). */
  corpses!: Corpses;
  /** Rotas por terra (rios, mar e montanhas bloqueiam; estradas são preferidas). */
  nav!: NavGrid;
  /** Pontes do mundo como lugares de interação (queimar, reconstruir). */
  bridgeSpots: Interactable[] = [];
  /** Ponte que o Comandante está cruzando agora (o pedágio é cobrado uma vez por travessia). */
  onBridge: string | null = null;
  /** Tochas acesas: o bando enxerga mais à noite, mas é visto de longe. */
  torches = true;
  /** Quando cada inimigo apareceu à vista (emboscada noturna = surgiu do escuro há pouco). */
  firstSeenAt = new WeakMap<Enemy, number>();
  lastAutosaveAt = -Infinity;
  /** Mundo gerado desta campanha. */
  world!: WorldDef;
  settlementLayer!: SettlementLayer;
  /** Árvores, moitas e pedras das matas (G2). */
  forestArt!: ForestArt;
  /** Quando acabou o último combate (feridos na enfermaria por um dia). */
  lastCombatDay = -Infinity;
  /** Povoado sob cerco (a guarnição luta contra o bando). */
  siegeId: string | null = null;
  /** Guarnições de verdade nos povoados perto do bando. */
  garrisons!: GarrisonManager;
  /** Alcateias de lobos. */
  wildlife!: WildlifeManager;
  /** Moradores dos locais de missão perto do bando (Fase 3, etapa 10). */
  siteResidents!: SiteResidents;
  /** Rotas das tropas do bando (povoados que barram o exército contam como muro). */
  armyNav!: NavGrid;
  /** Povoados e para quem os portões estão fechados (ver updateGateRules). */
  gateRules: GateRule[] = [];
  /** O Comandante está dentro de um povoado que barrou o exército: onde a tropa espera. */
  visit: { townId: string; hold: { point: Point; facing: number } } | null = null;
  lastGarrisonAt = -Infinity;
  /** Covis de calamidade já postos no mapa (desenho, líder e guardas). */
  calamityObjects = new Map<string, { objects: Phaser.GameObjects.GameObject[]; boss: Enemy }>();
  nearestSpot: Interactable | null = null;
  /** Caminhada por clique até um local (e o painel a abrir ao chegar). */
  walkPath: { path: Point[]; open?: Interactable["panel"]; enter?: Interactable } | null = null;
  inCamp = true;
  /** Batalhões descansando nos alojamentos (voltam a seguir o Comandante quando ele sai). */
  quartered = new Set<string>();
  warbands!: WarbandManager;
  /** Comando inimigo em campo (Marco 16). */
  hosts!: HostManager;
  /** Companhias em campo (Marco 20): aura, abalo e a cabeça de cada capitão. */
  companies!: Companies;
  /** Parada de um mensageiro que leva a ordem ao capitão: os batalhões que ela cobre. */
  relayStops = new WeakMap<MissionStop, Battalion[]>();
  /** Obras do cerco em curso: portões, escadas e aríete. */
  works: SiegeWorks | null = null;
  /** Tropas em expedição à vista no mapa. */
  parties = new Map<string, { party: ExpeditionParty; leg: string }>();
  /** De onde cada batalhão saiu do campo (a expedição parte dali). */
  leftFrom = new Map<string, Point>();
  /** Cerco levantado: a guarnição fica quieta por um tempo, mesmo com o bando por perto. */
  truce: { townId: string; until: number } | null = null;
  /** Notícias do bando a caminho dos reinos (ver newsTick). */
  newsOfArmy: { key: string; at: ArmyIntel }[] = [];
  engagement: Engagement | null = null;
  /** Inimigos do contrato ativo e do motim, já postos no mapa. */
  contractEnemies: Enemy[] = [];
  contractId: string | null = null;
  mutineers: Enemy[] = [];
  /** Dados do exército mudaram no store (recrutar, reforçar, desertar...): recriar em campo. */
  armyDirty = false;
  clockAccum = 0;
  lastClockFlush = 0;
  lastCommanderPos: Point = { x: 0, y: 0 };
  lastSnapshotAt = -Infinity;
  /** Baixas de batedores/mensageiros já informadas ao store. */
  reportedDead = new Set<string>();
  dragStart: Point | null = null;
  /** Botão direito apertado: vira clique ou, arrastando, uma linha de batalha. */
  lineDrag: { from: Point; screen: Point; run: boolean; active: boolean } | null = null;
  /** Último ponto do campo sob o mouse durante o arrasto. */
  lineEnd: Point | null = null;
  lastRightClickAt = -Infinity;
  linePreview!: Phaser.GameObjects.Graphics;
  lineLabel!: Phaser.GameObjects.Text;
  /** Destino de quem está selecionado e marchando. */
  destinationGfx!: Phaser.GameObjects.Graphics;
  /** Pausa tática: o mundo para, mas as ordens continuam valendo. */
  tacticalPause = false;
  /** Tropas que já fugiram (o medo pega uma vez só) e quando cada uma foi vista pega de lado. */
  routing = new WeakSet<MoraleGroup>();
  flankSeen = new WeakMap<MoraleGroup, number>();
  friendlyFireAt = -Infinity;
  /** Câmera lenta: ms de verdade que faltam e espera até poder usar de novo. */
  slowLeft = 0;
  slowWait = 0;
  /** Assinatura de quem está seguindo o Comandante (ver assignFollowSlots). */
  followKey = "";
  selectionBox!: Phaser.GameObjects.Graphics;

  fog!: FogOfWar;
  /** Último lugar e momento em que cada inimigo foi visto (fantasmas na névoa). */
  lastSeen = new Map<Enemy, { x: number; y: number; t: number }>();
  ghostGfx!: Phaser.GameObjects.Graphics;
  commandRing!: Phaser.GameObjects.Graphics;
  missionGfx!: Phaser.GameObjects.Graphics;
  feed: string[] = [];
  deadScoutIds: string[] = [];
  deadMessengerIds: string[] = [];
  /** Harpias treinadas em campo (Marco 16). */
  harpies: Harpy[] = [];
  /** Ninhos de harpia nas montanhas (saem da semente do mundo). */
  nests: HarpyNest[] = [];
  /** Quando cada grupo inimigo reagiu pela última vez a um batedor visto. */
  spotAt = new Map<string, number>();

  /** Câmera presa no Comandante (padrão) ou solta para comandar a distância. */
  cameraLocked = true;
  /** Arrasto com o botão do meio: ponto inicial da tela e da câmera. */
  panDrag: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  /** O mouse se moveu dentro do jogo e não saiu (evita rolar pela borda com posição velha). */
  pointerInGame = false;
  /** Entregas por mensageiro acumuladas durante uma ordem em grupo (ver withOrderBatch). */
  pendingBatch: PendingDelivery[] | null = null;
  lastTrumpetFx = -Infinity;
  lastBannerFx = -Infinity;
  warCryAt = -Infinity;

  // --- Estações, clima e logística (Marco 13) ---
  /** Carroças do trem de suprimentos em campo. */
  wagons: Wagon[] = [];
  /** Marcha forçada: o dia rende mais caminho, a tropa cansa muito mais. */
  forced = false;
  weatherLayer!: WeatherLayer;
  /** Tempo onde o Comandante está (vale para a ação perto dele). */
  weather: Weather = "CLEAR";
  season: Season = "SUMMER";
  lastWeatherAt = -Infinity;
  /** Estação aplicada no terreno (gelo, cheia, neve): muda o chão e as rotas. */
  seasonKey = "";
  lastIceAt = 0;
  /** Fadiga de cada batalhão (sobrevive a quando ele é recriado) e onde estava no quadro anterior. */
  fatigueById = new Map<string, number>();
  fatiguePos = new Map<string, Point>();

  // --- Economia e comércio (Marco 14) ---
  /** Caravanas, barcaças e navios dos mercadores (e as do bando). */
  trade!: TradeRoutes;

  /** Batalha personalizada em andamento (null = campanha). */
  run: ScenarioRun | null = null;

  /** Assinatura de cada batalhão em campo (o que estava nos dados quando ele foi criado). */
  fieldSignatures = new WeakMap<Battalion, string>();

  /** Casas dos moradores do povoado onde o Comandante está (Marco 14): todas têm porta. */
  houseCache: { townId: string; spots: Interactable[] } | null = null;

  /** Dentro de um povoado, o Comandante vê os preços da praça: anota no Livro (uma vez por dia). */
  lastVisitNoteAt = -Infinity;

  /** Lugar de onde o Comandante entrou num prédio (volta para lá ao sair). */
  interiorReturn: { x: number; y: number; facing: number } | null = null;

  scenarioStance = new WeakMap<Warband, ScenarioForce["stance"]>();

  // --- Duelo no campo (Marco 21) ---
  fieldDuel: FieldDuel | null = null;
  /** Espera até o próximo duelo e a próxima olhada por quem chegou perto (relógio da cena). */
  duelCooldownUntil = -Infinity;
  duelLookAt = 0;
  /** Heróis que já duelaram nesta batalha: um duelo por herói. */
  duelDone = new WeakSet<Enemy>();
  /** Heróis que saíram do campo por um duelo (o fim do combate não os conta de novo). */
  duelTaken = new Set<string>();
  /** Heróis que largaram o esquadrão para ir atrás do Comandante. */
  duelSeekers = new Set<Enemy>();
  /** Apertos do jogador desde o último passo do duelo. */
  duelPressed: Pick<DuelInput, "light" | "heavy" | "shove" | "dodge"> = {};
  /** O anel no chão e o aviso dos golpes. */
  duelGfx!: Phaser.GameObjects.Graphics;

  /** Comboio de suprimentos (rações refeitas): uma coluna com carroça, do acampamento ao exército (ou de volta). */
  convoyParty: { id: string; party: ExpeditionParty } | null = null;
  /** Escolta que acabou de chegar com o comboio: onde aparecer (ver reconcileArmy). */
  convoyArrivals = new Map<string, Point>();

  constructor() {
    super("WorldScene");
  }

  /** Sem simulação com o mapa, um relatório ou um painel abertos (pausa tática). */
  get ended(): boolean {
    const s = useGameStore.getState();
    // Em alto-mar o campo espera, menos a abordagem, que é a batalha do momento
    return s.worldMapOpen || s.atlasOpen || s.legendsOpen || s.succession !== null || s.epilogue !== null || (s.voyage !== null && !s.scenario) || s.battleReport !== null || s.campPanel !== null || s.campEvent !== null || s.scenarioPaused || s.scenarioResult !== null;
  }

  create(): void {
    // Figuras nascem no detalhe do zoom de agora (a câmera pode ter voltado de outra partida)
    Unit.lod = lodOf(this.cameras.main.zoom);
    this.corpses = Unit.corpses = new Corpses(this, Unit.lod);
    this.battalions = [];
    this.scouts = [];
    this.messengers = [];
    this.enemies = [];
    this.lastHudAt = 0;
    this.lastFogAt = -Infinity;
    this.dragStart = null;
    this.lineDrag = null;
    this.tacticalPause = false;
    this.slowLeft = 0;
    this.slowWait = 0;
    this.lastSeen = new Map();
    this.feed = [];
    this.deadScoutIds = [];
    this.deadMessengerIds = [];
    this.harpies = [];
    this.spotAt = new Map();
    this.reportedDead = new Set();
    this.cameraLocked = true;
    this.panDrag = null;
    this.pointerInGame = false;
    this.lastTrumpetFx = -Infinity;
    this.lastBannerFx = -Infinity;
    this.warCryAt = -Infinity;
    this.walkPath = null;
    this.inCamp = !useGameStore.getState().scenario;
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
    this.works = null;
    this.parties = new Map();
    // A cena velha levou as figuras do comboio junto: o próximo quadro desenha de novo
    this.convoyParty = null;
    this.leftFrom = new Map();
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
    Enemy.onSpot = (e, scout) => this.onScoutSpotted(e, scout);
    Unit.onFriendlyFire = (victim) => this.onFriendlyFire(victim);

    // Mundo gerado: chão, terreno, estradas, locais de contrato, povoados e o acampamento
    this.culler = new StaticCuller();
    const terrain = new TerrainMap(this.world.terrain, geoOf(this.world.geo));
    terrain.setBurned(store.burnedBridges);
    this.terrainStreamer = new TerrainStreamer(this, terrain, this.world);
    this.forestArt = new ForestArt(this, terrain, this.world.roads);
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
    this.settlementLayer = new SettlementLayer(this, this.world, this.culler);
    // Locais de contrato (barracas, choupanas, ruínas): as peças grandes são sólidas
    this.settlementLayer.addSites(this.world.sites, (x, y) => terrain.typeAt(x, y));
    terrain.setWildSolids(this.settlementLayer.wildSolids);
    this.settlementLayer.sync(store.settlements, store.calamities);
    // Muralhas e casas viram obstáculo (antes de a navegação avaliar qualquer célula)
    terrain.setTowns(this.settlementLayer.layouts);
    this.updateGateRules();
    // O acampamento desenhado pela planta na grade (Marco 22)
    this.campArea = new CampArea(this, this.world.camp, store.campPacked, store.campPlan, this.world.culture ?? "REALMS");
    terrain.campGround = this.campArea.ground;
    // Barracas, fogueira e paliçada bloqueiam todo mundo (não só o Comandante)
    this.campArea.onSolidsChanged = () => this.applyCampSolids();
    // Fosso: lama funda em volta da paliçada
    terrain.setDitch(!store.campPacked && store.campPlan.ditch ? this.campArea.palisade : null);
    this.applyCampSolids();
    this.campLife = new CampLife(this, this.campArea);
    this.mapLife = new MapLife(this);
    this.campLife.setFollowers(store.campPacked ? [] : store.followers);
    // A floresta em volta (o lenhador tira madeira dela)
    if (!store.campPacked) store.setCampForest(this.forestAround(this.world.camp.center));
    // Chão da estação: lama na primavera e na chuva fora das estradas, neve no frio do inverno
    Unit.ground = (x, y, t) => this.groundAt(x, y, t);
    this.season = seasonOf(store.day);
    this.applySeason();
    this.lastCampStateAt = -Infinity;

    const spawn = store.campPacked ? this.world.camp.spawn : this.campArea.spawnPoint;
    this.commander = new Commander(this, spawn.x, spawn.y);
    this.applyLeader();
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
      // Numa batalha de cerco, o rumo de cada força vem da batalha, não de um povoado para saquear
      () => ({ settlements: useGameStore.getState().scenario ? [] : useGameStore.getState().settlements, camp: this.campArea.packed ? null : this.world.camp.center }),
      // O centro de uma capital fica dentro da muralha interna: vale o ponto aberto mais perto
      (from, to) => this.nav.findPath(this.nav.nearestOpen(from, 1400) ?? from, this.nav.nearestOpen(to, 1400) ?? to, 200000),
      () => {
        const s = useGameStore.getState();
        return s.day + s.dayProgress;
      },
    );

    this.companies = new Companies({
      commander: () => this.commander,
      feed: (text) => this.pushFeed(text),
      // No anel, o Comandante não comanda: os capitães decidem sozinhos
      inVoice: (p) => !this.inDuel() && (!!this.run?.def.directOrders || distance(p, this.commander) <= SUPPORT.COMMAND_RADIUS),
    });

    // Marco 16: bando que entra na bolha ganha comando em campo
    this.hosts = new HostManager({
      scene: this,
      terrainAt: (p) => Unit.terrain?.typeAt(p.x, p.y) ?? "GRASS",
      isOpen: (p) => this.nav.isOpen(p),
      nearestOpen: (p, r) => this.nav.nearestOpen(p, r),
      listener: () => this.commander,
      feed: (text) => this.pushFeed(text),
      horn: (at) => sfx.trumpet("Avançar", at),
      ambush: (at) => this.sprungAmbush(at),
      sawArmy: (host, at, size) => {
        const band = host.band;
        if (!band) return;
        const s = useGameStore.getState();
        const day = s.day + s.dayProgress;
        this.warbands.noteArmy(band.id, { x: at.x, y: at.y, day, size });
        // O reino fica sabendo depois: a notícia anda até o povoado mais perto dele
        if (band.ownerId && band.kind !== "HORDE") {
          const own = s.settlements.filter((t) => t.owner === band.ownerId);
          const near = own.length > 0 ? Math.min(...own.map((t) => distance(t, at))) : 0;
          this.newsOfArmy.push({ key: band.ownerId, at: { x: at.x, y: at.y, day: day + near / WAR_AI.NEWS_SPEED, size } });
        }
      },
      officerDown: (host, name, chief, hero) => this.onOfficerDown(host, name, chief, hero),
      vanish: (e) => {
        e.fled = true;
        e.unitState = "DEAD";
        e.destroy();
      },
      retreated: (band) => {
        if (this.run) this.run.left.push(band);
        else this.warbands.retarget(band);
      },
    });
    this.warbands.hostile = (b) => this.bandHostile(b);
    this.warbands.onEnterBubble = (b) => this.hosts.attachBand(b);
    this.warbands.onLeaveBubble = (b) => this.hosts.detachBand(b);

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
    this.siteResidents = new SiteResidents((site, group, i) => {
      const units = this.spawnEnemyGroup(group, { kind: "SITE", siteId: site.id });
      this.attachGroup(`site:${site.id}:${i}`, units);
      return units;
    }, despawn);

    this.missionGfx = this.add.graphics().setDepth(14);
    this.resetDuels();
    this.fog = new FogOfWar(this, WORLD_WIDTH, WORLD_HEIGHT);
    // Lugares conhecidos desde o início: o acampamento e as cidades (destinos da viagem rápida)
    this.fog.revealExplored(this.world.camp.center, WORLD.KNOWN_RADIUS + 300);
    for (const t of store.settlements) this.fog.revealExplored(t, WORLD.KNOWN_RADIUS);
    this.ghostGfx = this.add.graphics().setDepth(16);
    this.nests = harpyNests(this.world);
    this.syncHarpies();
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
    if (store.scenario) this.startScenarioField(store.scenario);
    if (store.landing) this.landAt(store.landing);
    const capture = () => this.captureField();
    registerFieldCapture(capture);

    // Mudanças no exército (recrutas, reforços, deserções, motim, novos cavaleiros) chegam pelo store
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (
        s.battalions !== prev.battalions ||
        s.lieutenants !== prev.lieutenants ||
        s.captains !== prev.captains ||
        s.scouts !== prev.scouts ||
        s.messengers !== prev.messengers ||
        s.pendingMutiny !== prev.pendingMutiny ||
        s.mutiny !== prev.mutiny
      ) {
        this.armyDirty = true;
      }
      if (s.leader !== prev.leader) this.applyLeader();
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
      // A planta mudou: o acampamento é redesenhado no lugar (construções, portão, paliçada, fosso)
      // (só o andamento das obras: troca o texto dos rótulos, sem remontar a arte)
      if (s.campPlan !== prev.campPlan && !s.campPacked && !prev.campPacked && !this.campArea.updateProgress(s.campPlan)) this.applyCampPlan();
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
      this.hosts.clear();
      if (Unit.terrain === terrain) Unit.terrain = null;
      if (Unit.nav === nav) Unit.nav = null;
      if (Unit.armyNav === armyNav) {
        Unit.armyNav = null;
        Unit.closedTown = null;
      }
      // Ao carregar um jogo, a cena antiga morre depois de a nova nascer: só a mais nova mexe no que é global
      if (activeScene !== this) return;
      activeScene = null;
      this.stopSlowMotion();
      stopCampfireAmbience();
      useGameStore.getState().setCampPrompt(null);
      Unit.darkness = 0;
      Unit.weather = "CLEAR";
      Unit.ground = null;
      Unit.pace = 1;
      Enemy.perception = 1;
      Enemy.darkPerception = 1;
      Enemy.weatherSight = 1;
      Enemy.onSpot = null;
      Unit.onFriendlyFire = null;
      setArrowField([]);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    // Volta de um interior (Marco 14)
    const wake = (_sys: unknown, data?: { after?: string | null; text?: string }) => this.onWake(data);
    this.events.on(Phaser.Scenes.Events.WAKE, wake);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, wake));
    const sleep = () => this.stopSlowMotion();
    this.events.on(Phaser.Scenes.Events.SLEEP, sleep);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.SLEEP, sleep));

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
    this.settlementLayer.updateArt(this.cameras.main);
    this.campArea.updateArt(this.cameras.main);
    this.updateCampBuild();
    this.forestArt.update(this.cameras.main);
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
    if (this.tacticalPause) {
      this.updateFreeCamera(dt / timeRate());
      for (const b of this.battalions) if (!b.isDestroyed) b.drawBanner();
      this.drawDestinations();
      Unit.animateAll(time, view);
      if (time - this.lastHudAt >= BALANCE.HUD_UPDATE_MS * timeRate()) {
        this.lastHudAt = time;
        this.publishHud();
      }
      return;
    }
    this.updateSlowMotion(delta);
    if (this.armyDirty && !this.engagement) this.reconcileArmy();
    // Marco 21: o herói que chegou perto abre o duelo antes de todo mundo se mexer
    this.checkDuelTriggers(time);
    const duelLock = this.inDuel();

    const prev = { x: this.commander.x, y: this.commander.y };
    const walking = !duelLock && this.commander.handleMovement(k, dt);
    if (walking) this.walkPath = null;
    else this.followWalkPath(dt);
    if (!duelLock && k.SPACE.isDown) this.commander.trySwing(this.activeEnemies(), time);
    // A câmera do jogador não entra na câmera lenta (no duelo, ela fica nos dois)
    if (!duelLock) this.updateFreeCamera(dt / timeRate());

    // Os dois do anel saem da batalha comum: ninguém os escolhe como alvo, empurra ou move
    const seen = this.allAllies();
    const allies = this.fieldDuel ? seen.filter((u) => !u.dueling) : seen;
    if (time - this.lastFogAt >= SUPPORT.FOG_UPDATE_MS) this.updateVision(time);
    else this.updateReveal(seen, time);
    this.updateHostility();
    this.works?.update(dt, time);
    const active = this.fieldDuel ? this.activeEnemies().filter((e) => !e.dueling) : this.activeEnemies();
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
    const base = (e: Enemy): readonly Unit[] => (e.friendly ? foesOfFriendly : e.side === "WILD" ? town : e.side === "TOWN" ? (e.hostile ? wildAndFriendly : wild) : e.hostile ? friendly : []);
    // Exércitos de reinos em guerra lutam de verdade quando se encontram na bolha
    const warFoes = this.warFoes(active);
    const rivalsOf = (e: Enemy): readonly Unit[] => {
      // Batalha personalizada: goblins e reinos do cenário não brigam entre si
      if (this.run) return [];
      const extra = e.factionId ? warFoes.get(e.factionId) : undefined;
      return extra ? [...base(e), ...extra] : base(e);
    };
    const hostWorld: HostWorld = { time, dt, allies, rivalsOf, bonus: WAR_AI.DIFFICULTY[store.warDifficulty].competence };
    this.seekDuels(active);
    this.hosts.update(hostWorld);
    for (const e of active) e.think(dt, allies, rivalsOf(e));
    this.handleWarbandEvents(this.warbands.update(dt));
    this.tradeNews(this.trade.update(dt, view, this.presence()));
    this.assignFollowSlots();
    // Marcha forçada: o passo apertado só vale fora de combate
    Unit.pace = this.forced && !this.engagement && !this.inCamp ? FATIGUE.FORCED_SPEED : 1;
    // Na campanha, sem inimigo à vista, marcha-se no passo normal; em batalha, em ordem
    Battalion.calm = !this.run && !this.engagement && visibleEnemies.length === 0;
    // Marco 20: a aura do capitão vale neste quadro; fora da voz do Comandante, ele decide
    this.companies.update(time, store.captains, this.battalions, visibleEnemies);
    for (const b of this.battalions) b.update(dt, visibleEnemies);
    Wagon.load = this.loadPace();
    this.updateWagons(dt);
    const scoutWorld = this.scoutWorld(active);
    for (const s of this.scouts) s.think(dt, scoutWorld);
    this.updateHarpies(dt, time, active);
    this.updateMessengers(dt);
    this.updateFieldDuel(dt);

    const everyone: Unit[] = [...allies, ...active];
    setArrowField(everyone);
    resolveAttacks(this, everyone, time);
    this.hosts.afterCombat(hostWorld);
    const faltering = this.commander.hp / this.commander.maxHp < SUPPORT.BANNER_FALTER_HP;
    for (const b of this.battalions) {
      const seen = !b.isDestroyed && this.seesBanner(b.center);
      updateMorale(b, hostiles, this.commander, dt, time, { seen, faltering });
    }
    this.watchGroups(time);

    separateUnits(everyone);
    this.keepRingClear(everyone);
    clampToWorld(everyone);
    if (this.commander.isAlive) this.campArea.collide(this.commander, prev);
    this.commandRing.setPosition(this.commander.x, this.commander.y);

    this.enemies = this.enemies.filter((e) => e.isAlive);
    this.collectSupportLosses();
    this.collectWagonLosses();
    this.updateFatigue(dt);
    this.checkThinIce(time);
    this.drawMissions();
    this.drawDestinations();

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
    if (!this.run) this.wildlife.update(time, this.wildlifeContext());
    if (!this.run) this.updateSiteResidents();
    this.updateCampLife(time, dt);
    this.updateMapLife(time, dt);
    this.updateExpeditions(dt);
    this.updateConvoy(dt);
    this.updateBridgeCrossing();
    this.updatePrompt();
    this.checkObjectives();
    this.updateEngagement(time, active);
    if (this.run) this.scenarioTick(this.run, dt);
    this.tickClock(time, dt);
    Unit.animateAll(time, view);
    this.corpses.update(time);

    if (time - this.lastHudAt >= BALANCE.HUD_UPDATE_MS * timeRate()) {
      this.lastHudAt = time;
      this.publishHud();
    }
  }

  /** O que as tropas percebem umas das outras: quem começou a fugir e quem foi pego de lado. */
  watchGroups(time: number): void {
    const fresh = <T extends MoraleGroup>(list: readonly T[]): T[] =>
      list.filter((g) => {
        if (!g.panicking) {
          this.routing.delete(g);
          return false;
        }
        if (this.routing.has(g)) return false;
        this.routing.add(g);
        return true;
      });
    const fleeing = fresh(this.battalions);
    spreadRout(fleeing, this.battalions);
    for (const b of fleeing) this.pushFeed(`${b.name} está fugindo!`);
    for (const h of this.hosts.hosts) spreadRout(fresh(h.squads), h.squads);

    const noticed = (g: MoraleGroup): boolean => {
      if (!g.flanked || time - (this.flankSeen.get(g) ?? -Infinity) < COMBAT.FLANK_SHOCK_EVERY_MS) return false;
      this.flankSeen.set(g, time);
      return true;
    };
    for (const b of this.battalions) {
      if (b.isDestroyed || !noticed(b)) continue;
      this.pushFeed(`${b.name} foi pego pelo flanco!`);
      b.soldiers[0]?.floatText("flanqueados!", "#ff8a7a");
    }
    for (const h of this.hosts.hosts) for (const s of h.squads) if (noticed(s) && s.soldiers[0]?.revealed) s.soldiers[0].floatText("flanqueados!", "#ffd27a");
  }

  /** Flecha caiu nos nossos: conta na batalha e avisa, sem encher o feed. */
  onFriendlyFire(victim: Unit): void {
    if (this.run) this.run.friendlyFire++;
    if (victim.team !== "ALLY" || this.time.now - this.friendlyFireAt < 6000) return;
    this.friendlyFireAt = this.time.now;
    victim.floatText("fogo amigo!", "#ffb3a0");
    this.pushFeed("Nossas flechas estão caindo sobre os nossos! Cessem fogo (B).");
  }

  /** O Comandante caminha pela Cidade Alta sem levantar a tropa: ela espera na muralha. */
  get commanderPosition(): Point {
    return { x: this.commander.x, y: this.commander.y };
  }

  // --- Estações e clima (Marco 13) ---

  /**
   * Chão da estação num ponto: lama da primavera e da chuva fora das estradas, neve no frio do
   * inverno (na estrada pesa menos). Ruas, o acampamento e pontes são firmes.
   */
  groundAt(x: number, y: number, t: TerrainType): number {
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
  applySeason(): void {
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
    this.forestArt.setSeason({ foliage: season, snowBelow: winter ? SEASONS.SNOW_BELOW : null });
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
  updateWeather(time: number): void {
    if (time - this.lastWeatherAt < 1000) return;
    this.lastWeatherAt = time;
    const s = useGameStore.getState();
    const w = s.scenario?.weather ?? weatherAt(this.world.seed, s.day, this.commander, geoOf(this.world.geo));
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
  forecast(): Weather | null {
    const s = useGameStore.getState();
    if (s.scenario || !s.lieutenants.some((l) => l.traits.includes("CAUTIOUS"))) return null;
    return weatherAt(this.world.seed, s.day + 1, this.commander, geoOf(this.world.geo));
  }

  /** Gelo fino (perto do limite do frio): cavaleiros e carroças às vezes afundam. */
  checkThinIce(time: number): void {
    if (this.season !== "WINTER" || time - this.lastIceAt < 1000) return;
    this.lastIceAt = time;
    const geo = geoOf(this.world.geo);
    const heavy: Unit[] = [...this.wagons];
    for (const b of this.battalions) for (const s of b.soldiers) if (s.mounted) heavy.push(s);
    for (const u of heavy) {
      if (!u.isAlive || u.terrainType !== "ICE") continue;
      if (geo.temperatureAt(u.x, u.y) < SEASONS.FREEZE_BELOW - SEASONS.THIN_ICE || Math.random() > SEASONS.THIN_ICE_CHANCE) continue;
      u.restoreHp(u.hp - u.maxHp * SEASONS.THIN_ICE_DAMAGE);
      u.floatText("o gelo cedeu!", "#bfe6ff");
      this.pushFeed("O gelo fino cedeu sob o peso: cavalos e carroças não deviam cruzar ali.");
    }
  }

  /** O que expõe o bando hoje (fome, pântano, frio, febre): o store usa na virada do dia. */
  updateExposure(): void {
    const s = useGameStore.getState();
    const c = this.commander;
    const geo = geoOf(this.world.geo);
    const away = !this.inCamp;
    const sheltered = this.settlementLayer.layouts.some((l) => insideTown(l, c, 600));
    s.setExposure({
      away,
      // Acampamento de cerco que dura: a mesma doença do pântano
      swamp: away && (c.terrainType === "SWAMP" || geo.biomeAt(c.x, c.y) === "MARSH" || (!!s.siege?.walled && s.day - (s.siege.startDay ?? s.day) >= SIEGE.CAMP_SICK_DAY)),
      // Cobertores do mascate protegem do frio
      cold: away && !sheltered && s.day >= s.blanketsUntil && this.season === "WINTER" && geo.temperatureAt(c.x, c.y) < SEASONS.SNOW_BELOW,
      sickTown: s.settlements.some((t) => isSick(t, s.day) && distance(t, c) < 2500),
    });
  }
}

/*
 * A cena passava de 6000 linhas: as partes moram em `./worldScene/`, cada uma um objeto de métodos
 * com `this: WorldScene`, e entram aqui no protótipo. A interface diz ao TypeScript que são da cena.
 */
export interface WorldScene extends ArmyMethods, CampMethods, SeaMethods, ScenarioMethods, CombatMethods, SiegeMethods, RealmMethods, AgentsMethods, SaveMethods, OrdersMethods, InputMethods, ScoutsMethods, HudMethods, DuelMethods {}
Object.assign(WorldScene.prototype, armyMethods, campMethods, seaMethods, scenarioMethods, combatMethods, siegeMethods, realmMethods, agentsMethods, saveMethods, ordersMethods, inputMethods, scoutsMethods, hudMethods, duelMethods);

import type { Enemy } from "../entities/Enemy";
import { clampToWorldBounds } from "../data/world";
import { chiefName } from "../worldgen/names";
import { isCalamityOwner, isRaiderKind, type BandKind, type CalamityKind, type Settlement } from "../sim/realm";
import { AGENTS, WAR_AI, WORLD, type EnemyKind, type Good } from "../../utils/constants";
import { centroid, distance, type Point } from "../../utils/math";
import { makeStaff, promoteRoster, type Doctrine, type StaffData, type WarHost } from "./WarHost";

/** Carga de uma caravana (Marco 14): o que leva, de onde e para onde, e quanto custou. */
export interface CaravanCargo {
  good: Good;
  qty: number;
  from: string;
  to: string;
  cost: number;
  /** Caravana própria do bando (id) ou escoltada num contrato. */
  own?: string;
  escort?: boolean;
}

export type WarbandGoal = { kind: "SETTLEMENT"; id: string } | { kind: "CAMP" } | { kind: "WANDER" };

/** O que um lado sabe do bando do jogador: onde foi visto, quando e com quantos. */
export interface ArmyIntel extends Point {
  day: number;
  size: number;
}

/** O que define um bando novo: goblins dos covis, exército de um reino ou horda de uma calamidade. */
export interface BandSpec {
  name: string;
  kind: BandKind;
  units: [EnemyKind, number][];
  origin: Point;
  /** Facção ou calamidade dona (goblins: null). */
  ownerId: string | null;
  calamityKind?: CalamityKind;
  /** Cor dos soldados (exércitos dos reinos usam a cor da facção). */
  color?: number;
  /** Caravana (Marco 14): a carga, a rota pelas estradas e o povoado de destino. */
  cargo?: CaravanCargo;
  route?: Point[];
  goalId?: string;
  /** Exército de um lorde (Marco 15): o registro dele na simulação. */
  armyId?: string;
  /** Quem comanda (o lorde, nos exércitos; sem isso, sai um chefe do próprio bando). */
  chief?: { name: string; traits: StaffData["traits"]; martial?: number };
  /** Lição aprendida com derrotas: o que reforçar neste exército. */
  doctrine?: Doctrine;
}

/** Um integrante do bando enquanto ele é só dados (fora da bolha de detalhe). */
export interface BandMember {
  kind: EnemyKind;
  hp: number;
  /** Lugar em volta da posição de marcha do bando. */
  offset: Point;
}

/**
 * Bando que marcha pelo mundo rumo a um povoado ou ao acampamento.
 * Fora da bolha ele é só `roster` (dados); dentro, `members` são unidades de verdade.
 */
export interface Warband {
  id: string;
  name: string;
  kind: BandKind;
  ownerId: string | null;
  calamityKind?: CalamityKind;
  color?: number;
  materialized: boolean;
  roster: BandMember[];
  members: Enemy[];
  /** Posição de marcha do bando; cada membro segue o próprio lugar em volta dela. */
  anchor: Point;
  offsets: Map<Enemy, Point>;
  goal: WarbandGoal;
  goalPoint: Point;
  /** Pontos da rota por terra até o alvo (pontes, vaus, passos), ainda a percorrer. */
  route: Point[];
  /** Sem rota: px de marcha a esperar antes de procurar outro alvo. */
  rest: number;
  /** Já foi avistado alguma vez (o primeiro avistamento vira notícia). */
  spotted: boolean;
  /** Última posição conhecida (Mapa do Continente). */
  lastSeen: { x: number; y: number; day: number } | null;
  /** Atacado pelo bando do jogador (patrulha, mensageiro ou refugiados): passa a ser hostil. */
  provoked: boolean;
  /** Rastros da marcha (pegadas que ficam no chão por um dia e meio). */
  trail: { x: number; y: number; day: number }[];
  /** Patrulha: bando que ela está caçando. */
  huntId: string | null;
  /** Caravana: a carga; escoltada, espera o bando antes de partir (`waiting`). */
  cargo?: CaravanCargo;
  waiting?: boolean;
  /** Goblins que saquearam uma caravana: levam a carga (recuperável). */
  loot?: { good: Good; qty: number; townId: string };
  /** Marco 15: exército de um lorde e se ele já está voltando para casa. */
  armyId?: string;
  homeward?: boolean;
  /** Marco 16: atenção do bando (0 desavisado, 1 desconfiado, 2 alerta, 3 caçando). */
  alert?: number;
  /** Quantos um batedor contou (o mapa mostra isso, não a verdade). */
  reportedCount?: number;
  /** Marco 16: quem comanda o bando (vai no save) e o comando em campo (só dentro da bolha). */
  staff?: StaffData;
  host?: WarHost;
  /** Mensageiro que leva o pedido de socorro de uma cidade cercada. */
  reliefFor?: string;
  /** Próxima revisão do rumo (dia) e o que ele está fazendo por conta própria. */
  nextReview?: number;
  aim?: "HUNT" | "FLEE" | "GATHER" | "CAMP";
}

/** Bando salvo: sempre como dados (quem estava em campo vira roster com a posição de agora). */
export type WarbandSave = Omit<Warband, "materialized" | "members" | "offsets" | "route" | "trail" | "huntId" | "host"> & { route?: Point[] };

export interface WarbandsSave {
  seq: number;
  lastGoblinDay: number;
  bands: WarbandSave[];
  /** Marco 16: o que cada lado sabe do bando. */
  intel?: [string, ArmyIntel][];
  campKnown?: string[];
}

export type WarbandEvent =
  | { type: "ARRIVED"; band: Warband; goal: WarbandGoal }
  | { type: "DESTROYED"; band: Warband }
  /** Dois bandos se enfrentaram longe do jogador (patrulha contra goblins, horda contra patrulha...). */
  | { type: "SKIRMISH"; winner: Warband; loser: Warband; at: Point; losses: number }
  /** Refugiados chegaram a um lugar seguro. */
  | { type: "SHELTERED"; band: Warband; settlementId: string }
  /** Refugiados alcançados por um bando hostil. */
  | { type: "MASSACRE"; band: Warband; by: Warband }
  /** Inverno: o exército do reino chegou aos quartéis de inverno (vira guarnição). */
  | { type: "QUARTERED"; band: Warband; settlementId: string }
  /** Caravana chegou ao mercado de destino (Marco 14). */
  | { type: "DELIVERED"; band: Warband; cargo: CaravanCargo }
  /** Caravana alcançada por goblins ou por uma horda longe do jogador: a carga vai com eles. */
  | { type: "CARAVAN_RAIDED"; band: Warband; by: Warband; cargo: CaravanCargo }
  /** Exército de um lorde chegou ao alvo (começa o cerco) ou de volta a casa (Marco 15). */
  | { type: "ARMY_AT"; band: Warband; townId: string }
  | { type: "ARMY_HOME"; band: Warband }
  /** Dois exércitos em guerra (ou exército contra bando hostil) se encontraram longe da mão do jogador. */
  | { type: "ARMY_CLASH"; winner: Warband; loser: Warband; at: Point; losses: number };

/** O que os bandos precisam saber do mundo para escolher alvos. */
export interface WarbandTargets {
  settlements: readonly Settlement[];
  /** null = acampamento levantado (Marco 13). */
  camp: Point | null;
}

/** Quantos combatentes o bando tem agora (em campo ou nos dados). */
export function bandSize(band: Warband): number {
  return band.materialized ? band.members.filter((m) => m.isAlive).length : band.roster.length;
}

/**
 * Bandos errantes (Marcos 7, 9 e 10), simulados em dois níveis:
 * - **Continente:** longe do exército, o bando é só dados (composição, vida de cada um,
 *   posição de marcha, alvo) e anda pelo mapa sem custo de cena.
 * - **Bolha:** quando alguém do bando chega perto, ele vira unidades de verdade que pensam e
 *   lutam; quando todos se afastam (e ninguém está lutando), volta a ser dados, com quem
 *   sobreviveu e a vida que tinha. Nada aparece ou some do nada.
 * Goblins saem dos covis; exércitos dos reinos em guerra marcham contra os povoados do
 * jogador; hordas de calamidade atacam qualquer povoado que ainda não caiu.
 * Marco 12: também andam patrulhas dos reinos (caçam bandos perto das terras do reino e se
 * enfrentam com eles), mensageiros reais (cavalgam entre os povoados do reino) e refugiados
 * (fogem de um povoado atacado para o mais próximo que ainda está de pé). Toda marcha deixa
 * rastros no chão.
 */
export class WarbandManager {
  bands: Warband[] = [];
  private lastGoblinDay = 0;
  private seq = 0;
  /** Chão da estação onde o bando marcha (lama, neve): as mesmas regras do jogador (Marco 13). */
  marchFactor: (p: Point, band: Warband) => number = () => 1;
  /** Inverno: os exércitos dos reinos voltam aos quartéis de inverno. */
  private winter = false;
  /** Dois reinos estão em guerra? (a cena consulta o store) */
  atWar: (a: string, b: string) => boolean = () => false;
  /** Batalha personalizada: todas as forças estão do mesmo lado, seja qual for o bando. */
  allied = false;
  /** Onde o bando do jogador está (a última bolha calculada). */
  private anchors: readonly Point[] = [];
  /** Está na bolha, ou prestes a entrar: quem se encontra ali luta de verdade. */
  private inBubble(b: Warband): boolean {
    return b.materialized || this.anchors.some((a) => distance(a, b.anchor) <= WORLD.BUBBLE_RADIUS);
  }

  /** Este bando quer lutar com o do jogador? (a cena consulta o store) */
  hostile: (band: Warband) => boolean = () => false;
  /** O que cada reino (ou cada bando, entre os selvagens) sabe do bando do jogador. */
  private intel = new Map<string, ArmyIntel>();
  /** Quem já sabe onde fica o acampamento. */
  private campKnown = new Set<string>();
  /** Bando virou tropa ou voltou a ser dados: a cena liga e desliga o comando dele (Marco 16). */
  onEnterBubble: (band: Warband) => void = () => {};
  onLeaveBubble: (band: Warband) => void = () => {};

  setWinter(winter: boolean): void {
    if (winter === this.winter) return;
    this.winter = winter;
    for (const b of this.bands) if (b.kind === "FACTION") this.chooseGoal(b);
  }

  constructor(
    private readonly spawn: (x: number, y: number, kind: EnemyKind, color?: number) => Enemy,
    private readonly targets: () => WarbandTargets,
    /** Rota por terra de um ponto a outro (null = não há como chegar). */
    private readonly pathfind: (from: Point, to: Point) => Point[] | null,
    /** Dia de agora (com fração), para datar os rastros. */
    private readonly clock: () => number = () => 0,
  ) {}

  /** Goblins: um bando novo a cada poucos dias, num covil que ninguém está vendo. */
  maybeSpawnGoblins(day: number, lairs: readonly Point[], canSee: (p: Point) => boolean, everyMult = 1): Warband | null {
    const W = WORLD.WARBAND;
    const goblins = this.bands.filter((b) => b.kind === "GOBLIN").length;
    if (day < W.FIRST_DAY || day - this.lastGoblinDay < W.EVERY_DAYS * everyMult || goblins >= W.MAX) return null;
    const hidden = lairs.filter((p) => !canSee(p));
    if (hidden.length === 0) return null;
    this.lastGoblinDay = day;
    const size = W.BASE_SIZE + Math.floor(day / 7) * W.GROWTH_PER_WEEK;
    const archers = Math.round(size * W.ARCHER_SHARE);
    return this.spawnBand({
      name: `Bando de ${chiefName()}`,
      kind: "GOBLIN",
      units: [
        ["GOBLIN", size - archers],
        ["GOBLIN_ARCHER", archers],
      ],
      origin: hidden[Math.floor(Math.random() * hidden.length)],
      ownerId: null,
    });
  }

  /** Bando novo, ainda só dados: vira unidades quando entrar na bolha. */
  spawnBand(spec: BandSpec): Warband {
    const plain = spec.units.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind));
    // Marco 16: quem luta de verdade ganha comando; gente de paz e caravanas continuam como eram
    const led = spec.kind === "GOBLIN" || spec.kind === "FACTION" || spec.kind === "HORDE" || spec.kind === "PATROL";
    const kinds = led ? promoteRoster(plain, spec.kind === "FACTION", spec.doctrine) : plain;
    const cols = Math.ceil(Math.sqrt(kinds.length));
    const band: Warband = {
      id: `band-${++this.seq}`,
      name: spec.name,
      kind: spec.kind,
      ownerId: spec.ownerId,
      calamityKind: spec.calamityKind,
      color: spec.color,
      materialized: false,
      roster: kinds.map((kind, i) => ({
        kind,
        hp: Infinity, // vida cheia (o máximo depende do tipo)
        offset: { x: ((i % cols) - (cols - 1) / 2) * 30, y: (Math.floor(i / cols) - (cols - 1) / 2) * 30 },
      })),
      members: [],
      anchor: { ...spec.origin },
      offsets: new Map(),
      goal: { kind: "WANDER" },
      goalPoint: spec.origin,
      route: [],
      rest: 0,
      spotted: false,
      lastSeen: null,
      provoked: false,
      trail: [],
      huntId: null,
      cargo: spec.cargo,
      waiting: spec.cargo?.escort,
      staff: led ? makeStaff(kinds, spec.kind === "GOBLIN" ? (kinds.includes("BANDIT") ? 2 : 1) : spec.kind === "HORDE" ? 2 : 3, spec.chief) : undefined,
    };
    // Caravana: a rota já vem pronta (pelas estradas, de praça em praça)
    if (spec.kind === "CARAVAN" && spec.route && spec.goalId) {
      band.goal = { kind: "SETTLEMENT", id: spec.goalId };
      band.route = [...spec.route];
      band.goalPoint = { ...band.route[band.route.length - 1] };
    } else if (spec.goalId) {
      // Exército de um lorde ou camponeses em revolta: o alvo vem decidido (Marco 15)
      band.armyId = spec.armyId;
      const t = this.targets().settlements.find((x) => x.id === spec.goalId);
      band.goal = { kind: "SETTLEMENT", id: spec.goalId };
      band.goalPoint = t ? { x: t.x, y: t.y } : { ...spec.origin };
      band.route = (t && this.pathfind(band.anchor, t)) || [];
    } else {
      this.chooseGoal(band);
    }
    this.bands.push(band);
    return band;
  }

  /**
   * Entrada e saída da bolha de detalhe. `anchors` = onde está o bando do jogador
   * (Comandante, batalhões, batedores, mensageiros).
   */
  updateBubble(anchors: readonly Point[]): void {
    this.anchors = anchors;
    const near = (p: Point, r: number) => anchors.some((a) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 <= r * r);
    for (const band of this.bands) {
      if (!band.materialized) {
        if (near(band.anchor, WORLD.BUBBLE_RADIUS)) this.materialize(band);
        continue;
      }
      const alive = band.members.filter((m) => m.isAlive);
      const busy = alive.some((m) => !m.dormant || m.target);
      const where = alive.length > 0 ? centroid(alive) : band.anchor;
      if (!busy && !near(where, WORLD.BUBBLE_EXIT_RADIUS)) this.dematerialize(band);
    }
  }

  /** Marcha em tempo real. Bando em combate (algum membro com alvo) para onde está. */
  update(dt: number): WarbandEvent[] {
    return this.step(WORLD.WARBAND.SPEED * dt);
  }

  /** Dias de viagem rápida: os bandos andam o mesmo tempo que o exército. */
  advance(days: number): WarbandEvent[] {
    return this.step(WORLD.WARBAND.DAY_DISTANCE * days);
  }

  /** Alguém viu o bando do jogador (ver WorldScene): vale para o bando e, com atraso, para o reino. */
  noteArmy(key: string, intel: ArmyIntel): void {
    const had = this.intel.get(key);
    if (!had || had.day <= intel.day) this.intel.set(key, intel);
  }

  noteCamp(key: string): void {
    this.campKnown.add(key);
  }

  /** O que este bando sabe: o que ele mesmo viu ou o que o reino dele ouviu, o que for mais novo. */
  intelOf(band: Warband): ArmyIntel | null {
    const own = this.intel.get(band.id) ?? null;
    const shared = band.ownerId ? (this.intel.get(band.ownerId) ?? null) : null;
    if (!own) return shared;
    return !shared || own.day >= shared.day ? own : shared;
  }

  /** Muda o rumo para um ponto (sem caminho por terra, fica como está). */
  private setCourse(band: Warband, to: Point, aim: Warband["aim"]): boolean {
    const route = this.pathfind(band.anchor, to);
    if (!route) return false;
    band.goal = { kind: "WANDER" };
    band.goalPoint = { ...to };
    band.route = route;
    band.rest = 0;
    band.aim = aim;
    return true;
  }

  /**
   * Estratégia (Marco 16): de tempos em tempos cada bando revê o rumo com o que sabe do jogador.
   * Vai atrás dele se tem força, foge se está fraco e perto, junta-se a outro bando quando sozinho
   * não dá, e cai sobre o acampamento quando a tropa está longe. Sem notícia, segue o que fazia.
   */
  private review(band: Warband, now: number): void {
    band.nextReview = now + WAR_AI.REVIEW_DAYS;
    if (!band.staff || band.homeward || band.waiting || band.huntId || !this.hostile(band)) return;
    if (band.kind === "FACTION" && this.winter) return;
    // Tocaia de contrato (salteadores esperando a caravana): não sai do lugar
    if (band.rest > 1e8) return;
    const comp = band.staff.competence;
    const intel = this.intelOf(band);
    if (!intel || now - intel.day > WAR_AI.INTEL_DAYS[comp - 1]) {
      if (band.aim) {
        band.aim = undefined;
        this.chooseGoal(band);
      }
      return;
    }
    const own = bandSize(band);
    const d = distance(band.anchor, intel);
    const brave = band.staff.traits.includes("BRAVE") || band.staff.traits.includes("CRUEL");
    // Fraco e perto: sai do caminho (bravo não foge de bando nenhum)
    if (!brave && own < intel.size * WAR_AI.FLEE_SHARE && d < WAR_AI.FLEE_RADIUS) {
      const away = Math.atan2(band.anchor.y - intel.y, band.anchor.x - intel.x);
      // Para longe; se ali for mar ou montanha, para o lado
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
        const to = clampToWorldBounds({ x: band.anchor.x + Math.cos(away + turn) * 5000, y: band.anchor.y + Math.sin(away + turn) * 5000 }, 300);
        if (this.setCourse(band, to, "FLEE")) return;
      }
    }
    // Sozinho não dá: procura outro igual antes de lutar
    if (own < intel.size && band.kind === "GOBLIN" && comp >= 2) {
      const friend = this.bands.find((o) => o !== band && o.kind === "GOBLIN" && !o.loot && !o.waiting && distance(o.anchor, band.anchor) < WAR_AI.GATHER_RADIUS);
      if (friend) {
        if (!band.materialized && !friend.materialized && distance(friend.anchor, band.anchor) < WAR_AI.GATHER_MEET) {
          friend.roster.push(...band.roster);
          band.roster = [];
          return;
        }
        if (this.setCourse(band, friend.anchor, "GATHER")) return;
      }
    }
    const reach = band.armyId ? WAR_AI.ARMY_DETOUR : WAR_AI.HUNT_RADIUS[comp - 1];
    if (own >= intel.size * WAR_AI.HUNT_SHARE && d < reach && this.setCourse(band, intel, "HUNT")) return;
    // Bando do jogador longe de casa: o acampamento está à mercê
    const camp = this.targets().camp;
    if (camp && !band.armyId && band.aim !== "CAMP" && (this.campKnown.has(band.id) || (band.ownerId && this.campKnown.has(band.ownerId))) && distance(intel, camp) > WAR_AI.CAMP_RAID_DISTANCE && comp >= 2) {
      const route = this.pathfind(band.anchor, camp);
      if (route) {
        band.goal = { kind: "CAMP" };
        band.goalPoint = camp;
        band.route = route;
        band.aim = "CAMP";
      }
    }
  }

  /** Batalha personalizada: o bando vai direto a um ponto. */
  marchOn(band: Warband, to: Point): void {
    this.setCourse(band, to, "HUNT");
  }

  /** Batalha personalizada: o bando fica onde está até alguém aparecer. */
  holdGround(band: Warband): void {
    band.goal = { kind: "WANDER" };
    band.goalPoint = { ...band.anchor };
    band.route = [];
    band.rest = 2e8;
  }

  /** O exército larga o cerco e volta para a casa mais perto do reino (Marco 15). */
  sendHome(band: Warband): void {
    band.waiting = false;
    band.homeward = true;
    band.rest = 0;
    this.chooseGoal(band);
  }

  /** Bando chegou e o alvo caiu ou o repeliu: escolhe outro (ou se dissolve na guarnição). */
  retarget(band: Warband): void {
    this.chooseGoal(band);
  }

  /** Rota nova até o mesmo alvo (o mapa mudou: ponte queimada ou reconstruída). Caravanas seguem a estrada. */
  repath(band: Warband): void {
    if (band.kind === "CARAVAN") return;
    band.route = this.pathfind(band.anchor, band.goalPoint) ?? [];
  }

  repathAll(): void {
    for (const b of this.bands) this.repath(b);
  }

  /** Os defensores derrubam metade do bando antes de ele recuar. */
  loseHalf(band: Warband): void {
    if (band.materialized) {
      const alive = band.members.filter((m) => m.isAlive);
      for (const m of alive.slice(0, Math.ceil(alive.length / 2))) despawn(m);
      band.members = band.members.filter((m) => m.isAlive);
    } else {
      band.roster = band.roster.slice(Math.ceil(band.roster.length / 2));
    }
  }

  /** Remove o bando do mundo (virou guarnição do povoado tomado). */
  disband(band: Warband): void {
    this.onLeaveBubble(band);
    for (const m of band.members) despawn(m);
    band.members = [];
    band.roster = [];
    this.bands = this.bands.filter((b) => b !== band);
  }

  /** Estado para o save: todo bando vira dados, com a posição e a vida de agora. */
  serialize(): WarbandsSave {
    return {
      seq: this.seq,
      lastGoblinDay: this.lastGoblinDay,
      intel: [...this.intel],
      campKnown: [...this.campKnown],
      bands: this.bands.map((b) => ({
        id: b.id,
        name: b.name,
        kind: b.kind,
        ownerId: b.ownerId,
        calamityKind: b.calamityKind,
        color: b.color,
        roster: b.materialized
          ? b.members.filter((m) => m.isAlive).map((m) => ({ kind: m.kind, hp: m.hp, offset: { x: m.x - b.anchor.x, y: m.y - b.anchor.y } }))
          : b.roster.map((r) => ({ ...r, hp: Number.isFinite(r.hp) ? r.hp : -1 })),
        anchor: { ...b.anchor },
        goal: b.goal,
        goalPoint: { ...b.goalPoint },
        rest: b.rest,
        spotted: b.spotted,
        lastSeen: b.lastSeen,
        provoked: b.provoked,
        cargo: b.cargo,
        waiting: b.waiting,
        loot: b.loot,
        armyId: b.armyId,
        homeward: b.homeward,
        alert: b.alert,
        reportedCount: b.reportedCount,
        staff: b.staff,
        // A rota das caravanas não se refaz pela grade: vai junto
        route: b.kind === "CARAVAN" ? b.route.map((p) => ({ ...p })) : undefined,
      })),
    };
  }

  /** Bandos de um save: todos voltam como dados (a bolha os põe em campo se estiverem perto). */
  restore(data: WarbandsSave): void {
    for (const b of this.bands) this.disband(b);
    this.seq = data.seq;
    this.lastGoblinDay = data.lastGoblinDay;
    this.intel = new Map(data.intel ?? []);
    this.campKnown = new Set(data.campKnown ?? []);
    this.bands = data.bands.map((b) => ({
      ...b,
      roster: b.roster.map((r) => ({ ...r, hp: r.hp < 0 ? Infinity : r.hp })),
      materialized: false,
      members: [],
      offsets: new Map(),
      route: b.route ?? [],
      rest: b.rest ?? 0,
      provoked: b.provoked ?? false,
      trail: [],
      huntId: null,
    }));
    this.repathAll();
  }

  private materialize(band: Warband): void {
    band.materialized = true;
    band.members = band.roster.map((r) => {
      const e = this.spawn(band.anchor.x + r.offset.x, band.anchor.y + r.offset.y, r.kind, band.color);
      if (Number.isFinite(r.hp)) e.restoreHp(r.hp);
      e.owner = { kind: "WARBAND", id: band.id };
      // Patrulhas, mensageiros, refugiados e caravanas nascem em paz (a cena acerta a guerra no quadro seguinte)
      e.hostile = (isRaiderKind(band.kind) && band.kind !== "FACTION" && band.kind !== "REBELS") || (band.provoked && (band.kind === "PATROL" || band.kind === "CARAVAN"));
      // Lado no mundo: goblins e hordas contra patrulhas, exércitos dos reinos e caravanas (lutam de verdade)
      e.side = band.kind === "GOBLIN" || band.kind === "HORDE" ? "WILD" : band.kind === "PATROL" || band.kind === "FACTION" || band.kind === "CARAVAN" ? "TOWN" : null;
      e.factionId = band.kind === "PATROL" || band.kind === "FACTION" ? band.ownerId : null;
      e.home = { x: e.x, y: e.y };
      band.offsets.set(e, r.offset);
      return e;
    });
    band.roster = [];
    this.onEnterBubble(band);
  }

  private dematerialize(band: Warband): void {
    this.onLeaveBubble(band);
    const alive = band.members.filter((m) => m.isAlive);
    band.roster = alive.map((m) => ({ kind: m.kind, hp: m.hp, offset: band.offsets.get(m) ?? { x: 0, y: 0 } }));
    for (const m of band.members) despawn(m);
    band.members = [];
    band.offsets = new Map();
    band.materialized = false;
  }

  private step(baseDist: number): WarbandEvent[] {
    const events: WarbandEvent[] = [];
    const gone = new Set<Warband>();
    const now = this.clock();
    for (const band of this.bands) {
      const stepDist = baseDist * (band.kind === "COURIER" ? AGENTS.COURIER_SPEED : 1) * this.marchFactor(band.anchor, band);
      if (band.materialized) band.members = band.members.filter((m) => m.isAlive);
      if (bandSize(band) === 0) {
        events.push({ type: "DESTROYED", band });
        continue;
      }
      if (band.members.some((m) => m.target) || band.host?.holding) {
        band.anchor = centroid(band.members);
        continue;
      }
      // Caravana escoltada: espera o bando no portão
      if (band.waiting) continue;
      if (now >= (band.nextReview ?? 0)) this.review(band, now);
      if (bandSize(band) === 0) continue;
      // O alvo pode ter mudado de dono no caminho (a horda não ataca o que já é dela)
      if (band.goal.kind === "SETTLEMENT" && !this.validTarget(band, band.goal.id)) this.chooseGoal(band);
      if (band.kind === "PATROL") this.hunt(band, (o) => o.kind === "GOBLIN" || o.kind === "HORDE", AGENTS.HUNT_RADIUS);
      // Goblins farejam caravanas carregadas na estrada (Marco 14)
      if (band.kind === "GOBLIN" && !band.loot) this.hunt(band, (o) => o.kind === "CARAVAN" && !o.waiting, AGENTS.HUNT_RADIUS * 0.6);

      // Anda pela rota (por terra: pontes, vaus, passos), ponto a ponto
      const before = band.anchor;
      let left = stepDist;
      while (left > 0 && band.route.length > 0) {
        const wp = band.route[0];
        const d = distance(band.anchor, wp);
        if (d <= left) {
          band.anchor = { x: wp.x, y: wp.y };
          left -= d;
          band.route.shift();
        } else {
          band.anchor = { x: band.anchor.x + ((wp.x - band.anchor.x) / d) * left, y: band.anchor.y + ((wp.y - band.anchor.y) / d) * left };
          left = 0;
        }
      }
      const dx = band.anchor.x - before.x;
      const dy = band.anchor.y - before.y;
      // Rastros: um ponto a cada 250 px de marcha (os últimos 40)
      const last = band.trail[band.trail.length - 1];
      if (!last || distance(last, band.anchor) >= 250) {
        band.trail.push({ x: band.anchor.x, y: band.anchor.y, day: this.clock() });
        if (band.trail.length > 40) band.trail.shift();
      }
      for (const m of band.members) {
        const o = band.offsets.get(m) ?? { x: 0, y: 0 };
        m.home = { x: band.anchor.x + o.x, y: band.anchor.y + o.y };
        if (m.dormant) {
          m.x += dx;
          m.y += dy;
        }
      }
      if (band.route.length === 0) {
        // Caravana: chegou ao mercado do destino
        if (band.kind === "CARAVAN" && band.cargo) {
          events.push({ type: "DELIVERED", band, cargo: band.cargo });
          gone.add(band);
          continue;
        }
        if (band.rest > 0) {
          band.rest -= stepDist;
          continue;
        }
        // Chegou (ou a rota acabou antes: o alvo ficou inalcançável e ele procura outro)
        const near = distance(band.anchor, band.goalPoint) <= WORLD.WARBAND.RAID_RADIUS * 2;
        if (band.kind === "REFUGEES" && near && band.goal.kind === "SETTLEMENT") {
          events.push({ type: "SHELTERED", band, settlementId: band.goal.id });
          gone.add(band);
          continue;
        }
        // Exército de um lorde: chegou ao alvo (cerco) ou de volta a casa (Marco 15)
        if (band.armyId && near && band.goal.kind === "SETTLEMENT") {
          if (band.homeward || this.winter) {
            events.push({ type: "ARMY_HOME", band });
            gone.add(band);
          } else {
            band.waiting = true;
            events.push({ type: "ARMY_AT", band, townId: band.goal.id });
          }
          continue;
        }
        if (band.kind === "FACTION" && this.winter && near && band.goal.kind === "SETTLEMENT") {
          events.push({ type: "QUARTERED", band, settlementId: band.goal.id });
          gone.add(band);
          continue;
        }
        if (near && isRaiderKind(band.kind)) events.push({ type: "ARRIVED", band, goal: band.goal });
        if (band.goal.kind === "WANDER" || !near || !isRaiderKind(band.kind)) {
          this.chooseGoal(band);
          // Sem rota para lugar nenhum: espera um pouco antes de tentar de novo
          if (band.route.length === 0) band.rest = 800;
        }
      }
    }
    this.skirmishes(events);
    for (const b of gone) this.disband(b);
    this.bands = this.bands.filter((b) => bandSize(b) > 0);
    return events;
  }

  /**
   * Caçada: a patrulha vai atrás do bando hostil mais perto das terras do reino; os goblins,
   * atrás de caravanas (refaz a rota se a presa se afastar).
   */
  private hunt(band: Warband, isPrey: (o: Warband) => boolean, radius: number): void {
    let prey: Warband | null = null;
    let best = radius;
    for (const o of this.bands) {
      if (o === band || !isPrey(o)) continue;
      const d = distance(o.anchor, band.anchor);
      if (d < best && bandSize(o) > 0) {
        best = d;
        prey = o;
      }
    }
    if (!prey) {
      if (band.huntId) {
        band.huntId = null;
        this.chooseGoal(band);
      }
      return;
    }
    if (band.huntId === prey.id && distance(band.goalPoint, prey.anchor) < 800 && band.route.length > 0) return;
    band.huntId = prey.id;
    band.goal = { kind: "WANDER" };
    band.goalPoint = { ...prey.anchor };
    band.route = this.pathfind(band.anchor, prey.anchor) ?? [];
  }

  /**
   * Bandos que se encontram longe do jogador: patrulha contra goblins ou horda (o mais forte
   * vence; o vencedor perde gente na proporção da força do outro); bando hostil que alcança
   * refugiados acaba com eles.
   */
  private skirmishes(events: WarbandEvent[]): void {
    if (this.allied) return;
    const W = AGENTS.SKIRMISH_WEIGHT;
    for (const a of this.bands) {
      if (bandSize(a) === 0) continue;
      for (const b of this.bands) {
        if (a === b || bandSize(b) === 0 || distance(a.anchor, b.anchor) > AGENTS.SKIRMISH_RADIUS) continue;
        if (b.kind === "REFUGEES" && (a.kind === "GOBLIN" || a.kind === "HORDE")) {
          this.kill(b, bandSize(b));
          events.push({ type: "MASSACRE", band: b, by: a });
          continue;
        }
        // Goblins ou horda alcançam uma caravana: os guardas resistem ou a carga vai com eles (Marco 14)
        if (b.kind === "CARAVAN" && b.cargo && (a.kind === "GOBLIN" || a.kind === "HORDE")) {
          // Os dois à vista: a luta é de verdade
          if (a.materialized && b.materialized) continue;
          if (a.members.some((m) => m.target) || b.members.some((m) => m.target)) continue;
          const sa = bandSize(a) * (W[a.kind] ?? 1) * (0.8 + Math.random() * 0.4);
          const sb = bandSize(b) * (W.CARAVAN ?? 1) * (0.8 + Math.random() * 0.4);
          if (sa >= sb) {
            const cargo = b.cargo;
            if (a.kind === "GOBLIN") a.loot = { good: cargo.good, qty: cargo.qty, townId: cargo.from };
            this.kill(b, bandSize(b));
            this.kill(a, Math.min(bandSize(a) - 1, Math.round(bandSize(a) * Math.min(0.6, sb / sa) * 0.4)));
            events.push({ type: "CARAVAN_RAIDED", band: b, by: a, cargo });
            if (a.huntId) {
              a.huntId = null;
              this.chooseGoal(a);
            }
          } else {
            this.kill(a, Math.max(1, Math.round(bandSize(a) * 0.5)));
            this.kill(b, Math.min(bandSize(b) - 2, 1));
          }
          continue;
        }
        // Exércitos de reinos em guerra, ou contra hordas e goblins (Marco 15)
        const rivals = a.kind === "FACTION" && b.kind === "FACTION" && a.id < b.id && !!a.ownerId && !!b.ownerId && this.atWar(a.ownerId, b.ownerId);
        const vermin = a.kind === "FACTION" && (b.kind === "HORDE" || b.kind === "GOBLIN");
        if (rivals || vermin) {
          // Dentro da bolha, a batalha é de verdade (Marco 16): os dois lados em campo
          if (this.inBubble(a) && this.inBubble(b)) continue;
          if (a.members.some((m) => m.target) || b.members.some((m) => m.target)) continue;
          const skill = (band: Warband) => 1 + ((band.staff?.competence ?? 2) - 3) * WAR_AI.BATTLE_SKILL;
          const sa = bandSize(a) * (W.FACTION ?? 1.2) * skill(a) * (0.8 + Math.random() * 0.4);
          const sb = bandSize(b) * (W[b.kind] ?? 1) * skill(b) * (0.8 + Math.random() * 0.4);
          const [winner, loser, sw, sl] = sa >= sb ? [a, b, sa, sb] : [b, a, sb, sa];
          const losses = Math.min(bandSize(winner) - 1, Math.round(bandSize(winner) * Math.min(0.8, sl / sw) * 0.5));
          this.kill(loser, bandSize(loser));
          this.kill(winner, Math.max(0, losses));
          events.push({ type: "ARMY_CLASH", winner, loser, at: { x: (a.anchor.x + b.anchor.x) / 2, y: (a.anchor.y + b.anchor.y) / 2 }, losses });
          continue;
        }
        if (a.kind !== "PATROL" || (b.kind !== "GOBLIN" && b.kind !== "HORDE")) continue;
        // Os dois à vista: a luta é de verdade, soldado contra soldado (ver Enemy.think)
        if (a.materialized && b.materialized) continue;
        // Bando em luta com o jogador não para para brigar com a patrulha
        if (a.members.some((m) => m.target) || b.members.some((m) => m.target)) continue;
        const sa = bandSize(a) * (W[a.kind] ?? 1) * (0.8 + Math.random() * 0.4);
        const sb = bandSize(b) * (W[b.kind] ?? 1) * (0.8 + Math.random() * 0.4);
        const [winner, loser, sw, sl] = sa >= sb ? [a, b, sa, sb] : [b, a, sb, sa];
        const losses = Math.min(bandSize(winner) - 1, Math.round(bandSize(winner) * Math.min(0.8, sl / sw) * 0.5));
        this.kill(loser, bandSize(loser));
        this.kill(winner, Math.max(0, losses));
        events.push({ type: "SKIRMISH", winner, loser, at: { x: (a.anchor.x + b.anchor.x) / 2, y: (a.anchor.y + b.anchor.y) / 2 }, losses });
        if (winner.kind === "PATROL") {
          winner.huntId = null;
          this.chooseGoal(winner);
        }
      }
    }
  }

  /** Tira `n` integrantes do bando (em campo, morrem de verdade). */
  private kill(band: Warband, n: number): void {
    if (n <= 0) return;
    if (band.materialized) {
      for (const m of band.members.filter((x) => x.isAlive).slice(0, n)) m.takeDamage(m.hp + 999, m, 0);
      band.members = band.members.filter((m) => m.isAlive);
    } else {
      band.roster = band.roster.slice(n);
    }
  }

  private validTarget(band: Warband, id: string): boolean {
    const t = this.targets().settlements.find((x) => x.id === id);
    if (!t || t.owner === "RUINED") return false;
    // Patrulhas e mensageiros andam entre os povoados do próprio reino; refugiados, para qualquer um de pé
    if (band.kind === "PATROL" || band.kind === "COURIER") return t.owner === band.ownerId;
    if (band.kind === "REFUGEES") return !isCalamityOwner(t.owner);
    // Caravana: o destino foi escolhido na partida (o que acontecer lá, a cena resolve)
    if (band.kind === "CARAVAN") return true;
    // Camponeses em revolta só querem a própria terra
    if (band.kind === "REBELS") return band.goal.kind === "SETTLEMENT" && t.id === band.goal.id;
    // Exército de um lorde (Marco 15): segue para o alvo; voltando, qualquer casa do reino serve
    if (band.armyId) {
      if (band.homeward || this.winter) return t.owner === band.ownerId;
      return band.goal.kind === "SETTLEMENT" && t.id === band.goal.id;
    }
    // Inverno: o exército volta para casa (quartéis de inverno)
    if (band.kind === "FACTION") return this.winter ? t.owner === band.ownerId : t.owner === "PLAYER";
    if (band.ownerId && t.owner === band.ownerId) return false;
    return true;
  }

  /** O povoado válido mais próximo a que se chega por terra (com a rota até ele). */
  private nearestTarget(band: Warband): { t: Settlement; route: Point[] } | null {
    const options = this.targets().settlements.filter((t) => this.validTarget(band, t.id));
    options.sort((a, b) => distance(a, band.anchor) - distance(b, band.anchor));
    for (const t of options.slice(0, 4)) {
      const route = this.pathfind(band.anchor, t);
      if (route) return { t, route };
    }
    return null;
  }

  /** Próximo alvo conforme o tipo de bando, sempre com uma rota por terra. */
  private chooseGoal(band: Warband): void {
    // A caravana segue a rota da partida até o fim
    if (band.kind === "CARAVAN") return;
    const { camp } = this.targets();
    const toSettlement = (target: { t: Settlement; route: Point[] }) => {
      band.goal = { kind: "SETTLEMENT", id: target.t.id };
      band.goalPoint = { x: target.t.x, y: target.t.y };
      band.route = target.route;
    };
    const toCamp = (): boolean => {
      // Acampamento levantado: não há onde atacar
      if (!camp) return false;
      const route = this.pathfind(band.anchor, camp);
      if (!route) return false;
      band.goal = { kind: "CAMP" };
      band.goalPoint = camp;
      band.route = route;
      return true;
    };
    const wander = () => {
      for (let i = 0; i < 4; i++) {
        const p = clampToWorldBounds({ x: band.anchor.x + (Math.random() - 0.5) * 4000, y: band.anchor.y + (Math.random() - 0.5) * 3000 }, 300);
        const route = this.pathfind(band.anchor, p);
        if (!route) continue;
        band.goal = { kind: "WANDER" };
        band.goalPoint = route[route.length - 1] ?? p;
        band.route = route;
        return;
      }
      band.goal = { kind: "WANDER" };
      band.goalPoint = { ...band.anchor };
      band.route = [];
    };
    // Patrulha e mensageiro: o próximo povoado do reino (outro que não o de agora)
    if (band.kind === "PATROL" || band.kind === "COURIER") {
      const own = this.targets().settlements.filter((t) => this.validTarget(band, t.id) && distance(t, band.anchor) > 1500);
      const t = own[Math.floor(Math.random() * own.length)];
      const route = t ? this.pathfind(band.anchor, t) : null;
      if (t && route) toSettlement({ t, route });
      else wander();
      return;
    }
    // Refugiados: o povoado de pé mais perto (o primeiro escolhido não muda até chegarem)
    if (band.kind === "REFUGEES") {
      const options = this.targets()
        .settlements.filter((t) => this.validTarget(band, t.id) && distance(t, band.anchor) > 1500)
        .sort((a, b) => distance(a, band.anchor) - distance(b, band.anchor));
      for (const t of options.slice(0, 3)) {
        const route = this.pathfind(band.anchor, t);
        if (route) return toSettlement({ t, route });
      }
      wander();
      return;
    }
    const target = this.nearestTarget(band);
    if (band.kind === "REBELS") return;
    if (band.kind === "FACTION" || band.kind === "HORDE") {
      if (target) toSettlement(target);
      else if ((band.kind === "FACTION" && this.winter) || !toCamp()) wander();
      return;
    }
    const r = Math.random();
    if (r < 0.45 && target) toSettlement(target);
    else if (!(r < 0.7 && band.goal.kind !== "CAMP" && toCamp())) wander();
  }
}

/** Tira uma unidade de cena sem animação de morte (saiu da bolha ou foi resolvida no abstrato). */
function despawn(e: Enemy): void {
  if (!e.isAlive) return;
  e.unitState = "DEAD";
  e.target = null;
  e.destroy();
}

import type { Enemy } from "../entities/Enemy";
import { clampToWorldBounds } from "../data/world";
import { chiefName } from "../worldgen/names";
import { isCalamityOwner, isRaiderKind, type BandKind, type CalamityKind, type Settlement } from "../sim/realm";
import { AGENTS, WORLD, type EnemyKind } from "../../utils/constants";
import { centroid, distance, type Point } from "../../utils/math";

export type WarbandGoal = { kind: "SETTLEMENT"; id: string } | { kind: "CAMP" } | { kind: "WANDER" };

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
}

/** Bando salvo: sempre como dados (quem estava em campo vira roster com a posição de agora). */
export type WarbandSave = Omit<Warband, "materialized" | "members" | "offsets" | "route" | "trail" | "huntId">;

export interface WarbandsSave {
  seq: number;
  lastGoblinDay: number;
  bands: WarbandSave[];
}

export type WarbandEvent =
  | { type: "ARRIVED"; band: Warband; goal: WarbandGoal }
  | { type: "DESTROYED"; band: Warband }
  /** Dois bandos se enfrentaram longe do jogador (patrulha contra goblins, horda contra patrulha...). */
  | { type: "SKIRMISH"; winner: Warband; loser: Warband; at: Point; losses: number }
  /** Refugiados chegaram a um lugar seguro. */
  | { type: "SHELTERED"; band: Warband; settlementId: string }
  /** Refugiados alcançados por um bando hostil. */
  | { type: "MASSACRE"; band: Warband; by: Warband };

/** O que os bandos precisam saber do mundo para escolher alvos. */
export interface WarbandTargets {
  settlements: readonly Settlement[];
  camp: Point;
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

  constructor(
    private readonly spawn: (x: number, y: number, kind: EnemyKind, color?: number) => Enemy,
    private readonly targets: () => WarbandTargets,
    /** Rota por terra de um ponto a outro (null = não há como chegar). */
    private readonly pathfind: (from: Point, to: Point) => Point[] | null,
    /** Dia de agora (com fração), para datar os rastros. */
    private readonly clock: () => number = () => 0,
  ) {}

  /** Goblins: um bando novo a cada poucos dias, num covil que ninguém está vendo. */
  maybeSpawnGoblins(day: number, lairs: readonly Point[], canSee: (p: Point) => boolean): Warband | null {
    const W = WORLD.WARBAND;
    const goblins = this.bands.filter((b) => b.kind === "GOBLIN").length;
    if (day < W.FIRST_DAY || day - this.lastGoblinDay < W.EVERY_DAYS || goblins >= W.MAX) return null;
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
    const kinds = spec.units.flatMap(([kind, n]) => Array<EnemyKind>(n).fill(kind));
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
    };
    this.chooseGoal(band);
    this.bands.push(band);
    return band;
  }

  /**
   * Entrada e saída da bolha de detalhe. `anchors` = onde está o bando do jogador
   * (Comandante, batalhões, batedores, mensageiros).
   */
  updateBubble(anchors: readonly Point[]): void {
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

  /** Bando chegou e o alvo caiu ou o repeliu: escolhe outro (ou se dissolve na guarnição). */
  retarget(band: Warband): void {
    this.chooseGoal(band);
  }

  /** Rota nova até o mesmo alvo (o mapa mudou: ponte queimada ou reconstruída). */
  repath(band: Warband): void {
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
      })),
    };
  }

  /** Bandos de um save: todos voltam como dados (a bolha os põe em campo se estiverem perto). */
  restore(data: WarbandsSave): void {
    for (const b of this.bands) this.disband(b);
    this.seq = data.seq;
    this.lastGoblinDay = data.lastGoblinDay;
    this.bands = data.bands.map((b) => ({
      ...b,
      roster: b.roster.map((r) => ({ ...r, hp: r.hp < 0 ? Infinity : r.hp })),
      materialized: false,
      members: [],
      offsets: new Map(),
      route: [],
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
      // Patrulhas, mensageiros e refugiados nascem em paz (a cena acerta a guerra no quadro seguinte)
      e.hostile = isRaiderKind(band.kind) || (band.provoked && band.kind === "PATROL");
      e.home = { x: e.x, y: e.y };
      band.offsets.set(e, r.offset);
      return e;
    });
    band.roster = [];
  }

  private dematerialize(band: Warband): void {
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
    for (const band of this.bands) {
      const stepDist = baseDist * (band.kind === "COURIER" ? AGENTS.COURIER_SPEED : 1);
      if (band.materialized) band.members = band.members.filter((m) => m.isAlive);
      if (bandSize(band) === 0) {
        events.push({ type: "DESTROYED", band });
        continue;
      }
      if (band.members.some((m) => m.target)) {
        band.anchor = centroid(band.members);
        continue;
      }
      // O alvo pode ter mudado de dono no caminho (a horda não ataca o que já é dela)
      if (band.goal.kind === "SETTLEMENT" && !this.validTarget(band, band.goal.id)) this.chooseGoal(band);
      if (band.kind === "PATROL") this.hunt(band);

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

  /** Patrulha: vai atrás do bando hostil mais perto das terras do reino (refaz a rota se ele se afastar). */
  private hunt(band: Warband): void {
    let prey: Warband | null = null;
    let best: number = AGENTS.HUNT_RADIUS;
    for (const o of this.bands) {
      if (o.kind !== "GOBLIN" && o.kind !== "HORDE") continue;
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
        if (a.kind !== "PATROL" || (b.kind !== "GOBLIN" && b.kind !== "HORDE")) continue;
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
    if (band.ownerId && t.owner === band.ownerId) return false;
    if (band.kind === "FACTION") return t.owner === "PLAYER";
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
    const { camp } = this.targets();
    const toSettlement = (target: { t: Settlement; route: Point[] }) => {
      band.goal = { kind: "SETTLEMENT", id: target.t.id };
      band.goalPoint = { x: target.t.x, y: target.t.y };
      band.route = target.route;
    };
    const toCamp = (): boolean => {
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
    if (band.kind === "FACTION" || band.kind === "HORDE") {
      if (target) toSettlement(target);
      else if (!toCamp()) wander();
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

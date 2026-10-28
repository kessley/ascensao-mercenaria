import type { Enemy } from "../entities/Enemy";
import { clampToWorldBounds } from "../data/world";
import { chiefName } from "../worldgen/names";
import type { BandKind, CalamityKind, Settlement } from "../sim/realm";
import { WORLD, type EnemyKind } from "../../utils/constants";
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
  /** Já foi avistado alguma vez (o primeiro avistamento vira notícia). */
  spotted: boolean;
  /** Última posição conhecida (Mapa Múndi). */
  lastSeen: { x: number; y: number; day: number } | null;
}

/** Bando salvo: sempre como dados (quem estava em campo vira roster com a posição de agora). */
export type WarbandSave = Omit<Warband, "materialized" | "members" | "offsets">;

export interface WarbandsSave {
  seq: number;
  lastGoblinDay: number;
  bands: WarbandSave[];
}

export type WarbandEvent =
  | { type: "ARRIVED"; band: Warband; goal: WarbandGoal }
  | { type: "DESTROYED"; band: Warband };

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
 */
export class WarbandManager {
  bands: Warband[] = [];
  private lastGoblinDay = 0;
  private seq = 0;

  constructor(
    private readonly spawn: (x: number, y: number, kind: EnemyKind, color?: number) => Enemy,
    private readonly targets: () => WarbandTargets,
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
      spotted: false,
      lastSeen: null,
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
        spotted: b.spotted,
        lastSeen: b.lastSeen,
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
    }));
  }

  private materialize(band: Warband): void {
    band.materialized = true;
    band.members = band.roster.map((r) => {
      const e = this.spawn(band.anchor.x + r.offset.x, band.anchor.y + r.offset.y, r.kind, band.color);
      if (Number.isFinite(r.hp)) e.restoreHp(r.hp);
      e.owner = { kind: "WARBAND", id: band.id };
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

  private step(stepDist: number): WarbandEvent[] {
    const events: WarbandEvent[] = [];
    for (const band of this.bands) {
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

      const d = distance(band.anchor, band.goalPoint);
      const move = Math.min(d, stepDist);
      const dx = d > 0 ? ((band.goalPoint.x - band.anchor.x) / d) * move : 0;
      const dy = d > 0 ? ((band.goalPoint.y - band.anchor.y) / d) * move : 0;
      band.anchor = { x: band.anchor.x + dx, y: band.anchor.y + dy };
      for (const m of band.members) {
        const o = band.offsets.get(m) ?? { x: 0, y: 0 };
        m.home = { x: band.anchor.x + o.x, y: band.anchor.y + o.y };
        if (m.dormant) {
          m.x += dx;
          m.y += dy;
        }
      }
      if (d - move <= WORLD.WARBAND.RAID_RADIUS) {
        events.push({ type: "ARRIVED", band, goal: band.goal });
        if (band.goal.kind === "WANDER") this.chooseGoal(band);
      }
    }
    this.bands = this.bands.filter((b) => bandSize(b) > 0);
    return events;
  }

  private validTarget(band: Warband, id: string): boolean {
    const t = this.targets().settlements.find((x) => x.id === id);
    if (!t || t.owner === "RUINED" || (band.ownerId && t.owner === band.ownerId)) return false;
    if (band.kind === "FACTION") return t.owner === "PLAYER";
    return true;
  }

  private nearestTarget(band: Warband): Settlement | null {
    const options = this.targets().settlements.filter((t) => this.validTarget(band, t.id));
    options.sort((a, b) => distance(a, band.anchor) - distance(b, band.anchor));
    return options[0] ?? null;
  }

  /** Próximo alvo conforme o tipo de bando. */
  private chooseGoal(band: Warband): void {
    const { camp } = this.targets();
    const toSettlement = (t: Settlement) => {
      band.goal = { kind: "SETTLEMENT", id: t.id };
      band.goalPoint = { x: t.x, y: t.y };
    };
    const toCamp = () => {
      band.goal = { kind: "CAMP" };
      band.goalPoint = camp;
    };
    const target = this.nearestTarget(band);
    if (band.kind === "FACTION" || band.kind === "HORDE") {
      if (target) toSettlement(target);
      else toCamp();
      return;
    }
    const r = Math.random();
    if (r < 0.45 && target) toSettlement(target);
    else if (r < 0.7 && band.goal.kind !== "CAMP") toCamp();
    else {
      band.goal = { kind: "WANDER" };
      band.goalPoint = clampToWorldBounds(
        { x: band.anchor.x + (Math.random() - 0.5) * 4000, y: band.anchor.y + (Math.random() - 0.5) * 3000 },
        300,
      );
    }
  }
}

/** Tira uma unidade de cena sem animação de morte (saiu da bolha ou foi resolvida no abstrato). */
function despawn(e: Enemy): void {
  if (!e.isAlive) return;
  e.unitState = "DEAD";
  e.target = null;
  e.destroy();
}

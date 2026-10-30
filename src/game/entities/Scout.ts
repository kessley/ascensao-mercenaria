import Phaser from "phaser";
import { Unit } from "./Unit";
import { drawRiderShape } from "./shapes";
import type { Commander } from "./Commander";
import type { Enemy } from "./Enemy";
import { COLORS, SUPPORT } from "../../utils/constants";
import { centroid, distance, type Point } from "../../utils/math";
import { scoutRank, type ScoutData } from "../data/riders";

export type ScoutMode = "VANGUARD" | "EXPLORE" | "RECALL" | "REGION" | "PATROL" | "SHADOW" | "RETURN";

/** Ordem dada a um batedor (também é o que a harpia leva). */
export type ScoutOrder =
  | { kind: "VANGUARD" | "RECALL" | "RETURN" }
  | { kind: "WATCH"; point: Point }
  | { kind: "REGION"; point: Point; radius: number }
  | { kind: "PATROL"; points: Point[] }
  | { kind: "SHADOW"; bandId: string };

/** O que o batedor viu de um bando (a contagem erra conforme a patente). */
export interface ScoutSighting {
  bandId: string;
  name: string;
  x: number;
  y: number;
  day: number;
  count: number;
  hostile: boolean;
}

/** O que ele ainda não contou: de onde olhou, quem viu e os ninhos que achou. */
export interface ScoutReport {
  views: Point[];
  radius: number;
  sightings: ScoutSighting[];
  nests: string[];
}

/** Área de um hostil visto: fica evitada por um tempo, mesmo depois de ele sair de vista. */
interface DangerZone {
  x: number;
  y: number;
  r: number;
  until: number;
}

/** O que o batedor precisa saber do mundo a cada quadro. */
export interface ScoutWorld {
  commander: Commander;
  threats: readonly Enemy[];
  time: number;
  day: number;
  /** Onde o bando seguido está agora (null = ele sumiu do mundo). */
  bandAt: (id: string) => Point | null;
  isExplored: (p: Point) => boolean;
  isOpen: (p: Point) => boolean;
  /** Colina ou mata por perto para vigiar melhor. */
  lookout: (p: Point) => Point | null;
}

/** Hostil na hora de um salto de tempo (fora de cena, só posição). */
export interface ScoutHazard extends Point {
  size: number;
  bandId: string;
  name: string;
}

const emptyReport = (radius: number): ScoutReport => ({ views: [], radius, sightings: [], nests: [] });
const cellKey = (i: number, j: number) => `${i},${j}`;

/**
 * Batedor: cavaleiro rápido e esquivo que amplia a visão do Comandante e NUNCA luta.
 * Ele enxerga longe e fica fora da percepção de cada hostil: contorna antes de ser notado, e a
 * área de um bando visto fica marcada por um tempo (não volta a meter a cara nela).
 * - Vanguarda: à frente do Comandante, na direção em que ele anda.
 * - Vigia: vai até um ponto e fica lá (procura colina ou mata por perto).
 * - Explorar região, patrulhar rota, seguir bando: missões longe do bando.
 * - Recolher: ao lado do Comandante. Voltar: volta para contar o que viu.
 * Longe demais (LIVE_RANGE) ele fica fora de contato: o que vê só chega quando ele voltar ou
 * mandar a harpia.
 */
export class Scout extends Unit {
  rider: ScoutData;
  mode: ScoutMode = "VANGUARD";
  explorePoint: Point | null = null;
  selected = false;
  /** Postura furtiva: percebido de menos longe, andando mais devagar. */
  sneaking = false;
  /** Perto o bastante para a visão ser ao vivo. */
  inContact = true;
  /** Viu algo que precisa chegar logo (a harpia parte na hora). */
  urgent = false;
  /** Bandos que já motivaram um alerta (a harpia não sai de novo pelo mesmo). */
  alerted = new Set<string>();
  /** Recuando de alguém que chegou perto demais. */
  evading = false;
  /** Último ponto em que o Comandante soube dele. */
  lastContact: Point;
  /** Quando saiu de contato (para voltar a tempo, se não tiver harpia). */
  awaySince = 0;
  region: { point: Point; radius: number } | null = null;
  patrol: Point[] = [];
  patrolIndex = 0;
  shadowId: string | null = null;
  /** Ordem a levar até um batalhão destacado (a última parte, a cavalo). */
  relay: { to: () => Point | null; apply: () => void; label: string } | null = null;

  private report: ScoutReport;
  private zones = new Map<Enemy, DangerZone>();
  private scanned = new Set<string>();
  private cell: Point | null = null;
  private settled = false;
  private lastScanAt = -Infinity;
  private lastViewAt: Point | null = null;
  private stuck: { at: Point; since: number } | null = null;
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, data: ScoutData) {
    super(scene, x, y, "ALLY", SUPPORT.SCOUT.stats);
    this.rider = data;
    this.autoAttack = false;
    this.canCharge = true; // sofre o terreno como cavalaria (sem investida: não ataca)
    this.isScout = true;
    this.role = "SCOUT";
    this.unlit = true; // batedor não leva tocha
    this.evasion = SUPPORT.SCOUT.evasion + scoutRank(data.missions) * SUPPORT.SCOUT.RANK_EVASION;
    this.lastContact = { x, y };
    this.report = emptyReport(this.vision);
    this.selectionGfx = scene.add.graphics();
    this.addAt(this.selectionGfx, 0);
    this.drawBody();
  }

  protected drawBody(): void {
    drawRiderShape(this.bodyGfx, COLORS.SCOUT, this.radius, COLORS.SELECTION);
  }

  get rank(): number {
    return scoutRank(this.rider.missions);
  }

  /** Raio de visão: veteranos enxergam mais longe. */
  get vision(): number {
    return SUPPORT.VISION.SCOUT * (1 + this.rank * SUPPORT.SCOUT.RANK_VISION);
  }

  /** Em missão: anda por conta própria, sem acompanhar o Comandante. */
  get onMission(): boolean {
    return this.mode === "REGION" || this.mode === "PATROL" || this.mode === "SHADOW" || this.mode === "EXPLORE" || this.mode === "RETURN";
  }

  get hasNews(): boolean {
    return this.report.views.length > 0 || this.report.sightings.length > 0 || this.report.nests.length > 0;
  }

  override speedMultiplier(): number {
    return super.speedMultiplier() * (this.sneaking ? SUPPORT.SCOUT.STEALTH_SPEED : 1);
  }

  setSneaking(on: boolean): void {
    this.sneaking = on;
    this.stealth = on ? SUPPORT.SCOUT.STEALTH : 1;
  }

  setMode(mode: ScoutMode, point: Point | null = null): void {
    this.mode = mode;
    this.explorePoint = point;
    this.settled = false;
    this.stuck = null;
    if (!this.inContact) this.awaySince = this.scene.time.now;
  }

  setOrder(order: ScoutOrder): void {
    this.region = null;
    this.patrol = [];
    this.shadowId = null;
    this.cell = null;
    switch (order.kind) {
      case "VANGUARD":
      case "RECALL":
      case "RETURN":
        this.setMode(order.kind);
        break;
      case "WATCH":
        this.setMode("EXPLORE", order.point);
        break;
      case "REGION":
        this.scanned.clear();
        this.region = { point: order.point, radius: order.radius };
        this.setMode("REGION");
        break;
      case "PATROL":
        this.patrol = order.points.map((p) => ({ ...p }));
        this.patrolIndex = 0;
        this.setMode("PATROL");
        break;
      case "SHADOW":
        this.shadowId = order.bandId;
        this.setMode("SHADOW");
        break;
    }
  }

  /** Entrega o que tem para contar e começa um relatório novo. */
  takeReport(): ScoutReport {
    const r = this.report;
    this.report = emptyReport(this.vision);
    return r;
  }

  /** Relatório perdido no caminho de volta para ele (harpia que não chegou a sair). */
  restoreReport(r: ScoutReport): void {
    this.report = {
      radius: r.radius,
      views: [...r.views, ...this.report.views],
      sightings: [...r.sightings.filter((a) => !this.report.sightings.some((b) => b.bandId === a.bandId)), ...this.report.sightings],
      nests: [...r.nests, ...this.report.nests],
    };
  }

  /** De onde olhou (um ponto a cada tanto de estrada: a névoa é revelada a partir deles). */
  noteView(): void {
    if (this.lastViewAt && distance(this.lastViewAt, this) < this.vision * 0.4) return;
    this.lastViewAt = { x: this.x, y: this.y };
    this.report.views.push(this.lastViewAt);
  }

  noteSighting(s: ScoutSighting): void {
    const i = this.report.sightings.findIndex((x) => x.bandId === s.bandId);
    if (i >= 0) this.report.sightings[i] = s;
    else this.report.sightings.push(s);
  }

  noteNest(id: string): void {
    if (!this.report.nests.includes(id)) this.report.nests.push(id);
  }

  /** Quantos ele conta num bando: novatos erram mais. */
  countOf(real: number): number {
    const err = SUPPORT.SCOUT.COUNT_ERROR[this.rank] ?? 0;
    return Math.max(1, Math.round(real * (1 + (Math.random() * 2 - 1) * err)));
  }

  /** Dá para perceber este inimigo daqui? Na mata, só bem de perto (é assim que se embosca um batedor). */
  notices(e: Enemy): boolean {
    const d = distance(e, this);
    if (d > this.vision) return false;
    return !e.isInForest || d <= SUPPORT.SCOUT.FOREST_NOTICE + this.rank * SUPPORT.SCOUT.FOREST_NOTICE_RANK;
  }

  private dangerous(e: Enemy): boolean {
    return e.isAlive && !e.friendly && (e.hostile || e.provoked) && e.perceptionOf(this) > 0;
  }

  /** Distância mínima deste hostil: a percepção dele e a folga. */
  private safeFrom(e: Enemy): number {
    return Math.min(SUPPORT.SCOUT.SAFE_MAX, e.perceptionOf(this)) + SUPPORT.SCOUT.SAFE_MARGIN;
  }

  /** Atualiza as áreas de perigo com quem está à vista e esquece as velhas. */
  private observe(threats: readonly Enemy[], now: number): void {
    for (const e of threats) {
      if (!this.dangerous(e) || !this.notices(e)) continue;
      this.zones.set(e, { x: e.x, y: e.y, r: this.safeFrom(e), until: now + SUPPORT.SCOUT.DANGER_MEMORY_MS });
    }
    for (const [e, z] of this.zones) if (z.until < now || !e.isAlive) this.zones.delete(e);
  }

  private inZone(p: Point): boolean {
    for (const z of this.zones.values()) if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 < z.r * z.r) return true;
    return false;
  }

  /** Destino dentro de uma área de perigo: fica na borda, do lado de cá (assim ele não vai e volta). */
  private clearOfZones(goal: Point): Point {
    let g = goal;
    for (let i = 0; i < 3; i++) {
      let moved = false;
      for (const z of this.zones.values()) {
        const d = Math.hypot(g.x - z.x, g.y - z.y);
        if (d >= z.r + 20) continue;
        const from = Math.hypot(this.x - z.x, this.y - z.y) || 1;
        const r = z.r + 40;
        g = { x: z.x + ((this.x - z.x) / from) * r, y: z.y + ((this.y - z.y) / from) * r };
        moved = true;
      }
      if (!moved) break;
    }
    return g;
  }

  /** Direção para o destino contornando as áreas de perigo à frente (null = caminho livre). */
  private steer(goal: Point): Point | null {
    const dist = distance(this, goal) || 1;
    const dx = (goal.x - this.x) / dist;
    const dy = (goal.y - this.y) / dist;
    const ahead: { rx: number; ry: number; w: number; push: number }[] = [];
    let lean = 0;
    for (const z of this.zones.values()) {
      const zx = this.x - z.x;
      const zy = this.y - z.y;
      const zd = Math.hypot(zx, zy) || 1;
      const clear = zd - z.r;
      if (clear > 220 || clear > dist) continue;
      const rx = zx / zd;
      const ry = zy / zd;
      // Quem ficou para trás não atrapalha
      if (rx * dx + ry * dy > 0.25) continue;
      const w = clear <= 0 ? 2 : 1 - clear / 220;
      ahead.push({ rx, ry, w, push: clear < 60 ? 0.5 : 0 });
      lean += (-ry * dx + rx * dy) * w;
    }
    if (ahead.length === 0) return null;
    // Um lado só para todos: num bando junto, cada um empurrando para um lado o faria parar
    const side = lean >= 0 ? 1 : -1;
    let vx = 0;
    let vy = 0;
    let weight = 0;
    for (const a of ahead) {
      vx += (-a.ry * side + a.rx * a.push) * a.w;
      vy += (a.rx * side + a.ry * a.push) * a.w;
      weight += a.w;
    }
    const keep = Math.max(0, 1 - weight);
    vx += dx * keep;
    vy += dy * keep;
    const v = Math.hypot(vx, vy) || 1;
    return { x: this.x + (vx / v) * 140, y: this.y + (vy / v) * 140 };
  }

  think(dt: number, world: ScoutWorld): void {
    if (!this.isAlive) return;
    this.target = null;
    const now = world.time;
    this.observe(world.threats, now);
    this.scan(now);

    // Nunca entra em combate: chegou alguém perto demais, sai de perto
    const inside = world.threats.filter((e) => this.dangerous(e) && this.notices(e) && distance(e, this) < this.safeFrom(e));
    this.evading = inside.length > 0;
    if (this.evading) {
      this.flee(inside, world.commander, dt);
      this.redrawSelection();
      return;
    }

    if (this.onMission && this.mode !== "RETURN") {
      const hurt = this.hp < this.maxHp * SUPPORT.SCOUT.RETREAT_HP;
      const late = !this.inContact && !this.rider.harpy && this.mode !== "REGION" && this.mode !== "PATROL" && now - this.awaySince > SUPPORT.SCOUT.AWAY_MS;
      if (hurt || late) this.setOrder({ kind: "RETURN" });
    }

    const goal = this.goalOf(world);
    if (!goal) {
      this.unitState = "IDLE";
      this.redrawSelection();
      return;
    }
    // Ordem para um batalhão: entrega ao chegar perto (ninguém encosta no meio da tropa)
    if (this.relay && distance(this, goal) <= SUPPORT.HARPY.RELAY_REACH) {
      const relay = this.relay;
      this.relay = null;
      relay.apply();
      this.redrawSelection();
      return;
    }
    const safe = this.clearOfZones(goal);
    const detour = this.steer(safe);
    const arrived = detour ? (this.moveTowards(detour.x, detour.y, dt), false) : this.moveTowards(safe.x, safe.y, dt);
    this.unitState = arrived ? "IDLE" : "MOVING";
    if (arrived) this.onArrived(goal, world);
    else this.checkStuck(now);
    this.redrawSelection();
  }

  /** Recua do centro dos hostis; perseguido, nunca na direção do bando. */
  private flee(inside: readonly Enemy[], commander: Commander, dt: number): void {
    const c = centroid(inside);
    const d = distance(c, this) || 1;
    let ax = (this.x - c.x) / d;
    let ay = (this.y - c.y) / d;
    const chased = inside.some((e) => e.target === this);
    const toBand = distance(this, commander) || 1;
    if (chased && toBand < 2400) {
      const bx = (commander.x - this.x) / toBand;
      const by = (commander.y - this.y) / toBand;
      if (ax * bx + ay * by > 0.2) {
        // Vira de lado: o perseguidor não pode ser levado até o exército
        const side = ax * by - ay * bx >= 0 ? -1 : 1;
        const rx = -by * side;
        const ry = bx * side;
        ax = ax * 0.3 + rx;
        ay = ay * 0.3 + ry;
      }
    }
    this.moveTowards(this.x + ax * 140, this.y + ay * 140, dt);
    this.unitState = "FLEEING";
  }

  private goalOf(world: ScoutWorld): Point | null {
    if (this.relay) {
      const to = this.relay.to();
      if (to) return to;
      this.relay = null;
    }
    const c = world.commander;
    switch (this.mode) {
      case "EXPLORE":
        return this.explorePoint ?? c;
      case "RECALL":
        return { x: c.x - Math.cos(c.facing) * 40, y: c.y + 50 };
      case "RETURN":
        return c;
      case "REGION":
        return this.nextCell(world);
      case "PATROL":
        return this.patrol[this.patrolIndex % Math.max(1, this.patrol.length)] ?? c;
      case "SHADOW": {
        const band = this.shadowId ? world.bandAt(this.shadowId) : null;
        if (!band) {
          this.setOrder({ kind: "RETURN" });
          return c;
        }
        // Na sombra: vê o bando de longe, por fora da percepção de todos
        const d = distance(this, band) || 1;
        const keep = this.vision * 0.8;
        return { x: band.x + ((this.x - band.x) / d) * keep, y: band.y + ((this.y - band.y) / d) * keep };
      }
      default: {
        const f = c.facing;
        return { x: c.x + Math.cos(f) * SUPPORT.SCOUT.VANGUARD_DISTANCE, y: c.y + Math.sin(f) * SUPPORT.SCOUT.VANGUARD_DISTANCE };
      }
    }
  }

  private onArrived(_goal: Point, world: ScoutWorld): void {
    if (this.relay) return;
    if (this.mode === "EXPLORE" && !this.settled) {
      this.settled = true;
      const better = this.explorePoint ? world.lookout(this.explorePoint) : null;
      if (better) this.explorePoint = better;
    } else if (this.mode === "PATROL" && this.patrol.length > 0) {
      this.patrolIndex++;
      // Sem harpia, uma volta na rota e vem contar
      if (this.patrolIndex >= this.patrol.length && !this.rider.harpy && !this.inContact) this.setOrder({ kind: "RETURN" });
    } else if (this.mode === "REGION") {
      this.cell = null;
    }
  }

  /** Rio, montanha, porta fechada: sem sair do lugar, desiste daquele pedaço. */
  private checkStuck(now: number): void {
    const s = this.stuck;
    if (!s || distance(s.at, this) > 60) {
      this.stuck = { at: { x: this.x, y: this.y }, since: now };
      return;
    }
    if (now - s.since < SUPPORT.SCOUT.STUCK_MS) return;
    this.stuck = null;
    if (this.mode === "REGION" && this.cell) {
      this.scanned.add(this.keyAt(this.cell));
      this.cell = null;
    } else if (this.mode === "PATROL") {
      this.patrolIndex++;
    } else if (this.mode === "EXPLORE") {
      this.settled = true;
      this.explorePoint = { x: this.x, y: this.y };
    }
  }

  private keyAt(p: Point): string {
    const S = SUPPORT.SCOUT.SCAN_CELL;
    return cellKey(Math.floor(p.x / S), Math.floor(p.y / S));
  }

  /** Marca como visto o que está em volta dele (e anota de onde olhou, se está fora de contato). */
  private scan(now: number): void {
    if (now - this.lastScanAt < 400) return;
    this.lastScanAt = now;
    if (this.mode !== "REGION") return;
    const S = SUPPORT.SCOUT.SCAN_CELL;
    const r = this.vision * 0.75;
    const ci = Math.floor(this.x / S);
    const cj = Math.floor(this.y / S);
    const n = Math.ceil(r / S);
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        if (Math.hypot((i + 0.5) * S - this.x, (j + 0.5) * S - this.y) <= r) this.scanned.add(cellKey(i, j));
      }
    }
  }

  /** Próximo pedaço da região: o nunca visto mais perto; depois, o que ele ainda não reviu. */
  private nextCell(world: ScoutWorld): Point | null {
    if (this.cell && !this.scanned.has(this.keyAt(this.cell)) && !this.inZone(this.cell)) return this.cell;
    const reg = this.region;
    if (!reg) return world.commander;
    const S = SUPPORT.SCOUT.SCAN_CELL;
    const n = Math.ceil(reg.radius / S);
    const ci = Math.floor(reg.point.x / S);
    const cj = Math.floor(reg.point.y / S);
    let best: Point | null = null;
    let bestScore = Infinity;
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        const c = { x: (i + 0.5) * S, y: (j + 0.5) * S };
        if (distance(c, reg.point) > reg.radius || this.scanned.has(cellKey(i, j)) || !world.isOpen(c) || this.inZone(c)) continue;
        // O que já se conhece só vale depois de todo o resto
        const score = distance(this, c) + (world.isExplored(c) ? 100000 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    this.cell = best;
    if (best) return best;
    // Região coberta: volta para contar
    this.setOrder({ kind: "RETURN" });
    return world.commander;
  }

  /**
   * Dias que passam de uma vez (viagem rápida, sono, Cidade Alta): o batedor em missão segue
   * como dados, sem cena. Cruzar com hostis é um risco resolvido na sorte.
   */
  advance(days: number, world: ScoutWorld, hazards: readonly ScoutHazard[]): "OK" | "HURT" | "DEAD" {
    if (!this.isAlive || (!this.onMission && this.inContact)) return "OK";
    const S = SUPPORT.SCOUT;
    let left = S.DAY_DISTANCE * days;
    let result: "OK" | "HURT" = "OK";
    for (let guard = 0; guard < 24 && left > 0; guard++) {
      this.scan(world.time + guard * 1000);
      this.lastScanAt = -Infinity;
      const goal = this.goalOf(world);
      if (!goal) break;
      const d = distance(this, goal);
      if (d < 30) {
        this.onArrived(goal, world);
        if (this.mode === "EXPLORE" || this.mode === "SHADOW") break;
        continue;
      }
      const step = Math.min(left, d, 900);
      this.x += ((goal.x - this.x) / d) * step;
      this.y += ((goal.y - this.y) / d) * step;
      left -= step;
      this.noteView();
      for (const h of hazards) {
        if (distance(h, this) > this.vision) continue;
        this.noteSighting({ bandId: h.bandId, name: h.name, x: h.x, y: h.y, day: world.day, count: this.countOf(h.size), hostile: true });
      }
      const met = hazards.find((h) => distance(h, this) < 600);
      if (!met) continue;
      const caught = S.CAUGHT_CHANCE * (1 - this.evasion) * Math.min(2, met.size / 8);
      if (Math.random() > caught) continue;
      this.hp = Math.max(0, this.hp - this.maxHp * S.CAUGHT_DAMAGE);
      this.redrawBars();
      if (this.hp <= 0) {
        this.die();
        return "DEAD";
      }
      result = "HURT";
      this.setOrder({ kind: "RETURN" });
    }
    return result;
  }

  /** Estado de campo para o save. */
  serialize() {
    return {
      mode: this.mode,
      sneaking: this.sneaking,
      point: this.explorePoint,
      region: this.region,
      patrol: this.patrol,
      patrolIndex: this.patrolIndex,
      shadowId: this.shadowId,
      report: this.report,
      scanned: [...this.scanned],
      lastContact: this.lastContact,
    };
  }

  restore(s: Partial<ReturnType<Scout["serialize"]>>): void {
    this.mode = s.mode ?? "VANGUARD";
    this.setSneaking(s.sneaking ?? false);
    this.explorePoint = s.point ?? null;
    this.region = s.region ?? null;
    this.patrol = s.patrol ?? [];
    this.patrolIndex = s.patrolIndex ?? 0;
    this.shadowId = s.shadowId ?? null;
    if (s.report) this.report = s.report;
    this.scanned = new Set(s.scanned ?? []);
    if (s.lastContact) this.lastContact = s.lastContact;
  }

  private redrawSelection(): void {
    const g = this.selectionGfx;
    g.clear();
    if (this.selected) {
      g.lineStyle(2, COLORS.SELECTION, 0.95);
      g.strokeCircle(0, 0, this.radius + 8);
    }
  }
}

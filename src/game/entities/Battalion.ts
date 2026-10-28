import Phaser from "phaser";
import { Soldier } from "./Soldier";
import type { Unit } from "./Unit";
import type { Commander } from "./Commander";
import { BALANCE, COLORS, FORMATIONS, LIEUTENANTS, TROOPS, type Formation, type TroopType } from "../../utils/constants";
import { PASSIVES, type LieutenantData, type PassiveDef } from "../data/lieutenants";
import { angleTo, centroid, distance, nearest, type Point } from "../../utils/math";
import type { BattalionData, BattalionStatus } from "../../store/useGameStore";
import { battalionMods, soldierStats, type BattalionMods } from "../../utils/progression";

export type BattalionOrder =
  | { type: "HOLD"; point: Point }
  | { type: "MOVE"; point: Point }
  | { type: "ATTACK"; target: Unit; lastKnown: Point }
  | { type: "FOLLOW"; leader: Commander };

/**
 * Grupo de soldados que age como um "personagem" tático: recebe ordens,
 * mantém uma formação e compartilha uma única barra de Moral.
 */
export class Battalion {
  readonly id: string;
  readonly name: string;
  readonly troopType: TroopType;
  readonly startingCount: number;
  readonly level: number;
  /** Nível × habilidades × equipamento (ver src/utils/progression.ts). */
  readonly mods: BattalionMods;
  /** Inimigos abatidos nesta batalha. */
  kills = 0;
  /** Ordem a caminho nas mãos de um mensageiro (texto para o HUD). */
  pendingOrder: string | null = null;

  soldiers: Soldier[];
  formation: Formation;
  morale: number = BALANCE.MORALE.MAX;
  panicking = false;
  order: BattalionOrder;
  /** Direção da frente da formação (rad). Golpes vindos de trás contam como flanco. */
  facing = 0;
  /** Soldados perdidos desde a última leitura do MoraleSystem. */
  pendingDeaths = 0;
  selected = false;

  private readonly label: Phaser.GameObjects.Text;
  private readonly bannerGfx: Phaser.GameObjects.Graphics;
  /** Anéis de seleção, desenhados abaixo das unidades. */
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  /**
   * Posição deste batalhão no cortejo atrás do Comandante, no referencial dele:
   * `lateral` (lado) e `back` (distância para trás). Atribuída pela BattleScene
   * sempre que o conjunto de batalhões seguindo o Comandante muda.
   */
  followSlot: { lateral: number; back: number } = { lateral: 0, back: BALANCE.FOLLOW_DISTANCE };

  /** Tenente no comando (dados persistentes), a unidade dele em campo e o que aconteceu. */
  readonly lieutenant: LieutenantData | null;
  private lieutenantUnit: Soldier | null = null;
  lieutenantDied = false;
  lieutenantKills = 0;

  constructor(
    scene: Phaser.Scene,
    data: BattalionData,
    x: number,
    y: number,
    leader: Commander,
    lieutenant: LieutenantData | null = null,
  ) {
    this.lieutenant = lieutenant;
    this.id = data.id;
    this.name = data.name;
    this.troopType = data.troopType;
    this.formation = TROOPS[data.troopType].formations.includes(data.formation)
      ? data.formation
      : TROOPS[data.troopType].formations[0];
    this.startingCount = data.soldiers;
    this.level = data.level;
    this.mods = battalionMods(data);
    this.order = { type: "FOLLOW", leader };

    const stats = soldierStats(data, this.mods);
    this.soldiers = [];
    for (let i = 0; i < data.soldiers; i++) {
      const slot = this.slotFor(i, data.soldiers, { x, y });
      this.soldiers.push(new Soldier(scene, slot.x, slot.y, data.troopType, this, stats));
    }

    // O tenente marcha no último lugar da formação (comanda de trás da linha)
    if (lieutenant) {
      const L = LIEUTENANTS;
      const leaderStats = {
        ...stats,
        hp: Math.round(stats.hp * L.HP_MULT),
        damage: stats.damage * L.DAMAGE_MULT,
        radius: stats.radius + L.EXTRA_RADIUS,
      };
      const slot = this.slotFor(data.soldiers, data.soldiers + 1, { x, y });
      this.lieutenantUnit = new Soldier(scene, slot.x, slot.y, data.troopType, this, leaderStats, true);
      this.soldiers.push(this.lieutenantUnit);
    }

    // ★ = batalhão comandado por um tenente (o nome aparece no card do HUD)
    const title = `${data.name} · Nv ${data.level}${lieutenant ? " ★" : ""}`;
    this.label = scene.add
      .text(x, y, title, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.bannerGfx = scene.add.graphics().setDepth(10);
    this.selectionGfx = scene.add.graphics().setDepth(-5);
  }

  get center(): Point {
    return centroid(this.soldiers);
  }

  /** Soldados (sem o tenente) vivos neste instante (a lista só é podada no próximo `update`). */
  get aliveCount(): number {
    return this.soldiers.filter((s) => s.isAlive && !s.isLieutenant).length;
  }

  /** Dizimado: não sobrou nenhum soldado (um tenente sozinho deixa o campo). */
  get isDestroyed(): boolean {
    return this.soldiers.every((s) => s.isLieutenant);
  }

  /** Passiva do tenente — só vale enquanto ele estiver vivo em campo. */
  get leaderPassive(): PassiveDef | null {
    return this.lieutenant && !this.lieutenantDied ? PASSIVES[this.lieutenant.passive] : null;
  }

  get lieutenantAlive(): boolean {
    return !!this.lieutenant && !this.lieutenantDied;
  }

  /** true se o ponto cai sobre algum soldado (com folga de `pad` px). */
  containsPoint(p: Point, pad = 6): boolean {
    return this.soldiers.some((s) => s.isAlive && distance(s, p) <= s.radius + pad);
  }

  /** true se algum soldado está dentro do retângulo (coordenadas do mundo). */
  intersectsRect(rect: Phaser.Geom.Rectangle): boolean {
    return this.soldiers.some((s) => s.isAlive && rect.contains(s.x, s.y));
  }

  get status(): BattalionStatus {
    if (this.isDestroyed) return "DESTROYED";
    if (this.panicking) return "FLEEING";
    if (this.soldiers.some((s) => s.target)) return "ENGAGED";
    if (this.soldiers.some((s) => s.unitState === "MOVING")) return "MOVING";
    return "READY";
  }

  // --- Ordens (ignoradas em pânico) ---

  /** `facing` opcional: numa marcha em grupo todos olham para a mesma direção. */
  orderMove(point: Point, facing = angleTo(this.center, point)): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.facing = facing;
    this.order = { type: "MOVE", point };
    for (const s of this.soldiers) s.target = null;
    return true;
  }

  orderAttack(target: Unit): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.facing = angleTo(this.center, target);
    this.order = { type: "ATTACK", target, lastKnown: { x: target.x, y: target.y } };
    return true;
  }

  orderFollow(leader: Commander): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.order = { type: "FOLLOW", leader };
    return true;
  }

  /**
   * Vida no acampamento (Marco 12): enquanto o batalhão descansa, quem cuida de cada soldado
   * é a rotina do acampamento (true = cuidou). Inimigo por perto: a rotina é largada e luta-se.
   */
  restDriver: ((s: Soldier, i: number, dt: number) => boolean) | null = null;

  /** Descansar no alojamento: segura a posição ali (e a rotina do acampamento assume). */
  restAt(slot: Point): void {
    if (this.isDestroyed) return;
    if (this.panicking) this.rally();
    this.facing = Math.PI / 2;
    this.order = { type: "HOLD", point: slot };
    for (const s of this.soldiers) s.target = null;
  }

  holdPosition(): boolean {
    if (this.panicking || this.isDestroyed) return false;
    this.order = { type: "HOLD", point: this.center };
    return true;
  }

  /** Investida: ataca o inimigo mais próximo do batalhão, onde quer que esteja. */
  orderCharge(enemies: readonly Unit[]): boolean {
    const target = nearest(enemies, this.center);
    return target ? this.orderAttack(target) : false;
  }

  canUseFormation(formation: Formation): boolean {
    return TROOPS[this.troopType].formations.includes(formation);
  }

  setFormation(formation: Formation): boolean {
    if (this.panicking || this.isDestroyed || !this.canUseFormation(formation)) return false;
    this.formation = formation;
    for (const s of this.soldiers) s.refresh();
    return true;
  }

  rally(): void {
    this.panicking = false;
    this.order = { type: "HOLD", point: this.center };
    for (const s of this.soldiers) s.setPanicked(false);
  }

  panic(): void {
    this.panicking = true;
    for (const s of this.soldiers) {
      s.setPanicked(true);
      s.target = null;
    }
  }

  // --- Simulação ---

  /** `enemies` = só os inimigos visíveis (os ocultos na floresta não podem ser alvejados). */
  update(dt: number, enemies: readonly Unit[]): void {
    const before = this.soldiers.filter((s) => !s.isLieutenant).length;
    this.soldiers = this.soldiers.filter((s) => s.isAlive);
    this.pendingDeaths += before - this.aliveCount;

    // Tenente tombou: a passiva some e o batalhão sente o golpe
    if (this.lieutenantUnit && !this.lieutenantUnit.isAlive && !this.lieutenantDied) {
      this.lieutenantDied = true;
      this.lieutenantUnit = null;
      this.morale = Math.max(0, this.morale - LIEUTENANTS.DEATH_MORALE_HIT);
    }

    if (this.isDestroyed) {
      // Sem soldados, o tenente sobrevivente deixa o campo
      if (this.lieutenantUnit) {
        this.lieutenantUnit.unitState = "DEAD"; // sai dos alvos inimigos
        this.lieutenantUnit.destroy();
        this.lieutenantUnit = null;
        this.soldiers = [];
      }
      this.selected = false;
      this.label.setVisible(false);
      this.bannerGfx.clear();
      this.selectionGfx.clear();
      return;
    }

    if (this.panicking) this.updateFleeing(dt, enemies);
    else this.updateOrdered(dt, enemies);

    this.drawBanner();
  }

  private updateFleeing(dt: number, enemies: readonly Unit[]): void {
    const center = this.center;
    const threats = enemies.filter((e) => distance(e, center) < BALANCE.MORALE.THREAT_RADIUS * 1.5);
    if (threats.length === 0) {
      for (const s of this.soldiers) s.unitState = "IDLE";
      return;
    }
    const danger = centroid(threats);
    const away = angleTo(danger, center);
    for (const s of this.soldiers) {
      s.target = null;
      s.moveTowards(s.x + Math.cos(away) * 100, s.y + Math.sin(away) * 100, dt, 1.15);
      s.unitState = "FLEEING";
    }
  }

  private updateOrdered(dt: number, enemies: readonly Unit[]): void {
    const anchor = this.resolveAnchor();
    const engaging = this.order.type !== "MOVE";
    const count = this.soldiers.length;

    this.soldiers.forEach((s, i) => {
      if (engaging) this.pickTarget(s, anchor, enemies);
      else s.target = null;
      if (this.restDriver && !s.target && this.restDriver(s, i, dt)) return;

      if (s.target && s.inRange(s.target)) {
        s.unitState = "ATTACKING";
        s.setFacing(angleTo(s, s.target));
        return;
      }
      // Parede de Escudos não quebra a fileira para perseguir: espera o inimigo chegar
      if (s.target && this.formation !== "SHIELD_WALL") {
        s.moveTowards(s.target.x, s.target.y, dt);
        s.unitState = "MOVING";
        return;
      }

      const slot = this.slotFor(i, count, anchor);
      s.unitState = s.moveTowards(slot.x, slot.y, dt) ? "IDLE" : "MOVING";
      if (s.unitState === "IDLE") {
        s.setFacing(this.facing);
        s.chargeDistance = 0; // parado não acumula investida
      }
    });

    // Marcha concluída → segura a posição
    if (this.order.type === "MOVE" && this.soldiers.every((s) => s.unitState === "IDLE")) {
      this.order = { type: "HOLD", point: this.order.point };
    }
  }

  /** Ponto em volta do qual a formação se organiza e os soldados engajam. */
  private resolveAnchor(): Point {
    switch (this.order.type) {
      case "HOLD":
      case "MOVE":
        return this.order.point;
      case "FOLLOW": {
        const leader = this.order.leader;
        if (leader.unitState === "MOVING") this.facing = leader.facing;
        const fx = Math.cos(this.facing);
        const fy = Math.sin(this.facing);
        return {
          x: leader.x - fx * this.followSlot.back - fy * this.followSlot.lateral,
          y: leader.y - fy * this.followSlot.back + fx * this.followSlot.lateral,
        };
      }
      case "ATTACK": {
        const order = this.order;
        if (order.target.isAlive) {
          order.lastKnown = { x: order.target.x, y: order.target.y };
        }
        return order.lastKnown;
      }
    }
  }

  private pickTarget(s: Soldier, anchorPoint: Point, enemies: readonly Unit[]): void {
    // Descansando no acampamento, cada um reage ao inimigo perto de si (e não do alojamento)
    const anchor = this.restDriver ? s : anchorPoint;
    // Arqueiros engajam até o próprio alcance além do raio padrão
    const radius = Math.max(BALANCE.ENGAGE_RADIUS * (this.restDriver ? 1.6 : 1), s.attackRange() + 40);
    if (this.order.type === "ATTACK" && this.order.target.isAlive && this.order.target.revealed && !s.target) {
      s.target = this.order.target;
    }
    if (s.target && s.target.isAlive && s.target.revealed && distance(s.target, anchor) <= radius * 1.2) return;

    const candidates = enemies.filter((e) => distance(e, anchor) <= radius);
    s.target = nearest(candidates, s);

    // Alvo da ordem morreu e não há mais ninguém por perto → segura a posição
    if (!s.target && this.order.type === "ATTACK" && !this.order.target.isAlive) {
      this.order = { type: "HOLD", point: anchorPoint };
    }
  }

  /** Largura da frente da formação atual (px), usada para alinhar vários batalhões lado a lado. */
  frontWidth(): number {
    const count = Math.max(1, this.soldiers.length);
    const laterals = Array.from({ length: count }, (_, i) => this.slotOffset(i, count).lateral);
    return Math.max(...laterals) - Math.min(...laterals) + FORMATIONS[this.formation].spacing;
  }

  /** Profundidade da formação atual (px): da primeira à última fileira. */
  formationDepth(): number {
    const count = Math.max(1, this.soldiers.length);
    const depths = Array.from({ length: count }, (_, i) => this.slotOffset(i, count).depth);
    return Math.max(...depths) - Math.min(...depths) + FORMATIONS[this.formation].spacing;
  }

  /** O batalhão está, de fato, acompanhando o Comandante? */
  get isFollowing(): boolean {
    return this.order.type === "FOLLOW" && !this.panicking && !this.isDestroyed;
  }

  /** Posição do soldado `i` (de `count`) na formação atual, girada para `facing`. */
  private slotFor(i: number, count: number, anchor: Point): Point {
    const { lateral, depth } = this.slotOffset(i, count);
    const fx = Math.cos(this.facing);
    const fy = Math.sin(this.facing);
    return {
      x: anchor.x + fx * depth - fy * lateral,
      y: anchor.y + fy * depth + fx * lateral,
    };
  }

  /** Deslocamento do soldado `i` no referencial da formação: `lateral` (lado) e `depth` (para trás). */
  private slotOffset(i: number, count: number): { lateral: number; depth: number } {
    const spacing = FORMATIONS[this.formation].spacing;
    let lateral: number;
    let depth: number;

    switch (this.formation) {
      case "SHIELD_WALL": {
        // Uma fileira larga (duas se passar de 8)
        const cols = Math.min(count, 8);
        lateral = ((i % cols) - (cols - 1) / 2) * spacing;
        depth = -Math.floor(i / cols) * spacing;
        break;
      }
      case "WEDGE": {
        // Triângulo com a ponta à frente: fileira r tem r+1 soldados
        const r = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
        const pos = i - (r * (r + 1)) / 2;
        lateral = (pos - r / 2) * spacing;
        depth = -r * spacing;
        break;
      }
      case "LOOSE": {
        const cols = 4;
        // Desalinhamento determinístico por soldado
        lateral = ((i % cols) - (cols - 1) / 2) * spacing + Math.sin(i * 12.9898) * spacing * 0.25;
        depth = -Math.floor(i / cols) * spacing + Math.cos(i * 78.233) * spacing * 0.25;
        break;
      }
      default: {
        const cols = 4;
        lateral = ((i % cols) - (cols - 1) / 2) * spacing;
        depth = -Math.floor(i / cols) * spacing;
      }
    }
    return { lateral, depth };
  }

  /** Leva o batalhão inteiro (em forma) para outro ponto: viagem rápida, recuo ao acampamento. */
  teleportTo(p: Point): void {
    const c = this.center;
    for (const s of this.soldiers) {
      s.x += p.x - c.x;
      s.y += p.y - c.y;
      s.target = null;
    }
  }

  /** Remove o batalhão do mundo (reforço, deserção, motim: ele é recriado a partir dos dados). */
  destroy(): void {
    for (const s of this.soldiers) s.destroy();
    this.soldiers = [];
    this.label.destroy();
    this.bannerGfx.destroy();
    this.selectionGfx.destroy();
  }

  private drawBanner(): void {
    const c = this.center;
    const top = Math.min(...this.soldiers.map((s) => s.y)) - 22;
    const w = 60;

    this.label.setPosition(c.x, top - 2);
    this.label.setColor(this.panicking ? "#ff4d4d" : "#ffffff");

    const g = this.bannerGfx;
    g.clear();
    g.fillStyle(COLORS.HP_BG, 0.85);
    g.fillRect(c.x - w / 2, top, w, 4);
    g.fillStyle(this.panicking ? COLORS.PANIC : COLORS.MORALE, 1);
    g.fillRect(c.x - w / 2, top, w * (this.morale / BALANCE.MORALE.MAX), 4);

    const sel = this.selectionGfx;
    sel.clear();
    if (this.selected) {
      sel.lineStyle(2, COLORS.SELECTION, 0.95);
      for (const s of this.soldiers) sel.strokeCircle(s.x, s.y, s.radius + 4);
    }
  }
}

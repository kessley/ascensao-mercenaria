import type Phaser from "phaser";
import type { Enemy } from "../entities/Enemy";
import type { Unit } from "../entities/Unit";
import type { MoraleGroup } from "./MoraleSystem";
import type { PassiveDef } from "../data/lieutenants";
import { formationOffset } from "./formation";
import { BALANCE, COLORS, WAR_AI, type EnemyKind, type Formation } from "../../utils/constants";
import { angleTo, centroid, distance, type Point } from "../../utils/math";

export type SquadRole = "MELEE" | "RANGED" | "RIDERS";

/** Ordem de um esquadrão: o que os soldados fazem até chegar outra. */
export type SquadOrder =
  /** Marcha do bando: cada um segue o próprio lugar na coluna. */
  | { type: "MARCH" }
  /** Segura o ponto, de frente para `facing`, e luta com quem chegar. */
  | { type: "HOLD"; point: Point; facing: number }
  /** Vai até o ponto sem parar para lutar (só revida quem encosta). */
  | { type: "MOVE"; point: Point; facing?: number }
  /** Avança até o ponto lutando com quem aparecer. */
  | { type: "ADVANCE"; point: Point }
  /** Vai atrás de um alvo. */
  | { type: "ATTACK"; target: Unit; lastKnown: Point }
  /** Parado e quieto, esperando o inimigo passar. */
  | { type: "HIDE"; point: Point; facing: number };

/** Quem enxerga e decide por cima do esquadrão (ver WarHost). */
export interface SquadCommand {
  /** Um soldado viu alguém: o resto do bando fica sabendo. */
  report(u: Unit, by: Enemy): void;
  /** Alguém viu um batedor (só um ou dois vão atrás dele). */
  spotted(s: Enemy, u: Unit): void;
  /** O bando largou a luta. */
  readonly retreating: boolean;
  /** Tropa treinada: em marcha, ninguém sai correndo antes da ordem. */
  readonly disciplined: boolean;
}

const ORDER_ANCHOR_FREE: ReadonlySet<SquadOrder["type"]> = new Set(["MARCH"]);

/**
 * Esquadrão inimigo (Marco 16): o equivalente de um batalhão do jogador, com as mesmas regras de
 * formação e de moral (`updateMorale`). Os soldados deixam de escolher sozinhos o que fazer:
 * seguem a ordem do esquadrão, mantêm a forma e, em pânico, largam tudo e fogem.
 */
export class EnemySquad implements MoraleGroup {
  soldiers: Enemy[] = [];
  formation: Formation = "LINE";
  morale: number = BALANCE.MORALE.MAX;
  panicking = false;
  order: SquadOrder = { type: "MARCH" };
  facing = 0;
  pendingDeaths = 0;
  /** Disciplina do tipo de tropa; 0 = não sente medo (mortos-vivos). */
  mods: { moraleLoss: number };
  readonly fatigueRecovery = 1;
  /** O tenente do esquadrão e o nome dele. */
  lieutenant: Enemy | null = null;
  lieutenantName: string | null = null;
  passive: PassiveDef | null = null;
  center: Point = { x: 0, y: 0 };
  /** Veio de uma ordem que ainda não acabou (usado pelos planos). */
  arrived = false;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    readonly role: SquadRole,
    members: Enemy[],
    readonly command: SquadCommand,
  ) {
    this.mods = { moraleLoss: members.length > 0 ? Math.max(...members.map((m) => WAR_AI.DISCIPLINE[m.kind as EnemyKind] ?? 1)) : 1 };
    this.gfx = scene.add.graphics().setDepth(10);
    for (const m of members) this.add(m);
    this.formation = this.defaultFormation();
    this.refresh();
  }

  add(m: Enemy): void {
    m.squad = this;
    m.slot = this.soldiers.length;
    this.soldiers.push(m);
  }

  private defaultFormation(): Formation {
    if (this.role === "RIDERS") return "WEDGE";
    return "LINE";
  }

  get isDestroyed(): boolean {
    return this.soldiers.length === 0;
  }

  /** Passiva do tenente: só vale com ele vivo (como no bando do jogador). */
  get leaderPassive(): PassiveDef | null {
    return this.lieutenant?.isAlive ? this.passive : null;
  }

  get alive(): number {
    return this.soldiers.length;
  }

  /** Só em dia com quem morreu: chamado uma vez por quadro. */
  refresh(): void {
    const before = this.soldiers.length;
    this.soldiers = this.soldiers.filter((s) => s.isAlive);
    const died = before - this.soldiers.length;
    if (died > 0) {
      this.pendingDeaths += died;
      this.soldiers.forEach((s, i) => (s.slot = i));
    }
    if (this.lieutenant && !this.lieutenant.isAlive) {
      this.lieutenant = null;
      this.morale = Math.max(0, this.morale - 30);
    }
    if (this.soldiers.length > 0) this.center = centroid(this.soldiers);
  }

  panic(): void {
    // Quem não sente medo não foge
    if (this.mods.moraleLoss === 0) {
      this.morale = BALANCE.MORALE.PANIC_BELOW;
      return;
    }
    this.panicking = true;
    for (const s of this.soldiers) s.target = null;
  }

  rally(): void {
    this.panicking = false;
    this.order = { type: "HOLD", point: { ...this.center }, facing: this.facing };
  }

  setOrder(order: SquadOrder): void {
    if (this.panicking) return;
    this.order = order;
    this.arrived = false;
    if (order.type === "HOLD" || order.type === "HIDE") this.facing = order.facing;
    else if (order.type === "MOVE" || order.type === "ADVANCE") this.facing = order.type === "MOVE" && order.facing !== undefined ? order.facing : angleTo(this.center, order.point);
    else if (order.type === "ATTACK") this.facing = angleTo(this.center, order.target);
  }

  setFormation(f: Formation): void {
    this.formation = f;
    for (const s of this.soldiers) s.showShield(f === "SHIELD_WALL");
  }

  /** Ponto em volta do qual a forma se organiza. */
  private anchor(): Point {
    const o = this.order;
    if (o.type === "ATTACK") {
      // Longe demais para ver, vai até onde o alvo foi visto por último (ninguém adivinha)
      if (o.target.isAlive && distance(o.target, this.center) < WAR_AI.ATTACK_SIGHT) {
        o.lastKnown = { x: o.target.x, y: o.target.y };
        this.facing = angleTo(this.center, o.lastKnown);
      }
      return o.lastKnown;
    }
    if (o.type === "MARCH") return this.center;
    return o.point;
  }

  /** Procura quem está ao alcance da percepção deste soldado. */
  private look(s: Enemy, allies: readonly Unit[], rivals: readonly Unit[], now: number): Unit | null {
    if (now < s.nextLookAt) return null;
    s.nextLookAt = now + 180 + Math.random() * 160;
    const fights = (s.hostile || s.provoked) && !s.friendly;
    // Em marcha, tropa treinada avisa e espera a ordem (a não ser que encostem nela)
    const reach = this.order.type === "MARCH" && this.command.disciplined ? 130 : Infinity;
    let best: Unit | null = null;
    let bestDist = Infinity;
    const consider = (u: Unit) => {
      if (!u.isAlive || distance(u, s) > s.perceptionOf(u)) return;
      this.command.report(u, s);
      if (u.isScout && !s.huntsScouts) {
        this.command.spotted(s, u);
        if (!s.huntsScouts) return;
      }
      const d = distance(u, s) * u.lure;
      if (d < bestDist && distance(u, s) <= reach) {
        best = u;
        bestDist = d;
      }
    };
    if (fights) for (const a of allies) consider(a);
    for (const r of rivals) consider(r);
    return best;
  }

  /** Um soldado, um quadro: o equivalente de `Battalion.updateOrdered`. */
  drive(s: Enemy, dt: number, allies: readonly Unit[], rivals: readonly Unit[]): void {
    const now = s.scene.time.now;
    if (this.panicking) return this.fleeStep(s, dt, allies, rivals, now);
    const o = this.order;
    const passing = o.type === "MOVE";
    const fights = (s.hostile || s.provoked) && !s.friendly;

    const t = s.target;
    if (t) {
      const limit = o.type === "ATTACK" ? WAR_AI.ATTACK_SIGHT : WAR_AI.PURSUIT;
      if (!t.isAlive || (t.team === "ALLY" && !fights) || distance(this.center, t) > limit || (passing && distance(s, t) > s.radius + t.radius + 30)) {
        s.target = null;
        s.huntsScouts = false;
      }
    }
    if (o.type === "HIDE") {
      // Quieto: só reage se apanhar (ver Unit.takeDamage)
      if (!s.target) {
        s.unitState = s.moveTowards(this.slotOf(s, o.point).x, this.slotOf(s, o.point).y, dt) ? "IDLE" : "MOVING";
        return;
      }
    }
    // Cada um pega quem está mais perto (e troca se alguém encostar antes de chegar ao alvo); só
    // quem não achou ninguém vai no alvo da ordem: dez em cima de um só não lutam, se amontoam
    if (!passing && now >= s.nextLookAt && !(s.target && s.inRange(s.target))) {
      const found = this.look(s, allies, rivals, now);
      if (found) s.target = found;
      else if (!s.target && o.type === "ATTACK" && o.target.isAlive && distance(o.target, s) < WAR_AI.ATTACK_SIGHT) s.target = o.target;
    }

    if (s.target) {
      if (s.inRange(s.target)) {
        s.unitState = "ATTACKING";
        s.setFacing(angleTo(s, s.target));
        return;
      }
      // Parede de Escudos não quebra a fileira para perseguir, a não ser com ordem de atacar
      if (this.formation !== "SHIELD_WALL" || o.type === "ATTACK") {
        s.moveTowards(s.target.x, s.target.y, dt);
        s.unitState = "MOVING";
        return;
      }
    }

    if (ORDER_ANCHOR_FREE.has(o.type)) {
      const arrived = s.moveTowards(s.home.x, s.home.y, dt, 0.7);
      s.unitState = arrived ? "IDLE" : "MOVING";
      return;
    }
    const slot = this.slotOf(s, this.anchor());
    s.unitState = s.moveTowards(slot.x, slot.y, dt) ? "IDLE" : "MOVING";
    if (s.unitState === "IDLE") {
      s.setFacing(this.facing);
      s.chargeDistance = 0;
    }
  }

  private slotOf(s: Enemy, anchor: Point): Point {
    const { lateral, depth } = formationOffset(this.formation, s.slot, this.soldiers.length);
    const fx = Math.cos(this.facing);
    const fy = Math.sin(this.facing);
    return { x: anchor.x + fx * depth - fy * lateral, y: anchor.y + fy * depth + fx * lateral };
  }

  /** Em pânico: corre para longe de quem está perto (as mesmas regras de um batalhão). */
  private fleeStep(s: Enemy, dt: number, allies: readonly Unit[], rivals: readonly Unit[], now: number): void {
    s.target = null;
    if (now >= s.nextLookAt) {
      s.nextLookAt = now + 250 + Math.random() * 150;
      const threats: Point[] = [];
      for (const a of [...allies, ...rivals]) if (a.isAlive && distance(a, s) < BALANCE.MORALE.THREAT_RADIUS * 2) threats.push(a);
      s.fleeFrom = threats.length > 0 ? centroid(threats) : null;
    }
    if (!s.fleeFrom) {
      s.unitState = "IDLE";
      return;
    }
    const away = angleTo(s.fleeFrom, s);
    s.moveTowards(s.x + Math.cos(away) * 100, s.y + Math.sin(away) * 100, dt, 1.15);
    s.unitState = "FLEEING";
  }

  /** Ordem cumprida: todos (quase) no lugar. */
  get settled(): boolean {
    const a = this.order.type === "MARCH" ? null : this.anchor();
    if (!a) return true;
    return distance(this.center, a) < 90;
  }

  /** Bandeirola do esquadrão: moral, como a dos batalhões (some junto com os soldados). */
  draw(): void {
    const g = this.gfx;
    g.clear();
    const seen = this.soldiers.filter((s) => s.revealed);
    if (seen.length === 0 || this.mods.moraleLoss === 0) return;
    const c = centroid(seen);
    const top = Math.min(...seen.map((s) => s.y)) - 20;
    const w = 44;
    g.fillStyle(COLORS.HP_BG, 0.85);
    g.fillRect(c.x - w / 2, top, w, 3);
    g.fillStyle(this.panicking ? COLORS.PANIC : COLORS.MORALE, 1);
    g.fillRect(c.x - w / 2, top, w * (this.morale / BALANCE.MORALE.MAX), 3);
  }

  destroy(): void {
    this.gfx.destroy();
    for (const s of this.soldiers) if (s.squad === this) s.squad = null;
  }
}


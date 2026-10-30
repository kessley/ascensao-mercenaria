import Phaser from "phaser";
import { Unit } from "../entities/Unit";
import type { Gate, Rect, TownLayout } from "../world/townLayout";
import { COLORS, SIEGE } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/** Um portão no cerco: fechado é sólido; o aríete o derruba. */
interface SiegeGate {
  gate: Gate;
  rect: Rect;
  hp: number;
  maxHp: number;
  broken: boolean;
}

/** Aríete: vai até o portão mais perto e bate até ele cair. Quem chegar perto pode destruí-lo. */
export class SiegeRam extends Unit {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ALLY", SIEGE.RAM);
    this.autoAttack = false;
    this.role = "WAGON";
    this.lure = 0.5;
    this.townAccess = "ANY";
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const r = this.radius;
    g.clear();
    g.fillStyle(0x4a3220, 1);
    g.fillRect(-r * 1.4, -r * 0.7, r * 2.8, r * 1.4);
    g.fillStyle(0x7a5a38, 1);
    g.fillRect(-r * 0.6, -r * 0.25, r * 2.4, r * 0.5);
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.strokeRect(-r * 1.4, -r * 0.7, r * 2.8, r * 1.4);
  }
}

/** O que a cena precisa saber das obras do cerco. */
export interface SiegeChange {
  /** Portões de pé (sólidos) e passagens abertas nos muros (escadas). */
  solids: Rect[];
  breaches: Rect[];
}

/**
 * Obras de um cerco de verdade (Marco 16), só enquanto o bando está diante dos muros: portões
 * fechados (sólidos, com vida), escadas (brechas na muralha) e o aríete.
 */
export class SiegeWorks {
  readonly gates: SiegeGate[];
  readonly ladders: Rect[] = [];
  ram: SiegeRam | null = null;
  /** Surtida: os portões ficam abertos até este momento (tempo da cena). */
  sallyUntil = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly layout: TownLayout,
    /** Índice do portão mais fraco (o batedor descobre qual é). */
    weakGate: number,
    private readonly onChange: () => void,
    private readonly onGateDown: (g: Gate) => void,
  ) {
    const stone = layout.wallKind === "STONE";
    this.gates = layout.gates.map((gate, i) => {
      const vertical = gate.side === "E" || gate.side === "W";
      const t = layout.wallThickness + 4;
      const rect: Rect = vertical ? { x: gate.x - t / 2, y: gate.y - gate.width / 2 - 4, w: t, h: gate.width + 8 } : { x: gate.x - gate.width / 2 - 4, y: gate.y - t / 2, w: gate.width + 8, h: t };
      const maxHp = (stone ? SIEGE.GATE_HP.STONE : SIEGE.GATE_HP.PALISADE) * (i === weakGate ? SIEGE.WEAK_GATE : 1);
      return { gate, rect, hp: maxHp, maxHp, broken: false };
    });
    this.gfx = scene.add.graphics().setDepth(4);
    this.draw();
  }

  /** Portões de pé agora (na surtida, abertos). */
  private standing(): SiegeGate[] {
    return this.gates.filter((g) => !g.broken && this.scene.time.now >= this.sallyUntil);
  }

  get change(): SiegeChange {
    return { solids: this.standing().map((g) => g.rect), breaches: this.ladders };
  }

  /** Abriu passagem: algum portão caiu, ou há escada de pé. */
  get open(): boolean {
    return this.ladders.length > 0 || this.gates.some((g) => g.broken);
  }

  /** Escada no trecho de muralha mais perto de `near` (longe dos portões e das torres). */
  addLadder(near: Point): Rect | null {
    const l = this.layout;
    const walls = l.walls.filter((w) => Math.max(w.w, w.h) >= 90);
    const clearOfTowers = (p: Point) => l.towers.every((r) => p.x < r.x - 50 || p.x > r.x + r.w + 50 || p.y < r.y - 50 || p.y > r.y + r.h + 50);
    let best: { p: Point; vertical: boolean } | null = null;
    let bestDist = Infinity;
    for (const w of walls) {
      const vertical = w.h > w.w;
      const len = vertical ? w.h : w.w;
      for (let t = 40; t <= len - 40; t += 40) {
        const p = vertical ? { x: w.x + w.w / 2, y: w.y + t } : { x: w.x + t, y: w.y + w.h / 2 };
        // Na muralha lisa: nem em cima das torres nem colada num portão
        if (!clearOfTowers(p) || l.gates.some((g) => distance(p, g) < 140)) continue;
        if (this.ladders.some((r) => distance(p, { x: r.x + r.w / 2, y: r.y + r.h / 2 }) < 120)) continue;
        const d = distance(p, near);
        if (d < bestDist) {
          bestDist = d;
          best = { p, vertical };
        }
      }
    }
    if (!best) return null;
    const t = this.layout.wallThickness + 8;
    const W = SIEGE.LADDER_WIDTH;
    const rect: Rect = best.vertical ? { x: best.p.x - t / 2, y: best.p.y - W / 2, w: t, h: W } : { x: best.p.x - W / 2, y: best.p.y - t / 2, w: W, h: t };
    this.ladders.push(rect);
    this.draw();
    this.onChange();
    return rect;
  }

  /** Portão ainda de pé mais perto de um ponto. */
  nearestGate(p: Point): SiegeGate | null {
    let best: SiegeGate | null = null;
    let bestDist = Infinity;
    for (const g of this.gates) {
      if (g.broken) continue;
      const d = distance(p, g.gate);
      if (d < bestDist) {
        bestDist = d;
        best = g;
      }
    }
    return best;
  }

  spawnRam(at: Point): SiegeRam {
    this.ram = new SiegeRam(this.scene, at.x, at.y);
    return this.ram;
  }

  /** Aríete: anda até o portão e bate. */
  update(dt: number): void {
    const r = this.ram;
    if (!r) return;
    if (!r.isAlive) {
      this.ram = null;
      return;
    }
    const g = this.nearestGate(r);
    if (!g) {
      r.unitState = "IDLE";
      return;
    }
    const front = g.gate.outside;
    if (distance(r, front) > 50) {
      r.moveTowards(front.x, front.y, dt);
      r.unitState = "MOVING";
      return;
    }
    r.unitState = "IDLE";
    g.hp -= SIEGE.RAM_DPS * dt;
    if (g.hp > 0) return;
    g.broken = true;
    this.draw();
    this.onChange();
    this.onGateDown(g.gate);
  }

  /** O que vai no save: as escadas de pé e os portões caídos. */
  serialize(): { ladders: Rect[]; broken: number[] } {
    return { ladders: this.ladders.map((r) => ({ ...r })), broken: this.gates.flatMap((g, i) => (g.broken ? [i] : [])) };
  }

  restore(data: { ladders: Rect[]; broken: number[] }): void {
    this.ladders.push(...data.ladders);
    for (const i of data.broken) if (this.gates[i]) this.gates[i].broken = true;
    this.draw();
    this.onChange();
  }

  /** Surtida: abre os portões por um tempo (a guarnição sai para queimar as obras). */
  sally(ms: number): void {
    this.sallyUntil = this.scene.time.now + ms;
    this.onChange();
    this.scene.time.delayedCall(ms + 50, () => {
      if (this.gfx.active) this.onChange();
    });
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    for (const s of this.gates) {
      const r = s.rect;
      g.fillStyle(s.broken ? 0x2a2015 : 0x5a3e24, s.broken ? 0.5 : 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(2, COLORS.OUTLINE, 0.9);
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    // Escadas: dois banzos e os degraus sobre a muralha
    for (const r of this.ladders) {
      g.fillStyle(0xb08a5a, 1);
      const vertical = r.w > r.h;
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        if (vertical) g.fillRect(r.x + (r.w * i) / steps, r.y + 2, 5, r.h - 4);
        else g.fillRect(r.x + 2, r.y + (r.h * i) / steps, r.w - 4, 5);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
    if (this.ram?.isAlive) this.ram.destroy();
    this.ram = null;
  }
}

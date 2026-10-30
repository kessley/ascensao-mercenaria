import Phaser from "phaser";
import type { Commander } from "./Commander";
import type { Scout, ScoutOrder, ScoutReport } from "./Scout";
import type { Enemy } from "./Enemy";
import { SUPPORT } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

export type HarpyState = "PERCHED" | "TO_COMMANDER" | "AT_COMMANDER" | "TO_SCOUT";

/** O que a harpia leva de volta: uma ordem ao batedor ou uma ordem para ele levar a um batalhão. */
export type HarpyOrder =
  | { label: string; order: ScoutOrder }
  | { label: string; relay: { to: () => Point | null; apply: () => void } };

export interface HarpyWorld {
  commander: Commander;
  /** Arqueiros hostis acordados: quem pode derrubar a ave. */
  archers: readonly Enemy[];
  /** Dá para voar aqui? (noite fechada e tempestade: não) */
  canFly: (p: Point) => boolean;
  /** Dá para ver este ponto? (a ave some na névoa) */
  canSee: (p: Point) => boolean;
  time: number;
}

export type HarpyEvent =
  | { type: "AT_COMMANDER"; report: ScoutReport | null }
  | { type: "AT_SCOUT"; orders: HarpyOrder[] }
  | { type: "SHOT"; report: ScoutReport | null; at: Point };

/**
 * Harpia em campo: uma ave em voo direto entre o batedor e o Comandante. Não é uma unidade (voa
 * por cima de tudo e não luta), mas é real: leva o relatório na garra e, se um arqueiro a
 * derrubar, o que ela levava se perde.
 */
export class Harpy {
  readonly gfx: Phaser.GameObjects.Graphics;
  state: HarpyState = "PERCHED";
  x: number;
  y: number;
  cargo: ScoutReport | null = null;
  orders: HarpyOrder[] = [];
  /** Última saída: sem novidade, ela vai assim mesmo de tempos em tempos (é por onde chegam as ordens). */
  lastFlightAt: number;
  private restUntil = 0;
  /** Parada no ar (noite ou tempestade): espera abrigada. */
  sheltering = false;
  /** Dias passados de uma vez desde a última viagem (ver advanceScouts). */
  idleDays = 0;

  constructor(
    scene: Phaser.Scene,
    readonly scout: Scout,
    now: number,
  ) {
    this.x = scout.x;
    this.y = scout.y;
    this.lastFlightAt = now;
    this.gfx = scene.add.graphics().setDepth(17).setVisible(false);
    this.gfx.fillStyle(0x2b2118, 1);
    this.gfx.fillTriangle(-16, -4, 0, -1, -4, 7);
    this.gfx.fillTriangle(16, -4, 0, -1, 4, 7);
    this.gfx.fillStyle(0xf0e6d2, 1);
    this.gfx.fillCircle(0, -3, 3);
  }

  get airborne(): boolean {
    return this.state === "TO_COMMANDER" || this.state === "TO_SCOUT";
  }

  /** Sai com o relatório para o Comandante. */
  launch(report: ScoutReport | null, now: number): void {
    this.cargo = report;
    this.state = "TO_COMMANDER";
    this.lastFlightAt = now;
    this.x = this.scout.x;
    this.y = this.scout.y;
  }

  private fly(to: Point, dt: number): boolean {
    const d = distance(this, to);
    const step = SUPPORT.HARPY.SPEED * dt;
    if (d <= step) {
      this.x = to.x;
      this.y = to.y;
      return true;
    }
    this.x += ((to.x - this.x) / d) * step;
    this.y += ((to.y - this.y) / d) * step;
    this.gfx.setRotation(Math.atan2(to.y - this.y, to.x - this.x) + Math.PI / 2);
    return false;
  }

  update(dt: number, world: HarpyWorld): HarpyEvent | null {
    const H = SUPPORT.HARPY;
    const out = this.airborne;
    this.gfx.setVisible(out && !this.sheltering && world.canSee(this));
    this.gfx.setPosition(this.x, this.y);
    if (this.state === "AT_COMMANDER") {
      if (world.time < this.restUntil || !world.canFly(this)) return null;
      this.state = "TO_SCOUT";
      return null;
    }
    if (!out) return null;
    this.sheltering = !world.canFly(this);
    if (this.sheltering) return null;

    // Arqueiros atiram na ave que passa ao alcance
    for (const e of world.archers) {
      if (distance(e, this) > e.attackRange() + H.SHOT_REACH || Math.random() > H.SHOT_PER_SEC * dt) continue;
      const report = this.cargo;
      this.cargo = null;
      return { type: "SHOT", report, at: { x: this.x, y: this.y } };
    }

    if (this.state === "TO_COMMANDER") {
      if (!this.fly(world.commander, dt)) return null;
      const report = this.cargo;
      this.cargo = null;
      this.state = "AT_COMMANDER";
      this.restUntil = world.time + H.REST_MS;
      return { type: "AT_COMMANDER", report };
    }
    if (!this.fly(this.scout, dt)) return null;
    this.state = "PERCHED";
    this.lastFlightAt = world.time;
    const orders = this.orders;
    this.orders = [];
    return orders.length > 0 ? { type: "AT_SCOUT", orders } : null;
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

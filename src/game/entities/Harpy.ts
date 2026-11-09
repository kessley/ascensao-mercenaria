import Phaser from "phaser";
import type { Commander } from "./Commander";
import type { Scout, ScoutOrder, ScoutReport } from "./Scout";
import type { Enemy } from "./Enemy";
import { SUPPORT } from "../../utils/constants";
import { HARPY_CELL, HARPY_FRAMES } from "../art/harpy";
import { harpyKeys, LOD_SCALE } from "../art/atlas";
import { Unit } from "./Unit";
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
/** Altura do voo: a sombra fica este tanto abaixo da ave, no chão. */
const ALTITUDE = 34;
/** Um bater de asas (os 4 quadros) e o ciclo de bater e planar. */
const FLAP_MS = 440;
const CYCLE_MS = 2600;
const FLAPPING_MS = 1320;

export class Harpy {
  readonly body: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  /** Linha da folha (0 de frente, 1 de lado, 2 de costas) e o lado (oeste = leste espelhado). */
  private row = 2;
  private west = false;
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
    const keys = harpyKeys(scene);
    this.body = scene.add
      .image(this.x, this.y, keys.body, 0)
      .setOrigin(HARPY_CELL.cx / HARPY_CELL.w, HARPY_CELL.cy / HARPY_CELL.h)
      .setDepth(17)
      .setVisible(false);
    this.shadow = scene.add.image(this.x, this.y, keys.shadow, 0).setDepth(-0.6).setVisible(false);
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
    this.face(to.x - this.x, to.y - this.y);
    return false;
  }

  update(dt: number, world: HarpyWorld): HarpyEvent | null {
    const H = SUPPORT.HARPY;
    const out = this.airborne;
    this.draw(out && !this.sheltering && world.canSee(this), world.time);
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

  /** Vira para onde voa, com folga para não ficar trocando de linha numa diagonal. */
  private face(dx: number, dy: number): void {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax === 0 && ay === 0) return;
    if (ax >= ay * (this.row === 1 ? 0.85 : 1.4)) {
      this.row = 1;
      this.west = dx < 0;
    } else this.row = dy > 0 ? 0 : 2;
  }

  /** A ave bate as asas um pouco e plana um pouco; a sombra vai no chão, embaixo. */
  private draw(visible: boolean, time: number): void {
    this.body.setVisible(visible);
    this.shadow.setVisible(visible);
    if (!visible) return;
    const t = time % CYCLE_MS;
    const flap = t < FLAPPING_MS ? Math.floor((t / FLAP_MS) * HARPY_FRAMES) % HARPY_FRAMES : 1;
    const scale = LOD_SCALE[Unit.lod];
    this.body
      .setFrame(this.row * HARPY_FRAMES + flap)
      .setFlipX(this.row === 1 && this.west)
      .setScale(scale)
      .setPosition(this.x, this.y);
    this.shadow.setScale(scale * (flap === 1 || flap === 3 ? 1 : 0.8), scale).setPosition(this.x, this.y + ALTITUDE * scale);
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
  }
}

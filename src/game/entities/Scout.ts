import Phaser from "phaser";
import { Unit } from "./Unit";
import { drawRiderShape } from "./shapes";
import type { Commander } from "./Commander";
import { COLORS, SUPPORT } from "../../utils/constants";
import { centroid, distance, type Point } from "../../utils/math";
import type { ScoutData } from "../data/riders";

export type ScoutMode = "VANGUARD" | "EXPLORE" | "RECALL";

/**
 * Batedor: cavaleiro rápido e esquivo que amplia a visão do Comandante e NUNCA luta.
 * - Vanguarda: fica à frente do Comandante, na direção em que ele anda.
 * - Explorar: vai até um ponto e fica de vigia (colinas ampliam a visão).
 * - Recolher: volta para o lado do Comandante.
 * Em qualquer modo, inimigos perto demais fazem o batedor recuar mantendo distância.
 */
export class Scout extends Unit {
  readonly rider: ScoutData;
  mode: ScoutMode = "VANGUARD";
  explorePoint: Point | null = null;
  selected = false;
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, data: ScoutData) {
    super(scene, x, y, "ALLY", SUPPORT.SCOUT.stats);
    this.rider = data;
    this.autoAttack = false;
    this.canCharge = true; // sofre o terreno como cavalaria (sem investida: não ataca)
    this.evasion = SUPPORT.SCOUT.evasion;
    this.selectionGfx = scene.add.graphics();
    this.addAt(this.selectionGfx, 0);
    this.drawBody();
  }

  protected drawBody(): void {
    drawRiderShape(this.bodyGfx, COLORS.SCOUT, this.radius, COLORS.SELECTION);
  }

  setMode(mode: ScoutMode, point: Point | null = null): void {
    this.mode = mode;
    this.explorePoint = point;
  }

  /** `threats`: inimigos vivos (o batedor os percebe mesmo na névoa — é o trabalho dele). */
  think(dt: number, commander: Commander, threats: readonly Unit[]): void {
    if (!this.isAlive) return;
    this.target = null;

    // Nunca entra em combate: recua para longe do centro dos inimigos próximos
    const danger = threats.filter((e) => e.isAlive && distance(e, this) < SUPPORT.SCOUT.DANGER_RADIUS);
    if (danger.length > 0) {
      const c = centroid(danger);
      const d = distance(c, this) || 1;
      this.moveTowards(this.x + ((this.x - c.x) / d) * 120, this.y + ((this.y - c.y) / d) * 120, dt);
      this.unitState = "FLEEING";
      this.redrawSelection();
      return;
    }

    const goal = this.goal(commander);
    this.unitState = this.moveTowards(goal.x, goal.y, dt) ? "IDLE" : "MOVING";
    this.redrawSelection();
  }

  private goal(commander: Commander): Point {
    switch (this.mode) {
      case "EXPLORE":
        return this.explorePoint ?? commander;
      case "RECALL":
        return { x: commander.x - Math.cos(commander.facing) * 40, y: commander.y + 50 };
      default: {
        const f = commander.facing;
        return {
          x: commander.x + Math.cos(f) * SUPPORT.SCOUT.VANGUARD_DISTANCE,
          y: commander.y + Math.sin(f) * SUPPORT.SCOUT.VANGUARD_DISTANCE,
        };
      }
    }
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

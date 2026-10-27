import Phaser from "phaser";
import { Unit } from "./Unit";
import { BALANCE, COLORS, ENEMIES, type EnemyKind } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Goblin: quadrado vermelho. IA simples de aggro → perseguição → ataque, com coleira.
 * Arqueiros param assim que o alvo entra no alcance e atiram de longe.
 */
export class Enemy extends Unit {
  readonly kind: EnemyKind;
  private readonly home: Point;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind = "GOBLIN") {
    super(scene, x, y, "ENEMY", ENEMIES[kind].stats);
    this.kind = kind;
    this.canCharge = kind === "MUTINEER_RIDER";
    this.home = { x, y };
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const s = this.radius;
    g.clear();
    g.fillStyle(ENEMIES[this.kind].color, 1);
    g.fillRect(-s, -s, s * 2, s * 2);
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.strokeRect(-s, -s, s * 2, s * 2);
    g.fillStyle(COLORS.OUTLINE, 1);
    if (this.ranged) {
      g.fillRect(-s / 2, -s / 2, s, s);
      g.fillRect(s - 2, -1, 6, 2);
    } else {
      g.fillRect(s - 4, -2, 4, 4);
    }
  }

  /** Aliado está ao alcance da percepção? Na floresta, só bem de perto. */
  private canPerceive(ally: Unit): boolean {
    const aggro = ENEMIES[this.kind].aggroRange ?? BALANCE.GOBLIN_AGGRO_RANGE;
    const limit = ally.isInForest ? Math.min(aggro, BALANCE.FOREST_DETECT_RANGE) : aggro;
    return distance(ally, this) <= limit;
  }

  think(dt: number, allies: readonly Unit[]): void {
    if (!this.isAlive) return;

    // Desiste de alvos mortos ou longe demais de casa (amotinados não têm "casa": sem coleira)
    const leash = ENEMIES[this.kind].aggroRange ?? BALANCE.GOBLIN_LEASH_RANGE;
    if (this.target && (!this.target.isAlive || distance(this.home, this) > Math.max(leash, BALANCE.GOBLIN_LEASH_RANGE))) {
      this.target = null;
    }
    if (!this.target) {
      let best: Unit | null = null;
      let bestDist = Infinity;
      for (const a of allies) {
        if (!this.canPerceive(a)) continue;
        const d = distance(a, this);
        if (d < bestDist) {
          best = a;
          bestDist = d;
        }
      }
      this.target = best;
    }

    if (this.target) {
      if (this.inRange(this.target)) {
        this.unitState = "ATTACKING";
      } else {
        this.moveTowards(this.target.x, this.target.y, dt);
        this.unitState = "MOVING";
      }
      return;
    }

    const arrived = this.moveTowards(this.home.x, this.home.y, dt, 0.7);
    this.unitState = arrived ? "IDLE" : "MOVING";
  }
}

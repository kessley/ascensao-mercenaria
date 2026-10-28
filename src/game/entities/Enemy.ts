import Phaser from "phaser";
import { Unit } from "./Unit";
import { BALANCE, COLORS, ENEMIES, TIME, type EnemyKind } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";

/**
 * Goblin: quadrado vermelho. IA simples de aggro → perseguição → ataque, com coleira.
 * Arqueiros param assim que o alvo entra no alcance e atiram de longe.
 */
export class Enemy extends Unit {
  /**
   * Alcance de percepção dos inimigos em relação ao normal: à noite, tochas denunciam o bando
   * de longe e o escuro o esconde (a cena atualiza a cada quadro).
   */
  static perception = 1;

  readonly kind: EnemyKind;
  /** Para onde volta sem alvo. Num bando errante, acompanha a marcha do bando. */
  home: Point;
  /** De quem é este inimigo no mundo: contrato ativo, bando errante ou motim. */
  owner:
    | { kind: "CONTRACT"; contractId: string }
    | { kind: "WARBAND"; id: string }
    | { kind: "MUTINY" }
    | { kind: "SIEGE"; settlementId: string }
    | { kind: "CALAMITY"; id: string }
    | null = null;
  /** Cor do corpo (soldados dos reinos usam a cor da facção). */
  readonly bodyColor: number;
  /** Longe de todos os aliados: não pensa nem luta (economia de processamento). */
  dormant = false;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind = "GOBLIN", color?: number) {
    super(scene, x, y, "ENEMY", ENEMIES[kind].stats);
    this.kind = kind;
    this.bodyColor = color ?? ENEMIES[kind].color;
    this.canCharge = kind === "MUTINEER_RIDER";
    this.home = { x, y };
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const s = this.radius;
    g.clear();
    g.fillStyle(this.bodyColor, 1);
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
    if (this.isBoss) {
      // Coroa: o líder de uma calamidade
      g.fillStyle(0xf1c40f, 1);
      g.fillTriangle(-s, -s - 2, -s / 2, -s - 12, 0, -s - 2);
      g.fillTriangle(0, -s - 2, s / 2, -s - 12, s, -s - 2);
      g.lineStyle(3, 0xf1c40f, 1);
      g.strokeRect(-s - 3, -s - 3, s * 2 + 6, s * 2 + 6);
    }
  }

  get isBoss(): boolean {
    return !!ENEMIES[this.kind].boss;
  }

  override get nightCreature(): boolean {
    return TIME.NIGHT_CREATURES.includes(this.kind);
  }

  /** Aliado está ao alcance da percepção? Na floresta, só bem de perto. */
  private canPerceive(ally: Unit): boolean {
    // Criaturas da noite enxergam no escuro: apagar as tochas não as engana
    const perception = this.nightCreature ? Math.max(1, Enemy.perception) : Enemy.perception;
    const aggro = (ENEMIES[this.kind].aggroRange ?? BALANCE.GOBLIN_AGGRO_RANGE) * perception;
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

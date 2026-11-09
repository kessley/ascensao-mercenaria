import Phaser from "phaser";
import { Unit } from "./Unit";
import { sfx } from "../../audio/sounds";
import { BALANCE, COLORS, COMBAT } from "../../utils/constants";
import { angleDiff, angleTo, nearest } from "../../utils/math";
import { commanderLook } from "../art/looks";
import { slashSprite } from "../world/CombatEffects";

export interface CommanderKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

/** Comandante: círculo azul com contorno dourado, controlado diretamente pelo jogador. */
export class Commander extends Unit {
  /** O jeito de quem manda (traços e cicatrizes, ver leaderBonus). */
  private might = 1;

  /** Ajusta o corpo ao Comandante do momento. */
  embody(hp: number, damage: number): void {
    const share = this.hp / this.maxHp;
    this.maxHp = Math.round(BALANCE.COMMANDER.hp * hp);
    this.might = damage;
    this.restoreHp(this.maxHp * share);
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ALLY", BALANCE.COMMANDER);
    this.autoAttack = false;
    this.isHero = true;
    this.role = "HERO";
    this.wear(commanderLook());
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const r = this.radius;
    g.clear();
    if (this.sprite) {
      // Penacho e capa já o distinguem; o anel dourado no chão o acha no meio da tropa
      g.lineStyle(2, COLORS.COMMANDER_OUTLINE, 1);
      g.strokeEllipse(0, this.feetY, r * 2 + 10, r + 6);
      return;
    }
    g.fillStyle(COLORS.ALLY, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(3, COLORS.COMMANDER_OUTLINE, 1);
    g.strokeCircle(0, 0, r);
    // Indicador de direção
    g.fillStyle(COLORS.COMMANDER_OUTLINE, 1);
    g.fillTriangle(r + 6, 0, r - 2, -5, r - 2, 5);
    // Estandarte do Comandante (atrás, numa haste): referência visual para as tropas
    g.lineStyle(2, COLORS.OUTLINE, 1);
    g.lineBetween(-r + 2, -4, -r - 8, -r - 14);
    g.fillStyle(COLORS.COMMANDER_OUTLINE, 1);
    g.fillTriangle(-r - 8, -r - 14, -r - 24, -r - 10, -r - 8, -r - 4);
  }

  /** Marcha forçada: o Comandante puxa o passo (a tropa acompanha). */
  override speedMultiplier(): number {
    return super.speedMultiplier() * Unit.pace;
  }

  handleMovement(keys: CommanderKeys, dt: number): boolean {
    if (!this.isAlive) return false; // não "ressuscita" quem caiu entre um quadro e outro
    let vx = 0;
    let vy = 0;
    if (keys.A.isDown) vx -= 1;
    if (keys.D.isDown) vx += 1;
    if (keys.W.isDown) vy -= 1;
    if (keys.S.isDown) vy += 1;
    if (vx === 0 && vy === 0) {
      this.unitState = "IDLE";
      return false;
    }
    const len = Math.hypot(vx, vy);
    const step = this.speed * this.speedMultiplier() * dt;
    this.stepBy((vx / len) * step, (vy / len) * step);
    this.setFacing(Math.atan2(vy, vx));
    this.unitState = "MOVING";
    return true;
  }

  /**
   * Golpe em arco à frente. Se houver um inimigo ao alcance, vira para ele antes;
   * atinge todos os inimigos dentro do arco.
   */
  override outgoingDamage(target: Unit): number {
    return super.outgoingDamage(target) * COMBAT.HERO_PACE * this.might;
  }

  trySwing(enemies: readonly Unit[], time: number): void {
    if (!this.isAlive || !this.canAttack(time)) return;
    this.lastAttackAt = time;

    const closest = nearest(
      enemies.filter((e) => this.inRange(e)),
      this,
    );
    if (closest) this.setFacing(angleTo(this, closest));

    for (const enemy of enemies) {
      if (!enemy.isAlive || !this.inRange(enemy)) continue;
      if (angleDiff(this.facing, angleTo(this, enemy)) <= BALANCE.COMMANDER_SWING_ARC) {
        enemy.takeDamage(this.outgoingDamage(enemy), this, time);
      }
    }

    // A meia-lua da lâmina (G6): o raio da folha é o alcance dele
    slashSprite(this.scene, this.x, this.y, this.facing);
    sfx.swing(this);
  }
}

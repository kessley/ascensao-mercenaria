import Phaser from "phaser";
import { Unit } from "./Unit";
import { sfx } from "../../audio/sounds";
import { BALANCE, COLORS } from "../../utils/constants";
import { angleDiff, angleTo, nearest } from "../../utils/math";

export interface CommanderKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

/** Comandante: círculo azul com contorno dourado, controlado diretamente pelo jogador. */
export class Commander extends Unit {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ALLY", BALANCE.COMMANDER);
    this.autoAttack = false;
    this.isHero = true;
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    const r = this.radius;
    g.clear();
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
    this.x += (vx / len) * step;
    this.y += (vy / len) * step;
    this.setFacing(Math.atan2(vy, vx));
    this.unitState = "MOVING";
    return true;
  }

  /**
   * Golpe em arco à frente. Se houver um inimigo ao alcance, vira para ele antes;
   * atinge todos os inimigos dentro do arco.
   */
  trySwing(enemies: readonly Unit[], time: number): void {
    if (!this.isAlive || !this.canAttack(time)) return;
    this.lastAttackAt = time;

    const reach = this.radius + this.range;
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

    this.drawSlash(reach + 6);
    sfx.swing(this);
  }

  private drawSlash(radius: number): void {
    const slash = this.scene.add.graphics({ x: this.x, y: this.y });
    slash.lineStyle(4, COLORS.SLASH, 0.9);
    slash.beginPath();
    slash.arc(0, 0, radius, this.facing - BALANCE.COMMANDER_SWING_ARC, this.facing + BALANCE.COMMANDER_SWING_ARC);
    slash.strokePath();
    slash.setDepth(5);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 180,
      onComplete: () => slash.destroy(),
    });
  }
}

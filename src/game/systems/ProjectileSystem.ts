import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { BALANCE, COLORS } from "../../utils/constants";
import { distance } from "../../utils/math";

/**
 * Dispara uma flecha (linha curta) até a posição atual do alvo.
 * O dano é calculado no disparo e aplicado na chegada, só se o alvo
 * ainda estiver perto do ponto de impacto: dá para desviar correndo.
 */
export function fireArrow(scene: Phaser.Scene, shooter: Unit, target: Unit): void {
  const damage = shooter.outgoingDamage(target);
  const from = { x: shooter.x, y: shooter.y };
  const to = { x: target.x, y: target.y };
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const duration = (distance(from, to) / BALANCE.ARROW_SPEED) * 1000;

  const arrow = scene.add.graphics({ x: from.x, y: from.y }).setDepth(6);
  arrow.lineStyle(2, COLORS.ARROW, 1);
  arrow.lineBetween(-7, 0, 5, 0);
  arrow.fillStyle(COLORS.ARROW, 1);
  arrow.fillTriangle(8, 0, 3, -3, 3, 3);
  arrow.rotation = angle;

  scene.tweens.add({
    targets: arrow,
    x: to.x,
    y: to.y,
    duration,
    onComplete: () => {
      arrow.destroy();
      if (target.isAlive && distance(target, to) <= BALANCE.ARROW_HIT_RADIUS) {
        target.takeDamage(damage, shooter, scene.time.now, "RANGED");
      }
    },
  });
}

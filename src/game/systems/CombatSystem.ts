import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { fireArrow } from "./ProjectileSystem";

/** Resolve os ataques automáticos de todas as unidades que já estão no alcance do alvo. */
export function resolveAttacks(scene: Phaser.Scene, units: readonly Unit[], time: number): void {
  for (const unit of units) {
    if (!unit.autoAttack || !unit.isAlive || unit.unitState === "FLEEING") continue;
    const target = unit.target;
    if (!target || !target.isAlive) continue;
    if (!unit.inRange(target) || !unit.canAttack(time)) continue;

    unit.lastAttackAt = time;
    if (unit.ranged) {
      unit.setFacing(Math.atan2(target.y - unit.y, target.x - unit.x));
      fireArrow(scene, unit, target);
      continue;
    }

    const charging = unit.isCharging;
    unit.playAttack(target);
    target.takeDamage(unit.outgoingDamage(target), unit, time, "MELEE");
    if (charging) {
      // Impacto da investida: empurra o alvo e gasta o embalo
      const a = Math.atan2(target.y - unit.y, target.x - unit.x);
      target.x += Math.cos(a) * unit.chargeKnockback;
      target.y += Math.sin(a) * unit.chargeKnockback;
      unit.chargeDistance = 0;
    }
  }
}

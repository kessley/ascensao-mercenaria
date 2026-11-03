import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { fireVolley } from "./ProjectileSystem";
import { chargePush, hitChance } from "../sim/combatRules";
import { COMBAT } from "../../utils/constants";
import { angleTo, distance } from "../../utils/math";
import { sfx } from "../../audio/sounds";

/** Lanças firmes de frente: a investida morre nelas e quem carregou paga o preço. */
function breakCharge(unit: Unit, target: Unit, time: number): void {
  const away = angleTo(target, unit);
  unit.chargeDistance = 0;
  unit.noteCharge(time);
  unit.shove(away, unit.chargeKnockback * 0.6);
  unit.stunnedUntil = time + COMBAT.BRACE_STUN_MS;
  unit.takeDamage(target.outgoingDamage(unit) * COMBAT.BRACE_COUNTER, target, time, "MELEE");
  target.floatText("lanças!", "#ffe9a8");
  sfx.charge(target);
}

/** O choque: joga o alvo para trás, derruba, abala a tropa dele e abre caminho entre os vizinhos. */
function chargeImpact(unit: Unit, target: Unit, units: readonly Unit[], time: number): void {
  const a = angleTo(unit, target);
  const push = chargePush(unit.chargeKnockback, unit.mass, target.mass);
  sfx.charge(target);
  target.shove(a, push);
  target.stunnedUntil = time + COMBAT.CHARGE_STUN_MS;
  target.shock(COMBAT.CHARGE_SHOCK);
  for (const other of units) {
    if (other === target || !other.isAlive || other.team === unit.team || distance(other, target) > COMBAT.CHARGE_SPLASH) continue;
    other.shove(angleTo(unit, other), push * 0.5);
    other.shock(COMBAT.CHARGE_SHOCK * 0.15);
  }
  unit.chargeDistance = 0;
  unit.rideThrough(a, time);
}

/** Resolve os ataques automáticos de todas as unidades que já estão no alcance do alvo. */
export function resolveAttacks(scene: Phaser.Scene, units: readonly Unit[], time: number): void {
  for (const unit of units) {
    if (!unit.autoAttack || !unit.isAlive || unit.unitState === "FLEEING") continue;
    const target = unit.target;
    if (!target || !target.isAlive) continue;
    if (!unit.inRange(target) || !unit.canAttack(time)) continue;

    unit.lastAttackAt = time;
    if (unit.ranged) {
      unit.setFacing(angleTo(unit, target));
      fireVolley(scene, unit, target);
      continue;
    }

    const charging = unit.isCharging;
    unit.playAttack(target);
    if (charging && target.braces(unit)) {
      breakCharge(unit, target, time);
      continue;
    }
    // A investida sempre chega; o golpe comum pode errar ou ser aparado
    if (!charging && Math.random() > hitChance(unit.meleeSkill(), target.defenseSkill(time), target.approachOf(unit))) {
      sfx.clash(target);
      continue;
    }
    target.takeDamage(unit.outgoingDamage(target), unit, time, "MELEE");
    sfx.clash(target);
    if (charging) chargeImpact(unit, target, units, time);
  }
}

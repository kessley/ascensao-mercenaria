import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { fireVolley } from "./ProjectileSystem";
import { chargePush, hitChance } from "../sim/combatRules";
import { COMBAT } from "../../utils/constants";
import { angleTo, distance } from "../../utils/math";
import { sfx } from "../../audio/sounds";
import { combatFx } from "../world/CombatEffects";

/** Lanças firmes de frente: a investida morre nelas e quem carregou paga o preço. */
function breakCharge(scene: Phaser.Scene, unit: Unit, target: Unit, time: number): void {
  const away = angleTo(target, unit);
  // A investida para nas lanças: a poeira sobe ali, menor que a do choque
  combatFx(scene)?.impact(target.x, target.foot.y, angleTo(unit, target), 0.5);
  unit.chargeDistance = 0;
  unit.noteCharge(time);
  unit.shove(away, unit.chargeKnockback * 0.6);
  unit.stunnedUntil = time + COMBAT.BRACE_STUN_MS;
  unit.takeDamage(target.outgoingDamage(unit) * COMBAT.BRACE_COUNTER, target, time, "MELEE");
  target.floatText("lanças!", "#ffe9a8");
  sfx.charge(target);
}

/** O choque: joga o alvo para trás, derruba, abala a tropa dele e abre caminho entre os vizinhos. */
function chargeImpact(scene: Phaser.Scene, unit: Unit, target: Unit, units: readonly Unit[], time: number): void {
  const a = angleTo(unit, target);
  // A nuvem do choque: é por ela que se vê de longe onde a investida bateu (G6)
  combatFx(scene)?.impact(target.x, target.foot.y, a, unit.chargePower);
  const push = chargePush(unit.chargeKnockback, unit.mass, target.mass);
  sfx.charge(target);
  target.shove(a, push);
  target.stunnedUntil = time + COMBAT.CHARGE_STUN_MS;
  target.shock(COMBAT.CHARGE_SHOCK * unit.chargeShock);
  for (const other of units) {
    if (other === target || !other.isAlive || other.team === unit.team || distance(other, target) > COMBAT.CHARGE_SPLASH) continue;
    other.shove(angleTo(unit, other), push * 0.5);
    other.shock(COMBAT.CHARGE_SHOCK * unit.chargeShock * 0.15);
  }
  unit.chargeDistance = 0;
  unit.rideThrough(a, time);
}

/** Resolve os ataques automáticos de todas as unidades que já estão no alcance do alvo. */
export function resolveAttacks(scene: Phaser.Scene, units: readonly Unit[], time: number): void {
  for (const unit of units) {
    if (!unit.autoAttack || !unit.isAlive || unit.unitState === "FLEEING" || unit.watching || unit.dueling) continue;
    const target = unit.target;
    // Ninguém mexe nos dois do anel (Marco 21), nem em quem parou para olhar
    if (!target || !target.isAlive || target.dueling || target.watching) continue;
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
      breakCharge(scene, unit, target, time);
      continue;
    }
    // A investida sempre chega; o golpe comum pode errar ou ser aparado
    if (!charging && Math.random() > hitChance(unit.meleeSkill(), target.defenseSkill(time), target.approachOf(unit))) {
      sfx.clash(target);
      // Aparado: aço no aço solta faísca (só entre quem tem arma de metal: carros e bichos, não)
      if (unit.matter !== "WOOD" && target.matter !== "WOOD") combatFx(scene)?.spark(unit, target);
      continue;
    }
    target.takeDamage(unit.outgoingDamage(target), unit, time, "MELEE");
    if (unit.meleeShock > 0) target.shock(unit.meleeShock);
    sfx.clash(target);
    if (charging) chargeImpact(scene, unit, target, units, time);
  }
}

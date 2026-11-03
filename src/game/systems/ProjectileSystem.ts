import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { scatterPoint, victimAt, volleySpread } from "../sim/combatRules";
import { COLORS, COMBAT } from "../../utils/constants";
import { distance, type Point } from "../../utils/math";
import { sfx } from "../../audio/sounds";

/** Quem está em campo agora: uma flecha que cai não escolhe lado. A cena atualiza a cada quadro. */
let field: readonly Unit[] = [];

export function setArrowField(units: readonly Unit[]): void {
  field = units;
}

/** Quem pode levar uma flecha perdida (gente em paz fica de fora: ninguém começa uma guerra por acidente). */
const inTheWay = (u: Unit) => u.isAlive && u.strayTarget;

function land(scene: Phaser.Scene, shooter: Unit, at: Point, damage: number): void {
  const victim = victimAt(field.filter(inTheWay), at);
  if (!victim) return;
  victim.takeDamage(damage, shooter, scene.time.now, "RANGED");
  sfx.arrowHit(at);
}

/** Uma flecha: sobe em arco (tiro reto vai direto e mais rápido) e só decide em quem acerta ao cair. */
function launch(scene: Phaser.Scene, shooter: Unit, from: Point, to: Point, damage: number): void {
  const flat = shooter.flatShot;
  const duration = (distance(from, to) / (flat ? COMBAT.BOLT_SPEED : COMBAT.ARROW_SPEED)) * 1000;
  const arrow = scene.add.graphics({ x: from.x, y: from.y }).setDepth(6);
  arrow.lineStyle(2, COLORS.ARROW, 1);
  arrow.lineBetween(-7, 0, 5, 0);
  arrow.fillStyle(COLORS.ARROW, 1);
  arrow.fillTriangle(8, 0, 3, -3, 3, 3);
  arrow.rotation = Math.atan2(to.y - from.y, to.x - from.x);
  scene.tweens.add({ targets: arrow, x: to.x, y: to.y, duration });
  if (!flat) scene.tweens.add({ targets: arrow, scale: 1.7, duration: duration / 2, yoyo: true, ease: "Sine.easeOut" });
  // A queda segue o relógio do jogo, não o da animação: pausa e câmera lenta valem para ela
  scene.time.delayedCall(duration, () => {
    arrow.destroy();
    land(scene, shooter, to, damage);
  });
}

/**
 * Dispara uma salva: cada flecha cai num ponto da área em volta do alvo, e essa área cresce com a
 * distância e com o tamanho da unidade. Quem está lá leva, seja de que lado for: tropa fechada
 * sofre mais que tropa espalhada, e atirar num corpo a corpo é arriscar os próprios homens.
 */
export function fireVolley(scene: Phaser.Scene, shooter: Unit, target: Unit): void {
  const from = { x: shooter.x, y: shooter.y };
  const aim = { x: target.x, y: target.y };
  const spread = volleySpread(distance(from, aim), shooter.spread, shooter.volleySize);
  const damage = shooter.outgoingDamage(target) / shooter.volley;
  sfx.bowShot(from);
  shooter.spendAmmo();
  for (let i = 0; i < shooter.volley; i++) launch(scene, shooter, from, scatterPoint(from, aim, spread), damage);
}

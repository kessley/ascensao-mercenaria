import type Phaser from "phaser";
import type { Unit } from "../entities/Unit";
import { scatterPoint, victimAt, volleySpread } from "../sim/combatRules";
import { COMBAT } from "../../utils/constants";
import { combatFx, type Flight } from "../world/CombatEffects";
import { distance, type Point } from "../../utils/math";
import { sfx } from "../../audio/sounds";

/** Quem está em campo agora: uma flecha que cai não escolhe lado. A cena atualiza a cada quadro. */
let field: readonly Unit[] = [];

export function setArrowField(units: readonly Unit[]): void {
  field = units;
}

/** Quem pode levar uma flecha perdida (gente em paz fica de fora: ninguém começa uma guerra por acidente). */
const inTheWay = (u: Unit) => u.isAlive && u.strayTarget;

/** A queda: acerta quem estiver ali (true) ou finca no chão (false). */
function land(scene: Phaser.Scene, shooter: Unit, at: Point, damage: number): boolean {
  const victim = victimAt(field.filter(inTheWay), at);
  if (!victim) return false;
  victim.takeDamage(damage, shooter, scene.time.now, "RANGED");
  sfx.arrowHit(at);
  return true;
}

/** Uma flecha: sobe em arco (tiro reto vai direto e mais rápido) e só decide em quem acerta ao cair. */
function launch(scene: Phaser.Scene, shooter: Unit, from: Point, to: Point, damage: number): void {
  const flat = shooter.flatShot;
  const duration = (distance(from, to) / (flat ? COMBAT.BOLT_SPEED : COMBAT.ARROW_SPEED)) * 1000;
  // A queda segue o relógio do jogo, não o da animação: pausa e câmera lenta valem para ela.
  // O desenho (G6) anda no mesmo relógio: a flecha chega quando o dano chega
  const fx = combatFx(scene);
  let flight: Flight | null = null;
  const timer = scene.time.delayedCall(duration, () => {
    const hit = land(scene, shooter, to, damage);
    if (flight) fx?.land(flight, !hit);
  });
  flight = fx?.launch(shooter.missile, from, to, flat, timer) ?? null;
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

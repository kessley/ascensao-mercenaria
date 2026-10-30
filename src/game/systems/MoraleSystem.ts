import type { Unit } from "../entities/Unit";
import { BALANCE, SUPPORT } from "../../utils/constants";
import { angleDiff, angleTo, clamp, distance, type Point } from "../../utils/math";

const M = BALANCE.MORALE;

/**
 * Quem tem moral: os batalhões do jogador e os esquadrões inimigos (Marco 16). As regras são
 * as mesmas para os dois lados, de propósito.
 */
export interface MoraleGroup {
  readonly isDestroyed: boolean;
  pendingDeaths: number;
  readonly center: Point;
  readonly soldiers: readonly Unit[];
  readonly facing: number;
  morale: number;
  readonly panicking: boolean;
  readonly mods: { moraleLoss: number };
  readonly leaderPassive: { moraleLoss?: number; recovery?: number; panicBelow?: number } | null;
  readonly fatigueRecovery: number;
  panic(): void;
  rally(): void;
}

/** O batalhão enxerga o estandarte do Comandante? E ele está vacilando (Comandante muito ferido)? */
export interface BannerSight {
  seen: boolean;
  faltering: boolean;
}

/**
 * Atualiza a Moral do batalhão:
 * - perde por baixa sofrida, por flanqueamento e por estar em menor número;
 * - recupera longe do perigo e perto do Comandante;
 * - o estandarte à vista dá coesão; o estandarte vacilando abala quem o vê;
 * - abaixo de PANIC_BELOW entra em pânico; acima de RALLY_ABOVE volta ao controle.
 */
export function updateMorale(
  battalion: MoraleGroup,
  enemies: readonly Unit[],
  commander: Unit | null,
  dt: number,
  time: number,
  banner: BannerSight = { seen: false, faltering: false },
): void {
  if (battalion.isDestroyed) return;

  let delta = -battalion.pendingDeaths * M.LOSS_PER_DEATH;
  battalion.pendingDeaths = 0;

  const center = battalion.center;
  const threats = enemies.filter((e) => distance(e, center) <= M.THREAT_RADIUS).length;

  if (threats >= battalion.soldiers.length * 2) {
    delta -= M.OUTNUMBERED_PER_SEC * dt;
  }

  // Flanco: golpe recente vindo de mais de 90° em relação à frente da formação
  let flanked = 0;
  for (const s of battalion.soldiers) {
    const attacker = s.lastHitFrom;
    if (!attacker || time - s.lastHitAt > M.HIT_MEMORY_MS) continue;
    if (angleDiff(battalion.facing, angleTo(s, attacker)) > Math.PI / 2) flanked++;
  }
  delta -= flanked * M.FLANKED_PER_SOLDIER_PER_SEC * dt;
  // Disciplina (habilidade) e um tenente Inabalável amortecem todas as perdas
  const passive = battalion.leaderPassive;
  delta *= battalion.mods.moraleLoss * (passive?.moraleLoss ?? 1);
  // Estandarte à vista: os soldados seguem e protegem a bandeira do seu senhor
  if (banner.seen && !banner.faltering) {
    delta *= SUPPORT.BANNER_MORALE_LOSS;
    delta += SUPPORT.BANNER_RECOVERY_PER_SEC * dt;
  } else if (banner.seen && banner.faltering) {
    delta -= SUPPORT.BANNER_FALTER_PER_SEC * dt;
  }

  // Tropa exausta custa a se recompor
  if (threats === 0) delta += M.RECOVERY_PER_SEC * (passive?.recovery ?? 1) * battalion.fatigueRecovery * dt;
  if (commander?.isAlive && distance(commander, center) <= M.COMMANDER_AURA_RADIUS) {
    delta += M.COMMANDER_AURA_PER_SEC * dt;
  }

  battalion.morale = clamp(battalion.morale + delta, 0, M.MAX);

  const panicBelow = passive?.panicBelow ?? M.PANIC_BELOW;
  if (!battalion.panicking && battalion.morale < panicBelow) battalion.panic();
  else if (battalion.panicking && battalion.morale >= M.RALLY_ABOVE) battalion.rally();
}

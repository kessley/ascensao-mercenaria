import type { Unit } from "../entities/Unit";
import { BALANCE, COMBAT, SUPPORT } from "../../utils/constants";
import { clamp, distance, type Point } from "../../utils/math";
import { approachOf } from "../sim/combatRules";

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
  /** Fileiras atrás seguram quem está na frente (< 1 = perde menos moral). */
  readonly rankSupport?: number;
  /** Limite de pânico próprio da tropa (habilidade). */
  readonly panicFloor?: number;
  /** Quantos começaram: baixa dói igual em tropa grande e pequena. */
  readonly startingCount: number;
  /** Bravura da tropa (< 1 = perde menos moral). */
  readonly steadiness?: number;
  /** Abalos desde a última leitura: investida, flechas. */
  pendingShock: number;
  /** Está sendo atacada pelo lado ou por trás agora. */
  flanked: boolean;
  /** Quando levou o último choque de ser pega pelo lado. */
  flankShockAt: number;
  readonly leaderPassive: { moraleLoss?: number; recovery?: number; panicBelow?: number } | null;
  /** Perto do capitão da companhia (< 1 = perde menos moral; Marco 20). */
  readonly captainAura?: number;
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

  // Cada baixa pesa pelo tamanho da tropa: oito homens sentem mais a perda de um
  const perDeath = (M.LOSS_PER_DEATH * BALANCE.BATTALION_SIZE) / Math.max(1, battalion.startingCount);
  let delta = -battalion.pendingDeaths * perDeath - battalion.pendingShock;
  battalion.pendingDeaths = 0;
  battalion.pendingShock = 0;

  const center = battalion.center;
  const threats = enemies.filter((e) => distance(e, center) <= M.THREAT_RADIUS).length;

  if (threats >= battalion.soldiers.length * 2) {
    delta -= M.OUTNUMBERED_PER_SEC * dt;
  }

  // Golpe recente vindo do lado ou de trás: a tropa percebe que foi pega no ponto fraco
  let side = 0;
  let rear = 0;
  for (const s of battalion.soldiers) {
    const attacker = s.lastHitFrom;
    if (!attacker || time - s.lastHitAt > M.HIT_MEMORY_MS) continue;
    const approach = approachOf(battalion.facing, s, attacker);
    if (approach === "REAR") rear++;
    else if (approach === "FLANK") side++;
  }
  delta -= (side * M.FLANKED_PER_SOLDIER_PER_SEC + rear * M.REAR_PER_SOLDIER_PER_SEC) * dt;
  battalion.flanked = side + rear > 0;
  if (battalion.flanked && time - battalion.flankShockAt >= COMBAT.FLANK_SHOCK_EVERY_MS) {
    battalion.flankShockAt = time;
    delta -= COMBAT.FLANK_SHOCK;
  }
  // Disciplina (habilidade) e um tenente Inabalável amortecem todas as perdas
  const passive = battalion.leaderPassive;
  delta *= battalion.mods.moraleLoss * (passive?.moraleLoss ?? 1) * (battalion.rankSupport ?? 1) * (battalion.steadiness ?? 1) * (delta < 0 ? (battalion.captainAura ?? 1) : 1);
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

  const panicBelow = Math.min(passive?.panicBelow ?? M.PANIC_BELOW, battalion.panicFloor ?? M.PANIC_BELOW);
  if (!battalion.panicking && battalion.morale < panicBelow) battalion.panic();
  else if (battalion.panicking && battalion.morale >= M.RALLY_ABOVE) battalion.rally();
}

/**
 * Medo pega: quem começou a fugir agora abala os do mesmo lado que estão por perto. A cena passa
 * a lista de quem viu alguém fugir uma vez só (`routing`, os que entraram em pânico neste quadro).
 */
export function spreadRout(routing: readonly MoraleGroup[], neighbors: readonly MoraleGroup[]): void {
  for (const fleeing of routing) {
    const c = fleeing.center;
    for (const other of neighbors) {
      if (other === fleeing || other.isDestroyed || other.panicking) continue;
      if (distance(other.center, c) <= COMBAT.ROUT_RADIUS) other.pendingShock += COMBAT.ROUT_CONTAGION;
    }
  }
}

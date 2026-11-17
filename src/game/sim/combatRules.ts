import { COMBAT, FATIGUE } from "../../utils/constants";
import { angleDiff, angleTo, clamp, type Point } from "../../utils/math";

/**
 * Regras do combate como funções puras: quem acerta quem, de que lado, quanto a armadura segura e
 * onde cada flecha cai. Não sabem o que é uma unidade do Phaser, então os dois lados usam a mesma
 * conta e dá para testar tudo sem abrir o jogo.
 */

/** De que lado da formação vem o golpe. */
export type Approach = "FRONT" | "FLANK" | "REAR";

/** Lado por onde `from` chega em quem está em `at`, com a frente virada para `facing`. */
export function approachOf(facing: number, at: Point, from: Point): Approach {
  const off = angleDiff(facing, angleTo(at, from));
  if (off <= COMBAT.FRONT_ARC) return "FRONT";
  return off <= COMBAT.REAR_ARC ? "FLANK" : "REAR";
}

/** Defesa que sobra conforme o lado: ninguém apara o que vem pelas costas. */
export function defenseAt(defense: number, approach: Approach): number {
  if (approach === "REAR") return defense * COMBAT.DEFENSE_REAR;
  return approach === "FLANK" ? defense * COMBAT.DEFENSE_FLANK : defense;
}

/** Chance de um golpe corpo a corpo acertar. */
export function hitChance(attack: number, defense: number, approach: Approach): number {
  return clamp(COMBAT.HIT_BASE + (attack - defenseAt(defense, approach)) / 100, COMBAT.HIT_MIN, COMBAT.HIT_MAX);
}

/** Quem está em cima de alguém agora (já pesado: a investida conta por dois). */
export interface Pressure {
  /** Todos os atacantes de perto. */
  attackers: number;
  /** Os que vêm pela frente. */
  front: number;
  /** Tem vizinho de pé na fileira. */
  inRank: boolean;
  /** Está numa parede de escudos. */
  shieldWall: boolean;
}

/**
 * Pressão (Marco 24): a fração da chance de aparar (e de desviar) que se perde por ter vários em
 * cima. Cada atacante além do primeiro tira um tanto; na parede de escudos, pela frente só cabem
 * dois. Na fileira o teto é baixo; sozinho, quase nada sobra: ninguém segura uma multidão.
 */
export function pressureCut(p: Pressure): number {
  const front = p.shieldWall ? Math.min(p.front, COMBAT.PRESSURE_SHIELD_FRONT) : p.front;
  const n = front + Math.max(0, p.attackers - p.front);
  const cut = Math.max(0, n - 1) * (p.inRank ? COMBAT.PRESSURE_PER_ATTACKER : COMBAT.PRESSURE_PER_ATTACKER_ALONE);
  return Math.min(cut, p.inRank ? COMBAT.PRESSURE_CAP_RANK : COMBAT.PRESSURE_CAP_ALONE);
}

/**
 * A chance de acerto com a pressão: o que se corta é o aparo, e não a perícia. Até o goblin fraco
 * acerta quem tem seis em cima, porque ninguém apara seis lâminas de uma vez.
 */
export function pressedHit(chance: number, cut: number): number {
  return 1 - (1 - chance) * (1 - cut);
}

/** O que sobra da defesa com o cansaço (Marco 24): nada muda até 40; com 100, 30% a menos. */
export function fatigueDefense(tiredness: number): number {
  const over = Math.max(0, Math.min(100, tiredness) - FATIGUE.DEFENSE_FROM) / (100 - FATIGUE.DEFENSE_FROM);
  return 1 - over * FATIGUE.MAX_DEFENSE_LOSS;
}

/** Fração do dano que passa pela armadura. */
export function armorFactor(armor: number, pierce: number): number {
  return 1 - armor * (1 - pierce);
}

/** Dano extra por apanhar de lado ou por trás. */
export function sideDamage(approach: Approach, ranged: boolean): number {
  if (approach === "FRONT") return 1;
  if (ranged) return approach === "REAR" ? COMBAT.REAR_ARROW : COMBAT.FLANK_ARROW;
  return approach === "REAR" ? COMBAT.REAR_TAKEN : COMBAT.FLANK_TAKEN;
}

/**
 * Raio da área em que uma salva cai: cresce com a distância e com o tamanho da unidade que atira
 * (poucos arqueiros concentram o tiro; muitos cobrem mais chão). `accuracy` < 1 é tiro mais justo.
 */
export function volleySpread(distance: number, accuracy: number, shooters: number): number {
  const size = clamp(Math.sqrt(Math.max(1, shooters) / COMBAT.SPREAD_REFERENCE), COMBAT.SPREAD_MIN_SIZE, COMBAT.SPREAD_MAX_SIZE);
  return (COMBAT.SPREAD_BASE + distance * COMBAT.SPREAD_PER_PX) * accuracy * size;
}

/**
 * Onde uma flecha cai: em volta do ponto visado, numa elipse mais comprida na linha do tiro (errar
 * a distância é mais fácil que errar a direção). `random` entra de fora para os testes.
 */
export function scatterPoint(from: Point, aim: Point, spread: number, random: () => number = Math.random): Point {
  const dir = angleTo(from, aim);
  const a = random() * Math.PI * 2;
  // Raiz: distribui por igual pela área, não amontoado no centro
  const r = Math.sqrt(random());
  const along = Math.cos(a) * r * spread * COMBAT.SPREAD_LONG;
  const across = Math.sin(a) * r * spread;
  return { x: aim.x + Math.cos(dir) * along - Math.sin(dir) * across, y: aim.y + Math.sin(dir) * along + Math.cos(dir) * across };
}

/** Quem está sob o ponto em que a flecha caiu: o mais perto, dentro do alcance do corpo. */
export function victimAt<T extends Point & { radius: number }>(units: readonly T[], at: Point): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const u of units) {
    const dx = u.x - at.x;
    const dy = u.y - at.y;
    const reach = u.radius + COMBAT.ARROW_HIT_MARGIN;
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const gap = Math.hypot(dx, dy) - reach;
    if (gap <= 0 && gap < bestGap) {
      best = u;
      bestGap = gap;
    }
  }
  return best;
}

/** Quanto a investida empurra: um cavaleiro pesado joga longe; um brutamontes quase não sai do lugar. */
export function chargePush(knockback: number, attackerMass: number, targetMass: number): number {
  return knockback * clamp(attackerMass / Math.max(0.1, targetMass), COMBAT.PUSH_MIN_RATIO, COMBAT.PUSH_MAX_RATIO);
}

/** Fase da investida em ciclo: batendo, ou saindo para ganhar distância e voltar. */
export type CyclePhase = "IN" | "OUT";

export interface CycleState {
  phase: CyclePhase;
  /** Quando a tropa bateu (null = ainda não chegou). */
  hitAt: number | null;
}

/**
 * O próximo passo da investida em ciclo (vale para o batalhão e o esquadrão inimigo): bate, fica
 * um pouco no choque, sai para longe e, ao chegar, volta à carga.
 */
export function cycleStep(state: CycleState, now: number, arrived: boolean, hitMs: number = COMBAT.CYCLE_HIT_MS): "WITHDRAW" | "CHARGE" | "WAIT" {
  if (state.phase === "IN") return state.hitAt !== null && now - state.hitAt >= hitMs ? "WITHDRAW" : "WAIT";
  return arrived ? "CHARGE" : "WAIT";
}

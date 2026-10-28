import { BALANCE, ECONOMY, PROGRESSION, TROOPS } from "./constants";
import type { BattalionData } from "../store/useGameStore";
import { PASSIVES, type LieutenantData } from "../game/data/lieutenants";
import { followerRations, hasFollower, type Follower } from "../game/sim/campEvents";

/**
 * Rações consumidas por dia: 1 para cada SOLDIERS_PER_RATION soldados, mais 1 do Comandante e
 * o que os seguidores comem. Com um cozinheiro, a tropa gasta 20% menos.
 */
export function dailyRations(battalions: readonly BattalionData[], followers: readonly Follower[] = []): number {
  const soldiers = battalions.reduce((sum, b) => sum + b.soldiers, 0);
  const troops = Math.ceil(soldiers / ECONOMY.SOLDIERS_PER_RATION) * (hasFollower(followers, "COOK") ? 0.8 : 1);
  return Math.ceil(1 + troops + followerRations(followers));
}

/** Bônus de moral vindo do acampamento: o humor do dia e o capelão. */
export function campMoraleBonus(campMood: number, followers: readonly Follower[]): number {
  return campMood + (hasFollower(followers, "CHAPLAIN") ? 10 : 0);
}

/** Salário semanal do batalhão: veteranos (nível alto) cobram mais. */
export function battalionWage(b: BattalionData): number {
  const veteran = 1 + PROGRESSION.LEVEL_WAGE_BONUS * (b.level - 1);
  return Math.ceil(b.soldiers * TROOPS[b.troopType].wagePerSoldier * veteran);
}

/**
 * Folha salarial semanal: batalhões (com desconto se o tenente for Frugal) + salário dos tenentes.
 */
export function weeklyWages(battalions: readonly BattalionData[], lieutenants: readonly LieutenantData[] = []): number {
  const army = battalions.reduce((sum, b) => {
    const leader = lieutenants.find((l) => l.battalionId === b.id);
    const discount = leader ? (PASSIVES[leader.passive].wage ?? 1) : 1;
    return sum + Math.ceil(battalionWage(b) * discount);
  }, 0);
  return army + lieutenants.reduce((sum, l) => sum + l.wage, 0);
}

/** Custo para repor um soldado perdido neste batalhão. */
export function reinforceCostPerSoldier(b: BattalionData): number {
  return Math.ceil((TROOPS[b.troopType].cost / BALANCE.BATTALION_SIZE) * ECONOMY.REINFORCE_COST_FACTOR);
}

export interface MoraleBreakdown {
  value: number;
  hunger: number;
  arrears: number;
  /** Humor do acampamento e capelão (pode ser negativo). */
  camp: number;
}

/** Moral com que os batalhões entram na próxima batalha (fome, salários atrasados e o acampamento pesam). */
export function startingMorale(hungryDays: number, arrearsWeeks: number, camp = 0): MoraleBreakdown {
  const hunger = hungryDays * ECONOMY.HUNGER_MORALE_PER_DAY;
  const arrears = arrearsWeeks * ECONOMY.ARREARS_MORALE_PER_WEEK;
  const value = Math.max(ECONOMY.MIN_STARTING_MORALE, Math.min(BALANCE.MORALE.MAX, BALANCE.MORALE.MAX - hunger - arrears + camp));
  return { value, hunger, arrears, camp };
}

/** Dias até o próximo pagamento (no dia múltiplo de PAYDAY_INTERVAL). */
export function daysUntilPayday(day: number): number {
  const r = day % ECONOMY.PAYDAY_INTERVAL;
  return r === 0 ? ECONOMY.PAYDAY_INTERVAL : ECONOMY.PAYDAY_INTERVAL - r;
}

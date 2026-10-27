import { BALANCE, ECONOMY, PROGRESSION, TROOPS } from "./constants";
import type { BattalionData } from "../store/useGameStore";
import { PASSIVES, type LieutenantData } from "../game/data/lieutenants";

/** Rações consumidas por dia: 1 para cada SOLDIERS_PER_RATION soldados, mais 1 do Comandante. */
export function dailyRations(battalions: readonly BattalionData[]): number {
  const soldiers = battalions.reduce((sum, b) => sum + b.soldiers, 0);
  return 1 + Math.ceil(soldiers / ECONOMY.SOLDIERS_PER_RATION);
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
}

/** Moral com que os batalhões entram na próxima batalha (fome e salários atrasados pesam). */
export function startingMorale(hungryDays: number, arrearsWeeks: number): MoraleBreakdown {
  const hunger = hungryDays * ECONOMY.HUNGER_MORALE_PER_DAY;
  const arrears = arrearsWeeks * ECONOMY.ARREARS_MORALE_PER_WEEK;
  const value = Math.max(ECONOMY.MIN_STARTING_MORALE, BALANCE.MORALE.MAX - hunger - arrears);
  return { value, hunger, arrears };
}

/** Dias até o próximo pagamento (no dia múltiplo de PAYDAY_INTERVAL). */
export function daysUntilPayday(day: number): number {
  const r = day % ECONOMY.PAYDAY_INTERVAL;
  return r === 0 ? ECONOMY.PAYDAY_INTERVAL : ECONOMY.PAYDAY_INTERVAL - r;
}

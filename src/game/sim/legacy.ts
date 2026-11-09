import { LEGACY, SEASONS } from "../../utils/constants";
import type { TraitId } from "../data/lieutenants";
import type { CultureId } from "../data/planet";
import { clamp } from "../../utils/math";

/**
 * Legado (Marco 18): o Comandante tem nome, idade e cicatrizes, e pode morrer. O bando continua
 * com quem herdar o estandarte, e os traços do herdeiro mudam o rumo da campanha.
 */

export interface Leader {
  name: string;
  /** Idade quando assumiu o bando. */
  age: number;
  /** Dia em que assumiu. */
  since: number;
  /** 1 = quem fundou o bando. */
  generation: number;
  traits: TraitId[];
  /** Cada queda em combate deixa uma cicatriz. */
  wounds: number;
  /** De onde veio ("fundou o bando", "tenente de Lanças Cinzentas"...). */
  origin: string;
  /** A semente do retrato: o herdeiro que era capitão ou tenente leva o rosto que já tinha (G5). */
  face?: string;
  /** De onde ele vem (Marco 23); sem o campo, da terra natal do bando. */
  culture?: CultureId;
  /** Quanto ele já aprendeu das línguas de fora, de 0 a 100 (Marco 23). */
  tongues?: Partial<Record<CultureId, number>>;
}

export interface FormerLeader {
  name: string;
  generation: number;
  from: number;
  to: number;
  age: number;
  cause: string;
  origin: string;
  face?: string;
  wounds?: number;
  culture?: CultureId;
}

const DAYS_PER_YEAR = SEASONS.DAYS * 4;

/** A vida de mercenário gasta depressa: `AGE_PER_YEAR` anos de corpo por ano de campanha. */
export function leaderAge(leader: Pick<Leader, "age" | "since">, day: number): number {
  return Math.floor(leader.age + ((day - leader.since) / DAYS_PER_YEAR) * LEGACY.AGE_PER_YEAR);
}

/** Chance de não se levantar depois de cair em combate. */
export function fallDeathChance(age: number, wounds: number): number {
  return clamp(LEGACY.FALL_DEATH + Math.max(0, age - 30) * LEGACY.FALL_PER_AGE + wounds * LEGACY.FALL_PER_WOUND, 0, LEGACY.FALL_MAX);
}

/** Chance, por dia, de a idade cobrar a conta. */
export function oldAgeChance(age: number): number {
  return Math.max(0, age - LEGACY.OLD_FROM) * LEGACY.OLD_PER_YEAR;
}

/** O que cada traço muda em quem comanda. */
export interface LeaderBonus {
  damage: number;
  hp: number;
  /** Multiplica o pagamento dos contratos. */
  reward: number;
  /** Honra a mais por contrato cumprido. */
  honor: number;
}

export const LEADER_TRAITS: Record<TraitId, { bonus: Partial<LeaderBonus>; text: string }> = {
  GREEDY: { bonus: { reward: 1.15 }, text: "contratos pagam 15% mais" },
  BRAVE: { bonus: { damage: 1.15 }, text: "bate 15% mais forte" },
  CAUTIOUS: { bonus: { hp: 1.2 }, text: "aguenta 20% mais" },
  BLOODTHIRSTY: { bonus: { damage: 1.25, hp: 0.9 }, text: "bate 25% mais forte, aguenta 10% menos" },
  HONORABLE: { bonus: { honor: 2 }, text: "cada contrato dá 2 de Honra a mais" },
  AMBITIOUS: { bonus: { damage: 1.05, reward: 1.05 }, text: "bate 5% mais forte, contratos pagam 5% mais" },
  LOYAL: { bonus: { hp: 1.1, honor: 1 }, text: "aguenta 10% mais, cada contrato dá 1 de Honra a mais" },
};

export function leaderBonus(leader: Pick<Leader, "traits" | "wounds">): LeaderBonus {
  const out: LeaderBonus = { damage: 1, hp: 1, reward: 1, honor: 0 };
  for (const t of leader.traits) {
    const b = LEADER_TRAITS[t].bonus;
    out.damage *= b.damage ?? 1;
    out.hp *= b.hp ?? 1;
    out.reward *= b.reward ?? 1;
    out.honor += b.honor ?? 0;
  }
  out.hp *= 1 - Math.min(LEGACY.WOUND_MAX, leader.wounds) * LEGACY.WOUND_HP;
  return out;
}

/** Quem herda: o escolhido em testamento; sem ele, o tenente mais leal. */
export function chooseHeir<T extends { id: string; loyalty: number }>(lieutenants: readonly T[], heirId: string | null): T | null {
  return lieutenants.find((l) => l.id === heirId) ?? [...lieutenants].sort((a, b) => b.loyalty - a.loyalty)[0] ?? null;
}

/** Quanto a morte do chefe abala cada tenente que ficou. */
export function griefOf(traits: readonly TraitId[]): number {
  if (traits.includes("LOYAL")) return LEGACY.GRIEF / 2;
  return traits.includes("AMBITIOUS") ? LEGACY.GRIEF * 2 : LEGACY.GRIEF;
}

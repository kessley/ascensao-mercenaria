import { readyOf, type CampPlan } from "../data/campGrid";

/**
 * Marco 22, parte 4: a cidade que nasce sozinha (GDD 9.8). Em volta da fortaleza junta-se gente
 * (seguidores, famílias, refugiados e mercadores), e a cidade cresce pelo que a sede oferece:
 * segurança, comida, comércio e fama. O jogador não põe casas: governa por decretos.
 *
 * Tudo aqui é regra pura (sem Phaser nem store), usada pelo store, pela cena e pelos testes.
 */

// --- As etapas ---

export type CityStage = "CAMPTOWN" | "BURG" | "TOWN" | "CITY";
export const CITY_STAGES: readonly CityStage[] = ["CAMPTOWN", "BURG", "TOWN", "CITY"];

export const STAGE: Record<CityStage, { label: string; from: number; text: string }> = {
  CAMPTOWN: { label: "Arraial", from: 0, text: "Barracas de mascates e famílias junto ao portão." },
  BURG: { label: "Burgo", from: 120, text: "Casas, mercado e taverna. A fortaleza vira a muralha interna." },
  TOWN: { label: "Vila", from: 300, text: "Paliçada de fora e igreja. A vila entra no reino do bando." },
  CITY: { label: "Cidade", from: 700, text: "Muralha de pedra e bairros." },
};

/** A cidade inteira, quando todas as casas do gerador estão de pé. */
export const CITY_MAX = 1200;

/** Para virar cidade, a fortaleza precisa da muralha de pedra: sem ela, a vila para logo abaixo. */
export function stageCap(plan: CampPlan): number {
  return plan.wall === "STONE" ? CITY_MAX : STAGE.CITY.from - 1;
}

export function stageOf(people: number): CityStage {
  let out: CityStage = "CAMPTOWN";
  for (const s of CITY_STAGES) if (people >= STAGE[s].from) out = s;
  return out;
}

/** A partir da vila, ela é um povoado do bando no sistema do reino (Marco 9). */
export const inRealm = (stage: CityStage) => stage === "TOWN" || stage === "CITY";

/** Quanto do desenho da cidade inteira já está de pé (as casas aparecem do portão para fora). */
export function houseShare(people: number): number {
  return Math.max(0, Math.min(1, people / CITY_MAX));
}

// --- Os decretos ---

export type Decree = "ARTISANS" | "FAIR" | "REFUGEES" | "VETERANS";
export const DECREES: readonly Decree[] = ["ARTISANS", "FAIR", "REFUGEES", "VETERANS"];
export type CityTax = 0 | 1 | 2;

export const DECREE: Record<Decree, { label: string; text: string; upkeep: number }> = {
  ARTISANS: { label: "Incentivar artesãos", text: "O ferro do intendente fica 20% mais barato.", upkeep: 25 },
  FAIR: { label: "Feira semanal", text: "Mais comércio: a cidade atrai mais gente e paga mais.", upkeep: 15 },
  REFUGEES: { label: "Abrigar refugiados", text: "A cidade cresce rápido, mas a febre vem mais.", upkeep: 0 },
  VETERANS: { label: "Terra para veteranos", text: "Soldados velhos se aposentam na cidade e viram milícia.", upkeep: 0 },
};

/** O ferro mais barato com os artesãos (preço × isto). */
export const ARTISAN_IRON = 0.8;

export const TAX: Record<CityTax, { label: string; perHead: number; growth: number }> = {
  0: { label: "baixos", perHead: 0.15, growth: 1.3 },
  1: { label: "normais", perHead: 0.3, growth: 1 },
  2: { label: "altos", perHead: 0.5, growth: 0.6 },
};

// --- A cidade ---

export interface SeatCity {
  people: number;
  /** Dia em que o arraial começou (o do estandarte). */
  since: number;
  decrees: Decree[];
  tax: CityTax;
  /** Veteranos aposentados: a milícia da cidade. */
  militia: number;
  /** O povoado do bando no reino, quando a vila entra nele. */
  settlementId: string | null;
}

/** O arraial do estandarte: os seguidores e as famílias que já andavam com o bando. */
export function newSeatCity(day: number, followers: number, soldiers: number): SeatCity {
  return { people: Math.round(12 + followers * 3 + soldiers * 0.1), since: day, decrees: [], tax: 1, militia: 0, settlementId: null };
}

/** O que a sede oferece, de 0 a 1 cada. */
export interface CityDrivers {
  security: number;
  food: number;
  commerce: number;
  fame: number;
}

export interface DriverCtx {
  plan: CampPlan;
  /** Soldados da guarnição (quem fica na sede). */
  garrison: number;
  militia: number;
  rations: number;
  fame: number;
  decrees: readonly Decree[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function cityDrivers(c: DriverCtx): CityDrivers {
  const has = (k: Parameters<typeof readyOf>[1]) => readyOf(c.plan, k).length > 0;
  const wall = c.plan.wall === "STONE" ? 0.5 : c.plan.wall === "WOOD" ? 0.3 : 0;
  const security = clamp01(wall + Math.min(0.3, ((c.garrison + c.militia) / 200) * 0.3) + readyOf(c.plan, "TOWER").length * 0.05 + (has("KEEP") ? 0.1 : 0));
  const food = clamp01(0.3 + (has("GARDEN") ? 0.2 : 0) + (has("STOREHOUSE") ? 0.2 : 0) + (has("CISTERN") ? 0.1 : 0) + (c.rations >= 100 ? 0.2 : 0));
  const commerce = clamp01(0.1 + (has("CASTLE_FAIR") ? 0.3 : 0) + (has("QUARTERMASTER") ? 0.15 : 0) + (has("CAMP_TAVERN") ? 0.15 : 0) + (c.decrees.includes("FAIR") ? 0.3 : 0));
  return { security, food, commerce, fame: clamp01(c.fame / 100) };
}

/** Gente que chega por dia (mercadores, famílias, refugiados), fora a que nasce. */
export const GROWTH = { BASE: 0.5, COMMERCE: 2, FAME: 1.5, REFUGEES: 3, NATURAL: 0.012, UNSAFE_BELOW: 0.25, UNSAFE_LOSS: 0.01 };

/** O crescimento de um dia (pode ser negativo, quando a sede não protege ninguém). */
export function dailyGrowth(city: SeatCity, d: CityDrivers): number {
  if (d.security < GROWTH.UNSAFE_BELOW) return -city.people * GROWTH.UNSAFE_LOSS;
  const inflow = GROWTH.BASE + GROWTH.COMMERCE * d.commerce + GROWTH.FAME * d.fame + (city.decrees.includes("REFUGEES") ? GROWTH.REFUGEES : 0);
  const natural = city.people * GROWTH.NATURAL * ((d.security + d.food) / 2);
  return (inflow + natural) * TAX[city.tax].growth * (0.5 + d.security);
}

/** Um dia da cidade: a gente nova, presa no teto da etapa. */
export function growCity(city: SeatCity, d: CityDrivers, plan: CampPlan): SeatCity {
  const people = Math.max(0, Math.min(stageCap(plan), city.people + dailyGrowth(city, d)));
  return { ...city, people: Math.round(people * 100) / 100 };
}

// --- A semana ---

/** Impostos da semana (a partir do burgo), menos o custo dos decretos. */
export function weeklyGold(city: SeatCity, d: CityDrivers): number {
  const stage = stageOf(city.people);
  const tax = stage === "CAMPTOWN" ? 0 : city.people * TAX[city.tax].perHead * (1 + d.commerce * 0.5);
  const upkeep = city.decrees.reduce((n, k) => n + DECREE[k].upkeep, 0);
  return Math.round(tax - upkeep);
}

/** A febre dos refugiados: a chance por semana e quanto da cidade ela leva. */
export const FEVER = { CHANCE: 0.25, CHANCE_BASE: 0.04, LOSS: 0.08 };

export function feverWeek(city: SeatCity, roll: number): { city: SeatCity; lost: number } {
  const chance = city.decrees.includes("REFUGEES") ? FEVER.CHANCE : FEVER.CHANCE_BASE;
  if (roll >= chance || city.people < 40) return { city, lost: 0 };
  const lost = Math.round(city.people * FEVER.LOSS);
  return { city: { ...city, people: city.people - lost }, lost };
}

// --- Os veteranos ---

/** Quem pode se aposentar: soldados de batalhões com nível 3 ou mais (os velhos de guerra). */
export const VETERAN_LEVEL = 3;
/** Cada veterano traz a família: gente para a cidade. */
export const VETERAN_FAMILY = 3;

export function retireProblem(city: SeatCity | null, level: number, soldiers: number, n: number): string | null {
  if (!city) return "Só com a cidade da sede.";
  if (!city.decrees.includes("VETERANS")) return "Falta o decreto da terra para veteranos.";
  if (level < VETERAN_LEVEL) return `Só batalhões de nível ${VETERAN_LEVEL} ou mais têm veteranos.`;
  if (n < 1 || n >= soldiers) return "O batalhão precisa ficar com alguém.";
  return null;
}

export function retire(city: SeatCity, n: number): SeatCity {
  return { ...city, militia: city.militia + n, people: Math.min(CITY_MAX, city.people + n * VETERAN_FAMILY) };
}

/** O povoado do reino: o tipo e os números que acompanham a cidade. */
export function realmFigures(city: SeatCity): { kind: "VILLAGE" | "CITY"; population: number; garrison: number } {
  return { kind: stageOf(city.people) === "CITY" ? "CITY" : "VILLAGE", population: Math.round(city.people), garrison: 3 + Math.round(city.militia / 4) };
}

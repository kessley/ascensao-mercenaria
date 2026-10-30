import type { NobleTrait } from "./nobility";
import { NOBLE_TRAITS } from "./nobility";
import type { Point } from "../../utils/math";

/**
 * A cabeça do comandante inimigo (Marco 16). Função pura: recebe só o que ele SABE (o que os
 * soldados viram, com a posição de quando viram) e devolve o plano. Nada aqui enxerga o estado
 * real do jogo: é o que garante que a IA não trapaceia.
 */

export type PlanKind = "ASSAULT" | "FLANK" | "AMBUSH" | "REAR_STRIKE" | "DECAPITATE" | "FEINT" | "HOLD" | "RETREAT";

export const PLAN_LABEL: Record<PlanKind, string> = {
  ASSAULT: "ataque direto",
  FLANK: "linha e flanco",
  AMBUSH: "emboscada",
  REAR_STRIKE: "golpe na retaguarda",
  DECAPITATE: "caça ao Comandante",
  FEINT: "recuo fingido",
  HOLD: "resistir no terreno",
  RETREAT: "retirada",
};

/** Competência mínima para conhecer cada plano. */
export const PLAN_COMPETENCE: Record<PlanKind, number> = {
  ASSAULT: 1,
  RETREAT: 1,
  AMBUSH: 2,
  FLANK: 2,
  HOLD: 2,
  DECAPITATE: 2,
  REAR_STRIKE: 3,
  FEINT: 4,
};

/** Quem o bando viu e onde (nunca a posição de agora, se ninguém está olhando). */
export interface ContactView extends Point {
  kind: "HERO" | "TROOP" | "ARCHER" | "RIDER" | "WAGON" | "COURIER" | "SCOUT";
  power: number;
}

export interface SquadView {
  role: "MELEE" | "RANGED" | "RIDERS";
  size: number;
  morale: number;
  power: number;
  center: Point;
}

/** O que o comandante sabe na hora de decidir. */
export interface BattleView {
  competence: number;
  traits: readonly NobleTrait[];
  current: PlanKind | null;
  /** Truques que só funcionam uma vez por batalha. */
  spent: readonly PlanKind[];
  center: Point;
  ownPower: number;
  ownMorale: number;
  /** Fração das tropas que ainda está de pé. */
  strength: number;
  squads: readonly SquadView[];
  contacts: readonly ContactView[];
  /** Já está trocando golpes. */
  engaged: boolean;
  /** Foi visto de perto (emboscada não faz mais sentido). */
  exposed: boolean;
  /** Terreno bom por perto. */
  cover: { forest: Point | null; hill: Point | null };
}

/** Soma da força do que o bando sabe (o que ele não viu não conta: pode errar para menos). */
export function seenPower(contacts: readonly ContactView[]): number {
  return contacts.reduce((s, c) => s + (c.kind === "SCOUT" || c.kind === "COURIER" ? 0 : c.power), 0);
}

/** Centro do que foi visto: é para lá que se olha. */
export function foeCenter(contacts: readonly ContactView[]): Point | null {
  const main = contacts.filter((c) => c.kind !== "SCOUT" && c.kind !== "COURIER");
  if (main.length === 0) return null;
  return { x: main.reduce((n, c) => n + c.x, 0) / main.length, y: main.reduce((n, c) => n + c.y, 0) / main.length };
}

/** O Comandante do bando está à vista e longe da própria tropa? */
export function exposedHero(contacts: readonly ContactView[], radius: number): ContactView | null {
  const hero = contacts.find((c) => c.kind === "HERO");
  if (!hero) return null;
  const guards = contacts.filter((c) => (c.kind === "TROOP" || c.kind === "ARCHER" || c.kind === "RIDER") && Math.hypot(c.x - hero.x, c.y - hero.y) < radius);
  return guards.length === 0 ? hero : null;
}

/** Coragem do comandante: abaixo desta razão de forças, ele não fica para ver no que dá. */
function nerve(traits: readonly NobleTrait[]): number {
  if (traits.includes("BRAVE")) return 0.3;
  if (traits.includes("CRUEL")) return 0.4;
  if (traits.includes("COWARD")) return 0.85;
  return 0.55;
}

/**
 * Escolhe o plano. Cada um ganha pontos pela situação e pela personalidade; quem sabe menos
 * erra mais (o ruído cresce com a falta de competência) e não conhece os planos difíceis.
 */
export function choosePlan(v: BattleView, exposedRadius: number, random: () => number = Math.random): PlanKind {
  const foes = v.contacts.filter((c) => c.kind !== "SCOUT" && c.kind !== "COURIER");
  const ratio = v.ownPower / Math.max(1, seenPower(v.contacts));
  const has = (t: NobleTrait) => v.traits.includes(t);
  const melee = v.squads.filter((s) => s.role !== "RANGED");
  const score: Partial<Record<PlanKind, number>> = {};
  const add = (p: PlanKind, n: number) => {
    if (PLAN_COMPETENCE[p] <= v.competence && (p === v.current || !v.spent.includes(p))) score[p] = (score[p] ?? 0) + n;
  };

  add("ASSAULT", 30 + (Math.min(ratio, 2) - 1) * 20 + (has("BRAVE") || has("CRUEL") ? 12 : 0) + (has("COWARD") ? -15 : 0));

  // Em menor número, sai enquanto dá. Moral no chão ou muita baixa só contam se o outro lado
  // ainda estiver mais forte: quem também está em pedaços pode perder o campo por um fio
  if (ratio < nerve(v.traits)) add("RETREAT", 80 + (nerve(v.traits) - ratio) * 40);
  else if ((v.ownMorale < 30 || v.strength < 0.45) && ratio < 1) add("RETREAT", 70);
  else if (ratio < 0.8) add("RETREAT", 10);

  // Duas frentes: precisa de gente para dividir
  if (melee.length >= 2 && ratio >= 0.7) add("FLANK", 42 + (has("CUNNING") ? 14 : 0) + (has("SCHOLAR") ? 8 : 0));

  // Emboscar: só quem ainda não foi visto e tem mata por perto
  if (!v.engaged && !v.exposed && v.cover.forest) add("AMBUSH", 46 + (has("CUNNING") ? 22 : 0) + (has("CRUEL") ? 6 : 0) + (ratio < 1 ? 10 : 0) + (has("HONORABLE") ? -16 : 0));

  // Terreno bom e força parecida: deixa o inimigo vir
  if (v.cover.hill && ratio >= 0.5 && ratio < 1.4) add("HOLD", 38 + (has("COWARD") || has("SCHOLAR") || has("PIOUS") ? 16 : 0) + (v.engaged ? -22 : 0));

  // Caçar o Comandante: a glória de quem é ambicioso
  if (exposedHero(v.contacts, exposedRadius)) add("DECAPITATE", 56 + (has("AMBITIOUS") ? 26 : 0) + (has("BRAVE") ? 10 : 0));

  // Carroças e arqueiros à vista: gente de honra não faz isso
  const soft = foes.filter((c) => c.kind === "WAGON" || c.kind === "ARCHER");
  if (soft.length > 0 && melee.length >= 2) add("REAR_STRIKE", 36 + Math.min(16, soft.length * 3) + (has("GREEDY") ? 22 : 0) + (has("HONORABLE") ? -24 : 0));

  // Puxar a tropa para os arqueiros: exige gente e cabeça
  if (v.engaged && v.squads.length >= 2 && v.squads.some((s) => s.role === "RANGED") && ratio >= 0.7) add("FEINT", 40 + (has("CUNNING") ? 22 : 0) + (has("HONORABLE") ? -12 : 0));

  // Quem já tem plano não muda à toa
  if (v.current && score[v.current] !== undefined) score[v.current] = (score[v.current] ?? 0) + 14;

  let best: PlanKind = "ASSAULT";
  let bestScore = -Infinity;
  const noise = (6 - v.competence) * 7;
  for (const [plan, s] of Object.entries(score) as [PlanKind, number][]) {
    const total = s + random() * noise;
    if (total > bestScore) {
      bestScore = total;
      best = plan;
    }
  }
  return best;
}

/** Traço principal, para o jogador aprender a ler quem enfrenta. */
export const traitLabel = (t: NobleTrait | undefined) => (t ? NOBLE_TRAITS[t].label : "");

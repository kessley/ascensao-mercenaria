import { CAPTAINS, type GroupArrangement, type TroopFamily } from "../../utils/constants";
import type { Point } from "../../utils/math";
import type { TraitId } from "../data/lieutenants";
import { temperOf, type CaptainData } from "../data/captains";
import type { NobleTrait } from "./nobility";
import type { BattleView, ContactView, PlanKind, SquadView } from "./warMind";

/**
 * A cabeça do capitão em campo (Marco 20). Ele usa a mesma escolha de plano dos comandantes
 * inimigos (`choosePlan`, Marco 16), com a Tática no lugar da competência e os traços de tenente
 * traduzidos para os de nobre. Função pura: recebe só o que a companhia está vendo.
 */

/** Postura que o Comandante deu à companhia (ordens largas). */
export type CompanyStance = "FREE" | "HOLD" | "PURSUE";

export const STANCE_LABEL: Record<CompanyStance, string> = {
  FREE: "por conta própria",
  HOLD: "segurar o terreno",
  PURSUE: "perseguir quem fugir",
};

const NOBLE_OF: Partial<Record<TraitId, NobleTrait>> = {
  BRAVE: "BRAVE",
  BLOODTHIRSTY: "CRUEL",
  // O cauteloso pensa antes: prefere terreno e flanco a investir de frente
  CAUTIOUS: "SCHOLAR",
  GREEDY: "GREEDY",
  HONORABLE: "HONORABLE",
  AMBITIOUS: "AMBITIOUS",
};

export function captainTraits(traits: readonly TraitId[]): NobleTrait[] {
  return traits.flatMap((t) => (NOBLE_OF[t] ? [NOBLE_OF[t]] : []));
}

/** Até onde ele enxerga briga, conforme a postura e o temperamento. */
export function engageRadius(captain: Pick<CaptainData, "traits">, stance: CompanyStance): number {
  if (stance === "HOLD") return CAPTAINS.HOLD_RADIUS;
  if (stance === "PURSUE") return CAPTAINS.PURSUE_RADIUS;
  return CAPTAINS.ENGAGE[temperOf(captain)];
}

/** Papel de cada batalhão no plano (o mesmo dos esquadrões inimigos). */
export function roleOf(family: TroopFamily): SquadView["role"] {
  return family === "ARCHERS" ? "RANGED" : family === "CAVALRY" ? "RIDERS" : "MELEE";
}

/**
 * Como ele arruma a companhia numa marcha: quem sabe põe a infantaria na frente, os arqueiros
 * atrás e a cavalaria nas pontas. Quem não sabe usa o arranjo que o Comandante escolheu.
 */
export function companyArrangement(tactics: number, fallback: GroupArrangement): GroupArrangement {
  return tactics >= 3 ? "CAVALRY_FLANKS" : fallback;
}

export interface CompanySight {
  tactics: number;
  traits: readonly TraitId[];
  current: PlanKind | null;
  spent: readonly PlanKind[];
  center: Point;
  ownPower: number;
  ownMorale: number;
  strength: number;
  squads: readonly SquadView[];
  contacts: readonly ContactView[];
  engaged: boolean;
}

/** O que o capitão sabe, no formato que `choosePlan` entende. */
export function companyView(s: CompanySight): BattleView {
  return {
    competence: s.tactics,
    traits: captainTraits(s.traits),
    current: s.current,
    spent: s.spent,
    center: s.center,
    ownPower: s.ownPower,
    ownMorale: s.ownMorale,
    strength: s.strength,
    squads: s.squads,
    contacts: s.contacts,
    engaged: s.engaged,
    // Antes de trocar golpes, ainda dá para recusar a luta (e voltar para junto do Comandante);
    // sem terreno marcado, emboscada e colina ficam de fora
    exposed: s.engaged,
    pitched: false,
    cover: { forest: null, hill: null },
  };
}

/** Planos que só se tentam uma vez por batalha. */
export const ONE_SHOT: readonly PlanKind[] = ["FEINT", "AMBUSH"];

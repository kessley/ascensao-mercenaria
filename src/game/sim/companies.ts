import { CAPTAINS, type GroupArrangement, type TroopFamily } from "../../utils/constants";
import type { Point } from "../../utils/math";
import type { TraitId } from "../data/lieutenants";
import { temperOf, type CaptainData } from "../data/captains";
import type { NobleTrait } from "./nobility";
import { choosePrey, foeCenter, type BattleView, type ContactView, type PlanKind, type SquadView } from "./warMind";

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

/** Uma companhia na interface de batalha. */
export interface CompanyHud {
  id: string;
  /** Quem manda agora: o capitão ou o tenente que assumiu. */
  leader: string;
  captain: string;
  fallen: boolean;
  stance: CompanyStance;
  plan: string | null;
  battalionIds: string[];
}

/** O que cada batalhão da companhia faz no plano escolhido. `foe` é o índice em `foes`. */
export type CompanyIntent = { kind: "ATTACK"; foe: number } | { kind: "HOLD" } | { kind: "FALL_BACK" };

export interface CompanySquad {
  role: SquadView["role"];
  center: Point;
}

function nearestFoe(foes: readonly ContactView[], from: Point): number {
  let best = -1;
  let bestD = Infinity;
  foes.forEach((f, i) => {
    const d = Math.hypot(f.x - from.x, f.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * O plano vira uma tarefa para cada batalhão, com as mesmas ideias dos planos inimigos:
 * - ataque: cada um no inimigo mais perto (a cavalaria escolhe a presa);
 * - linha e flanco: o primeiro corpo a corpo segura a frente e os outros entram pelas pontas;
 * - golpe na retaguarda: a cavalaria (ou o segundo corpo a corpo) vai nos arqueiros e carroças;
 * - resistir: todos seguram o lugar e deixam o inimigo vir;
 * - retirada: todos recuam (para junto do Comandante, ou para o ponto que a companhia guarda).
 */
export function companyIntents(plan: PlanKind, squads: readonly CompanySquad[], foes: readonly ContactView[], tactics: number): CompanyIntent[] {
  if (plan === "RETREAT") return squads.map(() => ({ kind: "FALL_BACK" }));
  if (plan === "HOLD" || foes.length === 0) return squads.map(() => ({ kind: "HOLD" }));
  const prey = (from: Point): number => {
    const p = choosePrey(foes, from, tactics);
    return p ? foes.indexOf(p) : nearestFoe(foes, from);
  };
  const intents: CompanyIntent[] = squads.map((s) => ({ kind: "ATTACK", foe: s.role === "RIDERS" ? prey(s.center) : nearestFoe(foes, s.center) }));
  const melee = squads.map((s, i) => ({ s, i })).filter(({ s }) => s.role === "MELEE");
  const foe = foeCenter(foes);
  if (plan === "FLANK" && foe && melee.length >= 2) {
    // Quem está mais perto do inimigo segura a frente; os outros entram pelas pontas, um de cada lado
    const own = { x: squads.reduce((n, s) => n + s.center.x, 0) / squads.length, y: squads.reduce((n, s) => n + s.center.y, 0) / squads.length };
    const dir = Math.atan2(foe.y - own.y, foe.x - own.x);
    const side = (f: ContactView) => -(f.x - foe.x) * Math.sin(dir) + (f.y - foe.y) * Math.cos(dir);
    const byDistance = [...melee].sort((a, b) => Math.hypot(a.s.center.x - foe.x, a.s.center.y - foe.y) - Math.hypot(b.s.center.x - foe.x, b.s.center.y - foe.y));
    byDistance.slice(1).forEach(({ i }, k) => {
      const sign = k % 2 === 0 ? 1 : -1;
      let best = -1;
      let bestSide = -Infinity;
      foes.forEach((f, j) => {
        if (f.kind === "SCOUT" || f.kind === "COURIER") return;
        const v = side(f) * sign;
        if (v > bestSide) {
          bestSide = v;
          best = j;
        }
      });
      if (best >= 0) intents[i] = { kind: "ATTACK", foe: best };
    });
  }
  if (plan === "REAR_STRIKE") {
    // Sem cavalaria, o segundo corpo a corpo dá a volta
    const striker = squads.findIndex((s) => s.role === "RIDERS");
    const who = striker >= 0 ? striker : (melee[1]?.i ?? -1);
    if (who >= 0) intents[who] = { kind: "ATTACK", foe: prey(squads[who].center) };
  }
  return intents;
}

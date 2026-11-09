import { newId } from "../../utils/id";
import { TRAITS, type LieutenantData, type TraitId } from "./lieutenants";

/**
 * Capitães (Marco 20): quem comanda uma companhia de batalhões abaixo do Comandante. Cada
 * batalhão continua com o seu tenente; o capitão conduz o grupo, recebe as missões delegadas
 * e, na batalha, distribui as ordens do Comandante e age sozinho quando elas não chegam.
 */

/** De onde ele veio: tenente promovido, nobre sem terra, mercenário famoso ou inimigo que mudou de lado. */
export type CaptainOrigin = "PROMOTED" | "NOBLE" | "TAVERN" | "CAPTURED";

/** Como ele luta por conta própria (sai dos traços). */
export type Temper = "AGGRESSIVE" | "STEADY" | "PATIENT";

export interface CaptainData {
  id: string;
  name: string;
  epithet: string;
  backstory: string;
  origin: CaptainOrigin;
  traits: TraitId[];
  /**
   * De 1 a 5:
   * - comando: quantos batalhões ele conduz bem e quanto a moral deles aguenta perto dele;
   * - tática: como ele luta sozinho (escolha de alvo, arranjo da companhia, missões);
   * - duelo: a mão dele numa luta de um contra um (Marco 21);
   * - ambição: quanto ele quer mais (risco de levar a companhia embora).
   */
  command: number;
  tactics: number;
  duel: number;
  ambition: number;
  /** 0–100: abaixo de CAPTAINS.LOYALTY_DESERT_AT ele vai embora. */
  loyalty: number;
  hireCost: number;
  /** Salário semanal. */
  wage: number;
  /** A companhia, na ordem: o primeiro é a guarda dele (ele marcha com esse batalhão). */
  battalionIds: string[];
  kills: number;
  battles: number;
  /** Crônica pessoal (mais recente por último). */
  history: string[];
}

export const ORIGIN_LABEL: Record<CaptainOrigin, string> = {
  PROMOTED: "tenente promovido",
  NOBLE: "nobre sem terra",
  TAVERN: "mercenário famoso",
  CAPTURED: "inimigo que mudou de lado",
};

export const TEMPER_LABEL: Record<Temper, string> = {
  AGGRESSIVE: "agressivo: ataca o que vê",
  STEADY: "firme: luta quando chegam perto",
  PATIENT: "paciente: segura e espera o erro",
};

const NAMES = ["Aurelio", "Brunhild", "Casimir", "Dorotea", "Edmund", "Frida", "Gaspard", "Hilde", "Isidro", "Jorunn", "Konrad", "Lucrécia", "Matthias", "Nerea", "Osric", "Petra"];
/** Os nomes de mulher da lista (o retrato precisa saber). */
export const CAPTAIN_WOMEN: ReadonlySet<string> = new Set(["Brunhild", "Dorotea", "Frida", "Hilde", "Jorunn", "Lucrécia", "Nerea", "Petra"]);
const EPITHETS = ["o Velho", "Duas-Espadas", "Mão-Firme", "o Calado", "Barba-Ruiva", "Cem-Batalhas", "o Lento", "Olho-Vivo", "Ferro-Frio", "Coração-de-Pedra", "a Serpente", "Quebra-Escudos"];
const NOBLE_PAST = [
  "Filho mais novo de uma casa sem terras, aprendeu a guerra nas campanhas do pai",
  "Perdeu o feudo num processo na corte e quer outro pela espada",
  "Comandou a guarda de um conde até a família cair em desgraça",
];
const TAVERN_PAST = [
  "Conhecido nas tavernas de três reinos: dizem que nunca perdeu uma ponte",
  "Liderou uma companhia livre até o patrão não pagar",
  "Venceu um cerco com metade dos homens e cobra caro por isso",
  "Serviu a cinco senhores e traiu dois; os outros três morreram ricos",
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const roll = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const clampStat = (v: number) => Math.max(1, Math.min(5, Math.round(v)));

export const captainName = (c: Pick<CaptainData, "name" | "epithet">) => `${c.name} ${c.epithet}`;

/** Quantos batalhões ele conduz: 2 com comando 1–2, 3 com 3–4, 4 com 5. */
export function companyLimit(c: Pick<CaptainData, "command">): number {
  return Math.max(2, Math.min(4, 2 + Math.floor((c.command - 1) / 2)));
}

/** O temperamento pelos traços: o primeiro traço que diz algo vence. */
export function temperOf(c: Pick<CaptainData, "traits">): Temper {
  for (const t of c.traits) {
    if (t === "BRAVE" || t === "BLOODTHIRSTY") return "AGGRESSIVE";
    if (t === "CAUTIOUS") return "PATIENT";
  }
  return "STEADY";
}

/** Capitão de fora do bando: nobre (corte) ou mercenário famoso (taverna). Os famosos sabem mais e custam mais. */
export function generateCaptain(day: number, origin: "NOBLE" | "TAVERN"): CaptainData {
  const traits = [...(Object.keys(TRAITS) as TraitId[])].sort(() => Math.random() - 0.5).slice(0, 2);
  const noble = origin === "NOBLE";
  const command = roll(noble ? 2 : 1, noble ? 4 : 5);
  const tactics = roll(noble ? 1 : 2, noble ? 4 : 5);
  const duel = roll(1, noble ? 4 : 5);
  const ambition = clampStat(roll(1, 4) + (traits.includes("AMBITIOUS") ? 2 : 0) + (noble ? 1 : 0));
  const skill = command + tactics + duel;
  return {
    id: newId(),
    name: pick(NAMES),
    epithet: pick(EPITHETS),
    backstory: `${pick(noble ? NOBLE_PAST : TAVERN_PAST)}.`,
    origin,
    traits,
    command,
    tactics,
    duel,
    ambition,
    loyalty: traits.includes("LOYAL") ? 65 : noble ? 50 : 45,
    hireCost: 120 + skill * 25,
    wage: 14 + skill * 2,
    battalionIds: [],
    kills: 0,
    battles: 0,
    history: [`Dia ${day}: ${noble ? "ofereceu a espada ao bando" : "chegou ao acampamento atrás de trabalho"}.`],
  };
}

/** Por que este tenente ainda não pode ser promovido (null = pode). */
export function promotionBlock(l: Pick<LieutenantData, "kills" | "battalionId">, battalionLevel: number | null): string | null {
  if (battalionLevel === null || l.battalionId === null) return "Precisa comandar um batalhão.";
  if (battalionLevel < 3 && l.kills < 15) return "Precisa de um batalhão de nível 3 ou de 15 abates.";
  return null;
}

/**
 * Tenente vira capitão: leva a história, os traços e a lealdade, e o batalhão dele vira a guarda
 * da companhia. Os números saem do que ele já fez e da passiva que tinha.
 */
export function promoteLieutenant(l: LieutenantData, battalionLevel: number, day: number): CaptainData {
  const p = l.passive;
  return {
    id: l.id,
    name: l.name,
    epithet: `"${l.epithet}"`,
    backstory: l.backstory,
    origin: "PROMOTED",
    traits: [...l.traits],
    command: clampStat(2 + (battalionLevel >= 4 ? 1 : 0) + (p === "INSPIRING" || p === "STALWART" ? 1 : 0)),
    tactics: clampStat(2 + (p === "TACTICIAN" ? 2 : p === "DRILLMASTER" || p === "MARKSMAN" ? 1 : 0)),
    duel: clampStat(2 + Math.floor(l.kills / 20) + (p === "BERSERKER" ? 1 : 0)),
    ambition: clampStat(l.traits.includes("AMBITIOUS") ? 4 : 2),
    loyalty: Math.min(100, l.loyalty + 10),
    hireCost: 0,
    wage: Math.round(l.wage * 1.8),
    battalionIds: l.battalionId ? [l.battalionId] : [],
    kills: l.kills,
    battles: 0,
    history: [...l.history, `Dia ${day}: promovido a capitão.`],
  };
}

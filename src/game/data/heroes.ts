import { newId } from "../../utils/id";
import type { EnemyKind } from "../../utils/constants";
import type { DuelTemper, DuelWeapon } from "../sim/duel";
import type { NobleTrait } from "../sim/nobility";
import type { CaptainData } from "./captains";
import type { TraitId } from "./lieutenants";

/**
 * Heróis do outro lado (Marco 21): os capitães e chefes das forças inimigas têm nome, mão no um
 * contra um e um jeito de lutar. Os que procuram briga vão atrás do Comandante para um duelo.
 */

/** Ficha de herói de um oficial inimigo. Vai no save junto com o comando do bando. */
export interface HeroData {
  /** Mão no um contra um, de 1 a 5 (a mesma escala do Duelo dos capitães do bando). */
  duel: number;
  /** O traço que diz como ele luta (null = nenhum que importe). */
  trait: NobleTrait | null;
  weapon: DuelWeapon;
}

/** A arma de cada oficial: o orc no machado, o sargento no escudo, o chefe goblin na lança. */
const WEAPON_OF: Partial<Record<EnemyKind, DuelWeapon>> = {
  GOBLIN_CHIEF: "SPEAR",
  GOBLIN_CAPTAIN: "SWORD",
  BANDIT_CHIEF: "AXE",
  BANDIT_CAPTAIN: "SWORD",
  SERGEANT: "SHIELD",
  CAPTAIN: "SHIELD",
  LORD: "SWORD",
  ORC_CHIEF: "AXE",
  ORC_CAPTAIN: "AXE",
  DEATH_KNIGHT: "SWORD",
  ORC_WARLORD: "AXE",
};

/** Quem já nasce melhor de mão: orcs e cavaleiros mortos. */
const HARDY: ReadonlySet<EnemyKind> = new Set(["ORC_CHIEF", "ORC_CAPTAIN", "DEATH_KNIGHT"]);

/** Chefes de calamidade que lutam de perto: sempre procuram o Comandante. */
export const BOSS_HEROES: Partial<Record<EnemyKind, HeroData>> = {
  ORC_WARLORD: { duel: 5, trait: "CRUEL", weapon: "AXE" },
};

const roll = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1));
const clampDuel = (v: number) => Math.max(1, Math.min(5, Math.round(v)));

/**
 * Ficha de um oficial novo. `base`: 1 goblins e camponeses, 2 salteadores e hordas, 3 patrulhas e
 * exércitos. Um nobre de verdade traz a própria mão (`martial`, de 1 a 10).
 */
export function rollHero(kind: EnemyKind, base: number, trait: NobleTrait | null, chief: boolean, martial?: number, random: () => number = Math.random): HeroData {
  const duel = martial !== undefined ? clampDuel(martial / 2) : clampDuel(roll(base, base + 1, random) + (chief ? 0 : -1) + (HARDY.has(kind) ? 1 : 0));
  return { duel, trait, weapon: WEAPON_OF[kind] ?? "SWORD" };
}

/** O jeito de lutar pelo traço: bravo e cruel emendam, o astuto finge, o covarde e o estudioso esperam. */
export function heroTemper(h: Pick<HeroData, "trait">): DuelTemper {
  switch (h.trait) {
    case "BRAVE":
    case "CRUEL":
    case "AMBITIOUS":
      return "AGGRESSIVE";
    case "CUNNING":
    case "ENVIOUS":
      return "TREACHEROUS";
    case "COWARD":
    case "SCHOLAR":
      return "PATIENT";
    default:
      return "STEADY";
  }
}

/** Procura o Comandante para um duelo: mão de 3 ou mais e temperamento que procura briga (bravo, orgulhoso, cruel). */
export function seeksDuel(h: HeroData): boolean {
  return h.duel >= 3 && (h.trait === "BRAVE" || h.trait === "AMBITIOUS" || h.trait === "CRUEL");
}

/** A mão do duelo (1 a 5) na escala da IA do duelo (1 a 10). */
export const duelSkill = (duel: number): number => Math.max(1, Math.min(10, duel * 2));

export const WEAPON_WORD: Record<DuelWeapon, string> = {
  SWORD: "de espada",
  SPEAR: "de lança",
  AXE: "de machado",
  SHIELD: "de espada e escudo",
};

const TRAIT_WORD: Partial<Record<NobleTrait, string>> = {
  BRAVE: "bravo",
  CRUEL: "cruel",
  AMBITIOUS: "orgulhoso",
  CUNNING: "traiçoeiro",
  ENVIOUS: "traiçoeiro",
  COWARD: "cauteloso",
  SCHOLAR: "paciente",
  HONORABLE: "honrado",
  GREEDY: "ganancioso",
};

/** "Duelo 4, de machado, cruel": o que os batedores e o interrogatório contam dele. */
export function heroWords(h: HeroData): string {
  const trait = h.trait ? TRAIT_WORD[h.trait] : undefined;
  return [`Duelo ${h.duel}`, WEAPON_WORD[h.weapon], trait].filter(Boolean).join(", ");
}

// --- Quem muda de lado ---

/** Traço de nobre → traço de capitão do bando (o que não tem par fica de fora). */
const TRAIT_OF: Partial<Record<NobleTrait, TraitId>> = {
  BRAVE: "BRAVE",
  CRUEL: "BLOODTHIRSTY",
  GREEDY: "GREEDY",
  AMBITIOUS: "AMBITIOUS",
  HONORABLE: "HONORABLE",
  COWARD: "CAUTIOUS",
  SCHOLAR: "CAUTIOUS",
};

/**
 * Chance de um oficial capturado aceitar servir ao bando. A fama do bando convence; o honrado
 * prefere a corda; o ganancioso, o ambicioso e o covarde ouvem a oferta.
 */
export function joinChance(h: Pick<HeroData, "trait"> | undefined, fame: number): number {
  let p = 0.3 + Math.max(0, Math.min(100, fame)) / 250;
  const t = h?.trait;
  if (t === "HONORABLE" || t === "PIOUS") p -= 0.25;
  if (t === "GREEDY" || t === "AMBITIOUS" || t === "COWARD") p += 0.2;
  return Math.max(0.05, Math.min(0.9, p));
}

/** O oficial que mudou de lado vira capitão do bando: a mão que mostrou em campo, lealdade baixa no começo. */
export function captainFromCaptive(o: { name: string; hero?: HeroData }, day: number, random: () => number = Math.random): CaptainData {
  const [first, ...rest] = o.name.split(" ");
  const trait = o.hero?.trait ? TRAIT_OF[o.hero.trait] : undefined;
  const traits: TraitId[] = trait ? [trait] : [];
  const command = roll(1, 3, random);
  const tactics = roll(1, 4, random);
  const duel = o.hero?.duel ?? roll(1, 3, random);
  const skill = command + tactics + duel;
  return {
    id: newId(),
    name: first,
    epithet: rest.join(" ") || "o Vira-Casaca",
    backstory: "Lutou contra o bando e foi pego. Jurou servir a quem o venceu, e todos ainda o olham de lado.",
    origin: "CAPTURED",
    traits,
    command,
    tactics,
    duel,
    ambition: Math.max(1, Math.min(5, roll(1, 3, random) + (trait === "AMBITIOUS" ? 2 : 0))),
    loyalty: 30,
    hireCost: 0,
    wage: 12 + skill * 2,
    battalionIds: [],
    kills: 0,
    battles: 0,
    history: [`Dia ${day}: capturado pelo bando, jurou servir ao Comandante.`],
  };
}

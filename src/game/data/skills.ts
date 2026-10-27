import type { TroopType } from "../../utils/constants";

export type SkillId =
  | "REINFORCED_SHIELDS"
  | "IRON_DISCIPLINE"
  | "LIVING_WALL"
  | "COUNTERATTACK"
  | "EAGLE_EYE"
  | "RAPID_FIRE"
  | "PIERCING_ARROWS"
  | "SKIRMISHERS"
  | "GALLOP"
  | "CHARGE_LANCES"
  | "DEVASTATING_CHARGE"
  | "VETERAN_RIDERS";

/**
 * Modificadores que uma habilidade aplica ao batalhão (multiplicadores; 1 = sem efeito).
 * Somados por produto em `battalionMods` (src/utils/progression.ts).
 */
export interface SkillMods {
  hp?: number;
  damage?: number;
  range?: number;
  cooldown?: number;
  speed?: number;
  meleeTaken?: number;
  rangedTaken?: number;
  /** Multiplica toda perda de moral. */
  moraleLoss?: number;
  /** Soma ao multiplicador de investida da cavalaria. */
  chargeBonus?: number;
  /** Multiplica a distância de corrida necessária para a investida. */
  chargeDistance?: number;
  /** Multiplica o empurrão da investida. */
  knockback?: number;
}

export interface SkillDef {
  id: SkillId;
  troopType: TroopType;
  label: string;
  description: string;
  /** Habilidade exigida antes desta (ramo da árvore). */
  requires?: SkillId;
  mods: SkillMods;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  // Infantaria — ramo defensivo
  REINFORCED_SHIELDS: {
    id: "REINFORCED_SHIELDS",
    troopType: "INFANTRY",
    label: "Escudos Reforçados",
    description: "−15% de dano corpo a corpo recebido.",
    mods: { meleeTaken: 0.85 },
  },
  LIVING_WALL: {
    id: "LIVING_WALL",
    troopType: "INFANTRY",
    label: "Muralha Viva",
    description: "Parede de Escudos protege num arco maior (inclui flancos) e anda mais rápido.",
    requires: "REINFORCED_SHIELDS",
    mods: {},
  },
  // Infantaria — ramo de moral/ataque
  IRON_DISCIPLINE: {
    id: "IRON_DISCIPLINE",
    troopType: "INFANTRY",
    label: "Disciplina de Ferro",
    description: "−30% de perda de moral.",
    mods: { moraleLoss: 0.7 },
  },
  COUNTERATTACK: {
    id: "COUNTERATTACK",
    troopType: "INFANTRY",
    label: "Contra-ataque",
    description: "+20% de dano.",
    requires: "IRON_DISCIPLINE",
    mods: { damage: 1.2 },
  },

  // Arqueiros — ramo de precisão
  EAGLE_EYE: {
    id: "EAGLE_EYE",
    troopType: "ARCHERS",
    label: "Olho de Águia",
    description: "+20% de alcance.",
    mods: { range: 1.2 },
  },
  PIERCING_ARROWS: {
    id: "PIERCING_ARROWS",
    troopType: "ARCHERS",
    label: "Flechas Perfurantes",
    description: "+25% de dano.",
    requires: "EAGLE_EYE",
    mods: { damage: 1.25 },
  },
  // Arqueiros — ramo de mobilidade
  RAPID_FIRE: {
    id: "RAPID_FIRE",
    troopType: "ARCHERS",
    label: "Tiro Rápido",
    description: "Atiram 20% mais rápido.",
    mods: { cooldown: 0.8 },
  },
  SKIRMISHERS: {
    id: "SKIRMISHERS",
    troopType: "ARCHERS",
    label: "Escaramuçadores",
    description: "+15% de velocidade e −20% de dano corpo a corpo recebido.",
    requires: "RAPID_FIRE",
    mods: { speed: 1.15, meleeTaken: 0.8 },
  },

  // Cavalaria — ramo de choque
  CHARGE_LANCES: {
    id: "CHARGE_LANCES",
    troopType: "CAVALRY",
    label: "Lanças de Carga",
    description: "Investida causa +0,75x de dano.",
    mods: { chargeBonus: 0.75 },
  },
  DEVASTATING_CHARGE: {
    id: "DEVASTATING_CHARGE",
    troopType: "CAVALRY",
    label: "Investida Devastadora",
    description: "Investida precisa de 40% menos corrida e empurra o dobro.",
    requires: "CHARGE_LANCES",
    mods: { chargeDistance: 0.6, knockback: 2 },
  },
  // Cavalaria — ramo de resistência
  GALLOP: {
    id: "GALLOP",
    troopType: "CAVALRY",
    label: "Galope",
    description: "+10% de velocidade.",
    mods: { speed: 1.1 },
  },
  VETERAN_RIDERS: {
    id: "VETERAN_RIDERS",
    troopType: "CAVALRY",
    label: "Cavaleiros Veteranos",
    description: "+20% de vida.",
    requires: "GALLOP",
    mods: { hp: 1.2 },
  },
};

/** Árvore de cada tropa: dois ramos de [base, avançada]. */
export const SKILL_TREE: Record<TroopType, [SkillId, SkillId][]> = {
  INFANTRY: [
    ["REINFORCED_SHIELDS", "LIVING_WALL"],
    ["IRON_DISCIPLINE", "COUNTERATTACK"],
  ],
  ARCHERS: [
    ["EAGLE_EYE", "PIERCING_ARROWS"],
    ["RAPID_FIRE", "SKIRMISHERS"],
  ],
  CAVALRY: [
    ["CHARGE_LANCES", "DEVASTATING_CHARGE"],
    ["GALLOP", "VETERAN_RIDERS"],
  ],
};

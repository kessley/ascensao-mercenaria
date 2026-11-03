import type { TroopFamily } from "../../utils/constants";

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
  | "VETERAN_RIDERS"
  | "CLOSE_RANKS"
  | "FLANKERS"
  | "LAST_STAND"
  | "SHOCK_TROOPS"
  | "TIGHT_VOLLEY"
  | "MARCHING_FIRE"
  | "FEAR_ARROWS"
  | "DEEP_QUIVER"
  | "BREAK_THROUGH"
  | "QUICK_TURN"
  | "TERROR"
  | "RUN_DOWN";

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
  /** Multiplica o quanto as fileiras de trás seguram a moral. */
  rankSupport?: number;
  /** Dano em quem é pego de lado ou por trás. */
  flankDamage?: number;
  /** Só entra em pânico abaixo disto. */
  panicBelow?: number;
  /** Cada golpe corpo a corpo abala a tropa de quem apanha. */
  meleeShock?: number;
  /** Multiplica o espalhamento da salva. */
  spread?: number;
  /** Multiplica a munição. */
  ammo?: number;
  /** Multiplica o abalo de cada flecha. */
  arrowShock?: number;
  /** Atira sem parar de andar. */
  moveFire?: boolean;
  /** Multiplica o tempo atravessando a linha depois da investida. */
  breakThrough?: number;
  /** Multiplica o tempo no choque antes de sair, na investida em ciclo. */
  cycleHit?: number;
  /** Multiplica o abalo da investida. */
  chargeShock?: number;
  /** Dano em quem foge ou atira. */
  huntDamage?: number;
}

export interface SkillDef {
  id: SkillId;
  troopType: TroopFamily;
  label: string;
  description: string;
  mods: SkillMods;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  CLOSE_RANKS: { id: "CLOSE_RANKS", troopType: "INFANTRY", label: "Fileiras Cerradas", description: "As fileiras de trás seguram a moral duas vezes mais. Forme fundo.", mods: { rankSupport: 2 } },
  FLANKERS: { id: "FLANKERS", troopType: "INFANTRY", label: "Caçadores de Flanco", description: "+30% de dano em quem é pego de lado ou por trás.", mods: { flankDamage: 1.3 } },
  LAST_STAND: { id: "LAST_STAND", troopType: "INFANTRY", label: "Último Reduto", description: "Só entra em pânico com a moral abaixo de 10.", mods: { panicBelow: 10 } },
  SHOCK_TROOPS: { id: "SHOCK_TROOPS", troopType: "INFANTRY", label: "Tropa de Choque", description: "Cada golpe abala a tropa de quem apanha: o inimigo quebra mais cedo.", mods: { meleeShock: 0.8 } },
  TIGHT_VOLLEY: { id: "TIGHT_VOLLEY", troopType: "ARCHERS", label: "Salva Cerrada", description: "As flechas caem 35% mais juntas: acerta mais, e mais perto dos seus.", mods: { spread: 0.65 } },
  MARCHING_FIRE: { id: "MARCHING_FIRE", troopType: "ARCHERS", label: "Tiro em Marcha", description: "Atira enquanto anda, sem parar para formar.", mods: { moveFire: true } },
  FEAR_ARROWS: { id: "FEAR_ARROWS", troopType: "ARCHERS", label: "Flechas de Medo", description: "Cada flecha abala a moral três vezes mais.", mods: { arrowShock: 3 } },
  DEEP_QUIVER: { id: "DEEP_QUIVER", troopType: "ARCHERS", label: "Aljavas Fundas", description: "+60% de munição.", mods: { ammo: 1.6 } },
  BREAK_THROUGH: { id: "BREAK_THROUGH", troopType: "CAVALRY", label: "Atravessar a Linha", description: "Depois do choque, segue em frente pelo dobro do tempo.", mods: { breakThrough: 2 } },
  QUICK_TURN: { id: "QUICK_TURN", troopType: "CAVALRY", label: "Meia-Volta", description: "Na investida em ciclo, sai do choque na metade do tempo.", mods: { cycleHit: 0.5 } },
  TERROR: { id: "TERROR", troopType: "CAVALRY", label: "Terror", description: "A investida abala a moral 2,5 vezes mais.", mods: { chargeShock: 2.5 } },
  RUN_DOWN: { id: "RUN_DOWN", troopType: "CAVALRY", label: "Caçar Fugitivos", description: "+50% de dano em quem foge e em quem atira.", mods: { huntDamage: 1.5 } },
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
    mods: { hp: 1.2 },
  },
};

/**
 * Cada nível traz uma escolha entre duas habilidades, e a outra se perde: dois batalhões veteranos
 * da mesma tropa podem lutar de jeitos bem diferentes. A linha k pede o nível k + 2.
 */
export const SKILL_TREE: Record<TroopFamily, [SkillId, SkillId][]> = {
  INFANTRY: [
    ["REINFORCED_SHIELDS", "IRON_DISCIPLINE"],
    ["LIVING_WALL", "COUNTERATTACK"],
    ["CLOSE_RANKS", "FLANKERS"],
    ["LAST_STAND", "SHOCK_TROOPS"],
  ],
  ARCHERS: [
    ["EAGLE_EYE", "RAPID_FIRE"],
    ["PIERCING_ARROWS", "SKIRMISHERS"],
    ["TIGHT_VOLLEY", "MARCHING_FIRE"],
    ["FEAR_ARROWS", "DEEP_QUIVER"],
  ],
  CAVALRY: [
    ["CHARGE_LANCES", "GALLOP"],
    ["DEVASTATING_CHARGE", "VETERAN_RIDERS"],
    ["BREAK_THROUGH", "QUICK_TURN"],
    ["TERROR", "RUN_DOWN"],
  ],
};

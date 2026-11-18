/**
 * A ficha de luta de quem tem nome (Marco 24, parte 5): o Comandante, os tenentes, os capitães e
 * os heróis inimigos. Três números de 1 a 10: Armas dá o ataque, Guarda dá a defesa, Vigor dá a
 * vida. A tropa sem nome continua com os números da tropa e o nível.
 */
export interface CombatSheet {
  arms: number;
  guard: number;
  vigor: number;
}

export const SHEET = {
  /** Ataque e defesa: base + por ponto (Armas 1 = 35, 5 = 55, 10 = 80). */
  SKILL_BASE: 30,
  SKILL_PER: 5,
  /** Vida: base + por ponto de Vigor (1 = 36, 5 = 60, 10 = 90). */
  HP_BASE: 30,
  HP_PER: 6,
} as const;

/** O Comandante que funda o bando: bom de mão, mas um homem só. */
export const COMMANDER_SHEET: CombatSheet = { arms: 9, guard: 8, vigor: 5 };
/** O tenente que se contrata: um veterano. */
export const LIEUTENANT_SHEET: CombatSheet = { arms: 6, guard: 6, vigor: 5 };

const point = (v: number) => Math.max(1, Math.min(10, Math.round(v)));

export function sheetStats(s: CombatSheet): { attack: number; defense: number; hp: number } {
  return {
    attack: SHEET.SKILL_BASE + SHEET.SKILL_PER * point(s.arms),
    defense: SHEET.SKILL_BASE + SHEET.SKILL_PER * point(s.guard),
    hp: SHEET.HP_BASE + SHEET.HP_PER * point(s.vigor),
  };
}

/** A mão no duelo (1 a 5, Marco 21) vira ficha: duelo 1 = 2/2/4, duelo 5 = 10/10/8. */
export function sheetFromDuel(duel: number): CombatSheet {
  const d = Math.max(1, Math.min(5, Math.round(duel)));
  return { arms: d * 2, guard: d * 2, vigor: 3 + d };
}

/** A habilidade de um nobre (`martial`, 1 a 10) vira ficha: a guarda um pouco abaixo da mão. */
export function sheetFromMartial(martial: number): CombatSheet {
  const m = point(martial);
  return { arms: m, guard: point(m - 1), vigor: point(4 + m / 2) };
}

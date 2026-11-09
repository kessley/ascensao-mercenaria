import { arcaneAfter, spellDef, type SpellId } from "../game/sim/magic";
import { MAGIC } from "../utils/constants";
import type { GameState } from "./useGameStore";

/**
 * A magia do Comandante (Marco 19): as magias que ele sabe e o arcano. Fica à parte do store
 * principal, como a corte, a guerra e o legado. O arcano vai para o save; o tempo de recarga de
 * cada magia é da batalha e fica na cena.
 */
export interface MagicState {
  /** As magias que o Comandante sabe. Começa sem nenhuma: a magia se aprende pelo mundo. */
  spells: SpellId[];
  /** O arcano de agora, de 0 a `MAGIC.ARCANE_MAX`. */
  arcane: number;
}

export interface MagicActions {
  /** Gasta o arcano de uma magia; false = não sabe ou não tem arcano. */
  spendArcane: (spell: SpellId) => boolean;
  /** O Comandante aprende uma magia. */
  learnSpell: (spell: SpellId) => void;
  /** O arcano volta com os dias (o relógio do mundo chama). */
  restoreArcane: (days: number) => void;
}

export const INITIAL_MAGIC: MagicState = { spells: [], arcane: 0 };

type Setter = (partial: Partial<GameState>) => void;

export function magicSlice(set: Setter, get: () => GameState): MagicActions {
  return {
    spendArcane: (spell) => {
      const s = get();
      const cost = spellDef(spell).cost;
      if (!s.spells.includes(spell) || s.arcane < cost) return false;
      set({ arcane: s.arcane - cost });
      return true;
    },
    learnSpell: (spell) => {
      const s = get();
      if (s.spells.includes(spell)) return;
      set({ spells: [...s.spells, spell] });
    },
    restoreArcane: (days) => {
      const s = get();
      if (s.spells.length === 0 || s.arcane >= MAGIC.ARCANE_MAX) return;
      set({ arcane: arcaneAfter(s.arcane, days) });
    },
  };
}

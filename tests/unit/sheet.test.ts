import { describe, expect, it } from "vitest";
import { COMMANDER_SHEET, SHEET, sheetFromDuel, sheetFromMartial, sheetStats } from "../../src/game/sim/sheet";
import { rollHero } from "../../src/game/data/heroes";

describe("a ficha de quem tem nome (Marco 24): Armas, Guarda e Vigor, de 1 a 10", () => {
  it("Armas dá o ataque, Guarda a defesa, Vigor a vida", () => {
    expect(sheetStats({ arms: 1, guard: 1, vigor: 1 })).toEqual({ attack: 35, defense: 35, hp: 36 });
    expect(sheetStats({ arms: 10, guard: 10, vigor: 10 })).toEqual({ attack: 80, defense: 80, hp: 90 });
    // Fora da escala, fica na beira
    expect(sheetStats({ arms: 14, guard: -2, vigor: 5 })).toEqual({ attack: 80, defense: 35, hp: SHEET.HP_BASE + SHEET.HP_PER * 5 });
  });

  it("o Comandante que funda o bando luta como antes (75 e 70), mas é um homem só", () => {
    const s = sheetStats(COMMANDER_SHEET);
    expect(s.attack).toBe(75);
    expect(s.defense).toBe(70);
    expect(s.hp).toBeLessThan(80);
  });

  it("o duelo dos capitães e a mão dos nobres viram ficha", () => {
    expect(sheetFromDuel(1)).toEqual({ arms: 2, guard: 2, vigor: 4 });
    expect(sheetFromDuel(5)).toEqual({ arms: 10, guard: 10, vigor: 8 });
    expect(sheetStats(sheetFromDuel(5)).attack).toBeGreaterThan(sheetStats(sheetFromDuel(3)).attack);
    expect(sheetFromMartial(8)).toEqual({ arms: 8, guard: 7, vigor: 8 });
  });

  it("o herói inimigo nasce com a ficha (do nobre, se ele tiver mão; senão, do duelo)", () => {
    expect(rollHero("SOLDIER", 3, null, true, 8).sheet).toEqual(sheetFromMartial(8));
    const h = rollHero("GOBLIN_CHIEF", 1, null, true, undefined, () => 0.5);
    expect(h.sheet).toEqual(sheetFromDuel(h.duel));
  });
});

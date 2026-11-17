import { describe, expect, it } from "vitest";
import { reliefPairs, type LineSpot } from "../../src/game/sim/relief";
import { fatigueDefense } from "../../src/game/sim/combatRules";
import { FATIGUE } from "../../src/utils/constants";

/** A frente olha para o leste (facing 0): "atrás" é a oeste. */
const spot = (id: string, x: number, fighting: boolean, o: Partial<LineSpot> = {}): LineSpot => ({ id, x, y: 0, facing: 0, fighting, free: true, ...o });

describe("fôlego (Marco 24): o cansaço tira defesa", () => {
  it("nada muda até 40; com 100, 30% a menos", () => {
    expect(fatigueDefense(0)).toBe(1);
    expect(fatigueDefense(FATIGUE.DEFENSE_FROM)).toBe(1);
    expect(fatigueDefense(70)).toBeCloseTo(0.85);
    expect(fatigueDefense(100)).toBeCloseTo(1 - FATIGUE.MAX_DEFENSE_LOSS);
    expect(fatigueDefense(150)).toBeCloseTo(1 - FATIGUE.MAX_DEFENSE_LOSS);
  });

  it("uma linha fica sem fôlego em cerca de 2 minutos de luta, e o recupera em pouco mais de 1", () => {
    const toWinded = 70 / FATIGUE.WINDED_PER_SEC;
    expect(toWinded).toBeGreaterThan(100);
    expect(toWinded).toBeLessThan(140);
    expect(70 / FATIGUE.BREATHE_PER_SEC).toBeLessThan(75);
  });
});

describe("revezar (Marco 24): quem luta troca com o descansado logo atrás", () => {
  it("o da frente acha o de trás, e o de trás acha o da frente", () => {
    const all = [spot("front", 0, true), spot("rear", -120, false)];
    expect(reliefPairs([all[0]], all)).toEqual([["front", "rear"]]);
    expect(reliefPairs([all[1]], all)).toEqual([["front", "rear"]]);
  });

  it("ninguém à frente de quem luta serve, nem quem está longe, em pânico ou lutando também", () => {
    expect(reliefPairs([spot("a", 0, true)], [spot("a", 0, true), spot("ahead", 120, false)])).toEqual([]);
    expect(reliefPairs([spot("a", 0, true)], [spot("a", 0, true), spot("far", -FATIGUE.RELIEF_RANGE - 50, false)])).toEqual([]);
    expect(reliefPairs([spot("a", 0, true)], [spot("a", 0, true), spot("scared", -120, false, { free: false })])).toEqual([]);
    expect(reliefPairs([spot("a", 0, true)], [spot("a", 0, true), spot("busy", -120, true)])).toEqual([]);
  });

  it("cada um entra num par só, e o mais perto vem primeiro", () => {
    const all = [spot("a", 0, true, { y: 0 }), spot("b", 0, true, { y: 200 }), spot("near", -100, false, { y: 0 }), spot("other", -100, false, { y: 200 })];
    const pairs = reliefPairs(all, all);
    expect(pairs).toContainEqual(["a", "near"]);
    expect(pairs).toContainEqual(["b", "other"]);
    expect(pairs).toHaveLength(2);
  });
});

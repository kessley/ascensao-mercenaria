import { describe, expect, it } from "vitest";
import { formationOffset, formationSize, frontOf } from "../../src/game/systems/formation";
import { planLine } from "../../src/game/systems/GroupLayout";
import type { Battalion } from "../../src/game/entities/Battalion";
import { TROOPS, type TroopType } from "../../src/utils/constants";

/** Só o que a linha de batalha lê de um batalhão. */
const battalion = (troopType: TroopType, count = 8, x = 0, y = 0): Battalion =>
  ({ troopType, formation: TROOPS[troopType].formations[0], soldiers: Array.from({ length: count }), center: { x, y } }) as unknown as Battalion;

describe("formação", () => {
  it("largura escolhida decide as fileiras", () => {
    const ranksOf = (w: number) => new Set(Array.from({ length: 8 }, (_, i) => formationOffset("LINE", i, 8, w).depth)).size;
    expect(ranksOf(8)).toBe(1);
    expect(ranksOf(4)).toBe(2);
    expect(ranksOf(2)).toBe(4);
  });

  it("não há dois soldados no mesmo lugar", () => {
    for (const f of ["LINE", "SHIELD_WALL", "WEDGE", "LOOSE"] as const) {
      const seen = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(formationOffset(f, i, 12))));
      expect(seen.size, f).toBe(12);
    }
  });

  it("última fileira incompleta fica centrada", () => {
    const last = formationOffset("LINE", 4, 5, 4);
    expect(last.lateral).toBe(0);
  });

  it("largura nunca passa do efetivo", () => {
    expect(frontOf("LINE", 3, 8)).toBe(3);
    expect(frontOf("LINE", 8, 0)).toBe(1);
  });

  it("linha fina é larga e rasa; funda, o contrário", () => {
    const thin = formationSize("LINE", 8, 8);
    const deep = formationSize("LINE", 8, 2);
    expect(thin.width).toBeGreaterThan(deep.width);
    expect(thin.depth).toBeLessThan(deep.depth);
  });
});

describe("linha riscada com o mouse", () => {
  const facingUp = -Math.PI / 2;

  it("da esquerda para a direita, a frente olha para cima", () => {
    const [p] = planLine([battalion("INFANTRY")], { x: 0, y: 0 }, { x: 300, y: 0 }, "ARCHERS_BACK");
    expect(p.facing).toBeCloseTo(facingUp);
  });

  it("de cima para baixo, a frente olha para a direita", () => {
    const [p] = planLine([battalion("INFANTRY")], { x: 0, y: 0 }, { x: 0, y: 300 }, "ARCHERS_BACK");
    expect(p.facing).toBeCloseTo(0);
  });

  it("risco longo afina e risco curto engrossa", () => {
    const long = planLine([battalion("INFANTRY")], { x: 0, y: 0 }, { x: 400, y: 0 }, "ARCHERS_BACK")[0];
    const short = planLine([battalion("INFANTRY")], { x: 0, y: 0 }, { x: 60, y: 0 }, "ARCHERS_BACK")[0];
    expect(long.width).toBe(8);
    expect(short.width).toBeLessThan(4);
  });

  it("batalhões se dividem sem se sobrepor", () => {
    const plans = planLine([battalion("INFANTRY", 8, 0), battalion("SPEARMEN", 8, 100)], { x: 0, y: 0 }, { x: 500, y: 0 }, "ARCHERS_BACK");
    const [a, b] = [...plans].sort((p, q) => p.point.x - q.point.x);
    const half = (p: (typeof plans)[number]) => formationSize(p.battalion.formation, 8, p.width).width / 2;
    expect(b.point.x - half(b)).toBeGreaterThanOrEqual(a.point.x + half(a));
  });

  it("arqueiros e besteiros vão na fileira de trás", () => {
    const plans = planLine([battalion("INFANTRY"), battalion("CROSSBOW"), battalion("JAVELINS")], { x: 0, y: 0 }, { x: 300, y: 0 }, "ARCHERS_BACK");
    const front = plans.find((p) => p.battalion.troopType === "INFANTRY");
    const back = plans.filter((p) => p.battalion.troopType !== "INFANTRY");
    for (const p of back) {
      expect(p.row).toBe(1);
      // Frente para cima: atrás é y maior
      expect(p.point.y).toBeGreaterThan(front?.point.y ?? 0);
    }
  });

  it("cavalaria pesada conta como cavalaria nos flancos", () => {
    const plans = planLine([battalion("INFANTRY", 8, 100), battalion("KNIGHTS", 8, 0), battalion("CAVALRY", 8, 200)], { x: 0, y: 0 }, { x: 600, y: 0 }, "CAVALRY_FLANKS");
    const xs = [...plans].sort((a, b) => a.point.x - b.point.x).map((p) => TROOPS[p.battalion.troopType].family);
    expect(xs).toEqual(["CAVALRY", "INFANTRY", "CAVALRY"]);
  });
});

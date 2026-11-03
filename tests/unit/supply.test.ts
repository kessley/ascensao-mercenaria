import { describe, expect, it } from "vitest";
import { convoyDays, convoyFate, convoyRisk, eatDay, fillPacks, packCapacity, takeFieldFood } from "../../src/game/sim/logistics";
import type { BattalionData } from "../../src/store/useGameStore";
import { ECONOMY, SUPPLY, WORLD } from "../../src/utils/constants";

const battalion = (id: string, soldiers = 9, pack?: number): BattalionData => ({ id, name: id, troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers, maxSoldiers: soldiers, pack });
const none = new Set<string>();

describe("mochilas (rações refeitas)", () => {
  it("cada batalhão leva PACK_DAYS dias da própria comida", () => {
    expect(packCapacity(battalion("a", 9))).toBe(Math.ceil((9 / ECONOMY.SOLDIERS_PER_RATION) * SUPPLY.PACK_DAYS));
  });

  it("encher as mochilas tira do estoque e começa por quem tem menos", () => {
    const cap = packCapacity(battalion("a"));
    const r = fillPacks([battalion("a", 9, cap), battalion("b", 9, 0)], 5);
    expect(r.used).toBe(5);
    expect(r.battalions[0].pack).toBe(cap);
    expect(r.battalions[1].pack).toBe(5);
  });

  it("em campo, cada um come da própria mochila; sem comida, quem ficou sem passa fome", () => {
    const meal = eatDay(100, 0, [battalion("a", 9, 10), battalion("b", 9, 0)], [], none, true, false);
    expect(meal.battalions[0].pack).toBeLessThan(10);
    expect(meal.starving).toEqual(["b"]);
    expect(meal.hungry).toBe(true);
    // O depósito ficou no acampamento: ninguém come dele em campo
    expect(meal.rations).toBe(100);
  });

  it("as carroças com o exército cobrem quem esvaziou a mochila", () => {
    const meal = eatDay(0, 20, [battalion("a", 9, 0)], [], none, true, false);
    expect(meal.starving).toEqual([]);
    expect(meal.cargo).toBeLessThan(20);
  });

  it("no acampamento, todos comem do depósito e a mochila enche sem tirar a reserva", () => {
    const meal = eatDay(200, 0, [battalion("a", 9, 0)], [], none, false, false);
    expect(meal.hungry).toBe(false);
    expect(meal.battalions[0].pack).toBe(packCapacity(battalion("a")));
    const poor = eatDay(5, 0, [battalion("a", 9, 0)], [], none, false, false);
    expect(poor.battalions[0].pack ?? 0).toBe(0);
  });

  it("presos e harpias comem primeiro da bolsa, depois das mochilas mais cheias", () => {
    const r = takeFieldFood([battalion("a", 9, 2), battalion("b", 9, 6)], 1, 4);
    expect(r.cargo).toBe(0);
    expect(r.battalions[1].pack).toBe(3);
    expect(r.short).toBe(0);
  });
});

describe("comboio de suprimentos", () => {
  it("leva mais tempo quanto mais longe está o exército", () => {
    expect(convoyDays(WORLD.DAY_DISTANCE * SUPPLY.CONVOY.SPEED * 2)).toBeCloseTo(2);
    expect(convoyDays(10)).toBe(SUPPLY.CONVOY.MIN_DAYS);
  });

  it("a escolta reduz a chance de emboscada", () => {
    expect(convoyRisk(2, 12)).toBeLessThan(convoyRisk(2, 0));
    expect(convoyRisk(4, 0)).toBeGreaterThan(convoyRisk(1, 0));
  });

  it("sem ataque, tudo chega; atacado sem escolta, perde carga; com escolta, a escolta paga", () => {
    const calm = convoyFate(100, 2, [], 1, () => 0.99);
    expect(calm).toMatchObject({ raided: false, load: 100, wagonsLost: 0 });
    const raided = convoyFate(100, 2, [], 3, () => 0);
    expect(raided.raided).toBe(true);
    expect(raided.load).toBeLessThan(100);
    const guarded = convoyFate(100, 2, [battalion("g", 10)], 3, () => 0);
    expect(guarded.raided).toBe(true);
    expect(guarded.load).toBeGreaterThan(raided.load);
    expect(guarded.escort[0].soldiers).toBeLessThanOrEqual(10);
  });
});

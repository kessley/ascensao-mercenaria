import { describe, expect, it } from "vitest";
import { newBuilding, startingPlan, type CampKind, type CampPlan } from "../../src/game/data/campGrid";
import { fortressPlan } from "../../src/game/sim/fortress";
import {
  CITY_MAX,
  STAGE,
  VETERAN_FAMILY,
  cityDrivers,
  dailyGrowth,
  feverWeek,
  growCity,
  houseShare,
  inRealm,
  newSeatCity,
  realmFigures,
  retire,
  retireProblem,
  stageCap,
  stageOf,
  weeklyGold,
  type DriverCtx,
  type SeatCity,
} from "../../src/game/sim/seatCity";

/** Marco 22, parte 4: a cidade que nasce sozinha (GDD 9.8). */
const fort = (kinds: [CampKind, number, number][] = []): CampPlan => {
  const base = startingPlan();
  const needs: [CampKind, number, number][] = [["KITCHEN", -12, -12], ["OFFICERS_TENT", 6, -12], ["WELL", -12, 6], ["TOWER", 8, 8]];
  return fortressPlan({ ...base, size: 28, buildings: [...base.buildings, ...[...needs, ...kinds].map(([k, x, y]) => newBuilding(k, x, y))] });
};
const ctx = (over: Partial<DriverCtx> = {}): DriverCtx => ({ plan: fort(), garrison: 60, militia: 0, rations: 200, fame: 50, decrees: [], ...over });

/** Corre `days` dias da cidade com as mesmas condições. */
const run = (city: SeatCity, c: DriverCtx, days: number) => {
  let out = city;
  for (let i = 0; i < days; i++) out = growCity(out, cityDrivers({ ...c, decrees: out.decrees, militia: out.militia }), c.plan);
  return out;
};

describe("as etapas da cidade", () => {
  it("arraial, burgo, vila e cidade pela gente que mora nela", () => {
    expect(stageOf(0)).toBe("CAMPTOWN");
    expect(stageOf(STAGE.BURG.from)).toBe("BURG");
    expect(stageOf(STAGE.TOWN.from + 1)).toBe("TOWN");
    expect(stageOf(CITY_MAX)).toBe("CITY");
    expect(inRealm("BURG")).toBe(false);
    expect(inRealm("TOWN")).toBe(true);
  });

  it("sem muralha de pedra, a vila não vira cidade", () => {
    const wood = fort();
    expect(stageCap(wood)).toBeLessThan(STAGE.CITY.from);
    expect(stageCap({ ...wood, wall: "STONE" })).toBe(CITY_MAX);
    const city = { ...newSeatCity(0, 10, 100), people: STAGE.CITY.from - 2 };
    const grown = run(city, ctx({ plan: wood }), 30);
    expect(stageOf(grown.people)).toBe("TOWN");
  });

  it("as casas aparecem aos poucos, até a cidade inteira", () => {
    expect(houseShare(0)).toBe(0);
    expect(houseShare(CITY_MAX / 2)).toBeCloseTo(0.5);
    expect(houseShare(CITY_MAX * 2)).toBe(1);
  });
});

describe("o crescimento", () => {
  it("o arraial do estandarte vira burgo em uns 45 dias, sem o jogador pôr casa nenhuma", () => {
    // O estandarte entre os dias 60 e 90; o burgo, depois do dia 120
    const start = newSeatCity(75, 4, 60);
    expect(stageOf(start.people)).toBe("CAMPTOWN");
    const c = ctx({ plan: fort([["QUARTERMASTER", -4, 4]]) });
    expect(stageOf(run(start, c, 20).people)).toBe("CAMPTOWN");
    expect(stageOf(run(start, c, 50).people)).toBe("BURG");
  });

  it("segurança, comida, comércio e fama fazem crescer", () => {
    const city = { ...newSeatCity(0, 4, 60), people: 100 };
    const poor = dailyGrowth(city, cityDrivers(ctx({ fame: 0, rations: 0 })));
    const rich = dailyGrowth(city, cityDrivers(ctx({ plan: { ...fort([["CASTLE_FAIR", -4, 4], ["STOREHOUSE", 2, 2]]), wall: "STONE" }, fame: 90 })));
    expect(rich).toBeGreaterThan(poor * 1.5);
  });

  it("sem segurança, a gente vai embora", () => {
    const city = { ...newSeatCity(0, 4, 60), people: 200 };
    const open: CampPlan = { ...fort(), wall: undefined, buildings: [] };
    expect(dailyGrowth(city, cityDrivers(ctx({ plan: open, garrison: 0 })))).toBeLessThan(0);
  });

  it("os refugiados enchem a cidade; impostos altos a seguram", () => {
    const city = { ...newSeatCity(0, 4, 60), people: 100 };
    const d = cityDrivers(ctx());
    const base = dailyGrowth(city, d);
    expect(dailyGrowth({ ...city, decrees: ["REFUGEES"] }, d)).toBeGreaterThan(base + 2);
    expect(dailyGrowth({ ...city, tax: 2 }, d)).toBeLessThan(base);
    expect(dailyGrowth({ ...city, tax: 0 }, d)).toBeGreaterThan(base);
  });
});

describe("a semana", () => {
  it("o arraial não paga imposto; o burgo paga, mais com impostos altos", () => {
    const d = cityDrivers(ctx());
    expect(weeklyGold({ ...newSeatCity(0, 4, 60), people: 50 }, d)).toBe(0);
    const burg = { ...newSeatCity(0, 4, 60), people: 200 };
    expect(weeklyGold(burg, d)).toBeGreaterThan(0);
    expect(weeklyGold({ ...burg, tax: 2 }, d)).toBeGreaterThan(weeklyGold(burg, d));
  });

  it("os decretos custam ouro", () => {
    const d = cityDrivers(ctx());
    const burg = { ...newSeatCity(0, 4, 60), people: 200 };
    expect(weeklyGold({ ...burg, decrees: ["ARTISANS", "FAIR"] }, d)).toBe(weeklyGold(burg, d) - 40);
  });

  it("a febre vem mais com os refugiados", () => {
    const city = { ...newSeatCity(0, 4, 60), people: 300 };
    expect(feverWeek(city, 0.1).lost).toBe(0);
    const sick = feverWeek({ ...city, decrees: ["REFUGEES"] }, 0.1);
    expect(sick.lost).toBe(24);
    expect(sick.city.people).toBe(276);
  });
});

describe("os veteranos", () => {
  it("se aposentam com o decreto, de batalhões velhos, e viram milícia com a família", () => {
    const city = { ...newSeatCity(0, 4, 60), people: 200 };
    expect(retireProblem(city, 4, 10, 3)).toMatch(/decreto/);
    const open = { ...city, decrees: ["VETERANS" as const] };
    expect(retireProblem(open, 1, 10, 3)).toMatch(/nível/);
    expect(retireProblem(open, 4, 3, 3)).toMatch(/ficar com alguém/);
    expect(retireProblem(open, 4, 10, 3)).toBeNull();
    const after = retire(open, 3);
    expect(after.militia).toBe(3);
    expect(after.people).toBe(200 + 3 * VETERAN_FAMILY);
    expect(realmFigures(after).garrison).toBeGreaterThan(realmFigures(city).garrison - 1);
  });

  it("a milícia conta na segurança", () => {
    const a = cityDrivers(ctx({ garrison: 0, militia: 0 }));
    const b = cityDrivers(ctx({ garrison: 0, militia: 120 }));
    expect(b.security).toBeGreaterThan(a.security);
  });
});

import { describe, expect, it } from "vitest";
import {
  CAMP_BUILDINGS,
  BUILD_ORDER,
  CARGO_PER_WAGON,
  buildProblem,
  doorCell,
  doorCells,
  freeSpot,
  gateLane,
  gateProblem,
  growProblem,
  grown,
  guardOf,
  legacyPlan,
  lieutenantSlots,
  needsOf,
  newBuilding,
  packPlan,
  placeProblem,
  planCargo,
  refundOf,
  startingPlan,
  troopProblem,
  volunteerRate,
  type CampPlan,
} from "../../src/game/data/campGrid";

/** Todas as construções da planta passam nas regras de encaixe (cada uma contra as outras). */
function valid(plan: CampPlan): string[] {
  const out: string[] = [];
  for (const b of plan.buildings) {
    const p = placeProblem(plan, b.kind, b.x, b.y, b.id);
    if (p) out.push(`${b.kind} (${b.x},${b.y}): ${p}`);
  }
  return out;
}

describe("a planta do acampamento na grade", () => {
  it("o começo é um bivaque de 10×10 com a tenda, a fogueira e uma barraca, tudo no lugar", () => {
    const plan = startingPlan();
    expect(plan.size).toBe(10);
    expect(plan.buildings.map((b) => b.kind).sort()).toEqual(["BARRACK", "CAMPFIRE", "COMMAND_TENT"]);
    expect(valid(plan)).toEqual([]);
    expect(doorCells(plan).size).toBe(3);
  });

  it("o acampamento de um save antigo vira peças válidas, com tudo o que já tinha", () => {
    for (const n of [1, 3, 6, 9]) {
      const plan = legacyPlan(n, ["PALISADE", "TOWERS", "DITCH"]);
      expect(plan.size).toBe(28);
      expect(plan.legacy).toBe(true);
      expect(plan.ditch).toBe(true);
      expect(valid(plan)).toEqual([]);
      expect(plan.buildings.filter((b) => b.kind === "BARRACK").length).toBe(Math.min(6, n));
      expect(plan.buildings.filter((b) => b.kind === "TOWER").length).toBe(3);
    }
    const bare = legacyPlan(2, []);
    expect(bare.ditch).toBe(false);
    expect(bare.buildings.some((b) => b.kind === "TOWER")).toBe(false);
    // Todas as tropas e as vagas de tenente de antes
    for (const t of ["KNIGHTS", "HORSE_ARCHERS", "CAVALRY", "HEAVY"] as const) expect(troopProblem(bare, t)).toBeNull();
    expect(lieutenantSlots(bare, 4)).toBe(4);
  });

  it("recusa fora da área, em cima de outra, na frente do portão e fechando o caminho", () => {
    const plan = startingPlan();
    expect(placeProblem(plan, "BARRACK", 3, 3)).toMatch(/Fora/);
    expect(placeProblem(plan, "BARRACK", -5, -6)).toMatch(/Fora/);
    expect(placeProblem(plan, "BARRACK", 0, -3)).toMatch(/outra/);
    // O portão é a oeste: as células (-5,-1) a (-4,0) ficam livres
    expect(gateLane(plan).length).toBe(4);
    expect(placeProblem(plan, "RECRUIT_MAST", -5, -1)).toMatch(/portão/);
    // Num canto fechado, uma barraca empareda a outra
    const tight: CampPlan = { size: 10, gate: "W", ditch: false, buildings: [newBuilding("BARRACK", 2, -5), newBuilding("BARRACK", 2, -2)] };
    expect(placeProblem(tight, "RECRUIT_MAST", 0, -5)).toBeNull();
    const walled: CampPlan = { ...tight, buildings: [...tight.buildings, newBuilding("RECRUIT_MAST", 0, -5)] };
    // Fechar a única passagem até a barraca de cima
    expect(placeProblem(walled, "RECRUIT_MAST", 0, -3)).toMatch(/caminho/);
  });

  it("acha um lugar livre e a porta de cada construção", () => {
    const plan = startingPlan();
    const spot = freeSpot(plan, "RECRUIT_MAST");
    expect(spot).not.toBeNull();
    expect(placeProblem(plan, "RECRUIT_MAST", spot!.x, spot!.y)).toBeNull();
    const fire = plan.buildings.find((b) => b.kind === "CAMPFIRE")!;
    const door = doorCell(plan, fire);
    expect(door).not.toBeNull();
    // A porta é por baixo, de preferência
    expect(door![1]).toBe(fire.y + 2);
  });

  it("o portão só muda para um lado com a faixa livre", () => {
    const plan = startingPlan();
    expect(gateProblem(plan, "S")).toBeNull();
    // A tenda encosta no lado norte, e a barraca, no leste
    expect(gateProblem(plan, "N")).toMatch(/dentro/);
    expect(gateProblem(plan, "E")).toMatch(/dentro/);
  });

  it("o patamar 1 só abre dentro da paliçada, e o máximo de cada construção vale", () => {
    const plan = startingPlan();
    expect(buildProblem(plan, "BARRACK")).toBeNull();
    expect(buildProblem(plan, "RECRUIT_MAST")).toBeNull();
    expect(buildProblem(plan, "KITCHEN")).toMatch(/paliçada/);
    expect(buildProblem(plan, "FORGE")).toMatch(/paliçada/);
    const big = grown(plan);
    expect(buildProblem(big, "KITCHEN")).toBeNull();
    expect(buildProblem(big, "COMMAND_TENT")).toMatch(/Já existe/);
    for (const kind of BUILD_ORDER) expect(CAMP_BUILDINGS[kind].fixed).toBeFalsy();
  });

  it("a paliçada pede fama, batalhões e construções, e cresce sem tirar nada do lugar", () => {
    const plan = startingPlan();
    expect(growProblem(plan, { fame: 0, battalions: 1 })).toMatch(/fama 4/);
    const ready: CampPlan = { ...plan, buildings: [...plan.buildings, newBuilding("BARRACK", 2, -4), newBuilding("RECRUIT_MAST", -4, 2)] };
    expect(valid(ready)).toEqual([]);
    expect(growProblem(ready, { fame: 4, battalions: 2 })).toBeNull();
    const g = grown(ready);
    expect(g.size).toBe(16);
    expect(g.buildings).toEqual(ready.buildings);
    expect(valid(g)).toEqual([]);
    expect(growProblem(g, { fame: 15, battalions: 3 })).toMatch(/cozinha/);
    expect(growProblem(legacyPlan(4, []), { fame: 99, battalions: 9 })).toMatch(/grande/);
  });

  it("as necessidades: leitos, comida, cura e segurança", () => {
    const plan = startingPlan();
    const n = needsOf(plan, { battalions: 2, inCamp: 2, patients: 3, fame: 0 });
    expect(n.BEDS).toEqual({ have: 1, need: 2 });
    expect(n.FOOD).toEqual({ have: 2, need: 2 });
    expect(n.CURE).toEqual({ have: 0, need: 3 });
    expect(n.SECURITY.have).toBe(0);
    const old = legacyPlan(3, ["TOWERS", "DITCH"]);
    // Paliçada grande (0,35) + 3 torres (0,3) + fosso (0,25) passa do teto
    expect(guardOf(old)).toBeCloseTo(0.85);
    const m = needsOf(old, { battalions: 3, inCamp: 3, patients: 10, fame: 40 });
    expect(m.FOOD.have).toBe(5);
    expect(m.CURE.have).toBe(16);
    expect(m.SECURITY.need).toBeGreaterThan(0.5);
  });

  it("as tropas e os tenentes vêm das construções", () => {
    const plan = startingPlan();
    expect(troopProblem(plan, "INFANTRY")).toBeNull();
    expect(troopProblem(plan, "ARCHERS")).toMatch(/estande/);
    expect(troopProblem(plan, "SPEARMEN")).toMatch(/treino/);
    expect(lieutenantSlots(plan, 4)).toBe(0);
    const p: CampPlan = { ...grown(plan), buildings: [...plan.buildings, newBuilding("ARCHERY", -6, -8), newBuilding("OFFICERS_TENT", 3, -7, 2)] };
    expect(valid(p)).toEqual([]);
    expect(troopProblem(p, "ARCHERS")).toBeNull();
    expect(troopProblem(p, "JAVELINS")).toMatch(/nível 2/);
    expect(lieutenantSlots(p, 4)).toBe(2);
    expect(troopProblem(legacyPlan(1, []), "KNIGHTS")).toBeNull();
    expect(troopProblem(p, "KNIGHTS")).toMatch(/fortaleza/);
  });

  it("o mastro atrai voluntários; o posto de recrutamento dobra", () => {
    expect(volunteerRate(startingPlan())).toEqual({ perDay: 0, cap: 0 });
    const plan = { ...startingPlan(), buildings: [...startingPlan().buildings, newBuilding("RECRUIT_MAST", -4, 2)] };
    expect(volunteerRate(plan)).toEqual({ perDay: 1, cap: 8 });
    expect(volunteerRate(legacyPlan(2, [])).perDay).toBe(2);
  });

  it("desmontar devolve metade, contando os níveis", () => {
    expect(refundOf(newBuilding("BARRACK", 0, 0))).toEqual({ gold: 20, wood: 0, iron: 0 });
    expect(refundOf(newBuilding("OFFICERS_TENT", 0, 0, 3))).toEqual({ gold: Math.floor((120 + 150 + 200) / 2), wood: 1, iron: 0 });
  });

  it("levantar: cabe o que der nas carroças; o poço e o fosso ficam", () => {
    const start = startingPlan();
    // O bivaque cabe numa carroça só
    expect(planCargo(start)).toBeLessThanOrEqual(CARGO_PER_WAGON);
    const a = packPlan(start, 1);
    expect(a.left).toEqual([]);
    expect(a.plan.buildings.length).toBe(3);

    const old = legacyPlan(6, ["TOWERS", "DITCH"]);
    const all = packPlan(old, 20);
    expect(all.plan.size).toBe(28);
    expect(all.plan.ditch).toBe(false);
    expect(all.left.map((b) => b.kind)).toEqual(["WELL"]);

    // Sem carroça nenhuma, só a tenda e a fogueira vão, num bivaque
    const none = packPlan(old, 0);
    expect(none.plan.size).toBe(10);
    expect(none.plan.buildings.map((b) => b.kind).sort()).toEqual(["CAMPFIRE", "COMMAND_TENT"]);
    expect(valid(none.plan)).toEqual([]);

    // Com 2 carroças: a paliçada grande (4) e as barracas vão primeiro
    const two = packPlan(old, 2);
    expect(two.plan.size).toBe(28);
    expect(two.plan.buildings.filter((b) => b.kind === "BARRACK").length).toBe(6);
    expect(valid(two.plan)).toEqual([]);
  });
});

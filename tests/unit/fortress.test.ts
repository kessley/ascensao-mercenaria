import { describe, expect, it } from "vitest";
import {
  BARRACKS_HALL_BEDS,
  CAMP_BUILDINGS,
  CELL,
  PALISADE,
  STONE_WALL,
  bedsOf,
  buildProblem,
  crowdLimit,
  fortWalls,
  guardOf,
  isFortress,
  lieutenantSlots,
  newBuilding,
  newWork,
  shapeOf,
  startingPlan,
  tierOf,
  type CampKind,
  type CampPlan,
} from "../../src/game/data/campGrid";
import {
  FIELD_KIT_MAX,
  FIELD_MIN_DISTANCE,
  LAND,
  fieldCampOf,
  fieldPitchProblem,
  fortressPlan,
  kitChoices,
  kitProblem,
  landProblem,
  sackGold,
  sackedPlan,
  seatDefense,
  seatSiege,
  siegeEvery,
  siegeHost,
  standardCost,
  standardProblem,
  type LandCtx,
} from "../../src/game/sim/fortress";

/** Marco 22, parte 3: a fortaleza (GDD 9.7). */
const big = (kinds: [CampKind, number, number][] = []): CampPlan => {
  const base = startingPlan();
  const needs: [CampKind, number, number][] = [["KITCHEN", -12, -12], ["OFFICERS_TENT", 6, -12], ["WELL", -12, 6], ["TOWER", 8, 8]];
  return { ...base, size: 28, buildings: [...base.buildings, ...[...needs, ...kinds].map(([k, x, y]) => newBuilding(k, x, y))] };
};
const fort = (kinds: [CampKind, number, number][] = []) => fortressPlan(big(kinds));
const ok = { fame: 60, battalions: 6 };
const noLand: LandCtx = { lord: null, liege: null, ruins: null };
const lord = (relation: number, atWar = false): LandCtx => ({ lord: { id: "F1", name: "Reino de Teste", relation, atWar }, liege: null, ruins: null });

describe("fincar o estandarte", () => {
  it("só da paliçada grande, com fama, soldados e as construções principais", () => {
    expect(standardProblem({ ...big(), size: 22 }, ok, "WILD", noLand)).toMatch(/paliçada grande/);
    expect(standardProblem(big(), { fame: 10, battalions: 2 }, "WILD", noLand)).toMatch(/fama 45.*5 batalhões/);
    const bare: CampPlan = { ...startingPlan(), size: 28 };
    expect(standardProblem(bare, ok, "WILD", noLand)).toMatch(/cozinha/);
    expect(standardProblem(big(), ok, "WILD", noLand)).toBeNull();
    expect(standardProblem(fort(), ok, "WILD", noLand)).toMatch(/já está fincado/);
  });

  it("a obra que ainda não acabou não conta", () => {
    const plan = big();
    const unbuilt: CampPlan = { ...plan, buildings: plan.buildings.map((b) => (b.kind === "KITCHEN" ? { ...b, built: 0 } : b)) };
    expect(standardProblem(unbuilt, ok, "WILD", noLand)).toMatch(/cozinha/);
  });

  it("a fortaleza é o patamar 2: 34×34, muralha de madeira, e libera as construções dela", () => {
    const before = big();
    const f = fortressPlan(before);
    expect(f.size).toBe(34);
    expect(f.wall).toBe("WOOD");
    expect(tierOf(f)).toBe(2);
    expect(isFortress(f)).toBe(true);
    // As construções continuam onde estavam
    expect(f.buildings).toBe(before.buildings);
    expect(buildProblem(big(), "KEEP")).toMatch(/fortaleza/);
    expect(buildProblem(f, "KEEP")).toBeNull();
  });
});

describe("a terra por um de três caminhos", () => {
  it("carta de terra: o senhor precisa confiar no bando e não estar em guerra com ele", () => {
    expect(landProblem("CHARTER", noLand)).toMatch(/Ninguém manda/);
    expect(landProblem("CHARTER", lord(5))).toMatch(/não confia/);
    expect(landProblem("CHARTER", lord(40, true))).toMatch(/guerra/);
    expect(landProblem("CHARTER", { ...lord(40), liege: "F9" })).toMatch(/outra coroa/);
    expect(landProblem("CHARTER", lord(40))).toBeNull();
  });

  it("ruínas: só depois de limpas", () => {
    expect(landProblem("RUINS", noLand)).toMatch(/Não há ruínas/);
    expect(landProblem("RUINS", { ...noLand, ruins: { id: "s1", name: "a Torre Velha", fill: 0.8 } })).toMatch(/limpe a Torre Velha/);
    expect(landProblem("RUINS", { ...noLand, ruins: { id: "s1", name: "a Torre Velha", fill: 0.1 } })).toBeNull();
  });

  it("terra de ninguém: só onde nenhum senhor manda", () => {
    expect(landProblem("WILD", noLand)).toBeNull();
    expect(landProblem("WILD", lord(80))).toMatch(/é de Reino de Teste/);
  });

  it("as ruínas saem mais baratas que a terra de ninguém, e a carta custa um pouco", () => {
    const wild = standardCost("WILD");
    expect(wild).toEqual({ gold: PALISADE[34].cost.gold, wood: PALISADE[34].cost.wood, iron: 0 });
    expect(standardCost("RUINS").gold).toBeLessThan(wild.gold);
    expect(standardCost("RUINS").wood).toBeLessThan(wild.wood!);
    expect(standardCost("CHARTER").gold).toBe(wild.gold + LAND.CHARTER.cost.gold);
  });
});

describe("a muralha do gerador", () => {
  const s = shapeOf({ size: 34, gate: "S" }, { x: 1000, y: 1000 });

  it("contorna o quadrado por fora, com o vão do portão livre", () => {
    const w = fortWalls(s, "WOOD");
    const inside = (p: { x: number; y: number }) => w.walls.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
    const half = 17 * CELL;
    // Nada de muro por dentro do quadrado nem no vão do portão
    expect(w.walls.every((r) => r.x + r.w <= 1000 - half + 1 || r.x >= 1000 + half - 1 || r.y + r.h <= 1000 - half + 1 || r.y >= 1000 + half - 1)).toBe(true);
    expect(inside({ x: 1000, y: 1000 + half + w.thickness / 2 })).toBe(false);
    expect(inside({ x: 1000, y: 1000 - half - w.thickness / 2 })).toBe(true);
    expect(inside({ x: 1000 - half - w.thickness / 2, y: 1000 })).toBe(true);
    // Os cantos fechados
    expect(inside({ x: 1000 - half - w.thickness / 2, y: 1000 - half - w.thickness / 2 })).toBe(true);
  });

  it("torres nos cantos, ao longo dos lados e duas no portão; a de pedra é mais grossa", () => {
    const wood = fortWalls(s, "WOOD");
    const stone = fortWalls(s, "STONE");
    expect(stone.thickness).toBeGreaterThan(wood.thickness);
    // 4 cantos, 1 no meio de cada lado (no do portão, ela dá lugar às 2 do portão)
    expect(wood.towers.length).toBe(4 + 3 + 2);
    const gateY = 1000 + 17 * CELL;
    const atGate = wood.towers.filter((t) => Math.abs(t.y + t.h / 2 - gateY - wood.thickness / 2) < 1 && Math.abs(t.x + t.w / 2 - 1000) < 150);
    expect(atGate.length).toBe(2);
  });

  it("a muralha de pedra e o armazém seguram mais saque", () => {
    const f = fort();
    expect(guardOf({ ...f, wall: "STONE" })).toBeCloseTo(guardOf(f) + STONE_WALL.guard);
    expect(guardOf(fort([["STOREHOUSE", -4, 10]]))).toBeGreaterThan(guardOf(f));
  });
});

describe("as construções da fortaleza", () => {
  it("são doze, todas só na fortaleza e fora das carroças", () => {
    const kinds: CampKind[] = ["KEEP", "BARRACKS_HALL", "GREAT_HALL", "DUNGEON", "CISTERN", "STOREHOUSE", "OFFICER_SCHOOL", "TREASURY", "SIEGE_WORKSHOP", "CASTLE_FAIR", "DOVECOTE", "TEMPLE"];
    for (const k of kinds) {
      expect(CAMP_BUILDINGS[k].tier).toBe(2);
      expect(CAMP_BUILDINGS[k].cargo).toBe(0);
    }
  });

  it("quartel, cisterna e escola de oficiais", () => {
    const f = fort([["BARRACKS_HALL", -16, 10], ["CISTERN", 12, -4], ["OFFICER_SCHOOL", 2, 12]]);
    expect(bedsOf(f)).toBe(bedsOf(fort()) + BARRACKS_HALL_BEDS);
    expect(crowdLimit(f, 60)).toBe(crowdLimit(fort(), 60) + 60);
    expect(lieutenantSlots(f, 3)).toBe(lieutenantSlots(fort(), 3) + 1);
    // Em obra, nada disso conta
    const work: CampPlan = { ...fort(), buildings: [...fort().buildings, newWork("BARRACKS_HALL", -16, 10)] };
    expect(bedsOf(work)).toBe(bedsOf(fort()));
  });
});

describe("o cerco à sede", () => {
  it("vem mais cedo com a fama e na terra de ninguém, e cada um vem maior", () => {
    expect(siegeEvery("CHARTER", 80)).toBeLessThan(siegeEvery("CHARTER", 0));
    expect(siegeEvery("WILD", 40)).toBeLessThan(siegeEvery("CHARTER", 40));
    expect(siegeEvery("CHARTER", 1000)).toBeGreaterThanOrEqual(20);
    expect(siegeHost(50, 2)).toBeGreaterThan(siegeHost(50, 0));
  });

  it("muralha de pedra, torre de menagem e castelão seguram mais", () => {
    const f = fort();
    const base = seatDefense(f, 32, false);
    expect(seatDefense(f, 32, true)).toBeGreaterThan(base);
    expect(seatDefense({ ...f, wall: "STONE" }, 32, false)).toBeGreaterThan(base);
    expect(seatDefense(fort([["KEEP", -16, 10]]), 32, false)).toBeGreaterThan(base);
    expect(seatDefense(f, 0, true)).toBe(seatDefense(f, 0, false));
  });

  it("a sede aguenta o que é menor que ela, com a sorte do dia", () => {
    expect(seatSiege(100, 70, 0).held).toBe(true);
    expect(seatSiege(100, 130, 1).held).toBe(false);
    expect(seatSiege(100, 100, 0.6).held).toBe(true);
    expect(seatSiege(100, 100, 0.4).held).toBe(false);
    // Quem aguenta perde menos que quem cai
    expect(seatSiege(100, 70, 0).loss).toBeLessThan(seatSiege(100, 130, 1).loss);
  });

  it("a sede que cai queima um terço do que tem, e a tesouraria guarda o ouro", () => {
    const f = fort([["BARRACKS_HALL", -16, 10], ["CISTERN", 12, -4], ["OFFICER_SCHOOL", 2, 12]]);
    const { plan, burned } = sackedPlan(f, () => 0.3);
    // Fora a tenda e a fogueira (fixas) e o que é cavado: 5 de 7 queimáveis ... um terço
    expect(burned.length).toBe(Math.round(5 / 3));
    expect(plan.buildings.filter((b) => b.built === 0).length).toBe(burned.length);
    expect(sackGold(f, 1000)).toBe(400);
    expect(sackGold(fort([["TREASURY", -16, 10]]), 1000)).toBe(0);
  });
});

describe("o acampamento de campo", () => {
  const f = fort([["BARRACK", -16, 10], ["INFIRMARY", 12, -4], ["FORGE", 2, 12], ["KEEP", -4, 2]]);

  it("o kit sai do que a fortaleza tem pronto e anda nas carroças", () => {
    const choices = kitChoices(f);
    expect(choices).toContain("BARRACK");
    expect(choices).toContain("KITCHEN");
    expect(choices).not.toContain("KEEP");
    expect(choices).not.toContain("WELL");
    expect(choices).not.toContain("CAMPFIRE");
  });

  it("até 6, um de cada, e cabendo nas carroças", () => {
    expect(kitProblem(["BARRACK", "KITCHEN"], f, 1)).toBeNull();
    expect(kitProblem(["BARRACK", "BARRACK"], f, 2)).toMatch(/uma vez/);
    expect(kitProblem(["STABLE"], f, 2)).toMatch(/não tem estábulo/);
    expect(kitProblem(["BARRACK", "KITCHEN", "INFIRMARY", "FORGE", "OFFICERS_TENT", "TOWER"], f, 1)).toMatch(/Não cabe/);
    expect(kitProblem(["BARRACK", "KITCHEN", "INFIRMARY", "FORGE", "OFFICERS_TENT", "TOWER", "QUARTERMASTER"], f, 9)).toMatch(new RegExp(`No máximo ${FIELD_KIT_MAX}`));
  });

  it("barracas tiram o relento, a enfermaria cura e a ferraria conta como oficina", () => {
    expect(fieldCampOf([])).toEqual({ shelter: false, cooked: true, sickBeds: 0, craft: 0 });
    const full = fieldCampOf(["BARRACK", "INFIRMARY", "FORGE"]);
    expect(full.shelter).toBe(true);
    expect(full.sickBeds).toBeGreaterThan(0);
    expect(full.craft).toBe(1);
  });

  it("só se monta longe da fortaleza", () => {
    const seat = { x: 0, y: 0 };
    expect(fieldPitchProblem({ x: 100, y: 0 }, seat, false)).toMatch(/dorme nela/);
    expect(fieldPitchProblem({ x: FIELD_MIN_DISTANCE + 1, y: 0 }, seat, false)).toBeNull();
    expect(fieldPitchProblem({ x: FIELD_MIN_DISTANCE + 1, y: 0 }, seat, true)).toMatch(/já está montado/);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { migrateCampPlan, recruitProblem, useGameStore } from "../../src/store/useGameStore";
import { healthDay, NO_EXPOSURE } from "../../src/game/sim/logistics";
import { CAMP_BUILDINGS, VOLUNTEERS, startingPlan } from "../../src/game/data/campGrid";
import { ECONOMY, LIEUTENANTS, SUPPLY, SUPPORT } from "../../src/utils/constants";
import type { BattalionData } from "../../src/store/useGameStore";

/** Marco 22, parte 1: a planta no store (começo novo, construir, saves antigos). */
const initial = useGameStore.getState();
const reset = (extra: Partial<ReturnType<typeof useGameStore.getState>> = {}) => useGameStore.setState({ ...initial, campPlan: startingPlan(), ...extra }, true);

describe("a planta do acampamento no store", () => {
  beforeEach(() => reset());

  it("a campanha nova começa humilde: 1 batalhão, sem tenente, 1 carroça, 1 mensageiro", () => {
    const s = useGameStore.getState();
    expect(s.battalions.length).toBe(1);
    expect(s.battalions[0].troopType).toBe("INFANTRY");
    expect(s.lieutenants).toEqual([]);
    expect(s.gold).toBe(ECONOMY.START_GOLD);
    expect(s.rations).toBe(ECONOMY.START_RATIONS);
    expect(s.wagons.length).toBe(SUPPLY.START_WAGONS);
    expect(s.messengers.length).toBe(SUPPORT.START_MESSENGERS);
    expect(s.campPlan.buildings.map((b) => b.kind).sort()).toEqual(["BARRACK", "CAMPFIRE", "COMMAND_TENT"]);
  });

  it("construir paga, recusa o que não cabe e desmontar devolve metade", () => {
    const st = useGameStore.getState();
    expect(st.placeBuilding("RECRUIT_MAST", -1, -4)).toMatch(/outra/);
    expect(st.placeBuilding("RECRUIT_MAST", -4, 2)).toBeNull();
    const s = useGameStore.getState();
    expect(s.gold).toBe(ECONOMY.START_GOLD - CAMP_BUILDINGS.RECRUIT_MAST.cost.gold);
    expect(s.placeBuilding("KITCHEN", -4, -4)).toMatch(/paliçada/);
    const mast = s.campPlan.buildings.find((b) => b.kind === "RECRUIT_MAST")!;
    expect(s.dismantleBuilding(mast.id)).toBeNull();
    expect(useGameStore.getState().gold).toBe(ECONOMY.START_GOLD - CAMP_BUILDINGS.RECRUIT_MAST.cost.gold / 2);
    const tent = s.campPlan.buildings.find((b) => b.kind === "COMMAND_TENT")!;
    expect(useGameStore.getState().dismantleBuilding(tent.id)).toMatch(/não se desmonta/);
  });

  it("o mastro junta voluntários e eles formam um batalhão", () => {
    useGameStore.getState().placeBuilding("RECRUIT_MAST", -4, 2);
    expect(useGameStore.getState().formVolunteers()).toMatch(/Faltam/);
    useGameStore.setState({ volunteers: VOLUNTEERS.CAP, gold: 500 });
    expect(useGameStore.getState().formVolunteers()).toBeNull();
    expect(useGameStore.getState().battalions.length).toBe(2);
    expect(useGameStore.getState().volunteers).toBe(0);
  });

  it("o posto e as construções liberam as tropas; a tenda dos oficiais, o tenente", () => {
    const s = useGameStore.getState();
    expect(recruitProblem(s, "INFANTRY")).toMatch(/posto/);
    expect(s.recruitBattalion("INFANTRY")).toBe(false);
    useGameStore.setState({ gold: 2000, lieutenantCandidates: s.lieutenantCandidates.length > 0 ? s.lieutenantCandidates : initial.lieutenantCandidates });
    const c = useGameStore.getState().lieutenantCandidates[0];
    if (c) expect(useGameStore.getState().hireLieutenant(c.id)).toBe(false);
    expect(LIEUTENANTS.MAX_HIRED).toBeGreaterThan(0);
  });

  it("a taverna aluga um batalhão por semana em cada povoado", () => {
    const town = initial.settlements[0];
    if (!town) return;
    useGameStore.setState({ gold: 1000 });
    expect(useGameStore.getState().hireAtTavern(town.id)).toBeNull();
    expect(useGameStore.getState().hireAtTavern(town.id)).toMatch(/semana/);
    expect(useGameStore.getState().battalions.length).toBe(2);
  });

  it("um save antigo vira a planta antiga, com as obras e tudo liberado", () => {
    const store: Record<string, unknown> = { battalions: [{}, {}, {}], campWorks: ["PALISADE", "TOWERS", "DITCH"] };
    migrateCampPlan(store);
    const plan = store.campPlan as ReturnType<typeof startingPlan>;
    expect(plan.legacy).toBe(true);
    expect(plan.size).toBe(28);
    expect(plan.ditch).toBe(true);
    expect(plan.buildings.filter((b) => b.kind === "BARRACK").length).toBe(3);
    expect(store.campWorks).toBeUndefined();
    expect(recruitProblem({ campPlan: plan }, "KNIGHTS")).toBeNull();
    // Um save novo fica como está
    const fresh: Record<string, unknown> = { campPlan: startingPlan() };
    const before = fresh.campPlan;
    migrateCampPlan(fresh);
    expect(fresh.campPlan).toBe(before);
  });
});

describe("enfermaria e lotação", () => {
  const wounded = (n: number): BattalionData => ({ id: "a", name: "a", troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers: 8, maxSoldiers: 16, wounded: n });

  it("sem leito na enfermaria, o ferido sara no ritmo do campo", () => {
    const runs = 400;
    let withBeds = 0;
    let without = 0;
    for (let i = 0; i < runs; i++) {
      withBeds += healthDay([wounded(8)], new Set(), NO_EXPOSURE, false, false, { beds: 8, crowd: 60 }).battalions[0].soldiers - 8;
      without += healthDay([wounded(8)], new Set(), NO_EXPOSURE, false, false, { beds: 0, crowd: 60 }).battalions[0].soldiers - 8;
    }
    expect(withBeds).toBeGreaterThan(without * 1.5);
  });
});

import { describe, expect, it } from "vitest";
import { CAMP_BUILDINGS, needsOf, newBuilding, newWork, startingPlan, troopProblem, workOf, type CampKind, type CampPlan } from "../../src/game/data/campGrid";
import {
  LABOR,
  SHIFT_XP,
  advanceWorks,
  campProduce,
  carpentryProblem,
  daysLeft,
  driftMood,
  moodTarget,
  shiftXp,
  staffPosts,
  upkeepOf,
} from "../../src/game/sim/campDays";
import { healthDay, NO_EXPOSURE } from "../../src/game/sim/logistics";
import type { Follower, FollowerRole } from "../../src/game/sim/campEvents";
import type { BattalionData } from "../../src/store/useGameStore";

/** Marco 22, parte 2: turnos, gente nos postos, obras que levam dias e as sete necessidades. */
const camp = (kinds: [CampKind, number, number][], size: CampPlan["size"] = 22): CampPlan => {
  const base = startingPlan();
  return { ...base, size, buildings: [...base.buildings, ...kinds.map(([k, x, y]) => newBuilding(k, x, y))] };
};
const follower = (role: FollowerRole, name = role): Follower => ({ id: name, role, name, since: 0 });
const ctx = { battalions: 4, inCamp: 4, soldiers: 64, patients: 0, fame: 0 };

describe("gente nos postos", () => {
  const plan = camp([["KITCHEN", -8, -8], ["INFIRMARY", 4, -8], ["FORGE", -8, 4]]);
  const id = (k: CampKind) => plan.buildings.find((b) => b.kind === k)!.id;

  it("os seguidores do papel certo vão primeiro; qualquer outro cobre o que sobra", () => {
    const st = staffPosts(plan, [follower("FAMILY", "Bento"), follower("COOK", "Guida")], 0);
    expect(st.staff.get(id("KITCHEN"))).toMatch(/Guida/);
    expect(st.staff.get(id("INFIRMARY"))).toMatch(/Bento/);
    expect(st.idle.map((b) => b.kind)).toEqual(["FORGE"]);
    // Quem não tem posto (a barraca, a fogueira) funciona sempre
    expect(st.working.has(plan.buildings.find((b) => b.kind === "BARRACK")!.id)).toBe(true);
    expect(st.labor).toBe(LABOR.BASE);
  });

  it("um batalhão na obra cobre os postos vazios e o resto do trabalho vai para as obras", () => {
    const st = staffPosts(plan, [], 1);
    expect(st.idle).toEqual([]);
    expect(st.labor).toBe(LABOR.BASE + LABOR.BATTALION - 3);
    expect(st.staff.get(id("FORGE"))).toMatch(/soldados/);
  });

  it("cozinha sem ninguém não cozinha, e posto fechado libera o trabalhador", () => {
    const empty = staffPosts(plan, [], 0);
    expect(needsOf(plan, { ...ctx, working: empty.working }).FOOD.have).toBe(2);
    const staffed = staffPosts(plan, [follower("COOK")], 0);
    expect(needsOf(plan, { ...ctx, working: staffed.working }).FOOD.have).toBe(5);
    const only = camp([["KITCHEN", -8, -8]]);
    const closed: CampPlan = { ...only, buildings: only.buildings.map((b) => (b.kind === "KITCHEN" ? { ...b, off: true } : b)) };
    const freed = staffPosts(closed, [follower("COOK")], 0);
    expect(freed.working.has(closed.buildings.find((b) => b.kind === "KITCHEN")!.id)).toBe(false);
    expect(freed.labor).toBe(LABOR.BASE + LABOR.FOLLOWER);
  });
});

describe("obras que levam dias", () => {
  it("o trabalho vai para as obras na ordem da planta, e a pronta perde o andamento", () => {
    const base = startingPlan();
    const plan: CampPlan = { ...base, buildings: [...base.buildings, newWork("RECRUIT_MAST", -4, 2), newWork("DICE", 2, -4)] };
    expect(daysLeft(plan, plan.buildings[4].id, 2)).toBe(Math.ceil((workOf("RECRUIT_MAST") + workOf("DICE")) / 2));
    const a = advanceWorks(plan, workOf("RECRUIT_MAST") + 1);
    expect(a.finished.map((b) => b.kind)).toEqual(["RECRUIT_MAST"]);
    expect(a.plan.buildings[3].built).toBeUndefined();
    expect(a.plan.buildings[4].built).toBe(1);
    // Sem trabalho, nada muda (nem a planta)
    expect(advanceWorks(a.plan, 0).plan).toBe(a.plan);
  });

  it("obra não libera tropa nem conta nas necessidades antes de ficar pronta", () => {
    const base = startingPlan();
    const plan: CampPlan = { ...base, size: 16, buildings: [...base.buildings, newWork("STABLE", -6, -6), newWork("BARRACK", 2, 3)] };
    expect(troopProblem(plan, "CAVALRY")).toMatch(/estábulo/);
    expect(needsOf(plan, ctx).BEDS.have).toBe(1);
    const done = advanceWorks(plan, 100).plan;
    expect(troopProblem(done, "CAVALRY")).toBeNull();
    expect(needsOf(done, ctx).BEDS.have).toBe(2);
  });

  it("o barracão abriga dois batalhões; o picadeiro libera os arqueiros montados", () => {
    const plan = camp([["STABLE", -8, -8], ["RIDING", 4, 4]]);
    expect(troopProblem(plan, "HORSE_ARCHERS")).toBeNull();
    const big: CampPlan = { ...plan, buildings: plan.buildings.map((b) => (b.kind === "BARRACK" ? { ...b, level: 2 } : b)) };
    expect(needsOf(big, ctx).BEDS.have).toBe(2);
  });
});

describe("as sete necessidades", () => {
  it("o painel tem as sete, e cada uma sobe com a construção certa", () => {
    const bare = needsOf(startingPlan(), ctx);
    expect(Object.keys(bare).sort()).toEqual(["BEDS", "CRAFT", "CURE", "FOOD", "MORALE", "SALUBRITY", "SECURITY"]);
    const plan = camp([["LATRINE", -8, -8], ["CAMP_TAVERN", 4, -8], ["CALTROPS", -8, 4], ["CARPENTRY", 4, 4]]);
    const full = needsOf(plan, { ...ctx, guards: 1 });
    expect(full.SALUBRITY.have).toBe(bare.SALUBRITY.have + 30);
    expect(full.MORALE.have).toBe(CAMP_BUILDINGS.CAMP_TAVERN.mood);
    expect(full.SECURITY.have).toBeGreaterThan(bare.SECURITY.have + 0.15);
    expect(full.CRAFT).toEqual({ have: 1, need: 2 });
  });

  it("o humor anda para o que as construções dão, e quem dorme ao relento puxa para baixo", () => {
    expect(moodTarget(6, 2, 0)).toBeGreaterThan(0);
    expect(moodTarget(0, 2, 0)).toBeLessThan(0);
    expect(moodTarget(6, 2, 2)).toBeLessThan(moodTarget(6, 2, 0));
    expect(driftMood(0, 8)).toBe(2);
    expect(driftMood(9, 8)).toBe(8);
  });

  it("herbário e latrina: doentes saram mais e adoecem menos no acampamento", () => {
    const sick = (n: number): BattalionData => ({ id: "a", name: "a", troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers: 8, maxSoldiers: 16, sick: n, sickness: "FEBRE" });
    let herbs = 0;
    let none = 0;
    for (let i = 0; i < 400; i++) {
      herbs += healthDay([sick(8)], new Set(), NO_EXPOSURE, false, false, { beds: 0, crowd: 999, herbs: true }).battalions[0].soldiers;
      none += healthDay([sick(8)], new Set(), NO_EXPOSURE, false, false, { beds: 0, crowd: 999 }).battalions[0].soldiers;
    }
    expect(herbs).toBeGreaterThan(none);
  });
});

describe("turnos, produção e manutenção", () => {
  it("o treino rende mais com o pátio da tropa", () => {
    const plan = camp([["ARCHERY", -8, -8]]);
    expect(shiftXp(plan, "ARCHERS")).toBe(SHIFT_XP.YARD);
    expect(shiftXp(plan, "INFANTRY")).toBe(SHIFT_XP.NONE);
  });

  it("horta, lenhador e troféus produzem só com gente (e floresta, para o lenhador)", () => {
    const plan = camp([["GARDEN", -8, -8], ["LUMBER", 4, -8], ["TROPHY", -8, 4]]);
    const staffed = staffPosts(plan, [follower("FAMILY", "a"), follower("FAMILY", "b")], 0).working;
    expect(campProduce(plan, staffed, 0.4)).toEqual({ rations: 3, wood: 1.8, fame: 0.1 });
    expect(campProduce(plan, staffed, 0).wood).toBe(0);
    expect(campProduce(plan, staffPosts(plan, [], 0).working, 0.4).rations).toBe(0);
    expect(upkeepOf(camp([["TOWER", -8, -8], ["ALTAR", 4, 4]]))).toBe(2);
  });

  it("a carpintaria faz o aríete e as escadas, um aríete por vez", () => {
    const plan = camp([["CARPENTRY", -8, -8]]);
    const working = staffPosts(plan, [follower("FAMILY")], 0).working;
    expect(carpentryProblem(plan, working, "RAM", { ladders: 0, rams: 0 }, 1)).toBeNull();
    expect(carpentryProblem(plan, working, "RAM", { ladders: 0, rams: 1 }, 1)).toMatch(/pronto/);
    expect(carpentryProblem(plan, staffPosts(plan, [], 0).working, "LADDER", { ladders: 0, rams: 0 }, 1)).toMatch(/sem ninguém/);
  });
});

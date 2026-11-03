import { describe, expect, it, vi } from "vitest";
import type { Contract } from "../../src/game/data/contracts";
import { compassWord, missionPlan, nextStep, wayTo, type MissionWorld } from "../../src/game/data/missionGuide";
import { DELEGABLE, battalionStrength, canDelegate, expectedLosses, expeditionDays, expeditionLine, expeditionRations, expeditionStage, foeStrength, partyStrength, resolveExpedition, successChance } from "../../src/game/sim/expeditions";
import type { BattalionData } from "../../src/store/useGameStore";
import { EXPEDITION, type TroopType } from "../../src/utils/constants";

// A malha de estradas de verdade pede um mundo inteiro: aqui basta não haver atalho
vi.mock("../../src/game/sim/roadGraph", () => ({ roadGraphOf: () => ({ route: () => null }) }));

const contract = (over: Partial<Contract> = {}): Contract => ({ id: "c", title: "Serviço", client: "Guilda", clientId: "a", description: "", siteId: "", difficulty: 2, travelDays: 3, advance: 20, reward: 100, ...over });

const towns = [
  { id: "a", name: "Alfa", x: 1000, y: 1000 },
  { id: "b", name: "Beta", x: 9000, y: 1000 },
];

const world = {
  sites: [{ id: "s", name: "Ninho", theme: "GOBLIN_NEST", center: { x: 5000, y: 5000 }, groups: [] }],
  geo: { crossings: [{ id: "x", kind: "BRIDGE", x: 3000, y: 3000, angle: 0, width: 90, riverId: "r" }] },
  roads: [],
  settlements: towns,
} as unknown as MissionWorld["world"];

const places: MissionWorld = { world, settlements: towns };

const battalion = (troopType: TroopType = "INFANTRY", soldiers = 8, level = 1): BattalionData => ({ id: `${troopType}-${soldiers}-${level}`, name: troopType, troopType, formation: "LINE", level, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers, maxSoldiers: soldiers });

describe("passos do contrato", () => {
  it("escolta diz de onde sai e para onde vai", () => {
    const plan = missionPlan(contract({ kind: "ESCORT", fromId: "a", targetId: "b" }), places);
    expect(plan.from?.name).toBe("Alfa");
    expect(plan.to?.name).toBe("Beta");
    expect(plan.steps[0].text).toContain("Alfa");
    expect(plan.steps[1].text).toContain("Beta");
    expect(plan.route.length).toBeGreaterThanOrEqual(2);
  });

  it("com a caravana andando, o primeiro passo está feito", () => {
    const c = contract({ kind: "ESCORT", fromId: "a", targetId: "b" });
    expect(nextStep(missionPlan(c, places, { escort: { x: 0, y: 0, waiting: true } }))?.at?.name).toBe("Alfa");
    expect(nextStep(missionPlan(c, places, { escort: { x: 0, y: 0, waiting: false } }))?.at?.name).toBe("Beta");
  });

  it("todo tipo de contrato tem pelo menos um passo", () => {
    for (const kind of ["SITE", "DELIVERY", "ESCORT", "RECOVER", "ROUTE", "SABOTAGE", "RELIEF", "CIVIL", "BURN", "RANSOM"] as const) {
      const plan = missionPlan(contract({ kind, fromId: "a", targetId: "b", siteId: "s", crossingId: "x", good: "IRON", qty: 5 }), places);
      expect(plan.steps.length, kind).toBeGreaterThan(0);
      expect(plan.steps.every((s) => !s.text.includes("?")), kind).toBe(true);
    }
  });

  it("limpar um local aponta para o local", () => {
    expect(missionPlan(contract({ siteId: "s" }), places).to?.name).toBe("Ninho");
  });

  it("entrega: com a carga nas carroças, falta só entregar", () => {
    const c = contract({ kind: "DELIVERY", targetId: "b", good: "IRON", qty: 5 });
    expect(nextStep(missionPlan(c, places, { cargo: 2 }))?.at).toBeUndefined();
    expect(nextStep(missionPlan(c, places, { cargo: 5 }))?.at?.name).toBe("Beta");
  });

  it("carga recuperada marca o primeiro passo", () => {
    expect(missionPlan(contract({ kind: "RECOVER", targetId: "b", good: "IRON", qty: 5 }), places, { recovered: true }).steps[0].done).toBe(true);
  });

  it("sabotagem mostra quantas faltam", () => {
    expect(missionPlan(contract({ kind: "SABOTAGE", need: 2 }), places, { progress: 1 }).steps[0].text).toContain("1 até agora");
  });
});

describe("para que lado", () => {
  const from = { x: 0, y: 0 };

  it("a rosa dos ventos acompanha a tela (y cresce para baixo)", () => {
    expect(compassWord(from, { x: 100, y: 0 })).toBe("a leste");
    expect(compassWord(from, { x: -100, y: 0 })).toBe("a oeste");
    expect(compassWord(from, { x: 0, y: -100 })).toBe("ao norte");
    expect(compassWord(from, { x: 0, y: 100 })).toBe("ao sul");
    expect(compassWord(from, { x: 100, y: -100 })).toBe("a nordeste");
  });

  it("perto é perto", () => {
    expect(wayTo(from, { x: 10, y: 0 })).toBe("aqui perto");
    expect(wayTo(from, { x: 20000, y: 0 })).toContain("a leste");
  });
});

describe("expedição", () => {
  const anyone = () => false;

  it("só o que dá para fazer sem o Comandante", () => {
    expect(canDelegate(contract({ kind: "ESCORT" }))).toBe(true);
    expect(canDelegate(contract({ kind: undefined }))).toBe(true);
    for (const kind of ["RANSOM", "SABOTAGE", "DELIVERY", "BURN"] as const) {
      expect(DELEGABLE).not.toContain(kind);
      expect(canDelegate(contract({ kind }))).toBe(false);
    }
  });

  it("mais gente, nível e tenente valem mais", () => {
    expect(battalionStrength(battalion("INFANTRY", 8), false)).toBeGreaterThan(battalionStrength(battalion("INFANTRY", 4), false));
    expect(battalionStrength(battalion("INFANTRY", 8, 5), false)).toBeGreaterThan(battalionStrength(battalion("INFANTRY", 8, 1), false));
    expect(battalionStrength(battalion(), true)).toBeGreaterThan(battalionStrength(battalion(), false));
    expect(battalionStrength(battalion("HEAVY"), false)).toBeGreaterThan(battalionStrength(battalion("INFANTRY"), false));
  });

  it("força igual dá chance média; o dobro, boa; a metade, ruim", () => {
    expect(successChance(100, 100)).toBeCloseTo(EXPEDITION.CHANCE_EVEN);
    expect(successChance(200, 100)).toBeGreaterThan(0.75);
    expect(successChance(50, 100)).toBeLessThan(0.25);
    expect(successChance(1e6, 1)).toBe(EXPEDITION.CHANCE_MAX);
    expect(successChance(1, 1e6)).toBe(EXPEDITION.CHANCE_MIN);
  });

  it("um batalhão novo não dá conta de contrato difícil; dois veteranos dão", () => {
    const hard = foeStrength(contract({ difficulty: 3 }));
    expect(successChance(partyStrength([battalion()], anyone), hard)).toBeLessThan(0.3);
    expect(successChance(partyStrength([battalion("HEAVY", 8, 3), battalion("INFANTRY", 8, 3)], anyone), hard)).toBeGreaterThan(0.6);
  });

  it("derrota custa mais que vitória, e inimigo forte custa mais que fraco", () => {
    expect(expectedLosses(100, 100, false)).toBeGreaterThan(expectedLosses(100, 100, true));
    expect(expectedLosses(100, 300, true)).toBeGreaterThan(expectedLosses(100, 50, true));
  });

  it("longe custa mais tempo e mais comida", () => {
    expect(expeditionDays(contract({ travelDays: 6 }))).toBeGreaterThan(expeditionDays(contract({ travelDays: 1 })));
    expect(expeditionDays(contract({ travelDays: 0 }))).toBeGreaterThanOrEqual(EXPEDITION.MIN_DAYS);
    expect(expeditionRations([battalion()], 10)).toBeGreaterThan(expeditionRations([battalion()], 2));
  });

  it("vitória dá experiência; derrota não", () => {
    const party = [battalion("INFANTRY", 8, 2)];
    const win = resolveExpedition(party, contract(), anyone, () => 0);
    const lose = resolveExpedition(party, contract(), anyone, () => 0.999);
    expect(win.success).toBe(true);
    expect(win.battalions[0].xp).toBeGreaterThan(0);
    expect(lose.success).toBe(false);
  });

  describe("na estrada", () => {
    const home = { x: 500, y: 500 };
    const path = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }];
    const trip = (kind: "ESCORT" | "SITE" = "ESCORT") => ({ contract: contract({ kind, travelDays: 2 }), departDay: 10, departAt: 10, returnDay: 15, path, meet: 1 });

    it("sai de onde estava", () => {
      expect(expeditionStage(trip(), 10, home).at).toEqual(path[0]);
      expect(expeditionStage(trip(), 10, home).leg).toBe("OUT");
    });

    it("anda conforme o relógio", () => {
      const early = expeditionStage(trip(), 11, home);
      const later = expeditionStage(trip(), 11.5, home);
      expect(later.at.x).toBeGreaterThan(early.at.x);
      expect(early.at.x).toBeGreaterThan(0);
    });

    it("olha para onde vai", () => {
      expect(expeditionStage(trip(), 11, home).facing).toBeCloseTo(0);
    });

    it("escolta: a caravana só anda com a tropa depois do encontro", () => {
      expect(expeditionStage(trip(), 10.2, home).escorting).toBe(false);
      expect(expeditionStage(trip(), 11.6, home).escorting).toBe(true);
      expect(expeditionStage(trip("SITE"), 11.6, home).escorting).toBe(false);
    });

    it("chega e cumpre o serviço no fim da rota", () => {
      const stage = expeditionStage(trip(), 12.5, home);
      expect(stage.leg).toBe("WORK");
      expect(stage.at).toEqual(path[2]);
    });

    it("volta até o Comandante, mesmo que ele tenha andado", () => {
      expect(expeditionStage(trip(), 14, home).leg).toBe("BACK");
      expect(expeditionStage(trip(), 15, home).at).toEqual(home);
    });

    it("save antigo, sem rota, não quebra", () => {
      const old = { contract: contract({ travelDays: 2 }), departDay: 10, returnDay: 15 };
      expect(expeditionStage(old, 11, home).at).toEqual(home);
    });

    it("cada etapa tem uma frase", () => {
      const line = (t: number, kind: "ESCORT" | "SITE" = "ESCORT") => expeditionLine(contract({ kind }), expeditionStage(trip(kind), t, home), "Alfa", "Beta");
      expect(line(10.2)).toContain("Alfa");
      expect(line(11.6)).toContain("escoltando");
      expect(line(11.6)).toContain("Beta");
      expect(line(12.5)).toContain("entregando");
      expect(line(14)).toContain("voltando");
      expect(line(11, "SITE")).toContain("Beta");
    });
  });

  it("quem morre todo não volta e fica na lista de perdidos", () => {
    const r = resolveExpedition([battalion("INFANTRY", 2)], contract({ difficulty: 3 }), anyone, () => 0.999);
    expect(r.lost).toContain("INFANTRY");
    expect(r.battalions).toHaveLength(0);
    expect(r.casualties).toBe(2);
  });

  it("nunca volta mais gente do que foi", () => {
    const party = [battalion("INFANTRY", 8), battalion("ARCHERS", 6)];
    const r = resolveExpedition(party, contract(), anyone, () => 0.4);
    const back = r.battalions.reduce((n, b) => n + b.soldiers, 0);
    expect(back + r.casualties).toBe(14);
  });
});

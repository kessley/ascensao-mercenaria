import { describe, expect, it } from "vitest";
import { companyLimit, generateCaptain, promoteLieutenant, promotionBlock, temperOf, type CaptainData } from "../../src/game/data/captains";
import type { LieutenantData } from "../../src/game/data/lieutenants";
import { captainsWeek, desertions, pruneCompanies, shiftLoyalty } from "../../src/store/captainSlice";
import { companyIntents, companyView, engageRadius, type CompanySquad } from "../../src/game/sim/companies";
import { choosePlan, type ContactView } from "../../src/game/sim/warMind";
import type { BattalionData } from "../../src/store/useGameStore";
import { CAPTAINS } from "../../src/utils/constants";

const captain = (over: Partial<CaptainData> = {}): CaptainData => ({ ...generateCaptain(1, "NOBLE"), traits: [], loyalty: 60, ...over });
const battalion = (id: string): BattalionData => ({ id, name: id, troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 0, soldiers: 8, maxSoldiers: 8 });
const lieutenant = (over: Partial<LieutenantData> = {}): LieutenantData => ({
  id: "l1",
  name: "Ulf",
  epithet: "o Teimoso",
  backstory: "",
  traits: [],
  passive: "STALWART",
  loyalty: 70,
  battalionId: "b1",
  hireCost: 40,
  wage: 10,
  kills: 0,
  history: [],
  ...over,
});

describe("capitães no acampamento", () => {
  it("o Comando diz quantos batalhões cabem na companhia (de 2 a 4)", () => {
    expect(companyLimit({ command: 1 })).toBe(2);
    expect(companyLimit({ command: 3 })).toBe(3);
    expect(companyLimit({ command: 5 })).toBe(4);
  });

  it("o temperamento sai dos traços", () => {
    expect(temperOf({ traits: ["BRAVE"] })).toBe("AGGRESSIVE");
    expect(temperOf({ traits: ["CAUTIOUS"] })).toBe("PATIENT");
    expect(temperOf({ traits: [] })).toBe("STEADY");
  });

  it("só se promove tenente de batalhão veterano ou com abates", () => {
    expect(promotionBlock({ kills: 0, battalionId: null }, null)).not.toBeNull();
    expect(promotionBlock({ kills: 3, battalionId: "b1" }, 2)).not.toBeNull();
    expect(promotionBlock({ kills: 3, battalionId: "b1" }, 3)).toBeNull();
    expect(promotionBlock({ kills: 15, battalionId: "b1" }, 1)).toBeNull();
  });

  it("o tenente promovido guarda o nome, a história e o batalhão, e ganha mais", () => {
    const l = lieutenant({ kills: 20 });
    const c = promoteLieutenant(l, 3, 10);
    expect(c.id).toBe(l.id);
    expect(c.origin).toBe("PROMOTED");
    expect(c.battalionIds).toEqual(["b1"]);
    expect(c.wage).toBeGreaterThan(l.wage);
  });

  it("salário atrasado custa lealdade, o dobro no ganancioso e a metade no leal", () => {
    const [plain, greedy, loyal] = captainsWeek([captain(), captain({ traits: ["GREEDY"] }), captain({ traits: ["LOYAL"] })], false, 7);
    expect(plain.loyalty).toBe(60 + CAPTAINS.LOYALTY.PAYDAY_MISSED);
    expect(greedy.loyalty).toBe(60 + CAPTAINS.LOYALTY.PAYDAY_MISSED * 2);
    expect(loyal.loyalty).toBe(60 + Math.trunc(CAPTAINS.LOYALTY.PAYDAY_MISSED / 2));
  });

  it("ambição alta com companhia grande cansa a cada semana, mesmo pago", () => {
    const [restless, calm] = captainsWeek([captain({ ambition: 5, battalionIds: ["a", "b", "c"] }), captain({ ambition: 5, battalionIds: ["a"] })], true, 7);
    expect(restless.loyalty).toBe(60 + CAPTAINS.LOYALTY.AMBITION_WEEKLY);
    expect(calm.loyalty).toBe(60);
  });

  it("quem desiste leva a companhia, mas nunca o último batalhão do bando", () => {
    const traitor = captain({ loyalty: CAPTAINS.LOYALTY_DESERT_AT, battalionIds: ["a", "b"] });
    const some = desertions([traitor], [battalion("a"), battalion("b"), battalion("c")]);
    expect(some.captains).toEqual([]);
    expect(some.battalions.map((b) => b.id)).toEqual(["c"]);
    const all = desertions([traitor], [battalion("a"), battalion("b")]);
    expect(all.battalions.map((b) => b.id)).toEqual(["b"]);
  });

  it("companhia perde os batalhões que deixaram de existir; a crônica guarda o porquê da lealdade", () => {
    const c = captain({ battalionIds: ["a", "b"] });
    expect(pruneCompanies([c], (id) => id !== "a")[0].battalionIds).toEqual(["b"]);
    const same = [c];
    expect(pruneCompanies(same, () => true)).toBe(same);
    expect(shiftLoyalty(c, 3, 4, "vitória").history.at(-1)).toContain("vitória");
  });
});

describe("o capitão em campo", () => {
  const foes: ContactView[] = [
    { x: 500, y: -100, kind: "TROOP", power: 10 },
    { x: 500, y: 0, kind: "TROOP", power: 10 },
    { x: 500, y: 100, kind: "ARCHER", power: 6 },
  ];
  const squads: CompanySquad[] = [
    { role: "MELEE", center: { x: 100, y: 0 } },
    { role: "MELEE", center: { x: 0, y: 0 } },
    { role: "RIDERS", center: { x: 0, y: 150 } },
  ];

  it("no ataque, cada um vai no mais perto e a cavalaria escolhe os arqueiros", () => {
    const intents = companyIntents("ASSAULT", squads, foes, 3);
    expect(intents[0]).toEqual({ kind: "ATTACK", foe: 1 });
    expect(intents[2]).toEqual({ kind: "ATTACK", foe: 2 });
  });

  it("na linha e flanco, quem está atrás entra por uma das pontas", () => {
    const intents = companyIntents("FLANK", squads, foes, 3);
    expect(intents[0]).toEqual({ kind: "ATTACK", foe: 1 });
    const side = intents[1];
    expect(side.kind === "ATTACK" && side.foe !== 1).toBe(true);
  });

  it("resistir segura o lugar; retirar volta para o Comandante", () => {
    expect(companyIntents("HOLD", squads, foes, 3).every((i) => i.kind === "HOLD")).toBe(true);
    expect(companyIntents("RETREAT", squads, foes, 3).every((i) => i.kind === "FALL_BACK")).toBe(true);
  });

  it("a postura muda até onde ele procura briga", () => {
    const c = captain({ traits: ["BRAVE"] });
    expect(engageRadius(c, "FREE")).toBe(CAPTAINS.ENGAGE.AGGRESSIVE);
    expect(engageRadius(c, "HOLD")).toBe(CAPTAINS.HOLD_RADIUS);
    expect(engageRadius(c, "PURSUE")).toBe(CAPTAINS.PURSUE_RADIUS);
  });

  it("muito menor que o inimigo e antes de lutar, ele recua; com folga, ataca", () => {
    const sight = (ownPower: number) =>
      companyView({ tactics: 3, traits: [], current: null, spent: [], center: { x: 0, y: 0 }, ownPower, ownMorale: 80, strength: 1, squads: squads.map((s) => ({ ...s, size: 8, morale: 80, power: 10 })), contacts: foes, engaged: false });
    expect(choosePlan(sight(5), 260, () => 0.5)).toBe("RETREAT");
    expect(choosePlan(sight(200), 260, () => 0.5)).not.toBe("RETREAT");
  });
});

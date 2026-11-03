import { describe, expect, it } from "vitest";
import { choosePlan, choosePrey, exposedHero, foeCenter, seenPower, type BattleView, type ContactView } from "../../src/game/sim/warMind";

const contact = (kind: ContactView["kind"], x = 0, y = 0, power = 10): ContactView => ({ kind, x, y, power });

const view = (over: Partial<BattleView> = {}): BattleView => ({
  competence: 3,
  traits: [],
  current: null,
  spent: [],
  center: { x: 0, y: 0 },
  ownPower: 100,
  ownMorale: 80,
  strength: 1,
  squads: [{ role: "MELEE", size: 10, morale: 80, power: 60, center: { x: 0, y: 0 } }],
  contacts: [contact("TROOP", 500, 0, 100)],
  engaged: false,
  exposed: false,
  cover: { forest: null, hill: null },
  ...over,
});

/** Sem ruído: a escolha sai só da situação. */
const steady = () => 0;

describe("presa da cavalaria", () => {
  it("prefere arqueiros a infantaria", () => {
    const list = [contact("TROOP", 100), contact("ARCHER", 150)];
    expect(choosePrey(list, { x: 0, y: 0 }, 3)?.kind).toBe("ARCHER");
  });

  it("quem sabe o que faz não joga cavalo em lança firme", () => {
    const list = [contact("SPEAR", 50), contact("TROOP", 300)];
    expect(choosePrey(list, { x: 0, y: 0 }, 3)?.kind).toBe("TROOP");
  });

  it("o novato bate no que está mais perto, mesmo que sejam lanças", () => {
    const list = [contact("SPEAR", 50), contact("TROOP", 300)];
    expect(choosePrey(list, { x: 0, y: 0 }, 1)?.kind).toBe("SPEAR");
  });

  it("só lanças à vista: ainda assim decide", () => {
    expect(choosePrey([contact("SPEAR", 50)], { x: 0, y: 0 }, 3)?.kind).toBe("SPEAR");
  });

  it("batedores e mensageiros não são presa", () => {
    expect(choosePrey([contact("SCOUT", 50), contact("COURIER", 80)], { x: 0, y: 0 }, 3)).toBeNull();
  });
});

describe("plano", () => {
  describe("quem larga a luta", () => {
    const weak = { ownPower: 20, contacts: [contact("TROOP", 500, 0, 200)] };

    it("luta já aberta: ver que o outro é maior não basta", () => {
      expect(choosePlan(view({ ...weak, exposed: true, engaged: true, strength: 0.9 }), 260, steady)).not.toBe("RETREAT");
    });

    it("depois de apanhar de verdade, sai", () => {
      expect(choosePlan(view({ ...weak, exposed: true, engaged: true, strength: 0.5 }), 260, steady)).toBe("RETREAT");
    });

    it("covarde sai antes; bravo fica mais", () => {
      const hurt = { ...weak, exposed: true, engaged: true, strength: 0.65 };
      expect(choosePlan(view({ ...hurt, traits: ["COWARD"] }), 260, steady)).toBe("RETREAT");
      expect(choosePlan(view({ ...hurt, traits: ["AMBITIOUS"] }), 260, steady)).not.toBe("RETREAT");
      expect(choosePlan(view({ ...weak, exposed: true, engaged: true, strength: 0.54, traits: ["BRAVE"] }), 260, steady)).not.toBe("RETREAT");
      expect(choosePlan(view({ ...weak, exposed: true, engaged: true, strength: 0.54, traits: ["AMBITIOUS"] }), 260, steady)).toBe("RETREAT");
    });

    it("numa batalha campal, ninguém foge antes de lutar", () => {
      expect(choosePlan(view({ ...weak, pitched: true }), 260, steady)).not.toBe("RETREAT");
      expect(choosePlan(view({ ...weak, pitched: true, traits: ["COWARD"] }), 260, steady)).not.toBe("RETREAT");
    });
  });

  it("em muito menor número, recua", () => {
    expect(choosePlan(view({ ownPower: 20, contacts: [contact("TROOP", 500, 0, 200)] }), 260, steady)).toBe("RETREAT");
  });

  it("o bravo aguenta mais que o medroso", () => {
    const outnumbered = { ownPower: 50, contacts: [contact("TROOP", 500, 0, 100)] };
    expect(choosePlan(view({ ...outnumbered, traits: ["COWARD"] }), 260, steady)).toBe("RETREAT");
    expect(choosePlan(view({ ...outnumbered, traits: ["BRAVE"] }), 260, steady)).not.toBe("RETREAT");
  });

  it("com dois esquadrões, flanqueia", () => {
    const squads = [
      { role: "MELEE" as const, size: 10, morale: 80, power: 50, center: { x: 0, y: 0 } },
      { role: "MELEE" as const, size: 10, morale: 80, power: 50, center: { x: 0, y: 0 } },
    ];
    expect(choosePlan(view({ squads }), 260, steady)).toBe("FLANK");
  });

  it("Comandante sozinho vira alvo", () => {
    const contacts = [contact("HERO", 300, 0, 40), contact("TROOP", 1500, 0, 60)];
    expect(choosePlan(view({ contacts }), 260, steady)).toBe("DECAPITATE");
  });

  it("cavalaria própria puxa o golpe na retaguarda contra arqueiros", () => {
    const squads = [
      { role: "MELEE" as const, size: 10, morale: 80, power: 50, center: { x: 0, y: 0 } },
      { role: "RIDERS" as const, size: 6, morale: 80, power: 50, center: { x: 0, y: 0 } },
    ];
    const contacts = [contact("ARCHER", 400, 0, 50), contact("ARCHER", 420, 0, 50)];
    expect(choosePlan(view({ squads, contacts, competence: 3 }), 260, steady)).toBe("REAR_STRIKE");
  });

  it("competência baixa não conhece os planos difíceis", () => {
    const squads = [
      { role: "MELEE" as const, size: 10, morale: 80, power: 50, center: { x: 0, y: 0 } },
      { role: "MELEE" as const, size: 10, morale: 80, power: 50, center: { x: 0, y: 0 } },
    ];
    expect(choosePlan(view({ squads, competence: 1 }), 260, steady)).toBe("ASSAULT");
  });
});

describe("o que ele sabe", () => {
  it("batedores não contam na força vista", () => {
    expect(seenPower([contact("SCOUT", 0, 0, 500), contact("TROOP", 0, 0, 10)])).toBe(10);
  });

  it("centro do que foi visto ignora quem não luta", () => {
    expect(foeCenter([contact("SCOUT", 999, 999), contact("TROOP", 100, 0), contact("SPEAR", 200, 0)])).toEqual({ x: 150, y: 0 });
  });

  it("lança perto do Comandante conta como guarda", () => {
    const hero = contact("HERO", 0, 0);
    expect(exposedHero([hero], 260)).toBe(hero);
    expect(exposedHero([hero, contact("SPEAR", 100, 0)], 260)).toBeNull();
  });
});

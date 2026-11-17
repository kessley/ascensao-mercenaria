import { describe, expect, it } from "vitest";
import { approachOf, armorFactor, chargePush, cycleStep, defenseAt, hitChance, pressedHit, pressureCut, scatterPoint, sideDamage, victimAt, volleySpread, type Pressure } from "../../src/game/sim/combatRules";
import { COMBAT } from "../../src/utils/constants";

const at = { x: 0, y: 0 };

describe("lado do golpe", () => {
  // Frente virada para +X (facing 0)
  it("na frente, de lado e por trás", () => {
    expect(approachOf(0, at, { x: 100, y: 0 })).toBe("FRONT");
    expect(approachOf(0, at, { x: 100, y: 40 })).toBe("FRONT");
    expect(approachOf(0, at, { x: 0, y: 100 })).toBe("FLANK");
    expect(approachOf(0, at, { x: 0, y: -100 })).toBe("FLANK");
    expect(approachOf(0, at, { x: -100, y: 0 })).toBe("REAR");
  });

  it("gira junto com a frente", () => {
    expect(approachOf(Math.PI / 2, at, { x: 0, y: 100 })).toBe("FRONT");
    expect(approachOf(Math.PI / 2, at, { x: 0, y: -100 })).toBe("REAR");
    expect(approachOf(Math.PI, at, { x: -100, y: 0 })).toBe("FRONT");
  });

  it("o limite entre frente e flanco é o arco da frente", () => {
    const just = (a: number) => ({ x: Math.cos(a) * 100, y: Math.sin(a) * 100 });
    expect(approachOf(0, at, just(COMBAT.FRONT_ARC - 0.01))).toBe("FRONT");
    expect(approachOf(0, at, just(COMBAT.FRONT_ARC + 0.01))).toBe("FLANK");
    expect(approachOf(0, at, just(COMBAT.REAR_ARC - 0.01))).toBe("FLANK");
    expect(approachOf(0, at, just(COMBAT.REAR_ARC + 0.01))).toBe("REAR");
  });
});

describe("acerto e defesa", () => {
  it("ataque igual à defesa é a chance base", () => {
    expect(hitChance(40, 40, "FRONT")).toBeCloseTo(COMBAT.HIT_BASE);
  });

  it("melhor perícia acerta mais", () => {
    expect(hitChance(60, 40, "FRONT")).toBeGreaterThan(hitChance(40, 40, "FRONT"));
    expect(hitChance(40, 60, "FRONT")).toBeLessThan(hitChance(40, 40, "FRONT"));
  });

  it("de lado acerta mais; por trás, muito mais", () => {
    const front = hitChance(42, 50, "FRONT");
    const flank = hitChance(42, 50, "FLANK");
    const rear = hitChance(42, 50, "REAR");
    expect(flank).toBeGreaterThan(front);
    expect(rear).toBeGreaterThan(flank);
    expect(rear).toBeGreaterThanOrEqual(front + 0.3);
  });

  it("nunca sai dos limites", () => {
    expect(hitChance(0, 100, "FRONT")).toBe(COMBAT.HIT_MIN);
    expect(hitChance(100, 0, "REAR")).toBe(COMBAT.HIT_MAX);
  });

  it("a defesa cai com o lado", () => {
    expect(defenseAt(50, "FRONT")).toBe(50);
    expect(defenseAt(50, "FLANK")).toBeLessThan(50);
    expect(defenseAt(50, "REAR")).toBeLessThan(defenseAt(50, "FLANK"));
  });

  it("apanhar de lado ou por trás dói mais", () => {
    expect(sideDamage("FRONT", false)).toBe(1);
    expect(sideDamage("FLANK", false)).toBeGreaterThan(1);
    expect(sideDamage("REAR", false)).toBeGreaterThan(sideDamage("FLANK", false));
    expect(sideDamage("REAR", true)).toBeGreaterThan(sideDamage("FLANK", true));
    expect(sideDamage("REAR", true)).toBeLessThan(sideDamage("REAR", false));
  });
});

describe("armadura", () => {
  it("segura a fração prometida", () => {
    expect(armorFactor(0, 0)).toBe(1);
    expect(armorFactor(0.5, 0)).toBeCloseTo(0.5);
  });

  it("perfuração ignora parte da armadura", () => {
    expect(armorFactor(0.5, 0.6)).toBeCloseTo(0.8);
    expect(armorFactor(0.5, 1)).toBe(1);
    expect(armorFactor(0.5, 0.6)).toBeGreaterThan(armorFactor(0.5, 0));
  });
});

describe("área das flechas", () => {
  it("cresce com a distância", () => {
    expect(volleySpread(300, 1, 8)).toBeGreaterThan(volleySpread(100, 1, 8));
  });

  it("cresce com o tamanho da unidade: poucos arqueiros concentram o tiro", () => {
    expect(volleySpread(200, 1, 4)).toBeLessThan(volleySpread(200, 1, 8));
    expect(volleySpread(200, 1, 16)).toBeGreaterThan(volleySpread(200, 1, 8));
  });

  it("o tamanho tem limites", () => {
    expect(volleySpread(200, 1, 1000)).toBe(volleySpread(200, 1, 2000));
    expect(volleySpread(200, 1, 1)).toBeGreaterThan(0);
  });

  it("besta (precisa) cobre menos que arco", () => {
    expect(volleySpread(200, 0.55, 8)).toBeLessThan(volleySpread(200, 1, 8));
  });

  it("as flechas caem dentro da elipse, mais compridas na linha do tiro", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const from = { x: 0, y: 0 };
    const aim = { x: 300, y: 0 };
    const spread = 50;
    let maxAlong = 0;
    let maxAcross = 0;
    for (let i = 0; i < 2000; i++) {
      const p = scatterPoint(from, aim, spread, random);
      maxAlong = Math.max(maxAlong, Math.abs(p.x - aim.x));
      maxAcross = Math.max(maxAcross, Math.abs(p.y - aim.y));
    }
    expect(maxAlong).toBeLessThanOrEqual(spread * COMBAT.SPREAD_LONG + 0.001);
    expect(maxAcross).toBeLessThanOrEqual(spread + 0.001);
    expect(maxAlong).toBeGreaterThan(maxAcross);
  });
});

describe("em quem a flecha cai", () => {
  const unit = (x: number, y: number, radius = 9) => ({ x, y, radius });

  it("ninguém perto, ninguém atingido", () => {
    expect(victimAt([unit(100, 100)], at)).toBeNull();
  });

  it("acerta quem está sob o ponto", () => {
    const u = unit(5, 0);
    expect(victimAt([u], at)).toBe(u);
  });

  it("entre dois, o mais perto", () => {
    const near = unit(3, 0);
    const far = unit(11, 0);
    expect(victimAt([far, near], at)).toBe(near);
  });
});

describe("investida", () => {
  it("o pesado empurra mais", () => {
    expect(chargePush(16, 3.2, 1)).toBeGreaterThan(chargePush(16, 1, 1));
  });

  it("quem é pesado sai menos do lugar", () => {
    expect(chargePush(16, 2, 3)).toBeLessThan(chargePush(16, 2, 1));
  });

  it("ciclo: bate, fica um tempo, sai e, ao chegar, volta", () => {
    expect(cycleStep({ phase: "IN", hitAt: null }, 5000, false)).toBe("WAIT");
    expect(cycleStep({ phase: "IN", hitAt: 1000 }, 1000 + COMBAT.CYCLE_HIT_MS - 1, false)).toBe("WAIT");
    expect(cycleStep({ phase: "IN", hitAt: 1000 }, 1000 + COMBAT.CYCLE_HIT_MS, false)).toBe("WITHDRAW");
    expect(cycleStep({ phase: "OUT", hitAt: null }, 5000, false)).toBe("WAIT");
    expect(cycleStep({ phase: "OUT", hitAt: null }, 5000, true)).toBe("CHARGE");
  });
});

describe("pressão (Marco 24): ninguém segura uma multidão", () => {
  const p = (o: Partial<Pressure>): Pressure => ({ attackers: 1, front: 1, inRank: false, shieldWall: false, ...o });

  it("um atacante não pesa; cada um a mais tira 20% da defesa na fileira e 30% sozinho", () => {
    expect(pressureCut(p({}))).toBe(0);
    expect(pressureCut(p({ attackers: 2, front: 2, inRank: true }))).toBeCloseTo(0.2);
    expect(pressureCut(p({ attackers: 3, front: 1, inRank: true }))).toBeCloseTo(0.4);
    expect(pressureCut(p({ attackers: 2, front: 2 }))).toBeCloseTo(0.3);
    expect(pressureCut(p({ attackers: 3, front: 1 }))).toBeCloseTo(0.6);
  });

  it("na fileira o teto é 60%; sozinho, 90%", () => {
    expect(pressureCut(p({ attackers: 6, front: 6, inRank: true }))).toBeCloseTo(COMBAT.PRESSURE_CAP_RANK);
    expect(pressureCut(p({ attackers: 6, front: 6 }))).toBeCloseTo(COMBAT.PRESSURE_CAP_ALONE);
  });

  it("na parede de escudos, pela frente só dois contam; pelo lado, todos", () => {
    expect(pressureCut(p({ attackers: 5, front: 5, inRank: true, shieldWall: true }))).toBeCloseTo(0.2);
    expect(pressureCut(p({ attackers: 5, front: 3, inRank: true, shieldWall: true }))).toBeCloseTo(0.6);
  });

  it("o Comandante (defesa 70) com 4 goblins (ataque 30) batendo junto apara menos de 2 golpes em 10", () => {
    const one = hitChance(30, 70, "FRONT");
    expect(1 - pressedHit(one, pressureCut(p({})))).toBeCloseTo(0.85);
    expect(1 - pressedHit(one, pressureCut(p({ attackers: 4, front: 4 })))).toBeLessThan(0.2);
    // Com 3, ainda apara um terço: a queda é gradual
    expect(1 - pressedHit(one, pressureCut(p({ attackers: 3, front: 3 })))).toBeGreaterThan(0.3);
  });

  it("a pressão corta o aparo, não a perícia: a chance de acerto nunca cai", () => {
    for (const c of [0.15, 0.5, 0.92]) for (const cut of [0, 0.3, 0.9]) expect(pressedHit(c, cut)).toBeGreaterThanOrEqual(c);
    expect(pressedHit(0.5, 0)).toBe(0.5);
  });
});

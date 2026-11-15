import { describe, expect, it } from "vitest";
import {
  BARE,
  Burst,
  arrowSurface,
  census,
  groundKind,
  hoovesLevel,
  marchLevel,
  parrySurface,
  roarLevel,
  weaponClass,
  woundSurface,
  type FieldUnit,
  type StrikeLook,
} from "../../src/audio/hitRules";

const look = (o: Partial<StrikeLook>): StrikeLook => ({ ...BARE, ...o });
const swordsman = look({ weapon: "SWORD", shield: true, armor: 1 });
const axeman = look({ weapon: "AXE" });
const spearman = look({ weapon: "SPEAR", shield: true });
const knight = look({ weapon: "LANCE", armor: 2, shield: true });
const peasant = look({ weapon: "HOE" });
const wolf = look({ beast: true });
const skeleton = look({ weapon: "SWORD", skeleton: true, armor: 2 });
const wagon = look({ vehicle: true });

describe("com o que se bate", () => {
  it("espada é lâmina, machado é machado, lança e dardo são ponta", () => {
    expect(weaponClass(swordsman)).toBe("blade");
    expect(weaponClass(axeman)).toBe("axe");
    expect(weaponClass(spearman)).toBe("spear");
    expect(weaponClass(knight)).toBe("spear");
    expect(weaponClass(look({ weapon: "JAVELIN" }))).toBe("spear");
  });

  it("enxada, cajado e mão vazia são pau; bicho é dente", () => {
    expect(weaponClass(peasant)).toBe("club");
    expect(weaponClass(look({ weapon: "STAFF" }))).toBe("club");
    expect(weaponClass(BARE)).toBe("club");
    expect(weaponClass(wolf)).toBe("claw");
  });
});

describe("o golpe que não entrou", () => {
  it("de frente contra escudo, bate no escudo", () => {
    expect(parrySurface(axeman, swordsman, true)).toBe("shield");
  });

  it("pelo lado ou por trás o escudo não está lá: aço no aço", () => {
    expect(parrySurface(axeman, swordsman, false)).toBe("steel");
  });

  it("sem escudo, metal contra metal é aço no aço", () => {
    expect(parrySurface(swordsman, axeman, true)).toBe("steel");
  });

  it("pau e dente que erram cortam o ar; metal contra quem não tem ferro, também", () => {
    expect(parrySurface(peasant, axeman, true)).toBe("miss");
    expect(parrySurface(wolf, axeman, true)).toBe("miss");
    expect(parrySurface(swordsman, peasant, true)).toBe("miss");
  });

  it("contra carroça é sempre madeira", () => {
    expect(parrySurface(swordsman, wagon, true)).toBe("wood");
  });
});

describe("o golpe que entrou", () => {
  it("soa conforme o que o alvo veste", () => {
    expect(woundSurface(knight)).toBe("plate");
    expect(woundSurface(swordsman)).toBe("mail");
    expect(woundSurface(axeman)).toBe("flesh");
  });

  it("morto-vivo é osso, mesmo de armadura; carroça é madeira", () => {
    expect(woundSurface(skeleton)).toBe("bone");
    expect(woundSurface(wagon)).toBe("wood");
  });
});

describe("onde a flecha cai", () => {
  it("sem ninguém, no chão", () => {
    expect(arrowSurface(null, false)).toBe("ground");
  });

  it("parada pelo escudo, no escudo; sem escudo, parar não muda nada", () => {
    expect(arrowSurface(swordsman, true)).toBe("shield");
    expect(arrowSurface(axeman, true)).toBe("flesh");
  });

  it("na placa retine, na carroça crava, no resto entra", () => {
    expect(arrowSurface(knight, false)).toBe("plate");
    expect(arrowSurface(wagon, false)).toBe("wood");
    expect(arrowSurface(swordsman, false)).toBe("flesh");
  });
});

describe("a salva", () => {
  it("cinco tiros quase juntos são uma salva, avisada uma vez", () => {
    const b = new Burst(180, 5);
    const fired = [0, 20, 40, 60, 80, 100, 120].map((t) => b.hit(t));
    expect(fired).toEqual([false, false, false, false, true, false, false]);
  });

  it("tiros espaçados não são salva", () => {
    const b = new Burst(180, 5);
    expect([0, 100, 200, 300, 400, 500, 600].map((t) => b.hit(t)).some(Boolean)).toBe(false);
  });

  it("passada a janela, outra salva pode vir", () => {
    const b = new Burst(180, 5);
    for (const t of [0, 10, 20, 30, 40]) b.hit(t);
    expect([1000, 1010, 1020, 1030, 1040].map((t) => b.hit(t))).toEqual([false, false, false, false, true]);
  });
});

describe("o chão debaixo da coluna", () => {
  const dry = { snow: false, muddy: false, paved: false };

  it("a ponte ganha de tudo", () => {
    expect(groundKind("BRIDGE", { snow: true, muddy: true, paved: true })).toBe("bridge");
  });

  it("estrada e rua são pedra, mesmo com neve ou chuva", () => {
    expect(groundKind("GRASS", { ...dry, paved: true })).toBe("stone");
    expect(groundKind("GRASS", { snow: true, muddy: true, paved: true })).toBe("stone");
  });

  it("neve e gelo são neve; lama, pântano, vau e chuva são lama", () => {
    expect(groundKind("GRASS", { ...dry, snow: true })).toBe("snow");
    expect(groundKind("ICE", dry)).toBe("snow");
    expect(groundKind("MUD", dry)).toBe("mud");
    expect(groundKind("SWAMP", dry)).toBe("mud");
    expect(groundKind("SHALLOW", dry)).toBe("mud");
    expect(groundKind("GRASS", { ...dry, muddy: true })).toBe("mud");
  });

  it("o resto é grama", () => {
    expect(groundKind("GRASS", dry)).toBe("grass");
    expect(groundKind("HILL", dry)).toBe("grass");
    expect(groundKind("FOREST", dry)).toBe("grass");
  });
});

describe("quem se ouve daqui", () => {
  const unit = (o: Partial<FieldUnit>): FieldUnit => ({ x: 0, y: 0, moving: false, mounted: false, fighting: false, fast: false, ...o });
  const everywhere = () => 1;

  it("parado e sem lutar não entra na conta", () => {
    const c = census([unit({}), unit({})], everywhere);
    expect(c.fighting.n + c.hooves.n + c.marching.n).toBe(0);
  });

  it("separa quem luta, quem cavalga e quem marcha", () => {
    const c = census(
      [unit({ fighting: true }), unit({ fighting: true }), unit({ moving: true, mounted: true }), unit({ moving: true }), unit({ moving: true }), unit({ moving: true })],
      everywhere,
    );
    expect(c.fighting.n).toBe(2);
    expect(c.hooves.n).toBe(1);
    expect(c.marching.n).toBe(3);
  });

  it("quem está longe pesa menos, e quem não se ouve não conta", () => {
    const hear = (x: number) => (x > 1000 ? 0 : x > 500 ? 0.25 : 1);
    const c = census([unit({ fighting: true, x: 0 }), unit({ fighting: true, x: 600 }), unit({ fighting: true, x: 2000 })], hear);
    expect(c.fighting.n).toBeCloseTo(1.25);
  });

  it("o som vem de onde está a maioria", () => {
    const c = census([unit({ fighting: true, x: 100 }), unit({ fighting: true, x: 100 }), unit({ fighting: true, x: 100 }), unit({ fighting: true, x: -300 })], everywhere);
    expect(c.fighting.x).toBeCloseTo(0);
    const far = census([unit({ moving: true, x: 400, y: 50 }), unit({ moving: true, x: 600, y: 150 })], everywhere);
    expect(far.marching.x).toBeCloseTo(500);
    expect(far.marching.y).toBeCloseTo(100);
  });

  it("o galope é a parte dos cavalos que vai depressa", () => {
    const c = census([unit({ moving: true, mounted: true, fast: true }), unit({ moving: true, mounted: true }), unit({ moving: true, mounted: true }), unit({ moving: true, mounted: true })], everywhere);
    expect(c.gallop).toBeCloseTo(0.25);
    expect(census([], everywhere).gallop).toBe(0);
  });
});

describe("quanto se ouve", () => {
  it("dois brigando não fazem rugido; a batalha cheia faz o rugido inteiro", () => {
    expect(roarLevel(0)).toBe(0);
    expect(roarLevel(2)).toBe(0);
    expect(roarLevel(8)).toBeGreaterThan(0);
    expect(roarLevel(120)).toBeCloseTo(1);
    expect(roarLevel(1600)).toBe(1);
  });

  it("o rugido cresce com o número de quem luta, sem nunca passar do cheio", () => {
    let last = 0;
    for (const n of [4, 8, 16, 32, 64, 128, 400, 1600]) {
      const v = roarLevel(n);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(1);
      last = v;
    }
  });

  it("uma escaramuça de dez soa bem menos que uma batalha de cem", () => {
    expect(roarLevel(10)).toBeLessThan(roarLevel(100) * 0.6);
  });

  it("um cavalo já se ouve; meia dúzia de pés ainda não é coluna", () => {
    expect(hoovesLevel(1)).toBeGreaterThan(0);
    expect(hoovesLevel(40)).toBeCloseTo(1);
    expect(marchLevel(3)).toBe(0);
    expect(marchLevel(8)).toBeGreaterThan(0);
    expect(marchLevel(150)).toBeCloseTo(1);
  });
});

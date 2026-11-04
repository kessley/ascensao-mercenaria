import { describe, expect, it } from "vitest";
import { seeded } from "../../src/game/art/pixel";
import type { NobleTrait } from "../../src/game/sim/nobility";
import type { EnemyKind } from "../../src/utils/constants";
import { BOSS_HEROES, captainFromCaptive, duelSkill, heroTemper, heroWords, joinChance, rollHero, seeksDuel } from "../../src/game/data/heroes";

/** Os valores de mão que saem em muitas fichas do mesmo tipo. */
function duels(kind: EnemyKind, base: number, trait: NobleTrait | null, chief: boolean): Set<number> {
  const random = seeded(7);
  const out = new Set<number>();
  for (let i = 0; i < 200; i++) out.add(rollHero(kind, base, trait, chief, undefined, random).duel);
  return out;
}

describe("heróis do outro lado", () => {
  it("a mão cresce com o tipo de bando: goblins fracos, exércitos fortes; o chefe sabe mais que os capitães", () => {
    expect([...duels("GOBLIN_CHIEF", 1, null, true)].sort()).toEqual([1, 2]);
    expect([...duels("BANDIT_CHIEF", 2, null, true)].sort()).toEqual([2, 3]);
    expect([...duels("SERGEANT", 3, null, true)].sort()).toEqual([3, 4]);
    expect([...duels("CAPTAIN", 3, null, false)].sort()).toEqual([2, 3]);
    // Orcs e cavaleiros mortos já nascem melhores
    expect(Math.min(...duels("ORC_CHIEF", 2, null, true))).toBe(3);
  });

  it("um nobre de verdade traz a própria mão", () => {
    expect(rollHero("LORD", 3, "BRAVE", true, 9).duel).toBe(5);
    expect(rollHero("LORD", 3, "BRAVE", true, 2).duel).toBe(1);
  });

  it("cada oficial tem a arma do seu povo", () => {
    expect(rollHero("ORC_CHIEF", 2, null, true).weapon).toBe("AXE");
    expect(rollHero("SERGEANT", 3, null, true).weapon).toBe("SHIELD");
    expect(rollHero("GOBLIN_CHIEF", 1, null, true).weapon).toBe("SPEAR");
  });

  it("o temperamento sai do traço", () => {
    expect(heroTemper({ trait: "BRAVE" })).toBe("AGGRESSIVE");
    expect(heroTemper({ trait: "CRUEL" })).toBe("AGGRESSIVE");
    expect(heroTemper({ trait: "CUNNING" })).toBe("TREACHEROUS");
    expect(heroTemper({ trait: "COWARD" })).toBe("PATIENT");
    expect(heroTemper({ trait: null })).toBe("STEADY");
  });

  it("procura duelo quem tem mão 3 ou mais e procura briga", () => {
    expect(seeksDuel({ duel: 3, trait: "BRAVE", weapon: "SWORD" })).toBe(true);
    expect(seeksDuel({ duel: 4, trait: "CRUEL", weapon: "AXE" })).toBe(true);
    expect(seeksDuel({ duel: 5, trait: "AMBITIOUS", weapon: "SWORD" })).toBe(true);
    expect(seeksDuel({ duel: 2, trait: "BRAVE", weapon: "SWORD" })).toBe(false);
    expect(seeksDuel({ duel: 5, trait: "COWARD", weapon: "SWORD" })).toBe(false);
    expect(seeksDuel({ duel: 5, trait: "HONORABLE", weapon: "SWORD" })).toBe(false);
  });

  it("o chefe de calamidade que luta de perto procura o Comandante", () => {
    const boss = BOSS_HEROES.ORC_WARLORD;
    expect(boss && seeksDuel(boss)).toBe(true);
    expect(BOSS_HEROES.NECROMANCER).toBeUndefined();
  });

  it("a mão do duelo vira a da IA (1 a 10), e os batedores contam a ficha em palavras", () => {
    expect(duelSkill(1)).toBe(2);
    expect(duelSkill(5)).toBe(10);
    expect(heroWords({ duel: 4, trait: "CRUEL", weapon: "AXE" })).toBe("Duelo 4, de machado, cruel");
  });
});

describe("quem muda de lado", () => {
  it("o honrado prefere a corda, o ganancioso ouve a oferta, e a fama do bando convence", () => {
    const plain = joinChance({ trait: null }, 20);
    expect(joinChance({ trait: "HONORABLE" }, 20)).toBeLessThan(plain);
    expect(joinChance({ trait: "GREEDY" }, 20)).toBeGreaterThan(plain);
    expect(joinChance({ trait: null }, 90)).toBeGreaterThan(plain);
    expect(joinChance(undefined, 0)).toBeGreaterThan(0);
    expect(joinChance({ trait: "GREEDY" }, 100)).toBeLessThanOrEqual(0.9);
    expect(joinChance({ trait: "HONORABLE" }, 0)).toBeGreaterThanOrEqual(0.05);
  });

  it("vira capitão com a mão que mostrou em campo, sem companhia e com lealdade baixa", () => {
    const c = captainFromCaptive({ name: "Lugdush Faca-Cega", hero: { duel: 4, trait: "CRUEL", weapon: "AXE" } }, 12, seeded(3));
    expect(c.name).toBe("Lugdush");
    expect(c.epithet).toBe("Faca-Cega");
    expect(c.origin).toBe("CAPTURED");
    expect(c.duel).toBe(4);
    expect(c.traits).toEqual(["BLOODTHIRSTY"]);
    expect(c.battalionIds).toEqual([]);
    expect(c.loyalty).toBeLessThan(40);
    expect(c.hireCost).toBe(0);
    expect(c.history[0]).toContain("Dia 12");
  });

  it("sem ficha nem sobrenome, ainda vira capitão", () => {
    const c = captainFromCaptive({ name: "Ulf" }, 1, seeded(1));
    expect(c.name).toBe("Ulf");
    expect(c.epithet.length).toBeGreaterThan(0);
    expect(c.duel).toBeGreaterThanOrEqual(1);
  });
});

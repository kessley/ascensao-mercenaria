import { describe, expect, it } from "vitest";
import { generateCaptain } from "../../src/game/data/captains";
import { generateLieutenant } from "../../src/game/data/lieutenants";
import { BAND_HOME, CULTURE_IDS, bandMix, cultureOf, folkOf, foreignRule, mainCulture, mixText, officerCulture, pickCulture, rulerCulture } from "../../src/game/sim/culture";
import { loyaltyTarget } from "../../src/game/sim/kingdoms";
import type { Settlement } from "../../src/game/sim/realm";
import { updateMorale } from "../../src/game/systems/MoraleSystem";
import { isFemaleName } from "../../src/game/worldgen/names";
import { CULTURE } from "../../src/utils/constants";

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe("cultura (Marco 23, parte 1)", () => {
  it("cada povoado tem a sua gente: quase toda da terra, mais estrangeiros nos portos e nas capitais", () => {
    let village = 0;
    let port = 0;
    for (let i = 0; i < 200; i++) {
      const v = folkOf({ id: `v${i}`, kind: "VILLAGE" }, "JADE");
      const p = folkOf({ id: `p${i}`, kind: "CAPITAL", port: true }, "JADE");
      expect(sum(v)).toBeCloseTo(1, 1);
      expect(sum(p)).toBeCloseTo(1, 1);
      expect(mainCulture(v)).toBe("JADE");
      expect(mainCulture(p)).toBe("JADE");
      village += 1 - v.JADE;
      port += 1 - p.JADE;
    }
    expect(port / 200).toBeGreaterThan((village / 200) * 4);
    // Sempre a mesma gente para o mesmo povoado
    expect(folkOf({ id: "x", kind: "CITY", port: true }, "SANDS")).toEqual(folkOf({ id: "x", kind: "CITY", port: true }, "SANDS"));
    // A vila da sede é metade gente do bando
    expect(folkOf({ id: "sede", kind: "VILLAGE", seat: true }, "ISLES").REALMS).toBeGreaterThan(0.4);
    expect(mixText({ REALMS: 0.1, SANDS: 0, ISLES: 0, JADE: 0.9 })).toBe("90% gente de jade, 10% gente dos reinos");
  });

  it("sorteia gente conforme a mistura", () => {
    const mix = { REALMS: 0.25, SANDS: 0.25, ISLES: 0.25, JADE: 0.25 };
    expect(CULTURE_IDS.map((_, i) => pickCulture(mix, i * 0.25 + 0.1))).toEqual(["REALMS", "SANDS", "ISLES", "JADE"]);
  });

  it("povoado governado por gente de fora perde lealdade", () => {
    const folk = folkOf({ id: "t1", kind: "CITY" }, "SANDS");
    expect(rulerCulture("PLAYER", "SANDS", "REALMS")).toBe("REALMS");
    expect(rulerCulture("F1", "SANDS", "REALMS")).toBe("SANDS");
    const penalty = foreignRule(folk, "REALMS");
    expect(penalty).toBeGreaterThan(CULTURE.FOREIGN_RULE * 0.8);
    expect(foreignRule(folk, "SANDS")).toBe(0);
    // Na conta da lealdade
    const t = { kind: "CITY", owner: "PLAYER", taxRate: 1, econ: { famine: false, sol: 60 }, lastRaidDay: null, garrison: 0 } as unknown as Settlement;
    const ctx = { honor: 50, fear: 0, levy: 0, weariness: 0 };
    expect(loyaltyTarget(t, 10, ctx) - loyaltyTarget(t, 10, { ...ctx, foreign: penalty })).toBeCloseTo(penalty, 5);
  });

  it("quem entra no bando vem da terra onde ele está, e uns da terra natal", () => {
    const abroad = Array.from({ length: 100 }, (_, i) => officerCulture(i / 100, "ISLES"));
    expect(abroad.filter((c) => c === "ISLES").length).toBe(100 - CULTURE.OFFICER_FROM_HOME * 100);
    expect(abroad.filter((c) => c === BAND_HOME).length).toBe(CULTURE.OFFICER_FROM_HOME * 100);
    const home = Array.from({ length: 100 }, (_, i) => officerCulture(i / 100, BAND_HOME));
    expect(home.filter((c) => c === BAND_HOME).length).toBe(90);
    expect(new Set(home).size).toBe(4);
    // O tenente de outra terra tem nome de lá
    const lt = generateLieutenant(3, "SANDS");
    expect(lt.culture).toBe("SANDS");
    expect(isFemaleName(lt.name) || ["Harun", "Yusuf", "Tariq", "Khalid", "Idris", "Samir", "Malik", "Rashid", "Zayd", "Faris", "Omar", "Nasir"].includes(lt.name)).toBe(true);
    expect(lt.backstory).toContain("Emirados das Areias");
    expect(generateCaptain(3, "NOBLE", "JADE").culture).toBe("JADE");
    // Quem é de antes do Marco 23 é da terra natal
    expect(cultureOf({})).toBe(BAND_HOME);
  });

  it("na batalha, o tenente da mesma gente da tropa segura mais a moral", () => {
    const group = (kinship: number) => ({
      isDestroyed: false,
      pendingDeaths: 2,
      center: { x: 0, y: 0 },
      soldiers: [],
      facing: 0,
      morale: 80,
      panicking: false,
      mods: { moraleLoss: 1 },
      startingCount: 40,
      pendingShock: 0,
      flanked: false,
      flankShockAt: 0,
      leaderPassive: null,
      kinship,
      fatigueRecovery: 1,
      panic() {},
      rally() {},
    });
    const stranger = group(1);
    const kin = group(CULTURE.KIN_LIEUTENANT);
    updateMorale(stranger, [], null, 0, 0);
    updateMorale(kin, [], null, 0, 0);
    expect(80 - kin.morale).toBeCloseTo((80 - stranger.morale) * CULTURE.KIN_LIEUTENANT, 5);
  });

  it("a gente do bando conta os soldados de cada terra", () => {
    const mix = bandMix([
      { soldiers: 30 },
      { soldiers: 10, culture: "JADE" },
    ]);
    expect(mix.REALMS).toBeCloseTo(0.75);
    expect(mix.JADE).toBeCloseTo(0.25);
    expect(bandMix([]).REALMS).toBe(1);
  });
});

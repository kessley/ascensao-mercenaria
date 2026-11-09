import { describe, expect, it } from "vitest";
import { applyCampEvent, pickCampEvent, type CampContext } from "../../src/game/sim/campEvents";
import {
  FAITH_IDS,
  addFavor,
  chaplainBonus,
  clash,
  courtVoice,
  decayFavor,
  factionFaith,
  faithCalendar,
  faithMix,
  faithOf,
  fastEnds,
  fastKey,
  friction,
  isFasting,
  isFeast,
  isHolyDay,
  keptToday,
  nativeFaith,
  pickFaith,
  preacherShare,
} from "../../src/game/sim/faith";
import { eatDay } from "../../src/game/sim/logistics";
import { updateMorale } from "../../src/game/systems/MoraleSystem";
import type { BattalionData } from "../../src/store/useGameStore";
import { FAITH } from "../../src/utils/constants";
import { campMoraleBonus } from "../../src/utils/economy";

const battalion = (id: string, soldiers = 9, extra: Partial<BattalionData> = {}): BattalionData => ({
  id,
  name: id,
  troopType: "INFANTRY",
  formation: "LINE",
  level: 1,
  xp: 0,
  skillPoints: 0,
  skills: [],
  equipment: { weapon: 0, armor: 0 },
  totalKills: 0,
  soldiers,
  maxSoldiers: soldiers,
  ...extra,
});

describe("fés (Marco 23, parte 2)", () => {
  it("cada cultura tem a sua fé, e a Palavra Nova corre entre todas", () => {
    expect(nativeFaith("REALMS")).toBe("FLAME");
    expect(nativeFaith("SANDS")).toBe("VEIL");
    expect(nativeFaith("ISLES")).toBe("TIDE");
    expect(nativeFaith("JADE")).toBe("PATH");
    // Quem é de antes do Marco 23 segue a fé da sua terra
    expect(faithOf({})).toBe("FLAME");
    expect(faithOf({ culture: "JADE" })).toBe("PATH");
    expect(faithOf({ culture: "JADE", faith: "WORD" })).toBe("WORD");
    // Os pregadores: poucos em toda parte, muitos onde o rei se converteu
    expect(pickFaith("SANDS", preacherShare(null), FAITH.PREACHER_SHARE - 0.01)).toBe("WORD");
    expect(pickFaith("SANDS", preacherShare(null), FAITH.PREACHER_SHARE + 0.01)).toBe("VEIL");
    expect(pickFaith("SANDS", preacherShare("WORD"), 0.3)).toBe("WORD");
    expect(factionFaith({}, "ISLES")).toBe("TIDE");
    expect(factionFaith({ faith: "WORD" }, "ISLES")).toBe("WORD");
    // A Palavra briga com todas; a Chama e o Véu são rivais
    for (const f of FAITH_IDS) if (f !== "WORD") expect(clash("WORD", f)).toBe(true);
    expect(clash("FLAME", "VEIL")).toBe(true);
    expect(clash("TIDE", "PATH")).toBe(false);
  });

  it("o calendário: dia santo a cada 10 dias, o jejum de 5 dias e uma festa por ano", () => {
    const year = 80;
    const holy = Array.from({ length: year }, (_, i) => i + 1).filter((d) => isHolyDay("FLAME", d));
    expect(holy.length).toBe(year / FAITH.HOLY_EVERY);
    expect(holy[1] - holy[0]).toBe(FAITH.HOLY_EVERY);
    // Quem não guarda o dia santo não tem dia santo
    expect(Array.from({ length: year }, (_, i) => i + 1).some((d) => isHolyDay("TIDE", d))).toBe(false);
    // O Jejum das Estrelas: 5 dias do verão; termina no 5º
    const fast = Array.from({ length: year }, (_, i) => i + 1).filter((d) => isFasting("VEIL", d));
    expect(fast).toEqual([15, 16, 17, 18, 19]);
    expect(fastEnds("VEIL", 19)).toBe(true);
    expect(isFasting("FLAME", 16)).toBe(false);
    expect(Array.from({ length: year }, (_, i) => i + 1).filter((d) => isFeast("VEIL", d))).toEqual([20]);
    // Quanto falta, a partir de hoje
    expect(faithCalendar("VEIL", 15)).toMatchObject({ fast: 0, feast: 5 });
    expect(faithCalendar("TIDE", 1).holy).toBeNull();
    // O jejum quebrado não conta mais neste ano
    expect(keptToday(16, []).fasting.has("VEIL")).toBe(true);
    expect(keptToday(16, [fastKey("VEIL", 16)]).fasting.has("VEIL")).toBe(false);
    expect(keptToday(16 + year, [fastKey("VEIL", 16)]).fasting.has("VEIL")).toBe(true);
  });

  it("no jejum os fiéis comem a metade, em campo e no acampamento", () => {
    const fed = eatDay(100, 0, [battalion("a", 18, { pack: 10 })], [], new Set(), true, false);
    const fasted = eatDay(100, 0, [battalion("a", 18, { pack: 10 })], [], new Set(), true, false, 1, new Set(["a"]));
    // O Comandante (1 ração, da mochila) não jejua
    expect(10 - (fasted.battalions[0].pack ?? 0) - 1).toBeCloseTo((10 - (fed.battalions[0].pack ?? 0) - 1) * FAITH.FAST_SHARE, 5);
    const camp = eatDay(100, 0, [battalion("a", 40, { pack: 99 })], [], new Set(), false, false);
    const campFast = eatDay(100, 0, [battalion("a", 40, { pack: 99 })], [], new Set(), false, false, 1, new Set(["a"]));
    expect(campFast.rations).toBeGreaterThan(camp.rations);
  });

  it("fés que brigam no bando azedam o humor; o altar e o templo acalmam", () => {
    const mixed = faithMix([battalion("a", 10), battalion("b", 10, { faith: "WORD" })]);
    expect(mixed.FLAME).toBeCloseTo(0.5);
    const none = { altar: false, temple: false };
    expect(friction(mixed, none)).toEqual({ pairs: [["FLAME", "WORD"]], mood: -FAITH.FRICTION_MOOD });
    expect(friction(mixed, { altar: true, temple: false }).mood).toBe(-FAITH.FRICTION_MOOD / 2);
    expect(friction(mixed, { altar: true, temple: true }).mood).toBe(-0);
    // Quem não briga convive
    expect(friction(faithMix([battalion("a", 10), battalion("b", 10, { culture: "ISLES" })]), none).pairs).toEqual([]);
    // Um pregador sozinho num bando grande não chega a brigar
    expect(friction(faithMix([battalion("a", 60), battalion("b", 8, { faith: "WORD" })]), none).pairs).toEqual([]);
  });

  it("o capelão anima os da fé dele, um pouco os outros, e nada os rivais", () => {
    expect(chaplainBonus("FLAME", "FLAME")).toBe(FAITH.CHAPLAIN_SAME);
    expect(chaplainBonus("FLAME", "TIDE")).toBe(FAITH.CHAPLAIN_OTHER);
    expect(chaplainBonus("FLAME", "VEIL")).toBe(0);
    expect(chaplainBonus(null, "FLAME")).toBe(0);
    const followers = [{ id: "c", role: "CHAPLAIN" as const, name: "Bento", since: 1, faith: "WORD" as const }];
    expect(campMoraleBonus(5, followers, "WORD")).toBe(5 + FAITH.CHAPLAIN_SAME);
    expect(campMoraleBonus(5, followers, "FLAME")).toBe(5);
    // Capelão de antes do Marco 23 (sem fé) e quem pergunta sem fé: como antes, +10
    expect(campMoraleBonus(0, [{ id: "c", role: "CHAPLAIN", name: "Bento", since: 1 }])).toBe(FAITH.CHAPLAIN_SAME);
  });

  it("o favor dos templos: soma, tem limite, esquece devagar e fala na corte", () => {
    let favor = addFavor({}, "FLAME", 30);
    favor = addFavor(favor, "FLAME", 90);
    expect(favor.FLAME).toBe(100);
    expect(decayFavor(favor).FLAME).toBeLessThan(100);
    expect(decayFavor({ VEIL: 0 }).VEIL).toBeUndefined();
    expect(courtVoice(favor, "FLAME")).toBe(100 * FAITH.COURT_VOICE);
    expect(courtVoice(undefined, "FLAME")).toBe(0);
    expect(courtVoice(addFavor({}, "WORD", -40), "WORD")).toBe(-40 * FAITH.COURT_VOICE);
  });

  it("no dia santo, a tropa da fé perde a moral mais depressa", () => {
    const group = (devotion: number) => ({
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
      devotion,
      fatigueRecovery: 1,
      panic() {},
      rally() {},
    });
    const calm = group(1);
    const holy = group(FAITH.HOLY_RELUCTANCE);
    updateMorale(calm, [], null, 0, 0);
    updateMorale(holy, [], null, 0, 0);
    expect(80 - holy.morale).toBeCloseTo((80 - calm.morale) * FAITH.HOLY_RELUCTANCE, 5);
  });

  it("a briga de fé no acampamento, e o capelão que chega é da fé de mais gente", () => {
    const ctx: CampContext = {
      day: 5,
      gold: 100,
      rations: 0,
      debt: 0,
      battalions: [battalion("a", 10), battalion("b", 12, { faith: "WORD" })],
      lieutenants: [],
      followers: [],
      honor: 50,
      campMood: 0,
      bonds: {},
      arrearsWeeks: 0,
      hungryDays: 0,
      pendingMutiny: false,
      lastVictoryDay: null,
      bandName: "Teste",
    };
    let quarrel = null;
    for (let i = 0; i < 200 && !quarrel; i++) {
      const e = pickCampEvent(ctx);
      if (e?.kind === "FAITH_QUARREL") quarrel = e;
    }
    expect(quarrel).not.toBeNull();
    if (!quarrel) return;
    expect(applyCampEvent(ctx, quarrel, 1).ctx.campMood).toBe(-5);
    const join = applyCampEvent(ctx, { id: "x", kind: "FOLLOWER", title: "", text: "", options: [], data: { role: "CHAPLAIN" } }, 0);
    expect(join.ctx.followers[0].faith).toBe("WORD");
  });
});

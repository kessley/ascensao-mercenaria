import { describe, expect, it } from "vitest";
import { pickCampEvent, type CampContext } from "../../src/game/sim/campEvents";
import {
  barrierOf,
  fluencyOf,
  garble,
  heardNote,
  hireTongues,
  isFluent,
  learnDay,
  losesDetail,
  officerTongues,
  orderVoice,
  priceMargin,
  voiceFor,
  type VoiceCtx,
} from "../../src/game/sim/language";
import { quote } from "../../src/game/sim/market";
import { wordIn } from "../../src/game/worldgen/names";
import { LANGUAGE } from "../../src/utils/constants";

const officer = (name: string, culture: VoiceCtx["captains"][number]["culture"], tongues?: VoiceCtx["captains"][number]["tongues"]) => ({ name, culture, tongues });

describe("línguas (Marco 23, parte 3)", () => {
  it("o Comandante fala a língua dele inteira, e as outras o quanto aprendeu", () => {
    expect(fluencyOf({}, "REALMS")).toBe(100);
    expect(fluencyOf({ culture: "SANDS" }, "SANDS")).toBe(100);
    expect(fluencyOf({}, "JADE")).toBe(0);
    expect(fluencyOf({ tongues: { JADE: 42 } }, "JADE")).toBe(42);
    expect(isFluent({ tongues: { JADE: LANGUAGE.FLUENT } }, "JADE")).toBe(true);
    expect(isFluent({ tongues: { JADE: LANGUAGE.FLUENT - 1 } }, "JADE")).toBe(false);
  });

  it("os oficiais: a língua da terra deles, a da terra onde vivem, e às vezes mais uma", () => {
    // Save antigo: só a língua da terra
    expect(officerTongues({})).toEqual(["REALMS"]);
    expect(officerTongues({ culture: "ISLES" })).toEqual(["ISLES"]);
    expect(officerTongues({ culture: "ISLES", tongues: ["ISLES", "SANDS"] })).toEqual(["ISLES", "SANDS"]);
    // Quem é de fora já pegou a da terra; quem rodou o mundo sabe a do bando
    expect(hireTongues("REALMS", "SANDS", 0.9)).toEqual(["REALMS", "SANDS"]);
    expect(hireTongues("SANDS", "SANDS", 0.9)).toEqual(["SANDS"]);
    expect(hireTongues("SANDS", "SANDS", 0.1)).toEqual(["SANDS", "REALMS"]);
    expect(hireTongues("REALMS", "REALMS", 0.1)).toHaveLength(2);
  });

  it("quem fala pelo Comandante: ele, o intérprete, um oficial que saiba as duas, ou ninguém", () => {
    const none: VoiceCtx = { leader: {}, lieutenants: [], captains: [], followers: [] };
    expect(voiceFor("REALMS", none)).toEqual({ level: 1, by: "SELF", who: null });
    expect(voiceFor("SANDS", none)).toEqual({ level: 0, by: "NONE", who: null });
    // O que ele já aprendeu vale em parte
    expect(voiceFor("SANDS", { ...none, leader: { tongues: { SANDS: LANGUAGE.FLUENT / 2 } } }).level).toBeCloseTo(0.5);
    // O intérprete da língua traduz tudo; o de outra língua não ajuda
    const interpreter = { name: "Yusuf", role: "INTERPRETER", tongue: "SANDS" as const };
    expect(voiceFor("SANDS", { ...none, followers: [interpreter] })).toEqual({ level: 1, by: "INTERPRETER", who: "Yusuf" });
    expect(voiceFor("JADE", { ...none, followers: [interpreter] }).by).toBe("NONE");
    // O oficial precisa falar as duas: a de lá e uma que o Comandante fale
    const both = officer("Harun", "SANDS", ["SANDS", "REALMS"]);
    const onlyHis = officer("Tariq", "SANDS");
    expect(voiceFor("SANDS", { ...none, lieutenants: [onlyHis] }).by).toBe("NONE");
    expect(voiceFor("SANDS", { ...none, captains: [both] })).toEqual({ level: LANGUAGE.OFFICER_LEVEL, by: "OFFICER", who: "Harun" });
    // Quem já aprendeu mais que o oficial traduz não precisa dele
    expect(voiceFor("SANDS", { ...none, leader: { tongues: { SANDS: LANGUAGE.FLUENT * 0.9 } }, captains: [both] }).by).toBe("NONE");
    expect(barrierOf(voiceFor("SANDS", none))).toBe(1);
    expect(losesDetail(1)).toBe(true);
    expect(losesDetail(1 - LANGUAGE.OFFICER_LEVEL)).toBe(false);
    expect(heardNote("SANDS", { level: 1, by: "INTERPRETER", who: "Yusuf" })).toMatch(/Na língua das areias; Yusuf, o intérprete, traduz/);
    expect(heardNote("REALMS", { level: 1, by: "SELF", who: null })).toBeNull();
  });

  it("sem a língua, a fala chega com palavras de lá (sempre as mesmas, e os números ficam)", () => {
    const text = "O exército do rei marcha com 300 homens para o norte amanhã cedo.";
    expect(garble(text, "ISLES", 0)).toBe(text);
    const lost = garble(text, "ISLES", 1, 7);
    expect(lost).not.toBe(text);
    expect(lost).toContain("300");
    expect(garble(text, "ISLES", 1, 7)).toBe(lost);
    // Com o oficial traduzindo, pouca coisa se perde
    const changed = (a: string, b: string) => a.split(" ").filter((w, i) => w !== b.split(" ")[i]).length;
    expect(changed(text, garble(text, "ISLES", 1 - LANGUAGE.OFFICER_LEVEL, 7))).toBeLessThan(changed(text, lost));
    expect(wordIn("JADE", () => 0)).toBe("linzhou");
  });

  it("o Comandante aprende a língua do lugar com o tempo, mais depressa com ajuda", () => {
    expect(learnDay({}, "REALMS", false)).toBeNull();
    const day = learnDay({}, "SANDS", false);
    expect(day?.tongues.SANDS).toBe(LANGUAGE.LEARN_PER_DAY);
    expect(learnDay({}, "SANDS", true)?.tongues.SANDS).toBe(LANGUAGE.LEARN_PER_DAY * LANGUAGE.LEARN_HELPED);
    // Os marcos: o básico e falar sem ajuda
    expect(learnDay({ tongues: { SANDS: LANGUAGE.BASIC - 0.5 } }, "SANDS", false)?.reached).toBe("BASIC");
    expect(learnDay({ tongues: { SANDS: LANGUAGE.FLUENT - 0.5 } }, "SANDS", false)?.reached).toBe("FLUENT");
    expect(learnDay({ tongues: { SANDS: 10 } }, "SANDS", false)?.reached).toBeNull();
    // O que ele já sabia das outras fica
    expect(learnDay({ tongues: { JADE: 20 } }, "SANDS", false)?.tongues).toEqual({ JADE: 20, SANDS: LANGUAGE.LEARN_PER_DAY });
    expect(learnDay({ tongues: { SANDS: 100 } }, "SANDS", false)).toBeNull();
  });

  it("na batalha, a ordem falada a um batalhão estrangeiro passa pelo tenente que fale as duas", () => {
    expect(orderVoice({}, "REALMS", null)).toBe("SELF");
    expect(orderVoice({}, "JADE", null)).toBeNull();
    expect(orderVoice({}, "JADE", { culture: "JADE" })).toBeNull();
    expect(orderVoice({}, "JADE", { culture: "JADE", tongues: ["JADE", "REALMS"] })).toBe("LIEUTENANT");
    expect(orderVoice({}, "JADE", { culture: "REALMS", tongues: ["REALMS", "JADE"] })).toBe("LIEUTENANT");
    expect(orderVoice({ tongues: { JADE: LANGUAGE.FLUENT } }, "JADE", null)).toBe("SELF");
  });

  it("sem a língua, o mercador cobra mais e paga menos", () => {
    const econ = { price: { GRAIN: 10 }, stock: { GRAIN: 100 }, want: { GRAIN: 100 } } as unknown as Parameters<typeof quote>[0];
    const clear = quote(econ, "GRAIN", 5, "BUY", priceMargin(0)).total;
    const lost = quote(econ, "GRAIN", 5, "BUY", priceMargin(1)).total;
    expect(lost).toBeGreaterThan(clear);
    expect(quote(econ, "GRAIN", 5, "SELL", priceMargin(1)).total).toBeLessThan(quote(econ, "GRAIN", 5, "SELL", 0).total);
  });

  it("o intérprete só se contrata na taverna: não aparece pedindo no portão", () => {
    const ctx: CampContext = {
      day: 5,
      gold: 100,
      rations: 50,
      debt: 0,
      battalions: [{ id: "a", name: "a", troopType: "INFANTRY", formation: "LINE", level: 1, xp: 0, skillPoints: 0, skills: [], equipment: { weapon: 0, armor: 0 }, totalKills: 300, soldiers: 80, maxSoldiers: 80 }],
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
    const roles = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const e = pickCampEvent(ctx);
      if (e?.kind === "FOLLOWER") roles.add(String(e.data.role));
    }
    expect(roles.size).toBeGreaterThan(2);
    expect(roles.has("INTERPRETER")).toBe(false);
  });
});

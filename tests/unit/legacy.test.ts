import { describe, expect, it } from "vitest";
import { AMBITIONS, AMBITION_IDS, ambitionDone, type AmbitionView } from "../../src/game/sim/ambitions";
import { chooseHeir, fallDeathChance, griefOf, leaderAge, leaderBonus, oldAgeChance } from "../../src/game/sim/legacy";
import { entriesAbout, epilogueOf, mentioned, trimAnnals, type AnnalEntry } from "../../src/game/sim/legends";
import { rememberSaga, yearsLater, type SagaEcho } from "../../src/game/data/sagas";
import type { WorldDef } from "../../src/game/data/world";
import { LEGACY } from "../../src/utils/constants";

const entry = (id: number, text: string, tone: AnnalEntry["tone"] = "info"): AnnalEntry => ({ id, day: id, text, tone, land: "Alfa" });

describe("o corpo do Comandante", () => {
  it("envelhece mais depressa que o calendário", () => {
    expect(leaderAge({ age: 35, since: 1 }, 1)).toBe(35);
    expect(leaderAge({ age: 35, since: 1 }, 81)).toBe(35 + LEGACY.AGE_PER_YEAR);
  });

  it("cair é mais perigoso com idade e cicatrizes", () => {
    expect(fallDeathChance(50, 0)).toBeGreaterThan(fallDeathChance(30, 0));
    expect(fallDeathChance(30, 3)).toBeGreaterThan(fallDeathChance(30, 0));
  });

  it("cair nunca é sentença certa", () => {
    expect(fallDeathChance(90, 20)).toBe(LEGACY.FALL_MAX);
    expect(fallDeathChance(30, 0)).toBeGreaterThan(0);
  });

  it("antes da velhice, ninguém morre de velho", () => {
    expect(oldAgeChance(LEGACY.OLD_FROM)).toBe(0);
    expect(oldAgeChance(30)).toBe(0);
    expect(oldAgeChance(70)).toBeGreaterThan(oldAgeChance(60));
  });

  it("cicatrizes tiram vida, até um limite", () => {
    expect(leaderBonus({ traits: [], wounds: 2 }).hp).toBeCloseTo(1 - 2 * LEGACY.WOUND_HP);
    expect(leaderBonus({ traits: [], wounds: 99 }).hp).toBeCloseTo(1 - LEGACY.WOUND_MAX * LEGACY.WOUND_HP);
  });

  it("os traços mudam quem comanda", () => {
    expect(leaderBonus({ traits: ["BRAVE"], wounds: 0 }).damage).toBeGreaterThan(1);
    expect(leaderBonus({ traits: ["GREEDY"], wounds: 0 }).reward).toBeGreaterThan(1);
    expect(leaderBonus({ traits: ["HONORABLE"], wounds: 0 }).honor).toBeGreaterThan(0);
    expect(leaderBonus({ traits: ["BLOODTHIRSTY"], wounds: 0 }).hp).toBeLessThan(1);
  });

  it("sem traços, nada muda", () => {
    expect(leaderBonus({ traits: [], wounds: 0 })).toEqual({ damage: 1, hp: 1, reward: 1, honor: 0 });
  });
});

describe("herança", () => {
  const a = { id: "a", loyalty: 40 };
  const b = { id: "b", loyalty: 90 };

  it("o testamento vale mais que a lealdade", () => {
    expect(chooseHeir([a, b], "a")).toBe(a);
  });

  it("sem testamento, herda o mais leal", () => {
    expect(chooseHeir([a, b], null)).toBe(b);
  });

  it("herdeiro morto no testamento: vale o mais leal", () => {
    expect(chooseHeir([a, b], "morto")).toBe(b);
  });

  it("sem ninguém, sem herdeiro", () => {
    expect(chooseHeir([], "a")).toBeNull();
  });

  it("o leal sofre menos com a troca; o ambicioso, mais", () => {
    expect(griefOf(["LOYAL"])).toBeLessThan(griefOf([]));
    expect(griefOf(["AMBITIOUS"])).toBeGreaterThan(griefOf([]));
  });
});

describe("ambições", () => {
  const view = (over: Partial<AmbitionView> = {}): AmbitionView => ({ owned: 0, towns: 20, calamities: 0, saltSold: 0, victories: 0, visited: 1, continents: 4, ships: 0, ...over });

  it("começam sem nada", () => {
    for (const id of AMBITION_IDS) expect(ambitionDone(id, view()), id).toBe(false);
  });

  it("cada uma se cumpre pelo que pede", () => {
    expect(ambitionDone("CROWN", view({ owned: 4 }))).toBe(true);
    expect(ambitionDone("SLAYER", view({ calamities: 3 }))).toBe(true);
    expect(ambitionDone("SALT", view({ saltSold: 200 }))).toBe(true);
    expect(ambitionDone("UNITE", view({ owned: 16 }))).toBe(true);
    expect(ambitionDone("SEAS", view({ visited: 4, ships: 3 }))).toBe(true);
    expect(ambitionDone("VETERAN", view({ victories: 40 }))).toBe(true);
  });

  it("senhor dos mares pede as duas coisas", () => {
    expect(ambitionDone("SEAS", view({ visited: 4 }))).toBe(false);
    expect(ambitionDone("SEAS", view({ ships: 3 }))).toBe(false);
  });

  it("unir um continente não exige a última aldeia", () => {
    expect(ambitionDone("UNITE", view({ owned: 15 }))).toBe(false);
  });

  it("toda ambição tem prêmio e epílogo", () => {
    for (const id of AMBITION_IDS) {
      expect(AMBITIONS[id].reward.gold, id).toBeGreaterThan(0);
      expect(AMBITIONS[id].epilogue.length, id).toBeGreaterThan(20);
    }
  });
});

describe("lendas", () => {
  it("cada um encontra o que a crônica diz dele", () => {
    const annals = [entry(1, "Afonso tomou Alva."), entry(2, "Urraca caiu."), entry(3, "Afonso e Urraca se casaram.")];
    expect(entriesAbout(annals, "Afonso").map((e) => e.id)).toEqual([1, 3]);
  });

  it("só quem aparece ganha página", () => {
    const annals = [entry(1, "Alva caiu.")];
    expect(mentioned([{ name: "Alva", role: "Aldeia" }, { name: "Beta", role: "Aldeia" }], annals).map((s) => s.name)).toEqual(["Alva"]);
  });

  it("menos os que a saga nunca esquece", () => {
    expect(mentioned([{ name: "Afonso", role: "1º Comandante" }], [], () => true)).toHaveLength(1);
  });

  it("sem nomes repetidos", () => {
    expect(mentioned([{ name: "Alva", role: "Aldeia" }, { name: "Alva", role: "Vila" }], [entry(1, "Alva")])).toHaveLength(1);
  });

  it("o que sai primeiro é o miúdo", () => {
    const annals = [entry(1, "miúdo"), entry(2, "vitória", "good"), entry(3, "miúdo"), entry(4, "desastre", "bad")];
    expect(trimAnnals(annals, 3).map((e) => e.id)).toEqual([2, 3, 4]);
    expect(trimAnnals(annals, 2).map((e) => e.id)).toEqual([2, 4]);
  });

  it("nunca passa do limite", () => {
    const annals = Array.from({ length: 50 }, (_, i) => entry(i, "feito", "good"));
    const kept = trimAnnals(annals, 10);
    expect(kept).toHaveLength(10);
    expect(kept[9].id).toBe(49);
  });

  it("o epílogo conta quem caiu e o que foi cumprido", () => {
    const text = epilogueOf({
      bandName: "Corvos",
      days: 800,
      leaders: [{ name: "Afonso" }, { name: "Urraca" }],
      fallen: [{ name: "Afonso", generation: 1, from: 1, to: 500, age: 50, cause: "caiu em combate", origin: "" }],
      ambitions: ["SLAYER"],
      victories: 12,
      defeats: 3,
      towns: ["Alva"],
      reason: "Deitaram as armas.",
    }).join(" ");
    expect(text).toContain("Corvos");
    expect(text).toContain("10 ano(s)");
    expect(text).toContain("Afonso (caiu em combate)");
    expect(text).toContain(AMBITIONS.SLAYER.epilogue);
    expect(text).toContain("Alva");
  });

  it("sem terras, o epílogo diz isso", () => {
    const text = epilogueOf({ bandName: "Corvos", days: 10, leaders: [{ name: "A" }], fallen: [], ambitions: [], victories: 0, defeats: 0, towns: [], reason: "Fim." }).join(" ");
    expect(text).toContain("só o nome");
  });
});

describe("mundos que lembram", () => {
  const echo: SagaEcho = { bandName: "Corvos", worldName: "Alva", leaders: ["Afonso", "Urraca"], towns: ["Beta"], deed: "Foram muitos.", centuries: 300 };
  const world = () =>
    ({
      seed: 7,
      year: 100,
      era: "Era",
      history: [{ year: 50, text: "Antes." }],
      settlements: [{ name: "Beta", description: "Vila." }, { name: "Gama", description: "Vila." }],
      sites: [{ name: "Ninho", theme: "GOBLIN_NEST" }, { name: "Ruínas", theme: "HAUNTED_RUINS" }],
    }) as unknown as WorldDef;

  it("o tempo passou", () => {
    const w = world();
    rememberSaga(w, echo);
    expect(w.year).toBe(400);
    expect(w.era).not.toBe("Era");
  });

  it("o bando entra para a história, depois do que já havia", () => {
    const w = world();
    rememberSaga(w, echo);
    expect(w.history[0].text).toBe("Antes.");
    expect(w.history.some((h) => h.text.includes("Corvos"))).toBe(true);
    expect(w.history.some((h) => h.text.includes("Urraca"))).toBe(true);
  });

  it("o povoado do bando lembra; os outros, não", () => {
    const w = world();
    rememberSaga(w, echo);
    expect(w.settlements[0].description).toContain("Corvos");
    expect(w.settlements[1].description).toBe("Vila.");
  });

  it("as ruínas guardam o túmulo do último chefe", () => {
    const w = world();
    rememberSaga(w, echo);
    expect(w.sites[1].name).toBe("Túmulo de Urraca");
    expect(w.sites[0].name).toBe("Ninho");
  });

  it("recarregar dá sempre o mesmo resultado", () => {
    const a = world();
    const b = world();
    rememberSaga(a, echo);
    rememberSaga(b, echo);
    expect(a).toEqual(b);
  });

  it("a mesma saga passa sempre o mesmo tempo", () => {
    expect(yearsLater(7, "Corvos")).toBe(yearsLater(7, "Corvos"));
    expect(yearsLater(7, "Corvos")).toBeGreaterThanOrEqual(180);
  });
});

import { describe, expect, it } from "vitest";
import { arrivalNotice, type ArrivalInput } from "../../src/game/sim/arrival";

const battalion = (id: string, extra: Partial<ArrivalInput["battalions"][number]> = {}) => ({ id, name: id, soldiers: 10, ...extra });

const base = (extra: Partial<ArrivalInput> = {}): ArrivalInput => ({
  name: "Areias de Qasara",
  land: "SANDS",
  back: false,
  day: 3,
  leader: {},
  lieutenants: [],
  captains: [],
  followers: [],
  battalions: [battalion("Lanças Cinzentas"), battalion("Corvos de Ferro")],
  lieutenantOf: () => null,
  ...extra,
});

const topic = (n: ReturnType<typeof arrivalNotice>, t: string) => n.lines.find((l) => l.topic === t);

describe("outra terra (Marco 23, parte 4)", () => {
  it("chegar às areias: a gente, a língua que ninguém fala, a fé rival e quem governa", () => {
    const n = arrivalNotice(base());
    expect(n.land).toBe("SANDS");
    expect(topic(n, "FOLK")?.text).toMatch(/gente das areias/);
    expect(topic(n, "TONGUE")).toMatchObject({ tone: "bad" });
    expect(topic(n, "TONGUE")?.text).toMatch(/ninguém no bando a fala/);
    // O Véu briga com a Chama do bando
    expect(topic(n, "FAITH")?.text).toMatch(/Véu das Estrelas/);
    expect(topic(n, "FAITH")?.text).toMatch(/briga com fés do bando \(Chama Eterna\)/);
    expect(topic(n, "FAITH")?.text).toMatch(/a Noite das Estrelas em \d+ dia/);
    expect(topic(n, "RULE")?.text).toMatch(/governado por gente de fora/);
    // A tropa dos reinos entende o Comandante dos reinos
    expect(topic(n, "ORDERS")).toBeUndefined();
  });

  it("com o intérprete da terra, ele fala pelo bando", () => {
    const n = arrivalNotice(base({ followers: [{ name: "Yusuf", role: "INTERPRETER", tongue: "SANDS" }] }));
    expect(topic(n, "TONGUE")).toMatchObject({ tone: "good" });
    expect(topic(n, "TONGUE")?.text).toMatch(/Yusuf, o intérprete/);
  });

  it("a tropa estrangeira sem tenente das duas línguas não entende as ordens", () => {
    const sands = battalion("Lanças do Poço", { culture: "SANDS" });
    const lost = arrivalNotice(base({ battalions: [battalion("Lanças Cinzentas"), sands] }));
    expect(topic(lost, "ORDERS")?.text).toMatch(/^Lanças do Poço não entende/);
    const relayed = arrivalNotice(base({ battalions: [sands], lieutenantOf: () => ({ culture: "SANDS", tongues: ["SANDS", "REALMS"] }) }));
    expect(topic(relayed, "ORDERS")).toBeUndefined();
  });

  it("os fiordes: a fé do Mar não briga com a Chama", () => {
    const n = arrivalNotice(base({ name: "Fiordes de Skarvik", land: "ISLES" }));
    expect(topic(n, "FAITH")?.text).toMatch(/Deuses do Mar/);
    expect(topic(n, "FAITH")?.tone).toBe("info");
    expect(topic(n, "FAITH")?.text).not.toMatch(/briga/);
  });

  it("de volta à terra natal: a língua do Comandante e ninguém de fora governando", () => {
    const n = arrivalNotice(base({ name: "Terras de Cinzal", land: "REALMS", back: true }));
    expect(n.back).toBe(true);
    expect(topic(n, "TONGUE")).toMatchObject({ tone: "good" });
    expect(topic(n, "TONGUE")?.text).toMatch(/que o Comandante fala/);
    expect(topic(n, "RULE")).toBeUndefined();
  });
});

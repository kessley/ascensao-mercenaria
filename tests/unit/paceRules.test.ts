import { describe, expect, it } from "vitest";
import { PaceLog, paceState, stat, type PaceView } from "../../src/dev/paceRules";

const view = (o: Partial<PaceView>): PaceView => ({ map: false, panel: false, inside: false, fighting: false, moving: false, ...o });

describe("o estado do momento", () => {
  it("o mapa e o painel pausam o jogo: contam antes da luta", () => {
    expect(paceState(view({ map: true, fighting: true }))).toBe("MAP");
    expect(paceState(view({ panel: true, fighting: true, moving: true }))).toBe("PANEL");
  });

  it("dentro de casa o campo dorme", () => {
    expect(paceState(view({ inside: true, moving: true }))).toBe("INSIDE");
  });

  it("lutando conta mesmo andando; andando é marcha; o resto é parado", () => {
    expect(paceState(view({ fighting: true, moving: true }))).toBe("FIGHTING");
    expect(paceState(view({ moving: true }))).toBe("MARCHING");
    expect(paceState(view({}))).toBe("IDLE");
  });
});

describe("as contas", () => {
  it("mediana, média e máximo", () => {
    expect(stat([3, 1, 2])).toEqual({ n: 3, median: 2, mean: 2, max: 3 });
    expect(stat([1, 2, 3, 10]).median).toBe(2.5);
    expect(stat([]).n).toBe(0);
  });
});

describe("o diário", () => {
  it("soma o tempo de cada estado e a parte de cada um", () => {
    const p = new PaceLog();
    p.tick("MARCHING", 90_000);
    p.tick("FIGHTING", 30_000);
    const r = p.report();
    expect(r.minutes).toBe(2);
    expect(r.states.find((s) => s.state === "MARCHING")?.share).toBe(75);
    expect(r.states.find((s) => s.state === "FIGHTING")?.minutes).toBe(0.5);
  });

  it("guarda o minuto em que a primeira luta começou", () => {
    const p = new PaceLog();
    p.tick("IDLE", 60_000);
    p.tick("MARCHING", 30_000);
    p.tick("FIGHTING", 1_000);
    p.tick("FIGHTING", 1_000);
    expect(p.report().firstFight).toBe(1.5);
    expect(new PaceLog().report().firstFight).toBeNull();
  });

  it("mede o tempo entre uma decisão e a seguinte", () => {
    const p = new PaceLog();
    p.decide("CONTRACT");
    p.tick("MARCHING", 120_000);
    p.decide("RECRUIT");
    p.tick("IDLE", 60_000);
    p.decide("BUILD");
    const r = p.report();
    expect(r.decisions.total).toBe(3);
    expect(r.decisions.byKind).toEqual({ CONTRACT: 1, RECRUIT: 1, BUILD: 1 });
    expect(r.decisions.gap.median).toBe(90);
  });

  it("a missão vai da porta à porta: saída do acampamento até a volta", () => {
    const p = new PaceLog();
    p.accepted("c1", "Goblins no moinho");
    p.tick("IDLE", 60_000);
    p.leftCamp();
    p.tick("MARCHING", 120_000);
    p.tick("FIGHTING", 60_000);
    p.finished("c1");
    p.tick("MARCHING", 120_000);
    p.backInCamp();
    const [m] = p.report().missions;
    expect(m.title).toBe("Goblins no moinho");
    expect(m.doorToDoor).toBe(5);
    expect(m.acceptToDone).toBe(4);
  });

  it("missão que ainda não acabou fica de fora; a que acabou longe espera a volta", () => {
    const p = new PaceLog();
    p.accepted("c1", "A");
    p.leftCamp();
    p.tick("MARCHING", 60_000);
    expect(p.report().missions).toEqual([]);
    p.finished("c1");
    expect(p.report().missions[0].doorToDoor).toBeNull();
  });

  it("quanto cada inimigo leva para cair, por tipo, o mais visto primeiro", () => {
    const p = new PaceLog();
    p.fell("GOBLIN", 28_000);
    p.fell("GOBLIN", 32_000);
    p.fell("GOBLIN", 30_000);
    p.fell("ORC", 60_000);
    const [first, second] = p.report().falls;
    expect(first).toEqual({ kind: "GOBLIN", stat: { n: 3, median: 30, mean: 30, max: 32 } });
    expect(second.kind).toBe("ORC");
  });
});

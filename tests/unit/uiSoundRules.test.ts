import { describe, expect, it } from "vitest";
import { clickSound, newLogLines, panelSound, stateSounds, type SoundState } from "../../src/audio/uiRules";

const base: SoundState = {
  loadNonce: 1,
  campPanel: null,
  worldMapOpen: false,
  gold: 100,
  battalions: [{ id: "a", level: 1 }],
  campPlan: { buildings: [1, 2] },
  activeContract: null,
  log: [{ id: 1, text: "Dia 1." }],
};

describe("o som de cada botão", () => {
  it("botão comum dá um clique leve", () => {
    expect(clickSound({ disabled: false, text: "Infantaria" })).toBe("click");
  });

  it("quem confirma sobe, quem cancela desce", () => {
    expect(clickSound({ disabled: false, text: "Recrutar (60)" })).toBe("confirm");
    expect(clickSound({ disabled: false, text: "Aceitar contrato" })).toBe("confirm");
    expect(clickSound({ disabled: false, text: "Começar campanha" })).toBe("confirm");
    expect(clickSound({ disabled: false, text: "Voltar" })).toBe("cancel");
    expect(clickSound({ disabled: false, text: "  Fechar " })).toBe("cancel");
    expect(clickSound({ disabled: false, text: "×" })).toBe("cancel");
  });

  it("botão desligado responde não pode, diga o que disser", () => {
    expect(clickSound({ disabled: true, text: "Recrutar (60)" })).toBe("deny");
    expect(clickSound({ disabled: true, text: "Voltar" })).toBe("deny");
  });

  it("o atributo data-sound manda, e none cala", () => {
    expect(clickSound({ disabled: false, text: "Voltar", hint: "confirm" })).toBe("confirm");
    expect(clickSound({ disabled: false, text: "Recrutar", hint: "none" })).toBeNull();
    expect(clickSound({ disabled: true, text: "Recrutar", hint: "none" })).toBeNull();
  });
});

describe("a assinatura de cada lugar", () => {
  it("cada lugar do acampamento e da cidade tem o seu som", () => {
    expect(panelSound({ kind: "FORGE" })).toBe("anvil");
    expect(panelSound({ kind: "TAVERN" })).toBe("mugs");
    expect(panelSound({ kind: "TEMPLE" })).toBe("templeBell");
    expect(panelSound({ kind: "STABLE" })).toBe("whinny");
    expect(panelSound({ kind: "QUARTERMASTER" })).toBe("sacks");
    expect(panelSound({ kind: "TRAINING" })).toBe("woodSwords");
    expect(panelSound({ kind: "TENT" })).toBe("canvas");
    expect(panelSound({ kind: "DOCK" })).toBe("gulls");
  });

  it("no povoado, depende de por onde se entrou", () => {
    expect(panelSound({ kind: "TOWN", at: "MARKET" })).toBe("market");
    expect(panelSound({ kind: "TOWN", at: "HALL" })).toBe("hall");
    expect(panelSound({ kind: "TOWN", at: "GATE" })).toBe("gate");
    expect(panelSound({ kind: "TOWN" })).toBe("market");
  });

  it("os livros são página; o resto é o som comum de painel", () => {
    expect(panelSound({ kind: "MISSIONS" })).toBe("page");
    expect(panelSound({ kind: "SAGA" })).toBe("page");
    expect(panelSound({ kind: "BATTALION" })).toBe("open");
    expect(panelSound({ kind: "GAME" })).toBe("open");
  });

  it("os onze lugares do roteiro soam todos diferentes", () => {
    const places = [
      panelSound({ kind: "FORGE" }),
      panelSound({ kind: "TAVERN" }),
      panelSound({ kind: "TEMPLE" }),
      panelSound({ kind: "TOWN", at: "MARKET" }),
      panelSound({ kind: "STABLE" }),
      panelSound({ kind: "QUARTERMASTER" }),
      panelSound({ kind: "TRAINING" }),
      panelSound({ kind: "TENT" }),
      panelSound({ kind: "DOCK" }),
      panelSound({ kind: "TOWN", at: "HALL" }),
      panelSound({ kind: "TOWN", at: "GATE" }),
    ];
    expect(new Set(places).size).toBe(11);
  });
});

describe("o que o estado do jogo pede", () => {
  it("nada mudou, nenhum som", () => {
    expect(stateSounds(base, { ...base })).toEqual([]);
  });

  it("abrir um painel toca a assinatura do lugar; fechar, o som de fechar", () => {
    const open = { ...base, campPanel: { kind: "FORGE" } };
    expect(stateSounds(base, open)).toEqual(["anvil"]);
    expect(stateSounds(open, base)).toEqual(["close"]);
  });

  it("trocar de painel toca o do novo; o mesmo painel com outros dados não repete", () => {
    const forge = { ...base, campPanel: { kind: "FORGE" } };
    expect(stateSounds(forge, { ...base, campPanel: { kind: "TAVERN" } })).toEqual(["mugs"]);
    expect(stateSounds(forge, { ...base, campPanel: { kind: "FORGE" } })).toEqual([]);
  });

  it("o mapa desenrola ao abrir e enrola ao fechar", () => {
    const open = { ...base, worldMapOpen: true };
    expect(stateSounds(base, open)).toEqual(["mapOpen"]);
    expect(stateSounds(open, base)).toEqual(["mapClose"]);
  });

  it("ouro que muda com um painel aberto é moeda; fora do painel, não", () => {
    const panel = { ...base, campPanel: { kind: "QUARTERMASTER" } };
    expect(stateSounds(panel, { ...panel, gold: 80 })).toEqual(["coinLoss"]);
    expect(stateSounds(panel, { ...panel, gold: 130 })).toEqual(["coinGain"]);
    expect(stateSounds(base, { ...base, gold: 80 })).toEqual([]);
  });

  it("construir é o martelo", () => {
    const panel = { ...base, campPanel: { kind: "CAMP_PLAN" } };
    expect(stateSounds(panel, { ...panel, gold: 60, campPlan: { buildings: [1, 2, 3] } })).toEqual(["coinLoss", "build"]);
    // Derrubar não bate martelo
    expect(stateSounds(panel, { ...panel, campPlan: { buildings: [1] } })).toEqual([]);
  });

  it("recrutar é o tambor, só com o painel aberto", () => {
    const panel = { ...base, campPanel: { kind: "RECRUIT" } };
    const more = [...base.battalions, { id: "b", level: 1 }];
    expect(stateSounds(panel, { ...panel, gold: 40, battalions: more })).toEqual(["coinLoss", "recruit"]);
    expect(stateSounds(base, { ...base, battalions: more })).toEqual([]);
  });

  it("batalhão que sobe de nível toca a subida; batalhão novo já de nível alto, não", () => {
    expect(stateSounds(base, { ...base, battalions: [{ id: "a", level: 2 }] })).toEqual(["levelUp"]);
    expect(stateSounds(base, { ...base, battalions: [{ id: "a", level: 1 }, { id: "z", level: 5 }] })).toEqual([]);
  });

  it("aceitar um contrato é a pena e o selo", () => {
    expect(stateSounds(base, { ...base, activeContract: { id: 1 } })).toEqual(["contract"]);
    expect(stateSounds({ ...base, activeContract: { id: 1 } }, base)).toEqual([]);
  });

  it("o dia de pagamento são muitas moedas, mesmo sem painel, e não a moeda sozinha", () => {
    const paid = { ...base, gold: 40, log: [...base.log, { id: 2, text: "Dia de pagamento: 60 de ouro." }] };
    expect(stateSounds(base, paid)).toEqual(["wages"]);
    const panel = { ...base, campPanel: { kind: "TENT" } };
    expect(stateSounds(panel, { ...paid, campPanel: panel.campPanel })).toEqual(["wages"]);
  });

  it("ambição cumprida toca a fanfarra", () => {
    const done = { ...base, gold: 600, log: [...base.log, { id: 2, text: "Ambição cumprida: senhor do sal (+500 de ouro)." }] };
    expect(stateSounds(base, done)).toEqual(["ambition"]);
  });

  it("carregar um jogo muda tudo de uma vez e não faz som nenhum", () => {
    const loaded: SoundState = {
      loadNonce: 2,
      campPanel: { kind: "FORGE" },
      worldMapOpen: true,
      gold: 999,
      battalions: [{ id: "a", level: 4 }, { id: "b", level: 2 }],
      campPlan: { buildings: [1, 2, 3, 4] },
      activeContract: { id: 9 },
      log: [{ id: 50, text: "Dia de pagamento: 60 de ouro." }],
    };
    expect(stateSounds(base, loaded)).toEqual([]);
  });
});

describe("as linhas novas do diário", () => {
  it("só as que entraram depois da última vista", () => {
    const prev = [{ id: 1, text: "a" }, { id: 2, text: "b" }];
    const next = [...prev, { id: 3, text: "c" }, { id: 4, text: "d" }];
    expect(newLogLines(prev, next)).toEqual(["c", "d"]);
    expect(newLogLines(next, next)).toEqual([]);
  });

  it("o diário que cortou o começo não repete as antigas", () => {
    const prev = [{ id: 1, text: "a" }, { id: 2, text: "b" }, { id: 3, text: "c" }];
    const next = [{ id: 3, text: "c" }, { id: 4, text: "d" }];
    expect(newLogLines(prev, next)).toEqual(["d"]);
  });
});

import { describe, expect, it } from "vitest";
import { ALARMS, ALARM_KINDS, AlarmBoard, MAX_SIGNALS, edgeMark, realmNews, type RealmWatch } from "../../src/audio/alarmRules";

describe("os alarmes", () => {
  it("cada um tem nome, ícone e lugar na fila", () => {
    for (const k of ALARM_KINDS) {
      expect(ALARMS[k].label.length).toBeGreaterThan(0);
      expect(ALARMS[k].icon.length).toBeGreaterThan(0);
      expect(ALARMS[k].showMs).toBeGreaterThan(0);
    }
  });

  it("o perigo abaixa os outros canais; a notícia só soa por cima", () => {
    expect(ALARMS.camp.ducks).toBe(true);
    expect(ALARMS.village.ducks).toBe(true);
    expect(ALARMS.calamity.ducks).toBe(true);
    expect(ALARMS.messenger.ducks).toBe(false);
    expect(ALARMS.scout.ducks).toBe(false);
  });

  it("o acampamento passa na frente de tudo; o mensageiro, de nada", () => {
    for (const k of ALARM_KINDS) {
      if (k !== "camp") expect(ALARMS.camp.rank).toBeGreaterThan(ALARMS[k].rank);
      if (k !== "messenger") expect(ALARMS.messenger.rank).toBeLessThan(ALARMS[k].rank);
    }
  });
});

describe("o quadro dos alarmes", () => {
  it("o primeiro toca e põe a seta", () => {
    const b = new AlarmBoard();
    const r = b.raise("camp", 0, { at: { x: 10, y: 20 } });
    expect(r.sound).toBe(true);
    expect(r.signal?.at).toEqual({ x: 10, y: 20 });
    expect(b.active(1).length).toBe(1);
  });

  it("o mesmo perigo que continua não toca de novo, mas a seta fica e segue", () => {
    const b = new AlarmBoard();
    b.raise("camp", 0, { at: { x: 0, y: 0 } });
    const again = b.raise("camp", 10_000, { at: { x: 50, y: 0 } });
    expect(again.sound).toBe(false);
    expect(again.signal?.at).toEqual({ x: 50, y: 0 });
    // A seta dura a partir da última vez que o perigo foi visto
    expect(b.active(20_000).length).toBe(1);
    expect(b.active(10_000 + ALARMS.camp.showMs + 1).length).toBe(0);
  });

  it("passado o descanso, o mesmo alarme toca outra vez", () => {
    const b = new AlarmBoard();
    b.raise("camp", 0);
    expect(b.raise("camp", ALARMS.camp.cooldownMs + 1).sound).toBe(true);
  });

  it("duas aldeias atacadas juntas: duas setas, um sino só", () => {
    const b = new AlarmBoard();
    expect(b.raise("village", 0, { key: "A" }).sound).toBe(true);
    const second = b.raise("village", 3000, { key: "B" });
    expect(second.sound).toBe(false);
    expect(second.signal).not.toBeNull();
    expect(b.active(3001).length).toBe(2);
    // A terceira, longe no tempo, toca de novo
    expect(b.raise("village", ALARMS.village.kindGapMs + 1, { key: "C" }).sound).toBe(true);
  });

  it("um sinal menor não toca por cima de um alarme maior; depois dele, toca", () => {
    const b = new AlarmBoard();
    b.raise("camp", 0, { seconds: 3 });
    const scout = b.raise("scout", 1000, { key: "s1" });
    expect(scout.sound).toBe(false);
    expect(scout.signal).not.toBeNull();
    expect(b.raise("scout", 4000, { key: "s2" }).sound).toBe(true);
  });

  it("quem chegou durante o maior espera a vez, e toca quando ele acaba", () => {
    const b = new AlarmBoard();
    b.raise("war", 0, { seconds: 2.6 });
    const wages = b.raise("wages", 700, { seconds: 2.6 });
    expect(wages.sound).toBe(false);
    expect(wages.waitMs).toBe(1900);
    expect(b.ring("wages", 2700, 2.6).sound).toBe(true);
  });

  it("se outro maior entrou no meio, espera de novo", () => {
    const b = new AlarmBoard();
    b.raise("war", 0, { seconds: 2.6 });
    b.raise("wages", 700, { seconds: 2.6 });
    b.raise("calamity", 1400, { seconds: 6 });
    const turn = b.ring("wages", 2700, 2.6);
    expect(turn.sound).toBe(false);
    expect(turn.waitMs).toBe(7400 - 2700);
  });

  it("no intervalo do próprio tipo não há vez a esperar", () => {
    const b = new AlarmBoard();
    b.raise("village", 0, { key: "A" });
    expect(b.raise("village", 1000, { key: "B" }).waitMs).toBe(0);
  });

  it("um alarme maior toca por cima de um sinal menor", () => {
    const b = new AlarmBoard();
    b.raise("messenger", 0, { seconds: 1 });
    expect(b.raise("camp", 200).sound).toBe(true);
  });

  it("setas demais: some a de menor peso", () => {
    const b = new AlarmBoard();
    b.raise("messenger", 0, { key: "m" });
    b.raise("camp", 10);
    b.raise("village", 20, { key: "v" });
    b.raise("war", 30, { key: "w" });
    b.raise("hero", 40, { key: "h" });
    const kinds = b.active(50).map((s) => s.kind);
    expect(kinds.length).toBe(MAX_SIGNALS);
    expect(kinds).not.toContain("messenger");
  });

  it("a seta clicada some, e o mesmo perigo no descanso não a traz de volta", () => {
    const b = new AlarmBoard();
    const { signal } = b.raise("camp", 0);
    b.dismiss(signal?.id ?? -1);
    expect(b.active(1).length).toBe(0);
    expect(b.raise("camp", 2000).signal).toBeNull();
    expect(b.active(2001).length).toBe(0);
  });
});

describe("onde fica a seta", () => {
  const W = 1000;
  const H = 600;

  it("dentro da tela, fica em cima do lugar", () => {
    const m = edgeMark(300, 200, W, H, 40);
    expect(m.inside).toBe(true);
    expect([m.x, m.y]).toEqual([300, 200]);
  });

  it("à direita, presa na borda da direita, apontando para a direita", () => {
    const m = edgeMark(5000, 300, W, H, 40);
    expect(m.inside).toBe(false);
    expect(m.x).toBeCloseTo(W - 40);
    expect(m.y).toBeCloseTo(300);
    expect(m.angle).toBeCloseTo(0);
  });

  it("em cima, presa no alto, apontando para cima", () => {
    const m = edgeMark(500, -3000, W, H, 40);
    expect(m.y).toBeCloseTo(40);
    expect(m.x).toBeCloseTo(500);
    expect(m.angle).toBeCloseTo(-Math.PI / 2);
  });

  it("na diagonal, na linha que sai do centro até o lugar, sem sair da tela", () => {
    const m = edgeMark(-2000, 2000, W, H, 40);
    expect(m.inside).toBe(false);
    expect(m.x).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(m.y).toBeLessThanOrEqual(H - 40 + 1e-6);
    // No mesmo rumo do centro até o alvo
    expect(Math.atan2(m.y - H / 2, m.x - W / 2)).toBeCloseTo(m.angle);
  });

  it("logo além da margem já é borda", () => {
    expect(edgeMark(20, 300, W, H, 40).inside).toBe(false);
  });
});

describe("as notícias do reino", () => {
  const calm: RealmWatch = { wars: ["F0|F1|3"], calamities: [], arrears: 0, seatAlarm: false };

  it("na primeira olhada (cena nova, jogo carregado) nada é notícia", () => {
    const n = realmNews(null, { wars: ["F0|F1|3", "F2|F3|9"], calamities: ["C1"], arrears: 2, seatAlarm: true });
    expect(n).toEqual({ wars: [], calamities: [], arrears: false, seat: false });
  });

  it("guerra nova é notícia; a que já estava, não", () => {
    expect(realmNews(calm, { ...calm, wars: ["F0|F1|3", "F2|F3|9"] }).wars).toEqual(["F2|F3|9"]);
    expect(realmNews(calm, calm).wars).toEqual([]);
  });

  it("a paz não toca trombeta", () => {
    expect(realmNews(calm, { ...calm, wars: [] }).wars).toEqual([]);
  });

  it("calamidade que desperta é notícia; a vencida, não", () => {
    const one = { ...calm, calamities: ["C1"] };
    expect(realmNews(calm, one).calamities).toEqual(["C1"]);
    expect(realmNews(one, calm).calamities).toEqual([]);
  });

  it("mais uma semana sem soldo resmunga; o soldo pago, não", () => {
    expect(realmNews(calm, { ...calm, arrears: 1 }).arrears).toBe(true);
    expect(realmNews({ ...calm, arrears: 2 }, { ...calm, arrears: 0 }).arrears).toBe(false);
  });

  it("os inimigos às muralhas da sede tocam uma vez", () => {
    expect(realmNews(calm, { ...calm, seatAlarm: true }).seat).toBe(true);
    expect(realmNews({ ...calm, seatAlarm: true }, { ...calm, seatAlarm: true }).seat).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { BUSES, BUS_VOICES, DEFAULT_MIX, Gate, duckFor, placeSound, readMix } from "../../src/audio/mixer";

const calm = { alarm: false, voice: false, paused: false };

describe("o que fica guardado", () => {
  it("sem nada guardado, vale o padrão", () => {
    expect(readMix(null)).toEqual(DEFAULT_MIX);
    expect(readMix("lixo")).toEqual(DEFAULT_MIX);
  });

  it("o formato antigo (só volume e mudo) ganha os canais no padrão", () => {
    const m = readMix({ volume: 0.3, muted: true });
    expect(m.volume).toBe(0.3);
    expect(m.muted).toBe(true);
    expect(m.buses).toEqual(DEFAULT_MIX.buses);
  });

  it("cada canal guarda o seu volume, sempre entre 0 e 1", () => {
    const m = readMix({ volume: 2, buses: { ui: 0.1, voice: -3, combat: 9, music: "alto" } });
    expect(m.volume).toBe(1);
    expect(m.buses.ui).toBe(0.1);
    expect(m.buses.voice).toBe(0);
    expect(m.buses.combat).toBe(1);
    expect(m.buses.music).toBe(DEFAULT_MIX.buses.music);
    expect(m.buses.ambience).toBe(DEFAULT_MIX.buses.ambience);
  });
});

describe("quem abaixa quem", () => {
  it("em calma, todo canal toca inteiro", () => {
    for (const b of BUSES) expect(duckFor(b, calm)).toBe(1);
  });

  it("o alarme abaixa todos os outros, menos a interface", () => {
    const s = { ...calm, alarm: true };
    expect(duckFor("ui", s)).toBe(1);
    for (const b of BUSES) if (b !== "ui") expect(duckFor(b, s)).toBeLessThan(0.6);
  });

  it("a voz abaixa o ambiente e a música, e não o combate", () => {
    const s = { ...calm, voice: true };
    expect(duckFor("ambience", s)).toBeLessThan(1);
    expect(duckFor("music", s)).toBeLessThan(1);
    expect(duckFor("combat", s)).toBe(1);
    expect(duckFor("voice", s)).toBe(1);
  });

  it("o alarme com a voz abaixa o ambiente mais que cada um sozinho", () => {
    expect(duckFor("ambience", { alarm: true, voice: true, paused: false })).toBeLessThan(duckFor("ambience", { ...calm, alarm: true }));
  });

  it("o jogo em pausa cala o combate, e só ele", () => {
    const s = { ...calm, paused: true };
    expect(duckFor("combat", s)).toBe(0);
    for (const b of BUSES) if (b !== "combat") expect(duckFor(b, s)).toBe(1);
  });
});

describe("a porteira", () => {
  it("o mesmo som não repete dentro do intervalo", () => {
    const g = new Gate();
    expect(g.allow("golpe", "combat", 0, 35, 6, 400)).toBe(true);
    expect(g.allow("golpe", "combat", 20, 35, 6, 400)).toBe(false);
    expect(g.allow("golpe", "combat", 40, 35, 6, 400)).toBe(true);
  });

  it("cada som tem o seu número de vozes, que voltam quando ele acaba", () => {
    const g = new Gate();
    expect(g.allow("grito", "combat", 0, 0, 2, 300)).toBe(true);
    expect(g.allow("grito", "combat", 10, 0, 2, 300)).toBe(true);
    expect(g.allow("grito", "combat", 20, 0, 2, 300)).toBe(false);
    expect(g.allow("grito", "combat", 320, 0, 2, 300)).toBe(true);
  });

  it("o canal tem teto: 1600 golpes pedidos no mesmo instante não passam dele", () => {
    const g = new Gate();
    let played = 0;
    for (let i = 0; i < 1600; i++) if (g.allow(`golpe${i % 40}`, "combat", i * 0.01, 0, 6, 400)) played++;
    expect(played).toBe(BUS_VOICES.combat);
    expect(g.total(16)).toBe(BUS_VOICES.combat);
    // Depois que acabam, o canal abre de novo
    expect(g.allow("golpe0", "combat", 1000, 0, 6, 400)).toBe(true);
  });

  it("um canal cheio não tira a vez do outro", () => {
    const g = new Gate({ ui: 1, voice: 1, combat: 1, ambience: 1, music: 1 });
    expect(g.allow("a", "combat", 0, 0, 6, 400)).toBe(true);
    expect(g.allow("b", "combat", 1, 0, 6, 400)).toBe(false);
    expect(g.allow("c", "voice", 1, 0, 6, 400)).toBe(true);
    expect(g.allow("d", "ui", 1, 0, 6, 400)).toBe(true);
  });

  it("a voz fala uma de cada vez por tropa, e no máximo três juntas", () => {
    const g = new Gate();
    const said = ["a", "b", "c", "d"].map((n, i) => g.allow(`voz:${n}`, "voice", i, 0, 1, 600));
    expect(said).toEqual([true, true, true, false]);
  });
});

describe("de onde vem o som", () => {
  it("no ouvinte toca inteiro, sem lado", () => {
    expect(placeSound(0, 0, 1400, 640)).toEqual({ gain: 1, pan: 0 });
  });

  it("longe demais não se ouve", () => {
    expect(placeSound(2000, 0, 1400, 640)).toBeNull();
  });

  it("cai com a distância e vem do lado certo", () => {
    const near = placeSound(300, 0, 1400, 640);
    const far = placeSound(900, 0, 1400, 640);
    const left = placeSound(-900, 0, 1400, 640);
    expect(near && far && near.gain > far.gain).toBe(true);
    expect(far?.pan).toBeGreaterThan(0.9);
    expect(left?.pan).toBeLessThan(-0.9);
  });
});

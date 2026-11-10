import { describe, expect, it } from "vitest";
import { BLAST_CELL, BLAST_FRAMES, BLAST_RADIUS, blastSheet, fireballSheet, FIREBALL_CELL, FIREBALL_FRAMES, mendSheet, MEND_CELL, MEND_FRAMES, RING_FRAMES, ringSheet } from "../../src/game/art/magicArt";
import {
  arcaneAfter,
  arcaneMax,
  blastDamage,
  castProblem,
  castsPerFill,
  clampToRange,
  COURT_SPELLS,
  courtMageSpell,
  magicPrice,
  marksFor,
  markWeight,
  masterOffers,
  mendAmount,
  nextArtifact,
  nextGrimoire,
  RUIN_SPELLS,
  SPELL_IDS,
  SPELL_KEYS,
  waysToLearn,
} from "../../src/game/sim/magic";
import { updateMorale, type MoraleGroup } from "../../src/game/systems/MoraleSystem";
import { leaderBonus } from "../../src/game/sim/legacy";
import { portraitBitmap, portraitKey, type PortraitSpec } from "../../src/game/art/portraits";
import { INITIAL_MAGIC, magicSlice, type MagicState } from "../../src/store/magicSlice";
import type { GameState } from "../../src/store/useGameStore";
import { MAGIC } from "../../src/utils/constants";

const alpha = (b: { width: number; rgba: Uint8ClampedArray }, x: number, y: number) => b.rgba[(y * b.width + x) * 4 + 3];
/** Quantos pixels pintados há num quadro da folha. */
const painted = (b: { width: number; height: number; rgba: Uint8ClampedArray }, frame: number, cell: number) => {
  let n = 0;
  for (let y = 0; y < b.height; y++) for (let x = frame * cell; x < (frame + 1) * cell; x++) if (alpha(b, x, y) > 0) n++;
  return n;
};

describe("as regras da magia (Marco 19, parte 1)", () => {
  const here = { x: 0, y: 0 };
  const ready = { known: [...SPELL_IDS], arcane: MAGIC.ARCANE_MAX, readyIn: 0 };

  it("lança só a magia que sabe, pronta, com arcano e ao alcance", () => {
    const near = { x: 100, y: 0 };
    expect(castProblem("FIREBALL", ready, here, near)).toBeNull();
    expect(castProblem("FIREBALL", { ...ready, known: ["MEND"] }, here, near)).toMatch(/não conhece/);
    expect(castProblem("FIREBALL", { ...ready, readyIn: 3.2 }, here, near)).toMatch(/faltam 4 s/);
    expect(castProblem("FIREBALL", { ...ready, arcane: MAGIC.SPELLS.FIREBALL.cost - 1 }, here, near)).toMatch(/Arcano de menos/);
    expect(castProblem("FIREBALL", ready, here, { x: MAGIC.SPELLS.FIREBALL.range + 1, y: 0 })).toBe("Longe demais.");
    expect(castProblem("MEND", ready, here, { x: MAGIC.SPELLS.MEND.range, y: 0 })).toBeNull();
  });

  it("a mira para na borda do alcance", () => {
    expect(clampToRange(here, { x: 30, y: 40 }, 100)).toEqual({ x: 30, y: 40 });
    const p = clampToRange(here, { x: 300, y: 400 }, 100);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100);
    expect(p.x / p.y).toBeCloseTo(0.75);
  });

  it("a explosão fere cheio no meio, menos na borda e nada fora", () => {
    const R = MAGIC.SPELLS.FIREBALL.radius;
    const D = MAGIC.FIREBALL.DAMAGE;
    expect(blastDamage(0)).toBeCloseTo(D);
    expect(blastDamage(R)).toBeCloseTo(D * MAGIC.FIREBALL.EDGE);
    expect(blastDamage(R + 1)).toBe(0);
    let last = Infinity;
    for (let d = 0; d <= R; d += 10) {
      const v = blastDamage(d);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });

  it("a cura devolve uma parte da vida sem passar do máximo", () => {
    expect(mendAmount(20, 100)).toBeCloseTo(100 * MAGIC.MEND.SHARE);
    expect(mendAmount(90, 100)).toBeCloseTo(10);
    expect(mendAmount(100, 100)).toBe(0);
  });

  it("o arcano volta com os dias, até o máximo, e dá para poucas magias por vez", () => {
    expect(arcaneAfter(0, 1)).toBe(MAGIC.ARCANE_PER_DAY);
    expect(arcaneAfter(MAGIC.ARCANE_MAX - 5, 1)).toBe(MAGIC.ARCANE_MAX);
    expect(arcaneAfter(10, -2)).toBe(10);
    // Cheio, dá para 2 ou 3 magias: o Comandante escolhe a hora
    expect(castsPerFill(["FIREBALL"])).toBe(2);
    expect(castsPerFill(["FIREBALL", "MEND"])).toBe(3);
    expect(castsPerFill([])).toBe(0);
  });

  it("cada magia tem a sua tecla, e as caras custam mais que as de apoio", () => {
    expect(SPELL_IDS.length).toBeLessThanOrEqual(SPELL_KEYS.length);
    const S = MAGIC.SPELLS;
    // Quebrar a moral de um exército é a mais cara; apagar o fogo, a mais barata
    expect(S.TERROR.cost).toBe(Math.max(...SPELL_IDS.map((s) => S[s].cost)));
    expect(S.DOUSE.cost).toBe(Math.min(...SPELL_IDS.map((s) => S[s].cost)));
    // O que mexe no mundo vale para uma área maior que a explosão
    for (const s of ["FREEZE", "MIST", "DOUSE"] as const) expect(S[s].radius).toBeGreaterThan(S.FIREBALL.radius);
  });
});

describe("o pavor na moral (Marco 19, parte 2)", () => {
  const group = (morale: number, dreadUntil = 0): MoraleGroup =>
    ({
      isDestroyed: false,
      morale,
      panicking: false,
      // Sem soldado nenhum, a tropa contaria como em menor número
      soldiers: [{}, {}, {}, {}],
      center: { x: 0, y: 0 },
      facing: 0,
      pendingDeaths: 0,
      pendingShock: 0,
      dreadUntil,
      mods: { moraleLoss: 1 },
      startingCount: 8,
      flanked: false,
      flankShockAt: -Infinity,
      leaderPassive: null,
      fatigueRecovery: 1,
      panic() {
        this.panicking = true;
      },
      rally() {
        this.panicking = false;
      },
    }) as unknown as MoraleGroup;

  it("enquanto dura o pavor, a tropa não se recompõe, nem perto da bandeira", () => {
    const calm = group(50);
    const dread = group(50, 10_000);
    for (let t = 0; t < 30; t++) {
      updateMorale(calm, [], null, 0.1, 1000 + t * 100, { seen: true, faltering: false });
      updateMorale(dread, [], null, 0.1, 1000 + t * 100, { seen: true, faltering: false });
    }
    expect(calm.morale).toBeGreaterThan(55);
    expect(dread.morale).toBe(50);
  });

  it("passado o pavor, a moral volta a subir", () => {
    const g = group(50, 1000);
    for (let t = 0; t < 30; t++) updateMorale(g, [], null, 0.1, 2000 + t * 100);
    expect(g.morale).toBeGreaterThan(55);
  });
});

describe("o arcano no store", () => {
  const make = (start: Partial<MagicState>) => {
    let state = { ...INITIAL_MAGIC, ...start } as unknown as GameState;
    const actions = magicSlice(
      (partial) => {
        state = { ...state, ...partial };
      },
      () => state,
    );
    return { actions, get: () => state };
  };

  it("gasta o arcano só de quem sabe a magia e tem o bastante", () => {
    const s = make({ spells: ["FIREBALL"], arcane: 100 });
    expect(s.actions.spendArcane("FIREBALL")).toBe(true);
    expect(s.get().arcane).toBe(100 - MAGIC.SPELLS.FIREBALL.cost);
    expect(s.actions.spendArcane("MEND")).toBe(false);
    expect(s.actions.spendArcane("FIREBALL")).toBe(true);
    expect(s.actions.spendArcane("FIREBALL")).toBe(false);
    expect(s.get().arcane).toBe(100 - 2 * MAGIC.SPELLS.FIREBALL.cost);
  });

  it("aprende uma vez, e o arcano só volta para quem sabe magia", () => {
    const s = make({});
    s.actions.restoreArcane(3);
    expect(s.get().arcane).toBe(0);
    s.actions.learnSpell("MEND");
    s.actions.learnSpell("MEND");
    expect(s.get().spells).toEqual(["MEND"]);
    s.actions.restoreArcane(1);
    expect(s.get().arcane).toBe(MAGIC.ARCANE_PER_DAY);
  });
});

describe("aprender pelo mundo (Marco 19, parte 3)", () => {
  /** O slice com o resto do store de mentira: o relógio conta os dias e a crônica guarda o texto. */
  const make = (start: Record<string, unknown>) => {
    const told: string[] = [];
    let days = 0;
    let state = {
      ...INITIAL_MAGIC,
      gold: 0,
      leader: { name: "Aldo" },
      captiveOfficers: [],
      settlements: [],
      world: { culture: "REALMS" },
      ...start,
    } as unknown as GameState;
    const actions = magicSlice(
      (partial) => {
        state = { ...state, ...partial };
      },
      () => state,
    );
    state = {
      ...state,
      ...actions,
      chronicle: (text: string) => told.push(text),
      advanceTime: (d: number) => {
        days += d;
      },
    } as GameState;
    return { actions, get: () => state, told, days: () => days };
  };

  it("o Comandante começa sem magia, e cada magia tem um caminho no mundo", () => {
    expect(INITIAL_MAGIC.spells).toEqual([]);
    expect(INITIAL_MAGIC.arcane).toBe(0);
    for (const s of SPELL_IDS) expect(waysToLearn(s).length).toBeGreaterThan(0);
    // Na terra do bando não há mestre: é preciso cruzar o mar
    expect(masterOffers("REALMS", [])).toEqual([]);
    expect(masterOffers("SANDS", ["TERROR"])).toEqual(["FIREBALL"]);
  });

  it("cada ruína dá o seu grimório uma vez só, e estudar leva dias", () => {
    const s = make({});
    expect(s.actions.searchRuins("ruina-1")).toEqual({ spell: RUIN_SPELLS[0] });
    expect(s.actions.searchRuins("ruina-1")).toBeNull();
    expect(s.actions.searchRuins("ruina-2")).toEqual({ spell: RUIN_SPELLS[1] });
    expect(s.get().grimoires).toEqual([RUIN_SPELLS[0], RUIN_SPELLS[1]]);
    expect(s.actions.studyGrimoire("TERROR")).toMatch(/não tem esse grimório/);
    expect(s.actions.studyGrimoire(RUIN_SPELLS[0])).toBeNull();
    expect(s.get().spells).toEqual([RUIN_SPELLS[0]]);
    expect(s.get().grimoires).toEqual([RUIN_SPELLS[1]]);
    expect(s.days()).toBe(MAGIC.LEARN.GRIMOIRE_DAYS);
    // O que já sabe ou já tem em grimório não volta das ruínas
    expect(nextGrimoire([RUIN_SPELLS[0]], [RUIN_SPELLS[1]])).toBe(RUIN_SPELLS[2]);
    expect(nextGrimoire([...RUIN_SPELLS], [])).toBeNull();
  });

  it("o mago da corte sabe uma magia que o Comandante não sabe, e cada corte começa num ponto", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `S${i}`);
    const first = ids.map((id) => courtMageSpell(id, []));
    expect(first.every((s) => s && COURT_SPELLS.includes(s))).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(1);
    expect(courtMageSpell("S1", [])).toBe(courtMageSpell("S1", []));
    expect(courtMageSpell("S1", [...COURT_SPELLS])).toBeNull();
    const known = courtMageSpell("S1", []);
    expect(courtMageSpell("S1", known ? [known] : [])).not.toBe(known);
  });

  it("o mago da corte preso ensina à força: leva dias e o resgate se perde", () => {
    const s = make({
      captiveOfficers: [
        { id: "o1", name: "o mago da corte de Vau", factionId: null, nobleId: null, ransom: 250, day: 0, questioned: false, mage: "DOUSE" },
        { id: "o2", name: "um capitão", factionId: null, nobleId: null, ransom: 80, day: 0, questioned: false },
      ],
    });
    expect(s.actions.learnFromCaptive("o2")).toMatch(/não sabe magia/);
    expect(s.actions.learnFromCaptive("o1")).toBeNull();
    expect(s.get().spells).toEqual(["DOUSE"]);
    expect(s.get().captiveOfficers.map((o) => o.id)).toEqual(["o2"]);
    expect(s.days()).toBe(MAGIC.LEARN.COURT_DAYS);
  });

  it("o mestre de outra terra cobra ouro e dias, e só ensina o que sabe", () => {
    const towns = [
      { id: "C", name: "Qasr", kind: "CITY", owner: "F1" },
      { id: "V", name: "Aldeia", kind: "VILLAGE", owner: "F1" },
    ];
    const s = make({ settlements: towns, world: { culture: "SANDS" }, gold: MAGIC.LEARN.MASTER_GOLD - 1 });
    expect(s.actions.learnFromMaster("C", "TERROR")).toMatch(/cobra/);
    s.get().gold = MAGIC.LEARN.MASTER_GOLD + 100;
    expect(s.actions.learnFromMaster("V", "TERROR")).toMatch(/Não há mestre/);
    expect(s.actions.learnFromMaster("C", "MIST")).toMatch(/não ensina/);
    expect(s.actions.learnFromMaster("C", "TERROR")).toBeNull();
    expect(s.get().spells).toEqual(["TERROR"]);
    expect(s.get().gold).toBe(100);
    expect(s.days()).toBe(MAGIC.LEARN.MASTER_DAYS);
    expect(s.actions.learnFromMaster("C", "TERROR")).toMatch(/não ensina/);
    // Na terra do bando, ninguém ensina
    const home = make({ settlements: towns, gold: 5000 });
    expect(home.actions.learnFromMaster("C", "TERROR")).toMatch(/não ensina/);
  });
});

describe("o preço da magia (Marco 19, parte 4)", () => {
  const make = (start: Record<string, unknown>) => {
    const told: string[] = [];
    let state = { ...INITIAL_MAGIC, honor: 50, fear: 10, day: 3, leader: { name: "Aldo", traits: [], wounds: 0 }, ...start } as unknown as GameState;
    const actions = magicSlice(
      (partial) => {
        state = { ...state, ...partial };
      },
      () => state,
    );
    state = { ...state, ...actions, chronicle: (text: string) => told.push(text) } as GameState;
    return { actions, get: () => state, told };
  };

  it("as que ferem e assustam custam mais Honra e trazem mais Temor; o amuleto corta pela metade", () => {
    expect(magicPrice("FIREBALL")).toEqual({ honor: 3, fear: 3 });
    expect(magicPrice("TERROR")).toEqual({ honor: 4, fear: 4 });
    expect(magicPrice("MEND")).toEqual({ honor: 1, fear: 0 });
    expect(magicPrice("FIREBALL", ["AMULET"])).toEqual({ honor: 2, fear: 2 });
    expect(magicPrice("TERROR", ["AMULET"])).toEqual({ honor: 2, fear: 2 });
    for (const s of SPELL_IDS) expect(magicPrice(s).honor).toBeGreaterThan(0);
  });

  it("as marcas vêm com o arcano gasto, até quatro; o cálice as faz vir mais devagar", () => {
    const E = MAGIC.MARKS.EVERY;
    expect(marksFor(0)).toBe(0);
    expect(marksFor(E - 1)).toBe(0);
    expect(marksFor(E)).toBe(1);
    expect(marksFor(E * 10)).toBe(MAGIC.MARKS.MAX);
    expect(markWeight(40)).toBe(40);
    expect(markWeight(40, ["CHALICE"])).toBeLessThan(40);
    // Cada marca tira um pouco da vida do Comandante
    expect(leaderBonus({ traits: [], wounds: 0, marks: 2 }).hp).toBeCloseTo(1 - 2 * MAGIC.MARKS.HP);
    expect(leaderBonus({ traits: [], wounds: 0 }).hp).toBe(1);
  });

  it("a pedra do arcano enche mais o arcano, e cada artefato vem uma vez", () => {
    expect(arcaneMax()).toBe(MAGIC.ARCANE_MAX);
    expect(arcaneMax(["STONE"])).toBe(MAGIC.ARCANE_MAX + MAGIC.ARTIFACTS.STONE.arcane);
    expect(arcaneAfter(MAGIC.ARCANE_MAX, 5, arcaneMax(["STONE"]))).toBe(arcaneMax(["STONE"]));
    expect(nextArtifact([])).toBe("STONE");
    expect(nextArtifact(["STONE", "AMULET", "CHALICE"])).toBeNull();
  });

  it("lançar cobra das cortes e dos templos, a crônica fala uma vez por dia, e o corpo marca", () => {
    const s = make({ arcaneSpent: MAGIC.MARKS.EVERY - 50 });
    expect(s.actions.payForMagic("MEND")).toBe(0);
    expect(s.get().honor).toBe(49);
    expect(s.get().fear).toBe(10);
    expect(s.actions.payForMagic("FIREBALL")).toBe(1);
    expect(s.get().honor).toBe(46);
    expect(s.get().fear).toBe(13);
    expect(s.get().leader.marks).toBe(1);
    expect(s.told.filter((t) => /Corre a notícia/.test(t))).toHaveLength(1);
    expect(s.told.filter((t) => /marca nova/.test(t))).toHaveLength(1);
    // No dia seguinte, a notícia corre de novo
    s.get().day = 4;
    s.actions.payForMagic("FIREBALL");
    expect(s.told.filter((t) => /Corre a notícia/.test(t))).toHaveLength(2);
  });

  it("sem grimório a achar, as ruínas dão um artefato", () => {
    const s = make({ spells: [...RUIN_SPELLS] });
    expect(s.actions.searchRuins("ruina-1")).toEqual({ artifact: "STONE" });
    expect(s.actions.searchRuins("ruina-1")).toBeNull();
    expect(s.actions.searchRuins("ruina-2")).toEqual({ artifact: "AMULET" });
    expect(s.actions.gainArtifact("Entre as coisas do necromante")).toBe("CHALICE");
    expect(s.actions.searchRuins("ruina-3")).toBeNull();
    expect(s.get().artifacts).toEqual(["STONE", "AMULET", "CHALICE"]);
  });

  it("cada marca muda o retrato do Comandante, e a quarta embranquece o cabelo", () => {
    const base: PortraitSpec = { seed: "Aldo#1", female: false, age: 30, culture: "REALMS", scars: 0, role: "COMMANDER", color: 0x3a6ac8 };
    const keys = [0, 1, 2, 3, 4].map((marks) => portraitKey({ ...base, marks }));
    expect(new Set(keys).size).toBe(5);
    const pics = [0, 1, 2, 3, 4].map((marks) => Array.from(portraitBitmap({ ...base, marks }).rgba).join());
    for (let i = 1; i < pics.length; i++) expect(pics[i]).not.toBe(pics[i - 1]);
    // Com o tapa-olho, o olho claro vai para o outro lado (e o retrato ainda muda)
    const patched = [1, 2].map((marks) => Array.from(portraitBitmap({ ...base, scars: 4, marks }).rgba).join());
    expect(patched[0]).not.toBe(patched[1]);
  });
});

describe("a arte da magia", () => {
  it("a bola de fogo tem 4 quadros diferentes, o miolo aceso e os cantos vazios", () => {
    const b = fireballSheet();
    expect(b.width).toBe(FIREBALL_CELL * FIREBALL_FRAMES);
    expect(b.height).toBe(FIREBALL_CELL);
    const c = FIREBALL_CELL / 2;
    for (let f = 0; f < FIREBALL_FRAMES; f++) {
      expect(alpha(b, f * FIREBALL_CELL + c, c)).toBe(255);
      expect(alpha(b, f * FIREBALL_CELL, 0)).toBe(0);
    }
    const counts = Array.from({ length: FIREBALL_FRAMES }, (_, f) => painted(b, f, FIREBALL_CELL));
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("o clarão da explosão abre do miolo para a borda e se desfaz", () => {
    const b = blastSheet();
    expect(b.width).toBe(BLAST_CELL * BLAST_FRAMES);
    expect(b.height).toBe(BLAST_CELL);
    const R = BLAST_RADIUS;
    // No começo, o meio aceso e a borda vazia; no fim, algo perto da borda
    expect(alpha(b, R, R)).toBe(255);
    expect(alpha(b, R + Math.round(R * 0.9), R)).toBe(0);
    const last = (BLAST_FRAMES - 1) * BLAST_CELL;
    let edge = 0;
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      const x = Math.round(R + Math.cos(ang) * R * 0.97);
      const y = Math.round(R + Math.sin(ang) * R * 0.97);
      if (alpha(b, last + Math.min(BLAST_CELL - 1, x), Math.min(BLAST_CELL - 1, y)) > 0) edge++;
    }
    expect(edge).toBeGreaterThan(5);
    // Nada fora do círculo da área
    for (let f = 0; f < BLAST_FRAMES; f++) expect(alpha(b, f * BLAST_CELL, 0)).toBe(0);
    // O último quadro tem menos fogo que o primeiro (o anel se quebra)
    expect(painted(b, BLAST_FRAMES - 1, BLAST_CELL)).toBeLessThan(painted(b, 2, BLAST_CELL));
  });

  it("o anel da magia corre até a borda e se desfaz, sem sair do círculo", () => {
    const r = 60;
    const b = ringSheet(r);
    const C = r * 2;
    expect(b.width).toBe(C * RING_FRAMES);
    expect(b.height).toBe(C);
    // O primeiro quadro é um anel perto do meio; o último, perto da borda e mais ralo
    const radiusOf = (f: number) => {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < C; y++) {
        for (let x = 0; x < C; x++) {
          if (alpha(b, f * C + x, y) === 0) continue;
          sum += Math.hypot(x + 0.5 - r, y + 0.5 - r);
          n++;
        }
      }
      return { mean: sum / Math.max(1, n), n };
    };
    const first = radiusOf(0);
    const last = radiusOf(RING_FRAMES - 1);
    expect(first.mean).toBeLessThan(r * 0.6);
    expect(last.mean).toBeGreaterThan(r * 0.85);
    expect(last.n).toBeLessThan(first.n * 2);
    expect(alpha(b, r, r)).toBe(0);
    expect(alpha(b, 0, 0)).toBe(0);
  });

  it("o brilho da cura cresce e se apaga em 4 quadros", () => {
    const b = mendSheet();
    expect(b.width).toBe(MEND_CELL * MEND_FRAMES);
    const counts = Array.from({ length: MEND_FRAMES }, (_, f) => painted(b, f, MEND_CELL));
    expect(counts[0]).toBe(1);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeLessThan(counts[2]);
  });
});

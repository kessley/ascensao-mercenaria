import { describe, expect, it } from "vitest";
import {
  Chatter,
  TROOP_VOICE,
  barkForOrder,
  barkSyllables,
  barkWord,
  enemyVoice,
  personTimbre,
  phoneOf,
  syllabify,
  utter,
  variantsOf,
  type Bark,
} from "../../src/audio/speech";
import type { TongueId } from "../../src/game/worldgen/names";

const TONGUES: TongueId[] = ["REALMS", "SANDS", "ISLES", "JADE"];
const BARKS: Bark[] = ["select", "move", "attack", "hold", "retreat", "panic", "tired", "cheer", "confused", "taunt", "warcry", "hup"];
const fixed = () => 0.5;

describe("as sílabas", () => {
  it("separa as palavras de cada língua como a boca separa", () => {
    expect(syllabify("pedralva")).toEqual(["pe", "dral", "va"]);
    expect(syllabify("zahabad")).toEqual(["za", "ha", "bad"]);
    expect(syllabify("skarvik")).toEqual(["skar", "vik"]);
    expect(syllabify("linzhou")).toEqual(["lin", "zhou"]);
    expect(syllabify("qingshan")).toEqual(["qing", "shan"]);
  });

  it("não perde letra nenhuma", () => {
    for (const w of ["montária", "estonte", "thorfjord", "shareh", "fengling", "bjorholm"]) {
      expect(syllabify(w).join("")).toBe(w);
    }
  });

  it("cada sílaba sabe como abre, que vogal tem e como fecha", () => {
    expect(phoneOf("dral")).toMatchObject({ onset: "plosive", vowel: "a", coda: "none", glide: null });
    expect(phoneOf("zhou")).toMatchObject({ onset: "fricative", sharp: true, vowel: "o", glide: "u" });
    expect(phoneOf("lin")).toMatchObject({ onset: "liquid", vowel: "i", coda: "nasal" });
    expect(phoneOf("mar")).toMatchObject({ onset: "nasal", vowel: "a" });
    expect(phoneOf("ash")).toMatchObject({ onset: "none", vowel: "a", coda: "fricative" });
    expect(phoneOf("vik")).toMatchObject({ onset: "fricative", sharp: false, vowel: "i", coda: "plosive" });
  });
});

describe("a palavra de cada fala", () => {
  it("é sempre a mesma para a mesma língua e a mesma fala", () => {
    for (const t of TONGUES) for (const b of BARKS) expect(barkWord(b, 0, t)).toBe(barkWord(b, 0, t));
  });

  it("cada língua tem a sua", () => {
    for (const b of ["select", "move", "attack", "retreat"] as Bark[]) {
      const words = new Set(TONGUES.map((t) => barkWord(b, 0, t)));
      expect(words.size).toBe(TONGUES.length);
    }
  });

  it("selecionado tem três variações, e as três são palavras diferentes", () => {
    expect(variantsOf("select")).toBe(3);
    for (const t of TONGUES) expect(new Set([0, 1, 2].map((v) => barkWord("select", v, t))).size).toBe(3);
  });

  it("tem o número de sílabas que a melodia pede", () => {
    for (const t of TONGUES) {
      expect(barkSyllables("select", 0, t)).toHaveLength(2);
      expect(barkSyllables("select", 2, t)).toHaveLength(3);
      expect(barkSyllables("retreat", 0, t)).toHaveLength(3);
      expect(barkSyllables("cheer", 0, t)).toHaveLength(1);
    }
  });

  it("goblin, orc e morto-vivo falam com as próprias sílabas, não com as da terra", () => {
    const human = barkWord("taunt", 0, "REALMS");
    for (const s of ["goblin", "orc", "undead"] as const) {
      const word = barkWord("taunt", 0, "REALMS", s);
      expect(word).not.toBe(human);
      expect(barkWord("taunt", 0, "JADE", s)).toBe(word);
    }
  });
});

describe("a voz de cada um", () => {
  it("a guarda pesada é a mais grave, os arqueiros são leves e a infantaria fica no meio", () => {
    expect(TROOP_VOICE.HEAVY.pitch).toBeLessThan(TROOP_VOICE.INFANTRY.pitch);
    expect(TROOP_VOICE.INFANTRY.pitch).toBeLessThan(TROOP_VOICE.CAVALRY.pitch);
    expect(TROOP_VOICE.CAVALRY.pitch).toBeLessThan(TROOP_VOICE.ARCHERS.pitch);
    expect(TROOP_VOICE.KNIGHTS.pitch).toBeLessThan(TROOP_VOICE.CAVALRY.pitch);
  });

  it("a mesma pessoa tem sempre a mesma voz, e duas pessoas, vozes diferentes", () => {
    expect(personTimbre("tenente-1", false)).toEqual(personTimbre("tenente-1", false));
    expect(personTimbre("tenente-1", false).pitch).not.toBe(personTimbre("tenente-2", false).pitch);
  });

  it("mulher fala mais agudo que homem", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      expect(personTimbre(seed, true).pitch).toBeGreaterThan(personTimbre(seed, false).pitch * 1.25);
    }
  });

  it("o goblin guincha, o orc ruge, o morto sussurra e o bandido pragueja com voz de gente", () => {
    const goblin = enemyVoice("GOBLIN");
    const orc = enemyVoice("ORC_BRUTE");
    const dead = enemyVoice("SKELETON");
    const bandit = enemyVoice("BANDIT");
    const soldier = enemyVoice("SOLDIER");
    expect(goblin?.species).toBe("goblin");
    expect(orc?.species).toBe("orc");
    expect(dead?.timbre.whisper).toBe(true);
    expect(goblin && orc && goblin.timbre.pitch > orc.timbre.pitch * 3).toBe(true);
    expect(bandit?.species).toBe("human");
    expect(bandit && soldier && bandit.timbre.rough > soldier.timbre.rough).toBe(true);
  });

  it("tropa de ultramar fala a língua de onde vem; lobo, carroça e aríete não falam", () => {
    expect(enemyVoice("MAMELUKE")?.tongue).toBe("SANDS");
    expect(enemyVoice("HOUSECARL")?.tongue).toBe("ISLES");
    expect(enemyVoice("JADE_GUARD")?.tongue).toBe("JADE");
    expect(enemyVoice("SOLDIER")?.tongue).toBeNull();
    expect(enemyVoice("WOLF")).toBeNull();
    expect(enemyVoice("CART")).toBeNull();
    expect(enemyVoice("SIEGE_RAM")).toBeNull();
  });
});

describe("a fala montada", () => {
  it("as sílabas vêm uma atrás da outra, sem buraco e sem sobra", () => {
    for (const t of TONGUES) {
      for (const b of BARKS) {
        const u = utter({ bark: b, tongue: t, timbre: TROOP_VOICE.INFANTRY, random: fixed });
        expect(u.phones.length).toBeGreaterThan(0);
        let at = 0;
        for (const p of u.phones) {
          expect(p.at).toBeCloseTo(at, 6);
          expect(p.dur).toBeGreaterThanOrEqual(0.11);
          at += p.dur;
        }
        expect(u.seconds).toBeGreaterThan(at);
        expect(u.seconds).toBeLessThan(2);
      }
    }
  });

  it("selecionado sobe no fim (é pergunta) e alto desce (é firme)", () => {
    const ask = utter({ bark: "select", tongue: "REALMS", timbre: TROOP_VOICE.INFANTRY, variant: 0, random: fixed });
    const hold = utter({ bark: "hold", tongue: "REALMS", timbre: TROOP_VOICE.INFANTRY, random: fixed });
    expect(ask.phones[ask.phones.length - 1].f0End).toBeGreaterThan(ask.phones[0].f0 * 1.1);
    expect(hold.phones[hold.phones.length - 1].f0End).toBeLessThan(hold.phones[0].f0);
  });

  it("atacar é mais agudo e mais forte que marchar", () => {
    const attack = utter({ bark: "attack", tongue: "ISLES", timbre: TROOP_VOICE.INFANTRY, variant: 0, random: fixed });
    const move = utter({ bark: "move", tongue: "ISLES", timbre: TROOP_VOICE.INFANTRY, variant: 0, random: fixed });
    expect(attack.phones[0].f0).toBeGreaterThan(move.phones[0].f0);
    expect(attack.phones[0].gain).toBeGreaterThan(move.phones[0].gain);
  });

  it("o pânico é de várias gargantas e treme; o cansaço é devagar e com ar", () => {
    const panic = utter({ bark: "panic", tongue: "REALMS", timbre: TROOP_VOICE.INFANTRY, random: fixed });
    const tired = utter({ bark: "tired", tongue: "REALMS", timbre: TROOP_VOICE.INFANTRY, random: fixed });
    const move = utter({ bark: "move", tongue: "REALMS", timbre: TROOP_VOICE.INFANTRY, variant: 0, random: fixed });
    expect(panic.voices).toBeGreaterThan(1);
    expect(panic.tremor).toBeGreaterThan(0);
    expect(tired.breath).toBeGreaterThan(0.3);
    expect(tired.phones[0].dur).toBeGreaterThan(move.phones[0].dur * 1.4);
  });

  it("a mesma fala na voz da guarda pesada sai mais grave que na dos arqueiros", () => {
    const low = utter({ bark: "select", tongue: "REALMS", timbre: TROOP_VOICE.HEAVY, variant: 0, random: fixed });
    const high = utter({ bark: "select", tongue: "REALMS", timbre: TROOP_VOICE.ARCHERS, variant: 0, random: fixed });
    expect(low.text).toBe(high.text);
    expect(low.phones[0].f0).toBeLessThan(high.phones[0].f0 * 0.7);
  });

  it("a língua do jade é a que mais sobe e desce dentro de cada sílaba", () => {
    const sway = (t: TongueId): number => {
      let total = 0;
      let n = 0;
      for (const b of ["move", "retreat", "select"] as Bark[]) {
        for (let v = 0; v < variantsOf(b); v++) {
          const u = utter({ bark: b, tongue: t, timbre: TROOP_VOICE.INFANTRY, variant: v, random: fixed });
          for (let i = 0; i + 1 < u.phones.length; i++) {
            // O quanto o fim da sílaba se afasta da linha da melodia (onde a sílaba seguinte começa)
            total += Math.abs(u.phones[i].f0End / u.phones[i + 1].f0 - 1);
            n++;
          }
        }
      }
      return total / n;
    };
    expect(sway("JADE")).toBeGreaterThan(sway("REALMS") * 1.5);
    expect(sway("JADE")).toBeGreaterThan(sway("ISLES") * 1.5);
  });
});

describe("a vez de falar", () => {
  it("uma ordem dada a cinco batalhões é respondida por um só", () => {
    const c = new Chatter();
    const answered = ["a", "b", "c", "d", "e"].map((who, i) => c.allow(who, "move", 1000 + i));
    expect(answered).toEqual([true, false, false, false, false]);
  });

  it("no máximo uma fala a cada 250 ms", () => {
    const c = new Chatter();
    expect(c.allow("a", "select", 0)).toBe(true);
    expect(c.allow("b", "select", 200)).toBe(false);
    expect(c.allow("b", "select", 260)).toBe(true);
  });

  it("ninguém repete a própria fala em menos de um instante", () => {
    const c = new Chatter();
    expect(c.allow("a", "select", 0)).toBe(true);
    expect(c.allow("a", "select", 500)).toBe(false);
    expect(c.allow("a", "select", 950)).toBe(true);
  });

  it("o pânico não espera a vez", () => {
    const c = new Chatter();
    expect(c.allow("a", "move", 0)).toBe(true);
    expect(c.allow("b", "panic", 50)).toBe(true);
    expect(c.allow("c", "move", 100)).toBe(false);
  });

  it("as variações rodam: nunca a mesma duas vezes seguidas", () => {
    const c = new Chatter();
    const seq = Array.from({ length: 9 }, () => c.variant("a", "select"));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(new Set(seq).size).toBe(3);
  });
});

describe("que fala responde a cada ordem", () => {
  it("atacar, segurar, recuar e marchar têm cada um a sua", () => {
    expect(barkForOrder("Atacar")).toBe("attack");
    expect(barkForOrder("Foco no alvo")).toBe("attack");
    expect(barkForOrder("Carregar")).toBe("attack");
    expect(barkForOrder("Atirar à vontade")).toBe("attack");
    expect(barkForOrder("Alto")).toBe("hold");
    expect(barkForOrder("Cessar fogo")).toBe("hold");
    expect(barkForOrder("Postura: Defender")).toBe("hold");
    expect(barkForOrder("Recuar")).toBe("retreat");
    expect(barkForOrder("Voltar")).toBe("retreat");
    expect(barkForOrder("Marchar")).toBe("move");
    expect(barkForOrder("Posicionar")).toBe("move");
    expect(barkForOrder("Reunir ao estandarte")).toBe("move");
    expect(barkForOrder("Formação: Cunha")).toBe("move");
  });
});

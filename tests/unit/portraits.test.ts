import { describe, expect, it } from "vitest";
import type { Culture } from "../../src/game/art/buildings";
import { OUTLINE } from "../../src/game/art/pixel";
import { PORTRAIT_SIZE, agedHair, portraitBitmap, portraitKey, portraitTraits, type PortraitRole, type PortraitSpec } from "../../src/game/art/portraits";
import { BAND_HOME, captainPortrait, commanderPortrait, isWoman, lieutenantPortrait, noblePortrait } from "../../src/game/art/portraitSpecs";

const base: PortraitSpec = { seed: "teste", female: false, age: 30, culture: "REALMS", scars: 0, role: "CAPTAIN", color: 0x2f6fdf };

/** Quantos pixels mudam de um retrato para o outro. */
function diff(a: PortraitSpec, b: PortraitSpec): number {
  const x = portraitBitmap(a).rgba;
  const y = portraitBitmap(b).rgba;
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) n++;
  return n;
}

function has(spec: PortraitSpec, color: number): boolean {
  const px = portraitBitmap(spec).rgba;
  for (let i = 0; i < px.length; i += 4) if (((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]) === color) return true;
  return false;
}

describe("retratos (G5, parte 4)", () => {
  it("cada cultura e cada papel dá um busto de 32×32 cheio, com o contorno", () => {
    const cultures: Culture[] = ["REALMS", "SANDS", "ISLES", "JADE"];
    const roles: PortraitRole[] = ["COMMANDER", "CAPTAIN", "LIEUTENANT", "NOBLE"];
    for (const culture of cultures) {
      for (const role of roles) {
        for (const female of [false, true]) {
          const bm = portraitBitmap({ ...base, seed: `${culture}${role}${female}`, culture, role, female });
          expect(bm.width).toBe(PORTRAIT_SIZE);
          expect(bm.height).toBe(PORTRAIT_SIZE);
          // O fundo cobre tudo: nenhum pixel transparente
          for (let i = 3; i < bm.rgba.length; i += 4) expect(bm.rgba[i]).toBe(255);
        }
      }
    }
    expect(has(base, OUTLINE)).toBe(true);
  });

  it("o mesmo personagem tem sempre o mesmo rosto, e outro personagem tem outro", () => {
    expect(portraitTraits(base)).toEqual(portraitTraits({ ...base }));
    expect(diff(base, { ...base, seed: "outro" })).toBeGreaterThan(0);
    // Ao envelhecer, a pele e o penteado não trocam
    const young = portraitTraits(base);
    const old = portraitTraits({ ...base, age: 41 });
    expect(old.skin).toBe(young.skin);
    expect(old.hair).toBe(young.hair);
  });

  it("a idade branqueia o cabelo e marca o rosto", () => {
    expect(agedHair(0x3a2618, 30)).toBe(0x3a2618);
    const grey = agedHair(0x3a2618, 68);
    expect((grey >> 16) & 255).toBeGreaterThan(0xa0);
    expect(diff(base, { ...base, age: 62 })).toBeGreaterThan(10);
    // A chave da imagem guardada muda de 5 em 5 anos, não a cada dia
    expect(portraitKey({ ...base, age: 31 })).toBe(portraitKey({ ...base, age: 33 }));
  });

  it("cada cicatriz deixa uma marca, e a quarta põe o tapa-olho", () => {
    const counts = [0, 1, 2, 3, 4].map((scars) => diff(base, { ...base, scars }));
    expect(counts[0]).toBe(0);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(has({ ...base, scars: 3 }, 0x2a2020)).toBe(false);
    expect(has({ ...base, scars: 4 }, 0x2a2020)).toBe(true);
  });

  it("de quem é o retrato: sexo, terra, coroa e o rosto do herdeiro", () => {
    expect(isWoman("Ysolde")).toBe(true);
    expect(isWoman("Brunhild a Brava")).toBe(true);
    expect(isWoman("Garrick")).toBe(false);
    // A terra é a guardada em cada um (Marco 23); sem ela, a terra natal do bando
    const lt = lieutenantPortrait({ id: "lt-7", name: "Oda", kills: 0, culture: "JADE" });
    expect(lt.culture).toBe("JADE");
    expect(lieutenantPortrait({ id: "lt-8", name: "Bran", kills: 0 }).culture).toBe(BAND_HOME);
    // O tenente que herda o estandarte leva o rosto e a terra
    const heir = commanderPortrait({ name: "Oda", generation: 2, wounds: 0, face: "lt-7", culture: "JADE" }, 30);
    expect(heir.seed).toBe(lt.seed);
    expect(heir.culture).toBe(lt.culture);
    expect(heir.female).toBe(true);
    // O fundador vem da terra natal do bando
    expect(commanderPortrait({ name: "Aldo", generation: 1, wounds: 2 }, 40).culture).toBe(BAND_HOME);
    // O capitão promovido mantém o rosto do tenente; as batalhas deixam cicatrizes
    const cap = captainPortrait({ id: "lt-7", name: "Oda", origin: "PROMOTED", battles: 12, culture: "JADE" }, "REALMS");
    expect(cap.seed).toBe(lt.seed);
    expect(cap.scars).toBe(2);
    // Sem terra guardada, o inimigo que mudou de lado é da terra onde foi pego
    expect(captainPortrait({ id: "c1", name: "Harun", origin: "CAPTURED", battles: 0 }, "SANDS").culture).toBe("SANDS");
    // A coroa é do rei; o diadema, do consorte e do herdeiro
    const noble = { id: "n1", female: true, age: 50, martial: 3 };
    expect(noblePortrait({ ...noble, rank: "RULER" }, 0xaa0000, "REALMS").crown).toBe("CROWN");
    expect(noblePortrait({ ...noble, rank: "HEIR" }, 0xaa0000, "REALMS").crown).toBe("CIRCLET");
    expect(noblePortrait({ ...noble, rank: "LORD" }, 0xaa0000, "REALMS").crown).toBeUndefined();
  });
});

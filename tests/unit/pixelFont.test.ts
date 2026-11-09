import { describe, expect, it } from "vitest";
import { FONT_ROWS, buildPixelFont, fontChars, glyphBitmap, glyphRects } from "../../src/game/art/font";

/** As tabelas do arquivo: etiqueta → [início, tamanho]. */
function tables(font: Uint8Array): Map<string, [number, number]> {
  const v = new DataView(font.buffer);
  const n = v.getUint16(4);
  const out = new Map<string, [number, number]>();
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...font.slice(at, at + 4));
    out.set(tag, [v.getUint32(at + 8), v.getUint32(at + 12)]);
  }
  return out;
}

function sum(font: Uint8Array, start: number, length: number): number {
  let s = 0;
  for (let i = start; i < start + length; i += 4) {
    const w = ((font[i] ?? 0) << 24) | ((i + 1 < start + length ? font[i + 1] : 0) << 16) | ((i + 2 < start + length ? font[i + 2] : 0) << 8) | (i + 3 < start + length ? font[i + 3] : 0);
    s = (s + (w >>> 0)) >>> 0;
  }
  return s;
}

/** O glifo de um caractere pela tabela cmap (formato 4), como o navegador acha. */
function glyphId(font: Uint8Array, code: number): number {
  const v = new DataView(font.buffer);
  const [cmap] = tables(font).get("cmap")!;
  const sub = cmap + v.getUint32(cmap + 8);
  const segX2 = v.getUint16(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  for (let i = 0; i < segX2 / 2; i++) {
    const end = v.getUint16(ends + i * 2);
    if (code > end) continue;
    const start = v.getUint16(starts + i * 2);
    if (code < start) return 0;
    return (code + v.getUint16(deltas + i * 2)) % 65536;
  }
  return 0;
}

describe("a fonte de pixel", () => {
  for (const bold of [false, true]) {
    it(`o arquivo TrueType ${bold ? "negrito" : "regular"} é íntegro`, () => {
      const font = buildPixelFont(bold);
      const v = new DataView(font.buffer);
      const t = tables(font);
      expect([...t.keys()]).toEqual(["OS/2", "cmap", "glyf", "head", "hhea", "hmtx", "loca", "maxp", "name", "post"]);
      // A soma de cada tabela (a do head conta com o ajuste zerado) e a do arquivo inteiro
      const dirSum = (tag: string) => v.getUint32(12 + [...t.keys()].indexOf(tag) * 16 + 4);
      for (const [tag, [start, length]] of t) {
        if (tag === "head") continue;
        expect(sum(font, start, length), tag).toBe(dirSum(tag));
      }
      expect(sum(font, 0, font.length)).toBe(0xb1b0afba);
      // Glifos, métricas e posições batem
      const [maxp] = t.get("maxp")!;
      const [hhea] = t.get("hhea")!;
      const glyphs = v.getUint16(maxp + 4);
      expect(v.getUint16(hhea + 34)).toBe(glyphs);
      expect(t.get("hmtx")![1]).toBe(glyphs * 4);
      const [loca, locaLen] = t.get("loca")!;
      expect(locaLen).toBe((glyphs + 1) * 4);
      let prev = 0;
      for (let i = 0; i <= glyphs; i++) {
        const at = v.getUint32(loca + i * 4);
        expect(at).toBeGreaterThanOrEqual(prev);
        prev = at;
      }
      expect(prev).toBe(t.get("glyf")![1]);
      expect(v.getUint32(t.get("head")![0] + 12)).toBe(0x5f0f3cf5);
    });
  }

  it("tem todas as letras do português e os sinais que os textos usam", () => {
    const font = buildPixelFont();
    const need = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?()-+/%" + "áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ" + "·−—–…×●★✓✗ªº▲▼■□→↔⚑";
    for (const ch of need) expect(glyphId(font, ch.codePointAt(0)!), ch).toBeGreaterThan(0);
    // O que a fonte não tem cai no glifo 0, e o navegador usa a fonte seguinte
    expect(glyphId(font, 0x1f525)).toBe(0);
  });

  it("os retângulos do contorno cobrem a tinta exata de cada letra", () => {
    for (const ch of fontChars()) {
      for (const bold of [false, true]) {
        const bm = glyphBitmap(ch, bold)!;
        let ink = 0;
        for (const row of bm.ink) for (const x of row) if (x) ink++;
        const cells = new Set<string>();
        for (const r of glyphRects(bm)) for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) cells.add(`${x},${y}`);
        expect(cells.size, ch).toBe(ink);
        for (const k of cells) {
          const [x, y] = k.split(",").map(Number);
          expect(bm.ink[y][x]).toBe(true);
        }
      }
    }
  });

  it("acentos ficam acima da letra, sem encostar nela", () => {
    const top = (ch: string) => glyphBitmap(ch)!.ink.findIndex((row) => row.some(Boolean));
    // Maiúscula: acento nas linhas 0 e 1, a letra começa na 3
    expect(top("Á")).toBe(0);
    expect(glyphBitmap("Á")!.ink[2].some(Boolean)).toBe(false);
    // Minúscula: acento nas linhas 2 e 3, a letra começa na 5
    expect(top("ã")).toBe(2);
    expect(glyphBitmap("ã")!.ink[4].some(Boolean)).toBe(false);
    // A cedilha desce abaixo da linha de base
    expect(glyphBitmap("ç")!.ink[FONT_ROWS - 1].some(Boolean)).toBe(true);
  });

  it("o negrito não fecha as pernas do m", () => {
    const m = glyphBitmap("m", true)!;
    // Linha de baixo do m: três hastes, com vão entre elas
    const row = m.ink[9].map((x) => (x ? "X" : ".")).join("");
    expect(row).toBe("XX.XX.XX");
    expect(glyphBitmap("m")!.width).toBe(5);
  });
});

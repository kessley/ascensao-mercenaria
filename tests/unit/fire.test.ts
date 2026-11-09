import { describe, expect, it } from "vitest";
import { FIRE_PALETTE, FLAMES, flameSheet, flicker, heatColor, litPixels, type FlameKind } from "../../src/game/art/fire";
import { OUTLINE } from "../../src/game/art/pixel";

const KINDS: FlameKind[] = ["BONFIRE", "TORCH", "HELD", "EMBER"];

/** Os pixels de um quadro, como texto (para comparar quadros). */
function frameKey(kind: FlameKind, f: number): string {
  const b = flameSheet(kind);
  const cell = FLAMES[kind];
  let s = "";
  for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) s += b.rgba[(y * b.width + f * cell.w + x) * 4 + 3] ? `${b.rgba[(y * b.width + f * cell.w + x) * 4]},` : ".";
  return s;
}

describe("o fogo em pixel art (G6, parte 1)", () => {
  it("cada folha tem os quadros lado a lado, no tamanho da célula", () => {
    for (const k of KINDS) {
      const b = flameSheet(k);
      expect(b.width).toBe(FLAMES[k].w * FLAMES[k].frames);
      expect(b.height).toBe(FLAMES[k].h);
    }
  });

  it("a chama mexe: os quadros são diferentes, e nenhum fica apagado", () => {
    for (const k of KINDS) {
      const lit = litPixels(flameSheet(k), k);
      expect(Math.min(...lit), k).toBeGreaterThan(k === "BONFIRE" ? 120 : 6);
      const frames = new Set(Array.from({ length: FLAMES[k].frames }, (_, f) => frameKey(k, f)));
      expect(frames.size, k).toBe(FLAMES[k].frames);
    }
  });

  it("o fogo brilha: sem contorno escuro, só as cores da paleta (e o cabo da tocha da mão)", () => {
    const fire = new Set<number>(FIRE_PALETTE);
    for (const k of KINDS) {
      const b = flameSheet(k);
      const seen = new Set<number>();
      for (let i = 0; i < b.width * b.height; i++) {
        if (b.rgba[i * 4 + 3] === 0) continue;
        seen.add((b.rgba[i * 4] << 16) | (b.rgba[i * 4 + 1] << 8) | b.rgba[i * 4 + 2]);
      }
      expect(seen.has(OUTLINE), k).toBe(false);
      const other = [...seen].filter((c) => !fire.has(c));
      expect(other.length, k).toBe(k === "HELD" ? 3 : 0);
    }
  });

  it("o miolo claro fica embaixo e a ponta é vermelha", () => {
    const b = flameSheet("BONFIRE");
    const cell = FLAMES.BONFIRE;
    const rowsWith = (color: number) => {
      const rows: number[] = [];
      for (let y = 0; y < cell.h; y++) {
        for (let x = 0; x < cell.w; x++) {
          const i = (y * b.width + x) * 4;
          if (b.rgba[i + 3] && ((b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2]) === color) rows.push(y);
        }
      }
      return rows;
    };
    const avg = (r: number[]) => r.reduce((a, b) => a + b, 0) / r.length;
    expect(avg(rowsWith(FIRE_PALETTE[4]))).toBeGreaterThan(avg(rowsWith(FIRE_PALETTE[1])));
    expect(heatColor(0.02)).toBeNull();
    expect(heatColor(0.95)).toBe(FIRE_PALETTE[4]);
  });

  it("a luz tremula em volta de 1, cada chama no seu tempo, e a janela não treme", () => {
    const values = Array.from({ length: 200 }, (_, i) => flicker(100, 200, 0.06, i * 37));
    expect(Math.max(...values)).toBeLessThanOrEqual(1.06 + 1e-9);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.94 - 1e-9);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.06);
    expect(flicker(100, 200, 0.06, 5000)).not.toBeCloseTo(flicker(900, 340, 0.06, 5000), 3);
    expect(flicker(100, 200, 0, 5000)).toBe(1);
  });
});

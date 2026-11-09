import { describe, expect, it } from "vitest";
import { icePatch, ICE_COLORS, paintedPixels, scorchPatch, SCORCH_COLORS } from "../../src/game/art/placeArt";

const alphaAt = (b: { width: number; rgba: Uint8ClampedArray }, x: number, y: number) => b.rgba[(y * b.width + x) * 4 + 3];
const colorAt = (b: { width: number; rgba: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * b.width + x) * 4;
  return (b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2];
};

describe("o chão que a magia mexe (G6, parte 4)", () => {
  // Um rio de 60 px de largura atravessando o lugar na horizontal
  const river = (_dx: number, dy: number) => Math.abs(dy) < 30;

  it("o gelo só cobre a água, com a geada junto da margem e rachaduras por dentro", () => {
    const r = 100;
    const b = icePatch(r, river, 5);
    expect(b.width).toBe(r * 2);
    expect(b.height).toBe(r * 2);
    // Fora do rio, nada; no meio do rio, gelo
    for (const y of [r - 60, r + 60, 5, b.height - 5]) for (let x = r - 40; x <= r + 40; x += 10) expect(alphaAt(b, x, y), `(${x}, ${y})`).toBe(0);
    expect(alphaAt(b, r, r)).toBe(255);
    // A margem é geada
    expect(paintedPixels(b, ICE_COLORS.FROST)).toBeGreaterThan(100);
    let frostNearShore = 0;
    for (let x = r - 50; x <= r + 50; x++) if (colorAt(b, x, r - 28) === ICE_COLORS.FROST || colorAt(b, x, r + 28) === ICE_COLORS.FROST) frostNearShore++;
    expect(frostNearShore).toBeGreaterThan(60);
    // E há rachaduras e brilho
    expect(paintedPixels(b, ICE_COLORS.DARK)).toBeGreaterThan(10);
    expect(paintedPixels(b, ICE_COLORS.LIGHT)).toBeGreaterThan(10);
    // Sem água no lugar, sem gelo
    expect(paintedPixels(icePatch(80, () => false, 1))).toBe(0);
  });

  it("a borda do gelo se desfaz em pontilhado (o gelo se espalhando), e não num círculo cheio", () => {
    const r = 100;
    const b = icePatch(r, () => true, 2);
    const ring = (lo: number, hi: number) => {
      let on = 0;
      let all = 0;
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
          if (d < lo || d >= hi) continue;
          all++;
          if (alphaAt(b, x, y) > 0) on++;
        }
      }
      return on / all;
    };
    expect(ring(0, 0.6)).toBe(1);
    expect(ring(0.85, 1)).toBeLessThan(0.6);
    expect(ring(0.85, 1)).toBeGreaterThan(0.05);
  });

  it("o chão queimado é carvão no meio e cinza na borda, com pontos claros", () => {
    const r = 80;
    const b = scorchPatch(r, 4);
    expect(colorAt(b, r, r) === SCORCH_COLORS.CHAR || colorAt(b, r, r) === SCORCH_COLORS.GREY).toBe(true);
    expect(paintedPixels(b, SCORCH_COLORS.CHAR)).toBeGreaterThan(paintedPixels(b, SCORCH_COLORS.GREY) * 4);
    expect(paintedPixels(b, SCORCH_COLORS.ASH)).toBeGreaterThan(200);
    expect(paintedPixels(b, SCORCH_COLORS.GREY)).toBeGreaterThan(10);
    // Nada fora do raio, e a borda fica rala
    expect(alphaAt(b, 0, 0)).toBe(0);
    expect(alphaAt(b, b.width - 1, b.height - 1)).toBe(0);
    // Visto de lado: mais largo que alto
    let top = b.height;
    let left = b.width;
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (alphaAt(b, x, y) > 0) { top = Math.min(top, y); left = Math.min(left, x); }
    expect(top).toBeGreaterThan(left);
  });
});

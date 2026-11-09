import { describe, expect, it } from "vitest";
import { BUTTON_SLICE, BUTTON_STATES, BUTTON_TONES, FRAME_KINDS, FRAME_SLICE, buttonArt, frameArt } from "../../src/game/art/frames";
import type { Bitmap } from "../../src/game/art/pixel";

const alpha = (bm: Bitmap, x: number, y: number) => bm.rgba[(y * bm.width + x) * 4 + 3];
const color = (bm: Bitmap, x: number, y: number) => {
  const i = (y * bm.width + x) * 4;
  return (bm.rgba[i] << 16) | (bm.rgba[i + 1] << 8) | bm.rgba[i + 2];
};

describe("as molduras da interface", () => {
  it("cada moldura tem 9 partes do mesmo tamanho, com os cantos de fora vazios", () => {
    for (const kind of FRAME_KINDS) {
      const bm = frameArt(kind);
      expect(bm.width).toBe(FRAME_SLICE * 3);
      expect(bm.height).toBe(FRAME_SLICE * 3);
      for (const [x, y] of [
        [0, 0],
        [bm.width - 1, 0],
        [0, bm.height - 1],
        [bm.width - 1, bm.height - 1],
      ])
        expect(alpha(bm, x, y), kind).toBe(0);
      // A borda é opaca
      expect(alpha(bm, 1, FRAME_SLICE + 1), kind).toBe(255);
    }
  });

  it("o meio do ferro deixa ver o mundo; o da madeira e o do pergaminho quase não", () => {
    const mid = FRAME_SLICE + 2;
    expect(alpha(frameArt("IRON"), mid, mid)).toBeLessThan(230);
    expect(alpha(frameArt("WOOD"), mid, mid)).toBeGreaterThan(240);
    expect(alpha(frameArt("PARCHMENT"), mid, mid)).toBe(255);
  });

  it("os lados se repetem sem emenda: o veio da madeira volta a cada 6 pixels", () => {
    const bm = frameArt("WOOD");
    // O pedaço do meio da borda de cima (o que o CSS repete) tem um nó só na linha do veio,
    // e o resto da linha é da mesma tábua
    const row = 3;
    const tile = Array.from({ length: FRAME_SLICE }, (_, i) => color(bm, FRAME_SLICE + i, row));
    expect(new Set(tile).size).toBe(2);
    expect(tile.filter((c) => c === tile[0]).length === 1 || tile.filter((c) => c === tile[0]).length === FRAME_SLICE - 1).toBe(true);
  });

  it("os botões: cinco tons, três estados, e o apertado com a luz embaixo", () => {
    for (const tone of BUTTON_TONES) {
      const up = buttonArt(tone, "UP");
      const down = buttonArt(tone, "DOWN");
      const hover = buttonArt(tone, "HOVER");
      expect(up.width).toBe(BUTTON_SLICE * 3);
      // Em cima, a borda de cima é mais clara que a de baixo; apertado, o contrário
      const lum = (bm: Bitmap, y: number) => {
        const c = color(bm, 4, y);
        return ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
      };
      expect(lum(up, 1)).toBeGreaterThan(lum(up, up.height - 2));
      expect(lum(down, 1)).toBeLessThan(lum(down, down.height - 2));
      expect(lum(hover, 4)).toBeGreaterThan(lum(up, 4));
    }
    expect(BUTTON_STATES).toEqual(["UP", "HOVER", "DOWN"]);
  });
});

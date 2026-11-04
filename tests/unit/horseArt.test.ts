import { describe, expect, it } from "vitest";
import { ANIM, cellOf, figureSheet, type Look } from "../../src/game/art/figures";
import { troopLook } from "../../src/game/art/looks";
import type { Bitmap } from "../../src/game/art/pixel";

const ROW = { S: 0, E: 1, N: 2 } as const;
const BLAZE = 0xe8dccc;
const MANE = 0x2e2018;

/** A cor (0xRRGGBB, ou -1 se vazio) de um pixel de um quadro da folha. */
function pixel(l: Look, b: Bitmap, row: number, col: number, x: number, y: number): number {
  const { w, h } = cellOf(l);
  const i = ((row * h + y) * b.width + col * w + x) * 4;
  return b.rgba[i + 3] === 0 ? -1 : (b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2];
}

/** Largura da parte cheia de uma linha do quadro, de ponta a ponta. */
function span(l: Look, b: Bitmap, row: number, col: number, y: number): number {
  const { w } = cellOf(l);
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < w; x++) {
    if (pixel(l, b, row, col, x, y) < 0) continue;
    if (x0 < 0) x0 = x;
    x1 = x;
  }
  return x0 < 0 ? 0 : x1 - x0 + 1;
}

function has(l: Look, b: Bitmap, row: number, col: number, color: number): boolean {
  const { w, h } = cellOf(l);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixel(l, b, row, col, x, y) === color) return true;
  return false;
}

const HORSE: Look = { beast: "HORSE", body: "HUMAN", head: "BARE", armor: 0, weapon: "NONE", shield: "NONE", mount: "NONE", color: 0x7d5636 };

describe("o cavalo de frente e de costas", () => {
  it("é mais largo que quem vai em cima: a barriga sobra dos dois lados", () => {
    for (const l of [troopLook("CAVALRY"), troopLook("KNIGHTS"), troopLook("HORSE_ARCHERS"), HORSE]) {
      const b = figureSheet(l);
      const { feetY } = cellOf(l);
      for (const row of [ROW.S, ROW.N]) {
        // Algum lugar entre o lombo e a garupa (de 10 a 20 px acima dos pés) tem 14 px ou mais
        let widest = 0;
        for (let y = feetY - 20; y <= feetY - 10; y++) widest = Math.max(widest, span(l, b, row, ANIM.IDLE, y));
        expect(widest, `${l.mount}/${l.beast ?? ""} linha ${row}`).toBeGreaterThanOrEqual(14);
      }
    }
  });

  it("de frente, a cara tem a lista branca; no cavalo de barda, a testeira de ferro no lugar dela", () => {
    const plain = troopLook("CAVALRY");
    expect(has(plain, figureSheet(plain), ROW.S, ANIM.IDLE, BLAZE)).toBe(true);
    expect(has(plain, figureSheet(plain), ROW.N, ANIM.IDLE, BLAZE)).toBe(false);
    expect(has(HORSE, figureSheet(HORSE), ROW.S, ANIM.IDLE, BLAZE)).toBe(true);
    const knight = troopLook("KNIGHTS");
    expect(has(knight, figureSheet(knight), ROW.S, ANIM.IDLE, BLAZE)).toBe(false);
  });

  it("sem ninguém em cima, a cabeça de frente fica no alto, acima do lombo", () => {
    const b = figureSheet(HORSE);
    const { w, feetY } = cellOf(HORSE);
    // A orelha: o primeiro pixel cheio da figura, de cima para baixo
    let top = -1;
    for (let y = 0; y < feetY && top < 0; y++) for (let x = 0; x < w; x++) if (pixel(HORSE, b, ROW.S, ANIM.IDLE, x, y) >= 0) top = y;
    expect(feetY - top).toBeGreaterThanOrEqual(24);
  });

  it("de costas, o rabo desce entre as ancas e balança no passo", () => {
    for (const l of [troopLook("CAVALRY"), HORSE]) {
      const b = figureSheet(l);
      const { feetX, feetY } = cellOf(l);
      let mane = 0;
      for (let y = feetY - 16; y < feetY; y++) if ([feetX - 2, feetX - 1, feetX].some((x) => pixel(l, b, ROW.N, ANIM.IDLE, x, y) === MANE)) mane++;
      expect(mane, l.beast ?? l.mount).toBeGreaterThanOrEqual(8);
      // Dois quadros seguidos do passo não são iguais
      const a = [];
      const c = [];
      for (let y = 0; y < feetY + 2; y++) for (let x = 0; x < cellOf(l).w; x++) {
        a.push(pixel(l, b, ROW.N, ANIM.WALK, x, y));
        c.push(pixel(l, b, ROW.N, ANIM.WALK + 1, x, y));
      }
      expect(a.join(",") === c.join(",")).toBe(false);
    }
  });
});

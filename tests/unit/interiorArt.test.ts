import { describe, expect, it } from "vitest";
import { BACK_FACE, FLAT_FURNITURE, ROOM_WALL, furniturePiece, roomGrid } from "../../src/game/art/interiors";
import { ANIM, FRAMES, cellOf, figureSheet, type Look } from "../../src/game/art/figures";
import { folkLook, nobleLook, type FolkKind } from "../../src/game/art/looks";
import { CLEAR } from "../../src/game/art/pixel";
import type { FurnitureKind, InteriorStyle } from "../../src/game/data/interiors";

const KINDS: FurnitureKind[] = ["TABLE", "BED", "BARREL", "CRATE", "SACK", "FIRE", "ANVIL", "ALTAR", "RACK", "SHELF", "PERCH", "BENCH", "COUNTER", "CHEST", "BOARD", "HAY", "CARPET", "WATER", "BANNER", "IRON", "THRONE", "PILLAR", "BARS"];
/** Tamanhos que as salas usam de verdade (os finos são as grades da masmorra e os armeiros de parede). */
const SIZES: [number, number][] = [
  [80, 44],
  [44, 70],
  [24, 120],
  [12, 150],
  [110, 12],
  [200, 300],
  [320, 150],
  [34, 34],
  [560, 30],
];

describe("as salas por dentro, em pixel art", () => {
  it("a sala cobre o chão, as paredes e a parede do fundo, sem buraco", () => {
    for (const style of ["TENT", "WOOD", "STONE", "TEMPLE"] as InteriorStyle[]) {
      const g = roomGrid(style, 640, 460, 320, 7);
      expect(g.w, style).toBe(640 + ROOM_WALL * 2);
      expect(g.h, style).toBe(460 + ROOM_WALL * 2 + BACK_FACE);
      expect(g.data.every((c) => c !== CLEAR), style).toBe(true);
    }
  });

  it("o vão da porta é chão, com o tapete; o resto da parede de baixo não", () => {
    const g = roomGrid("WOOD", 640, 460, 320, 7);
    const y = ROOM_WALL + BACK_FACE + 460 + ROOM_WALL - 3;
    // No meio do vão, abaixo do tapete: tábua do chão; longe dele, o topo da parede (mais escuro)
    const gap = g.get(ROOM_WALL + 320, y);
    const wall = g.get(ROOM_WALL + 100, y);
    expect(gap).not.toBe(wall);
  });

  it("todo móvel sai desenhado, com o pé dentro da grade, em qualquer tamanho", () => {
    for (const kind of KINDS) {
      for (const [w, h] of SIZES) {
        const p = furniturePiece(kind, w, h, 0x6b4a2b, 3);
        expect(p, `${kind} ${w}x${h}`).not.toBeNull();
        if (!p) continue;
        expect(-p.dx, kind).toBeGreaterThanOrEqual(0);
        expect(-p.dy, kind).toBeGreaterThanOrEqual(0);
        expect(-p.dx + w, kind).toBeLessThanOrEqual(p.grid.w);
        expect(-p.dy + h, kind).toBeLessThanOrEqual(p.grid.h);
        expect(p.grid.data.some((c) => c >= 0), `${kind} ${w}x${h}`).toBe(true);
      }
    }
  });

  it("o que é rente ao chão tem o tamanho exato do pé; o que é alto sobe acima dele", () => {
    for (const kind of FLAT_FURNITURE) {
      const p = furniturePiece(kind, 120, 60, 0x7a2a22);
      if (kind === "IRON") continue;
      expect(p?.grid.w, kind).toBe(120);
      expect(p?.grid.h, kind).toBe(60);
    }
    for (const kind of ["SHELF", "PILLAR", "THRONE", "FIRE", "BANNER"] as FurnitureKind[]) {
      const p = furniturePiece(kind, 60, 40, 0x77716a);
      expect(-(p?.dy ?? 0), kind).toBeGreaterThan(20);
    }
  });

  it("o cavalo do estábulo não é peça: é figura", () => {
    expect(furniturePiece("HORSE", 40, 50, 0x7a5030)).toBeNull();
  });
});

describe("a gente das salas e da corte", () => {
  const cell = (l: Look, row: number, col: number) => {
    const b = figureSheet(l);
    const { w, h } = cellOf(l);
    const out: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(b.rgba[((row * h + y) * b.width + col * w + x) * 4 + 3]);
    return out;
  };

  it("guardas, nobres, escrivães, sacerdotes, ladrões e o rato têm folha inteira", () => {
    for (const k of ["GUARD", "NOBLE", "CLERK", "MERCHANT", "PRIEST", "THIEF", "WORKER", "RAT"] as FolkKind[]) {
      const l = folkLook(k);
      const b = figureSheet(l);
      expect(b.width, k).toBe(cellOf(l).w * FRAMES);
      expect(b.height, k).toBe(cellOf(l).h * 3);
    }
  });

  it("quem reina usa coroa nas três direções", () => {
    const crowned = nobleLook(0x8080d0, true);
    const plain = nobleLook(0x8080d0, false);
    for (const row of [0, 1, 2]) {
      const a = cell(crowned, row, ANIM.IDLE);
      const b = cell(plain, row, ANIM.IDLE);
      expect(a.some((v, i) => v !== b[i]), `linha ${row}`).toBe(true);
    }
  });

  it("o cavalo do estábulo é um cavalo na pelagem dada, sem galhada", () => {
    const base: Look = { beast: "HORSE", body: "HUMAN", head: "BARE", armor: 0, weapon: "NONE", shield: "NONE", mount: "NONE", color: 0x7a5030 };
    const deer = cell({ ...base, beast: "DEER" }, 1, ANIM.IDLE);
    const horse = cell(base, 1, ANIM.IDLE);
    expect(horse.some((v, i) => v !== deer[i])).toBe(true);
    const black = figureSheet({ ...base, color: 0x2a2020 });
    const bay = figureSheet(base);
    expect(black.rgba.some((v, i) => v !== bay.rgba[i])).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { ANIM, FRAMES, cellOf, figureSheet, type Look } from "../../src/game/art/figures";
import { folkLook, type FolkKind } from "../../src/game/art/looks";
import { ironLoadBitmap, stationPieces, type StationRole } from "../../src/game/art/campProps";
import type { Bitmap } from "../../src/game/art/pixel";

/** Os pixels de um quadro da folha de uma figura. */
function cell(l: Look, b: Bitmap, row: number, col: number): number[] {
  const { w, h } = cellOf(l);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((row * h + y) * b.width + col * w + x) * 4;
      out.push((b.rgba[i] << 24) | (b.rgba[i + 1] << 16) | (b.rgba[i + 2] << 8) | b.rgba[i + 3]);
    }
  }
  return out;
}

const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
const KINDS: FolkKind[] = ["TOWNSFOLK", "PEASANT", "TRAVELER", "PILGRIM", "HUNTER", "DEER", "COOK", "PEDDLER", "HEALER", "CHAPLAIN", "FAMILY", "SMITH"];

describe("a gente que não luta, em figuras do G1", () => {
  it("todo mundo tem a folha inteira: 3 direções e as 16 colunas", () => {
    for (const k of KINDS) {
      const l = folkLook(k);
      const b = figureSheet(l);
      const { w, h } = cellOf(l);
      expect(b.width, k).toBe(w * FRAMES);
      expect(b.height, k).toBe(h * 3);
    }
  });

  it("o camponês trabalha a terra: a enxada sobe e desce nos quadros do golpe", () => {
    const l = folkLook("PEASANT");
    const b = figureSheet(l);
    for (const row of [0, 1, 2]) {
      expect(same(cell(l, b, row, ANIM.ATTACK + 1), cell(l, b, row, ANIM.IDLE)), `linha ${row}`).toBe(false);
      expect(same(cell(l, b, row, ANIM.ATTACK + 1), cell(l, b, row, ANIM.ATTACK + 2)), `linha ${row}`).toBe(false);
    }
  });

  it("o cajado de caminhante não brilha como o do mago", () => {
    const stick = folkLook("PILGRIM");
    const staff: Look = { ...stick, weapon: "STAFF" };
    const a = figureSheet(stick);
    const b = figureSheet(staff);
    expect(same(cell(stick, a, 0, ANIM.IDLE), cell(staff, b, 0, ANIM.IDLE))).toBe(false);
    // Sem brilho no golpe: o quadro de armar fica igual ao parado, fora o corpo que se mexe
    const white = (px: number[]) => px.filter((v) => v === (0xffffffff | 0)).length;
    expect(white(cell(stick, a, 0, ANIM.ATTACK + 1))).toBe(0);
  });

  it("o cervo anda nas três direções e não tem cavaleiro", () => {
    const l = folkLook("DEER");
    const b = figureSheet(l);
    for (const row of [0, 1, 2]) {
      expect(same(cell(l, b, row, ANIM.WALK), cell(l, b, row, ANIM.WALK + 1)), `linha ${row}`).toBe(false);
    }
    const horse = figureSheet({ ...l, beast: undefined, mount: "HORSE" });
    expect(same(cell(l, b, 1, ANIM.IDLE), cell(l, horse, 1, ANIM.IDLE))).toBe(false);
  });

  it("a cor da roupa troca nos moradores e nas famílias", () => {
    expect(folkLook("TOWNSFOLK", 0x123456).color).toBe(0x123456);
    expect(folkLook("FAMILY").color).not.toBe(folkLook("FAMILY", 0x8a6a8a).color);
  });
});

describe("os lugares de trabalho dos seguidores", () => {
  const ROLES: StationRole[] = ["COOK", "PEDDLER", "HEALER", "CHAPLAIN", "FAMILY", "SMITH"];

  it("cada ofício tem a sua peça, com o pé dentro da grade e desenho de verdade", () => {
    for (const role of ROLES) {
      const list = stationPieces(role);
      expect(list.length, role).toBeGreaterThan(0);
      for (const p of list) {
        const piece = p.make();
        expect(-piece.dx, role).toBeGreaterThanOrEqual(0);
        expect(-piece.dx, role).toBeLessThan(piece.grid.w);
        expect(-piece.dy, role).toBeLessThan(piece.grid.h);
        expect(piece.grid.data.some((c) => c >= 0), role).toBe(true);
      }
    }
  });

  it("as esteiras da enfermaria ficam rentes ao chão (o ferido deita por cima)", () => {
    const cots = stationPieces("HEALER").filter((p) => p.flat);
    expect(cots.length).toBe(10);
    expect(stationPieces("COOK").some((p) => p.flat)).toBe(false);
  });

  it("a carga de ferro é pequena", () => {
    const b = ironLoadBitmap();
    expect(b.width).toBeLessThanOrEqual(16);
    expect(b.height).toBeLessThanOrEqual(10);
  });
});

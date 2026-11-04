import { describe, expect, it } from "vitest";
import { HARPY_CELL, HARPY_FRAMES, harpyShadow, harpySheet } from "../../src/game/art/harpy";
import { SHIP_FRAMES, shipCell, shipSheet, type ShipKind } from "../../src/game/art/ships";
import { DECK_BOW, DECK_SIDE, deckOrigin, deckShipBitmap, deckSize, gangplankBitmap, SEA_TILE, seaTileBitmap } from "../../src/game/art/deck";
import { Grid, type Bitmap } from "../../src/game/art/pixel";
import { DECK } from "../../src/game/data/scenarios";

/** Os pixels de um quadro de uma folha de células iguais. */
function cell(b: Bitmap, w: number, h: number, row: number, col: number): number[] {
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
const alphaAt = (b: Bitmap, x: number, y: number) => b.rgba[(y * b.width + x) * 4 + 3];

describe("o polígono da grade", () => {
  it("pinta o miolo, não pinta fora e não perde a ponta fina", () => {
    const g = new Grid(20, 20);
    g.poly(
      [
        [2, 2],
        [17, 2],
        [17, 12],
        [2, 12],
      ],
      7,
    );
    expect(g.get(9, 7)).toBe(7);
    expect(g.get(1, 7)).toBe(-1);
    expect(g.get(9, 14)).toBe(-1);
    const thin = new Grid(20, 20);
    thin.poly(
      [
        [2, 10],
        [18, 9.6],
        [2, 10.4],
      ],
      3,
    );
    expect(thin.get(18, 10)).toBe(3);
  });
});

describe("a harpia em pixel art", () => {
  it("a folha tem 3 direções e 4 quadros do bater de asas, e a sombra é só sombra", () => {
    const b = harpySheet();
    expect(b.width).toBe(HARPY_CELL.w * HARPY_FRAMES);
    expect(b.height).toBe(HARPY_CELL.h * 3);
    const s = harpyShadow();
    for (let i = 3; i < s.rgba.length; i += 4) expect([0, 70]).toContain(s.rgba[i]);
  });

  it("as asas batem: cada quadro difere do seguinte, em todas as direções", () => {
    const b = harpySheet();
    for (let row = 0; row < 3; row++) {
      for (let f = 0; f < HARPY_FRAMES - 1; f++) {
        const a = cell(b, HARPY_CELL.w, HARPY_CELL.h, row, f);
        const c = cell(b, HARPY_CELL.w, HARPY_CELL.h, row, f + 1);
        expect(same(a, c), `linha ${row}, quadro ${f}`).toBe(false);
      }
    }
  });

  it("o corpo fica no meio da célula: espelhada, a ave não pula de lado", () => {
    expect(HARPY_CELL.cx * 2).toBe(HARPY_CELL.w);
  });
});

describe("os barcos em pixel art", () => {
  const KINDS: ShipKind[] = ["BARGE", "SHIP"];

  it("cada folha tem 3 direções e 4 quadros; o casco fica no meio da célula", () => {
    for (const k of KINDS) {
      const c = shipCell(k);
      const b = shipSheet(k);
      expect(b.width).toBe(c.w * SHIP_FRAMES);
      expect(b.height).toBe(c.h * 3);
      expect(c.cx * 2).toBe(c.w);
      // O ponto na água é casco de verdade
      expect(alphaAt(b, c.w + c.cx, c.h + c.cy - 2)).toBe(255);
    }
  });

  it("a espuma se mexe, e na tempestade a vela vem recolhida", () => {
    for (const k of KINDS) {
      const c = shipCell(k);
      const b = shipSheet(k);
      for (let row = 0; row < 3; row++) {
        const [open, open2, furled] = [0, 1, 2].map((f) => cell(b, c.w, c.h, row, f));
        expect(same(open, open2), `${k} linha ${row}`).toBe(false);
        expect(same(open, furled), `${k} linha ${row}`).toBe(false);
      }
    }
  });

  it("o navio é maior que a barcaça", () => {
    const barge = shipSheet("BARGE");
    const ship = shipSheet("SHIP");
    const solid = (b: Bitmap) => {
      let n = 0;
      for (let i = 3; i < b.rgba.length; i += 4) if (b.rgba[i] === 255) n++;
      return n;
    };
    expect(solid(ship)).toBeGreaterThan(solid(barge) * 1.8);
  });
});

describe("o convés da batalha no mar", () => {
  const shape = { w: DECK.OURS.w, h: DECK.OURS.h, rail: DECK.RAIL, planks: DECK.PLANKS.map((y) => y - DECK.OURS.y), plankWidth: DECK.PLANK_WIDTH };

  it("o navio cobre o convés inteiro, com a proa e o costado para fora", () => {
    const b = deckShipBitmap(shape, false);
    const size = deckSize(shape);
    expect(b.width).toBe(size.w);
    expect(b.height).toBe(size.h);
    expect(size.w).toBe(DECK_BOW + shape.w + 2 * shape.rail);
    const o = deckOrigin(shape);
    for (const [x, y] of [
      [o.x, o.y],
      [o.x + shape.w - 1, o.y + shape.h - 1],
      [o.x + shape.w / 2, o.y + shape.h / 2],
      [o.x + 5, o.y + shape.h + shape.rail + DECK_SIDE - 4],
    ])
      expect(alphaAt(b, x, y), `${x},${y}`).toBe(255);
    // A ponta da proa é estreita: em cima e embaixo dela, o mar
    expect(alphaAt(b, 2, 2)).toBe(0);
  });

  it("a amurada da popa abre onde as pranchas apoiam", () => {
    const b = deckShipBitmap(shape, false);
    const o = deckOrigin(shape);
    const x = o.x + shape.w + shape.rail / 2;
    const at = (y: number) => {
      const i = (y * b.width + x) * 4;
      return (b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2];
    };
    const plankY = o.y + shape.planks[0];
    const railY = o.y + (shape.planks[0] + shape.planks[1]) / 2;
    expect(at(plankY)).not.toBe(at(railY + 1));
  });

  it("o nosso e o deles são de madeiras diferentes", () => {
    const a = deckShipBitmap(shape, false);
    const b = deckShipBitmap(shape, true);
    const o = deckOrigin(shape);
    const i = ((o.y + 11) * a.width + o.x + 40) * 4;
    expect([a.rgba[i], a.rgba[i + 1], a.rgba[i + 2]]).not.toEqual([b.rgba[i], b.rgba[i + 1], b.rgba[i + 2]]);
  });

  it("a prancha e o ladrilho do mar", () => {
    const p = gangplankBitmap(600, DECK.PLANK_WIDTH, DECK.RAIL);
    expect(p.width).toBe(600);
    expect(alphaAt(p, 300, DECK.RAIL + DECK.PLANK_WIDTH / 2)).toBe(255);
    const sea = seaTileBitmap();
    expect(sea.width).toBe(SEA_TILE);
    for (let i = 3; i < sea.rgba.length; i += 4) expect(sea.rgba[i]).toBe(255);
  });
});

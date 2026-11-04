import { describe, expect, it } from "vitest";
import { VEHICLE_CELL, vehicleDot, vehicleMiniSheet, vehicleSheet } from "../../src/game/art/vehicles";
import { ANIM, FRAMES, type Vehicle } from "../../src/game/art/figures";
import { vehicleLook } from "../../src/game/art/looks";
import { WALL_FACE, ladderPiece } from "../../src/game/art/buildings";
import type { Bitmap } from "../../src/game/art/pixel";

const { w: W, h: H } = VEHICLE_CELL;
const KINDS: Vehicle[] = ["WAGON", "CART", "RAM"];

/** Os pixels de um quadro da folha (linha 0 = de frente, 1 = de lado, 2 = de costas). */
function cell(b: Bitmap, row: number, col: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = ((row * H + y) * b.width + col * W + x) * 4;
      out.push((b.rgba[i] << 24) | (b.rgba[i + 1] << 16) | (b.rgba[i + 2] << 8) | b.rgba[i + 3]);
    }
  }
  return out;
}

const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
/** Primeira linha com corpo (alfa cheio): a sombra não conta. */
const top = (px: number[]) => Math.floor(px.findIndex((v) => (v & 255) === 255) / W);
const shadowed = (px: number[]) => px.some((v) => (v & 255) === 70);

describe("os veículos em pixel art", () => {
  it("a folha tem o jeito da das figuras: 3 direções e 16 colunas", () => {
    for (const v of KINDS) {
      const b = vehicleSheet(vehicleLook(v, 0x3a6ab8));
      expect(b.width).toBe(W * FRAMES);
      expect(b.height).toBe(H * 3);
      expect(vehicleMiniSheet(vehicleLook(v, 0x3a6ab8)).width).toBe(64);
      expect(vehicleDot(vehicleLook(v, 0x3a6ab8)).width).toBe(12);
    }
  });

  it("andando, as rodas giram e os bichos dão o passo (de lado e de frente)", () => {
    for (const v of KINDS) {
      const b = vehicleSheet(vehicleLook(v, 0x3a6ab8));
      for (const row of [0, 1]) {
        const steps = [0, 1, 2, 3].map((k) => cell(b, row, ANIM.WALK + k));
        expect(same(steps[0], steps[1]), `${v} linha ${row}`).toBe(false);
        expect(same(steps[1], steps[2]), `${v} linha ${row}`).toBe(false);
      }
      expect(same(cell(b, 1, ANIM.IDLE), cell(b, 1, ANIM.WALK + 1))).toBe(false);
    }
  });

  it("só o aríete golpeia: a viga recua e bate", () => {
    const ram = vehicleSheet(vehicleLook("RAM", 0x3a6ab8));
    expect(same(cell(ram, 1, ANIM.ATTACK), cell(ram, 1, ANIM.IDLE))).toBe(false);
    expect(same(cell(ram, 1, ANIM.ATTACK), cell(ram, 1, ANIM.ATTACK + 1))).toBe(false);
    for (const v of ["WAGON", "CART"] as const) {
      const b = vehicleSheet(vehicleLook(v, 0x3a6ab8));
      for (let k = 0; k < 3; k++) expect(same(cell(b, 1, ANIM.ATTACK + k), cell(b, 1, ANIM.IDLE))).toBe(true);
    }
  });

  it("caindo, tomba e vira destroço baixo, sem sombra, que fica no chão", () => {
    for (const v of KINDS) {
      const b = vehicleSheet(vehicleLook(v, 0x3a6ab8));
      for (const row of [0, 1, 2]) {
        const standing = cell(b, row, ANIM.IDLE);
        const wreck = cell(b, row, ANIM.DIE + 2);
        expect(same(cell(b, row, ANIM.DIE), standing)).toBe(false);
        expect(top(wreck), `${v} linha ${row}`).toBeGreaterThan(top(standing) + 8);
        expect(shadowed(wreck)).toBe(false);
        expect(shadowed(standing)).toBe(true);
      }
    }
  });

  it("a cor conta: o toldo do mercador, a camisa do carroceiro e a flâmula do aríete", () => {
    for (const v of KINDS) {
      const a = vehicleSheet(vehicleLook(v, 0x3a6ab8));
      const b = vehicleSheet(vehicleLook(v, 0xb03a3a));
      expect(same(cell(a, 1, ANIM.IDLE), cell(b, 1, ANIM.IDLE)), v).toBe(false);
    }
  });
});

describe("as escadas do cerco", () => {
  const T = 58;
  it("ao sul, sobem do chão de fora até passar do alto da face", () => {
    const { piece, depth } = ladderPiece("S", 46, T + 8, T, true);
    const rows: number[] = [];
    for (let y = 0; y < piece.grid.h; y++) for (let x = 0; x < piece.grid.w; x++) if (piece.grid.get(x, y) >= 0) rows.push(y + piece.dy);
    const bottom = 4 + T;
    expect(Math.max(...rows)).toBeGreaterThan(bottom);
    expect(Math.min(...rows)).toBeLessThan(bottom - WALL_FACE);
    // Na frente da muralha (a profundidade dela é o pé)
    expect(depth).toBeGreaterThan(bottom);
  });

  it("ao norte, a muralha as esconde: só as pontas, desenhadas atrás dela", () => {
    const { depth } = ladderPiece("N", 46, T + 8, T, true);
    expect(depth).toBeLessThan(4 + T);
  });

  it("a oeste e a leste, sobem na diagonal, cada uma para o seu lado", () => {
    const xs = (side: "E" | "W") => {
      const { piece } = ladderPiece(side, T + 8, 46, T, true);
      const out: number[] = [];
      for (let y = 0; y < piece.grid.h; y++) for (let x = 0; x < piece.grid.w; x++) if (piece.grid.get(x, y) >= 0) out.push(x + piece.dx);
      return out;
    };
    expect(Math.min(...xs("W"))).toBeLessThan(-15);
    expect(Math.max(...xs("E"))).toBeGreaterThan(T + 8 + 15);
  });
});

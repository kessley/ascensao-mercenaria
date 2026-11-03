import { describe, expect, it } from "vitest";
import { forestSpots } from "../../src/game/world/forestLayout";
import type { TerrainZone } from "../../src/game/world/TerrainMap";
import { oakPiece, pinePiece, rockPiece } from "../../src/game/art/trees";
import { CLEAR } from "../../src/game/art/pixel";

const zone: TerrainZone = { type: "FOREST", x: 2000, y: 1500, rx: 500, ry: 300 };
const anywhere = () => true;

describe("as árvores da mata", () => {
  it("a mesma semente dá sempre a mesma mata", () => {
    expect(forestSpots(zone, 7, "FOREST", anywhere)).toEqual(forestSpots(zone, 7, "FOREST", anywhere));
    expect(forestSpots(zone, 8, "FOREST", anywhere)).not.toEqual(forestSpots(zone, 7, "FOREST", anywhere));
  });

  it("toda árvore fica dentro da zona, e só onde o chão deixa", () => {
    const west = (p: { x: number }) => p.x < zone.x;
    const spots = forestSpots(zone, 7, "FOREST", west);
    expect(spots.length).toBeGreaterThan(50);
    for (const s of spots) {
      expect(s.x).toBeLessThan(zone.x);
      // A moita ao pé da árvore pode sair um pouco da elipse, mas não muito
      expect(((s.x - zone.x) / zone.rx) ** 2 + ((s.y - zone.y) / zone.ry) ** 2).toBeLessThan(1.15);
    }
  });

  it("no frio é pinheiro; no brejo, quase nenhum", () => {
    const pines = (biome: "TUNDRA" | "MARSH") => {
      const trees = forestSpots(zone, 7, biome, anywhere).filter((s) => s.kind === "PINE" || s.kind === "OAK");
      return trees.filter((s) => s.kind === "PINE").length / trees.length;
    };
    expect(pines("TUNDRA")).toBeGreaterThan(0.8);
    expect(pines("MARSH")).toBeLessThan(0.25);
  });

  it("a mata tem moitas e pedras, não só árvores", () => {
    const kinds = new Set(forestSpots(zone, 7, "FOREST", anywhere).map((s) => s.kind));
    expect(kinds.has("BUSH")).toBe(true);
    expect(kinds.has("ROCK") || kinds.has("BIG_ROCK")).toBe(true);
  });
});

describe("o desenho das árvores", () => {
  const filled = (g: { data: Int32Array }) => g.data.filter((c) => c !== CLEAR).length;

  it("toda peça fica de pé na própria base", () => {
    for (const piece of [oakPiece(3, "SUMMER"), pinePiece(3), rockPiece(3, true, true)]) {
      expect(piece.dy).toBeLessThan(0);
      expect(piece.grid.h + piece.dy).toBeGreaterThanOrEqual(0);
      expect(piece.dx).toBeLessThan(0);
      expect(piece.grid.w + piece.dx).toBeGreaterThan(0);
    }
  });

  it("o carvalho perde as folhas no inverno; a estação não muda o tamanho do tronco", () => {
    const summer = oakPiece(3, "SUMMER");
    const winter = oakPiece(3, "WINTER");
    expect(filled(winter.grid)).toBeLessThan(filled(summer.grid));
    expect(oakPiece(3, "SUMMER").grid.data).toEqual(summer.grid.data);
  });

  it("a neve muda o desenho, não o lugar", () => {
    const plain = pinePiece(5);
    const snowy = pinePiece(5, true);
    expect(snowy.dx).toBe(plain.dx);
    expect(snowy.dy).toBe(plain.dy);
    expect(snowy.grid.data).not.toEqual(plain.grid.data);
  });
});

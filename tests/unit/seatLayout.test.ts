import { describe, expect, it } from "vitest";
import { seatLayout, townSolids, townLayout, type Rect, type SeatStage } from "../../src/game/world/townLayout";

/** A fortaleza de 34×34 células com a muralha de pedra, centrada em (5000, 5000). */
const FORT: Rect = { x: 5000 - 730, y: 5000 - 730, w: 1460, h: 1460 };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const key = (r: Rect) => `${r.x},${r.y},${r.w},${r.h}`;

describe("a planta da cidade da sede", () => {
  it("o arraial é só a praça com as barracas, diante do portão da fortaleza", () => {
    const l = seatLayout("t", FORT, "S", "CAMPTOWN", 0.05);
    expect(l.houses.length).toBe(0);
    expect(l.walls.length).toBe(0);
    expect(l.stalls.length).toBeGreaterThan(0);
    // A praça fica ao sul da fortaleza (o portão é ao sul)
    expect(l.square.y).toBeGreaterThan(FORT.y + FORT.h);
    expect(Math.abs(l.square.x + l.square.w / 2 - 5000)).toBeLessThan(2);
  });

  it("as casas aparecem do portão da fortaleza para fora", () => {
    const all = seatLayout("t", FORT, "S", "BURG", 1).houses;
    const some = seatLayout("t", FORT, "S", "BURG", 0.25).houses;
    expect(all.length).toBeGreaterThan(40);
    expect(some.length).toBe(Math.round(all.length * 0.25));
    const front = { x: 5000, y: FORT.y + FORT.h + 60 };
    const d = (r: Rect) => Math.hypot(r.x + r.w / 2 - front.x, r.y + r.h / 2 - front.y);
    const shown = new Set(some.map((h) => key(h.rect)));
    const farthestShown = Math.max(...some.map((h) => d(h.rect)));
    for (const h of all) if (!shown.has(key(h.rect))) expect(d(h.rect)).toBeGreaterThanOrEqual(farthestShown - 1e-6);
  });

  it("nenhuma casa encosta na fortaleza, na praça ou em outra casa", () => {
    for (const stage of ["BURG", "TOWN", "CITY"] as SeatStage[]) {
      const l = seatLayout("t", FORT, "W", stage, 1);
      for (const [i, h] of l.houses.entries()) {
        expect(overlaps(h.rect, FORT)).toBe(false);
        expect(overlaps(h.rect, l.square)).toBe(false);
        for (const o of l.houses.slice(i + 1)) expect(overlaps(h.rect, o.rect)).toBe(false);
        if (l.temple) expect(overlaps(h.rect, l.temple)).toBe(false);
        if (l.keep.w > 0) expect(overlaps(h.rect, l.keep)).toBe(false);
      }
      // A fortaleza não é sólida para a cidade: quem a desenha e a fecha é o acampamento
      expect(townSolids(l).some((s) => overlaps(s.rect, { x: 4990, y: 4990, w: 20, h: 20 }))).toBe(false);
    }
  });

  it("as casas não mudam de lugar quando a vila ganha muralha e quando vira cidade", () => {
    const burg = seatLayout("t", FORT, "N", "BURG", 0.4).houses.map((h) => key(h.rect));
    const town = new Set(seatLayout("t", FORT, "N", "TOWN", 0.4).houses.map((h) => key(h.rect)));
    const city = new Set(seatLayout("t", FORT, "N", "CITY", 0.4).houses.map((h) => key(h.rect)));
    for (const k of burg) {
      expect(town.has(k)).toBe(true);
      expect(city.has(k)).toBe(true);
    }
  });

  it("a vila tem paliçada, portões com guarnição, Casa do Conselho e templo; a cidade, muralha de pedra", () => {
    const burg = seatLayout("t", FORT, "S", "BURG", 0.2);
    expect(burg.walls.length + burg.gates.length + burg.camps.length).toBe(0);
    expect(burg.temple).toBeNull();
    const town = seatLayout("t", FORT, "S", "TOWN", 0.3);
    expect(town.wallKind).toBe("PALISADE");
    expect(town.gates.length).toBe(4);
    expect(town.camps.length).toBeGreaterThan(0);
    expect(town.temple).not.toBeNull();
    expect(town.keep.w).toBeGreaterThan(0);
    // A cidade inteira cerca a fortaleza com folga dos quatro lados
    for (const side of [town.bounds.x < FORT.x, town.bounds.y < FORT.y, town.bounds.x + town.bounds.w > FORT.x + FORT.w, town.bounds.y + town.bounds.h > FORT.y + FORT.h]) expect(side).toBe(true);
    const city = seatLayout("t", FORT, "S", "CITY", 0.7);
    expect(city.wallKind).toBe("STONE");
    expect(city.towers.length).toBeGreaterThan(town.towers.length);
  });

  it("sem muralha, o chão da cidade só vai até onde há casas", () => {
    const small = seatLayout("t", FORT, "S", "BURG", 0.1).bounds;
    const big = seatLayout("t", FORT, "S", "BURG", 0.9).bounds;
    expect(small.w * small.h).toBeLessThan(big.w * big.h);
  });

  it("água e montanha ficam sem casa", () => {
    const dry = seatLayout("t", FORT, "S", "BURG", 1, (p) => p.x < 5000).houses;
    expect(dry.length).toBeGreaterThan(0);
    for (const h of dry) expect(h.rect.x + h.rect.w).toBeLessThanOrEqual(5000);
  });

  it("os povoados do mundo continuam com a muralha de sempre", () => {
    // A muralha foi para uma função à parte (a mesma da cidade da sede): 4 portões, 8 trechos
    const l = townLayout("cidade-teste", "CITY", 3000, 3000);
    expect(l.walls.length).toBe(8);
    expect(l.gates.length).toBe(4);
    expect(l.seat).toBeUndefined();
  });
});

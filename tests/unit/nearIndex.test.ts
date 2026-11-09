import { describe, expect, it } from "vitest";
import { nearestWithin } from "../../src/game/systems/nearIndex";
import { distance, nearest, type Point } from "../../src/utils/math";

/** A busca pela grade dá o mesmo que filtrar a lista inteira e pegar o mais perto (Battalion.pickTarget). */
describe("nearestWithin", () => {
  const brute = (items: Point[], around: Point, r: number, from: Point, max = Infinity) =>
    nearest(items.filter((e) => distance(e, around) <= r), from, max);

  it("é igual à conta contra a lista inteira, com listas grandes e pequenas", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let round = 0; round < 40; round++) {
      const n = round % 2 === 0 ? 30 : 600;
      // Coordenadas inteiras numa área pequena: há empates de distância de verdade
      const items = Array.from({ length: n }, () => ({ x: Math.round(rnd() * 3000) - 500, y: Math.round(rnd() * 2000) - 300 }));
      for (let q = 0; q < 60; q++) {
        const around = { x: Math.round(rnd() * 3000) - 500, y: Math.round(rnd() * 2000) - 300 };
        const from = q % 3 === 0 ? around : { x: around.x + Math.round(rnd() * 200) - 100, y: around.y + Math.round(rnd() * 200) - 100 };
        const r = [60, 140, 420, 900][q % 4];
        const max = q % 5 === 0 ? 150 : Infinity;
        expect(nearestWithin(items, round, around, r, from, max)).toBe(brute(items, around, r, from, max));
      }
    }
  });

  it("refaz a grade quando o quadro muda (os itens andaram)", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ x: i * 50, y: 0 }));
    expect(nearestWithin(items, 1, { x: 0, y: 0 }, 30, { x: 0, y: 0 })).toBe(items[0]);
    items[0].x = 4000;
    items[99].x = 10;
    expect(nearestWithin(items, 2, { x: 0, y: 0 }, 30, { x: 0, y: 0 })).toBe(items[99]);
  });
});

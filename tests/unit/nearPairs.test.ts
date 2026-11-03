import { describe, expect, it } from "vitest";
import { forEachNearPair } from "../../src/game/systems/nearPairs";

/** Sorteio repetível (o mesmo a cada rodada do teste). */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Spot = { x: number; y: number; alive: boolean };

const spots = (n: number, w: number, h: number, seed: number, x0 = 0, y0 = 0): Spot[] => {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: x0 + r() * w, y: y0 + r() * h, alive: r() > 0.1 }));
};

/** Os pares a menos de `reach` em x e em y, pela conta de todos contra todos. */
function brute(items: Spot[], reach: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.alive && b.alive && Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach) out.add(`${i}:${j}`);
    }
  }
  return out;
}

function viaGrid(items: Spot[], reach: number): { near: Set<string>; visits: string[] } {
  const index = new Map(items.map((t, i) => [t, i]));
  const near = new Set<string>();
  const visits: string[] = [];
  forEachNearPair(items, reach, (t) => t.alive, (a, b) => {
    const i = index.get(a)!;
    const j = index.get(b)!;
    visits.push(`${i}:${j}`);
    if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach) near.add(`${i}:${j}`);
  });
  return { near, visits };
}

describe("pares vizinhos pela grade", () => {
  it("acha os mesmos pares que todos contra todos", () => {
    for (const [n, w, h, reach, seed] of [
      [300, 600, 400, 38, 1],
      [800, 2000, 300, 20, 2],
      [50, 40, 40, 38, 3],
      [400, 30000, 20000, 38, 4],
    ] as const) {
      const items = spots(n, w, h, seed);
      expect(viaGrid(items, reach).near, `n=${n}`).toEqual(brute(items, reach));
    }
  });

  it("cada par uma vez, na ordem da lista, e só quem entra", () => {
    const items = spots(500, 500, 500, 7);
    const { visits } = viaGrid(items, 38);
    expect(new Set(visits).size).toBe(visits.length);
    for (const v of visits) {
      const [i, j] = v.split(":").map(Number);
      expect(i).toBeLessThan(j);
      expect(items[i].alive && items[j].alive).toBe(true);
    }
  });

  it("funciona longe da origem, com coordenadas negativas e na borda das células", () => {
    const items = [...spots(200, 300, 300, 9, -150, -150), ...spots(200, 300, 300, 10, 47000, 28000)];
    // Na divisa exata entre duas células
    items.push({ x: 38, y: 0, alive: true }, { x: 37.9, y: 0, alive: true }, { x: 76, y: 76, alive: true });
    expect(viaGrid(items, 38).near).toEqual(brute(items, 38));
  });

  it("lista vazia, um só, ninguém vivo ou alcance zero: nada", () => {
    const visit = () => {
      throw new Error("não devia visitar");
    };
    forEachNearPair([], 38, () => true, visit);
    forEachNearPair([{ x: 0, y: 0 }], 38, () => true, visit);
    forEachNearPair([{ x: 0, y: 0 }, { x: 1, y: 1 }], 38, () => false, visit);
    forEachNearPair([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0, () => true, visit);
  });

  it("a grade cresce para listas maiores do que a anterior", () => {
    const small = spots(10, 100, 100, 11);
    const big = spots(3000, 3000, 3000, 12);
    expect(viaGrid(small, 38).near).toEqual(brute(small, 38));
    expect(viaGrid(big, 38).near).toEqual(brute(big, 38));
  });
});

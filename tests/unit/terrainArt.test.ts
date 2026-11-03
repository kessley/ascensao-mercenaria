import { describe, expect, it } from "vitest";
import { PEAK_SHAPES, crossingReach, paintCrossing, peakBitmap, peakSpots, type CrossingArt } from "../../src/game/art/terrainArt";
import { pixelGround, stillWater, waterSpots } from "../../src/game/art/ground";

const everywhere = () => true;
const at = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe("os picos", () => {
  it("o mesmo lugar dá sempre os mesmos picos, de trás para a frente", () => {
    const spots = peakSpots(3000, 2000, 1600, 1600, everywhere);
    expect(spots).toEqual(peakSpots(3000, 2000, 1600, 1600, everywhere));
    expect(spots.length).toBeGreaterThan(100);
    for (let i = 1; i < spots.length; i++) expect(spots[i].y).toBeGreaterThanOrEqual(spots[i - 1].y);
  });

  it("só onde o pé cai na montanha", () => {
    expect(peakSpots(0, 0, 1600, 1600, () => false)).toEqual([]);
    const west = peakSpots(0, 0, 1600, 1600, (x) => x < 800);
    expect(west.length).toBeGreaterThan(0);
    for (const p of west) expect(p.x).toBeLessThan(800);
  });

  it("os pedaços vizinhos pedem os mesmos picos na emenda", () => {
    const left = peakSpots(0, 0, 1600, 1600, everywhere);
    const right = peakSpots(1600, 0, 1600, 1600, everywhere);
    const shared = left.filter((p) => right.some((q) => at(q) === at(p)));
    expect(shared.length).toBeGreaterThan(0);
    for (const p of shared) expect(right.find((q) => at(q) === at(p))).toEqual(p);
  });

  it("poucas formas no mundo todo, guardadas e reduzidas de longe", () => {
    const spots = peakSpots(0, 0, 8000, 8000, everywhere);
    const shapes = new Set(spots.map((p) => `${p.seed}|${p.size}`));
    expect(shapes.size).toBeLessThanOrEqual(PEAK_SHAPES * 8);
    for (const p of spots) {
      expect(p.size).toBeGreaterThanOrEqual(80);
      expect(p.size).toBeLessThanOrEqual(150);
    }
    const p = spots[0];
    expect(peakBitmap(p, false)).toBe(peakBitmap({ ...p, x: p.x + 5000 }, false));
    expect(peakBitmap(p, false, 0.5).bitmap.width).toBeLessThan(peakBitmap(p, false).bitmap.width);
  });
});

describe("pontes, vaus e balsas", () => {
  const size = 400;
  const blank = () => new Uint8ClampedArray(size * size * 4).fill(90);
  const crossing = (over: Partial<CrossingArt>): CrossingArt => ({
    id: "t",
    kind: "BRIDGE",
    x: 200,
    y: 200,
    angle: 0.4,
    width: 40,
    burned: false,
    hidden: false,
    inRiver: () => true,
    ...over,
  });
  const changed = (data: Uint8ClampedArray) => {
    const out: number[] = [];
    for (let k = 0; k < data.length; k += 4) if (data[k] !== 90 || data[k + 1] !== 90 || data[k + 2] !== 90) out.push(k / 4);
    return out;
  };

  it("a ponte se desenha só perto do lugar dela", () => {
    const data = blank();
    const c = crossing({});
    paintCrossing(data, size, size, 0, 0, c, 240);
    const px = changed(data);
    expect(px.length).toBeGreaterThan(2000);
    const reach = crossingReach(c, 240);
    for (const i of px) expect(Math.hypot((i % size) + 0.5 - c.x, Math.floor(i / size) + 0.5 - c.y)).toBeLessThanOrEqual(reach + 1);
  });

  it("queimada não é igual à inteira; escondida não desenha", () => {
    const whole = blank();
    const burned = blank();
    const hidden = blank();
    paintCrossing(whole, size, size, 0, 0, crossing({}), 240);
    paintCrossing(burned, size, size, 0, 0, crossing({ burned: true }), 240);
    paintCrossing(hidden, size, size, 0, 0, crossing({ kind: "FORD", hidden: true }), 240);
    expect(burned).not.toEqual(whole);
    expect(changed(hidden)).toEqual([]);
  });

  it("as pedras do vau só ficam na água", () => {
    const data = blank();
    paintCrossing(data, size, size, 0, 0, crossing({ kind: "FORD", inRiver: (x) => x < 200 }), 240);
    const px = changed(data);
    expect(px.length).toBeGreaterThan(0);
    // O centro da pedra fica na água; a pedra passa dele no máximo o raio (7) e a espuma (1)
    for (const i of px) expect(i % size).toBeLessThan(200 + 9);
  });

  it("vizinhos desenham a mesma ponte na emenda", () => {
    const whole = blank();
    paintCrossing(whole, size, size, 0, 0, crossing({}), 240);
    // A metade da direita pintada sozinha, com o canto no meio da imagem
    const half = new Uint8ClampedArray((size / 2) * size * 4).fill(90);
    paintCrossing(half, size / 2, size, size / 2, 0, crossing({}), 240);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size / 2; x++) {
        const a = (y * size + x + size / 2) * 4;
        const b = (y * (size / 2) + x) * 4;
        expect([whole[a], whole[a + 1], whole[a + 2]]).toEqual([half[b], half[b + 1], half[b + 2]]);
      }
    }
  });
});

describe("a água que brilha", () => {
  // Um rio na horizontal no meio de um campo: grama em cima e embaixo
  const size = 128;
  const field = () => {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const k = (y * size + x) * 4;
        const river = y >= 44 && y < 84;
        data.set(river ? [52, 110, 170, 255] : [70, 130, 52, 255], k);
      }
    }
    return data;
  };

  it("cada brilho cai na água, dentro do pedaço, e sai igual toda vez", () => {
    const inner = { x: 16, y: 16, w: 96, h: 96 };
    const a = field();
    pixelGround(a, size, size, 0, 0);
    const spots = waterSpots(size, size, 0, 0, inner);
    const b = field();
    pixelGround(b, size, size, 0, 0);
    expect(waterSpots(size, size, 0, 0, inner)).toEqual(spots);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(inner.x);
      expect(s.x).toBeLessThan(inner.x + inner.w);
      expect(s.y).toBeGreaterThanOrEqual(40);
      expect(s.y).toBeLessThan(88);
    }
    expect(spots.some((s) => s.shore)).toBe(true);
  });

  it("o brilho some onde a peça nítida cobre a água", () => {
    const data = field();
    expect(stillWater(data, size, size, 64, 64)).toBe(true);
    expect(stillWater(data, size, size, 64, 20)).toBe(false);
    // Uma tábua por cima da água
    for (let x = 60; x < 70; x++) data.set([132, 94, 56, 255], (64 * size + x) * 4);
    expect(stillWater(data, size, size, 64, 64)).toBe(false);
    expect(stillWater(data, size, size, 64, 64, 0)).toBe(false);
    expect(stillWater(data, size, size, 30, 64)).toBe(true);
  });
});

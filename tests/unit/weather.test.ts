import { describe, expect, it } from "vitest";
import { dropFrame, fogBank, FOG_BANK, PUDDLE, puddleFrame, puddleSheet, skySheet, SKY, SKY_CELL, slantOf, SNOW_LEVELS, SNOW_TILE, snowCover } from "../../src/game/art/weatherArt";
import { flagCell, flagFrame, flagSheet, FLAG_FRAMES, type FlagSpec } from "../../src/game/art/flags";
import { OUTLINE, type Bitmap } from "../../src/game/art/pixel";
import { windAt } from "../../src/utils/season";
import { WEATHER, type Weather } from "../../src/utils/constants";

const alphaAt = (b: Bitmap, x: number, y: number) => b.rgba[(y * b.width + x) * 4 + 3];
const colorAt = (b: Bitmap, x: number, y: number) => {
  const i = (y * b.width + x) * 4;
  return (b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2];
};

/** Os pixels acesos de uma janela da folha. */
function lit(b: Bitmap, x0: number, y0: number, w: number, h: number): { x: number; y: number; c: number }[] {
  const out: { x: number; y: number; c: number }[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (alphaAt(b, x, y)) out.push({ x: x - x0, y: y - y0, c: colorAt(b, x, y) });
  return out;
}

const WEATHERS: Weather[] = ["CLEAR", "RAIN", "FOG", "SNOW", "STORM"];

describe("o vento (G6, parte 2)", () => {
  it("é o mesmo no mesmo dia e lugar, e a força cabe na faixa do tempo", () => {
    for (const w of WEATHERS) {
      const [lo, hi] = WEATHER.WIND[w];
      for (let day = 1; day < 40; day++) {
        const a = windAt(7, day, { x: 500, y: 900 }, w);
        expect(windAt(7, day, { x: 500, y: 900 }, w)).toEqual(a);
        expect(a.strength).toBeGreaterThanOrEqual(lo);
        expect(a.strength).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("nevoeiro é calmaria, tempestade é vento forte, e o vento sopra dos dois lados", () => {
    const dirs = new Set<number>();
    for (let day = 1; day < 60; day++) {
      expect(windAt(3, day, { x: 0, y: 0 }, "FOG").strength).toBeLessThan(WEATHER.CALM);
      expect(windAt(3, day, { x: 0, y: 0 }, "STORM").strength).toBeGreaterThanOrEqual(0.8);
      dirs.add(windAt(3, day, { x: 0, y: 0 }, "RAIN").dir);
    }
    expect([...dirs].sort()).toEqual([-1, 1]);
  });
});

describe("a chuva e a neve em pixel art (G6, parte 2)", () => {
  it("a folha do céu tem todos os quadros, e nenhum vazio", () => {
    const b = skySheet();
    expect(b.width).toBe(SKY_CELL * SKY.TOTAL);
    expect(b.height).toBe(SKY_CELL);
    for (let f = 0; f < SKY.TOTAL; f++) expect(lit(b, f * SKY_CELL, 0, SKY_CELL, SKY_CELL).length, `quadro ${f}`).toBeGreaterThan(0);
  });

  it("a gota se inclina para onde o vento sopra, e a da tempestade é mais comprida", () => {
    const b = skySheet();
    const tilt = (f: number) => {
      const px = lit(b, f * SKY_CELL, 0, SKY_CELL, SKY_CELL);
      const top = px.reduce((a, p) => (p.y < a.y ? p : a));
      const bottom = px.reduce((a, p) => (p.y > a.y ? p : a));
      return { dx: bottom.x - top.x, len: bottom.y - top.y + 1 };
    };
    expect(tilt(dropFrame(0, false)).dx).toBe(0);
    expect(tilt(dropFrame(3, false)).dx).toBeGreaterThan(0);
    expect(tilt(dropFrame(-3, false)).dx).toBeLessThan(0);
    expect(tilt(dropFrame(2, true)).len).toBeGreaterThan(tilt(dropFrame(2, false)).len);
    // Fora da faixa, a inclinação para no limite
    expect(dropFrame(9, false)).toBe(dropFrame(3, false));
    expect(slantOf(1, 0)).toBe(0);
    expect(slantOf(-1, 1)).toBe(-3);
    expect(slantOf(1, 0.5)).toBeGreaterThan(0);
  });

  it("a poça fica parada sem chuva e, com chuva, o círculo cresce do meio para a beira", () => {
    const b = puddleSheet();
    expect(b.width).toBe(PUDDLE.w * PUDDLE.frames);
    expect(b.height).toBe(PUDDLE.h * PUDDLE.sizes);
    const RIPPLE = 0xa9bfd2;
    const ring = (size: number, f: number) => {
      const fr = puddleFrame(size, f);
      const px = lit(b, (fr % PUDDLE.frames) * PUDDLE.w, Math.floor(fr / PUDDLE.frames) * PUDDLE.h, PUDDLE.w, PUDDLE.h).filter((p) => p.c === RIPPLE);
      return px.length ? Math.max(...px.map((p) => Math.abs(p.x - PUDDLE.w / 2))) : 0;
    };
    for (let size = 0; size < PUDDLE.sizes; size++) {
      expect(ring(size, 0)).toBe(0);
      expect(ring(size, 1)).toBeGreaterThan(0);
      expect(ring(size, 3)).toBeGreaterThan(ring(size, 1));
    }
  });

  it("a neve no chão cobre cada vez mais, perto da conta de cada nível", () => {
    let last = 0;
    SNOW_LEVELS.forEach((want, level) => {
      const b = snowCover(level);
      expect(b.width).toBe(SNOW_TILE);
      expect(b.height).toBe(SNOW_TILE);
      let n = 0;
      for (let i = 0; i < SNOW_TILE * SNOW_TILE; i++) if (b.rgba[i * 4 + 3]) n++;
      const cover = n / (SNOW_TILE * SNOW_TILE);
      expect(cover, `nível ${level}`).toBeGreaterThan(want - 0.1);
      expect(cover, `nível ${level}`).toBeLessThan(want + 0.1);
      expect(cover).toBeGreaterThan(last);
      last = cover;
    });
  });

  it("o banco de nevoeiro é denso no meio e some nas bordas", () => {
    for (let k = 0; k < FOG_BANK.kinds; k++) {
      const b = fogBank(k);
      const { w, h } = FOG_BANK;
      const share = (x0: number, y0: number, ww: number, hh: number) => lit(b, x0, y0, ww, hh).length / (ww * hh);
      expect(share(w / 2 - 12, h / 2 - 6, 24, 12), `banco ${k}`).toBeGreaterThan(0.4);
      expect(share(0, 0, 12, 6)).toBe(0);
      expect(share(w - 12, h - 6, 12, 6)).toBe(0);
    }
  });
});

describe("as bandeiras ao vento (G6, parte 2)", () => {
  const SPECS: FlagSpec[] = [
    { color: 0x3a6fd0, pennant: false, height: 44, cloth: 22 },
    { color: 0xc23a2a, pennant: true, height: 30, cloth: 14 },
  ];
  /** Pixels do pano (à direita do mastro, sem o contorno) de um quadro. */
  const cloth = (spec: FlagSpec, f: number) => {
    const b = flagSheet(spec);
    const cell = flagCell(spec);
    return lit(b, f * cell.w, 0, cell.w, cell.h).filter((p) => p.x > cell.footX && p.c !== OUTLINE);
  };

  it("a folha tem os 5 quadros, e o mastro fica no meio da célula (o espelho não o tira do lugar)", () => {
    for (const spec of SPECS) {
      const b = flagSheet(spec);
      const cell = flagCell(spec);
      expect(b.width).toBe(cell.w * FLAG_FRAMES);
      expect(b.height).toBe(cell.h);
      for (let f = 0; f < FLAG_FRAMES; f++) {
        expect(alphaAt(b, f * cell.w + cell.footX - 1, cell.footY - 1)).toBe(255);
        expect(alphaAt(b, f * cell.w + cell.footX, cell.footY - 1)).toBe(255);
      }
    }
  });

  it("na calmaria o pano cai junto do mastro; ao vento ele se estende e muda de quadro em quadro", () => {
    for (const spec of SPECS) {
      const reach = (f: number) => Math.max(...cloth(spec, f).map((p) => p.x)) - flagCell(spec).footX;
      for (let f = 1; f < FLAG_FRAMES; f++) expect(reach(f)).toBeGreaterThan(reach(0) * 2);
      const shapes = new Set(Array.from({ length: FLAG_FRAMES - 1 }, (_, i) => JSON.stringify(cloth(spec, i + 1))));
      expect(shapes.size).toBe(FLAG_FRAMES - 1);
    }
  });

  it("o pano ao vento não se parte: colunas vizinhas sempre se tocam", () => {
    for (const spec of SPECS) {
      for (let f = 1; f < FLAG_FRAMES; f++) {
        const cols = new Map<number, { lo: number; hi: number }>();
        for (const p of cloth(spec, f)) {
          const c = cols.get(p.x);
          cols.set(p.x, c ? { lo: Math.min(c.lo, p.y), hi: Math.max(c.hi, p.y) } : { lo: p.y, hi: p.y });
        }
        const xs = [...cols.keys()].sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i] - xs[i - 1], `quadro ${f}`).toBe(1);
          const a = cols.get(xs[i - 1])!;
          const b = cols.get(xs[i])!;
          expect(a.lo <= b.hi + 1 && b.lo <= a.hi + 1, `quadro ${f}, coluna ${xs[i]}`).toBe(true);
        }
      }
    }
  });

  it("o quadro vem do vento: caído na calmaria, e mais depressa com vento forte", () => {
    expect(flagFrame(0.05, WEATHER.CALM, 1234, 0)).toBe(0);
    const changes = (strength: number) => {
      let n = 0;
      let last = flagFrame(strength, WEATHER.CALM, 0, 0.3);
      for (let t = 0; t <= 2000; t += 10) {
        const f = flagFrame(strength, WEATHER.CALM, t, 0.3);
        expect(f).toBeGreaterThanOrEqual(1);
        expect(f).toBeLessThan(FLAG_FRAMES);
        if (f !== last) n++;
        last = f;
      }
      return n;
    };
    expect(changes(1)).toBeGreaterThan(changes(0.2) * 2);
  });
});

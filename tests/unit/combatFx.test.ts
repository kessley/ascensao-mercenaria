import { describe, expect, it } from "vitest";
import {
  cellPixels,
  chipFrame,
  DUSTS,
  fxSheet,
  FX_CELL,
  FX_COLS,
  FX_ROWS,
  MATTERS,
  missileDir,
  missileFrame,
  MISSILE_DIRS,
  MISSILES,
  puffFrame,
  PUFF_FRAMES,
  SHADOW_FRAME,
  slashFrame,
  slashSheet,
  SLASH_CELL,
  SLASH_DIRS,
  SLASH_FRAMES,
  SLASH_RADIUS,
  stainFrame,
  STAINS,
  stuckFrame,
} from "../../src/game/art/combatFx";

const sheet = fxSheet();
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("os efeitos de combate em pixel art (G6, parte 3)", () => {
  it("a folha tem as células de 16 px, e nenhum quadro usado está vazio", () => {
    expect(sheet.width).toBe(FX_COLS * FX_CELL);
    expect(sheet.height).toBe(FX_ROWS * FX_CELL);
    const used = [
      ...MISSILES.flatMap((k) => [...Array.from({ length: MISSILE_DIRS }, (_, d) => missileFrame(k, d)), stuckFrame(k, true, true), stuckFrame(k, false, false)]),
      SHADOW_FRAME,
      ...DUSTS.flatMap((d) => Array.from({ length: PUFF_FRAMES }, (_, f) => puffFrame(d, f))),
      ...MATTERS.flatMap((m) => [chipFrame(m, 0), chipFrame(m, 1), ...Array.from({ length: STAINS[m] }, (_, v) => stainFrame(m, v))]),
    ];
    expect(new Set(used).size).toBe(used.length);
    for (const f of used) expect(cellPixels(sheet, f).length, `quadro ${f}`).toBeGreaterThan(0);
  });

  it("o projétil aponta para onde voa: a ponta fica do lado da direção, e as penas atrás", () => {
    for (const kind of MISSILES) {
      for (let d = 0; d < MISSILE_DIRS; d++) {
        const a = (d / MISSILE_DIRS) * Math.PI * 2;
        const px = cellPixels(sheet, missileFrame(kind, d));
        // A ponta é o aço (o pixel mais escuro e frio), e ele fica na frente do meio do desenho
        const along = (p: { x: number; y: number }) => (p.x - FX_CELL / 2) * Math.cos(a) + (p.y - FX_CELL / 2) * Math.sin(a);
        const steel = px.filter((p) => (p.c & 0xff) > ((p.c >> 16) & 0xff));
        expect(steel.length, `${kind} ${d}`).toBeGreaterThan(0);
        expect(mean(steel.map(along)), `${kind} ${d}`).toBeGreaterThan(mean(px.map(along)));
      }
    }
    expect(missileDir(0)).toBe(0);
    expect(missileDir(Math.PI / 2)).toBe(4);
    expect(missileDir(-Math.PI / 2)).toBe(12);
  });

  it("a flecha para a direita tem as penas num '>' atrás do rabo (e não parece voar para trás)", () => {
    const px = cellPixels(sheet, missileFrame("ARROW", 0));
    const tail = Math.min(...px.filter((p) => p.y === FX_CELL / 2).map((p) => p.x));
    const feathers = px.filter((p) => p.y !== FX_CELL / 2);
    expect(feathers.length).toBe(2);
    for (const f of feathers) expect(f.x).toBe(tail - 1);
  });

  it("o fincado se inclina para o lado de onde a flecha veio", () => {
    for (const kind of MISSILES) {
      const lean = (fromLeft: boolean) => {
        const px = cellPixels(sheet, stuckFrame(kind, fromLeft, true));
        const top = px.reduce((a, p) => (p.y < a.y ? p : a));
        return top.x - FX_CELL / 2;
      };
      expect(lean(true), kind).toBeLessThan(0);
      expect(lean(false), kind).toBeGreaterThan(0);
    }
  });

  it("a poeira cresce e se desfaz; na neve ela é branca", () => {
    for (const d of DUSTS) {
      const frames = Array.from({ length: PUFF_FRAMES }, (_, f) => cellPixels(sheet, puffFrame(d, f)));
      const width = frames.map((px) => Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x)));
      expect(width[PUFF_FRAMES - 1], d).toBeGreaterThan(width[0]);
      // O último quadro tem buracos: menos pixels do que a área que ele cobre
      const last = frames[PUFF_FRAMES - 1];
      const box = (Math.max(...last.map((p) => p.x)) - Math.min(...last.map((p) => p.x)) + 1) * (Math.max(...last.map((p) => p.y)) - Math.min(...last.map((p) => p.y)) + 1);
      expect(last.length / box, d).toBeLessThan(0.75);
    }
    const bright = (d: (typeof DUSTS)[number]) => mean(cellPixels(sheet, puffFrame(d, 1)).map((p) => (p.c >> 16) & 0xff));
    expect(bright("SNOW")).toBeGreaterThan(bright("DRY"));
    expect(bright("DRY")).toBeGreaterThan(bright("MUD"));
  });

  it("o sangue é vermelho, o osso é claro, e a poça de quem cai é maior que um respingo", () => {
    const red = cellPixels(sheet, stainFrame("BLOOD", 1));
    for (const p of red) expect((p.c >> 16) & 0xff).toBeGreaterThan(((p.c >> 8) & 0xff) * 2);
    const bone = cellPixels(sheet, stainFrame("BONE", 1));
    expect(mean(bone.map((p) => p.c & 0xff))).toBeGreaterThan(120);
    expect(cellPixels(sheet, stainFrame("BLOOD", 5)).length).toBeGreaterThan(cellPixels(sheet, stainFrame("BLOOD", 1)).length * 4);
    expect(STAINS.SPARK).toBe(0);
  });

  it("o golpe em meia-lua fica no raio do alcance, virado para onde o Comandante bate", () => {
    const s = slashSheet(1);
    expect(s.width).toBe(SLASH_CELL * SLASH_FRAMES);
    expect(s.height).toBe(SLASH_CELL * SLASH_DIRS);
    for (const dir of [0, 4, 9]) {
      const counts: number[] = [];
      for (let f = 0; f < SLASH_FRAMES; f++) {
        const fr = slashFrame(dir, f);
        const ox = (fr % SLASH_FRAMES) * SLASH_CELL;
        const oy = Math.floor(fr / SLASH_FRAMES) * SLASH_CELL;
        const px: { x: number; y: number }[] = [];
        for (let y = 0; y < SLASH_CELL; y++) {
          for (let x = 0; x < SLASH_CELL; x++) if (s.rgba[((oy + y) * s.width + ox + x) * 4 + 3]) px.push({ x: x + 0.5 - SLASH_CELL / 2, y: y + 0.5 - SLASH_CELL / 2 });
        }
        counts.push(px.length);
        for (const p of px) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(SLASH_RADIUS + 1);
        if (f === 1) {
          // O meio do golpe inteiro fica na direção dele
          const a = Math.atan2(mean(px.map((p) => p.y)), mean(px.map((p) => p.x)));
          const want = (dir / SLASH_DIRS) * Math.PI * 2;
          expect(Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)))).toBeLessThan(0.35);
        }
      }
      // O golpe cheio é o quadro do meio; o último é só o fim do rastro
      expect(counts[1]).toBeGreaterThan(counts[0]);
      expect(counts[2]).toBeLessThan(counts[1]);
    }
  });
});

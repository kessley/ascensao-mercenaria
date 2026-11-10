import { FIRE_PALETTE, heatColor } from "./fire";
import { gridBitmap, Grid, type Bitmap } from "./pixel";

/**
 * A arte da magia (Marco 19): a bola de fogo no ar (4 quadros que tremulam) e o brilho da cura,
 * que sobe e se apaga (4 quadros). Sem contorno escuro: a magia brilha.
 */

export const FIREBALL_CELL = 16;
export const FIREBALL_FRAMES = 4;
export const MEND_CELL = 8;
export const MEND_FRAMES = 4;
export const MEND_COLORS = { CORE: 0xf6ffd8, GLOW: 0xb6f07a, EDGE: 0x5aa83a, GOLD: 0xf8e070 } as const;
/** O clarão da explosão: o raio do desenho (a área da bola de fogo) e os quadros. */
export const BLAST_RADIUS = 90;
export const BLAST_CELL = BLAST_RADIUS * 2;
export const BLAST_FRAMES = 6;
export const BLAST_SMOKE = [0x3e3934, 0x5c554d, 0x7a7168] as const;

function hash(x: number, y: number, seed: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

/** A bola de fogo: o miolo claro, a casca laranja, a borda vermelha e línguas que mudam a cada quadro. */
export function fireballSheet(): Bitmap {
  const C = FIREBALL_CELL;
  const g = new Grid(C * FIREBALL_FRAMES, C);
  for (let f = 0; f < FIREBALL_FRAMES; f++) {
    const phi = (f / FIREBALL_FRAMES) * Math.PI * 2;
    for (let y = 0; y < C; y++) {
      for (let x = 0; x < C; x++) {
        const dx = x + 0.5 - C / 2;
        const dy = y + 0.5 - C / 2;
        const a = Math.atan2(dy, dx);
        // A borda ondula: línguas de fogo que giram com o quadro
        const r = 5.2 + 1.1 * Math.sin(a * 5 + phi) + 0.6 * Math.sin(a * 3 - phi * 2);
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const heat = 1 - (d / r) * 0.92 + 0.05 * Math.sin(x * 2.1 + y * 1.7 + phi);
        g.px(f * C + x, y, heatColor(heat) ?? FIRE_PALETTE[0]);
      }
    }
  }
  return gridBitmap(g);
}

/**
 * O clarão da explosão (6 quadros): o miolo branco de calor que cresce e vira fumaça, e o anel de
 * fogo que corre até a borda da área, afina e se quebra. Fora do círculo da área, nada.
 */
export function blastSheet(): Bitmap {
  const C = BLAST_CELL;
  const R = BLAST_RADIUS;
  const F = BLAST_FRAMES;
  const g = new Grid(C * F, C);
  for (let f = 0; f < F; f++) {
    const t = f / (F - 1);
    const core = R * (0.2 + 0.35 * Math.min(1, t * 1.6));
    const ring = R * (0.3 + 0.68 * t);
    const width = 2 + 5 * (1 - t);
    for (let y = 0; y < C; y++) {
      for (let x = 0; x < C; x++) {
        const d = Math.hypot(x + 0.5 - R, y + 0.5 - R);
        if (d > R) continue;
        const speck = hash(x, y, f + 1);
        const chunk = hash(x >> 2, y >> 2, f * 7 + 3);
        let color: number | null = null;
        // O anel: quente e cheio no começo, vermelho e em pedaços no fim
        const off = Math.abs(d - ring);
        if (off < width && chunk > t * 0.7) color = heatColor((1 - off / width) * (1 - 0.72 * t) + 0.15 * speck);
        // O miolo: calor branco que esfria e se desfaz em fumaça
        if (d < core) {
          const k = d / core;
          if (t < 0.55) color = heatColor(1 - k * 0.6 - t * 0.9 + 0.1 * speck) ?? color;
          else if (speck > 0.35 + k * 0.4 + (t - 0.55) * 0.8) color = BLAST_SMOKE[Math.min(2, Math.floor(chunk * 3))];
        }
        if (color !== null) g.px(f * C + x, y, color);
      }
    }
  }
  return gridBitmap(g);
}

export const RING_FRAMES = 4;

/**
 * O anel de uma magia (branco e cinza, para tingir com a cor dela): corre do meio até a borda da
 * área, afina e se desfaz em pontos. Feito para cada raio, sem ampliar o pixel.
 */
export function ringSheet(r: number): Bitmap {
  const C = r * 2;
  const g = new Grid(C * RING_FRAMES, C);
  for (let f = 0; f < RING_FRAMES; f++) {
    const t = (f + 1) / RING_FRAMES;
    const ring = r * (0.3 + 0.68 * t);
    const width = 3.5 - 2 * t;
    for (let y = 0; y < C; y++) {
      for (let x = 0; x < C; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
        const off = Math.abs(d - ring);
        if (d > r || off >= width || hash(x >> 1, y >> 1, f + 11) < t * 0.55) continue;
        g.px(f * C + x, y, off < width * 0.45 ? 0xffffff : 0xc8c8c8);
      }
    }
  }
  return gridBitmap(g);
}

/** O brilho da cura: uma cruz de luz que cresce, abre as pontas e se apaga. */
export function mendSheet(): Bitmap {
  const C = MEND_CELL;
  const g = new Grid(C * MEND_FRAMES, C);
  const M = MEND_COLORS;
  const c = C / 2 - 1;
  for (let f = 0; f < MEND_FRAMES; f++) {
    const ox = f * C;
    if (f === 0) {
      g.px(ox + c, c, M.CORE);
      continue;
    }
    if (f === 3) {
      g.px(ox + c, c - 1, M.EDGE);
      g.px(ox + c, c + 1, M.EDGE);
      continue;
    }
    const arm = f === 1 ? 1 : 2;
    for (let k = 1; k <= arm; k++) {
      const col = k === arm ? M.EDGE : M.GLOW;
      g.px(ox + c + k, c, col);
      g.px(ox + c - k, c, col);
      g.px(ox + c, c + k, col);
      g.px(ox + c, c - k, col);
    }
    g.px(ox + c, c, f === 2 ? M.GOLD : M.CORE);
  }
  return gridBitmap(g);
}

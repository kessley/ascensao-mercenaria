import { Grid, gridBitmap, seeded, type Bitmap } from "./pixel";

/**
 * O tempo em pixel art (G6, parte 2), feito por código: as gotas de chuva (inclinadas pelo vento),
 * o respingo no chão, os flocos de neve, as poças com os círculos da chuva, a neve que cobre o
 * chão aos poucos e os bancos de nevoeiro. Nada aqui tem contorno: chuva, neve e névoa não têm
 * borda escura.
 */

/** Célula da folha do céu (gotas, respingos e flocos). */
export const SKY_CELL = 12;
/** Inclinações das gotas, em pixels ao longo da gota: de −3 (vento para oeste) a 3 (para leste). */
export const SLANTS = 3;
const SLANT_FRAMES = 2 * SLANTS + 1;
/** Quadros da folha do céu: gotas de chuva, gotas de tempestade, respingo e flocos. */
export const SKY = {
  RAIN: 0,
  STORM: SLANT_FRAMES,
  SPLASH: 2 * SLANT_FRAMES,
  SPLASH_FRAMES: 3,
  FLAKE: 2 * SLANT_FRAMES + 3,
  FLAKES: 3,
  TOTAL: 2 * SLANT_FRAMES + 6,
} as const;

/** Quadro da gota pela inclinação (−3 a 3) e se é tempestade (gota mais comprida). */
export function dropFrame(slant: number, storm: boolean): number {
  const s = Math.max(-SLANTS, Math.min(SLANTS, Math.round(slant)));
  return (storm ? SKY.STORM : SKY.RAIN) + s + SLANTS;
}

/** A inclinação da gota pelo vento (o lado e a força). */
export function slantOf(dir: number, strength: number): number {
  return Math.round(dir * Math.min(1, strength) * SLANTS);
}

const DROP_TAIL = 0x6f8aa3;
const DROP_BODY = 0x9db4c8;
const DROP_HEAD = 0xd8e8f4;
const SPLASH = 0xbcd0e0;
const SPLASH_FAINT = 0x7f98ae;
const FLAKE = 0xffffff;
const FLAKE_SHADE = 0xd6e2ee;

function drawDrop(g: Grid, ox: number, slant: number, len: number): void {
  const cx = ox + SKY_CELL / 2;
  const top = SKY_CELL - 1 - len;
  for (let j = 0; j < len; j++) {
    // O vento leva a gota: a ponta de cima fica para trás, a de baixo vai na frente
    const x = Math.round(cx - slant / 2 + (slant * j) / (len - 1));
    const color = j >= len - 2 ? DROP_HEAD : j < len / 3 ? DROP_TAIL : DROP_BODY;
    g.px(x, top + j, color);
  }
}

function drawSplash(g: Grid, ox: number, f: number): void {
  const cx = ox + 6;
  const y = SKY_CELL - 2;
  if (f === 0) {
    g.px(cx, y, SPLASH);
    g.px(cx, y - 1, DROP_HEAD);
    g.px(cx - 1, y - 2, SPLASH_FAINT);
    g.px(cx + 1, y - 2, SPLASH_FAINT);
  } else if (f === 1) {
    for (const [dx, dy] of [[-2, -1], [2, -1], [-1, 0], [1, 0], [-3, -2], [3, -2]]) g.px(cx + dx, y + dy, dy === -2 ? SPLASH_FAINT : SPLASH);
  } else {
    for (let dx = -3; dx <= 3; dx++) g.px(cx + dx, y + (Math.abs(dx) === 3 ? 0 : Math.abs(dx) === 0 ? 1 : 1), SPLASH_FAINT);
    g.px(cx - 4, y, SPLASH_FAINT);
    g.px(cx + 4, y, SPLASH_FAINT);
  }
}

function drawFlake(g: Grid, ox: number, f: number): void {
  const cx = ox + 6;
  const cy = 6;
  if (f === 0) g.px(cx, cy, FLAKE);
  else if (f === 1) {
    g.rect(cx, cy, 2, 2, FLAKE);
    g.px(cx + 1, cy + 1, FLAKE_SHADE);
  } else {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) g.px(cx + dx, cy + dy, FLAKE_SHADE);
    g.px(cx, cy, FLAKE);
  }
}

/** A folha do céu: as gotas (7 inclinações, chuva e tempestade), o respingo em 3 quadros e 3 flocos. */
export function skySheet(): Bitmap {
  const g = new Grid(SKY_CELL * SKY.TOTAL, SKY_CELL);
  for (let s = -SLANTS; s <= SLANTS; s++) {
    drawDrop(g, (SKY.RAIN + s + SLANTS) * SKY_CELL, s, 7);
    drawDrop(g, (SKY.STORM + s + SLANTS) * SKY_CELL, s * 1.4, 10);
  }
  for (let f = 0; f < SKY.SPLASH_FRAMES; f++) drawSplash(g, (SKY.SPLASH + f) * SKY_CELL, f);
  for (let f = 0; f < SKY.FLAKES; f++) drawFlake(g, (SKY.FLAKE + f) * SKY_CELL, f);
  return gridBitmap(g);
}

// --- Poças ---

/** As poças: três tamanhos (linhas), cada um parado e com três quadros do círculo da chuva. */
export const PUDDLE = { w: 28, h: 12, sizes: 3, frames: 4 } as const;
const PUDDLE_SIZES: readonly (readonly [number, number])[] = [
  [12, 4],
  [8, 3],
  [5, 2],
];
const WATER = 0x3c4c5e;
const WATER_DEEP = 0x30404f;
const SKY_GLINT = 0x7f97ae;
const LIP = 0x2c2823;
const RIPPLE = 0xa9bfd2;

const inOval = (x: number, y: number, rx: number, ry: number) => (x * x) / ((rx + 0.3) * (rx + 0.3)) + (y * y) / ((ry + 0.3) * (ry + 0.3)) <= 1;

/** Quadro da poça: tamanho (0 grande, 2 pequena) e quadro (0 parada; 1 a 3, o círculo crescendo). */
export function puddleFrame(size: number, f: number): number {
  return size * PUDDLE.frames + f;
}

export function puddleSheet(): Bitmap {
  const g = new Grid(PUDDLE.w * PUDDLE.frames, PUDDLE.h * PUDDLE.sizes);
  PUDDLE_SIZES.forEach(([rx, ry], size) => {
    for (let f = 0; f < PUDDLE.frames; f++) {
      const cx = f * PUDDLE.w + PUDDLE.w / 2;
      const cy = size * PUDDLE.h + PUDDLE.h / 2;
      // A beira molhada embaixo, a água, o fundo mais escuro e o céu refletido em cima
      g.oval(cx, cy + 1, rx, ry, LIP);
      g.oval(cx, cy, rx, ry, WATER);
      g.oval(cx + 1, cy + 1, Math.max(1, rx - 3), Math.max(1, ry - 1), WATER_DEEP);
      g.rect(cx - Math.round(rx * 0.5), cy - ry + 1, Math.max(2, Math.round(rx * 0.6)), 1, SKY_GLINT);
      if (f === 0) continue;
      // O círculo de uma gota que caiu: cresce do meio para a beira
      const k = f / 3;
      const rr = Math.max(1, rx * k * 0.85);
      const ry2 = Math.max(0.6, ry * k * 0.85);
      let drawn = 0;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if (!inOval(x, y, rx - 1, ry - 0.5)) continue;
          const d = Math.sqrt((x * x) / (rr * rr) + (y * y) / (ry2 * ry2));
          if (Math.abs(d - 1) < 0.22) {
            g.px(cx + x, cy + y, RIPPLE);
            drawn++;
          }
        }
      }
      // Na poça pequena o primeiro círculo nem cabe: fica o pinguinho onde a gota bateu
      if (drawn === 0) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) g.px(cx + dx, cy + dy, RIPPLE);
    }
  });
  return gridBitmap(g);
}

// --- Neve no chão ---

/** O ladrilho da neve que cobre o chão (repete sem emenda). */
export const SNOW_TILE = 128;
/** Quanto do chão cada nível cobre: a neve começa em manchas e fecha o chão. */
export const SNOW_LEVELS = [0.22, 0.45, 0.7, 0.93] as const;
const SNOW = 0xeef3f8;
const SNOW_EDGE = 0xc9d6e2;
const SNOW_SPARK = 0xffffff;

/** Ruído suave que dá a volta nas bordas (para o ladrilho repetir sem emenda). */
function tileNoise(size: number, seed: number): Float32Array {
  const rnd = seeded(seed);
  const out = new Float32Array(size * size);
  for (const [cells, weight] of [[2, 1], [4, 0.6], [8, 0.35], [16, 0.2], [32, 0.12]] as const) {
    const grid = Array.from({ length: cells * cells }, () => rnd());
    const at = (i: number, j: number) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const tx = fx - i;
        const ty = fy - j;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
        const bottom = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
        out[y * size + x] += (top * (1 - sy) + bottom * sy) * weight;
      }
    }
  }
  return out;
}

/** O nível `level` (0 a 3) da neve no chão: manchas que crescem até quase fechar. */
export function snowCover(level: number): Bitmap {
  const size = SNOW_TILE;
  const noise = tileNoise(size, 911);
  const sorted = Array.from(noise).sort((a, b) => a - b);
  const cover = SNOW_LEVELS[Math.max(0, Math.min(SNOW_LEVELS.length - 1, level))];
  const limit = sorted[Math.floor(cover * (sorted.length - 1))];
  const range = sorted[sorted.length - 1] - sorted[0];
  const edge = range * 0.03;
  // A borda é pontilhada: perto do limite, cada pixel sorteia se a neve já pegou ali. No começo a
  // neve é quase só pontinhos; depois, manchas que se juntam
  const grain = range * (0.26 - 0.05 * level);
  const rnd = seeded(77);
  const jitter = Float32Array.from({ length: size * size }, () => rnd() - 0.5);
  const spark = seeded(78 + level);
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = noise[i] + jitter[i] * grain;
    if (v > limit) continue;
    const c = limit - v < edge ? SNOW_EDGE : spark() < 0.02 ? SNOW_SPARK : SNOW;
    rgba[i * 4] = (c >> 16) & 255;
    rgba[i * 4 + 1] = (c >> 8) & 255;
    rgba[i * 4 + 2] = c & 255;
    rgba[i * 4 + 3] = 255;
  }
  return { width: size, height: size, rgba };
}

// --- Nevoeiro ---

export const FOG_BANK = { w: 192, h: 72, kinds: 3 } as const;
const FOG = 0xe4eaee;
/** Matriz de Bayer 4×4: o pontilhado que dá à névoa o jeito de pixel art. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Degraus de transparência da névoa: o pontilhado só passa de um degrau ao vizinho (sem xadrez). */
const FOG_STEPS = 4;

/** Um banco de nevoeiro: mais denso no meio, em degraus de névoa pontilhados entre si. */
export function fogBank(kind: number): Bitmap {
  const { w, h } = FOG_BANK;
  const noise = tileNoise(w, 300 + kind * 17);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < w * h; i++) {
    lo = Math.min(lo, noise[i]);
    hi = Math.max(hi, noise[i]);
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const r = dx * dx + dy * dy;
      if (r >= 1) continue;
      // O ruído mexe na borda: o banco sai em fiapos, não num oval
      const n = (noise[y * w + x] - lo) / (hi - lo);
      const density = Math.max(0, Math.min(1, 1.3 * (1 - r) + 1.3 * (n - 0.5) - 0.15));
      const step = Math.floor(density * FOG_STEPS + (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16);
      if (step <= 0) continue;
      const i = (y * w + x) * 4;
      rgba[i] = (FOG >> 16) & 255;
      rgba[i + 1] = (FOG >> 8) & 255;
      rgba[i + 2] = FOG & 255;
      rgba[i + 3] = Math.round((Math.min(FOG_STEPS, step) / FOG_STEPS) * 255);
    }
  }
  return { width: w, height: h, rgba };
}

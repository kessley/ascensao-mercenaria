import type { Bitmap } from "./pixel";
import { seeded } from "./pixel";

/**
 * O chão que a magia mexe (G6, parte 4): o gelo por cima da água de um lugar e a mancha queimada
 * que o fogo deixa. Um pixel da folha é um pixel do mundo, como o chão de perto.
 */

/** De quantos em quantos px do mundo se pergunta se é água (por pixel sairia caro demais). */
export const ICE_STEP = 4;
/** O maior raio desenhado (acima disso a folha ficaria grande demais). */
export const PATCH_MAX_RADIUS = 400;

export const ICE_COLORS = { FROST: 0xf2f8fb, LIGHT: 0xdcebf3, BASE: 0xc2dae7, DARK: 0x86a8bd } as const;
export const SCORCH_COLORS = { CHAR: 0x221c17, ASH: 0x3a322a, GREY: 0x5c544a } as const;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

function hash(x: number, y: number, seed: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

/** Ruído de valor suave (interpolado entre os cantos da célula). */
function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** A borda de um lugar não é um círculo: um raio que varia com o ângulo (de `lo` a 1 vez `r`). */
function rim(seed: number, lo: number): (angle: number) => number {
  const rnd = seeded(seed);
  const waves = [2, 3, 5, 7].map((k) => ({ k, ph: rnd() * Math.PI * 2, amp: rnd() }));
  const total = waves.reduce((s, w) => s + w.amp, 0) || 1;
  return (a) => {
    let v = 0;
    for (const w of waves) v += w.amp * (0.5 + 0.5 * Math.sin(a * w.k + w.ph));
    return lo + (1 - lo) * (v / total);
  };
}

function put(rgba: Uint8ClampedArray, i: number, c: number, alpha: number): void {
  rgba[i] = (c >> 16) & 0xff;
  rgba[i + 1] = (c >> 8) & 0xff;
  rgba[i + 2] = c & 0xff;
  rgba[i + 3] = alpha;
}

/**
 * O gelo de um lugar: só onde é água (`water(dx, dy)`, em px do mundo a partir do centro). Junto
 * da margem, uma faixa de geada; por dentro, o gelo com manchas claras, riscos de brilho e
 * rachaduras. Na borda do lugar, o gelo se desfaz em pontilhado, como quem ainda está se espalhando.
 */
export function icePatch(radius: number, water: (dx: number, dy: number) => boolean, seed = 1): Bitmap {
  const r = Math.max(8, Math.min(PATCH_MAX_RADIUS, Math.round(radius)));
  const size = r * 2;
  const rgba = new Uint8ClampedArray(size * size * 4);
  // A água, de ICE_STEP em ICE_STEP px (uma célula a mais em volta, para a margem)
  const cols = Math.ceil(size / ICE_STEP) + 3;
  const wet = new Uint8Array(cols * cols);
  for (let gy = 0; gy < cols; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const dx = (gx - 1) * ICE_STEP - r;
      const dy = (gy - 1) * ICE_STEP - r;
      if (dx * dx + dy * dy > (r + ICE_STEP * 2) ** 2) continue;
      wet[gy * cols + gx] = water(dx, dy) ? 1 : 0;
    }
  }
  // A margem não sai em degraus de 4 px: cada pixel pergunta a um vizinho um pouco ao lado
  const wetAt = (x: number, y: number) => {
    const jx = (hash(x, y, seed) - 0.5) * 3;
    const jy = (hash(y, x, seed + 1) - 0.5) * 3;
    const gx = Math.round((x + jx) / ICE_STEP) + 1;
    const gy = Math.round((y + jy) / ICE_STEP) + 1;
    if (gx < 0 || gy < 0 || gx >= cols || gy >= cols) return false;
    return wet[gy * cols + gx] === 1;
  };
  const edge = rim(seed, 0.84);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      const re = r * edge(Math.atan2(dy, dx));
      const t = Math.hypot(dx, dy) / re;
      if (t > 1 || !wetAt(x, y)) continue;
      // A borda do lugar: pontilhada, cada vez mais rala
      if (t > 0.8 && bayer(x, y) > (1 - t) / 0.2) continue;
      let c: number = ICE_COLORS.BASE;
      const shore = !wetAt(x + 3, y) || !wetAt(x - 3, y) || !wetAt(x, y + 3) || !wetAt(x, y - 3);
      if (shore) c = ICE_COLORS.FROST;
      else if ((((x - y * 2) % 41) + 41) % 41 < 2 && noise(x / 30, y / 30, seed + 2) > 0.45) c = ICE_COLORS.LIGHT;
      else if (noise(x / 11, y / 11, seed + 3) - 0.72 > (bayer(x, y) - 0.5) * 0.08) c = ICE_COLORS.LIGHT;
      put(rgba, (y * size + x) * 4, c, 255);
    }
  }
  // As rachaduras: riscos que andam tortos e às vezes se dividem, só no gelo (e não na geada)
  const rnd = seeded(seed * 7 + 3);
  const crack = (x: number, y: number, a: number, len: number, depth: number) => {
    for (let s = 0; s < len; s++) {
      if (s % 4 === 0) a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a);
      y += Math.sin(a);
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= size || py >= size) return;
      const i = (py * size + px) * 4;
      if (rgba[i + 3] === 0 || (rgba[i] === ((ICE_COLORS.FROST >> 16) & 0xff) && rgba[i + 2] === (ICE_COLORS.FROST & 0xff))) continue;
      put(rgba, i, ICE_COLORS.DARK, 255);
      if (depth < 1 && rnd() < 0.05) crack(x, y, a + (rnd() < 0.5 ? 0.8 : -0.8), Math.floor(len * 0.4), depth + 1);
    }
  };
  const n = Math.max(2, Math.round(r / 22));
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r * 0.8;
    crack(r + Math.cos(a) * d, r + Math.sin(a) * d, rnd() * Math.PI * 2, 12 + Math.floor(rnd() * 22), 0);
  }
  return { width: size, height: size, rgba };
}

/**
 * O chão queimado que o fogo deixa: carvão no meio, com pontos de cinza clara, e cinza escura
 * em volta, que se desfaz em pontilhado na borda.
 */
export function scorchPatch(radius: number, seed = 1): Bitmap {
  const r = Math.max(8, Math.min(PATCH_MAX_RADIUS, Math.round(radius)));
  const size = r * 2;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const edge = rim(seed, 0.72);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      // O chão queimado é visto de cima e de lado: um pouco mais largo que alto
      const t = Math.hypot(dx, dy * 1.25) / (r * edge(Math.atan2(dy, dx)));
      if (t > 1) continue;
      const blot = noise(x / 9, y / 9, seed + 5);
      // A borda sai em torrões de cinza (e não em xadrez): o ruído decide, o pontilhado só arremata
      if (t > 0.5 && noise(x / 4, y / 4, seed + 6) * 0.75 + bayer(x, y) * 0.25 < (t - 0.5) / 0.5) continue;
      let c: number = t < 0.5 + (blot - 0.5) * 0.4 ? SCORCH_COLORS.CHAR : SCORCH_COLORS.ASH;
      if (hash(x, y, seed + 9) > 0.94) c = SCORCH_COLORS.GREY;
      put(rgba, (y * size + x) * 4, c, 225);
    }
  }
  return { width: size, height: size, rgba };
}

/** Quantos pixels pintados tem uma folha (os testes conferem o que aparece). */
export function paintedPixels(b: Bitmap, color?: number): number {
  let n = 0;
  for (let i = 0; i < b.rgba.length; i += 4) {
    if (b.rgba[i + 3] === 0) continue;
    if (color !== undefined && ((b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2]) !== color) continue;
    n++;
  }
  return n;
}

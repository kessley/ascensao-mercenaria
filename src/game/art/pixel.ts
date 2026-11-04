/**
 * Pixel art feita por código: uma grade de cores onde se desenha com retângulos, linhas e elipses,
 * e o contorno sai sozinho. Sem Phaser aqui: o resultado é um bitmap RGBA.
 */

export const CLEAR = -1;
/** Sombra no chão: só pinta onde não há corpo, e sai semitransparente. */
export const SHADOW = -2;
export const OUTLINE = 0x1a1522;

export interface Ramp {
  light: number;
  base: number;
  dark: number;
}

export interface Bitmap {
  width: number;
  height: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Três tons a partir de uma cor: luz, base e sombra. */
export function ramp(color: number): Ramp {
  return { light: mix(color, 0xffffff, 0.32), base: color, dark: mix(color, 0x000000, 0.38) };
}

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly data: Int32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Int32Array(w * h).fill(CLEAR);
  }

  px(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : CLEAR;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  /** Caixa com luz à esquerda e sombra à direita. */
  box(x: number, y: number, w: number, h: number, r: Ramp): void {
    this.rect(x, y, w, h, r.base);
    this.rect(x, y, 1, h, r.light);
    if (w > 1) this.rect(x + w - 1, y, 1, h, r.dark);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e = 2 * err;
      if (e >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  oval(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / ((rx + 0.3) * (rx + 0.3)) + (y * y) / ((ry + 0.3) * (ry + 0.3)) <= 1) this.px(cx + x, cy + y, c);
      }
    }
  }

  /** Polígono cheio (asas, cascos, velas): pinta o centro de cada pixel que cai dentro dele. */
  poly(points: readonly (readonly [number, number])[], c: number): void {
    if (points.length < 3) return;
    const ys = points.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if (ay <= sy === by <= sy) continue;
        xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c);
      }
    }
    // Pontas finas (a ponta da asa, a do mastro) não somem: os vértices sempre aparecem
    for (const [x, y] of points) this.px(Math.round(x), Math.round(y), c);
  }

  /** Contorno de 1 px em volta de tudo o que foi desenhado. */
  outline(): void {
    const marks: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== CLEAR) continue;
        if (this.get(x + 1, y) !== CLEAR || this.get(x - 1, y) !== CLEAR || this.get(x, y + 1) !== CLEAR || this.get(x, y - 1) !== CLEAR) marks.push(y * this.w + x);
      }
    }
    for (const i of marks) this.data[i] = OUTLINE;
  }

  shadow(cx: number, cy: number, rx: number, ry: number): void {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / ((rx + 0.3) * (rx + 0.3)) + (y * y) / ((ry + 0.3) * (ry + 0.3)) <= 1 && this.get(cx + x, cy + y) === CLEAR) this.px(cx + x, cy + y, SHADOW);
      }
    }
  }

  /** Copia outra grade para cá, no ponto dado (transparente não apaga nada). */
  stamp(other: Grid, ox: number, oy: number): void {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const c = other.data[y * other.w + x];
        if (c !== CLEAR) this.px(ox + x, oy + y, c);
      }
    }
  }
}

export function gridBitmap(g: Grid): Bitmap {
  const rgba = new Uint8ClampedArray(g.w * g.h * 4);
  g.data.forEach((c, i) => {
    if (c === CLEAR) return;
    if (c === SHADOW) {
      rgba[i * 4 + 3] = 70;
      return;
    }
    rgba[i * 4] = (c >> 16) & 255;
    rgba[i * 4 + 1] = (c >> 8) & 255;
    rgba[i * 4 + 2] = c & 255;
    rgba[i * 4 + 3] = 255;
  });
  return { width: g.w, height: g.h, rgba };
}

/** Gerador pequeno e repetível. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dobra a resolução com Scale2x: as diagonais saem lisas, sem o pixel grosso de uma ampliação
 * simples. Vem antes do contorno, que sai com 1 px como o de todo mundo.
 */
export function enlarge(src: Grid): Grid {
  const g = new Grid(src.w * 2, src.h * 2);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const p = src.get(x, y);
      const a = src.get(x, y - 1);
      const b = src.get(x + 1, y);
      const c = src.get(x - 1, y);
      const d = src.get(x, y + 1);
      g.px(2 * x, 2 * y, c === a && c !== d && a !== b ? a : p);
      g.px(2 * x + 1, 2 * y, a === b && a !== c && b !== d ? b : p);
      g.px(2 * x, 2 * y + 1, d === c && d !== b && c !== a ? c : p);
      g.px(2 * x + 1, 2 * y + 1, b === d && b !== a && d !== c ? d : p);
    }
  }
  return g;
}

/** Luz na borda de cima e sombra na de baixo de cada forma: o volume que a resolução dobrada permite. */
export function rimLight(g: Grid): void {
  const out = g.data.slice();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      if (c < 0 || c === OUTLINE) continue;
      if (g.get(x, y - 1) === CLEAR) out[y * g.w + x] = mix(c, 0xffffff, 0.22);
      else if (g.get(x, y + 1) === CLEAR) out[y * g.w + x] = mix(c, 0x000000, 0.22);
    }
  }
  g.data.set(out);
}

/** Miolo aceso nas manchas de uma cor (orbe, olhos): onde a cor tem a mesma cor dos 4 lados. */
export function glint(g: Grid, color: number, core: number): void {
  const marks: number[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== color) continue;
      if (g.get(x - 1, y) === color && g.get(x + 1, y) === color && g.get(x, y - 1) === color && g.get(x, y + 1) === color) marks.push(y * g.w + x);
    }
  }
  for (const i of marks) g.data[i] = core;
}

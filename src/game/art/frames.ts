import { CLEAR, Grid, OUTLINE, gridBitmap, ramp, type Bitmap } from "./pixel";

/**
 * As molduras da interface (G5, parte 2), em pixel art feita por código como as figuras. Cada
 * uma é uma peça pequena de 9 partes: os cantos ficam como estão, os lados e o meio se repetem
 * (o `border-image` do CSS). Sem DOM aqui: o resultado é um bitmap, que `ui/pixelFrames.ts`
 * transforma em imagem.
 */

export type FrameKind = "WOOD" | "IRON" | "PARCHMENT";
export type ButtonTone = "WOOD" | "GOLD" | "RED" | "BLUE" | "IRON";
export type ButtonState = "UP" | "HOVER" | "DOWN";

/** Pixels de borda de cada moldura (o corte do `border-image`). */
export const FRAME_SLICE = 6;
export const BUTTON_SLICE = 3;
const FRAME = FRAME_SLICE * 3;
const BUTTON = BUTTON_SLICE * 3;

const WOOD = { light: 0x9a6a40, base: 0x70472a, grain: 0x5e3a22, dark: 0x4a2c18, inner: 0x2a1a10, fill: 0x1f1712 };
const IRON = { light: 0x9aa1aa, base: 0x5d636b, dark: 0x363a40, rivet: 0xd2d7dd, inner: 0x07080b, fill: 0x0e1016 };
const PAPER = { edge: 0x4a3520, burnt: 0x8a6a3e, rim: 0xc4a36c, warm: 0xd9c08e, fill: 0xe9d6a8 };

/** Quanto do meio deixa ver o mundo atrás (0 a 1). */
const FILL_ALPHA: Record<FrameKind, number> = { WOOD: 0.97, IRON: 0.84, PARCHMENT: 1 };

const BUTTON_COLOR: Record<ButtonTone, number> = { WOOD: 0x6e4528, GOLD: 0xa8741c, RED: 0x8a2b22, BLUE: 0x2d5688, IRON: 0x4a5059 };

/** Uma placa de ferro com rebite no canto (5×5). */
function bracket(g: Grid, x: number, y: number): void {
  g.rect(x, y, 5, 5, IRON.base);
  g.rect(x, y, 5, 1, IRON.light);
  g.rect(x, y, 1, 5, IRON.light);
  g.rect(x, y + 4, 5, 1, IRON.dark);
  g.rect(x + 4, y, 1, 5, IRON.dark);
  g.px(x + 2, y + 2, IRON.rivet);
  g.px(x + 3, y + 3, IRON.dark);
}

/** A borda de fora: o contorno, com os quatro cantos de fora vazios (um canto arredondado de pixel). */
function rim(g: Grid, size: number, color = OUTLINE): void {
  g.rect(0, 0, size, 1, color);
  g.rect(0, size - 1, size, 1, color);
  g.rect(0, 0, 1, size, color);
  g.rect(size - 1, 0, 1, size, color);
  for (const [x, y] of [
    [0, 0],
    [size - 1, 0],
    [0, size - 1],
    [size - 1, size - 1],
  ])
    g.px(x, y, CLEAR);
}

function woodFrame(): Grid {
  const g = new Grid(FRAME, FRAME);
  g.rect(0, 0, FRAME, FRAME, WOOD.fill);
  const end = FRAME - 1;
  // As tábuas: luz em cima, sombra embaixo, o veio no meio (a cada 6 pixels, um nó mais escuro)
  for (let i = 1; i < end; i++) {
    for (const y0 of [1, end - 4]) {
      g.px(i, y0, WOOD.light);
      g.px(i, y0 + 1, WOOD.base);
      g.px(i, y0 + 2, i % 6 === 2 ? WOOD.grain : WOOD.base);
      g.px(i, y0 + 3, WOOD.dark);
    }
    for (const x0 of [1, end - 4]) {
      g.px(x0, i, WOOD.light);
      g.px(x0 + 1, i, WOOD.base);
      g.px(x0 + 2, i, i % 6 === 3 ? WOOD.grain : WOOD.base);
      g.px(x0 + 3, i, WOOD.dark);
    }
  }
  // A linha funda entre a tábua e o meio
  const a = FRAME_SLICE - 1;
  const b = FRAME - FRAME_SLICE;
  g.rect(a, a, b - a + 1, 1, WOOD.inner);
  g.rect(a, b, b - a + 1, 1, WOOD.inner);
  g.rect(a, a, 1, b - a + 1, WOOD.inner);
  g.rect(b, a, 1, b - a + 1, WOOD.inner);
  rim(g, FRAME);
  // Cantoneiras de ferro
  bracket(g, 1, 1);
  bracket(g, end - 5, 1);
  bracket(g, 1, end - 5);
  bracket(g, end - 5, end - 5);
  return g;
}

function ironFrame(): Grid {
  const g = new Grid(FRAME, FRAME);
  g.rect(0, 0, FRAME, FRAME, IRON.fill);
  const end = FRAME - 1;
  // Um trilho de ferro de 3 pixels, com luz em cima e à esquerda de cada trilho
  for (let i = 1; i < end; i++) {
    for (const y0 of [1, end - 3]) {
      g.px(i, y0, IRON.light);
      g.px(i, y0 + 1, IRON.base);
      g.px(i, y0 + 2, IRON.dark);
    }
    for (const x0 of [1, end - 3]) {
      g.px(x0, i, IRON.light);
      g.px(x0 + 1, i, IRON.base);
      g.px(x0 + 2, i, IRON.dark);
    }
  }
  // A sombra do trilho no meio
  const a = 4;
  const b = FRAME - 5;
  g.rect(a, a, b - a + 1, 1, IRON.inner);
  g.rect(a, a, 1, b - a + 1, IRON.inner);
  rim(g, FRAME);
  // Rebites nos cantos
  for (const [x, y] of [
    [2, 2],
    [end - 2, 2],
    [2, end - 2],
    [end - 2, end - 2],
  ]) {
    g.px(x, y, IRON.rivet);
  }
  return g;
}

function parchmentFrame(): Grid {
  const g = new Grid(FRAME, FRAME);
  g.rect(0, 0, FRAME, FRAME, PAPER.fill);
  const end = FRAME - 1;
  // A borda queimada, com manchas que se repetem a cada 6 pixels
  for (let i = 1; i < end; i++) {
    const spot = i % 6 === 4;
    for (const [x, y, dx, dy] of [
      [i, 1, 0, 1],
      [i, end - 1, 0, -1],
      [1, i, 1, 0],
      [end - 1, i, -1, 0],
    ]) {
      g.px(x, y, spot ? PAPER.burnt : PAPER.rim);
      g.px(x + dx, y + dy, spot ? PAPER.rim : PAPER.warm);
      g.px(x + dx * 2, y + dy * 2, PAPER.warm);
    }
  }
  rim(g, FRAME, PAPER.edge);
  return g;
}

/** O meio da moldura (o que o CSS estica): só ele fica semitransparente. */
function withFillAlpha(bm: Bitmap, size: number, slice: number, alpha: number): Bitmap {
  if (alpha >= 1) return bm;
  const a = Math.round(alpha * 255);
  for (let y = slice - 1; y <= size - slice; y++) {
    for (let x = slice - 1; x <= size - slice; x++) {
      const inEdge = x === slice - 1 || y === slice - 1 || x === size - slice || y === size - slice;
      const i = (y * size + x) * 4;
      // A linha funda da madeira e a sombra do ferro ficam opacas
      if (!inEdge || bm.rgba[i + 3] === 255) bm.rgba[i + 3] = inEdge ? 255 : a;
    }
  }
  return bm;
}

export function frameArt(kind: FrameKind): Bitmap {
  const g = kind === "WOOD" ? woodFrame() : kind === "IRON" ? ironFrame() : parchmentFrame();
  return withFillAlpha(gridBitmap(g), FRAME, FRAME_SLICE, FILL_ALPHA[kind]);
}

/**
 * Um botão de 9×9 (cortes de 3): em cima, a luz na borda de cima e na da esquerda; apertado, a
 * luz vai para baixo. O contorno tem os cantos vazios.
 */
export function buttonArt(tone: ButtonTone, state: ButtonState): Bitmap {
  const base = BUTTON_COLOR[tone];
  const r = ramp(state === "HOVER" ? ramp(base).light : base);
  const g = new Grid(BUTTON, BUTTON);
  const face = state === "DOWN" ? r.dark : r.base;
  g.rect(0, 0, BUTTON, BUTTON, face);
  const top = state === "DOWN" ? r.dark : r.light;
  const bottom = state === "DOWN" ? r.base : r.dark;
  g.rect(1, 1, BUTTON - 2, 1, top);
  g.rect(1, 1, 1, BUTTON - 2, top);
  g.rect(1, BUTTON - 2, BUTTON - 2, 1, bottom);
  g.rect(BUTTON - 2, 1, 1, BUTTON - 2, bottom);
  rim(g, BUTTON);
  return gridBitmap(g);
}

export const FRAME_KINDS: readonly FrameKind[] = ["WOOD", "IRON", "PARCHMENT"];
export const BUTTON_TONES: readonly ButtonTone[] = ["WOOD", "GOLD", "RED", "BLUE", "IRON"];
export const BUTTON_STATES: readonly ButtonState[] = ["UP", "HOVER", "DOWN"];

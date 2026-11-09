import { Grid, gridBitmap, type Bitmap } from "./pixel";

/**
 * O fogo (G6, parte 1): a chama da fogueira, a da tocha (no poste ou na mão) e a brasa da forja,
 * em quadros de pixel art feitos por código. Sem contorno escuro: o fogo brilha. Cada folha tem
 * os quadros lado a lado e dá a volta sem emenda, porque tudo segue a fase do quadro em senos
 * de frequência inteira.
 */

export type FlameKind = "BONFIRE" | "TORCH" | "HELD" | "EMBER";

export interface FlameCell {
  w: number;
  h: number;
  frames: number;
  /** Quadros por segundo da animação. */
  fps: number;
  /** O pé da chama no quadro (onde ela nasce; na tocha da mão, a ponta do cabo). */
  footX: number;
  footY: number;
}

export const FLAMES: Record<FlameKind, FlameCell> = {
  BONFIRE: { w: 28, h: 34, frames: 6, fps: 10, footX: 14, footY: 30 },
  TORCH: { w: 8, h: 13, frames: 4, fps: 11, footX: 4, footY: 12 },
  HELD: { w: 7, h: 16, frames: 4, fps: 11, footX: 3.5, footY: 16 },
  EMBER: { w: 14, h: 9, frames: 4, fps: 5, footX: 7, footY: 8 },
};

/** Do mais frio ao mais quente: a borda, o vermelho, o laranja, o amarelo e o miolo. */
export const FIRE_PALETTE = [0x7a1e0a, 0xc83a12, 0xf07a1a, 0xf8c040, 0xfff2a8] as const;
/** Calor a partir do qual cada cor da paleta aparece (abaixo do primeiro, nada). */
const HEAT_STEPS = [0.06, 0.2, 0.4, 0.6, 0.8] as const;

const WOOD = 0x6b4a2b;
const WOOD_DARK = 0x4a3420;
const WRAP = 0x3a2a1c;

/** Uma língua de fogo: larga no pé, fina na ponta, que balança mais em cima. */
interface Tongue {
  dx: number;
  /** Meia largura no pé. */
  w: number;
  h: number;
  /** Defasagem e frequência (inteira) do respirar da altura. */
  ph: number;
  m: number;
  sway: number;
  /** Quão quente é o pé (1 = miolo claro; a brasa da forja é mais baixa). */
  hot?: number;
}

/** Faísca ou pedaço de chama que se solta e sobe. */
interface Lick {
  dx: number;
  /** Entre que alturas (em fração da língua maior) ela sobe. */
  from: number;
  to: number;
  /** Em que ponto da subida ela começa (0 a 1). */
  at: number;
  color: number;
}

export function heatColor(heat: number): number | null {
  let c: number | null = null;
  for (let i = 0; i < HEAT_STEPS.length; i++) if (heat >= HEAT_STEPS[i]) c = FIRE_PALETTE[i];
  return c;
}

function tongueHeat(t: Tongue, fx: number, fy: number, x: number, y: number, phi: number): number {
  const hh = t.h * (0.82 + 0.18 * Math.sin(phi * t.m + t.ph));
  const v = (fy - (y + 0.5)) / hh;
  if (v < -0.18 || v > 1) return 0;
  const vv = Math.max(0, v);
  const cx = fx + t.dx + t.sway * Math.sin(phi + t.ph + vv * 2.6) * vv;
  // Embaixo do pé, a chama arredonda; em cima, afina até a ponta
  const half = v < 0 ? t.w * Math.sqrt(1 - (v / 0.18) ** 2) : t.w * Math.pow(1 - vv, 0.75);
  if (half <= 0.05) return 0;
  const across = Math.abs(x + 0.5 - cx) / half;
  if (across >= 1) return 0;
  // Faixas de cor da borda para dentro: o miolo claro fica só no meio do pé
  return Math.pow(1 - across, 0.7) * (1 - 0.72 * vv) * (t.hot ?? 1);
}

function drawFlame(g: Grid, ox: number, cell: FlameCell, tongues: readonly Tongue[], licks: readonly Lick[], f: number, fy = cell.footY): void {
  const phi = (2 * Math.PI * f) / cell.frames;
  const fx = cell.footX;
  for (let y = 0; y < cell.h; y++) {
    for (let x = 0; x < cell.w; x++) {
      let heat = 0;
      for (const t of tongues) heat = Math.max(heat, tongueHeat(t, fx, fy, x, y, phi));
      if (heat <= 0) continue;
      // Um pouco de turbulência, que também dá a volta com o quadro
      heat += 0.04 * Math.sin(x * 1.9 + y * 1.3 - phi * 2);
      const c = heatColor(heat);
      if (c !== null) g.px(ox + x, y, c);
    }
  }
  const top = Math.max(...tongues.map((t) => t.h));
  for (const l of licks) {
    const p = (f / cell.frames + l.at) % 1;
    const y = Math.round(fy - top * (l.from + (l.to - l.from) * p));
    const x = Math.round(fx + l.dx + Math.sin(phi + l.at * 6) * 0.8 - 0.5);
    if (y < 0 || x < 0 || x >= cell.w) continue;
    // Sobe e esfria: na metade de cima da subida vira vermelho
    g.px(ox + x, y, p > 0.6 && l.color !== FIRE_PALETTE[4] ? FIRE_PALETTE[1] : l.color);
  }
}

const BONFIRE_TONGUES: Tongue[] = [
  { dx: 0, w: 6.5, h: 22, ph: 0, m: 1, sway: 1.6 },
  { dx: -5, w: 4.2, h: 15, ph: 2.1, m: 2, sway: 1.4 },
  { dx: 5, w: 4.2, h: 16, ph: 4.2, m: 1, sway: 1.4 },
  { dx: -8.5, w: 2.6, h: 9, ph: 1, m: 2, sway: 1 },
  { dx: 8.5, w: 2.6, h: 9, ph: 3.3, m: 1, sway: 1 },
];
const BONFIRE_LICKS: Lick[] = [
  { dx: -2, from: 0.75, to: 1.12, at: 0, color: FIRE_PALETTE[2] },
  { dx: 3, from: 0.7, to: 1.08, at: 0.5, color: FIRE_PALETTE[2] },
  { dx: -6, from: 0.5, to: 0.85, at: 0.25, color: FIRE_PALETTE[1] },
  { dx: 1, from: 1.05, to: 1.3, at: 0.66, color: FIRE_PALETTE[4] },
  { dx: 6, from: 0.95, to: 1.25, at: 0.15, color: FIRE_PALETTE[3] },
];

const TORCH_TONGUES: Tongue[] = [
  { dx: 0, w: 2.6, h: 9, ph: 0, m: 1, sway: 1 },
  { dx: 0.8, w: 1.6, h: 5.5, ph: 2.4, m: 2, sway: 0.6 },
];
const TORCH_LICKS: Lick[] = [{ dx: 0, from: 0.9, to: 1.25, at: 0, color: FIRE_PALETTE[3] }];

const HELD_TONGUES: Tongue[] = [
  { dx: 0, w: 2.2, h: 7, ph: 0, m: 1, sway: 0.9 },
  { dx: -0.7, w: 1.4, h: 4.5, ph: 2.7, m: 2, sway: 0.5 },
];
const HELD_LICKS: Lick[] = [{ dx: 0, from: 0.9, to: 1.3, at: 0.4, color: FIRE_PALETTE[3] }];
/** Altura do cabo da tocha da mão, com o pano enrolado na ponta. */
const HELD_STICK = 7;

const EMBER_TONGUES: Tongue[] = [
  { dx: -2.5, w: 1.6, h: 4, ph: 0, m: 1, sway: 0.5, hot: 0.72 },
  { dx: 2.5, w: 1.8, h: 5, ph: 3.1, m: 1, sway: 0.5, hot: 0.72 },
];

/** A brasa do fogão: carvões que acendem e apagam, e duas chamas baixas. */
function drawEmber(g: Grid, ox: number, f: number): void {
  const cell = FLAMES.EMBER;
  const phi = (2 * Math.PI * f) / cell.frames;
  for (let y = cell.h - 4; y < cell.h; y++) {
    for (let x = 1; x < cell.w - 1; x++) {
      const k = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const hash = k - Math.floor(k);
      // Quase todo carvão em vermelho; alguns pontos quentes que acendem e apagam
      const heat = 0.22 + 0.16 * Math.sin(phi + hash * 6.283) + (hash > 0.75 ? 0.3 : 0) + (y === cell.h - 1 ? -0.1 : 0);
      g.px(ox + x, y, heatColor(heat) ?? FIRE_PALETTE[0]);
    }
  }
  drawFlame(g, ox, cell, EMBER_TONGUES, [], f, cell.h - 3);
}

/** A folha de uma chama: os quadros lado a lado, cada um com `FLAMES[kind]` de tamanho. */
export function flameSheet(kind: FlameKind): Bitmap {
  const cell = FLAMES[kind];
  const g = new Grid(cell.w * cell.frames, cell.h);
  for (let f = 0; f < cell.frames; f++) {
    const ox = f * cell.w;
    if (kind === "BONFIRE") drawFlame(g, ox, cell, BONFIRE_TONGUES, BONFIRE_LICKS, f);
    else if (kind === "TORCH") drawFlame(g, ox, cell, TORCH_TONGUES, TORCH_LICKS, f);
    else if (kind === "EMBER") drawEmber(g, ox, f);
    else {
      // O cabo na mão, o pano enrolado e a chama em cima dele
      const x = ox + Math.floor(cell.footX);
      drawFlame(g, ox, cell, HELD_TONGUES, HELD_LICKS, f, cell.h - HELD_STICK - 2);
      g.rect(x, cell.h - HELD_STICK, 1, HELD_STICK, WOOD);
      g.px(x, cell.h - 1, WOOD_DARK);
      g.rect(x - 1, cell.h - HELD_STICK - 2, 3, 2, WRAP);
    }
  }
  return gridBitmap(g);
}

/**
 * O tremor de uma luz de fogo (multiplica o raio): dois senos com a fase tirada do lugar, para
 * as chamas não tremerem juntas. `amp` 0 = luz parada (janela de vidro, lampião fechado).
 */
export function flicker(x: number, y: number, amp: number, time: number): number {
  if (amp <= 0) return 1;
  const h = (Math.abs(x * 12.9898 + y * 78.233) % 1000) * 0.00628;
  return 1 + amp * (0.6 * Math.sin(time * 0.013 + h) + 0.4 * Math.sin(time * 0.031 + h * 2.3));
}

/** Quantos pixels acesos tem cada quadro (o teste confere que a chama mexe e não some). */
export function litPixels(b: Bitmap, kind: FlameKind): number[] {
  const cell = FLAMES[kind];
  return Array.from({ length: cell.frames }, (_, f) => {
    let n = 0;
    for (let y = 0; y < cell.h; y++) {
      for (let x = 0; x < cell.w; x++) {
        const i = (y * b.width + f * cell.w + x) * 4;
        if (b.rgba[i + 3] === 255 && b.rgba[i] > 0xb0) n++;
      }
    }
    return n;
  });
}

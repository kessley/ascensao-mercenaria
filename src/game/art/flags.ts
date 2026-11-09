import { Grid, gridBitmap, type Bitmap } from "./pixel";

/**
 * Bandeiras ao vento (G6, parte 2): o mastro e o pano, que cai no mastro com calmaria e tremula
 * com vento. O pano sai para a direita (leste); para o oeste, o Phaser espelha a folha. Por isso
 * o mastro fica no meio da célula: o espelho é em volta do meio da textura.
 */

/** Quadros: 0 caído (calmaria) e 1 a 4 tremulando. */
export const FLAG_FRAMES = 5;
const WAVE_FRAMES = 4;

const POLE = 0x6b4a2b;
const POLE_LIGHT = 0x8a6a40;
const FINIAL = 0xc9a23a;
const OUTLINE = 0x1a1522;

function shade(c: number, t: number): number {
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (s: number) => Math.round(((c >> s) & 255) * (1 - k) + to * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export interface FlagSpec {
  color: number;
  /** Flâmula de duas pontas (true) ou pano retangular. */
  pennant: boolean;
  /** Altura do mastro. */
  height: number;
  /** Comprimento do pano. */
  cloth: number;
}

/** Célula da bandeira e o pé do mastro dentro dela. */
export function flagCell(f: FlagSpec): { w: number; h: number; footX: number; footY: number } {
  const long = f.pennant ? Math.round(f.cloth * 1.36) : f.cloth;
  const w = 2 * (long + 5);
  const h = f.height + 10;
  return { w, h, footX: w / 2, footY: h - 2 };
}

/** Altura de cada coluna do pano (a flâmula afina até a ponta) e onde ela começa. */
function columns(f: FlagSpec): { len: number; top: (i: number) => number; tall: (i: number) => number } {
  if (f.pennant) {
    const half = Math.round(f.cloth * 0.45);
    const long = Math.round(f.cloth * 1.36);
    // Em volta da linha do meio: as duas bordas descem e sobem juntas, sem serrilhar
    const edge = (i: number) => half * (1 - i / long);
    return { len: long, top: (i) => Math.round(half - edge(i)), tall: (i) => Math.max(1, Math.round(half + edge(i)) - Math.round(half - edge(i)) + 1) };
  }
  const h = Math.round(f.cloth * 0.73);
  return { len: f.cloth, top: () => 0, tall: () => h };
}

/** A folha de uma bandeira: o quadro caído e os quatro do pano tremulando para o leste. */
export function flagSheet(f: FlagSpec): Bitmap {
  const cell = flagCell(f);
  const g = new Grid(cell.w * FLAG_FRAMES, cell.h);
  const { len, top, tall } = columns(f);
  for (let fr = 0; fr < FLAG_FRAMES; fr++) {
    const ox = fr * cell.w;
    const x = ox + cell.footX - 1;
    const base = cell.footY;
    const mast = base - f.height;
    const sub = new Grid(cell.w, cell.h);
    sub.rect(x - ox, mast - 2, 2, f.height + 2, POLE);
    sub.rect(x - ox, mast - 2, 1, f.height + 2, POLE_LIGHT);
    sub.px(x - ox, mast - 3, FINIAL);
    sub.px(x - ox + 1, mast - 3, FINIAL);
    const px0 = x - ox + 2;
    if (fr === 0) {
      // Calmaria: o pano cai junto do mastro, em dobras
      const w = Math.max(2, Math.round(len * 0.28));
      const hang = Math.round((f.pennant ? len * 0.7 : tall(0) * 1.3) + 2);
      for (let i = 0; i < w; i++) {
        const t = f.pennant ? Math.round(hang * (1 - i / (w + 1))) : hang - (i % 2);
        for (let j = 0; j < t; j++) sub.px(px0 + i, mast + j, i % 3 === 1 ? shade(f.color, -0.18) : j === 0 ? shade(f.color, 0.3) : f.color);
      }
    } else {
      // Ao vento: cada coluna sobe e desce numa onda que cresce do mastro para a ponta
      const phase = ((fr - 1) / WAVE_FRAMES) * Math.PI * 2;
      // (Vizinhas não se afastam mais de 1 px: o pano não se parte, nem na ponta fina da flâmula)
      const offs: number[] = [];
      for (let i = 0; i <= len; i++) {
        const raw = Math.round(Math.min(2.5, 0.3 + i * 0.09) * Math.sin(phase - i * 0.45) + i * 0.04);
        offs.push(i === 0 ? raw : Math.max(offs[i - 1] - 1, Math.min(offs[i - 1] + 1, raw)));
      }
      for (let i = 0; i < len; i++) {
        const y0 = mast + top(i) + offs[i];
        const slope = offs[i + 1] - offs[i];
        const c = slope > 0 ? shade(f.color, -0.2) : slope < 0 ? shade(f.color, 0.14) : f.color;
        const h = tall(i);
        for (let j = 0; j < h; j++) sub.px(px0 + i, y0 + j, j === 0 ? shade(c, 0.25) : j === h - 1 && h > 2 ? shade(c, -0.25) : c);
      }
    }
    sub.outline();
    for (let y = 0; y < cell.h; y++) for (let xx = 0; xx < cell.w; xx++) {
      const c = sub.get(xx, y);
      if (c >= 0) g.px(ox + xx, y, c === OUTLINE ? OUTLINE : c);
    }
  }
  return gridBitmap(g);
}

/** O quadro da bandeira pelo vento e pela hora (`phase` desencontra as bandeiras de uma rua). */
export function flagFrame(strength: number, calm: number, time: number, phase: number): number {
  if (strength < calm) return 0;
  const fps = 3 + 9 * Math.min(1, strength);
  return 1 + (Math.floor((time / 1000) * fps + phase) % WAVE_FRAMES);
}

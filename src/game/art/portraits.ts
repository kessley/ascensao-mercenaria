import type { Culture } from "./buildings";
import { Grid, gridBitmap, ramp, seeded, type Bitmap, type Ramp } from "./pixel";

/**
 * Os retratos (G5, parte 4): o busto de um personagem em 32×32, feito por código como as figuras.
 * O rosto sai da semente (o mesmo personagem tem sempre o mesmo rosto); o resto sai do que o jogo
 * sabe dele: o sexo, a idade (cabelo grisalho, rugas, calvície), a cultura (tons de pele e de
 * cabelo, penteados e toucas), as cicatrizes do Marco 18 e o papel (armadura do Comandante, a
 * faixa do capitão, o gibão do tenente, a roupa e a coroa dos nobres).
 */

export const PORTRAIT_SIZE = 32;

export type PortraitRole = "COMMANDER" | "CAPTAIN" | "LIEUTENANT" | "NOBLE";
export type PortraitCrown = "CROWN" | "CIRCLET";

export interface PortraitSpec {
  /** Semente dos traços do rosto (o id ou o nome). */
  seed: string;
  female: boolean;
  age: number;
  culture: Culture;
  /** Cicatrizes: cada uma deixa uma marca; da quarta em diante, o tapa-olho. */
  scars: number;
  role: PortraitRole;
  /** A cor da roupa: a do bando ou a do reino do nobre. */
  color: number;
  crown?: PortraitCrown;
}

/** Os tons de pele de cada cultura, do mais claro ao mais escuro (as faixas se cruzam). */
export const SKIN_TONES: Readonly<Record<Culture, readonly number[]>> = {
  REALMS: [0xf2cdae, 0xe2b392, 0xd09a78, 0xb7805e],
  SANDS: [0xd09a70, 0xb07850, 0x8e5c3c, 0x6c442c],
  ISLES: [0xf6d6bc, 0xeac09e, 0xd8a47e, 0xb27e5a],
  JADE: [0xf2d4ae, 0xe2be94, 0xcca27a, 0xae8660],
};

export const HAIR_TONES: Readonly<Record<Culture, readonly number[]>> = {
  REALMS: [0x6a4428, 0x3a2618, 0xc8a050, 0x8a4a2a, 0x2a201a],
  SANDS: [0x1e1612, 0x3a2618, 0x2a1c14, 0x5a3a24],
  ISLES: [0xa84a24, 0xc0682e, 0xd8b868, 0x6a4428],
  JADE: [0x18141a, 0x2a2024, 0x221a1c],
};

const CLOTH_TONES = [0xe8e0d0, 0x3a5a9a, 0xa83a2a, 0x2a6a5a, 0xc8a040];
const STEEL = ramp(0x8a929c);
const GOLD = ramp(0xd8a830);
const WHITE = 0xece4dc;
const SCAR = 0xe8a8a0;

type HairStyle = "SHORT" | "CROP" | "LONG" | "BUN" | "BRAID" | "TOPKNOT" | "BALD" | "WRAP";
type Beard = "NONE" | "STUBBLE" | "SHORT" | "FULL" | "MUSTACHE";

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** FNV-1a: a semente vira um número. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** O que muda o desenho, numa chave (para guardar a imagem pronta). */
export function portraitKey(p: PortraitSpec): string {
  return [p.seed, p.female ? "F" : "M", Math.floor(p.age / 5), p.culture, Math.min(p.scars, 5), p.role, p.color, p.crown ?? ""].join("|");
}

/** As escolhas tiradas da semente: sempre as mesmas para o mesmo personagem. */
export function portraitTraits(p: PortraitSpec): { skin: number; hair: number; style: HairStyle; beard: Beard; eye: number; cloth: number } {
  // Todos os sorteios saem de uma vez, na mesma ordem: com a idade, o mesmo rosto fica calvo ou
  // ganha barba, mas não troca de cor de pele nem de penteado à toa
  const rnd = seeded(hashSeed(p.seed));
  const r = Array.from({ length: 9 }, () => rnd());
  const pick = <T>(list: readonly T[], v: number): T => list[Math.floor(v * list.length)];
  const skin = pick(SKIN_TONES[p.culture], r[0]);
  const hair = pick(HAIR_TONES[p.culture], r[1]);
  const light = p.culture === "REALMS" || p.culture === "ISLES";
  const eye = light && r[2] < 0.4 ? pick([0x3a6aa8, 0x4a7a3a, 0x6a8aa0], r[2] / 0.4) : 0x2a1e1a;
  const cloth = pick(CLOTH_TONES, r[3]);
  let style: HairStyle;
  if (p.female) {
    if (p.culture === "SANDS" && r[4] < 0.4) style = "WRAP";
    else if (p.culture === "JADE" && r[4] < 0.5) style = "BUN";
    else if (p.culture === "ISLES" && r[4] < 0.5) style = "BRAID";
    else style = pick(["LONG", "LONG", "BUN", "BRAID"] as const, r[5]);
  } else {
    const bald = p.age >= 60 ? 0.5 : p.age >= 45 ? 0.25 : 0;
    if (r[6] < bald) style = "BALD";
    else if (p.culture === "SANDS" && r[4] < 0.35) style = "WRAP";
    else if (p.culture === "JADE" && r[4] < 0.4) style = "TOPKNOT";
    else if (p.culture === "ISLES" && r[4] < 0.25) style = "LONG";
    else style = pick(["SHORT", "SHORT", "CROP"] as const, r[5]);
  }
  let beard: Beard = "NONE";
  if (!p.female && p.age >= 16 && r[7] < (p.age < 22 ? 0.2 : 0.7)) beard = pick(["STUBBLE", "SHORT", "FULL", "MUSTACHE"] as const, r[8]);
  return { skin, hair, style, beard, eye, cloth };
}

/** A cor do cabelo com a idade: começa a branquear aos 40 e fica branco perto dos 70. */
export function agedHair(hair: number, age: number): number {
  const grey = Math.min(1, Math.max(0, (age - 40) / 28));
  return mix(hair, 0xd8d4d0, grey * 0.85);
}

const BACKDROP: Record<PortraitRole, number> = { COMMANDER: 0x1e2a3a, CAPTAIN: 0x3a2420, LIEUTENANT: 0x22302a, NOBLE: 0 };

function clothes(g: Grid, p: PortraitSpec): void {
  const band = ramp(p.color);
  const shoulders: [number, number][] = [
    [8, 23],
    [24, 23],
    [31, 28],
    [31, 31],
    [0, 31],
    [0, 28],
  ];
  if (p.role === "COMMANDER") {
    // A capa do bando atrás, a couraça na frente, as ombreiras e o fecho de ouro
    g.poly(shoulders, band.base);
    g.poly([[2, 29], [8, 25], [8, 31], [1, 31]], band.dark);
    g.poly([[30, 29], [24, 25], [24, 31], [31, 31]], band.dark);
    g.rect(10, 23, 13, 9, STEEL.base);
    g.rect(10, 23, 2, 9, STEEL.light);
    g.rect(21, 23, 2, 9, STEEL.dark);
    g.line(16, 25, 16, 31, STEEL.dark);
    g.oval(7, 26, 4, 2, STEEL.light);
    g.oval(25, 26, 4, 2, STEEL.base);
    g.px(25, 27, STEEL.dark);
    g.rect(12, 22, 9, 2, STEEL.dark);
    g.px(10, 24, GOLD.light);
    g.px(22, 24, GOLD.base);
  } else if (p.role === "CAPTAIN") {
    // Cota de malha com a faixa do bando de través e o broche
    const mail = ramp(0x6c737c);
    g.poly(shoulders, mail.base);
    for (let y = 24; y < 32; y += 2) for (let x = (y / 2) % 2; x < 32; x += 2) if (g.get(x, y) === mail.base) g.px(x, y, mail.dark);
    for (let k = 0; k < 9; k++) {
      g.rect(8 + k * 2, 23 + k, 3, 2, band.base);
      g.px(8 + k * 2, 23 + k, band.light);
    }
    g.oval(10, 25, 1, 1, GOLD.base);
    g.px(10, 25, GOLD.light);
  } else if (p.role === "LIEUTENANT") {
    // Gibão acolchoado, com o lenço do bando no pescoço
    const coat = ramp(0x7a5a3a);
    g.poly(shoulders, coat.base);
    for (let x = 3; x < 31; x += 4) g.line(x, 26, x, 31, coat.dark);
    g.line(0, 28, 31, 28, coat.dark);
    g.rect(11, 22, 11, 3, band.base);
    g.rect(11, 22, 11, 1, band.light);
    g.poly([[15, 24], [18, 24], [17, 28], [16, 28]], band.dark);
  } else {
    // O nobre: gibão na cor do reino, gola e botões de ouro; o rei com o manto de arminho
    g.poly(shoulders, band.base);
    g.poly([[2, 29], [8, 25], [8, 31], [1, 31]], band.dark);
    g.poly([[30, 29], [24, 25], [24, 31], [31, 31]], band.dark);
    if (p.crown === "CROWN") {
      g.poly([[6, 24], [26, 24], [31, 28], [31, 30], [0, 30], [0, 28]], WHITE);
      for (const [x, y] of [[4, 28], [9, 26], [14, 29], [19, 26], [24, 28], [28, 29]]) g.px(x, y, 0x2a2024);
    }
    g.rect(11, 22, 11, 2, GOLD.base);
    g.rect(11, 22, 11, 1, GOLD.light);
    for (const y of [26, 28, 30]) g.px(16, y, GOLD.light);
  }
}

/** Luz à esquerda e sombra à direita, linha por linha, numa área de uma cor só. */
function shade(g: Grid, color: number, r: Ramp, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== color) continue;
      if (min < 0) min = x;
      max = x;
    }
    if (max < 0) continue;
    g.px(max, y, r.dark);
    if (max - min > 3) g.px(min, y, r.light);
  }
}

function hairBack(g: Grid, style: HairStyle, h: Ramp): void {
  if (style === "LONG") {
    g.rect(8, 7, 17, 15, h.base);
    g.rect(8, 7, 1, 15, h.light);
    g.rect(24, 7, 1, 15, h.dark);
    g.rect(9, 22, 3, 2, h.dark);
    g.rect(21, 22, 3, 2, h.dark);
  }
}

function hairTop(g: Grid, style: HairStyle, h: Ramp, cloth: number): void {
  if (style === "WRAP") {
    const c = ramp(cloth);
    g.oval(16, 5, 8, 3, c.base);
    g.rect(8, 6, 17, 3, c.base);
    for (const x of [11, 15, 19]) g.line(x, 3, x + 2, 8, c.dark);
    g.rect(8, 9, 2, 5, c.dark);
    g.rect(23, 9, 2, 5, c.dark);
    g.px(12, 3, c.light);
    g.px(13, 3, c.light);
    return;
  }
  if (style === "BALD") {
    g.rect(9, 9, 2, 5, h.base);
    g.rect(22, 9, 2, 5, h.dark);
    return;
  }
  const top = style === "CROP" ? 6 : 7;
  g.rect(12, 3, 9, 1, h.base);
  g.rect(10, 4, 13, top - 4, h.base);
  g.rect(9, 5, 2, style === "CROP" ? 5 : 7, h.base);
  g.rect(22, 5, 2, style === "CROP" ? 5 : 7, h.dark);
  if (style !== "CROP") {
    // A franja, com a testa à mostra no meio
    g.rect(10, 7, 4, 1, h.base);
    g.rect(19, 7, 4, 1, h.dark);
  }
  g.px(12, 4, h.light);
  g.px(13, 4, h.light);
  g.px(14, 3, h.light);
  if (style === "BUN" || style === "TOPKNOT") {
    g.oval(16, 2, style === "BUN" ? 3 : 2, 2, h.base);
    g.px(15, 1, h.light);
  }
  if (style === "BRAID") {
    for (let y = 11; y < 25; y++) g.rect(8, y, 2, 1, y % 2 ? h.base : h.dark);
    g.px(8, 25, h.dark);
  }
}

function beardOf(g: Grid, beard: Beard, skin: Ramp, h: Ramp): void {
  if (beard === "NONE") return;
  if (beard === "MUSTACHE") {
    g.rect(13, 16, 7, 1, h.base);
    g.px(13, 17, h.dark);
    g.px(19, 17, h.dark);
    return;
  }
  const color = beard === "STUBBLE" ? mix(skin.base, h.base, 0.45) : h.base;
  const y0 = beard === "FULL" ? 14 : 15;
  for (let y = y0; y <= 20; y++) {
    for (let x = 9; x <= 23; x++) {
      const c = g.get(x, y);
      if (c !== skin.base && c !== skin.dark && c !== skin.light) continue;
      if (y >= 17 || x <= 11 || x >= 21) g.px(x, y, color);
    }
  }
  if (beard === "FULL") {
    g.rect(12, 20, 9, 2, h.base);
    g.rect(14, 22, 5, 1, h.dark);
    g.px(20, 20, h.dark);
  }
  if (beard !== "STUBBLE") g.rect(14, 16, 5, 1, h.base);
}

function scarsOf(g: Grid, n: number, skin: Ramp): void {
  const mark = mix(skin.base, SCAR, 0.6);
  if (n >= 1) for (const [x, y] of [[11, 14], [12, 15], [13, 16]]) g.px(x, y, mark);
  if (n >= 2) for (const [x, y] of [[20, 9], [20, 10], [21, 11]]) g.px(x, y, mark);
  if (n >= 3) for (const [x, y] of [[17, 16], [17, 17], [18, 18]]) g.px(x, y, mark);
  if (n >= 4) {
    // O tapa-olho, com a correia
    g.line(10, 8, 18, 11, 0x2a2020);
    g.rect(18, 11, 4, 3, 0x2a2020);
    g.px(19, 11, 0x4a3a34);
    g.line(22, 12, 23, 13, 0x2a2020);
  }
  if (n >= 5) for (const [x, y] of [[14, 8], [15, 8], [16, 9], [17, 9]]) g.px(x, y, mark);
}

function crownOf(g: Grid, crown: PortraitCrown | undefined): void {
  if (!crown) return;
  if (crown === "CROWN") {
    g.rect(10, 4, 13, 2, GOLD.base);
    g.rect(10, 4, 13, 1, GOLD.light);
    for (const x of [10, 13, 16, 19, 22]) g.rect(x, 2, 1, 2, GOLD.base);
    g.px(16, 5, 0xc8302a);
    g.px(12, 5, 0x3a6ac8);
    g.px(20, 5, 0x3a6ac8);
  } else {
    g.rect(10, 6, 13, 1, GOLD.base);
    g.px(16, 6, 0x3a8ac8);
  }
}

const cache = new Map<string, Bitmap>();

/** O retrato pronto, com o fundo e o contorno. */
export function portraitBitmap(p: PortraitSpec): Bitmap {
  const key = portraitKey(p);
  const hit = cache.get(key);
  if (hit) return hit;
  const t = portraitTraits(p);
  const skin = ramp(t.skin);
  const hair = ramp(agedHair(t.hair, p.age));
  const fig = new Grid(PORTRAIT_SIZE, PORTRAIT_SIZE);

  hairBack(fig, t.style, hair);
  // O pescoço, a roupa por cima dele e a cabeça
  fig.rect(13, 18, 7, 6, skin.base);
  fig.rect(18, 18, 2, 6, skin.dark);
  clothes(fig, p);
  fig.oval(16, 12, 6, 7, skin.base);
  if (!p.female) {
    // O queixo do homem é mais quadrado
    fig.rect(11, 17, 11, 1, skin.base);
    fig.rect(12, 18, 9, 1, skin.base);
    fig.rect(13, 19, 7, 1, skin.base);
  }
  fig.rect(9, 11, 1, 3, skin.base);
  fig.rect(23, 11, 1, 3, skin.dark);
  shade(fig, skin.base, skin, 5, 20);

  // Olhos, sobrancelhas, nariz e boca
  fig.px(12, 12, WHITE);
  fig.px(13, 12, t.eye);
  fig.px(19, 12, t.eye);
  fig.px(20, 12, WHITE);
  const brow = p.female ? hair.dark : mix(hair.dark, 0x000000, 0.2);
  fig.rect(p.female ? 12 : 11, 10, p.female ? 2 : 3, 1, brow);
  fig.rect(19, 10, p.female ? 2 : 3, 1, brow);
  if (p.female) {
    fig.px(12, 11, brow);
    fig.px(20, 11, brow);
  }
  fig.rect(17, 12, 1, 3, skin.dark);
  fig.px(15, 15, skin.dark);
  fig.px(16, 15, skin.dark);
  const lips = mix(skin.dark, 0xb04040, p.female ? 0.55 : 0.3);
  fig.rect(14, 17, 5, 1, lips);
  if (p.female) fig.px(16, 18, mix(lips, 0xffffff, 0.2));

  // A idade no rosto
  if (p.age >= 40) {
    fig.px(13, 16, skin.dark);
    fig.px(19, 16, skin.dark);
  }
  if (p.age >= 50) {
    fig.px(12, 13, skin.dark);
    fig.px(20, 13, skin.dark);
  }
  if (p.age >= 60) {
    fig.px(11, 15, skin.dark);
    fig.px(21, 15, skin.dark);
    fig.rect(14, 8, 5, 1, skin.dark);
  }

  beardOf(fig, t.beard, skin, hair);
  hairTop(fig, t.style, hair, t.cloth);
  scarsOf(fig, p.scars, skin);
  crownOf(fig, p.crown);
  fig.outline();

  // O fundo: a cor do papel (ou do reino), mais clara no meio
  const base = p.role === "NOBLE" ? mix(p.color, 0x101010, 0.62) : BACKDROP[p.role];
  const g = new Grid(PORTRAIT_SIZE, PORTRAIT_SIZE);
  g.rect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, mix(base, 0x000000, 0.25));
  g.oval(16, 14, 14, 14, base);
  g.oval(16, 13, 9, 9, mix(base, 0xffffff, 0.08));
  g.stamp(fig, 0, 0);
  const bm = gridBitmap(g);
  cache.set(key, bm);
  return bm;
}

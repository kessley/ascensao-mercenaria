import { CLEAR, Grid, gridBitmap, ramp, type Bitmap } from "./pixel";
import { DIRS, type Dir } from "./figures";

/**
 * Barcaças dos rios e navios da costa (G4). Vistos de cima e um pouco de lado, como tudo no
 * mapa: o convés é o contorno do casco achatado, e o costado é esse contorno puxado para baixo
 * até a linha d'água. Três direções (de frente, de lado e de costas; o oeste é o leste
 * espelhado), com a vela aberta ou recolhida (a tempestade prende o navio no porto) e dois
 * quadros da espuma na linha d'água.
 */

export type ShipKind = "BARGE" | "SHIP";

interface Mast {
  /** Posição ao longo do casco (+ = proa). */
  at: number;
  h: number;
  /** Largura e altura da vela. */
  sw: number;
  sh: number;
}

interface Spec {
  /** Célula e o centro do convés nela. */
  cell: { w: number; h: number; cx: number; base: number };
  len: number;
  beam: number;
  /** Altura do costado (convés até a água). */
  side: number;
  masts: Mast[];
  /** Comprimento do castelo de popa (0 = sem). */
  castle: number;
  /** Comprimento do gurupés (0 = sem). */
  sprit: number;
  cargo: boolean;
  /** Faixa na vela e flâmula no mastro grande. */
  colors: boolean;
}

const SPECS: Record<ShipKind, Spec> = {
  BARGE: {
    cell: { w: 48, h: 40, cx: 24, base: 22 },
    len: 40,
    beam: 14,
    side: 4,
    masts: [{ at: 0, h: 20, sw: 14, sh: 11 }],
    castle: 0,
    sprit: 0,
    cargo: true,
    colors: false,
  },
  SHIP: {
    cell: { w: 84, h: 68, cx: 42, base: 40 },
    len: 62,
    beam: 20,
    side: 7,
    masts: [
      { at: 12, h: 29, sw: 20, sh: 15 },
      { at: -7, h: 35, sw: 24, sh: 19 },
    ],
    castle: 11,
    sprit: 9,
    cargo: false,
    colors: true,
  },
};

/** Quadros por direção: vela aberta (2 da espuma) e recolhida (2). */
export const SHIP_FRAMES = 4;

/**
 * Célula de um barco e o ponto dele na água (o meio do casco, na linha d'água). O meio da
 * célula na largura: o Phaser espelha em volta do meio da textura.
 */
export function shipCell(kind: ShipKind): { w: number; h: number; cx: number; cy: number } {
  const s = SPECS[kind];
  return { w: s.cell.w, h: s.cell.h, cx: s.cell.cx, cy: s.cell.base + s.side };
}

/** O convés achatado pela vista do alto e de lado. */
const TILT = 0.5;

const HULL = ramp(0x5e3d24);
const RAIL = 0x7a5434;
const DECK = 0xa07a4c;
const DECK_HIGH = 0xb08a58;
const PLANK = 0x8a6640;
const MAST = 0x4a3220;
const SAIL = 0xeee6d4;
const SAIL_SHADE = 0xcdc2aa;
const STRIPE = 0xa8483a;
const FURL = 0x9a948a;
const FURL_DARK = 0x6e6a62;
const CRATE = ramp(0x8a6a3a);
const FOAM = 0xe2eff1;

type P = readonly [number, number];

/** Meia boca do casco em cada ponto do comprimento: popa quase reta, proa em ponta. */
function halfBeam(s: Spec, a: number): number {
  const L = s.len / 2;
  const B = s.beam / 2;
  const bow = L - s.len * 0.34;
  if (a > bow) {
    const t = Math.min(1, (a - bow) / (L - bow));
    return B * (1 - t * t);
  }
  if (a < -L + 3) return B * (0.82 + 0.18 * ((a + L) / 3));
  return B;
}

/** Contorno do casco (comprimento × boca) entre dois pontos, encolhido de `shrink` px. */
function hullPts(s: Spec, from: number, to: number, shrink = 0): P[] {
  const top: P[] = [];
  const bot: P[] = [];
  for (let a = from; ; a = Math.min(to, a + 2)) {
    const w = Math.max(0, halfBeam(s, a) - shrink);
    top.push([a, -w]);
    bot.push([a, w]);
    if (a >= to) break;
  }
  return [...top, ...bot.reverse()];
}

/** Do casco para a tela: `up` sobe (mastros, castelo). De lado, a boca encolhe; de frente, o comprimento. */
function projOf(s: Spec, dir: Dir): (a: number, c: number, up?: number) => P {
  const { cx, base } = s.cell;
  if (dir === "E") return (a, c, up = 0) => [cx + a, base + c * TILT - up];
  const k = dir === "S" ? 1 : -1;
  return (a, c, up = 0) => [cx + c, base + k * a * TILT - up];
}

const down = (pts: readonly P[], k: number): P[] => pts.map(([x, y]) => [x, y + k]);
const r = Math.round;

function trace(g: Grid, pts: readonly P[], c: number): void {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    g.line(r(ax), r(ay), r(bx), r(by), c);
  }
}

/** Pinta só por cima de uma cor (as tábuas no convés, a faixa na vela). */
function over(g: Grid, x: number, y: number, only: number, c: number): void {
  if (g.get(x, y) === only) g.px(x, y, c);
}

function sail(g: Grid, s: Spec, dir: Dir, m: Mast, mx: number, top: number, furled: boolean): void {
  const yard = top + 2;
  const half = m.sw / 2;
  if (dir === "E") {
    // De lado, a verga vai atravessada (braceada) e a vela enfuna para a proa
    const dx = r(half * 0.55);
    const dy = r(half * 0.8 * TILT);
    const far: P = [mx - dx, yard - dy];
    const near: P = [mx + dx, yard + dy];
    if (furled) {
      g.line(far[0], far[1] + 1, near[0], near[1] + 1, FURL);
      g.line(far[0], far[1] + 2, near[0], near[1] + 2, FURL_DARK);
    } else {
      g.poly([far, near, [near[0] + 2, near[1] + m.sh], [far[0] + 2, far[1] + m.sh]], SAIL);
      g.poly([far, [mx, yard], [mx + 2, yard + m.sh], [far[0] + 2, far[1] + m.sh]], SAIL_SHADE);
      if (s.colors) for (let x = far[0]; x <= near[0] + 2; x++) for (const y of [0, 1]) over(g, x, r(yard + m.sh * 0.45 + ((x - mx) * dy) / Math.max(1, dx)) + y, SAIL, STRIPE);
    }
    g.line(far[0], far[1], near[0], near[1], MAST);
    return;
  }
  const x0 = mx - half;
  const x1 = mx + half;
  if (furled) {
    g.rect(r(x0), yard + 1, m.sw, 2, FURL);
    g.rect(r(x0), yard + 2, m.sw, 1, FURL_DARK);
  } else {
    // De frente, a vela enfuna para quem olha; de costas, vê-se o avesso, na sombra
    const front = dir === "S";
    const belly = front ? 2 : -1;
    g.poly([[x0, yard], [x1, yard], [x1, yard + m.sh], [mx, yard + m.sh + belly], [x0, yard + m.sh]], front ? SAIL : SAIL_SHADE);
    if (front) g.poly([[mx + half / 2, yard], [x1, yard], [x1, yard + m.sh], [mx + half / 2, yard + m.sh + 1]], SAIL_SHADE);
    else g.poly([[x0, yard], [mx - half / 2, yard], [mx - half / 2, yard + m.sh], [x0, yard + m.sh]], SAIL);
    if (s.colors) {
      const y = r(yard + m.sh * 0.45);
      for (let x = r(x0); x <= r(x1); x++) for (const c of [SAIL, SAIL_SHADE]) for (const k of [0, 1]) over(g, x, y + k, c, STRIPE);
    }
  }
  g.line(r(x0) - 1, yard, r(x1) + 1, yard, MAST);
}

function drawShip(g: Grid, s: Spec, dir: Dir, furled: boolean): void {
  const pr = projOf(s, dir);
  const L = s.len / 2;
  const onScreen = (pts: readonly P[]) => pts.map(([a, c]) => pr(a, c));
  const hull = onScreen(hullPts(s, -L, L));

  // O costado: o contorno puxado até a água, com a cinta e a linha d'água
  for (let k = s.side; k >= 1; k--) g.poly(down(hull, k), HULL.base);
  trace(g, down(hull, s.side), HULL.dark);
  trace(g, down(hull, Math.ceil(s.side / 2)), HULL.light);

  // O convés, com a borda e as tábuas
  g.poly(hull, RAIL);
  const deck = onScreen(hullPts(s, -L + 1, L - 2, 1));
  g.poly(deck, DECK);
  const { cx, base } = s.cell;
  if (dir === "E") for (let x = cx - L; x <= cx + L; x++) over(g, x, base, DECK, PLANK);
  else for (const c of [-s.beam / 4, s.beam / 4]) for (let y = base - L; y <= base + L; y++) over(g, r(cx + c), y, DECK, PLANK);

  // O castelo de popa: um pedaço do convés erguido
  if (s.castle > 0) {
    const H = 4;
    const part = onScreen(hullPts(s, -L, -L + s.castle));
    for (let k = 0; k < H; k++) g.poly(down(part, -k), HULL.base);
    g.poly(down(part, -H), RAIL);
    g.poly(down(onScreen(hullPts(s, -L + 1, -L + s.castle - 1, 1)), -H), DECK_HIGH);
  }

  // A carga da barcaça: caixotes e um barril
  if (s.cargo) {
    for (const [a, c] of [[-11, -2], [-5, 2], [8, 0]] as const) {
      const [x, y] = pr(a, c).map(r);
      g.rect(x - 2, y - 3, 5, 4, CRATE.base);
      g.rect(x - 2, y - 3, 5, 1, CRATE.light);
      g.rect(x + 2, y - 2, 1, 3, CRATE.dark);
    }
  }

  // O gurupés, para a frente e para cima
  if (s.sprit > 0) {
    const [ax, ay] = pr(L - 2, 0, 1);
    const [bx, by] = pr(L + s.sprit, 0, 5);
    g.line(r(ax), r(ay), r(bx), r(by), MAST);
  }

  // Mastros e velas, do mais longe ao mais perto
  const masts = s.masts.map((m) => ({ m, at: pr(m.at, 0) })).sort((p, q) => p.at[1] - q.at[1]);
  const tallest = Math.max(...s.masts.map((m) => m.h));
  for (const { m, at } of masts) {
    const [mx, my] = at.map(r);
    const top = my - m.h;
    const pole = () => g.rect(mx, top, 1, my - top, MAST);
    // De frente, a vela cobre o mastro; de costas, o mastro fica na frente dela
    if (dir === "N") {
      sail(g, s, dir, m, mx, top, furled);
      pole();
    } else {
      pole();
      sail(g, s, dir, m, mx, top, furled);
    }
    if (s.colors && m.h === tallest) {
      const toward = dir === "E" ? -1 : 1;
      for (let i = 1; i <= 5; i++) g.rect(mx + toward * i, top + (i === 5 ? 1 : 0), 1, i === 5 ? 1 : 2, STRIPE);
    }
  }
}

function frameGrid(kind: ShipKind, dir: Dir, furled: boolean, foam: number): Grid {
  const s = SPECS[kind];
  const g = new Grid(s.cell.w, s.cell.h);
  drawShip(g, s, dir, furled);
  g.outline();
  // A espuma na linha d'água, embaixo do contorno do casco
  const mask = new Grid(s.cell.w, s.cell.h);
  const pr = projOf(s, dir);
  mask.poly(down(hullPts(s, -s.len / 2, s.len / 2).map(([a, c]) => pr(a, c)), s.side), 1);
  for (let x = 0; x < s.cell.w; x++) {
    let low = -1;
    for (let y = 0; y < s.cell.h; y++) if (mask.get(x, y) !== CLEAR) low = y;
    if (low >= 0 && (x + foam * 2) % 4 < 2) g.px(x, low + 2, FOAM);
  }
  return g;
}

/** Folha de um barco: linhas = direções, colunas = vela aberta (2 quadros) e recolhida (2). */
export function shipSheet(kind: ShipKind): Bitmap {
  const { w, h } = SPECS[kind].cell;
  const sheet = new Grid(w * SHIP_FRAMES, h * DIRS.length);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < SHIP_FRAMES; f++) sheet.stamp(frameGrid(kind, dir, f >= 2, f % 2), f * w, row * h);
  });
  return gridBitmap(sheet);
}

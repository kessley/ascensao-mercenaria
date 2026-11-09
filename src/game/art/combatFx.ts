import { Grid, gridBitmap, type Bitmap } from "./pixel";

/**
 * Os efeitos de combate em pixel art (G6, parte 3), feitos por código: flechas, virotes e dardos
 * em 16 direções e fincados no chão; a poeira da cavalaria; as gotas de sangue (e as lascas de osso,
 * de madeira e as faíscas do aço); as manchas no chão; e o golpe em meia-lua do Comandante.
 * Tudo numa folha só de células de 16 px, para cada camada ser um `Blitter` só. O golpe tem folha
 * própria, maior.
 */

export const FX_CELL = 16;
const COLS = 21;

export type MissileKind = "ARROW" | "BOLT" | "JAVELIN";
export const MISSILES: readonly MissileKind[] = ["ARROW", "BOLT", "JAVELIN"];
/** Direções do projétil em voo (0 = leste, crescendo no sentido do relógio, como o ângulo da tela). */
export const MISSILE_DIRS = 16;
/** Projéteis fincados: inclinado para a esquerda (2) e para a direita (2). */
export const STUCK_VARIANTS = 4;

/** Poeira de terra, de lama, borrifo de neve e (G6, parte 4) fumaça: da chama apagada e do fogo. */
export type DustKind = "DRY" | "MUD" | "SNOW" | "SMOKE";
export const DUSTS: readonly DustKind[] = ["DRY", "MUD", "SNOW", "SMOKE"];
export const PUFF_FRAMES = 5;

export type Matter = "BLOOD" | "BONE" | "WOOD" | "SPARK";
export const MATTERS: readonly Matter[] = ["BLOOD", "BONE", "WOOD", "SPARK"];
/** Manchas por matéria: o sangue tem 4 respingos e 2 poças; osso e madeira, 2 de cada; faísca não mancha. */
export const STAINS: Record<Matter, number> = { BLOOD: 6, BONE: 2, WOOD: 2, SPARK: 0 };
const STAIN_AT: Record<Matter, number> = { BLOOD: 0, BONE: 6, WOOD: 8, SPARK: 10 };

const ROW = { MISSILE: 0, PUFF: 3, CHIP: 7, STAIN: 8 } as const;
export const FX_ROWS = 9;

export function missileFrame(kind: MissileKind, dir: number): number {
  const d = ((Math.round(dir) % MISSILE_DIRS) + MISSILE_DIRS) % MISSILE_DIRS;
  return (ROW.MISSILE + MISSILES.indexOf(kind)) * COLS + d;
}

/** A direção (0 a 15) de um ângulo da tela. */
export function missileDir(angle: number): number {
  return ((Math.round((angle / (Math.PI * 2)) * MISSILE_DIRS) % MISSILE_DIRS) + MISSILE_DIRS) % MISSILE_DIRS;
}

/** O projétil fincado; `fromLeft` = ele veio voando da esquerda (o rabo aponta para lá). */
export function stuckFrame(kind: MissileKind, fromLeft: boolean, steep: boolean): number {
  return (ROW.MISSILE + MISSILES.indexOf(kind)) * COLS + MISSILE_DIRS + (fromLeft ? 0 : 2) + (steep ? 0 : 1);
}

/** A sombra do projétil no chão. */
export const SHADOW_FRAME = ROW.MISSILE * COLS + MISSILE_DIRS + STUCK_VARIANTS;

export function puffFrame(kind: DustKind, f: number): number {
  return (ROW.PUFF + DUSTS.indexOf(kind)) * COLS + Math.max(0, Math.min(PUFF_FRAMES - 1, f));
}

/** A gota (ou lasca, ou faísca) em voo: 0 miúda, 1 maior. */
export function chipFrame(m: Matter, size: 0 | 1): number {
  return ROW.CHIP * COLS + MATTERS.indexOf(m) * 2 + size;
}

/** A mancha no chão: `v` de 0 a STAINS[m] − 1 (no sangue, 4 e 5 são as poças de quem caiu). */
export function stainFrame(m: Matter, v: number): number {
  return ROW.STAIN * COLS + STAIN_AT[m] + Math.max(0, Math.min(STAINS[m] - 1, v));
}

// --- Projéteis ---

interface MissileLook {
  len: number;
  shaft: number;
  head: number;
  headLen: number;
  fletch: number | null;
}

const MISSILE_LOOK: Record<MissileKind, MissileLook> = {
  // Flecha: haste clara (lê no chão escuro e à noite), ponta de aço e penas brancas
  // (a ponta é aço escuro, para não se confundir com a haste)
  ARROW: { len: 10, shaft: 0xd9c49a, head: 0x8a95a3, headLen: 2, fletch: 0xf4efe2 },
  // Virote: curto e grosso, ponta quadrada
  BOLT: { len: 7, shaft: 0x9a7448, head: 0x8a95a3, headLen: 2, fletch: 0xc9c2b0 },
  // Dardo: comprido, sem penas, ponta longa
  JAVELIN: { len: 13, shaft: 0xb08c58, head: 0x9aa4b2, headLen: 3, fletch: null },
};

/** A linha do projétil de `a` (ponta) para trás, em pixels sem buraco, do rabo para a ponta. */
function line(cx: number, cy: number, angle: number, len: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let s = -(len - 1) / 2; s <= (len - 1) / 2 + 1e-6; s += 0.25) {
    const x = Math.round(cx + dx * s);
    const y = Math.round(cy + dy * s);
    const last = out[out.length - 1];
    if (!last || last.x !== x || last.y !== y) out.push({ x, y });
  }
  return thin(out);
}

/** Tira os cantos em L da linha: cada pixel toca o vizinho só pela quina ou pelo lado, nunca pelos dois. */
function thin(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const out = [...pts];
  for (let i = 1; i < out.length - 1; i++) {
    const a = out[i - 1];
    const c = out[i + 1];
    if (Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1) {
      out.splice(i, 1);
      i--;
    }
  }
  return out;
}

function drawMissile(g: Grid, ox: number, oy: number, kind: MissileKind, angle: number): void {
  const m = MISSILE_LOOK[kind];
  const pts = line(ox + FX_CELL / 2, oy + FX_CELL / 2, angle, m.len);
  pts.forEach((p, i) => g.px(p.x, p.y, i >= pts.length - m.headLen ? m.head : m.shaft));
  if (kind === "BOLT") {
    // O virote é grosso: dobra a haste para o lado de baixo da linha
    const nx = Math.round(-Math.sin(angle));
    const ny = Math.round(Math.cos(angle));
    for (const p of pts.slice(1, -1)) if (g.get(p.x + nx, p.y + ny) < 0) g.px(p.x + nx, p.y + ny, m.shaft);
  }
  if (m.fletch !== null) {
    // As penas: um pixel de cada lado, um passo atrás do rabo. Com o rabo, fazem um ">" que aponta
    // para a ponta (penas no mesmo passo do rabo fariam um "<", e a flecha pareceria voar para trás)
    const px = -Math.sin(angle);
    const py = Math.cos(angle);
    const tail = pts[0];
    const bx = tail.x - Math.cos(angle);
    const by = tail.y - Math.sin(angle);
    for (const side of [-1, 1]) g.px(Math.round(bx + px * side), Math.round(by + py * side), m.fletch);
  }
}

/** Fincado: a ponta enterrada, o rabo para cima e para o lado de onde veio, e o chão revolvido no pé. */
function drawStuck(g: Grid, ox: number, oy: number, kind: MissileKind, fromLeft: boolean, steep: boolean): void {
  const m = MISSILE_LOOK[kind];
  const lean = (steep ? 0.35 : 0.75) * (fromLeft ? 1 : -1);
  // Ângulo de quem desce: do rabo (em cima) para a ponta (no chão)
  const angle = Math.PI / 2 - lean;
  const shown = Math.max(4, Math.round(m.len * 0.6));
  const foot = { x: ox + FX_CELL / 2, y: oy + 12 };
  const pts: { x: number; y: number }[] = [];
  for (let s = 0; s < shown; s += 0.25) {
    const x = Math.round(foot.x - Math.cos(angle) * s);
    const y = Math.round(foot.y - Math.sin(angle) * s);
    const last = pts[pts.length - 1];
    if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
  }
  const shaft = thin(pts);
  for (const p of shaft) g.px(p.x, p.y, m.shaft);
  const top = shaft[shaft.length - 1];
  if (m.fletch !== null) {
    g.px(top.x - 1, top.y, m.fletch);
    g.px(top.x + 1, top.y, m.fletch);
    g.px(top.x, top.y - 1, m.fletch);
  }
  // O chão revolvido onde a ponta entrou
  g.px(foot.x - 1, foot.y + 1, 0x3b2e22);
  g.px(foot.x + 1, foot.y + 1, 0x3b2e22);
  g.px(foot.x, foot.y + 1, 0x2c2219);
}

// --- Poeira ---

const DUST_COLORS: Record<DustKind, readonly [number, number, number]> = {
  DRY: [0xd8c69c, 0xb39e76, 0x8c7856],
  MUD: [0x8f7a5c, 0x6f5c44, 0x53442f],
  SNOW: [0xffffff, 0xe6edf5, 0xc5d3e1],
  SMOKE: [0x9a9894, 0x74716d, 0x524f4c],
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Uma nuvenzinha de poeira: três bolhas que crescem e se desfazem em pontilhado. */
function drawPuff(g: Grid, ox: number, oy: number, kind: DustKind, f: number): void {
  const [light, mid, dark] = DUST_COLORS[kind];
  const grow = 2.2 + f * 1.25;
  const blobs = [
    { x: 0, y: 0.6, r: grow },
    { x: -grow * 0.55, y: 1, r: grow * 0.72 },
    { x: grow * 0.6, y: 0.9, r: grow * 0.66 },
  ];
  // Some aos poucos: cada quadro deixa mais pixels de fora (o pontilhado de Bayer)
  const keep = 1 - f / (PUFF_FRAMES + 1);
  for (let y = 0; y < FX_CELL; y++) {
    for (let x = 0; x < FX_CELL; x++) {
      const dx = x + 0.5 - FX_CELL / 2;
      const dy = y + 0.5 - FX_CELL / 2 - 1;
      let inside = -1;
      for (const b of blobs) inside = Math.max(inside, 1 - Math.hypot(dx - b.x, dy - b.y) / b.r);
      if (inside <= 0) continue;
      // (o miolo segura mais; a beira se desfaz primeiro)
      if (BAYER[(y % 4) * 4 + (x % 4)] / 16 >= keep + inside * 1.1 - 0.1) continue;
      // Luz de cima e da esquerda; a beira de baixo mais escura
      const shade = -dy / grow + inside * 0.8 - (dx > 0 ? 0.15 : 0);
      g.px(ox + x, oy + y, shade > 0.55 ? light : shade > -0.2 ? mid : dark);
    }
  }
}

// --- Gotas, lascas e manchas ---

const MATTER_COLORS: Record<Matter, readonly [number, number, number]> = {
  BLOOD: [0xb52a20, 0x8a1812, 0x5c0e0b],
  BONE: [0xeee8d6, 0xc8c0aa, 0x968e7a],
  WOOD: [0xb08a52, 0x86663a, 0x5e4526],
  SPARK: [0xfffbe0, 0xffd860, 0xf09a28],
};

function drawChip(g: Grid, ox: number, oy: number, m: Matter, size: 0 | 1): void {
  const [light, mid] = MATTER_COLORS[m];
  const cx = ox + FX_CELL / 2;
  const cy = oy + FX_CELL / 2;
  if (size === 0) {
    g.px(cx, cy, m === "SPARK" ? light : mid);
    return;
  }
  g.px(cx, cy, light);
  g.px(cx, cy + 1, mid);
  if (m === "SPARK") {
    g.px(cx - 1, cy, mid);
    g.px(cx + 1, cy, mid);
  }
}

function drawStain(g: Grid, ox: number, oy: number, m: Matter, v: number): void {
  const [light, mid, dark] = MATTER_COLORS[m];
  const cx = ox + FX_CELL / 2;
  const cy = oy + 10;
  const dots = (list: readonly (readonly [number, number, number])[]) => {
    for (const [dx, dy, c] of list) g.px(cx + dx, cy + dy, c);
  };
  if (m === "BLOOD") {
    if (v === 0) dots([[0, 0, mid], [1, 0, dark], [0, 1, dark]]);
    else if (v === 1) dots([[0, 0, mid], [-1, 0, dark], [1, 0, mid], [0, -1, dark], [0, 1, dark], [3, -1, mid]]);
    else if (v === 2) dots([[0, 0, mid], [1, 0, mid], [-2, 1, dark], [3, 1, dark], [1, -2, mid]]);
    else if (v === 3) dots([[-2, 0, dark], [-1, 0, mid], [0, 0, mid], [1, 0, mid], [2, 1, dark], [-1, 1, dark], [4, 0, mid]]);
    else {
      // A poça de quem caiu: um oval escuro, com o miolo mais claro e um respingo do lado
      const rx = v === 4 ? 5 : 6;
      const ry = v === 4 ? 2 : 3;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const d = (x * x) / ((rx + 0.4) * (rx + 0.4)) + (y * y) / ((ry + 0.4) * (ry + 0.4));
          if (d > 1) continue;
          g.px(cx + x, cy + y - 1, d < 0.35 ? mid : dark);
        }
      }
      g.px(cx - 1, cy - 2 - (ry > 2 ? 1 : 0), light);
      dots([[rx + 1, 1, dark], [-rx - 1, -1, dark]]);
    }
    return;
  }
  if (m === "BONE") {
    if (v === 0) dots([[0, 0, light], [1, 0, mid], [-2, 1, mid]]);
    else dots([[0, 0, light], [1, 0, mid], [-2, 1, light], [-1, 1, mid], [2, -1, dark], [3, 1, mid]]);
    return;
  }
  if (m === "WOOD") {
    if (v === 0) dots([[0, 0, mid], [1, 0, dark], [-2, 1, light], [-1, 1, mid]]);
    else dots([[0, 0, mid], [1, -1, light], [2, -1, mid], [-2, 1, dark], [-3, 1, mid], [1, 1, dark]]);
  }
}

/** A folha dos efeitos: projéteis, poeira, gotas e manchas, em células de 16 px. */
export function fxSheet(): Bitmap {
  const g = new Grid(COLS * FX_CELL, FX_ROWS * FX_CELL);
  MISSILES.forEach((kind, k) => {
    const oy = (ROW.MISSILE + k) * FX_CELL;
    for (let d = 0; d < MISSILE_DIRS; d++) drawMissile(g, d * FX_CELL, oy, kind, (d / MISSILE_DIRS) * Math.PI * 2);
    for (let v = 0; v < STUCK_VARIANTS; v++) drawStuck(g, (MISSILE_DIRS + v) * FX_CELL, oy, kind, v < 2, v % 2 === 0);
  });
  // A sombra: um traço escuro (a camada põe a transparência)
  const sx = (SHADOW_FRAME % COLS) * FX_CELL + FX_CELL / 2;
  const sy = Math.floor(SHADOW_FRAME / COLS) * FX_CELL + FX_CELL / 2;
  for (let x = -1; x <= 1; x++) g.px(sx + x, sy, 0x15110d);
  DUSTS.forEach((kind, k) => {
    for (let f = 0; f < PUFF_FRAMES; f++) drawPuff(g, f * FX_CELL, (ROW.PUFF + k) * FX_CELL, kind, f);
  });
  MATTERS.forEach((m, i) => {
    for (const size of [0, 1] as const) drawChip(g, (i * 2 + size) * FX_CELL, ROW.CHIP * FX_CELL, m, size);
    for (let v = 0; v < STAINS[m]; v++) drawStain(g, (STAIN_AT[m] + v) * FX_CELL, ROW.STAIN * FX_CELL, m, v);
  });
  return gridBitmap(g);
}

// --- O golpe em meia-lua ---

export const SLASH_CELL = 128;
export const SLASH_DIRS = 16;
export const SLASH_FRAMES = 3;
/** O raio do golpe na folha (o alcance do Comandante e a beira do corpo). */
export const SLASH_RADIUS = 54;

export function slashFrame(dir: number, f: number): number {
  return (((dir % SLASH_DIRS) + SLASH_DIRS) % SLASH_DIRS) * SLASH_FRAMES + Math.max(0, Math.min(SLASH_FRAMES - 1, f));
}

const SLASH_CORE = 0xffffff;
const SLASH_MID = 0xfff3c4;
const SLASH_EDGE = 0xd9c58a;

/**
 * O rastro da lâmina: a meia-lua cresce do começo do golpe até a ponta (onde ela está agora, mais
 * grossa) e, no último quadro, só o fim do rastro, se desfazendo. `arc` é a metade da abertura.
 */
function drawSlash(g: Grid, ox: number, oy: number, facing: number, arc: number, f: number): void {
  const lead = [0.5, 1, 1][f];
  const tail = [0, 0.12, 0.55][f];
  const maxW = [6, 9, 5][f];
  const c = SLASH_CELL / 2;
  for (let y = 0; y < SLASH_CELL; y++) {
    for (let x = 0; x < SLASH_CELL; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > SLASH_RADIUS + 0.5 || r < SLASH_RADIUS - maxW - 1) continue;
      let th = Math.atan2(dy, dx) - facing;
      th = Math.atan2(Math.sin(th), Math.cos(th));
      if (Math.abs(th) > arc) continue;
      const t = (th + arc) / (2 * arc);
      if (t < tail || t > lead) continue;
      const s = (t - tail) / Math.max(1e-6, lead - tail);
      // Grosso na lâmina, fino no rastro; a ponta da lâmina arredondada
      const w = maxW * Math.pow(s, 0.8) * Math.min(1, (lead - t) * 14 + 0.45);
      const depth = SLASH_RADIUS - r;
      if (depth < -0.5 || depth > w) continue;
      if (f === 2 && BAYER[(y % 4) * 4 + (x % 4)] / 16 > 0.55) continue;
      const k = depth / Math.max(1, w);
      g.px(ox + x, oy + y, f === 2 ? (k < 0.4 ? SLASH_MID : SLASH_EDGE) : k < 0.25 ? SLASH_MID : k < 0.7 ? SLASH_CORE : SLASH_EDGE);
    }
  }
}

/** A folha do golpe: 16 direções em linhas, 3 quadros cada. */
export function slashSheet(arc: number): Bitmap {
  const g = new Grid(SLASH_FRAMES * SLASH_CELL, SLASH_DIRS * SLASH_CELL);
  for (let d = 0; d < SLASH_DIRS; d++) {
    for (let f = 0; f < SLASH_FRAMES; f++) drawSlash(g, f * SLASH_CELL, d * SLASH_CELL, (d / SLASH_DIRS) * Math.PI * 2, arc, f);
  }
  return gridBitmap(g);
}

/** Os pixels acesos de uma célula de 16 px da folha dos efeitos (para os testes). */
export function cellPixels(b: Bitmap, frame: number): { x: number; y: number; c: number }[] {
  const ox = (frame % COLS) * FX_CELL;
  const oy = Math.floor(frame / COLS) * FX_CELL;
  const out: { x: number; y: number; c: number }[] = [];
  for (let y = 0; y < FX_CELL; y++) {
    for (let x = 0; x < FX_CELL; x++) {
      const i = ((oy + y) * b.width + ox + x) * 4;
      if (b.rgba[i + 3]) out.push({ x, y, c: (b.rgba[i] << 16) | (b.rgba[i + 1] << 8) | b.rgba[i + 2] });
    }
  }
  return out;
}

export const FX_COLS = COLS;

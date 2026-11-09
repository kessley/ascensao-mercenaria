import { CLEAR, Grid, OUTLINE, ramp, seeded, type Ramp } from "./pixel";
import { M, SH, dropShadow, speckle, stoneFace, tone, type Piece } from "./buildings";
import type { FurnitureKind, InteriorStyle } from "../data/interiors";

/**
 * O lado de dentro das construções em pixel art (G4): o chão e as paredes de cada estilo de sala
 * (tenda, madeira, pedra, templo) e os móveis, desenhados no tamanho de cada um. Vista 3/4 como
 * a do mundo: a parede do fundo aparece de frente, as outras só por cima, e o que é alto sobe
 * acima do próprio pé.
 */

/** Espessura das paredes (a mesma das paredes sólidas da cena). */
export const ROOM_WALL = 22;
/** Altura da parede do fundo, vista de frente: sobe acima do chão da sala. */
export const BACK_FACE = 40;
/** Meia largura do vão da porta, no meio da parede de baixo. */
export const DOOR_HALF = 34;

const ROOM: Record<InteriorStyle, { floor: number; face: number; cap: number }> = {
  TENT: { floor: 0x9a8058, face: 0xd2c29a, cap: 0xb09c72 },
  WOOD: { floor: 0x8a6a45, face: 0x6a4a2c, cap: 0x4a321c },
  STONE: { floor: 0x86807a, face: 0x7a746a, cap: 0x58534c },
  TEMPLE: { floor: 0xd9d2bf, face: 0xcfc7b0, cap: 0xa29a84 },
};

const STRAW = ramp(0xd0b060);
const LINEN = 0xe8e0d0;
const GOLD = ramp(0xe0b040);
const IRON = ramp(0x5a5c62);
const WOOD = ramp(0x7a5432);
const FLAME = 0xf4c24a;
const EMBER = 0xe67e22;

/** Escurece (f < 0) ou clareia o que já está desenhado num retângulo. */
function shade(g: Grid, x: number, y: number, w: number, h: number, f: number): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const c = g.get(i, j);
      if (c >= 0) g.px(i, j, tone(c, f));
    }
  }
}

// --- A sala ---

function floorFill(g: Grid, style: InteriorStyle, x: number, y: number, w: number, h: number, color: number, rnd: () => number): void {
  switch (style) {
    case "WOOD": {
      // Tábuas compridas em fiadas de 8 px, com as juntas desencontradas e os pregos nas pontas
      for (let row = 0; row * 8 < h; row++) {
        const ry = y + row * 8;
        let bx = x - Math.floor(rnd() * 60);
        while (bx < x + w) {
          const len = 40 + Math.floor(rnd() * 64);
          const c = tone(color, rnd() * 0.14 - 0.07);
          const x0 = Math.max(x, bx);
          const x1 = Math.min(x + w, bx + len);
          g.rect(x0, ry, x1 - x0, Math.min(7, y + h - ry), c);
          g.rect(x0, ry, x1 - x0, 1, tone(c, 0.08));
          if (bx + len < x + w) g.rect(bx + len - 1, ry, 1, 7, tone(color, -0.3));
          if (bx + 3 >= x) g.px(bx + 3, ry + 3, tone(color, -0.35));
          if (bx + len - 4 < x + w) g.px(bx + len - 4, ry + 3, tone(color, -0.35));
          bx += len;
        }
        if (ry + 7 < y + h) g.rect(x, ry + 7, w, 1, tone(color, -0.3));
      }
      speckle(g, x, y, w, h, color, 0.02, rnd);
      return;
    }
    case "STONE": {
      // Lajes de tamanhos variados, em fiadas, com a argamassa escura
      for (let row = 0; row * 14 < h; row++) {
        const ry = y + row * 14;
        let bx = x - Math.floor(rnd() * 20);
        while (bx < x + w) {
          const len = 16 + Math.floor(rnd() * 16);
          const c = tone(color, rnd() * 0.14 - 0.07);
          const x0 = Math.max(x, bx);
          const x1 = Math.min(x + w, bx + len);
          g.rect(x0, ry, x1 - x0, Math.min(13, y + h - ry), c);
          g.rect(x0, ry, x1 - x0, 1, tone(c, 0.1));
          if (bx + len < x + w) g.rect(bx + len - 1, ry, 1, 13, tone(color, -0.25));
          // Uma rachadura de vez em quando
          if (rnd() < 0.12) g.line(x0 + 3, ry + 3, Math.min(x1 - 2, x0 + 9), ry + 9, tone(c, -0.18));
          bx += len;
        }
        if (ry + 13 < y + h) g.rect(x, ry + 13, w, 1, tone(color, -0.25));
      }
      speckle(g, x, y, w, h, color, 0.04, rnd);
      return;
    }
    case "TEMPLE": {
      // Mármore em xadrez, com os veios claros e a junta fina
      const dark = tone(color, -0.08);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const tile = (Math.floor(i / 16) + Math.floor(j / 16)) % 2;
          const grout = i % 16 === 15 || j % 16 === 15;
          g.px(x + i, y + j, grout ? tone(color, -0.18) : tile ? dark : color);
        }
      }
      for (let k = 0; k < (w * h) / 900; k++) {
        const vx = x + Math.floor(rnd() * w);
        const vy = y + Math.floor(rnd() * h);
        const len = 3 + Math.floor(rnd() * 5);
        for (let d = 0; d < len; d++) g.px(vx + d, vy + Math.round(d * 0.6), tone(color, rnd() < 0.5 ? 0.1 : -0.14));
      }
      return;
    }
    default: {
      // Chão de terra batida com palha espalhada
      g.rect(x, y, w, h, color);
      speckle(g, x, y, w, h, color, 0.14, rnd);
      for (let k = 0; k < (w * h) / 160; k++) {
        const sx = x + Math.floor(rnd() * w);
        const sy = y + Math.floor(rnd() * h);
        const dx = rnd() < 0.5 ? 1 : -1;
        const c = rnd() < 0.5 ? STRAW.base : STRAW.dark;
        for (let d = 0; d < 3; d++) g.px(sx + d * dx, sy + (d === 2 ? 1 : 0), c);
      }
      for (let k = 0; k < (w * h) / 900; k++) g.px(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), 0x7a7268);
    }
  }
}

/** Janelinha na parede do fundo (madeira e pedra): vidro escuro com a cruz e o peitoril. */
function pane(g: Grid, x: number, y: number, frame: number): void {
  g.rect(x - 1, y - 1, 14, 16, frame);
  g.rect(x, y, 12, 14, 0x2c3a52);
  g.rect(x + 1, y + 1, 4, 4, 0x4a5e7e);
  g.rect(x + 5, y, 2, 14, frame);
  g.rect(x, y + 6, 12, 2, frame);
  g.rect(x - 2, y + 14, 16, 2, tone(frame, 0.2));
}

/** Tocha na parede de pedra: o suporte de ferro e a chama (o fogo que mexe fica para o G6). */
function sconce(g: Grid, x: number, y: number): void {
  g.rect(x, y + 6, 4, 2, IRON.dark);
  g.rect(x + 1, y + 2, 2, 5, WOOD.dark);
  g.rect(x, y - 2, 4, 4, EMBER);
  g.rect(x + 1, y - 4, 2, 4, FLAME);
  g.px(x + 1, y - 5, 0xfff2b0);
}

function backWall(g: Grid, style: InteriorStyle, x: number, y: number, w: number, h: number, color: number, rnd: () => number): void {
  switch (style) {
    case "WOOD": {
      for (let row = 0; row * 7 < h; row++) {
        const c = tone(color, rnd() * 0.12 - 0.06);
        g.rect(x, y + row * 7, w, 6, c);
        g.rect(x, y + row * 7, w, 1, tone(c, 0.1));
        g.rect(x, y + row * 7 + 6, w, 1, tone(color, -0.32));
      }
      g.rect(x, y, w, 4, tone(color, -0.25));
      for (let px = x + 60; px < x + w - 20; px += 128) {
        pane(g, px + 40, y + 10, tone(color, -0.35));
      }
      for (let px = x; px < x + w; px += 128) {
        g.rect(px, y, 6, h, tone(color, -0.3));
        g.rect(px, y, 1, h, tone(color, -0.1));
      }
      break;
    }
    case "STONE": {
      stoneFace(g, x, y, w, h, color, rnd);
      for (let px = x + 70; px < x + w - 30; px += 160) pane(g, px + 60, y + 9, tone(color, -0.3));
      for (let px = x + 50; px < x + w - 20; px += 160) sconce(g, px, y + 16);
      break;
    }
    case "TEMPLE": {
      g.rect(x, y, w, h, color);
      speckle(g, x, y, w, h, color, 0.03, rnd);
      // Pilastras com capitel e base, e vitrais em arco entre elas
      for (let px = x + 24; px < x + w - 10; px += 96) {
        g.rect(px, y, 10, h, tone(color, 0.12));
        g.rect(px + 9, y, 1, h, tone(color, -0.16));
        g.rect(px - 2, y, 14, 3, tone(color, 0.2));
        g.rect(px - 2, y + h - 4, 14, 4, tone(color, -0.12));
        const wx = px + 44;
        if (wx + 10 < x + w) {
          const glass = [0x3a5aa0, 0xa03a3a, 0xc9a23a, 0x3a8a5a];
          g.rect(wx - 1, y + 6, 12, 26, tone(color, -0.3));
          for (let j = 0; j < 24; j++) for (let i = 0; i < 10; i++) g.px(wx + i, y + 8 + j, glass[(Math.floor(i / 3) + Math.floor(j / 5)) % 4]);
          g.px(wx, y + 8, tone(color, -0.3));
          g.px(wx + 9, y + 8, tone(color, -0.3));
          g.rect(wx + 4, y + 8, 2, 24, tone(color, -0.3));
        }
      }
      g.rect(x, y + h - 2, w, 2, tone(color, -0.25));
      break;
    }
    default: {
      // Lona: os panos costurados, as dobras do teto e os esteios
      g.rect(x, y, w, h, color);
      for (let px = x; px < x + w; px += 48) {
        g.rect(px, y, 1, h, tone(color, -0.16));
        g.rect(px + 1, y, 1, h, tone(color, 0.1));
        for (let j = 0; j < 8; j++) g.rect(px + 2, y + j, 8 - j, 1, tone(color, -0.08));
      }
      g.rect(x, y, w, 3, tone(color, -0.22));
      for (let px = x + 80; px < x + w - 20; px += 160) {
        g.rect(px, y, 4, h, WOOD.base);
        g.rect(px, y, 1, h, WOOD.light);
        g.rect(px + 3, y, 1, h, WOOD.dark);
      }
      g.rect(x, y + h - 3, w, 3, tone(color, -0.3));
    }
  }
}

/** O topo de uma parede: o material, a beira de dentro clara e as juntas. */
function cap(g: Grid, x: number, y: number, w: number, h: number, color: number, along: "H" | "V", rnd: () => number): void {
  if (w <= 0 || h <= 0) return;
  g.rect(x, y, w, h, color);
  speckle(g, x, y, w, h, color, 0.06, rnd);
  const seam = tone(color, -0.25);
  if (along === "H") for (let i = x + 12; i < x + w; i += 24) g.rect(i, y, 1, h, seam);
  else for (let j = y + 12; j < y + h; j += 24) g.rect(x, j, w, 1, seam);
}

/** Tapete da porta: trançado vermelho com a barra dourada e a franja. */
function doormat(g: Grid, x: number, y: number): void {
  const red = ramp(0x7a2a22);
  g.rect(x, y, 68, 28, red.base);
  for (let j = 4; j < 24; j += 4) g.rect(x + 4, y + j, 60, 1, red.dark);
  g.rect(x + 2, y + 2, 64, 1, GOLD.base);
  g.rect(x + 2, y + 25, 64, 1, GOLD.base);
  g.rect(x + 2, y + 2, 1, 24, GOLD.base);
  g.rect(x + 65, y + 2, 1, 24, GOLD.base);
  for (let i = 2; i < 66; i += 3) g.px(x + i, y + 28, red.light);
}

/**
 * A sala inteira numa grade: o chão, a sombra da parede no chão, a parede do fundo de frente,
 * o topo das outras paredes, o vão da porta e o tapete. O canto da grade fica em
 * (-ROOM_WALL, -ROOM_WALL - BACK_FACE) do chão da sala.
 */
export function roomGrid(style: InteriorStyle, w: number, h: number, doorX: number, seed: number): Grid {
  const wall = ROOM_WALL;
  const W = w + wall * 2;
  const g = new Grid(W, h + wall * 2 + BACK_FACE);
  const ox = wall;
  const oy = wall + BACK_FACE;
  const rnd = seeded(seed);
  const c = ROOM[style];
  const door0 = Math.round(doorX - DOOR_HALF);
  const door1 = Math.round(doorX + DOOR_HALF);

  floorFill(g, style, ox, oy, w, h, c.floor, rnd);
  floorFill(g, style, ox + door0, oy + h, door1 - door0, wall, c.floor, rnd);
  // A parede projeta sombra no chão, mais forte rente a ela
  for (let j = 0; j < 7; j++) shade(g, ox, oy + j, w, 1, -0.3 * (1 - j / 7));
  for (let i = 0; i < 4; i++) {
    shade(g, ox + i, oy, 1, h, -0.22 * (1 - i / 4));
    shade(g, ox + w - 1 - i, oy, 1, h, -0.12 * (1 - i / 4));
  }
  backWall(g, style, ox, oy - BACK_FACE, w, BACK_FACE, c.face, rnd);

  // O topo das paredes: em cima, dos lados e embaixo (com o vão da porta)
  cap(g, 0, 0, W, wall, c.cap, "H", rnd);
  cap(g, 0, wall, wall, h + BACK_FACE + wall, c.cap, "V", rnd);
  cap(g, ox + w, wall, wall, h + BACK_FACE + wall, c.cap, "V", rnd);
  cap(g, wall, oy + h, door0, wall, c.cap, "H", rnd);
  cap(g, ox + door1, oy + h, w - door1, wall, c.cap, "H", rnd);
  // As beiras: clara do lado de dentro, contorno do lado de fora
  const lip = tone(c.cap, 0.22);
  g.rect(wall - 1, wall, w + 2, 1, lip);
  g.rect(wall - 1, wall, 1, h + BACK_FACE, lip);
  g.rect(ox + w, wall, 1, h + BACK_FACE, tone(c.cap, -0.3));
  g.rect(wall, oy + h, door0, 1, lip);
  g.rect(ox + door1, oy + h, w - door1, 1, lip);
  // Batentes da porta
  for (const jx of [ox + door0 - 4, ox + door1]) {
    g.rect(jx, oy + h - 2, 4, wall + 2, tone(c.cap, -0.35));
    g.rect(jx, oy + h - 2, 4, 1, tone(c.cap, 0.15));
  }
  doormat(g, ox + door0, oy + h - 14);
  g.rect(0, 0, W, 1, OUTLINE);
  g.rect(0, g.h - 1, W, 1, OUTLINE);
  g.rect(0, 0, 1, g.h, OUTLINE);
  g.rect(W - 1, 0, 1, g.h, OUTLINE);
  return g;
}

// --- Os móveis ---

/** Móveis rentes ao chão: ficam embaixo de todo mundo. */
export const FLAT_FURNITURE: ReadonlySet<FurnitureKind> = new Set<FurnitureKind>(["CARPET", "HAY", "WATER", "IRON"]);

/** Uma grade para um móvel de pé `w`×`h` que sobe `up` px acima dele, com folga para o contorno e a sombra. */
function canvas(w: number, h: number, up: number): { g: Grid; ox: number; oy: number } {
  return { g: new Grid(M + w + SH + M, M + up + h + SH + M), ox: M, oy: M + up };
}

function finish(g: Grid, ox: number, oy: number, shadow = true): Piece {
  g.outline();
  if (shadow) dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Caixa em 3/4: o tampo sobe `z` e a frente desce até o chão. */
function block(g: Grid, x: number, y: number, w: number, h: number, z: number, top: Ramp, face: Ramp): void {
  g.rect(x, y - z, w, h, top.base);
  g.rect(x, y - z, w, 1, top.light);
  g.rect(x, y + h - z, w, z, face.base);
  g.rect(x, y + h - z, w, 1, face.light);
  g.rect(x + w - 1, y + h - z, 1, z, face.dark);
}

function mug(g: Grid, x: number, y: number): void {
  g.rect(x, y, 3, 4, 0x9a7a4a);
  g.rect(x, y, 3, 1, 0xf0e8d0);
  g.px(x + 3, y + 1, 0x6a4a2a);
}

function candle(g: Grid, x: number, y: number): void {
  g.rect(x, y, 2, 5, 0xf0e8d0);
  g.px(x, y - 1, FLAME);
  g.px(x, y - 2, 0xfff2b0);
}

function table(w: number, h: number, color: number, seed: number): Piece {
  const Z = 10;
  const { g, ox, oy } = canvas(w, h, Z);
  const wood = ramp(color);
  const rnd = seeded(seed);
  for (const lx of [2, w - 5]) g.rect(ox + lx, oy + h - Z, 3, Z, wood.dark);
  const top = tone(color, 0.1);
  g.rect(ox, oy - Z, w, h, top);
  for (let j = 7; j < h; j += 8) g.rect(ox, oy - Z + j, w, 1, tone(color, -0.08));
  g.rect(ox, oy - Z, w, 1, tone(color, 0.28));
  g.rect(ox, oy + h - Z, w, 3, color);
  g.rect(ox, oy + h - Z + 2, w, 1, wood.dark);
  const tx = ox;
  const ty = oy - Z;
  if (h >= 200) {
    // Mesa de banquete: pratos dos dois lados, taças e o assado no meio
    for (let y = 10; y < h - 10; y += 26) {
      for (const x of [6, w - 16]) {
        g.oval(tx + x + 5, ty + y, 5, 3, 0xd8d0c0);
        g.oval(tx + x + 5, ty + y, 2, 1, 0xb8a888);
      }
      g.rect(tx + 22, ty + y - 2, 2, 4, GOLD.base);
      g.rect(tx + w - 24, ty + y - 2, 2, 4, GOLD.base);
    }
    g.oval(tx + w / 2, ty + h / 2, 12, 7, 0xb8a888);
    g.oval(tx + w / 2, ty + h / 2 - 1, 8, 4, 0x8a4a22);
    g.oval(tx + w / 2 - 2, ty + h / 2 - 2, 3, 2, 0xb06a32);
  } else if (w >= 150 && h >= 60) {
    // Mesa de guerra ou do conselho: o mapa aberto e as peças em cima
    const mw = Math.min(w - 20, 120);
    const mh = Math.min(h - 18, 60);
    const mx = tx + Math.round((w - mw) / 2);
    const my = ty + Math.round((h - mh) / 2);
    g.rect(mx, my, mw, mh, 0xe8dcb8);
    g.rect(mx, my, mw, 1, 0xf5ecd0);
    for (let k = 0; k < 5; k++) g.line(mx + 4 + Math.floor(rnd() * (mw - 8)), my + 3, mx + 4 + Math.floor(rnd() * (mw - 8)), my + mh - 4, 0x9a8a6a);
    g.oval(mx + Math.round(mw * 0.6), my + Math.round(mh * 0.4), 9, 5, 0x6a9a8a);
    for (const pc of [0xc0392b, 0x2e6fdf, 0xc0392b, 0x2e6fdf, 0xe0b040]) {
      const px = mx + 6 + Math.floor(rnd() * (mw - 12));
      const py = my + 6 + Math.floor(rnd() * (mh - 12));
      g.rect(px, py, 2, 3, pc);
      g.px(px, py - 1, tone(pc, 0.3));
    }
  } else {
    // Mesa comum: canecas, pão e uma vela
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) mug(g, tx + 6 + Math.floor(rnd() * (w - 14)), ty + 3 + Math.floor(rnd() * Math.max(1, h - 12)));
    if (w >= 60) candle(g, tx + Math.round(w / 2), ty + Math.round(h / 2) - 2);
    if (rnd() < 0.6) g.oval(tx + 10 + Math.floor(rnd() * (w - 20)), ty + h - 8, 3, 2, 0xc8964a);
  }
  return finish(g, ox, oy);
}

function bed(w: number, h: number, color: number): Piece {
  const Z = 6;
  const { g, ox, oy } = canvas(w, h, Z + 6);
  const frame = WOOD;
  const cloth = ramp(color);
  const tall = h > w;
  g.rect(ox, oy - Z, w, h, frame.base);
  g.rect(ox, oy + h - Z, w, Z, frame.dark);
  g.rect(ox + 2, oy - Z + 2, w - 4, h - 4, LINEN);
  // A cabeceira (em cima ou à esquerda), o travesseiro e o cobertor dobrado
  if (tall) {
    g.rect(ox, oy - Z - 6, w, 8, frame.base);
    g.rect(ox, oy - Z - 6, w, 1, frame.light);
    g.rect(ox + 4, oy - Z + 4, w - 8, Math.max(6, Math.round(h * 0.16)), 0xf5f0e4);
    const by = oy - Z + Math.round(h * 0.34);
    g.rect(ox + 2, by, w - 4, oy + h - Z - 2 - by, cloth.base);
    g.rect(ox + 2, by, w - 4, 3, cloth.light);
    for (let y = by + 6; y < oy + h - Z - 3; y += 6) g.rect(ox + 3, y, w - 6, 1, cloth.dark);
  } else {
    g.rect(ox - 1, oy - Z - 6, 7, h + 6, frame.base);
    g.rect(ox - 1, oy - Z - 6, 7, 1, frame.light);
    g.rect(ox + 8, oy - Z + 4, Math.max(8, Math.round(w * 0.16)), h - 8, 0xf5f0e4);
    const bx = ox + Math.round(w * 0.34);
    g.rect(bx, oy - Z + 2, ox + w - 2 - bx, h - 4, cloth.base);
    g.rect(bx, oy - Z + 2, 3, h - 4, cloth.light);
    for (let x = bx + 6; x < ox + w - 3; x += 6) g.rect(x, oy - Z + 3, 1, h - 6, cloth.dark);
  }
  return finish(g, ox, oy);
}

function barrel(w: number, h: number, color: number): Piece {
  const Z = Math.round(h * 0.8);
  const { g, ox, oy } = canvas(w, h, Z);
  const c = ramp(color);
  const water = (color & 0xff) > ((color >> 16) & 0xff);
  const cx = ox + Math.floor(w / 2);
  const rx = Math.floor(w / 2) - 1;
  const ry = Math.max(3, Math.floor(h / 4));
  const bottom = oy + Math.floor(h / 2);
  const top = bottom - Z;
  g.oval(cx, bottom, rx, ry, c.dark);
  g.rect(cx - rx, top, rx * 2 + 1, Z, c.base);
  for (let i = -rx + 2; i < rx; i += 4) g.rect(cx + i, top, 1, Z, c.light);
  g.rect(cx + rx - 2, top, 2, Z, c.dark);
  for (const f of [0.2, 0.75]) g.rect(cx - rx, top + Math.round(Z * f), rx * 2 + 1, 2, IRON.base);
  g.oval(cx, top, rx, ry, water ? 0x2b5a7b : tone(color, 0.2));
  g.oval(cx, top, rx - 2, Math.max(1, ry - 2), water ? 0x3a7a9a : tone(color, 0.08));
  if (!water) g.rect(cx - rx + 2, top, rx * 2 - 3, 1, tone(color, -0.1));
  return finish(g, ox, oy);
}

function crate(w: number, h: number, color: number): Piece {
  const Z = Math.round(h * 0.55);
  const { g, ox, oy } = canvas(w, h, Z);
  const wood = ramp(0x8a6a42);
  block(g, ox, oy, w, h, Z, wood, wood);
  for (let j = 5; j < h; j += 6) g.rect(ox, oy - Z + j, w, 1, wood.dark);
  // A frente com as travessas e a marca da mercadoria
  const fy = oy + h - Z;
  g.line(ox + 1, fy + 1, ox + w - 2, fy + Z - 2, wood.dark);
  g.rect(ox, fy, 2, Z, wood.dark);
  g.rect(ox + w - 2, fy, 2, Z, wood.dark);
  const mark = Math.max(4, Math.round(Math.min(w, Z) * 0.35));
  g.rect(ox + Math.round(w / 2 - mark / 2), fy + Math.round(Z / 2 - mark / 2), mark, mark, color);
  return finish(g, ox, oy);
}

function sack(w: number, h: number, color: number): Piece {
  const Z = Math.round(h * 0.5);
  const { g, ox, oy } = canvas(w, h, Z);
  const c = ramp(color);
  const cx = ox + Math.floor(w / 2);
  const cy = oy + Math.floor(h / 2) - Math.floor(Z / 2);
  g.oval(cx, cy + 2, Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, c.base);
  g.oval(cx - 2, cy, Math.floor(w / 4), Math.floor(h / 4), c.light);
  g.oval(cx + 3, cy + 5, Math.floor(w / 4), Math.floor(h / 5), c.dark);
  const neck = cy - Math.floor(h / 2) + 1;
  g.rect(cx - 2, neck - 3, 5, 4, c.base);
  g.rect(cx - 3, neck, 7, 1, 0x6a5030);
  return finish(g, ox, oy);
}

/** Lareira (e a forja): o fogo na grelha, as achas e a coifa de pedra subindo na parede. */
function hearth(w: number, h: number): Piece {
  const hood = 50;
  const { g, ox, oy } = canvas(w, h, hood);
  const stone = ramp(0x77716a);
  const rnd = seeded(w * 31 + h);
  // A coifa, mais estreita em cima
  g.poly(
    [
      [ox + 6, oy + 6],
      [ox + w - 7, oy + 6],
      [ox + w - 18, oy - hood],
      [ox + 17, oy - hood],
    ],
    stone.base,
  );
  stoneFace(g, ox + 18, oy - hood, w - 36, 14, stone.base, rnd);
  g.rect(ox + 4, oy + 2, w - 8, 6, stone.light);
  // A boca do fogo e a base
  g.rect(ox, oy + 8, w, h - 8, stone.base);
  g.rect(ox, oy + 8, w, 1, stone.light);
  g.rect(ox + 8, oy + 12, w - 16, h - 16, 0x2a1e18);
  g.rect(ox + 12, oy + h - 9, w - 24, 3, WOOD.dark);
  g.line(ox + 14, oy + h - 8, ox + w - 16, oy + h - 12, WOOD.base);
  g.oval(ox + Math.round(w / 2), oy + h - 9, Math.round(w / 4), 3, EMBER);
  for (let k = 0; k < 4; k++) {
    const fx = ox + 14 + Math.floor(((w - 28) * (k + 0.5)) / 4);
    const fh = 6 + ((k * 5) % 7);
    g.rect(fx - 1, oy + h - 9 - fh, 3, fh, k % 2 ? FLAME : EMBER);
    g.px(fx, oy + h - 10 - fh, 0xfff2b0);
  }
  g.rect(ox, oy + h - 2, w, 2, stone.dark);
  return finish(g, ox, oy, false);
}

function anvil(w: number, h: number): Piece {
  const { g, ox, oy } = canvas(w, h, 18);
  const cx = ox + Math.floor(w / 2);
  g.rect(cx - 9, oy + h - 16, 18, 16, WOOD.base);
  g.oval(cx, oy + h - 16, 9, 3, WOOD.light);
  g.rect(cx + 6, oy + h - 16, 3, 16, WOOD.dark);
  const ay = oy + h - 26;
  g.rect(cx - 14, ay, 26, 6, IRON.base);
  g.rect(cx - 14, ay, 26, 1, IRON.light);
  g.poly(
    [
      [cx + 12, ay],
      [cx + 22, ay + 2],
      [cx + 12, ay + 5],
    ],
    IRON.base,
  );
  g.rect(cx - 7, ay + 6, 12, 5, IRON.dark);
  g.rect(cx - 16, oy + h - 6, 6, 4, IRON.dark);
  return finish(g, ox, oy);
}

function altar(w: number, h: number, color: number): Piece {
  const Z = 16;
  const { g, ox, oy } = canvas(w, h, Z + 8);
  const stone = ramp(color);
  block(g, ox, oy, w, h, Z, stone, ramp(tone(color, -0.1)));
  // O pano branco com a barra de ouro caindo pela frente
  g.rect(ox + 6, oy - Z + 2, w - 12, h - 4, 0xf5f0e4);
  g.rect(ox + Math.round(w / 2) - 12, oy + h - Z, 24, Z - 4, 0xf5f0e4);
  g.rect(ox + Math.round(w / 2) - 12, oy + h - 7, 24, 2, GOLD.base);
  g.rect(ox + Math.round(w / 2) - 1, oy + h - Z + 2, 2, 7, GOLD.base);
  g.rect(ox + Math.round(w / 2) - 3, oy + h - Z + 4, 6, 2, GOLD.base);
  for (const x of [ox + 12, ox + w - 14]) candle(g, x, oy - Z + 2);
  g.rect(ox + Math.round(w / 2) - 4, oy - Z + 4, 8, 6, GOLD.base);
  g.rect(ox + Math.round(w / 2) - 4, oy - Z + 4, 8, 1, GOLD.light);
  return finish(g, ox, oy);
}

/** Armeiro: o cavalete com lanças, espadas e um escudo encostado. */
function rack(w: number, h: number, color: number, seed: number): Piece {
  const tall = 34;
  const { g, ox, oy } = canvas(w, h, tall);
  const wood = ramp(color);
  const rnd = seeded(seed);
  const along = w >= h;
  const len = along ? w : h;
  for (let d = 4, k = 0; d < len - 2; d += 7, k++) {
    // No armeiro de parede (de norte a sul) as armas ficam uma atrás da outra: desencontradas, para se ver cada uma
    const x = along ? ox + d : ox + Math.floor(w / 2) - 1 + ((k % 3) - 1) * 4;
    const y = along ? oy + h - 4 : oy + d + 4;
    const kind = rnd();
    if (kind < 0.55) {
      g.rect(x, y - tall + 4, 1, tall - 4, WOOD.light);
      g.rect(x - 1, y - tall + 1, 3, 4, IRON.light);
      g.px(x, y - tall, IRON.light);
    } else {
      g.rect(x, y - tall + 12, 2, tall - 14, IRON.light);
      g.rect(x - 2, y - 4, 6, 2, WOOD.dark);
      g.rect(x, y - 2, 2, 3, WOOD.base);
    }
  }
  if (along) {
    g.rect(ox, oy + h - 16, w, 3, wood.base);
    g.rect(ox, oy + h - 16, w, 1, wood.light);
    for (const x of [ox, ox + w - 3]) g.rect(x, oy + h - 22, 3, 22, wood.dark);
    if (w >= 60) {
      const sx = ox + w - 18;
      const red = ramp(0x8e2b22);
      g.oval(sx, oy + h - 9, 7, 8, red.base);
      g.oval(sx, oy + h - 9, 3, 4, GOLD.base);
    }
  } else {
    g.rect(ox + Math.floor(w / 2) - 3, oy + 2, 6, h - 4, wood.dark);
    g.rect(ox + Math.floor(w / 2) - 3, oy - 14, 6, 3, wood.base);
    g.line(ox + Math.floor(w / 2) - 3, oy - 14, ox + Math.floor(w / 2) - 3, oy + h - 14, wood.base);
  }
  return finish(g, ox, oy);
}

/** Estante de livros, encostada na parede do fundo. */
function shelf(w: number, h: number, color: number, seed: number): Piece {
  const tall = 46;
  const { g, ox, oy } = canvas(w, h, tall);
  const wood = ramp(color === 0x3e2a17 ? 0x5a3a20 : color);
  const rnd = seeded(seed);
  g.rect(ox, oy - tall, w, h, wood.light);
  g.rect(ox, oy + h - tall, w, tall, wood.base);
  const books = [0x8e2b22, 0x2e4a7a, 0x3a6a3a, 0x7a5a2a, 0x5a2a5a, 0xb08a3a];
  for (let s = 0; s < 4; s++) {
    const sy = oy + h - tall + 3 + s * 11;
    g.rect(ox + 2, sy, w - 4, 9, wood.dark);
    for (let x = ox + 3; x < ox + w - 4; ) {
      const bw = 2 + Math.floor(rnd() * 2);
      const bh = 6 + Math.floor(rnd() * 3);
      const c = books[Math.floor(rnd() * books.length)];
      if (rnd() < 0.08) {
        x += 3;
        continue;
      }
      g.rect(x, sy + 9 - bh, bw, bh, c);
      g.px(x, sy + 9 - bh, tone(c, 0.3));
      x += bw;
    }
    g.rect(ox + 1, sy + 9, w - 2, 2, wood.base);
  }
  g.rect(ox, oy + h - tall, 2, tall, wood.dark);
  g.rect(ox + w - 2, oy + h - tall, 2, tall, wood.dark);
  return finish(g, ox, oy);
}

/** Poleiros da falcoaria: a barra nos esteios e as aves de capuz em cima. */
function perch(w: number, h: number, seed: number): Piece {
  const { g, ox, oy } = canvas(w, h, 30);
  const rnd = seeded(seed);
  const by = oy + Math.floor(h / 2) - 14;
  for (const x of [ox + 2, ox + w - 5]) g.rect(x, by, 3, oy + h - by, WOOD.dark);
  g.rect(ox, by, w, 3, WOOD.base);
  g.rect(ox, by, w, 1, WOOD.light);
  const birds = Math.max(1, Math.floor(w / 30));
  for (let k = 0; k < birds; k++) {
    const x = ox + Math.round(((k + 0.5) * w) / birds);
    const brown = ramp(rnd() < 0.5 ? 0x7a5432 : 0x8a7a6a);
    g.oval(x, by - 6, 4, 6, brown.base);
    g.rect(x - 1, by - 13, 3, 3, 0x6a2a1a);
    g.px(x + 2, by - 11, 0xd8b040);
    g.rect(x - 3, by - 4, 2, 5, brown.dark);
    g.rect(x - 1, by, 1, 2, 0xd8b040);
    g.rect(x + 1, by, 1, 2, 0xd8b040);
  }
  return finish(g, ox, oy);
}

function bench(w: number, h: number, color: number): Piece {
  const Z = 7;
  const { g, ox, oy } = canvas(w, h, Z);
  const wood = ramp(color);
  for (let x = 4; x < w - 3; x += Math.max(24, Math.floor(w / 4))) g.rect(ox + x, oy + h - Z, 3, Z, wood.dark);
  g.rect(ox + w - 7, oy + h - Z, 3, Z, wood.dark);
  g.rect(ox, oy - Z, w, h - 2, tone(color, 0.08));
  g.rect(ox, oy - Z, w, 1, wood.light);
  g.rect(ox, oy - Z + Math.floor(h / 2), w, 1, wood.dark);
  g.rect(ox, oy + h - Z - 2, w, 2, wood.base);
  return finish(g, ox, oy);
}

function counter(w: number, h: number, color: number, seed: number): Piece {
  const Z = 18;
  const { g, ox, oy } = canvas(w, h, Z + 8);
  const wood = ramp(color);
  const rnd = seeded(seed);
  block(g, ox, oy, w, h, Z, ramp(tone(color, 0.14)), wood);
  for (let x = ox + 10; x < ox + w - 6; x += 20) {
    g.rect(x, oy + h - Z + 3, 14, Z - 6, wood.dark);
    g.rect(x + 1, oy + h - Z + 4, 12, Z - 8, wood.base);
  }
  // Em cima: canecas, garrafas e um pano
  for (let x = ox + 6; x < ox + w - 8; x += 12 + Math.floor(rnd() * 14)) {
    const y = oy - Z + 2 + Math.floor(rnd() * Math.max(1, h - 10));
    if (rnd() < 0.5) mug(g, x, y);
    else {
      const glass = rnd() < 0.5 ? 0x3a6a3a : 0x6a3a1a;
      g.rect(x, y - 2, 3, 6, glass);
      g.rect(x + 1, y - 4, 1, 2, glass);
      g.px(x, y - 1, tone(glass, 0.4));
    }
  }
  g.rect(ox + w - 22, oy - Z + 3, 10, 4, 0xe8e0d0);
  return finish(g, ox, oy);
}

function chest(w: number, h: number, color: number): Piece {
  const Z = Math.round(h * 0.6);
  const { g, ox, oy } = canvas(w, h, Z + 2);
  const wood = ramp(color === 0x3e2a17 ? 0x5a3a22 : color);
  block(g, ox, oy, w, h, Z, ramp(tone(wood.base, 0.1)), wood);
  g.rect(ox + 1, oy - Z - 1, w - 2, 1, wood.light);
  for (const f of [0.22, 0.72]) {
    const x = ox + Math.round(w * f);
    g.rect(x, oy - Z, 3, h + Z, IRON.base);
    g.rect(x, oy - Z, 1, h + Z, IRON.light);
  }
  const lx = ox + Math.round(w / 2) - 2;
  g.rect(lx, oy + h - Z + 1, 5, 5, GOLD.base);
  g.px(lx + 2, oy + h - Z + 3, 0x2a1e10);
  return finish(g, ox, oy);
}

/** Quadro de avisos (preços, mapa do conselho) em dois pés, com as folhas pregadas ou o giz. */
function board(w: number, h: number, color: number, seed: number): Piece {
  const up = 28;
  const { g, ox, oy } = canvas(w, h, up);
  const rnd = seeded(seed);
  for (const x of [ox + 4, ox + w - 7]) g.rect(x, oy - up + 4, 3, up + h - 4, WOOD.dark);
  const by = oy - up;
  const bh = up + Math.floor(h / 2);
  g.rect(ox, by, w, bh, WOOD.base);
  g.rect(ox + 2, by + 2, w - 4, bh - 4, color);
  const chalk = (color >> 16) < 0x40;
  for (let y = by + 5; y < by + bh - 4; y += 4) {
    if (chalk) g.rect(ox + 6, y, Math.floor((w - 12) * (0.4 + rnd() * 0.6)), 1, 0xd8d8d0);
  }
  if (!chalk) {
    for (let k = 0; k < Math.floor(w / 22); k++) {
      const px = ox + 5 + k * 22 + Math.floor(rnd() * 4);
      const py = by + 4 + Math.floor(rnd() * Math.max(1, bh - 18));
      g.rect(px, py, 14, 11, 0xf0e8d0);
      for (let j = 3; j < 10; j += 2) g.rect(px + 2, py + j, 10, 1, 0xa89a80);
      g.px(px + 7, py + 1, 0xc0392b);
    }
  }
  return finish(g, ox, oy);
}

function hay(w: number, h: number, color: number, seed: number): Piece {
  const g = new Grid(w, h);
  const rnd = seeded(seed);
  const c = ramp(color);
  g.rect(0, 0, w, h, c.base);
  for (let k = 0; k < (w * h) / 10; k++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const col = rnd() < 0.5 ? c.light : c.dark;
    g.px(x, y, col);
    g.px(x + 1, y + (rnd() < 0.5 ? 0 : 1), col);
  }
  // A beira irregular, onde a palha acaba
  for (let x = 0; x < w; x++) {
    if (rnd() < 0.5) g.px(x, 0, CLEAR);
    if (rnd() < 0.5) g.px(x, h - 1, CLEAR);
  }
  for (let y = 0; y < h; y++) {
    if (rnd() < 0.5) g.px(0, y, CLEAR);
    if (rnd() < 0.5) g.px(w - 1, y, CLEAR);
  }
  return { grid: g, dx: 0, dy: 0 };
}

function carpet(w: number, h: number, color: number): Piece {
  const g = new Grid(w, h);
  const c = ramp(color);
  g.rect(0, 0, w, h, c.base);
  g.rect(0, 0, w, 3, c.dark);
  g.rect(0, h - 3, w, 3, c.dark);
  g.rect(0, 0, 3, h, c.dark);
  g.rect(w - 3, 0, 3, h, c.dark);
  g.rect(5, 5, w - 10, 1, GOLD.base);
  g.rect(5, h - 6, w - 10, 1, GOLD.base);
  g.rect(5, 5, 1, h - 10, GOLD.base);
  g.rect(w - 6, 5, 1, h - 10, GOLD.base);
  // O campo tecido: losangos miúdos em treliça, dentro da barra
  const along = h > w;
  for (let y = 10; y < h - 10; y += 10) {
    for (let x = 10 + ((y / 10) % 2) * 5; x < w - 10; x += 10) {
      g.px(x, y - 2, c.light);
      g.px(x - 1, y - 1, c.light);
      g.px(x + 1, y - 1, c.light);
      g.px(x - 2, y, c.light);
      g.px(x, y, GOLD.dark);
      g.px(x + 2, y, c.light);
      g.px(x - 1, y + 1, c.light);
      g.px(x + 1, y + 1, c.light);
      g.px(x, y + 2, c.light);
    }
  }
  // Franja nas pontas curtas
  if (along) {
    for (let x = 2; x < w - 2; x += 2) {
      g.px(x, 0, LINEN);
      g.px(x, h - 1, LINEN);
    }
  } else {
    for (let y = 2; y < h - 2; y += 2) {
      g.px(0, y, LINEN);
      g.px(w - 1, y, LINEN);
    }
  }
  return { grid: g, dx: 0, dy: 0 };
}

/** Água do esgoto: verde escura, com a beira de pedra e as ondinhas. */
function water(w: number, h: number, color: number, seed: number): Piece {
  const g = new Grid(w, h);
  const rnd = seeded(seed);
  const c = ramp(color);
  g.rect(0, 0, w, h, c.base);
  g.rect(0, 0, w, 4, 0x6a665e);
  g.rect(0, 4, w, 2, c.dark);
  g.rect(0, h - 3, w, 3, 0x7a766e);
  for (let k = 0; k < (w * h) / 120; k++) {
    const x = Math.floor(rnd() * (w - 6));
    const y = 8 + Math.floor(rnd() * (h - 14));
    g.rect(x, y, 3 + Math.floor(rnd() * 4), 1, c.light);
  }
  return { grid: g, dx: 0, dy: 0 };
}

/** Estandarte de pé, no mastro com a travessa, a ponta de ouro e o pano de rabo partido. */
function banner(w: number, h: number, color: number): Piece {
  const up = 30 + h;
  const { g, ox, oy } = canvas(w, h, up);
  const cx = ox + Math.floor(w / 2);
  const cloth = ramp(color);
  g.rect(cx - 1, oy - up + 2, 2, up + h - 2, WOOD.dark);
  g.rect(cx - 1, oy - up + 2, 1, up + h - 2, WOOD.base);
  g.rect(ox + 2, oy - up + 6, w - 4, 2, WOOD.base);
  g.rect(cx - 1, oy - up, 2, 2, GOLD.light);
  const cw = w - 8;
  const ch = Math.round(up * 0.62);
  const x0 = ox + 4;
  const y0 = oy - up + 8;
  g.rect(x0, y0, cw, ch, cloth.base);
  g.rect(x0, y0, 2, ch, cloth.light);
  g.rect(x0 + cw - 2, y0, 2, ch, cloth.dark);
  // O rabo partido embaixo
  for (let i = 0; i < cw; i++) if (Math.abs(i - cw / 2) >= cw / 4) g.rect(x0 + i, y0 + ch, 1, 4, cloth.base);
  // A divisa: um losango claro no meio
  const my = y0 + Math.floor(ch / 2);
  for (let k = -4; k <= 4; k++) g.rect(cx - (4 - Math.abs(k)), my + k, (4 - Math.abs(k)) * 2 + 1, 1, tone(color, 0.35));
  return finish(g, ox, oy);
}

function ironBars(w: number, h: number, color: number): Piece {
  const { g, ox, oy } = canvas(w, h, 2);
  const bar = ramp(color);
  for (let k = 0; k < 2; k++) {
    g.rect(ox, oy + h - 4 - k * 3, w, 3, k ? bar.light : bar.base);
    g.rect(ox, oy + h - 4 - k * 3, w, 1, bar.light);
  }
  return finish(g, ox, oy, false);
}

/** O trono: o espaldar alto de ouro, o assento de veludo e os braços. */
function throne(w: number, h: number, color: number): Piece {
  const back = 44;
  const { g, ox, oy } = canvas(w, h, back);
  const gold = ramp(color);
  const red = ramp(0x8e2b22);
  // O espaldar, com a ponta em arco e a pedra no alto
  g.rect(ox + 6, oy - back + 6, w - 12, back + 10, gold.base);
  g.oval(ox + Math.floor(w / 2), oy - back + 8, Math.floor(w / 2) - 6, 8, gold.base);
  g.rect(ox + 12, oy - back + 10, w - 24, back + 2, red.base);
  g.rect(ox + 12, oy - back + 10, 2, back + 2, red.light);
  g.rect(ox + Math.floor(w / 2) - 2, oy - back - 1, 4, 4, 0x3a8ad0);
  // O assento e os braços
  g.rect(ox + 2, oy + 6, w - 4, h - 16, gold.dark);
  g.rect(ox + 8, oy + 4, w - 16, h - 18, red.base);
  g.rect(ox + 8, oy + 4, w - 16, 2, red.light);
  for (const x of [ox, ox + w - 8]) {
    g.rect(x, oy - 2, 8, h - 8, gold.base);
    g.rect(x, oy - 2, 8, 2, gold.light);
  }
  g.rect(ox, oy + h - 10, w, 10, gold.dark);
  g.rect(ox, oy + h - 10, w, 1, gold.light);
  return finish(g, ox, oy);
}

/** Coluna de pedra: base, fuste com luz e sombra, e o capitel. */
function pillar(w: number, h: number, color: number): Piece {
  const tall = 76;
  const { g, ox, oy } = canvas(w, h, tall);
  const stone = ramp(color);
  const cx = ox + Math.floor(w / 2);
  const r = Math.floor(w / 2) - 6;
  g.rect(ox + 2, oy + h - 14, w - 4, 14, stone.dark);
  g.rect(ox + 2, oy + h - 14, w - 4, 3, stone.base);
  g.rect(cx - r, oy + h - 14 - tall, r * 2, tall, stone.base);
  g.rect(cx - r, oy + h - 14 - tall, 3, tall, stone.light);
  g.rect(cx + r - 4, oy + h - 14 - tall, 4, tall, stone.dark);
  for (let x = cx - r + 6; x < cx + r - 5; x += 6) g.rect(x, oy + h - 14 - tall, 1, tall, tone(color, -0.12));
  g.rect(ox, oy + h - 20 - tall, w, 7, stone.light);
  g.rect(ox, oy + h - 14 - tall, w, 2, stone.dark);
  return finish(g, ox, oy);
}

/**
 * Celas: a frente (de leste a oeste) é de grades finas entre os trilhos, que deixam ver o chão;
 * a divisa entre uma cela e outra (de norte a sul) é parede de pedra, com o topo e a ponta à vista.
 */
function bars(w: number, h: number, seed: number): Piece {
  const tall = 38;
  const { g, ox, oy } = canvas(w, h, tall);
  if (w >= h) {
    const bar = 0x8a8c92;
    for (let x = 2; x < w - 1; x += 4) {
      g.rect(ox + x, oy + h - tall, 1, tall, bar);
      g.px(ox + x, oy + h - tall + 2, 0xb8bac0);
    }
    g.rect(ox, oy + h - tall, w, 2, IRON.light);
    g.rect(ox, oy + h - 2, w, 2, IRON.dark);
    for (const x of [0, w - 3]) g.rect(ox + x, oy + h - tall, 3, tall, IRON.base);
    // Sem o contorno de sempre: ele fecharia os vãos entre as barras
    return { grid: g, dx: -ox, dy: -oy };
  }
  const stone = ramp(0x6e685e);
  const rnd = seeded(seed);
  g.rect(ox, oy - tall, w, h, stone.light);
  speckle(g, ox, oy - tall, w, h, stone.light, 0.08, rnd);
  stoneFace(g, ox, oy + h - tall, w, tall, stone.base, rnd);
  g.rect(ox + w - 1, oy - tall, 1, h + tall, stone.dark);
  return finish(g, ox, oy);
}

/**
 * Desenha um móvel no tamanho do pé (x, y, w, h da sala). O canto da grade fica em (dx, dy) do
 * canto do pé. O cavalo do estábulo é uma figura (ver a cena), não uma peça: devolve null.
 */
export function furniturePiece(kind: FurnitureKind, w: number, h: number, color: number, seed = 1): Piece | null {
  const W = Math.max(4, Math.round(w));
  const H = Math.max(4, Math.round(h));
  switch (kind) {
    case "TABLE":
      return table(W, H, color, seed);
    case "BED":
      return bed(W, H, color);
    case "BARREL":
      return barrel(W, H, color);
    case "CRATE":
      return crate(W, H, color);
    case "SACK":
      return sack(W, H, color);
    case "FIRE":
      return hearth(W, H);
    case "ANVIL":
      return anvil(W, H);
    case "ALTAR":
      return altar(W, H, color);
    case "RACK":
      return rack(W, H, color, seed);
    case "SHELF":
      return shelf(W, H, color, seed);
    case "PERCH":
      return perch(W, H, seed);
    case "BENCH":
      return bench(W, H, color);
    case "COUNTER":
      return counter(W, H, color, seed);
    case "CHEST":
      return chest(W, H, color);
    case "BOARD":
      return board(W, H, color, seed);
    case "HAY":
      return hay(W, H, color, seed);
    case "CARPET":
      return carpet(W, H, color);
    case "WATER":
      return water(W, H, color, seed);
    case "BANNER":
      return banner(W, H, color);
    case "IRON":
      return ironBars(W, H, color);
    case "THRONE":
      return throne(W, H, color);
    case "PILLAR":
      return pillar(W, H, color);
    case "BARS":
      return bars(W, H, seed);
    case "HORSE":
      return null;
  }
}

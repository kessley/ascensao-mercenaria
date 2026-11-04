import { CLEAR, Grid, SHADOW, seeded } from "./pixel";

/**
 * Construções em pixel art (G3), feitas por código como as figuras. Vista 3/4: o pé de cada
 * construção (o retângulo da colisão) fica no chão, e o que tem altura sobe na tela — o telhado
 * cobre o pé subido da altura da fachada, e a fachada (o lado sul) fica embaixo dele. Quem passa
 * ao norte de uma casa some atrás do telhado.
 *
 * Cada peça é uma grade de cores e o deslocamento do canto dela em relação ao canto do pé; a
 * ordem de profundidade sai da linha de baixo do pé (ver TownArt).
 */

export type Culture = "REALMS" | "SANDS" | "ISLES" | "JADE";
export type RoofKind = "GABLE" | "FLAT" | "STEEP" | "CURVED";

export interface Piece {
  grid: Grid;
  /** Canto da grade em relação ao canto de cima e da esquerda do pé. */
  dx: number;
  dy: number;
}

export interface Style {
  /** Reboco ou tábuas da parede, vigas e pilares, embasamento. */
  wall: number;
  frame: number;
  base: number;
  /** Pedra da muralha e do castelo, madeira da paliçada e das portas. */
  stone: number;
  wood: number;
  roofs: readonly number[];
  /** Telhados de palha (sem telhas): índices em `roofs`. */
  thatch: readonly number[];
  roof: RoofKind;
  /** Altura da fachada das casas. */
  facade: number;
  glass: number;
  door: number;
  /** Cúpula, telhado do templo ou das torres. */
  accent: number;
}

/** As 4 culturas do planeta: reinos (enxaimel), areias (adobe), ilhas (madeira escura), jade (telhado curvo). */
export const STYLES: Record<Culture, Style> = {
  REALMS: {
    wall: 0xd6c9ad,
    frame: 0x5a3a24,
    base: 0x7d776c,
    stone: 0x8f897d,
    wood: 0x6e4e2e,
    roofs: [0x9a4a2c, 0x7a5232, 0xb0904c, 0x56606c],
    thatch: [2],
    roof: "GABLE",
    facade: 30,
    glass: 0x2c3442,
    door: 0x5a3a20,
    accent: 0x56606c,
  },
  SANDS: {
    wall: 0xd9b987,
    frame: 0x8a643a,
    base: 0xb4925e,
    stone: 0xc9a874,
    wood: 0x8a6a3a,
    roofs: [0xcfae78, 0xc09a62, 0xdcc394, 0xb48a58],
    thatch: [],
    roof: "FLAT",
    facade: 34,
    glass: 0x2a2018,
    door: 0x6a4424,
    accent: 0x3c6c9c,
  },
  ISLES: {
    wall: 0x5e4c3c,
    frame: 0x3a2c22,
    base: 0x6c7276,
    stone: 0x7c858b,
    wood: 0x5a4430,
    roofs: [0x56713c, 0x585d66, 0x6a4a30, 0x8c7c4c],
    thatch: [0, 3],
    roof: "STEEP",
    facade: 24,
    glass: 0x1e2630,
    door: 0x3a2a1c,
    accent: 0x3e3a36,
  },
  JADE: {
    wall: 0xe6ddca,
    frame: 0xa8342a,
    base: 0x8e8a80,
    stone: 0x9a968c,
    wood: 0x7a3a28,
    roofs: [0x3c6c5c, 0x4c5c7a, 0x6c3a2c, 0x5c6c4c],
    thatch: [],
    roof: "CURVED",
    facade: 28,
    glass: 0x3a2a22,
    door: 0xa8342a,
    accent: 0x3c6c5c,
  },
};

/** Margem para o contorno de 1 px. */
export const M = 1;
/** Sombra projetada para a direita e para baixo. */
export const SH = 4;
/** Altura da muralha de pedra, da paliçada e das torres. */
export const WALL_FACE = 46;
const PALISADE_FACE = 34;
export const MERLON = 5;
const TOWER_FACE = 66;

/** Clareia (f > 0) ou escurece (f < 0) uma cor. */
export function tone(c: number, f: number): number {
  const t = Math.min(1, Math.abs(f));
  const to = f > 0 ? 255 : 0;
  const ch = (s: number) => Math.round(((c >> s) & 255) * (1 - t) + to * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function speckle(g: Grid, x: number, y: number, w: number, h: number, color: number, amount: number, rnd: () => number): void {
  const n = Math.round(w * h * amount);
  for (let k = 0; k < n; k++) g.px(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), tone(color, rnd() < 0.5 ? 0.08 : -0.1));
}

/** Face de pedra: fiadas de blocos com juntas desencontradas, borda de cima clara e pé escuro. */
export function stoneFace(g: Grid, x: number, y: number, w: number, h: number, color: number, rnd: () => number): void {
  g.rect(x, y, w, h, color);
  speckle(g, x, y, w, h, color, 0.05, rnd);
  const line = tone(color, -0.22);
  for (let k = 0; k * 6 < h; k++) {
    const j = k * 6 + 5;
    if (j < h) for (let i = 0; i < w; i++) g.px(x + i, y + j, line);
    for (let i = (k % 2) * 6 + 3; i < w; i += 12) for (let d = 0; d < 5 && k * 6 + d < h; d++) g.px(x + i, y + k * 6 + d, line);
  }
  g.rect(x, y, w, 1, tone(color, 0.22));
  if (h > 4) g.rect(x, y + h - 2, w, 2, tone(color, -0.32));
}

/** Lajes do adarve e do topo das torres. */
export function flagstones(g: Grid, x: number, y: number, w: number, h: number, color: number, rnd: () => number): void {
  g.rect(x, y, w, h, color);
  speckle(g, x, y, w, h, color, 0.04, rnd);
  const line = tone(color, -0.14);
  for (let j = 7; j < h; j += 8) for (let i = 0; i < w; i++) g.px(x + i, y + j, line);
  for (let j = 0; j < h; j++) for (let i = ((Math.floor(j / 8) % 2) * 5 + 2) % 10; i < w; i += 10) g.px(x + i, y + j, line);
}

/**
 * Caixa em 3/4: pé (fx, fy, fw, fh) em relação ao ponto (ox, oy) da grade, de z0 até z1 de altura.
 * O topo sobe z1 na tela; a face do sul vai de z0 a z1.
 */
export function prism(ox: number, oy: number, fx: number, fy: number, fw: number, fh: number, z0: number, z1: number, top: (x: number, y: number, w: number, h: number) => void, face: (x: number, y: number, w: number, h: number) => void): void {
  top(ox + fx, oy + fy - z1, fw, fh);
  if (z1 > z0) face(ox + fx, oy + fy + fh - z1, fw, z1 - z0);
}

/** Ameias na borda de um topo de pedra (lados N, S, L e O). */
export function crenels(g: Grid, ox: number, oy: number, fx: number, fy: number, fw: number, fh: number, z: number, color: number, sides: string, rnd: () => number, ruined: boolean, round = false): void {
  const top = (x: number, y: number, w: number, h: number) => {
    g.rect(x, y, w, h, tone(color, 0.22));
    if (round) {
      g.px(x, y, CLEAR);
      g.px(x + w - 1, y, CLEAR);
    }
  };
  const face = (x: number, y: number, w: number, h: number) => {
    g.rect(x, y, w, h, color);
    g.rect(x, y + h - 1, w, 1, tone(color, -0.3));
  };
  const keep = () => !ruined || rnd() > 0.35;
  for (let i = 2; i + 6 <= fw - 1; i += 10) {
    if (sides.includes("N") && keep()) prism(ox, oy, fx + i, fy, 6, 3, z, z + MERLON, top, face);
    if (sides.includes("S") && keep()) prism(ox, oy, fx + i, fy + fh - 3, 6, 3, z, z + MERLON, top, face);
  }
  for (let j = 4; j + 6 <= fh - 3; j += 10) {
    if (sides.includes("W") && keep()) prism(ox, oy, fx, fy + j, 3, 6, z, z + MERLON, top, face);
    if (sides.includes("E") && keep()) prism(ox, oy, fx + fw - 3, fy + j, 3, 6, z, z + MERLON, top, face);
  }
}

/** Telhado de duas águas com a cumeeira na horizontal: a água de trás, curta e na sombra, e a da frente. */
export function roofEW(g: Grid, x: number, y: number, w: number, h: number, color: number, kind: RoofKind, thatch: boolean, rnd: () => number): number {
  const ridge = Math.max(3, Math.round(h * (kind === "STEEP" ? 0.42 : 0.34)));
  const back = tone(color, -0.3);
  g.rect(x, y, w, ridge, back);
  const band = (h - ridge) / 3;
  for (let j = ridge; j < h; j++) {
    const k = (j - ridge) / band;
    const f = k < 1 ? 0.1 : k < 2 ? 0 : -0.1;
    for (let i = 0; i < w; i++) {
      // Passagem pontilhada entre as faixas
      const near = k % 1 < 0.25 && k >= 1 && (i + j) % 2 === 0;
      g.px(x + i, y + j, tone(color, near ? f + 0.1 : f));
    }
  }
  if (thatch) {
    // Palha: fios na vertical, mais escuros embaixo, e a beira desfiada
    for (let i = 0; i < w; i++) {
      for (let j = ridge; j < h; j++) if (rnd() < 0.22) g.px(x + i, y + j, tone(color, rnd() < 0.6 ? -0.14 : 0.1));
      for (let j = 0; j < ridge; j++) if (rnd() < 0.2) g.px(x + i, y + j, tone(back, -0.12));
      if (rnd() < 0.5) g.px(x + i, y + h, tone(color, -0.25));
    }
    for (let j = ridge + 6; j < h - 2; j += 7) for (let i = 0; i < w; i++) if (rnd() < 0.7) g.px(x + i, y + j, tone(color, -0.2));
  } else if (kind === "CURVED") {
    // Telhas em canal: colunas descendo a água, com o beiral virado nas pontas
    for (let i = 1; i < w - 1; i += 4) for (let j = ridge + 1; j < h - 1; j++) g.px(x + i, y + j, tone(color, -0.2));
    for (let i = 2; i < w - 1; i += 4) for (let j = ridge + 1; j < h - 1; j++) g.px(x + i, y + j, tone(color, 0.08));
    for (let j = ridge + 7; j < h - 2; j += 7) for (let i = 0; i < w; i++) g.px(x + i, y + j, tone(color, -0.12));
    for (let i = 0; i < w; i += 3) for (let j = 1; j < ridge - 1; j += 2) g.px(x + i, y + j, tone(back, -0.14));
  } else {
    // Telhas (ou telhas de pedra nas ilhas) em fiadas, com as juntas desencontradas
    const step = kind === "STEEP" ? 4 : 5;
    for (let j = ridge + 3, k = 0; j < h - 2; j += step, k++) {
      for (let i = 0; i < w; i++) g.px(x + i, y + j, tone(color, -0.2));
      for (let i = (k % 2) * 3; i < w; i += 6) for (let d = 1; d < step; d++) g.px(x + i, y + j - d, tone(color, -0.1));
    }
    for (let j = 2; j < ridge - 1; j += 3) for (let i = 0; i < w; i++) g.px(x + i, y + j, tone(back, -0.15));
  }
  // Cumeeira, beirais e lados
  g.rect(x, y + ridge - 1, w, 2, tone(color, 0.28));
  g.rect(x, y, w, 1, tone(back, 0.12));
  g.rect(x, y + h - 2, w, 1, tone(color, 0.16));
  g.rect(x, y + h - 1, w, 1, tone(color, -0.3));
  g.rect(x, y + ridge, 1, h - ridge, tone(color, 0.12));
  g.rect(x + w - 1, y, 1, h, tone(color, -0.25));
  if (kind === "CURVED") {
    // Beiral curvo: a linha de baixo sobe perto das pontas (o que sobra vira transparente)
    for (let i = 0; i < w; i++) {
      const u = Math.abs((i + 0.5 - w / 2) / (w / 2));
      const up = Math.round(4 * u ** 4);
      for (let d = 0; d < up; d++) g.px(x + i, y + h - 1 - d, CLEAR);
      if (up > 0) {
        g.px(x + i, y + h - 1 - up, tone(color, -0.3));
        g.px(x + i, y + h - 2 - up, tone(color, 0.16));
      }
      const rup = Math.round(3 * u ** 4);
      for (let d = 1; d <= rup; d++) g.px(x + i, y + ridge - 1 - d, tone(color, 0.28));
    }
    // Pontas do beiral e da cumeeira viradas para cima
    for (const [px, dir] of [[x, -1], [x + w - 1, 1]] as const) {
      g.px(px + dir, y + h - 3, tone(color, 0.1));
      g.px(px + dir * 2, y + h - 4, tone(color, 0.1));
      g.px(px + dir, y + h - 2, tone(color, -0.3));
      g.px(px + dir * 2, y + h - 3, tone(color, -0.3));
      g.px(px, y + ridge - 2, tone(color, 0.28));
      g.px(px + dir, y + ridge - 3, tone(color, 0.28));
    }
  }
  if (kind === "STEEP") {
    // Cabeças de dragão cruzadas nas pontas da cumeeira
    for (const px of [x + 1, x + w - 2]) {
      g.px(px - 1, y + ridge - 3, tone(color, -0.35));
      g.px(px + 1, y + ridge - 3, tone(color, -0.35));
      g.px(px, y + ridge - 2, tone(color, -0.35));
    }
  }
  return ridge;
}

/** Terraço das areias: chão de barro com mureta, alçapão e jarras. */
export function flatRoof(g: Grid, x: number, y: number, w: number, h: number, color: number, rnd: () => number): void {
  g.rect(x, y, w, h, color);
  speckle(g, x, y, w, h, color, 0.05, rnd);
  const wall = tone(color, 0.14);
  g.rect(x, y, w, 3, wall);
  g.rect(x, y, 3, h, wall);
  g.rect(x + w - 3, y, 3, h, tone(color, -0.08));
  g.rect(x, y + h - 4, w, 3, wall);
  g.rect(x, y, w, 1, tone(color, 0.3));
  g.rect(x + 3, y + 3, w - 6, 2, tone(color, -0.2));
  g.rect(x + 3, y + 3, 2, h - 7, tone(color, -0.14));
  g.rect(x, y + h - 1, w, 1, tone(color, -0.3));
  if (w > 30 && h > 24) {
    const hx = x + 6 + Math.floor(rnd() * (w - 20));
    const hy = y + 6 + Math.floor(rnd() * (h - 18));
    g.rect(hx, hy, 8, 6, tone(color, -0.42));
    g.rect(hx, hy, 8, 1, tone(color, 0.25));
    for (let k = 0; k < 3; k++) {
      const jx = x + 5 + Math.floor(rnd() * (w - 10));
      const jy = y + 6 + Math.floor(rnd() * (h - 14));
      g.oval(jx, jy, 1, 1, 0xa0583a);
      g.px(jx, jy - 1, 0xc87a52);
    }
    if (rnd() < 0.4) {
      // Tapete secando no terraço
      const cx = x + 4 + Math.floor(rnd() * (w - 24));
      const cy = y + 5 + Math.floor(rnd() * (h - 16));
      const cc = [0xa8342a, 0x3c6c9c, 0x6a8a3a][Math.floor(rnd() * 3)];
      g.rect(cx, cy, 16, 8, cc);
      for (let i = 0; i < 16; i += 4) g.rect(cx + i, cy, 2, 8, tone(cc, 0.3));
    }
  }
}

const facadeWall = (st: Style, ruined: boolean) => (ruined ? tone(st.wall, -0.4) : st.wall);

/** Fachada do lado sul: parede da cultura, janelas, porta (se for deste lado) e embasamento. */
export function facade(g: Grid, x: number, y: number, w: number, h: number, st: Style, culture: Culture, doorX: number | null, rnd: () => number, ruined: boolean): void {
  const wall = ruined ? tone(st.wall, -0.4) : st.wall;
  const frame = ruined ? tone(st.frame, -0.3) : st.frame;
  g.rect(x, y, w, h, wall);
  const windows: number[] = [];
  const n = Math.max(1, Math.floor((w - 8) / 26));
  for (let k = 0; k < n; k++) {
    const cx = x + Math.round(((k + 0.5) * w) / n);
    if (doorX !== null && Math.abs(cx - doorX) < 14) continue;
    windows.push(cx);
  }
  switch (culture) {
    case "REALMS": {
      speckle(g, x, y, w, h, wall, 0.03, rnd);
      g.rect(x, y + 1, w, 2, frame);
      g.rect(x, y + h - 5, w, 2, frame);
      const posts = [x, x + w - 2];
      for (let px = x + 12; px < x + w - 8; px += 12) posts.push(px);
      for (const px of posts) g.rect(px, y + 1, 2, h - 4, frame);
      // Mãos-francesas nos vãos sem janela
      for (let k = 0; k + 1 < posts.length; k++) {
        const a = Math.min(posts[k], posts[k + 1]) + 2;
        const b = Math.max(posts[k], posts[k + 1]) - 1;
        if (b - a < 6 || windows.some((c) => c > a - 4 && c < b + 4) || (doorX !== null && doorX > a - 6 && doorX < b + 6)) continue;
        g.line(a, y + h - 6, b, y + 3, frame);
      }
      break;
    }
    case "ISLES":
      for (let px = x + 2; px < x + w; px += 4) g.rect(px, y, 1, h - 3, tone(wall, -0.22));
      speckle(g, x, y, w, h, wall, 0.04, rnd);
      g.rect(x, y, 2, h, frame);
      g.rect(x + w - 2, y, 2, h, frame);
      g.rect(x, y + 1, w, 1, frame);
      break;
    case "JADE":
      g.rect(x, y + 1, w, 2, frame);
      for (let px = x; px < x + w - 2; px += 24) {
        g.rect(px, y + 1, 3, h - 4, frame);
        g.rect(px, y + 1, 1, h - 4, tone(frame, 0.25));
      }
      g.rect(x + w - 3, y + 1, 3, h - 4, frame);
      break;
    case "SANDS":
      speckle(g, x, y, w, h, wall, 0.06, rnd);
      // Pontas das vigas saindo debaixo do terraço
      for (let px = x + 4; px < x + w - 3; px += 10) g.rect(px, y + 3, 2, 2, frame);
      break;
  }
  // Embasamento de pedra
  g.rect(x, y + h - 3, w, 3, st.base);
  g.rect(x, y + h - 3, w, 1, tone(st.base, 0.2));
  // Janelas
  const wy = y + Math.max(5, Math.round(h * 0.28));
  const wh = culture === "ISLES" ? 6 : 8;
  for (const cx of windows) {
    const ww = culture === "ISLES" ? 5 : 7;
    const wx = cx - Math.floor(ww / 2);
    g.rect(wx - 1, wy - 1, ww + 2, wh + 2, tone(wall, culture === "ISLES" ? 0.2 : -0.18));
    g.rect(wx, wy, ww, wh, ruined ? 0x16120e : st.glass);
    if (culture === "JADE") {
      for (let i = 1; i < ww; i += 2) g.rect(wx + i, wy, 1, wh, tone(st.wall, -0.1));
      for (let j = 1; j < wh; j += 2) g.rect(wx, wy + j, ww, 1, tone(st.wall, -0.1));
    } else if (culture === "SANDS") {
      g.px(wx, wy, wall);
      g.px(wx + ww - 1, wy, wall);
      g.rect(wx - 1, wy + wh + 1, ww + 2, 1, tone(wall, 0.2));
    } else {
      g.rect(wx + Math.floor(ww / 2), wy, 1, wh, tone(st.glass, 0.3));
      g.rect(wx, wy + Math.floor(wh / 2), ww, 1, tone(st.glass, 0.3));
      g.px(wx + 1, wy + 1, tone(st.glass, 0.5));
      if (culture === "REALMS" && !ruined) {
        g.rect(wx - 3, wy, 2, wh, tone(st.roofs[0], -0.1));
        g.rect(wx + ww + 1, wy, 2, wh, tone(st.roofs[0], -0.1));
      }
    }
  }
  // Porta
  if (doorX !== null) {
    const dw = 10;
    const dh = Math.min(h - 6, 17);
    const dx = doorX - dw / 2;
    const dy = y + h - dh;
    g.rect(dx - 1, dy - 1, dw + 2, dh + 1, culture === "SANDS" ? tone(wall, -0.2) : frame);
    const door = ruined ? 0x16120e : st.door;
    g.rect(dx, dy, dw, dh, door);
    if (!ruined) {
      for (let i = 2; i < dw; i += 3) g.rect(dx + i, dy, 1, dh, tone(door, -0.2));
      g.px(dx + dw - 3, dy + Math.floor(dh / 2), culture === "JADE" ? 0xe0b040 : tone(door, 0.5));
    }
    if (culture === "SANDS") {
      g.px(dx, dy, wall);
      g.px(dx + dw - 1, dy, wall);
      g.px(dx + 1, dy, wall);
      g.px(dx + dw - 2, dy, wall);
    }
    // Degrau de pedra
    g.rect(dx - 2, y + h - 1, dw + 4, 1, tone(st.base, 0.3));
  }
}

/** Sombra no chão à direita e embaixo de tudo o que foi desenhado (depois do contorno). */
export function dropShadow(g: Grid, fromRow: number): void {
  const marks: number[] = [];
  for (let y = fromRow; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== CLEAR) continue;
      for (let k = 1; k <= SH; k++) {
        const c = g.get(x - k, y - Math.min(k, 3));
        if (c !== CLEAR && c !== SHADOW) {
          marks.push(y * g.w + x);
          break;
        }
      }
    }
  }
  for (const i of marks) g.data[i] = SHADOW;
}

/** Buracos queimados num telhado em ruínas, com as vigas à mostra. */
function holes(g: Grid, x: number, y: number, w: number, h: number, frame: number, rnd: () => number): void {
  const n = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const cx = x + 8 + Math.floor(rnd() * Math.max(1, w - 16));
    const cy = y + 6 + Math.floor(rnd() * Math.max(1, h - 12));
    const rx = 4 + Math.floor(rnd() * 8);
    const ry = 3 + Math.floor(rnd() * 5);
    g.oval(cx, cy, rx, ry, 0x1c1714);
    for (let i = -rx; i <= rx; i += 4) g.line(cx + i, cy - ry, cx + i + 2, cy + ry, tone(frame, -0.4));
  }
}

/**
 * Casa: pé de `w`×`h`, porta na fachada do sul (`doorX` a partir da esquerda do pé) ou do lado
 * de trás (`null`: não aparece). `turret` põe um campanário na cumeeira (Casa do Conselho).
 * `sign`: cor da placa (taverna, Casa dos Mercadores), ao lado da porta; com a porta atrás, a
 * placa fica pendurada na beira de trás do telhado, em `backDoorX`.
 */
export function housePiece(
  w: number,
  h: number,
  culture: Culture,
  roofIndex: number,
  doorX: number | null,
  seed: number,
  ruined: boolean,
  turret = false,
  sign: number | null = null,
  backDoorX: number | null = null,
): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const kind = st.roof;
  const ov = kind === "FLAT" ? 0 : kind === "CURVED" ? 4 : 3;
  const lift = kind === "STEEP" ? 12 : kind === "CURVED" ? 4 : 0;
  const top = turret ? 16 : 0;
  const H = st.facade;
  const g = new Grid(M + ov + w + ov + SH + M + 2, M + top + lift + h + H + SH + M);
  const ox = M + ov;
  const fy = M + top + lift + h;
  facade(g, ox, fy, w, H, st, culture, doorX === null ? null : ox + doorX, rnd, ruined);
  const ri = roofIndex % st.roofs.length;
  const color = ruined ? tone(st.roofs[ri], -0.45) : st.roofs[ri];
  const ry = M + top;
  let ridge = 0;
  if (kind === "FLAT") flatRoof(g, ox, ry, w, lift + h + 1, color, rnd);
  else ridge = roofEW(g, M, ry, w + ov * 2, lift + h + 2, color, kind, st.thatch.includes(ri), rnd);
  if ((kind === "GABLE" || kind === "STEEP") && w >= 130 && !ruined && rnd() < 0.7) {
    // Mansarda: janelinha com o próprio telhadinho na água da frente
    const mx = ox + 12 + Math.floor(rnd() * (w - 40));
    const my = ry + ridge + Math.round((lift + h - ridge) * 0.35);
    g.rect(mx, my, 14, 10, facadeWall(st, ruined));
    g.rect(mx + 4, my + 3, 6, 6, st.glass);
    g.rect(mx + 7, my + 3, 1, 6, tone(st.glass, 0.3));
    for (let r = 0; r < 6; r++) g.rect(mx - 2 + r, my - 6 + r, 18 - r * 2, 1, r === 0 ? tone(color, 0.25) : color);
    g.rect(mx - 2, my, 18, 1, tone(color, -0.3));
  }
  if (kind === "FLAT" && w >= 100 && rnd() < 0.55) {
    // Quartinho no terraço, com porta e janela, recuado do beiral
    const qw = Math.round(w * (0.35 + rnd() * 0.15));
    const qx = Math.floor(rnd() * (w - qw - 8)) + 4;
    const qy = 6;
    const qh = Math.round(h * 0.4);
    prism(ox, ry, qx, qy, qw, qh, 0, 18, (xx, yy, ww, hh) => flatRoof(g, xx, yy, ww, hh, tone(color, 0.08), rnd), (xx, yy, ww, hh) => {
      g.rect(xx, yy, ww, hh, facadeWall(st, ruined));
      g.rect(xx + 4, yy + 5, 5, 7, st.glass);
      g.px(xx + 4, yy + 5, facadeWall(st, ruined));
      g.px(xx + 8, yy + 5, facadeWall(st, ruined));
      g.rect(xx + ww - 12, yy + 6, 7, 12, st.door);
      g.px(xx + ww - 12, yy + 6, facadeWall(st, ruined));
      g.px(xx + ww - 6, yy + 6, facadeWall(st, ruined));
    });
  }
  // Chaminé na água de trás
  if ((culture === "REALMS" || culture === "ISLES") && rnd() < 0.6 && !ruined) {
    // Nas casas grandes (as da Cidade Alta) a chaminé não passa de 16 px: virava um poste
    const cx = ox + 6 + Math.floor(rnd() * Math.max(1, w - 18));
    const ch = Math.min(ridge + 4, 16);
    const cy = ry + ridge + 1 - ch;
    g.rect(cx, cy, 6, ch, st.base);
    g.rect(cx, cy, 6, 2, tone(st.base, 0.25));
    g.rect(cx + 1, cy, 4, 1, 0x1c1714);
    g.rect(cx + 5, cy + 2, 1, ch - 2, tone(st.base, -0.25));
  }
  if (turret && !ruined) {
    // Campanário: torrinha no meio da cumeeira com o sino
    const tx = ox + Math.floor(w / 2) - 6;
    const tw = 12;
    const ty = ry + ridge - 18;
    g.rect(tx, ty + 6, tw, 14, st.frame);
    g.rect(tx + 3, ty + 9, tw - 6, 7, 0x1c1714);
    g.oval(tx + tw / 2, ty + 13, 2, 2, 0xd0a040);
    for (let r = 0; r < 7; r++) g.rect(tx - 1 + Math.floor(r / 2), ty + r, tw + 2 - Math.floor(r / 2) * 2, 1, r < 3 ? tone(color, 0.15) : color);
  }
  if (ruined) holes(g, ox, ry + ridge, w, lift + h - ridge, st.frame, rnd);
  if (sign !== null) {
    // Placa: tábua escura com a cor da casa, presa num braço de ferro
    const sx = doorX !== null ? ox + doorX + 8 : ox + (backDoorX ?? Math.floor(w / 2)) + 6;
    const sy = doorX !== null ? fy + 6 : ry - 2;
    g.rect(sx - 1, sy - 2, 12, 1, 0x3a3a40);
    g.rect(sx, sy, 10, 8, 0x2a1c10);
    g.rect(sx + 1, sy + 1, 8, 6, sign);
    g.rect(sx + 3, sy + 3, 4, 2, tone(sign, -0.4));
  }
  // Sombra do beiral na fachada
  if (kind !== "FLAT") for (let i = ox; i < ox + w; i++) g.px(i, fy + 2, tone(g.get(i, fy + 2), -0.3));
  g.outline();
  dropShadow(g, fy);
  return { grid: g, dx: -ox, dy: -(M + top + lift + H) };
}

/**
 * Salão com a cumeeira de norte a sul (templo das ilhas e dos reinos): as duas águas, a empena
 * triangular na frente e a fachada embaixo. Pé em (fx, fy, fw, fh) a partir de (ox, oy).
 */
export function gableHall(g: Grid, ox: number, oy: number, fx: number, fy: number, fw: number, fh: number, H: number, gt: number, st: Style, culture: Culture, color: number, doorX: number | null, rnd: () => number, ruined: boolean): void {
  facade(g, ox + fx, oy + fy + fh - H, fw, H, st, culture, doorX === null ? null : ox + fx + doorX, rnd, ruined);
  const c = fw / 2;
  const lit = tone(color, 0.06);
  const dark = tone(color, -0.28);
  const gable = ruined ? tone(st.wall, -0.4) : culture === "ISLES" ? st.wall : tone(st.wall, -0.04);
  for (let i = 0; i < fw; i++) {
    const d = Math.abs(i + 0.5 - c) / c;
    const lift = Math.round(gt * (1 - d));
    const top = oy + fy - H - lift;
    const front = oy + fy + fh - H - lift;
    const left = i + 0.5 < c;
    for (let j = top; j < front; j++) g.px(ox + fx + i, j, i % 5 === 0 || (j - top) % 6 === 5 ? tone(left ? lit : dark, -0.14) : left ? lit : dark);
    for (let j = front; j < oy + fy + fh - H; j++) g.px(ox + fx + i, j, gable);
    // Testeira da empena e a cumeeira
    g.px(ox + fx + i, front, st.frame);
    g.px(ox + fx + i, front - 1, tone(color, 0.25));
    if (Math.abs(i + 0.5 - c) < 1) for (let j = top; j < front; j++) g.px(ox + fx + i, j, tone(color, 0.3));
  }
  // Rosácea (ou janelinha redonda) na empena
  if (gt > 14) {
    const rx = ox + fx + Math.floor(c);
    const ryy = oy + fy + fh - H - Math.round(gt * 0.45);
    g.oval(rx, ryy, 3, 3, st.frame);
    g.oval(rx, ryy, 2, 2, ruined ? 0x16120e : culture === "REALMS" ? 0x7a5aa8 : st.glass);
  }
}

/** Cúpula: meia elipse sobre a linha `base`, luz à esquerda e um remate no alto. */
export function dome(g: Grid, cx: number, base: number, rx: number, ry: number, color: number): void {
  for (let i = -rx; i <= rx; i++) {
    const hgt = Math.round(ry * Math.sqrt(Math.max(0, 1 - (i / (rx + 0.5)) ** 2)));
    const c = i < -rx * 0.35 ? tone(color, 0.2) : i > rx * 0.4 ? tone(color, -0.25) : color;
    for (let j = 0; j <= hgt; j++) g.px(cx + i, base - j, c);
  }
  g.oval(cx - Math.round(rx * 0.4), base - Math.round(ry * 0.6), 1, 1, tone(color, 0.5));
  g.rect(cx - rx, base, rx * 2 + 1, 1, tone(color, -0.35));
  g.rect(cx, base - ry - 5, 1, 5, 0xd0a040);
  g.oval(cx, base - ry - 6, 1, 1, 0xe0c060);
}

/** Pirâmide de telhado sobre um topo (torres das ilhas e de jade, campanário dos reinos). */
export function pyramid(g: Grid, x: number, y: number, w: number, rise: number, color: number, curved: boolean): void {
  const c = w / 2;
  for (let r = 0; r <= rise; r++) {
    const f = curved ? Math.pow(r / rise, 1.7) : r / rise;
    const half = Math.max(1, Math.round(c * f));
    for (let i = -half; i < half; i++) g.px(x + Math.round(c) + i, y + r, i < 0 ? color : tone(color, -0.28));
  }
  if (curved) {
    g.px(x - 1, y + rise - 1, color);
    g.px(x + w, y + rise - 1, tone(color, -0.28));
  }
  g.rect(x + Math.round(c), y - 4, 1, 4, 0xd0a040);
}

/** Templo: igreja com torre (reinos), salão com cúpula e minarete (areias), igreja de madeira (ilhas) ou pagode (jade). */
export function templePiece(w: number, h: number, culture: Culture, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const lift = 150;
  const g = new Grid(M + w + SH + M + 8, M + lift + h + SH + M);
  const ox = M + 4;
  const oy = M + lift;
  const roof = ruined ? tone(st.accent, -0.45) : st.accent;
  const doorX = w / 2;
  if (culture === "REALMS" || culture === "ISLES") {
    const nw = Math.round(w * 0.64);
    const nx = Math.round((w - nw) / 2);
    const H = culture === "ISLES" ? 30 : 38;
    gableHall(g, ox, oy, nx, 10, nw, h - 30, H, culture === "ISLES" ? 52 : 40, st, culture, roof, null, rnd, ruined);
    const tw = Math.round(w * 0.24);
    const tx = Math.round((w - tw) / 2);
    const th = 40;
    const z = culture === "ISLES" ? 64 : 92;
    const color = culture === "ISLES" ? st.wood : st.stone;
    prism(
      ox,
      oy,
      tx,
      h - th,
      tw,
      th,
      0,
      z,
      (x, y, ww, hh) => g.rect(x, y, ww, hh, tone(color, 0.1)),
      (x, y, ww, hh) => {
        if (culture === "ISLES") {
          g.rect(x, y, ww, hh, color);
          for (let px = x + 2; px < x + ww; px += 4) g.rect(px, y, 1, hh, tone(color, -0.22));
        } else stoneFace(g, x, y, ww, hh, color, rnd);
        g.rect(x + Math.floor(ww / 2) - 3, y + 10, 6, 10, 0x1c1714);
        g.px(x + Math.floor(ww / 2) - 3, y + 10, color);
        g.px(x + Math.floor(ww / 2) + 2, y + 10, color);
        if (!ruined) g.oval(x + Math.floor(ww / 2), y + 16, 2, 2, 0xd0a040);
        // Porta do templo no pé da torre
        const dx = ox + doorX - 6;
        g.rect(dx - 1, y + hh - 21, 14, 21, st.frame);
        g.rect(dx, y + hh - 20, 12, 20, ruined ? 0x16120e : st.door);
        g.px(dx, y + hh - 20, st.frame);
        g.px(dx + 11, y + hh - 20, st.frame);
      },
    );
    if (!ruined) pyramid(g, ox + tx - 2, oy + h - th - z - (culture === "ISLES" ? 30 : 46), tw + 4, culture === "ISLES" ? 30 : 46, roof, false);
  } else if (culture === "SANDS") {
    const H = 42;
    const fx = 8;
    const fwid = w - 16;
    const fyy = 30;
    const fh = h - fyy;
    prism(
      ox,
      oy,
      fx,
      fyy,
      fwid,
      fh,
      0,
      H,
      (x, y, ww, hh) => flatRoof(g, x, y, ww, hh, st.roofs[0], rnd),
      (x, y, ww, hh) => facade(g, x, y, ww, hh, st, culture, ox + doorX, rnd, ruined),
    );
    if (!ruined) dome(g, ox + Math.round(w / 2), oy + fyy + Math.round(fh * 0.62) - H, Math.round(fwid * 0.3), Math.round(fwid * 0.26), roof);
    // Minarete no canto da frente, à esquerda
    const mz = 118;
    prism(
      ox,
      oy,
      0,
      h - 26,
      24,
      24,
      0,
      mz,
      (x, y, ww, hh) => g.rect(x, y, ww, hh, tone(st.wall, 0.12)),
      (x, y, ww, hh) => {
        g.rect(x, y, ww, hh, st.wall);
        g.rect(x + ww - 4, y, 4, hh, tone(st.wall, -0.18));
        g.rect(x, y + 16, ww, 3, st.frame);
        g.rect(x + 9, y + 26, 5, 8, 0x1c1714);
      },
    );
    if (!ruined) dome(g, ox + 12, oy + h - 26 - mz + 6, 9, 9, roof);
  } else {
    // Pagode: salão de pilares vermelhos e dois telhados curvos, o de cima menor
    const H = 34;
    const fyy = 24;
    const fh = h - fyy - 10;
    facade(g, ox + 10, oy + fyy + fh - H, w - 20, H, st, culture, ox + doorX, rnd, ruined);
    roofEW(g, ox + 4, oy + fyy - H, w - 8, fh + 2, roof, "CURVED", false, rnd);
    const uw = Math.round(w * 0.56);
    const ux = Math.round((w - uw) / 2);
    g.rect(ox + ux + 6, oy + fyy - H - 26, uw - 12, 26, st.frame);
    for (let px = ox + ux + 10; px < ox + ux + uw - 10; px += 8) g.rect(px, oy + fyy - H - 20, 4, 12, st.glass);
    roofEW(g, ox + ux, oy + fyy - H - 54, uw, Math.round(fh * 0.5), roof, "CURVED", false, rnd);
    // Escadaria na frente
    for (let k = 0; k < 3; k++) g.rect(ox + doorX - 14 + k * 2, oy + h - 10 + k * 3, 28 - k * 4, 3, tone(st.base, 0.15 - k * 0.05));
  }
  if (ruined) holes(g, ox, oy - 60, w, 80, st.frame, rnd);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/**
 * Castelo (paço das cidades e das fortalezas): muralha em volta de um pátio, torres nos cantos
 * e a torre de menagem no fundo. `doorX`: o portão, na muralha da frente.
 */
export function keepPiece(w: number, h: number, culture: Culture, doorX: number, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const stone = ruined ? tone(st.stone, -0.3) : st.stone;
  const F = 40;
  const ct = 16;
  const ts = Math.max(34, Math.min(56, Math.round(Math.min(w, h) * 0.16)));
  const FT = 58;
  const dw = Math.round(w * 0.42);
  const dh = Math.round(h * 0.36);
  const djx = Math.round((w - dw) / 2);
  const djy = Math.round(h * 0.12);
  const FD = 80;
  const roofed = culture === "ISLES" || culture === "JADE";
  const lift = Math.max(FT, FD - djy, F) + MERLON + 4 + (roofed ? 34 : 0) + (culture === "SANDS" ? 30 : 0);
  const g = new Grid(M + w + SH + M + 4, M + lift + h + SH + M);
  const ox = M + 2;
  const oy = M + lift;
  const top = (c: number) => (x: number, y: number, ww: number, hh: number) => flagstones(g, x, y, ww, hh, tone(c, 0.12), rnd);
  const face = (c: number, slits = true) => (x: number, y: number, ww: number, hh: number) => {
    stoneFace(g, x, y, ww, hh, c, rnd);
    if (slits) for (let px = x + 10; px < x + ww - 6; px += 22) g.rect(px, y + Math.floor(hh * 0.35), 2, 6, 0x1c1714);
  };
  const round = culture === "SANDS";
  const tower = (fx: number, fy: number) => {
    prism(ox, oy, fx, fy, ts, ts, 0, FT, top(stone), face(stone));
    if (roofed && !ruined) pyramid(g, ox + fx - 3, oy + fy - FT - 30, ts + 6, 30 + Math.round(ts / 2), st.accent, culture === "JADE");
    else crenels(g, ox, oy, fx, fy, ts, ts, FT, stone, "NSEW", rnd, ruined, round);
  };
  // Pátio de terra batida
  g.rect(ox + ct, oy + ct, w - ct * 2, h - ct * 2, ruined ? 0x4a4236 : 0x8a7a58);
  speckle(g, ox + ct, oy + ct, w - ct * 2, h - ct * 2, 0x8a7a58, 0.06, rnd);
  // Muralha de trás e dos lados
  prism(ox, oy, 0, 0, w, ct, 0, F, top(stone), face(tone(stone, -0.08), false));
  crenels(g, ox, oy, 0, 0, w, ct, F, stone, "N", rnd, ruined, round);
  prism(ox, oy, 0, 0, ct, h, 0, F, top(stone), () => undefined);
  prism(ox, oy, w - ct, 0, ct, h, 0, F, top(stone), () => undefined);
  crenels(g, ox, oy, 0, 0, ct, h, F, stone, "W", rnd, ruined, round);
  crenels(g, ox, oy, w - ct, 0, ct, h, F, stone, "E", rnd, ruined, round);
  tower(0, 0);
  tower(w - ts, 0);
  // Torre de menagem
  prism(ox, oy, djx, djy, dw, dh, 0, FD, top(stone), (x, y, ww, hh) => {
    stoneFace(g, x, y, ww, hh, stone, rnd);
    for (let px = x + 12; px < x + ww - 10; px += 20) {
      g.rect(px, y + 14, 5, 9, 0x1c1714);
      g.px(px, y + 14, stone);
      g.px(px + 4, y + 14, stone);
      g.rect(px, y + 40, 5, 9, 0x1c1714);
    }
  });
  if (culture === "SANDS" && !ruined) dome(g, ox + djx + Math.round(dw / 2), oy + djy + Math.round(dh * 0.55) - FD, Math.round(dw * 0.28), Math.round(dw * 0.22), st.accent);
  else if (roofed && !ruined) roofEW(g, ox + djx - 4, oy + djy - FD - 26, dw + 8, dh + 26, st.accent, culture === "JADE" ? "CURVED" : "STEEP", false, rnd);
  else crenels(g, ox, oy, djx, djy, dw, dh, FD, stone, "NSEW", rnd, ruined, round);
  // Muralha da frente com o portão
  prism(ox, oy, 0, h - ct, w, ct, 0, F, top(stone), (x, y, ww, hh) => {
    face(stone)(x, y, ww, hh);
    const gx = ox + doorX - 12;
    g.rect(gx - 2, y + hh - 28, 28, 28, tone(stone, -0.3));
    g.rect(gx, y + hh - 26, 24, 26, 0x1c1714);
    for (let px = gx + 2; px < gx + 24; px += 4) g.rect(px, y + hh - 26, 1, 14, 0x6a6a70);
    g.rect(gx, y + hh - 13, 24, 1, 0x6a6a70);
    for (const c of [0, 1, 22, 23]) g.px(gx + c, y + hh - 26, tone(stone, -0.3));
  });
  crenels(g, ox, oy, 0, h - ct, w, ct, F, stone, "S", rnd, ruined, round);
  tower(0, h - ts);
  tower(w - ts, h - ts);
  if (ruined) holes(g, ox + djx, oy + djy - FD, dw, dh, st.frame, rnd);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/**
 * Trecho de muralha na horizontal (lado N ou S): adarve com ameias do lado de fora e a face
 * do sul. Paliçada: a fileira de troncos com a base na linha de baixo do pé.
 */
export function wallPieceEW(len: number, t: number, side: "N" | "S", stone: boolean, culture: Culture, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  if (!stone) return palisadeRow(len, t, st, rnd, ruined);
  const color = ruined ? tone(st.stone, -0.3) : st.stone;
  const F = WALL_FACE;
  const lift = F + MERLON + 3;
  const g = new Grid(M + len + SH + M, M + lift + t + SH + M);
  const oy = M + lift;
  prism(M, oy, 0, 0, len, t, 0, F, (x, y, w, h) => flagstones(g, x, y, w, h, tone(color, 0.12), rnd), (x, y, w, h) => {
    stoneFace(g, x, y, w, h, color, rnd);
    if (side === "S") for (let px = x + 18; px < x + w - 6; px += 40) g.rect(px, y + 14, 2, 7, 0x1c1714);
  });
  crenels(g, M, oy, 0, 0, len, t, F, color, side, rnd, ruined, culture === "SANDS");
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -M, dy: -oy };
}

/** Trecho de muralha na vertical (lado L ou O), em pedaços curtos para a profundidade sair certa. */
export function wallPieceNS(len: number, t: number, side: "E" | "W", stone: boolean, culture: Culture, withFace: boolean, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  if (!stone) return palisadeColumn(len, t, st, withFace, rnd, ruined);
  const color = ruined ? tone(st.stone, -0.3) : st.stone;
  const F = WALL_FACE;
  const lift = F + MERLON + 3;
  const g = new Grid(M + t + SH + M + 2, M + lift + len + (withFace ? 0 : -F) + F + SH + M);
  const oy = M + lift;
  flagstones(g, M, oy - F, t, len, tone(color, 0.12), rnd);
  // Sombra da muralha alta no lado de dentro da face (dá o volume que o topo sozinho não dá)
  g.rect(M + (side === "W" ? t - 2 : 0), oy - F, 2, len, tone(color, -0.18));
  if (withFace) stoneFace(g, M, oy + len - F, t, F, color, rnd);
  crenels(g, M, oy, 0, 0, t, len + 3, F, color, side, rnd, ruined, culture === "SANDS");
  g.outline();
  dropShadow(g, oy - F);
  return { grid: g, dx: -M, dy: -oy };
}

export function log(g: Grid, x: number, y0: number, y1: number, color: number): void {
  g.rect(x, y0 + 2, 6, y1 - y0 - 2, color);
  g.rect(x, y0 + 2, 1, y1 - y0 - 2, tone(color, 0.2));
  g.rect(x + 5, y0 + 2, 1, y1 - y0 - 2, tone(color, -0.3));
  // Ponta aparada
  g.rect(x + 1, y0 + 1, 4, 1, tone(color, 0.1));
  g.rect(x + 2, y0, 2, 1, tone(color, 0.25));
  g.rect(x, y1 - 6, 6, 1, tone(color, -0.2));
}

function palisadeRow(len: number, t: number, st: Style, rnd: () => number, ruined: boolean): Piece {
  const F = PALISADE_FACE;
  const g = new Grid(M + len + SH + M, M + F + 4 + SH + M);
  const base = M + F + 4;
  for (let x = 0; x + 6 <= len; x += 6) {
    if (ruined && rnd() < 0.2) continue;
    const hgt = F - Math.floor(rnd() * 4) - (ruined ? Math.floor(rnd() * 14) : 0);
    log(g, M + x, base - hgt - 4, base, rnd() < 0.3 ? tone(st.wood, -0.08) : st.wood);
  }
  // Travessa por trás dos troncos
  g.outline();
  dropShadow(g, base - 8);
  return { grid: g, dx: -M, dy: t - base };
}

function palisadeColumn(len: number, t: number, st: Style, withFace: boolean, rnd: () => number, ruined: boolean): Piece {
  const F = PALISADE_FACE;
  const g = new Grid(M + t + SH + M, M + F + 4 + len + SH + M);
  const x = M + Math.round(t / 2) - 3;
  for (let y = 3; y <= len - (withFace ? 0 : 3); y += 6) {
    if (ruined && rnd() < 0.2) continue;
    const base = M + F + 4 + y;
    const hgt = F - Math.floor(rnd() * 4) - (ruined ? Math.floor(rnd() * 14) : 0);
    log(g, x, base - hgt - 4, base, rnd() < 0.3 ? tone(st.wood, -0.08) : st.wood);
  }
  g.outline();
  dropShadow(g, M + F);
  return { grid: g, dx: -M, dy: -(M + F + 4) };
}

/** Torre da muralha: pedra com ameias (com telhado nas ilhas e em jade) ou de troncos, com plataforma e telhado de palha. */
export function towerPiece(s: number, stone: boolean, culture: Culture, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const roofed = !stone || culture === "ISLES" || culture === "JADE";
  const FT = stone ? TOWER_FACE : 50;
  const lift = FT + MERLON + 4 + (roofed ? Math.round(s * 0.7) + 6 : 0);
  const g = new Grid(M + s + SH + M + 8, M + lift + s + SH + M);
  const ox = M + 4;
  const oy = M + lift;
  if (stone) {
    const color = ruined ? tone(st.stone, -0.3) : st.stone;
    prism(ox, oy, 0, 0, s, s, 0, FT, (x, y, w, h) => flagstones(g, x, y, w, h, tone(color, 0.12), rnd), (x, y, w, h) => {
      stoneFace(g, x, y, w, h, color, rnd);
      g.rect(x + Math.floor(w / 2) - 1, y + 14, 3, 8, 0x1c1714);
      g.rect(x + Math.floor(w / 2) - 1, y + 36, 3, 8, 0x1c1714);
    });
    if (roofed && !ruined) pyramid(g, ox - 4, oy - FT - Math.round(s * 0.7), s + 8, Math.round(s * 0.7) + 4, st.accent, culture === "JADE");
    else crenels(g, ox, oy, 0, 0, s, s, FT, color, "NSEW", rnd, ruined, culture === "SANDS");
  } else {
    // Troncos em pé, a plataforma de tábuas e o telhado de palha
    for (let x = 0; x + 6 <= s; x += 6) log(g, ox + x, oy + s - FT - 4, oy + s, st.wood);
    g.rect(ox - 2, oy + s - FT - 6, s + 4, 4, tone(st.wood, 0.15));
    g.rect(ox - 2, oy + s - FT - 2, s + 4, 1, tone(st.wood, -0.3));
    if (!ruined) {
      for (const px of [ox, ox + s - 3]) g.rect(px, oy + s - FT - 18, 3, 12, st.frame);
      pyramid(g, ox - 4, oy + s - FT - 18 - Math.round(s * 0.55), s + 8, Math.round(s * 0.55), st.roofs[2 % st.roofs.length], false);
    }
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Quantos pixels de pedra o arco do portão desce na coluna i (grosso nas pontas, fino no meio). */
function archDepth(i: number, width: number): number {
  const u = (i + 0.5 - width / 2) / (width / 2);
  return 5 + Math.round(12 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
}

/**
 * Portão do lado N ou S: o arco por cima do vão (quem passa some embaixo dele), a grade
 * levantada e as duas folhas abertas nas laterais. Na paliçada, dois mourões e uma travessa.
 */
export function gatePiece(width: number, t: number, side: "N" | "S", stone: boolean, culture: Culture, seed: number, ruined: boolean, closed = false): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const F = stone ? WALL_FACE : PALISADE_FACE + 8;
  const lift = F + MERLON + 3;
  const g = new Grid(M + width + SH + M, M + lift + t + SH + M);
  const oy = M + lift;
  const leaf = (x: number, y: number, w: number, h: number) => {
    g.rect(x, y, w, h, st.wood);
    for (let i = 3; i < w; i += 4) g.rect(x + i, y, 1, h, tone(st.wood, -0.22));
    g.rect(x, y + 4, w, 2, 0x4a4a50);
    g.rect(x, y + h - 8, w, 2, 0x4a4a50);
  };
  if (stone) {
    const color = ruined ? tone(st.stone, -0.3) : st.stone;
    if (!ruined) {
      flagstones(g, M, oy - F, width, t, tone(color, 0.12), rnd);
      // Arco: a pedra é grossa nas pontas e fina no meio
      const y0 = oy + t - F;
      for (let i = 0; i < width; i++) {
        const depth = archDepth(i, width);
        for (let j = 0; j < depth; j++) g.px(M + i, y0 + j, j === 0 ? tone(color, 0.22) : (j + i) % 7 === 0 ? tone(color, -0.2) : color);
        g.px(M + i, y0 + depth, tone(color, -0.35));
        // Grade levantada: dentes de ferro debaixo do arco
        if (i % 6 === 2) for (let j = 1; j <= 3; j++) g.px(M + i, y0 + depth + j, 0x55555c);
      }
      crenels(g, M, oy, 0, 0, width, t, F, color, side, rnd, false, culture === "SANDS");
    }
    if (closed) doorLeaves(g, M, width, (i) => oy + t - F + archDepth(i, width) + 1, oy + t, culture);
    else {
      leaf(M, oy + t - F + 16, 16, F - 16);
      leaf(M + width - 16, oy + t - F + 16, 16, F - 16);
    }
  } else {
    const wood = st.wood;
    for (const px of [M, M + width - 8]) {
      g.rect(px, oy + t - F - 6, 8, F + 6, wood);
      g.rect(px, oy + t - F - 6, 1, F + 6, tone(wood, 0.2));
      g.rect(px + 7, oy + t - F - 6, 1, F + 6, tone(wood, -0.3));
    }
    if (!ruined) {
      g.rect(M, oy + t - F - 4, width, 5, tone(wood, 0.1));
      g.rect(M, oy + t - F, width, 1, tone(wood, -0.35));
    }
    leaf(M + 8, oy + t - F + 8, 14, F - 8);
    leaf(M + width - 22, oy + t - F + 8, 14, F - 8);
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -M, dy: -oy };
}

/** Folha de portão aberta num muro na vertical (portões L e O), encostada na ponta do vão. */
export function gateLeafPiece(t: number, culture: Culture): Piece {
  const st = STYLES[culture];
  const g = new Grid(M + t + 12 + SH + M, M + 30 + 18 + SH + M);
  const oy = M + 30;
  prism(M, oy, 0, 0, t + 12, 18, 0, 30, (x, y, w, h) => g.rect(x, y, w, h, tone(st.wood, 0.12)), (x, y, w, h) => {
    g.rect(x, y, w, h, st.wood);
    for (let i = 3; i < w; i += 4) g.rect(x + i, y, 1, h, tone(st.wood, -0.22));
    g.rect(x, y + 4, w, 2, 0x4a4a50);
  });
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -M, dy: -oy };
}

/**
 * As duas folhas fechadas: tábuas na cor da porta, a junta no meio, duas cintas de ferro e os
 * cravos (dourados em jade e nas areias). `top(i)` é onde a coluna i começa, `bottom` é o chão.
 */
function doorLeaves(g: Grid, x: number, w: number, top: (i: number) => number, bottom: number, culture: Culture): void {
  const wood = STYLES[culture].door;
  const stud = culture === "JADE" || culture === "SANDS" ? 0xd8b048 : 0x9a9aa2;
  const bands = [bottom - 9, bottom - 25];
  for (let i = 0; i < w; i++) {
    const y0 = top(i);
    for (let y = y0; y < bottom; y++) g.px(x + i, y, i % 5 === 4 ? tone(wood, -0.3) : wood);
    g.px(x + i, y0, tone(wood, -0.45));
    for (const by of bands) {
      if (by <= y0) continue;
      g.px(x + i, by, 0x6c6c74);
      g.px(x + i, by + 1, 0x4a4a50);
      if (i % 8 === 3) g.px(x + i, by + 1, stud);
    }
  }
  g.rect(x + Math.floor(w / 2), top(Math.floor(w / 2)), 1, bottom - top(Math.floor(w / 2)), 0x1c1714);
  g.rect(x, bottom - 1, w, 1, tone(wood, -0.4));
}

/**
 * Portão N ou S fechado no cerco: as folhas que tapam o vão, por cima do portão aberto (o mesmo
 * pé). Na pedra, debaixo da curva do arco; na paliçada, entre os mourões.
 */
export function gateDoorPiece(width: number, t: number, stone: boolean, culture: Culture): Piece {
  const F = stone ? WALL_FACE : PALISADE_FACE + 8;
  const g = new Grid(M + width + M, M + F + t + M);
  const oy = M + F;
  if (stone) doorLeaves(g, M, width, (i) => oy + t - F + archDepth(i, width) + 1, oy + t, culture);
  else doorLeaves(g, M + 8, width - 16, () => oy + t - F + 1, oy + t, culture);
  g.outline();
  return { grid: g, dx: -M, dy: -oy };
}

/**
 * Trecho da porta fechada de um portão L ou O: uma tranca de tábuas da grossura da muralha, mais
 * baixa que ela (em pedaços curtos, como a muralha na vertical).
 */
export function gateBarPiece(len: number, t: number, culture: Culture, withFace: boolean): Piece {
  const wood = STYLES[culture].door;
  const H = 34;
  const g = new Grid(M + t + SH + M, M + H + len + SH + M);
  const oy = M + H;
  // O topo da tranca (tábuas atravessadas e duas cintas) e, no último trecho, a ponta do sul
  g.rect(M, oy - H, t, len, tone(wood, 0.12));
  for (let j = 3; j < len; j += 4) g.rect(M, oy - H + j, t, 1, tone(wood, -0.25));
  for (const bx of [M + 3, M + t - 5]) {
    g.rect(bx, oy - H, 2, len, 0x4a4a50);
    for (let j = 2; j < len; j += 8) g.px(bx, oy - H + j, 0x9a9aa2);
  }
  if (withFace) {
    const y = oy + len - H;
    g.rect(M, y, t, H, wood);
    for (let i = 3; i < t; i += 4) g.rect(M + i, y, 1, H, tone(wood, -0.25));
    g.rect(M, y + 6, t, 2, 0x4a4a50);
    g.rect(M, y + H - 10, t, 2, 0x4a4a50);
  }
  g.outline();
  dropShadow(g, oy - H);
  return { grid: g, dx: -M, dy: -oy };
}

/** O que sobra do portão arrombado: tábuas quebradas e pedaços das cintas no chão do vão. */
export function gateDebrisPiece(w: number, h: number, culture: Culture, seed: number): Piece {
  const wood = STYLES[culture].door;
  const rnd = seeded(seed);
  const g = new Grid(M + w + M, M + h + M);
  const n = Math.max(6, Math.round((w * h) / 420));
  for (let k = 0; k < n; k++) {
    const along = rnd() < 0.5;
    const len = 8 + Math.floor(rnd() * 12);
    const x = M + Math.floor(rnd() * Math.max(1, w - (along ? len : 3)));
    const y = M + Math.floor(rnd() * Math.max(1, h - (along ? 3 : len)));
    const c = rnd() < 0.3 ? tone(wood, -0.2) : wood;
    if (along) {
      g.rect(x, y, len, 3, c);
      g.rect(x, y, len, 1, tone(c, 0.2));
      g.px(x + len, y + 1, tone(c, 0.3));
    } else {
      g.rect(x, y, 3, len, c);
      g.rect(x, y, 1, len, tone(c, 0.2));
      g.px(x + 1, y + len, tone(c, 0.3));
    }
    if (rnd() < 0.4) g.rect(x + 2, y + 1, along ? 5 : 2, along ? 1 : 5, 0x4a4a50);
  }
  g.outline();
  return { grid: g, dx: -M, dy: -M };
}

/** Madeira recém-cortada das escadas de assalto. */
const LADDER = { light: 0xdcb27a, base: 0xc89a62, dark: 0x8a6438 };
/** Altura das estacas da paliçada acima do pé (as do `palisadeRow`). */
const STAKES = PALISADE_FACE + 2;

/**
 * Escadas de assalto (Marco 16; arte no G4): duas escadas de mão encostadas na muralha, do chão de
 * fora até o alto. `w`×`h` é a brecha que elas abrem, de um lado a outro da muralha (com 4 px de
 * folga de cada lado); `side` é o lado de fora.
 * - Ao sul, as escadas sobem pela face que se vê, na frente dela.
 * - Ao norte, a muralha as esconde: só as pontas passam por cima, atrás dela.
 * - A leste e a oeste, sobem na diagonal, do chão de fora até a beira do alto.
 * Devolve a peça e a profundidade (em relação ao canto de cima da brecha).
 */
export function ladderPiece(side: "N" | "S" | "E" | "W", w: number, h: number, wallT: number, stone: boolean): { piece: Piece; depth: number } {
  const F = stone ? WALL_FACE : STAKES;
  const ox = 34;
  const oy = F + 24;
  const g = new Grid(ox + w + 34, oy + h + 16);
  const rails = (fx: number, fy: number, tx: number, ty: number, dx: number, dy: number) => {
    g.line(ox + fx, oy + fy, ox + tx, oy + ty, LADDER.base);
    g.line(ox + fx + dx, oy + fy + dy, ox + tx + dx, oy + ty + dy, LADDER.dark);
    const n = Math.max(2, Math.floor(Math.hypot(tx - fx, ty - fy) / 5));
    for (let i = 1; i < n; i++) {
      const x = Math.round(fx + ((tx - fx) * i) / n);
      const y = Math.round(fy + ((ty - fy) * i) / n);
      g.line(ox + x, oy + y, ox + x + dx, oy + y + dy, LADDER.light);
    }
  };
  // O pé da muralha (linha de baixo do chão dela) e a beira do alto, na tela
  const bottom = 4 + wallT;
  let depth: number;
  if (side === "S" || side === "N") {
    const xs = [Math.round(w / 2) - 15, Math.round(w / 2) + 6];
    if (side === "S") {
      const top = stone ? bottom - F : bottom - STAKES;
      for (const x of xs) rails(x, bottom + 8, x, top - 3, 8, 0);
      depth = bottom + 8;
    } else {
      // A face do norte não aparece: as pontas sobem por trás, acima das ameias (ou das estacas)
      const top = stone ? 4 - F - 8 : bottom - STAKES;
      for (const x of xs) rails(x, top + 10, x, top - 12, 8, 0);
      depth = bottom - 2;
    }
  } else {
    const ys = [Math.round(h / 2) - 13, Math.round(h / 2) + 7];
    const west = side === "W";
    // Na pedra, a beira do alto fica na borda da muralha; na paliçada, nas estacas do meio
    const edge = stone ? (west ? 4 : 4 + wallT) : 4 + Math.round(wallT / 2) + (west ? -2 : 2);
    const foot = west ? edge - 26 : edge + 26;
    for (const y of ys) rails(foot, y + 4, edge + (west ? 1 : -1), y - F - 2, 0, 6);
    depth = Math.round(h / 2) + 17;
  }
  g.outline();
  return { piece: { grid: g, dx: -ox, dy: -oy }, depth };
}

/** Barraca do mercado: toldo listrado em quatro postes e o balcão com mercadoria. */
export function stallPiece(w: number, h: number, color: number, culture: Culture, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const Z = 26;
  const g = new Grid(M + w + SH + M, M + Z + h + SH + M);
  const oy = M + Z;
  // Balcão
  const cy = Math.round(h * 0.45);
  prism(M, oy, 2, cy, w - 4, h - cy, 0, 12, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, tone(st.wood, 0.15));
    const goods = [0xc84a3a, 0xe0a030, 0x6a9a3a, 0xd8d0b8, 0x8a5a9a];
    for (let k = 0; k < (ww * hh) / 10; k++) g.rect(x + 1 + Math.floor(rnd() * (ww - 3)), y + Math.floor(rnd() * (hh - 1)), 2, 2, goods[Math.floor(rnd() * goods.length)]);
  }, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, st.wood);
    for (let i = 4; i < ww; i += 5) g.rect(x + i, y, 1, hh, tone(st.wood, -0.2));
  });
  // Postes da frente e o toldo
  for (const px of [M + 1, M + w - 3]) g.rect(px, oy + h - Z, 2, Z, tone(st.wood, -0.2));
  const ay = oy - Z;
  const ah = Math.round(h * 0.7);
  for (let i = 0; i < w; i++) {
    const c = Math.floor(i / 6) % 2 === 0 ? color : 0xeee4cc;
    for (let j = 0; j < ah; j++) g.px(M + i, ay + j, j < 2 ? tone(c, 0.15) : c);
    // Franja recortada
    if (i % 6 < 4) g.px(M + i, ay + ah, tone(c, -0.15));
    g.px(M + i, ay + ah - 1, tone(c, -0.1));
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -M, dy: -oy };
}

/**
 * Barraca de lona (guarnição e acampamento): cumeeira no lado mais comprido. Com a cumeeira de
 * norte a sul, a frente mostra a entrada; na horizontal, só a água da frente, com as cordas.
 */
export function tentPiece(w: number, h: number, canvas: number, stripe: number | null, seed: number): Piece {
  const rnd = seeded(seed);
  const Z = Math.min(34, Math.round(Math.min(w, h) * 0.55));
  const g = new Grid(M + 6 + w + 6 + SH + M, M + Z + h + 4 + SH + M);
  const ox = M + 6;
  const oy = M + Z;
  const dark = tone(canvas, -0.25);
  if (w >= h) {
    const ridge = Math.round(h / 2) - Z;
    for (let j = Math.min(ridge, 0); j < h; j++) {
      for (let i = 0; i < w; i++) {
        const front = j >= ridge;
        let c = front ? canvas : dark;
        if (stripe !== null && front && Math.floor((i * 4) / w) % 2 === 1) c = stripe;
        if (front && j > h - 6) c = tone(c, -0.12);
        g.px(ox + i, oy + j, c);
      }
    }
    g.rect(ox, oy + ridge, w, 1, tone(canvas, 0.3));
    for (let i = 0; i < w; i += 7) for (let j = ridge + 2; j < h; j += 2) if (rnd() < 0.15) g.px(ox + i, oy + j, tone(canvas, -0.1));
    // Cordas e espeques
    for (const [px, dir] of [[ox, -1], [ox + w - 1, 1]] as const) {
      g.line(px, oy + ridge, px + dir * 5, oy + h + 2, 0x6a5232);
      g.px(px + dir * 5, oy + h + 3, 0x4a3420);
    }
  } else {
    const c = w / 2;
    for (let i = 0; i < w; i++) {
      const d = Math.abs(i + 0.5 - c) / c;
      const lift = Math.round(Z * (1 - d));
      const left = i + 0.5 < c;
      let col = left ? canvas : dark;
      if (stripe !== null && Math.floor((i * 4) / w) % 2 === 1) col = left ? stripe : tone(stripe, -0.25);
      for (let j = -lift; j < h - lift; j++) g.px(ox + i, oy + j, col);
      // Empena da frente com a entrada
      for (let j = h - lift; j < h; j++) g.px(ox + i, oy + j, tone(canvas, -0.08));
      g.px(ox + i, oy + h - lift, tone(canvas, 0.3));
    }
    const dw = Math.max(4, Math.round(w * 0.3));
    for (let j = 0; j < Math.round(Z * 0.7); j++) {
      const half = Math.round((dw / 2) * (j / (Z * 0.7)));
      for (let i = -half; i <= half; i++) g.px(ox + Math.round(c) + i, oy + h - Math.round(Z * 0.7) + j, 0x2a2018);
    }
    g.rect(ox + Math.round(c), oy - Z - 4, 1, 5, 0x6a5232);
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Cerca de estacas com travessa (pátio da guarnição). `gaps`: trechos abertos, em px a partir do começo. */
export function fencePiece(len: number, horizontal: boolean, gaps: readonly [number, number][], culture: Culture): Piece {
  const st = STYLES[culture];
  const Z = 14;
  const open = (d: number) => gaps.some(([a, b]) => d >= a && d <= b);
  if (horizontal) {
    const g = new Grid(M + len + 4 + SH + M, M + Z + 4 + SH + M);
    const base = M + Z + 2;
    for (let d = 0; d <= len; d += 22) {
      if (open(d)) continue;
      g.rect(M + d, base - Z, 3, Z, st.wood);
      g.px(M + d, base - Z, tone(st.wood, 0.3));
      if (d + 22 <= len && !open(d + 22)) {
        g.rect(M + d + 3, base - Z + 3, 19, 2, tone(st.wood, 0.12));
        g.rect(M + d + 3, base - Z + 9, 19, 1, tone(st.wood, -0.1));
      }
    }
    g.outline();
    return { grid: g, dx: -M - 1, dy: -base };
  }
  const g = new Grid(M + 4 + SH + M, M + Z + len + 4 + SH + M);
  for (let d = 0; d <= len; d += 22) {
    if (open(d)) continue;
    const base = M + Z + d;
    g.rect(M, base - Z, 3, Z, st.wood);
    g.px(M, base - Z, tone(st.wood, 0.3));
    if (d + 22 <= len && !open(d + 22)) g.rect(M + 1, base - Z + 3, 1, 22, tone(st.wood, 0.12));
  }
  g.outline();
  return { grid: g, dx: -M - 1, dy: -(M + Z) };
}

/** Coisas miúdas do pátio: fogueira, barril, caixote, armeiro e boneco de treino. */
export function propPiece(kind: "FIRE" | "BARREL" | "CRATE" | "RACK" | "DUMMY", culture: Culture, seed: number, w = 0, h = 0): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  switch (kind) {
    case "FIRE": {
      const g = new Grid(M + 40 + M, M + 30 + M);
      const cx = M + 20;
      const cy = M + 18;
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        g.oval(Math.round(cx + Math.cos(a) * 14), Math.round(cy + Math.sin(a) * 9), 2, 1, k % 2 ? 0x8a8478 : 0x77716a);
      }
      g.oval(cx, cy, 8, 5, 0x2a2018);
      g.oval(cx, cy, 5, 3, 0xc85a1a);
      g.oval(cx, cy - 1, 3, 2, 0xf0a030);
      g.rect(cx - 1, cy - 4, 2, 3, 0xf8e070);
      g.outline();
      return { grid: g, dx: -cx, dy: -cy };
    }
    case "BARREL": {
      const g = new Grid(M + 12 + SH + M, M + 16 + SH + M);
      g.rect(M + 1, M + 3, 10, 11, st.wood);
      g.oval(M + 5, M + 3, 4, 2, tone(st.wood, 0.2));
      g.rect(M + 1, M + 6, 10, 1, 0x4a4a50);
      g.rect(M + 1, M + 11, 10, 1, 0x4a4a50);
      g.rect(M + 9, M + 4, 2, 10, tone(st.wood, -0.3));
      g.outline();
      dropShadow(g, M + 8);
      return { grid: g, dx: -M - 6, dy: -M - 13 };
    }
    case "CRATE": {
      const g = new Grid(M + 14 + SH + M, M + 18 + SH + M);
      prism(M, M + 8, 0, 0, 14, 10, 0, 8, (x, y, ww, hh) => g.rect(x, y, ww, hh, tone(0xb08850, 0.15)), (x, y, ww, hh) => {
        g.rect(x, y, ww, hh, 0xb08850);
        g.line(x, y, x + ww - 1, y + hh - 1, tone(0xb08850, -0.3));
      });
      g.outline();
      dropShadow(g, M + 8);
      return { grid: g, dx: -M, dy: -M - 8 };
    }
    case "RACK": {
      const vertical = h > w;
      const g = new Grid(M + w + 16 + SH + M, M + 30 + h + SH + M);
      const ox = M + 8;
      const oy = M + 30;
      if (!vertical) {
        g.rect(ox, oy + h - 10, w, 4, st.wood);
        for (const px of [ox, ox + w - 3]) g.rect(px, oy + h - 16, 3, 16, tone(st.wood, -0.15));
        for (let px = ox + 4; px < ox + w - 3; px += 6) {
          g.rect(px, oy + h - 30, 1, 26, 0x8a6a40);
          g.rect(px, oy + h - 32, 1, 3, 0xd8d8d8);
        }
      } else {
        for (let py = 2; py < h; py += 7) {
          g.rect(ox + Math.floor(w / 2), oy + py - 26, 1, 26, 0x8a6a40);
          g.rect(ox + Math.floor(w / 2), oy + py - 28, 1, 3, 0xd8d8d8);
        }
        g.rect(ox, oy, 3, h, st.wood);
      }
      for (const [sx, sy] of [[ox - 6, oy + h - 8], [ox + w + 2, oy + h - 8]]) {
        g.oval(sx + 2, sy, 4, 5, 0x8a2f2f);
        g.px(sx + 2, sy, 0xc9a23a);
      }
      g.outline();
      dropShadow(g, oy);
      return { grid: g, dx: -ox, dy: -oy };
    }
    case "DUMMY": {
      const g = new Grid(M + 22 + SH + M, M + 30 + SH + M);
      const cx = M + 11;
      g.rect(cx - 1, M + 8, 3, 22, st.wood);
      g.rect(cx - 9, M + 13, 19, 3, st.wood);
      g.oval(cx, M + 6, 4, 4, 0xd8c39a);
      g.rect(cx - 3, M + 16, 7, 8, 0xc8b080);
      for (let k = 0; k < 6; k++) g.px(cx - 3 + Math.floor(rnd() * 7), M + 16 + Math.floor(rnd() * 8), 0xa89060);
      g.outline();
      dropShadow(g, M + 22);
      return { grid: g, dx: -cx, dy: -(M + 29) };
    }
  }
}

/**
 * Poço da praça, com o pé de raio `r`: o parapeito redondo de pedra (o topo subido e a face do
 * sul), a água, os dois esteios com o sarilho e o balde, e um telhadinho (menos nas areias).
 */
export function wellPiece(r: number, culture: Culture, seed: number, ruined: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const HW = 10;
  const roofed = culture !== "SANDS" && !ruined;
  const up = HW + (roofed ? 36 : 28);
  const g = new Grid(M + 2 * r + 8 + SH + M, M + up + 2 * r + SH + M);
  const ox = M + 4 + r;
  const oy = M + up + r;
  const stone = ruined ? tone(st.stone, -0.3) : st.stone;
  // Face do sul: a metade de baixo do cilindro, em fiadas
  for (let x = -r; x <= r; x++) {
    const yb = Math.round(Math.sqrt(Math.max(0, r * r - x * x)));
    for (let y = yb - HW; y <= yb; y++) {
      const course = (y - yb + HW) % 4 === 3 || (Math.floor((y - yb + HW) / 4) % 2 ? x + 2 : x) % 7 === 0;
      g.px(ox + x, oy + y, course ? tone(stone, -0.25) : x > r * 0.5 ? tone(stone, -0.12) : stone);
    }
  }
  g.oval(ox, oy - HW, r, r, tone(stone, 0.18));
  speckle(g, ox - r, oy - HW - r, 2 * r, 2 * r, tone(stone, 0.18), 0.03, rnd);
  g.oval(ox, oy - HW, r - 4, r - 4, tone(stone, -0.35));
  g.oval(ox, oy - HW + 1, r - 5, r - 5, 0x2b4a6b);
  g.rect(ox - 3, oy - HW - 2, 4, 1, 0x5a7c9c);
  if (!ruined) {
    const top = oy - HW - (roofed ? 26 : 22);
    for (const px of [ox - r + 1, ox + r - 3]) {
      g.rect(px, top, 3, oy - HW - top, st.wood);
      g.rect(px, top, 1, oy - HW - top, tone(st.wood, 0.2));
    }
    g.rect(ox - r + 1, top + 4, 2 * r - 2, 3, tone(st.wood, 0.1));
    g.rect(ox - r + 1, top + 6, 2 * r - 2, 1, tone(st.wood, -0.35));
    g.rect(ox, top + 7, 1, 10, 0xb0a080);
    g.rect(ox - 3, top + 17, 7, 6, st.wood);
    g.rect(ox - 3, top + 18, 7, 1, 0x4a4a50);
    if (roofed) {
      const color = st.roofs[0];
      for (let j = 0; j < 9; j++) {
        const inset = Math.max(0, 4 - j);
        g.rect(ox - r - 3 + inset, top - 9 + j, 2 * r + 6 - 2 * inset, 1, j < 3 ? tone(color, 0.15) : j % 3 === 0 ? tone(color, -0.2) : color);
      }
      g.rect(ox - r - 3, top - 1, 2 * r + 6, 1, tone(color, -0.4));
    }
  }
  g.outline();
  dropShadow(g, oy - HW);
  return { grid: g, dx: -(ox - r), dy: -(oy - r) };
}

/** Entulho de uma casa destruída: pedras, vigas queimadas e um pedaço de parede de pé. */
export function rubblePiece(w: number, h: number, culture: Culture, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const Z = 16;
  const g = new Grid(M + w + SH + M, M + Z + h + SH + M);
  const oy = M + Z;
  for (let k = 0; k < Math.round((w * h) / 120); k++) {
    const x = M + 4 + Math.floor(rnd() * (w - 12));
    const y = oy + 4 + Math.floor(rnd() * (h - 10));
    const s = 2 + Math.floor(rnd() * 4);
    g.oval(x, y - Math.floor(rnd() * 6), s + 1, s, tone(rnd() < 0.5 ? st.base : st.wall, -0.35 - rnd() * 0.2));
  }
  for (let k = 0; k < 4; k++) {
    const x = M + 4 + Math.floor(rnd() * (w - 30));
    const y = oy + 6 + Math.floor(rnd() * (h - 12));
    g.line(x, y, x + 12 + Math.floor(rnd() * 16), y - 6 + Math.floor(rnd() * 12), 0x2a2018);
  }
  // Canto de parede que ficou de pé
  const px = M + 2;
  g.rect(px, oy + h - Z - 8, 18, Z + 8, tone(st.wall, -0.45));
  g.rect(px, oy + h - Z - 8, 18, 1, tone(st.wall, -0.3));
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -M, dy: -oy };
}

// --- Acampamento do bando ---

/**
 * Estacas da paliçada do acampamento: troncos em pé com o pé nos pontos dados (a partir do canto
 * de cima e da esquerda do grupo), desenhados de trás para a frente. Reforçada: mais alta e amarrada.
 */
export function stakesPiece(points: readonly { x: number; y: number }[], culture: Culture, seed: number, reinforced: boolean): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const Z = reinforced ? 40 : PALISADE_FACE;
  const top = M + Z + 4;
  const w = Math.max(...points.map((p) => p.x));
  const h = Math.max(...points.map((p) => p.y));
  const g = new Grid(Math.ceil(M + w + 6 + SH + M), Math.ceil(top + h + SH + M));
  for (const p of [...points].sort((a, b) => a.y - b.y)) {
    const x = M + Math.round(p.x);
    const base = top + Math.round(p.y);
    const hgt = Z - Math.floor(rnd() * 5);
    log(g, x, base - hgt - 4, base, rnd() < 0.3 ? tone(st.wood, -0.08) : st.wood);
    if (reinforced) g.rect(x, base - Math.round(hgt * 0.62), 6, 2, 0x8a7a50);
  }
  g.outline();
  dropShadow(g, top - 8);
  return { grid: g, dx: -M - 3, dy: -top };
}

/**
 * Estandarte num mastro (o pé do mastro na âncora): bandeira com franja ou flâmula. `cloth` é a
 * largura do pano (as bandeiras dos povoados crescem com a construção).
 */
export function bannerPiece(color: number, pennant: boolean, height = 44, cloth = 22): Piece {
  const g = new Grid(M + Math.round(cloth * 1.4) + 8 + M, M + height + 4 + M);
  const base = M + height + 4;
  const x = M + 1;
  const top = base - height;
  g.rect(x, top - 2, 2, height + 2, 0x6b4a2b);
  g.rect(x, top - 2, 1, height + 2, 0x8a6a40);
  g.px(x, top - 3, 0xc9a23a);
  if (pennant) {
    const half = Math.round(cloth * 0.45);
    const long = Math.round(cloth * 1.36);
    for (let j = 0; j <= half * 2; j++) {
      const len = Math.round(long * (1 - Math.abs(j - half) / half));
      g.rect(x + 2, top + j, len, 1, j < half ? tone(color, 0.12) : color);
    }
  } else {
    const h = Math.round(cloth * 0.73);
    g.rect(x + 2, top, cloth, h, color);
    // Dobras do pano: uma faixa clara e uma escura, e a beira de baixo ondulada
    const fold = Math.round(cloth * 0.55);
    g.rect(x + 2 + fold, top + 1, 2, h - 1, tone(color, -0.16));
    g.rect(x + 2 + fold - 2, top + 1, 1, h - 1, tone(color, 0.12));
    g.rect(x + 2, top, cloth, 1, tone(color, 0.3));
    g.rect(x + 2, top + h - 1, cloth, 1, tone(color, -0.3));
    for (let i = 0; i < cloth; i += 3) g.px(x + 2 + i, top + h, tone(color, -0.2));
  }
  g.outline();
  return { grid: g, dx: -x, dy: -base };
}

/** Carroça da intendência com três caixotes no leito (as rodas do sul na frente). */
export function wagonPiece(w: number, h: number, culture: Culture, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const g = new Grid(M + 6 + w + 14 + SH + M, M + 40 + h + SH + M);
  const ox = M + 6;
  const oy = M + 40;
  const wood = st.wood;
  prism(ox, oy, 4, 4, w - 8, h - 8, 10, 20, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, tone(wood, 0.12));
    for (let j = 4; j < hh; j += 5) g.rect(x, y + j, ww, 1, tone(wood, -0.15));
  }, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, tone(wood, -0.1));
    g.rect(x, y + hh - 1, ww, 1, tone(wood, -0.4));
  });
  // Timão para o leste
  g.rect(ox + w - 4, oy + Math.round(h / 2) - 16, 16, 2, tone(wood, -0.2));
  for (let i = 0; i < 3; i++) {
    const c = rnd() < 0.5 ? 0xb08850 : 0x9a7444;
    prism(ox, oy, 10 + i * 32, Math.round(h / 2) - 13, 26, 26, 20, 34, (x, y, ww, hh) => {
      g.rect(x, y, ww, hh, tone(c, 0.15));
      g.rect(x, y + Math.floor(hh / 2), ww, 1, tone(c, -0.2));
    }, (x, y, ww, hh) => {
      g.rect(x, y, ww, hh, c);
      g.line(x, y, x + ww - 1, y + hh - 1, tone(c, -0.3));
      g.rect(x, y, ww, 1, tone(c, 0.25));
    });
  }
  // Rodas do sul: aro escuro, raios e o cubo
  for (const wx of [16, w - 16]) {
    const cx = ox + wx;
    const cy = oy + h - 4 - 10;
    g.oval(cx, cy, 9, 9, 0x2a2018);
    g.oval(cx, cy, 7, 7, tone(wood, 0.05));
    g.rect(cx - 7, cy, 15, 1, 0x3a2a1c);
    g.rect(cx, cy - 7, 1, 15, 0x3a2a1c);
    g.line(cx - 5, cy - 5, cx + 5, cy + 5, 0x3a2a1c);
    g.line(cx - 5, cy + 5, cx + 5, cy - 5, 0x3a2a1c);
    g.oval(cx, cy, 2, 2, 0x4a4a50);
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Mesa de alistamento: tampo de tábuas com o livro de registro, o tinteiro e a pena. */
export function tablePiece(w: number, h: number, culture: Culture): Piece {
  const st = STYLES[culture];
  const Z = 14;
  const g = new Grid(M + w + SH + M, M + Z + h + SH + M);
  const ox = M;
  const oy = M + Z;
  for (const lx of [2, w - 5]) g.rect(ox + lx, oy + h - Z, 3, Z, tone(st.wood, -0.3));
  g.rect(ox, oy - Z, w, h, tone(st.wood, 0.12));
  for (let j = 6; j < h; j += 7) g.rect(ox, oy - Z + j, w, 1, tone(st.wood, -0.12));
  g.rect(ox, oy + h - Z, w, 3, st.wood);
  g.rect(ox, oy + h - Z + 2, w, 1, tone(st.wood, -0.35));
  const bx = ox + Math.round(w / 2) - 20;
  const by = oy - Z + Math.round(h / 2) - 10;
  g.rect(bx, by, 30, 20, 0xf5f0e0);
  g.rect(bx + 15, by, 1, 20, 0xc8bea8);
  for (let k = 3; k < 18; k += 3) {
    g.rect(bx + 3, by + k, 10, 1, 0x9a9080);
    g.rect(bx + 18, by + k, 9, 1, 0x9a9080);
  }
  g.rect(bx + 36, by + 8, 4, 4, 0x2a2a3a);
  g.line(bx + 38, by + 8, bx + 43, by + 1, 0xe8e0d0);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/**
 * Estábulo: um alpendre de palha no lado norte, sobre esteios, e o curral na frente, com o
 * cocho, o chão de palha e a cerca nos outros três lados.
 */
export function stablePiece(w: number, h: number, culture: Culture, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const Z = 30;
  const rd = Math.round(h * 0.45);
  const g = new Grid(M + 3 + w + 3 + SH + M, M + Z + 10 + h + SH + M);
  const ox = M + 3;
  const oy = M + Z + 10;
  const wood = st.wood;
  const straw = st.roofs[st.thatch[0] ?? 2] ?? 0xb0904c;
  g.rect(ox, oy, w, h, 0x7a6640);
  for (let k = 0; k < (w * h) / 24; k++) g.px(ox + Math.floor(rnd() * w), oy + Math.floor(rnd() * h), rnd() < 0.5 ? 0xc8b060 : 0x8a7448);
  // Parede de tábuas do fundo, os esteios e o telhado de palha
  g.rect(ox, oy - Z, w, Z + 2, tone(wood, -0.15));
  for (let i = 4; i < w; i += 5) g.rect(ox + i, oy - Z, 1, Z + 2, tone(wood, -0.35));
  for (const px of [0, Math.round(w / 2) - 1, w - 3]) g.rect(ox + px, oy + rd - Z, 3, Z, wood);
  // Cocho debaixo do alpendre
  g.rect(ox + 8, oy + 8, 40, 6, tone(wood, -0.25));
  g.rect(ox + 9, oy + 9, 38, 2, 0x2b4a6b);
  g.rect(ox + 8, oy + 14, 40, 4, tone(wood, -0.1));
  for (let j = 0; j < rd + 6; j++) {
    const c = j >= rd ? tone(straw, -0.3) : j % 4 === 0 ? tone(straw, -0.15) : straw;
    g.rect(ox - 3, oy - Z - 6 + j, w + 6, 1, c);
  }
  for (let k = 0; k < w; k += 3) if (rnd() < 0.5) g.px(ox - 3 + k, oy - Z + rd, tone(straw, -0.4));
  // Cerca do curral: estacas e duas travessas
  const post = (x: number, base: number) => {
    g.rect(x, base - 14, 3, 14, wood);
    g.px(x, base - 14, tone(wood, 0.3));
  };
  for (let y = rd + 4; y <= h; y += 14) {
    post(ox, oy + y);
    post(ox + w - 3, oy + y);
  }
  g.rect(ox + 1, oy + rd + 4 - 11, 1, h - rd - 4, tone(wood, 0.12));
  g.rect(ox + w - 2, oy + rd + 4 - 11, 1, h - rd - 4, tone(wood, 0.12));
  for (let x = 0; x <= w - 3; x += Math.round((w - 3) / 6)) post(ox + x, oy + h);
  g.rect(ox, oy + h - 11, w, 2, tone(wood, 0.12));
  g.rect(ox, oy + h - 5, w, 1, tone(wood, -0.1));
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Onde fica a brasa do fogão da ferraria, a partir do canto do pé (para o brilho que pisca). */
export function forgeGlow(w: number): { x: number; y: number } {
  return { x: w - 20, y: 18 };
}

/**
 * Ferraria de campanha: o fogão de pedra com a chaminé no fundo, um telhado de tábuas sobre
 * esteios e, na frente, a bigorna no cepo e a tina com água.
 */
export function forgePiece(w: number, h: number, culture: Culture, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const g = new Grid(M + 3 + w + 3 + SH + M, M + 64 + h + SH + M);
  const ox = M + 3;
  const oy = M + 64;
  const stone = st.stone;
  g.rect(ox, oy, w, h, 0x6f6a60);
  speckle(g, ox, oy, w, h, 0x6f6a60, 0.06, rnd);
  // Mureta do fundo e o fogão
  prism(ox, oy, 0, 0, w, 6, 0, 16, (x, y, ww, hh) => g.rect(x, y, ww, hh, tone(stone, 0.15)), (x, y, ww, hh) => stoneFace(g, x, y, ww, hh, stone, rnd));
  const hx = w - 34;
  prism(ox, oy, hx, 4, 28, 22, 0, 18, (x, y, ww, hh) => flagstones(g, x, y, ww, hh, tone(stone, 0.1), rnd), (x, y, ww, hh) => {
    stoneFace(g, x, y, ww, hh, stone, rnd);
    g.rect(x + 7, y + 6, 14, 9, 0x2a1a12);
    g.rect(x + 8, y + 10, 12, 4, 0xc85a1a);
    g.rect(x + 11, y + 11, 5, 2, 0xf0a030);
  });
  // Telhado de tábuas sobre dois esteios (o lado sul aberto)
  const rd = Math.round(h * 0.6);
  const roof = st.roofs[1];
  for (const px of [0, w - 3]) g.rect(ox + px, oy + rd - 34, 3, 34, st.wood);
  prism(ox, oy, -3, 0, w + 6, rd, 34, 38, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, roof);
    for (let i = 5; i < ww; i += 6) g.rect(x + i, y, 1, hh, tone(roof, -0.2));
    g.rect(x, y, ww, 1, tone(roof, 0.2));
  }, (x, y, ww, hh) => g.rect(x, y, ww, hh, tone(roof, -0.35)));
  // Chaminé (atravessa o telhado)
  prism(ox, oy, hx + 8, 6, 12, 10, 18, 56, (x, y, ww, hh) => {
    g.rect(x, y, ww, hh, tone(stone, 0.1));
    g.rect(x + 2, y + 2, ww - 4, hh - 4, 0x1c1714);
  }, (x, y, ww, hh) => stoneFace(g, x, y, ww, hh, stone, rnd));
  // Bigorna no cepo e a tina
  const ax = ox + 16;
  const ay = oy + h - 14;
  g.rect(ax + 3, ay - 8, 8, 8, tone(st.wood, -0.1));
  g.rect(ax, ay - 14, 16, 4, 0x3a3a40);
  g.rect(ax + 4, ay - 10, 8, 2, 0x2a2a30);
  g.rect(ax + 16, ay - 13, 4, 2, 0x3a3a40);
  g.rect(ax, ay - 14, 16, 1, 0x7a7a84);
  const tx = ox + 46;
  const ty = oy + h - 10;
  g.rect(tx, ty - 9, 14, 9, st.wood);
  g.rect(tx, ty - 6, 14, 1, 0x4a4a50);
  g.oval(tx + 7, ty - 10, 6, 2, tone(st.wood, 0.15));
  g.oval(tx + 7, ty - 10, 5, 1, 0x2b4a6b);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Fogueira grande do acampamento: o anel de pedras, a lenha cruzada e a cinza (a chama é à parte). */
export function bonfirePiece(r: number, seed: number): Piece {
  const rnd = seeded(seed);
  const c = M + r + 8;
  const g = new Grid(c + r + 8 + SH + M, c + r + 8 + SH + M);
  g.oval(c, c, r - 8, r - 8, 0x4a4038);
  g.oval(c, c, r - 14, r - 14, 0x2a2420);
  for (const [x0, y0, x1, y1] of [[-18, -10, 18, 10], [-18, 10, 18, -10]]) {
    for (let k = -2; k <= 2; k++) g.line(c + x0, c + y0 + k, c + x1, c + y1 + k, k === -2 ? 0x8a6a40 : k === 2 ? 0x4a3420 : 0x6b4a2b);
  }
  for (let k = 0; k < 14; k++) g.px(c - 8 + Math.floor(rnd() * 16), c - 6 + Math.floor(rnd() * 12), rnd() < 0.5 ? 0xc85a1a : 0xf0a030);
  const stones = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of stones) {
    const sx = Math.round(c + Math.cos(a) * r);
    const sy = Math.round(c + Math.sin(a) * r);
    g.oval(sx, sy, 5, 4, 0x6a6560);
    g.oval(sx, sy - 2, 5, 3, 0x8a8478);
    g.px(sx - 2, sy - 3, 0xa8a296);
  }
  g.outline();
  return { grid: g, dx: -(c - r), dy: -(c - r) };
}

/** Coisas miúdas do acampamento: feno e lenha empilhada (no pé) e tocha (com o pé na âncora). */
export function campPropPiece(kind: "HAY" | "WOODPILE" | "TORCH", culture: Culture, seed: number, w = 0, h = 0): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  switch (kind) {
    case "HAY": {
      const Z = 12;
      const g = new Grid(M + w + SH + M, M + Z + h + SH + M);
      prism(M, M + Z, 0, 0, w, h, 0, Z, (x, y, ww, hh) => {
        g.rect(x, y, ww, hh, 0xe0c870);
        for (let k = 0; k < (ww * hh) / 6; k++) g.px(x + Math.floor(rnd() * ww), y + Math.floor(rnd() * hh), rnd() < 0.5 ? 0xc8b058 : 0xf0dc90);
      }, (x, y, ww, hh) => {
        g.rect(x, y, ww, hh, 0xc8b058);
        for (let i = 2; i < ww; i += 3) g.rect(x + i, y, 1, hh, 0xb09840);
        for (const bx of [Math.round(ww * 0.3), Math.round(ww * 0.7)]) g.rect(x + bx, y, 1, hh, 0x7a5a30);
      });
      g.outline();
      dropShadow(g, M + Z);
      return { grid: g, dx: -M, dy: -M - Z };
    }
    case "WOODPILE": {
      const Z = 18;
      const g = new Grid(M + w + SH + M, M + Z + h + SH + M);
      prism(M, M + Z, 0, 0, w, h, 0, Z, (x, y, ww, hh) => {
        for (let j = 0; j < hh; j++) g.rect(x, y + j, ww, 1, j % 5 === 4 ? tone(st.wood, -0.35) : tone(st.wood, 0.1));
      }, (x, y, ww, hh) => {
        for (let j = 0; j < hh; j++) g.rect(x, y + j, ww, 1, j % 5 === 4 ? tone(st.wood, -0.4) : st.wood);
        for (let k = 0; k < ww; k += 4) g.px(x + k + Math.floor(rnd() * 3), y + Math.floor(rnd() * hh), tone(st.wood, -0.25));
        for (let j = 2; j < hh; j += 5) g.oval(x + ww - 3, y + j, 2, 2, 0xc8a878);
      });
      g.outline();
      dropShadow(g, M + Z);
      return { grid: g, dx: -M, dy: -M - Z };
    }
    case "TORCH": {
      const g = new Grid(M + 6 + M, M + 26 + M);
      const x = M + 2;
      const base = M + 26;
      g.rect(x, base - 18, 2, 18, st.wood);
      g.rect(x - 1, base - 21, 4, 3, 0x3a2a1c);
      g.rect(x - 1, base - 24, 4, 3, 0xf08020);
      g.rect(x, base - 26, 2, 3, 0xf8d050);
      g.outline();
      return { grid: g, dx: -x - 1, dy: -base };
    }
  }
}

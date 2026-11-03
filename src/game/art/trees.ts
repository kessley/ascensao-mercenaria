import { Grid, seeded } from "./pixel";
import { M, dropShadow, tone, type Piece } from "./buildings";

/**
 * Árvores, moitas e pedras em pixel art (G2): o que enche as matas no lugar dos círculos do
 * greybox. A regra é a das construções: o pé fica no chão, a âncora no meio do pé e a
 * profundidade sai da linha de baixo dele, então quem passa ao norte de uma árvore some atrás
 * da copa. A luz vem do alto à esquerda, e a sombra cai para a direita.
 */

/** Como as folhas estão: verde de primavera, de verão, cor de outono ou galho pelado no inverno. */
export type Foliage = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

const TRUNK = 0x5a4030;
const PINE = 0x2c5a3c;
const SNOW = 0xeef2f6;
const SNOW_SHADE = 0xc4d0de;
const ROCK = 0x8a8478;
const MOSS = 0x5a7a34;

const LEAVES: Record<Exclude<Foliage, "WINTER" | "AUTUMN">, number> = { SPRING: 0x5c9a36, SUMMER: 0x3f7a2c };
/** No outono cada árvore pega uma cor: laranja, amarelo, ferrugem ou o verde que resiste. */
const AUTUMN = [0xc8782a, 0xd6a63a, 0xa8482a, 0x8a7c2c];

/**
 * Copa: um oval com a luz no alto à esquerda e a sombra embaixo à direita, salpicado de tufos
 * de folha (o desenho miúdo que faz ler como folhagem, não como bola).
 */
function crown(g: Grid, cx: number, cy: number, rx: number, ry: number, color: number, rnd: () => number): void {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / ((rx + 0.3) * (rx + 0.3)) + (y * y) / ((ry + 0.3) * (ry + 0.3));
      if (d > 1) continue;
      // Borda roída: folha não é círculo perfeito
      if (d > 0.82 && rnd() < 0.35) continue;
      const lean = (x / rx + y / ry) * 0.5;
      const shade = lean < -0.35 ? 0.22 : lean > 0.3 ? -0.26 : 0;
      const grain = rnd() < 0.18 ? (rnd() < 0.5 ? 0.1 : -0.12) : 0;
      g.px(cx + x, cy + y, tone(color, shade + grain));
    }
  }
  // Tufos: pequenos arcos claros no alto e escuros embaixo
  const tufts = Math.round((rx * ry) / 9);
  for (let k = 0; k < tufts; k++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.8;
    const x = Math.round(cx + Math.cos(a) * rx * r);
    const y = Math.round(cy + Math.sin(a) * ry * r);
    const up = Math.sin(a) < 0;
    const c = tone(color, up ? 0.3 : -0.32);
    g.px(x, y, c);
    g.px(x + 1, y, c);
    if (up) g.px(x, y - 1, tone(color, 0.38));
  }
}

/** Tronco afinando para cima, com a casca clara de um lado e escura do outro. */
function trunk(g: Grid, cx: number, base: number, height: number, width: number, color = TRUNK): void {
  for (let y = 0; y < height; y++) {
    const w = Math.max(2, Math.round(width - (y / height) * (width - 2)));
    const x0 = cx - Math.floor(w / 2);
    g.rect(x0, base - y, w, 1, color);
    g.px(x0, base - y, tone(color, 0.22));
    g.px(x0 + w - 1, base - y, tone(color, -0.3));
  }
  // Raízes saindo do pé
  g.px(cx - Math.ceil(width / 2), base, tone(color, -0.1));
  g.px(cx + Math.ceil(width / 2), base, tone(color, -0.25));
}

/**
 * Árvore de folha (carvalho, faia): tronco grosso e uma copa de 4 a 6 ovais. No inverno fica
 * só o galho; no outono, cada uma com a sua cor; na primavera, às vezes com flor.
 */
export function oakPiece(seed: number, foliage: Foliage, snow = false): Piece {
  const rnd = seeded(seed);
  const W = 38 + Math.floor(rnd() * 8);
  const H = 44 + Math.floor(rnd() * 10);
  const g = new Grid(M + W + 6 + M, M + H + 4 + M);
  const cx = M + Math.floor(W / 2);
  const base = M + H;
  const bole = 12 + Math.floor(rnd() * 5);
  trunk(g, cx, base, bole + 6, 5);
  if (foliage === "WINTER") {
    // Galhos pelados: cada um sobe torto e se divide na ponta
    const top = base - bole;
    for (let k = 0; k < 6; k++) {
      const dir = k % 2 === 0 ? -1 : 1;
      const sy = top - Math.floor(rnd() * 8);
      const len = 8 + Math.floor(rnd() * 10);
      const ex = cx + dir * len;
      const ey = sy - Math.round(len * (0.6 + rnd() * 0.5));
      g.line(cx, sy, ex, ey, TRUNK);
      g.line(cx + dir, sy, ex, ey + 1, tone(TRUNK, -0.2));
      g.line(ex, ey, ex + dir * 3, ey - 4, tone(TRUNK, 0.12));
      g.line(ex, ey, ex - dir * 2, ey - 5, tone(TRUNK, 0.12));
      if (snow) g.px(ex, ey - 1, SNOW);
    }
    g.line(cx, top, cx, top - 18, TRUNK);
  } else {
    const color = foliage === "AUTUMN" ? AUTUMN[Math.floor(rnd() * AUTUMN.length)] : LEAVES[foliage];
    const top = base - H + 2;
    const mid = Math.round((top + base - bole) / 2) - 2;
    const span = Math.floor(W / 2) - 2;
    // Os ovais de baixo primeiro (mais escuros), o de cima por último
    crown(g, cx - Math.round(span * 0.45), mid + 4, Math.round(span * 0.55), 8, tone(color, -0.08), rnd);
    crown(g, cx + Math.round(span * 0.45), mid + 5, Math.round(span * 0.55), 8, tone(color, -0.12), rnd);
    crown(g, cx, mid, span - 2, 10, color, rnd);
    crown(g, cx - 3 + Math.floor(rnd() * 6), top + 8, Math.round(span * 0.6), 8, tone(color, 0.04), rnd);
    if (foliage === "SPRING" && rnd() < 0.35) {
      // Flor de primavera, em poucas árvores
      const bloom = rnd() < 0.5 ? 0xf2e6ee : 0xf0b8c8;
      for (let k = 0; k < 14; k++) g.px(cx - span + Math.floor(rnd() * span * 2), top + 3 + Math.floor(rnd() * (mid - top + 6)), bloom);
    }
    if (snow) for (let x = -span + 3; x <= span - 3; x++) if (rnd() < 0.7) g.px(cx + x, top + 3 + Math.round(Math.abs(x) * 0.5), SNOW);
  }
  g.outline();
  dropShadow(g, base - 8);
  return { grid: g, dx: -cx, dy: -base };
}

/**
 * Pinheiro: tronco curto e camadas em triângulo, cada uma mais larga que a de cima, com a
 * borda de baixo escura. Não muda com a estação; na neve, cada camada leva a sua por cima.
 */
export function pinePiece(seed: number, snow = false): Piece {
  const rnd = seeded(seed);
  const tiers = 4 + Math.floor(rnd() * 2);
  const W = 24 + Math.floor(rnd() * 8);
  const H = 50 + Math.floor(rnd() * 14);
  const g = new Grid(M + W + 6 + M, M + H + 4 + M);
  const cx = M + Math.floor(W / 2);
  const base = M + H;
  const color = tone(PINE, rnd() * 0.12 - 0.06);
  trunk(g, cx, base, 9, 4);
  const top = base - H + 2;
  const bottom = base - 6;
  const step = (bottom - top) / tiers;
  for (let k = 0; k < tiers; k++) {
    const y0 = Math.round(top + k * step * 0.82);
    const y1 = Math.round(top + (k + 1) * step + 3);
    const half = Math.round(4 + ((k + 1) / tiers) * (W / 2 - 4));
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const w = Math.max(1, Math.round(half * t + 1));
      for (let x = -w; x <= w; x++) {
        // Borda de baixo serrilhada: as pontas dos galhos
        if (y === y1 && (x + k) % 3 === 0) continue;
        const side = x / Math.max(1, w);
        const shade = side < -0.35 ? 0.2 : side > 0.4 ? -0.28 : 0;
        const under = y >= y1 - 1 ? -0.3 : 0;
        const grain = rnd() < 0.12 ? -0.1 : 0;
        g.px(cx + x, y, tone(color, shade + under + grain));
      }
    }
    if (snow) {
      // A neve assenta no lado de cima de cada camada
      for (let x = -half + 1; x <= Math.round(half * 0.6); x++) {
        const y = Math.round(y0 + (Math.abs(x) / half) * (y1 - y0)) + 1;
        g.px(cx + x, y, x < 0 ? SNOW : SNOW_SHADE);
        if (rnd() < 0.4) g.px(cx + x, y + 1, SNOW_SHADE);
      }
    }
  }
  g.px(cx, top - 1, tone(color, 0.15));
  g.outline();
  dropShadow(g, base - 6);
  return { grid: g, dx: -cx, dy: -base };
}

/** Moita: dois ou três ovais baixos; no outono, avermelhada; no inverno, só gravetos. */
export function bushPiece(seed: number, foliage: Foliage, snow = false): Piece {
  const rnd = seeded(seed);
  const W = 16 + Math.floor(rnd() * 8);
  const g = new Grid(M + W + 4 + M, M + 16 + M);
  const cx = M + Math.floor(W / 2);
  const base = M + 14;
  if (foliage === "WINTER") {
    for (let k = 0; k < 7; k++) {
      const x = cx - 6 + Math.floor(rnd() * 13);
      g.line(x, base, x + Math.floor(rnd() * 5) - 2, base - 5 - Math.floor(rnd() * 5), TRUNK);
    }
    if (snow) g.rect(cx - 5, base - 2, 11, 2, SNOW);
  } else {
    const color = foliage === "AUTUMN" ? (rnd() < 0.5 ? 0x9a4a2a : 0xb87a2a) : tone(LEAVES[foliage], -0.06);
    const half = Math.floor(W / 2) - 1;
    crown(g, cx - Math.round(half * 0.4), base - 4, Math.round(half * 0.6), 4, tone(color, -0.06), rnd);
    crown(g, cx + Math.round(half * 0.4), base - 4, Math.round(half * 0.6), 4, tone(color, -0.1), rnd);
    crown(g, cx, base - 6, Math.round(half * 0.65), 5, color, rnd);
    // Frutinhas em algumas moitas
    if (foliage === "SUMMER" && rnd() < 0.3) for (let k = 0; k < 5; k++) g.px(cx - half + 2 + Math.floor(rnd() * (half * 2 - 3)), base - 8 + Math.floor(rnd() * 5), 0xb03030);
    if (snow) for (let x = -half + 2; x <= half - 2; x++) g.px(cx + x, base - 10 + Math.round(Math.abs(x) * 0.4), SNOW);
  }
  g.outline();
  dropShadow(g, base - 3);
  return { grid: g, dx: -cx, dy: -base };
}

/** Pedra: um bloco gasto com a face de cima clara, uma racha e, onde é verde, musgo. */
export function rockPiece(seed: number, big: boolean, mossy: boolean, snow = false): Piece {
  const rnd = seeded(seed);
  const W = big ? 22 + Math.floor(rnd() * 8) : 10 + Math.floor(rnd() * 5);
  const H = big ? 14 + Math.floor(rnd() * 5) : 7 + Math.floor(rnd() * 3);
  const g = new Grid(M + W + 5 + M, M + H + 3 + M);
  const cx = M + Math.floor(W / 2);
  const base = M + H;
  const color = tone(ROCK, rnd() * 0.16 - 0.1);
  const rx = Math.floor(W / 2);
  const ry = Math.floor(H / 2);
  const cy = base - ry;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      // Mais chata embaixo, com a quina de cima cortada
      const d = (x * x) / ((rx + 0.3) * (rx + 0.3)) + (y * y) / ((ry + 0.3) * (ry + 0.3));
      if (d > 1 || (y < -ry * 0.55 && Math.abs(x) > rx * 0.7)) continue;
      const top = y < -ry * 0.25;
      const right = x > rx * 0.35;
      g.px(cx + x, cy + y, tone(color, top ? 0.24 : right ? -0.28 : rnd() < 0.15 ? -0.08 : 0));
    }
  }
  // Racha
  let x = cx - Math.floor(rx * 0.3) + Math.floor(rnd() * rx * 0.6);
  for (let y = cy - Math.floor(ry * 0.3); y < base - 1; y++) {
    g.px(x, y, tone(color, -0.4));
    if (rnd() < 0.4) x += rnd() < 0.5 ? -1 : 1;
  }
  if (snow) for (let i = -rx + 2; i <= rx - 2; i++) g.px(cx + i, cy - ry + 1 + (Math.abs(i) > rx * 0.6 ? 1 : 0), SNOW);
  else if (mossy) for (let k = 0; k < (big ? 12 : 4); k++) g.px(cx - rx + 2 + Math.floor(rnd() * (rx * 1.4)), cy - ry + 1 + Math.floor(rnd() * 3), tone(MOSS, rnd() * 0.2 - 0.1));
  g.outline();
  dropShadow(g, base - 2);
  return { grid: g, dx: -cx, dy: -base };
}

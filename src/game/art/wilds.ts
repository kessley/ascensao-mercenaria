import { CLEAR, Grid, seeded } from "./pixel";
import { M, SH, dropShadow, flagstones, log, prism, pyramid, speckle, stoneFace, tone, type Piece } from "./buildings";

/**
 * Ermos em pixel art (G3): os covis das calamidades (a torre negra do necromante e o acampamento
 * de guerra orc) e o que marca os locais de contrato (barracas de bandidos, choupanas goblins,
 * ruínas assombradas e o vau do pântano). As regras são as das construções: o pé fica no chão e
 * a profundidade sai da linha de baixo dele. Peças miúdas têm a âncora no meio do pé.
 */

const BONE = 0xd8d2c0;
const BARK = 0x3a3028;
const DARK_STONE = 0x3e3848;
/** Luz do necromante: janelas, braseiros e a pedra do topo da torre. */
export const NECRO_GLOW = 0xb070e0;

/**
 * Torre negra do necromante, com o pé de `s`×`s`: pedra escura em fiadas, janelas estreitas
 * com a luz roxa, a porta em arco no lado sul e a agulha com a pedra acesa no alto.
 */
export function darkTowerPiece(s: number, seed: number): Piece {
  const rnd = seeded(seed);
  const F = 118;
  const spire = Math.round(s * 0.95);
  const g = new Grid(M + 6 + s + 6 + SH + M, M + 8 + spire + F + SH + M);
  const ox = M + 6;
  // A ponta da agulha fica no alto da grade (a agulha sobe da beira sul do topo)
  const oy = M + 8 + spire + F - s;
  prism(ox, oy, 0, 0, s, s, 0, F, (x, y, w, h) => flagstones(g, x, y, w, h, tone(DARK_STONE, 0.1), rnd), (x, y, w, h) => {
    stoneFace(g, x, y, w, h, DARK_STONE, rnd);
    // Rachas e musgo seco descendo a pedra
    for (let k = 0; k < 4; k++) {
      let cx = x + 4 + Math.floor(rnd() * (w - 8));
      let cy = y + 8 + Math.floor(rnd() * (h - 40));
      for (let n = 0; n < 10; n++) {
        g.px(cx, cy, tone(DARK_STONE, -0.45));
        cx += Math.floor(rnd() * 3) - 1;
        cy += 1;
      }
    }
    for (const wy of [14, 42, 70]) {
      for (const wx of [x + Math.round(w * 0.28) - 2, x + Math.round(w * 0.72) - 2]) {
        if (wy === 70 && wx > x + w / 2) continue;
        g.rect(wx - 1, y + wy - 1, 6, 13, tone(DARK_STONE, -0.3));
        g.rect(wx, y + wy, 4, 11, 0x5a2478);
        g.rect(wx + 1, y + wy + 2, 2, 7, NECRO_GLOW);
        g.px(wx + 1, y + wy + 3, 0xe8c8ff);
      }
    }
    // Porta em arco, com os degraus gastos
    const dw = 16;
    const dh = 26;
    const dx = x + Math.floor((w - dw) / 2);
    const dy = y + h - dh;
    g.rect(dx - 2, dy - 2, dw + 4, dh + 2, tone(DARK_STONE, 0.18));
    g.rect(dx, dy, dw, dh, 0x0e0a12);
    for (let i = 0; i < dw; i++) {
      const u = Math.abs((i + 0.5 - dw / 2) / (dw / 2));
      const cut = Math.round(5 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
      for (let d = 0; d < cut; d++) g.px(dx + i, dy + d, tone(DARK_STONE, 0.18));
    }
    g.rect(dx + 3, dy + 10, dw - 6, 1, 0x3a1a4a);
    g.rect(dx - 4, y + h - 1, dw + 8, 1, tone(DARK_STONE, 0.3));
  });
  // Agulha sobre o topo, e a pedra acesa na ponta
  pyramid(g, ox - 4, oy - F - spire + s, s + 8, spire, 0x2a2232, false);
  const apex = oy - F - spire + s;
  g.rect(ox + Math.round(s / 2) - 1, apex - 4, 3, 4, CLEAR);
  g.oval(ox + Math.round(s / 2), apex - 5, 2, 2, NECRO_GLOW);
  g.px(ox + Math.round(s / 2) - 1, apex - 6, 0xf0e0ff);
  g.outline();
  dropShadow(g, oy - F + s);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Sepultura: lápide (0), cruz de madeira torta (1) ou cova aberta com a terra do lado (2). */
export function gravePiece(kind: number, seed: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 26 + SH + M, M + 26 + SH + M);
  const cx = M + 12;
  const base = M + 22;
  // Monte de terra comprido na frente
  g.oval(cx, base + 1, 8, 2, 0x5a4632);
  g.rect(cx - 6, base, 12, 1, 0x6a5440);
  if (kind === 0) {
    const c = rnd() < 0.5 ? 0x8e8a80 : 0x7c786e;
    const lean = rnd() < 0.4 ? 1 : 0;
    g.rect(cx - 5 + lean, base - 15, 11, 15, c);
    g.rect(cx - 4 + lean, base - 17, 9, 2, c);
    g.rect(cx - 2 + lean, base - 18, 5, 1, c);
    g.rect(cx - 5 + lean, base - 15, 1, 15, tone(c, 0.2));
    g.rect(cx + 5 + lean, base - 15, 1, 15, tone(c, -0.3));
    g.rect(cx - 2 + lean, base - 12, 5, 1, tone(c, -0.35));
    g.rect(cx - 2 + lean, base - 9, 5, 1, tone(c, -0.35));
    if (rnd() < 0.5) g.px(cx + 3 + lean, base - 4, 0x5a6a3a);
  } else if (kind === 1) {
    const wood = 0x5a4430;
    g.line(cx, base, cx + 2, base - 19, wood);
    g.line(cx + 1, base, cx + 3, base - 19, tone(wood, -0.25));
    g.rect(cx - 4, base - 14, 11, 2, wood);
    g.rect(cx - 4, base - 14, 11, 1, tone(wood, 0.2));
  } else {
    g.oval(cx - 2, base - 2, 7, 3, 0x120c0a);
    g.oval(cx - 2, base - 3, 6, 1, 0x1c140e);
    g.oval(cx + 8, base - 3, 4, 3, 0x6a5232);
    g.oval(cx + 8, base - 4, 3, 2, 0x7a6240);
    g.line(cx + 6, base - 12, cx + 9, base - 3, 0x6b4a2b);
    g.rect(cx + 4, base - 13, 4, 2, 0x5a5a60);
  }
  g.outline();
  dropShadow(g, base - 20);
  return { grid: g, dx: -cx, dy: -base };
}

/** Árvore morta: tronco escuro afinando para cima, galhos tortos e gravetos. */
export function deadTreePiece(seed: number): Piece {
  const rnd = seeded(seed);
  const W = 48;
  const H = 80;
  const g = new Grid(M + W + SH + M, M + H + SH + M);
  const cx = M + Math.floor(W / 2);
  const base = M + H - 3;
  const top = base - 38 - Math.floor(rnd() * 10);
  for (let y = top; y <= base; y++) {
    const t = (y - top) / (base - top);
    const half = Math.round(1 + t * 2.4);
    const bend = Math.round(Math.sin(t * 3 + seed) * 1.5);
    g.rect(cx - half + bend, y, half * 2 + 1, 1, BARK);
    g.px(cx - half + bend, y, tone(BARK, 0.2));
    g.px(cx + half + bend, y, tone(BARK, -0.3));
  }
  // Raízes
  g.line(cx - 3, base, cx - 8, base + 2, BARK);
  g.line(cx + 3, base, cx + 7, base + 2, BARK);
  // Galhos: cada um sobe torto para um lado, com um graveto na ponta
  const branches = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < branches; k++) {
    const dir = k % 2 === 0 ? -1 : 1;
    const sy = top + Math.floor(rnd() * (base - top) * 0.55);
    const len = 8 + Math.floor(rnd() * 10);
    const ex = cx + dir * len;
    const ey = sy - Math.round(len * (0.5 + rnd() * 0.6));
    g.line(cx, sy, ex, ey, BARK);
    g.line(cx, sy + 1, ex, ey + 1, tone(BARK, -0.2));
    g.line(ex, ey, ex + dir * (2 + Math.floor(rnd() * 4)), ey - 3 - Math.floor(rnd() * 4), tone(BARK, 0.1));
    if (rnd() < 0.6) g.line(ex, ey, ex - dir * 2, ey - 4, tone(BARK, 0.1));
  }
  g.line(cx, top, cx + Math.floor(rnd() * 5) - 2, top - 6, BARK);
  g.outline();
  dropShadow(g, base - 6);
  return { grid: g, dx: -cx, dy: -base };
}

/** Braseiro de ferro num tripé, com a chama roxa (necromante) ou de fogo comum. */
export function brazierPiece(purple: boolean): Piece {
  const g = new Grid(M + 18 + SH + M, M + 30 + SH + M);
  const cx = M + 8;
  const base = M + 28;
  const iron = 0x3a3a40;
  g.line(cx - 5, base, cx - 1, base - 12, iron);
  g.line(cx + 5, base, cx + 1, base - 12, iron);
  g.line(cx, base - 1, cx, base - 12, iron);
  g.oval(cx, base - 13, 6, 2, iron);
  g.rect(cx - 6, base - 13, 13, 1, 0x5a5a64);
  const [outer, inner, core] = purple ? [0x5a2478, NECRO_GLOW, 0xf0e0ff] : [0xc85a1a, 0xf0a030, 0xf8e070];
  g.oval(cx, base - 16, 4, 3, outer);
  g.rect(cx - 2, base - 21, 5, 4, outer);
  g.rect(cx - 1, base - 23, 3, 5, inner);
  g.rect(cx, base - 26, 1, 4, core);
  g.px(cx - 2, base - 24, inner);
  g.outline();
  dropShadow(g, base - 12);
  return { grid: g, dx: -cx, dy: -base };
}

/** Monte de ossos com uma caveira por cima. */
export function bonesPiece(seed: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 34 + SH + M, M + 16 + SH + M);
  const cx = M + 16;
  const base = M + 13;
  for (let k = 0; k < 7; k++) {
    const x = cx - 11 + Math.floor(rnd() * 20);
    const y = base - 6 + Math.floor(rnd() * 6);
    const dx = rnd() < 0.5 ? 6 : -6;
    const dy = Math.floor(rnd() * 5) - 2;
    g.line(x, y, x + dx, y + dy, rnd() < 0.3 ? tone(BONE, -0.15) : BONE);
    g.px(x, y - 1, BONE);
    g.px(x + dx, y + dy + 1, BONE);
  }
  // Caveira
  const sx = cx + Math.floor(rnd() * 7) - 3;
  const sy = base - 7;
  g.oval(sx, sy, 3, 3, BONE);
  g.rect(sx - 2, sy + 2, 5, 2, tone(BONE, -0.1));
  g.px(sx - 1, sy, 0x1c1714);
  g.px(sx + 1, sy, 0x1c1714);
  g.px(sx, sy + 2, 0x4a4038);
  g.outline();
  dropShadow(g, base - 8);
  return { grid: g, dx: -cx, dy: -base };
}

/** Totem de guerra: mastro com chifres na travessa, caveiras enfiadas e trapos na cor do dono. */
export function totemPiece(seed: number, rag: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 34 + SH + M, M + 70 + SH + M);
  const cx = M + 16;
  const base = M + 68;
  const wood = 0x5a4026;
  g.rect(cx - 2, base - 58, 4, 58, wood);
  g.rect(cx - 2, base - 58, 1, 58, tone(wood, 0.2));
  g.rect(cx + 1, base - 58, 1, 58, tone(wood, -0.3));
  // Travessa com os chifres
  g.rect(cx - 12, base - 50, 24, 3, tone(wood, -0.1));
  for (const dir of [-1, 1]) {
    const hx = cx + dir * 12;
    g.line(hx, base - 50, hx + dir * 3, base - 56, BONE);
    g.line(hx + dir * 3, base - 56, hx + dir * 2, base - 60, tone(BONE, -0.1));
    // Trapos pendurados
    for (let j = 0; j < 8 + Math.floor(rnd() * 5); j++) g.px(hx - dir * 2 + (j % 3 === 0 ? dir : 0), base - 47 + j, j % 4 === 0 ? tone(rag, -0.25) : rag);
  }
  // Caveiras enfiadas no mastro
  for (const y of [base - 60, base - 40, base - 28]) {
    g.oval(cx, y, 3, 3, BONE);
    g.rect(cx - 2, y + 2, 5, 2, tone(BONE, -0.12));
    g.px(cx - 1, y, 0x1c1714);
    g.px(cx + 1, y, 0x1c1714);
  }
  g.outline();
  dropShadow(g, base - 10);
  return { grid: g, dx: -cx, dy: -base };
}

/**
 * Choupana goblin com o pé de `w`×`h`: um monte de galhos e couro, a boca escura no lado sul e
 * varas espetadas saindo do alto.
 */
export function hutPiece(w: number, h: number, seed: number): Piece {
  const rnd = seeded(seed);
  const Z = Math.round(w * 0.55);
  const g = new Grid(M + 4 + w + 4 + SH + M, M + 10 + Z + h + SH + M);
  const ox = M + 4;
  const oy = M + 10 + Z;
  const straw = 0x7a6a3a;
  const hide = 0x6b4a32;
  const cx = ox + w / 2;
  const groundY = oy + h;
  // Cada coluna é um arco: sobe até a cumeeira e desce de volta (o fundo some atrás)
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5 - w / 2) / (w / 2);
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const topY = Math.round(groundY - h * 0.55 * s - Z * s);
    for (let y = topY; y < groundY; y++) {
      const shade = u < -0.3 ? 0.1 : u > 0.35 ? -0.18 : 0;
      g.px(ox + i, y, tone(straw, shade));
    }
  }
  // Remendos de couro e fios de palha
  for (let k = 0; k < 4; k++) {
    const px = ox + 4 + Math.floor(rnd() * (w - 14));
    const py = groundY - 10 - Math.floor(rnd() * (Z * 0.7));
    g.rect(px, py, 7 + Math.floor(rnd() * 5), 4 + Math.floor(rnd() * 3), tone(hide, rnd() < 0.5 ? 0 : -0.15));
  }
  for (let k = 0; k < (w * Z) / 10; k++) {
    const px = ox + Math.floor(rnd() * w);
    const py = groundY - Math.floor(rnd() * (Z + h * 0.5));
    if (g.get(px, py) === CLEAR) continue;
    g.px(px, py, tone(straw, rnd() < 0.5 ? -0.22 : 0.14));
  }
  // Boca escura no lado sul
  const dw = Math.max(8, Math.round(w * 0.28));
  for (let j = 0; j < Math.round(Z * 0.6); j++) {
    const half = Math.round((dw / 2) * Math.sqrt(j / (Z * 0.6)));
    for (let i = -half; i <= half; i++) g.px(Math.round(cx) + i, groundY - Math.round(Z * 0.6) + j, 0x1c140e);
  }
  // Varas saindo do alto
  const peak = Math.round(groundY - h * 0.55 - Z);
  for (let k = 0; k < 4; k++) {
    const x0 = Math.round(cx) - 4 + k * 3;
    g.line(x0, peak + 3, x0 - 3 + k * 2, peak - 6 - Math.floor(rnd() * 3), 0x5a4026);
  }
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Moita de juncos e taboas do pântano. */
export function reedsPiece(seed: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 26 + M, M + 30 + M);
  const cx = M + 13;
  const base = M + 28;
  const n = 6 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const x = cx - 9 + Math.floor(rnd() * 19);
    const tall = 12 + Math.floor(rnd() * 12);
    const lean = Math.floor(rnd() * 5) - 2;
    const c = rnd() < 0.5 ? 0x6a7a3a : 0x8a8a4a;
    g.line(x, base, x + lean, base - tall, c);
    if (rnd() < 0.4) g.rect(x + lean - 1, base - tall - 1, 2, 5, 0x6a4a2a);
  }
  g.outline();
  return { grid: g, dx: -cx, dy: -base };
}

/** Estacas podres fincadas na lama (marcam o vau), com musgo. */
export function postsPiece(seed: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 20 + SH + M, M + 30 + SH + M);
  const base = M + 28;
  const wet = 0x4a3a2a;
  for (const x of [M + 2, M + 11]) {
    if (x > M + 2 && rnd() < 0.35) continue;
    const top = base - 14 - Math.floor(rnd() * 12);
    log(g, x, top, base, wet);
    for (let k = 0; k < 3; k++) g.px(x + 1 + Math.floor(rnd() * 4), top + 4 + Math.floor(rnd() * (base - top - 6)), 0x5a7a3a);
  }
  g.outline();
  dropShadow(g, base - 10);
  return { grid: g, dx: -(M + 9), dy: -base };
}

/**
 * Cavalo-de-frisa de `len` px: uma trave no chão com estacas apontadas cruzando em X. O pé é a
 * faixa da trave (âncora no canto de cima e da esquerda).
 */
export function spikesPiece(len: number, seed: number): Piece {
  const rnd = seeded(seed);
  const Z = 20;
  const g = new Grid(M + 6 + len + 6 + SH + M, M + Z + 12 + SH + M);
  const ox = M + 6;
  const oy = M + Z;
  const wood = 0x5a4026;
  g.rect(ox, oy + 4, len, 4, wood);
  g.rect(ox, oy + 4, len, 1, tone(wood, 0.2));
  for (let x = 4; x < len; x += 11) {
    const lean = Math.floor(rnd() * 3) - 1;
    for (const dir of [-1, 1]) {
      const x0 = ox + x - dir * 5;
      const x1 = ox + x + dir * 6 + lean;
      g.line(x0, oy + 10, x1, oy - Z + 8, tone(wood, dir < 0 ? 0.08 : -0.12));
      g.line(x0 + 1, oy + 10, x1 + 1, oy - Z + 8, tone(wood, -0.25));
      g.px(x1, oy - Z + 7, 0xc8b088);
    }
  }
  g.outline();
  dropShadow(g, oy - 4);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Pedaço de muro de pedra caído, com o topo serrilhado e pedras soltas no pé (ruínas). */
export function ruinWallPiece(len: number, seed: number): Piece {
  const rnd = seeded(seed);
  const T = 12;
  const Fmax = 40;
  const g = new Grid(M + len + SH + M + 6, M + Fmax + T + 8 + SH + M);
  const ox = M;
  const oy = M + Fmax;
  const stone = 0x8a857a;
  // A altura de cada trecho cai e sobe aos solavancos
  let f = 14 + Math.floor(rnd() * 20);
  for (let x = 0; x < len; x += 4) {
    f = Math.max(6, Math.min(Fmax, f + Math.floor(rnd() * 15) - 7));
    const w = Math.min(4, len - x);
    prism(ox, oy, x, 0, w, T, 0, f, (px, py, ww, hh) => {
      g.rect(px, py, ww, hh, tone(stone, 0.18));
      speckle(g, px, py, ww, hh, stone, 0.2, rnd);
    }, (px, py, ww, hh) => stoneFace(g, px, py, ww, hh, tone(stone, -0.05), rnd));
  }
  // Pedras caídas na frente
  for (let k = 0; k < Math.round(len / 14); k++) {
    const px = ox + Math.floor(rnd() * len);
    const py = oy + T + 2 + Math.floor(rnd() * 5);
    g.oval(px, py, 2 + Math.floor(rnd() * 2), 2, tone(stone, -0.2 - rnd() * 0.2));
  }
  // Hera nos pés do muro
  for (let k = 0; k < len / 3; k++) g.px(ox + Math.floor(rnd() * len), oy + T - Math.floor(rnd() * 12), 0x4a6a32);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

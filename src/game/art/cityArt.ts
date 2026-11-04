import { Grid, gridBitmap, seeded, type Bitmap } from "./pixel";
import {
  M,
  MERLON,
  SH,
  STYLES,
  crenels,
  dome,
  dropShadow,
  facade,
  flagstones,
  flatRoof,
  gableHall,
  prism,
  pyramid,
  roofEW,
  speckle,
  stoneFace,
  tone,
  type Culture,
  type Piece,
} from "./buildings";

/**
 * A Cidade Alta das capitais em pixel art (G4, parte 5): o que a capital tem e os povoados do
 * continente não. A torre de menagem e os paços de pedra do pátio do castelo (a muralha em volta
 * já é a do castelo), os palácios do Bairro Nobre com o jardim na frente, o chafariz, o lampião,
 * a lápide e as lajes do calçamento (padrões que se repetem sem emenda).
 */

const DARK = 0x1c1714;

/** Janela em arco na pedra: o vão escuro, a ponta arredondada e um fio de vidro. */
function archWindow(g: Grid, x: number, y: number, w: number, h: number, stone: number, glass: number): void {
  g.rect(x - 1, y - 1, w + 2, h + 2, tone(stone, -0.28));
  g.rect(x, y, w, h, DARK);
  g.px(x, y, tone(stone, -0.28));
  g.px(x + w - 1, y, tone(stone, -0.28));
  g.rect(x + 1, y + 2, w - 2, 1, tone(glass, 0.3));
}

/** Porta grande em arco, com as folhas de tábua e o degrau. */
function archDoor(g: Grid, cx: number, bottom: number, w: number, h: number, stone: number, door: number, base: number): void {
  const x = Math.round(cx - w / 2);
  const y = bottom - h;
  g.rect(x - 3, y - 3, w + 6, h + 3, tone(stone, -0.3));
  g.rect(x, y, w, h, door);
  for (let i = 2; i < w; i += 4) g.rect(x + i, y, 1, h, tone(door, -0.22));
  g.rect(x + Math.floor(w / 2), y, 1, h, tone(door, -0.4));
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [w - 1, 0], [w - 2, 0], [w - 1, 1]]) g.px(x + dx, y + dy, tone(stone, -0.3));
  g.px(x + Math.floor(w / 2) - 2, y + Math.floor(h / 2), 0xc9a23a);
  g.px(x + Math.floor(w / 2) + 2, y + Math.floor(h / 2), 0xc9a23a);
  g.rect(x - 6, bottom - 2, w + 12, 2, tone(base, 0.28));
}

/**
 * Torre de menagem (e os paços grandes do pátio do castelo): um bloco de pedra alto, com fileiras
 * de janelas em arco, ameias em volta do topo, torreões nos quatro cantos e, se for grande, a
 * torre do meio subindo acima de tudo.
 */
export function donjonPiece(w: number, h: number, culture: Culture, doorX: number, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const stone = st.stone;
  const FD = Math.max(56, Math.min(110, Math.round(Math.min(w, h) * 0.16)));
  const ts = Math.max(36, Math.min(96, Math.round(Math.min(w, h) * 0.17)));
  const FT = FD + 26;
  const big = w >= 700;
  const cw = Math.round(w * 0.34);
  const chh = Math.round(h * 0.34);
  const FC = FD + 58;
  const roofed = culture === "ISLES" || culture === "JADE";
  const lift = Math.max(FT, big ? FC : 0) + MERLON + 4 + (roofed ? Math.round(ts * 0.7) + 40 : 0) + (culture === "SANDS" ? Math.round(w * 0.2) : 0);
  const g = new Grid(M + w + SH + M + 8, M + lift + h + SH + M);
  const ox = M + 4;
  const oy = M + lift;
  const top = (x: number, y: number, ww: number, hh: number) => flagstones(g, x, y, ww, hh, tone(stone, 0.12), rnd);
  const windows = (x: number, y: number, ww: number, hh: number, skip: number | null) => {
    const rows = Math.max(1, Math.floor((hh - 22) / 24));
    for (let r = 0; r < rows; r++) {
      const wy = y + 10 + r * 24;
      for (let px = x + 14; px < x + ww - 14; px += 22) {
        if (skip !== null && r === rows - 1 && Math.abs(px + 3 - skip) < 30) continue;
        archWindow(g, px, wy, 6, 11, stone, st.glass);
      }
    }
  };
  // O bloco
  prism(ox, oy, 0, 0, w, h, 0, FD, top, (x, y, ww, hh) => {
    stoneFace(g, x, y, ww, hh, stone, rnd);
    windows(x, y, ww, hh, ox + doorX);
    archDoor(g, ox + doorX, y + hh, Math.min(36, Math.round(w * 0.06) + 16), Math.min(hh - 10, 34), stone, st.door, st.base);
  });
  if (roofed) roofEW(g, ox - 4, oy - FD - 36, w + 8, h + 36, st.accent, culture === "JADE" ? "CURVED" : "STEEP", false, rnd);
  else {
    // O telhado de ardósia escondido atrás do parapeito, com o adarve em volta
    if (culture !== "SANDS") {
      const inset = Math.max(10, Math.round(Math.min(w, h) * 0.05));
      roofEW(g, ox + inset, oy - FD + inset, w - inset * 2, h - inset * 2, st.accent, "GABLE", false, rnd);
    }
    crenels(g, ox, oy, 0, 0, w, h, FD, stone, "NSEW", rnd, false, culture === "SANDS");
  }
  // A torre do meio, recuada para o fundo
  if (big && !roofed) {
    const cx = Math.round((w - cw) / 2);
    const cy = Math.round(h * 0.12);
    prism(ox, oy, cx, cy, cw, chh, 0, FC, top, (x, y, ww, hh) => {
      stoneFace(g, x, y, ww, hh, tone(stone, 0.04), rnd);
      for (let px = x + 12; px < x + ww - 12; px += 22) archWindow(g, px, y + 12, 6, 11, stone, st.glass);
    });
    crenels(g, ox, oy, cx, cy, cw, chh, FC, stone, "NSEW", rnd, false, culture === "SANDS");
  }
  if (culture === "SANDS") dome(g, ox + Math.round(w / 2), oy + Math.round(h * 0.5) - FD, Math.round(w * 0.2), Math.round(w * 0.16), st.accent);
  // Torreões dos cantos: os de trás primeiro
  const turret = (fx: number, fy: number) => {
    prism(ox, oy, fx, fy, ts, ts, 0, FT, top, (x, y, ww, hh) => {
      stoneFace(g, x, y, ww, hh, tone(stone, -0.04), rnd);
      g.rect(x + Math.floor(ww / 2) - 1, y + 12, 3, 8, DARK);
      g.rect(x + Math.floor(ww / 2) - 1, y + 34, 3, 8, DARK);
    });
    if (roofed) pyramid(g, ox + fx - 3, oy + fy - FT - Math.round(ts * 0.7), ts + 6, Math.round(ts * 0.7) + 4, st.accent, culture === "JADE");
    else crenels(g, ox, oy, fx, fy, ts, ts, FT, stone, "NSEW", rnd, false, culture === "SANDS");
  };
  turret(0, 0);
  turret(w - ts, 0);
  turret(0, h - ts);
  turret(w - ts, h - ts);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Onde a torre do meio da torre de menagem termina (para o estandarte no alto), a partir do canto do pé. */
export function donjonTop(w: number, h: number): { x: number; y: number } | null {
  if (w < 700) return null;
  const FD = Math.max(56, Math.min(110, Math.round(Math.min(w, h) * 0.16)));
  return { x: Math.round(w / 2), y: Math.round(h * 0.12) + Math.round(h * 0.17) - FD - 58 };
}

/**
 * Paço de pedra (Sala do Conselho, Biblioteca, Arsenal, a porta da masmorra): parede de pedra com
 * janelas em arco e o telhado da cultura por cima; os grandes ganham mansardas e chaminés.
 */
export function stoneHallPiece(w: number, h: number, culture: Culture, roofIndex: number, doorX: number, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const kind = st.roof;
  const ov = kind === "FLAT" ? 0 : kind === "CURVED" ? 4 : 3;
  const lift = kind === "STEEP" ? 12 : kind === "CURVED" ? 4 : 0;
  const H = Math.max(36, Math.min(56, Math.round(h * 0.14)));
  const g = new Grid(M + ov + w + ov + SH + M + 2, M + 6 + lift + h + H + SH + M);
  const ox = M + ov;
  const ry = M + 6;
  const fy = ry + lift + h;
  const stone = st.stone;
  stoneFace(g, ox, fy, w, H, stone, rnd);
  for (let px = ox + 12; px < ox + w - 12; px += 24) if (Math.abs(px + 3 - (ox + doorX)) > 26) archWindow(g, px, fy + 10, 6, Math.min(14, H - 20), stone, st.glass);
  archDoor(g, ox + doorX, fy + H, 20, Math.min(H - 8, 24), stone, st.door, st.base);
  const color = roofIndex < 0 ? st.accent : st.roofs[roofIndex % st.roofs.length];
  let ridge = 0;
  if (kind === "FLAT") flatRoof(g, ox, ry, w, lift + h + 1, color, rnd);
  else ridge = roofEW(g, M, ry, w + ov * 2, lift + h + 2, color, kind, false, rnd);
  if (kind !== "FLAT") {
    // Mansardas na água da frente, uma a cada tanto
    const n = Math.floor(w / 150);
    for (let k = 0; k < n; k++) {
      const mx = ox + Math.round(((k + 0.5) * w) / n) - 7;
      const my = ry + ridge + Math.round((lift + h - ridge) * 0.35);
      g.rect(mx, my, 14, 10, tone(stone, 0.1));
      g.rect(mx + 4, my + 3, 6, 6, st.glass);
      g.rect(mx + 7, my + 3, 1, 6, tone(st.glass, 0.3));
      for (let r = 0; r < 6; r++) g.rect(mx - 2 + r, my - 6 + r, 18 - r * 2, 1, r === 0 ? tone(color, 0.25) : color);
      g.rect(mx - 2, my, 18, 1, tone(color, -0.3));
    }
    // Chaminés de pedra na água de trás, rente à cumeeira
    for (let k = 0; k < Math.max(1, Math.floor(w / 220)); k++) {
      const cx = ox + 10 + Math.floor(rnd() * Math.max(1, w - 26));
      const cy = ry + ridge - 16;
      g.rect(cx, cy, 7, 17, st.base);
      g.rect(cx, cy, 7, 2, tone(st.base, 0.25));
      g.rect(cx + 1, cy, 5, 1, DARK);
      g.rect(cx + 6, cy + 2, 1, 15, tone(st.base, -0.25));
    }
    for (let i = ox; i < ox + w; i++) g.px(i, fy + 2, tone(g.get(i, fy + 2), -0.3));
  } else dome(g, ox + Math.round(w / 2), ry + Math.round(h * 0.6), Math.round(w * 0.16), Math.round(w * 0.12), st.accent);
  g.outline();
  dropShadow(g, fy);
  return { grid: g, dx: -ox, dy: -(ry + lift + H) };
}

/**
 * Palácio de uma casa nobre: a ala do fundo, de dois andares, as duas alas dos lados com a
 * empena virada para a rua e, entre elas, o jardim (canteiros, sebes, o caminho de saibro e um
 * chafariz), fechado por uma mureta com o portão em `doorX`.
 */
export function palacePiece(w: number, h: number, culture: Culture, roofIndex: number, doorX: number, seed: number): Piece {
  const st = STYLES[culture];
  const rnd = seeded(seed);
  const kind = st.roof;
  const ov = kind === "FLAT" ? 0 : kind === "CURVED" ? 4 : 3;
  const lift = kind === "STEEP" ? 12 : kind === "CURVED" ? 4 : 0;
  const H = st.facade * 2;
  const bh = Math.round(h * 0.42);
  const ww = Math.max(40, Math.round(w * 0.2));
  const g = new Grid(M + ov + w + ov + SH + M + 2, M + 4 + lift + H + h + SH + M);
  const ox = M + ov;
  const oy = M + 4 + lift + H;
  const color = st.roofs[roofIndex % st.roofs.length];
  // Ala do fundo: telhado e os dois andares de fachada
  if (kind === "FLAT") flatRoof(g, ox, oy - H, w, bh, color, rnd);
  else roofEW(g, M, oy - H - lift, w + ov * 2, lift + bh + 1, color, kind, false, rnd);
  facade(g, ox, oy + bh - H, w, H / 2, st, culture, null, rnd, false);
  facade(g, ox, oy + bh - H / 2, w, H / 2, st, culture, ox + doorX, rnd, false);
  if (kind !== "FLAT") for (let i = ox; i < ox + w; i++) g.px(i, oy + bh - H + 2, tone(g.get(i, oy + bh - H + 2), -0.3));
  if (culture === "SANDS") dome(g, ox + Math.round(w / 2), oy + Math.round(bh * 0.6) - H, Math.round(w * 0.12), Math.round(w * 0.1), st.accent);
  // Jardim
  const gy = oy + bh;
  const gh = h - bh;
  const grass = 0x5f8a52;
  g.rect(ox, gy, w, gh, grass);
  speckle(g, ox, gy, w, gh, grass, 0.12, rnd);
  const hedge = 0x34552a;
  for (const hx of [ox + ww + 6, ox + w - ww - 12]) {
    g.rect(hx, gy + 8, 6, gh - 22, hedge);
    g.rect(hx, gy + 8, 6, 1, tone(hedge, 0.3));
    g.rect(hx + 5, gy + 9, 1, gh - 23, tone(hedge, -0.3));
  }
  const path = 0xcabd9c;
  const px0 = ox + doorX - 9;
  g.rect(px0, gy, 18, gh, path);
  speckle(g, px0, gy, 18, gh, path, 0.2, rnd);
  g.rect(px0 - 1, gy, 1, gh, tone(path, -0.3));
  g.rect(px0 + 18, gy, 1, gh, tone(path, -0.3));
  // Canteiros de flores dos dois lados do caminho
  const flowers = [0xe0c050, 0xd85a4a, 0xe8e2d0, 0xb070c8];
  for (const side of [-1, 1]) {
    const bw = Math.max(20, Math.round((w - ww * 2) / 2 - 44));
    const bx = side < 0 ? px0 - 14 - bw : px0 + 32;
    for (let by = gy + 14; by + 12 < gy + gh - 16; by += 26) {
      g.rect(bx, by, bw, 12, 0x5a3e26);
      g.rect(bx, by, bw, 1, tone(0x5a3e26, 0.25));
      for (let i = 1; i < bw - 1; i += 2) for (let j = 2; j < 11; j += 3) if (rnd() < 0.7) g.px(bx + i, by + j, flowers[Math.floor(rnd() * flowers.length)]);
    }
  }
  // Chafariz no caminho
  const fx = ox + doorX;
  const fyy = gy + Math.round(gh * 0.45);
  g.oval(fx, fyy, 11, 7, tone(st.base, 0.25));
  g.oval(fx, fyy, 8, 5, 0x3a7a9a);
  g.rect(fx - 1, fyy - 8, 3, 9, tone(st.base, 0.3));
  g.px(fx, fyy - 9, 0xd8eef4);
  g.px(fx - 2, fyy - 4, 0xd8eef4);
  g.px(fx + 2, fyy - 4, 0xd8eef4);
  // Alas dos lados, com a empena para a rua
  const wy = Math.round(bh * 0.5);
  const wh = h - wy - 10;
  if (kind === "FLAT") {
    for (const wx of [0, w - ww]) prism(ox, oy, wx, wy, ww, wh, 0, H, (x, y, a, b) => flatRoof(g, x, y, a, b, color, rnd), (x, y, a, b) => facade(g, x, y, a, b, st, culture, null, rnd, false));
  } else for (const wx of [0, w - ww]) gableHall(g, ox, oy, wx, wy, ww, wh, H / 2 + 6, Math.round(ww * 0.32), st, culture, tone(color, -0.06), null, rnd, false);
  // Mureta da frente com o portão de ferro entre dois pilares
  const wallY = oy + h - 8;
  for (let x = ox + ww; x < ox + w - ww; x++) {
    if (Math.abs(x + 0.5 - (ox + doorX)) < 12) continue;
    g.rect(x, wallY - 4, 1, 4, tone(st.stone, 0.25));
    g.rect(x, wallY, 1, 8, (x - ox) % 8 === 0 ? tone(st.stone, -0.25) : st.stone);
  }
  for (const side of [-1, 1]) {
    const pxx = ox + doorX + side * 12 - (side < 0 ? 5 : 0);
    g.rect(pxx, wallY - 14, 5, 22, tone(st.stone, 0.1));
    g.rect(pxx, wallY - 14, 5, 2, tone(st.stone, 0.35));
    g.rect(pxx + 4, wallY - 12, 1, 20, tone(st.stone, -0.3));
    g.px(pxx + 2, wallY - 16, 0xc9a23a);
    g.px(pxx + 2, wallY - 15, 0xc9a23a);
  }
  for (let x = ox + doorX - 7; x < ox + doorX + 7; x += 3) g.rect(x, wallY - 8, 1, 14, 0x3a3a40);
  g.rect(ox + doorX - 7, wallY - 8, 14, 1, 0x4a4a52);
  g.outline();
  dropShadow(g, oy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Chafariz de praça: a bacia de pedra com a água, a coluna no meio e o jorro. Pé centrado em (r, ry). */
export function fountainPiece(r: number, seed: number): Piece {
  const rnd = seeded(seed);
  const ry = Math.round(r * 0.62);
  const rim = 0xa8a294;
  const face = 7;
  const tall = 26;
  const g = new Grid(M + r * 2 + SH + M + 2, M + tall + 6 + ry * 2 + face + SH + M);
  const ox = M + 1;
  const oy = M + tall + 6;
  const cx = ox + r;
  const cy = oy + ry;
  // Face da bacia (a metade da frente) e o topo da borda
  for (let i = -r; i <= r; i++) {
    const half = Math.round(ry * Math.sqrt(Math.max(0, 1 - (i / (r + 0.3)) ** 2)));
    for (let j = 0; j < face; j++) g.px(cx + i, cy + half + j - 2, j === face - 1 ? tone(rim, -0.4) : (i + j) % 7 === 0 ? tone(rim, -0.28) : tone(rim, -0.14));
  }
  g.oval(cx, cy, r, ry, rim);
  g.oval(cx, cy, r - 4, ry - 3, tone(rim, -0.2));
  g.oval(cx, cy, r - 6, ry - 4, 0x3a7a9a);
  // Brilhos e ondinhas na água
  for (let k = 0; k < Math.round(r * 0.8); k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 0.8;
    g.px(Math.round(cx + Math.cos(a) * (r - 8) * d), Math.round(cy + Math.sin(a) * (ry - 5) * d), rnd() < 0.5 ? 0x5a9aba : 0xbfe4ee);
  }
  g.rect(cx - r + 3, cy - 1, 1, 2, tone(rim, 0.3));
  // A coluna com a bacia de cima e o jorro
  g.rect(cx - 3, cy - tall + 6, 7, tall - 4, tone(rim, 0.12));
  g.rect(cx - 3, cy - tall + 6, 2, tall - 4, tone(rim, 0.3));
  g.rect(cx + 3, cy - tall + 6, 1, tall - 4, tone(rim, -0.25));
  g.oval(cx, cy - tall + 6, 9, 3, rim);
  g.oval(cx, cy - tall + 6, 7, 2, 0x4a8aaa);
  for (const [dx, dy] of [[0, -6], [0, -5], [-1, -4], [1, -4], [-3, -2], [3, -2], [-5, 0], [5, 0], [-7, 2], [7, 2], [-8, 5], [8, 5]]) g.px(cx + dx, cy - tall + 6 + dy, 0xd8eef4);
  g.outline();
  dropShadow(g, cy);
  return { grid: g, dx: -ox, dy: -oy };
}

/** Lampião de rua: o poste de ferro e a lanterna. O pé fica em (0, 0). */
export function lampPiece(): Piece {
  const g = new Grid(M + 12 + SH + M, M + 36 + M + 2);
  const x = M + 5;
  const base = M + 36;
  const iron = 0x34343c;
  g.rect(x - 2, base - 2, 5, 2, iron);
  g.rect(x, base - 28, 2, 26, iron);
  g.rect(x, base - 28, 1, 26, 0x54545e);
  g.rect(x - 3, base - 36, 8, 2, iron);
  g.rect(x - 2, base - 34, 6, 6, 0xf0c860);
  g.rect(x - 2, base - 34, 1, 6, iron);
  g.rect(x + 3, base - 34, 1, 6, iron);
  g.rect(x - 1, base - 33, 1, 2, 0xfff0b0);
  g.rect(x - 2, base - 28, 6, 1, iron);
  g.px(x, base - 37, iron);
  g.outline();
  dropShadow(g, base - 4);
  return { grid: g, dx: -x, dy: -base };
}

/** Lápide do cemitério: pedra de topo redondo ou cruz, com o musgo no pé. O pé fica em (0, 0). */
export function tombPiece(seed: number): Piece {
  const rnd = seeded(seed);
  const g = new Grid(M + 12 + SH + M, M + 18 + M + 2);
  const x = M + 1;
  const base = M + 18;
  const stone = [0xb8b2a2, 0xa29c8e, 0xc8c2b0][Math.floor(rnd() * 3)];
  if (rnd() < 0.3) {
    g.rect(x + 4, base - 16, 3, 16, stone);
    g.rect(x + 1, base - 12, 9, 3, stone);
    g.rect(x + 6, base - 16, 1, 16, tone(stone, -0.3));
  } else {
    g.rect(x + 1, base - 12, 9, 12, stone);
    g.rect(x + 2, base - 13, 7, 1, stone);
    g.rect(x + 3, base - 14, 5, 1, stone);
    g.rect(x + 1, base - 12, 1, 12, tone(stone, 0.2));
    g.rect(x + 9, base - 12, 1, 12, tone(stone, -0.3));
    g.rect(x + 3, base - 9, 5, 1, tone(stone, -0.25));
    g.rect(x + 3, base - 7, 5, 1, tone(stone, -0.25));
  }
  g.rect(x, base - 2, 11, 2, 0x4a6a32);
  g.px(x + 2, base - 3, 0x5a7a3a);
  g.outline();
  dropShadow(g, base - 4);
  return { grid: g, dx: -x, dy: -base };
}

/** Calçamentos da Cidade Alta (padrões de PAVING px que se repetem sem emenda). */
export type Paving = "COBBLE" | "AVENUE" | "FLAG" | "MARKET" | "NOBLE" | "BAILEY" | "PLANKS";
export const PAVING = 48;

const PAVING_BASE: Record<Paving, number> = {
  COBBLE: 0x958771,
  AVENUE: 0xa89c84,
  FLAG: 0xb4a990,
  MARKET: 0xa49a82,
  NOBLE: 0xc4bca6,
  BAILEY: 0x9e988a,
  PLANKS: 0x7a5432,
};

/** Fileiras de pedras de largura sorteada; cada fileira fecha certinho em PAVING px (a junta cai na emenda). */
function rows(g: Grid, rowH: number, min: number, max: number, base: number, spread: number, rnd: () => number, planks = false): void {
  const S = PAVING;
  const mortar = tone(base, planks ? -0.45 : -0.34);
  for (let y = 0; y < S; y += rowH) {
    const widths: number[] = [];
    let left = S;
    while (left > 0) {
      let wv = min + Math.floor(rnd() * (max - min + 1));
      if (left - wv < min) wv = left;
      widths.push(wv);
      left -= wv;
    }
    let x = 0;
    for (const wv of widths) {
      const c = tone(base, (rnd() - 0.5) * spread);
      g.rect(x, y, wv, rowH, c);
      g.rect(x + 1, y, wv - 1, 1, tone(c, 0.14));
      g.rect(x + 1, y + rowH - 2, wv - 1, 1, tone(c, -0.16));
      if (!planks && rowH <= 6) {
        // Pedra redonda: os cantos somem na argamassa
        g.px(x + 1, y, mortar);
        g.px(x + wv - 1, y, mortar);
        g.px(x + 1, y + rowH - 2, mortar);
        g.px(x + wv - 1, y + rowH - 2, mortar);
      }
      if (planks) {
        g.px(x + 2, y + Math.floor(rowH / 2), tone(c, -0.35));
        g.px(x + wv - 2, y + Math.floor(rowH / 2), tone(c, -0.35));
      }
      g.rect(x, y, 1, rowH, mortar);
      x += wv;
    }
    g.rect(0, y + rowH - 1, S, 1, mortar);
  }
}

export function pavingTile(kind: Paving): Bitmap {
  const S = PAVING;
  const g = new Grid(S, S);
  const rnd = seeded(0x5eed + kind.length * 977 + kind.charCodeAt(0) * 31);
  const base = PAVING_BASE[kind];
  switch (kind) {
    case "COBBLE":
      rows(g, 6, 5, 9, base, 0.22, rnd);
      break;
    case "AVENUE":
      rows(g, 8, 8, 14, base, 0.16, rnd);
      break;
    case "FLAG":
    case "MARKET":
    case "BAILEY":
      rows(g, 12, 12, 24, base, 0.12, rnd);
      speckle(g, 0, 0, S, S, base, 0.05, rnd);
      break;
    case "NOBLE":
      // Lajes iguais, em amarração, com um friso claro
      for (let y = 0; y < S; y += 12) {
        const off = (y / 12) % 2 ? 8 : 0;
        for (let x = -off; x < S; x += 16) {
          const c = tone(base, (rnd() - 0.5) * 0.08);
          g.rect(x, y, 16, 12, c);
          g.rect(x + 1, y, 15, 1, tone(c, 0.12));
          g.rect(x, y, 1, 12, tone(base, -0.2));
        }
        g.rect(0, y + 11, S, 1, tone(base, -0.2));
      }
      break;
    case "PLANKS":
      rows(g, 6, 20, 40, base, 0.2, rnd, true);
      break;
  }
  return gridBitmap(g);
}

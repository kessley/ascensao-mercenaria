import { CLEAR, Grid, OUTLINE, gridBitmap, ramp, type Bitmap, type Ramp } from "./pixel";
import { ANIM, DIRS, FRAMES, type Dir, type Look, type Vehicle } from "./figures";

/**
 * Veículos em pixel art (G4): o carro de bois do trem de suprimentos, a carroça do mercador e o
 * aríete coberto do cerco. A folha tem o mesmo jeito da das figuras (3 direções e as 16 colunas),
 * então a `Unit` cuida de tudo sozinha:
 * - andando, as rodas giram e os bichos (ou a tripulação do aríete) dão o passo;
 * - atacando (só o aríete), a viga recua e bate;
 * - caindo, o veículo tomba e vira destroço, que fica no chão como um corpo.
 */

/** Célula de cada quadro e o ponto do chão debaixo do centro do veículo (a âncora). */
export const VEHICLE_CELL = { w: 64, h: 46, feetX: 32, feetY: 36 } as const;
export const VEHICLE_MINI = { w: 32, h: 16 } as const;
export const VEHICLE_DOT = { w: 12, h: 6 } as const;

const WOOD: Ramp = { light: 0xb08250, base: 0x845a32, dark: 0x5a3c20 };
const PLANK: Ramp = { light: 0xc09460, base: 0x9a6e40, dark: 0x6a4a2a };
const FRESH: Ramp = { light: 0xd8b07a, base: 0xb88c58, dark: 0x8a6438 };
const CANVAS: Ramp = { light: 0xf6eed8, base: 0xe2d6b6, dark: 0xb4a684 };
const HIDE: Ramp = { light: 0xa47c54, base: 0x7a5a3a, dark: 0x523c26 };
const IRON: Ramp = { light: 0xd4dce0, base: 0x98a4ad, dark: 0x5c6670 };
const OX: Ramp = { light: 0xc09a70, base: 0x94704a, dark: 0x664a30 };
const OX_FAR: Ramp = { light: 0xa48460, base: 0x7c5e3e, dark: 0x543e28 };
const MULE: Ramp = { light: 0xa09080, base: 0x7a6a5a, dark: 0x54483c };
const SACK: Ramp = { light: 0xece0bc, base: 0xcdbb8e, dark: 0x9e8c62 };
const RIM = 0x241a12;
const HUB = 0x6a6a72;
const HORN = 0xeee4cc;
const MANE = 0x2e2018;
const SKIN = 0xdba878;
const HAT = 0x6b5a48;
const PANTS = 0x4a3e32;
const BOOT = 0x2e201a;
const DARK = 0x221a14;
const DUST = 0xc4b8a0;
const SOOT = 0x2c2622;

const isWalk = (f: number) => f >= ANIM.WALK && f < ANIM.ATTACK;
/** Raios da roda: um quarto de volta em quatro quadros do passo. */
const spokes = (f: number) => (isWalk(f) ? f - ANIM.WALK : 0);
/** No passo, de frente ou de costas, um par de patas sobe de cada vez. */
const stepOf = (f: number) => (isWalk(f) ? (f - ANIM.WALK) % 2 : 0);
/** Parado, o bicho baixa a cabeça de vez em quando. */
const nod = (f: number) => (f === ANIM.IDLE + 1 ? 1 : 0);

/** Patas de lado, num passo que alterna os pares (frente de perto, trás de perto, frente de longe, trás de longe). */
function gait(f: number): number[] {
  if (!isWalk(f)) return [0, 0, 0, 0];
  return [
    [2, -1, -2, 1],
    [0, 0, 0, 0],
    [-2, 1, 2, -1],
    [0, 0, 0, 0],
  ][f - ANIM.WALK];
}

// --- Rodas ---

/** Roda de lado: aro de ferro, quatro raios que giram com o passo e o cubo. */
function wheel(g: Grid, cx: number, cy: number, r: number, phase: number, far = false): void {
  g.oval(cx, cy, r, r, RIM);
  g.oval(cx, cy, r - 1, r - 1, far ? WOOD.dark : WOOD.base);
  for (let k = 0; k < 4; k++) {
    const a = (phase * Math.PI) / 8 + (k * Math.PI) / 2;
    g.line(cx, cy, cx + Math.round(Math.cos(a) * (r - 1)), cy + Math.round(Math.sin(a) * (r - 1)), far ? RIM : WOOD.dark);
  }
  g.px(cx, cy, HUB);
}

/** Debaixo do leito, de frente ou de costas: a sombra e o eixo de roda a roda. */
function under(g: Grid, x0: number, x1: number, top: number, ground: number): void {
  g.rect(x0, top, x1 - x0 + 1, ground - top, 0x3a2e24);
  g.rect(x0, ground - 4, x1 - x0 + 1, 1, WOOD.dark);
}

/** Roda vista de frente ou de costas: só o aro, de pé. */
function wheelEdge(g: Grid, x: number, ground: number, r: number): void {
  g.rect(x, ground - 2 * r, 2, 2 * r + 1, RIM);
  g.rect(x, ground - 2 * r + 1, 1, 2, WOOD.dark);
  g.px(x + (x < 32 ? -1 : 2), ground - r, HUB);
}

// --- Bichos ---

function legSide(g: Grid, x: number, top: number, fy: number, shade: number, lift: number): void {
  g.rect(x, top, 2, fy - top - lift, shade);
  g.rect(x, fy - 1 - lift, 2, 1, MANE);
}

/** Boi de lado, olhando para +X: corpo largo, cupim, cabeça baixa com chifres e a canga no pescoço. */
function oxSide(g: Grid, cx: number, fy: number, f: number, c: Ramp): void {
  const gt = gait(f);
  const by = fy - 7;
  const lift = (o: number) => (o > 0 ? 1 : 0);
  legSide(g, cx + 4 + gt[2], by + 2, fy, c.dark, lift(gt[2]));
  legSide(g, cx - 5 + gt[3], by + 2, fy, c.dark, lift(gt[3]));
  // Rabo com o tufo
  g.line(cx - 7, by - 1, cx - 8, by + 3, c.dark);
  g.px(cx - 8, by + 4, MANE);
  g.oval(cx, by, 7, 3, c.base);
  g.rect(cx - 5, by - 3, 10, 1, c.light);
  g.rect(cx - 5, by + 3, 10, 1, c.dark);
  g.rect(cx + 2, by - 4, 4, 1, c.base);
  // Cabeça baixa à frente
  const hx = cx + 6;
  const hy = by - 1 + nod(f);
  g.rect(hx, hy - 1, 3, 4, c.base);
  g.rect(hx + 2, hy, 4, 4, c.base);
  g.rect(hx + 5, hy + 2, 1, 2, c.light);
  g.px(hx + 3, hy + 1, OUTLINE);
  g.px(hx + 2, hy - 1, HORN);
  g.px(hx + 3, hy - 2, HORN);
  g.px(hx + 4, hy - 2, HORN);
  // Canga
  g.rect(hx - 1, hy - 3, 2, 2, WOOD.dark);
  legSide(g, cx + 5 + gt[0], by + 2, fy, c.base, lift(gt[0]));
  legSide(g, cx - 4 + gt[1], by + 2, fy, c.base, lift(gt[1]));
}

/** Boi de frente: peito, as duas patas da frente e a cabeça baixa por cima (vem depois da canga). */
function oxFrontBody(g: Grid, cx: number, fy: number, f: number, c: Ramp): void {
  const step = stepOf(f);
  g.rect(cx - 4, fy - 5, 2, 4 - step, c.dark);
  g.rect(cx + 3, fy - 5, 2, 4 - (1 - step), c.dark);
  g.oval(cx, fy - 7, 4, 3, c.base);
  g.rect(cx - 3, fy - 10, 6, 1, c.light);
  g.rect(cx - 3, fy - 5, 2, 5 - step, c.base);
  g.rect(cx + 1, fy - 5, 2, 5 - (1 - step), c.base);
  g.rect(cx - 3, fy - 1 - step, 2, 1, MANE);
  g.rect(cx + 1, fy - 1 - (1 - step), 2, 1, MANE);
}

function oxFrontHead(g: Grid, cx: number, fy: number, f: number, c: Ramp): void {
  const y = fy - 12 + nod(f);
  g.rect(cx - 2, y, 5, 5, c.base);
  g.rect(cx - 2, y, 1, 5, c.light);
  g.rect(cx - 1, y + 4, 3, 2, c.light);
  g.px(cx - 1, y + 5, OUTLINE);
  g.px(cx + 1, y + 5, OUTLINE);
  g.px(cx - 2, y + 2, OUTLINE);
  g.px(cx + 2, y + 2, OUTLINE);
  for (const s of [-1, 1]) {
    g.px(cx + s * 3, y, HORN);
    g.px(cx + s * 4, y, HORN);
    g.px(cx + s * 5, y - 1, HORN);
    g.px(cx + s * 5, y - 2, 0xfff8e8);
  }
}

/** Mula de lado: menor que o cavalo, orelhas compridas e a coalheira de couro. */
function muleSide(g: Grid, cx: number, fy: number, f: number): void {
  const c = MULE;
  const gt = gait(f);
  const by = fy - 7 + (isWalk(f) && (f - ANIM.WALK) % 2 === 1 ? 1 : 0);
  const lift = (o: number) => (o > 0 ? 1 : 0);
  legSide(g, cx + 3 + gt[2], by + 1, fy, c.dark, lift(gt[2]));
  legSide(g, cx - 5 + gt[3], by + 1, fy, c.dark, lift(gt[3]));
  g.line(cx - 6, by - 1, cx - 7, by + 3, MANE);
  g.oval(cx, by, 6, 2, c.base);
  g.rect(cx - 4, by - 2, 8, 1, c.light);
  g.rect(cx - 4, by + 2, 8, 1, c.dark);
  // Pescoço para o alto, cabeça e orelhas
  const hy = by - 6 + nod(f);
  g.rect(cx + 4, by - 4, 3, 4, c.base);
  g.rect(cx + 5, hy, 4, 3, c.base);
  g.rect(cx + 8, hy + 1, 1, 2, c.dark);
  g.px(cx + 6, hy, OUTLINE);
  g.rect(cx + 5, hy - 3, 1, 3, c.dark);
  g.rect(cx + 6, hy - 3, 1, 3, c.base);
  g.rect(cx + 4, by - 3, 1, 3, 0x5a3a20);
  legSide(g, cx + 4 + gt[0], by + 1, fy, c.base, lift(gt[0]));
  legSide(g, cx - 4 + gt[1], by + 1, fy, c.base, lift(gt[1]));
}

function muleFront(g: Grid, cx: number, fy: number, f: number): void {
  const c = MULE;
  const step = stepOf(f);
  g.oval(cx, fy - 6, 3, 2, c.base);
  g.rect(cx - 2, fy - 5, 2, 5 - step, c.base);
  g.rect(cx + 1, fy - 5, 2, 5 - (1 - step), c.base);
  g.rect(cx - 2, fy - 1 - step, 2, 1, MANE);
  g.rect(cx + 1, fy - 1 - (1 - step), 2, 1, MANE);
  const y = fy - 12 + nod(f);
  g.rect(cx - 2, y + 2, 4, 1, 0x5a3a20);
  g.rect(cx - 1, y, 3, 5, c.base);
  g.rect(cx - 1, y + 4, 3, 1, c.dark);
  g.px(cx - 1, y + 1, OUTLINE);
  g.px(cx + 1, y + 1, OUTLINE);
  g.rect(cx - 2, y - 3, 1, 3, c.dark);
  g.rect(cx + 2, y - 3, 1, 3, c.dark);
}

/** Gente pequena: o carroceiro sentado, com a camisa na cor da tropa. */
function driver(g: Grid, x: number, y: number, shirt: Ramp): void {
  g.rect(x, y, 3, 1, HAT);
  g.rect(x, y + 1, 3, 2, SKIN);
  g.rect(x, y + 3, 3, 3, shirt.base);
  g.px(x, y + 3, shirt.light);
}

// --- Carro de bois (trem de suprimentos) ---

/** Lona em arco sobre o leito: aros por baixo do pano. */
function canvasSide(g: Grid, x: number, top: number, w: number, h: number): void {
  g.rect(x, top + 2, w, h - 2, CANVAS.base);
  g.rect(x + 1, top + 1, w - 2, 1, CANVAS.light);
  g.rect(x + 3, top, w - 6, 1, CANVAS.light);
  for (let i = 4; i < w - 2; i += 6) g.rect(x + i, top + 1, 1, h - 1, CANVAS.dark);
  g.rect(x, top + h - 1, w, 1, CANVAS.dark);
}

function bedSide(g: Grid, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h, PLANK.base);
  g.rect(x, y, w, 1, PLANK.light);
  g.rect(x, y + h - 1, w, 1, PLANK.dark);
  if (h > 4) g.rect(x, y + Math.floor(h / 2), w, 1, PLANK.dark);
  for (let i = 0; i < w; i += 7) g.rect(x + i, y, 1, h, WOOD.dark);
}

function wagonSide(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const ph = spokes(f);
  wheel(g, cx - 17, fy - 6, 4, ph, true);
  wheel(g, cx - 4, fy - 6, 4, ph, true);
  oxSide(g, cx + 13, fy - 3, f, OX_FAR);
  g.line(cx - 1, fy - 8, cx + 8, fy - 9, WOOD.dark);
  bedSide(g, cx - 23, fy - 12, 22, 6);
  canvasSide(g, cx - 22, fy - 22, 19, 10);
  driver(g, cx - 3, fy - 17, ramp(l.color));
  wheel(g, cx - 19, fy - 4, 4, ph);
  wheel(g, cx - 6, fy - 4, 4, ph);
  oxSide(g, cx + 12, fy, f, OX);
}

/** Frente da carroça (lona em arco com a boca franzida) e a junta de bois puxando. */
function wagonFront(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const gy = fy - 8;
  under(g, cx - 10, cx + 9, gy - 6, gy);
  wheelEdge(g, cx - 12, gy, 4);
  wheelEdge(g, cx + 10, gy, 4);
  g.rect(cx - 10, gy - 12, 20, 6, PLANK.base);
  g.rect(cx - 10, gy - 12, 20, 1, PLANK.light);
  g.rect(cx - 10, gy - 9, 20, 1, PLANK.dark);
  g.rect(cx - 10, gy - 7, 20, 1, PLANK.dark);
  const top = gy - 22;
  g.rect(cx - 10, top + 2, 20, 8, CANVAS.base);
  g.rect(cx - 9, top + 1, 18, 1, CANVAS.base);
  g.rect(cx - 7, top, 14, 1, CANVAS.light);
  g.rect(cx - 9, top + 1, 1, 9, CANVAS.light);
  g.rect(cx + 8, top + 2, 2, 8, CANVAS.dark);
  // A boca da lona, franzida, e o carroceiro sentado nela
  g.rect(cx - 5, top + 3, 10, 7, CANVAS.dark);
  g.rect(cx - 4, top + 4, 8, 6, DARK);
  driver(g, cx - 1, top + 5, ramp(l.color));
  // Lança até a canga
  g.rect(cx, gy - 6, 1, 6, WOOD.dark);
  const oy = fy + 3;
  oxFrontBody(g, cx - 6, oy, f, OX);
  oxFrontBody(g, cx + 6, oy, f, OX);
  g.rect(cx - 12, oy - 10, 25, 2, WOOD.dark);
  g.rect(cx - 12, oy - 10, 25, 1, WOOD.base);
  oxFrontHead(g, cx - 6, oy, f, OX);
  oxFrontHead(g, cx + 6, oy, f, OX);
}

/** Traseira: a tábua de trás e a boca da lona com a carga dentro (os bois vão escondidos na frente). */
function wagonBack(g: Grid, cx: number, fy: number, f: number): void {
  const gy = fy + 3;
  // As pontas dos chifres aparecem dos lados da lona
  g.px(cx - 11, fy - 13 + nod(f), HORN);
  g.px(cx + 11, fy - 13 + nod(f), HORN);
  under(g, cx - 10, cx + 9, gy - 6, gy - 1);
  wheelEdge(g, cx - 12, gy, 4);
  wheelEdge(g, cx + 10, gy, 4);
  g.rect(cx - 10, gy - 12, 20, 6, PLANK.base);
  g.rect(cx - 10, gy - 12, 20, 1, PLANK.light);
  g.rect(cx - 10, gy - 9, 20, 1, PLANK.dark);
  g.rect(cx - 10, gy - 7, 20, 1, PLANK.dark);
  for (const x of [cx - 7, cx + 6]) g.rect(x, gy - 12, 1, 6, IRON.dark);
  const top = gy - 22;
  g.rect(cx - 10, top + 2, 20, 8, CANVAS.base);
  g.rect(cx - 9, top + 1, 18, 1, CANVAS.base);
  g.rect(cx - 7, top, 14, 1, CANVAS.light);
  g.rect(cx - 9, top + 1, 1, 9, CANVAS.light);
  g.rect(cx + 8, top + 2, 2, 8, CANVAS.dark);
  g.rect(cx - 6, top + 3, 12, 7, CANVAS.dark);
  g.rect(cx - 5, top + 4, 10, 6, DARK);
  // Sacos e um barril lá dentro
  g.oval(cx - 3, top + 8, 2, 1, SACK.base);
  g.px(cx - 3, top + 7, SACK.light);
  g.oval(cx + 2, top + 8, 2, 1, SACK.dark);
  g.rect(cx - 1, top + 6, 2, 3, WOOD.base);
}

// --- Carroça de mercador ---

/** Toldo listrado: o pano na cor do mercador, alternando com o cru. */
function stripes(g: Grid, x: number, y: number, w: number, h: number, color: number): void {
  const t = ramp(color);
  for (let i = 0; i < w; i++) g.rect(x + i, y, 1, h, Math.floor(i / 3) % 2 === 0 ? t.base : CANVAS.base);
  g.rect(x, y, w, 1, CANVAS.light);
  for (let i = 0; i < w; i += 2) g.px(x + i, y + h, Math.floor(i / 3) % 2 === 0 ? t.dark : CANVAS.dark);
}

function crate(g: Grid, x: number, y: number, s: number): void {
  g.rect(x, y, s, s, FRESH.base);
  g.rect(x, y, s, 1, FRESH.light);
  g.line(x, y + 1, x + s - 1, y + s - 1, FRESH.dark);
  g.rect(x + s - 1, y + 1, 1, s - 1, FRESH.dark);
}

function cartSide(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const ph = spokes(f);
  g.line(cx - 2, fy - 9, cx + 10, fy - 11, WOOD.dark);
  muleSide(g, cx + 11, fy, f);
  // Leito, carga e o toldo em dois paus
  bedSide(g, cx - 19, fy - 11, 17, 4);
  crate(g, cx - 18, fy - 17, 6);
  g.rect(cx - 11, fy - 16, 4, 5, WOOD.base);
  g.rect(cx - 11, fy - 15, 4, 1, IRON.dark);
  g.rect(cx - 11, fy - 13, 4, 1, IRON.dark);
  g.oval(cx - 5, fy - 13, 2, 2, SACK.base);
  g.px(cx - 6, fy - 14, SACK.light);
  g.rect(cx - 19, fy - 23, 1, 12, WOOD.dark);
  g.rect(cx - 4, fy - 23, 1, 12, WOOD.dark);
  stripes(g, cx - 21, fy - 25, 20, 3, l.color);
  g.line(cx - 2, fy - 9, cx + 9, fy - 10, WOOD.base);
  wheel(g, cx - 11, fy - 5, 5, ph);
}

function cartFront(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const gy = fy - 5;
  under(g, cx - 8, cx + 7, gy - 7, gy);
  wheelEdge(g, cx - 10, gy, 5);
  wheelEdge(g, cx + 8, gy, 5);
  crate(g, cx - 7, gy - 16, 6);
  g.oval(cx + 3, gy - 12, 3, 2, SACK.base);
  g.px(cx + 2, gy - 13, SACK.light);
  g.rect(cx - 8, gy - 11, 16, 4, PLANK.base);
  g.rect(cx - 8, gy - 11, 16, 1, PLANK.light);
  g.rect(cx - 8, gy - 8, 16, 1, PLANK.dark);
  g.rect(cx - 9, gy - 23, 1, 12, WOOD.dark);
  g.rect(cx + 8, gy - 23, 1, 12, WOOD.dark);
  stripes(g, cx - 10, gy - 25, 20, 3, l.color);
  // Varais até a mula
  g.line(cx - 5, gy - 7, cx - 3, fy - 4, WOOD.dark);
  g.line(cx + 4, gy - 7, cx + 3, fy - 4, WOOD.dark);
  muleFront(g, cx, fy + 3, f);
}

function cartBack(g: Grid, cx: number, fy: number, l: Look): void {
  const gy = fy + 3;
  under(g, cx - 8, cx + 7, gy - 6, gy - 1);
  wheelEdge(g, cx - 10, gy, 5);
  wheelEdge(g, cx + 8, gy, 5);
  crate(g, cx - 6, gy - 16, 6);
  g.rect(cx + 1, gy - 15, 4, 4, WOOD.base);
  g.rect(cx + 1, gy - 14, 4, 1, IRON.dark);
  g.oval(cx - 3, gy - 11, 3, 2, SACK.base);
  g.rect(cx - 8, gy - 10, 16, 4, PLANK.base);
  g.rect(cx - 8, gy - 10, 16, 1, PLANK.light);
  g.rect(cx - 8, gy - 7, 16, 1, PLANK.dark);
  g.rect(cx - 9, gy - 23, 1, 13, WOOD.dark);
  g.rect(cx + 8, gy - 23, 1, 13, WOOD.dark);
  stripes(g, cx - 10, gy - 25, 20, 3, l.color);
}

// --- Aríete coberto ---

/** Viga de ataque: quanto a cabeça de ferro sai da frente em cada quadro do golpe. */
function thrustOf(f: number): number {
  if (f === ANIM.ATTACK) return -3;
  if (f === ANIM.ATTACK + 1) return 4;
  if (f === ANIM.ATTACK + 2) return 3;
  return 0;
}

/** Couro do telhado: costuras e remendos (o couro molhado é o que segura o fogo). */
function hides(g: Grid, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < w; i += 8) {
    const j = (i * 7) % 5;
    g.rect(x + i + 1, y + j, 5, 3, (i / 8) % 2 === 0 ? HIDE.light : HIDE.dark);
    // Costura em volta do remendo
    for (let k = 0; k < 5; k += 2) g.px(x + i + 1 + k, y + j + 3, HIDE.dark);
  }
  for (let i = 4; i < w; i += 8) if (y + 7 < y + h) g.px(x + i, y + 7, HIDE.light);
}

/** Tripulação embaixo do telhado: o tronco na cor da tropa e as pernas no passo. */
function crewSide(g: Grid, x: number, fy: number, f: number, team: Ramp, k: number): void {
  const s = isWalk(f) ? ((f - ANIM.WALK + k) % 2 === 0 ? 1 : -1) : 0;
  g.rect(x, fy - 13, 3, 5, team.base);
  g.rect(x, fy - 13, 1, 5, team.light);
  g.rect(x + s, fy - 8, 1, 7, PANTS);
  g.rect(x + 2 - s, fy - 8, 1, 7, PANTS);
  g.px(x + s, fy - 1, BOOT);
  g.px(x + 2 - s, fy - 1, BOOT);
}

function pennant(g: Grid, x: number, y: number, color: number): void {
  const t = ramp(color);
  g.rect(x, y, 1, 7, WOOD.dark);
  g.rect(x + 1, y, 4, 3, t.base);
  g.rect(x + 1, y, 4, 1, t.light);
  g.px(x + 5, y + 1, t.base);
}

function ramSide(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const ph = spokes(f);
  const team = ramp(l.color);
  const push = thrustOf(f);
  // A viga sai pela frente, debaixo da cumeeira
  g.rect(cx + 8, fy - 18, 6 + push, 3, WOOD.base);
  g.rect(cx + 8, fy - 18, 6 + push, 1, WOOD.light);
  const hx = cx + 14 + push;
  g.rect(hx, fy - 19, 3, 5, IRON.base);
  g.rect(hx, fy - 19, 3, 1, IRON.light);
  g.rect(hx + 3, fy - 18, 1, 3, IRON.dark);
  if (f === ANIM.ATTACK + 1) {
    g.px(hx + 5, fy - 20, 0xf6d860);
    g.px(hx + 5, fy - 14, 0xf6d860);
    g.px(hx + 6, fy - 17, 0xffffff);
  }
  // A sombra debaixo do telhado e quem empurra lá dentro
  g.rect(cx - 19, fy - 13, 29, 7, DARK);
  for (const [x, k] of [[cx - 14, 0], [cx - 6, 1], [cx + 2, 0]]) crewSide(g, x, fy, f, team, k);
  // Telhado de duas águas: a cumeeira em cima e a encosta de couro abrindo até a beira
  for (let j = 0; j <= 11; j++) {
    const y = fy - 24 + j;
    const spread = Math.floor(j / 2);
    g.rect(cx - 17 - spread, y, 24 + spread * 2, 1, j < 3 ? HIDE.light : HIDE.base);
  }
  hides(g, cx - 19, fy - 21, 28, 8);
  g.rect(cx - 23, fy - 13, 36, 1, HIDE.dark);
  g.rect(cx - 18, fy - 26, 26, 2, WOOD.dark);
  g.rect(cx - 18, fy - 26, 26, 1, WOOD.base);
  // Esteios e a base
  g.rect(cx - 20, fy - 12, 2, 6, WOOD.dark);
  g.rect(cx + 9, fy - 12, 2, 6, WOOD.dark);
  g.rect(cx - 21, fy - 7, 33, 2, WOOD.base);
  g.rect(cx - 21, fy - 7, 33, 1, WOOD.light);
  pennant(g, cx - 14, fy - 33, l.color);
  wheel(g, cx - 15, fy - 4, 4, ph);
  wheel(g, cx + 6, fy - 4, 4, ph);
}

/** O telhado de duas águas visto pela ponta: as duas encostas de couro e a empena de tábuas. */
function gable(g: Grid, cx: number, fy: number): void {
  for (let j = 0; j <= 13; j++) {
    const half = Math.round((j * 14) / 13);
    g.rect(cx - half, fy - 29 + j, half * 2 + 1, 1, j < 2 ? HIDE.light : HIDE.base);
  }
  for (let j = 0; j <= 11; j++) {
    const half = Math.round((j * 11) / 11);
    g.rect(cx - half, fy - 26 + j, half * 2 + 1, 1, PLANK.base);
    g.px(cx - half, fy - 26 + j, HIDE.dark);
    g.px(cx + half, fy - 26 + j, HIDE.dark);
  }
  for (let j = 3; j <= 11; j += 3) g.rect(cx - j + 1, fy - 26 + j, j * 2 - 1, 1, PLANK.dark);
}

function ramFront(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const team = ramp(l.color);
  const push = thrustOf(f);
  gable(g, cx, fy);
  // Debaixo da empena, na sombra, a tripulação e os esteios
  g.rect(cx - 11, fy - 15, 23, 9, DARK);
  for (const [x, k] of [[cx - 7, 0], [cx + 4, 1]]) {
    const s = isWalk(f) ? (f - ANIM.WALK + k) % 2 : 0;
    g.rect(x, fy - 14, 3, 5, team.base);
    g.rect(x, fy - 9, 1, 8 - s, PANTS);
    g.rect(x + 2, fy - 9, 1, 8 - (1 - s) * (isWalk(f) ? 1 : 0), PANTS);
  }
  g.rect(cx - 12, fy - 15, 2, 10, WOOD.dark);
  g.rect(cx + 11, fy - 15, 2, 10, WOOD.dark);
  g.rect(cx - 12, fy - 7, 25, 2, WOOD.base);
  g.rect(cx - 12, fy - 7, 25, 1, WOOD.light);
  wheelEdge(g, cx - 14, fy, 4);
  wheelEdge(g, cx + 13, fy, 4);
  // A cabeça de ferro vem na nossa direção
  const r = push > 0 ? 3 : 2;
  const hy = fy - 15 + (push > 0 ? 1 : push < 0 ? -1 : 0);
  g.oval(cx, hy, r, r, IRON.base);
  g.px(cx - 1, hy - 1, IRON.light);
  g.px(cx + 1, hy + 1, IRON.dark);
  pennant(g, cx - 1, fy - 36, l.color);
}

function ramBack(g: Grid, cx: number, fy: number, f: number, l: Look): void {
  const team = ramp(l.color);
  gable(g, cx, fy);
  // Por trás o vão é aberto: o pé da viga e as costas de quem empurra
  g.rect(cx - 9, fy - 21, 19, 7, DARK);
  g.oval(cx, fy - 17, 2, 2, WOOD.base);
  g.px(cx, fy - 17, WOOD.dark);
  for (const [x, k] of [[cx - 8, 0], [cx - 2, 1], [cx + 4, 0]]) {
    const s = isWalk(f) ? ((f - ANIM.WALK + k) % 2 === 0 ? 1 : 0) : 0;
    g.rect(x, fy - 15, 4, 6, team.base);
    g.rect(x, fy - 15, 4, 1, team.light);
    g.rect(x, fy - 9, 1, 8 - s, PANTS);
    g.rect(x + 3, fy - 9, 1, 8 - (1 - s), PANTS);
  }
  g.rect(cx - 12, fy - 15, 2, 10, WOOD.dark);
  g.rect(cx + 11, fy - 15, 2, 10, WOOD.dark);
  g.rect(cx - 12, fy - 6, 25, 1, WOOD.base);
  wheelEdge(g, cx - 14, fy, 4);
  wheelEdge(g, cx + 13, fy, 4);
  pennant(g, cx - 1, fy - 36, l.color);
}

// --- Destroços ---

function wreck(g: Grid, v: Vehicle, cx: number, fy: number, l: Look): void {
  // Uma roda solta, deitada
  g.oval(cx + 9, fy - 2, 4, 2, RIM);
  g.oval(cx + 9, fy - 2, 2, 1, WOOD.base);
  if (v === "RAM") {
    g.oval(cx - 2, fy - 4, 16, 4, HIDE.base);
    hides(g, cx - 16, fy - 7, 28, 6);
    g.rect(cx - 10, fy - 6, 5, 2, SOOT);
    g.rect(cx + 4, fy - 3, 4, 2, SOOT);
    g.rect(cx + 10, fy - 9, 10, 3, WOOD.base);
    g.rect(cx + 20, fy - 10, 3, 5, IRON.base);
    g.px(cx + 20, fy - 10, IRON.light);
    g.rect(cx - 18, fy - 8, 2, 7, WOOD.dark);
    return;
  }
  // Tábuas do leito espalhadas
  for (const [x, y, w] of [[-16, -3, 9], [-6, -1, 7], [-12, -7, 6], [1, -5, 8], [-20, -1, 5]]) {
    g.rect(cx + x, fy + y, w, 2, PLANK.base);
    g.rect(cx + x, fy + y, w, 1, PLANK.light);
  }
  if (v === "WAGON") {
    // A lona rasgada caída por cima e os sacos que sobraram
    g.oval(cx - 6, fy - 6, 8, 3, CANVAS.base);
    g.rect(cx - 12, fy - 8, 12, 1, CANVAS.light);
    g.px(cx - 8, fy - 6, DARK);
    g.px(cx - 4, fy - 5, DARK);
    g.line(cx - 13, fy - 4, cx - 9, fy - 9, CANVAS.dark);
    g.oval(cx + 3, fy - 2, 2, 1, SACK.base);
    g.oval(cx - 17, fy - 5, 2, 1, SACK.dark);
    return;
  }
  // Carroça: o toldo no chão, um caixote quebrado e o barril deitado
  stripes(g, cx - 14, fy - 9, 12, 2, l.color);
  crate(g, cx - 1, fy - 8, 4);
  g.rect(cx - 9, fy - 4, 5, 3, WOOD.base);
  g.rect(cx - 8, fy - 4, 1, 3, IRON.dark);
  g.rect(cx - 6, fy - 4, 1, 3, IRON.dark);
}

/** Tomba: cada coluna desce um pouco mais que a do lado (uma rotação barata). */
function tilt(src: Grid, cx: number, k: number): Grid {
  const g = new Grid(src.w, src.h);
  for (let x = 0; x < src.w; x++) {
    const dy = Math.round((cx - x) * k);
    for (let y = 0; y < src.h; y++) {
      const c = src.get(x, y);
      if (c !== CLEAR) g.px(x, y + dy, c);
    }
  }
  return g;
}

function puffs(g: Grid, cx: number, fy: number): void {
  for (const [x, y, r] of [[-14, -6, 3], [6, -9, 3], [-4, -13, 2], [16, -4, 2], [-22, -3, 2]]) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r && g.get(cx + x + i, fy + y + j) === CLEAR) g.px(cx + x + i, fy + y + j, DUST);
  }
}

function pose(g: Grid, v: Vehicle, dir: Dir, f: number, l: Look): void {
  const { feetX: cx, feetY: fy } = VEHICLE_CELL;
  if (v === "WAGON") {
    if (dir === "E") wagonSide(g, cx, fy, f, l);
    else if (dir === "S") wagonFront(g, cx, fy, f, l);
    else wagonBack(g, cx, fy, f);
  } else if (v === "CART") {
    if (dir === "E") cartSide(g, cx, fy, f, l);
    else if (dir === "S") cartFront(g, cx, fy, f, l);
    else cartBack(g, cx, fy, l);
  } else if (dir === "E") ramSide(g, cx, fy, f, l);
  else if (dir === "S") ramFront(g, cx, fy, f, l);
  else ramBack(g, cx, fy, f, l);
}

function frameGrid(l: Look, v: Vehicle, dir: Dir, frame: number): Grid {
  const { w, h, feetX: cx, feetY: fy } = VEHICLE_CELL;
  let g = new Grid(w, h);
  const fall = frame >= ANIM.DIE && frame < ANIM.DIE + 3;
  // Só o aríete golpeia; as colunas do duelo repetem o parado
  const f = (frame >= ANIM.ATTACK && frame < ANIM.DIE && v !== "RAM") || frame >= ANIM.GUARD ? ANIM.IDLE : frame;
  if (!fall) pose(g, v, dir, f, l);
  else if (frame === ANIM.DIE) {
    pose(g, v, dir, ANIM.IDLE, l);
    g = tilt(g, cx, dir === "E" ? 0.12 : 0.06);
  } else wreck(g, v, cx, fy, l);
  g.outline();
  if (frame === ANIM.DIE + 1) puffs(g, cx, fy);
  if (frame !== ANIM.DIE + 2) {
    if (dir === "E") g.shadow(cx, fy + 1, 22, 2);
    else g.shadow(cx, fy - 1, 14, 5);
  }
  return g;
}

/** Folha completa de um veículo: linhas = direções, colunas = quadros (como a das figuras). */
export function vehicleSheet(l: Look): Bitmap {
  const v = l.vehicle as Vehicle;
  const { w, h } = VEHICLE_CELL;
  const sheet = new Grid(w * FRAMES, h * DIRS.length);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES; f++) sheet.stamp(frameGrid(l, v, dir, f), f * w, row * h);
  });
  return gridBitmap(sheet);
}

/** Mini-sprite do zoom de 50%: o veículo de lado, em dois quadros (os bichos ou a tripulação dão o passo). */
export function vehicleMiniSheet(l: Look): Bitmap {
  const v = l.vehicle as Vehicle;
  const { w, h } = VEHICLE_MINI;
  const sheet = new Grid(w * 2, h);
  const cx = w / 2;
  const fy = h - 1;
  const team = ramp(l.color);
  for (let f = 0; f < 2; f++) {
    const g = new Grid(w, h);
    if (v === "WAGON") {
      g.rect(cx + 3, fy - 6, 7, 3, OX.base);
      g.rect(cx + 3, fy - 6, 7, 1, OX.light);
      g.rect(cx + 10, fy - 6, 2, 2, OX.base);
      g.px(cx + 11, fy - 7, HORN);
      g.rect(cx + 4, fy - 3, 1, 3 - f, OX.dark);
      g.rect(cx + 8, fy - 3, 1, 2 + f, OX.dark);
      g.rect(cx - 12, fy - 6, 12, 3, PLANK.base);
      g.rect(cx - 11, fy - 12, 10, 6, CANVAS.base);
      g.rect(cx - 10, fy - 13, 8, 1, CANVAS.light);
      g.px(cx - 7, fy - 11, CANVAS.dark);
      g.px(cx - 4, fy - 11, CANVAS.dark);
      g.px(cx - 1, fy - 8, team.base);
      for (const x of [cx - 9, cx - 3]) {
        g.oval(x, fy - 2, 2, 2, RIM);
        g.oval(x, fy - 2, 1, 1, WOOD.base);
      }
    } else if (v === "CART") {
      g.rect(cx + 2, fy - 6, 5, 2, MULE.base);
      g.rect(cx + 7, fy - 8, 2, 3, MULE.base);
      g.px(cx + 7, fy - 9, MULE.dark);
      g.rect(cx + 3, fy - 4, 1, 4 - f, MULE.dark);
      g.rect(cx + 6, fy - 4, 1, 3 + f, MULE.dark);
      g.rect(cx - 10, fy - 6, 10, 2, PLANK.base);
      g.rect(cx - 9, fy - 9, 3, 3, FRESH.base);
      g.rect(cx - 5, fy - 8, 3, 2, SACK.base);
      for (let i = 0; i < 11; i++) g.px(cx - 11 + i, fy - 12, Math.floor(i / 2) % 2 === 0 ? ramp(l.color).base : CANVAS.base);
      g.rect(cx - 11, fy - 11, 1, 5, WOOD.dark);
      g.rect(cx - 1, fy - 11, 1, 5, WOOD.dark);
      g.oval(cx - 6, fy - 2, 2, 2, RIM);
      g.oval(cx - 6, fy - 2, 1, 1, WOOD.base);
    } else {
      for (let j = 0; j < 6; j++) g.rect(cx - 10 - Math.floor(j / 3), fy - 12 + j, 15 + Math.floor(j / 3) * 2, 1, j === 0 ? HIDE.light : HIDE.base);
      g.rect(cx + 6, fy - 9, 3, 2, IRON.base);
      g.rect(cx - 8, fy - 6, 2, 3, team.base);
      g.rect(cx - 2, fy - 6, 2, 3, team.base);
      g.rect(cx - 8 + f, fy - 3, 1, 2, PANTS);
      g.rect(cx - 2 + 1 - f, fy - 3, 1, 2, PANTS);
      g.rect(cx - 11, fy - 4, 17, 1, WOOD.base);
      g.px(cx - 8, fy - 14, team.base);
      g.px(cx - 7, fy - 14, team.base);
      g.rect(cx - 9, fy - 14, 1, 2, WOOD.dark);
      g.oval(cx - 7, fy - 1, 1, 1, RIM);
      g.oval(cx + 3, fy - 1, 1, 1, RIM);
    }
    g.outline();
    sheet.stamp(g, f * w, 0);
  }
  return gridBitmap(sheet);
}

/** Bloquinho do zoom mais aberto: a lona, o toldo ou o couro, e o bicho na frente. */
export function vehicleDot(l: Look): Bitmap {
  const v = l.vehicle as Vehicle;
  const { w, h } = VEHICLE_DOT;
  const g = new Grid(w, h);
  if (v === "WAGON") {
    g.rect(0, 0, 8, 3, CANVAS.base);
    g.rect(0, 3, 8, 2, PLANK.base);
    g.rect(8, 2, 4, 3, OX.base);
  } else if (v === "CART") {
    g.rect(0, 0, 7, 1, ramp(l.color).base);
    g.rect(0, 1, 7, 2, FRESH.base);
    g.rect(0, 3, 7, 2, PLANK.base);
    g.rect(7, 2, 4, 3, MULE.base);
  } else {
    g.rect(0, 0, 10, 4, HIDE.base);
    g.rect(0, 0, 10, 1, HIDE.light);
    g.rect(10, 2, 2, 1, IRON.base);
    g.rect(1, 4, 8, 1, ramp(l.color).base);
  }
  g.rect(1, h - 1, 2, 1, RIM);
  g.rect(5, h - 1, 2, 1, RIM);
  return gridBitmap(g);
}

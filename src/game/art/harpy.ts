import { Grid, gridBitmap, type Bitmap } from "./pixel";
import { DIRS, type Dir } from "./figures";

/**
 * A harpia em voo (G4): a ave que leva os relatórios entre o batedor e o Comandante. Vista de
 * cima, como tudo no mapa, em três direções (de frente, de lado e de costas; o lado oeste é o
 * leste espelhado) e quatro quadros do bater de asas. A sombra fica à parte, no chão, longe da
 * ave: é ela que mostra a altura.
 */

/** Célula de cada quadro e o centro do corpo. */
export const HARPY_CELL = { w: 44, h: 34, cx: 22, cy: 16 } as const;
/** Quadros do bater de asas: em cima, abertas, embaixo, abertas. */
export const HARPY_FRAMES = 4;
export const HARPY_SHADOW = { w: 24, h: 7 } as const;

const WING = 0x43382e;
const WING_FAR = 0x2c241d;
const PRIMARY = 0x221b15;
const COVERT = 0x7c6a56;
const EDGE = 0x8e7c66;
const BACK = 0x564838;
const PALE = 0xece4d4;
const PALE_DARK = 0xb8ad98;
const CREST = 0x2a211b;
const BEAK = 0x3a3430;
const FEET = 0xd9b13f;
const EYE = 0x101010;

type P = readonly [number, number];
const at = (pts: readonly P[], fx: (p: P) => P): P[] => pts.map(fx);

// --- Vista de cima (voando para o norte; o sul é o espelho na vertical) ---

/** Asa direita aberta: bordo da frente, ponta com os dedos e bordo de trás em penas. */
const WING_TOP: P[] = [
  [2, -3], [6, -5], [11, -5], [15, -4], [18, -2], [19, 0], [18, 2], [16, 3], [15, 2], [13, 4], [11, 3], [9, 5], [6, 5], [2, 4],
];
const COVERT_TOP: P[] = [[2, -2], [6, -4], [11, -4], [11, -1], [6, 0], [2, 1]];
const PRIMARY_TOP: P[] = [[15, -4], [18, -2], [19, 0], [18, 2], [16, 3], [15, 2]];
const TAIL_TOP: P[] = [[-2, 4], [-4, 12], [-1, 13], [1, 13], [4, 12], [2, 4]];
const BAND_TOP: P[] = [[-3, 8], [3, 8], [3.5, 10], [-3.5, 10]];

/** `p`: 0 asas em cima, 1 abertas, 2 embaixo, 3 abertas. `head` 1 = voando para o sul. */
function topView(g: Grid, p: number, head: 1 | -1): void {
  const { cx, cy } = HARPY_CELL;
  // Erguidas, as asas encurtam e as pontas sobem na tela; baixadas, encurtam e descem
  const span = p === 0 ? 0.72 : p === 2 ? 0.8 : 1;
  const lift = p === 0 ? -6 : p === 2 ? 4 : 0;
  // Desenhadas voando para o norte; para o sul, o y se espelha (a cauda fica em cima)
  const flip = (q: P): P => [cx + q[0], cy - head * q[1]];
  const place = (s: 1 | -1) => (q: P): P => [cx + s * q[0] * span, cy - head * q[1] + lift * (Math.abs(q[0]) / 19)];
  // A cauda em leque, com a faixa clara
  g.poly(at(TAIL_TOP, flip), WING_FAR);
  g.poly(at(BAND_TOP, flip), PALE_DARK);
  for (const s of [-1, 1] as const) {
    g.poly(at(WING_TOP, place(s)), WING);
    g.poly(at(COVERT_TOP, place(s)), COVERT);
    g.poly(at(PRIMARY_TOP, place(s)), PRIMARY);
    const [a, b] = at([WING_TOP[0], WING_TOP[3]], place(s));
    g.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), EDGE);
  }
  // O corpo, as costas e a cabeça clara (com o topete escuro na nuca)
  g.oval(cx, cy, 3, 5, WING);
  g.oval(cx, cy - head, 1, 3, BACK);
  const hy = cy + 7 * head;
  g.oval(cx, hy, 2, 2, PALE);
  g.rect(cx - 1, hy - 2 * head, 3, 1, CREST);
  g.px(cx, hy + 3 * head, BEAK);
}

// --- De lado (voando para o leste) ---

/** As asas de longe e de perto em cada quadro do bater (de lado, a de perto cobre o corpo). */
const SIDE_WINGS: { far: P[]; near: P[] }[] = [
  {
    far: [[2, -2], [1, -8], [0, -13], [-2, -14], [-4, -13], [-5, -9], [-4, -2]],
    near: [[3, -2], [2, -7], [0, -11], [-3, -12], [-6, -11], [-6, -7], [-4, -1]],
  },
  {
    far: [[3, -2], [0, -7], [-2, -10], [-4, -11], [-6, -10], [-7, -8], [-6, -5], [-4, -2]],
    near: [[3, 1], [1, 6], [-1, 10], [-3, 12], [-6, 12], [-8, 10], [-7, 7], [-5, 2]],
  },
  {
    far: [[2, 1], [0, 4], [-3, 5], [-5, 3], [-4, 1]],
    near: [[3, 1], [2, 7], [0, 12], [-2, 14], [-5, 13], [-6, 9], [-5, 2]],
  },
];

function sideView(g: Grid, p: number): void {
  const { cx, cy } = HARPY_CELL;
  const w = SIDE_WINGS[p === 3 ? 1 : p];
  const put = (q: P): P => [cx + q[0], cy + q[1]];
  g.poly(at(w.far, put), WING_FAR);
  // A cauda em leque, com a faixa clara
  g.poly(at([[-5, -1], [-12, -3], [-13, 1], [-12, 3], [-5, 1]], put), WING_FAR);
  g.rect(cx - 10, cy - 2, 1, 4, PALE_DARK);
  // O corpo: costas escuras, peito claro, garras recolhidas
  g.oval(cx, cy, 6, 3, WING);
  g.oval(cx + 1, cy + 1, 4, 1, PALE);
  g.rect(cx - 1, cy + 3, 2, 1, FEET);
  // A cabeça, com o topete e o bico em gancho
  g.oval(cx + 7, cy - 1, 3, 2, PALE);
  g.rect(cx + 4, cy - 3, 3, 1, CREST);
  g.px(cx + 8, cy - 2, EYE);
  g.rect(cx + 10, cy - 1, 1, 2, BEAK);
  g.px(cx + 11, cy, BEAK);
  // A asa de perto, com o bordo claro e as pontas escuras
  const near = at(w.near, put);
  g.poly(near, WING);
  g.line(Math.round(near[0][0]), Math.round(near[0][1]), Math.round(near[2][0]), Math.round(near[2][1]), EDGE);
  const tip = near[Math.floor(near.length / 2)];
  g.oval(Math.round(tip[0]), Math.round(tip[1]), 1, 1, PRIMARY);
}

function frameGrid(dir: Dir, p: number): Grid {
  const g = new Grid(HARPY_CELL.w, HARPY_CELL.h);
  if (dir === "E") sideView(g, p);
  else topView(g, p, dir === "S" ? 1 : -1);
  g.outline();
  return g;
}

/** Folha da harpia: linhas = direções (de frente, de lado, de costas), colunas = bater de asas. */
export function harpySheet(): Bitmap {
  const { w, h } = HARPY_CELL;
  const sheet = new Grid(w * HARPY_FRAMES, h * DIRS.length);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < HARPY_FRAMES; f++) sheet.stamp(frameGrid(dir, f), f * w, row * h);
  });
  return gridBitmap(sheet);
}

/** A sombra da ave no chão. */
export function harpyShadow(): Bitmap {
  const { w, h } = HARPY_SHADOW;
  const g = new Grid(w, h);
  g.shadow(Math.floor(w / 2), Math.floor(h / 2), Math.floor(w / 2) - 1, Math.floor(h / 2));
  return gridBitmap(g);
}

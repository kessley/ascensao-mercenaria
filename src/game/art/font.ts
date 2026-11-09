/**
 * A fonte de pixel do jogo (G5, parte 1), desenhada letra a letra como as figuras e montada em
 * TrueType aqui mesmo, sem arquivo baixado de fora. Cada pixel do desenho vira um quadrado no
 * contorno da letra, então ela fica nítida no tamanho de 12 px e nos múltiplos dele.
 *
 * A grade de cada letra tem 12 linhas: 0 e 1 são os acentos das maiúsculas, 2 e 3 os das
 * minúsculas, 3 a 9 a altura das maiúsculas (7), 5 a 9 a das minúsculas (5), e 10 e 11 as
 * pernas (g, j, p, q, y, ç). A linha de base fica embaixo da linha 9.
 *
 * Sem Phaser e sem DOM aqui: o resultado são bytes, registrados na página por `ui/pixelFont.ts`.
 */

/** Linhas da grade (a altura de uma letra com acento e perna). */
export const FONT_ROWS = 12;
/** Linhas acima da linha de base. */
export const FONT_ASCENT = 10;
/** Unidades de contorno por pixel do desenho (o em tem 12 pixels). */
export const FONT_UNIT = 100;
export const UNITS_PER_EM = FONT_ROWS * FONT_UNIT;
/** O nome da família, no CSS e no Phaser. */
export const PIXEL_FAMILY = "Mercenaria Pixel";
/** A família com a reserva, para o `fontFamily` dos textos do Phaser. */
export const PIXEL_FONT = `"${PIXEL_FAMILY}", monospace`;

export interface Glyph {
  /** Linhas de cima para baixo ("X" = tinta), começando na linha `top` da grade. */
  rows: string[];
  top: number;
}

const g = (top: number, ...rows: string[]): Glyph => ({ top, rows });
/** Maiúsculas, algarismos e o que tem a altura delas: começam na linha 3. */
const cap = (...rows: string[]) => g(3, ...rows);
/** Minúsculas sem haste: começam na linha 5. */
const low = (...rows: string[]) => g(5, ...rows);

const BASE: Record<string, Glyph> = {
  " ": g(9, "..."),
  A: cap(".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"),
  B: cap("XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."),
  C: cap(".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."),
  D: cap("XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."),
  E: cap("XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"),
  F: cap("XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."),
  G: cap(".XXX.", "X...X", "X....", "X.XXX", "X...X", "X...X", ".XXXX"),
  H: cap("X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"),
  I: cap("XXX", ".X.", ".X.", ".X.", ".X.", ".X.", "XXX"),
  J: cap("..XXX", "...X.", "...X.", "...X.", "...X.", "X..X.", ".XX.."),
  K: cap("X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"),
  L: cap("X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"),
  M: cap("X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"),
  N: cap("X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X", "X...X"),
  O: cap(".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."),
  P: cap("XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."),
  Q: cap(".XXX.", "X...X", "X...X", "X...X", "X.X.X", "X..X.", ".XX.X"),
  R: cap("XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"),
  S: cap(".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."),
  T: cap("XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."),
  U: cap("X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."),
  V: cap("X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."),
  W: cap("X...X", "X...X", "X...X", "X.X.X", "X.X.X", "X.X.X", ".X.X."),
  X: cap("X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"),
  Y: cap("X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."),
  Z: cap("XXXXX", "....X", "...X.", "..X..", ".X...", "X....", "XXXXX"),

  a: low(".XXX.", "....X", ".XXXX", "X...X", ".XXXX"),
  b: cap("X....", "X....", "XXXX.", "X...X", "X...X", "X...X", "XXXX."),
  c: low(".XXX", "X...", "X...", "X...", ".XXX"),
  d: cap("....X", "....X", ".XXXX", "X...X", "X...X", "X...X", ".XXXX"),
  e: low(".XXX.", "X...X", "XXXXX", "X....", ".XXX."),
  f: cap("..XX", ".X..", "XXXX", ".X..", ".X..", ".X..", ".X.."),
  g: low(".XXXX", "X...X", "X...X", "X...X", ".XXXX", "....X", ".XXX."),
  h: cap("X....", "X....", "XXXX.", "X...X", "X...X", "X...X", "X...X"),
  i: cap("X", ".", "X", "X", "X", "X", "X"),
  j: cap("..X", "...", ".XX", "..X", "..X", "..X", "..X", "..X", "XX."),
  k: cap("X...", "X...", "X..X", "X.X.", "XX..", "X.X.", "X..X"),
  l: cap("X.", "X.", "X.", "X.", "X.", "X.", ".X"),
  m: low("XXXX.", "X.X.X", "X.X.X", "X.X.X", "X.X.X"),
  n: low("XXXX.", "X...X", "X...X", "X...X", "X...X"),
  o: low(".XXX.", "X...X", "X...X", "X...X", ".XXX."),
  p: low("XXXX.", "X...X", "X...X", "X...X", "XXXX.", "X....", "X...."),
  q: low(".XXXX", "X...X", "X...X", "X...X", ".XXXX", "....X", "....X"),
  r: low("X.XX", "XX..", "X...", "X...", "X..."),
  s: low(".XXXX", "X....", ".XXX.", "....X", "XXXX."),
  t: g(4, ".X.", "XXX", ".X.", ".X.", ".X.", "..X"),
  u: low("X...X", "X...X", "X...X", "X...X", ".XXXX"),
  v: low("X...X", "X...X", "X...X", ".X.X.", "..X.."),
  w: low("X...X", "X...X", "X.X.X", "X.X.X", ".X.X."),
  x: low("X...X", ".X.X.", "..X..", ".X.X.", "X...X"),
  y: low("X...X", "X...X", "X...X", "X...X", ".XXXX", "....X", ".XXX."),
  z: low("XXXXX", "...X.", "..X..", ".X...", "XXXXX"),

  "0": cap(".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."),
  "1": cap("..X..", ".XX..", "X.X..", "..X..", "..X..", "..X..", "XXXXX"),
  "2": cap(".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"),
  "3": cap("XXXX.", "....X", "....X", ".XXX.", "....X", "....X", "XXXX."),
  "4": cap("...X.", "..XX.", ".X.X.", "X..X.", "XXXXX", "...X.", "...X."),
  "5": cap("XXXXX", "X....", "XXXX.", "....X", "....X", "X...X", ".XXX."),
  "6": cap(".XXX.", "X....", "X....", "XXXX.", "X...X", "X...X", ".XXX."),
  "7": cap("XXXXX", "....X", "...X.", "..X..", "..X..", "..X..", "..X.."),
  "8": cap(".XXX.", "X...X", "X...X", ".XXX.", "X...X", "X...X", ".XXX."),
  "9": cap(".XXX.", "X...X", "X...X", ".XXXX", "....X", "....X", ".XXX."),

  ".": g(9, "X"),
  ",": g(9, ".X", "X."),
  ":": g(5, "X", ".", ".", ".", "X"),
  ";": g(5, ".X", "..", "..", "..", ".X", "X."),
  "!": cap("X", "X", "X", "X", "X", ".", "X"),
  "?": cap(".XXX.", "X...X", "....X", "..XX.", "..X..", ".....", "..X.."),
  "'": cap("X", "X"),
  '"': cap("X.X", "X.X"),
  "(": cap(".X", "X.", "X.", "X.", "X.", "X.", ".X"),
  ")": cap("X.", ".X", ".X", ".X", ".X", ".X", "X."),
  "[": cap("XX", "X.", "X.", "X.", "X.", "X.", "XX"),
  "]": cap("XX", ".X", ".X", ".X", ".X", ".X", "XX"),
  "-": g(7, "XXX"),
  "_": g(10, "XXXXX"),
  "+": g(5, "..X..", "..X..", "XXXXX", "..X..", "..X.."),
  "=": g(6, "XXXX", "....", "XXXX"),
  "/": cap("....X", "...X.", "...X.", "..X..", ".X...", ".X...", "X...."),
  "\\": cap("X....", ".X...", ".X...", "..X..", "...X.", "...X.", "....X"),
  "|": g(3, "X", "X", "X", "X", "X", "X", "X", "X", "X"),
  "%": cap("XX..X", "XX..X", "...X.", "..X..", ".X...", "X..XX", "X..XX"),
  "&": cap(".XX..", "X..X.", "X.X..", ".X...", "X.X.X", "X..X.", ".XX.X"),
  "#": cap(".X.X.", ".X.X.", "XXXXX", ".X.X.", "XXXXX", ".X.X.", ".X.X."),
  "*": g(4, "..X..", "X.X.X", ".XXX.", "X.X.X", "..X.."),
  "<": g(5, "..X", ".X.", "X..", ".X.", "..X"),
  ">": g(5, "X..", ".X.", "..X", ".X.", "X.."),
  $: cap("..X..", ".XXXX", "X.X..", ".XXX.", "..X.X", "XXXX.", "..X.."),
  "@": cap(".XXX.", "X...X", "X.XXX", "X.X.X", "X.XXX", "X....", ".XXXX"),
  "^": cap(".X.", "X.X"),
  "~": g(6, ".XX.X", "X.XX."),
  "`": cap("X.", ".X"),

  // Os sinais que os textos do jogo usam
  "·": g(7, "X"),
  "−": g(7, "XXXX"),
  "–": g(7, "XXXXX"),
  "—": g(7, "XXXXXXX"),
  "…": g(9, "X.X.X"),
  "×": g(5, "X...X", ".X.X.", "..X..", ".X.X.", "X...X"),
  "°": cap(".X.", "X.X", ".X."),
  "º": cap(".X.", "X.X", ".X.", "...", "XXX"),
  "ª": cap("XX.", "..X", "XXX", "...", "XXX"),
  "●": g(4, ".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."),
  "■": g(4, "XXXXX", "XXXXX", "XXXXX", "XXXXX", "XXXXX"),
  "□": g(4, "XXXXX", "X...X", "X...X", "X...X", "XXXXX"),
  "▲": g(5, "..X..", ".XXX.", "XXXXX"),
  "▼": g(5, "XXXXX", ".XXX.", "..X.."),
  "★": cap("...X...", "..XXX..", "XXXXXXX", ".XXXXX.", "..XXX..", ".XX.XX.", "XX...XX"),
  "✓": g(4, "....X", "...X.", "X.X..", ".X...", ".X..."),
  "✗": g(4, "X...X", ".X.X.", "..X..", ".X.X.", "X...X"),
  "→": g(4, "....X..", ".....X.", "XXXXXXX", ".....X.", "....X.."),
  "←": g(4, "..X....", ".X.....", "XXXXXXX", ".X.....", "..X...."),
  "↔": g(4, "..X.X..", ".X...X.", "XXXXXXX", ".X...X.", "..X.X.."),
  "«": g(5, "..X..X", ".X..X.", "X..X..", ".X..X.", "..X..X"),
  "»": g(5, "X..X..", ".X..X.", "..X..X", ".X..X.", "X..X.."),
  "⚑": cap("XXXX.", "XXXXX", "XXXX.", "X....", "X....", "X....", "X...."),
  // As falas do acampamento (CampLife)
  "♪": cap("..X..", "..XX.", "..X.X", "..X..", ".XX..", "XXX..", ".X..."),
  "♫": cap(".XXXX", ".X..X", ".X..X", ".X..X", "XX.XX", "XX.XX"),
  "☺": cap(".XXXXX.", "X.....X", "X.X.X.X", "X.....X", "X.XXX.X", "X.....X", ".XXXXX."),
  "“": cap("X.X", "X.X"),
  "”": cap("X.X", "X.X"),
  "‘": cap("X"),
  "’": cap("X"),
};

/** As marcas de cima (duas linhas) e a cedilha (embaixo). */
const MARKS = {
  acute: [".X", "X."],
  grave: ["X.", ".X"],
  circ: [".X.", "X.X"],
  tilde: [".XX.X", "X.XX."],
  uml: ["...", "X.X"],
} as const;
type Mark = keyof typeof MARKS;

const ACCENTED: Record<string, [string, Mark]> = {
  Á: ["A", "acute"], À: ["A", "grave"], Â: ["A", "circ"], Ã: ["A", "tilde"], Ä: ["A", "uml"],
  É: ["E", "acute"], È: ["E", "grave"], Ê: ["E", "circ"], Ë: ["E", "uml"],
  Í: ["I", "acute"], Ì: ["I", "grave"], Î: ["I", "circ"], Ï: ["I", "uml"],
  Ó: ["O", "acute"], Ò: ["O", "grave"], Ô: ["O", "circ"], Õ: ["O", "tilde"], Ö: ["O", "uml"],
  Ú: ["U", "acute"], Ù: ["U", "grave"], Û: ["U", "circ"], Ü: ["U", "uml"],
  Ñ: ["N", "tilde"],
  á: ["a", "acute"], à: ["a", "grave"], â: ["a", "circ"], ã: ["a", "tilde"], ä: ["a", "uml"],
  é: ["e", "acute"], è: ["e", "grave"], ê: ["e", "circ"], ë: ["e", "uml"],
  í: ["ı", "acute"], ì: ["ı", "grave"], î: ["ı", "circ"], ï: ["ı", "uml"],
  ó: ["o", "acute"], ò: ["o", "grave"], ô: ["o", "circ"], õ: ["o", "tilde"], ö: ["o", "uml"],
  ú: ["u", "acute"], ù: ["u", "grave"], û: ["u", "circ"], ü: ["u", "uml"],
  ñ: ["n", "tilde"],
};

/** O i sem pingo, base do í. */
const DOTLESS_I = low("X", "X", "X", "X", "X");

/** Uma letra como grade de pixels: `ink[y][x]`, com y de 0 a 11 na grade. */
export interface GlyphBitmap {
  width: number;
  ink: boolean[][];
}

function blank(width: number): boolean[][] {
  return Array.from({ length: FONT_ROWS }, () => new Array<boolean>(width).fill(false));
}

function stamp(ink: boolean[][], rows: readonly string[], top: number, left: number): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === "X" && top + j < FONT_ROWS) ink[top + j][left + i] = true;
  });
}

function plain(gl: Glyph): GlyphBitmap {
  const width = Math.max(...gl.rows.map((r) => r.length));
  const ink = blank(width);
  stamp(ink, gl.rows, gl.top, 0);
  return { width, ink };
}

function accented(base: Glyph, mark: Mark, upper: boolean): GlyphBitmap {
  const m = MARKS[mark];
  const baseW = Math.max(...base.rows.map((r) => r.length));
  const width = Math.max(baseW, m[0].length);
  const ink = blank(width);
  stamp(ink, base.rows, base.top, Math.floor((width - baseW) / 2));
  // O acento agudo pende um pouco para a direita, como na escrita
  const shift = mark === "acute" && width - m[0].length >= 2 ? 1 : 0;
  stamp(ink, m, upper ? 0 : 2, Math.floor((width - m[0].length) / 2) + shift);
  return { width, ink };
}

function cedilla(base: Glyph): GlyphBitmap {
  const out = plain(base);
  const mid = Math.floor(out.width / 2);
  out.ink[10][mid] = true;
  out.ink[11][mid - 1] = true;
  return out;
}

/** O desenho de um caractere (null = a fonte não tem, e o navegador usa a próxima). */
export function glyphBitmap(ch: string, bold = false): GlyphBitmap | null {
  let out: GlyphBitmap | null = null;
  if (BASE[ch]) out = plain(BASE[ch]);
  else if (ACCENTED[ch]) {
    const [b, mark] = ACCENTED[ch];
    const base = b === "ı" ? DOTLESS_I : BASE[b];
    out = accented(base, mark, b === b.toUpperCase() && b !== "ı");
  } else if (ch === "Ç") out = cedilla(BASE.C);
  else if (ch === "ç") out = cedilla(BASE.c);
  if (!out || !bold) return out;
  return embolden(out);
}

/**
 * Negrito: cada pixel ganha o vizinho da direita. Antes, as colunas que são um vão de 1 pixel
 * entre duas tintas (as pernas do m, o meio do N) são duplicadas, senão o vão fecha e a letra
 * vira um bloco.
 */
function embolden(bm: GlyphBitmap): GlyphBitmap {
  const gap = (x: number) => bm.ink.some((row) => !row[x] && row[x - 1] && row[x + 1]);
  const cols: number[] = [];
  for (let x = 0; x < bm.width; x++) {
    cols.push(x);
    if (x > 0 && x < bm.width - 1 && gap(x)) cols.push(x);
  }
  const width = cols.length + 1;
  const ink = blank(width);
  for (let y = 0; y < FONT_ROWS; y++) cols.forEach((x, i) => {
    if (bm.ink[y][x]) ink[y][i] = ink[y][i + 1] = true;
  });
  return { width, ink };
}

/** Todos os caracteres que a fonte desenha. */
export function fontChars(): string[] {
  return [...Object.keys(BASE), ...Object.keys(ACCENTED), "Ç", "ç"];
}

// --- Contornos ---

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Os retângulos de tinta de uma letra, em pixels da grade: as corridas de cada linha, juntadas
 * com as de baixo quando têm o mesmo começo e o mesmo fim.
 */
export function glyphRects(bm: GlyphBitmap): Rect[] {
  const done: Rect[] = [];
  let open: Rect[] = [];
  for (let y = 0; y < FONT_ROWS; y++) {
    const runs: [number, number][] = [];
    let x = 0;
    while (x < bm.width) {
      if (!bm.ink[y][x]) {
        x++;
        continue;
      }
      const s = x;
      while (x < bm.width && bm.ink[y][x]) x++;
      runs.push([s, x]);
    }
    const next: Rect[] = [];
    for (const [s, e] of runs) {
      const k = open.findIndex((r) => r.x0 === s && r.x1 === e && r.y1 === y);
      if (k >= 0) {
        const r = open.splice(k, 1)[0];
        r.y1 = y + 1;
        next.push(r);
      } else next.push({ x0: s, y0: y, x1: e, y1: y + 1 });
    }
    done.push(...open);
    open = next;
  }
  return [...done, ...open];
}

// --- TrueType ---

class Writer {
  private bytes: number[] = [];
  get length(): number {
    return this.bytes.length;
  }
  u8(v: number): this {
    this.bytes.push(v & 255);
    return this;
  }
  u16(v: number): this {
    return this.u8(v >> 8).u8(v);
  }
  i16(v: number): this {
    return this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v: number): this {
    return this.u16(Math.floor(v / 65536) & 0xffff).u16(v & 0xffff);
  }
  tag(t: string): this {
    for (let i = 0; i < 4; i++) this.u8(t.charCodeAt(i));
    return this;
  }
  raw(b: ArrayLike<number>): this {
    for (let i = 0; i < b.length; i++) this.bytes.push(b[i]);
    return this;
  }
  pad4(): this {
    while (this.bytes.length % 4) this.bytes.push(0);
    return this;
  }
  done(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.bytes);
  }
}

function checksum(b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) {
    const word = ((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

interface BuiltGlyph {
  code: number;
  advance: number;
  rects: Rect[];
}

/** Um retângulo da grade em unidades do contorno (y para cima, a partir da linha de base). */
function toUnits(r: Rect): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: r.x0 * FONT_UNIT, x1: r.x1 * FONT_UNIT, y0: (FONT_ASCENT - r.y1) * FONT_UNIT, y1: (FONT_ASCENT - r.y0) * FONT_UNIT };
}

function glyfEntry(rects: Rect[]): { data: Uint8Array; xMin: number; yMin: number; xMax: number; yMax: number } {
  if (rects.length === 0) return { data: new Uint8Array(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  const boxes = rects.map(toUnits);
  const xMin = Math.min(...boxes.map((b) => b.x0));
  const xMax = Math.max(...boxes.map((b) => b.x1));
  const yMin = Math.min(...boxes.map((b) => b.y0));
  const yMax = Math.max(...boxes.map((b) => b.y1));
  const w = new Writer();
  w.i16(boxes.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  for (let i = 0; i < boxes.length; i++) w.u16(i * 4 + 3);
  w.u16(0); // sem instruções
  // Todos os pontos na curva, com as coordenadas em 16 bits
  for (let i = 0; i < boxes.length * 4; i++) w.u8(0x01);
  // No sentido horário (contorno de fora no TrueType): baixo-esquerda, cima-esquerda, cima-direita, baixo-direita
  const pts = boxes.flatMap((b) => [
    [b.x0, b.y0],
    [b.x0, b.y1],
    [b.x1, b.y1],
    [b.x1, b.y0],
  ]);
  let px = 0;
  for (const [x] of pts) {
    w.i16(x - px);
    px = x;
  }
  let py = 0;
  for (const [, y] of pts) {
    w.i16(y - py);
    py = y;
  }
  return { data: w.done(), xMin, yMin, xMax, yMax };
}

function nameTable(family: string, style: string): Uint8Array<ArrayBuffer> {
  const names: [number, string][] = [
    [1, family],
    [2, style],
    [3, `${family} ${style}`],
    [4, `${family} ${style}`],
    [5, "Version 1.0"],
    [6, `${family.replace(/\s+/g, "")}-${style}`],
  ];
  const strings = names.map(([, s]) => {
    const out: number[] = [];
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      out.push(c >> 8, c & 255);
    }
    return out;
  });
  const w = new Writer();
  w.u16(0).u16(names.length).u16(6 + names.length * 12);
  let offset = 0;
  names.forEach(([id], i) => {
    w.u16(3).u16(1).u16(0x409).u16(id).u16(strings[i].length).u16(offset);
    offset += strings[i].length;
  });
  for (const s of strings) w.raw(s);
  return w.done();
}

function cmapTable(glyphs: BuiltGlyph[]): Uint8Array<ArrayBuffer> {
  // Formato 4: um segmento por caractere (ordem crescente), e o 0xFFFF que fecha
  const mapped = glyphs.map((gl, i) => ({ code: gl.code, gid: i })).filter((m) => m.code >= 0).sort((a, b) => a.code - b.code);
  const segs = [...mapped.map((m) => ({ start: m.code, end: m.code, delta: (m.gid - m.code + 65536) % 65536 })), { start: 0xffff, end: 0xffff, delta: 1 }];
  const segX2 = segs.length * 2;
  let search = 1;
  let selector = 0;
  while (search * 2 <= segs.length) {
    search *= 2;
    selector++;
  }
  const sub = new Writer();
  const length = 16 + segs.length * 8;
  sub.u16(4).u16(length).u16(0).u16(segX2).u16(search * 2).u16(selector).u16(segX2 - search * 2);
  for (const s of segs) sub.u16(s.end);
  sub.u16(0);
  for (const s of segs) sub.u16(s.start);
  for (const s of segs) sub.u16(s.delta);
  for (let i = 0; i < segs.length; i++) sub.u16(0);
  const w = new Writer();
  w.u16(0).u16(1).u16(3).u16(1).u32(12).raw(sub.done());
  return w.done();
}

/**
 * A fonte inteira em TrueType: as letras de `fontChars()`, regular ou negrito. Os bytes vão
 * direto para um `FontFace` do navegador.
 */
export function buildPixelFont(bold = false): Uint8Array<ArrayBuffer> {
  const glyphs: BuiltGlyph[] = [];
  // 0: .notdef, uma caixa vazada
  const box: GlyphBitmap = { width: 5, ink: blank(5) };
  for (let y = 3; y <= 9; y++) for (let x = 0; x < 5; x++) box.ink[y][x] = y === 3 || y === 9 || x === 0 || x === 4;
  glyphs.push({ code: -1, advance: 6 * FONT_UNIT, rects: glyphRects(box) });
  for (const ch of fontChars()) {
    const bm = glyphBitmap(ch, bold);
    if (!bm) continue;
    const rects = glyphRects(bm);
    glyphs.push({ code: ch.codePointAt(0)!, advance: (bm.width + 1) * FONT_UNIT, rects: ch === " " ? [] : rects });
  }
  // O espaço sem quebra é um espaço
  glyphs.push({ code: 0xa0, advance: 4 * FONT_UNIT, rects: [] });

  const entries = glyphs.map((gl) => glyfEntry(gl.rects));
  const glyf = new Writer();
  const loca = new Writer();
  for (const e of entries) {
    loca.u32(glyf.length);
    glyf.raw(e.data).pad4();
  }
  loca.u32(glyf.length);

  const drawn = entries.filter((e) => e.data.length > 0);
  const xMin = Math.min(0, ...drawn.map((e) => e.xMin));
  const yMin = Math.min(...drawn.map((e) => e.yMin));
  const xMax = Math.max(...drawn.map((e) => e.xMax));
  const yMax = Math.max(...drawn.map((e) => e.yMax));
  const advanceMax = Math.max(...glyphs.map((gl) => gl.advance));
  const maxContours = Math.max(...glyphs.map((gl) => gl.rects.length));
  const ascent = FONT_ASCENT * FONT_UNIT;
  const descent = (FONT_ROWS - FONT_ASCENT) * FONT_UNIT;
  const lineGap = 2 * FONT_UNIT;
  const codes = glyphs.map((gl) => gl.code).filter((c) => c >= 0);

  const head = new Writer();
  head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(UNITS_PER_EM);
  head.u32(0).u32(0).u32(0).u32(0); // criada e modificada
  head.i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(bold ? 1 : 0).u16(8).i16(2).i16(1).i16(0);

  const hhea = new Writer();
  hhea.u32(0x00010000).i16(ascent).i16(-descent).i16(lineGap).u16(advanceMax);
  hhea.i16(Math.min(0, ...drawn.map((e) => e.xMin)));
  hhea.i16(Math.min(...glyphs.map((gl, i) => gl.advance - entries[i].xMax)));
  hhea.i16(xMax).i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length);

  const maxp = new Writer();
  maxp.u32(0x00010000).u16(glyphs.length).u16(maxContours * 4).u16(maxContours).u16(0).u16(0);
  maxp.u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

  const hmtx = new Writer();
  glyphs.forEach((gl, i) => hmtx.u16(gl.advance).i16(entries[i].data.length ? entries[i].xMin : 0));

  const os2 = new Writer();
  const avg = Math.round(glyphs.reduce((n, gl) => n + gl.advance, 0) / glyphs.length);
  os2.u16(4).i16(avg).u16(bold ? 700 : 400).u16(5).u16(0);
  // Subscrito, sobrescrito e risco
  os2.i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(FONT_UNIT).i16(3 * FONT_UNIT);
  os2.i16(0).raw([2, 0, 6, bold ? 8 : 5, 0, 9, 0, 0, 0, 0]);
  os2.u32(0x00000003).u32(0).u32(0).u32(0).tag("NONE");
  os2.u16(bold ? 0x20 : 0x40).u16(Math.min(...codes)).u16(Math.min(0xffff, Math.max(...codes)));
  os2.i16(ascent).i16(-descent).i16(lineGap).u16(ascent).u16(descent);
  os2.u32(0x00000001).u32(0).i16(5 * FONT_UNIT).i16(7 * FONT_UNIT).u16(0).u16(32).u16(2);

  const post = new Writer();
  post.u32(0x00030000).u32(0).i16(-FONT_UNIT).i16(FONT_UNIT).u32(0).u32(0).u32(0).u32(0).u32(0);

  const tables: [string, Uint8Array][] = [
    ["OS/2", os2.done()],
    ["cmap", cmapTable(glyphs)],
    ["glyf", glyf.done()],
    ["head", head.done()],
    ["hhea", hhea.done()],
    ["hmtx", hmtx.done()],
    ["loca", loca.done()],
    ["maxp", maxp.done()],
    ["name", nameTable(PIXEL_FAMILY, bold ? "Bold" : "Regular")],
    ["post", post.done()],
  ];

  let search = 1;
  let selector = 0;
  while (search * 2 <= tables.length) {
    search *= 2;
    selector++;
  }
  const out = new Writer();
  out.u32(0x00010000).u16(tables.length).u16(search * 16).u16(selector).u16(tables.length * 16 - search * 16);
  let offset = 12 + tables.length * 16;
  for (const [tag, data] of tables) {
    out.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
    offset += Math.ceil(data.length / 4) * 4;
  }
  for (const [, data] of tables) out.raw(data).pad4();
  const font = out.done();
  // O ajuste da soma do head: 0xB1B0AFBA menos a soma do arquivo inteiro
  const headAt = 12 + tables.length * 16 + tables.slice(0, 3).reduce((n, [, d]) => n + Math.ceil(d.length / 4) * 4, 0);
  const adjust = (0xb1b0afba - checksum(font) + 0x100000000) >>> 0;
  new DataView(font.buffer).setUint32(headAt + 8, adjust);
  return font;
}

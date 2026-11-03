/**
 * Chão em pixel art (G2). O pedaço de chão é pintado em 1 px de textura por px de mundo, como
 * sempre foi (bioma, relevo, rios, estradas, zonas), e depois passa por este filtro:
 * - cada ponto é classificado pelo material, pela cor: grama, terra, areia, rocha, neve ou água;
 *   a borda entre dois materiais sai serrilhada (a cor vem às vezes do vizinho);
 * - manchas grandes, mais claras e mais escuras, com a borda pontilhada (Bayer 4×4);
 * - por cima, o desenho miúdo do material, espalhado sem repetir: tufos e folhas na grama,
 *   pedrinhas na terra, ondas na areia, rachas na pedra, reflexos na água, e flores onde a
 *   grama é viçosa (em canteiros, não por igual);
 * - a grama faz sombra na terra logo abaixo dela;
 * - na beira da água, o barranco: a terra de cima mostra a face (3 ou 4 px de terra molhada) e
 *   faz sombra na água (na praia, só areia molhada); embaixo e dos lados, a água bate na terra
 *   com uma linha de espuma, e a terra fica molhada.
 * Tudo depende só da posição no mundo: pedaços vizinhos se encontram sem emenda (quem chama
 * passa uma imagem com folga em volta, e as bordas olham os vizinhos de verdade).
 */

const GRASS = 0;
const DIRT = 1;
const SAND = 2;
const ROCK = 3;
const SNOW = 4;
const WATER = 5;
const MATERIALS = 6;

/** Quanto cada degrau do desenho miúdo clareia ou escurece, por material. */
const SHADE = [0.1, 0.09, 0.06, 0.1, 0.035, 0.08];
/** Quanto as manchas grandes clareiam ou escurecem, por material. */
const PATCH = [0.06, 0.06, 0.04, 0.08, 0.025, 0.045];
/** Lado da célula onde cai cada desenho miúdo, quantos tenta por célula e a chance de cada um. */
const CELL = [4, 5, 6, 5, 6, 7];
const TRIES = [2, 1, 1, 1, 1, 1];
const DENSITY = [0.72, 0.8, 0.55, 0.85, 0.45, 0.4];
/** Flores: códigos a partir daqui (a cor é o resto). */
const FLOWER = 10;
const FLOWER_COLORS = [
  [236, 232, 214],
  [238, 204, 72],
  [196, 150, 222],
  [222, 96, 84],
];
/** Códigos da beira da água (depois das flores). */
const BANK = 20;
const WET = 21;
const FOAM = 22;
const FOAM_SOFT = 23;
const BANK_COLOR = [64, 48, 32];
const FOAM_COLOR = [214, 234, 238];
const JITTER = [-1, 0, 0, 1];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x5bd1e995);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Material pela cor já pintada (o que o pedaço desenhou: bioma, estrada, rio, zona). */
function materialOf(r: number, g: number, b: number): number {
  const lo = Math.min(r, g, b);
  if (lo > 185) return SNOW;
  if (b > r + 18 && b >= g - 10) return WATER;
  const hi = Math.max(r, g, b);
  if (hi - lo < 22 && hi < 190) return ROCK;
  if (g - (r + b) / 2 > 26) return GRASS;
  if (r > 165 && g > 140) return SAND;
  return DIRT;
}

/** Ruído suave (valor numa grade de `cell` px, interpolado), somado em `out` com o peso dado. */
function addNoise(out: Float32Array, w: number, h: number, x0: number, y0: number, cell: number, seed: number, weight: number): void {
  const gx0 = Math.floor(x0 / cell);
  const gy0 = Math.floor(y0 / cell);
  const nx = Math.floor((x0 + w - 1) / cell) - gx0 + 2;
  const ny = Math.floor((y0 + h - 1) / cell) - gy0 + 2;
  const grid = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[j * nx + i] = hash(gx0 + i, gy0 + j, seed) / 4294967296;
  const col = new Int32Array(w);
  const fx = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const g = (x0 + x) / cell;
    col[x] = Math.floor(g) - gx0;
    const f = g - Math.floor(g);
    fx[x] = f * f * (3 - 2 * f);
  }
  for (let y = 0; y < h; y++) {
    const g = (y0 + y) / cell;
    const row = (Math.floor(g) - gy0) * nx;
    let fy = g - Math.floor(g);
    fy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < w; x++) {
      const k = row + col[x];
      const top = grid[k] + (grid[k + 1] - grid[k]) * fx[x];
      const bottom = grid[k + nx] + (grid[k + nx + 1] - grid[k + nx]) * fx[x];
      out[y * w + x] += (top + (bottom - top) * fy) * weight;
    }
  }
}

type Put = (x: number, y: number, v: number) => void;

/** O desenho miúdo de cada material, ancorado em (x, y); `k` escolhe a forma. */
const STAMPS: ((put: Put, x: number, y: number, k: number) => void)[] = [
  // Grama: folha solta, tufo em "v", folha alta, manchinhas e touceira
  (put, x, y, k) => {
    switch (k % 8) {
      case 0:
      case 1:
        put(x, y - 1, 1);
        put(x, y, -1);
        break;
      case 2:
      case 3:
        put(x - 1, y - 1, 1);
        put(x + 1, y - 1, 1);
        put(x, y, -1);
        break;
      case 4:
        put(x, y - 2, 2);
        put(x, y - 1, 1);
        put(x - 1, y, -1);
        put(x, y, -2);
        put(x + 1, y, -1);
        break;
      case 5:
        put(x, y, -1);
        break;
      case 6:
        put(x, y, 1);
        break;
      default:
        put(x, y - 1, 1);
        put(x + 1, y - 1, 2);
        put(x, y, -1);
        put(x + 1, y, -1);
    }
  },
  // Terra: grãos, pedrinhas com luz em cima e sombra embaixo, risco
  (put, x, y, k) => {
    switch (k % 7) {
      case 0:
      case 1:
      case 2:
        put(x, y, -1);
        break;
      case 3:
        put(x, y, 1);
        break;
      case 4:
        put(x, y, 2);
        put(x + 1, y, 1);
        put(x, y + 1, -2);
        put(x + 1, y + 1, -2);
        break;
      case 5:
        put(x, y, -2);
        put(x + 1, y, -1);
        break;
      default:
        put(x, y, 1);
        put(x, y + 1, -1);
    }
  },
  // Areia: ondas do vento (traço claro em arco com a sombra logo abaixo) e grãos
  (put, x, y, k) => {
    if (k % 6 < 4) {
      const len = 3 + (k % 4);
      for (let i = 0; i < len; i++) {
        const dy = i > 0 && i < len - 1 ? 0 : 1;
        put(x + i, y + dy, 1);
        put(x + i, y + dy + 1, -1);
      }
    } else put(x, y, k % 2 ? 1 : -1);
  },
  // Rocha: grãos, lascas e rachas (linha escura com a borda clara)
  (put, x, y, k) => {
    switch (k % 6) {
      case 0:
      case 1:
        put(x, y, -1);
        break;
      case 2:
        put(x, y, 1);
        break;
      case 3:
        put(x, y, 2);
        put(x + 1, y, 1);
        put(x, y + 1, -1);
        break;
      default: {
        let cy = y;
        const len = 3 + (k % 4);
        for (let i = 0; i < len; i++) {
          put(x + i, cy, -2);
          put(x + i, cy - 1, 1);
          if ((k >>> i) & 1) cy += (k >>> (i + 4)) & 1 ? 1 : -1;
        }
      }
    }
  },
  // Neve: sombras azuladas miúdas, montinhos e um brilho de vez em quando
  (put, x, y, k) => {
    switch (k % 6) {
      case 0:
        put(x, y, 2);
        break;
      case 1:
        put(x, y, -1);
        put(x + 1, y, -1);
        put(x + 2, y, -1);
        put(x + 1, y - 1, 1);
        break;
      default:
        put(x, y, -1);
    }
  },
  // Água: reflexos em traços na horizontal, claros e escuros
  (put, x, y, k) => {
    const len = 2 + (k % 4);
    const c = k % 5 < 3 ? 1 : -1;
    for (let i = 0; i < len; i++) put(x + i, y, i === 0 || i === len - 1 ? c : c * 2);
  },
];

// Buffers reaproveitados entre pedaços (o filtro roda um pedaço por vez)
let mat = new Uint8Array(0);
let code = new Int8Array(0);
let field = new Float32Array(0);
let meadow = new Float32Array(0);

/**
 * Passa o filtro numa imagem do chão (RGBA, `w` de largura) cujo canto fica no ponto (x0, y0)
 * do mundo, 1 px por px de mundo. `flowers` é quanto florescem os canteiros (0 no inverno).
 */
export function pixelGround(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, flowers = 1): void {
  const n = w * h;
  if (mat.length < n) {
    mat = new Uint8Array(n);
    code = new Int8Array(n);
    field = new Float32Array(n);
    meadow = new Float32Array(n);
  }
  const src = data.slice();

  // 1. Material e cor de cada ponto (às vezes a do vizinho: borda serrilhada)
  let present = 0;
  for (let y = 0; y < h; y++) {
    const wy = y0 + y;
    for (let x = 0; x < w; x++) {
      const wx = x0 + x;
      let j = Math.imul(wx, 374761393) + Math.imul(wy, 668265263);
      j = Math.imul(j ^ (j >>> 13), 1274126177);
      j ^= j >>> 16;
      const sx = Math.min(w - 1, Math.max(0, x + JITTER[j & 3]));
      const sy = Math.min(h - 1, Math.max(0, y + JITTER[(j >>> 2) & 3]));
      const s = (sy * w + sx) * 4;
      const k = (y * w + x) * 4;
      data[k] = src[s];
      data[k + 1] = src[s + 1];
      data[k + 2] = src[s + 2];
      const m = materialOf(src[s], src[s + 1], src[s + 2]);
      mat[y * w + x] = m;
      present |= 1 << m;
    }
  }

  // 2. Manchas grandes e canteiros de flores
  field.fill(0, 0, n);
  meadow.fill(0, 0, n);
  addNoise(field, w, h, x0, y0, 48, 1, 0.65);
  addNoise(field, w, h, x0, y0, 17, 2, 0.35);
  addNoise(meadow, w, h, x0, y0, 70, 3, 1);

  // 3. Desenho miúdo: cada célula do mundo sorteia o seu, e só pinta os pontos do próprio material
  code.fill(0, 0, n);
  const pad = 6;
  for (let m = 0; m < MATERIALS; m++) {
    if (!(present & (1 << m))) continue;
    const size = CELL[m];
    const stamp = STAMPS[m];
    const put: Put = (px, py, v) => {
      const lx = px - x0;
      const ly = py - y0;
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) return;
      const i = ly * w + lx;
      if (mat[i] === m) code[i] = v;
    };
    const c0 = Math.floor((x0 - pad) / size);
    const c1 = Math.floor((x0 + w + pad) / size);
    const r0 = Math.floor((y0 - pad) / size);
    const r1 = Math.floor((y0 + h + pad) / size);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        for (let t = 0; t < TRIES[m]; t++) {
          const hv = hash(cx, cy, 11 + m * 7 + t);
          if ((hv & 1023) / 1024 >= DENSITY[m]) continue;
          const ax = cx * size + ((hv >>> 10) % size);
          const ay = cy * size + ((hv >>> 14) % size);
          // Flores na grama, só nos canteiros
          if (m === GRASS && t === 0 && flowers > 0) {
            const lx = ax - x0;
            const ly = ay - y0;
            const bloom = lx >= 0 && ly >= 0 && lx < w && ly < h ? meadow[ly * w + lx] - 0.64 : 0;
            if (bloom > 0 && ((hv >>> 20) & 255) / 256 < bloom * 1.6 * flowers) {
              put(ax, ay, FLOWER + ((hv >>> 28) & 3));
              put(ax, ay + 1, -2);
              continue;
            }
          }
          stamp(put, ax, ay, hv >>> 18);
        }
      }
    }
  }

  // 4. Bordas: a grama faz sombra no chão logo abaixo
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mat[i];
      const above = mat[i - w];
      if (above === m || m === WATER) continue;
      if (above === GRASS) code[i] = Math.min(code[i], -2);
    }
  }

  // 4b. Beira da água (vista de cima e um pouco de frente)
  if (present & (1 << WATER)) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const m = mat[i];
        if (m === WATER) {
          // Sombra do barranco logo abaixo da terra; espuma onde a água encosta embaixo e dos lados
          // (a areia da praia não faz sombra: a água bate nela com espuma)
          const a1 = y > 0 ? mat[i - w] : WATER;
          const a2 = y > 1 ? mat[i - 2 * w] : WATER;
          const up1 = a1 !== WATER && a1 !== SAND;
          if (up1 || (a2 !== WATER && a2 !== SAND)) {
            code[i] = up1 ? -2 : Math.min(code[i], -1);
            continue;
          }
          const down1 = a1 === SAND || (y < h - 1 && mat[i + w] !== WATER);
          const side = (x > 0 && mat[i - 1] !== WATER) || (x < w - 1 && mat[i + 1] !== WATER);
          if (down1 || side) code[i] = FOAM;
          else if ((y < h - 2 && mat[i + 2 * w] !== WATER) || (x > 1 && mat[i - 2] !== WATER) || (x < w - 2 && mat[i + 2] !== WATER)) code[i] = FOAM_SOFT;
          continue;
        }
        if (m === SNOW) continue;
        // Terra logo acima da água: a face do barranco, de 2 ou 3 px (a altura muda aos poucos)
        const tall = field[i] > 0.5 ? 4 : 3;
        let bank = false;
        for (let d = 1; d <= tall && y + d < h; d++) {
          if (mat[i + d * w] === WATER) {
            bank = true;
            break;
          }
        }
        if (bank) {
          // Praia não tem barranco: a areia desce molhada até a água
          code[i] = m === SAND ? WET : BANK;
          continue;
        }
        // Terra logo abaixo ou ao lado da água: molhada
        if ((y > 0 && mat[i - w] === WATER) || (x > 0 && mat[i - 1] === WATER) || (x < w - 1 && mat[i + 1] === WATER)) code[i] = WET;
      }
    }
  }

  // 5. Cor final: a cor pintada, clareada ou escurecida pela mancha e pelo desenho
  for (let y = 0; y < h; y++) {
    const row = ((y0 + y) & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const k = i * 4;
      const m = mat[i];
      const r = data[k];
      const g = data[k + 1];
      const b = data[k + 2];
      const c = code[i];
      if (c >= BANK) {
        const v = BAYER[row + ((x0 + x) & 3)] - 0.5;
        if (c === BANK) {
          // A face do barranco: terra escura e molhada, mais escura embaixo (onde a água bate)
          const dark = mat[i + w] === WATER ? 0.78 : 1 + v * 0.08;
          data[k] = (r * 0.25 + BANK_COLOR[0] * 0.75) * dark;
          data[k + 1] = (g * 0.25 + BANK_COLOR[1] * 0.75) * dark;
          data[k + 2] = (b * 0.25 + BANK_COLOR[2] * 0.75) * dark;
        } else if (c === WET) {
          data[k] = r * 0.8;
          data[k + 1] = g * 0.8;
          data[k + 2] = b * 0.84;
        } else {
          const t = c === FOAM ? 0.62 : 0.24;
          data[k] = r + (FOAM_COLOR[0] - r) * t;
          data[k + 1] = g + (FOAM_COLOR[1] - g) * t;
          data[k + 2] = b + (FOAM_COLOR[2] - b) * t;
        }
        continue;
      }
      if (c >= FLOWER) {
        // Flor só na grama viçosa; na grama seca vira só uma folha clara
        if (g - (r + b) / 2 > 40) {
          const f = FLOWER_COLORS[c - FLOWER];
          data[k] = f[0];
          data[k + 1] = f[1];
          data[k + 2] = f[2];
          continue;
        }
      }
      const v = (field[i] - 0.5) / 0.11 + (BAYER[row + ((x0 + x) & 3)] - 0.5) * 0.9;
      const patch = v < -1 ? -1 : v > 1 ? 1 : 0;
      const f = 1 + patch * PATCH[m] + (c >= FLOWER ? 1 : c) * SHADE[m];
      data[k] = r * f;
      data[k + 1] = g * f;
      data[k + 2] = b * f;
    }
  }
}

/** Onde a água brilha: no meio dela (reflexo que corre) ou na beira (espuma que vem e vai). */
export interface WaterSpot {
  x: number;
  y: number;
  shore: boolean;
}

/**
 * O brilho ainda cai na água depois das peças nítidas (ponte, cais, pedra do vau)? Olha a cor final
 * do ponto e dos vizinhos na horizontal.
 */
export function stillWater(data: Uint8ClampedArray, w: number, h: number, lx: number, ly: number, reach = 3): boolean {
  if (ly < 0 || ly >= h) return false;
  for (let d = -reach; d <= reach; d++) {
    const x = lx + d;
    if (x < 0 || x >= w) return false;
    const k = (ly * w + x) * 4;
    const r = data[k];
    const g = data[k + 1];
    const b = data[k + 2];
    // Água ou espuma (a espuma é clara, mas segue mais azul que vermelha)
    if (!(b > r + 12 && b >= g - 14)) return false;
  }
  return true;
}

/** Lado da célula do mundo onde cai cada brilho, e a chance de cada célula ter um. */
const GLINT_CELL = 16;
const GLINT_CHANCE = 0.5;
const FOAM_CHANCE = 0.75;

/** Um ponto de espuma dentro da célula que começa em (lx, ly), ou -1 (o índice na imagem). */
function foamIn(lx: number, ly: number, w: number, h: number, hv: number): number {
  // Começa num ponto sorteado da célula, para a espuma não cair sempre no mesmo canto
  const n = GLINT_CELL * GLINT_CELL;
  const start = (hv >>> 22) % n;
  for (let k = 0; k < n; k++) {
    const s = (start + k) % n;
    const px = lx + (s % GLINT_CELL);
    const py = ly + Math.floor(s / GLINT_CELL);
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    if (code[py * w + px] === FOAM) return py * w + px;
  }
  return -1;
}

/**
 * Os brilhos da água do último pedaço filtrado por `pixelGround` (mesma imagem: `w`×`h`, canto em
 * (x0, y0)), só os que caem dentro de `inner` (o pedaço sem a folga). Cada célula do mundo sorteia
 * o seu ponto: pedaços vizinhos nunca repetem nem perdem um brilho.
 */
export function waterSpots(w: number, h: number, x0: number, y0: number, inner: { x: number; y: number; w: number; h: number }): WaterSpot[] {
  const out: WaterSpot[] = [];
  const c0 = Math.floor(inner.x / GLINT_CELL);
  const c1 = Math.floor((inner.x + inner.w - 1) / GLINT_CELL);
  const r0 = Math.floor(inner.y / GLINT_CELL);
  const r1 = Math.floor((inner.y + inner.h - 1) / GLINT_CELL);
  const water = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mat[y * w + x] === WATER;
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const hv = hash(cx, cy, 97);
      const wx = cx * GLINT_CELL + (hv % GLINT_CELL);
      const wy = cy * GLINT_CELL + ((hv >>> 8) % GLINT_CELL);
      if (wx < inner.x || wy < inner.y || wx >= inner.x + inner.w || wy >= inner.y + inner.h) continue;
      const lx = wx - x0;
      const ly = wy - y0;
      const roll = ((hv >>> 16) & 1023) / 1024;
      // Espuma: a linha da beira é fina, então procura um ponto dela na célula
      const foam = roll < FOAM_CHANCE ? foamIn(cx * GLINT_CELL - x0, cy * GLINT_CELL - y0, w, h, hv) : -1;
      if (foam >= 0) {
        const fx = x0 + (foam % w);
        const fy = y0 + Math.floor(foam / w);
        if (fx >= inner.x && fy >= inner.y && fx < inner.x + inner.w && fy < inner.y + inner.h) out.push({ x: fx, y: fy, shore: true });
        continue;
      }
      if (!water(lx, ly)) continue;
      // Reflexo só onde cabe o traço inteiro, longe da margem
      if (roll >= GLINT_CHANCE) continue;
      let open = true;
      for (let d = -4; d <= 4 && open; d++) open = water(lx + d, ly) && water(lx + d, ly - 2) && water(lx + d, ly + 2);
      if (open) out.push({ x: wx, y: wy, shore: false });
    }
  }
  return out;
}

import { Grid, gridBitmap, seeded, type Bitmap } from "./pixel";

/**
 * Peças do chão em pixel art (G2) que não passam pelo filtro: picos das montanhas, pontes, vaus e
 * balsas. Vão por cima do chão já filtrado, nítidas, e cada uma depende só do lugar no mundo: os
 * pedaços vizinhos desenham a mesma peça e se encontram sem emenda. Sem Phaser aqui.
 */

// --- Picos ---

export interface PeakSpot {
  x: number;
  y: number;
  size: number;
  seed: number;
}

/** Lado da célula do mundo de cada pico, e a chance de a célula ter um. */
const PEAK_CELL = 105;
const PEAK_CHANCE = 0.85;
/**
 * Desenhos de pico por tamanho (8 tamanhos, de 80 a 150 px): 48 formas no mundo todo, guardadas.
 * Um pico único por célula custava ~0,25 ms cada, e um pedaço de serra tem uns 200.
 */
export const PEAK_SHAPES = 6;

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed, 0x5bd1e995);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Os picos que tocam o retângulo dado, de trás para a frente (o de baixo cobre o de cima).
 * `mountain` diz se o pé do pico cai na montanha alta (fora dos passos).
 */
export function peakSpots(x: number, y: number, w: number, h: number, mountain: (x: number, y: number) => boolean): PeakSpot[] {
  const reach = 170;
  const out: PeakSpot[] = [];
  const c0 = Math.floor((x - reach) / PEAK_CELL);
  const c1 = Math.floor((x + w + reach) / PEAK_CELL);
  const r0 = Math.floor(y / PEAK_CELL);
  const r1 = Math.floor((y + h + reach) / PEAK_CELL);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const hv = hash(c, r, 31);
      if ((hv & 1023) / 1024 >= PEAK_CHANCE) continue;
      const px = c * PEAK_CELL + ((hv >>> 10) % PEAK_CELL);
      const py = r * PEAK_CELL + ((hv >>> 17) % PEAK_CELL);
      const size = 80 + 10 * ((hv >>> 24) % 8);
      if (px + size / 2 < x || px - size / 2 > x + w || py < y || py - size > y + h) continue;
      if (!mountain(px, py)) continue;
      out.push({ x: px, y: py, size, seed: 1 + ((hv >>> 4) % PEAK_SHAPES) * 7919 });
    }
  }
  return out.sort((a, b) => a.y - b.y);
}

const ROCK_LIT = 0x8f887c;
const ROCK = 0x6e675e;
const ROCK_DARK = 0x534d47;
const ROCK_DEEP = 0x423d39;
const SNOW_LIT = 0xeef2f6;
const SNOW_SHADE = 0xbfcadb;

/** Um pico: face com luz a oeste, sombra a leste, crista torta, neve no alto e contorno. */
export function peakGrid(seed: number, size: number, winter: boolean): { grid: Grid; ax: number; ay: number } {
  const rnd = seeded(seed);
  const w = size;
  const h = Math.round(size * (0.72 + rnd() * 0.16));
  const g = new Grid(w + 2, h + 2);
  const apex = Math.round(w * (0.38 + rnd() * 0.24));
  // Silhueta: de cada lado o morro desce do cume, com degraus na encosta
  const top: number[] = [];
  let wobble = 0;
  for (let x = 0; x < w; x++) {
    const t = x <= apex ? (apex - x) / Math.max(1, apex) : (x - apex) / Math.max(1, w - 1 - apex);
    if (rnd() < 0.35) wobble = Math.max(-2, Math.min(2, wobble + (rnd() < 0.5 ? -1 : 1)));
    const curve = t < 0.5 ? t * 1.15 : 0.575 + (t - 0.5) * 0.85;
    top.push(Math.max(0, Math.min(h - 1, Math.round(curve * (h - 1)) + (x === apex ? 0 : wobble))));
  }
  // Crista: do cume para baixo, torta
  let ridge = apex;
  const ridgeAt: number[] = [];
  for (let y = 0; y < h; y++) {
    if (y > 2 && rnd() < 0.3) ridge += rnd() < 0.5 ? -1 : 1;
    ridgeAt.push(ridge);
  }
  const cap = winter ? 0.55 : 0.32;
  for (let x = 0; x < w; x++) {
    const snowTo = top[x] + Math.round(h * cap * (0.6 + rnd() * 0.5) * (1 - Math.abs(x - apex) / w));
    for (let y = top[x]; y < h; y++) {
      const lit = x < ridgeAt[y];
      const snow = y <= snowTo;
      let c = snow ? (lit ? SNOW_LIT : SNOW_SHADE) : lit ? ROCK_LIT : ROCK;
      if (!snow && !lit && x > ridgeAt[y] + (w - ridgeAt[y]) * 0.55) c = ROCK_DARK;
      if (!snow && y > h * 0.82) c = lit ? ROCK : ROCK_DEEP;
      g.px(x + 1, y + 1, c);
    }
  }
  // Estratos: riscos escuros na face com luz
  for (let k = 0; k < 3 + Math.floor(rnd() * 3); k++) {
    const y = Math.round(h * (0.45 + rnd() * 0.4));
    const x = Math.round(rnd() * apex);
    const len = 2 + Math.floor(rnd() * 5);
    for (let i = 0; i < len; i++) if (g.get(x + i + 1, y + 1) === ROCK_LIT) g.px(x + i + 1, y + 1, ROCK);
  }
  g.outline();
  return { grid: g, ax: Math.round(w / 2) + 1, ay: h + 1 };
}

const peakCache = new Map<string, { bitmap: Bitmap; ax: number; ay: number }>();

/** O bitmap de um pico, no tamanho da escala (guardado: são poucas formas, e todo pedaço repete). */
export function peakBitmap(p: PeakSpot, winter: boolean, scale = 1): { bitmap: Bitmap; ax: number; ay: number } {
  const key = `${p.seed}|${p.size}|${winter}|${scale}`;
  let hit = peakCache.get(key);
  if (!hit) {
    const { grid, ax, ay } = peakGrid(p.seed, Math.max(10, Math.round(p.size * scale)), winter);
    hit = { bitmap: gridBitmap(grid), ax, ay };
    peakCache.set(key, hit);
  }
  return hit;
}

/** Copia um bitmap para a imagem (RGBA, `w`×`h`), com o canto em (ox, oy) da imagem, com transparência. */
export function blit(data: Uint8ClampedArray, w: number, h: number, ox: number, oy: number, b: Bitmap): void {
  for (let y = Math.max(0, -oy); y < b.height && oy + y < h; y++) {
    for (let x = Math.max(0, -ox); x < b.width && ox + x < w; x++) {
      const s = (y * b.width + x) * 4;
      const a = b.rgba[s + 3];
      if (a === 0) continue;
      const d = ((oy + y) * w + ox + x) * 4;
      if (a === 255) {
        data[d] = b.rgba[s];
        data[d + 1] = b.rgba[s + 1];
        data[d + 2] = b.rgba[s + 2];
      } else {
        const t = a / 255;
        data[d] += (b.rgba[s] - data[d]) * t;
        data[d + 1] += (b.rgba[s + 1] - data[d + 1]) * t;
        data[d + 2] += (b.rgba[s + 2] - data[d + 2]) * t;
      }
    }
  }
}

// --- Travessias ---

export interface CrossingArt {
  id: string;
  kind: "BRIDGE" | "FORD" | "FERRY";
  x: number;
  y: number;
  /** Direção do rio ali (a travessia corta o rio na perpendicular). */
  angle: number;
  width: number;
  burned: boolean;
  /** Vau debaixo da cheia ou do gelo: não aparece. */
  hidden: boolean;
  /** O ponto é rio? (as pedras do vau só ficam na água, mesmo onde o rio faz curva) */
  inRiver: (x: number, y: number) => boolean;
}

type RGB = readonly [number, number, number];
const WOOD: RGB = [132, 94, 56];
const WOOD_LIGHT: RGB = [164, 120, 72];
const WOOD_DARK: RGB = [84, 58, 34];
const WOOD_GAP: RGB = [62, 42, 26];
const EDGE: RGB = [40, 28, 20];
const STONE: RGB = [130, 126, 118];
const STONE_LIGHT: RGB = [156, 152, 142];
const MORTAR: RGB = [86, 82, 78];
const CHAR: RGB = [34, 28, 24];
const CHAR_LIGHT: RGB = [62, 48, 36];
const ROPE: RGB = [214, 198, 156];

/** Até onde a peça vai a partir do centro (para saber que pedaços ela toca). */
export function crossingReach(c: Pick<CrossingArt, "width">, length: number): number {
  return Math.hypot(length / 2, c.width / 2 + 60) + 8;
}

/**
 * Desenha a travessia na imagem: cada ponto vira coordenada local (u ao longo do rio, v de margem
 * a margem) e a cor sai de uma regra, então a peça sai nítida em qualquer ângulo. A imagem tem
 * `scale` px por px de mundo, com o canto no ponto (x0, y0) do mundo.
 */
export function paintCrossing(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, c: CrossingArt, length: number, scale = 1): void {
  if (c.hidden) return;
  const reach = crossingReach(c, length);
  const xa = Math.max(0, Math.floor((c.x - reach - x0) * scale));
  const xb = Math.min(w - 1, Math.ceil((c.x + reach - x0) * scale));
  const ya = Math.max(0, Math.floor((c.y - reach - y0) * scale));
  const yb = Math.min(h - 1, Math.ceil((c.y + reach - y0) * scale));
  if (xa > xb || ya > yb) return;
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  const across = c.width + 80;
  const halfV = across / 2;
  const local = (px: number, py: number) => {
    const dx = x0 + (px + 0.5) / scale - c.x;
    const dy = y0 + (py + 0.5) / scale - c.y;
    return { u: dx * cos + dy * sin, v: -dx * sin + dy * cos };
  };
  const put = (k: number, col: RGB) => {
    data[k] = col[0];
    data[k + 1] = col[1];
    data[k + 2] = col[2];
  };
  const shade = (k: number, f: number) => {
    data[k] *= f;
    data[k + 1] *= f;
    data[k + 2] *= f;
  };
  if (c.kind === "FORD") {
    paintFord(data, w, x0, y0, scale, { xa, xb, ya, yb }, c, length);
    return;
  }
  const seed = hash(Math.round(c.x), Math.round(c.y), 5);
  // O que cada ponto é: 0 nada; 1 tábua; 2 viga da borda; 3 poste; 4 pedra da cabeceira; 5 contorno
  const halfU = c.kind === "BRIDGE" ? length / 2 - 30 : 0;
  const what = (u: number, v: number): number => {
    if (c.kind === "BRIDGE") {
      const au = Math.abs(u);
      const av = Math.abs(v);
      if (au > halfU || av > halfV) return 0;
      if (au > halfU - 1 || av > halfV - 1) return 5;
      if (c.burned) {
        const post = ((Math.floor(v + halfV) % 22) + 22) % 22 < 5 && au > halfU - 7;
        if (post) return 3;
        // Toco de tábua carbonizada perto das margens
        if (av > halfV - 26 && hash(Math.floor(v / 7), Math.floor(u / 9), seed) % 3 === 0) return 1;
        return 0;
      }
      if (av > halfV - 14) return 4;
      if (au > halfU - 6) return ((Math.floor(v + halfV) % 22) + 22) % 22 < 4 ? 3 : 2;
      return 1;
    }
    // Balsa: cais nas duas margens, a corda e a balsa no meio
    const au = Math.abs(u);
    const dock = au <= 40 && Math.abs(Math.abs(v) - halfV) <= 30;
    const raft = au <= 55 && Math.abs(v) <= 30;
    if (dock || raft) {
      const edge = dock ? au > 39 || Math.abs(Math.abs(v) - halfV) > 29 : au > 54 || Math.abs(v) > 29;
      if (edge) return 5;
      const rim = dock ? au > 35 : au > 50 || Math.abs(v) > 25;
      return rim ? 2 : 1;
    }
    if (Math.abs(u) <= 1 && Math.abs(v) <= halfV) return 6;
    return 0;
  };
  for (let py = ya; py <= yb; py++) {
    for (let px = xa; px <= xb; px++) {
      const { u, v } = local(px, py);
      const kind = what(u, v);
      const k = (py * w + px) * 4;
      if (kind === 0) {
        // Sombra da ponte (ou do cais, ou da balsa) logo abaixo dela; a corda não faz sombra
        const fall = Math.max(1, Math.round(5 * scale));
        for (let d = 1; d <= fall; d++) {
          const q = local(px, py - d);
          const above = what(q.u, q.v);
          if (above !== 0 && above !== 6) {
            shade(k, d <= fall * 0.4 ? 0.55 : 0.75);
            break;
          }
        }
        continue;
      }
      if (kind === 5) {
        put(k, c.burned ? CHAR : EDGE);
        continue;
      }
      if (kind === 6) {
        put(k, ROPE);
        continue;
      }
      if (c.burned) {
        put(k, kind === 3 ? CHAR : (hash(px + x0, py + y0, seed) & 3) === 0 ? CHAR_LIGHT : CHAR);
        continue;
      }
      if (kind === 4) {
        // Cabeceira de pedra: blocos com argamassa, desencontrados
        const row = Math.floor((v + halfV + 1000) / 6);
        const col = Math.floor((u + 1000 + (row % 2) * 6) / 12);
        const mu = ((u + 1000 + (row % 2) * 6) % 12) < 1;
        const mv = ((v + halfV + 1000) % 6) < 1;
        put(k, mu || mv ? MORTAR : (hash(col, row, seed) & 3) === 0 ? STONE_LIGHT : STONE);
        continue;
      }
      if (kind === 3) {
        put(k, WOOD_LIGHT);
        continue;
      }
      if (kind === 2) {
        put(k, WOOD_DARK);
        continue;
      }
      // Tábuas: de margem a margem, cada uma com o seu tom, fresta escura entre elas e veios
      const plank = Math.floor((v + halfV + 1000) / 7);
      const inPlank = (v + halfV + 1000) % 7;
      if (inPlank < 1) {
        put(k, WOOD_GAP);
        continue;
      }
      const tone = 0.92 + (hash(plank, 0, seed) % 17) / 100;
      const grain = (hash(Math.floor(u / 3), plank, seed) & 7) === 0 ? 0.86 : 1;
      const light = inPlank < 2 ? 1.08 : 1;
      data[k] = WOOD[0] * tone * grain * light;
      data[k + 1] = WOOD[1] * tone * grain * light;
      data[k + 2] = WOOD[2] * tone * grain * light;
    }
  }
}

/** Vau: pedras de pisar no raso, com luz em cima, sombra embaixo e a água batendo nelas. */
function paintFord(data: Uint8ClampedArray, w: number, x0: number, y0: number, scale: number, box: { xa: number; xb: number; ya: number; yb: number }, c: CrossingArt, length: number): void {
  const { xa, xb, ya, yb } = box;
  const rnd = seeded(hash(Math.round(c.x), Math.round(c.y), 9));
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  const stones: { x: number; y: number; r: number; tone: number }[] = [];
  const n = 16 + Math.floor(c.width / 12);
  // Só dentro da mancha rasa (a elipse em volta da travessia), e no rio
  for (let s = 0; s < n * 3 && stones.length < n; s++) {
    const u = (rnd() - 0.5) * (length - 30);
    const v = (rnd() - 0.5) * (c.width + 10);
    if ((u / (length / 2)) ** 2 + (v / ((c.width + 80) / 2)) ** 2 > 0.7) continue;
    const x = c.x + u * cos - v * sin;
    const y = c.y + u * sin + v * cos;
    if (!c.inRiver(x, y)) continue;
    stones.push({ x, y, r: 3 + Math.floor(rnd() * 5), tone: rnd() });
  }
  // De trás para a frente: a pedra de baixo cobre a de cima
  stones.sort((a, b) => a.y - b.y);
  for (const s of stones) {
    const rx = Math.max(1, Math.round(s.r * scale));
    const ry = Math.max(1, Math.round(rx * 0.7));
    const sx = Math.round((s.x - x0) * scale);
    const sy = Math.round((s.y - y0) * scale);
    for (let dy = -ry - 1; dy <= ry + 1; dy++) {
      for (let dx = -rx - 1; dx <= rx + 1; dx++) {
        const px = sx + dx;
        const py = sy + dy;
        if (px < xa || px > xb || py < ya || py > yb) continue;
        const e = (dx * dx) / ((rx + 0.3) * (rx + 0.3)) + (dy * dy) / ((ry + 0.3) * (ry + 0.3));
        const k = (py * w + px) * 4;
        if (e > 1) {
          // Espuma em volta, mais embaixo (onde a água bate)
          const ring = (dx * dx) / ((rx + 1.3) * (rx + 1.3)) + (dy * dy) / ((ry + 1.3) * (ry + 1.3));
          if (ring <= 1 && dy >= 0) {
            data[k] += (214 - data[k]) * 0.6;
            data[k + 1] += (234 - data[k + 1]) * 0.6;
            data[k + 2] += (238 - data[k + 2]) * 0.6;
          }
          continue;
        }
        const edge = e > 0.62;
        const base = 104 + s.tone * 26;
        const f = dy < -ry * 0.3 ? 1.22 : dy > ry * 0.4 ? 0.72 : 1;
        const v = edge && dy > 0 ? base * 0.55 : base * f;
        data[k] = v;
        data[k + 1] = v * 0.98;
        data[k + 2] = v * 0.92;
      }
    }
  }
}

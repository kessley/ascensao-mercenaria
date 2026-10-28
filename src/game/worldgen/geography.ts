import { GEO, REGION_HEIGHT, REGION_WIDTH } from "../../utils/constants";
import type { Point } from "../../utils/math";
import type { Biome, GeoDef, RiverDef, RiverKind } from "../data/world";
import { fbm, makeNoise } from "./noise";
import type { Rng } from "./rng";
import * as names from "./names";

/**
 * Geografia do continente (Marco 11), em células de GEO.CELL px:
 * 1. Relevo: ruído fractal + máscara de continente (deformada) + cristas de montanha;
 *    a borda do mapa é sempre mar.
 * 2. Clima: temperatura pela latitude (norte frio) e altitude; umidade trazida pelo vento
 *    de oeste, que perde chuva ao subir montanhas (sombra de chuva a leste delas).
 * 3. Biomas pela altitude, temperatura e umidade.
 * 4. Águas: "priority flood" a partir do mar enche as depressões (fundas viram lagos) e dá a
 *    cada célula o caminho até o mar; a chuva acumulada nesse caminho faz os rios
 *    (riacho, rio, rio grande), traçados das nascentes até a foz com meandros.
 */
export function generateGeography(rng: Rng, regionCols: number, regionRows: number): GeoDef {
  const cell = GEO.CELL;
  const cols = Math.round((regionCols * REGION_WIDTH) / cell);
  const rows = Math.round((regionRows * REGION_HEIGHT) / cell);
  const n = cols * rows;
  const seed = () => rng.int(1, 2 ** 30);
  const nElev = makeNoise(seed());
  const nWarp = makeNoise(seed());
  const nRidge = makeNoise(seed());
  const nTemp = makeNoise(seed());
  const nMoist = makeNoise(seed());
  const aspect = cols / rows;

  // 1. Relevo
  const elevation = new Array<number>(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = (c + 0.5) / cols;
      const ny = (r + 0.5) / rows;
      const wx = (fbm(nWarp, nx * 3 * aspect, ny * 3, 3) - 0.5) * 0.5;
      const wy = (fbm(nWarp, nx * 3 * aspect + 40, ny * 3 + 40, 3) - 0.5) * 0.5;
      const dx = (nx - 0.5 + wx * 0.45) / 0.5;
      const dy = (ny - 0.5 + wy * 0.45) / 0.5;
      const mask = 1 - smoothstep(0.42, 1.02, Math.sqrt(dx * dx + dy * dy));
      const base = fbm(nElev, nx * 4 * aspect, ny * 4, 5);
      const ridge = 1 - Math.abs(2 * fbm(nRidge, nx * 3 * aspect, ny * 3, 4) - 1);
      let e = mask * 0.6 + base * 0.4 + ridge ** 4 * 0.38 * mask;
      const edge = Math.min(c, r, cols - 1 - c, rows - 1 - r);
      if (edge < 3) e *= edge * 0.3;
      elevation[r * cols + c] = e;
    }
  }
  normalize(elevation);
  const seaLevel = quantile(elevation, GEO.OCEAN_SHARE);
  const landElev = elevation.filter((e) => e >= seaLevel);
  const mountainLevel = quantile(landElev, 1 - GEO.MOUNTAIN_SHARE);
  const hillLevel = quantile(landElev, 1 - GEO.MOUNTAIN_SHARE - GEO.HILL_SHARE);
  const isSea = (i: number) => elevation[i] < seaLevel;

  // 2. Clima
  const temperature = new Array<number>(n);
  const moisture = new Array<number>(n);
  for (let r = 0; r < rows; r++) {
    let carry = 1;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const nx = (c + 0.5) / cols;
      const ny = (r + 0.5) / rows;
      const altitude = Math.max(0, elevation[i] - seaLevel) / (1 - seaLevel);
      temperature[i] = clamp01(0.1 + 0.85 * ny + (fbm(nTemp, nx * 3, ny * 3, 3) - 0.5) * 0.18 - altitude * 0.45);
      if (isSea(i)) carry = Math.min(1, carry + 0.25);
      else {
        const rise = c > 0 ? Math.max(0, elevation[i] - elevation[i - 1]) : 0;
        carry = Math.max(0.05, carry * (0.975 - rise * 2.2));
      }
      moisture[i] = clamp01(0.45 * fbm(nMoist, nx * 3.5 * aspect, ny * 3.5, 4) + 0.6 * carry - 0.08);
    }
  }

  // 3. Biomas
  const biome = new Array<Biome>(n);
  for (let i = 0; i < n; i++) {
    const e = elevation[i];
    const t = temperature[i];
    const m = moisture[i];
    if (e < seaLevel) biome[i] = "OCEAN";
    else if (e >= mountainLevel) biome[i] = "MOUNTAINS";
    else if (t < 0.2) biome[i] = "TUNDRA";
    else if (e >= hillLevel) biome[i] = "HILLS";
    else if (m > 0.68 && e < seaLevel + (hillLevel - seaLevel) * 0.25) biome[i] = "MARSH";
    else if (t > 0.68 && m < 0.32) biome[i] = "DESERT";
    else if (m < 0.4) biome[i] = "STEPPE";
    else if (m > 0.64 && t > 0.35) biome[i] = "DEEP_FOREST";
    else if (m > 0.52) biome[i] = "FOREST";
    else biome[i] = "PLAINS";
  }
  for (let i = 0; i < n; i++) {
    if (isSea(i) || biome[i] === "MOUNTAINS" || elevation[i] > seaLevel + (hillLevel - seaLevel) * 0.12) continue;
    if (neighbors4(i, cols, rows).some(isSea)) biome[i] = "COAST";
  }

  // 4. Águas: enchimento das depressões a partir do mar, caminho de cada célula até ele
  const filled = elevation.slice();
  const parent = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  const order: number[] = [];
  const heap = new MinHeap();
  for (let i = 0; i < n; i++) {
    if (!isSea(i)) continue;
    visited[i] = 1;
    heap.push(i, elevation[i]);
  }
  while (heap.size > 0) {
    const u = heap.pop();
    order.push(u);
    for (const v of neighbors8(u, cols, rows)) {
      if (visited[v]) continue;
      visited[v] = 1;
      filled[v] = Math.max(elevation[v], filled[u] + 1e-5);
      parent[v] = u;
      heap.push(v, filled[v]);
    }
  }
  // Lagos: depressões fundas o bastante (no máximo ~2% da terra)
  const lake = new Array<number>(n).fill(0);
  const landCount = landElev.length;
  let depth = 0.012;
  for (let tries = 0; tries < 6; tries++) {
    let count = 0;
    for (let i = 0; i < n; i++) if (!isSea(i) && filled[i] - elevation[i] > depth) count++;
    if (count <= landCount * 0.02) break;
    depth *= 1.6;
  }
  for (let i = 0; i < n; i++) if (!isSea(i) && filled[i] - elevation[i] > depth && biome[i] !== "MOUNTAINS") lake[i] = 1;

  // Chuva acumulada rio abaixo
  const acc = new Float64Array(n);
  for (let i = 0; i < n; i++) acc[i] = isSea(i) ? 0 : moisture[i] * (0.6 + 0.8 * Math.max(0, elevation[i] - seaLevel));
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    if (!isSea(i) && parent[i] >= 0) acc[parent[i]] += acc[i];
  }
  const landAcc = Array.from(acc).filter((_, i) => !isSea(i));
  const t1 = quantile(landAcc, 0.9);
  const t2 = quantile(landAcc, 0.965);
  const t3 = quantile(landAcc, 0.992);
  const kindOf = (a: number): RiverKind => (a >= t3 ? "GREAT" : a >= t2 ? "RIVER" : "STREAM");
  const widthOf = (a: number): number => {
    const W = GEO.RIVER_WIDTH;
    if (a >= t3) return W.GREAT + Math.min(40, ((a - t3) / t3) * 30);
    if (a >= t2) return W.RIVER + ((a - t2) / (t3 - t2)) * 30;
    return W.STREAM + ((a - t1) / (t2 - t1)) * 12;
  };

  const isRiverCell = (i: number) => !isSea(i) && acc[i] >= t1;
  const hasUpstream = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (isRiverCell(i) && parent[i] >= 0) hasUpstream[parent[i]] = 1;
  const sources: { i: number; length: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!isRiverCell(i) || hasUpstream[i]) continue;
    let length = 0;
    for (let v = i; v >= 0 && !isSea(v); v = parent[v]) length++;
    sources.push({ i, length });
  }
  // Os mais longos primeiro: o tronco principal leva o nome; os afluentes terminam nele
  sources.sort((a, b) => b.length - a.length);
  const traced = new Uint8Array(n);
  const center = (i: number): Point => ({ x: ((i % cols) + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
  const rivers: RiverDef[] = [];
  const usedNames = new Set<string>();
  for (const src of sources) {
    const cells: number[] = [];
    let v = src.i;
    while (v >= 0 && !isSea(v) && !traced[v]) {
      cells.push(v);
      traced[v] = 1;
      v = parent[v];
    }
    if (cells.length < 3) continue;
    const pts: Point[] = cells.map((i, k) => {
      const p = center(i);
      if (k === 0) return p;
      return { x: p.x + rng.range(-0.28, 0.28) * cell, y: p.y + rng.range(-0.28, 0.28) * cell };
    });
    const widths = cells.map((i) => widthOf(acc[i]));
    if (v >= 0) {
      // Foz (no mar) ou confluência (no rio já traçado)
      pts.push(center(v));
      widths.push(isSea(v) ? widths[widths.length - 1] : widthOf(acc[v]));
    }
    const kind = cells.reduce<RiverKind>((k, i) => (rank(kindOf(acc[i])) > rank(k) ? kindOf(acc[i]) : k), "STREAM");
    const meander = subdivide(rng, subdivide(rng, { points: pts, widths }));
    rivers.push({
      id: `R${rivers.length}`,
      name: riverName(rng, kind, usedNames),
      kind,
      points: meander.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      widths: meander.widths.map((w) => Math.round(w)),
    });
  }

  return {
    cell,
    cols,
    rows,
    seaLevel,
    mountainLevel,
    hillLevel,
    detailSeed: seed(),
    elevation: elevation.map(round3),
    temperature: temperature.map(round3),
    moisture: moisture.map(round3),
    biome,
    lake,
    rivers,
    crossings: [],
    passes: [],
  };
}

// --- Auxiliares ---

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rank = (k: RiverKind) => (k === "GREAT" ? 2 : k === "RIVER" ? 1 : 0);

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function normalize(arr: number[]): void {
  let min = Infinity;
  let max = -Infinity;
  for (const v of arr) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] - min) / (max - min || 1);
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(q * sorted.length)))];
}

function neighbors4(i: number, cols: number, rows: number): number[] {
  const c = i % cols;
  const r = Math.floor(i / cols);
  const out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  return out;
}

function neighbors8(i: number, cols: number, rows: number): number[] {
  const c = i % cols;
  const r = Math.floor(i / cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const cc = c + dc;
      const rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) out.push(rr * cols + cc);
    }
  }
  return out;
}

/** Meandros: um ponto novo no meio de cada trecho, empurrado para o lado. */
function subdivide(rng: Rng, line: { points: Point[]; widths: number[] }): { points: Point[]; widths: number[] } {
  const points: Point[] = [line.points[0]];
  const widths: number[] = [line.widths[0]];
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1];
    const b = line.points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const off = rng.range(-0.2, 0.2) * len;
    points.push({ x: (a.x + b.x) / 2 - ((b.y - a.y) / len) * off, y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * off }, b);
    widths.push((line.widths[i - 1] + line.widths[i]) / 2, line.widths[i]);
  }
  return { points, widths };
}

function riverName(rng: Rng, kind: RiverKind, used: Set<string>): string {
  const form = kind === "STREAM" ? "Ribeiro" : "Rio";
  for (let i = 0; i < 20; i++) {
    const name = `${form} ${names.placeName(rng)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  return `${form} ${names.placeName(rng)} ${used.size}`;
}

/** Fila de prioridade mínima (índice + chave). */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

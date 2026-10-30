import type { Biome, CrossingDef, GeoDef, RiverDef } from "../data/world";
import { GEO, type TerrainType } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { fbm, makeNoise, type Noise2D } from "./noise";

/** Trecho de rio indexado (para achar a água perto de um ponto). */
interface Segment {
  river: RiverDef;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  wa: number;
  wb: number;
}

const BUCKET = 800;

/** Estação na água (Marco 13): gelo no inverno (abaixo da temperatura) e vaus fundos na cheia. */
export interface GeoSeason {
  freezeBelow: number | null;
  flood: boolean;
}

/**
 * Consultas ao relevo e às águas do continente (Marco 11), a partir dos dados gerados
 * (GeoDef). O relevo fino é a interpolação das células com um pouco de ruído, para a costa
 * e o pé das montanhas não saírem quadrados; rios são linhas com largura.
 * Usado pelo gerador (onde cabe um povoado?), pelo terreno do jogo e pelo mapa.
 */
export class GeoMap {
  private readonly detail: Noise2D;
  private readonly bucketCols: number;
  private readonly bucketRows: number;
  private readonly buckets: Segment[][];
  readonly width: number;
  readonly height: number;

  constructor(readonly def: GeoDef) {
    this.detail = makeNoise(def.detailSeed);
    this.width = def.cols * def.cell;
    this.height = def.rows * def.cell;
    this.bucketCols = Math.ceil(this.width / BUCKET);
    this.bucketRows = Math.ceil(this.height / BUCKET);
    this.buckets = Array.from({ length: this.bucketCols * this.bucketRows }, () => []);
    for (const river of def.rivers) this.indexRiver(river);
  }

  private indexRiver(river: RiverDef): void {
    for (let i = 1; i < river.points.length; i++) {
      const a = river.points[i - 1];
      const b = river.points[i];
      const seg: Segment = { river, ax: a.x, ay: a.y, bx: b.x, by: b.y, wa: river.widths[i - 1], wb: river.widths[i] };
      const pad = Math.max(seg.wa, seg.wb) / 2 + 20;
      const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - pad) / BUCKET));
      const c1 = Math.min(this.bucketCols - 1, Math.floor((Math.max(a.x, b.x) + pad) / BUCKET));
      const r0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - pad) / BUCKET));
      const r1 = Math.min(this.bucketRows - 1, Math.floor((Math.max(a.y, b.y) + pad) / BUCKET));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.buckets[r * this.bucketCols + c].push(seg);
    }
  }

  private cellValue(arr: readonly number[], x: number, y: number): number {
    const { cell, cols, rows } = this.def;
    const gx = Math.min(cols - 1.001, Math.max(0, x / cell - 0.5));
    const gy = Math.min(rows - 1.001, Math.max(0, y / cell - 0.5));
    const c = Math.floor(gx);
    const r = Math.floor(gy);
    const fx = gx - c;
    const fy = gy - r;
    const i = r * cols + c;
    const a = arr[i];
    const b = arr[i + 1];
    const d = arr[i + cols];
    const e = arr[i + cols + 1];
    return a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
  }

  /** Altitude (0–1) num ponto, com o detalhe fino da costa. */
  heightAt(x: number, y: number): number {
    return this.cellValue(this.def.elevation, x, y) + (fbm(this.detail, x / 1100, y / 1100, 2) - 0.5) * 0.07;
  }

  cellIndex(x: number, y: number): number {
    const { cell, cols, rows } = this.def;
    const c = Math.max(0, Math.min(cols - 1, Math.floor(x / cell)));
    const r = Math.max(0, Math.min(rows - 1, Math.floor(y / cell)));
    return r * cols + c;
  }

  biomeAt(x: number, y: number): Biome {
    return this.def.biome[this.cellIndex(x, y)];
  }

  temperatureAt(x: number, y: number): number {
    return this.cellValue(this.def.temperature, x, y);
  }

  isSea(x: number, y: number): boolean {
    return this.heightAt(x, y) < this.def.seaLevel;
  }

  isLake(x: number, y: number): boolean {
    return this.cellValue(this.def.lake, x, y) > 0.5;
  }

  /** Rio que passa pelo ponto (dentro da largura), com a largura ali. */
  riverAt(x: number, y: number, margin = 0): { river: RiverDef; width: number } | null {
    const bc = Math.floor(x / BUCKET);
    const br = Math.floor(y / BUCKET);
    if (bc < 0 || br < 0 || bc >= this.bucketCols || br >= this.bucketRows) return null;
    for (const s of this.buckets[br * this.bucketCols + bc]) {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len2));
      const px = s.ax + dx * t - x;
      const py = s.ay + dy * t - y;
      const w = s.wa + (s.wb - s.wa) * t;
      const half = w / 2 + margin;
      if (px * px + py * py <= half * half) return { river: s.river, width: w };
    }
    return null;
  }

  /** Travessia (ponte ou vau) cuja faixa contém o ponto. */
  crossingAt(x: number, y: number): CrossingDef | null {
    for (const c of this.def.crossings) {
      if (c.kind === "FERRY") continue;
      const dx = x - c.x;
      const dy = y - c.y;
      if (dx * dx + dy * dy > 400 * 400) continue;
      const along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const across = -dx * Math.sin(c.angle) + dy * Math.cos(c.angle);
      const halfLen = (c.kind === "BRIDGE" ? GEO.BRIDGE_LENGTH : GEO.FORD_LENGTH) / 2;
      if (Math.abs(along) <= halfLen && Math.abs(across) <= c.width / 2 + 40) return c;
    }
    return null;
  }

  inPass(x: number, y: number): boolean {
    return this.def.passes.some((p) => (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r);
  }

  /**
   * O que a geografia diz do ponto: água funda, raso (vau, riacho), ponte, montanha,
   * colina (passo) ou null (terra comum — o terreno de superfície decide).
   * `burned` = pontes queimadas (viram água).
   */
  geoType(x: number, y: number, burned?: ReadonlySet<string>, season?: GeoSeason): TerrainType | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "WATER";
    const h = this.heightAt(x, y);
    if (h < this.def.seaLevel) return "WATER";
    // Inverno: rios e lagos do frio congelam (atravessa-se em qualquer ponto)
    const frozen = () => season?.freezeBelow != null && this.temperatureAt(x, y) < season.freezeBelow;
    if (this.isLake(x, y)) return frozen() ? "ICE" : "WATER";
    const river = this.riverAt(x, y);
    if (river) {
      const crossing = this.crossingAt(x, y);
      if (crossing?.kind === "BRIDGE") return burned?.has(crossing.id) ? "WATER" : "BRIDGE";
      if (frozen()) return "ICE";
      // Cheia da primavera: os vaus dos rios ficam fundos (os riachos continuam rasos)
      if (river.width <= 50) return "SHALLOW";
      if (crossing?.kind === "FORD") return season?.flood ? "WATER" : "SHALLOW";
      return "WATER";
    }
    if (h > this.def.mountainLevel) return this.inPass(x, y) ? "HILL" : "MOUNTAIN";
    return null;
  }

  /** Terra firme e comum (nem água, nem rio, nem montanha), com folga em volta. */
  isOpenLand(p: Point, clearance = 0): boolean {
    const pts = clearance > 0 ? [p, { x: p.x + clearance, y: p.y }, { x: p.x - clearance, y: p.y }, { x: p.x, y: p.y + clearance }, { x: p.x, y: p.y - clearance }] : [p];
    for (const q of pts) {
      if (q.x < 200 || q.y < 200 || q.x > this.width - 200 || q.y > this.height - 200) return false;
      const h = this.heightAt(q.x, q.y);
      if (h < this.def.seaLevel + 0.01 || h > this.def.mountainLevel - 0.01 || this.isLake(q.x, q.y)) return false;
    }
    return !this.riverAt(p.x, p.y, clearance);
  }

  /** Distância até o rio mais próximo (até `max`; além disso devolve `max`). */
  distanceToRiver(p: Point, max: number): number {
    // Procura nos baldes em volta (um rio a mais de um balde de distância também conta)
    const c0 = Math.max(0, Math.floor((p.x - max) / BUCKET));
    const c1 = Math.min(this.bucketCols - 1, Math.floor((p.x + max) / BUCKET));
    const r0 = Math.max(0, Math.floor((p.y - max) / BUCKET));
    const r1 = Math.min(this.bucketRows - 1, Math.floor((p.y + max) / BUCKET));
    let best = max;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (const s of this.buckets[r * this.bucketCols + c]) {
          const dx = s.bx - s.ax;
          const dy = s.by - s.ay;
          const t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
          const d = Math.hypot(s.ax + dx * t - p.x, s.ay + dy * t - p.y) - (s.wa + (s.wb - s.wa) * t) / 2;
          if (d < best) best = Math.max(0, d);
        }
      }
    }
    return Math.ceil(best / 100) * 100;
  }

  /** Há mar a menos de `r` px? (amostra um anel) */
  nearSea(p: Point, r: number): boolean {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (this.isSea(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)) return true;
    }
    return false;
  }
}

const cache = new WeakMap<GeoDef, GeoMap>();

/** GeoMap de um GeoDef (um por mundo). */
export function geoOf(def: GeoDef): GeoMap {
  let g = cache.get(def);
  if (!g) {
    g = new GeoMap(def);
    cache.set(def, g);
  }
  return g;
}

import Phaser from "phaser";
import { GEO, TERRAIN, WORLD, WORLD_HEIGHT, WORLD_WIDTH, type TerrainType } from "../../utils/constants";
import type { Biome, SiteTheme, WorldDef } from "../data/world";
import type { CalamityKind } from "../sim/realm";
import type { GeoMap, GeoSeason } from "../worldgen/geoMap";
import type { Point } from "../../utils/math";
import { townSolids, wellOf, WELL_RADIUS, type Rect, type TownLayout } from "./townLayout";
import { pixelGround } from "../art/ground";
import { CAMPFIRE, CAMP_SITES, PALISADE } from "../data/campLayout";

/** Zona de terreno de superfície (elíptica). Zonas posteriores na lista têm prioridade. */
export interface TerrainZone {
  type: "HILL" | "MUD" | "SWAMP" | "FOREST";
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const ZONE_COLORS: Record<TerrainZone["type"], { base: string; detail: string }> = {
  HILL: { base: "#6f8f3a", detail: "#86a64a" },
  MUD: { base: "#6b4f2e", detail: "#57401f" },
  SWAMP: { base: "#3f5240", detail: "#2b4a4a" },
  FOREST: { base: "#22501c", detail: "#173d12" },
};

/** Matas e colinas no outono. */
const AUTUMN_FOREST = { base: "#5a4a1c", detail: "#8a4a1a" };
const AUTUMN_HILL = { base: "#8a8a3a", detail: "#9a8a4a" };

/** Cor do chão de cada bioma (RGB). */
export const BIOME_COLOR: Record<Biome, [number, number, number]> = {
  OCEAN: [30, 70, 110],
  COAST: [140, 150, 96],
  PLAINS: [58, 125, 44],
  FOREST: [48, 112, 40],
  DEEP_FOREST: [36, 92, 36],
  HILLS: [98, 126, 60],
  MOUNTAINS: [112, 108, 100],
  MARSH: [66, 98, 72],
  STEPPE: [136, 148, 78],
  DESERT: [204, 180, 122],
  TUNDRA: [138, 150, 138],
};

/** Estado da estação no terreno e no desenho do chão. */
export interface SeasonState extends GeoSeason {
  /** Neve no chão abaixo desta temperatura (só no inverno). */
  snowBelow: number | null;
  autumn: boolean;
}

/** Chão do acampamento do bando montado (o canto do layout no mundo; a paliçada reforçada tem aterro). */
export interface CampGround {
  origin: Point;
  reinforced: boolean;
}

/** Chão de um covil de calamidade (pintado enquanto o líder vive). */
export interface LairGround {
  id: string;
  kind: CalamityKind;
  at: Point;
}

/** Fosso elíptico em volta da paliçada, com a passagem do portão. */
export interface Ditch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  gateAngle: number;
  gateHalf: number;
}

/** Grade do índice espacial das zonas: cada célula guarda as zonas que a tocam. */
const BUCKET = 800;
/** Grade do índice das muralhas e casas dos povoados. */
const TOWN_BUCKET = 400;

/**
 * Terreno do mundo: o que há em cada ponto. Primeiro as muralhas e construções dos povoados
 * (Marco 12); depois a geografia (mar, lago, rio, vau, ponte, montanha, passo); depois as
 * zonas de superfície (colina, lama, pântano, floresta), consultadas por um índice em grade;
 * o resto é campo.
 */
export class TerrainMap {
  private readonly cols: number;
  private readonly rows: number;
  /** Índices das zonas por célula, em ordem crescente (a última que contém o ponto vence). */
  private readonly buckets: number[][];
  private burned: ReadonlySet<string> = new Set();
  /** Muralhas, torres e casas por célula de TOWN_BUCKET. */
  private townBuckets = new Map<number, { rect: Rect; type: "WALL" | "BUILDING" }[]>();

  constructor(
    readonly zones: readonly TerrainZone[],
    readonly geo: GeoMap | null = null,
    width = WORLD_WIDTH,
    height = WORLD_HEIGHT,
  ) {
    this.cols = Math.ceil(width / BUCKET);
    this.rows = Math.ceil(height / BUCKET);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
    zones.forEach((z, i) => {
      const c0 = Math.max(0, Math.floor((z.x - z.rx) / BUCKET));
      const c1 = Math.min(this.cols - 1, Math.floor((z.x + z.rx) / BUCKET));
      const r0 = Math.max(0, Math.floor((z.y - z.ry) / BUCKET));
      const r1 = Math.min(this.rows - 1, Math.floor((z.y + z.ry) / BUCKET));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.buckets[r * this.cols + c].push(i);
    });
  }

  /** Pontes queimadas viram água (bloqueiam a travessia). */
  setBurned(ids: readonly string[]): void {
    this.burned = new Set(ids);
  }

  isBurned(id: string): boolean {
    return this.burned.has(id);
  }

  /** Povoados atuais (muralhas e casas viram obstáculo). Refeito quando um povoado nasce, cai ou é reconstruído. */
  setTowns(layouts: readonly TownLayout[]): void {
    this.towns = layouts;
    this.indexSolids();
  }

  /** Plantas dos povoados (o chão deles é pintado junto com o resto do chão). */
  get townLayouts(): readonly TownLayout[] {
    return this.towns;
  }

  /** Outros sólidos do mundo (paliçada, barracas e estruturas do acampamento do bando). */
  setExtraSolids(solids: readonly { rect: Rect; type: "WALL" | "BUILDING" }[]): void {
    this.extraSolids = solids;
    this.indexSolids();
  }

  /** Construções dos ermos (G3): barracas e choupanas dos locais de contrato, muros caídos, covis. */
  setWildSolids(solids: readonly Rect[]): void {
    this.wildSolids = solids.map((rect) => ({ rect, type: "BUILDING" as const }));
    this.indexSolids();
  }

  private towns: readonly TownLayout[] = [];
  private extraSolids: readonly { rect: Rect; type: "WALL" | "BUILDING" }[] = [];
  private wildSolids: readonly { rect: Rect; type: "WALL" | "BUILDING" }[] = [];
  /** Cerco (Marco 16): portões fechados (sólidos) e escadas (passagens na muralha). */
  private siegeSolids: readonly { rect: Rect; type: "WALL" | "BUILDING" }[] = [];
  private breaches: readonly Rect[] = [];

  /** Está numa escada apoiada na muralha? */
  onLadder(x: number, y: number): boolean {
    return this.breaches.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  setSiegeWorks(solids: readonly Rect[], breaches: readonly Rect[]): void {
    this.siegeSolids = solids.map((rect) => ({ rect, type: "WALL" as const }));
    this.breaches = breaches;
    this.indexSolids();
  }

  private indexSolids(): void {
    const buckets = new Map<number, { rect: Rect; type: "WALL" | "BUILDING" }[]>();
    const stride = 100000;
    for (const group of [...this.towns.map((l) => townSolids(l)), this.extraSolids, this.wildSolids, this.siegeSolids]) {
      for (const solid of group) {
        const r = solid.rect;
        for (let by = Math.floor(r.y / TOWN_BUCKET); by <= Math.floor((r.y + r.h) / TOWN_BUCKET); by++) {
          for (let bx = Math.floor(r.x / TOWN_BUCKET); bx <= Math.floor((r.x + r.w) / TOWN_BUCKET); bx++) {
            const key = by * stride + bx;
            const list = buckets.get(key) ?? [];
            list.push(solid);
            buckets.set(key, list);
          }
        }
      }
    }
    this.townBuckets = buckets;
  }

  /** Estação (Marco 13): gelo, cheia, neve e as cores do outono. */
  season: SeasonState = { freezeBelow: null, flood: false, snowBelow: null, autumn: false };
  /** Fosso do acampamento: anel de lama em volta da paliçada (o portão fica firme). */
  private ditch: Ditch | null = null;

  setSeason(season: SeasonState): void {
    this.season = season;
  }

  setDitch(ditch: Ditch | null): void {
    this.ditch = ditch;
  }

  /** Terra batida e trilhas do acampamento (pintadas com o chão; nada quando ele está levantado). */
  campGround: CampGround | null = null;
  /** Covis das calamidades vivas (o chão morto do necromante, a terra pisada dos orcs). */
  lairGrounds: readonly LairGround[] = [];

  /** Está no anel do fosso? */
  get ditchShape(): Ditch | null {
    return this.ditch;
  }

  inDitch(x: number, y: number): boolean {
    const d = this.ditch;
    if (!d) return false;
    const nx = (x - d.cx) / d.rx;
    const ny = (y - d.cy) / d.ry;
    const r = Math.hypot(nx, ny);
    if (r < 1.04 || r > 1.16) return false;
    const a = Math.atan2(ny, nx);
    const off = Math.abs(Math.atan2(Math.sin(a - d.gateAngle), Math.cos(a - d.gateAngle)));
    return off > d.gateHalf + 0.06;
  }

  typeAt(x: number, y: number): TerrainType {
    const solids = this.townBuckets.get(Math.floor(y / TOWN_BUCKET) * 100000 + Math.floor(x / TOWN_BUCKET));
    if (solids) {
      for (const { rect: r, type } of solids) {
        if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
        if (type === "WALL" && this.breaches.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) continue;
        return type;
      }
    }
    if (this.ditch && this.inDitch(x, y)) return "MUD";
    const g = this.geo?.geoType(x, y, this.burned, this.season);
    if (g) return g;
    const col = Math.floor(x / BUCKET);
    const row = Math.floor(y / BUCKET);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return "GRASS";
    const list = this.buckets[row * this.cols + col];
    for (let i = list.length - 1; i >= 0; i--) {
      const z = this.zones[list[i]];
      const dx = (x - z.x) / z.rx;
      const dy = (y - z.y) / z.ry;
      if (dx * dx + dy * dy <= 1) return z.type;
    }
    return "GRASS";
  }

  /** Ninguém passa (água funda, montanha). */
  isBlocked(x: number, y: number): boolean {
    return !!TERRAIN[this.typeAt(x, y)].blocked;
  }
}

interface Chunk {
  image: Phaser.GameObjects.Image;
  key: string;
  bounds: Phaser.Geom.Rectangle;
}

/** Resolução da textura de cada pedaço (px de textura por lado). */
const TEX = 512;
/**
 * Chão em pixel art (G2): de perto, pedaços menores pintados em 1 px de textura por px de
 * mundo, por cima do pedaço comum. Quantos ficam guardados e quanto tempo por quadro se gasta
 * pintando os que faltam (o primeiro de cada quadro sai sempre).
 */
const DETAIL = 400;
const DETAIL_MAX = 64;
const DETAIL_BUDGET_MS = 6;
/** Uma amostra de relevo a cada tantos px de mundo (depois ampliada com suavização). */
const SAMPLE = 16;

/**
 * Chão do mundo em pedaços (Marcos 10 e 11): cada pedaço (CHUNK_SIZE) vira uma textura de
 * canvas desenhada quando chega perto da câmera e apagada quando fica longe. A textura tem
 * o chão do bioma com relevo sombreado, mar, lagos, rios, vaus, pontes, estradas, picos e
 * as zonas de superfície. Tudo determinístico (o mesmo pedaço sai sempre igual).
 * Pedaços na tela carregam na hora; os da margem, alguns por quadro.
 */
export class TerrainStreamer {
  private readonly size = WORLD.CHUNK_SIZE;
  private readonly cols = Math.ceil(WORLD_WIDTH / WORLD.CHUNK_SIZE);
  private readonly rows = Math.ceil(WORLD_HEIGHT / WORLD.CHUNK_SIZE);
  /** Zonas por pedaço (todas as que tocam o pedaço), com o índice original para a semente. */
  private readonly zonesByChunk = new Map<number, number[]>();
  private readonly loaded = new Map<number, Chunk>();
  private readonly view = new Phaser.Geom.Rectangle();
  private readonly prefix = `chao-${Math.random().toString(36).slice(2, 8)}`;
  private readonly detailCols = Math.ceil(WORLD_WIDTH / DETAIL);
  private readonly detailRows = Math.ceil(WORLD_HEIGHT / DETAIL);
  private readonly detail = new Map<number, Chunk & { used: number }>();
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly terrain: TerrainMap,
    private readonly world: WorldDef,
  ) {
    terrain.zones.forEach((z, i) => {
      const c0 = Math.max(0, Math.floor((z.x - z.rx) / this.size));
      const c1 = Math.min(this.cols - 1, Math.floor((z.x + z.rx) / this.size));
      const r0 = Math.max(0, Math.floor((z.y - z.ry) / this.size));
      const r1 = Math.min(this.rows - 1, Math.floor((z.y + z.ry) / this.size));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const list = this.zonesByChunk.get(r * this.cols + c) ?? [];
          list.push(i);
          this.zonesByChunk.set(r * this.cols + c, list);
        }
      }
    });
  }

  /** Quantos pedaços estão desenhados agora (para testes de desempenho). */
  get loadedCount(): number {
    return this.loaded.size;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const w = camera.worldView;
    const s = this.size;
    const vc0 = Math.max(0, Math.floor(w.x / s));
    const vc1 = Math.min(this.cols - 1, Math.floor(w.right / s));
    const vr0 = Math.max(0, Math.floor(w.y / s));
    const vr1 = Math.min(this.rows - 1, Math.floor(w.bottom / s));
    // Na tela: carrega já; na margem (1 pedaço): até 2 por quadro
    for (let r = vr0; r <= vr1; r++) for (let c = vc0; c <= vc1; c++) if (!this.loaded.has(r * this.cols + c)) this.load(c, r);
    let budget = 2;
    for (let r = Math.max(0, vr0 - 1); r <= Math.min(this.rows - 1, vr1 + 1) && budget > 0; r++) {
      for (let c = Math.max(0, vc0 - 1); c <= Math.min(this.cols - 1, vc1 + 1) && budget > 0; c++) {
        if (this.loaded.has(r * this.cols + c)) continue;
        this.load(c, r);
        budget--;
      }
    }
    // Longe (além de 2 pedaços): apaga
    for (const [index, chunk] of this.loaded) {
      const c = index % this.cols;
      const r = Math.floor(index / this.cols);
      if (c < vc0 - 2 || c > vc1 + 2 || r < vr0 - 2 || r > vr1 + 2) this.unload(index, chunk);
    }
    const m = 200;
    this.view.setTo(w.x - m, w.y - m, w.width + m * 2, w.height + m * 2);
    for (const chunk of this.loaded.values()) chunk.image.setVisible(Phaser.Geom.Rectangle.Overlaps(this.view, chunk.bounds));
    this.updateDetail(camera);
  }

  /** Quantos pedaços em pixel art estão guardados agora (para testes). */
  get detailCount(): number {
    return this.detail.size;
  }

  /** De perto (zoom de 100% ou mais), o chão em pixel art por cima; de longe, só o comum. */
  private updateDetail(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.frame++;
    if (camera.zoom < 1) {
      for (const d of this.detail.values()) d.image.setVisible(false);
      return;
    }
    const w = camera.worldView;
    const s = DETAIL;
    const c0 = Math.max(0, Math.floor(w.x / s));
    const c1 = Math.min(this.detailCols - 1, Math.floor(w.right / s));
    const r0 = Math.max(0, Math.floor(w.y / s));
    const r1 = Math.min(this.detailRows - 1, Math.floor(w.bottom / s));
    const t0 = performance.now();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const index = r * this.detailCols + c;
        let d = this.detail.get(index);
        if (!d) {
          if (performance.now() - t0 > DETAIL_BUDGET_MS) continue;
          d = this.paintDetail(c, r) ?? undefined;
          if (!d) continue;
        }
        d.used = this.frame;
      }
    }
    for (const d of this.detail.values()) d.image.setVisible(d.used === this.frame);
    // Guardados demais: vão embora os que saíram da tela há mais tempo
    if (this.detail.size > DETAIL_MAX) {
      const old = [...this.detail].filter(([, d]) => d.used !== this.frame).sort((a, b) => a[1].used - b[1].used);
      for (const [index, d] of old.slice(0, this.detail.size - DETAIL_MAX)) this.dropDetail(index, d);
    }
  }

  private paintDetail(c: number, r: number): (Chunk & { used: number }) | null {
    const s = DETAIL;
    const x0 = c * s;
    const y0 = r * s;
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const chunk = Math.floor(y0 / this.size) * this.cols + Math.floor(x0 / this.size);
    paintGround(ctx, this.world, this.terrain, x0, y0, s, s, this.zonesByChunk.get(chunk) ?? [], true);
    const img = ctx.getImageData(0, 0, s, s);
    const season = this.terrain.season;
    pixelGround(img.data, s, s, x0, y0, season.snowBelow !== null ? 0 : season.autumn ? 0.3 : 1);
    ctx.putImageData(img, 0, 0);
    const key = `${this.prefix}-d-${c}-${r}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = this.scene.add.image(x0, y0, key).setOrigin(0, 0).setDepth(-9.9);
    const d = { image, key, bounds: new Phaser.Geom.Rectangle(x0, y0, s, s), used: this.frame };
    this.detail.set(r * this.detailCols + c, d);
    return d;
  }

  private dropDetail(index: number, d: Chunk): void {
    d.image.destroy();
    if (this.scene.textures.exists(d.key)) this.scene.textures.remove(d.key);
    this.detail.delete(index);
  }

  /** Redesenha tudo (a estação mudou: neve, gelo, cheia, cores do outono). */
  invalidateAll(): void {
    for (const [index, chunk] of this.loaded) this.unload(index, chunk);
    for (const [index, d] of this.detail) this.dropDetail(index, d);
  }

  /** Redesenha os pedaços em volta de um ponto (ponte queimada ou reconstruída). */
  invalidate(p: Point, radius = 400): void {
    for (const [index, chunk] of this.loaded) {
      const b = chunk.bounds;
      if (p.x + radius < b.x || p.x - radius > b.right || p.y + radius < b.y || p.y - radius > b.bottom) continue;
      this.unload(index, chunk);
    }
    for (const [index, d] of this.detail) {
      const b = d.bounds;
      if (p.x + radius < b.x || p.x - radius > b.right || p.y + radius < b.y || p.y - radius > b.bottom) continue;
      this.dropDetail(index, d);
    }
  }

  destroy(): void {
    for (const [index, chunk] of this.loaded) this.unload(index, chunk);
    for (const [index, d] of this.detail) this.dropDetail(index, d);
  }

  private unload(index: number, chunk: Chunk): void {
    chunk.image.destroy();
    if (this.scene.textures.exists(chunk.key)) this.scene.textures.remove(chunk.key);
    this.loaded.delete(index);
  }

  private load(c: number, r: number): void {
    const s = this.size;
    const x0 = c * s;
    const y0 = r * s;
    const canvas = document.createElement("canvas");
    canvas.width = TEX;
    canvas.height = TEX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintGround(ctx, this.world, this.terrain, x0, y0, s, TEX, this.zonesByChunk.get(r * this.cols + c) ?? []);
    const key = `${this.prefix}-${c}-${r}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    // 512 é potência de 2: sem isto o WebGL repete a textura, e o filtro mistura a borda com a do
    // lado oposto (virava uma linha de grama no chão da cidade, na emenda dos pedaços)
    const clamp = Phaser.Textures.WrapMode.CLAMP_TO_EDGE;
    this.scene.textures.addCanvas(key, canvas)?.setWrap(clamp, clamp);
    const image = this.scene.add.image(x0, y0, key).setOrigin(0, 0).setScale(s / TEX).setDepth(-10);
    this.loaded.set(r * this.cols + c, { image, key, bounds: new Phaser.Geom.Rectangle(x0, y0, s, s) });
  }
}

// --- Pintura do chão (canvas 2D) ---

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Cor do chão num ponto: bioma (misturado com os vizinhos), mar, praia, rocha e neve, com sombra do relevo. */
export function groundColor(geo: GeoMap, x: number, y: number, h: number, hx: number, hy: number, out: number[], step = SAMPLE, season?: SeasonState): void {
  const def = geo.def;
  if (h < def.seaLevel) {
    const depth = clamp01((def.seaLevel - h) * 9);
    out[0] = lerp(70, 22, depth);
    out[1] = lerp(140, 58, depth);
    out[2] = lerp(170, 100, depth);
    return;
  }
  if (geo.isLake(x, y)) {
    const ice = season?.freezeBelow != null && geo.temperatureAt(x, y) < season.freezeBelow;
    out[0] = ice ? 196 : 56;
    out[1] = ice ? 220 : 118;
    out[2] = ice ? 234 : 158;
    return;
  }
  // Bioma: mistura das 4 células em volta (transições suaves)
  const { cell, cols, rows } = def;
  const gx = Math.min(cols - 1.001, Math.max(0, x / cell - 0.5));
  const gy = Math.min(rows - 1.001, Math.max(0, y / cell - 0.5));
  const ci = Math.floor(gx);
  const ri = Math.floor(gy);
  const fx = gx - ci;
  const fy = gy - ri;
  const i = ri * cols + ci;
  const pick = (k: number) => BIOME_COLOR[def.biome[k] === "OCEAN" ? "COAST" : def.biome[k]];
  const a = pick(i);
  const b = pick(i + 1);
  const d = pick(i + cols);
  const e = pick(i + cols + 1);
  for (let k = 0; k < 3; k++) out[k] = lerp(lerp(a[k], b[k], fx), lerp(d[k], e[k], fx), fy);
  // Praia na beira do mar; rocha e neve nas montanhas
  const beach = clamp01(1 - (h - def.seaLevel) / 0.012);
  if (beach > 0) for (let k = 0; k < 3; k++) out[k] = lerp(out[k], [214, 196, 142][k], beach);
  const rock = clamp01((h - (def.mountainLevel - 0.03)) / 0.03);
  if (rock > 0) for (let k = 0; k < 3; k++) out[k] = lerp(out[k], [118, 112, 104][k], rock);
  const snow = clamp01((h - (def.mountainLevel + 0.09)) / 0.05);
  if (snow > 0) for (let k = 0; k < 3; k++) out[k] = lerp(out[k], 236, snow);
  // Outono: o verde amarela e avermelha
  if (season?.autumn && out[1] > out[0]) {
    out[0] = lerp(out[0], 168, 0.32);
    out[1] = lerp(out[1], 128, 0.32);
    out[2] = lerp(out[2], 52, 0.32);
  }
  // Relevo sombreado: luz do noroeste
  const shade = 1 + Math.max(-0.35, Math.min(0.35, (-(hx - h) - (hy - h)) * 60 * (SAMPLE / step)));
  for (let k = 0; k < 3; k++) out[k] = Math.min(255, out[k] * shade);
}

function paintGround(
  ctx: CanvasRenderingContext2D,
  world: WorldDef,
  terrain: TerrainMap,
  x0: number,
  y0: number,
  size: number,
  tex: number,
  zones: readonly number[],
  /** Para o chão em pixel art: sem a grade e com estradas de terra cheia (o filtro lê a cor). */
  detail = false,
): void {
  const geo = terrain.geo;
  const scale = tex / size;
  // 1. Chão: amostras de relevo ampliadas com suavização
  if (geo) {
    const n = Math.round(size / SAMPLE);
    const heights = new Float32Array((n + 2) * (n + 2));
    for (let j = 0; j <= n + 1; j++) for (let i = 0; i <= n + 1; i++) heights[j * (n + 2) + i] = geo.heightAt(x0 + i * SAMPLE, y0 + j * SAMPLE);
    // n+1 amostras por lado (das duas bordas): os pedaços vizinhos se encontram sem emenda
    const m = n + 1;
    const img = new ImageData(m, m);
    const color = [0, 0, 0];
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const h = heights[j * (n + 2) + i];
        groundColor(geo, x0 + i * SAMPLE, y0 + j * SAMPLE, h, heights[j * (n + 2) + i + 1], heights[(j + 1) * (n + 2) + i], color, SAMPLE, terrain.season);
        const k = (j * m + i) * 4;
        img.data[k] = color[0];
        img.data[k + 1] = color[1];
        img.data[k + 2] = color[2];
        img.data[k + 3] = 255;
      }
    }
    const small = document.createElement("canvas");
    small.width = m;
    small.height = m;
    small.getContext("2d")?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // Cada amostra no centro do seu pixel ampliado: começa meia amostra antes e passa meia da borda
    const px = scale * SAMPLE;
    ctx.drawImage(small, -px * 0.5, -px * 0.5, px * m, px * m);
  } else {
    ctx.fillStyle = "#3a7d2c";
    ctx.fillRect(0, 0, tex, tex);
  }

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  const inChunk = (minX: number, minY: number, maxX: number, maxY: number, pad: number) =>
    maxX + pad >= x0 && minX - pad <= x0 + size && maxY + pad >= y0 && minY - pad <= y0 + size;

  // 2. Grade discreta (referência de movimento; de perto, a textura do chão faz esse papel)
  if (!detail) {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = x0; x <= x0 + size; x += 100) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + size);
    }
    for (let y = y0; y <= y0 + size; y += 100) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + size, y);
    }
    ctx.stroke();
  }

  // 3. Zonas de superfície (cada uma com a própria semente)
  for (const i of zones) drawZone(ctx, terrain.zones[i], new Phaser.Math.RandomDataGenerator([`zona-${i}`]), terrain.season.autumn);

  // 3b. Neve do inverno por cima do chão e das zonas (onde é frio: norte e montanhas)
  const snowBelow = terrain.season.snowBelow;
  if (geo && snowBelow !== null) {
    const step = 50;
    const m = Math.round(size / step) + 1;
    const img = new ImageData(m, m);
    let any = false;
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const a = clamp01((snowBelow - geo.temperatureAt(x0 + i * step, y0 + j * step)) / 0.05) * 0.72;
        if (a <= 0) continue;
        any = true;
        const k = (j * m + i) * 4;
        img.data[k] = 238;
        img.data[k + 1] = 242;
        img.data[k + 2] = 248;
        img.data[k + 3] = Math.round(a * 255);
      }
    }
    if (any) {
      const small = document.createElement("canvas");
      small.width = m;
      small.height = m;
      small.getContext("2d")?.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, x0 - step / 2, y0 - step / 2, step * m, step * m);
    }
  }

  // 3c. Fosso do acampamento
  const ditch = terrain.ditchShape;
  if (ditch && inChunk(ditch.cx - ditch.rx * 1.2, ditch.cy - ditch.ry * 1.2, ditch.cx + ditch.rx * 1.2, ditch.cy + ditch.ry * 1.2, 0)) {
    ctx.strokeStyle = "rgba(74,52,28,0.9)";
    ctx.lineWidth = Math.min(ditch.rx, ditch.ry) * 0.1;
    ctx.beginPath();
    ctx.ellipse(ditch.cx, ditch.cy, ditch.rx * 1.1, ditch.ry * 1.1, 0, ditch.gateAngle + ditch.gateHalf + 0.1, ditch.gateAngle - ditch.gateHalf - 0.1 + Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(40,70,80,0.5)";
    ctx.lineWidth = Math.min(ditch.rx, ditch.ry) * 0.03;
    ctx.stroke();
  }

  // 4. Picos nas montanhas
  if (geo) {
    const rnd = new Phaser.Math.RandomDataGenerator([`picos-${x0}-${y0}`]);
    for (let y = y0 + 60; y < y0 + size; y += 170) {
      for (let x = x0 + 60; x < x0 + size; x += 170) {
        const px = x + rnd.between(-50, 50);
        const py = y + rnd.between(-50, 50);
        if (geo.heightAt(px, py) <= geo.def.mountainLevel + 0.01 || geo.inPass(px, py)) continue;
        const sz = rnd.between(50, 85);
        ctx.fillStyle = "#5e5850";
        ctx.beginPath();
        ctx.moveTo(px - sz * 0.6, py + sz * 0.4);
        ctx.lineTo(px, py - sz * 0.6);
        ctx.lineTo(px + sz * 0.6, py + sz * 0.4);
        ctx.fill();
        ctx.fillStyle = "#e8e8e8";
        ctx.beginPath();
        ctx.moveTo(px - sz * 0.2, py - sz * 0.27);
        ctx.lineTo(px, py - sz * 0.6);
        ctx.lineTo(px + sz * 0.2, py - sz * 0.27);
        ctx.fill();
      }
    }
  }

  // 5. Estradas
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = detail ? "#85744f" : "rgba(141,123,82,0.6)";
  ctx.lineWidth = 34;
  for (const road of world.roads) {
    const xs = road.map((p) => p.x);
    const ys = road.map((p) => p.y);
    if (!inChunk(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 40)) continue;
    ctx.beginPath();
    road.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  // 5b. Chão dos povoados: lavouras, terra batida, ruas, praça e o pátio da guarnição
  for (const town of terrain.townLayouts) {
    const b = town.bounds;
    if (!inChunk(b.x - 900, b.y - 900, b.x + b.w + 900, b.y + b.h + 900, 0)) continue;
    paintTown(ctx, town, geo, detail);
  }

  // 5c. Acampamento do bando: terra batida, trilhas da fogueira até cada local e o aterro da paliçada
  const camp = terrain.campGround;
  if (camp && inChunk(camp.origin.x, camp.origin.y, camp.origin.x + PALISADE.x * 2, camp.origin.y + PALISADE.y * 2, 60)) paintCamp(ctx, camp);

  // 5d. Locais de contrato e covis: terra pisada, o piso velho das ruínas, o chão morto do necromante
  for (const site of world.sites) {
    const c = site.center;
    if (inChunk(c.x - WILD_REACH, c.y - WILD_REACH, c.x + WILD_REACH, c.y + WILD_REACH, 0)) paintWild(ctx, site.theme, c, site.id);
  }
  for (const lair of terrain.lairGrounds) {
    const c = lair.at;
    if (inChunk(c.x - WILD_REACH, c.y - WILD_REACH, c.x + WILD_REACH, c.y + WILD_REACH, 0)) paintWild(ctx, lair.kind, c, lair.id);
  }

  // 6. Rios: margem escura e água por cima (trecho a trecho, com a largura de cada um)
  if (geo) {
    for (const river of world.geo.rivers) {
      const pts = river.points;
      for (const pass of [0, 1]) {
        for (let k = 1; k < pts.length; k++) {
          const a = pts[k - 1];
          const b = pts[k];
          const w = (river.widths[k - 1] + river.widths[k]) / 2;
          if (!inChunk(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), w)) continue;
          const shallow = w <= 50;
          const freeze = terrain.season.freezeBelow;
          const frozen = freeze !== null && geo.temperatureAt((a.x + b.x) / 2, (a.y + b.y) / 2) < freeze;
          const flood = terrain.season.flood && !shallow;
          ctx.strokeStyle =
            pass === 0 ? (frozen ? "rgba(150,170,180,0.6)" : "rgba(48,60,40,0.55)") : frozen ? "#cfe2ee" : flood ? "#4a6f86" : shallow ? "#5f9cb8" : "#3a74a4";
          ctx.lineWidth = pass === 0 ? w + 14 : w;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // 7. Vaus e pontes
    for (const c of world.geo.crossings) {
      if (!inChunk(c.x, c.y, c.x, c.y, 300)) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      const across = c.width + 80;
      if (c.kind === "FERRY") {
        // Cais nas duas margens, a corda de margem a margem e a balsa no meio do rio
        ctx.fillStyle = "#6b4a2b";
        ctx.fillRect(-40, -across / 2 - 30, 80, 60);
        ctx.fillRect(-40, across / 2 - 30, 80, 60);
        ctx.strokeStyle = "#3b2a17";
        ctx.lineWidth = 4;
        ctx.strokeRect(-40, -across / 2 - 30, 80, 60);
        ctx.strokeRect(-40, across / 2 - 30, 80, 60);
        ctx.strokeStyle = "#d8c8a0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -across / 2);
        ctx.lineTo(0, across / 2);
        ctx.stroke();
        ctx.fillStyle = "#8a6a3a";
        ctx.fillRect(-55, -30, 110, 60);
        ctx.strokeStyle = "#4e3820";
        ctx.lineWidth = 4;
        ctx.strokeRect(-55, -30, 110, 60);
        ctx.restore();
        continue;
      }
      if (c.kind === "FORD") {
        // Cheia: o vau some debaixo da água (um rio de verdade); gelo: o vau é só gelo
        const frozen = terrain.season.freezeBelow !== null && geo.temperatureAt(c.x, c.y) < terrain.season.freezeBelow;
        if (frozen || (terrain.season.flood && c.width > 50)) {
          ctx.restore();
          continue;
        }
        const len = GEO.FORD_LENGTH;
        ctx.fillStyle = "rgba(150,196,206,0.9)";
        ctx.fillRect(-len / 2, -across / 2, len, across);
        const rnd = new Phaser.Math.RandomDataGenerator([c.id]);
        ctx.fillStyle = "#8b8b80";
        for (let s = 0; s < 14; s++) {
          ctx.beginPath();
          ctx.arc(rnd.between(-len / 2 + 10, len / 2 - 10), rnd.between(-across / 2 + 10, across / 2 - 10), rnd.between(5, 10), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const len = GEO.BRIDGE_LENGTH;
        if (terrain.isBurned(c.id)) {
          // Ponte queimada: só os pilares carbonizados
          ctx.fillStyle = "#1e1a16";
          for (const y of [-across / 2 + 10, -across / 6, across / 6, across / 2 - 10]) {
            ctx.fillRect(-len / 2 + 10, y - 8, 22, 16);
            ctx.fillRect(len / 2 - 32, y - 8, 22, 16);
          }
        } else {
          ctx.fillStyle = "#7a5a34";
          ctx.fillRect(-len / 2 + 30, -across / 2, len - 60, across);
          ctx.strokeStyle = "#4e3820";
          ctx.lineWidth = 6;
          ctx.strokeRect(-len / 2 + 30, -across / 2, len - 60, across);
          ctx.lineWidth = 3;
          for (let y = -across / 2 + 18; y < across / 2; y += 22) {
            ctx.beginPath();
            ctx.moveTo(-len / 2 + 30, y);
            ctx.lineTo(len / 2 - 30, y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Até onde vai o chão de um local de contrato ou de um covil, a partir do centro. */
const WILD_REACH = 340;

/**
 * Chão de um local de contrato ou de um covil: manchas de borda irregular (sempre as mesmas
 * para o mesmo lugar, em qualquer pedaço). As cores caem nos materiais do filtro do chão:
 * terra pisada, o piso de pedra quebrado das ruínas, o chão roxo e rachado do necromante.
 */
function paintWild(ctx: CanvasRenderingContext2D, kind: SiteTheme | CalamityKind, c: Point, id: string): void {
  const rnd = new Phaser.Math.RandomDataGenerator([`ermo-${id}`]);
  // Borda ondulada: três ondas de fases ao acaso somadas (sem pontas)
  const blob = (cx: number, cy: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 48;
    const phase = [rnd.realInRange(0, 6.3), rnd.realInRange(0, 6.3), rnd.realInRange(0, 6.3)];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const wob = 1 + 0.09 * Math.sin(2 * a + phase[0]) + 0.06 * Math.sin(3 * a + phase[1]) + 0.04 * Math.sin(5 * a + phase[2]);
      const x = cx + Math.cos(a) * r * wob;
      const y = cy + Math.sin(a) * r * 0.86 * wob;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  const spots = (n: number, reach: number, r: number, color: string) => {
    for (let k = 0; k < n; k++) {
      const a = rnd.realInRange(0, Math.PI * 2);
      const d = rnd.realInRange(0, reach);
      blob(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, r * rnd.realInRange(0.6, 1.2), color);
    }
  };
  switch (kind) {
    case "BANDIT_CAMP":
      blob(c.x, c.y, 250, "#7a6a45");
      spots(5, 160, 50, "#86754d");
      break;
    case "GOBLIN_NEST":
      blob(c.x, c.y, 240, "#6e5e3c");
      spots(6, 180, 40, "#5a4a30");
      break;
    case "HAUNTED_RUINS": {
      blob(c.x, c.y, 230, "#5d584a");
      // Piso velho de lajes, com metade das lajes arrancadas
      const T = 22;
      for (let y = -140; y < 140; y += T) {
        for (let x = -200; x < 200; x += T) {
          const keep = rnd.frac() < 0.55 - Math.hypot(x / 200, y / 140) * 0.35;
          if (!keep) continue;
          ctx.fillStyle = rnd.frac() < 0.5 ? "#7d776c" : "#736d62";
          ctx.fillRect(c.x + x + (Math.round((y + 140) / T) % 2 ? T / 2 : 0), c.y + y, T - 3, T - 3);
        }
      }
      break;
    }
    case "SWAMP_FORD":
      spots(4, 200, 46, "#5f5236");
      break;
    case "NECROMANCER":
      blob(c.x, c.y, 290, "#5e4450");
      spots(7, 220, 50, "#4c3842");
      // Trilha da torre até o meio
      ctx.fillStyle = "#4c3842";
      ctx.fillRect(c.x - 14, c.y - 110, 28, 110);
      break;
    case "ORC_HORDE":
      blob(c.x, c.y, 285, "#6a5232");
      spots(6, 200, 60, "#5f4a2c");
      break;
  }
}

/** Terra batida do acampamento do bando, as trilhas da fogueira até cada local e o aterro da paliçada reforçada. */
function paintCamp(ctx: CanvasRenderingContext2D, camp: CampGround): void {
  const o = camp.origin;
  const c = { x: o.x + PALISADE.x, y: o.y + PALISADE.y };
  const gate0 = PALISADE.gateAngle + PALISADE.gateHalfWidth;
  const gate1 = PALISADE.gateAngle - PALISADE.gateHalfWidth + Math.PI * 2;
  if (camp.reinforced) {
    ctx.strokeStyle = "#6a5232";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, PALISADE.rx + 12, PALISADE.ry + 12, 0, gate0, gate1);
    ctx.stroke();
  }
  ctx.fillStyle = "#7a6a45";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, PALISADE.rx - 20, PALISADE.ry - 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#86754d";
  ctx.lineWidth = 26;
  const fire = { x: o.x + CAMPFIRE.x, y: o.y + CAMPFIRE.y };
  for (const to of [...CAMP_SITES.map((s) => s.door), { x: PALISADE.x - PALISADE.rx, y: PALISADE.y }]) {
    ctx.beginPath();
    ctx.moveTo(fire.x, fire.y);
    ctx.lineTo(o.x + to.x, o.y + to.y);
    ctx.stroke();
  }
}

/**
 * Chão de um povoado (as construções são sprites, em TownArt). De perto (`detail`), as ruas e a
 * praça ganham pedras e as lavouras, fileiras de plantas: o filtro do chão lê essas cores.
 */
function paintTown(ctx: CanvasRenderingContext2D, town: TownLayout, geo: TerrainMap["geo"], detail: boolean): void {
  const ruined = town.ruined;
  const rnd = new Phaser.Math.RandomDataGenerator([`chao-cidade-${town.cx}-${town.cy}`]);
  const land = (x: number, y: number) => !geo || geo.isOpenLand({ x, y });
  for (const f of town.fields) {
    if (!land(f.x + f.w / 2, f.y + f.h / 2) || !land(f.x, f.y) || !land(f.x + f.w, f.y + f.h)) continue;
    const vertical = f.w < f.h;
    ctx.fillStyle = ruined ? "#56552f" : "#7a6236";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    // Fileiras de plantas (de perto, uma a cada 8 px; de longe, as faixas de sempre)
    const step = detail ? 8 : 34;
    ctx.fillStyle = ruined ? "#4a4a2a" : detail ? "#6e8a34" : "#8f7f3c";
    for (let k = detail ? 3 : 30; k < (vertical ? f.w : f.h) - 4; k += step) {
      if (vertical) ctx.fillRect(f.x + k, f.y + 6, detail ? 4 : 3, f.h - 12);
      else ctx.fillRect(f.x + 6, f.y + k, f.w - 12, detail ? 4 : 3);
    }
    ctx.strokeStyle = "#4d3b20";
    ctx.lineWidth = 3;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
  }
  const b = town.bounds;
  const t = town.wallThickness;
  ctx.fillStyle = ruined ? "#5d584a" : "#7d6f50";
  ctx.fillRect(b.x + t, b.y + t, b.w - t * 2, b.h - t * 2);
  ctx.fillStyle = ruined ? "#6a6454" : "#998a63";
  for (const s of town.streets) ctx.fillRect(s.x, s.y, s.w, s.h);
  const sq = town.square;
  ctx.fillStyle = ruined ? "#6f6a5c" : "#a89f86";
  ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
  if (detail) {
    // Calçamento da praça: pedras em fiadas desencontradas
    ctx.fillStyle = ruined ? "#5e5a50" : "#8c8578";
    ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
    ctx.fillStyle = ruined ? "#77726a" : "#a8a090";
    for (let y = sq.y + 1, row = 0; y < sq.y + sq.h - 4; y += 7, row++) {
      for (let x = sq.x + (row % 2) * 5 + 1; x < sq.x + sq.w - 8; x += 10) ctx.fillRect(x, y, 8 + rnd.between(-1, 0), 5);
    }
  }
  ctx.strokeStyle = "#6b6250";
  ctx.lineWidth = 3;
  ctx.strokeRect(sq.x, sq.y, sq.w, sq.h);
  // Chão molhado em volta do poço (o poço em pé vem da arte do povoado)
  const well = wellOf(sq);
  ctx.fillStyle = ruined ? "#6a665e" : "#8a8476";
  ctx.beginPath();
  ctx.arc(well.x, well.y, WELL_RADIUS + 8, 0, Math.PI * 2);
  ctx.fill();
  // Pátio da guarnição: terra pisada
  for (const c of town.camps) {
    const r = c.rect;
    ctx.fillStyle = "#86744a";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = rnd.pick(["#7a6942", "#917f55", "#6f6040"]);
      ctx.beginPath();
      ctx.ellipse(r.x + rnd.between(20, r.w - 20), r.y + rnd.between(20, r.h - 20), rnd.between(15, 35), rnd.between(8, 18), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (town.inner) {
    const r = town.inner.rect;
    ctx.fillStyle = ruined ? "#4e4b45" : "#6d6452";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function randomPointIn(z: TerrainZone, rnd: Phaser.Math.RandomDataGenerator, scale: number) {
  const a = rnd.angle() * (Math.PI / 180);
  const r = Math.sqrt(rnd.frac()) * scale;
  return { x: z.x + Math.cos(a) * z.rx * r, y: z.y + Math.sin(a) * z.ry * r };
}

/** Desenho greybox de uma zona: elipse e detalhes do tipo (curvas de nível, poças, árvores). */
function drawZone(ctx: CanvasRenderingContext2D, z: TerrainZone, rnd: Phaser.Math.RandomDataGenerator, autumn = false): void {
  const c = autumn && z.type === "FOREST" ? AUTUMN_FOREST : autumn && z.type === "HILL" ? AUTUMN_HILL : ZONE_COLORS[z.type];
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  };
  ctx.fillStyle = c.base;
  ellipse(z.x, z.y, z.rx, z.ry);
  ctx.fill();
  switch (z.type) {
    case "HILL":
      ctx.strokeStyle = c.detail;
      ctx.lineWidth = 3;
      for (const k of [0.75, 0.5, 0.25]) {
        ellipse(z.x, z.y, z.rx * k, z.ry * k);
        ctx.stroke();
      }
      break;
    case "MUD":
      ctx.fillStyle = c.detail;
      for (let i = 0; i < 14; i++) {
        const p = randomPointIn(z, rnd, 0.85);
        ellipse(p.x, p.y, rnd.between(10, 25), rnd.between(5, 12));
        ctx.fill();
      }
      break;
    case "SWAMP":
      ctx.fillStyle = c.detail;
      for (let i = 0; i < 10; i++) {
        const p = randomPointIn(z, rnd, 0.8);
        ellipse(p.x, p.y, rnd.between(20, 45), rnd.between(10, 20));
        ctx.fill();
      }
      break;
    case "FOREST": {
      ctx.fillStyle = c.detail;
      const trees = Math.round((z.rx * z.ry) / 1400);
      for (let i = 0; i < trees; i++) {
        const p = randomPointIn(z, rnd, 0.92);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rnd.between(8, 15), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

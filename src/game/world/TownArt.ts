import Phaser from "phaser";
import { LOD_SCALE, lodOf } from "../art/atlas";
import { gridBitmap, seeded, type Bitmap } from "../art/pixel";
import {
  fencePiece,
  gateLeafPiece,
  gatePiece,
  housePiece,
  keepPiece,
  propPiece,
  rubblePiece,
  stallPiece,
  templePiece,
  tentPiece,
  towerPiece,
  wallPieceEW,
  wallPieceNS,
  wellPiece,
  type Culture,
  type Piece,
} from "../art/buildings";
import { specialHouses, wellOf, WELL_RADIUS, type Rect, type TownLayout } from "./townLayout";

/**
 * Construções dos povoados em pixel art (G3). Cada construção é uma imagem com a profundidade
 * da linha de baixo do pé (a mesma regra das figuras: quem está mais embaixo passa na frente),
 * e as imagens de um povoado vêm de poucas folhas de textura.
 *
 * O continente tem dezenas de povoados, então as folhas só existem perto da câmera: são
 * montadas aos poucos (alguns ms por quadro) quando o povoado chega a NEAR da tela e jogadas
 * fora além de FAR. De longe a folha é feita em resolução menor (½ no zoom de 50%, ¼ no de 25%):
 * 1 pixel da arte continua sendo 1 pixel da tela, sem tremer, e gasta menos memória.
 */

/** Peça a fazer: quem desenha, onde fica o pé e a linha de baixo dele (profundidade). */
export interface ArtJob {
  make: () => Piece;
  x: number;
  y: number;
  depth: number;
}

interface Slot {
  page: number;
  /** Retângulo na folha, na resolução da montagem. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Canto da imagem no mundo e a profundidade. */
  x: number;
  y: number;
  depth: number;
}

/** Uma montagem das folhas de um povoado, numa resolução (1, 2 ou 4 px de mundo por px). */
interface Build {
  scale: number;
  next: number;
  slots: Slot[];
  /** Folha em montagem: as peças prontas esperando, e a prateleira atual. */
  pending: { bitmap: Bitmap; slot: Slot }[];
  shelfX: number;
  shelfY: number;
  shelfH: number;
  keys: string[];
  images: Phaser.GameObjects.Image[];
  done: boolean;
}

interface Town {
  jobs: ArtJob[];
  bounds: Phaser.Geom.Rectangle;
  current: Build | null;
  next: Build | null;
  shown: boolean;
  /** As peças mudaram: a montagem atual fica na tela até a nova ficar pronta. */
  stale: boolean;
}

const PAGE = 2048;
const BUDGET_MS = 5;
const NEAR = 1600;
const FAR = 5000;
const SHOW = 300;
/** Pedaços das muralhas na vertical (a profundidade de cada um sai do próprio pé). */
const SEG = 48;
/** Trechos na horizontal mais longos que isto são divididos. */
const MAX_SPAN = 960;

const STALL_COLORS = [0xb84a3a, 0x3a6ab8, 0xc9a23a, 0x3a9a5a];

export class TownArt {
  private towns = new Map<string, Town>();
  private readonly prefix = `casas-${Math.random().toString(36).slice(2, 8)}`;
  private serial = 0;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Planta nova (ou mudada) de um povoado: as peças são feitas quando a câmera chegar perto. */
  set(id: string, layout: TownLayout, culture: Culture, ruined: boolean): void {
    this.remove(id);
    this.setJobs(id, townJobs(layout, culture, ruined, hashText(id)));
  }

  /**
   * Peças prontas de outro lugar (o acampamento do bando). Trocar as peças de quem já está na
   * tela não pisca: a montagem antiga fica até a nova acabar.
   */
  setJobs(id: string, jobs: ArtJob[]): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const j of jobs) {
      x0 = Math.min(x0, j.x);
      y0 = Math.min(y0, j.y);
      x1 = Math.max(x1, j.x);
      y1 = Math.max(y1, j.depth);
    }
    // Folga para o que sobe acima do pé (torres, templo) e para a sombra
    const bounds = jobs.length ? new Phaser.Geom.Rectangle(x0 - 80, y0 - 260, x1 - x0 + 900, y1 - y0 + 300) : new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const old = this.towns.get(id);
    if (old) {
      if (old.next) this.dropBuild(old.next);
      Object.assign(old, { jobs, bounds, next: null, stale: true });
      return;
    }
    this.towns.set(id, { jobs, bounds, current: null, next: null, shown: false, stale: false });
  }

  remove(id: string): void {
    const t = this.towns.get(id);
    if (!t) return;
    if (t.current) this.dropBuild(t.current);
    if (t.next) this.dropBuild(t.next);
    this.towns.delete(id);
  }

  /** Quantas peças estão de pé agora (para testes). */
  get pieceCount(): number {
    let n = 0;
    for (const t of this.towns.values()) n += t.current?.images.length ?? 0;
    return n;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const scale = LOD_SCALE[lodOf(camera.zoom)];
    const v = camera.worldView;
    const near = new Phaser.Geom.Rectangle(v.x - NEAR, v.y - NEAR, v.width + NEAR * 2, v.height + NEAR * 2);
    const far = new Phaser.Geom.Rectangle(v.x - FAR, v.y - FAR, v.width + FAR * 2, v.height + FAR * 2);
    const show = new Phaser.Geom.Rectangle(v.x - SHOW, v.y - SHOW, v.width + SHOW * 2, v.height + SHOW * 2);
    const queue: Town[] = [];
    for (const t of this.towns.values()) {
      if (!Phaser.Geom.Rectangle.Overlaps(far, t.bounds)) {
        if (t.current) this.dropBuild(t.current);
        if (t.next) this.dropBuild(t.next);
        t.current = t.next = null;
        continue;
      }
      // De perto para longe: a montagem atual é reduzida na hora; de longe para perto, refeita
      if (t.current && t.current.scale < scale) this.shrinkBuild(t.current, scale);
      if (t.next && t.next.scale < scale) {
        this.dropBuild(t.next);
        t.next = null;
      }
      if (Phaser.Geom.Rectangle.Overlaps(near, t.bounds) && (!t.current || t.current.scale > scale || t.stale) && !t.next) {
        t.next = this.newBuild(scale);
        t.stale = false;
      }
      if (t.next) queue.push(t);
      const shown = Phaser.Geom.Rectangle.Overlaps(show, t.bounds);
      if (shown !== t.shown) {
        t.shown = shown;
        for (const img of t.current?.images ?? []) img.setVisible(shown);
      }
    }
    if (queue.length === 0) return;
    // Primeiro os povoados na tela, depois os mais perto
    const cx = v.centerX;
    const cy = v.centerY;
    queue.sort((a, b) => Phaser.Math.Distance.Between(cx, cy, a.bounds.centerX, a.bounds.centerY) - Phaser.Math.Distance.Between(cx, cy, b.bounds.centerX, b.bounds.centerY));
    const t0 = performance.now();
    for (const t of queue) {
      const b = t.next as Build;
      while (b.next < t.jobs.length && (performance.now() - t0 < BUDGET_MS || b.next === 0)) this.place(b, t.jobs[b.next++]);
      if (b.next >= t.jobs.length) {
        this.flushPage(b);
        if (t.current) this.dropBuild(t.current);
        t.current = b;
        t.next = null;
        b.done = true;
        for (const img of b.images) img.setVisible(t.shown);
      }
      if (performance.now() - t0 >= BUDGET_MS) break;
    }
  }

  destroy(): void {
    for (const id of [...this.towns.keys()]) this.remove(id);
  }

  private newBuild(scale: number): Build {
    return { scale, next: 0, slots: [], pending: [], shelfX: 0, shelfY: 0, shelfH: 0, keys: [], images: [], done: false };
  }

  /** Desenha uma peça, reduz para a resolução da montagem e acha lugar para ela na folha. */
  private place(b: Build, job: ArtJob): void {
    const piece = job.make();
    const align = 4;
    const raw = gridBitmap(piece.grid);
    const bitmap = shrink(pad(raw, align), b.scale);
    const a = align / b.scale;
    const w = bitmap.width;
    const h = bitmap.height;
    if (b.shelfX + w > PAGE) {
      b.shelfX = 0;
      b.shelfY += b.shelfH;
      b.shelfH = 0;
    }
    if (b.shelfY + h > PAGE) this.flushPage(b);
    const slot: Slot = { page: b.keys.length, sx: b.shelfX, sy: b.shelfY, sw: w, sh: h, x: job.x + piece.dx, y: job.y + piece.dy, depth: job.depth };
    b.pending.push({ bitmap, slot });
    b.shelfX += Math.ceil(w / a) * a;
    b.shelfH = Math.max(b.shelfH, Math.ceil(h / a) * a);
  }

  /** Fecha a folha em montagem: vira textura, e cada peça dela vira uma imagem (escondida até a montagem acabar). */
  private flushPage(b: Build): void {
    if (b.pending.length === 0) return;
    const height = b.shelfY + b.shelfH;
    const canvas = document.createElement("canvas");
    canvas.width = PAGE;
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    const key = `${this.prefix}-${this.serial++}`;
    if (ctx) for (const { bitmap, slot } of b.pending) ctx.putImageData(new ImageData(bitmap.rgba, bitmap.width, bitmap.height), slot.sx, slot.sy);
    const texture = this.scene.textures.addCanvas(key, canvas);
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    b.keys.push(key);
    for (const { slot } of b.pending) {
      const frame = String(b.slots.length);
      texture?.add(frame, 0, slot.sx, slot.sy, slot.sw, slot.sh);
      b.slots.push(slot);
      const img = this.scene.add.image(slot.x, slot.y, key, frame).setOrigin(0, 0).setScale(b.scale).setDepth(slot.depth * 1e-6).setVisible(false);
      b.images.push(img);
    }
    b.pending = [];
    b.shelfX = b.shelfY = b.shelfH = 0;
  }

  /** Reduz as folhas já prontas (de perto para longe), em passos de ½ para não perder pixels. */
  private shrinkBuild(b: Build, scale: number): void {
    while (b.scale < scale) {
      const keys: string[] = [];
      for (const key of b.keys) {
        const src = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(src.width / 2));
        canvas.height = Math.max(1, Math.ceil(src.height / 2));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        }
        const next = `${this.prefix}-${this.serial++}`;
        this.scene.textures.addCanvas(next, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
        keys.push(next);
      }
      b.scale *= 2;
      b.slots.forEach((s, i) => {
        s.sx /= 2;
        s.sy /= 2;
        s.sw = Math.ceil(s.sw / 2);
        s.sh = Math.ceil(s.sh / 2);
        const texture = this.scene.textures.get(keys[s.page]);
        texture.add(String(i), 0, s.sx, s.sy, s.sw, s.sh);
        b.images[i].setTexture(keys[s.page], String(i)).setScale(b.scale);
      });
      for (const key of b.keys) this.scene.textures.remove(key);
      b.keys = keys;
    }
  }

  private dropBuild(b: Build): void {
    for (const img of b.images) img.destroy();
    for (const key of b.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    b.images = [];
    b.keys = [];
    b.pending = [];
  }
}

/**
 * Uma peça fora das folhas, numa textura só dela (as folhas do portão fechado no cerco), com o
 * canto do pé em (x, y) e a profundidade da linha `depthY`. Quem chama remove a textura.
 */
export function pieceImage(scene: Phaser.Scene, key: string, piece: Piece, x: number, y: number, depthY: number): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const bitmap = gridBitmap(piece.grid);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.putImageData(new ImageData(bitmap.rgba, bitmap.width, bitmap.height), 0, 0);
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return scene.add.image(x + piece.dx, y + piece.dy, key).setOrigin(0, 0).setDepth(depthY * 1e-6);
}

function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Aumenta o bitmap até múltiplos de `a` (transparente), para as reduções saírem exatas. */
function pad(b: Bitmap, a: number): Bitmap {
  const w = Math.ceil(b.width / a) * a;
  const h = Math.ceil(b.height / a) * a;
  if (w === b.width && h === b.height) return b;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < b.height; y++) rgba.set(b.rgba.subarray(y * b.width * 4, (y + 1) * b.width * 4), y * w * 4);
  return { width: w, height: h, rgba };
}

/** Reduz por `s` (1, 2 ou 4) tirando a média de cada bloco, com a cor pesada pela opacidade. */
function shrink(b: Bitmap, s: number): Bitmap {
  if (s === 1) return b;
  const w = b.width / s;
  const h = b.height / s;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const n = s * s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      let a = 0;
      for (let j = 0; j < s; j++) {
        for (let i = 0; i < s; i++) {
          const k = ((y * s + j) * b.width + x * s + i) * 4;
          const al = b.rgba[k + 3];
          r += b.rgba[k] * al;
          g += b.rgba[k + 1] * al;
          bl += b.rgba[k + 2] * al;
          a += al;
        }
      }
      const k = (y * w + x) * 4;
      if (a > 0) {
        rgba[k] = r / a;
        rgba[k + 1] = g / a;
        rgba[k + 2] = bl / a;
      }
      rgba[k + 3] = a / n;
    }
  }
  return { width: w, height: h, rgba };
}

/** Intervalos de [a, b) que sobram depois de tirar os pedaços cobertos por torres. */
function clip(a: number, b: number, covers: [number, number][]): [number, number][] {
  let spans: [number, number][] = [[a, b]];
  for (const [c0, c1] of covers) {
    spans = spans.flatMap(([s0, s1]): [number, number][] => {
      if (c1 <= s0 || c0 >= s1) return [[s0, s1]];
      const out: [number, number][] = [];
      if (c0 > s0) out.push([s0, c0]);
      if (c1 < s1) out.push([c1, s1]);
      return out;
    });
  }
  return spans.filter(([s0, s1]) => s1 - s0 >= 6);
}

/** Todas as peças de um povoado, com o lugar de cada uma. */
function townJobs(layout: TownLayout, culture: Culture, ruined: boolean, seed0: number): ArtJob[] {
  const jobs: ArtJob[] = [];
  const R = Math.round;
  const seed = (x: number, y: number) => (Math.imul(R(x), 73856093) ^ Math.imul(R(y), 19349663) ^ seed0) >>> 0;
  const add = (r: Rect, make: () => Piece) => jobs.push({ x: R(r.x), y: R(r.y), depth: R(r.y + r.h), make });
  const at = (x: number, y: number, make: () => Piece) => jobs.push({ x: R(x), y: R(y), depth: R(y), make });
  const stone = layout.wallKind === "STONE";
  const b = layout.bounds;
  const t = layout.wallThickness;

  // Casas, com as placas da taverna e da Casa dos Mercadores
  const special = ruined ? { tavern: null, guild: null } : specialHouses(layout);
  layout.houses.forEach((hs, i) => {
    const r = hs.rect;
    const south = hs.door.y > r.y + r.h / 2;
    const sign = i === special.tavern ? 0xe0b040 : i === special.guild ? 0x3a6ab8 : null;
    add(r, () => housePiece(R(r.w), R(r.h), culture, hs.roof, south ? R(hs.door.x - r.x) : null, seed(r.x, r.y), ruined, false, sign, south ? null : R(hs.door.x - r.x)));
  });
  for (const r of layout.rubble) add(r, () => rubblePiece(R(r.w), R(r.h), culture, seed(r.x, r.y)));
  const well = wellOf(layout.square);
  add({ x: well.x - WELL_RADIUS, y: well.y - WELL_RADIUS, w: 2 * WELL_RADIUS, h: 2 * WELL_RADIUS }, () => wellPiece(WELL_RADIUS, culture, seed(well.x, well.y), ruined));
  if (!ruined) {
    const rnd = seeded(seed0);
    for (const st of layout.stalls) {
      const color = STALL_COLORS[Math.floor(rnd() * STALL_COLORS.length)];
      add(st, () => stallPiece(R(st.w), R(st.h), color, culture, seed(st.x, st.y)));
    }
  }

  // Paço (Casa do Conselho nas aldeias, castelo nas cidades e fortalezas) e templo
  const k = layout.keep;
  if (!layout.inner) {
    if (layout.kind === "VILLAGE") add(k, () => housePiece(R(k.w), R(k.h), culture, 0, R(layout.hall.x - k.x), seed(k.x, k.y), ruined, true));
    else add(k, () => keepPiece(R(k.w), R(k.h), culture, R(layout.hall.x - k.x), seed(k.x, k.y), ruined));
  }
  const tp = layout.temple;
  if (tp) add(tp, () => templePiece(R(tp.w), R(tp.h), culture, seed(tp.x, tp.y), ruined));

  // Acampamentos da guarnição: barracas, cerca, fogueira, armeiro, bonecos e barris
  for (const c of layout.camps) {
    for (const tent of c.tents) add(tent, () => tentPiece(R(tent.w), R(tent.h), 0xe8dcc0, 0x9a3b2b, seed(tent.x, tent.y)));
    const r = c.rect;
    const sides: { rect: Rect; horizontal: boolean; mid: number }[] = [
      { rect: { x: r.x, y: r.y, w: r.w, h: 0 }, horizontal: true, mid: Math.hypot(r.x + r.w / 2 - c.door.x, r.y - c.door.y) },
      { rect: { x: r.x, y: r.y + r.h, w: r.w, h: 0 }, horizontal: true, mid: Math.hypot(r.x + r.w / 2 - c.door.x, r.y + r.h - c.door.y) },
      { rect: { x: r.x, y: r.y, w: 0, h: r.h }, horizontal: false, mid: Math.hypot(r.x - c.door.x, r.y + r.h / 2 - c.door.y) },
      { rect: { x: r.x + r.w, y: r.y, w: 0, h: r.h }, horizontal: false, mid: Math.hypot(r.x + r.w - c.door.x, r.y + r.h / 2 - c.door.y) },
    ];
    const door = sides.reduce((best, s) => (s.mid < best.mid ? s : best), sides[0]);
    for (const s of sides) {
      const len = R(s.horizontal ? s.rect.w : s.rect.h);
      const gaps: [number, number][] = s === door ? [[len * 0.28, len * 0.72]] : [];
      add(s.rect, () => fencePiece(len, s.horizontal, gaps, culture));
    }
    at(c.fire.x, c.fire.y, () => propPiece("FIRE", culture, seed(c.fire.x, c.fire.y)));
    const rack = c.rack;
    add(rack, () => propPiece("RACK", culture, seed(rack.x, rack.y), R(rack.w), R(rack.h)));
    for (const d of c.dummies) at(d.x, d.y + 12, () => propPiece("DUMMY", culture, seed(d.x, d.y)));
    const corner = { x: c.fire.x - 52, y: c.fire.y - 10 };
    at(corner.x, corner.y + 6, () => propPiece("BARREL", culture, 1));
    at(corner.x + 18, corner.y + 10, () => propPiece("BARREL", culture, 2));
    add({ x: corner.x - 6, y: corner.y + 16, w: 14, h: 10 }, () => propPiece("CRATE", culture, 3));
  }

  // Muralha, torres e portões (os trechos cobertos pelas torres ficam de fora)
  const walls = (list: readonly Rect[], towers: readonly Rect[], center: { x: number; y: number }, stoneWall: boolean) => {
    for (const w of list) {
      if (w.w >= w.h) {
        const side = w.y + w.h / 2 < center.y ? "N" : "S";
        const covers = towers.filter((tw) => tw.y < w.y + w.h && tw.y + tw.h > w.y).map((tw): [number, number] => [tw.x, tw.x + tw.w]);
        for (const [a, e] of clip(w.x, w.x + w.w, covers)) {
          for (let x = a; x < e; x += MAX_SPAN) {
            const len = R(Math.min(MAX_SPAN, e - x));
            add({ x, y: w.y, w: len, h: w.h }, () => wallPieceEW(len, R(w.h), side, stoneWall, culture, seed(x, w.y), ruined));
          }
        }
      } else {
        const side = w.x + w.w / 2 < center.x ? "W" : "E";
        const covers = towers.filter((tw) => tw.x < w.x + w.w && tw.x + tw.w > w.x).map((tw): [number, number] => [tw.y, tw.y + tw.h]);
        for (const [a, e] of clip(w.y, w.y + w.h, covers)) {
          for (let y = a; y < e; y += SEG) {
            const len = R(Math.min(SEG, e - y));
            const end = y + SEG >= e;
            add({ x: w.x, y, w: w.w, h: len }, () => wallPieceNS(len, R(w.w), side, stoneWall, culture, end, seed(w.x, y), ruined));
          }
        }
      }
    }
    for (const tw of towers) add(tw, () => towerPiece(R(tw.w), stoneWall, culture, seed(tw.x, tw.y), ruined));
  };
  walls(layout.walls, layout.towers, { x: layout.cx, y: layout.cy }, stone);
  if (!ruined) {
    for (const g of layout.gates) {
      if (g.side === "N" || g.side === "S") {
        const y = g.side === "N" ? b.y : b.y + b.h - t;
        add({ x: g.x - g.width / 2, y, w: g.width, h: t }, () => gatePiece(R(g.width), R(t), g.side as "N" | "S", stone, culture, seed(g.x, y), false));
      } else {
        for (const y of [g.y - g.width / 2, g.y + g.width / 2 - 18]) add({ x: g.x - t / 2 - 6, y, w: t + 12, h: 18 }, () => gateLeafPiece(R(t), culture));
      }
    }
  }

  // Capital: a Cidade Alta vista de fora (telhados apertados e o castelo ao fundo, atrás da muralha interna)
  const inner = layout.inner;
  if (inner) {
    const r = inner.rect;
    const rnd = seeded(seed0 ^ 0x51ed);
    for (let y = r.y + 70; y < r.y + r.h - 110; y += 62) {
      for (let x = r.x + 70; x < r.x + r.w - 110; x += 74) {
        if (y < r.y + 420 && Math.abs(x - (r.x + r.w / 2)) < 320) continue;
        const w = 46 + Math.floor(rnd() * 18);
        const h = 34 + Math.floor(rnd() * 14);
        const roof = Math.floor(rnd() * 4);
        add({ x, y, w, h }, () => housePiece(w, h, culture, roof, null, seed(x, y), ruined));
      }
    }
    const c = { x: r.x + r.w / 2, y: r.y + 230 };
    add({ x: c.x - 280, y: c.y - 150, w: 560, h: 300 }, () => keepPiece(560, 300, culture, 280, seed(c.x, c.y), ruined));
    const it = inner.walls[0].h;
    walls(inner.walls, inner.towers, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, true);
    add({ x: r.x + r.w / 2 - inner.gateWidth / 2, y: r.y + r.h - it, w: inner.gateWidth, h: it }, () =>
      gatePiece(inner.gateWidth, R(it), "S", true, culture, seed(r.x, r.y), false, true),
    );
  }
  return jobs;
}

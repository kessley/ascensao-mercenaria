import Phaser from "phaser";
import { addCanvasTexture } from "../art/canvasTexture";
import type { RiverDef } from "../data/world";
import type { WaterSpot } from "../art/ground";

/**
 * A água que se mexe (G2): brilhos miúdos por cima do chão de perto. No rio, o reflexo nasce,
 * cresce e some descendo a correnteza (mais rápido nos riachos); no lago e no mar, só pisca e
 * deriva um pouco. Na beira, a espuma vem e vai. Tudo num `Blitter` só (uma textura, um desenho
 * por quadro), e só nos pedaços de chão de perto que estão na tela.
 */

const KEY = "agua-brilhos";
const FW = 8;
const FH = 3;
/** Quadros de cada brilho: o reflexo cresce e some; a espuma também. */
const GLINT_FRAMES = ["g1", "g2", "g3", "g3", "g2", "g1"];
const FOAM_FRAMES = ["f1", "f2", "f3", "f2", "f1"];
/** Velocidade da correnteza (px/s) pela largura do rio. */
const flowSpeed = (width: number) => (width <= 50 ? 16 : width <= 100 ? 11 : 8);
/** Lado da grade que acha o trecho de rio mais perto. */
const SEG_CELL = 400;

interface Glint {
  bob: Phaser.GameObjects.Bob;
  x: number;
  y: number;
  vx: number;
  vy: number;
  period: number;
  offset: number;
  /** Fração do ciclo em que aparece. */
  lit: number;
  shore: boolean;
  frame: string;
}

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
  speed: number;
}

type Pixel = readonly [number, number, number, number];
const L: Pixel = [196, 228, 244, 215];
const B: Pixel = [238, 249, 255, 240];
const D: Pixel = [16, 44, 84, 80];
const W: Pixel = [236, 246, 248, 225];
const S: Pixel = [212, 234, 240, 150];

/** Cada quadro: lista de [x, y, cor]. */
const FRAMES: Record<string, [number, number, Pixel][]> = {
  g1: [[3, 1, L], [4, 1, L], [3, 2, D], [4, 2, D]],
  g2: [[2, 1, L], [3, 1, B], [4, 1, B], [5, 1, L], [2, 2, D], [3, 2, D], [4, 2, D], [5, 2, D]],
  g3: [[3, 0, L], [4, 0, L], [1, 1, L], [2, 1, L], [3, 1, B], [4, 1, B], [5, 1, L], [6, 1, L], [1, 2, D], [2, 2, D], [3, 2, D], [4, 2, D], [5, 2, D], [6, 2, D]],
  f1: [[3, 1, S], [4, 1, S]],
  f2: [[3, 0, S], [2, 1, W], [3, 1, W], [4, 1, W], [5, 1, W]],
  f3: [[2, 0, S], [3, 0, S], [4, 0, S], [1, 1, W], [2, 1, W], [4, 1, W], [5, 1, W], [6, 1, W]],
};

function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function makeTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEY)) return;
  const names = Object.keys(FRAMES);
  const canvas = document.createElement("canvas");
  canvas.width = FW * names.length;
  canvas.height = FH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(canvas.width, FH);
  names.forEach((name, f) => {
    for (const [x, y, c] of FRAMES[name]) {
      const k = (y * canvas.width + f * FW + x) * 4;
      img.data.set(c, k);
    }
  });
  ctx.putImageData(img, 0, 0);
  const texture = addCanvasTexture(scene.textures, KEY, canvas);
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  names.forEach((name, f) => texture?.add(name, 0, f * FW, 0, FW, FH));
}

export class WaterGlints {
  private readonly blitter: Phaser.GameObjects.Blitter;
  private readonly chunks = new Map<number, Glint[]>();
  private readonly shown = new Set<number>();
  private readonly segments = new Map<number, Segment[]>();
  private readonly segCols: number;

  constructor(scene: Phaser.Scene, rivers: readonly RiverDef[], worldWidth: number) {
    makeTexture(scene);
    // Logo acima do chão de perto e abaixo de tudo o que anda
    this.blitter = scene.add.blitter(0, 0, KEY).setDepth(-9.8);
    this.segCols = Math.ceil(worldWidth / SEG_CELL);
    for (const r of rivers) {
      for (let k = 1; k < r.points.length; k++) {
        const a = r.points[k - 1];
        const b = r.points[k];
        const width = (r.widths[k - 1] + r.widths[k]) / 2;
        const seg = { ax: a.x, ay: a.y, bx: b.x, by: b.y, half: width / 2 + 3, speed: flowSpeed(width) };
        const c0 = Math.floor((Math.min(a.x, b.x) - width) / SEG_CELL);
        const c1 = Math.floor((Math.max(a.x, b.x) + width) / SEG_CELL);
        const r0 = Math.floor((Math.min(a.y, b.y) - width) / SEG_CELL);
        const r1 = Math.floor((Math.max(a.y, b.y) + width) / SEG_CELL);
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const key = row * this.segCols + col;
            const list = this.segments.get(key) ?? [];
            list.push(seg);
            this.segments.set(key, list);
          }
        }
      }
    }
  }

  /** Quantos brilhos existem agora (para testes). */
  get count(): number {
    let n = 0;
    for (const list of this.chunks.values()) n += list.length;
    return n;
  }

  /** Brilhos de um pedaço de chão recém-pintado (substitui os de antes, se houver). */
  add(index: number, spots: readonly WaterSpot[]): void {
    this.remove(index);
    if (spots.length === 0) return;
    const list: Glint[] = [];
    for (const s of spots) {
      const roll = hash(s.x, s.y);
      let vx = 1.5;
      let vy = 0;
      if (!s.shore) {
        const seg = this.riverAt(s.x, s.y);
        if (seg) {
          const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay) || 1;
          vx = ((seg.bx - seg.ax) / len) * seg.speed;
          vy = ((seg.by - seg.ay) / len) * seg.speed;
        }
      }
      const frame = s.shore ? FOAM_FRAMES[0] : GLINT_FRAMES[0];
      const bob = this.blitter.create(s.x - FW / 2, s.y - 1, frame);
      bob.setVisible(false);
      list.push({
        bob,
        x: s.x - FW / 2,
        y: s.y - 1,
        vx: s.shore ? 0 : vx,
        vy: s.shore ? 0 : vy,
        period: s.shore ? 2.6 + roll * 1.6 : 1.8 + roll * 1.4,
        offset: hash(s.y, s.x) * 10,
        lit: s.shore ? 0.6 : 0.55,
        shore: s.shore,
        frame,
      });
    }
    this.chunks.set(index, list);
  }

  remove(index: number): void {
    const list = this.chunks.get(index);
    if (!list) return;
    // Com a cena fechando, o Blitter (e os brilhos com ele) já pode ter sido destruído, e o brilho
    // não aguenta ser destruído duas vezes
    for (const g of list) if (g.bob.parent) g.bob.destroy();
    this.chunks.delete(index);
    this.shown.delete(index);
  }

  /** Anima os brilhos dos pedaços na tela; os outros ficam escondidos. */
  update(timeMs: number, visible: ReadonlySet<number>): void {
    for (const index of this.shown) {
      if (visible.has(index)) continue;
      for (const g of this.chunks.get(index) ?? []) g.bob.setVisible(false);
      this.shown.delete(index);
    }
    const t = timeMs / 1000;
    for (const index of visible) {
      const list = this.chunks.get(index);
      if (!list) continue;
      this.shown.add(index);
      for (const g of list) {
        const age = (t + g.offset) % g.period;
        const phase = age / g.period;
        if (phase >= g.lit) {
          if (g.bob.visible) g.bob.setVisible(false);
          continue;
        }
        const frames = g.shore ? FOAM_FRAMES : GLINT_FRAMES;
        const frame = frames[Math.min(frames.length - 1, Math.floor((phase / g.lit) * frames.length))];
        if (frame !== g.frame) {
          g.bob.setFrame(frame);
          g.frame = frame;
        }
        g.bob.x = Math.round(g.x + g.vx * age);
        g.bob.y = Math.round(g.y + g.vy * age);
        if (!g.bob.visible) g.bob.setVisible(true);
      }
    }
  }

  destroy(): void {
    this.chunks.clear();
    this.shown.clear();
    // O Blitter destrói os brilhos junto
    this.blitter.destroy();
  }

  /** O trecho de rio que contém o ponto (para saber para onde corre a água). */
  private riverAt(x: number, y: number): Segment | null {
    const list = this.segments.get(Math.floor(y / SEG_CELL) * this.segCols + Math.floor(x / SEG_CELL));
    if (!list) return null;
    let best: Segment | null = null;
    let bestD = Infinity;
    for (const s of list) {
      const vx = s.bx - s.ax;
      const vy = s.by - s.ay;
      const len = vx * vx + vy * vy;
      const k = len > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / len)) : 0;
      const d = Math.hypot(x - (s.ax + vx * k), y - (s.ay + vy * k));
      if (d <= s.half && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }
}

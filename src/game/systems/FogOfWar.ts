import Phaser from "phaser";
import { CAMERA, COLORS, SUPPORT } from "../../utils/constants";
import type { Point } from "../../utils/math";
import { addCanvasTexture } from "../art/canvasTexture";

/** Área desenhada além da visão da câmera (a névoa só é redesenhada a cada atualização). */
const DRAW_MARGIN = 600;
const FOG_RGB = [(COLORS.FOG >> 16) & 0xff, (COLORS.FOG >> 8) & 0xff, COLORS.FOG & 0xff] as const;
const EXPLORED_ALPHA = Math.round(SUPPORT.FOG_EXPLORED_ALPHA * 255);
const UNEXPLORED_ALPHA = Math.round(SUPPORT.FOG_UNEXPLORED_ALPHA * 255);
let textures = 0;

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
}

/**
 * Névoa de guerra em grade (greybox: retângulos).
 * - Nunca visto: escuro. Já visto: meia sombra (o terreno fica conhecido). Visível agora: limpo.
 * A visão é recalculada a partir das fontes (Comandante, batalhões, batedores, mensageiros).
 * O mundo é grande: só as células perto da câmera são desenhadas, um pixel por célula numa
 * textura pequena, ampliada sem suavizar. Um retângulo por célula num Graphics custava caro: o
 * Phaser refaz todos os retângulos a cada quadro (milhares com a câmera afastada).
 */
export class FogOfWar {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cell = SUPPORT.FOG_CELL;
  private readonly explored: Uint8Array;
  private readonly visible: Uint8Array;
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private canvas!: HTMLCanvasElement;
  private pixels!: ImageData;
  private texture: Phaser.Textures.Texture | null = null;
  private sources: VisionSource[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.cols = Math.ceil(width / this.cell);
    this.rows = Math.ceil(height / this.cell);
    this.explored = new Uint8Array(this.cols * this.rows);
    this.visible = new Uint8Array(this.cols * this.rows);
    // Do tamanho da maior área que a câmera mostra (zoom mínimo); tela maior aumenta em draw
    const span = (side: number) => Math.ceil((side / CAMERA.MIN_ZOOM + DRAW_MARGIN * 2) / this.cell) + 2;
    const key = this.makeTexture(span(scene.scale.width), span(scene.scale.height));
    // Acima das unidades e do terreno; abaixo dos textos de interface do mundo
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setScale(this.cell).setDepth(15).setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dropTexture());
  }

  /** Textura nova de `w`×`h` células (a anterior sai do Phaser). */
  private makeTexture(w: number, h: number): string {
    this.dropTexture();
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.pixels = new ImageData(w, h);
    const key = `fog:${++textures}`;
    this.texture = addCanvasTexture(this.scene.textures, key, this.canvas);
    this.texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  private dropTexture(): void {
    if (this.texture) this.scene.textures.remove(this.texture);
    this.texture = null;
  }

  /** Visão exata (para unidades), sem a granularidade da grade. */
  canSee(p: Point): boolean {
    return this.sources.some((s) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 <= s.radius * s.radius);
  }

  get gridCols(): number {
    return this.cols;
  }

  get gridRows(): number {
    return this.rows;
  }

  get cellSize(): number {
    return this.cell;
  }

  isExplored(p: Point): boolean {
    const col = Math.floor(p.x / this.cell);
    const row = Math.floor(p.y / this.cell);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    return this.explored[row * this.cols + col] === 1;
  }

  /** Marca uma área como já explorada (lugares conhecidos, rota da viagem rápida). */
  revealExplored(p: Point, radius: number): void {
    this.forCellsInCircle(p, radius, (i) => {
      this.explored[i] = 1;
    });
  }

  /** Uma letra por célula: 0 nunca visto, 1 explorado, 2 visível agora (para o Mapa do Continente). */
  snapshot(): string {
    let out = "";
    for (let i = 0; i < this.explored.length; i++) out += this.visible[i] ? "2" : this.explored[i] ? "1" : "0";
    return out;
  }

  update(sources: VisionSource[], view: Phaser.Geom.Rectangle): void {
    this.sources = sources;
    this.visible.fill(0);
    for (const s of sources) {
      this.forCellsInCircle(s, s.radius, (i) => {
        this.visible[i] = 1;
        this.explored[i] = 1;
      });
    }
    this.draw(view);
  }

  private forCellsInCircle(p: Point, radius: number, fn: (index: number) => void): void {
    const c = this.cell;
    // Só as células dentro do quadrado que envolve o círculo
    const minCol = Math.max(0, Math.floor((p.x - radius) / c));
    const maxCol = Math.min(this.cols - 1, Math.floor((p.x + radius) / c));
    const minRow = Math.max(0, Math.floor((p.y - radius) / c));
    const maxRow = Math.min(this.rows - 1, Math.floor((p.y + radius) / c));
    const r2 = radius * radius;
    for (let row = minRow; row <= maxRow; row++) {
      const cy = row * c + c / 2;
      for (let col = minCol; col <= maxCol; col++) {
        const cx = col * c + c / 2;
        if ((cx - p.x) ** 2 + (cy - p.y) ** 2 <= r2) fn(row * this.cols + col);
      }
    }
  }

  private draw(view: Phaser.Geom.Rectangle): void {
    const c = this.cell;
    const minCol = Math.max(0, Math.floor((view.x - DRAW_MARGIN) / c));
    const maxCol = Math.min(this.cols - 1, Math.floor((view.right + DRAW_MARGIN) / c));
    const minRow = Math.max(0, Math.floor((view.y - DRAW_MARGIN) / c));
    const maxRow = Math.min(this.rows - 1, Math.floor((view.bottom + DRAW_MARGIN) / c));
    if (maxCol < minCol || maxRow < minRow) {
      this.image.setVisible(false);
      return;
    }
    const w = maxCol - minCol + 1;
    const h = maxRow - minRow + 1;
    if (w > this.canvas.width || h > this.canvas.height) {
      this.image.setTexture(this.makeTexture(Math.max(w, this.canvas.width), Math.max(h, this.canvas.height)));
    }
    // O que sobra da textura além da área de agora fica transparente
    const px = this.pixels.data;
    px.fill(0);
    const stride = this.canvas.width;
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const i = row * this.cols + col;
        if (this.visible[i]) continue;
        const p = ((row - minRow) * stride + (col - minCol)) * 4;
        px[p] = FOG_RGB[0];
        px[p + 1] = FOG_RGB[1];
        px[p + 2] = FOG_RGB[2];
        px[p + 3] = this.explored[i] ? EXPLORED_ALPHA : UNEXPLORED_ALPHA;
      }
    }
    this.canvas.getContext("2d")?.putImageData(this.pixels, 0, 0);
    // A atualização do Phaser volta o filtro ao suave: devolve o "sem suavizar" das células
    this.texture?.source[0].update();
    this.texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.image.setPosition(minCol * c, minRow * c).setVisible(true);
  }

  /**
   * O que já foi explorado, compactado para o save: corridas alternadas de células
   * (começando por "nunca visto"), em base 36 separadas por vírgula.
   */
  exportExplored(): string {
    const runs: number[] = [];
    let current = 0;
    let run = 0;
    for (const v of this.explored) {
      if (v === current) run++;
      else {
        runs.push(run);
        current = v;
        run = 1;
      }
    }
    runs.push(run);
    return runs.map((n) => n.toString(36)).join(",");
  }

  importExplored(data: string): void {
    let i = 0;
    let value = 0;
    for (const part of data.split(",")) {
      const n = parseInt(part, 36) || 0;
      this.explored.fill(value, i, Math.min(this.explored.length, i + n));
      i += n;
      value = 1 - value;
    }
  }

  /** Fração do mapa já explorada (0–1). */
  get exploredRatio(): number {
    let n = 0;
    for (const v of this.explored) n += v;
    return n / this.explored.length;
  }
}

import Phaser from "phaser";
import { COLORS, SUPPORT } from "../../utils/constants";
import type { Point } from "../../utils/math";

/** Área desenhada além da visão da câmera (a névoa só é redesenhada a cada atualização). */
const DRAW_MARGIN = 600;

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
}

/**
 * Névoa de guerra em grade (greybox: retângulos).
 * - Nunca visto: escuro. Já visto: meia sombra (o terreno fica conhecido). Visível agora: limpo.
 * A visão é recalculada a partir das fontes (Comandante, batalhões, batedores, mensageiros).
 * O mundo é grande: só as células perto da câmera são desenhadas.
 */
export class FogOfWar {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cell = SUPPORT.FOG_CELL;
  private readonly explored: Uint8Array;
  private readonly visible: Uint8Array;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private sources: VisionSource[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.cols = Math.ceil(width / this.cell);
    this.rows = Math.ceil(height / this.cell);
    this.explored = new Uint8Array(this.cols * this.rows);
    this.visible = new Uint8Array(this.cols * this.rows);
    // Acima das unidades e do terreno; abaixo dos textos de interface do mundo
    this.gfx = scene.add.graphics().setDepth(15);
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
    const g = this.gfx;
    const c = this.cell;
    g.clear();
    const minCol = Math.max(0, Math.floor((view.x - DRAW_MARGIN) / c));
    const maxCol = Math.min(this.cols - 1, Math.floor((view.right + DRAW_MARGIN) / c));
    const minRow = Math.max(0, Math.floor((view.y - DRAW_MARGIN) / c));
    const maxRow = Math.min(this.rows - 1, Math.floor((view.bottom + DRAW_MARGIN) / c));
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const i = row * this.cols + col;
        if (this.visible[i]) continue;
        g.fillStyle(COLORS.FOG, this.explored[i] ? SUPPORT.FOG_EXPLORED_ALPHA : SUPPORT.FOG_UNEXPLORED_ALPHA);
        g.fillRect(col * c, row * c, c, c);
      }
    }
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

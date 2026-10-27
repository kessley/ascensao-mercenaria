import Phaser from "phaser";
import { COLORS, SUPPORT } from "../../utils/constants";
import type { Point } from "../../utils/math";

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
}

/**
 * Névoa de guerra em grade (greybox: retângulos).
 * - Nunca visto: escuro. Já visto: meia sombra (o terreno fica conhecido). Visível agora: limpo.
 * A visão é recalculada a partir das fontes (Comandante, batalhões, batedores, mensageiros).
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

  update(sources: VisionSource[]): void {
    this.sources = sources;
    const c = this.cell;
    this.visible.fill(0);
    for (const s of sources) {
      // Só as células dentro do quadrado que envolve o círculo
      const minCol = Math.max(0, Math.floor((s.x - s.radius) / c));
      const maxCol = Math.min(this.cols - 1, Math.floor((s.x + s.radius) / c));
      const minRow = Math.max(0, Math.floor((s.y - s.radius) / c));
      const maxRow = Math.min(this.rows - 1, Math.floor((s.y + s.radius) / c));
      const r2 = s.radius * s.radius;
      for (let row = minRow; row <= maxRow; row++) {
        const cy = row * c + c / 2;
        for (let col = minCol; col <= maxCol; col++) {
          const cx = col * c + c / 2;
          if ((cx - s.x) ** 2 + (cy - s.y) ** 2 <= r2) {
            const i = row * this.cols + col;
            this.visible[i] = 1;
            this.explored[i] = 1;
          }
        }
      }
    }
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    const c = this.cell;
    g.clear();
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const i = row * this.cols + col;
        if (this.visible[i]) continue;
        g.fillStyle(COLORS.FOG, this.explored[i] ? SUPPORT.FOG_EXPLORED_ALPHA : SUPPORT.FOG_UNEXPLORED_ALPHA);
        g.fillRect(col * c, row * c, c, c);
      }
    }
  }

  /** Fração do mapa já explorada (0–1). */
  get exploredRatio(): number {
    let n = 0;
    for (const v of this.explored) n += v;
    return n / this.explored.length;
  }
}

import Phaser from "phaser";
import type { Point } from "../../utils/math";

export interface CircleObstacle {
  x: number;
  y: number;
  r: number;
}

/**
 * Rotas curtas contornando obstáculos (retângulos e círculos) por um grafo de visibilidade:
 * os nós são os cantos dos retângulos e pontos ao redor dos círculos, já com a folga do raio
 * de quem anda. Pequeno e calculado só no clique — suficiente para o acampamento.
 */
export class Pathfinder {
  private readonly rects: Phaser.Geom.Rectangle[];
  private readonly circles: CircleObstacle[];
  private readonly nodes: Point[];

  constructor(
    rects: readonly Phaser.Geom.Rectangle[],
    circles: readonly CircleObstacle[],
    walkerRadius: number,
    private readonly isWalkable: (p: Point) => boolean,
  ) {
    const pad = walkerRadius + 4;
    this.rects = rects.map((r) => new Phaser.Geom.Rectangle(r.x - pad, r.y - pad, r.width + pad * 2, r.height + pad * 2));
    this.circles = circles.map((c) => ({ ...c, r: c.r + pad }));

    const candidates: Point[] = [];
    for (const r of this.rects) {
      const m = 3; // nós um pouco fora do canto, para a linha não raspar a borda
      candidates.push(
        { x: r.x - m, y: r.y - m },
        { x: r.right + m, y: r.y - m },
        { x: r.x - m, y: r.bottom + m },
        { x: r.right + m, y: r.bottom + m },
      );
    }
    for (const c of this.circles) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = c.r / Math.cos(Math.PI / 8) + 3; // octógono circunscrito
        candidates.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr });
      }
    }
    this.nodes = candidates.filter((p) => this.isFree(p));
  }

  private isFree(p: Point): boolean {
    if (!this.isWalkable(p)) return false;
    if (this.rects.some((r) => r.contains(p.x, p.y))) return false;
    return !this.circles.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r);
  }

  /** O segmento a→b atravessa algum obstáculo? */
  private blocked(a: Point, b: Point): boolean {
    const line = new Phaser.Geom.Line(a.x, a.y, b.x, b.y);
    for (const r of this.rects) {
      if (r.contains(a.x, a.y) || r.contains(b.x, b.y) || Phaser.Geom.Intersects.LineToRectangle(line, r)) return true;
    }
    for (const c of this.circles) {
      if (Phaser.Geom.Intersects.LineToCircle(line, new Phaser.Geom.Circle(c.x, c.y, c.r))) return true;
    }
    return false;
  }

  /** Pontos a seguir de `from` até `to` (sem incluir `from`). Sem rota: segue reto e deixa a colisão resolver. */
  findPath(from: Point, to: Point): Point[] {
    if (!this.blocked(from, to)) return [to];

    const nodes = [from, to, ...this.nodes];
    const dist = new Array<number>(nodes.length).fill(Infinity);
    const prev = new Array<number>(nodes.length).fill(-1);
    const done = new Array<boolean>(nodes.length).fill(false);
    dist[0] = 0;

    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
      if (u === -1 || dist[u] === Infinity) break;
      if (u === 1) break;
      done[u] = true;
      for (let v = 0; v < nodes.length; v++) {
        if (done[v] || v === u) continue;
        const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
        if (d < dist[v] && !this.blocked(nodes[u], nodes[v])) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }

    if (prev[1] === -1) return [to];
    const path: Point[] = [];
    for (let v = 1; v !== 0; v = prev[v]) path.unshift(nodes[v]);
    return path;
  }
}

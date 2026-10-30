import type { Point } from "../../utils/math";

/** Custo de atravessar um ponto: 1 = campo aberto; Infinity = intransponível. */
export type CostSampler = (x: number, y: number) => number;

const UNKNOWN = 0;
const KNOWN = 1;
const SQRT2 = Math.SQRT2;

/**
 * Grade de navegação com A* (Marco 11): rios, mar, lagos e montanhas bloqueiam; lama, vau e
 * pântano custam mais; estradas custam menos. Cada célula é avaliada só quando alguém precisa
 * dela (o continente tem ~100 mil células) e pode ser reavaliada (ponte queimada).
 * Uma célula bloqueia se qualquer amostra dela bloquear: um rio nunca "passa entre" amostras.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly state: Uint8Array;
  private readonly cost: Float32Array;
  /** Multiplicador de custo por célula (estradas < 1). */
  private readonly bonus: Float32Array;
  private readonly minCost: number;
  // Memória do A*, reaproveitada entre buscas (carimbo de geração em vez de limpar tudo)
  private readonly g: Float32Array;
  private readonly from: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private generation = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cell: number,
    private readonly sampler: CostSampler,
    /** Pontos amostrados por lado da célula (1 = só o centro; 3 = 9 amostras). */
    private readonly samples = 3,
    minCost = 0.6,
  ) {
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    const n = this.cols * this.rows;
    this.state = new Uint8Array(n);
    this.cost = new Float32Array(n);
    this.bonus = new Float32Array(n).fill(1);
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.minCost = minCost;
  }

  index(x: number, y: number): number {
    const c = Math.floor(x / this.cell);
    const r = Math.floor(y / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  centerOf(i: number): Point {
    return { x: ((i % this.cols) + 0.5) * this.cell, y: (Math.floor(i / this.cols) + 0.5) * this.cell };
  }

  /** Custo da célula (Infinity = bloqueada), avaliado na primeira consulta. */
  cellCost(i: number): number {
    if (this.state[i] === UNKNOWN) {
      const c = i % this.cols;
      const r = Math.floor(i / this.cols);
      const k = this.samples;
      let worst = 0;
      for (let sy = 0; sy < k; sy++) {
        for (let sx = 0; sx < k; sx++) {
          const x = (c + (k === 1 ? 0.5 : sx / (k - 1) * 0.9 + 0.05)) * this.cell;
          const y = (r + (k === 1 ? 0.5 : sy / (k - 1) * 0.9 + 0.05)) * this.cell;
          worst = Math.max(worst, this.sampler(x, y));
          if (worst === Infinity) break;
        }
        if (worst === Infinity) break;
      }
      this.cost[i] = worst;
      this.state[i] = KNOWN;
    }
    return this.cost[i] * this.bonus[i];
  }

  isOpen(p: Point): boolean {
    const i = this.index(p.x, p.y);
    return i >= 0 && this.cellCost(i) !== Infinity;
  }

  /** Estradas: células ao longo da linha custam menos (a busca prefere segui-las). */
  markRoad(points: readonly Point[], factor: number): void {
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1];
      const b = points[k];
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (this.cell / 2));
      for (let s = 0; s <= steps; s++) {
        const i = this.index(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
        if (i >= 0) this.bonus[i] = Math.min(this.bonus[i], factor);
      }
    }
  }

  /** Há estrada nesta célula? */
  isRoad(x: number, y: number): boolean {
    const i = this.index(x, y);
    return i >= 0 && this.bonus[i] < 1;
  }

  /** Reavalia tudo (a estação mudou: rios congelaram, degelo, cheia). */
  invalidateAll(): void {
    this.state.fill(UNKNOWN);
  }

  /** Reavalia as células perto de um ponto (ex.: ponte queimada ou reconstruída). */
  invalidate(p: Point, radius: number): void {
    const c0 = Math.max(0, Math.floor((p.x - radius) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((p.x + radius) / this.cell));
    const r0 = Math.max(0, Math.floor((p.y - radius) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((p.y + radius) / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.state[r * this.cols + c] = UNKNOWN;
  }

  /** A linha reta a→b passa só por células abertas? */
  lineClear(a: Point, b: Point): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(d / (this.cell * 0.4)));
    for (let s = 0; s <= steps; s++) {
      const i = this.index(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
      if (i < 0 || this.cellCost(i) === Infinity) return false;
    }
    return true;
  }

  /** Célula aberta mais próxima (busca em anéis), ou null. */
  nearestOpen(p: Point, maxRadius = 1200): Point | null {
    if (this.isOpen(p)) return p;
    const c0 = Math.floor(p.x / this.cell);
    const r0 = Math.floor(p.y / this.cell);
    const maxRing = Math.ceil(maxRadius / this.cell);
    for (let ring = 1; ring <= maxRing; ring++) {
      let best: Point | null = null;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (this.cellCost(i) === Infinity) continue;
          const q = this.centerOf(i);
          const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
          if (d < bestD) {
            best = q;
            bestD = d;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * Caminho de `a` até `b` (pontos a seguir, sem incluir `a`; o último é `b`), ou null se
   * não houver ou se a busca passar de `maxNodes` células. Com `smooth`, o caminho é alisado:
   * só sobram os pontos onde a linha reta deixa de ser possível (sem ele, célula a célula,
   * que é o que as estradas querem: o alisamento ignora custos e cortaria rios e montanhas).
   */
  findPath(a: Point, b: Point, maxNodes = 8000, smooth = true): Point[] | null {
    const start = this.index(a.x, a.y);
    const goalPoint = this.isOpen(b) ? b : this.nearestOpen(b, 400);
    if (start < 0 || !goalPoint) return null;
    const goal = this.index(goalPoint.x, goalPoint.y);
    if (start === goal) return [goalPoint];

    const gen = ++this.generation;
    const cols = this.cols;
    const gc = goal % cols;
    const gr = Math.floor(goal / cols);
    const h = (i: number) => {
      const dx = Math.abs((i % cols) - gc);
      const dy = Math.abs(Math.floor(i / cols) - gr);
      return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * this.minCost;
    };
    const open = new PathHeap();
    this.g[start] = 0;
    this.from[start] = -1;
    this.stamp[start] = gen;
    open.push(start, h(start));
    let expanded = 0;
    let found = false;
    while (open.size > 0) {
      const u = open.pop();
      if (this.closed[u] === gen) continue;
      this.closed[u] = gen;
      if (u === goal) {
        found = true;
        break;
      }
      if (++expanded > maxNodes) break;
      const uc = u % cols;
      const ur = Math.floor(u / cols);
      const costU = this.cellCost(u) === Infinity ? 1 : this.cellCost(u);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const c = uc + dc;
          const r = ur + dr;
          if (c < 0 || r < 0 || c >= cols || r >= this.rows) continue;
          const v = r * cols + c;
          if (this.closed[v] === gen) continue;
          const costV = this.cellCost(v);
          if (costV === Infinity) continue;
          // Na diagonal, não corta o canto de uma célula bloqueada
          if (dr && dc && (this.cellCost(ur * cols + c) === Infinity || this.cellCost(r * cols + uc) === Infinity)) continue;
          const step = (dr && dc ? SQRT2 : 1) * (costU + costV) / 2;
          const g = this.g[u] + step;
          if (this.stamp[v] === gen && g >= this.g[v]) continue;
          this.stamp[v] = gen;
          this.g[v] = g;
          this.from[v] = u;
          open.push(v, g + h(v));
        }
      }
    }
    if (!found) return null;

    const cells: number[] = [];
    for (let v = goal; v !== -1 && v !== start; v = this.from[v]) cells.push(v);
    cells.reverse();
    const raw = cells.map((i) => this.centerOf(i));
    raw[raw.length - 1] = goalPoint;
    if (!smooth) return raw;
    // Alisa: de cada ponto, pula para o mais distante ainda visível em linha reta (até 40 adiante)
    const path: Point[] = [];
    let at = a;
    let k = 0;
    while (k < raw.length) {
      let far = k;
      for (let j = Math.min(raw.length - 1, k + 40); j > k; j--) {
        if (this.lineClear(at, raw[j])) {
          far = j;
          break;
        }
      }
      path.push(raw[far]);
      at = raw[far];
      k = far + 1;
    }
    return path;
  }
}

/** Fila de prioridade do A*. */
class PathHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    const items = this.items;
    const keys = this.keys;
    items.push(item);
    keys.push(key);
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      items[i] = items[p];
      keys[i] = keys[p];
      i = p;
    }
    items[i] = item;
    keys[i] = key;
  }

  pop(): number {
    const items = this.items;
    const keys = this.keys;
    const top = items[0];
    const item = items.pop() as number;
    const key = keys.pop() as number;
    const n = items.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && keys[r] < keys[l] ? r : l;
        if (keys[m] >= key) break;
        items[i] = items[m];
        keys[i] = keys[m];
        i = m;
      }
      items[i] = item;
      keys[i] = key;
    }
    return top;
  }
}

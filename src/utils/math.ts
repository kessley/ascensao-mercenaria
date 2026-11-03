export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Diferença absoluta entre dois ângulos, em [0, PI]. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

export function centroid(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Item mais próximo de `from`, opcionalmente limitado a `maxDist`. */
/** Comprimento de uma linha de pontos. */
export function routeLength(route: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += distance(route[i - 1], route[i]);
  return total;
}

/** Ponto a `d` px do começo da linha. */
export function pointAlong(route: readonly Point[], d: number): Point {
  let left = d;
  for (let i = 1; i < route.length; i++) {
    const seg = distance(route[i - 1], route[i]);
    if (left <= seg) {
      const t = seg > 0 ? left / seg : 0;
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * t, y: route[i - 1].y + (route[i].y - route[i - 1].y) * t };
    }
    left -= seg;
  }
  return route[route.length - 1];
}

export function nearest<T extends Point>(items: readonly T[], from: Point, maxDist = Infinity): T | null {
  let best: T | null = null;
  let bestDist = maxDist;
  for (const item of items) {
    const d = distance(item, from);
    if (d <= bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

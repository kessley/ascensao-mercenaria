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

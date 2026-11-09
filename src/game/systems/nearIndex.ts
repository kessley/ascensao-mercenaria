import type { Point } from "../../utils/math";

/**
 * Busca de vizinhos numa lista que não muda durante o quadro (os inimigos que cada soldado procura
 * ao escolher o alvo). Uma grade de células guarda os índices; a busca confere a distância exata e
 * devolve o mesmo que a conta contra a lista inteira, inclusive no empate (vence o último da lista,
 * como em `nearest`).
 */
const CELL = 160;
/** Abaixo disto a lista inteira é mais barata que montar a grade. */
const MIN_ITEMS = 48;

let built: readonly Point[] | null = null;
let builtAt = NaN;
const cells = new Map<number, number[]>();
const pool: number[][] = [];
const found: number[] = [];

const keyOf = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);

function build(items: readonly Point[]): void {
  for (const list of cells.values()) {
    list.length = 0;
    pool.push(list);
  }
  cells.clear();
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const k = keyOf(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
    let list = cells.get(k);
    if (!list) {
      list = pool.pop() ?? [];
      cells.set(k, list);
    }
    list.push(i);
  }
}

/** Índices (em ordem) dos itens a até `r` de `p`. A grade é refeita quando a lista ou o quadro mudam. */
function within(items: readonly Point[], frame: number, p: Point, r: number): number[] {
  if (items !== built || frame !== builtAt) {
    build(items);
    built = items;
    builtAt = frame;
  }
  found.length = 0;
  const x0 = Math.floor((p.x - r) / CELL);
  const x1 = Math.floor((p.x + r) / CELL);
  const y0 = Math.floor((p.y - r) / CELL);
  const y1 = Math.floor((p.y + r) / CELL);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const list = cells.get(keyOf(cx, cy));
      if (list) for (const i of list) found.push(i);
    }
  }
  if (found.length > 1) found.sort((a, b) => a - b);
  return found;
}

/**
 * O mais perto de `from` entre os itens a até `radius` de `around` (o mesmo que
 * `nearest(items.filter((e) => distance(e, around) <= radius), from, maxDist)`). `frame` é a hora
 * da cena: os itens não podem andar entre duas buscas do mesmo quadro.
 */
export function nearestWithin<T extends Point>(items: readonly T[], frame: number, around: Point, radius: number, from: Point, maxDist = Infinity): T | null {
  let best: T | null = null;
  let bestDist = maxDist;
  const dist = (a: Point, b: Point) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  if (items.length < MIN_ITEMS) {
    for (const e of items) {
      if (dist(e, around) > radius) continue;
      const d = dist(e, from);
      if (d <= bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }
  // Só os de perto de `around`; e, se há limite, os de perto de `from`
  const reach = Math.min(radius, maxDist + dist(around, from));
  for (const i of within(items, frame, around, reach)) {
    const e = items[i];
    if (dist(e, around) > radius) continue;
    const d = dist(e, from);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

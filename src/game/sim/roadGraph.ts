import type { WorldDef } from "../data/world";
import { townLayout, type TownLayout } from "../world/townLayout";
import { distance, type Point } from "../../utils/math";
import { WORLD } from "../../utils/constants";

/**
 * Grafo das estradas (Marco 14): cada estrada do gerador liga dois povoados (ou o
 * acampamento, ou um local nos ermos). As caravanas andam por ele, de portão em portão,
 * atravessando as cidades do caminho pela praça. Barato de calcular (dezenas de nós), ao
 * contrário de uma rota pela grade de navegação.
 */

interface Edge {
  to: string;
  points: Point[];
  length: number;
}

export interface RoadRoute {
  points: Point[];
  /** Comprimento em px e em dias de marcha. */
  length: number;
  days: number;
  /** Povoados do caminho (sem a origem e o destino). */
  via: string[];
}

export class RoadGraph {
  private readonly edges = new Map<string, Edge[]>();
  private readonly layouts = new Map<string, TownLayout>();

  constructor(world: WorldDef) {
    for (const s of world.settlements) this.layouts.set(s.id, townLayout(s.id, s.kind, s.x, s.y, false));
    const nodeOf = (p: Point): string => {
      for (const [id, l] of this.layouts) {
        const b = l.bounds;
        if (p.x >= b.x - 80 && p.x <= b.x + b.w + 80 && p.y >= b.y - 80 && p.y <= b.y + b.h + 80) return id;
      }
      return `J:${Math.round(p.x / 150)}:${Math.round(p.y / 150)}`;
    };
    for (const line of world.roads) {
      if (line.length < 2) continue;
      const a = nodeOf(line[0]);
      const b = nodeOf(line[line.length - 1]);
      if (a === b) continue;
      let length = 0;
      for (let i = 1; i < line.length; i++) length += distance(line[i - 1], line[i]);
      this.add(a, { to: b, points: line, length });
      this.add(b, { to: a, points: [...line].reverse(), length });
    }
  }

  private add(from: string, e: Edge): void {
    const list = this.edges.get(from) ?? [];
    list.push(e);
    this.edges.set(from, list);
  }

  /** Povoados ligados por estrada (com a distância), do mais perto ao mais longe. */
  reachable(from: string, maxDays: number): { id: string; days: number }[] {
    const dist = this.dijkstra(from, maxDays * WORLD.DAY_DISTANCE).dist;
    return [...dist.entries()]
      .filter(([id]) => id !== from && this.layouts.has(id))
      .map(([id, d]) => ({ id, days: d / WORLD.DAY_DISTANCE }))
      .sort((a, b) => a.days - b.days);
  }

  /** Rota pelas estradas de um povoado a outro (null = não há estrada que ligue). */
  route(from: string, to: string): RoadRoute | null {
    const { dist, prev } = this.dijkstra(from, Infinity, to);
    if (!dist.has(to)) return null;
    const nodes: string[] = [to];
    while (nodes[0] !== from) {
      const p = prev.get(nodes[0]);
      if (!p) return null;
      nodes.unshift(p.node);
    }
    const points: Point[] = [];
    const via: string[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const e = prev.get(nodes[i])?.edge;
      if (!e) return null;
      // Atravessa o povoado do meio do caminho pela praça (de um portão ao outro)
      const mid = this.layouts.get(nodes[i - 1]);
      if (i > 1 && mid) {
        points.push(mid.market);
        via.push(nodes[i - 1]);
      }
      points.push(...e.points);
    }
    const end = this.layouts.get(to);
    if (end) points.push(end.market);
    const start = this.layouts.get(from);
    if (start) points.unshift(start.market);
    const length = dist.get(to) ?? 0;
    return { points, length, days: length / WORLD.DAY_DISTANCE, via };
  }

  private dijkstra(from: string, limit: number, stopAt?: string): { dist: Map<string, number>; prev: Map<string, { node: string; edge: Edge }> } {
    const dist = new Map<string, number>([[from, 0]]);
    const prev = new Map<string, { node: string; edge: Edge }>();
    const open = new Set<string>([from]);
    while (open.size > 0) {
      let cur = "";
      let best = Infinity;
      for (const n of open) {
        const d = dist.get(n) ?? Infinity;
        if (d < best) {
          best = d;
          cur = n;
        }
      }
      open.delete(cur);
      if (cur === stopAt) break;
      for (const e of this.edges.get(cur) ?? []) {
        const d = best + e.length;
        if (d > limit || d >= (dist.get(e.to) ?? Infinity)) continue;
        dist.set(e.to, d);
        prev.set(e.to, { node: cur, edge: e });
        open.add(e.to);
      }
    }
    return { dist, prev };
  }
}

const cache = new WeakMap<WorldDef, RoadGraph>();

/** Grafo das estradas do mundo (calculado uma vez por mundo). */
export function roadGraphOf(world: WorldDef): RoadGraph {
  let g = cache.get(world);
  if (!g) {
    g = new RoadGraph(world);
    cache.set(world, g);
  }
  return g;
}

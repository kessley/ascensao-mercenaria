import { FATIGUE } from "../../utils/constants";

/** Um batalhão visto para o revezamento (Marco 24). */
export interface LineSpot {
  id: string;
  x: number;
  y: number;
  /** Para onde a frente dele olha. */
  facing: number;
  /** Está lutando agora. */
  fighting: boolean;
  /** Pode receber a ordem (não está em pânico nem dizimado). */
  free: boolean;
}

/** Quanto `rear` está atrás de `front`, na direção da frente dele (positivo: atrás). */
function behind(front: LineSpot, rear: LineSpot): number {
  return -((rear.x - front.x) * Math.cos(front.facing) + (rear.y - front.y) * Math.sin(front.facing));
}

/**
 * Revezar: quem luta troca de lugar com um batalhão descansado logo atrás dele. Para cada
 * escolhido que luta, o mais perto que está atrás e não luta; para cada escolhido que não luta, o
 * mais perto que luta à frente dele. Cada batalhão entra em um par só. Devolve [frente, trás].
 */
export function reliefPairs(picked: readonly LineSpot[], all: readonly LineSpot[], range = FATIGUE.RELIEF_RANGE): [string, string][] {
  const used = new Set<string>();
  const pairs: [string, string][] = [];
  const near = (a: LineSpot, b: LineSpot) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const p of picked) {
    if (!p.free || used.has(p.id)) continue;
    let best: LineSpot | null = null;
    for (const o of all) {
      if (o.id === p.id || !o.free || used.has(o.id) || o.fighting === p.fighting) continue;
      const [front, rear] = p.fighting ? [p, o] : [o, p];
      // Atrás de verdade (meio corpo já conta), e perto o bastante para a troca não virar marcha
      if (behind(front, rear) < 20 || near(p, o) > range) continue;
      if (!best || near(p, o) < near(p, best)) best = o;
    }
    if (!best) continue;
    used.add(p.id);
    used.add(best.id);
    pairs.push(p.fighting ? [p.id, best.id] : [best.id, p.id]);
  }
  return pairs;
}

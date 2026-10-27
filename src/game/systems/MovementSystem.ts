import type { Unit } from "../entities/Unit";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../utils/constants";

/**
 * "Peso" de `u` ao se separar de `other`: quem pesa mais é menos empurrado.
 * O Comandante (herói) não é empurrado pelos próprios aliados — eles abrem passagem;
 * contra inimigos ele pesa mais que um soldado comum.
 */
function massAgainst(u: Unit, other: Unit): number {
  if (u.isHero) return u.team === other.team ? Infinity : 4;
  return 1;
}

/** Empurra unidades sobrepostas para longe uma da outra (evita empilhamento sem usar física). */
export function separateUnits(units: readonly Unit[]): void {
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.isAlive) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.isAlive) continue;
      const min = a.radius + b.radius + 2;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d = Math.hypot(dx, dy);
      }
      // Divide a correção na proporção inversa do peso (peso infinito não se mexe)
      const ma = massAgainst(a, b);
      const mb = massAgainst(b, a);
      if (ma === Infinity && mb === Infinity) continue;
      const shareA = ma === Infinity ? 0 : mb === Infinity ? 1 : mb / (ma + mb);
      const overlap = min - d;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * overlap * shareA;
      a.y -= ny * overlap * shareA;
      b.x += nx * overlap * (1 - shareA);
      b.y += ny * overlap * (1 - shareA);
    }
  }
}

export function clampToWorld(units: readonly Unit[]): void {
  for (const u of units) {
    u.x = Math.min(WORLD_WIDTH - u.radius, Math.max(u.radius, u.x));
    u.y = Math.min(WORLD_HEIGHT - u.radius, Math.max(u.radius, u.y));
  }
}

import { Unit } from "../entities/Unit";
import { COMBAT, TERRAIN, WORLD_HEIGHT, WORLD_WIDTH } from "../../utils/constants";
import { forEachNearPair } from "./nearPairs";

/**
 * "Peso" de `u` ao se separar de `other`: quem pesa mais é menos empurrado.
 * O Comandante (herói) não é empurrado pelos próprios aliados — eles abrem passagem. Quem está
 * plantado lutando ou na fileira não cede a quem chega andando; quem carrega abre caminho.
 */
function massAgainst(u: Unit, other: Unit): number {
  if (u.isHero && u.team === other.team) return Infinity;
  if (u.isCharging || u.ridingThrough) return u.mass * COMBAT.PUSH_CHARGING;
  // Cavalo em movimento abre caminho: é assim que a cavalaria sai de um cerco
  if (u.mounted && u.unitState === "MOVING") return u.mass * COMBAT.PUSH_RIDER;
  // Entre aliados ninguém é parede: quem passa e quem está parado abrem espaço um para o outro
  const planted = u.team !== other.team && (u.unitState === "ATTACKING" || u.unitState === "IDLE");
  return planted ? u.mass * COMBAT.PUSH_PLANTED : u.mass;
}

/**
 * Afasta unidades sobrepostas (evita empilhamento sem usar física). A correção é só uma parte da
 * sobreposição por quadro: as linhas se apertam e se acomodam, em vez de uma jogar a outra longe.
 */
export function separateUnits(units: readonly Unit[]): void {
  // Só se tocam vizinhos: a grade junta quem está a menos de um contato do maior
  let reach = 0;
  for (const u of units) if (u.radius > reach) reach = u.radius;
  forEachNearPair(units, reach * 2 + 2, alive, separatePair);
}

const alive = (u: Unit): boolean => u.isAlive;

function separatePair(a: Unit, b: Unit): void {
  const min = a.radius + b.radius + 2;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (dx >= min || dx <= -min || dy >= min || dy <= -min) return;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d >= min) return;
  if (d < 0.001) {
    dx = Math.random() - 0.5;
    dy = Math.random() - 0.5;
    d = Math.sqrt(dx * dx + dy * dy);
  }
  // Divide a correção na proporção inversa do peso (peso infinito não se mexe)
  const ma = massAgainst(a, b);
  const mb = massAgainst(b, a);
  if (ma === Infinity && mb === Infinity) return;
  const shareA = ma === Infinity ? 0 : mb === Infinity ? 1 : mb / (ma + mb);
  const overlap = (min - d) * COMBAT.PUSH_RATE;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * overlap * shareA;
  a.y -= ny * overlap * shareA;
  b.x += nx * overlap * (1 - shareA);
  b.y += ny * overlap * (1 - shareA);
}

/**
 * Mantém todos dentro do mundo e fora da água funda e das montanhas (e dos povoados fechados
 * para eles): quem foi empurrado para lá volta à última posição boa (um salto grande — viagem,
 * recuo — é aceito).
 */
export function clampToWorld(units: readonly Unit[]): void {
  for (const u of units) {
    u.x = Math.min(WORLD_WIDTH - u.radius, Math.max(u.radius, u.x));
    u.y = Math.min(WORLD_HEIGHT - u.radius, Math.max(u.radius, u.y));
    if (!Unit.terrain) continue;
    const near = Math.abs(u.x - u.safeX) + Math.abs(u.y - u.safeY) < 120;
    if ((TERRAIN[u.terrainType].blocked || u.pushedThroughGate(u.safeX, u.safeY)) && near) {
      u.x = u.safeX;
      u.y = u.safeY;
    } else {
      u.safeX = u.x;
      u.safeY = u.y;
    }
  }
}

import type { Point } from "../../utils/math";

// Grade reaproveitada entre chamadas: cada célula guarda o primeiro da lista, e cada item o próximo
const heads = new Map<number, number>();
let next = new Int32Array(256);
let cellX = new Int32Array(256);
let cellY = new Int32Array(256);

/**
 * Visita uma vez cada par (i < j na lista) que pode estar a menos de `reach` em x e em y, sem
 * testar todos contra todos: uma grade de células do tamanho de `reach` só junta vizinhos.
 * Vale a posição do começo da chamada; quem `visit` mexe não troca de célula até a próxima.
 * Pode visitar pares um pouco mais longe (até duas células): `visit` confere a distância.
 */
export function forEachNearPair<T extends Point>(items: readonly T[], reach: number, take: (item: T) => boolean, visit: (a: T, b: T) => void): void {
  const n = items.length;
  if (n < 2 || !(reach > 0)) return;
  if (next.length < n) {
    next = new Int32Array(n * 2);
    cellX = new Int32Array(n * 2);
    cellY = new Int32Array(n * 2);
  }
  // As células contam a partir do canto de quem entra: os números ficam pequenos em qualquer mapa
  let minX = Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = items[i];
    if (!take(t)) {
      cellX[i] = -1;
      continue;
    }
    cellX[i] = 0;
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  if (minX === Infinity) return;
  // Duas linhas a mais que as ocupadas: as vizinhas de fora (-1 e a última + 1) nunca têm ninguém
  const stride = Math.floor((maxY - minY) / reach) + 3;
  heads.clear();
  // De trás para a frente: cada lista fica na ordem da entrada
  for (let i = n - 1; i >= 0; i--) {
    if (cellX[i] < 0) continue;
    const t = items[i];
    const cx = Math.floor((t.x - minX) / reach);
    const cy = Math.floor((t.y - minY) / reach);
    cellX[i] = cx;
    cellY[i] = cy;
    const key = cx * stride + cy;
    next[i] = heads.get(key) ?? -1;
    heads.set(key, i);
  }
  for (let i = 0; i < n; i++) {
    const cx = cellX[i];
    if (cx < 0) continue;
    const cy = cellY[i];
    const a = items[i];
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let j = heads.get(gx * stride + gy) ?? -1; j !== -1; j = next[j]) if (j > i) visit(a, items[j]);
      }
    }
  }
}

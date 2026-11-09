import type { Point } from "../../utils/math";
import type { CampDef } from "./world";

export const CAMP_WIDTH = 1800;
export const CAMP_HEIGHT = 1300;

/**
 * O espaço reservado ao acampamento no mundo (o gerador deixa livre). O acampamento de verdade é o
 * quadrado da planta na grade (campGrid.ts), centrado na fogueira; a paliçada grande (28×28) cabe aqui.
 */
const RESERVED = { x: 900, y: 650, rx: 780, ry: 540 };

export const CAMPFIRE: Point = { x: 900, y: 650 };
/** O Comandante começa entre a fogueira e a própria tenda, de frente para a porta. */
export const COMMANDER_SPAWN: Point = { x: 900, y: 560 };

/** Os locais que já existiam antes do Marco 22 (o painel e a chave do interior de cada um). */
export type CampSiteKind = "TENT" | "QUARTERMASTER" | "RECRUIT" | "TRAINING" | "FORGE" | "STABLE";

/** Distância do ponto de interação em que aparece o aviso "E — ...". */
export const INTERACT_RADIUS = 70;

/** Acampamento montado com a fogueira em `center` (o gerador e o acampamento móvel usam). */
export function campDefAt(center: Point): CampDef {
  const origin = { x: Math.round(center.x - CAMPFIRE.x), y: Math.round(center.y - CAMPFIRE.y) };
  const local = (p: Point) => ({ x: origin.x + p.x, y: origin.y + p.y });
  return {
    origin,
    center: local(CAMPFIRE),
    spawn: local(COMMANDER_SPAWN),
    // Ponto de chegada das estradas: a oeste, por fora do maior quadrado possível
    gate: local({ x: RESERVED.x - RESERVED.rx - 40, y: RESERVED.y }),
  };
}

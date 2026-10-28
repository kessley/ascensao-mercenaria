import type { EnemyKind } from "../../utils/constants";

/** Grupo de inimigos posto no mundo (local de contrato, guarnição, covil...). */
export interface EnemyGroupDef {
  x: number;
  y: number;
  units: [EnemyKind, number][];
}

/** Escala os grupos conforme a dificuldade do contrato. */
export function scaleGroups(groups: readonly EnemyGroupDef[], multiplier: number): EnemyGroupDef[] {
  return groups.map((g) => ({
    ...g,
    units: g.units.map(([kind, n]) => [kind, Math.max(1, Math.round(n * multiplier))] as [EnemyKind, number]),
  }));
}

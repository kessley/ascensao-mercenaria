import type { Battalion } from "../entities/Battalion";
import { BALANCE, type GroupArrangement } from "../../utils/constants";
import type { Point } from "../../utils/math";

/** Posição de um batalhão no grupo: `lateral` (lado) e `back` (distância atrás da primeira fileira). */
export interface GroupSlot {
  battalion: Battalion;
  lateral: number;
  back: number;
}

/**
 * Distribui um grupo de batalhões em fileiras conforme o arranjo escolhido.
 * `facing` é a direção da frente do grupo; `reference` é usado para manter
 * a ordem lateral atual dentro de cada fileira (ninguém cruza o caminho do outro).
 */
export function layoutGroup(
  group: readonly Battalion[],
  arrangement: GroupArrangement,
  facing: number,
  reference: Point,
): GroupSlot[] {
  const lx = -Math.sin(facing);
  const ly = Math.cos(facing);
  const lateralOf = (b: Battalion) => (b.center.x - reference.x) * lx + (b.center.y - reference.y) * ly;
  const byLateral = (list: Battalion[]) => [...list].sort((a, b) => lateralOf(a) - lateralOf(b));

  const archers = group.filter((b) => b.troopType === "ARCHERS");
  const infantry = group.filter((b) => b.troopType === "INFANTRY");
  const cavalry = group.filter((b) => b.troopType === "CAVALRY");

  let rows: Battalion[][];
  switch (arrangement) {
    case "ARCHERS_BACK":
      rows = [byLateral([...infantry, ...cavalry]), byLateral(archers)];
      break;
    case "CAVALRY_FLANKS": {
      // Cavalaria dividida entre as duas pontas da fileira da frente
      const cav = byLateral(cavalry);
      const half = Math.ceil(cav.length / 2);
      rows = [[...cav.slice(0, half), ...byLateral(infantry), ...cav.slice(half)], byLateral(archers)];
      break;
    }
    case "COLUMN":
      rows = [...infantry, ...cavalry, ...archers].map((b) => [b]);
      break;
    default:
      rows = [byLateral([...group])];
  }

  // Fileiras vazias somem; fileiras largas demais quebram em mais fileiras
  const finalRows: Battalion[][] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i += BALANCE.GROUP_ROW_MAX) {
      finalRows.push(row.slice(i, i + BALANCE.GROUP_ROW_MAX));
    }
  }

  const slots: GroupSlot[] = [];
  let back = 0;
  for (const row of finalRows) {
    const widths = row.map((b) => b.frontWidth());
    const total = widths.reduce((sum, w) => sum + w, 0) + BALANCE.GROUP_GAP * (row.length - 1);
    let cursor = -total / 2;
    row.forEach((battalion, i) => {
      slots.push({ battalion, lateral: cursor + widths[i] / 2, back });
      cursor += widths[i] + BALANCE.GROUP_GAP;
    });
    back += Math.max(...row.map((b) => b.formationDepth())) + BALANCE.GROUP_ROW_GAP;
  }
  return slots;
}

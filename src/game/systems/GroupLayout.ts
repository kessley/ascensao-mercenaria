import type { Battalion } from "../entities/Battalion";
import { BALANCE, COMBAT, FORMATIONS, TROOPS, type GroupArrangement, type TroopFamily } from "../../utils/constants";
import { angleTo, clamp, distance, type Point } from "../../utils/math";
import { formationSize } from "./formation";

/** Posição de um batalhão no grupo: `lateral` (lado) e `back` (distância atrás da primeira fileira). */
export interface GroupSlot {
  battalion: Battalion;
  lateral: number;
  back: number;
}

/** Lugar de um batalhão na linha riscada com o mouse. */
export interface LinePlan {
  battalion: Battalion;
  /** Centro da primeira fileira. */
  point: Point;
  facing: number;
  /** Soldados por fileira. */
  width: number;
  /** 0 = primeira fileira de batalhões. */
  row: number;
}

/** Fileiras de batalhões conforme o arranjo; cada fileira em ordem lateral. */
function groupRows(group: readonly Battalion[], arrangement: GroupArrangement, facing: number, reference: Point): Battalion[][] {
  const lx = -Math.sin(facing);
  const ly = Math.cos(facing);
  const lateralOf = (b: Battalion) => (b.center.x - reference.x) * lx + (b.center.y - reference.y) * ly;
  const byLateral = (list: Battalion[]) => [...list].sort((a, b) => lateralOf(a) - lateralOf(b));

  const family = (f: TroopFamily) => group.filter((b) => TROOPS[b.troopType].family === f);
  const archers = family("ARCHERS");
  const infantry = family("INFANTRY");
  const cavalry = family("CAVALRY");

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
  return rows.filter((row) => row.length > 0);
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
  // Fileiras largas demais quebram em mais fileiras
  const finalRows: Battalion[][] = [];
  for (const row of groupRows(group, arrangement, facing, reference)) {
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

/**
 * Linha riscada com o botão direito: `from`→`to` é a frente do grupo, que olha 90° à esquerda
 * do risco (da esquerda para a direita, para cima da tela). Cada fileira de batalhões divide o
 * comprimento pelo número de soldados: risco longo, linha fina; risco curto, tropa funda.
 */
export function planLine(group: readonly Battalion[], from: Point, to: Point, arrangement: GroupArrangement): LinePlan[] {
  const length = distance(from, to);
  const along = angleTo(from, to);
  const facing = along - Math.PI / 2;
  const ux = Math.cos(along);
  const uy = Math.sin(along);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  const plans: LinePlan[] = [];
  let back = 0;
  for (const [index, row] of groupRows(group, arrangement, facing, mid).entries()) {
    const gaps = BALANCE.GROUP_GAP * (row.length - 1);
    const men = row.reduce((n, b) => n + b.soldiers.length, 0);
    const sized = row.map((battalion) => {
      const count = Math.max(1, battalion.soldiers.length);
      const share = (Math.max(0, length - gaps) * count) / Math.max(1, men);
      const width = clamp(Math.round(share / FORMATIONS[battalion.formation].spacing), 1, count);
      return { battalion, width, size: formationSize(battalion.formation, count, width) };
    });
    const used = sized.reduce((n, s) => n + s.size.width, 0);
    // Sobrando risco, os batalhões se abrem até as pontas (sem perder o contato entre si)
    const gap = row.length > 1 ? clamp((length - used) / (row.length - 1), BALANCE.GROUP_GAP, COMBAT.LINE_MAX_GAP) : 0;
    let cursor = -(used + gap * (row.length - 1)) / 2;
    for (const { battalion, width, size } of sized) {
      const lateral = cursor + size.width / 2;
      plans.push({ battalion, width, facing, row: index, point: { x: mid.x + ux * lateral - fx * back, y: mid.y + uy * lateral - fy * back } });
      cursor += size.width + gap;
    }
    back += Math.max(...sized.map((s) => s.size.depth)) + BALANCE.GROUP_ROW_GAP;
  }
  return plans;
}

import { FORMATIONS, type Formation } from "../../utils/constants";

/** Soldados por fileira quando ninguém escolheu a largura. */
function defaultWidth(formation: Formation, count: number): number {
  return formation === "SHIELD_WALL" ? 8 : Math.min(4, count);
}

/** Soldados na primeira fileira (a cunha não tem largura a escolher). */
export function frontOf(formation: Formation, count: number, width?: number | null): number {
  return Math.max(1, Math.min(count, width ?? defaultWidth(formation, count)));
}

/**
 * Lugar do soldado `i` (de `count`) no referencial da formação: `lateral` (lado) e `depth`
 * (para trás). A conta é a mesma para os batalhões do jogador e os esquadrões inimigos.
 * `width` é quantos ficam em cada fileira: menos gente de frente, mais fileiras atrás.
 */
export function formationOffset(formation: Formation, i: number, count: number, width?: number | null): { lateral: number; depth: number } {
  const spacing = FORMATIONS[formation].spacing;
  if (formation === "WEDGE") {
    // Triângulo com a ponta à frente: fileira r tem r+1 soldados
    const r = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
    const pos = i - (r * (r + 1)) / 2;
    return { lateral: (pos - r / 2) * spacing, depth: -r * spacing };
  }
  const cols = frontOf(formation, count, width);
  const row = Math.floor(i / cols);
  // A última fileira, incompleta, fica centrada
  const inRow = Math.min(cols, count - row * cols);
  const lateral = (i - row * cols - (inRow - 1) / 2) * spacing;
  const depth = -row * spacing;
  if (formation !== "LOOSE") return { lateral, depth };
  // Desalinhamento determinístico por soldado
  return { lateral: lateral + Math.sin(i * 12.9898) * spacing * 0.25, depth: depth + Math.cos(i * 78.233) * spacing * 0.25 };
}

/** Largura e profundidade (px) de uma formação de `count` soldados. */
export function formationSize(formation: Formation, count: number, width?: number | null): { width: number; depth: number } {
  const n = Math.max(1, count);
  const slots = Array.from({ length: n }, (_, i) => formationOffset(formation, i, n, width));
  const laterals = slots.map((s) => s.lateral);
  const depths = slots.map((s) => s.depth);
  const spacing = FORMATIONS[formation].spacing;
  return { width: Math.max(...laterals) - Math.min(...laterals) + spacing, depth: Math.max(...depths) - Math.min(...depths) + spacing };
}

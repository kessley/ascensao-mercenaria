import { FORMATIONS, type Formation } from "../../utils/constants";

/**
 * Lugar do soldado `i` (de `count`) no referencial da formação: `lateral` (lado) e `depth`
 * (para trás). A conta é a mesma para os batalhões do jogador e os esquadrões inimigos.
 */
export function formationOffset(formation: Formation, i: number, count: number): { lateral: number; depth: number } {
  const spacing = FORMATIONS[formation].spacing;
  switch (formation) {
    case "SHIELD_WALL": {
      // Uma fileira larga (duas se passar de 8)
      const cols = Math.min(count, 8);
      return { lateral: ((i % cols) - (cols - 1) / 2) * spacing, depth: -Math.floor(i / cols) * spacing };
    }
    case "WEDGE": {
      // Triângulo com a ponta à frente: fileira r tem r+1 soldados
      const r = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
      const pos = i - (r * (r + 1)) / 2;
      return { lateral: (pos - r / 2) * spacing, depth: -r * spacing };
    }
    case "LOOSE": {
      const cols = 4;
      // Desalinhamento determinístico por soldado
      return {
        lateral: ((i % cols) - (cols - 1) / 2) * spacing + Math.sin(i * 12.9898) * spacing * 0.25,
        depth: -Math.floor(i / cols) * spacing + Math.cos(i * 78.233) * spacing * 0.25,
      };
    }
    default: {
      const cols = 4;
      return { lateral: ((i % cols) - (cols - 1) / 2) * spacing, depth: -Math.floor(i / cols) * spacing };
    }
  }
}

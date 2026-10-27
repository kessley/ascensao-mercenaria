import type Phaser from "phaser";
import { COLORS, type TroopType } from "../../utils/constants";

const BODY_COLOR: Record<TroopType, number> = {
  INFANTRY: COLORS.ALLY,
  ARCHERS: COLORS.ALLY_ARCHER,
  CAVALRY: COLORS.ALLY_CAVALRY,
};

export interface TroopShapeOptions {
  /** Em pânico: cor desbotada e contorno vermelho. */
  panicked?: boolean;
  /** Amotinado (no acampamento): contorno roxo. */
  mutinous?: boolean;
  /** Infantaria em Parede de Escudos: escudo à frente. */
  shieldWall?: boolean;
}

/**
 * Cavaleiro de apoio (batedor ou mensageiro): cavalo alongado com uma flâmula atrás.
 * Centrado em (0,0), olhando para +X.
 */
export function drawRiderShape(g: Phaser.GameObjects.Graphics, color: number, r: number, pennant: number): void {
  g.clear();
  g.fillStyle(color, 1);
  g.fillEllipse(0, 0, r * 2.4, r * 1.4);
  g.lineStyle(2, COLORS.OUTLINE, 1);
  g.strokeEllipse(0, 0, r * 2.4, r * 1.4);
  g.fillStyle(COLORS.OUTLINE, 1);
  g.fillCircle(r * 1.05, 0, 3);
  // Flâmula na lança, atrás do cavaleiro
  g.lineStyle(2, COLORS.OUTLINE, 1);
  g.lineBetween(-r * 0.6, 0, -r * 0.6, -r * 1.6);
  g.fillStyle(pennant, 1);
  g.fillTriangle(-r * 0.6, -r * 1.6, -r * 0.6 - r, -r * 1.3, -r * 0.6, -r * 1.0);
}

/**
 * Forma greybox de um soldado aliado, centrada em (0,0) e olhando para +X:
 * infantaria = círculo, arqueiro = círculo claro com arco, cavalaria = elipse alongada.
 * Usada na batalha (Soldier) e no acampamento (figuras paradas).
 */
export function drawTroopShape(
  g: Phaser.GameObjects.Graphics,
  troopType: TroopType,
  r: number,
  opts: TroopShapeOptions = {},
): void {
  const fill = opts.panicked ? COLORS.ALLY_PANIC : BODY_COLOR[troopType];
  const outline = opts.mutinous ? COLORS.MUTINEER : opts.panicked ? COLORS.PANIC : COLORS.OUTLINE;
  const outlineWidth = opts.mutinous ? 3 : 2;
  g.clear();

  switch (troopType) {
    case "CAVALRY":
      g.fillStyle(fill, 1);
      g.fillEllipse(0, 0, r * 2.4, r * 1.5);
      g.lineStyle(outlineWidth, outline, 1);
      g.strokeEllipse(0, 0, r * 2.4, r * 1.5);
      g.fillStyle(COLORS.OUTLINE, 1);
      g.fillCircle(r * 1.05, 0, 3);
      break;
    case "ARCHERS":
      g.fillStyle(fill, 1);
      g.fillCircle(0, 0, r);
      g.lineStyle(outlineWidth, outline, 1);
      g.strokeCircle(0, 0, r);
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.beginPath();
      g.arc(0, 0, r + 3, -0.9, 0.9);
      g.strokePath();
      break;
    default:
      g.fillStyle(fill, 1);
      g.fillCircle(0, 0, r);
      g.lineStyle(outlineWidth, outline, 1);
      g.strokeCircle(0, 0, r);
      if (opts.shieldWall) {
        g.fillStyle(COLORS.SHIELD, 1);
        g.fillRect(r - 1, -r, 4, r * 2);
      } else {
        g.fillStyle(COLORS.OUTLINE, 1);
        g.fillCircle(r - 2, 0, 2);
      }
  }
}

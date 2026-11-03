import type Phaser from "phaser";
import { COLORS, TROOPS, type TroopType } from "../../utils/constants";

const BODY_COLOR: Record<TroopType, number> = {
  INFANTRY: COLORS.ALLY,
  SPEARMEN: COLORS.ALLY_SPEAR,
  HEAVY: COLORS.ALLY_HEAVY,
  ARCHERS: COLORS.ALLY_ARCHER,
  CROSSBOW: COLORS.ALLY_CROSSBOW,
  JAVELINS: COLORS.ALLY_JAVELIN,
  CAVALRY: COLORS.ALLY_CAVALRY,
  KNIGHTS: COLORS.ALLY_KNIGHT,
  HORSE_ARCHERS: COLORS.ALLY_ARCHER,
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

/** Arco na frente de quem atira. */
function drawBow(g: Phaser.GameObjects.Graphics, r: number): void {
  g.lineStyle(2, COLORS.OUTLINE, 1);
  g.beginPath();
  g.arc(0, 0, r + 3, -0.9, 0.9);
  g.strokePath();
}

/** O que cada tropa carrega: é por isso que se reconhece um lanceiro de longe. */
function drawGear(g: Phaser.GameObjects.Graphics, troopType: TroopType, r: number, shieldWall: boolean): void {
  switch (troopType) {
    case "SPEARMEN":
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.lineBetween(0, r * 0.5, r * 2.3, r * 0.5);
      g.fillStyle(COLORS.SHIELD, 1);
      g.fillTriangle(r * 2.7, r * 0.5, r * 2.2, r * 0.5 - 3, r * 2.2, r * 0.5 + 3);
      break;
    case "HEAVY":
      // Placas: uma cruz clara no peito
      g.lineStyle(2, COLORS.SHIELD, 1);
      g.lineBetween(-r * 0.6, 0, r * 0.6, 0);
      g.lineBetween(0, -r * 0.6, 0, r * 0.6);
      break;
    case "ARCHERS":
    case "HORSE_ARCHERS":
      drawBow(g, r);
      break;
    case "CROSSBOW":
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.lineBetween(0, 0, r + 4, 0);
      g.lineBetween(r + 1, -r * 0.8, r + 1, r * 0.8);
      break;
    case "JAVELINS":
      g.lineStyle(2, COLORS.OUTLINE, 1);
      g.lineBetween(-r * 0.2, -r * 0.4, r * 1.3, -r * 0.4);
      g.lineBetween(-r * 0.2, r * 0.4, r * 1.3, r * 0.4);
      break;
    default:
      if (shieldWall) {
        g.fillStyle(COLORS.SHIELD, 1);
        g.fillRect(r - 1, -r, 4, r * 2);
      } else {
        g.fillStyle(COLORS.OUTLINE, 1);
        g.fillCircle(r - 2, 0, 2);
      }
  }
}

/**
 * Forma greybox de um soldado aliado, centrada em (0,0) e olhando para +X: a pé é círculo, a
 * cavalo é elipse, e cada tropa carrega o que a distingue (lança, arco, besta, placas).
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
  const heavy = troopType === "HEAVY" || troopType === "KNIGHTS";
  const outlineWidth = opts.mutinous || heavy ? 3 : 2;
  g.clear();

  if (TROOPS[troopType].family === "CAVALRY") {
    g.fillStyle(fill, 1);
    g.fillEllipse(0, 0, r * 2.4, r * 1.5);
    g.lineStyle(outlineWidth, outline, 1);
    g.strokeEllipse(0, 0, r * 2.4, r * 1.5);
    g.fillStyle(COLORS.OUTLINE, 1);
    g.fillCircle(r * 1.05, 0, 3);
    if (troopType === "HORSE_ARCHERS") drawBow(g, r);
    if (troopType === "KNIGHTS") {
      // Lança de cavaleiro, apontada para a frente
      g.lineStyle(2, COLORS.SHIELD, 1);
      g.lineBetween(0, -r * 0.5, r * 2.2, -r * 0.5);
    }
    return;
  }
  g.fillStyle(fill, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(outlineWidth, outline, 1);
  g.strokeCircle(0, 0, r);
  drawGear(g, troopType, r, !!opts.shieldWall);
}

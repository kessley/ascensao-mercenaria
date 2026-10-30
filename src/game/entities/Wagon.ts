import Phaser from "phaser";
import { Unit } from "./Unit";
import { SUPPLY } from "../../utils/constants";
import type { Point } from "../../utils/math";

/** Terrenos onde a carroça atola. */
const ROUGH = new Set(["MUD", "SWAMP", "FOREST", "SHALLOW", "ICE"]);

/**
 * Carroça do trem de suprimentos (Marco 13): leva as rações do exército em campo, segue a
 * coluna atrás dos batalhões e nunca luta. É o alvo preferido dos saqueadores: perdê-la é
 * perder a comida que ela levava. Atola na lama, no pântano, na mata e na neve.
 */
export class Wagon extends Unit {
  readonly wagonId: string;
  private wheelPhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, wagonId: string, hp: number) {
    super(scene, x, y, "ALLY", SUPPLY.WAGON);
    this.wagonId = wagonId;
    this.autoAttack = false;
    // Exército: espera no portão dos povoados alheios, como a tropa
    this.townAccess = "ARMY";
    this.lure = SUPPLY.WAGON_LURE;
    this.restoreHp(hp);
    this.drawBody();
  }

  protected drawBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Rodas, caixa de tábuas e a lona por cima (olhando para +X)
    g.fillStyle(0x2a1d10, 1);
    for (const [x, y] of [
      [-12, -13],
      [10, -13],
      [-12, 13],
      [10, 13],
    ]) {
      g.fillEllipse(x + Math.sin(this.wheelPhase) * 0.6, y, 9, 5);
    }
    g.fillStyle(0x7a5530, 1);
    g.fillRect(-18, -11, 34, 22);
    g.fillStyle(0xe6dcc0, 1);
    g.fillRoundedRect(-15, -10, 26, 20, 6);
    g.lineStyle(1, 0x8a7a5a, 1);
    for (const x of [-8, 0, 8]) g.lineBetween(x, -10, x, 10);
    // Lança e o boi à frente
    g.lineStyle(2, 0x4e3820, 1);
    g.lineBetween(16, 0, 26, 0);
    g.fillStyle(0x5a4632, 1);
    g.fillEllipse(31, 0, 12, 9);
  }

  /** Atola em terreno ruim e na neve (o chão da estação pesa mais para rodas). */
  override speedMultiplier(): number {
    const rough = ROUGH.has(this.terrainType) || this.groundFactor() < 0.85;
    return super.speedMultiplier() * (rough ? SUPPLY.WAGON_ROUGH : 1) * Unit.pace;
  }

  /** Não revida: só sofre. */
  override takeDamage(amount: number, source: Unit, time: number, kind?: "MELEE" | "RANGED"): void {
    super.takeDamage(amount, source, time, kind);
    this.target = null;
  }

  /** Vai até o lugar na coluna (ou fica parada perto dele). */
  follow(p: Point, dt: number): void {
    if (!this.isAlive) return;
    if (Math.hypot(p.x - this.x, p.y - this.y) < 24) {
      this.unitState = "IDLE";
      return;
    }
    this.moveTowards(p.x, p.y, dt);
    this.unitState = "MOVING";
    this.wheelPhase += dt * 8;
  }
}

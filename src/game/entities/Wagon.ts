import Phaser from "phaser";
import { Unit } from "./Unit";
import { COLORS, SUPPLY } from "../../utils/constants";
import { vehicleLook } from "../art/looks";
import type { Point } from "../../utils/math";

/** Terrenos onde a carroça atola. */
const ROUGH = new Set(["MUD", "SWAMP", "FOREST", "SHALLOW", "ICE"]);

/**
 * Carroça do trem de suprimentos (Marco 13): leva as rações do exército em campo, segue a
 * coluna atrás dos batalhões e nunca luta. É o alvo preferido dos saqueadores: perdê-la é
 * perder a comida que ela levava. Atola na lama, no pântano, na mata e na neve.
 */
export class Wagon extends Unit {
  /** Carga de mercadoria atrasa as rodas (Marco 14): a cena atualiza a cada quadro. */
  static load = 1;
  readonly wagonId: string;

  constructor(scene: Phaser.Scene, x: number, y: number, wagonId: string, hp: number) {
    super(scene, x, y, "ALLY", SUPPLY.WAGON);
    this.wagonId = wagonId;
    this.autoAttack = false;
    this.role = "WAGON";
    // Exército: espera no portão dos povoados alheios, como a tropa
    this.townAccess = "ARMY";
    this.lure = SUPPLY.WAGON_LURE;
    this.restoreHp(hp);
    // Carro de bois com lona (G4): o carroceiro veste a cor do bando
    this.wear(vehicleLook("WAGON", COLORS.ALLY));
    this.drawBody();
  }

  /** A figura é o carro inteiro: nada no chão. */
  protected drawBody(): void {
    this.bodyGfx.clear();
  }

  /** Atola em terreno ruim e na neve (o chão da estação pesa mais para rodas). */
  override speedMultiplier(): number {
    const rough = ROUGH.has(this.terrainType) || this.groundFactor() < 0.85;
    return super.speedMultiplier() * (rough ? SUPPLY.WAGON_ROUGH : 1) * Unit.pace * Wagon.load;
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
  }
}
